import {
  isReviewableAuditValueSource,
} from "../domain-config";
import {
  applyRevenueFormulasToDetail,
} from "../formula-engine";
import s1WorkflowGuards from "../s1-workflow-guards";
import {
  buildProjectCostDataItemsFromMatrix,
} from "./detail-data-items";
import {
  applyAffectedRecordsMetaToDetail,
} from "./detail-draft";
import {
  cloneDetailForFormula,
  resolveNeededSalesVolumeFormulaSourceDetail,
} from "./formula-source";
import {
  filterDataItemsByVisibleSubjectScope,
} from "./project-cost-record-query";
import {
  saveProjectCostSubmitWithDraftRetry,
} from "./project-cost-submit";
import {
  safeText,
  unwrapBizPayload,
} from "./workbench-utils";

const { collectAffectedRecordIds } = s1WorkflowGuards;

export async function saveDetailSnapshot(ctx, flowSnapshot, options = {}) {
  const detail = cloneDetailForFormula(ctx.detail);
  if (!Array.isArray(detail.rows) || !detail.rows.length) return { savedCount: 0 };
  const sourceDetail = await resolveNeededSalesVolumeFormulaSourceDetail(ctx, detail);
  applyRevenueFormulasToDetail(detail, {
    sourceDetails: sourceDetail ? [sourceDetail] : [],
  });
  const dataItems = buildProjectCostDataItemsFromMatrix(ctx, detail, {
    rowFilter: (row) => isReviewableAuditValueSource("subtable", row),
    respectInputScope: true,
  });
  const scopedDataItems = filterDataItemsByVisibleSubjectScope(ctx, dataItems);
  if (!scopedDataItems.length) {
    return { savedCount: 0, skippedCount: dataItems.length };
  }
  const payload = await saveProjectCostSubmitWithDraftRetry(ctx, flowSnapshot, {
    flowId: flowSnapshot.flowId,
    saveMode: safeText(options.saveMode, "DRAFT"),
    submitRemark: safeText(options.submitRemark, "FRONTEND_FORMULA_SNAPSHOT"),
    dataItems: scopedDataItems,
  });
  const data = unwrapBizPayload(payload) || {};
  const affectedRecords = Array.isArray(data.affectedRecords) ? data.affectedRecords : [];
  if (ctx.detail && affectedRecords.length) {
    applyAffectedRecordsMetaToDetail(ctx, ctx.detail, affectedRecords);
  }
  return {
    savedCount: scopedDataItems.length,
    skippedCount: dataItems.length - scopedDataItems.length,
    submitId: data.submitId,
    batchNo: data.batchNo,
    affectedRecordIds: collectAffectedRecordIds(data),
    affectedRecords,
  };
}
