export type CostAnalysisCategoryLevel = 0 | 1 | 2 | 3;
export type CostAnalysisDimensionType =
  | "VEHICLE_SYSTEM"
  | "RESPONSIBILITY_DEPARTMENT";

export const COST_ANALYSIS_METRICS = [
  "MIX",
  "CURRENT_COST",
  "TARGET_COST",
  "VARIANCE",
] as const;

export type CostAnalysisMetric = (typeof COST_ANALYSIS_METRICS)[number];

export type CostAnalysisPatternType = "WEIGHTED" | "NORMAL";

export const COST_ANALYSIS_EXPORT_TASK_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
] as const;

export type CostAnalysisExportTaskStatus =
  (typeof COST_ANALYSIS_EXPORT_TASK_STATUSES)[number];

export interface CostAnalysisCategoryNode {
  id: string;
  parentId: string | null;
  level: CostAnalysisCategoryLevel;
  code: string;
  name: string;
  path: string;
  sortNo: number;
  partAttribute?: "上装件" | "平台件" | null;
  engineers?: string[];
  coveredParts?: string[];
  dimensionType?: CostAnalysisDimensionType;
  /** 虚拟聚合节点对应的原始成本分类节点 ID，不改变基础分类数据。 */
  sourceIds?: string[];
  parentName?: string;
  parentPath?: string;
  rootNames?: string[];
  sourcePaths?: { id: string; path: string[]; rootName: string }[];
  children?: CostAnalysisCategoryNode[];
}

export interface CostAnalysisPatternOption {
  patternId: number;
  patternCode: string;
  patternName: string;
  patternType: CostAnalysisPatternType;
  sortNo: number;
}

export interface CostAnalysisLatestBom {
  valveId?: number;
  projectId: number;
  bomVersionId: number;
  bomVersionNo: string;
  bomUpdatedAt: string;
  factBatchId?: string;
  patterns: CostAnalysisPatternOption[];
}

export interface CostAnalysisBomScope {
  projectId: number;
  valveIds: number[];
}

export interface CostAnalysisConditionDraft {
  clientId: string;
  projectId: number | null;
  projectName: string;
  valveId: number | null;
  valveName: string;
  bom: CostAnalysisLatestBom | null;
  patternIds: number[];
  loadingBom: boolean;
  bomError: CostAnalysisTraceError | null;
}

export interface CostAnalysisQuery {
  dimensionType?: CostAnalysisDimensionType;
  categoryLevel: CostAnalysisCategoryLevel;
  categoryIds: string[];
  diffMode: boolean;
  conditions: Array<{
    projectId: number;
    valveId: number;
    patternIds: number[];
  }>;
}

export interface CostAnalysisRemarkUpdate {
  categoryId: string;
  columnKey: string;
  remark: string;
}

export interface CostAnalysisPoint {
  pointKey: string;
  projectId: number;
  projectName: string;
  valveId: number;
  valveName: string;
  bomVersionId: number;
  bomVersionNo: string;
  bomUpdatedAt: string;
}

export interface CostAnalysisColumn {
  columnKey: string;
  point: CostAnalysisPoint;
  pattern: CostAnalysisPatternOption;
  sortNo: number;
}

export interface CostAnalysisDiffColumnSelection {
  baselineColumnKey: string;
}

export type CostAnalysisDifferenceDrillLevel =
  | "CATEGORY_1"
  | "CATEGORY_2"
  | "CATEGORY_3"
  | "PART";

/** 构成图当前展示的分类层级；零件明细继续沿用 PART 终端下钻。 */
export type CostAnalysisDifferenceViewLevel = CostAnalysisCategoryLevel;

export type CostAnalysisDifferenceObjectStatus =
  | "ADDED"
  | "REMOVED"
  | "CHANGED";

export type CostAnalysisDifferenceFieldDataType =
  | "TEXT"
  | "NUMBER"
  | "MONEY"
  | "PERCENT";

export type CostAnalysisDifferenceTraceType =
  | "POINT_COMPARISON"
  | "COST_VARIANCE";

export type CostAnalysisPartScope = "TOP10" | "ALL";

interface CostAnalysisDifferenceDetailQueryBase {
  dimensionType?: CostAnalysisDimensionType;
  baselineColumnKey: string;
  comparisonColumnKey: string;
  categoryLevel: CostAnalysisCategoryLevel;
  categoryId: string;
  /** 可选的目标构成层级，缺省时由接口返回当前对象的直接下一级。 */
  viewLevel?: CostAnalysisDifferenceViewLevel;
  metric: CostAnalysisMetric;
  limit?: 10;
  partScope?: CostAnalysisPartScope;
  pageNum?: number;
  pageSize?: number;
}

export interface CostAnalysisPointDifferenceDetailQuery extends CostAnalysisDifferenceDetailQueryBase {
  traceType?: "POINT_COMPARISON";
  baselineColumnKey: string;
  comparisonColumnKey: string;
}

export interface CostAnalysisVarianceDetailQuery extends Omit<
  CostAnalysisDifferenceDetailQueryBase,
  "baselineColumnKey" | "comparisonColumnKey" | "metric"
> {
  traceType: "COST_VARIANCE";
  columnKey: string;
  metric: "VARIANCE";
}

export type CostAnalysisDifferenceDetailQuery =
  | CostAnalysisPointDifferenceDetailQuery
  | CostAnalysisVarianceDetailQuery;

export interface CostAnalysisDifferenceChangedField {
  fieldCode: string;
  fieldName: string;
  fieldGroup: string;
  dataType: CostAnalysisDifferenceFieldDataType;
  baselineValue: string | number | null;
  comparisonValue: string | number | null;
  difference: number | null;
}

