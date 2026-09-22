import { buildCostAnalysisValueKey } from "@/api/cost-analysis/matrix-key";
import type {
  CostAnalysisCategoryLevel,
  CostAnalysisColumn,
  CostAnalysisDimensionType,
  CostAnalysisMetric,
  CostAnalysisPatternOption,
  CostAnalysisPoint,
  CostAnalysisQuery,
  CostAnalysisResult,
} from "@/types/cost-analysis";
import {
  getCostAnalysisDimensionMaxLevel,
  getCostAnalysisDimensionTitle,
  getCostAnalysisDimensionLevelLabel,
  normalizeCostAnalysisDimensionType,
} from "@/pages/cost/analysis/utils/analysis-dimension";

const DETAIL_METRICS: ReadonlyArray<CostAnalysisMetric> = [
  "MIX",
  "CURRENT_COST",
  "TARGET_COST",
  "VARIANCE",
];

const METRIC_LABELS: Record<CostAnalysisMetric, string> = {
  MIX: "MIX",
  CURRENT_COST: "当前成本",
  TARGET_COST: "目标成本",
  VARIANCE: "超差",
};

export interface MatrixColumn {
  id: string;
  label: string;
  ariaLabel: string;
  valueKey: string;
  pattern: CostAnalysisPatternOption;
  point: CostAnalysisPoint;
}

export interface CostAnalysisColumnGroup {
  id: string;
  label: string;
  ariaLabel: string;
  point: CostAnalysisPoint;
  columns: MatrixColumn[];
}

export interface DisplayRow {
  id: string;
  parentCategoryId: string;
  parentCategoryName: string;
  categoryId: string;
  categoryName: string;
  categoryLevel: CostAnalysisCategoryLevel;
  metric: CostAnalysisMetric | "REMARK";
  values: Record<string, number | string | null>;
  subtotal: boolean;
}

export interface DiffInput {
  diffMode: boolean;
  columnIndex: number;
  baseline: number | string | null;
  value: number | string | null;
  metric?: CostAnalysisMetric;
}

export type CostAnalysisMatrixSortMode =
  | "DEFAULT"
  | "CURRENT_COST_DIFF_DESC"
  | "CURRENT_COST_DIFF_ASC"
  | "VARIANCE_DESC";

export const COST_ANALYSIS_MATRIX_SORT_LABELS: Record<
  Exclude<CostAnalysisMatrixSortMode, "DEFAULT">,
  string
> = {
  CURRENT_COST_DIFF_DESC: "当前成本差异降序",
  CURRENT_COST_DIFF_ASC: "当前成本差异升序",
  VARIANCE_DESC: "超差最大",
};

export interface CostAnalysisMatrixSortSelection {
  mode: Exclude<CostAnalysisMatrixSortMode, "DEFAULT">;
  columnKey: string;
}

export interface CostAnalysisMatrixSortOptions {
  mode: CostAnalysisMatrixSortMode;
  columnKey: string | null;
  baselineColumnKey: string | null;
}

export type CostAnalysisMatrixColumn = MatrixColumn;
export type CostAnalysisDisplayRow = DisplayRow;
export type CostAnalysisDiffInput = DiffInput;

export function buildCostAnalysisColumnGroups(
  result: CostAnalysisResult,
  query: CostAnalysisQuery,
): CostAnalysisColumnGroup[] {
  const columns = resolveResultColumns(result, query);
  return query.conditions.flatMap((condition) => {
    const point = result.points.find(
      (item) =>
        item.projectId === condition.projectId &&
        item.valveId === condition.valveId,
    );
    if (!point) return [];
    const pointColumns = columns
      .filter((column) => column.point.pointKey === point.pointKey)
      .sort((left, right) => left.sortNo - right.sortNo)
      .map<MatrixColumn>((column) => ({
        id: column.columnKey,
        label: column.pattern.patternName,
        ariaLabel: `${point.projectName} / ${point.valveName} / ${column.pattern.patternName}，BOM ${point.bomVersionNo}`,
        valueKey: column.columnKey,
        pattern: column.pattern,
        point: column.point,
      }));
    if (pointColumns.length === 0) return [];
    const label = `${point.projectName} / ${point.valveName}`;
    return [
      {
        id: `point-${point.pointKey}`,
        label,
        ariaLabel: `${label}，BOM ${point.bomVersionNo}`,
        point,
        columns: pointColumns,
      },
    ];
  });
}

function resolveResultColumns(
  result: CostAnalysisResult,
  query: CostAnalysisQuery,
): CostAnalysisColumn[] {
  if (result.columns?.length) return result.columns;
  let sortNo = 0;
  return query.conditions.flatMap((condition) => {
    const point = result.points.find(
      (item) =>
        item.projectId === condition.projectId &&
        item.valveId === condition.valveId,
    );
    if (!point) return [];
    return condition.patternIds.flatMap((patternId) => {
      const pattern = result.patterns.find(
        (item) => item.patternId === patternId,
      );
      if (!pattern) return [];
      sortNo += 1;
      return [
        {
          columnKey: buildCostAnalysisValueKey(patternId, point.pointKey),
          point,
          pattern,
          sortNo,
        },
      ];
    });
  });
}

