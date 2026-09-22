import { httpClient, request } from "@/api/http";
import { createIdempotencyKey } from "@/utils/idempotency";
import {
  mockFetchCommitteeMaterialCategories,
  mockFetchCommitteeMaterialTemplates,
  mockFetchBusinessProjectValves,
  mockFetchBusinessValveDetail,
  mockFetchBusinessValveOptions,
  mockFetchBusinessValves,
} from "@/api/mock/committee.mock";
import { isCommitteeMockEnabled } from "@/api/mock/mock-mode";
import { mapTableData } from "@/api/system/common";
import type {
  BusinessFactoryItem,
  BusinessFactoryListResponse,
  BusinessProjectCreateRequest,
  BusinessProjectItem,
  BusinessProjectPageResponse,
  BusinessProjectQuery,
  BusinessProjectUpdateRequest,
  BusinessProjectValveSaveItem,
  BusinessProjectValveItem,
  BusinessValveCreateRequest,
  BusinessValveDetailItem,
  BusinessValveItem,
  BusinessValveMaterialCommand,
  BusinessValveMaterialCategory,
  BusinessValveMaterialTemplateItem,
  BusinessValveUpdateRequest,
  BudgetGradeCreateRequest,
  BudgetGradeItem,
  BudgetGradeUpdateRequest,
  ProjectValveSavePayload,
  SorCreateRequest,
  SorItem,
  SorPageResponse,
  SorQuery,
  SorUpdateRequest,
  VehicleModelCreateRequest,
  VehicleModelItem,
  VehicleModelPageResponse,
  VehicleModelQuery,
  VehicleModelUpdateRequest,
} from "@/types/project";
import type { PlatformStatus } from "@/types/platform-system";
import type { TableDataInfo } from "@/types/system";

type RuoyiStatus = "0" | "1";

export type BusinessProjectExportTask = {
  taskId: string;
  taskNo: string;
};

type SysVehicleModel = {
  id?: number;
  modelNumber?: string;
  modelName?: string;
  modelImage?: string;
  imageUrl?: string;
  image?: string;
  url?: string;
  brand?: string;
  company?: string;
  sopTime?: string;
  expectedPrice?: string | number;
  salesPlan?: number;
  type?: string | number;
  status?: RuoyiStatus;
  remark?: string;
  createTime?: string;
};

type SysProject = {
  id?: number;
  version?: number;
  projectName?: string;
  wbsNumber?: string;
  vehicleModelId?: number;
  vehicleModel?: SysVehicleModel;
  modelName?: string;
  company?: string;
  factoryName?: string;
  budgetShow?: string;
  incomeShow?: string;
  costShow?: string;
  budgetLock?: string;
  evaluateLock?: string;
  importLock?: string;
  reviewLock?: string;
  status?: RuoyiStatus;
  remark?: string;
  createTime?: string;
  budgetPatternId?: number | string;
  budgetPatternIds?: Array<number | string> | string;
  budgetPatternName?: string;
  budgetPatternNames?: string[];
  benefitCostPatternId?: number | string;
  benefitCostPatternIds?: Array<number | string> | string;
  benefitCostPatternName?: string;
  benefitCostPatternNames?: string[];
  costRevenuePatternId?: number | string;
  costRevenuePatternIds?: Array<number | string> | string;
  costRevenuePatternName?: string;
  costRevenuePatternNames?: string[];
  competitorIds?: number[];
  valveIds?: number[];
  valves?: SysProjectValve[];
  patternVos?: SysProjectPattern[];
  budgetPattern?: SysProjectPattern[];
  benefitCostPatternVos?: SysProjectPattern[];
  benefitCostPattern?: SysProjectPattern[];
  competitorVos?: SysProjectCompetitor[];
  valveVos?: SysProjectValveRelation[];
};

type SysValve = {
  id?: number;
  valveName?: string;
  gatePurpose?: string;
  coreWorkContent?: string;
  materials?: BusinessValveMaterialCommand[] | null;
  valveTime?: string;
  sort?: number;
  status?: string;
  remark?: string;
  createTime?: string;
  valvePassageTime?: string;
  actualValvePassageTime?: string;
  valveProjectId?: number;
};

type SysProjectValve = {
  id?: number;
  projectId?: number;
  valveId?: number;
  valvePassageTime?: string | null;
  actualValvePassageTime?: string | null;
  status?: RuoyiStatus;
  remark?: string;
  createTime?: string;
};

type SysProjectPattern = {
  patternId?: number;
  patternName?: string;
  pattern?: {
    id?: number;
    patternNumber?: string;
    patternName?: string;
  };
};

type SysProjectCompetitor = {
  competitorId?: number;
  competitor?: {
    id?: number;
    competitorName?: string;
    name?: string;
    brand?: string;
  };
};

type SysProjectValveRelation = {
  id?: number;
  valveId?: number;
  valvePassageTime?: string;
  actualValvePassageTime?: string;
  valve?: SysValve;
};

type SysCompanyFactory = {
  id?: number | string;
  factoryCode?: string;
  factoryName?: string;
  code?: string;
  name?: string;
  baseCode?: string;
  baseName?: string;
  companyName?: string;
  status?: RuoyiStatus;
};

type SysSor = {
  id?: number;
  systemLevelName?: string;
  sorName?: string;
  remark?: string;
  createTime?: string;
  status?: RuoyiStatus;
};

type SysGrade = {
  id?: number;
  name?: string;
  gradeName?: string;
  gradeCode?: string;
  parentCode?: string | number;
  fullCode?: string;
  level?: number;
  sort?: number;
  status?: number | string;
  abolishFlag?: string;
  extraFields?: {
    abolishFlag?: string;
  };
  createTime?: string;
  children?: SysGrade[];
};

function toRuoyiStatus(
  status?: PlatformStatus | string,
): RuoyiStatus | undefined {
  if (!status) {
    return undefined;
  }
  return status === "ENABLED" || status === "0" ? "0" : "1";
}

