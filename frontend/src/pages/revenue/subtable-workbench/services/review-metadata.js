import {
  normalizeIdList,
  readReviewerPermission,
  safeText,
  toMaybeLong,
} from "./workbench-utils";

// 本地保留阶段顺序,避免引入 domain-config 的重依赖(与 record-utils.js 同样做法)
const FLOW_STAGE_ORDER = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];

function flowStageOrder(stageCode) {
  const index = FLOW_STAGE_ORDER.indexOf(safeText(stageCode).toUpperCase());
  return index < 0 ? FLOW_STAGE_ORDER.length : index;
}

const MODULE_META_MARKER = "[[RV_MODULE_META]]";
const CELL_META_MARKER = "[[RV_CELL_DRAFT]]";
const DECISION_META_MARKER = "[[RV_DECISION_APPROVAL]]";
const SUBJECT_NOTE_MARKER = "[[RV_SUBJECT_NOTE]]";
const FILL_OPINION_SOURCE_TYPES = Object.freeze(["fill_opinion", "s3_confirm_opinion"]);

function normalizeTargetRecordIds(source = {}) {
  if (!source || typeof source !== "object") return [];
  return normalizeIdList([
    source.targetRecordIds,
    source.recordIds,
    source.recordId,
    source.affectedRecordIds,
    (Array.isArray(source.affectedRecords) ? source.affectedRecords : []).map((item) =>
      item && (item.id || item.recordId)
    ),
  ]);
}

function normalizeTargetSubmitIds(source = {}) {
  if (!source || typeof source !== "object") return [];
  return normalizeIdList([
    source.targetSubmitIds,
    source.submitIds,
    source.submitId,
    source.reviewDataSubmitId,
  ]);
}

export function buildModuleSuggestionText(params = {}) {
  const meta = encodeURIComponent(
    JSON.stringify({
      rootSubjectId: safeText(params.rootSubjectId),
      moduleKey: safeText(params.moduleKey || params.rootSubjectId || params.moduleName),
      moduleName: safeText(params.moduleName),
      subjectDomain: safeText(params.subjectDomain),
      stageCode: safeText(params.stageCode),
      submitted: Boolean(params.submitted),
    })
  );
  const opinion = String(params.opinion == null ? "" : params.opinion);
  return `${MODULE_META_MARKER}${meta}\n${opinion}`;
}

function parseModuleSuggestionText(text) {
  const source = String(text == null ? "" : text);
  if (!source.startsWith(MODULE_META_MARKER)) return null;
  const body = source.slice(MODULE_META_MARKER.length);
  const lineBreakIndex = body.indexOf("\n");
  const encodedMeta = lineBreakIndex >= 0 ? body.slice(0, lineBreakIndex) : body;
  const opinion = lineBreakIndex >= 0 ? body.slice(lineBreakIndex + 1) : "";

  try {
    const meta = JSON.parse(decodeURIComponent(encodedMeta));
    return {
      rootSubjectId: safeText(meta && meta.rootSubjectId),
      moduleKey: safeText(meta && (meta.moduleKey || meta.rootSubjectId || meta.moduleName)),
      moduleName: safeText(meta && meta.moduleName),
      subjectDomain: safeText(meta && meta.subjectDomain),
      stageCode: safeText(meta && meta.stageCode),
      reviewerPermission: readReviewerPermission(meta),
      submitted: Boolean(meta && meta.submitted),
      opinion,
    };
  } catch (_error) {
    return null;
  }
}

export function buildDecisionApprovalSuggestionText(params = {}) {
  const meta = encodeURIComponent(
    JSON.stringify({
      subjectDomain: safeText(params.subjectDomain, "main"),
      stageCode: safeText(params.stageCode, "S5"),
      sourceStageCode: safeText(params.sourceStageCode, "S5"),
      submitted: Boolean(params.submitted),
    })
  );
  const opinion = String(params.opinion == null ? "" : params.opinion);
  return `${DECISION_META_MARKER}${meta}\n${opinion}`;
}

