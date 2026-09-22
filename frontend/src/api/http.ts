import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import type { ApiErrorPayload, ApiResponse } from "@/types/api";
import { BaseToast } from "@/components/base/BaseToast";
import { createIdempotencyKey } from "@/utils/idempotency";
import { notifySessionExpired } from "@/utils/session-expiration";
import { getAccessToken } from "@/utils/token";

export type BqRequestConfig = AxiosRequestConfig & {
  skipErrorToast?: boolean;
  /** 额外视为成功的业务 code（如部分老接口返回 "000"） */
  acceptSuccessCodes?: Array<string | number>;
};

const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);
const SUCCESS_CODES = new Set(["0", "200", "SUCCESS"]);
const ERROR_TOAST_DEDUPE_MS = 1200;
const TRACE_HEADER_NAMES = ["x-trace-id", "trace-id", "traceid", "bq-trace-id"];
let lastErrorToastKey = "";
let lastErrorToastAt = 0;

function isSuccessCode(code: string | number): boolean {
  return SUCCESS_CODES.has(String(code));
}

/** 判断业务 code 是否视为成功（默认仅 SUCCESS_CODES；可通过 acceptSuccessCodes 扩展） */
function isAcceptedBusinessSuccessCode(
  code: string | number,
  config?: BqRequestConfig,
): boolean {
  if (isSuccessCode(code)) return true;
  const accepted = config?.acceptSuccessCodes;
  if (!Array.isArray(accepted) || !accepted.length) return false;
  const codeText = String(code);
  return accepted.some((item) => String(item) === codeText);
}

function isApiResponse<T>(body: unknown): body is ApiResponse<T> {
  return (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    ("message" in body || "msg" in body || "data" in body)
  );
}

function getResponseMessage(body: ApiResponse<unknown>): string {
  return body.message || body.msg || "系统异常";
}

function getResponseErrorCode(body: ApiResponse<unknown>): string {
  const data = body.data;
  if (
    typeof data === "object" &&
    data !== null &&
    "errorCode" in data &&
    typeof data.errorCode === "string" &&
    data.errorCode
  ) {
    return data.errorCode;
  }
  return String(body.code);
}

function unwrapApiResponse<T>(body: ApiResponse<T>): T {
  // 收益分页接口 R.page() 把列表放在 rows/total，data 为 null。
  // 若仍优先返回 data，列表会被解包成空，后续按项目查流程会误报「未找到流程」。
  const rows = (body as ApiResponse<T> & { rows?: unknown }).rows;
  const total = (body as ApiResponse<T> & { total?: unknown }).total;
  if ((body.data == null || body.data === undefined) && Array.isArray(rows)) {
    return { rows, total, records: rows } as T;
  }

  if (Object.prototype.hasOwnProperty.call(body, "data")) {
    return body.data as T;
  }

  const rest = Object.fromEntries(
    Object.entries(body).filter(
      ([key]) => !["code", "message", "msg", "traceId"].includes(key),
    ),
  );

  if (Object.keys(rest).length === 0) {
    return undefined as T;
  }
  return rest as T;
}

function resolveRequestId(data: unknown): string | null {
  if (
    typeof data === "object" &&
    data !== null &&
    "requestId" in data &&
    typeof data.requestId === "string" &&
    data.requestId.trim()
  ) {
    return data.requestId;
  }
  return null;
}

function showApiErrorToast(payload: {
  code?: string | number;
  message?: string;
  traceId?: string;
  response?: unknown;
}) {
  const message = payload.message || "接口请求失败，请稍后重试。";
  const dedupeKey = message;
  const now = Date.now();

  if (
    dedupeKey === lastErrorToastKey &&
    now - lastErrorToastAt < ERROR_TOAST_DEDUPE_MS
  ) {
    return;
  }

  lastErrorToastKey = dedupeKey;
  lastErrorToastAt = now;
  if (payload.response === undefined) {
    BaseToast.error(message, 5000);
  } else {
    BaseToast.error(message, 5000, payload.response);
  }
}

function readTraceId(headers?: AxiosResponse["headers"]): string | undefined {
  if (!headers) {
    return undefined;
  }

  const headerBag = headers as Record<string, unknown> & {
    get?: (headerName: string) => unknown;
  };

  for (const headerName of TRACE_HEADER_NAMES) {
    const value = headerBag[headerName] ?? headerBag.get?.(headerName);
    if (Array.isArray(value)) {
      const match = value.map((item) => String(item).trim()).find(Boolean);
      if (match) return match;
      continue;
    }
    if (value != null) {
      const text = String(value).trim();
      if (text) return text;
    }
  }

  return undefined;
}

function resolveTraceId(
  traceId: string | undefined,
  headers?: AxiosResponse["headers"],
): string | undefined {
  return traceId || readTraceId(headers);
}

export class ApiBusinessError extends Error {
  readonly code: string;
  readonly traceId?: string;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiBusinessError";
    this.code = String(payload.code);
    this.traceId = payload.traceId;
  }
}

export interface BlobDownloadResponse {
  blob: Blob;
  fileName: string;
}

