<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
 
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Download, Grid, Upload } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import { BaseToast } from "@/components/base/BaseToast";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { fetchProjectValveOptions } from "@/api/project";
import {
  createPurchaseBomGenerateTask,
  createPurchaseBomWorkbenchExportTask,
  fetchPurchaseBoms,
  fetchPurchaseBomReorganizePatterns,
} from "@/api/cost-center";
import type {
  PurchaseBomItem,
  PurchaseBomReorganizePatternItem,
} from "@/types/cost-center";
import type { BusinessProjectValveItem } from "@/types/project";

type PurchaseBomQuery = {
  projectName: string;
  bomStatus: string;
  createdRange: string[];
};
const activeTaskId = ref("");

type PurchaseBomRow = {
  id: number;
  projectId: number;
  purchaseBomId: number;
  projectName: string;
  compiledCount: number;
  bomStatus: "未生成" | "已生成" | "进行中" | "生成失败";
  creator: string;
  createdAt: string;
  updatedAt: string;
  boundVersion: string;
  projectNumber?: string | null;
  valveId?: number | null;
  remark?: string | null;
  version: number;
};

type BoundVersionRow = {
  patternCode?: string;
  patternName: string;
  reorganizeCode: string;
  reorganizeName: string;
};

type QueryTableExpose = {
  search: () => void;
  reload: () => void;
};

