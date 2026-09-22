<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { replaceToReturn } from "@/utils/return-navigation";
import { ArrowRight, Back, Download, View } from "@element-plus/icons-vue";
import {
  exportProjectPassValve,
  getLeftTreeData,
  getProjectListGuofa,
} from "@/api/budget";
import BaseMoney from "@/components/base/BaseMoney.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { formatMoney } from "@/utils/formatters";
import type {
  GateReviewBudgetItem,
  GateReviewWbsItem,
  InitiationGradeTreeNode,
} from "@/types/budget";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const projectId = computed(() => String(route.query.projectId ?? ""));
const valveId = computed(() => String(route.query.valveId ?? ""));
const projectName = computed(() => String(route.query.projectName ?? ""));
const valveName = computed(() =>
  decodeQueryText(String(route.query.valveName ?? "")),
);
// const isLock = computed(
//   () => route.query.isLock === "1",
// );
const evaluationLock = computed(() => route.query.evaluationLock === "1");
// const budgetLock = computed(() => String(route.query.budgetLock ?? ""));
const passStatus = computed(() =>
  String(route.query.passStatus ?? route.query.status ?? ""),
);
const majorVersion = computed(() => String(route.query.majorVersion ?? ""));
const isLatestVersion = computed(() => {
  if (hasRequestValue(route.query.isLatestVersion)) {
    return Number(route.query.isLatestVersion);
  }
  return 1;
});
const canDisplayEvaluation = computed(() =>
  authStore.hasPermission("system:project:eva:display"),
);

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
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nested = compactParams(value as Record<string, unknown>);
        if (Object.keys(nested).length) {
          result[key] = nested;
        }
        return result;
      }
      if (hasRequestValue(value)) {
        result[key] = value;
      }
      return result;
    },
    {},
  ) as Partial<T>;
}

const treeLoading = ref(false);
const treeData = ref<InitiationGradeTreeNode[]>([]);
const currentStatus = ref<"all" | "valid" | "invalid">("valid");
const curTreeNode = ref<InitiationGradeTreeNode | null>(null);
const treeSearchValue = ref("");
const leftTreeRef = ref<any>(null);
const selectedRows = ref<GateReviewWbsItem[]>([]);
const expandedRowKeys = ref<number[]>([]);
const latestExportTaskId = ref<string>();
const detailLeftPanelSize = ref(260);
const detailLeftPanelCollapsed = computed(
  () => Number(detailLeftPanelSize.value) <= 1,
);
const queryTableRef = ref<{
  search: () => void;
  reload: () => Promise<void>;
} | null>(null);

type ExpandDetailItem = {
  label: string;
  value: string;
  valueType?: "amount" | "date";
};

type ExpandDetailRow = {
  left?: ExpandDetailItem;
  right?: ExpandDetailItem;
};

const patterns = ref<{ name: string }[]>([]);
type ValveBudgetColumn = {
  key: string;
  valveType: 0 | 1 | 2;
  valveId: number | null;
  name: string;
  amountLabel: string;
  remarkLabel: string;
};
const valveBudgetColumns = ref<ValveBudgetColumn[]>([]);
const occupiedValveColumns = computed(() =>
  valveBudgetColumns.value.filter((column) => column.valveType === 0),
);
const releaseValveColumns = computed(() =>
  valveBudgetColumns.value.filter((column) => column.valveType === 1),
);
const evaluateValveColumns = computed(() =>
  valveBudgetColumns.value.filter((column) => column.valveType === 2),
);

const searchForm = reactive({
  wbsNumber: "",
  wbsName: "",
  gradeId: "",
  level: "",
  params: {
    beginTime: "",
    endTime: "",
  },
  operator: "",
  amount: "",
});
const searTime = ref<any[] | null>(null);

function extractPatterns(rows: GateReviewWbsItem[]) {
  if (!rows.length) {
    patterns.value = [];
    valveBudgetColumns.value = [];
    return;
  }
  const dynamic: { name: string }[] = [];
  const valveColumns: ValveBudgetColumn[] = [];
  const patternKeys = new Set<string>();
  const valveColumnKeys = new Set<string>();
  for (const row of rows) {
    const list = row.valveBudgetInfoVoList || [];
    for (const item of list) {
      if (
        item.type !== null &&
        item.type !== undefined &&
        item.type == 0 &&
        item.name &&
        !patternKeys.has(item.name)
      ) {
        patternKeys.add(item.name);
        dynamic.push({ name: item.name });
      }
      if (item.valveType === null || item.valveType === undefined) {
        continue;
      }
      const valveType = Number(item.valveType);
      if (valveType !== 0 && valveType !== 1 && valveType !== 2) {
        continue;
      }
      const normalizedValveType = valveType as 0 | 1 | 2;
      const valveId = item.valveId ?? null;
      const name = item.name || valveName.value || "阀点";
      const key = [valveId ?? "none", normalizedValveType, name].join("-");
      if (valveColumnKeys.has(key)) {
        continue;
      }
      valveColumnKeys.add(key);
      valveColumns.push({
        key,
        valveType: normalizedValveType,
        valveId,
        name,
        ...getValveBudgetColumnLabels(name, normalizedValveType),
      });
    }
  }
  patterns.value = dynamic;
  valveBudgetColumns.value = valveColumns;
}

