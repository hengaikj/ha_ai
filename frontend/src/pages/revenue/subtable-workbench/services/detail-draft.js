import {
  RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
  RND_INVESTMENT_TAX_INCLUDED_CELL_KEY,
  isRndAmountCellKey,
} from "../formula-engine";
import {
  setAuditContextCache,
} from "./audit-context-cache";
import {
  getDetailDimensions,
  normalizeTrimOptions,
  parseCellKey,
} from "./detail-matrix";
import {
  resolveModelYear,
  resolveYearAggregateMode,
} from "./project-cost-data-item";
import { buildDraftMapFromRecords } from "./record-cell-map";
import {
  normalizeIdList,
  readOwnerPermission,
  safeText,
  toMaybeLong,
} from "./workbench-utils";

function lockRowFormulaCell(row = {}, cellKey = "") {
  if (!row || typeof row !== "object" || !cellKey) return;
  if (!row.formulaLockedCellMap || typeof row.formulaLockedCellMap !== "object") {
    row.formulaLockedCellMap = {};
  }
  row.formulaLockedCellMap[cellKey] = true;
}

function isComputedFormulaRow(row = {}) {
  if (!row || typeof row !== "object") return false;
  if (row.calculated === true) return true;
  if (safeText(row.inputType).toLowerCase() === "calc") return true;
  const entryMode = safeText(row.entryMode || row.templateEntryMode).toUpperCase();
  return entryMode === "CALCULATED" || entryMode === "DERIVED";
}

function isLockableFormulaCellKey(cellKey = "") {
  const key = safeText(cellKey);
  if (!key) return false;
  if (/^y\d+_t\d+$/.test(key)) return true;
  return isRndAmountCellKey(key);
}

function hasPersistedFormulaCellRecord(row = {}, cellKey = "") {
  const recordMap =
    row && row.cellRecordMap && typeof row.cellRecordMap === "object" ? row.cellRecordMap : null;
  if (!recordMap || !cellKey) return false;
  return Boolean(recordMap[cellKey]);
}

function isSamePersistedFormulaValue(left, right) {
  const leftText = safeText(left);
  const rightText = safeText(right);
  if (leftText === rightText) return true;
  const leftNumber = Number(leftText);
  const rightNumber = Number(rightText);
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber;
}

/** 采集计算行上已落库的单元格快照（公式重算前调用） */
export function capturePersistedComputedCellSnapshots(detail = {}) {
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const snapshots = [];
  rows.forEach((row, rowIndex) => {
    if (!isComputedFormulaRow(row)) return;
    const cells = row.cells && typeof row.cells === "object" ? row.cells : {};
    Object.keys(cells).forEach((cellKey) => {
      if (!isLockableFormulaCellKey(cellKey)) return;
      if (!hasPersistedFormulaCellRecord(row, cellKey)) return;
      const value = cells[cellKey];
      if (safeText(value) === "") return;
      snapshots.push({ rowIndex, cellKey, value });
    });
  });
  return snapshots;
}

/**
 * 公式重算后：仅当落库值与公式结果不同时恢复并加锁。
 * 这样「覆盖公式值」能保留，而「取消覆盖后存回的公式值」不会被永久冻住。
 */
export function restorePersistedComputedFormulaOverrides(detail = {}, snapshots = []) {
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const list = Array.isArray(snapshots) ? snapshots : [];
  list.forEach((item) => {
    const row = rows[item && item.rowIndex];
    const cellKey = safeText(item && item.cellKey);
    if (!row || !cellKey) return;
    if (!row.cells || typeof row.cells !== "object") row.cells = {};
    const formulaValue = row.cells[cellKey];
    if (isSamePersistedFormulaValue(formulaValue, item.value)) return;
    row.cells[cellKey] = item.value;
    const recordMap =
      row.cellRecordMap && typeof row.cellRecordMap === "object" ? row.cellRecordMap : null;
    const recordMeta = recordMap && recordMap[cellKey];
    if (row.cellMap && typeof row.cellMap === "object" && recordMeta) {
      Object.keys(recordMap).forEach((mapKey) => {
        if (mapKey === cellKey) return;
        if (recordMap[mapKey] !== recordMeta) return;
        row.cellMap[mapKey] = item.value;
      });
    }
    lockRowFormulaCell(row, cellKey);
  });
  return detail;
}

