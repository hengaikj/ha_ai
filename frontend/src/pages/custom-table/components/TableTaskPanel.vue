<script setup lang="ts">
import {
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from "vue";
import { Download, Upload } from "@element-plus/icons-vue";
import type { UploadFile } from "element-plus";
import {
  cancelCustTableExportTask,
  cancelCustTableImportTask,
  createCustTableExportTask,
  createCustTableImportTask,
  downloadCustTableExportTask,
  getCustTableExportTask,
  getCustTableExportTaskErrors,
  getCustTableImportTask,
  getCustTableImportTaskErrors,
} from "@/api/cust-table";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  CustTableTask,
  CustTableTaskErrorDetail,
  CustTableTaskStatus,
} from "@/types/cust-table";
import { createIdempotencyKey } from "@/utils/idempotency";

type TaskType = "IMPORT" | "EXPORT";

const props = withDefaults(
  defineProps<{
    workbookId: string;
    importTaskId?: string | null;
    exportTaskId?: string | null;
    canQuery?: boolean;
    canImport?: boolean;
    canExport?: boolean;
  }>(),
  {
    importTaskId: null,
    exportTaskId: null,
    canQuery: true,
    canImport: true,
    canExport: true,
  },
);

const emit = defineEmits<{
  taskChange: [task: CustTableTask];
  importSucceeded: [];
}>();

const importDialogOpen = ref(false);
const importCreating = ref(false);
const exportCreating = ref(false);
const downloading = ref(false);
const activeTab = ref<TaskType>("IMPORT");
const importTask = ref<CustTableTask>();
const exportTask = ref<CustTableTask>();
const importError = ref<CustTableTaskErrorDetail>();
const exportError = ref<CustTableTaskErrorDetail>();
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
const POLLING_INTERVAL_MS = 1000;
const MAX_POLLING_RETRY_MS = 8000;
const acceptedImportMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const terminalStatuses = new Set<CustTableTaskStatus>([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "TIMEOUT",
]);
const taskStatusView = {
  PENDING: { label: "待执行", type: "info" },
  RUNNING: { label: "执行中", type: "primary" },
  SUCCEEDED: { label: "已成功", type: "success" },
  FAILED: { label: "已失败", type: "danger" },
  CANCELLED: { label: "已取消", type: "info" },
  TIMEOUT: { label: "已超时", type: "danger" },
} as const satisfies Record<
  CustTableTaskStatus,
  { label: string; type: "primary" | "success" | "info" | "danger" }
>;

const timers: Partial<Record<TaskType, number>> =
  {};
const pollingGeneration: Record<TaskType, number> = { IMPORT: 0, EXPORT: 0 };
const activeTaskIds: Partial<Record<TaskType, string>> = {};
const pollingRetryDelay: Record<TaskType, number> = {
  IMPORT: POLLING_INTERVAL_MS,
  EXPORT: POLLING_INTERVAL_MS,
};
let active = true;

function taskRef(type: TaskType) {
  return type === "IMPORT" ? importTask : exportTask;
}

function errorRef(type: TaskType) {
  return type === "IMPORT" ? importError : exportError;
}

function disposePolling(type: TaskType) {
  const timer = timers[type];
  if (timer !== undefined) window.clearTimeout(timer);
  delete timers[type];
  delete activeTaskIds[type];
  pollingGeneration[type]++;
}

function scheduleRefresh(
  type: TaskType,
  taskId: string,
  generation: number,
  delay: number,
) {
  timers[type] = window.setTimeout(() => {
    delete timers[type];
    void refreshTask(type, taskId, generation);
  }, delay);
}

async function loadTaskError(type: TaskType, taskId: string) {
  try {
    errorRef(type).value =
      type === "IMPORT"
        ? await getCustTableImportTaskErrors(taskId)
        : await getCustTableExportTaskErrors(taskId);
  } catch {
    errorRef(type).value = undefined;
  }
}

async function refreshTask(type: TaskType, taskId: string, generation: number) {
  if (
    !active ||
    !props.canQuery ||
    generation !== pollingGeneration[type] ||
    taskId !== activeTaskIds[type]
  )
    return;
  try {
    const task =
      type === "IMPORT"
        ? await getCustTableImportTask(taskId)
        : await getCustTableExportTask(taskId);
    if (
      generation !== pollingGeneration[type] ||
      taskId !== activeTaskIds[type]
    )
      return;
    const previousStatus = taskRef(type).value?.status;
    taskRef(type).value = task;
    emit("taskChange", task);
    pollingRetryDelay[type] = POLLING_INTERVAL_MS;
    if (terminalStatuses.has(task.status)) {
      if (task.status === "FAILED" || task.status === "TIMEOUT") {
        await loadTaskError(type, taskId);
      }
      if (
        type === "IMPORT" &&
        task.status === "SUCCEEDED" &&
        previousStatus !== "SUCCEEDED"
      ) {
        emit("importSucceeded");
      }
      return;
    }
    scheduleRefresh(type, taskId, generation, POLLING_INTERVAL_MS);
  } catch {
    if (
      generation !== pollingGeneration[type] ||
      taskId !== activeTaskIds[type]
    )
      return;
    BaseToast.warning(
      `${type === "IMPORT" ? "导入" : "导出"}任务状态刷新失败，将自动重试`,
    );
    const retryDelay = pollingRetryDelay[type];
    pollingRetryDelay[type] = Math.min(retryDelay * 2, MAX_POLLING_RETRY_MS);
    scheduleRefresh(type, taskId, generation, retryDelay);
  }
}

