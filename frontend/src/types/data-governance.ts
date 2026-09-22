import type { PageResult } from "@/types/api";

export type GovernanceBatchStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "FAILED"
  | "RETRYING"
  | "CANCELLED";
export type GovernanceStepStatus = "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";
export type GovernanceSeverity = "WARN" | "RISK" | "ERROR";
export type GovernanceArrivalStatus = "ARRIVED" | "ACCEPTED" | "REJECTED";
export type GovernanceSourceBatchArrivalStatus =
  | "ARRIVED"
  | "VALIDATED"
  | "REJECTED"
  | "MISSING";
export type GovernanceSourceBatchQualityStatus = "PASS" | "WARN" | "RISK";
export type GovernanceQualityStatus =
  | "PASS"
  | "WARN"
  | "RISK"
  | "PENDING"
  | "PASSED"
  | "WARNING"
  | "FAILED";
export type GovernanceQualityIssueStatus = "OPEN" | "IGNORED" | "RESOLVED";
export type GovernanceScriptStatus =
  | "DRAFT"
  | "REVIEWING"
  | "PUBLISHED"
  | "REJECTED"
  | "RETIRED";

export interface GovernanceOverview {
  enabledJobs: number;
  pendingBatches: number;
  runningBatches: number;
  staleRunningBatches: number;
  failedBatches: number;
  failedQualityRules: number;
  publishedSummaries: number;
}
export interface GovernanceSource {
  id: number;
  sourceCode: string;
  sourceName: string;
  sourceSystem: string;
  sourceTable: string;
  databaseType: string;
  accessMethod: string;
  endpoint?: string;
  host?: string;
  port?: number;
  databaseName?: string;
  schemaName?: string;
  serviceName?: string;
  jdbcUrl?: string;
  username?: string;
  passwordConfigured?: boolean;
  incrementalField?: string;
  lastIncrementalValue?: string;
  connectionStatus: "REGISTERED" | "ACTIVE" | "SUSPENDED";
  lakePath: string;
  targetOdsTable: string;
  syncFrequency: string;
  ownerName: string;
  schemaVersion: string;
  enabled: boolean;
  lastArrivalAt?: string;
  lastSourceBatchNo?: string;
  lastTestAt?: string;
  lastTestStatus?: "SUCCESS" | "FAILED";
  lastTestMessage?: string;
  remark?: string;
  createTime: string;
  updateTime: string;
}
export interface GovernanceSourceSyncResult {
  sourceCode: string;
  targetOdsTable: string;
  syncedRows: number;
  syncedAt: string;
  dwdRows: number;
  dwdScripts: number;
  dwdBatchNo?: string;
}
export interface GovernanceTableMetadata {
  tableCode: string;
  layerType: "ODS" | "DWD" | "ADS";
  schemaName: string;
  tableName: string;
  qualifiedName: string;
  tableComment?: string;
}
export interface GovernanceAdsTableColumn {
  name: string;
  dataType?: string;
  columnSize?: number;
  nullable: boolean;
  comment?: string;
}
export interface GovernanceAdsTableContent {
  table: GovernanceTableMetadata;
  columns: GovernanceAdsTableColumn[];
  rows: Array<Record<string, unknown>>;
  total: number;
  pageNo: number;
  pageSize: number;
  sqlPreview?: string;
}
export type GovernanceAdsQueryLogic = "AND" | "OR";
export type GovernanceAdsQueryOperator =
  | "EQ"
  | "NE"
  | "CONTAINS"
  | "STARTS_WITH"
  | "ENDS_WITH"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "BETWEEN"
  | "IS_NULL"
  | "IS_NOT_NULL";
export interface GovernanceAdsQueryCondition {
  logic: GovernanceAdsQueryLogic;
  field: string;
  operator: GovernanceAdsQueryOperator;
  value?: string;
  secondValue?: string;
}
export interface GovernanceAdsQueryRequest {
  tableCode: string;
  fields?: string[];
  conditions?: GovernanceAdsQueryCondition[];
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  pageNo: number;
  pageSize: number;
}
export type GovernanceSourceRequest = Pick<
  GovernanceSource,
  | "sourceCode"
  | "sourceName"
  | "sourceSystem"
  | "sourceTable"
  | "databaseType"
  | "accessMethod"
  | "endpoint"
  | "host"
  | "port"
  | "databaseName"
  | "schemaName"
  | "serviceName"
  | "jdbcUrl"
  | "username"
  | "incrementalField"
  | "connectionStatus"
  | "lakePath"
  | "targetOdsTable"
  | "syncFrequency"
  | "ownerName"
  | "schemaVersion"
  | "enabled"
  | "remark"
