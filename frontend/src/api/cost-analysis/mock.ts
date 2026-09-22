import { ApiBusinessError } from "@/api/http";
import {
  buildCostAnalysisPointKey,
  buildCostAnalysisValueKey,
} from "@/api/cost-analysis/matrix-key";
import { getLocalCostCategoryTree } from "@/api/cost-category/local-repository";
import { cloneResponsibilityDepartmentTree } from "@/api/cost-analysis/mock/responsibility-departments";
import {
  buildMockMetricValue,
  getMockCostAnalysisProjectOptions,
  getMockCostAnalysisValveOptions,
  getMockLatestBom,
  getMockProjectName,
  getMockValveName,
} from "@/api/cost-analysis/mock/datasets";
import type { MockCostAnalysisValveOption } from "@/api/cost-analysis/mock/datasets";
import { buildMockCostAnalysisDifferenceDetail } from "@/api/cost-analysis/mock/difference-details";
import { buildMockCostAnalysisAiAnalysis } from "@/api/cost-analysis/mock/ai-analysis";
import type {
  CostAnalysisAiAnalysisQuery,
  CostAnalysisAiAnalysisResult,
  CostAnalysisCategoryNode,
  CostAnalysisDifferenceDetailQuery,
  CostAnalysisDifferenceDetailResult,
  CostAnalysisDimensionType,
  CostAnalysisExportFile,
  CostAnalysisExportTask,
  CostAnalysisLatestBom,
  CostAnalysisMatrixRow,
  CostAnalysisPatternOption,
  CostAnalysisQuery,
  CostAnalysisRemarkUpdate,
  CostAnalysisResult,
} from "@/types/cost-analysis";
import {
  getCostAnalysisDimensionMaxLevel,
  normalizeCostAnalysisDimensionType,
  withCostAnalysisProjectRoot,
} from "@/api/cost-analysis/dimensions";
import type { BusinessProjectItem } from "@/types/project";

export type CostAnalysisMockScenario =
  | "success"
  | "empty"
  | "partial-permission"
  | "no-permission"
  | "missing-bom"
  | "query-error"
  | "ai-error"
  | "export-error";

interface CostAnalysisSnapshot {
  query: CostAnalysisQuery;
  result: CostAnalysisResult;
}

interface MockValveOption {
  valveId: number;
  valveName: string;
}

let scenario: CostAnalysisMockScenario = "success";
let snapshotCounter = 0;
let taskCounter = 0;
let fileCounter = 0;
let traceCounter = 0;
let sessionVersion = 0;

const snapshots = new Map<string, CostAnalysisSnapshot>();
const exportTasks = new Map<string, CostAnalysisExportTask>();
const exportFiles = new Map<string, CostAnalysisExportFile>();
const valveNamesById = new Map<number, string>();

function flattenCategories(
  nodes: CostAnalysisCategoryNode[],
): CostAnalysisCategoryNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenCategories(node.children ?? []),
  ]);
}

function cloneCategory(
  node: CostAnalysisCategoryNode,
): CostAnalysisCategoryNode {
  return {
    ...node,
    engineers: node.engineers ? [...node.engineers] : undefined,
    coveredParts: node.coveredParts ? [...node.coveredParts] : undefined,
    children: node.children?.map(cloneCategory),
  };
}

function rawDimensionTree(dimensionType: CostAnalysisDimensionType) {
  return dimensionType === "RESPONSIBILITY_DEPARTMENT"
    ? cloneResponsibilityDepartmentTree()
    : getLocalCostCategoryTree();
}

function categoryIndex(dimensionType: CostAnalysisDimensionType) {
  const tree = withCostAnalysisProjectRoot(
    dimensionType,
    rawDimensionTree(dimensionType),
  );
  const allCategories = flattenCategories(tree);
  return {
    tree,
    allCategories,
    categoriesById: new Map(
      allCategories.map((category) => [category.id, category]),
    ),
  };
}

function cloneQuery(query: CostAnalysisQuery): CostAnalysisQuery {
  return {
    ...query,
    dimensionType: normalizeCostAnalysisDimensionType(query.dimensionType),
    categoryIds: [...query.categoryIds],
    conditions: query.conditions.map((condition) => ({
      ...condition,
      patternIds: [...condition.patternIds],
    })),
  };
}

