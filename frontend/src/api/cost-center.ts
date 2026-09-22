import { httpClient, request } from "@/api/http";
import { mapTableData } from "@/api/system/common";
import type { TaskCenterTaskResponse } from "@/types/task-center";
import { createIdempotencyKey } from "@/utils/idempotency";
import { resolveServerTotal } from "@/utils/pagination";
import type * as CostCenter from "@/types/cost-center";
import type {
  CostBomCategoryItem,
  CostBomCategoryPayload,
  CostErrorLogItem,
  CostBomPatternItem,
  CostBomPatternPageResponse,
  CostBomPatternQuery,
} from "@/types/cost-center";
import type {
  PlatformPageQuery,
  PlatformPageResponse,
} from "@/types/platform-system";
import type { BusinessProjectItem, BusinessValveItem } from "@/types/project";
import type { TableDataInfo } from "@/types/system";

type SysPattern = {
  id?: number;
  patternNumber?: string;
  patternName?: string;
  status?: string;
  remark?: string;
  createTime?: string;
};

type SysProjectPattern = {
  id?: number | string;
  patternId?: number | string;
  patternNumber?: string;
  patternCode?: string;
  patternName?: string;
  reorganizeRelations?: unknown;
};

type SysCostCategory = {
  id?: number;
  name?: string;
  label?: string;
  categoryName?: string;
  code?: string;
  categoryCode?: string;
  parentId?: number;
  parentCode?: number;
  fullCode?: string;
  categoryLevel?: number;
  level?: number;
  sortNo?: number;
  sort?: number;
  status?: number | string;
  remark?: string;
  createTime?: string;
  createdAt?: string;
  children?: SysCostCategory[];
};

type SysCostErrorLog = {
  id?: number;
  msg?: string;
  projectId?: number;
  projectName?: string;
  valveId?: number;
  valveName?: string;
  createBy?: string;
  createTime?: string;
  remark?: string;
};

type SysBomQueryItem = {
  id?: number | string;
  projectId?: number | string;
  projectName?: string;
  vehicleModel?: { modelName?: string; id?: number };
  vehiclem?: string;
  vehicleM?: string;
  vehicleCode?: string;
  reorganizeCode?: string;
  vehicleReorganizeCode?: string;
  vehicleName?: string;
  reorganizeName?: string;
  vehicleReorganizeName?: string;
  partNum?: string;
  partNo?: string;
  partNumber?: string;
  chDesc?: string;
  partName?: string;
  pathQuantity?: string;
  usagePerVehicle?: string;
  quantity?: string;
  unitCode?: string;
  unit?: string;
  modelUserd1st?: string;
  firstVehicleModel?: string;
  sorNum?: string;
  sorName?: string;
  engineerIncharge?: string;
  expertEngineer?: string;
  costEngineer?: string;
  sogForSug?: string;
  suggestedSupplySource?: string;
  respDept?: string;
  developmentDepartment?: string;
  pendingGeneralLeve?: string;
  pendingGeneralLevel?: string;
  generalizationLevel?: string;
  partType?: string;
  architectureComponent?: string;
  isArchitectureComponent?: string;
  ecnProcessNum?: string;
  partCategory?: string;
  createBy?: string;
  createTime?: string;
  createdAt?: string;
};

type SysBomQueryProject = {
  id?: number;
  projectId?: number;
  projectName?: string;
  vehicleModel?: {
    id?: number;
    modelName?: string;
    modelNumber?: string;
  };
  name?: string;
  label?: string;
  projectCode?: string;
  projectNo?: string;
  code?: string;
  wbsNumber?: string;
  vehicleModelId?: number;
  vehicleModelName?: string;
  modelName?: string;
  status?: string;
};

type CostErrorLogQuery = PlatformPageQuery & {
  keyword?: string;
  projectName?: string;
  valveName?: string | number;
  createdFrom?: string;
  createdTo?: string;
};

export type CostErrorLogValveOption = {
  label: string;
  value: string | number;
};
type QueryParams = Record<string, unknown>;

export type CostAnalysisPatternItem = {
  id: number;
  patternName: string;
  patternNumber?: string;
};

export type CostAnalysisProjectItem = BusinessProjectItem & {
  patternList: CostAnalysisPatternItem[];
};

export type CostAnalysisCategorySelection = {
  categoryId?: number;
  categoryName?: string;
  categoryLevel?: number;
  categoryCode?: string;
};

export type CostAnalysisCriteria = {
  projectPatternVoList: Array<{
    projectId: number;
    projectName: string;
    patternList: CostAnalysisPatternItem[];
  }>;
  costBomCategoryList: Array<{
    id: number;
    categoryName: string;
    categoryCode?: string;
    level: number;
  }>;
  valveId: number;
};

export function buildCostAnalysisCriteria(
  project: CostAnalysisProjectItem,
  categories: CostAnalysisCategorySelection[],
  valveId: number,
): CostAnalysisCriteria {
  return {
    projectPatternVoList: [
      {
        projectId: project.projectId,
        projectName: project.projectName,
        patternList: project.patternList,
      },
    ],
    costBomCategoryList: categories.map((category) => ({
      id: toCostNumber(category.categoryId),
      categoryName: toCostText(category.categoryName),
      ...(category.categoryCode ? { categoryCode: category.categoryCode } : {}),
      level: toCostNumber(category.categoryLevel),
    })),
    valveId,
  };
}

type CostBomFilterField = {
  boardName: string;
  field: string;
  fieldType: "string" | "amount";
  tableSource: "main" | "extend";
};

const costBomFilterFieldMap: Record<string, CostBomFilterField> = {
  partNo: {
    boardName: "基本信息",
    field: "part_number",
    fieldType: "string",
    tableSource: "main",
  },
  partName: {
    boardName: "基本信息",
    field: "part_name",
    fieldType: "string",
    tableSource: "main",
  },
  sorName: {
    boardName: "基本信息",
    field: "sor_name",
    fieldType: "string",
    tableSource: "main",
  },
  supplierName: {
    boardName: "基本信息",
    field: "supplier_name",
    fieldType: "string",
    tableSource: "main",
  },
  moduleIdentifier: {
    boardName: "基本信息",
    field: "module_identifier",
    fieldType: "string",
    tableSource: "main",
  },
  generalizationLevel: {
    boardName: "分类",
    field: "generalization_level",
    fieldType: "string",
    tableSource: "main",
  },
  architectureComponent: {
    boardName: "分类",
    field: "is_architecture_component",
    fieldType: "string",
    tableSource: "main",
  },
  costCategoryLevel2Name: {
    boardName: "分工",
    field: "second_classification",
    fieldType: "string",
    tableSource: "main",
  },
  costCategoryLevel3Name: {
    boardName: "分工",
    field: "three_classification",
    fieldType: "string",
    tableSource: "main",
  },
  costEngineerName: {
    boardName: "分工",
    field: "cost_engineer",
    fieldType: "string",
    tableSource: "main",
  },
  procurementEngineerName: {
    boardName: "分工",
    field: "procurement_engineer",
    fieldType: "string",
    tableSource: "main",
  },
  targetValue: {
    boardName: "目标值",
    field: "target_value",
    fieldType: "amount",
    tableSource: "main",
  },
  initialEvaluationValue: {
    boardName: "初始评估值",
    field: "initial_evaluation_value",
    fieldType: "amount",
    tableSource: "main",
  },
  estimatedCostAmount: {
    boardName: "评估值",
    field: "evaluation_value",
    fieldType: "amount",
    tableSource: "extend",
  },
  currentCostAmount: {
    boardName: "当前成本",
    field: "material_cost_with_amortization",
    fieldType: "amount",
    tableSource: "extend",
  },
  materialCostWithoutAmortization: {
    boardName: "当前成本",
    field: "material_cost_without_amortization",
    fieldType: "amount",
    tableSource: "extend",
  },
};

function parseCostBomAdvancedConditions(params: QueryParams) {
  let source = params.advancedConditions;
  if (!Array.isArray(source) && typeof params.conditions === "string") {
    try {
      source = JSON.parse(params.conditions) as unknown;
    } catch {
      throw new Error("成本明细筛选条件格式无效");
    }
  }
  if (!Array.isArray(source)) return [];

  return source.map((condition) => {
    const item = condition as Record<string, unknown>;
    const attributeName = [item.attributeName, item.field]
      .map((value) => String(value ?? "").trim())
      .find(Boolean) || "";
    const mappedFieldConfig =
      costBomFilterFieldMap[attributeName] ??
      Object.values(costBomFilterFieldMap).find(
        (candidate) => candidate.field === attributeName,
      );
    // 筛选字段由 /system/bom/filter/fields 接口下发，不能在这里再用
    // 一份静态白名单拦截，否则接口新增字段（例如 ia_name）会直接报错。
    // 静态映射只用于兼容旧页面传入的 camelCase 字段。
    const fieldConfig: CostBomFilterField = mappedFieldConfig ?? {
      boardName: String(item.moduleName ?? item.boardName ?? ""),
      field: attributeName,
      fieldType: item.fieldType === "amount" ? "amount" : "string",
      tableSource: item.tableSource === "extend" ? "extend" : "main",
    };

    const rawOperator = String(item.operator ?? "eq");
    const operator = rawOperator === "contains" ? "like" : rawOperator;
    return {
      boardName: String(
        item.moduleName ?? item.boardName ?? fieldConfig.boardName,
      ),
      attrName: String(
        item.attrName ??
          item.attributeLabel ??
          (item.attributeName ? item.attributeName : fieldConfig.boardName),
      ),
      field: String(item.field ?? fieldConfig.field),
      value: String(item.attributeValue ?? item.value ?? ""),
      logic: String(item.logic).toUpperCase() === "OR" ? "OR" : "AND",
      operator,
      fieldType: String(item.fieldType ?? fieldConfig.fieldType),
      tableSource: String(item.tableSource ?? fieldConfig.tableSource),
    };
  });
}

function fromRuoyiStatus(status?: string) {
  return status === "1" ? "DISABLED" : "ENABLED";
}

function toRuoyiStatus(status?: string) {
  if (!status) {
    return undefined;
  }
  return status === "ENABLED" || status === "0" ? "0" : "1";
}

function definedFields<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<T>;
}

function mapPattern(item: SysPattern): CostBomPatternItem {
  return {
    patternId: item.id ?? 0,
    patternCode: item.patternNumber ?? "",
    patternName: item.patternName ?? "",
    status: fromRuoyiStatus(item.status),
    remark: item.remark ?? null,
    createdAt: item.createTime ?? null,
    version: 0,
  };
}

function mapCategory(item: SysCostCategory): CostBomCategoryItem {
  return {
    categoryId: item.id ?? 0,
    parentId: item.parentCode ?? item.parentId ?? 0,
    categoryCode: item.categoryCode ?? item.code ?? "",
    categoryName: item.categoryName ?? item.name ?? item.label ?? "",
    categoryLevel: item.level ?? item.categoryLevel ?? 1,
    sortNo: item.sort ?? item.sortNo ?? 0,
    status: String(item.status) === "1" ? "DISABLED" : "ENABLED",
    remark: item.remark ?? null,
    createdAt: item.createTime ?? item.createdAt ?? null,
    version: 0,
  };
}

function categoryPayload(payload: CostBomCategoryPayload) {
  return {
    id: payload.version ? payload.categoryCode : undefined,
    parentCode: Number(payload.parentId ?? 0),
    categoryCode: payload.categoryCode,
    categoryName: payload.categoryName,
    level: payload.categoryLevel,
    sort: payload.sortNo,
    status: payload.status === "DISABLED" ? 1 : 0,
    remark: payload.remark,
  };
}

function mapErrorLog(item: SysCostErrorLog): CostErrorLogItem {
  return {
    errorLogId: item.id ?? 0,
    businessCode: item.projectName ?? String(item.projectId ?? ""),
    businessName: item.valveName ?? String(item.valveId ?? ""),
    errorMessage: item.msg ?? "",
    projectId: item.projectId ?? null,
    projectName: item.projectName ?? null,
    valveId: item.valveId ?? null,
    valveName: item.valveName ?? null,
    status: "PENDING",
    remark: item.remark ?? null,
    createBy: item.createBy ?? null,
    createdBy: item.createBy ?? null,
    createdAt: item.createTime ?? null,
    version: 0,
  };
}

