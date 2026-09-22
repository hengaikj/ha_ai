<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Back,
  CircleCheck,
  CirclePlus,
  CopyDocument,
  Delete,
  Download,
  Minus,
  Operation,
  Plus,
  Refresh,
  Search,
} from "@element-plus/icons-vue";
import {
  copyCostBomValveData,
  createCostBomExport,
  createCostBomExtendCalculationTask,
  createCostBomPriceRefreshTask,
  deleteCostBomPart,
  fetchCostBomFilterFields,
  fetchCostBomParts,
  fetchSupplyRatiosByPart,
  submitCostBomVersion,
} from "@/api/cost-center";
import {
  fetchBusinessProjectDetail,
  fetchBusinessValveOptions,
} from "@/api/project";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BasePagination from "@/components/base/BasePagination.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import {
  buildCostBomExportFileName,
  formatCostBomVersion,
} from "@/utils/cost-bom-export";
import { isDateFilterField } from "@/utils/date-filter-field";
import type {
  CostBomPartItem,
  SupplyRatioPart,
} from "@/types/cost-center";
import type { BusinessProjectItem, BusinessValveItem } from "@/types/project";

type DetailLogic = "AND" | "OR";
type DetailOperator = "" | "eq" | "gt" | "gte" | "lt" | "lte" | "isNull" | "isNotNull" | "like";
type DetailField = keyof CostBomPartItem;

type DetailCondition = {
  logic: DetailLogic;
  moduleName: string;
  attributeName: DetailField;
  operator: DetailOperator;
  value: string;
};

type DetailFieldOption = {
  label: string;
  value: DetailField;
  groupName: string;
  dataType: string;
  field?: string;
  fieldType?: string;
  tableSource?: string;
};

const operatorLabelMap: Record<DetailOperator, string> = {
  "": "全部",
  eq: "等于", gt: "大于", gte: "大于等于", lt: "小于", lte: "小于等于",
  isNull: "为空", isNotNull: "不为空", like: "包含",
};
const nullOperators = new Set<DetailOperator>(["isNull", "isNotNull"]);

type DetailOperatorOption = {
  label: string;
  value: DetailOperator;
};

type SupplyRatioSupplier = SupplyRatioPart["suppliers"][number];

const defaultDetailCondition = (): DetailCondition => ({
  logic: "AND",
  moduleName: "",
  attributeName: "" as DetailField,
  operator: "",
  value: "",
});

const route = useRoute();
const router = useRouter();
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const projectId = computed(() => Number(route.query.projectId));
const versionId = computed(() =>
  Number(route.query.bomVersionId || route.query.versionId),
);
const versionNo = computed(() => String(route.query.version ?? ""));
const vehicleModelId = computed(() => Number(route.query.vehicleModelId || 0));
const valveId = computed(() => Number(route.query.valveId || 0));
const activeMenuPath = computed(() => {
  if (typeof route.query.activeMenu === "string") {
    return route.query.activeMenu;
  }
  const title = String(route.meta.title ?? "");
  if (title.includes("成本履历")) {
    return "/cost/research/new-history";
  }
  if (title.includes("成本履历")) {
    return "/cost/research/history";
  }
  if (title.includes("项目成本")) {
    return "/cost/research/project-cost";
  }
  return "";
});
const viewPagePermissionPrefix = "costmanage:check";
const listPath = computed(() => {
  if (route.query.returnPath) {
    return String(route.query.returnPath);
  }
  if (activeMenuPath.value) {
    return activeMenuPath.value;
  }
  return String(
    route.meta.breadcrumbParentPath ?? "/cost/research/project-cost",
  );
});
const pageTitle = computed(() => {
  if (activeMenuPath.value === "/cost/research/history") {
    return "成本履历详情";
  }
  if (activeMenuPath.value === "/cost/research/new-history") {
    return "成本履历详情";
  }
  if (activeMenuPath.value === "/cost/research/new-project-cost") {
    return "项目成本查看";
  }
  if (activeMenuPath.value === "/cost/research/project-cost") {
    return "项目成本查看";
  }
  if (String(route.meta.title ?? "").includes("项目成本")) {
    return "项目成本查看";
  }
  return String(route.meta.title ?? "项目成本详情");
});
const routeBase = computed(
  () =>
    route.path.replace(/\/detail$/, "") ||
    String(route.meta.breadcrumbParentPath ?? "/cost/research/project-cost"),
);
const routeQuery = computed(() => ({
  projectId: String(projectId.value || ""),
  bomVersionId: String(versionId.value || ""),
  versionId: String(versionId.value || ""),
  version: versionNo.value || undefined,
  vehicleModelId: vehicleModelId.value
    ? String(vehicleModelId.value)
    : undefined,
  valveId: valveId.value ? String(valveId.value) : undefined,
  activeMenu: activeMenuPath.value || undefined,
  returnPath: route.fullPath,
  projectCode: route.query.projectCode
    ? String(route.query.projectCode)
    : undefined,
  projectName: route.query.projectName
    ? String(route.query.projectName)
    : undefined,
  vehicleModelName: route.query.vehicleModelName
    ? String(route.query.vehicleModelName)
    : undefined,
  valveName: route.query.valveName ? String(route.query.valveName) : undefined,
}));
const historyBackPath = computed(() => ({
  path: `${routeBase.value}/versions`,
  query: {
    projectId: String(projectId.value || ""),
    bomVersionId: String(
      route.query.historyBomVersionId || versionId.value || "",
    ),
    versionId: String(route.query.historyBomVersionId || versionId.value || ""),
    version: route.query.historyVersion
      ? String(route.query.historyVersion)
      : versionNo.value || undefined,
    vehicleModelId: vehicleModelId.value
      ? String(vehicleModelId.value)
      : undefined,
    valveId: valveId.value ? String(valveId.value) : undefined,
    activeMenu: activeMenuPath.value || undefined,
    vehicleModelName: route.query.vehicleModelName
      ? String(route.query.vehicleModelName)
      : undefined,
    valveName: route.query.valveName
      ? String(route.query.valveName)
      : undefined,
  },
}));

const loading = ref(false);
const deleting = ref(false);
const savingVersion = ref(false);
const deleteConfirmVisible = ref(false);
const saveVersionConfirmVisible = ref(false);
const detailParts = ref<CostBomPartItem[]>([]);
const selectedParts = ref<CostBomPartItem[]>([]);
const columnTarget = ref("");
const filterFields = ref<DetailFieldOption[]>([]);
const dynamicGroupAttrMap = ref<Record<string, DetailFieldOption[]>>({});
const boardOptions = ref<string[]>([]);
const filterOperatorConfig = ref<Record<string, unknown>>({});
const supplierDialogVisible = ref(false);
const supplierLoading = ref(false);
const copyValveDialogVisible = ref(false);
const copyValveLoading = ref(false);
const valveOptionsLoading = ref(false);
const valveOptions = ref<BusinessValveItem[]>([]);
const projectDetail = ref<BusinessProjectItem | null>(null);
const currentPartNo = ref("");
const supplyRatio = ref<SupplyRatioPart | null>(null);
const pageNo = ref(1);
const pageSize = ref(10);
const latestTaskId = ref<string>();
const latestTaskFileName = ref("");

const summary = reactive({
  total: 0,
});

const detailConditions = ref<DetailCondition[]>([defaultDetailCondition()]);
const copyValveForm = reactive({
  sourceValveId: "",
});

const currentValveLabel = computed(() => {
  const currentValve = valveOptions.value.find(
    (valve) => Number(valve.valveId) === valveId.value,
  );
  return route.query.valveName?.toString() || currentValve?.valveName || "";
});

