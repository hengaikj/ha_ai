import type {
  CostAnalysisLatestBom,
  CostAnalysisMetric,
  CostAnalysisPatternOption,
} from "@/types/cost-analysis";
import type { BusinessProjectItem, BusinessValveItem } from "@/types/project";

interface MockProjectDataset {
  projectName: string;
  bom: CostAnalysisLatestBom;
}

export type MockCostAnalysisValveOption = Omit<BusinessValveItem, "valveId"> & {
  valveId: number;
};

const PATTERNS: Record<number, CostAnalysisPatternOption> = {
  1: {
    patternId: 1,
    patternCode: "WEIGHTED",
    patternName: "加权",
    patternType: "WEIGHTED",
    sortNo: 1,
  },
  2: {
    patternId: 2,
    patternCode: "EVR200_PRO",
    patternName: "EVR200Pro",
    patternType: "NORMAL",
    sortNo: 2,
  },
  3: {
    patternId: 3,
    patternCode: "EV600_MAX",
    patternName: "EV600Max",
    patternType: "NORMAL",
    sortNo: 3,
  },
  4: {
    patternId: 4,
    patternCode: "URBAN",
    patternName: "Urban",
    patternType: "NORMAL",
    sortNo: 4,
  },
  5: {
    patternId: 5,
    patternCode: "PERFORMANCE",
    patternName: "Performance",
    patternType: "NORMAL",
    sortNo: 4,
  },
  6: {
    patternId: 6,
    patternCode: "BUSINESS",
    patternName: "Business",
    patternType: "NORMAL",
    sortNo: 3,
  },
};

function patterns(...patternIds: number[]): CostAnalysisPatternOption[] {
  return patternIds.map((patternId, index) => ({
    ...PATTERNS[patternId],
    sortNo: index + 1,
  }));
}

const FALLBACK_PATTERN_IDS = [
  [1, 2, 3],
  [1, 3, 4],
  [1, 2, 5],
  [1, 3, 6],
] as const;

export const MOCK_COST_ANALYSIS_PROJECTS: ReadonlyMap<
  number,
  MockProjectDataset
> = new Map([
  [
    1001,
    {
      projectName: "N51AS-1028",
      bom: {
        projectId: 1001,
        bomVersionId: 2026071501,
        bomVersionNo: "BOM-N51AS-20260715",
        bomUpdatedAt: "2026-07-15T08:10:00.000Z",
        patterns: patterns(1, 2, 3, 4),
      },
    },
  ],
  [
    1002,
    {
      projectName: "N51AS-0310",
      bom: {
        projectId: 1002,
        bomVersionId: 2026071502,
        bomVersionNo: "BOM-N51AS-20260715-B",
        bomUpdatedAt: "2026-07-15T08:20:00.000Z",
        patterns: patterns(1, 2, 3, 5),
      },
    },
  ],
  [
    1003,
    {
      projectName: "C46DB",
      bom: {
        projectId: 1003,
        bomVersionId: 2026071503,
        bomVersionNo: "BOM-C46DB-20260715",
        bomUpdatedAt: "2026-07-15T08:30:00.000Z",
        patterns: patterns(1, 3, 6),
      },
    },
  ],
  [
    1004,
    {
      projectName: "P33A",
      bom: {
        projectId: 1004,
        bomVersionId: 2026071504,
        bomVersionNo: "BOM-P33A-20260715",
        bomUpdatedAt: "2026-07-15T08:40:00.000Z",
        patterns: patterns(1, 2, 5),
      },
    },
  ],
]);

const MOCK_COST_ANALYSIS_VALVES: ReadonlyArray<MockCostAnalysisValveOption> =
  Array.from({ length: 6 }, (_, index) => {
    const valveId = index + 1;
    return {
      valveId,
      valveCode: `G${valveId}`,
      valveName: `G${valveId}`,
      sortNo: valveId,
      status: "ENABLED",
      version: 1,
    };
  });

export function getMockCostAnalysisProjectOptions(): BusinessProjectItem[] {
  return Array.from(
    MOCK_COST_ANALYSIS_PROJECTS,
    ([projectId, { projectName }]) => ({
      projectId,
      projectCode: projectName,
      projectName,
      budgetLocked: false,
      evaluateLocked: false,
      status: "ENABLED",
      version: 1,
    }),
  );
}

export function getMockCostAnalysisValveOptions(): MockCostAnalysisValveOption[] {
  return MOCK_COST_ANALYSIS_VALVES.map((valve) => ({ ...valve }));
}

function stableNumber(seed: string, minimum: number, span: number): number {
  const hash = Array.from(seed).reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
    2166136261,
  );
  return Number((minimum + (hash % span) / 100).toFixed(2));
}

export function buildMockMetricValue(
  metric: Extract<CostAnalysisMetric, "MIX" | "CURRENT_COST" | "TARGET_COST">,
  categoryId: string,
  patternId: number,
  projectId: number,
  valveId: number,
): number {
  const current = stableNumber(
    `${categoryId}:${patternId}:${projectId}:${valveId}:current`,
    600,
    900000,
  );
  if (metric === "CURRENT_COST") return current;
  if (metric === "TARGET_COST") {
    return Number((current * 0.96).toFixed(2));
  }
  return Number(
    (
      stableNumber(`${categoryId}:${patternId}:${projectId}:mix`, 5, 3000) / 100
    ).toFixed(4),
  );
}

export function getMockProjectName(projectId: number): string | undefined {
  return MOCK_COST_ANALYSIS_PROJECTS.get(projectId)?.projectName;
}

export function getMockValveName(valveId: number): string {
  return `G${valveId}`;
}

export function getMockLatestBom(
  projectId: number,
): CostAnalysisLatestBom | undefined {
  const fixedBom = MOCK_COST_ANALYSIS_PROJECTS.get(projectId)?.bom;
  if (fixedBom) {
    return {
      ...fixedBom,
      patterns: fixedBom.patterns.map((pattern) => ({ ...pattern })),
    };
  }
  if (!Number.isSafeInteger(projectId) || projectId <= 0) return undefined;

  const patternIds =
    FALLBACK_PATTERN_IDS[projectId % FALLBACK_PATTERN_IDS.length];
  return {
    projectId,
    bomVersionId: 3_000_000_000 + (projectId % 1_000_000_000),
    bomVersionNo: `MOCK-BOM-${projectId}`,
    bomUpdatedAt: "2026-07-16T00:00:00.000Z",
    patterns: patterns(...patternIds),
  };
}