function flattenCategories(
  items: SysCostCategory[],
  fallbackParentCode = 0,
): SysCostCategory[] {
  return items.flatMap((item) => {
    const normalizedItem = {
      ...item,
      parentCode: item.parentCode ?? fallbackParentCode,
    };
    return [
      normalizedItem,
      ...flattenCategories(item.children ?? [], item.id ?? fallbackParentCode),
    ];
  });
}

function patternPayload(payload: {
  patternCode?: string;
  patternName?: string;
  status?: string;
  remark?: string;
}) {
  return {
    patternNumber: payload.patternCode,
    patternName: payload.patternName,
    status: toRuoyiStatus(payload.status),
    remark: payload.remark,
  };
}

export async function fetchCostBomPatterns(
  params?: CostBomPatternQuery,
  options?: { skipErrorToast?: boolean },
): Promise<CostBomPatternPageResponse> {
  const response = await request<TableDataInfo<SysPattern>>({
    url: "/system/pattern/list",
    method: "get",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      patternNumber: params?.patternCode ?? params?.keyword,
      patternName: params?.patternName ?? params?.keyword,
      status: toRuoyiStatus(params?.status),
      "params[beginTime]": params?.createdAtStart,
      "params[endTime]": params?.createdAtEnd,
    },
    skipErrorToast: options?.skipErrorToast,
  });
  const page = mapTableData(response, {
    pageNum: params?.pageNo,
    pageSize: params?.pageSize,
  });
  return {
    records: page.records.map(mapPattern),
    total: page.total,
    pageNo: params?.pageNo ?? 1,
    pageSize: params?.pageSize ?? page.records.length,
    hasNext: false,
  };
}

export async function fetchPurchaseBomProjectPatterns(
  projectId: number,
): Promise<CostCenter.PurchaseBomProjectPatternItem[]> {
  const response = await request<
    SysProjectPattern[] | { data?: SysProjectPattern[]; rows?: SysProjectPattern[] }
  >({
    url: "/system/pattern/project",
    method: "get",
    params: { projectId },
  });
  const rows = Array.isArray(response)
    ? response
    : response.data ?? response.rows ?? [];

  return rows.map((row) => {
    const relations = Array.isArray(row.reorganizeRelations)
      ? (row.reorganizeRelations as Record<string, unknown>[])
      : [];
    const relationCode = (field: "reorganizeCode12" | "reorganizeCode18") =>
      relations.reduce<string | null>((current, relation) => {
        const value = toCostText(relation[field]);
        return value || current;
      }, null);

    return {
      patternId: toCostNumber(row.id ?? row.patternId),
      patternCode: toCostText(row.patternNumber ?? row.patternCode),
      patternName: toCostText(row.patternName),
      reorganizeCode12: relationCode("reorganizeCode12"),
      reorganizeCode18: relationCode("reorganizeCode18"),
    };
  });
}

function mapBomQueryItem(item: SysBomQueryItem): CostCenter.BomQueryItem {
  const id =
    item.id ??
    `${item.projectId ?? ""}-${item.vehiclem ?? item.vehicleReorganizeCode ?? ""}-${item.partNum ?? item.partNo ?? ""}`;
  return {
    id,
    projectId: item.projectId ?? null,
    projectName:
      item.projectName ??
      item.vehicleModel?.modelName ??
      String(item.projectId ?? ""),
    vehicleReorganizeCode:
      item.vehiclem ??
      item.vehicleM ??
      item.vehicleCode ??
      item.reorganizeCode ??
      item.vehicleReorganizeCode ??
      null,
    vehicleReorganizeName:
      item.vehicleName ??
      item.reorganizeName ??
      item.vehicleReorganizeName ??
      null,
    partNo: item.partNum ?? item.partNo ?? item.partNumber ?? null,
    partName: item.chDesc ?? item.partName ?? null,
    quantity:
      item.pathQuantity ?? item.usagePerVehicle ?? item.quantity ?? null,
    unit: item.unitCode ?? item.unit ?? null,
    firstVehicleModel: item.modelUserd1st ?? item.firstVehicleModel ?? null,
    sorName: item.sorNum ?? item.sorName ?? null,
    expertEngineer:
      item.engineerIncharge ?? item.expertEngineer ?? item.costEngineer ?? null,
    suggestedSupplySource: item.sogForSug ?? item.suggestedSupplySource ?? null,
    developmentDepartment: item.respDept ?? item.developmentDepartment ?? null,
    generalizationLevel:
      item.pendingGeneralLeve ??
      item.pendingGeneralLevel ??
      item.generalizationLevel ??
      null,
    architectureComponent:
      item.partType ??
      item.architectureComponent ??
      item.isArchitectureComponent ??
      null,
    ecnProcessNum: item.ecnProcessNum ?? null,
    partCategory: item.partCategory ?? null,
    createdBy: item.createBy ?? null,
    createdAt: item.createTime ?? item.createdAt ?? null,
  };
}

function mapBomQueryProject(item: SysBomQueryProject): BusinessProjectItem {
  const projectId = item.projectId ?? item.id ?? 0;
  const vehicleModel = item.vehicleModel ?? {};
  const projectName =
    item.projectName ?? item.name ?? item.label ?? vehicleModel.modelName ?? "";
  return {
    projectId,
    projectCode:
      item.projectCode ??
      item.projectNo ??
      item.code ??
      vehicleModel.modelNumber ??
      String(projectId || ""),
    projectName: projectName || String(projectId || ""),
    wbsNumber: item.wbsNumber ?? null,
    vehicleModelId: item.vehicleModelId ?? vehicleModel.id ?? null,
    vehicleModelCode: null,
    vehicleModelName:
      item.vehicleModelName ?? item.modelName ?? vehicleModel.modelName ?? null,
    budgetLocked: false,
    evaluateLocked: false,
    status: item.status === "1" ? "DISABLED" : "ENABLED",
    remark: null,
    version: 0,
  };
}

function readTableRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const source = payload as {
    rows?: T[];
    records?: T[];
    list?: T[];
    data?: T[] | { rows?: T[]; records?: T[]; list?: T[] };
  };
  if (Array.isArray(source.rows)) {
    return source.rows;
  }
  if (Array.isArray(source.records)) {
    return source.records;
  }
  if (Array.isArray(source.list)) {
    return source.list;
  }
  if (Array.isArray(source.data)) {
    return source.data;
  }
  if (source.data && typeof source.data === "object") {
    return readTableRows<T>(source.data);
  }
  return [];
}

export function fetchCostBomPatternDetail(
  patternId: number | string,
): Promise<CostBomPatternItem> {
  return request<SysPattern>({
    url: `/system/pattern/${patternId}`,
    method: "get",
  }).then(mapPattern);
}

export async function createCostBomPattern(payload: {
  patternCode: string;
  patternName: string;
  status?: string;
  remark?: string;
}) {
  await request<void>({
    url: "/system/pattern",
    method: "post",
    data: patternPayload(payload),
  });
  return {
    patternId: 0,
    patternCode: payload.patternCode,
    patternName: payload.patternName,
    status: payload.status ?? "ENABLED",
    remark: payload.remark ?? null,
    version: 0,
  };
}

export async function updateCostBomPattern(
  patternId: number,
  payload: {
    patternName?: string;
    status?: string;
    remark?: string;
    version: number;
  },
) {
  const current = await request<SysPattern>({
    url: `/system/pattern/${patternId}`,
    method: "get",
  });
  await request<void>({
    url: "/system/pattern",
    method: "put",
    data: {
      ...current,
      id: patternId,
      ...definedFields(patternPayload(payload)),
    },
  });
  return {
    patternId,
    patternCode: String(patternId),
    patternName: payload.patternName ?? "",
    status: payload.status ?? "ENABLED",
    remark: payload.remark ?? null,
    version: 0,
  };
}

export function enableCostBomPattern(patternId: number) {
  return updateCostBomPattern(patternId, { status: "ENABLED", version: 0 });
}

export function disableCostBomPattern(patternId: number) {
  return updateCostBomPattern(patternId, { status: "DISABLED", version: 0 });
}

export function deleteCostBomPattern(patternId: number | string) {
  return request<void>({
    url: `/system/pattern/${patternId}`,
    method: "delete",
  });
}

export async function fetchCostBomCategories(params?: {
  categoryName?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
}): Promise<CostBomCategoryItem[]> {
  const response = await request<TableDataInfo<SysCostCategory>>({
    url: "/system/category/tree",
    method: "get",
    params: {
      categoryName: params?.categoryName,
      "params[endTime]": params?.createdAtEnd,
      "params[beginTime]": params?.createdAtStart,
    },
  });
  return flattenCategories(response.rows ?? []).map(mapCategory);
}

export async function createCostBomCategory(payload: CostBomCategoryPayload) {
  await request<void>({
    url: "/system/category/tree",
    method: "post",
    data: categoryPayload(payload),
  });
  return {
    ...payload,
    categoryId: 0,
    status: payload.status,
    version: 0,
  };
}

export async function updateCostBomCategory(
  categoryId: number | string,
  payload: CostBomCategoryPayload,
) {
  await request<void>({
    url: "/system/category",
    method: "put",
    data: {
      ...categoryPayload(payload),
      id: categoryId,
    },
  });
  return {
    ...payload,
    categoryId,
    version: 0,
  };
}

export function deleteCostBomCategory(
  categoryId: number | string,
  _version?: number,
) {
  void _version;
  return request<void>({
    url: `/system/category/${categoryId}`,
    method: "delete",
  });
}

export async function fetchCostErrorLogs(
  params: CostErrorLogQuery,
): Promise<PlatformPageResponse<CostErrorLogItem>> {
  const response = await request<TableDataInfo<SysCostErrorLog>>({
    url: "/system/log/list",
    method: "get",
    params: {
      pageNum: params.pageNo,
      pageSize: params.pageSize,
      projectName: params.projectName ?? params.keyword,
      valveName: params.valveName,
      "params[beginTime]": params.createdFrom,
      "params[endTime]": params.createdTo,
    },
  });
  const page = mapTableData(response, {
    pageNum: params.pageNo,
    pageSize: params.pageSize,
  });
  return {
    records: page.records.map(mapErrorLog),
    total: page.total,
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? page.records.length,
  };
}

export async function createCostErrorLogExportTask(params?: CostErrorLogQuery) {
  return request<TaskCenterTaskResponse>({
    url: "/system/log/export/task",
    method: "post",
    params: {
      projectName: params?.projectName ?? params?.keyword,
      valveName: params?.valveName,
      "params[beginTime]": params?.createdFrom,
      "params[endTime]": params?.createdTo,
    },
    headers: {
      "Idempotency-Key": createIdempotencyKey("cost-error-log-export"),
    },
  });
}

export async function fetchCostErrorLogDetail(
  errorLogId: number | string,
): Promise<CostErrorLogItem> {
  const response = await request<SysCostErrorLog>({
    url: `/system/log/${errorLogId}`,
    method: "get",
  });
  return mapErrorLog(response);
}

export async function fetchCostErrorLogValveOptions(): Promise<
  CostErrorLogValveOption[]
> {
  const response = await request<
    TableDataInfo<{ id?: string | number; valveName?: string }>
  >({
    url: "/system/valve/list",
    method: "get",
  });
  return (response.rows ?? []).map((item) => ({
    label: item.valveName ?? String(item.id ?? ""),
    value: item.id ?? "",
  }));
}

export async function fetchBomQueryProjects(params?: {
  projectName?: string;
  type?: number;
  userId?: number | string;
  page?: number;
  pageSize?: number;
}): Promise<BusinessProjectItem[]> {
  const response = await request<
    | TableDataInfo<SysBomQueryProject>
    | SysBomQueryProject[]
    | { records?: SysBomQueryProject[]; list?: SysBomQueryProject[] }
  >({
    url: "/system/project/permission/projectDataList",
    method: "get",
    params: {
      projectName: params?.projectName,
      type: params?.type ?? 2,
      userId: params?.userId,
      page: params?.page ?? 1,
      pageNum: params?.page ?? 1,
      pageSize: params?.pageSize ?? 999,
    },
  });
  return readTableRows<SysBomQueryProject>(response).map(mapBomQueryProject);
}