function parseDecisionApprovalSuggestionText(text) {
  const source = String(text == null ? "" : text);
  if (!source.startsWith(DECISION_META_MARKER)) return null;
  const body = source.slice(DECISION_META_MARKER.length);
  const lineBreakIndex = body.indexOf("\n");
  const encodedMeta = lineBreakIndex >= 0 ? body.slice(0, lineBreakIndex) : body;
  const opinion = lineBreakIndex >= 0 ? body.slice(lineBreakIndex + 1) : "";

  try {
    const meta = JSON.parse(decodeURIComponent(encodedMeta));
    return {
      subjectDomain: safeText(meta && meta.subjectDomain),
      stageCode: safeText(meta && meta.stageCode),
      reviewerPermission: readReviewerPermission(meta),
      sourceStageCode: safeText(meta && meta.sourceStageCode),
      submitted: Boolean(meta && meta.submitted),
      opinion,
    };
  } catch (_error) {
    return null;
  }
}

export function buildCellSuggestionText(params = {}) {
  const meta = encodeURIComponent(
    JSON.stringify({
      rootSubjectId: safeText(params.rootSubjectId),
      moduleKey: safeText(params.moduleKey || params.rootSubjectId || params.moduleName),
      moduleName: safeText(params.moduleName),
      subjectDomain: safeText(params.subjectDomain),
      stageCode: safeText(params.stageCode),
      rowId: safeText(params.rowId),
      cellKey: safeText(params.cellKey),
      dimensionKey: safeText(params.dimensionKey),
      yearLabel: safeText(params.yearLabel),
      modelYear: params.modelYear == null ? undefined : Number(params.modelYear),
      yearAggregateMode: safeText(params.yearAggregateMode),
      trimId: safeText(params.trimId),
      trimName: safeText(params.trimName),
      trimIndex: Number.isInteger(params.trimIndex) ? Number(params.trimIndex) : undefined,
      targetRecordIds: normalizeIdList(params.targetRecordIds),
      targetSubmitIds: normalizeIdList(params.targetSubmitIds),
      sourceType: safeText(params.sourceType),
      sourceRecordId: toMaybeLong(params.sourceRecordId),
      sourceReviewId: toMaybeLong(params.sourceReviewId),
      sourceStageCode: safeText(params.sourceStageCode),
    })
  );
  const opinion = String(params.opinion == null ? "" : params.opinion);
  return `${CELL_META_MARKER}${meta}\n${opinion}`;
}

/** 构建 S1 科目说明 suggestion 文本 */
export function buildSubjectNoteSuggestionText(params = {}) {
  const meta = encodeURIComponent(
    JSON.stringify({
      type: "SUBJECT_NOTE",
      subjectId: safeText(params.subjectId),
      subjectName: safeText(params.subjectName),
      subjectPath: Array.isArray(params.subjectPath)
        ? params.subjectPath.map((item) => safeText(item)).filter(Boolean)
        : [],
      rootSubjectId: safeText(params.rootSubjectId),
      moduleKey: safeText(params.moduleKey || params.rootSubjectId || params.moduleName),
      moduleName: safeText(params.moduleName),
      subjectDomain: safeText(params.subjectDomain, "subtable"),
      stageCode: safeText(params.stageCode, "S1"),
      sourceType: "subject_note",
      submitted: Boolean(params.submitted !== false),
    })
  );
  const opinion = String(
    params.opinion == null
      ? params.noteText == null
        ? ""
        : params.noteText
      : params.opinion
  );
  return `${SUBJECT_NOTE_MARKER}${meta}\n${opinion}`;
}

function parseSubjectNoteSuggestionText(text) {
  const source = String(text == null ? "" : text);
  if (!source.startsWith(SUBJECT_NOTE_MARKER)) return null;
  const body = source.slice(SUBJECT_NOTE_MARKER.length);
  const lineBreakIndex = body.indexOf("\n");
  const encodedMeta = lineBreakIndex >= 0 ? body.slice(0, lineBreakIndex) : body;
  const opinion = lineBreakIndex >= 0 ? body.slice(lineBreakIndex + 1) : "";

  try {
    const meta = JSON.parse(decodeURIComponent(encodedMeta));
    const subjectId = safeText(meta && meta.subjectId);
    if (!subjectId) return null;
    return {
      type: "SUBJECT_NOTE",
      subjectId,
      subjectName: safeText(meta && meta.subjectName),
      subjectPath: Array.isArray(meta && meta.subjectPath)
        ? meta.subjectPath.map((item) => safeText(item)).filter(Boolean)
        : [],
      rootSubjectId: safeText(meta && meta.rootSubjectId),
      moduleKey: safeText(meta && (meta.moduleKey || meta.rootSubjectId || meta.moduleName)),
      moduleName: safeText(meta && meta.moduleName),
      subjectDomain: safeText(meta && meta.subjectDomain),
      stageCode: safeText(meta && meta.stageCode),
      sourceType: safeText(meta && meta.sourceType, "subject_note"),
      submitted: meta && meta.submitted === false ? false : true,
      opinion,
    };
  } catch (_error) {
    return null;
  }
}

