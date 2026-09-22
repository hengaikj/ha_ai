/**
 * 收益 - 上会评审 API
 */
import { request } from "@/api/http";

/**
 * 上会评审详情查询
 */
export async function fetchMeetingReviewDetail(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: "/prod-revenue-api/revenue/meeting-review/detail",
    method: "get",
    params,
  });
}

/**
 * 保存上会评审草稿
 */
export async function saveMeetingReviewDraft(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: "/prod-revenue-api/revenue/meeting-review/draft",
    method: "post",
    data: params,
  });
}

/**
 * 提交上会评审决策
 */
export async function submitMeetingReviewDecision(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: "/prod-revenue-api/revenue/meeting-review/submit",
    method: "post",
    data: params,
  });
}
