import { httpClient, request } from "@/api/http";

export type UserDataPermissionType = "0" | "1" | "2" | "3" | "4";
export type PermissionId = string | number;

export interface UserDataPermissionProject {
  id: PermissionId;
  projectName: string;
  company?: string;
  vehicleModel?: {
    modelName?: string;
    company?: string;
  };
  wbsNumber?: string;
  projectCode?: string;
  projectNo?: string;
  [key: string]: unknown;
}

export interface UserDataPermissionTreeNode {
  id: PermissionId;
  name: string;
  parentCode?: string;
  children?: UserDataPermissionTreeNode[];
  [key: string]: unknown;
}

export interface RevenuePermissionNode {
  id: PermissionId;
  subjectId?: PermissionId;
  subjectName?: string;
  name?: string;
  parentId?: PermissionId | null;
  children?: RevenuePermissionNode[];
  directPermissionConfigured?: boolean;
  directPermissionId?: PermissionId | null;
  directPermissionLevel?: string | null;
  directGrantScope?: string | null;
  directEnabled?: boolean;
  directRemark?: string | null;
  effectivePermissionLevel?: string | null;
  permissionLevel?: string | null;
  grantScope?: string | null;
  permissionScope?: string | null;
  scope?: string | null;
}

export interface RevenueSubjectPermission {
  subjectId: PermissionId;
  permissionLevel: string;
  grantScope: string;
  remark?: string;
}

export function fetchUserPermissionProjects(): Promise<
  UserDataPermissionProject[]
> {
  return request<UserDataPermissionProject[]>({
    url: "/system/project/options",
    method: "get",
  });
}

export function fetchBudgetGradeTree(params?: {
  projectId?: PermissionId;
  userId?: PermissionId;
  type?: UserDataPermissionType;
}): Promise<UserDataPermissionTreeNode[]> {
  return request<UserDataPermissionTreeNode[]>({
    url: "/system/grade/tree",
    method: "get",
    params,
  });
}

export function fetchCostCategoryTree(): Promise<UserDataPermissionTreeNode[]> {
  return request<UserDataPermissionTreeNode[]>({
    url: "/system/project/permission/getCostBomCategory",
    method: "get",
  });
}

export function fetchProjectGrantList(
  userId: PermissionId,
  type: UserDataPermissionType,
): Promise<PermissionId[]> {
  return request<PermissionId[]>({
    url: `/system/project/permission/grant/list/${userId}/${type}`,
    method: "get",
  });
}

export function saveProjectGrantState(data: {
  projectId: PermissionId;
  userId: PermissionId;
  type: UserDataPermissionType;
  status: 0 | 1;
}): Promise<void> {
  return request<void>({
    url: "/system/project/permission/grant",
    method: "post",
    data,
  });
}

export function fetchProjectDataGrantList(params: {
  projectId: PermissionId;
  userId: PermissionId;
  type: UserDataPermissionType;
}): Promise<PermissionId[]> {
  return request<PermissionId[]>({
    url: "/system/project/data/permission/grant/list",
    method: "get",
    params,
  });
}

export function saveProjectDataGrant(data: {
  projectId: PermissionId;
  userId: PermissionId;
  dataType: UserDataPermissionType;
  gradeId: PermissionId[];
}): Promise<void> {
  return request<void>({
    url: "/system/project/data/permission/grant",
    method: "post",
    data,
  });
}

export function fetchRevenuePermissionTree(params: {
  userId: PermissionId;
  projectId: PermissionId;
}): Promise<RevenuePermissionNode[]> {
  return httpClient
    .request<unknown>({
      baseURL: "",
      url: "/prod-revenue-api/user-period-expense-subject-permissions/tree",
      method: "get",
      params,
    })
    .then((response) => extractRevenueNodes(response.data));
}

function extractRevenueNodes(value: unknown): RevenuePermissionNode[] {
  if (Array.isArray(value)) return value as RevenuePermissionNode[];
  if (!value || typeof value !== "object") return [];

  const body = value as {
    data?: unknown;
    subjects?: unknown;
  };
  if (body.data !== undefined) return extractRevenueNodes(body.data);
  if (body.subjects !== undefined) return extractRevenueNodes(body.subjects);
  return [];
}

export function saveRevenueSubjectPermissions(data: {
  userId: string;
  projectId: PermissionId;
  grantedById: string;
  grantedByName: string;
  grantedByPermission: string;
  permissions: RevenueSubjectPermission[];
}): Promise<void> {
  return httpClient.request<void>({
    baseURL: "",
    url: "/prod-revenue-api/user-period-expense-subject-permissions",
    method: "post",
    data,
  }).then(() => undefined);
}
