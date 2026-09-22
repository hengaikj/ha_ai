<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { Back, DocumentCopy, Refresh, Search, Setting } from "@element-plus/icons-vue";
import {
  forModuleIdList,
  getCompareListClique,
  getProjectListGuofa,
  getValveCompareData,
  updateProjectForm,
} from "@/api/budget";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import BaseColumnSettings from "@/components/base/BaseColumnSettings.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import { BaseToast } from "@/components/base/BaseToast";
import BudgetGateReviewCompareWbsDialog from "@/pages/budget/clique/BudgetGateReviewCompareWbsDialog.vue";
import type { GateReviewWbsItem } from "@/types/budget";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const projectId = computed(() => String(route.query.projectId ?? ""));
const valveId = computed(() => String(route.query.valveId ?? ""));
const projectName = computed(() => String(route.query.projectName ?? ""));
const valveName = computed(() =>
  decodeQueryText(String(route.query.valveName ?? "")),
);
const selectedIds = computed(() => String(route.query.ids ?? ""));
const selectedRowsKey = computed(() =>
  String(route.query.selectedRowsKey ?? ""),
);
const budgetLock = computed(() => String(route.query.budgetLock ?? "0"));
const isLock = computed(() => String(route.query.isLock ?? ""));
const passStatus = computed(() => String(route.query.passStatus ?? ""));
const majorVersion = computed(() => String(route.query.majorVersion ?? ""));
const abolishFlag = computed(() => {
  const value = String(route.query.abolishFlag ?? "");
  return value === "0" || value === "1" ? Number(value) : undefined;
});
const canDisplayEvaluation = computed(() =>
  authStore.hasPermission("system:project:eva:display"),
);

function clearSelectedRowsCache() {
  if (!selectedRowsKey.value) return;
  try {
    window.sessionStorage.removeItem(selectedRowsKey.value);
  } catch {
    // 浏览器存储不可用时无需额外处理。
  }
}

onBeforeUnmount(clearSelectedRowsCache);

function decodeQueryText(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasRequestValue(value: unknown) {
  return value !== "" && value !== null && value !== undefined;
}

function compactParams<T extends Record<string, unknown>>(params: T) {
  return Object.entries(params).reduce<Record<string, unknown>>(
    (result, [key, value]) => {
      if (hasRequestValue(value)) {
        result[key] = value;
      }
      return result;
    },
    {},
  ) as Partial<T>;
}

const loading = ref(false);
const saving = ref(false);
const patterns = ref<{ name: string }[]>([]);
const cliqueTitle = ref("");
const tableData = ref<GateReviewWbsItem[]>([]);
const formMain = ref<any[]>([]);
const patternValues = ref<
  { budget: string; remark: string; patternId?: number }[][]
>([]);
const occupiedBudget = ref<{ budget: string }[]>([]);
const releaseBudget = ref<{ budget: string; remark: string }[]>([]);
const occupiedBudgetRemark = ref<{ remark: string }[]>([]);
const tableFilterIndexArr = ref<number[]>([]);
const searchSorName = ref("");
const searchReductionDiff = ref("");

const compareOptions = ref<any[]>([]);
const compareSelect = ref<(string | number)[]>([]);
const columnsGroup = ref<Record<string, unknown>[]>([]);
const colSelectTreeData = ref<any[]>([]);
const selectedProject = ref<any[]>([]);
const compareVisibleProjectKeys = ref<string[]>([]);
const controllerOptionsActive = ref<number | null>(null);

const columnOptions = ref<{ key: string; label: string }[]>([]);
const visibleColumns = ref<string[]>([]);
const compareWbsDialogVisible = ref(false);
const compareWbsDialogState = ref<{
  valveName: string;
  row: Record<string, any> | null;
  marker: number;
} | null>(null);

const controllerOptions = computed(() =>
  columnsGroup.value.map((item, index) => ({
    value: index,
    label: String(item.name ?? ""),
  })),
);
const compareProjectColumns = computed(() =>
  selectedProject.value.map((item, index) => ({
    key: compareProjectKey(index),
    label: `${item.projectName}(${item.valveName})`,
  })),
);

const compareGridColumns = computed(() => {
  const visibleCount = selectedProject.value.reduce((count, _, index) => {
    return count +
      (compareVisibleProjectKeys.value.includes(compareProjectKey(index))
        ? 1
        : 0);
  }, 0);
  return Math.max(1, Math.min(2, visibleCount || selectedProject.value.length || 1));
});

const compareLeafIdSet = computed(() => {
  const ids = new Set<string>();
  compareOptions.value.forEach((project) => {
    (project.children || []).forEach((item: any) => {
      ids.add(String(item.id));
    });
  });
  return ids;
});

const legacyColumnMap: Record<string, string[]> = {
  "qzsjColumns-level": ["left-level", "right-level"],
  "qzsjColumns-wbsNumber": ["left-wbs", "right-wbs"],
  "qzsjColumns-wbsName": ["left-wbsName", "right-wbsName"],
  "qzsjColumns-totalBudgetAmount": ["left-totalBudget"],
  "qzsjColumns-occupiedBudgetAmount": ["left-occupied"],
  "qzsjColumns-occupiedBudgetRemark": ["left-occupiedRemark"],
  "qzsjColumns-releaseBudgetAmount": ["left-release"],
  "qzsjColumns-releaseBudgetRemark": ["left-releaseRemark"],
  "qzsjColumns-submitter": ["left-submitter"],
  "qzpsColumns-sorName": ["right-sorName"],
  "qzpsColumns-budget": ["right-assess"],
  "qzpsColumns-remark": ["right-assessRemark"],
  "qzpsColumns-paymentRatio": ["right-paymentRatio"],
  "qzpsColumns-paymentEstimate": ["right-paymentEstimate"],
  "qzpsColumns-reductionDiff": ["right-reductionDiff"],
  "qzpsColumns-reductionRatio": ["right-reductionRatio"],
};

function unwrapRows<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
}

