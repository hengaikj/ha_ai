/**
 * 系统 - 阀点 API
 */
import { request } from "@/api/http";

export async function listValve(params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return request({ url: "/system/valve/list", method: "get", params });
}
