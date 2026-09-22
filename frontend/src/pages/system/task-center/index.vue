<script setup lang="ts">
import {reactive, ref, watch} from "vue";
import {ElMessageBox} from "element-plus";
import {deleteTaskCenterTasks, listTaskCenterTasks} from "@/api/task-center";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import {BaseToast} from "@/components/base/BaseToast";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskDownloadAction from "@/components/task-center/TaskDownloadAction.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import {useTaskCenterStore} from "@/stores/task-center";
import {resolveTaskBusinessLabel, hasCostCalculationFailures} from "@/utils/task-center-labels";
import type {
  TaskCenterStatus,
  TaskCenterTaskResponse,
} from "@/types/task-center";

type QueryTableExpose = {
  search: () => void;
  reload?: () => Promise<void>;
};

const moduleOptions = [
  {label: "平台", value: "PLATFORM"},
  {label: "基础中心", value: "BASE"},
  {label: "预算中心", value: "BUDGET"},
  {label: "成本中心", value: "COST"},
  {label: "产品委员会", value: "COMMITTEE"},
];
const taskTypeOptions = [
  {label: "表格导入", value: "TABLE_IMPORT"},
  {label: "表格导出", value: "TABLE_EXPORT"},
  {label: "预算导入", value: "BUDGET_IMPORT"},
  {label: "预算导出", value: "BUDGET_EXPORT"},
  {label: "成本导入", value: "COST_IMPORT"},
  {label: "成本导出", value: "COST_EXPORT"},
  {label: "成本计算", value: "COST_CALCULATE"},
  {label: "委员会导出", value: "COMMITTEE_EXPORT"},
  {label: "委员会报告", value: "COMMITTEE_REPORT"},
  {label: "附件打包", value: "ATTACHMENT_PACKAGE"},
  {label: "报告生成", value: "REPORT_GENERATE"},
  {label: "文件打包", value: "FILE_PACKAGE"},
  {label: "批量计算", value: "BATCH_CALCULATE"},
];
const statusOptions: Array<{
  label: string;
  value: TaskCenterStatus;
  type: "primary" | "success" | "warning" | "info" | "danger";
}> = [
  {label: "已创建", value: "CREATED", type: "info"},
  {label: "等待执行", value: "WAITING", type: "info"},
  {label: "执行中", value: "RUNNING", type: "primary"},
  {label: "等待重试", value: "RETRY_WAITING", type: "warning"},
  {label: "取消中", value: "CANCEL_REQUESTED", type: "warning"},
  {label: "已成功", value: "SUCCEEDED", type: "success"},
  {label: "已失败", value: "FAILED", type: "danger"},
  {label: "已超时", value: "TIMEOUT", type: "danger"},
  {label: "已取消", value: "CANCELLED", type: "info"},
];
const statusView = Object.fromEntries(
    statusOptions.map((item) => [item.value, item]),
) as Record<TaskCenterStatus, (typeof statusOptions)[number]>;
const moduleView = Object.fromEntries(
    moduleOptions.map((item) => [item.value, item.label]),
);
const taskTypeView = Object.fromEntries(
    taskTypeOptions.map((item) => [item.value, item.label]),
);
const terminalStatuses = new Set<TaskCenterStatus>([
  "SUCCEEDED",
  "FAILED",
  "TIMEOUT",
  "CANCELLED",
]);

const queryTableRef = ref<QueryTableExpose | null>(null);
const selectedTaskId = ref<string>();
const detailVisible = ref(false);
const selectedTasks = ref<TaskCenterTaskResponse[]>([]);
const taskCenterStore = useTaskCenterStore();
const query = reactive({
  businessModule: "",
  taskType: "",
  status: "",
  keyword: "",
});

