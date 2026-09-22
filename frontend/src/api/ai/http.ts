import axios from "axios";
import { httpClient } from "@/api/http";
import type { BqRequestConfig } from "@/api/http";
import {
  ManagementError,
  type ManagementService,
  type ProjectSummary,
  type ApiKeySummary,
  type UsageSummary,
} from "./types";

// 待 Contract Owner 补齐列表 data / 创建 Secret 响应后，提供解码器。
// 不以 array/items/records 或 secret/apiKey 等猜测作为正式响应协议。
export interface ManagementDecoders {
  projects(data: unknown): ProjectSummary[];
  keys(data: unknown): ApiKeySummary[];
  usage(data: unknown): UsageSummary[];
  createdSecret(data: unknown): string;
}
export function createHttpManagementService(
  decoders?: ManagementDecoders,
): ManagementService {
  function requireDecoders() {
    if (!decoders)
      throw new ManagementError(
        0,
        "CONTRACT_PENDING",
        "接口响应定义待确认，暂时无法加载或提交。",
      );
    return decoders;
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
      const d = requireDecoders();
      return d.projects(await send("/projects"));
    },
    async keys(id) {
      const d = requireDecoders();
      return d.keys(await send(`/projects/${encodeURIComponent(id)}/api-keys`));
    },
    async usage() {
      const d = requireDecoders();
      return d.usage(await send("/usage"));
    },
    async createProject(input) {
      requireDecoders();
      await send("/projects", "post", input);
    },
    async createKey(id, input) {
      const d = requireDecoders();
      return d.createdSecret(
        await send(
          `/projects/${encodeURIComponent(id)}/api-keys`,
          "post",
          input,
        ),
      );
    },
    async changeKey(id, action) {
      requireDecoders();
      await send(`/api-keys/${encodeURIComponent(id)}/${action}`, "post");
    },
  };
}
