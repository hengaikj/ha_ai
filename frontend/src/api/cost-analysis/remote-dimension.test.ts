import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/api/http", () => ({ request }));
import { remoteCostAnalysisApi } from "./remote";
import { fetchCostAnalysisDimensionTree } from "./index";

beforeEach(() => vi.stubEnv("VITE_COST_ANALYSIS_DATA_SOURCE", "remote"));

afterEach(() => {
  vi.unstubAllEnvs();
  request.mockReset();
});

describe("研发专业真实维度请求", () => {
  it("按展示层级请求时无需 parentId", async () => {
    request.mockResolvedValue([]);
    await fetchCostAnalysisDimensionTree(
      "VEHICLE_SYSTEM",
      undefined,
      undefined,
      2,
    );
    expect(request).toHaveBeenCalledWith({
      url: "/cost/analysis/categories/tree",
      method: "get",
      params: { dimensionType: "VEHICLE_SYSTEM", level: 2 },
    });
  });
  it("远程模式携带研发维度和关键词，不返回演示分类", async () => {
    vi.stubEnv("VITE_COST_ANALYSIS_DATA_SOURCE", "remote");
    request.mockResolvedValue([]);
    await fetchCostAnalysisDimensionTree("RESPONSIBILITY_DEPARTMENT", "车身");
    expect(request).toHaveBeenCalledWith({
      url: "/cost/analysis/categories/tree",
      method: "get",
      params: { dimensionType: "RESPONSIBILITY_DEPARTMENT", keyword: "车身" },
    });
  });

  it("后端研发维度失败时传递错误，不回退到演示数据", async () => {
    vi.stubEnv("VITE_COST_ANALYSIS_DATA_SOURCE", "remote");
    const failure = new Error("研发专业不可用");
    request.mockRejectedValue(failure);
    await expect(
      fetchCostAnalysisDimensionTree("RESPONSIBILITY_DEPARTMENT"),
    ).rejects.toBe(failure);
  });
});

it("指定阀点读取BOM并转换后端字符串标识", async () => {
  request.mockResolvedValue({
    projectId: "1001",
    valveId: "3",
    bomVersionId: "501",
    patterns: [{ patternId: "2", patternName: "标准", sortNo: "2" }],
  });
  const bom = await remoteCostAnalysisApi.fetchLatestBom(1001, 3);
  expect(request).toHaveBeenCalledWith({
    url: "/cost/analysis/projects/1001/latest-bom",
    method: "get",
    params: { valveId: 3 },
  });
  expect(bom).toMatchObject({
    projectId: 1001,
    valveId: 3,
    bomVersionId: 501,
    patterns: [{ patternId: 2 }],
  });
});
