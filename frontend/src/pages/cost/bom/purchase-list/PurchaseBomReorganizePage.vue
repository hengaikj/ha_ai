<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back, Check, Grid, Search, Upload } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import { replaceToReturn } from "@/utils/return-navigation";
import QueryTable from "@/components/business/QueryTable.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { fetchProjectValveOptions } from "@/api/project";
import {
  bindPurchaseBomReorganizePattern,
  fetchPurchaseBomDetail,
  fetchPurchaseBomDiff,
  fetchPurchaseBomPartCompare,
  fetchPurchaseBomProjectPatterns,
  fetchPurchaseBomReorganizePatterns,
  fetchPurchaseBomVehicleVersions,
} from "@/api/cost-center";
import type {
  PurchaseBomDetail,
  PurchaseBomDiffItem,
  PurchaseBomPartCompare,
  PurchaseBomProjectPatternItem,
  PurchaseBomReorganizePatternItem,
  PurchaseBomVehicleVersionItem,
} from "@/types/cost-center";
import type { BusinessProjectValveItem } from "@/types/project";

const route = useRoute();
const router = useRouter();
const activeTaskId = ref("");

const projectId = computed(() => Number(route.query.projectId));
const purchaseBomId = computed(() => Number(route.query.purchaseBomId));
type QueryTableExpose = {
  search: () => void;
  reload: () => void;
  clearSelection?: () => void;
  toggleRowSelection?: (
    row: PurchaseBomReorganizePatternItem,
    selected?: boolean,
  ) => void;
};

const detail = ref<PurchaseBomDetail | null>(null);
const activeTab = ref("patterns");
const loading = ref(false);
const reorganizeTableRef = ref<QueryTableExpose | null>(null);
const reorganizePatterns = ref<PurchaseBomReorganizePatternItem[]>([]);
const vehicleVersions = ref<PurchaseBomVehicleVersionItem[]>([]);
const diffParts = ref<PurchaseBomDiffItem[]>([]);
const selectedReorganizeRows = ref<PurchaseBomReorganizePatternItem[]>([]);
const selectedReorganizeRowsByCode = reactive<
  Record<string, PurchaseBomReorganizePatternItem>
>({});
const touchedReorganizeSelectionByCode = reactive<Record<string, boolean>>({});
const selectedOldDiffRows = ref<PurchaseBomDiffItem[]>([]);
const selectedNewDiffRows = ref<PurchaseBomDiffItem[]>([]);
const patternDialogVisible = ref(false);
const patternOptions = ref<PurchaseBomProjectPatternItem[]>([]);
const diffDialogVisible = ref(false);
const diffDialogLoading = ref(false);
const diffVersionLoading = ref(false);
const diffTargetReorganize = ref<PurchaseBomReorganizePatternItem | null>(null);
const diffValveOptions = ref<BusinessProjectValveItem[]>([]);
const activeReorganizeCode = ref("");
const visibleReorganizeRows = ref<PurchaseBomReorganizePatternItem[]>([]);
const syncingReorganizeSelection = ref(false);
const reloadingReorganizeTable = ref(false);
const patternDraftByReorganizeCode = ref<
  Record<string, number | null | undefined>
>(
  {},
);
const compareVisible = ref(false);
const compareDetail = ref<PurchaseBomPartCompare | null>(null);
const routeProjectName = computed(() =>
  readRouteQueryString(route.query.projectName),
);
const pageProjectName = computed(
  () =>  routeProjectName.value || "--",
);
// const canSavePatternBinding = computed(
//   () =>
//     selectedReorganizeRows.value.length > 0 &&
//     selectedReorganizeRows.value.every((row) =>
//       Boolean(patternDraftByReorganizeCode.value[row.reorganizeCode]),
//     ),
// );
const canConfirmDiffDialog = computed(() =>
  Boolean(diffQuery.valveId && diffQuery.baseVersionId),
);

const sourceQuery = reactive({
  reorganizeCode: readRouteQueryString(route.query.reorganizeCode),
  reorganizeName: readRouteQueryString(route.query.reorganizeName),
  reorganizeType: "",
  partNo: "",
  partName: "",
  sorName: "",
  generalLevel: "",
  architectureFlag: "",
  createdRange: [] as string[],
});

const diffQuery = reactive({
  reorganizeCode: "",
  valveId: undefined as number | undefined,
  baseVersionId: undefined as number | undefined,
  partNo: "",
  partName: "",
});

async function loadPage() {
  loading.value = true;
  try {
    if (Number.isFinite(purchaseBomId.value) && purchaseBomId.value > 0) {
      detail.value = await fetchPurchaseBomDetail(
        projectId.value,
        purchaseBomId.value,
      );
    }
    await loadReorganizePatterns(10, 1);
    const firstReorganizeCode = reorganizePatterns.value[0]?.reorganizeCode;
    if (firstReorganizeCode) {
      diffQuery.reorganizeCode = firstReorganizeCode;
      await loadVehicleVersions();
    }
  } finally {
    loading.value = false;
  }
}

