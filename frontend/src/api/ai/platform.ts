import axios from "axios";
import { httpClient, type BqRequestConfig } from "@/api/http";

export interface LogicalModel {
  logicalModelId: string;
  modelCode: string;
  modelName: string;
  capabilities?: Record<string, unknown>;
  status: "ENABLED" | "DISABLED" | string;
  createdAt: string;
  updatedAt: string;
}
export interface LogicalModelInput {
  modelCode: string;
  modelName: string;
  capabilities?: Record<string, unknown>;
  status?: "ENABLED" | "DISABLED";
}
export interface Provider {
  providerId: string;
  providerCode: string;
  providerName: string;
  adapterCode: string;
  status: "ENABLED" | "DISABLED" | string;
  createdAt: string;
  updatedAt: string;
}
export interface ProviderInput {
  providerCode: string;
  providerName: string;
  adapterCode: string;
  status?: "ENABLED" | "DISABLED";
}
export interface Channel {
  channelId: string;
  providerId: string;
  channelCode: string;
  channelName: string;
  endpoint: string;
  credentialRef?: string;
  priority: number;
  weight: number;
  status: "ENABLED" | "DISABLED" | string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface ChannelInput {
  providerId: string;
  channelCode: string;
  channelName: string;
  endpoint: string;
  credentialRef: string;
  priority?: number;
  weight?: number;
  status?: "ENABLED" | "DISABLED";
}

export interface PlatformAiDecoders {
  models(data: unknown): LogicalModel[];
  providers(data: unknown): Provider[];
  channels(data: unknown): Channel[];
}

function listOf<T>(
  data: unknown,
  resource: string,
  validate: (value: unknown) => value is T,
): T[] {
  if (!Array.isArray(data) || !data.every(validate)) {
    throw new PlatformAiContractError(`${resource} 响应不是有效列表。`);
  }
  return data;
}

const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const modelDecoder = (value: unknown): value is LogicalModel => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LogicalModel>;
  return (
    text(item.logicalModelId) &&
    text(item.modelCode) &&
    text(item.modelName) &&
    text(item.status) &&
    text(item.createdAt) &&
    text(item.updatedAt)
  );
};
const providerDecoder = (value: unknown): value is Provider => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Provider>;
  return (
    text(item.providerId) &&
    text(item.providerCode) &&
    text(item.providerName) &&
    text(item.adapterCode) &&
    text(item.status) &&
    text(item.createdAt) &&
    text(item.updatedAt)
  );
};
const channelDecoder = (value: unknown): value is Channel => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Channel>;
  return (
    text(item.channelId) &&
    text(item.providerId) &&
    text(item.channelCode) &&
    text(item.channelName) &&
    text(item.endpoint) &&
    typeof item.priority === "number" &&
    typeof item.weight === "number" &&
    text(item.status) &&
    typeof item.version === "number" &&
    text(item.createdAt) &&
    text(item.updatedAt)
  );
};

export const platformAiDecoders: PlatformAiDecoders = {
  models: (data) => listOf(data, "模型", modelDecoder),
  providers: (data) => listOf(data, "Provider", providerDecoder),
  channels: (data) => listOf(data, "渠道", channelDecoder),
};

export class PlatformAiContractError extends Error {
  readonly code = "CONTRACT_PENDING";
}

export function createPlatformAiService(decoders?: PlatformAiDecoders) {
  const requireDecoders = () => {
    if (!decoders)
      throw new PlatformAiContractError("平台 AI 列表响应解码器待接入。");
    return decoders;
  };
  async function get(path: string) {
    try {
      const config: BqRequestConfig = {
        baseURL: import.meta.env.VITE_AI_API_BASE_URL || "/api",
        url: path,
        method: "get",
        skipErrorToast: true,
      };
      const response = await httpClient.request(config);
      const body = response.data as { success?: boolean; data?: unknown };
      if (body?.success !== true)
        throw new PlatformAiContractError("接口响应格式不符合平台 AI 契约。");
      return body.data;
    } catch (error) {
      if (axios.isAxiosError(error)) throw error;
      throw error;
    }
  }
  async function createModel(input: LogicalModelInput) {
    const config: BqRequestConfig = {
      baseURL: import.meta.env.VITE_AI_API_BASE_URL || "/api",
      url: "/platform/models",
      method: "post",
      data: input,
      skipErrorToast: true,
    };
    const response = await httpClient.request(config);
    const body = response.data as { success?: boolean };
    if (body?.success !== true)
      throw new PlatformAiContractError("创建模型响应格式不符合平台 AI 契约。");
  }
  async function createProvider(input: ProviderInput) {
    const config: BqRequestConfig = {
      baseURL: import.meta.env.VITE_AI_API_BASE_URL || "/api",
      url: "/platform/providers",
      method: "post",
      data: input,
      skipErrorToast: true,
    };
    const response = await httpClient.request(config);
    const body = response.data as { success?: boolean };
    if (body?.success !== true)
      throw new PlatformAiContractError(
        "创建 Provider 响应格式不符合平台 AI 契约。",
      );
  }
  async function createChannel(input: ChannelInput) {
    const config: BqRequestConfig = {
      baseURL: import.meta.env.VITE_AI_API_BASE_URL || "/api",
      url: "/platform/channels",
      method: "post",
      data: input,
      skipErrorToast: true,
    };
    const response = await httpClient.request(config);
    const body = response.data as { success?: boolean };
    if (body?.success !== true)
      throw new PlatformAiContractError("创建渠道响应格式不符合平台 AI 契约。");
  }
  return {
    createModel,
    createProvider,
    createChannel,
    async models() {
      return requireDecoders().models(await get("/platform/models"));
    },
    async providers() {
      return requireDecoders().providers(await get("/platform/providers"));
    },
    async channels() {
      return requireDecoders().channels(await get("/platform/channels"));
    },
  };
}
