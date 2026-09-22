import {
  buildHistoryDraftImportItem,
  getProjectCostRecordDataItemKey,
  mapRecordsByDataItemKey,
  normalizeHistoryImportModelYears,
  normalizeHistoryImportTrimNames,
  pickLatestRecordsByDataItemKey,
} from "./project-cost-data-item";
import {
  queryProjectCostRecordsForNodes,
} from "./project-cost-record-query";
import {
  filterRecordsBySubjectIds,
} from "./record-utils";
import { ensureProjectCostFlow } from "./flow-context";
import {
  buildSubjectIdFilterFromTree,
  getSubjectNodes,
} from "./subject-tree";
import {
  requestSubjectTreePreferPermission,
} from "./subject-tree-request";
import {
  safeText,
  toMaybeLong,
} from "./workbench-utils";

export function resolvePreviousValvePoint(valvePoint) {
  const text = safeText(valvePoint).toUpperCase();
  if (!/^G[1-9]$/.test(text)) return "";
  const number = Number(text.slice(1));
  if (!Number.isFinite(number) || number >= 9) return "";
  return `G${number + 1}`;
}

export async function resolveHistoryImportSubjectIds(ctx) {
  const explicit = Array.isArray(ctx.targetSubjectIds)
    ? ctx.targetSubjectIds.map((item) => toMaybeLong(item)).filter((item) => item != null)
    : [];
  if (explicit.length) {
    return explicit.filter((item, index, list) => list.indexOf(item) === index);
  }

  const subjectTreePayload = await requestSubjectTreePreferPermission(ctx);
  if (!getSubjectNodes(subjectTreePayload).length) {
    throw new Error("模板和授权过滤后无历史导入科目，无法解析导入科目范围");
  }
  return buildSubjectIdFilterFromTree(subjectTreePayload);
}

export async function buildHistoryDraftImportPlan(ctx) {
  const targetFlow = await ensureProjectCostFlow(ctx, { createIfMissing: false });
  if (targetFlow.flowId == null) {
    return { ok: false, message: "未找到当前 S1 填报流程，无法导入草稿" };
  }

  const sourceValvePoint = resolvePreviousValvePoint(ctx.valve);
  if (!sourceValvePoint) {
    return { ok: false, message: "当前阀点无法识别上一阀点" };
  }

  const sourceCtx = {
    ...ctx,
    valve: sourceValvePoint,
    valvePoint: sourceValvePoint,
    flowId: null,
  };
  const sourceFlow = await ensureProjectCostFlow(sourceCtx, {
    createIfMissing: false,
    forceRefresh: true,
  });
  if (sourceFlow.flowId == null) {
    return {
      ok: true,
      projectCode: ctx.projectCode,
      targetFlowId: targetFlow.flowId,
      targetValvePoint: ctx.valve,
      sourceValvePoint,
      sourceType: "PREVIOUS_DRAFT",
      totalCount: 0,
      importableCount: 0,
      overwriteCount: 0,
      blockedCount: 0,
      message: "上一阀点暂无可导入草稿",
      items: [],
      targetFlow,
    };
  }

  const subjectIds = await resolveHistoryImportSubjectIds(ctx);
  if (!subjectIds.length) {
    return { ok: false, message: "当前用户没有可导入的责任科目" };
  }

  const targetModelYears = normalizeHistoryImportModelYears(ctx.targetModelYears);
  const targetTrimNames = normalizeHistoryImportTrimNames(ctx.targetTrimNames);
  const [sourceRows, currentRows, currentDraftRows] = await Promise.all([
    queryProjectCostRecordsForNodes(sourceCtx, sourceFlow, false, ["S1"], {
      subjectIds,
      recordStatus: "DRAFT",
    }),
    queryProjectCostRecordsForNodes(ctx, targetFlow, true, ["S1"], {
      subjectIds,
    }),
    queryProjectCostRecordsForNodes(ctx, targetFlow, true, ["S1"], {
      subjectIds,
      recordStatus: "DRAFT",
    }),
  ]);

  const currentRecordMap = mapRecordsByDataItemKey(currentRows);
  const currentDraftRecordMap = mapRecordsByDataItemKey(currentDraftRows);
  const sourceRecords = pickLatestRecordsByDataItemKey(filterRecordsBySubjectIds(sourceRows, subjectIds));
  const items = sourceRecords.map((sourceRecord) => {
    const key = getProjectCostRecordDataItemKey(sourceRecord);
    return buildHistoryDraftImportItem(
      sourceRecord,
      currentRecordMap[key] || null,
      currentDraftRecordMap[key] || null,
      { sourceValvePoint, targetModelYears, targetTrimNames }
    );
  });
  const importableCount = items.filter((item) => item.importable).length;
  const overwriteCount = items.filter((item) => item.importable && item.willOverwrite).length;

  return {
    ok: true,
    projectCode: ctx.projectCode,
    targetFlowId: targetFlow.flowId,
    targetValvePoint: ctx.valve,
    sourceValvePoint,
    sourceType: "PREVIOUS_DRAFT",
    totalCount: items.length,
    importableCount,
    overwriteCount,
    blockedCount: items.length - importableCount,
    message: items.length ? "已生成上一阀点草稿导入预览" : "上一阀点暂无可导入草稿",
    items,
    targetFlow,
  };
}