const summaryProjectName = computed(() => {
  const directName = String(
    route.query.projectName || route.query.vehicleModelName || "",
  );
  if (directName) return directName;
  const returnPath = String(route.query.returnPath || "");
  try {
    const decoded = decodeURIComponent(returnPath);
    const queryStart = decoded.indexOf("?");
    if (queryStart >= 0) {
      const nestedName = new URLSearchParams(
        decoded.slice(queryStart + 1),
      ).get("projectName");
      if (nestedName) return nestedName;
    }
  } catch {
    // Ignore malformed legacy return paths and use loaded project data.
  }
  return projectDetail.value?.projectName || "--";
});
const summaryFactoryCode = computed(
  () =>
    String(
      route.query.factoryCode ||
        detailParts.value.find((part) => String(part.factoryCode ?? "").trim())
          ?.factoryCode ||
        "",
    ) || "--",
);
const summaryVersionLabel = computed(() => {
  return formatCostBomVersion(versionNo.value);
});

function resolveCostBomExportFileName() {
  return buildCostBomExportFileName({
    projectName: summaryProjectName.value,
    valveName: currentValveLabel.value,
    version: versionNo.value,
  });
}

const sourceValveOptions = computed(() =>
  valveOptions.value.filter((valve) => Number(valve.valveId) !== valveId.value),
);

const fallbackFilterFields: DetailFieldOption[] = [
  { label: "零件号", value: "partNo", groupName: "基本信息", dataType: "TEXT" },
  {
    label: "零件名称",
    value: "partName",
    groupName: "基本信息",
    dataType: "TEXT",
  },
  {
    label: "SOR名称",
    value: "sorName",
    groupName: "基本信息",
    dataType: "TEXT",
  },
  {
    label: "供应商",
    value: "supplierName",
    groupName: "基本信息",
    dataType: "TEXT",
  },
  {
    label: "模块标识",
    value: "moduleIdentifier",
    groupName: "基本信息",
    dataType: "TEXT",
  },
  {
    label: "通用化级别",
    value: "generalizationLevel",
    groupName: "分类",
    dataType: "TEXT",
  },
  {
    label: "是否架构件",
    value: "architectureComponent",
    groupName: "分类",
    dataType: "TEXT",
  },
  {
    label: "成本二级分类",
    value: "costCategoryLevel2Name",
    groupName: "分工",
    dataType: "TEXT",
  },
  {
    label: "成本三级分类",
    value: "costCategoryLevel3Name",
    groupName: "分工",
    dataType: "TEXT",
  },
  {
    label: "成本工程师",
    value: "costEngineerName",
    groupName: "分工",
    dataType: "TEXT",
  },
  {
    label: "采购工程师",
    value: "procurementEngineerName",
    groupName: "分工",
    dataType: "TEXT",
  },
  {
    label: "目标值",
    value: "targetValue",
    groupName: "目标值",
    dataType: "MONEY",
  },
  {
    label: "评估值",
    value: "initialEvaluationValue",
    groupName: "评估值",
    dataType: "MONEY",
  },
  {
    label: "当前成本",
    value: "currentCostAmount",
    groupName: "当前成本",
    dataType: "MONEY",
  },
];

const columnAnchors = [
  { label: "基本信息", value: "basic" },
  { label: "分类", value: "classify" },
  { label: "BOM补充信息", value: "bom-extra" },
  { label: "分工", value: "division" },
  { label: "单车用量", value: "quantity" },
  { label: "目标值", value: "target" },
  { label: "评估值", value: "initial-eval" },
  { label: "上会价", value: "meeting" },
  { label: "SRM价格", value: "srm" },
  { label: "当前成本", value: "current-cost" },
  { label: "各版型目标成本统计（不含摊销）", value: "variant-target" },
  { label: "各版型当前成本统计（不含摊销）", value: "variant-current-no" },
  { label: "各版型当前成本统计（含摊销）", value: "variant-current-yes" },
  { label: "各版型当前成本包装费统计", value: "variant-package" },
  { label: "各版型当前成本物流费统计", value: "variant-freight" },
  { label: "其他", value: "other" },
];

type ExtendColumn = {
  label: string;
  paths: string[];
  type?: "money" | "text";
  width?: number;
};

const meetingBaseColumns: ExtendColumn[] = [
  {
    label: "当前上会最新单号(采购)",
    paths: ["costBomExtend.meetingOrderNo"],
    width: 190,
  },
  { label: "议题类型(采购)", paths: ["costBomExtend.topicType"], width: 140 },
  {
    label: "采购专业(采购)",
    paths: ["costBomExtend.purchaseMajor"],
    width: 140,
  },
  {
    label: "供应商编码(采购)",
    paths: ["costBomExtend.supplierCode", "supplierCode"],
    width: 150,
  },
  {
    label: "供应商(采购)",
    paths: ["costBomExtend.supplierName", "supplierName"],
    width: 160,
  },
  {
    label: "定点会次(采购)",
    paths: ["costBomExtend.fixedMeetingTimes"],
    width: 150,
  },
  {
    label: "出厂价",
    paths: ["costBomExtend.exFactoryPricePurchase"],
    type: "money",
    width: 150,
  },
  {
    label: "包装费",
    paths: ["costBomExtend.packingFeePurchase"],
    type: "money",
    width: 150,
  },
  {
    label: "物流费",
    paths: ["costBomExtend.logisticsFeePurchase"],
    type: "money",
    width: 150,
  },
  {
    label: "不含摊销价",
    paths: ["costBomExtend.noAmortizationPrice"],
    type: "money",
    width: 160,
  },
  {
    label: "工装模具摊销",
    paths: ["costBomExtend.toolingAmortizationFee"],
    type: "money",
    width: 150,
  },
  {
    label: "技术开发摊销",
    paths: ["costBomExtend.techDevAmortizationFee"],
    type: "money",
    width: 150,
  },
  { label: "入厂价", paths: ["costBomExtend.factoryUnitPrice"], type: "money" },
  {
    label: "摊销工装模具费（元/不含税）",
    paths: ["costBomExtend.amortizationToolingUnitPrice"],
    type: "money",
    width: 210,
  },
  {
    label: "单独支付工装模具费（元/不含税）",
    paths: ["costBomExtend.paymentToolingOnceFee"],
    type: "money",
    width: 230,
  },
  {
    label: "摊销设计开发费（元/不含税）",
    paths: ["costBomExtend.amortizationDevUnitPrice"],
    type: "money",
    width: 210,
  },
  {
    label: "单独支付设计开发费（元/不含税）",
    paths: ["costBomExtend.paymentDevOnceFee"],
    type: "money",
    width: 230,
  },
  {
    label: "摊销基数（个）",
    paths: ["costBomExtend.amortizationBaseCount"],
    width: 150,
  },
  { label: "配额(采购)", paths: ["costBomExtend.supplierRatio"], width: 140 },
  {
    label: "商务降本",
    paths: ["costBomExtend.businessPriceRemark"],
    width: 140,
  },
  { label: "备注", paths: ["costBomExtend.mettRemark"], width: 170 },
];

const meetingLeadingColumns = meetingBaseColumns.slice(0, 6);
const meetingFixedCostColumns = meetingBaseColumns.slice(6, 18);
const meetingTrailingColumns = meetingBaseColumns.slice(18);

const srmPriceColumns: ExtendColumn[] = [
  {
    label: "SRM价格（含摊销）",
    paths: [
      "costBomExtend.amortizePrice",
      "costBomExtend.materialCostWithAmortizationSrm",
    ],
    type: "money",
    width: 180,
  },
  {
    label: "SRM价格（配额加权-含摊销）",
    paths: ["costBomExtend.amortizeWeightedCost"],
    type: "money",
    width: 210,
  },
  {
    label: "SRM价格（不含摊销）",
    paths: [
      "costBomExtend.noAmortizePrice",
      "costBomExtend.materialCostWithoutAmortizationSrm",
    ],
    type: "money",
    width: 190,
  },
  {
    label: "SRM价格（配额加权-不含摊销）",
    paths: ["costBomExtend.noAmortizeWeightedCost"],
    type: "money",
    width: 220,
  },
  {
    label: "工装模具-摊销数量",
    paths: ["costBomExtend.toolingAmortizationQuantity"],
    width: 170,
  },
  {
    label: "技术开发-摊销数量",
    paths: ["costBomExtend.techDevAmortizationQuantity"],
    width: 170,
  },
  { label: "包装费", paths: ["costBomExtend.wrapCost"], type: "money" },
  { label: "物流费", paths: ["costBomExtend.freightCost"], type: "money" },
  { label: "数据来源", paths: ["costBomExtend.dataSourceSrm"], width: 140 },
];

