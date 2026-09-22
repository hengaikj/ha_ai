import type { CommitteeId } from "@/types/committee";

export type MaterialTarget =
  | "cover"
  | "previousGateRequirements"
  | "deliveryReview"
  | "decision"
  | "attachment";

export type ReviewBlockKind = "quality" | "cost" | "revenue" | "custom";

export type ReviewBlock = {
  id: string;
  kind: ReviewBlockKind;
  title: string;
  content?: string;
};

export type CostPoint = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  fixed?: boolean;
};

export type QualityIssue = {
  id: string;
  title?: string;
  issue: string;
  action: string;
  ownerDepartment: string;
  dueDate: string;
};

export type PreviousGateRequirement = {
  id: string;
  requirement: string;
  completion: string;
};

export type CostForecastNode = {
  id: string;
  label: string;
  value: string;
};

export type CostForecastBaseNode = {
  id: string;
  label: string;
  readonly?: boolean;
};

export type RevenueForecastGroup = {
  id: string;
  label: string;
  margin: string;
  profit: string;
  metrics?: Record<string, string>;
  customRows?: RevenueForecastMetricRow[];
};

export type RevenueForecastBaseNode = {
  id: string;
  label: string;
  readonly?: boolean;
};

export type RevenueForecastMetricRow = {
  key: string;
  label: string;
  category: string;
  custom?: boolean;
};

export type RevenueSupplementMetric = {
  id: string;
  label: string;
  value: string;
};

export type ImportedMaterialRow = Record<string, unknown>;

export type TimelinePoint = {
  gateId?: CommitteeId | number | null;
  gate?: string;
  date?: string;
  current?: boolean;
  completed?: boolean;
  offset: number;
};

export type SignalTone = "green" | "yellow" | "red" | "empty";

export type ReviewMatrixRow = {
  dimension: string;
  [key: string]: SignalTone | string;
};

export type ReviewMatrixDisplayGroup = {
  title: string;
  count: string;
  departments: Array<{
    key: string;
    label: string;
    taskId?: CommitteeId | number | null;
  }>;
  rows: ReviewMatrixRow[];
};

export type AttachmentDisplayItem = {
  attachmentId: CommitteeId;
  title: string;
  type: "pdf" | "word" | "file";
  icon: string;
  fileName: string;
};
