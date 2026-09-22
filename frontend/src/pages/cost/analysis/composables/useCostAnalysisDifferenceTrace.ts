import { ref } from "vue";
import { queryCostAnalysisDifferenceDetails } from "@/api/cost-analysis";
import type {
  CostAnalysisCategoryLevel,
  CostAnalysisDifferenceDetailQuery,
  CostAnalysisDifferenceDetailResult,
  CostAnalysisDifferenceDetailRow,
  CostAnalysisDimensionType,
  CostAnalysisDifferenceViewLevel,
  CostAnalysisMetric,
  CostAnalysisTraceError,
} from "@/types/cost-analysis";
import {
  getCostAnalysisDimensionMaxLevel,
  normalizeCostAnalysisDimensionType,
} from "@/pages/cost/analysis/utils/analysis-dimension";
import {
  getDefaultCostAnalysisDifferenceViewLevel,
  getCostAnalysisDifferenceViewLevelOptions,
} from "@/pages/cost/analysis/utils/difference-view-level";

export interface CostAnalysisDifferenceCellContext {
  traceType?: "POINT_COMPARISON";
  snapshotId: string;
  baselineColumnKey: string;
  comparisonColumnKey: string;
  dimensionType?: CostAnalysisDimensionType;
  categoryLevel: CostAnalysisCategoryLevel;
  categoryId: string;
  metric: CostAnalysisMetric;
  baselineValue: number;
  comparisonValue: number;
  difference: number;
}

export interface CostAnalysisVarianceCellContext {
  traceType: "COST_VARIANCE";
  snapshotId: string;
  columnKey: string;
  dimensionType?: CostAnalysisDimensionType;
  categoryLevel: CostAnalysisCategoryLevel;
  categoryId: string;
  metric: "VARIANCE";
  baselineValue: number;
  comparisonValue: number;
  difference: number;
}

export type CostAnalysisTraceCellContext =
  | CostAnalysisDifferenceCellContext
  | CostAnalysisVarianceCellContext;

export interface CostAnalysisDifferenceTraceEntry {
  snapshotId: string;
  query: CostAnalysisDifferenceDetailQuery;
  result: CostAnalysisDifferenceDetailResult;
}

type DifferenceDetailRequest = (
  snapshotId: string,
  query: CostAnalysisDifferenceDetailQuery,
) => Promise<CostAnalysisDifferenceDetailResult>;

interface PendingRequest {
  snapshotId: string;
  query: CostAnalysisDifferenceDetailQuery;
}

function normalizeError(error: unknown): CostAnalysisTraceError {
  if (typeof error === "object" && error !== null) {
    const candidate = error as Partial<CostAnalysisTraceError>;
    if (
      typeof candidate.code === "string" &&
      typeof candidate.message === "string"
    ) {
      return {
        code: candidate.code,
        message: candidate.message,
        ...(typeof candidate.traceId === "string"
          ? { traceId: candidate.traceId }
          : {}),
      };
    }
  }
  return {
    code: "COST_ANALYSIS_DIFFERENCE_QUERY_FAILED",
    message:
      error instanceof Error ? error.message : "成本分析差异溯源查询失败。",
  };
}

function cacheKey(request: PendingRequest): string {
  const query = request.query;
  const identity =
    query.traceType === "COST_VARIANCE"
      ? [query.traceType, query.columnKey]
      : [
          query.traceType ?? "POINT_COMPARISON",
          query.baselineColumnKey,
          query.comparisonColumnKey,
        ];
  return [
    request.snapshotId,
    ...identity,
    normalizeCostAnalysisDimensionType(query.dimensionType),
    query.categoryLevel,
    query.categoryId,
    query.viewLevel ??
      getDefaultCostAnalysisDifferenceViewLevel(
        query.dimensionType,
        query.categoryLevel,
      ) ??
      "PART",
    query.metric,
    query.partScope ?? "TOP10",
  ].join("|");
}