function cloneResult(result: CostAnalysisResult): CostAnalysisResult {
  return {
    ...result,
    categories: result.categories.map(cloneCategory),
    patterns: result.patterns.map((pattern) => ({ ...pattern })),
    points: result.points.map((point) => ({ ...point })),
    columns: result.columns.map((column) => ({
      ...column,
      point: { ...column.point },
      pattern: { ...column.pattern },
    })),
    rows: result.rows.map((row) => ({
      ...row,
      values: { ...row.values },
    })),
  };
}

function nextId(prefix: string, counter: number): string {
  return `${prefix}-${String(counter).padStart(4, "0")}`;
}

function traceId(operation: string): string {
  traceCounter += 1;
  return `cost-analysis-mock-${operation}-${String(traceCounter).padStart(
    4,
    "0",
  )}`;
}

function businessError(
  code: string,
  message: string,
  operation: string,
): ApiBusinessError {
  return new ApiBusinessError({
    code,
    message,
    traceId: traceId(operation),
  });
}

function filterTree(
  nodes: CostAnalysisCategoryNode[],
  keepSecondary: (node: CostAnalysisCategoryNode) => boolean,
): CostAnalysisCategoryNode[] {
  return nodes.flatMap((levelOne) => {
    const children = (levelOne.children ?? []).flatMap((levelTwo) => {
      if (!keepSecondary(levelTwo)) return [];
      return [
        {
          ...cloneCategory(levelTwo),
          children: levelTwo.children?.map(cloneCategory) ?? [],
        },
      ];
    });
    return children.length > 0
      ? [{ ...cloneCategory(levelOne), children }]
      : [];
  });
}

function permissionTree(
  dimensionType: CostAnalysisDimensionType,
): CostAnalysisCategoryNode[] {
  if (dimensionType === "RESPONSIBILITY_DEPARTMENT") {
    return withCostAnalysisProjectRoot(
      dimensionType,
      cloneResponsibilityDepartmentTree(),
    );
  }
  if (scenario === "no-permission") return [];
  const tree = rawDimensionTree(dimensionType);
  const allCategories = flattenCategories(tree);
  if (scenario === "partial-permission") {
    const partialSecondaryIds = new Set(
      allCategories
        .filter((category) => category.level === 2)
        .slice(0, 8)
        .map((category) => category.id),
    );
    return withCostAnalysisProjectRoot(
      dimensionType,
      filterTree(tree, (node) => partialSecondaryIds.has(node.id)),
    );
  }
  return withCostAnalysisProjectRoot(dimensionType, tree.map(cloneCategory));
}

function filterByKeyword(
  nodes: CostAnalysisCategoryNode[],
  keyword?: string,
): CostAnalysisCategoryNode[] {
  const normalizedKeyword = keyword?.trim().toLowerCase();
  if (!normalizedKeyword) return nodes.map(cloneCategory);

  return nodes.flatMap((node) => {
    const children = filterByKeyword(node.children ?? [], normalizedKeyword);
    const matched = [node.name, node.code, node.path].some((value) =>
      value.toLowerCase().includes(normalizedKeyword),
    );
    return matched || children.length > 0
      ? [{ ...cloneCategory(node), children }]
      : [];
  });
}

function authorizedCategoryIds(
  dimensionType: CostAnalysisDimensionType,
): Set<string> {
  return new Set(
    flattenCategories(permissionTree(dimensionType)).map((node) => node.id),
  );
}

function validateCategoryPermission(
  dimensionType: CostAnalysisDimensionType,
  categoryIds: string[],
): void {
  const authorizedIds = authorizedCategoryIds(dimensionType);
  if (categoryIds.some((categoryId) => !authorizedIds.has(categoryId))) {
    throw businessError(
      "COST_ANALYSIS_CATEGORY_FORBIDDEN",
      "无权访问所选分析维度。",
      "category",
    );
  }
}

function invalidQuery(message: string): never {
  throw businessError(
    "COST_ANALYSIS_INVALID_QUERY",
    message,
    "query-validation",
  );
}

