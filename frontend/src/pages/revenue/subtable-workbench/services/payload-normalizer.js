import { REVENUE_PARENT_SUBJECT_DISPLAY_META } from "../domain-config";
import { normalizeTrimOptions } from "./detail-matrix";
import { safeText, unwrapBizPayload } from "./workbench-utils";

export const EMPTY_FILL_PAYLOAD = {
  project: {},
  detail: {
    dimensions: { years: [], trims: [] },
    trimOptions: [],
    yearTrimConfig: {},
    rows: [],
    templateValidation: { matched: [], unmatched: [] },
    parentSubjectDisplay: {},
    subtableProgress: [],
    lastSavedAt: "-",
    lastSavedBy: "-",
  },
  permissions: {},
};

export const EMPTY_AUDIT_PAYLOAD = {
  project: {},
  detail: {
    stageCode: "S1",
    stage: "S1",
    reviewer: "",
    rows: [],
    parentSubjectDisplay: {},
    timeline: [],
  },
  mineDetail: {
    rows: [],
  },
  fillDetail: {
    dimensions: {
      years: [],
      trims: [],
    },
    trimOptions: [],
    yearTrimConfig: {},
    parentSubjectDisplay: {},
  },
  permissions: {},
};

export function normalizeParentSubjectDisplayMap(map = {}) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  return Object.keys(map).reduce((result, key) => {
    const config = map[key];
    if (config && typeof config === "object" && !Array.isArray(config)) {
      result[key] = { ...config };
    }
    return result;
  }, {});
}

export function mergeParentSubjectDisplayMap(map = {}) {
  return {
    ...normalizeParentSubjectDisplayMap(REVENUE_PARENT_SUBJECT_DISPLAY_META),
    ...normalizeParentSubjectDisplayMap(map),
  };
}

export function normalizeYearTrimConfig(config, years = [], trimOptions = []) {
  const yearList = Array.isArray(years) ? years : [];
  const allTrimIds = trimOptions.map((item) => safeText(item.trimId)).filter(Boolean);
  const source =
    config && typeof config === "object" && !Array.isArray(config) ? config : {};
  const next = {};

  yearList.forEach((year) => {
    const yearKey = safeText(year);
    if (!yearKey) return;
    const fromApi = Array.isArray(source[yearKey]) ? source[yearKey] : [];
    const selected = fromApi
      .map((item) => safeText(item))
      .filter((trimId) => trimId && allTrimIds.includes(trimId));
    next[yearKey] = selected.length ? selected : allTrimIds.slice();
  });

  return next;
}

export function normalizeFillDetailResult(payload) {
  const unwrapped = unwrapBizPayload(payload);
  const source = unwrapped && typeof unwrapped === "object" ? unwrapped : {};
  const detail = source.detail && typeof source.detail === "object" ? source.detail : {};
  const dimensions =
    detail.dimensions && typeof detail.dimensions === "object"
      ? detail.dimensions
      : { years: [], trims: [] };
  const years = Array.isArray(dimensions.years) ? dimensions.years : [];
  const trims = Array.isArray(dimensions.trims) ? dimensions.trims : [];
  const trimOptions = normalizeTrimOptions(detail.trimOptions, trims);
  return {
    ...EMPTY_FILL_PAYLOAD,
    ...source,
    detail: {
      ...EMPTY_FILL_PAYLOAD.detail,
      ...detail,
      dimensions: {
        years,
        trims,
      },
      trimOptions,
      yearTrimConfig: normalizeYearTrimConfig(detail.yearTrimConfig, years, trimOptions),
      rows: Array.isArray(detail.rows) ? detail.rows : [],
      parentSubjectDisplay:
        mergeParentSubjectDisplayMap(detail.parentSubjectDisplay),
      subtableProgress: Array.isArray(detail.subtableProgress)
        ? detail.subtableProgress
        : [],
    },
  };
}

export function normalizeAuditDetailResult(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const detail = source.detail && typeof source.detail === "object" ? source.detail : {};
  const mineDetail =
    source.mineDetail && typeof source.mineDetail === "object"
      ? source.mineDetail
      : {};
  const fillDetail =
    source.fillDetail && typeof source.fillDetail === "object"
      ? source.fillDetail
      : {};
  const dimensions =
    fillDetail.dimensions && typeof fillDetail.dimensions === "object"
      ? fillDetail.dimensions
      : { years: [], trims: [] };

  return {
    ...EMPTY_AUDIT_PAYLOAD,
    ...source,
    detail: {
      ...EMPTY_AUDIT_PAYLOAD.detail,
      ...detail,
      rows: Array.isArray(detail.rows) ? detail.rows : [],
      parentSubjectDisplay: mergeParentSubjectDisplayMap(detail.parentSubjectDisplay),
      timeline: Array.isArray(detail.timeline) ? detail.timeline : [],
    },
    mineDetail: {
      ...EMPTY_AUDIT_PAYLOAD.mineDetail,
      ...mineDetail,
      rows: Array.isArray(mineDetail.rows) ? mineDetail.rows : [],
    },
    fillDetail: {
      ...EMPTY_AUDIT_PAYLOAD.fillDetail,
      ...fillDetail,
      dimensions: {
        years: Array.isArray(dimensions.years) ? dimensions.years : [],
        trims: Array.isArray(dimensions.trims) ? dimensions.trims : [],
      },
      trimOptions: Array.isArray(fillDetail.trimOptions) ? fillDetail.trimOptions : [],
      yearTrimConfig:
        fillDetail.yearTrimConfig && typeof fillDetail.yearTrimConfig === "object"
          ? fillDetail.yearTrimConfig
          : {},
      parentSubjectDisplay: mergeParentSubjectDisplayMap(fillDetail.parentSubjectDisplay),
    },
  };
}