/** 解析科目说明条目（仅 ARCHIVED 参与「最新一条」时可再过滤） */
export function parseSubjectNoteEntries(suggestions = []) {
  const entries = [];
  (Array.isArray(suggestions) ? suggestions : []).forEach((item) => {
    const parsed = parseSubjectNoteSuggestionText(item && item.reviewSuggestion);
    if (!parsed || !parsed.subjectId) return;
    entries.push({
      reviewId: item && item.reviewId,
      subjectId: parsed.subjectId,
      subjectName: parsed.subjectName,
      subjectPath: parsed.subjectPath,
      rootSubjectId: parsed.rootSubjectId,
      moduleKey: parsed.moduleKey,
      moduleName: parsed.moduleName,
      subjectDomain: parsed.subjectDomain,
      stageCode: parsed.stageCode,
      sourceType: parsed.sourceType,
      submitted: parsed.submitted,
      opinion: parsed.opinion,
      noteText: parsed.opinion,
      reviewConclusion: safeText(item && item.reviewConclusion),
      reviewerId: safeText(item && item.reviewerId),
      reviewerName: safeText(item && item.reviewerName),
      reviewStatus: safeText(item && item.reviewStatus),
      node: safeText(item && item.node),
      time: safeText(item && (item.updatedAt || item.createdAt)),
    });
  });
  entries.sort(
    (a, b) =>
      (Date.parse(String(b.time || "").replace(" ", "T")) || 0) -
      (Date.parse(String(a.time || "").replace(" ", "T")) || 0)
  );
  return entries;
}

/** 按 subjectId 取最新一条已归档科目说明 */
export function pickLatestSubjectNoteMap(entries = []) {
  const map = {};
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (!entry || !entry.subjectId) return;
    const status = safeText(entry.reviewStatus).toUpperCase();
    if (status && status !== "ARCHIVED") return;
    if (entry.submitted === false) return;
    if (map[entry.subjectId]) return;
    map[entry.subjectId] = {
      subjectId: entry.subjectId,
      noteText: String(entry.noteText || entry.opinion || ""),
      subjectName: entry.subjectName,
      subjectPath: entry.subjectPath,
      reviewerId: entry.reviewerId,
      reviewerName: entry.reviewerName,
      reviewId: entry.reviewId,
      time: entry.time,
      moduleKey: entry.moduleKey,
      moduleName: entry.moduleName,
    };
  });
  return map;
}

function parseCellSuggestionText(text) {
  const source = String(text == null ? "" : text);
  if (!source.startsWith(CELL_META_MARKER)) return null;
  const body = source.slice(CELL_META_MARKER.length);
  const lineBreakIndex = body.indexOf("\n");
  const encodedMeta = lineBreakIndex >= 0 ? body.slice(0, lineBreakIndex) : body;
  const opinion = lineBreakIndex >= 0 ? body.slice(lineBreakIndex + 1) : "";

  try {
    const meta = JSON.parse(decodeURIComponent(encodedMeta));
    return {
      rootSubjectId: safeText(meta && meta.rootSubjectId),
      moduleKey: safeText(meta && (meta.moduleKey || meta.rootSubjectId || meta.moduleName)),
      moduleName: safeText(meta && meta.moduleName),
      subjectDomain: safeText(meta && meta.subjectDomain),
      stageCode: safeText(meta && meta.stageCode),
      reviewerPermission: readReviewerPermission(meta),
      rowId: safeText(meta && meta.rowId),
      cellKey: safeText(meta && meta.cellKey),
      dimensionKey: safeText(meta && meta.dimensionKey),
      yearLabel: safeText(meta && meta.yearLabel),
      modelYear: !meta || meta.modelYear == null ? undefined : Number(meta.modelYear),
      yearAggregateMode: safeText(meta && meta.yearAggregateMode),
      trimId: safeText(meta && meta.trimId),
      trimName: safeText(meta && meta.trimName),
      trimIndex: Number.isInteger(meta && meta.trimIndex) ? Number(meta.trimIndex) : undefined,
      targetRecordIds: normalizeIdList(meta && meta.targetRecordIds),
      targetSubmitIds: normalizeIdList(meta && meta.targetSubmitIds),
      sourceType: safeText(meta && meta.sourceType),
      sourceRecordId: toMaybeLong(meta && meta.sourceRecordId),
      sourceReviewId: toMaybeLong(meta && meta.sourceReviewId),
      sourceStageCode: safeText(meta && meta.sourceStageCode),
      opinion,
    };
  } catch (_error) {
    return null;
  }
}

