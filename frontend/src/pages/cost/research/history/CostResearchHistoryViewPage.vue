<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
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
  deleteCostBomPart,
  fetchCostBomFilterFields,
  fetchCostBomPartMetadata,
  fetchCostBomParts,
  fetchSupplyRatiosByPart,
  submitCostBomVersion,
} from "@/api/cost-center";
import { fetchBusinessValveOptions } from "@/api/project";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseColumnSettings from "@/components/base/BaseColumnSettings.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { useAuthStore } from "@/stores/auth";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import {
  buildCostBomExportFileName,
  formatCostBomVersion,
} from "@/utils/cost-bom-export";
import { isDateFilterField } from "@/utils/date-filter-field";
import { formatCostDataSource } from "@/utils/cost-data-source";
import type { CostBomPartItem, SupplyRatioPart } from "@/types/cost-center";
import type { BusinessValveItem } from "@/types/project";

type DetailLogic = "AND" | "OR";
type DetailOperator =
  | ""
  | "eq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isNull"
  | "isNotNull"
  | "like";
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
  eq: "等于",
  gt: "大于",
  gte: "大于等于",
  lt: "小于",
  lte: "小于等于",
  isNull: "为空",
  isNotNull: "不为空",
  like: "包含",
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
const authStore = useAuthStore();
function hasColumnPermission(group: string): boolean {
  return authStore.hasPermission(`system:bom:${group}`);
}
const { openConfirm } = useBaseConfirmDialog();

const projectId = computed(() => Number(route.query.projectId));
const versionId = computed(() =>
  Number(route.query.bomVersionId || route.query.versionId),
);
const versionNo = computed(() => String(route.query.version ?? ""));
const vehicleModelId = computed(() => Number(route.query.vehicleModelId || 0));
const valveId = computed(() => Number(route.query.valveId || 0));
const isLocked = computed(() => {
  const status = String(route.query.lockStatus || "").toUpperCase();
  return status === "LOCKED" || status === "1" || status === "TRUE";
});

const viewPagePermissionPrefix = "costmanage:check";

const pageTitle = "成本履历查看";

const listPath = computed(() => "/cost/research/history");

const routeBase = computed(
  () =>
    route.path.replace(/\/detail$/, "") ||
    String(route.meta.breadcrumbParentPath ?? "/cost/research/history"),
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
  projectName: route.query.projectName
    ? String(route.query.projectName)
    : undefined,
  vehicleModelName: route.query.vehicleModelName
    ? String(route.query.vehicleModelName)
    : undefined,
  valveName: route.query.valveName ? String(route.query.valveName) : undefined,
  lockStatus: route.query.lockStatus
    ? String(route.query.lockStatus)
    : undefined,
  returnPath: route.fullPath,
}));

const loading = ref(false);
let detailRequestId = 0;
const deleting = ref(false);
const savingVersion = ref(false);
const deleteConfirmVisible = ref(false);
const saveVersionConfirmVisible = ref(false);
const detailParts = ref<CostBomPartItem[]>([]);
const patternHeaders = ref<Array<{ patternName: string; reorganizeName?: string | null; reorganizePartCount?: number | null; reorganizeSyncTime?: string | null }>>([]);
const selectedParts = ref<CostBomPartItem[]>([]);
const columnTarget = ref("target:pattern");
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
const currentPartNo = ref("");
const supplyRatio = ref<SupplyRatioPart | null>(null);
const pageNo = ref(1);
const pageSize = ref(10);
const showSummaryRow = ref(true);
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

const summaryProjectName = computed(
  () =>
    String(route.query.projectName || route.query.vehicleModelName || "") ||
    "--",
);
const summaryFactoryCode = computed(
  () =>
    String(
      route.query.factoryCode ||
        detailParts.value.find((part) => String(part.factoryCode ?? "").trim())
          ?.factoryCode ||
        "",
    ) || "--",
);
const summaryVersionLabel = computed(() =>
  formatCostBomVersion(versionNo.value),
);
const summaryValveName = computed(() =>
  route.query.valveName ? String(route.query.valveName) : "",
);

function resolveExportFileName() {
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
    label: "初始评估值",
    value: "initialEvaluationValue",
    groupName: "初始评估值",
    dataType: "MONEY",
  },
  {
    label: "评估值",
    value: "estimatedCostAmount",
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
  { label: "分类", value: "category" },
  { label: "BOM补充信息", value: "supplement" },
  { label: "分工", value: "division" },
  { label: "单车用量", value: "usage" },
  { label: "目标值", value: "target" },
  { label: "初始评估值", value: "first:price" },
  { label: "评估值", value: "assess" },
  { label: "轮次报价", value: "round" },
  { label: "上会价", value: "meet" },
  { label: "SRM价格", value: "srm" },
  { label: "当前成本", value: "current" },
  { label: "各版型目标成本统计（不含摊销）", value: "target:pattern" },
  { label: "各版型当前成本统计（不含摊销）", value: "current:pattern" },
  { label: "各版型当前成本统计（含摊销）", value: "current:amortize:pattern" },
  { label: "各版型包装费统计", value: "assess:pack" },
  { label: "各版型物流费统计", value: "assess:logi" },
  { label: "其他", value: "version" },
];

type ColumnSettingChild = {
  key: string;
  label: string;
  children?: ColumnSettingChild[];
};

