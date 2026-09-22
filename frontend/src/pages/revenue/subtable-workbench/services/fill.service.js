import {
  rejectProjectCostRecordsToDraft as rejectProjectCostRecordsToDraftApi,
  saveProjectCostReview as saveProjectCostReviewApi,
} from "@/api/system/expenses";
import {
  isRevenueYearOnlyRow,
  normalizeStageCode,
} from "../domain-config";
import {
  getRndAmountAggregateModeByCellKey,
  isRndAmountCellKey,
} from "../formula-engine";
import s1WorkflowGuards from "../s1-workflow-guards";
import {
  queryReviewSuggestionRows,
} from "./audit-record-queries";
import {
  saveDetailSnapshot,
} from "./detail-snapshot";
import { ensureProjectCostFlow } from "./flow-context";
import { buildSubtableFillPayloadFromRecords } from "./fill-payload";
import {
  buildHistoryDraftImportPlan,
} from "./history-draft-import";
import {
  buildTrimOptions,
  requestProjectPatternList,
} from "./project-context";
import {
  filterDataItemsByVisibleSubjectScope,
  isVisibleUploadSubject,
  queryValueSourceRecords,
} from "./project-cost-record-query";
import {
  buildProjectCostDataItem,
  buildProjectCostDataItemFromRecord,
} from "./project-cost-data-item";
import {
  saveProjectCostSubmitWithDraftRetry,
} from "./project-cost-submit";
import {
  buildCellSuggestionText,
  buildFillCellOpinionMapFromSuggestions,
  buildModuleSuggestionText,
  buildSubjectNoteSuggestionText,
  parseSubjectNoteEntries,
  pickLatestSubjectNoteMap,
} from "./review-metadata";
import {
  buildS3OwnerSubmitContext,
} from "./stage-completion-summary";
import {
  buildDetailRowsFromPermissionTree,
} from "./detail-builder";
import {
  tryApplyRevenueFormulasToDetail,
} from "./detail-diagnostics";
import {
  capturePersistedComputedCellSnapshots,
  restorePersistedComputedFormulaOverrides,
} from "./detail-draft";
import {
  mergeParentSubjectDisplayMap,
} from "./payload-normalizer";
import {
  resolveFillSubmitNextStage,
  resolveSubmittedValueSourceNodes,
  resolveStageLabel,
} from "./stage-labels";
import {
  buildSubjectIdFilterFromTree,
  getSubjectNodes,
} from "./subject-tree";
import {
  requestStrictPermissionTree,
  requestSubjectTreePreferPermission,
} from "./subject-tree-request";
import {
  resolveOperationPermissionKey,
} from "./workbench-permissions";
import {
  normalizeTargetRecordIds,
  normalizeTargetSubmitIds,
} from "./record-utils";
import {
  buildRevenueTraceLabel,
  nowText,
  resolveMatrixSubjectId,
  resolveProjectDisplayName,
  safeText,
  toMaybeLong,
  unwrapBizPayload,
} from "./workbench-utils";

const FILL_OPINION_SOURCE_TYPES = Object.freeze(["fill_opinion", "s3_confirm_opinion"]);
const {
  assertS1SubtableRecordTargets,
  assertS1SubtableTargets,
  collectAffectedRecordIds,
  normalizeS1SubtableTargets,
} = s1WorkflowGuards;

export async function fetchRealSubtableFillPayload(ctx, options = {}) {
  const { ownerScoped = true } = options;

  const subjectTreePayload = await requestSubjectTreePreferPermission(ctx);
  if (!getSubjectNodes(subjectTreePayload).length) {
    throw new Error("模板和授权过滤后无可用科目，无法打开填报工作台");
  }

  const [flowSnapshot, patternList] = await Promise.all([
    ensureProjectCostFlow(ctx, { createIfMissing: false }),
    requestProjectPatternList(ctx),
  ]);

  const subjectIds = buildSubjectIdFilterFromTree(subjectTreePayload);
  const preferredRecords = await queryValueSourceRecords(ctx, flowSnapshot, ownerScoped, {
    subjectIds,
  });
  return buildSubtableFillPayloadFromRecords(ctx, subjectTreePayload, flowSnapshot, patternList, preferredRecords, {
    ownerScoped,
  });
}

