import { buildMockMetricValue } from "@/api/cost-analysis/mock/datasets";
import { buildCostAnalysisValueKey } from "@/api/cost-analysis/matrix-key";
import type {
  CostAnalysisCategoryNode,
  CostAnalysisColumn,
  CostAnalysisDifferenceChangedField,
  CostAnalysisDifferenceDetailQuery,
  CostAnalysisDifferenceDetailResult,
  CostAnalysisDifferenceDetailRow,
  CostAnalysisDimensionType,
  CostAnalysisDifferenceViewLevel,
  CostAnalysisMatrixRow,
  CostAnalysisMetric,
  CostAnalysisPatternOption,
  CostAnalysisPoint,
} from "@/types/cost-analysis";

export interface MockCostAnalysisDifferenceSnapshot {
  result: {
    snapshotId: string;
    categories: CostAnalysisCategoryNode[];
    points: CostAnalysisPoint[];
    patterns: CostAnalysisPatternOption[];
    columns: CostAnalysisColumn[];
    rows: CostAnalysisMatrixRow[];
  };
}

const PART_REMAINDER_WEIGHTS = [
  0.25, 0.25, 0.14, 0.1, 0.08, 0.06, 0.04, 0.03, 0.025, 0.025,
] as const;

function stableHash(seed: string): number {
  return Array.from(seed).reduce(
    (value, character) => (value * 33 + character.charCodeAt(0)) >>> 0,
    2_166_136_261,
  );
}

function precision(metric: CostAnalysisDifferenceDetailQuery["metric"]) {
  return metric === "MIX" ? 4 : 2;
}

function isVarianceQuery(
  query: CostAnalysisDifferenceDetailQuery,
): query is Extract<
  CostAnalysisDifferenceDetailQuery,
  { traceType: "COST_VARIANCE" }
> {
  return query.traceType === "COST_VARIANCE";
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  const normalized = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function allocate(
  total: number,
  weights: readonly number[],
  digits: number,
): number[] {
  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return round(total - allocated, digits);
    }
    const value = round(total * weight, digits);
    allocated = round(allocated + value, digits);
    return value;
  });
}

function categoryWeights(categories: CostAnalysisCategoryNode[]): number[] {
  const raw = categories.map((category) => 10 + (stableHash(category.id) % 91));
  const total = raw.reduce((sum, value) => sum + value, 0);
  return raw.map((value) => value / total);
}

function metricValue(
  metric: CostAnalysisDifferenceDetailQuery["metric"],
  categoryId: string,
  patternId: number,
  point: CostAnalysisPoint,
): number {
  if (metric === "VARIANCE") {
    return round(
      buildMockMetricValue(
        "CURRENT_COST",
        categoryId,
        patternId,
        point.projectId,
        point.valveId,
      ) -
        buildMockMetricValue(
          "TARGET_COST",
          categoryId,
          patternId,
          point.projectId,
          point.valveId,
        ),
      2,
    );
  }
  return buildMockMetricValue(
    metric,
    categoryId,
    patternId,
    point.projectId,
    point.valveId,
  );
}

