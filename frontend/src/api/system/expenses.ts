/**
 * 系统 - 费用/流程 API
 * 提供项目成本流程、费用科目、公式、模板等方法。
 *
 * 接口路径与参数规约以《北汽UI/newfront/src/api/system/expenses.js》为准（后端真实路径），
 * 本文件保持 Vue3 + TypeScript 架构。
 * 说明：原项目 request 透传的 revenueTraceLabel 为后端链路追踪标记，当前 http 封装未启用该字段，
 * 故仅保留函数签名第二参以兼容调用方，实际不随请求发出。
 */
import { request } from "@/api/http";

const REVENUE_API_PREFIX = "/prod-revenue-api";
const EXPENSES_BASE_URL = `${REVENUE_API_PREFIX}/period-expense-subjects`;
const EXPENSES_TREE_URL = `${EXPENSES_BASE_URL}/tree`;
const EXPENSE_FORMULA_BASE_URL = `${REVENUE_API_PREFIX}/period-expense-formulas`;
const EXPENSE_TEMPLATE_BASE_URL = `${REVENUE_API_PREFIX}/period-expense-templates`;
const EXPENSE_PERMISSION_BASE_URL = `${REVENUE_API_PREFIX}/user-period-expense-subject-permissions`;
const EXPENSE_PERMISSION_TREE_URL = `${EXPENSE_PERMISSION_BASE_URL}/tree`;
const PROJECT_COST_BASE_URL = `${REVENUE_API_PREFIX}/project-costs`;
const PROJECT_COST_MEETING_BASE_URL = `${PROJECT_COST_BASE_URL}/meetings`;
/** 子表批量退回草稿/写审核等写操作可能涉及数百条 record，放宽超时 */
const REVENUE_PROJECT_COST_WRITE_TIMEOUT_MS = 120_000;
const OA_AFFAIRS_BASE_URL = `${REVENUE_API_PREFIX}/oa-affairs`;

type JsonObject = Record<string, unknown>;

function safeText(value: unknown): string {
  return String(value == null ? "" : value).trim();
}

function normalizeProjectId(value: unknown): number | string | undefined {
  const text = safeText(value);
  if (!text) return undefined;
  return /^\d+$/.test(text) ? Number(text) : text;
}

function normalizeProjectScopedParams(params: JsonObject = {}): JsonObject {
  const source = params && typeof params === "object" ? params : {};
  const payload: JsonObject = { ...source };
  const projectId = normalizeProjectId(source.projectId || source.project_id);
  if (projectId !== undefined) {
    payload.projectId = projectId;
  }
  delete payload.projectCode;
  delete payload.projectCodes;
  delete payload.projectNo;
  delete payload.project_id;
  delete payload.revenueTraceLabel;
  delete payload.revenueTraceSource;
  delete payload.traceLabel;
  delete payload.traceSource;
  return payload;
}

function normalizeProjectScopedPayload(data: JsonObject = {}): JsonObject {
  const source = data && typeof data === "object" ? data : {};
  const payload: JsonObject = { ...source };
  const projectId = normalizeProjectId(source.projectId || source.project_id);
  if (projectId !== undefined) {
    payload.projectId = projectId;
  }
  delete payload.projectCode;
  delete payload.projectCodes;
  //delete payload.projectNo;
  delete payload.project_id;
  delete payload.revenueTraceLabel;
  delete payload.revenueTraceSource;
  delete payload.traceLabel;
  delete payload.traceSource;
  return payload;
}

function normalizeProjectCostNodeList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return (list as unknown[])
    .map((item) => safeText(item).toUpperCase())
    .filter((item, index, array) => item && array.indexOf(item) === index);
}

