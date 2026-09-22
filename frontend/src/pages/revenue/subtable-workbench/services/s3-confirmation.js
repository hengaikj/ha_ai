import { saveProjectCostSubmit as saveProjectCostSubmitApi } from "@/api/system/expenses";
import {
  isRevenueYearOnlyRow,
  normalizeStageCode,
} from "../domain-config";
import {
  getRndAmountAggregateModeByCellKey,
  isRndAmountCellKey,
} from "../formula-engine";
import { isMaterialDesignCostPersistableColumn } from "../material-design-cost";
import {
  buildStageInputColumns,
  isColumnRequiredByInputScope,
  readRowMatrixColumnValue,
  writeRowMatrixColumnValue,
} from "./detail-matrix";
import {
  tryApplyRevenueFormulasToDetail,
} from "./detail-diagnostics";
import {
  cloneDetailForFormula,
  resolveNeededSalesVolumeFormulaSourceDetail,
} from "./formula-source";
import {
  buildProjectCostDataItem,
  dedupeProjectCostDataItems,
} from "./project-cost-data-item";
import {
  filterDataItemsByVisibleSubjectScope,
  queryProjectCostRecordsForNodes,
} from "./project-cost-record-query";
import {
  setAuditContextCache,
} from "./audit-context-cache";
import {
  queryAuditRecordsRows,
  queryReviewSuggestionRows,
} from "./audit-record-queries";
import {
  buildSubtableModuleLoadPlan,
} from "./module-load-plan";
import {
  mergeParentSubjectDisplayMap,
} from "./payload-normalizer";
import {
  buildRecordCellMap,
} from "./record-cell-map";
import {
  filterRecordsBySubjectIds,
} from "./record-utils";
import {
  buildModuleReviewStateFromSuggestions,
} from "./review-metadata";
import {
  hasS3ActionableCandidate,
  isS3CandidateSavedAsArchived,
  isS3CandidateSavedAsDraft,
  isStageInputRow,
  readRowS3Candidate,
  resolveS3CandidateSubmitValue,
} from "./stage-completion-summary";
import {
  fetchSubtableDetailForNode,
} from "./subtable-detail";
import {
  resolveOperationPermissionKey,
} from "./workbench-permissions";
import {
  buildRevenueTraceLabel,
  normalizeSubjectIdFilterList,
  readReviewerPermission,
  resolveMatrixSubjectId,
  resolveProjectDisplayName,
  safeText,
  toMaybeLong,
  unwrapBizPayload,
} from "./workbench-utils";

function buildS3CandidateDecision(originalValue, s2Entry, s3Entry) {
  if (!s3Entry) return s2Entry ? "accept_s2" : "keep_original";
  const s3Value = safeText(s3Entry.value);
  if (s2Entry && s3Value === safeText(s2Entry.value)) return "accept_s2";
  if (s3Value === safeText(originalValue)) return "keep_original";
  return "custom";
}

function clearRowMatrixRecordMeta(row = {}, column = {}) {
  if (!row || typeof row !== "object" || !column) return;
  const recordMap = row.cellRecordMap && typeof row.cellRecordMap === "object" ? row.cellRecordMap : null;
  if (!recordMap) return;
  if (column.cellKey && isRndAmountCellKey(column.cellKey)) {
    delete recordMap[column.cellKey];
    return;
  }
  const cellKey = `y${column.yearIndex}_t${column.trimIndex}`;
  const dimensionKey = `${safeText(column.yearLabel)}__${safeText(column.trimId || column.trimName)}`;
  delete recordMap[cellKey];
  delete recordMap[dimensionKey];
  if (safeText(column.trimName) && safeText(column.trimName) !== safeText(column.trimId)) {
    delete recordMap[`${safeText(column.yearLabel)}__${safeText(column.trimName)}`];
  }
}

function writeRowS3Candidate(row = {}, column = {}, candidate = {}) {
  if (!row || typeof row !== "object" || !column) return;
  const cellKey = column.cellKey && isRndAmountCellKey(column.cellKey)
    ? safeText(column.cellKey)
    : `y${column.yearIndex}_t${column.trimIndex}`;
  const dimensionKey = column.cellKey && isRndAmountCellKey(column.cellKey)
    ? cellKey
    : `${safeText(column.yearLabel)}__${safeText(column.trimId || column.trimName)}`;
  if (!row.s3CandidateMap || typeof row.s3CandidateMap !== "object") {
    row.s3CandidateMap = {};
  }
  row.s3CandidateMap[cellKey] = candidate;
  row.s3CandidateMap[dimensionKey] = candidate;
  if (safeText(column.trimName) && safeText(column.trimName) !== safeText(column.trimId)) {
    row.s3CandidateMap[`${safeText(column.yearLabel)}__${safeText(column.trimName)}`] = candidate;
  }
}

