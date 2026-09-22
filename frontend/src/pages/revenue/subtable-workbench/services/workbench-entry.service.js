import {
  clearAuditContextCache,
} from "./audit-context-cache";
import {
  fetchSubtableAuditDetailEntry,
} from "./audit-detail-entry.service";
import {
  fetchRevenueAuditModuleRecordsEntry,
  fetchRevenueAuditShellEntry,
  submitSubtableAuditStageEntry,
} from "./audit-workbench-entry.service";
import {
  submitSubtableFillSecondaryConfirmEntry,
} from "./fill-workbench.service";
import {
  clearProjectCostFlowCache,
} from "./flow-context";
import {
  buildMainTablePayloadForAuditDetailEntry,
  buildMainTableSnapshotPayloadFromStageContextEntry,
  buildS2SourceDetailForMainEntry,
  enrichSubtableAuditPayloadWithLoadedMainPreviewEntry,
  enrichSubtableAuditPayloadWithMainPreviewEntry,
  fetchMainTableDataCheckHistoryValveSourceEntry,
  fetchMainTableDataCheckOtherProjectSourceEntry,
  fetchMainTableDataCheckSourcesEntry,
  fetchMainTableDecisionApprovalDetailEntry,
  fetchMainTableVersionSelectionDetailEntry,
  generateMainTableFromStageContextEntry,
  recalculateMainTableAuditEntry,
  refreshSubtableMainPreviewEntry,
  submitMainTableAuditFinalEntry,
  submitMainTableVersionSelectionFinalEntry,
  submitS5DecisionApprovalEntry,
} from "./main-table-entry.service";
import {
  clearProjectContextCache,
} from "./project-context";
import {
  buildStageCompletionSummaryEntry,
  generateMainTableFromStageEntry,
  submitS1StageFinalEntry,
  submitS2StageFinalEntry,
  submitS3OwnerConfirmationEntry,
  submitS3StageFinalEntry,
  submitS7StartMeetingEntry,
} from "./stage-final-entry.service";
import {
  buildStageCompletionSummaryContextPayload,
  executeStageSubmitFlowPayload,
} from "./stage-workflow.service";

function mainTableHelperDependencies() {
  return {
    fetchSubtableAuditDetail,
  };
}

function stageWorkflowDependencies() {
  return {
    buildS2SourceDetailForMain,
    buildMainTablePayloadForAuditDetail,
    buildMainTableSnapshotPayloadFromStageContext,
  };
}

async function enrichSubtableAuditPayloadWithMainPreview(ctx, flowSnapshot, auditPayload = {}) {
  return enrichSubtableAuditPayloadWithMainPreviewEntry(
    ctx,
    flowSnapshot,
    auditPayload,
    mainTableHelperDependencies()
  );
}

async function enrichSubtableAuditPayloadWithLoadedMainPreview(
  ctx,
  flowSnapshot,
  auditPayload = {},
  options = {}
) {
  return enrichSubtableAuditPayloadWithLoadedMainPreviewEntry(
    ctx,
    flowSnapshot,
    auditPayload,
    options,
    mainTableHelperDependencies()
  );
}

async function buildS2SourceDetailForMain(ctx, flowSnapshot, options = {}) {
  return buildS2SourceDetailForMainEntry(
    ctx,
    flowSnapshot,
    options,
    mainTableHelperDependencies()
  );
}

async function buildStageCompletionSummaryContext(ctx, flowSnapshot) {
  return buildStageCompletionSummaryContextPayload(
    ctx,
    flowSnapshot,
    stageWorkflowDependencies()
  );
}

async function buildMainTablePayloadForAuditDetail(ctx, flowSnapshot) {
  return buildMainTablePayloadForAuditDetailEntry(
    ctx,
    flowSnapshot,
    mainTableHelperDependencies()
  );
}

async function buildMainTableSnapshotPayloadFromStageContext(ctx, flowSnapshot, options = {}) {
  return buildMainTableSnapshotPayloadFromStageContextEntry(ctx, flowSnapshot, options);
}

async function generateMainTableFromStageContext(ctx, flowSnapshot, options = {}) {
  return generateMainTableFromStageContextEntry(
    ctx,
    flowSnapshot,
    options,
    mainTableHelperDependencies()
  );
}

