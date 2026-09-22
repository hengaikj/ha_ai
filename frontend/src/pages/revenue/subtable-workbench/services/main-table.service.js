import {
  saveProjectCostSubmit as saveProjectCostSubmitApi,
} from "@/api/system/expenses";
import {
  REVENUE_MODULE_CODE,
  normalizeStageCode,
} from "../domain-config";
import {
  REVENUE_FORMULA_CALCULATION_MODE,
  applyRevenueFormulasToDetail,
} from "../formula-engine";
import {
  buildAuditDetailPayloadFromFillPayload,
} from "./audit-payload";
import {
  setAuditContextCache,
} from "./audit-context-cache";
import {
  queryAuditRecordsRows,
  queryReviewSuggestionRows,
} from "./audit-record-queries";
import {
  buildProjectCostDataItemsFromMatrix,
} from "./detail-data-items";
import {
  applyDraftMapToDetail,
  applyMainAuditDraftMapToDetail,
} from "./detail-draft";
import {
  buildDetailRealColumns,
  readRowMatrixColumnValue,
} from "./detail-matrix";
import {
  buildDetailDebugSummary,
  buildMainSaveDiagnostics,
  buildRowsDebugSample,
  buildSafeMainFormulaDebugDiagnostics,
  revenueMainGenerateLog,
  tryApplyRevenueFormulasToDetail,
} from "./detail-diagnostics";
import {
  cloneDetailForFormula,
  resolveNeededSalesVolumeFormulaSourceDetail,
} from "./formula-source";
import {
  fetchAllSubtableFillPayload,
  fetchRealSubtableFillPayload,
  fetchRealSubtableFillShellPayload,
} from "./fill.service";
import {
  fetchMainTableFillPayloadForNode,
} from "./main-table-fill-payload";
import {
  alignMainDetailDimensions,
  buildMainPayloadFromReusableDetail,
  buildReusableMainPreviewDetail,
  isCalculatedMainPreviewStage,
  isMainPreviewRow,
  isSubtableMainSourceStage,
  mergeCalculatedMainPreviewIntoAuditPayload,
  mergeReadonlySubtableRowsIntoMainAuditDetail,
  resolveMainPreviewSourceStage,
} from "./main-table-preview";
import {
  saveProjectCostSubmitWithDraftRetry,
} from "./project-cost-submit";
import {
  fetchS3ConfirmationPayload,
} from "./s3-confirmation";
import {
  extractDetailRowSubjectIds,
} from "./fill-payload";
import {
  buildDraftMapFromRecords,
} from "./record-cell-map";
import {
  buildCellReviewIndex,
  parseModuleReviewEntries,
  pickLatestSubmittedModuleEntries,
} from "./review-metadata";
import {
  resolveNextStageCode,
  resolveStageLabel,
} from "./stage-labels";
import {
  collectPermissionLeafRows,
  getSubjectNodes,
  shouldIncludeReadonlySubtablesInMain,
} from "./subject-tree";
import {
  hasOperationPermission,
  resolveOperationPermissionKey,
} from "./workbench-permissions";
import {
  nowText,
  resolveProjectDisplayName,
  safeText,
} from "./workbench-utils";

function getDependency(dependencies = {}, key, message) {
  const value = dependencies[key];
  if (typeof value !== "function") {
    throw new Error(message);
  }
  return value;
}

function buildMainTableDataItems(ctx, detail = {}, options = {}) {
  return buildProjectCostDataItemsFromMatrix(ctx, detail, {
    ...options,
    rowFilter: isMainPreviewRow,
  });
}

/** 主表审核提交前校验：关键金额科目不能全部为 0 */
const MAIN_AUDIT_KEY_SUBJECT_IDS = Object.freeze([5, 7, 10]);
const MAIN_AUDIT_KEY_SUBJECT_LABELS = Object.freeze({
  5: "市场指导价/合同价",
  7: "TP价",
  10: "销售收入",
});