function fromRuoyiStatus(status?: string): PlatformStatus {
  return status === "1" ? "DISABLED" : "ENABLED";
}

function definedFields<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<T>;
}

function toFlag(value?: boolean | string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value === "ENABLED" ? "1" : value === "DISABLED" ? "0" : value;
  }
  return value ? "1" : "0";
}

function fromFlag(value?: string | null): boolean {
  return value === "1";
}

function mapProject(item: SysProject): BusinessProjectItem {
  const vehicle = item.vehicleModel ?? {};
  const projectId = item.id ?? 0;
  const vehicleModelCode = vehicle.modelNumber ?? "";
  const vehicleModelName = vehicle.modelName ?? item.modelName ?? "";
  const projectName = item.projectName ?? "";
  const projectCode =
    item.wbsNumber || vehicleModelCode || String(projectId || "");
  const resolvedProjectName =
    projectName ||
    vehicleModelName ||
    item.wbsNumber ||
    String(projectId || "");
  const budgetPatterns = item.patternVos ?? item.budgetPattern ?? [];
  const costRevenuePatterns =
    item.benefitCostPatternVos ?? item.benefitCostPattern ?? [];
  const competitors = item.competitorVos ?? [];

  return {
    projectId,
    projectCode,
    projectName: resolvedProjectName,
    brand: vehicle.brand ?? null,
    projectCategory: vehicle.type ?? null,
    createdAt: item.createTime ?? null,
    wbsNumber: item.wbsNumber,
    vehicleModelId: item.vehicleModelId ?? vehicle.id ?? null,
    vehicleModelCode,
    vehicleModelName,
    company: item.company ?? vehicle.company ?? null,
    factory: item.factoryName ?? null,
    budgetPatternIds: resolveProjectPatternIds(
      item.budgetPatternIds ?? item.budgetPatternId,
      budgetPatterns,
    ),
    budgetPatternNames: resolveProjectPatternNames(
      budgetPatterns,
      item.budgetPatternNames,
      item.budgetPatternName,
    ),
    costRevenuePatternIds: resolveProjectPatternIds(
      item.benefitCostPatternIds ??
        item.benefitCostPatternId ??
        item.costRevenuePatternIds ??
        item.costRevenuePatternId,
      costRevenuePatterns,
    ),
    costRevenuePatternNames: resolveProjectPatternNames(
      costRevenuePatterns,
      item.benefitCostPatternNames ?? item.costRevenuePatternNames,
      item.benefitCostPatternName ?? item.costRevenuePatternName,
    ),
    budgetDashboardStatus: fromFlag(item.budgetShow) ? "ENABLED" : "DISABLED",
    revenueDashboardStatus: fromFlag(item.incomeShow) ? "ENABLED" : "DISABLED",
    costDashboardStatus: fromFlag(item.costShow) ? "ENABLED" : "DISABLED",
    budgetLocked: fromFlag(item.budgetLock ?? item.importLock),
    evaluateLocked: fromFlag(item.evaluateLock ?? item.reviewLock),
    status: fromRuoyiStatus(item.status),
    remark: item.remark ?? null,
    competitorIds: resolveProjectCompetitorIds(item.competitorIds, competitors),
    competitorNames: resolveProjectCompetitorNames(competitors),
    version: Number(item.version ?? 0),
    valveIds: resolveProjectValveIds(item.valveIds, item.valveVos),
    valves: item.valveVos?.map((valve) =>
      mapProjectValveRelation(projectId, valve),
    ),
    btnLoading:false,
  };
}

function resolveProjectPatternIds(
  ids?: Array<number | string> | string | number,
  patterns: SysProjectPattern[] = [],
) {
  const explicitIds = Array.isArray(ids)
    ? ids
    : ids === undefined || ids === null || ids === ""
      ? []
      : String(ids).split(/[、,，]/);
  return explicitIds.length
    ? explicitIds.map(Number).filter(Number.isFinite)
    : patterns
        .map((item) => item.patternId ?? item.pattern?.id)
        .filter((id): id is number => id !== undefined);
}

function resolveProjectPatternNames(
  patterns: SysProjectPattern[] = [],
  names?: string[],
  fallbackName?: string,
) {
  const explicitNames = names?.length
    ? names
    : fallbackName
      ? fallbackName.split(/[、,，]/)
      : [];
  return (explicitNames.length ? explicitNames : patterns)
    .map((item) =>
      typeof item === "string"
        ? item.trim()
        : (item.patternName ?? item.pattern?.patternName),
    )
    .filter((name): name is string => Boolean(name));
}

function resolveProjectCompetitorIds(
  ids?: number[],
  competitors: SysProjectCompetitor[] = [],
) {
  return ids?.length
    ? ids
    : competitors
        .map((item) => item.competitorId ?? item.competitor?.id)
        .filter((id): id is number => id !== undefined);
}

function resolveProjectCompetitorNames(
  competitors: SysProjectCompetitor[] = [],
) {
  return competitors
    .map((item) => item.competitor?.competitorName ?? item.competitor?.name)
    .filter((name): name is string => Boolean(name));
}

function mapVehicle(item: SysVehicleModel): VehicleModelItem {
  return {
    vehicleModelId: item.id ?? 0,
    vehicleModelCode: item.modelNumber ?? "",
    vehicleModelName: item.modelName ?? "",
    brand: item.brand ?? null,
    company: item.company ?? null,
    modelImage:
      item.modelImage ?? item.imageUrl ?? item.image ?? item.url ?? null,
    expectedPrice: item.expectedPrice ?? null,
    salesPlan: item.salesPlan ?? null,
    sopTime: item.sopTime ?? null,
    vehicleType: item.type ?? null,
    legacyModelNumber: item.modelNumber ?? null,
    status: fromRuoyiStatus(item.status),
    remark: item.remark ?? null,
    version: 0,
    creator: undefined,
    createTime: item.createTime,
  } as VehicleModelItem;
}

