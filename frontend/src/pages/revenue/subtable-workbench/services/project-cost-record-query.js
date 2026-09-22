import {
  queryProjectCostRecords as queryProjectCostRecordsApi,
} from "@/api/system/expenses";
import {
  getAuditContextCache,
} from "./audit-context-cache";
import {
  filterRecordsBySubjectIds,
  normalizeRecordStatus,
} from "./record-utils";
import {
  buildSubjectIdFilterFromTree,
} from "./subject-tree";
import {
  requestSubjectTreePreferPermission,
} from "./subject-tree-request";
import {
  normalizeStageNodeList,
  resolveSubmittedValueSourceNodes,
} from "./stage-labels";
import {
  buildRevenueTraceLabel,
  hasProjectId,
  normalizeSubjectIdFilterList,
  parseListPayload,
  safeText,
  toMaybeLong,
} from "./workbench-utils";

const PROJECT_COST_RECORD_SUBJECT_BATCH_SIZE = 50;

export function collectAuditContextSubjectIds(ctx = {}) {
  const cache = getAuditContextCache(ctx);
  return Object.keys((cache && cache.rowBySubjectId) || {})
    .map((item) => toMaybeLong(item))
    .filter((item, index, list) => item != null && list.indexOf(item) === index);
}

export function resolveRecordQuerySubjectIds(ctx = {}, explicitSubjectIds) {
  const explicitIds = normalizeSubjectIdFilterList(explicitSubjectIds);
  if (explicitIds.length) return explicitIds;
  const ctxSubjectIds = normalizeSubjectIdFilterList(ctx.subjectIds);
  if (ctxSubjectIds.length) return ctxSubjectIds;
  return collectAuditContextSubjectIds(ctx);
}

export async function resolveMainTableRecordSubjectIds(ctx = {}) {
  const scopedIds = resolveRecordQuerySubjectIds(ctx, ctx.subjectIds);
  if (scopedIds.length) return scopedIds;
  try {
    const subjectTreePayload = await requestSubjectTreePreferPermission({
      ...ctx,
      subjectDomain: "main",
      subjectApiMode: "all",
    });
    return buildSubjectIdFilterFromTree(subjectTreePayload);
  } catch (_error) {
    return [];
  }
}

export function chunkProjectCostRecordSubjectIds(subjectIds = []) {
  const ids = normalizeSubjectIdFilterList(subjectIds);
  const chunks = [];
  for (let index = 0; index < ids.length; index += PROJECT_COST_RECORD_SUBJECT_BATCH_SIZE) {
    chunks.push(ids.slice(index, index + PROJECT_COST_RECORD_SUBJECT_BATCH_SIZE));
  }
  return chunks;
}

export function appendRecordSubjectBatchTraceLabel(traceLabel, batchIndex, batchCount, subjectIdCount) {
  const label = safeText(traceLabel, "记录: records/query");
  return `${label} | 批次 ${batchIndex + 1}/${batchCount} | subjectIds=${subjectIdCount}`;
}

export function logProjectCostRecordBatchPlan(ctx = {}, traceLabel = "", subjectIds = [], batches = []) {
  if (!batches.length || typeof console === "undefined") return;
  try {
     
    console.groupCollapsed(
      `[收益接口分批] records/query subjectIds=${subjectIds.length} batches=${batches.length}`
    );
     
    console.log("业务来源", safeText(traceLabel || ctx.revenueTraceSource || ctx.traceSource, "-"));
     
    console.log("projectId", safeText(ctx.projectId, "-"));
     
    console.log("stage", safeText(ctx.stageCode || ctx.stage, "-"));
     
    console.log("domain", safeText(ctx.subjectDomain, "-"));
     
    console.log("单批上限", PROJECT_COST_RECORD_SUBJECT_BATCH_SIZE);
     
    console.log("subjectIds总数", subjectIds.length);
     
    console.log("批次数", batches.length);
     
    console.log("批次大小", batches.map((item) => item.length));
     
    console.groupEnd();
  } catch (_error) {
    // ignore diagnostic logging errors
  }
}

export function warnUnscopedProjectCostRecordQuery(ctx = {}, traceLabel = "") {
  if (typeof console === "undefined") return;
  try {
     
    console.warn("[收益接口分批] records/query 未提供 subjectIds，无法按科目分批", {
      projectId: ctx.projectId,
      stage: ctx.stageCode || ctx.stage,
      domain: ctx.subjectDomain,
      traceLabel,
    });
  } catch (_error) {
    // ignore diagnostic logging errors
  }
}

