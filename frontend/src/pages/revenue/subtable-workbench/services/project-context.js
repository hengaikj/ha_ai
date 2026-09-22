import { projectGet as projectGetApi } from "@/api/project";
import {
  resolveModelYear,
  resolveYearAggregateMode,
} from "./project-cost-data-item";
import {
  normalizeRecordId,
  normalizeRecordStatus,
  normalizeRecordSubmitIds,
  normalizeRecordTrimLabel,
  normalizeRecordYearLabel,
} from "./record-utils";
import {
  parseListPayload,
  readOwnerPermission,
  safeText,
  toMaybeLong,
} from "./workbench-utils";

const PROJECT_CONTEXT_CACHE = {};

function extractPatternList(payload) {
  return parseListPayload(payload);
}

function normalizeProjectIdentity(value) {
  return safeText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readProjectModelIdentifiers(row = {}) {
  const vehicleModel =
    row && row.vehicleModel && typeof row.vehicleModel === "object" ? row.vehicleModel : {};
  const result = [];
  const seen = {};
  [
    vehicleModel.modelNumber,
    vehicleModel.modelName,
    row.modelName,
    row.vehicleModelName,
    row.projectName,
    row.projectCode,
    row.projectNo,
    row.wbsNumber,
  ].forEach((item) => {
    const text = safeText(item);
    const key = text.toLowerCase();
    if (!text || seen[key]) return;
    seen[key] = true;
    result.push(text);
  });
  return result;
}

function normalizeProjectPattern(item) {
  if (!item || typeof item !== "object") return null;
  const pattern =
    item.pattern && typeof item.pattern === "object" && !Array.isArray(item.pattern)
      ? item.pattern
      : item;
  const patternName = safeText(
    pattern.patternName || pattern.patternNumber || pattern.name || pattern.label
  );
  if (!patternName) return null;
  const patternId = safeText(
    item.patternId || pattern.id || item.id || pattern.patternNumber || patternName
  );
  return {
    id: patternId,
    patternId,
    patternName,
    trimName: patternName,
    name: patternName,
  };
}

function extractBenefitCostPatternVos(row = {}) {
  const list = Array.isArray(row && row.benefitCostPatternVos) ? row.benefitCostPatternVos : [];
  const result = [];
  const seen = {};
  list.forEach((item) => {
    const pattern = normalizeProjectPattern(item);
    if (!pattern) return;
    const key = `${pattern.patternId}__${pattern.patternName}`;
    if (seen[key]) return;
    seen[key] = true;
    result.push(pattern);
  });
  return result;
}

function resolveProjectListModelName(ctx = {}) {
  // /system/project/list 的 modelName 按车型名过滤，优先 projectName/modelName；
  // projectCode/projectNo 在收益侧常为 WBS，仅作兜底。
  return safeText(ctx.projectName || ctx.modelName || ctx.projectCode || ctx.projectNo);
}

function getProjectContextCacheKey(modelName) {
  return safeText(modelName).toLowerCase();
}

async function requestProjectRowsFromUnifiedList(ctx = {}) {
  const modelName = resolveProjectListModelName(ctx);
  if (!modelName) return [];
  const cacheKey = getProjectContextCacheKey(modelName);
  if (!PROJECT_CONTEXT_CACHE[cacheKey]) {
    PROJECT_CONTEXT_CACHE[cacheKey] = projectGetApi({
      modelName,
      pageNum: 1,
      pageSize: 200,
    }).then((payload) => extractPatternList(payload)).catch(() => {
      delete PROJECT_CONTEXT_CACHE[cacheKey];
      return [];
    });
  }
  return PROJECT_CONTEXT_CACHE[cacheKey];
}

function findMatchedProjectRow(ctx = {}, rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const projectId = safeText(ctx.projectId);
  if (projectId) {
    const matchedById = list.find((row) =>
      safeText(row && (row.id || row.projectId)) === projectId
    );
    if (matchedById) return matchedById;
  }

  const normalizedTargetMap = {};
  const compactTargetMap = {};
  [ctx.projectCode, ctx.projectNo, ctx.projectName].forEach((item) => {
    const text = safeText(item).toLowerCase();
    const compact = normalizeProjectIdentity(item);
    if (text) normalizedTargetMap[text] = true;
    if (compact) compactTargetMap[compact] = true;
  });

  const matchedByIdentity = list.find((row) => {
    return readProjectModelIdentifiers(row).some((item) => {
      const text = safeText(item).toLowerCase();
      const compact = normalizeProjectIdentity(item);
      return Boolean(
        (text && normalizedTargetMap[text]) ||
          (compact && compactTargetMap[compact])
      );
    });
  });
  if (matchedByIdentity) return matchedByIdentity;

  return list.length === 1 ? list[0] : null;
}

export async function requestProjectPatternList(ctx) {
  try {
    const rows = await requestProjectRowsFromUnifiedList(ctx);
    const matchedRow = findMatchedProjectRow(ctx, rows);
    return matchedRow ? extractBenefitCostPatternVos(matchedRow) : [];
  } catch (_error) {
    return [];
  }
}

export function buildTrimOptions(patternList = [], preferredRecords = []) {
  const map = {};
  const result = [];

  const append = (trimName) => {
    const name = safeText(trimName);
    if (!name || map[name]) return;
    map[name] = true;
    result.push({
      trimId: name,
      trimName: name,
      trimIndex: result.length,
    });
  };

  (Array.isArray(patternList) ? patternList : []).forEach((item) => {
    append(item && (item.patternName || item.trimName || item.name || item.label));
  });

  if (!result.length) {
    (Array.isArray(preferredRecords) ? preferredRecords : []).forEach((record) => {
      append(record && record.trimName);
    });
  }

  if (!result.length) {
    append("默认版型");
  }

  return result;
}

export function buildCellTargetMeta(record, options = {}) {
  const recordId = normalizeRecordId(record);
  const submitIds = normalizeRecordSubmitIds(record);
  const yearLabel = safeText(options.yearLabel || normalizeRecordYearLabel(record));
  const hasTrimNameOption = Object.prototype.hasOwnProperty.call(options, "trimName");
  const hasTrimIdOption = Object.prototype.hasOwnProperty.call(options, "trimId");
  const trimName = hasTrimNameOption
    ? safeText(options.trimName)
    : safeText(normalizeRecordTrimLabel(record), "默认版型");
  const trimId = hasTrimIdOption ? safeText(options.trimId) : safeText(trimName, trimName);
  const yearAggregateMode = safeText(record && record.yearAggregateMode) ||
    resolveYearAggregateMode(yearLabel);
  return {
    id: recordId,
    recordId,
    targetRecordIds: recordId != null ? [recordId] : [],
    submitIds,
    targetSubmitIds: submitIds,
    flowId: toMaybeLong(record && record.flowId),
    node: safeText(record && record.node),
    recordStatus: normalizeRecordStatus(record),
    ownerId: safeText(record && record.ownerId),
    ownerName: safeText(record && record.ownerName),
    ownerPermission: readOwnerPermission(record),
    subjectId: toMaybeLong(record && record.subjectId),
    modelName: safeText(record && record.modelName),
    yearLabel,
    modelYear: record && record.modelYear != null ? Number(record.modelYear) : resolveModelYear(yearLabel),
    yearAggregateMode,
    trimId,
    trimName,
    trimIndex: Number.isInteger(options.trimIndex) ? Number(options.trimIndex) : undefined,
    cellKey: safeText(options.cellKey),
    dimensionKey: safeText(options.dimensionKey, `${yearLabel}__${trimId}`),
  };
}

export function isBlankRecordModelYear(record = {}) {
  return record && (record.modelYear == null || safeText(record.modelYear) === "");
}

export function isBlankRecordTrim(record = {}) {
  return !safeText(record && (record.trimName || record.trimId));
}

export function clearProjectContextCache() {
  Object.keys(PROJECT_CONTEXT_CACHE).forEach((key) => delete PROJECT_CONTEXT_CACHE[key]);
}
