<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { Back, ArrowRight, Download, View } from "@element-plus/icons-vue";
import {
  exportInitiationWbsItems,
  fetchInitiationGradeTree,
  fetchInitiationPatterns,
  fetchInitiationWbsItems,
} from "@/api/budget";
import { projectValveList } from "@/api/project";
import QueryTable from "@/components/business/QueryTable.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { formatMoney } from "@/utils/formatters";
import { sameBackendId } from "@/utils/backend-id";
import { replaceToReturn } from "@/utils/return-navigation";
import type {
  InitiationGradeTreeNode,
  InitiationPatternItem,
  InitiationWbsItem,
} from "@/types/budget";
import BaseMoney from "@/components/base/BaseMoney.vue";

type ExpandDetailItem = {
  label: string;
  value: string;
  valueType?: "amount" | "date";
};

type ExpandDetailRow = {
  left?: ExpandDetailItem;
  right?: ExpandDetailItem;
};

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const projectId = computed(() => String(route.query.projectId ?? ""));
const modelName = computed(() => String(route.query.modelName ?? ""));
const routeValveName = computed(() => String(route.query.valveName ?? ""));
const majorVersion = computed(() => String(route.query.majorVersion ?? ""));
const isLatestVersion = computed(() => {
  const value = route.query.isLatestVersion;
  if (value !== undefined && value !== null && value !== "") {
    return Number(value);
  }
  return 1;
});
const budgetLock = computed(() => route.query.budgetLock === "1");
const evaluationLock = computed(() => route.query.evaluationLock === "1");
const valveName = ref("");
const pageTitle = computed(() => modelName.value);
const canDisplayEvaluation = computed(() =>
  authStore.hasPermission("system:project:eva:display"),
);

const treeLoading = ref(false);
const treeData = ref<InitiationGradeTreeNode[]>([]);
const patterns = ref<InitiationPatternItem[]>([]);
const patternsLoaded = ref(false);
const currentStatus = ref<"all" | "valid" | "invalid">("valid");
const curTreeNode = ref<InitiationGradeTreeNode | null>(null);
const treeSearchValue = ref("");
const leftTreeRef = ref<any>(null);
const selectedRows = ref<InitiationWbsItem[]>([]);
const expandedRowKeys = ref<number[]>([]);
const latestExportTaskId = ref<string | number>();
const detailLeftPanelSize = ref(260);
const detailLeftPanelCollapsed = computed(
  () => Number(detailLeftPanelSize.value) <= 1,
);
const queryTableRef = ref<{
  search: () => void;
  reload: () => Promise<void>;
} | null>(null);

const searchForm = reactive({
  wbsNumber: "",
  wbsName: "",
  level: "",
  beginTime: "",
  endTime: "",
  operator: "",
  totalBudgetAmount: "",
});
const searTime = ref<any[] | null>(null);

watch(searTime, (nv) => {
  if (nv) {
    searchForm.beginTime = `${nv[0]} 00:00:00`;
    searchForm.endTime = `${nv[1]} 23:59:59`;
  } else {
    searchForm.beginTime = "";
    searchForm.endTime = "";
  }
});

watch(treeSearchValue, (val) => {
  leftTreeRef.value?.filter(val);
});

function handleSelectionChange(selection: InitiationWbsItem[]) {
  selectedRows.value = selection;
}

function toggleExpand(row: InitiationWbsItem) {
  const isExpanded = expandedRowKeys.value.includes(row.id);
  expandedRowKeys.value = isExpanded
    ? expandedRowKeys.value.filter((id) => id !== row.id)
    : [...expandedRowKeys.value, row.id];
}

function handleRowClick(
  row: InitiationWbsItem,
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
  _row: InitiationWbsItem,
  expandedRows: InitiationWbsItem[],
) {
  expandedRowKeys.value = expandedRows.map((row) => row.id);
}

function handleDetailSplitterResizeEnd(_index: number, sizes: number[]) {
  const nextSize = Number(sizes[0] ?? detailLeftPanelSize.value);
  detailLeftPanelSize.value = nextSize <= 8 ? 1 : nextSize;
}

function setPatternContent(
  budgetArr: InitiationWbsItem["initiationBudget"] | undefined,
  curIndex: number,
  isAssess = false,
) {
  const res = { budget: "-", remark: "-", paymentBudget: "-" };
  if (!budgetArr || !budgetArr.length) return res;
  const curId = patterns.value[curIndex]?.id;
  if (!curId) return res;
  const matched = budgetArr.find((item) =>
    sameBackendId(item.patternId, curId),
  );
  if (!matched) return res;
  res.budget =
    formatMoney(isAssess ? matched.assessBudget : matched.budget) || "0";
  res.remark = (isAssess ? matched.assessRemark : matched.remark) || "-";
  res.paymentBudget = formatMoney(matched.paymentBudget) || "0";
  return res;
}