function getValveBudgetColumnLabels(name: string, valveType: 0 | 1 | 2) {
  if (valveType === 0) {
    return {
      amountLabel: "阀点已占用金额",
      remarkLabel: "阀点已占用费用说明",
    };
  }
  if (valveType === 1) {
    return {
      amountLabel: `${name}阀点释放预算`,
      remarkLabel: "阀点释放费用说明",
    };
  }
  return {
    amountLabel: `${name}阀点释放评估金额`,
    remarkLabel: "评估说明",
  };
}

function getPatternBudgetItem(
  list: GateReviewBudgetItem[] | undefined,
  index: number,
): GateReviewBudgetItem | undefined {
  if (!list) return undefined;
  const items = list.filter((item) => item.type == 0);
  return items[index];
}

function getPatternBudgetValue(
  list: GateReviewBudgetItem[] | undefined,
  index: number,
) {
  return getPatternBudgetItem(list, index)?.budget ?? null;
}

function getPatternBudgetRemark(
  list: GateReviewBudgetItem[] | undefined,
  index: number,
) {
  return getPatternBudgetItem(list, index)?.remark || "-";
}

function getTotalBudgetValue(list: GateReviewBudgetItem[] | undefined) {
  if (!list) return null;
  const cur = list.find((item) => item.type == 1);
  return cur?.budget ?? null;
}

function getValveBudgetItem(
  list: GateReviewBudgetItem[] | undefined,
  column: ValveBudgetColumn,
) {
  return list?.find((item) => {
    const sameType =
      item.valveType !== null &&
      item.valveType !== undefined &&
      Number(item.valveType) === column.valveType;
    const sameValve = (item.valveId ?? null) === column.valveId;
    const sameName = (item.name || valveName.value || "阀点") === column.name;
    return sameType && sameValve && sameName;
  });
}

function getValveBudgetValue(
  list: GateReviewBudgetItem[] | undefined,
  column: ValveBudgetColumn,
) {
  return getValveBudgetItem(list, column)?.budget ?? null;
}

function getValveBudgetRemark(
  list: GateReviewBudgetItem[] | undefined,
  column: ValveBudgetColumn,
) {
  return getValveBudgetItem(list, column)?.remark || "-";
}

function formatRatio(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value)
    .split(",")
    .map((item) => {
      const text = item.trim();
      return text.endsWith("%") ? text : `${text}%`;
    })
    .join("，");
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

watch(searTime, (nv) => {
  if (nv) {
    searchForm.params.beginTime = `${nv[0]} 00:00:00`;
    searchForm.params.endTime = `${nv[1]} 23:59:59`;
  } else {
    searchForm.params.beginTime = "";
    searchForm.params.endTime = "";
  }
});

watch(treeSearchValue, (val) => {
  leftTreeRef.value?.filter(val);
});

function handleSelectionChange(selection: GateReviewWbsItem[]) {
  selectedRows.value = selection;
}

function toggleExpand(row: GateReviewWbsItem) {
  const isExpanded = expandedRowKeys.value.includes(row.id);
  expandedRowKeys.value = isExpanded
    ? expandedRowKeys.value.filter((id) => id !== row.id)
    : [...expandedRowKeys.value, row.id];
}

function handleRowClick(
  row: GateReviewWbsItem,
  _column: unknown,
  event: MouseEvent,
) {
  const target = event.target as HTMLElement | null;
  if (target?.closest("button, a, input, textarea, select, .el-checkbox")) {
    return;
  }
  toggleExpand(row);
}

function handleExpandChange(
  _row: GateReviewWbsItem,
  expandedRows: GateReviewWbsItem[],
) {
  expandedRowKeys.value = expandedRows.map((row) => row.id);
}

function handleDetailSplitterResizeEnd(_index: number, sizes: number[]) {
  const nextSize = Number(sizes[0] ?? detailLeftPanelSize.value);
  detailLeftPanelSize.value = nextSize <= 8 ? 1 : nextSize;
}

