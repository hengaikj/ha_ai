import {
  executeProjectCostFlowAction as executeProjectCostFlowActionApi,
  sendOaBatchMessages as sendOaBatchMessagesApi,
} from "@/api/system/expenses";
import {
  normalizeStageCode,
} from "../domain-config";
import {
  buildRevenueModuleSections,
} from "../matrix-utils";
import {
  buildAuditDetailPayloadFromFillPayload,
} from "./audit-payload";
import {
  queryReviewSuggestionRows,
  requestModuleReviewState,
} from "./audit-record-queries";
import {
  fetchAllSubtableFillPayload,
  fetchStrictPermissionSubjectPayload,
  fetchStrictSubtableFillPayload,
} from "./fill.service";
import {
  normalizeFlowActionResult,
  rememberProjectCostFlowSnapshot,
  shouldNotifyFlowActionTargets,
} from "./flow-context";
import {
  hasMainReviewableRows,
} from "./main-table-preview";
import {
  listProjectOaUsersByPermission,
} from "./oa-users";
import {
  queryS5SubmittedMainRecords,
} from "./project-cost-record-query";
import {
  findModuleEntry,
  parseModuleReviewEntries,
  pickLatestModuleEntries,
  resolveModuleIdentity,
} from "./review-metadata";
import {
  fetchS3ConfirmationPayload,
} from "./s3-confirmation";
import {
  buildS1CompletionSummaryFromDetail,
  buildS2CompletionSummaryFromDetail,
  buildS3CompletionSummaryFromDetail,
  isStageInputRow,
} from "./stage-completion-summary";
import {
  collectPermissionLeafRows,
  getSubjectNodes,
} from "./subject-tree";
import {
  ACTIONABLE_WORKBENCH_RULES,
  hasOperationPermission,
} from "./workbench-permissions";
import {
  buildActionableTodoWebUrl,
  buildWorkbenchMessage,
  resolveWorkbenchMessageTitle,
} from "./workbench-notice";
import {
  hasProjectId,
  isFlowSnapshotInProgress,
  nowText,
  safeText,
  unwrapBizPayload,
} from "./workbench-utils";

const WORKBENCH_NOTIFY_OBJECT_ID = "project-cost-message";
const MAIN_SELECTION_SOURCE_OPTIONS = Object.freeze({
  S5: Object.freeze(["S2", "S3", "S4"]),
  S7: Object.freeze(["S6", "S5", "S2"]),
});
const REVIEW_FLOW_ACTION_STAGES = Object.freeze(["S4", "S6", "S8"]);

export function resolveStageFlowAction(currentStage = "", nextStage = "") {
  const normalizedCurrentStage = normalizeStageCode(currentStage);
  const normalizedNextStage = normalizeStageCode(nextStage);
  if (normalizedCurrentStage === "S7" && normalizedNextStage === "S8") return "start-meeting";
  if (normalizedCurrentStage === "S5") return "approve";
  if (REVIEW_FLOW_ACTION_STAGES.includes(normalizedCurrentStage)) return "review";
  return "SUBMIT";
}

function getDependency(dependencies = {}, key, message) {
  const value = dependencies[key];
  if (typeof value !== "function") {
    throw new Error(message);
  }
  return value;
}