async function queryTasks(pageSize: number, pageNo: number) {
  const page = await listTaskCenterTasks({
    taskType: query.taskType || undefined,
    businessModule: query.businessModule || undefined,
    status: query.status || undefined,
    keyword: query.keyword.trim() || undefined,
    pageNo,
    pageSize,
  });
  void taskCenterStore.preloadDownloadableFiles(page.records);
  return {
    list: page.records,
    total: page.total,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function searchTasks() {
  queryTableRef.value?.search();
}

function resetQuery() {
  query.businessModule = "";
  query.taskType = "";
  query.status = "";
  query.keyword = "";
}

function getStatusView(status: TaskCenterStatus) {
  return statusView[status];
}

function showDetail(row: TaskCenterTaskResponse) {
  selectedTaskId.value = row.taskId;
  detailVisible.value = true;
}

function handleSelectionChange(selection: TaskCenterTaskResponse[]) {
  selectedTasks.value = selection;
}

async function deleteSelectedTasks() {
  if (!selectedTasks.value.length) {
    BaseToast.warning("请先选择要删除的任务");
    return;
  }
  const nonTerminalTasks = selectedTasks.value.filter(
      (task) => !terminalStatuses.has(task.status),
  );
  if (nonTerminalTasks.length) {
    BaseToast.warning("只能删除已成功、已失败、已超时或已取消的任务");
    return;
  }
  try {
    await ElMessageBox.confirm(
        `确认删除选中的 ${selectedTasks.value.length} 个已结束任务？删除后任务中心不再展示这些记录。`,
        "删除任务",
        {
          type: "warning",
          confirmButtonText: "删除",
          cancelButtonText: "取消",
        },
    );
    await deleteTaskCenterTasks(selectedTasks.value.map((task) => task.taskId));
    if (
        selectedTaskId.value &&
        selectedTasks.value.some((task) => task.taskId === selectedTaskId.value)
    ) {
      detailVisible.value = false;
      selectedTaskId.value = undefined;
    }
    selectedTasks.value = [];
    BaseToast.success("任务已删除");
    await queryTableRef.value?.reload?.();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    throw unknownError;
  }
}

let refreshTimer: number | undefined;
watch(
    () => taskCenterStore.latestTask,
    () => {
      if (refreshTimer !== undefined) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        queryTableRef.value?.reload?.();
      }, 800);
    },
);
</script>

<template>
  <PageContainer class="bq-management-page" title="任务中心">
    <QueryTable
        ref="queryTableRef"
        :func="queryTasks"
        row-key="taskId"
        fit-table-height
        empty-title="暂无匹配任务"
        empty-description="当前筛选条件下没有可展示的任务。"
        :table-props="{ onRowClick: showDetail, scrollbarAlwaysOn: true }"
        @reset="resetQuery"
        @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="关键字">
            <el-input
                v-model="query.keyword"
                clearable
                maxlength="128"
                placeholder="任务号、批次号或业务标识"
                @keyup.enter="searchTasks"
            />
          </el-form-item>
          <el-form-item label="业务模块">
            <el-select
                v-model="query.businessModule"
                clearable
                placeholder="请选择业务模块"
            >
              <el-option
                  v-for="item in moduleOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="任务类型">
            <el-select
                v-model="query.taskType"
                clearable
                filterable
                placeholder="请选择任务类型"
            >
              <el-option
                  v-for="item in taskTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="任务状态">
            <el-select
                v-model="query.status"
                clearable
                placeholder="请选择任务状态"
            >
              <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <template #toolbar>
        <PermissionButton
            permission="task:center:remove"
            variant="danger"
            type="danger"
            plain
            @click="deleteSelectedTasks"
        >
          删除
        </PermissionButton>
      </template>

      <el-table-column type="selection"  />
      <el-table-column prop="taskNo" label="任务号"  />
      <el-table-column prop="businessModule" label="业务模块" >
        <template #default="{ row }">
          {{ moduleView[row.businessModule] ?? row.businessModule }}
        </template>
      </el-table-column>
      <el-table-column prop="taskType" label="任务类型" >
        <template #default="{ row }">
          {{ taskTypeView[row.taskType] ?? row.taskType }}
        </template>
      </el-table-column>
      <el-table-column label="业务场景" >
        <template #default="{ row }">
          {{ resolveTaskBusinessLabel(row, taskTypeView) }}
        </template>
      </el-table-column>
      <el-table-column prop="batchNo" label="批次号"  />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="hasCostCalculationFailures(row) ? 'warning' : getStatusView(row.status).type" size="small">
            {{ hasCostCalculationFailures(row) ? '已完成，存在计算失败' : getStatusView(row.status).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
          prop="errorMessage"
          label="失败原因"

          show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row.errorMessage || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="progress" label="进度" m>
        <template #default="{ row }">{{ row.progress }}%</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" >
        <template #default="{ row }">
          <BaseDateTime :value="row.createdAt" />
        </template>
      </el-table-column>
      <el-table-column
          label="操作"
          fixed="right"
          align="center"
         width="160"
      >
        <template #default="{ row }">
          <div class="task-center-actions">
            <TaskDownloadAction
                :task-id="row.taskId"
                :status="row.status"
                :files="taskCenterStore.filesFor(row.taskId)"
            />
            <PermissionButton  link @click.stop="showDetail(row)">
              详情
            </PermissionButton>
          </div>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseDrawer
        v-model="detailVisible"
        title="任务详情"
        size="min(720px, 100vw)"
        :show-footer="false"
    >
      <TaskStatusPanel  :task-id="selectedTaskId" />
    </BaseDrawer>
  </PageContainer>
</template>

<style scoped>
.task-center-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
