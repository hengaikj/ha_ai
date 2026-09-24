import { request } from "@/api/http";

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
  return request<M02UserSummary[]>({
    url: "/auth/users",
    method: "get",
  });
}

export function createM02User(
  data: M02CreateUserRequest,
): Promise<M02UserSummary> {
  return request<M02UserSummary>({
    url: "/auth/users",
    method: "post",
    data,
  });
}

export function changeM02UserStatus(
  userId: number,
  data: M02UserStatusRequest,
): Promise<M02UserSummary> {
  return request<M02UserSummary>({
    url: `/auth/users/${userId}/status`,
    method: "post",
    data,
  });
}

export function fetchM02Roles(): Promise<M02RoleSummary[]> {
  return request<M02RoleSummary[]>({
    url: "/auth/roles",
    method: "get",
  });
}

export function fetchM02EnterpriseOptions(): Promise<M02EnterpriseOption[]> {
  return request<M02EnterpriseOption[]>({
    url: "/auth/enterprises/options",
    method: "get",
  });
}

export function bindM02UserRoles(
  userId: number,
  data: M02UserRoleBindingRequest,
): Promise<M02UserSummary> {
  return request<M02UserSummary>({
    url: `/auth/users/${userId}/roles`,
    method: "put",
    data,
  });
}