const staticColumnSettingChildrenMap: Record<string, ColumnSettingChild[]> = {
  basic: [
    { key: buildColumnChildKey("basic", "col-1"), label: "零件号" },
    { key: buildColumnChildKey("basic", "col-2"), label: "零件名称" },
    { key: buildColumnChildKey("basic", "col-3"), label: "SOR号" },
    { key: buildColumnChildKey("basic", "col-4"), label: "SOR名称" },
    { key: buildColumnChildKey("basic", "col-5"), label: "ECR号" },
    { key: buildColumnChildKey("basic", "col-6"), label: "ECR名称" },
    { key: buildColumnChildKey("basic", "col-7"), label: "IA号" },
    { key: buildColumnChildKey("basic", "col-8"), label: "IA名称" },
    { key: buildColumnChildKey("basic", "col-9"), label: "装配级别" },
    {
      key: buildColumnChildKey("basic", "col-10"),
      label: "零部件关键技术状态描述",
    },
    { key: buildColumnChildKey("basic", "col-11"), label: "单位" },
    { key: buildColumnChildKey("basic", "col-12"), label: "模块标识" },
    { key: buildColumnChildKey("basic", "col-13"), label: "首用车型" },
    { key: buildColumnChildKey("basic", "col-14"), label: "配额(SRM)" },
    { key: buildColumnChildKey("basic", "col-15"), label: "供应商名称" },
  ],
  category: [
    { key: buildColumnChildKey("category", "col-1"), label: "通用化级别" },
    { key: buildColumnChildKey("category", "col-2"), label: "是否架构件" },
  ],
  supplement: [
    { key: buildColumnChildKey("supplement", "col-1"), label: "建议货源" },
    { key: buildColumnChildKey("supplement", "col-2"), label: "货源描述" },
    { key: buildColumnChildKey("supplement", "col-3"), label: "结构货源" },
    { key: buildColumnChildKey("supplement", "col-4"), label: "结构货源描述" },
  ],
  division: [
    { key: buildColumnChildKey("division", "col-1"), label: "研发专业部门" },
    { key: buildColumnChildKey("division", "col-2"), label: "专业工程师" },
    { key: buildColumnChildKey("division", "col-3"), label: "零件属性" },
    { key: buildColumnChildKey("division", "col-4"), label: "成本专业科室" },
    { key: buildColumnChildKey("division", "col-5"), label: "成本二级分类" },
    { key: buildColumnChildKey("division", "col-6"), label: "成本三级分类" },
    { key: buildColumnChildKey("division", "col-7"), label: "成本工程师" },
    { key: buildColumnChildKey("division", "col-8"), label: "采购工程师" },
  ],
  target: [
    { key: buildColumnChildKey("target", "col-1"), label: "目标值" },
    { key: buildColumnChildKey("target", "col-2"), label: "备注" },
  ],
  "first:price": [
    { key: buildColumnChildKey("first:price", "col-1"), label: "初始评估值" },
  ],
  assess: [
    { key: buildColumnChildKey("assess", "col-1"), label: "评估值" },
    { key: buildColumnChildKey("assess", "col-2"), label: "出厂价" },
    { key: buildColumnChildKey("assess", "col-3"), label: "包装费" },
    { key: buildColumnChildKey("assess", "col-4"), label: "物流费" },
    { key: buildColumnChildKey("assess", "col-5"), label: "数据来源" },
  ],
  round: [
    { key: buildColumnChildKey("round", "col-1"), label: "询报价轮次" },
    { key: buildColumnChildKey("round", "col-2"), label: "供应商名称" },
    { key: buildColumnChildKey("round", "col-3"), label: "出厂价" },
    { key: buildColumnChildKey("round", "col-4"), label: "包装" },
    { key: buildColumnChildKey("round", "col-5"), label: "物流" },
  ],
  meet: [
    {
      key: buildColumnChildKey("meet", "col-1"),
      label: "当前上会最新单号(采购)",
    },
    {
      key: buildColumnChildKey("meet", "col-2"),
      label: "议题类型(采购)",
    },
    {
      key: buildColumnChildKey("meet", "col-3"),
      label: "采购专业(采购)",
    },
    {
      key: buildColumnChildKey("meet", "col-4"),
      label: "采购工程师(采购)",
    },
    {
      key: buildColumnChildKey("meet", "col-5"),
      label: "供应商编码(采购)",
    },
    {
      key: buildColumnChildKey("meet", "col-6"),
      label: "供应商(采购)",
    },
    {
      key: buildColumnChildKey("meet", "col-7"),
      label: "定点会次(采购)",
    },
    { key: buildColumnChildKey("meet", "col-8"), label: "出厂价" },
    { key: buildColumnChildKey("meet", "col-9"), label: "包装费" },
    { key: buildColumnChildKey("meet", "col-10"), label: "物流费" },
    {
      key: buildColumnChildKey("meet", "col-11"),
      label: "不含摊销价",
    },
    {
      key: buildColumnChildKey("meet", "col-12"),
      label: "工装模具摊销",
    },
    {
      key: buildColumnChildKey("meet", "col-13"),
      label: "设计开发摊销",
    },
    { key: buildColumnChildKey("meet", "col-14"), label: "入厂价" },
    {
      key: buildColumnChildKey("meet", "col-15"),
      label: "摊销工装模具费(元/不含税)",
    },
    {
      key: buildColumnChildKey("meet", "col-16"),
      label: "单独支付工装模具费(元/不含税)",
    },
    {
      key: buildColumnChildKey("meet", "col-17"),
      label: "摊销设计开发费(元/不含税)",
    },
    {
      key: buildColumnChildKey("meet", "col-18"),
      label: "单独支付设计开发费(元/不含税)",
    },
    {
      key: buildColumnChildKey("meet", "col-19"),
      label: "摊销基数(个)",
    },
    {
      key: buildColumnChildKey("meet", "col-20"),
      label: "配额(采购)",
    },
    { key: buildColumnChildKey("meet", "col-21"), label: "商务降本" },
    { key: buildColumnChildKey("meet", "col-22"), label: "备注" },
  ],
  srm: [
    {
      key: buildColumnChildKey("srm", "col-1"),
      label: "SRM价格（含摊销）",
    },
    {
      key: buildColumnChildKey("srm", "col-2"),
      label: "SRM价格(配额加权-含摊销）",
    },
    {
      key: buildColumnChildKey("srm", "col-3"),
      label: "SRM价格（不含摊销）",
    },
    {
      key: buildColumnChildKey("srm", "col-4"),
      label: "SRM价格(配额加权-不含摊销）",
    },
    {
      key: buildColumnChildKey("srm", "col-5"),
      label: "工装模具-摊销数量",
    },
    {
      key: buildColumnChildKey("srm", "col-6"),
      label: "技术开发-摊销数量",
    },
    { key: buildColumnChildKey("srm", "col-7"), label: "包装费" },
    { key: buildColumnChildKey("srm", "col-8"), label: "物流费" },
    { key: buildColumnChildKey("srm", "col-9"), label: "数据来源" },
  ],
  current: [
    {
      key: buildColumnChildKey("current", "col-1"),
      label: "材料成本（含摊销）",
    },
    {
      key: buildColumnChildKey("current", "col-2"),
      label: "材料成本（不含摊销）",
    },
    {
      key: buildColumnChildKey("current", "col-3"),
      label: "工装模具-摊销数量",
    },
    {
      key: buildColumnChildKey("current", "col-4"),
      label: "技术开发-摊销数量",
    },
    { key: buildColumnChildKey("current", "col-5"), label: "包装费" },
    { key: buildColumnChildKey("current", "col-6"), label: "物流费" },
    { key: buildColumnChildKey("current", "col-7"), label: "数据来源" },
    { key: buildColumnChildKey("current", "col-8"), label: "摊销金额" },
    { key: buildColumnChildKey("current", "col-9"), label: "备注" },
  ],
  version: [
    { key: buildColumnChildKey("version", "col-1"), label: "当前版本" },
    { key: buildColumnChildKey("version", "col-2"), label: "创建人" },
    { key: buildColumnChildKey("version", "col-3"), label: "创建时间" },
    { key: buildColumnChildKey("version", "col-4"), label: "更新人" },
    { key: buildColumnChildKey("version", "col-5"), label: "更新时间" },
  ],
};
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

const groupedPatternHeaders = computed(() => {
  const groups = new Map<string, typeof patternHeaders.value>();
  patternHeaders.value.forEach((header) => {
    const name = String(header.patternName || "").trim();
    if (!name) return;
    groups.set(name, [...(groups.get(name) || []), header]);
  });
  return Array.from(groups, ([patternName, children]) => ({ patternName, children }));
});

function patternHeaderGroup(patternName: string) {
  return groupedPatternHeaders.value.find((group) => group.patternName === patternName);
}

function formatPatternSyncTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const resolvedVariantPatternNames = computed(() => {
  const names = detailParts.value.flatMap((part) =>
    (part.costBomPattern || part.patterns || [])
      .map((pattern) => String(pattern.patternName || "").trim())
      .filter((patternName) => patternName),
  );
  const uniqueNames = Array.from(new Set(names));
  return uniqueNames.length ? uniqueNames : ["单车用量"];
});

