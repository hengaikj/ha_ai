import { REVENUE_MODULE_CODE } from "../domain-config";
import { buildDetailRowsFromPermissionTree } from "./detail-builder";
import { ensureProjectCostFlow } from "./flow-context";
import { mergeParentSubjectDisplayMap } from "./payload-normalizer";
import { buildTrimOptions, requestProjectPatternList } from "./project-context";
import { queryValueSourceRecords } from "./project-cost-record-query";
import { resolveSubmittedValueSourceNodes } from "./stage-labels";
import {
  buildSubjectIdFilterFromTree,
  getSubjectNodes,
  normalizeSubjectTreeResult,
} from "./subject-tree";
import { requestSubjectTreePreferPermission } from "./subject-tree-request";
import { resolveOperationPermissionKey } from "./workbench-permissions";
import {
  buildRevenueTraceLabel,
  resolveProjectDisplayName,
  safeText,
  toMaybeLong,
} from "./workbench-utils";

export function cloneDetailForFormula(detail = {}) {
  if (!detail || typeof detail !== "object") return {};
  return {
    ...detail,
    dimensions:
      detail.dimensions && typeof detail.dimensions === "object"
        ? {
            years: Array.isArray(detail.dimensions.years) ? detail.dimensions.years.slice() : [],
            trims: Array.isArray(detail.dimensions.trims) ? detail.dimensions.trims.slice() : [],
          }
        : { years: [], trims: [] },
    rows: Array.isArray(detail.rows)
      ? detail.rows.map((row) => ({
          ...row,
          cells: row && row.cells && typeof row.cells === "object" ? { ...row.cells } : {},
          cellMap: row && row.cellMap && typeof row.cellMap === "object" ? { ...row.cellMap } : undefined,
          cellRecordMap:
            row && row.cellRecordMap && typeof row.cellRecordMap === "object"
              ? { ...row.cellRecordMap }
              : undefined,
          cellTargetMap:
            row && row.cellTargetMap && typeof row.cellTargetMap === "object"
              ? { ...row.cellTargetMap }
              : undefined,
        }))
      : [],
  };
}

export function normalizeFormulaSourcePath(value) {
  const text = Array.isArray(value) ? value.join("/") : safeText(value);
  return text
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "")
    .replace(/[/\\|｜>＞\-—_]/g, "")
    .toLowerCase();
}

function normalizeFormulaSourcePathParts(value) {
  const text = Array.isArray(value) ? value.join("/") : safeText(value);
  return text
    .replace(/\\/g, "/")
    .split("/")
    .map((item) => safeText(item))
    .filter(Boolean);
}

export function getFormulaSourceRowPath(row = {}) {
  return row.fullNamePath ||
    row.subjectPath ||
    row.subjectTreePath ||
    row.path ||
    [row.rootSubjectName, row.subtable, row.subject].filter(Boolean).join("/");
}

function hasTargetSalesVolumeRow(detail = {}) {
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const candidates = [
    normalizeFormulaSourcePath("销量表/销量"),
  ];
  return rows.some((row) => {
    const path = normalizeFormulaSourcePath(getFormulaSourceRowPath(row));
    return candidates.some((candidate) => path.endsWith(candidate) || path === candidate);
  });
}

export function rowDependsOnSalesVolumeFormulaSource(row = {}) {
  if (!row || typeof row !== "object") return false;
  const path = normalizeFormulaSourcePath(getFormulaSourceRowPath(row));
  const text = normalizeFormulaSourcePath([
    row.formulaText,
    row.formulaCode,
    row.formulaKey,
    row.weightSourcePath,
    row.ratioNumeratorPath,
    row.ratioDenominatorPath,
    row.lifecycleFormula,
    row.aggregateFormula,
  ].filter(Boolean).join("/"));
  const salesVolume = normalizeFormulaSourcePath("销量表/销量");
  const targetSalesVolume = normalizeFormulaSourcePath("销量表/目标销量");
  if (
    text.includes(salesVolume) ||
    text.includes(targetSalesVolume) ||
    text.includes(normalizeFormulaSourcePath("目标销量")) ||
    text.includes(normalizeFormulaSourcePath("volume_weighted")) ||
    text.includes(normalizeFormulaSourcePath("weighted_by_mix"))
  ) {
    return true;
  }
  if (/mix$/i.test(safeText(row.subjectName || row.subject)) || path.includes(normalizeFormulaSourcePath("mix"))) {
    return true;
  }
  if (
    safeText(row.moduleCode) === REVENUE_MODULE_CODE.RND_EXPENSE ||
    path.includes(normalizeFormulaSourcePath("研发投资")) ||
    path.includes(normalizeFormulaSourcePath("研发费用"))
  ) {
    return true;
  }
  return false;
}

export function needsSubtableFormulaSource(detail = {}) {
  if (hasTargetSalesVolumeRow(detail)) return false;
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  return rows.some((row) => rowDependsOnSalesVolumeFormulaSource(row));
}

