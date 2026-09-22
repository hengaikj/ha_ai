import {
  ApiBusinessError,
  httpClient,
  parseBlobDownloadResponse,
  request,
  type BlobDownloadResponse,
} from "@/api/http";
import type {
  CustTableExportTaskCommand,
  CustTableImportTaskCommand,
  CustTableTaskCancelCommand,
  CustTableTaskErrorDetail,
  CustTablePage,
  CustTableProvider,
  CustTableTask,
  CustTableTemplateCommand,
  CustTableTemplateCloneCommand,
  CustTableTemplateDetail,
  CustTableTemplateDraftCommand,
  CustTableTemplatePublishCommand,
  CustTableTemplateStatusCommand,
  CustTableMutationCommand,
  CustTableTemplateQuery,
  CustTableTemplateVersion,
  CustTableWorkbookCreateCommand,
  CustTableWorkbookDetail,
  CustTableWorkbookPatchCommand,
  CustTableBinding,
  CustTableBindingCommand,
  CustTableBindingQuery,
  CustTableCategory,
  CustTableCategoryCommand,
  CustTableCategoryUpdateCommand,
  CustTablePermissionRule,
  CustTablePermissionRuleCommand,
  CustTablePermissionRuleQuery,
  CustTablePermissionRuleUpdateCommand,
  CustTableTaskQuery,
  CustTableWorkbookRegion,
  CustTableWorkbookRegionQuery,
} from "@/types/cust-table";

const ID_KEYS = new Set([
  "id",
  "scopeId",
  "categoryId",
  "templateId",
  "templateVersionId",
  "versionId",
  "currentVersionId",
  "draftSourceVersionId",
  "sourceVersionId",
  "parentId",
  "ownerId",
  "instanceId",
  "workbookId",
  "sheetId",
  "bindingId",
  "taskId",
  "resultFileId",
  "requesterUserId",
  "resourceId",
  "subjectId",
  "userId",
  "roleId",
  "deptId",
  "projectId",
]);

export function stringifyBackendIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stringifyBackendIds) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      ID_KEYS.has(key) && item != null
        ? stringifyBackendId(key, item)
        : stringifyBackendIds(item),
    ]),
  ) as T;
}

function stringifyBackendId(key: string, value: unknown): string {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new ApiBusinessError({
      code: "FRONTEND-UNSAFE-BACKEND-ID-001",
      message: `后端 ID ${key} 超出 JavaScript 安全整数范围，必须以字符串返回`,
    });
  }
  return String(value);
}

function withStringIds<T>(value: T): T {
  return stringifyBackendIds(value);
}

export async function listCustTableTemplates(
  params: CustTableTemplateQuery,
): Promise<CustTablePage<CustTableTemplateDetail>> {
  return withStringIds(
    await request<CustTablePage<CustTableTemplateDetail>>({
      url: "/base/cust-table/templates",
      method: "get",
      params,
    }),
  );
}

export async function getCustTableTemplate(
  templateId: string,
): Promise<CustTableTemplateDetail> {
  return withStringIds(
    await request<CustTableTemplateDetail>({
      url: `/base/cust-table/templates/${templateId}`,
      method: "get",
    }),
  );
}

export async function createCustTableTemplate(
  data: CustTableTemplateCommand,
): Promise<CustTableTemplateDetail> {
  return withStringIds(
    await request<CustTableTemplateDetail>({
      url: "/base/cust-table/templates",
      method: "post",
      data,
    }),
  );
}

export async function saveCustTableTemplateDraft(
  templateId: string,
  data: CustTableTemplateDraftCommand,
): Promise<CustTableTemplateDetail> {
  return withStringIds(
    await request<CustTableTemplateDetail>({
      url: `/base/cust-table/templates/${templateId}/draft`,
      method: "put",
      data,
    }),
  );
}

export async function publishCustTableTemplate(
  templateId: string,
  data: CustTableTemplatePublishCommand,
): Promise<CustTableTemplateVersion> {
  return withStringIds(
    await request<CustTableTemplateVersion>({
      url: `/base/cust-table/templates/${templateId}/versions`,
      method: "post",
      data,
    }),
  );
}

export async function cloneCustTableTemplate(
  templateId: string,
  data: CustTableTemplateCloneCommand,
): Promise<CustTableTemplateDetail> {
  return withStringIds(
    await request<CustTableTemplateDetail>({
      url: `/base/cust-table/templates/${templateId}/clone`,
      method: "post",
      data,
    }),
  );
}

export async function restoreCustTableTemplateVersion(
  templateId: string,
  versionId: string,
  data: CustTableMutationCommand,
): Promise<CustTableTemplateDetail> {
  return withStringIds(
    await request<CustTableTemplateDetail>({
      url: `/base/cust-table/templates/${templateId}/versions/${versionId}/restore`,
      method: "post",
      data,
    }),
  );
}

