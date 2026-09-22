import {
  saveProjectCostReview as saveProjectCostReviewApi,
} from "@/api/system/expenses";
import {
  AUDIT_DOMAIN,
  isRevenueYearOnlyRow,
  normalizeStageCode,
} from "../domain-config";
import {
  getRndAmountAggregateModeByCellKey,
  isRndAmountCellKey,
  isRndDoubleAmountSourceRow,
} from "../formula-engine";
import {
  rememberFormulaError,
} from "./detail-diagnostics";
import {
  parseCellKey,
} from "./detail-matrix";
import {
  buildAuditDetailPayloadFromFillPayload,
} from "./audit-payload";
import {
  setAuditContextCache,
  getAuditContextCache,
  resolveAuditCacheRow,
} from "./audit-context-cache";
import {
  queryAuditRecordsRows,
  queryReviewSuggestionRows,
  requestModuleReviewState,
} from "./audit-record-queries";
import {
  buildCellHistoryMap,
} from "./cell-history";
import {
  buildSubtableFillPayloadFromRecords,
} from "./fill-payload";
import {
  fetchRealSubtableFillShellPayload,
} from "./fill.service";
import {
  isMainPreviewRow,
  resolveAuditHistoryNodes,
  resolveMainPreviewSourceStage,
} from "./main-table-preview";
import {
  appendUniqueSubjectIds,
  buildReadonlyAuthorizedModuleLoadPlan,
  buildSubtableModuleLoadPlan,
  resolveReadonlyAuthorizedDependencySubjectIds,
} from "./module-load-plan";
import {
  buildProjectCostDataItem,
  mergeTargetIds,
  readRowMatrixTargetMeta,
  readRowMatrixTargetMetaByCellKey,
  resolveYearAggregateMode,
} from "./project-cost-data-item";
import {
  isProjectCostDraftUniqueConflict,
  resolveExistingTargetRefsForDataItems,
  saveProjectCostSubmitWithDraftRetry,
} from "./project-cost-submit";
import {
  requestProjectPatternList,
} from "./project-context";
import {
  queryProjectCostRecordsForNodes,
  resolveRecordQuerySubjectIds,
} from "./project-cost-record-query";
import {
  buildDraftMapFromRecords,
} from "./record-cell-map";
import {
  filterRecordsBySubjectIds,
  normalizeRecordStatus,
  normalizeTargetRecordIds,
  normalizeTargetSubmitIds,
} from "./record-utils";
import {
  buildCellReviewIndex,
  buildCellSuggestionText,
  buildModuleSuggestionText,
  buildModuleReviewStateFromSuggestions,
  findModuleEntry,
  parseModuleReviewEntries,
  pickLatestModuleEntries,
  resolveModuleIdentity,
} from "./review-metadata";
import {
  buildS5DecisionApprovalMetaForContext,
} from "./s5-decision-approval";
import {
  resolveSubmittedValueSourceNodes,
} from "./stage-labels";
import {
  buildMainWorkbenchContext,
  getSubjectNodes,
  isMainWorkbenchReadonlySubtableModule,
} from "./subject-tree";
import {
  requestSubjectTreePreferPermission,
} from "./subject-tree-request";
import {
  collectModuleTargetIds,
} from "./module-review-targets";
import {
  canCreateTargetlessMainAuditValue,
  canCreateTargetlessSubtableAuditValue,
} from "./workbench-permissions";
import {
  appendSubmitPayloadTargetIds,
  appendUniqueIds,
  buildRevenueTraceLabel,
  nowText,
  normalizeSubjectIdFilterList,
  resolveMatrixSubjectId,
  safeText,
  toMaybeLong,
  unwrapBizPayload,
} from "./workbench-utils";

function resolveAuditModuleRecordNodes(ctx = {}, flowSnapshot = null, options = {}) {
  if (isMainWorkbenchReadonlySubtableModule(ctx)) return "S3";
  if (options.selectedSourceStage) return normalizeStageCode(options.selectedSourceStage);
  if (options.decisionApprovalMode) return "S5";
  if (safeText(ctx.subjectDomain).toLowerCase() === "main") {
    return resolveMainPreviewSourceStage(ctx, flowSnapshot, options);
  }
  return resolveSubmittedValueSourceNodes(ctx, flowSnapshot);
}