function appendRepeatedQueryPart(parts: string[], name: string, value: unknown): void {
  const list = Array.isArray(value) ? value : [value];
  (list as unknown[])
    .map((item) => safeText(item))
    .filter(Boolean)
    .forEach((item) => {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(item)}`);
    });
}

function buildProjectCostMeetingQuery(params: JsonObject = {}): string {
  const source = params && typeof params === "object" ? params : {};
  const parts: string[] = [];
  appendRepeatedQueryPart(parts, "projectIds", source.projectIds || source.projectId);
  appendRepeatedQueryPart(parts, "valvePoints", source.valvePoints || source.valvePoint);
  appendRepeatedQueryPart(parts, "nodes", source.nodes || source.node);
  appendRepeatedQueryPart(parts, "pageNum", source.pageNum);
  appendRepeatedQueryPart(parts, "pageSize", source.pageSize);
  return parts.length ? `?${parts.join("&")}` : "";
}

function buildProjectCostFlowQuery(params: JsonObject = {}): string {
  const source = params && typeof params === "object" ? params : {};
  const parts: string[] = [];
  appendRepeatedQueryPart(parts, "projectId", source.projectId || source.projectIds);
  appendRepeatedQueryPart(parts, "valvePoint", source.valvePoint || source.valvePoints);
  appendRepeatedQueryPart(parts, "flowType", source.flowType);
  appendRepeatedQueryPart(parts, "node", source.node || source.nodes);
  appendRepeatedQueryPart(parts, "nodeStatus", source.nodeStatus);
  appendRepeatedQueryPart(parts, "projectName", source.projectName);
  appendRepeatedQueryPart(parts, "pageNum", source.pageNum);
  appendRepeatedQueryPart(parts, "pageSize", source.pageSize);
  return parts.length ? `?${parts.join("&")}` : "";
}

function buildOaAffairQuery(params: JsonObject = {}): string {
  const source = params && typeof params === "object" ? params : {};
  const parts: string[] = [];
  appendRepeatedQueryPart(parts, "projectId", source.projectId);
  appendRepeatedQueryPart(parts, "userName", source.userName);
  appendRepeatedQueryPart(
    parts,
    "permissions",
    source.permissions || source.permissionKey || source.permission,
  );
  appendRepeatedQueryPart(parts, "pageNum", source.pageNum);
  appendRepeatedQueryPart(parts, "pageSize", source.pageSize);
  return parts.length ? `?${parts.join("&")}` : "";
}

function normalizeImportDataItems(data: unknown): JsonObject[] {
  if (!Array.isArray(data)) return [];
  return (data as unknown[]).map((item) => {
    const source = item && typeof item === "object" ? (item as JsonObject) : {};
    return {
      id: source.id,
      revisedFromId: source.revisedFromId,
      subjectId: source.subjectId,
      vehicleSourceType: safeText(source.vehicleSourceType) || undefined,
      modelName: source.modelName,
      trimName: source.trimName,
      yearAggregateMode: safeText(source.yearAggregateMode) || undefined,
      modelYear: source.modelYear,
      valueType: source.valueType,
      rawValue: source.rawValue,
      numberValue: source.numberValue,
      textValue: source.textValue,
    };
  });
}

function normalizeImportProjectCostsPayload(data: JsonObject = {}): JsonObject {
  const source = data && typeof data === "object" ? data : {};
  const projectId = normalizeProjectId(source.projectId || source.project_id);
  return {
    projectId,
    projectName: safeText(source.projectName),
    valvePoint: safeText(source.valvePoint),
    operatorId: safeText(source.operatorId || source.userId),
    operatorName: safeText(source.operatorName || source.userName),
    importNode: safeText(source.importNode) || undefined,
    dataItems: normalizeImportDataItems(source.dataItems || source.data),
  };
}

// 只提取 /project-costs/subjects 接口实际需要的字段，避免调用方传入整包运行态导致 URL 过长（414）
function normalizeWritableSubjectParams(params: JsonObject = {}): JsonObject {
  const source = params && typeof params === "object" ? params : {};
  const projectId = normalizeProjectId(source.projectId || source.project_id);
  const valvePoint = safeText(source.valvePoint || source.valve) || undefined;
  const userId = safeText(source.userId || source.user) || undefined;
  const subjectDomain = safeText(source.subjectDomain) || undefined;
  return {
    ...(projectId !== undefined ? { projectId } : {}),
    ...(valvePoint ? { valvePoint } : {}),
    ...(userId ? { userId } : {}),
    ...(subjectDomain ? { subjectDomain } : {}),
  };
}

function normalizeSelectableProjectParams(params: JsonObject = {}): JsonObject {
  const source = params && typeof params === "object" ? params : {};
  const keyword = safeText(
    source.keyword || source.projectName || source.modelName || source.factoryName,
  );
  return {
    keyword: keyword || undefined,
    pageNum: source.pageNum,
    pageSize: source.pageSize,
  };
}

// 工作台/主表导入等调用方按若依信封 {code, data} 解析科目树（normalizeSubjectTreeResult、
// filterPermissionTreePayload、main-table-import 的 res.data），而当前 http 的 request()
// 已解包 body.data，此处还原信封避免科目树被解析为空导致「模板科目无法在后端科目树中匹配」。
function wrapEnvelopePayload(payload: unknown): JsonObject {
  return { code: 200, data: payload ?? null };
}

// ============================================================
// 费用科目
// ============================================================

// 查询收益管理科目树
export async function expenseSubjectTree(
  params: JsonObject = {},
  _revenueTraceLabel?: string,
): Promise<JsonObject> {
  const payload = await request({
    baseURL: "",
    url: EXPENSES_TREE_URL,
    method: "get",
    params: normalizeProjectScopedParams(params),
  });
  // 工作台解析器（normalizeSubjectTreeResult 等）按若依信封 {code,data} 解析科目树，
  // 而 request() 已解包 body.data，此处还原信封避免科目树被解析为空。
  return wrapEnvelopePayload(payload);
}

// 新增收益管理科目
export async function addExpenseSubject(data: JsonObject): Promise<JsonObject> {
  return request({ baseURL: "", url: EXPENSES_BASE_URL, method: "post", data });
}

// 修改收益管理科目
export async function updateExpenseSubject(id: string | number, data: JsonObject): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSES_BASE_URL}/${id}`, method: "put", data });
}