function toRequest(context: CostAnalysisTraceCellContext): PendingRequest {
  if (context.traceType === "COST_VARIANCE") {
    return {
      snapshotId: context.snapshotId,
      query: {
        traceType: "COST_VARIANCE",
        columnKey: context.columnKey,
        dimensionType: normalizeCostAnalysisDimensionType(
          context.dimensionType,
        ),
        categoryLevel: context.categoryLevel,
        categoryId: context.categoryId,
        metric: "VARIANCE",
        ...(context.categoryLevel <
        getCostAnalysisDimensionMaxLevel(
          context.dimensionType ?? "VEHICLE_SYSTEM",
        )
          ? {
              viewLevel: getDefaultCostAnalysisDifferenceViewLevel(
                context.dimensionType,
                context.categoryLevel,
              )!,
            }
          : {}),
        ...(context.categoryLevel ===
        getCostAnalysisDimensionMaxLevel(
          normalizeCostAnalysisDimensionType(context.dimensionType),
        )
          ? { limit: 10 as const, partScope: "TOP10" as const }
          : {}),
      },
    };
  }
  return {
    snapshotId: context.snapshotId,
    query: {
      baselineColumnKey: context.baselineColumnKey,
      comparisonColumnKey: context.comparisonColumnKey,
      dimensionType: normalizeCostAnalysisDimensionType(context.dimensionType),
      categoryLevel: context.categoryLevel,
      categoryId: context.categoryId,
      metric: context.metric,
      ...(context.categoryLevel <
      getCostAnalysisDimensionMaxLevel(
        normalizeCostAnalysisDimensionType(context.dimensionType),
      )
        ? {
            viewLevel: getDefaultCostAnalysisDifferenceViewLevel(
              context.dimensionType,
              context.categoryLevel,
            )!,
          }
        : {}),
      ...(context.categoryLevel ===
      getCostAnalysisDimensionMaxLevel(
        normalizeCostAnalysisDimensionType(context.dimensionType),
      )
        ? { limit: 10 as const, partScope: "TOP10" as const }
        : {}),
    },
  };
}