async function loadReorganizePatterns(pageSize: number, pageNum: number) {
  const page = await fetchPurchaseBomReorganizePatterns(
    projectId.value,
    purchaseBomId.value,
    {
      reorganizeCode: sourceQuery.reorganizeCode || undefined,
      reorganizeName: sourceQuery.reorganizeName || undefined,
      reorganizeType: sourceQuery.reorganizeType || undefined,
      createdAtStart: sourceQuery.createdRange?.[0],
      createdAtEnd: sourceQuery.createdRange?.[1],
      pageNo: pageNum,
      pageSize,
    },
  );
  reorganizePatterns.value = page.records;
  return {
    total: page.total ?? 0,
    list: page.records,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function viewSourceParts(row: PurchaseBomReorganizePatternItem) {
  router.push({
    path: "/cost/bom/purchase-list/source-parts",
    query: {
      projectId: String(projectId.value || ""),
      purchaseBomId: String(purchaseBomId.value || ""),
      projectName:
        pageProjectName.value !== "--" ? pageProjectName.value : undefined,
      reorganizeCode: row.reorganizeCode,
      reorganizeName: row.reorganizeName || undefined,
      returnPath: route.fullPath,
    },
  });
}

function resetReorganizeQuery() {
  reloadingReorganizeTable.value = true;
  sourceQuery.reorganizeCode = "";
  sourceQuery.reorganizeName = "";
  sourceQuery.reorganizeType = "";
  sourceQuery.createdRange = [];
}

function startReorganizeTableReload() {
  reloadingReorganizeTable.value = true;
}

async function analyzeDiff(row: PurchaseBomReorganizePatternItem) {
  diffTargetReorganize.value = row;
  diffQuery.reorganizeCode = row.reorganizeCode;
  diffQuery.valveId = undefined;
  diffQuery.baseVersionId = undefined;
  vehicleVersions.value = [];
  diffDialogVisible.value = true;
  await ensureDiffValveOptions();
  if (diffValveOptions.value.length === 1) {
    diffQuery.valveId = diffValveOptions.value[0].valveId;
    await handleDiffValveChange();
  }
}

async function ensureDiffValveOptions() {
  if (diffValveOptions.value.length > 0) {
    return;
  }
  diffDialogLoading.value = true;
  try {
    const page = await fetchProjectValveOptions(projectId.value);
    diffValveOptions.value = page.records;
  } catch {
    diffValveOptions.value = [];
  } finally {
    diffDialogLoading.value = false;
  }
}

async function handleDiffValveChange() {
  diffQuery.baseVersionId = undefined;
  vehicleVersions.value = [];
  if (!diffQuery.valveId || !diffQuery.reorganizeCode) {
    return;
  }
  await loadVehicleVersions();
}

function confirmDiffAnalysis() {
  const valve = diffValveOptions.value.find(
    (item) => item.valveId === diffQuery.valveId,
  );
  const version = vehicleVersions.value.find(
    (item) => item.costBomVersionId === diffQuery.baseVersionId,
  );
  if (!diffQuery.valveId) {
    BaseToast.warning("请选择阀点。");
    return;
  }
  if (!version) {
    BaseToast.warning("请选择成本BOM版本。");
    return;
  }
  diffDialogVisible.value = false;
  router.push({
    path: "/cost/bom/purchase-list/diff-analysis",
    query: {
      projectId: String(projectId.value || ""),
      purchaseBomId: String(purchaseBomId.value || ""),
      projectName:
        pageProjectName.value !== "--" ? pageProjectName.value : undefined,
      reorganizeCode:
        diffTargetReorganize.value?.reorganizeCode || diffQuery.reorganizeCode,
      reorganizeName: diffTargetReorganize.value?.reorganizeName || undefined,
      valveId: String(diffQuery.valveId),
      valveCode: valve?.valveCode,
      valveName: valve?.valveName,
      baseVersionId: String(version.costBomVersionId),
      baseVersionName: version.versionName || `V${version.versionNo}`,
      returnPath: route.fullPath,
    },
  });
}

async function openPatternDialog() {
  if (selectedReorganizeRows.value.length === 0) {
    BaseToast.warning("请至少选择一条整编记录。");
    return;
  }
  await ensurePatternOptions();
  initializePatternDrafts();
  patternDialogVisible.value = true;
}

async function ensurePatternOptions() {
  try {
    patternOptions.value = await fetchPurchaseBomProjectPatterns(
      projectId.value,
    );
  } catch {
    patternOptions.value = [];
  }
}

async function handleSelectedReorganizeChange(
  rows: PurchaseBomReorganizePatternItem[],
) {
  if (
    syncingReorganizeSelection.value ||
    reloadingReorganizeTable.value
  ) {
    return;
  }

  const selectedCodes = new Set(rows.map((row) => row.reorganizeCode));
  visibleReorganizeRows.value.forEach((row) => {
    touchedReorganizeSelectionByCode[row.reorganizeCode] = true;
    if (selectedCodes.has(row.reorganizeCode)) {
      selectedReorganizeRowsByCode[row.reorganizeCode] = row;
    } else {
      delete selectedReorganizeRowsByCode[row.reorganizeCode];
    }
  });
  selectedReorganizeRows.value = Object.values(selectedReorganizeRowsByCode);
  resetPatternDrafts();
}

async function syncCheckedReorganizeRows(rows: unknown[]) {
  const reorganizeRows = rows as PurchaseBomReorganizePatternItem[];
  visibleReorganizeRows.value = reorganizeRows;

  // Merge backend-selected rows from every loaded page. A user's explicit
  // choice has priority so an unchecked row is not re-added on refresh.
  reorganizeRows.forEach((row) => {
    if (
      row.checked &&
      !touchedReorganizeSelectionByCode[row.reorganizeCode]
    ) {
      selectedReorganizeRowsByCode[row.reorganizeCode] = row;
    }
  });
  selectedReorganizeRows.value = Object.values(selectedReorganizeRowsByCode);

  syncingReorganizeSelection.value = true;
  try {
    await nextTick();
    reorganizeTableRef.value?.clearSelection?.();
    reorganizeRows.forEach((row) => {
      if (selectedReorganizeRowsByCode[row.reorganizeCode]) {
        reorganizeTableRef.value?.toggleRowSelection?.(row, true);
      }
    });
  } finally {
    syncingReorganizeSelection.value = false;
    reloadingReorganizeTable.value = false;
  }
}

async function savePatternBinding() {
  const bindings = selectedReorganizeRows.value.map((reorganizeRow) => {
    // 未打开“选择版型”时，草稿字典为空。此时必须沿用列表中已有的版型，
    // 不能把 undefined 误认为用户要解除绑定。
    const draftPatternId =
      patternDraftByReorganizeCode.value[reorganizeRow.reorganizeCode];
    const patternId =
      draftPatternId !== undefined
        ? draftPatternId
        : reorganizeRow.patternId ?? undefined;
    const pattern = findPatternById(patternId);
    return {
      reorganizeRow,
      pattern,
      patternId,
    };
  });
  if (selectedReorganizeRows.value.length === 0) {
    BaseToast.warning("请至少选择一条整编记录。");
    return;
  }
  await bindPurchaseBomReorganizePattern(
    projectId.value,
    purchaseBomId.value,
    bindings.map(({ reorganizeRow, pattern, patternId }) => ({
      reorganizeCode: reorganizeRow.reorganizeCode,
      pattern:
        pattern || patternId
          ? {
              patternId: pattern?.patternId ?? patternId,
              patternCode:
                pattern?.patternCode ?? reorganizeRow.patternCode ?? null,
              patternName:
                pattern?.patternName ?? reorganizeRow.patternName ?? null,
            }
          : null,
    })),
    pageProjectName.value !== "--" ? pageProjectName.value : undefined,
  );
  reorganizeTableRef.value?.reload();
  selectedReorganizeRows.value = [];
  Object.keys(selectedReorganizeRowsByCode).forEach(
    (reorganizeCode) => delete selectedReorganizeRowsByCode[reorganizeCode],
  );
  Object.keys(touchedReorganizeSelectionByCode).forEach(
    (reorganizeCode) => delete touchedReorganizeSelectionByCode[reorganizeCode],
  );
  visibleReorganizeRows.value = [];
  patternOptions.value = [];
  resetPatternDrafts();
  patternDialogVisible.value = false;
  BaseToast.success("整编版型关系已保存。");
}

function initializePatternDrafts() {
  const drafts: Record<string, number | null | undefined> = {};
  selectedReorganizeRows.value.forEach((row) => {
    // 先以列表返回的绑定关系初始化，即使版型不在当前选项列表中也不能丢失。
    drafts[row.reorganizeCode] = row.patternId ?? undefined;
  });
  patternDraftByReorganizeCode.value = drafts;
  if (
    !activeReorganizeCode.value ||
    !selectedReorganizeRows.value.some(
      (row) => row.reorganizeCode === activeReorganizeCode.value,
    )
  ) {
    activeReorganizeCode.value =
      selectedReorganizeRows.value[0]?.reorganizeCode ?? "";
  }
}

function resetPatternDrafts() {
  activeReorganizeCode.value = "";
  patternDraftByReorganizeCode.value = {};
}

function findPatternById(patternId?: number) {
  return patternOptions.value.find((item) => item.patternId === patternId);
}

function selectPattern(patternId: number) {
  if (!activeReorganizeCode.value) {
    return;
  }
  const activeCode = activeReorganizeCode.value;
  if (isPatternChecked(patternId)) {
    patternOptions.value.forEach((item) => {
      if (item.reorganizeCode12 === activeCode) {
        item.reorganizeCode12 = null;
      }
      if (item.reorganizeCode18 === activeCode) {
        item.reorganizeCode18 = null;
      }
    });
    // null 表示用户明确解除绑定；undefined 仍表示未修改，保存时沿用旧绑定。
    patternDraftByReorganizeCode.value = {
      ...patternDraftByReorganizeCode.value,
      [activeCode]: null,
    };
    return;
  }
  if (isPatternUsedByOtherReorganize(patternId)) {
    return;
  }
  patternOptions.value.forEach((item) => {
    if (item.reorganizeCode12 === activeCode) {
      item.reorganizeCode12 = null;
    }
    if (item.reorganizeCode18 === activeCode) {
      item.reorganizeCode18 = null;
    }
  });
  const selectedPattern = findPatternById(patternId);
  if (selectedPattern) {
    const relationField =
      activeCode.length <= 12 ? "reorganizeCode12" : "reorganizeCode18";
    selectedPattern[relationField] = activeCode;
  }
  patternDraftByReorganizeCode.value = {
    ...patternDraftByReorganizeCode.value,
    [activeCode]: patternId,
  };
}

function isPatternChecked(patternId: number) {
  return (
    patternDraftByReorganizeCode.value[activeReorganizeCode.value] === patternId
  );
}

function isPatternUsedByOtherReorganize(patternId: number) {
  const pattern = patternOptions.value.find(
    (item) => item.patternId === patternId,
  );
  const activeCode = activeReorganizeCode.value;
  const relationCodes = [
    pattern?.reorganizeCode12,
    pattern?.reorganizeCode18,
  ].filter((code): code is string => Boolean(code));
  if (
    relationCodes.length > 0 &&
    !relationCodes.some((code) => code === activeCode)
  ) {
    return true;
  }

  return selectedReorganizeRows.value.some(
    (row) =>
      row.reorganizeCode !== activeReorganizeCode.value &&
      patternDraftByReorganizeCode.value[row.reorganizeCode] === patternId,
  );
}

function selectActiveReorganize(reorganizeCode: string) {
  activeReorganizeCode.value = reorganizeCode;
}

function getDraftPatternName(row: PurchaseBomReorganizePatternItem) {
  if (
    Object.prototype.hasOwnProperty.call(
      patternDraftByReorganizeCode.value,
      row.reorganizeCode,
    ) &&
    patternDraftByReorganizeCode.value[row.reorganizeCode] === null
  ) {
    return "未选择";
  }
  return (
    findPatternById(patternDraftByReorganizeCode.value[row.reorganizeCode])
      ?.patternName ??
    row.patternName ??
    "未选择"
  );
}

async function loadVehicleVersions() {
  diffVersionLoading.value = true;
  if (!diffQuery.reorganizeCode || !diffQuery.valveId) {
    vehicleVersions.value = [];
    diffVersionLoading.value = false;
    return;
  }
  try {
    const data = await fetchPurchaseBomVehicleVersions(
      projectId.value,
      diffQuery.reorganizeCode,
      { valveId: diffQuery.valveId },
    );
    vehicleVersions.value = data.versions;
    diffQuery.baseVersionId = data.versions[0]?.costBomVersionId;
  } finally {
    diffVersionLoading.value = false;
  }
}

// async function exportVehicleVersions() {
//   if (!diffQuery.reorganizeCode || !detail.value?.valveId) {
//     BaseToast.warning("请选择整编编号，并确认采购BOM存在阀点。");
//     return;
//   }
//   const task = await createPurchaseBomVehicleVersionExportTask(
//     projectId.value,
//     purchaseBomId.value,
//     diffQuery.reorganizeCode,
//     {
//       valveId: detail.value.valveId,
//       remark: `导出${detail.value.projectName}采购BOM车型版本`,
//     },
//   );
//   activeTaskId.value = task.taskId;
//   BaseToast.success(`车型版本导出任务已创建：${task.taskNo || task.taskId}`);
// }

async function loadDiffParts() {
  if (
    !diffQuery.reorganizeCode ||
    !diffQuery.baseVersionId ||
    !detail.value?.valveId
  ) {
    BaseToast.warning("请选择整编编号、基准版本，并确认采购BOM存在阀点。");
    return;
  }
  const page = await fetchPurchaseBomDiff(
    projectId.value,
    purchaseBomId.value,
    diffQuery.reorganizeCode,
    {
      baseVersionId: diffQuery.baseVersionId,
      valveId: detail.value.valveId,
      partNo: diffQuery.partNo || undefined,
      partName: diffQuery.partName || undefined,
      pageNo: 1,
      pageSize: 100,
    },
  );
  diffParts.value = page.records;
}

// async function exportDiffParts() {
//   if (
//     !diffQuery.reorganizeCode ||
//     !diffQuery.baseVersionId ||
//     !detail.value?.valveId
//   ) {
//     BaseToast.warning("请选择整编编号、基准版本，并确认采购BOM存在阀点。");
//     return;
//   }
//   const task = await createPurchaseBomDiffExportTask(
//     projectId.value,
//     purchaseBomId.value,
//     diffQuery.reorganizeCode,
//     {
//       baseVersionId: diffQuery.baseVersionId,
//       valveId: detail.value.valveId,
//       partNo: diffQuery.partNo || undefined,
//       partName: diffQuery.partName || undefined,
//       remark: `导出${detail.value.projectName}采购BOM差异分析`,
//     },
//   );
//   activeTaskId.value = task.taskId;
//   BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
// }

async function openCompare(row: PurchaseBomDiffItem) {
  if (
    !diffQuery.reorganizeCode ||
    !diffQuery.baseVersionId ||
    !detail.value?.valveId
  ) {
    return;
  }
  compareDetail.value = await fetchPurchaseBomPartCompare(
    projectId.value,
    purchaseBomId.value,
    diffQuery.reorganizeCode,
    row.partNo,
    {
      baseVersionId: diffQuery.baseVersionId,
      valveId: detail.value.valveId,
    },
  );
  compareVisible.value = true;
}

async function compareSelectedDiffParts() {
  if (
    selectedOldDiffRows.value.length !== 1 ||
    selectedNewDiffRows.value.length !== 1
  ) {
    BaseToast.warning("左右各选择一个零件后再对比。");
    return;
  }
  if (
    selectedOldDiffRows.value[0].partNo !== selectedNewDiffRows.value[0].partNo
  ) {
    BaseToast.warning("请选择相同零件号进行对比。");
    return;
  }
  await openCompare(selectedNewDiffRows.value[0]);
}

function goBack() {
  const purchaseBomListPathByReorganizePath: Record<string, string> = {
    "/cost/bom/reorganize": "/cost/bom/purchase-list",
    "/cost/bom/purchase-list/reorganize": "/cost/bom/purchase-list",
    "/manageBom/purchaseBom/reorganize": "/manageBom/purchaseBom",
    "/costmanagementnew/manageBom/purchaseBom/reorganize":
      "/costmanagementnew/manageBom/purchaseBom",
  };

  replaceToReturn(
    router,
    route,
    purchaseBomListPathByReorganizePath[route.path] ??
      "/cost/bom/purchase-list",
  );
}

function resolveFactoryCode() {
  return detail.value?.plant || "--";
}

function readRouteQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }
  return typeof value === "string" ? value : "";
}