function readMatrixNumericCellValue(value) {
  const text = safeText(value).replace(/,/g, "");
  if (!text || text === "-") return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function findMainAuditSubjectRow(rows = [], subjectId) {
  return rows.find((item) => {
    const candidates = [item && item.subjectId, item && item.id, item && item.rowId]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    return candidates.includes(subjectId);
  });
}

function mainAuditDetailRowHasNonZeroValue(detail, row) {
  return buildDetailRealColumns(detail, row).some((column) => {
    if (column.displayOnly || safeText(column.aggregateMode).toUpperCase() !== "NONE") {
      return false;
    }
    const num = readMatrixNumericCellValue(readRowMatrixColumnValue(row, column));
    return num != null && num !== 0;
  });
}

function resolveMainAuditSubmitDetailFromContext(ctx = {}) {
  const candidate = ctx.mainPreviewDetail || ctx.mainAuditDetail;
  if (!candidate || typeof candidate !== "object") return null;
  const rows = Array.isArray(candidate.rows) ? candidate.rows : [];
  if (!rows.some(isMainPreviewRow)) return null;
  return candidate;
}

export function validateMainAuditFinalDetail(detail = {}) {
  const rows = (Array.isArray(detail.rows) ? detail.rows : []).filter(isMainPreviewRow);
  const hasAnyKeyValue = MAIN_AUDIT_KEY_SUBJECT_IDS.some((subjectId) => {
    const row = findMainAuditSubjectRow(rows, subjectId);
    return row ? mainAuditDetailRowHasNonZeroValue(detail, row) : false;
  });
  if (hasAnyKeyValue) {
    return { ok: true };
  }
  const labels = MAIN_AUDIT_KEY_SUBJECT_IDS.map(
    (id) => MAIN_AUDIT_KEY_SUBJECT_LABELS[id] || String(id)
  );
  return {
    ok: false,
    message: `主表关键科目（${labels.join("、")}）均为空或 0，请确认页面数据完整后再提交`,
  };
}

export function validateMainAuditFinalDataItems(dataItems = []) {
  const list = Array.isArray(dataItems) ? dataItems : [];
  const hasAnyKeyValue = MAIN_AUDIT_KEY_SUBJECT_IDS.some((subjectId) =>
    list.some((item) => {
      if (Number(item && item.subjectId) !== subjectId) return false;
      const raw =
        item && item.numberValue != null
          ? item.numberValue
          : item && item.rawValue != null
            ? item.rawValue
            : item && item.value;
      const num = readMatrixNumericCellValue(raw);
      return num != null && num !== 0;
    })
  );
  if (hasAnyKeyValue) {
    return { ok: true };
  }
  const labels = MAIN_AUDIT_KEY_SUBJECT_IDS.map(
    (id) => MAIN_AUDIT_KEY_SUBJECT_LABELS[id] || String(id)
  );
  return {
    ok: false,
    message: `主表关键科目（${labels.join("、")}）均为空或 0，请确认页面数据完整后再提交`,
  };
}

/**
 * 构建主表审核最终提交矩阵：优先使用页面当前展示值，否则回退到底稿重建。
 */
export async function buildMainAuditFinalDetailPayload(mainCtx, flowSnapshot) {
  const pageDetail = resolveMainAuditSubmitDetailFromContext(mainCtx);
  if (pageDetail) {
    return cloneDetailForFormula(pageDetail);
  }

  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || mainCtx.stage || "S4");
  const sourceStageCode = resolveMainPreviewSourceStage(
    {
      ...mainCtx,
      stage: currentStage,
      stageCode: currentStage,
    },
    flowSnapshot
  );
  const fillPayload = await buildMainTableSnapshotPayloadFromStageContextPayload(
    {
      ...mainCtx,
      stage: currentStage,
      stageCode: currentStage,
    },
    flowSnapshot,
    { sourceStageCode }
  );
  const auditPayload = buildAuditDetailPayloadFromFillPayload(mainCtx, fillPayload);
  setAuditContextCache(mainCtx, auditPayload);

  const fillDetail =
    fillPayload && fillPayload.detail && typeof fillPayload.detail === "object"
      ? fillPayload.detail
      : {};
  const detail = cloneDetailForFormula(fillDetail);
  const subjectIds = extractDetailRowSubjectIds(detail);
  const [records, suggestions] = await Promise.all([
    queryAuditRecordsRows(mainCtx, flowSnapshot, {
      subjectIds,
      includeOwnerFilter: false,
    }),
    queryReviewSuggestionRows(mainCtx, flowSnapshot, {
      includeReviewerFilter: false,
    }),
  ]);
  const draftMap = buildDraftMapFromRecords(mainCtx, records, buildCellReviewIndex(suggestions), {
    includeOwnerPermissionFilter: false,
  });
  applyMainAuditDraftMapToDetail(detail, draftMap);
  applyRevenueFormulasToDetail(detail, {
    targetModuleCode: REVENUE_MODULE_CODE.MAIN_PNL,
    calculationMode: REVENUE_FORMULA_CALCULATION_MODE.MAIN_AUDIT,
  });
  return detail;
}