async function enrichAuditPayloadWithMainPreview(auditCtx, flowSnapshot, auditPayload, options = {}, dependencies = {}) {
  if (auditCtx.subjectDomain === "main") return auditPayload;
  if (options.deferMainPreview === true) return auditPayload;
  const enrichSubtableAuditPayloadWithLoadedMainPreview = dependencies.enrichSubtableAuditPayloadWithLoadedMainPreview;
  if (typeof enrichSubtableAuditPayloadWithLoadedMainPreview !== "function") return auditPayload;
  try {
    return await enrichSubtableAuditPayloadWithLoadedMainPreview(
      auditCtx,
      flowSnapshot,
      auditPayload,
      options
    );
  } catch (error) {
    rememberFormulaError(auditPayload && auditPayload.detail, error);
    return auditPayload;
  }
}

export async function buildAuditWorkbenchShellPayload(ctx, flowSnapshot, options = {}, dependencies = {}) {
  const auditCtx = ctx.subjectDomain === "main"
    ? buildMainWorkbenchContext(ctx, flowSnapshot)
    : ctx;
  const fillPayload = await fetchRealSubtableFillShellPayload(auditCtx, {
    ownerScoped: false,
  });
  let auditPayload = buildAuditDetailPayloadFromFillPayload(auditCtx, fillPayload);
  auditPayload = await enrichAuditPayloadWithMainPreview(
    auditCtx,
    flowSnapshot,
    auditPayload,
    {},
    dependencies
  );
  if (options.selectedSourceStage) {
    const sourceStage = normalizeStageCode(options.selectedSourceStage);
    auditPayload.detail.selectedSourceStage = sourceStage;
    auditPayload.detail.mainSnapshotSourceStage = sourceStage;
    auditPayload.detail.valueSourceNodes = [sourceStage];
  }
  if (options.decisionApprovalMode) {
    auditPayload.detail.s5DecisionApproval = await buildS5DecisionApprovalMetaForContext(
      auditCtx,
      flowSnapshot,
      false,
      "S5",
      dependencies
    );
  }
  setAuditContextCache(auditCtx, auditPayload);
  return {
    ...auditPayload,
    subjectTreePayload: fillPayload.subjectTreePayload,
    moduleLoadPlan: auditCtx.readonlyAuthorizedScope
      ? buildReadonlyAuthorizedModuleLoadPlan(fillPayload.subjectTreePayload, { isSuperAdmin: auditCtx.isSuperAdmin === true || auditCtx.fullAccess === true })
      : fillPayload.moduleLoadPlan,
    patternList: fillPayload.patternList,
    ownerScoped: false,
  };
}

