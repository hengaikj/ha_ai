import {
  queryProjectCostReviewSuggestions as queryProjectCostReviewSuggestionsApi,
} from "@/api/system/expenses";
import { WORKFLOW_STAGE_FLOW, normalizeStageCode } from "../domain-config";
import {
  queryProjectCostRecordsApiWithSubjectBatches,
  resolveRecordQuerySubjectIds,
} from "./project-cost-record-query";
import {
  buildFlowOpinionTimeline,
  buildModuleReviewStateFromSuggestions,
  parseModuleReviewEntries,
} from "./review-metadata";
import { normalizeStageNodeList } from "./stage-labels";
import {
  buildRevenueTraceLabel,
  hasProjectId,
  parseListPayload,
  safeText,
} from "./workbench-utils";

export async function queryReviewSuggestionRows(ctx, flowSnapshot, options = {}) {
  if (!flowSnapshot || flowSnapshot.flowId == null) return [];
  try {
    const node = safeText(options.node || (flowSnapshot && flowSnapshot.node) || ctx.stage);
    const payload = await queryProjectCostReviewSuggestionsApi({
      flowId: flowSnapshot.flowId,
      node,
      reviewerId: options.includeReviewerFilter === false ? undefined : ctx.userId,
      reviewStatus: options.reviewStatus || undefined,
    }, options.traceLabel || buildRevenueTraceLabel(
      ctx,
      `意见: review-suggestions/query node=${node || "-"} reviewerFilter=${
        options.includeReviewerFilter === false ? "no" : "yes"
      }`
    ));
    return parseListPayload(payload);
  } catch (_error) {
    return [];
  }
}

export async function queryAuditRecordsRows(ctx, flowSnapshot, options = {}) {
  if (!flowSnapshot || flowSnapshot.flowId == null || !hasProjectId(ctx)) return [];
  try {
    const nodes = normalizeStageNodeList(
      options.nodes || options.node || (flowSnapshot && flowSnapshot.node) || ctx.stage
    );
    const subjectIds = resolveRecordQuerySubjectIds(ctx, options.subjectIds);
    return queryProjectCostRecordsApiWithSubjectBatches(ctx, {
      projectId: ctx.projectId,
      valvePoint: ctx.valve,
      flowId: flowSnapshot.flowId,
      nodes: nodes.length ? nodes : undefined,
      ownerId: options.includeOwnerFilter === false
        ? undefined
        : safeText(ctx.ownerUserId || ctx.userId),
      subjectIds: subjectIds.length ? subjectIds : undefined,
      recordStatus: options.recordStatus || undefined,
      reviewId: options.reviewId || undefined,
    }, options.traceLabel || buildRevenueTraceLabel(
      ctx,
      `记录: audit records/query nodes=${nodes.join(",") || "-"} ownerFilter=${
        options.includeOwnerFilter === false ? "no" : "yes"
      }`
    ));
  } catch (error) {
    if (options.throwOnError) {
      throw error;
    }
    return [];
  }
}

// 跨节点加载「前序节点整表意见」:查 S1..当前(含主表审核节点)各 node 的 review-suggestions,
// 归并成统一的意见时间线。供 S1/S2/S3 及后续主表审核节点统一展示前面节点的填报/审核意见。
export async function loadFlowOpinionTimeline(ctx, flowSnapshot, options = {}) {
  if (!flowSnapshot || flowSnapshot.flowId == null) return { items: [], byStage: {} };
  const currentStage = normalizeStageCode(
    options.uptoStage || (flowSnapshot && flowSnapshot.node) || ctx.stage
  );
  const currentIndex = WORKFLOW_STAGE_FLOW.indexOf(currentStage);
  const endIndex = options.includeCurrent === false ? currentIndex : currentIndex + 1;
  const nodes = currentIndex >= 0
    ? WORKFLOW_STAGE_FLOW.slice(0, Math.max(endIndex, 0))
    : [currentStage];
  if (!nodes.length) return { items: [], byStage: {} };
  const groups = await Promise.all(
    nodes.map((node) =>
      queryReviewSuggestionRows(ctx, flowSnapshot, {
        node,
        includeReviewerFilter: false,
      })
    )
  );
  const rows = groups.reduce((acc, group) => acc.concat(Array.isArray(group) ? group : []), []);
  return buildFlowOpinionTimeline(parseModuleReviewEntries(rows), options);
}

export async function requestModuleReviewState(ctx, flowSnapshot) {
  if (!flowSnapshot || flowSnapshot.flowId == null) {
    return { opinionMap: {}, submitMap: {}, timeline: [] };
  }
  const suggestionRows = await queryReviewSuggestionRows(ctx, flowSnapshot, {
    includeReviewerFilter: ctx.includeReviewerFilter === false ? false : undefined,
  });
  return buildModuleReviewStateFromSuggestions(suggestionRows);
}
