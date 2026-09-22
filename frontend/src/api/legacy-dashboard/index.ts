import { request, type BqRequestConfig } from "@/api/http";
export { formatPrice } from "./format";

type LegacyResponse<T> = { data: T };

function legacy<T>(config: BqRequestConfig): Promise<LegacyResponse<T>> {
  return request<T>(config).then((data) => ({ data }));
}

export function boardBuget(params?: Record<string, unknown>) {
  return legacy<unknown[]>({ url: "/system/project/board/budget", method: "get", params });
}

export function optionsValue(params?: Record<string, unknown>) {
  return legacy<unknown[]>({ url: "/system/valve/options", method: "get", params });
}

export function getCostBomCountResearch(params?: Record<string, unknown>) {
  return legacy<unknown>({ url: "/system/version/bom/getCostBomCountResearch", method: "get", params });
}

export function getCostBomCountResearchTwo(params?: Record<string, unknown>) {
  return legacy<unknown>({ url: "/system/version/getMeasureCountResearch", method: "get", params });
}

export function getCostBomValveVoList(params?: Record<string, unknown>) {
  return legacy<unknown[]>({ url: "/system/version/bom/board/pattern-detail", method: "get", params });
}

export function getMeasureCount(params?: Record<string, unknown>) {
  return legacy<unknown>({ url: "/system/version/getMeasureCount", method: "get", params });
}

export function getMeasureChange(params?: Record<string, unknown>) {
  return legacy<unknown>({ url: "/system/version/bom/getCostBomCount", method: "get", params });
}

export function projectGet(params?: Record<string, unknown>) {
  return request<{ rows?: unknown[]; records?: unknown[] }>({
    url: "/system/project/list",
    method: "get",
    params,
  });
}

export function procurementStatics(params?: Record<string, unknown>) {
  return legacy<Record<string, unknown>>({
    url: "/board/api/statics/procurement",
    method: "get",
    params,
  });
}