> & {
  password?: string;
  passwordChanged?: boolean;
};
export interface GovernanceArrival {
  id: number;
  sourceCode: string;
  sourceBatchNo: string;
  bizDate: string;
  recordCount: number;
  rowHash?: string;
  status: GovernanceArrivalStatus;
  errorMessage?: string;
  arrivedAt: string;
  acceptedAt?: string;
}
export interface GovernanceSourceBatch {
  id: number;
  connectionCode: string;
  objectCode: string;
  sourceType: string;
  sourceBatchNo: string;
  bizDate: string;
  targetOdsTable: string;
  recordCount: number;
  rowHash?: string;
  arrivalStatus: GovernanceSourceBatchArrivalStatus;
  qualityStatus: GovernanceSourceBatchQualityStatus;
  issueCount: number;
  ownerName?: string;
  originalFileName?: string;
  connectionConfigVersion?: number;
  extractionSqlHash?: string;
  readCount?: number;
  errorMessage?: string;
  arrivedAt: string;
  acceptedAt?: string;
  createBy: string;
  createTime: string;
}
export interface GovernanceJob {
  id: number;
  jobCode: string;
  jobName: string;
  jobType: string;
  sourceSystem: string;
  targetLayer: "ODS" | "DWD" | "ADS";
  scriptVersion: string;
  enabled: boolean;
  scheduleType?: "MANUAL" | "CRON" | "SYNC";
  cronExpression?: string;
  remark?: string;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string;
}
export interface GovernanceScript {
  id: number;
  scriptCode: string;
  scriptName: string;
  engineType: "MYSQL" | "SPARK" | "HIVE" | "FLINK";
  currentVersion?: number;
  enabled: boolean;
  createTime: string;
  updateTime: string;
}
export interface GovernanceScriptCreateRequest {
  scriptCode: string;
  scriptName: string;
  engineType: "MYSQL";
}
export interface GovernanceScriptVersion {
  id: number;
  scriptCode: string;
  versionNo: number;
  sqlContent: string;
  contentHash: string;
  status: GovernanceScriptStatus;
  parameterSchema: string;
  changeSummary?: string;
  createdBy: string;
  reviewedBy?: string;
  reviewComment?: string;
  submittedAt?: string;
  publishedAt?: string;
  createTime: string;
  updateTime: string;
}
export interface GovernanceScriptDetail {
  script: GovernanceScript;
  versions: GovernanceScriptVersion[];
}
export interface GovernanceScriptDraftRequest {
  sqlContent: string;
  changeSummary?: string;
}
export interface GovernanceCollectionObject {
  id: number;
  connectionCode: string;
  objectCode: string;
  sourceSystem: string;
  objectType: string;
  sourceObject: string;
  businessDescription?: string;
  targetOdsTable: string;
  ownerName?: string;
  enabled: boolean;
}
export interface GovernanceJobSourceBindingRequest {
  collectionObjectCode: string;
  required: boolean;
}
export interface GovernanceJobStepRequest {
  stepCode: string;
  stepName: string;
  stepOrder: number;
  stepType: "SQL" | "ODS_TO_DWD_DEDUP";
  scriptCode?: string;
  inputLayer?: "ODS" | "DWD" | "ADS";
  outputLayer?: "DWD" | "ADS";
  inputTables?: string;
  outputTable: string;
  failFast: boolean;
}
export interface GovernanceJobCreateRequest {
  jobCode: string;
  jobName: string;
  jobType: "FULL" | "ODS" | "DWD" | "ADS";
  sourceSystem: string;
  targetLayer: "ODS" | "DWD" | "ADS";
  scheduleType: "MANUAL" | "SYNC";
  enabled: boolean;
  remark?: string;
  sources: GovernanceJobSourceBindingRequest[];
  steps: GovernanceJobStepRequest[];
}
export interface GovernanceBatch {
  id: number;
  batchNo: string;
  jobId: number;
  requestNo: string;
  parentBatchNo?: string;
  bizDate: string;
  projectNo?: string;
  vehiclem?: string;
  triggerType: "MANUAL" | "QUARTZ" | "SYNC" | "RETRY";
  triggerBy: string;
  status: GovernanceBatchStatus;
  currentStep?: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  qualityStatus: GovernanceSourceBatchQualityStatus;
  missingSourceCount: number;
  retryCount: number;
  errorMessage?: string;
  workerId?: string;
  heartbeatAt?: string;
  startedAt?: string;
  finishedAt?: string;
  createTime: string;
  updateTime: string;
}
export interface GovernanceStepLog {
  id: number;
  batchNo: string;
  stepCode: string;
  stepName: string;
  status: GovernanceStepStatus;
  inputCount: number;
  outputCount: number;
  scriptCode?: string;
  scriptVersion?: number;
  scriptHash?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
}
export interface GovernanceQualityResult {
  id: number;
  batchNo: string;
  ruleCode: string;
  severity: GovernanceSeverity;
  checkedCount: number;
  failedCount: number;
  thresholdValue: string | number;
  passed: boolean;
  qualityStatus?: GovernanceSourceBatchQualityStatus;
  issueCount?: number;
  sourceTable?: string;
  problemField?: string;
  ruleName?: string;
  sampleMessage?: string;
  checkedAt: string;
}
export interface GovernanceLineage {
  id: number;
  batchNo: string;
  stepCode: string;
  sourceSystem: string;
  sourceLayer?: "ODS" | "DWD" | "ADS";
  sourceTable: string;
  targetLayer?: "ODS" | "DWD" | "ADS";
  targetTable: string;
  sourceBatchNo?: string;
  recordCount: number;
  inputCount?: number;
  outputCount?: number;
  scriptCode?: string;
  scriptHash?: string;
  scriptVersion: string;
  createTime: string;
}
export interface GovernanceBatchDetail {
  batch: GovernanceBatch;
  steps: GovernanceStepLog[];
  qualityResults: GovernanceQualityResult[];
  lineages: GovernanceLineage[];
}
export interface GovernanceQualityRule {
  id: number;
  ruleCode: string;
  ruleName: string;
  targetTable: string;
  ruleGroup?: string;
  targetLayer?: "ODS" | "DWD" | "ADS";
  targetField?: string;
  ruleExpression?: string;
  description?: string;
  ownerName?: string;
  severity: GovernanceSeverity;
  thresholdValue: string | number;
  enabled: boolean;
  createTime: string;
  updateTime: string;
}
export interface AdsCostSummary {
  id: number;
  bizDate: string;
  projectNo: string;
  vehiclem: string;
  materialCost: string | number;
  purchaseCost: string | number;
  quotaCost: string | number;
  otherCost: string | number;
  totalCost: string | number;
  partCount: number;
  batchNo: string;
  qualityStatus: GovernanceQualityStatus;
  createTime: string;
}
export interface AdsCostSummaryDetail {
  id: number;
  summaryId: number;
  partNo: string;
  partName?: string;
  quantity: string | number;
  weightedPrice: string | number;
  materialCost: string | number;
  priceMatchStatus: "MATCHED" | "MISSING";
  batchNo: string;
  createTime: string;
}
export interface AdsCostSourceDetail {
  id: number;
  governanceBatchNo: string;
  bizDate: string;
  projectNo: string;
  vehiclem: string;
  partNo: string;
  factoryCode?: string;
  supplierCode?: string;
  sourceCode: string;
  priorityNo: number;
  sourceTable?: string;
  sourceBatchNo?: string;
  candidatePrice?: string | number;
  packagingCost?: string | number;
  transportCost?: string | number;
  effectiveFrom?: string;
  effectiveTo?: string;
  selected: boolean;
  notSelectedReason?: string;
  qualityStatus: GovernanceSourceBatchQualityStatus;
  createTime: string;
}
export interface AdsCostException {
  id: number;
  governanceBatchNo: string;
  bizDate: string;
  ruleCode: string;
  ruleName: string;
  severity: GovernanceSeverity;
  sourceTable?: string;
  problemField?: string;
  businessKey?: string;
  issueMessage: string;
  ownerName?: string;
  handlingStatus: GovernanceQualityIssueStatus;
  handlingComment?: string;
  createTime: string;
}
export interface GovernanceArrivalRequest {
  sourceBatchNo: string;
  bizDate: string;
  recordCount: number;
  rowHash?: string;
}
export interface GovernanceTriggerRequest {
  jobCode: string;
  requestNo: string;
  bizDate: string;
  projectNo?: string;
  vehiclem?: string;
}
export interface GovernanceQualityRuleRequest {
  severity: GovernanceSeverity;
  thresholdValue: string | number;
  enabled: boolean;
  ruleGroup?: string;
  targetTable?: string;
  targetLayer?: "ODS" | "DWD" | "ADS";
  targetField?: string;
  ruleExpression?: string;
  description?: string;
  ownerName?: string;
}
export interface GovernanceQualityIssue {
  id: number;
  batchNo: string;
  ruleCode: string;
  ruleName: string;
  severity: GovernanceSeverity;
  sourceTable?: string;
  problemField?: string;
  businessKey?: string;
  issueMessage: string;
  ownerName?: string;
  status: GovernanceQualityIssueStatus;
  handlingComment?: string;
  createTime: string;
  updateTime: string;
}
export interface GovernanceQualityIssueQuery extends GovernancePageQuery {
  batchNo?: string;
  ruleCode?: string;
  status?: GovernanceQualityIssueStatus;
}
export interface GovernanceQualityIssueUpdateRequest {
  status: GovernanceQualityIssueStatus;
  handlingComment?: string;
  ownerName?: string;
}
export interface GovernancePageQuery {
  pageNo: number;
  pageSize: number;
}
export interface GovernanceArrivalQuery extends GovernancePageQuery {
  sourceCode?: string;
}
export interface GovernanceSourceBatchQuery extends GovernancePageQuery {
  objectCode?: string;
}
export interface GovernanceBatchQuery extends GovernancePageQuery {
  jobCode?: string;
  status?: GovernanceBatchStatus;
}
export interface GovernanceCostSummaryQuery extends GovernancePageQuery {
  projectNo?: string;
  vehiclem?: string;
}
export type GovernancePageResult<T> = PageResult<T>;
