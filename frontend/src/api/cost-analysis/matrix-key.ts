export function buildCostAnalysisPointKey(
  projectId: number,
  valveId: number,
): string {
  return `${projectId}:${valveId}`;
}

export function buildCostAnalysisValueKey(
  patternId: number,
  pointKey: string,
): string {
  return `${patternId}@${pointKey}`;
}