export async function fetchAllSubtableFillPayload(ctx) {
  return fetchRealSubtableFillPayload(
    {
      ...ctx,
      subjectDomain: "subtable",
      subjectApiMode: "auto",
    },
    { ownerScoped: false }
  );
}

export async function fetchRealSubtableFillShellPayload(ctx, options = {}) {
  const { ownerScoped = true } = options;

  const subjectTreePayload = await requestSubjectTreePreferPermission(ctx);
  if (!getSubjectNodes(subjectTreePayload).length) {
    throw new Error("模板和授权过滤后无可用科目，无法打开填报壳层");
  }

  const [flowSnapshot, patternList] = await Promise.all([
    ensureProjectCostFlow(ctx, { createIfMissing: false }),
    requestProjectPatternList(ctx),
  ]);

  return buildSubtableFillPayloadFromRecords(ctx, subjectTreePayload, flowSnapshot, patternList, [], {
    ownerScoped,
  });
}

export async function fetchStrictPermissionSubjectPayload(ctx) {
  try {
    const payload = await requestStrictPermissionTree(ctx);
    return getSubjectNodes(payload).length ? payload : null;
  } catch (_error) {
    return null;
  }
}

export async function fetchStrictSubtableFillPayload(ctx, flowSnapshot, options = {}) {
  const subjectTreePayload = await fetchStrictPermissionSubjectPayload(ctx);
  if (!subjectTreePayload) return null;
  const patternList = await requestProjectPatternList(ctx);
  const valueSourceNodes = resolveSubmittedValueSourceNodes(ctx, flowSnapshot);
  const subjectIds = buildSubjectIdFilterFromTree(subjectTreePayload);
  const preferredRecords = await queryValueSourceRecords(ctx, flowSnapshot, options.ownerScoped !== false, {
    subjectIds,
  });
  const trimOptions = buildTrimOptions(patternList, preferredRecords);
  const detailData = buildDetailRowsFromPermissionTree(
    getSubjectNodes(subjectTreePayload),
    preferredRecords,
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
  };
}

function getExecuteStageSubmitFlow(dependencies = {}) {
  const executeStageSubmitFlow = dependencies.executeStageSubmitFlow;
  if (typeof executeStageSubmitFlow !== "function") {
    throw new Error("缺少流程提交器，无法提交流程");
  }
  return executeStageSubmitFlow;
}

export async function saveSubtableFillCellPayload(ctx) {
  try {
    const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法保存" };
    }

    const subjectId = resolveMatrixSubjectId(ctx);
    const dataItem = buildProjectCostDataItem({
      projectCode: ctx.projectCode,
      subjectId,
      id: ctx.recordId,
      yearLabel: ctx.year,
      yearAggregateMode: ctx.yearAggregateMode,
      trimName: isRevenueYearOnlyRow(ctx) ? "" : safeText(ctx.trimName || ctx.trimId, "默认版型"),
      unit: ctx.unit,
      value: ctx.value,
      yearOnly: isRevenueYearOnlyRow(ctx),
    });
    if (!dataItem) {
      return { ok: false, message: "科目标识缺失，无法保存" };
    }
    if (!isVisibleUploadSubject(ctx, dataItem.subjectId)) {
      return { ok: false, message: "当前科目不在页面可见范围，无法保存" };
    }
    const shouldLogConsumerCreditSave = [
      ctx.fullNamePath,
      ctx.subjectPath,
      ctx.subject,
      ctx.subjectName,
    ].some((item) => safeText(item).includes("消费信贷"));
    if (shouldLogConsumerCreditSave) {
       
      console.groupCollapsed("[Revenue Save Debug] 消费信贷保存接口 - 请求");
       
      console.log("context", {
        projectId: ctx.projectId,
        flowId: flowSnapshot.flowId,
        stage: ctx.stage,
        permissionKey: resolveOperationPermissionKey(ctx, ""),
        userId: ctx.userId,
        rowId: ctx.rowId,
        subjectId,
        fullNamePath: ctx.fullNamePath,
        subjectPath: ctx.subjectPath,
        year: ctx.year,
        trimId: ctx.trimId,
        trimName: ctx.trimName,
        recordId: ctx.recordId,
      });
       
      console.log("dataItem", dataItem);
       
      console.groupEnd();
    }

    const payload = await saveProjectCostSubmitWithDraftRetry(ctx, flowSnapshot, {
      flowId: flowSnapshot.flowId,
      saveMode: "DRAFT",
      submitRemark: "CELL_SAVE",
      dataItems: [dataItem],
    });

    const data = unwrapBizPayload(payload) || {};
    if (shouldLogConsumerCreditSave) {
       
      console.groupCollapsed("[Revenue Save Debug] 消费信贷保存接口 - 返回");
       
      console.log("rawPayload", payload);
       
      console.log("data", data);
       
      console.groupEnd();
    }
    const affectedRecordIds = collectAffectedRecordIds(data);
    return {
      ok: true,
      savedAt: nowText(),
      submitId: data.submitId,
      flowId: data.flowId || flowSnapshot.flowId,
      affectedRecordIds,
      recordId: affectedRecordIds[0],
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "保存失败"),
    };
  }
}

