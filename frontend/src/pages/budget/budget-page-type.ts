import type { BudgetWorkbenchPageType } from "@/types/budget";

export function resolveBudgetWorkbenchPageType(
  path: string,
  metaPageType: unknown,
): BudgetWorkbenchPageType {
  const normalizedPath = path.replace(/\/$/, "");
  if (/(?:^|\/)gate-review$|(?:^|\/)clique$/.test(normalizedPath)) {
    return "gate-review";
  }
  return metaPageType === "gate-review" ? "gate-review" : "initiation";
}