function compareProjectKey(index: number) {
  return `compare-project-${index}`;
}

function filterCompareLeafValues(values: unknown[]) {
  return values.filter((value) =>
    compareLeafIdSet.value.has(String(value)),
  ) as (string | number)[];
}

function clearCompareResultState() {
  selectedProject.value = [];
  compareVisibleProjectKeys.value = [];
  compareWbsDialogVisible.value = false;
  compareWbsDialogState.value = null;
}

function syncCompareLeafSelection(values?: unknown[] | null) {
  const next = filterCompareLeafValues(
    Array.isArray(values) ? values : [],
  );
  const isSame =
    next.length === compareSelect.value.length &&
    next.every(
      (value, index) => String(value) === String(compareSelect.value[index]),
    );
  if (!isSame) {
    compareSelect.value = next;
  }
  if (!next.length) {
    clearCompareResultState();
  }
}

function handleCompareCheck(_data: unknown, checkedInfo: any) {
  syncCompareLeafSelection(checkedInfo?.checkedKeys || compareSelect.value);
}

function resolveCompareProjectName(value: unknown) {
  const selectedId = String(value);
  return (
    compareOptions.value.find((project) =>
      (project.children || []).some(
        (item: any) => String(item.id) === selectedId,
      ),
    )?.label || selectedId
  );
}