onMounted(loadPage);
</script>

<template>
  <PageContainer class="purchase-bom-reorganize-container" title="查看整编">
    <template #titleExtra>
      <span class="purchase-bom-reorganize-page__project">
        <span>项目代号：</span>
        <span>{{ pageProjectName }}</span>
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

    <section v-loading="loading" class="purchase-bom-reorganize-page">
      <main class="purchase-bom-reorganize-page__body">
        <section
          v-show="activeTab === 'patterns'"
          class="purchase-bom-reorganize-page__panel"
        >
          <QueryTable
            ref="reorganizeTableRef"
            class="purchase-bom-reorganize-page__table"
            :func="loadReorganizePatterns"
            row-key="reorganizeCode"
            show-toolbar
            fit-table-height
            :table-props="{
              onSelectionChange: handleSelectedReorganizeChange,
              reserveSelection: true,
            }"
            empty-title="暂无整编数据"
            empty-description="当前筛选条件下没有可展示的整编数据。"
            @search="startReorganizeTableReload"
            @page-change="startReorganizeTableReload"
            @size-change="startReorganizeTableReload"
            @refresh="startReorganizeTableReload"
            @reset="resetReorganizeQuery"
            @loaded="syncCheckedReorganizeRows"
          >
            <template #search>
              <el-form :model="sourceQuery">
                <el-form-item label="整编编号">
                  <el-input
                    v-model="sourceQuery.reorganizeCode"
                    clearable
                    placeholder="请输入整编编号"
                  />
                </el-form-item>
                <el-form-item label="整编名称">
                  <el-input
                    v-model="sourceQuery.reorganizeName"
                    clearable
                    placeholder="请输入整编名称"
                  />
                </el-form-item>
                <el-form-item label="整编类型">
                  <el-select
                    v-model="sourceQuery.reorganizeType"
                    clearable
                    placeholder="请选择整编类型"
                  >
                    <el-option label="12位整编" value="0" />
                    <el-option label="18位整编" value="1" />
                  </el-select>
                </el-form-item>
                <el-form-item label="创建时间">
                  <el-date-picker
                    v-model="sourceQuery.createdRange"
                    clearable
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
                permission="system:pattern:project"
                :icon="Grid"
                @click="openPatternDialog"
              >
                选择版型
              </PermissionButton>
              <PermissionButton
                permission="manage:purchaseView:save"
                variant="primary"
                @click="savePatternBinding"
              >
                保存
              </PermissionButton>
            </template>

            <el-table-column type="selection" width="48" fixed="left" />
            <el-table-column
              type="index"
              label="序号"
              width="70"
              align="center"
            />
            <el-table-column
              prop="reorganizeCode"
              label="整编编号"
              min-width="170"
            />
            <el-table-column
              prop="reorganizeName"
              label="整编名称"
              min-width="180"
            />
            <el-table-column label="工厂代码" min-width="120" prop="plant"/>
            <el-table-column
              prop="partCount"
              label="总零件数量"
              width="120"
              align="center"
            >
              <template #default="{ row }">
                {{ row.partCount ?? 0 }}
              </template>
            </el-table-column>
            <el-table-column
              prop="patternName"
              label="版型名称"
              min-width="140"
            >
              <template #default="{ row }">
                <PermissionButton v-if="row.patternName" link type="primary">
                  {{ row.patternName }}
                </PermissionButton>
                <PermissionButton v-else link type="primary">
                  无版型
                </PermissionButton>
              </template>
            </el-table-column>
            <el-table-column label="数据来源" min-width="120">
              <template #default> BOM平台 </template>
            </el-table-column>
            <el-table-column label="创建人" min-width="120">
              <template #default>
                {{ detail?.createdBy ? String(detail.createdBy) : "--" }}
              </template>
            </el-table-column>
            <el-table-column
              prop="updatedAt"
              label="创建时间"
              min-width="170"
            />
            <el-table-column
              label="操作"
              width="190"
              fixed="right"
              align="center"
            >
              <template #default="{ row }">
                <PermissionButton
                  permission="manage:purchaseView:show"
                  link
                  type="primary"
                  @click="viewSourceParts(row)"
                >
                  查看
                </PermissionButton>
                <PermissionButton
                  permission="manage:purchaseView:analysis"
                  link
                  type="primary"
                  @click="analyzeDiff(row)"
                >
                  差异化分析
                </PermissionButton>
              </template>
            </el-table-column>
          </QueryTable>
        </section>

        <section
          v-show="activeTab === 'diff'"
          class="purchase-bom-reorganize-page__panel"
        >
          <div class="purchase-bom-reorganize-page__query">
            <el-select
              v-model="diffQuery.reorganizeCode"
              filterable
              placeholder="整编编号"
              @change="loadVehicleVersions"
            >
              <el-option
                v-for="item in reorganizePatterns"
                :key="item.reorganizeCode"
                :label="item.reorganizeCode"
                :value="item.reorganizeCode"
              />
            </el-select>
            <el-select
              v-model="diffQuery.baseVersionId"
              filterable
              placeholder="基准版本"
            >
              <el-option
                v-for="version in vehicleVersions"
                :key="version.costBomVersionId"
                :label="version.versionName || `V${version.versionNo}`"
                :value="version.costBomVersionId"
              />
            </el-select>
            <el-input
              v-model="diffQuery.partNo"
              clearable
              placeholder="零件号"
            />
            <el-input
              v-model="diffQuery.partName"
              clearable
              placeholder="零件名称"
            />
            <PermissionButton
              type="primary"
              :icon="Search"
              @click="loadDiffParts"
              >查询</PermissionButton
            >
            <PermissionButton
              permission="cost:bom:purchase-list:compare"
              variant="primary"
              type="primary"
              @click="compareSelectedDiffParts"
            >
              对比
            </PermissionButton>
