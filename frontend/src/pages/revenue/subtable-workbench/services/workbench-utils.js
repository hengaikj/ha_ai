export function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

export function readBackendPermissionField(source = {}, permissionField = "") {
  if (!source || typeof source !== "object") return "";
  return safeText(source[permissionField]);
}

export function readOwnerPermission(source = {}) {
  return readBackendPermissionField(source, "ownerPermission");
}

export function readReviewerPermission(source = {}) {
  return readBackendPermissionField(source, "reviewerPermission");
}

export function toMaybeLong(value) {
  const text = safeText(value);
  if (!text || !/^\d+$/.test(text)) return null;
  const num = Number(text);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
}

export function normalizeIdList(value) {
  const list = Array.isArray(value) ? value : [value];
  return list
    .reduce((result, item) => {
      if (Array.isArray(item)) {
        result.push(...item);
        return result;
      }
      result.push(item);
      return result;
    }, [])
    .map((item) => toMaybeLong(item))
    .filter((item, index, array) => item != null && array.indexOf(item) === index);
}

export function appendUniqueIds(target = [], ids = []) {
  normalizeIdList(ids).forEach((id) => {
    if (!target.includes(id)) target.push(id);
  });
}

export function unwrapBizPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (payload.data && typeof payload.data === "object") return payload.data;
  return payload;
}

function readArrayCandidate(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const keys = ["data", "rows", "records", "items", "list", "subjects", "result"];
  for (let i = 0; i < keys.length; i += 1) {
    const value = source[keys[i]];
    if (Array.isArray(value)) return value;
  }

  for (let i = 0; i < keys.length; i += 1) {
    const nested = source[keys[i]];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    for (let j = 0; j < keys.length; j += 1) {
      const value = nested[keys[j]];
      if (Array.isArray(value)) return value;
    }
  }

  return null;
}

export function parseListPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const direct = readArrayCandidate(payload);
  if (Array.isArray(direct)) return direct;
  const data = unwrapBizPayload(payload);
  if (Array.isArray(data)) return data;
  const nested = readArrayCandidate(data);
  if (Array.isArray(nested)) return nested;
  return [];
}

export function appendSubmitPayloadTargetIds(targetRecordIds = [], targetSubmitIds = [], payload = {}) {
  const data = unwrapBizPayload(payload) || {};
  appendUniqueIds(targetRecordIds, [
    data.affectedRecordIds,
    data.recordIds,
    data.recordId,
  ]);
  appendUniqueIds(targetSubmitIds, [
    data.submitId,
    data.submitIds,
    data.submitIdList,
  ]);
}

const DEFAULT_DISPLAY_TIME_ZONE = "Asia/Shanghai";

function readTimeZonePart(parts, type) {
  const hit = parts.find((part) => part.type === type);
  return hit ? hit.value : "00";
}

/** 格式化为 YYYY-MM-DD HH:mm:ss（默认东八区 UTC+8） */
export function formatDateTimeInTimeZone(date = new Date(), timeZone = DEFAULT_DISPLAY_TIME_ZONE) {
  const value = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(value);
  return `${readTimeZonePart(parts, "year")}-${readTimeZonePart(parts, "month")}-${readTimeZonePart(parts, "day")} ${readTimeZonePart(parts, "hour")}:${readTimeZonePart(parts, "minute")}:${readTimeZonePart(parts, "second")}`;
}

export function nowText() {
  return formatDateTimeInTimeZone(new Date());
}

export function normalizeProjectIdValue(value) {
  const id = toMaybeLong(value);
  return id == null ? "" : String(id);
}

export function isTruthyFlag(value) {
  if (value === true || value === 1) return true;
  const text = safeText(value).toLowerCase();
  return text === "1" || text === "true" || text === "yes" || text === "y";
}

export function normalizeNodeStatus(value) {
  return safeText(value).toUpperCase();
}

export function isInProgressNodeStatus(value) {
  return ["IN_PROGRESS", "PROCESSING", "RUNNING", "进行中"].includes(normalizeNodeStatus(value));
}

export function isFlowSnapshotInProgress(flowSnapshot = {}) {
  return isInProgressNodeStatus(flowSnapshot && flowSnapshot.nodeStatus);
}

export function compareIdText(a, b) {
  const left = safeText(a);
  const right = safeText(b);
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right, "zh-CN", { numeric: true });
}

export function normalizeSubjectSortPath(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const number = Number(item);
    return Number.isFinite(number) ? number : 0;
  });
}

export function normalizeSubjectIdPath(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeText(item)).filter(Boolean);
}

