<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { replaceToReturn } from "@/utils/return-navigation";
import { Back, Download, Refresh, Select } from "@element-plus/icons-vue";
import Big from "big.js";
import {
  exportReviewTable,
  exportSorTable,
  getCompareList,
  getLatestEvaluationDataNew,
  projectPost,
  projectReviewNew,
  projectSor,
  reviewcommentsSvae,
} from "@/api/budget";
import { ApiBusinessError } from "@/api/http";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { useAuthStore } from "@/stores/auth";

type ReportTab = "review" | "group";
type ReportRow = Record<string, unknown>;
type ApiListPayload<T> = T[] | { data?: T[]; rows?: T[] };
type CompareOption = {
  id: string;
  label: string;
  raw: ReportRow;
};
type CompareShelf = {
  title: string;
  id: string;
  rows: ReportRow[];
};
type SpanResult = [number, number] | { rowspan: number; colspan: number };

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isFullScreen = ref(false);
const activeTab = ref<ReportTab>("review");
const activeTaskId = ref("");
const selectedCompareIds = ref<string[]>([]);
const compareOptions = ref<CompareOption[]>([]);
const reviewRows = ref<ReportRow[]>([]);
const reviewVersion = ref(0);
const groupRows = ref<ReportRow[]>([]);
const reviewCompareShelves = ref<CompareShelf[]>([]);
const groupCompareShelves = ref<CompareShelf[]>([]);
const loading = ref(false);
const syncing = ref(false);
const saving = ref(false);
const exporting = ref(false);
const latestExportTaskId = ref<string | number>();
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);

const tableHeight = computed(()=>{
  return isFullScreen.value?'calc(100vh - 180px)':'calc(100vh - 286px)'
});
const projectId = computed(() => String(route.query.id ?? ""));
const modelName = computed(() => String(route.query.modelName ?? "--"));
const activeRows = computed(() =>
  activeTab.value === "review" ? reviewRows.value : groupRows.value,
);
const activeCompareShelves = computed(() =>
  activeTab.value === "review"
    ? reviewCompareShelves.value
    : groupCompareShelves.value,
);
const selectedCompareOptions = computed(() =>
  selectedCompareIds.value
    .map((id) => compareOptions.value.find((item) => item.id === id))
    .filter((item): item is CompareOption => Boolean(item)),
);
const activeTableRows = computed(() =>
  activeRows.value.map((row, rowIndex) => {
    const mergedRow = { ...row };
    activeCompareShelves.value.forEach((shelf, shelfIndex) => {
      const compareRow = shelf.rows[rowIndex] ?? {};
      Object.entries(compareRow).forEach(([key, value]) => {
        mergedRow[`_loop${shelfIndex}${key}`] = value;
      });
    });
    return mergedRow;
  }),
);
const canDisplayBudgetEvaluation = computed(() =>
  authStore.hasPermission("system:project:report:budget:display"),
);

const reviewValueColumns = [
  { key: "budgetNonFrame", label: "非架构 A1" },
  { key: "budgetFrame", label: "架构 A2" },
  { key: "budgetTotal", label: "小计 A=A1+A2" },
  { key: "assessNonFrame", label: "非架构 B1" },
  { key: "assessFrame", label: "架构 B2" },
  { key: "assessTotal", label: "小计 B=B1+B2" },
  { key: "reductionAmount", label: "核减 C=B-A" },
] as const;

const groupValueColumns = [
  { key: "projectDevelopmentSumPrice", label: "研究开发" },
  { key: "partAssemblyInspectionSumPrice", label: "采购" },
  { key: "totalSumPrice", label: "小计" },
] as const;

const reviewMoneyFields = [
  "budgetNonFrame",
  "budgetFrame",
  "budgetTotal",
  "assessNonFrame",
  "assessFrame",
  "assessTotal",
  "reductionAmount",
  "reductionRatio",
] as const;

onMounted(() => {
  void initializePage();
});