export async function fetchAuditWorkbenchModulePayload(ctx, flowSnapshot, options = {}, dependencies = {}) {
  const subjectIds = normalizeSubjectIdFilterList(ctx.subjectIds);
  const moduleName = safeText(ctx.moduleName || ctx.rootSubjectName, "未命名模块");
  const moduleKey = safeText(ctx.moduleKey || ctx.key || moduleName);
  const auditCtx = ctx.subjectDomain === "main"
    ? buildMainWorkbenchContext(ctx, flowSnapshot)
    : ctx;
  const isReadonlySubtableInMain = isMainWorkbenchReadonlySubtableModule(auditCtx);
  const detailBuildCtx = isReadonlySubtableInMain
    ? {
      ...auditCtx,
      subjectDomain: AUDIT_DOMAIN.SUBTABLE,
    }
    : auditCtx;
  let subjectTreePayload = ctx.subjectTreePayload;
  if (!getSubjectNodes(subjectTreePayload).length) {
    subjectTreePayload = await requestSubjectTreePreferPermission(auditCtx);
  }
  const patternList = Array.isArray(ctx.patternList)
    ? ctx.patternList
    : await requestProjectPatternList(auditCtx);
  const dependencySubjectIds = resolveReadonlyAuthorizedDependencySubjectIds(
    auditCtx,
    subjectTreePayload,
    subjectIds
  );
  const querySubjectIds = appendUniqueSubjectIds(subjectIds.slice(), dependencySubjectIds);
  const nodes = resolveAuditModuleRecordNodes(auditCtx, flowSnapshot, options);
  let recordSourceNodes = nodes;
  let currentRecords = [];
  let moduleHasS5Data = false;
  if (querySubjectIds.length && options.decisionApprovalMode) {
    const s5ArchivedRecords = await queryProjectCostRecordsForNodes(auditCtx, flowSnapshot, false, "S5", {
      subjectIds: querySubjectIds,
      recordStatus: "ARCHIVED",
      traceLabel: buildRevenueTraceLabel(
        auditCtx,
        `记录: 模块 ${moduleName} audit records/query nodes=S5 status=ARCHIVED subjectIds=${querySubjectIds.join(",") || "-"}`
      ),
    });
    if (s5ArchivedRecords.length) {
      currentRecords = s5ArchivedRecords;
      moduleHasS5Data = true;
    } else {
      const s5SubmittedRecords = await queryProjectCostRecordsForNodes(auditCtx, flowSnapshot, false, "S5", {
        subjectIds: querySubjectIds,
        traceLabel: buildRevenueTraceLabel(
          auditCtx,
          `记录: 模块 ${moduleName} audit records/query nodes=S5 submitted subjectIds=${querySubjectIds.join(",") || "-"}`
        ),
      });
      const nonDraftS5Records = s5SubmittedRecords.filter(
        (record) => normalizeRecordStatus(record) !== "DRAFT"
      );
      if (nonDraftS5Records.length) {
        currentRecords = nonDraftS5Records;
        moduleHasS5Data = true;
      } else {
        recordSourceNodes = "S4";
        currentRecords = await queryProjectCostRecordsForNodes(auditCtx, flowSnapshot, false, "S4", {
          subjectIds: querySubjectIds,
          traceLabel: buildRevenueTraceLabel(
            auditCtx,
            `记录: 模块 ${moduleName} audit records/query nodes=S4 fallback subjectIds=${querySubjectIds.join(",") || "-"}`
          ),
        });
      }
    }
  } else if (querySubjectIds.length) {
    currentRecords = await queryProjectCostRecordsForNodes(auditCtx, flowSnapshot, false, nodes, {
      subjectIds: querySubjectIds,
      recordStatus: options.recordStatus,
      traceLabel: buildRevenueTraceLabel(
        auditCtx,
        `记录: 模块 ${moduleName} audit records/query nodes=${
          Array.isArray(nodes) ? nodes.join(",") : nodes
        } subjectIds=${querySubjectIds.join(",") || "-"}`
      ),
    });
  }
  const scopedRecords = filterRecordsBySubjectIds(currentRecords, subjectIds);
  const recordsForDetail = filterRecordsBySubjectIds(currentRecords, querySubjectIds);
  const loadedRecords = Array.isArray(ctx.loadedRecords) ? ctx.loadedRecords : [];
  const allRecords = loadedRecords.concat(recordsForDetail);
  const fillPayload = buildSubtableFillPayloadFromRecords(
    detailBuildCtx,
    subjectTreePayload,
    flowSnapshot,
    patternList,
    allRecords,
    { ownerScoped: false }
  );
  if (options.selectedSourceStage || safeText(auditCtx.subjectDomain).toLowerCase() === "main") {
    const sourceStage = normalizeStageCode(
      isReadonlySubtableInMain
        ? recordSourceNodes
        : (options.selectedSourceStage || recordSourceNodes || auditCtx.stage)
    );
    fillPayload.detail = {
      ...(fillPayload.detail || {}),
      valueSourceNodes: [sourceStage],
      selectedSourceStage: sourceStage,
      mainSnapshotSourceStage: sourceStage,
      mainPreviewSourceMode: "snapshot",
      calculatedMainPreview: false,
    };
  }
  let auditPayload = buildAuditDetailPayloadFromFillPayload(auditCtx, fillPayload);
  auditPayload = await enrichAuditPayloadWithMainPreview(
    auditCtx,
    flowSnapshot,
    auditPayload,
    { mainDetail: ctx.mainPreviewDetail },
    dependencies
  );
  if (options.decisionApprovalMode) {
    const aggregateHasS5Data = moduleHasS5Data || allRecords.some((record) =>
      normalizeStageCode(record && (record.node || record.stageCode || record.sourceStageCode)) === "S5" &&
        normalizeRecordStatus(record) !== "DRAFT"
    );
    auditPayload.detail.s5DecisionApproval = await buildS5DecisionApprovalMetaForContext(
      auditCtx,
      flowSnapshot,
      aggregateHasS5Data,
      aggregateHasS5Data ? "S5" : "S4",
      dependencies
    );
  }
  setAuditContextCache(auditCtx, auditPayload);
  return {
    ...auditPayload,
    moduleKey,
    moduleName,
    subjectIds,
    records: scopedRecords,
    loadedRecords: allRecords,
    subjectTreePayload,
    moduleLoadPlan: buildSubtableModuleLoadPlan(subjectTreePayload),
    patternList,
  };
}