function isS2ReviewMainPreviewMode(ctx = {}, sourceStageCode = "") {
  const sourceStage = normalizeStageCode(sourceStageCode || ctx.stageCode || ctx.stage);
  if (sourceStage !== "S2") return false;
  const mode = safeText(ctx.s2DetailMode || ctx.detailMode).toLowerCase();
  if (mode) return mode === "review";
  const action = safeText(ctx.workbenchAction || ctx.action).toLowerCase();
  return action === "review" || action === "audit";
}

async function resolveS2ReviewMainInputBaselineDetails(ctx = {}, flowSnapshot, sourceStageCode = "") {
  if (!isS2ReviewMainPreviewMode(ctx, sourceStageCode)) return [];
  const fillPayload = await fetchMainTableFillPayloadForNode(
    {
      ...ctx,
      subjectDomain: "main",
      subjectApiMode: "all",
      stage: "S1",
      stageCode: "S1",
    },
    flowSnapshot,
    "S1"
  );
  const detail =
    fillPayload && fillPayload.detail && typeof fillPayload.detail === "object"
      ? fillPayload.detail
      : null;
  return detail && Array.isArray(detail.rows) && detail.rows.length
    ? [cloneDetailForFormula(detail)]
    : [];
}

export async function buildS2SourceDetailForMainPayload(ctx, flowSnapshot, options = {}, dependencies = {}) {
  const sourceCtx = {
    ...ctx,
    subjectDomain: "subtable",
    subjectApiMode: "auto",
    stage: "S2",
    stageCode: "S2",
    // 系统级主表来源：按模板全集组装子表来源树，不按当前用户授权裁剪
    subjectScope: "template",
  };
  const auditPayload = options.auditPayload || await getDependency(
    dependencies,
    "fetchSubtableAuditDetail",
    "缺少子表审核详情加载器，无法构建 S2 主表来源"
  )(sourceCtx);
  const fillDetail =
    auditPayload && auditPayload.fillDetail && typeof auditPayload.fillDetail === "object"
      ? auditPayload.fillDetail
      : {};
  const baseDetail =
    auditPayload && auditPayload.detail && typeof auditPayload.detail === "object"
      ? auditPayload.detail
      : {};
  const detail = cloneDetailForFormula({
    ...baseDetail,
    dimensions:
      fillDetail.dimensions && typeof fillDetail.dimensions === "object"
        ? fillDetail.dimensions
        : { years: [], trims: [] },
    trimOptions: Array.isArray(fillDetail.trimOptions) ? fillDetail.trimOptions : [],
    yearTrimConfig:
      fillDetail.yearTrimConfig && typeof fillDetail.yearTrimConfig === "object"
        ? { ...fillDetail.yearTrimConfig }
        : {},
  });

  const subjectIds = extractDetailRowSubjectIds(detail);
  const [records, suggestions] = await Promise.all([
    queryAuditRecordsRows(sourceCtx, flowSnapshot, {
      node: "S2",
      includeOwnerFilter: false,
      subjectIds,
    }),
    queryReviewSuggestionRows(sourceCtx, flowSnapshot, {
      node: "S2",
      includeReviewerFilter: false,
    }),
  ]);
  const reviewIndex = buildCellReviewIndex(suggestions);
  const draftMap = buildDraftMapFromRecords(sourceCtx, records, reviewIndex, {
    includeOwnerPermissionFilter: false,
  });
  applyDraftMapToDetail(detail, draftMap);
  const formulaSourceDetail = await resolveNeededSalesVolumeFormulaSourceDetail(sourceCtx, detail);
  tryApplyRevenueFormulasToDetail(detail, {
    sourceDetails: formulaSourceDetail ? [formulaSourceDetail] : [],
  });

  return {
    detail,
    records,
    suggestions,
    latestModuleMap: pickLatestSubmittedModuleEntries(parseModuleReviewEntries(suggestions)),
  };
}

export async function resolveMainSourceDetailPayload(ctx, flowSnapshot, sourceStageCode, options = {}, dependencies = {}) {
  const sourceStage = normalizeStageCode(sourceStageCode || "S1");
  if (options.sourceDetail) return options.sourceDetail;
  if (sourceStage === "S2") {
    return (await buildS2SourceDetailForMainPayload(ctx, flowSnapshot, {}, dependencies)).detail;
  }
  if (sourceStage === "S3") {
    return (await fetchS3ConfirmationPayload(ctx, flowSnapshot, {
      ownerScoped: false,
    })).detail;
  }
  if (sourceStage === "S1") {
    return ((await fetchAllSubtableFillPayload(ctx)).detail || {});
  }
  return ((await fetchMainTableFillPayloadForNode(ctx, flowSnapshot, sourceStage)).detail || {});
}

