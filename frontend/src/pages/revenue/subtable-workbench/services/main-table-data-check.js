import {
  REVENUE_MODULE_CODE,
  normalizeStageCode,
} from "../domain-config";
import {
  REVENUE_FORMULA_CALCULATION_MODE,
  applyRevenueFormulasToDetail,
} from "../formula-engine";
import {
  buildDetailRowsFromPermissionTree,
  validateBackendTemplateRows,
} from "./detail-builder";
import {
  cloneDetailForFormula,
} from "./formula-source";
import {
  isMainPreviewRow,
} from "./main-table-preview";
import {
  mergeParentSubjectDisplayMap,
} from "./payload-normalizer";
import { buildTrimOptions } from "./project-context";
import {
  dedupePreferredRecords,
  filterRecordsBySubjectIds,
  normalizeRecordCellValue,
  normalizeRecordId,
  normalizeRecordStatus,
  normalizeRecordSubmitIds,
  normalizeRecordTrimLabel,
} from "./record-utils";
import {
  queryProjectCostRecordsApiWithSubjectBatches,
  queryProjectCostRecordsForNodes,
  resolveRecordQuerySubjectIds,
} from "./project-cost-record-query";
import {
  STAGE_FLOW_CODES,
  resolveStageLabel,
} from "./stage-labels";
import {
  collectPermissionLeafRows,
  filterMainSubjectTreePayload,
  getSubjectNodes,
  normalizeSubjectTreeForDomain,
} from "./subject-tree";
import {
  requestStrictPermissionTree,
  requestSubjectTreePreferPermission,
} from "./subject-tree-request";
import { resolveOperationPermissionKey } from "./workbench-permissions";
import {
  buildRevenueTraceLabel,
  isTruthyFlag,
  normalizeSubjectIdFilterList,
  resolveProjectDisplayName,
  safeText,
} from "./workbench-utils";

export const MAIN_TABLE_DATA_CHECK_HISTORY_RULE = Object.freeze({
  nodes: ["S8"],
  priority: [
    { node: "S8" },
  ],
});

export const MAIN_TABLE_DATA_CHECK_IMPORT_NODE = "MAIN_TABLE";

export function resolveMainTableDataCheckStageCodes(currentStage) {
  const normalized = normalizeStageCode(currentStage || "S1");
  const index = STAGE_FLOW_CODES.indexOf(normalized);
  if (index < 0) return [];
  return STAGE_FLOW_CODES.slice(0, index + 1);
}

export function resolveMainTableDataCheckHistoryArchivedStageCodes(flowSnapshot = {}) {
  if (!flowSnapshot || flowSnapshot.flowId == null) {
    return STAGE_FLOW_CODES.slice().reverse();
  }
  const currentStage = normalizeStageCode(flowSnapshot.node || "S8");
  return resolveMainTableDataCheckStageCodes(currentStage).slice().reverse();
}

export function buildMainTableDataCheckProject(ctx = {}, flowSnapshot = {}, currentStage = "S1") {
  return {
    projectId: ctx.projectId || undefined,
    projectNo: ctx.projectNo || ctx.projectCode,
    projectCode: ctx.projectCode,
    projectName: resolveProjectDisplayName(ctx),
    gate: ctx.valve,
    valvePoint: ctx.valve,
    flowId: flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined,
    stage: currentStage,
    nodeStatus: safeText(flowSnapshot && flowSnapshot.nodeStatus),
    audit: {
      stageCode: currentStage,
      stage: currentStage,
    },
  };
}

export function isMainTableDataCheckAdmin(ctx = {}) {
  return isTruthyFlag(ctx.fullAccess || ctx.hasAllPermission) ||
    resolveOperationPermissionKey(ctx, "") === "*:*:*";
}

export async function hasMainTableDataCheckPermission(ctx = {}) {
  if (isMainTableDataCheckAdmin(ctx)) return true;
  const permissionCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "permission",
  };
  const permissionPayload = normalizeSubjectTreeForDomain(
    await requestStrictPermissionTree(permissionCtx),
    permissionCtx
  );
  return collectPermissionLeafRows(getSubjectNodes(permissionPayload)).length > 0;
}

export async function fetchMainTableDataCheckSubjectTree(ctx = {}) {
  const mainCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
  };
  const subjectTreePayload = await requestSubjectTreePreferPermission(mainCtx);
  if (!getSubjectNodes(subjectTreePayload).length) {
    throw new Error("模板和授权过滤后无主表科目，无法打开数据校核");
  }
  return filterMainSubjectTreePayload(subjectTreePayload);
}

