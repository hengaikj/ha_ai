import {
  normalizeStageCode,
} from "../domain-config";
import {
  requestModuleReviewState,
} from "./audit-record-queries";
import {
  buildDetailDebugSummary,
  revenueMainGenerateLog,
} from "./detail-diagnostics";
import {
  fetchAllSubtableFillPayload,
} from "./fill.service";
import {
  fetchS3ConfirmationPayload,
  hasS3ConfirmationDetailRows,
  saveS3ConfirmationSnapshot,
} from "./s3-confirmation";
import {
  buildS1CompletionSummaryFromDetail,
  buildS2CompletionSummaryFromDetail,
  buildS3CompletionSummaryFromDetail,
  buildS3OwnerConfirmationSummaryFromDetail,
  buildS3OwnerSubmitContext,
  isS3OwnerSubmitterContext,
  logS3OwnerConfirmationSummary,
} from "./stage-completion-summary";
import {
  resolveNextStageCode,
  resolveStageLabel,
} from "./stage-labels";
import {
  hasOperationPermission,
  resolveOperationPermissionKey,
} from "./workbench-permissions";
import {
  safeText,
} from "./workbench-utils";

function getExecuteStageSubmitFlow(dependencies = {}) {
  const executeStageSubmitFlow = dependencies.executeStageSubmitFlow;
  if (typeof executeStageSubmitFlow !== "function") {
    throw new Error("缺少流程提交器，无法提交流程");
  }
  return executeStageSubmitFlow;
}

function getDependency(dependencies = {}, key, message) {
  const value = dependencies[key];
  if (typeof value !== "function") {
    throw new Error(message);
  }
  return value;
}

export async function submitSubtableAuditStagePayload(ctx, flowSnapshot, dependencies = {}) {
  try {
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法提交审级" };
    }

    const currentStage = safeText(flowSnapshot.node || ctx.stage, "S1").toUpperCase();
    if (currentStage === "S2" && ctx.subjectDomain === "subtable" && !hasOperationPermission(ctx, "S2", "submit")) {
      return {
        ok: false,
        message: "S2 集团部室审核阶段由管理经理最终提交并流转到 S3 业务经理二次确认",
      };
    }
    const nextStage = resolveNextStageCode(currentStage);
    const flowResult = await getExecuteStageSubmitFlow(dependencies)(
      ctx,
      flowSnapshot,
      nextStage,
      "提交审级"
    );

    return {
      ok: true,
      result: flowResult,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "提交审级失败"),
    };
  }
}

export async function submitS7StartMeetingPayload(mainCtx, flowSnapshot, dependencies = {}) {
  try {
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法开始上会" };
    }

    const currentStage = normalizeStageCode(flowSnapshot.node || mainCtx.stage || "S7");
    if (currentStage !== "S7") {
      return { ok: false, message: `当前流程已在 ${resolveStageLabel(currentStage)}，不能开始上会` };
    }

    if (!hasOperationPermission(mainCtx, "S7", "start_meeting")) {
      return { ok: false, message: "当前权限不具备开始上会权限" };
    }

    const flowResult = await getExecuteStageSubmitFlow(dependencies)(
      mainCtx,
      flowSnapshot,
      "S8",
      "S7 会前窗口期开始上会"
    );
    return {
      ok: true,
      result: flowResult,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "开始上会失败"),
    };
  }
}