export async function buildCalculatedMainTablePayloadFromStageContextPayload(
  ctx,
  flowSnapshot,
  options = {},
  dependencies = {}
) {
  const sourceStageCode = resolveMainPreviewSourceStage(ctx, flowSnapshot, options);
  if (!isSubtableMainSourceStage(sourceStageCode)) {
    const fillPayload = await fetchMainTableFillPayloadForNode(ctx, flowSnapshot, sourceStageCode);
    const detail = cloneDetailForFormula(
      fillPayload && fillPayload.detail && typeof fillPayload.detail === "object"
        ? fillPayload.detail
        : {}
    );
    const formulaResult = tryApplyRevenueFormulasToDetail(detail, {
      targetModuleCode: REVENUE_MODULE_CODE.MAIN_PNL,
      calculationMode: REVENUE_FORMULA_CALCULATION_MODE.MAIN_AUDIT,
    });
    return {
      ...(fillPayload || {}),
      detail: {
        ...((fillPayload && fillPayload.detail) || {}),
        ...detail,
        valueSourceNodes: [sourceStageCode],
        selectedSourceStage: sourceStageCode,
        calculatedMainPreview: true,
        mainPreviewSourceMode: "calculated",
        mainPreviewSourceStage: sourceStageCode,
        formulaErrors: formulaResult.errors || [],
      },
      formulaResult,
      sourceStageCode,
    };
  }

  const sourceDetail = await resolveMainSourceDetailPayload(ctx, flowSnapshot, sourceStageCode, options, dependencies);

  const mainCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
    // 系统级主表生成：按模板全集组装主表树，不按当前用户授权裁剪
    subjectScope: "template",
  };
  const reusableSourceMainDetail = options.sourceDetail && typeof options.sourceDetail === "object"
    ? buildReusableMainPreviewDetail({
        detail: options.sourceDetail,
        fillDetail: options.sourceDetail,
      })
    : null;
  let reusableMainDetail = null;
  if (
    options.mainDetail &&
    Array.isArray(options.mainDetail.rows) &&
    options.mainDetail.rows.some(isMainPreviewRow)
  ) {
    reusableMainDetail = options.mainDetail;
  } else if (
    reusableSourceMainDetail &&
    Array.isArray(reusableSourceMainDetail.rows) &&
    reusableSourceMainDetail.rows.some(isMainPreviewRow)
  ) {
    reusableMainDetail = reusableSourceMainDetail;
  }
  const mainPayload = reusableMainDetail
    ? buildMainPayloadFromReusableDetail(mainCtx, flowSnapshot, reusableMainDetail, sourceStageCode)
    : await fetchRealSubtableFillShellPayload(mainCtx, { ownerScoped: false });
  revenueMainGenerateLog("计算主表-数据准备", {
    sourceStageCode,
    sourceDetail: buildDetailDebugSummary(sourceDetail),
    mainSubjectNodeCount: getSubjectNodes(mainPayload && mainPayload.subjectTreePayload).length,
    mainSubjectLeafCount: collectPermissionLeafRows(getSubjectNodes(mainPayload && mainPayload.subjectTreePayload)).length,
    rawMainDetail: buildDetailDebugSummary((mainPayload && mainPayload.detail) || {}),
    rawMainRowSample: buildRowsDebugSample(
      mainPayload && mainPayload.detail && Array.isArray(mainPayload.detail.rows)
        ? mainPayload.detail.rows
        : []
    ),
  });
  const mainDetail = alignMainDetailDimensions(
    cloneDetailForFormula(
      mainPayload && mainPayload.detail && typeof mainPayload.detail === "object"
        ? mainPayload.detail
        : {}
    ),
    sourceDetail
  );

  const sourceFormulaDetail = await resolveNeededSalesVolumeFormulaSourceDetail(
    {
      ...ctx,
      subjectDomain: "subtable",
      subjectApiMode: "all",
      stage: sourceStageCode,
      stageCode: sourceStageCode,
    },
    sourceDetail
  );
  tryApplyRevenueFormulasToDetail(sourceDetail, {
    sourceDetails: sourceFormulaDetail ? [sourceFormulaDetail] : [],
  });
  const mainInputBaselineDetails = await resolveS2ReviewMainInputBaselineDetails(
    ctx,
    flowSnapshot,
    sourceStageCode
  );
  const formulaSourceDetails = [sourceDetail].concat(mainInputBaselineDetails);
  const formulaResult = tryApplyRevenueFormulasToDetail(mainDetail, {
    sourceDetails: formulaSourceDetails,
    targetModuleCode: REVENUE_MODULE_CODE.MAIN_PNL,
    ignoreFormulaLocks: true,
  });
  const displayDetail = shouldIncludeReadonlySubtablesInMain(ctx)
    ? mergeReadonlySubtableRowsIntoMainAuditDetail(mainDetail, sourceDetail)
    : mainDetail;
  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S4");
  revenueMainGenerateLog("计算主表-公式完成", {
    sourceStageCode,
    currentStage,
    mainInputBaselineSourceStage: mainInputBaselineDetails.length ? "S1" : "",
    s2DetailMode: safeText(ctx.s2DetailMode),
    formulaErrors: formulaResult.errors || [],
    resultDetail: buildDetailDebugSummary(displayDetail),
    formulaDiagnostics: buildSafeMainFormulaDebugDiagnostics(mainDetail, sourceDetail),
    resultMainRowSample: buildRowsDebugSample(
      (Array.isArray(displayDetail.rows) ? displayDetail.rows : []).filter(isMainPreviewRow)
    ),
  });
  return {
    ...(mainPayload || {}),
    project: {
      ...((mainPayload && mainPayload.project) || {}),
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
      ...((mainPayload && mainPayload.detail) || {}),
      ...displayDetail,
      flowId: flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined,
      flowNode: currentStage,
      valueSourceNodes: mainInputBaselineDetails.length ? ["S1", sourceStageCode] : [sourceStageCode],
      selectedSourceStage: sourceStageCode,
      calculatedMainPreview: true,
      mainPreviewSourceMode: "calculated",
      mainPreviewSourceStage: sourceStageCode,
      mainInputBaselineSourceStage: mainInputBaselineDetails.length ? "S1" : "",
      s2DetailMode: safeText(ctx.s2DetailMode),
      formulaErrors: formulaResult.errors || [],
    },
    permissions: {
      viewer: ctx.userId,
      permissionKey: resolveOperationPermissionKey(ctx, ""),
    },
    formulaResult,
    sourceStageCode,
  };
}

