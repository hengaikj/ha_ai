export type BackendId = string;
export type TableTemplateKind =
  | "QUERY"
  | "MEETING"
  | "REPORT"
  | "REVENUE_DYNAMIC";
export type TableRendererType = "GRID" | "SHEET";
export type TableScopeType = "GLOBAL" | "ORGANIZATION" | "PROJECT";
export type TableTemplateStatus = "DRAFT" | "PUBLISHED" | "DISABLED";
export type TableDataShape =
  | "LIST"
  | "PAGE"
  | "TREE"
  | "MATRIX"
  | "SECTIONS"
  | "TIME_SERIES";
export type TableValueType =
  | "TEXT"
  | "INTEGER"
  | "DECIMAL"
  | "PERCENT"
  | "DATE"
  | "DATETIME"
  | "BOOLEAN"
  | "JSON"
  | "GROUP";

export interface TableColumnSchema {
  key: string;
  label: string;
  valueType: TableValueType;
  required: boolean;
  editable: boolean;
  commandCode?: string | null;
  children: TableColumnSchema[];
}
export type TableCellBindingType = "STATIC" | "PROVIDER_FIELD" | "FORMULA";
export interface TableCellStyleSchema {
  fillColor?: string | null;
  fontColor?: string | null;
  bold: boolean;
  italic: boolean;
  fontSize?: number | null;
  horizontalAlignment?: string | null;
  verticalAlignment?: string | null;
  wrapText: boolean;
  dataFormat?: string | null;
}
export interface TableCellSchema {
  row: number;
  column: number;
  valueType: TableValueType;
  staticValue?: string | null;
  binding: { type: TableCellBindingType; key?: string | null };
  style?: TableCellStyleSchema | null;
}
export interface TableSheetSchema {
  name: string;
  rowCount: number;
  columnCount: number;
  frozenRows: number;
  frozenColumns: number;
  mergeRegions: Array<{
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  }>;
  rowHeights: Array<{ index: number; size: number }>;
  columnWidths: Array<{ index: number; size: number }>;
  hiddenRows: number[];
  hiddenColumns: number[];
  cells: TableCellSchema[];
}

export interface TableTemplateExtensions {
  designWorkbench?: TableDesignWorkbenchExtension | null;
}
export interface TableDesignWorkbenchExtension {
  version: "1.0";
  variables: TableDesignVariable[];
  regions: TableDesignRegion[];
  validationRules: TableDesignValidationRule[];
  conditionalStyles: TableDesignConditionalStyle[];
}
export interface TableDesignVariable {
  key: string;
  valueType: TableValueType;
  defaultValue?: string | null;
}
export interface TableDesignRegion {
  key: string;
  sheetName: string;
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  mode: "STATIC" | "REPEATING_ROWS" | "REPEATING_COLUMNS";
  providerFieldKey?: string | null;
}
export interface TableDesignValidationRule {
  key: string;
  sheetName: string;
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  operator: "REQUIRED" | "NUMBER_RANGE" | "TEXT_LENGTH" | "ENUM" | "DATE_RANGE";
  operand?: string | null;
  message: string;
}
export interface TableDesignConditionalStyle {
  key: string;
  sheetName: string;
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  operator:
    | "EQUALS"
    | "NOT_EQUALS"
    | "GREATER_THAN"
    | "GREATER_OR_EQUAL"
    | "LESS_THAN"
    | "LESS_OR_EQUAL"
    | "CONTAINS"
    | "IS_EMPTY"
    | "IS_NOT_EMPTY";
  operand?: string | null;
  style: TableCellStyleSchema;
}

export interface TableTemplateSchema {
  schemaVersion: "1.0";
  templateCode: string;
  templateKind: TableTemplateKind;
  renderer: TableRendererType;
  title: string;
  provider: {
    ownerModule: string;
    providerCode: string;
    dataShape: TableDataShape;
  };
  query: { parameterKeys: string[]; defaultSortField?: string | null };
  layout: {
    rowCount?: number | null;
    columnCount?: number | null;
    frozenRows: number;
    frozenColumns: number;
    mergeRegions: Array<{
      startRow: number;
      endRow: number;
      startColumn: number;
      endColumn: number;
    }>;
  };
  columns: TableColumnSchema[];
  sections: Array<{ key: string; title: string; columns: TableColumnSchema[] }>;
  formulas: Array<{
    key: string;
    expression: string;
    scale?: number | null;
    roundingMode?: string | null;
  }>;
  permissions: Array<{
    permissionCode: string;
    targetKey: string;
    visible: boolean;
    editable: boolean;
  }>;
  actions: Array<{ code: string; label: string; commandCode: string }>;
  sheets: TableSheetSchema[];
  extensions?: TableTemplateExtensions | null;
}