export async function buildStageCompletionSummaryContextPayload(ctx, flowSnapshot, dependencies = {}) {
  const stageCode = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S1");
  if (stageCode === "S1") {
    const detail = ctx.detail && Array.isArray(ctx.detail.rows) && ctx.detail.rows.length
      ? ctx.detail
      : ((await fetchAllSubtableFillPayload(ctx)).detail || {});
    const moduleReviewState = await requestModuleReviewState({ ...ctx, includeReviewerFilter: false }, flowSnapshot);
    return buildS1CompletionSummaryFromDetail(ctx, detail, moduleReviewState.submitMap);
  }

  if (stageCode === "S2") {
    const buildS2SourceDetailForMain = getDependency(
      dependencies,
      "buildS2SourceDetailForMain",
      "缺少 S2 主表来源构建器，无法生成完成清单"
    );
    const source = await buildS2SourceDetailForMain(ctx, flowSnapshot, {
      auditPayload: ctx.auditPayload,
    });
    return buildS2CompletionSummaryFromDetail(ctx, source.detail, source.latestModuleMap);
  }

  if (stageCode === "S3") {
    const detail = ctx.detail && Array.isArray(ctx.detail.rows) && ctx.detail.rows.length
      ? ctx.detail
      : ((await fetchS3ConfirmationPayload(ctx, flowSnapshot, { ownerScoped: false })).detail || {});
    return buildS3CompletionSummaryFromDetail(ctx, detail);
  }

  return {
    stageCode,
    subjectDomain: "subtable",
    ok: false,
    total: 0,
    done: 0,
    blockingCount: 1,
    issues: [{
      type: "unsupported_stage",
      message: `${stageCode} 暂不支持阶段最终提交完成清单`,
    }],
    modules: [],
    message: `${stageCode} 暂不支持阶段最终提交完成清单`,
  };
}

async function hasStrictPermissionLeafSubjects(ctx) {
  const subjectTreePayload = await fetchStrictPermissionSubjectPayload(ctx);
  if (!subjectTreePayload) return false;
  return collectPermissionLeafRows(getSubjectNodes(subjectTreePayload)).length > 0;
}

async function hasSubtableFillWork(ctx) {
  return hasStrictPermissionLeafSubjects(ctx);
}

async function hasS3ConfirmationWork(ctx, flowSnapshot) {
  const payload = await fetchS3ConfirmationPayload(ctx, flowSnapshot, { ownerScoped: false });
  const rows = payload && payload.detail && Array.isArray(payload.detail.rows)
    ? payload.detail.rows
    : [];
  return rows.some((row) => isStageInputRow(row));
}

async function hasSubtableModuleReviewWork(ctx, flowSnapshot) {
  const fillPayload = await fetchStrictSubtableFillPayload(ctx, flowSnapshot, { ownerScoped: false });
  if (!fillPayload) return false;
  const auditPayload = buildAuditDetailPayloadFromFillPayload(ctx, fillPayload);
  const rows = auditPayload && auditPayload.detail && Array.isArray(auditPayload.detail.rows)
    ? auditPayload.detail.rows
    : [];
  const modules = buildRevenueModuleSections(rows);
  if (!modules.length) return false;
  const suggestions = await queryReviewSuggestionRows(ctx, flowSnapshot, { node: ctx.stage });
  const latestModuleMap = pickLatestModuleEntries(parseModuleReviewEntries(suggestions));
  return modules.some((module) => {
    const identity = resolveModuleIdentity({
      rootSubjectId: module.rootSubjectId,
      moduleKey: module.moduleKey || module.key,
      moduleName: module.name,
    });
    const submittedEntry = findModuleEntry(latestModuleMap, identity);
    if (submittedEntry && submittedEntry.submitted) return false;
    return (module.rows || []).some((row) => isStageInputRow(row));
  });
}

async function hasStageFinalSubmitWork(ctx, flowSnapshot, dependencies) {
  const summary = await buildStageCompletionSummaryContextPayload(ctx, flowSnapshot, dependencies);
  return Boolean(summary && summary.ok);
}

async function hasMainAuditWork(ctx, flowSnapshot, dependencies) {
  const buildMainTablePayloadForAuditDetail = getDependency(
    dependencies,
    "buildMainTablePayloadForAuditDetail",
    "缺少主表审核载荷构建器，无法判断主表审核待办"
  );
  const payload = await buildMainTablePayloadForAuditDetail(ctx, flowSnapshot);
  const auditPayload = buildAuditDetailPayloadFromFillPayload(ctx, payload);
  return hasMainReviewableRows(auditPayload.detail || {});
}