async function executeStageSubmitFlow(ctx, flowSnapshot, nextStage, actionRemark) {
  return executeStageSubmitFlowPayload(
    ctx,
    flowSnapshot,
    nextStage,
    actionRemark,
    stageWorkflowDependencies()
  );
}

export async function submitSubtableFillSecondaryConfirm(params = {}) {
  return submitSubtableFillSecondaryConfirmEntry(params, {
    executeStageSubmitFlow,
  });
}

export async function fetchSubtableAuditDetail(params = {}) {
  return fetchSubtableAuditDetailEntry(params, {
    buildMainTablePayloadForAuditDetail,
    enrichSubtableAuditPayloadWithMainPreview,
  });
}

export async function fetchMainTableVersionSelectionDetail(params = {}) {
  return fetchMainTableVersionSelectionDetailEntry(params);
}

export async function fetchMainTableDataCheckSources(params = {}) {
  return fetchMainTableDataCheckSourcesEntry(params, {
    fetchSubtableAuditDetail,
  });
}

export async function fetchMainTableDataCheckHistoryValveSource(params = {}) {
  return fetchMainTableDataCheckHistoryValveSourceEntry(params, {
    fetchSubtableAuditDetail,
  });
}

export async function fetchMainTableDataCheckOtherProjectSource(params = {}) {
  return fetchMainTableDataCheckOtherProjectSourceEntry(params, {
    fetchSubtableAuditDetail,
  });
}

export async function fetchMainTableDecisionApprovalDetail(params = {}) {
  return fetchMainTableDecisionApprovalDetailEntry(params);
}

export async function fetchRevenueAuditShell(params = {}) {
  return fetchRevenueAuditShellEntry(params, {
    enrichSubtableAuditPayloadWithLoadedMainPreview,
  });
}

export async function fetchRevenueAuditModuleRecords(params = {}) {
  return fetchRevenueAuditModuleRecordsEntry(params, {
    enrichSubtableAuditPayloadWithLoadedMainPreview,
  });
}

export async function refreshSubtableMainPreview(params = {}) {
  return refreshSubtableMainPreviewEntry(params, {
    fetchSubtableAuditDetail,
  });
}

export async function submitSubtableAuditStage(params = {}) {
  return submitSubtableAuditStageEntry(params, {
    executeStageSubmitFlow,
  });
}

export async function submitMainTableAuditFinal(params = {}) {
  return submitMainTableAuditFinalEntry(params, {
    executeStageSubmitFlow,
  });
}

export async function submitMainTableVersionSelectionFinal(params = {}) {
  return submitMainTableVersionSelectionFinalEntry(params);
}

export async function submitS5DecisionApproval(params = {}) {
  return submitS5DecisionApprovalEntry(params, {
    executeStageSubmitFlow,
  });
}

export async function submitS7StartMeeting(params = {}) {
  return submitS7StartMeetingEntry(params, {
    executeStageSubmitFlow,
  });
}

export async function buildStageCompletionSummary(params = {}) {
  return buildStageCompletionSummaryEntry(params, {
    buildStageCompletionSummaryContext,
  });
}

export async function generateMainTableFromStage(params = {}) {
  return generateMainTableFromStageEntry(params, {
    generateMainTableFromStageContext,
  });
}

export async function submitS1StageFinal(params = {}) {
  return submitS1StageFinalEntry(params, {
    executeStageSubmitFlow,
    generateMainTableFromStageContext,
  });
}

export async function submitS2StageFinal(params = {}) {
  return submitS2StageFinalEntry(params, {
    buildS2SourceDetailForMain,
    executeStageSubmitFlow,
    generateMainTableFromStageContext,
  });
}

export async function submitS3StageFinal(params = {}) {
  return submitS3StageFinalEntry(params, {
    executeStageSubmitFlow,
    generateMainTableFromStageContext,
  });
}

export async function submitS3OwnerConfirmation(params = {}) {
  return submitS3OwnerConfirmationEntry(params, {
    executeStageSubmitFlow,
    generateMainTableFromStageContext,
  });
}

export function recalculateMainTableAudit(params = {}) {
  return recalculateMainTableAuditEntry(params);
}

export function resetSubtableWorkbenchState() {
  clearProjectCostFlowCache();
  clearAuditContextCache();
  clearProjectContextCache();
  return {
    ok: true,
  };
}
