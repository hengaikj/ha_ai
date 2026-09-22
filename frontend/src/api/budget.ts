import { httpClient, request } from "@/api/http";
import { createIdempotencyKey } from "@/utils/idempotency";
import { resolveServerTotal } from "@/utils/pagination";
import type { BackendId } from "@/types/information";
import type { PlatformFileMetadataResponse } from "@/types/platform-file";
import type { TaskCenterTaskResponse } from "@/types/task-center";
import type {
  BudgetReviewCompareOption,
  BudgetReviewTableRow,
  BudgetReviewTableRuntimeResponse,
  BudgetReviewTemplateDesign,
  BudgetStageResponse,
  BudgetVersionCompareResult,
  BudgetVersionItem,
  BudgetVersionSubmitResponse,
  BudgetVersionValidateResult,
  BudgetWorkbenchAction,
  BudgetWorkbenchAttachmentPageResponse,
  BudgetWorkbenchAttachmentQuery,
  BudgetWorkbenchItem,
  BudgetWorkbenchLockResponse,
  BudgetWorkbenchPageResponse,
  BudgetWorkbenchQuery,
  GateReviewAssessSaveItem,
  GateReviewCompareProject,
  GateReviewWbsItem,
  GateReviewWbsQuery,
  InitiationAssessSaveItem,
  InitiationCompareProject,
  InitiationGradeTreeNode,
  InitiationPatternItem,
  InitiationWbsItem,
  InitiationWbsQuery,
  RevenueFactPageResponse,
  RevenueFactExportTaskResponse,
  RevenueFactQuery,
  RevenueFactRow,
} from "@/types/budget";

type BqPage<T> = { rows?: T[]; total?: number };

type RawInitiationComparePattern = {
  id?: BackendId;
  projectId?: BackendId;
  patternId?: BackendId;
  patternName?: string;
  label?: string;
  name?: string;
  pid?: BackendId;
  pattern?: {
    id?: BackendId;
    patternId?: BackendId;
    patternName?: string;
    name?: string;
  };
};

type RawInitiationCompareProject = {
  id?: BackendId;
  projectId?: BackendId;
  label?: string;
  projectName?: string;
  name?: string;
  vehicleModel?: {
    modelName?: string;
  };
  children?: RawInitiationComparePattern[];
  patternVos?: RawInitiationComparePattern[];
};

function normalizeInitiationCompareProjects(
  rows: RawInitiationCompareProject[],
): InitiationCompareProject[] {
  return rows
    .map((item) => {
      const projectId = item.id ?? item.projectId;
      if (projectId === undefined || projectId === null) return null;

      const patternRows = item.children ?? item.patternVos ?? [];
      return {
        id: Number(projectId),
        label:
          item.label ??
          item.vehicleModel?.modelName ??
          item.projectName ??
          item.name ??
          String(projectId),
        children: patternRows
          .map((patternItem) => {
            const rawChildId = patternItem.id;
            const patternId =
              patternItem.pattern?.id ??
              patternItem.pattern?.patternId ??
              patternItem.patternId ??
              rawChildId;
            if (patternId === undefined || patternId === null) return null;

            const childProjectId = patternItem.projectId ?? patternItem.pid ?? projectId;
            const childId =
              rawChildId !== undefined &&
              rawChildId !== null &&
              String(rawChildId).includes("-")
                ? String(rawChildId)
                : `${childProjectId}-${patternId}`;
            return {
              id: childId,
              label:
                patternItem.label ??
                patternItem.pattern?.patternName ??
                patternItem.patternName ??
                patternItem.pattern?.name ??
                patternItem.name ??
                String(patternId),
              pid: Number(childProjectId),
            };
          })
          .filter(
            (patternItem): patternItem is InitiationCompareProject["children"][number] =>
              Boolean(patternItem),
          ),
      };
    })
    .filter((item): item is InitiationCompareProject => Boolean(item));
}

export interface LiXiangQuery {
  modelName?: string;
  createBy?: string;
  params?: {
    beginTime?: string | null;
    endTime?: string | null;
  };
  pageSize?: number;
  pageNum?: number;
  total?: number;
}

export function lixiangList(query: LiXiangQuery) {
  return request<BqPage<Record<string, unknown>>>({
    url: "/system/project/newList",
    method: "get",
    params: query,
  });
}

export interface VersionListQuery {
  projectId: string | number;
  pageNum?: number;
  pageSize?: number;
}

export function getVersionList(query: VersionListQuery) {
  return request<BqPage<Record<string, unknown>>>({
    url: "/system/project/initiation/historyList",
    method: "get",
    params: query,
  });
}

export interface VersionListGFQuery extends VersionListQuery {
  valveId: string | number;
}

export function getVersionListGF(query: VersionListGFQuery) {
  return request<BqPage<Record<string, unknown>>>({
    url: "/system/project/valve/historyList",
    method: "get",
    params: query,
  });
}

export function exportInitiation(data: {
  projectId: string | number;
  majorVersion?: number | string;
}): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/project/initiation/exportInitiation/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("budget-initiation-export"),
    },
  });
}

export function getCompareList() {
  return request<{ data: Record<string, unknown>[] }>({
    url: "/system/project/compareList",
    method: "get",
  });
}

export interface ProjectReviewCommentsResponse {
  data: BudgetReviewTableRow[];
  version: number;
}

