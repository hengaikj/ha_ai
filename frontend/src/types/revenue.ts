/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
/**
 * 收益模块核心类型定义
 */

/** 工作流阶段码 */
export type FlowStageCode = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";

/** 节点状态 */
export type NodeStatus = "IN_PROGRESS" | "PROCESSING" | "RUNNING" | "FINISHED" | "COMPLETED" | "DONE" | "VOIDED";

/** 审计域 */
export type AuditDomain = "subtable" | "main";

/** 审计访问级别 */
export type AuditAccess = "none" | "view" | "audit";

/** @deprecated 请使用 AuditAccess */
export type AuditAccessLevel = AuditAccess;

/** 审计行范围 */
export type AuditRowScope = "none" | "all" | "responsibleSubjects";

/** 审计访问策略 */
export interface AuditAccessPolicy {
  access: AuditAccess;
  rowScope: AuditRowScope;
  canSubmit: boolean;
  canRecalculate: boolean;
  showScopeSwitch?: boolean;
  canWriteOpinion?: boolean;
  canApproveS5?: boolean;
}

/** 收益维度模式 */
export type RevenueDimensionMode = "year_trim" | "year_only";

/** 收益输入范围 */
export type RevenueInputScope = "all" | "first_year_only" | "year_independent" | "readonly";

/** 收益模块码 */
export type RevenueModuleCode =
  | "sales_volume"
  | "product_competitiveness"
  | "promotion_business"
  | "sales_expense"
  | "variable_manufacturing_cost"
  | "fixed_cost_standard"
  | "material_cost"
  | "period_expense"
  | "rnd_expense"
  | "main_pnl"
  | "valve_summary";

/** 收益值来源 */
export type RevenueValueSource = "input" | "formula" | "linked" | "derived" | "external";

/** 流程行数据 */
export interface FlowRow {
  id: string;
  flowId: string;
  projectId: string;
  projectNo: string;
  projectCode: string;
  projectName: string;
  project: string;
  valve: string;
  valvePoint: string;
  nodeStatus: string;
  stage: string;
  stageCode: string;
  stageLabel: string;
  stageTagType: string;
  meetingDate: string;
  readonly: boolean;
  actions: FlowAction[];
  [key: string]: unknown;
}

/** 流程操作 */
export interface FlowAction {
  key: string;
  label: string;
  primary: boolean;
}

/** 分页查询参数 */
export interface RevenueListParams {
  keyword?: string;
  stage?: string;
  nodeStatus?: string;
  valvePoint?: string | string[];
  pageNum?: number;
  pageSize?: number;
  menuKey?: string;
  [key: string]: unknown;
}

/** 分页查询结果 */
export interface RevenueListResult {
  rows: FlowRow[];
  total: number;
  source: string;
}

/** 流程操作参数 */
export interface RevenueActionParams {
  projectNo?: string;
  projectCode?: string;
  stageCode?: string;
  actionKey?: string;
  permissionKey?: string;
  userId?: string;
  menuKey?: string;
  [key: string]: unknown;
}

/** 操作结果 */
export interface RevenueActionResult {
  ok: boolean;
  message?: string;
  [key: string]: unknown;
}

/** 收益科目 */
export interface RevenueSubject {
  subjectId?: number;
  subjectCode?: string;
  subjectName?: string;
  parentId?: number;
  level?: number;
  children?: RevenueSubject[];
  [key: string]: unknown;
}

/** 上会评审详情 */
export interface MeetingReviewDetail {
  project: MeetingReviewProject;
  currentStep: string;
  dimensions: MeetingReviewDimensions;
  subjects: RevenueSubject[];
  versions: MeetingReviewVersions;
  values: MeetingReviewValues;
  calc: MeetingReviewCalc;
  state: Record<string, unknown>;
  timeline: MeetingReviewTimelineItem[];
  decisionResult: MeetingReviewDecisionResult | null;
  flowReviewHistory?: Record<string, unknown>;
}