export function applyS3CandidatesToDetail(detail = {}, s1Map = {}, s2Map = {}, s3Map = {}, options = {}) {
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  rows.forEach((row) => {
    if (!isStageInputRow(row)) return;
    const columns = buildStageInputColumns(detail, row);
    columns.forEach((column) => {
      if (!isColumnRequiredByInputScope(row, column)) return;
      const cellKey = column.cellKey && isRndAmountCellKey(column.cellKey)
        ? safeText(column.cellKey)
        : `y${column.yearIndex}_t${column.trimIndex}`;
      const rowId = safeText(row && (row.id || row.rowId || row.subjectId));
      const s1Entry = s1Map[rowId] && s1Map[rowId][cellKey];
      const s2Entry = s2Map[rowId] && s2Map[rowId][cellKey];
      const s3Entry = s3Map[rowId] && s3Map[rowId][cellKey];
      const originalValue = s1Entry ? s1Entry.value : readRowMatrixColumnValue(row, column);
      const finalValue = s3Entry ? s3Entry.value : (s2Entry ? s2Entry.value : originalValue);
      const decision = buildS3CandidateDecision(originalValue, s2Entry, s3Entry);
      const candidate = {
        rowId,
        cellKey,
        dimensionKey: column.cellKey && isRndAmountCellKey(column.cellKey)
          ? cellKey
          : `${safeText(column.yearLabel)}__${safeText(column.trimId || column.trimName)}`,
        subjectId: safeText(row.subjectId || row.id),
        yearLabel: safeText(column.yearLabel),
        trimId: safeText(column.trimId || column.trimName),
        trimName: safeText(column.trimName || column.trimId),
        trimIndex: Number(column.trimIndex),
        originalValue: String(originalValue == null ? "" : originalValue),
        s2Value: s2Entry ? String(s2Entry.value == null ? "" : s2Entry.value) : "",
        hasS2Value: Boolean(s2Entry),
        s2Opinion: safeText(s2Entry && s2Entry.opinion),
        s2ReviewConclusion: safeText(s2Entry && s2Entry.reviewConclusion),
        s2ReviewStatus: safeText(s2Entry && s2Entry.reviewStatus),
        s2Reviewer: safeText(s2Entry && s2Entry.reviewer),
        s2ReviewerPermission: readReviewerPermission(s2Entry),
        s2RecordId: s2Entry && s2Entry.recordId,
        s2ReviewId: s2Entry && s2Entry.reviewId,
        s2ReviewDataSubmitId: s2Entry && s2Entry.reviewDataSubmitId,
        decision,
        finalValue: String(finalValue == null ? "" : finalValue),
        savedRecordId: s3Entry && s3Entry.recordId,
        savedRecordStatus: s3Entry && s3Entry.recordStatus,
        savedValue: s3Entry && String(s3Entry.value == null ? "" : s3Entry.value),
        savedRecordMeta: s3Entry && s3Entry.recordMeta,
        savedAt: s3Entry && s3Entry.time,
      };
      writeRowS3Candidate(row, column, candidate);
      writeRowMatrixColumnValue(row, column, candidate.finalValue, s3Entry && s3Entry.recordMeta);
      if (!s3Entry) {
        clearRowMatrixRecordMeta(row, column);
      }
    });
  });

  if (typeof options.applyFormulas === "function") {
    options.applyFormulas(detail, {
      sourceDetails: Array.isArray(options.sourceDetails) ? options.sourceDetails : [],
    });
  }
  return detail;
}

export function hasS3ConfirmationDetailRows(detail = {}) {
  return Boolean(
    detail &&
      detail.s3Confirmation === true &&
      Array.isArray(detail.rows) &&
      detail.rows.length
  );
}