<!--            <PermissionButton-->
<!--              permission="manage:purchaseView:export"-->
<!--              variant="secondary"-->
<!--              :icon="Download"-->
<!--              @click="exportVehicleVersions"-->
<!--              type="warning"-->
<!--            >-->
<!--              导出车型版本-->
<!--            </PermissionButton>-->
<!--            <PermissionButton-->
<!--              permission="manage:purchaseView:export"-->
<!--              variant="secondary"-->
<!--              :icon="Download"-->
<!--              @click="exportDiffParts"-->
<!--              type="warning"-->
<!--            >-->
<!--              导出-->
<!--            </PermissionButton>-->
          </div>
          <div class="purchase-bom-reorganize-page__diff-layout">
            <el-table
              :data="diffParts"
              border
              height="420"
              @selection-change="
                (rows: PurchaseBomDiffItem[]) => (selectedOldDiffRows = rows)
              "
            >
              <el-table-column type="selection" width="48" />
              <el-table-column
                prop="partNo"
                label="对比零件号"
                min-width="150"
              />
              <el-table-column
                prop="partName"
                label="对比零件名称"
                min-width="180"
              />
              <el-table-column
                prop="oldQuantity"
                label="旧数量"
                min-width="110"
                align="right"
              />
              <el-table-column prop="oldUnit" label="旧单位" width="90" />
            </el-table>
            <el-table
              :data="diffParts"
              border
              height="420"
              @selection-change="
                (rows: PurchaseBomDiffItem[]) => (selectedNewDiffRows = rows)
              "
            >
              <el-table-column type="selection" width="48" />
              <el-table-column prop="partNo" label="新零件号" min-width="150" />
              <el-table-column
                prop="partName"
                label="新零件名称"
                min-width="180"
              />
              <el-table-column
                prop="changeType"
                label="差异类型"
                min-width="120"
              />
              <el-table-column
                prop="newQuantity"
                label="新数量"
                min-width="110"
                align="right"
              />
              <el-table-column prop="newUnit" label="新单位" width="90" />
            </el-table>
          </div>
        </section>
      </main>
    </section>

    <BaseFormDialog
      v-model="compareVisible"
      :title="compareDetail ? `${compareDetail.partNo}零件对比` : '零件对比'"
      width="760px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
    >
      <el-table :data="compareDetail?.diffFields ?? []" border max-height="360">
        <el-table-column prop="fieldName" label="字段" min-width="150" />
        <el-table-column prop="oldValue" label="旧值" min-width="200">
          <template #default="{ row }">
            <span
              :class="{
                'purchase-bom-reorganize-page__diff-value':
                  row.oldValue !== row.newValue,
              }"
            >
              {{ row.oldValue || "--" }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="newValue" label="新值" min-width="200">
          <template #default="{ row }">
            <span
              :class="{
                'purchase-bom-reorganize-page__diff-value':
                  row.oldValue !== row.newValue,
              }"
            >
              {{ row.newValue || "--" }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="diffDialogVisible"
      title="选择阀点"
      width="560px"
      top="56px"
      confirm-text="确定"
      body-max-height="360px"
      :confirm-button-props="{
        disabled: !canConfirmDiffDialog,
        permission: 'manage:purchaseView:analysis',
      }"
      @confirm="confirmDiffAnalysis"
    >
      <div
        v-loading="diffDialogLoading"
        class="purchase-bom-reorganize-page__diff-dialog"
      >
        <el-form label-position="top">
          <el-form-item label="选择阀点">
            <el-select
              v-model="diffQuery.valveId"
              clearable
              filterable
              placeholder="请选择阀点"
              @change="handleDiffValveChange"
            >
              <el-option
                v-for="item in diffValveOptions"
                :key="item.valveId"
                :label="item.valveName || item.valveCode"
                :value="item.valveId"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="diffQuery.valveId" label="选择成本BOM版本">
            <el-select
              v-model="diffQuery.baseVersionId"
              clearable
              filterable
              :loading="diffVersionLoading"
              placeholder="请选择成本BOM版本"
            >
              <el-option
                v-for="version in vehicleVersions"
                :key="version.costBomVersionId"
                :label="version.versionName || `V${version.versionNo}`"
                :value="version.costBomVersionId"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="patternDialogVisible"
      title="选择版型"
      width="760px"
      top="56px"
      confirm-text="确定"
      body-max-height="460px"
      :confirm-button-props="{
        permission: 'system:pattern:project',
      }"
      @confirm="savePatternBinding"
    >
      <div class="purchase-bom-reorganize-page__pattern-summary">
        已选择整编（{{ selectedReorganizeRows.length }}）条
      </div>
      <div class="purchase-bom-reorganize-page__pattern-dialog">
        <section class="purchase-bom-reorganize-page__pattern-column">
          <h3>全部整编</h3>
          <div class="purchase-bom-reorganize-page__pattern-list">
            <button
              v-for="row in selectedReorganizeRows"
              :key="row.reorganizeCode"
              class="purchase-bom-reorganize-page__reorganize-item"
              :class="{
                'is-active': row.reorganizeCode === activeReorganizeCode,
              }"
              type="button"
              @click="selectActiveReorganize(row.reorganizeCode)"
            >
              <span>
                <strong>{{ row.reorganizeName || "--" }}</strong>
                <em>{{ row.reorganizeCode }}</em>
              </span>
              <b>{{ getDraftPatternName(row) }}</b>
            </button>
          </div>
        </section>

        <section class="purchase-bom-reorganize-page__pattern-column">
          <h3>全部版型</h3>
          <div class="purchase-bom-reorganize-page__pattern-list">
            <label
              v-for="item in patternOptions"
              :key="item.patternId"
              class="purchase-bom-reorganize-page__pattern-item"
              :class="{
                'is-checked': isPatternChecked(item.patternId),
                'is-disabled': isPatternUsedByOtherReorganize(item.patternId),
              }"
              @click="selectPattern(item.patternId)"
            >
              <span
                class="purchase-bom-reorganize-page__pattern-check"
                :class="{
                  'is-marked':
                    isPatternChecked(item.patternId) ||
                    isPatternUsedByOtherReorganize(item.patternId),
                }"
              >
                <el-icon
                  v-if="
                    isPatternChecked(item.patternId) ||
                    isPatternUsedByOtherReorganize(item.patternId)
                  "
                >
                  <Check />
                </el-icon>
              </span>
              <span>{{ item.patternName }}</span>
            </label>
          </div>
        </section>
      </div>
    </BaseFormDialog>
    <TaskStatusPanel v-if="false" :task-id="activeTaskId" />
  </PageContainer>
