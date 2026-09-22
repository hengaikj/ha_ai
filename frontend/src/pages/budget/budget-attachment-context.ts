import type {
  BudgetWorkbenchItem,
  BudgetWorkbenchPageType,
} from "@/types/budget";

export function resolveBudgetAttachmentContext(
  row: BudgetWorkbenchItem,
  pageType: BudgetWorkbenchPageType,
) {
  if (pageType === "gate-review") {
    if (row.valveProjectId === null || row.valveProjectId === undefined) {
      throw new Error("阀点项目标识缺失，无法处理附件");
    }
    return {
      businessModule: "BIZ_PASS",
      businessId: row.valveProjectId,
    } as const;
  }
  return {
    businessModule: "BIZ_PROJECT",
    businessId: row.projectId,
  } as const;
}