export async function projectReviewNew(
  projectId: string | number,
): Promise<ProjectReviewCommentsResponse> {
  const response = await httpClient.request<{
    code?: number;
    data?: BudgetReviewTableRow[];
    version?: number | string;
  }>({
    url: `/system/project/review/comments/${projectId}`,
    method: "get",
  });
  return {
    data: Array.isArray(response.data.data) ? response.data.data : [],
    version: toNumber(response.data.version),
  };
}

export function getLatestEvaluationDataNew(projectId: string | number) {
  return request<{ code?: number; data: BudgetReviewTableRow[] }>({
    url: "/system/project/initiation/getLatestEvaluationDataNew",
    method: "get",
    params: { projectId },
  });
}

export function reviewcommentsSvae(data: {
  projectId: string | number;
  version: number;
  dataList: BudgetReviewTableRow[];
}) {
  return request<{ code?: number }>({
    url: "/system/project/save/review/comments",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("budget-review-save"),
    },
  });
}

export function projectSor(projectId: string | number) {
  return request<{ code?: number; data: BudgetReviewTableRow[] }>({
    url: `/system/sor/project/${projectId}`,
    method: "get",
  });
}

export function projectPost(data: {
  projectId: string | number;
  projectSorTonghuaList: Array<{
    sorId: unknown;
    isTonghuaPlan?: unknown;
    remark?: unknown;
  }>;
}) {
  return request<{ code?: number }>({
    url: "/system/tonghua",
    method: "post",
    data,
  });
}

export function exportReviewTable(
  projectIds: string,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/project/exportTable/task",
    method: "post",
    params: { projectIds },
    headers: {
      "Idempotency-Key": createIdempotencyKey("budget-review-export"),
    },
  });
}

export function exportSorTable(
  projectIds: string,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/project/export/sor/task",
    method: "post",
    params: { projectIds },
    headers: {
      "Idempotency-Key": createIdempotencyKey("budget-sor-export"),
    },
  });
}

export function importInitiation(data: FormData) {
  return request<TaskCenterTaskResponse>({
    url: "/system/project/initiation/importData/task",
    method: "post",
    data,
    timeout: 60_000,
    headers: {
      "Content-Type": "multipart/form-data",
      "Idempotency-Key": createIdempotencyKey("budget-initiation-import"),
    },
  });
}

export function importProjectValve(data: FormData) {
  return request<TaskCenterTaskResponse>({
    url: "/system/project/valve/importData/task",
    method: "post",
    data,
    timeout: 60_000,
    headers: {
      "Content-Type": "multipart/form-data",
      "Idempotency-Key": createIdempotencyKey("budget-pass-valve-import"),
    },
  });
}

export function previewInitiationFeishu(data: Record<string, unknown>) {
  return request({
    url: "/system/project/initiation/feishu/preview",
    method: "post",
    data,
  });
}

export function confirmInitiationFeishu(
  data: Record<string, unknown>,
  idempotencyKey: string,
) {
  return request({
    url: "/system/project/initiation/feishu/confirm",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": idempotencyKey,
      repeatSubmit: false,
    },
  });
}

export function getInitiationFeishuDocuments(query: Record<string, unknown>) {
  return request({
    url: "/system/project/initiation/feishu/documents",
    method: "get",
    params: query,
  });
}

export function previewValveFeishu(data: Record<string, unknown>) {
  return request({
    url: "/system/project/valve/feishu/preview",
    method: "post",
    data,
  });
}

export function confirmValveFeishu(
  data: Record<string, unknown>,
  idempotencyKey: string,
) {
  return request({
    url: "/system/project/valve/feishu/confirm",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": idempotencyKey,
      repeatSubmit: false,
    },
  });
}

export function getValveFeishuDocuments(query: Record<string, unknown>) {
  return request({
    url: "/system/project/valve/feishu/documents",
    method: "get",
    params: query,
  });
}

export function updateImportLock(data: Record<string, unknown>) {
  return request<void>({
    url: "/system/project/updateImportLock",
    method: "put",
    data,
  });
}

export function updateReviewLock(data: Record<string, unknown>) {
  return request<void>({
    url: "/system/project/updateReviewLock",
    method: "put",
    data,
  });
}

export function exportInitiationGF(
  data: Array<{
    projectId: string | number;
    majorVersion: number | string;
    valveId: string | number;
  }>,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/project/valve/projectPassValve/export/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("budget-pass-valve-export"),
    },
  });
}

type BudgetReviewType = "INITIATION" | "SELF" | "BRAND";
type RuntimeSourceRow =
  | InitiationWbsItem
  | GateReviewWbsItem
  | BudgetReviewTableRow;

const DEFAULT_PAGE_SIZE = 10;

function toArray<T>(value: T[] | { rows?: T[] } | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.rows) ? value.rows : [];
}

function toNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function toText(value: unknown, fallback = ""): string {
  return value === null || value === undefined ? fallback : String(value);
}