function resolvedFilterFields() {
  return filterFields.value.length ? filterFields.value : fallbackFilterFields;
}

function fieldsForModule(moduleName: string) {
  return moduleName ? dynamicGroupAttrMap.value[moduleName] || [] : [];
}

function operatorsForCondition(
  condition: DetailCondition,
): DetailOperatorOption[] {
  const field = resolvedFilterFields().find(
    (item) => item.value === condition.attributeName,
  );
  const configuredOperators =
    filterOperatorConfig.value[field?.fieldType || field?.dataType || "string"];
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
    const response = (
      responseValue &&
      typeof responseValue === "object" &&
      !Array.isArray(responseValue)
        ? responseValue
        : {}
    ) as Record<string, unknown>;
    const nestedValue = response.data;
    const nestedResponse = (
      nestedValue &&
      typeof nestedValue === "object" &&
      !Array.isArray(nestedValue)
        ? nestedValue
        : {}
    ) as Record<string, unknown>;
    filterOperatorConfig.value = (response.operatorConfig ??
      nestedResponse.operatorConfig ??
      {}) as Record<string, unknown>;
    const rowsValue = Array.isArray(responseValue)
      ? responseValue
      : (response.rows ??
        (Array.isArray(nestedValue) ? nestedValue : nestedResponse.rows));
    const rows = Array.isArray(rowsValue) ? rowsValue : [];
    const groupMap: Record<string, DetailFieldOption[]> = {};
    rows.forEach((rowValue) => {
      const row = (rowValue || {}) as Record<string, unknown>;
      const boardName = String(row.boardName || "").trim();
      if (!boardName) return;
      if (!groupMap[boardName]) groupMap[boardName] = [];
      const field = String(row.field || "");
      const fieldType = String(row.fieldType || "TEXT");
      groupMap[boardName].push({
        label: String(row.attrName || ""),
        value: field as DetailField,
        groupName: boardName,
        dataType: fieldType,
        field,
        fieldType,
        tableSource: String(row.tableSource || ""),
      });
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

async function loadPatternHeaders() {
  if (!versionId.value) return;
  try {
    const metadata = await fetchCostBomPartMetadata(projectId.value, versionId.value, { version: versionNo.value || undefined, skipErrorToast: true });
    patternHeaders.value = metadata.patternHeaders || [];
  } catch {
    patternHeaders.value = [];
  }
}

async function loadDetailParts() {
  const currentRequestId = ++detailRequestId;
  loading.value = true;
  try {
    const conditions = detailConditions.value
      .filter(
        (item) =>
          Boolean(item.attributeName) &&
          (nullOperators.has(item.operator) || item.value.trim()),
      )
      .map((item) => ({
        logic: item.logic,
        moduleName: item.moduleName || undefined,
        attributeName: item.attributeName,
        operator: item.operator,
        attributeValue: nullOperators.has(item.operator)
          ? ""
          : item.value.trim(),
      }));
    const page = await fetchCostBomParts(projectId.value, versionId.value, {
      pageNum: pageNo.value,
      pageSize: pageSize.value,
      version: versionNo.value || undefined,
      advancedConditions: conditions,
    });
    if (currentRequestId !== detailRequestId) return;
    // 有效筛选时隐藏汇总行，无筛选时在查询和分页后保留。
    detailParts.value = showSummaryRow.value
      ? page.records
      : page.records.filter((row) => !isSummaryRow(row));
    selectedParts.value = [];
    summary.total = page.total ?? 0;
  } finally {
    if (currentRequestId === detailRequestId) loading.value = false;
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
  showSummaryRow.value = true;
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
  showSummaryRow.value = !hasActiveDetailConditions();
  void loadDetailParts();
}

function hasActiveDetailConditions() {
  return detailConditions.value.some(
    (item) =>
      Boolean(item.attributeName) &&
      (nullOperators.has(item.operator) || item.value.trim()),
  );
}

function handlePageSizeChange(value: number) {
  pageSize.value = value;
  pageNo.value = 1;
  showSummaryRow.value = !hasActiveDetailConditions();
  void loadDetailParts();
}

function handlePageNoChange(value: number) {
  pageNo.value = value;
  showSummaryRow.value = !hasActiveDetailConditions();
  void loadDetailParts();
}

function handleSelectionChange(rows: CostBomPartItem[]) {
  selectedParts.value = rows;
}

function goBack() {
  router.replace(listPath.value);
}

function isSummaryRow(row?: CostBomPartItem | null): boolean {
  return !row?.partNumber?.trim();
}

function getDetailRowIndex(index: number): number | string {
  if (isSummaryRow(detailParts.value[index])) return "";
  const summaryOffset = isSummaryRow(detailParts.value[0]) ? 1 : 0;
  return (pageNo.value - 1) * pageSize.value + index + 1 - summaryOffset;
}

function goPartEditor(mode: "add" | "edit" | "copy", row?: CostBomPartItem) {
  if (isLocked.value) {
    return;
  }
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
      partId: String(row.partIdText ?? row.partId),
    },
  });
}

async function exportDetailParts() {
  const task = await createCostBomExport(projectId.value, {
    versionId: versionId.value,
    parts: selectedParts.value,
    format: "xlsx",
  });
  latestTaskId.value = task.taskId;
  latestTaskFileName.value = resolveExportFileName();
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

async function calculateDetailParts() {
  if (isLocked.value) {
    return;
  }
  const task = await createCostBomExtendCalculationTask(
    projectId.value,
    versionId.value,
    versionNo.value,
  );
  latestTaskId.value = task.taskId;
  BaseToast.success(`计算任务已创建：${task.taskNo || task.taskId}`);
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
  if (isLocked.value) {
    return;
  }
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
  if (isLocked.value) {
    return;
  }
  if (!copyValveForm.sourceValveId) {
    BaseToast.warning("请选择复制来源阀点。");
    return;
  }
  const sourceValveId = Number(copyValveForm.sourceValveId);
  const targetValveId = valveId.value;
  const sourceValve = valveOptions.value.find(
    (valve) => Number(valve.valveId) === sourceValveId,
  );
  const sourceLabel =
    sourceValve?.valveName || sourceValve?.valveCode || String(sourceValveId);

  try {
    await openConfirm({
      scene: "overwrite",
      object: "阀点零件",
      source: sourceLabel,
      target: currentValveLabel.value || String(targetValveId),
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
      `已复制 ${sourceLabel} 阀点数据到当前阀点 ${
        currentValveLabel.value || targetValveId
      }`,
    );
  } finally {
    copyValveLoading.value = false;
  }
  await loadDetailParts();
}

function openSaveVersionConfirm() {
  if (isLocked.value) {
    return;
  }
  if (!versionId.value) {
    BaseToast.warning("当前成本BOM缺少版本信息。");
    return;
  }
  saveVersionConfirmVisible.value = true;
}

async function confirmSaveCostBomVersion() {
  if (isLocked.value) {
    return;
  }
  savingVersion.value = true;
  try {
    const result = await submitCostBomVersion(
      projectId.value,
      versionId.value,
      {
        submitRemark: `${pageTitle}保存新版本`,
        version: versionNo.value,
      },
    );
    saveVersionConfirmVisible.value = false;
    BaseToast.success(`已保存新版本：V${result.versionNo}`);
  } finally {
    savingVersion.value = false;
  }
}

function openDeleteConfirm() {
  if (isLocked.value) {
    return;
  }
  if (selectedParts.value.length === 0) {
    BaseToast.warning("请选择需要删除的零件。");
    return;
  }
  deleteConfirmVisible.value = true;
}

async function deleteSelectedParts() {
  if (isLocked.value) {
    return;
  }
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
      partId: String(row.partIdText ?? row.partId),
      parentId: String(row.parentId ?? row.partIdText ?? row.partId),
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
      window.requestAnimationFrame(syncHeaderAndFooter);
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
      const ranges: Array<{
        cell: HTMLTableCellElement;
        start: number;
        end: number;
      }> = [];
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

    for (const {
      cell: topCell,
      start: topStart,
      end: topEnd,
    } of rowRanges[0] ?? []) {
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
  await scrollToColumn("target:pattern");
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

function formatUsage(row: CostBomPartItem, patternName: string) {
  const pattern = (row.costBomPattern || row.patterns || []).find(
    (item) => item.patternName === patternName,
  );
  if (pattern) {
    return formatText(pattern.usagePerVehicle);
  }
  return patternName === "单车用量" ? formatText(row.quantity) : "--";
}

function getPatternValue(
  row: CostBomPartItem,
  patternName: string,
  fieldName: string,
): string | number | null | undefined {
  const pattern = (row.costBomPattern || row.patterns || []).find(
    (item) => item.patternName === patternName,
  );
  return pattern
    ? ((pattern as Record<string, unknown>)[fieldName] as
        | string
        | number
        | null
        | undefined)
    : undefined;
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

watch(
  [projectId, versionId, () => route.query.refreshAt],
  async () => {
    await Promise.all([loadFilterMetadata(), loadPatternHeaders()]);
    await loadDetailParts();
  },
  { immediate: true },
);

const columnSettingOptions = computed(() =>
  columnAnchors.filter((item) => hasColumnPermission(item.value)).map((item) => ({
    key: item.value,
    label: item.label,
    children: getColumnSettingChildren(item.value),
  })),
);
const visibleColumnKeys = ref<string[]>([]);
const detailTableRef = ref<{ doLayout?: () => void }>();
const visibleColumnAnchors = computed(() =>
  columnAnchors.filter(
    (item) =>
      visibleColumnKeys.value.includes(item.value) &&
      hasColumnPermission(item.value),
  ),
);

function isColumnVisible(key: string) {
  return visibleColumnKeys.value.includes(key);
}

function getColumnSettingChildren(groupKey: string) {
  if (groupKey === "usage") {
    return resolvedUsagePatternNames.value.map((patternName) => ({
      key: buildColumnChildKey(groupKey, patternName),
      label: patternName,
    }));
  }

  if (groupKey.startsWith("variant-")) {
    return resolvedVariantPatternNames.value.map((patternName) => ({
      key: buildColumnChildKey(groupKey, patternName),
      label: patternName,
    }));
  }

  return staticColumnSettingChildrenMap[groupKey] ?? [];
}

function buildColumnChildKey(groupKey: string, childKey: string) {
  return `${groupKey}:${childKey}`;
}

function visibleColumnChildren(groupKey: string, children: string[]) {
  return children.filter((child) =>
    isColumnVisible(buildColumnChildKey(groupKey, child)),
  );
}

const columnSettingKeySnapshot = ref<string[]>([]);

watch(
  columnSettingOptions,
  (columns) => {
    const nextKeys = collectColumnSettingKeys(columns);
    if (!visibleColumnKeys.value.length) {
      visibleColumnKeys.value = nextKeys;
      columnSettingKeySnapshot.value = nextKeys;
      return;
    }

    const previousKeySet = new Set(columnSettingKeySnapshot.value);
    visibleColumnKeys.value = Array.from(
      new Set([
        ...visibleColumnKeys.value.filter((key) => nextKeys.includes(key)),
        ...nextKeys.filter((key) => !previousKeySet.has(key)),
      ]),
    );
    columnSettingKeySnapshot.value = nextKeys;
  },
  { immediate: true },
);

watch(
  visibleColumnKeys,
  async () => {
    await nextTick();
    detailTableRef.value?.doLayout?.();
    applyHeaderGroupColors();
  },
  { flush: "post" },
);

function collectColumnSettingKeys(
  columns: Array<{ key: string; children?: Array<{ key: string }> }>,
) {
  return columns.flatMap((column) => [
    column.key,
    ...(column.children?.map((child) => child.key) ?? []),
  ]);
}
</script>

<template>
  <PageContainer :title="pageTitle">
    <template #titleExtra>
      <span class="bq-page-inline-meta">
        项目代号：{{ summaryProjectName }} / 工厂代码：{{ summaryFactoryCode }} /
        版本：{{ summaryVersionLabel }} /
        阀点：{{ summaryValveName }}
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
            <div class="cost-bom-detail-page__condition-actions">
              <PermissionButton
                type="primary"
                :icon="Search"
                @click="searchDetailParts"
                >查询</PermissionButton
              >
              <PermissionButton :icon="Refresh" @click="resetDetailConditions"
                >重置</PermissionButton
              >
            </div>
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
            :disabled="isLocked"
            type="primary"
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
            :disabled="isLocked"
            :icon="Operation"
            @click="calculateDetailParts"
          >
            计算
          </PermissionButton>
          <PermissionButton
            permission="costmanage:check:pointreplication"
            :disabled="isLocked"
            :icon="CopyDocument"
            @click="openCopyValveDialog"
          >
            复制阀点
          </PermissionButton>
          <PermissionButton
            :permission="`${viewPagePermissionPrefix}:save`"
            :disabled="isLocked"
            :icon="CircleCheck"
            @click="openSaveVersionConfirm"
          >
            生成新版本
          </PermissionButton>
          <PermissionButton
            :permission="`${viewPagePermissionPrefix}:remove`"
            :disabled="isLocked"
            variant="danger"
            :icon="Delete"
            @click="openDeleteConfirm"
          >
            批量删除
          </PermissionButton>
        </div>
        <div class="cost-bom-detail-page__toolbar-right">
          <BaseColumnSettings
            v-model="visibleColumnKeys"
            :columns="columnSettingOptions"
          />
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
              v-for="item in visibleColumnAnchors"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <div class="page-container__fullscreen-target" />
        </div>
      </section>

      <TaskStatusPanel
        v-if="false"
        :task-id="latestTaskId"
        :download-file-name="latestTaskFileName"
      />

      <el-table
        ref="detailTableRef"
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
          :index="getDetailRowIndex"
          label="序号"
          width="64"
          fixed="left"
          align="center"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        />
        <el-table-column
          v-if="isColumnVisible(buildColumnChildKey('basic', 'col-1'))"
          prop="partNumber"
          label="零件号"
          min-width="150"
          fixed="left"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        >
          <template #default="{ row }">
            <span class="cost-bom-detail-page__part-number" @click="openSupplyRatio(row)">
              {{ isSummaryRow(row) ? "" : formatText(row.partNumber) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible(buildColumnChildKey('basic', 'col-2'))"
          prop="partName"
          label="零件名称"
          min-width="180"
          fixed="left"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        />
        <el-table-column
          v-if="isColumnVisible('basic')"
          label="基本信息"
          align="center"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-3'))"
            prop="sorNumber"
            label="SOR号"
            min-width="130"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-4'))"
            prop="sorName"
            label="SOR名称"
            min-width="130"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-5'))"
            prop="ecrNumber"
            label="ECR号"
            min-width="130"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-6'))"
            prop="ecrName"
            label="ECR名称"
            min-width="130"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-7'))"
            prop="iaNumber"
            label="IA号"
            min-width="100"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-8'))"
            prop="iaName"
            label="IA名称"
            min-width="100"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-9'))"
            prop="assemblyLevel"
            label="装配级别"
            width="75"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-10'))"
            prop="partTechDesc"
            label="零部件关键技术状态描述"
            min-width="100"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-11'))"
            prop="unitUsage"
            label="单位"
            min-width="60"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-12'))"
            prop="moduleIdentifier"
            label="模块标识"
            min-width="90"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-13'))"
            prop="firstVehicleModel"
            label="首用车型"
            min-width="90"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-14'))"
            prop="quotaSrm"
            label="配额(SRM)"
            min-width="90"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('basic', 'col-15'))"
            prop="supplierName"
            label="供应商名称"
            min-width="120"
          />
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('category')"
          label="分类"
          align="center"
          :label-class-name="anchorClass('category')"
          :class-name="anchorClass('category')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('category', 'col-1'))"
            prop="generalizationLevel"
            label="通用化级别"
            min-width="130"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('category', 'col-2'))"
            prop="architectureComponent"
            label="是否架构件"
            min-width="120"
          />
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('supplement')"
          label="BOM补充信息"
          align="center"
          :label-class-name="anchorClass('supplement')"
          :class-name="anchorClass('supplement')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('supplement', 'col-1'))"
            prop="suggestedSupplySource"
            label="建议货源"
            min-width="150"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('supplement', 'col-2'))"
            prop="sourceDescription"
            label="货源描述"
            min-width="170"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('supplement', 'col-3'))"
            prop="multiStructuredSupplySources"
            label="结构货源"
            min-width="150"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('supplement', 'col-4'))"
            prop="multiSourcesDescription"
            label="结构货源描述"
            min-width="170"
          />
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('division')"
          label="分工"
          align="center"
          :label-class-name="anchorClass('division')"
          :class-name="anchorClass('division')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('division', 'col-1'))"
            prop="developmentDepartment"
            label="研发专业部门"
            min-width="120"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('division', 'col-2'))"
            prop="expertEngineer"
            label="专业工程师"
            min-width="100"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('division', 'col-3'))"
            prop="partAttribute"
            label="零件属性"
            min-width="100"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('division', 'col-4'))"
            prop="costCategoryLevel2Name"
            label="成本专业科室"
            min-width="120"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('division', 'col-5'))"
            prop="costCategoryLevel2Name"
            label="成本二级分类"
            min-width="120"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('division', 'col-6'))"
            prop="costCategoryLevel3Name"
            label="成本三级分类"
            min-width="120"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('division', 'col-7'))"
            prop="costEngineerName"
            label="成本工程师"
            min-width="100"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('division', 'col-8'))"
            prop="procurementEngineerName"
            label="采购工程师"
            min-width="100"
          />
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('usage')"
          label="单车用量"
          align="center"
          :label-class-name="anchorClass('usage')"
          :class-name="anchorClass('usage')"
        >
          <el-table-column
            v-for="patternName in visibleColumnChildren(
              'usage',
              resolvedUsagePatternNames,
            )"
            :key="patternName"
            :label="patternName"
            min-width="120"
          >
            <template #header>
              <el-popover
                placement="top-start"
                  :width="280"
                trigger="hover"
                popper-class="cost-research-history-pattern-popper"
              >
                <div class="cost-research-history-pattern-popover">
                  <div class="cost-research-history-pattern-title">{{ patternName }}</div>
                  <div
                    v-for="(header, index) in patternHeaderGroup(patternName)?.children"
                    :key="`${patternName}-${index}`"
                    class="cost-research-history-pattern-item"
                  >
                    <span>{{ header.reorganizeName || "" }}</span>
                    <span>（{{ header.reorganizePartCount ?? 0 }}）</span>
                   <small>{{ formatPatternSyncTime(header.reorganizeSyncTime) }}</small>
                  </div>
                  <div v-if="!patternHeaderGroup(patternName)?.children?.length" class="cost-research-history-pattern-item">
                    <span>（0）</span>
                  </div>
                </div>
                <template #reference><span class="cost-research-history-pattern-reference">{{ patternName }}</span></template>
              </el-popover>
            </template>
            <template #default="{ row }">
              {{ formatUsage(row, patternName) }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('target')"
          label="目标值"
          align="center"
          :label-class-name="anchorClass('target')"
          :class-name="anchorClass('target')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('target', 'col-1'))"
            prop="targetValue"
            label="目标值"
            min-width="100"
            :label-class-name="anchorClass('target')"
          >
            <template #default="{ row }">
              {{ formatMoney(row.targetValue) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('target', 'col-2'))"
            prop="targetRemark"
            label="备注"
            min-width="120"
            :label-class-name="anchorClass('target')"
          />
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('first:price')"
          label="初始评估值"
          align="center"
          :label-class-name="anchorClass('first:price')"
          :class-name="anchorClass('first:price')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('first:price', 'col-1'))"
            prop="initialEvaluationValue"
            label="初始评估值"
            min-width="120"
          >
            <template #default="{ row }">
              {{ formatMoney(row.initialEvaluationValue) }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('assess')"
          label="评估值"
          align="center"
          :label-class-name="anchorClass('assess')"
          :class-name="anchorClass('assess')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('assess', 'col-1'))"
            prop="estimatedCostAmount"
            label="评估值"
            min-width="90"
          >
            <template #default="{ row }">
              {{ formatMoney(row.estimatedCostAmount) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('assess', 'col-2'))"
            prop="exFactoryPrice"
            label="出厂价"
            min-width="90"
          >
            <template #default="{ row }">
              {{ formatMoney(row.exFactoryPrice) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('assess', 'col-3'))"
            prop="packagingCost"
            label="包装费"
            min-width="90"
          >
            <template #default="{ row }">
              {{ formatMoney(row.packagingCost) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('assess', 'col-4'))"
            prop="logisticsCost"
            label="物流费"
            min-width="90"
          >
            <template #default="{ row }">
              {{ formatMoney(row.logisticsCost) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('assess', 'col-5'))"
            prop="assessDataSources"
            label="数据来源"
            min-width="90"
          />
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('round')"
          label="轮次报价"
          align="center"
          :label-class-name="anchorClass('round')"
          :class-name="anchorClass('round')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('round', 'col-1'))"
            prop="bidRounds"
            label="询报价轮次"
            min-width="70"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('round', 'col-2'))"
            prop="roundsSupplierName"
            label="供应商名称"
            min-width="120"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('round', 'col-3'))"
            prop="roundsExfactoryPrice"
            label="出厂价"
            min-width="90"
          >
            <template #default="{ row }">
              {{ formatMoney(row.roundsExfactoryPrice) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('round', 'col-4'))"
            prop="roundsPackaging"
            label="包装"
            min-width="90"
          >
            <template #default="{ row }">
              {{ formatMoney(row.roundsPackaging) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('round', 'col-5'))"
            prop="roundsLogistics"
            label="物流"
            min-width="90"
          >
            <template #default="{ row }">
              {{ formatMoney(row.roundsLogistics) }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('meet')"
          label="上会价"
          align="center"
          :label-class-name="anchorClass('meet')"
          :class-name="anchorClass('meet')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('meet', 'col-1'))"
            prop="meetingOrderNo"
            label="当前上会最新单号(采购)"
            min-width="200"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('meet', 'col-2'))"
            prop="topicType"
            label="议题类型(采购)"
            min-width="120"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('meet', 'col-3'))"
            prop="purchaseMajor"
            label="采购专业(采购)"
            min-width="120"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('meet', 'col-4'))"
            prop="purchaseEngineerName"
            label="采购工程师(采购)"
            min-width="120"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('meet', 'col-5'))"
            prop="supplierCode"
            label="供应商编码(采购)"
            min-width="140"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('meet', 'col-6'))"
            prop="supplierName"
            label="供应商(采购)"
            min-width="100"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('meet', 'col-7'))"
            prop="fixedMeetingTimes"
            label="定点会次(采购)"
            min-width="130"
          />
          <el-table-column
            label="定点成本(采购)"
            align="center"
            :label-class-name="anchorClass('meet')"
          >
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-8'))"
              prop="exFactoryPricePurchase"
              label="出厂价"
              min-width="90"
            >
              <template #default="{ row }">
                {{ formatMoney(row.exFactoryPricePurchase) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-9'))"
              prop="packingFeePurchase"
              label="包装费"
              min-width="90"
            >
              <template #default="{ row }">
                {{ formatMoney(row.packingFeePurchase) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-10'))"
              prop="logisticsFeePurchase"
              label="物流费"
              min-width="90"
            >
              <template #default="{ row }">
                {{ formatMoney(row.logisticsFeePurchase) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-11'))"
              prop="noAmortizationPrice"
              label="不含摊销价"
              min-width="100"
            >
              <template #default="{ row }">
                {{ formatMoney(row.noAmortizationPrice) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-12'))"
              prop="toolingAmortizationFee"
              label="工装模具摊销"
              min-width="120"
            >
              <template #default="{ row }">
                {{ formatMoney(row.toolingAmortizationFee) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-13'))"
              prop="techDevAmortizationFee"
              label="设计开发摊销"
              min-width="120"
            >
              <template #default="{ row }">
                {{ formatMoney(row.techDevAmortizationFee) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-14'))"
              prop="factoryUnitPrice"
              label="入厂价"
              min-width="90"
            >
              <template #default="{ row }">
                {{ formatMoney(row.factoryUnitPrice) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-15'))"
              prop="amortizationToolingUnitPrice"
              label="摊销工装模具费(元/不含税)"
              min-width="200"
            >
              <template #default="{ row }">
                {{ formatMoney(row.amortizationToolingUnitPrice) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-16'))"
              prop="paymentToolingOnceFee"
              label="单独支付工装模具费(元/不含税)"
              min-width="220"
            >
              <template #default="{ row }">
                {{ formatMoney(row.paymentToolingOnceFee) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-17'))"
              prop="amortizationDevUnitPrice"
              label="摊销设计开发费(元/不含税)"
              min-width="220"
            >
              <template #default="{ row }">
                {{ formatMoney(row.amortizationDevUnitPrice) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-18'))"
              prop="paymentDevOnceFee"
              label="单独支付设计开发费(元/不含税)"
              min-width="220"
            >
              <template #default="{ row }">
                {{ formatMoney(row.paymentDevOnceFee) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible(buildColumnChildKey('meet', 'col-19'))"
              prop="amortizationBaseCount"
              label="摊销基数(个)"
              min-width="120"
            >
              <template #default="{ row }">
                {{ formatText(row.amortizationBaseCount) }}
              </template>
            </el-table-column>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('meet', 'col-20'))"
            prop="supplierRatio"
            label="配额(采购)"
            min-width="90"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('meet', 'col-21'))"
            prop="businessPriceRemark"
            label="商务降本"
            min-width="90"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('meet', 'col-22'))"
            prop="mettRemark"
            label="备注"
            min-width="120"
          />
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('srm')"
          label="SRM价格"
          align="center"
          :label-class-name="anchorClass('srm')"
          :class-name="anchorClass('srm')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('srm', 'col-1'))"
            prop="amortizePrice"
            label="SRM价格（含摊销）"
            min-width="160"
          >
            <template #default="{ row }">
              {{ formatMoney(row.amortizePrice) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('srm', 'col-2'))"
            prop="amortizeWeightedCost"
            label="SRM价格(配额加权-含摊销）"
            min-width="220"
          >
            <template #default="{ row }">
              {{ formatMoney(row.amortizeWeightedCost) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('srm', 'col-3'))"
            prop="noAmortizePrice"
            label="SRM价格（不含摊销）"
            min-width="180"
          >
            <template #default="{ row }">
              {{ formatMoney(row.noAmortizePrice) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('srm', 'col-4'))"
            prop="noAmortizeWeightedCost"
            label="SRM价格(配额加权-不含摊销）"
            min-width="220"
          >
            <template #default="{ row }">
              {{ formatMoney(row.noAmortizeWeightedCost) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('srm', 'col-5'))"
            prop="toolingAmortizationQuantity"
            label="工装模具-摊销数量"
            min-width="140"
          >
            <template #default="{ row }">
              {{ formatText(row.toolingAmortizationQuantity) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('srm', 'col-6'))"
            prop="techDevAmortizationQuantity"
            label="技术开发-摊销数量"
            min-width="140"
          >
            <template #default="{ row }">
              {{ formatText(row.techDevAmortizationQuantity) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('srm', 'col-7'))"
            prop="wrapCost"
            label="包装费"
            min-width="80"
          >
            <template #default="{ row }">
              {{ formatMoney(row.wrapCost) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('srm', 'col-8'))"
            prop="freightCost"
            label="物流费"
            min-width="80"
          >
            <template #default="{ row }">
              {{ formatMoney(row.freightCost) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('srm', 'col-9'))"
            prop="dataSourceSrm"
            label="数据来源"
            min-width="90"
          />
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('current')"
          label="当前成本"
          align="center"
          :label-class-name="anchorClass('current')"
          :class-name="anchorClass('current')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('current', 'col-1'))"
            prop="materialCostWithAmortization"
            label="材料成本（含摊销）"
            min-width="160"
          >
            <template #default="{ row }">
              {{ formatMoney(row.materialCostWithAmortization) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('current', 'col-2'))"
            prop="materialCostWithoutAmortization"
            label="材料成本（不含摊销）"
            min-width="180"
          >
            <template #default="{ row }">
              {{ formatMoney(row.materialCostWithoutAmortization) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('current', 'col-3'))"
            prop="summaryToolingAmortizationQuantity"
            label="工装模具-摊销数量"
            min-width="140"
          >
            <template #default="{ row }">
              {{ formatText(row.summaryToolingAmortizationQuantity) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('current', 'col-4'))"
            prop="summaryTechDevAmortizationQuantity"
            label="技术开发-摊销数量"
            min-width="140"
          >
            <template #default="{ row }">
              {{ formatText(row.summaryTechDevAmortizationQuantity) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('current', 'col-5'))"
            prop="summaryWrapCost"
            label="包装费"
            min-width="80"
          >
            <template #default="{ row }">
              {{ formatMoney(row.summaryWrapCost) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('current', 'col-6'))"
            prop="summaryFreightCost"
            label="物流费"
            min-width="80"
          >
            <template #default="{ row }">
              {{ formatMoney(row.summaryFreightCost) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('current', 'col-7'))"
            prop="summaryDataSource"
            label="数据来源"
            min-width="100"
          >
            <template #default="{ row }">
              {{ formatCostDataSource(row.summaryDataSource) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('current', 'col-8'))"
            prop="amortizationAmount"
            label="摊销金额"
            min-width="90"
          >
            <template #default="{ row }">
              {{ formatMoney(row.amortizationAmount) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('current', 'col-9'))"
            prop="summaryRemark"
            label="备注"
            min-width="120"
          />
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('target:pattern')"
          label="各版型目标成本统计（不含摊销）"
          align="center"
          :label-class-name="anchorClass('target:pattern')"
          :class-name="anchorClass('target:pattern')"
          min-width="260"
        >
          <el-table-column
            v-for="patternName in visibleColumnChildren(
              'target:pattern',
              resolvedVariantPatternNames,
            )"
            :key="'target-' + patternName"
            :label="patternName"
            min-width="100"
          >
            <template #default="{ row }">
              {{ formatMoney(getPatternValue(row, patternName, "targetCost")) }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('current:pattern')"
          label="各版型当前成本统计（不含摊销）"
          align="center"
          :label-class-name="anchorClass('current:pattern')"
          :class-name="anchorClass('current:pattern')"
          min-width="260"
        >
          <el-table-column
            v-for="patternName in visibleColumnChildren(
              'current:pattern',
              resolvedVariantPatternNames,
            )"
            :key="'current-no-' + patternName"
            :label="patternName"
            min-width="100"
          >
            <template #default="{ row }">
              {{
                formatMoney(getPatternValue(row, patternName, "currentCost"))
              }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('current:amortize:pattern')"
          label="各版型当前成本统计（含摊销）"
          align="center"
          :label-class-name="anchorClass('current:amortize:pattern')"
          :class-name="anchorClass('current:amortize:pattern')"
          min-width="260"
        >
          <el-table-column
            v-for="patternName in visibleColumnChildren(
              'current:amortize:pattern',
              resolvedVariantPatternNames,
            )"
            :key="'current-yes-' + patternName"
            :label="patternName"
            min-width="100"
          >
            <template #default="{ row }">
              {{
                formatMoney(
                  getPatternValue(row, patternName, "currentCostAmortize"),
                )
              }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('assess:pack')"
          label="各版型当前成本包装费统计"
          align="center"
          :label-class-name="anchorClass('assess:pack')"
          :class-name="anchorClass('assess:pack')"
          min-width="260"
        >
          <el-table-column
            v-for="patternName in visibleColumnChildren(
              'assess:pack',
              resolvedVariantPatternNames,
            )"
            :key="'package-' + patternName"
            :label="patternName"
            min-width="100"
          >
            <template #default="{ row }">
              {{
                formatMoney(
                  getPatternValue(row, patternName, "currentPackageCost"),
                )
              }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('assess:logi')"
          label="各版型当前成本物流费统计"
          align="center"
          :label-class-name="anchorClass('assess:logi')"
          :class-name="anchorClass('assess:logi')"
          min-width="260"
        >
          <el-table-column
            v-for="patternName in visibleColumnChildren(
              'assess:logi',
              resolvedVariantPatternNames,
            )"
            :key="'freight-' + patternName"
            :label="patternName"
            min-width="100"
          >
            <template #default="{ row }">
              {{
                formatMoney(
                  getPatternValue(row, patternName, "currentFreightCost"),
                )
              }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="isColumnVisible('version')"
          label="其他"
          align="center"
          :label-class-name="anchorClass('version')"
          :class-name="anchorClass('version')"
        >
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('version', 'col-1'))"
            prop="partVersion"
            label="当前版本"
            min-width="80"
          >
            <template #default="{ row }">
              <span v-if="row.partVersion">V{{ row.partVersion }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('version', 'col-2'))"
            prop="createName"
            label="创建人"
            min-width="100"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('version', 'col-3'))"
            prop="createTime"
            label="创建时间"
            min-width="140"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('version', 'col-4'))"
            prop="updateBy"
            label="更新人"
            min-width="100"
          />
          <el-table-column
            v-if="isColumnVisible(buildColumnChildKey('version', 'col-5'))"
            prop="updateTime"
            label="更新时间"
            min-width="140"
          />
        </el-table-column>

        <el-table-column label="操作" width="210" fixed="right" align="center">
          <template #default="{ row }">
            <PermissionButton
              :permission="`${viewPagePermissionPrefix}:edit`"
              :disabled="isLocked"
              link
              @click="goPartEditor('edit', row)"
            >
              编辑
            </PermissionButton>
            <PermissionButton
              :permission="`${viewPagePermissionPrefix}:historical`"
              link
              @click="openPartHistory(row)"
            >
              历史版本
            </PermissionButton>
            <PermissionButton
                permission="costmanage:check:copy"
              link
              :disabled="isLocked || isSummaryRow(row)"
              @click="goPartEditor('copy', row)"
            >
              复制
            </PermissionButton>
          </template>
        </el-table-column>
      </el-table>

      <div class="cost-bom-detail-page__pagination">
        <el-pagination
          v-model:current-page="pageNo"
          v-model:page-size="pageSize"
          :total="summary.total"
          :page-sizes="[10, 20, 30, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @current-change="handlePageNoChange"
        />
      </div>

      <BaseFormDialog
        v-model="supplierDialogVisible"
        title="供应商配额信息"
        width="900px"
        confirm-text="关闭"
        cancel-text=""
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
        <template #footer>
          <PermissionButton variant="secondary" @click="supplierDialogVisible = false">
            关闭
          </PermissionButton>
        </template>
      </BaseFormDialog>

      <BaseFormDialog
        v-model="copyValveDialogVisible"
        title="阀点复制"
        width="640px"
      >
        <div class="cost-bom-detail-page__copy-valve">
          <div class="cost-bom-detail-page__copy-valve-fields">
            <el-form-item label="源阀点（复制来源）" required>
              <el-select
                v-model="copyValveForm.sourceValveId"
                placeholder="请选择"
                :loading="valveOptionsLoading"
              >
                <el-option
                  v-for="valve in sourceValveOptions"
                  :key="valve.valveId"
                  :label="valve.valveName || valve.valveCode"
                  :value="String(valve.valveId)"
                />
              </el-select>
            </el-form-item>
            <span
              class="cost-bom-detail-page__copy-valve-arrow"
              aria-hidden="true"
              >→</span
            >
            <el-form-item label="目标阀点（当前）">
              <el-input :model-value="currentValveLabel" disabled />
            </el-form-item>
          </div>
          <div class="cost-bom-detail-page__copy-valve-tips">
            <strong>操作说明</strong>
            <p>1. 选择要复制数据的源阀点</p>
            <p>2. 系统将匹配源阀点与当前阀点的零件信息</p>
            <p>3. 复制完成后，数据将覆盖当前阀点的对应零件信息</p>
          </div>
        </div>
        <template #footer>
          <PermissionButton variant="secondary" @click="copyValveDialogVisible = false">
            取消
          </PermissionButton>
          <PermissionButton
            variant="primary"
            :loading="copyValveLoading"
            type="primary"
            @click="confirmCopyValveData"
          >
            确认复制
          </PermissionButton>
        </template>
      </BaseFormDialog>

      <BaseConfirm
        v-model="deleteConfirmVisible"
        title="批量删除确认"
        message="确定要删除选中的零件吗？"
        type="danger"
        @confirm="deleteSelectedParts"
      />

      <BaseConfirm
        v-model="saveVersionConfirmVisible"
        title="保存新版本确认"
        message="确定要保存当前版本为新版本吗？"
        type="warning"
        @confirm="confirmSaveCostBomVersion"
      />
    </div>
  </PageContainer>
</template>

<style scoped>
.cost-bom-detail-page {
  min-width: 0;
  container-type: inline-size;
  min-height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) - 96px
  );
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.cost-bom-detail-page__part-number {
  color: var(--bq-color-primary);
  cursor: pointer;
}

.cost-bom-detail-page__summary,
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

.page-container__fullscreen-target {
  display: contents;
}

.cost-bom-detail-page__table {
  max-width: 100%;
  overflow: hidden;
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

.cost-bom-detail-page :deep(th.column-anchor-category) {
  background: #eef5ff;
}

.cost-bom-detail-page :deep(th.column-anchor-supplement) {
  background: #f5f7fa;
}

.cost-bom-detail-page :deep(th.column-anchor-division) {
  background: #eef5ff;
}

.cost-bom-detail-page :deep(th.column-anchor-usage),
.cost-bom-detail-page :deep(th.column-anchor-first\:price),
.cost-bom-detail-page :deep(th.column-anchor-round),
.cost-bom-detail-page :deep(th.column-anchor-srm),
.cost-bom-detail-page :deep(th.column-anchor-target\:pattern),
.cost-bom-detail-page :deep(th.column-anchor-current\:amortize\:pattern),
.cost-bom-detail-page :deep(th.column-anchor-assess\:logi) {
  background: #f5f7fa;
}

.cost-bom-detail-page :deep(th.column-anchor-target),
.cost-bom-detail-page :deep(th.column-anchor-assess),
.cost-bom-detail-page :deep(th.column-anchor-meet),
.cost-bom-detail-page :deep(th.column-anchor-current),
.cost-bom-detail-page :deep(th.column-anchor-current\:pattern),
.cost-bom-detail-page :deep(th.column-anchor-assess\:pack),
.cost-bom-detail-page :deep(th.column-anchor-version) {
  background: #eef5ff;
}

.cost-bom-detail-page :deep(th.column-anchor-basic),
.cost-bom-detail-page :deep(th.column-anchor-supplement),
.cost-bom-detail-page :deep(th.column-anchor-usage),
.cost-bom-detail-page :deep(th.column-anchor-first\:price),
.cost-bom-detail-page :deep(th.column-anchor-round),
.cost-bom-detail-page :deep(th.column-anchor-srm),
.cost-bom-detail-page :deep(th.column-anchor-target\:pattern),
.cost-bom-detail-page :deep(th.column-anchor-current\:amortize\:pattern),
.cost-bom-detail-page :deep(th.column-anchor-assess\:logi) {
  background-color: #f5f7fa !important;
}

.cost-bom-detail-page :deep(th.column-anchor-category),
.cost-bom-detail-page :deep(th.column-anchor-division),
.cost-bom-detail-page :deep(th.column-anchor-target),
.cost-bom-detail-page :deep(th.column-anchor-assess),
.cost-bom-detail-page :deep(th.column-anchor-meet),
.cost-bom-detail-page :deep(th.column-anchor-current),
.cost-bom-detail-page :deep(th.column-anchor-current\:pattern),
.cost-bom-detail-page :deep(th.column-anchor-assess\:pack),
.cost-bom-detail-page :deep(th.column-anchor-version) {
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

.cost-research-history__pattern-popover {
  min-width: 200px;
}
.cost-research-history__pattern-project {
  padding: 4px 0 18px;
  font-size: 14px;
}
.cost-research-history__pattern-popover-title {
  padding: 10px 12px;
  background: #82b9e5;
  font-weight: 500;
}
.cost-research-history__pattern-name {
  padding: 12px;
  border: 1px solid var(--bq-color-border-subtle);
  border-top: 0;
  font-size: 14px;
}
.cost-research-history__pattern-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}
.cost-research-history__pattern-item small {
  grid-column: 1 / -1;
  color: var(--bq-color-text-muted);
}
.cost-research-history__pattern-project { padding-bottom: 16px; color: #606266; font-size: 14px; }
.cost-research-history__pattern-popover-title { padding: 10px 12px; background: #82b9e5; font-weight: 500; }
.cost-research-history__pattern-name { padding: 12px; border: 1px solid var(--bq-color-border-subtle); border-top: 0; font-size: 14px; }
.cost-research-history__pattern-reference { cursor: help; }
.cost-research-history__pattern-empty {
  padding: 10px 0 2px;
  color: var(--bq-color-text-muted);
  text-align: center;
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

<style scoped>
.cost-research-history-pattern-popover { min-width: 240px; color: #606266; }
.cost-research-history-pattern-title { padding: 10px 12px; background: #82b9e5; font-weight: 600; }
.cost-research-history-pattern-item { display: grid; grid-template-columns: minmax(max-content, 1fr) 90px; gap: 4px 8px; padding: 9px 12px; border: 1px solid #dfe6ec; border-top: 0; font-size: 14px; }
.cost-research-history-pattern-item span:first-child { white-space: nowrap; }
.cost-research-history-pattern-item span:nth-child(2) { white-space: normal; overflow-wrap: anywhere; word-break: break-all; }

.cost-research-history-pattern-item small { grid-column: 1 / -1; color: #909399; }
.cost-research-history-pattern-reference { cursor: help; }
.cost-research-history-pattern-empty { padding: 12px; color: #909399; text-align: center; }
@container (max-width: 1000px) {
  .cost-bom-detail-page__condition,
  .cost-bom-detail-page__condition--first {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cost-bom-detail-page__condition-actions,
  .cost-bom-detail-page__condition-icon.is-add {
    justify-self: start;
  }

  .cost-bom-detail-page__condition--first
    .cost-bom-detail-page__condition-actions {
    grid-column: 2;
  }

  .cost-bom-detail-page__condition-actions .el-button {
    flex: 1 1 0;
  }

  .cost-bom-detail-page__toolbar {
    align-items: flex-start;
  }

  .cost-bom-detail-page__toolbar-left,
  .cost-bom-detail-page__toolbar-right {
    min-width: 0;
  }
}
</style>

<style scoped>
@container (max-width: 600px) {
  .cost-bom-detail-page__condition,
  .cost-bom-detail-page__condition--first {
    grid-template-columns: minmax(0, 1fr);
  }

  .cost-bom-detail-page__condition-actions {
    width: 100%;
    grid-column: 1;
  }

  .cost-bom-detail-page__toolbar-left,
  .cost-bom-detail-page__toolbar-right {
    width: 100%;
  }

  .cost-bom-detail-page__toolbar-right {
    justify-content: flex-start;
  }
}
</style>