function allocatedMetricValues(
  snapshot: MockCostAnalysisDifferenceSnapshot,
  category: CostAnalysisCategoryNode,
  query: CostAnalysisDifferenceDetailQuery,
  baseline: CostAnalysisPoint,
  comparison: CostAnalysisPoint,
  baselinePatternId: number,
  comparisonPatternId: number,
  categoriesById: ReadonlyMap<string, CostAnalysisCategoryNode>,
): {
  baselineValue: number;
  comparisonValue: number;
} {
  const path: CostAnalysisCategoryNode[] = [];
  let current: CostAnalysisCategoryNode | undefined = category;
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? categoriesById.get(current.parentId)
      : undefined;
  }

  const baselineMetric = isVarianceQuery(query) ? "TARGET_COST" : query.metric;
  const comparisonMetric = isVarianceQuery(query)
    ? "CURRENT_COST"
    : query.metric;
  const digits = precision(query.metric);
  const snapshotCategoryIds = new Set(
    snapshot.result.categories.map((item) => item.id),
  );
  let anchorIndex = 0;
  path.forEach((item, index) => {
    if (snapshotCategoryIds.has(item.id)) {
      anchorIndex = index;
    }
  });
  const anchor = path[anchorIndex] ?? category;
  const snapshotValue = (metric: typeof baselineMetric, columnKey: string) => {
    const value = snapshot.result.rows.find(
      (row) => row.categoryId === anchor.id && row.metric === metric,
    )?.values[columnKey];
    return typeof value === "number" ? value : null;
  };
  let baselineValue =
    snapshotValue(
      baselineMetric,
      buildCostAnalysisValueKey(baselinePatternId, baseline.pointKey),
    ) ?? metricValue(baselineMetric, anchor.id, baselinePatternId, baseline);
  let comparisonValue =
    snapshotValue(
      comparisonMetric,
      buildCostAnalysisValueKey(comparisonPatternId, comparison.pointKey),
    ) ??
    metricValue(comparisonMetric, anchor.id, comparisonPatternId, comparison);

  for (const child of path.slice(anchorIndex + 1)) {
    const parent = categoriesById.get(child.parentId ?? "");
    const siblings = parent?.children ?? [];
    const childIndex = siblings.findIndex((item) => item.id === child.id);
    if (childIndex < 0) break;

    const weights = categoryWeights(siblings);
    const baselineValues = allocate(baselineValue, weights, digits);
    const differences = allocate(
      round(comparisonValue - baselineValue, digits),
      weights,
      digits,
    );
    baselineValue = baselineValues[childIndex];
    comparisonValue = round(baselineValue + differences[childIndex], digits);
  }

  return { baselineValue, comparisonValue };
}

function metricField(
  metric: CostAnalysisMetric,
  baselineValue: number,
  comparisonValue: number,
): CostAnalysisDifferenceChangedField {
  const labels: Record<
    CostAnalysisMetric,
    [string, string, "MONEY" | "PERCENT"]
  > = {
    MIX: ["mix", "MIX", "PERCENT"],
    CURRENT_COST: ["currentCost", "当前成本", "MONEY"],
    TARGET_COST: ["targetCost", "目标成本", "MONEY"],
    VARIANCE: ["variance", "超差", "MONEY"],
  };
  const [fieldCode, fieldName, dataType] = labels[metric];
  return {
    fieldCode,
    fieldName,
    fieldGroup: "成本指标",
    dataType,
    baselineValue,
    comparisonValue,
    difference: round(comparisonValue - baselineValue, precision(metric)),
  };
}

function buildCategoryChangedFields(
  category: CostAnalysisCategoryNode,
  query: CostAnalysisDifferenceDetailQuery,
  baselinePatternId: number,
  comparisonPatternId: number,
  baseline: CostAnalysisPoint,
  comparison: CostAnalysisPoint,
  baselineValue: number,
  comparisonValue: number,
): CostAnalysisDifferenceChangedField[] {
  if (isVarianceQuery(query)) {
    return [metricField("VARIANCE", baselineValue, comparisonValue)];
  }
  return (["MIX", "CURRENT_COST", "TARGET_COST", "VARIANCE"] as const).flatMap(
    (metric) => {
      const baselineValue = metricValue(
        metric,
        category.id,
        baselinePatternId,
        baseline,
      );
      const comparisonValue = metricValue(
        metric,
        category.id,
        comparisonPatternId,
        comparison,
      );
      return baselineValue === comparisonValue
        ? []
        : [metricField(metric, baselineValue, comparisonValue)];
    },
  );
}

function contributionRate(
  difference: number,
  parentDifference: number,
): number | null {
  return parentDifference === 0
    ? null
    : round(difference / parentDifference, 6);
}

function sortRows(
  rows: CostAnalysisDifferenceDetailRow[],
): CostAnalysisDifferenceDetailRow[] {
  return [...rows].sort(
    (left, right) =>
      Math.abs(right.difference ?? 0) - Math.abs(left.difference ?? 0) ||
      left.objectCode.localeCompare(right.objectCode),
  );
}

