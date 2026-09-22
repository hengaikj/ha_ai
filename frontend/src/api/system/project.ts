/**
 * 系统 - 项目 API
 */
import { request } from "@/api/http";

/**
 * 查询用户项目列表（复用主表导入项目列表接口，经 /api 代理）
 */
export async function listUserProjects(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  return request({ url: "/system/project/list", method: "get", params });
}
