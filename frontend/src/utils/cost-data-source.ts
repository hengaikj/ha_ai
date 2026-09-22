export function formatCostDataSource(value?: string | number | null) {
  return value === "初始评估值" ? "评估值" : value;
}
