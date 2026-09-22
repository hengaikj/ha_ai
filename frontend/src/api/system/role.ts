import { httpClient, request } from "@/api/http";
import { joinIds, mapTableData } from "@/api/system/common";
import type {
  SystemId,
  SystemPageResponse,
  SysRole,
  SysRoleQuery,
  SysUser,
  TableDataInfo,
} from "@/types/system";

export async function fetchRolesPage(
  params?: SysRoleQuery,
): Promise<SystemPageResponse<SysRole>> {
  const response = await httpClient.request<TableDataInfo<SysRole>>({
    url: "/system/role/list",
    method: "get",
    params,
  });
  return mapTableData(response.data, params);
}

export function fetchRoleDetail(roleId: SystemId): Promise<SysRole> {
  return request<SysRole>({
    url: `/system/role/${roleId}`,
    method: "get",
  });
}

export function createRole(data: SysRole): Promise<void> {
  return request<void>({
    url: "/system/role",
    method: "post",
    data,
  });
}

export function updateRole(data: SysRole): Promise<void> {
  return request<void>({
    url: "/system/role",
    method: "put",
    data,
  });
}

export function deleteRoles(roleIds: SystemId | SystemId[]): Promise<void> {
  return request<void>({
    url: `/system/role/${joinIds(roleIds)}`,
    method: "delete",
  });
}

export function changeRoleStatus(
  roleId: SystemId,
  status: SysRole["status"],
): Promise<void> {
  return request<void>({
    url: "/system/role/changeStatus",
    method: "put",
    data: { roleId, status },
  });
}

export function grantRoleDataScope(
  data: Pick<SysRole, "roleId" | "dataScope" | "deptIds">,
): Promise<void> {
  return request<void>({
    url: "/system/role/dataScope",
    method: "put",
    data,
  });
}

export function fetchRoleOptions(): Promise<SysRole[]> {
  return request<SysRole[]>({
    url: "/system/role/optionselect",
    method: "get",
  });
}

export async function fetchAllocatedRoleUsers(
  params: SysUser & { roleId: SystemId } & {
    pageNum?: number;
    pageSize?: number;
  },
): Promise<SystemPageResponse<SysUser>> {
  const response = await httpClient.request<TableDataInfo<SysUser>>({
    url: "/system/role/authUser/allocatedList",
    method: "get",
    params,
  });
  return mapTableData(response.data, params);
}

export async function fetchUnallocatedRoleUsers(
  params: SysUser & { roleId: SystemId } & {
    pageNum?: number;
    pageSize?: number;
  },
): Promise<SystemPageResponse<SysUser>> {
  const response = await httpClient.request<TableDataInfo<SysUser>>({
    url: "/system/role/authUser/unallocatedList",
    method: "get",
    params,
  });
  return mapTableData(response.data, params);
}

export function cancelRoleUser(data: {
  roleId: SystemId;
  userId: SystemId;
}): Promise<void> {
  return request<void>({
    url: "/system/role/authUser/cancel",
    method: "put",
    data,
  });
}

export function cancelRoleUsers(data: {
  roleId: SystemId;
  userIds: SystemId[];
}): Promise<void> {
  return request<void>({
    url: "/system/role/authUser/cancelAll",
    method: "put",
    params: {
      roleId: data.roleId,
      userIds: joinIds(data.userIds),
    },
  });
}

export function selectRoleUsers(data: {
  roleId: SystemId;
  userIds: SystemId[];
}): Promise<void> {
  return request<void>({
    url: "/system/role/authUser/selectAll",
    method: "put",
    params: {
      roleId: data.roleId,
      userIds: joinIds(data.userIds),
    },
  });
}

export function fetchRoleDeptTree(
  roleId: SystemId,
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>({
    url: `/system/role/deptTree/${roleId}`,
    method: "get",
  });
}

export async function exportRoles(params?: SysRoleQuery): Promise<Blob> {
  const response = await httpClient.request<Blob>({
    url: "/system/role/export",
    method: "post",
    params,
    responseType: "blob",
  });
  return response.data;
}
