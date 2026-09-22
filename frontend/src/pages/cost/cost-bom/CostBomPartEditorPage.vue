<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back } from "@element-plus/icons-vue";
import {
  createCostBomPart,
  fetchCostBomPartDetail,
  fetchCostBomPartPatterns,
  toCostBomPartWritePayload,
  updateCostBomPart,
} from "@/api/cost-center";
import { BaseToast } from "@/components/base/BaseToast";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import { replaceToReturn } from "@/utils/return-navigation";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useAuthStore } from "@/stores/auth";
import type {
  CostBomPartEditScope,
  CostBomPartItem,
  CostBomPartPatternItem,
  CostBomPartSaveItem,
} from "@/types/cost-center";

type EditorMode = "add" | "edit" | "copy";
type FieldKey = keyof CostBomPartSaveItem;
type FieldConfig = {
  key: FieldKey;
  label: string;
  span?: number;
  type?: "input" | "textarea" | "select";
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
};
type SectionConfig = {
  name: string;
  label: string;
  fields: FieldConfig[];
};

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const projectId = computed(() => Number(route.query.projectId));
const versionId = computed(() =>
  Number(route.query.bomVersionId || route.query.versionId),
);
const partId = computed(() => String(route.query.partId || ""));
const versionNo = computed(() => String(route.query.version ?? ""));
const vehicleModelId = computed(() => Number(route.query.vehicleModelId || 0));
const valveId = computed(() => Number(route.query.valveId || 0));
const vehicleModelName = computed(() =>
  route.query.vehicleModelName ? String(route.query.vehicleModelName) : "",
);
const valveName = computed(() =>
  route.query.valveName ? String(route.query.valveName) : "",
);
const projectName = computed(() =>
  route.query.projectName ? String(route.query.projectName) : "",
);
const mode = computed<EditorMode>(() => {
  if (route.path.endsWith("/edit")) {
    return "edit";
  }
  if (route.path.endsWith("/copy")) {
    return "copy";
  }
  return "add";
});
// const pagePermissionPrefix = computed(() => {
//   const projectCostPrefix = route.path.startsWith(
//     "/cost/research/project-cost/parts/",
//   )
//     ? "cost:research:project-cost"
//     : "";
//   const newProjectCostPrefix = route.path.startsWith(
//     "/cost/research/new-project-cost/parts/",
//   )
//     ? "cost:research:new-project-cost"
//     : "";
//   const historyPrefix = route.path.startsWith("/cost/research/history/parts/")
//     ? "cost:research:history"
//     : "";
//   const newHistoryPrefix = route.path.startsWith(
//     "/cost/research/new-history/parts/",
//   )
//     ? "cost:research:new-history"
//     : "";
//   const basePrefix =
//     projectCostPrefix ||
//     newProjectCostPrefix ||
//     historyPrefix ||
//     newHistoryPrefix;
//   if (!basePrefix) {
//     return "";
//   }
//   if (mode.value === "edit") {
//     return `${basePrefix}:part-edit-page`;
//   }
//   if (mode.value === "copy") {
//     return `${basePrefix}:part-copy-page`;
//   }
//   return `${basePrefix}:part-add-page`;
// });
// const permissionPrefix = computed(() => {
//   if (route.meta.permissionPrefix) {
//     return String(route.meta.permissionPrefix);
//   }
//   const activeMenu =
//     typeof route.query.activeMenu === "string" ? route.query.activeMenu : "";
//   if (activeMenu === "/cost/research/history") {
//     return "cost:research:history";
//   }
//   if (activeMenu === "/cost/research/new-history") {
//     return "cost:research:new-history";
//   }
//   return "cost:research:project-cost";
// });
const routeBase = computed(
  () =>
    route.path.replace(/\/parts\/(?:add|edit|copy)$/, "") ||
    String(route.meta.breadcrumbParentPath ?? "/cost/research/project-cost"),
);

/**
 * 编辑器通常由详情页打开，而详情页的 returnPath 又指向列表页。
 * 保存后重新打开详情时应沿这条链回到列表，不能把当前编辑页地址继续
 * 写入详情页，否则详情页点击“返回”会再次落到编辑页。
 */
