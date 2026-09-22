<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back, DocumentCopy, Refresh, Search, Setting } from "@element-plus/icons-vue";
import {
  fetchInitiationPatterns,
  fetchInitiationWbsItems,
  fetchAssessCompareList,
  fetchAssessCompareData,
  saveInitiationAssess,
  forModuleIdList,
} from "@/api/budget";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import BaseColumnSettings from "@/components/base/BaseColumnSettings.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import { BaseToast } from "@/components/base/BaseToast";
import { useAuthStore } from "@/stores/auth";
import { pasteTableRange, type ExcelPasteColumn } from "@/utils/excelPaste";
import BudgetInitiationCompareWbsDialog from "@/pages/budget/BudgetInitiationCompareWbsDialog.vue";
import type {
  InitiationPatternItem,
  InitiationWbsItem,
  InitiationCompareProject,
  InitiationAssessSaveItem,
} from "@/types/budget";
import { sameBackendId } from "@/utils/backend-id";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const projectId = computed(() => String(route.query.projectId ?? ""));
const modelName = computed(() => String(route.query.modelName ?? ""));
const selectedIds = computed(() => String(route.query.ids ?? ""));
const selectedRowsKey = computed(() =>
  String(route.query.selectedRowsKey ?? ""),
);
const majorVersion = computed(() => String(route.query.majorVersion ?? ""));
const abolishFlag = computed(() => {
  const value = String(route.query.abolishFlag ?? "");
  return value === "0" || value === "1" ? Number(value) : undefined;
});

function clearSelectedRowsCache() {
  if (!selectedRowsKey.value) return;
  try {
    window.sessionStorage.removeItem(selectedRowsKey.value);
  } catch {
    // 浏览器存储不可用时无需额外处理。
  }
}

onBeforeUnmount(clearSelectedRowsCache);

const loading = ref(false);
const saving = ref(false);
const patterns = ref<InitiationPatternItem[]>([]);
const formMain = ref<any[]>([]);
const compareProjects = ref<InitiationCompareProject[]>([]);
const compareSelect = ref<(string | number)[]>([]);
const selectedProject = ref<any[]>([]);
const compareVisibleProjectKeys = ref<string[]>([]);
const compareWbsDialogVisible = ref(false);
const compareWbsDialogState = ref<{
  projectName: string;
  row: Record<string, any> | null;
  marker: number;
  patterns: { id: number | string; patternName: string }[];
} | null>(null);
const searchSorName = ref("");
const searchReductionDiff = ref("");
const tableFilterIndexArr = ref<number[]>([]);
const columnsGroup = ref<any[]>([]);
const controllerOptionsActive = ref<number | null>(null);
const colSelectTreeData = ref<any[]>([]);
const visibleColumns = ref<string[]>([]);

const canEditBudget = computed(() =>
  authStore.hasPermission("system:project:budget:edit"),
);
const canEditEvaluation = computed(() =>
  authStore.hasPermission("system:project:eva:edit"),
);
const canDisplayEvaluation = computed(() =>
  authStore.hasPermission("system:project:eva:display"),
);
const canDisplayReviewRecord = computed(
  () =>
    canDisplayEvaluation.value ||
    authStore.hasPermission("system:project:eva:record:display"),
);
const controllerOptions = computed(() =>
  columnsGroup.value.map((item, index) => ({ value: index, label: String(item.name ?? "") })),
);
const compareProjectColumns = computed(() =>
  selectedProject.value.map((item, index) => ({
    key: compareProjectKey(index),
    label: `${item.projectName}(${item.hasPattens ? "已选版型" : "未选版型"})`,
  })),
);

function unwrapRows<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}

function compareProjectKey(index: number) {
  return `compare-project-${index}`;
}

const legacyColumnMap: Record<string, string[]> = {
  "qzsjColumns-realLevel": ["left-level", "center-level", "right-level"],
  "qzsjColumns-wbsNumber": ["left-wbs", "center-wbs", "right-wbs"],
  "qzsjColumns-wbsName": ["left-wbsName", "center-wbsName", "right-wbsName"],
  "qzsjColumns-totalBudgetAmount": ["left-totalBudget"],
  "qzsjColumns-submitter": ["left-submitter"],
  "qzsjColumns-level": ["left-level", "center-level", "right-level"],
  "qzpsColumns-realLevel": ["center-level"],
  "qzpsColumns-level": ["center-level"],
  "qzpsColumns-wbsNumber": ["center-wbs"],
  "qzpsColumns-wbsName": ["center-wbsName"],
  "qzpsColumns-sorName": ["center-sorName"],
  "qzpsColumns-assessTotalAmount": ["center-assessTotal"],
  "qzpsColumns-totalBudgetAmount": ["center-assessTotal"],
  "qzpsColumns-paymentRatio": ["center-paymentRatio"],
  "qzpsColumns-paymentEstimate": ["center-paymentEstimate"],
  "qzpsColumns-reductionDiff": ["center-reductionDiff"],
  "qzpsColumns-reductionRatio": ["center-reductionRatio"],
  "psjlColumns-realLevel": ["right-level"],
  "psjlColumns-level": ["right-level"],
  "psjlColumns-wbsNumber": ["right-wbs"],
  "psjlColumns-wbsName": ["right-wbsName"],
  "psjlColumns-paymentAmount": ["right-paymentAmount"],
  "psjlColumns-amortizationAmount": ["right-amortizationAmount"],
  "psjlColumns-totalAmount": ["right-totalAmount"],
  "psjlColumns-remark": ["right-remark"],
  "psjlColumns-totalOverspend": ["right-totalOverspend"],
  "psjlColumns-paymentOverspend": ["right-paymentOverspend"],
};

function addLegacyColumnKeys(visible: Set<string>, key: string) {
  if (key.startsWith("qzsjColumns-qianzhishujuBanxing")) {
    const id = key.replace("qzsjColumns-qianzhishujuBanxing", "");
    visible.add(`left-budget-${id}`);
    visible.add(`left-remark-${id}`);
    return;
  }
  if (key.startsWith("qzpsColumns-qianzhipingshenBanxing2")) {
    visible.add(`center-paymentBudget-${key.replace("qzpsColumns-qianzhipingshenBanxing2", "")}`);
  }
  if (key.startsWith("qzpsColumns-qianzhipingshenBanxing")) {
    const id = key.replace("qzpsColumns-qianzhipingshenBanxing", "");
    visible.add(`center-assess-${id}`);
    visible.add(`center-assessRemark-${id}`);
    return;
  }
  (legacyColumnMap[key] || []).forEach((item) => visible.add(item));
}