export async function saveSubtableFillCellsPayload(ctx) {
  try {
    const cells = Array.isArray(ctx.cells) ? ctx.cells : [];
    if (!cells.length) {
      return { ok: true, savedAt: nowText(), savedCount: 0 };
    }

    const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法保存" };
    }

    const dataItems = cells.map((cell) => buildProjectCostDataItem({
      projectCode: ctx.projectCode,
      subjectId: resolveMatrixSubjectId(cell),
      id: cell && cell.recordId,
      yearLabel: cell && cell.year,
      yearAggregateMode: cell && cell.yearAggregateMode,
      trimName: safeText(cell && (cell.trimName || cell.trimId), "默认版型"),
      unit: cell && cell.unit,
      value: cell && cell.value,
      yearOnly: Boolean(cell && cell.yearOnly),
    })).filter(Boolean);
    const scopedDataItems = filterDataItemsByVisibleSubjectScope(ctx, dataItems);
    if (!scopedDataItems.length) {
      return {
        ok: false,
        message: dataItems.length
          ? "当前操作没有页面可见范围内的可保存单元格"
          : "没有可保存的复制单元格",
      };
    }

    const payload = await saveProjectCostSubmitWithDraftRetry(ctx, flowSnapshot, {
      flowId: flowSnapshot.flowId,
      saveMode: "DRAFT",
      submitRemark: safeText(ctx.submitRemark, "BATCH_CELL_SAVE"),
      dataItems: scopedDataItems,
    });

    const data = unwrapBizPayload(payload) || {};
    const affectedRecordIds = collectAffectedRecordIds(data);
    return {
      ok: true,
      savedAt: nowText(),
      submitId: data.submitId,
      flowId: data.flowId || flowSnapshot.flowId,
      savedCount: scopedDataItems.length,
      skippedCount: dataItems.length - scopedDataItems.length,
      affectedRecordIds,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "保存失败"),
    };
  }
}

export async function saveS3ConfirmationCellPayload(ctx) {
  try {
    const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法保存确认值" };
    }

    const currentStage = normalizeStageCode(flowSnapshot.node || ctx.stage || "S3");
    if (currentStage !== "S3") {
      return { ok: false, message: `当前流程已在 ${resolveStageLabel(currentStage)}，不能保存 S3 业务经理二次确认` };
    }
    if (!resolveOperationPermissionKey(ctx, "")) {
      return { ok: false, message: "当前账号缺少 S3 二次确认保存权限" };
    }
    const submitCtx = buildS3OwnerSubmitContext(ctx);

    const subjectId = resolveMatrixSubjectId(ctx);
    const cellKey = safeText(ctx.cellKey);
    const isRndAmountCell = isRndAmountCellKey(cellKey);
    const yearAggregateMode = isRndAmountCell
      ? safeText(ctx.yearAggregateMode) || getRndAmountAggregateModeByCellKey(cellKey)
      : ctx.yearAggregateMode;
    const dataItem = buildProjectCostDataItem({
      projectCode: submitCtx.projectCode,
      subjectId,
      id: ctx.recordId,
      yearLabel: isRndAmountCell ? "" : ctx.year,
      yearAggregateMode,
      trimName: isRndAmountCell || isRevenueYearOnlyRow(ctx)
        ? ""
        : safeText(ctx.trimName || ctx.trimId, "默认版型"),
      unit: isRndAmountCell ? safeText(ctx.unit, "万元") : ctx.unit,
      value: ctx.value,
      yearOnly: isRndAmountCell ? false : isRevenueYearOnlyRow(ctx),
    });
    if (!dataItem) {
      if (subjectId == null) {
        return { ok: false, message: "科目标识缺失，无法保存确认值" };
      }
      return {
        ok: false,
        message: isRndAmountCell
          ? "研发投资总额列保存参数无效，请刷新后重试"
          : "确认值维度无效，无法保存确认值",
      };
    }
    if (!isVisibleUploadSubject(submitCtx, dataItem.subjectId)) {
      return { ok: false, message: "当前科目不在页面可见范围，无法保存确认值" };
    }

    // S3 单元格值节点级共享：跨归属人复用同一 DRAFT，避免每人一份导致互不可见
    const payload = await saveProjectCostSubmitWithDraftRetry(submitCtx, flowSnapshot, {
      flowId: flowSnapshot.flowId,
      saveMode: "DRAFT",
      submitRemark: `S3_CONFIRM_${safeText(ctx.decision, "custom").toUpperCase()}`,
      dataItems: [dataItem],
      draftResolveOwnerScoped: false,
      draftForceReplaceId: true,
    });

    const data = unwrapBizPayload(payload) || {};
    const affectedRecordIds = collectAffectedRecordIds(data);
    return {
      ok: true,
      savedAt: nowText(),
      submitId: data.submitId,
      flowId: data.flowId || flowSnapshot.flowId,
      affectedRecordIds,
      recordId: affectedRecordIds[0],
      recordStatus: "DRAFT",
      savedValue: safeText(ctx.value),
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "S3 业务经理二次确认值保存失败"),
    };
  }
}

