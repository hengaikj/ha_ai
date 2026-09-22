import {
  executeProjectCostFlowAction as executeProjectCostFlowActionApi,
  getProjectCostFlowLogs as getProjectCostFlowLogsApi,
  getUserExpenseSubjectPermissionTree as getUserExpenseSubjectPermissionTreeApi,
  listProjectCostFlows as listProjectCostFlowsApi,
  queryDepartmentSuggestions as queryDepartmentSuggestionsApi,
  queryProjectCostRecords as queryProjectCostRecordsApi,
  queryProjectCostReviewSuggestions as queryProjectCostReviewSuggestionsApi,
  saveProjectCostReview as saveProjectCostReviewApi,
} from "@/api/system/expenses";
import {
  getProjectCostWritableSubjects as getTemplateScopedProjectCostWritableSubjects,
} from "@/pages/revenue/subtable-workbench/service";
import {
  listValve as listValveApi,
} from "@/api/system/valve";
import {
  parseMeetingReviewSuggestionText as parseMeetingReviewSuggestionPayload,
} from "./review-suggestion";

const PROJECT_COST_RECORD_SUBJECT_BATCH_SIZE = 50;

/** S8 各部门评审意见固定 6 部门（展示顺序） */
export const DEPARTMENT_OPINION_DEPTS = Object.freeze([
  { code: "finance", label: "财务部", keywords: ["财务"] },
  { code: "business_planning", label: "商规办", keywords: ["商规"] },
  { code: "excellence", label: "极致办", keywords: ["极致"] },
  { code: "quality", label: "质量办", keywords: ["质量"] },
  { code: "marketing", label: "营销办", keywords: ["营销"] },
  { code: "international", label: "国际办", keywords: ["国际"] },
]);

function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function readBackendPermissionField(source = {}, permissionField = "") {
  if (!source || typeof source !== "object") return "";
  return safeText(source[permissionField]);
}

function readReviewerPermission(source = {}) {
  return readBackendPermissionField(source, "reviewerPermission");
}

function normalizeStageCode(stageCode) {
  const text = safeText(stageCode, "S8").toUpperCase();
  return /^S[1-8]$/.test(text) ? text : "S8";
}

function normalizeNodeStatus(value) {
  return safeText(value).toUpperCase();
}

function isInProgressNodeStatus(value) {
  return ["IN_PROGRESS", "PROCESSING", "RUNNING", "进行中"].includes(normalizeNodeStatus(value));
}

function canSubmitS8ByNodeStatus(params = {}) {
  return normalizeStageCode(params.stage || "S8") === "S8" &&
    isInProgressNodeStatus(params.nodeStatus);
}