export async function buildMainTableSnapshotPayloadFromStageContextPayload(ctx, flowSnapshot, options = {}) {
  const sourceStageCode = resolveMainPreviewSourceStage(ctx, flowSnapshot, options);
  const fillPayload = await fetchMainTableFillPayloadForNode(ctx, flowSnapshot, sourceStageCode, {
    recordStatus: options.recordStatus,
  });
  const detail =
    fillPayload && fillPayload.detail && typeof fillPayload.detail === "object"
      ? fillPayload.detail
      : {};
  return {
    ...(fillPayload || {}),
    detail: {
      ...detail,
      valueSourceNodes: [sourceStageCode],
      selectedSourceStage: sourceStageCode,
      mainSnapshotSourceStage: sourceStageCode,
      mainPreviewSourceMode: "snapshot",
      calculatedMainPreview: false,
    },
    formulaResult: { errors: [] },
    sourceStageCode,
  };
}

export async function buildMainTablePayloadForAuditDetailPayload(ctx, flowSnapshot, dependencies = {}) {
  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S4");
  if (isCalculatedMainPreviewStage(currentStage)) {
    return buildCalculatedMainTablePayloadFromStageContextPayload(
      {
        ...ctx,
        subjectDomain: "main",
        subjectApiMode: "all",
        stage: currentStage,
        stageCode: currentStage,
      },
      flowSnapshot,
      {
        sourceStageCode: currentStage,
      },
      dependencies
    );
  }
  return buildMainTableSnapshotPayloadFromStageContextPayload(ctx, flowSnapshot);
}

