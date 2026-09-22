import { request } from "@/api/http";
import type { DashboardOverview, DashboardRange } from "@/types/dashboard";

function fetchDashboard(url: string, range: DashboardRange) {
  return request<DashboardOverview>({
    url,
    method: "get",
    params: { range },
    skipErrorToast: true,
  });
}

export function fetchTaskDashboard(range: DashboardRange) {
  return fetchDashboard("/base/task-center/dashboard/overview", range);
}

export function fetchBudgetDashboard(range: DashboardRange) {
  return fetchDashboard("/budget/dashboard/overview", range);
}

export function fetchCostDashboard(range: DashboardRange) {
  return fetchDashboard("/cost/dashboard/overview", range);
}

export function fetchCommitteeDashboardOverview(range: DashboardRange) {
  return fetchDashboard("/committee/dashboard/overview", range);
}

export function fetchSystemDashboard(range: DashboardRange) {
  return fetchDashboard("/base/dashboard/overview", range);
}
