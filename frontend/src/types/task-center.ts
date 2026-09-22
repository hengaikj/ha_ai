export type TaskCenterStatus =
  | "CREATED"
  | "WAITING"
  | "RUNNING"
  | "RETRY_WAITING"
  | "CANCEL_REQUESTED"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMEOUT"
  | "CANCELLED";

export type TaskCenterTaskResponse = {
  taskId: string;
  taskNo: string;
  taskType: string;
  businessModule: string;
  businessType: string;
  businessId: string;
  businessKey?: string | null;
  batchNo: string;
  status: TaskCenterStatus;
  progress: number;
  totalCount: number;
  successCount: number;
  failedCount: number;
  attemptCount: number;
  maxAttempts: number;
  triggerType: string;
  triggerBy?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  failureCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
};

export type TaskCenterTaskPageQuery = {
  taskType?: string;
  businessModule?: string;
  status?: string;
  keyword?: string;
  pageNo?: number;
  pageSize?: number;
};

export type TaskCenterTaskPageResponse = {
  records: TaskCenterTaskResponse[];
  pageNo: number;
  pageSize: number;
  total: number;
};

export type TaskCenterTaskEvent = TaskCenterTaskResponse;

export type TaskCenterStepResponse = {
  stepId: string;
  stepCode: string;
  stepName: string;
  stepOrder: number;
  status: string;
  progress: number;
  processedCount: number;
  failedCount: number;
  errorSummary?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type TaskCenterFileResponse = {
  fileId: string;
  fileType: "INPUT" | "RESULT" | "ERROR_DETAIL" | "PACKAGE" | string;
  fileName: string;
  contentType?: string | null;
  fileSize: number;
  expiresAt?: string | null;
  downloadCount: number;
  createdAt: string;
};

export type TaskCenterLogResponse = {
  logId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  message?: string | null;
  workerId?: string | null;
  createdAt: string;
};

export type TaskCenterTaskDetailResponse = {
  task: TaskCenterTaskResponse;
  steps: TaskCenterStepResponse[];
  files: TaskCenterFileResponse[];
  logs: TaskCenterLogResponse[];
};