export async function changeCustTableTemplateStatus(
  templateId: string,
  data: CustTableTemplateStatusCommand,
): Promise<CustTableTemplateDetail> {
  return withStringIds(
    await request<CustTableTemplateDetail>({
      url: `/base/cust-table/templates/${templateId}/status`,
      method: "put",
      data,
    }),
  );
}

export function deleteCustTableTemplate(
  templateId: string,
  data: CustTableMutationCommand,
) {
  return request<void>({
    url: `/base/cust-table/templates/${templateId}`,
    method: "delete",
    data,
  });
}

export async function createCustTableWorkbook(
  data: CustTableWorkbookCreateCommand,
): Promise<CustTableWorkbookDetail> {
  return withStringIds(
    await request<CustTableWorkbookDetail>({
      url: "/base/cust-table/workbooks",
      method: "post",
      data,
    }),
  );
}

export async function listCustTableCategories(
  keyword?: string,
): Promise<CustTableCategory[]> {
  return withStringIds(
    await request<CustTableCategory[]>({
      url: "/base/cust-table/categories",
      method: "get",
      params: { keyword: keyword?.trim() || undefined },
    }),
  );
}

export async function createCustTableCategory(
  data: CustTableCategoryCommand,
): Promise<CustTableCategory> {
  return withStringIds(
    await request<CustTableCategory>({
      url: "/base/cust-table/categories",
      method: "post",
      data,
    }),
  );
}

export async function updateCustTableCategory(
  categoryId: string,
  data: CustTableCategoryUpdateCommand,
): Promise<CustTableCategory> {
  return withStringIds(
    await request<CustTableCategory>({
      url: `/base/cust-table/categories/${categoryId}`,
      method: "put",
      data,
    }),
  );
}

export function deleteCustTableCategory(
  categoryId: string,
  expectedLockVersion: number,
) {
  return request<void>({
    url: `/base/cust-table/categories/${categoryId}`,
    method: "delete",
    params: { expectedLockVersion },
  });
}

export async function listCustTableBindings(
  params: CustTableBindingQuery,
): Promise<CustTablePage<CustTableBinding>> {
  return withStringIds(
    await request<CustTablePage<CustTableBinding>>({
      url: "/base/cust-table/bindings",
      method: "get",
      params,
    }),
  );
}

export async function createCustTableBinding(
  data: CustTableBindingCommand,
): Promise<CustTableBinding> {
  return withStringIds(
    await request<CustTableBinding>({
      url: "/base/cust-table/bindings",
      method: "post",
      data,
    }),
  );
}

export async function updateCustTableBinding(
  bindingId: string,
  data: CustTableBindingCommand & { expectedLockVersion: number },
): Promise<CustTableBinding> {
  return withStringIds(
    await request<CustTableBinding>({
      url: `/base/cust-table/bindings/${bindingId}`,
      method: "put",
      data,
    }),
  );
}

export async function resolveCustTableBinding(params: {
  ownerType: string;
  ownerId: string;
  bindingCode: string;
}): Promise<CustTableBinding> {
  return withStringIds(
    await request<CustTableBinding>({
      url: "/base/cust-table/bindings/resolve",
      method: "get",
      params,
    }),
  );
}

export function deleteCustTableBinding(
  bindingId: string,
  expectedLockVersion: number,
) {
  return request<void>({
    url: `/base/cust-table/bindings/${bindingId}`,
    method: "delete",
    params: { expectedLockVersion },
  });
}

export async function listCustTablePermissionRules(
  params: CustTablePermissionRuleQuery,
): Promise<CustTablePermissionRule[]> {
  return withStringIds(
    await request<CustTablePermissionRule[]>({
      url: "/base/cust-table/permissions",
      method: "get",
      params,
    }),
  );
}

export async function createCustTablePermissionRule(
  data: CustTablePermissionRuleCommand,
): Promise<CustTablePermissionRule> {
  return withStringIds(
    await request<CustTablePermissionRule>({
      url: "/base/cust-table/permissions",
      method: "post",
      data,
    }),
  );
}

export async function updateCustTablePermissionRule(
  ruleId: string,
  data: CustTablePermissionRuleUpdateCommand,
): Promise<CustTablePermissionRule> {
  return withStringIds(
    await request<CustTablePermissionRule>({
      url: `/base/cust-table/permissions/${ruleId}`,
      method: "put",
      data,
    }),
  );
}

export function deleteCustTablePermissionRule(
  ruleId: string,
  expectedLockVersion: number,
) {
  return request<void>({
    url: `/base/cust-table/permissions/${ruleId}`,
    method: "delete",
    params: { expectedLockVersion },
  });
}

