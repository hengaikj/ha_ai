export function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || fallback;
}

export function normalizeRecordId(record = {}) {
  const value = record && (record.id != null ? record.id : record.recordId);
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null;
}

export function appendUniquePositiveId(target = [], value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return;
  const id = Math.trunc(number);
  if (!target.includes(id)) target.push(id);
}

export function toNonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.trunc(number);
}

export function buildProjectCostDataItemKey(item = {}) {
  return [
    safeText(item.subjectId),
    safeText(item.modelName).toLowerCase(),
    safeText(item.trimName).toLowerCase(),
    safeText(item.yearAggregateMode),
    item.modelYear == null ? "-1" : safeText(item.modelYear),
  ].join("__");
}

/**
 * 为待保存项补齐已有 DRAFT 的 recordId。
 * @param {object} [options]
 * @param {boolean} [options.forceReplace] 为 true 时即使已有 id 也改为同格最新草稿（S3 跨用户共享）
 */
export function attachExistingDraftRecordIds(dataItems = [], records = [], options = {}) {
  const forceReplace = options.forceReplace === true;
  const draftRecordMap = {};
  (Array.isArray(records) ? records : []).forEach((record) => {
    if (safeText(record && record.recordStatus).toUpperCase() !== "DRAFT") return;
    const recordId = normalizeRecordId(record);
    if (recordId == null) return;
    const key = buildProjectCostDataItemKey(record);
    const existingId = draftRecordMap[key];
    if (existingId == null || recordId > existingId) {
      draftRecordMap[key] = recordId;
    }
  });

  let resolvedCount = 0;
  const nextDataItems = (Array.isArray(dataItems) ? dataItems : []).map((item) => {
    if (!item) return item;
    const recordId = draftRecordMap[buildProjectCostDataItemKey(item)];
    if (recordId == null) return item;
    const currentId = normalizeRecordId(item);
    if (currentId != null && !forceReplace) return item;
    if (currentId != null && currentId === recordId) return item;
    resolvedCount += 1;
    return {
      ...item,
      id: recordId,
    };
  });

  return {
    dataItems: nextDataItems,
    resolvedCount,
  };
}

export function hasS1ModuleSubmittedInReviewState(state = {}, keys = []) {
  const submitMap = state && state.submitMap && typeof state.submitMap === "object"
    ? state.submitMap
    : {};
  return (Array.isArray(keys) ? keys : []).some((key) => {
    const text = safeText(key);
    if (!text) return false;
    if (!Object.prototype.hasOwnProperty.call(submitMap, text)) return false;
    const value = submitMap[text];
    if (typeof value === "boolean") return value;
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "submitted")) {
      return Boolean(value.submitted);
    }
    return Boolean(value);
  });
}

export function collectAffectedRecordIds(response = {}) {
  const ids = [];
  const affectedRecordIds = Array.isArray(response && response.affectedRecordIds)
    ? response.affectedRecordIds
    : [];
  affectedRecordIds.forEach((id) => appendUniquePositiveId(ids, id));

  const affectedRecords = Array.isArray(response && response.affectedRecords)
    ? response.affectedRecords
    : [];
  affectedRecords.forEach((record) => appendUniquePositiveId(ids, normalizeRecordId(record)));

  return ids;
}

export function collectS1ModuleSubmitTargets(state = {}) {
  const targetRecordIds = [];
  const targetSubmitIds = [];
  if (!state || typeof state !== "object") {
    return { targetRecordIds, targetSubmitIds };
  }

  []
    .concat(state.targetRecordIds || [])
    .concat(state.recordIds || [])
    .concat(state.recordId || [])
    .forEach((id) => appendUniquePositiveId(targetRecordIds, id));

  []
    .concat(state.targetSubmitIds || [])
    .concat(state.submitIds || [])
    .concat(state.submitId || [])
    .forEach((id) => appendUniquePositiveId(targetSubmitIds, id));

  return { targetRecordIds, targetSubmitIds };
}

export function normalizePositiveIdList(value) {
  const source = Array.isArray(value) ? value : [value];
  const ids = [];
  source.reduce((result, item) => {
    if (Array.isArray(item)) {
      result.push(...item);
    } else {
      result.push(item);
    }
    return result;
  }, []).forEach((id) => appendUniquePositiveId(ids, id));
  return ids;
}

export function normalizeS1SubtableTargets(ctx = {}) {
  return {
    targetRecordIds: normalizePositiveIdList(ctx.targetRecordIds),
    targetSubmitIds: normalizePositiveIdList(ctx.targetSubmitIds),
  };
}

export function assertS1SubtableTargets(targets = {}) {
  if (!targets.targetRecordIds.length && !targets.targetSubmitIds.length) {
    return { ok: false, message: "缺少已提交子表记录，无法执行当前操作" };
  }
  return { ok: true };
}

export function assertS1SubtableRecordTargets(targets = {}) {
  if (!targets.targetRecordIds.length) {
    return { ok: false, message: "缺少可退回草稿的 recordIds，当前后端接口不支持按 submitIds 重新编辑" };
  }
  return { ok: true };
}

export function canShowS1ModuleReeditAction(options = {}) {
  return Boolean(
    options &&
      options.showActions &&
      options.moduleSubmitted &&
      !options.reediting
  );
}

export function resolveS1ModuleProgressStatus(item = {}) {
  if (item && item.moduleSubmitted === true) return "已提交";
  const total = toNonNegativeInteger(item.total);
  if (!total) return "无可填项";
  if (toNonNegativeInteger(item.done) >= total) return "待提交";
  return "填报中";
}

export function normalizeS1ModuleProgressItem(item = {}) {
  const total = toNonNegativeInteger(item.total);
  const next = {
    ...item,
    total,
    done: toNonNegativeInteger(item.done),
    submitted: toNonNegativeInteger(item.submitted),
  };
  if (item && item.moduleSubmitted === true) {
    next.done = total;
    next.submitted = total;
  } else {
    next.submitted = 0;
  }
  next.status = resolveS1ModuleProgressStatus(next);
  return next;
}

export default {
  attachExistingDraftRecordIds,
  assertS1SubtableRecordTargets,
  assertS1SubtableTargets,
  buildProjectCostDataItemKey,
  canShowS1ModuleReeditAction,
  collectAffectedRecordIds,
  collectS1ModuleSubmitTargets,
  hasS1ModuleSubmittedInReviewState,
  normalizeS1SubtableTargets,
  normalizeS1ModuleProgressItem,
  resolveS1ModuleProgressStatus,
};
