export type { BackendId } from "@/types/information";
import type { BackendId } from "@/types/information";
import type { TaskCenterTaskResponse } from "@/types/task-center";

export type BudgetWorkbenchPageType = "initiation" | "gate-review";

export type RevenueFactDatasetType =
  | "VERSION_DETAIL"
  | "GATE_SNAPSHOT"
  | "AGGREGATE";

export type RevenueFactSortDirection = "ASC" | "DESC";

export interface RevenueFactQuery {
  projectId: BackendId;
  vehicleModelId: BackendId;
  gateId: BackendId;
  datasetType: RevenueFactDatasetType;
  fields?: string[];
  sortField?: string;
  sortDirection?: RevenueFactSortDirection;
  pageNum?: number;
  pageSize?: number;
}

export type RevenueFactRow = Record<string, unknown>;

export interface RevenueFactPageResponse {
  pageNo: number;
  pageSize: number;
  hasNext: boolean;
  total?: number;
  records: RevenueFactRow[];
}

export type RevenueFactExportTaskResponse = TaskCenterTaskResponse;

export type BudgetWorkbenchStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REVIEWING"
  | "APPROVED"
  | "REJECTED"
  | "LOCKED"
  | "ARCHIVED";

export interface BudgetWorkbenchItem {
  id: BackendId;
  projectId: BackendId;
  projectCode: string;
  projectName: string;
  vehicleModel?: string | null;
  valveId?: BackendId | null;
  valveProjectId?: BackendId | null;
  valvePoint?: string | null;
  wbsNumber?: string | null;
  wbsName?: string | null;
  versionId: BackendId;
  stageCode: "INITIATION" | "PASS_VALVE" | string;
  versionStatus: BudgetWorkbenchStatus | string;
  budgetAmount?: string | number | null;
  assessmentAmount?: string | number | null;
  reportStatus: BudgetWorkbenchStatus | string;
  passStatus?: "0" | "1" | "2" | "3" | string | null;
  passStatusLabel?: string | null;
  passTime?: string | null;
  budgetLock: boolean;
  evaluationLock: boolean;
  owner?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BudgetWorkbenchPageResponse {
  pageNo: number;
  pageSize: number;
  hasNext: boolean;
  total: number;
  records: BudgetWorkbenchItem[];
}

export interface BudgetWorkbenchAttachmentItem {
  itemId: BackendId;
  projectId: BackendId;
  projectCode: string;
  projectName: string;
  stageCode: string;
  stageName: string;
  valveId?: BackendId | null;
  valvePoint?: string | null;
  versionId: BackendId;
  fileId: BackendId;
  originalName: string;
  normalizedName: string;
  fileSize: number;
  contentType?: string | null;
  extension?: string | null;
  businessModule: string;
  businessId: BackendId;
  status: string;
  createdAt: string;
}

export interface BudgetWorkbenchAttachmentPageResponse {
  pageNo: number;
  pageSize: number;
  hasNext: boolean;
  total: number;
  records: BudgetWorkbenchAttachmentItem[];
}

export interface BudgetWorkbenchAttachmentQuery {
  keyword?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface BudgetWorkbenchQuery {
  pageType: BudgetWorkbenchPageType;
  projectId?: BackendId;
  valveId?: BackendId;
  keyword?: string;
  createdBy?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
  status?: string;
  pageNo?: number;
  pageSize?: number;
}

export interface BudgetWorkbenchAction {
  action: string;
  available: boolean;
  permission?: string | null;
  method?: string | null;
  url?: string | null;
  unavailableReason?: string | null;
}

export interface BudgetExportCreateResponse {
  exportId: number;
  projectId: BackendId;
  versionId: BackendId;
  stageCode: string;
  format: string;
  fileName: string;
  fileId: BackendId;
  rowCount: number;
  expiresAt?: string | null;
}

export interface BudgetVersionSubmitResponse {
  versionId: BackendId;
  projectId: BackendId;
  stageCode: string;
  versionNo: number;
  status: string;
  totalAmount?: string | number | null;
  submittedBy?: number | null;
  submittedAt?: string | null;
}

export interface BudgetVersionItem {
  versionId: BackendId;
  stageCode: string;
  versionNo: number;
  status: string;
  totalAmount?: string | number | null;
  submittedAt?: string | null;
  validateTask?: {
    taskId?: number | null;
    status?: string | null;
    errorSummary?: string | null;
    finishedAt?: string | null;
  } | null;
}

export interface BudgetVersionValidateResult {
  versionId?: BackendId | null;
  status?: string | null;
  errorSummary?: string | null;
  finishedAt?: string | null;
  errors?: unknown[] | null;
  warnings?: unknown[] | null;
  [key: string]: unknown;
}

export interface BudgetVersionCompareResult {
  projectId?: BackendId | null;
  baseVersionId?: BackendId | null;
  targetVersionId?: BackendId | null;
  stageCode?: string | null;
  summary?: BudgetVersionCompareSummary | null;
  differences?: BudgetVersionAmountDifference[] | null;
  [key: string]: unknown;
}

export interface BudgetVersionCompareSummary {
  totalCount?: number | null;
  addedCount?: number | null;
  removedCount?: number | null;
  updatedCount?: number | null;
  unchangedCount?: number | null;
  baseTotalAmount?: string | number | null;
  targetTotalAmount?: string | number | null;
  diffTotalAmount?: string | number | null;
}

export interface BudgetVersionAmountDifference {
  wbsNumber?: string | null;
  wbsName?: string | null;
  changeType?: "ADDED" | "REMOVED" | "UPDATED" | "UNCHANGED" | string | null;
  amountKind?: string | null;
  dimensionType?: string | null;
  patternId?: BackendId | null;
  valveId?: BackendId | null;
  baseAmount?: string | number | null;
  targetAmount?: string | number | null;
  diffAmount?: string | number | null;
}

export interface BudgetReviewTableExportTaskResponse {
  projectId?: BackendId | null;
  valveId?: BackendId | null;
  reviewType: string;
  taskId: number;
  batchNo: string;
  status: string;
}

export interface BudgetWorkbenchLockResponse {
  itemId: BackendId;
  projectId: BackendId;
  valveId?: BackendId | null;
  budgetLocked: boolean;
  evaluateLocked: boolean;
}

export interface BudgetStageAmount {
  amountId?: number | null;
  amountKind: string;
  dimensionType: string;
  patternId?: number | null;
  valveId?: number | null;
  amount: string;
  remark?: string | null;
}

export interface BudgetStageRow {
  rowId?: number | null;
  wbsNumber: string;
  wbsName?: string | null;
  valveId?: number | null;
  valveGradeId?: number | null;
  gradeId?: number | null;
  sorId?: number | null;
  paymentRatio?: string | null;
  paymentEstimate?: string | null;
  reductionDiff?: string | null;
  reductionRatio?: string | null;
  totalBudgetAmount?: string | null;
  totalBudgetRemark?: string | null;
  amounts: BudgetStageAmount[];
}

export interface BudgetStageResponse {
  projectId: BackendId;
  stageCode: string;
  versionId: BackendId;
  versionNo: number;
  status: string;
  rows: BudgetStageRow[];
}

export type BudgetReviewTableRow = {
  rowName?: string | null;
  gradeCode?: string | null;
  group?: number | string | null;
  gradeName?: string | null;
  firstLevelName?: string | null;
  secondLevelName?: string | null;
  thirdLevelName?: string | null;
  level1Name?: string | null;
  level2Name?: string | null;
  level3Name?: string | null;
  budgetNonFrame?: string | number | null;
  budgetFrame?: string | number | null;
  budgetTotal?: string | number | null;
  assessNonFrame?: string | number | null;
  assessFrame?: string | number | null;
  assessTotal?: string | number | null;
  budgetAmount?: string | number | null;
  assessAmount?: string | number | null;
  assessmentAmount?: string | number | null;
  reductionAmount?: string | number | null;
  reductionRatio?: string | number | null;
  assessRemark?: string | null;
  remark?: string | null;
  releaseAmount?: string | number | null;
  nonStructuralA1?: string | number | null;
  structuralA2?: string | number | null;
  submitSumA?: string | number | null;
  nonStructuralB1?: string | number | null;
  structuralB2?: string | number | null;
  submitSumB?: string | number | null;
  projectSorTonghua?: {
    isTonghuaPlan?: number | string | boolean | null;
    remark?: string | null;
  } | null;
  [key: string]: unknown;
};

export type BudgetReviewTemplateCell = {
  value?: string | number | boolean | null;
  role?: string;
  formula?: string;
  fieldName?: string;
  fieldKey?: string;
  fieldLabel?: string;
  fieldWidth?: number;
  required?: boolean;
  readonly?: boolean;
  style?: Record<string, unknown>;
  [key: string]: unknown;
};

export type BudgetReviewListColumn = {
  key: string;
  label: string;
  type?: string;
  children?: BudgetReviewListColumn[];
  width?: number;
  minWidth?: number;
  align?: "left" | "center" | "right";
  fixed?: "left" | "right" | boolean;
  fixedOffset?: number;
  visible?: boolean;
  editable?: boolean;
  readonly?: boolean;
  required?: boolean;
  sortable?: boolean;
  resizable?: boolean;
  ellipsis?: boolean;
  formula?: string;
  format?: Record<string, unknown>;
  style?: Record<string, unknown>;
  permissions?: BudgetReviewListPermissionRule[];
};

export type BudgetReviewListPermissionRule = {
  scope: "ROW" | "COLUMN" | "CELL";
  action?: "VIEW" | "EDIT" | string;
  effect: "ALLOW" | "DENY";
  principalType?: "USER" | "ROLE" | "ORG" | "DEPT" | string;
  principalId?: string | number;
  rowKey?: string | number;
  columnKey?: string;
};

export type BudgetReviewRuleCondition =
  | string
  | number
  | boolean
  | null
  | unknown[]
  | {
      $eq?: unknown;
      $ne?: unknown;
      $in?: unknown[];
      $nin?: unknown[];
      $gt?: string | number;
      $gte?: string | number;
      $lt?: string | number;
      $lte?: string | number;
      $contains?: string | number;
      $exists?: boolean;
    };

export type BudgetReviewCellSpanRule = {
  columnKey: string;
  rowspan?: number;
  colspan?: number;
  hidden?: boolean;
};

export type BudgetReviewCellRule = {
  match?: Record<string, BudgetReviewRuleCondition>;
  columnKey?: string;
  columnKeys?: string[];
  readonly?: boolean;
  editable?: boolean;
  required?: boolean;
  style?: Record<string, unknown>;
};

export type BudgetReviewRowRule = {
  match?: Record<string, BudgetReviewRuleCondition>;
  readonly?: boolean;
  editable?: boolean;
  editableColumns?: string[];
  cellSpan?: BudgetReviewCellSpanRule;
  cellSpans?: BudgetReviewCellSpanRule[];
  cellRules?: BudgetReviewCellRule[];
  style?: Record<string, unknown>;
};

export type BudgetReviewReportSection = {
  key: string;
  title: string;
  type?: "table" | "compare" | "record" | "summary";
  rowsKey?: string;
  columns?: BudgetReviewListColumn[];
  compareColumns?: BudgetReviewListColumn[];
  compareColumnsNoPattern?: BudgetReviewListColumn[];
  rowKey?: string;
  rowRules?: BudgetReviewRowRule[];
  permissions?: BudgetReviewListPermissionRule[];
  visible?: boolean;
  readonly?: boolean;
  layout?: {
    columns?: number;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
  };
};

export type BudgetReviewTemplateSheet = {
  id?: string;
  name: string;
  title?: string;
  rows: BudgetReviewTemplateCell[][];
  columns?: Array<{ key?: string; label?: string; width?: number }>;
  merges?: Array<{
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  }>;
  [key: string]: unknown;
};

export type BudgetReviewTemplateDesign = {
  businessCode?: string;
  title?: string;
  list?: {
    columns?: BudgetReviewListColumn[];
    rowKey?: string;
    rowRules?: BudgetReviewRowRule[];
    permissionScopes?: string[];
  };
  sections?: BudgetReviewReportSection[];
  permissions?: {
    scopes?: string[];
    rules?: BudgetReviewListPermissionRule[];
    [key: string]: unknown;
  };
  activeSheet?: string;
  sheets?: BudgetReviewTemplateSheet[];
  [key: string]: unknown;
};

export type BudgetReviewTableRuntimeResponse = {
  projectId: BackendId;
  valveId: BackendId;
  reviewType: "INITIATION" | "SELF" | "BRAND" | string;
  exists: boolean;
  templateId?: number | string | null;
  templateVersionId?: number | string | null;
  templateVersionNo?: string | null;
  templateName?: string | null;
  designJson?: BudgetReviewTemplateDesign | null;
  dataJson: BudgetReviewTableRow[];
  defaultDataUsed: boolean;
};

export type BudgetReviewCompareOption = {
  id: number | string;
  label: string;
  projectId?: BackendId | null;
  valveId?: BackendId | null;
  raw?: unknown;
};

export interface InitiationPatternItem {
  id: number;
  patternName: string;
}

export interface InitiationWbsItem {
  id: number;
  wbsNumber: string;
  wbsName: string;
  totalBudgetAmount: number;
  assessTotalAmount: number;
  submitter: string;
  sorName: string;
  paymentRatio: string;
  paymentEstimate: number;
  reductionDiff: number;
  reductionRatio: number;
  paymentAmount: number;
  amortizationAmount: number;
  totalAmount: number;
  remark: string;
  totalOverspend: number;
  paymentOverspend: number;
  version: number;
  majorVersion?: string | null;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string;
  gradeId: number;
  grade: {
    gradeName: string;
    level: number;
    realLevel: number;
  };
  initiationBudget: InitiationWbsBudgetItem[];
}

export interface InitiationWbsBudgetItem {
  patternId: number;
  budget: number;
  assessBudget: number;
  paymentBudget: number;
  remark: string;
  assessRemark: string;
}

export interface InitiationGradeTreeNode {
  id: number;
  name: string;
  children?: InitiationGradeTreeNode[];
}

export interface InitiationWbsQuery {
  projectId: BackendId;
  /** Budget grade tree node used for hierarchical filtering. */
  treeGradeId?: string;
  gradeId?: string;
  wbsNumber?: string;
  wbsName?: string;
  level?: string;
  beginTime?: string;
  endTime?: string;
  operator?: string;
  totalBudgetAmount?: string;
  isLatestVersion?: number | null;
  majorVersion?: string | null;
  abolishFlag?: number;
  pageSize?: number;
  pageNum?: number;
  includeDetails?: boolean;
  historyRowId?: string;
}

export interface GateReviewBudgetItem {
  name: string;
  patternId?: number | null;
  valveId?: number | null;
  budget: number;
  remark: string;
  type: number;
  valveType?: number;
}

export interface GateReviewWbsItem {
  id: number;
  wbsNumber: string;
  wbsName: string;
  gradeName: string;
  level: number;
  projectName: string;
  submitter: string;
  sorName: string;
  paymentRatio: string;
  paymentEstimate: number;
  reductionDiff: number;
  reductionRatio: number;
  version: number;
  majorVersion?: string | null;
  createBy: string;
  createName?: string;
  createTime: string;
  updateBy: string;
  updateTime: string;
  gradeId: number;
  valveBudgetInfoVoList: GateReviewBudgetItem[];
}

export interface InitiationAssessSaveItem {
  id: number;
  gradeId?: number;
  sorName?: string;
  paymentRatio?: string;
  paymentEstimate?: string;
  initiationBudget: {
    id?: number;
    patternId?: number;
    budget?: string;
    remark?: string;
    assessBudget?: string;
    assessRemark?: string;
    paymentBudget?: string;
  }[];
  paymentAmount?: string;
  amortizationAmount?: string;
  totalAmount?: string;
  totalOverspend?: string;
  paymentOverspend?: string;
  remark?: string;
  totalBudgetAmount?: string;
}

export interface InitiationCompareProject {
  id: number;
  label: string;
  children: {
    id: string;
    label: string;
    pid: number;
  }[];
}

export interface GateReviewWbsQuery {
  projectId: BackendId;
  valveId: BackendId;
  treeGradeId?: string;
  wbsNumber?: string;
  wbsName?: string;
  level?: string;
  beginTime?: string;
  endTime?: string;
  operator?: string;
  amount?: string;
  isLatestVersion?: number | null;
  majorVersion?: string | null;
  abolishFlag?: number;
  pageSize?: number;
  pageNum?: number;
  includeDetails?: boolean;
  historyRowId?: string;
}

export interface GateReviewCompareProject {
  projectId: number;
  projectName: string;
  valveList: {
    id: number;
    valveName: string;
  }[];
}

export interface GateReviewAssessSaveItem {
  id: number;
  sorName?: string;
  paymentRatio?: string;
  paymentEstimate?: string | number | null;
  valveBudgetDTOs: {
    passValveId?: number;
    patternId?: number;
    valveType?: number;
    type?: number;
    budget?: string | number | null;
    remark?: string;
  }[];
}
