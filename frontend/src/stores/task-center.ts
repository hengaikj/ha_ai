import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  createTaskCenterEventSource,
  getTaskCenterTask,
  listTaskCenterTasks,
} from "@/api/task-center";
import type {
  TaskCenterFileResponse,
  TaskCenterStatus,
  TaskCenterTaskEvent,
  TaskCenterTaskResponse,
} from "@/types/task-center";

const STORAGE_LAST_EVENT_ID = "bq_task_center_last_event_id";
const MAX_LATEST_TASKS = 8;
const POLLING_INTERVAL_MS = 10_000;
const TERMINAL_STATUSES = new Set<TaskCenterStatus>([
  "SUCCEEDED",
  "FAILED",
  "TIMEOUT",
  "CANCELLED",
]);

export const useTaskCenterStore = defineStore("taskCenter", () => {
  const latestTasks = ref<TaskCenterTaskEvent[]>([]);
  const unreadCount = ref(0);
  const connected = ref(false);
  const lastEventId = ref(localStorage.getItem(STORAGE_LAST_EVENT_ID));
  const downloadableFilesByTask = ref<Record<string, TaskCenterFileResponse[]>>(
    {},
  );
  let eventSource: EventSource | null = null;
  let reconnectTimer: number | undefined;
  let pollingTimer: number | undefined;
  let pollingActive = false;
  let recentTasksRefresh: Promise<void> | null = null;
  let reconnectDelay = 1000;
  const pendingFileLoads = new Map<string, Promise<void>>();

  const latestTask = computed(() => latestTasks.value[0] ?? null);

  function refreshRecentTasks() {
    if (recentTasksRefresh) {
      return recentTasksRefresh;
    }
    const request = listTaskCenterTasks({ pageNo: 1, pageSize: 5 })
      .then((page) => {
        latestTasks.value = page.records.slice(0, MAX_LATEST_TASKS);
        void preloadDownloadableFiles(latestTasks.value);
      })
      .catch(() => {
        // 最近任务只是通知入口数据，失败不影响后续SSE重连或轮询。
      })
      .finally(() => {
        recentTasksRefresh = null;
      });
    recentTasksRefresh = request;
    return request;
  }

  function loadRecentTasks() {
    if (latestTasks.value.length) {
      return Promise.resolve();
    }
    return refreshRecentTasks();
  }

  function upsertTask(task: TaskCenterTaskEvent) {
    delete downloadableFilesByTask.value[task.taskId];
    const existingIndex = latestTasks.value.findIndex(
      (item) => item.taskId === task.taskId,
    );
    if (existingIndex >= 0) {
      latestTasks.value.splice(existingIndex, 1);
    }
    latestTasks.value.unshift(task);
    latestTasks.value = latestTasks.value.slice(0, MAX_LATEST_TASKS);
    unreadCount.value += 1;
    if (TERMINAL_STATUSES.has(task.status)) {
      void loadTaskFiles(task.taskId);
    }
  }

  function filesFor(taskId: string | number) {
    return downloadableFilesByTask.value[String(taskId)] ?? [];
  }

  function loadTaskFiles(taskId: string | number, force = false) {
    const key = String(taskId);
    if (!force && Object.hasOwn(downloadableFilesByTask.value, key)) {
      return Promise.resolve();
    }
    const pending = pendingFileLoads.get(key);
    if (pending) {
      return pending;
    }
    const request = getTaskCenterTask(key)
      .then((detail) => {
        downloadableFilesByTask.value[key] = detail.files.filter(
          (file) => file.fileType !== "INPUT",
        );
      })
      .catch(() => {
        downloadableFilesByTask.value[key] = [];
      })
      .finally(() => {
        pendingFileLoads.delete(key);
      });
    pendingFileLoads.set(key, request);
    return request;
  }

  function preloadDownloadableFiles(tasks: TaskCenterTaskResponse[]) {
    return Promise.all(
      tasks
        .filter((task) => TERMINAL_STATUSES.has(task.status))
        .map((task) => loadTaskFiles(task.taskId)),
    );
  }

  function clearReconnectTimer() {
    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  }

  function clearPollingTimer() {
    if (pollingTimer !== undefined) {
      window.clearTimeout(pollingTimer);
      pollingTimer = undefined;
    }
  }

  async function pollRecentTasks() {
    if (!pollingActive) {
      return;
    }
    await refreshRecentTasks();
    if (!pollingActive) {
      return;
    }
    pollingTimer = window.setTimeout(() => {
      pollingTimer = undefined;
      void pollRecentTasks();
    }, POLLING_INTERVAL_MS);
  }

  function startPolling() {
    if (pollingActive) {
      return;
    }
    pollingActive = true;
    clearPollingTimer();
    void pollRecentTasks();
  }

  function stopPolling() {
    pollingActive = false;
    clearPollingTimer();
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    connected.value = false;
    reconnectTimer = window.setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 15000);
      connect();
    }, reconnectDelay);
  }

  function connect() {
    if (eventSource) {
      return;
    }
    if (!window.EventSource) {
      startPolling();
      return;
    }
    if (!pollingActive) {
      void loadRecentTasks();
    }
    clearReconnectTimer();
    try {
      eventSource = createTaskCenterEventSource(lastEventId.value);
    } catch {
      startPolling();
      scheduleReconnect();
      return;
    }
    if (!eventSource) {
      startPolling();
      return;
    }
    eventSource.addEventListener("open", () => {
      connected.value = true;
      reconnectDelay = 1000;
      stopPolling();
    });
    eventSource.addEventListener("task", (event) => {
      const messageEvent = event as MessageEvent<string>;
      try {
        const task = JSON.parse(messageEvent.data) as TaskCenterTaskEvent;
        if (messageEvent.lastEventId) {
          lastEventId.value = messageEvent.lastEventId;
          localStorage.setItem(STORAGE_LAST_EVENT_ID, messageEvent.lastEventId);
        }
        upsertTask(task);
      } catch {
        // 忽略无法解析的单条事件，保持连接继续接收后续任务。
      }
    });
    eventSource.addEventListener("error", () => {
      disconnect(false);
      startPolling();
      scheduleReconnect();
    });
  }

  function disconnect(clearTimer = true) {
    if (clearTimer) {
      clearReconnectTimer();
    }
    eventSource?.close();
    eventSource = null;
    connected.value = false;
    stopPolling();
  }

  function markRead() {
    unreadCount.value = 0;
  }

  return {
    latestTasks,
    latestTask,
    unreadCount,
    connected,
    filesFor,
    loadTaskFiles,
    preloadDownloadableFiles,
    connect,
    disconnect,
    markRead,
  };
});
