import type {
  CostAnalysisCategoryLevel,
  CostAnalysisDimensionType,
} from "@/types/cost-analysis";
import {
  getCostAnalysisDimensionLevelLabel,
  getCostAnalysisDimensionMaxLevel,
  normalizeCostAnalysisDimensionType,
} from "@/pages/cost/analysis/utils/analysis-dimension";

export interface CostAnalysisDifferenceViewLevelOption {
  label: string;
  value: CostAnalysisCategoryLevel;
}

function getDifferenceViewLevelLabel(
  dimensionType: CostAnalysisDimensionType,
  level: CostAnalysisCategoryLevel,
): string {
  if (dimensionType === "VEHICLE_SYSTEM" && level === 2) {
    return "38个系统";
  }
  return getCostAnalysisDimensionLevelLabel(dimensionType, level);
}

export function getCostAnalysisDifferenceViewLevelOptions(
  dimensionType: CostAnalysisDimensionType | undefined,
  categoryLevel: CostAnalysisCategoryLevel | null,
): CostAnalysisDifferenceViewLevelOption[] {
  if (categoryLevel === null) return [];
  const normalizedDimensionType =
    normalizeCostAnalysisDimensionType(dimensionType);
  const maxLevel = getCostAnalysisDimensionMaxLevel(normalizedDimensionType);
  const options: CostAnalysisDifferenceViewLevelOption[] = [];
  for (let level = categoryLevel + 1; level <= maxLevel; level += 1) {
    const value = level as CostAnalysisCategoryLevel;
    options.push({
      label: getDifferenceViewLevelLabel(normalizedDimensionType, value),
      value,
    });
  }
  return options;
}

export function getDefaultCostAnalysisDifferenceViewLevel(
  dimensionType: CostAnalysisDimensionType | undefined,
  categoryLevel: CostAnalysisCategoryLevel,
): CostAnalysisCategoryLevel | null {
  const maxLevel = getCostAnalysisDimensionMaxLevel(
    normalizeCostAnalysisDimensionType(dimensionType),
  );
  return categoryLevel < maxLevel
    ? ((categoryLevel + 1) as CostAnalysisCategoryLevel)
    : null;
}

export function getCostAnalysisDifferenceViewLevelLabel(
  dimensionType: CostAnalysisDimensionType | undefined,
  level: CostAnalysisCategoryLevel | null | undefined,
): string {
  if (level === null || level === undefined) return "最细分类";
  return getDifferenceViewLevelLabel(
    normalizeCostAnalysisDimensionType(dimensionType),
    level,
  );
}