export async function fetchBomQueryPageList(params: {
  pageNum: number;
  pageSize: number;
  vehiclem?: string;
  vehicleName?: string;
  partNum?: string;
  chDesc?: string;
  projectName?: string;
  startTime?: string;
  endTime?: string;
  projectId?: string;
}): Promise<CostCenter.BomQueryPageResponse> {
  const response = await request<TableDataInfo<SysBomQueryItem>>({
    url: "/system/syncBom/pageList",
    method: "get",
    params,
  });
  const page = mapTableData(response, {
    pageNum: params.pageNum,
    pageSize: params.pageSize,
  });
  return {
    records: page.records.map(mapBomQueryItem),
    total: page.total,
    pageNo: params.pageNum,
    pageSize: params.pageSize,
    hasNext: params.pageNum * params.pageSize < page.total,
  };
}

export async function createSyncBomQueryExportTask(params: {
  vehiclem?: string;
  vehicleName?: string;
  partNum?: string;
  chDesc?: string;
  projectName?: string;
  startTime?: string;
  endTime?: string;
  projectId?: string;
}): Promise<TaskCenterTaskResponse> {
  const data = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  );
  return request<TaskCenterTaskResponse>({
    url: "/system/syncBom/export/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("sync-bom-query-export"),
    },
  });
}

function toCostNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function toCostText(value: unknown, fallback = ""): string {
  return value === null || value === undefined ? fallback : String(value);
}

function toCostPage<T>(
  response:
    | TableDataInfo<Record<string, unknown>>
    | CostCenter.CostCenterPage<T>,
  mapper: (item: Record<string, unknown>, index?: number) => T,
  params?: QueryParams,
): CostCenter.CostCenterPage<T> {
  if ("records" in response && Array.isArray(response.records)) {
    return {
      ...response,
      records: response.records.map((row, index) =>
        mapper(row as Record<string, unknown>, index),
      ),
    };
  }
  const rows = "rows" in response ? (response.rows ?? []) : [];
  const pageNo = toCostNumber(params?.pageNo ?? params?.pageNum, 1);
  const pageSize = toCostNumber(params?.pageSize, rows.length || 10);
  const total = resolveServerTotal(response.total);
  return {
    pageNo,
    pageSize,
    total,
    hasNext: pageNo * pageSize < total,
    records: rows.map(mapper),
  };
}

export function queryCostFacts(
  query: CostCenter.CostFactQuery,
): Promise<CostCenter.CostFactPageResponse> {
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/cost/facts/query",
    method: "post",
    data: query,
  }).then((response) =>
    toCostPage<CostCenter.CostFactRow>(response, (row) => row, {
      pageNum: query.pageNum,
      pageSize: query.pageSize,
    }),
  );
}

export function createCostFactExportTask(
  query: CostCenter.CostFactQuery,
): Promise<CostCenter.CostFactExportTaskResponse> {
  return request<CostCenter.CostFactExportTaskResponse>({
    url: "/cost/facts/export",
    method: "post",
    data: query,
    headers: {
      "Idempotency-Key": createIdempotencyKey("cost-fact-export"),
    },
  });
}

function createCostTask(
  taskType: string,
  businessId = 0,
): CostCenter.TaskCreatedResponse {
  return {
    taskId: Date.now(),
    taskType,
    businessModule: "COST_CENTER",
    businessId,
    businessKey: `${taskType}-${businessId}`,
    batchNo: `${taskType}-${Date.now()}`,
    status: "FINISHED",
    createdAt: new Date().toISOString(),
  };
}

function mapCostBomVersion(
  row: Record<string, unknown>,
  index?: number,
): CostCenter.CostBomVersionItem {
  const versionId = toCostNumber(row.id ?? row.versionId ?? row.bomVersionId);
  const rawVersion =
    row.bomVersion ?? row.versionNo ?? row.version ?? row.majorVersion;
  const versionNo = toCostNumber(rawVersion, 1);
  const rowKey = toCostText(
      row.id ??
        row.rowKey ??
        row.versionId ??
        row.bomVersionId ??
        `${row.vehicleModelId ?? ""}-${row.valveId ?? ""}-${row.bomVersion ?? row.versionNo ?? row.version ?? row.majorVersion ?? ""}-${row.createTime ?? row.updateTime ?? ""}`,
    );
  return {
    rowKey: index === undefined ? rowKey : `${rowKey}-${index}`,
    versionId,
    version: toCostNumber(row.version ?? row.bomVersion, 0),
    versionNo,
    bomVersion: toCostText(rawVersion ?? versionNo),
    recordType: toCostText(row.recordType, ""),
    status: toCostText(
      row.status ?? row.passStatus ?? row.valveStatus ?? row.gateStatus ?? "0",
    ),
    lockStatus: normalizeCostLockStatus(row.isLock ?? row.lockStatus),
    latest: String(row.isLatestVersion ?? row.latest ?? "1") !== "0",
    partCount: toCostNumber(row.partCount ?? row.count, 0),
    totalCurrentCostAmount:
      row.totalCurrentCostAmount === undefined
        ? null
        : toCostText(row.totalCurrentCostAmount),
    vehicleModelId: toCostNumber(row.vehicleModelId, 0),
    valveId: toCostNumber(row.valveId, 0),
    vehicleModelName: toCostText(row.vehicleModelName, ""),
    valveName: toCostText(row.valveName, ""),
    valveTime: toCostText(
      row.valveTime ?? row.passTime ?? row.gateTime ?? row.overGateTime,
      "",
    ),
    createBy: toCostText(row.createBy, ""),
    submittedBy: toCostNumber(row.createBy ?? row.submittedBy, 0),
    submittedByName: toCostText(row.createBy ?? row.submittedByName, ""),
    createTime: toCostText(row.createTime ?? row.createdAt, ""),
    submittedAt: toCostText(row.createTime ?? row.submittedAt, ""),
    updatedBy: toCostNumber(row.updateBy ?? row.updatedBy, 0),
    updatedByName: toCostText(row.updateBy ?? row.updatedByName, ""),
    updatedAt: toCostText(row.updateTime ?? row.updatedAt, ""),
  };
}

function mapCostBomGenerateVersion(
  row: Record<string, unknown>,
  projectId: number,
): CostCenter.CostBomGenerateVersionItem {
  const versionId = toCostNumber(
    row.id ?? row.costBomVersionId ?? row.bomVersionId,
  );
  return {
    generateVersionId: toCostNumber(row.generateVersionId ?? row.id),
    costBomVersionId: versionId,
    projectId: toCostNumber(row.projectId, projectId),
    vehicleModelId: toCostNumber(row.vehicleModelId ?? row.modelId, 0),
    valveId: toCostNumber(row.valveId, 0),
    vehicleModelName: toCostText(row.vehicleModelName, ""),
    valveName: toCostText(row.valveName, ""),
    version: toCostText(row.version, ""),
    bomVersion: toCostText(row.bomVersion, ""),
    versionName: toCostText(row.versionName ?? row.name ?? `版本${versionId}`),
    recordType: toCostText(row.recordType ?? "HISTORY"),
    latest: String(row.isLatestVersion ?? row.latest ?? "1") !== "0",
    lockStatus: normalizeCostLockStatus(row.isLock ?? row.lockStatus),
    valveStatus: toCostText(
      row.status ?? row.passStatus ?? row.valveStatus ?? row.gateStatus,
      "",
    ),
    valveTime: toCostText(
      row.valveTime ?? row.passTime ?? row.gateTime ?? row.overGateTime,
      "",
    ),
    createBy: toCostText(row.createBy, ""),
    updateBy: toCostText(row.updateBy, ""),
    createdAt: toCostText(row.createTime ?? row.createdAt, ""),
    updatedAt: toCostText(row.updateTime ?? row.updatedAt, ""),
  };
}

function normalizeCostLockStatus(value: unknown) {
  if (value === 1 || value === "1" || value === true || value === "LOCKED") {
    return "LOCKED";
  }
  return "UNLOCKED";
}

function mapCostBomPart(
  row: Record<string, unknown>,
): CostCenter.CostBomPartItem {
  return {
    ...(row as Partial<CostCenter.CostBomPartItem>),
    partIdText: toCostText(row.id ?? row.partId, ""),
    partId: (row.id ?? row.partId) as string | number,
    parentId: (row.parentId ?? row.parentCode ?? null) as
      | number
      | string
      | null,
    version: toCostNumber(row.version, 0),
    partVersion: toCostText(row.partVersion ?? row.part_version, ""),
    partNo: toCostText(
      row.partNo ?? row.partNumber ?? row.partCode ?? row.code,
    ),
    partNumber: toCostText(
      row.partNumber ?? row.partNo ?? row.partCode ?? row.code,
      "",
    ),
    rawPartNumber: toCostText(row.partNumber ?? row.partNo, ""),
    partName: toCostText(row.partName ?? row.name),
    vehicleModelId: toCostNumber(row.vehicleModelId, 0),
    valveId: toCostNumber(row.valveId, 0),
    sorId: toCostNumber(row.sorId, 0),
    sorCode: toCostText(row.sorCode ?? row.sorNumber, ""),
    sorName: toCostText(row.sorName, ""),
    quantity: toCostText(row.quantity ?? row.pathQuantity, ""),
    unit: toCostText(row.unitUsage ?? row.unit ?? row.unitCode, ""),
    currentCostAmount: toCostText(row.currentCostAmount ?? row.costAmount, ""),
    targetCostAmount: toCostText(row.targetCostAmount ?? row.targetValue, ""),
    estimatedCostAmount: toCostText(
      row.estimatedCostAmount ?? row.initialEvaluationValue,
      "",
    ),
    supplierName: toCostText(row.supplierName ?? row.supplier, ""),
    architectureComponent: toCostText(
      row.architectureComponent ?? row.isArchitectureComponent,
      "",
    ),
    isArchitectureComponent: toCostText(
      row.isArchitectureComponent ?? row.architectureComponent,
      "",
    ),
    costCategoryLevel2Name: toCostText(
      row.costCategoryLevel2Name ??
        row.costCategoryLevel2 ??
        row.secondClassification,
      "",
    ),
    costCategoryLevel3Name: toCostText(
      row.costCategoryLevel3Name ??
        row.costCategoryLevel3 ??
        row.threeClassification,
      "",
    ),
    costEngineerName: toCostText(row.costEngineerName ?? row.costEngineer, ""),
    procurementEngineerName: toCostText(
      row.procurementEngineerName ?? row.procurementEngineer,
      "",
    ),
  };
}

function costBomPartColumns(): CostCenter.CostBomPartMetadata["columns"] {
  return [
    {
      field: "partNo",
      title: "零件号",
      groupName: "基础信息",
      dataType: "TEXT",
      defaultVisible: true,
      filterable: true,
    },
    {
      field: "partName",
      title: "零件名称",
      groupName: "基础信息",
      dataType: "TEXT",
      defaultVisible: true,
      filterable: true,
    },
    {
      field: "sorName",
      title: "SOR",
      groupName: "基础信息",
      dataType: "TEXT",
      defaultVisible: true,
      filterable: true,
    },
    {
      field: "quantity",
      title: "数量",
      groupName: "成本信息",
      dataType: "NUMBER",
      defaultVisible: true,
      filterable: true,
    },
    {
      field: "targetCostAmount",
      title: "目标成本",
      groupName: "成本信息",
      dataType: "MONEY",
      defaultVisible: true,
      filterable: true,
    },
    {
      field: "currentCostAmount",
      title: "当前成本",
      groupName: "成本信息",
      dataType: "MONEY",
      defaultVisible: true,
      filterable: true,
    },
  ];
}