export interface TableTemplateValidationResult {
  valid: boolean;
  errorCode?: string | null;
  fieldPath?: string | null;
  message: string;
  schemaHash?: string | null;
}
export interface TableExcelImportResult {
  schema: TableTemplateSchema;
  schemaJson: string;
  warnings: string[];
  sheetCount: number;
  cellCount: number;
  fileSha256: string;
}

export interface TableTemplateSummary {
  id: BackendId;
  categoryId?: BackendId | null;
  templateCode: string;
  templateName: string;
  templateKind: TableTemplateKind;
  rendererType: TableRendererType;
  scopeType: TableScopeType;
  scopeId: BackendId;
  status: TableTemplateStatus;
  currentVersionId?: BackendId | null;
  currentVersionNo?: number | null;
  draftSchemaHash: string;
  lockVersion: number;
  updateBy: string;
  updateTime: string;
}
export interface TableTemplateCategory {
  id: BackendId;
  parentId: BackendId;
  categoryName: string;
  categoryPath: string;
  categoryLevel: number;
  templateCount: number;
  sortOrder: number;
  status: "ACTIVE" | "DISABLED";
  lockVersion: number;
  remark?: string | null;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string;
  children: TableTemplateCategory[];
}
export interface TableTemplateCategoryCommand {
  parentId: BackendId;
  categoryName: string;
  sortOrder: number;
  remark?: string;
  expectedLockVersion?: number;
}
export interface TableTemplateDetail extends TableTemplateSummary {
  schemaVersion: string;
  draftSchema: TableTemplateSchema;
  draftSourceVersionId?: BackendId | null;
  createBy: string;
  createTime: string;
  remark?: string | null;
}
export interface TableTemplateVersion {
  id: BackendId;
  templateId: BackendId;
  versionNo: number;
  schemaVersion: string;
  schema: TableTemplateSchema;
  schemaHash: string;
  formulaVersion: string;
  status: string;
  sourceVersionId?: BackendId | null;
  publishedBy: string;
  publishedTime: string;
  remark?: string | null;
}
export interface TableProviderDescriptor {
  ownerModule: string;
  providerCode: string;
  displayName: string;
  dataShape: TableDataShape;
  parameters: Array<{
    key: string;
    valueType: TableValueType;
    required: boolean;
  }>;
  fields: Array<{
    key: string;
    label: string;
    valueType: TableValueType;
    sensitive: boolean;
  }>;
  sortableFields: string[];
  commandCodes: string[];
  providerVersion: string;
  timeoutMillis: number;
  maxRows: number;
  auditTag: string;
}
export interface TableProviderCatalogItem {
  id: BackendId;
  ownerModule: string;
  providerCode: string;
  displayName: string;
  dataShape: TableDataShape;
  descriptor: TableProviderDescriptor;
  descriptorHash: string;
  sampleDataJson?: string | null;
  status: string;
  lastSyncTime: string;
  lockVersion: number;
  remark?: string | null;
}
export interface TableProviderManagementCommand {
  displayName: string;
  status: "ACTIVE" | "DISABLED";
  sampleDataJson?: string | null;
  remark?: string | null;
  expectedLockVersion: number;
}
export interface TableProviderSamplePreview {
  descriptor: TableProviderDescriptor;
  rows: Record<string, unknown>[];
}
export interface TableTemplateQuery {
  pageNum: number;
  pageSize: number;
  templateCode?: string;
  templateName?: string;
  templateKind?: TableTemplateKind;
  rendererType?: TableRendererType;
  scopeType?: TableScopeType;
  scopeId?: BackendId;
  status?: TableTemplateStatus;
  categoryId?: BackendId;
}
export interface PageResult<T> {
  records: T[];
  total: number;
  pageNo: number;
  pageSize: number;
}
export interface CreateTemplateCommand {
  requestId: string;
  categoryId?: BackendId;
  schemaJson: string;
  scopeType: TableScopeType;
  scopeId: BackendId;
  remark?: string;
}
export interface CloneTemplateCommand {
  requestId: string;
  templateCode: string;
  templateName: string;
  categoryId?: BackendId;
  scopeType: TableScopeType;
  scopeId: BackendId;
  remark?: string;
}
export interface SaveDraftCommand {
  schemaJson: string;
  expectedLockVersion: number;
  remark?: string;
}
export interface PublishTemplateCommand {
  requestId: string;
  expectedLockVersion: number;
  remark?: string;
}
export interface BindTemplateCommand {
  requestId: string;
  businessCode: string;
  scopeType: TableScopeType;
  scopeId: BackendId;
  templateVersionId: BackendId;
  remark?: string;
}
export interface TableTemplateBinding {
  id: BackendId;
  businessCode: string;
  scopeType: TableScopeType;
  scopeId: BackendId;
  templateId: BackendId;
  templateVersionId: BackendId;
  ownerModule: string;
  providerCode: string;
  schemaHash: string;
  activeFlag: string;
  lockVersion: number;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string;
  remark?: string;
}