const currentCostColumns: ExtendColumn[] = [
  {
    label: "材料成本（含摊销）",
    paths: [
      "materialCostWithAmortization",
      "costBomExtend.materialCostWithAmortization",
    ],
    type: "money",
    width: 180,
  },
  {
    label: "材料成本（不含摊销）",
    paths: [
      "materialCostWithoutAmortization",
      "costBomExtend.materialCostWithoutAmortization",
    ],
    type: "money",
    width: 190,
  },
  {
    label: "工装模具-摊销数量",
    paths: ["costBomExtend.summaryToolingAmortizationQuantity"],
    width: 170,
  },
  {
    label: "技术开发-摊销数量",
    paths: ["costBomExtend.summaryTechDevAmortizationQuantity"],
    width: 170,
  },
  {
    label: "包装费",
    paths: ["summaryWrapCost", "costBomExtend.summaryWrapCost"],
    type: "money",
  },
  {
    label: "物流费",
    paths: ["summaryFreightCost", "costBomExtend.summaryFreightCost"],
    type: "money",
  },
  {
    label: "数据来源",
    paths: [
      "currentDataSources",
      "summaryDataSource",
      "costBomExtend.summaryDataSource",
    ],
    width: 150,
  },
  {
    label: "摊销金额",
    paths: ["amortizationAmount", "costBomExtend.amortizationAmount"],
    type: "money",
  },
  {
    label: "备注",
    paths: ["summaryRemark", "costBomExtend.summaryRemark"],
    width: 170,
  },
];

const otherColumns: ExtendColumn[] = [
  { label: "当前版本", paths: ["partVersion"], width: 120 },
  { label: "创建人", paths: ["createName", "createBy"], width: 130 },
  { label: "创建时间", paths: ["createTime"], width: 170 },
  { label: "更新人", paths: ["updateBy"], width: 130 },
  { label: "更新时间", paths: ["updateTime"], width: 170 },
];

const moduleOptions = computed(() => boardOptions.value);

const resolvedUsagePatternNames = computed(() => {
  const names = detailParts.value.flatMap((part) =>
    (part.costBomPattern || part.patterns || [])
      .map((pattern) => String(pattern.patternName || "").trim())
      .filter((patternName) => patternName && patternName !== "加权"),
  );
  const uniqueNames = Array.from(new Set(names));
  return uniqueNames.length ? uniqueNames : ["单车用量"];
});

const resolvedPatternNames = computed(() =>
  Array.from(
    new Set(
      detailParts.value
        .flatMap((part) =>
          (part.costBomPattern || part.patterns || []).map((pattern) =>
            String(pattern.patternName || "").trim(),
          ),
        )
        .filter((patternName) => patternName && patternName !== "单车用量"),
    ),
  ),
);

function resolvedFilterFields() {
  return filterFields.value.length ? filterFields.value : fallbackFilterFields;
}

function fieldsForModule(moduleName: string) {
  return moduleName ? dynamicGroupAttrMap.value[moduleName] || [] : [];
}

function operatorsForCondition(
  condition: DetailCondition,
): DetailOperatorOption[] {
  const field = resolvedFilterFields().find((item) => item.value === condition.attributeName);
  const configuredOperators = filterOperatorConfig.value[field?.fieldType || field?.dataType || "string"];
  if (Array.isArray(configuredOperators)) {
    const options = configuredOperators
      .map((operator) => String(operator))
      .filter((operator): operator is DetailOperator =>
        Object.prototype.hasOwnProperty.call(operatorLabelMap, operator),
      )
      .map((value) => ({ label: operatorLabelMap[value], value }))
      .filter((option) => option.value !== "eq" || !isDateFilterField(field));
    if (options.length) return options;
  }
  const dataType = field?.dataType?.toUpperCase();
  if (dataType === "NUMBER" || dataType === "MONEY" || dataType === "DECIMAL") {
    const options: DetailOperatorOption[] = [
      { label: "等于", value: "eq" },
      { label: "大于", value: "gt" },
      { label: "小于", value: "lt" },
      { label: "为空", value: "isNull" },
      { label: "不为空", value: "isNotNull" },
    ];
    return options.filter((option) => option.value !== "eq" || !isDateFilterField(field));
  }
  const options: DetailOperatorOption[] = [
    { label: "包含", value: "like" },
    { label: "等于", value: "eq" },
    { label: "为空", value: "isNull" },
    { label: "不为空", value: "isNotNull" },
  ];
  return options.filter((option) => option.value !== "eq" || !isDateFilterField(field));
}

async function loadFilterMetadata() {
  try {
    const filterResponse = await fetchCostBomFilterFields(projectId.value);
    const responseValue = filterResponse as unknown;
    const response = (responseValue && typeof responseValue === "object" && !Array.isArray(responseValue) ? responseValue : {}) as Record<string, unknown>;
    const nestedValue = response.data;
    const nestedResponse = (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue) ? nestedValue : {}) as Record<string, unknown>;
    filterOperatorConfig.value = (response.operatorConfig ?? nestedResponse.operatorConfig ?? {}) as Record<string, unknown>;
    const rowsValue = Array.isArray(responseValue) ? responseValue : (response.rows ?? (Array.isArray(nestedValue) ? nestedValue : nestedResponse.rows));
    const rows = Array.isArray(rowsValue) ? rowsValue : [];
    const groupMap: Record<string, DetailFieldOption[]> = {};
    rows.forEach((rowValue) => {
      const row = (rowValue || {}) as Record<string, unknown>;
      const boardName = String(row.boardName || "").trim();
      if (!boardName) return;
      if (!groupMap[boardName]) groupMap[boardName] = [];
      const field = String(row.field || "");
      const fieldType = String(row.fieldType || "TEXT");
      groupMap[boardName].push({ label: String(row.attrName || ""), value: field as DetailField, groupName: boardName, dataType: fieldType, field, fieldType, tableSource: String(row.tableSource || "") });
    });
    dynamicGroupAttrMap.value = groupMap;
    boardOptions.value = Object.keys(groupMap);
    filterFields.value = Object.values(groupMap).flat();
  } catch {
    filterFields.value = fallbackFilterFields;
    dynamicGroupAttrMap.value = {};
    boardOptions.value = [];
    filterOperatorConfig.value = {};
  }
}