export interface MeetingReviewProject {
  projectNo: string;
  projectCode: string;
  projectId: string;
  flowId: string;
  projectName: string;
  gate: string;
  valvePoint: string;
  stage: string;
  nodeStatus: string;
  meetingTime: string;
  freezeTime: string;
  flowCreatedAt: string;
  flowUpdatedAt: string;
}

export interface MeetingReviewDimensions {
  years: string[];
  trims: string[];
  yearFactors: string[];
}

export interface MeetingReviewVersions {
  candidates: unknown[];
  extras: unknown[];
}

export interface MeetingReviewValues {
  extras: Record<string, unknown>;
}

export interface MeetingReviewCalc {
  editableFields: string[];
}

export interface MeetingReviewTimelineItem {
  action: string;
  time: string;
  actor: string;
  note: string;
}

export interface MeetingReviewDecisionResult {
  reviewId?: string;
  reviewDataSubmitId?: string;
  meetingVersion: string;
  reviewConclusion: string;
  decisionAction: string;
  rejected: boolean;
  flowNode: string;
  flowNodeStatus: string;
  completedAt?: string;
}

/** 权限相关 */
export interface FlowStagePermissions {
  index: string;
  view: string;
  [key: string]: string;
}

export interface RevenueFormulaPermissions {
  create: string;
  update: string;
  status: string;
  delete: string;
}

export interface RevenueTemplatePermissions {
  create: string;
  update: string;
  status: string;
}

