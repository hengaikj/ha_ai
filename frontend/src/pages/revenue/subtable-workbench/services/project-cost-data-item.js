import { isLifecycleYearLabel, isVirtualTrimValue } from "../matrix-utils";
import { buildRevenueValuePayload } from "../value-normalizer";
import {
  buildRecordCandidateFromRaw,
  normalizeRecordCellValue,
  normalizeRecordId,
  normalizeRecordStatus,
  normalizeRecordSubmitIds,
  normalizeTargetRecordIds,
  normalizeTargetSubmitIds,
  shouldReplaceRecordCandidate,
} from "./record-utils";
import { readOwnerPermission, safeText, toMaybeLong } from "./workbench-utils";

export function resolveYearAggregateMode(yearLabel = "") {
  const yearText = safeText(yearLabel);
  if (yearText === "合计") return "COMBINED";
  if (/^\d{4}年$/.test(yearText)) return "SPECIFIC";
  if (/^\d{4}$/.test(yearText)) return "SPECIFIC";
  if (/^\d+$/.test(yearText)) return "SPECIFIC";
  return "NONE";
}

export function resolveModelYear(yearLabel = "") {
  const text = safeText(yearLabel);
  const match = /^(\d{4})年?$/.exec(text);
  const year = match ? Number(match[1]) : Number(text);
  if (!Number.isFinite(year)) return undefined;
  return year;
}

export function isSavableYearLabel(yearLabel = "") {
  const text = safeText(yearLabel);
  if (!text || isLifecycleYearLabel(text)) return false;
  if (!/^\d{4}年?$/.test(text)) return false;
  if (resolveYearAggregateMode(text) !== "SPECIFIC") return false;
  return resolveModelYear(text) != null;
}

export function isSavableTrimName(trimName = "") {
  const text = safeText(trimName);
  return Boolean(text && !isVirtualTrimValue(text));
}

function resolveValuePayload(value, options = {}) {
  return buildRevenueValuePayload(value, { unit: options.unit });
}

export function buildProjectCostDataItem(params = {}) {
  const subjectId = toMaybeLong(params.subjectId);
  if (subjectId == null) return null;
  const id = toMaybeLong(params.id);
  const yearLabel = safeText(params.yearLabel || params.year);
  const yearOnly = Boolean(params.yearOnly);
  const explicitYearAggregateMode = safeText(params.yearAggregateMode).toUpperCase();
  const hasExplicitYearAggregateMode = ["NONE", "COMBINED", "SPECIFIC"].includes(explicitYearAggregateMode);
  const trimName = yearOnly || (hasExplicitYearAggregateMode && explicitYearAggregateMode !== "SPECIFIC")
    ? ""
    : safeText(params.trimName || params.trimId, "默认版型");
  const valuePayload = resolveValuePayload(params.value, { unit: params.unit });
  const yearAggregateMode = hasExplicitYearAggregateMode
    ? explicitYearAggregateMode
    : resolveYearAggregateMode(yearLabel);
  const modelYear = yearAggregateMode === "SPECIFIC"
    ? resolveModelYear(params.modelYear != null ? params.modelYear : yearLabel)
    : undefined;
  if (
    yearAggregateMode === "SPECIFIC" &&
    (!isSavableYearLabel(yearLabel || params.modelYear) || modelYear == null)
  ) {
    return null;
  }
  if (yearAggregateMode !== "SPECIFIC" && !hasExplicitYearAggregateMode) return null;
  if (!(yearOnly || yearAggregateMode !== "SPECIFIC") && !isSavableTrimName(trimName)) return null;
  const item = {
    subjectId,
    modelName: safeText(params.modelName || params.projectCode),
    yearAggregateMode,
    valueType: valuePayload.valueType,
    rawValue: valuePayload.rawValue,
    numberValue: valuePayload.numberValue,
    textValue: valuePayload.textValue,
  };
  if (modelYear != null) {
    item.modelYear = modelYear;
  }
  if (!yearOnly && yearAggregateMode === "SPECIFIC") {
    item.trimName = trimName;
  }
  if (id != null) {
    item.id = id;
  }
  return item;
}

