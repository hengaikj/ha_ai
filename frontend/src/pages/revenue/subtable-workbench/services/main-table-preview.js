import {
  REVENUE_INPUT_SCOPE,
  REVENUE_MODULE_CODE,
  isReviewableAuditValueSource,
  normalizeStageCode,
} from "../domain-config";
import { isSavableMatrixRow } from "../matrix-utils";
import { getDetailDimensions } from "./detail-matrix";
import { STAGE_FLOW_CODES } from "./stage-labels";
import { resolveOperationPermissionKey } from "./workbench-permissions";
import {
  resolveMatrixSubjectId,
  resolveProjectDisplayName,
  safeText,
} from "./workbench-utils";

export function normalizeMainPreviewPath(row = {}) {
  const path =
    row.fullNamePath ||
    row.subjectPath ||
    row.fullPath ||
    row.path ||
    [row.rootSubjectName, row.subtable, row.subject].filter(Boolean).join("/");
  if (Array.isArray(path)) return path.map((item) => safeText(item)).filter(Boolean).join("/");
  return safeText(path);
}

export function isMainPreviewRow(row = {}) {
  const moduleCode = safeText(row.moduleCode);
  if (moduleCode === REVENUE_MODULE_CODE.MAIN_PNL) return true;
  const moduleName = safeText(row.moduleName || row.subtable || row.rootSubjectName);
  if (moduleName === "主表") return true;
  const path = normalizeMainPreviewPath(row);
  return path === "主表" ||
    path.indexOf("主表/") === 0 ||
    path.indexOf("单车收益/") === 0 ||
    path.indexOf("项目利润/") === 0;
}

export function mergeReadonlySubtableRowsIntoMainAuditDetail(mainDetail = {}, sourceDetail = {}) {
  if (!mainDetail || typeof mainDetail !== "object") return mainDetail;
  const mainRows = (Array.isArray(mainDetail.rows) ? mainDetail.rows : []).filter(isMainPreviewRow);
  const sourceRows = (Array.isArray(sourceDetail.rows) ? sourceDetail.rows : [])
    .filter((row) => !isMainPreviewRow(row))
    .map((row) => ({
      ...row,
      mainReadonlyReference: true,
      readonlyInMainAudit: true,
    }));
  if (!mainRows.length || !sourceRows.length) return mainDetail;
  return {
    ...mainDetail,
    rows: mainRows.concat(sourceRows),
    readonlySubtableReferenceMerged: true,
  };
}

export function isMainPreviewModule(module = {}) {
  const moduleCode = safeText(module.moduleCode || module.moduleKey || module.key);
  if (moduleCode === REVENUE_MODULE_CODE.MAIN_PNL) return true;
  const moduleName = safeText(module.name || module.moduleName || module.rootSubjectName);
  if (moduleName === "主表") return true;
  const rows = []
    .concat(Array.isArray(module.rows) ? module.rows : [])
    .concat(Array.isArray(module.sourceRows) ? module.sourceRows : []);
  return rows.some((row) => isMainPreviewRow(row));
}

export function alignMainDetailDimensions(mainDetail = {}, sourceDetail = {}) {
  const sourceDimensions = getDetailDimensions(sourceDetail);
  if (sourceDimensions.years.length) {
    mainDetail.dimensions = {
      years: sourceDimensions.years.slice(),
      trims: sourceDimensions.trims.slice(),
    };
  }
  if (Array.isArray(sourceDetail.trimOptions) && sourceDetail.trimOptions.length) {
    mainDetail.trimOptions = sourceDetail.trimOptions.map((item) => ({ ...item }));
  }
  if (sourceDetail.yearTrimConfig && typeof sourceDetail.yearTrimConfig === "object") {
    mainDetail.yearTrimConfig = Object.keys(sourceDetail.yearTrimConfig).reduce((result, year) => {
      result[year] = Array.isArray(sourceDetail.yearTrimConfig[year])
        ? sourceDetail.yearTrimConfig[year].slice()
        : [];
      return result;
    }, {});
  }
  return mainDetail;
}

export function isSubtableMainSourceStage(stageCode = "") {
  return ["S1", "S2", "S3"].includes(normalizeStageCode(stageCode));
}

export function isCalculatedMainPreviewStage(stageCode = "") {
  return ["S1", "S2", "S3"].includes(normalizeStageCode(stageCode));
}

export function resolveMainPreviewSourceStage(ctx = {}, flowSnapshot = null, options = {}) {
  const explicitStage = safeText(options.sourceStageCode || ctx.selectedSourceStage || ctx.sourceStageCode);
  if (explicitStage) return normalizeStageCode(explicitStage);
  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S4");
  if (currentStage === "S4") return "S3";
  if (currentStage === "S5") return "S4";
  if (currentStage === "S6") return "S5";
  if (currentStage === "S7" || currentStage === "S8") return "S6";
  const index = STAGE_FLOW_CODES.indexOf(currentStage);
  if (index > 0) return STAGE_FLOW_CODES[index - 1];
  return currentStage;
}

export function resolveAuditHistoryNodes(ctx = {}, flowSnapshot = null) {
  const currentNode = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S1");
  const currentIndex = STAGE_FLOW_CODES.indexOf(currentNode);
  return currentIndex > 0
    ? STAGE_FLOW_CODES.slice(0, currentIndex)
    : [];
}

export function hasMainReviewableRows(detail = {}) {
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  return rows.some((row) =>
    isMainPreviewRow(row) &&
      isSavableMatrixRow(row) &&
      isReviewableAuditValueSource("main", row, { rows })
  );
}

