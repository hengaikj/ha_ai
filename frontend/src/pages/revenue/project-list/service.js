import {
  getRevenueProjectList as getRevenueProjectListApi,
  postRevenueProjectListAction as postRevenueProjectListActionApi,
} from "@/api/revenue/projectList";
import {
  createProjectCostFlow,
  deleteProjectCostFlowCurrentNode,
  executeProjectCostFlowAction,
  listProjectCostFlows,
} from "@/api/system/expenses";

const FLOW_STAGE_CODES = Object.freeze(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);
const NODE_STATUS_ALIAS_MAP = Object.freeze({
  IN_PROGRESS: Object.freeze(["IN_PROGRESS", "PROCESSING", "RUNNING"]),
  PROCESSING: Object.freeze(["IN_PROGRESS", "PROCESSING", "RUNNING"]),
  RUNNING: Object.freeze(["IN_PROGRESS", "PROCESSING", "RUNNING"]),
  FINISHED: Object.freeze(["FINISHED", "COMPLETED", "DONE", "SUCCESS"]),
  COMPLETED: Object.freeze(["FINISHED", "COMPLETED", "DONE", "SUCCESS"]),
  DONE: Object.freeze(["FINISHED", "COMPLETED", "DONE", "SUCCESS"]),
  SUCCESS: Object.freeze(["FINISHED", "COMPLETED", "DONE", "SUCCESS"]),
  VOIDED: Object.freeze(["VOIDED"]),
});

function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function normalizeFlowStageCode(value, fallback = "S1") {
  const raw = safeText(value, fallback).toUpperCase();
  const hit = raw.match(/^S([1-8])(?=$|[^0-9])/);
  const code = hit ? `S${hit[1]}` : raw;
  return FLOW_STAGE_CODES.includes(code) ? code : fallback;
}

function normalizeNodeStatusInputList(value) {
  return (Array.isArray(value)
    ? value
    : safeText(value)
      ? safeText(value).split(/[,，\s]+/)
      : [])
    .map((item) => safeText(item).toUpperCase())
    .filter((item, index, array) => item && array.indexOf(item) === index);
}

function normalizeNodeStatusList(value) {
  const sourceList = normalizeNodeStatusInputList(value);
  const result = [];
  sourceList
    .forEach((item) => {
      const aliases = NODE_STATUS_ALIAS_MAP[item] || [item];
      aliases.forEach((alias) => {
        if (alias && !result.includes(alias)) result.push(alias);
      });
    });
  return result;
}

function normalizeNodeStatusParam(value) {
  return normalizeNodeStatusInputList(value)[0] || "";
}

function matchesNodeStatusFilter(rowStatus, filterValue) {
  const list = normalizeNodeStatusList(filterValue);
  if (!list.length) return true;
  return list.includes(safeText(rowStatus).toUpperCase());
}

function isVoidedNodeStatus(value) {
  return safeText(value).toUpperCase() === "VOIDED";
}

function resolveNodeStatusRequestParam(ctx = {}) {
  const nodeStatus = normalizeNodeStatusParam(ctx.nodeStatus);
  if (!nodeStatus) return undefined;
  if (!ctx.includeVoidedProjects && isVoidedNodeStatus(nodeStatus)) return undefined;
  return nodeStatus;
}

function filterVisibleFlowRows(rows = [], query = {}) {
  if (query.includeVoidedProjects) return rows;
  return rows.filter((item) => !isVoidedNodeStatus(item && item.nodeStatus));
}

function unwrapBizPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (payload.data && typeof payload.data === "object") return payload.data;
  return payload;
}

function resolveFlowNodeTagType(nodeStatus) {
  const status = safeText(nodeStatus).toUpperCase();
  if (["COMPLETED", "DONE", "FINISHED", "SUCCESS"].includes(status)) return "success";
  if (["PROCESSING", "IN_PROGRESS", "RUNNING"].includes(status)) return "warning";
  if (["VOIDED", "REJECTED", "FAILED"].includes(status)) return "danger";
  return "info";
}

function normalizeListParams(params = {}) {
  return {
    ...params,
    keyword: safeText(params.keyword),
    stage: safeText(params.stage),
    nodeStatus: normalizeNodeStatusParam(params.nodeStatus),
    valvePoint: normalizeTextList(params.valvePoint || params.valvePoints),
    pageNum: Number(params.pageNum) > 0 ? Number(params.pageNum) : 1,
    pageSize: Number(params.pageSize) > 0 ? Number(params.pageSize) : 10,
    menuKey: safeText(params.menuKey),
    useProjectFlowList: Boolean(params.useProjectFlowList),
    includeVoidedProjects: params.includeVoidedProjects !== false,
  };
}

function normalizeTextList(value) {
  const sourceList = Array.isArray(value)
    ? value
    : safeText(value)
      ? safeText(value).split(/[,，\s]+/)
      : [];
  return sourceList
    .map((item) => safeText(item))
    .filter((item, index, array) => item && array.indexOf(item) === index);
}

