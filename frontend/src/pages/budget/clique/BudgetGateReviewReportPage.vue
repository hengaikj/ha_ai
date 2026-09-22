<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import Big from "big.js";
import { useRoute, useRouter } from "vue-router";
import { replaceToReturn } from "@/utils/return-navigation";
import {
  ArrowDown,
  Back,
  Download,
  Refresh,
  Select,
} from "@element-plus/icons-vue";
import {
  getCompareListClique,
  getLatestEvaluationDataClique,
  getLeftReviewValve,
  getRightReviewValve,
  exportBrandReviewComments,
  exportReviewComments,
  projectReviewClique,
  projectSorClique,
  reviewcommentsSvaeClique,
} from "@/api/budget";
import { ApiBusinessError } from "@/api/http";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { useAuthStore } from "@/stores/auth";

type ReportTab = "review" | "group";
type ReportRow = Record<string, string | number | null | undefined>;
type ApiListPayload<T> = T[] | { data?: T[]; rows?: T[] };
type ApiNestedListPayload<T> = T[][] | { data?: T[][]; rows?: T[][] };
type CompareOption = {
  label: string;
  value: string;
  projectName: string;
  valveName: string;
  valveProjectId: string;
};
type CompareTreeNode = {
  label: string;
  value: string;
  disabled?: boolean;
  children?: CompareTreeNode[];
};
type CompareShelf = {
  title: string;
  id: string;
  rows: ReportRow[];
};

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const isFullScreen = ref(false);
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
  ["车BU", "车BU", "车BU"],
  ["不可预见费", "不可预见费", "不可预见费"],
  ["车型投资合计", "车型投资合计", "车型投资合计"],
].map(([colB, colC, colD]) => ({ colB, colC, colD }));

