import { remoteCostAnalysisApi } from "./remote";
import { fetchBusinessProjects, fetchBusinessValves } from "@/api/project";
import type {
  CostAnalysisAiAnalysisQuery,
  CostAnalysisBomScope,
  CostAnalysisDifferenceDetailQuery,
  CostAnalysisDimensionType,
  CostAnalysisQuery,
  CostAnalysisRemarkUpdate,
} from "@/types/cost-analysis";
import type { BusinessProjectItem, BusinessValveItem } from "@/types/project";
import { isCostAnalysisMockEnabled } from "./data-source";
import { withCostAnalysisProjectRoot } from "./dimensions";

const OPTION_PAGE_SIZE = 500;

interface CostAnalysisOptionPage<T> {
  total?: number;
  records: T[];
}

type CostAnalysisApi = typeof remoteCostAnalysisApi;

export type CostAnalysisValveOption = Omit<BusinessValveItem, "valveId"> & {
  valveId: number;
};

export async function fetchCostAnalysisBomScopes(): Promise<
  CostAnalysisBomScope[]
> {
  if (isCostAnalysisMockEnabled()) {
    const [projects, valves] = await Promise.all([
      fetchCostAnalysisProjectOptions(),
      fetchCostAnalysisValveOptions(),
    ]);
    return projects.map((project) => ({
      projectId: project.projectId,
      valveIds: valves.map((valve) => valve.valveId),
    }));
  }
  const scopes = await remoteCostAnalysisApi.fetchBomOptions();
  return scopes.flatMap((scope) => {
    const projectId = toSafePositiveInteger(scope.projectId);
    if (projectId === null) return [];
    return [
      {
        projectId,
        valveIds: Array.from(
          new Set(
            scope.valveIds.flatMap((value) => {
              const valveId = toSafePositiveInteger(value);
              return valveId === null ? [] : [valveId];
            }),
          ),
        ),
      },
    ];
  });
}

export {
  getCostAnalysisDataSource,
  isCostAnalysisMockEnabled,
} from "./data-source";
export type { CostAnalysisDataSource } from "./data-source";

async function api(): Promise<CostAnalysisApi> {
  if (!isCostAnalysisMockEnabled()) return remoteCostAnalysisApi;
  const { mockCostAnalysisApi } = await import("./mock");
  return mockCostAnalysisApi;
}

async function fetchAllEnabledOptions<T>(
  fetchPage: (pageNo: number) => Promise<CostAnalysisOptionPage<T>>,
): Promise<T[]> {
  const records: T[] = [];
  let fetchedCount = 0;
  let pageNo = 1;

  while (true) {
    const page = await fetchPage(pageNo);
    if (page.records.length === 0) break;

    records.push(...page.records);
    fetchedCount += page.records.length;

    const total = Number(page.total);
    const hasValidTotal = Number.isFinite(total) && total >= 0;
    if (
      (hasValidTotal && fetchedCount >= total) ||
      (!hasValidTotal && page.records.length < OPTION_PAGE_SIZE)
    ) {
      break;
    }
    pageNo += 1;
  }

  return records;
}

function toSafePositiveInteger(value: unknown): number | null {
  const normalized =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[0-9]+$/.test(value)
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : null;
}

export const fetchCostAnalysisCategoryTree = async (
  keyword?: string,
  dimensionType?: CostAnalysisDimensionType,
) => {
  const client = await api();
  return dimensionType
    ? client.fetchCategoryTree(keyword, dimensionType)
    : client.fetchCategoryTree(keyword);
};

export async function fetchCostAnalysisDimensionTree(
  dimensionType: CostAnalysisDimensionType,
  keyword?: string,
  parentId?: string,
  level?: number,
) {
  const tree = await (isCostAnalysisMockEnabled()
    ? (async () => {
        const { fetchMockCostAnalysisDimensionTree } = await import("./mock");
        return fetchMockCostAnalysisDimensionTree(dimensionType, keyword);
      })()
    : parentId !== undefined || level !== undefined
      ? remoteCostAnalysisApi.fetchCategoryTree(
          keyword,
          dimensionType,
          parentId,
          level,
        )
      : fetchCostAnalysisCategoryTree(keyword, dimensionType));
  return withCostAnalysisProjectRoot(dimensionType, tree);
}

export const fetchCostAnalysisLatestBom = async (
  projectId: number,
  valveId: number,
) => (await api()).fetchLatestBom(projectId, valveId);

export const queryCostAnalysis = async (query: CostAnalysisQuery) =>
  (await api()).query(query);

export const saveCostAnalysisRemark = async (
  snapshotId: string,
  data: CostAnalysisRemarkUpdate,
) => {
  if (isCostAnalysisMockEnabled()) {
    const { saveMockCostAnalysisRemark } = await import("./mock");
    return saveMockCostAnalysisRemark(snapshotId, data);
  }
  return remoteCostAnalysisApi.saveRemark(snapshotId, data);
};

export const queryCostAnalysisDifferenceDetails = async (
  snapshotId: string,
  query: CostAnalysisDifferenceDetailQuery,
) => (await api()).queryDifferenceDetails(snapshotId, query);

export const queryCostAnalysisAiAnalysis = async (
  snapshotId: string,
  query: CostAnalysisAiAnalysisQuery,
) => {
  // AI 文案由前端确定性算法生成，事实仍从当前真实快照的差异接口读取。
  const { buildMockCostAnalysisAiAnalysis } =
    await import("./mock/ai-analysis");
  return buildMockCostAnalysisAiAnalysis(
    snapshotId,
    query,
    (await api()).queryDifferenceDetails,
  );
};

export const createCostAnalysisExportTask = async (snapshotId: string) =>
  (await api()).createExportTask(snapshotId);

export const getCostAnalysisExportTask = async (taskId: string) =>
  (await api()).getExportTask(taskId);

export const downloadCostAnalysisExport = async (
  taskId: string,
  fileId: string,
  fileName?: string,
) => (await api()).downloadExport(taskId, fileId, fileName);

export async function fetchCostAnalysisProjectOptions(): Promise<
  BusinessProjectItem[]
> {
  if (isCostAnalysisMockEnabled()) {
    const { fetchMockCostAnalysisProjectOptions } = await import("./mock");
    return fetchMockCostAnalysisProjectOptions();
  }

  const records = await fetchAllEnabledOptions((pageNo) =>
    fetchBusinessProjects({
      pageNo,
      pageSize: OPTION_PAGE_SIZE,
      status: "ENABLED",
    }),
  );
  return records.flatMap((project) => {
    const projectId = toSafePositiveInteger(project.projectId);
    return projectId === null ? [] : [{ ...project, projectId }];
  });
}

export async function fetchCostAnalysisValveOptions(): Promise<
  CostAnalysisValveOption[]
> {
  if (isCostAnalysisMockEnabled()) {
    const { fetchMockCostAnalysisValveOptions } = await import("./mock");
    const valves = await fetchMockCostAnalysisValveOptions();
    return valves.flatMap((valve) => {
      const valveId = toSafePositiveInteger(valve.valveId);
      return valveId === null ? [] : [{ ...valve, valveId }];
    });
  }

  const records = await fetchAllEnabledOptions((pageNo) =>
    fetchBusinessValves(
      {
        pageNo,
        pageSize: OPTION_PAGE_SIZE,
        status: "ENABLED",
      },
      { allowMock: false },
    ),
  );
  const valves = records.flatMap((valve) => {
    const valveId = toSafePositiveInteger(valve.valveId);
    return valveId === null ? [] : [{ ...valve, valveId }];
  });
  return valves;
}
