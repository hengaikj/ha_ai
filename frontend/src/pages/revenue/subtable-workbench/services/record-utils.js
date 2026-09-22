import { normalizeStageCode } from "../domain-config";
import { readRecordStorageValue, toStorageValue } from "../value-normalizer";
import { normalizeIdList, safeText, toMaybeLong } from "./workbench-utils";

const STAGE_FLOW_CODES = ["S1", "S2", "S3", "S4", "S5", "S6", "S8"];
const RND_AMOUNT_DISPLAY_VALUE_MAX_ABS = 10000;

export function normalizeRecordYearLabel(record) {
  const year = record && record.modelYear;
  if (year != null && String(year).trim() !== "") {
    return String(year).trim();
  }
  const mode = safeText(record && record.yearAggregateMode).toUpperCase();
  if (mode === "COMBINED") return "合计";
  if (mode === "NONE") return "未区分";
  return "未区分";
}

export function normalizeRecordTrimLabel(record, fallback = "默认版型") {
  return safeText(record && record.trimName, fallback);
}

export function normalizeRecordCellValue(record) {
  return readRecordStorageValue(record);
}

// Legacy S1 R&D total records can carry the table display value in 万元.
export function normalizeRndTechnicalAmountRecordCellValue(record) {
  const value = normalizeRecordCellValue(record);
  const numericValue = Number(String(value == null ? "" : value).replace(/,/g, "").trim());
  if (!Number.isFinite(numericValue) || numericValue === 0) return value;
  if (Math.abs(numericValue) >= RND_AMOUNT_DISPLAY_VALUE_MAX_ABS) return value;
  const normalized = toStorageValue(value, "万元");
  return normalized.ok && normalized.storageValue != null ? normalized.storageValue : value;
}

export function normalizeRecordId(record) {
  return toMaybeLong(record && (record.id || record.recordId));
}

export function normalizeRecordStatus(record) {
  return safeText(record && (record.recordStatus || record.status)).toUpperCase();
}

export function filterRecordsBySubjectIds(records = [], subjectIds = []) {
  if (!Array.isArray(subjectIds) || !subjectIds.length) return records;
  const subjectIdMap = {};
  subjectIds.forEach((id) => {
    subjectIdMap[safeText(id)] = true;
  });
  return (Array.isArray(records) ? records : []).filter((record) =>
    Boolean(subjectIdMap[safeText(record && record.subjectId)])
  );
}

export function normalizeRecordSubmitIds(record) {
  const source = record && typeof record === "object" ? record : {};
  const values = [];
  if (Array.isArray(source.submitIds)) values.push(...source.submitIds);
  if (Array.isArray(source.submitIdList)) values.push(...source.submitIdList);
  values.push(source.submitId, source.submit_id);
  return values
    .map((item) => toMaybeLong(item))
    .filter((item, index, list) => item != null && list.indexOf(item) === index);
}

function getStageRank(stageCode) {
  const normalized = safeText(stageCode);
  if (!normalized) return -1;
  return STAGE_FLOW_CODES.indexOf(normalizeStageCode(normalized));
}

export function getPreferredRecordDataKey(record = {}) {
  return [
    safeText(record && record.subjectId),
    safeText(record && record.modelName).toLowerCase(),
    normalizeRecordTrimLabel(record, "").toLowerCase(),
    safeText(record && record.yearAggregateMode),
    record && record.modelYear == null ? "-1" : safeText(record && record.modelYear),
  ].join("__");
}

export function hasRecordDirectReviewLink(record = {}, reviewIndex = null) {
  if (!reviewIndex || !reviewIndex.byReviewDataSubmitId) return false;
  return normalizeRecordSubmitIds(record).some((submitId) =>
    Boolean(reviewIndex.byReviewDataSubmitId[submitId])
  );
}

export function buildRecordCandidateFromRaw(record = {}, options = {}) {
  return {
    recordId: normalizeRecordId(record),
    sourceStageCode: safeText(record && record.node),
    recordStatus: normalizeRecordStatus(record),
    submitIds: normalizeRecordSubmitIds(record),
    time: safeText(record && (record.updatedAt || record.createdAt)),
    directReviewLinked: hasRecordDirectReviewLink(record, options.reviewIndex),
  };
}

