import {
  ensureProjectCostFlow,
} from "./flow-context";
import {
  submitS1StageFinalPayload,
  submitS2StageFinalPayload,
  submitS3StageFinalPayload,
  submitS7StartMeetingPayload,
} from "./stage-final.service";
import {
  normalizeWorkbenchParams,
  safeText,
} from "./workbench-utils";

async function invokeWorkbenchOperation(options = {}) {
  const { params = {}, realHandler } = options;
  const ctx = normalizeWorkbenchParams(params);
  return realHandler(ctx);
}

function requireDependency(dependencies = {}, key, message) {
  const value = dependencies[key];
  if (typeof value !== "function") {
    throw new Error(message);
  }
  return value;
}

export async function submitS7StartMeetingEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const mainCtx = {
        ...ctx,
        subjectDomain: "main",
        subjectApiMode: "all",
      };
      const flowSnapshot = await ensureProjectCostFlow(mainCtx, { createIfMissing: false });
      return submitS7StartMeetingPayload(mainCtx, flowSnapshot, dependencies);
    },
  });
}

export async function buildStageCompletionSummaryEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      try {
        const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
        if (flowSnapshot.flowId == null) {
          return {
            ok: false,
            total: 0,
            done: 0,
            blockingCount: 1,
            issues: [{
              type: "missing_flow",
              message: "未找到可用流程，无法生成完成清单",
            }],
            modules: [],
            message: "未找到可用流程，无法生成完成清单",
          };
        }
        return requireDependency(
          dependencies,
          "buildStageCompletionSummaryContext",
          "缺少完成清单构建器，无法生成完成清单"
        )(ctx, flowSnapshot);
      } catch (error) {
        return {
          ok: false,
          total: 0,
          done: 0,
          blockingCount: 1,
          issues: [{
            type: "summary_error",
            message: safeText(error && error.message, "生成完成清单失败"),
          }],
          modules: [],
          message: safeText(error && error.message, "生成完成清单失败"),
        };
      }
    },
  });
}

export async function generateMainTableFromStageEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      try {
        const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
        if (flowSnapshot.flowId == null) {
          return { ok: false, message: "未找到可用流程，无法生成主表" };
        }
        return requireDependency(
          dependencies,
          "generateMainTableFromStageContext",
          "缺少主表生成器，无法生成主表"
        )(ctx, flowSnapshot, {
          sourceStageCode: ctx.sourceStageCode || ctx.stage,
          sourceDetail: ctx.sourceDetail,
          saveMode: ctx.saveMode || "ARCHIVED",
          submitRemark: ctx.submitRemark,
        });
      } catch (error) {
        return {
          ok: false,
          message: safeText(error && error.message, "生成主表失败"),
        };
      }
    },
  });
}

export async function submitS1StageFinalEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return submitS1StageFinalPayload(ctx, flowSnapshot, dependencies);
    },
  });
}

export async function submitS2StageFinalEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return submitS2StageFinalPayload(ctx, flowSnapshot, dependencies);
    },
  });
}

export async function submitS3StageFinalEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params: {
      ...params,
      submitIntent: "stage_final",
    },
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return submitS3StageFinalPayload(ctx, flowSnapshot, dependencies);
    },
  });
}

export async function submitS3OwnerConfirmationEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params: {
      ...params,
      submitIntent: "owner",
      visibleSubjectScopeProvided: true,
    },
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return submitS3StageFinalPayload(ctx, flowSnapshot, dependencies);
    },
  });
}
