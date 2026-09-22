import { normalizeStageCode } from "../domain-config";
import { resolveStageLabel } from "./stage-labels";
import { safeText } from "./workbench-utils";

function resolveActionableRoutePath(stageCode, rule) {
  const stage = normalizeStageCode(stageCode);
  if (stage === "S1" || stage === "S3") return "/revenue/subtable-fill-detail";
  if (stage === "S8") return "/revenue/meeting-review-detail";
  return rule.subjectDomain === "main"
    ? "/revenue/main-table-audit-detail"
    : "/revenue/subtable-audit-detail";
}

function resolveActionableRouteAction(stageCode, rule = {}) {
  const action = safeText(rule.actionKey).replace(/-/g, "_");
  if (action === "submit") return "stage_final_submit";
  if (action) return action;
  const stage = normalizeStageCode(stageCode);
  if (stage === "S1") return "fill";
  if (stage === "S3") return "confirm";
  if (stage === "S7") return "start_meeting";
  return "review";
}

function getCurrentPageUrl() {
  if (typeof window === "undefined" || !window.location) return "";
  return window.location.href;
}

export function buildActionableTodoWebUrl(ctx, stageCode, rule) {
  const currentUrl = safeText(ctx.todoWebUrl || ctx.currentPageUrl || getCurrentPageUrl());
  const origin = typeof window !== "undefined" && window.location
    ? window.location.origin
    : "";
  const path = resolveActionableRoutePath(stageCode, rule);
  let url;
  try {
    url = new URL(currentUrl || path, origin || undefined);
  } catch (_error) {
    if (!origin) {
      const params = new URLSearchParams();
      params.set("projectCode", ctx.projectCode);
      params.set("stage", stageCode);
      params.set("permissionKey", rule.permissionKey);
      params.set("subjectDomain", rule.subjectDomain);
      return `${path}?${params.toString()}`;
    }
    url = new URL(path, origin);
  }

  url.pathname = path;
  const query = url.searchParams;
  query.set("projectNo", safeText(ctx.projectNo, ctx.projectCode));
  query.set("projectCode", ctx.projectCode);
  if (ctx.projectId) query.set("projectId", ctx.projectId);
  if (ctx.flowId != null) query.set("flowId", String(ctx.flowId));
  if (ctx.projectName) query.set("projectName", ctx.projectName);
  query.set("stage", stageCode);
  if (ctx.nodeStatus) query.set("nodeStatus", ctx.nodeStatus);
  query.set("permissionKey", rule.permissionKey);
  query.set("subjectDomain", rule.subjectDomain);
  query.set("valve", ctx.valve);
  query.set("valvePoint", ctx.valve);
  query.set("action", resolveActionableRouteAction(stageCode, rule));
  query.delete("user");
  query.delete("userName");
  if (stageCode === "S5" && rule.kind === "main-selection") query.set("selectedSourceStage", "S4");
  if (stageCode === "S7") query.set("selectedSourceStage", "S6");
  return url.toString();
}

export function resolveWorkbenchMessageTitle(stageCode, rule) {
  if (rule.kind === "subtable-fill") return "请完成项目科目填报";
  if (rule.kind === "s3-confirmation") return "请完成业务经理二次确认";
  if (rule.kind === "subtable-module-review") return "请完成集团部室审核";
  if (rule.kind === "stage-final-submit") return "请完成审级最终提交";
  if (rule.kind === "main-audit") return "请完成主表审核";
  if (rule.kind === "main-selection") return "请提交主表最终值";
  if (rule.kind === "main-decision-approval") return "请完成 S5 决策评审";
  if (rule.kind === "start-meeting") return "请开始上会处理";
  if (rule.kind === "meeting-review") return "请确认上会评审值";
  return `请处理${resolveStageLabel(stageCode)}`;
}

export function buildWorkbenchMessage(ctx, stageCode) {
  const projectText = [safeText(ctx.projectCode), safeText(ctx.projectName)]
    .filter(Boolean)
    .join(" / ");
  const valveText = ctx.valve ? `，阀点 ${ctx.valve}` : "";
  return `${projectText || "项目"}${valveText} 已流转至 ${resolveStageLabel(stageCode)}，请进入收益管理平台处理。`;
}
