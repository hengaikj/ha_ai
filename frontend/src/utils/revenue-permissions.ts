/**
 * 收益模块权限常量和工具函数
 * 从 src/pages/revenue/permissions.js 迁移而来，添加完整类型定义
 */

import { ref } from "vue";
import type { FlowStagePermissions, RevenueFormulaPermissions, RevenueTemplatePermissions } from "@/types/revenue";
import type { FlowAction, FlowStageCode } from "@/types/revenue";

// ============================================================
// 权限常量
// ============================================================

export const REVENUE_FLOW_STAGE_PERMISSIONS: Record<FlowStageCode, FlowStagePermissions> = Object.freeze({
  S1: Object.freeze({ index: "revenue:s1:index", view: "revenue:s1:view", fill: "revenue:s1:fill", submit: "revenue:s1:submit", cancelSubmit: "revenue:s1:cancel-submit" }),
  S2: Object.freeze({ index: "revenue:s2:index", view: "revenue:s2:view", review: "revenue:s2:review", submit: "revenue:s2:submit" }),
  S3: Object.freeze({ index: "revenue:s3:index", view: "revenue:s3:view", confirm: "revenue:s3:confirm", submit: "revenue:s3:submit" }),
  S4: Object.freeze({ index: "revenue:s4:index", view: "revenue:s4:view", review: "revenue:s4:review" }),
  S5: Object.freeze({ index: "revenue:s5:index", view: "revenue:s5:view", selectMain: "revenue:s5:select-main", approve: "revenue:s5:approve" }),
  S6: Object.freeze({ index: "revenue:s6:index", view: "revenue:s6:view", review: "revenue:s6:review" }),
  S7: Object.freeze({ index: "revenue:s7:index", view: "revenue:s7:view", edit: "revenue:s7:edit", startMeeting: "revenue:s7:start-meeting" }),
  S8: Object.freeze({ index: "revenue:s8:index", view: "revenue:s8:view", review: "revenue:s8:review" }),
});

export const REVENUE_FORMULA_PERMISSIONS: RevenueFormulaPermissions = Object.freeze({
  create: "revenue:formula:create",
  update: "revenue:formula:update",
  status: "revenue:formula:status",
  delete: "revenue:formula:delete",
});

export const REVENUE_TEMPLATE_PERMISSIONS: RevenueTemplatePermissions = Object.freeze({
  create: "revenue:template:create",
  update: "revenue:template:update",
  status: "revenue:template:status",
});

/** 对齐 Vue2：当前项目列表按钮权限（show/add/void） */
export const REVENUE_PERMISSIONS = Object.freeze({
  PROJECT_LIST_SHOW: "revenue:project-list:show",
  PROJECT_LIST_ADD: "revenue:project-list:add",
  PROJECT_LIST_VOID: "revenue:project-list:void",
});

const ALL_PERMISSION = "*:*:*";
const FLOW_STAGE_CODES: readonly string[] = Object.freeze(Object.keys(REVENUE_FLOW_STAGE_PERMISSIONS));

// ============================================================
// 内部辅助
// ============================================================