/** 收益模板列表行（对接 period-expense-templates 后的前端展示结构） */
export interface RevenueTemplateItem {
  id: string;
  templateNo?: string;
  templateCode?: string;
  templateName?: string;
  subjectCategory?: string;
  subjectCount?: number;
  version?: number | string;
  status?: string;
  templateStatus?: string;
  updateTime?: string;
  operatorName?: string;
  subjectIds?: string[];
  description?: string;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

// ============================================================
// 子表填报页状态类型（用于 composable 替代 mixin）
// ============================================================

/** 科目树节点 */
export interface SubjectTreeNode {
  subjectId?: number | string;
  subjectCode?: string;
  subjectName?: string;
  name?: string;
  id?: number | string;
  leaf?: boolean;
  children?: SubjectTreeNode[];
  sortOrder?: number;
  entryMode?: string;
  templateEntryMode?: string;
  unit?: string;
  readonly?: boolean;
  editable?: boolean;
  readonlyReason?: string;
  formulaId?: string;
  formulaCode?: string;
  formulaExpression?: string;
  formulaParamBindings?: unknown[];
  moduleCode?: string;
  [key: string]: unknown;
}

/** 矩阵列定义 */
export interface MatrixColumn {
  key: string;
  label: string;
  yearLabel: string;
  yearIndex: number;
  trimId: string;
  trimName: string;
  trimIndex: number;
  real: boolean;
  displayOnly: boolean;
  aggregateMode: string;
  cellKey?: string;
  yearOnly?: boolean;
  yearAggregateMode?: string;
  [key: string]: unknown;
}

/** 矩阵行数据 */
export interface MatrixRow {
  id?: string | number;
  rowId?: string | number;
  subjectId?: string | number;
  subject?: string;
  subjectName?: string;
  subtable?: string;
  unit?: string;
  moduleCode?: string;
  moduleName?: string;
  rootSubjectId?: string | number;
  rootSubjectName?: string;
  rootSortOrder?: number;
  displayRootSubjectId?: string;
  displayRootSortOrder?: number;
  fullNamePath?: string | string[];
  fullPath?: string | string[];
  subjectPath?: string[];
  subjectTreePath?: string[];
  path?: string;
  inputScope?: RevenueInputScope;
  inputType?: string;
  entryMode?: string;
  templateEntryMode?: string;
  readonly?: boolean;
  calculated?: boolean;
  editable?: boolean;
  readonlyReason?: string;
  rowKind?: string;
  formulaKey?: string;
  formulaId?: string;
  formulaCode?: string;
  formulaExpression?: string;
  formulaParamBindings?: unknown[];
  cells?: Record<string, unknown>;
  cellMap?: Record<string, unknown>;
  cellsByDimension?: Record<string, unknown>;
  dimensionCells?: Record<string, unknown>;
  cellRecordMap?: Record<string, unknown>;
  recordMap?: Record<string, unknown>;
  cellTargetMap?: Record<string, unknown>;
  targetMap?: Record<string, unknown>;
  formulaLockedCellMap?: Record<string, unknown>;
  reviewLockedCellMap?: Record<string, unknown>;
  lockedCellMap?: Record<string, unknown>;
  s3CandidateMap?: Record<string, unknown>;
  fillOpinionMap?: Record<string, unknown>;
  s3OpinionMap?: Record<string, unknown>;
  owner?: string;
  [key: string]: unknown;
}

/** 科目元数据 */
export interface SubjectLeafMeta {
  subjectId: string;
  subjectCode: string;
  unit: string;
  path: string[];
  groupName: string;
  subjectDisplay: string;
  rootSubjectId: string;
  rootSubjectName: string;
  rootSortOrder: number;
  displayRootSubjectId: string;
  displayRootSortOrder: number;
  entryMode: string;
  templateEntryMode: string;
  readonly: boolean;
  calculated: boolean;
  editable: boolean;
  inputScope: RevenueInputScope;
  inputType: string;
  readonlyReason: string;
  formulaId?: string;
  formulaCode: string;
  formulaExpression: string;
  formulaParamBindings: unknown[];
  /** 权限树叶子上的后端模板，用于空壳行补齐公式元数据 */
  templateItem?: Record<string, unknown>;
}

/** 维度配置 */
export interface RevenueDimensions {
  years: string[];
  trims: string[];
}

/** trim 选项 */
export interface TrimOption {
  trimId: string;
  trimName: string;
  trimIndex: number;
  id?: string | number;
  name?: string;
}

/** 模块加载计划 */
export interface ModuleLoadPlan {
  moduleKey?: string;
  key?: string;
  moduleName?: string;
  rootSubjectName?: string;
  rootSubjectId?: string;
  name?: string;
  subjectIds?: string[];
  moduleCode?: string;
  [key: string]: unknown;
}

/** 模块加载状态 */
export interface ModuleLoadState {
  status: "idle" | "loading" | "loaded" | "error";
  moduleKey?: string;
  moduleName?: string;
  message?: string;
  error?: Error;
  loadedAt?: number;
  [key: string]: unknown;
}

/** 模块区块 */
export interface ModuleSection {
  key?: string;
  moduleKey?: string;
  name?: string;
  moduleName?: string;
  rootSubjectName?: string;
  rootSubjectId?: string;
  subtable?: string;
  rows?: MatrixRow[];
  treeRows?: MatrixRow[];
  sourceRows?: MatrixRow[];
  moduleCode?: string;
  __moduleRootId?: string;
  __moduleRootName?: string;
  __sourceRow?: MatrixRow;
  [key: string]: unknown;
}

/** 数据导入行 */
export interface DataImportRow {
  rowIndex: number;
  group?: string;
  rawGroup?: string;
  item: string;
  values?: Record<string, Record<string, DataImportCellMeta>>;
  full_path?: string | string[];
  fullPath?: string | string[];
  fullNamePath?: string | string[];
  [key: string]: unknown;
}

/** 数据导入单元格元数据 */
export interface DataImportCellMeta {
  address?: string;
  isBlank?: boolean;
  isError?: boolean;
  formula?: boolean;
  textValue?: string;
  numberValue?: number;
  rawValue?: unknown;
  displayValue?: string;
  valueType?: string;
}

/** 数据导入解析结果 */
export interface ParsedImportWorkbook {
  tables: ImportTableSheet[];
}

export interface ImportTableSheet {
  rows: DataImportRow[];
  columns: ImportColumnGroup[];
}

export interface ImportColumnGroup {
  year: string;
  variants: ImportColumnVariant[];
}

export interface ImportColumnVariant {
  key: string;
  name: string;
}

/** S3 候选记录 */
export interface S3Candidate {
  rowId?: string | number;
  cellKey?: string;
  dimensionKey?: string;
  subjectId?: string | number;
  yearLabel?: string;
  trimId?: string;
  trimName?: string;
  originalValue?: string;
  s2Value?: string;
  hasS2Value?: boolean;
  s2Opinion?: string;
  s2Reviewer?: string;
  s2ReviewConclusion?: string;
  decision?: "accept_s2" | "keep_original" | "custom";
  finalValue?: string;
  savedRecordId?: string | number;
  savedRecordStatus?: string;
  savedValue?: string;
  savedAt?: string;
  s3Opinion?: string;
}

/** 单元格记录元数据 */
export interface CellRecordMeta {
  id: string | number;
  recordId?: string | number;
  recordStatus: string;
  ownerId?: string;
  ownerPermission?: string;
  submitIds?: (string | number)[];
  targetSubmitIds?: (string | number)[];
  submitId?: (string | number)[];
  [key: string]: unknown;
}

/** 数据导入匹配状态 */
export interface DataImportRowMatchState {
  groupPath: string[];
  contextPath: string[];
}

/** 数据导入根科目选项 */
export interface DataImportRootSubjectOption {
  id: string;
  rootSubjectId: string;
  rootSubjectName: string;
  label: string;
  leafCount: number;
  sortOrder: number;
}

/** 填报页面查询参数 */
export interface FillPageQuery {
  projectId?: string | number;
  flowId?: string | number;
  projectCode?: string;
  projectName?: string;
  userId?: string;
  userName?: string;
  permissionKey?: string;
  fullAccess?: boolean;
  stage?: string;
  valve?: string;
  [key: string]: unknown;
}

/** 数据导入回填目标 */
export interface DataImportTarget {
  row: MatrixRow;
  column: MatrixColumn;
  value: unknown;
  displayValue: string;
  rowIndex: number;
  address: string;
}

/** 科目路径匹配器 */
export interface SubjectPathMatcher {
  rootPath: string[];
  leafByPath: Map<string, unknown>;
  leafByFullPath: Map<string, unknown>;
  leafByName: Map<string, string[]>;
  parentByPath: Map<string, string[]>;
  parentPathsByName: Map<string, string[][]>;
}

/** 子表填报共享状态（替代多个 mixin 的 this 上下文） */
export interface RevenueFillState {
  // 查询参数
  queryProjectId: string;
  queryFlowId: string;
  queryProjectCode: string;
  queryProjectName: string;
  queryUserId: string;
  queryUserName: string;
  /** S3 本人草稿 ownerId 过滤键（登录名/邮箱） */
  queryOwnerUserId?: string;
  queryPermissionKey: string;
  queryStage: string;
  queryValve: string;
  querySubjectDomain: string;
  querySubjectApiMode: string;
  hasAllPermission: boolean;