export function isSalesVolumeFormulaSourcePath(path) {
  const parts = normalizeFormulaSourcePathParts(path);
  if (!parts.length) return false;
  const root = normalizeFormulaSourcePath(parts[0]);
  const leaf = normalizeFormulaSourcePath(parts[parts.length - 1]);
  return root === normalizeFormulaSourcePath("销量表") &&
    [
      normalizeFormulaSourcePath("销量"),
      normalizeFormulaSourcePath("目标销量"),
    ].includes(leaf);
}

function filterSubjectTreeByFormulaSource(nodes = [], predicate, parentPath = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  return list.reduce((result, node) => {
    if (!node || typeof node !== "object") return result;
    const name = safeText(node.subjectName || node.name);
    const nextPath = name ? parentPath.concat(name) : parentPath.slice();
    const children = filterSubjectTreeByFormulaSource(node.children, predicate, nextPath);
    const selfMatched = typeof predicate === "function" && predicate(nextPath, node);
    if (!selfMatched && !children.length) return result;
    result.push({
      ...node,
      leaf: children.length ? false : node.leaf,
      children,
    });
    return result;
  }, []);
}

export function filterSubjectTreePayloadByFormulaSource(payload = {}, predicate) {
  const normalized = normalizeSubjectTreeResult(payload);
  return {
    ...normalized,
    data: {
      ...(normalized && normalized.data && typeof normalized.data === "object"
        ? normalized.data
        : {}),
      subjects: filterSubjectTreeByFormulaSource(getSubjectNodes(normalized), predicate),
    },
  };
}

export function readFormulaSourceDetailFromPayload(payload = {}) {
  return payload && payload.detail && Array.isArray(payload.detail.rows)
    ? payload.detail
    : null;
}

export function readReusableFormulaSourceDetail(ctx = {}) {
  return ctx.formulaSourceDetail && Array.isArray(ctx.formulaSourceDetail.rows)
    ? ctx.formulaSourceDetail
    : null;
}

export async function fetchSalesVolumeFormulaSourcePayload(ctx = {}) {
  const sourceCtx = {
    ...ctx,
    subjectDomain: "subtable",
    subjectApiMode: "all",
    // 系统级公式来源：按模板全集组装，避免当前用户未授权的来源科目缺失导致匹配失败
    subjectScope: "template",
  };
  const scopedSubjectTreePayload = await requestSubjectTreePreferPermission(sourceCtx);
  const subjectTreePayload = filterSubjectTreePayloadByFormulaSource(
    scopedSubjectTreePayload,
    (path) => isSalesVolumeFormulaSourcePath(path)
  );
  const subjectIds = buildSubjectIdFilterFromTree(subjectTreePayload);
  if (!subjectIds.length) {
    throw new Error("模板内缺少销量公式来源科目，无法执行公式计算");
  }
  const [flowSnapshot, patternList] = await Promise.all([
    ensureProjectCostFlow(sourceCtx, { createIfMissing: false }),
    requestProjectPatternList(sourceCtx),
  ]);
  const preferredRecords = subjectIds.length
    ? await queryValueSourceRecords(sourceCtx, flowSnapshot, false, {
        subjectIds,
        traceLabel: buildRevenueTraceLabel(
          sourceCtx,
          `记录: 公式销量来源 records/query subjectIds=${subjectIds.join(",")}`
        ),
      })
    : [];
  const trimOptions = buildTrimOptions(patternList, preferredRecords);
  const detailData = buildDetailRowsFromPermissionTree(
    getSubjectNodes(subjectTreePayload),
    preferredRecords,
    trimOptions
  );
  const currentStage = safeText((flowSnapshot && flowSnapshot.node) || sourceCtx.stage, "S1").toUpperCase();
  return {
    project: {
      projectId: sourceCtx.projectId || undefined,
      projectNo: sourceCtx.projectCode,
      projectCode: sourceCtx.projectCode,
      projectName: resolveProjectDisplayName(sourceCtx),
      gate: sourceCtx.valve,
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
      valueSourceNodes: resolveSubmittedValueSourceNodes(sourceCtx, flowSnapshot),
    },
    permissions: {
      viewer: sourceCtx.userId,
      permissionKey: resolveOperationPermissionKey(sourceCtx, ""),
    },
    subjectTreePayload,
  };
}

export async function resolveNeededSalesVolumeFormulaSourceDetail(ctx = {}, detail = {}) {
  if (!needsSubtableFormulaSource(detail)) return null;
  const reusableDetail = readReusableFormulaSourceDetail(ctx);
  if (reusableDetail) return reusableDetail;
  const payload = await fetchSalesVolumeFormulaSourcePayload(ctx);
  return readFormulaSourceDetailFromPayload(payload);
}

export async function resolveNeededFormulaSourceDetail(ctx = {}, detail = {}) {
  return resolveNeededSalesVolumeFormulaSourceDetail(ctx, detail);
}

export function findFormulaDependencySubjectIds(rows = [], dependencyPath) {
  const normalized = normalizeFormulaSourcePath(dependencyPath);
  if (!normalized) return [];
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      const path = normalizeFormulaSourcePath(getFormulaSourceRowPath(row));
      return path === normalized || path.endsWith(normalized) || path.includes(normalized);
    })
    .map((row) => toMaybeLong(row && row.subjectId))
    .filter((id, index, list) => id != null && list.indexOf(id) === index);
}