async function initializePage() {
  loading.value = true;
  error.value = null;
  try {
    await Promise.all([loadCompareOptions(), loadReviewRows()]);
  } catch (unknownError) {
    handleError(unknownError, "生成报表加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadCompareOptions() {
  const response = await getCompareList();
  compareOptions.value = extractList<ReportRow>(
    response as ApiListPayload<ReportRow>,
  )
    .filter((item) => String(item.id ?? "") !== projectId.value)
    .map((item) => ({
      id: String(item.id ?? ""),
      label: getProjectName(item),
      raw: item,
    }))
    .filter((item) => item.id);
}

async function loadReviewRows() {
  if (!projectId.value) {
    throw new Error("缺少项目ID，请从立项评审列表重新进入。");
  }
  const response = await projectReviewNew(projectId.value);
  reviewVersion.value = response.version;
  reviewRows.value = mergeReviewRows(response.data as ReportRow[]);
}

async function loadGroupRows() {
  if (!projectId.value) {
    throw new Error("缺少项目ID，请从立项评审列表重新进入。");
  }
  const response = await projectSor(projectId.value);
  groupRows.value = extractList<ReportRow>(
    response as ApiListPayload<ReportRow>,
  ).map(normalizeGroupRow);
}

async function handleTabChange() {
  resetCompare();
  if (activeTab.value === "group" && !groupRows.value.length) {
    loading.value = true;
    try {
      await loadGroupRows();
    } catch (unknownError) {
      handleError(unknownError, "集团统筹表加载失败");
    } finally {
      loading.value = false;
    }
  }
}

async function applyCompare() {
  if (!selectedCompareIds.value.length) {
    BaseToast.warning("请选择对比项目");
    return;
  }
  loading.value = true;
  try {
    const shelves = await Promise.all(
      selectedCompareOptions.value.map(async (item) => {
        const response =
          activeTab.value === "review"
            ? await projectReviewNew(item.id)
            : await projectSor(item.id);
        const rows =
          activeTab.value === "review"
            ? mergeReviewRows(
                extractList<ReportRow>(response as ApiListPayload<ReportRow>),
              )
            : extractList<ReportRow>(response as ApiListPayload<ReportRow>).map(
                normalizeGroupRow,
              );
        return {
          title: item.label,
          id: item.id,
          rows,
        };
      }),
    );
    if (activeTab.value === "review") {
      reviewCompareShelves.value = shelves;
    } else {
      groupCompareShelves.value = shelves;
    }
  } catch (unknownError) {
    handleError(unknownError, "对比项目加载失败");
  } finally {
    loading.value = false;
  }
}

function resetCompare() {
  selectedCompareIds.value = [];
  if (activeTab.value === "review") {
    reviewCompareShelves.value = [];
  } else {
    groupCompareShelves.value = [];
  }
}

async function reloadCurrentTab() {
  resetCompare();
  loading.value = true;
  try {
    if (activeTab.value === "review") {
      await loadReviewRows();
    } else {
      await loadGroupRows();
    }
  } catch (unknownError) {
    handleError(unknownError, "报表重置失败");
  } finally {
    loading.value = false;
  }
}

async function syncLatestEvaluationData() {
  if (!projectId.value) {
    BaseToast.warning("缺少项目ID，请从立项评审列表重新进入。");
    return;
  }
  syncing.value = true;
  try {
    const response = await getLatestEvaluationDataNew(projectId.value);
    const nextRows = mergeReviewRows(
      extractList<ReportRow>(response as ApiListPayload<ReportRow>),
    );
    reviewRows.value = nextRows.map((row, index) => ({
      ...row,
      assessRemark: reviewRows.value[index]?.assessRemark,
      remark: reviewRows.value[index]?.remark,
    }));
    BaseToast.success("同步成功");
  } catch (unknownError) {
    handleError(unknownError, "同步失败");
  } finally {
    syncing.value = false;
  }
}

async function saveCurrentTable() {
  if (!projectId.value) {
    BaseToast.warning("缺少项目ID，请从立项评审列表重新进入。");
    return;
  }
  saving.value = true;
  try {
    if (activeTab.value === "review") {
      await reviewcommentsSvae({
        projectId: projectId.value,
        version: reviewVersion.value,
        dataList: reviewRows.value.map((row) =>
          normalizeReviewRowForSave(stripReviewDisplayFields(row)),
        ),
      });
      BaseToast.success("保存成功");
      await loadReviewRows();
    } else {
      await projectPost({
        projectId: projectId.value,
        projectSorTonghuaList: groupRows.value
          .filter((item) => item.id)
          .map((item) => ({
            sorId: item.id,
            isTonghuaPlan: getNestedValue(
              item,
              "projectSorTonghua.isTonghuaPlan",
            ),
            remark: getNestedValue(item, "projectSorTonghua.remark"),
          })),
      });
      BaseToast.success("保存成功");
      await loadGroupRows();
    }
  } catch (unknownError) {
    handleError(unknownError, "保存失败");
  } finally {
    saving.value = false;
  }
}

async function exportTable() {
  if (!projectId.value) {
    BaseToast.warning("缺少项目ID，请从立项评审列表重新进入。");
    return;
  }
  exporting.value = true;
  try {
    const projectIds = buildExportProjectIds();
    const task =
      activeTab.value === "review"
        ? await exportReviewTable(projectIds)
        : await exportSorTable(projectIds);
    latestExportTaskId.value = task.taskId;
    BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
  } catch (unknownError) {
    handleError(unknownError, "导出失败");
  } finally {
    exporting.value = false;
  }
}

function buildExportProjectIds() {
  const ids = selectedCompareOptions.value.map((item) => item.id);
  if (!ids.includes(projectId.value)) {
    ids.push(projectId.value);
  }
  return ids.join(",");
}

function goBack() {
  replaceToReturn(router, route, "/budget/wbs-touzi/lixiang");
}

function extractList<T>(payload: ApiListPayload<T> | unknown): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const record = payload as { data?: T[]; rows?: T[] };
    if (Array.isArray(record.data)) {
      return record.data;
    }
    if (Array.isArray(record.rows)) {
      return record.rows;
    }
  }
  return [];
}

function getProjectName(row: ReportRow) {
  const vehicleModel = row.vehicleModel as ReportRow | undefined;
  return String(
    vehicleModel?.modelName ?? row.projectName ?? row.modelName ?? row.id ?? "",
  );
}

