<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { Back } from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import {
  createCommitteeGate,
  committeeRequestId,
  fetchCommitteeDepartments,
  fetchCommitteeGateAssignments,
  fetchCommitteeGateTemplates,
  fetchCommitteeMaterialCategories,
  fetchCommitteeMaterialTemplates,
  fetchCommitteeProject,
  fetchCommitteeParticipantUserOptions,
  updateCommitteeGate,
} from "@/api/committee";
import { fetchPlatformDictItemsByType } from "@/api/platform-system";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import { formatDate } from "@/utils/formatters";
import { normalizeValveGateCode } from "@/utils/valve-material-template";
import { committeeDepartmentGroupByStage } from "./committee-ui";
import type {
  CommitteeConfigDepartment,
  CommitteeGateAssignment,
  CommitteeGateAssignmentReviewer,
  CommitteeGateMaterial,
  CommitteeGateTemplate,
  CommitteeId,
  CommitteeMaterialCategory,
  CommitteeMaterialTemplateItem,
  CommitteeUserOption,
} from "@/types/committee";
import { fetchBusinessProjectValves } from "@/api/project";
import type { BusinessProjectValveItem } from "@/types/project";

const route = useRoute();
const router = useRouter();
const editing = computed(() => Boolean(route.params.gateId));
const formRef = ref<FormInstance>();
const loading = ref(false);
const saving = ref(false);
const pendingRequestId = ref("");
const pendingRequestIdentity = ref("");
const departments = ref<CommitteeConfigDepartment[]>([]);
const projectOwningCompany = ref("");
const projectValves = ref<BusinessProjectValveItem[]>([]);

const COMPANY_NAME_ALIASES = [
  ["北京新能源汽车股份有限公司", "北汽新能源"],
  ["北京汽车股份有限公司", "北汽股份"],
  ["北京新能源汽车", "北汽新能源"],
  ["北京汽车", "北汽"],
] as const;
const COMPANY_SUFFIX_PATTERN = /(有限责任公司|有限公司)$/;

function isProjectValvePassed(item: BusinessProjectValveItem) {
  return ["1", "2", "3"].includes(String(item.passValveStatus ?? "0"));
}
const materialCategories = ref<CommitteeMaterialCategory[]>([]);
const materialTemplates = ref<CommitteeMaterialTemplateItem[]>([]);
const gateTemplates = ref<CommitteeGateTemplate[]>([]);
const meetingLevelTabs = ref<Array<{ name: string; label: string }>>([]);
const visibleMaterialKeys = ref<string[]>([]);
const selectedMaterialKeys = ref<string[]>([]);
const userOptions = reactive<Record<string, CommitteeUserOption[]>>({});
type ErrorInfo = { code: string; message: string; traceId?: string };
const reviewConfigError = ref<ErrorInfo>();
const form = reactive({
  gateName: "",
  gateStatus: "",
  projectValveId: undefined as number | undefined,
  plannedFinishDate: "",
  actualFinishDate: "",
  gatePurpose: "",
  coreWorkContent: "",
  materials: [
    {
      materialName: "",
      materialRequirement: "",
      materialType: "",
      sourceTemplateId: undefined as number | undefined,
    },
  ],
  assignments: [] as Array<{
    departmentId: string;
    departmentName?: string;
    applicableStage: string;
    departmentGroup: string;
    requiredFlag: "0" | "1";
    headUserIds: string[];
    reviewerUserIds: string[];
  }>,
});
const formRules: FormRules<typeof form> = {
  projectValveId: [
    { required: true, message: "请选择阀点", trigger: "change" },
  ],
  plannedFinishDate: [
    { required: true, message: "请选择计划完成时间", trigger: "change" },
  ],
  gatePurpose: [
    {
      required: true,
      whitespace: true,
      message: "请输入阀点目的",
      trigger: "blur",
    },
  ],
  coreWorkContent: [
    {
      required: true,
      whitespace: true,
      message: "请输入核心工作内容",
      trigger: "blur",
    },
  ],
};
const assignmentGroups = computed(() =>
  meetingLevelTabs.value
    .filter((tab) => isVisibleMeetingLevel(tab.name))
    .map((tab) => {
      const rows = form.assignments.filter((item) =>
        assignmentBelongsToStage(item.applicableStage, tab.name),
      );
      return {
        ...tab,
        rows,
        configuredCount: rows.filter((row) => row.reviewerUserIds.length)
          .length,
      };
    })
    .filter((group) => group.rows.length > 0),
);
const currentProjectCompanyStage = computed(() => {
  const owningCompany = normalizeStage(projectOwningCompany.value);
  if (!owningCompany) return "";
  const companyStages = meetingLevelTabs.value.filter(
    (tab) => normalizeStage(tab.name) !== "GROUP",
  );
  const matchedStage = companyStages.find(
    (tab) =>
      normalizeStage(tab.name) === owningCompany ||
      normalizeCompanyName(tab.label) === normalizeCompanyName(owningCompany),
  );
  if (matchedStage) return matchedStage.name;
  return companyStages.length === 1 ? companyStages[0].name : "";
});
const materialGroups = computed(() =>
  materialCategories.value
    .filter((category) => category.enableFlag === "1")
    .slice()
    .sort((first, second) => first.sortNo - second.sortNo)
    .map((category) => {
      const materials = materialTemplates.value
        .filter(
          (material) =>
            material.enableFlag === "1" &&
            String(material.categoryId) === String(category.id),
        )
        .filter((material) =>
          visibleMaterialKeys.value.includes(String(material.id)),
        )
        .slice()
        .sort((first, second) => (first.sortNo ?? 0) - (second.sortNo ?? 0))
        .map((material) => ({
          key: String(material.id),
          label: material.materialName ?? material.label ?? "未命名材料",
          template: material,
        }));
      return {
        key: String(category.id),
        label: category.categoryName,
        materials,
        selectedCount: materials.filter((item) =>
          selectedMaterialKeys.value.includes(item.key),
        ).length,
      };
    })
    .filter((group) => group.materials.length > 0),
);
function assignmentBelongsToStage(applicableStage: string, tabName: string) {
  return normalizeStage(applicableStage) === normalizeStage(tabName);
}