const listReturnPath = computed(() => {
  const initialPath = route.query.returnPath;
  if (typeof initialPath !== "string" || !initialPath.startsWith("/")) {
    return routeBase.value;
  }

  let candidate = initialPath;
  for (let depth = 0; depth < 4; depth += 1) {
    let resolved;
    try {
      resolved = router.resolve(candidate);
    } catch {
      break;
    }

    const nestedReturnPath = resolved.query.returnPath;
    const isIntermediatePage =
      resolved.path.endsWith("/detail") ||
      /\/parts\/(?:add|edit|copy)$/.test(resolved.path);
    if (!isIntermediatePage) {
      return candidate;
    }
    if (
      typeof nestedReturnPath !== "string" ||
      !nestedReturnPath.startsWith("/")
    ) {
      break;
    }
    candidate = nestedReturnPath;
  }

  return routeBase.value;
});

const detailPath = computed(() => ({
  path: `${routeBase.value}/detail`,
  query: {
    projectId: String(projectId.value || ""),
    bomVersionId: String(versionId.value || ""),
    versionId: String(versionId.value || ""),
    version: versionNo.value || undefined,
    vehicleModelId: vehicleModelId.value
      ? String(vehicleModelId.value)
      : undefined,
    valveId: valveId.value ? String(valveId.value) : undefined,
    activeMenu: route.query.activeMenu
      ? String(route.query.activeMenu)
      : undefined,
    returnPath: listReturnPath.value,
    projectName: route.query.projectName
      ? String(route.query.projectName)
      : undefined,
    vehicleModelName: route.query.vehicleModelName
      ? String(route.query.vehicleModelName)
      : undefined,
    valveName: route.query.valveName
      ? String(route.query.valveName)
      : undefined,
  },
}));
const pageTitle = computed(() => {
  if (mode.value === "edit") {
    return "编辑零件";
  }
  if (mode.value === "copy") {
    return "复制零件";
  }
  return "新增零件";
});
// function getSavePermission() {
//   if (
//     route.path.startsWith("/cost/research/new-project-cost/parts/edit")
//   ) {
//     return "cost:edit:edit";
//   }
//   if (pagePermissionPrefix.value) {
//     return `${pagePermissionPrefix.value}:save`;
//   }
//   if (mode.value === "edit") {
//     return `${permissionPrefix.value}:edit`;
//   }
//   if (mode.value === "copy") {
//     return `${permissionPrefix.value}:copy`;
//   }
//   if (
//     permissionPrefix.value === "cost:research:history" ||
//     permissionPrefix.value === "cost:research:new-history"
//   ) {
//     return `${permissionPrefix.value}:add`;
//   }
//   return `${permissionPrefix.value}:create`;
// }

const sections: SectionConfig[] = [
  {
    name: "basic",
    label: "基础信息",
    fields: [
      { key: "partNo", label: "零件号", required: true },
      { key: "partName", label: "零件名称", required: true },
      { key: "sorCode", label: "SOR号" },
      { key: "sorName", label: "SOR名称" },
      { key: "ecrNumber", label: "ECR号" },
      { key: "ecrName", label: "ECR名称" },
      { key: "iaNumber", label: "IA号" },
      { key: "iaName", label: "IA名称" },
      { key: "assemblyLevel", label: "装配级别" },
      { key: "partTechDesc", label: "零部件关键技术状态描述" },
      { key: "unit", label: "单位" },
      { key: "moduleIdentifier", label: "模块标识" },
      { key: "firstVehicleModel", label: "首用车型" },
      { key: "quotaSrm", label: "配额(SRM)" },
      { key: "supplierName", label: "供应商名称" },
    ],
  },
  {
    name: "classify",
    label: "分类",
    fields: [
      { key: "generalizationLevel", label: "通用化级别" },
      {
        key: "architectureComponent",
        label: "是否架构件",
        type: "select",
        options: [
          { label: "是", value: "是" },
          { label: "否", value: "否" },
        ],
      },
    ],
  },
  {
    name: "bomExtra",
    label: "BOM补充信息",
    fields: [
      { key: "suggestedSupplySource", label: "建议货源" },
      { key: "sourceDescription", label: "货源描述" },
      { key: "multiStructuredSupplySources", label: "多结构货源" },
      { key: "multiSourcesDescription", label: "多结构货源描述", span: 10 },
    ],
  },
  {
    name: "division",
    label: "分工",
    fields: [
      { key: "developmentDepartment", label: "研发专业部门" },
      { key: "expertEngineer", label: "专业工程师" },
      { key: "firstClassification", label: "成本专业科室" },
      { key: "costCategoryLevel2Name", label: "成本二级分类" },
      { key: "costCategoryLevel3Name", label: "成本三级分类" },
      { key: "partAttribute", label: "零件属性" },
    ],
  },
  {
    name: "quantity",
    label: "单车用量",
    fields: [],
  },
  {
    name: "target",
    label: "目标值",
    fields: [
      { key: "targetValue", label: "目标值" },
      { key: "targetRemark", label: "备注" },
    ],
  },
  {
    name: "evaluation",
    label: "评估值",
    fields: [{ key: "initialEvaluationValue", label: "评估值" }],
  },
];