function collectVisibleColumns(nodes: any[]) {
  const visible = new Set<string>();
  const visit = (items: any[], parent = "") => items.forEach((item) => {
    const children = item.child || item.children || [];
    const key = String(item.key ?? item.id ?? "");
    if (children.length) return visit(children, key || parent);
    if (item.check === false || item.show === false) return;
    addLegacyColumnKeys(visible, key.includes("-") || !parent ? key : `${parent}-${key}`);
  });
  visit(nodes);
  return visible;
}

function buildColumnTree(nodes: any[]) {
  const map = (items: any[]): any[] => items.map((item) => {
    const children = item.child || item.children || [];
    const node: any = { id: String(item.key ?? item.id ?? ""), label: String(item.name ?? item.label ?? ""), show: item.check !== false && item.show !== false };
    if (children.length) {
      node.children = map(children);
      if (node.id === "qzsjColumns") {
        const index = node.children.findIndex((child: any) => ["wbsName", "wbsNumber", "realLevel"].includes(child.id));
        const dynamic = banXing.value.map((bx) => ({ id: `qianzhishujuBanxing${bx.id}`, label: `${bx.patternName}预算金额及说明`, show: true }));
        node.children.splice(index < 0 ? node.children.length : index + 1, 0, ...dynamic);
      }
      if (node.id === "qzpsColumns") {
        const dynamic = banXing.value.map((bx) => ({ id: `qianzhipingshenBanxing${bx.id}`, label: `${bx.patternName}评估金额及说明`, show: true }));
        node.children.push(...banXing.value.map((bx) => ({ id: `qianzhipingshenBanxing2${bx.id}`, label: `${bx.patternName}评估支付金额`, show: true })));
        node.children.splice(0, 0, ...dynamic);
      }
      if (node.id === "psjlColumns") {
        const paymentNode = node.children.find((child: any) => child.id === "paymentAmount");
        if (paymentNode) paymentNode.show = true;
      }
    }
    return node;
  });
  return map(nodes);
}

function checkedColumnKeys(nodes: any[]) {
  const keys: string[] = [];
  const visit = (items: any[]) => items.forEach((item) => { if (item.show) keys.push(item.id); if (item.children) visit(item.children); });
  visit(nodes);
  return keys;
}

function updateColumnVisibility(_node: unknown, info: any) {
  const keys = info?.checkedKeys || [];
  const update = (items: any[]) => items.forEach((item) => { item.show = keys.includes(item.id); if (item.children) update(item.children); });
  update(colSelectTreeData.value);
  const reviewColumns = colSelectTreeData.value.find((item) => item.id === "psjlColumns")?.children || [];
  const paymentNode = reviewColumns.find((item: any) => item.id === "paymentAmount");
  if (paymentNode) paymentNode.show = true;
  visibleColumns.value = Array.from(
    collectVisibleColumns(colSelectTreeData.value),
  );
}

async function loadColumnController() {
  try {
    const res = await forModuleIdList("lxyspg");
    columnsGroup.value = unwrapRows(res);
    controllerOptionsActive.value = columnsGroup.value.length ? 0 : null;
  } catch {
    columnsGroup.value = [];
    controllerOptionsActive.value = null;
    visibleColumns.value = allColumnKeys();
  }
}

function allColumnKeys() {
  const keys = [
    "left-level", "left-wbs", "left-wbsName", "left-totalBudget", "left-submitter",
    "center-level", "center-wbs", "center-wbsName", "center-sorName", "center-assessTotal",
    "center-paymentRatio", "center-paymentEstimate", "center-reductionDiff", "center-reductionRatio",
    "right-level", "right-wbs", "right-wbsName", "right-paymentAmount", "right-amortizationAmount",
    "right-totalAmount", "right-remark", "right-totalOverspend", "right-paymentOverspend",
  ];
  banXing.value.forEach((bx) => keys.push(`left-budget-${bx.id}`, `left-remark-${bx.id}`, `center-assess-${bx.id}`, `center-assessRemark-${bx.id}`, `center-paymentBudget-${bx.id}`));
  return keys;
}

watch(controllerOptionsActive, (value) => {
  const option = columnsGroup.value[value ?? -1]?.option;
  if (!Array.isArray(option)) return;
  colSelectTreeData.value = buildColumnTree(option);
  visibleColumns.value = Array.from(
    collectVisibleColumns(colSelectTreeData.value),
  );
});