// 更新收益管理科目状态
export async function updateExpenseSubjectStatus(
  id: string | number,
  enabled: boolean,
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${EXPENSES_BASE_URL}/${id}/status`,
    method: "put",
    data: { enabled },
  });
}

// 启用收益管理科目
export async function enableExpenseSubject(id: string | number): Promise<JsonObject> {
  return updateExpenseSubjectStatus(id, true);
}

// 作废收益管理科目
export async function disableExpenseSubject(id: string | number): Promise<JsonObject> {
  return updateExpenseSubjectStatus(id, false);
}

// 删除收益管理科目
export async function deleteExpenseSubject(id: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSES_BASE_URL}/${id}`, method: "delete" });
}

// ============================================================
// 公式
// ============================================================

// 查询公式列表
export async function listExpenseSubjectFormulas(params: JsonObject = {}): Promise<JsonObject> {
  return request({ baseURL: "", url: EXPENSE_FORMULA_BASE_URL, method: "get", params });
}

export async function getExpenseSubjectFormula(id: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSE_FORMULA_BASE_URL}/${id}`, method: "get" });
}

export async function createExpenseFormula(data: JsonObject): Promise<JsonObject> {
  return request({ baseURL: "", url: EXPENSE_FORMULA_BASE_URL, method: "post", data });
}

export async function updateExpenseFormula(
  id: string | number,
  data: JsonObject,
): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSE_FORMULA_BASE_URL}/${id}`, method: "put", data });
}

export async function enableExpenseFormula(id: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSE_FORMULA_BASE_URL}/${id}/enable`, method: "put" });
}

export async function disableExpenseFormula(id: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSE_FORMULA_BASE_URL}/${id}/disable`, method: "put" });
}