/** 兼容旧调用：仅加锁，不区分是否真覆盖（优先使用 capture + restore） */
export function lockPersistedComputedFormulaCells(detail = {}) {
  const snapshots = capturePersistedComputedCellSnapshots(detail);
  snapshots.forEach((item) => {
    const row = Array.isArray(detail.rows) ? detail.rows[item.rowIndex] : null;
    if (!row) return;
    lockRowFormulaCell(row, item.cellKey);
  });
  return detail;
}

function uniqueTextList(list = []) {
  const seen = {};
  const result = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const text = safeText(item);
    if (!text || seen[text]) return;
    seen[text] = true;
    result.push(text);
  });
  return result;
}

function writeRowCellRecordMeta(row = {}, keys = [], recordMeta = null) {
  if (!row || typeof row !== "object" || !recordMeta || typeof recordMeta !== "object") return;
  const uniqueKeys = uniqueTextList(keys).filter(Boolean);
  if (!uniqueKeys.length) return;
  if (!row.cellRecordMap || typeof row.cellRecordMap !== "object") row.cellRecordMap = {};
  if (!row.cellTargetMap || typeof row.cellTargetMap !== "object") row.cellTargetMap = {};
  uniqueKeys.forEach((key) => {
    row.cellRecordMap[key] = recordMeta;
    row.cellTargetMap[key] = recordMeta;
  });
}

function buildDraftCellRecordMeta(row = {}, draft = {}, options = {}) {
  const recordId = toMaybeLong(draft && (draft.recordId || draft.sourceRecordId || draft.id));
  if (recordId == null) return null;
  const submitIds = normalizeIdList([
    draft.submitIds,
    draft.targetSubmitIds,
    draft.submitId,
    draft.reviewDataSubmitId,
  ]);
  const yearLabel = safeText(options.yearLabel || draft.yearLabel);
  const trimId = safeText(options.trimId || draft.trimId || draft.trimName);
  const trimName = safeText(options.trimName || draft.trimName || trimId);
  const cellKey = safeText(options.cellKey || draft.cellKey);
  const dimensionKey = safeText(
    options.dimensionKey || draft.dimensionKey || (yearLabel ? `${yearLabel}__${trimId}` : cellKey)
  );
  const yearAggregateMode = safeText(draft.yearAggregateMode) || resolveYearAggregateMode(yearLabel);
  const draftModelYear = safeText(draft.modelYear) ? Number(draft.modelYear) : undefined;
  return {
    id: recordId,
    recordId,
    targetRecordIds: [recordId],
    submitIds,
    targetSubmitIds: submitIds,
    flowId: toMaybeLong(draft.flowId),
    node: safeText(draft.sourceStageCode || draft.stageCode || draft.node),
    recordStatus: safeText(draft.recordStatus).toUpperCase(),
    ownerId: safeText(draft.ownerId),
    ownerName: safeText(draft.ownerName),
    ownerPermission: readOwnerPermission(draft),
    subjectId: toMaybeLong(draft.subjectId || row.subjectId),
    modelName: safeText(draft.modelName),
    yearLabel,
    modelYear: Number.isFinite(draftModelYear) ? draftModelYear : resolveModelYear(yearLabel),
    yearAggregateMode,
    trimId,
    trimName,
    trimIndex: Number.isInteger(options.trimIndex) ? Number(options.trimIndex) : undefined,
    cellKey,
    dimensionKey,
  };
}

/**
 * 主表审核最终提交时，是否用当前节点草稿覆盖底稿单元格。
 * 避免历史错误归档的 0 值冲掉 S5 等底稿中的有效数。
 */
