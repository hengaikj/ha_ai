import {
  normalizeStageCode,
} from "../domain-config";
import {
  MAIN_TABLE_DATA_CHECK_HISTORY_RULE,
  MAIN_TABLE_DATA_CHECK_IMPORT_NODE,
  buildMainTableDataCheckProject,
  buildMainTableDataCheckSource,
  buildMainTableDataCheckSourceFromDetail,
  fetchMainTableDataCheckSubjectTree,
  filterMainTableDataCheckDetailRowsBySubjectIds,
  getMainDataCheckHistoryPreviewVersionKey,
  getMainDataCheckHistoryPreviewVersionLabel,
  getMainDataCheckHistoryValveVersionKey,
  getMainDataCheckHistoryValveVersionLabel,
  getMainDataCheckOtherProjectVersionKey,
  getMainDataCheckOtherProjectVersionLabel,
  getMainDataCheckStagePreviewVersionKey,
  getMainDataCheckStagePreviewVersionLabel,
  getMainDataCheckStageSnapshotVersionLabel,
  hasMainTableDataCheckPermission,
  queryMainTableDataCheckHistoryArchivedFallback,
  queryMainTableDataCheckHistoryValveRecords,
  queryMainTableDataCheckStageRecords,
  remapDataCheckRecordsToSubjectTree,
  resolveMainTableDataCheckStageCodes,
} from "./main-table-data-check";
import {
  requestProjectPatternList,
} from "./project-context";
import {
  buildSubjectIdFilterFromTree,
  getSubjectNodes,
  normalizeSubjectTreeResult,
} from "./subject-tree";
import {
  safeText,
} from "./workbench-utils";

async function buildMainTableDataCheckPreviewSource(ctx, flowSnapshot, stageCode, subjectIds = [], sourceMeta = {}, dependencies = {}) {
  const buildCalculatedMainTablePayloadFromStageContext = dependencies.buildCalculatedMainTablePayloadFromStageContext;
  if (typeof buildCalculatedMainTablePayloadFromStageContext !== "function") {
    throw new Error("缺少主表预览生成器，无法构建数据核对预览源");
  }
  const sourceStageCode = normalizeStageCode(stageCode);
  const previewPayload = await buildCalculatedMainTablePayloadFromStageContext(
    {
      ...ctx,
      subjectDomain: "main",
      subjectApiMode: "all",
      stage: sourceStageCode,
      stageCode: sourceStageCode,
    },
    flowSnapshot,
    { sourceStageCode }
  );
  const previewDetail =
    previewPayload && previewPayload.detail && typeof previewPayload.detail === "object"
      ? previewPayload.detail
      : {};
  const rows = filterMainTableDataCheckDetailRowsBySubjectIds(previewDetail, subjectIds);
  if (!rows.length) return null;
  return buildMainTableDataCheckSourceFromDetail(
    ctx,
    flowSnapshot,
    {
      ...previewDetail,
      rows,
    },
    sourceStageCode,
    "PREVIEW",
    {
      key: safeText(sourceMeta.key, getMainDataCheckStagePreviewVersionKey(sourceStageCode)),
      label: safeText(sourceMeta.label, getMainDataCheckStagePreviewVersionLabel(sourceStageCode)),
      dot: safeText(sourceMeta.dot, "current"),
      group: safeText(sourceMeta.group, "preview"),
      sourceType: safeText(sourceMeta.sourceType, "mainPreview"),
      valvePoint: safeText(sourceMeta.valvePoint),
      valueSourceNodes: Array.isArray(sourceMeta.valueSourceNodes) && sourceMeta.valueSourceNodes.length
        ? sourceMeta.valueSourceNodes
        : [sourceStageCode],
      mainPreviewSourceMode: safeText(
        sourceMeta.mainPreviewSourceMode,
        safeText(previewDetail.mainPreviewSourceMode, "calculated")
      ),
      mainPreviewSourceStage: safeText(sourceMeta.mainPreviewSourceStage, sourceStageCode),
      calculatedMainPreview: true,
      ignoreFlowId: sourceMeta.ignoreFlowId === true,
    }
  );
}

