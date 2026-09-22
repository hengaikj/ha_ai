import {
  normalizeAuditDetailResult,
} from "./payload-normalizer";
import {
  ensureProjectCostFlow,
} from "./flow-context";
import {
  normalizeWorkbenchParams,
} from "./workbench-utils";
import {
  loadFlowOpinionTimeline,
} from "./audit-record-queries";
import {
  buildFlowOpinionCards,
} from "./review-metadata";
import {
  buildAuditWorkbenchShellPayload,
  fetchAuditWorkbenchModulePayload,
  listSubtableAuditAuxiliaryStatePayload,
  listSubtableAuditCellDraftsPayload,
  listSubtableAuditCellHistoriesPayload,
  listSubtableAuditModuleOpinionsPayload,
  listSubtableAuditModuleReviewStatePayload,
  listSubtableAuditModuleSubmitTimelinePayload,
  listSubtableAuditModuleSubmitsPayload,
  saveSubtableAuditCellDraftPayload,
  saveSubtableAuditModuleOpinionPayload,
  submitSubtableAuditModulePayload,
} from "./audit-workbench.service";
import {
  submitSubtableAuditStagePayload,
} from "./stage-final.service";

async function invokeWorkbenchOperation(options = {}) {
  const { params = {}, realHandler } = options;
  const ctx = normalizeWorkbenchParams(params);
  return realHandler(ctx);
}

export async function fetchRevenueAuditShellEntry(params = {}, dependencies = {}) {
  const payload = await invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return buildAuditWorkbenchShellPayload(ctx, flowSnapshot, {
        selectedSourceStage: ctx.selectedSourceStage,
        decisionApprovalMode: ctx.decisionApprovalMode === true,
      }, dependencies);
    },
  });
  return normalizeAuditDetailResult(payload);
}

export async function fetchRevenueAuditModuleRecordsEntry(params = {}, dependencies = {}) {
  const payload = await invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return fetchAuditWorkbenchModulePayload(ctx, flowSnapshot, {
        selectedSourceStage: ctx.selectedSourceStage,
        decisionApprovalMode: ctx.decisionApprovalMode === true,
        recordStatus: ctx.recordStatus,
        deferMainPreview: ctx.deferMainPreview === true,
      }, dependencies);
    },
  });
  return normalizeAuditDetailResult(payload);
}

export async function listSubtableAuditCellDrafts(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return listSubtableAuditCellDraftsPayload(ctx, flowSnapshot);
    },
  });
}

export async function listSubtableAuditAuxiliaryState(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return listSubtableAuditAuxiliaryStatePayload(ctx, flowSnapshot);
    },
  });
}

export async function listSubtableAuditCellHistories(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return listSubtableAuditCellHistoriesPayload(ctx, flowSnapshot);
    },
  });
}

export async function saveSubtableAuditCellDraft(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return saveSubtableAuditCellDraftPayload(ctx, flowSnapshot);
    },
  });
}

export async function listSubtableAuditModuleOpinions(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return listSubtableAuditModuleOpinionsPayload(ctx, flowSnapshot);
    },
  });
}

export async function listSubtableAuditModuleReviewState(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return listSubtableAuditModuleReviewStatePayload(ctx, flowSnapshot);
    },
  });
}

export async function saveSubtableAuditModuleOpinion(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return saveSubtableAuditModuleOpinionPayload(ctx, flowSnapshot);
    },
  });
}

export async function listSubtableAuditModuleSubmits(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return listSubtableAuditModuleSubmitsPayload(ctx, flowSnapshot);
    },
  });
}

export async function submitSubtableAuditModule(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return submitSubtableAuditModulePayload(ctx, flowSnapshot);
    },
  });
}

export async function clearSubtableAuditModuleSubmit() {
  return {
    ok: true,
  };
}

// 全流程前序节点意见(填报/审核/主表审核),供任意节点统一展示整表级意见时间线
export async function loadFlowOpinionTimelineEntry(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      const timeline = await loadFlowOpinionTimeline(ctx, flowSnapshot, {
        uptoStage: ctx.uptoStage || ctx.stage,
        includeCurrent: ctx.includeCurrentStageOpinion !== false,
      });
      return {
        ...timeline,
        cards: buildFlowOpinionCards(timeline.items),
      };
    },
  });
}

export async function listSubtableAuditModuleSubmitTimeline(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return listSubtableAuditModuleSubmitTimelinePayload(ctx, flowSnapshot);
    },
  });
}

export async function submitSubtableAuditStageEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return submitSubtableAuditStagePayload(ctx, flowSnapshot, dependencies);
    },
  });
}