function mapValve(item: SysValve): BusinessValveItem {
  return {
    valveId: item.id ?? 0,
    valveCode: String(item.id ?? item.sort ?? ""),
    valveName: item.valveName ?? "",
    gatePurpose: item.gatePurpose ?? null,
    coreWorkContent: item.coreWorkContent ?? null,
    sortNo: item.sort ?? 0,
    status: fromRuoyiStatus(item.status),
    remark: item.remark ?? null,
    createdAt: item.createTime ?? null,
    version: 0,
  };
}

function mapProjectValve(
  projectId: number,
  item: SysValve,
): BusinessProjectValveItem {
  return {
    projectValveId: item.valveProjectId ?? item.id ?? 0,
    projectId,
    projectCode: String(projectId),
    projectName: String(projectId),
    valveId: item.id ?? 0,
    valveCode: String(item.id ?? item.sort ?? ""),
    valveName: item.valveName ?? "",
    gatePurpose: item.gatePurpose ?? null,
    coreWorkContent: item.coreWorkContent ?? null,
    plannedPassTime: item.valvePassageTime ?? null,
    actualValvePassageTime: item.actualValvePassageTime ?? null,
    budgetLocked: false,
    evaluateLocked: false,
    status: fromRuoyiStatus(item.status),
    passValveStatus:
      item.status === "0" ||
      item.status === "1" ||
      item.status === "2" ||
      item.status === "3"
        ? item.status
        : "0",
    remark: item.remark ?? null,
    createdAt: item.createTime ?? null,
    version: 0,
  };
}

function mapProjectValveRelation(
  projectId: number,
  item: SysProjectValveRelation,
): BusinessProjectValveItem {
  const valve = item.valve ?? {};
  return {
    projectValveId: item.id ?? 0,
    projectId,
    projectCode: String(projectId),
    projectName: String(projectId),
    valveId: item.valveId ?? valve.id ?? 0,
    valveCode: String(item.valveId ?? valve.id ?? valve.sort ?? ""),
    valveName: valve.valveName ?? "",
    gatePurpose: valve.gatePurpose ?? null,
    coreWorkContent: valve.coreWorkContent ?? null,
    plannedPassTime: item.valvePassageTime ?? null,
    actualValvePassageTime:
      item.actualValvePassageTime ??
      valve.actualValvePassageTime ??
      null,
    budgetLocked: false,
    evaluateLocked: false,
    status: fromRuoyiStatus(valve.status),
    remark: valve.remark ?? null,
    createdAt: valve.createTime ?? null,
    version: 0,
  };
}

function mapFactory(item: SysCompanyFactory): BusinessFactoryItem {
  const factoryCode =
    item.factoryCode ?? item.code ?? item.baseCode ?? item.factoryName ?? item.name;
  const factoryName =
    item.factoryName ?? item.name ?? item.baseName ?? item.factoryCode ?? item.code;
  return {
    id: item.id ?? factoryCode ?? factoryName,
    factoryCode: factoryCode ?? null,
    factoryName: factoryName ?? "",
    companyName: item.companyName ?? null,
    status: fromRuoyiStatus(item.status),
  };
}

function mapSor(item: SysSor): SorItem {
  return {
    sorId: item.id ?? 0,
    sorCode: item.systemLevelName ?? "",
    sorName: item.sorName ?? "",
    status: fromRuoyiStatus(item.status),
    remark: item.remark ?? null,
    createdAt: item.createTime ?? null,
    version: 0,
  };
}

function mapGrade(item: SysGrade): BudgetGradeItem {
  const abolishFlag = item.abolishFlag ?? item.extraFields?.abolishFlag;
  const disabled = abolishFlag === "1" || String(item.status) === "1";
  return {
    gradeId: item.id ?? 0,
    gradeName: item.gradeName ?? item.name ?? "",
    gradeCode: item.gradeCode ?? "",
    parentId: Number(item.parentCode ?? 0),
    fullPathIds: item.fullCode ?? null,
    gradeLevel: item.level ?? 1,
    sortOrder: item.sort ?? 0,
    status: disabled ? "DISABLED" : "ENABLED",
    enabled: !disabled,
    createdAt: item.createTime ?? null,
    version: 0,
  };
}

function mapGradeTrees(items: SysGrade[]): BudgetGradeItem[] {
  const roots = items.map(mapGrade);
  const pending = items.map((item, index) => ({ item, grade: roots[index]! }));

  while (pending.length > 0) {
    const { item, grade } = pending.pop()!;
    if (!item.children?.length) {
      continue;
    }

    const children = item.children.map(mapGrade);
    grade.children = children;
    for (let index = 0; index < item.children.length; index += 1) {
      pending.push({ item: item.children[index]!, grade: children[index]! });
    }
  }

  return roots;
}

function mapPage<TSource, TTarget>(
  payload: TableDataInfo<TSource>,
  mapper: (item: TSource) => TTarget,
  pageNo?: number,
  pageSize?: number,
) {
  const page = mapTableData(payload, { pageNum: pageNo, pageSize });
  return {
    records: page.records.map(mapper),
    total: page.total,
    pageNo: pageNo ?? 1,
    pageSize: pageSize ?? page.records.length,
  };
}

function projectPayload(
  data: BusinessProjectCreateRequest | BusinessProjectUpdateRequest,
  id?: number,
): SysProject {
  const factoryName = data.factory?.trim();
  const valveIds = resolveProjectValveIds(data.valveIds, data.valves);
  const version = "version" in data ? data.version : undefined;
  return {
    id,
    version,
    projectName: data.projectName,
    wbsNumber: data.wbsNumber,
    vehicleModelId: data.vehicleModelId,
    factoryName: factoryName || undefined,
    budgetShow: toFlag(data.budgetDashboardStatus),
    incomeShow: toFlag(data.revenueDashboardStatus),
    costShow: toFlag(data.costDashboardStatus),
    budgetLock: toFlag(data.budgetLocked),
    evaluateLock: toFlag(data.evaluateLocked),
    status: toRuoyiStatus(data.status),
    remark: data.remark,
    budgetPatternIds: data.budgetPatternIds
      ?.map(Number)
      .filter(Number.isFinite),
    benefitCostPatternIds: data.costRevenuePatternIds
      ?.map(Number)
      .filter(Number.isFinite),
    competitorIds: data.competitorIds,
    valveIds,
    valves: data.valves,
  };
}