export function parseModuleReviewEntries(suggestions = []) {
  const entries = [];
  (Array.isArray(suggestions) ? suggestions : []).forEach((item) => {
    const parsed = parseModuleSuggestionText(item && item.reviewSuggestion);
    if (!parsed || !parsed.moduleName) return;
    entries.push({
      reviewId: item && item.reviewId,
      targetRecordIds: normalizeTargetRecordIds(item),
      targetSubmitIds: normalizeTargetSubmitIds(item),
      rootSubjectId: parsed.rootSubjectId,
      moduleKey: parsed.moduleKey,
      moduleName: parsed.moduleName,
      subjectDomain: parsed.subjectDomain,
      stageCode: parsed.stageCode,
      reviewerPermission: parsed.reviewerPermission,
      submitted: parsed.submitted,
      opinion: parsed.opinion,
      reviewConclusion: safeText(item && item.reviewConclusion),
      reviewerId: safeText(item && item.reviewerId),
      reviewerName: safeText(item && item.reviewerName),
      reviewStatus: safeText(item && item.reviewStatus),
      node: safeText(item && item.node),
      time: safeText(item && (item.updatedAt || item.createdAt)),
    });
  });
  entries.sort((a, b) => (Date.parse(b.time || "") || 0) - (Date.parse(a.time || "") || 0));
  return entries;
}

export function parseDecisionApprovalEntries(suggestions = []) {
  const entries = [];
  (Array.isArray(suggestions) ? suggestions : []).forEach((item) => {
    const parsed = parseDecisionApprovalSuggestionText(item && item.reviewSuggestion);
    if (!parsed) return;
    entries.push({
      reviewId: item && item.reviewId,
      targetRecordIds: normalizeTargetRecordIds(item),
      targetSubmitIds: normalizeTargetSubmitIds(item),
      subjectDomain: parsed.subjectDomain,
      stageCode: parsed.stageCode,
      reviewerPermission: parsed.reviewerPermission,
      sourceStageCode: parsed.sourceStageCode,
      submitted: parsed.submitted,
      opinion: parsed.opinion,
      reviewConclusion: safeText(item && item.reviewConclusion),
      reviewerId: safeText(item && item.reviewerId),
      reviewerName: safeText(item && item.reviewerName),
      reviewStatus: safeText(item && item.reviewStatus),
      node: safeText(item && item.node),
      time: safeText(item && (item.updatedAt || item.createdAt)),
    });
  });
  entries.sort((a, b) => (Date.parse(b.time || "") || 0) - (Date.parse(a.time || "") || 0));
  return entries;
}

export function isSubmittedDecisionApprovalEntry(entry = {}) {
  if (!entry || typeof entry !== "object") return false;
  return entry.submitted === true ||
    safeText(entry.reviewStatus).toUpperCase() === "ARCHIVED" ||
    safeText(entry.reviewConclusion).toUpperCase() === "PASS";
}

export function pickLatestModuleEntries(entries = []) {
  const map = {};
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (!entry) return;
    const key = safeText(entry.rootSubjectId || entry.moduleKey || entry.moduleName);
    if (!key) return;
    if (!map[key]) {
      map[key] = entry;
    }
  });
  return map;
}

function isArchivedSubmittedModuleEntry(entry = {}) {
  return Boolean(
    entry &&
      entry.submitted &&
      safeText(entry.reviewStatus).toUpperCase() === "ARCHIVED"
  );
}

export function pickLatestSubmittedModuleEntries(entries = []) {
  const latestMap = pickLatestModuleEntries(entries);
  const submittedMap = {};
  Object.keys(latestMap).forEach((key) => {
    const entry = latestMap[key];
    if (isArchivedSubmittedModuleEntry(entry)) {
      submittedMap[key] = entry;
    }
  });
  return submittedMap;
}

