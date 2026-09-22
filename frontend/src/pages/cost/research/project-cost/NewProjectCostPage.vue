<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { resolveServerTotal } from "@/utils/pagination";
/* eslint-disable @typescript-eslint/no-unused-vars */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowDown,
  CircleCheck,
  CirclePlus,
  CopyDocument,
  Delete,
  Download,
  Lock,
  Minus,
  Operation,
  Plus,
  Refresh,
  Search,
  Unlock,
  Upload,
} from "@element-plus/icons-vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import {
  buildCostBomExportFileName,
  normalizeCostBomVersion,
} from "@/utils/cost-bom-export";
import { ApiBusinessError } from "@/api/http";
import {
  createCostBomExport,
  createCostBomExtendCalculationTask,
  deleteCostBomVersion,
  deleteCostBomPart,
  fetchCostBomGenerateVersions,
  fetchCostBomPartHistories,
  fetchCostBomParts,
  importProjectCostBomData,
  saveCostBomParts,
  submitCostBomVersion,
  updateCostBomVersionGateStatus,
  updateCostBomVersionLockStatus,
  copyCostBomValveData,
} from "@/api/cost-center";
import { fetchBusinessValves, fetchBusinessProjects } from "@/api/project";
import type { UploadFile } from "element-plus";
import type {
  CostBomPartItem,
  CostBomPartSaveItem,
  CostBomGenerateVersionItem,
  CostBomVersionItem,
} from "@/types/cost-center";
import type { BusinessProjectItem, BusinessValveItem } from "@/types/project";

type GateCode = string;
type GateStatus = "" | "PENDING" | "ALLOW" | "CONDITIONAL" | "DENY";
type ResolvedGateStatus = Exclude<GateStatus, "">;
type PassGateMode = "ALLOW" | "CONDITIONAL" | "DENY";
type PartEditMode = "add" | "edit" | "copy";
type DeleteTarget = "versions" | "parts";
type DetailLogic = "AND" | "OR";
type DetailOperator = "eq" | "gt" | "gte" | "lt" | "lte" | "isNull" | "isNotNull" | "like";
const nullOperators = new Set<DetailOperator>(["isNull", "isNotNull"]);

type ProjectCostQuery = {
  projectId: string;
  projectName: string;
  gateCode: GateCode;
  gateStatus: GateStatus;
  bomVersion: string;
  creator: string;
  createdRange: [string, string] | [];
};

type ProjectCostRow = {
  id: number;
  versionId?: number | null;
  valveId?: number | null;
  projectId: number;
  projectCode: string;
  projectName: string;
  bomVersion: string;
  sourceType: "AUTO" | "IMPORT";
  gateCode: Exclude<GateCode, "">;
  gateStatus: ResolvedGateStatus;
  gateTime?: string;
  creator: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  locked: boolean;
  version: number;
};