function resetRatio(ratioString: string | null | undefined) {
  if (!ratioString) return "";
  return ratioString
    .split(",")
    .map((item) => `${item}%`)
    .join("，");
}

function getExpandRows(row: InitiationWbsItem): ExpandDetailRow[] {
  const auditItems: ExpandDetailItem[] = [
    { label: "创建人", value: row.createBy || "-" },
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

  patterns.value.forEach((pattern, index) => {
    const budgetContent = setPatternContent(row.initiationBudget, index, true);
    leftItems.push(
      {
        label: `${pattern.patternName}评估金额`,
        value: budgetContent.budget,
        valueType: "amount",
      },
      {
        label: `费用说明`,
        value: budgetContent.remark,
      },
    );
  });
  leftItems.push({
    label: "评估金额合计",
    value: formatMoney(row.assessTotalAmount),
    valueType: "amount",
  });
  leftItems.push(
    { label: "支付比例", value: resetRatio(row.paymentRatio) || "-" },
    {
      label: "支付评估金额",
      value: formatMoney(row.paymentEstimate),
      valueType: "amount",
    },
    {
      label: "核减差值",
      value: formatMoney(row.reductionDiff),
      valueType: "amount",
    },
  );
  const rightItems: ExpandDetailItem[] = [
    {
      label: "核减比例",
      value:
        row.reductionRatio === null || row.reductionRatio === undefined
          ? "-"
          : `${row.reductionRatio}%`,
    },
  ];
  patterns.value.forEach((pattern, index) => {
    rightItems.push({
      label: `${pattern.patternName}评估支付金额`,
      value: setPatternContent(row.initiationBudget, index, true).paymentBudget,
      valueType: "amount",
    });
  });
  rightItems.push(
    { label: "支付", value: formatMoney(row.paymentAmount), valueType: "amount" },
    {
      label: "摊销",
      value: formatMoney(row.amortizationAmount),
      valueType: "amount",
    },
    { label: "合计", value: formatMoney(row.totalAmount), valueType: "amount" },
    { label: "备注", value: row.remark || "-" },
    {
      label: "总金额超支",
      value: formatMoney(row.totalOverspend),
      valueType: "amount",
    },
    {
      label: "支付超支",
      value: formatMoney(row.paymentOverspend),
      valueType: "amount",
    },
  );
  (leftItems.length < rightItems.length ? leftItems : rightItems).push(
    ...auditItems,
  );

  return Array.from(
    { length: Math.max(leftItems.length, rightItems.length) },
    (_, index) => ({ left: leftItems[index], right: rightItems[index] }),
  );
}

function clearTreeCurrent() {
  curTreeNode.value = null;
  leftTreeRef.value?.setCurrentKey(null);
  currentStatus.value = "all";
  getTreeData();
  queryTableRef.value?.search();
}

function changeStatus(status: "all" | "valid" | "invalid") {
  currentStatus.value = status;
  curTreeNode.value = null;
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
  queryTableRef.value?.search();
}

function resetForm() {
  curTreeNode.value = null;
  currentStatus.value = "all";
  leftTreeRef.value?.setCurrentKey(null);
  searTime.value = null;
  searchForm.wbsNumber = "";
  searchForm.wbsName = "";
  searchForm.level = "";
  searchForm.beginTime = "";
  searchForm.endTime = "";
  searchForm.operator = "";
  searchForm.totalBudgetAmount = "";
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
    const res = await fetchInitiationGradeTree(params);
    treeData.value = res;
  } catch {
    treeData.value = [];
    BaseToast.error("预算等级树加载失败");
  } finally {
    treeLoading.value = false;
  }
}

async function loadPatterns() {
  patternsLoaded.value = false;
  if (!projectId.value) {
    patternsLoaded.value = true;
    return;
  }
  try {
    const data = await fetchInitiationPatterns(projectId.value);
    patterns.value = data;
  } catch {
    patterns.value = [];
    BaseToast.error("预算版型加载失败");
  } finally {
    patternsLoaded.value = true;
  }
}

async function loadValveName() {
  valveName.value = routeValveName.value;
  if (valveName.value || !projectId.value) return;

  const valves = await projectValveList({ projectId: projectId.value });
  const firstValve = valves[0];
  valveName.value = String(
    firstValve?.valveName ?? firstValve?.valvePoint ?? "",
  );
}