  // 项目与流程
  project: Record<string, unknown>;
  detail: Record<string, unknown>;
  activeFlowId: string;
  currentStageCode: string;
  viewMode: string;
  flowPageMode: string;

  // 用户
  currentUser: string;
  currentUserName: string;

  // 权限
  canEditFill: boolean;
  hasS1FlowFillPermission: boolean;
  hasS1FlowSubmitPermission: boolean;
  hasS1FlowCancelSubmitPermission: boolean;
  isS1FlowPermissionEntry: boolean;
  hasWritableSubjects: boolean;
  visibleSubjectMap: Record<string, boolean>;
  writableSubjectMap: Record<string, boolean>;

  // 维度
  dimensions: RevenueDimensions;
  trimOptions: TrimOption[];
  localYearTrimConfig: Record<string, string[]>;
  activeYearKey: string;
  activeYearIndex: number;
  activeRealYearIndex: number;
  activeYearLabel: string;
  activeTrimId: string;
  displayYearOptions: Array<{ key: string; yearIndex: number }>;
  activeColumns: MatrixColumn[];

  // 模块区块
  moduleSections: ModuleSection[];
  filteredRows: MatrixRow[];

  // 模块加载
  moduleLoadPlan: ModuleLoadPlan[];
  moduleSubjectTreePayload: SubjectTreeNode[] | null;
  modulePatternList: unknown[];
  moduleOwnerScoped: boolean;
  moduleLoadStateMap: Record<string, ModuleLoadState>;
  moduleRecordMap: Record<string, unknown>;
  moduleLoadRunId: number;
  moduleBaseQuery: Record<string, unknown>;