export async function fetchS3ConfirmationPayload(ctx, flowSnapshot, options = {}) {
  const source = await fetchSubtableDetailForNode(ctx, flowSnapshot, "S1", {
    ownerScoped: false,
  });
  const detail = cloneDetailForFormula({
    ...source.detail,
    s3Confirmation: true,
  });

  const s3Ctx = {
    ...ctx,
    subjectDomain: "subtable",
    subjectApiMode: safeText(ctx.subjectApiMode || "auto", "auto"),
    stage: "S3",
    stageCode: "S3",
  };
  const cachePayload = {
    detail: {
      rows: detail.rows || [],
    },
    fillDetail: {
      dimensions: detail.dimensions || { years: [], trims: [] },
      trimOptions: Array.isArray(detail.trimOptions) ? detail.trimOptions : [],
      yearTrimConfig: detail.yearTrimConfig || {},
      parentSubjectDisplay: detail.parentSubjectDisplay || {},
    },
  };
  setAuditContextCache(s3Ctx, cachePayload);

  const subjectIds = (Array.isArray(detail.rows) ? detail.rows : [])
    .map((row) => toMaybeLong(row && row.subjectId))
    .filter((item, index, list) => item != null && list.indexOf(item) === index);
  const [s2Records, s2Suggestions, s3Records] = await Promise.all([
    queryAuditRecordsRows(s3Ctx, flowSnapshot, {
      node: "S2",
      includeOwnerFilter: false,
      subjectIds,
    }),
    queryReviewSuggestionRows(s3Ctx, flowSnapshot, {
      node: "S2",
      includeReviewerFilter: false,
    }),
    queryAuditRecordsRows(s3Ctx, flowSnapshot, {
      node: "S3",
      includeOwnerFilter: options.ownerScoped !== false,
      subjectIds,
    }),
  ]);

  const s1Map = buildRecordCellMap(s3Ctx, source.records, []);
  const s2Map = buildRecordCellMap(s3Ctx, s2Records, s2Suggestions, {
    requireDirectReviewLink: true,
  });
  const s2ModuleReviewState = buildModuleReviewStateFromSuggestions(s2Suggestions);
  // 同阶段按时间取最新，避免重新编辑后的 DRAFT 被旧 ARCHIVED 盖住
  const s3Map = buildRecordCellMap(s3Ctx, s3Records, [], { preferLatestByTime: true });
  const formulaSourceDetail = await resolveNeededSalesVolumeFormulaSourceDetail(s3Ctx, detail);
  applyS3CandidatesToDetail(detail, s1Map, s2Map, s3Map, {
    applyFormulas: tryApplyRevenueFormulasToDetail,
    sourceDetails: formulaSourceDetail ? [formulaSourceDetail] : [],
  });

  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S3");
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
      parentSubjectDisplay: mergeParentSubjectDisplayMap(detail.parentSubjectDisplay),
      subtableProgress: [],
      lastSavedAt: "-",
      lastSavedBy: "-",
      flowId: flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined,
      flowNode: currentStage,
      s3Confirmation: true,
      valueSourceNodes: ["S3", "S2", "S1"],
    },
    permissions: {
      viewer: ctx.userId,
      permissionKey: resolveOperationPermissionKey(ctx, ""),
    },
    subjectTreePayload: source.subjectTreePayload,
    s2ModuleReviewState,
  };
}

export async function fetchS3ConfirmationShellPayload(ctx, flowSnapshot, options = {}) {
  const source = await fetchSubtableDetailForNode(ctx, flowSnapshot, "S1", {
    ownerScoped: false,
    skipRecords: true,
  });
  const detail = cloneDetailForFormula({
    ...source.detail,
    s3Confirmation: true,
  });
  const s3Ctx = {
    ...ctx,
    subjectDomain: "subtable",
    subjectApiMode: safeText(ctx.subjectApiMode || "auto", "auto"),
    stage: "S3",
    stageCode: "S3",
  };
  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S3");
  const s2Suggestions = await queryReviewSuggestionRows(s3Ctx, flowSnapshot, {
    node: "S2",
    includeReviewerFilter: false,
  });
  const s2ModuleReviewState = buildModuleReviewStateFromSuggestions(s2Suggestions);
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
      parentSubjectDisplay: mergeParentSubjectDisplayMap(detail.parentSubjectDisplay),
      subtableProgress: [],
      lastSavedAt: "-",
      lastSavedBy: "-",
      flowId: flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined,
      flowNode: currentStage,
      s3Confirmation: true,
      valueSourceNodes: ["S3", "S2", "S1"],
    },
    permissions: {
      viewer: ctx.userId,
      permissionKey: resolveOperationPermissionKey(ctx, ""),
    },
    subjectTreePayload: source.subjectTreePayload,
    moduleLoadPlan: buildSubtableModuleLoadPlan(source.subjectTreePayload),
    patternList: Array.isArray(source.patternList) ? source.patternList : [],
    s2Suggestions,
    s2ModuleReviewState,
    ownerScoped: options.ownerScoped,
  };
}