function formatPrice(value: any): string {
  if (value === null || value === undefined || value === "" || value == '0.00') return "-";

  const num = Number(value);
  if (isNaN(num)) return "-";
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

function extractPatterns(rows: GateReviewWbsItem[]) {
  if (!rows.length) {
    patterns.value = [];
    cliqueTitle.value = "";
    return;
  }
  const list = rows[0].valveBudgetInfoVoList;
  if (!list || !list.length) {
    patterns.value = [];
    cliqueTitle.value = "";
    return;
  }
  const dynamic: { name: string }[] = [];
  for (const item of list) {
    if (String(item.type) === "0") {
      dynamic.push({ name: item.name });
    }
  }
  patterns.value = dynamic;
  const last = list[list.length - 1];
  cliqueTitle.value = last?.name || "";
}

function yusuanZong(list: any[] | undefined, remark = false) {
  if (!list) return "";
  const cur = list.find((item: any) => String(item.type) === "1");
  if (!cur) return "";
  return remark ? cur.remark || "" : formatPrice(cur.budget);
}

function valveTypeValue(list: any[] | undefined, num: number, remark = false) {
  if (!list) return "";
  const cur = list.find((item: any) => String(item.valveType) === String(num));
  if (!cur) return "";
  return remark ? cur.remark || "" : formatPrice(cur.budget);
}

function compareList(row: Record<string, unknown>, index: number) {
  return (row[`__BEIQI${index}__valveBudgetInfoVoList`] || []) as any[];
}

function compareBudgetTotal(
  row: Record<string, unknown>,
  index: number,
  remark = false,
) {
  return yusuanZong(compareList(row, index), remark);
}

function compareValveType(
  row: Record<string, unknown>,
  index: number,
  num: number,
  remark = false,
) {
  return valveTypeValue(compareList(row, index), num, remark);
}

function openCompareWbsDialog(
  project: Record<string, any>,
  row: Record<string, any>,
  marker: number,
) {
  compareWbsDialogState.value = {
    valveName: String(project?.valveName ?? valveName.value ?? ""),
    row,
    marker,
  };
  compareWbsDialogVisible.value = true;
}

function checkAuth(scope: any) {
  if (!scope.row.level) return true;
  if (!authStore.hasPermission("system:project:budget:edit")) return true;
  if (budgetLock.value === "1") return true;
  return scope.row.level < 6;
}

function reviewAuth(scope: any) {
  if (!authStore.hasPermission("system:project:eva:edit")) return true;
  if (!scope.row.level) return true;
  return scope.row.level < 6;
}

function reviewTextAuth() {
  return !authStore.hasPermission("system:project:eva:edit");
}

function paymentRatioAuth(scope: any) {
  return reviewAuth(scope);
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

function specificEditDisable(index: number) {
  const paymentRatio = formMain.value[index]?.paymentRatio || "";
  if (paymentRatio && paymentRatio.indexOf(",") > 0) return false;
  return true;
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
  if (String(searchReductionDiff.value).trim() !== "") {
    const diff = parsePrice(searchReductionDiff.value);
    if (diff !== null) {
      formMain.value.forEach((item, idx) => {
        const rowDiff = parsePrice(item.reductionDiff);
        if (rowDiff === null || Math.abs(rowDiff) !== Math.abs(diff)) {
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

function resetCompareData(rows: any[]) {
  const flattened: any[] = [];
  rows.forEach((project) => {
    const projectName = project.projectName;
    (project.projectValveListVOList || []).forEach((valve: any) => {
      flattened.push({
        ...valve,
        projectName,
      });
    });
  });
  return flattened.map((item, index) => {
    const prefixName = `__BEIQI${index}__`;
    return {
      ...item,
      projectPassValveInfoVoList: (item.projectPassValveInfoVoList || []).map(
        (cur: Record<string, unknown>) => cloneWithPrefix(cur, prefixName),
      ),
    };
  });
}

function mergeCompareData(rowsArr: any[]) {
  formMain.value.forEach((item: any) => {
    rowsArr.forEach((rowObj, index) => {
      (rowObj.projectPassValveInfoVoList || []).forEach((cur: any) => {
        if (cur[`__BEIQI${index}__gradeId`] === item.gradeId) {
          Object.assign(item, cur);
        }
      });
    });
  });
}

function addLegacyColumnKeys(visible: Set<string>, legacyKey: string) {
  if (legacyKey.startsWith("qzsjColumns-qianzhishujuBanxing")) {
    const index = legacyKey.replace("qzsjColumns-qianzhishujuBanxing", "");
    visible.add(`left-budget-${index}`);
    visible.add(`left-remark-${index}`);
    return;
  }
  (legacyColumnMap[legacyKey] || []).forEach((key) => visible.add(key));
}

function buildLegacyColumnTree(nodes: any[]) {
  const resetKeys = (items: any[]): any[] => {
    return items.map((item) => {
      const childrenSource = Array.isArray(item.child)
        ? item.child
        : Array.isArray(item.children)
          ? item.children
          : [];
      const newItem: any = {
        id: String(item.key ?? item.id ?? ""),
        label: String(item.name ?? item.label ?? ""),
        show: item.check !== false && item.show !== false,
      };
      if (childrenSource.length) {
        newItem.children = resetKeys(childrenSource);
        if (newItem.id === "qzsjColumns" && patterns.value.length) {
          const searchKeys = ["wbsName", "wbsNumber", "level"];
          let insertIndex = -1;
          for (const key of searchKeys) {
            insertIndex = newItem.children.findIndex(
              (child: any) => child.id === key,
            );
            if (insertIndex !== -1) break;
          }
          const patternItems = patterns.value.map(({ name }, index) => ({
            id: `qianzhishujuBanxing${index}`,
            label: `${name}金额及费用说明`,
            show: true,
          }));
          newItem.children.splice(
            insertIndex === -1 ? newItem.children.length : insertIndex + 1,
            0,
            ...patternItems,
          );
        }
      }
      return newItem;
    });
  };
  return resetKeys(nodes);
}

function collectLegacyVisibleColumns(nodes: any[], parentKey = "") {
  const visible = new Set<string>();
  const visit = (items: any[], groupKey = "") => {
    items.forEach((item) => {
      const rawKey = String(item.key ?? item.id ?? "");
      const children = Array.isArray(item.child)
        ? item.child
        : Array.isArray(item.children)
          ? item.children
          : [];
      if (children.length) {
        visit(children, rawKey || groupKey);
        return;
      }
      if (item.check === false || item.show === false) return;
      const legacyKey =
        rawKey.includes("-") || !groupKey ? rawKey : `${groupKey}-${rawKey}`;
      addLegacyColumnKeys(visible, legacyKey);
    });
  };
  visit(nodes, parentKey);
  return visible;
}

function legacyCheckedKeys() {
  const keys: string[] = [];
  const visit = (nodes: any[]) => {
    nodes.forEach((node) => {
      if (node.show) keys.push(node.id);
      if (Array.isArray(node.children)) visit(node.children);
    });
  };
  visit(colSelectTreeData.value);
  return keys;
}

function updateLegacyTreeShow(nodes: any[], checkedKeys: string[]) {
  nodes.forEach((node) => {
    node.show = checkedKeys.includes(node.id);
    if (Array.isArray(node.children)) {
      updateLegacyTreeShow(node.children, checkedKeys);
    }
  });
}

function handleColumnTreeCheck(_node: unknown, info: any) {
  updateLegacyTreeShow(colSelectTreeData.value, info?.checkedKeys || []);
  const visible = collectLegacyVisibleColumns(colSelectTreeData.value);
  visibleColumns.value = columnOptions.value
    .filter((item) => visible.has(item.key))
    .map((item) => item.key);
}

function applyColumnGroup(index: number | null) {
  if (index === null || index === undefined) return;
  const option = columnsGroup.value[index]?.option;
  if (!Array.isArray(option)) return;
  colSelectTreeData.value = buildLegacyColumnTree(option);
  const visible = collectLegacyVisibleColumns(colSelectTreeData.value);
  visibleColumns.value = columnOptions.value
    .filter((item) => visible.has(item.key))
    .map((item) => item.key);
}

function goBack(refresh?: boolean) {
  clearSelectedRowsCache();
  const returnPath = String(route.query.returnPath || "");
  if (returnPath) {
    const refreshQuery = refresh
      ? `${returnPath.includes("?") ? "&" : "?"}_t=${Date.now()}`
      : "";
    void router.replace(`${returnPath}${refreshQuery}`);
    return;
  }

  router.replace({
    path: "/budget/clique/detail",
    query: compactParams({
      projectId: projectId.value,
      valveId: valveId.value,
      projectName: projectName.value,
      valveName: encodeURIComponent(valveName.value),
      majorVersion: majorVersion.value,
      isLock: isLock.value,
      passStatus: passStatus.value,
      budgetLock: budgetLock.value,
      returnPath: "/budget/wbs-touzi/clique",
      _t: refresh ? Date.now().toString() : undefined,
    }),
  });
}

function initFormData() {
  const raw = [...tableData.value];
  patternValues.value = [];
  occupiedBudget.value = [];
  releaseBudget.value = [];
  occupiedBudgetRemark.value = [];
  formMain.value = raw.map((item) => {
    const vlist = item.valveBudgetInfoVoList || [];
    const fi: any = {
      id: item.id,
      wbsNumber: item.wbsNumber,
      wbsName: item.wbsName,
      level: item.level,
      gradeId: item.gradeId,
      gradeName: item.gradeName,
      submitter: item.submitter,
      sorName: item.sorName || "",
      paymentRatio: item.paymentRatio || "",
      paymentEstimate: formatPrice(item.paymentEstimate),
      assessBudget: "",
      reductionDiff: item.reductionDiff,
      reductionRatio: item.reductionRatio,
      valveBudgetInfoVoList: vlist,
    };

    const occupied = vlist.find((i: any) => String(i.valveType) === "0");
    occupiedBudget.value.push({
      budget: occupied ? formatPrice(occupied.budget) : "",
    });
    occupiedBudgetRemark.value.push({
      remark: occupied?.remark || "",
    });

    const release = vlist.find((i: any) => String(i.valveType) === "1");
    releaseBudget.value.push({
      budget: release ? formatPrice(release.budget) : "",
      remark: release?.remark || "",
    });
    const assess = vlist.find((i: any) => String(i.valveType) === "2");
    fi.assessBudget = assess ? formatPrice(assess.budget) : "";

    return fi;
  });

  patternValues.value = formMain.value.map((item) => {
    const vlist = item.valveBudgetInfoVoList || [];
    const patternItems = vlist.filter((i: any) => String(i.type) === "0");
    return patternItems.map((pi: any) => ({
      patternId: pi.patternId,
      budget: formatPrice(pi.budget),
      remark: pi.remark || "",
    }));
  });
}

async function handleSave() {
  saving.value = true;
  try {
    const postData = formMain.value.map((item: any, index: number) => {
      const vlist = item.valveBudgetInfoVoList || [];
      const patternRow = patternValues.value[index] || [];
      const patternById = new Map(
        patternRow.map((pattern: any) => [String(pattern.patternId), pattern]),
      );
      const budgetDtos = vlist
        .filter(
          (dto: any) =>
            String(dto.type) === "0" ||
            String(dto.type) === "1" ||
            String(dto.valveType) === "0" ||
            String(dto.valveType) === "1",
        )
        .map((dto: any) => {
          const result = { ...dto };
          if (String(dto.type) === "0") {
            const pattern = patternById.get(String(dto.patternId));
            if (pattern) {
              result.budget = parsePrice(pattern.budget);
              result.remark = pattern.remark;
            }
          } else if (String(dto.valveType) === "0") {
            result.budget = parsePrice(occupiedBudget.value[index]?.budget);
            result.remark = occupiedBudgetRemark.value[index]?.remark || "";
          } else if (String(dto.valveType) === "1") {
            result.budget = parsePrice(releaseBudget.value[index]?.budget);
            result.remark = releaseBudget.value[index]?.remark || "";
          }
          return result;
        });
      const assess = vlist.find((dto: any) => String(dto.valveType) === "2");
      const row: any = {
        id: item.id,
        submitter: item.submitter,
        sorName: item.sorName,
        paymentRatio: item.paymentRatio,
        paymentEstimate: parsePrice(item.paymentEstimate),
        valveBudgetDTOs: [
          ...(assess
            ? [
                {
                  passValveId: item.id,
                  budget: parsePrice(item.assessBudget),
                  remark: assess.remark || "",
                  valveType: 2,
                },
              ]
            : []),
          ...budgetDtos,
        ],
      };

      return row;
    });
    await updateProjectForm(postData);
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
  try {
    const gradeIdArr = formMain.value.map((item: any) =>
      item.gradeId ? item.gradeId : "null",
    );
    const data = Object.values(
      [...compareSelect.value].reduce((acc: any, val: any) => {
        const str = String(val);
        const parts = str.split("-");
        const pid = parts[0];
        const vid = parts.slice(1).join("-");
        if (!acc[pid])
          acc[pid] = { projectId: pid, projectValveListDTOList: [] };
        acc[pid].projectValveListDTOList.push({
          valveId: vid,
          gradeIdList: gradeIdArr,
        });
        return acc;
      }, {}),
    );
    const response = await getValveCompareData(data);
    selectedProject.value = resetCompareData(unwrapRows(response));
    compareVisibleProjectKeys.value = selectedProject.value.map((_, index) =>
      compareProjectKey(index),
    );
    mergeCompareData(selectedProject.value);
  } catch {
  } finally {
    loading.value = false;
  }
}

function buildColumnOptions() {
  const opts: { key: string; label: string }[] = [];
  const vis: string[] = [];

  function add(k: string, l: string) {
    opts.push({ key: k, label: l });
    vis.push(k);
  }

  add("left-level", "层级");
  add("left-wbs", "WBS");
  add("left-wbsName", "WBS名称");
  patterns.value.forEach((p, idx) => {
    add(`left-budget-${idx}`, `${p.name}`);
    add(`left-remark-${idx}`, `${p.name}费用说明`);
  });
  add("left-totalBudget", "预算总金额");
  add("left-occupied", "阀点已占用金额");
  add("left-occupiedRemark", "阀点已占用费用说明");
  add("left-release", `${valveName.value}阀点释放预算`);
  add("left-releaseRemark", "阀点释放费用说明");
  add("left-submitter", "预算提报人");

  add("right-level", "层级");
  add("right-wbs", "WBS");
  add("right-wbsName", "WBS名称");
  add("right-sorName", "集团统筹SOR名称");
  add(
    "right-assess",
    `${cliqueTitle.value || valveName.value}阀点释放评估金额`,
  );
  add("right-assessRemark", "评估说明");
  add("right-paymentRatio", "支付比例");
  add("right-paymentEstimate", "支付评估金额");
  add("right-reductionDiff", "核减差值");
  add("right-reductionRatio", "核减比例");

  columnOptions.value = opts;
  visibleColumns.value = vis;
  applyColumnGroup(controllerOptionsActive.value);
}

async function loadCompareList() {
  try {
    const res = await getCompareListClique();
    compareOptions.value = unwrapRows(res)
      .map((cur: any) => {
        const project: any = {
          id: String(cur.projectId),
          label: cur.projectName,
          children: (cur.valveList || [])
            .filter((item: any) => {
              if (String(cur.projectId) !== projectId.value) return true;
              return item.valveName !== valveName.value;
            })
            .map((item: any) => ({
              id: cur.projectId + "-" + item.id,
              label: item.valveName,
            })),
        };
        return project;
      })
      .filter((p: any) => p.children.length);
  } catch {
    compareOptions.value = [];
  }
}

async function loadColumnController() {
  try {
    const res = await forModuleIdList("gfyspg");
    columnsGroup.value = unwrapRows(res);
    controllerOptionsActive.value = columnsGroup.value.length ? 0 : null;
  } catch {
    columnsGroup.value = [];
    controllerOptionsActive.value = null;
  }
}

function resetPageState() {
  tableData.value = [];
  formMain.value = [];
  patternValues.value = [];
  occupiedBudget.value = [];
  releaseBudget.value = [];
  compareSelect.value = [];
  clearCompareResultState();
  searchSorName.value = "";
  searchReductionDiff.value = "";
  tableFilterIndexArr.value = [];
}

function resetCompareProjects() {
  compareSelect.value = [];
  clearCompareResultState();
}

async function loadData() {
  if (!projectId.value || !valveId.value) return;
  loading.value = true;
  try {
    const ids = selectedIds.value.split(",").filter(Boolean);
    let selectedRows: GateReviewWbsItem[] = [];
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
      const res = await getProjectListGuofa({
        projectId: projectId.value,
        valveId: valveId.value,
        pageSize: 1000,
        pageNum: 1,
        isLatestVersion: majorVersion.value ? undefined : 1,
        majorVersion: majorVersion.value || undefined,
        abolishFlag: abolishFlag.value,
        includeDetails: true,
      });
      tableData.value = (res.rows || []).filter((item) =>
        ids.includes(String(item.id)),
      );
    }
    extractPatterns(tableData.value);
  } catch {
    tableData.value = [];
    extractPatterns([]);
    BaseToast.error("阀点评估数据加载失败");
  }
  if (tableData.value.length) {
    initFormData();
    buildColumnOptions();
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

watch(
  [
    projectId,
    valveId,
    projectName,
    valveName,
    selectedIds,
    budgetLock,
    isLock,
    passStatus,
    majorVersion,
    abolishFlag,
  ],
  () => {
    void refreshPage();
  },
);

watch(controllerOptionsActive, (value) => {
  applyColumnGroup(value);
});
</script>

<template>
  <PageContainer
    class="budget-gate-review-assess-page"
    title="过阀评审预算评估"
    :description="`WBS过阀评估：${projectName}（${valveName}）`"
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
              :data="compareOptions"
              multiple
              show-checkbox
              collapse-tags
              collapse-tags-tooltip
              placeholder="请选择"
              class="compare-tree-select"
              style="width: 220px"
              node-key="id"
              :props="{ label: 'label', value: 'id', children: 'children' }"
              clearable
              @clear="resetCompareProjects"
              @check="handleCompareCheck"
              @change="syncCompareLeafSelection"
            >
              <template #label="{ value }">
                {{ resolveCompareProjectName(value) }}
              </template>
            </el-tree-select>
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
            <PermissionButton :icon="Refresh" @click="resetCompareProjects"
              >重置</PermissionButton
            >
        </el-form-item>
        <el-form-item label="SOR集团统筹名称">
          <el-input
            v-model="searchSorName"
            class="center-input"
            style="width: 180px"
            placeholder="请输入"
            clearable
          />
        </el-form-item>
        <el-form-item label="核减差值">
          <el-input
            v-model="searchReductionDiff"
            class="center-input"
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
          <PermissionButton :icon="Refresh" @click="clearFilter">重置</PermissionButton>
        </el-form-item>
      </el-form>
    </div>

    <div class="assess-tables">
      <div class="table-section">
        <div class="table-title-bar">
          <BaseSectionTitle class="table-header" title="极致成本预算前置数据">
            <template #actions>
              <div class="table-header-actions">
            <el-select
              v-if="controllerOptions.length"
              v-model="controllerOptionsActive"
              placeholder="请选择"
              class="header-controller-select"
              style="width: 160px"
            >
              <el-option
                v-for="item in controllerOptions"
                :key="`controller-option-${item.value}`"
                :label="item.label"
                :value="item.value"
              />
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
              <el-tree
                :key="`${controllerOptionsActive ?? 'column-tree'}-${patterns.length}`"
                class="legacy-column-tree"
                :data="colSelectTreeData"
                show-checkbox
                node-key="id"
                default-expand-all
                :default-checked-keys="legacyCheckedKeys()"
                @check="handleColumnTreeCheck"
              />
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
            prop="level"
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
          <template v-for="(p, idx) in patterns" :key="'lb-' + idx">
            <el-table-column
              v-if="visibleColumns.includes('left-budget-' + idx)"
              :label="p.name"
              min-width="130"
              align="center"
            >
              <template #default="{ $index }">
                <el-input
                  v-model="patternValues[$index][idx].budget"
                  :disabled="checkAuth({ row: formMain[$index] })"
                  placeholder="请输入"
                  @blur="inputBlur(patternValues[$index][idx], 'budget')"
                  @focus="inputFocus(patternValues[$index][idx], 'budget')"
                />
              </template>
            </el-table-column>
            <el-table-column
              v-if="visibleColumns.includes('left-remark-' + idx)"
              :label="`费用说明`"
              min-width="150"
              align="center"
              show-overflow-tooltip
            >
              <template #default="{ $index }">
                <el-input
                  v-model="patternValues[$index][idx].remark"
                  :disabled="checkAuth({ row: formMain[$index] })"
                  placeholder="请输入"
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
              yusuanZong(row.valveBudgetInfoVoList)
            }}</template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('left-occupied')"
            label="阀点已占用金额"
            min-width="140"
            align="center"
          >
            <template #default="{ $index }">
              <el-input
                v-model="occupiedBudget[$index].budget"
                :disabled="checkAuth({ row: formMain[$index] })"
                placeholder="请输入"
                @blur="inputBlur(occupiedBudget[$index], 'budget')"
                @focus="inputFocus(occupiedBudget[$index], 'budget')"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('left-occupiedRemark')"
            label="阀点已占用费用说明"
            min-width="150"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ $index }">
              <el-input
                v-model="occupiedBudgetRemark[$index].remark"
                :disabled="checkAuth({ row: formMain[$index] })"
                placeholder="请输入"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('left-release')"
            :label="`${valveName}阀点释放预算`"
            min-width="130"
            align="center"
          >
            <template #default="{ $index }">
              <el-input
                v-model="releaseBudget[$index].budget"
                :disabled="checkAuth({ row: formMain[$index] })"
                placeholder="请输入"
                @blur="inputBlur(releaseBudget[$index], 'budget')"
                @focus="inputFocus(releaseBudget[$index], 'budget')"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('left-releaseRemark')"
            label="阀点释放费用说明"
            min-width="150"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ $index }">
              <el-input
                v-model="releaseBudget[$index].remark"
                :disabled="checkAuth({ row: formMain[$index] })"
                placeholder="请输入"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('left-submitter')"
            label="预算提报人"
            min-width="90"
            align="center"
          >
            <template #default="{ row }">
              <el-input v-model="row.submitter" placeholder="请输入" />
            </template>
          </el-table-column>
        </BaseDataTable>
      </div>

      <div v-if="canDisplayEvaluation" class="table-section">
        <BaseSectionTitle
          class="table-header"
          :title="`极致成本${valveName}阀点预算前置评审`"
        />
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
            prop="level"
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
            v-if="visibleColumns.includes('right-sorName')"
            label="集团统筹SOR名称"
            min-width="150"
            align="center"
          >
            <template #default="{ row }">
              <el-input
                v-model="row.sorName"
                placeholder="请输入SOR名称"
                clearable
                :disabled="reviewTextAuth()"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-assess')"
            :label="`${cliqueTitle || valveName}阀点释放评估金额`"
            min-width="150"
            align="center"
          >
            <template #default="{ row }">
              <el-input
                v-model="row.assessBudget"
                :disabled="reviewAuth({ row })"
                placeholder="请输入金额"
                @blur="inputBlur(row, 'assessBudget')"
                @focus="inputFocus(row, 'assessBudget')"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-assessRemark')"
            label="评估说明"
            min-width="200"
            align="center"
          >
            <template #default="{ row }">
              <el-input
                placeholder="请输入"
                :disabled="reviewTextAuth()"
                :model-value="
                  (
                    row.valveBudgetInfoVoList?.find(
                      (i: any) => String(i.valveType) === '2',
                    ) || {}
                  ).remark || ''
                "
                @update:model-value="
                  (val: any) => {
                    const item = row.valveBudgetInfoVoList?.find(
                      (i: any) => String(i.valveType) === '2',
                    );
                    if (item) item.remark = val;
                  }
                "
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-paymentRatio')"
            label="支付比例"
            min-width="160"
            align="center"
          >
            <template #default="{ row, $index }">
              <el-input
                v-model="row.paymentRatio"
                placeholder="请输入"
                :disabled="paymentRatioAuth({ row })"
                @blur="ratioValidate($index)"
              >
                <template #append>%</template>
              </el-input>
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-paymentEstimate')"
            label="支付评估金额"
            min-width="140"
            align="center"
          >
            <template #default="{ row, $index }">
              <el-input
                v-model="row.paymentEstimate"
                :disabled="specificEditDisable($index) || reviewTextAuth()"
                placeholder="请输入金额"
                @blur="inputBlur(row, 'paymentEstimate')"
                @focus="inputFocus(row, 'paymentEstimate')"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-reductionDiff')"
            label="核减差值"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">{{
              formatPrice(row.reductionDiff)
            }}</template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes('right-reductionRatio')"
            label="核减比例"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">
              <span v-if="row.reductionRatio">{{ row.reductionRatio }}%</span>
            </template>
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
            :key="`${item.projectName || ''}-${item.valveName || ''}-${index}`"
          >
            {{ item.projectName }}({{ item.valveName }})
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
      <div
        class="compare-grid"
        :style="{ gridTemplateColumns: `repeat(${compareGridColumns}, minmax(0, 1fr))` }"
      >
        <template v-for="(item, index) in selectedProject" :key="`compare-table-${index}`">
          <div
            v-if="compareVisibleProjectKeys.includes(compareProjectKey(index))"
            class="compare-card"
          >
            <BaseSectionTitle
              class="table-header"
              :title="`${item.projectName} 极致成本(${item.valveName}) 阀点预算前置评审`"
            />
            <BaseDataTable
              :data="item.projectPassValveInfoVoList || []"
              border
              size="small"
              style="width: 100%;"
            >
              <el-table-column label="层级" min-width="60" align="center">
                <template #default="{ row }">
                  {{ row[`__BEIQI${index}__level`] ?? "" }}
                </template>
              </el-table-column>
              <el-table-column
                label="WBS"
                min-width="150"
                align="center"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{ row[`__BEIQI${index}__wbsNumber`] ?? "" }}
                </template>
              </el-table-column>
              <el-table-column
                label="WBS名称"
                min-width="160"
                align="center"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  <span
                    class="compare-wbs-link"
                    @click.stop="
                      openCompareWbsDialog(item, row, index)
                    "
                  >
                    {{ row[`__BEIQI${index}__wbsName`] ?? "" }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="预算总金额" min-width="150" align="center">
                <template #default="{ row }">
                  {{ compareBudgetTotal(row, index) }}
                </template>
              </el-table-column>
              <el-table-column
                :label="`${item.valveName}阀点释放预算`"
                min-width="180"
                align="center"
              >
                <template #default="{ row }">
                  {{ compareValveType(row, index, 1) }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canDisplayEvaluation"
                :label="`${item.valveName}阀点释放评估`"
                min-width="180"
                align="center"
              >
                <template #default="{ row }">
                  {{ compareValveType(row, index, 2) }}
                </template>
              </el-table-column>
            </BaseDataTable>
          </div>
        </template>
      </div>
    </div>
    <BudgetGateReviewCompareWbsDialog
      v-model="compareWbsDialogVisible"
      :valve-name="compareWbsDialogState?.valveName || ''"
      :row="compareWbsDialogState?.row || null"
      :marker="compareWbsDialogState?.marker || 0"
    />

    <div class="budget-gate-review-assess-page__footer">
      <PermissionButton variant="secondary" @click="goBack()">
        取消
      </PermissionButton>
      <PermissionButton
        permission="system:project:valve:edit"
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
.budget-gate-review-assess-page {
  background: var(--bq-color-surface);
}

.budget-gate-review-assess-page.is-page-fullscreen {
  background: #ffffff !important;
}

.budget-gate-review-assess-page.is-page-fullscreen :deep(.page-container__header) {
  top: -24px;
  z-index: 1000;
  margin: -24px -32px 16px;
}

.budget-gate-review-assess-page.is-page-fullscreen :deep(.page-container__body) {
  background: #ffffff;
  align-content: start;
}

.budget-gate-review-assess-page :deep(.page-container__body) {
  padding-bottom: 76px;
}

.budget-gate-review-assess-page__footer {
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

:global(.page-container.is-page-fullscreen .budget-gate-review-assess-page__footer),
:global(body.bq-page-fullscreen-active .budget-gate-review-assess-page__footer) {
  right: 32px;
  left: 32px;
}

@media (max-width: 960px) {
  .budget-gate-review-assess-page__footer {
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
.assess-form :deep(.el-tree-select__wrapper),
.table-header-actions :deep(.el-select__wrapper) {
  min-height: var(--bq-control-height);
}
.compare-tree-select :deep(.el-select__wrapper),
.header-controller-select :deep(.el-select__wrapper) {
  min-height: var(--bq-control-height);
}
.assess-tables :deep(.el-input),
.assess-tables :deep(.el-input__inner),
.assess-tables :deep(.el-input-group__append) {
  font-size: var(--bq-font-compact);
}
.legacy-column-tree {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}
.table-section {
  margin-bottom: 16px;
}
.table-title-bar {
  position: relative;
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

.table-header-actions {
  position: static;
  right: 8px;
  top: 4px;
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
.compare-section {
  margin-top: -8px;
}
.compare-title {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 10px;
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
}
.compare-grid {
  display: grid;
  gap: 16px;
  width: 100%;
}
.compare-card {
  min-width: 0;
}
.compare-card :deep(.base-data-table) {
  width: 100%;
}
.compare-card :deep(.el-table) {
  width: 100%;
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
</style>
