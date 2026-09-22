/**
 * 收益模块统一展示文本工具
 */

const REVENUE_STAGE_LABELS: Record<string, string> = {
  S1: "S1 数据填报",
  S2: "S2 集团部室审核",
  S3: "S3 填报数据复核",
  S4: "S4 二级公司财务校核",
  S5: "S5 二级公司上会",
  S6: "S6 集团财务审核",
  S7: "S7 上会管理",
  S8: "S8 上会评审",
};

/**
 * 阶段码 → 阶段展示名称
 */
export function formatRevenueStageDisplayText(code: string): string {
  return REVENUE_STAGE_LABELS[code] || code || "-";
}

/**
 * 通用「期间费用 / 审计动作」类字段展示文本
 * 对 null / undefined / boolean / number / string 等做兜底转换
 */
export function formatPeriodExpenseDisplayText(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}