function normalizeDataCheckSubjectAlignName(value) {
  return safeText(value)
    .toUpperCase()
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/其中[:：]/g, "")
    .replace(/[\s\u3000]/g, "")
    .replace(/[()]/g, "")
    .replace(/[/\\_\-—]/g, "");
}

export function remapDataCheckRecordsToSubjectTree(records = [], subjectTreePayload = {}) {
  const leaves = collectPermissionLeafRows(getSubjectNodes(subjectTreePayload));
  const idSet = {};
  const nameToId = {};
  leaves.forEach((leaf) => {
    const id = safeText(leaf && leaf.subjectId);
    if (id) idSet[id] = true;
    const nameKey = normalizeDataCheckSubjectAlignName(leaf && (leaf.subjectName || leaf.name));
    if (nameKey && !nameToId[nameKey]) nameToId[nameKey] = id;
  });
  return (Array.isArray(records) ? records : []).map((record) => {
    const currentId = safeText(record && record.subjectId);
    if (currentId && idSet[currentId]) return record;
    const nameKey = normalizeDataCheckSubjectAlignName(
      record && (record.subjectName || record.subject || record.name)
    );
    const mappedId = nameToId[nameKey];
    if (!mappedId) return record;
    return {
      ...record,
      subjectId: mappedId,
    };
  });
}

export function buildMainTableDataCheckTrimOptions(patternList = [], records = []) {
  const result = [];
  const map = {};
  const append = (item) => {
    const source = item && typeof item === "object" ? item : {};
    const rawName = item && typeof item === "object"
      ? source.trimName || source.name || source.label || source.trimId || source.id
      : item;
    const trimName = safeText(rawName);
    if (!trimName || map[trimName]) return;
    map[trimName] = true;
    result.push({
      trimId: safeText(source.trimId || source.id || trimName),
      trimName,
      trimIndex: result.length,
    });
  };

  buildTrimOptions(patternList, records).forEach(append);
  (Array.isArray(records) ? records : []).forEach((record) => {
    append(normalizeRecordTrimLabel(record));
  });
  if (!result.length) append("默认版型");
  return result;
}

export function filterMainTableDataCheckDetailRowsBySubjectIds(detail = {}, subjectIds = []) {
  const ids = normalizeSubjectIdFilterList(subjectIds);
  const rows = Array.isArray(detail && detail.rows) ? detail.rows : [];
  if (!ids.length) return rows.filter(isMainPreviewRow);
  const idMap = {};
  ids.forEach((id) => {
    idMap[safeText(id)] = true;
  });
  return rows.filter((row) =>
    isMainPreviewRow(row) && Boolean(idMap[safeText(row && row.subjectId)])
  );
}

export function buildMainTableDataCheckSourceFromDetail(ctx, flowSnapshot, detail = {}, stageCode, recordStatus = "", sourceMeta = {}) {
  const sourceCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
    stage: stageCode,
    stageCode,
  };
  const detailData = cloneDetailForFormula(detail);
  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || stageCode);
  const sourceStage = normalizeStageCode(sourceMeta.stage || stageCode);
  const valueSourceNodes = Array.isArray(sourceMeta.valueSourceNodes) && sourceMeta.valueSourceNodes.length
    ? sourceMeta.valueSourceNodes
    : [stageCode];
  const rows = Array.isArray(detailData.rows) ? detailData.rows : [];
  return {
    key: safeText(sourceMeta.key, stageCode.toLowerCase()),
    stage: sourceStage,
    label: safeText(sourceMeta.label, resolveStageLabel(stageCode)),
    dot: safeText(sourceMeta.dot, stageCode === currentStage ? "current" : "stage"),
    group: safeText(sourceMeta.group, "stage"),
    sourceType: safeText(sourceMeta.sourceType, "mainSnapshot"),
    valvePoint: safeText(sourceMeta.valvePoint),
    recordStatus,
    recordCount: rows.length,
    detail: {
      dimensions: detailData.dimensions || { years: [], trims: [] },
      trimOptions: Array.isArray(detailData.trimOptions) ? detailData.trimOptions : [],
      yearTrimConfig: detailData.yearTrimConfig || {},
      rows,
      templateValidation: detailData.templateValidation || validateBackendTemplateRows(rows),
      parentSubjectDisplay: detailData.parentSubjectDisplay || mergeParentSubjectDisplayMap(),
      subtableProgress: [],
      lastSavedAt: "-",
      lastSavedBy: "-",
      flowId: sourceMeta.ignoreFlowId ? undefined : (flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined),
      flowNode: currentStage,
      valueSourceNodes,
      selectedSourceStage: stageCode,
      mainSnapshotSourceStage: safeText(sourceMeta.mainSnapshotSourceStage),
      mainPreviewSourceMode: safeText(sourceMeta.mainPreviewSourceMode, detailData.mainPreviewSourceMode),
      mainPreviewSourceStage: safeText(sourceMeta.mainPreviewSourceStage, detailData.mainPreviewSourceStage || stageCode),
      calculatedMainPreview: sourceMeta.calculatedMainPreview === true || detailData.calculatedMainPreview === true,
      mainSnapshotRecordCount: Number(sourceMeta.mainSnapshotRecordCount || 0),
      mainSnapshotRecordStatus: recordStatus,
    },
    project: buildMainTableDataCheckProject(sourceCtx, flowSnapshot, currentStage),
  };
}