function validateQuery(query: CostAnalysisQuery): void {
  const dimensionType = normalizeCostAnalysisDimensionType(query.dimensionType);
  const maxLevel = getCostAnalysisDimensionMaxLevel(dimensionType);
  if (query.categoryLevel < 0 || query.categoryLevel > maxLevel) {
    invalidQuery("分析维度层级无效。");
  }
  if (
    query.categoryIds.length === 0 ||
    new Set(query.categoryIds).size !== query.categoryIds.length
  ) {
    invalidQuery("至少选择一个不重复的当前层级分析项。");
  }
  const { categoriesById } = categoryIndex(dimensionType);
  const selectedCategories = query.categoryIds.map((categoryId) =>
    categoriesById.get(categoryId),
  );
  if (
    selectedCategories.some(
      (category) => !category || category.level !== query.categoryLevel,
    )
  ) {
    invalidQuery("所选分析项不存在或与当前层级不一致。");
  }
  if (query.conditions.length === 0) {
    invalidQuery("至少需要一条完整查询条件。");
  }
  if (query.conditions.length > 6) {
    invalidQuery("最多允许六条查询条件。");
  }

  const pointKeys = new Set<string>();
  query.conditions.forEach((condition) => {
    if (
      !Number.isSafeInteger(condition.projectId) ||
      !Number.isSafeInteger(condition.valveId) ||
      condition.projectId <= 0 ||
      condition.valveId <= 0 ||
      condition.patternIds.length === 0 ||
      new Set(condition.patternIds).size !== condition.patternIds.length
    ) {
      invalidQuery("项目、阀点和版型条件不完整。");
    }
    const bom = getMockLatestBom(condition.projectId);
    if (
      !bom ||
      condition.patternIds.some(
        (patternId) =>
          !bom.patterns.some((pattern) => pattern.patternId === patternId),
      )
    ) {
      invalidQuery("项目不存在或选择了当前 BOM 不包含的版型。");
    }
    const pointKey = buildCostAnalysisPointKey(
      condition.projectId,
      condition.valveId,
    );
    if (pointKeys.has(pointKey)) {
      invalidQuery("项目和阀点组合不能重复。");
    }
    pointKeys.add(pointKey);
  });
}

function latestBomOrThrow(projectId: number): CostAnalysisLatestBom {
  if (scenario === "missing-bom") {
    throw businessError(
      "COST_ANALYSIS_LATEST_BOM_NOT_FOUND",
      "项目暂无可用最新 BOM。",
      "latest-bom",
    );
  }
  const bom = getMockLatestBom(projectId);
  if (!bom) {
    throw businessError(
      "COST_ANALYSIS_LATEST_BOM_NOT_FOUND",
      "项目暂无可用最新 BOM。",
      "latest-bom",
    );
  }
  return bom;
}

function buildPatterns(
  query: CostAnalysisQuery,
  boms: CostAnalysisLatestBom[],
): CostAnalysisPatternOption[] {
  const weighted: CostAnalysisPatternOption[] = [];
  const normal: CostAnalysisPatternOption[] = [];
  const seen = new Set<number>();

  query.conditions.forEach((condition, index) => {
    boms[index].patterns.forEach((pattern) => {
      if (
        seen.has(pattern.patternId) ||
        !condition.patternIds.includes(pattern.patternId)
      ) {
        return;
      }
      seen.add(pattern.patternId);
      (pattern.patternType === "WEIGHTED" ? weighted : normal).push({
        ...pattern,
      });
    });
  });
  return [...weighted, ...normal].map((pattern, index) => ({
    ...pattern,
    sortNo: index + 1,
  }));
}

function buildColumns(
  query: CostAnalysisQuery,
  boms: CostAnalysisLatestBom[],
  points: CostAnalysisResult["points"],
): CostAnalysisResult["columns"] {
  let sortNo = 0;
  return query.conditions.flatMap((condition, index) => {
    const point = points[index];
    const selectedPatternIds = new Set(condition.patternIds);
    return boms[index].patterns.flatMap((pattern) => {
      if (!selectedPatternIds.has(pattern.patternId)) return [];
      sortNo += 1;
      return [
        {
          columnKey: buildCostAnalysisValueKey(
            pattern.patternId,
            point.pointKey,
          ),
          point: { ...point },
          pattern: { ...pattern },
          sortNo,
        },
      ];
    });
  });
}

