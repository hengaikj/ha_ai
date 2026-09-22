import { httpClient, request } from "@/api/http";
import type {
  PlatformFileMetadataResponse,
  PlatformFilePreviewResponse,
} from "@/types/platform-file";

export async function uploadPlatformFile(
  file: File,
  businessModule: string,
  businessId: string | number,
  _expireDays = 0,
): Promise<PlatformFileMetadataResponse> {
  void _expireDays;
  const formData = new FormData();
  formData.append("fileName", file.name);
  formData.append("file", file);

  const uploadResult = await request<BackendAttachment | string | number>({
    url: `/system/attachment/upload-file/${encodeURIComponent(businessModule)}/${encodeURIComponent(String(businessId))}`,
    method: "post",
    data: formData,
  });
  const attachment: BackendAttachment =
    typeof uploadResult === "object" && uploadResult !== null
      ? uploadResult
      : { id: uploadResult };

  return {
    fileId: String(attachment.id ?? ""),
    originalName: attachment.fileName ?? file.name,
    normalizedName: attachment.fileName ?? file.name,
    fileSize: attachment.fileSize ?? file.size,
    contentType: attachment.fileType ?? file.type,
    extension: file.name.split(".").pop() ?? "",
    sha256: "",
    storageKey: attachment.filePath ?? "",
    businessModule,
    businessId: String(businessId),
    permissionScope: "PRIVATE",
    status: "ENABLED",
    virusScanStatus: "SKIPPED",
    createdAt: attachment.createTime ?? new Date().toISOString(),
  };
}

type BackendAttachment = {
  id?: number | string;
  bizCode?: string;
  bizId?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  filePath?: string;
  fileUrl?: string;
  createTime?: string;
};

export async function downloadPlatformFile(
  fileId: string | number,
  _businessModule?: string,
  _businessId?: string | number,
): Promise<Blob> {
  void _businessModule;
  void _businessId;
  const attachment = await request<BackendAttachment>({
    url: `/system/attachment/${fileId}`,
    method: "get",
  });
  const response = await httpClient.request<Blob>({
    url: "/system/attachment/down-file",
    method: "get",
    params: { filePath: attachment.filePath },
    responseType: "blob",
  });
  return response.data;
}

export async function previewPlatformFile(
  fileId?: string | number,
  businessModule?: string,
  businessId?: string | number,
): Promise<PlatformFilePreviewResponse> {
  void businessModule;
  void businessId;
  const attachment = await request<BackendAttachment>({
    url: `/system/attachment/${fileId}`,
    method: "get",
  });
  return {
    fileId: String(fileId ?? ""),
    fileName: attachment.fileName ?? "",
    contentType: attachment.fileType ?? "",
    previewType: "DIRECT_STREAM",
    directStream: true,
    sampled: false,
  };
}

export function deletePlatformFile(
  fileId?: string | number,
  businessModule?: string,
  businessId?: string | number,
): Promise<void> {
  void businessModule;
  void businessId;
  return request<void>({
    url: `/system/attachment/${fileId}`,
    method: "delete",
  });
}