async function hasMainSelectionWork(ctx, flowSnapshot, dependencies) {
  const buildMainTableSnapshotPayloadFromStageContext = getDependency(
    dependencies,
    "buildMainTableSnapshotPayloadFromStageContext",
    "缺少主表快照构建器，无法判断主表选择待办"
  );
  const sourceStages = MAIN_SELECTION_SOURCE_OPTIONS[ctx.stage] || MAIN_SELECTION_SOURCE_OPTIONS.S5;
  for (let index = 0; index < sourceStages.length; index += 1) {
    const fillPayload = await buildMainTableSnapshotPayloadFromStageContext(ctx, flowSnapshot, {
      sourceStageCode: sourceStages[index],
    });
    const auditPayload = buildAuditDetailPayloadFromFillPayload(ctx, fillPayload);
    if (hasMainReviewableRows(auditPayload.detail || {})) return true;
  }
  return false;
}

async function hasS5DecisionApprovalWork(ctx, flowSnapshot) {
  if (!hasOperationPermission(ctx, "S5", "approve")) return false;
  const records = await queryS5SubmittedMainRecords(ctx, flowSnapshot);
  return records.length > 0;
}

async function hasActionableWorkbenchWork(ctx, flowSnapshot, rule, dependencies) {
  if (!hasOperationPermission(ctx, ctx.stage, rule.actionKey)) return false;

  if (rule.kind === "subtable-fill") return hasSubtableFillWork(ctx);
  if (rule.kind === "s3-confirmation") return hasS3ConfirmationWork(ctx, flowSnapshot);
  if (rule.kind === "subtable-module-review") return hasSubtableModuleReviewWork(ctx, flowSnapshot);
  if (rule.kind === "stage-final-submit") return hasStageFinalSubmitWork(ctx, flowSnapshot, dependencies);
  if (rule.kind === "main-audit") return hasMainAuditWork(ctx, flowSnapshot, dependencies);
  if (rule.kind === "main-selection") return hasMainSelectionWork(ctx, flowSnapshot, dependencies);
  if (rule.kind === "main-decision-approval") return hasS5DecisionApprovalWork(ctx, flowSnapshot);
  if (rule.kind === "start-meeting") return true;
  if (rule.kind === "edit-meeting") return true;
  if (rule.kind === "meeting-review") {
    return normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S8") === "S8" &&
      isFlowSnapshotInProgress(flowSnapshot);
  }
  return false;
}

async function buildActionableNotificationGroups(ctx, flowSnapshot, stageCode, dependencies) {
  const rules = ACTIONABLE_WORKBENCH_RULES[stageCode] || [];
  const groups = [];
  for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
    const rule = rules[ruleIndex];
    const users = await listProjectOaUsersByPermission(ctx, rule.permissionKey);
    const actionableUsers = [];
    for (let userIndex = 0; userIndex < users.length; userIndex += 1) {
      const user = users[userIndex];
      const userCtx = {
        ...ctx,
        userId: user.userId,
        userName: user.userName,
        permissionKey: rule.permissionKey,
        stage: stageCode,
        stageCode,
        subjectDomain: rule.subjectDomain,
        subjectApiMode: "permission",
      };
      if (await hasActionableWorkbenchWork(userCtx, flowSnapshot, rule, dependencies)) {
        actionableUsers.push(user);
      }
    }
    const phoneNumbers = actionableUsers
      .map((user) => user.phoneNumber)
      .filter((phone, index, list) => phone && list.indexOf(phone) === index);
    if (!phoneNumbers.length) continue;
    const groupKey = `${stageCode}-${safeText(rule.actionKey)}`;
    groups.push({
      groupKey,
      permissions: [rule.permissionKey],
      phoneNumbers,
      title: resolveWorkbenchMessageTitle(stageCode, rule),
      message: buildWorkbenchMessage(ctx, stageCode),
      todoWebUrl: buildActionableTodoWebUrl(ctx, stageCode, rule),
      externalAffairId: `project-cost-flow-${flowSnapshot.flowId}-${groupKey}`,
      objectId: WORKBENCH_NOTIFY_OBJECT_ID,
    });
  }
  return groups;
}