function getRecordCandidateTimeValue(entry = {}) {
  const parsed = Date.parse(entry.time || "");
  if (parsed) return parsed;
  return Number(entry.recordId || entry.reviewId || entry.reviewDataSubmitId || 0) || 0;
}

function getRecordCandidateSubmitValue(entry = {}) {
  const submitIds = normalizeIdList([
    entry.submitIds,
    entry.targetSubmitIds,
    entry.submitId,
    entry.reviewDataSubmitId,
  ]);
  if (!submitIds.length) return 0;
  return Math.max(...submitIds);
}

/**
 * @param {object} [options]
 * @param {boolean} [options.preferLatestByTime] 同阶段按更新时间优先（S3 重新编辑后的 DRAFT 可覆盖旧 ARCHIVED）
 */
export function shouldReplaceRecordCandidate(nextEntry, currentEntry, options = {}) {
  if (!currentEntry) return true;
  const nextStageRank = getStageRank(nextEntry && (nextEntry.sourceStageCode || nextEntry.stageCode || nextEntry.node));
  const currentStageRank = getStageRank(currentEntry && (currentEntry.sourceStageCode || currentEntry.stageCode || currentEntry.node));
  if (nextStageRank !== currentStageRank) return nextStageRank > currentStageRank;
  const nextStatus = safeText(nextEntry && nextEntry.recordStatus).toUpperCase();
  const currentStatus = safeText(currentEntry && currentEntry.recordStatus).toUpperCase();
  const nextTimeValue = getRecordCandidateTimeValue(nextEntry);
  const currentTimeValue = getRecordCandidateTimeValue(currentEntry);
  // S3 二次确认：允许较新的 DRAFT 覆盖旧 ARCHIVED，否则重新编辑改值刷新后仍显示旧值
  if (options.preferLatestByTime) {
    if (nextTimeValue !== currentTimeValue) return nextTimeValue > currentTimeValue;
  } else {
    if (nextStatus === "ARCHIVED" && currentStatus !== "ARCHIVED") return true;
    if (currentStatus === "ARCHIVED" && nextStatus !== "ARCHIVED") return false;
  }
  const nextSubmitValue = getRecordCandidateSubmitValue(nextEntry);
  const currentSubmitValue = getRecordCandidateSubmitValue(currentEntry);
  if (nextSubmitValue !== currentSubmitValue) return nextSubmitValue > currentSubmitValue;
  if (nextTimeValue !== currentTimeValue) return nextTimeValue > currentTimeValue;
  const nextRecordId = Number(nextEntry && nextEntry.recordId || 0);
  const currentRecordId = Number(currentEntry && currentEntry.recordId || 0);
  if (nextRecordId !== currentRecordId) return nextRecordId > currentRecordId;
  return Number(nextEntry && nextEntry.recordId || 0) >= Number(currentEntry && currentEntry.recordId || 0);
}

export function dedupePreferredRecords(records = [], options = {}) {
  const map = {};
  const order = [];
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!record || typeof record !== "object") return;
    const key = getPreferredRecordDataKey(record);
    if (!key) return;
    if (!map[key]) {
      order.push(key);
      map[key] = record;
      return;
    }
    const nextCandidate = buildRecordCandidateFromRaw(record, options);
    const currentCandidate = buildRecordCandidateFromRaw(map[key], options);
    if (
      options.preferDirectReviewLink &&
      nextCandidate.directReviewLinked !== currentCandidate.directReviewLinked
    ) {
      if (nextCandidate.directReviewLinked) {
        map[key] = record;
      }
      return;
    }
    if (shouldReplaceRecordCandidate(nextCandidate, currentCandidate)) {
      map[key] = record;
    }
  });
  return order.map((key) => map[key]);
}

export function normalizeTargetRecordIds(source = {}) {
  if (!source || typeof source !== "object") return [];
  return normalizeIdList([
    source.targetRecordIds,
    source.recordIds,
    source.recordId,
    source.id,
  ]);
}

export function normalizeTargetSubmitIds(source = {}) {
  if (!source || typeof source !== "object") return [];
  return normalizeIdList([
    source.targetSubmitIds,
    source.submitIds,
    source.submitIdList,
    source.submitId,
    source.reviewDataSubmitId,
  ]);
}