function getExpandRows(row: GateReviewWbsItem): ExpandDetailRow[] {
  const auditItems: ExpandDetailItem[] = [
    { label: "创建人", value: row.createName || row.createBy || "-" },
    {
      label: "创建时间",
      value: row.createTime || "-",
      valueType: "date",
    },
    { label: "更新人", value: row.updateBy || "-" },
    {
      label: "更新时间",
      value: row.updateTime || "-",
      valueType: "date",
    },
  ];
  if (!canDisplayEvaluation.value) {
    return auditItems.map((item) => ({ left: item }));
  }

  const leftItems: ExpandDetailItem[] = [
    { label: "集团统筹SOR名称", value: row.sorName || "-" },
  ];

  evaluateValveColumns.value.forEach((column) => {
    leftItems.push(
      {
        label: column.amountLabel,
        value: formatMoney(
          getValveBudgetValue(row.valveBudgetInfoVoList, column),
        ),
        valueType: "amount",
      },
      {
        label: column.remarkLabel,
        value: getValveBudgetRemark(row.valveBudgetInfoVoList, column),
      },
    );
  });

  const rightItems: ExpandDetailItem[] = [];
  rightItems.push(
    { label: "支付比例", value: formatRatio(row.paymentRatio) },
    {
      label: "支付评估金额",
      value: formatPrice(row.paymentEstimate),
      valueType: "amount",
    },
    {
      label: "核减差值",
      value: formatPrice(row.reductionDiff),
      valueType: "amount",
    },
    {
      label: "核减比例",
      value: formatRatio(row.reductionRatio),
    },
    ...auditItems,
  );

  return Array.from(
    { length: Math.max(leftItems.length, rightItems.length) },
    (_, index) => ({ left: leftItems[index], right: rightItems[index] }),
  );
}

function clearTreeCurrent() {
  curTreeNode.value = null;
  searchForm.gradeId = "";
  leftTreeRef.value?.setCurrentKey(null);
  currentStatus.value = "all";
  getTreeData();
  queryTableRef.value?.search();
}

function changeStatus(status: "all" | "valid" | "invalid") {
  currentStatus.value = status;
  curTreeNode.value = null;
  searchForm.gradeId = "";
  leftTreeRef.value?.setCurrentKey(null);
  getTreeData();
  queryTableRef.value?.search();
}

function leftTreeFilterNode(val: string, data: InitiationGradeTreeNode) {
  if (!val) return true;
  return data.name.indexOf(val) !== -1;
}

function treeClick(data: InitiationGradeTreeNode) {
  curTreeNode.value = data;
  searchForm.gradeId = String(data.id);
  queryTableRef.value?.search();
}

function resetForm() {
  curTreeNode.value = null;
  currentStatus.value = "all";
  searchForm.gradeId = "";
  leftTreeRef.value?.setCurrentKey(null);
  searTime.value = null;
  searchForm.wbsNumber = "";
  searchForm.wbsName = "";
  searchForm.level = "";
  searchForm.params.beginTime = "";
  searchForm.params.endTime = "";
  searchForm.operator = "";
  searchForm.amount = "";
  queryTableRef.value?.search();
  getTreeData();
}

async function getTreeData() {
  treeLoading.value = true;
  try {
    let params: { includeInvalid?: boolean; abolishFlag?: number } = {};
    if (currentStatus.value === "invalid") {
      params = { includeInvalid: true, abolishFlag: 1 };
    } else if (currentStatus.value === "valid") {
      params = { abolishFlag: 0 };
    } else {
      params = { abolishFlag: undefined };
    }
    const res = await getLeftTreeData(compactParams(params));
    treeData.value = res;
  } catch {
    treeData.value = [];
    BaseToast.error("预算等级树加载失败");
  } finally {
    treeLoading.value = false;
  }
}

async function queryRows(pageSize: number, pageNum: number) {
  if (!projectId.value || !valveId.value) {
    return {
      total: 0,
      list: [],
      pageNo: pageNum,
      pageSize,
    };
  }
  try {
    let abolishFlag: number | undefined;
    if (currentStatus.value === "invalid") {
      abolishFlag = 1;
    } else if (currentStatus.value === "valid") {
      abolishFlag = 0;
    }
    const params = compactParams({
      ...searchForm,
      params: { ...searchForm.params },
      pageSize,
      pageNum,
      isLatestVersion: isLatestVersion.value,
      includeDetails: true,
      projectId: projectId.value,
      valveId: valveId.value,
      abolishFlag,
      majorVersion: majorVersion.value,
    });
    const res = await getProjectListGuofa(params);
    extractPatterns(res.rows || []);
    return {
      total: res.total,
      list: res.rows || [],
      pageNo: pageNum,
      pageSize,
    };
  } catch {
    extractPatterns([]);
    BaseToast.error("阀点评审明细加载失败");
    return {
      total: 0,
      list: [],
      pageNo: pageNum,
      pageSize,
    };
  }
}

