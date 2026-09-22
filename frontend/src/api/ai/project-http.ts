import axios from "axios";
import { httpClient, type BqRequestConfig } from "@/api/http";
import {
  ProjectServiceError,
  type ProjectInput,
  type ProjectService,
  type ProjectSummary,
} from "./project-mock";

interface ProjectEnvelope<T> {
  success?: boolean;
  requestId?: string;
  data?: T;
}

function normalizeError(error: unknown): never {
  if (!axios.isAxiosError(error)) throw error;
  const status = error.response?.status || 0;
  const message =
    (
      {
        400: "请求参数不合法",
        401: "认证已失效",
        403: "无权限访问",
        404: "项目不存在",
        409: "项目状态冲突，请检查输入后重试",
        500: "服务暂时不可用",
      } as Record<number, string>
    )[status] || "网络请求失败";
  throw new ProjectServiceError(
    status,
    String(status || "NETWORK_ERROR"),
    message,
    error.response?.headers["x-request-id"],
  );
}

export function createHttpProjectService(): ProjectService {
  async function request<T>(config: BqRequestConfig): Promise<T> {
    try {
      const response = await httpClient.request<ProjectEnvelope<T>>(config);
      const body = response.data;
      if (body?.success !== true || body.data === undefined)
        throw new ProjectServiceError(
          0,
          "INVALID_RESPONSE",
          "项目接口响应格式不符合正式契约。",
          body?.requestId,
        );
      return body.data;
    } catch (error) {
      normalizeError(error);
    }
  }
  return {
    async list() {
      return request<ProjectSummary[]>({
        baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
        url: "/projects",
        method: "get",
        skipErrorToast: true,
      });
    },
    async create(input: ProjectInput) {
      await request<ProjectSummary>({
        baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
        url: "/projects",
        method: "post",
        data: input,
        skipErrorToast: true,
      });
    },
  };
}