function resolveProjectValveIds(
  valveIds?: number[],
  valves: Array<BusinessProjectValveSaveItem | SysProjectValveRelation> = [],
) {
  if (valveIds?.length) {
    return valveIds;
  }
  return valves
    .map((item) => item.valveId)
    .filter(
      (valveId): valveId is number =>
        typeof valveId === "number" && Number.isFinite(valveId) && valveId > 0,
    );
}

function vehiclePayload(
  data: VehicleModelCreateRequest | VehicleModelUpdateRequest,
  id?: number,
): SysVehicleModel {
  return {
    id,
    modelNumber: "vehicleModelCode" in data ? data.vehicleModelCode : undefined,
    modelName: data.vehicleModelName,
    modelImage: data.modelImage,
    brand: data.brand,
    company: data.company,
    sopTime: data.sopTime,
    expectedPrice: data.expectedPrice,
    salesPlan: data.salesPlan,
    type: data.vehicleType,
    status: toRuoyiStatus(data.status),
    remark: data.remark,
  };
}

export async function fetchBusinessProjects(
  params: BusinessProjectQuery,
): Promise<BusinessProjectPageResponse> {
  const response = await request<TableDataInfo<SysProject>>({
    url: "/system/project/list",
    method: "get",
    params: {
      pageNum: params.pageNo,
      pageSize: params.pageSize,
      wbsNumber: params.wbsNumber || params.code || undefined,
      modelName:
        params.modelName ||
        params.name ||
        params.projectName ||
        params.keyword ||
        undefined,
      company: params.company,
      factoryName: params.factoryName || params.factory,
      "params[beginTime]": params.startTime || params.createdFrom,
      "params[endTime]": params.endTime || params.createdTo,
      status: toRuoyiStatus(params.status),
    },
  });
  return mapPage(response, mapProject, params.pageNo, params.pageSize);
}

export function createBusinessProjectExportTask(
  params: Partial<BusinessProjectQuery>,
): Promise<BusinessProjectExportTask> {
  return request<BusinessProjectExportTask>({
    url: "/system/project/export/task",
    method: "post",
    params: {
      wbsNumber: params.wbsNumber || params.code || undefined,
      modelName:
        params.modelName ||
        params.name ||
        params.projectName ||
        params.keyword ||
        undefined,
      company: params.company,
      factoryName: params.factoryName || params.factory,
      "params[beginTime]": params.startTime || params.createdFrom,
      "params[endTime]": params.endTime || params.createdTo,
      status: toRuoyiStatus(params.status),
    },
    headers: {
      "Idempotency-Key": createIdempotencyKey("project-export"),
    },
  });
}

export function fetchBusinessProjectDetail(
  projectId: number | string,
): Promise<BusinessProjectItem> {
  return request<SysProject>({
    url: `/system/project/${projectId}`,
    method: "get",
  }).then(mapProject);
}

export async function fetchBusinessProjectCompetitors(
  projectId: number | string,
): Promise<Pick<BusinessProjectItem, "competitorIds" | "competitorNames">> {
  const competitors = await request<SysProjectCompetitor[]>({
    url: `/system/project/list/competitors/${projectId}`,
    method: "get",
  });
  return {
    competitorIds: resolveProjectCompetitorIds(undefined, competitors),
    competitorNames: resolveProjectCompetitorNames(competitors),
  };
}

export async function fetchBusinessFactories(_params?: {
  keyword?: string;
  companyName?: string;
  factoryCode?: string;
  factoryName?: string;
  status?: string;
  pageNo?: number;
  pageSize?: number;
}): Promise<BusinessFactoryListResponse> {
  const response = await request<TableDataInfo<SysCompanyFactory>>({
    url: "/system/companyFactory/list",
    method: "get",
    params: {
      pageNum: _params?.pageNo ?? 1,
      pageSize: _params?.pageSize ?? 500,
      factoryCode: _params?.factoryCode ?? _params?.keyword,
      factoryName: _params?.factoryName,
      companyName: _params?.companyName,
      status: toRuoyiStatus(_params?.status),
    },
  });
  const page = mapTableData(response, {
    pageNum: _params?.pageNo ?? 1,
    pageSize: _params?.pageSize ?? 500,
  });
  return {
    records: page.records.map(mapFactory),
    total: page.total,
    pageNo: _params?.pageNo ?? 1,
    pageSize: _params?.pageSize ?? 10,
    hasNext: (_params?.pageNo ?? 1) * (_params?.pageSize ?? 10) < page.total,
  };
}

export async function createBusinessProject(
  data: BusinessProjectCreateRequest,
): Promise<BusinessProjectItem> {
  const created = await request<number | SysProject | undefined>({
    url: "/system/project",
    method: "post",
    data: projectPayload(data),
  });
  const createdId =
    typeof created === "object" && created
      ? (created.id ?? 0)
      : Number.isFinite(Number(created))
        ? Number(created)
        : 0;
  const mappedProject = mapProject(
    typeof created === "object" && created ? created : { id: createdId },
  );
  return {
    ...mappedProject,
    ...data,
    valves: mappedProject.valves,
    projectId: createdId,
    projectCode: String(createdId || ""),
    projectName: data.projectName,
    budgetLocked: data.budgetLocked ?? false,
    evaluateLocked: data.evaluateLocked ?? false,
    status: data.status ?? "ENABLED",
    version: 0,
  };
}