function mergeReviewRows(rows: ReportRow[]) {
  const baseRows = createReviewRows();
  rows.forEach((item, index) => {
    if (baseRows[index]) {
      baseRows[index] = {
        ...baseRows[index],
        ...item,
      };
    } else {
      baseRows.push({ ...item });
    }
  });
  return baseRows;
}

function createReviewRows(): ReportRow[] {
  return buildBudgetStructureRows().map((item, index) => ({
    ...item,
    rowIndex: index,
    colA: "车型投资",
    budgetNonFrame: "",
    budgetFrame: "",
    budgetTotal: "",
    assessNonFrame: "",
    assessFrame: "",
    assessTotal: "",
    reductionAmount: "",
    assessRemark: "",
    remark: "",
    reductionRatio: "",
  }));
}

function buildBudgetStructureRows() {
  function setValue(rowIndex: number, colName: "B" | "C" | "D") {
    if (colName === "B") {
      if (rowIndex === 0) return "产品规划";
      if (rowIndex > 0 && rowIndex < 35) return "研究开发";
      if (rowIndex >= 35 && rowIndex < 52) return "采购";
      if (rowIndex >= 52 && rowIndex < 58) return "制造";
      if (rowIndex >= 58) {
        return [
          "质量",
          "平台管理",
          "信息数字化",
          "自动驾驶准入",
          "转BU",
          "不可预见费",
          "车型投资合计",
        ][rowIndex - 58];
      }
    }

    if (colName === "C") {
      if (rowIndex < 3) {
        return ["产品规划", "对标开发", "造型设计"][rowIndex];
      }
      if (rowIndex >= 3 && rowIndex < 22) return "工程开发";
      if (rowIndex >= 22 && rowIndex < 30) return "样车";
      if (rowIndex >= 30 && rowIndex < 33) return "试验开发及认证";
      if (rowIndex >= 33 && rowIndex < 35) {
        return ["运营费", "研发小计"][rowIndex - 33];
      }
      if (rowIndex >= 35 && rowIndex < 52) return "零部件模夹检及工装";
      if (rowIndex >= 52 && rowIndex < 58) return "产品专项投资";
      if (rowIndex >= 58) {
        return [
          "质量",
          "平台管理",
          "信息数字化",
          "自动驾驶准入",
          "转BU",
          "不可预见费",
          "车型投资合计",
        ][rowIndex - 58];
      }
    }

    if (colName === "D") {
      if (rowIndex < 3) {
        return ["产品规划", "对标开发", "造型设计"][rowIndex];
      }
      return [
        "整车",
        "整车性能",
        "尺寸工程",
        "车身结构",
        "底盘",
        "内装",
        "外装",
        "智能驾驶",
        "智能座舱",
        "电子电器",
        "智能集成",
        "数字化云平台",
        "电池",
        "电驱",
        "电动集成",
        "热管理",
        "设计变更",
        "其他",
        "小计",
        "骡车",
        "模拟样车",
        "EP样车",
        "MCB样车",
        "OTS样车",
        "Beta样车",
        "其他",
        "小计",
        "试验开发",
        "认证",
        "小计",
        "运营费",
        "研发小计",
        "车身结构",
        "底盘",
        "内装",
        "外装",
        "智能驾驶",
        "智能座舱",
        "电子电器",
        "智能集成",
        "数字化云平台",
        "电池",
        "电驱",
        "电动集成",
        "热管理",
        "设计变更",
        "差旅费",
        "其他",
        "小计",
        "冲压工艺",
        "车身工艺",
        "涂装工艺",
        "总装工艺",
        "其他",
        "小计",
        "质量",
        "平台管理",
        "信息数字化",
        "自动驾驶准入",
        "转BU",
        "不可预见费",
        "车型投资合计",
      ][rowIndex - 3];
    }

    return String(rowIndex);
  }

  const rows: Array<{ colB: string; colC: string; colD: string }> = [];
  for (let i = 0; i < 65; i += 1) {
    rows.push({
      colB: setValue(i, "B") || String(i),
      colC: setValue(i, "C") || String(i),
      colD: setValue(i, "D") || String(i),
    });
  }
  return rows;
}

function normalizeGroupRow(row: ReportRow): ReportRow {
  return {
    ...row,
    projectSorTonghua:
      row.projectSorTonghua && typeof row.projectSorTonghua === "object"
        ? row.projectSorTonghua
        : { isTonghuaPlan: "", remark: "" },
  };
}

function stripReviewDisplayFields(row: ReportRow) {
  const payload = { ...row };
  delete payload.colA;
  delete payload.colB;
  delete payload.colC;
  delete payload.colD;
  delete payload.rowIndex;
  return payload;
}

function normalizeReviewRowForSave(row: ReportRow) {
  const payload = { ...row };
  reviewMoneyFields.forEach((field) => {
    const value = payload[field];
    if (value === null || value === undefined || value === "") {
      payload[field] = null;
      return;
    }
    const number = Number(String(value).replace(/,/g, "").trim());
    payload[field] = Number.isFinite(number) ? number : null;
  });
  return payload;
}

function getNestedValue(row: ReportRow, path: string) {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object") {
      return (value as ReportRow)[key];
    }
    return undefined;
  }, row);
}

