import ExcelJS from "exceljs";
import type {
  CostAnalysisMatrixRow,
  CostAnalysisMetric,
  CostAnalysisQuery,
  CostAnalysisResult,
} from "@/types/cost-analysis";
import {
  getCostAnalysisDimensionLevelLabel,
  getCostAnalysisDimensionTitle,
  normalizeCostAnalysisDimensionType,
} from "@/api/cost-analysis/dimensions";

interface ExportColumn {
  columnKey: string;
  label: string;
}

const METRIC_LABELS: Record<CostAnalysisMetric, string> = {
  MIX: "MIX",
  CURRENT_COST: "当前成本",
  TARGET_COST: "目标成本",
  VARIANCE: "超差",
};

export function calculateCostAnalysisExportSubtotal(
  values: Array<number | null>,
): number | null {
  const numbers = values.filter((value): value is number => value !== null);
  if (numbers.length === 0) return null;
  return Number(numbers.reduce((total, value) => total + value, 0).toFixed(2));
}

function buildExportColumns(
  _query: CostAnalysisQuery,
  result: CostAnalysisResult,
): ExportColumn[] {
  return result.columns.map((column) => ({
    columnKey: column.columnKey,
    label: `${column.point.projectName}-${column.point.valveName}-${column.pattern.patternName}`,
  }));
}

function subtotalMetrics(
  result: CostAnalysisResult,
): Array<"CURRENT_COST" | "TARGET_COST"> {
  return result.categoryLevel === 3
    ? ["CURRENT_COST"]
    : ["CURRENT_COST", "TARGET_COST"];
}

function buildVarianceRow(
  categoryId: string,
  categoryRows: CostAnalysisMatrixRow[],
): CostAnalysisMatrixRow | null {
  const current = categoryRows.find((row) => row.metric === "CURRENT_COST");
  const target = categoryRows.find((row) => row.metric === "TARGET_COST");
  if (!current || !target) return null;

  const valueKeys = new Set([
    ...Object.keys(current.values),
    ...Object.keys(target.values),
  ]);
  const values = Object.fromEntries(
    [...valueKeys].map((valueKey) => {
      const currentValue = current.values[valueKey];
      const targetValue = target.values[valueKey];
      return [
        valueKey,
        typeof currentValue === "number" && typeof targetValue === "number"
          ? Number((currentValue - targetValue).toFixed(2))
          : null,
      ];
    }),
  );
  return {
    categoryId,
    categoryName: current.categoryName,
    categoryLevel: current.categoryLevel,
    metric: "VARIANCE",
    values,
    subtotal: false,
  };
}

function buildExportMatrixRows(
  result: CostAnalysisResult,
): CostAnalysisMatrixRow[] {
  return result.categories.flatMap((category) => {
    const categoryRows = result.rows.filter(
      (row) => row.categoryId === category.id,
    );
    if (result.categoryLevel === 3) return categoryRows;

    const rows: CostAnalysisMatrixRow[] = [];
    categoryRows.forEach((row) => {
      rows.push(row);
      if (row.metric === "TARGET_COST") {
        const variance = buildVarianceRow(category.id, categoryRows);
        if (variance) rows.push(variance);
      }
    });
    return rows;
  });
}

export async function buildCostAnalysisWorkbook(
  query: CostAnalysisQuery,
  result: CostAnalysisResult,
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("成本分析");
  const columns = buildExportColumns(query, result);
  const matrixRows = buildExportMatrixRows(result);
  const dimensionType = normalizeCostAnalysisDimensionType(
    result.dimensionType ?? query.dimensionType,
  );

  worksheet.addRow(["成本分析", result.queriedAt]);
  worksheet.addRow(["分析维度", getCostAnalysisDimensionTitle(dimensionType)]);
  worksheet.addRow([
    "维度层级",
    getCostAnalysisDimensionLevelLabel(dimensionType, result.categoryLevel),
  ]);
  worksheet.addRow([
    "选中维度",
    result.categories.map((category) => category.name).join("、"),
  ]);
  result.points.forEach((point) => {
    const patternNames = result.columns
      .filter((column) => column.point.pointKey === point.pointKey)
      .sort((left, right) => left.sortNo - right.sortNo)
      .map((column) => column.pattern.patternName)
      .join("、");
    worksheet.addRow([
      "查询条件",
      point.projectName,
      point.valveName,
      patternNames,
    ]);
    worksheet.addRow([
      "BOM版本",
      point.bomVersionNo,
      point.bomUpdatedAt,
      point.bomVersionId,
    ]);
  });

  worksheet.addRow([]);
  worksheet.addRow(["矩阵"]);
  worksheet.addRow([
    "维度名称",
    "指标",
    ...columns.map((column) => column.label),
  ]);
  matrixRows.forEach((row) => {
    worksheet.addRow([
      row.categoryName,
      METRIC_LABELS[row.metric],
      ...columns.map((column) => row.values[column.columnKey] ?? null),
    ]);
  });

  worksheet.addRow([]);
  subtotalMetrics(result).forEach((metric) => {
    const metricRows = result.rows.filter((row) => row.metric === metric);
    worksheet.addRow([
      "小计",
      METRIC_LABELS[metric],
      ...columns.map((column) =>
        calculateCostAnalysisExportSubtotal(
          metricRows.map((row) => {
            const value = row.values[column.columnKey];
            return typeof value === "number" ? value : null;
          }),
        ),
      ),
    ]);
  });
  worksheet.addRow(["导出时间", new Date().toISOString()]);

  worksheet.columns.forEach((column, index) => {
    column.width = index < 2 ? 20 : 28;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