export function compareSubjectOrderPath(a = {}, b = {}) {
  const leftSortPath = normalizeSubjectSortPath(a.subjectSortPath);
  const rightSortPath = normalizeSubjectSortPath(b.subjectSortPath);
  if (!leftSortPath.length || !rightSortPath.length) return 0;

  const leftIdPath = normalizeSubjectIdPath(a.subjectIdPath);
  const rightIdPath = normalizeSubjectIdPath(b.subjectIdPath);
  const maxLength = Math.max(leftSortPath.length, rightSortPath.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftHasSegment = index < leftSortPath.length;
    const rightHasSegment = index < rightSortPath.length;
    if (!leftHasSegment || !rightHasSegment) {
      return leftSortPath.length - rightSortPath.length;
    }

    const sortDiff = leftSortPath[index] - rightSortPath[index];
    if (sortDiff !== 0) return sortDiff;

    const idDiff = compareIdText(leftIdPath[index], rightIdPath[index]);
    if (idDiff !== 0) return idDiff;
  }
  return 0;
}

export function resolveMatrixSubjectId(source = {}) {
  const candidates = [
    source && source.subjectId,
    source && source.templateSubjectId,
    source && source.expenseSubjectId,
    source && source.templateItem && source.templateItem.subjectId,
    source && source.id,
    source && source.rowId,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const subjectId = toMaybeLong(candidates[i]);
    if (subjectId != null) return subjectId;
  }
  return null;
}

export function normalizeSubjectIdFilterList(subjectIds = []) {
  const source = Array.isArray(subjectIds)
    ? subjectIds
    : safeText(subjectIds).split(",").map((item) => item.trim());
  return source
    .map((item) => toMaybeLong(item))
    .filter((item, index, list) => item != null && list.indexOf(item) === index);
}

export function normalizeWorkbenchParams(params = {}) {
  const projectCode = safeText(params.projectCode || params.projectNo);
  const projectId = normalizeProjectIdValue(
    params.projectId ||
      params.project_id ||
      params.bizProjectId ||
      params.projectCostProjectId
  );
  const stageCode = safeText(params.stageCode || params.stage, "S1").toUpperCase();
  const userId = safeText(params.userId || params.user);
  // S3 本人草稿 ownerId：优先登录名，回退数字 userId
  const ownerUserId = safeText(params.ownerUserId || params.ownerUser || params.loginName, userId);
  const visibleSubjectScopeProvided = Object.prototype.hasOwnProperty.call(params, "visibleSubjectIds");
  return {
    ...params,
    projectId,
    // Vue2 项目列表跳转带 flowId；Vue3 会把流程主键写到 query.id，这里兼容两种来源
    flowId: toMaybeLong(params.flowId) ?? toMaybeLong(params.id),
    projectCode,
    projectNo: safeText(params.projectNo, projectCode),
    projectName: safeText(params.projectName),
    permissionKey: safeText(params.permissionKey || params.actionPermission || params.permission),
    fullAccess: isTruthyFlag(params.fullAccess || params.hasAllPermission),
    userId,
    ownerUserId,
    userName: safeText(params.userName || params.actor || params.nickName || userId),
    stage: stageCode,
    stageCode,
    // 阀点以 URL/列表为准；不要默认 G6，否则会把刚启动的 G7/G8 流程过滤掉
    valve: safeText(params.valve || params.valvePoint),
    subjectApiMode: safeText(params.subjectApiMode, "permission").toLowerCase(),
    subjectDomain: safeText(params.subjectDomain || params.domain || "subtable", "subtable").toLowerCase(),
    readonlyAuthorizedScope: isTruthyFlag(params.readonlyAuthorizedScope),
    isSuperAdmin: isTruthyFlag(params.isSuperAdmin || params.superAdmin || params.isAdmin),
    s1FlowFillPermission: isTruthyFlag(params.s1FlowFillPermission),
    s1FlowSubmitPermission: isTruthyFlag(params.s1FlowSubmitPermission),
    s1FlowRejectSubtablePermission: isTruthyFlag(params.s1FlowRejectSubtablePermission),
    s1FlowCancelSubmitPermission: isTruthyFlag(params.s1FlowCancelSubmitPermission),
    s2DetailMode: safeText(params.s2DetailMode || params.detailMode).toLowerCase(),
    workbenchAction: safeText(params.workbenchAction || params.action).toLowerCase(),
    visibleSubjectScopeProvided,
    visibleSubjectIds: normalizeSubjectIdFilterList(params.visibleSubjectIds),
  };
}

export function buildRevenueTraceLabel(ctx = {}, action = "") {
  const source = safeText(
    ctx.revenueTraceSource || ctx.traceSource || ctx.revenueTraceLabel,
    "收益填报"
  );
  const flowId = ctx.flowId != null && ctx.flowId !== "" ? `flowId=${ctx.flowId}` : "";
  return [
    source,
    action,
    `projectId=${safeText(ctx.projectId, "-")}`,
    flowId,
    `stage=${safeText(ctx.stageCode || ctx.stage, "-")}`,
    `domain=${safeText(ctx.subjectDomain, "-")}`,
    `mode=${safeText(ctx.subjectApiMode, "-")}`,
  ].filter(Boolean).join(" | ");
}

export function hasProjectId(ctx = {}) {
  return Boolean(normalizeProjectIdValue(ctx.projectId));
}

export function resolveProjectDisplayName(ctx = {}) {
  return safeText(ctx.projectName || ctx.projectCode || ctx.projectNo || ctx.projectId, "收益测算项目");
}
