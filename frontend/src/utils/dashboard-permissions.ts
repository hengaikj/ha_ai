import type { DashboardModuleKey } from "@/types/dashboard";

type PermissionResolver = (codes: string[]) => boolean;

export interface DashboardPermissionContext {
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  hasPermission: PermissionResolver;
}

const BUDGET_PERMISSIONS = [
  "budget:initiation:list",
  "budget:gate-review:list",
  "budget:evaluation:list",
  "budget:reports:list",
  "budget:attachments:list",
  "system:project:initiation:list",
  "system:project:initiation:query",
  "system:project:valve:list",
  "system:project:valve:query",
  "system:initiation:budget:list",
  "system:initiation:budget:query",
  "system:valve:budget:list",
  "system:valve:budget:query",
];

const COST_PERMISSIONS = [
  "cost:query:list",
  "cost:analysis:list",
  "cost:bom:query:list",
  "cost:bom:query:view",
  "cost:research:project-cost:list",
  "cost:research:project-cost:view",
  "cost:research:history:list",
  "cost:research:history:view",
  "system:bom:list",
  "system:bom:newlist",
  "system:bom:query",
  "system:version:list",
  "system:generateVersion:list",
  "costmanage:costbom:show",
];

const COMMITTEE_PERMISSIONS = [
  "committee:dashboard:view",
  "committee:project:list",
  "committee:project:query",
  "committee:review:query",
  "committee:meeting:second:list",
  "committee:meeting:group:list",
  "committee:material:view",
  "committee:snapshot:view",
];

export function resolveDashboardModules(
  context: DashboardPermissionContext,
): DashboardModuleKey[] {
  if (!context.isAuthenticated) return [];

  const modules: DashboardModuleKey[] = ["task"];
  if (context.hasPermission(BUDGET_PERMISSIONS)) modules.push("budget");
  if (context.hasPermission(COST_PERMISSIONS)) modules.push("cost");
  if (context.hasPermission(COMMITTEE_PERMISSIONS)) modules.push("committee");
  if (context.isSuperAdmin) modules.push("system");
  return modules;
}
