<script setup lang="ts">
import { reactive, ref } from "vue";
import { CirclePlus, Download } from "@element-plus/icons-vue";
import {
  changeSchedulerJobStatus,
  createSchedulerJob,
  deleteSchedulerJobs,
  exportSchedulerJobs,
  fetchSchedulerJob,
  fetchSchedulerJobs,
  runSchedulerJob,
  updateSchedulerJob,
} from "@/api/scheduler";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import {
  useBaseConfirmDialog,
  type BaseConfirmOptions,
} from "@/composables/useBaseConfirmDialog";
import SchedulerJobFormDialog from "@/pages/system/components/SchedulerJobFormDialog.vue";
import SchedulerJobLogDrawer from "@/pages/system/components/SchedulerJobLogDrawer.vue";
import type {
  SchedulerJob,
  SchedulerJobPayload,
  SchedulerJobStatus,
} from "@/types/scheduler";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

const query = reactive({
  jobName: "",
  jobGroup: "",
  invokeTarget: "",
  status: "" as SchedulerJobStatus | "",
});
const queryTableRef = ref<QueryTableExpose | null>(null);
const selectedJobs = ref<SchedulerJob[]>([]);
const formVisible = ref(false);
const saving = ref(false);
const editingJob = ref<SchedulerJob | null>(null);
const logDrawerVisible = ref(false);
const logJob = ref<SchedulerJob | null>(null);
const exporting = ref(false);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

async function queryJobs(pageSize: number, pageNo: number) {
  const response = await fetchSchedulerJobs({
    pageNum: pageNo,
    pageSize,
    jobName: query.jobName.trim() || undefined,
    jobGroup: query.jobGroup || undefined,
    invokeTarget: query.invokeTarget.trim() || undefined,
    status: query.status || undefined,
  });
  return {
    total: response.total,
    list: response.records,
    pageNo: response.pageNo,
    pageSize: response.pageSize,
  };
}

function resetQuery() {
  query.jobName = "";
  query.jobGroup = "";
  query.invokeTarget = "";
  query.status = "";
}

function openCreateDialog() {
  editingJob.value = null;
  formVisible.value = true;
}

async function openEditDialog(row: SchedulerJob) {
  editingJob.value = await fetchSchedulerJob(row.jobId);
  formVisible.value = true;
}

async function saveJob(payload: SchedulerJobPayload) {
  saving.value = true;
  try {
    if (editingJob.value) {
      await updateSchedulerJob({ ...payload, jobId: editingJob.value.jobId });
      BaseToast.success("定时任务已更新");
    } else {
      await createSchedulerJob(payload);
      BaseToast.success("定时任务已新增");
    }
    formVisible.value = false;
    await queryTableRef.value?.reload();
  } finally {
    saving.value = false;
  }
}

async function changeStatus(row: SchedulerJob, nextStatus: SchedulerJobStatus) {
  if (row.status === nextStatus) return;
  if (
    !(await requestConfirmation({
      scene: nextStatus === "0" ? "enable" : "disable",
      object: "定时任务",
      name: row.jobName,
    }))
  )
    return;
  await changeSchedulerJobStatus(row.jobId, row.jobGroup, nextStatus);
  BaseToast.success(nextStatus === "0" ? "定时任务已启用" : "定时任务已停用");
  await queryTableRef.value?.reload();
}

async function runJob(row: SchedulerJob) {
  if (
    !(await requestConfirmation({
      title: "立即执行确认",
      message: `确认立即执行定时任务“${row.jobName}”吗？`,
      type: "warning",
      confirmText: "立即执行",
    }))
  )
    return;
  await runSchedulerJob(row.jobId, row.jobGroup);
  BaseToast.success("定时任务已触发");
}

async function removeJobs(rows: SchedulerJob[]) {
  if (!rows.length) {
    BaseToast.warning("请先选择定时任务");
    return;
  }
  if (
    !(await requestConfirmation(
      rows.length === 1
        ? { scene: "delete", object: "定时任务", name: rows[0]?.jobName }
        : { scene: "batchDelete", object: "定时任务", count: rows.length },
    ))
  )
    return;
  await deleteSchedulerJobs(rows.map((row) => row.jobId));
  BaseToast.success("定时任务已删除");
  selectedJobs.value = [];
  await queryTableRef.value?.reload();
}