export async function listSubtableFillCellOpinionsPayload(ctx) {
  const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
  if (flowSnapshot.flowId == null) {
    return {
      fillOpinionMap: {},
      s3OpinionMap: {},
    };
  }
  const suggestions = await queryReviewSuggestionRows(ctx, flowSnapshot, {
    includeReviewerFilter: false,
  });
  return buildFillCellOpinionMapFromSuggestions(suggestions);
}

export async function saveSubtableFillCellOpinionPayload(ctx) {
  try {
    const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法保存单元格意见" };
    }

    const rowId = safeText(ctx.rowId || ctx.subjectId);
    const cellKey = safeText(ctx.cellKey);
    if (!rowId || !cellKey) {
      return { ok: false, message: "单元格标识缺失，无法保存意见" };
    }

    const targetRecordIds = normalizeTargetRecordIds(ctx);
    const targetSubmitIds = normalizeTargetSubmitIds(ctx);
    const recordId = toMaybeLong(ctx.recordId || ctx.targetRecordId);
    const submitId = toMaybeLong(ctx.submitId || ctx.targetSubmitId);
    if (recordId != null && !targetRecordIds.includes(recordId)) targetRecordIds.push(recordId);
    if (submitId != null && !targetSubmitIds.includes(submitId)) targetSubmitIds.push(submitId);
    if (!targetRecordIds.length && !targetSubmitIds.length) {
      return { ok: false, message: "请先保存单元格值，再填写意见" };
    }

    const sourceType = FILL_OPINION_SOURCE_TYPES.includes(safeText(ctx.sourceType).toLowerCase())
      ? safeText(ctx.sourceType).toLowerCase()
      : "fill_opinion";
    const saveMode = safeText(ctx.saveMode, "DRAFT");
    const opinion = String(ctx.opinion == null ? "" : ctx.opinion);
    const payload = await saveProjectCostReviewApi({
      flowId: flowSnapshot.flowId,
      saveMode,
      reviewerId: ctx.userId,
      reviewerName: safeText(ctx.actor || ctx.userName, ctx.userId),
      targetRecordIds: targetRecordIds.length ? targetRecordIds : undefined,
      targetSubmitIds: targetSubmitIds.length ? targetSubmitIds : undefined,
      reviewConclusion: safeText(opinion) ? "PASS_WITH_ISSUES" : "PASS",
      reviewSuggestion: buildCellSuggestionText({
        rootSubjectId: safeText(ctx.rootSubjectId || ctx.moduleKey),
        moduleKey: safeText(ctx.moduleKey || ctx.rootSubjectId || ctx.moduleName),
        moduleName: safeText(ctx.moduleName),
        subjectDomain: safeText(ctx.subjectDomain || "subtable"),
        stageCode: safeText(ctx.stageCode || ctx.stage),
        rowId,
        cellKey,
        dimensionKey: safeText(ctx.dimensionKey),
        yearLabel: safeText(ctx.yearLabel || ctx.year),
        modelYear: ctx.modelYear,
        yearAggregateMode: safeText(ctx.yearAggregateMode),
        trimId: safeText(ctx.trimId),
        trimName: safeText(ctx.trimName),
        trimIndex: Number.isInteger(ctx.trimIndex) ? Number(ctx.trimIndex) : undefined,
        targetRecordIds,
        targetSubmitIds,
        opinion,
        sourceType,
        sourceRecordId: recordId,
        sourceStageCode: safeText(ctx.sourceStageCode || ctx.stageCode || ctx.stage),
      }),
    });
    const data = unwrapBizPayload(payload) || {};
    return {
      ok: true,
      savedAt: nowText(),
      reviewId: data.reviewId,
      reviewDataSubmitId: data.reviewDataSubmitId,
      opinion,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "保存单元格意见失败"),
    };
  }
}

