import {
  REVENUE_MODULE_CODE,
  isReviewableAuditValueSource,
  normalizeStageCode,
} from "../domain-config";
import { isSavableMatrixRow } from "../matrix-utils";
import { resolveFlowStageActionPermission } from "@/pages/revenue/permissions";
import { isTruthyFlag, safeText } from "./workbench-utils";

const TARGETLESS_MAIN_AUDIT_FORMULA_KEYS = Object.freeze([
  "main.tax",
  "main.huawei_service_fee",
  "main.option_income",
]);

const TARGETLESS_MAIN_AUDIT_PATHS = Object.freeze([
  "主表/单车收益/消费税金及附加",
  "主表/单车收益/华为服务费",
  "主表/单车收益/选装收益",
]);

function readTemplateEntryMode(row = {}) {
  return safeText(
    row.templateEntryMode ||
      row.entryMode ||
      (row.templateItem && row.templateItem.entryMode)
  ).toUpperCase();
}

function isMainModuleRow(row = {}) {
  const moduleCode = safeText(row && row.moduleCode).toLowerCase();
  if (moduleCode === REVENUE_MODULE_CODE.MAIN_PNL) return true;
  const path = safeText(row && (row.subjectPath || row.fullNamePath || row.path));
  return path === "主表" || path.indexOf("主表/") === 0;
}

function isMainManualTemplateRow(row = {}) {
  return isMainModuleRow(row) && readTemplateEntryMode(row) === "MANUAL";
}

function buildActionableRule(stageCode, actionKey, subjectDomain, kind) {
  return {
    permissionKey: resolveFlowStageActionPermission(stageCode, actionKey),
    actionKey,
    subjectDomain,
    kind,
  };
}

export const ACTIONABLE_WORKBENCH_RULES = Object.freeze({
  S1: Object.freeze([
    buildActionableRule("S1", "fill", "subtable", "subtable-fill"),
    buildActionableRule("S1", "submit", "subtable", "stage-final-submit"),
  ]),
  S2: Object.freeze([
    buildActionableRule("S2", "review", "subtable", "subtable-module-review"),
    buildActionableRule("S2", "submit", "subtable", "stage-final-submit"),
  ]),
  S3: Object.freeze([
    buildActionableRule("S3", "confirm", "subtable", "s3-confirmation"),
    buildActionableRule("S3", "submit", "subtable", "stage-final-submit"),
  ]),
  S4: Object.freeze([
    buildActionableRule("S4", "review", "main", "main-audit"),
  ]),
  S5: Object.freeze([
    buildActionableRule("S5", "select_main", "main", "main-selection"),
    buildActionableRule("S5", "approve", "main", "main-decision-approval"),
  ]),
  S6: Object.freeze([
    buildActionableRule("S6", "review", "main", "main-audit"),
  ]),
  S7: Object.freeze([
    buildActionableRule("S7", "start_meeting", "main", "start-meeting"),
    buildActionableRule("S7", "edit", "main", "edit-meeting"),
  ]),
  S8: Object.freeze([
    buildActionableRule("S8", "review", "main", "meeting-review"),
  ]),
});

export function isTargetlessMainAuditStage(stageCode = "") {
  return ["S4", "S6"].includes(normalizeStageCode(stageCode));
}

export function isTargetlessMainAuditRow(row = {}) {
  if (isMainManualTemplateRow(row)) return true;
  const formulaKey = safeText(row && (row.formulaKey || row.formulaCode || row.code));
  if (TARGETLESS_MAIN_AUDIT_FORMULA_KEYS.includes(formulaKey)) return true;
  const path = safeText(row && (row.subjectPath || row.fullNamePath || row.path));
  return TARGETLESS_MAIN_AUDIT_PATHS.includes(path);
}

export function canCreateTargetlessMainAuditValue(ctx = {}, row = {}, stageCode = "") {
  return safeText(ctx.subjectDomain).toLowerCase() === "main" &&
    isTargetlessMainAuditStage(stageCode || ctx.stageCode || ctx.stage) &&
    isTargetlessMainAuditRow(row);
}

export function isTargetlessSubtableAuditStage(stageCode = "") {
  return normalizeStageCode(stageCode) === "S2";
}

export function canCreateTargetlessSubtableAuditValue(ctx = {}, row = {}, stageCode = "") {
  return safeText(ctx.subjectDomain).toLowerCase() === "subtable" &&
    isTargetlessSubtableAuditStage(stageCode || ctx.stageCode || ctx.stage) &&
    isSavableMatrixRow(row) &&
    isReviewableAuditValueSource(ctx.subjectDomain, row);
}

export function resolveOperationPermissionKey(ctx = {}, fallback = "revenue:operate") {
  return safeText(
    ctx.permissionKey ||
      ctx.actionPermission ||
      ctx.submitterPermission ||
      ctx.reviewerPermission ||
      ctx.operatorPermission,
    fallback
  );
}

export function hasFullSubjectScope(ctx = {}) {
  return isTruthyFlag(ctx.fullAccess || ctx.hasAllPermission) ||
    safeText(ctx.subjectApiMode).toLowerCase() === "all";
}

/**
 * 是否按归属人过滤子表填报/确认明细。
 * S3 二次确认单元格值改为「同流程同节点共享」：所有 S3 复核人看到并改同一份数据，
 * 不再按 ownerId 隔离草稿（「提交本人二次确认」仍表示本人提交进度，与单元格值共享无关）。
 */
export function shouldScopeSubtableFillToOwner(ctx = {}, stageCode) {
  void ctx;
  void stageCode;
  return false;
}

export function hasOperationPermission(ctx = {}, stageCode = "", actionKey = "") {
  const permissionKey = resolveOperationPermissionKey(ctx, "");
  const expected = resolveFlowStageActionPermission(stageCode || ctx.stageCode || ctx.stage, actionKey);
  return Boolean(
    hasFullSubjectScope(ctx) ||
      permissionKey === "*:*:*" ||
      (expected && permissionKey === expected)
  );
}
