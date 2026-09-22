import {
  getCurrentProjectCostFlow as getCurrentProjectCostFlowApi,
  getExpenseTemplate as getExpenseTemplateApi,
  getProjectCostFlow as getProjectCostFlowApi,
  listProjectCostFlows as listProjectCostFlowsApi,
} from "@/api/system/expenses";
import { normalizeStageCode } from "../domain-config";
import { normalizeBackendEntryMode } from "./template-scope";
import {
  buildRevenueTraceLabel,
  hasProjectId,
  parseListPayload,
  safeText,
  toMaybeLong,
  unwrapBizPayload,
} from "./workbench-utils";

const FLOW_CACHE = {};
const templateDetailRequestCache = new Map();
const PROJECT_COST_FLOW_LOOKUP_PAGE_SIZE = 200;

function buildFlowCacheKey(ctx) {
  return `${ctx.projectId || "no-project"}__${ctx.valve}__${ctx.flowId || "auto"}`;
}

function normalizeFlowItem(item = {}, fallbackStage = "S1") {
  const flowId = toMaybeLong(item.id || item.flowId);
  const templateId = toMaybeLong(item.templateId || item.template_id);
  return {
    ...item,
    flowId,
    id: flowId,
    templateId,
    node: safeText(item.node, fallbackStage),
    nodeStatus: safeText(item.nodeStatus),
    valvePoint: safeText(item.valvePoint),
    updatedAt: safeText(item.updatedAt || item.createdAt),
  };
}

function isFlowCompatibleWithContext(flow = {}, ctx = {}) {
  // URL 明确带了流程 ID 时，以该条流程为准，不再被默认阀点 G6 误伤
  if (ctx.flowId != null && Number(flow.flowId) === Number(ctx.flowId)) {
    return true;
  }
  const ctxValve = safeText(ctx.valve);
  const flowValve = safeText(flow.valvePoint || flow.valve);
  return !ctxValve || !flowValve || ctxValve === flowValve;
}

function pickExplicitFlow(ctx, rows = []) {
  if (ctx.flowId == null) return null;
  return (Array.isArray(rows) ? rows : [])
    .map((item) => normalizeFlowItem(item, ctx.stage))
    .find((item) =>
      item.flowId != null &&
      Number(item.flowId) === Number(ctx.flowId) &&
      isFlowCompatibleWithContext(item, ctx)
    ) || null;
}

function flowSortWeight(flow, ctx) {
  const sameNode = safeText(flow.node).toUpperCase() === safeText(ctx.stage).toUpperCase() ? 10 : 0;
  const sameValve = !ctx.valve || safeText(flow.valvePoint) === safeText(ctx.valve) ? 5 : 0;
  const updatedScore = Date.parse(flow.updatedAt || "") || 0;
  const idScore = Number(flow.flowId || flow.id || 0) || 0;
  return sameNode * 10000000000000 + sameValve * 1000000000000 + updatedScore + idScore;
}

function pickBestFlow(ctx, rows = []) {
  const list = (Array.isArray(rows) ? rows : [])
    .map((item) => normalizeFlowItem(item, ctx.stage))
    .filter((item) => item.flowId != null);
  if (!list.length) return null;
  if (ctx.flowId != null) {
    const explicit = list.find((item) => Number(item.flowId) === Number(ctx.flowId));
    if (explicit) return explicit;
  }
  list.sort((a, b) => flowSortWeight(b, ctx) - flowSortWeight(a, ctx));
  return list[0];
}

async function listProjectCostFlowRows(ctx, options = {}) {
  if (!hasProjectId(ctx)) return [];
  const payload = await listProjectCostFlowsApi({
    projectId: ctx.projectId,
    valvePoint: options.includeValve === false ? undefined : (ctx.valve || undefined),
    pageSize: PROJECT_COST_FLOW_LOOKUP_PAGE_SIZE,
  });
  return parseListPayload(payload);
}

async function findExplicitProjectCostFlow(ctx) {
  if (ctx.flowId == null || !hasProjectId(ctx)) return null;
  const scopedRows = await listProjectCostFlowRows(ctx);
  const scopedFlow = pickExplicitFlow(ctx, scopedRows);
  if (scopedFlow) return scopedFlow;
  if (!ctx.valve) return null;
  const allRows = await listProjectCostFlowRows(ctx, { includeValve: false });
  return pickExplicitFlow(ctx, allRows);
}

async function getCurrentProjectCostFlowSnapshot(ctx) {
  if (!hasProjectId(ctx)) return null;
  const payload = await getCurrentProjectCostFlowApi({
    projectId: ctx.projectId,
    valvePoint: ctx.valve || undefined,
  }, buildRevenueTraceLabel(ctx, "查询当前流程"));
  const data = unwrapBizPayload(payload);
  if (!data || typeof data !== "object") return null;
  return normalizeFlowItem(data, ctx.stage);
}