export function fetchCostQueryPrices(params: QueryParams) {
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/sync/srm/cost/list",
    method: "get",
    params: {
      ...params,
      pageNum: params.pageNo ?? params.pageNum,
    },
  }).then((response) =>
    toCostPage<CostCenter.CostQueryPriceItem>(
      response,
      (row) => ({
        priceId: toCostNumber(row.id ?? row.priceId),
        sourceType: toCostText(row.sourceType ?? "TARGET_PRICE"),
        partNo: toCostText(row.partNo ?? row.partCode),
        partName: toCostText(row.partName),
        projectNo: toCostText(row.projectNo),
        factoryCode: toCostText(row.factoryCode),
        factoryName: toCostText(row.factoryName),
        supplierCode: toCostText(row.supplierCode),
        supplierName: toCostText(
          row.supplierChName ?? row.supplierName ?? row.supplier,
        ),
        priceFlag: toCostText(row.priceFlag),
        productServiceFlag: toCostText(row.productServiceFlag),
        excludeTaxPrice: toCostText(row.excludeTaxPrice ?? row.targetPrice),
        noAmortizePrice: toCostText(row.noAmortizePrice),
        amortizePrice: toCostText(row.amortizePrice),
        supplierRatio: toCostText(row.supplierRatio),
        wrapCost: toCostText(row.wrapCost),
        freightCost: toCostText(row.freightCost),
        measureUnitName: toCostText(row.unitName ?? row.measureUnitName),
        priceUnitName: toCostText(row.priceUnitName),
        conversionCoefficient: toCostText(row.conversionCoefficient),
        purchase: toCostText(row.purchase),
        effectiveStartAt: toCostText(row.eftDate ?? row.effectiveStartAt),
        effectiveEndAt: toCostText(row.expDate ?? row.effectiveEndAt),
        transmitAt: toCostText(
          row.transmitDate ?? row.createTime ?? row.transmitAt,
        ),
      }),
      params,
    ),
  );
}

export function createCostQueryExportTask(
  params: QueryParams,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/sync/srm/cost/export/task",
    method: "post",
    data: params,
    headers: {
      "Idempotency-Key": createIdempotencyKey("cost-query-export"),
    },
  });
}

export function fetchCostBomGenerateVersions(
  projectId: number,
  params: QueryParams,
) {
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/version/bom/generateVersion/list",
    method: "get",
    params: {
      ...params,
      pageNum: params.pageNo ?? params.pageNum,
    },
  }).then((response) => {
    const page = toCostPage<CostCenter.CostBomGenerateVersionItem>(
      response,
      (row) => mapCostBomGenerateVersion(row, projectId),
      params,
    );
    return { ...page, projectId };
  });
}

export function fetchCostBomVersions(projectId: number, params: QueryParams) {
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/version/bom/list",
    method: "get",
    params: {
      ...params,
      pageNum: params.pageNo ?? params.pageNum,
    },
  }).then((response) => {
    const page = toCostPage<CostCenter.CostBomVersionItem>(
      response,
      mapCostBomVersion,
      params,
    );
    return {
      projectId,
      pageNo: page.pageNo,
      pageSize: page.pageSize,
      total: resolveServerTotal(page.total),
      hasNext: page.hasNext,
      versions: page.records,
    };
  });
}

export function fetchCostBomVersionHistories(
  bomVersionId: number,
  params: QueryParams,
) {
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/version/bom/historyList",
    method: "get",
    params: {
      ...params,
      pageNum: params.pageNo ?? params.pageNum,
      bomVersionId,
    },
  }).then((response) => {
    const page = toCostPage<CostCenter.CostBomVersionItem>(
      response,
      mapCostBomVersion,
      params,
    );
    return {
      bomVersionId,
      pageNo: page.pageNo,
      pageSize: page.pageSize,
      total: resolveServerTotal(page.total),
      hasNext: page.hasNext,
      versions: page.records,
    };
  });
}

/** 覆盖导入成本 BOM 历史版本数据。 */
export function overwriteCostBomVersionHistoryImport(data: FormData) {
  return request<unknown>({
    url: "/system/version/bom/history/overwriteImport",
    method: "post",
    data,
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function fetchCostBomVersionDiff(params: {
  bomVersionId: number;
  oldBomVersion: string | number;
  diffBomVersion: string | number;
  vehicleModelId?: number | string | null;
  valveId?: number | string | null;
}) {
  return request<Record<string, unknown>>({
    url: "/system/version/bom/diffVersion",
    method: "post",
    data: params,
  });
}

export function fetchCostBomPartCompareDetail(params: {
  oldId: number | string;
  diffId: number | string;
  bomVersionId: number | string;
  oldBomVersion: string | number;
  diffBomVersion: string | number;
  vehicleModelId?: number | string | null;
  valveId?: number | string | null;
  partName?: string | null;
  partNumber?: string | null;
}) {
  return request<Record<string, unknown>>({
    url: "/system/bom/comparePartDetail",
    method: "post",
    data: params,
  });
}

export function fetchCostBomParts(
  projectId: number,
  versionId: number,
  params: QueryParams,
  options?: { skipErrorToast?: boolean },
) {
  const query = { ...params };
  delete query.advancedConditions;
  delete query.conditions;
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/bom/newlist",
    method: "post",
    data: {
      ...query,
      pageNum: params.pageNo ?? params.pageNum,
      bomVersionId: versionId,
      version: params.version,
      advancedConditions: parseCostBomAdvancedConditions(params),
    },
    skipErrorToast: options?.skipErrorToast,
  }).then((response) => {
    const page = toCostPage<CostCenter.CostBomPartItem>(
      response,
      mapCostBomPart,
      params,
    );
    return {
      versionId,
      projectId,
      pageNo: page.pageNo,
      pageSize: page.pageSize,
      total: resolveServerTotal(page.total),
      hasNext: page.hasNext,
      records: page.records,
      parts: page.records,
    };
  });
}

export function fetchCostBomPart(partId: number | string) {
  return request<Record<string, unknown>>({
    url: `/system/bom/${partId}`,
    method: "get",
  }).then((response) => mapCostBomPart(response));
}

export function fetchCostBomPartDetail(partId: number | string) {
  return request<Record<string, unknown>>({
    url: `/system/bom/new/${partId}`,
    method: "get",
  }).then((response) => mapCostBomPart(response));
}

export function fetchCostBomPartPatterns(
  versionId: number,
  version?: number | string,
): Promise<CostCenter.CostBomPartPatternItem[]> {
  return request<Record<string, unknown>[]>({
    url: "/system/bom/newPatterns",
    method: "get",
    params: {
      bomVersionId: versionId,
      version: version || undefined,
    },
  }).then((response) =>
    (Array.isArray(response) ? response : []).map((item) => ({
      ...(item as Partial<CostCenter.CostBomPartPatternItem>),
      patternName: toCostText(item.patternName, ""),
      usagePerVehicle: toCostText(item.usagePerVehicle, ""),
    })),
  );
}

export function fetchCostBomPartHistories(
  versionId: number,
  parentId: number | string,
  params: QueryParams,
) {
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/bom/list",
    method: "get",
    params: {
      ...params,
      pageNum: params.pageNo ?? params.pageNum,
      total: params.total ?? 0,
      bomVersionId: versionId,
      parentId,
    },
  }).then((response) => {
    const page = toCostPage<CostCenter.CostBomPartItem>(
      response,
      mapCostBomPart,
      params,
    );
    return {
      versionId,
      parentId,
      pageNo: page.pageNo,
      pageSize: page.pageSize,
      total: resolveServerTotal(page.total),
      hasNext: page.hasNext,
      records: page.records,
      parts: page.records,
    };
  });
}

export function fetchCostBomPartMetadata(
  projectId: number,
  versionId: number,
  options?: { skipErrorToast?: boolean; version?: number | string },
): Promise<CostCenter.CostBomPartMetadata> {
  return request<Record<string, unknown>[]>({
    url: "/system/bom/tableHeader",
    method: "get",
    params: {
      bomVersionId: versionId,
      version: options?.version || undefined,
    },
    skipErrorToast: options?.skipErrorToast,
  }).then((headers) => {
    const fallback = costBomPartColumns();
    const headerRows = Array.isArray(headers) ? headers : [];
    const usagePatternNames = Array.from(
      new Set(
        headerRows
          .map((header) => toCostText(header.patternName))
          .filter((patternName) => Boolean(patternName)),
      ),
    );
    const columnHeaders = headerRows.filter(
      (header) => header.field != null || header.prop != null,
    );
    const columns: CostCenter.CostBomPartColumn[] = columnHeaders.length
      ? columnHeaders.map((header) => ({
          field: toCostText(
            header.field ?? header.prop,
          ) as keyof CostCenter.CostBomPartItem,
          title: toCostText(header.title ?? header.label),
          groupName: toCostText(header.groupName),
          dataType: toCostText(header.dataType, "TEXT"),
          defaultVisible: header.defaultVisible !== false,
          filterable: header.filterable !== false,
        }))
      : fallback;
    return {
      projectId,
      versionId,
      columns,
      filterableFields: columns
        .filter((column) => column.filterable)
        .map((column) => column.field),
      usagePatternNames,
      patternHeaders: headerRows
        .map((header) => ({
          patternName: toCostText(header.patternName),
          reorganizeName: toCostText(header.reorganizeName, ""),
          reorganizePartCount: toCostNumber(header.reorganizePartCount, 0),
          reorganizeSyncTime: toCostText(header.reorganizeSyncTime, ""),
        }))
        .filter((header) => Boolean(header.patternName)),
    };
  });
}

export function fetchCostBomFilterFields(
  projectId: number,
): Promise<CostCenter.CostBomFilterFields> {
  // 该接口返回原始筛选配置，不符合统一 code/data 响应封装。
  return httpClient
    .request<unknown>({
      url: "/system/bom/filter/fields",
      method: "get",
      params: { vehicleModelId: projectId },
    })
    .then((response) => response.data as CostCenter.CostBomFilterFields);
}

export function fetchCostBomAnalysisCategories(
  projectId: number,
  versionId: number,
  params: QueryParams,
) {
  return request<
    Record<string, unknown>[] | { data?: Record<string, unknown>[] }
  >({
    url: "/system/analysis/getList",
    method: "post",
    data: {
      projectPatternVoList: params.projectPatternVoList,
      costBomCategoryList: params.costBomCategoryList,
      valveId: params.valveId,
    },
  }).then((response) => {
    const rows = Array.isArray(response) ? response : (response.data ?? []);
    const requestedLevel =
      params.categoryLevel === undefined
        ? undefined
        : toCostNumber(params.categoryLevel, 0);
    const categorySources =
      requestedLevel === undefined
        ? [
            { level: 2, field: "analysisCategoryVoList" },
            { level: 3, field: "costBomCategoryVoList" },
          ]
        : [
            {
              level: requestedLevel,
              field:
                requestedLevel === 2
                  ? "analysisCategoryVoList"
                  : "costBomCategoryVoList",
            },
          ];
    const merged = new Map<string, CostCenter.CostBomAnalysisCategoryItem>();

    for (const row of rows) {
      for (const { level, field } of categorySources) {
        const categories = Array.isArray(row[field])
          ? (row[field] as Record<string, unknown>[])
          : [];
        for (const category of categories) {
          const vehicleModelId = toCostNumber(
            row.vehicleModelId ?? row.projectId,
            0,
          );
          const patternId = toCostNumber(
            row.patternId ?? row.projectPatternId,
            0,
          );
          const categoryId = toCostNumber(
            category.categoryId ?? category.id,
            0,
          );
          const categoryName = toCostText(category.categoryName);
          const key = `${vehicleModelId}:${patternId}:${level}:${categoryId}:${categoryName}`;
          const record = merged.get(key) ?? {
            vehicleModelId,
            vehicleModelName: toCostText(
              row.vehicleModelName ?? row.projectName,
            ),
            rowType: "CATEGORY",
            patternId,
            patternCode: toCostText(row.patternCode),
            patternName: toCostText(row.patternName ?? row.projectPatternName),
            categoryLevel: level,
            categoryId,
            categoryCode: toCostText(category.categoryCode),
            categoryName,
            targetCostAmount: "",
            currentCostAmount: "",
            partCount: 0,
          };
          const amount = toCostText(category.cost ?? category.Cost);
          if (row.type === "当前成本") {
            record.currentCostAmount = amount;
          } else if (row.type === "目标成本") {
            record.targetCostAmount = amount;
          }
          merged.set(key, record);
        }
      }
    }

    return {
      projectId,
      versionId,
      valveId: toCostNumber(params.valveId, 0),
      records: [...merged.values()],
    };
  });
}