function formatPrice(value: any): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (isNaN(num)) return "";
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePrice(value: any): number | null {
  if (!value && value !== 0) return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function inputBlur(obj: any, key: string) {
  const val = obj[key];
  if (val !== undefined && val !== null && val !== "") {
    obj[key] = formatPrice(val);
  }
}

function inputFocus(obj: any, key: string) {
  const val = obj[key];
  if (val !== undefined && val !== null && val !== "") {
    obj[key] = parsePrice(val);
  }
}

function patternField(row: any, patternId: number, field: string): any {
  const item = row.initiationBudget?.find((i: any) =>
    sameBackendId(i.patternId, patternId),
  );
  return item ? item[field] == '0.00' ? '-'  : item[field] : "";
}

function setPatternField(
  row: any,
  patternId: number,
  field: string,
  val: any,
): void {
  const item = row.initiationBudget?.find((i: any) =>
    sameBackendId(i.patternId, patternId),
  );
  if (item) item[field] = val;
}

function patternItem(row: any, patternId: number): any {
  return row.initiationBudget?.find((i: any) =>
    sameBackendId(i.patternId, patternId),
  );
}

function normalizeGradeLevel(grade: any) {
  if (!grade) {
    return { gradeName: "", level: 0, realLevel: 1 };
  }
  return {
    ...grade,
    realLevel: grade.realLevel ?? Number(grade.level ?? 0) + 1,
  };
}

const banXing = computed<{ id: number; patternName: string }[]>(() => {
  const seen = new Set<string>();
  return patterns.value
    .map((item: any) => ({
      id: item.id,
      patternName: item.patternName ?? "",
    }))
    .filter((item) => {
      const key = String(item.id);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
});

const excelPasteColumns = computed<ExcelPasteColumn[]>(() => [
  { field: "sorName" },
  ...banXing.value.flatMap((_, index) => [
    {
      field: "assessBudget",
      rowChildField: "initiationBudget",
      childIndex: index,
    },
    {
      field: "assessRemark",
      rowChildField: "initiationBudget",
      childIndex: index,
    },
  ]),
  { field: "paymentRatio" },
  { field: "paymentEstimate" },
  ...banXing.value.map((_, index) => ({
    field: "paymentBudget",
    rowChildField: "initiationBudget",
    childIndex: index,
  })),
]);

const budgetPasteColumns = computed<ExcelPasteColumn[]>(() => [
  ...banXing.value.flatMap((_, index) => [
    {
      field: "budget",
      rowChildField: "initiationBudget",
      childIndex: index,
    },
    {
      field: "remark",
      rowChildField: "initiationBudget",
      childIndex: index,
    },
  ]),
  { field: "submitter" },
]);

function handleBudgetPaste(event: Event) {
  if (
    pasteTableRange(event, {
      rowsData: formMain.value,
      columns: budgetPasteColumns.value,
    })
  ) {
    event.preventDefault();
  }
}

function getTotalBudgetAmount(row: any) {
  if (
    row.totalBudgetAmount !== null &&
    row.totalBudgetAmount !== undefined &&
    row.totalBudgetAmount !== ""
  ) {
    return row.totalBudgetAmount;
  }
  const total = (row.initiationBudget || []).reduce(
    (sum: number, item: any) => sum + (parsePrice(item.budget) ?? 0),
    0,
  );
  return (row.initiationBudget || []).length ? total : null;
}

const reviewPasteColumns: ExcelPasteColumn[] = [
  { field: "paymentAmount" },
  { field: "amortizationAmount" },
  { field: "remark" },
];

function handleExcelPaste(event: Event) {
  if (
    pasteTableRange(event, {
      rowsData: formMain.value,
      columns: excelPasteColumns.value,
    })
  ) {
    event.preventDefault();
  }
}

function handleReviewPaste(event: Event) {
  if (
    pasteTableRange(event, {
      rowsData: formMain.value,
      columns: reviewPasteColumns,
    })
  ) {
    event.preventDefault();
  }
}

function initFormData() {
  const raw = [...tableData.value];
  const bxList = banXing.value.map((item) => item.id);
  formMain.value = raw.map((item) => {
    const fi: any = {
      id: item.id,
      gradeId: item.gradeId,
      grade: normalizeGradeLevel(item.grade),
      wbsNumber: item.wbsNumber,
      wbsName: item.wbsName,
      submitter: item.submitter || "",
      sorName: item.sorName || "",
      paymentRatio: item.paymentRatio || "",
      paymentEstimate: formatPrice(item.paymentEstimate),
      reductionDiff: item.reductionDiff,
      reductionRatio: item.reductionRatio,
      assessTotalAmount: item.assessTotalAmount,
      totalBudgetAmount: getTotalBudgetAmount(item),
      paymentAmount: formatPrice(item.paymentAmount),
      amortizationAmount: formatPrice(item.amortizationAmount),
      totalAmount: formatPrice(item.totalAmount),
      totalOverspend: formatPrice(item.totalOverspend),
      paymentOverspend: formatPrice(item.paymentOverspend),
      remark: item.remark || "",
      initiationBudget: [],
    };
    bxList.forEach((pid: number) => {
      const matched = item.initiationBudget?.find((ib) =>
        sameBackendId(ib.patternId, pid),
      );
      fi.initiationBudget.push({
        id: (matched as any)?.id ?? undefined,
        patternId: pid,
        budget: formatPrice(matched?.budget),
        remark: matched?.remark || "",
        assessBudget: formatPrice(matched?.assessBudget),
        assessRemark: matched?.assessRemark || "",
        paymentBudget: formatPrice(matched?.paymentBudget),
      });
    });
    return fi;
  });
}

function doFilter() {
  const hideIdx: number[] = [];
  if (searchSorName.value) {
    const term = searchSorName.value.toLowerCase();
    formMain.value.forEach((item, idx) => {
      if (!item.sorName || item.sorName.toLowerCase().indexOf(term) === -1) {
        hideIdx.push(idx);
      }
    });
  }
  if (searchReductionDiff.value) {
    const diff = parsePrice(searchReductionDiff.value);
    if (diff !== null) {
      formMain.value.forEach((item, idx) => {
        const rowDiff = parsePrice(item.reductionDiff);
        if (rowDiff !== null && Math.abs(rowDiff) !== Math.abs(diff)) {
          hideIdx.push(idx);
        }
      });
    }
  }
  tableFilterIndexArr.value = [...new Set(hideIdx)];
}

function clearFilter() {
  searchSorName.value = "";
  searchReductionDiff.value = "";
  doFilter();
}

function tableRowStyle({ rowIndex }: { rowIndex: number }) {
  if (tableFilterIndexArr.value.includes(rowIndex)) {
    return { display: "none" };
  }
  return {};
}

function cloneWithPrefix(row: Record<string, unknown>, prefix: string) {
  return Object.entries(row).reduce<Record<string, unknown>>(
    (result, [key, value]) => {
      result[`${prefix}${key}`] = value;
      return result;
    },
    {},
  );
}

function clearValues(value: any): any {
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clearValues(item)]),
    );
  }
  return null;
}

function emptyCompareRow(sourceRow?: any) {
  const fallback = sourceRow ?? formMain.value[0] ?? {};
  return clearValues(fallback);
}

function resetCompareData(rows: any[]) {
  return rows.map((project, index) => {
    const prefixName = `__BEIQI${index}__`;
    const sourceRows: any[] = Array.isArray(project.projectInitiation)
      ? project.projectInitiation
      : [];
    const projectInitiation = sourceRows.length
      ? sourceRows.map((item: any) => ({
          ...item,
          grade: normalizeGradeLevel(item.grade),
        }))
      : formMain.value.map((item) => ({
          ...emptyCompareRow(item),
          grade: normalizeGradeLevel(item.grade),
          gradeId: item.gradeId,
        }));
    return {
      ...project,
      projectInitiation: projectInitiation.map(
        (item: Record<string, unknown>) => cloneWithPrefix(item, prefixName),
      ),
    };
  });
}

function mergeCompareData(rowsArr: any[]) {
  formMain.value.forEach((item) => {
    rowsArr.forEach((rowObj, index) => {
      (rowObj.projectInitiation || []).forEach((cur: any) => {
        if (cur[`__BEIQI${index}__gradeId`] === item.gradeId) {
          Object.assign(item, cur);
        }
      });
    });
  });
}

function comparePatternField(
  row: any,
  marker: number,
  patternId: number | string,
  field: string,
) {
  const initiationBudget = row[`__BEIQI${marker}__initiationBudget`];
  const item = Array.isArray(initiationBudget)
    ? initiationBudget.find(
        (cur: any) => String(cur.patternId) === String(patternId),
      )
    : undefined;
  return item ? item[field] : "";
}

function resolveCompareProjectOption(project: any) {
  const projectId =
    typeof project === "object" && project !== null
      ? (project.projectId ?? project.id)
      : project;
  const projectName =
    typeof project === "object" && project !== null
      ? (project.projectName ??
        project.label ??
        project.vehicleModel?.modelName)
      : undefined;
  return compareProjects.value.find(
    (item) =>
      String(item.id) === String(projectId) ||
      (!!projectName && item.label === projectName),
  );
}