</template>

<style scoped>
.purchase-bom-reorganize-page {
  min-height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) - 96px
  );
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.purchase-bom-reorganize-page__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0;
}

.purchase-bom-reorganize-page__project {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 24px;
}

.purchase-bom-reorganize-page__project strong {
  color: var(--bq-color-text);
  font-weight: 600;
}

.purchase-bom-reorganize-page__panel {
  min-height: 0;
}

.purchase-bom-reorganize-page__table {
  gap: 12px;
}

.purchase-bom-reorganize-page__table :deep(.base-search-form) {
  padding-bottom: 8px;
}

.purchase-bom-reorganize-page__table :deep(.base-search-form__content) {
  padding-right: 72px;
}

.purchase-bom-reorganize-page__table
  :deep(.base-search-form__content .el-form) {
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  row-gap: 14px;
  column-gap: 16px;
}

.purchase-bom-reorganize-page__table :deep(.base-search-form__actions) {
  padding-top: 4px;
}

.purchase-bom-reorganize-page__table :deep(.base-toolbar) {
  min-height: 38px;
  padding: 6px 0 10px;
  border: 0;
}

.purchase-bom-reorganize-page__choose {
  --el-button-bg-color: var(--bq-color-primary-soft);
  --el-button-border-color: var(--bq-color-primary-soft);
  --el-button-text-color: var(--bq-color-primary);
}