export function resolveModuleIdentity(params = {}) {
  const rootSubjectId = safeText(params.rootSubjectId);
  const moduleName = safeText(params.moduleName);
  const moduleKey = safeText(params.moduleKey || rootSubjectId || moduleName);
  return {
    rootSubjectId,
    moduleName,
    moduleKey,
    lookupKeys: [rootSubjectId, moduleKey, moduleName]
      .map((item) => safeText(item))
      .filter((item, index, list) => item && list.indexOf(item) === index),
  };
}

export function findModuleEntry(latestMap = {}, identity = {}) {
  const keys = Array.isArray(identity.lookupKeys) ? identity.lookupKeys : [];
  for (let index = 0; index < keys.length; index += 1) {
    if (latestMap[keys[index]]) return latestMap[keys[index]];
  }
  return null;
}

function writeModuleMapValue(map, entry = {}, value) {
  const identity = resolveModuleIdentity(entry);
  identity.lookupKeys.forEach((key) => {
    map[key] = value;
  });
}

function buildModuleReviewStateFromEntries(entries = []) {
  const latestMap = pickLatestModuleEntries(entries);
  const latestSubmittedMap = pickLatestSubmittedModuleEntries(entries);
  const opinionMap = {};
  const submitMap = {};
  const timeline = [];

  Object.keys(latestMap).forEach((key) => {
    const item = latestMap[key];
    writeModuleMapValue(opinionMap, item, String(item.opinion || ""));
  });
  Object.keys(latestSubmittedMap).forEach((key) => {
    const item = latestSubmittedMap[key];
    writeModuleMapValue(submitMap, item, {
      submitted: true,
      opinion: item.opinion,
      submittedAt: item.time,
      submittedBy: item.reviewerName || item.reviewerId,
      reviewId: item.reviewId,
      targetRecordIds: Array.isArray(item.targetRecordIds) ? item.targetRecordIds.slice() : [],
      targetSubmitIds: Array.isArray(item.targetSubmitIds) ? item.targetSubmitIds.slice() : [],
    });
    timeline.push({
      time: item.time || "-",
      actor: item.reviewerName || item.reviewerId || "-",
      action: `提交模块（${item.moduleName || key}）`,
      note: item.opinion || "-",
    });
  });
  timeline.sort((a, b) => (Date.parse(b.time || "") || 0) - (Date.parse(a.time || "") || 0));
  return { opinionMap, submitMap, timeline };
}

export function buildModuleReviewStateFromSuggestions(suggestionRows = []) {
  return buildModuleReviewStateFromEntries(parseModuleReviewEntries(suggestionRows));
}

// 全流程意见时间线:把跨节点(S1..当前)的模块级意见(填报/审核,含主表审核)归并成
// 整表级别的"前序节点意见"列表,每个 (stageCode + moduleKey) 取最新一条。供任意节点
// 统一展示前面节点的审核意见与提交状态。entries 来自 parseModuleReviewEntries(可跨节点)。
export function buildFlowOpinionTimeline(entries = [], options = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const latestByKey = {};
  list.forEach((entry) => {
    const stageCode = safeText(entry && entry.stageCode).toUpperCase();
    const moduleKey = safeText(entry && (entry.moduleKey || entry.rootSubjectId || entry.moduleName));
    if (!stageCode || !moduleKey) return;
    const key = `${stageCode}__${moduleKey}`;
    const prev = latestByKey[key];
    const time = Date.parse(entry.time || "") || 0;
    const prevTime = prev ? (Date.parse(prev.time || "") || 0) : -1;
    // 同一 (节点,模块) 取最新;时间相同时优先已提交项
    if (!prev || time > prevTime || (time === prevTime && entry.submitted === true)) {
      latestByKey[key] = entry;
    }
  });

  const items = Object.keys(latestByKey)
    .map((key) => {
      const entry = latestByKey[key];
      return {
        stageCode: safeText(entry.stageCode).toUpperCase(),
        stageOrder: flowStageOrder(entry.stageCode),
        subjectDomain: safeText(entry.subjectDomain),
        moduleKey: safeText(entry.moduleKey || entry.rootSubjectId || entry.moduleName),
        moduleName: safeText(entry.moduleName),
        opinion: safeText(entry.opinion),
        submitted: entry.submitted === true,
        time: safeText(entry.time),
        actor: safeText(entry.reviewerName || entry.reviewerId),
      };
    })
    .filter((item) => options.includeEmpty === true || item.opinion || item.submitted)
    .sort((a, b) =>
      a.stageOrder - b.stageOrder ||
      a.moduleName.localeCompare(b.moduleName) ||
      (Date.parse(a.time || "") || 0) - (Date.parse(b.time || "") || 0)
    );

  const byStage = {};
  items.forEach((item) => {
    if (!byStage[item.stageCode]) byStage[item.stageCode] = [];
    byStage[item.stageCode].push(item);
  });
  return { items, byStage };
}