function toMaybeLong(value) {
  const text = safeText(value);
  if (!text || !/^\d+$/.test(text)) return null;
  const num = Number(text);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function normalizeIdList(value) {
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

function chunkProjectCostRecordSubjectIds(subjectIds = []) {
  const ids = normalizeIdList(subjectIds);
  const chunks = [];
  for (let index = 0; index < ids.length; index += PROJECT_COST_RECORD_SUBJECT_BATCH_SIZE) {
    chunks.push(ids.slice(index, index + PROJECT_COST_RECORD_SUBJECT_BATCH_SIZE));
  }
  return chunks;
}

function logProjectCostRecordBatchPlan(params = {}, subjectIds = [], batches = []) {
  if (!batches.length || typeof console === "undefined") return;
  try {
     
    console.groupCollapsed(
      `[收益接口分批] 上会 records/query subjectIds=${subjectIds.length} batches=${batches.length}`
    );
     
    console.log("projectId", safeText(params.projectId, "-"));
     
    console.log("valvePoint", safeText(params.valvePoint, "-"));
     
    console.log("nodes", Array.isArray(params.nodes) ? params.nodes : params.node || "-");
     
    console.log("单批上限", PROJECT_COST_RECORD_SUBJECT_BATCH_SIZE);
     
    console.log("subjectIds总数", subjectIds.length);
     
    console.log("批次数", batches.length);
     
    console.log("批次大小", batches.map((item) => item.length));
     
    console.groupEnd();
  } catch (_error) {
    // ignore diagnostic logging errors
  }
}

function warnUnscopedProjectCostRecordQuery(params = {}) {
  if (typeof console === "undefined") return;
  try {
     
    console.warn("[收益接口分批] 上会 records/query 未提供 subjectIds，无法按科目分批", {
      projectId: params.projectId,
      valvePoint: params.valvePoint,
      nodes: params.nodes || params.node,
    });
  } catch (_error) {
    // ignore diagnostic logging errors
  }
}

function unwrapBizPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  if (Object.prototype.hasOwnProperty.call(payload, "data")) return payload.data;
  return payload;
}

function unwrapListPayload(payload) {
  const data = unwrapBizPayload(payload);
  if (Array.isArray(data)) return data;
  const source = data && typeof data === "object" ? data : {};
  if (Array.isArray(source.rows)) return source.rows;
  if (Array.isArray(source.records)) return source.records;
  if (Array.isArray(source.list)) return source.list;
  return [];
}

function unwrapSubjectTreePayload(payload) {
  const data = unwrapBizPayload(payload);
  if (Array.isArray(data)) return data;
  const source = data && typeof data === "object" ? data : {};
  if (Array.isArray(source.subjects)) return source.subjects;
  if (source.data && Array.isArray(source.data.subjects)) return source.data.subjects;
  if (Array.isArray(source.rows)) return source.rows;
  if (Array.isArray(source.list)) return source.list;
  if (Array.isArray(payload && payload.subjects)) return payload.subjects;
  return [];
}

function normalizeFlowActionResult(payload, fallback = {}) {
  const data = unwrapBizPayload(payload) || {};
  const triggerCount = Number(data.triggerCount);
  const nodeUpdated = data.nodeUpdated === true ||
    safeText(data.nodeUpdated).toLowerCase() === "true";
  return {
    node: safeText(data.node || fallback.node, "S8"),
    nodeStatus: safeText(data.nodeStatus || fallback.nodeStatus),
    triggerCount: Number.isFinite(triggerCount) ? triggerCount : null,
    nodeUpdated,
    raw: data,
  };
}

function formatDateTime(value) {
  const text = safeText(value);
  if (!text) return "";
  return text.replace("T", " ").replace(/\.\d+$/, "");
}

function getTimeScore(value) {
  const text = safeText(value);
  if (!text) return 0;
  // 兼容 "yyyy-MM-dd HH:mm:ss" 与 ISO 时间
  const normalized = /T/.test(text) ? text : text.replace(" ", "T");
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : 0;
}

function normalizeMeetingParams(params = {}) {
  const projectNo = safeText(params.projectNo || params.projectCode);
  const valvePoint = safeText(params.valvePoint || params.valve, "G6");
  return {
    ...params,
    projectNo,
    projectCode: safeText(params.projectCode, projectNo),
    projectId: safeText(params.projectId),
    flowId: safeText(params.flowId),
    projectName: safeText(params.projectName),
    permissionKey: safeText(params.permissionKey || params.permission || params.actionPermission, "revenue:s8:review"),
    stage: safeText(params.stage, "S8"),
    valve: valvePoint,
    valvePoint,
    nodeStatus: safeText(params.nodeStatus),
    flowCreatedAt: safeText(params.flowCreatedAt),
    flowUpdatedAt: safeText(params.flowUpdatedAt),
    userId: safeText(params.userId || params.user),
    userName: safeText(params.userName),
  };
}

const MEETING_REVIEW_SUGGESTION_TYPE = "MEETING_REVIEW_DECISION";
const MEETING_REVIEW_CONFIRM_ACTION = "CONFIRM";
const MEETING_REVIEW_REJECT_ACTION = "REJECT";
const MEETING_REVIEW_FINISH_STATUS = "FINISHED";
const MEETING_REVIEW_END_STATUS = "VOIDED";
const REVIEW_STAGE_CODES = Object.freeze(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);

function normalizeMeetingReviewAction(value) {
  const action = safeText(value, MEETING_REVIEW_CONFIRM_ACTION).toUpperCase();
  return action === MEETING_REVIEW_REJECT_ACTION
    ? MEETING_REVIEW_REJECT_ACTION
    : MEETING_REVIEW_CONFIRM_ACTION;
}

function buildRouteBackedMeetingReviewPayload(ctx, flow = {}) {
  const source = flow && typeof flow === "object" ? flow : {};
  const projectCode = safeText(source.projectCode, ctx.projectCode);
  const projectId = safeText(source.projectId, ctx.projectId);
  const projectName = safeText(source.projectName, ctx.projectName || projectCode || ctx.projectNo || projectId);
  const flowId = safeText(source.id || source.flowId, ctx.flowId);
  const valvePoint = safeText(source.valvePoint || source.valve, ctx.valvePoint);
  const stage = safeText(ctx.stage, source.node || "S8");
  const nodeStatus = safeText(ctx.nodeStatus, source.nodeStatus);
  const createdAt = safeText(source.createdAt, ctx.flowCreatedAt);
  const updatedAt = safeText(source.updatedAt, ctx.flowUpdatedAt);
  const actor = safeText(source.creatorName || source.creatorId, ctx.userName || "系统");

  const timeline = [];
  if (createdAt) {
    timeline.push({
      action: "流程创建",
      time: formatDateTime(createdAt),
      actor,
      note: [projectCode, valvePoint ? `${valvePoint} 阀点` : ""].filter(Boolean).join(" / "),
    });
  }
  if (updatedAt) {
    timeline.unshift({
      action: "流程更新",
      time: formatDateTime(updatedAt),
      actor,
      note: [`当前节点：${stage || "-"}`, nodeStatus ? `状态：${nodeStatus}` : ""]
        .filter(Boolean)
        .join("；"),
    });
  }

  return {
    project: {
      projectNo: safeText(ctx.projectNo, projectCode),
      projectCode,
      projectId,
      flowId,
      projectName,
      gate: valvePoint,
      valvePoint,
      stage,
      nodeStatus,
      meetingTime: formatDateTime(updatedAt),
      freezeTime: formatDateTime(updatedAt),
      flowCreatedAt: createdAt,
      flowUpdatedAt: updatedAt,
    },
    currentStep: stage,
    dimensions: {
      years: [],
      trims: [],
      yearFactors: [],
    },
    subjects: [],
    versions: {
      candidates: [],
      extras: [],
    },
    values: {
      extras: {},
    },
    calc: {
      editableFields: [],
    },
    state: {},
    timeline,
    decisionResult: null,
  };
}

function normalizeFlowSnapshot(row = {}, fallback = {}) {
  const source = row && typeof row === "object" ? row : {};
  const flowId = source.id || source.flowId || fallback.flowId;
  if (!flowId && !source.projectId) return null;
  return {
    ...source,
    id: flowId,
    flowId,
    projectId: safeText(source.projectId, fallback.projectId),
    projectCode: safeText(source.projectCode, fallback.projectCode),
    projectName: safeText(source.projectName, fallback.projectName || source.projectCode || source.projectId),
    valvePoint: safeText(source.valvePoint || source.valve, fallback.valvePoint),
    node: safeText(source.node || source.stage, fallback.stage || "S8"),
    nodeStatus: safeText(source.nodeStatus, fallback.nodeStatus),
    createdAt: safeText(source.createdAt, fallback.flowCreatedAt),
    updatedAt: safeText(source.updatedAt, fallback.flowUpdatedAt),
    creatorId: safeText(source.creatorId, fallback.userId),
    creatorName: safeText(source.creatorName, fallback.userName),
  };
}

function pickMeetingReviewFlow(ctx, rows = []) {
  const list = (Array.isArray(rows) ? rows : [])
    .map((item) => normalizeFlowSnapshot(item, ctx))
    .filter(Boolean);
  if (!list.length) return null;
  const flowId = toMaybeLong(ctx.flowId);
  if (flowId != null) {
    const explicit = list.find((item) => toMaybeLong(item.flowId || item.id) === flowId);
    if (explicit) return explicit;
  }
  list.sort((a, b) => {
    const timeScore = getTimeScore(b.updatedAt || b.createdAt) - getTimeScore(a.updatedAt || a.createdAt);
    if (timeScore !== 0) return timeScore;
    return (toMaybeLong(b.flowId || b.id) || 0) - (toMaybeLong(a.flowId || a.id) || 0);
  });
  return list[0];
}

async function fetchMeetingReviewFlow(ctx) {
  const projectId = safeText(ctx.projectId);
  if (!projectId) return null;
  try {
    const payload = await listProjectCostFlowsApi({
      pageNum: 1,
      pageSize: 50,
      projectId,
      valvePoint: ctx.valvePoint || undefined,
      flowType: "NORMAL",
    });
    return pickMeetingReviewFlow(ctx, unwrapListPayload(payload));
  } catch (_error) {
    return null;
  }
}

function parseMeetingReviewSuggestionText(value) {
  return parseMeetingReviewSuggestionPayload(value);
}

function normalizeMeetingReviewDecisionEntry(row = {}) {
  const parsed = parseMeetingReviewSuggestionText(row.reviewSuggestion);
  if (!parsed) return null;
  const reviewStatus = safeText(row.reviewStatus).toUpperCase();
  const reviewConclusion = safeText(row.reviewConclusion).toUpperCase();
  const action = normalizeMeetingReviewAction(parsed.decisionAction);
  const time = safeText(row.updatedAt || row.createdAt);
  return {
    reviewId: row.reviewId || row.id,
    reviewDataSubmitId: row.reviewDataSubmitId,
    reviewStatus,
    reviewConclusion,
    reviewerId: safeText(row.reviewerId),
    reviewerName: safeText(row.reviewerName),
    reviewerPermission: readReviewerPermission(row),
    node: safeText(row.node, "S8"),
    time,
    parsed,
    action: reviewConclusion === "REJECT" ? MEETING_REVIEW_REJECT_ACTION : action,
  };
}

function buildMeetingReviewStateFromDecision(entry) {
  const parsed = entry && entry.parsed && typeof entry.parsed === "object" ? entry.parsed : {};
  const source = safeText(parsed.source, "finance");
  return {
    decisionSource: source,
    meetingOpinion: safeText(parsed.meetingOpinion),
    customDecisionValue: safeText(parsed.customDecisionValue),
    customDecisionNote: safeText(parsed.customDecisionNote),
    calcBaseVersion: safeText(parsed.calcBaseVersion, "brand"),
  };
}

function buildMeetingReviewResultFromDecision(entry) {
  if (!entry || entry.reviewStatus !== "ARCHIVED") return null;
  const rejected = entry.action === MEETING_REVIEW_REJECT_ACTION || entry.reviewConclusion === "REJECT";
  const meetingVersion = entry.reviewDataSubmitId
    ? `S8-DATA-${entry.reviewDataSubmitId}`
    : entry.reviewId
      ? `S8-REVIEW-${entry.reviewId}`
      : "S8-MEETING";
  return {
    reviewId: entry.reviewId,
    reviewDataSubmitId: entry.reviewDataSubmitId,
    meetingVersion,
    reviewConclusion: entry.reviewConclusion,
    decisionAction: rejected ? MEETING_REVIEW_REJECT_ACTION : MEETING_REVIEW_CONFIRM_ACTION,
    rejected,
    flowNode: "S8",
    flowNodeStatus: rejected ? MEETING_REVIEW_END_STATUS : MEETING_REVIEW_FINISH_STATUS,
    completedAt: formatDateTime(entry.time) || undefined,
  };
}

function buildMeetingReviewTimelineFromDecision(entry) {
  if (!entry) return null;
  const rejected = entry.action === MEETING_REVIEW_REJECT_ACTION || entry.reviewConclusion === "REJECT";
  return {
    action: rejected ? "驳回上会评审" : "确认上会值版本",
    time: formatDateTime(entry.time),
    actor: safeText(entry.reviewerName, entry.reviewerId),
    note: safeText(
      entry.parsed && entry.parsed.meetingOpinion,
      rejected ? "会议驳回并结束流程" : safeText(entry.parsed && entry.parsed.sourceLabel, "上会定值")
    ),
  };
}

function pickMeetingReviewDecisionEntry(entries = [], ctx = {}) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const sortByTimeDesc = (a, b) => getTimeScore(b.time) - getTimeScore(a.time);
  const archived = list.filter((item) => item.reviewStatus === "ARCHIVED").sort(sortByTimeDesc);
  if (archived.length) return archived[0];
  const reviewerId = safeText(ctx.userId || ctx.user);
  return list
    .filter((item) => !reviewerId || item.reviewerId === reviewerId)
    .sort(sortByTimeDesc)[0] || null;
}

