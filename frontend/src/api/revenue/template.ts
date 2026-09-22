/**
 * 收益 - 模板管理 API
 * 对接后端 /prod-revenue-api/period-expense-templates
 */
import { request } from "@/api/http";

const TEMPLATE_BASE_URL = "/prod-revenue-api/period-expense-templates";

export type TemplateEntryMode = "MANUAL" | "CALCULATED" | "DATA_QUERY" | "DERIVED";

export interface TemplateItemPayload {
  subjectId: number;
  entryMode: TemplateEntryMode;
  sortOrder?: number;
  formulaId?: number;
  formulaParamBindings?: string;
}

export interface TemplateListParams {
  pageNum?: number;
  pageSize?: number;
  /** 前端搜索关键字，映射为后端 templateName */
  keyword?: string;
  templateCode?: string;
  templateName?: string;
  status?: string;
  subjectCategory?: string;
}

export interface TemplateWritePayload {
  templateCode?: string;
  templateName: string;
  status?: string;
  creatorId: string;
  creatorName: string;
  subjectIds?: Array<string | number>;
  items?: TemplateItemPayload[];
  /** 仅前端表单字段，后端无对应属性 */
  subjectCategory?: string;
  description?: string;
}

export interface NormalizedTemplateRow {
  id: string;
  templateNo: string;
  templateCode: string;
  templateName: string;
  subjectCategory: string;
  subjectCount: number;
  version: number | string;
  status: string;
  templateStatus?: string;
  updateTime: string;
  operatorName: string;
  subjectIds: string[];
  description: string;
  items: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface TemplateListResult {
  rows: NormalizedTemplateRow[];
  total: number;
}

type BackendListEnvelope = {
  rows?: Array<Record<string, unknown>>;
  data?: Array<Record<string, unknown>>;
  total?: number;
};

type BackendTemplateDetail = Record<string, unknown> & {
  id?: string | number;
  templateCode?: string;
  templateName?: string;
  status?: string;
  versionNo?: number;
  creatorName?: string;
  updatedAt?: string;
  items?: Array<Record<string, unknown>>;
};

function safeText(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function buildItems(
  subjectIds: Array<string | number> | undefined,
  items: TemplateItemPayload[] | undefined,
): TemplateItemPayload[] {
  if (Array.isArray(items) && items.length) {
    return items.map((item, index) => ({
      subjectId: Number(item.subjectId),
      entryMode: item.entryMode || "MANUAL",
      sortOrder: item.sortOrder ?? index,
      formulaId: item.formulaId,
      formulaParamBindings: item.formulaParamBindings,
    }));
  }
  return (subjectIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
    .map((subjectId, index) => ({
      subjectId,
      entryMode: "MANUAL" as const,
      sortOrder: index,
    }));
}

function createTemplateCode(templateName?: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const prefix = safeText(templateName)
    .replace(/[^\w\u4e00-\u9fa5]/g, "")
    .slice(0, 8)
    .toUpperCase();
  return `TMP_${prefix || "T"}_${stamp}`.slice(0, 64);
}

/** 将后端模板记录映射为列表页字段 */
export function normalizeTemplateRow(
  row: Record<string, unknown> | null | undefined,
): NormalizedTemplateRow {
  const source = row && typeof row === "object" ? row : {};
  const items = Array.isArray(source.items)
    ? (source.items as Array<Record<string, unknown>>)
    : [];
  const subjectIds = items
    .map((item) => safeText(item.subjectId ?? item.subject_id))
    .filter(Boolean);
  const templateCode = safeText(source.templateCode || source.template_code);
  const status = safeText(source.status || source.templateStatus, "INACTIVE");
  return {
    ...source,
    id: safeText(source.id),
    templateNo: templateCode || safeText(source.templateNo),
    templateCode,
    templateName: safeText(source.templateName || source.template_name),
    subjectCategory: safeText(source.subjectCategory),
    subjectCount: items.length || Number(source.subjectCount) || 0,
    version: (source.versionNo ?? source.version ?? "-") as number | string,
    status,
    templateStatus: status,
    updateTime: safeText(source.updatedAt || source.updateTime || source.updated_at),
    operatorName: safeText(source.creatorName || source.operatorName || source.creator_name),
    subjectIds,
    description: safeText(source.description || source.remark),
    items,
  };
}

function parseListResponse(response: BackendListEnvelope | null): TemplateListResult {
  const rowsRaw = Array.isArray(response?.rows)
    ? response!.rows!
    : Array.isArray(response?.data)
      ? response!.data!
      : [];
  const rows = rowsRaw.map((item) => normalizeTemplateRow(item));
  const total = Number(response?.total) || rows.length;
  return { rows, total };
}

/**
 * 分页查询模板列表
 */
export async function queryTemplatePage(
  params: TemplateListParams = {},
): Promise<TemplateListResult> {
  const keyword = safeText(params.keyword);
  const query = {
    pageNum: params.pageNum ?? 1,
    pageSize: params.pageSize ?? 20,
    templateCode: safeText(params.templateCode) || undefined,
    // 关键字优先按名称搜索；精确编码可通过 templateCode 传入
    templateName: safeText(params.templateName) || keyword || undefined,
    status: safeText(params.status) || undefined,
  };
  const response = (await request({
    baseURL: "",
    url: TEMPLATE_BASE_URL,
    method: "get",
    params: query,
  })) as BackendListEnvelope;
  const parsed = parseListResponse(response);
  // 后端暂无科目类别字段，若前端仍传 subjectCategory 则在结果侧做弱过滤
  const subjectCategory = safeText(params.subjectCategory);
  if (!subjectCategory) {
    return parsed;
  }
  const filtered = parsed.rows.filter(
    (row) => safeText(row.subjectCategory) === subjectCategory,
  );
  return { rows: filtered, total: filtered.length };
}

/**
 * 查询模板详情
 */
export async function getTemplateDetail(
  id: string | number,
): Promise<NormalizedTemplateRow> {
  const detail = (await request({
    baseURL: "",
    url: `${TEMPLATE_BASE_URL}/${id}`,
    method: "get",
  })) as BackendTemplateDetail;
  return normalizeTemplateRow(detail);
}

/**
 * 创建模板
 */
export async function createTemplate(data: TemplateWritePayload): Promise<void> {
  const items = buildItems(data.subjectIds, data.items);
  if (!items.length) {
    throw new Error("请至少选择一个科目");
  }
  await request({
    baseURL: "",
    url: TEMPLATE_BASE_URL,
    method: "post",
    data: {
      templateCode: safeText(data.templateCode) || createTemplateCode(data.templateName),
      templateName: safeText(data.templateName),
      status: safeText(data.status, "ACTIVE"),
      creatorId: safeText(data.creatorId),
      creatorName: safeText(data.creatorName),
      items,
    },
  });
}

/**
 * 更新模板（后端按 ID 生成更高版本）
 */
export async function updateTemplate(
  data: TemplateWritePayload & { id: string },
): Promise<void> {
  const items = buildItems(data.subjectIds, data.items);
  if (!items.length) {
    throw new Error("请至少选择一个科目");
  }
  await request({
    baseURL: "",
    url: `${TEMPLATE_BASE_URL}/${data.id}`,
    method: "put",
    data: {
      templateName: safeText(data.templateName),
      status: safeText(data.status, "ACTIVE"),
      creatorId: safeText(data.creatorId),
      creatorName: safeText(data.creatorName),
      items,
    },
  });
}

/**
 * 删除模板
 */
export async function deleteTemplate(params: { id: string }): Promise<void> {
  await request({
    baseURL: "",
    url: `${TEMPLATE_BASE_URL}/${params.id}`,
    method: "delete",
  });
}

/**
 * 切换模板启用/停用状态
 */
export async function toggleTemplateStatus(params: {
  id: string;
  status: string;
}): Promise<void> {
  const enabled = params.status === "ACTIVE";
  await request({
    baseURL: "",
    url: `${TEMPLATE_BASE_URL}/${params.id}/${enabled ? "enable" : "disable"}`,
    method: "put",
  });
}

/**
 * 复制模板：读取详情后按新编码创建
 */
export async function copyTemplate(params: {
  id: string;
  creatorId: string;
  creatorName: string;
}): Promise<void> {
  const detail = await getTemplateDetail(params.id);
  const items: TemplateItemPayload[] = (detail.items || []).map((item, index) => ({
    subjectId: Number(item.subjectId),
    entryMode: (safeText(item.entryMode, "MANUAL") as TemplateEntryMode) || "MANUAL",
    sortOrder:
      item.sortOrder == null || Number.isNaN(Number(item.sortOrder))
        ? index
        : Number(item.sortOrder),
    formulaId: item.formulaId == null ? undefined : Number(item.formulaId),
    formulaParamBindings: safeText(item.formulaParamBindings) || undefined,
  }));
  if (!items.length) {
    throw new Error("源模板没有可复制的科目关系");
  }
  await createTemplate({
    templateCode: createTemplateCode(`${detail.templateCode || detail.templateName}_COPY`),
    templateName: `${detail.templateName || "模板"}-副本`,
    status: "INACTIVE",
    creatorId: params.creatorId,
    creatorName: params.creatorName,
    items,
  });
}