export function createCostBomAnalysisExportTask(
  projectId: number,
  versionId: number,
  params: QueryParams,
): Promise<TaskCenterTaskResponse> {
  void projectId;
  void versionId;
  return request<TaskCenterTaskResponse>({
    url: "/system/analysis/export/task",
    method: "post",
    data: {
      projectPatternVoList: params.projectPatternVoList,
      costBomCategoryList: params.costBomCategoryList,
      valveId: params.valveId,
    },
    headers: {
      "Idempotency-Key": createIdempotencyKey("cost-analysis-export"),
    },
  });
}

export function createCostBomPriceRefreshTask(
  projectId: number,
  versionId: number,
) {
  return request<void>({
    url: "/system/sync/srmx/compPrice/syncBidPriceToCostBom",
    method: "get",
    params: { projectId, costBomVersionId: versionId },
  }).then(() => createCostTask("COST_BOM_PRICE_REFRESH", versionId));
}

export function createCostBomExtendCalculationTask(
  projectId: number,
  versionId: number,
  version?: number | string,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/bom/calculateExtend/task",
    method: "post",
    data: definedFields({
      id: versionId,
      vehicleModelId: projectId,
      version: version === undefined ? undefined : String(version),
    }),
    headers: { "Idempotency-Key": createIdempotencyKey("cost-bom") },
  });
}

export function fetchCostAnalysisProjects(): Promise<
  CostAnalysisProjectItem[]
> {
  return request<Record<string, unknown>[]>({
    url: "/system/analysis/getProjectName",
    method: "get",
  }).then((rows) =>
    rows.map(
      (row) =>
        ({
          projectId: toCostNumber(row.projectId ?? row.id),
          projectCode: toCostText(row.projectCode ?? row.wbsNumber),
          projectName: toCostText(row.projectName ?? row.name),
          status: "ENABLED",
          version: 0,
          patternList: (Array.isArray(row.patternList)
            ? (row.patternList as Record<string, unknown>[])
            : []
          ).map((pattern) => ({
            id: toCostNumber(pattern.id),
            patternName: toCostText(pattern.patternName ?? pattern.name),
            ...((pattern.patternNumber ?? pattern.patternCode)
              ? {
                  patternNumber: toCostText(
                    pattern.patternNumber ?? pattern.patternCode,
                  ),
                }
              : {}),
          })),
        }) as CostAnalysisProjectItem,
    ),
  );
}

export function fetchCostAnalysisValveOptions(): Promise<{
  records: BusinessValveItem[];
  total: number;
}> {
  return request<Record<string, unknown>[]>({
    url: "/system/analysis/getValveList",
    method: "get",
  }).then((rows) => ({
    records: rows.map((row) => ({
      valveId: toCostNumber(row.id),
      valveCode: toCostText(row.id ?? row.sort),
      valveName: toCostText(row.valveName),
      sortNo: toCostNumber(row.sort, 0),
      status: "ENABLED",
      remark: toCostText(row.remark) || null,
      createdAt: toCostText(row.createTime) || null,
      version: 0,
    })),
    total: rows.length,
  }));
}

export function fetchCostAnalysisCategoryOptions(): Promise<
  CostBomCategoryItem[]
> {
  return request<
    | Record<string, unknown>[]
    | {
        department?: Record<string, unknown>[];
        category?: Record<string, unknown>[];
      }
  >({
    url: "/system/analysis/getCategoryList",
    method: "get",
  }).then((response) => {
    const flatten = (
      items: Record<string, unknown>[],
      level = 1,
      parentId: string | number = 0,
    ): CostBomCategoryItem[] =>
      items.flatMap((row) => {
        const id = toCostNumber(row.categoryId ?? row.id);
        const item: CostBomCategoryItem = {
          categoryId: id,
          parentId: toCostNumber(
            row.parentId ?? row.parentCode,
            Number(parentId),
          ),
          categoryCode: toCostText(row.categoryCode ?? row.code),
          categoryName: toCostText(row.categoryName ?? row.name),
          categoryLevel: toCostNumber(row.categoryLevel ?? row.level, level),
          sortNo: toCostNumber(row.sortNo ?? row.sort, 0),
          status: "ENABLED",
          remark: null,
          version: 0,
        };
        const children = Array.isArray(row.children)
          ? (row.children as Record<string, unknown>[])
          : [];
        return [item, ...flatten(children, level + 1, id)];
      });
    const rows = Array.isArray(response)
      ? response
      : [
          ...(Array.isArray(response.department) ? response.department : []),
          ...(Array.isArray(response.category) ? response.category : []),
        ];
    return flatten(rows);
  });
}