export function shouldApplyMainAuditDraftValue(baselineValue, draftValue) {
  const draftText = safeText(draftValue);
  if (!draftText || draftText === "-") return false;
  const draftNum = Number(String(draftText).replace(/,/g, ""));
  const baselineText = safeText(baselineValue).replace(/,/g, "");
  const baselineNum = Number(baselineText);
  if (Number.isFinite(draftNum) && draftNum === 0) {
    if (baselineText && Number.isFinite(baselineNum) && baselineNum !== 0) {
      return false;
    }
  }
  return true;
}

/**
 * 主表审核提交：仅合并应生效的审核草稿，再写回 detail。
 */
export function applyMainAuditDraftMapToDetail(detail = {}, draftMap = {}) {
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const rowMap = {};
  rows.forEach((row) => {
    const rowId = safeText(row && (row.id || row.rowId || row.subjectId));
    if (rowId) rowMap[rowId] = row;
  });

  const filteredMap = {};
  Object.keys(draftMap || {}).forEach((rowId) => {
    const row = rowMap[rowId];
    const cells = draftMap[rowId] || {};
    const nextCells = {};
    Object.keys(cells).forEach((cellKey) => {
      const draft = cells[cellKey];
      if (!draft || draft.value == null) return;
      const baselineValue =
        row && row.cells && typeof row.cells === "object"
          ? row.cells[cellKey]
          : null;
      if (!shouldApplyMainAuditDraftValue(baselineValue, draft.value)) return;
      nextCells[cellKey] = draft;
    });
    if (Object.keys(nextCells).length) {
      filteredMap[rowId] = nextCells;
    }
  });
  return applyDraftMapToDetail(detail, filteredMap);
}

/**
 * 仅回写 cellRecordMap / cellTargetMap，不修改 cells 数值（不影响公式重算）。
 */
export function applyRecordMetaDraftMapToDetail(detail = {}, draftMap = {}) {
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const dimensions = getDetailDimensions(detail);
  const trimOptions = normalizeTrimOptions(detail.trimOptions, dimensions.trims);
  const rowMap = {};
  rows.forEach((row) => {
    const rowId = safeText(row && (row.id || row.rowId || row.subjectId));
    if (rowId) rowMap[rowId] = row;
  });

  Object.keys(draftMap || {}).forEach((rowId) => {
    const row = rowMap[rowId];
    if (!row) return;
    const cells = draftMap[rowId] || {};
    Object.keys(cells).forEach((cellKey) => {
      const draft = cells[cellKey];
      if (!draft) return;
      const parsed = parseCellKey(cellKey);
      if (!parsed) {
        if (!isRndAmountCellKey(cellKey)) return;
        const recordMeta = buildDraftCellRecordMeta(row, draft, {
          cellKey,
          dimensionKey: cellKey,
        });
        writeRowCellRecordMeta(row, [cellKey], recordMeta);
        return;
      }
      const yearLabel = dimensions.years[parsed.yearIndex] || "";
      const trim = trimOptions[parsed.trimIndex] || {};
      const trimId = safeText(trim.trimId || dimensions.trims[parsed.trimIndex] || "");
      const trimName = safeText(trim.trimName || dimensions.trims[parsed.trimIndex] || trimId);
      const dimensionKey = safeText(draft.dimensionKey || `${yearLabel}__${trimId}`);
      const trimIdDimensionKey = `${yearLabel}__${trimId}`;
      const trimNameDimensionKey = yearLabel && trimName ? `${yearLabel}__${trimName}` : "";
      const recordMeta = buildDraftCellRecordMeta(row, draft, {
        yearLabel,
        trimId,
        trimName,
        trimIndex: parsed.trimIndex,
        cellKey,
        dimensionKey,
      });
      writeRowCellRecordMeta(
        row,
        [cellKey, dimensionKey, trimIdDimensionKey, trimNameDimensionKey],
        recordMeta
      );
    });
  });

  return detail;
}