async function notifyActionableWorkbenchUsers(ctx, flowSnapshot, stageCode, dependencies) {
  // OA 能力保留：当前 OA 联调接口有报错，流程流转先暂时停用 OA 通知调用。
  // 恢复 OA 时删除这个短路，让下面的查接收人和批量发送逻辑重新生效。
  return { ok: true, skipped: true, disabled: true, message: "OA 通知暂时停用" };
  // eslint-disable-next-line no-unreachable
  if (!flowSnapshot || flowSnapshot.flowId == null || !hasProjectId(ctx)) {
    return { ok: false, skipped: true, message: "缺少流程或项目 ID，跳过 OA 通知" };
  }
  const notifyCtx = {
    ...ctx,
    flowId: flowSnapshot.flowId,
    nodeStatus: flowSnapshot.nodeStatus,
  };
  const groups = await buildActionableNotificationGroups(notifyCtx, flowSnapshot, stageCode, dependencies);
  if (!groups.length) {
    return { ok: true, skipped: true, sentGroups: 0, total: 0 };
  }
  const payload = await sendOaBatchMessagesApi({
    creatorId: safeText(notifyCtx.userId, "system"),
    todoWebUrl: groups[0].todoWebUrl,
    externalAffairId: `project-cost-flow-${flowSnapshot.flowId}-${stageCode}`,
    objectId: WORKBENCH_NOTIFY_OBJECT_ID,
    messageGroups: groups,
  });
  const data = unwrapBizPayload(payload) || {};
  return {
    ok: true,
    skipped: false,
    sentGroups: groups.length,
    total: data.total || groups.reduce((sum, group) => sum + group.phoneNumbers.length, 0),
    result: data,
  };
}

export async function executeStageSubmitFlowPayload(
  ctx,
  flowSnapshot,
  nextStage,
  actionRemark,
  dependencies = {}
) {
  const currentStage = normalizeStageCode(flowSnapshot.node || ctx.stage);
  const normalizedNextStage = normalizeStageCode(nextStage);
  const action = resolveStageFlowAction(currentStage, normalizedNextStage);
  const actionPayload = await executeProjectCostFlowActionApi(flowSnapshot.flowId, {
    action,
    targetNode: nextStage,
    targetNodeStatus: "IN_PROGRESS",
    secondTriggerRequired: currentStage === "S5",
    operatorId: ctx.userId,
    operatorName: safeText(ctx.actor || ctx.reviewerName || ctx.userName, ctx.userId),
    actionRemark,
  });

  const actionResult = normalizeFlowActionResult(actionPayload, {
    flowId: flowSnapshot.flowId,
    node: flowSnapshot.node || ctx.stage,
    nodeStatus: flowSnapshot.nodeStatus,
  });
  // 后端未回写 nodeUpdated 时：若响应节点已是目标阶段，仍视为流转成功（避免误走 pendingConfirm 不关页）
  const reachedTarget =
    normalizeStageCode(actionResult.node) === normalizedNextStage;
  const nodeUpdated = Boolean(actionResult.nodeUpdated || reachedTarget);
  const effectiveStage = nodeUpdated
    ? normalizeStageCode(actionResult.node || normalizedNextStage)
    : normalizeStageCode(flowSnapshot.node || ctx.stage);
  const updatedFlowSnapshot = {
    ...flowSnapshot,
    node: effectiveStage,
    nodeStatus: actionResult.nodeStatus || flowSnapshot.nodeStatus,
    updatedAt: (actionResult.raw && actionResult.raw.updatedAt) || flowSnapshot.updatedAt,
  };
  if (nodeUpdated) {
    rememberProjectCostFlowSnapshot(ctx, updatedFlowSnapshot);
  }

  let notificationResult = null;
  if (shouldNotifyFlowActionTargets({ ...actionResult, nodeUpdated })) {
    try {
      notificationResult = await notifyActionableWorkbenchUsers(ctx, updatedFlowSnapshot, effectiveStage, dependencies);
    } catch (error) {
      notificationResult = {
        ok: false,
        message: safeText(error && error.message, "OA 通知发送失败"),
      };
    }
  }

  return {
    submittedAt: nowText(),
    nextStage: effectiveStage,
    targetStage: nextStage,
    nodeUpdated,
    triggerCount: actionResult.triggerCount,
    pendingConfirm: !nodeUpdated,
    notificationResult,
  };
}