function buildRows(
  query: CostAnalysisQuery,
  categories: CostAnalysisCategoryNode[],
): CostAnalysisMatrixRow[] {
  const metrics: Array<"MIX" | "CURRENT_COST" | "TARGET_COST"> =
    query.categoryLevel === 3
      ? ["CURRENT_COST"]
      : ["MIX", "CURRENT_COST", "TARGET_COST"];

  return categories.flatMap((category) =>
    metrics.map((metric) => {
      const values: CostAnalysisMatrixRow["values"] = {};
      query.conditions.forEach((condition) => {
        const pointKey = buildCostAnalysisPointKey(
          condition.projectId,
          condition.valveId,
        );
        condition.patternIds.forEach((patternId) => {
          const valueKey = buildCostAnalysisValueKey(patternId, pointKey);
          values[valueKey] = buildMockMetricValue(
            metric,
            category.id,
            patternId,
            condition.projectId,
            condition.valveId,
          );
        });
      });
      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryLevel: query.categoryLevel,
        metric,
        values,
        subtotal: false,
      };
    }),
  );
}

function cloneTask(task: CostAnalysisExportTask): CostAnalysisExportTask {
  return {
    ...task,
    error: task.error ? { ...task.error } : undefined,
  };
}

function isActiveExportTask(
  taskSessionVersion: number,
  task: CostAnalysisExportTask,
  snapshot: CostAnalysisSnapshot,
): boolean {
  return (
    taskSessionVersion === sessionVersion &&
    exportTasks.get(task.taskId) === task &&
    snapshots.get(task.snapshotId) === snapshot
  );
}

function failExportTask(task: CostAnalysisExportTask): void {
  task.status = "FAILED";
  task.completedAt = new Date().toISOString();
  task.error = {
    code: "COST_ANALYSIS_EXPORT_FAILED",
    message: "成本分析导出任务失败。",
    traceId: traceId("export"),
  };
}

async function completeExportTask(
  taskSessionVersion: number,
  task: CostAnalysisExportTask,
  snapshot: CostAnalysisSnapshot,
  exportInput: CostAnalysisSnapshot,
  shouldFail: boolean,
): Promise<void> {
  if (!isActiveExportTask(taskSessionVersion, task, snapshot)) return;
  if (shouldFail) {
    failExportTask(task);
    return;
  }

  try {
    const { buildCostAnalysisWorkbook } =
      await import("@/api/cost-analysis/mock/export-workbook");
    if (!isActiveExportTask(taskSessionVersion, task, snapshot)) return;
    const blob = await buildCostAnalysisWorkbook(
      exportInput.query,
      exportInput.result,
    );
    if (!isActiveExportTask(taskSessionVersion, task, snapshot)) return;

    fileCounter += 1;
    const fileId = nextId("export-file", fileCounter);
    const fileName = `成本分析-${task.snapshotId}.xlsx`;
    exportFiles.set(fileId, { blob, fileName });
    task.status = "SUCCEEDED";
    task.completedAt = new Date().toISOString();
    task.fileId = fileId;
    task.fileName = fileName;
  } catch {
    if (isActiveExportTask(taskSessionVersion, task, snapshot)) {
      failExportTask(task);
    }
  }
}

export function configureCostAnalysisMockScenario(
  nextScenario: CostAnalysisMockScenario,
): void {
  scenario = nextScenario;
}

export function resetCostAnalysisMock(): void {
  sessionVersion += 1;
  scenario = "success";
  snapshotCounter = 0;
  taskCounter = 0;
  fileCounter = 0;
  traceCounter = 0;
  snapshots.clear();
  exportTasks.clear();
  exportFiles.clear();
  valveNamesById.clear();
}

export function setMockCostAnalysisValveOptions(
  valves: ReadonlyArray<MockValveOption>,
): void {
  valveNamesById.clear();
  valves.forEach((valve) => {
    if (
      Number.isSafeInteger(valve.valveId) &&
      valve.valveId > 0 &&
      valve.valveName
    ) {
      valveNamesById.set(valve.valveId, valve.valveName);
    }
  });
}