export function readRowMatrixValue(row, yearLabel, trimName, yearIndex, trimIndex) {
  if (!row || typeof row !== "object") return "";
  const cells = row.cells && typeof row.cells === "object" ? row.cells : {};
  const legacyKey = `y${yearIndex}_t${trimIndex}`;
  if (Object.prototype.hasOwnProperty.call(cells, legacyKey)) {
    return cells[legacyKey];
  }

  const dimensionKey = `${safeText(yearLabel)}__${safeText(trimName)}`;
  const cellMap =
    (row.cellMap && typeof row.cellMap === "object" ? row.cellMap : null) ||
    (row.cellsByDimension && typeof row.cellsByDimension === "object" ? row.cellsByDimension : null) ||
    (row.dimensionCells && typeof row.dimensionCells === "object" ? row.dimensionCells : null);
  if (cellMap && Object.prototype.hasOwnProperty.call(cellMap, dimensionKey)) {
    return cellMap[dimensionKey];
  }

  return "";
}

export function readRowMatrixRecordMeta(row, yearLabel, trimName, yearIndex, trimIndex) {
  if (!row || typeof row !== "object") return null;
  const recordMap =
    (row.cellRecordMap && typeof row.cellRecordMap === "object" ? row.cellRecordMap : null) ||
    (row.recordMap && typeof row.recordMap === "object" ? row.recordMap : null);
  if (!recordMap) return null;

  const legacyKey = `y${yearIndex}_t${trimIndex}`;
  if (Object.prototype.hasOwnProperty.call(recordMap, legacyKey)) {
    return recordMap[legacyKey];
  }

  const dimensionKey = `${safeText(yearLabel)}__${safeText(trimName)}`;
  if (Object.prototype.hasOwnProperty.call(recordMap, dimensionKey)) {
    return recordMap[dimensionKey];
  }

  return null;
}

export function readRowMatrixTargetMeta(row, yearLabel, trimName, yearIndex, trimIndex) {
  if (!row || typeof row !== "object") return null;
  const targetMap =
    (row.cellTargetMap && typeof row.cellTargetMap === "object" ? row.cellTargetMap : null) ||
    (row.targetMap && typeof row.targetMap === "object" ? row.targetMap : null);
  const legacyKey = `y${yearIndex}_t${trimIndex}`;
  if (targetMap && Object.prototype.hasOwnProperty.call(targetMap, legacyKey)) {
    return targetMap[legacyKey];
  }

  const dimensionKey = `${safeText(yearLabel)}__${safeText(trimName)}`;
  if (targetMap && Object.prototype.hasOwnProperty.call(targetMap, dimensionKey)) {
    return targetMap[dimensionKey];
  }

  return readRowMatrixRecordMeta(row, yearLabel, trimName, yearIndex, trimIndex);
}

export function readRowMatrixRecordMetaByCellKey(row = {}, cellKey = "") {
  const key = safeText(cellKey);
  if (!row || !key) return null;
  const recordMap =
    (row.cellRecordMap && typeof row.cellRecordMap === "object" ? row.cellRecordMap : null) ||
    (row.recordMap && typeof row.recordMap === "object" ? row.recordMap : null);
  if (!recordMap) return null;
  return Object.prototype.hasOwnProperty.call(recordMap, key) ? recordMap[key] : null;
}

export function readRowMatrixTargetMetaByCellKey(row = {}, cellKey = "") {
  const key = safeText(cellKey);
  if (!row || !key) return null;
  const targetMap =
    (row.cellTargetMap && typeof row.cellTargetMap === "object" ? row.cellTargetMap : null) ||
    (row.targetMap && typeof row.targetMap === "object" ? row.targetMap : null);
  if (targetMap && Object.prototype.hasOwnProperty.call(targetMap, key)) {
    return targetMap[key];
  }
  return readRowMatrixRecordMetaByCellKey(row, key);
}

export function isOwnedDraftRecordMeta(meta, _ctx) {
  if (!meta || typeof meta !== "object") return false;
  if (toMaybeLong(meta.id) == null) return false;
  if (safeText(meta.recordStatus).toUpperCase() !== "DRAFT") return false;
  return true;
}