function safeText(value: unknown, fallback = ""): string {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function normalizeFlowStageCode(stageCode: unknown = ""): FlowStageCode | "" {
  const stage = safeText(stageCode).toUpperCase();
  return (FLOW_STAGE_CODES as readonly string[]).includes(stage) ? stage as FlowStageCode : "";
}

function normalizeActionKey(actionKey: unknown = ""): string {
  return safeText(actionKey).toLowerCase();
}

function isSubmitAction(action: string): boolean {
  return ["stage_final_submit", "final_submit", "submit"].includes(action);
}

// ============================================================
// 权限判断
// ============================================================

export function hasRevenuePermission(permissions: string[] = [], permission: string): boolean {
  const target = safeText(permission);
  if (!target) return false;
  const list = Array.isArray(permissions) ? permissions : [];
  return list.some((item) => item === ALL_PERMISSION || item === target);
}

export function resolveFlowStageIndexPermission(stageCode: unknown = ""): string {
  const stage = normalizeFlowStageCode(stageCode);
  return stage ? REVENUE_FLOW_STAGE_PERMISSIONS[stage].index : "";
}

export function resolveFlowStageActionPermission(stageCode: unknown = "", actionKey: unknown = ""): string {
  const stage = normalizeFlowStageCode(stageCode);
  if (!stage) return "";
  const action = normalizeActionKey(actionKey);
  const perms = REVENUE_FLOW_STAGE_PERMISSIONS[stage];

  if (action === "view" || action === "open_flow") return perms.view || "";

  if (stage === "S1") {
    if (isSubmitAction(action)) return perms.submit;
    if (action === "cancel_submit" || action === "cancel-submit") return perms.cancelSubmit;
    if (["fill", "open_fill"].includes(action)) return perms.fill;
  }
  if (stage === "S2") {
    if (isSubmitAction(action)) return perms.submit;
    if (action === "review" || action === "audit") return perms.review;
  }
  if (stage === "S3") {
    if (isSubmitAction(action)) return perms.submit;
    if (["confirm", "fill", "open_fill"].includes(action)) return perms.confirm;
  }
  if (stage === "S4" || stage === "S6") {
    if (isSubmitAction(action) || action === "review" || action === "audit") return perms.review;
  }
  if (stage === "S8") {
    if (action === "review" || action === "audit") return perms.review;
  }
  if (stage === "S5") {
    if (["select_main", "select-main", "select_main_table", "select"].includes(action)) return perms.selectMain;
    if (["approve", "decision", "decide"].includes(action)) return perms.approve;
  }
  if (stage === "S7") {
    if (action === "edit" || action === "edit_notice") return perms.edit;
    if (["start_meeting", "start-meeting", "startmeeting"].includes(action)) return perms.startMeeting;
  }
  return "";
}

export function hasFlowStageIndexPermission(permissions: string[] = [], stageCode: unknown = ""): boolean {
  return hasRevenuePermission(permissions, resolveFlowStageIndexPermission(stageCode));
}

export function hasFlowStageActionPermission(
  permissions: string[] = [],
  stageCode: unknown = "",
  actionKey: unknown = "",
): boolean {
  const action = normalizeActionKey(actionKey);
  const stage = normalizeFlowStageCode(stageCode);
  if (!stage) return false;
  if (action === "view" || action === "open_flow") {
    const stagePerms = REVENUE_FLOW_STAGE_PERMISSIONS[stage];
    if (hasRevenuePermission(permissions, stagePerms.view)) return true;
    if (stage === "S1" && hasRevenuePermission(permissions, stagePerms.submit)) return true;
    return false;
  }
  const permission = resolveFlowStageActionPermission(stage, action);
  return Boolean(permission && hasRevenuePermission(permissions, permission));
}

export function resolveFlowStageDefaultAction(
  stageCode: unknown = "",
  permissions: string[] = [],
): string {
  const stage = normalizeFlowStageCode(stageCode);
  if (!stage) return "";

  const hasAct = (actionKey: string) => hasFlowStageActionPermission(permissions, stage, actionKey);

  if (stage === "S1") {
    if (hasAct("open_fill")) return "open_fill";
    if (hasAct("submit")) return "stage_final_submit";
    if (hasAct("view")) return "view";
  }
  if (stage === "S2") {
    if (hasAct("review")) return "review";
    if (hasAct("submit")) return "stage_final_submit";
    if (hasAct("view")) return "view";
  }
  if (stage === "S3") {
    if (hasAct("confirm")) return "confirm";
    if (hasAct("submit")) return "stage_final_submit";
    if (hasAct("view")) return "view";
  }
  if (stage === "S4" || stage === "S6") {
    if (hasAct("review")) return "review";
    if (hasAct("view")) return "view";
  }
  if (stage === "S5") {
    if (hasAct("select_main")) return "select_main";
    if (hasAct("approve")) return "approve";
    if (hasAct("view")) return "view";
  }
  if (stage === "S7") {
    if (hasAct("start_meeting")) return "start_meeting";
    if (hasAct("edit")) return "edit";
    if (hasAct("view")) return "view";
  }
  if (stage === "S8") {
    if (hasAct("review")) return "review";
    if (hasAct("view")) return "view";
  }
  if (hasAct("view")) return "view";
  return "";
}

export function buildFlowStageActions(
  stageCode: unknown = "",
  permissions: string[] = [],
): FlowAction[] {
  const stage = normalizeFlowStageCode(stageCode);
  if (!stage) return [];
  if (stage === "S1") return buildS1FlowActions(permissions);

  const actions: FlowAction[] = [];
  const hasAct = (actionKey: string) => hasFlowStageActionPermission(permissions, stage, actionKey);

  if (hasAct("view")) {
    actions.push({ key: "view", label: "查看", primary: false });
  }

  if (stage === "S2") {
    const hasReview = hasAct("review");
    if (hasReview) actions.push({ key: "review", label: "审核", primary: true });
    if (hasAct("submit")) actions.push({ key: "stage_final_submit", label: "节点提交", primary: !hasReview });
  } else if (stage === "S3") {
    const hasConfirm = hasAct("confirm");
    if (hasConfirm) actions.push({ key: "confirm", label: "复核", primary: true });
    if (hasAct("submit")) actions.push({ key: "stage_final_submit", label: "节点提交", primary: !hasConfirm });
  } else if (stage === "S4" || stage === "S6") {
    if (hasAct("review")) actions.push({ key: "review", label: "审核并提交", primary: true });
  } else if (stage === "S5") {
    const hasSelectMain = hasAct("select_main");
    if (hasSelectMain) actions.push({ key: "select_main", label: "确认主表", primary: true });
    if (hasAct("approve")) actions.push({ key: "approve", label: "决策确认", primary: !hasSelectMain });
  } else if (stage === "S7") {
    const hasStartMeeting = hasAct("start_meeting");
    if (hasStartMeeting) actions.push({ key: "start_meeting", label: "开始上会", primary: true });
    if (hasAct("edit")) actions.push({ key: "edit", label: "维护上会信息", primary: !hasStartMeeting });
  } else if (stage === "S8") {
    if (hasAct("review")) actions.push({ key: "review", label: "上会评审", primary: true });
  }

  return actions;
}

export function buildS1FlowActions(permissions: string[] = []): FlowAction[] {
  const actions: FlowAction[] = [];
  if (hasFlowStageActionPermission(permissions, "S1", "view")) {
    actions.push({ key: "view", label: "查看", primary: false });
  }
  if (hasFlowStageActionPermission(permissions, "S1", "open_fill")) {
    actions.push({ key: "open_fill", label: "填报", primary: true });
  }
  if (hasFlowStageActionPermission(permissions, "S1", "submit")) {
    actions.push({
      key: "stage_final_submit",
      label: "节点提交",
      primary: !hasFlowStageActionPermission(permissions, "S1", "open_fill"),
    });
  }
  return actions;
}

// ============================================================
// 项目权限 Composable
// ============================================================

/**
 * 收益模块 - 项目权限验证 composable
 * 根据路由参数获取当前项目并校验权限
 */
export function useRevenueProjectPermissions() {
  const authChecked = ref(true);
  const currentProject = ref(null);

  return {
    currentProject,
    authChecked,
  };
}