export async function deleteExpenseFormula(id: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSE_FORMULA_BASE_URL}/${id}`, method: "delete" });
}

// ============================================================
// 模板
// ============================================================

// 查询模板列表
export async function listExpenseTemplates(params: JsonObject = {}): Promise<JsonObject> {
  return request({ baseURL: "", url: EXPENSE_TEMPLATE_BASE_URL, method: "get", params });
}

// 查询模板详情
export async function getExpenseTemplate(id: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSE_TEMPLATE_BASE_URL}/${id}`, method: "get" });
}

// 新增模板
export async function createExpenseTemplate(data: JsonObject): Promise<JsonObject> {
  return request({ baseURL: "", url: EXPENSE_TEMPLATE_BASE_URL, method: "post", data });
}

// 修改模板
export async function updateExpenseTemplate(
  id: string | number,
  data: JsonObject,
): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSE_TEMPLATE_BASE_URL}/${id}`, method: "put", data });
}

// 启用模板
export async function enableExpenseTemplate(id: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSE_TEMPLATE_BASE_URL}/${id}/enable`, method: "put" });
}

// 禁用模板
export async function disableExpenseTemplate(id: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${EXPENSE_TEMPLATE_BASE_URL}/${id}/disable`, method: "put" });
}

// ============================================================
// 科目授权
// ============================================================

// 查询用户项目收益管理科目授权树
export async function getUserExpenseSubjectPermissionTree(
  params: JsonObject = {},
  _revenueTraceLabel?: string,
): Promise<JsonObject> {
  const payload = await request({
    baseURL: "",
    url: EXPENSE_PERMISSION_TREE_URL,
    method: "get",
    params: normalizeProjectScopedParams(params),
  });
  // 同 expenseSubjectTree：还原若依信封 {code,data}，供 normalizeSubjectTreeResult /
  // main-table-import 的 res.data 等信封派调用方解析。
  return wrapEnvelopePayload(payload);
}

// 整批保存用户项目收益管理科目授权
export async function saveUserExpenseSubjectPermissions(data: JsonObject): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: EXPENSE_PERMISSION_BASE_URL,
    method: "post",
    data: normalizeProjectScopedPayload(data),
  });
}

// ============================================================
// 项目成本 - 主表 / 记录
// ============================================================

// 查询当前用户可导入科目树（主表）
export async function getProjectCostWritableSubjects(
  params: JsonObject = {},
  _revenueTraceLabel?: string,
): Promise<JsonObject> {
  const payload = await request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/subjects`,
    method: "get",
    params: normalizeWritableSubjectParams(params),
  });
  // 同 expenseSubjectTree：还原若依信封 {code,data}，供 main-table-import 的 res.data 解析。
  return wrapEnvelopePayload(payload);
}

// 导入项目费用数据（创建 IMPORT 流程）
export async function importProjectCosts(data: JsonObject): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/import-flows`,
    method: "post",
    data: normalizeImportProjectCostsPayload(data),
  });
}

// 删除导入项目费用明细
export async function deleteImportedProjectCostRecords(data: JsonObject): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/import-records`,
    method: "delete",
    data: normalizeProjectScopedPayload(data),
  });
}

// 查询项目费用当前优先记录
export async function getAuthorizedProjectCostRecords(data: JsonObject): Promise<JsonObject> {
  const source = data && typeof data === "object" ? data : {};
  const nodes = normalizeProjectCostNodeList(source.nodes || source.node);
  const payload: JsonObject = {
    ...normalizeProjectScopedPayload(source),
    nodes: nodes.length ? nodes : undefined,
  };
  delete payload.node;
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/records/preferred/query`,
    method: "post",
    headers: { repeatSubmit: false },
    data: payload,
  });
}

// 查询项目费用记录明细
export async function queryProjectCostRecords(
  data: JsonObject,
  _revenueTraceLabel?: string,
): Promise<JsonObject> {
  const source = data && typeof data === "object" ? data : {};
  const nodes = normalizeProjectCostNodeList(source.nodes || source.node);
  const payload: JsonObject = {
    ...normalizeProjectScopedPayload(source),
    nodes: nodes.length ? nodes : undefined,
  };
  delete payload.node;
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/records/query`,
    method: "post",
    headers: { repeatSubmit: false },
    data: payload,
  });
}