function resetPageState() {
  currentStatus.value = "valid";
  curTreeNode.value = null;
  treeSearchValue.value = "";
  selectedRows.value = [];
  expandedRowKeys.value = [];
  searTime.value = null;
  searchForm.wbsNumber = "";
  searchForm.wbsName = "";
  searchForm.gradeId = "";
  searchForm.level = "";
  searchForm.params.beginTime = "";
  searchForm.params.endTime = "";
  searchForm.operator = "";
  searchForm.amount = "";
  leftTreeRef.value?.setCurrentKey(null);
}

async function refreshPage() {
  resetPageState();
  await getTreeData();
  // queryTableRef.value?.search();
}

onMounted(() => {
  void refreshPage();
});

// watch(
//   [
//     projectId,
//     valveId,
//     projectName,
//     valveName,
//     majorVersion,
//     isLock,
//     budgetLock,
//     passStatus,
//   ],
//   () => {
//     void refreshPage();
//   },
// );

async function handExport() {
  if (!selectedRows.value.length) {
    BaseToast.warning("请选择要导出的数据");
    return;
  }
  try {
    const task = await exportProjectPassValve(
      selectedRows.value.map((item) => ({
        id: item.id,
        projectId: projectId.value,
        valveId: valveId.value,
      })),
    );
    latestExportTaskId.value = task.taskId;
    BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
  } catch {
    BaseToast.error("导出失败");
  }
}

function goBack() {
  replaceToReturn(router, route, "/budget/wbs-touzi/clique");
}

function openAssessDialog() {
  if (["2", "3"].includes(passStatus.value)) {
    BaseToast.warning("已过阀不能修改");
    return;
  }
  if (evaluationLock.value) {
    BaseToast.warning("评估已锁定");
    return;
  }
  if (!selectedRows.value.length) {
    BaseToast.warning("请选择要评估的数据");
    return;
  }
  const ids = selectedRows.value.map((item) => item.id).join(",");
  const selectedRowsKey = `budget-gate-review-assess:${projectId.value}:${valveId.value}:${Date.now()}`;
  try {
    window.sessionStorage.setItem(
      selectedRowsKey,
      JSON.stringify(selectedRows.value),
    );
  } catch {
    // 评估页仍会通过 ids 请求数据，存储不可用时不阻断跳转。
  }
  const abolishFlag =
    currentStatus.value === "valid"
      ? "0"
      : currentStatus.value === "invalid"
        ? "1"
        : undefined;
  router.push({
    path: "/budget/clique/assess",
    query: compactParams({
      projectId: projectId.value,
      valveId: valveId.value,
      ids,
      selectedRowsKey,
      projectName: projectName.value,
      valveName: encodeURIComponent(valveName.value),
      budgetLock: String(route.query.budgetLock ?? ""),
      returnPath: route.fullPath,
      isLock: String(route.query.isLock ?? ""),
      evaluationLock: String(route.query.evaluationLock ?? ""),
      passStatus: passStatus.value,
      majorVersion: majorVersion.value,
      abolishFlag,
    }),
  });
}

function openHistoryPage(row: Record<string, unknown>) {
  const historyParams: Record<string, string> = {};
  historyParams.projectId = String(row.projectId ?? projectId.value);
  historyParams.valveId = valveId.value;
  historyParams.projectName = projectName.value;
  historyParams.valveName = encodeURIComponent(valveName.value);
  historyParams.gradeId = String(row.gradeId ?? "");
  historyParams.wbsNumber = encodeURIComponent(String(row.wbsNumber ?? ""));
  historyParams.majorVersion =
    majorVersion.value || String(row.majorVersion ?? "");
  if (row.id !== undefined && row.id !== null) {
    historyParams.historyRowId = String(row.id);
  }
  historyParams.budgetLock = String(route.query.budgetLock ?? "");
  historyParams.isLock = String(route.query.isLock ?? "");
  historyParams.passStatus = passStatus.value;
  historyParams.returnPath = route.fullPath;
  router.push({
    name: "WBS过阀历史版本",
    query: compactParams(historyParams),
  });
}
</script>

