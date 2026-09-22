import type {
  PlatformPageQuery,
  PlatformPageResponse,
  PlatformStatus,
} from "@/types/platform-system";
import type { BackendId } from "@/types/information";

export interface BusinessProjectItem {
  projectId: number;
  projectCode: string;
  projectName: string;
  brand?: string | null;
  projectCategory?: string | number | null;
  createdAt?: string | null;
  wbsNumber?: string | null;
  vehicleModelId?: number | null;
  vehicleModelCode?: string | null;
  vehicleModelName?: string | null;
  budgetPatternId?: number | string | null;
  budgetPatternName?: string | null;
  costRevenuePatternId?: number | string | null;
  costRevenuePatternName?: string | null;
  budgetPatternIds?: Array<number | string> | null;
  budgetPatternNames?: string[] | null;
  costRevenuePatternIds?: Array<number | string> | null;
  costRevenuePatternNames?: string[] | null;
  company?: string | null;
  factory?: string | null;
  competitor?: string | null;
  competitorIds?: number[] | null;
  competitorNames?: string[] | null;
  budgetDashboardStatus?: string | null;
  revenueDashboardStatus?: string | null;
  costDashboardStatus?: string | null;
  legacyProjectId?: number | null;
  legacyProjectNo?: string | null;
  budgetLocked: boolean;
  evaluateLocked: boolean;
  status: PlatformStatus;
  remark?: string | null;
  version: number;
  valveIds?: number[] | null;
  valves?: BusinessProjectValveItem[];
  btnLoading?:boolean
}

export interface BusinessFactoryItem {
  id?: BackendId | null;
  factoryCode?: string | null;
  factoryName: string;
  companyName?: string | null;
  status?: PlatformStatus | string | null;
}

export interface BusinessProjectQuery extends PlatformPageQuery {
  keyword?: string;
  code?: string;
  name?: string;
  modelName?: string;
  wbsNumber?: string;
  projectName?: string;
  factory?: string;
  factoryName?: string;
  company?: string;
  startTime?: string;
  endTime?: string;
  createdFrom?: string;
  createdTo?: string;
  status?: PlatformStatus;
}

export interface BusinessProjectCreateRequest {
  projectCode: string;
  projectName: string;
  wbsNumber?: string;
  vehicleModelId?: number;
  vehicleModelCode?: string;
  vehicleModelName?: string;
  budgetPatternId?: number | string;
  budgetPatternIds?: Array<number | string>;
  budgetPatternName?: string;
  budgetPatternNames?: string[];
  costRevenuePatternId?: number | string;
  costRevenuePatternIds?: Array<number | string>;
  costRevenuePatternName?: string;
  costRevenuePatternNames?: string[];
  company?: string;
  factory?: string;
  competitor?: string;
  competitorIds?: number[];
  budgetDashboardStatus?: string;
  revenueDashboardStatus?: string;
  costDashboardStatus?: string;
  legacyProjectId?: number;
  legacyProjectNo?: string;
  budgetLocked?: boolean;
  evaluateLocked?: boolean;
  status?: PlatformStatus;
  remark?: string;
  valveIds?: number[];
  valves?: BusinessProjectValveSaveItem[];
}

export interface BusinessProjectUpdateRequest {
  projectName?: string;
  wbsNumber?: string;
  vehicleModelId?: number;
  vehicleModelCode?: string;
  vehicleModelName?: string;
  budgetPatternId?: number | string;
  budgetPatternIds?: Array<number | string>;
  budgetPatternName?: string;
  budgetPatternNames?: string[];
  costRevenuePatternId?: number | string;
  costRevenuePatternIds?: Array<number | string>;
  costRevenuePatternName?: string;
  costRevenuePatternNames?: string[];
  company?: string;
  factory?: string;
  competitor?: string;
  competitorIds?: number[];
  budgetDashboardStatus?: string;
  revenueDashboardStatus?: string;
  costDashboardStatus?: string;
  legacyProjectId?: number;
  legacyProjectNo?: string;
  budgetLocked?: boolean;
  evaluateLocked?: boolean;
  status?: PlatformStatus;
  remark?: string;
  version: number;
  valveIds?: number[];
  valves?: BusinessProjectValveSaveItem[];
}