const loading = ref(false);
const saving = ref(false);
const activePart = ref<CostBomPartItem | null>(null);
const usagePatternItems = ref<CostBomPartPatternItem[]>([]);
const activeTab = ref(sections[0].name);
const scrollWrapRef = ref<HTMLElement | null>(null);
const programmaticScroll = ref<{ name: string; top: number } | null>(null);
const quantitySectionName = "quantity";
const sectionScrollOffset = 8;
const partForm = reactive<CostBomPartSaveItem>({
  partNo: "",
  partName: "",
  factoryCode: "",
  sorCode: "",
  sorName: "",
  ecrNumber: "",
  ecrName: "",
  assemblyLevel: "",
  partTechDesc: "",
  quantity: "",
  unit: "",
  moduleIdentifier: "",
  firstVehicleModel: "",
  supplierName: "",
  quotaSrm: "",
  partVersion: "",
  iaNumber: "",
  iaName: "",
  generalizationLevel: "",
  architectureComponent: "",
  partAttribute: "",
  costCategoryLevel2Name: "",
  costCategoryLevel3Name: "",
  suggestedSupplySource: "",
  sourceDescription: "",
  multiStructuredSupplySources: "",
  multiSourcesDescription: "",
  supplementInfo: "",
  developmentDepartment: "",
  expertEngineer: "",
  firstClassification: "",
  costEngineerName: "",
  procurementBusinessLine: "",
  procurementEngineerName: "",
  targetCostAmount: "",
  targetValue: "",
  targetRemark: "",
  estimatedCostAmount: "",
  initialEvaluationValue: "",
  bidRounds: null,
  exFactoryPrice: "",
  assessDataSources: "",
  materialCostWithAmortization: "",
  currentAmortizeDataSources: "",
  currentCostAmount: "",
  currentDataSources: "",
  currentAmortize: "",
  amortizationAmount: "",
  summaryWrapCost: "",
  summaryFreightCost: "",
  summaryDataSource: "",
  summaryRemark: "",
});

function getFieldValue(key: FieldKey) {
  return partForm[key] ?? "";
}

function setFieldValue(key: FieldKey, value: string | number | null) {
  (partForm as Record<FieldKey, unknown>)[key] = value;
}

function isFieldDisabled(field: FieldConfig) {
  return mode.value === "edit" && field.key === "partNo";
}

function hasPartIdentity(source?: Partial<CostBomPartItem> | null) {
  if (!source) {
    return false;
  }
  return Boolean(
    String(
      source.rawPartNumber ?? source.partNumber ?? source.partNo ?? "",
    ).trim(),
  );
}

const isUsageOnlyPart = computed(
  () =>
    mode.value !== "add" &&
    Boolean(activePart.value) &&
    !hasPartIdentity(activePart.value),
);

const visibleSections = computed(() =>
  isUsageOnlyPart.value
    ? sections.filter((section) => section.name === quantitySectionName)
    : sections,
);

function readUsagePatternSource(source: Partial<CostBomPartItem> | null) {
  const rawSource = source as (Partial<CostBomPartItem> &
    Record<string, unknown>) | null;
  if (!rawSource) {
    return [];
  }
  const candidates = [
    rawSource.costBomPattern,
    rawSource.patterns,
    rawSource.patternList,
    rawSource.costBomPatternList,
    rawSource.usagePatterns,
  ];
  return candidates.find(
    (value): value is CostBomPartPatternItem[] =>
      Array.isArray(value) && value.length > 0,
  ) ?? [];
}