/**
 * 将保存/提交接口返回的 affectedRecords 绑定到矩阵 cellRecordMap。
 */
export function applyAffectedRecordsMetaToDetail(ctx = {}, detail = {}, records = []) {
  const list = Array.isArray(records) ? records : [];
  if (!list.length || !detail || typeof detail !== "object") return detail;
  setAuditContextCache(ctx, { detail, fillDetail: detail });
  const draftMap = buildDraftMapFromRecords(ctx, list, null, {
    includeOwnerPermissionFilter: false,
  });
  return applyRecordMetaDraftMapToDetail(detail, draftMap);
}

export function applyDraftMapToDetail(detail = {}, draftMap = {}) {
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const dimensions = getDetailDimensions(detail);
  const trimOptions = normalizeTrimOptions(detail.trimOptions, dimensions.trims);
  const rowMap = {};
  rows.forEach((row) => {
    const rowId = safeText(row && (row.id || row.rowId || row.subjectId));
    if (rowId) rowMap[rowId] = row;
  });

  Object.keys(draftMap || {}).forEach((rowId) => {
    const row = rowMap[rowId];
    if (!row) return;
    const cells = draftMap[rowId] || {};
    Object.keys(cells).forEach((cellKey) => {
      const draft = cells[cellKey];
      if (!draft) return;
      const parsed = parseCellKey(cellKey);
      if (!parsed) {
        if (!isRndAmountCellKey(cellKey)) return;
        const recordMeta = buildDraftCellRecordMeta(row, draft, {
          cellKey,
          dimensionKey: cellKey,
        });
        writeRowCellRecordMeta(row, [cellKey], recordMeta);
        if (draft.value == null) return;
        if (!row.cells || typeof row.cells !== "object") row.cells = {};
        row.cells[cellKey] = String(draft.value);
        lockRowFormulaCell(row, cellKey);
        if (cellKey === RND_INVESTMENT_TAX_INCLUDED_CELL_KEY) row.rndInvestmentTaxIncludedAmount = String(draft.value);
        if (cellKey === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY) {
          row.rndInvestmentTaxExcludedAmount = String(draft.value);
          row.rndInvestmentAmount = String(draft.value);
        }
        return;
      }
      const yearLabel = dimensions.years[parsed.yearIndex] || "";
      const trim = trimOptions[parsed.trimIndex] || {};
      const trimId = safeText(trim.trimId || dimensions.trims[parsed.trimIndex] || "");
      const trimName = safeText(trim.trimName || dimensions.trims[parsed.trimIndex] || trimId);
      const dimensionKey = safeText(draft.dimensionKey || `${yearLabel}__${trimId}`);
      const trimIdDimensionKey = `${yearLabel}__${trimId}`;
      const trimNameDimensionKey = yearLabel && trimName ? `${yearLabel}__${trimName}` : "";
      const recordMeta = buildDraftCellRecordMeta(row, draft, {
        yearLabel,
        trimId,
        trimName,
        trimIndex: parsed.trimIndex,
        cellKey,
        dimensionKey,
      });
      writeRowCellRecordMeta(row, [cellKey, dimensionKey, trimIdDimensionKey, trimNameDimensionKey], recordMeta);
      if (draft.value == null) return;

      if (!row.cells || typeof row.cells !== "object") row.cells = {};
      if (!row.cellMap || typeof row.cellMap !== "object") row.cellMap = {};
      row.cells[cellKey] = String(draft.value);
      lockRowFormulaCell(row, cellKey);
      if (dimensionKey) row.cellMap[dimensionKey] = String(draft.value);
      if (trimIdDimensionKey && trimIdDimensionKey !== dimensionKey) {
        row.cellMap[trimIdDimensionKey] = String(draft.value);
      }
      if (trimNameDimensionKey && trimNameDimensionKey !== dimensionKey) {
        row.cellMap[trimNameDimensionKey] = String(draft.value);
      }
    });
  });

  return detail;
}