export async function listSubtableAuditCellDraftsPayload(ctx, flowSnapshot) {
  if (flowSnapshot.flowId == null) return {};
  const subjectIds = resolveRecordQuerySubjectIds(ctx, ctx.subjectIds);
  const [rows, suggestions] = await Promise.all([
    queryAuditRecordsRows(ctx, flowSnapshot, {
      includeOwnerFilter: ctx.includeOwnerFilter === false ? false : undefined,
      subjectIds,
    }),
    queryReviewSuggestionRows(ctx, flowSnapshot, {
      includeReviewerFilter: ctx.includeReviewerFilter === false ? false : undefined,
    }),
  ]);
  return buildDraftMapFromRecords(ctx, rows, buildCellReviewIndex(suggestions), {
    includeOwnerPermissionFilter: ctx.includeOwnerPermissionFilter === false ? false : undefined,
  });
}

export async function listSubtableAuditAuxiliaryStatePayload(ctx, flowSnapshot) {
  const emptyModuleReviewState = { opinionMap: {}, submitMap: {}, timeline: [] };
  if (flowSnapshot.flowId == null) {
    return {
      cellDrafts: {},
      moduleReviewState: emptyModuleReviewState,
    };
  }
  const subjectIds = resolveRecordQuerySubjectIds(ctx, ctx.subjectIds);
  const [rows, suggestions] = await Promise.all([
    queryAuditRecordsRows(ctx, flowSnapshot, {
      includeOwnerFilter: ctx.includeOwnerFilter === false ? false : undefined,
      subjectIds,
    }),
    queryReviewSuggestionRows(ctx, flowSnapshot, {
      includeReviewerFilter: ctx.includeReviewerFilter === false ? false : undefined,
    }),
  ]);
  return {
    cellDrafts: buildDraftMapFromRecords(ctx, rows, buildCellReviewIndex(suggestions), {
      includeOwnerPermissionFilter: ctx.includeOwnerPermissionFilter === false ? false : undefined,
    }),
    moduleReviewState: buildModuleReviewStateFromSuggestions(suggestions),
  };
}

export async function listSubtableAuditCellHistoriesPayload(ctx, flowSnapshot) {
  if (flowSnapshot.flowId == null) return {};

  const nodes = resolveAuditHistoryNodes(ctx, flowSnapshot);
  const cache = getAuditContextCache(ctx);
  const subjectIds = Object.keys(cache.rowBySubjectId || {})
    .map((item) => toMaybeLong(item))
    .filter((item) => item != null);

  const records = nodes.length
    ? await queryAuditRecordsRows(ctx, flowSnapshot, {
        nodes,
        includeOwnerFilter: false,
        subjectIds,
      })
    : [];
  const suggestionGroups = nodes.length
    ? await Promise.all(nodes.map((node) =>
        queryReviewSuggestionRows(ctx, flowSnapshot, {
          node,
          includeReviewerFilter: false,
        })
      ))
    : [];

  return buildCellHistoryMap(
    ctx,
    records,
    suggestionGroups.reduce((acc, list) => acc.concat(list || []), [])
  );
}