function readLegacyField(
  source: Partial<CostBomPartItem> & Record<string, unknown>,
  fieldKey: keyof CostBomPartSaveItem,
) {
  const aliasMap: Partial<Record<keyof CostBomPartSaveItem, string[]>> = {
    partNo: ["partNumber"],
    sorCode: ["sorNumber"],
    sorName: ["sor_name"],
    ecrNumber: ["ecr_number"],
    ecrName: ["ecr_name"],
    iaNumber: ["ia_number"],
    iaName: ["ia_name"],
    assemblyLevel: ["assembly_level"],
    partTechDesc: ["part_tech_desc"],
    unit: ["unitUsage", "unit_usage"],
    moduleIdentifier: ["module_identifier"],
    firstVehicleModel: ["first_vehicle_model"],
    quotaSrm: ["quota_srm"],
    supplierName: ["supplier"],
    generalizationLevel: ["generalization_level"],
    architectureComponent: [
      "isArchitectureComponent",
      "is_architecture_component",
    ],
    suggestedSupplySource: ["suggested_supply_source"],
    sourceDescription: ["source_description"],
    multiStructuredSupplySources: ["multi_structured_supply_sources"],
    multiSourcesDescription: ["multi_sources_description"],
    supplementInfo: ["supplement_info"],
    developmentDepartment: ["development_department"],
    expertEngineer: ["expert_engineer"],
    firstClassification: ["first_classification"],
    costCategoryLevel2Name: ["secondClassification", "second_classification"],
    costCategoryLevel3Name: ["threeClassification", "three_classification"],
    partAttribute: ["part_attribute"],
    costEngineerName: ["costEngineer", "cost_engineer"],
    procurementEngineerName: ["procurementEngineer", "procurement_engineer"],
    targetValue: ["target_value"],
    targetRemark: ["target_remark"],
    initialEvaluationValue: ["initial_evaluation_value"],
    exFactoryPrice: ["ex_factory_price"],
    assessDataSources: ["assess_data_sources"],
    currentDataSources: ["current_data_sources"],
    currentAmortize: ["current_amortize"],
    currentAmortizeDataSources: ["current_amortize_data_sources"],
  };
  const keys = [fieldKey, ...(aliasMap[fieldKey] ?? [])];
  for (const key of keys) {
    const value = source[key as keyof typeof source];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return "";
}

function normalizeUsagePatterns(
  source: Partial<CostBomPartItem>,
  headerPatternNames: string[] = [],
  options?: { resetValues?: boolean },
) {
  const patternMap = new Map<string, CostBomPartPatternItem>();
  readUsagePatternSource(source)
    .filter((item) => item.patternName)
    .forEach((item) => {
      patternMap.set(String(item.patternName), {
        ...item,
        ...(options?.resetValues
          ? { id: null, costBomId: null, usagePerVehicle: null }
          : {}),
      });
    });
  headerPatternNames
    .filter((patternName) => patternName)
    .forEach((patternName) => {
      if (!patternMap.has(patternName)) {
        patternMap.set(patternName, {
          patternName,
          id: options?.resetValues ? null : undefined,
          costBomId: options?.resetValues ? null : undefined,
          usagePerVehicle: options?.resetValues ? null : "",
        });
      }
    });
  return Array.from(patternMap.values());
}

function buildCostBomPatternPayload() {
  const patternMap = new Map<string, CostBomPartPatternItem>();
  readUsagePatternSource(activePart.value)
    .filter((item) => item.patternName)
    .forEach((item) => {
      patternMap.set(String(item.patternName), { ...item });
    });
  usagePatternItems.value
    .filter((item) => item.patternName)
    .forEach((item) => {
      patternMap.set(String(item.patternName), {
        ...(patternMap.get(String(item.patternName)) ?? {}),
        ...item,
      });
    });
  return Array.from(patternMap.values());
}

function normalizeUsagePerVehicle(value: string | number | null | undefined) {
  let normalizedValue = String(value ?? "").replace(/[^\d.]/g, "");
  const decimalIndex = normalizedValue.indexOf(".");
  if (decimalIndex !== -1) {
    normalizedValue =
      normalizedValue.slice(0, decimalIndex + 1) +
      normalizedValue
        .slice(decimalIndex + 1)
        .replace(/\./g, "")
        .slice(0, 2);
  }
  return normalizedValue;
}

function setUsagePerVehicle(index: number, value: string | number | null) {
  if (!usagePatternItems.value[index]) {
    return;
  }
  usagePatternItems.value[index].usagePerVehicle =
    normalizeUsagePerVehicle(value);
}

function getUsagePerVehicleInputValue(
  value: string | number | null | undefined,
) {
  if (!isUsageOnlyPart.value || value == null) {
    return value ?? "";
  }
  return String(value).replace(/\s*%+\s*$/, "");
}

function fillPartForm(source: Partial<CostBomPartItem>) {
  const legacySource = source as Partial<CostBomPartItem> &
    Record<string, unknown>;
  Object.keys(partForm).forEach((key) => {
    const fieldKey = key as keyof CostBomPartSaveItem;
    const value = readLegacyField(legacySource, fieldKey);
    setFieldValue(
      fieldKey,
      value === undefined || value === null ? "" : (value as string | number),
    );
  });
  partForm.partNo = source.partNo || source.partNumber || "";
  partForm.partName = source.partName || "";
}

async function loadEditor() {
  loading.value = true;
  try {
    const [part, patterns] = await Promise.all([
      mode.value === "add"
        ? Promise.resolve(null)
        : fetchCostBomPartDetail(partId.value),
      mode.value === "add"
        ? fetchCostBomPartPatterns(
            versionId.value,
            versionNo.value || undefined,
          )
        : Promise.resolve([]),
    ]);
    activePart.value = part;
    if (mode.value !== "add" && !activePart.value) {
      BaseToast.warning("未找到需要处理的零件。");
      return;
    }
    fillPartForm(activePart.value ?? {});
    const patternSource =
      mode.value === "add" && patterns.length
        ? ({ costBomPattern: patterns } as Partial<CostBomPartItem>)
        : activePart.value ?? {};
    const patternNames =
      mode.value === "add"
        ? patterns
            .map((item) => String(item.patternName ?? "").trim())
            .filter(Boolean)
        : [];
    usagePatternItems.value = normalizeUsagePatterns(
      patternSource,
      patternNames,
      { resetValues: mode.value === "add" },
    );
    activeTab.value =
      visibleSections.value[0]?.name || quantitySectionName;
    await nextTick();
    programmaticScroll.value = null;
    scrollWrapRef.value?.scrollTo({ top: 0, behavior: "auto" });
  } finally {
    loading.value = false;
  }
}

function resolveEditScope(): CostBomPartEditScope | null {
  const permissions = authStore.permissions;
  if (permissions.includes("system:profit:bom:edit")) {
    return "profit";
  }
  if (permissions.includes("system:design:bom:edit")) {
    return "design";
  }
  if (
    permissions.includes("*:*:*") ||
    permissions.includes("system:revenue:bom:edit")
  ) {
    return "admin";
  }
  return null;
}

function buildPartPayload() {
  const costBomPattern = buildCostBomPatternPayload();
  const source =
    mode.value === "add" || !activePart.value
      ? { ...partForm, costBomPattern }
      : {
          ...activePart.value,
          ...partForm,
          costBomPattern,
        };

  return toCostBomPartWritePayload(
    source as Partial<CostBomPartItem> & Record<string, unknown>,
    {
      bomVersionId: versionId.value,
      vehicleModelId: vehicleModelId.value || undefined,
      fallbackVehicleModelId: projectId.value || undefined,
      vehicleModelName: vehicleModelName.value || undefined,
      valveId: valveId.value || undefined,
      valveName: valveName.value || undefined,
      version: versionNo.value || undefined,
      projectName: projectName.value || undefined,
    },
    {
      copy: mode.value === "copy",
      includeId: mode.value === "edit",
    },
  );
}

async function savePartEditor() {
  if (saving.value) {
    return;
  }
  if (
    !isUsageOnlyPart.value &&
    (!partForm.partNo?.trim() || !partForm.partName?.trim())
  ) {
    BaseToast.warning("零件号和零件名称不能为空。");
    return;
  }
  if (mode.value === "edit" && !activePart.value) {
    BaseToast.warning("未找到需要编辑的零件。");
    return;
  }
  const payload = buildPartPayload();
  saving.value = true;
  try {
    if (mode.value === "edit") {
      const scope = resolveEditScope();
      if (!scope) {
        BaseToast.warning("当前账号无编辑权限。");
        return;
      }
      await updateCostBomPart(payload, scope);
    } else {
      await createCostBomPart(payload);
    }
    BaseToast.success("保存成功");
    router.push({
      ...detailPath.value,
      query: {
        ...detailPath.value.query,
        refreshAt: String(Date.now()),
      },
    });
  } finally {
    saving.value = false;
  }
}

function scrollToSection(name: string | number) {
  const anchorName = String(name);
  activeTab.value = anchorName;
  const wrap = scrollWrapRef.value;
  const target = wrap?.querySelector<HTMLElement>(
    `[data-anchor="${anchorName}"]`,
  );
  if (!wrap || !target) {
    return;
  }
  const targetTop =
    target.getBoundingClientRect().top -
    wrap.getBoundingClientRect().top +
    wrap.scrollTop;
  const maxScrollTop = Math.max(wrap.scrollHeight - wrap.clientHeight, 0);
  const scrollTop = Math.min(
    Math.max(targetTop - sectionScrollOffset, 0),
    maxScrollTop,
  );
  programmaticScroll.value = { name: anchorName, top: scrollTop };
  wrap.scrollTo({
    top: scrollTop,
    behavior: "auto",
  });
}

function syncActiveTab() {
  const wrap = scrollWrapRef.value;
  if (!wrap) {
    return;
  }
  if (programmaticScroll.value) {
    activeTab.value = programmaticScroll.value.name;
    if (Math.abs(wrap.scrollTop - programmaticScroll.value.top) <= 1) {
      programmaticScroll.value = null;
    }
    return;
  }
  let current = visibleSections.value[0]?.name || quantitySectionName;
  const wrapTop = wrap.getBoundingClientRect().top;
  for (const section of visibleSections.value) {
    const target = wrap.querySelector<HTMLElement>(
      `[data-anchor="${section.name}"]`,
    );
    if (
      target &&
      target.getBoundingClientRect().top - wrapTop <= sectionScrollOffset
    ) {
      current = section.name;
    }
  }
  activeTab.value = current;
}

function goBack() {
  if (typeof route.query.returnPath === "string" && route.query.returnPath) {
    replaceToReturn(router, route, detailPath.value.path);
    return;
  }
  router.replace(detailPath.value);
}

onMounted(loadEditor);

watch(
  () => [partId.value, mode.value, projectId.value, versionId.value],
  () => {
    void loadEditor();
  },
);
</script>

<template>
  <PageContainer :title="pageTitle">
    <template #titleExtra>
      <div class="cost-bom-part-editor-page__meta">
        <span class="bq-page-inline-meta">项目代号：{{ projectName }}</span>
        <span class="bq-page-inline-meta">版本：V{{ versionNo }}</span>
        <span class="bq-page-inline-meta">阀点：{{ valveName || "--" }}</span>
      </div>
    </template>
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack"
        >返回</PermissionButton
      >
    </template>

    <div v-loading="loading" class="cost-bom-part-editor-page">
      <el-tabs
        v-model="activeTab"
        class="cost-bom-part-editor-page__tabs"
        @tab-change="scrollToSection"
      >
        <el-tab-pane
          v-for="section in visibleSections"
          :key="section.name"
          :label="section.label"
          :name="section.name"
        />
      </el-tabs>

      <div
        ref="scrollWrapRef"
        class="cost-bom-part-editor-page__body"
        @scroll="syncActiveTab"
      >
        <el-form
          :model="partForm"
          label-position="top"
          class="cost-bom-part-editor-page__form"
        >
          <section
            v-for="section in visibleSections"
            :key="section.name"
            class="cost-bom-part-editor-page__section"
            :data-anchor="section.name"
          >
            <BaseSectionTitle
              :title="section.label"
              size="small"
              heading-tag="h3"
            />
            <el-row v-if="section.name === 'quantity'" :gutter="24">
              <template
                v-for="(pattern, index) in usagePatternItems"
                :key="`${pattern.patternName || index}-usage`"
              >
                <el-col v-if="pattern.patternName !== '加权'" :span="8">
                  <el-form-item :label="pattern.patternName || '单车用量'">
                    <el-input
                      :model-value="
                        getUsagePerVehicleInputValue(
                          usagePatternItems[index].usagePerVehicle,
                        )
                      "
                      clearable
                      inputmode="decimal"
                      @update:model-value="
                        (value: string | number | null) =>
                          setUsagePerVehicle(index, value)
                      "
                    >
                      <template v-if="isUsageOnlyPart" #append>%</template>
                    </el-input>
                  </el-form-item>
                </el-col>
              </template>
            </el-row>
            <el-row :gutter="24">
              <el-col
                v-for="field in section.fields"
                :key="`${section.name}-${field.key}`"
                :span="field.span ?? 8"
              >
                <el-form-item :label="field.label" :required="field.required">
                  <el-select
                    v-if="field.type === 'select'"
                    :model-value="getFieldValue(field.key)"
                    :disabled="isFieldDisabled(field)"
                    clearable
                    @update:model-value="
                      (value: string | number | null) =>
                        setFieldValue(field.key, value)
                    "
                  >
                    <el-option
                      v-for="option in field.options"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                  <el-input
                    v-else-if="field.type === 'textarea'"
                    :model-value="getFieldValue(field.key)"
                    :disabled="isFieldDisabled(field)"
                    :rows="3"
                    type="textarea"
                    clearable
                    @update:model-value="
                      (value: string | number | null) =>
                        setFieldValue(field.key, value)
                    "
                  />
                  <el-input
                    v-else
                    :model-value="getFieldValue(field.key)"
                    :disabled="isFieldDisabled(field)"
                    clearable
                    @update:model-value="
                      (value: string | number | null) =>
                        setFieldValue(field.key, value)
                    "
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </section>
        </el-form>
      </div>

      <div class="cost-bom-part-editor-page__footer">
        <PermissionButton variant="secondary" @click="goBack">取消</PermissionButton>
        <PermissionButton
          variant="primary"
          type="primary"
          :loading="saving"
          :icon="null"
          @click="savePartEditor"
        >
          保存
        </PermissionButton>
      </div>
    </div>
  </PageContainer>
</template>

<style scoped>
.cost-bom-part-editor-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:global(.app-layout__content:has(.cost-bom-part-editor-page)) {
  overflow: hidden;
}

.cost-bom-part-editor-page__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cost-bom-part-editor-page__tabs {
  flex: 0 0 auto;
  padding: 0 4px;
  background: #fff;
  border-radius: 4px;
}

.cost-bom-part-editor-page__body {
  flex: 1 1 auto;
  height: calc(100vh - 292px);
  min-height: 420px;
  padding: 0 14px 78px 0;
  margin-top: 12px;
  overflow-x: hidden;
  overflow-y: auto;
}

.cost-bom-part-editor-page__form {
  padding: 0 4px;
}

.cost-bom-part-editor-page__section {
  padding: 2px 0 8px;
}

.cost-bom-part-editor-page :deep(.el-form-item) {
  margin-bottom: 18px;
}

.cost-bom-part-editor-page :deep(.el-form-item__label) {
  color: var(--bq-color-text-secondary, #555);
}

.cost-bom-part-editor-page :deep(.el-select) {
  width: 100%;
}

.cost-bom-part-editor-page__footer {
  position: fixed;
  right: var(--bq-space-page-x, 16px);
  bottom: 0;
  left: calc(var(--app-sidebar-width, 0px) + var(--bq-space-page-x, 16px));
  z-index: 20;
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  min-height: 60px;
  padding: 12px 0;
  background: var(--bq-color-surface, #fff);
  border-top: 1px solid var(--bq-color-border-subtle, #e5e7eb);
  box-shadow: 0 -4px 12px rgb(15 23 42 / 6%);
}

:global(.page-container.is-page-fullscreen .cost-bom-part-editor-page__footer) {
  right: 32px;
  left: 32px;
  border-top: 0;
  box-shadow: none;
}

:global(body.bq-page-fullscreen-active .cost-bom-part-editor-page__footer) {
  right: 32px;
  left: 32px;
  border-top: 0;
  box-shadow: none;
}

@media (max-width: 960px) {
  .cost-bom-part-editor-page__footer {
    right: 16px;
    left: 16px;
  }

  .cost-bom-part-editor-page__body {
    height: auto;
    min-height: 0;
    overflow: visible;
  }
}
</style>