export async function updateBusinessProject(
  projectId: number,
  data: BusinessProjectUpdateRequest,
): Promise<BusinessProjectItem> {
  await request<void>({
    url: "/system/project",
    method: "put",
    data: definedFields(projectPayload(data, projectId)),
  });
  const mappedProject = mapProject({ id: projectId });
  return {
    ...mappedProject,
    ...data,
    valves: mappedProject.valves,
    projectId,
    projectCode: String(projectId),
    projectName: data.projectName ?? String(projectId),
    budgetLocked: data.budgetLocked ?? false,
    evaluateLocked: data.evaluateLocked ?? false,
    status: data.status ?? "ENABLED",
    version: data.version + 1,
  };
}

export function enableBusinessProject(
  projectId: number,
  version: number,
): Promise<BusinessProjectItem> {
  return updateBusinessProject(projectId, { status: "ENABLED", version });
}

export function disableBusinessProject(
  projectId: number,
  version: number,
): Promise<BusinessProjectItem> {
  return updateBusinessProject(projectId, { status: "DISABLED", version });
}

export function deleteBusinessProject(
  projectId: number | string,
): Promise<void> {
  return request<void>({
    url: `/system/project/${projectId}`,
    method: "delete",
  });
}

export async function fetchBusinessValves(
  params?: {
    pageNo?: number;
    pageSize?: number;
    keyword?: string;
    status?: string;
    createdAtStart?: string;
    createdAtEnd?: string;
  },
  options?: { allowMock?: boolean },
) {
  if (options?.allowMock !== false && isCommitteeMockEnabled()) {
    return mockFetchBusinessValves(params);
  }
  const response = await request<TableDataInfo<SysValve>>({
    url: "/system/valve/list",
    method: "get",
    params: {
      pageNum: params?.pageNo ?? 1,
      pageSize: params?.pageSize ?? 200,
      valveName: params?.keyword,
      status: toRuoyiStatus(params?.status),
      "params[endTime]": params?.createdAtEnd,
      "params[beginTime]": params?.createdAtStart,
    },
  });
  return mapPage(response, mapValve, params?.pageNo, params?.pageSize);
}

export async function createBusinessValve(
  data: BusinessValveCreateRequest,
): Promise<BusinessValveItem> {
  await request<void>({
    url: "/system/valve",
    method: "post",
    data: {
      valveName: data.valveName,
      gatePurpose: data.gatePurpose,
      coreWorkContent: data.coreWorkContent,
      materials: data.materials?.map((material) => ({
        materialName: material.materialName,
        ...(material.materialRequirement === undefined
          ? {}
          : { materialRequirement: material.materialRequirement }),
        ...(material.materialType === undefined
          ? {}
          : { materialType: material.materialType }),
        ...(material.sourceTemplateId === undefined ||
        material.sourceTemplateId === null
          ? {}
          : { sourceTemplateId: Number(material.sourceTemplateId) }),
      })),
      sort: data.sortNo ?? 0,
      remark: data.remark,
      status: toRuoyiStatus(data.status),
    },
  });
  return {
    valveId: 0,
    valveCode: data.valveCode,
    valveName: data.valveName,
    gatePurpose: data.gatePurpose ?? null,
    coreWorkContent: data.coreWorkContent ?? null,
    sortNo: data.sortNo ?? 0,
    status: data.status ?? "ENABLED",
    remark: data.remark ?? null,
    version: 0,
  };
}

export async function updateBusinessValve(
  valveId: number,
  data: BusinessValveUpdateRequest,
): Promise<BusinessValveItem> {
  await request<void>({
    url: "/system/valve",
    method: "put",
    data: {
      id: valveId,
      valveName: data.valveName,
      gatePurpose: data.gatePurpose,
      coreWorkContent: data.coreWorkContent,
      materials: data.materials?.map((material) => ({
        materialName: material.materialName,
        ...(material.materialRequirement === undefined
          ? {}
          : { materialRequirement: material.materialRequirement }),
        ...(material.materialType === undefined
          ? {}
          : { materialType: material.materialType }),
        ...(material.sourceTemplateId === undefined ||
        material.sourceTemplateId === null
          ? {}
          : { sourceTemplateId: Number(material.sourceTemplateId) }),
      })),
      sort: data.sortNo ?? 0,
      remark: data.remark,
      status: toRuoyiStatus(data.status),
    },
  });
  return {
    valveId,
    valveCode: String(valveId),
    valveName: data.valveName ?? "",
    gatePurpose: data.gatePurpose ?? null,
    coreWorkContent: data.coreWorkContent ?? null,
    sortNo: data.sortNo ?? 0,
    status: data.status ?? "ENABLED",
    remark: data.remark ?? null,
    version: 0,
  };
}

export async function fetchBusinessValveDetail(
  valveId: number | string,
): Promise<BusinessValveDetailItem> {
  if (isCommitteeMockEnabled()) {
    return (await mockFetchBusinessValveDetail(valveId)) as BusinessValveDetailItem;
  }
  const response = await request<SysValve>({
    url: `/system/valve/${valveId}`,
    method: "get",
  });
  return {
    ...mapValve(response),
    materials: response.materials ?? null,
  };
}

export function fetchBusinessValveMaterialCategories() {
  if (isCommitteeMockEnabled()) {
    return mockFetchCommitteeMaterialCategories() as Promise<
      BusinessValveMaterialCategory[]
    >;
  }
  return request<BusinessValveMaterialCategory[]>({
    url: "/committee/config/material-categories",
  });
}

export function fetchBusinessValveMaterialTemplates(
  categoryId?: string | number,
) {
  if (isCommitteeMockEnabled()) {
    return mockFetchCommitteeMaterialTemplates(
      categoryId === undefined ? undefined : String(categoryId),
    ) as Promise<BusinessValveMaterialTemplateItem[]>;
  }
  return request<BusinessValveMaterialTemplateItem[]>({
    url: "/committee/config/materials",
    params: { categoryId },
  });
}