export function mergeTargetIds(result, target = {}) {
  normalizeTargetRecordIds(target).forEach((id) => {
    if (!result.targetRecordIds.includes(id)) result.targetRecordIds.push(id);
  });
  normalizeTargetSubmitIds(target).forEach((id) => {
    if (!result.targetSubmitIds.includes(id)) result.targetSubmitIds.push(id);
  });
}

export function collectRowTargetIds(row = {}) {
  const result = {
    targetRecordIds: [],
    targetSubmitIds: [],
  };
  const map =
    (row.cellTargetMap && typeof row.cellTargetMap === "object" ? row.cellTargetMap : null) ||
    (row.cellRecordMap && typeof row.cellRecordMap === "object" ? row.cellRecordMap : null) ||
    {};
  Object.keys(map).forEach((key) => mergeTargetIds(result, map[key]));
  return result;
}

export function getProjectCostDataItemKey(item = {}) {
  return [
    safeText(item.subjectId),
    safeText(item.modelName).toLowerCase(),
    safeText(item.trimName).toLowerCase(),
    safeText(item.yearAggregateMode),
    item.modelYear == null ? "-1" : safeText(item.modelYear),
  ].join("__");
}

export function dedupeProjectCostDataItems(items = []) {
  const map = {};
  const order = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item) return;
    const key = getProjectCostDataItemKey(item);
    if (!map[key]) {
      order.push(key);
      map[key] = item;
      return;
    }
    if (map[key].id == null && item.id != null) {
      map[key] = item;
      return;
    }
    map[key] = {
      ...map[key],
      ...item,
      id: map[key].id != null ? map[key].id : item.id,
    };
  });
  return order.map((key) => map[key]);
}

export function extractProjectCostDataItemSubjectIds(dataItems = []) {
  const map = {};
  (Array.isArray(dataItems) ? dataItems : []).forEach((item) => {
    const subjectId = toMaybeLong(item && item.subjectId);
    if (subjectId != null) map[subjectId] = true;
  });
  return Object.keys(map).map((id) => Number(id)).filter((id) => Number.isFinite(id));
}

export function getProjectCostRecordDataItemKey(record = {}) {
  return getProjectCostDataItemKey({
    subjectId: record.subjectId,
    modelName: record.modelName,
    trimName: record.trimName,
    yearAggregateMode: record.yearAggregateMode,
    modelYear: record.modelYear,
  });
}

export function normalizeHistoryImportModelYears(values = []) {
  const result = [];
  const seen = {};
  (Array.isArray(values) ? values : []).forEach((item) => {
    const number = Number(item);
    if (!Number.isFinite(number) || number <= 0 || seen[number]) return;
    seen[number] = true;
    result.push(Math.trunc(number));
  });
  return result;
}

export function normalizeHistoryImportTrimNames(values = []) {
  const result = [];
  const seen = {};
  (Array.isArray(values) ? values : []).forEach((item) => {
    const text = safeText(item);
    const key = text.toLowerCase();
    if (!text || seen[key]) return;
    seen[key] = true;
    result.push(text);
  });
  return result;
}

export function pickLatestRecordsByDataItemKey(records = []) {
  const map = {};
  const order = [];
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!record || typeof record !== "object") return;
    const key = getProjectCostRecordDataItemKey(record);
    if (!map[key]) {
      order.push(key);
      map[key] = record;
      return;
    }
    const nextCandidate = buildRecordCandidateFromRaw(record);
    const currentCandidate = buildRecordCandidateFromRaw(map[key]);
    if (shouldReplaceRecordCandidate(nextCandidate, currentCandidate)) {
      map[key] = record;
    }
  });
  return order.map((key) => map[key]);
}

export function mapRecordsByDataItemKey(records = []) {
  return pickLatestRecordsByDataItemKey(records).reduce((result, record) => {
    result[getProjectCostRecordDataItemKey(record)] = record;
    return result;
  }, {});
}