async function fetchPersistedMeetingReviewDecision(ctx = {}) {
  const flowId = toMaybeLong(ctx.flowId);
  if (flowId == null) return null;
  try {
    const payload = await queryProjectCostReviewSuggestionsApi({
      flowId,
      node: "S8",
    });
    const entry = pickMeetingReviewDecisionEntry(
      unwrapListPayload(payload).map(normalizeMeetingReviewDecisionEntry),
      ctx
    );
    if (!entry) return null;
    return {
      state: buildMeetingReviewStateFromDecision(entry),
      decisionResult: buildMeetingReviewResultFromDecision(entry),
      timelineItem: buildMeetingReviewTimelineFromDecision(entry),
    };
  } catch (_error) {
    return null;
  }
}

function buildSuggestionDedupeKey(item = {}) {
  const reviewId = safeText(item.reviewId || item.id);
  if (reviewId) return `review_${reviewId}`;
  return [
    safeText(item.flowId),
    safeText(item.node),
    safeText(item.reviewerId),
    safeText(item.reviewStatus),
    safeText(item.reviewConclusion),
    safeText(item.updatedAt || item.createdAt),
    safeText(item.reviewSuggestion),
  ].join("__");
}

function dedupeReviewSuggestions(rows = []) {
  const seen = {};
  return (Array.isArray(rows) ? rows : []).filter((item) => {
    const key = buildSuggestionDedupeKey(item);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

async function fetchReviewSuggestionsByFlowId(flowId) {
  try {
    const payload = await queryProjectCostReviewSuggestionsApi({ flowId });
    const rows = unwrapListPayload(payload);
    if (rows.length) return dedupeReviewSuggestions(rows);
  } catch (_error) {
    // Fall back to node-scoped queries below.
  }

  const batches = await Promise.all(
    REVIEW_STAGE_CODES.map((node) =>
      queryProjectCostReviewSuggestionsApi({ flowId, node })
        .then((payload) => unwrapListPayload(payload))
        .catch(() => [])
    )
  );
  return dedupeReviewSuggestions(batches.reduce((result, rows) => result.concat(rows), []));
}

async function fetchMeetingReviewFlowHistory(ctx = {}, flow = {}) {
  const flowId = toMaybeLong(flow.flowId || flow.id || ctx.flowId);
  if (flowId == null) {
    return {
      flowId: "",
      logs: [],
      reviewSuggestions: [],
    };
  }

  const [logRows, suggestionRows] = await Promise.all([
    getProjectCostFlowLogsApi(flowId)
      .then((payload) => unwrapListPayload(payload))
      .catch(() => []),
    fetchReviewSuggestionsByFlowId(flowId).catch(() => []),
  ]);

  return {
    flowId,
    logs: logRows,
    reviewSuggestions: suggestionRows,
  };
}

async function fetchMeetingReviewTemplateSubjects(ctx = {}) {
  const payload = await getTemplateScopedProjectCostWritableSubjects({
    ...ctx,
    stage: safeText(ctx.stage, "S8"),
    valve: ctx.valvePoint || ctx.valve,
    valvePoint: ctx.valvePoint || ctx.valve,
    subjectDomain: "main",
  });
  const subjects = unwrapSubjectTreePayload(payload);
  if (!subjects.length) {
    throw new Error("当前流程模板未返回主表科目，无法打开上会评审");
  }
  return subjects;
}

function unsupportedMeetingReviewAction(actionName) {
  return Promise.resolve({
    ok: false,
    message: `当前后端未开放上会评审${actionName}接口`,
  });
}

function normalizeReviewDataItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const subjectId = toMaybeLong(item.subjectId);
      if (subjectId == null) return null;
      return {
        subjectId,
        modelName: safeText(item.modelName),
        trimName: safeText(item.trimName, "默认版型"),
        modelYear: item.modelYear,
        yearAggregateMode: safeText(item.yearAggregateMode, "SPECIFIC"),
        valueType: safeText(item.valueType, "NUMBER"),
        rawValue: safeText(item.rawValue),
        numberValue: item.numberValue,
        textValue: item.textValue,
      };
    })
    .filter(Boolean);
}