export function deleteBusinessValve(valveId: number | string): Promise<void> {
  return request<void>({
    url: `/system/valve/${valveId}`,
    method: "delete",
  });
}

export async function fetchBusinessProjectValves(projectId: number) {
  if (isCommitteeMockEnabled()) {
    return mockFetchBusinessProjectValves(projectId);
  }
  const response = await request<SysValve[]>({
    url: "/system/valve/options",
    method: "get",
    params: { projectId },
  });
  return {
    records: response
      .filter(
        (item) =>
          item.valveProjectId ||
          item.valvePassageTime ||
          item.actualValvePassageTime,
      )
      .map((item) => mapProjectValve(projectId, item)),
    total: response.length,
  };
}

function toNullableText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value);
}

/**
 * 将 /system/project/valve 返回的项目阀点行转换为业务阀点结构。
 * 兼容平铺字段（valveId/valveName）与嵌套字段（valve.id/valve.valveName）。
 */
function mapProjectValveRow(
  projectId: number,
  item: Record<string, unknown>,
): BusinessProjectValveItem {
  const nestedValve =
    item.valve && typeof item.valve === "object" && !Array.isArray(item.valve)
      ? (item.valve as Record<string, unknown>)
      : {};
  const rawValveId = item.valveId ?? nestedValve.id ?? item.id;
  const valveId = Number(rawValveId);
  const rawProjectValveId =
    item.projectValveId ?? item.valveProjectId ?? item.id;
  const projectValveId = Number(rawProjectValveId);
  const passStatus = toNullableText(item.status ?? nestedValve.status) ?? "";
  return {
    projectValveId: Number.isFinite(projectValveId) ? projectValveId : 0,
    projectId,
    projectCode: toNullableText(item.projectCode) ?? String(projectId),
    projectName: toNullableText(item.projectName) ?? String(projectId),
    valveId: Number.isFinite(valveId) ? valveId : 0,
    valveCode:
      toNullableText(item.valveCode ?? nestedValve.valveCode) ??
      String(rawValveId ?? ""),
    valveName:
      toNullableText(
        item.valveName ?? nestedValve.valveName ?? item.valvePoint,
      ) ?? "",
    gatePurpose: toNullableText(item.gatePurpose ?? nestedValve.gatePurpose),
    coreWorkContent: toNullableText(
      item.coreWorkContent ?? nestedValve.coreWorkContent,
    ),
    plannedPassTime: toNullableText(
      item.valvePassageTime ?? nestedValve.valvePassageTime ?? item.valveTime,
    ),
    actualValvePassageTime: toNullableText(
      item.actualValvePassageTime ??
        nestedValve.actualValvePassageTime,
    ),
    budgetLocked: false,
    evaluateLocked: false,
    status: fromRuoyiStatus(passStatus || undefined),
    passValveStatus:
      passStatus === "0" ||
      passStatus === "1" ||
      passStatus === "2" ||
      passStatus === "3"
        ? passStatus
        : "0",
    remark: toNullableText(item.remark ?? nestedValve.remark),
    createdAt: toNullableText(item.createTime ?? nestedValve.createTime),
    version: 0,
  };
}

/**
 * 查询项目已配置的阀点（GET /system/project/valve）。
 * 仅供成本BOM改制差异分析的阀点下拉使用，不影响其他阀点查询入口。
 */
export async function fetchProjectValveOptions(projectId: number) {
  if (isCommitteeMockEnabled()) {
    return mockFetchBusinessProjectValves(projectId);
  }
  const response = await request<unknown>({
    url: "/system/project/valves",
    method: "get",
    params: { projectId },
  });
  const rows = normalizeProjectValveListResponse(response);
  return {
    records: rows
      .map((item) => mapProjectValveRow(projectId, item))
      .filter((item) => item.valveId > 0),
    total: rows.length,
  };
}

export async function fetchBusinessValveOptions(params?: {
  projectId?: number;
}) {
  if (isCommitteeMockEnabled()) {
    return mockFetchBusinessValveOptions();
  }
  const response = await request<SysValve[]>({
    url: "/system/valve/options",
    method: "get",
    params,
  });
  return {
    records: response.map(mapValve),
    total: response.length,
  };
}

export type BrandOptionItem = {
  brandId?: number | string;
  id?: number | string;
  brandCode?: string | number | null;
  brandName?: string | null;
  name?: string | null;
  label?: string | null;
};

export async function fetchBrandOptions(): Promise<BrandOptionItem[]> {
  return request<BrandOptionItem[]>({
    url: "/system/brand/options",
    method: "get",
  });
}
// export function fetchChangeStatus(row:SysProject){
//   return request({
//     url: `/system/project/changeStatus`,
//     method: "post",
//     data:row
//   })
// }
export function fetchChangeStatus(data:{
  id:number|string,
  budgetShow?:number|string
  incomeShow?:number|string
  costShow?:number|string
}){
  return request({
    url: `/system/project/changeStatus`,
    method: "post",
    data:data
  })
}
export function saveBusinessProjectValve(
  projectId: number,
  payload: ProjectValveSavePayload,
) {
  return request<BusinessProjectValveItem>({
    url: "/system/project/changeStatus",
    method: "post",
    data: {
      id: projectId,
      valves: [
        {
          valveId: payload.valveId,
          valvePassageTime: payload.plannedPassTime?.slice(0, 10),
          actualValvePassageTime:
            payload.actualValvePassageTime?.slice(0, 10),
        },
      ],
    },
  });
}

export function deleteBusinessProjectValve(
  _projectId?: number,
  projectValveId?: number,
) {
  void _projectId;
  if (!projectValveId) return Promise.reject(new Error("缺少项目阀点编号"));
  return request<void>({
    url: `/system/valve/project/${projectValveId}`,
    method: "delete",
  });
}