/** 查询 S1 科目说明（按 subjectId 取最新 ARCHIVED） */
export async function listSubtableSubjectNotesPayload(ctx) {
  const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
  if (!flowSnapshot || flowSnapshot.flowId == null) {
    return {};
  }
  const suggestions = await queryReviewSuggestionRows(ctx, flowSnapshot, {
    node: safeText(ctx.stageCode || ctx.stage, "S1"),
    includeReviewerFilter: false,
  });
  return pickLatestSubjectNoteMap(parseSubjectNoteEntries(suggestions));
}

/** 保存/提交 S1 科目说明（可不挂 record/submit） */
export async function saveSubtableSubjectNotePayload(ctx) {
  try {
    const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法保存科目说明" };
    }
    const subjectId = safeText(ctx.subjectId);
    if (!subjectId) {
      return { ok: false, message: "科目 ID 缺失，无法保存科目说明" };
    }
    const noteText = String(
      ctx.noteText == null ? (ctx.opinion == null ? "" : ctx.opinion) : ctx.noteText
    ).trim();
    if (!noteText) {
      return { ok: false, message: "请填写科目说明后再提交" };
    }
    const stageCode = safeText(ctx.stageCode || ctx.stage, "S1");
    const payload = await saveProjectCostReviewApi({
      flowId: flowSnapshot.flowId,
      saveMode: "ARCHIVED",
      reviewerId: ctx.userId,
      reviewerName: safeText(ctx.actor || ctx.userName, ctx.userId),
      reviewConclusion: "PASS",
      reviewSuggestion: buildSubjectNoteSuggestionText({
        subjectId,
        subjectName: safeText(ctx.subjectName),
        subjectPath: ctx.subjectPath,
        rootSubjectId: safeText(ctx.rootSubjectId || ctx.moduleKey),
        moduleKey: safeText(ctx.moduleKey || ctx.rootSubjectId || ctx.moduleName),
        moduleName: safeText(ctx.moduleName),
        subjectDomain: safeText(ctx.subjectDomain, "subtable"),
        stageCode,
        opinion: noteText,
        submitted: true,
      }),
    });
    const data = unwrapBizPayload(payload) || {};
    return {
      ok: true,
      savedAt: nowText(),
      reviewId: data.reviewId,
      noteText,
      subjectId,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "保存科目说明失败"),
    };
  }
}

export async function saveSubtableFillDraftPayload(ctx) {
  try {
    const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法保存草稿" };
    }

    const snapshot = await saveDetailSnapshot(ctx, flowSnapshot, {
      saveMode: "DRAFT",
      submitRemark: safeText(ctx.submitRemark, "DRAFT_SAVE"),
    });

    return {
      ok: true,
      savedAt: nowText(),
      savedCount: snapshot.savedCount,
      skippedCount: snapshot.skippedCount,
      submitId: snapshot.submitId,
      batchNo: snapshot.batchNo,
      affectedRecordIds: snapshot.affectedRecordIds || [],
      affectedRecords: snapshot.affectedRecords || [],
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "草稿保存失败"),
    };
  }
}

export async function previewSubtableHistoryImportPayload(ctx) {
  try {
    return await buildHistoryDraftImportPlan(ctx);
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "草稿预览失败"),
    };
  }
}