function resolveComparePatternName(project: any, patternId: number | string) {
  const optionProject = resolveCompareProjectOption(project);
  const optionProjectId =
    optionProject?.id ?? project?.projectId ?? project?.id;
  const optionName = optionProject?.children.find((item) => {
    const [, optionPatternId] = String(item.id).split("-");
    return (
      String(item.id) === `${optionProjectId}-${patternId}` ||
      String(optionPatternId) === String(patternId)
    );
  })?.label;
  const currentPatternName = patterns.value.find(
    (item) => String(item.id) === String(patternId),
  )?.patternName;
  return optionName ?? currentPatternName ?? String(patternId);
}

function comparePatternList(project: any, marker: number) {
  if (!project?.hasPattens) return [];
  const firstRow = project.projectInitiation?.[0];
  const initiationBudget = firstRow?.[`__BEIQI${marker}__initiationBudget`];
  if (!Array.isArray(initiationBudget)) return [];

  const seen = new Set<string>();
  return initiationBudget
    .map((item: any) => {
      const patternId = item.patternId;
      const key = String(patternId);
      if (!key || seen.has(key)) return null;
      seen.add(key);
      return {
        id: patternId,
        patternName:
          resolveComparePatternName(project, patternId) ||
          item.pattern?.patternName ||
          item.patternName ||
          key,
      };
    })
    .filter((item): item is { id: number | string; patternName: string } => Boolean(item));
}

function openCompareWbsDialog(
  project: any,
  row: Record<string, any>,
  marker: number,
  patterns: { id: number | string; patternName: string }[],
) {
  compareWbsDialogState.value = {
    projectName: String(project?.projectName ?? ""),
    row,
    marker,
    patterns,
  };
  compareWbsDialogVisible.value = true;
}

function selectedComparePatternNames(projectId: number | string) {
  const project = resolveCompareProjectOption(projectId);
  if (!project) return [];
  return compareSelect.value
    .map((value) => String(value))
    .filter((value) => value.startsWith(`${project.id}-`))
    .map(
      (value) =>
        project?.children.find((item) => String(item.id) === value)?.label,
    )
    .filter((value): value is string => Boolean(value));
}

function clearCompareResultState() {
  selectedProject.value = [];
  compareVisibleProjectKeys.value = [];
  compareWbsDialogVisible.value = false;
  compareWbsDialogState.value = null;
}

function normalizeCompareSelection(values?: unknown[] | null) {
  const validIds = new Set<string>();
  compareProjects.value.forEach((project) => {
    validIds.add(String(project.id));
    (project.children || []).forEach((item) => validIds.add(String(item.id)));
  });
  const next = (
    Array.isArray(values) ? values : []
  ).filter((value) => validIds.has(String(value))) as (string | number)[];
  compareSelect.value = next;
  if (!next.length) {
    clearCompareResultState();
  }
}

function handleCompareCheck(_data: unknown, checkedInfo: any) {
  normalizeCompareSelection(checkedInfo?.checkedKeys || compareSelect.value);
}

function resetCompareSelection() {
  compareSelect.value = [];
  clearCompareResultState();
}

function checkAuth(scope: any) {
  if (!scope.row.grade || !scope.row.grade.level) return true;
  return scope.row.grade.level < 5 || !canEditEvaluation.value;
}

function checkBudgetAuth(scope: any) {
  if (!scope.row.grade || !scope.row.grade.level) return true;
  return scope.row.grade.level < 5 || !canEditBudget.value;
}

function specificEditDisable(index: number) {
  if (!canEditEvaluation.value) return true;
  const paymentRatio = formMain.value[index]?.paymentRatio || "";
  if (paymentRatio && paymentRatio.indexOf(",") > 0) return false;
  return true;
}

function ratioValidate(index: number) {
  let value = (formMain.value[index]?.paymentRatio || "") + "";
  value = value
    .replace(/\s/g, "")
    .replace(/，/g, ",")
    .replace(/[^\d.,]/g, "");
  const arr = value.split(",").filter((s) => s !== "" && !isNaN(Number(s)));
  if (arr.length) {
    formMain.value[index].paymentRatio = arr.join(",");
  } else {
    formMain.value[index].paymentRatio = null;
  }
}

function resolveDetailReturnPath() {
  const returnPath = route.query.returnPath;
  if (typeof returnPath !== "string" || !returnPath.startsWith("/")) {
    return "/budget/wbs-touzi/lixiang";
  }

  // 评估页的 returnPath 是进入评估页前的查看页地址，
  // 需要继续取出查看页记录的列表地址，避免返回参数嵌套一层。
  try {
    const detailUrl = new URL(returnPath, "http://localhost");
    const parentReturnPath = detailUrl.searchParams.get("returnPath");
    if (parentReturnPath?.startsWith("/")) return parentReturnPath;
  } catch {
    // 非标准地址继续使用当前返回地址。
  }

  return returnPath;
}

function goBack(refresh?: boolean) {
  clearSelectedRowsCache();
  const returnPath = resolveDetailReturnPath();
  void router.replace({
    path: "/budget/initiation/detail",
    query: {
      projectId: projectId.value,
      modelName: modelName.value,
      _t: refresh ? Date.now().toString() : undefined,
      returnPath,
    },
  });
}

async function handleSave() {
  saving.value = true;
  try {
    const postData: InitiationAssessSaveItem[] = formMain.value.map((item) => {
      const row: InitiationAssessSaveItem = {
        id: item.id,
        gradeId: item.gradeId,
        ...(item.submitter !== undefined ? { submitter: item.submitter } : {}),
        sorName: item.sorName,
        paymentRatio: item.paymentRatio,
        paymentEstimate: String(parsePrice(item.paymentEstimate) ?? ""),
        initiationBudget: item.initiationBudget.map((ib: any) => ({
          id: ib.id,
          patternId: ib.patternId,
          budget: ib.budget ? String(parsePrice(ib.budget) ?? "") : "",
          remark: ib.remark,
          assessBudget: ib.assessBudget
            ? String(parsePrice(ib.assessBudget) ?? "")
            : "",
          assessRemark: ib.assessRemark,
          paymentBudget: ib.paymentBudget
            ? String(parsePrice(ib.paymentBudget) ?? "")
            : "",
        })),
        paymentAmount: String(parsePrice(item.paymentAmount) ?? ""),
        amortizationAmount: String(parsePrice(item.amortizationAmount) ?? ""),
        totalAmount: String(parsePrice(item.totalAmount) ?? ""),
        totalOverspend: String(parsePrice(item.totalOverspend) ?? ""),
        paymentOverspend: String(parsePrice(item.paymentOverspend) ?? ""),
        remark: item.remark,
        totalBudgetAmount: undefined,
      };
      return row;
    });
    await saveInitiationAssess(postData);
    BaseToast.success("操作成功");
    goBack(true);
  } catch {
  } finally {
    saving.value = false;
  }
}

