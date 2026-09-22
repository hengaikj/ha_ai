import type {
  CostAnalysisCategoryLevel,
  CostAnalysisCategoryNode,
  CostAnalysisDimensionType,
} from "@/types/cost-analysis";

const DIMENSION_TITLES: Record<CostAnalysisDimensionType, string> = {
  VEHICLE_SYSTEM: "成本专业",
  RESPONSIBILITY_DEPARTMENT: "研发专业",
};

const DIMENSION_LEVEL_LABELS: Record<
  CostAnalysisDimensionType,
  Partial<Record<CostAnalysisCategoryLevel, string>>
> = {
  VEHICLE_SYSTEM: {
    0: "项目",
    1: "专业科室",
    2: "38个系统",
    3: "三级零部件",
  },
  RESPONSIBILITY_DEPARTMENT: {
    0: "项目",
    1: "责任群组",
    2: "研发专业",
    3: "38个系统",
  },
};

const PROJECT_ROOT_IDS: Record<CostAnalysisDimensionType, string> = {
  VEHICLE_SYSTEM: "project-root-vehicle-system",
  RESPONSIBILITY_DEPARTMENT: "project-root-responsibility-department",
};

export function getCostAnalysisDimensionTitle(
  dimensionType: CostAnalysisDimensionType,
): string {
  return DIMENSION_TITLES[dimensionType];
}

export function getCostAnalysisDimensionLevelLabel(
  dimensionType: CostAnalysisDimensionType,
  level: CostAnalysisCategoryLevel,
): string {
  return DIMENSION_LEVEL_LABELS[dimensionType][level] ?? "";
}

export function getCostAnalysisDimensionMaxLevel(
  _dimensionType: CostAnalysisDimensionType,
): CostAnalysisCategoryLevel {
  return 3;
}

export function normalizeCostAnalysisDimensionType(
  dimensionType?: CostAnalysisDimensionType,
): CostAnalysisDimensionType {
  return dimensionType ?? "VEHICLE_SYSTEM";
}

export function getCostAnalysisProjectRootId(
  dimensionType: CostAnalysisDimensionType,
): string {
  return PROJECT_ROOT_IDS[dimensionType];
}

/** 项目是分析范围占位节点，不需要读取成本分类。 */
export function createCostAnalysisProjectTree(
  dimensionType: CostAnalysisDimensionType,
): CostAnalysisCategoryNode[] {
  return [
    {
      id: getCostAnalysisProjectRootId(dimensionType),
      parentId: null,
      level: 0,
      code: "PROJECT",
      name: "项目",
      path: "项目",
      sortNo: 0,
      dimensionType,
      children: [],
    },
  ];
}

export function withCostAnalysisProjectRoot(
  dimensionType: CostAnalysisDimensionType,
  nodes: CostAnalysisCategoryNode[],
): CostAnalysisCategoryNode[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1 && nodes[0].level === 0) return nodes;

  const rootId = getCostAnalysisProjectRootId(dimensionType);
  return [
    {
      id: rootId,
      parentId: null,
      level: 0,
      code: "PROJECT",
      name: "项目",
      path: "项目",
      sortNo: 0,
      dimensionType,
      children: nodes.map((node) => ({
        ...node,
        parentId: node.level <= 1 ? rootId : node.parentId,
      })),
    },
  ];
}
