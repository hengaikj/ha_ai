export type DashboardRange = "7d" | "30d" | "90d";

export type DashboardModuleKey =
  | "task"
  | "budget"
  | "cost"
  | "committee"
  | "system";

export interface DashboardMetric {
  code: string;
  label: string;
  value: number;
  target?: string | null;
}

export interface DashboardDistributionItem {
  code: string;
  label: string;
  value: number;
}

export interface DashboardTrendPoint {
  date: string;
  seriesCode: string;
  seriesName: string;
  value: number;
}

export interface DashboardOverview {
  summary: DashboardMetric[];
  statusDistribution: DashboardDistributionItem[];
  trend: DashboardTrendPoint[];
  updatedAt: string;
}