export async function saveSubtableAuditCellDraftPayload(ctx, flowSnapshot) {
  try {
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法保存" };
    }
    const currentStage = normalizeStageCode(flowSnapshot.node || ctx.stageCode || ctx.stage);

    const cache = getAuditContextCache(ctx);
    const row = resolveAuditCacheRow(cache, ctx.rowId);
    if (!row) {
      return { ok: false, message: "未定位到科目行，无法保存" };
    }
    if (safeText(ctx.subjectDomain).toLowerCase() === "main" && !isMainPreviewRow(row)) {
      return { ok: false, message: "子表在主表审核页仅可查看，不能保存审核值" };
    }

    const isRndAmountCell = isRndAmountCellKey(ctx.cellKey) && isRndDoubleAmountSourceRow(row);
    const parsedCell = isRndAmountCell ? null : parseCellKey(ctx.cellKey);
    if (!isRndAmountCell && !parsedCell) {
      return { ok: false, message: "单元格标识无效" };
    }

    const years = (cache.dimensions && cache.dimensions.years) || [];
    const trims = (cache.dimensions && cache.dimensions.trims) || [];
    const yearLabel = isRndAmountCell ? "" : years[parsedCell.yearIndex] || "";
    const yearOnly = isRevenueYearOnlyRow(row);
    const trimName = isRndAmountCell ? "" : (yearOnly ? "" : trims[parsedCell.trimIndex] || "默认版型");
    const value = ctx.record && typeof ctx.record === "object" ? ctx.record.value : "";
    const targetMeta = isRndAmountCell
      ? readRowMatrixTargetMetaByCellKey(row, ctx.cellKey) || {}
      : readRowMatrixTargetMeta(
          row,
          yearLabel,
          trimName,
          parsedCell.yearIndex,
          parsedCell.trimIndex
        ) || {};
    const sourceRecordId = toMaybeLong(ctx.record && ctx.record.sourceRecordId);
    const targetRecordIds = normalizeTargetRecordIds(targetMeta);
    const targetSubmitIds = normalizeTargetSubmitIds(targetMeta);
    if (!targetRecordIds.length && !targetSubmitIds.length && sourceRecordId != null) {
      targetRecordIds.push(sourceRecordId);
    }

    const rowSubjectId = resolveMatrixSubjectId(row);
    const dataItem = buildProjectCostDataItem({
      projectCode: ctx.projectCode,
      subjectId: rowSubjectId,
      yearLabel,
      trimName,
      yearAggregateMode: isRndAmountCell
        ? getRndAmountAggregateModeByCellKey(ctx.cellKey)
        : undefined,
      unit: isRndAmountCell ? "万元" : row.unit,
      value,
      yearOnly,
    });
    if (!dataItem) {
      return { ok: false, message: "科目标识缺失，无法保存" };
    }

    const canCreateMainAuditValueWithoutTarget = canCreateTargetlessMainAuditValue(ctx, row, currentStage);
    const canCreateSubtableAuditValueWithoutTarget = canCreateTargetlessSubtableAuditValue(ctx, row, currentStage);
    if (
      !targetRecordIds.length &&
      !targetSubmitIds.length &&
      (canCreateMainAuditValueWithoutTarget || canCreateSubtableAuditValueWithoutTarget)
    ) {
      const targetlessRemarkPrefix = canCreateSubtableAuditValueWithoutTarget
        ? "SUBTABLE_AUDIT_TARGETLESS"
        : "MAIN_AUDIT_TARGETLESS";
      try {
        const targetPayload = await saveProjectCostSubmitWithDraftRetry(ctx, flowSnapshot, {
          flowId: flowSnapshot.flowId,
          saveMode: "DRAFT",
          submitRemark: `${targetlessRemarkPrefix}_${safeText(row.formulaKey || row.subjectId, "VALUE").toUpperCase()}`,
          dataItems: [dataItem],
        });
        appendSubmitPayloadTargetIds(targetRecordIds, targetSubmitIds, targetPayload);
      } catch (error) {
        if (!isProjectCostDraftUniqueConflict(error)) throw error;
      }
      if (!targetRecordIds.length && !targetSubmitIds.length) {
        const existingTargets = await resolveExistingTargetRefsForDataItems(ctx, flowSnapshot, [dataItem], {
          ownerScoped: false,
          nodes: currentStage,
        });
        appendUniqueIds(targetRecordIds, existingTargets.targetRecordIds);
        appendUniqueIds(targetSubmitIds, existingTargets.targetSubmitIds);
      }
      if (!targetRecordIds.length && !targetSubmitIds.length) {
        return {
          ok: false,
          message: canCreateSubtableAuditValueWithoutTarget
            ? "空白单元格审核记录定位失败，请刷新后重试"
            : "特殊主表科目已有记录定位失败，请刷新后重试",
        };
      }
    }
    if (!targetRecordIds.length && !targetSubmitIds.length) {
      return {
        ok: false,
        message: "缺少上一阶段提交记录，无法保存评审值",
      };
    }

    const payload = await saveProjectCostReviewApi({
      flowId: flowSnapshot.flowId,
      saveMode: "ARCHIVED",
      reviewerId: ctx.userId,
      reviewerName: safeText(ctx.userName, ctx.userId),
      targetRecordIds: targetRecordIds.length ? targetRecordIds : undefined,
      targetSubmitIds: targetSubmitIds.length ? targetSubmitIds : undefined,
      reviewConclusion: "PASS_WITH_ISSUES",
      reviewSuggestion: buildCellSuggestionText({
        rootSubjectId: safeText(row.rootSubjectId || row.__moduleRootId),
        moduleKey: safeText(row.rootSubjectId || row.__moduleRootId || row.subtable),
        moduleName: safeText(row.subtable),
        subjectDomain: ctx.subjectDomain,
        stageCode: ctx.stageCode,
        rowId: row.id,
        cellKey: ctx.cellKey,
        dimensionKey: isRndAmountCell
          ? safeText(targetMeta.dimensionKey || ctx.cellKey)
          : safeText(targetMeta.dimensionKey || `${yearLabel}__${trimName}`),
        yearLabel,
        modelYear: targetMeta.modelYear,
        yearAggregateMode: isRndAmountCell
          ? getRndAmountAggregateModeByCellKey(ctx.cellKey)
          : safeText(targetMeta.yearAggregateMode || resolveYearAggregateMode(yearLabel)),
        trimId: isRndAmountCell || yearOnly ? "" : safeText(targetMeta.trimId || trimName),
        trimName: isRndAmountCell || yearOnly ? "" : safeText(targetMeta.trimName || trimName),
        trimIndex: parsedCell ? parsedCell.trimIndex : undefined,
        targetRecordIds,
        targetSubmitIds,
        opinion: ctx.record && ctx.record.opinion,
        sourceType: ctx.record && ctx.record.sourceType,
        sourceRecordId,
        sourceReviewId: ctx.record && ctx.record.sourceReviewId,
        sourceStageCode: ctx.record && ctx.record.sourceStageCode,
      }),
      dataItems: [dataItem],
    });
    const data = unwrapBizPayload(payload) || {};

    return {
      ok: true,
      savedAt: nowText(),
      reviewId: data.reviewId,
      reviewDataSubmitId: data.reviewDataSubmitId,
      recordId: targetRecordIds[0],
      submitId: targetSubmitIds[0],
      affectedRecordIds: targetRecordIds.slice(),
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "保存失败"),
    };
  }
}