export async function createCostBomExport(
  projectId: number | undefined,
  payload: {
    versionId: number;
    version?: number | string;
    format?: "xlsx" | string;
    versionIds?: Array<number | string>;
    parts?: Array<Partial<CostCenter.CostBomPartItem>>;
  },
): Promise<TaskCenterTaskResponse> {
  void payload.format;
  const selectedPartQueries: Array<Record<string, unknown>> | undefined = payload.parts
    ?.map((part) => {
      const id = part.partIdText || part.partId;
      return id
        ? {
            id,
            vehicleModelId: projectId,
            bomVersionId: payload.versionId,
            version: payload.version,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const versionIds =
    payload.versionIds && payload.versionIds.length
      ? payload.versionIds
      : [payload.versionId];
  const queries =
    selectedPartQueries && selectedPartQueries.length
      ? selectedPartQueries
      : versionIds.map((versionId) => ({
          vehicleModelId: projectId,
          bomVersionId: versionId,
          version: payload.version,
        }));
  return request<TaskCenterTaskResponse>({
    url: "/system/bom/export/task",
    method: "post",
    data: queries,
    headers: { "Idempotency-Key": createIdempotencyKey("cost-export") },
  });
}

export function saveCostBomParts(
  projectId: number,
  versionId: number,
  payload: {
    parts: CostCenter.CostBomPartSaveItem[];
    generateWeightedPattern?: boolean;
  },
): Promise<CostCenter.CostBomPartSaveResult> {
  return request<void>({
    url: "/system/bom",
    method: "put",
    data: {
      vehicleModelId: projectId,
      bomVersionId: versionId,
      parts: payload.parts,
    },
  }).then(() => ({
    versionId,
    projectId,
    versionNo: 1,
    status: "SAVED",
    partCount: payload.parts.length,
    updatedAt: new Date().toISOString(),
  }));
}

type CostBomPartWriteContext = {
  bomVersionId: number | string;
  vehicleModelId?: number | string | null;
  fallbackVehicleModelId?: number | string | null;
  vehicleModelName?: string | null;
  valveId?: number | string | null;
  valveName?: string | null;
  version?: number | string | null;
  projectName?: string | null;
};

const copyCostBomPatternOmitKeys = [
  "id",
  "costBomId",
  "targetCost",
  "currentCost",
  "currentCostAmortize",
  "currentPackageCost",
  "currentFreightCost",
];

function readPartField(
  source: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function compactPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as T;
}

function normalizePartPatterns(
  source: Record<string, unknown>,
  options?: { copy?: boolean },
): CostCenter.CostBomPartPatternItem[] | undefined {
  const patterns = readPartField(source, "costBomPattern", "patterns");
  if (!Array.isArray(patterns)) {
    return undefined;
  }
  return patterns.map((pattern) => {
    const payload = {
      ...(pattern as CostCenter.CostBomPartPatternItem),
    };
    if (options?.copy) {
      copyCostBomPatternOmitKeys.forEach((key) => {
        delete payload[key];
      });
    }
    return payload;
  });
}

const frontendPartAliasKeys = [
  "partId",
  "partIdText",
  "partNo",
  "sorCode",
  "quantity",
  "unit",
  "architectureComponent",
  "costCategoryLevel2Name",
  "costCategoryLevel3Name",
  "costEngineerName",
  "procurementEngineerName",
  "patterns",
];

export function toCostBomPartWritePayload(
  source: Partial<CostCenter.CostBomPartItem> &
    Partial<CostCenter.CostBomPartSaveItem> &
    Record<string, unknown>,
  context: CostBomPartWriteContext,
  options?: { copy?: boolean; includeId?: boolean },
): CostCenter.CostBomPartWritePayload {
  const patterns = normalizePartPatterns(source, options);
  const legacyPayload = options?.includeId
    ? ({ ...source } as Record<string, unknown>)
    : {};
  frontendPartAliasKeys.forEach((key) => {
    delete legacyPayload[key];
  });
  return compactPayload({
    ...legacyPayload,
    id: options?.includeId
      ? readPartField(source, "id", "partIdText", "partId", "costBomId")
      : undefined,
    bomVersionId: context.bomVersionId,
    vehicleModelId:
      context.vehicleModelId || context.fallbackVehicleModelId || undefined,
    vehicleModelName: context.vehicleModelName || undefined,
    valveId: context.valveId || undefined,
    valveName: context.valveName || undefined,
    version: context.version || undefined,
    projectName: context.projectName || undefined,
    factoryCode: readPartField(source, "factoryCode"),
    partNumber: readPartField(source, "partNo", "partNumber"),
    partName: readPartField(source, "partName"),
    sorNumber: readPartField(source, "sorCode", "sorNumber"),
    sorName: readPartField(source, "sorName"),
    ecrNumber: readPartField(source, "ecrNumber"),
    ecrName: readPartField(source, "ecrName"),
    iaNumber: readPartField(source, "iaNumber"),
    iaName: readPartField(source, "iaName"),
    assemblyLevel: readPartField(source, "assemblyLevel"),
    partTechDesc: readPartField(source, "partTechDesc"),
    unitUsage: readPartField(source, "unit", "quantity", "unitUsage"),
    moduleIdentifier: readPartField(source, "moduleIdentifier"),
    firstVehicleModel: readPartField(source, "firstVehicleModel"),
    quotaSrm: readPartField(source, "quotaSrm"),
    supplierName: readPartField(source, "supplierName"),
    generalizationLevel: readPartField(source, "generalizationLevel"),
    isArchitectureComponent: readPartField(
      source,
      "architectureComponent",
      "isArchitectureComponent",
    ),
    suggestedSupplySource: readPartField(source, "suggestedSupplySource"),
    sourceDescription: readPartField(source, "sourceDescription"),
    multiStructuredSupplySources: readPartField(
      source,
      "multiStructuredSupplySources",
    ),
    multiSourcesDescription: readPartField(source, "multiSourcesDescription"),
    developmentDepartment: readPartField(source, "developmentDepartment"),
    expertEngineer: readPartField(source, "expertEngineer"),
    firstClassification: readPartField(source, "firstClassification"),
    secondClassification: readPartField(
      source,
      "costCategoryLevel2Name",
      "secondClassification",
    ),
    threeClassification: readPartField(
      source,
      "costCategoryLevel3Name",
      "threeClassification",
    ),
    costEngineer: readPartField(source, "costEngineerName", "costEngineer"),
    procurementEngineer: readPartField(
      source,
      "procurementEngineerName",
      "procurementEngineer",
    ),
    partAttribute: readPartField(source, "partAttribute"),
    targetValue: readPartField(source, "targetValue"),
    targetRemark: readPartField(source, "targetRemark"),
    initialEvaluationValue: readPartField(source, "initialEvaluationValue"),
    costBomPattern: patterns,
  }) as CostCenter.CostBomPartWritePayload;
}

export function createCostBomPart(payload: CostCenter.CostBomPartWritePayload) {
  return request<void>({
    url: "/system/bom",
    method: "post",
    data: payload,
  });
}

export function updateCostBomPart(
  payload: CostCenter.CostBomPartWritePayload,
  scope: CostCenter.CostBomPartEditScope,
) {
  const urlMap: Record<CostCenter.CostBomPartEditScope, string> = {
    profit: "/system/bom/editProfitBom",
    design: "/system/bom/editDesignBom",
    admin: "/system/bom",
  };
  return request<void>({
    url: urlMap[scope],
    method: "put",
    data: payload,
  });
}

export async function createCostBomImportTemplate(
  projectId: number,
): Promise<CostCenter.CostBomImportTemplate> {
  void projectId;
  const response = await httpClient.request<Blob>({
    url: "/system/version/bom/downloadTemplate",
    method: "post",
    responseType: "blob",
  });
  return {
    templateVersion: "COST_BOM_HISTORY_IMPORT_V1",
    fileName: "成本BOM导入模板.xlsx",
    fileId: URL.createObjectURL(response.data),
    fileSize: response.data.size,
    sha256: "",
  };
}

export async function importProjectCostBomData(payload: {
  file: File;
  valveId: number | string;
}): Promise<TaskCenterTaskResponse> {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("valveId", String(payload.valveId));
  return request<TaskCenterTaskResponse>({
    url: "/system/costHistory/bom/importData/task",
    method: "post",
    data: formData,
    headers: { "Idempotency-Key": createIdempotencyKey("cost-import") },
  });
}

export function submitCostBomVersion(
  projectId: number,
  versionId: number,
  payload: { submitRemark?: string; version: number | string },
) {
  void projectId;
  return request<unknown>({
    url: "/system/bom/addCostBomVersion",
    method: "post",
    data: {
      bomVersionId: versionId,
      version: String(payload.version),
    },
  }).then(() =>
    mapCostBomVersion({
      id: versionId,
      version: payload.version,
      vehicleModelId: projectId,
    }),
  );
}

export function useCostBomVersion(
  projectId: number,
  versionId: number,
  payload?: {
    projectId?: number | string | null;
    targetVersionNo?: number | string | null;
    vehicleModelId?: number | string | null;
    valveId?: number | string | null;
  },
) {
  return request<void>({
    url: "/system/version/bom/useVersion",
    method: "post",
    data: payload
      ? {
          projectId: payload.projectId,
          targetVersionNo: payload.targetVersionNo,
          vehicleModelId: payload.vehicleModelId,
          valveId: payload.valveId,
        }
      : { projectId, versionId },
  }).then(() =>
    mapCostBomVersion({
      id: versionId,
      vehicleModelId: projectId,
      isLatestVersion: 1,
    }),
  );
}

export function recalculateCostBomVersion(
  projectId: number,
  versionId: number,
) {
  return request<number>({
    url: "/system/bom/calculateExtend",
    method: "post",
    data: { id: versionId, vehicleModelId: projectId },
  }).then(() => mapCostBomVersion({ id: versionId, status: "RECALCULATED" }));
}

export function copyCostBomValveData(
  vehicleModelId: number,
  versionId: number,
  payload: {
    sourceVersionId?: number;
    sourceValveId?: number;
    targetValveId?: number;
    targetValveCode?: string;
    targetValveName?: string;
  },
): Promise<CostCenter.CostBomValveDataCopyResult> {
  void versionId;
  return request<void>({
    url: "/system/version/bom/copyValveData",
    method: "post",
    data: {
      vehicleModelId,
      sourceValveId: payload.sourceValveId,
      targetValveId: payload.targetValveId,
    },
  }).then(() => ({
    sourceVersionId: payload.sourceVersionId ?? null,
    targetVersionId: versionId,
    projectId: vehicleModelId,
    copiedPartCount: 0,
    copiedPatternCount: 0,
    targetPartCount: 0,
    updatedAt: new Date().toISOString(),
  }));
}

export function deleteCostBomVersion(
  projectId: number,
  versionId: number,
  version: number,
): Promise<CostCenter.CostBomVersionDeleteResult> {
  void version;
  return request<void>({
    url: `/system/version/bom/${versionId}`,
    method: "delete",
  }).then(() => ({
    versionId,
    projectId,
    deleted: true,
    deletedBy: 0,
    deletedAt: new Date().toISOString(),
  }));
}

export function updateCostBomVersionLockStatus(
  projectId: number,
  versionId: number,
  locked: boolean,
): Promise<CostCenter.CostBomVersionLockResult> {
  return request<void>({
    url: "/system/version/bom",
    method: "put",
    data: { id: versionId, isLock: locked ? 1 : 0 },
  }).then(() => ({
    versionId,
    projectId,
    versionNo: 1,
    lockStatus: locked ? "LOCKED" : "UNLOCKED",
    updatedAt: new Date().toISOString(),
  }));
}

export function updateCostBomVersionGateStatus(
  projectId: number,
  versionId: number,
  status: CostCenter.CostBomVersionGateStatus,
): Promise<CostCenter.CostBomVersionGateStatusResult> {
  return request<void>({
    url: "/system/version/bom",
    method: "put",
    data: { id: versionId, status },
  }).then(() => ({
    versionId,
    projectId,
    versionNo: 1,
    status,
    updatedAt: new Date().toISOString(),
  }));
}

export function deleteCostBomPart(
  projectId: number,
  versionId: number,
  partId: number | string,
  version: number,
): Promise<CostCenter.CostBomPartDeleteResult> {
  void version;
  return request<void>({
    url: `/system/bom/${partId}`,
    method: "delete",
    params: { costBomVersionId: versionId },
  }).then(() => ({
    versionId,
    projectId,
    partId,
    remainingPartCount: 0,
    deletedBy: 0,
    deletedAt: new Date().toISOString(),
  }));
}

export function fetchPurchaseBoms(params: QueryParams) {
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/purchaseBom/list",
    method: "get",
    params: {
      total: params.total ?? 0,
      projectName: params.projectName,
      costBomStatus: params.costBomStatus,
      startTime: params.startTime ?? params.createdAtStart,
      endTime: params.endTime ?? params.createdAtEnd,
      pageNum: params.pageNum ?? params.pageNo,
      pageSize: params.pageSize,
    },
  }).then((response) =>
    toCostPage<CostCenter.PurchaseBomItem>(
      response,
      (row) => ({
        purchaseBomId: toCostNumber(row.id ?? row.purchaseBomId),
        projectId: toCostNumber(row.projectId),
        projectName: toCostText(row.projectName),
        projectNumber: toCostText(row.projectNumber ?? row.projectNo),
        createdBy: toCostNumber(row.createdBy, 0),
        createBy: toCostText(row.creator ?? row.createBy),
        createdAt: toCostText(row.createTime),
        reorganizeCount: toCostNumber(row.reorganizeCount, 0),
        costBomStatus: toCostText(row.costBomStatus ?? row.status),
        valveId: toCostNumber(row.valveId, 0),
        remark: toCostText(row.remark),
        patterns: Array.isArray(row.reorganizePatternListObj)
          ? (row.reorganizePatternListObj as CostCenter.PurchaseBomReorganizePatternItem[])
          : null,
        updatedByName: toCostText(row.updater ?? row.updateBy),
        updatedAt: toCostText(row.updateTime),
        version: toCostNumber(row.version, 0),
      }),
      params,
    ),
  );
}

export function fetchPurchaseBomDetail(
  _projectId: number,
  purchaseBomId: number,
): Promise<CostCenter.PurchaseBomDetail | null> {
  return request<Record<string, unknown>>({
    url: `/system/purchaseBom/${purchaseBomId}`,
    method: "get",
  }).then((row) => {
    if (!row) {
      return null;
    }
    return {
      purchaseBomId: toCostNumber(row.id ?? row.purchaseBomId),
      projectId: toCostNumber(row.projectId),
      projectName: toCostText(row.projectName),
      reorganizeCount: toCostNumber(row.reorganizeCount, 0),
      costBomStatus: toCostText(row.costBomStatus ?? row.status),
      version: toCostNumber(row.version, 0),
      createdAt: toCostText(row.createTime),
      updatedAt: toCostText(row.updateTime),
    };
  });
}

export function fetchPurchaseBomReorganizePatterns(
  projectId: number,
  purchaseBomId: number,
  params: QueryParams,
) {
  const requestParams = {
    total: params.total ?? 0,
    projectId,
    valveId: params.valveId ?? 0,
    pageSize: params.pageSize,
    pageNum: params.pageNo ?? params.pageNum,
    reorganizeCode: params.reorganizeCode,
    reorganizeName: params.reorganizeName,
    is12or18Reorganize: params.reorganizeType,
    startTime: params.createdAtStart ?? params.startTime,
    endTime: params.createdAtEnd ?? params.endTime,
  };

  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/reorganize/list",
    method: "get",
    params: Object.fromEntries(
      Object.entries(requestParams).filter(([, value]) => value !== undefined),
    ),
  }).then((response) =>
    toCostPage<CostCenter.PurchaseBomReorganizePatternItem>(
      response,
      (row) => {
        const patterns = Array.isArray(row.patternList)
          ? (row.patternList as Record<string, unknown>[])
          : [];
        const pattern = patterns[0] ?? {};
        return {
          relationId: toCostNumber(row.id ?? row.reorganizeId),
          purchaseBomId,
          projectId: toCostNumber(row.projectId, projectId),
          reorganizeCode: toCostText(row.reorganizeCode),
          reorganizeName: toCostText(row.reorganizeName),
          plant: toCostText(row.plant),
          patternId: toCostNumber(
            row.patternId ?? pattern.patternId ?? pattern.id,
          ),
          patternCode: toCostText(
            row.patternCode ?? pattern.patternCode ?? pattern.patternNumber,
          ),
          patternName: toCostText(row.patternName ?? pattern.patternName),
          partCount: toCostNumber(row.totalPartCount ?? row.partCount),
          checked: row.isCheck === 1 || row.checked === true,
          updatedAt: toCostText(row.updateTime ?? row.createTime),
        };
      },
      params,
    ),
  );
}

export function bindPurchaseBomReorganizePattern(
  projectId: number,
  purchaseBomId: number,
  bindings: Array<{
    reorganizeCode: string;
    pattern: CostCenter.PurchaseBomReorganizePatternBindPayload | null;
  }>,
  projectName?: string,
) {
  return request<void>({
    url: "/system/reorganize/save",
    method: "post",
    headers: {
      "Idempotency-Key": createIdempotencyKey("purchase-bom-reorganize-save"),
    },
    data: {
      projectId,
      purchaseBomId,
      projectName,
      relations: bindings.map(({ reorganizeCode, pattern }) => ({
        patternId: pattern?.patternId ?? null,
        patternName: pattern?.patternName ?? null,
        reorganizeCode12: reorganizeCode.length <= 12 ? reorganizeCode : null,
        reorganizeCode18: reorganizeCode.length > 12 ? reorganizeCode : null,
      })),
    },
  });
}

export function fetchPurchaseBomSourceParts(
  projectId: number | undefined,
  purchaseBomId: number | undefined,
  params: QueryParams,
) {
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/part/list",
    method: "get",
    params: compactPayload({
      projectId,
      purchaseBomId,
      vehiclem: params.reorganizeCode,
      partNum: params.partNo,
      chDesc: params.partName,
      sorNum: params.sorName,
      pendingGeneralLevel: params.generalLevel,
      partType: params.partType,
      pageNum: params.pageNo ?? params.pageNum,
      pageSize: params.pageSize,
      startTime: params.createdAtStart ?? params.startTime,
      endTime: params.createdAtEnd ?? params.endTime,
    }),
  }).then((response) =>
    toCostPage<CostCenter.PurchaseBomSourcePartItem>(
      response,
      (row) => ({
        sourcePartId: toCostNumber(row.id ?? row.sourcePartId),
        purchaseBomId: purchaseBomId ?? 0,
        projectId: toCostNumber(row.projectId, projectId ?? 0),
        reorganizeCode: toCostText(row.vehiclem ?? params.reorganizeCode),
        partNo: toCostText(row.partNum ?? row.partNo),
        partName: toCostText(row.chDesc ?? row.partName),
        pathQuantity: toCostText(row.pathQuantity),
        unitCode: toCostText(row.unitCode),
        modelUserd1st: toCostText(row.modelUserd1st),
        sorNum: toCostText(row.sorNum),
        engineerIncharge: toCostText(row.engineerIncharge),
        sogForSug: toCostText(row.sogForSug),
        respDept: toCostText(row.respDept),
        pendingGeneralLevel: toCostText(row.pendingGeneralLevel),
        partType: toCostText(row.partType),
        ecnProcessNum: toCostText(row.ecnProcessNum),
        partCategory: toCostText(row.partCategory),
        createBy: toCostText(row.createBy ?? row.creator),
        createTime: toCostText(row.createTime ?? row.createdAt),
        updatedAt: toCostText(row.updateTime ?? row.createTime),
      }),
      params,
    ),
  );
}