.purchase-bom-reorganize-page__table :deep(.el-table) {
  font-size: 14px;
}

.purchase-bom-reorganize-page__table :deep(.el-table th.el-table__cell) {
  height: 52px;
  font-weight: 600;
}

.purchase-bom-reorganize-page__table :deep(.el-table .el-table__row) {
  height: 82px;
}

.purchase-bom-reorganize-page__table
  :deep(.el-table__row.current-row > td.el-table__cell),
.purchase-bom-reorganize-page__table
  :deep(.el-table__row:hover > td.el-table__cell) {
  background: color-mix(in srgb, var(--bq-color-primary), white 96%);
}

.purchase-bom-reorganize-page__query {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.purchase-bom-reorganize-page__diff-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.purchase-bom-reorganize-page__diff-value {
  color: var(--bq-color-warning);
  font-weight: 600;
}


.purchase-bom-reorganize-page__pattern-summary {
  margin: -8px 0 18px;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 22px;
}

.purchase-bom-reorganize-page__pattern-dialog {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 340px;
}

.purchase-bom-reorganize-page__pattern-column {
  min-width: 0;
  padding: 0 36px 0 12px;
}

.purchase-bom-reorganize-page__pattern-column
  + .purchase-bom-reorganize-page__pattern-column {
  padding: 0 12px 0 36px;
  border-left: 1px solid var(--bq-color-border);
}

.purchase-bom-reorganize-page__pattern-column h3 {
  margin: 0 0 18px;
  color: var(--bq-color-text);
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.purchase-bom-reorganize-page__pattern-list {
  display: grid;
  gap: 10px;
}

.purchase-bom-reorganize-page__reorganize-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-surface);
  color: var(--bq-color-text);
  text-align: left;
  cursor: pointer;
}