function buildMainPreviewRowMap(rows = []) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!isMainPreviewRow(row)) return;
    const keys = [
      safeText(row.subjectId) ? `subject:${safeText(row.subjectId)}` : "",
      safeText(row.id) ? `id:${safeText(row.id)}` : "",
      normalizeMainPreviewPath(row) ? `path:${normalizeMainPreviewPath(row)}` : "",
    ].filter(Boolean);
    keys.forEach((key) => {
      if (!map[key]) map[key] = row;
    });
  });
  return map;
}

function findMainPreviewRowMatch(row = {}, map = {}) {
  const keys = [
    safeText(row.subjectId) ? `subject:${safeText(row.subjectId)}` : "",
    safeText(row.id) ? `id:${safeText(row.id)}` : "",
    normalizeMainPreviewPath(row) ? `path:${normalizeMainPreviewPath(row)}` : "",
  ].filter(Boolean);
  for (let index = 0; index < keys.length; index += 1) {
    if (map[keys[index]]) return map[keys[index]];
  }
  return null;
}

function decorateMainPreviewRowForSubtableAudit(row = {}) {
  return {
    ...row,
    readonly: true,
    savable: false,
    mainReviewable: false,
    reviewableInMain: false,
    mainPreviewReadonly: true,
    inputScope: REVENUE_INPUT_SCOPE.READONLY,
    valueSource: "linked",
    sourceType: "linked",
  };
}

export function buildReusableMainPreviewDetail(auditPayload = {}) {
  const auditDetail =
    auditPayload && auditPayload.detail && typeof auditPayload.detail === "object"
      ? auditPayload.detail
      : {};
  const fillDetail =
    auditPayload && auditPayload.fillDetail && typeof auditPayload.fillDetail === "object"
      ? auditPayload.fillDetail
      : {};
  const mainRows = (Array.isArray(auditDetail.rows) ? auditDetail.rows : [])
    .filter(isMainPreviewRow);
  if (!mainRows.length) return null;
  if (!mainRows.some(isSavableMatrixRow)) return null;

  return {
    ...auditDetail,
    dimensions:
      fillDetail.dimensions && typeof fillDetail.dimensions === "object"
        ? fillDetail.dimensions
        : (auditDetail.dimensions && typeof auditDetail.dimensions === "object"
          ? auditDetail.dimensions
          : { years: [], trims: [] }),
    trimOptions: Array.isArray(fillDetail.trimOptions)
      ? fillDetail.trimOptions
      : (Array.isArray(auditDetail.trimOptions) ? auditDetail.trimOptions : []),
    yearTrimConfig:
      fillDetail.yearTrimConfig && typeof fillDetail.yearTrimConfig === "object"
        ? fillDetail.yearTrimConfig
        : (auditDetail.yearTrimConfig && typeof auditDetail.yearTrimConfig === "object"
          ? auditDetail.yearTrimConfig
          : {}),
    parentSubjectDisplay: fillDetail.parentSubjectDisplay || auditDetail.parentSubjectDisplay || {},
    rows: mainRows,
  };
}

export function buildMainPayloadFromReusableDetail(ctx, flowSnapshot, detail = {}, sourceStageCode = "") {
  const normalizedSourceStage = normalizeStageCode(sourceStageCode || ctx.stage || "S1");
  const currentStage = safeText((flowSnapshot && flowSnapshot.node) || ctx.stage, "S2").toUpperCase();
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
      ...detail,
      valueSourceNodes: [normalizedSourceStage],
      selectedSourceStage: normalizedSourceStage,
    },
    permissions: {
      viewer: ctx.userId,
      permissionKey: resolveOperationPermissionKey(ctx, ""),
    },
  };
}

export function mergeCalculatedMainPreviewIntoAuditPayload(auditPayload = {}, mainPayload = {}) {
  const auditDetail =
    auditPayload && auditPayload.detail && typeof auditPayload.detail === "object"
      ? auditPayload.detail
      : {};
  const mainDetail =
    mainPayload && mainPayload.detail && typeof mainPayload.detail === "object"
      ? mainPayload.detail
      : {};
  const calculatedRows = (Array.isArray(mainDetail.rows) ? mainDetail.rows : [])
    .filter(isMainPreviewRow)
    .map(decorateMainPreviewRowForSubtableAudit);
  if (!calculatedRows.length) return auditPayload;

  const calculatedMap = buildMainPreviewRowMap(calculatedRows);
  let hasExistingMainRows = false;
  let replaced = false;
  const rows = (Array.isArray(auditDetail.rows) ? auditDetail.rows : []).map((row) => {
    if (!isMainPreviewRow(row)) return row;
    hasExistingMainRows = true;
    const match = findMainPreviewRowMatch(row, calculatedMap);
    if (!match) return decorateMainPreviewRowForSubtableAudit(row);
    replaced = true;
    return decorateMainPreviewRowForSubtableAudit({
      ...row,
      ...match,
      id: row.id || match.id,
      rowId: row.rowId || row.id || match.rowId,
      subjectId: resolveMatrixSubjectId(row) || resolveMatrixSubjectId(match),
      rootSubjectId: row.rootSubjectId || match.rootSubjectId,
      rootSubjectName: row.rootSubjectName || match.rootSubjectName,
      displayRootSubjectId: row.displayRootSubjectId || match.displayRootSubjectId,
      displayRootSortOrder: row.displayRootSortOrder || match.displayRootSortOrder,
    });
  });

  const nextRows = hasExistingMainRows
    ? rows
    : calculatedRows.concat(rows);

  return {
    ...auditPayload,
    detail: {
      ...auditDetail,
      rows: nextRows,
      calculatedMainPreview: true,
      mainPreviewSourceMode: "calculated",
      mainPreviewSourceStage: mainPayload.sourceStageCode,
      mainPreviewMerged: replaced || !hasExistingMainRows,
    },
  };
}