function buildCategoryRows(
  category: CostAnalysisCategoryNode,
  query: CostAnalysisDifferenceDetailQuery,
  baseline: CostAnalysisPoint,
  comparison: CostAnalysisPoint,
  baselinePatternId: number,
  comparisonPatternId: number,
  baselineValue: number,
  difference: number,
  terminalLevel: 2 | 3,
): CostAnalysisDifferenceDetailRow[] {
  const children = category.children ?? [];
  const digits = precision(query.metric);
  const weights = categoryWeights(children);
  const baselineValues = allocate(baselineValue, weights, digits);
  const differences = allocate(difference, weights, digits);

  return sortRows(
    children.map((child, index) => ({
      objectType: "CATEGORY",
      objectId: child.id,
      objectCode: child.code,
      objectName: child.name,
      status: "CHANGED",
      baselineValue: baselineValues[index],
      comparisonValue: round(
        baselineValues[index] + differences[index],
        digits,
      ),
      difference: differences[index],
      contributionRate: contributionRate(differences[index], difference),
      movementShare: null,
      hasChildren:
        (child.children?.length ?? 0) > 0 ||
        (child.level === terminalLevel &&
          (query.metric === "CURRENT_COST" || isVarianceQuery(query))),
      changedFields: buildCategoryChangedFields(
        child,
        query,
        baselinePatternId,
        comparisonPatternId,
        baseline,
        comparison,
        baselineValues[index],
        round(baselineValues[index] + differences[index], digits),
      ),
    })),
  );
}

function collectCategoriesAtLevel(
  category: CostAnalysisCategoryNode,
  targetLevel: CostAnalysisDifferenceViewLevel,
): CostAnalysisCategoryNode[] {
  if (category.level === targetLevel) return [category];
  return (category.children ?? []).flatMap((child) =>
    collectCategoriesAtLevel(child, targetLevel),
  );
}

function buildCategoryRowsAtLevel(
  snapshot: MockCostAnalysisDifferenceSnapshot,
  category: CostAnalysisCategoryNode,
  query: CostAnalysisDifferenceDetailQuery,
  baseline: CostAnalysisPoint,
  comparison: CostAnalysisPoint,
  baselinePatternId: number,
  comparisonPatternId: number,
  categoriesById: ReadonlyMap<string, CostAnalysisCategoryNode>,
  targetLevel: CostAnalysisDifferenceViewLevel,
  parentDifference: number,
  terminalLevel: 2 | 3,
): CostAnalysisDifferenceDetailRow[] {
  const digits = precision(query.metric);
  const targetCategories = collectCategoriesAtLevel(category, targetLevel);

  return sortRows(
    targetCategories.map((targetCategory) => {
      const { baselineValue, comparisonValue } = allocatedMetricValues(
        snapshot,
        targetCategory,
        query,
        baseline,
        comparison,
        baselinePatternId,
        comparisonPatternId,
        categoriesById,
      );
      const difference = round(comparisonValue - baselineValue, digits);
      return {
        objectType: "CATEGORY",
        objectId: targetCategory.id,
        objectCode: targetCategory.code,
        objectName: targetCategory.name,
        status: "CHANGED",
        baselineValue,
        comparisonValue,
        difference,
        contributionRate: contributionRate(difference, parentDifference),
        movementShare: null,
        hasChildren:
          (targetCategory.children?.length ?? 0) > 0 ||
          (targetCategory.level === terminalLevel &&
            (query.metric === "CURRENT_COST" || isVarianceQuery(query))),
        changedFields: buildCategoryChangedFields(
          targetCategory,
          query,
          baselinePatternId,
          comparisonPatternId,
          baseline,
          comparison,
          baselineValue,
          comparisonValue,
        ),
      };
    }),
  );
}