async function loadDetailParts() {
  loading.value = true;
  try {
    const conditions = detailConditions.value
      .filter((item) => Boolean(item.attributeName) && (nullOperators.has(item.operator) || item.value.trim()))
      .map((item) => ({
        logic: item.logic,
        moduleName: item.moduleName || undefined,
        attributeName: item.attributeName,
        operator: item.operator,
        attributeValue: nullOperators.has(item.operator) ? "" : item.value.trim(),
      }));
    const page = await fetchCostBomParts(projectId.value, versionId.value, {
      pageNum: pageNo.value,
      pageSize: pageSize.value,
      version: versionNo.value || undefined,
      advancedConditions: conditions,
    });
    detailParts.value = page.records;
    selectedParts.value = [];
    summary.total = page.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function addDetailCondition() {
  detailConditions.value.push(defaultDetailCondition());
}

function removeDetailCondition(index: number) {
  if (detailConditions.value.length === 1) {
    Object.assign(detailConditions.value[0], defaultDetailCondition());
    return;
  }
  detailConditions.value.splice(index, 1);
}

function resetDetailConditions() {
  detailConditions.value = [defaultDetailCondition()];
  void loadDetailParts();
}

function handleConditionModuleChange(condition: DetailCondition) {
  condition.attributeName = "" as DetailField;
  condition.operator = "";
  condition.value = "";
}

function handleConditionFieldChange(condition: DetailCondition) {
  condition.operator = "";
  condition.value = "";
}

function searchDetailParts() {
  pageNo.value = 1;
  void loadDetailParts();
}

function handlePageSizeChange(value: number) {
  pageSize.value = value;
  pageNo.value = 1;
  void loadDetailParts();
}

function handlePageNoChange(value: number) {
  pageNo.value = value;
  void loadDetailParts();
}

function handleSelectionChange(rows: CostBomPartItem[]) {
  selectedParts.value = rows;
}

function goBack() {
  if (route.query.returnTo === "history") {
    router.replace(historyBackPath.value);
    return;
  }
  router.replace(listPath.value);
}

function goPartEditor(mode: "add" | "edit" | "copy", row?: CostBomPartItem) {
  if (mode === "add") {
    router.push({
      path: `${routeBase.value}/parts/add`,
      query: routeQuery.value,
    });
    return;
  }
  if (!row) {
    return;
  }
  router.push({
    path: `${routeBase.value}/parts/${mode}`,
    query: {
      ...routeQuery.value,
      partId: String(row.partId),
    },
  });
}

async function exportDetailParts() {
  const task = await createCostBomExport(projectId.value, {
    versionId: versionId.value,
    format: "xlsx",
  });
  latestTaskId.value = String(task.taskId);
  latestTaskFileName.value = resolveCostBomExportFileName();
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

async function calculateDetailParts() {
  const task = await createCostBomExtendCalculationTask(
    projectId.value,
    versionId.value,
    versionNo.value,
  );
  latestTaskId.value = task.taskId;
  latestTaskFileName.value = "";
  BaseToast.success(`计算任务已创建：${task.taskNo || task.taskId}`);
}

async function refreshSrmPrices() {
  const task = await createCostBomPriceRefreshTask(
    projectId.value,
    versionId.value,
  );
  latestTaskId.value = String(task.taskId);
  latestTaskFileName.value = "";
  BaseToast.success("SRM价格同步请求已提交。");
  await loadDetailParts();
}

async function loadValveOptions() {
  valveOptionsLoading.value = true;
  try {
    const page = await fetchBusinessValveOptions();
    valveOptions.value = page.records;
  } finally {
    valveOptionsLoading.value = false;
  }
}

async function openCopyValveDialog() {
  if (!vehicleModelId.value && !projectId.value) {
    BaseToast.warning("当前成本BOM缺少车型信息。");
    return;
  }
  if (!valveId.value) {
    BaseToast.warning("当前成本BOM缺少目标阀点。");
    return;
  }
  copyValveForm.sourceValveId = "";
  copyValveDialogVisible.value = true;
  if (valveOptions.value.length === 0) {
    await loadValveOptions();
  }
}

async function confirmCopyValveData() {
  if (!copyValveForm.sourceValveId) {
    BaseToast.warning("请选择复制来源阀点。");
    return;
  }
  const sourceValveId = Number(copyValveForm.sourceValveId);
  const targetValveId = valveId.value;
  const sourceValve = valveOptions.value.find(
    (valve) => Number(valve.valveId) === sourceValveId,
  );
  const sourceLabel = sourceValve?.valveName || "";

  try {
    await openConfirm({
      scene: "overwrite",
      object: "阀点零件",
      source: sourceLabel,
      target: currentValveLabel.value,
      type: "warning",
    });
  } catch {
    return;
  }

  copyValveLoading.value = true;
  try {
    await copyCostBomValveData(
      vehicleModelId.value || projectId.value,
      versionId.value,
      {
        sourceValveId,
        targetValveId,
      },
    );
    copyValveDialogVisible.value = false;
    BaseToast.success(
      `已复制 ${sourceLabel} 阀点数据到当前阀点 ${currentValveLabel.value}`,
    );
  } finally {
    copyValveLoading.value = false;
  }
  await loadDetailParts();
}

function openSaveVersionConfirm() {
  if (!versionId.value) {
    BaseToast.warning("当前成本BOM缺少版本信息。");
    return;
  }
  saveVersionConfirmVisible.value = true;
}

async function confirmSaveCostBomVersion() {
  savingVersion.value = true;
  try {
    const result = await submitCostBomVersion(
      projectId.value,
      versionId.value,
      {
        submitRemark: `${pageTitle.value}保存新版本`,
        version: versionNo.value,
      },
    );
    saveVersionConfirmVisible.value = false;
    BaseToast.success(
      `已保存新版本：V${result.bomVersion || result.versionNo}`,
    );
  } finally {
    savingVersion.value = false;
  }
}

function openDeleteConfirm() {
  if (selectedParts.value.length === 0) {
    BaseToast.warning("请选择需要删除的零件。");
    return;
  }
  deleteConfirmVisible.value = true;
}

async function deleteSelectedParts() {
  if (selectedParts.value.length === 0) {
    deleteConfirmVisible.value = false;
    return;
  }
  deleting.value = true;
  try {
    await Promise.all(
      selectedParts.value.map((part) =>
        deleteCostBomPart(
          projectId.value,
          versionId.value,
          part.partId,
          part.version,
        ),
      ),
    );
    BaseToast.success(`已删除 ${selectedParts.value.length} 条零件`);
    deleteConfirmVisible.value = false;
    await loadDetailParts();
  } finally {
    deleting.value = false;
  }
}

async function openSupplyRatio(row: CostBomPartItem) {
  if (!row.partNumber) {
    BaseToast.warning("当前零件缺少零件号。");
    return;
  }
  currentPartNo.value = row.partNumber;
  supplierDialogVisible.value = true;
  supplierLoading.value = true;
  try {
    supplyRatio.value = await fetchSupplyRatiosByPart(row.partNumber);
  } finally {
    supplierLoading.value = false;
  }
}

function openPartHistory(row: CostBomPartItem) {
  router.push({
    path: `${routeBase.value}/parts/histories`,
    query: {
      ...routeQuery.value,
      partId: String(row.partId),
      parentId: String(row.parentId ?? row.partId),
      partNo: row.partNumber,
    },
  });
}

async function scrollToColumn(value: string | number | boolean | undefined) {
  if (!value) {
    return;
  }
  await nextTick();
  const root = document.querySelector(".cost-bom-detail-page");
  if (!root) {
    return;
  }
  const columnClassName = `column-anchor-${String(value)}`;
  const bodyWrapper = root.querySelector(
    ".el-table__body-wrapper",
  ) as HTMLElement | null;
  const scrollContainer =
    (root.querySelector(
      ".el-table__body-wrapper .el-scrollbar__wrap",
    ) as HTMLElement | null) ?? bodyWrapper;
  const target = Array.from(
    root.querySelectorAll<HTMLElement>(
      ".el-table__body-wrapper .el-table__body *",
    ),
  ).find((element) => element.classList.contains(columnClassName));
  const headerTarget = Array.from(
    root.querySelectorAll<HTMLElement>(".el-table__header-wrapper *"),
  ).find((element) => element.classList.contains(columnClassName));

  if (!scrollContainer || (!target && !headerTarget)) {
    return;
  }

  const bodyRect = scrollContainer.getBoundingClientRect();
  const targetRect = (target ?? headerTarget)!.getBoundingClientRect();
  const fixedLeftOffset = Math.max(
    0,
    ...Array.from(
      root.querySelectorAll<HTMLElement>(
        ".el-table-fixed-column--left",
      ),
    ).map((element) => element.getBoundingClientRect().right - bodyRect.left),
  );
  const nextScrollLeft =
    scrollContainer.scrollLeft +
    targetRect.left -
    bodyRect.left -
    fixedLeftOffset;
  const scrollLeft = Math.min(
    Math.max(0, nextScrollLeft),
    Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth),
  );

  const syncHeaderAndFooter = () => {
    const currentScrollLeft = scrollContainer.scrollLeft;
    root
      .querySelectorAll<HTMLElement>(
        ".el-table__header-wrapper, .el-table__footer-wrapper, " +
          ".el-table__header-wrapper .el-scrollbar__wrap, .el-table__footer-wrapper .el-scrollbar__wrap",
      )
      .forEach((wrapper) => {
        wrapper.scrollLeft = currentScrollLeft;
      });

    if (Math.abs(currentScrollLeft - scrollLeft) > 1) {
      requestAnimationFrame(syncHeaderAndFooter);
    }
  };

  scrollContainer.scrollTo({ left: scrollLeft, behavior: "smooth" });
  syncHeaderAndFooter();
}

function anchorClass(value: string) {
  return `column-anchor-${value}`;
}

function applyHeaderGroupColors() {
  const table = document.querySelector<HTMLElement>(
    ".cost-bom-detail-page__table",
  );
  table?.querySelectorAll("thead").forEach((thead) => {
    const rows = Array.from(thead.rows);
    const occupied: boolean[][] = [];
    const rowRanges = rows.map((row, rowIndex) => {
      const ranges: Array<{ cell: HTMLTableCellElement; start: number; end: number }> = [];
      let cursor = 0;

      for (const cell of Array.from(row.cells)) {
        while (occupied[rowIndex]?.[cursor]) cursor++;
        const start = cursor;
        const end = start + (cell.colSpan || 1);
        const rowEnd = rowIndex + (cell.rowSpan || 1);

        for (let currentRow = rowIndex; currentRow < rowEnd; currentRow++) {
          occupied[currentRow] ||= [];
          for (let column = start; column < end; column++) {
            occupied[currentRow][column] = true;
          }
        }

        ranges.push({ cell, start, end });
        cursor = end;
      }

      return ranges;
    });

    for (const { cell: topCell, start: topStart, end: topEnd } of rowRanges[0] ?? []) {
      const groupClass = Array.from(topCell.classList).find((className) =>
        className.startsWith("column-anchor-"),
      );
      if (!groupClass) continue;

      rowRanges.forEach((ranges) => {
        ranges.forEach(({ cell, start, end }) => {
          if (start < topEnd && end > topStart) {
            cell.classList.add(groupClass);
          }
        });
      });
    }
  });
}

watch(detailParts, async () => {
  await nextTick();
  applyHeaderGroupColors();
});

function formatMoney(value?: string | number | null) {
  if (value == null || value === "") {
    return "--";
  }
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    return String(value);
  }
  return numberValue.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatText(value?: string | number | null) {
  return value == null || value === "" ? "--" : String(value);
}

function readRowValue(row: CostBomPartItem, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") {
        return undefined;
      }
      return (current as Record<string, unknown>)[key];
    }, row);
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return null;
}