function toAmount(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function readField(row: unknown, key: string): unknown {
  return row && typeof row === "object"
    ? (row as Record<string, unknown>)[key]
    : undefined;
}

function isGateReviewRow(row: RuntimeSourceRow): row is GateReviewWbsItem {
  return "valveBudgetInfoVoList" in row;
}

function isInitiationRow(row: RuntimeSourceRow): row is InitiationWbsItem {
  return "initiationBudget" in row;
}

function getProjectName(row: Partial<InitiationWbsItem & GateReviewWbsItem>) {
  return toText(
    row.projectName || row.wbsName || row.wbsNumber || "未命名项目",
  );
}

function resolveVersion(row: { version?: number | string; majorVersion?: number | string | null }) {
  return row.majorVersion ?? row.version ?? 1;
}

function mapWorkbenchRow(
  row: Partial<InitiationWbsItem & GateReviewWbsItem> & Record<string, unknown>,
  pageType: BudgetWorkbenchQuery["pageType"],
): BudgetWorkbenchItem {
  const isGateReview = pageType === "gate-review";
  const version = resolveVersion(row);
  const projectId = (row.projectId ?? row.id ?? "") as BackendId;
  const valveId = (row.valveId ?? row.valveGradeId ?? "") as BackendId;

  return {
    id: (row.id ?? `${projectId}:${valveId || version}`) as BackendId,
    projectId,
    projectCode: toText(row.projectCode ?? row.wbsNumber ?? projectId),
    projectName: getProjectName(row),
    vehicleModel: toText(row.vehicleModel ?? row.modelName, ""),
    valveId: isGateReview ? valveId : null,
    valveProjectId: isGateReview
      ? ((row.valveGradeId ?? null) as BackendId | null)
      : null,
    valvePoint: toText(row.valveName ?? row.valvePoint ?? row.gradeName, ""),
    wbsNumber: toText(row.wbsNumber),
    wbsName: toText(row.wbsName),
    versionId: (row.id ?? version) as BackendId,
    stageCode: isGateReview ? "PASS_VALVE" : "INITIATION",
    versionStatus: "SUBMITTED",
    budgetAmount:
      row.totalBudgetAmount ?? row.totalAmount ?? row.paymentEstimate,
    assessmentAmount: toAmount(
      row.assessTotalAmount ??
        row.assessAmount ??
        row.paymentAmount ??
        row.totalAmount,
    ),
    reportStatus: "SUBMITTED",
    passStatus: isGateReview
      ? toText(row.passStatus ?? row.status ?? "0")
      : null,
    passStatusLabel: isGateReview
      ? toText(row.passStatusLabel ?? "待确认")
      : null,
    passTime: toText(row.passTime, ""),
    budgetLock: String(row.budgetLock ?? row.importLock ?? "0") === "1",
    evaluationLock:
      String(
        row.evaluationLock ??
          row.evaluateLock ??
          row.evaluateLocked ??
          row.reviewLock ??
          "0",
      ) === "1",
    owner: toText(row.submitter ?? row.createBy ?? row.createdBy),
    createdAt: toText(row.createTime),
    updatedAt: toText(row.updateTime),
  };
}

function buildPageResponse(
  page: BqPage<Record<string, unknown>>,
  query: BudgetWorkbenchQuery,
): BudgetWorkbenchPageResponse {
  const pageNo = query.pageNo ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const records = toArray(page).map((row) =>
    mapWorkbenchRow(row, query.pageType),
  );

  return {
    pageNo,
    pageSize,
    total: resolveServerTotal(page.total),
    hasNext: pageNo * pageSize < resolveServerTotal(page.total),
    records,
  };
}

function buildRevenueFactPageResponse(
  page: BqPage<RevenueFactRow>,
  query: RevenueFactQuery,
): RevenueFactPageResponse {
  const pageNo = query.pageNum ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const records = toArray(page);
  const total = resolveServerTotal(page.total);
  return {
    pageNo,
    pageSize,
    total,
    hasNext: pageNo * pageSize < total,
    records,
  };
}

export function queryRevenueFacts(
  query: RevenueFactQuery,
): Promise<RevenueFactPageResponse> {
  return request<BqPage<RevenueFactRow>>({
    url: "/budget/facts/query",
    method: "post",
    data: query,
  }).then((page) => buildRevenueFactPageResponse(page, query));
}

export function createRevenueFactExportTask(
  query: RevenueFactQuery,
): Promise<RevenueFactExportTaskResponse> {
  return request<RevenueFactExportTaskResponse>({
    url: "/budget/facts/export",
    method: "post",
    data: query,
    headers: {
      "Idempotency-Key": createIdempotencyKey("revenue-fact-export"),
    },
  });
}

function buildRuntime(
  projectId: BackendId,
  valveId: BackendId | null,
  reviewType: BudgetReviewType,
  rows: BudgetReviewTableRow[],
): BudgetReviewTableRuntimeResponse {
  return {
    projectId,
    valveId: valveId ?? "",
    reviewType,
    exists: rows.length > 0,
    templateId: null,
    templateVersionId: null,
    templateVersionNo: null,
    templateName: reviewType === "BRAND" ? "品牌方评审意见表" : "预算评审表",
    designJson: buildReviewDesign(reviewType),
    dataJson: rows,
    defaultDataUsed: true,
  };
}

function buildReviewDesign(
  reviewType: BudgetReviewType,
): BudgetReviewTemplateDesign {
  const columns = [
    { key: "wbsNumber", label: "WBS编号", width: 140, fixed: "left" as const },
    { key: "wbsName", label: "WBS名称", minWidth: 180, fixed: "left" as const },
    { key: "gradeName", label: "预算等级", width: 140 },
    { key: "sorName", label: "SOR", width: 120 },
    {
      key: "budgetAmount",
      label: "预算金额A",
      width: 120,
      align: "right" as const,
    },
    {
      key: "assessAmount",
      label: "评估金额B",
      width: 120,
      align: "right" as const,
    },
    {
      key: "reductionAmount",
      label: "核减金额B-A",
      width: 130,
      align: "right" as const,
    },
    {
      key: "reductionRatio",
      label: "核减比例",
      width: 120,
      align: "right" as const,
    },
    { key: "assessRemark", label: "评审意见", minWidth: 180, editable: true },
  ];

  return {
    title: reviewType === "BRAND" ? "评审意见表品牌方" : "评审意见表",
    list: { columns, rowKey: "id" },
  };
}

function mapReviewRow(row: RuntimeSourceRow): BudgetReviewTableRow {
  const raw = row as BudgetReviewTableRow;
  const budgetAmount = isInitiationRow(row)
    ? row.totalBudgetAmount
    : isGateReviewRow(row)
      ? row.paymentEstimate
      : raw.budgetAmount;
  const assessAmount = isInitiationRow(row)
    ? row.assessTotalAmount
    : isGateReviewRow(row)
      ? row.paymentEstimate
      : raw.assessAmount;
  const reductionAmount = toNumber(assessAmount) - toNumber(budgetAmount);

  return {
    ...row,
    rowName: toText(readField(row, "wbsName") ?? raw.rowName),
    wbsNumber: toText(row.wbsNumber),
    wbsName: toText(row.wbsName),
    gradeName: toText(
      readField(row, "gradeName") ??
        readField(readField(row, "grade"), "gradeName"),
    ),
    sorName: toText(row.sorName),
    budgetAmount,
    assessAmount,
    assessmentAmount: assessAmount,
    reductionAmount,
    reductionRatio: row.reductionRatio,
    assessRemark: toText(raw.assessRemark ?? readField(row, "remark")),
  };
}

export function fetchBudgetWorkbenchItems(
  params: BudgetWorkbenchQuery,
): Promise<BudgetWorkbenchPageResponse> {
  const pageNum = params.pageNo ?? 1;
  const commonParams = {
    pageNum,
    pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE,
    projectId: params.projectId,
    valveId: params.valveId,
    wbsName: params.keyword,
    wbsNumber: params.keyword,
    operator: params.createdBy,
    beginTime: params.createdAtStart,
    endTime: params.createdAtEnd,
    isLatestVersion: 1,
    includeDetails: false,
  };

  const url =
    params.pageType === "gate-review"
      ? "/system/project/valve/list"
      : "/system/project/initiation/list";

  return request<BqPage<Record<string, unknown>>>({
    url,
    method: "get",
    params: commonParams,
  }).then((page) => buildPageResponse(page, params));
}

export function fetchBudgetWorkbenchAttachments(
  params: BudgetWorkbenchAttachmentQuery,
): Promise<BudgetWorkbenchAttachmentPageResponse> {
  return request<BqPage<Record<string, unknown>>>({
    url: "/system/attachment/list",
    method: "get",
    params: {
      pageNum: params.pageNo ?? 1,
      pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE,
      fileName: params.keyword,
      beginTime: params.createdAtStart,
      endTime: params.createdAtEnd,
    },
  }).then((page) => {
    const records = toArray(page).map((item) => ({
      itemId: toNumber(item.id),
      fileId: toNumber(item.id),
      projectId: toText(item.bizId),
      projectCode: toText(item.bizId),
      versionId: 0,
      stageCode: toText(item.bizCode).includes("valve")
        ? "PASS_VALVE"
        : "INITIATION",
      stageName: "",
      projectName: toText(item.bizId),
      valvePoint: "",
      originalName: toText(item.fileName),
      normalizedName: toText(item.fileName),
      fileSize: toNumber(item.fileSize),
      status: "ENABLED",
      createdAt: toText(item.createTime),
      businessModule: toText(item.bizCode),
      businessId: toText(item.bizId),
    }));
    const pageNo = params.pageNo ?? 1;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
    return {
      pageNo,
      pageSize,
      total: resolveServerTotal(page.total),
      hasNext: pageNo * pageSize < resolveServerTotal(page.total),
      records,
    };
  });
}

export async function fetchBudgetWorkbenchItem(
  itemId: BackendId,
): Promise<BudgetWorkbenchItem> {
  const data = await request<Record<string, unknown>>({
    url: `/system/project/initiation/${itemId}`,
    method: "get",
  });
  return mapWorkbenchRow(data, "initiation");
}

export function updateBudgetWorkbenchPassStatus(
  itemId: BackendId,
  passStatus: "1" | "2" | "3" | string,
): Promise<BudgetWorkbenchItem> {
  return request<void>({
    url: "/system/project/valve",
    method: "put",
    data: { id: toNumber(itemId), passStatus },
  }).then(() => ({
    ...mapWorkbenchRow({ id: toNumber(itemId), passStatus }, "gate-review"),
    passStatus,
  }));
}

export function fetchBudgetWorkbenchItemActions(
  itemId: BackendId,
): Promise<BudgetWorkbenchAction[]> {
  void itemId;
  return Promise.resolve([
    { action: "detail", available: true },
    { action: "report", available: true },
    { action: "export", available: true },
    { action: "history", available: true },
  ]);
}

export function fetchBudgetWorkbenchItemAttachments(
  businessModule: string,
  businessId: BackendId,
): Promise<PlatformFileMetadataResponse[]> {
  return request<BqPage<Record<string, unknown>>>({
    url: "/system/attachment/list",
    method: "get",
    params: {
      bizCode: businessModule,
      bizId: businessId,
      pageNum: 1,
      pageSize: 200,
    },
  }).then((page) =>
    toArray(page).map((item) => ({
      fileId: toText(item.id),
      originalName: toText(item.fileName),
      normalizedName: toText(item.fileName),
      fileSize: toNumber(item.fileSize),
      contentType: toText(item.fileType),
      extension: toText(item.fileType).toLowerCase(),
      sha256: "",
      storageKey: toText(item.filePath),
      businessModule: toText(item.bizCode, businessModule),
      businessId: toText(item.bizId, String(businessId)),
      permissionScope: "PRIVATE",
      status: "ENABLED",
      virusScanStatus: "SKIPPED",
      createdAt: toText(item.createTime),
    })),
  );
}

export async function createBudgetExport(
  projectId: BackendId,
  payload: {
    versionId: BackendId;
    stageCode: string;
    valveId?: BackendId | null;
    format?: string;
  },
): Promise<TaskCenterTaskResponse> {
  if (payload.stageCode === "PASS_VALVE") {
    return exportGateReviewWbsItems({
      projectId,
      valveId: payload.valveId ?? "",
      ids: String(payload.versionId),
    });
  }
  return exportInitiationWbsItems({
    projectId,
    ids: String(payload.versionId),
  });
}

export function submitBudgetVersion(
  projectId: BackendId,
  versionId: BackendId,
  submitRemark: string,
): Promise<BudgetVersionSubmitResponse> {
  return request<void>({
    url: "/system/project/initiation",
    method: "put",
    data: {
      id: versionId,
      projectId,
      status: "SUBMITTED",
      remark: submitRemark,
    },
  }).then(() => ({
    versionId,
    projectId,
    stageCode: "INITIATION",
    versionNo: toNumber(versionId, 1),
    status: "SUBMITTED",
    submittedAt: new Date().toISOString(),
  }));
}

export async function fetchBudgetVersions(
  projectId: BackendId,
  stageCode?: string,
): Promise<BudgetVersionItem[]> {
  const isGateReview = stageCode === "PASS_VALVE";
  const page = await request<BqPage<Record<string, unknown>>>({
    url: isGateReview
      ? "/system/project/valve/historyList"
      : "/system/project/initiation/historyList",
    method: "get",
    params: { projectId, pageNum: 1, pageSize: 200 },
  });
  const rows = toArray(page);

  return rows.map((row) => ({
    versionId: (row.id ?? row.version ?? row.majorVersion) as BackendId,
    stageCode: isGateReview ? "PASS_VALVE" : "INITIATION",
    versionNo: toNumber(row.majorVersion ?? row.version, 1),
    status: toText(row.status ?? "SUBMITTED"),
    totalAmount: toAmount(
      row.totalBudgetAmount ?? row.totalAmount ?? row.paymentEstimate,
    ),
    submittedAt: toText(row.updateTime ?? row.createTime),
    validateTask: null,
  }));
}

export function fetchBudgetVersionCompare(params: {
  projectId: BackendId;
  baseVersionId: BackendId;
  targetVersionId: BackendId;
  stageCode?: string;
}): Promise<BudgetVersionCompareResult> {
  return Promise.resolve({
    projectId: params.projectId,
    baseVersionId: params.baseVersionId,
    targetVersionId: params.targetVersionId,
    stageCode: params.stageCode,
    summary: {
      totalCount: 0,
      addedCount: 0,
      removedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
    },
    differences: [],
  });
}

export function fetchBudgetVersionValidateResult(
  _projectId: BackendId,
  versionId: BackendId,
): Promise<BudgetVersionValidateResult> {
  return Promise.resolve({
    versionId,
    status: "SUCCESS",
    errorSummary: "",
    finishedAt: new Date().toISOString(),
    errors: [],
    warnings: [],
  });
}

export function createBudgetImportTask(payload: {
  stageCode: string;
  file: File;
  valveId?: BackendId | null;
}): Promise<TaskCenterTaskResponse> {
  const isGateReview = payload.stageCode === "PASS_VALVE";
  const data = new FormData();
  data.append("file", payload.file);
  if (isGateReview && payload.valveId != null) {
    data.append("valveId", String(payload.valveId));
  }
  return request<TaskCenterTaskResponse>({
    url: isGateReview
      ? "/system/project/valve/importData/task"
      : "/system/project/initiation/importData/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey(
        isGateReview ? "budget-pass-valve-import" : "budget-initiation-import",
      ),
    },
  });
}

