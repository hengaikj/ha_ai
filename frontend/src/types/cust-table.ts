import type {
  TableCellStyleSchema,
  TableProviderCatalogItem,
  TableRendererType,
  TableTemplateSchema,
  TableValueType,
} from "@/types/custom-table";

export type CustTableTemplateStatus = "DRAFT" | "PUBLISHED" | "DISABLED";
export type CustTableTaskStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT";
export type CustTableCellValueType =
  | TableValueType
  | "NUMBER"
  | "FORMULA"
  | "EMPTY";

export interface CustTableSchemaCell {
  row: number;
  column: number;
  valueType: CustTableCellValueType;
  bindingType: "STATIC" | "PROVIDER_FIELD" | "FORMULA";
  bindingKey: string | null;
  staticValue: string | null;
  style: TableCellStyleSchema | Record<string, never>;
}

export interface CustTableSchemaSheet {
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
  cells: CustTableSchemaCell[];
}

export interface CustTableSchema {
  schemaVersion: "2.0";
  templateCode: string;
  title: string;
  renderer: TableRendererType;
  sheets: CustTableSchemaSheet[];
  extension: {
    variables: unknown[];
    regions: unknown[];
    validationRules: unknown[];
    conditionalStyles: unknown[];
    runtime: Record<string, unknown>;
  };
  compatibility: {
    templateKind: TableTemplateSchema["templateKind"];
    provider: TableTemplateSchema["provider"];
    query: TableTemplateSchema["query"];
    layout: TableTemplateSchema["layout"];
    columns: TableTemplateSchema["columns"];
    sections: TableTemplateSchema["sections"];
    formulas: TableTemplateSchema["formulas"];
    permissions: TableTemplateSchema["permissions"];
    actions: TableTemplateSchema["actions"];
  };
}

export interface CustTableTemplateCommand {
  requestId: string;
  templateCode: string;
  templateName: string;
  schemaJson: string;
}

export interface CustTableTemplateDraftCommand {
  requestId: string;
  schemaJson: string;
  lockVersion: number;
}

export interface CustTableTemplatePublishCommand {
  requestId: string;
  remark?: string;
}

export interface CustTableTemplateCloneCommand {
  requestId: string;
  templateCode: string;
  templateName: string;
  categoryId?: string | null;
  expectedLockVersion: number;
}

export interface CustTableMutationCommand {
  requestId: string;
  expectedLockVersion: number;
}

export interface CustTableTemplateStatusCommand extends CustTableMutationCommand {
  status: Extract<CustTableTemplateStatus, "PUBLISHED" | "DISABLED">;
}

export interface CustTableTemplateVersion {
  id: string;
  templateId: string;
  versionNo: number;
  schemaVersion: string;
  schemaJson: string;
  schemaHash: string;
  providerVersion: string | null;
  publishedBy: string;
  publishedTime: string;
  remark: string | null;
}

export interface CustTableTemplateDetail {
  id: string;
  templateCode: string;
  templateName: string;
  templateKind: string;
  rendererType: TableRendererType;
  scopeType: string;
  scopeId: string;
  status: CustTableTemplateStatus;
  schemaJson: string;
  schemaHash: string;
  currentVersionId: string | null;
  currentVersionNo: number | null;
  lockVersion: number;
  createTime: string;
  updateTime: string;
  versions: CustTableTemplateVersion[];
}

export interface CustTablePage<T> {
  records: T[];
  total: number;
  pageNo: number;
  pageSize: number;
}

export interface CustTableCategory {
  id: string;
  parentId: string;
  categoryName: string;
  sortOrder: number;
  status: "ACTIVE" | "DISABLED";
  lockVersion: number;
  children?: CustTableCategory[];
}

export interface CustTableCategoryCommand {
  categoryName: string;
  parentId?: string;
  sortOrder?: number;
}

export interface CustTableCategoryUpdateCommand extends CustTableCategoryCommand {
  expectedLockVersion: number;
}

export interface CustTableTemplateQuery {
  pageNo: number;
  pageSize: number;
  keyword?: string;
  status?: CustTableTemplateStatus;
}

export interface CustTableBindingQuery {
  pageNo: number;
  pageSize: number;
  templateId?: string;
  templateVersionId?: string;
  ownerType?: string;
  ownerId?: string;
  bindingCode?: string;
  status?: "ACTIVE" | "DISABLED";
}

export interface CustTableBindingCommand {
  requestId: string;
  templateVersionId: string;
  ownerType: string;
  ownerId: string;
  bindingCode: string;
}