export async function generateMainTableFromStageContextPayload(ctx, flowSnapshot, options = {}, dependencies = {}) {
  const sourceStageCode = normalizeStageCode(options.sourceStageCode || (flowSnapshot && flowSnapshot.node) || ctx.stage);
  revenueMainGenerateLog("生成主表-开始", {
    sourceStageCode,
    flowId: flowSnapshot && flowSnapshot.flowId,
    flowNode: flowSnapshot && flowSnapshot.node,
    projectCode: ctx.projectCode,
    valve: ctx.valve,
    permissionKey: resolveOperationPermissionKey(ctx, ""),
    subjectApiMode: ctx.subjectApiMode,
    sourceDetail: buildDetailDebugSummary(options.sourceDetail || {}),
  });
  const calculatedPayload = await buildCalculatedMainTablePayloadFromStageContextPayload(ctx, flowSnapshot, {
    sourceStageCode,
    sourceDetail: options.sourceDetail,
  }, dependencies);
  const mainDetail =
    calculatedPayload && calculatedPayload.detail && typeof calculatedPayload.detail === "object"
      ? calculatedPayload.detail
      : {};
  const formulaResult = calculatedPayload && calculatedPayload.formulaResult
    ? calculatedPayload.formulaResult
    : { errors: [] };
  const mainCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
  };
  const dataItems = buildMainTableDataItems(mainCtx, mainDetail, {
    includeRecordIds: false,
  });
  revenueMainGenerateLog("生成主表-保存数据", {
    sourceStageCode,
    dataItemCount: dataItems.length,
    formulaErrors: formulaResult.errors || [],
    mainDetail: buildDetailDebugSummary(mainDetail),
    dataItemSample: dataItems.slice(0, 8),
    mainRowSample: buildRowsDebugSample(
      (Array.isArray(mainDetail.rows) ? mainDetail.rows : []).filter(isMainPreviewRow)
    ),
  });
  if (!dataItems.length) {
    revenueMainGenerateLog("生成主表-失败：dataItems为空", {
      reason: "前端未组装出任何可保存主表科目值",
      sourceStageCode,
      formulaErrors: formulaResult.errors || [],
      mainDetail: buildDetailDebugSummary(mainDetail),
      formulaDiagnostics: buildSafeMainFormulaDebugDiagnostics(mainDetail, options.sourceDetail || {}),
      saveDiagnostics: buildMainSaveDiagnostics(mainCtx, mainDetail),
      mainRows: buildRowsDebugSample(
        (Array.isArray(mainDetail.rows) ? mainDetail.rows : []).filter(isMainPreviewRow),
        20
      ),
    });
    return {
      ok: false,
      savedCount: 0,
      formulaErrors: formulaResult.errors || [],
      message: "未生成可保存的主表科目值",
    };
  }

  await saveProjectCostSubmitApi({
    flowId: flowSnapshot.flowId,
    saveMode: safeText(options.saveMode, "ARCHIVED"),
    submitRemark: safeText(options.submitRemark, `AUTO_MAIN_FROM_${sourceStageCode}_FINAL_SUBMIT`),
    dataItems,
  }, `提交: 生成主表 submits/save | source=${sourceStageCode} | items=${dataItems.length}`);

  return {
    ok: true,
    sourceStageCode,
    savedCount: dataItems.length,
    formulaErrors: formulaResult.errors || [],
    message: "已由前端公式引擎生成并保存主表真实科目值",
  };
}

export async function enrichSubtableAuditPayloadWithMainPreviewPayload(
  ctx,
  flowSnapshot,
  auditPayload = {},
  dependencies = {}
) {
  const stageCode = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S2");
  if (!["S2", "S3"].includes(stageCode)) return auditPayload;
  const reusableMainDetail = buildReusableMainPreviewDetail(auditPayload);
  const sourceDetail = stageCode === "S2"
    ? (await buildS2SourceDetailForMainPayload(ctx, flowSnapshot, { auditPayload }, dependencies)).detail
    : ((await fetchS3ConfirmationPayload(ctx, flowSnapshot, { ownerScoped: false })).detail || {});
  const mainPayload = await buildCalculatedMainTablePayloadFromStageContextPayload(
    {
      ...ctx,
      subjectDomain: "main",
      subjectApiMode: "all",
      stage: stageCode,
      stageCode,
    },
    flowSnapshot,
    {
      sourceStageCode: stageCode,
      sourceDetail,
      mainDetail: reusableMainDetail,
    },
    dependencies
  );
  return mergeCalculatedMainPreviewIntoAuditPayload(auditPayload, mainPayload);
}