const activeTab = ref<ReportTab>("review");
const activeTaskId = ref("");
const selectedCompareIds = ref<string[]>([]);
const compareOptions = ref<CompareOption[]>([]);
const compareTreeOptions = ref<CompareTreeNode[]>([]);
const comparePopoverVisible = ref(false);
const compareTreeRef = ref<{
  setCheckedKeys: (keys: string[]) => void;
} | null>(null);
const reviewRows = ref<ReportRow[]>(createReviewRows());
const groupRows = ref<ReportRow[]>(createGroupRows());
const reviewCompareShelves = ref<CompareShelf[]>([]);
const groupCompareShelves = ref<CompareShelf[]>([]);
const loading = ref(false);
const syncing = ref(false);
const saving = ref(false);
const exporting = ref(false);
const tableHeight = computed(()=>{
  return isFullScreen.value?'calc(100vh - 200px)':'calc(100vh - 300px)'
});
const valveProjectId = computed(() => String(route.query.id ?? ""));
const modelName = computed(() => String(route.query.modelName ?? "--"));
const valveName = computed(() => String(route.query.valveName ?? "--"));
const activeRows = computed(() =>
  activeTab.value === "review" ? reviewRows.value : groupRows.value,
);
const activeCompareShelves = computed(() =>
  activeTab.value === "review"
    ? reviewCompareShelves.value
    : groupCompareShelves.value,
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
const selectedCompareOptions = computed(() =>
  selectedCompareIds.value
    .map((id) => compareOptions.value.find((item) => item.value === id))
    .filter((item): item is CompareOption => Boolean(item)),
);
const canDisplayBudgetEvaluation = computed(() =>
  authStore.hasPermission("system:project:report:budget:display"),
);

onMounted(() => {
  void initializePage();
});

async function initializePage() {
  loading.value = true;
  try {
    await Promise.all([loadCompareOptions(), loadAllTables()]);
  } catch (unknownError) {
    handleError(unknownError, "报表加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadAllTables() {
  if (!valveProjectId.value) {
    throw new Error("缺少过阀项目ID，请从过阀评审列表重新进入。");
  }
  const [reviewResponse, groupResponse] = await Promise.all([
    projectReviewClique(valveProjectId.value),
    projectSorClique(valveProjectId.value),
  ]);
  reviewRows.value = mergeRows(
    createReviewRows(),
    extractList(reviewResponse as ApiListPayload<Record<string, unknown>>),
    "review",
  );
  groupRows.value = mergeRows(
    createGroupRows(),
    extractList(groupResponse as ApiListPayload<Record<string, unknown>>),
    "group",
  );
}

async function loadCompareOptions() {
  const response = await getCompareListClique();
  const options: CompareOption[] = [];
  const treeOptions: CompareTreeNode[] = [];
  for (const rawProject of extractList(
    response as ApiListPayload<Record<string, unknown>>,
  )) {
    const project = rawProject as Record<string, unknown>;
    const projectNameValue = String(project.projectName ?? "");
    const valveList = Array.isArray(project.valveList)
      ? (project.valveList as Record<string, unknown>[])
      : [];
    const children: CompareTreeNode[] = [];
    for (const valve of valveList) {
      const compareId = String(valve.valveProjectId ?? "");
      if (!compareId || compareId === valveProjectId.value) {
        continue;
      }
      const compareValveName = String(valve.valveName ?? "");
      const value = `${projectNameValue}@_@${compareValveName}@_@${compareId}`;
      options.push({
        label: compareValveName,
        value,
        projectName: projectNameValue,
        valveName: compareValveName,
        valveProjectId: compareId,
      });
      children.push({
        label: compareValveName,
        value,
      });
    }
    if (children.length) {
      treeOptions.push({
        label: projectNameValue,
        value: `project-${String(project.projectId ?? projectNameValue)}`,
        disabled: true,
        children,
      });
    }
  }
  compareOptions.value = options;
  compareTreeOptions.value = treeOptions;
}

async function applyCompare() {
  if (!selectedCompareIds.value.length) {
    BaseToast.warning("请选择对比项目");
    return;
  }
  loading.value = true;
  try {
    const selectedOptions = selectedCompareIds.value
      .map((id) => compareOptions.value.find((item) => item.value === id))
      .filter((item): item is CompareOption => Boolean(item));
    const projectValveIds = selectedOptions
      .map((item) => item.valveProjectId)
      .join(",");
    const response =
      activeTab.value === "review"
        ? await getLeftReviewValve(projectValveIds)
        : await getRightReviewValve(projectValveIds);
    const compareData = extractNestedList(
      response as ApiNestedListPayload<Record<string, unknown>>,
    );
    const shelves = selectedOptions.map((item, index) => ({
      title: `${item.projectName}项目（${item.valveName}）`,
      id: item.valveProjectId,
      rows: normalizeRows(
        compareData[index] ?? [],
        activeTab.value === "review" ? "review" : "group",
      ),
    }));
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
  reviewCompareShelves.value = [];
  groupCompareShelves.value = [];
}

function handleCompareChange(values: string[]) {
  const leafValues = new Set(compareOptions.value.map((item) => item.value));
  selectedCompareIds.value = values.filter((value) => leafValues.has(value));
}

function removeCompareItem(value: string) {
  selectedCompareIds.value = selectedCompareIds.value.filter(
    (item) => item !== value,
  );
  void nextTick(() => {
    compareTreeRef.value?.setCheckedKeys(selectedCompareIds.value);
  });
}

function handleCompareTreeCheck(
  _node: unknown,
  checked: { checkedKeys: Array<string | number> },
) {
  handleCompareChange(checked.checkedKeys.map(String));
  void nextTick(() => {
    compareTreeRef.value?.setCheckedKeys(selectedCompareIds.value);
  });
}

function resolveCompareNodeClass(data: unknown) {
  const node = data as CompareTreeNode;
  return node.children?.length ? "gate-review-report__branch-node" : "";
}

async function syncLatestData() {
  if (!valveProjectId.value) {
    BaseToast.warning("缺少过阀项目ID，请从过阀评审列表重新进入。");
    return;
  }
  syncing.value = true;
  try {
    const response = await getLatestEvaluationDataClique(valveProjectId.value);
    const currentRows = reviewRows.value;
    const rows = normalizeRows(
      extractList(response as ApiListPayload<Record<string, unknown>>),
      "review",
    ).map((row, index) => ({
      ...row,
      assessRemark: currentRows[index]?.assessRemark,
      remark: currentRows[index]?.remark,
    }));
    reviewRows.value = mergeRows(createReviewRows(), rows, "review");
    BaseToast.success("已同步最新测算数据");
  } catch (unknownError) {
    handleError(unknownError, "同步失败");
  } finally {
    syncing.value = false;
  }
}

async function saveReport() {
  if (!valveProjectId.value) {
    BaseToast.warning("缺少过阀项目ID，请从过阀评审列表重新进入。");
    return;
  }
  saving.value = true;
  try {
    const response = await reviewcommentsSvaeClique({
      valveProjectId: valveProjectId.value,
      dataList: normalizeRows(reviewRows.value, "save").map((row) =>
        omitColumns(row, ["colA", "colB", "colC", "colD"]),
      ),
    });
    if (
      !response ||
      Number((response as { code?: number }).code ?? 200) === 200
    ) {
      BaseToast.success("保存成功");
      const nextResponse = await projectReviewClique(valveProjectId.value);
      reviewRows.value = mergeRows(
        createReviewRows(),
        extractList(nextResponse as ApiListPayload<Record<string, unknown>>),
        "review",
      );
    }
  } catch (unknownError) {
    handleError(unknownError, "保存失败");
  } finally {
    saving.value = false;
  }
}

async function exportTable() {
  if (!valveProjectId.value) {
    BaseToast.warning("缺少过阀项目ID，请从过阀评审列表重新进入。");
    return;
  }
  exporting.value = true;
  try {
    const ids = [
      valveProjectId.value,
      ...activeCompareShelves.value.map((item) => item.id),
    ];
    const task =
      activeTab.value === "review"
        ? await exportReviewComments(ids.join(","))
        : await exportBrandReviewComments(ids.join(","));
    activeTaskId.value = task.taskId;
    BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
  } catch (unknownError) {
    handleError(unknownError, "导出失败");
  } finally {
    exporting.value = false;
  }
}

function handleTabChange() {
  selectedCompareIds.value = [];
  reviewCompareShelves.value = [];
  groupCompareShelves.value = [];
}

function goBack() {
  replaceToReturn(router, route, "/budget/wbs-touzi/clique");
}

function extractList<T>(payload: ApiListPayload<T> | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function extractNestedList<T>(
  payload: ApiNestedListPayload<T> | null | undefined,
): T[][] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function normalizeRows(
  rows: Record<string, unknown>[],
  mode: "review" | "group" | "save" = "review",
): ReportRow[] {
  return rows.map((row) => {
    const next = { ...(row as ReportRow) };
    if (mode === "save") {
      reviewMoneyFields.forEach((key) => {
        next[key] = parsePrice(next[key]);
      });
      return next;
    }
    const fields = mode === "review" ? reviewMoneyFields : groupMoneyFields;
    fields.forEach((key) => {
      next[key] = formatPrice(next[key]);
    });
    return next;
  });
}

function mergeRows(
  baseRows: ReportRow[],
  apiRows: Record<string, unknown>[],
  mode: "review" | "group",
) {
  const rows = normalizeRows(apiRows, mode);
  return baseRows.map((row, index) => ({ ...row, ...(rows[index] ?? {}) }));
}

function omitColumns(row: ReportRow, keys: string[]) {
  const next = { ...row };
  keys.forEach((key) => delete next[key]);
  return next;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
}

function formatPrice(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const num = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isNaN(num) ? null : num;
}

function formatPercent(value: unknown) {
  const text = formatValue(value);
  return text ? `${text}%` : "";
}

function tableCellClassName({
  row,
  column,
}: {
  row: ReportRow;
  column: { property?: string };
}) {
  const classNames = ["gate-review-report__cell"];
  if (["colA", "colB"].includes(column.property ?? "")) {
    classNames.push("row-bold");
  }
  if (column.property === "colC" && row.colC === "研发小计") {
    classNames.push("row-bold");
  }
  if (column.property === "colD" && row.colD === "小计") {
    classNames.push("row-bold");
  }
  if (
    activeTab.value === "review" &&
    column.property === "reductionAmount" &&
    (parsePrice(row.reductionAmount) ?? 0) > 0
  ) {
    classNames.push("row-red");
  }
  return classNames.join(" ");
}

function isManualEditable(row: ReportRow) {
  const rowName = String(row.rowName ?? row.colD ?? "");
  return ["车BU", "不可预见费"].includes(rowName);
}

function isAssessmentEditable(row: ReportRow) {
  return (
    isManualEditable(row) ||
    (row.colC === "工程开发" && row.colD === "其他")
  );
}

function tableSpanMethod({
  rowIndex,
  columnIndex,
}: {
  rowIndex: number;
  columnIndex: number;
}): [number, number] {
  if (columnIndex === 0) {
    return rowIndex === 0 ? [budgetStructureRows.length, 1] : [0, 0];
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

function updateReviewField(index: number, key: string, value: string) {
  const row = reviewRows.value[index];
  if (!row) return;
  row[key] = value;
}

function inputFocus(row: ReportRow, key: string) {
  row[key] = parsePrice(row[key]);
}

function inputBlur(row: ReportRow, key: string, index: number) {
  row[key] = formatPrice(row[key]);
  resetReviewRowTotals(index);
}

function resetReviewRowTotals(index: number) {
  const row = reviewRows.value[index];
  if (!row) return;
  const budgetNonFrame = parsePrice(row.budgetNonFrame);
  const budgetFrame = parsePrice(row.budgetFrame);
  const budgetTotal = calculate(budgetNonFrame, budgetFrame, "+");
  const assessNonFrame = parsePrice(row.assessNonFrame);
  const assessFrame = parsePrice(row.assessFrame);
  const assessTotal = calculate(assessNonFrame, assessFrame, "+");
  const reductionAmount = calculate(assessTotal, budgetTotal, "-");
  const reductionRatio = calculate(reductionAmount, budgetTotal, "/");

  row.budgetTotal = formatCalculatedPrice(budgetTotal);
  row.assessTotal = formatCalculatedPrice(assessTotal);
  row.reductionAmount = formatCalculatedPrice(reductionAmount);
  if (reductionRatio === "-") {
    row.reductionRatio = "";
  } else {
    const percent = calculate(reductionRatio, 100, "*");
    row.reductionRatio = percent === "-" ? "" : percent.toFixed(2);
  }
  recalculateReviewSubtotalRows(reviewRows.value);
}

function recalculateReviewSubtotalRows(rows: ReportRow[]) {
  [
    "工程开发",
    "样车",
    "试验开发及认证",
    "零部件模夹检及工装",
    "产品专项投资",
  ].forEach((group) => {
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
            "车BU",
            "不可预见费",
          ].includes(String(row.colB)),
      ),
    );
  }
}

function recalculateReviewSumRow(row: ReportRow, sourceRows: ReportRow[]) {
  ["budgetNonFrame", "budgetFrame", "assessNonFrame", "assessFrame"].forEach(
    (field) => {
      row[field] = formatBigAmount(
        sourceRows.reduce(
          (sum, sourceRow) => sum.plus(parseBig(sourceRow[field])),
          new Big(0),
        ),
      );
    },
  );
  const budgetTotal = parseBig(row.budgetNonFrame).plus(parseBig(row.budgetFrame));
  const assessTotal = parseBig(row.assessNonFrame).plus(parseBig(row.assessFrame));
  const reductionAmount = assessTotal.minus(budgetTotal);
  row.budgetTotal = formatBigAmount(budgetTotal);
  row.assessTotal = formatBigAmount(assessTotal);
  row.reductionAmount = formatBigAmount(reductionAmount);
  row.reductionRatio = budgetTotal.eq(0)
    ? ""
    : reductionAmount.div(budgetTotal).times(100).toFixed(2);
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

function formatBigAmount(value: Big) {
  return formatPrice(value.toString());
}

function formatCalculatedPrice(value: number | "-") {
  return value === "-" ? "" : formatPrice(value);
}

function calculate(
  num1: number | null | "-",
  num2: number | null | "-",
  operator: "+" | "-" | "*" | "/",
) {
  const n1 = Number(num1);
  const n2 = Number(num2);
  if (Number.isNaN(n1) || Number.isNaN(n2)) return "-";

  function getDecimalLength(value: number) {
    const text = value.toString();
    return text.includes(".") ? text.split(".")[1].length : 0;
  }

  const multiple = Math.pow(
    10,
    Math.max(getDecimalLength(n1), getDecimalLength(n2)),
  );
  const int1 = Math.round(n1 * multiple);
  const int2 = Math.round(n2 * multiple);

  if (operator === "+") return (int1 + int2) / multiple;
  if (operator === "-") return (int1 - int2) / multiple;
  if (operator === "*") return (int1 * int2) / (multiple * multiple);
  if (int2 === 0) return "-";
  return int1 / int2;
}

function handleError(unknownError: unknown, fallbackMessage: string) {
  if (unknownError instanceof ApiBusinessError) {
    BaseToast.error(unknownError.message);
    return;
  }
  if (unknownError instanceof Error) {
    BaseToast.error(unknownError.message || fallbackMessage);
    return;
  }
  BaseToast.error(fallbackMessage);
}

function buildBaseRows(extraFields: ReportRow) {
  return budgetStructureRows.map((row) => ({
    colA: "车型投资",
    ...row,
    ...extraFields,
  }));
}

function createReviewRows() {
  return buildBaseRows({
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
  });
}

function createGroupRows() {
  return buildBaseRows({
    budgetAmount: "",
    assessAmount: "",
    usedAmount: "",
    scheduleRatio: "",
    availableAmount: "",
    releaseAssessAmount: "",
    releaseReductionRatio: "",
    releaseScheduleRatio: "",
    releaseReleaseAmount: "",
    remark: "",
  });
}

const reviewMoneyFields = [
  "budgetNonFrame",
  "budgetFrame",
  "budgetTotal",
  "assessNonFrame",
  "assessFrame",
  "assessTotal",
  "reductionAmount",
  "reductionRatio",
];

const groupMoneyFields = [
  "budgetAmount",
  "assessAmount",
  "usedAmount",
  "availableAmount",
  "releaseAssessAmount",
  "releaseReleaseAmount",
];
</script>

<template>
  <PageContainer
    class="gate-review-report"
    title="过阀评审生成报表"
    :description="`${modelName}项目（${valveName}）`"
    @fullscreen-change="(val)=>isFullScreen = val"
  >
    <template #actions>
      <el-button class="bq-page-return-button" :icon="Back" @click="goBack">
        返回
      </el-button>
    </template>

    <section class="gate-review-report__toolbar">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="评审意见表" name="review" />
        <el-tab-pane label="评审意见表品牌方" name="group" />
      </el-tabs>
      <el-form inline class="gate-review-report__compare">
        <el-form-item label="对比项目">
          <el-popover
            v-model:visible="comparePopoverVisible"
            placement="bottom-start"
            trigger="click"
            :width="420"
            popper-class="gate-review-report__compare-popper"
          >
            <template #reference>
              <div
                class="gate-review-report__compare-trigger"
                :class="{ 'is-open': comparePopoverVisible }"
              >
                <span
                  v-if="!selectedCompareOptions.length"
                  class="gate-review-report__compare-placeholder"
                >
                  请选择
                </span>
                <template v-else>
                  <el-tag
                    v-for="item in selectedCompareOptions"
                    :key="item.value"
                    size="small"
                    effect="plain"
                    closable
                    @close.stop="removeCompareItem(item.value)"
                  >
                    {{ item.projectName }}（{{ item.valveName }}）
                  </el-tag>
                </template>
                <el-icon class="gate-review-report__compare-arrow">
                  <ArrowDown />
                </el-icon>
              </div>
            </template>
            <el-tree
              ref="compareTreeRef"
              :data="compareTreeOptions"
              node-key="value"
              show-checkbox
              check-strictly
              :check-on-click-node="false"
              :expand-on-click-node="true"
              :default-checked-keys="selectedCompareIds"
              :node-class-name="resolveCompareNodeClass"
              empty-text="暂无数据"
              class="gate-review-report__compare-tree"
              @check="handleCompareTreeCheck"
            />
          </el-popover>
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
          <el-button @click="resetCompare">重置</el-button>
          <div class="gate-review-report__post-reset-actions">
            <PermissionButton
              v-if="activeTab === 'review'"
              variant="secondary"
              :icon="Refresh"
              :loading="syncing"
              @click="syncLatestData"
            >
              同步
            </PermissionButton>
            <PermissionButton
              v-if="activeTab === 'review'"
              permission="system:table:data:save"
              variant="primary"
              type="primary"
              :icon="Select"
              :loading="saving"
              @click="saveReport"
            >
              保存
            </PermissionButton>
            <PermissionButton
              permission="system:table:data:export"
              variant="secondary"
              type="warning"
              plain
              :icon="Download"
              :loading="exporting"
              @click="exportTable"
            >
              导出
            </PermissionButton>
            <span
              class="page-container__fullscreen-target gate-review-report__fullscreen-target"
            />
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section v-loading="loading" class="gate-review-report__sheet">
      <el-table
        :data="activeTableRows"
        border
        style="width: 100%"
        :height="tableHeight"
        header-cell-class-name="gate-review-report__header"
        :span-method="tableSpanMethod"
        :cell-class-name="tableCellClassName"
      >
        <el-table-column
          prop="colA"
          label="投资构成"
          width="120"
          align="center"
        />
        <el-table-column
          prop="colB"
          label="一级分类"
          width="150"
          align="center"
        />
        <el-table-column
          prop="colC"
          label="二级分类"
          width="150"
          align="center"
        />
        <el-table-column
          prop="colD"
          label="三级分类"
          width="150"
          align="center"
        />

        <template v-if="activeTab === 'review'">
          <el-table-column
            :label="`${modelName}项目（${valveName}）`"
            align="center"
          >
            <el-table-column label="预算提报" align="center">
              <el-table-column
                prop="budgetNonFrame"
                label="非架构 A1"
                min-width="120"
                align="center"
              >
                <template #default="{ row, $index }">
                  <el-input
                    v-if="isManualEditable(row)"
                    :model-value="reviewRows[$index]?.budgetNonFrame"
                    class="gate-review-report__number-input"
                    placeholder="请输入"
                    @update:model-value="
                      updateReviewField($index, 'budgetNonFrame', $event)
                    "
                    @focus="inputFocus(reviewRows[$index], 'budgetNonFrame')"
                    @blur="
                      inputBlur(reviewRows[$index], 'budgetNonFrame', $index)
                    "
                  />
                  <span v-else>{{ row.budgetNonFrame }}</span>
                </template>
              </el-table-column>
              <el-table-column
                prop="budgetFrame"
                label="架构 A2"
                min-width="120"
                align="center"
              >
                <template #default="{ row, $index }">
                  <el-input
                    v-if="isManualEditable(row)"
                    :model-value="reviewRows[$index]?.budgetFrame"
                    class="gate-review-report__number-input"
                    placeholder="请输入"
                    @update:model-value="
                      updateReviewField($index, 'budgetFrame', $event)
                    "
                    @focus="inputFocus(reviewRows[$index], 'budgetFrame')"
                    @blur="inputBlur(reviewRows[$index], 'budgetFrame', $index)"
                  />
                  <span v-else>{{ row.budgetFrame }}</span>
                </template>
              </el-table-column>
              <el-table-column
                prop="budgetTotal"
                label="小计 A=A1+A2"
                min-width="130"
                align="center"
              />
            </el-table-column>
            <el-table-column
              v-if="canDisplayBudgetEvaluation"
              label="预算评估"
              align="center"
            >
              <el-table-column
                prop="assessNonFrame"
                label="非架构 B1"
                width="120"
                align="center"
              >
                <template #default="{ row, $index }">
                  <el-input
                    v-if="isAssessmentEditable(row)"
                    :model-value="reviewRows[$index]?.assessNonFrame"
                    class="gate-review-report__number-input"
                    placeholder="请输入"
                    @update:model-value="
                      updateReviewField($index, 'assessNonFrame', $event)
                    "
                    @focus="inputFocus(reviewRows[$index], 'assessNonFrame')"
                    @blur="
                      inputBlur(reviewRows[$index], 'assessNonFrame', $index)
                    "
                  />
                  <span v-else>{{ row.assessNonFrame }}</span>
                </template>
              </el-table-column>
              <el-table-column
                prop="assessFrame"
                label="架构 B2"
                width="120"
                align="center"
              >
                <template #default="{ row, $index }">
                  <el-input
                    v-if="isAssessmentEditable(row)"
                    :model-value="reviewRows[$index]?.assessFrame"
                    class="gate-review-report__number-input"
                    placeholder="请输入"
                    @update:model-value="
                      updateReviewField($index, 'assessFrame', $event)
                    "
                    @focus="inputFocus(reviewRows[$index], 'assessFrame')"
                    @blur="inputBlur(reviewRows[$index], 'assessFrame', $index)"
                  />
                  <span v-else>{{ row.assessFrame }}</span>
                </template>
              </el-table-column>
              <el-table-column
                prop="assessTotal"
                label="小计 B=B1+B2"
                width="130"
                align="center"
              />
              <el-table-column
                prop="reductionAmount"
                label="核减 C=B-A"
                width="120"
                align="center"
              />
              <el-table-column
                prop="assessRemark"
                label="评估说明"
                width="180"
                align="center"
              >
                <template #default="{ $index }">
                  <el-input
                    :model-value="reviewRows[$index]?.assessRemark"
                    type="textarea"
                    autosize
                    placeholder="请输入"
                    @update:model-value="
                      updateReviewField($index, 'assessRemark', $event)
                    "
                  />
                </template>
              </el-table-column>
              <el-table-column
                prop="remark"
                label="备注"
                width="180"
                align="center"
              >
                <template #default="{ $index }">
                  <el-input
                    :model-value="reviewRows[$index]?.remark"
                    type="textarea"
                    autosize
                    placeholder="请输入"
                    @update:model-value="
                      updateReviewField($index, 'remark', $event)
                    "
                  />
                </template>
              </el-table-column>
              <el-table-column
                prop="reductionRatio"
                label="核减比例 D=C/A"
                width="140"
                align="center"
              >
                <template #default="{ row }">{{
                  formatPercent(row.reductionRatio)
                }}</template>
              </el-table-column>
            </el-table-column>
          </el-table-column>

          <el-table-column
            v-for="(shelf, index) in reviewCompareShelves"
            :key="shelf.id"
            :label="shelf.title"
            align="center"
            class-name="gate-review-report__compare-column"
          >
            <el-table-column
              label="预算提报"
              align="center"
              class-name="gate-review-report__compare-column"
            >
              <el-table-column
                :prop="`_loop${index}budgetNonFrame`"
                label="非架构 A1"
                width="120"
                align="center"
                class-name="gate-review-report__compare-column"
              />
              <el-table-column
                :prop="`_loop${index}budgetFrame`"
                label="架构 A2"
                width="120"
                align="center"
                class-name="gate-review-report__compare-column"
              />
              <el-table-column
                :prop="`_loop${index}budgetTotal`"
                label="小计 A=A1+A2"
                width="130"
                align="center"
                class-name="gate-review-report__compare-column"
              />
            </el-table-column>
            <el-table-column
              v-if="canDisplayBudgetEvaluation"
              label="预算评估"
              align="center"
              class-name="gate-review-report__compare-column"
            >
              <el-table-column
                :prop="`_loop${index}assessNonFrame`"
                label="非架构 B1"
                width="120"
                align="center"
                class-name="gate-review-report__compare-column"
              />
              <el-table-column
                :prop="`_loop${index}assessFrame`"
                label="架构 B2"
                width="120"
                align="center"
                class-name="gate-review-report__compare-column"
              />
              <el-table-column
                :prop="`_loop${index}assessTotal`"
                label="小计 B=B1+B2"
                width="130"
                align="center"
                class-name="gate-review-report__compare-column"
              />
              <el-table-column
                :prop="`_loop${index}reductionAmount`"
                label="核减 C=B-A"
                width="120"
                align="center"
                class-name="gate-review-report__compare-column"
              />
              <el-table-column
                :prop="`_loop${index}assessRemark`"
                label="评估说明"
                width="180"
                align="center"
                class-name="gate-review-report__compare-column"
              />
              <el-table-column
                :prop="`_loop${index}remark`"
                label="备注"
                width="180"
                align="center"
                class-name="gate-review-report__compare-column"
              />
              <el-table-column
                :prop="`_loop${index}reductionRatio`"
                label="核减比例 D=C/A"
                width="140"
                align="center"
                class-name="gate-review-report__compare-column"
              >
                <template #default="{ row }">
                  {{ formatPercent(row[`_loop${index}reductionRatio`]) }}
                </template>
              </el-table-column>
            </el-table-column>
          </el-table-column>
        </template>

        <template v-else>
          <el-table-column
            :label="`${modelName}项目（${valveName}阀）预算执行进度`"
            align="center"
          >
            <el-table-column
              prop="budgetAmount"
              label="总预算金额 a"
              width="130"
              align="center"
            />
            <el-table-column
              prop="assessAmount"
              label="总评估金额 b"
              width="130"
              align="center"
            />
            <el-table-column
              prop="usedAmount"
              label="已占用金额 c"
              width="130"
              align="center"
            />
            <el-table-column
              prop="scheduleRatio"
              label="阀点执行进度 c/a"
              width="150"
              align="center"
            >
              <template #default="{ row }">{{
                formatPercent(row.scheduleRatio)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="availableAmount"
              label="可用金额 a-c"
              width="130"
              align="center"
            />
            <el-table-column
              prop="releaseAssessAmount"
              label="阀点释放评估金额 d"
              width="170"
              align="center"
            />
            <el-table-column
              prop="releaseReductionRatio"
              label="阀点+释放执行进度 (c+d)/a"
              width="210"
              align="center"
            >
              <template #default="{ row }">{{
                formatPercent(row.releaseReductionRatio)
              }}</template>
            </el-table-column>
          </el-table-column>
          <el-table-column
            v-if="!groupCompareShelves.length"
            label="上一阀点预算执行检核"
            align="center"
          >
            <el-table-column
              prop="releaseScheduleRatio"
              label="当前阀点已占用金额 - 上一阀点已占用金额 e=c-c'"
              width="260"
              align="center"
            />
            <el-table-column
              prop="releaseReleaseAmount"
              label="执行偏差 e-d'"
              width="140"
              align="center"
            />
            <el-table-column
              prop="remark"
              label="说明"
              width="200"
              align="center"
            />
          </el-table-column>
          <el-table-column
            v-for="(shelf, index) in groupCompareShelves"
            :key="shelf.id"
            :label="`${shelf.title}预算执行进度`"
            align="center"
            class-name="gate-review-report__compare-column"
          >
            <el-table-column
              :prop="`_loop${index}budgetAmount`"
              label="总预算金额 a"
              width="130"
              align="center"
              class-name="gate-review-report__compare-column"
            />
            <el-table-column
              :prop="`_loop${index}assessAmount`"
              label="总评估金额 b"
              width="130"
              align="center"
              class-name="gate-review-report__compare-column"
            />
            <el-table-column
              :prop="`_loop${index}usedAmount`"
              label="已占用金额 c"
              width="130"
              align="center"
              class-name="gate-review-report__compare-column"
            />
            <el-table-column
              :prop="`_loop${index}scheduleRatio`"
              label="阀点执行进度 c/a"
              width="150"
              align="center"
              class-name="gate-review-report__compare-column"
            >
              <template #default="{ row }">
                {{ formatPercent(row[`_loop${index}scheduleRatio`]) }}
              </template>
            </el-table-column>
            <el-table-column
              :prop="`_loop${index}availableAmount`"
              label="可用金额 a-c"
              width="130"
              align="center"
              class-name="gate-review-report__compare-column"
            />
            <el-table-column
              :prop="`_loop${index}releaseAssessAmount`"
              label="阀点释放评估金额 d"
              width="170"
              align="center"
              class-name="gate-review-report__compare-column"
            />
            <el-table-column
              :prop="`_loop${index}releaseReductionRatio`"
              label="阀点+释放执行进度 (c+d)/a"
              width="210"
              align="center"
              class-name="gate-review-report__compare-column"
            >
              <template #default="{ row }">
                {{ formatPercent(row[`_loop${index}releaseReductionRatio`]) }}
              </template>
            </el-table-column>
          </el-table-column>
        </template>
      </el-table>
    </section>
    <TaskStatusPanel v-if="false" :task-id="activeTaskId" />
  </PageContainer>
</template>

<style scoped>
.gate-review-report {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.gate-review-report__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  max-width: 100%;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.gate-review-report__compare {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  padding-bottom: 12px;
}

.gate-review-report__compare :deep(.el-form-item) {
  margin-right: 0;
  margin-bottom: 0;
}

.gate-review-report__compare :deep(.el-form-item__content) {
  min-width: 0;
}

.gate-review-report__compare-trigger {
  box-sizing: border-box;
  position: relative;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  width: 420px;
  min-width: 420px;
  max-width: 420px;
  min-height: 32px;
  max-height: 96px;
  gap: 4px;
  padding: 3px 30px 3px 11px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  cursor: pointer;
  overflow-y: auto;
  overflow-x: hidden;
  height:20px;line-height:20px;
}

.gate-review-report__compare-arrow {
  position: absolute;
  top: 50%;
  right: 9px;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  transform: translateY(-50%);
  pointer-events: none;
}

.gate-review-report__compare-trigger:hover,
.gate-review-report__compare-trigger.is-open {
  border-color: var(--el-color-primary);
}

.gate-review-report__compare-trigger.is-open {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.gate-review-report__compare-trigger.is-open .gate-review-report__compare-arrow {
  transform: translateY(-50%) rotate(180deg);
}

.gate-review-report__compare-placeholder {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}

.gate-review-report__post-reset-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: 8px;
}

.gate-review-report__fullscreen-target {
  display: inline-flex;
  align-items: center;
}

.gate-review-report__compare-trigger :deep(.el-tag) {
  max-width: 190px;
  flex: 0 0 auto;
}

.gate-review-report__compare-trigger :deep(.el-tag__content) {
  max-width: 148px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gate-review-report__compare-tree {
  max-height: 320px;
  overflow: auto;
}

.gate-review-report__compare-tree
  :deep(
    .el-tree-node.gate-review-report__branch-node
      > .el-tree-node__content
      .el-checkbox
  ),
.gate-review-report__compare-tree
  :deep(
    .el-tree-node.is-expanded.gate-review-report__branch-node
      > .el-tree-node__content
      .el-checkbox
  ) {
  display: none;
}

.gate-review-report__compare-tree
  :deep(
    .el-tree-node.gate-review-report__branch-node > .el-tree-node__content
  ) {
  cursor: pointer;
}

.gate-review-report__compare-select {
  width: 420px;
  min-width: 420px;
  max-width: 420px;
}

.gate-review-report__compare-select :deep(.el-select__wrapper) {
  min-height: 32px;
}

.gate-review-report__compare-select :deep(.el-select__selection) {
  min-width: 0;
}

.gate-review-report__compare-select :deep(.el-select__placeholder) {
  flex: 1;
  min-width: 0;
}

.gate-review-report__sheet {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.gate-review-report :deep(.el-table) {
  max-width: 100%;
}

.gate-review-report :deep(.el-table__inner-wrapper),
.gate-review-report :deep(.el-table__body-wrapper),
.gate-review-report :deep(.el-scrollbar) {
  max-width: 100%;
}

.gate-review-report :deep(.gate-review-report__header) {
  background-color: #f5f7fa !important;
  color: var(--bq-color-text);
  font-weight: 700;
  font-size: 16px;
}
.gate-review-report :deep(.gate-review-report__cell) {
  font-size: 16px;
}

.gate-review-report :deep(.row-bold) {
  font-weight: 700;
  color: #000;
}

.gate-review-report :deep(.row-red) {
  background: rgba(245, 108, 108, 0.5) !important;
}

.gate-review-report :deep(.gate-review-report__compare-column) {
  background: #2f6fe827 !important;
}

.gate-review-report :deep(.el-textarea__inner) {
  min-height: 32px !important;
  box-shadow: none;
}

@media (max-width: 1280px) {
  .gate-review-report__toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .gate-review-report__compare {
    flex-wrap: wrap;
  }

  .gate-review-report__post-reset-actions {
    margin-left: 0;
  }

  .gate-review-report__compare-select {
    width: min(100vw - 64px, 420px);
    min-width: min(100vw - 64px, 420px);
    max-width: min(100vw - 64px, 420px);
  }

  .gate-review-report__compare-trigger {
    width: min(100vw - 64px, 420px);
    min-width: min(100vw - 64px, 420px);
    max-width: min(100vw - 64px, 420px);
  }
}
</style>
