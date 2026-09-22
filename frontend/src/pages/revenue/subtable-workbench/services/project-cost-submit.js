import {
  saveProjectCostSubmit as saveProjectCostSubmitApi,
} from "@/api/system/expenses";
import s1WorkflowGuards from "../s1-workflow-guards";
import {
  dedupeProjectCostDataItems,
  extractProjectCostDataItemSubjectIds,
  getProjectCostDataItemKey,
  mapRecordsByDataItemKey,
} from "./project-cost-data-item";
import {
  queryProjectCostRecordsForNodes,
} from "./project-cost-record-query";
import {
  normalizeRecordId,
  normalizeRecordSubmitIds,
} from "./record-utils";
import {
  appendUniqueIds,
  safeText,
} from "./workbench-utils";

const {
  attachExistingDraftRecordIds,
} = s1WorkflowGuards;

export function isProjectCostDraftUniqueConflict(error) {
  const status = Number(
    (error && error.response && error.response.status) ||
    (error && error.status) ||
    0
  );
  const responseData = error && error.response && error.response.data;
  const message = [
    error && error.message,
    responseData && responseData.msg,
    responseData && responseData.message,
  ].map((item) => safeText(item)).filter(Boolean).join(" ");
  return (
    status === 409 ||
    /唯一性约束|唯一键|唯一索引|Duplicate|duplicate|constraint|SQLIntegrityConstraint|409/.test(message)
  );
}

export async function resolveExistingDraftRecordIdsForDataItems(
  ctx,
  flowSnapshot,
  dataItems = [],
  options = {}
) {
  const subjectIds = extractProjectCostDataItemSubjectIds(dataItems);
  if (!subjectIds.length) return { dataItems, resolvedCount: 0 };
  const ownerScoped = options.ownerScoped !== false;

  const records = await queryProjectCostRecordsForNodes(
    ctx,
    flowSnapshot,
    ownerScoped,
    (flowSnapshot && flowSnapshot.node) || ctx.stage,
    { subjectIds, recordStatus: "DRAFT" }
  );
  return attachExistingDraftRecordIds(dataItems, records, {
    forceReplace: options.forceReplace === true,
  });
}

export async function resolveExistingTargetRefsForDataItems(
  ctx,
  flowSnapshot,
  dataItems = [],
  options = {}
) {
  const subjectIds = extractProjectCostDataItemSubjectIds(dataItems);
  if (!subjectIds.length) {
    return { targetRecordIds: [], targetSubmitIds: [] };
  }

  const records = await queryProjectCostRecordsForNodes(
    ctx,
    flowSnapshot,
    options.ownerScoped === true,
    options.nodes || (flowSnapshot && flowSnapshot.node) || ctx.stage,
    { subjectIds, recordStatus: options.recordStatus }
  );
  const recordMap = mapRecordsByDataItemKey(records);
  const targetRecordIds = [];
  const targetSubmitIds = [];
  (Array.isArray(dataItems) ? dataItems : []).forEach((item) => {
    if (!item) return;
    const record = recordMap[getProjectCostDataItemKey(item)];
    if (!record) return;
    appendUniqueIds(targetRecordIds, normalizeRecordId(record));
    appendUniqueIds(targetSubmitIds, normalizeRecordSubmitIds(record));
  });

  return {
    targetRecordIds,
    targetSubmitIds,
  };
}

export async function saveProjectCostSubmitWithDraftRetry(ctx, flowSnapshot, payload = {}) {
  const saveMode = safeText(payload.saveMode, "DRAFT").toUpperCase();
  // S3 共享草稿：不分归属人查找，并强制复用同格最新 recordId
  const draftOwnerScoped = payload.draftResolveOwnerScoped !== false;
  const draftForceReplace = payload.draftForceReplaceId === true;
  const {
    draftResolveOwnerScoped: _draftResolveOwnerScoped,
    draftForceReplaceId: _draftForceReplaceId,
    ...restPayload
  } = payload;
  let requestPayload = {
    ...restPayload,
    dataItems: dedupeProjectCostDataItems(payload.dataItems),
  };
  // DRAFT / ARCHIVED 提交前补齐已有草稿 recordId，避免重复 INSERT 产生 orphan DRAFT
  if (saveMode === "DRAFT" || saveMode === "ARCHIVED") {
    const resolved = await resolveExistingDraftRecordIdsForDataItems(
      ctx,
      flowSnapshot,
      requestPayload.dataItems,
      { ownerScoped: draftOwnerScoped, forceReplace: draftForceReplace }
    );
    if (resolved.resolvedCount) {
      requestPayload = {
        ...requestPayload,
        dataItems: resolved.dataItems,
      };
    }
  }
  const traceLabel = safeText(
    payload.revenueTraceLabel,
    [
      "提交: submits/save",
      `mode=${saveMode}`,
      `remark=${safeText(payload.submitRemark, "-")}`,
      `items=${requestPayload.dataItems.length}`,
    ].join(" | ")
  );
  try {
    return await saveProjectCostSubmitApi(requestPayload, traceLabel);
  } catch (error) {
    if (saveMode !== "DRAFT" || !isProjectCostDraftUniqueConflict(error)) {
      throw error;
    }
    const resolved = await resolveExistingDraftRecordIdsForDataItems(
      ctx,
      flowSnapshot,
      requestPayload.dataItems,
      { ownerScoped: draftOwnerScoped, forceReplace: true }
    );
    if (!resolved.resolvedCount) {
      throw error;
    }
    return saveProjectCostSubmitApi(
      {
        ...requestPayload,
        dataItems: resolved.dataItems,
      },
      `${traceLabel} | 重试已有草稿 recordId`
    );
  }
}
