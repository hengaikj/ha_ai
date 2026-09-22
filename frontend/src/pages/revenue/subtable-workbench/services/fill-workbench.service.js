import {
  normalizeStageCode,
} from "../domain-config";
import {
  fetchSalesVolumeFormulaSourcePayload,
  needsSubtableFormulaSource,
  resolveNeededSalesVolumeFormulaSourceDetail,
} from "./formula-source";
import {
  fetchS3ConfirmationModulePayload,
  fetchS3ConfirmationPayload,
  fetchS3ConfirmationShellPayload,
} from "./s3-confirmation";
import {
  buildS3OwnerSubmitContext,
} from "./stage-completion-summary";
import {
  resolveSubmittedValueSourceNodes,
} from "./stage-labels";
import {
  buildSubtableFillPayloadFromRecords,
} from "./fill-payload";
import {
  applySubtableHistoryImportPayload,
  cancelS1SubtableSubmitPayload,
  fetchRealSubtableFillPayload,
  fetchRealSubtableFillShellPayload,
  listSubtableFillCellOpinionsPayload,
  previewSubtableHistoryImportPayload,
  rejectS1SubtableSubmitPayload,
  saveS3ConfirmationCellPayload,
  saveSubtableFillCellOpinionPayload,
  saveSubtableFillCellPayload,
  saveSubtableFillCellsPayload,
  saveSubtableFillDraftPayload,
  listSubtableSubjectNotesPayload,
  saveSubtableSubjectNotePayload,
  submitSubtableFillSecondaryConfirmPayload,
} from "./fill.service";
import {
  ensureProjectCostFlow,
} from "./flow-context";
import {
  normalizeFillDetailResult,
} from "./payload-normalizer";
import {
  requestProjectPatternList,
} from "./project-context";
import {
  queryProjectCostRecordsForNodes,
} from "./project-cost-record-query";
import {
  filterRecordsBySubjectIds,
} from "./record-utils";
import {
  getSubjectNodes,
} from "./subject-tree";
import {
  requestStrictPermissionTree,
  requestSubjectTreePreferPermission,
} from "./subject-tree-request";
import {
  shouldScopeSubtableFillToOwner,
} from "./workbench-permissions";
import {
  buildRevenueTraceLabel,
  normalizeSubjectIdFilterList,
  normalizeWorkbenchParams,
  safeText,
} from "./workbench-utils";

async function invokeWorkbenchOperation(options = {}) {
  const { params = {}, realHandler } = options;
  const ctx = normalizeWorkbenchParams(params);
  return realHandler(ctx);
}

export async function getUserExpenseSubjectPermissionTree(params = {}) {
  const ctx = normalizeWorkbenchParams(params);
  return requestStrictPermissionTree(ctx);
}

export async function getProjectCostWritableSubjects(params = {}) {
  const ctx = normalizeWorkbenchParams(params);
  return requestSubjectTreePreferPermission(ctx);
}

export function shouldLoadSubtableFormulaSource(detail = {}) {
  return needsSubtableFormulaSource(detail);
}

export async function resolveSubtableFormulaSourceDetail(params = {}, detail = {}) {
  return invokeWorkbenchOperation({
    params: {
      ...params,
      revenueTraceSource: safeText(params.revenueTraceSource, "子表公式来源"),
      subjectDomain: "subtable",
      subjectApiMode: "all",
    },
    realHandler: async (ctx) => resolveNeededSalesVolumeFormulaSourceDetail(ctx, detail),
  });
}

export async function fetchSubtableFillShell(params = {}) {
  const payload = await invokeWorkbenchOperation({
    params: {
      ...params,
      revenueTraceSource: safeText(params.revenueTraceSource, "子表填报页面壳"),
    },
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S1");
      if (currentStage === "S3") {
        const s3Ctx = buildS3OwnerSubmitContext(ctx);
        const ownerScoped = shouldScopeSubtableFillToOwner(s3Ctx, currentStage);
        return fetchS3ConfirmationShellPayload(s3Ctx, flowSnapshot, { ownerScoped });
      }
      const ownerScoped = shouldScopeSubtableFillToOwner(ctx, currentStage);
      return fetchRealSubtableFillShellPayload(ctx, { ownerScoped });
    },
  });
  return normalizeFillDetailResult(payload);
}

export async function fetchSubtableS3ModuleRecords(params = {}) {
  const payload = await invokeWorkbenchOperation({
    params: {
      ...params,
      revenueTraceSource: safeText(params.revenueTraceSource, "子表填报S3模块记录"),
    },
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return fetchS3ConfirmationModulePayload(ctx, flowSnapshot, {
        ownerScoped: ctx.ownerScoped !== false,
      });
    },
  });
  return normalizeFillDetailResult(payload);
}