function partFields(
  category: CostAnalysisCategoryNode,
  partCode: string,
  index: number,
  status: CostAnalysisDifferenceDetailRow["status"],
  difference: number,
): CostAnalysisDifferenceChangedField[] {
  const baselineExists = status !== "ADDED";
  const comparisonExists = status !== "REMOVED";
  const baselineCost = baselineExists
    ? round(Math.abs(difference) + 80 + index * 7.5, 2)
    : null;
  const comparisonCost = comparisonExists
    ? round((baselineCost ?? 0) + difference, 2)
    : null;
  const supplierChanged = status === "CHANGED" && index % 4 < 2;
  const baselineSupplier = baselineExists
    ? `供应商${String.fromCharCode(65 + (index % 4))}`
    : null;
  const comparisonSupplier = comparisonExists
    ? supplierChanged
      ? `供应商${String.fromCharCode(69 + (index % 3))}`
      : (baselineSupplier ?? `供应商${String.fromCharCode(65 + (index % 4))}`)
    : null;
  const engineerChanged = status === "CHANGED" && index % 7 === 0;
  const baselineEngineer = baselineExists
    ? (category.engineers?.[0] ?? "成本工程师A")
    : null;
  const comparisonEngineer = comparisonExists
    ? engineerChanged
      ? (category.engineers?.[1] ?? "成本工程师B")
      : (baselineEngineer ?? category.engineers?.[0] ?? "成本工程师A")
    : null;
  const baselineQuantity = baselineExists ? round(1 + index * 0.1, 2) : null;
  const quantityChanged = status === "CHANGED" && index % 3 === 0;
  const comparisonQuantity = comparisonExists
    ? quantityChanged
      ? round((baselineQuantity ?? 1) + 0.1, 2)
      : (baselineQuantity ?? round(1.1 + index * 0.1, 2))
    : null;
  const baselineSource = baselineExists ? "SRM 定点价" : null;
  const sourceChanged = status === "CHANGED" && index % 5 === 0;
  const comparisonSource = comparisonExists
    ? sourceChanged
      ? "采购会议价"
      : (baselineSource ?? "SRM 定点价")
    : null;
  const baselineAmortization = baselineExists
    ? round(4 + index * 0.8, 2)
    : null;
  const amortizationChanged = status === "CHANGED" && index % 4 === 0;
  const comparisonAmortization = comparisonExists
    ? amortizationChanged
      ? round((baselineAmortization ?? 0) + 2.5, 2)
      : (baselineAmortization ?? round(4 + index * 0.8, 2))
    : null;
  const baselineAttribute = baselineExists
    ? (category.partAttribute ?? "上装件")
    : null;
  const attributeChanged = status === "CHANGED" && index % 8 === 0;
  const comparisonAttribute = comparisonExists
    ? attributeChanged
      ? baselineAttribute === "上装件"
        ? "平台件"
        : "上装件"
      : (baselineAttribute ?? category.partAttribute ?? "上装件")
    : null;
  const technicalBaselineExists = status === "CHANGED";
  const ecrChanged = technicalBaselineExists && index % 4 === 2;
  const baselineEcr = technicalBaselineExists
    ? `ECR-${category.code}-${String(index).padStart(3, "0")}`
    : null;
  const comparisonEcr = ecrChanged
    ? `ECR-${category.code}-${String(index + 100).padStart(3, "0")}`
    : baselineEcr;
  const iaChanged = technicalBaselineExists && index % 6 === 0;
  const baselineIa = technicalBaselineExists
    ? `IA-${category.code}-${String(index).padStart(3, "0")}`
    : null;
  const comparisonIa = iaChanged
    ? `IA-${category.code}-${String(index + 100).padStart(3, "0")}`
    : baselineIa;
  const versionChanged = technicalBaselineExists && index % 4 === 3;
  const baselineVersion = technicalBaselineExists
    ? `V${1 + (index % 3)}`
    : null;
  const comparisonVersion = versionChanged
    ? `V${2 + (index % 3)}`
    : baselineVersion;
  const techDescriptionChanged = technicalBaselineExists && index % 5 === 0;
  const baselineTechDescription = technicalBaselineExists
    ? "现行技术状态"
    : null;
  const comparisonTechDescription = techDescriptionChanged
    ? "调整材料或结构参数"
    : baselineTechDescription;
  const moduleChanged = technicalBaselineExists && index % 7 === 0;
  const baselineModule = technicalBaselineExists
    ? `${category.name}模块`
    : null;
  const comparisonModule = moduleChanged
    ? `${category.name}模块-调整`
    : baselineModule;

  const fields: CostAnalysisDifferenceChangedField[] = [
    {
      fieldCode: "partName",
      fieldName: "零件名称",
      fieldGroup: "基础信息",
      dataType: "TEXT",
      baselineValue: baselineExists ? partCode : null,
      comparisonValue: comparisonExists ? partCode : null,
      difference: null,
    },
    {
      fieldCode: "supplier",
      fieldName: "供应商",
      fieldGroup: "供应信息",
      dataType: "TEXT",
      baselineValue: baselineSupplier,
      comparisonValue: comparisonSupplier,
      difference: null,
    },
    {
      fieldCode: "costEngineer",
      fieldName: "成本工程师",
      fieldGroup: "分类与分工",
      dataType: "TEXT",
      baselineValue: baselineEngineer,
      comparisonValue: comparisonEngineer,
      difference: null,
    },
    {
      fieldCode: "partAttribute",
      fieldName: "零件归属",
      fieldGroup: "分类与分工",
      dataType: "TEXT",
      baselineValue: baselineAttribute,
      comparisonValue: comparisonAttribute,
      difference: null,
    },
    {
      fieldCode: "ecrNumber",
      fieldName: "ECR号",
      fieldGroup: "技术状态",
      dataType: "TEXT",
      baselineValue: baselineEcr,
      comparisonValue: comparisonEcr,
      difference: null,
    },
    {
      fieldCode: "iaNumber",
      fieldName: "IA号",
      fieldGroup: "技术状态",
      dataType: "TEXT",
      baselineValue: baselineIa,
      comparisonValue: comparisonIa,
      difference: null,
    },
    {
      fieldCode: "partVersion",
      fieldName: "零件版本",
      fieldGroup: "技术状态",
      dataType: "TEXT",
      baselineValue: baselineVersion,
      comparisonValue: comparisonVersion,
      difference: null,
    },
    {
      fieldCode: "partTechDesc",
      fieldName: "关键技术状态",
      fieldGroup: "技术状态",
      dataType: "TEXT",
      baselineValue: baselineTechDescription,
      comparisonValue: comparisonTechDescription,
      difference: null,
    },
    {
      fieldCode: "moduleIdentifier",
      fieldName: "模块标识",
      fieldGroup: "技术状态",
      dataType: "TEXT",
      baselineValue: baselineModule,
      comparisonValue: comparisonModule,
      difference: null,
    },
    {
      fieldCode: "unitQuantity",
      fieldName: "单车用量",
      fieldGroup: "单车用量",
      dataType: "NUMBER",
      baselineValue: baselineQuantity,
      comparisonValue: comparisonQuantity,
      difference:
        baselineExists && comparisonExists
          ? round((comparisonQuantity ?? 0) - (baselineQuantity ?? 0), 2)
          : comparisonExists
            ? comparisonQuantity
            : round(-(baselineQuantity ?? 0), 2),
    },
    {
      fieldCode: "targetMaterialCost",
      fieldName: "目标材料成本",
      fieldGroup: "目标成本",
      dataType: "MONEY",
      baselineValue: baselineExists
        ? round((baselineCost ?? 0) * 0.95, 2)
        : null,
      comparisonValue: comparisonExists
        ? round((comparisonCost ?? 0) * 0.95, 2)
        : null,
      difference:
        baselineExists && comparisonExists
          ? round((comparisonCost ?? 0) * 0.95 - (baselineCost ?? 0) * 0.95, 2)
          : comparisonExists
            ? round((comparisonCost ?? 0) * 0.95, 2)
            : round(-(baselineCost ?? 0) * 0.95, 2),
    },
    {
      fieldCode: "currentMaterialCost",
      fieldName: "当前材料成本",
      fieldGroup: "当前成本",
      dataType: "MONEY",
      baselineValue: baselineCost,
      comparisonValue: comparisonCost,
      difference,
    },
    {
      fieldCode: "currentCostSource",
      fieldName: "数据来源",
      fieldGroup: "当前成本",
      dataType: "TEXT",
      baselineValue: baselineSource,
      comparisonValue: comparisonSource,
      difference: null,
    },
    {
      fieldCode: "amortizationAmount",
      fieldName: "摊销金额",
      fieldGroup: "当前成本",
      dataType: "MONEY",
      baselineValue: baselineAmortization,
      comparisonValue: comparisonAmortization,
      difference:
        baselineAmortization !== null && comparisonAmortization !== null
          ? round(comparisonAmortization - baselineAmortization, 2)
          : comparisonAmortization !== null
            ? comparisonAmortization
            : baselineAmortization !== null
              ? round(-baselineAmortization, 2)
              : null,
    },
  ];
  return fields.filter(
    (field) =>
      field.baselineValue !== field.comparisonValue ||
      field.fieldCode === "currentMaterialCost" ||
      field.fieldCode === "targetMaterialCost",
  );
}