export async function fetchVehicleModels(
  params: VehicleModelQuery,
): Promise<VehicleModelPageResponse> {
  const response = await request<TableDataInfo<SysVehicleModel>>({
    url: "/system/vehicle/model/list",
    method: "get",
    params: {
      pageNum: params.pageNo,
      pageSize: params.pageSize,
      modelNumber: params.code,
      modelName: params.name,
      company: params.company,
      brand: params.brand,
      type: params.vehicleType,
      status: toRuoyiStatus(params.status),
      sopTime: params.sopTime,
      beginTime: params.sopFrom,
      endTime: params.sopTo,
    },
  });
  return mapPage(response, mapVehicle, params.pageNo, params.pageSize);
}

export async function fetchAllVehicleModels(): Promise<VehicleModelItem[]> {
  const response = await request<SysVehicleModel[]>({
    url: "/system/vehicle/model/options/all",
    method: "get",
  });
  return response.map(mapVehicle);
}

export async function fetchAvailableVehicleModels(): Promise<
  VehicleModelItem[]
> {
  const response = await request<SysVehicleModel[]>({
    url: "/system/vehicle/model/options",
    method: "get",
  });
  return response
    .map(mapVehicle)
    .filter((vehicle) => vehicle.status === "ENABLED");
}

export function fetchVehicleModelDetail(
  vehicleModelId: number | string,
): Promise<VehicleModelItem> {
  return request<SysVehicleModel>({
    url: `/system/vehicle/model/${vehicleModelId}`,
    method: "get",
  }).then(mapVehicle);
}

export async function createVehicleModel(
  data: VehicleModelCreateRequest,
): Promise<VehicleModelItem> {
  const createdId = await request<number>({
    url: "/system/vehicle/model",
    method: "post",
    data: vehiclePayload(data),
  });
  return {
    ...mapVehicle({ ...vehiclePayload(data), id: createdId }),
    vehicleModelId: createdId,
    vehicleModelCode: data.vehicleModelCode,
    status: data.status ?? "ENABLED",
  };
}

export async function updateVehicleModel(
  vehicleModelId: number,
  data: VehicleModelUpdateRequest,
): Promise<VehicleModelItem> {
  await request<void>({
    url: "/system/vehicle/model",
    method: "put",
    data: definedFields(vehiclePayload(data, vehicleModelId)),
  });
  return {
    ...mapVehicle(vehiclePayload(data, vehicleModelId)),
    vehicleModelId,
    status: data.status ?? "ENABLED",
  };
}

export function enableVehicleModel(
  vehicleModelId: number,
): Promise<VehicleModelItem> {
  return updateVehicleModel(vehicleModelId, { status: "ENABLED", version: 0 });
}

export function disableVehicleModel(
  vehicleModelId: number,
): Promise<VehicleModelItem> {
  return updateVehicleModel(vehicleModelId, { status: "DISABLED", version: 0 });
}

export function deleteVehicleModel(
  vehicleModelId: number | string,
): Promise<void> {
  return request<void>({
    url: `/system/vehicle/model/${vehicleModelId}`,
    method: "delete",
  });
}

export async function uploadVehicleModelImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await httpClient.request({
    url: "/system/vehicle/model/uploadImage",
    method: "post",
    data: formData,
  });
  const body = response.data as { data?: string; msg?: string; url?: string };
  return body.msg ?? body.data ?? body.url ?? "";
}

export async function fetchSors(params: SorQuery): Promise<SorPageResponse> {
  const response = await request<TableDataInfo<SysSor>>({
    url: "/system/sor/list",
    method: "get",
    params: {
      pageNum: params.pageNo,
      pageSize: params.pageSize,
      systemLevelName: params.sorCode,
      sorName: params.sorName ?? params.keyword,
      "params[beginTime]": params.createdAtStart,
      "params[endTime]": params.createdAtEnd,
    },
  });
  return mapPage(response, mapSor, params.pageNo, params.pageSize);
}

export async function createSor(data: SorCreateRequest): Promise<SorItem> {
  await request<void>({
    url: "/system/sor",
    method: "post",
    data: {
      systemLevelName: data.sorCode,
      ...definedFields({ sorName: data.sorName, remark: data.remark }),
    },
  });
  return {
    sorId: 0,
    sorCode: data.sorCode,
    sorName: data.sorName,
    status: data.status ?? "ENABLED",
    remark: data.remark ?? null,
    version: 0,
  };
}

export async function updateSor(
  sorId: number,
  data: SorUpdateRequest,
): Promise<SorItem> {
  const current = await request<SysSor>({
    url: `/system/sor/${sorId}`,
    method: "get",
  });
  await request<void>({
    url: "/system/sor",
    method: "put",
    data: {
      ...current,
      id: sorId,
      systemLevelName: data.sorCode ?? current.systemLevelName,
      sorName: data.sorName,
      remark: data.remark,
    },
  });
  return {
    sorId,
    sorCode: data.sorCode ?? current.systemLevelName ?? String(sorId),
    sorName: data.sorName ?? "",
    status: data.status ?? "ENABLED",
    remark: data.remark ?? null,
    version: 0,
  };
}

export function deleteSor(sorId: number | string): Promise<void> {
  return request<void>({
    url: `/system/sor/${sorId}`,
    method: "delete",
  });
}

export async function fetchBudgetGrades(_params?: {
  parentId?: number | string;
  includeDisabled?: boolean;
}): Promise<BudgetGradeItem[]> {
  const allGrades = await fetchAllBudgetGrades(_params);
  const parentId = Number(_params?.parentId ?? 0);
  return allGrades.filter((item) => Number(item.parentId) === parentId);
}

export async function fetchAllBudgetGrades(_params?: {
  includeDisabled?: boolean;
}): Promise<BudgetGradeItem[]> {
  void _params;
  const response = await request<SysGrade[]>({
    url: "/system/grade/options",
    method: "get",
  });
  return response.map(mapGrade);
}