function buildMeetingReviewSuggestion(params = {}, saveMode = "DRAFT") {
  const state = params.state && typeof params.state === "object" ? params.state : {};
  const decisionAction = normalizeMeetingReviewAction(params.decisionAction);
  return JSON.stringify({
    type: MEETING_REVIEW_SUGGESTION_TYPE,
    subjectDomain: "main",
    stageCode: safeText(params.stage, "S8"),
    saveMode,
    decisionAction,
    source: safeText(params.source || state.decisionSource, "finance"),
    sourceLabel: safeText(params.sourceLabel),
    meetingOpinion: safeText(params.meetingOpinion || state.meetingOpinion),
    customDecisionValue: safeText(state.customDecisionValue),
    customDecisionNote: safeText(state.customDecisionNote),
    calcBaseVersion: safeText(state.calcBaseVersion),
    calcVersionKeys: Array.isArray(state.calcVersions)
      ? state.calcVersions.map((item) => safeText(item && item.key)).filter(Boolean)
      : [],
  });
}

function resolveMeetingReviewConclusion(params = {}) {
  if (normalizeMeetingReviewAction(params.decisionAction) === MEETING_REVIEW_REJECT_ACTION) {
    return "REJECT";
  }
  const state = params.state && typeof params.state === "object" ? params.state : {};
  const source = safeText(params.source || state.decisionSource, "finance").toLowerCase();
  if (source === "custom" || source.indexOf("calc") >= 0) return "PASS_WITH_ISSUES";
  return "PASS";
}