export async function submitS1StageFinalPayload(ctx, flowSnapshot, dependencies = {}) {
  try {
    revenueMainGenerateLog("S1最终提交-开始", {
      projectCode: ctx.projectCode,
      valve: ctx.valve,
      stage: ctx.stage,
      permissionKey: resolveOperationPermissionKey(ctx, ""),
      userId: ctx.userId,
      subjectApiMode: ctx.subjectApiMode,
      subjectDomain: ctx.subjectDomain,
    });
    if (!hasOperationPermission(ctx, "S1", "submit") && !ctx.s1FlowSubmitPermission) {
      revenueMainGenerateLog("S1最终提交-拦截：无菜单提交权限", {
        permissionKey: resolveOperationPermissionKey(ctx, ""),
        s1FlowSubmitPermission: ctx.s1FlowSubmitPermission,
      });
      return { ok: false, message: "缺少 S1 节点提交权限" };
    }
    revenueMainGenerateLog("S1最终提交-流程", flowSnapshot);
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法最终提交" };
    }
    const currentStage = normalizeStageCode(flowSnapshot.node || ctx.stage || "S1");
    if (currentStage !== "S1") {
      revenueMainGenerateLog("S1最终提交-拦截：阶段不匹配", {
        currentStage,
        flowSnapshot,
      });
      return { ok: false, message: `当前流程已在 ${resolveStageLabel(currentStage)}，不能执行 S1 业务经理填报最终提交` };
    }

    const sourceDetail = ctx.detail && Array.isArray(ctx.detail.rows) && ctx.detail.rows.length
      ? ctx.detail
      : ((await fetchAllSubtableFillPayload(ctx)).detail || {});
    revenueMainGenerateLog("S1最终提交-源子表数据", buildDetailDebugSummary(sourceDetail));
    const moduleReviewState = await requestModuleReviewState({ ...ctx, includeReviewerFilter: false }, flowSnapshot);
    const summary = buildS1CompletionSummaryFromDetail(ctx, sourceDetail, moduleReviewState.submitMap);
    revenueMainGenerateLog("S1最终提交-完成清单", {
      ok: summary.ok,
      total: summary.total,
      done: summary.done,
      missingCount: summary.missingCount,
      blockingCount: summary.blockingCount,
      message: summary.message,
      issueSample: (summary.issues || []).slice(0, 10),
    });
    if (!summary.ok) {
      return {
        ok: false,
        message: summary.message,
        summary,
      };
    }

    const generateMainTableFromStageContext = getDependency(
      dependencies,
      "generateMainTableFromStageContext",
      "缺少主表生成器，无法执行 S1 最终提交"
    );
    const mainResult = await generateMainTableFromStageContext(ctx, flowSnapshot, {
      sourceStageCode: "S1",
      sourceDetail,
      saveMode: "ARCHIVED",
      submitRemark: "AUTO_MAIN_FROM_S1_FINAL_SUBMIT",
    });
    revenueMainGenerateLog("S1最终提交-主表生成结果", mainResult);
    if (!mainResult.ok) {
      return {
        ok: false,
        message: mainResult.message || "S1 业务经理填报主表生成失败",
        summary,
        mainResult,
      };
    }

    const flowResult = await getExecuteStageSubmitFlow(dependencies)(
      ctx,
      flowSnapshot,
      "S2",
      "S1 业务经理填报管理经理最终提交"
    );
    revenueMainGenerateLog("S1最终提交-流转结果", flowResult);
    return {
      ok: true,
      summary,
      mainResult,
      result: flowResult,
    };
  } catch (error) {
    revenueMainGenerateLog("S1最终提交-异常", {
      message: safeText(error && error.message),
      error,
    });
    return {
      ok: false,
      message: safeText(error && error.message, "S1 业务经理填报最终提交失败"),
    };
  }
}

export async function submitS2StageFinalPayload(ctx, flowSnapshot, dependencies = {}) {
  try {
    if (!hasOperationPermission(ctx, "S2", "submit")) {
      return { ok: false, message: "当前权限不具备 S2 集团部室审核阶段最终提交权限" };
    }
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法最终提交" };
    }
    const currentStage = normalizeStageCode(flowSnapshot.node || ctx.stage || "S2");
    if (currentStage !== "S2") {
      return { ok: false, message: `当前流程已在 ${resolveStageLabel(currentStage)}，不能执行 S2 集团部室审核最终提交` };
    }

    const buildS2SourceDetailForMain = getDependency(
      dependencies,
      "buildS2SourceDetailForMain",
      "缺少 S2 主表来源构建器，无法最终提交"
    );
    const source = await buildS2SourceDetailForMain(ctx, flowSnapshot, {
      auditPayload: ctx.auditPayload,
    });
    const summary = buildS2CompletionSummaryFromDetail(ctx, source.detail, source.latestModuleMap);
    if (!summary.ok) {
      return {
        ok: false,
        message: summary.message,
        summary,
      };
    }

    const generateMainTableFromStageContext = getDependency(
      dependencies,
      "generateMainTableFromStageContext",
      "缺少主表生成器，无法执行 S2 最终提交"
    );
    const mainResult = await generateMainTableFromStageContext(ctx, flowSnapshot, {
      sourceStageCode: "S2",
      sourceDetail: source.detail,
      saveMode: "ARCHIVED",
      submitRemark: "AUTO_MAIN_FROM_S2_FINAL_SUBMIT",
    });
    if (!mainResult.ok) {
      return {
        ok: false,
        message: mainResult.message || "S2 集团部室审核主表生成失败",
        summary,
        mainResult,
      };
    }

    const flowResult = await getExecuteStageSubmitFlow(dependencies)(
      ctx,
      flowSnapshot,
      "S3",
      "S2 集团部室审核管理经理最终提交"
    );
    return {
      ok: true,
      summary,
      mainResult,
      result: flowResult,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "S2 集团部室审核最终提交失败"),
    };
  }
}