export function updateBudgetWorkbenchLock(
  itemId: BackendId,
  payload: { budgetLocked: boolean; evaluateLocked?: boolean },
  options?: { stageCode?: BudgetWorkbenchQuery["pageType"]; valveProjectId?: BackendId | null },
): Promise<BudgetWorkbenchLockResponse> {
  if (options?.stageCode === "gate-review" && options.valveProjectId != null) {
    return request<void>({
      url: "/system/valve/project/importLock",
      method: "put",
      data: {
        id: options.valveProjectId,
        projectId: itemId,
        budgetLock: payload.budgetLocked ? "1" : "0",
        evaluateLock: (payload.evaluateLocked ?? payload.budgetLocked) ? "1" : "0",
      },
    }).then(() => ({
      itemId,
      projectId: itemId,
      valveId: options.valveProjectId ?? null,
      budgetLocked: payload.budgetLocked,
      evaluateLocked: payload.evaluateLocked ?? payload.budgetLocked,
    }));
  }

  return request<{ version?: number | string }>({
    url: `/system/project/${itemId}`,
    method: "get",
  })
    .then((project) =>
      request<void>({
        url: "/system/project/updateImportLock",
        method: "put",
        data: {
          id: itemId,
          version: toNumber(project.version),
          importLock: payload.budgetLocked ? "1" : "0",
          reviewLock: (payload.evaluateLocked ?? payload.budgetLocked)
            ? "1"
            : "0",
        },
      }),
    )
    .then(() => ({
      itemId,
      projectId: itemId,
      valveId: null,
      budgetLocked: payload.budgetLocked,
      evaluateLocked: payload.evaluateLocked ?? payload.budgetLocked,
    }));
}

