import {
  httpClient,
  parseBlobDownloadResponse,
  request,
  type BlobDownloadResponse,
} from "@/api/http";
import type {
  TaskCenterTaskDetailResponse,
  TaskCenterTaskPageQuery,
  TaskCenterTaskPageResponse,
} from "@/types/task-center";
import { getAccessToken } from "@/utils/token";

const TASK_CENTER_BASE = "/base/task-center/tasks";

export function listTaskCenterTasks(params: TaskCenterTaskPageQuery) {
  return request<TaskCenterTaskPageResponse>({
    url: TASK_CENTER_BASE,
    method: "get",
    params,
  });
}

export function getTaskCenterTask(taskId: string | number) {
  return request<TaskCenterTaskDetailResponse>({
    url: `${TASK_CENTER_BASE}/${taskId}`,
    method: "get",
  });
}

export function cancelTaskCenterTask(taskId: string | number) {
  return request<void>({
    url: `${TASK_CENTER_BASE}/${taskId}/cancel`,
    method: "post",
  });
}

export function rerunTaskCenterTask(taskId: string | number) {
  return request<void>({
    url: `${TASK_CENTER_BASE}/${taskId}/rerun`,
    method: "post",
  });
}

export function deleteTaskCenterTasks(ids: Array<string | number>) {
  return request<number>({
    url: TASK_CENTER_BASE,
    method: "delete",
    data: { ids },
  });
}

export function createTaskCenterEventSource(lastEventId?: string | null) {
  const token = getAccessToken();
  if (!token) {
    return null;
  }
  const baseURL = httpClient.defaults.baseURL || "/api";
  const url = new URL(
    `${baseURL}${TASK_CENTER_BASE}/stream`,
    window.location.origin,
  );
  url.searchParams.set("token", token);
  if (lastEventId) {
    url.searchParams.set("lastEventId", lastEventId);
  }
  return new EventSource(url.toString());
}

export async function downloadTaskCenterFile(
  taskId: string | number,
  fileId: string | number,
): Promise<BlobDownloadResponse> {
  const response = await httpClient.request<Blob>({
    url: `${TASK_CENTER_BASE}/${taskId}/files/${fileId}/download`,
    method: "get",
    responseType: "blob",
  });
  return parseBlobDownloadResponse(response, `task-${taskId}-file-${fileId}`);
}
