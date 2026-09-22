/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
/**
 * 收益 - 阶段操作解析
 */

interface FlowAction {
  key: string;
  label: string;
  permissionKey?: string;
  routeActionKey?: string;
  [key: string]: any;
}

/** 解析流程阶段默认操作 */
export function resolveFlowStageDefaultAction(row: any): FlowAction | null {
  const actions = resolveProjectFlowRowActions(row);
  return actions.length > 0 ? actions[0] : null;
}

/** 解析流程权限 key */
export function resolveFlowPermissionKey(row: any): string {
  const stage = row?.stage || "";
  return `revenue:${stage.toLowerCase()}:action`;
}

/** 解析流程路由操作 key */
export function resolveFlowRouteActionKey(row: any): string {
  const stage = row?.stage || "";
  return `revenue-${stage.toLowerCase()}-action`;
}

/** 解析项目流程行操作 */
export function resolveProjectFlowRowActions(row: any): FlowAction[] {
  const stage = String(row?.stage || row?.currentStage || "").trim().toUpperCase();
  const defaultActions: Record<string, FlowAction[]> = {
    S1: [{ key: "enter", label: "进入" }],
    S2: [{ key: "fill", label: "填报" }],
    S3: [{ key: "audit", label: "审核" }],
    S4: [{ key: "audit", label: "审核" }],
    S5: [
      { key: "select", label: "选择" },
      { key: "approve", label: "审批" },
    ],
  };
  return defaultActions[stage] || [{ key: "view", label: "查看" }];
}