.purchase-bom-reorganize-page__reorganize-item.is-active {
  border-color: var(--bq-color-primary);
  background: var(--bq-color-primary);
  color: var(--bq-color-on-primary);
}

.purchase-bom-reorganize-page__reorganize-item span {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.purchase-bom-reorganize-page__reorganize-item strong,
.purchase-bom-reorganize-page__reorganize-item em,
.purchase-bom-reorganize-page__reorganize-item b {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-bom-reorganize-page__reorganize-item strong {
  font-weight: 600;
}

.purchase-bom-reorganize-page__reorganize-item em {
  color: inherit;
  font-size: 12px;
  font-style: normal;
  opacity: 0.72;
}

.purchase-bom-reorganize-page__reorganize-item b {
  flex: 0 0 auto;
  max-width: 96px;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.82;
}

.purchase-bom-reorganize-page__pattern-item {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--bq-color-text-secondary);
  font-size: 15px;
  line-height: 22px;
  cursor: pointer;
}

.purchase-bom-reorganize-page__pattern-item.is-checked {
  color: var(--bq-color-text);
}

.purchase-bom-reorganize-page__pattern-item.is-disabled {
  color: var(--bq-color-text-disabled);
  cursor: not-allowed;
}

.purchase-bom-reorganize-page__pattern-check {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--bq-color-border);
  border-radius: 2px;
  background: var(--bq-color-surface);
  color: transparent;
}

