import { ref } from "vue";
import { queryCostAnalysisAiAnalysis } from "@/api/cost-analysis";
import type {
  CostAnalysisAiAnalysisQuery,
  CostAnalysisAiAnalysisResult,
  CostAnalysisTraceError,
} from "@/types/cost-analysis";
import { normalizeCostAnalysisDimensionType } from "@/pages/cost/analysis/utils/analysis-dimension";
import { getDefaultCostAnalysisDifferenceViewLevel } from "@/pages/cost/analysis/utils/difference-view-level";

type AiAnalysisRequest = (
  snapshotId: string,
  query: CostAnalysisAiAnalysisQuery,
) => Promise<CostAnalysisAiAnalysisResult>;

interface ActiveRequest {
  snapshotId: string;
  query: CostAnalysisAiAnalysisQuery;
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
    code: "COST_ANALYSIS_AI_ANALYSIS_FAILED",
    message:
      error instanceof Error ? error.message : "成本分析 AI 汇总生成失败。",
  };
}

function cacheKey(request: ActiveRequest): string {
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
  ].join("|");
}

export function useCostAnalysisAiAnalysis(
  requestAnalysis: AiAnalysisRequest = queryCostAnalysisAiAnalysis,
) {
  const loading = ref(false);
  const error = ref<CostAnalysisTraceError | null>(null);
  const current = ref<CostAnalysisAiAnalysisResult | null>(null);
  const cache = new Map<string, CostAnalysisAiAnalysisResult>();
  let generation = 0;
  let activeRequest: ActiveRequest | null = null;

  function selectContext(
    snapshotId: string,
    query: CostAnalysisAiAnalysisQuery,
  ): void {
    const request = { snapshotId, query: { ...query } };
    generation += 1;
    activeRequest = request;
    loading.value = false;
    error.value = null;
    current.value = cache.get(cacheKey(request)) ?? null;
  }

  async function execute(force: boolean): Promise<void> {
    if (!activeRequest || loading.value) return;
    const request = {
      snapshotId: activeRequest.snapshotId,
      query: { ...activeRequest.query },
    };
    const requestGeneration = ++generation;
    error.value = null;
    const key = cacheKey(request);
    const cached = force ? undefined : cache.get(key);
    if (cached) {
      loading.value = false;
      current.value = cached;
      return;
    }

    loading.value = true;
    current.value = null;
    try {
      const result = await requestAnalysis(request.snapshotId, request.query);
      if (requestGeneration !== generation) return;
      cache.set(key, result);
      current.value = result;
    } catch (requestError) {
      if (requestGeneration !== generation) return;
      error.value = normalizeError(requestError);
    } finally {
      if (requestGeneration === generation) {
        loading.value = false;
      }
    }
  }

  async function generate(): Promise<void> {
    await execute(false);
  }

  async function regenerate(): Promise<void> {
    await execute(true);
  }

  async function retry(): Promise<void> {
    await execute(true);
  }

  function clearCurrent(): void {
    generation += 1;
    loading.value = false;
    error.value = null;
    current.value = null;
    activeRequest = null;
  }

  function reset(): void {
    clearCurrent();
    cache.clear();
  }

  return {
    loading,
    error,
    current,
    selectContext,
    generate,
    regenerate,
    retry,
    clearCurrent,
    reset,
  };
}