async function queryRows(pageSize: number, pageNum: number) {
  if (!projectId.value) {
    return {
      total: 0,
      list: [],
      pageNo: pageNum,
      pageSize,
    };
  }
  expandedRowKeys.value = [];
  try {
    let abolishFlag: number | undefined;
    if (currentStatus.value === "invalid") {
      abolishFlag = 1;
    } else if (currentStatus.value === "valid") {
      abolishFlag = 0;
    }
    const res = await fetchInitiationWbsItems({
      ...searchForm,
      pageSize,
      pageNum,
      projectId: projectId.value,
      treeGradeId: curTreeNode.value?.id ? String(curTreeNode.value.id) : "",
      isLatestVersion: isLatestVersion.value,
      majorVersion: majorVersion.value || null,
      abolishFlag,
    });
    const list = (res.rows || []).map((item) => ({
      ...item,
      grade: item.grade
        ? { ...item.grade, realLevel: (item.grade.level ?? 0) + 1 }
        : { gradeName: "", level: 0, realLevel: 1 },
    }));
    return {
      total: res.total,
      list,
      pageNo: pageNum,
      pageSize,
    };
  } catch {
    BaseToast.error("预算明细加载失败");
    return {
      total: 0,
      list: [],
      pageNo: pageNum,
      pageSize,
    };
  }
}

async function handExport() {
  if (!selectedRows.value.length) {
    BaseToast.warning("请选择要导出的数据");
    return;
  }
  const ids = selectedRows.value.map((item) => item.id).join(",");
  try {
    const task = await exportInitiationWbsItems({
      projectId: projectId.value,
      ids,
    });
    latestExportTaskId.value = task.taskId;
    BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
  } catch {
    BaseToast.error("导出失败");
  }
}

function goBack() {
  replaceToReturn(router, route, "/budget/wbs-touzi/lixiang");
}

function openAssessDialog() {
  if (evaluationLock.value) {
    BaseToast.warning("评估已锁定");
    return;
  }
  if (!selectedRows.value.length) {
    BaseToast.warning("请选择要评估的数据");
    return;
  }
  const ids = selectedRows.value.map((item) => item.id).join(",");
  const selectedRowsKey = `budget-initiation-assess:${projectId.value}:${Date.now()}`;
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
  const returnPath =
    typeof route.query.returnPath === "string" && route.query.returnPath
      ? route.query.returnPath
      : route.fullPath;
  router.push({
    path: "/budget/initiation/assess",
    query: {
      projectId: projectId.value,
      ids,
      selectedRowsKey,
      modelName: modelName.value,
      majorVersion: majorVersion.value || undefined,
      budgetLock: budgetLock.value ? "1" : "0",
      evaluationLock: evaluationLock.value ? "1" : "0",
      abolishFlag,
      returnPath,
    },
  });
}

function openHistoryPage(row: InitiationWbsItem) {
  router.push({
    path: "/budget/initiation/versions",
    query: {
      projectId: projectId.value,
      modelName: modelName.value,
      gradeId: row.gradeId || 0,
      majorVersion: majorVersion.value || row.majorVersion || "",
      historyRowId: row.id == null ? "" : String(row.id),
      returnPath: route.fullPath,
    },
  });
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
  searchForm.level = "";
  searchForm.beginTime = "";
  searchForm.endTime = "";
  searchForm.operator = "";
  searchForm.totalBudgetAmount = "";
  leftTreeRef.value?.setCurrentKey(null);
}

async function refreshPage() {
  resetPageState();
  await loadValveName();
  await getTreeData();
  await loadPatterns();
}

onMounted(() => {
  void refreshPage();
});

// watch([projectId, modelName, routeValveName, majorVersion], () => {
//   void refreshPage();
// });
</script>

