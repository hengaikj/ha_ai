import { httpClient, request } from "@/api/http";
import type {
  CostAnalysisAiAnalysisQuery,
  CostAnalysisAiAnalysisResult,
  CostAnalysisBomScope,
  CostAnalysisCategoryNode,
  CostAnalysisColumn,
  CostAnalysisDifferenceDetailQuery,
  CostAnalysisDifferenceDetailResult,
  CostAnalysisExportFile,
  CostAnalysisExportTask,
  CostAnalysisLatestBom,
  CostAnalysisQuery,
  CostAnalysisRemarkUpdate,
  CostAnalysisDimensionType,
  CostAnalysisResult,
} from "@/types/cost-analysis";

function integer(value: unknown, allowZero = false): number {
  const normalized =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (
    !Number.isSafeInteger(normalized) ||
    (allowZero ? normalized < 0 : normalized <= 0)
  ) {
    throw new Error("最新 BOM 返回了不合法的标识字段。");
  }
  return normalized;
}

function costAnalysisInteger(
  value: unknown,
  field: string,
  allowZero = false,
): number {
  try {
    return integer(value, allowZero);
  } catch {
    throw new Error(`成本分析查询返回了不合法的${field}。`);
  }
}

function normalizeCostAnalysisResult(
  raw: CostAnalysisResult,
): CostAnalysisResult {
  const categoryLevel = costAnalysisInteger(
    raw.categoryLevel,
    "分类层级",
    true,
  );
  if (categoryLevel > 3) {
    throw new Error("成本分析查询返回了不支持的分类层级。");
  }

  const points = raw.points.map((point) => ({
    ...point,
    projectId: costAnalysisInteger(point.projectId, "项目标识"),
    valveId: costAnalysisInteger(point.valveId, "阀点标识"),
    bomVersionId: costAnalysisInteger(point.bomVersionId, "BOM 版本标识"),
  }));
  const pointByKey = new Map(points.map((point) => [point.pointKey, point]));

  const patterns = raw.patterns.map((pattern) => ({
    ...pattern,
    patternId: costAnalysisInteger(pattern.patternId, "版型标识", true),
    sortNo: costAnalysisInteger(pattern.sortNo, "版型排序号", true),
  }));
  const patternById = new Map(
    patterns.map((pattern) => [pattern.patternId, pattern]),
  );

  const columns = raw.columns.map((column) => {
    const point = pointByKey.get(column.point.pointKey);
    if (!point) {
      throw new Error("成本分析查询返回了无法匹配的点位列。");
    }
    const patternId = costAnalysisInteger(
      column.pattern.patternId,
      "列版型标识",
      true,
    );
    const pattern = patternById.get(patternId);
    if (!pattern) {
      throw new Error("成本分析查询返回了无法匹配的列版型。");
    }
    return {
      ...column,
      projectId: point.projectId,
      valveId: point.valveId,
      versionId: costAnalysisInteger(
        (column as CostAnalysisColumn & { versionId?: unknown }).versionId ??
          point.bomVersionId,
        "列版本标识",
      ),
      point,
      pattern: {
        ...pattern,
        ...column.pattern,
        patternId,
        sortNo: pattern.sortNo,
      },
    };
  });

  return {
    ...raw,
    categoryLevel: categoryLevel as CostAnalysisResult["categoryLevel"],
    patterns,
    points,
    columns,
  };
}

export const remoteCostAnalysisApi = {
  fetchBomOptions: () =>
    request<CostAnalysisBomScope[]>({
      url: "/cost/analysis/bom-options",
      method: "get",
    }),
  fetchCategoryTree: (
    keyword?: string,
    dimensionType?: CostAnalysisDimensionType,
    parentId?: string,
    level?: number,
  ) =>
    request<CostAnalysisCategoryNode[]>({
      url: "/cost/analysis/categories/tree",
      method: "get",
      params: {
        ...(keyword ? { keyword } : {}),
        ...(dimensionType ? { dimensionType } : {}),
        ...(parentId ? { parentId } : {}),
        ...(level === undefined ? {} : { level }),
      },
    }),
  fetchLatestBom: async (projectId: number, valveId: number) => {
    const bom = await request<CostAnalysisLatestBom>({
      url: `/cost/analysis/projects/${projectId}/latest-bom`,
      method: "get",
      params: { valveId },
    });
    return {
      ...bom,
      projectId: integer(bom.projectId),
      bomVersionId: integer(bom.bomVersionId),
      ...(bom.valveId === undefined ? {} : { valveId: integer(bom.valveId) }),
      patterns: bom.patterns.map((pattern) => ({
        ...pattern,
        patternId: integer(pattern.patternId, true),
        sortNo: integer(pattern.sortNo, true),
      })),
    };
  },
  query: async (data: CostAnalysisQuery) =>
    normalizeCostAnalysisResult(
      await request<CostAnalysisResult>({
        url: "/cost/analysis/query",
        method: "post",
        data,
      }),
    ),
  saveRemark: (snapshotId: string, data: CostAnalysisRemarkUpdate) =>
    request<void>({
      url: `/cost/analysis/snapshots/${snapshotId}/remarks`,
      method: "put",
      data,
    }),
  queryDifferenceDetails: (
    snapshotId: string,
    data: CostAnalysisDifferenceDetailQuery,
  ) =>
    request<CostAnalysisDifferenceDetailResult>({
      url: `/cost/analysis/snapshots/${snapshotId}/difference-details`,
      method: "post",
      data,
    }),
  queryAiAnalysis: (snapshotId: string, data: CostAnalysisAiAnalysisQuery) =>
    request<CostAnalysisAiAnalysisResult>({
      url: `/cost/analysis/snapshots/${snapshotId}/ai-analysis`,
      method: "post",
      data,
    }),
  createExportTask: (snapshotId: string) =>
    request<CostAnalysisExportTask>({
      url: "/cost/analysis/export-tasks",
      method: "post",
      data: { snapshotId },
    }),
  getExportTask: (taskId: string) =>
    request<CostAnalysisExportTask>({
      url: `/cost/analysis/export-tasks/${taskId}`,
      method: "get",
    }),
  downloadExport: async (
    taskId: string,
    fileId: string,
    fileName?: string,
  ): Promise<CostAnalysisExportFile> => ({
    blob: (
      await httpClient.request<Blob>({
        url: `/cost/analysis/export-tasks/${taskId}/files/${fileId}/download`,
        method: "get",
        responseType: "blob",
      })
    ).data,
    fileName: fileName || `成本分析-${fileId}.xlsx`,
  }),
};