function isVisibleMeetingLevel(stage: string) {
  const normalizedStage = normalizeStage(stage);
  if (normalizedStage === "GROUP") return true;
  return normalizedStage === currentProjectCompanyStage.value;
}

function normalizeStage(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCompanyName(value: unknown) {
  let companyName = normalizeStage(value).replace(/[\s（）()]/g, "");
  for (const [fullName, abbreviation] of COMPANY_NAME_ALIASES) {
    companyName = companyName.replace(fullName, abbreviation);
  }
  return companyName.replace(COMPANY_SUFFIX_PATTERN, "");
}

function stageDepartmentGroup(value: unknown) {
  return committeeDepartmentGroupByStage(normalizeStage(value));
}

function valueAsString(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

function dateValue(value: unknown) {
  const formatted = formatDate(value as string | null | undefined);
  return formatted === "--" ? "" : formatted;
}

function assignmentUserId(row: CommitteeGateAssignment) {
  const values = row as CommitteeGateAssignment & {
    headUserId?: unknown;
    headUserName?: unknown;
  };
  return valueAsString(values.headUserId ?? values.headUserName);
}

function reviewerUserId(row: CommitteeGateAssignmentReviewer) {
  const values = row as CommitteeGateAssignmentReviewer & {
    reviewerUserId?: unknown;
    reviewerUserName?: unknown;
  };
  return valueAsString(values.reviewerUserId ?? values.reviewerUserName);
}

function reviewerDisplayName(row: CommitteeGateAssignmentReviewer) {
  const values = row as CommitteeGateAssignmentReviewer & {
    reviewerUserId?: unknown;
    reviewerUserName?: unknown;
  };
  return valueAsString(values.reviewerUserName);
}

function cacheReviewerOptions(reviewers: CommitteeGateAssignmentReviewer[]) {
  for (const reviewer of reviewers) {
    const userId = reviewerUserId(reviewer);
    const displayName = reviewerDisplayName(reviewer);
    const departmentId = valueAsString(reviewer.departmentId);
    if (!userId || !departmentId) continue;

    const options = userOptions[departmentId] ?? [];
    if (options.some((option) => String(option.userId) === userId)) continue;
    userOptions[departmentId] = [
      ...options,
      {
        userId,
        displayName: displayName || userId,
        departmentId,
      },
    ];
  }
}

async function preloadReviewerOptions(
  reviewers: CommitteeGateAssignmentReviewer[],
) {
  cacheReviewerOptions(reviewers);
  const departmentIds = Array.from(
    new Set(
      reviewers
        .map((reviewer) => valueAsString(reviewer.departmentId))
        .filter(Boolean),
    ),
  );
  await Promise.all(
    departmentIds.map(async (departmentId) => {
      try {
        const options = await fetchCommitteeParticipantUserOptions(
          departmentId,
          "REVIEWER",
          "",
        );
        const selectedOptions = userOptions[departmentId] ?? [];
        userOptions[departmentId] = mergeUserOptions(options, selectedOptions);
      } catch {
        // The selected reviewer cache still allows the existing value to render.
      }
    }),
  );
}

function mergeUserOptions(
  options: CommitteeUserOption[],
  selectedOptions: CommitteeUserOption[],
) {
  const merged = [...options];
  for (const selectedOption of selectedOptions) {
    if (
      !merged.some(
        (option) => String(option.userId) === String(selectedOption.userId),
      )
    ) {
      merged.push(selectedOption);
    }
  }
  return merged;
}

function assignmentDisplayName(row: {
  departmentId: string;
  departmentName?: string;
}) {
  return (
    row.departmentName ||
    departments.value.find((d) => d.departmentId === row.departmentId)
      ?.departmentName ||
    row.departmentId
  );
}

function assignmentStatus(row: {
  requiredFlag: "0" | "1";
  headUserIds: string[];
  reviewerUserIds: string[];
}) {
  if (row.requiredFlag !== "1") {
    return "不参加评审";
  }
  const headUserIds = effectiveHeadUserIds(row);
  if (!headUserIds.length && !row.reviewerUserIds.length) {
    return "暂未配置";
  }
  return ` 评审人 ${row.reviewerUserIds.length} 人`;
}

function effectiveHeadUserIds(row: { headUserIds: string[] }) {
  return row.headUserIds;
}

function handleRequiredFlagChange(row: {
  requiredFlag: "0" | "1";
  reviewerUserIds: string[];
}) {
  if (row.requiredFlag === "0") {
    row.reviewerUserIds = [];
  }
}

function validateRequiredReviewers() {
  const missingAssignment = form.assignments.find(
    (assignment) =>
      assignment.requiredFlag === "1" && !assignment.reviewerUserIds.length,
  );
  if (missingAssignment) {
    BaseToast.warning(`${assignmentDisplayName(missingAssignment)}评审人不能为空`);
    return false;
  }
  return true;
}

function resolveMaterialTemplateKey(material: {
  materialName: string;
  materialRequirement?: string | null;
  materialType?: string | null;
  sourceTemplateId?: string | number | null;
}) {
  if (
    material.sourceTemplateId !== undefined &&
    material.sourceTemplateId !== null
  ) {
    return String(material.sourceTemplateId);
  }
  const normalizedName = normalizeStage(material.materialName);
  const normalizedRequirement = normalizeStage(material.materialRequirement);
  const normalizedType = normalizeStage(material.materialType);
  const matched = materialTemplates.value.find((item) => {
    const templateName = normalizeStage(item.materialName ?? item.label);
    const templateRequirement = normalizeStage(
      item.materialRequirement ?? item.requirement,
    );
    const templateType = normalizeStage(item.fileType);
    return (
      templateName === normalizedName &&
      templateRequirement === normalizedRequirement &&
      templateType === normalizedType
    );
  });
  return matched ? String(matched.id) : "";
}

function buildReviewersByAssignment(
  reviewers: CommitteeGateAssignmentReviewer[],
) {
  const reviewersByAssignment = new Map<string, string[]>();
  for (const reviewer of reviewers) {
    const assignmentId = String(reviewer.assignmentId);
    const values = reviewersByAssignment.get(assignmentId) ?? [];
    values.push(reviewerUserId(reviewer));
    reviewersByAssignment.set(assignmentId, values.filter(Boolean));
  }
  return reviewersByAssignment;
}

function fillAssignments(
  assignments: CommitteeGateAssignment[],
  reviewers: CommitteeGateAssignmentReviewer[],
) {
  const reviewersByAssignment = buildReviewersByAssignment(reviewers);
  const assignmentByDepartmentId = new Map(
    assignments.map((row) => [String(row.departmentId), row]),
  );
  form.assignments = departments.value
    .filter(
      (department) =>
        department.enableFlag === "1" &&
        isVisibleMeetingLevel(department.applicableStage),
    )
    .map((department) => {
      const existing = assignmentByDepartmentId.get(
        String(department.departmentId),
      );
      return {
        departmentId: department.departmentId,
        departmentName: department.departmentName,
        applicableStage: normalizeStage(department.applicableStage),
        departmentGroup: stageDepartmentGroup(department.applicableStage),
        // 编辑回显只以 assignment 是否存在为准，未配置部门必须关闭。
        requiredFlag: existing ? "1" : "0",
        headUserIds: existing
          ? [assignmentUserId(existing)].filter(Boolean)
          : [],
        reviewerUserIds: existing
          ? (reviewersByAssignment.get(String(existing.id)) ?? [])
          : [],
      };
    });
}

function fillMaterials(materials: CommitteeGateMaterial[]) {
  form.materials = materials.length
    ? materials.map((material) => ({
        materialName: material.materialName,
        materialRequirement: material.materialRequirement ?? "",
        materialType: material.materialType ?? "",
        sourceTemplateId:
          material.sourceTemplateId === undefined ||
          material.sourceTemplateId === null
            ? undefined
            : Number(material.sourceTemplateId),
      }))
    : [];
}

function rebuildMaterialSnapshots() {
  const selected = new Set(selectedMaterialKeys.value);
  form.materials = materialGroups.value
    .flatMap((group) => group.materials)
    .filter((item) => selected.has(item.key))
    .map((item) => ({
      materialName:
        item.template.materialName ?? item.template.label ?? "未命名材料",
      materialRequirement:
        item.template.materialRequirement ?? item.template.requirement ?? "",
      materialType: item.template.fileType ?? "",
      sourceTemplateId: Number(item.key),
    }));
}
function normalizeError(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
): ErrorInfo {
  if (error instanceof Error) {
    const values = error as Error & { code?: unknown; traceId?: unknown };
    return {
      code: String(values.code ?? fallbackCode),
      message: error.message
        ? `${fallbackMessage}${error.message}`
        : fallbackMessage,
      traceId:
        values.traceId === undefined ? undefined : String(values.traceId),
    };
  }
  return { code: fallbackCode, message: fallbackMessage };
}
async function loadMeetingLevelTabs() {
  try {
    const levelRows = await fetchPlatformDictItemsByType(
      "committee_meeting_level",
    );
    reviewConfigError.value = undefined;
    meetingLevelTabs.value = levelRows
      .filter((item) => item.status === "ENABLED")
      .map((item) => ({
        name: normalizeStage(item.dictItemCode),
        label:
          normalizeStage(item.dictItemLabel) ||
          normalizeStage(item.dictItemCode),
      }))
      .filter((item) => item.name);
  } catch (error) {
    meetingLevelTabs.value = [];
    reviewConfigError.value = normalizeError(
      error,
      "FRONTEND-COMMITTEE-GATE-MEETING-LEVEL-001",
      "会议层级字典加载失败，请检查字典读取权限或会议层级配置。",
    );
  }
}
function initializeMaterialSnapshots() {
  visibleMaterialKeys.value = [];
  selectedMaterialKeys.value = [];
  rebuildMaterialSnapshots();
}

function syncMaterialSelectionsFromSnapshot() {
  const keys = form.materials
    .map((material) => resolveMaterialTemplateKey(material))
    .filter((key): key is string => Boolean(key));
  visibleMaterialKeys.value = Array.from(new Set(keys));
  selectedMaterialKeys.value = Array.from(new Set(keys));
  rebuildMaterialSnapshots();
}

function isMaterialSelected(materialKey: string) {
  return selectedMaterialKeys.value.includes(materialKey);
}

function handleMaterialChange(
  materialKey: string,
  checked: boolean | string | number,
) {
  const nextKeys = new Set(selectedMaterialKeys.value);
  if (checked) {
    nextKeys.add(materialKey);
  } else {
    nextKeys.delete(materialKey);
  }
  selectedMaterialKeys.value = materialGroups.value
    .flatMap((category) => category.materials.map((item) => item.key))
    .filter((key) => nextKeys.has(key));
  rebuildMaterialSnapshots();
}

function findGateTemplate(
  templates: CommitteeGateTemplate[],
  valveName: string,
  fallbackCode: string,
) {
  const gateCode = normalizeValveGateCode(valveName, fallbackCode);
  return (
    templates.find((template) => template.gateCode === gateCode) ??
    templates.find((template) => template.gateName === valveName) ??
    null
  );
}

function fillMaterialKeysFromTemplate(
  materialTemplateIds: CommitteeId[],
  selectedMaterialTemplateIds: CommitteeId[] = materialTemplateIds,
) {
  const selectedIds = new Set(materialTemplateIds.map(String));
  const checkedIds = new Set(selectedMaterialTemplateIds.map(String));
  const availableIds = materialTemplates.value
    .filter(
      (material) =>
        material.enableFlag === "1" && selectedIds.has(String(material.id)),
    )
    .map((material) => String(material.id));
  visibleMaterialKeys.value = availableIds;
  selectedMaterialKeys.value = availableIds.filter((key) =>
    checkedIds.has(key),
  );
  rebuildMaterialSnapshots();
}

async function load() {
  loading.value = true;
  reviewConfigError.value = undefined;
  try {
    if (editing.value) {
      const [
        detail,
        departmentRows,
        valveRows,
        categoryRows,
        materialRows,
        templateRows,
        assignmentSet,
      ] = await Promise.all([
        fetchCommitteeProject(String(route.params.projectId)),
        fetchCommitteeDepartments(),
        fetchBusinessProjectValves(Number(route.params.projectId)),
        fetchCommitteeMaterialCategories(),
        fetchCommitteeMaterialTemplates(),
        fetchCommitteeGateTemplates(),
        fetchCommitteeGateAssignments(String(route.params.gateId)),
      ]);
      await loadMeetingLevelTabs();
      projectOwningCompany.value = detail.project.owningCompany ?? "";
      departments.value = departmentRows;
      projectValves.value = valveRows.records;
      materialCategories.value = categoryRows;
      materialTemplates.value = materialRows;
      gateTemplates.value = templateRows;
      const gate = detail.currentGate;
      const selectedValve = projectValves.value.find(
        (item) =>
          Number(item.projectValveId) === Number(gate?.projectValveId) ||
          Number(item.valveId) === Number(gate?.valveId),
      );
      Object.assign(form, {
        gateName: gate?.gateName ?? "",
        gateStatus: gate?.gateStatus ?? "",
        projectValveId:
          selectedValve?.projectValveId === undefined &&
          (gate?.projectValveId === undefined || gate?.projectValveId === null)
            ? undefined
            : Number(selectedValve?.projectValveId ?? gate?.projectValveId),
        plannedFinishDate: dateValue(
          selectedValve?.plannedPassTime ?? gate?.plannedFinishDate,
        ),
        actualFinishDate: dateValue(
          selectedValve?.actualValvePassageTime ?? gate?.actualFinishDate,
        ),
        gatePurpose: gate?.gatePurpose ?? "",
        coreWorkContent: gate?.coreWorkContent ?? "",
      });
      fillMaterials(detail.materials);
      fillAssignments(assignmentSet.assignments, assignmentSet.reviewers);
      await preloadReviewerOptions(assignmentSet.reviewers);
      const template = findGateTemplate(
        gateTemplates.value,
        gate?.gateName ?? selectedValve?.valveName ?? "",
        gate?.gateCode ?? selectedValve?.valveCode ?? "",
      );
      if (template) {
        const selectedMaterialTemplateIds = detail.materials.map((material) => {
          if (
            material.sourceTemplateId !== undefined &&
            material.sourceTemplateId !== null
          ) {
            return material.sourceTemplateId;
          }
          return resolveMaterialTemplateKey(material);
        });
        fillMaterialKeysFromTemplate(
          template.materialTemplateIds,
          selectedMaterialTemplateIds,
        );
      } else {
        syncMaterialSelectionsFromSnapshot();
      }
      return;
    }
    const [
      detail,
      departmentRows,
      valveRows,
      categoryRows,
      materialRows,
      templateRows,
    ] = await Promise.all([
      fetchCommitteeProject(String(route.params.projectId)),
      fetchCommitteeDepartments(),
      fetchBusinessProjectValves(Number(route.params.projectId)),
      fetchCommitteeMaterialCategories(),
      fetchCommitteeMaterialTemplates(),
      fetchCommitteeGateTemplates(),
    ]);
    projectOwningCompany.value = detail.project.owningCompany ?? "";
    departments.value = departmentRows;
    projectValves.value = valveRows.records;
    materialCategories.value = categoryRows;
    materialTemplates.value = materialRows;
    gateTemplates.value = templateRows;
    await loadMeetingLevelTabs();
    form.assignments = departments.value
      .filter(
        (d) => d.enableFlag === "1" && isVisibleMeetingLevel(d.applicableStage),
      )
      .map((d) => ({
        departmentId: d.departmentId,
        departmentName: d.departmentName,
        applicableStage: normalizeStage(d.applicableStage),
        departmentGroup: stageDepartmentGroup(d.applicableStage),
        requiredFlag: d.requiredByDefault,
        headUserIds: [],
        reviewerUserIds: [],
      }));
    initializeMaterialSnapshots();
  } finally {
    loading.value = false;
  }
}

function handleProjectValveChange(projectValveId?: number) {
  const selectedValve = projectValves.value.find(
    (item) => Number(item.projectValveId) === Number(projectValveId),
  );
  form.plannedFinishDate = dateValue(selectedValve?.plannedPassTime);
  form.actualFinishDate = dateValue(
    selectedValve?.actualValvePassageTime,
  );
  form.gatePurpose = selectedValve?.gatePurpose ?? "";
  form.coreWorkContent = selectedValve?.coreWorkContent ?? "";
  const template = selectedValve
    ? findGateTemplate(
        gateTemplates.value,
        selectedValve.valveName,
        selectedValve.valveCode,
      )
    : null;
  fillMaterialKeysFromTemplate(template?.materialTemplateIds ?? []);
}

async function submit() {
  if (saving.value) return;
  saving.value = true;
  try {
    const valid = await formRef.value?.validate().catch(() => false);
    if (valid === false) return;
    if (!validateRequiredReviewers()) return;
    const data = {
      projectValveId: Number(form.projectValveId),
      plannedFinishDate: form.plannedFinishDate,
      actualFinishDate: form.actualFinishDate,
      gatePurpose: form.gatePurpose,
      coreWorkContent: form.coreWorkContent,
      materials: form.materials.map((m) => ({
        ...m,
        sourceTemplateId:
          m.sourceTemplateId === undefined || m.sourceTemplateId === null
            ? undefined
            : Number(m.sourceTemplateId),
      })),
      assignments: form.assignments
        .filter((a) => a.reviewerUserIds.length)
        .map((assignment) => ({
          departmentId: Number(assignment.departmentId),
          applicableStage: assignment.applicableStage,
          departmentGroup: assignment.departmentGroup,
          requiredFlag: assignment.requiredFlag,
          headUserIds: effectiveHeadUserIds(assignment),
          reviewerUserIds: assignment.reviewerUserIds.map((userId) =>
            Number(userId),
          ),
        })),
    };
    const requestIdentity = JSON.stringify({
      editing: editing.value,
      projectId: route.params.projectId,
      gateId: route.params.gateId,
      data,
    });
    if (
      !pendingRequestId.value ||
      pendingRequestIdentity.value !== requestIdentity
    ) {
      pendingRequestId.value = committeeRequestId();
      pendingRequestIdentity.value = requestIdentity;
    }
    if (editing.value) {
      await updateCommitteeGate(String(route.params.gateId), {
        ...data,
        clientRequestId: pendingRequestId.value,
      });
    } else {
      await createCommitteeGate(String(route.params.projectId), {
        ...data,
        clientRequestId: pendingRequestId.value,
      });
    }
    pendingRequestId.value = "";
    pendingRequestIdentity.value = "";
    BaseToast.success(editing.value ? "阀点已更新" : "阀点已创建");
    router.push(`/committee/projects/${route.params.projectId}`);
  } finally {
    saving.value = false;
  }
}

async function handleSubmit(): Promise<void> {
  try {
    await submit();
  } catch {
    // 请求层已展示业务错误，提交失败时保留当前表单供用户修正或重试。
  }
}

async function searchUsers(departmentId: string, keyword: string) {
  if (!/^\d+$/.test(String(departmentId))) {
    userOptions[departmentId] = [];
    BaseToast.warning("参评部门编号不合法，无法加载部门人员");
    return;
  }
  try {
    userOptions[departmentId] = await fetchCommitteeParticipantUserOptions(
      departmentId,
      "REVIEWER",
      keyword,
    );
  } catch {
    userOptions[departmentId] = [];
    BaseToast.warning("该部门人员加载失败，请检查部门配置或后端服务");
  }
}

onMounted(load);
</script>

<template>
  <PageContainer :title="editing ? '编辑阀点' : '关联阀点'">
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        @click="
          router.replace(
            String(
              route.query.returnPath ||
                route.meta.breadcrumbParentPath ||
                route.meta.activeMenu ||
                `/committee/projects/${route.params.projectId}`,
            ),
          )
        "
        >返回
      </PermissionButton>
      <PermissionButton
        type="primary"
        :disabled="Boolean(reviewConfigError)"
        :disabled-reason="reviewConfigError?.message"
        :loading="saving"
        @click="handleSubmit"
        >保存</PermissionButton
      >
      <!--    11--> </template
    ><el-form
      ref="formRef"
      v-loading="loading"
      :model="form"
      :rules="formRules"
      label-position="top"
      class="committee-gate-form"
      ><section class="committee-block committee-block--primary">
        <BaseSectionTitle title="阀点基础信息" heading-tag="h2" />
        <div class="form-grid">
          <el-form-item label="选择阀点" prop="projectValveId">
            <el-select
              v-model="form.projectValveId"
              :disabled="editing"
              filterable
              placeholder="请选择阀点"
              @change="handleProjectValveChange"
            >
              <el-option
                v-for="item in projectValves"
                :key="item.projectValveId"
                :label="item.valveName"
                :disabled="isProjectValvePassed(item)"
                :value="item.projectValveId"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="计划完成时间" prop="plannedFinishDate">
            <el-date-picker
              v-model="form.plannedFinishDate"
              disabled
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择计划完成时间"
            />
          </el-form-item>
          <el-form-item label="实际完成时间">
            <el-date-picker
                disabled
              v-model="form.actualFinishDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择实际完成时间"
            />
          </el-form-item>
        </div>
        <el-form-item label="阀点目的" prop="gatePurpose">
          <el-input
            v-model="form.gatePurpose"
            disabled
            type="textarea"
            :rows="3"
            maxlength="4000"
            placeholder="请输入阀点目的"
          />
        </el-form-item>
        <el-form-item label="核心工作内容" prop="coreWorkContent">
          <el-input
            v-model="form.coreWorkContent"
            disabled
            type="textarea"
            :rows="4"
            maxlength="4000"
            placeholder="请输入核心工作内容"
          />
        </el-form-item>
      </section>
      <section class="committee-block">
        <BaseSectionTitle title="评审权限管理" heading-tag="h2" />
        <!--        <p class="committee-gate-form__summary">-->
        <!--          当前所属品牌公司：{{ currentCompanyName || "&#45;&#45;" }}-->
        <!--        </p>-->
        <TraceErrorAlert
          v-if="reviewConfigError"
          v-bind="reviewConfigError"
          class="committee-gate-form__review-error"
          data-testid="gate-review-assignment-error"
        />
        <div
          v-else-if="assignmentGroups.length"
          class="committee-gate-form__review-groups"
          data-testid="gate-review-assignment"
        >
          <section
            v-for="group in assignmentGroups"
            :key="group.name"
            class="committee-gate-form__review-group"
          >
            <div class="committee-gate-form__review-group-head">
              <h3>{{ group.label }}</h3>
              <span
                >已配置 {{ group.configuredCount }} /
                {{ group.rows.length }} 个部门</span
              >
            </div>
            <div
              v-if="group.rows.length"
              class="committee-gate-form__review-table"
            >
              <div
                v-for="row in group.rows"
                :key="`${group.name}-${row.departmentId}`"
                class="committee-gate-form__review-row"
              >
                <div class="committee-gate-form__review-department">
                  {{ assignmentDisplayName(row) }}
                </div>
                <div class="committee-gate-form__review-required">
                  <span>必审</span>
                  <el-switch
                    v-model="row.requiredFlag"
                    active-value="1"
                    inactive-value="0"
                    @change="handleRequiredFlagChange(row)"
                  />
                </div>
                <!--                <div class="committee-gate-form__review-input">-->
                <!--                  <span class="committee-gate-form__review-label"-->
                <!--                    >部门负责人</span-->
                <!--                  >-->
                <!--                  <el-select-->
                <!--                    v-model="row.headUserIds"-->
                <!--                    multiple-->
                <!--                    filterable-->
                <!--                    remote-->
                <!--                    collapse-tags-->
                <!--                    collapse-tags-tooltip-->
                <!--                    :remote-method="-->
                <!--                      (keyword: string) =>-->
                <!--                        searchUsers(row.departmentId, keyword)-->
                <!--                    "-->
                <!--                    placeholder="搜索并选择本部门负责人"-->
                <!--                    @visible-change="-->
                <!--                      (visible: boolean) =>-->
                <!--                        visible && searchUsers(row.departmentId, '')-->
                <!--                    "-->
                <!--                  >-->
                <!--                    <el-option-->
                <!--                      v-for="user in userOptions[row.departmentId] ?? []"-->
                <!--                      :key="user.userId"-->
                <!--                      :label="user.displayName"-->
                <!--                      :value="user.userId"-->
                <!--                    />-->
                <!--                  </el-select>-->
                <!--                </div>-->
                <div
                  v-if="row.requiredFlag === '1'"
                  class="committee-gate-form__review-input"
                >
                  <span class="committee-gate-form__review-label">评审人</span>
                  <el-select
                    v-model="row.reviewerUserIds"
                    multiple
                    filterable
                    remote
                    collapse-tags
                    collapse-tags-tooltip
                    :max-collapse-tags="3"
                    :remote-method="
                      (keyword: string) =>
                        searchUsers(row.departmentId, keyword)
                    "
                    placeholder="搜索并选择本部门评审人"
                    @visible-change="
                      (visible: boolean) =>
                        visible && searchUsers(row.departmentId, '')
                    "
                  >
                    <el-option
                      v-for="user in userOptions[row.departmentId] ?? []"
                      :key="user.userId"
                      :label="user.displayName"
                      :value="user.userId"
                    />
                  </el-select>
                </div>
                <div v-else class="committee-gate-form__review-placeholder"></div>
                <div class="committee-gate-form__review-status">
                  {{ assignmentStatus(row) }}
                </div>
              </div>
            </div>
            <div v-else class="committee-gate-form__review-empty">
              请先在参评部门配置中启用该阶段部门
            </div>
          </section>
        </div>
        <el-empty v-else description="请先维护会议层级字典和参评部门配置" />
      </section>
      <section v-if="form.projectValveId" class="committee-block">
        <BaseSectionTitle title="材料清单" heading-tag="h2">
          <template #actions>
            <span class="committee-gate-form__summary">
              已选 {{ form.materials.length }} 项
            </span>
          </template>
        </BaseSectionTitle>
        <div class="committee-gate-form__materials">
          <section
            v-for="group in materialGroups"
            :key="group.key"
            class="committee-gate-form__material-group"
          >
            <div class="committee-gate-form__material-head">
              <h3>{{ group.label }}</h3>
              <span
                >{{ group.selectedCount }} / {{ group.materials.length }}</span
              >
            </div>
            <div class="committee-gate-form__material-options">
              <div
                v-for="material in group.materials"
                :key="material.key"
                class="committee-gate-form__material-option"
              >
                <el-checkbox
                  :model-value="isMaterialSelected(material.key)"
                  :title="material.label"
                  @change="handleMaterialChange(material.key, $event)"
                >
                  <span
                    class="committee-gate-form__material-label"
                    :title="material.label"
                    >{{ material.label }}</span
                  >
                </el-checkbox>
              </div>
            </div>
          </section>
        </div>
      </section>
    </el-form>
  </PageContainer>
</template>

<style scoped>
.committee-gate-form {
  display: grid;
  gap: 16px;
}

.committee-block {
  padding: 18px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  box-shadow: var(--bq-shadow-card);
}

.committee-block--primary {
  box-shadow: var(--bq-shadow-page);
}

.committee-block header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.committee-block h2 {
  margin: 0;
  font-size: var(--bq-font-section-title, 16px);
}

.committee-gate-form__summary {
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact, 14px);
}

.committee-gate-form__materials {
  display: grid;
  gap: 12px;
}

.committee-gate-form__material-group {
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
  overflow: hidden;
}

.committee-gate-form__material-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bq-color-bg-soft);
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.committee-gate-form__material-head h3 {
  margin: 0;
  font-size: var(--bq-font-compact, 14px);
}