function readResponseHeader(
  headers: AxiosResponse<Blob>["headers"],
  name: string,
): string | undefined {
  const headerBag = headers as Record<string, unknown> & {
    get?: (headerName: string) => unknown;
  };
  const value = headerBag[name] ?? headerBag.get?.(name);
  if (Array.isArray(value)) return value.join(", ");
  return value == null ? undefined : String(value);
}

function decodeDownloadFileName(
  contentDisposition?: string,
): string | undefined {
  if (!contentDisposition) return undefined;
  const encoded = contentDisposition.match(
    /filename\*=(?:UTF-8'')?([^;]+)/i,
  )?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim().replace(/^"|"$/g, ""));
    } catch {
      return encoded.trim().replace(/^"|"$/g, "");
    }
  }
  return contentDisposition
    .match(/filename=(?:"([^"]+)"|([^;]+))/i)
    ?.slice(1)
    .find(Boolean)
    ?.trim();
}

async function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

async function throwBlobBusinessError(
  blob: Blob,
  headers?: AxiosResponse["headers"],
): Promise<never> {
  let body: unknown;
  try {
    body = JSON.parse(await readBlobText(blob));
  } catch {
    throw new ApiBusinessError({
      code: "FRONTEND-BLOB-RESPONSE-001",
      message: "下载接口返回了无法解析的 JSON 响应。",
    });
  }

  if (!isApiResponse<unknown>(body)) {
    throw new ApiBusinessError({
      code: "FRONTEND-BLOB-RESPONSE-002",
      message: "下载接口响应格式不符合统一封装。",
    });
  }
  if (String(body.code) === "401") {
    await notifySessionExpired();
  }
  if (!isSuccessCode(body.code)) {
    throw new ApiBusinessError({
      code: getResponseErrorCode(body),
      message: getResponseMessage(body),
      traceId: resolveTraceId(body.traceId, headers),
    });
  }
  throw new ApiBusinessError({
    code: "FRONTEND-BLOB-RESPONSE-003",
    message: "下载接口返回了业务响应而非文件。",
    traceId: resolveTraceId(body.traceId, headers),
  });
}

export async function parseBlobDownloadResponse(
  response: Pick<AxiosResponse<Blob>, "data" | "headers">,
  fallbackName: string,
): Promise<BlobDownloadResponse> {
  const contentType = [
    readResponseHeader(response.headers, "content-type"),
    response.data.type,
  ]
    .filter(Boolean)
    .join(";")
    .toLowerCase();
  if (contentType.includes("json")) {
    await throwBlobBusinessError(response.data, response.headers);
  }
  return {
    blob: response.data,
    fileName:
      decodeDownloadFileName(
        readResponseHeader(response.headers, "content-disposition"),
      ) ?? fallbackName,
  };
}

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 30_0000,
});

httpClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = config.method?.toLowerCase();
  if (
    method &&
    WRITE_METHODS.has(method) &&
    !config.headers["Idempotency-Key"]
  ) {
    config.headers["Idempotency-Key"] =
      resolveRequestId(config.data) ?? createIdempotencyKey();
  }

  return config;
});

httpClient.interceptors.response.use(
  async (response) => {
    const body = response.data as ApiResponse<unknown>;
    const config = response.config as BqRequestConfig;
    if (isApiResponse(body) && !isAcceptedBusinessSuccessCode(body.code, config)) {
      if (String(body.code) === "401") {
        await notifySessionExpired();
      }
      const payload = {
        code: getResponseErrorCode(body),
        message: getResponseMessage(body),
        traceId: resolveTraceId(body.traceId, response.headers),
        response: body,
      };
      if (!config.skipErrorToast) {
        showApiErrorToast(payload);
      }
      throw new ApiBusinessError(payload);
    }

    return response;
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const body = error.response?.data;
    if (
      error.response?.status === 401 ||
      (body?.code !== undefined && String(body.code) === "401")
    ) {
      await notifySessionExpired();
    }

    if (body?.code) {
      const payload = {
        code: getResponseErrorCode(body),
        message: getResponseMessage(body),
        traceId: resolveTraceId(body.traceId, error.response?.headers),
        response: body,
      };
      if (!(error.config as BqRequestConfig | undefined)?.skipErrorToast) {
        showApiErrorToast(payload);
      }
      throw new ApiBusinessError(payload);
    }

    if (!(error.config as BqRequestConfig | undefined)?.skipErrorToast) {
      showApiErrorToast({
        code: error.response?.status,
        response: error.response?.data,
        message: error.message || "接口请求失败，请检查网络或后端服务。",
      });
    }
    throw error;
  },
);

export async function request<T>(config: BqRequestConfig): Promise<T> {
  const response = await httpClient.request<ApiResponse<T>>(config);
  const body = response.data;
  if (!isApiResponse<T>(body)) {
    throw new ApiBusinessError({
      code: "FRONTEND-API-ENVELOPE-001",
      message: "接口响应格式不符合统一封装。",
    });
  }

  if (!isAcceptedBusinessSuccessCode(body.code, config)) {
    throw new ApiBusinessError({
      code: getResponseErrorCode(body),
      message: getResponseMessage(body),
      traceId: resolveTraceId(body.traceId, response.headers),
    });
  }

  return unwrapApiResponse<T>(body);
}
