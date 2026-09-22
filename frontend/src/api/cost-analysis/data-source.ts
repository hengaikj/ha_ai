export type CostAnalysisDataSource = "mock" | "remote";

export function getCostAnalysisDataSource(): CostAnalysisDataSource {
  const configuredSource = import.meta.env.VITE_COST_ANALYSIS_DATA_SOURCE;
  if (configuredSource === "mock" || configuredSource === "remote") {
    return configuredSource;
  }

  return import.meta.env.DEV ? "mock" : "remote";
}

export function isCostAnalysisMockEnabled(): boolean {
  return getCostAnalysisDataSource() === "mock";
}
