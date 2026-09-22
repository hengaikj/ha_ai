import {
  resolveMatrixSubjectId,
  safeText,
} from "./workbench-utils";

const AUDIT_CONTEXT_CACHE = {};

function buildAuditCacheKey(ctx) {
  return [
    safeText(ctx.projectCode),
    safeText(ctx.valve),
    safeText(ctx.stage),
    safeText(ctx.subjectDomain),
    safeText(ctx.userId),
  ].join("__");
}

function addAuditCacheRowAlias(rowLookup = {}, row = {}, value) {
  const key = safeText(value);
  if (!key || rowLookup[key]) return;
  rowLookup[key] = row;
}

export function resolveAuditCacheRow(cache = {}, rowId = "") {
  const key = safeText(rowId);
  if (!key) return null;
  return (cache.rowById && cache.rowById[key]) ||
    (cache.rowLookup && cache.rowLookup[key]) ||
    (cache.rowBySubjectId && cache.rowBySubjectId[key]) ||
    null;
}

export function setAuditContextCache(ctx, payload) {
  const detail = payload && payload.detail && typeof payload.detail === "object" ? payload.detail : {};
  const fillDetail = payload && payload.fillDetail && typeof payload.fillDetail === "object" ? payload.fillDetail : {};
  const dimensions = fillDetail.dimensions && typeof fillDetail.dimensions === "object"
    ? fillDetail.dimensions
    : { years: [], trims: [] };
  const trimOptions = Array.isArray(fillDetail.trimOptions) ? fillDetail.trimOptions : [];
  const rows = Array.isArray(detail.rows) ? detail.rows : [];

  const rowById = {};
  const rowBySubjectId = {};
  const rowLookup = {};
  rows.forEach((row) => {
    const rowId = safeText(row && row.id);
    const subjectId = safeText(resolveMatrixSubjectId(row));
    if (rowId) rowById[rowId] = row;
    if (subjectId) rowBySubjectId[subjectId] = row;
    addAuditCacheRowAlias(rowLookup, row, row && row.id);
    addAuditCacheRowAlias(rowLookup, row, row && row.rowId);
    addAuditCacheRowAlias(rowLookup, row, row && row.subjectId);
    addAuditCacheRowAlias(rowLookup, row, row && row.templateSubjectId);
    addAuditCacheRowAlias(rowLookup, row, row && row.expenseSubjectId);
    addAuditCacheRowAlias(rowLookup, row, row && row.templateItem && row.templateItem.subjectId);
  });

  AUDIT_CONTEXT_CACHE[buildAuditCacheKey(ctx)] = {
    dimensions: {
      years: Array.isArray(dimensions.years) ? dimensions.years.slice() : [],
      trims: Array.isArray(dimensions.trims) ? dimensions.trims.slice() : [],
    },
    trimOptions: trimOptions.slice(),
    rowById,
    rowBySubjectId,
    rowLookup,
    valueSourceNodes: Array.isArray(detail.valueSourceNodes)
      ? detail.valueSourceNodes.map((item) => safeText(item)).filter(Boolean)
      : [],
    selectedSourceStage: safeText(detail.selectedSourceStage),
    mainPreviewSourceStage: safeText(detail.mainPreviewSourceStage),
    mainSnapshotSourceStage: safeText(detail.mainSnapshotSourceStage),
  };
}

export function getAuditContextCache(ctx) {
  return AUDIT_CONTEXT_CACHE[buildAuditCacheKey(ctx)] || {
    dimensions: { years: [], trims: [] },
    trimOptions: [],
    rowById: {},
    rowBySubjectId: {},
    rowLookup: {},
    valueSourceNodes: [],
    selectedSourceStage: "",
    mainPreviewSourceStage: "",
    mainSnapshotSourceStage: "",
  };
}

export function clearAuditContextCache() {
  Object.keys(AUDIT_CONTEXT_CACHE).forEach((key) => delete AUDIT_CONTEXT_CACHE[key]);
}