function includesKeyword(row, keyword) {
  const query = safeText(keyword).toLowerCase();
  if (!query) return true;
  const text = [
    row.projectNo,
    row.projectCode,
    row.projectName,
    row.project,
    row.valve,
    row.stage,
    row.meetingDate,
    row.stageLabel,
  ]
    .map((item) => safeText(item).toLowerCase())
    .join("|");
  return text.includes(query);
}

function normalizeIntegerId(value) {
  const text = safeText(value);
  return /^\d+$/.test(text) ? text : "";
}

function normalizeFlowRow(row = {}, index = 0) {
  const projectId = normalizeIntegerId(row.projectId);
  const projectCode = safeText(row.projectCode || row.projectNo || row.wbsNumber);
  const projectLabel = safeText(row.projectName || projectCode || projectId, `流程${index + 1}`);
  const stage = normalizeFlowStageCode(row.node || row.stageCode || row.stage, "S1");
  const flowId = row.id != null ? row.id : `flow_${index + 1}`;
  return {
    ...row,
    id: flowId,
    flowId,
    projectId,
    projectNo: projectCode,
    projectCode,
    projectName: projectLabel,
    project: projectLabel,
    valve: safeText(row.valvePoint),
    valvePoint: safeText(row.valvePoint),
    nodeStatus: safeText(row.nodeStatus).toUpperCase(),
    stage,
    stageCode: stage,
    stageLabel: stage,
    stageTagType: resolveFlowNodeTagType(row.nodeStatus),
    meetingDate: safeText(row.updatedAt || row.createdAt),
    readonly: Boolean(row.readonly),
    actions: [{ key: "open_flow", label: "进入流程管理", primary: true }],
  };
}

function normalizeFlowListPayload(payload, query = {}) {
  const hasPagedRows = Array.isArray(payload && payload.rows);
  const sourceRows = hasPagedRows
    ? payload.rows
    : Array.isArray(payload && payload.data)
      ? payload.data
      : [];
  const normalized = sourceRows.map((item, index) => normalizeFlowRow(item, index));
  if (hasPagedRows) {
    const visibleRows = filterVisibleFlowRows(normalized, query);
    return {
      rows: visibleRows,
      total: Number(payload && payload.total) || 0,
      source: "project-cost-flows",
    };
  }
  const stage = safeText(query.stage).toUpperCase();
  const keyword = safeText(query.keyword);
  const filtered = normalized
    .filter((item) => query.includeVoidedProjects || !isVoidedNodeStatus(item && item.nodeStatus))
    .filter((item) => !stage || safeText(item.stageCode || item.stage).toUpperCase() === stage)
    .filter((item) => matchesNodeStatusFilter(item.nodeStatus, query.nodeStatus))
    .filter((item) => includesKeyword(item, keyword));
  return {
    rows: filtered,
    total: filtered.length,
    source: "project-cost-flows",
  };
}

function normalizeCreatedFlowPayload(payload) {
  const data = unwrapBizPayload(payload) || payload || {};
  return normalizeFlowRow(data, 0);
}

function normalizeFallbackRow(row = {}, index = 0) {
  const projectNo = safeText(row.projectNo || row.projectCode || row.wbsNumber || row.id, `P${index + 1}`);
  const stage = safeText(row.stageCode || row.stage, "S1");
  const meetingDate = safeText(row.meetingDate || row.meetingTime || row.updateTime || row.createTime);
  const projectId = normalizeIntegerId(row.projectId || row.id);
  return {
    ...row,
    id: row.id || row.projectId || row.projectCode || `fallback_${index + 1}`,
    projectId,
    projectNo,
    projectCode: safeText(row.projectCode, projectNo),
    valve: safeText(row.valve || row.currentValve || row.currentValvePoint || row.valvePoint),
    stage,
    stageCode: safeText(row.stageCode, stage),
    stageLabel: safeText(row.stageLabel, stage),
    stageTagType: safeText(row.stageTagType, "info"),
    meetingDate,
    readonly: Boolean(row.readonly),
    actions: Array.isArray(row.actions) && row.actions.length
      ? row.actions
      : [{ key: "view", label: "查看", primary: false }],
  };
}

function normalizeFallbackListPayload(payload, query = {}) {
  const rows = Array.isArray(payload && payload.rows) ? payload.rows : [];
  const normalized = rows.map((item, index) => normalizeFallbackRow(item, index));
  const stage = safeText(query.stage);
  const keyword = safeText(query.keyword);
  const filtered = normalized
    .filter((item) => !stage || safeText(item.stageCode || item.stage) === stage)
    .filter((item) => includesKeyword(item, keyword));
  return {
    rows: filtered,
    total: filtered.length,
    source: "system-project-list-fallback",
  };
}