export function fetchBudgetStage(
  row: {
    projectId: BackendId;
    versionId: BackendId;
    valveId?: BackendId | null;
  },
  stageCode: string,
): Promise<BudgetStageResponse> {
  const isGateReview = stageCode === "PASS_VALVE";
  const query = {
    projectId: row.projectId,
    valveId: row.valveId ?? "",
    isLatestVersion: 1,
    pageNum: 1,
    pageSize: 500,
  };

  return request<BqPage<RuntimeSourceRow>>({
    url: isGateReview
      ? "/system/project/valve/list"
      : "/system/project/initiation/list",
    method: "get",
    params: query,
  }).then((page) => ({
    projectId: row.projectId,
    stageCode,
    versionId: row.versionId,
    versionNo: toNumber(row.versionId, 1),
    status: "SUBMITTED",
    rows: toArray(page).map((item) => ({
      rowId: toNumber(item.id),
      wbsNumber: toText(item.wbsNumber),
      wbsName: toText(item.wbsName),
      gradeId: toNumber(item.gradeId),
      sorId: toNumber(readField(item, "sorId")),
      paymentRatio: toText(item.paymentRatio),
      paymentEstimate: toText(item.paymentEstimate),
      reductionDiff: toText(item.reductionDiff),
      reductionRatio: toText(item.reductionRatio),
      totalBudgetAmount: toText(readField(item, "totalBudgetAmount")),
      totalBudgetRemark: toText(readField(item, "remark")),
      amounts: [],
    })),
  }));
}