export async function getCustTableWorkbook(
  workbookId: string,
): Promise<CustTableWorkbookDetail> {
  return withStringIds(
    await request<CustTableWorkbookDetail>({
      url: `/base/cust-table/workbooks/${workbookId}`,
      method: "get",
    }),
  );
}

export async function getCustTableWorkbookRegion(
  workbookId: string,
  params: CustTableWorkbookRegionQuery,
): Promise<CustTableWorkbookRegion> {
  return withStringIds(
    await request<CustTableWorkbookRegion>({
      url: `/base/cust-table/workbooks/${workbookId}/region`,
      method: "get",
      params,
    }),
  );
}

export async function saveCustTableWorkbookCells(
  workbookId: string,
  data: CustTableWorkbookPatchCommand,
): Promise<CustTableWorkbookDetail> {
  return withStringIds(
    await request<CustTableWorkbookDetail>({
      url: `/base/cust-table/workbooks/${workbookId}/cells`,
      method: "patch",
      data,
    }),
  );
}

export async function listCustTableProviders(
  ownerModule?: string,
): Promise<CustTableProvider[]> {
  return withStringIds(
    await request<CustTableProvider[]>({
      url: "/base/cust-table/providers",
      method: "get",
      params: ownerModule ? { ownerModule } : {},
    }),
  );
}

export async function createCustTableImportTask(
  metadata: CustTableImportTaskCommand,
  file: File,
): Promise<CustTableTask> {
  const data = new FormData();
  data.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  data.append("file", file);
  return withStringIds(
    await request<CustTableTask>({
      url: "/base/cust-table/import-tasks",
      method: "post",
      data,
      headers: { "Idempotency-Key": metadata.requestId },
    }),
  );
}

export async function listCustTableImportTasks(
  params: CustTableTaskQuery,
): Promise<CustTablePage<CustTableTask>> {
  return withStringIds(
    await request<CustTablePage<CustTableTask>>({
      url: "/base/cust-table/import-tasks",
      method: "get",
      params,
    }),
  );
}

export async function getCustTableImportTask(
  taskId: string,
): Promise<CustTableTask> {
  return withStringIds(
    await request<CustTableTask>({
      url: `/base/cust-table/import-tasks/${taskId}`,
      method: "get",
    }),
  );
}

export async function cancelCustTableImportTask(
  taskId: string,
  data: CustTableTaskCancelCommand,
): Promise<CustTableTask> {
  return withStringIds(
    await request<CustTableTask>({
      url: `/base/cust-table/import-tasks/${taskId}/cancel`,
      method: "post",
      data,
    }),
  );
}

export async function getCustTableImportTaskErrors(
  taskId: string,
): Promise<CustTableTaskErrorDetail> {
  return withStringIds(
    await request<CustTableTaskErrorDetail>({
      url: `/base/cust-table/import-tasks/${taskId}/errors`,
      method: "get",
    }),
  );
}

export async function createCustTableExportTask(
  data: CustTableExportTaskCommand,
): Promise<CustTableTask> {
  return withStringIds(
    await request<CustTableTask>({
      url: "/base/cust-table/export-tasks",
      method: "post",
      data,
    }),
  );
}

export async function listCustTableExportTasks(
  params: CustTableTaskQuery,
): Promise<CustTablePage<CustTableTask>> {
  return withStringIds(
    await request<CustTablePage<CustTableTask>>({
      url: "/base/cust-table/export-tasks",
      method: "get",
      params,
    }),
  );
}

export async function getCustTableExportTask(
  taskId: string,
): Promise<CustTableTask> {
  return withStringIds(
    await request<CustTableTask>({
      url: `/base/cust-table/export-tasks/${taskId}`,
      method: "get",
    }),
  );
}

export async function cancelCustTableExportTask(
  taskId: string,
  data: CustTableTaskCancelCommand,
): Promise<CustTableTask> {
  return withStringIds(
    await request<CustTableTask>({
      url: `/base/cust-table/export-tasks/${taskId}/cancel`,
      method: "post",
      data,
    }),
  );
}

export async function getCustTableExportTaskErrors(
  taskId: string,
): Promise<CustTableTaskErrorDetail> {
  return withStringIds(
    await request<CustTableTaskErrorDetail>({
      url: `/base/cust-table/export-tasks/${taskId}/errors`,
      method: "get",
    }),
  );
}

export async function downloadCustTableExportTask(
  taskId: string,
): Promise<BlobDownloadResponse> {
  const response = await httpClient.request<Blob>({
    url: `/base/cust-table/export-tasks/${taskId}/download`,
    method: "get",
    responseType: "blob",
  });
  return parseBlobDownloadResponse(
    response,
    `cust-table-export-${taskId}.xlsx`,
  );
}
