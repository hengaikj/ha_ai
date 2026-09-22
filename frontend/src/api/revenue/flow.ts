/**
 * 收益 - 流程管理 API
 * 提供流程创建、执行、回退等核心接口
 */
import { request } from "@/api/http";
import type { RevenueListParams } from "@/types/revenue";

const PROJECT_COST_BASE_URL = "/prod-revenue-api/project-costs";

export interface CreateProjectCostFlowParams {
  projectId: string;
  projectName?: string;
  projectNo?: string;
  valvePoint?: string;
  templateId: string;
  node: string;
  creatorId: string;
  creatorName?: string;
}

export interface FlowActionParams {
  action: string;
  targetNode: string;
  targetNodeStatus?: string;
  operatorId: string;
  operatorName: string;
  actionRemark?: string;
  secondTriggerRequired?: boolean;
}

/**
 * 创建项目成本流程
 */
export async function createProjectCostFlow(
  params: CreateProjectCostFlowParams,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows`,
    method: "post",
    data: params,
  });
}

/**
 * 查询项目成本流程列表
 */
export async function listProjectCostFlows(
  params: RevenueListParams,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows`,
    method: "get",
    params,
  });
}

/**
 * 删除项目成本流程当前节点（回退）
 */
export async function deleteProjectCostFlowCurrentNode(
  flowId: string,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows/${flowId}/current-node`,
    method: "delete",
  });
}

/**
 * 执行项目成本流程操作
 */
export async function executeProjectCostFlowAction(
  flowId: string,
  params: FlowActionParams,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows/${flowId}/actions`,
    method: "post",
    data: params,
  });
}

/**
 * 获取项目成本流程日志
 */
export async function getProjectCostFlowLogs(
  flowId: string,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows/${flowId}/logs`,
    method: "get",
  });
}

/**
 * 获取用户费用科目权限树
 */
export async function getUserExpenseSubjectPermissionTree(
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: "/prod-revenue-api/user-period-expense-subject-permissions/tree",
    method: "get",
    params,
  });
}

/**
 * 分页查询收益项目列表（流程列表）
 */
export async function queryRevenueProjectPage(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows`,
    method: "get",
    params: {
      flowType: "NORMAL",
      ...params,
    },
  });
}

/**
 * 查询项目成本记录
 */
export async function queryProjectCostRecords(
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/records/query`,
    method: "post",
    data: params,
  });
}

/**
 * 查询项目成本评审意见
 */
export async function queryProjectCostReviewSuggestions(
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: "/prod-revenue-api/review/suggestions",
    method: "get",
    params,
  });
}

/**
 * 保存项目成本评审
 */
export async function saveProjectCostReview(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: "/prod-revenue-api/review/save",
    method: "post",
    data: params,
  });
}

/**
 * 获取可选择的项目成本流程列表
 */
export async function listSelectableProjectCostFlowProjects(
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows/selectable-projects`,
    method: "get",
    params,
  });
}