async function persistMeetingReviewDecision(params = {}, saveMode = "DRAFT") {
  const flowId = toMaybeLong(params.flowId);
  const decisionAction = normalizeMeetingReviewAction(params.decisionAction);
  if (flowId == null) {
    return {
      ok: false,
      message: "未找到可用流程，无法保存上会评审",
    };
  }

  const dataItems = decisionAction === MEETING_REVIEW_REJECT_ACTION
    ? []
    : normalizeReviewDataItems(params.dataItems);
  const targetRecordIds = normalizeIdList(params.targetRecordIds);
  const targetSubmitIds = normalizeIdList(params.targetSubmitIds);
  if (!targetRecordIds.length && !targetSubmitIds.length) {
    return {
      ok: false,
      message: "缺少上会值来源记录，无法保存评审",
    };
  }

  try {
    const payload = await saveProjectCostReviewApi({
      flowId,
      saveMode,
      reviewerId: safeText(params.userId || params.user),
      reviewerName: safeText(params.userName, params.userId || params.user),
      targetRecordIds: targetRecordIds.length ? targetRecordIds : undefined,
      targetSubmitIds: targetSubmitIds.length ? targetSubmitIds : undefined,
      reviewConclusion: resolveMeetingReviewConclusion(params),
      reviewSuggestion: buildMeetingReviewSuggestion(params, saveMode),
      dataItems: dataItems.length ? dataItems : undefined,
    });
    const data = unwrapBizPayload(payload) || {};
    const reviewId = data.reviewId || data.id;
    const reviewDataSubmitId = data.reviewDataSubmitId;
    const meetingVersion = reviewDataSubmitId
      ? `S8-DATA-${reviewDataSubmitId}`
      : reviewId
        ? `S8-REVIEW-${reviewId}`
        : "S8-MEETING";

    return {
      ok: true,
      result: {
        reviewId,
        reviewDataSubmitId,
        meetingVersion,
        savedCount: dataItems.length,
        reviewConclusion: resolveMeetingReviewConclusion(params),
        decisionAction,
        rejected: decisionAction === MEETING_REVIEW_REJECT_ACTION,
      },
      timelineItem: {
        action: decisionAction === MEETING_REVIEW_REJECT_ACTION
          ? "驳回上会评审"
          : saveMode === "ARCHIVED" ? "确认上会值版本" : "保存上会评审草稿",
        time: formatDateTime(new Date().toISOString()),
        actor: safeText(params.userName, params.userId || params.user),
        note: decisionAction === MEETING_REVIEW_REJECT_ACTION
          ? safeText(params.meetingOpinion || (params.state && params.state.meetingOpinion), "会议驳回并结束流程")
          : safeText(params.sourceLabel, params.source || "上会定值"),
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "上会评审保存失败"),
    };
  }
}