<template>
  <PageContainer
    class="budget-detail-page"
    :title="`${projectName}（${valveName}）`"
    :description="`WBS过阀：${projectName}（${valveName}）`"
  >
    <TaskStatusPanel v-if="false" :task-id="latestExportTaskId" />
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack"
        >返回</PermissionButton
      >
    </template>
    <el-splitter
      class="detail-layout"
      :class="{ 'is-left-collapsed': detailLeftPanelCollapsed }"
      @resize-end="handleDetailSplitterResizeEnd"
    >
      <el-splitter-panel v-model:size="detailLeftPanelSize" min="1" max="480">
        <div class="left-panel">
          <el-input
            v-model="treeSearchValue"
            placeholder="请输入等级名称"
            clearable
            suffix-icon="Search"
          />
          <div class="tree-filter-bar">
            <span
              class="tree-filter-item"
              :class="{ active: currentStatus === 'all' }"
              @click="clearTreeCurrent"
              >全部等级</span
            >
            <span
              class="tree-filter-item"
              :class="{ active: currentStatus === 'valid' }"
              @click="changeStatus('valid')"
              >生效</span
            >
            <span
              class="tree-filter-item"
              :class="{ active: currentStatus === 'invalid' }"
              @click="changeStatus('invalid')"
              >作废</span
            >
          </div>
          <el-tree
            ref="leftTreeRef"
            v-loading="treeLoading"
            :data="treeData"
            node-key="id"
            :props="{ children: 'children', label: 'name' }"
            highlight-current
            :expand-on-click-node="false"
            :filter-node-method="leftTreeFilterNode"
            @node-click="treeClick"
          />
        </div>
      </el-splitter-panel>
      <el-splitter-panel min="1">
        <div class="right-panel">
          <QueryTable
            ref="queryTableRef"
            :func="queryRows"
            row-key="id"
            fit-table-height
            fit-table-to-container
            :fixed-pagination="false"
            table-layout="fixed"
            border
            :expand-row-keys="expandedRowKeys"
            @reset="resetForm"
            @selection-change="handleSelectionChange"
            @expand-change="handleExpandChange"
            @row-click="handleRowClick"
          >
            <template #search>
              <el-form :model="searchForm">
                <el-form-item label="WBS编码">
                  <el-input
                    v-model="searchForm.wbsNumber"
                    placeholder="请输入WBS编码"
                    clearable
                    @keyup.enter="queryTableRef?.search()"
                  />
                </el-form-item>
                <el-form-item label="WBS名称">
                  <el-input
                    v-model="searchForm.wbsName"
                    placeholder="请输入WBS名称"
                    clearable
                    @keyup.enter="queryTableRef?.search()"
                  />
                </el-form-item>
                <el-form-item label="层级">
                  <el-select
                    v-model="searchForm.level"
                    placeholder="请选择层级"
                    clearable
                  >
                    <el-option label="全部" value="" />
                    <el-option
                      v-for="i in 6"
                      :key="i"
                      :label="String(i)"
                      :value="String(i - 1)"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item class="search-form-item--wide" label="创建时间">
                  <el-date-picker
                    v-model="searTime"
                    style="width: 100%"
                    type="daterange"
                    range-separator="至"
                    value-format="YYYY-MM-DD"
                    start-placeholder="开始日期"
                    end-placeholder="结束日期"
                  />
                </el-form-item>
                <el-form-item class="search-form-item--wide" label="预算总金额">
                  <el-input
                    v-model="searchForm.amount"
                    style="width: 100%"
                    type="number"
                    placeholder="请输入金额"
                    clearable
                    :disabled="searchForm.operator ? false : true"
                  >
                    <template #prepend>
                      <el-select
                        v-model="searchForm.operator"
                        placeholder="全部"
                        style="width: 72px"
                      >
                        <el-option label="全部" value="" />
                        <el-option label="≥" value="1" />
                        <el-option label="≤" value="2" />
                        <el-option label=">" value="3" />
                        <el-option label="<" value="4" />
                      </el-select>
                    </template>
                  </el-input>
                </el-form-item>
              </el-form>
            </template>

            <template #toolbar>
              <PermissionButton
                v-if="false"
                permission="budget:gate-review:detail:export"
                variant="secondary"
                plain
                type="warning"
                :icon="Download"
                @click="handExport"
              >
                导出
              </PermissionButton>
              <PermissionButton
                permission="system:project:valve:query"
                variant="secondary"
                type="primary"
                :icon="View"
                :disabled="!selectedRows.length"
                @click="openAssessDialog"
              >
                预算评估
              </PermissionButton>
              <span
                v-if="selectedRows.length"
                class="budget-initiation__selection"
              >
                已选择 {{ selectedRows.length }} 项
              </span>
            </template>

            <el-table-column fixed type="selection" width="50" />
            <el-table-column
              fixed
              label="层级"
              width="72"
              align="center"
              prop="level"
            >
              <template #default="{ row }">
                <div class="level-cell">
                  <button
                    class="wbs-expand-trigger"
                    type="button"
                    :aria-label="
                      expandedRowKeys.includes(row.id)
                        ? `收起${row.wbsNumber}详情`
                        : `展开${row.wbsNumber}详情`
                    "
                    :aria-expanded="expandedRowKeys.includes(row.id)"
                    :title="
                      expandedRowKeys.includes(row.id) ? '收起' : '全部展示'
                    "
                    @click.stop="toggleExpand(row)"
                  >
                    <el-icon
                      :size="14"
                      :class="{ expanded: expandedRowKeys.includes(row.id) }"
                    >
                      <ArrowRight />
                    </el-icon>
                  </button>
                  <span class="level-number">
                    {{ row.level ?? "-" }}
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              fixed
              prop="wbsNumber"
              width="220"
              label="WBS"
              show-overflow-tooltip
              align="left"
            >
              <template #default="{ row }">
                <span class="wbs-number">{{ row.wbsNumber }}</span>
              </template>
            </el-table-column>
            <el-table-column
              type="expand"
              width="1"
              :resizable="false"
              class-name="native-expand-column"
              label-class-name="native-expand-column"
            >
              <template #default="{ row }">
                <div class="expand-detail">
                  <el-descriptions :column="2" border size="small">
                    <template
                      v-for="(detailRow, index) in getExpandRows(row)"
                      :key="index"
                    >
                      <el-descriptions-item
                        v-if="detailRow.left"
                        :label="detailRow.left.label"
                      >
                        {{ detailRow.left.value || "-" }}
                      </el-descriptions-item>
                      <el-descriptions-item
                        v-if="detailRow.right"
                        :label="detailRow.right.label"
                      >
                        {{ detailRow.right.value || "-" }}
                      </el-descriptions-item>
                    </template>
                  </el-descriptions>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="wbsName"
              width="200"
              label="WBS名称"
              show-overflow-tooltip
            />
            <el-table-column
              prop="gradeName"
              width="150"
              label="当前等级"
              show-overflow-tooltip
            />
            <template v-for="(item, idx) in patterns" :key="`pat-${idx}`">
              <el-table-column
                :prop="`${item.name}_budget`"
                :label="item.name"
                width="150"
              >
                <template #default="{ row }">
                  <BaseMoney
                    :value="
                      getPatternBudgetValue(row.valveBudgetInfoVoList, idx)
                    "
                    empty-text="-"
                  />
                </template>
              </el-table-column>
              <el-table-column
                :prop="`${item.name}_remark`"
                :label="`费用说明`"
                width="150"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{ getPatternBudgetRemark(row.valveBudgetInfoVoList, idx) }}
                </template>
              </el-table-column>
            </template>
            <el-table-column prop="totalBudget" width="130" label="预算总金额">
              <template #default="{ row }">
                <BaseMoney
                  :value="getTotalBudgetValue(row.valveBudgetInfoVoList)"
                  empty-text="-"
                />
              </template>
            </el-table-column>
            <template
              v-for="column in [
                ...occupiedValveColumns,
                ...releaseValveColumns,
              ]"
              :key="`valve-${column.key}`"
            >
              <el-table-column
                :prop="`${column.key}_budget`"
                width="160"
                :label="column.amountLabel"
              >
                <template #default="{ row }">
                  <BaseMoney
                    :value="
                      getValveBudgetValue(row.valveBudgetInfoVoList, column)
                    "
                    empty-text="-"
                  />
                </template>
              </el-table-column>
              <el-table-column
                :prop="`${column.key}_remark`"
                width="160"
                :label="column.remarkLabel"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{ getValveBudgetRemark(row.valveBudgetInfoVoList, column) }}
                </template>
              </el-table-column>
            </template>
            <el-table-column prop="submitter" label="预算提报人" />
            <template v-if="canDisplayEvaluation">
              <el-table-column
                prop="sorName"
                width="150"
                label="集团统筹SOR名称"
                show-overflow-tooltip
              />
              <template
                v-for="column in evaluateValveColumns"
                :key="`evaluate-valve-${column.key}`"
              >
                <el-table-column
                  :prop="`${column.key}_budget`"
                  width="180"
                  :label="column.amountLabel"
                >
                  <template #default="{ row }">
                    <BaseMoney
                      :value="
                        getValveBudgetValue(row.valveBudgetInfoVoList, column)
                      "
                      empty-text="-"
                    />
                  </template>
                </el-table-column>
                <el-table-column
                  :prop="`${column.key}_remark`"
                  width="160"
                  :label="column.remarkLabel"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    {{
                      getValveBudgetRemark(row.valveBudgetInfoVoList, column)
                    }}
                  </template>
                </el-table-column>
              </template>
              <el-table-column label="支付比例" width="100" align="center">
                <template #default="{ row }">
                  <el-tooltip
                    :content="formatRatio(row.paymentRatio) || '-'"
                    placement="top"
                  >
                    <span class="ellipsis-text">
                      {{ formatRatio(row.paymentRatio) || "-" }}
                    </span>
                  </el-tooltip>
                </template>
              </el-table-column>
              <el-table-column
                prop="paymentEstimate"
                label="支付评估金额"
                width="130"
              >
                <template #default="{ row }">
                  <BaseMoney :value="row.paymentEstimate" empty-text="-" />
                </template>
              </el-table-column>
              <el-table-column
                prop="reductionDiff"
                label="核减差值"
                width="130"
              >
                <template #default="{ row }">
                  <BaseMoney :value="row.reductionDiff" empty-text="-" />
                </template>
              </el-table-column>
              <el-table-column
                prop="reductionRatio"
                label="核减比例"
                width="100"
              >
                <template #default="{ row }">
                  {{ formatRatio(row.reductionRatio) }}
                </template>
              </el-table-column>
            </template>
            <el-table-column
              prop="createName"
              width="100"
              label="创建人"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                {{ row.createName || row.createBy || "-" }}
              </template>
            </el-table-column>
            <el-table-column prop="version" width="100" label="当前版本" />
            <el-table-column prop="createTime" width="160" label="创建时间" />
            <el-table-column
              prop="updateBy"
              width="100"
              label="更新人"
              show-overflow-tooltip
            />
            <el-table-column prop="updateTime" width="160" label="更新时间" />
            <el-table-column
              label="操作"
              fixed="right"
              width="120"
              align="center"
            >
              <template #default="{ row }">
                <PermissionButton
                  link
                  type="primary"
                  size="small"
                  @click="openHistoryPage(row)"
                >
                  历史版本
                </PermissionButton>
              </template>
            </el-table-column>
          </QueryTable>
        </div>
      </el-splitter-panel>
    </el-splitter>
  </PageContainer>