type QueryTableExpose = {
  search: () => void;
  reload: () => void;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const route = useRoute();
const router = useRouter();
const defaultProjectId = "";
const query = reactive<ProjectCostQuery>({
  projectId: defaultProjectId,
  projectName: "",
  gateCode: "",
  gateStatus: "",
  bomVersion: "",
  creator: "",
  createdRange: [],
});

const selectedRows = ref<ProjectCostRow[]>([]);
const projectOptions = ref<BusinessProjectItem[]>([]);
const projectLoading = ref(false);
const projectOptionsReady = ref(false);
let projectOptionsReadyPromise: Promise<void> | null = null;
const projectKeyword = ref("");
const detailVisible = ref(false);
const historyVisible = ref(false);
const partEditorVisible = ref(false);
const partHistoryVisible = ref(false);
const partHistoryLoading = ref(false);
const partHistoryRows = ref<CostBomPartItem[]>([]);
const partHistoryTotal = ref(0);
const partHistoryPageNo = ref(1);
const partHistoryPageSize = ref(10);
const importDialogVisible = ref(false);
const importLoading = ref(false);
const latestTaskId = ref<string>();
const latestTaskFileName = ref("");
const importValveId = ref("");
const valveOptions = ref<BusinessValveItem[]>([]);
const valveLoading = ref(false);
const activeRow = ref<ProjectCostRow | null>(null);
const detailParts = ref<CostBomPartItem[]>([]);
const detailSelectedParts = ref<CostBomPartItem[]>([]);
const historyVersions = ref<CostBomVersionItem[]>([]);
const selectedHistoryVersions = ref<CostBomVersionItem[]>([]);
const versionCompareVisible = ref(false);
const versionCompareRows = ref<Array<Record<string, string>>>([]);
const partEditMode = ref<PartEditMode>("add");
const activePart = ref<CostBomPartItem | null>(null);
const detailConditions = ref([
  {
    logic: "AND" as DetailLogic,
    moduleName: "",
    attributeName: "partNo",
    operator: "" as DetailOperator,
    value: "",
  },
]);

const partForm = reactive<CostBomPartSaveItem>({
  partNo: "",
  partName: "",
  moduleIdentifier: "",
  supplierName: "",
  quantity: "",
  unit: "",
  targetCostAmount: "",
  estimatedCostAmount: "",
  currentCostAmount: "",
  costCategoryLevel2Name: "",
  costCategoryLevel3Name: "",
  generalizationLevel: "",
  architectureComponent: "",
  summaryRemark: "",
});
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const deleteConfirmVisible = ref(false);
const deleteLoading = ref(false);
const deleteTarget = ref<DeleteTarget>("versions");

const deleteConfirmMessage = computed(() => {
  const count =
    deleteTarget.value === "versions"
      ? selectedRows.value.length
      : detailSelectedParts.value.length;
  const target = deleteTarget.value === "versions" ? "成本版本" : "零件";
  return `确定删除选中的 ${count} 个${target}吗？`;
});

const statusConfig = {
  PENDING: { label: "未过阀", type: "info" },
  ALLOW: { label: "允许过阀", type: "success" },
  CONDITIONAL: { label: "带条件过阀", type: "warning" },
  DENY: { label: "不允许过阀", type: "danger" },
} as const;

const passGateStatusMap: Record<PassGateMode, "1" | "2" | "3"> = {
  ALLOW: "3",
  CONDITIONAL: "2",
  DENY: "1",
};

const passGateSuccessText: Record<PassGateMode, string> = {
  ALLOW: "已允许过阀",
  CONDITIONAL: "已设为带条件过阀",
  DENY: "已设为不允许过阀",
};

const selectedCountText = computed(() =>
  selectedRows.value.length > 0 ? `已选择 ${selectedRows.value.length} 项` : "",
);
const activeDetailTitle = computed(() =>
  activeRow.value
    ? `${activeRow.value.projectName} ${activeRow.value.bomVersion}明细`
    : "成本BOM明细",
);
// 在产车型项目成本
const pageTitle = "在研车型项目成本"

async function queryProjectCosts(pageSize: number, pageNum: number) {
  await ensureProjectOptionsReady();
  const projectId = currentProjectId();
  const page = await fetchCostBomGenerateVersions(projectId, {
    ...projectCostListParams(pageNum, pageSize, selectedProject()),
  });
  const list = page.records.map((version) =>
    toProjectCostRow(version, selectedProject()),
  );

  return {
    total: page.total ?? 0,
    list,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function projectCostListParams(
  pageNo: number,
  pageSize: number,
  project?: BusinessProjectItem,
) {
  const [startTime, endTime] = query.createdRange;
  return {
    type: 2,
    pageNum: pageNo,
    pageSize,
    vehicleModelName: project?.projectName || query.projectName || undefined,
    valveId: resolveValveId(query.gateCode),
    status: query.gateStatus ? mapGateStatusToApi(query.gateStatus) : undefined,
    version: query.bomVersion.trim() || undefined,
    createBy: query.creator.trim() || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
  };
}

function mapGateStatusToApi(status: ResolvedGateStatus) {
  if (status === "ALLOW") {
    return "3";
  }
  if (status === "CONDITIONAL") {
    return "2";
  }
  if (status === "DENY") {
    return "1";
  }
  return "0";
}

function resolveValveId(gateCode: string) {
  if (!gateCode) {
    return undefined;
  }
  const numericValveId = Number(gateCode);
  if (Number.isFinite(numericValveId) && numericValveId > 0) {
    return numericValveId;
  }
  return valveOptions.value.find(
    (valve) => valve.valveCode === gateCode || valve.valveName === gateCode,
  )?.valveId;
}

function resolveGateCode(valveId?: number | null, valveName?: string | null) {
  const matchedValve = valveOptions.value.find(
    (valve) => Number(valve.valveId) === Number(valveId),
  );
  return valveName || matchedValve?.valveName || "";
}

function toProjectCostRow(
  version: CostBomGenerateVersionItem,
  project?: BusinessProjectItem,
): ProjectCostRow {
  const versionId = version.costBomVersionId ?? version.generateVersionId;
  const versionNo =
    version.bomVersion || version.version || version.versionName || versionId;
  return {
    id: versionId,
    versionId,
    valveId: version.valveId ?? null,
    projectId:
      project?.projectId ?? version.vehicleModelId ?? currentProjectId(),
    projectCode:
      project?.projectCode ||
      String(
        project?.projectId ?? version.vehicleModelId ?? currentProjectId(),
      ),
    projectName:
      project?.projectName ?? version.vehicleModelName ?? currentProjectName(),
    bomVersion: String(versionNo).startsWith("V")
      ? String(versionNo)
      : `V${versionNo}`,
    sourceType: "AUTO",
    gateCode: resolveGateCode(version.valveId, version.valveName),
    gateStatus: mapVersionStatus(version.valveStatus, version.latest),
    gateTime: version.valveTime || undefined,
    creator:
      readOptionalField(version, "submittedByName") ??
      readOptionalField(version, "createBy") ??
      "--",
    createdAt: version.createdAt || "",
    updatedBy:
      readOptionalField(version, "updatedByName") ??
      readOptionalField(version, "updatedBy") ??
      readOptionalField(version, "updateBy") ??
      "--",
    updatedAt:
      readOptionalField(version, "updatedAt") ?? version.createdAt ?? "",
    locked: version.lockStatus === "LOCKED",
    version: Number(version.version) || 0,
  };
}

async function loadProjectOptions(keyword = projectKeyword.value) {
  projectLoading.value = true;
  try {
    const result = await fetchBusinessProjects({
      pageNo: 1,
      pageSize: 200,
      keyword: keyword.trim() || undefined,
      status: "ENABLED",
    });
    projectOptions.value = result.records;
  } finally {
    projectLoading.value = false;
  }
}

async function loadValveOptions() {
  valveLoading.value = true;
  try {
    const page = await fetchBusinessValves({
      pageNo: 1,
      pageSize: 200,
      status: "ENABLED",
    });
    valveOptions.value = page.records;
  } finally {
    valveLoading.value = false;
  }
}

function valveOptionLabel(valve: BusinessValveItem) {
  return valve.valveName || "";
}

function ensureProjectOptionsReady() {
  if (projectOptionsReady.value) {
    return Promise.resolve();
  }
  if (!projectOptionsReadyPromise) {
    projectOptionsReadyPromise = Promise.all([
      loadProjectOptions(),
      loadValveOptions(),
    ])
      .then(() => {
        projectOptionsReady.value = true;
      })
      .catch((error) => {
        projectOptionsReadyPromise = null;
        throw error;
      });
  }
  return projectOptionsReadyPromise;
}

async function searchProjects(value: string) {
  projectKeyword.value = value;
  await loadProjectOptions(value);
}

function selectedProject() {
  return projectOptions.value.find(
    (project) => project.projectId === currentProjectId(),
  );
}

function matchesQuery(row: ProjectCostRow) {
  return (
    includesText(row.projectName, query.projectName) &&
    includesText(row.bomVersion, query.bomVersion) &&
    includesText(row.creator, query.creator) &&
    (!query.gateCode || String(row.valveId ?? "") === String(query.gateCode)) &&
    (!query.gateStatus || row.gateStatus === query.gateStatus) &&
    matchesCreatedRange(row.createdAt)
  );
}

function matchesCreatedRange(createdAt: string) {
  const [start, end] = query.createdRange;
  if (!start && !end) {
    return true;
  }
  if (!createdAt) {
    return false;
  }
  const date = createdAt.slice(0, 10);
  return (!start || date >= start) && (!end || date <= end);
}

function includesText(source: string, keyword: string) {
  const trimmedKeyword = keyword.trim();
  return (
    !trimmedKeyword ||
    source.toLowerCase().includes(trimmedKeyword.toLowerCase())
  );
}

function readOptionalField(source: unknown, key: string) {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  const value = (source as Record<string, unknown>)[key];
  return value == null ? undefined : String(value);
}

function resetQuery() {
  Object.assign(query, {
    projectId: defaultProjectId,
    projectName: "",
    gateCode: "",
    gateStatus: "",
    bomVersion: "",
    creator: "",
    createdRange: [],
  });
}

function searchProjectCosts() {
  queryTableRef.value?.search();
}

function refreshProjectCosts() {
  queryTableRef.value?.reload();
}

function handleSelectionChange(rows: ProjectCostRow[]) {
  selectedRows.value = rows;
}

function resetPageStateAndReload() {
  resetQuery();
  selectedRows.value = [];
  if (projectOptionsReady.value) {
    searchProjectCosts();
  }
}

function getGateStatusConfig(status: ResolvedGateStatus) {
  return statusConfig[status];
}

function isPassGateMode(command: unknown): command is PassGateMode {
  return command === "ALLOW" || command === "CONDITIONAL" || command === "DENY";
}

function isPassGateActionDisabled(row: ProjectCostRow) {
  return row.gateStatus !== "PENDING" && row.gateStatus !== "DENY";
}

function resolveRowVersionId(row: ProjectCostRow) {
  return row.versionId || row.id || undefined;
}

function handlePassGateCommand(row: ProjectCostRow, command: unknown) {
  if (isPassGateActionDisabled(row)) {
    return;
  }
  if (isPassGateMode(command)) {
    void handlePassGate(row, command);
  }
}

async function handleToggleLock(row: ProjectCostRow) {
  if (isPassGateActionDisabled(row)) {
    return;
  }
  const targetLocked = !row.locked;
  try {
    await openConfirm({
      title: targetLocked ? "锁定项目成本" : "解锁项目成本",
      message: buildLockConfirmMessage(
        `${row.projectName || "--"}（${row.gateCode || "--"}）`,
        targetLocked,
      ),
      type: "warning",
      confirmText: targetLocked ? "锁定" : "解锁",
      cancelText: "取消",
    });
  } catch {
    return;
  }
  const result = await updateCostBomVersionLockStatus(
    row.projectId,
    row.id,
    targetLocked,
  );
  BaseToast.success(`${result.lockStatus === "LOCKED" ? "锁定" : "解锁"}成功`);
  refreshProjectCosts();
}

function buildLockConfirmMessage(targetName: string, targetLocked: boolean) {
  return `确定要${targetLocked ? "锁定" : "解锁"} ${targetName}吗？${
    targetLocked ? "锁定后数据不可进行编辑、导入。" : ""
  }`;
}

async function handlePassGate(row: ProjectCostRow, mode: PassGateMode) {
  const versionId = resolveRowVersionId(row);
  if (!row.projectId || !versionId) {
    BaseToast.warning("当前项目成本缺少项目或版本信息。");
    return;
  }
  try {
    await openConfirm({
      title: "过阀确认",
      message: buildPassGateConfirmMessage(row, mode),
      type: "warning",
      confirmText: "确定",
      cancelText: "取消",
    });
  } catch {
    return;
  }
  await updateCostBomVersionGateStatus(
    row.projectId,
    versionId,
    passGateStatusMap[mode],
  );
  BaseToast.success(passGateSuccessText[mode]);
  refreshProjectCosts();
}

function buildPassGateConfirmMessage(
  row: ProjectCostRow,
  mode: PassGateMode,
) {
  const targetName = `${row.projectName || "--"}（${row.gateCode || "--"}）`;
  const targetStatus = passGateSuccessText[mode].replace(/^已设为|^已/, "");
  return `确定将${targetName}设置为 ${targetStatus} 吗?`;
}

async function exportProjectCosts() {
  const selected = selectedRows.value[0];
  if (!selected) {
    BaseToast.info("请选择一个成本版本");
    return;
  }
  const task = await createCostBomExport(undefined, {
    versionId: selected.id,
    versionIds: selectedRows.value.map((row) => row.id),
    version: resolveVersionParam(selected),
    format: "xlsx",
  });
  latestTaskId.value = task.taskId;
  latestTaskFileName.value = resolveCostBomExportFileName(selected);
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

async function downloadImportTemplate() {
  const link = document.createElement("a");
  link.href = "/template/成本BOM-导入模版.xlsx";
  link.download = "成本BOM-导入模版.xlsx";
  link.click();
}

function requestDeleteSelectedVersions() {
  if (selectedRows.value.length === 0) {
    BaseToast.warning("请选择需要删除的成本版本。");
    return;
  }
  deleteTarget.value = "versions";
  deleteConfirmVisible.value = true;
}

function requestDeleteSelectedParts() {
  if (!activeRow.value || detailSelectedParts.value.length === 0) {
    BaseToast.warning("请选择需要删除的零件。");
    return;
  }
  deleteTarget.value = "parts";
  deleteConfirmVisible.value = true;
}

async function confirmDeleteSelected() {
  if (deleteLoading.value) return;
  deleteLoading.value = true;
  try {
    if (deleteTarget.value === "versions") {
      const rows = selectedRows.value;
      if (rows.length === 0) return;
      await Promise.all(
        rows.map((row) =>
          deleteCostBomVersion(row.projectId, row.id, row.version),
        ),
      );
      BaseToast.success(`已删除 ${rows.length} 个成本版本`);
      selectedRows.value = [];
      deleteConfirmVisible.value = false;
      await refreshProjectCosts();
      return;
    }

    if (!activeRow.value || detailSelectedParts.value.length === 0) return;
    const parts = detailSelectedParts.value;
    await Promise.all(
      parts.map((part) =>
        deleteCostBomPart(
          activeProjectId(),
          activeRow.value!.id,
          part.partId,
          part.version,
        ),
      ),
    );
    BaseToast.success(`已删除 ${parts.length} 条零件`);
    deleteConfirmVisible.value = false;
    await loadDetailParts();
  } finally {
    deleteLoading.value = false;
  }
}

function openImportDialog() {
  importValveId.value = "";
  importDialogVisible.value = true;
}

async function handleImport(file: UploadFile) {
  const rawFile = file.raw;
  if (!rawFile) {
    BaseToast.warning("请选择需要导入的文件");
    return;
  }
  if (!importValveId.value) {
    BaseToast.warning("请选择阀点后再导入。");
    return;
  }
  importLoading.value = true;
  try {
    const task = await importProjectCostBomData({
      file: rawFile,
      valveId: importValveId.value,
    });
    importDialogVisible.value = false;
    latestTaskId.value = task.taskId;
    latestTaskFileName.value = "";
    BaseToast.success(`导入任务已创建：${task.taskNo || task.taskId}`);
  } catch (unknownError) {
    BaseToast.error(resolveImportErrorMessage(unknownError), 5000);
  } finally {
    importLoading.value = false;
  }
}

function resolveImportErrorMessage(unknownError: unknown) {
  if (unknownError instanceof ApiBusinessError) {
    return unknownError.message;
  }
  if (unknownError instanceof Error) {
    return unknownError.message || "项目成本导入失败，请检查文件或后端服务。";
  }
  return "项目成本导入失败，请检查文件或后端服务。";
}

function resolveVersionParam(
  row: Pick<ProjectCostRow, "version" | "bomVersion">,
) {
  return normalizeCostBomVersion(row.bomVersion) || String(row.version || "");
}

async function openDetail(row: ProjectCostRow) {
  await router.push({
    path: "/cost/research/new-project-cost/detail",
    query: {
      projectId: String(row.projectId),
      versionId: String(row.id),
      version: resolveVersionParam(row),
      vehicleModelId: String(row.projectId),
      projectName: row.projectName || undefined,
      projectCode: row.projectCode || undefined,
      vehicleModelName: row.projectName || undefined,
      valveId: row.valveId ? String(row.valveId) : undefined,
      valveName: row.gateCode || undefined,
      lockStatus: row.locked ? "LOCKED" : "UNLOCKED",
      returnPath: route.fullPath,
      activeMenu: "/cost/research/new-project-cost",
    },
  });
}

async function loadDetailParts() {
  if (!activeRow.value) {
    detailParts.value = [];
    return;
  }
  const conditions = buildDetailConditionParams();
  const page = await fetchCostBomParts(activeProjectId(), activeRow.value.id, {
    pageNo: 1,
    pageSize: 200,
    conditions: conditions.length ? JSON.stringify(conditions) : undefined,
  });
  detailParts.value = page.records;
  detailSelectedParts.value = [];
}

function addDetailCondition() {
  detailConditions.value.push({
    logic: "AND",
    moduleName: "",
    attributeName: "partNo",
    operator: "like",
    value: "",
  });
}

function buildDetailConditionParams() {
  return detailConditions.value
      .filter((item) => Boolean(item.attributeName && item.operator) && (nullOperators.has(item.operator) || item.value.trim()))
    .map((item) => ({
      logic: item.logic,
      moduleName: item.moduleName || undefined,
      attributeName: item.attributeName,
      operator: item.operator,
        attributeValue: nullOperators.has(item.operator) ? "" : item.value.trim(),
    }));
}

function removeDetailCondition(index: number) {
  if (detailConditions.value.length === 1) {
    Object.assign(detailConditions.value[0], {
      logic: "AND",
      moduleName: "",
      attributeName: "partNo",
    operator: "like",
      value: "",
    });
    return;
  }
  detailConditions.value.splice(index, 1);
}

function resetDetailConditions() {
  detailConditions.value = [
    {
      logic: "AND",
      moduleName: "",
      attributeName: "partNo",
    operator: "like",
      value: "",
    },
  ];
  void loadDetailParts();
}

function handleDetailSelectionChange(rows: CostBomPartItem[]) {
  detailSelectedParts.value = rows;
}

async function openHistory(row: ProjectCostRow) {
  await router.push({
    path: "/cost/research/new-project-cost/versions",
    query: {
      projectId: String(row.projectId),
      versionId: String(row.id),
      version: resolveVersionParam(row),
      projectCode: row.projectCode || undefined,
      projectName: row.projectName || undefined,
      valveName: row.gateCode || undefined,
      activeMenu: "/cost/research/new-project-cost",
    },
  });
}

function handleHistoryVersionSelection(rows: CostBomVersionItem[]) {
  selectedHistoryVersions.value = rows;
}

async function compareHistoryVersions() {
  if (!activeRow.value || selectedHistoryVersions.value.length !== 2) {
    BaseToast.warning("请选择两个版本进行对比。");
    return;
  }
  const [base, target] = selectedHistoryVersions.value;
  const [baseParts, targetParts] = await Promise.all([
    fetchCostBomParts(activeProjectId(), base.versionId, {
      pageNo: 1,
      pageSize: 200,
    }),
    fetchCostBomParts(activeProjectId(), target.versionId, {
      pageNo: 1,
      pageSize: 200,
    }),
  ]);
  const targetMap = new Map(
    targetParts.records.map((item) => [item.partNo, item]),
  );
  versionCompareRows.value = baseParts.records.map((item) => {
    const other = targetMap.get(item.partNo);
    return {
      partNo: item.partNo,
      partName: item.partName,
      baseCost: item.currentCostAmount || "--",
      targetCost: other?.currentCostAmount || "--",
      diff: String(
        Number(other?.currentCostAmount ?? 0) -
          Number(item.currentCostAmount ?? 0),
      ),
    };
  });
  versionCompareVisible.value = true;
}

async function viewHistoryVersion(row: CostBomVersionItem) {
  if (!activeRow.value) {
    return;
  }
  historyVisible.value = false;
  const version = normalizeCostBomVersion(row.bomVersion) || String(row.versionNo);
  await openDetail({
    ...activeRow.value,
    id: row.versionId,
    bomVersion: `V${version}`,
    version: row.version,
  });
}

async function exportDetailParts() {
  if (!activeRow.value) {
    return;
  }
  const task = await createCostBomExport(activeProjectId(), {
    versionId: activeRow.value.id,
    parts: detailSelectedParts.value,
    format: "xlsx",
  });
  latestTaskId.value = task.taskId;
  latestTaskFileName.value = resolveCostBomExportFileName(activeRow.value);
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

function handleTaskUpdate(detail: {
  task: { taskType: string; status: string };
}) {
  if (
    detail.task.taskType === "COST_IMPORT" &&
    detail.task.status === "SUCCEEDED"
  ) {
    refreshProjectCosts();
  }
}

async function calculateDetailParts() {
  if (!activeRow.value) {
    return;
  }
  const task = await createCostBomExtendCalculationTask(
    activeProjectId(),
    activeRow.value.id,
    resolveVersionParam(activeRow.value),
  );
  BaseToast.success(`计算任务已创建：${task.taskNo || task.taskId}`);
}

async function copyDetailValveData() {
  if (!activeRow.value) {
    return;
  }
  const result = await copyCostBomValveData(
    activeProjectId(),
    activeRow.value.id,
    {
      sourceVersionId: activeRow.value.id,
    },
  );
  BaseToast.success(`阀点复制完成：${result.copiedPartCount ?? 0} 条`);
  await loadDetailParts();
}

async function saveDetailAsNewVersion() {
  if (!activeRow.value) {
    return;
  }
  const result = await submitCostBomVersion(
    activeProjectId(),
    activeRow.value.id,
    {
      submitRemark: "项目成本明细保存新版本",
      version: resolveVersionParam(activeRow.value),
    },
  );
  BaseToast.success(`已保存新版本：V${result.versionNo}`);
  refreshProjectCosts();
}

function openPartEditor(mode: PartEditMode, row?: CostBomPartItem) {
  partEditMode.value = mode;
  activePart.value = row ?? null;
  const source: Partial<CostBomPartItem> = row ?? {};
  Object.assign(partForm, {
    partNo:
      mode === "copy" ? `${source.partNo || ""}-COPY` : source.partNo || "",
    partName: source.partName || "",
    moduleIdentifier: source.moduleIdentifier || "",
    supplierName: source.supplierName || "",
    quantity: source.quantity || "",
    unit: source.unit || "",
    targetCostAmount: source.targetCostAmount || "",
    estimatedCostAmount: source.estimatedCostAmount || "",
    currentCostAmount: source.currentCostAmount || "",
    costCategoryLevel2Name: source.costCategoryLevel2Name || "",
    costCategoryLevel3Name: source.costCategoryLevel3Name || "",
    generalizationLevel: source.generalizationLevel || "",
    architectureComponent: source.architectureComponent || "",
    summaryRemark: source.summaryRemark || "",
  });
  partEditorVisible.value = true;
}

async function savePartEditor() {
  if (!activeRow.value) {
    return;
  }
  if (!partForm.partNo?.trim() || !partForm.partName?.trim()) {
    BaseToast.warning("零件号和零件名称不能为空。");
    return;
  }
  const page = await fetchCostBomParts(activeProjectId(), activeRow.value.id, {
    pageNo: 1,
    pageSize: 1000,
  });
  const nextParts = page.records.map(toPartSaveItem);
  if (partEditMode.value === "edit" && activePart.value) {
    const index = nextParts.findIndex(
      (item) => item.partNo === activePart.value?.partNo,
    );
    if (index >= 0) {
      nextParts[index] = { ...nextParts[index], ...partForm };
    }
  } else {
    nextParts.push({ ...partForm });
  }
  const result = await saveCostBomParts(activeProjectId(), activeRow.value.id, {
    parts: nextParts,
  });
  BaseToast.success(`保存成功，当前零件数 ${result.partCount}`);
  partEditorVisible.value = false;
  await loadDetailParts();
}

function toPartSaveItem(part: CostBomPartItem): CostBomPartSaveItem {
  const payload: Partial<CostBomPartItem> = { ...part };
  delete payload.partId;
  delete payload.version;
  return payload as CostBomPartSaveItem;
}

async function openPartHistory(row: CostBomPartItem) {
  activePart.value = row;
  partHistoryVisible.value = true;
  partHistoryPageNo.value = 1;
  await loadPartHistories();
}

async function loadPartHistories() {
  if (!activeRow.value || !activePart.value) {
    partHistoryRows.value = [];
    partHistoryTotal.value = 0;
    return;
  }
  const parentId = activePart.value.parentId ?? activePart.value.partId;
  partHistoryLoading.value = true;
  try {
    const page = await fetchCostBomPartHistories(activeRow.value.id, parentId, {
      pageNum: partHistoryPageNo.value,
      pageSize: partHistoryPageSize.value,
      total: 0,
    });
    partHistoryRows.value = page.records;
    partHistoryTotal.value = resolveServerTotal(page.total);
  } finally {
    partHistoryLoading.value = false;
  }
}

function handlePartHistoryPageSizeChange(nextPageSize: number) {
  partHistoryPageSize.value = nextPageSize;
  partHistoryPageNo.value = 1;
  void loadPartHistories();
}

function handlePartHistoryPageNoChange(nextPageNo: number) {
  partHistoryPageNo.value = nextPageNo;
  void loadPartHistories();
}

function mapVersionStatus(status: string, latest: boolean): ResolvedGateStatus {
  void latest;
  const normalizedStatus = String(status ?? "")
    .trim()
    .toUpperCase();
  if (
    normalizedStatus === "3" ||
    normalizedStatus === "PASSED" ||
    normalizedStatus === "ALLOW" ||
    normalizedStatus === "ALLOWED" ||
    normalizedStatus === "SUBMITTED" ||
    normalizedStatus === "USED"
  ) {
    return "ALLOW";
  }
  if (
    normalizedStatus === "2" ||
    normalizedStatus === "CONDITIONAL" ||
    normalizedStatus === "CONDITIONALLY_PASSED"
  ) {
    return "CONDITIONAL";
  }
  if (
    normalizedStatus === "1" ||
    normalizedStatus === "DENY" ||
    normalizedStatus === "DENIED" ||
    normalizedStatus === "REJECTED"
  ) {
    return "DENY";
  }
  return "PENDING";
}

function currentProjectId() {
  return Number(query.projectId || 0);
}

function activeProjectId() {
  return activeRow.value?.projectId || currentProjectId();
}

function currentProjectName() {
  return (
    selectedProject()?.projectName ||
    (currentProjectId() ? `项目 ${currentProjectId()}` : "--")
  );
}

function resolveCostBomExportFileName(row: ProjectCostRow) {
  return buildCostBomExportFileName({
    projectName: row.projectName,
    valveName: row.gateCode,
    version: row.bomVersion,
  });
}

onMounted(() => {
  void ensureProjectOptionsReady();
});

watch(
  () => route.path,
  () => {
    resetPageStateAndReload();
  },
);
</script>

<template>
  <PageContainer :title="pageTitle">
    <QueryTable
      ref="queryTableRef"
      class="project-cost-page"
      :func="queryProjectCosts"
      row-key="id"
      show-toolbar
      fit-table-height
      :table-props="{ onSelectionChange: handleSelectionChange }"
      empty-title="暂无项目成本数据"
      empty-description="当前筛选条件下没有可展示的项目成本数据。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="项目代号">
            <el-select
              v-model="query.projectId"
              clearable
              filterable
              remote
              reserve-keyword
              :remote-method="searchProjects"
              :loading="projectLoading"
              placeholder="请输入项目代号"
              @change="searchProjectCosts"
            >
              <el-option
                v-for="project in projectOptions"
                :key="project.projectId"
                :label="
                  project.projectCode
                    ? `${project.projectName}（${project.projectCode}）`
                    : project.projectName
                "
                :value="String(project.projectId)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="阀点">
            <el-select
              v-model="query.gateCode"
              clearable
              filterable
              :loading="valveLoading"
              placeholder="请选择阀点"
            >
              <el-option
                v-for="valve in valveOptions"
                :key="String(valve.valveId)"
                :label="valveOptionLabel(valve)"
                :value="String(valve.valveId)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="过阀状态">
            <el-select
              v-model="query.gateStatus"
              clearable
              placeholder="请选择过阀状态"
            >
              <el-option label="未过阀" value="PENDING" />
              <el-option label="允许过阀" value="ALLOW" />
              <el-option label="带条件过阀" value="CONDITIONAL" />
              <el-option label="不允许过阀" value="DENY" />
            </el-select>
          </el-form-item>
          <!--          <el-form-item label="BOM版本">-->
          <!--            <el-input-->
          <!--              v-model="query.bomVersion"-->
          <!--              clearable-->
          <!--              placeholder="请输入BOM版本"-->
          <!--            />-->
          <!--          </el-form-item>-->
          <!--          <el-form-item label="创建人">-->
          <!--            <el-input-->
          <!--              v-model="query.creator"-->
          <!--              clearable-->
          <!--              placeholder="请输入创建人"-->
          <!--            />-->
          <!--          </el-form-item>-->
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          permission="costmanage:costbom:import"
          variant="secondary"
          :icon="Upload"
          @click="openImportDialog"
        >
          导入
        </PermissionButton>
        <!--        <PermissionButton-->
        <!--          permission="cost:research:project-cost:calculate"-->
        <!--          type="success"-->
        <!--          :icon="Refresh"-->
        <!--          @click="calculateSelectedExtend"-->
        <!--        >-->
        <!--          扩展计算-->
        <!--        </PermissionButton>-->
        <PermissionButton
          permission="costmanage:costbom:export"
          variant="secondary"
          :icon="Download"
          @click="exportProjectCosts"
        >
          导出
        </PermissionButton>
        <!--        <PermissionButton-->
        <!--          permission="cost:research:project-cost:refresh-price"-->
        <!--          type="primary"-->
        <!--          plain-->
        <!--          :disabled="selectedRows.length === 0"-->
        <!--          @click="refreshSelectedPrice"-->
        <!--        >-->
        <!--          刷新价格-->
        <!--        </PermissionButton>-->
        <PermissionButton
          permission="costmanage:costbom:remove"
          variant="danger"
          :icon="Delete"
          @click="requestDeleteSelectedVersions"
        >
          批量删除
        </PermissionButton>
        <span v-if="selectedCountText" class="project-cost-page__selection">
          {{ selectedCountText }}
        </span>
      </template>

      <el-table-column type="selection" width="48" fixed="left" />
      <el-table-column type="index" label="序号" width="72" fixed="left" />
      <el-table-column prop="projectName" label="项目代号" min-width="150" />
      <el-table-column prop="bomVersion" label="BOM版本" min-width="130" />
      <el-table-column label="类型" min-width="120">
        <template #default="{ row }">
          <BaseStatusTag
            :label="row.sourceType === 'AUTO' ? '自动生成' : '导入生成'"
            type="success"
          />
        </template>
      </el-table-column>
      <el-table-column prop="gateCode" label="阀点" min-width="100" />
      <el-table-column label="过阀状态" min-width="120">
        <template #default="{ row }">
          <BaseStatusTag
            :label="getGateStatusConfig(row.gateStatus).label"
            :type="getGateStatusConfig(row.gateStatus).type"
          />
        </template>
      </el-table-column>
      <el-table-column label="锁定状态" min-width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="row.locked ? 'success' : 'info'" size="small">
            {{ row.locked ? "已锁定" : "未锁定" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="gateTime" label="过阀时间" width="160">
        <template #default="{ row }">
          {{ row.gateTime ?? "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="creator" label="创建人" min-width="120" />
      <el-table-column prop="createdAt" label="创建时间" width="160">
        <template #default="{ row }">
          {{ row.createdAt || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="updatedBy" label="更新人" min-width="120">
        <template #default="{ row }">
          {{ row.updatedBy || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="160">
        <template #default="{ row }">
          {{ row.updatedAt || "--" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right" align="center">
        <template #default="{ row }">
          <div class="bq-table-actions">
            <PermissionButton link permission="costmanage:costbom:show" @click="openDetail(row)">
              查看
            </PermissionButton>
            <el-dropdown trigger="click" :disabled="isPassGateActionDisabled(row)" @command="handlePassGateCommand(row, $event)">
              <span class="project-cost-dropdown-trigger">
                <PermissionButton link permission="costmanage:costbom:pass" :disabled="isPassGateActionDisabled(row)">
                  过阀
                  <el-icon class="project-cost-dropdown-trigger__icon"><ArrowDown /></el-icon>
                </PermissionButton>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="ALLOW">允许过阀</el-dropdown-item>
                  <el-dropdown-item command="CONDITIONAL">带条件过阀</el-dropdown-item>
                  <el-dropdown-item command="DENY">不允许过阀</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-dropdown trigger="click">
              <el-button link type="primary" class="project-cost-more-trigger">
                更多
                <el-icon class="project-cost-dropdown-trigger__icon"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <PermissionGuard permission="costmanage:costbom:locking">
                    <el-dropdown-item
                      :disabled="isPassGateActionDisabled(row)"
                      :style="{
                        color: row.locked ? 'var(--bq-color-warning)' : undefined,
                      }"
                      @click="handleToggleLock(row)"
                    >
                      <el-icon>
                        <Unlock v-if="row.locked" />
                        <Lock v-else />
                      </el-icon>
                      {{ row.locked ? "解锁" : "锁定" }}
                    </el-dropdown-item>
                  </PermissionGuard>
                  <PermissionGuard permission="costmanage:costbom:historical">
                    <el-dropdown-item @click="openHistory(row)">历史版本</el-dropdown-item>
                  </PermissionGuard>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="detailVisible"
      :title="activeDetailTitle"
      width="1280px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
      :confirm-button-props="{
        permission:
          'cost:research:new-project-cost:list-page:detail-dialog-close',
      }"
    >
      <div class="project-cost-detail">
        <div class="project-cost-detail__conditions">
          <div
            v-for="(condition, index) in detailConditions"
            :key="index"
            class="project-cost-detail__condition"
            :class="{ 'project-cost-detail__condition--first': index === 0 }"
          >
            <el-select
              v-if="index > 0"
              v-model="condition.logic"
              class="project-cost-detail__logic"
            >
              <el-option label="并且" value="AND" />
              <el-option label="或者" value="OR" />
            </el-select>
            <el-input
              v-model="condition.moduleName"
              class="project-cost-detail__module"
              clearable
              placeholder="模块名称"
            />
            <el-select
              v-model="condition.attributeName"
              class="project-cost-detail__attr"
              filterable
              placeholder="属性名称"
            >
              <el-option label="零件号" value="partNo" />
              <el-option label="零件名称" value="partName" />
              <el-option label="供应商名称" value="supplierName" />
              <el-option label="目标成本" value="targetCostAmount" />
              <el-option label="评估成本" value="estimatedCostAmount" />
              <el-option label="当前成本" value="currentCostAmount" />
              <el-option label="成本二级分类" value="costCategoryLevel2Name" />
              <el-option label="成本三级分类" value="costCategoryLevel3Name" />
            </el-select>
            <el-select
              v-model="condition.operator"
              class="project-cost-detail__operator"
            >
              <el-option label="包含" value="like" />
              <el-option label="等于" value="eq" />
              <el-option label="不等于" value="ne" />
              <el-option label="大于" value="gt" />
              <el-option label="小于" value="lt" />
            </el-select>
            <el-input
              v-model="condition.value"
              class="project-cost-detail__value"
              clearable
              placeholder="属性值"
              @keyup.enter="loadDetailParts"
            />
            <el-tooltip v-if="index === 0" content="添加条件" placement="top">
              <PermissionButton
                class="project-cost-detail__condition-icon is-add"
                circle
                plain
                type="primary"
                permission="cost:research:new-project-cost:list-page:detail-filter-add"
                :icon="Plus"
                @click="addDetailCondition"
              />
            </el-tooltip>
            <template v-if="index === 0">
              <PermissionButton type="primary" @click="loadDetailParts"
                >查询</PermissionButton
              >
              <PermissionButton :icon="Refresh" @click="resetDetailConditions"
                >重置</PermissionButton
              >
            </template>
            <el-tooltip v-else content="删除条件" placement="top">
              <PermissionButton
                class="project-cost-detail__condition-icon is-delete"
                circle
                plain
                type="danger"
                permission="cost:research:new-project-cost:list-page:detail-filter-remove"
                :icon="Minus"
                @click="removeDetailCondition(index)"
              />
            </el-tooltip>
          </div>
        </div>
        <div class="project-cost-detail__toolbar">
          <PermissionButton
            permission="cost:research:new-project-cost:list-page:detail-add"
            type="primary"
            plain
            :icon="CirclePlus"
            @click="openPartEditor('add')"
          >
            新增
          </PermissionButton>
          <PermissionButton
            permission="cost:research:new-project-cost:list-page:detail-export"
            variant="secondary"
            plain
            :disabled="!activeRow"
            @click="exportDetailParts"
            type="warning"
            :icon="Download"
          >
            导出
          </PermissionButton>
          <PermissionButton
            permission="cost:research:new-project-cost:list-page:detail-calculate"
            variant="secondary"
            type="primary"
            plain
            :disabled="!activeRow"
              :icon="Operation"
              @click="calculateDetailParts"
          >
            计算
          </PermissionButton>
          <PermissionButton
            permission="cost:research:new-project-cost:list-page:detail-copy-gate"
            variant="secondary"
            type="primary"
            plain
            :disabled="!activeRow"
              :icon="CopyDocument"
              @click="copyDetailValveData"
          >
            复制阀点
          </PermissionButton>
          <PermissionButton
            permission="cost:research:new-project-cost:list-page:detail-version-add"
            variant="secondary"
            type="success"
            plain
            :disabled="!activeRow"
              :icon="CircleCheck"
              @click="saveDetailAsNewVersion"
          >
            生成新版本
          </PermissionButton>
          <PermissionButton
            permission="cost:research:new-project-cost:list-page:detail-batch-delete"
            variant="danger"
            type="danger"
            plain
            @click="requestDeleteSelectedParts"
          >
            批量删除
          </PermissionButton>
        </div>
      </div>
      <el-table
        :data="detailParts"
        border
        height="420"
        @selection-change="handleDetailSelectionChange"
      >
        <el-table-column type="selection" width="48" fixed="left" />
        <el-table-column prop="partNo" label="零件号" min-width="150" />
        <el-table-column prop="partName" label="零件名称" min-width="180" />
        <el-table-column
          prop="moduleIdentifier"
          label="模块名称"
          min-width="140"
        />
        <el-table-column
          prop="quantity"
          label="数量"
          width="100"
          align="right"
        />
        <el-table-column prop="unit" label="单位" width="90" />
        <el-table-column
          prop="supplierName"
          label="供应商名称"
          min-width="160"
        />
        <el-table-column
          prop="costCategoryLevel2Name"
          label="成本二级分类"
          min-width="150"
        />
        <el-table-column
          prop="costCategoryLevel3Name"
          label="成本三级分类"
          min-width="150"
        />
        <el-table-column
          prop="targetCostAmount"
          label="目标成本"
          min-width="120"
          align="right"
        />
        <el-table-column
          prop="estimatedCostAmount"
          label="评估成本"
          min-width="120"
          align="right"
        />
        <el-table-column
          prop="currentCostAmount"
          label="当前成本"
          min-width="120"
          align="right"
        />
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <PermissionButton
              link
              type="primary"
              permission="cost:research:new-project-cost:list-page:detail-edit"
              @click="openPartEditor('edit', row)"
            >
              编辑
            </PermissionButton>
            <PermissionButton
              link
              type="primary"
              permission="cost:research:new-project-cost:list-page:detail-part-history"
              @click="openPartHistory(row)"
            >
              历史版本
            </PermissionButton>
            <PermissionButton
              link
              type="primary"
              permission="cost:research:new-project-cost:list-page:detail-copy"
              @click="openPartEditor('copy', row)"
            >
              复制
            </PermissionButton>
          </template>
        </el-table-column>
      </el-table>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="historyVisible"
      title="历史版本"
      width="860px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
      :confirm-button-props="{
        permission:
          'cost:research:new-project-cost:list-page:history-dialog-close',
      }"
    >
      <div class="project-cost-history__toolbar">
        <PermissionButton
          permission="cost:research:new-project-cost:list-page:history-compare"
          variant="primary"
          type="primary"
          :disabled="selectedHistoryVersions.length !== 2"
          @click="compareHistoryVersions"
        >
          对比
        </PermissionButton>
      </div>
      <el-table
        :data="historyVersions"
        border
        height="360"
        @selection-change="handleHistoryVersionSelection"
      >
        <el-table-column type="selection" width="48" fixed="left" />
        <el-table-column prop="versionId" label="版本ID" width="110" />
        <el-table-column label="BOM版本" width="110">
          <template #default="{ row }">V{{ row.versionNo }}</template>
        </el-table-column>
        <el-table-column prop="status" label="版本状态" min-width="130" />
        <el-table-column label="当前版本" width="110">
          <template #default="{ row }">
            <BaseStatusTag
              :label="row.latest ? '是' : '否'"
              :type="row.latest ? 'success' : 'info'"
            />
          </template>
        </el-table-column>
        <el-table-column
          prop="partCount"
          label="零件数"
          width="110"
          align="right"
        />
        <el-table-column
          prop="totalCurrentCostAmount"
          label="当前成本合计"
          min-width="150"
          align="right"
        />
        <el-table-column prop="submittedAt" label="提交时间" min-width="170" />
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <PermissionButton
              link
              type="primary"
              permission="cost:research:new-project-cost:list-page:history-view-version"
              @click="viewHistoryVersion(row)"
            >
              查看版本
            </PermissionButton>
          </template>
        </el-table-column>
      </el-table>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="versionCompareVisible"
      title="版本对比"
      width="860px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
      :confirm-button-props="{
        permission:
          'cost:research:new-project-cost:list-page:compare-dialog-close',
      }"
    >
      <el-table :data="versionCompareRows" border height="360">
        <el-table-column prop="partNo" label="零件号" min-width="150" />
        <el-table-column prop="partName" label="零件名称" min-width="180" />
        <el-table-column
          prop="baseCost"
          label="基准版本当前成本"
          min-width="150"
          align="right"
        />
        <el-table-column
          prop="targetCost"
          label="目标版本当前成本"
          min-width="150"
          align="right"
        />
        <el-table-column
          prop="diff"
          label="差异"
          min-width="120"
          align="right"
        />
      </el-table>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="partEditorVisible"
      :title="
        partEditMode === 'add'
          ? '新增零件'
          : partEditMode === 'edit'
            ? '编辑零件'
            : '复制零件'
      "
      width="760px"
      confirm-text="保存"
      cancel-text="取消"
      @confirm="savePartEditor"
    >
      <el-form :model="partForm" label-width="116px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="零件号" required>
              <el-input v-model="partForm.partNo" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="零件名称" required>
              <el-input v-model="partForm.partName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模块名称">
              <el-input v-model="partForm.moduleIdentifier" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商名称">
              <el-input v-model="partForm.supplierName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数量">
              <el-input v-model="partForm.quantity" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位">
              <el-input v-model="partForm.unit" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标成本">
              <el-input v-model="partForm.targetCostAmount" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="评估成本">
              <el-input v-model="partForm.estimatedCostAmount" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="当前成本">
              <el-input v-model="partForm.currentCostAmount" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="通用化级别">
              <el-input v-model="partForm.generalizationLevel" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否架构件">
              <el-select v-model="partForm.architectureComponent" clearable>
                <el-option label="是" value="是" />
                <el-option label="否" value="否" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="成本二级分类">
              <el-input v-model="partForm.costCategoryLevel2Name" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="成本三级分类">
              <el-input v-model="partForm.costCategoryLevel3Name" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="partForm.summaryRemark"
                type="textarea"
                :rows="3"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="partHistoryVisible"
      title="零件历史版本"
      width="980px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
      :confirm-button-props="{
        permission:
          'cost:research:new-project-cost:list-page:part-history-dialog-close',
      }"
    >
      <el-table
        v-loading="partHistoryLoading"
        :data="partHistoryRows"
        border
        height="260"
      >
        <el-table-column label="基础信息" align="center">
          <el-table-column prop="partNo" label="零件号" min-width="150" />
          <el-table-column prop="partName" label="零件名称" min-width="180" />
          <el-table-column
            prop="moduleIdentifier"
            label="模块名称"
            min-width="140"
          />
        </el-table-column>
        <el-table-column label="成本信息" align="center">
          <el-table-column
            prop="targetCostAmount"
            label="目标成本"
            min-width="120"
            align="right"
          />
          <el-table-column
            prop="estimatedCostAmount"
            label="评估成本"
            min-width="120"
            align="right"
          />
          <el-table-column
            prop="currentCostAmount"
            label="当前成本"
            min-width="120"
            align="right"
          />
        </el-table-column>
        <el-table-column label="分类信息" align="center">
          <el-table-column
            prop="costCategoryLevel2Name"
            label="成本二级分类"
            min-width="150"
          />
          <el-table-column
            prop="costCategoryLevel3Name"
            label="成本三级分类"
            min-width="150"
          />
        </el-table-column>
      </el-table>
      <div class="project-cost-part-history__pagination">
        <QueryTable
          pagination-only
          :fixed-pagination="false"
          :pagination="{
            pageNo: partHistoryPageNo,
            pageSize: partHistoryPageSize,
            total: partHistoryTotal,
          }"
          :pagination-props="{
            pageSizes: [10, 20, 50, 100],
            layout: 'total, sizes, prev, pager, next, jumper',
          }"
          @size-change="handlePartHistoryPageSizeChange"
          @page-change="handlePartHistoryPageNoChange"
        />
      </div>
    </BaseFormDialog>

    <TaskStatusPanel
      v-if="false"
      :task-id="latestTaskId"
      :download-file-name="latestTaskFileName"
      @update="handleTaskUpdate"
    />

    <BaseImportDialog
      v-model="importDialogVisible"
      module-name="项目成本"
      :loading="importLoading"
      :max-size-mb="20"
      template-text="下载导入模板"
      template-description="请按照要求导入项目成本标准 Excel 文件"
      upload-tip="只能上传 xlsx 格式文件，且不超过 20MB"
      @import="handleImport"
      @download-template="downloadImportTemplate"
    >
      <el-form label-position="top">
        <el-form-item label="阀点" required>
          <el-select
            v-model="importValveId"
            filterable
            :loading="valveLoading"
            placeholder="请选择阀点"
            style="width: 100%"
          >
            <el-option
              v-for="valve in valveOptions"
              :key="String(valve.valveId)"
              :label="valveOptionLabel(valve)"
              :value="String(valve.valveId)"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </BaseImportDialog>

    <BaseConfirm
      v-model="deleteConfirmVisible"
      title="确认删除"
      type="danger"
      confirm-text="确认删除"
      :loading="deleteLoading"
      :message="deleteConfirmMessage"
      :confirm-button-props="{
        permission: 'costmanage:costbom:remove',
      }"
      @confirm="confirmDeleteSelected"
    />

    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
     
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
    <!--  :confirm-button-props="{
        permission: 'costmanage:costbom:confirm',
      }" -->
  </PageContainer>
</template>

<style scoped>
.project-cost-page :deep(.base-toolbar) {
  border-top: 0;
}

.project-cost-page :deep(.el-table__cell) {
  white-space: nowrap;
}

.project-cost-page__selection {
  color: var(--bq-color-text-muted);
  font-size: 14px;
  line-height: 24px;
}

.project-cost-page__dropdown-icon {
  margin-left: 2px;
  font-size: 12px;
}

.project-cost-dropdown-trigger__icon {
  margin-left: 3px;
  font-size: 12px;
}

.project-cost-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.project-cost-detail__conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-cost-detail__condition {
  display: grid;
  grid-template-columns:
    84px minmax(120px, 1fr) 160px 112px minmax(160px, 1.2fr)
    48px;
  gap: 8px;
  align-items: center;
}

.project-cost-detail__condition--first {
  grid-template-columns:
    minmax(120px, 1fr) 160px 112px minmax(160px, 1.2fr)
    32px auto auto;
}

.project-cost-detail__condition-actions,
.project-cost-detail__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.project-cost-detail__condition-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
}

.project-cost-part-history__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.project-cost-detail__logic,
.project-cost-detail__module,
.project-cost-detail__attr,
.project-cost-detail__operator,
.project-cost-detail__value {
  width: 100%;
}

.project-cost-history__toolbar {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
}
</style>
