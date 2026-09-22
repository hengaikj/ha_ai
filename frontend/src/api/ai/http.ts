import axios from "axios";
import { httpClient } from "@/api/http";
import type { BqRequestConfig } from "@/api/http";
import {
  ManagementError,
  type ManagementService,
  type ProjectSummary,
  type ApiKeySummary,
  type ApiKeyCreated,
  type UsageSummary,
  type ProjectContextAdapter,
} from "./types";

// IS-M01-03 正式 Contract 解码器：列表只投影 Summary 字段，创建只读取 data.secret。
export interface ManagementDecoders {
  projects?: (data: unknown) => ProjectSummary[];
  keys?: (data: unknown) => ApiKeySummary[];
  usage?: (data: unknown) => UsageSummary[];
  createdSecret?: (data: unknown) => string;
}
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
function invalid(message: string): never {
  throw new ManagementError(0, "INVALID_RESPONSE", message);
}
function decodeApiKey(value: unknown): ApiKeySummary {
  if (!value || typeof value !== "object")
    return invalid("API Key 列表项格式不符合契约。");
  const item = value as Record<string, unknown>;
  if (
    !text(item.apiKeyId) ||
    !text(item.keyName) ||
    !text(item.keyPrefix) ||
    !["ENABLED", "DISABLED", "REVOKED"].includes(String(item.status)) ||
    !text(item.createdAt) ||
    (item.expiresAt !== null && !text(item.expiresAt))
  )
    return invalid("API Key 列表项缺少正式字段。");
  return {
    apiKeyId: item.apiKeyId,
    keyName: item.keyName,
    keyPrefix: item.keyPrefix,
    status: item.status as ApiKeySummary["status"],
    createdAt: item.createdAt,
    expiresAt: item.expiresAt as string | null,
  };
}
export const apiKeyDecoders: Pick<
  ManagementDecoders,
  "keys" | "createdSecret"
> = {
  keys(data) {
    if (!Array.isArray(data)) return invalid("API Key 列表响应不是数组。");
    return data.map(decodeApiKey);
  },
  createdSecret(data) {
    if (
      !data ||
      typeof data !== "object" ||
      !text((data as Partial<ApiKeyCreated>).secret)
    )
      return invalid("创建 API Key 响应缺少 data.secret。");
    return (data as ApiKeyCreated).secret;
  },
};
export function createHttpManagementService(
  decoders?: ManagementDecoders,
): ManagementService {
  function requireDecoder<K extends keyof ManagementDecoders>(name: K) {
    const decoder = decoders?.[name];
    if (!decoder)
      throw new ManagementError(
        0,
        "CONTRACT_PENDING",
        "接口响应定义待确认，暂时无法加载或提交。",
      );
    return decoder;
  }
  async function send(path: string, method = "get", data?: unknown) {
    try {
      const config: BqRequestConfig = {
        baseURL: import.meta.env.VITE_AI_API_BASE_URL || "/api",
        url: path,
        method,
        data,
        skipErrorToast: true,
      };
      const response = await httpClient.request(config);
      const body = response.data;
      if (!body || body.success !== true)
        throw new ManagementError(
          0,
          "INVALID_RESPONSE",
          "接口响应格式不符合管理接口约定。",
          response.headers["x-request-id"],
        );
      return body.data as unknown;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 0;
        // 不把服务端任意错误正文输出到 UI/日志，避免意外泄露 Secret。
        throw new ManagementError(
          status,
          String(status || "NETWORK_ERROR"),
          (
            {
              400: "请求参数不合法",
              401: "认证已失效",
              403: "无权限访问",
              404: "资源不存在",
              409: "资源状态冲突，请检查输入后重试",
              500: "服务暂时不可用",
            } as Record<number, string>
          )[status] || "网络请求失败",
          error.response?.headers["x-request-id"],
        );
      }
      throw error;
    }
  }
  return {
    async projects() {
      return requireDecoder("projects")(await send("/projects"));
    },
    async keys(id) {
      return requireDecoder("keys")(
        await send(`/projects/${encodeURIComponent(id)}/api-keys`),
      );
    },
    async usage() {
      return requireDecoder("usage")(await send("/usage"));
    },
    async createProject(input) {
      requireDecoder("projects");
      await send("/projects", "post", input);
    },
    async createKey(id, input) {
      return requireDecoder("createdSecret")(
        await send(
          `/projects/${encodeURIComponent(id)}/api-keys`,
          "post",
          input,
        ),
      );
    },
    async changeKey(context: ProjectContextAdapter, id, action) {
      requireDecoder("keys");
      if (!context.projectId())
        throw new ManagementError(
          0,
          "PROJECT_CONTEXT_REQUIRED",
          "缺少当前项目上下文。",
        );
      await send(`/api-keys/${encodeURIComponent(id)}/${action}`, "post");
    },
  };
}