function partName(category: CostAnalysisCategoryNode, index: number): string {
  const coveredParts = category.coveredParts?.filter(Boolean) ?? [];
  const name = coveredParts[index % coveredParts.length];
  if (!name) {
    return `${category.name}零件${String(index + 1).padStart(2, "0")}`;
  }
  return name.replace(/等$/, "");
}

function buildPartRows(
  category: CostAnalysisCategoryNode,
  parentDifference: number,
): CostAnalysisDifferenceDetailRow[] {
  const magnitude = Math.max(Math.abs(parentDifference), 1);
  const addedDifference = round(magnitude * 0.8, 2);
  const removedDifference = round(-magnitude * 0.6, 2);
  const remainder = round(
    parentDifference - addedDifference - removedDifference,
    2,
  );
  const differences = [
    addedDifference,
    removedDifference,
    ...allocate(remainder, PART_REMAINDER_WEIGHTS, 2),
  ];

  return sortRows(
    differences.map((difference, index) => {
      const status =
        index === 0 ? "ADDED" : index === 1 ? "REMOVED" : "CHANGED";
      const objectCode = `${category.code}-P${String(index + 1).padStart(
        3,
        "0",
      )}`;
      const baselineValue =
        status === "ADDED"
          ? null
          : round(Math.abs(difference) + 80 + index * 7.5, 2);
      const comparisonValue =
        status === "REMOVED"
          ? null
          : round((baselineValue ?? 0) + difference, 2);
      return {
        objectType: "PART",
        objectId: `${category.id}:part:${index + 1}`,
        objectCode,
        objectName: partName(category, index),
        status,
        baselineValue,
        comparisonValue,
        difference,
        contributionRate: contributionRate(difference, parentDifference),
        movementShare: null,
        hasChildren: false,
        changedFields: partFields(
          category,
          partName(category, index),
          index,
          status,
          difference,
        ),
      };
    }),
  );
}