export async function queryProjectCostRecordsApiWithSubjectBatches(ctx = {}, params = {}, traceLabel = "") {
  const subjectIds = normalizeSubjectIdFilterList(params.subjectIds);
  if (!subjectIds.length) {
    warnUnscopedProjectCostRecordQuery(ctx, traceLabel);
    const payload = await queryProjectCostRecordsApi({
      ...params,
      subjectIds: undefined,
    }, traceLabel);
    return parseListPayload(payload);
  }

  const batches = chunkProjectCostRecordSubjectIds(subjectIds);
  if (batches.length <= 1) {
    const payload = await queryProjectCostRecordsApi({
      ...params,
      subjectIds,
    }, traceLabel);
    return parseListPayload(payload);
  }

  logProjectCostRecordBatchPlan(ctx, traceLabel, subjectIds, batches);
  const rows = [];
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
     
    const payload = await queryProjectCostRecordsApi({
      ...params,
      subjectIds: batch,
    }, appendRecordSubjectBatchTraceLabel(traceLabel, index, batches.length, batch.length));
    rows.push(...parseListPayload(payload));
  }
  return rows;
}

export function hasVisibleSubjectScope(ctx = {}) {
  return ctx && ctx.visibleSubjectScopeProvided === true;
}

export function buildSubjectIdMap(subjectIds = []) {
  return normalizeSubjectIdFilterList(subjectIds).reduce((result, id) => {
    result[safeText(id)] = true;
    return result;
  }, {});
}

export function isVisibleUploadSubject(ctx = {}, subjectId) {
  if (!hasVisibleSubjectScope(ctx)) return true;
  const subjectIdMap = buildSubjectIdMap(ctx.visibleSubjectIds);
  const normalizedSubjectId = toMaybeLong(subjectId);
  return normalizedSubjectId != null && Boolean(subjectIdMap[safeText(normalizedSubjectId)]);
}

export function filterDataItemsByVisibleSubjectScope(ctx = {}, dataItems = []) {
  const items = Array.isArray(dataItems) ? dataItems : [];
  if (!hasVisibleSubjectScope(ctx)) return items;
  const subjectIdMap = buildSubjectIdMap(ctx.visibleSubjectIds);
  return items.filter((item) => {
    const subjectId = toMaybeLong(item && item.subjectId);
    return subjectId != null && Boolean(subjectIdMap[safeText(subjectId)]);
  });
}

export async function queryProjectCostRecordsForNodes(ctx, flowSnapshot, ownerScoped, nodes, options = {}) {
  if (!hasProjectId(ctx)) return [];
  const nodeList = normalizeStageNodeList(nodes);
  const subjectIds = resolveRecordQuerySubjectIds(ctx, options.subjectIds);
  return queryProjectCostRecordsApiWithSubjectBatches(ctx, {
    projectId: ctx.projectId,
    valvePoint: ctx.valve,
    flowId: flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined,
    nodes: nodeList.length ? nodeList : undefined,
    // 本人过滤：显式传 ownerId（登录名），与后端写入一致；兼容旧的 currentOwnerOnly
    ownerId: ownerScoped ? safeText(ctx.ownerUserId || ctx.userId) || undefined : undefined,
    currentOwnerOnly: ownerScoped ? true : undefined,
    subjectIds: subjectIds.length ? subjectIds : undefined,
    recordStatus: options.recordStatus || undefined,
  }, options.traceLabel || buildRevenueTraceLabel(
    ctx,
    `记录: records/query nodes=${nodeList.join(",") || "-"} ownerScoped=${ownerScoped ? "yes" : "no"}`
  ));
}

export async function queryS5SubmittedMainRecords(ctx, flowSnapshot, subjectIds = []) {
  const querySubjectIds = normalizeSubjectIdFilterList(subjectIds);
  const scopedSubjectIds = querySubjectIds.length
    ? querySubjectIds
    : await resolveMainTableRecordSubjectIds(ctx);
  if (!scopedSubjectIds.length) return [];
  const mainCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
    stage: "S5",
    stageCode: "S5",
    subjectIds: scopedSubjectIds,
  };
  const archivedRows = await queryProjectCostRecordsForNodes(mainCtx, flowSnapshot, false, "S5", {
    subjectIds: scopedSubjectIds,
    recordStatus: "ARCHIVED",
  });
  if (archivedRows.length) return archivedRows;

  const fallbackRows = await queryProjectCostRecordsForNodes(mainCtx, flowSnapshot, false, "S5", {
    subjectIds: scopedSubjectIds,
  });
  return fallbackRows.filter((record) => normalizeRecordStatus(record) !== "DRAFT");
}

export async function queryValueSourceRecords(ctx, flowSnapshot, ownerScoped, options = {}) {
  const nodes = normalizeStageNodeList(options.nodes || resolveSubmittedValueSourceNodes(ctx, flowSnapshot));
  const subjectIds = Array.isArray(options.subjectIds) ? options.subjectIds : [];
  try {
    const rows = await queryProjectCostRecordsForNodes(ctx, flowSnapshot, ownerScoped, nodes, {
      subjectIds,
      recordStatus: options.recordStatus,
      traceLabel: options.traceLabel,
    });
    const scopedRows = filterRecordsBySubjectIds(rows, subjectIds);
    return scopedRows;
  } catch (error) {
    throw new Error(`记录查询失败：${safeText(error && error.message, "未知错误")}`, { cause: error });
  }
}