export function saveBudgetStage(
  _row: {
    projectId: BackendId;
    versionId: BackendId;
    valveId?: BackendId | null;
  },
  _stageCode: string,
  stage: BudgetStageResponse,
): Promise<BudgetStageResponse> {
  const isGateReview = _stageCode === "PASS_VALVE";
  return request<void>({
    url: isGateReview
      ? "/system/project/valve/list"
      : "/system/project/initiation",
    method: "put",
    data: isGateReview
      ? stage.rows
      : { id: _row.versionId, projectId: _row.projectId, rows: stage.rows },
  }).then(() => stage);
}

export function fetchBudgetInitiationReviewTable(
  projectId: BackendId,
): Promise<BudgetReviewTableRow[]> {
  return syncBudgetInitiationReviewTable(projectId);
}

export function fetchBudgetInitiationReviewTableRuntime(
  projectId: BackendId,
): Promise<BudgetReviewTableRuntimeResponse> {
  return syncBudgetInitiationReviewTable(projectId).then((rows) =>
    buildRuntime(projectId, null, "INITIATION", rows),
  );
}

export function saveBudgetInitiationReviewTable(
  projectId: BackendId,
  rows: BudgetReviewTableRow[],
  template?: {
    templateId?: number | string | null;
    templateVersionId?: number | string | null;
    templateVersionNo?: string | null;
    designJson?: BudgetReviewTemplateDesign | null;
  },
): Promise<BudgetReviewTableRow[]> {
  void template;
  return Promise.all(
    rows.map((row) =>
      request<void>({
        url: "/system/initiation/budget",
        method: row.id ? "put" : "post",
        data: { ...row, projectId },
      }),
    ),
  ).then(() => rows);
}

export function syncBudgetInitiationReviewTable(
  projectId: BackendId,
): Promise<BudgetReviewTableRow[]> {
  return fetchInitiationWbsItems({
    projectId,
    pageNum: 1,
    pageSize: 500,
    isLatestVersion: 1,
    includeDetails: false,
  }).then((page) => page.rows.map(mapReviewRow));
}

export function fetchBudgetGateReviewTable(
  projectId: BackendId,
  valveId: BackendId,
  reviewType: "SELF" | "BRAND",
): Promise<BudgetReviewTableRow[]> {
  void reviewType;
  return syncBudgetGateReviewTable(projectId, valveId);
}

export function fetchBudgetGateReviewTableRuntime(
  projectId: BackendId,
  valveId: BackendId,
  reviewType: "SELF" | "BRAND",
  calcType = 0,
): Promise<BudgetReviewTableRuntimeResponse> {
  void calcType;
  return syncBudgetGateReviewTable(projectId, valveId, reviewType).then(
    (rows) => buildRuntime(projectId, valveId, reviewType, rows),
  );
}

export function saveBudgetGateReviewTable(
  projectId: BackendId,
  valveId: BackendId,
  rows: BudgetReviewTableRow[],
  reviewType: "SELF" | "BRAND",
  template?: {
    templateId?: number | string | null;
    templateVersionId?: number | string | null;
    templateVersionNo?: string | null;
    designJson?: BudgetReviewTemplateDesign | null;
  },
): Promise<BudgetReviewTableRow[]> {
  void reviewType;
  void template;
  return Promise.all(
    rows.map((row) =>
      request<void>({
        url: "/system/valve/budget",
        method: row.id ? "put" : "post",
        data: { ...row, projectId, valveId },
      }),
    ),
  ).then(() => rows);
}