async function findFlowByIdSnapshot(ctx) {
  if (ctx.flowId == null) return null;
  try {
    const payload = await getProjectCostFlowApi(
      ctx.flowId,
      buildRevenueTraceLabel(ctx, "按流程ID查询")
    );
    const data = unwrapBizPayload(payload);
    if (!data || typeof data !== "object") return null;
    const flow = normalizeFlowItem(data, ctx.stage);
    return flow.flowId != null ? flow : null;
  } catch (_error) {
    return null;
  }
}

function parseTemplateParamBindings(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

async function enrichTemplateFormulaExpressions(template = {}) {
  const items = Array.isArray(template.items) ? template.items : [];
  const calculatedItems = items.filter((item) => safeText(item && item.entryMode).toUpperCase() === "CALCULATED");
  const missingExpressionItems = calculatedItems.filter((item) => !safeText(item.formulaExpression));
  if (!missingExpressionItems.length) return template;
  const enrichedItems = items.map((item) => {
    if (safeText(item && item.entryMode).toUpperCase() !== "CALCULATED") return item;
    const formulaExpression = safeText(item.formulaExpression);
    if (!formulaExpression) {
      throw new Error(
        `计算型模板科目缺少公式表达式：subjectId=${item.subjectId}，请后端模板接口返回 formulaExpression`
      );
    }
    return {
      ...item,
      formulaCode: safeText(item.formulaCode),
      formulaName: safeText(item.formulaName),
      formulaExpression,
    };
  });
  return {
    ...template,
    items: enrichedItems,
    itemBySubjectId: enrichedItems.reduce((map, item) => {
      if (item.subjectId != null) map[String(item.subjectId)] = item;
      return map;
    }, {}),
  };
}

function assertTemplateCalculatedFormulaItem(item = {}, subjectId) {
  if (item.formulaId == null && !safeText(item.formulaCode)) {
    throw new Error(`计算型模板科目缺少公式配置：subjectId=${subjectId}`);
  }
  if (!Array.isArray(item.formulaParamBindings) || !item.formulaParamBindings.length) {
    throw new Error(`计算型模板科目缺少公式参数绑定：subjectId=${subjectId}`);
  }
}

function normalizeTemplateItem(item = {}) {
  const subjectId = toMaybeLong(item.subjectId);
  if (subjectId == null) {
    throw new Error(`模板科目缺少 subjectId：itemId=${safeText(item.id || item.templateItemId, "-")}`);
  }
  const entryMode = normalizeBackendEntryMode(item.entryMode, `模板科目录入模式缺失：subjectId=${subjectId}`);
  const normalized = {
    ...item,
    id: toMaybeLong(item.id),
    templateId: toMaybeLong(item.templateId),
    subjectId,
    entryMode,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
    formulaId: toMaybeLong(item.formulaId),
    formulaCode: safeText(item.formulaCode),
    formulaName: safeText(item.formulaName),
    formulaExpression: safeText(item.formulaExpression || item.formula_expression || item.expression),
    formulaParamBindings: parseTemplateParamBindings(item.formulaParamBindings),
  };
  if (entryMode === "CALCULATED") {
    assertTemplateCalculatedFormulaItem(normalized, subjectId);
  }
  return normalized;
}

function normalizeTemplateDetail(payload) {
  const data = unwrapBizPayload(payload);
  if (!data || typeof data !== "object") return null;
  const items = Array.isArray(data.items) ? data.items.map(normalizeTemplateItem) : [];
  return {
    ...data,
    id: toMaybeLong(data.id),
    templateId: toMaybeLong(data.id || data.templateId),
    templateCode: safeText(data.templateCode),
    templateName: safeText(data.templateName),
    status: safeText(data.status),
    versionNo: data.versionNo,
    items,
    itemSubjectIdSet: new Set(items.map((item) => item.subjectId).filter((id) => id != null)),
    itemBySubjectId: items.reduce((map, item) => {
      if (item.subjectId != null) map[String(item.subjectId)] = item;
      return map;
    }, {}),
  };
}

async function loadExpenseTemplateDetail(templateId, _ctx = {}) {
  const id = toMaybeLong(templateId);
  if (id == null) {
    throw new Error("当前收益流程未绑定科目模板，无法打开工作台");
  }
  const cacheKey = String(id);
  if (!templateDetailRequestCache.has(cacheKey)) {
    const promise = getExpenseTemplateApi(id)
      .then(normalizeTemplateDetail)
      .then(enrichTemplateFormulaExpressions)
      .then((template) => {
        if (!template || template.templateId == null) {
          throw new Error(`科目模板不存在或响应为空：${id}`);
        }
        if (!Array.isArray(template.items) || !template.items.length) {
          throw new Error(`科目模板未配置科目：${id}`);
        }
        return template;
      })
      .catch((error) => {
        templateDetailRequestCache.delete(cacheKey);
        throw error;
      });
    templateDetailRequestCache.set(cacheKey, promise);
  }
  return templateDetailRequestCache.get(cacheKey);
}

async function attachTemplateToFlowSnapshot(snapshot, ctx = {}) {
  const templateId = toMaybeLong(
    snapshot && (snapshot.templateId || snapshot.template_id || ctx.templateId)
  );
  if (templateId == null) {
    throw new Error("当前收益流程未绑定科目模板，无法打开工作台");
  }
  const template = await loadExpenseTemplateDetail(templateId, ctx);

  // 诊断：输出模板中主表相关科目的 entryMode
  const mainPnlItems = (template.items || []).filter((item) => {
    const name = safeText(item.subjectName || item.name);
    return name && (name === "MIX" || name === "销售收入" || name === "消费税金及附加");
  });
  if (mainPnlItems.length) {
    console.groupCollapsed("[模板诊断] 模板详情API返回的主表科目");
    console.log("模板ID:", templateId, "模板名称:", template.templateName);
    mainPnlItems.forEach((item) => {
      console.log("  subjectId:", item.subjectId,
        "| subjectName:", item.subjectName,
        "| entryMode:", item.entryMode,
        "| formulaId:", item.formulaId,
        "| formulaExpression:", item.formulaExpression,
        "| formulaParamBindings:", Array.isArray(item.formulaParamBindings) ? item.formulaParamBindings.length + "项" : "非数组");
    });
    console.groupEnd();
  }

  return {
    ...snapshot,
    templateId,
    template,
    templateItems: template.items,
    templateItemBySubjectId: template.itemBySubjectId,
    templateSubjectIds: template.items.map((item) => item.subjectId).filter((id) => id != null),
  };
}

export async function ensureProjectCostFlow(ctx, options = {}) {
  const { forceRefresh = false } = options;
  const cacheKey = buildFlowCacheKey(ctx);
  if (
    !forceRefresh &&
    FLOW_CACHE[cacheKey] &&
    FLOW_CACHE[cacheKey].flowId != null &&
    FLOW_CACHE[cacheKey].templateId != null
  ) {
    return FLOW_CACHE[cacheKey];
  }

  let flow;
  try {
    // 优先按 URL 流程主键直查，避免列表阀点过滤把刚启动的 G7/G8 流程漏掉
    flow = await findFlowByIdSnapshot(ctx);
    if (!flow) {
      flow = await findExplicitProjectCostFlow(ctx);
    }
    if (!flow) {
      flow = await getCurrentProjectCostFlowSnapshot(ctx);
    }
    if (!flow && ctx.valve) {
      flow = await getCurrentProjectCostFlowSnapshot({ ...ctx, valve: "" });
    }
    if (!flow && ctx.flowId != null) {
      const rows = await listProjectCostFlowRows(ctx, { includeValve: false });
      flow = pickBestFlow(ctx, rows);
    }
  } catch (error) {
    throw new Error(`当前收益流程查询失败：${safeText(error && error.message, "未知错误")}`, { cause: error });
  }

  if (!flow) {
    throw new Error("未找到当前项目收益流程，请先绑定科目模板并创建流程");
  }
  const snapshot = await attachTemplateToFlowSnapshot(flow, ctx);
  FLOW_CACHE[cacheKey] = snapshot;
  return snapshot;
}

export function rememberProjectCostFlowSnapshot(ctx, flowSnapshot) {
  if (!flowSnapshot || typeof flowSnapshot !== "object") return;
  FLOW_CACHE[buildFlowCacheKey(ctx)] = flowSnapshot;
}

export function normalizeFlowActionResult(payload, fallback = {}) {
  const data = unwrapBizPayload(payload) || {};
  const triggerCount = Number(data.triggerCount);
  const previousNode = normalizeStageCode(
    fallback.node || fallback.stage || "",
  );
  const responseNode = normalizeStageCode(
    data.node || fallback.node || fallback.stage || "S1",
  );
  let nodeUpdated =
    data.nodeUpdated === true ||
    safeText(data.nodeUpdated).toLowerCase() === "true";
  // 兼容后端偶发未回写 nodeUpdated：响应节点已相对提交前前进，则视为流转成功
  if (
    !nodeUpdated &&
    previousNode &&
    responseNode &&
    responseNode !== previousNode
  ) {
    nodeUpdated = true;
  }
  return {
    flowId: toMaybeLong(data.id || data.flowId || fallback.flowId),
    node: responseNode,
    nodeStatus: safeText(data.nodeStatus || fallback.nodeStatus),
    triggerCount: Number.isFinite(triggerCount) ? triggerCount : null,
    nodeUpdated,
    raw: data,
  };
}

export function shouldNotifyFlowActionTargets(flowAction = {}) {
  if (!flowAction.nodeUpdated) return false;
  return Number(flowAction.triggerCount) === 2;
}

export function clearProjectCostFlowCache() {
  Object.keys(FLOW_CACHE).forEach((key) => delete FLOW_CACHE[key]);
  templateDetailRequestCache.clear();
}