export interface CostAnalysisDifferenceDetailRow {
  amountMissing?: boolean;
  unassigned?: boolean;
  objectType: "CATEGORY" | "PART";
  objectId: string;
  objectCode: string;
  objectName: string;
  status: CostAnalysisDifferenceObjectStatus;
  baselineValue: number | null;
  comparisonValue: number | null;
  difference: number | null;
  contributionRate: number | null;
  movementShare: number | null;
  hasChildren: boolean;
  changedFields: CostAnalysisDifferenceChangedField[];
}

export interface CostAnalysisDifferenceVisualizationSummary {
  increaseAmount: number | null;
  decreaseAmount: number | null;
  netDifference: number | null;
  absoluteDifferenceTotal: number | null;
  returnedAbsoluteDifference: number | null;
  otherAbsoluteDifference: number | null;
  reconciled: boolean;
}

export interface CostAnalysisDifferenceDetailResult {
  snapshotId: string;
  drillLevel: CostAnalysisDifferenceDrillLevel;
  /** 当前详情实际返回的分类层级；PART 详情时为空。 */
  viewLevel?: CostAnalysisDifferenceViewLevel;
  /** 当前对象可直接选择的更深分类层级。 */
  availableViewLevels?: CostAnalysisDifferenceViewLevel[];
  context:
    | {
        traceType: "POINT_COMPARISON";
        baseline: CostAnalysisPoint;
        comparison: CostAnalysisPoint;
        baselinePattern: CostAnalysisPatternOption;
        comparisonPattern: CostAnalysisPatternOption;
        dimensionType?: CostAnalysisDimensionType;
        categoryPath: Array<{
          categoryId: string;
          categoryCode: string;
          categoryName: string;
          categoryLevel: CostAnalysisCategoryLevel;
        }>;
        metric: CostAnalysisMetric;
      }
    | {
        traceType: "COST_VARIANCE";
        point: CostAnalysisPoint;
        dimensionType?: CostAnalysisDimensionType;
        pattern: CostAnalysisPatternOption;
        categoryPath: Array<{
          categoryId: string;
          categoryCode: string;
          categoryName: string;
          categoryLevel: CostAnalysisCategoryLevel;
        }>;
        metric: "VARIANCE";
      };
  summary: {
    baselineValue: number | null;
    comparisonValue: number | null;
    difference: number | null;
    overlappingGroups?: boolean;
    scopeNotice?: string;
    missingValueCount?: number;
    allChildDifference: number | null;
    returnedDifference: number | null;
    otherDifference: number | null;
    unreconciledDifference: number | null;
    explanationRate: number | null;
    totalChangedCount: number;
  };
  visualization: CostAnalysisDifferenceVisualizationSummary;
  rows: CostAnalysisDifferenceDetailRow[];
  total?: number;
  queriedAt: string;
}

export type CostAnalysisAiAnalysisQuery = CostAnalysisDifferenceDetailQuery;

export type CostAnalysisAiFindingKind =
  | "CONCENTRATION"
  | "DISTRIBUTION"
  | "OFFSET"
  | "STRUCTURE_CHANGE"
  | "TARGET_DEVIATION"
  | "BUSINESS_ATTRIBUTION"
  | "RELATED_CHANGE"
  | "UNRESOLVED";

export type CostAnalysisAiDirection = "INCREASE" | "DECREASE" | "NEUTRAL";

export interface CostAnalysisAiEvidence {
  objectType: "CATEGORY" | "PART";
  objectId: string;
  objectCode: string;
  objectName: string;
  categoryPath: string[];
  fieldCodes: string[];
}

export interface CostAnalysisAiFinding {
  id: string;
  kind: CostAnalysisAiFindingKind;
  label: string;
  title: string;
  description: string;
  direction: CostAnalysisAiDirection;
  metricValue: number | null;
  contributionRate: number | null;
  evidence: CostAnalysisAiEvidence[];
}

export interface CostAnalysisAiAnalysisResult {
  snapshotId: string;
  context: CostAnalysisDifferenceDetailResult["context"];
  rootDrillLevel: CostAnalysisDifferenceDrillLevel;
  deepestDrillLevel: CostAnalysisDifferenceDrillLevel;
  headline: string;
  findings: CostAnalysisAiFinding[];
  scope: {
    analyzedCategoryCount: number;
    analyzedPartCount: number;
    analyzedFieldChangeCount: number;
  };
  dataQuality: {
    explanationRate: number | null;
    unreconciledDifference: number | null;
    reconciliationWarningCount: number;
    factsReconciled: boolean;
    incompletePartDetailCount: number;
  };
  limitations: string[];
  generatedAt: string;
}

export interface CostAnalysisMatrixRow {
  categoryId: string;
  categoryName: string;
  categoryLevel: CostAnalysisCategoryLevel;
  metric: CostAnalysisMetric;
  values: Record<string, number | string | null>;
  subtotal: boolean;
}

export interface CostAnalysisResult {
  snapshotId: string;
  factHash?: string | null;
  dimensionType?: CostAnalysisDimensionType;
  categoryLevel: CostAnalysisCategoryLevel;
  categories: CostAnalysisCategoryNode[];
  patterns: CostAnalysisPatternOption[];
  points: CostAnalysisPoint[];
  columns: CostAnalysisColumn[];
  rows: CostAnalysisMatrixRow[];
  queriedAt: string;
}

export interface CostAnalysisExportTask {
  taskId: string;
  snapshotId: string;
  status: CostAnalysisExportTaskStatus;
  createdAt: string;
  completedAt?: string;
  fileId?: string;
  fileName?: string;
  error?: CostAnalysisTraceError;
}

export interface CostAnalysisExportFile {
  blob: Blob;
  fileName: string;
}

export interface CostAnalysisTraceError {
  code: string;
  message: string;
  traceId?: string;
}