export async function fetchMockCostAnalysisProjectOptions(): Promise<
  BusinessProjectItem[]
> {
  return getMockCostAnalysisProjectOptions();
}

export async function fetchMockCostAnalysisValveOptions(): Promise<
  MockCostAnalysisValveOption[]
> {
  const valves = getMockCostAnalysisValveOptions();
  setMockCostAnalysisValveOptions(valves);
  return valves;
}

export async function fetchMockCostAnalysisCategoryTree(
  keyword?: string,
  dimensionType?: CostAnalysisDimensionType,
): Promise<CostAnalysisCategoryNode[]> {
  return fetchMockCostAnalysisDimensionTree(
    dimensionType ?? "VEHICLE_SYSTEM",
    keyword,
  );
}

export async function fetchMockCostAnalysisDimensionTree(
  dimensionType: CostAnalysisDimensionType,
  keyword?: string,
): Promise<CostAnalysisCategoryNode[]> {
  return filterByKeyword(permissionTree(dimensionType), keyword);
}

export async function fetchMockCostAnalysisLatestBom(
  projectId: number,
  _valveId?: number,
): Promise<CostAnalysisLatestBom> {
  return latestBomOrThrow(projectId);
}

export async function queryMockCostAnalysis(
  query: CostAnalysisQuery,
): Promise<CostAnalysisResult> {
  const dimensionType = normalizeCostAnalysisDimensionType(query.dimensionType);
  validateQuery(query);
  validateCategoryPermission(dimensionType, query.categoryIds);
  if (scenario === "query-error") {
    throw businessError(
      "COST_ANALYSIS_INTERNAL_ERROR",
      "成本分析 Mock 查询失败。",
      "query",
    );
  }

  const boms = query.conditions.map((condition) =>
    latestBomOrThrow(condition.projectId),
  );
  const selectedIds = new Set(query.categoryIds);
  const { allCategories } = categoryIndex(dimensionType);
  const categories = allCategories
    .filter(
      (category) =>
        category.level === query.categoryLevel && selectedIds.has(category.id),
    )
    .map(cloneCategory);
  snapshotCounter += 1;
  const snapshotId = nextId("snapshot", snapshotCounter);
  const rows = scenario === "empty" ? [] : buildRows(query, categories);
  const points = query.conditions.map((condition, index) => ({
    pointKey: buildCostAnalysisPointKey(condition.projectId, condition.valveId),
    projectId: condition.projectId,
    projectName:
      getMockProjectName(condition.projectId) ?? String(condition.projectId),
    valveId: condition.valveId,
    valveName:
      valveNamesById.get(condition.valveId) ??
      getMockValveName(condition.valveId),
    bomVersionId: boms[index].bomVersionId,
    bomVersionNo: boms[index].bomVersionNo,
    bomUpdatedAt: boms[index].bomUpdatedAt,
  }));
  const result: CostAnalysisResult = {
    snapshotId,
    dimensionType,
    categoryLevel: query.categoryLevel,
    categories,
    patterns: buildPatterns(query, boms),
    points,
    columns: buildColumns(query, boms, points),
    rows,
    queriedAt: new Date().toISOString(),
  };
  snapshots.set(snapshotId, {
    query: cloneQuery(query),
    result: cloneResult(result),
  });
  return cloneResult(result);
}

export async function saveMockCostAnalysisRemark(
  snapshotId: string,
  data: CostAnalysisRemarkUpdate,
): Promise<void> {
  const snapshot = snapshots.get(snapshotId);
  if (!snapshot) {
    throw businessError(
      "COST_ANALYSIS_SNAPSHOT_NOT_FOUND",
      "成本分析快照不存在或已过期，请重新查询。",
      "remark-snapshot",
    );
  }
  if (!snapshot.result.categories.some((item) => item.id === data.categoryId)) {
    throw businessError("COST_ANALYSIS_CATEGORY_NOT_FOUND", "备注分类不属于当前快照。", "remark-category");
  }
  if (!snapshot.result.columns.some((item) => item.columnKey === data.columnKey)) {
    throw businessError("COST_ANALYSIS_COLUMN_NOT_FOUND", "备注列不属于当前快照。", "remark-column");
  }
  // The matrix keeps the draft locally; this call verifies the same snapshot
  // contract used by the remote implementation.
}