/** 将后端 department 归一到固定 6 部门之一 */
export function matchDepartmentOpinionDept(departmentName) {
  const text = safeText(departmentName);
  if (!text) return null;
  const exact = DEPARTMENT_OPINION_DEPTS.find((item) => item.label === text);
  if (exact) return exact;
  let best = null;
  let bestKeywordLength = -1;
  DEPARTMENT_OPINION_DEPTS.forEach((item) => {
    (item.keywords || []).forEach((keyword) => {
      const key = safeText(keyword);
      if (!key || text.indexOf(key) < 0) return;
      if (key.length > bestKeywordLength) {
        best = item;
        bestKeywordLength = key.length;
      }
    });
  });
  return best;
}

function resolveDepartmentOpinionResultText(value) {
  const code = safeText(value).toUpperCase();
  if (!code) return "";
  const map = {
    PASS: "通过",
    REJECT: "驳回",
    PASS_WITH_ISSUES: "带意见通过",
  };
  return map[code] || safeText(value);
}

function buildEmptyDepartmentOpinionCards() {
  return DEPARTMENT_OPINION_DEPTS.map((item, index) => ({
    code: item.code,
    label: item.label,
    order: index + 1,
    hasOperation: false,
    operationTitle: item.label,
    operationTime: "",
    operationMeta: "",
    operationOpinion: "",
    operationActor: "",
    operationResult: "",
    operationNode: "",
    cardTooltip: "暂无记录",
  }));
}

function unwrapDepartmentSuggestionRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.list)) return payload.data.list;
  if (Array.isArray(payload.list)) return payload.list;
  return unwrapListPayload(payload);
}

function normalizeDepartmentSuggestionEntry(row = {}) {
  const dept = matchDepartmentOpinionDept(row.department || row.deptName || row.dept);
  if (!dept) return null;
  const opinion = safeText(row.opinionContent || row.opinion || row.reviewSuggestion);
  const time = safeText(row.submittedTime || row.updatedAt || row.createdAt);
  const actor = safeText(row.submitterName || row.reviewerName || row.reviewerId);
  const resultText = resolveDepartmentOpinionResultText(
    row.opinionResult || row.reviewConclusion,
  );
  const meta = [actor, resultText].filter(Boolean).join(" · ");
  const title = safeText(row.node) ? `${dept.label}（${safeText(row.node)}）` : dept.label;
  return {
    code: dept.code,
    label: dept.label,
    hasOperation: true,
    operationTitle: title,
    operationTime: time || "-",
    operationMeta: meta,
    operationOpinion: opinion || "已记录评审，无文字意见",
    operationActor: actor,
    operationResult: resultText,
    operationNode: safeText(row.node),
    timeScore: getTimeScore(time),
    cardTooltip: [title, time, meta, opinion || "已记录评审，无文字意见"]
      .filter((text) => safeText(text))
      .join("\n"),
  };
}