export type TableWorkbookStatus = "DRAFT" | "SUBMITTED" | "ARCHIVED";
export interface TableWorkbookCell {
  id?: BackendId;
  sheetName: string;
  rowIndex: number;
  columnIndex: number;
  valueType: TableValueType;
  cellValue?: string | null;
  displayValue?: string | null;
  viewAllowed?: boolean;
  editAllowed?: boolean;
  denyReason?: string | null;
}
export type TableWorkbookPermissionPrincipalType =
  | "ALL"
  | "USER"
  | "ROLE"
  | "DEPT"
  | "PROJECT";
export type TableWorkbookPermissionScope =
  | "WORKBOOK"
  | "SHEET"
  | "ROW"
  | "COLUMN"
  | "CELL";
export type TableWorkbookPermissionAction = "VIEW" | "EDIT";
export type TableWorkbookPermissionEffect = "ALLOW" | "DENY";
export interface TableWorkbookPermissionRule {
  id?: BackendId;
  sheetName?: string | null;
  principalType: TableWorkbookPermissionPrincipalType;
  principalCode?: string | null;
  scope: TableWorkbookPermissionScope;
  rowIndex?: number | null;
  columnIndex?: number | null;
  action: TableWorkbookPermissionAction;
  effect: TableWorkbookPermissionEffect;
}
export interface SaveWorkbookPermissionCommand {
  rules: TableWorkbookPermissionRule[];
}
export interface TableWorkbookCellRange {
  instanceId: BackendId;
  sheetName: string;
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
  cells: TableWorkbookCell[];
}
export interface TableWorkbook {
  id: BackendId;
  instanceCode: string;
  businessCode: string;
  businessKey: string;
  instanceTitle: string;
  scopeType: TableScopeType;
  scopeId: BackendId;
  templateId: BackendId;
  templateVersionId: BackendId;
  templateVersionNo: number;
  schemaHash: string;
  status: TableWorkbookStatus;
  schema: TableTemplateSchema;
  cells: TableWorkbookCell[];
  lockVersion: number;
  createBy: string;
  createTime: string;
  updateBy: string;
  updateTime: string;
  remark?: string | null;
}
export interface CreateWorkbookCommand {
  requestId: string;
  businessCode: string;
  businessKey: string;
  instanceTitle: string;
  scopeType: TableScopeType;
  scopeId: BackendId;
  templateVersionId: BackendId;
  remark?: string;
}
export interface SaveWorkbookCommand {
  expectedLockVersion: number;
  cells: TableWorkbookCell[];
  remark?: string;
}

export type TableImportTaskStatus =
  | "CREATED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "REJECTED"
  | "CANCELLED"
  | "TIMEOUT";
export interface TableImportTask {
  id: BackendId;
  taskNo: string;
  instanceId: BackendId;
  taskStatus: TableImportTaskStatus;
  progressPercent: number;
  processedCells: number;
  attemptCount: number;
  maxAttempts: number;
  validationReportJson?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  createTime: string;
  startTime?: string | null;
  finishTime?: string | null;
}
export type TableExportTaskStatus = TableImportTaskStatus;
export interface TableExportTask {
  id: BackendId;
  taskNo: string;
  providerCode: string;
  templateVersionId: BackendId;
  taskStatus: TableExportTaskStatus;
  progressPercent: number;
  totalRows: number;
  processedRows: number;
  resultFileName?: string | null;
  resultFileSize?: number | null;
  failureMessage?: string | null;
  createTime: string;
  startTime?: string | null;
  finishTime?: string | null;
}
export interface CreateTableExportCommand {
  requestId: string;
  providerCode: string;
  templateVersionId: BackendId;
  schemaHash: string;
  parameters: Record<string, unknown>;
  sortField?: string;
  sortDirection?: "ASC" | "DESC";
}
export interface TableExportDownload {
  blob: Blob;
  fileName: string;
}

export const EMPTY_TABLE_SCHEMA: TableTemplateSchema = {
  schemaVersion: "1.0",
  templateCode: "",
  templateKind: "QUERY",
  renderer: "GRID",
  title: "",
  provider: { ownerModule: "", providerCode: "", dataShape: "LIST" },
  query: { parameterKeys: [], defaultSortField: null },
  layout: {
    rowCount: null,
    columnCount: null,
    frozenRows: 0,
    frozenColumns: 0,
    mergeRegions: [],
  },
  columns: [],
  sections: [],
  formulas: [],
  permissions: [],
  actions: [],
  sheets: [],
};
