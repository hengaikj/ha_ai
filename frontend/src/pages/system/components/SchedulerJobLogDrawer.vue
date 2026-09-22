<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Download, RefreshRight } from "@element-plus/icons-vue";
import {
  cleanSchedulerJobLogs,
  deleteSchedulerJobLogs,
  exportSchedulerJobLogs,
  fetchSchedulerJobLog,
  fetchSchedulerJobLogs,
} from "@/api/scheduler";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import {
  useBaseConfirmDialog,
  type BaseConfirmOptions,
} from "@/composables/useBaseConfirmDialog";
import type {
  SchedulerJob,
  SchedulerJobLog,
  SchedulerLogStatus,
} from "@/types/scheduler";

const props = defineProps<{
  modelValue: boolean;
  job?: SchedulerJob | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

const query = reactive({
  jobName: "",
  jobGroup: "",
  status: "" as SchedulerLogStatus | "",
  executedAtRange: [] as [string, string] | [],
});
const queryTableRef = ref<QueryTableExpose | null>(null);
const selectedLogs = ref<SchedulerJobLog[]>([]);
const detailVisible = ref(false);
const currentDetail = ref<SchedulerJobLog | null>(null);
const exporting = ref(false);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const drawerTitle = computed(() =>
  props.job ? `执行日志 - ${props.job.jobName}` : "执行日志",
);

watch(
  () => [props.modelValue, props.job] as const,
  ([visible, job]) => {
    if (!visible) return;
    query.jobName = job?.jobName ?? "";
    query.jobGroup = job?.jobGroup ?? "";
    query.status = "";
    query.executedAtRange = [];
    selectedLogs.value = [];
    void queryTableRef.value?.reload();
  },
);

async function queryLogs(pageSize: number, pageNo: number) {
  const [beginTime, endTime] = query.executedAtRange;
  const response = await fetchSchedulerJobLogs({
    pageNum: pageNo,
    pageSize,
    jobName: query.jobName.trim() || undefined,
    jobGroup: query.jobGroup || undefined,
    status: query.status || undefined,
    beginTime: beginTime ? `${beginTime} 00:00:00` : undefined,
    endTime: endTime ? `${endTime} 23:59:59` : undefined,
  });
  return {
    total: response.total,
    list: response.records,
    pageNo: response.pageNo,
    pageSize: response.pageSize,
  };
}

function resetQuery() {
  query.jobName = props.job?.jobName ?? "";
  query.jobGroup = props.job?.jobGroup ?? "";
  query.status = "";
  query.executedAtRange = [];
}

async function showDetail(row: SchedulerJobLog) {
  currentDetail.value = await fetchSchedulerJobLog(row.jobLogId);
  detailVisible.value = true;
}

async function removeLogs(rows: SchedulerJobLog[]) {
  if (!rows.length) {
    BaseToast.warning("请先选择执行日志");
    return;
  }
  if (
    !(await requestConfirmation(
      rows.length === 1
        ? { scene: "delete", object: "执行日志", name: rows[0]?.jobLogId }
        : { scene: "batchDelete", object: "执行日志", count: rows.length },
    ))
  )
    return;
  await deleteSchedulerJobLogs(rows.map((row) => row.jobLogId));
  BaseToast.success("执行日志已删除");
  selectedLogs.value = [];
  await queryTableRef.value?.reload();
}

async function cleanLogs() {
  if (!(await requestConfirmation({ scene: "clear", object: "执行日志" })))
    return;
  await cleanSchedulerJobLogs();
  BaseToast.success("执行日志已清空");
  await queryTableRef.value?.reload();
}

async function requestConfirmation(options: BaseConfirmOptions) {
  try {
    await openConfirm(options);
    return true;
  } catch {
    return false;
  }
}

async function exportLogs() {
  exporting.value = true;
  try {
    const [beginTime, endTime] = query.executedAtRange;
    const download = await exportSchedulerJobLogs({
      jobName: query.jobName.trim() || undefined,
      jobGroup: query.jobGroup || undefined,
      status: query.status || undefined,
      beginTime: beginTime ? `${beginTime} 00:00:00` : undefined,
      endTime: endTime ? `${endTime} 23:59:59` : undefined,
    });
    downloadBlob(download.blob, download.fileName);
  } finally {
    exporting.value = false;
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

</script>

<template>
  <BaseDrawer
    class="scheduler-job-log-drawer"
    :model-value="modelValue"
    :title="drawerTitle"
    size="min(1100px, 100vw)"
    :show-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryLogs"
      row-key="jobLogId"
      fit-table-height
      fit-table-to-container
      :fixed-pagination="false"
      empty-title="暂无执行日志"
      empty-description="当前筛选条件下没有可展示的执行日志。"
      @reset="resetQuery"
      @selection-change="selectedLogs = $event"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="任务名称">
            <el-input
              v-model="query.jobName"
              clearable
              placeholder="请输入任务名称"
              @keyup.enter="queryTableRef?.search()"
            />
          </el-form-item>
          <el-form-item label="任务组">
            <el-input
              v-model="query.jobGroup"
              clearable
              placeholder="请输入任务组"
              @keyup.enter="queryTableRef?.search()"
            />
          </el-form-item>
          <el-form-item label="执行状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择执行状态"
            >
              <el-option label="成功" value="0" />
              <el-option label="失败" value="1" />
            </el-select>
          </el-form-item>
          <el-form-item label="执行时间">
            <el-date-picker
              v-model="query.executedAtRange"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #toolbar>
        <PermissionButton
          permission="monitor:job:remove"
          variant="danger"
          type="danger"
          plain
          @click="removeLogs(selectedLogs)"
        >
          批量删除
        </PermissionButton>
        <PermissionButton
          permission="monitor:job:remove"
          variant="secondary"
          type="danger"
          plain
          :icon="RefreshRight"
          @click="cleanLogs"
        >
          清空
        </PermissionButton>
        <PermissionButton
          permission="monitor:job:export"
          variant="secondary"
          type="warning"
          plain
          :icon="Download"
          :loading="exporting"
          @click="exportLogs"
        >
          导出
        </PermissionButton>
      </template>

      <el-table-column type="selection" width="52" />
      <el-table-column prop="jobLogId" label="日志编号" width="100" />
      <el-table-column prop="jobName" label="任务名称" min-width="150" />
      <el-table-column prop="jobGroup" label="任务组" width="130" />
      <el-table-column
        prop="invokeTarget"
        label="调用目标"
        min-width="230"
        show-overflow-tooltip
      />
      <el-table-column label="执行状态" width="100">
        <template #default="{ row }">
          <BaseStatusTag
            :label="row.status === '0' ? '成功' : '失败'"
            :type="row.status === '0' ? 'success' : 'danger'"
          />
        </template>
      </el-table-column>
      <el-table-column label="执行时间" width="175">
        <template #default="{ row }"
          ><BaseDateTime :value="row.createTime"
        /></template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="monitor:job:query"
            link
            @click="showDetail(row)"
          >
            详情
          </PermissionButton>
          <PermissionButton
            permission="monitor:job:remove"
            link
            @click="removeLogs([row])"
          >
            删除
          </PermissionButton>
        </template>
      </el-table-column>
<!--分页添加-->
    </QueryTable>

    <BaseFormDialog
      v-model="detailVisible"
      title="执行日志详情"
      width="820px"
      confirm-text=""
      cancel-text="关闭"
    >
      <el-descriptions
        v-if="currentDetail"
        :column="2"
        border
        label-width="110px"
      >
        <el-descriptions-item label="任务名称">{{
          currentDetail.jobName
        }}</el-descriptions-item>
        <el-descriptions-item label="任务组">{{
          currentDetail.jobGroup
        }}</el-descriptions-item>
        <el-descriptions-item label="调用目标" :span="2">{{
          currentDetail.invokeTarget
        }}</el-descriptions-item>
        <el-descriptions-item label="执行信息" :span="2">
          <pre class="scheduler-log-exception">{{
            currentDetail.jobMessage || "-"
          }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="异常信息" :span="2">
          <pre class="scheduler-log-exception">{{
            currentDetail.exceptionInfo || "-"
          }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </BaseFormDialog>

    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </BaseDrawer>
</template>

<style scoped>
:global(.base-drawer.scheduler-job-log-drawer .el-drawer__body) {
  overflow: hidden;
}

:global(.base-drawer.scheduler-job-log-drawer .base-drawer__body) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

:global(.scheduler-job-log-drawer .query-table) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

:global(.scheduler-job-log-drawer .query-table__table) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

:global(.scheduler-job-log-drawer .base-pagination) {
  flex: 0 0 auto;
  padding: 10px 0 0;
}

.scheduler-log-exception {
  max-height: 300px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: var(--bq-font-mono, monospace);
  font-size: 12px;
  line-height: 1.6;
}
</style>
