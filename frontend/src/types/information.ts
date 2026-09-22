import type {
  PlatformPageQuery,
  PlatformPageResponse,
  PlatformStatus,
} from "@/types/platform-system";

export type BackendId = string | number;

export type InformationDictionaryModuleType =
  | "revenue-templates"
  | "competitors"
  | "competitor-patterns"
  | "formulas"
  | "preset-columns";

export interface InformationDictionaryItem {
  itemId: BackendId;
  moduleType: InformationDictionaryModuleType;
  code: string;
  name: string;
  businessType?: string | null;
  brand?: string | null;
  factory?: string | null;
  level?: string | null;
  competitorName?: string | null;
  expression?: string | null;
  required?: boolean | null;
  moduleId?: string | null;
  moduleName?: string | null;
  groupName?: string | null;
  columnFieldJson?: string | null;
  parentId?: BackendId | null;
  children?: InformationDictionaryItem[] | null;
  sortNo: number;
  status: PlatformStatus;
  remark?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version: number;
}

export interface InformationDictionaryQuery extends PlatformPageQuery {
  keyword?: string;
  name?: string;
  brand?: string;
  factory?: string;
  status?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
}

export type InformationDictionaryPageResponse =
  PlatformPageResponse<InformationDictionaryItem>;

export interface InformationKanbanQuery extends PlatformPageQuery {
  keyword?: string;
}

export interface CurrentProductionKanbanItem {
  id: BackendId;
  company?: string | null;
  subCompany?: string | null;
  status?: string | null;
  brand?: string | null;
  carModel?: string | null;
  versionType?: string | null;
  salesVolume?: string | null;
  salesCompletionRate?: string | null;
  operatingIncome?: string | null;
  revenueCompletionRate?: string | null;
  totalProfit?: string | null;
  profitCompletionRate?: string | null;
  profitMargin?: string | null;
  marginalContribution?: string | null;
  marginalContributionRate?: string | null;
  msrp?: string | null;
  tp?: string | null;
  cost?: string | null;
  createdAt?: string | null;
}

export interface MechanizedKanbanItem {
  id: BackendId;
  company?: string | null;
  businessLine?: string | null;
  orderNo?: string | null;
  procurementAmount?: number | string | null;
  procurementResultAmount?: number | string | null;
  costReductionAmount?: number | string | null;
  costReductionRate?: number | string | null;
  requirementConfirmationDate?: string | null;
  procurementResultsEndDate?: string | null;
  procurementResultsEndMonth?: string | null;
  procurementAmountCompletionRate?: number | string | null;
  procurementCycle?: number | null;
}

export type CurrentProductionKanbanPageResponse =
  PlatformPageResponse<CurrentProductionKanbanItem>;

export type MechanizedKanbanPageResponse =
  PlatformPageResponse<MechanizedKanbanItem>;

export interface InformationKanbanImportResponse {
  success: number;
}

export interface InformationDictionaryImportResponse {
  success: number;
}

export interface InformationDictionaryPayload {
  code: string;
  name: string;
  businessType?: string | null;
  brand?: string | null;
  factory?: string | null;
  level?: string | null;
  competitorName?: string | null;
  expression?: string | null;
  required?: boolean;
  moduleId?: string | null;
  moduleName?: string | null;
  groupName?: string | null;
  columnFieldJson?: string | null;
  sortNo?: number;
  status?: string;
  remark?: string | null;
  version?: number;
}