function updateNestedValue(row: ReportRow, path: string, value: unknown) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  if (!lastKey) return;
  let target = row;
  keys.forEach((key) => {
    if (!target[key] || typeof target[key] !== "object") {
      target[key] = {};
    }
    target = target[key] as ReportRow;
  });
  target[lastKey] = value;
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString("zh-CN") : "";
  }
  return String(value);
}

function formatPercent(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return `${value}%`;
}

function isEditableBudgetRow(row: ReportRow) {
  const rowName = String(row.rowName ?? row.colD ?? "");
  return ["转BU", "不可预见费"].includes(rowName);
}

function isEditableAmountRow(row: ReportRow) {
  return (
    isEditableBudgetRow(row) ||
    (row.colC === "工程开发" && row.colD === "其他")
  );
}

function recalcReviewRow(row: ReportRow, rowIndex: number) {
  const rowDataIndex = Number.isInteger(Number(row.rowIndex))
    ? Number(row.rowIndex)
    : rowIndex;
  const sourceRow = reviewRows.value[rowDataIndex] ?? row;
  if (sourceRow !== row) {
    [
      "budgetNonFrame",
      "budgetFrame",
      "assessNonFrame",
      "assessFrame",
    ].forEach((field) => {
      sourceRow[field] = row[field];
    });
  }
  recalcReviewCalculatedFields(sourceRow);
  recalculateReviewSubtotalRows(reviewRows.value);
}

function recalcReviewCalculatedFields(row: ReportRow) {
  const budgetTotal = parseBig(row.budgetNonFrame).plus(parseBig(row.budgetFrame));
  const assessTotal = parseBig(row.assessNonFrame).plus(parseBig(row.assessFrame));
  const reductionAmount = assessTotal.minus(budgetTotal);
  row.budgetTotal = formatAmount(budgetTotal);
  row.assessTotal = formatAmount(assessTotal);
  row.reductionAmount = formatAmount(reductionAmount);
  row.reductionRatio = formatRatio(reductionAmount, budgetTotal);
}

function recalculateReviewSubtotalRows(rows: ReportRow[]) {
  const subtotalGroups = [
    "工程开发",
    "样车",
    "试验开发及认证",
    "零部件模夹检及工装",
    "产品专项投资",
  ];

  subtotalGroups.forEach((group) => {
    const subtotal = rows.find(
      (row) => row.colC === group && row.colD === "小计",
    );
    if (!subtotal) return;
    recalculateReviewSumRow(
      subtotal,
      rows.filter((row) => row.colC === group && row.colD !== "小计"),
    );
  });

  const researchSubtotal = rows.find((row) => row.colC === "研发小计");
  if (researchSubtotal) {
    recalculateReviewSumRow(
      researchSubtotal,
      rows.filter(
        (row) =>
          ["运营费", "造型设计", "对标开发"].includes(String(row.colD)) ||
          (["工程开发", "样车", "试验开发及认证"].includes(String(row.colC)) &&
            row.colD === "小计"),
      ),
    );
  }

  const vehicleInvestmentTotal = rows.find(
    (row) =>
      row.colB === "车型投资合计" ||
      row.colC === "车型投资合计" ||
      row.colD === "车型投资合计",
  );
  if (vehicleInvestmentTotal) {
    recalculateReviewSumRow(
      vehicleInvestmentTotal,
      rows.filter(
        (row) =>
          row.colB === "产品规划" ||
          row.colC === "产品规划" ||
          row.colD === "产品规划" ||
          row.colC === "研发小计" ||
          (["零部件模夹检及工装", "产品专项投资"].includes(String(row.colC)) &&
            row.colD === "小计") ||
          [
            "质量",
            "平台管理",
            "信息数字化",
            "自动驾驶准入",
            "转BU",
            "不可预见费",
          ].includes(String(row.colB)),
      ),
    );
  }
}

function recalculateReviewSumRow(row: ReportRow, sourceRows: ReportRow[]) {
  const fields = [
    "budgetNonFrame",
    "budgetFrame",
    "assessNonFrame",
    "assessFrame",
  ];
  fields.forEach((field) => {
    row[field] = formatAmount(
      sourceRows.reduce((sum, sourceRow) => sum.plus(parseBig(sourceRow[field])), new Big(0)),
    );
  });
  recalcReviewCalculatedFields(row);
}

function parseBig(value: unknown) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized || normalized === "-") return new Big(0);
  try {
    return new Big(normalized);
  } catch {
    return new Big(0);
  }
}

function formatAmount(value: Big) {
  const [integer, fraction = ""] = value.toFixed(2).split(".");
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction
    ? `${formattedInteger}.${trimmedFraction}`
    : formattedInteger;
}

function formatRatio(amount: Big, base: Big) {
  if (base.eq(0)) return "";
  return amount.div(base).times(100).toFixed(2);
}

