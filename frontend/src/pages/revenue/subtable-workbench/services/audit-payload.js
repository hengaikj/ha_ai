import {
  AUDIT_ACCESS,
  AUDIT_DOMAIN,
  AUDIT_ROW_SCOPE,
  isReviewableAuditValueSource,
  resolveRevenueAuditAccess,
} from "../domain-config";
import { isSavableMatrixRow } from "../matrix-utils";
import { isMainPreviewRow } from "./main-table-preview";
import {
  canReadRevenueSubject,
  canWriteRevenueSubject,
  hasExplicitRevenueSubjectPermission,
  isAuthorizedRevenueSubject,
} from "./subject-tree";
import {
  hasFullSubjectScope,
  resolveOperationPermissionKey,
} from "./workbench-permissions";
import { safeText } from "./workbench-utils";

export function buildAuditDetailPayloadFromFillPayload(ctx, fillPayload = {}) {
  const fillDetail =
    fillPayload && fillPayload.detail && typeof fillPayload.detail === "object"
      ? fillPayload.detail
      : {};
  const rows = Array.isArray(fillDetail.rows) ? fillDetail.rows : [];
  const stageCode = safeText(
    (fillPayload && fillPayload.project && fillPayload.project.audit && fillPayload.project.audit.stageCode) ||
      ctx.stage,
    "S1"
  ).toUpperCase();
  const accessPolicy = resolveRevenueAuditAccess({
    permissionKey: resolveOperationPermissionKey(ctx, ""),
    stageCode,
    domain: ctx.subjectDomain,
  });
  const subjectApiMode = safeText(ctx.subjectApiMode).toLowerCase();
  const responsibleScope = accessPolicy.rowScope === AUDIT_ROW_SCOPE.RESPONSIBLE_SUBJECTS;
  const readonlyAuthorizedScope = ctx.readonlyAuthorizedScope === true;
  const adminScope = hasFullSubjectScope(ctx);
  const fullReadonlySubjectView =
    safeText(ctx.subjectDomain).toLowerCase() === AUDIT_DOMAIN.SUBTABLE &&
    subjectApiMode === "all" &&
    responsibleScope;
  const editableRows = !readonlyAuthorizedScope && accessPolicy.access === AUDIT_ACCESS.AUDIT
    ? rows.filter((row) => {
        if (!isSavableMatrixRow(row)) return false;
        if (safeText(ctx.subjectDomain).toLowerCase() === "main" && !isMainPreviewRow(row)) return false;
        if (!isReviewableAuditValueSource(ctx.subjectDomain, row, { rows })) return false;
        if (responsibleScope && hasExplicitRevenueSubjectPermission(row) && !canWriteRevenueSubject(row)) {
          return false;
        }
        return true;
      })
    : [];
  const scopedRows = (() => {
    if (readonlyAuthorizedScope) {
      if (adminScope) return rows;
      return rows.filter((row) => isAuthorizedRevenueSubject(row));
    }
    if (accessPolicy.rowScope === AUDIT_ROW_SCOPE.ALL || fullReadonlySubjectView) return rows;
    if (responsibleScope) return rows.filter((row) =>
      !hasExplicitRevenueSubjectPermission(row) || canReadRevenueSubject(row)
    );
    return [];
  })();

  return {
    project: fillPayload.project || {},
    detail: {
      stageCode,
      stage: stageCode,
      reviewer: safeText(ctx.userId),
      rows,
      parentSubjectDisplay: fillDetail.parentSubjectDisplay || {},
      valueSourceNodes: Array.isArray(fillDetail.valueSourceNodes) ? fillDetail.valueSourceNodes : [],
      selectedSourceStage: safeText(fillDetail.selectedSourceStage),
      mainPreviewSourceMode: safeText(fillDetail.mainPreviewSourceMode),
      mainPreviewSourceStage: safeText(fillDetail.mainPreviewSourceStage),
      mainSnapshotSourceStage: safeText(fillDetail.mainSnapshotSourceStage),
      readonlySubtableSourceStage: safeText(fillDetail.readonlySubtableSourceStage),
      readonlySubtableReferenceMerged: fillDetail.readonlySubtableReferenceMerged === true,
      calculatedMainPreview: fillDetail.calculatedMainPreview === true,
      timeline: [],
    },
    mineDetail: {
      rows: scopedRows,
      editableRows,
    },
    fillDetail: {
      dimensions:
        fillDetail.dimensions && typeof fillDetail.dimensions === "object"
          ? fillDetail.dimensions
          : { years: [], trims: [] },
      trimOptions: Array.isArray(fillDetail.trimOptions) ? fillDetail.trimOptions : [],
      yearTrimConfig:
        fillDetail.yearTrimConfig && typeof fillDetail.yearTrimConfig === "object"
          ? fillDetail.yearTrimConfig
          : {},
      parentSubjectDisplay: fillDetail.parentSubjectDisplay || {},
    },
    permissions: fillPayload.permissions || {},
    subjectTreePayload: fillPayload.subjectTreePayload,
  };
}