// 保存项目费用提交
export async function saveProjectCostSubmit(
  data: JsonObject,
  _revenueTraceLabel?: string,
): Promise<JsonObject> {
  const payload = normalizeProjectScopedPayload(data);
  delete payload.submitterId;
  delete payload.submitterName;
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/submits/save`,
    method: "post",
    data: payload,
  });
}

// S1 已提交记录退回草稿
export async function rejectProjectCostRecordsToDraft(
  data: JsonObject,
  _revenueTraceLabel?: string,
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/records/reject-to-draft`,
    method: "post",
    timeout: REVENUE_PROJECT_COST_WRITE_TIMEOUT_MS,
    data: normalizeProjectScopedPayload(data),
  });
}

// ============================================================
// 评审
// ============================================================

// 查询项目费用评审建议
export async function queryProjectCostReviewSuggestions(
  data: JsonObject,
  _revenueTraceLabel?: string,
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/review-suggestions/query`,
    method: "post",
    headers: { repeatSubmit: false },
    data: normalizeProjectScopedPayload(data),
  });
}

/**
 * 查询阀点各部门评审意见（S8 部门卡片）
 * 后端成功码为 "000"，需通过 acceptSuccessCodes 单独兼容
 */
export async function queryDepartmentSuggestions(
  data: JsonObject = {},
): Promise<JsonObject> {
  const source = data && typeof data === "object" ? data : {};
  return request({
    baseURL: "",
    url: `${REVENUE_API_PREFIX}/api/querySuggestions`,
    method: "post",
    headers: { repeatSubmit: false },
    // 该接口 successResponse 使用 code:"000"
    acceptSuccessCodes: [200, "000"],
    data: {
      projectName: safeText(source.projectName),
      valvePoint: safeText(source.valvePoint || source.valve),
    },
  });
}

// 保存项目费用评审
export async function saveProjectCostReview(data: JsonObject): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/reviews/save`,
    method: "post",
    timeout: REVENUE_PROJECT_COST_WRITE_TIMEOUT_MS,
    data: normalizeProjectScopedPayload(data),
  });
}

// ============================================================
// 流程
// ============================================================

// 查询当前项目费用流程
export async function getCurrentProjectCostFlow(
  params: JsonObject = {},
  _revenueTraceLabel?: string,
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows/current`,
    method: "get",
    params: normalizeProjectScopedParams(params),
  });
}

// 按流程主键查询。填报页 URL 的 id/flowId 应对应 bq_cost_flow.id，避免仅靠默认阀点 G6 去猜。
export async function getProjectCostFlow(
  flowId: string | number,
  _revenueTraceLabel?: string,
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows/${flowId}`,
    method: "get",
    skipErrorToast: true,
  });
}

/** 查询流程最近一次填报保存（action_type=SAVE；不含导入/驳回草稿） */
export async function getProjectCostFlowLastSave(
  flowId: string | number,
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows/${flowId}/last-save`,
    method: "get",
    skipErrorToast: true,
  });
}

// 查询项目费用流程。后端数组参数要求重复传参，这里绕过若依默认 a[0]=x 序列化。
export async function listProjectCostFlows(params: JsonObject = {}): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows${buildProjectCostFlowQuery(params)}`,
    method: "get",
  });
}

/** 查询收益「我的待办」三栏看板 */
export async function listMyTodos(): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/my-todos`,
    method: "get",
  });
}

// 查询新增流程可选项目
export async function listSelectableProjectCostFlowProjects(
  params: JsonObject = {},
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows/selectable-projects`,
    method: "get",
    params: normalizeSelectableProjectParams(params),
  });
}