  // S2 审核状态
  s2ModuleOpinionMap: Record<string, string>;
  s2ModuleSubmitMap: Record<string, unknown>;
  s2ModuleReviewState: Record<string, unknown>;
  moduleS2Suggestions: unknown[];

  // S1 模块状态
  s1ModuleOpinionMap: Record<string, string>;
  s1ModuleSubmitMap: Record<string, unknown>;
  s1ModuleTimeline: unknown[];
  s1ModuleOpinionDraftMap: Record<string, string>;
  s1ModuleDraftTargetMap: Record<string, unknown>;
  s1ModuleOpinionLockedMap: Record<string, boolean>;
  s1ModuleOpinionReeditMap: Record<string, boolean>;
  s1SubtableSubmittingKey: string;
  s1SubtableActionLoadingKey: string;

  // S3 确认
  isS3ConfirmationStage: boolean;
  activeS3PopoverKey: string;
  s3BulkApplying: boolean;
  showS3BulkActions: boolean;
  s3CellEditor: {
    key: string;
    row: MatrixRow | null;
    column: MatrixColumn | null;
    choice: string;
    customValue: string;
    opinion: string;
  };

  // 单元格编辑
  cellInputDrafts: Record<string, string>;
  cellInputOriginals: Record<string, string>;
  activeFillPopoverKey: string;
  fillCellEditor: {
    key: string;
    row: MatrixRow | null;
    column: MatrixColumn | null;
    value: string;
    opinion: string;
  };

  // 公式
  formulaSourceDetail: Record<string, unknown> | null;
  formulaRecalcTimerId: number | null;
  formulaDebugEnabled: boolean;
  inputScopeDebugEnabled: boolean;

  // 数据导入
  dataImportDialogVisible: boolean;
  dataImportRootSubjectId: string;
  dataImporting: boolean;
  dataImportCompareByCell: Record<string, unknown>;
  dataImportFormulaOverwriteByCell: Record<string, boolean>;
  dataImportOverwriteSavingByCell: Record<string, boolean>;

  // 草案
  ownerSubmitDraftLocked: boolean;

  // 意见
  fillOpinionMaps: unknown;
  flowOpinionItems: unknown[];

  // S1 科目说明
  subjectNoteMap: Record<string, { noteText?: string; [key: string]: any }>;
  subjectNoteSubmitting: boolean;
  subjectNoteEditor: {
    visibleKey: string;
    subjectId: string;
    sectionKey: string;
    title: string;
    noteText: string;
    readonly: boolean;
  };

  // 阶段完成
  stageCompletionSummary: unknown;
  showStageFinalSubmitAction: boolean;

  // 加载
  loading: boolean;
  isAnyModuleLoading: boolean;
  hasModuleLoadErrors: boolean;

  // 科目树
  collapsedSubjectTreeMap: Record<string, boolean>;

  // 年份编辑器
  yearEditorMode: string;
  yearEditorValue: string;
  yearEditorVisible: boolean;

  [key: string]: any;
}