</template>

<style scoped>
.budget-detail-page {
  --budget-detail-pagination-height: 64px;
  /* --budget-detail-right-extension: 14px; */
  display: flex;
  flex-direction: column;
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height) - 20px
  );
  /* margin-right: calc(-1 * var(--budget-detail-right-extension)); */
  min-height: 0;
  overflow: hidden;
  background: var(--bq-color-surface);
}

.budget-detail-page :deep(.page-container__header) {
  flex: 0 0 auto;
}

.budget-detail-page :deep(.page-container__body) {
  display: block;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.budget-detail-page.is-page-fullscreen {
  height: 100vh;
  min-height: 100vh;
  margin-right: 0;
}

.budget-detail-page.is-page-fullscreen :deep(.base-pagination.is-fixed) {
  right: 0;
  bottom: 0;
  left: 0;
}

:global(body.bq-page-fullscreen-active .base-pagination.is-fixed) {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  z-index: 4000 !important;
}

.budget-detail-page :deep(.page-container__actions),
.budget-detail-page :deep(.base-search-form__actions),
.budget-detail-page :deep(.base-toolbar__extra) {
  gap: 12px;
}

.budget-detail-page :deep(.base-search-form__toggle) {
  left: -60px;
}

.budget-detail-page :deep(.page-container__actions .el-button),
.budget-detail-page :deep(.base-search-form__actions .el-button),
.budget-detail-page :deep(.base-toolbar__extra .el-button) {
  width: 95px;
  min-width: 95px;
  justify-content: center;
}

.budget-detail-page :deep(.search-form-item--wide) {
  grid-column: span 3;
}

.budget-detail-page :deep(.base-search-form__content .el-form) {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.budget-detail-page
  :deep(.base-search-form__content .el-form-item:not(.search-form-item--wide)) {
  grid-column: span 2;
}

.detail-layout {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.detail-layout :deep(.el-splitter-panel:first-child) {
  overflow: hidden;
}

.detail-layout :deep(.el-splitter-panel) {
  min-height: 0;
}

.detail-layout :deep(.el-splitter-bar__dragger) {
  width: 16px !important;
}

.detail-layout :deep(.el-splitter-bar__dragger::before) {
  width: 2px;
  height: 28px;
  background-color: #d9dee8;
  border-radius: 2px;
  box-shadow: 4px 0 0 #eef1f6;
}

.detail-layout.is-left-collapsed .left-panel {
  padding: 0;
  border: 0;
  visibility: hidden;
}

.detail-layout.is-left-collapsed :deep(.el-splitter-bar) {
  z-index: 3;
  width: 12px !important;
}

.left-panel {
  width: 100%;
  min-width: 0;
  height: 100%;
  box-sizing: border-box;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-page);
  padding: 12px 12px calc(var(--budget-detail-pagination-height) + 12px);
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--bq-color-surface);
}

.tree-filter-bar {
  display: flex;
  gap: 10px;
  margin: 12px 0;
}

.tree-filter-item {
  cursor: pointer;
  font-size: 14px;
  line-height: 24px;
  color: var(--bq-color-text-muted);
}

.tree-filter-item.active {
  color: var(--bq-color-primary);
}

.right-panel {
  min-width: 0;
  width: calc(100% - 12px);
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-left: 12px;
  background: var(--bq-color-surface);
}

.right-panel :deep(.query-table) {
  min-width: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  container-type: inline-size;
}

.right-panel :deep(.query-table__table) {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.right-panel :deep(.bq-fixed-pagination-spacer) {
  display: none;
}

.right-panel :deep(.base-pagination) {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  flex: 0 0 auto;
  overflow-x: auto;
  overflow-y: hidden;
}

.right-panel :deep(.base-pagination .el-pagination) {
  flex-wrap: nowrap;
  min-width: max-content;
  margin-left: auto;
}

.budget-initiation__selection {
  color: var(--bq-color-text-muted);
  font-size: 13px;
  line-height: 24px;
}

.toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  margin-left: auto;
}

.expand-detail {
  width: var(--bq-table-viewport-width, 100%);
  max-width: none;
  min-width: 0;
  box-sizing: border-box;
  margin: 0;
  overflow: hidden;
  padding: 12px 16px 16px;
  transform: translate3d(var(--bq-table-scroll-left, 0px), 0, 0);
  border-top: 1px solid var(--bq-color-border-subtle);
  border-bottom: 1px solid var(--bq-color-border-subtle);
  background: var(--bq-color-bg-soft);
}

.expand-detail :deep(.el-descriptions) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-surface);
}