export async function fetchMainTableDataCheckSourcesPayload(ctx, flowSnapshot, dependencies = {}) {
  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S1");
  const mainCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
    stage: currentStage,
    stageCode: currentStage,
  };
  const project = buildMainTableDataCheckProject(mainCtx, flowSnapshot, currentStage);
  const stageCodes = resolveMainTableDataCheckStageCodes(currentStage);
  const hasMainPermission = await hasMainTableDataCheckPermission(mainCtx);
  if (!hasMainPermission) {
    return {
      ok: true,
      hasMainPermission: false,
      currentStage,
      stageCodes,
      project,
      subjectTreePayload: normalizeSubjectTreeResult({}),
      sources: [],
    };
  }

  const subjectTreePayload = await fetchMainTableDataCheckSubjectTree(mainCtx);
  const subjectIds = buildSubjectIdFilterFromTree(subjectTreePayload);
  if (!getSubjectNodes(subjectTreePayload).length || !subjectIds.length) {
    return {
      ok: true,
      hasMainPermission: true,
      subjectTreeEmpty: true,
      currentStage,
      stageCodes,
      project,
      subjectTreePayload,
      sources: [],
    };
  }

  const patternList = await requestProjectPatternList(mainCtx);
  const sourceResults = await Promise.all(
    stageCodes.map(async (stageCode) => {
      const result = await queryMainTableDataCheckStageRecords(
        mainCtx,
        flowSnapshot,
        stageCode,
        subjectIds
      );
      if (!result.records.length) return null;
      return buildMainTableDataCheckSource(
        mainCtx,
        flowSnapshot,
        subjectTreePayload,
        patternList,
        stageCode,
        result.records,
        result.recordStatus,
        {
          label: getMainDataCheckStageSnapshotVersionLabel(stageCode),
          sourceType: "mainSnapshot",
        }
      );
    })
  );
  const sources = sourceResults.filter(Boolean);
  const hasCurrentStageSnapshot = sources.some((source) =>
    normalizeStageCode(source && source.stage) === currentStage &&
    safeText(source && source.sourceType) === "mainSnapshot"
  );
  if (!hasCurrentStageSnapshot) {
    try {
      const previewSource = await buildMainTableDataCheckPreviewSource(
        mainCtx,
        flowSnapshot,
        currentStage,
        subjectIds,
        {},
        dependencies
      );
      if (previewSource) sources.push(previewSource);
    } catch (_error) {
      // 主表预览是补充数据源，生成失败不影响已形成的快照校核。
    }
  }
  return {
    ok: true,
    hasMainPermission: true,
    currentStage,
    stageCodes,
    project,
    subjectTreePayload,
    sources,
  };
}

function resolveHistoryValveSourceIdentity(targetValvePoint, sourceStageCode, sourceIdentity = {}) {
  const identity = sourceIdentity && typeof sourceIdentity === "object" ? sourceIdentity : {};
  const defaultLabel = getMainDataCheckHistoryValveVersionLabel(targetValvePoint, sourceStageCode);
  const builtLabel = typeof identity.buildLabel === "function"
    ? identity.buildLabel(sourceStageCode)
    : "";
  return {
    key: safeText(identity.key, getMainDataCheckHistoryValveVersionKey(targetValvePoint)),
    label: safeText(builtLabel || identity.label, defaultLabel),
    dot: safeText(identity.dot, "history"),
    group: safeText(identity.group, "history"),
    sourceType: safeText(identity.sourceType, "historyValve"),
  };
}

