import { httpClient, request } from "@/api/http";
import { joinIds, mapTableData } from "@/api/system/common";
import type {
  SystemId,
  SystemPageResponse,
  SysDept,
  SysUser,
  SysUserProfile,
  SysUserProfilePayload,
  SysUserQuery,
  TableDataInfo,
} from "@/types/system";
import type { PlatformUserQuery } from "@/types/platform-system";

export interface SystemUserImportResponse {
  total: number;
  success: number;
  failure: number;
  errors: string[];
}

function readProfileUser(payload: Record<string, unknown>): SysUserProfile {
  const rawUser =
    typeof payload.user === "object" && payload.user !== null
      ? (payload.user as Record<string, unknown>)
      : payload;
  return {
    ...(rawUser as SysUserProfile),
    roleGroup:
      typeof payload.roleGroup === "string"
        ? payload.roleGroup
        : (rawUser as SysUserProfile).roleGroup,
    postGroup:
      typeof payload.postGroup === "string"
        ? payload.postGroup
        : (rawUser as SysUserProfile).postGroup,
  };
}

export async function fetchUsersPage(
  params?: SysUserQuery,
): Promise<SystemPageResponse<SysUser>> {
  const response = await httpClient.request<TableDataInfo<SysUser>>({
    url: "/system/user/list",
    method: "get",
    params,
  });
  return mapTableData(response.data, params);
}

export function fetchUserDetail(
  userId: SystemId,
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>({
    url: `/system/user/${userId}`,
    method: "get",
  });
}

export function createUser(data: SysUser): Promise<void> {
  return request<void>({
    url: "/system/user",
    method: "post",
    data,
  });
}

export function updateUser(data: SysUser): Promise<void> {
  return request<void>({
    url: "/system/user",
    method: "put",
    data,
  });
}

export function deleteUsers(userIds: SystemId | SystemId[]): Promise<void> {
  return request<void>({
    url: `/system/user/${joinIds(userIds)}`,
    method: "delete",
  });
}

export function resetUserPassword(
  userId: SystemId,
  password: string,
): Promise<void> {
  return request<void>({
    url: "/system/user/resetPwd",
    method: "put",
    data: { userId, password },
  });
}

export function changeUserStatus(
  userId: SystemId,
  status: SysUser["status"],
): Promise<void> {
  return request<void>({
    url: "/system/user/changeStatus",
    method: "put",
    data: { userId, status },
  });
}

export function fetchUserAuthRoles(
  userId: SystemId,
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>({
    url: `/system/user/authRole/${userId}`,
    method: "get",
  });
}

export function updateUserAuthRoles(data: {
  userId: SystemId;
  roleIds: SystemId[];
}): Promise<void> {
  return request<void>({
    url: "/system/user/authRole",
    method: "put",
    params: {
      userId: data.userId,
      roleIds: joinIds(data.roleIds),
    },
  });
}

export function fetchUserDeptTree(params?: SysDept): Promise<unknown[]> {
  return request<unknown[]>({
    url: "/system/user/deptTree",
    method: "get",
    params,
  });
}

export async function exportUsers(
  params?: SysUserQuery | PlatformUserQuery,
): Promise<Blob> {
  const platformParams = params as PlatformUserQuery | undefined;
  const rawStatus = platformParams?.status ?? (params as SysUserQuery)?.status;
  const response = await httpClient.request<Blob>({
    url: "/system/user/export",
    method: "post",
    params: {
      pageNum: platformParams?.pageNo ?? (params as SysUserQuery)?.pageNum,
      pageSize: platformParams?.pageSize ?? (params as SysUserQuery)?.pageSize,
      userName:
        platformParams?.username ?? (params as SysUserQuery)?.userName,
      nickName: platformParams?.displayName,
      phonenumber:
        platformParams?.phone ?? (params as SysUserQuery)?.phonenumber,
      deptId:
        platformParams?.deptExternalId ?? (params as SysUserQuery)?.deptId,
      status:
        rawStatus === "ENABLED"
          ? "0"
          : rawStatus === "DISABLED"
            ? "1"
            : rawStatus,
      "params[beginTime]":
        platformParams?.createdFrom ?? (params as SysUserQuery)?.beginTime,
      "params[endTime]":
        platformParams?.createdTo ?? (params as SysUserQuery)?.endTime,
    },
    responseType: "blob",
  });
  return response.data;
}

export async function fetchUserProfile(): Promise<SysUserProfile> {
  const result = await request<Record<string, unknown>>({
    url: "/system/user/profile",
    method: "get",
  });
  return readProfileUser(result);
}

export function updateUserProfile(data: SysUserProfilePayload): Promise<void> {
  return request<void>({
    url: "/system/user/profile",
    method: "put",
    data,
  });
}

export function updateUserProfilePassword(data: {
  oldPassword: string;
  newPassword: string;
}): Promise<void> {
  return request<void>({
    url: "/system/user/profile/updatePwd",
    method: "put",
    params: data,
  });
}

export async function downloadUserImportTemplate(): Promise<Blob> {
  const response = await httpClient.request<Blob>({
    url: "/system/user/importTemplate",
    method: "get",
    responseType: "blob",
  });
  return response.data;
}

export function importUsers(
  file: File,
  updateSupport: boolean,
): Promise<SystemUserImportResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return request<Record<string, unknown>>({
    url: "/system/user/importData",
    method: "post",
    params: { updateSupport },
    data: formData,
  }).then((result) => {
    const summary =
      String(result.summary ?? result.msg ?? result.message ?? result ?? "");
    const success = Number(
      summary.match(/成功[^！!]*[！!]?共\s*(\d+)\s*条/)?.[1] ?? 0,
    );
    const failure = Number(
      summary.match(/失败[^！!]*[！!]?共\s*(\d+)\s*条/)?.[1] ?? 0,
    );
    return {
      total: success + failure,
      success,
      failure,
      errors: failure > 0 ? [summary.replace(/<br\s*\/?\s*>/gi, "\n")] : [],
    };
  });
}