async function handleCompare() {
  if (!compareSelect.value.length) return;
  loading.value = true;
  const gradeIds = formMain.value.map((item) =>
    item.gradeId ? item.gradeId : "null",
  );
  const projectCompareData: { projectId: number; patternIds: number[] }[] = [];
  const map = new Map<number, Set<number>>();
  for (const val of compareSelect.value) {
    const str = String(val);
    if (str.includes("-")) {
      const [pid, patId] = str.split("-").map(Number);
      if (!map.has(pid)) map.set(pid, new Set());
      map.get(pid)!.add(patId);
    } else {
      const pid = Number(val);
      if (!map.has(pid)) map.set(pid, new Set());
    }
  }
  for (const [projectId, patternIds] of map) {
    projectCompareData.push({
      projectId,
      patternIds: [...patternIds].sort((a, b) => a - b),
    });
  }
  try {
    const response = await fetchAssessCompareData({
      gradeIds,
      projectCompareData,
    });
    const rows = resetCompareData(unwrapRows(response));
    rows.forEach((item) => {
      item.selectedPatternNames = selectedComparePatternNames(item);
      item.hasPattens = item.selectedPatternNames.length > 0;
    });
    selectedProject.value = rows;
    compareVisibleProjectKeys.value = selectedProject.value.map((_, index) =>
      compareProjectKey(index),
    );
    mergeCompareData(selectedProject.value);
  } catch {
  } finally {
    loading.value = false;
  }
}

async function loadCompareList() {
  try {
    compareProjects.value = (await fetchAssessCompareList()).filter(
      (item) => String(item.id) !== projectId.value,
    );
  } catch {
    compareProjects.value = [];
    BaseToast.error("对比项目加载失败");
  }
}

function resetPageState() {
  tableData.value = [];
  formMain.value = [];
  compareSelect.value = [];
  selectedProject.value = [];
  searchSorName.value = "";
  searchReductionDiff.value = "";
  tableFilterIndexArr.value = [];
}

const tableData = ref<InitiationWbsItem[]>([]);

async function loadData() {
  if (!projectId.value) return;
  loading.value = true;
  try {
    patterns.value = await fetchInitiationPatterns(projectId.value);
    const ids = selectedIds.value.split(",").filter(Boolean);
    let selectedRows: InitiationWbsItem[] = [];
    if (selectedRowsKey.value) {
      try {
        const raw = window.sessionStorage.getItem(selectedRowsKey.value);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) {
          selectedRows = parsed.filter((item) =>
            ids.includes(String(item?.id)),
          );
        }
      } catch {
        selectedRows = [];
      }
    }

    if (selectedRows.length === ids.length && ids.length > 0) {
      tableData.value = selectedRows;
    } else {
      const res = await fetchInitiationWbsItems({
        projectId: projectId.value,
        pageSize: 1000,
        pageNum: 1,
        isLatestVersion: majorVersion.value ? null : 1,
        majorVersion: majorVersion.value || null,
        abolishFlag: abolishFlag.value,
      });
      tableData.value = (res.rows || []).filter((item) =>
        ids.includes(String(item.id)),
      );
    }
  } catch {
    patterns.value = [];
    tableData.value = [];
    BaseToast.error("预算评估数据加载失败");
  }
  if (tableData.value.length) {
    initFormData();
    visibleColumns.value = allColumnKeys();
    if (!visibleColumns.value.includes("right-paymentAmount")) {
      visibleColumns.value.push("right-paymentAmount");
    }
  }
  loading.value = false;
}

async function refreshPage() {
  resetPageState();
  await loadData();
  await loadCompareList();
  await loadColumnController();
}

onMounted(() => {
  void refreshPage();
});

watch([projectId, modelName, selectedIds, majorVersion, abolishFlag], () => {
  void refreshPage();
});
</script>