export function buildMainTableDataCheckSource(ctx, flowSnapshot, subjectTreePayload, patternList, stageCode, records = [], recordStatus = "", sourceMeta = {}) {
  const sourceCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
    stage: stageCode,
    stageCode,
  };
  const trimOptions = buildMainTableDataCheckTrimOptions(patternList, records);
  const detailData = buildDetailRowsFromPermissionTree(
    getSubjectNodes(subjectTreePayload),
    records,
    trimOptions
  );
  try {
    applyRevenueFormulasToDetail(detailData, {
      targetModuleCode: REVENUE_MODULE_CODE.MAIN_PNL,
      calculationMode: REVENUE_FORMULA_CALCULATION_MODE.MAIN_AUDIT,
      ignoreFormulaLocks: true,
    });
  } catch (_error) {
    // 数据校核是只读场景，公式补算失败时仍保留原始快照数据展示。
  }
  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || stageCode);
  const sourceStage = normalizeStageCode(sourceMeta.stage || stageCode);
  const valueSourceNodes = Array.isArray(sourceMeta.valueSourceNodes) && sourceMeta.valueSourceNodes.length
    ? sourceMeta.valueSourceNodes
    : [stageCode];
  return {
    key: safeText(sourceMeta.key, stageCode.toLowerCase()),
    stage: sourceStage,
    label: safeText(sourceMeta.label, resolveStageLabel(stageCode)),
    dot: safeText(sourceMeta.dot, stageCode === currentStage ? "current" : "stage"),
    group: safeText(sourceMeta.group, "stage"),
    sourceType: safeText(sourceMeta.sourceType, "mainSnapshot"),
    valvePoint: safeText(sourceMeta.valvePoint),
    recordStatus,
    recordCount: records.length,
    detail: {
      dimensions: detailData.dimensions,
      trimOptions: detailData.trimOptions,
      yearTrimConfig: detailData.yearTrimConfig,
      rows: detailData.rows,
      templateValidation: detailData.templateValidation,
      parentSubjectDisplay: mergeParentSubjectDisplayMap(),
      subtableProgress: [],
      lastSavedAt: "-",
      lastSavedBy: "-",
      flowId: sourceMeta.ignoreFlowId ? undefined : (flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined),
      flowNode: currentStage,
      valueSourceNodes,
      selectedSourceStage: stageCode,
      mainSnapshotSourceStage: stageCode,
      mainPreviewSourceMode: "snapshot",
      calculatedMainPreview: false,
      mainSnapshotRecordCount: records.length,
      mainSnapshotRecordStatus: recordStatus,
    },
    project: buildMainTableDataCheckProject(sourceCtx, flowSnapshot, currentStage),
  };
}

export function recordHasReadableMainValue(record = {}) {
  return safeText(normalizeRecordCellValue(record)) !== "";
}

export function normalizeMainDataCheckRecordNode(record = {}) {
  return safeText(record && record.node).toUpperCase();
}

export function normalizeMainDataCheckValvePoint(value) {
  return safeText(value).replace(/\s+/g, "").toUpperCase();
}

export function getMainDataCheckHistoryValveVersionKey(valvePoint) {
  return `gate_${normalizeMainDataCheckValvePoint(valvePoint).toLowerCase()}`;
}

export function getMainDataCheckHistoryValveVersionLabel(valvePoint, stageCode = "") {
  const normalizedStage = safeText(stageCode).toUpperCase();
  const stageSuffix = normalizedStage ? `(${normalizedStage})` : "";
  return `${normalizeMainDataCheckValvePoint(valvePoint)}阀点数据${stageSuffix}`;
}