function reviewSpanMethod({
  rowIndex,
  columnIndex,
}: {
  row: ReportRow;
  column: unknown;
  rowIndex: number;
  columnIndex: number;
}): SpanResult {
  if (columnIndex === 0) {
    return rowIndex === 0 ? [65, 1] : [0, 0];
  }
  if (columnIndex === 1) {
    if (rowIndex === 1) return [34, 1];
    if (rowIndex > 1 && rowIndex <= 34) return [0, 0];
    if (rowIndex === 35) return [17, 1];
    if (rowIndex > 35 && rowIndex <= 51) return [0, 0];
    if (rowIndex === 52) return [6, 1];
    if (rowIndex > 52 && rowIndex <= 57) return [0, 0];
  }
  if (columnIndex === 2) {
    if (rowIndex === 3) return [19, 1];
    if (rowIndex > 3 && rowIndex <= 21) return [0, 0];
    if (rowIndex === 22) return [8, 1];
    if (rowIndex > 22 && rowIndex <= 29) return [0, 0];
    if (rowIndex === 30) return [3, 1];
    if (rowIndex > 30 && rowIndex <= 32) return [0, 0];
    if (rowIndex === 35) return [17, 1];
    if (rowIndex > 35 && rowIndex <= 51) return [0, 0];
    if (rowIndex === 52) return [6, 1];
    if (rowIndex > 52 && rowIndex <= 57) return [0, 0];
  }
  if ([0, 1, 2, 33, 34, 58, 59, 60, 61, 62, 63].includes(rowIndex)) {
    if (columnIndex === 2) return [1, 2];
    if (columnIndex === 3) return [0, 0];
  }
  if (rowIndex === 64) {
    if (columnIndex === 1) return [1, 3];
    if ([2, 3].includes(columnIndex)) return [0, 0];
  }
  return [1, 1];
}

function groupSpanMethod({
  rowIndex,
  columnIndex,
}: {
  row: ReportRow;
  column: unknown;
  rowIndex: number;
  columnIndex: number;
}): SpanResult {
  if (rowIndex === 80) {
    if (columnIndex === 0) {
      return { rowspan: 1, colspan: 2 };
    }
    if (columnIndex === 1) {
      return { rowspan: 0, colspan: 0 };
    }
  }
  return { rowspan: 1, colspan: 1 };
}

function reviewCellClassName({
  row,
  column,
}: {
  row: ReportRow;
  column: { property?: string };
}) {
  const classes = ["budget-report__cell"];
  if (["colA", "colB"].includes(String(column.property))) {
    classes.push("budget-report__cell--bold");
  }
  if (column.property === "colC" && row.colC === "研发小计") {
    classes.push("budget-report__cell--bold");
  }
  if (column.property === "colD" && row.colD === "小计") {
    classes.push("budget-report__cell--bold");
  }
  if (
    column.property === "reductionAmount" &&
    parseBig(row.reductionAmount).gt(0)
  ) {
    classes.push("budget-report__cell--danger");
  }
  return classes.join(" ");
}

function groupCellClassName({
  row,
  column,
}: {
  row: ReportRow;
  column: { property?: string };
}) {
  const classes = ["budget-report__cell"];
  if (row.systemLevelName === "合计" && column.property === "systemLevelName") {
    classes.push("budget-report__cell--bold");
  }
  return classes.join(" ");
}

function handleError(unknownError: unknown, fallbackMessage: string) {
  const normalizedError = normalizeError(unknownError, fallbackMessage);
  error.value = normalizedError;
  BaseToast.error(normalizedError.message);
}

function normalizeError(unknownError: unknown, fallbackMessage: string) {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }
  if (unknownError instanceof Error) {
    return {
      code: "FRONTEND-BUDGET-REPORT-001",
      message: unknownError.message || fallbackMessage,
      traceId: "unknown",
    };
  }
  return {
    code: "FRONTEND-BUDGET-REPORT-001",
    message: fallbackMessage,
    traceId: "unknown",
  };
}