/** 按部门归卡，同部门仅保留 submittedTime 最新 1 条 */
export function buildDepartmentOpinionCards(rows = []) {
  const latestByCode = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const entry = normalizeDepartmentSuggestionEntry(row);
    if (!entry) return;
    const prev = latestByCode[entry.code];
    if (!prev || entry.timeScore > prev.timeScore) {
      latestByCode[entry.code] = entry;
    }
  });
  return DEPARTMENT_OPINION_DEPTS.map((item, index) => {
    const hit = latestByCode[item.code];
    if (hit) {
      return {
        ...hit,
        order: index + 1,
      };
    }
    return {
      code: item.code,
      label: item.label,
      order: index + 1,
      hasOperation: false,
      operationTitle: item.label,
      operationTime: "",
      operationMeta: "",
      operationOpinion: "",
      operationActor: "",
      operationResult: "",
      operationNode: "",
      cardTooltip: "暂无记录",
    };
  });
}

/**
 * 拉取 S8 各部门评审意见卡片数据
 * 入参：projectName + valvePoint
 */
export async function fetchDepartmentOpinionCards(params = {}) {
  const projectName = safeText(params.projectName);
  const valvePoint = safeText(params.valvePoint || params.valve);
  if (!projectName || !valvePoint) {
    return buildEmptyDepartmentOpinionCards();
  }
  try {
    const payload = await queryDepartmentSuggestionsApi({
      projectName,
      valvePoint,
    });
    return buildDepartmentOpinionCards(unwrapDepartmentSuggestionRows(payload));
  } catch (_error) {
    return buildEmptyDepartmentOpinionCards();
  }
}

export async function fetchMeetingReviewDetail(params = {}) {
  const ctx = normalizeMeetingParams(params);
  const flow = await fetchMeetingReviewFlow(ctx);
  const payload = buildRouteBackedMeetingReviewPayload(ctx, flow || {});
  const flowCtx = {
    ...ctx,
    flowId: payload.project.flowId || ctx.flowId,
  };
  const [templateSubjects, persistedDecision, flowReviewHistory] = await Promise.all([
    fetchMeetingReviewTemplateSubjects(flowCtx),
    fetchPersistedMeetingReviewDecision(flowCtx),
    fetchMeetingReviewFlowHistory(flowCtx, payload.project),
  ]);
  payload.subjects = templateSubjects;
  payload.flowReviewHistory = flowReviewHistory;
  if (persistedDecision) {
    payload.state = persistedDecision.state || {};
    payload.decisionResult = persistedDecision.decisionResult || null;
    if (persistedDecision.decisionResult && persistedDecision.decisionResult.flowNodeStatus) {
      payload.project.nodeStatus = persistedDecision.decisionResult.flowNodeStatus;
    }
    if (persistedDecision.timelineItem) {
      payload.timeline = [persistedDecision.timelineItem].concat(payload.timeline || []);
    }
  }
  return payload;
}

export async function saveMeetingReviewDraft(params = {}) {
  if (!canSubmitS8ByNodeStatus(params)) {
    return {
      ok: false,
      message: "当前 S8 节点不是进行中状态，不能保存上会评审",
    };
  }
  return persistMeetingReviewDecision(params, "DRAFT");
}

export async function exportMeetingReviewReport(params = {}) {
  void params;
  return unsupportedMeetingReviewAction("导出");
}