function startPolling(type: TaskType, taskId: string, clearTask = false) {
  disposePolling(type);
  if (!active || !props.canQuery) return;
  if (clearTask) taskRef(type).value = undefined;
  errorRef(type).value = undefined;
  activeTaskIds[type] = taskId;
  pollingRetryDelay[type] = POLLING_INTERVAL_MS;
  void refreshTask(type, taskId, pollingGeneration[type]);
}

watch(
  () => props.importTaskId,
  (taskId) => {
    if (taskId) startPolling("IMPORT", taskId, true);
    else {
      disposePolling("IMPORT");
      importTask.value = undefined;
      importError.value = undefined;
    }
  },
  { immediate: true },
);

watch(
  () => props.exportTaskId,
  (taskId) => {
    if (taskId) startPolling("EXPORT", taskId, true);
    else {
      disposePolling("EXPORT");
      exportTask.value = undefined;
      exportError.value = undefined;
    }
  },
  { immediate: true },
);

watch(
  () => props.canQuery,
  (canQuery) => {
    if (!canQuery) {
      disposePolling("IMPORT");
      disposePolling("EXPORT");
      return;
    }
    if (importTask.value?.id) startPolling("IMPORT", importTask.value.id);
    if (exportTask.value?.id) startPolling("EXPORT", exportTask.value.id);
  },
);

function stopAllPolling() {
  disposePolling("IMPORT");
  disposePolling("EXPORT");
}

onActivated(() => {
  if (active) return;
  active = true;
  if (
    props.importTaskId &&
    (!importTask.value || !terminalStatuses.has(importTask.value.status))
  ) {
    startPolling("IMPORT", props.importTaskId);
  }
  if (
    props.exportTaskId &&
    (!exportTask.value || !terminalStatuses.has(exportTask.value.status))
  ) {
    startPolling("EXPORT", props.exportTaskId);
  }
});
onDeactivated(() => {
  active = false;
  importDialogOpen.value = false;
  stopAllPolling();
});
onBeforeUnmount(stopAllPolling);

function validateImportFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    return "仅支持 xlsx 格式的导入文件";
  if (file.size > MAX_IMPORT_FILE_SIZE) return "xlsx 文件大小不能超过 5MB";
  if (!acceptedImportMimeTypes.has(file.type.trim().toLowerCase())) {
    return "文件内容类型与 xlsx 格式不匹配";
  }
  return undefined;
}

async function createImport(uploadFile: UploadFile) {
  const file = uploadFile.raw;
  if (!file || !props.canImport) return;
  const validationMessage = validateImportFile(file);
  if (validationMessage) {
    BaseToast.warning(validationMessage);
    return;
  }
  importCreating.value = true;
  try {
    const task = await createCustTableImportTask(
      {
        requestId: createIdempotencyKey("import"),
        workbookId: props.workbookId,
      },
      file,
    );
    importDialogOpen.value = false;
    importTask.value = task;
    activeTab.value = "IMPORT";
    emit("taskChange", task);
    BaseToast.success("导入任务已创建");
    if (props.canQuery) startPolling("IMPORT", task.id);
    else BaseToast.warning("导入任务已创建，但当前账号无权查询任务状态");
  } finally {
    importCreating.value = false;
  }
}

async function createExport() {
  if (!props.canExport) return;
  exportCreating.value = true;
  try {
    const task = await createCustTableExportTask({
      requestId: createIdempotencyKey("export"),
      workbookId: props.workbookId,
    });
    exportTask.value = task;
    activeTab.value = "EXPORT";
    emit("taskChange", task);
    BaseToast.success("导出任务已创建");
    if (props.canQuery) startPolling("EXPORT", task.id);
    else BaseToast.warning("导出任务已创建，但当前账号无权查询任务状态");
  } finally {
    exportCreating.value = false;
  }
}

