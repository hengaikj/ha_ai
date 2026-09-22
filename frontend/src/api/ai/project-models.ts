import axios from "axios";
import { httpClient, type BqRequestConfig } from "@/api/http";

export interface ProjectModelPermission {
  logicalModelId: string;
  modelCode: string;
  modelName: string;
  status: "ENABLED" | "DISABLED" | string;
}

export interface ProjectModelsDecoders {
  list(data: unknown): ProjectModelPermission[];
}

export class ProjectModelsContractError extends Error {
  readonly code = "CONTRACT_PENDING";
}

export function createProjectModelsService(decoders?: ProjectModelsDecoders) {
  const requireDecoders = () => {
    if (!decoders)
      throw new ProjectModelsContractError("项目模型权限响应解码器待接入。");
    return decoders;
  };
  async function request(
    projectId: string,
    method: "get" | "put",
    data?: unknown,
  ) {
    try {
      const config: BqRequestConfig = {
        baseURL: import.meta.env.VITE_AI_API_BASE_URL || "/api",
        url: `/projects/${encodeURIComponent(projectId)}/models`,
        method,
        data,
        skipErrorToast: true,
      };
      const response = await httpClient.request(config);
      const body = response.data as { success?: boolean; data?: unknown };
      if (body?.success !== true)
        throw new ProjectModelsContractError(
          "接口响应格式不符合项目模型权限契约。",
        );
      return body.data;
    } catch (error) {
      if (axios.isAxiosError(error)) throw error;
      throw error;
    }
  }
  return {
    async list(projectId: string) {
      const decoder = requireDecoders();
      return decoder.list(await request(projectId, "get"));
    },
    async save(projectId: string, modelIds: string[]) {
      requireDecoders();
      await request(projectId, "put", { modelIds });
    },
  };
}