export async function fetchS3ConfirmationModulePayload(ctx, flowSnapshot, _options = {}) {
  const subjectIds = normalizeSubjectIdFilterList(ctx.subjectIds);
  const moduleName = safeText(ctx.moduleName || ctx.rootSubjectName, "未命名子表");
  const moduleKey = safeText(ctx.moduleKey || ctx.key || moduleName);
  const s3Ctx = {
    ...ctx,
    subjectDomain: "subtable",
    subjectApiMode: safeText(ctx.subjectApiMode || "auto", "auto"),
    stage: "S3",
    stageCode: "S3",
  };
  const loaded = ctx.loadedModuleRecords && typeof ctx.loadedModuleRecords === "object"
    ? ctx.loadedModuleRecords
    : {};
  const [s1Records, s2Records, s3Records] = await Promise.all([
    queryProjectCostRecordsForNodes(
      {
        ...s3Ctx,
        stage: "S1",
        stageCode: "S1",
      },
      flowSnapshot,
      false,
      "S1",
      {
        subjectIds,
        traceLabel: buildRevenueTraceLabel(
          s3Ctx,
          `记录: S3子表 ${moduleName} S1 records/query subjectIds=${subjectIds.join(",") || "-"}`
        ),
      }
    ),
    queryAuditRecordsRows(s3Ctx, flowSnapshot, {
      node: "S2",
      includeOwnerFilter: false,
      subjectIds,
      throwOnError: true,
      traceLabel: buildRevenueTraceLabel(
        s3Ctx,
        `记录: S3子表 ${moduleName} S2 records/query subjectIds=${subjectIds.join(",") || "-"}`
      ),
    }),
    queryAuditRecordsRows(s3Ctx, flowSnapshot, {
      node: "S3",
      includeOwnerFilter: ctx.ownerScoped !== false,
      subjectIds,
      throwOnError: true,
      traceLabel: buildRevenueTraceLabel(
        s3Ctx,
        `记录: S3子表 ${moduleName} S3 records/query subjectIds=${subjectIds.join(",") || "-"}`
      ),
    }),
  ]);
  const allS1Records = (Array.isArray(loaded.s1Records) ? loaded.s1Records : []).concat(
    filterRecordsBySubjectIds(s1Records, subjectIds)
  );
  const allS2Records = (Array.isArray(loaded.s2Records) ? loaded.s2Records : []).concat(
    filterRecordsBySubjectIds(s2Records, subjectIds)
  );
  const allS3Records = (Array.isArray(loaded.s3Records) ? loaded.s3Records : []).concat(
    filterRecordsBySubjectIds(s3Records, subjectIds)
  );
  const source = await fetchSubtableDetailForNode(ctx, flowSnapshot, "S1", {
    ownerScoped: false,
    records: allS1Records,
    patternList: ctx.patternList,
  });
  const detail = cloneDetailForFormula({
    ...source.detail,
    s3Confirmation: true,
  });
  const cachePayload = {
    detail: {
      rows: detail.rows || [],
    },
    fillDetail: {
      dimensions: detail.dimensions || { years: [], trims: [] },
      trimOptions: Array.isArray(detail.trimOptions) ? detail.trimOptions : [],
      yearTrimConfig: detail.yearTrimConfig || {},
      parentSubjectDisplay: detail.parentSubjectDisplay || {},
    },
  };
  setAuditContextCache(s3Ctx, cachePayload);
  const s2Suggestions = Array.isArray(ctx.s2Suggestions) ? ctx.s2Suggestions : [];
  const s1Map = buildRecordCellMap(s3Ctx, allS1Records, []);
  const s2Map = buildRecordCellMap(s3Ctx, allS2Records, s2Suggestions, {
    requireDirectReviewLink: true,
  });
  const s2ModuleReviewState = buildModuleReviewStateFromSuggestions(s2Suggestions);
  // 同阶段按时间取最新，避免重新编辑后的 DRAFT 被旧 ARCHIVED 盖住
  const s3Map = buildRecordCellMap(s3Ctx, allS3Records, [], { preferLatestByTime: true });
  const formulaSourceDetail = await resolveNeededSalesVolumeFormulaSourceDetail(s3Ctx, detail);
  applyS3CandidatesToDetail(detail, s1Map, s2Map, s3Map, {
    applyFormulas: tryApplyRevenueFormulasToDetail,
    sourceDetails: formulaSourceDetail ? [formulaSourceDetail] : [],
  });
  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S3");
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
      parentSubjectDisplay: mergeParentSubjectDisplayMap(detail.parentSubjectDisplay),
      subtableProgress: [],
      lastSavedAt: "-",
      lastSavedBy: "-",
      flowId: flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined,
      flowNode: currentStage,
      s3Confirmation: true,
      valueSourceNodes: ["S3", "S2", "S1"],
    },
    permissions: {
      viewer: ctx.userId,
      permissionKey: resolveOperationPermissionKey(ctx, ""),
    },
    subjectTreePayload: source.subjectTreePayload,
    moduleLoadPlan: buildSubtableModuleLoadPlan(source.subjectTreePayload),
    moduleKey,
    moduleName,
    subjectIds,
    moduleRecords: {
      s1Records: filterRecordsBySubjectIds(s1Records, subjectIds),
      s2Records: filterRecordsBySubjectIds(s2Records, subjectIds),
      s3Records: filterRecordsBySubjectIds(s3Records, subjectIds),
    },
    loadedModuleRecords: {
      s1Records: allS1Records,
      s2Records: allS2Records,
      s3Records: allS3Records,
    },
    s2ModuleReviewState,
  };
}