export async function enrichSubtableAuditPayloadWithLoadedMainPreviewPayload(
  ctx,
  flowSnapshot,
  auditPayload = {},
  options = {},
  dependencies = {}
) {
  const stageCode = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S2");
  if (!["S2", "S3"].includes(stageCode)) return auditPayload;
  const fillDetail =
    auditPayload && auditPayload.fillDetail && typeof auditPayload.fillDetail === "object"
      ? auditPayload.fillDetail
      : {};
  const baseDetail =
    auditPayload && auditPayload.detail && typeof auditPayload.detail === "object"
      ? auditPayload.detail
      : {};
  const sourceDetail = cloneDetailForFormula({
    ...baseDetail,
    dimensions:
      fillDetail.dimensions && typeof fillDetail.dimensions === "object"
        ? fillDetail.dimensions
        : (baseDetail.dimensions && typeof baseDetail.dimensions === "object"
          ? baseDetail.dimensions
          : { years: [], trims: [] }),
    trimOptions: Array.isArray(fillDetail.trimOptions)
      ? fillDetail.trimOptions
      : (Array.isArray(baseDetail.trimOptions) ? baseDetail.trimOptions : []),
    yearTrimConfig:
      fillDetail.yearTrimConfig && typeof fillDetail.yearTrimConfig === "object"
        ? { ...fillDetail.yearTrimConfig }
        : (baseDetail.yearTrimConfig && typeof baseDetail.yearTrimConfig === "object"
          ? { ...baseDetail.yearTrimConfig }
          : {}),
  });
  const formulaSourceDetail = await resolveNeededSalesVolumeFormulaSourceDetail(
    {
      ...ctx,
      subjectDomain: "subtable",
      subjectApiMode: "all",
      stage: stageCode,
      stageCode,
    },
    sourceDetail
  );
  tryApplyRevenueFormulasToDetail(sourceDetail, {
    sourceDetails: formulaSourceDetail ? [formulaSourceDetail] : [],
  });
  const mainPayload = await buildCalculatedMainTablePayloadFromStageContextPayload(
    {
      ...ctx,
      subjectDomain: "main",
      subjectApiMode: "all",
      stage: stageCode,
      stageCode,
    },
    flowSnapshot,
    {
      sourceStageCode: stageCode,
      sourceDetail,
      mainDetail: options.mainDetail || buildReusableMainPreviewDetail(auditPayload),
    },
    dependencies
  );
  return mergeCalculatedMainPreviewIntoAuditPayload(auditPayload, mainPayload);
}

export async function submitMainTableAuditFinalPayload(mainCtx, flowSnapshot, dependencies = {}) {
  try {
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法提交主表审核" };
    }

    const currentStage = normalizeStageCode(flowSnapshot.node || mainCtx.stage || "S4");
    if (!["S4", "S6"].includes(currentStage)) {
      return { ok: false, message: `当前阶段 ${resolveStageLabel(currentStage)} 不支持主表审核总提交` };
    }
    if (!hasOperationPermission(mainCtx, currentStage, "review")) {
      return { ok: false, message: "当前权限不具备主表审核并提交权限" };
    }

    const buildMainAuditFinalDetail = getDependency(
      dependencies,
      "buildMainAuditFinalDetail",
      "缺少主表审核最终值构建器"
    );
    const executeStageSubmitFlow = getDependency(
      dependencies,
      "executeStageSubmitFlow",
      "缺少流程提交器，无法提交主表审核"
    );
    const detail = await buildMainAuditFinalDetail(
      {
        ...mainCtx,
        stage: currentStage,
        stageCode: currentStage,
      },
      flowSnapshot
    );
    const dataItems = buildMainTableDataItems(mainCtx, detail, {
      includeRecordIds: false,
    });
    if (!dataItems.length) {
      return { ok: false, message: "未生成可提交的主表最终值" };
    }
    const validation = validateMainAuditFinalDataItems(dataItems);
    if (!validation.ok) {
      return { ok: false, message: validation.message };
    }

    await saveProjectCostSubmitApi({
      flowId: flowSnapshot.flowId,
      saveMode: "ARCHIVED",
      submitRemark: `AUTO_MAIN_FROM_${currentStage}_FINAL_SUBMIT`,
      dataItems,
    }, `提交: 主表最终值 submits/save | source=${currentStage} | items=${dataItems.length}`);

    const nextStage = resolveNextStageCode(currentStage);
    const flowResult = await executeStageSubmitFlow(
      mainCtx,
      flowSnapshot,
      nextStage,
      `${resolveStageLabel(currentStage)} 主表审核最终提交`
    );
    return {
      ok: true,
      savedCount: dataItems.length,
      result: flowResult,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "主表审核提交失败"),
    };
  }
}