function flowOpinionKind(item = {}) {
  if (safeText(item.subjectDomain).toLowerCase() === "main") return "主表审核意见";
  return safeText(item.stageCode).toUpperCase() === "S1" ? "填报意见" : "审核意见";
}

// 取「前序节点」针对某个子表(模块)的意见,供 ModuleOpinionCard 在录入框上方展示。
// items 为 buildFlowOpinionTimeline().items;identity 为模块标识(moduleKey/rootSubjectId/moduleName);
// currentStageCode 之后(含)的节点不算前序。
export function buildModulePriorOpinionCards(items = [], identity = {}, currentStageCode = "") {
  const keys = [identity.moduleKey, identity.rootSubjectId, identity.moduleName]
    .map((key) => safeText(key))
    .filter(Boolean);
  const keySet = new Set(keys);
  if (!keySet.size) return [];
  const currentOrder = currentStageCode ? flowStageOrder(currentStageCode) : FLOW_STAGE_ORDER.length;
  return (Array.isArray(items) ? items : [])
    .filter((item) => {
      if (!item || typeof item !== "object") return false;
      const order = Number.isFinite(item.stageOrder) ? item.stageOrder : flowStageOrder(item.stageCode);
      if (order >= currentOrder) return false;
      return keySet.has(safeText(item.moduleKey)) || keySet.has(safeText(item.moduleName));
    })
    .map((item) => ({
      stageCode: safeText(item.stageCode),
      label: `${safeText(item.stageCode)} · ${flowOpinionKind(item)}${item.submitted ? "（已提交）" : ""}`,
      opinion: safeText(item.opinion),
      actor: safeText(item.actor),
      time: safeText(item.time),
      submitted: item.submitted === true,
    }));
}

// 把全流程意见时间线转成 AuditTimelineCard 可直接渲染的 {action,time,actor,note} 卡片。
export function buildFlowOpinionCards(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const source = item && typeof item === "object" ? item : {};
    const kind = safeText(source.subjectDomain).toLowerCase() === "main"
      ? "主表审核意见"
      : (safeText(source.stageCode).toUpperCase() === "S1" ? "填报意见" : "审核意见");
    const status = source.submitted ? "已提交" : "草稿";
    const moduleName = safeText(source.moduleName);
    return {
      stageCode: safeText(source.stageCode),
      action: `${safeText(source.stageCode)} ${moduleName} · ${kind}（${status}）`.replace(/\s+/g, " ").trim(),
      time: safeText(source.time, "-"),
      actor: safeText(source.actor, "-"),
      note: safeText(source.opinion, "-"),
    };
  });
}

function parseCellReviewEntries(suggestions = []) {
  const entries = [];
  (Array.isArray(suggestions) ? suggestions : []).forEach((item) => {
    const parsed = parseCellSuggestionText(item && item.reviewSuggestion);
    if (!parsed || !parsed.rowId || !parsed.cellKey) return;
    entries.push({
      reviewId: item && item.reviewId,
      reviewDataSubmitId: item && item.reviewDataSubmitId,
      targetRecordIds: normalizeTargetRecordIds(item),
      targetSubmitIds: normalizeTargetSubmitIds(item),
      rowId: parsed.rowId,
      cellKey: parsed.cellKey,
      dimensionKey: parsed.dimensionKey,
      yearLabel: parsed.yearLabel,
      modelYear: parsed.modelYear,
      yearAggregateMode: parsed.yearAggregateMode,
      trimId: parsed.trimId,
      trimName: parsed.trimName,
      trimIndex: parsed.trimIndex,
      rootSubjectId: parsed.rootSubjectId,
      moduleKey: parsed.moduleKey,
      moduleName: parsed.moduleName,
      subjectDomain: parsed.subjectDomain,
      stageCode: parsed.stageCode,
      sourceType: parsed.sourceType,
      sourceRecordId: parsed.sourceRecordId,
      sourceReviewId: parsed.sourceReviewId,
      sourceStageCode: parsed.sourceStageCode,
      opinion: parsed.opinion,
      reviewConclusion: safeText(item && item.reviewConclusion),
      reviewerId: safeText(item && item.reviewerId),
      reviewerName: safeText(item && item.reviewerName),
      reviewerPermission: readReviewerPermission(item),
      reviewStatus: safeText(item && item.reviewStatus),
      node: safeText(item && item.node),
      time: safeText(item && (item.updatedAt || item.createdAt)),
    });
  });
  entries.sort((a, b) => (Date.parse(b.time || "") || 0) - (Date.parse(a.time || "") || 0));
  return entries;
}

