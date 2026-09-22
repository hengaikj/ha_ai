export type PlatformFileMetadataResponse = {
  fileId: string;
  originalName: string;
  normalizedName: string;
  fileSize: number;
  contentType: string;
  extension: string;
  sha256: string;
  storageKey: string;
  businessModule: string;
  businessId: string;
  permissionScope: string;
  status: string;
  virusScanStatus: string;
  expiresAt?: string | null;
  createdAt: string;
};

export type PlatformFilePreviewResponse = {
  fileId: string;
  fileName: string;
  contentType: string;
  previewType: "TEXT" | "TABLE" | "DIRECT_STREAM" | string;
  text?: string | null;
  sheets?: Array<{
    name: string;
    rows: string[][];
  }> | null;
  directStream: boolean;
  sampled: boolean;
};
