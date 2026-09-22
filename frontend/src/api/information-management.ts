import { request } from "@/api/http";
import type { TaskCenterTaskResponse } from "@/types/task-center";
import { createIdempotencyKey } from "@/utils/idempotency";
import type { TableDataInfo } from "@/types/system";

export type BackendId = number | string;

export type CostCoefficientRow = {
  id?: BackendId;
  bomUnit?: string | null;
  srmPriceUnit?: string | null;
  conversionCoefficient?: string | number | null;
  version?: BackendId | null;
  createBy?: string | null;
  createTime?: string | null;
  updateBy?: string | null;
  updateTime?: string | null;
};

export type CostCoefficientQuery = {
  pageNo?: number;
  pageSize?: number;
  bomUnit?: string;
  srmPriceUnit?: string;
  conversionCoefficient?: string;
};

export type CostCoefficientPayload = {
  id?: BackendId;
  bomUnit: string;
  srmPriceUnit: string;
  conversionCoefficient: string;
  version?: BackendId;
};

export type PresetColumnRow = {
  id?: BackendId;
  moduleId?: string | null;
  moduleName?: string | null;
  groupName?: string | null;
  columnField?: string | null;
  createBy?: string | null;
  createTime?: string | null;
  updateBy?: string | null;
  updateTime?: string | null;
};

export type PresetColumnQuery = {
  pageNo?: number;
  pageSize?: number;
  moduleId?: string;
  groupName?: string;
  beginTime?: string;
  endTime?: string;
};

export type PresetColumnPayload = {
  id?: BackendId;
  moduleId: string;
  moduleName: string;
  groupName: string;
  columnField: string;
};

export type KanbanCurrentProductionRow = {
  id?: BackendId;
  company?: string | null;
  subCompany?: string | null;
  status?: string | null;
  brand?: string | null;
  carModel?: string | null;
  versionType?: string | null;
  salesVolume?: string | number | null;
  salesCompletionRate?: string | number | null;
  operatingIncome?: string | number | null;
  revenueCompletionRate?: string | number | null;
  totalProfit?: string | number | null;
  profitCompletionRate?: string | number | null;
  profitMargin?: string | number | null;
  marginalContribution?: string | number | null;
  marginalContributionRate?: string | number | null;
  msrp?: string | number | null;
  tp?: string | number | null;
  cost?: string | number | null;
  createTime?: string | null;
  createdAt?: string | null;
};

export type KanbanMechanizedRow = {
  id?: BackendId;
  company?: string | null;
  businessLine?: string | null;
  orderNo?: string | null;
  procurementAmount?: string | number | null;
  procurementResultAmount?: string | number | null;
  costReductionAmount?: string | number | null;
  costReductionRate?: string | number | null;
  requirementConfirmationDate?: string | null;
  procurementResultsEndDate?: string | null;
  procurementResultsEndMonth?: string | null;
  procurementAmountCompletionRate?: string | number | null;
  procurementCycle?: string | number | null;
  createTime?: string | null;
  createdAt?: string | null;
};

export type BrandStatus = "ENABLED" | "DISABLED";

export type BrandRow = {
  id?: BackendId;
  brandName?: string | null;
  name?: string | null;
  patternAttachmentId?: BackendId | null;
  patternFileName?: string | null;
  patternImageUrl?: string | null;
  brandSpectrum?: string | null;
  spectrum?: string | null;
  spectrumName?: string | null;
  sort?: string | number | null;
  sortNo?: string | number | null;
  status?: string | null;
  remark?: string | null;
  version?: BackendId | null;
  createTime?: string | null;
  createdAt?: string | null;
  updateTime?: string | null;
  updatedAt?: string | null;
};

export type BrandQuery = {
  pageNo?: number;
  pageSize?: number;
  brandName?: string;
  status?: BrandStatus | "";
};

export type BrandPayload = {
  id?: BackendId;
  brandName: string;
  brandSpectrum?: string;
  sortNo?: number;
  status?: BrandStatus;
  remark?: string;
  version?: BackendId | null;
};

type PageQuery = {
  pageNo?: number;
  pageSize?: number;
};

function pageParams(params?: PageQuery) {
  return {
    pageNum: params?.pageNo,
    pageSize: params?.pageSize,
  };
}

function toTablePage<T>(
  response: TableDataInfo<T> | T[],
  params?: PageQuery,
): { records: T[]; total: number; pageNo: number; pageSize: number } {
  const records = Array.isArray(response) ? response : (response.rows ?? []);
  return {
    records,
    total: Array.isArray(response) ? records.length : (response.total ?? 0),
    pageNo: params?.pageNo ?? 1,
    pageSize: params?.pageSize ?? records.length,
  };
}

function toRuoyiStatus(status?: BrandStatus | string): string | undefined {
  if (!status) {
    return undefined;
  }
  return status === "ENABLED" || status === "0" ? "0" : "1";
}

function fromRuoyiStatus(status?: string | null): BrandStatus {
  return status === "1" || status === "DISABLED" ? "DISABLED" : "ENABLED";
}