export async function fetchBudgetGradeTree(params?: {
  gradeName?: string;
  abolishFlag?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
  beginTime?: string;
  endTime?: string;
}): Promise<BudgetGradeItem[]> {
  const beginTime = params?.createdAtStart ?? params?.beginTime;
  const endTime = params?.createdAtEnd ?? params?.endTime;
  const response = await request<SysGrade[]>({
    url: "/system/grade/tree",
    method: "get",
    params: {
      gradeName: params?.gradeName || undefined,
      abolishFlag: params?.abolishFlag || undefined,
      "params[beginTime]": beginTime || undefined,
      "params[endTime]": endTime || undefined,
    },
  });
  return mapGradeTrees(response);
}

export async function createBudgetGrade(
  data: BudgetGradeCreateRequest,
): Promise<BudgetGradeItem> {
  await request<void>({
    url: "/system/grade",
    method: "post",
    data: {
      gradeName: data.gradeName,
      gradeCode: data.gradeCode,
      parentCode: String(data.parentId ?? 0),
    },
  });
  return {
    gradeId: 0,
    gradeName: data.gradeName,
    gradeCode: data.gradeCode,
    parentId: data.parentId ?? 0,
    gradeLevel: 1,
    sortOrder: data.sortOrder ?? 0,
    status: "ENABLED",
    enabled: true,
    version: 0,
  };
}

export async function updateBudgetGrade(
  gradeId: number | string,
  data: BudgetGradeUpdateRequest,
): Promise<BudgetGradeItem> {
  await request<void>({
    url: "/system/grade",
    method: "put",
    data: {
      id: gradeId,
      gradeName: data.gradeName,
      gradeCode: data.gradeCode,
      parentCode: String(data.parentId ?? 0),
      sort: data.sortOrder,
    },
  });
  return {
    gradeId,
    gradeName: data.gradeName,
    gradeCode: data.gradeCode,
    parentId: data.parentId ?? 0,
    gradeLevel: 1,
    sortOrder: data.sortOrder ?? 0,
    status: data.status ?? "ENABLED",
    enabled: data.status !== "DISABLED",
    version: 0,
  };
}

export function deleteBudgetGrade(gradeId: number | string): Promise<void> {
  return request<void>({
    url: `/system/grade/${gradeId}`,
    method: "delete",
  });
}

export function enableBudgetGrade(gradeId: number | string): Promise<void> {
  return request<void>({
    url: `/system/grade/enable/${gradeId}`,
    method: "put",
  });
}

/**
 * 通用项目查询
 */
/**
 * 获取阀点选项列表
 */
export async function valveOptions(
  params?: { projectId?: number | string },
): Promise<{ data: Array<{ id: number; valveName: string }> }> {
  return request({
    url: "/system/valve/options",
    method: "get",
    params,
  });
}

export async function projectGet(
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return request({
    url: "/system/project/list",
    method: "get",
    params,
  });
}

function normalizeProjectValveListResponse(payload: unknown): Array<Record<string, unknown>> {
  const body =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = body.data;
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (Array.isArray(body.rows)) return body.rows as Array<Record<string, unknown>>;
  if (Array.isArray(body.list)) return body.list as Array<Record<string, unknown>>;
  if (Array.isArray(body.records)) return body.records as Array<Record<string, unknown>>;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>;
    if (Array.isArray(nested.rows)) return nested.rows as Array<Record<string, unknown>>;
    if (Array.isArray(nested.records)) return nested.records as Array<Record<string, unknown>>;
    if (Array.isArray(nested.data)) return nested.data as Array<Record<string, unknown>>;
  }
  return [];
}

function mapValveOptionsToProjectValveRows(
  projectId: number | string,
  rows: SysValve[] = [],
): Array<Record<string, unknown>> {
  const numericProjectId = Number(projectId);
  const safeProjectId = Number.isFinite(numericProjectId) ? numericProjectId : projectId;
  return rows
    .filter((item) => item.valveProjectId || item.valvePassageTime || item.id)
    .map((item) => {
      const mapped = mapProjectValve(
        Number.isFinite(numericProjectId) ? numericProjectId : 0,
        item,
      );
      const valveName = mapped.valveName || item.valveName || "";
      return {
        ...item,
        ...mapped,
        id: mapped.valveId || item.id,
        valveId: mapped.valveId || item.id,
        projectValveId: mapped.projectValveId || item.valveProjectId || item.id,
        valveName,
        valvePoint: valveName,
        valveCode: mapped.valveCode || String(item.id ?? ""),
        valvePassageTime: item.valvePassageTime || mapped.plannedPassTime || item.valveTime,
      };
    })
    .map((item) => ({
      ...item,
      projectId: safeProjectId,
    }));
}

/**
 * 查询项目阀点列表。
 * 当前环境 /system/project/valve 仅支持 PUT，优先走 /system/valve/options，再回退旧接口。
 */
export async function projectValveList(
  params: { projectId: number | string },
): Promise<Array<Record<string, unknown>>> {
  try {
    const optionsResponse = await request<SysValve[]>({
      url: "/system/valve/options",
      method: "get",
      params: { projectId: params.projectId },
      skipErrorToast: true,
    });
    const optionRows = Array.isArray(optionsResponse)
      ? optionsResponse
      : normalizeProjectValveListResponse(optionsResponse);
    const mapped = mapValveOptionsToProjectValveRows(
      params.projectId,
      optionRows as SysValve[],
    );
    if (mapped.length) {
      return mapped;
    }
  } catch (_error) {
    // 继续尝试项目阀点接口。
  }

  try {
    const response = await request({
      url: "/system/project/valve",
      method: "get",
      params,
      skipErrorToast: true,
    });
    const rows = normalizeProjectValveListResponse(response);
    if (rows.length) {
      return rows;
    }
  } catch (_error) {
    // 两个接口均不可用时返回空列表，由页面展示空态。
  }

  return [];
}