export function buildCellReviewIndex(suggestions = []) {
  const entries = parseCellReviewEntries(suggestions);
  const byRowCell = {};
  const byReviewDataSubmitId = {};
  const byReviewId = {};
  entries.forEach((entry) => {
    const key = `${entry.rowId}__${entry.cellKey}`;
    if (!byRowCell[key]) byRowCell[key] = [];
    byRowCell[key].push(entry);
    const submitId = toMaybeLong(entry.reviewDataSubmitId);
    if (submitId != null && !byReviewDataSubmitId[submitId]) byReviewDataSubmitId[submitId] = entry;
    const reviewId = toMaybeLong(entry.reviewId);
    if (reviewId != null && !byReviewId[reviewId]) byReviewId[reviewId] = entry;
  });
  return { entries, byRowCell, byReviewDataSubmitId, byReviewId };
}

function isFillCellOpinionEntry(entry = {}) {
  return FILL_OPINION_SOURCE_TYPES.includes(safeText(entry && entry.sourceType).toLowerCase());
}

function writeCellOpinionMapValue(map, entry = {}) {
  if (!entry || !entry.rowId || !entry.cellKey) return;
  const sourceType = safeText(entry.sourceType).toLowerCase();
  const targetMapName = sourceType === "s3_confirm_opinion" ? "s3OpinionMap" : "fillOpinionMap";
  if (!map[targetMapName]) map[targetMapName] = {};
  if (!map[targetMapName][entry.rowId]) map[targetMapName][entry.rowId] = {};
  const value = {
    reviewId: entry.reviewId,
    reviewDataSubmitId: entry.reviewDataSubmitId,
    sourceType,
    opinion: safeText(entry.opinion),
    reviewerId: safeText(entry.reviewerId),
    reviewerName: safeText(entry.reviewerName),
    reviewerPermission: readReviewerPermission(entry),
    reviewStatus: safeText(entry.reviewStatus),
    targetRecordIds: normalizeTargetRecordIds(entry),
    targetSubmitIds: normalizeTargetSubmitIds(entry),
    time: safeText(entry.time),
  };
  [entry.cellKey, entry.dimensionKey].filter(Boolean).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(map[targetMapName][entry.rowId], key)) return;
    map[targetMapName][entry.rowId][key] = value;
  });
}

export function buildFillCellOpinionMapFromSuggestions(suggestions = []) {
  const result = {
    fillOpinionMap: {},
    s3OpinionMap: {},
  };
  parseCellReviewEntries(suggestions)
    .filter(isFillCellOpinionEntry)
    .forEach((entry) => writeCellOpinionMapValue(result, entry));
  return result;
}

function writeRowCellOpinion(row = {}, mapName = "fillOpinionMap", key = "", value = null) {
  if (!row || typeof row !== "object" || !key) return;
  if (!row[mapName] || typeof row[mapName] !== "object") row[mapName] = {};
  row[mapName][key] = value || {};
}

export function mergeFillOpinionMapToDetail(detail = {}, opinionMaps = {}) {
  const rows = Array.isArray(detail && detail.rows) ? detail.rows : [];
  const byId = {};
  rows.forEach((row) => {
    const rowId = safeText(row && (row.id || row.rowId || row.subjectId));
    if (rowId) byId[rowId] = row;
  });

  ["fillOpinionMap", "s3OpinionMap"].forEach((mapName) => {
    const map = opinionMaps && opinionMaps[mapName] && typeof opinionMaps[mapName] === "object"
      ? opinionMaps[mapName]
      : {};
    Object.keys(map).forEach((rowId) => {
      const row = byId[rowId];
      if (!row) return;
      const cells = map[rowId] || {};
      Object.keys(cells).forEach((cellKey) => {
        writeRowCellOpinion(row, mapName, cellKey, cells[cellKey]);
      });
    });
  });
  return detail;
}