export async function submitMeetingReviewDecision(params = {}) {
  if (!canSubmitS8ByNodeStatus(params)) {
    return {
      ok: false,
      message: "当前 S8 节点不是进行中状态，不能提交上会评审",
    };
  }
  const result = await persistMeetingReviewDecision(params, "ARCHIVED");
  if (!result || !result.ok) return result;

  const flowId = toMaybeLong(params.flowId);
  if (flowId == null) {
    return {
      ok: false,
      message: "上会值已保存，但未找到可用流程，无法完成 S8",
      savedResult: result.result,
    };
  }

  try {
    const flowActionPayload = await executeProjectCostFlowActionApi(flowId, {
      action: "review",
      targetNode: "S8",
      targetNodeStatus: "FINISHED",
      operatorId: safeText(params.userId || params.user),
      operatorName: safeText(params.userName, params.userId || params.user),
      actionRemark: `通过，确认${safeText(params.sourceLabel, "上会值版本")}`,
    });
    const flowAction = normalizeFlowActionResult(flowActionPayload, {
      node: "S8",
      nodeStatus: params.nodeStatus || "IN_PROGRESS",
    });
    const completedAt = flowAction.nodeUpdated ? formatDateTime(new Date().toISOString()) : "";
    const flowNodeStatus = flowAction.nodeUpdated
      ? "FINISHED"
      : safeText(flowAction.nodeStatus, params.nodeStatus || "IN_PROGRESS");
    return {
      ...result,
      result: {
        ...(result.result || {}),
        flowNode: safeText(flowAction.node, "S8"),
        flowNodeStatus,
        completedAt: completedAt || undefined,
      },
      flowResult: {
        nextStage: safeText(flowAction.node, "S8"),
        nodeStatus: flowNodeStatus,
        completedAt: completedAt || undefined,
        triggerCount: flowAction.triggerCount,
        nodeUpdated: flowAction.nodeUpdated,
        pendingConfirm: !flowAction.nodeUpdated,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "上会值已保存，但流程完成失败"),
      savedResult: result.result,
    };
  }
}

export async function rejectMeetingReviewDecision(params = {}) {
  const result = await persistMeetingReviewDecision(
    {
      ...params,
      decisionAction: MEETING_REVIEW_REJECT_ACTION,
      dataItems: [],
    },
    "ARCHIVED"
  );
  if (!result || !result.ok) return result;

  const flowId = toMaybeLong(params.flowId);
  if (flowId == null) {
    return {
      ok: false,
      message: "驳回意见已保存，但未找到可用流程，无法结束 S8",
      savedResult: result.result,
    };
  }

  try {
    const flowActionPayload = await executeProjectCostFlowActionApi(flowId, {
      action: MEETING_REVIEW_REJECT_ACTION,
      targetNode: "S8",
      targetNodeStatus: MEETING_REVIEW_END_STATUS,
      operatorId: safeText(params.userId || params.user),
      operatorName: safeText(params.userName, params.userId || params.user),
      actionRemark: `驳回并结束流程：${safeText(params.meetingOpinion || (params.state && params.state.meetingOpinion), "未填写意见")}`,
    });
    const flowAction = normalizeFlowActionResult(flowActionPayload, {
      node: "S8",
      nodeStatus: params.nodeStatus || "IN_PROGRESS",
    });
    const completedAt = flowAction.nodeUpdated ? formatDateTime(new Date().toISOString()) : "";
    const flowNodeStatus = flowAction.nodeUpdated
      ? MEETING_REVIEW_END_STATUS
      : safeText(flowAction.nodeStatus, params.nodeStatus || "IN_PROGRESS");
    return {
      ...result,
      result: {
        ...(result.result || {}),
        flowNode: safeText(flowAction.node, "S8"),
        flowNodeStatus,
        completedAt: completedAt || undefined,
      },
      flowResult: {
        nextStage: safeText(flowAction.node, "S8"),
        nodeStatus: flowNodeStatus,
        completedAt: completedAt || undefined,
        triggerCount: flowAction.triggerCount,
        nodeUpdated: flowAction.nodeUpdated,
        pendingConfirm: !flowAction.nodeUpdated,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "驳回意见已保存，但流程结束失败"),
      savedResult: result.result,
    };
  }
}

export async function getUserExpenseSubjectPermissionTree(params = {}) {
  return getUserExpenseSubjectPermissionTreeApi(params);
}

export async function getValveList(params = {}) {
  const payload = await listValveApi(params);
  return unwrapListPayload(payload);
}

export async function queryProjectCostRecords(params = {}) {
  const subjectIds = normalizeIdList(params.subjectIds);
  if (!subjectIds.length) {
    warnUnscopedProjectCostRecordQuery(params);
    const payload = await queryProjectCostRecordsApi({
      ...params,
      subjectIds: undefined,
    });
    return unwrapBizPayload(payload);
  }

  const batches = chunkProjectCostRecordSubjectIds(subjectIds);
  if (batches.length <= 1) {
    const payload = await queryProjectCostRecordsApi({
      ...params,
      subjectIds,
    });
    return unwrapBizPayload(payload);
  }

  logProjectCostRecordBatchPlan(params, subjectIds, batches);
  const rows = [];
  for (let index = 0; index < batches.length; index += 1) {
     
    const payload = await queryProjectCostRecordsApi({
      ...params,
      subjectIds: batches[index],
    });
    rows.push(...unwrapListPayload(payload));
  }
  return rows;
}
