/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
/**
 * 收益 - 流程身份识别工具
 * 用于判断不同入口类型（S1/S2/S3/S4/S5 等）
 */

/** 流程菜单阶段 code */
export function flowMenuStageCode(row: any): string {
  const raw =
    row?.flowMenuStageCode ||
    row?.stage ||
    row?.node ||
    row?.stageCode ||
    "";
  return String(raw || "").trim().toUpperCase();
}

/** 是否 S1 流程入口 */
export function isS1FlowEntry(row: any): boolean {
  return flowMenuStageCode(row) === "S1";
}

/** 是否项目流程入口（S2/S3/S4） */
export function isProjectFlowEntry(row: any): boolean {
  const code = flowMenuStageCode(row);
  return ["S2", "S3", "S4"].includes(code);
}

/** 是否会议评审入口（S5） */
export function isMeetingReviewEntry(row: any): boolean {
  return flowMenuStageCode(row) === "S5";
}

/** 是否数据核对入口 */
export function isDataCheckEntry(row: any): boolean {
  return row?.entryType === "data-check" || !!row?.isDataCheck;
}

/** 是否阶段流程入口（非会议评审、非数据核对） */
export function isStageFlowEntry(row: any): boolean {
  return isProjectFlowEntry(row);
}

/** 是否普通流程类型 */
export function isNormalFlowType(row: any): boolean {
  return !isMeetingReviewEntry(row) && !isDataCheckEntry(row);
}

/** 解析阶段详情页目标标识 */
export function resolveStageDetailTarget(row: any): string {
  return row?.detailTarget || flowMenuStageCode(row) || "";
}

/**
 * 各阶段默认查看详情页路由路径（对齐 stage-detail-target.js 中的 view 行为）
 * - S1/S2/S3 → 子表审核详情
 * - S4/S5/S6/S7 → 主表审核详情
 * - S8 → 上会评审详情
 */
const STAGE_VIEW_PATH_MAP: Record<string, string> = {
  S1: "/revenue/subtable-audit-detail",
  S2: "/revenue/subtable-audit-detail",
  S3: "/revenue/subtable-audit-detail",
  S4: "/revenue/main-table-audit-detail",
  S5: "/revenue/main-table-audit-detail",
  S6: "/revenue/main-table-audit-detail",
  S7: "/revenue/main-table-audit-detail",
  S8: "/revenue/meeting-review-detail",
};

/** 需要跳转到填报页的 action/menuKey 关键字 */
const FILL_KEYWORDS = new Set(["open_fill", "fill", "stage_final_submit", "submit", "confirm", "flow_s1"]);

/** 解析详情路由（返回 vue-router 可直接 push 的 location 对象） */
export function resolveDetailRoute(row: any): { path: string; query: Record<string, string> } | null {
  const code = flowMenuStageCode(row);
  const projectNo = String(row?.projectNo || "");
  const projectId = String(row?.projectId || "");
  // 至少需要 projectNo 或 projectId 之一才能跳转
  if (!projectNo && !projectId) return null;

  // 判断是否为填报场景
  const isFillAction = FILL_KEYWORDS.has(String(row?.action || row?.actionKey || ""))
    || FILL_KEYWORDS.has(String(row?.menuKey || ""))
    || String(row?.nodeStatus || "") === "IN_PROGRESS";

  // S1/S3 填报场景 → 跳转填报详情页
  let path: string;
  if ((code === "S1" || code === "S3") && isFillAction) {
    path = "/revenue/subtable-fill-detail";
  } else {
    path = STAGE_VIEW_PATH_MAP[code] || "/revenue/subtable-audit-detail";
  }

  // 透传 row 中所有业务字段到 query（过滤 null/undefined 和复杂对象）
  const query: Record<string, string> = {};
  if (row && typeof row === "object") {
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue;
      if (typeof value === "function" || (typeof value === "object" && !Array.isArray(value))) continue;
      query[key] = String(value);
    }
  }

  // 标准化关键字段到 query（兼容不同后端数据源的命名差异）
  // - stage: 阶段代码（S1/S2/.../S8），供 subtable-fill/detail.vue 的 queryStage 使用
  // - flowId: 流程主键 ID，供 queryFlowId 使用
  // - projectNo / projectCode: 项目编号 / 项目代码
  // - nodeStatus / node: 节点状态
  if (code && !query.stage && !query.node) {
    query.stage = code;
  }
  const flowIdRaw = row?.flowId ?? row?.id;
  if (flowIdRaw != null && flowIdRaw !== "") {
    query.flowId = String(flowIdRaw);
  }
  const projectNoRaw = row?.projectNo ?? row?.projectCode ?? row?.wbsNumber;
  if (projectNoRaw != null && projectNoRaw !== "" && !query.projectNo) {
    query.projectNo = String(projectNoRaw);
  }
  const projectCodeRaw = row?.projectCode ?? row?.projectNo;
  if (projectCodeRaw != null && projectCodeRaw !== "" && !query.projectCode) {
    query.projectCode = String(projectCodeRaw);
  }
  const valveRaw = row?.valve ?? row?.valvePoint;
  if (valveRaw != null && valveRaw !== "" && !query.valve) {
    query.valve = String(valveRaw);
  }
  if (row?.nodeStatus != null && row?.nodeStatus !== "" && !query.nodeStatus) {
    query.nodeStatus = String(row.nodeStatus).toUpperCase();
  }

  return { path, query };
}

/** 是否使用项目流程列表 */
export function usesProjectFlowList(row: any): boolean {
  return isProjectFlowEntry(row) || isS1FlowEntry(row);
}

/** 是否前端已迁移的流程入口 */
export function isFrontendMigratedFlowEntry(_row: any): boolean {
  return true;
}
