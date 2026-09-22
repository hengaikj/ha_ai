/**
 * 收益旧页面仍在使用的成本/测算接口别名
 * 保持原函数名，内部走现有 /system 接口，避免页面 import 断裂。
 */
import { request } from "@/api/http";

type AnyParams = Record<string, unknown> | FormData | unknown;

function get<T = unknown>(url: string, params?: AnyParams) {
  return request<T>({ url, method: "get", params: params as Record<string, unknown> });
}

function post<T = unknown>(url: string, data?: AnyParams) {
  return request<T>({ url, method: "post", data });
}

function put<T = unknown>(url: string, data?: AnyParams) {
  return request<T>({ url, method: "put", data });
}

function del<T = unknown>(url: string, params?: AnyParams) {
  return request<T>({ url, method: "delete", params: params as Record<string, unknown> });
}

export function getCategoryList(params?: AnyParams) {
  return get("/system/analysis/getCategoryList", params);
}

export function getProjectName(params?: AnyParams) {
  return get("/system/analysis/getProjectName", params);
}

export function getanalyzeTableData(params?: AnyParams) {
  return post("/system/analysis/getList", params);
}

export function bomListTwo(params?: AnyParams) {
  return post("/system/bom/newlist", params);
}

export function bomList(params?: AnyParams) {
  return post("/system/bom/newlist", params);
}

export function costCalculate(data?: AnyParams) {
  return post("/system/bom/calculateExtend", data);
}

export function getCalculatingStatus(bomVersionId?: unknown) {
  return get("/system/bom/calculateExtend/task", { bomVersionId });
}

export function editProfitBom(data?: AnyParams) {
  return put("/system/bom/editProfitBom", data);
}

export function editDesignBom(data?: AnyParams) {
  return put("/system/bom/editDesignBom", data);
}

export function editAdminBom(data?: AnyParams) {
  return put("/system/bom", data);
}

export function syncBidPriceToCostBom(data?: AnyParams) {
  return post("/system/bom/srmSupplierRatio", data);
}

export function bomDelVersion(params?: AnyParams) {
  return del("/system/bom/version", params);
}

export function bomImportData(data?: AnyParams) {
  return post("/system/bom/import", data);
}

export function versionBom(data?: AnyParams) {
  return put("/system/bom/version", data);
}

export function bomDelBom(params?: AnyParams) {
  return del("/system/bom", params);
}

export function getVehicleModelAndValveName(params?: AnyParams) {
  return get("/system/analysis/getValveList", params);
}

export function measureList(params?: AnyParams) {
  return get("/system/analysis/getList", params);
}

export function postCalculate(data?: AnyParams) {
  return post("/system/bom/calculateExtend", data);
}

export function delVersion(params?: AnyParams) {
  return del("/system/bom/version", params);
}

export function importData(data?: AnyParams) {
  return post("/system/bom/import", data);
}

export function versionId(data?: AnyParams) {
  return put("/system/bom/version", data);
}

export function versionList(params?: AnyParams) {
  return get("/system/bom/version/list", params);
}

export function costList(params?: AnyParams) {
  return get("/system/cost/list", params);
}