export interface BusinessValveItem {
  valveId: BackendId;
  valveCode: string;
  valveName: string;
  gatePurpose?: string | null;
  coreWorkContent?: string | null;
  sortNo: number;
  legacyValveId?: number | null;
  status: PlatformStatus;
  remark?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version: number;
}

export interface BusinessValveDetailItem extends BusinessValveItem {
  materials?: BusinessValveMaterialCommand[] | null;
}

export interface BusinessValveCreateRequest {
  valveCode: string;
  valveName: string;
  gatePurpose?: string;
  coreWorkContent?: string;
  materials?: BusinessValveMaterialCommand[];
  sortNo?: number;
  legacyValveId?: number;
  status?: PlatformStatus;
  remark?: string;
}

export interface BusinessValveUpdateRequest {
  valveName?: string;
  gatePurpose?: string;
  coreWorkContent?: string;
  materials?: BusinessValveMaterialCommand[];
  sortNo?: number;
  legacyValveId?: number;
  status?: PlatformStatus;
  remark?: string;
  version: number;
}

export interface BusinessValveMaterialCategory {
  id?: BackendId;
  categoryCode: string;
  categoryName: string;
  categoryDesc?: string | null;
  sortNo: number;
  enableFlag: "0" | "1";
}

export interface BusinessValveMaterialCommand {
  materialName: string;
  materialRequirement?: string | null;
  materialType?: string | null;
  sourceTemplateId?: BackendId | null;
}

export interface BusinessValveMaterialTemplateItem {
  id?: BackendId;
  categoryId?: BackendId;
  materialName?: string;
  materialRequirement?: string | null;
  fileType?: string | null;
  materialType?: string | null;
  sortNo?: number | null;
  enableFlag?: "0" | "1";
}

export interface BusinessProjectValveItem {
  projectValveId: number;
  projectId: number;
  projectCode: string;
  projectName: string;
  valveId: number;
  valveCode: string;
  valveName: string;
  gatePurpose?: string | null;
  coreWorkContent?: string | null;
  plannedPassTime?: string | null;
  actualValvePassageTime?: string | null;
  budgetLocked: boolean;
  evaluateLocked: boolean;
  legacyProjectValveId?: number | null;
  status: PlatformStatus;
  /** 项目阀点过阀状态：0 未过阀，1/2/3 已进入过阀状态 */
  passValveStatus?: "0" | "1" | "2" | "3" | null;
  remark?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version: number;
}

export interface ProjectValveSavePayload {
  valveId: number;
  plannedPassTime?: string | null;
  actualValvePassageTime?: string | null;
  budgetLocked?: boolean;
  evaluateLocked?: boolean;
  status?: PlatformStatus;
  remark?: string;
  version?: number;
}

export interface BusinessProjectValveSaveItem {
  valveId: number;
  valvePassageTime?: string | null;
  actualValvePassageTime?: string | null;
}

export interface VehicleModelItem {
  vehicleModelId: number;
  vehicleModelCode: string;
  vehicleModelName: string;
  brand?: string | null;
  company?: string | null;
  modelYear?: number | null;
  modelImage?: string | null;
  expectedPrice?: string | number | null;
  salesPlan?: number | null;
  sopTime?: string | null;
  vehicleType?: string | number | null;
  legacyVehicleModelId?: number | null;
  legacyModelNumber?: string | null;
  status: PlatformStatus;
  remark?: string | null;
  version: number;
}

export interface VehicleModelQuery extends PlatformPageQuery {
  code?: string;
  name?: string;
  company?: string;
  brand?: string;
  sopTime?: string;
  sopFrom?: string;
  sopTo?: string;
  status?: PlatformStatus;
  vehicleType?: string | number;
}