.committee-gate-form__material-head span {
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper, 12px);
  white-space: nowrap;
}

.committee-gate-form__material-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 12px;
}

.committee-gate-form__material-option {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  padding: 4px 6px;
  border-radius: var(--bq-radius-control, 4px);
  transition: background-color 0.15s ease;
}

.committee-gate-form__material-option:hover {
  background-color: var(--bq-color-bg-soft, #f8fafc);
}

.committee-gate-form__material-option :deep(.el-checkbox) {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  margin-right: 0;
  height: auto;
}

.committee-gate-form__material-option :deep(.el-checkbox__label) {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  padding-left: 8px;
  font-size: var(--bq-font-compact, 14px);
  line-height: 1.5;
}

.committee-gate-form__material-label {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.committee-gate-form__review-groups {
  display: grid;
  gap: 12px;
}
.committee-gate-form__review-error {
  margin-bottom: 12px;
}
.committee-gate-form__review-group {
  display: grid;
  gap: 6px;
}

.committee-gate-form__review-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bq-color-bg-soft);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
}

.committee-gate-form__review-group-head h3 {
  margin: 0;
  color: var(--bq-color-text);
  font-size: var(--bq-font-compact, 14px);
  font-weight: 600;
  line-height: 20px;
}

.committee-gate-form__review-group-head span {
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
  white-space: nowrap;
}