/*
const budgetStructureRows = [
  ["产品规划", "产品规划", "产品规划"],
  ["研究开发", "对标开发", "对标开发"],
  ["研究开发", "造型设计", "造型设计"],
  ["研究开发", "工程开发", "整车"],
  ["研究开发", "工程开发", "整车性能"],
  ["研究开发", "工程开发", "尺寸工程"],
  ["研究开发", "工程开发", "车身结构"],
  ["研究开发", "工程开发", "底盘"],
  ["研究开发", "工程开发", "内装"],
  ["研究开发", "工程开发", "外装"],
  ["研究开发", "工程开发", "智能驾驶"],
  ["研究开发", "工程开发", "智能座舱"],
  ["研究开发", "工程开发", "电子电器"],
  ["研究开发", "工程开发", "智能集成"],
  ["研究开发", "工程开发", "数字化云平台"],
  ["研究开发", "工程开发", "电池"],
  ["研究开发", "工程开发", "电驱"],
  ["研究开发", "工程开发", "电动集成"],
  ["研究开发", "工程开发", "热管理"],
  ["研究开发", "工程开发", "设计变更"],
  ["研究开发", "工程开发", "其他"],
  ["研究开发", "工程开发", "小计"],
  ["研究开发", "样车", "骡车"],
  ["研究开发", "样车", "模拟样车"],
  ["研究开发", "样车", "EP样车"],
  ["研究开发", "样车", "MCB样车"],
  ["研究开发", "样车", "OTS样车"],
  ["研究开发", "样车", "Beta样车"],
  ["研究开发", "样车", "其他"],
  ["研究开发", "样车", "小计"],
  ["研究开发", "试验开发及认证", "试验开发"],
  ["研究开发", "试验开发及认证", "认证"],
  ["研究开发", "试验开发及认证", "小计"],
  ["研究开发", "运营费", "运营费"],
  ["研究开发", "研发小计", "研发小计"],
  ["采购", "零部件模夹检及工装", "车身结构"],
  ["采购", "零部件模夹检及工装", "底盘"],
  ["采购", "零部件模夹检及工装", "内装"],
  ["采购", "零部件模夹检及工装", "外装"],
  ["采购", "零部件模夹检及工装", "智能驾驶"],
  ["采购", "零部件模夹检及工装", "智能座舱"],
  ["采购", "零部件模夹检及工装", "电子电器"],
  ["采购", "零部件模夹检及工装", "智能集成"],
  ["采购", "零部件模夹检及工装", "数字化云平台"],
  ["采购", "零部件模夹检及工装", "电池"],
  ["采购", "零部件模夹检及工装", "电驱"],
  ["采购", "零部件模夹检及工装", "电动集成"],
  ["采购", "零部件模夹检及工装", "热管理"],
  ["采购", "零部件模夹检及工装", "设计变更"],
  ["采购", "零部件模夹检及工装", "差旅费"],
  ["采购", "零部件模夹检及工装", "其他"],
  ["采购", "零部件模夹检及工装", "小计"],
  ["制造", "产品专项投资", "冲压工艺"],
  ["制造", "产品专项投资", "车身工艺"],
  ["制造", "产品专项投资", "涂装工艺"],
  ["制造", "产品专项投资", "总装工艺"],
  ["制造", "产品专项投资", "其他"],
  ["制造", "产品专项投资", "小计"],
  ["质量", "质量", "质量"],
  ["平台管理", "平台管理", "平台管理"],
  ["信息数字化", "信息数字化", "信息数字化"],
  ["自动驾驶准入", "自动驾驶准入", "自动驾驶准入"],
  ["转BU", "转BU", "转BU"],
  ["不可预见费", "不可预见费", "不可预见费"],
  ["车型投资合计", "车型投资合计", "车型投资合计"],
].map(([colB, colC, colD]) => ({ colB, colC, colD }));
*/
</script>