export interface VehicleModelCreateRequest {
  vehicleModelCode: string;
  vehicleModelName: string;
  brand?: string;
  company?: string;
  modelYear?: number;
  modelImage?: string;
  expectedPrice?: string | number;
  salesPlan?: number;
  sopTime?: string;
  vehicleType?: string | number;
  legacyVehicleModelId?: number;
  legacyModelNumber?: string;
  status?: PlatformStatus;
  remark?: string;
}

export interface VehicleModelUpdateRequest {
  vehicleModelCode?: string;
  vehicleModelName?: string;
  brand?: string;
  company?: string;
  modelYear?: number;
  modelImage?: string;
  expectedPrice?: string | number;
  salesPlan?: number;
  sopTime?: string;
  vehicleType?: string | number;
  legacyVehicleModelId?: number;
  legacyModelNumber?: string;
  status?: PlatformStatus;
  remark?: string;
  version: number;
}

export interface SorItem {
  sorId: BackendId;
  sorCode: string;
  sorName: string;
  projectId?: number | null;
  vehicleModelId?: number | null;
  supplierId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  bidCompCode?: string | null;
  legacySorId?: number | null;
  status: PlatformStatus;
  remark?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version: number;
}

export interface SorQuery extends PlatformPageQuery {
  keyword?: string;
  sorCode?: string;
  sorName?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
  status?: string;
  projectId?: number;
}

export interface SorCreateRequest {
  sorCode: string;
  sorName: string;
  projectId?: number;
  vehicleModelId?: number;
  supplierId?: number;
  bidCompCode?: string;
  legacySorId?: number;
  status?: PlatformStatus;
  remark?: string;
}

export interface SorUpdateRequest {
  sorCode?: string;
  sorName?: string;
  projectId?: number;
  vehicleModelId?: number;
  supplierId?: number;
  bidCompCode?: string;
  legacySorId?: number;
  status?: PlatformStatus;
  remark?: string;
  version: number;
}

export type BusinessProjectPageResponse =
  PlatformPageResponse<BusinessProjectItem>;
export type BusinessFactoryListResponse = PlatformPageResponse<BusinessFactoryItem>;
export type SorPageResponse = PlatformPageResponse<SorItem>;
export type VehicleModelPageResponse = PlatformPageResponse<VehicleModelItem>;

export interface BudgetGradeItem {
  gradeId: BackendId;
  legacyGradeId?: number | null;
  gradeName: string;
  gradeCode: string;
  parentId: number;
  fullPathIds?: string | null;
  gradeLevel: number;
  sortOrder: number;
  status: PlatformStatus;
  enabled: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  version: number;
  children?: BudgetGradeItem[];
}

export interface BudgetGradeCreateRequest {
  gradeName: string;
  gradeCode: string;
  parentId?: number;
  sortOrder?: number;
  legacyGradeId?: number;
}

export interface BudgetGradeUpdateRequest {
  gradeName: string;
  gradeCode: string;
  parentId?: number;
  sortOrder?: number;
  status?: PlatformStatus;
  version?: number;
}

export interface RevenueSubjectItem {
  subjectId: BackendId;
  legacySubjectId?: number | null;
  subjectCode: string;
  subjectName: string;
  unit?: string | null;
  vehicleSourceType?: "OWN" | "COMPETITOR" | string | null;
  parentId?: number | null;
  subjectLevel: number;
  treePath?: string | null;
  fullNamePath?: string | null;
  sortNo: number;
  leafFlag: boolean;
  enabledFlag: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RevenueSubjectSaveRequest {
  subjectCode: string;
  subjectName: string;
  unit?: string;
  vehicleSourceType?: "OWN" | "COMPETITOR";
  parentId?: number;
  subjectLevel?: number;
  sortNo?: number;
  leafFlag?: boolean;
  enabledFlag?: boolean;
}
