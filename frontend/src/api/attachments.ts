import { httpClient, request } from "@/api/http";
import type { TaskCenterTaskResponse } from "@/types/task-center";
import { createIdempotencyKey } from "@/utils/idempotency";

export type AttachmentRow = Record<string, unknown> & {
  id?: string | number;
  fileName?: string;
  fileType?: string;
  filePath?: string;
  fileUrl?: string;
  createTime?: string;
  checked?: boolean;
};

export function lixiangList(query: Record<string, unknown>) {
  return request<{ rows?: AttachmentRow[]; total?: number }>({
    url: "/system/attachment/list",
    method: "get",
    params: query,
  });
}

export function lixiangDownload(filePath: string) {
  return httpClient.request<Blob>({
    url: "/system/attachment/down-file/",
    method: "get",
    params: {
      filePath,
    },
    responseType: "blob",
  });
}

export function createAttachmentPackageTask(
  attachmentIds: Array<string | number>,
) {
  return request<TaskCenterTaskResponse>({
    url: "/system/attachment/package",
    method: "post",
    data: { attachmentIds: attachmentIds.map(Number) },
    headers: {
      "Idempotency-Key": createIdempotencyKey("attachment-package"),
    },
  });
}

export function attachmentUpload(
  id: string | number,
  data: FormData,
  type = "biz_project",
) {
  return request<void>({
    url: `/system/attachment/upload-file/${type}/${id}`,
    method: "post",
    data,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

export function lixiangDelete(data: FormData) {
  return request<void>({
    url: "/system/attachment/batch-remove",
    method: "delete",
    data,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}