<template>
  <PageContainer
    class="budget-report"
    title="生成报表"
    description="按旧版立项评审报表接口生成评审意见表和集团统筹表。"
    @fullscreen-change="(val)=>isFullScreen = val"
  >
    <TaskStatusPanel v-if="false" :task-id="latestExportTaskId" />
    <template #actions>
      <el-button class="bq-page-return-button" :icon="Back" @click="goBack">
        返回
      </el-button>
    </template>

    <section class="budget-report__toolbar">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="评审意见表" name="review" />
        <el-tab-pane label="集团统筹表" name="group" />
      </el-tabs>
      <el-form inline class="budget-report__compare">
        <el-form-item label="对比项目">
          <el-select
            v-model="selectedCompareIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择项目"
            class="budget-report__compare-select"
          >
            <el-option
              v-for="item in compareOptions"
              :key="item.id"
              :label="item.label"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <PermissionButton
            variant="primary"
            type="primary"
            plain
            @click="applyCompare"
          >
            对比
          </PermissionButton>
          <el-button @click="reloadCurrentTab">重置</el-button>
          <div class="budget-report__post-reset-actions">
            <PermissionButton
              v-if="activeTab === 'review'"
              variant="secondary"
              :icon="Refresh"
              :loading="syncing"
              @click="syncLatestEvaluationData"
            >
              同步
            </PermissionButton>
            <PermissionButton
              permission="system:project:save"
              variant="primary"
              :icon="Select"
              type="primary"
              plain
              :loading="saving"
              @click="saveCurrentTable"
            >
              保存
            </PermissionButton>
            <PermissionButton
              :permission="
                activeTab === 'review'
                  ? 'system:project:exprotTable'
                  : 'system:project:exprotSor'
              "
              variant="secondary"
              plain
              type="warning"
              :icon="Download"
              :loading="exporting"
              @click="exportTable"
            >
              导出
            </PermissionButton>
            <span
              class="page-container__fullscreen-target budget-report__fullscreen-target"
            />
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section v-loading="loading" class="budget-report__sheet">
      <el-table
        v-if="activeTab === 'review'"
        :data="activeTableRows"
        border
        style="width: 100%"
        :height="tableHeight"
        header-cell-class-name="budget-report__header"
        :cell-class-name="reviewCellClassName"
        :span-method="reviewSpanMethod"
      >
        <el-table-column :label="`${modelName}项目预算`" align="center">
          <el-table-column
            prop="colA"
            label="投资构成"
            align="center"
            width="120"
          />
          <el-table-column
            prop="colB"
            label="一级分类"
            align="center"
            width="150"
          />
          <el-table-column
            prop="colC"
            label="二级分类"
            align="center"
            width="170"
          />
          <el-table-column
            prop="colD"
            label="三级分类"
            align="center"
            width="170"
          />
          <el-table-column label="预算提报" align="center">
            <el-table-column
              v-for="column in reviewValueColumns.slice(0, 3)"
              :key="column.key"
              :prop="column.key"
              :label="column.label"
              align="center"
              min-width="125"
            >
              <template #default="{ row, $index }">
                <el-input
                  v-if="
                    isEditableBudgetRow(row) &&
                    ['budgetNonFrame', 'budgetFrame'].includes(column.key)
                  "
                  v-model="row[column.key]"
                  class="budget-report__number-input"
                  @blur="recalcReviewRow(row, $index)"
                />
                <span v-else>{{ formatCellValue(row[column.key]) }}</span>
              </template>
            </el-table-column>
          </el-table-column>
          <el-table-column
            v-if="canDisplayBudgetEvaluation"
            label="预算评估"
            align="center"
          >
            <el-table-column
              v-for="column in reviewValueColumns.slice(3)"
              :key="column.key"
              :prop="column.key"
              :label="column.label"
              align="center"
              width="125"
            >
              <template #default="{ row, $index }">
                <el-input
                  v-if="
                    isEditableAmountRow(row) &&
                    ['assessNonFrame', 'assessFrame'].includes(column.key)
                  "
                  v-model="row[column.key]"
                  class="budget-report__number-input"
                  @blur="recalcReviewRow(row, $index)"
                />
                <span v-else>{{ formatCellValue(row[column.key]) }}</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="assessRemark"
              label="评估说明"
              align="center"
              width="180"
            >
              <template #default="{ row }">
                <el-input
                  v-model="row.assessRemark"
                  type="textarea"
                  autosize
                  placeholder="请输入"
                />
              </template>
            </el-table-column>
            <el-table-column
              prop="remark"
              label="备注"
              align="center"
              width="180"
            >
              <template #default="{ row }">
                <el-input
                  v-model="row.remark"
                  type="textarea"
                  autosize
                  placeholder="请输入"
                />
              </template>
            </el-table-column>
            <el-table-column
              prop="reductionRatio"
              label="核减比例 D=C/A"
              align="center"
              width="125"
            >
              <template #default="{ row }">
                {{ formatPercent(row.reductionRatio) }}
              </template>
            </el-table-column>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-for="(shelf, shelfIndex) in activeCompareShelves"
          :key="shelf.id"
          :label="shelf.title"
          align="center"
          class-name="budget-report__compare-column"
        >
          <el-table-column
            label="预算提报"
            align="center"
            class-name="budget-report__compare-column"
          >
            <el-table-column
              v-for="column in reviewValueColumns.slice(0, 3)"
              :key="`${shelf.id}-${column.key}`"
              :prop="`_loop${shelfIndex}${column.key}`"
              :label="column.label"
              align="center"
              width="125"
              class-name="budget-report__compare-column"
            >
              <template #default="{ row }">
                {{ formatCellValue(row[`_loop${shelfIndex}${column.key}`]) }}
              </template>
            </el-table-column>
          </el-table-column>
          <el-table-column
            v-if="canDisplayBudgetEvaluation"
            label="预算评估"
            align="center"
            class-name="budget-report__compare-column"
          >
            <el-table-column
              v-for="column in reviewValueColumns.slice(3)"
              :key="`${shelf.id}-${column.key}`"
              :prop="`_loop${shelfIndex}${column.key}`"
              :label="column.label"
              align="center"
              width="125"
              class-name="budget-report__compare-column"
            >
              <template #default="{ row }">
                {{ formatCellValue(row[`_loop${shelfIndex}${column.key}`]) }}
              </template>
            </el-table-column>
            <el-table-column
              :prop="`_loop${shelfIndex}assessRemark`"
              label="评估说明"
              align="center"
              width="180"
              class-name="budget-report__compare-column"
            />
            <el-table-column
              :prop="`_loop${shelfIndex}remark`"
              label="备注"
              align="center"
              width="180"
              class-name="budget-report__compare-column"
            />
            <el-table-column
              :prop="`_loop${shelfIndex}reductionRatio`"
              label="核减比例 D=C/A"
              align="center"
              width="125"
              class-name="budget-report__compare-column"
            >
              <template #default="{ row }">
                {{ formatPercent(row[`_loop${shelfIndex}reductionRatio`]) }}
              </template>
            </el-table-column>
          </el-table-column>
        </el-table-column>
      </el-table>

      <el-table
        v-else
        :data="activeTableRows"
        border
        style="width: 100%"
        :height="tableHeight"
        header-cell-class-name="budget-report__header"
        :cell-class-name="groupCellClassName"
        :span-method="groupSpanMethod"
      >
        <el-table-column align="center">
          <el-table-column
            prop="systemLevelName"
            label="系统级名称"
            align="center"
            min-width="180"
          />
          <el-table-column
            prop="sorName"
            label="SOR名称"
            align="center"
            min-width="180"
          />
        </el-table-column>
        <el-table-column :label="modelName" align="center">
          <el-table-column label="合计(评估值 万元)" align="center">
            <el-table-column
              v-for="column in groupValueColumns"
              :key="column.key"
              :prop="column.key"
              :label="column.label"
              align="center"
              min-width="150"
            />
          </el-table-column>
          <el-table-column
            label="是否符合通用化方案"
            align="center"
            width="130"
          >
            <template #default="{ row }">
              <el-select
                v-if="
                  row.projectSorTonghua && row.systemLevelName !== '合计'
                "
                :model-value="
                  getNestedValue(row, 'projectSorTonghua.isTonghuaPlan')
                "
                @update:model-value="
                  updateNestedValue(
                    row,
                    'projectSorTonghua.isTonghuaPlan',
                    $event,
                  )
                "
              >
                <el-option label="是" value="1" />
                <el-option label="否" value="0" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column
            label="通用化说明情况"
            align="center"
            min-width="170"
          >
            <template #default="{ row }">
              <el-input
                v-if="
                  row.projectSorTonghua && row.systemLevelName !== '合计'
                "
                :model-value="getNestedValue(row, 'projectSorTonghua.remark')"
                placeholder="请输入通用化说明情况"
                @update:model-value="
                  updateNestedValue(row, 'projectSorTonghua.remark', $event)
                "
              />
            </template>
          </el-table-column>
        </el-table-column>
        <el-table-column
          v-for="(shelf, shelfIndex) in activeCompareShelves"
          :key="shelf.id"
          :label="shelf.title"
          align="center"
          class-name="budget-report__compare-column"
        >
          <el-table-column
            label="合计(评估值 万元)"
            align="center"
            class-name="budget-report__compare-column"
          >
            <el-table-column
              v-for="column in groupValueColumns"
              :key="`${shelf.id}-${column.key}`"
              :prop="`_loop${shelfIndex}${column.key}`"
              :label="column.label"
              align="center"
              min-width="150"
              class-name="budget-report__compare-column"
            />
          </el-table-column>
          <el-table-column
            label="是否符合通用化方案"
            align="center"
            width="130"
            class-name="budget-report__compare-column"
          >
            <template #default="{ row }">
              {{
                getNestedValue(
                  row,
                  `_loop${shelfIndex}projectSorTonghua.isTonghuaPlan`,
                ) === "0"
                  ? "否"
                  : getNestedValue(
                        row,
                        `_loop${shelfIndex}projectSorTonghua.isTonghuaPlan`,
                      ) === "1"
                    ? "是"
                    : ""
              }}
            </template>
          </el-table-column>
          <el-table-column
            label="通用化说明情况"
            align="center"
            min-width="170"
            show-overflow-tooltip
            class-name="budget-report__compare-column"
          >
            <template #default="{ row }">
              {{
                getNestedValue(
                  row,
                  `_loop${shelfIndex}projectSorTonghua.remark`,
                )
              }}
            </template>
          </el-table-column>
        </el-table-column>
      </el-table>
    </section>
    <TaskStatusPanel v-if="false" :task-id="activeTaskId" />
  </PageContainer>
