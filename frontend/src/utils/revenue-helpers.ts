/**
 * 收益模块通用工具函数
 * 统一收纳原分散在多个 service.js / mixin.js 中的基础文本、阶段、状态处理逻辑
 */

// ============================================================
// 文本安全
// ============================================================

export function safeText(value: unknown, fallback = ""): string {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

// ============================================================
// 阶段码处理
// ============================================================

export const WORKFLOW_STAGE_FLOW: readonly string[] = Object.freeze([
  "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8",
]);

export function normalizeStageCode(stageCode: unknown, fallback = "S1"): string {
  const raw = safeText(stageCode, fallback).toUpperCase();
  const hit = raw.match(/^S([1-8])(?=$|[^0-9])/);
  const code = hit ? `S${hit[1]}` : raw;
  return WORKFLOW_STAGE_FLOW.includes(code) ? code : fallback;
}

export function isMainTableStage(stageCode: unknown): boolean {
  return ["S4", "S5", "S6", "S7", "S8"].includes(normalizeStageCode(stageCode));
}

export function getNextStageCode(stageCode: unknown): string {
  const normalized = normalizeStageCode(stageCode);
  const index = WORKFLOW_STAGE_FLOW.indexOf(normalized);
  if (index < 0) return "S2";
  return WORKFLOW_STAGE_FLOW[Math.min(index + 1, WORKFLOW_STAGE_FLOW.length - 1)];
}

// ============================================================
// 节点状态处理
// ============================================================

export const NODE_STATUS_ALIAS_MAP: Record<string, readonly string[]> = Object.freeze({
  IN_PROGRESS: Object.freeze(["IN_PROGRESS", "PROCESSING", "RUNNING"]),
  PROCESSING: Object.freeze(["IN_PROGRESS", "PROCESSING", "RUNNING"]),
  RUNNING: Object.freeze(["IN_PROGRESS", "PROCESSING", "RUNNING"]),
  FINISHED: Object.freeze(["FINISHED", "COMPLETED", "DONE", "SUCCESS"]),
  COMPLETED: Object.freeze(["FINISHED", "COMPLETED", "DONE", "SUCCESS"]),
  DONE: Object.freeze(["FINISHED", "COMPLETED", "DONE", "SUCCESS"]),
  SUCCESS: Object.freeze(["FINISHED", "COMPLETED", "DONE", "SUCCESS"]),
  VOIDED: Object.freeze(["VOIDED"]),
});

export function normalizeNodeStatus(value: unknown): string {
  return safeText(value).toUpperCase();
}

export function isVoidedNodeStatus(value: unknown): boolean {
  return normalizeNodeStatus(value) === "VOIDED";
}

export function isInProgressNodeStatus(value: unknown): boolean {
  return ["IN_PROGRESS", "PROCESSING", "RUNNING", "进行中"].includes(normalizeNodeStatus(value));
}

export function resolveFlowNodeTagType(nodeStatus: unknown): string {
  const status = normalizeNodeStatus(nodeStatus);
  if (["COMPLETED", "DONE", "FINISHED", "SUCCESS"].includes(status)) return "success";
  if (["PROCESSING", "IN_PROGRESS", "RUNNING"].includes(status)) return "warning";
  if (["VOIDED", "REJECTED", "FAILED"].includes(status)) return "danger";
  return "info";
}

// ============================================================
// ID / 数字安全
// ============================================================

export function toIntegerId(value: unknown): string {
  const text = safeText(value);
  return /^\d+$/.test(text) ? text : "";
}

export function toMaybeLong(value: unknown): number | null {
  const text = safeText(value);
  if (!text || !/^\d+$/.test(text)) return null;
  const num = Number(text);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

export function normalizeIdList(value: unknown): number[] {
  const list = Array.isArray(value) ? value : [value];
  return list
    .flat()
    .map((item) => toMaybeLong(item))
    .filter((item, index, array) => item != null && array.indexOf(item) === index) as number[];
}

// ============================================================
// 文本列表处理
// ============================================================

export function normalizeTextList(value: unknown): string[] {
  const sourceList = Array.isArray(value)
    ? value
    : safeText(value)
      ? safeText(value).split(/[,，\s]+/)
      : [];
  return sourceList
    .map((item) => safeText(item))
    .filter((item, index, array) => item && array.indexOf(item) === index);
}

// ============================================================
// 关键词搜索
// ============================================================

export function includesKeyword(
  row: Record<string, unknown>,
  keyword: string,
  fields: string[] = ["projectNo", "projectCode", "projectName", "project", "valve", "stage", "meetingDate", "stageLabel"],
): boolean {
  const query = safeText(keyword).toLowerCase();
  if (!query) return true;
  const text = fields
    .map((field) => safeText(row[field]).toLowerCase())
    .join("|");
  return text.includes(query);
}

// ============================================================
// 响应解包
// ============================================================

export function unwrapBizPayload<T = Record<string, unknown>>(payload: unknown): T {
  if (!payload || typeof payload !== "object") return payload as T;
  if (Object.prototype.hasOwnProperty.call(payload as object, "data")) {
    return (payload as Record<string, unknown>).data as T;
  }
  return payload as T;
}

export function unwrapListPayload<T = Record<string, unknown>>(payload: unknown): T[] {
  const data = unwrapBizPayload<unknown>(payload);
  if (Array.isArray(data)) return data as T[];
  const source = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  if (Array.isArray(source.rows)) return source.rows as T[];
  if (Array.isArray(source.records)) return source.records as T[];
  if (Array.isArray(source.list)) return source.list as T[];
  return [];
}

// ============================================================
// 日期时间
// ============================================================

export function formatDateTime(value: unknown): string {
  const text = safeText(value);
  if (!text) return "";
  return text.replace("T", " ").replace(/\.\d+$/, "");
}

export function getTimeScore(value: unknown): number {
  const time = Date.parse(safeText(value));
  return Number.isFinite(time) ? time : 0;
}