export function useCostAnalysisDifferenceTrace(
  requestDetails: DifferenceDetailRequest = queryCostAnalysisDifferenceDetails,
) {
  const visible = ref(false);
  const loading = ref(false);
  const error = ref<CostAnalysisTraceError | null>(null);
  const current = ref<CostAnalysisDifferenceDetailResult | null>(null);
  const path = ref<CostAnalysisDifferenceTraceEntry[]>([]);
  const allPartRows = ref<CostAnalysisDifferenceDetailRow[] | null>(null);
  const allPartsLoading = ref(false);
  const allPartsError = ref<CostAnalysisTraceError | null>(null);
  const cache = new Map<string, CostAnalysisDifferenceDetailResult>();
  const allPartsCache = new Map<string, CostAnalysisDifferenceDetailRow[]>();
  let generation = 0;
  let allPartsGeneration = 0;
  let activeRequest: PendingRequest | null = null;

  function clearAllParts(): void {
    allPartsGeneration += 1;
    allPartRows.value = null;
    allPartsLoading.value = false;
    allPartsError.value = null;
  }

  function applyResult(
    request: PendingRequest,
    result: CostAnalysisDifferenceDetailResult,
    pathMode: "reset" | "append" | "replace",
  ): void {
    const entry = {
      snapshotId: request.snapshotId,
      query: { ...request.query },
      result,
    };
    path.value =
      pathMode === "reset"
        ? [entry]
        : pathMode === "append"
          ? [...path.value, entry]
          : [...path.value.slice(0, -1), entry];
    current.value = result;
    activeRequest = request;
  }

  async function load(
    request: PendingRequest,
    pathMode: "reset" | "append" | "replace",
    force = false,
  ): Promise<void> {
    const requestGeneration = ++generation;
    activeRequest = request;
    error.value = null;
    const key = cacheKey(request);
    const cached = force ? undefined : cache.get(key);
    if (cached) {
      loading.value = false;
      applyResult(request, cached, pathMode);
      return;
    }

    loading.value = true;
    try {
      const result = await requestDetails(request.snapshotId, request.query);
      if (requestGeneration !== generation || !visible.value) return;
      cache.set(key, result);
      applyResult(request, result, pathMode);
    } catch (requestError) {
      if (requestGeneration !== generation || !visible.value) return;
      error.value = normalizeError(requestError);
      if (pathMode === "reset") {
        current.value = null;
        path.value = [];
      }
    } finally {
      if (requestGeneration === generation) {
        loading.value = false;
      }
    }
  }

  async function open(context: CostAnalysisTraceCellContext): Promise<void> {
    visible.value = true;
    current.value = null;
    path.value = [];
    clearAllParts();
    await load(toRequest(context), "reset");
  }

  async function drill(row: CostAnalysisDifferenceDetailRow): Promise<void> {
    const currentEntry = path.value.at(-1);
    if (
      !currentEntry ||
      row.objectType !== "CATEGORY" ||
      !row.hasChildren ||
      currentEntry.query.categoryLevel >=
        getCostAnalysisDimensionMaxLevel(
          normalizeCostAnalysisDimensionType(currentEntry.query.dimensionType),
        )
    ) {
      return;
    }
    const terminalLevel = getCostAnalysisDimensionMaxLevel(
      normalizeCostAnalysisDimensionType(currentEntry.query.dimensionType),
    );
    const currentViewLevel =
      currentEntry.query.viewLevel ??
      currentEntry.result.viewLevel ??
      getDefaultCostAnalysisDifferenceViewLevel(
        currentEntry.query.dimensionType,
        currentEntry.query.categoryLevel,
      );
    if (currentViewLevel === null || currentViewLevel === undefined) return;
    // 未归属是当前范围的特殊分组，直接打开零件，不套用另一套分类层级。
    const categoryLevel = row.objectId.startsWith("UNASSIGNED:")
      ? terminalLevel
      : (currentViewLevel as CostAnalysisCategoryLevel);
    clearAllParts();
    const nextQuery = {
      ...currentEntry.query,
      categoryLevel,
      categoryId: row.objectId,
    } as CostAnalysisDifferenceDetailQuery;
    delete nextQuery.viewLevel;
    if (categoryLevel === terminalLevel) {
      nextQuery.limit = 10;
      nextQuery.partScope = "TOP10";
    } else {
      nextQuery.viewLevel = getDefaultCostAnalysisDifferenceViewLevel(
        nextQuery.dimensionType,
        categoryLevel,
      )!;
      delete nextQuery.limit;
      delete nextQuery.partScope;
    }
    await load(
      { snapshotId: currentEntry.snapshotId, query: nextQuery },
      "append",
    );
  }

  async function changeViewLevel(
    level: CostAnalysisDifferenceViewLevel,
  ): Promise<void> {
    const currentEntry = path.value.at(-1);
    if (!currentEntry) return;

    const options = getCostAnalysisDifferenceViewLevelOptions(
      currentEntry.query.dimensionType,
      currentEntry.query.categoryLevel,
    );
    if (!options.some((option) => option.value === level)) return;
    if (
      currentEntry.query.viewLevel === level ||
      current.value?.viewLevel === level
    ) {
      return;
    }

    clearAllParts();
    const nextQuery = {
      ...currentEntry.query,
      viewLevel: level,
    } as CostAnalysisDifferenceDetailQuery;
    delete nextQuery.limit;
    delete nextQuery.partScope;
    await load(
      {
        snapshotId: currentEntry.snapshotId,
        query: nextQuery,
      },
      "replace",
    );
  }

  async function showAllParts(force = false): Promise<void> {
    const currentEntry = path.value.at(-1);
    if (
      !currentEntry ||
      current.value?.drillLevel !== "PART" ||
      allPartsLoading.value ||
      (allPartRows.value && !force)
    ) {
      return;
    }

    const query: CostAnalysisDifferenceDetailQuery = {
      ...currentEntry.query,
      partScope: "ALL",
      pageNum: 1,
      pageSize: 500,
    };
    delete query.limit;
    const request = {
      snapshotId: currentEntry.snapshotId,
      query,
    };
    const requestGeneration = ++allPartsGeneration;
    const key = cacheKey(request);
    const cached = force ? undefined : allPartsCache.get(key);
    allPartsError.value = null;
    if (cached) {
      allPartRows.value = cached;
      return;
    }

    allPartsLoading.value = true;
    try {
      const firstResult = await requestDetails(
        request.snapshotId,
        request.query,
      );
      const rows = [...firstResult.rows];
      let pageNum = 1;
      const totalRows =
        firstResult.total ?? firstResult.summary.totalChangedCount;
      while (rows.length < totalRows && pageNum < 100) {
        pageNum += 1;
        const page = await requestDetails(request.snapshotId, {
          ...request.query,
          pageNum,
        });
        rows.push(...page.rows);
        if (page.rows.length === 0) break;
      }
      const result = { ...firstResult, rows };
      if (requestGeneration !== allPartsGeneration || !visible.value) return;
      if (result.drillLevel !== "PART") {
        throw new Error("成本分析全量零件明细响应层级不正确。");
      }
      allPartsCache.set(key, result.rows);
      allPartRows.value = result.rows;
    } catch (requestError) {
      if (requestGeneration !== allPartsGeneration || !visible.value) return;
      allPartsError.value = normalizeError(requestError);
    } finally {
      if (requestGeneration === allPartsGeneration) {
        allPartsLoading.value = false;
      }
    }
  }

  async function retryAllParts(): Promise<void> {
    await showAllParts(true);
  }

  function backTo(index: number): void {
    const entry = path.value[index];
    if (!entry) return;
    generation += 1;
    clearAllParts();
    loading.value = false;
    error.value = null;
    path.value = path.value.slice(0, index + 1);
    current.value = entry.result;
    activeRequest = {
      snapshotId: entry.snapshotId,
      query: { ...entry.query },
    };
  }

  async function retry(): Promise<void> {
    if (!activeRequest || loading.value) return;
    const currentEntry = path.value.at(-1);
    await load(activeRequest, currentEntry ? "replace" : "reset", true);
  }

  function close(): void {
    generation += 1;
    clearAllParts();
    visible.value = false;
    loading.value = false;
    error.value = null;
    current.value = null;
    path.value = [];
    activeRequest = null;
  }

  function reset(): void {
    close();
    cache.clear();
    allPartsCache.clear();
  }

  return {
    visible,
    loading,
    error,
    current,
    path,
    allPartRows,
    allPartsLoading,
    allPartsError,
    open,
    drill,
    changeViewLevel,
    showAllParts,
    retryAllParts,
    backTo,
    retry,
    close,
    reset,
  };
}