.purchase-bom-reorganize-page__pattern-check.is-marked {
  border-color: var(--bq-color-primary);
  background: var(--bq-color-primary);
  color: var(--bq-color-on-primary);
}

.purchase-bom-reorganize-page__pattern-item.is-disabled
  .purchase-bom-reorganize-page__pattern-check.is-marked {
  border-color: var(--bq-color-border);
  background: var(--bq-color-fill);
  color: var(--bq-color-text-disabled);
}

.purchase-bom-reorganize-page__pattern-check .el-icon {
  font-size: 12px;
  line-height: 1;
}

@media (max-width: 1100px) {
  .purchase-bom-reorganize-page__table :deep(.base-search-form) {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .purchase-bom-reorganize-page__table :deep(.base-search-form__content) {
    padding-right: 0;
  }

  .purchase-bom-reorganize-page__table
    :deep(.base-search-form__content .el-form) {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }
}

@media (max-width: 720px) {
  .purchase-bom-reorganize-page__body {
    padding: 0;
  }

  .purchase-bom-reorganize-page__table
    :deep(.base-search-form__content .el-form) {
    grid-template-columns: 1fr;
  }

  .purchase-bom-reorganize-page__pattern-dialog {
    grid-template-columns: 1fr;
  }

  .purchase-bom-reorganize-page__pattern-column,
  .purchase-bom-reorganize-page__pattern-column
    + .purchase-bom-reorganize-page__pattern-column {
    padding: 0;
    border-left: 0;
  }

  .purchase-bom-reorganize-page__pattern-column
    + .purchase-bom-reorganize-page__pattern-column {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--bq-color-border);
  }
}
</style>