export async function fetchMainTableDataCheckHistoryValveSourcePayload(ctx, flowSnapshot, targetValvePoint, dependencies = {}) {
  const currentStage = normalizeStageCode((flowSnapshot && flowSnapshot.node) || ctx.stage || "S1");
  const mainCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
    stage: currentStage,
    stageCode: currentStage,
  };
  const project = buildMainTableDataCheckProject(mainCtx, flowSnapshot, currentStage);
  const hasMainPermission = await hasMainTableDataCheckPermission(mainCtx);
  if (!hasMainPermission) {
    return {
      ok: true,
      hasMainPermission: false,
      currentStage,
      project,
      source: null,
    };
  }

  const subjectTreePayload = await fetchMainTableDataCheckSubjectTree(mainCtx);
  const subjectIds = buildSubjectIdFilterFromTree(subjectTreePayload);
  if (!getSubjectNodes(subjectTreePayload).length || !subjectIds.length) {
    return {
      ok: true,
      hasMainPermission: true,
      subjectTreeEmpty: true,
      currentStage,
      project,
      subjectTreePayload,
      source: null,
    };
  }

  const sourceIdentity = dependencies.sourceIdentity && typeof dependencies.sourceIdentity === "object"
    ? dependencies.sourceIdentity
    : {};
  const includePreview = sourceIdentity.includePreview !== false;
  const historyCtx = {
    ...mainCtx,
    valve: targetValvePoint,
    valvePoint: targetValvePoint,
    stage: "S8",
    stageCode: "S8",
  };
  const [patternList, records] = await Promise.all([
    requestProjectPatternList(historyCtx),
    queryMainTableDataCheckHistoryValveRecords(historyCtx, subjectIds),
  ]);
  const fallbackResult = records.length
    ? { records: [], stageCode: "" }
    : await queryMainTableDataCheckHistoryArchivedFallback(historyCtx, flowSnapshot, subjectIds);
  const rawSourceRecords = records.length ? records : fallbackResult.records;
  // 其他项目科目 ID 可能与当前页不一致，按名称对齐后再组装主表行。
  const sourceRecords = sourceIdentity.alignRecordsByName === true
    ? remapDataCheckRecordsToSubjectTree(rawSourceRecords, subjectTreePayload)
    : rawSourceRecords;
  const sourceStageCode = fallbackResult.records.length ? fallbackResult.stageCode : "S8";
  const sourceRecordStatus = fallbackResult.records.length ? "HISTORY_ARCHIVED_FALLBACK" : "HISTORY_FINAL";
  const sourceMeta = resolveHistoryValveSourceIdentity(
    targetValvePoint,
    sourceStageCode,
    sourceIdentity
  );
  const source = sourceRecords.length
    ? buildMainTableDataCheckSource(
      historyCtx,
      flowSnapshot,
      subjectTreePayload,
      patternList,
      sourceStageCode,
      sourceRecords,
      sourceRecordStatus,
      {
        key: sourceMeta.key,
        label: sourceMeta.label,
        dot: sourceMeta.dot,
        group: sourceMeta.group,
        sourceType: sourceMeta.sourceType,
        valvePoint: targetValvePoint,
        valueSourceNodes: fallbackResult.records.length
          ? [fallbackResult.stageCode]
          : MAIN_TABLE_DATA_CHECK_HISTORY_RULE.nodes.concat(MAIN_TABLE_DATA_CHECK_IMPORT_NODE),
        ignoreFlowId: true,
      }
    )
    : null;
  const previewStageCode = normalizeStageCode(
    (flowSnapshot && flowSnapshot.node) || currentStage || sourceStageCode
  );
  let previewSource = null;
  // 其他项目对比不生成预览源；历史阀点默认仍保留预览补充。
  if (includePreview && (!source || previewStageCode !== sourceStageCode)) {
    try {
      previewSource = await buildMainTableDataCheckPreviewSource(
        historyCtx,
        flowSnapshot,
        previewStageCode,
        subjectIds,
        {
          key: getMainDataCheckHistoryPreviewVersionKey(targetValvePoint, previewStageCode),
          label: getMainDataCheckHistoryPreviewVersionLabel(targetValvePoint, previewStageCode),
          dot: "history",
          group: "historyPreview",
          sourceType: "historyValvePreview",
          valvePoint: targetValvePoint,
          valueSourceNodes: [previewStageCode],
          mainPreviewSourceStage: previewStageCode,
          ignoreFlowId: true,
        },
        dependencies
      );
    } catch (_error) {
      // 历史阀点预览是补充数据源，生成失败不影响已形成的快照校核。
    }
  }
  const sources = [source, previewSource].filter(Boolean);
  return {
    ok: true,
    hasMainPermission: true,
    currentStage,
    project,
    subjectTreePayload,
    source: source || previewSource,
    sources,
  };
}

function pickBestOtherProjectCompareSource(sources = [], currentStage = "") {
  const list = (Array.isArray(sources) ? sources : []).filter(Boolean);
  if (!list.length) return null;
  const stage = normalizeStageCode(currentStage);
  const currentSnapshot = list.find((item) =>
    normalizeStageCode(item.stage) === stage && safeText(item.sourceType) === "mainSnapshot"
  );
  if (currentSnapshot) return currentSnapshot;
  const currentPreview = list.find((item) =>
    normalizeStageCode(item.stage) === stage && safeText(item.sourceType) === "mainPreview"
  );
  if (currentPreview) return currentPreview;
  const snapshots = list.filter((item) => safeText(item.sourceType) === "mainSnapshot");
  if (snapshots.length) return snapshots[snapshots.length - 1];
  return list[list.length - 1];
}

export async function fetchMainTableDataCheckOtherProjectSourcePayload(ctx, flowSnapshot, targetValvePoint, dependencies = {}) {
  const displayName = safeText(
    ctx.projectCode || ctx.projectNo || ctx.projectName || ctx.projectId,
    "其他项目"
  );
  // 其他项目按「打开该项目数据校核」同一套只读源取数，不走本项目历史阀点的 S8 查询。
  const payload = await fetchMainTableDataCheckSourcesPayload(ctx, flowSnapshot, dependencies);
  const picked = pickBestOtherProjectCompareSource(payload && payload.sources, payload && payload.currentStage);
  if (!picked) {
    return {
      ...payload,
      source: null,
      sources: [],
    };
  }
  const remapped = {
    ...picked,
    key: getMainDataCheckOtherProjectVersionKey(ctx.projectId, targetValvePoint),
    label: getMainDataCheckOtherProjectVersionLabel(
      displayName,
      targetValvePoint,
      picked.stage
    ),
    group: "otherProject",
    sourceType: "otherProject",
    dot: "history",
    valvePoint: targetValvePoint,
  };
  return {
    ...payload,
    source: remapped,
    sources: [remapped],
  };
}