</template>

<style scoped>
.budget-report {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.budget-report__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  max-width: 100%;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.budget-report__compare {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  padding-bottom: 12px;
}

.budget-report__compare :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 0;
}

.budget-report__compare :deep(.el-form-item__content) {
  min-width: 0;
}

.budget-report__post-reset-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: 8px;
}

.budget-report__fullscreen-target {
  display: inline-flex;
  align-items: center;
}

.budget-report__compare-select {
  width: 400px;
  min-width: 400px;
  max-width: 400px;
}

.budget-report__compare-select :deep(.el-select__wrapper) {
  min-height: 32px;
}

.budget-report__compare-select :deep(.el-select__selection) {
  min-width: 0;
}

.budget-report__compare-select :deep(.el-select__placeholder) {
  flex: 1;
  min-width: 0;
}

.budget-report__sheet {
  min-width: 0;
  max-width: 100%;
  min-height: 420px;
  overflow: hidden;
}

.budget-report :deep(.el-table) {
  max-width: 100%;
}

.budget-report :deep(.el-table__inner-wrapper),
.budget-report :deep(.el-table__body-wrapper),
.budget-report :deep(.el-scrollbar) {
  max-width: 100%;
}

.budget-report :deep(.budget-report__header) {
  background: #f5f7fa !important;
  color: var(--bq-color-text) !important;
  font-weight: 700;
  text-align: center;
  font-size: 16px;
}

.budget-report :deep(.budget-report__cell) {
  color: var(--bq-color-text);
  font-size: 16px;
}

.budget-report :deep(.budget-report__cell--bold) {
  color: var(--bq-color-text);
  font-weight: 700;
}

.budget-report :deep(.budget-report__cell--danger) {
  background: rgba(245, 108, 108, 0.35) !important;
}

.budget-report :deep(.budget-report__compare-column) {
  background: #2f6fe827 !important;
}

.budget-report__number-input :deep(.el-input__inner) {
  text-align: center;
}

.budget-report :deep(.el-textarea__inner) {
  min-height: 32px !important;
  box-shadow: none;
}

@media (max-width: 1280px) {
  .budget-report__toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .budget-report__compare {
    flex-wrap: wrap;
  }

  .budget-report__post-reset-actions {
    margin-left: 0;
  }

  .budget-report__compare-select {
    width: min(100%, 400px);
    min-width: 0;
    max-width: 100%;
  }
}
</style>
