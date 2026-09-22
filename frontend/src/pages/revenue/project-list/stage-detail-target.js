import {
  AUDIT_DOMAIN,
  normalizeStageCode,
} from "@/pages/revenue/subtable-workbench/domain-config";

const PROJECT_LIST_STAGE_MENU_KEY_MAP = Object.freeze({
  S1: "flow_s1",
  S2: "flow_s2",
  S3: "flow_s3",
  S4: "flow_s4",
  S5: "flow_s5",
  S6: "flow_s6",
  S7: "flow_s7",
  S8: "flow_s8",
});

export function resolveProjectListStageDetailMenuKey({
  currentMenuKey = "",
  stageCode = "",
} = {}) {
  const menuKey = String(currentMenuKey || "").trim();
  if (menuKey !== "project_list") return menuKey;
  const stage = normalizeStageCode(stageCode || "");
  return PROJECT_LIST_STAGE_MENU_KEY_MAP[stage] || menuKey;
}

export function resolveProjectListStageDetailTarget({
  stageCode = "S1",
  actionKey = "",
  hasAction = () => false,
  isSuperAdmin = false,
} = {}) {
  const stage = normalizeStageCode(stageCode || "S1");
  const action = String(actionKey || "").trim().toLowerCase();
  const can = (key) => Boolean(hasAction(key));
  const isSubmitAction = action === "stage_final_submit" || action === "final_submit" || action === "submit";
  // 管理员看到全部数据，不做只读授权范围裁剪
  const restrictedScope = (isSuperAdmin ? "" : (stage === "S2" || stage === "S3" ? "1" : ""));

  if (stage === "S5") {
    if (action === "select_main" || action === "select-main" || action === "select_main_table") {
      if (!can("select_main")) return null;
      return {
        path: "/revenue/s5-main-selection-detail",
        subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
        action: "select_main",
        subjectApiMode: "all",
        selectedSourceStage: "S4",
      };
    }
    if (action === "approve" || action === "decision" || action === "decide") {
      if (!can("approve")) return null;
      return {
        path: "/revenue/s5-decision-approval-detail",
        subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
        action: "approve",
        subjectApiMode: "all",
      };
    }
    if (!can("view")) return null;
    return {
      path: "/revenue/main-table-audit-detail",
      subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
      action: "view",
      subjectApiMode: "all",
    };
  }
  if (stage === "S4" || stage === "S6") {
    if (isSubmitAction) {
      if (!can("review")) return null;
      return {
        path: "/revenue/main-table-audit-detail",
        subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
        action: "review",
        subjectApiMode: "all",
      };
    }
    if (action === "review" || action === "audit") {
      if (!can("review")) return null;
      return {
        path: "/revenue/main-table-audit-detail",
        subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
        action: "review",
        subjectApiMode: "all",
      };
    }
    if (!can("view")) return null;
    return {
      path: "/revenue/main-table-audit-detail",
      subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
      action: "view",
      subjectApiMode: "all",
    };
  }
  if (stage === "S7") {
    if (action === "start_meeting" || action === "start-meeting" || action === "startmeeting") {
      if (!can("start_meeting")) return null;
      return {
        path: "/revenue/main-table-audit-detail",
        subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
        action: "start_meeting",
        subjectApiMode: "all",
      };
    }
    if (action === "edit") {
      if (!can("edit")) return null;
      return {
        path: "/revenue/main-table-audit-detail",
        subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
        action: "edit",
        subjectApiMode: "all",
      };
    }
    if (!can("view")) return null;
    return {
      path: "/revenue/main-table-audit-detail",
      subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
      action: "view",
      subjectApiMode: "all",
    };
  }
  if (stage === "S8") {
    if (action === "review" || action === "audit") {
      if (!can("review")) return null;
      return {
        path: "/revenue/meeting-review-detail",
        subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
        action: "review",
        subjectApiMode: "all",
      };
    }
    if (!can("view")) return null;
    return {
      path: "/revenue/meeting-review-detail",
      subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
      action: "view",
      subjectApiMode: "all",
    };
  }
  if (isSubmitAction) {
    if (!can(action)) return null;
    if (stage === "S2") {
      return {
        path: "/revenue/subtable-audit-detail",
        subjectDomain: AUDIT_DOMAIN.SUBTABLE,
        action: "stage_final_submit",
        subjectApiMode: "all",
      };
    }
    return {
      path: "/revenue/subtable-fill-detail",
      subjectDomain: AUDIT_DOMAIN.SUBTABLE,
      action: "stage_final_submit",
      subjectApiMode: "all",
    };
  }
  if (action === "open_fill" || action === "fill") {
    if (!can(action)) return null;
    return {
      path: "/revenue/subtable-fill-detail",
      subjectDomain: AUDIT_DOMAIN.SUBTABLE,
      action: "open_fill",
    };
  }
  if (action === "confirm") {
    if (!can(action)) return null;
    return {
      path: "/revenue/subtable-fill-detail",
      subjectDomain: AUDIT_DOMAIN.SUBTABLE,
      action: "confirm",
    };
  }
  if (action === "review") {
    if (!can(action)) return null;
    return {
      path: "/revenue/subtable-audit-detail",
      subjectDomain: AUDIT_DOMAIN.SUBTABLE,
      action: "review",
    };
  }
  if (!can("view")) return null;
  return {
    path: "/revenue/subtable-audit-detail",
    subjectDomain: AUDIT_DOMAIN.SUBTABLE,
    action: "view",
    readonlyAuthorizedScope: restrictedScope,
  };
}