function formatRowValue(
  row: CostBomPartItem,
  paths: string[],
  type: "money" | "text" = "text",
) {
  const value = readRowValue(row, paths);
  return type === "money"
    ? formatMoney(value as string | number | null)
    : formatText(value as string | number | null);
}

function formatUsage(row: CostBomPartItem, patternName: string) {
  const pattern = (row.costBomPattern || row.patterns || []).find(
    (item) => item.patternName === patternName,
  );
  if (pattern) {
    return formatText(pattern.usagePerVehicle);
  }
  return patternName === "单车用量" ? formatText(row.quantity) : "--";
}

function formatPatternMoney(
  row: CostBomPartItem,
  patternName: string,
  field:
    | "targetCost"
    | "currentCost"
    | "currentCostAmortize"
    | "currentPackageCost"
    | "currentFreightCost",
) {
  const pattern = (row.costBomPattern || row.patterns || []).find(
    (item) => item.patternName === patternName,
  );
  return formatMoney(pattern?.[field] as string | number | null | undefined);
}

function getSupplierName(row: SupplyRatioSupplier) {
  return row.supplierChName || row.supplierName;
}

function getNoAmortizePrice(row: SupplyRatioSupplier) {
  return row.noAmortizePrice ?? row.noAmortizationPrice;
}

function getAmortizePrice(row: SupplyRatioSupplier) {
  return row.amortizePrice ?? row.amortizationPrice;
}

function getPartTransmitDate(row: SupplyRatioSupplier) {
  return row.transmitDate ?? row.transmitAt;
}

function getRatioTransmitDate(row: SupplyRatioSupplier) {
  return row.ratioTransmitDate ?? row.quotaTransmitDate;
}

async function loadProjectDetail() {
  if (!projectId.value) {
    return;
  }
  try {
    projectDetail.value = await fetchBusinessProjectDetail(projectId.value);
  } catch {
    projectDetail.value = null;
  }
}

onMounted(async () => {
  await Promise.all([loadProjectDetail(), loadFilterMetadata()]);
  await loadDetailParts();
});
</script>

