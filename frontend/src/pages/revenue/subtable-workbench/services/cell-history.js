import { isRevenueYearOnlyRow, normalizeStageCode } from "../domain-config";
import { getRndAmountCellKeyByAggregateMode } from "../formula-engine";
import {
  YEAR_ONLY_TRIM_INDEX,
  isRndLegacyCalculatedRecord,
  isRndTechnicalAmountRecord,
} from "./detail-builder";
import { parseCellKey } from "./detail-matrix";
import {
  readRowMatrixTargetMeta,
  readRowMatrixTargetMetaByCellKey,
} from "./project-cost-data-item";
import { buildCellReviewIndex } from "./review-metadata";
import {
  normalizeRecordCellValue,
  normalizeRecordId,
  normalizeRecordStatus,
  normalizeRecordSubmitIds,
  normalizeRecordTrimLabel,
  normalizeRecordYearLabel,
  normalizeRndTechnicalAmountRecordCellValue,
  normalizeTargetSubmitIds,
  shouldReplaceRecordCandidate,
} from "./record-utils";
import { STAGE_FLOW_CODES, resolveStageLabel } from "./stage-labels";
import {
  readOwnerPermission,
  readReviewerPermission,
  safeText,
} from "./workbench-utils";
import { getAuditContextCache } from "./audit-context-cache";

export function resolveRecordCellRef(cache, record) {
  if (!cache || !record) return null;
  const subjectId = safeText(record && record.subjectId);
  const row = cache.rowBySubjectId[subjectId];
  if (!row || !row.id) return null;
  if (isRndTechnicalAmountRecord(row, record)) {
    const cellKey = getRndAmountCellKeyByAggregateMode(
      record && record.yearAggregateMode,
    );
    return {
      row,
      rowId: safeText(row.id),
      cellKey,
      yearLabel: "",
      trimName: "",
      value: normalizeRndTechnicalAmountRecordCellValue(record),
    };
  }
  if (isRndLegacyCalculatedRecord(row, record)) return null;

  const years = (cache.dimensions && cache.dimensions.years) || [];
  const trims = (cache.dimensions && cache.dimensions.trims) || [];
  const trimOptions = Array.isArray(cache.trimOptions) ? cache.trimOptions : [];
  const yearIndexMap = {};
  const writeYearIndex = (value, index) => {
    const text = safeText(value);
    if (!text) return;
    yearIndexMap[text] = index;
    const match = /^(\d{4})年?$/.exec(text);
    if (match) {
      yearIndexMap[match[1]] = index;
      yearIndexMap[`${match[1]}年`] = index;
    }
  };
  years.forEach((year, index) => {
    writeYearIndex(year, index);
  });
  const trimIndexMap = {};
  const writeTrimIndex = (value, index) => {
    const text = safeText(value);
    if (!text || !Number.isInteger(index)) return;
    trimIndexMap[text] = index;
  };
  trims.forEach((trimName, index) => {
    writeTrimIndex(trimName, index);
  });
  trimOptions.forEach((trim, index) => {
    const trimIndex = Number.isInteger(trim && trim.trimIndex)
      ? Number(trim.trimIndex)
      : index;
    writeTrimIndex(trim && trim.trimId, trimIndex);
    writeTrimIndex(trim && trim.trimName, trimIndex);
  });

  const yearOnly = isRevenueYearOnlyRow(row);
  if (yearOnly && safeText(record && record.trimName)) return null;
  const yearLabel = normalizeRecordYearLabel(record);
  const trimName = yearOnly ? "" : normalizeRecordTrimLabel(record);
  const yearIndex = yearIndexMap[safeText(yearLabel)];
  const trimIndex = yearOnly
    ? YEAR_ONLY_TRIM_INDEX
    : trimIndexMap[safeText(trimName)];
  if (!Number.isInteger(yearIndex) || !Number.isInteger(trimIndex)) return null;

  return {
    row,
    rowId: safeText(row.id),
    cellKey: `y${yearIndex}_t${trimIndex}`,
    yearLabel,
    trimName,
    value: normalizeRecordCellValue(record),
  };
}