function normalizeActionParams(params = {}) {
  const projectNo = safeText(params.projectNo || params.projectCode);
  return {
    ...params,
    projectNo,
    projectCode: safeText(params.projectCode, projectNo),
    stageCode: safeText(params.stageCode || params.stage),
    actionKey: safeText(params.actionKey || params.action),
    permissionKey: safeText(params.permissionKey || params.actionPermission || params.permission),
    userId: safeText(params.userId || params.user),
    menuKey: safeText(params.menuKey),
  };
}

export async function fetchRevenueProjectList(params = {}) {
  const ctx = normalizeListParams(params);
  if (ctx.useProjectFlowList || ctx.menuKey === "project_list") {
    const payload = await listProjectCostFlows({
      pageNum: ctx.pageNum,
      pageSize: ctx.pageSize,
      valvePoint: ctx.valvePoint,
      projectName: ctx.keyword || undefined,
      flowType: "NORMAL",
      node: ctx.stage || undefined,
      nodeStatus: resolveNodeStatusRequestParam(ctx),
    });
    return normalizeFlowListPayload(payload, ctx);
  }
  const payload = await getRevenueProjectListApi({
    modelName: ctx.keyword,
    pageNum: 1,
    pageSize: 500,
  });
  return normalizeFallbackListPayload(payload, ctx);
}

export async function submitRevenueProjectListAction(params = {}) {
  const ctx = normalizeActionParams(params);
  if (!ctx.userId) {
    return {
      ok: false,
      message: "缺少当前登录用户，无法执行操作",
    };
  }
  const payload = await postRevenueProjectListActionApi({
    projectNo: ctx.projectNo,
    projectCode: ctx.projectCode,
    stageCode: ctx.stageCode,
    actionKey: ctx.actionKey,
    permissionKey: ctx.permissionKey,
    userId: ctx.userId,
    menuKey: ctx.menuKey,
  });
  return unwrapBizPayload(payload);
}

export async function createRevenueProjectFlow(params = {}) {
  const projectId = normalizeIntegerId(params.projectId);
  const projectNo = safeText(params.projectNo);
  const projectName = safeText(params.projectName);
  const valvePoint = safeText(params.valvePoint || params.valve);
  const creatorId = safeText(params.creatorId || params.userId);
  const creatorName = safeText(params.creatorName || params.userName);
  const templateId = normalizeIntegerId(params.templateId);
  const node = normalizeFlowStageCode(params.node || params.stage || params.stageCode, "S1");
  if (!projectId) {
    throw new Error("缺少项目 ID，无法创建收益流程");
  }
  if (!templateId) {
    throw new Error("缺少收益科目模板，无法创建收益流程");
  }

  const payload = await createProjectCostFlow({
    projectId,
    projectName,
    projectNo,
    valvePoint,
    templateId,
    node,
    creatorId,
    creatorName,
  });

  return normalizeCreatedFlowPayload(payload);
}

export async function voidRevenueProjectFlow(params = {}) {
  const flowId = normalizeIntegerId(params.flowId || params.id);
  const targetNode = normalizeFlowStageCode(
    params.targetNode || params.node || params.stage || params.stageCode,
    ""
  );
  const operatorId = safeText(params.operatorId || params.userId);
  const operatorName = safeText(params.operatorName || params.userName, operatorId);

  if (!flowId) {
    return {
      ok: false,
      message: "缺少流程 ID，无法作废当前流程",
    };
  }
  if (!targetNode) {
    return {
      ok: false,
      message: "缺少当前节点，无法作废当前流程",
    };
  }
  if (!operatorId) {
    return {
      ok: false,
      message: "缺少当前登录用户，无法作废当前流程",
    };
  }

  const payload = await executeProjectCostFlowAction(flowId, {
    action: safeText(params.action, "VOID"),
    targetNode,
    targetNodeStatus: "VOIDED",
    operatorId,
    operatorName,
    actionRemark: safeText(params.actionRemark, "项目列表作废当前流程"),
    secondTriggerRequired: false,
  });
  const data = unwrapBizPayload(payload) || {};
  return {
    ok: data.nodeUpdated !== false,
    message: data.nodeUpdated === false ? "作废请求已提交，等待确认" : "作废成功",
    flow: normalizeFlowRow(data, 0),
    raw: data,
  };
}

export async function rollbackRevenueProjectFlowCurrentNode(params = {}) {
  const flowId = normalizeIntegerId(params.flowId || params.id);
  if (!flowId) {
    return {
      ok: false,
      message: "缺少流程 ID，无法回退当前节点",
    };
  }
  const payload = await deleteProjectCostFlowCurrentNode(flowId);
  const data = unwrapBizPayload(payload) || payload || {};
  return {
    ok: true,
    message: safeText(data.message, "回退成功"),
    flow: data && typeof data === "object" ? normalizeFlowRow(data, 0) : null,
    raw: data,
  };
}