async function cancelTask(type: TaskType) {
  const task = taskRef(type).value;
  if (!task) return;
  const command = {
    requestId: createIdempotencyKey(`cancel-${type.toLowerCase()}`),
  };
  const updated =
    type === "IMPORT"
      ? await cancelCustTableImportTask(task.id, command)
      : await cancelCustTableExportTask(task.id, command);
  if (updated) taskRef(type).value = updated;
  BaseToast.success(`已请求取消${type === "IMPORT" ? "导入" : "导出"}任务`);
  startPolling(type, task.id);
}

async function downloadExport() {
  if (!exportTask.value) return;
  downloading.value = true;
  try {
    const response = await downloadCustTableExportTask(exportTask.value.id);
    const url = URL.createObjectURL(response.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = response.fileName;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
  <section class="task-panel">
    <div class="task-toolbar">
      <PermissionButton
        v-if="canImport"
        permission="base:cust-table:import:create"
        :icon="Upload"
        @click="importDialogOpen = true"
        type="success"
      >
        导入
      </PermissionButton>
      <PermissionButton
        v-if="canExport"
        permission="base:cust-table:export:create"
        :icon="Download"
        :loading="exportCreating"
        data-test="create-export"
        @click="createExport"
        type="warning"
      >
        导出
      </PermissionButton>
    </div>

    <el-tabs v-model="activeTab" class="task-tabs">
      <el-tab-pane label="导入任务" name="IMPORT">
        <el-empty
          v-if="!importTask"
          description="暂无导入任务"
          :image-size="56"
        />
        <el-descriptions v-else :column="3" size="small" border>
          <el-descriptions-item label="任务编号">{{
            importTask.id
          }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <BaseStatusTag
              :label="taskStatusView[importTask.status].label"
              :type="taskStatusView[importTask.status].type"
            />
          </el-descriptions-item>
          <el-descriptions-item label="进度"
            >{{ importTask.progress }}%</el-descriptions-item
          >
          <el-descriptions-item label="更新时间">{{
            importTask.updateTime
          }}</el-descriptions-item>
          <el-descriptions-item
            v-if="importError?.errorMessage || importTask.errorMessage"
            label="失败原因"
            :span="2"
          >
            {{ importError?.errorMessage || importTask.errorMessage }}
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="importTask" class="task-row-actions">
          <PermissionButton
            v-if="['PENDING', 'RUNNING'].includes(importTask.status)"
            permission="base:cust-table:import:cancel"
            link
            data-test="cancel-import"
            @click="cancelTask('IMPORT')"
          >
            取消导入
          </PermissionButton>
        </div>
      </el-tab-pane>

      <el-tab-pane label="导出任务" name="EXPORT">
        <el-empty
          v-if="!exportTask"
          description="暂无导出任务"
          :image-size="56"
        />
        <el-descriptions v-else :column="3" size="small" border>
          <el-descriptions-item label="任务编号">{{
            exportTask.id
          }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <BaseStatusTag
              :label="taskStatusView[exportTask.status].label"
              :type="taskStatusView[exportTask.status].type"
            />
          </el-descriptions-item>
          <el-descriptions-item label="进度"
            >{{ exportTask.progress }}%</el-descriptions-item
          >
          <el-descriptions-item label="结果文件">
            {{ exportTask.resultFileName || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">{{
            exportTask.updateTime
          }}</el-descriptions-item>
          <el-descriptions-item
            v-if="exportError?.errorMessage || exportTask.errorMessage"
            label="失败原因"
          >
            {{ exportError?.errorMessage || exportTask.errorMessage }}
          </el-descriptions-item>
        </el-descriptions>
        <div v-if="exportTask" class="task-row-actions">
          <PermissionButton
            v-if="['PENDING', 'RUNNING'].includes(exportTask.status)"
            permission="base:cust-table:export:cancel"
            link
            data-test="cancel-export"
            @click="cancelTask('EXPORT')"
          >
            取消导出
          </PermissionButton>
          <PermissionButton
            v-if="exportTask.status === 'SUCCEEDED'"
            permission="base:cust-table:export:download"
            link
            :loading="downloading"
            data-test="download-export"
            @click="downloadExport"
          >
            下载结果
          </PermissionButton>
        </div>
      </el-tab-pane>
    </el-tabs>

    <BaseImportDialog
      v-model="importDialogOpen"
      module-name="自定义表格"
      title="导入工作簿"
      :loading="importCreating"
      :max-size-mb="5"
      template-text=""
      upload-tip="仅支持 xlsx 文件，大小不超过 5MB"
      confirm-text="开始导入"
      @import="createImport"
    />
  </section>
</template>

<style scoped>
.task-panel {
  display: grid;
  gap: 8px;
  padding: 12px 16px 4px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.task-toolbar,
.task-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-tabs :deep(.el-tabs__header) {
  margin: 0 0 10px;
}

.task-row-actions {
  min-height: 32px;
  justify-content: flex-end;
}
</style>