export function createPurchaseBomSourcePartExportTask(
  projectId: number,
  purchaseBomId: number,
  params: QueryParams = {},
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/part/export/task",
    method: "post",
    data: compactPayload({
      projectId,
      purchaseBomId,
      projectName: params.projectName,
      vehiclem: params.reorganizeCode,
      partNum: params.partNo,
      chDesc: params.partName,
      sorNum: params.sorName,
      pendingGeneralLevel: params.generalLevel,
      partType: params.partType,
      startTime: params.createdAtStart ?? params.startTime,
      endTime: params.createdAtEnd ?? params.endTime,
    }),
    headers: {
      "Idempotency-Key": createIdempotencyKey("purchase-source-export"),
    },
  });
}

export function createPurchaseBomGenerateTask(
  projectId: number,
  purchaseBomId: number,
  payload: { version: number; valveId: number; remark?: string },
) {
  void payload;
  return request<void>({
    url: "/system/purchaseBom/proCostBom",
    method: "post",
    data: { projectId, purchaseBomId, ...payload },
  }).then(() => createCostTask("PURCHASE_BOM_GENERATE", purchaseBomId));
}

export function createPurchaseBomWorkbenchExportTask(
  projectId: number,
  purchaseBomId: number,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/purchaseBom/export/task",
    method: "post",
    data: { projectId, purchaseBomId },
    headers: {
      "Idempotency-Key": createIdempotencyKey("purchase-bom-export"),
    },
  });
}

export function fetchPurchaseBomVehicleVersions(
  projectId: number,
  reorganizeCode: string,
  params: QueryParams,
) {
  return request<Array<Record<string, unknown> | string>>({
    url: "/system/purchaseBom/vehiclemVersion",
    method: "post",
    data: compactPayload({
      projectId,
      vehiclem: reorganizeCode,
      valveId: params.valveId,
    }),
  }).then((rows) => ({
    projectId,
    reorganizeCode,
    valveId: toCostNumber(params.valveId, 0),
    versions: (Array.isArray(rows) ? rows : []).map((row, index) => {
      const source = typeof row === "object" ? row : {};
      const version =
        typeof row === "string"
          ? row
          : toCostText(source.id ?? source.costBomVersionId ?? source.version);
      return {
        costBomVersionId: version,
        versionNo: toCostNumber(source.versionNo, index + 1),
        versionName: toCostText(source.versionName, `BOM-V${version}`),
        status: toCostText(source.status),
      };
    }),
  }));
}

export function createPurchaseBomVehicleVersionExportTask(
  projectId: number,
  purchaseBomId: number,
  reorganizeCode?: string,
  params: QueryParams = {},
) {
  return request<TaskCenterTaskResponse>({
    url: "/system/purchaseBom/vehiclemVersion/export/task",
    method: "post",
    data: { projectId, purchaseBomId, vehiclem: reorganizeCode, ...params },
    headers: {
      "Idempotency-Key": createIdempotencyKey("purchase-version-export"),
    },
  });
}

export function fetchPurchaseBomDiff(
  projectId: number,
  purchaseBomId: number,
  reorganizeCode: string,
  params: QueryParams,
): Promise<CostCenter.PurchaseBomDiffPage> {
  return request<Record<string, unknown>>({
    url: "/system/purchaseBom/diffInit",
    method: "post",
    data: compactPayload({
      oldBomVersion: params.baseVersionId,
      projectId,
      reorganizeCode,
      valveId: params.valveId,
    }),
  }).then((response) => {
    const diffParts = (response.diffParts ?? {}) as Record<string, unknown>;
    const oldChanged = readTableRows<Record<string, unknown>>(
      diffParts.oldChangeParts,
    );
    const changed = readTableRows<Record<string, unknown>>(
      diffParts.changeParts,
    );
    const changedByPart = new Map(
      changed.map((part) => [toCostText(part.partNumber), part]),
    );
    const mapPart = (
      part: Record<string, unknown>,
      changeType: CostCenter.PurchaseBomDiffItem["changeType"],
      counterpart?: Record<string, unknown>,
    ): CostCenter.PurchaseBomDiffItem => ({
      partNo: toCostText(part.partNumber ?? counterpart?.partNumber),
      partName: toCostText(part.partName ?? counterpart?.partName),
      oldPartName: changeType === "ADDED" ? null : toCostText(part.partName),
      newPartName:
        changeType === "REMOVED"
          ? null
          : toCostText(counterpart?.partName ?? part.partName),
      changeType,
      oldQuantity: toCostText(part.pathQuantity),
      newQuantity: toCostText(counterpart?.pathQuantity),
      oldUnit: toCostText(part.unitCode),
      newUnit: toCostText(counterpart?.unitCode),
    });
    const records = [
      ...oldChanged.map((part) =>
        mapPart(
          part,
          "MODIFIED",
          changedByPart.get(toCostText(part.partNumber)),
        ),
      ),
      ...readTableRows<Record<string, unknown>>(diffParts.deleteParts).map(
        (part) => mapPart(part, "REMOVED"),
      ),
      ...readTableRows<Record<string, unknown>>(diffParts.addParts).map(
        (part) => mapPart(part, "ADDED", part),
      ),
    ];
    const pageNo = toCostNumber(response.pageNum, toCostNumber(params.pageNo, 1));
    const pageSize = toCostNumber(
      response.pageSize,
      toCostNumber(params.pageSize, records.length || 20),
    );
    const total = toCostNumber(response.total, records.length);
    const stats = (response.diffStats ?? {}) as Record<string, unknown>;
    return {
      projectId,
      purchaseBomId,
      reorganizeCode,
      baseVersionId: toCostText(params.baseVersionId),
      valveId: toCostNumber(params.valveId),
      oldPartCount: toCostNumber(response.oldBomSize),
      newPartCount: toCostNumber(response.diffBomSize),
      addedCount: toCostNumber(stats.addCount),
      removedCount: toCostNumber(stats.deleteCount),
      modifiedCount: toCostNumber(stats.changeCount),
      unchangedCount: 0,
      total,
      pageNo,
      pageSize,
      hasNext: pageNo * pageSize < total,
      records,
    };
  });
}

export function createPurchaseBomDiffExportTask(
  projectId: number,
  purchaseBomId: number,
  reorganizeCode: string,
  params: QueryParams,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/purchaseBom/diff/export/task",
    method: "post",
    data: compactPayload({
      projectId,
      purchaseBomId,
      reorganizeCode,
      oldBomVersion: params.baseVersionId,
      valveId: params.valveId,
      partNumber: params.partNo,
      partName: params.partName,
    }),
    headers: {
      "Idempotency-Key": createIdempotencyKey("purchase-diff-export"),
    },
  });
}

export function fetchPurchaseBomPartCompare(
  projectId: number,
  purchaseBomId: number,
  reorganizeCode: string,
  partNo: string,
  params: QueryParams,
) {
  return request<Record<string, unknown>>({
    url: "/system/purchaseBom/part/compare",
    method: "post",
    data: compactPayload({
      projectId,
      reorganizeCode,
      oldBomVersion: params.baseVersionId,
      valveId: params.valveId,
      partNumber: partNo,
    }),
  }).then((response) => {
    const rawOldPart = (response.oldVersionPart ?? null) as Record<
      string,
      unknown
    > | null;
    const rawNewPart = (response.newVersionPart ?? null) as Record<
      string,
      unknown
    > | null;
    const normalizePart = (
      part: Record<string, unknown> | null,
    ): CostCenter.PurchaseBomSourcePartItem | null => {
      if (!part) return null;
      return {
        sourcePartId: toCostNumber(part.sourcePartId ?? part.id),
        purchaseBomId,
        projectId,
        reorganizeCode,
        partNo: toCostText(part.partNo ?? part.partNumber ?? part.partNum),
        partName: toCostText(part.partName ?? part.chDesc),
        pathQuantity: toCostText(part.pathQuantity ?? part.quantity),
        unitCode: toCostText(part.unitCode ?? part.unit),
        modelUserd1st: toCostText(part.modelUserd1st),
        sorNum: toCostText(part.sorNum),
        engineerIncharge: toCostText(part.engineerIncharge),
        sogForSug: toCostText(part.sogForSug),
        respDept: toCostText(part.respDept),
        pendingGeneralLevel: toCostText(part.pendingGeneralLevel),
        partType: toCostText(part.partType),
        ecnProcessNum: toCostText(part.ecnProcessNum),
        partCategory: toCostText(part.partCategory),
        createBy: toCostText(part.createBy ?? part.creator),
        createTime: toCostText(part.createTime ?? part.createdAt),
        updatedAt: toCostText(part.updatedAt ?? part.updateTime),
      };
    };
    const oldPart = normalizePart(rawOldPart);
    const newPart = normalizePart(rawNewPart);
    const diffFields = (response.diffFields ?? {}) as Record<string, unknown>;
    return {
      projectId,
      purchaseBomId,
      reorganizeCode,
      baseVersionId: toCostText(params.baseVersionId),
      valveId: toCostNumber(params.valveId),
      partNo: toCostText(response.partNumber, partNo),
      partName: toCostText(response.partName),
      oldVersionPart: oldPart as CostCenter.PurchaseBomSourcePartItem | null,
      newVersionPart: newPart as CostCenter.PurchaseBomSourcePartItem | null,
      diffFields: Object.entries(diffFields).map(([fieldCode, fieldName]) => ({
        fieldCode,
        fieldName: toCostText(fieldName),
        oldValue: toCostText(
          (oldPart as Record<string, unknown> | null)?.[fieldCode],
        ),
        newValue: toCostText(
          (newPart as Record<string, unknown> | null)?.[fieldCode],
        ),
      })),
    };
  });
}

export function fetchPurchaseMeetingPrices(params: QueryParams) {
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/purchase/meeting/price/list",
    method: "get",
    params: { ...params, pageNum: params.pageNo ?? params.pageNum },
  }).then((response) =>
    toCostPage<CostCenter.PurchaseMeetingPriceItem>(
      response,
      (row) => ({
        ...(row as Partial<CostCenter.PurchaseMeetingPriceItem>),
        purchaseMeetingPriceId: toCostNumber(
          row.id ?? row.purchaseMeetingPriceId,
        ),
        partNo: toCostText(row.partNo),
        partName: toCostText(row.partName),
        supplier: toCostText(row.supplier),
        updatedAt: toCostText(row.updateTime),
        version: toCostNumber(row.version, 0),
      }),
      params,
    ),
  );
}

type PurchaseMeetingPricePayload = Partial<CostCenter.PurchaseMeetingPriceItem>;

export function createPurchaseMeetingPrice(
  payload: PurchaseMeetingPricePayload,
) {
  return request<void>({
    url: "/system/purchase/meeting/price",
    method: "post",
    data: payload,
  }).then(() => ({
    ...payload,
    purchaseMeetingPriceId: Date.now(),
    partNo: payload.partNo ?? "",
    version: 0,
  }));
}

export function updatePurchaseMeetingPrice(
  purchaseMeetingPriceId: number,
  payload: PurchaseMeetingPricePayload,
) {
  return request<void>({
    url: "/system/purchase/meeting/price",
    method: "put",
    data: { ...payload, id: purchaseMeetingPriceId },
  }).then(() => ({
    ...payload,
    purchaseMeetingPriceId,
    partNo: payload.partNo ?? "",
    version: payload.version ?? 0,
  }));
}

export function deletePurchaseMeetingPrice(purchaseMeetingPriceId: number) {
  return request<void>({
    url: `/system/purchase/meeting/price/${purchaseMeetingPriceId}`,
    method: "delete",
  });
}