export async function listSubtableAuditModuleOpinionsPayload(ctx, flowSnapshot) {
  return (await requestModuleReviewState(ctx, flowSnapshot)).opinionMap;
}

export async function listSubtableAuditModuleReviewStatePayload(ctx, flowSnapshot) {
  return requestModuleReviewState(ctx, flowSnapshot);
}

export async function saveSubtableAuditModuleOpinionPayload(ctx, flowSnapshot) {
  try {
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法保存意见" };
    }

    const identity = resolveModuleIdentity(ctx);
    if (!identity.moduleKey) {
      return { ok: false, message: "模块名称缺失，无法保存意见" };
    }

    const suggestionRows = await queryReviewSuggestionRows(ctx, flowSnapshot);
    const entries = parseModuleReviewEntries(suggestionRows);
    const latestMap = pickLatestModuleEntries(entries);
    const existing = findModuleEntry(latestMap, identity);
    const moduleTargets = collectModuleTargetIds(ctx, identity);
    if (!moduleTargets.targetRecordIds.length && !moduleTargets.targetSubmitIds.length) {
      mergeTargetIds(moduleTargets, existing || {});
    }
    if (!moduleTargets.targetRecordIds.length && !moduleTargets.targetSubmitIds.length) {
      return { ok: false, message: "缺少模块上一阶段提交记录，无法保存意见" };
    }

    await saveProjectCostReviewApi({
      flowId: flowSnapshot.flowId,
      saveMode: "DRAFT",
      reviewerId: ctx.userId,
      reviewerName: safeText(ctx.userName, ctx.userId),
      targetRecordIds: moduleTargets.targetRecordIds.length
        ? moduleTargets.targetRecordIds
        : undefined,
      targetSubmitIds: moduleTargets.targetSubmitIds.length
        ? moduleTargets.targetSubmitIds
        : undefined,
      reviewConclusion: safeText(existing && existing.reviewConclusion, "PASS"),
      reviewSuggestion: buildModuleSuggestionText({
        rootSubjectId: identity.rootSubjectId,
        moduleKey: identity.moduleKey,
        moduleName: identity.moduleName,
        subjectDomain: ctx.subjectDomain,
        stageCode: ctx.stageCode,
        opinion: ctx.opinion,
        submitted: false,
      }),
    });

    return {
      ok: true,
      savedAt: nowText(),
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "保存意见失败"),
    };
  }
}

