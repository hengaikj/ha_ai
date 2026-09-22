<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from "vue";
import { hasCostCalculationFailures } from "@/utils/task-center-labels";
import {
  cancelTaskCenterTask,
  getTaskCenterTask,
  rerunTaskCenterTask,
} from "@/api/task-center";
import { BaseToast } from "@/components/base/BaseToast";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskResultFileList from "@/components/task-center/TaskResultFileList.vue";
import { useTaskCenterStore } from "@/stores/task-center";
import type {
  TaskCenterStatus,
  TaskCenterTaskDetailResponse,
  TaskCenterTaskEvent,
} from "@/types/task-center";

const props = withDefaults(
  defineProps<{
    taskId?: string | number | null;
    pollInterval?: number;
    downloadFileName?: string;
  }>(),
  {
    taskId: null,
    pollInterval: 1500,
    downloadFileName: "",
  },
);

const emit = defineEmits<{
  update: [detail: TaskCenterTaskDetailResponse];
}>();

const detail = ref<TaskCenterTaskDetailResponse>();
const loading = ref(false);
const actionLoading = ref(false);
const errorExpanded = ref(false);
const taskCenterStore = useTaskCenterStore();
const terminalStatuses = new Set<TaskCenterStatus>([
  "SUCCEEDED",
  "FAILED",
  "TIMEOUT",
  "CANCELLED",
]);
const cancellableStatuses = new Set<TaskCenterStatus>([
  "CREATED",
  "WAITING",
  "RUNNING",
  "RETRY_WAITING",
]);
const rerunnableStatuses = new Set<TaskCenterStatus>(["FAILED", "TIMEOUT"]);
const statusView: Record<
  TaskCenterStatus,
  { label: string; type: "primary" | "success" | "warning" | "info" | "danger" }
> = {
  CREATED: { label: "已创建", type: "info" },
  WAITING: { label: "等待执行", type: "info" },
  RUNNING: { label: "执行中", type: "primary" },
  RETRY_WAITING: { label: "等待重试", type: "warning" },
  CANCEL_REQUESTED: { label: "取消中", type: "warning" },
  SUCCEEDED: { label: "已成功", type: "success" },
  FAILED: { label: "已失败", type: "danger" },
  TIMEOUT: { label: "已超时", type: "danger" },
  CANCELLED: { label: "已取消", type: "info" },
};
let timer: number | undefined;
let generation = 0;
let retryDelay = props.pollInterval;
let active = true;

const task = computed(() => detail.value?.task);
const currentStep = computed(() => {
  const steps = detail.value?.steps ?? [];
  return (
    steps.find((step) => step.status === "RUNNING") ??
    [...steps].sort((left, right) => right.stepOrder - left.stepOrder)[0]
  );
});
const status = computed(() => task.value?.status);
const calculationWarning = computed(() => hasCostCalculationFailures(task.value));
const errorMessage = computed(() => {
  const taskError = task.value?.errorMessage?.trim();
  if (taskError) return taskError;
  if (calculationWarning.value) {
    return (detail.value?.steps ?? [])
      .filter((step) => step.failedCount > 0 && step.errorSummary?.trim())
      .map((step) => `${step.stepName}\n${step.errorSummary}`)
      .join("\n\n") || "计算执行完成，存在失败记录，请查看操作日志。";
  }
  return (
    detail.value?.steps
      .find((step) => step.status === "FAILED")
      ?.errorSummary?.trim() ?? ""
  );
});
const errorNeedsExpansion = computed(() => errorMessage.value.length > 240);
const displayedErrorMessage = computed(() => {
  if (!errorNeedsExpansion.value || errorExpanded.value) {
    return errorMessage.value;
  }
  return `${errorMessage.value.slice(0, 240)}...`;
});
const canRerun = computed(
  () =>
    Boolean(status.value && rerunnableStatuses.has(status.value)) &&
    task.value?.taskType !== "COST_IMPORT",
);

function stopPolling() {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = undefined;
}

function disposePolling() {
  stopPolling();
  generation++;
}

function schedule(taskId: string, currentGeneration: number, delay: number) {
  timer = window.setTimeout(() => {
    timer = undefined;
    void refresh(taskId, currentGeneration);
  }, delay);
}

async function refresh(taskId: string, currentGeneration: number) {
  if (currentGeneration !== generation) return;
  loading.value = !detail.value;
  try {
    const result = await getTaskCenterTask(taskId);
    if (currentGeneration !== generation) return;
    detail.value = result;
    emit("update", result);
    retryDelay = props.pollInterval;
    if (!terminalStatuses.has(result.task.status)) {
      schedule(taskId, currentGeneration, props.pollInterval);
    }
  } catch {
    if (currentGeneration !== generation) return;
    schedule(taskId, currentGeneration, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10_000);
  } finally {
    if (currentGeneration === generation) loading.value = false;
  }
}

function startPolling(value: string | number) {
  disposePolling();
  detail.value = undefined;
  errorExpanded.value = false;
  if (!active) return;
  retryDelay = props.pollInterval;
  const currentGeneration = generation;
  void refresh(String(value), currentGeneration);
}

function resumePolling() {
  if (!props.taskId || (status.value && terminalStatuses.has(status.value))) {
    return;
  }
  disposePolling();
  retryDelay = props.pollInterval;
  const currentGeneration = generation;
  void refresh(String(props.taskId), currentGeneration);
}