.expand-detail :deep(.el-descriptions__table) {
  table-layout: fixed;
  width: 100%;
  max-width: 100%;
  background: var(--bq-color-surface);
}

.expand-detail :deep(.el-descriptions__label) {
  width: 132px;
  min-width: 132px;
  white-space: nowrap;
  background-color: #fcfcfc;
  font-weight: 500 !important;
}

.expand-detail :deep(.el-descriptions__content) {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--bq-color-text);
  font-variant-numeric: tabular-nums;
}

.expand-detail :deep(.el-descriptions__cell) {
  min-width: 0;
  height: 38px;
  padding: 8px 12px;
}

.level-cell {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.wbs-expand-trigger {
  display: inline-flex;
  flex: 0 0 16px;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 20px;
  padding: 0;
  border: 0;
  color: var(--bq-color-primary);
  background: transparent;
  cursor: pointer;
}

.wbs-expand-trigger .el-icon {
  transition: transform 0.2s ease;
}

.wbs-expand-trigger .el-icon.expanded {
  transform: rotate(90deg);
}

.wbs-expand-trigger:focus-visible {
  outline: 2px solid var(--bq-color-primary);
  outline-offset: 1px;
}

.level-number {
  min-width: 0;
  color: var(--bq-color-text);
}

.wbs-number {
  color: var(--bq-color-text);
}

:deep(.native-expand-column) {
  padding: 0 !important;
  border-right: 0 !important;
}

:deep(.native-expand-column .cell) {
  width: 0;
  padding: 0 !important;
  overflow: hidden;
}

:deep(.el-table__expanded-cell) {
  padding: 0 !important;
}

@media (max-width: 1100px) {
  .budget-detail-page :deep(.base-search-form__content .el-form) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .budget-detail-page
    :deep(
      .base-search-form__content .el-form-item:not(.search-form-item--wide)
    ) {
    grid-column: span 1;
  }

  .budget-detail-page :deep(.search-form-item--wide) {
    grid-column: span 1;
  }
}

@media (max-width: 700px) {
  .budget-detail-page {
    margin-right: 0;
  }

  .budget-detail-page :deep(.base-search-form__content .el-form) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-layout :deep(.el-splitter-panel:first-child) {
    flex: 0 0 220px !important;
  }

  .right-panel {
    margin-left: 8px;
  }
}

@media (max-width: 560px) {
  .budget-detail-page :deep(.base-search-form__content .el-form) {
    grid-template-columns: minmax(0, 1fr);
  }

  .detail-layout :deep(.el-splitter-panel:first-child) {
    flex-basis: 180px !important;
  }

  .budget-detail-page :deep(.base-search-form__content) {
    padding-right: 0;
  }

  .budget-detail-page :deep(.base-search-form__toggle) {
    left: auto;
    right: 0;
  }
}

@container (max-width: 960px) {
  .budget-detail-page :deep(.base-search-form__content .el-form) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .budget-detail-page
    :deep(
      .base-search-form__content .el-form-item:not(.search-form-item--wide)
    ) {
    grid-column: span 1;
  }

  .budget-detail-page :deep(.search-form-item--wide) {
    grid-column: span 2;
  }
}

@container (max-width: 560px) {
  .budget-detail-page :deep(.base-search-form__content .el-form) {
    grid-template-columns: minmax(0, 1fr);
  }

  .budget-detail-page :deep(.search-form-item--wide) {
    grid-column: span 1;
  }

  .budget-detail-page :deep(.base-search-form__content) {
    padding-right: 0;
  }

  .budget-detail-page :deep(.base-search-form__toggle) {
    left: auto;
    right: 0;
  }
}
</style>