export async function listSubtableAuditModuleSubmitsPayload(ctx, flowSnapshot) {
  return (await requestModuleReviewState(ctx, flowSnapshot)).submitMap;
}

export async function submitSubtableAuditModulePayload(ctx, flowSnapshot) {
  try {
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法提交模块" };
    }

    const identity = resolveModuleIdentity(ctx);
    if (!identity.moduleKey) {
      return { ok: false, message: "模块名称缺失，无法提交" };
    }

    const suggestionRows = await queryReviewSuggestionRows(ctx, flowSnapshot);
    const entries = parseModuleReviewEntries(suggestionRows);
    const latestMap = pickLatestModuleEntries(entries);
    const existing = findModuleEntry(latestMap, identity);

    const cache = getAuditContextCache(ctx);
    const rowIdsInModule = Object.keys(cache.rowById).filter((rowId) => {
      const row = cache.rowById[rowId];
      const rowRootSubjectId = safeText(row && (row.rootSubjectId || row.__moduleRootId));
      const rowModuleName = safeText(row && (row.subtable || row.moduleName || row.rootSubjectName));
      if (identity.rootSubjectId && rowRootSubjectId) {
        return rowRootSubjectId === identity.rootSubjectId;
      }
      return rowModuleName && identity.moduleName && rowModuleName === identity.moduleName;
    });
    const subjectIds = rowIdsInModule
      .map((rowId) => {
        const row = resolveAuditCacheRow(cache, rowId);
        return toMaybeLong(resolveMatrixSubjectId(row));
      })
      .filter((item, index, list) => item != null && list.indexOf(item) === index);
    const draftMap = await buildDraftMapFromRecords(
      ctx,
      await queryAuditRecordsRows(ctx, flowSnapshot, { subjectIds })
    );
    const hasChangedCell = rowIdsInModule.some((rowId) => {
      const cells = draftMap[rowId] || {};
      return Object.keys(cells).length > 0;
    });
    const moduleTargets = collectModuleTargetIds(ctx, identity);
    if (!moduleTargets.targetRecordIds.length && !moduleTargets.targetSubmitIds.length) {
      mergeTargetIds(moduleTargets, existing || {});
    }
    if (!moduleTargets.targetRecordIds.length && !moduleTargets.targetSubmitIds.length) {
      return { ok: false, message: "缺少模块上一阶段提交记录，无法提交模块" };
    }

    await saveProjectCostReviewApi({
      flowId: flowSnapshot.flowId,
      saveMode: "ARCHIVED",
      reviewerId: ctx.userId,
      reviewerName: safeText(ctx.submittedName || ctx.userName, ctx.userId),
      targetRecordIds: moduleTargets.targetRecordIds.length
        ? moduleTargets.targetRecordIds
        : undefined,
      targetSubmitIds: moduleTargets.targetSubmitIds.length
        ? moduleTargets.targetSubmitIds
        : undefined,
      reviewConclusion: hasChangedCell ? "PASS_WITH_ISSUES" : "PASS",
      reviewSuggestion: buildModuleSuggestionText({
        rootSubjectId: identity.rootSubjectId,
        moduleKey: identity.moduleKey,
        moduleName: identity.moduleName,
        subjectDomain: ctx.subjectDomain,
        stageCode: ctx.stageCode,
        opinion: ctx.opinion,
        submitted: true,
      }),
    });

    const moduleReviewState = await requestModuleReviewState({ ...ctx, includeReviewerFilter: false }, flowSnapshot);
    return {
      ok: true,
      submitMap: moduleReviewState.submitMap,
      moduleReviewState,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "提交失败"),
    };
  }
}

export async function listSubtableAuditModuleSubmitTimelinePayload(ctx, flowSnapshot) {
  return (await requestModuleReviewState(ctx, flowSnapshot)).timeline;
}