.committee-gate-form__review-table {
  display: grid;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
  overflow: hidden;
}

.committee-gate-form__review-row {
  display: grid;
  grid-template-columns: 150px 88px minmax(200px, 1fr) 140px;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 10px 12px;
  background: var(--bq-color-surface);
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.committee-gate-form__review-row:last-child {
  border-bottom: 0;
}

.committee-gate-form__review-department {
  min-width: 0;
  overflow: hidden;
  color: var(--bq-color-text);
  font-size: var(--bq-font-compact);
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.committee-gate-form__review-required {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper, 12px);
  white-space: nowrap;
}

.committee-gate-form__review-input {
  display: grid;
  grid-template-columns: 66px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.committee-gate-form__review-label {
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
  white-space: nowrap;
}

.committee-gate-form__review-readonly {
  min-width: 0;
  overflow: hidden;
  color: var(--bq-color-text);
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.committee-gate-form__review-status {
  grid-column: 4;
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
  text-align: right;
  white-space: nowrap;
}

.committee-gate-form__review-empty {
  padding: 12px 14px;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
  background: var(--bq-color-bg-soft);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 16px;
}

.form-grid :deep(.el-date-editor) {
  width: 100%;
}

.form-grid :deep(.el-select) {
  width: 100%;
}

.committee-block :deep(.el-select) {
  width: 100%;
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .committee-gate-form__review-group-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .committee-gate-form__review-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .committee-gate-form__review-input {
    grid-template-columns: 76px minmax(0, 1fr);
  }

  .committee-gate-form__review-status {
    grid-column: auto;
    text-align: left;
  }
}
</style>