export async function submitMainTableVersionSelectionFinalPayload(mainCtx, flowSnapshot, dependencies = {}) {
  try {
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法提交主表最终值选择" };
    }

    const currentStage = normalizeStageCode(flowSnapshot.node || mainCtx.stage || "S5");
    if (currentStage !== "S5") {
      return { ok: false, message: `当前阶段 ${resolveStageLabel(currentStage)} 不支持主表最终值选择` };
    }
    if (!hasOperationPermission(mainCtx, currentStage, "select_main")) {
      return { ok: false, message: "当前权限不具备主表最终值提交权限" };
    }

    const sourceStage = normalizeStageCode(mainCtx.selectedSourceStage || "S4");
    if (!["S2", "S3", "S4"].includes(sourceStage)) {
      return { ok: false, message: "请选择 S2 集团部室审核、S3 业务经理二次确认或 S4 二级公司财务审核的主表值" };
    }
    const buildMainTableSnapshotPayloadFromStageContext = getDependency(
      dependencies,
      "buildMainTableSnapshotPayloadFromStageContext",
      "缺少主表快照构建器，无法提交主表最终值选择"
    );
    const fillPayload = await buildMainTableSnapshotPayloadFromStageContext(mainCtx, flowSnapshot, {
      sourceStageCode: sourceStage,
    });
    const auditPayload = buildAuditDetailPayloadFromFillPayload(mainCtx, fillPayload);
    setAuditContextCache(mainCtx, auditPayload);
    const detail = cloneDetailForFormula(
      fillPayload && fillPayload.detail && typeof fillPayload.detail === "object"
        ? fillPayload.detail
        : {}
    );
    const dataItems = buildMainTableDataItems(mainCtx, detail, {
      includeRecordIds: false,
    });
    if (!dataItems.length) {
      return { ok: false, message: `${resolveStageLabel(sourceStage)} 暂无可提交的主表值` };
    }

    await saveProjectCostSubmitApi({
      flowId: flowSnapshot.flowId,
      saveMode: "ARCHIVED",
      submitRemark: `AUTO_MAIN_FROM_S5_SELECT_${sourceStage}`,
      dataItems,
    }, `提交: S5选择主表值 submits/save | source=${sourceStage} | items=${dataItems.length}`);

    return {
      ok: true,
      sourceStage,
      savedCount: dataItems.length,
      result: {
        submittedAt: nowText(),
        nextStage: "S5",
        targetStage: "S6",
        nodeUpdated: false,
        pendingConfirm: false,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "主表最终值选择提交失败"),
    };
  }
}

export async function recalculateMainTableAuditPayload(ctx, flowSnapshot) {
  try {
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法重新测算" };
    }

    const fillPayload = await fetchRealSubtableFillPayload(
      {
        ...ctx,
        subjectDomain: "main",
        subjectApiMode: "all",
      },
      { ownerScoped: false }
    );
    const currentStage = normalizeStageCode(flowSnapshot.node || ctx.stageCode || ctx.stage);
    const mainAuditMode = !isSubtableMainSourceStage(currentStage);
    const detail =
      fillPayload && fillPayload.detail && typeof fillPayload.detail === "object"
        ? fillPayload.detail
        : {};
    const formulaOptions = {
      targetModuleCode: REVENUE_MODULE_CODE.MAIN_PNL,
    };
    if (mainAuditMode) {
      formulaOptions.calculationMode = REVENUE_FORMULA_CALCULATION_MODE.MAIN_AUDIT;
    } else {
      const sourcePayload = await fetchRealSubtableFillPayload(
        {
          ...ctx,
          subjectDomain: "subtable",
        },
        { ownerScoped: false }
      );
      const sourceDetail =
        sourcePayload && sourcePayload.detail && typeof sourcePayload.detail === "object"
          ? sourcePayload.detail
          : {};
      const sourceFormulaDetail = await resolveNeededSalesVolumeFormulaSourceDetail(
        {
          ...ctx,
          subjectDomain: "subtable",
          subjectApiMode: "all",
        },
        sourceDetail
      );
      applyRevenueFormulasToDetail(sourceDetail, {
        sourceDetails: sourceFormulaDetail ? [sourceFormulaDetail] : [],
      });
      formulaOptions.sourceDetails = [sourceDetail];
    }
    const formulaResult = applyRevenueFormulasToDetail(detail, formulaOptions);
    const dataItems = buildMainTableDataItems(ctx, detail);

    if (dataItems.length) {
      await saveProjectCostSubmitWithDraftRetry(ctx, flowSnapshot, {
        flowId: flowSnapshot.flowId,
        saveMode: "DRAFT",
        submitRemark: "FRONTEND_RECALCULATE",
        dataItems,
      });
    }

    return {
      ok: true,
      calcRound: Number(ctx.calcRound || 0) + 1,
      savedCount: dataItems.length,
      formulaErrors: formulaResult.errors || [],
      message: "已由前端公式引擎重新测算并保存真实科目值",
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "重新测算失败"),
    };
  }
}