export function buildCostAnalysisDisplayRows(
  result: CostAnalysisResult,
): DisplayRow[] {
  if (result.rows.length === 0) {
    return [];
  }
  const valueKeys = collectValueKeys(result);
  const sourceRows = new Map(
    result.rows.map((row) => [`${row.categoryId}:${row.metric}`, row]),
  );
  const categories =
    result.categoryLevel === 2
      ? result.categories
      : result.categories
          .map((category, index) => ({ category, index }))
          .sort(
            (left, right) =>
              left.category.sortNo - right.category.sortNo ||
              left.index - right.index,
          )
          .map(({ category }) => category);
  const metrics =
    result.categoryLevel ===
    getCostAnalysisDimensionMaxLevel(
      normalizeCostAnalysisDimensionType(result.dimensionType),
    )
      ? (["CURRENT_COST"] as const)
      : DETAIL_METRICS;

  const detailRows = categories.flatMap((category) => {
    const current = sourceRows.get(`${category.id}:CURRENT_COST`);
    const target = sourceRows.get(`${category.id}:TARGET_COST`);
    const parentCategory = resolveParentCategory(result, category);

    return metrics.map((metric): DisplayRow => {
      const values =
        metric === "VARIANCE"
          ? buildVarianceValues(valueKeys, current?.values, target?.values)
          : normalizeValues(
              valueKeys,
              sourceRows.get(`${category.id}:${metric}`)?.values,
            );
      return {
        id: `${category.id}:${metricSlug(metric)}`,
        parentCategoryId: parentCategory.id,
        parentCategoryName: parentCategory.name,
        categoryId: category.id,
        categoryName: category.name,
        categoryLevel: result.categoryLevel,
        metric,
        values,
        subtotal: false,
      };
    });
  });

  const subtotalMetrics: ReadonlyArray<CostAnalysisMetric> =
    result.categoryLevel === 0
      ? []
      : result.categoryLevel ===
          getCostAnalysisDimensionMaxLevel(
            normalizeCostAnalysisDimensionType(result.dimensionType),
          )
        ? ["CURRENT_COST"]
        : ["CURRENT_COST", "TARGET_COST"];
  const subtotalRows = subtotalMetrics.map((metric): DisplayRow => {
    const metricRows = detailRows.filter((row) => row.metric === metric);
    const subtotalId = `subtotal-${result.categoryLevel}-${metricSlug(metric)}`;
    return {
      id: subtotalId,
      parentCategoryId: subtotalId,
      parentCategoryName: "",
      categoryId: subtotalId,
      categoryName: "小计",
      categoryLevel: result.categoryLevel,
      metric,
      values: Object.fromEntries(
        valueKeys.map((valueKey) => [
          valueKey,
          calculateCostAnalysisSubtotal(
            metricRows.map((row) => {
              const value = row.values[valueKey];
              return isFiniteNumber(value) ? value : null;
            }),
          ),
        ]),
      ),
      subtotal: true,
    };
  });

  return [...detailRows, ...subtotalRows];
}

function resolveParentCategory(
  result: CostAnalysisResult,
  category: CostAnalysisResult["categories"][number],
): { id: string; name: string } {
  if (category.level <= 1) {
    const dimensionType = normalizeCostAnalysisDimensionType(
      result.dimensionType,
    );
    return {
      id: `dimension:${dimensionType}`,
      name: getCostAnalysisDimensionTitle(dimensionType),
    };
  }

  const pathSegments = category.path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return {
    id: category.parentId ?? `parent:${category.id}`,
    name:
      result.dimensionType === "RESPONSIBILITY_DEPARTMENT" &&
      category.level === 3
        ? (category.parentPath ??
          category.parentName ??
          pathSegments.at(-2) ??
          "--")
        : (category.parentName ?? pathSegments.at(-2) ?? "--"),
  };
}

export function calculateCostAnalysisSubtotal(
  values: Array<number | null>,
): number | null {
  const numbers = values.filter(isFiniteNumber);
  if (numbers.length === 0) {
    return null;
  }
  return Number(numbers.reduce((total, value) => total + value, 0).toFixed(2));
}