export function syncBudgetGateReviewTable(
  projectId: BackendId,
  valveId: BackendId,
  reviewType: "SELF" | "BRAND" = "SELF",
  calcType = 0,
): Promise<BudgetReviewTableRow[]> {
  void reviewType;
  void calcType;
  return fetchGateReviewWbsItems({
    projectId,
    valveId,
    pageNum: 1,
    pageSize: 500,
    isLatestVersion: 1,
    includeDetails: false,
  }).then((page) => page.rows.map(mapReviewRow));
}

export async function fetchBudgetCompareOptions(
  scope: "INITIATION" | "PASS_VALVE",
): Promise<BudgetReviewCompareOption[]> {
  const page = await fetchBudgetWorkbenchItems({
    pageType: scope === "PASS_VALVE" ? "gate-review" : "initiation",
    pageNo: 1,
    pageSize: 200,
  });

  return page.records.map((row) => ({
    id:
      scope === "PASS_VALVE"
        ? `${row.projectId}:${row.valveId}`
        : row.projectId,
    label: row.projectName || row.projectCode,
    projectId: row.projectId,
    valveId: row.valveId,
    raw: row,
  }));
}

export function fetchBudgetCompareReviewTables(
  items: Array<BudgetReviewCompareOption | number | string>,
  reviewType: BudgetReviewType,
): Promise<BudgetReviewTableRow[][]> {
  return Promise.all(
    items.map((item) => {
      const option = typeof item === "object" ? item : undefined;
      const rawItemId = typeof item === "object" ? item.id : item;
      if (reviewType === "INITIATION") {
        return fetchBudgetInitiationReviewTable(option?.projectId ?? rawItemId);
      }

      const [projectId, valveId] = String(rawItemId).includes(":")
        ? String(rawItemId).split(":")
        : [
            String(option?.projectId ?? rawItemId),
            String(option?.valveId ?? ""),
          ];
      return fetchBudgetGateReviewTable(
        option?.projectId ?? projectId,
        option?.valveId ?? valveId,
        reviewType,
      );
    }),
  );
}

export function fetchInitiationWbsItems(
  query: InitiationWbsQuery,
): Promise<{ rows: InitiationWbsItem[]; total: number }> {
  return request<{ rows: InitiationWbsItem[]; total: number }>({
    url: "/system/project/initiation/list",
    method: "get",
    params: { ...query, includeDetails: true },
  });
}

export function fetchInitiationPatterns(
  projectId: BackendId,
): Promise<InitiationPatternItem[]> {
  return request<InitiationPatternItem[]>({
    url: `/system/project/list/patterns/${projectId}`,
    method: "get",
  });
}

export function fetchGateReviewWbsItems(
  query: GateReviewWbsQuery,
): Promise<{ rows: GateReviewWbsItem[]; total: number }> {
  return request<{ rows: GateReviewWbsItem[]; total: number }>({
    url: "/system/project/valve/list",
    method: "get",
    params: query,
  });
}

export function getProjectListGuofa(
  query: Record<string, unknown>,
): Promise<{ rows: GateReviewWbsItem[]; total: number }> {
  return request<{ rows: GateReviewWbsItem[]; total: number }>({
    url: "/system/project/valve/list",
    method: "get",
    params: query,
  });
}

export function getLeftTreeData(params?: {
  includeInvalid?: boolean;
  abolishFlag?: number;
}): Promise<InitiationGradeTreeNode[]> {
  return request<InitiationGradeTreeNode[]>({
    url: "/system/grade/tree",
    method: "get",
    params,
  });
}

export function fetchInitiationGradeTree(params?: {
  includeInvalid?: boolean;
  abolishFlag?: number;
}): Promise<InitiationGradeTreeNode[]> {
  return request<InitiationGradeTreeNode[]>({
    url: "/system/grade/tree",
    method: "get",
    params,
  });
}

export async function exportInitiationWbsItems(data: {
  projectId: BackendId;
  ids: string;
}): Promise<TaskCenterTaskResponse> {
  const exportIds = data.ids
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Number.isFinite);
  return request<TaskCenterTaskResponse>({
    url: "/system/project/initiation/exportInitiation/task",
    method: "post",
    data: { projectId: data.projectId, exportIds },
    headers: {
      "Idempotency-Key": createIdempotencyKey("budget-initiation-export"),
    },
  });
}

export function exportInitiationVersion(data: {
  projectId: BackendId;
  majorVersion: number;
}): Promise<TaskCenterTaskResponse> {
  return exportInitiation(data);
}

export async function exportGateReviewWbsItems(data: {
  projectId: BackendId;
  valveId: BackendId;
  ids: string;
}): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/project/valve/projectPassValve/export/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("budget-pass-valve-export"),
    },
  });
}

export async function exportProjectPassValve(
  data: Array<{
    id?: BackendId;
    projectId: BackendId;
    valveId: BackendId;
    majorVersion?: BackendId;
    isLatestVersion?: string | number;
  }>,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/project/valve/projectPassValve/export/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("budget-pass-valve-export"),
    },
  });
}

export async function fetchAssessCompareList(): Promise<
  InitiationCompareProject[]
> {
  const rows = await request<RawInitiationCompareProject[]>({
    url: "/system/project/compareList",
    method: "get",
  });
  return normalizeInitiationCompareProjects(rows);
}

export function fetchAssessCompareData(data: {
  gradeIds: (number | string)[];
  projectCompareData: { projectId: number; patternIds: number[] }[];
}): Promise<{ rows: Record<string, unknown>[] }> {
  return request<{ rows: Record<string, unknown>[] }>({
    url: "/system/project/initiation/projectCompare",
    method: "post",
    data,
  });
}

