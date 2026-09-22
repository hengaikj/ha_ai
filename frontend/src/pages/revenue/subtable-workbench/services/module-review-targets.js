import { isReviewableAuditValueSource } from "../domain-config";
import { isSavableMatrixRow } from "../matrix-utils";
import { getAuditContextCache } from "./audit-context-cache";
import { collectRowTargetIds, mergeTargetIds } from "./project-cost-data-item";
import {
  normalizeTargetRecordIds,
  normalizeTargetSubmitIds,
} from "./record-utils";
import { safeText } from "./workbench-utils";

export function collectModuleTargetIds(ctx = {}, identity = {}) {
  const directTargets = {
    targetRecordIds: normalizeTargetRecordIds(ctx),
    targetSubmitIds: normalizeTargetSubmitIds(ctx),
  };
  const cache = getAuditContextCache(ctx);
  const scopedRowIdMap = {};
  (Array.isArray(ctx.rowIds) ? ctx.rowIds : [])
    .map((item) => safeText(item))
    .filter(Boolean)
    .forEach((rowId) => {
      scopedRowIdMap[rowId] = true;
    });
  const hasScopedRows = Object.keys(scopedRowIdMap).length > 0;
  const result = {
    targetRecordIds: directTargets.targetRecordIds.slice(),
    targetSubmitIds: directTargets.targetSubmitIds.slice(),
  };
  Object.keys(cache.rowById || {}).forEach((rowId) => {
    if (hasScopedRows && !scopedRowIdMap[rowId]) return;
    const row = cache.rowById[rowId];
    if (!row) return;
    if (!isSavableMatrixRow(row)) return;
    if (!isReviewableAuditValueSource(ctx.subjectDomain, row)) return;
    const rowRootSubjectId = safeText(row.rootSubjectId || row.__moduleRootId);
    const rowModuleName = safeText(row.subtable || row.moduleName || row.rootSubjectName);
    if (identity.rootSubjectId && rowRootSubjectId) {
      if (rowRootSubjectId !== identity.rootSubjectId) return;
    } else if (!rowModuleName || !identity.moduleName || rowModuleName !== identity.moduleName) {
      return;
    }
    mergeTargetIds(result, collectRowTargetIds(row));
  });
  return result;
}
