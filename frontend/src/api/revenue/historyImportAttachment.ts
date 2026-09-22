/**
 * 收益 - 历史导入附件 API
 */
import { httpClient, parseBlobDownloadResponse, request } from "@/api/http";

const PREFIX = "/prod-revenue-api/history-import/attachments";

/**
 * 查询历史导入附件列表
 */
export async function listHistoryImportAttachments(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: PREFIX,
    method: "get",
    params,
  });
}

/**
 * 获取附件树汇总
 */
export async function getHistoryImportAttachmentTreeSummary(): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PREFIX}/tree-summary`,
    method: "get",
  });
}

/**
 * 上传历史导入附件
 */
export async function uploadHistoryImportAttachment(
  formData: FormData,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PREFIX}/upload`,
    method: "post",
    data: formData,
    headers: { "Content-Type": "multipart/form-data" },
  });
}

async function fetchAttachmentBlob(
  url: string,
  fallbackName: string,
  method: "get" | "post" = "get",
  data?: unknown,
): Promise<{ data: Blob }> {
  // 预览/下载返回原始文件流，不能走 request() 的 JSON 业务信封解包
  const response = await httpClient.request<Blob>({
    baseURL: "",
    url,
    method,
    data,
    responseType: "blob",
    timeout: 120_000,
  });
  const parsed = await parseBlobDownloadResponse(response, fallbackName);
  return { data: parsed.blob };
}

/**
 * 预览历史导入附件
 */
export async function previewHistoryImportAttachment(
  id: number,
): Promise<{ data: Blob }> {
  return fetchAttachmentBlob(
    `${PREFIX}/${id}/preview`,
    `attachment-${id}-preview`,
  );
}

/**
 * 下载历史导入附件
 */
export async function downloadHistoryImportAttachment(
  id: number,
): Promise<{ data: Blob }> {
  return fetchAttachmentBlob(`${PREFIX}/${id}/download`, `attachment-${id}`);
}

/**
 * 删除历史导入附件
 */
export async function deleteHistoryImportAttachment(
  id: number,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PREFIX}/${id}`,
    method: "delete",
  });
}

/**
 * 批量删除历史导入附件
 */
export async function batchDeleteHistoryImportAttachments(
  ids: number[],
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PREFIX}/batch`,
    method: "delete",
    data: { ids },
  });
}

/**
 * 批量下载历史导入附件
 */
export async function batchDownloadHistoryImportAttachments(
  ids: number[],
): Promise<{ data: Blob }> {
  return fetchAttachmentBlob(
    `${PREFIX}/batch-download`,
    "history-import-attachments.zip",
    "post",
    { ids },
  );
}