export async function fetchSubtableModuleRecords(params = {}) {
  const payload = await invokeWorkbenchOperation({
    params: {
      ...params,
      revenueTraceSource: safeText(params.revenueTraceSource, "子表填报模块记录"),
    },
    realHandler: async (ctx) => {
      const subjectIds = normalizeSubjectIdFilterList(ctx.subjectIds);
      const moduleName = safeText(ctx.moduleName || ctx.rootSubjectName, "未命名子表");
      const moduleKey = safeText(ctx.moduleKey || ctx.key || moduleName);
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S1");
      const ownerScoped =
        typeof ctx.ownerScoped === "boolean"
          ? ctx.ownerScoped
          : shouldScopeSubtableFillToOwner(ctx, currentStage);
      const valueSourceNodes = resolveSubmittedValueSourceNodes(ctx, flowSnapshot);
      const records = subjectIds.length
        ? await queryProjectCostRecordsForNodes(ctx, flowSnapshot, ownerScoped, valueSourceNodes, {
            subjectIds,
            traceLabel: buildRevenueTraceLabel(
              ctx,
              `记录: 子表 ${moduleName} records/query subjectIds=${subjectIds.join(",") || "-"}`
            ),
          })
        : [];
      const scopedRecords = filterRecordsBySubjectIds(records, subjectIds);
      const loadedRecords = Array.isArray(ctx.loadedRecords) ? ctx.loadedRecords : [];
      const allRecords = loadedRecords.concat(scopedRecords);
      let subjectTreePayload = ctx.subjectTreePayload;
      if (!getSubjectNodes(subjectTreePayload).length) {
        subjectTreePayload = await requestSubjectTreePreferPermission(ctx);
      }
      const patternList = Array.isArray(ctx.patternList)
        ? ctx.patternList
        : await requestProjectPatternList(ctx);
      const fillPayload = buildSubtableFillPayloadFromRecords(
        ctx,
        subjectTreePayload,
        flowSnapshot,
        patternList,
        allRecords,
        { ownerScoped }
      );
      return {
        ...fillPayload,
        moduleKey,
        moduleName,
        subjectIds,
        records: scopedRecords,
        loadedRecords: allRecords,
      };
    },
  });
  return normalizeFillDetailResult(payload);
}

export async function fetchSubtableFillDetail(params = {}) {
  const payload = await invokeWorkbenchOperation({
    params: {
      ...params,
      revenueTraceSource: safeText(params.revenueTraceSource, "子表填报主详情"),
    },
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S1");
      if (currentStage === "S3") {
        const s3Ctx = buildS3OwnerSubmitContext(ctx);
        const ownerScoped = shouldScopeSubtableFillToOwner(s3Ctx, currentStage);
        return fetchS3ConfirmationPayload(s3Ctx, flowSnapshot, { ownerScoped });
      }
      const ownerScoped = shouldScopeSubtableFillToOwner(ctx, currentStage);
      return fetchRealSubtableFillPayload(ctx, { ownerScoped });
    },
  });
  return normalizeFillDetailResult(payload);
}

export async function fetchSubtableFormulaSourceDetail(params = {}) {
  const payload = await invokeWorkbenchOperation({
    params: {
      ...params,
      revenueTraceSource: safeText(params.revenueTraceSource, "子表填报公式来源"),
      subjectDomain: "subtable",
      subjectApiMode: "all",
    },
    realHandler: async (ctx) =>
      fetchSalesVolumeFormulaSourcePayload(ctx),
  });
  return normalizeFillDetailResult(payload);
}

export async function fetchS3ConfirmationDetail(params = {}) {
  const payload = await invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      const s3Ctx = buildS3OwnerSubmitContext(ctx);
      const ownerScoped = shouldScopeSubtableFillToOwner(s3Ctx, "S3");
      if (!flowSnapshot || flowSnapshot.flowId == null) {
        return fetchS3ConfirmationPayload(s3Ctx, flowSnapshot, {
          ownerScoped,
        });
      }
      return fetchS3ConfirmationPayload(s3Ctx, flowSnapshot, {
        ownerScoped,
      });
    },
  });
  return normalizeFillDetailResult(payload);
}

export async function saveSubtableFillCell(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: saveSubtableFillCellPayload,
  });
}

export async function saveSubtableFillCells(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: saveSubtableFillCellsPayload,
  });
}

export async function saveS3ConfirmationCell(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: saveS3ConfirmationCellPayload,
  });
}

export async function listSubtableFillCellOpinions(params = {}) {
  return invokeWorkbenchOperation({
    params: {
      ...params,
      revenueTraceSource: safeText(params.revenueTraceSource, "子表填报单元格意见"),
    },
    realHandler: listSubtableFillCellOpinionsPayload,
  });
}

export async function saveSubtableFillCellOpinion(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: saveSubtableFillCellOpinionPayload,
  });
}

export async function listSubtableSubjectNotes(params = {}) {
  return invokeWorkbenchOperation({
    params: {
      ...params,
      revenueTraceSource: safeText(params.revenueTraceSource, "子表填报科目说明"),
    },
    realHandler: listSubtableSubjectNotesPayload,
  });
}

export async function saveSubtableSubjectNote(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: saveSubtableSubjectNotePayload,
  });
}

export async function saveSubtableFillDraft(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: saveSubtableFillDraftPayload,
  });
}

export async function previewSubtableHistoryImport(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: previewSubtableHistoryImportPayload,
  });
}

export async function applySubtableHistoryImport(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: applySubtableHistoryImportPayload,
  });
}

export async function submitSubtableFillSecondaryConfirmEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      return submitSubtableFillSecondaryConfirmPayload(ctx, dependencies);
    },
  });
}

export async function cancelS1SubtableSubmit(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: cancelS1SubtableSubmitPayload,
  });
}

export async function rejectS1SubtableSubmit(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: rejectS1SubtableSubmitPayload,
  });
}