// 查询项目费用流程日志
export async function getProjectCostFlowLogs(flowId: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${PROJECT_COST_BASE_URL}/flows/${flowId}/logs`, method: "get" });
}

// 创建项目费用流程
export async function createProjectCostFlow(data: JsonObject): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows`,
    method: "post",
    data: normalizeProjectScopedPayload(data),
  });
}

// 执行项目费用流程动作
export async function executeProjectCostFlowAction(
  flowId: string | number,
  data: JsonObject,
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows/${flowId}/actions`,
    method: "post",
    data,
  });
}

// 删除当前项目费用流程节点
export async function deleteProjectCostFlowCurrentNode(
  flowId: string | number,
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_BASE_URL}/flows/${flowId}/current-node`,
    method: "delete",
  });
}

// ============================================================
// OA 通知
// ============================================================

// 查询当前项目下可接收 OA 消息的用户。后端数组参数要求重复传参，这里绕过默认序列化。
export async function listOaProjectUsers(params: JsonObject = {}): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${OA_AFFAIRS_BASE_URL}/project-users${buildOaAffairQuery(params)}`,
    method: "get",
  });
}

// 批量发送多组 OA 消息
export async function sendOaBatchMessages(data: JsonObject): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${OA_AFFAIRS_BASE_URL}/messages/batch`,
    method: "post",
    data,
  });
}

// 标记 OA 通知已办（幂等接口由后端保证重复调用安全）。
export async function markOaNotificationReceived(
  notificationId: string | number,
): Promise<JsonObject> {
  const id = safeText(notificationId);
  if (!id) {
    throw new Error("notificationId 不能为空");
  }

  return request({
    baseURL: "",
    url: `/api/committee/notifications/done/${encodeURIComponent(id)}`,
    method: "post",
  });
}

// ============================================================
// 上会管理
// ============================================================

// 新增上会信息
export async function createProjectCostMeeting(data: JsonObject): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: PROJECT_COST_MEETING_BASE_URL,
    method: "post",
    data: normalizeProjectScopedPayload(data),
  });
}

// 查询上会信息列表。后端数组参数要求重复传参，这里绕过若依默认 a[0]=x 序列化。
export async function listProjectCostMeetings(params: JsonObject = {}): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_MEETING_BASE_URL}${buildProjectCostMeetingQuery(params)}`,
    method: "get",
  });
}

// 查询上会信息详情
export async function getProjectCostMeeting(id: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${PROJECT_COST_MEETING_BASE_URL}/${id}`, method: "get" });
}

// 修改上会信息
export async function updateProjectCostMeeting(
  id: string | number,
  data: JsonObject,
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_MEETING_BASE_URL}/${id}`,
    method: "put",
    data: normalizeProjectScopedPayload(data),
  });
}

// 删除上会信息
export async function deleteProjectCostMeeting(id: string | number): Promise<JsonObject> {
  return request({ baseURL: "", url: `${PROJECT_COST_MEETING_BASE_URL}/${id}`, method: "delete" });
}

// 发起上会评审（当前项目扩展接口）
export async function startMeetingReview(
  id: string | number,
  data: JsonObject,
): Promise<JsonObject> {
  return request({
    baseURL: "",
    url: `${PROJECT_COST_MEETING_BASE_URL}/${id}/review`,
    method: "post",
    data: normalizeProjectScopedPayload(data),
  });
}

// ============================================================
// 兼容命名（Vue3 迁移后的页面沿用）
// ============================================================

/** @deprecated 请使用 listProjectCostMeetings */
export const listMeetings = listProjectCostMeetings;
/** @deprecated 请使用 createProjectCostMeeting */
export const createMeeting = createProjectCostMeeting;
/** @deprecated 请使用 updateProjectCostMeeting */
export const updateMeeting = updateProjectCostMeeting;
/** @deprecated 请使用 deleteProjectCostMeeting */
export const deleteMeeting = deleteProjectCostMeeting;