export function resolveHistoryDraftBlockedReason(record, targetModelYears = [], targetTrimNames = []) {
  if (!safeText(record && record.rawValue)) return "来源草稿值为空";
  if (safeText(record && record.yearAggregateMode).toUpperCase() !== "SPECIFIC") return "";

  const year = Number(record && record.modelYear);
  if (targetModelYears.length && (!Number.isFinite(year) || !targetModelYears.includes(year))) {
    return "来源年份不在当前填报维度";
  }

  const sourceTrimName = safeText(record && record.trimName);
  const targetTrimNameMap = {};
  targetTrimNames.forEach((item) => {
    targetTrimNameMap[safeText(item).toLowerCase()] = true;
  });
  if (sourceTrimName && targetTrimNames.length && !targetTrimNameMap[sourceTrimName.toLowerCase()]) {
    return "来源版型不在当前填报维度";
  }
  return "";
}

export function buildHistoryDraftImportItem(sourceRecord, currentRecord, currentDraftRecord, options = {}) {
  const blockedReason = resolveHistoryDraftBlockedReason(
    sourceRecord,
    options.targetModelYears,
    options.targetTrimNames
  );
  const currentRawValue = currentRecord ? normalizeRecordCellValue(currentRecord) : "";
  return {
    subjectId: toMaybeLong(sourceRecord && sourceRecord.subjectId),
    vehicleSourceType: safeText(sourceRecord && sourceRecord.vehicleSourceType),
    modelName: safeText(sourceRecord && sourceRecord.modelName),
    trimName: safeText(sourceRecord && sourceRecord.trimName),
    modelYear: sourceRecord && sourceRecord.modelYear,
    yearAggregateMode: safeText(sourceRecord && sourceRecord.yearAggregateMode),
    sourceRecordId: normalizeRecordId(sourceRecord),
    sourceSubmitIds: normalizeRecordSubmitIds(sourceRecord),
    sourceValvePoint: safeText(sourceRecord && sourceRecord.valvePoint, options.sourceValvePoint),
    sourceNode: safeText(sourceRecord && sourceRecord.node),
    sourceRecordStatus: normalizeRecordStatus(sourceRecord),
    sourceOwnerId: safeText(sourceRecord && sourceRecord.ownerId),
    sourceOwnerName: safeText(sourceRecord && sourceRecord.ownerName),
    sourceOwnerPermission: readOwnerPermission(sourceRecord),
    sourceValueType: safeText(sourceRecord && sourceRecord.valueType),
    sourceRawValue: safeText(sourceRecord && sourceRecord.rawValue),
    sourceNumberValue: sourceRecord && sourceRecord.numberValue,
    sourceTextValue: sourceRecord && sourceRecord.textValue,
    sourceCreatedAt: sourceRecord && sourceRecord.createdAt,
    currentRecordId: currentRecord ? normalizeRecordId(currentRecord) : null,
    currentRecordStatus: currentRecord ? normalizeRecordStatus(currentRecord) : "",
    currentOwnerId: safeText(currentRecord && currentRecord.ownerId),
    currentOwnerName: safeText(currentRecord && currentRecord.ownerName),
    currentRawValue,
    importable: !blockedReason,
    willOverwrite: Boolean(safeText(currentRawValue)),
    blockedReason,
    sourceRecord,
    currentDraftRecord,
  };
}

export function buildProjectCostDataItemFromRecord(record = {}, currentDraftRecord = null) {
  const item = {
    subjectId: toMaybeLong(record.subjectId),
    modelName: safeText(record.modelName),
    vehicleSourceType: safeText(record.vehicleSourceType) || undefined,
    yearAggregateMode: safeText(record.yearAggregateMode),
    valueType: safeText(record.valueType, "TEXT"),
    rawValue: safeText(record.rawValue),
    numberValue: record.numberValue,
    textValue: record.textValue,
  };
  const currentDraftRecordId = normalizeRecordId(currentDraftRecord);
  if (currentDraftRecordId != null) item.id = currentDraftRecordId;
  if (record.modelYear != null) item.modelYear = Number(record.modelYear);
  if (safeText(record.trimName)) item.trimName = safeText(record.trimName);
  if (item.valueType === "NUMBER") {
    item.textValue = undefined;
  } else {
    item.numberValue = undefined;
    item.textValue = safeText(item.textValue || item.rawValue);
  }
  return item;
}