export async function submitS3StageFinalPayload(ctx, flowSnapshot, dependencies = {}) {
  try {
    const submitIntent = safeText(ctx.submitIntent).toLowerCase();
    const isOwnerSubmitIntent = ["owner", "owner_confirm", "secondary_confirm"].includes(submitIntent);
    const isStageFinalSubmitIntent = ["stage_final", "stage-final", "final"].includes(submitIntent);
    const hasFinalSubmitPermission = hasOperationPermission(ctx, "S3", "submit");
    const hasOwnerSubmitPermission =
      hasOperationPermission(ctx, "S3", "confirm") || isS3OwnerSubmitterContext(ctx);
    const isFinalSubmitter = isStageFinalSubmitIntent
      ? hasFinalSubmitPermission
      : (!isOwnerSubmitIntent && hasFinalSubmitPermission);
    const isOwnerSubmitter = isOwnerSubmitIntent
      ? hasOwnerSubmitPermission
      : (!isFinalSubmitter && isS3OwnerSubmitterContext(ctx));
    if (!isOwnerSubmitter && !isFinalSubmitter) {
      return { ok: false, message: "当前权限不具备 S3 业务经理二次确认提交权限" };
    }
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法提交二次确认" };
    }
    const currentStage = normalizeStageCode(flowSnapshot.node || ctx.stage || "S3");
    if (currentStage !== "S3") {
      return { ok: false, message: `当前流程已在 ${resolveStageLabel(currentStage)}，不能执行 S3 业务经理二次确认提交` };
    }

    if (isOwnerSubmitter) {
      const ownerCtx = buildS3OwnerSubmitContext(ctx);
      if (!hasS3ConfirmationDetailRows(ctx.detail)) {
        return {
          ok: false,
          message: "当前页面缺少 S3 二次确认明细，不能提交；请重新进入详情页后再提交",
        };
      }
      const ownerDetail = ctx.detail;
      const ownerSummary = buildS3OwnerConfirmationSummaryFromDetail(ownerDetail, ownerCtx);
      logS3OwnerConfirmationSummary(ownerCtx, ownerSummary);
      if (!ownerSummary.ok) {
        return {
          ok: false,
          message: ownerSummary.message,
          summary: ownerSummary,
        };
      }
      const snapshot = await saveS3ConfirmationSnapshot(ownerCtx, flowSnapshot, ownerDetail);
      return {
        ok: true,
        savedCount: snapshot.savedCount || 0,
        summary: ownerSummary,
        result: {
          pendingConfirm: true,
          targetStage: "S4",
        },
      };
    }

    const sourceDetail = ctx.detail && Array.isArray(ctx.detail.rows) && ctx.detail.rows.length
      ? ctx.detail
      : ((await fetchS3ConfirmationPayload(ctx, flowSnapshot, { ownerScoped: false })).detail || {});

    const confirmedSourceDetail =
      ((await fetchS3ConfirmationPayload(ctx, flowSnapshot, { ownerScoped: false })).detail || sourceDetail);
    const summary = buildS3CompletionSummaryFromDetail(ctx, confirmedSourceDetail);
    if (!summary.ok) {
      return {
        ok: false,
        message: summary.message,
        summary,
      };
    }

    const generateMainTableFromStageContext = getDependency(
      dependencies,
      "generateMainTableFromStageContext",
      "缺少主表生成器，无法执行 S3 最终提交"
    );
    const mainResult = await generateMainTableFromStageContext(ctx, flowSnapshot, {
      sourceStageCode: "S3",
      sourceDetail: confirmedSourceDetail,
      saveMode: "ARCHIVED",
      submitRemark: "AUTO_MAIN_FROM_S3_FINAL_SUBMIT",
    });
    if (!mainResult.ok) {
      return {
        ok: false,
        message: mainResult.message || "S3 业务经理二次确认主表生成失败",
        mainResult,
      };
    }

    const flowResult = await getExecuteStageSubmitFlow(dependencies)(
      ctx,
      flowSnapshot,
      "S4",
      "S3 业务经理二次确认最终提交"
    );
    return {
      ok: true,
      summary,
      mainResult,
      result: flowResult,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "S3 业务经理二次确认提交失败"),
    };
  }
}