export function pickCellReviewEntryForRecord(
  ref,
  record,
  reviewIndex,
  options = {},
) {
  if (!ref || !record || !reviewIndex) return null;
  const submitIds = normalizeRecordSubmitIds(record);
  for (let index = 0; index < submitIds.length; index += 1) {
    const entry = reviewIndex.byReviewDataSubmitId[submitIds[index]];
    if (entry) return entry;
  }
  if (options.requireDirectReviewLink) return null;

  const rowCellEntries =
    reviewIndex.byRowCell[`${ref.rowId}__${ref.cellKey}`] || [];
  const node = safeText(record && record.node);
  const ownerId = safeText(record && record.ownerId);
  const ownerPermission = readOwnerPermission(record);
  return (
    rowCellEntries.find((entry) => {
      if (node && safeText(entry.node) && safeText(entry.node) !== node)
        return false;
      if (
        ownerId &&
        safeText(entry.reviewerId) &&
        safeText(entry.reviewerId) !== ownerId
      )
        return false;
      if (
        ownerPermission &&
        readReviewerPermission(entry) &&
        readReviewerPermission(entry) !== ownerPermission
      )
        return false;
      return true;
    }) ||
    rowCellEntries[0] ||
    null
  );
}

function buildCellHistoryEntry(ctx, ref, record, reviewEntry = null) {
  const node = safeText(record && record.node, reviewEntry && reviewEntry.node);
  const recordId = normalizeRecordId(record);
  const submitIds = normalizeRecordSubmitIds(record);
  const time = safeText(
    (record && (record.updatedAt || record.createdAt)) ||
      (reviewEntry && reviewEntry.time),
  );
  const reviewerName =
    safeText(reviewEntry && reviewEntry.reviewerName) ||
    safeText(record && record.ownerName) ||
    safeText(reviewEntry && reviewEntry.reviewerId) ||
    safeText(record && record.ownerId) ||
    safeText(ctx.userId);
  const status = normalizeRecordStatus(record);
  const level = node ? resolveStageLabel(node) : "历史候选";
  return {
    key: `${node || "UNKNOWN"}_${recordId || "no_record"}_${submitIds.join("-") || "no_submit"}_${ref.rowId}_${ref.cellKey}_${Date.parse(time || "") || 0}`,
    rowId: ref.rowId,
    cellKey: ref.cellKey,
    recordId,
    submitIds,
    reviewId: reviewEntry && reviewEntry.reviewId,
    reviewDataSubmitId: reviewEntry && reviewEntry.reviewDataSubmitId,
    stageCode: node,
    level,
    reviewer: reviewerName,
    reviewerId: safeText(
      (reviewEntry && reviewEntry.reviewerId) || (record && record.ownerId),
    ),
    reviewerPermission:
      readReviewerPermission(reviewEntry) || readOwnerPermission(record),
    value: ref.value,
    opinion: safeText(reviewEntry && reviewEntry.opinion),
    time,
    status,
    sourceType: node === "S1" ? "fill" : "review",
  };
}

function normalizeKnownStageCode(value) {
  const text = safeText(value);
  return text ? normalizeStageCode(text) : "";
}

function historyEntriesIncludeStage(entries = [], stageCode = "") {
  const targetStage = normalizeKnownStageCode(stageCode);
  if (!targetStage) return false;
  return (Array.isArray(entries) ? entries : []).some(
    (entry) =>
      normalizeKnownStageCode(entry && entry.stageCode) === targetStage,
  );
}

function resolveBaselineHistoryStage(ctx = {}, cache = {}, targetMeta = null) {
  const sourceStage =
    safeText(cache.mainPreviewSourceStage) ||
    safeText(cache.mainSnapshotSourceStage) ||
    safeText(cache.selectedSourceStage) ||
    safeText(
      Array.isArray(cache.valueSourceNodes) ? cache.valueSourceNodes[0] : "",
    );
  const normalizedSourceStage = normalizeKnownStageCode(sourceStage);
  if (
    safeText(ctx.subjectDomain).toLowerCase() === "main" &&
    normalizedSourceStage
  ) {
    return normalizedSourceStage;
  }
  const targetStage = normalizeKnownStageCode(targetMeta && targetMeta.node);
  if (targetStage) return targetStage;
  return normalizedSourceStage;
}

function isCurrentStageHistoryStage(ctx = {}, stageCode = "") {
  const currentStage = normalizeKnownStageCode(ctx.stageCode || ctx.stage);
  const targetStage = normalizeKnownStageCode(stageCode);
  return Boolean(currentStage && targetStage && currentStage === targetStage);
}