<template>
  <PageContainer :title="pageTitle">
    <template #titleExtra>
      <span class="bq-page-inline-meta">
        项目代码：{{ summaryProjectName }} / 工厂代码：{{ summaryFactoryCode }} /
        版本：{{ summaryVersionLabel }} /

      </span>
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

    <div class="cost-bom-detail-page">
      <section class="cost-bom-detail-page__conditions">
        <div
          v-for="(condition, index) in detailConditions"
          :key="index"
          class="cost-bom-detail-page__condition"
          :class="{ 'cost-bom-detail-page__condition--first': index === 0 }"
        >
          <el-select
            v-if="index > 0"
            v-model="condition.logic"
            class="cost-bom-detail-page__logic"
          >
            <el-option label="并且" value="AND" />
            <el-option label="或者" value="OR" />
          </el-select>
          <el-select
            v-model="condition.moduleName"
            class="cost-bom-detail-page__module"
            clearable
            filterable
            placeholder="模块名称"
            @change="handleConditionModuleChange(condition)"
          >
            <el-option
              v-for="moduleName in moduleOptions"
              :key="moduleName"
              :label="moduleName"
              :value="moduleName"
            />
          </el-select>
          <el-select
            v-model="condition.attributeName"
            class="cost-bom-detail-page__attr"
            filterable
            placeholder="属性名称"
            @change="handleConditionFieldChange(condition)"
          >
            <el-option
              v-for="field in fieldsForModule(condition.moduleName)"
              :key="field.value"
              :label="field.label"
              :value="field.value"
            />
          </el-select>
          <el-select
            v-model="condition.operator"
            class="cost-bom-detail-page__operator"
          >
            <el-option
              v-for="operator in operatorsForCondition(condition)"
              :key="operator.value"
              :label="operator.label"
              :value="operator.value"
            />
          </el-select>
          <el-input
            v-model="condition.value"
            class="cost-bom-detail-page__value"
            clearable
            :disabled="nullOperators.has(condition.operator)"
            placeholder="属性值"
            @keyup.enter="searchDetailParts"
          />
          <el-tooltip v-if="index === 0" content="添加条件" placement="top">
            <el-button
              class="cost-bom-detail-page__condition-icon is-add"
              circle
              plain
              type="primary"
              :icon="Plus"
              @click="addDetailCondition"
            />
          </el-tooltip>
          <template v-if="index === 0">
            <PermissionButton
              type="primary"
              :icon="Search"
              @click="searchDetailParts"
              >查询</PermissionButton
            >
            <PermissionButton :icon="Refresh" @click="resetDetailConditions"
              >重置</PermissionButton
            >
          </template>
          <el-tooltip v-else content="删除条件" placement="top">
            <PermissionButton
              class="cost-bom-detail-page__condition-icon is-delete"
              circle
              plain
              type="danger"
              :icon="Minus"
              @click="removeDetailCondition(index)"
            />
          </el-tooltip>
        </div>
      </section>

      <section class="cost-bom-detail-page__toolbar">
        <div class="cost-bom-detail-page__toolbar-left">
          <PermissionButton
            :permission="`${viewPagePermissionPrefix}:add`"
            variant="primary"
            type="primary"
            plain
            :icon="CirclePlus"
            @click="goPartEditor('add')"
          >
            新增
          </PermissionButton>
          <PermissionButton
            :permission="`${viewPagePermissionPrefix}:export`"
            :icon="Download"
            @click="exportDetailParts"
          >
            导出
          </PermissionButton>
          <PermissionButton
            :permission="`${viewPagePermissionPrefix}:computing`"
            :icon="Operation"
            @click="calculateDetailParts"
          >
            计算
          </PermissionButton>
          <PermissionButton
            :permission="`${viewPagePermissionPrefix}:computing`"
            @click="refreshSrmPrices"
          >
            同步SRM价格
          </PermissionButton>
          <PermissionButton
            permission="costmanage:check:pointreplication"
            :icon="CopyDocument"
            @click="openCopyValveDialog"
          >
            阀点复制
          </PermissionButton>
          <PermissionButton
            permission="costmanage:check:save"
            :icon="CircleCheck"
            @click="openSaveVersionConfirm"
          >
            保存新版本
          </PermissionButton>
          <PermissionButton
            :permission="`${viewPagePermissionPrefix}:remove`"
            variant="danger"
            type="danger"
            plain
            :icon="Delete"
            @click="openDeleteConfirm"
          >
            批量删除
          </PermissionButton>
        </div>
        <div class="cost-bom-detail-page__toolbar-right">
          <span
            v-if="selectedParts.length"
            class="cost-bom-detail-page__selected"
          >
            已选择 {{ selectedParts.length }} 条
          </span>
          <el-select
            v-model="columnTarget"
            clearable
            placeholder="字段定位"
            @change="scrollToColumn"
          >
            <el-option
              v-for="item in columnAnchors"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
      </section>

      <TaskStatusPanel
        v-if="false"
        :task-id="latestTaskId"
        :download-file-name="latestTaskFileName"
      />

      <el-table
        v-loading="loading"
        class="cost-bom-detail-page__table"
        :data="detailParts"
        border
        height="calc(100vh - var(--bq-header-height) - var(--bq-tags-height) - 324px)"
        @selection-change="handleSelectionChange"
      >
        <el-table-column
          type="selection"
          width="48"
          fixed="left"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        />
        <el-table-column
          type="index"
          label="序号"
          width="64"
          fixed="left"
          align="center"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        />
        <el-table-column
          prop="partNumber"
          label="零件号"
          min-width="150"
          fixed="left"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        >
          <template #default="{ row, $index }">
            <PermissionButton
              link
              type="primary"
              @click="openSupplyRatio(row)"
            >
              {{ $index === 0 ? "" : formatText(row.partNumber) }}
            </PermissionButton>
          </template>
        </el-table-column>
        <el-table-column
          prop="partName"
          label="零件名称"
          min-width="180"
          fixed="left"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        />
        <el-table-column
          label="基本信息"
          align="center"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        >
          <el-table-column prop="sorCode" label="SOR号" min-width="130" />
          <el-table-column prop="sorName" label="SOR名称" min-width="150" />
          <el-table-column prop="ecrNumber" label="ECR号" min-width="130" />
          <el-table-column prop="ecrName" label="ECR名称" min-width="150" />
          <el-table-column prop="iaNumber" label="IA号" min-width="130" />
          <el-table-column prop="iaName" label="IA名称" min-width="150" />
          <el-table-column
            prop="assemblyLevel"
            label="装配级别"
            min-width="120"
          />
          <el-table-column
            prop="partTechDesc"
            label="零部件关键技术状态描述"
            min-width="220"
          />
          <el-table-column prop="unit" label="单位" width="90" />
          <el-table-column
            prop="moduleIdentifier"
            label="模块标识"
            min-width="140"
          />
          <el-table-column
            prop="firstVehicleModel"
            label="首用车型"
            min-width="140"
          />
          <el-table-column prop="quotaSrm" label="配额(SRM)" min-width="120" />
          <el-table-column
            prop="supplierName"
            label="供应商名称"
            min-width="170"
          />
        </el-table-column>

        <el-table-column
          label="分类"
          align="center"
          :label-class-name="anchorClass('classify')"
          :class-name="anchorClass('classify')"
        >
          <el-table-column
            prop="generalizationLevel"
            label="通用化级别"
            min-width="130"
          />
          <el-table-column
            prop="architectureComponent"
            label="是否架构件"
            min-width="120"
          >
            <template #default="{ row }">{{
              formatRowValue(row, [
                "architectureComponent",
                "isArchitectureComponent",
              ])
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="BOM补充信息"
          align="center"
          :label-class-name="anchorClass('bom-extra')"
          :class-name="anchorClass('bom-extra')"
        >
          <el-table-column
            prop="suggestedSupplySource"
            label="建议货源"
            min-width="150"
          />
          <el-table-column
            prop="sourceDescription"
            label="货源描述"
            min-width="170"
          />
          <el-table-column
            prop="multiStructuredSupplySources"
            label="结构货源"
            min-width="150"
          />
          <el-table-column
            prop="multiSourcesDescription"
            label="结构货源描述"
            min-width="170"
          />
        </el-table-column>

        <el-table-column
          label="分工"
          align="center"
          :label-class-name="anchorClass('division')"
          :class-name="anchorClass('division')"
        >
          <el-table-column
            prop="developmentDepartment"
            label="研发专业部门"
            min-width="150"
          />
          <el-table-column
            prop="expertEngineer"
            label="专业工程师"
            min-width="130"
          />
          <el-table-column
            prop="partAttribute"
            label="零件属性"
            min-width="130"
          />
          <el-table-column
            prop="firstClassification"
            label="成本专业科室"
            min-width="150"
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
            prop="costEngineerName"
            label="成本工程师"
            min-width="130"
          />
          <el-table-column
            prop="procurementEngineerName"
            label="采购工程师"
            min-width="130"
          />
        </el-table-column>

        <el-table-column
          label="单车用量"
          align="center"
          :label-class-name="anchorClass('quantity')"
          :class-name="anchorClass('quantity')"
        >
          <el-table-column
            v-for="patternName in resolvedUsagePatternNames"
            :key="patternName"
            :label="patternName"
            min-width="120"
            align="center"
          >
            <template #header>{{ patternName }}</template>
            <template #default="{ row }">{{
              formatUsage(row, patternName)
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="目标值"
          align="center"
          :label-class-name="anchorClass('target')"
          :class-name="anchorClass('target')"
        >
          <el-table-column
            prop="targetValue"
            label="目标值"
            min-width="130"
            align="center"
            :label-class-name="anchorClass('target')"
          >
            <template #default="{ row }">{{
              formatMoney(row.targetValue || row.targetCostAmount)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="targetRemark"
            label="备注"
            min-width="170"
            :label-class-name="anchorClass('target')"
          />
        </el-table-column>

        <el-table-column
          label="评估值"
          align="center"
          :label-class-name="anchorClass('initial-eval')"
          :class-name="anchorClass('initial-eval')"
        >
          <el-table-column
            prop="initialEvaluationValue"
            label="评估值"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{
              formatMoney(row.initialEvaluationValue)
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="上会价"
          align="center"
          :label-class-name="anchorClass('meeting')"
          :class-name="anchorClass('meeting')"
        >
          <el-table-column
            v-for="column in meetingLeadingColumns"
            :key="column.label"
            :label="column.label"
            :min-width="column.width || 130"
            :align="column.type === 'money' ? 'right' : 'center'"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              formatRowValue(row, column.paths, column.type)
            }}</template>
          </el-table-column>
          <el-table-column
            label="定点成本(采购)"
            align="center"
            :label-class-name="anchorClass('meeting')"
          >
            <el-table-column
              v-for="column in meetingFixedCostColumns"
              :key="column.label"
              :label="column.label"
              :min-width="column.width || 130"
              :align="column.type === 'money' ? 'right' : 'center'"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{
                formatRowValue(row, column.paths, column.type)
              }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column
            v-for="column in meetingTrailingColumns"
            :key="column.label"
            :label="column.label"
            :min-width="column.width || 130"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              formatRowValue(row, column.paths)
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="SRM价格"
          align="center"
          :label-class-name="anchorClass('srm')"
          :class-name="anchorClass('srm')"
        >
          <el-table-column
            v-for="column in srmPriceColumns"
            :key="column.label"
            :label="column.label"
            :min-width="column.width || 130"
            :align="column.type === 'money' ? 'right' : 'center'"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              formatRowValue(row, column.paths, column.type)
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="当前成本"
          align="center"
          :label-class-name="anchorClass('current-cost')"
          :class-name="anchorClass('current-cost')"
        >
          <el-table-column
            v-for="column in currentCostColumns"
            :key="column.label"
            :label="column.label"
            :min-width="column.width || 130"
            :align="column.type === 'money' ? 'right' : 'center'"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              formatRowValue(row, column.paths, column.type)
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="各版型目标成本统计（不含摊销）"
          align="center"
          :label-class-name="anchorClass('variant-target')"
          :class-name="anchorClass('variant-target')"
        >
          <el-table-column
            v-for="patternName in resolvedPatternNames"
            :key="`variant-target-${patternName}`"
            :label="patternName"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{
              formatPatternMoney(row, patternName, "targetCost")
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="各版型当前成本统计（不含摊销）"
          align="center"
          :label-class-name="anchorClass('variant-current-no')"
          :class-name="anchorClass('variant-current-no')"
        >
          <el-table-column
            v-for="patternName in resolvedPatternNames"
            :key="`variant-current-no-${patternName}`"
            :label="patternName"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{
              formatPatternMoney(row, patternName, "currentCost")
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="各版型当前成本统计（含摊销）"
          align="center"
          :label-class-name="anchorClass('variant-current-yes')"
          :class-name="anchorClass('variant-current-yes')"
        >
          <el-table-column
            v-for="patternName in resolvedPatternNames"
            :key="`variant-current-yes-${patternName}`"
            :label="patternName"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{
              formatPatternMoney(row, patternName, "currentCostAmortize")
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="各版型当前成本包装费统计"
          align="center"
          :label-class-name="anchorClass('variant-package')"
          :class-name="anchorClass('variant-package')"
        >
          <el-table-column
            v-for="patternName in resolvedPatternNames"
            :key="`variant-package-${patternName}`"
            :label="patternName"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{
              formatPatternMoney(row, patternName, "currentPackageCost")
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="各版型当前成本物流费统计"
          align="center"
          :label-class-name="anchorClass('variant-freight')"
          :class-name="anchorClass('variant-freight')"
        >
          <el-table-column
            v-for="patternName in resolvedPatternNames"
            :key="`variant-freight-${patternName}`"
            :label="patternName"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{
              formatPatternMoney(row, patternName, "currentFreightCost")
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="其他"
          align="center"
          :label-class-name="anchorClass('other')"
          :class-name="anchorClass('other')"
        >
          <el-table-column
            v-for="column in otherColumns"
            :key="column.label"
            :label="column.label"
            :min-width="column.width || 130"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              column.label === "当前版本" && readRowValue(row, column.paths)
                ? `V${readRowValue(row, column.paths)}`
                : formatRowValue(row, column.paths)
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row, $index }">
            <PermissionButton
              link
              type="primary"
              :permission="`${viewPagePermissionPrefix}:edit`"
              @click="goPartEditor('edit', row)"
            >
              编辑
            </PermissionButton>
            <PermissionButton
              link
              type="primary"
              :permission="`${viewPagePermissionPrefix}:historical`"
              @click="openPartHistory(row)"
            >
              历史版本
            </PermissionButton>
            <PermissionButton
              link
              type="primary"
              permission="costmanage:check:copy"
              :disabled="$index === 0"
              @click="goPartEditor('copy', row)"
            >
              复制
            </PermissionButton>
          </template>
        </el-table-column>
      </el-table>

      <div class="cost-bom-detail-page__pagination">
        <BasePagination
          :page-no="pageNo"
          :page-size="pageSize"
          :total="summary.total"
          :page-sizes="[10, 20, 30, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @page-change="handlePageNoChange"
        />
      </div>

      <BaseFormDialog
        v-model="copyValveDialogVisible"
        title="复制历史数据"
        width="760px"
        confirm-text="确认"
        cancel-text="取消"
        :loading="copyValveLoading"
        :confirm-button-props="{
          disabled: !copyValveForm.sourceValveId,
        }"
        @confirm="confirmCopyValveData"
      >
        <div class="cost-bom-detail-page__copy-valve">
          <div class="cost-bom-detail-page__copy-valve-fields">
            <el-form-item label="源阀点（复制来源）">
              <el-select
                v-model="copyValveForm.sourceValveId"
                :loading="valveOptionsLoading"
                placeholder="请选择"
                filterable
              >
                <el-option
                  v-for="valve in sourceValveOptions"
                  :key="String(valve.valveId)"
                  :label="valve.valveName || ''"
                  :value="String(valve.valveId)"
                />
              </el-select>
            </el-form-item>
            <div class="cost-bom-detail-page__copy-valve-arrow">-&gt;</div>
            <el-form-item label="目标阀点（当前）">
              <el-input
                :model-value="currentValveLabel || '-'"
                disabled
                clearable
              />
            </el-form-item>
          </div>
          <el-alert
            v-if="copyValveForm.sourceValveId"
            type="warning"
            :closable="false"
            show-icon
            :title="`将复制 ${sourceValveOptions.find((item) => String(item.valveId) === copyValveForm.sourceValveId)?.valveName || ''} 阀点的零件信息到当前阀点 ${currentValveLabel}`"
          />
          <div class="cost-bom-detail-page__copy-valve-tips">
            <strong>操作说明</strong>
            <p>1. 选择要复制数据的源阀点</p>
            <p>2. 系统将匹配源阀点与当前阀点的零件信息</p>
            <p>3. 复制完成后，数据将覆盖当前阀点的对应零件信息</p>
          </div>
        </div>
      </BaseFormDialog>

      <BaseFormDialog
        v-model="supplierDialogVisible"
        title="供应商配额信息"
        width="900px"
        confirm-text="关闭"
        cancel-text="取消"
        close-on-confirm
      >
        <div v-loading="supplierLoading" class="cost-bom-detail-page__supplier">
          <div class="cost-bom-detail-page__supplier-summary">
            <span
              >零件号：<strong>{{ currentPartNo || "--" }}</strong></span
            >
          </div>
          <el-table
            :data="supplyRatio?.suppliers ?? []"
            border
            max-height="420"
          >
            <el-table-column
              label="供应商名称"
              min-width="180"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{
                formatText(getSupplierName(row))
              }}</template>
            </el-table-column>
            <el-table-column
              prop="supplierRatio"
              label="供应商配额"
              min-width="120"
            />
            <el-table-column label="不含摊销价" min-width="130">
              <template #default="{ row }">{{
                formatMoney(getNoAmortizePrice(row))
              }}</template>
            </el-table-column>
            <el-table-column label="含摊销价" min-width="130">
              <template #default="{ row }">{{
                formatMoney(getAmortizePrice(row))
              }}</template>
            </el-table-column>
            <el-table-column label="零件传输日期" min-width="150">
              <template #default="{ row }">{{
                formatText(getPartTransmitDate(row))
              }}</template>
            </el-table-column>
            <el-table-column label="配额传输日期" min-width="150">
              <template #default="{ row }">{{
                formatText(getRatioTransmitDate(row))
              }}</template>
            </el-table-column>
          </el-table>
        </div>
      </BaseFormDialog>

      <BaseConfirm
        v-model="saveVersionConfirmVisible"
        title="保存版本"
        :message="`确认保存当前成本BOM版本 V${versionNo || '-'}？保存后会生成对应版本记录。`"
        type="warning"
        confirm-text="确认保存"
        :loading="savingVersion"
        @confirm="confirmSaveCostBomVersion"
      />

      <BaseConfirm
        v-model="deleteConfirmVisible"
        title="删除零件"
        :message="`确认删除已选择的 ${selectedParts.length} 条零件？删除后当前版本明细不再展示这些记录。`"
        type="danger"
        confirm-text="删除"
        :loading="deleting"
        @confirm="deleteSelectedParts"
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
    </div>
  </PageContainer>
