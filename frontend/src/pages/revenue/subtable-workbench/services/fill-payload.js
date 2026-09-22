import { buildDetailRowsFromPermissionTree } from "./detail-builder";
import {
  capturePersistedComputedCellSnapshots,
  restorePersistedComputedFormulaOverrides,
} from "./detail-draft";
import { tryApplyRevenueFormulasToDetail } from "./detail-diagnostics";
import { buildTrimOptions } from "./project-context";
import { resolveSubmittedValueSourceNodes } from "./stage-labels";
import { buildSubtableModuleLoadPlan } from "./module-load-plan";
import { mergeParentSubjectDisplayMap } from "./payload-normalizer";
import { getSubjectNodes } from "./subject-tree";
import { resolveOperationPermissionKey } from "./workbench-permissions";
import {
  resolveProjectDisplayName,
  safeText,
  toMaybeLong,
} from "./workbench-utils";

export function buildSubtableFillPayloadFromRecords(
  ctx,
  subjectTreePayload,
  flowSnapshot,
  patternList,
  preferredRecords = [],
  options = {}
) {
  const records = Array.isArray(preferredRecords) ? preferredRecords : [];
  const valueSourceNodes = resolveSubmittedValueSourceNodes(ctx, flowSnapshot);
  const trimOptions = buildTrimOptions(patternList, records);
  const detailData = buildDetailRowsFromPermissionTree(
    getSubjectNodes(subjectTreePayload),
    records,
    trimOptions
  );
  if (ctx.subjectDomain !== "main") {
    const persistedSnapshots = capturePersistedComputedCellSnapshots(detailData);
    tryApplyRevenueFormulasToDetail(detailData);
    restorePersistedComputedFormulaOverrides(detailData, persistedSnapshots);
  }

  const currentStage = safeText((flowSnapshot && flowSnapshot.node) || ctx.stage, "S1").toUpperCase();
  return {
    project: {
      projectId: ctx.projectId || undefined,
      projectNo: ctx.projectCode,
      projectCode: ctx.projectCode,
      projectName: resolveProjectDisplayName(ctx),
      gate: ctx.valve,
      flowId: flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined,
      audit: {
        stageCode: currentStage,
        stage: currentStage,
      },
    },
    detail: {
      dimensions: detailData.dimensions,
      trimOptions: detailData.trimOptions,
      yearTrimConfig: detailData.yearTrimConfig,
      rows: detailData.rows,
      templateValidation: detailData.templateValidation,
      parentSubjectDisplay: mergeParentSubjectDisplayMap(),
      subtableProgress: [],
      lastSavedAt: "-",
      lastSavedBy: "-",
      flowId: flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined,
      flowNode: currentStage,
      valueSourceNodes,
    },
    permissions: {
      viewer: ctx.userId,
      permissionKey: resolveOperationPermissionKey(ctx, ""),
    },
    subjectTreePayload,
    moduleLoadPlan: buildSubtableModuleLoadPlan(subjectTreePayload),
    patternList: Array.isArray(patternList) ? patternList : [],
    moduleRecords: records,
    ownerScoped: options.ownerScoped,
  };
}

export function extractDetailRowSubjectIds(detail = {}) {
  return (Array.isArray(detail.rows) ? detail.rows : [])
    .map((row) => toMaybeLong(row && row.subjectId))
    .filter((item, index, list) => item != null && list.indexOf(item) === index);
}