export async function applySubtableHistoryImportPayload(ctx) {
  try {
    const plan = await buildHistoryDraftImportPlan(ctx);
    if (!plan || !plan.ok) {
      return plan || { ok: false, message: "草稿导入失败" };
    }
    const importableItems = (Array.isArray(plan.items) ? plan.items : []).filter((item) => item.importable);
    if (!importableItems.length) {
      return {
        ...plan,
        savedAt: nowText(),
        savedCount: 0,
        affectedRecordIds: [],
      };
    }
    const overwriteCount = importableItems.filter((item) => item.willOverwrite).length;
    if (overwriteCount > 0 && !ctx.overwriteExisting) {
      return { ok: false, message: "存在当前已有值，请确认覆盖后再导入" };
    }
    const dataItems = importableItems
      .map((item) => buildProjectCostDataItemFromRecord(item.sourceRecord, item.currentDraftRecord))
      .filter((item) => item && item.subjectId != null && safeText(item.rawValue));
    const scopedDataItems = filterDataItemsByVisibleSubjectScope(ctx, dataItems);
    if (!scopedDataItems.length) {
      return {
        ok: false,
        message: dataItems.length
          ? "当前操作没有页面可见范围内的可保存草稿数据"
          : "没有可保存的草稿数据",
      };
    }
    const payload = await saveProjectCostSubmitWithDraftRetry(ctx, plan.targetFlow, {
      flowId: plan.targetFlow.flowId,
      saveMode: "DRAFT",
      submitRemark: "PREVIOUS_DRAFT_IMPORT",
      dataItems: scopedDataItems,
    });
    const response = unwrapBizPayload(payload) || {};
    return {
      ...plan,
      ok: true,
      savedAt: nowText(),
      savedCount: scopedDataItems.length,
      skippedCount: dataItems.length - scopedDataItems.length,
      overwriteCount,
      submitId: response.submitId,
      batchNo: response.batchNo,
      affectedRecordIds: response.affectedRecordIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "草稿导入失败"),
    };
  }
}

export async function submitSubtableFillSecondaryConfirmPayload(ctx, dependencies = {}) {
  try {
    const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法提交" };
    }

    const currentStage = safeText(flowSnapshot.node || ctx.stage, "S1").toUpperCase();
    if (currentStage === "S1") {
      const snapshot = await saveDetailSnapshot(ctx, flowSnapshot, {
        saveMode: "ARCHIVED",
        submitRemark: "S1_OWNER_SUBMIT",
      });
      return {
        ok: true,
        result: {
          ...snapshot,
          submittedAt: nowText(),
          nextStage: currentStage,
          flowAdvanced: false,
        },
      };
    }

    const nextStage = resolveFillSubmitNextStage(currentStage);
    await saveDetailSnapshot(ctx, flowSnapshot, {
      saveMode: "ARCHIVED",
      submitRemark: "SUBMIT_WITH_FRONTEND_FORMULA",
    });

    const flowResult = await getExecuteStageSubmitFlow(dependencies)(
      ctx,
      flowSnapshot,
      nextStage,
      currentStage === "S1" ? "提交集团部室审核" : "提交业务经理二次确认"
    );

    return {
      ok: true,
      result: flowResult,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "提交流程失败"),
    };
  }
}