function mapBrand(item: BrandRow): BrandRow {
  const sortNo = item.sortNo ?? item.sort;
  return {
    ...item,
    id: item.id ?? item.brandName ?? item.name ?? "",
    brandName: item.brandName ?? item.name ?? "",
    patternAttachmentId: item.patternAttachmentId ?? null,
    patternFileName: item.patternFileName ?? null,
    patternImageUrl: item.patternImageUrl ?? null,
    brandSpectrum:
      item.patternImageUrl ??
      item.brandSpectrum ??
      item.spectrum ??
      item.spectrumName ??
      null,
    sortNo:
      sortNo === undefined || sortNo === null || sortNo === ""
        ? 0
        : Number(sortNo),
    status: fromRuoyiStatus(item.status),
    updateTime: item.updateTime ?? item.updatedAt ?? item.createTime ?? null,
    version: item.version ?? 0,
  };
}

function brandPayload(data: BrandPayload) {
  return {
    id: data.id,
    brandName: data.brandName,
    sort: data.sortNo,
    status: toRuoyiStatus(data.status),
    remark: data.remark,
    version: data.version,
  };
}

export async function fetchBrands(params: BrandQuery) {
  const response = await request<TableDataInfo<BrandRow>>({
    url: "/system/brand/list",
    method: "get",
    params: {
      ...pageParams(params),
      brandName: params.brandName,
      status: toRuoyiStatus(params.status),
    },
  });
  const page = toTablePage(response, params);
  return {
    ...page,
    records: page.records.map(mapBrand),
  };
}

export function createBrand(data: BrandPayload) {
  return request<BackendId>({
    url: "/system/brand",
    method: "post",
    data: brandPayload(data),
  });
}

export function updateBrand(data: BrandPayload) {
  return request<void>({
    url: "/system/brand",
    method: "put",
    data: brandPayload(data),
  });
}

export function uploadBrandSpectrumImage(
  brandId: BackendId,
  file: File,
): Promise<BackendId> {
  const formData = new FormData();
  formData.append("file", file);
  return request<BackendId>({
    url: `/system/brand/${brandId}/pattern`,
    method: "post",
    data: formData,
  });
}

export async function fetchCostCoefficients(params: CostCoefficientQuery) {
  const response = await request<TableDataInfo<CostCoefficientRow>>({
    url: "/system/coefficient/list",
    method: "get",
    params: {
      ...pageParams(params),
      bomUnit: params.bomUnit,
      srmPriceUnit: params.srmPriceUnit,
      conversionCoefficient: params.conversionCoefficient,
    },
  });
  return toTablePage(response, params);
}

export function fetchCostCoefficientDetail(id: BackendId) {
  return request<CostCoefficientRow>({
    url: `/system/coefficient/${id}`,
    method: "get",
  });
}

export function createCostCoefficient(data: CostCoefficientPayload) {
  return request<void>({
    url: "/system/coefficient",
    method: "post",
    data,
  });
}

export function updateCostCoefficient(data: CostCoefficientPayload) {
  return request<void>({
    url: "/system/coefficient",
    method: "put",
    data,
  });
}

export function deleteCostCoefficient(ids: BackendId | BackendId[]) {
  return request<void>({
    url: `/system/coefficient/${Array.isArray(ids) ? ids.join(",") : ids}`,
    method: "delete",
  });
}

export async function fetchPresetColumns(params: PresetColumnQuery) {
  const response = await request<TableDataInfo<PresetColumnRow>>({
    url: "/system/column/list",
    method: "get",
    params: {
      ...pageParams(params),
      moduleId: params.moduleId,
      groupName: params.groupName,
      params: {
        beginTime: params.beginTime,
        endTime: params.endTime,
      },
    },
  });
  return toTablePage(response, params);
}

export function fetchPresetColumnDetail(id: BackendId) {
  return request<PresetColumnRow>({
    url: `/system/column/${id}`,
    method: "get",
  });
}

export function createPresetColumn(data: PresetColumnPayload) {
  return request<void>({
    url: "/system/column",
    method: "post",
    data,
  });
}

export function updatePresetColumn(data: PresetColumnPayload) {
  return request<void>({
    url: "/system/column",
    method: "put",
    data,
  });
}

export function deletePresetColumn(ids: BackendId | BackendId[]) {
  return request<void>({
    url: `/system/column/${Array.isArray(ids) ? ids.join(",") : ids}`,
    method: "delete",
  });
}

export async function fetchKanbanCurrentProduction(params: PageQuery) {
  const response = await request<TableDataInfo<KanbanCurrentProductionRow>>({
    url: "/system/production/car/list",
    method: "get",
    params: pageParams(params),
  });
  return toTablePage(response, params);
}

export async function fetchKanbanMechanized(params: PageQuery) {
  const response = await request<TableDataInfo<KanbanMechanizedRow>>({
    url: "/system/comprehensive/list",
    method: "get",
    params: pageParams(params),
  });
  return toTablePage(response, params);
}

async function uploadKanbanFile(
  url: string,
  file: File,
): Promise<TaskCenterTaskResponse> {
  const data = new FormData();
  data.append("file", file);
  return request<TaskCenterTaskResponse>({
    url,
    method: "post",
    data,
    headers: {
      "Content-Type": "multipart/form-data",
      "Idempotency-Key": createIdempotencyKey("kanban-import"),
    },
  });
}

export function importKanbanCurrentProduction(file: File) {
  return uploadKanbanFile("/system/production/car/importData/task", file);
}

export function importKanbanMechanized(file: File) {
  return uploadKanbanFile("/system/comprehensive/importData/task", file);
}