function shouldSaveS3ConfirmationCandidate(candidate = {}) {
  const finalValue = safeText(candidate.finalValue);
  if (!finalValue) return false;
  if (!isS3CandidateSavedAsArchived(candidate)) return true;
  return finalValue !== safeText(candidate.savedValue);
}

export function buildS3ConfirmationDataItems(ctx, detail = {}) {
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const items = [];
  rows.forEach((row) => {
    if (!isStageInputRow(row)) return;
    const columns = buildStageInputColumns(detail, row);
    const yearOnly = isRevenueYearOnlyRow(row);
    columns.forEach((column) => {
      if (
        !isColumnRequiredByInputScope(row, column) &&
        !isMaterialDesignCostPersistableColumn(row, column)
      ) {
        return;
      }
      const candidate = readRowS3Candidate(row, column);
      const value = resolveS3CandidateSubmitValue(row, column, candidate);
      if (value === "") return;
      if (hasS3ActionableCandidate(candidate) && !shouldSaveS3ConfirmationCandidate(candidate)) return;
      const item = buildProjectCostDataItem({
        projectCode: ctx.projectCode,
        subjectId: resolveMatrixSubjectId(row),
        id: isS3CandidateSavedAsDraft(candidate) ? toMaybeLong(candidate && candidate.savedRecordId) : undefined,
        yearLabel: column.yearLabel,
        yearAggregateMode: column.cellKey && isRndAmountCellKey(column.cellKey)
          ? getRndAmountAggregateModeByCellKey(column.cellKey)
          : undefined,
        trimName: yearOnly ? "" : safeText(column.trimName || column.trimId, "默认版型"),
        unit: row.unit,
        value,
        yearOnly,
      });
      if (item) items.push(item);
    });
  });
  return dedupeProjectCostDataItems(items);
}

export async function saveS3ConfirmationSnapshot(ctx, flowSnapshot, detail = {}) {
  const dataItems = buildS3ConfirmationDataItems(ctx, detail);
  const scopedDataItems = filterDataItemsByVisibleSubjectScope(ctx, dataItems);
  if (!scopedDataItems.length) return { savedCount: 0, skippedCount: dataItems.length };
  const payload = await saveProjectCostSubmitApi({
    flowId: flowSnapshot.flowId,
    saveMode: "ARCHIVED",
    submitRemark: "AUTO_SUBTABLE_FROM_S3_CONFIRM",
    dataItems: scopedDataItems,
  }, `提交: S3二次确认生成子表快照 submits/save | items=${scopedDataItems.length}`);
  const data = unwrapBizPayload(payload) || {};
  return {
    savedCount: scopedDataItems.length,
    skippedCount: dataItems.length - scopedDataItems.length,
    submitId: data.submitId,
    affectedRecordIds: Array.isArray(data.affectedRecordIds) ? data.affectedRecordIds : [],
  };
}
