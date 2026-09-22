type TaskBusinessLabelSource = {
  businessKey?: string | null;
  businessType?: string | null;
  taskType: string;
};

/** 成本任务执行完成与每条业务数据计算成功分开展示。 */
export function hasCostCalculationFailures(task?: {
  status: string;
  taskType: string;
  failedCount: number;
} | null): boolean {
  return !!task && task.status === "SUCCEEDED" && task.failedCount > 0
    && ["COST_CALCULATE", "COST_IMPORT"].includes(task.taskType);
}

const defaultTaskTypeLabels: Record<string, string> = {
  TABLE_IMPORT: "表格导入",
  TABLE_EXPORT: "表格导出",
  BASE_EXPORT: "基础资料导出",
  BUDGET_IMPORT: "预算导入",
  BUDGET_EXPORT: "预算导出",
  COST_IMPORT: "成本导入",
  COST_EXPORT: "成本导出",
  COST_CALCULATE: "成本计算",
  COMMITTEE_EXPORT: "委员会导出",
  COMMITTEE_REPORT: "委员会报告",
  ATTACHMENT_PACKAGE: "附件打包",
  REPORT_GENERATE: "报告生成",
  FILE_PACKAGE: "文件打包",
  BATCH_CALCULATE: "批量计算",
};

export function resolveTaskBusinessLabel(
  task: TaskBusinessLabelSource,
  taskTypeLabels: Record<string, string> = defaultTaskTypeLabels,
): string {
  const businessKey = task.businessKey?.trim();
  return (
    businessKey ||
    taskTypeLabels[task.taskType] ||
    defaultTaskTypeLabels[task.taskType] ||
    "其他任务"
  );
}