export function getMainDataCheckOtherProjectVersionKey(projectId, valvePoint) {
  const id = safeText(projectId).toLowerCase();
  return `other_${id}_gate_${normalizeMainDataCheckValvePoint(valvePoint).toLowerCase()}`;
}

export function getMainDataCheckOtherProjectVersionLabel(projectLabel, valvePoint, stageCode = "") {
  const name = safeText(projectLabel, "其他项目");
  return `${name} · ${getMainDataCheckHistoryValveVersionLabel(valvePoint, stageCode)}`;
}

export function getMainDataCheckHistoryPreviewVersionKey(valvePoint, stageCode) {
  return `${getMainDataCheckHistoryValveVersionKey(valvePoint)}_${normalizeStageCode(stageCode).toLowerCase()}_preview`;
}

export function getMainDataCheckHistoryPreviewVersionLabel(valvePoint, stageCode) {
  return `${normalizeMainDataCheckValvePoint(valvePoint)}阀点数据(${normalizeStageCode(stageCode)}预览)`;
}

export function getMainDataCheckStageSnapshotVersionLabel(stageCode) {
  return `${normalizeStageCode(stageCode)} 主表快照`;
}

export function getMainDataCheckStagePreviewVersionKey(stageCode) {
  return `${normalizeStageCode(stageCode).toLowerCase()}_preview`;
}

export function getMainDataCheckStagePreviewVersionLabel(stageCode) {
  return `${normalizeStageCode(stageCode)} 主表预览`;
}

export function selectMainDataCheckRuleRecords(records = [], rule = {}) {
  const source = Array.isArray(records) ? records : [];
  const priorities = Array.isArray(rule.priority) ? rule.priority : [];
  for (let index = 0; index < priorities.length; index += 1) {
    const item = priorities[index] || {};
    const node = safeText(item.node).toUpperCase();
    const matched = source.filter((record) => {
      if (node && normalizeMainDataCheckRecordNode(record) !== node) return false;
      return true;
    });
    const latestBatch = filterLatestMainDataCheckRecordBatch(matched);
    if (latestBatch.length) return latestBatch;
  }
  return [];
}

export function isMainDataCheckReferenceImportRecord(record = {}) {
  const node = normalizeMainDataCheckRecordNode(record);
  const aggregateMode = safeText(record && record.yearAggregateMode).toUpperCase();
  return (
    node === MAIN_TABLE_DATA_CHECK_IMPORT_NODE &&
    ["SPECIFIC", "COMBINED"].includes(aggregateMode) &&
    recordHasReadableMainValue(record)
  );
}

function getMainDataCheckRecordTimeScore(record = {}) {
  const parsed = Date.parse(record.updatedAt || record.createdAt || "");
  if (parsed) return parsed;
  return Number(normalizeRecordId(record) || 0) || 0;
}

export function filterLatestMainDataCheckRecordBatch(records = []) {
  const usableRecords = (Array.isArray(records) ? records : [])
    .filter(recordHasReadableMainValue);
  if (!usableRecords.length) return [];

  let latestSubmitId = null;
  usableRecords.forEach((record) => {
    normalizeRecordSubmitIds(record).forEach((submitId) => {
      if (latestSubmitId == null || submitId > latestSubmitId) {
        latestSubmitId = submitId;
      }
    });
  });
  if (latestSubmitId != null) {
    return usableRecords.filter((record) =>
      normalizeRecordSubmitIds(record).includes(latestSubmitId)
    );
  }

  const latestScore = usableRecords.reduce(
    (score, record) => Math.max(score, getMainDataCheckRecordTimeScore(record)),
    0
  );
  if (!latestScore) return usableRecords;
  return usableRecords.filter(
    (record) => getMainDataCheckRecordTimeScore(record) === latestScore
  );
}

