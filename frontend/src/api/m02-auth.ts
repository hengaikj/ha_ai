import { ApiBusinessError, httpClient } from "@/api/http";

interface M02Envelope<T> {
  success: boolean;
  requestId: string;
  data: T;
}

async function m02Request<T>(config: { url: string; method: string; data?: unknown }): Promise<T> {
  const response = await httpClient.request<M02Envelope<T>>(config);
  const body = response.data;
  if (!body?.success) {
    throw new ApiBusinessError({
      code: "M02-API-ERROR",
      message: "M02 接口请求失败",
      traceId: body?.requestId,
    });
  }
  return body.data;
}

export type M02UserStatus = "ACTIVE" | "DISABLED";

export interface M02UserSummary {
  userId: number;
  username: string;
  displayName: string;
  enterpriseId: number | null;
  status: M02UserStatus;
  roleCodes: string[];
}

export interface M02RoleSummary {
  roleId: number;
  roleCode: string;
  displayName: string;
}

export interface M02EnterpriseOption {
  enterpriseId: number;
  displayName: string;
}

export interface M02CreateUserRequest {
  username: string;
  password: string;
  displayName: string;
  enterpriseId?: number;
  roleCodes?: string[];
}

export interface M02UserStatusRequest {
  status: M02UserStatus;
}

export interface M02UserRoleBindingRequest {
  roleCodes: string[];
}

export function fetchM02Users(): Promise<M02UserSummary[]> {
  return m02Request<M02UserSummary[]>({
    url: "/auth/users",
    method: "get",
  });
}

export function createM02User(
  data: M02CreateUserRequest,
): Promise<M02UserSummary> {
  return m02Request<M02UserSummary>({
    url: "/auth/users",
    method: "post",
    data,
  });
}

export function changeM02UserStatus(
  userId: number,
  data: M02UserStatusRequest,
): Promise<M02UserSummary> {
  return m02Request<M02UserSummary>({
    url: `/auth/users/${userId}/status`,
    method: "post",
    data,
  });
}

export function fetchM02Roles(): Promise<M02RoleSummary[]> {
  return m02Request<M02RoleSummary[]>({
    url: "/auth/roles",
    method: "get",
  });
}

export function fetchM02EnterpriseOptions(): Promise<M02EnterpriseOption[]> {
  return m02Request<M02EnterpriseOption[]>({
    url: "/auth/enterprises/options",
    method: "get",
  });
}

export function bindM02UserRoles(
  userId: number,
  data: M02UserRoleBindingRequest,
): Promise<M02UserSummary> {
  return m02Request<M02UserSummary>({
    url: `/auth/users/${userId}/roles`,
    method: "put",
    data,
  });
}
