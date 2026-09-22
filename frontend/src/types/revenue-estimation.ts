export type RevenueEstimationPage<T> = {
  projectId: number;
  pageNo: number;
  pageSize: number;
  hasNext: boolean;
  versions: T[];
};

export type RevenueEstimationVersionItem = {
  versionId: number;
  projectId: number;
  versionNo: number;
  status: string;
  latestFlag: boolean;
};

export type RevenueEstimationResultSummary = {
  resultCode: string;
  resultName: string;
  resultType: string;
  resultScope: string;
  amount?: string | number | null;
  ratioValue?: string | number | null;
  currencyCode?: string | null;
  calculationStatus?: string | null;
};

export type RevenueEstimationDashboardSummary = {
  summaryCode: string;
  summaryName: string;
  summaryScope: string;
  amount?: string | number | null;
  ratioValue?: string | number | null;
  currencyCode?: string | null;
  formulaSnapshot?: string | null;
};

export type RevenueEstimationVersionDetail = RevenueEstimationVersionItem & {
  sourceBudgetVersionId?: number | null;
  sourceCostBomVersionId?: number | null;
  submittedBy?: number | null;
  submittedAt?: string | null;
  inputs: unknown[];
  results: RevenueEstimationResultSummary[];
};

export type RevenueEstimationExportCreateResponse = {
  exportId: number;
  projectId: number;
  versionId: number;
  format: string;
  fileName: string;
  fileId: number;
  rowCount: number;
  expiresAt?: string | null;
};

export type RevenueEstimationRecalculateResponse = {
  versionId: number;
  projectId: number;
  status: string;
  recalculationStatus: string;
  resultCount: number;
  failureCode?: string | null;
  recalculatedBy?: number | null;
  recalculatedAt?: string | null;
};