<template>
  <PageContainer
    class="budget-initiation-assess-page"
    title="立项评估预算评审"
    :description="`WBS立项评估：${modelName}`"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack()"
        >返回</PermissionButton
      >
    </template>

    <div class="assess-controls">
      <el-form :inline="true" size="small" class="assess-form">
        <el-form-item label="对比项目">
            <el-tree-select
              v-model="compareSelect"
              :data="compareProjects"
              multiple
              check-strictly
              show-checkbox
              collapse-tags
              collapse-tags-tooltip
              placeholder="请选择"
              style="width: 220px"
              node-key="id"
              :props="{ label: 'label', value: 'id', children: 'children' }"
              clearable
              @clear="resetCompareSelection"
              @check="handleCompareCheck"
              @change="normalizeCompareSelection"
            />
        </el-form-item>
        <el-form-item>
            <PermissionButton
              :icon="DocumentCopy"
              variant="primary"
              type="primary"
              :disabled="!compareSelect.length"
              @click="handleCompare"
              >对比</PermissionButton
            >
            <PermissionButton :icon="Refresh" @click="resetCompareSelection"
              >重置</PermissionButton
            >
        </el-form-item>
        <el-form-item label="SOR集团统筹名称">
          <el-input
            v-model="searchSorName"
            style="width: 180px"
            placeholder="请输入"
            clearable
          />
        </el-form-item>
        <el-form-item label="核减差值">
          <el-input
            v-model="searchReductionDiff"
            type="number"
            style="width: 180px"
            placeholder="请输入"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <PermissionButton :icon="Search" type="primary" @click="doFilter"
            >搜索</PermissionButton
          >
          <PermissionButton :icon="Refresh" @click="clearFilter"
            >重置</PermissionButton
          >
        </el-form-item>
      </el-form>
    </div>

    <div class="assess-tables">
      <div class="table-section" @paste.capture="handleBudgetPaste">
        <div class="table-title-bar">
          <BaseSectionTitle class="table-header" title="极致成本预算前置数据">
            <template #actions>
              <div class="table-header-actions">
            <el-select v-if="controllerOptions.length" v-model="controllerOptionsActive" placeholder="请选择" class="header-controller-select" style="width: 160px">
              <el-option v-for="item in controllerOptions" :key="`controller-option-${item.value}`" :label="item.label" :value="item.value" />
            </el-select>
            <el-popover trigger="click" placement="bottom-end" width="260">
              <template #reference>
                <el-button
                  class="column-settings-icon-button"
                  circle
                  :icon="Setting"
                  aria-label="列设置"
                  title="列设置"
                />
              </template>
              <el-tree :key="`${controllerOptionsActive ?? 'column-tree'}-${banXing.length}`" :data="colSelectTreeData" show-checkbox node-key="id" default-expand-all :default-checked-keys="checkedColumnKeys(colSelectTreeData)" @check="updateColumnVisibility" />
            </el-popover>
            <div class="page-container__fullscreen-target" />
              </div>
            </template>
          </BaseSectionTitle>
        </div>
        <BaseDataTable
          :data="formMain"
          :loading="loading"
          border
          :row-style="tableRowStyle"
          size="small"
        >
          <el-table-column
            v-if="visibleColumns.includes('left-level')"
            label="层级"
            width="50"
            align="center"
            prop="grade.realLevel"
          />
          <el-table-column
            v-if="visibleColumns.includes('left-wbs')"
            label="WBS"
            width="150"
            align="center"
            prop="wbsNumber"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="visibleColumns.includes('left-wbsName')"
            label="WBS名称"
            width="160"
            align="center"
            prop="wbsName"
            show-overflow-tooltip
          />
          <template v-for="(bx, bxIndex) in banXing" :key="'lb-' + bx.id">
            <el-table-column
              v-if="visibleColumns.includes('left-budget-' + bx.id)"
              :label="bx.patternName"
              min-width="130"
              align="center"
            >
              <template #default="{ row, $index }">
                <el-input
                  :model-value="patternField(row, bx.id, 'budget')"
                  :disabled="checkBudgetAuth({ row })"
                  placeholder="请输入金额"
                  data-excel-paste-field="budget"
                  :data-excel-paste-row-index="$index"
                  :data-excel-paste-child-index="bxIndex"
                  @blur="inputBlur(patternItem(row, bx.id), 'budget')"
                  @focus="inputFocus(patternItem(row, bx.id), 'budget')"
                  @update:model-value="
                    (val: any) => setPatternField(row, bx.id, 'budget', val)
                  "
                />
              </template>
            </el-table-column>
            <el-table-column
              v-if="visibleColumns.includes('left-remark-' + bx.id)"
              label="费用说明"
              min-width="150"
              align="center"
              show-overflow-tooltip
            >
              <template #default="{ row, $index }">
                <el-input
                  :model-value="patternField(row, bx.id, 'remark')"
                  :disabled="checkBudgetAuth({ row })"
                  placeholder="请输入内容"
                  data-excel-paste-field="remark"
                  :data-excel-paste-row-index="$index"
                  :data-excel-paste-child-index="bxIndex"
                  @update:model-value="
                    (val: any) => setPatternField(row, bx.id, 'remark', val)
                  "
                />
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="visibleColumns.includes('left-totalBudget')"
            label="预算总金额"
            min-width="130"
            align="center"
          >
            <template #default="{ row }">{{
              formatPrice(row.totalBudgetAmount)
            }}</template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('left-submitter')"
            label="预算提报人"
            min-width="120"
            align="center"
            prop="submitter"
          >
            <template #default="{ row }">
              <el-input v-model="row.submitter" placeholder="请输入" />
            </template>
          </el-table-column>
        </BaseDataTable>
      </div>

      <div
        v-if="canDisplayEvaluation"
        class="table-section"
        @paste.capture="handleExcelPaste"
      >
        <BaseSectionTitle
          class="table-header"
          title="极致成本预算前置评审"
        />
        <BaseDataTable
          :data="formMain"
          :loading="loading"
          border
          :row-style="tableRowStyle"
          size="small"
        >
          <el-table-column
            v-if="visibleColumns.includes('center-level')"
            label="层级"
            width="50"
            align="center"
            prop="grade.realLevel"
          />
          <el-table-column
            v-if="visibleColumns.includes('center-wbs')"
            label="WBS"
            width="150"
            align="center"
            prop="wbsNumber"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="visibleColumns.includes('center-wbsName')"
            label="WBS名称"
            width="160"
            align="center"
            prop="wbsName"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="visibleColumns.includes('center-sorName')"
            label="集团统筹SOR名称"
            min-width="150"
            align="center"
          >
            <template #default="{ row, $index }">
              <el-input
                v-model="row.sorName"
                placeholder="请输入SOR名称"
                data-excel-paste-field="sorName"
                :data-excel-paste-row-index="$index"
                :disabled="!canEditEvaluation"
              />
            </template>
          </el-table-column>
          <template v-for="(bx, bxIndex) in banXing" :key="'ca-' + bx.id">
            <el-table-column
              v-if="visibleColumns.includes('center-assess-' + bx.id)"
              :label="`${bx.patternName}评估金额`"
              min-width="150"
              align="center"
            >
              <template #default="{ row, $index }">
                <el-input
                  placeholder="请输入金额"
                  :disabled="checkAuth({ row })"
                  data-excel-paste-field="assessBudget"
                  :data-excel-paste-row-index="$index"
                  :data-excel-paste-child-index="bxIndex"
                  :model-value="patternField(row, bx.id, 'assessBudget')"
                  @blur="inputBlur(patternItem(row, bx.id), 'assessBudget')"
                  @focus="inputFocus(patternItem(row, bx.id), 'assessBudget')"
                  @update:model-value="
                    (val: any) =>
                      setPatternField(row, bx.id, 'assessBudget', val)
                  "
                />
              </template>
            </el-table-column>
            <el-table-column
              v-if="visibleColumns.includes('center-assessRemark-' + bx.id)"
              label="评估说明"
              min-width="200"
              align="center"
            >
              <template #default="{ row, $index }">
                <el-input
                  placeholder="请输入评估备注"
                  data-excel-paste-field="assessRemark"
                  :data-excel-paste-row-index="$index"
                  :data-excel-paste-child-index="bxIndex"
                  :model-value="patternField(row, bx.id, 'assessRemark')"
                  :disabled="!canEditEvaluation"
                  @update:model-value="
                    (val: any) =>
                      setPatternField(row, bx.id, 'assessRemark', val)
                  "
                />
              </template>
            </el-table-column>
          </template>
          <el-table-column
            v-if="visibleColumns.includes('center-assessTotal')"
            label="合计"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{
              formatPrice(row.assessTotalAmount)
            }}</template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('center-paymentRatio')"
            label="支付比例"
            min-width="160"
            align="center"
          >
            <template #default="{ row, $index }">
              <el-input
                v-model="row.paymentRatio"
                placeholder="请输入"
                :disabled="checkAuth({ row })"
                data-excel-paste-field="paymentRatio"
                :data-excel-paste-row-index="$index"
                @blur="ratioValidate($index)"
              >
                <template #append>%</template>
              </el-input>
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('center-paymentEstimate')"
            label="支付评估金额"
            min-width="140"
            align="center"
          >
            <template #default="{ row, $index }">
              <el-input
                v-model="row.paymentEstimate"
                :disabled="specificEditDisable($index)"
                placeholder="请输入金额"
                data-excel-paste-field="paymentEstimate"
                :data-excel-paste-row-index="$index"
                @blur="inputBlur(row, 'paymentEstimate')"
                @focus="inputFocus(row, 'paymentEstimate')"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('center-reductionDiff')"
            label="核减差值"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{
              formatPrice(row.reductionDiff)
            }}</template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('center-reductionRatio')"
            label="核减比例"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">
              <span v-if="row.reductionRatio">{{ row.reductionRatio }}%</span>
            </template>
          </el-table-column>
          <template v-for="(bx, bxIndex) in banXing" :key="'cp-' + bx.id">
            <el-table-column
              v-if="visibleColumns.includes('center-paymentBudget-' + bx.id)"
              min-width="150"
              align="center"
            >
              <template #header>
                <span v-html="bx.patternName + '<br/>评估支付金额'"></span>
              </template>
              <template #default="{ row, $index }">
                <el-input
                  :disabled="specificEditDisable($index)"
                  placeholder="请输入金额"
                  data-excel-paste-field="paymentBudget"
                  :data-excel-paste-row-index="$index"
                  :data-excel-paste-child-index="bxIndex"
                  :model-value="patternField(row, bx.id, 'paymentBudget')"
                  @blur="inputBlur(patternItem(row, bx.id), 'paymentBudget')"
                  @focus="inputFocus(patternItem(row, bx.id), 'paymentBudget')"
                  @update:model-value="
                    (val: any) =>
                      setPatternField(row, bx.id, 'paymentBudget', val)
                  "
                />
              </template>
            </el-table-column>
          </template>
        </BaseDataTable>
      </div>

      <div
        v-if="canDisplayReviewRecord"
        class="table-section"
        @paste.capture="handleReviewPaste"
      >
        <BaseSectionTitle class="table-header" title="评审记录" />
        <BaseDataTable
          :data="formMain"
          :loading="loading"
          border
          :row-style="tableRowStyle"
          size="small"
        >
          <el-table-column
            v-if="visibleColumns.includes('right-level')"
            label="层级"
            width="50"
            align="center"
            prop="grade.realLevel"
          />
          <el-table-column
            v-if="visibleColumns.includes('right-wbs')"
            label="WBS"
            width="150"
            align="center"
            prop="wbsNumber"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="visibleColumns.includes('right-wbsName')"
            label="WBS名称"
            width="160"
            align="center"
            prop="wbsName"
            show-overflow-tooltip
          />
          <el-table-column
            v-if="visibleColumns.includes('right-paymentAmount')"
            label="支付"
            min-width="140"
            align="center"
          >
            <template #default="{ row, $index }">
              <el-input
                v-model="row.paymentAmount"
                placeholder="请输入金额"
                data-excel-paste-field="paymentAmount"
                :data-excel-paste-row-index="$index"
                @blur="inputBlur(row, 'paymentAmount')"
                @focus="inputFocus(row, 'paymentAmount')"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-amortizationAmount')"
            label="摊销"
            min-width="140"
            align="center"
          >
            <template #default="{ row, $index }">
              <el-input
                v-model="row.amortizationAmount"
                placeholder="请输入金额"
                data-excel-paste-field="amortizationAmount"
                :data-excel-paste-row-index="$index"
                @blur="inputBlur(row, 'amortizationAmount')"
                @focus="inputFocus(row, 'amortizationAmount')"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-totalAmount')"
            label="合计"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{ row.totalAmount }}</template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-remark')"
            label="备注"
            min-width="140"
            align="center"
          >
            <template #default="{ row, $index }">
              <el-input
                v-model="row.remark"
                placeholder="请输入备注"
                data-excel-paste-field="remark"
                :data-excel-paste-row-index="$index"
                clearable
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-totalOverspend')"
            label="总金额超支"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{ row.totalOverspend || '-'}}</template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-paymentOverspend')"
            label="支付超支"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{ row.paymentOverspend || '-'}}</template>
          </el-table-column>
        </BaseDataTable>
      </div>
    </div>

    <div v-if="selectedProject.length" class="compare-section">
      <div class="compare-title">
        <div class="compare-title__list">
          对比项目
          <span
            v-for="(item, index) in selectedProject"
            :key="`${item.projectName || ''}-${index}`"
          >
            {{ item.projectName }}({{
              item.hasPattens ? "已选版型" : "未选版型"
            }})
          </span>
        </div>
        <div class="compare-title__actions">
          <BaseColumnSettings
            v-model="compareVisibleProjectKeys"
            :columns="compareProjectColumns"
            button-text="列显示"
          />
        </div>
      </div>
      <div class="compare-grid">
        <template v-for="(item, index) in selectedProject" :key="`initiation-compare-${index}`">
          <div
            v-if="compareVisibleProjectKeys.includes(compareProjectKey(index))"
            class="compare-card"
          >
            <BaseSectionTitle
              class="table-header"
              :title="`${item.projectName}(${item.hasPattens ? '已选版型' : '未选版型'}) - 评估`"
            />
            <BaseDataTable
              :data="item.projectInitiation || []"
              border
              size="small"
              style="width: 100%;"
              table-layout="fixed"
            >
              <el-table-column label="层级" align="center">
                <template #default="{ row }">
                  {{
                    row[`__BEIQI${index}__grade`]?.realLevel ??
                    row[`__BEIQI${index}__grade`]?.level ??
                    ""
                  }}
                </template>
              </el-table-column>
              <el-table-column
                label="WBS"
                align="center"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{ row[`__BEIQI${index}__wbsNumber`] ?? "" }}
                </template>
              </el-table-column>
              <el-table-column
                label="WBS名称"
                align="center"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  <span
                    class="compare-wbs-link"
                    @click.stop="
                      openCompareWbsDialog(
                        item,
                        row,
                        index,
                        comparePatternList(item, index),
                      )
                    "
                  >
                    {{ row[`__BEIQI${index}__wbsName`] ?? "" }}
                  </span>
                </template>
              </el-table-column>
              <template v-if="item.hasPattens">
                <template
                  v-for="pattern in comparePatternList(item, index)"
                  :key="`compare-pattern-budget-${index}-${pattern.id}`"
                >
                  <el-table-column
                    :label="pattern.patternName"
                    align="center"
                  >
                    <template #default="{ row }">
                      {{
                        formatPrice(
                          comparePatternField(row, index, pattern.id, "budget"),
                        )
                      }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="费用说明"
                    align="center"
                    show-overflow-tooltip
                  >
                    <template #default="{ row }">
                      {{ comparePatternField(row, index, pattern.id, "remark") }}
                    </template>
                  </el-table-column>
                </template>
                <el-table-column label="预算总金额" align="center">
                  <template #default="{ row }">
                    {{ formatPrice(row[`__BEIQI${index}__totalBudgetAmount`]) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-for="pattern in comparePatternList(item, index)"
                  :key="`compare-pattern-payment-${index}-${pattern.id}`"
                  align="center"
                >
                  <template #header>
                    <span>{{ pattern.patternName }}<br />评估支付金额</span>
                  </template>
                  <template #default="{ row }">
                    {{
                      formatPrice(
                        comparePatternField(
                          row,
                          index,
                          pattern.id,
                          "paymentBudget",
                        ),
                      )
                    }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canDisplayEvaluation"
                  label="评估总金额"
                  align="center"
                >
                  <template #default="{ row }">
                    {{ formatPrice(row[`__BEIQI${index}__assessTotalAmount`]) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canDisplayEvaluation"
                  label="支付评估金额"
                  align="center"
                >
                  <template #default="{ row }">
                    {{ formatPrice(row[`__BEIQI${index}__paymentEstimate`]) }}
                  </template>
                </el-table-column>
              </template>
              <template v-else>
                <el-table-column label="预算总金额" align="center">
                  <template #default="{ row }">
                    {{ formatPrice(row[`__BEIQI${index}__totalBudgetAmount`]) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canDisplayEvaluation"
                  label="评估总金额"
                  align="center"
                >
                  <template #default="{ row }">
                    {{ formatPrice(row[`__BEIQI${index}__assessTotalAmount`]) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canDisplayEvaluation"
                  label="支付评估金额"
                  align="center"
                >
                  <template #default="{ row }">
                    {{ formatPrice(row[`__BEIQI${index}__paymentEstimate`]) }}
                  </template>
                </el-table-column>
              </template>
            </BaseDataTable>
          </div>
        </template>
      </div>
    </div>
    <BudgetInitiationCompareWbsDialog
      v-model="compareWbsDialogVisible"
      :project-name="compareWbsDialogState?.projectName || ''"
      :row="compareWbsDialogState?.row || null"
      :marker="compareWbsDialogState?.marker || 0"
      :patterns="compareWbsDialogState?.patterns || []"
    />

    <div class="budget-initiation-assess-page__footer">
      <PermissionButton variant="secondary" @click="goBack()">
        取消
      </PermissionButton>
      <PermissionButton
        permission="system:project:initiation:edit"
        variant="primary"
        type="primary"
        :loading="saving"
        :icon="null"
        @click="handleSave"
      >
        保存
      </PermissionButton>
    </div>
  </PageContainer>
</template>

<style scoped>
.budget-initiation-assess-page {
  background: var(--bq-color-surface);
}

.budget-initiation-assess-page.is-page-fullscreen {
  background: #ffffff !important;
}

.budget-initiation-assess-page.is-page-fullscreen :deep(.page-container__header) {
  top: -24px;
  z-index: 1000;
  margin: -24px -32px 16px;
}

.budget-initiation-assess-page.is-page-fullscreen :deep(.page-container__body) {
  background: #ffffff;
  align-content: start;
}

.budget-initiation-assess-page :deep(.page-container__body){
  gap:0 !important;
  padding-bottom: 76px;
}

.budget-initiation-assess-page__footer {
  position: fixed;
  right: var(--bq-space-page-x, 16px);
  bottom: 0;
  left: calc(var(--app-sidebar-width, 0px) + var(--bq-space-page-x, 16px));
  z-index: 20;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  min-height: 60px;
  padding: 12px;
  background: var(--bq-color-surface, #fff);
  border-top: 1px solid var(--bq-color-border-subtle, #e5e7eb);
  box-shadow: 0 -4px 12px rgb(15 23 42 / 6%);
}

:global(.page-container.is-page-fullscreen .budget-initiation-assess-page__footer),
:global(body.bq-page-fullscreen-active .budget-initiation-assess-page__footer) {
  right: 32px;
  left: 32px;
}

@media (max-width: 960px) {
  .budget-initiation-assess-page__footer {
    right: 16px;
    left: 16px;
  }
}

.assess-controls {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  font-size: var(--bq-font-compact);
}
.assess-form {
  flex: 1;
  margin-top: 2px;
}
.assess-form :deep(.el-form-item) {
  margin-bottom: 6px;
  align-items: center;
  margin-right: 15px;
}
.assess-form :deep(.el-form-item__label) {
  display: inline-flex;
  height: var(--bq-control-height);
  align-items: center;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact);
  font-weight: 400;
  line-height: var(--bq-control-height);
}
.assess-form :deep(.el-form-item__content) {
  min-height: var(--bq-control-height);
  align-items: center;
  font-size: var(--bq-font-compact);
}
.assess-form :deep(.el-button),
.assess-form :deep(.el-input),
.assess-form :deep(.el-select),
.assess-form :deep(.el-tree-select),
.assess-form :deep(.el-input__inner),
.assess-form :deep(.el-select__placeholder),
.assess-form :deep(.el-select__selected-item),
.assess-form :deep(.el-tree-select__placeholder),
.assess-form :deep(.el-tree-select__selected-item) {
  font-size: var(--bq-font-compact);
}
.assess-form :deep(.el-input__wrapper),
.assess-form :deep(.el-select__wrapper),
.assess-form :deep(.el-tree-select__wrapper) {
  min-height: var(--bq-control-height);
}
.assess-tables :deep(.el-input),
.assess-tables :deep(.el-input__inner),
.assess-tables :deep(.el-input-group__append) {
  font-size: var(--bq-font-compact);
}
.assess-tables :deep(.el-table__body-wrapper .el-scrollbar) {
  padding-bottom: 14px;
}
.assess-tables :deep(.el-table__body-wrapper .el-scrollbar__bar.is-horizontal) {
  bottom: 4px;
}
.table-section {
  margin-bottom: 16px;
}
.compare-section {
  margin-top: -8px;
}
.compare-title {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 12px;
  align-items: center;
  padding: 0px 0 10px;
  color: var(--bq-color-text);
  font-size: var(--bq-font-section-title);
  font-weight: 600;
}
.compare-title__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
  align-items: center;
}
.compare-title__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}
.compare-title span {
  color: var(--bq-color-primary);
  font-size: var(--bq-font-compact);
  font-weight: 500;
}
.compare-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.compare-grid:has(.compare-card:only-child) {
  grid-template-columns: minmax(0, 1fr);
}
.compare-card {
  min-width: 0;
  overflow: hidden;
}
.compare-card :deep(.el-table__body-wrapper .el-scrollbar) {
  padding-bottom: 14px;
}
.compare-card :deep(.el-table__body-wrapper .el-scrollbar__bar.is-horizontal) {
  bottom: 4px;
}
.compare-wbs-link {
  color: var(--el-color-primary);
  cursor: pointer;
}
.compare-wbs-link:hover {
  text-decoration: underline;
}
.table-header {
  position: relative;
  display: flex;
  min-height: 32px;
  align-items: center;
  margin-bottom: 10px;
  padding: 0 0 10px;
  text-align: left;
}

.table-title-bar {
  position: relative;
}

.table-header-actions {
  position: static;
  display: flex;
  align-items: center;
  gap: 8px;
}
.column-settings-icon-button {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  --el-button-text-color: #909399;
  --el-button-border-color: #dcdfe6;
  --el-button-hover-text-color: #409eff;
  --el-button-hover-border-color: #b3d8ff;
  --el-button-hover-bg-color: #ecf5ff;
}
.page-container__fullscreen-target {
  display: inline-flex;
  align-items: center;
}

</style>