export async function queryMainTableDataCheckStageRecords(ctx, flowSnapshot, stageCode, subjectIds = []) {
  const sourceCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
    stage: stageCode,
    stageCode,
  };
  const archivedRows = await queryProjectCostRecordsForNodes(sourceCtx, flowSnapshot, false, stageCode, {
    subjectIds,
    recordStatus: "ARCHIVED",
    traceLabel: buildRevenueTraceLabel(
      sourceCtx,
      `记录: 数据校核主表 records/query nodes=${stageCode} status=ARCHIVED`
    ),
  });
  const archivedBatch = filterLatestMainDataCheckRecordBatch(
    filterRecordsBySubjectIds(archivedRows, subjectIds)
  );
  if (archivedBatch.length) {
    return {
      records: archivedBatch,
      recordStatus: "ARCHIVED",
    };
  }

  const fallbackRows = await queryProjectCostRecordsForNodes(sourceCtx, flowSnapshot, false, stageCode, {
    subjectIds,
    traceLabel: buildRevenueTraceLabel(
      sourceCtx,
      `记录: 数据校核主表 records/query nodes=${stageCode} non-draft fallback`
    ),
  });
  const nonDraftBatch = filterLatestMainDataCheckRecordBatch(
    filterRecordsBySubjectIds(fallbackRows, subjectIds)
      .filter((record) => normalizeRecordStatus(record) !== "DRAFT")
  );
  return {
    records: nonDraftBatch,
    recordStatus: nonDraftBatch.length ? "NON_DRAFT" : "",
  };
}

export async function queryMainTableDataCheckHistoryValveMeetingRecords(ctx, subjectIds = []) {
  const rule = MAIN_TABLE_DATA_CHECK_HISTORY_RULE;
  const querySubjectIds = resolveRecordQuerySubjectIds(ctx, subjectIds);
  const baseParams = {
    projectId: ctx.projectId,
    valvePoint: ctx.valve,
    subjectIds: querySubjectIds,
    nodes: rule.nodes,
  };
  const records = await queryProjectCostRecordsApiWithSubjectBatches(ctx, baseParams, buildRevenueTraceLabel(
    ctx,
    `记录: 数据校核历史阀点 records/query nodes=${rule.nodes.join(",")}`
  ));
  const selected = selectMainDataCheckRuleRecords(
    filterRecordsBySubjectIds(records, querySubjectIds),
    rule
  );
  return selected;
}

export async function queryMainTableDataCheckHistoryImportRecords(ctx, subjectIds = []) {
  const querySubjectIds = resolveRecordQuerySubjectIds(ctx, subjectIds);
  const records = await queryProjectCostRecordsApiWithSubjectBatches(ctx, {
    projectId: ctx.projectId,
    valvePoint: ctx.valve,
    subjectIds: querySubjectIds,
    nodes: [MAIN_TABLE_DATA_CHECK_IMPORT_NODE],
  }, buildRevenueTraceLabel(
    ctx,
    "记录: 数据校核历史阀点主表导入 records/query"
  ));
  return filterLatestMainDataCheckRecordBatch(
    filterRecordsBySubjectIds(records, querySubjectIds)
      .filter(isMainDataCheckReferenceImportRecord)
  );
}

export async function queryMainTableDataCheckHistoryArchivedFallback(ctx, flowSnapshot, subjectIds = []) {
  const querySubjectIds = resolveRecordQuerySubjectIds(ctx, subjectIds);
  if (!querySubjectIds.length) return { records: [], stageCode: "" };
  const stageCodes = resolveMainTableDataCheckHistoryArchivedStageCodes(flowSnapshot);
  if (!stageCodes.length) return { records: [], stageCode: "" };
  const rows = await queryProjectCostRecordsForNodes(ctx, flowSnapshot, false, stageCodes, {
    subjectIds: querySubjectIds,
    recordStatus: "ARCHIVED",
    traceLabel: buildRevenueTraceLabel(
      ctx,
      `记录: 数据校核历史阀点归档主表 fallback records/query nodes=${stageCodes.join(",")}`
    ),
  });
  const scopedRows = filterRecordsBySubjectIds(rows, querySubjectIds);
  for (let index = 0; index < stageCodes.length; index += 1) {
    const stageCode = stageCodes[index];
    const records = filterLatestMainDataCheckRecordBatch(
      scopedRows.filter((record) => normalizeMainDataCheckRecordNode(record) === stageCode)
    );
    if (records.length) {
      return { records, stageCode };
    }
  }
  return { records: [], stageCode: "" };
}

export async function queryMainTableDataCheckHistoryValveRecords(ctx, subjectIds = []) {
  const querySubjectIds = normalizeSubjectIdFilterList(subjectIds);
  if (!querySubjectIds.length) return [];
  const [meetingRecords, importRecords] = await Promise.all([
    queryMainTableDataCheckHistoryValveMeetingRecords(ctx, querySubjectIds),
    queryMainTableDataCheckHistoryImportRecords(ctx, querySubjectIds),
  ]);
  return dedupePreferredRecords(meetingRecords.concat(importRecords));
}
