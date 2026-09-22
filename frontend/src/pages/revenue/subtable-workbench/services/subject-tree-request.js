import {
  expenseSubjectTree as expenseSubjectTreeApi,
  getUserExpenseSubjectPermissionTree as getUserExpenseSubjectPermissionTreeApi,
} from "@/api/system/expenses";
import { ensureProjectCostFlow } from "./flow-context";
import {
  filterPermissionTreePayload,
  isFullTemplateSubjectScope,
  normalizeSubjectTreeForDomain,
  normalizeSubjectTreeResult,
} from "./subject-tree";
import { applyTemplateSubjectScope } from "./template-scope";
import { hasFullSubjectScope } from "./workbench-permissions";
import { buildRevenueTraceLabel, safeText } from "./workbench-utils";

const SUBJECT_PERMISSION_TREE_CACHE_TTL_MS = 30 * 1000;
const subjectPermissionTreeRequestCache = new Map();
const fullTemplateSubjectTreeRequestCache = new Map();

async function requestSubjectTree(apiFn, params = {}, options = {}) {
  const { permissionFilter = false, traceLabel = "" } = options;
  const payload = await apiFn(params, traceLabel);
  if (permissionFilter) {
    return filterPermissionTreePayload(payload);
  }
  return normalizeSubjectTreeResult(payload);
}

function buildSubjectPermissionTreeRequestParams(params = {}) {
  const requestParams = {
    projectId: params.projectId,
  };
  const userId = safeText(params.userId);
  if (userId) {
    requestParams.userId = userId;
  }
  return requestParams;
}

function buildSubjectPermissionTreeCacheKey(params = {}) {
  const requestParams = buildSubjectPermissionTreeRequestParams(params);
  return [
    safeText(requestParams.projectId),
    safeText(requestParams.userId),
  ].join("__");
}

async function requestCachedAllSubjectPermissionTree(params = {}) {
  const requestParams = buildSubjectPermissionTreeRequestParams(params);
  const cacheKey = buildSubjectPermissionTreeCacheKey(requestParams);
  const now = Date.now();
  const cached = subjectPermissionTreeRequestCache.get(cacheKey);
  if (cached && now - cached.createdAt <= SUBJECT_PERMISSION_TREE_CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = requestSubjectTree(getUserExpenseSubjectPermissionTreeApi, requestParams, {
    traceLabel: buildRevenueTraceLabel(
      params,
      "科目树: 全量权限 user-period-expense-subject-permissions/tree"
    ),
  }).catch((error) => {
    subjectPermissionTreeRequestCache.delete(cacheKey);
    throw error;
  });
  subjectPermissionTreeRequestCache.set(cacheKey, {
    createdAt: now,
    promise,
  });
  return promise;
}

export async function requestStrictPermissionTree(params = {}) {
  return filterPermissionTreePayload(
    await requestAllSubjectTreeWithPermissionStatus(params)
  );
}

export async function requestAllSubjectTreeWithPermissionStatus(params = {}) {
  try {
    return await requestCachedAllSubjectPermissionTree(params);
  } catch (error) {
    const message = (error && error.message) || "全量权限科目树加载失败";
    throw new Error(`全量权限科目树加载失败：${message}`, { cause: error });
  }
}

async function requestCachedFullTemplateSubjectTree(params = {}) {
  const projectId = params.projectId;
  const cacheKey = safeText(projectId);
  const now = Date.now();
  const cached = fullTemplateSubjectTreeRequestCache.get(cacheKey);
  if (cached && now - cached.createdAt <= SUBJECT_PERMISSION_TREE_CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = requestSubjectTree(expenseSubjectTreeApi, { projectId }, {
    traceLabel: buildRevenueTraceLabel(
      params,
      "科目树: 模板全量 period-expense-subjects/tree"
    ),
  }).catch((error) => {
    fullTemplateSubjectTreeRequestCache.delete(cacheKey);
    throw error;
  });
  fullTemplateSubjectTreeRequestCache.set(cacheKey, {
    createdAt: now,
    promise,
  });
  return promise;
}

// 提交/主表生成/公式来源等系统级计算：必须按「科目模板全集」组装页面树，
// 不能复用按当前用户裁剪的授权树，否则会因当前用户未被授权的来源科目（如销量、MIX、
// 设计成本等）在树中缺失而抛「模板科目无法在后端科目树中匹配」。
export async function requestFullTemplateSubjectTree(params = {}) {
  try {
    return await requestCachedFullTemplateSubjectTree(params);
  } catch (error) {
    const message = (error && error.message) || "模板全量科目树加载失败";
    throw new Error(`模板全量科目树加载失败：${message}`, { cause: error });
  }
}

/** 清理科目树请求缓存（避免 HMR/中断后命中未完成的 Promise 导致页面一直加载） */
export function clearSubjectTreeRequestCaches() {
  subjectPermissionTreeRequestCache.clear();
  fullTemplateSubjectTreeRequestCache.clear();
}

export async function requestSubjectTreePreferPermission(params = {}) {
  const flowSnapshot = await ensureProjectCostFlow(params, { createIfMissing: false });
  const useTemplateScope = isFullTemplateSubjectScope(params);
  const subjectTreePayload = useTemplateScope
    ? await requestFullTemplateSubjectTree(params)
    : await requestAllSubjectTreeWithPermissionStatus(params);
  const templatePayload = normalizeSubjectTreeForDomain(
    subjectTreePayload,
    params
  );
  return applyTemplateSubjectScope(templatePayload, flowSnapshot, {
    adminScope: hasFullSubjectScope(params),
    stage: params.stageCode || params.stage,
    subjectDomain: params.subjectDomain,
    subjectApiMode: params.subjectApiMode,
    fullSubjectTreePayload: subjectTreePayload,
  });
}