export function saveInitiationAssess(
  data: InitiationAssessSaveItem[],
): Promise<void> {
  return request<void>({
    url: "/system/project/initiation/updateProjectEvaluate",
    method: "put",
    data,
  });
}

export function fetchGateReviewCompareList(): Promise<
  GateReviewCompareProject[]
> {
  return request<GateReviewCompareProject[]>({
    url: "/system/project/valve/valveList",
    method: "get",
  });
}

export function fetchGateReviewCompareData(data: {
  projectValveListDTOList: {
    projectId: string;
    valveId: string;
    gradeIdList: (string | number)[];
  }[];
}): Promise<{ data: unknown[] }> {
  return request<{ data: unknown[] }>({
    url: "/system/project/valve/budgetList",
    method: "post",
    data,
  });
}

export function saveGateReviewAssess(
  data: GateReviewAssessSaveItem[],
): Promise<void> {
  return request<void>({
    url: "/system/project/valve/list",
    method: "put",
    data,
  });
}

export function getValveCompareData(
  data: unknown,
): Promise<{ data: unknown[] }> {
  return request<{ data: unknown[] }>({
    url: "/system/project/valve/budgetList",
    method: "post",
    data,
  });
}

export function updateProjectForm(
  data: GateReviewAssessSaveItem[],
): Promise<void> {
  return request<void>({
    url: "/system/project/valve/list",
    method: "put",
    data,
  });
}

export function forModuleIdList(modeStr: string) {
  return request<{ data: Record<string, unknown>[] }>({
    url: "/system/column/forModuleIdList",
    method: "get",
    params: {
      moduleId: modeStr,
    },
  });
}

export interface GuofaQuery {
  projectName?: string;
  createBy?: string;
  valveId?: string;
  beginTime?: string;
  endTime?: string;
  pageSize?: number;
  pageNum?: number;
}

export function guofaList(query: GuofaQuery) {
  const { beginTime, endTime, ...restQuery } = query;
  return request<BqPage<Record<string, unknown>>>({
    url: "/system/valve/project/list",
    method: "get",
    params: {
      ...restQuery,
      "params[beginTime]": beginTime,
      "params[endTime]": endTime,
    },
  });
}

export function getCliqueNameList() {
  return request<BqPage<{ id: number | string; valveName: string }>>({
    url: "/system/valve/list",
    method: "get",
  });
}

export function projectStatusValve(data: {
  id: number | string;
  status?: string;
  isLock?: number;
}) {
  return request<void>({
    url: "/system/valve/project",
    method: "put",
    data,
  });
}

export function updateImportLockValve(data: {
  id: number | string;
  budgetLock?: number;
  evaluateLock?: number;
  importLock?: number;
}) {
  return request<void>({
    url: "/system/valve/project/importLock",
    method: "put",
    data,
  });
}

export function exportGuoFaData(data: {
  projectId: BackendId;
  valveId: BackendId;
}): Promise<TaskCenterTaskResponse> {
  return exportProjectPassValve([{ ...data, isLatestVersion: "1" }]);
}

export function getCompareListClique() {
  return request<{ data: Record<string, unknown>[] }>({
    url: "/system/project/valve/valveList",
    method: "get",
  });
}

export function projectReviewClique(id: string | number) {
  return request<{ code: number; data: Record<string, unknown>[] }>({
    url: `/system/table/data/review/comments/${id}`,
    method: "get",
  });
}

export function getLeftReviewValve(id: string) {
  return request<{ data: Record<string, unknown>[][] }>({
    url: `/system/table/data/review/comments/list/${id}`,
    method: "get",
  });
}

export function projectSorClique(id: string | number, preData = true) {
  return request<{ code: number; data: Record<string, unknown>[] }>({
    url: `/system/table/data/review/brand/comments/${id}/${preData ? 1 : 0}`,
    method: "get",
  });
}

export function getRightReviewValve(id: string) {
  return request<{ data: Record<string, unknown>[][] }>({
    url: `/system/table/data/review/brand/comments/list/${id}`,
    method: "get",
  });
}

export function getLatestEvaluationDataClique(id: string | number) {
  return request<{ code: number; data: Record<string, unknown>[] }>({
    url: `/system/project/valve/self/report/${id}`,
    method: "get",
  });
}

export function reviewcommentsSvaeClique(data: {
  valveProjectId: string | number;
  dataList: Record<string, unknown>[];
}) {
  return request<{ code: number }>({
    url: "/system/table/data/review/comments/save",
    method: "post",
    data,
  });
}

export function projectPostClique(data: {
  valveProjectId: string | number;
  dataList: Record<string, unknown>[];
}) {
  return request<{ code: number }>({
    url: "/system/table/data/review/brand/comments/save",
    method: "post",
    data,
  });
}

export function exportReviewComments(projectValveIds: string) {
  return request<TaskCenterTaskResponse>({
    url: "/system/table/data/review/comments/export/task",
    method: "post",
    params: { projectValveIds },
    headers: {
      "Idempotency-Key": createIdempotencyKey("budget-review-export"),
    },
  });
}

export function exportBrandReviewComments(projectValveIds: string) {
  return request<TaskCenterTaskResponse>({
    url: "/system/table/data/review/brand/comments/export/task",
    method: "post",
    params: { projectValveIds },
    headers: {
      "Idempotency-Key": createIdempotencyKey("budget-brand-export"),
    },
  });
}
