/**
 * 收益 - 项目管理 API
 * 提供项目列表查询和操作的基础接口
 */
import { request } from "@/api/http";
import type { RevenueListParams, RevenueListResult, RevenueActionResult } from "@/types/revenue";

/**
 * 获取收益项目列表
 * 复用主表导入项目列表接口（旧系统 /system/project/list，经 /api 代理）
 */
export async function getRevenueProjectList(
  params: RevenueListParams = {},
): Promise<RevenueListResult> {
  return request<RevenueListResult>({
    url: "/system/project/list",
    method: "get",
    params,
  });
}

/**
 * 项目操作（填报、审核、提交等）
 */
export async function postRevenueProjectListAction(
  data: Record<string, unknown>,
): Promise<RevenueActionResult> {
  return request<RevenueActionResult>({
    baseURL: "",
    url: "/prod-revenue-api/revenue/project/action",
    method: "post",
    data,
  });
}