export interface CustTableBinding {
  id: string;
  templateId: string;
  templateVersionId: string;
  ownerType: string;
  ownerId: string;
  bindingCode: string;
  status: "ACTIVE" | "DISABLED";
  lockVersion: number;
  createTime: string;
  updateTime: string;
}

export type CustTablePermissionResourceType =
  | "CATEGORY"
  | "TEMPLATE"
  | "BINDING"
  | "WORKBOOK"
  | "IMPORT_TASK"
  | "EXPORT_TASK";
export type CustTablePermissionSubjectType = "USER" | "ROLE" | "DEPT";
export type CustTablePermissionAction =
  | "VIEW"
  | "EDIT"
  | "CREATE"
  | "DELETE"
  | "PUBLISH"
  | "IMPORT"
  | "EXPORT"
  | "DOWNLOAD";
export type CustTablePermissionEffect = "ALLOW" | "DENY";

export interface CustTablePermissionRuleQuery {
  resourceType?: CustTablePermissionResourceType;
  resourceId?: string;
  subjectType?: CustTablePermissionSubjectType;
  subjectId?: string;
  action?: CustTablePermissionAction;
}

export interface CustTablePermissionRuleCommand {
  requestId: string;
  resourceType: CustTablePermissionResourceType;
  resourceId: string;
  subjectType: CustTablePermissionSubjectType;
  subjectId: string;
  action: CustTablePermissionAction;
  effect: CustTablePermissionEffect;
}

export interface CustTablePermissionRuleUpdateCommand extends CustTablePermissionRuleCommand {
  expectedLockVersion: number;
}

export interface CustTablePermissionRule {
  id: string;
  resourceType: CustTablePermissionResourceType;
  resourceId: string;
  subjectType: CustTablePermissionSubjectType;
  subjectId: string;
  action: CustTablePermissionAction;
  effect: CustTablePermissionEffect;
  lockVersion: number;
  createTime: string;
  updateTime: string;
}

export interface CustTableWorkbookCreateCommand {
  requestId: string;
  templateVersionId: string;
  ownerType: string;
  ownerId: string;
}

export interface CustTableWorkbookCellChange {
  sheetName: string;
  row: number;
  column: number;
  valueType: CustTableCellValueType;
  rawValue: string | null;
}

export interface CustTableWorkbookCell {
  id: string;
  sheetName: string;
  row: number;
  column: number;
  valueType: CustTableCellValueType;
  rawValue: string | null;
  displayValue: string | null;
  styleOverrideJson: string | null;
  permissionSnapshotJson: string | null;
}

export interface CustTableWorkbookPatchCommand {
  requestId: string;
  expectedLockVersion: number;
  cells: CustTableWorkbookCellChange[];
}

export interface CustTableWorkbookDetail {
  id: string;
  templateId: string;
  templateVersionId: string;
  ownerType: string;
  ownerId: string;
  status: string;
  lockVersion: number;
  schema: CustTableSchema;
  cells: CustTableWorkbookCell[];
  createTime: string;
  updateTime: string;
}

export interface CustTableWorkbookRegionQuery {
  sheetName: string;
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
}

export interface CustTableWorkbookRegion {
  workbookId: string;
  sheetName: string;
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
  cells: CustTableWorkbookCell[];
}

export type CustTableProvider = TableProviderCatalogItem;

export interface CustTableImportTaskCommand {
  requestId: string;
  workbookId?: string;
  templateId?: string;
  expectedLockVersion?: number;
}

export interface CustTableExportTaskCommand {
  requestId: string;
  workbookId: string;
}

export interface CustTableTaskQuery {
  pageNo: number;
  pageSize: number;
  workbookId?: string;
  templateId?: string;
  status?: CustTableTaskStatus;
}

export interface CustTableTask {
  id: string;
  taskType: "IMPORT" | "EXPORT";
  workbookId: string | null;
  templateId: string | null;
  fileId: string | null;
  status: CustTableTaskStatus;
  progress: number;
  retryCount: number;
  errorMessage: string | null;
  resultFileId: string | null;
  resultFileName: string | null;
  resultFileSize: number | null;
  createTime: string;
  updateTime: string;
}

export interface CustTableTaskCancelCommand {
  requestId: string;
}

export interface CustTableTaskErrorDetail {
  taskId: string;
  taskType: "IMPORT" | "EXPORT";
  status: CustTableTaskStatus;
  errorMessage: string | null;
  updateTime: string;
}