export async function cancelS1SubtableSubmitPayload(ctx) {
  try {
    if (!ctx.s1FlowCancelSubmitPermission) {
      return { ok: false, message: "缺少 S1 重新编辑权限" };
    }
    const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法重新编辑" };
    }
    const currentStage = normalizeStageCode(flowSnapshot.node || ctx.stage || "S1");
    if (currentStage !== "S1") {
      return { ok: false, message: `当前流程已在 ${resolveStageLabel(currentStage)}，不能重新编辑 S1 子表` };
    }
    const targets = normalizeS1SubtableTargets(ctx);
    const targetCheck = assertS1SubtableTargets(targets);
    if (!targetCheck.ok) return targetCheck;
    const recordTargetCheck = assertS1SubtableRecordTargets(targets);
    if (!recordTargetCheck.ok) return recordTargetCheck;
    const moduleName = safeText(ctx.moduleName, "当前子表");
    const opinion = safeText(ctx.submitRemark || ctx.opinion || ctx.reviewSuggestion, "重新编辑");
    // 写入 submitted:false 的模块审核记录，避免 loadPage 后仍按历史「已提交」展示
    const reviewPayload = await saveProjectCostReviewApi({
      flowId: flowSnapshot.flowId,
      saveMode: "ARCHIVED",
      reviewerId: ctx.userId,
      reviewerName: safeText(ctx.actor || ctx.userName, ctx.userId),
      targetRecordIds: targets.targetRecordIds.length ? targets.targetRecordIds : undefined,
      targetSubmitIds: targets.targetSubmitIds.length ? targets.targetSubmitIds : undefined,
      reviewConclusion: "REJECT",
      reviewSuggestion: buildModuleSuggestionText({
        rootSubjectId: safeText(ctx.rootSubjectId),
        moduleKey: safeText(ctx.moduleKey || ctx.rootSubjectId || moduleName),
        moduleName,
        subjectDomain: "subtable",
        stageCode: "S1",
        opinion,
        submitted: false,
      }),
    });
    const reviewData = unwrapBizPayload(reviewPayload) || {};
    const payload = await rejectProjectCostRecordsToDraftApi({
      flowId: flowSnapshot.flowId,
      recordIds: targets.targetRecordIds,
      actionRemark: safeText(ctx.submitRemark, `S1_REJECT_TO_DRAFT_${moduleName}`),
    }, buildRevenueTraceLabel(ctx, "S1重新编辑子表"));
    const data = unwrapBizPayload(payload) || {};
    return {
      ok: true,
      reviewId: reviewData.reviewId,
      submitId: data.submitId,
      batchNo: data.batchNo,
      affectedRecordIds: data.rejectedRecordIds || [],
      rejectedCount: data.rejectedCount,
      flowId: data.flowId || flowSnapshot.flowId,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "重新编辑失败"),
    };
  }
}

export async function rejectS1SubtableSubmitPayload(ctx) {
  try {
    if (!ctx.s1FlowRejectSubtablePermission) {
      return { ok: false, message: "缺少 S1 重新编辑权限" };
    }
    const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法重新编辑子表" };
    }
    const currentStage = normalizeStageCode(flowSnapshot.node || ctx.stage || "S1");
    if (currentStage !== "S1") {
      return { ok: false, message: `当前流程已在 ${resolveStageLabel(currentStage)}，不能重新编辑 S1 子表` };
    }
    const targets = normalizeS1SubtableTargets(ctx);
    const targetCheck = assertS1SubtableTargets(targets);
    if (!targetCheck.ok) return targetCheck;
    const recordTargetCheck = assertS1SubtableRecordTargets(targets);
    if (!recordTargetCheck.ok) return recordTargetCheck;
    const moduleName = safeText(ctx.moduleName, "当前子表");
    const opinion = safeText(ctx.opinion || ctx.reviewSuggestion, "重新编辑");
    const reviewPayload = await saveProjectCostReviewApi({
      flowId: flowSnapshot.flowId,
      saveMode: "ARCHIVED",
      reviewerId: ctx.userId,
      reviewerName: safeText(ctx.actor || ctx.userName, ctx.userId),
      targetRecordIds: targets.targetRecordIds.length ? targets.targetRecordIds : undefined,
      targetSubmitIds: targets.targetSubmitIds.length ? targets.targetSubmitIds : undefined,
      reviewConclusion: "REJECT",
      reviewSuggestion: buildModuleSuggestionText({
        rootSubjectId: safeText(ctx.rootSubjectId),
        moduleKey: safeText(ctx.moduleKey || ctx.rootSubjectId || moduleName),
        moduleName,
        subjectDomain: "subtable",
        stageCode: "S1",
        opinion,
        submitted: false,
      }),
    });
    const reviewData = unwrapBizPayload(reviewPayload) || {};
    const draftPayload = await rejectProjectCostRecordsToDraftApi({
      flowId: flowSnapshot.flowId,
      recordIds: targets.targetRecordIds,
      actionRemark: `S1_REJECT_SUBTABLE_${moduleName}`,
    }, buildRevenueTraceLabel(ctx, "S1重新编辑子表"));
    const draftData = unwrapBizPayload(draftPayload) || {};
    return {
      ok: true,
      reviewId: reviewData.reviewId,
      cancelSubmitId: draftData.submitId,
      affectedRecordIds: draftData.rejectedRecordIds || [],
      rejectedCount: draftData.rejectedCount,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "重新编辑失败"),
    };
  }
}