async function exportJobs() {
  exporting.value = true;
  try {
    const download = await exportSchedulerJobs({
      jobName: query.jobName.trim() || undefined,
      jobGroup: query.jobGroup || undefined,
      invokeTarget: query.invokeTarget.trim() || undefined,
      status: query.status || undefined,
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

function openLogs(row?: SchedulerJob) {
  logJob.value = row ?? null;
  logDrawerVisible.value = true;
}

async function requestConfirmation(options: BaseConfirmOptions) {
  try {
    await openConfirm(options);
    return true;
  } catch {
    return false;
  }
}

function misfireLabel(policy: string) {
  return (
    { "0": "默认", "1": "立即执行", "2": "执行一次", "3": "放弃执行" }[
      policy
    ] ?? policy
  );
}
</script>

<template>
  <PageContainer title="定时任务管理">
    <QueryTable
      ref="queryTableRef"
      :func="queryJobs"
      row-key="jobId"
      fit-table-height
      empty-title="暂无定时任务"
      empty-description="当前筛选条件下没有可展示的定时任务。"
      @reset="resetQuery"
      @selection-change="selectedJobs = $event"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="任务名称">
            <el-input
              v-model="query.jobName"
              clearable
              maxlength="64"
              placeholder="请输入任务名称"
              @keyup.enter="queryTableRef?.search()"
            />
          </el-form-item>
          <el-form-item label="任务组">
            <el-select
              v-model="query.jobGroup"
              clearable
              filterable
              placeholder="请选择任务组"
            >
              <el-option label="系统任务" value="SYSTEM" />
              <el-option label="产品委员会" value="COMMITTEE" />
              <el-option label="通知中心" value="NOTIFICATION" />
              <el-option label="任务中心" value="TASK_CENTER" />
              <el-option label="自定义表格" value="TABLE_PLATFORM" />
              <el-option label="基础中心" value="BASE" />
              <el-option label="预算中心" value="BUDGET" />
              <el-option label="成本中心" value="COST" />
              <el-option label="数据同步" value="DATA_SYNC" />
              <el-option label="数据治理" value="DATA_GOVERNANCE" />
            </el-select>
          </el-form-item>
          <el-form-item label="调用目标">
            <el-input
              v-model="query.invokeTarget"
              clearable
              maxlength="500"
              placeholder="请输入调用目标"
              @keyup.enter="queryTableRef?.search()"
            />
          </el-form-item>
          <el-form-item label="任务状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择任务状态"
            >
              <el-option label="启用" value="0" />
              <el-option label="停用" value="1" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          permission="monitor:job:add"
          variant="primary"
          type="primary"
          :icon="CirclePlus"
          @click="openCreateDialog"
        >
          新增
        </PermissionButton>
        <PermissionButton
          permission="monitor:job:export"
          variant="secondary"
          type="warning"
          plain
          :icon="Download"
          :loading="exporting"
          @click="exportJobs"
        >
          导出
        </PermissionButton>
        <PermissionButton
          permission="monitor:job:list"
          variant="secondary"
          plain
          @click="openLogs()"
        >
          执行日志
        </PermissionButton>
        <PermissionButton
            permission="monitor:job:remove"
            variant="danger"
            type="danger"
            plain
            @click="removeJobs(selectedJobs)"
        >
          批量删除
        </PermissionButton>
      </template>

      <el-table-column type="selection" width="52" />
      <el-table-column prop="jobName" label="任务名称" min-width="160" />
      <el-table-column prop="jobGroup" label="任务组" width="135" />
      <el-table-column
        prop="invokeTarget"
        label="调用目标"
        min-width="260"
        show-overflow-tooltip
      />
      <el-table-column
        prop="cronExpression"
        label="Cron表达式"
        min-width="155"
      />
      <el-table-column label="执行策略" width="105">
        <template #default="{ row }">{{
          misfireLabel(row.misfirePolicy)
        }}</template>
      </el-table-column>
      <el-table-column label="并发策略" width="105">
        <template #default="{ row }">{{
          row.concurrent === "1" ? "禁止并发" : "允许并发"
        }}</template>
      </el-table-column>
      <el-table-column label="任务状态" width="105">
        <template #default="{ row }">
          <BaseStatusTag
            :status="row.status === '0' ? 'ENABLED' : 'DISABLED'"
            :label="row.status === '0' ? '启用' : '停用'"
          />
        </template>
      </el-table-column>
      <el-table-column label="下次执行时间" width="175">
        <template #default="{ row }"
          ><BaseDateTime :value="row.nextValidTime"
        /></template>
      </el-table-column>
      <el-table-column label="创建时间" width="175">
        <template #default="{ row }"
          ><BaseDateTime :value="row.createTime"
        /></template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right" align="center">
        <template #default="{ row }">
<!--          <div class="scheduler-row-actions">-->
            <PermissionButton
              permission="monitor:job:edit"
              link
              @click="openEditDialog(row)"
            >
              编辑
            </PermissionButton>
            <PermissionButton
              permission="monitor:job:changeStatus"
              link
              @click="changeStatus(row, row.status === '0' ? '1' : '0')"
            >
              {{ row.status === "0" ? "停用" : "启用" }}
            </PermissionButton>
            <PermissionButton
              permission="monitor:job:changeStatus"
              link
              @click="runJob(row)"
            >
              立即执行
            </PermissionButton>
            <PermissionButton
              permission="monitor:job:query"
              link
              @click="openLogs(row)"
            >
              执行日志
            </PermissionButton>
            <PermissionButton
              permission="monitor:job:remove"
              link
              type="danger"
              @click="removeJobs([row])"
            >
              删除
            </PermissionButton>
<!--          </div>-->
        </template>
      </el-table-column>
    </QueryTable>

    <SchedulerJobFormDialog
      v-model="formVisible"
      :job="editingJob"
      :saving="saving"
      @save="saveJob"
    />
    <SchedulerJobLogDrawer v-model="logDrawerVisible" :job="logJob" />
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
  </PageContainer>
</template>

<style scoped>
.scheduler-row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
}

.scheduler-row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
