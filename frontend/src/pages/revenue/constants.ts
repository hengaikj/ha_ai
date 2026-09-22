/**
* 收益 - 阶段 & 节点状态常量
*/

/** 阶段元数据：阶段码 -> 标签及扩展字段 */
type StageMeta = { label: string; [key: string]: unknown };

/** 流程阶段顺序：对齐 Vue2 FLOW_STAGE_ORDER（S1-S8） */
export const FLOW_STAGE_ORDER = Object.freeze([
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
] as const);

/** 阶段映射：code -> { label, ... } */
export const STAGE_MAP: Record<string, StageMeta> = {
  S1: { label: "S1" },
  S2: { label: "S2" },
  S3: { label: "S3" },
  S4: { label: "S4" },
  S5: { label: "S5" },
  S6: { label: "S6" },
  S7: { label: "S7" },
  S8: { label: "S8" },
};

/** 节点状态枚举（与 API 返回值一致） */
export const NODE_STATUS_MAP = {
  IN_PROGRESS: "IN_PROGRESS",
  FINISHED: "FINISHED",
  VOIDED: "VOIDED",
} as const;

/** 节点状态文本 */
export type NodeStatus = (typeof NODE_STATUS_MAP)[keyof typeof NODE_STATUS_MAP];

/** 含节点状态字段的最小数据行 */
type NodeStatusRow = { nodeStatus?: string };

/** 含阶段/节点标识的最小数据行 */
type StageLikeRow = { node?: string; stage?: string; nodeStatus?: string };

/** 节点状态 → 中文显示 */
export const NODE_STATUS_LABEL_MAP: Record<string, string> = {
  [NODE_STATUS_MAP.IN_PROGRESS]: "进行中",
  [NODE_STATUS_MAP.FINISHED]: "已完成",
  [NODE_STATUS_MAP.VOIDED]: "已作废",
};

/** 判断是否进行中 */
export function isInProgressNodeStatus(row: NodeStatusRow | null | undefined): boolean {
  return row?.nodeStatus === NODE_STATUS_MAP.IN_PROGRESS;
}

/** 判断是否已完成 */
export function isFinishedNodeStatus(row: NodeStatusRow | null | undefined): boolean {
  return row?.nodeStatus === NODE_STATUS_MAP.FINISHED;
}

/** 判断是否已作废 */
export function isVoidedNodeStatus(row: NodeStatusRow | null | undefined): boolean {
  return row?.nodeStatus === NODE_STATUS_MAP.VOIDED;
}

/** 根据阶段 code 返回中文名称 */
export function resolveStageName(code: string): string {
  return STAGE_MAP[code]?.label || code;
}

/** 返回节点状态文本 */
export function resolveNodeStatusText(row: StageLikeRow | null | undefined): string {
  const status = row?.nodeStatus || "";
  return NODE_STATUS_LABEL_MAP[status] || status || "-";
}

/** 返回阶段元数据 */
export function resolveStageMetadata(code: string): StageMeta | null {
  return STAGE_MAP[code] || null;
}

/** 返回阶段/节点标签 class */
export function resolveStageTagClass(row: StageLikeRow | null | undefined): string {
  const node = row?.node || row?.stage || "";
  return `rv-stage-tag-${(node || "default").toLowerCase()}`;
}