<template>
  <PageContainer
    class="budget-detail-page"
    :title="pageTitle"
    :description="`WBS立项：${pageTitle}`"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack"
        >返回</PermissionButton
      >
    </template>
    <TaskStatusPanel v-if="false" :task-id="latestExportTaskId" />
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
            v-if="patternsLoaded"
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
                    v-model="searchForm.totalBudgetAmount"
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
                permission="system:project:initiation:export"
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
              prop="grade.realLevel"
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
                    {{ row.grade?.realLevel ?? "-" }}
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
              prop="grade.gradeName"
              width="150"
              label="当前等级"
              show-overflow-tooltip
            />
            <template v-for="(item, index) in patterns" :key="`bgt-${item.id}`">
              <el-table-column
                :prop="`${item.id}_budget`"
                :label="item.patternName"
                width="150"
              >
                <template #default="{ row }">
                  {{ setPatternContent(row.initiationBudget, index).budget }}
                </template>
              </el-table-column>
              <el-table-column
                :prop="`${item.id}_remark`"
                label="费用说明"
                width="150"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{ setPatternContent(row.initiationBudget, index).remark }}
                </template>
              </el-table-column>
            </template>
            <el-table-column
              prop="totalBudgetAmount"
              label="预算总金额"
              width="130"
            >
              <template #default="{ row }">
                <BaseMoney :value="row.totalBudgetAmount" empty-text="-" />
              </template>
            </el-table-column>
            <el-table-column prop="submitter" width="120" label="预算提报人" />
            <template v-if="canDisplayEvaluation">
              <el-table-column
                prop="sorName"
                width="150"
                label="集团统筹SOR名称"
                show-overflow-tooltip
              />
              <template
                v-for="(item, index) in patterns"
                :key="`bgt-assess-${item.id}`"
              >
                <el-table-column
                  :label="`${item.patternName}评估金额`"
                  width="150"
                >
                  <template #default="{ row }">
                    {{ setPatternContent(row.initiationBudget, index, true).budget }}
                  </template>
                </el-table-column>
                <el-table-column label="评估说明" width="150" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ setPatternContent(row.initiationBudget, index, true).remark }}
                  </template>
                </el-table-column>
              </template>
              <el-table-column prop="assessTotalAmount" label="合计" width="150">
                <template #default="{ row }">
                  <BaseMoney :value="row.assessTotalAmount" empty-text="-" />
                </template>
              </el-table-column>
              <el-table-column label="支付比例" width="100" align="center">
                <template #default="{ row }">
                  <el-tooltip
                    :content="resetRatio(row.paymentRatio) || '-'"
                    placement="top"
                  >
                    <span class="ellipsis-text">
                      {{ resetRatio(row.paymentRatio) || "-" }}
                    </span>
                  </el-tooltip>
                </template>
              </el-table-column>
              <el-table-column prop="paymentEstimate" label="支付评估金额" width="130">
                <template #default="{ row }">
                  <BaseMoney :value="row.paymentEstimate" empty-text="-" />
                </template>
              </el-table-column>
              <el-table-column prop="reductionDiff" label="核减差值" width="130">
                <template #default="{ row }">
                  <BaseMoney :value="row.reductionDiff" empty-text="-" />
                </template>
              </el-table-column>
              <el-table-column prop="reductionRatio" label="核减比例" width="100">
                <template #default="{ row }">
                  {{
                    row.reductionRatio === null || row.reductionRatio === undefined
                      ? "-"
                      : `${row.reductionRatio}%`
                  }}
                </template>
              </el-table-column>
              <template
                v-for="(item, index) in patterns"
                :key="`bgt-payment-${item.id}`"
              >
                <el-table-column
                  :label="`${item.patternName}评估支付金额`"
                  width="150"
                >
                  <template #default="{ row }">
                    {{ setPatternContent(row.initiationBudget, index, true).paymentBudget }}
                  </template>
                </el-table-column>
              </template>
              <el-table-column prop="paymentAmount" label="支付" width="80">
                <template #default="{ row }">
                  <BaseMoney :value="row.paymentAmount" empty-text="-" />
                </template>
              </el-table-column>
              <el-table-column
                prop="amortizationAmount"
                label="摊销"
                width="80"
              >
                <template #default="{ row }">
                  <BaseMoney :value="row.amortizationAmount" empty-text="-" />
                </template>
              </el-table-column>
              <el-table-column prop="totalAmount" label="合计" width="80">
                <template #default="{ row }">
                  <BaseMoney :value="row.totalAmount" empty-text="-" />
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" width="120" show-overflow-tooltip />
              <el-table-column prop="totalOverspend" label="总金额超支" width="110">
                <template #default="{ row }">
                  <BaseMoney :value="row.totalOverspend" empty-text="-" />
                </template>
              </el-table-column>
              <el-table-column prop="paymentOverspend" label="支付超支" width="100">
                <template #default="{ row }">
                  <BaseMoney :value="row.paymentOverspend" empty-text="-" />
                </template>
              </el-table-column>
            </template>
            <el-table-column prop="version" width="100" label="当前版本" />
            <el-table-column
              prop="createBy"
              width="100"
              label="创建人"
              show-overflow-tooltip
            />
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

.toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  margin-left: auto;
}

.ellipsis-text {
  display: inline-block;
  max-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dialog-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.dialog-toolbar-right {
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
  width: 152px;
  min-width: 152px;
  white-space: normal;
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

.expand-detail :deep(.el-descriptions__label),
.expand-detail :deep(.el-descriptions__content) {
  overflow-wrap: anywhere;
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