function variancePartFields(
  targetValue: number,
  currentValue: number,
  difference: number,
): CostAnalysisDifferenceChangedField[] {
  return [
    {
      fieldCode: "costContribution",
      fieldName: "零件成本贡献",
      fieldGroup: "超差构成",
      dataType: "MONEY",
      baselineValue: targetValue,
      comparisonValue: currentValue,
      difference,
    },
  ];
}

function buildVariancePartRows(
  category: CostAnalysisCategoryNode,
  parentDifference: number,
): CostAnalysisDifferenceDetailRow[] {
  const magnitude = Math.max(Math.abs(parentDifference), 1);
  const positiveDifference = round(magnitude * 0.8, 2);
  const negativeDifference = round(-magnitude * 0.6, 2);
  const remainder = round(
    parentDifference - positiveDifference - negativeDifference,
    2,
  );
  const differences = [
    positiveDifference,
    negativeDifference,
    ...allocate(remainder, PART_REMAINDER_WEIGHTS, 2),
  ];

  return sortRows(
    differences.map((difference, index) => {
      const targetValue = round(Math.abs(difference) + 80 + index * 7.5, 2);
      const currentValue = round(targetValue + difference, 2);
      return {
        objectType: "PART",
        objectId: `${category.id}:variance-part:${index + 1}`,
        objectCode: `${category.code}-V${String(index + 1).padStart(3, "0")}`,
        objectName: partName(category, index),
        status: "CHANGED",
        baselineValue: targetValue,
        comparisonValue: currentValue,
        difference,
        contributionRate: contributionRate(difference, parentDifference),
        movementShare: null,
        hasChildren: false,
        changedFields: variancePartFields(
          targetValue,
          currentValue,
          difference,
        ),
      };
    }),
  );
}