export function createPurchaseMeetingPriceExportTask(
  params: QueryParams,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/purchase/meeting/price/export/task",
    method: "post",
    params,
    headers: {
      "Idempotency-Key": createIdempotencyKey("meeting-price-export"),
    },
  });
}

export function createPurchaseMeetingPriceImportTask(payload: {
  file: File;
  sourceBatchNo?: string;
  remark?: string;
}): Promise<TaskCenterTaskResponse> {
  const data = new FormData();
  data.append("file", payload.file);
  return request<TaskCenterTaskResponse>({
    url: "/system/purchase/meeting/price/import/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("meeting-price-import"),
    },
  });
}

type OaEvaluationPricePayload = Partial<CostCenter.OaEvaluationPriceItem>;

function mapOaEvaluationPrice(
  row: Record<string, unknown>,
): CostCenter.OaEvaluationPriceItem {
  return {
    id: toCostNumber(row.id),
    costMajor: toCostText(row.costSpecialty),
    secondarySystem: toCostText(row.secondarySystem),
    tertiarySystem: toCostText(row.tertiarySystem),
    evaluator: toCostText(row.evaluator),
    project: toCostText(row.project),
    evaluationType: toCostText(row.evaluationType),
    fileNo: toCostText(row.fileNumber),
    partNo: toCostText(row.partNumber),
    partName: toCostText(row.partName),
    initialEvaluationValue: toCostText(row.initialEvaluationValue),
    factoryPrice: toCostText(row.exFactoryPrice),
    packageFee: toCostText(row.packagingCost),
    logisticsFee: toCostText(row.logisticsCost),
    warehouseFee: toCostText(row.warehousingCost),
    costBreakdownTargetB: toCostText(row.costDecompositionTargetB),
    differenceAB: toCostText(row.differenceAMinusB),
    targetAchievementRate: toCostText(row.targetAchievementRate),
    changePlanDescription: toCostText(row.changePlanDescription),
    beforeChangePartNo: toCostText(row.beforeChangePartNumber),
    afterChangePartNo: toCostText(row.afterChangePartNumber),
    afterChangePartName: toCostText(row.changedPartName),
    originalCost: toCostText(row.originalCost),
    changedCost: toCostText(row.changedCost),
    costChange: toCostText(row.costChange),
    toolingMoldQuantity: toCostNumber(row.toolingMoldQuantity),
    toolingMoldQuote: toCostText(row.toolingMoldQuotation),
    toolingMoldEvaluation: toCostText(row.toolingMoldEvaluation),
    differenceEvaluationQuote: toCostText(row.toolingDifference),
    designWorkingDays: toCostText(row.designManDays),
    designFee: toCostText(row.designCost),
    testFee: toCostText(row.testCost),
    calibrationFee: toCostText(row.calibrationCost),
    rpPart: toCostText(row.rpPartsCost),
    evaluationTotal: toCostText(row.evaluationTotal),
    developmentQuote: toCostText(row.developmentQuotation),
    developmentDifference: toCostText(row.developmentDifference),
    purchaseInputQuoteC: toCostText(row.procurementInputQuotationC),
    quoteEvaluationCA: toCostText(row.quotationMinusEvaluationCMinusA),
    finalQuoteD: toCostText(row.finalQuotationD),
    negotiationResultDC: toCostText(row.negotiationResultDMinusC),
    remark: toCostText(row.remark),
    updatedAt: toCostText(row.updateTime),
    version: toCostNumber(row.version),
  };
}

function toOaEvaluationWritePayload(payload: OaEvaluationPricePayload) {
  return definedFields({
    costSpecialty: payload.costMajor,
    secondarySystem: payload.secondarySystem,
    tertiarySystem: payload.tertiarySystem,
    evaluator: payload.evaluator,
    project: payload.project,
    evaluationType: payload.evaluationType,
    fileNumber: payload.fileNo,
    partNumber: payload.partNo,
    partName: payload.partName,
    initialEvaluationValue: payload.initialEvaluationValue,
    exFactoryPrice: payload.factoryPrice,
    packagingCost: payload.packageFee,
    logisticsCost: payload.logisticsFee,
    warehousingCost: payload.warehouseFee,
    costDecompositionTargetB: payload.costBreakdownTargetB,
    differenceAMinusB: payload.differenceAB,
    targetAchievementRate: payload.targetAchievementRate,
    changePlanDescription: payload.changePlanDescription,
    beforeChangePartNumber: payload.beforeChangePartNo,
    afterChangePartNumber: payload.afterChangePartNo,
    changedPartName: payload.afterChangePartName,
    originalCost: payload.originalCost,
    costChange: payload.costChange,
    changedCost: payload.changedCost,
    toolingMoldQuantity: payload.toolingMoldQuantity,
    toolingMoldQuotation: payload.toolingMoldQuote,
    toolingMoldEvaluation: payload.toolingMoldEvaluation,
    toolingDifference: payload.differenceEvaluationQuote,
    designManDays: payload.designWorkingDays,
    designCost: payload.designFee,
    testCost: payload.testFee,
    calibrationCost: payload.calibrationFee,
    rpPartsCost: payload.rpPart,
    evaluationTotal: payload.evaluationTotal,
    developmentQuotation: payload.developmentQuote,
    developmentDifference: payload.developmentDifference,
    procurementInputQuotationC: payload.purchaseInputQuoteC,
    quotationMinusEvaluationCMinusA: payload.quoteEvaluationCA,
    finalQuotationD: payload.finalQuoteD,
    negotiationResultDMinusC: payload.negotiationResultDC,
    remark: payload.remark,
  });
}

export function fetchOaEvaluationPrices(params: QueryParams) {
  const { partNo, ...filters } = params;
  return request<TableDataInfo<Record<string, unknown>>>({
    url: "/system/evaluate/list",
    method: "get",
    params: {
      ...filters,
      partNumber: partNo,
      pageNum: params.pageNo ?? params.pageNum,
    },
  }).then((response) =>
    toCostPage<CostCenter.OaEvaluationPriceItem>(
      response,
      mapOaEvaluationPrice,
      params,
    ),
  );
}

export function createOaEvaluationPrice(payload: OaEvaluationPricePayload) {
  return request<void>({
    url: "/system/evaluate",
    method: "post",
    data: toOaEvaluationWritePayload(payload),
  }).then(() => ({
    ...payload,
    id: Date.now(),
    partNo: payload.partNo ?? "",
    version: 0,
  }));
}

export function updateOaEvaluationPrice(
  priceId: number,
  payload: OaEvaluationPricePayload,
) {
  return request<void>({
    url: "/system/evaluate",
    method: "put",
    data: { ...toOaEvaluationWritePayload(payload), id: priceId },
  }).then(() => ({
    ...payload,
    id: priceId,
    partNo: payload.partNo ?? "",
    version: payload.version ?? 0,
  }));
}

export function deleteOaEvaluationPrice(priceId: number) {
  return request<void>({
    url: `/system/evaluate/${priceId}`,
    method: "delete",
  });
}

export function createOaEvaluationPriceExportTask(
  params: QueryParams,
): Promise<TaskCenterTaskResponse> {
  const { partNo, ...filters } = params;
  return request<TaskCenterTaskResponse>({
    url: "/system/evaluate/export/task",
    method: "post",
    params: definedFields({ ...filters, partNumber: partNo }),
    headers: { "Idempotency-Key": createIdempotencyKey("oa-evaluate") },
  });
}

export function createOaEvaluationPriceImportTask(
  file: File,
): Promise<TaskCenterTaskResponse> {
  const data = new FormData();
  data.append("file", file);
  return request<TaskCenterTaskResponse>({
    url: "/system/evaluate/importData/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("oa-evaluate-import"),
    },
  });
}

export function createCostBomVersionImportTask(
  file: File,
  valveId: number | string,
): Promise<TaskCenterTaskResponse> {
  const data = new FormData();
  data.append("file", file);
  data.append("valveId", String(valveId));
  return request<TaskCenterTaskResponse>({
    url: "/system/version/bom/importData/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("cost-bom-version-import"),
    },
  });
}

export function createCostBomVersionExportTask(
  filter: Record<string, unknown>,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/version/bom/export/task",
    method: "post",
    params: filter,
    headers: {
      "Idempotency-Key": createIdempotencyKey("cost-bom-version-export"),
    },
  });
}

export function createMeasureVersionImportTask(
  file: File,
  valveId: number | string,
): Promise<TaskCenterTaskResponse> {
  const data = new FormData();
  data.append("file", file);
  data.append("valveId", String(valveId));
  return request<TaskCenterTaskResponse>({
    url: "/system/version/importData/task",
    method: "post",
    data,
    headers: {
      "Idempotency-Key": createIdempotencyKey("measure-version-import"),
    },
  });
}

export function createMeasureVersionExportTask(
  filter: Record<string, unknown>,
): Promise<TaskCenterTaskResponse> {
  return request<TaskCenterTaskResponse>({
    url: "/system/version/export/task",
    method: "post",
    params: filter,
    headers: {
      "Idempotency-Key": createIdempotencyKey("measure-version-export"),
    },
  });
}

export function createOaEvaluationPriceSyncTask() {
  return Promise.resolve(createCostTask("OA_EVALUATION_PRICE_SYNC"));
}

export function createSrmContractPriceSyncTask(payload?: {
  sourceBatchNo?: string;
  remark?: string;
}) {
  return request<void>({
    url: "/system/sync/srmx/compPrice/syncBidPriceToCostBom",
    method: "get",
    params: payload,
  }).then(() => createCostTask("SRM_CONTRACT_PRICE_SYNC"));
}

export function fetchSupplyRatiosByPart(
  partNo: string,
): Promise<CostCenter.SupplyRatioPart> {
  return request<Record<string, unknown>[]>({
    url: "/system/bom/srmSupplierRatio",
    method: "get",
    params: { partNo },
  }).then((suppliers) => {
    const records = Array.isArray(suppliers) ? suppliers : [];
    const ratioTotal = records.reduce(
      (sum, item) => sum + toCostNumber(item.supplierRatio ?? item.ratio),
      0,
    );
    return {
      partNo,
      ratioTotal: String(ratioTotal),
      complete: ratioTotal === 100,
      suppliers: records as CostCenter.SupplyRatioPart["suppliers"],
    };
  });
}

export function fetchCostBomDashboardPatternSummaries(
  projectId: number,
  params?: { valveId?: number },
): Promise<CostCenter.CostBomDashboardPatternSummary[]> {
  return request<Record<string, unknown>[]>({
    url: `/system/version/bom/getCostBomValveVoList/${projectId}/${params?.valveId ?? 0}`,
    method: "get",
  }).then((rows) => [
    {
      patternId: null,
      patternCode: "",
      patternName: "全部版型",
      valves: (Array.isArray(rows) ? rows : []).map((row) => ({
        valveId: toCostNumber(row.valveId ?? row.id, 0),
        valveName: toCostText(row.valveName ?? row.name),
        valveStatus: toCostText(row.status),
        targetCostAmount: toCostText(row.targetCostAmount),
        currentCostAmount: toCostText(row.currentCostAmount),
        partCount: toCostNumber(row.partCount, 0),
      })),
    },
  ]);
}

export function fetchCostBomDashboardPatternDetails(
  projectId: number,
  params?: { valveId?: number },
): Promise<CostCenter.CostBomDashboardPatternDetail[]> {
  return request<Record<string, unknown>[]>({
    url: "/system/version/bom/board/pattern-detail",
    method: "get",
    params: { vehicleModelId: projectId, valveId: params?.valveId ?? 0 },
  }).then((rows) =>
    (Array.isArray(rows) ? rows : []).map((row) => ({
      patternId: toCostNumber(row.patternId ?? row.id, 0),
      patternCode: toCostText(row.patternCode),
      patternName: toCostText(row.patternName ?? row.name),
      targetCostAmount: toCostText(row.targetCostAmount),
      currentCostAmount: toCostText(row.currentCostAmount),
      partCount: toCostNumber(row.partCount, 0),
    })),
  );
}