async function queryMockCostAnalysisDifferenceDetailsInternal(
  snapshotId: string,
  query: CostAnalysisDifferenceDetailQuery,
  includeAllRows: boolean,
): Promise<CostAnalysisDifferenceDetailResult> {
  const snapshot = snapshots.get(snapshotId);
  if (!snapshot) {
    throw businessError(
      "COST_ANALYSIS_SNAPSHOT_NOT_FOUND",
      "成本分析快照不存在或已过期，请重新查询。",
      "difference-snapshot",
    );
  }
  const isVarianceTrace = query.traceType === "COST_VARIANCE";
  const selectedColumnKeys = isVarianceTrace
    ? [query.columnKey]
    : [query.baselineColumnKey, query.comparisonColumnKey];
  if (
    (!isVarianceTrace &&
      query.baselineColumnKey === query.comparisonColumnKey) ||
    selectedColumnKeys.some(
      (columnKey) =>
        !snapshot.result.columns.some(
          (column) => column.columnKey === columnKey,
        ),
    )
  ) {
    throw businessError(
      "COST_ANALYSIS_DIFF_SELECTION_INVALID",
      "差异对比对象无效或不属于当前快照。",
      "difference-selection",
    );
  }
  const dimensionType = normalizeCostAnalysisDimensionType(
    snapshot.query.dimensionType,
  );
  if (
    query.dimensionType &&
    normalizeCostAnalysisDimensionType(query.dimensionType) !== dimensionType
  ) {
    throw businessError(
      "COST_ANALYSIS_CATEGORY_NOT_FOUND",
      "分析维度不属于当前查询快照。",
      "difference-category",
    );
  }
  const { categoriesById } = categoryIndex(dimensionType);
  const category = categoriesById.get(query.categoryId);
  if (!category || category.level !== query.categoryLevel) {
    throw businessError(
      "COST_ANALYSIS_CATEGORY_NOT_FOUND",
      "分析维度节点不存在或层级不匹配。",
      "difference-category",
    );
  }
  validateCategoryPermission(dimensionType, [category.id]);
  const categoryAncestorIds = new Set<string>();
  let categoryAncestor: CostAnalysisCategoryNode | undefined = category;
  while (categoryAncestor) {
    categoryAncestorIds.add(categoryAncestor.id);
    categoryAncestor = categoryAncestor.parentId
      ? categoriesById.get(categoryAncestor.parentId)
      : undefined;
  }
  if (
    !snapshot.query.categoryIds.some((categoryId) =>
      categoryAncestorIds.has(categoryId),
    )
  ) {
    throw businessError(
      "COST_ANALYSIS_CATEGORY_NOT_FOUND",
      "分析维度节点不属于当前查询快照。",
      "difference-category",
    );
  }
  const terminalLevel = getCostAnalysisDimensionMaxLevel(dimensionType) as
    | 2
    | 3;
  if (
    query.viewLevel !== undefined &&
    (query.viewLevel <= query.categoryLevel || query.viewLevel > terminalLevel)
  ) {
    throw businessError(
      "COST_ANALYSIS_DIFF_SELECTION_INVALID",
      "查看层级必须是当前对象的更深分类层级。",
      "difference-view-level",
    );
  }
  const isPartDetail =
    query.categoryLevel === terminalLevel && query.viewLevel === undefined;
  if (
    isPartDetail &&
    ((isVarianceTrace
      ? query.metric !== "VARIANCE"
      : query.metric !== "CURRENT_COST") ||
      (query.limit !== undefined && query.limit !== 10))
  ) {
    throw businessError(
      "COST_ANALYSIS_DIFF_SELECTION_INVALID",
      isVarianceTrace
        ? "末级分析维度仅支持超差 Top10 零件溯源。"
        : "末级分析维度仅支持当前成本 Top10 差异溯源。",
      "difference-selection",
    );
  }

  return buildMockCostAnalysisDifferenceDetail(
    snapshot,
    { ...query, dimensionType },
    category,
    categoriesById,
    {
      includeAllRows: includeAllRows || query.partScope === "ALL",
      terminalLevel,
      dimensionType,
    },
  );
}