function addFallbackCellHistoryEntries(ctx, cache, historyMap) {
  Object.keys(cache.rowById || {}).forEach((rowId) => {
    const row = cache.rowById[rowId];
    const cells =
      row && row.cells && typeof row.cells === "object" ? row.cells : {};
    Object.keys(cells).forEach((cellKey) => {
      const value = safeText(cells[cellKey]);
      if (!value) return;
      const parsedCell = parseCellKey(cellKey);
      const years = (cache.dimensions && cache.dimensions.years) || [];
      const trims = (cache.dimensions && cache.dimensions.trims) || [];
      const targetMeta = parsedCell
        ? readRowMatrixTargetMeta(
            row,
            years[parsedCell.yearIndex],
            trims[parsedCell.trimIndex],
            parsedCell.yearIndex,
            parsedCell.trimIndex,
          )
        : readRowMatrixTargetMetaByCellKey(row, cellKey);
      const baselineStage = resolveBaselineHistoryStage(ctx, cache, targetMeta);
      if (isCurrentStageHistoryStage(ctx, baselineStage)) return;
      if (!historyMap[rowId]) historyMap[rowId] = {};
      const entries = Array.isArray(historyMap[rowId][cellKey])
        ? historyMap[rowId][cellKey]
        : [];
      if (
        entries.length &&
        (!baselineStage || historyEntriesIncludeStage(entries, baselineStage))
      )
        return;
      historyMap[rowId][cellKey] = [
        {
          key: `baseline_${baselineStage || "current"}_${rowId}_${cellKey}`,
          rowId,
          cellKey,
          recordId: targetMeta && targetMeta.recordId,
          submitIds: targetMeta ? normalizeTargetSubmitIds(targetMeta) : [],
          stageCode: baselineStage || safeText(targetMeta && targetMeta.node),
          level: baselineStage
            ? resolveStageLabel(baselineStage)
            : "当前基准值",
          reviewer: safeText(
            targetMeta && (targetMeta.ownerName || targetMeta.ownerId),
            "-",
          ),
          value,
          opinion: "",
          time: "",
          status: safeText(targetMeta && targetMeta.recordStatus),
          sourceType: "baseline",
        },
      ].concat(entries);
    });
  });
}

export function buildCellHistoryMap(ctx, records = [], suggestions = []) {
  const cache = getAuditContextCache(ctx);
  const reviewIndex = buildCellReviewIndex(suggestions);
  const historyMap = {};
  const latestEntryMap = {};
  const latestCandidateMap = {};

  (Array.isArray(records) ? records : []).forEach((record) => {
    const ref = resolveRecordCellRef(cache, record);
    if (!ref || !ref.rowId || !ref.cellKey || safeText(ref.value) === "")
      return;
    const reviewEntry = pickCellReviewEntryForRecord(ref, record, reviewIndex);
    const entry = buildCellHistoryEntry(ctx, ref, record, reviewEntry);
    if (isCurrentStageHistoryStage(ctx, entry.stageCode)) return;
    const mapKey = `${ref.rowId}__${ref.cellKey}__${entry.stageCode || "UNKNOWN"}`;
    const candidate = {
      recordId: entry.recordId,
      sourceStageCode: entry.stageCode,
      recordStatus: entry.status,
      submitIds: entry.submitIds,
      reviewDataSubmitId: entry.reviewDataSubmitId,
      time: entry.time,
    };
    if (shouldReplaceRecordCandidate(candidate, latestCandidateMap[mapKey])) {
      latestCandidateMap[mapKey] = candidate;
      latestEntryMap[mapKey] = entry;
    }
  });

  Object.keys(latestEntryMap).forEach((mapKey) => {
    const entry = latestEntryMap[mapKey];
    if (!entry || !entry.rowId || !entry.cellKey) return;
    if (!historyMap[entry.rowId]) historyMap[entry.rowId] = {};
    if (!historyMap[entry.rowId][entry.cellKey])
      historyMap[entry.rowId][entry.cellKey] = [];
    historyMap[entry.rowId][entry.cellKey].push(entry);
  });

  addFallbackCellHistoryEntries(ctx, cache, historyMap);

  Object.keys(historyMap).forEach((rowId) => {
    Object.keys(historyMap[rowId]).forEach((cellKey) => {
      historyMap[rowId][cellKey].sort((a, b) => {
        const stageDiff =
          STAGE_FLOW_CODES.indexOf(b.stageCode) -
          STAGE_FLOW_CODES.indexOf(a.stageCode);
        if (stageDiff) return stageDiff;
        const timeDiff =
          (Date.parse(b.time || "") || 0) - (Date.parse(a.time || "") || 0);
        if (timeDiff) return timeDiff;
        return 0;
      });
    });
  });
  return historyMap;
}