async function copyErrorMessage() {
  if (!errorMessage.value) return;
  try {
    await navigator.clipboard.writeText(errorMessage.value);
    BaseToast.success("错误详情已复制");
  } catch {
    BaseToast.warning("复制失败，请手动选择错误详情");
  }
}

function applyTaskEvent(eventTask: TaskCenterTaskEvent) {
  if (!active) return;
  if (!props.taskId || String(props.taskId) !== eventTask.taskId) {
    return;
  }
  if (detail.value) {
    detail.value = {
      ...detail.value,
      task: eventTask,
    };
  }
  if (terminalStatuses.has(eventTask.status)) {
    stopPolling();
  }
  void refresh(eventTask.taskId, generation);
}

async function cancelTask() {
  if (!task.value) return;
  actionLoading.value = true;
  try {
    await cancelTaskCenterTask(task.value.taskId);
    BaseToast.success("已请求取消任务");
    startPolling(task.value.taskId);
  } finally {
    actionLoading.value = false;
  }
}

async function rerunTask() {
  if (!task.value) return;
  actionLoading.value = true;
  try {
    await rerunTaskCenterTask(task.value.taskId);
    BaseToast.success("任务已重新进入队列");
    startPolling(task.value.taskId);
  } finally {
    actionLoading.value = false;
  }
}

watch(
  () => props.taskId,
  (value) => {
    if (value === null || value === undefined || value === "") {
      disposePolling();
      detail.value = undefined;
      return;
    }
    startPolling(value);
  },
  { immediate: true },
);

watch(
  () => taskCenterStore.latestTask,
  (eventTask) => {
    if (eventTask) {
      applyTaskEvent(eventTask);
    }
  },
);

onActivated(() => {
  if (active) return;
  active = true;
  resumePolling();
});
onDeactivated(() => {
  active = false;
  disposePolling();
});
onBeforeUnmount(disposePolling);
</script>

<template>
  <section v-if="taskId" class="task-status-panel" aria-live="polite">
    <div v-if="task" class="task-status-header">
      <div class="task-identity">
        <span class="task-label">任务</span>
        <strong>{{ task.taskNo }}</strong>
        <el-tag :type="calculationWarning ? 'warning' : statusView[task.status].type" size="small">
          {{ calculationWarning ? '已完成，存在计算失败' : statusView[task.status].label }}
        </el-tag>
      </div>
      <div class="task-actions">
        <PermissionButton
          v-if="status && cancellableStatuses.has(status)"
          permission="system:task-center:cancel"
          link
          type="primary"
          :loading="actionLoading"
          @click="cancelTask"
        >
          取消
        </PermissionButton>
        <PermissionButton
          v-if="canRerun"
          permission="system:task-center:rerun"
          link
          type="primary"
          :loading="actionLoading"
          @click="rerunTask"
        >
          重跑
        </PermissionButton>
      </div>
    </div>

    <div v-if="task" class="task-progress-row">
      <el-progress :percentage="task.progress" :stroke-width="8" />
      <span v-if="currentStep" class="task-step">{{
        currentStep.stepName
      }}</span>
    </div>
    <div v-if="errorMessage" class="task-error">
      <el-alert
        :type="calculationWarning ? 'warning' : 'error'"
        :closable="false"
        show-icon
      >
        <template #title>
          <div v-for="(line, index) in displayedErrorMessage.split('\n')" :key="index"
            :class="{ 'calculation-error-line': calculationWarning && /^(零件号|零件名称|原因)：/.test(line) }">{{ line || '\u00a0' }}</div>
        </template>
      </el-alert>
      <div class="task-error__actions">
        <PermissionButton
          v-if="errorNeedsExpansion"
          data-test="task-error-expand"
          link
          @click="errorExpanded = !errorExpanded"
        >
          {{ errorExpanded ? "收起" : "全部展示" }}
        </PermissionButton>
        <PermissionButton
          data-test="task-error-copy"
          link
          @click="copyErrorMessage"
        >
          复制
        </PermissionButton>
      </div>
    </div>
    <TaskResultFileList
      v-if="task && detail?.files.length"
      :task-id="task.taskId"
      :files="detail.files"
      :download-file-name="downloadFileName"
      :status="task.status"
    />
    <div v-if="loading && !task" class="task-loading">正在读取任务状态...</div>
  </section>
</template>

<style scoped>
.task-status-panel {
  display: grid;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--bq-color-divider, #dedfdf);
}

.task-status-header,
.task-identity,
.task-actions,
.task-progress-row {
  display: flex;
  align-items: center;
}

.task-status-header {
  min-height: 32px;
  justify-content: space-between;
  gap: 16px;
}

.task-identity {
  min-width: 0;
  flex-wrap: wrap;
  gap: 8px;
}

.task-identity strong {
  overflow-wrap: anywhere;
}

.task-label,
.task-step,
.task-loading {
  color: var(--bq-color-text-muted, #8c8c8c);
  font-size: 13px;
}

.task-progress-row {
  gap: 14px;
}

.task-progress-row :deep(.el-progress) {
  width: min(420px, 70%);
}

.task-step {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-error {
  min-width: 0;
}

.calculation-error-line {
  color: var(--el-color-danger);
}

.task-error :deep(.el-alert__title) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.task-error__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

@media (max-width: 640px) {
  .task-status-header,
  .task-progress-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .task-progress-row :deep(.el-progress) {
    width: 100%;
  }
}
</style>