type GenerateCostBomForm = {
  valveId?: number;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const selectedRows = ref<PurchaseBomRow[]>([]);
const route = useRoute();
const router = useRouter();
const boundVersionMap = ref<Record<number, BoundVersionRow[]>>({});
const boundVersionLoadingMap = ref<Record<number, boolean>>({});
const generateDialogVisible = ref(false);
const generateSubmitting = ref(false);
const generateValveLoading = ref(false);
const generateTargetRow = ref<PurchaseBomRow | null>(null);
const generateValveOptions = ref<BusinessProjectValveItem[]>([]);
const generateFormRef = ref<FormInstance>();
const generateForm = reactive<GenerateCostBomForm>({
  valveId: undefined,
});
const generateFormRules: FormRules<GenerateCostBomForm> = {
  valveId: [
    {
      required: true,
      message: "请选择阀点",
      trigger: "change",
    },
  ],
};
const query = reactive<PurchaseBomQuery>({
  projectName: readRouteQueryString(route.query.projectName),
  bomStatus: "",
  createdRange: [],
});
const bomStatusOptions = [
  { label: "未生成", value: "0" },
  { label: "进行中", value: "1" },
  { label: "已生成", value: "2" },
];
const selectedCountText = computed(() =>
  selectedRows.value.length > 0 ? `已选择 ${selectedRows.value.length} 项` : "",
);

watch(
  () => route.query,
  () => {
    applyRouteQuery();
    queryTableRef.value?.search();
  },
);

async function queryPurchaseBomList(pageSize: number, pageNum: number) {
  const page = await fetchPurchaseBoms({
    projectName: query.projectName || undefined,
    costBomStatus: query.bomStatus || undefined,
    startTime: query.createdRange?.[0] || undefined,
    endTime: query.createdRange?.[1] || undefined,
    total: 0,
    pageNum,
    pageSize,
  });

  return {
    total: page.total ?? 0,
    list: page.records.map(toPurchaseBomRow),
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function toPurchaseBomRow(item: PurchaseBomItem): PurchaseBomRow {
  return {
    id: item.purchaseBomId,
    projectId: item.projectId,
    purchaseBomId: item.purchaseBomId,
    projectName: item.projectName,
    compiledCount: item.reorganizeCount,
    bomStatus: toFrontendStatus(item.costBomStatus),
    creator: item.createBy || (item.createdBy ? String(item.createdBy) : "--"),
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
    boundVersion: patternDisplay(item.patterns) || item.projectNumber || "",
    projectNumber: item.projectNumber,
    valveId: item.valveId,
    remark: item.remark,
    version: item.version,
  };
}

function toBoundVersionRow(
  item: PurchaseBomReorganizePatternItem,
): BoundVersionRow {
  return {
    patternCode: item.patternCode || undefined,
    patternName: item.patternName || "--",
    reorganizeCode: item.reorganizeCode || "--",
    reorganizeName: item.reorganizeName || "--",
  };
}

function resetQuery() {
  Object.assign(query, {
    projectName: readRouteQueryString(route.query.projectName),
    bomStatus: "",
    createdRange: [],
  });
}

function applyRouteQuery() {
  query.projectName = readRouteQueryString(route.query.projectName);
  selectedRows.value = [];
}

function readRouteQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }
  return typeof value === "string" ? value : "";
}

function searchPurchaseBomList() {
  queryTableRef.value?.search();
}

function refreshPurchaseBomList() {
  queryTableRef.value?.reload();
}

function handleSelectionChange(rows: PurchaseBomRow[]) {
  selectedRows.value = rows;
}

async function loadBoundVersions(row: PurchaseBomRow) {
  if (boundVersionMap.value[row.id] || boundVersionLoadingMap.value[row.id]) {
    return;
  }
  boundVersionLoadingMap.value = {
    ...boundVersionLoadingMap.value,
    [row.id]: true,
  };
  try {
    const page = await fetchPurchaseBomReorganizePatterns(
      row.projectId,
      row.purchaseBomId,
      {
        pageNo: 1,
        pageSize: 200,
      },
    );
    boundVersionMap.value = {
      ...boundVersionMap.value,
      [row.id]: page.records
        .filter((item) => item.patternName || item.patternCode)
        .map(toBoundVersionRow),
    };
  } catch {
    boundVersionMap.value = {
      ...boundVersionMap.value,
      [row.id]: [],
    };
  } finally {
    boundVersionLoadingMap.value = {
      ...boundVersionLoadingMap.value,
      [row.id]: false,
    };
  }
}

function boundVersionDisplay(row: PurchaseBomRow) {
  return (
    patternDisplay(boundVersionMap.value[row.id]) || row.boundVersion || "--"
  );
}

function patternDisplay(
  patterns?: Array<{
    patternCode?: string | null;
    patternName?: string | null;
  }> | null,
) {
  const names = Array.from(
    new Set(
      (patterns ?? [])
        .map((item) => item.patternName || item.patternCode || "")
        .filter(Boolean),
    ),
  );
  if (names.length === 0) {
    return "";
  }
  if (names.length <= 3) {
    return names.join("、");
  }
  return `${names.slice(0, 3).join("、")} 等${names.length}个`;
}

async function handleGenerateCostBom() {
  if (selectedRows.value.length === 0) {
    BaseToast.warning("请选择一条采购BOM清单数据。");
    return;
  }

  if (selectedRows.value.length > 1) {
    BaseToast.warning("生成成本BOM只能选择一条数据。");
    return;
  }

  await openGenerateCostBomDialog(selectedRows.value[0]);
}

async function openGenerateCostBomDialog(row: PurchaseBomRow) {
  generateTargetRow.value = row;
  generateForm.valveId =
    row.valveId && row.valveId > 0 ? row.valveId : undefined;
  generateValveOptions.value = [];
  generateDialogVisible.value = true;
  await nextTick();
  generateFormRef.value?.clearValidate();
  await loadGenerateValveOptions(row.projectId);
}

async function loadGenerateValveOptions(projectId: number) {
  generateValveLoading.value = true;
  try {
    const page = await fetchProjectValveOptions(projectId);
    generateValveOptions.value = page.records;
  } catch {
    generateValveOptions.value = [];
  } finally {
    generateValveLoading.value = false;
  }
}

async function confirmGenerateCostBom() {
  await generateFormRef.value?.validate();
  const row = generateTargetRow.value;
  if (!row || !generateForm.valveId) {
    return;
  }
  generateSubmitting.value = true;
  try {
    await generateCostBomForRow({
      ...row,
      valveId: generateForm.valveId,
    });
    generateDialogVisible.value = false;
  } finally {
    generateSubmitting.value = false;
  }
}

async function generateCostBomForRow(
  row: PurchaseBomRow & { valveId: number },
) {
  const task = await createPurchaseBomGenerateTask(
    row.projectId,
    row.purchaseBomId,
    {
      version: row.version,
      valveId: row.valveId,
      remark: `前端触发生成${row.projectName}成本BOM`,
    },
  );
  BaseToast.success(`生成任务已创建：${task.taskNo || task.taskId}`);
  refreshPurchaseBomList();
}

async function handleExportWorkbench() {
  if (selectedRows.value.length !== 1) {
    BaseToast.warning("请选择一条采购BOM清单数据。");
    return;
  }
  const row = selectedRows.value[0];
  const task = await createPurchaseBomWorkbenchExportTask(
    row.projectId,
    row.purchaseBomId,
  );
  activeTaskId.value = task.taskId;
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

function openReorganizePage(row: PurchaseBomRow) {
  const reorganizePathByListPath: Record<string, string> = {
    "/cost/bom/purchase-list": "/cost/bom/reorganize",
    "/manageBom/purchaseBom": "/manageBom/purchaseBom/reorganize",
    "/costmanagementnew/manageBom/purchaseBom":
      "/costmanagementnew/manageBom/purchaseBom/reorganize",
  };

  router.push({
    path:
      reorganizePathByListPath[route.path] ??
      "/cost/bom/reorganize",
    query: {
      projectId: String(row.projectId),
      purchaseBomId: String(row.purchaseBomId),
      projectName: row.projectName,
      returnPath: route.fullPath,
    },
  });
}

function resolveStatusType(status: PurchaseBomRow["bomStatus"]) {
  if (status === "已生成") {
    return "success";
  }

  if (status === "进行中") {
    return "warning";
  }

  if (status === "生成失败") {
    return "danger";
  }

  return "info";
}

function toFrontendStatus(status: string): PurchaseBomRow["bomStatus"] {
  const mapping: Record<string, PurchaseBomRow["bomStatus"]> = {
    "0": "未生成",
    "1": "进行中",
    "2": "已生成",
    NOT_GENERATED: "未生成",
    GENERATING: "进行中",
    GENERATED: "已生成",
    FAILED: "生成失败",
  };
  return mapping[status] || "未生成";
}
</script>

<template>
  <PageContainer title="采购BOM清单">
    <QueryTable
      ref="queryTableRef"
      class="purchase-bom-list-page"
      :func="queryPurchaseBomList"
      row-key="id"
      show-toolbar
      fit-table-height
      :table-props="{ onSelectionChange: handleSelectionChange }"
      empty-title="暂无采购BOM清单"
      empty-description="当前筛选条件下没有可展示的采购BOM清单。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="项目代号">
            <el-input
              v-model="query.projectName"
              clearable
              placeholder="请输入项目代号"
              @keyup.enter="searchPurchaseBomList"
            />
          </el-form-item>
          <el-form-item label="成本BOM状态">
            <el-select
              v-model="query.bomStatus"
              clearable
              placeholder="请选择成本BOM状态"
            >
              <el-option
                v-for="status in bomStatusOptions"
                :key="status.value"
                :label="status.label"
                :value="status.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdRange"
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
          permission="manage:purchase:generated"
          variant="primary"
          type="primary"
          plain
          :icon="Grid"
          @click="handleGenerateCostBom"
        >
          生成成本BOM
        </PermissionButton>
        <PermissionButton
          permission="manage:purchase:export"
          variant="secondary"
          plain
          type="warning"
          :icon="Download"
          @click="handleExportWorkbench"
        >
          导出
        </PermissionButton>
        <span
          v-if="selectedCountText"
          class="purchase-bom-list-page__selection"
        >
          {{ selectedCountText }}
        </span>
      </template>

      <el-table-column type="selection" width="48" fixed="left" />
      <el-table-column type="index" label="序号" width="70" align="center" />
      <el-table-column prop="projectName" label="项目代号" min-width="180" />
      <el-table-column
        prop="compiledCount"
        label="整编数量（条）"
        min-width="140"
        align="center"
      />
      <el-table-column prop="bomStatus" label="成本BOM状态" min-width="150">
        <template #default="{ row }">
          <BaseStatusTag
            :label="row.bomStatus"
            :type="resolveStatusType(row.bomStatus)"
          />
        </template>
      </el-table-column>
      <el-table-column label="更新人" min-width="130">
        <template #default>
          --
        </template>
      </el-table-column>
      <!--      <el-table-column prop="createdAt" label="创建时间" min-width="180">-->
      <!--        <template #default="{ row }">-->
      <!--          {{ row.createdAt || "&#45;&#45;" }}-->
      <!--        </template>-->
      <!--      </el-table-column>-->
      <el-table-column prop="updatedAt" label="更新时间" min-width="180">
        <template #default="{ row }">
          {{ row.updatedAt || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="boundVersion" label="已绑定版型" min-width="140">
        <template #default="{ row }">
          <el-popover
            placement="top"
            trigger="hover"
            width="auto"
            popper-class="purchase-bom-list-page__bound-popover"
          >
            <template #reference>
              <span
                class="purchase-bom-list-page__bound-version"
                @mouseenter="loadBoundVersions(row)"
              >
                {{ boundVersionDisplay(row) }}
              </span>
            </template>
            <div
              v-loading="boundVersionLoadingMap[row.id]"
              class="purchase-bom-list-page__bound-panel"
            >
              <table
                v-if="boundVersionMap[row.id]?.length"
                class="purchase-bom-list-page__bound-table"
              >
                <thead>
                  <tr>
                    <th>版型名称</th>
                    <th>整编编号</th>
                    <th>整编名称</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in boundVersionMap[row.id]"
                    :key="`${row.id}-${item.reorganizeCode}-${item.patternName}`"
                  >
                    <td>{{ item.patternName }}</td>
                    <td>{{ item.reorganizeCode }}</td>
                    <td>{{ item.reorganizeName }}</td>
                  </tr>
                </tbody>
              </table>
              <div
                v-else-if="!boundVersionLoadingMap[row.id]"
                class="purchase-bom-list-page__bound-empty"
              >
                暂无已绑定版型
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="110" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            link
            type="primary"
            permission="manage:purchaseView:show"
            @click="openReorganizePage(row)"
          >
            查看整编
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="generateDialogVisible"
      title="确认"
      width="560px"
      confirm-text="生成"
      :loading="generateSubmitting"
      :confirm-button-props="{
        permission: 'manage:purchase:generated',
      }"
      @confirm="confirmGenerateCostBom"
    >
      <el-form
        ref="generateFormRef"
        :model="generateForm"
        :rules="generateFormRules"
        label-position="top"
      >
        <el-form-item label="选择阀点" prop="valveId">
          <el-select
            v-model="generateForm.valveId"
            class="purchase-bom-list-page__generate-select"
            clearable
            filterable
            :loading="generateValveLoading"
            placeholder="请选择阀点"
          >
            <el-option
              v-for="item in generateValveOptions"
              :key="item.projectValveId"
              :label="item.valveName || item.valveCode"
              :value="item.valveId"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </BaseFormDialog>
    <TaskStatusPanel v-if="false" :task-id="activeTaskId" />
  </PageContainer>
</template>

<style scoped>
.purchase-bom-list-page :deep(.base-toolbar) {
  border-top: 0;
}

.purchase-bom-list-page :deep(.el-table__cell) {
  white-space: nowrap;
}

.purchase-bom-list-page__selection {
  color: var(--bq-color-text-muted);
  font-size: 14px;
  line-height: 24px;
}

.purchase-bom-list-page__bound-version {
  display: inline-block;
  max-width: 120px;
  color: var(--bq-color-primary);
  cursor: default;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.purchase-bom-list-page__bound-panel {
  min-height: 40px;
  min-width: 220px;
}

.purchase-bom-list-page__bound-table {
  width: 480px;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--bq-color-text);
  font-size: 14px;
}

.purchase-bom-list-page__bound-table th {
  background: var(--bq-color-primary-hover);
  color: var(--bq-color-on-primary);
  font-weight: 600;
}

.purchase-bom-list-page__bound-table th,
.purchase-bom-list-page__bound-table td {
  border: 1px solid var(--bq-color-border);
  padding: 8px 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-bom-list-page__bound-empty {
  color: var(--bq-color-text-muted);
  line-height: 40px;
  min-width: 180px;
  text-align: center;
}

.purchase-bom-list-page__generate-select {
  width: 100%;
}
</style>