function categoryPath(
  category: CostAnalysisCategoryNode,
  categoriesById: ReadonlyMap<string, CostAnalysisCategoryNode>,
) {
  const path: CostAnalysisCategoryNode[] = [];
  let current: CostAnalysisCategoryNode | undefined = category;
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? categoriesById.get(current.parentId)
      : undefined;
  }
  return path.map((item) => ({
    categoryId: item.id,
    categoryCode: item.code,
    categoryName: item.name,
    categoryLevel: item.level,
  }));
}

export function buildMockCostAnalysisDifferenceDetail(
  snapshot: MockCostAnalysisDifferenceSnapshot,
  query: CostAnalysisDifferenceDetailQuery,
  category: CostAnalysisCategoryNode,
  categoriesById: ReadonlyMap<string, CostAnalysisCategoryNode>,
  options?: {
    includeAllRows?: boolean;
    terminalLevel?: 2 | 3;
    dimensionType?: CostAnalysisDimensionType;
  },
): CostAnalysisDifferenceDetailResult {
  const baselineColumn = snapshot.result.columns.find(
    (column) =>
      column.columnKey ===
      (isVarianceQuery(query) ? query.columnKey : query.baselineColumnKey),
  )!;
  const comparisonColumn = snapshot.result.columns.find(
    (column) =>
      column.columnKey ===
      (isVarianceQuery(query) ? query.columnKey : query.comparisonColumnKey),
  )!;
  const baseline = baselineColumn.point;
  const comparison = comparisonColumn.point;
  const { baselineValue, comparisonValue } = allocatedMetricValues(
    snapshot,
    category,
    query,
    baseline,
    comparison,
    baselineColumn.pattern.patternId,
    comparisonColumn.pattern.patternId,
    categoriesById,
  );
  const digits = precision(query.metric);
  const difference = round(comparisonValue - baselineValue, digits);
  const terminalLevel = options?.terminalLevel ?? 3;
  const isTerminalLevel = query.categoryLevel === terminalLevel;
  const viewLevel =
    query.viewLevel ??
    (isTerminalLevel
      ? undefined
      : ((query.categoryLevel + 1) as CostAnalysisDifferenceViewLevel));
  const isPartDetail = isTerminalLevel && viewLevel === undefined;
  const generatedRows = isPartDetail
    ? isVarianceQuery(query)
      ? buildVariancePartRows(category, difference)
      : buildPartRows(category, difference)
    : viewLevel === query.categoryLevel + 1
      ? buildCategoryRows(
          category,
          query,
          baseline,
          comparison,
          baselineColumn.pattern.patternId,
          comparisonColumn.pattern.patternId,
          baselineValue,
          difference,
          terminalLevel,
        )
      : buildCategoryRowsAtLevel(
          snapshot,
          category,
          query,
          baseline,
          comparison,
          baselineColumn.pattern.patternId,
          comparisonColumn.pattern.patternId,
          categoriesById,
          viewLevel!,
          difference,
          terminalLevel,
        );
  const allAbsoluteDifference = generatedRows.reduce(
    (sum, row) => sum + Math.abs(row.difference ?? 0),
    0,
  );
  const allRows = generatedRows.map((row) => ({
    ...row,
    movementShare:
      allAbsoluteDifference === 0
        ? null
        : round(Math.abs(row.difference ?? 0) / allAbsoluteDifference, 6),
  }));
  const limit = isPartDetail ? (query.limit ?? 10) : allRows.length;
  const rows = options?.includeAllRows ? allRows : allRows.slice(0, limit);
  const allChildDifference = round(
    allRows.reduce((sum, row) => sum + (row.difference ?? 0), 0),
    digits,
  );
  const returnedDifference = round(
    rows.reduce((sum, row) => sum + (row.difference ?? 0), 0),
    digits,
  );
  const otherDifference = round(
    allChildDifference - returnedDifference,
    digits,
  );
  const unreconciledDifference = round(difference - allChildDifference, digits);
  const returnedAbsoluteDifference = rows.reduce(
    (sum, row) => sum + Math.abs(row.difference ?? 0),
    0,
  );
  const tolerance = query.metric === "MIX" ? 0.0001 : 0.01;
  const increaseAmount = round(
    allRows.reduce((sum, row) => sum + Math.max(row.difference ?? 0, 0), 0),
    digits,
  );
  const decreaseAmount = round(
    allRows.reduce(
      (sum, row) => sum + Math.abs(Math.min(row.difference ?? 0, 0)),
      0,
    ),
    digits,
  );
  const otherAbsoluteDifference = round(
    allAbsoluteDifference - returnedAbsoluteDifference,
    digits,
  );
  const visualizationReconciled =
    Math.abs(increaseAmount - decreaseAmount - difference) <= tolerance &&
    Math.abs(
      returnedAbsoluteDifference +
        otherAbsoluteDifference -
        allAbsoluteDifference,
    ) <= tolerance &&
    Math.abs(unreconciledDifference) <= tolerance;
  const explanationRate = isPartDetail
    ? allAbsoluteDifference === 0
      ? null
      : round(returnedAbsoluteDifference / allAbsoluteDifference, 6)
    : round(
        Math.max(
          0,
          Math.min(
            1,
            1 -
              Math.abs(unreconciledDifference) /
                Math.max(Math.abs(difference), tolerance),
          ),
        ),
        6,
      );

  return {
    snapshotId: snapshot.result.snapshotId,
    drillLevel: isPartDetail
      ? "PART"
      : query.categoryLevel === 0
        ? "CATEGORY_1"
        : query.categoryLevel === 1
          ? "CATEGORY_2"
          : "CATEGORY_3",
    viewLevel,
    availableViewLevels: isPartDetail
      ? []
      : Array.from(
          { length: terminalLevel - query.categoryLevel },
          (_, index) =>
            (query.categoryLevel +
              index +
              1) as CostAnalysisDifferenceViewLevel,
        ),
    context: isVarianceQuery(query)
      ? {
          traceType: "COST_VARIANCE",
          point: { ...baseline },
          pattern: { ...baselineColumn.pattern },
          dimensionType: options?.dimensionType,
          categoryPath: categoryPath(category, categoriesById),
          metric: "VARIANCE",
        }
      : {
          traceType: "POINT_COMPARISON",
          baseline: { ...baseline },
          comparison: { ...comparison },
          baselinePattern: { ...baselineColumn.pattern },
          comparisonPattern: { ...comparisonColumn.pattern },
          dimensionType: options?.dimensionType,
          categoryPath: categoryPath(category, categoriesById),
          metric: query.metric,
        },
    summary: {
      baselineValue,
      comparisonValue,
      difference,
      allChildDifference,
      returnedDifference,
      otherDifference,
      unreconciledDifference,
      explanationRate,
      totalChangedCount: allRows.length,
    },
    visualization: {
      increaseAmount,
      decreaseAmount,
      netDifference: difference,
      absoluteDifferenceTotal: round(allAbsoluteDifference, digits),
      returnedAbsoluteDifference: round(returnedAbsoluteDifference, digits),
      otherAbsoluteDifference,
      reconciled: visualizationReconciled,
    },
    rows,
    queriedAt: new Date().toISOString(),
  };
}