export async function queryMockCostAnalysisDifferenceDetails(
  snapshotId: string,
  query: CostAnalysisDifferenceDetailQuery,
): Promise<CostAnalysisDifferenceDetailResult> {
  return queryMockCostAnalysisDifferenceDetailsInternal(
    snapshotId,
    query,
    false,
  );
}

export async function queryMockCostAnalysisAiAnalysis(
  snapshotId: string,
  query: CostAnalysisAiAnalysisQuery,
): Promise<CostAnalysisAiAnalysisResult> {
  if (scenario === "ai-error") {
    throw businessError(
      "COST_ANALYSIS_AI_ANALYSIS_FAILED",
      "成本分析 AI 汇总 Mock 生成失败。",
      "ai-analysis",
    );
  }
  return buildMockCostAnalysisAiAnalysis(
    snapshotId,
    query,
    (currentSnapshotId, detailQuery) =>
      queryMockCostAnalysisDifferenceDetailsInternal(
        currentSnapshotId,
        detailQuery,
        true,
      ),
  );
}

export async function createMockCostAnalysisExportTask(
  snapshotId: string,
): Promise<CostAnalysisExportTask> {
  const snapshot = snapshots.get(snapshotId);
  if (!snapshot) {
    throw businessError(
      "COST_ANALYSIS_EXPORT_FAILED",
      "导出快照不存在或已失效。",
      "export",
    );
  }
  validateCategoryPermission(
    normalizeCostAnalysisDimensionType(snapshot.query.dimensionType),
    snapshot.query.categoryIds,
  );
  const exportInput: CostAnalysisSnapshot = {
    query: cloneQuery(snapshot.query),
    result: cloneResult(snapshot.result),
  };

  taskCounter += 1;
  const taskId = nextId("export-task", taskCounter);
  const task: CostAnalysisExportTask = {
    taskId,
    snapshotId,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  exportTasks.set(taskId, task);
  const shouldFail = scenario === "export-error";
  const taskSessionVersion = sessionVersion;

  setTimeout(() => {
    if (!isActiveExportTask(taskSessionVersion, task, snapshot)) return;
    if (task.status === "PENDING") {
      task.status = "PROCESSING";
    }
  }, 100);

  setTimeout(() => {
    if (!isActiveExportTask(taskSessionVersion, task, snapshot)) return;
    void completeExportTask(
      taskSessionVersion,
      task,
      snapshot,
      exportInput,
      shouldFail,
    );
  }, 800);

  return cloneTask(task);
}

export async function getMockCostAnalysisExportTask(
  taskId: string,
): Promise<CostAnalysisExportTask> {
  const task = exportTasks.get(taskId);
  if (!task) {
    throw businessError(
      "COST_ANALYSIS_EXPORT_FAILED",
      "导出任务不存在或已失效。",
      "export",
    );
  }
  return cloneTask(task);
}

export async function downloadMockCostAnalysisExport(
  _taskId: string,
  fileId: string,
  fileName?: string,
): Promise<CostAnalysisExportFile> {
  const file = exportFiles.get(fileId);
  if (!file) {
    throw businessError(
      "COST_ANALYSIS_EXPORT_FAILED",
      "导出文件不存在或已失效。",
      "export",
    );
  }
  return {
    blob: file.blob,
    fileName: fileName ?? file.fileName,
  };
}

export const mockCostAnalysisApi = {
  fetchBomOptions: async () => [],
  fetchCategoryTree: fetchMockCostAnalysisCategoryTree,
  fetchLatestBom: fetchMockCostAnalysisLatestBom,
  query: queryMockCostAnalysis,
  saveRemark: saveMockCostAnalysisRemark,
  queryDifferenceDetails: queryMockCostAnalysisDifferenceDetails,
  queryAiAnalysis: queryMockCostAnalysisAiAnalysis,
  createExportTask: createMockCostAnalysisExportTask,
  getExportTask: getMockCostAnalysisExportTask,
  downloadExport: downloadMockCostAnalysisExport,
};