export function sortCostAnalysisDisplayRows(
  rows: DisplayRow[],
  options: CostAnalysisMatrixSortOptions,
): DisplayRow[] {
  if (options.mode === "DEFAULT" || options.columnKey === null) {
    return [...rows];
  }
  if (options.mode !== "VARIANCE_DESC" && !options.baselineColumnKey) {
    return [...rows];
  }
  const baselineValueKey = options.baselineColumnKey;
  const comparisonValueKey = options.columnKey;
  const subtotalRows = rows.filter((row) => row.subtotal);
  const blocks = new Map<
    string,
    { rows: DisplayRow[]; originalIndex: number; sortValue: number | null }
  >();

  rows.forEach((row) => {
    if (row.subtotal) return;
    const block = blocks.get(row.categoryId);
    if (block) {
      block.rows.push(row);
      return;
    }
    blocks.set(row.categoryId, {
      rows: [row],
      originalIndex: blocks.size,
      sortValue: null,
    });
  });

  blocks.forEach((block) => {
    const metric =
      options.mode === "VARIANCE_DESC" ? "VARIANCE" : "CURRENT_COST";
    const metricRow = block.rows.find((row) => row.metric === metric);
    if (!metricRow) return;

    if (options.mode === "VARIANCE_DESC") {
      block.sortValue = normalizeNumericValue(
        metricRow.values[comparisonValueKey],
      );
      return;
    }

    if (!baselineValueKey || !comparisonValueKey) return;
    block.sortValue = calculateCostAnalysisDifference(
      metricRow.values[baselineValueKey] ?? null,
      metricRow.values[comparisonValueKey] ?? null,
      "CURRENT_COST",
    );
  });

  const sortedBlocks = [...blocks.values()].sort((left, right) => {
    if (left.sortValue === null && right.sortValue === null) {
      return left.originalIndex - right.originalIndex;
    }
    if (left.sortValue === null) return 1;
    if (right.sortValue === null) return -1;
    const direction = options.mode === "CURRENT_COST_DIFF_ASC" ? 1 : -1;
    return (
      direction * (left.sortValue - right.sortValue) ||
      left.originalIndex - right.originalIndex
    );
  });

  return [...sortedBlocks.flatMap((block) => block.rows), ...subtotalRows];
}

export function calculateCostAnalysisDifference(
  baseline: number | string | null,
  comparison: number | string | null,
  metric: CostAnalysisMetric,
): number | null {
  const baselineValue = parseComparableValue(baseline);
  const comparisonValue = parseComparableValue(comparison);
  if (
    !baselineValue.valid ||
    !comparisonValue.valid ||
    baselineValue.value === null ||
    comparisonValue.value === null
  ) {
    return null;
  }
  return Number(
    (comparisonValue.value - baselineValue.value).toFixed(
      metric === "MIX" ? 4 : 2,
    ),
  );
}

export function isCostAnalysisDiffCell(input: DiffInput): boolean {
  if (!input.diffMode || input.columnIndex !== 1) {
    return false;
  }
  const baseline = parseComparableValue(input.baseline);
  const value = parseComparableValue(input.value);
  if (!baseline.valid || !value.valid) {
    return false;
  }
  return !Object.is(baseline.value, value.value);
}

export function getCostAnalysisLevelLabel(
  level: CostAnalysisCategoryLevel,
  dimensionType?: CostAnalysisDimensionType,
): string {
  return getCostAnalysisDimensionLevelLabel(
    normalizeCostAnalysisDimensionType(dimensionType),
    level,
  );
}

export function getCostAnalysisMetricLabel(
  metric: CostAnalysisMetric | "REMARK",
): string {
  return metric === "REMARK" ? "备注" : METRIC_LABELS[metric];
}

function collectValueKeys(result: CostAnalysisResult): string[] {
  const valueKeys = new Set<string>();
  result.rows.forEach((row) => {
    Object.keys(row.values).forEach((valueKey) => valueKeys.add(valueKey));
  });
  result.columns?.forEach((column) => valueKeys.add(column.columnKey));
  return [...valueKeys];
}

function normalizeValues(
  valueKeys: string[],
  values?: Record<string, number | string | null>,
): Record<string, number | string | null> {
  return Object.fromEntries(
    valueKeys.map((valueKey) => {
      const value =
        values && Object.hasOwn(values, valueKey) ? values[valueKey] : null;
      return [valueKey, normalizeNumericValue(value)];
    }),
  );
}

function buildVarianceValues(
  valueKeys: string[],
  current?: Record<string, number | string | null>,
  target?: Record<string, number | string | null>,
): Record<string, number | null> {
  return Object.fromEntries(
    valueKeys.map((valueKey) => {
      const currentValue = normalizeNumericValue(current?.[valueKey]);
      const targetValue = normalizeNumericValue(target?.[valueKey]);
      return [
        valueKey,
        isFiniteNumber(currentValue) && isFiniteNumber(targetValue)
          ? Number((currentValue - targetValue).toFixed(2))
          : null,
      ];
    }),
  );
}

function metricSlug(metric: CostAnalysisMetric): string {
  return metric.toLowerCase().replaceAll("_", "-");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeNumericValue(value: unknown): number | null {
  const parsed = parseComparableValue(value);
  return parsed.valid ? parsed.value : null;
}

function parseComparableValue(
  value: unknown,
): { valid: true; value: number | null } | { valid: false; value: null } {
  if (value === null || value === undefined) {
    return { valid: true, value: null };
  }
  if (isFiniteNumber(value)) {
    return { valid: true, value };
  }
  if (typeof value === "string") {
    if (value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return { valid: true, value: parsed };
      }
    }
    return { valid: true, value: null };
  }
  return { valid: false, value: null };
}