</template>

<style scoped>
.cost-bom-detail-page {
  min-height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) - 96px
  );
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.cost-bom-detail-page__condition-actions,
.cost-bom-detail-page__toolbar,
.cost-bom-detail-page__toolbar-left,
.cost-bom-detail-page__toolbar-right {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.cost-bom-detail-page__selected {
  color: var(--bq-color-text-muted);
  font-size: 14px;
}

.cost-bom-detail-page__conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cost-bom-detail-page__condition {
  display: grid;
  grid-template-columns:
    110px minmax(220px, 0.8fr) minmax(260px, 1fr) 130px
    minmax(260px, 1.2fr) 52px;
  gap: 10px;
  align-items: center;
}

.cost-bom-detail-page__condition--first {
  grid-template-columns:
    minmax(220px, 0.8fr) minmax(260px, 1fr) 130px
    minmax(260px, 1.2fr) 32px auto auto;
}

.cost-bom-detail-page__logic,
.cost-bom-detail-page__module,
.cost-bom-detail-page__attr,
.cost-bom-detail-page__operator,
.cost-bom-detail-page__value {
  width: 100%;
}

.cost-bom-detail-page__condition-actions {
  padding-left: 0;
}

.cost-bom-detail-page__condition-icon {
  width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 0;
  flex: 0 0 32px;
  align-self: center;
  justify-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.cost-bom-detail-page__toolbar {
  justify-content: space-between;
}

.cost-bom-detail-page__toolbar-right .el-select {
  width: 150px;
}

.cost-bom-detail-page__table {
  min-height: 360px;
}

.cost-bom-detail-page :deep(.el-table th.el-table__cell) {
  background: var(--bq-color-table-header);
  border-right: 1px solid var(--bq-color-border);
  border-bottom: 1px solid var(--bq-color-border);
  color: var(--bq-color-text);
  font-weight: 600;
}

.cost-bom-detail-page :deep(.el-table th.el-table__cell:last-child) {
  border-right: 0;
}

.cost-bom-detail-page :deep(.el-table thead.is-group th.el-table__cell) {
  border-right: 1px solid var(--bq-color-border);
  border-bottom: 1px solid var(--bq-color-border);
}

.cost-bom-detail-page :deep(.el-table--border .el-table__cell) {
  border-right-color: var(--bq-color-border);
}

.cost-bom-detail-page :deep(.el-table .cell) {
  white-space: nowrap;
}

.cost-bom-detail-page__table :deep(.cell) {
  text-align: center;
}

.cost-bom-detail-page__pagination {
  position: sticky;
  bottom: 0;
  z-index: 3;
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 0;
  background: var(--bq-color-surface);
  border-top: 1px solid var(--bq-color-border-subtle);
}

.cost-bom-detail-page :deep(th.column-anchor-basic) {
  background: #f5f7fa;
}

.cost-bom-detail-page :deep(th.column-anchor-classify) {
  background: #eef5ff;
}

.cost-bom-detail-page :deep(th.column-anchor-bom-extra) {
  background: #f5f7fa;
}

.cost-bom-detail-page :deep(th.column-anchor-division) {
  background: #eef5ff;
}

.cost-bom-detail-page :deep(th.column-anchor-quantity),
.cost-bom-detail-page :deep(th.column-anchor-variant-target),
.cost-bom-detail-page :deep(th.column-anchor-variant-current-yes),
.cost-bom-detail-page :deep(th.column-anchor-variant-freight) {
  background: #f5f7fa;
}

.cost-bom-detail-page :deep(th.column-anchor-target),
.cost-bom-detail-page :deep(th.column-anchor-initial-eval),
.cost-bom-detail-page :deep(th.column-anchor-meeting),
.cost-bom-detail-page :deep(th.column-anchor-current-cost),
.cost-bom-detail-page :deep(th.column-anchor-variant-current-no),
.cost-bom-detail-page :deep(th.column-anchor-variant-package),
.cost-bom-detail-page :deep(th.column-anchor-other) {
  background: #eef5ff;
}

.cost-bom-detail-page :deep(th.column-anchor-srm) {
  background: #f5f7fa;
}

.cost-bom-detail-page :deep(th.column-anchor-basic),
.cost-bom-detail-page :deep(th.column-anchor-bom-extra),
.cost-bom-detail-page :deep(th.column-anchor-quantity),
.cost-bom-detail-page :deep(th.column-anchor-variant-target),
.cost-bom-detail-page :deep(th.column-anchor-variant-current-yes),
.cost-bom-detail-page :deep(th.column-anchor-variant-freight),
.cost-bom-detail-page :deep(th.column-anchor-initial-eval),
.cost-bom-detail-page :deep(th.column-anchor-srm) {
  background-color: #f5f7fa !important;
}

.cost-bom-detail-page :deep(th.column-anchor-classify),
.cost-bom-detail-page :deep(th.column-anchor-division),
.cost-bom-detail-page :deep(th.column-anchor-target),
.cost-bom-detail-page :deep(th.column-anchor-meeting),
.cost-bom-detail-page :deep(th.column-anchor-current-cost),
.cost-bom-detail-page :deep(th.column-anchor-variant-current-no),
.cost-bom-detail-page :deep(th.column-anchor-variant-package),
.cost-bom-detail-page :deep(th.column-anchor-other) {
  background-color: #eef5ff !important;
}

.cost-bom-detail-page__supplier {
 min-height: 220px;
}

.cost-bom-detail-page__supplier-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 12px;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
}

.cost-bom-detail-page__supplier-summary strong {
  color: var(--bq-color-text);
  font-weight: 600;
}

.cost-bom-detail-page__pattern-header-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.cost-bom-detail-page__pattern-header-item small {
  grid-column: 1 / -1;
  color: var(--bq-color-text-muted);
}

.cost-bom-detail-page__copy-valve {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cost-bom-detail-page__copy-valve-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px minmax(0, 1fr);
  gap: 14px;
  align-items: end;
  padding: 18px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
}

.cost-bom-detail-page__copy-valve-fields :deep(.el-form-item) {
  margin-bottom: 0;
}

.cost-bom-detail-page__copy-valve-arrow {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bq-color-primary);
  font-size: 24px;
}

.cost-bom-detail-page__copy-valve-tips {
  padding: 18px 22px;
  border-radius: 8px;
  background: #f5f7fa;
  color: var(--bq-color-text-secondary);
  line-height: 1.8;
}

.cost-bom-detail-page__copy-valve-tips strong {
  display: block;
  margin-bottom: 8px;
  color: var(--bq-color-text);
}

.cost-bom-detail-page__copy-valve-tips p {
  margin: 0;
}

@media (max-width: 1200px) {
  .cost-bom-detail-page__condition {
    grid-template-columns: repeat(2, minmax(0, 1fr)) 44px;
  }

  .cost-bom-detail-page__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
