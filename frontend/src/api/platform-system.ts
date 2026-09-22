import { httpClient, request } from "@/api/http";
import {
  mockFetchPlatformDepts,
  mockFetchPlatformDictItems,
} from "@/api/mock/committee.mock";
import { isCommitteeMockEnabled } from "@/api/mock/mock-mode";
import { joinIds, mapTableData } from "@/api/system/common";
import type {
  PlatformDictItemCreateRequest,
  PlatformDictItemDetail,
  PlatformDictItemQuery,
  PlatformDictItemUpdateRequest,
  PlatformDictTypeCreateRequest,
  PlatformDictTypeDetail,
  PlatformDictTypeQuery,
  PlatformDictTypeUpdateRequest,
  PlatformDeptCreateRequest,
  PlatformDeptItem,
  PlatformDeptQuery,
  PlatformDeptUpdateRequest,
  PlatformId,
  PlatformLoginLogItem,
  PlatformLoginLogQuery,
  PlatformLogStatus,
  PlatformMenuCreateRequest,
  PlatformMenuItem,
  PlatformMenuQuery,
  PlatformMenuType,
  PlatformMenuUpdateRequest,
  PlatformOperationLogItem,
  PlatformOperationLogQuery,
  PlatformPageResponse,
  PlatformPostCreateRequest,
  PlatformPostItem,
  PlatformPostQuery,
  PlatformPostUpdateRequest,
  PlatformRoleAuthorizationDetail,
  PlatformRoleCreateRequest,
  PlatformRoleDataScopeGrantRequest,
  PlatformRoleDataScopeGrantResponse,
  PlatformRoleItem,
  PlatformRoleMenuGrantResponse,
  PlatformRoleMenuTreeNode,
  PlatformRoleMenuTreeResponse,
  PlatformRoleUpdateRequest,
  PlatformRolePermissionDiffResponse,
  PlatformRolePermissionImpactResponse,
  PlatformPermissionItem,
  PlatformRoleQuery,
  PlatformStatus,
  PlatformSystemConfigCreateRequest,
  PlatformSystemConfigItem,
  PlatformSystemConfigQuery,
  PlatformSystemConfigRefreshResponse,
  PlatformSystemConfigUpdateRequest,
  PlatformUserCreateRequest,
  PlatformUserImportResponse,
  PlatformUserItem,
  PlatformUserPasswordResetResponse,
  PlatformUserQuery,
  PlatformUserRoleAssignResponse,
  PlatformUserSecurityDetail,
  PlatformUserTokenVersionResponse,
  PlatformUserUpdateRequest,
} from "@/types/platform-system";
import type { TableDataInfo } from "@/types/system";

type RuoyiStatus = "0" | "1";
type RuoyiLogStatus = "0" | "1";

type SysPost = {
  postId?: number;
  postCode?: string;
  postName?: string;
  postSort?: number;
  status?: RuoyiStatus;
  online?: boolean;
  locked?: boolean;
  remark?: string;
  createTime?: string;
};

type SysDept = {
  createBy?: string | null;
  createTime?: string | null;
  updateBy?: string | null;
  updateTime?: string | null;
  remark?: string | null;
  delFlag?: string | null;
  deptId?: number;
  parentId?: number | string;
  ancestors?: string;
  deptName?: string;
  orderNum?: number;
  leader?: string;
  phone?: string;
  email?: string;
  status?: RuoyiStatus;
  parentName?: string | null;
  children?: SysDept[];
};

type SysRole = {
  roleId?: number;
  roleName?: string;
  roleKey?: string;
  roleSort?: number;
  dataScope?: string;
  deptIds?: number[];
  menuIds?: number[];
  status?: RuoyiStatus;
  createTime?: string;
  menuCheckStrictly?: boolean;
};

type SysUser = {
  userId?: number;
  userName?: string;
  nickName?: string;
  phonenumber?: string;
  email?: string;
  sex?: string;
  deptId?: number;
  dept?: SysDept;
  postIds?: number[];
  roleIds?: number[];
  roles?: SysRole[];
  status?: RuoyiStatus;
  online?: boolean;
  locked?: boolean;
  remark?: string;
  createTime?: string;
};

type SysUserDetailResponse = {
  data?: SysUser;
  postIds?: number[];
  roleIds?: number[];
};

type SysMenu = {
  menuId?: number;
  parentId?: number | string;
  menuName?: string;
  menuType?: "M" | "C" | "F";
  path?: string;
  routeName?: string;
  component?: string;
  query?: string;
  perms?: string;
  icon?: string;
  orderNum?: number;
  visible?: "0" | "1";
  isCache?: "0" | "1";
  isFrame?: "0" | "1";
  status?: RuoyiStatus;
  createTime?: string;
  children?: SysMenu[];
};

type SysDictType = {
  dictId?: number;
  dictName?: string;
  dictType?: string;
  status?: RuoyiStatus;
  remark?: string;
  createTime?: string;
};

type SysDictData = {
  dictCode?: number;
  dictSort?: number;
  dictLabel?: string;
  dictValue?: string;
  dictType?: string;
  cssClass?: string;
  listClass?: string;
  isDefault?: "Y" | "N";
  status?: RuoyiStatus;
  remark?: string;
  createTime?: string;
};

type SysConfig = {
  configId?: number;
  configName?: string;
  configKey?: string;
  configValue?: string;
  configType?: "Y" | "N";
  status?: RuoyiStatus;
  remark?: string;
  createTime?: string;
};

type SysLoginLog = {
  infoId?: number;
  userName?: string;
  ipaddr?: string;
  loginLocation?: string;
  browser?: string;
  os?: string;
  status?: RuoyiLogStatus;
  msg?: string;
  loginTime?: string;
};

type SysOperationLog = {
  operId?: number;
  title?: string;
  businessType?: string | number;
  method?: string;
  requestMethod?: string;
  operatorType?: string | number;
  operName?: string;
  deptName?: string;
  operUrl?: string;
  operIp?: string;
  operLocation?: string;
  operParam?: string;
  jsonResult?: string;
  status?: RuoyiLogStatus;
  errorMsg?: string;
  operTime?: string;
  costTime?: number;
};

function toRuoyiStatus(status?: string): RuoyiStatus | undefined {
  if (!status) {
    return undefined;
  }
  if (status === "0" || status === "1") {
    return status;
  }
  if (status === "ENABLED") {
    return "0";
  }
  if (status === "DISABLED") {
    return "1";
  }
  return undefined;
}

function fromRuoyiStatus(status?: string): PlatformStatus {
  return status === "1" ? "DISABLED" : "ENABLED";
}

function definedFields<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<T>;
}

function toRuoyiLogStatus(
  status?: PlatformLogStatus,
): RuoyiLogStatus | undefined {
  if (!status) {
    return undefined;
  }
  return status === "SUCCESS" ? "0" : "1";
}

function fromRuoyiLogStatus(status?: string): PlatformLogStatus {
  return status === "1" ? "FAILED" : "SUCCESS";
}

function toPageNo(pageNo?: number): number | undefined {
  return pageNo;
}

function toPageSize(pageSize?: number): number | undefined {
  return pageSize;
}

function mapPage<TSource, TTarget>(
  payload: TableDataInfo<TSource>,
  mapper: (item: TSource) => TTarget,
  pageNo?: number,
  pageSize?: number,
): PlatformPageResponse<TTarget> {
  const page = mapTableData(payload, {
    pageNum: pageNo,
    pageSize,
  });
  return {
    records: page.records.map(mapper),
    total: page.total,
    pageNo: pageNo ?? 1,
    pageSize: pageSize ?? page.records.length,
  };
}

function downloadBlob(blob: Blob, fallbackName: string): Blob {
  Object.defineProperty(blob, "name", {
    value: fallbackName,
    configurable: true,
  });
  return blob;
}

function buildTree<T>(
  items: T[],
  getId: (item: T) => PlatformId | undefined,
  getParentId: (item: T) => PlatformId | undefined,
  setChildren: (item: T, children: T[]) => T,
): T[] {
  const mappedItems = items.map((item) => setChildren(item, []));
  const itemMap = new Map<string, T>();
  for (const item of mappedItems) {
    const id = getId(item);
    if (id !== undefined && id !== null) {
      itemMap.set(String(id), item);
    }
  }

  const roots: T[] = [];
  const childrenByParent = new Map<string, T[]>();
  for (const item of mappedItems) {
    const parentId = getParentId(item);
    const parentKey =
      parentId === undefined || parentId === null ? "0" : String(parentId);
    if (parentKey === "0" || !itemMap.has(parentKey)) {
      roots.push(item);
      continue;
    }
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(item);
    childrenByParent.set(parentKey, children);
  }

  function attach(item: T): T {
    const id = getId(item);
    const children =
      id === undefined || id === null
        ? []
        : (childrenByParent.get(String(id)) ?? []).map(attach);
    return setChildren(item, children);
  }

  return roots.map(attach);
}

function normalizeTree<T extends { children?: T[] }>(
  items: T[],
  getId: (item: T) => PlatformId | undefined,
  getParentId: (item: T) => PlatformId | undefined,
  setChildren: (item: T, children: T[]) => T,
): T[] {
  if (items.some((item) => item.children?.length)) {
    return items.map((item) =>
      setChildren(
        item,
        normalizeTree(item.children ?? [], getId, getParentId, setChildren),
      ),
    );
  }
  return buildTree(items, getId, getParentId, setChildren);
}

function mapPost(item: SysPost): PlatformPostItem {
  return {
    id: Number(item.postId ?? 0),
    postCode: item.postCode ?? "",
    postName: item.postName ?? "",
    postSort: item.postSort,
    status: fromRuoyiStatus(item.status),
    remark: item.remark,
    createdAt: item.createTime,
  };
}

function toPostPayload(
  data: PlatformPostCreateRequest | PlatformPostUpdateRequest,
  postId?: PlatformId,
): SysPost {
  return {
    postId: postId === undefined ? undefined : Number(postId),
    postCode: "postCode" in data ? data.postCode : undefined,
    postName: data.postName,
    postSort: data.postSort,
    status: toRuoyiStatus(data.status),
    remark: data.remark,
  };
}

function mapDept(item: SysDept): PlatformDeptItem {
  return {
    id: Number(item.deptId ?? 0),
    parentId: item.parentId ?? 0,
    deptCode: String(item.deptId ?? ""),
    deptName: item.deptName ?? "",
    ancestorPath: item.ancestors,
    sortNo: item.orderNum,
    leaderUserId: item.leader,
    phone: item.phone,
    email: item.email,
    status: fromRuoyiStatus(item.status),
    createdAt: item.createTime ?? undefined,
    children: (item.children ?? []).map(mapDept),
  };
}

function toDeptPayload(
  data: PlatformDeptCreateRequest | PlatformDeptUpdateRequest,
  deptId?: PlatformId,
): SysDept {
  return {
    deptId: deptId === undefined ? undefined : Number(deptId),
    parentId: data.parentId,
    deptName: data.deptName,
    orderNum: data.sortNo,
    leader:
      data.leaderUserId === undefined ? undefined : String(data.leaderUserId),
    phone: data.phone,
    email: data.email,
    status: toRuoyiStatus(data.status),
  };
}

export async function fetchPlatformDepts(
  params?: PlatformDeptQuery,
): Promise<PlatformDeptItem[]> {
  if (isCommitteeMockEnabled()) {
    return mockFetchPlatformDepts();
  }
  const response = await request<SysDept[]>({
    url: "/system/dept/list",
    method: "get",
    params: {
      deptName: params?.deptName || params?.keyword,
      status: toRuoyiStatus(params?.status),
    },
  });
  return normalizeTree(
    response.map(mapDept),
    (item) => item.id,
    (item) => item.parentId,
    (item, children) => ({ ...item, children }),
  );
}

/**
 * Loads the enabled organization tree for committee department configuration.
 * This endpoint intentionally bypasses user data-scope filtering because the
 * configuration is global, while remaining read-only and permission-scoped.
 */
export async function fetchCommitteeConfigPlatformDepts(): Promise<
  PlatformDeptItem[]
> {
  if (isCommitteeMockEnabled()) {
    return mockFetchPlatformDepts();
  }
  const response = await request<SysDept[]>({
    url: "/system/dept/committee-options",
    method: "get",
  });
  return normalizeTree(
    response.map(mapDept),
    (item) => item.id,
    (item) => item.parentId,
    (item, children) => ({ ...item, children }),
  );
}

export function fetchPlatformDeptDetail(
  deptId: PlatformId,
): Promise<PlatformDeptItem> {
  return request<SysDept>({
    url: `/system/dept/${deptId}`,
    method: "get",
  }).then(mapDept);
}

export function createPlatformDept(
  data: PlatformDeptCreateRequest,
): Promise<void> {
  return request<void>({
    url: "/system/dept",
    method: "post",
    data: toDeptPayload(data),
  });
}

export function updatePlatformDept(
  deptId: PlatformId,
  data: PlatformDeptUpdateRequest,
): Promise<void> {
  return request<SysDept>({
    url: `/system/dept/${deptId}`,
    method: "get",
  }).then((current) =>
    request<void>({
      url: "/system/dept",
      method: "put",
      data: buildDeptUpdatePayload(current, data, deptId),
    }),
  );
}

function buildDeptUpdatePayload(
  current: SysDept,
  data: PlatformDeptUpdateRequest,
  deptId: PlatformId,
): SysDept {
  const next = {
    ...current,
    ...definedFields(toDeptPayload(data, deptId)),
  };

  return {
    createBy: next.createBy ?? null,
    createTime: next.createTime ?? null,
    updateBy: next.updateBy ?? null,
    updateTime: next.updateTime ?? null,
    remark: next.remark ?? null,
    delFlag: next.delFlag ?? null,
    deptId: Number(next.deptId ?? deptId),
    parentId: next.parentId ?? 0,
    ancestors: next.ancestors ?? "",
    deptName: next.deptName ?? "",
    orderNum: next.orderNum ?? 0,
    leader: next.leader ?? "",
    phone: next.phone ?? "",
    email: next.email ?? "",
    status: next.status ?? "0",
    parentName: next.parentName ?? null,
    children: next.children ?? [],
  };
}

export function enablePlatformDept(deptId: PlatformId): Promise<void> {
  return updatePlatformDept(deptId, { status: "ENABLED" });
}

export function disablePlatformDept(deptId: PlatformId): Promise<void> {
  return updatePlatformDept(deptId, { status: "DISABLED" });
}

export function deletePlatformDept(deptId: PlatformId): Promise<void> {
  return request<void>({
    url: `/system/dept/${deptId}`,
    method: "delete",
  });
}

function toPlatformDataScope(value?: string): PlatformRoleItem["dataScope"] {
  if (value === "1") return "ALL";
  if (value === "2") return "CUSTOM_DEPT";
  if (value === "4") return "DEPT_AND_CHILD";
  if (value === "5") return "SELF";
  return "SELF_DEPT";
}

function toRuoyiDataScope(
  value?: PlatformRoleItem["dataScope"],
): string | undefined {
  if (value === "ALL") return "1";
  if (value === "CUSTOM_DEPT") return "2";
  if (value === "DEPT_AND_CHILD") return "4";
  if (value === "SELF") return "5";
  if (value === "SELF_DEPT") return "3";
  return undefined;
}

function mapRole(item: SysRole): PlatformRoleItem {
  return {
    id: Number(item.roleId ?? 0),
    roleCode: item.roleKey ?? "",
    roleName: item.roleName ?? "",
    dataScope: toPlatformDataScope(item.dataScope),
    status: fromRuoyiStatus(item.status),
    sortNo: item.roleSort,
    createdAt: item.createTime,
    menuCheckStrictly: item.menuCheckStrictly,
  };
}

function toRolePayload(
  data: PlatformRoleCreateRequest | PlatformRoleUpdateRequest,
  roleId?: PlatformId,
): SysRole {
  return {
    roleId: roleId === undefined ? undefined : Number(roleId),
    roleKey: "roleCode" in data ? data.roleCode : undefined,
    roleName: data.roleName,
    roleSort: data.sortNo,
    dataScope: toRuoyiDataScope(data.dataScope),
    status: toRuoyiStatus(data.status),
    menuIds: data.menuIds,
    menuCheckStrictly: data.menuCheckStrictly,
  };
}

export function fetchPlatformRoleMenuTree(
  roleId?: PlatformId,
): Promise<PlatformRoleMenuTreeResponse> {
  if (roleId === undefined) {
    return request<PlatformRoleMenuTreeNode[]>({
      url: "/system/menu/treeselect",
      method: "get",
    }).then((menus) => ({ menus, checkedKeys: [] }));
  }
  return request<PlatformRoleMenuTreeResponse>({
    url: `/system/menu/roleMenuTreeselect/${roleId}`,
    method: "get",
  });
}

export async function fetchPlatformRolesPage(
  params?: PlatformRoleQuery,
): Promise<PlatformPageResponse<PlatformRoleItem>> {
  const response = await httpClient.request<TableDataInfo<SysRole>>({
    url: "/system/role/list",
    method: "get",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      roleName: params?.roleName || params?.keyword,
      roleKey: params?.roleCode,
      status: toRuoyiStatus(params?.status),
      "params[beginTime]": params?.createdFrom,
      "params[endTime]": params?.createdTo,
    },
  });
  return mapPage(response.data, mapRole, params?.pageNo, params?.pageSize);
}

export async function fetchPlatformRoles(): Promise<PlatformRoleItem[]> {
  const roles = await request<SysRole[]>({
    url: "/system/role/optionselect",
    method: "get",
  });
  return roles.map(mapRole);
}

export function fetchPlatformRoleDetail(
  roleId: PlatformId,
): Promise<PlatformRoleItem> {
  return fetchSysRole(roleId).then(mapRole);
}

export function createPlatformRole(
  data: PlatformRoleCreateRequest,
): Promise<PlatformRoleItem> {
  return request<void>({
    url: "/system/role",
    method: "post",
    data: toRolePayload(data),
  }).then(async () => {
    const page = await fetchPlatformRolesPage({
      roleCode: data.roleCode,
      pageNo: 1,
      pageSize: 10,
    });
    const created = page.records.find(
      (role) => role.roleCode === data.roleCode,
    );
    if (!created) throw new Error("角色已创建，但无法读取新角色编号");
    return created;
  });
}

export function updatePlatformRole(
  roleId: PlatformId,
  data: PlatformRoleUpdateRequest,
): Promise<PlatformRoleItem> {
  return fetchSysRole(roleId).then((current) => {
    const payload = {
      ...current,
      ...definedFields(toRolePayload(data, roleId)),
    };
    return request<void>({
      url: "/system/role",
      method: "put",
      data: payload,
    }).then(() => mapRole(payload));
  });
}

function fetchSysRole(roleId: PlatformId): Promise<SysRole> {
  return request<SysRole>({ url: `/system/role/${roleId}`, method: "get" });
}

export function enablePlatformRole(
  roleId: PlatformId,
): Promise<void> {
  return request<void>({
    url: "/system/role/changeStatus",
    method: "put",
    data: { roleId, status: "0" },
  });
}

export function disablePlatformRole(
  roleId: PlatformId,
): Promise<void> {
  return request<void>({
    url: "/system/role/changeStatus",
    method: "put",
    data: { roleId, status: "1" },
  });
}

export function deletePlatformRole(roleId: PlatformId): Promise<void> {
  return request<void>({
    url: `/system/role/${roleId}`,
    method: "delete",
  });
}

export async function exportPlatformRoles(
  params?: PlatformRoleQuery,
): Promise<Blob> {
  const response = await httpClient.request<Blob>({
    url: "/system/role/export",
    method: "post",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      roleName: params?.roleName || params?.keyword,
      roleKey: params?.roleCode,
      status: toRuoyiStatus(params?.status),
      "params[beginTime]": params?.createdFrom,
      "params[endTime]": params?.createdTo,
    },
    responseType: "blob",
  });
  return downloadBlob(response.data, "角色数据.xlsx");
}

function mapUser(item: SysUser): PlatformUserItem {
  return {
    id: Number(item.userId ?? 0),
    username: item.userName ?? "",
    displayName: item.nickName,
    phone: item.phonenumber,
    deptId:
      item.deptId === undefined || item.deptId === null
        ? undefined
        : Number(item.deptId),
    deptExternalId:
      item.deptId === undefined || item.deptId === null
        ? undefined
        : String(item.deptId),
    status: fromRuoyiStatus(item.status),
    roleCodes: resolveUserRoleIds(item).map(String),
    postIds: (item.postIds ?? []).map(String),
    sex: item.sex,
    createdAt: item.createTime,
    online: Boolean(item.online),
    locked: Boolean(item.locked),
  };
}

function toUserPayload(
  data: PlatformUserCreateRequest | PlatformUserUpdateRequest,
  userId?: PlatformId,
): SysUser & { password?: string } {
  return {
    userId: userId === undefined ? undefined : Number(userId),
    userName: "username" in data ? data.username : undefined,
    nickName: data.displayName,
    phonenumber: data.phone,
    deptId:
      data.deptId ??
      (data.deptExternalId ? Number(data.deptExternalId) : undefined),
    postIds: data.postIds?.map(Number).filter(Number.isFinite),
    status: toRuoyiStatus(data.status),
    sex: data.sex,
    password: "initialPassword" in data ? data.initialPassword : undefined,
  };
}

async function resolveBackendRoleIds(roleCodes?: string[]): Promise<number[]> {
  const normalizedRoleCodes = (roleCodes ?? [])
    .map((roleCode) => roleCode.trim())
    .filter(Boolean);
  if (normalizedRoleCodes.length === 0) {
    return [];
  }

  const roles = await fetchPlatformRoles();
  return normalizedRoleCodes
    .map((roleCode) => {
      const roleId = roles.find((role) => role.roleCode === roleCode)?.id;
      if (roleId !== undefined) {
        return roleId;
      }
      const numericRoleId = Number(roleCode);
      return Number.isFinite(numericRoleId) ? numericRoleId : undefined;
    })
    .filter((roleId): roleId is number => roleId !== undefined);
}

export async function fetchPlatformUsersPage(
  params?: PlatformUserQuery,
): Promise<PlatformPageResponse<PlatformUserItem>> {
  const fallbackUserName =
    params?.username || params?.displayName || params?.phone
      ? undefined
      : params?.keyword;
  const response = await httpClient.request<TableDataInfo<SysUser>>({
    url: "/system/user/list",
    method: "get",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      userName: params?.username || fallbackUserName,
      nickName: params?.displayName,
      phonenumber: params?.phone,
      deptId: params?.deptId ?? params?.deptExternalId,
      status: toRuoyiStatus(params?.status),
      "params[endTime]": params?.createdTo,
      "params[beginTime]": params?.createdFrom,
    },
  });
  return mapPage(response.data, mapUser, params?.pageNo, params?.pageSize);
}

function resolveUserRoleIds(item: SysUser): number[] {
  const roleIds = (item.roles ?? [])
    .map((role) => role.roleId)
    .filter((roleId): roleId is number => roleId !== undefined);
  return roleIds.length > 0 ? roleIds : (item.roleIds ?? []);
}

export function fetchPlatformUserDetail(
  userId: PlatformId,
): Promise<PlatformUserItem> {
  return httpClient
    .request<SysUserDetailResponse>({
      url: `/system/user/${userId}`,
      method: "get",
    })
    .then((response) => {
      const body = response.data;
      return mapUser({
        ...(body.data ?? {}),
        postIds: body.postIds ?? body.data?.postIds,
        roleIds: body.roleIds ?? body.data?.roleIds,
      });
    });
}

export async function createPlatformUser(
  data: PlatformUserCreateRequest,
): Promise<void> {
  const roleIds = await resolveBackendRoleIds(data.roleCodes);
  return request<void>({
    url: "/system/user",
    method: "post",
    data: {
      ...toUserPayload(data),
      roleIds,
    },
  });
}

export function updatePlatformUser(
  userId: PlatformId,
  data: PlatformUserUpdateRequest,
): Promise<void> {
  return request<SysUser>({
    url: `/system/user/${userId}`,
    method: "get",
  }).then((current) =>
    request<void>({
      url: "/system/user",
      method: "put",
      data: { ...current, ...definedFields(toUserPayload(data, userId)) },
    }),
  );
}

export function enablePlatformUser(userId: PlatformId): Promise<void> {
  return request<void>({
    url: "/system/user/changeStatus",
    method: "put",
    data: { userId, status: "0" },
  });
}

export function disablePlatformUser(userId: PlatformId): Promise<void> {
  return request<void>({
    url: "/system/user/changeStatus",
    method: "put",
    data: { userId, status: "1" },
  });
}

export function deletePlatformUser(userId: PlatformId): Promise<void> {
  return deletePlatformUsers([userId]);
}

export function deletePlatformUsers(userIds: PlatformId[]): Promise<void> {
  return request<void>({
    url: `/system/user/${joinIds(userIds)}`,
    method: "delete",
  });
}

export async function exportPlatformUsers(
  params?: PlatformUserQuery,
): Promise<Blob> {
  const response = await httpClient.request<Blob>({
    url: "/system/user/export",
    method: "post",
    params,
    responseType: "blob",
  });
  return downloadBlob(response.data, "用户数据.xlsx");
}

export function importPlatformUsers(
  file: File,
): Promise<PlatformUserImportResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ summary?: string }>({
    url: "/system/user/importData",
    method: "post",
    params: { updateSupport: true },
    data: formData,
  }).then((result) => {
    const summary = result.summary ?? "";
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

export function resetPlatformUserPassword(
  userId: PlatformId,
  password: string,
): Promise<PlatformUserPasswordResetResponse> {
  return request<void>({
    url: "/system/user/resetPwd",
    method: "put",
    data: { userId, password },
  }).then(() => ({ userId: Number(userId), reset: true }));
}

export async function assignUserRoles(
  userId: PlatformId,
  roleCodes: string[],
): Promise<PlatformUserRoleAssignResponse> {
  const roleIds = await resolveBackendRoleIds(roleCodes);
  return request<void>({
    url: "/system/user/authRole",
    method: "put",
    params: {
      userId,
      roleIds: roleIds.join(","),
    },
  }).then(() => ({ userId: Number(userId), roleCodes }));
}

export function fetchPlatformUserSecurityDetail(
  userId: PlatformId,
): Promise<PlatformUserSecurityDetail> {
  return request<SysUser>({
    url: `/system/user/${userId}`,
    method: "get",
  }).then((user) => ({
    userId: Number(user.userId ?? userId),
    username: user.userName ?? "",
    displayName: user.nickName,
    userStatus: fromRuoyiStatus(user.status),
    credentialStatus: "NORMAL",
    failedAttempts: 0,
    passwordVersion: 0,
    tokenVersion: 0,
    roleCodes: (user.roles ?? [])
      .map((role) => role.roleId)
      .filter((roleId): roleId is number => roleId !== undefined)
      .map(String),
  }));
}

export function unlockPlatformUser(
  userId: PlatformId,
  _confirm?: { confirmReason?: string },
): Promise<PlatformUserSecurityDetail> {
  void _confirm;
  return fetchPlatformUserSecurityDetail(userId).then(async (detail) => {
    await request<void>({
      url: `/monitor/logininfor/unlock/${encodeURIComponent(detail.username)}`,
      method: "get",
    });
    return detail;
  });
}

export function revokePlatformUserSessions(
  userId: PlatformId,
  _confirm?: { confirmReason?: string },
): Promise<PlatformUserTokenVersionResponse> {
  void _confirm;
  return fetchPlatformUserSecurityDetail(userId).then(async (detail) => {
    await request<void>({
      url: `/monitor/online/user/${encodeURIComponent(detail.username)}`,
      method: "delete",
    });
    return { userId: Number(userId), revoked: true, tokenVersion: Date.now() };
  });
}

export async function fetchPlatformPermissions(): Promise<
  PlatformPermissionItem[]
> {
  const menus = flattenMenus(await fetchPlatformMenus());
  return menus
    .filter((menu) => Boolean(menu.permissionCode))
    .map((menu) => {
      const permissionCode = menu.permissionCode!;
      const [moduleCode = "", resourceCode = "", actionCode = ""] =
        permissionCode.split(":");
      return {
        id: Number(menu.id),
        permissionCode,
        permissionName: menu.menuName,
        moduleCode,
        resourceCode,
        actionCode,
        status: menu.status ?? "ENABLED",
      };
    });
}

export function fetchPlatformRoleAuthorization(
  roleId: PlatformId,
): Promise<PlatformRoleAuthorizationDetail> {
  return Promise.all([
    fetchSysRole(roleId),
    request<{ checkedKeys?: number[] }>({
      url: `/system/menu/roleMenuTreeselect/${roleId}`,
      method: "get",
    }),
    request<{ checkedKeys?: number[] }>({
      url: `/system/role/deptTree/${roleId}`,
      method: "get",
    }),
    fetchPlatformMenus(),
  ]).then(([role, menuTree, deptTree, menus]) => {
    const menuCodes = (menuTree.checkedKeys ?? []).map(String);
    const menuIds = new Set(menuCodes);
    return {
      roleId: Number(role.roleId ?? roleId),
      roleCode: role.roleKey ?? "",
      roleName: role.roleName ?? "",
      dataScope: toPlatformDataScope(role.dataScope),
      status: fromRuoyiStatus(role.status),
      permissionCodes: flattenMenus(menus)
        .filter((menu) => menuIds.has(String(menu.id)))
        .map((menu) => menu.permissionCode)
        .filter((code): code is string => Boolean(code)),
      menuCodes,
      customDeptIds: deptTree.checkedKeys ?? role.deptIds ?? [],
    };
  });
}

export function grantRoleMenus(
  roleId: PlatformId,
  menuCodes: string[],
): Promise<PlatformRoleMenuGrantResponse> {
  return fetchSysRole(roleId)
    .then((role) =>
      request<void>({
        url: "/system/role",
        method: "put",
        data: {
          ...role,
          roleId,
          menuIds: menuCodes.map(Number).filter(Number.isFinite),
        },
      }),
    )
    .then(() => ({ roleId: Number(roleId), menuCodes }));
}

export function grantRoleDataScope(
  roleId: PlatformId,
  data: PlatformRoleDataScopeGrantRequest,
): Promise<PlatformRoleDataScopeGrantResponse> {
  return request<void>({
    url: "/system/role/dataScope",
    method: "put",
    data: {
      roleId,
      dataScope: toRuoyiDataScope(data.dataScope),
      deptIds: data.deptIds,
    },
  }).then(() => ({
    roleId: Number(roleId),
    dataScope: data.dataScope,
    deptIds: data.deptIds ?? [],
  }));
}

export function fetchPlatformRolePermissionDiff(
  roleId: PlatformId,
  targetPermissionCodes: string[],
): Promise<PlatformRolePermissionDiffResponse> {
  return fetchPlatformRoleAuthorization(roleId).then((authorization) => {
    const current = new Set(authorization.permissionCodes);
    const target = new Set(targetPermissionCodes);
    const addedPermissionCodes = targetPermissionCodes.filter(
      (code) => !current.has(code),
    );
    return {
      roleId: Number(roleId),
      currentPermissionCodes: authorization.permissionCodes,
      targetPermissionCodes,
      addedPermissionCodes,
      removedPermissionCodes: authorization.permissionCodes.filter(
        (code) => !target.has(code),
      ),
      containsHighRiskPermission:
        addedPermissionCodes.some(isHighRiskPermission),
    };
  });
}

export function fetchPlatformRolePermissionImpact(
  roleId: PlatformId,
  targetPermissionCodes: string[],
): Promise<PlatformRolePermissionImpactResponse> {
  return Promise.all([
    fetchPlatformRolePermissionDiff(roleId, targetPermissionCodes),
    fetchSysRole(roleId),
    httpClient.request<TableDataInfo<SysUser>>({
      url: "/system/role/authUser/allocatedList",
      method: "get",
      params: { roleId, pageNum: 1, pageSize: 1 },
    }),
  ]).then(([diff, role, users]) => {
    const addedHighRiskPermissionCodes =
      diff.addedPermissionCodes.filter(isHighRiskPermission);
    return {
      ...diff,
      roleCode: role.roleKey ?? "",
      affectedUserCount: Number(users.data.total ?? 0),
      addedHighRiskPermissionCodes,
      containsHighRiskPermission: addedHighRiskPermissionCodes.length > 0,
    };
  });
}

function isHighRiskPermission(code: string): boolean {
  return /:(remove|delete|resetPwd|edit|import|clean|forceLogout)$/.test(code);
}

export async function fetchPlatformPostsPage(
  params?: PlatformPostQuery,
): Promise<PlatformPageResponse<PlatformPostItem>> {
  const response = await httpClient.request<TableDataInfo<SysPost>>({
    url: "/system/post/list",
    method: "get",
    params: {
      pageNum: toPageNo(params?.pageNo),
      pageSize: toPageSize(params?.pageSize),
      postId: params?.postId,
      postCode: params?.postCode,
      postName: params?.postName,
      status: toRuoyiStatus(params?.status),
      "params[beginTime]": params?.createdFrom,
      "params[endTime]": params?.createdTo,
    },
  });
  return mapPage(response.data, mapPost, params?.pageNo, params?.pageSize);
}

export function fetchPlatformPostDetail(
  postId: PlatformId,
): Promise<PlatformPostItem> {
  return request<SysPost>({
    url: `/system/post/${postId}`,
    method: "get",
  }).then(mapPost);
}

export function createPlatformPost(
  data: PlatformPostCreateRequest,
): Promise<void> {
  return request<void>({
    url: "/system/post",
    method: "post",
    data: toPostPayload(data),
  });
}

export function updatePlatformPost(
  postId: PlatformId,
  data: PlatformPostUpdateRequest,
): Promise<void> {
  return request<SysPost>({
    url: `/system/post/${postId}`,
    method: "get",
  }).then((current) =>
    request<void>({
      url: "/system/post",
      method: "put",
      data: { ...current, ...definedFields(toPostPayload(data, postId)) },
    }),
  );
}

export function enablePlatformPost(postId: PlatformId): Promise<void> {
  return updatePlatformPost(postId, { status: "ENABLED" });
}

export function disablePlatformPost(postId: PlatformId): Promise<void> {
  return updatePlatformPost(postId, { status: "DISABLED" });
}

export function deletePlatformPosts(postIds: PlatformId[]): Promise<void> {
  return request<void>({
    url: `/system/post/${joinIds(postIds)}`,
    method: "delete",
  });
}

export async function exportPlatformPosts(
  params?: PlatformPostQuery,
): Promise<Blob> {
  const response = await httpClient.request<Blob>({
    url: "/system/post/export",
    method: "post",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      postId: params?.postId,
      postCode: params?.postCode,
      postName: params?.postName,
      status: toRuoyiStatus(params?.status),
      "params[beginTime]": params?.createdFrom,
      "params[endTime]": params?.createdTo,
    },
    responseType: "blob",
  });
  return downloadBlob(response.data, "岗位数据.xlsx");
}

function toPlatformMenuType(type?: SysMenu["menuType"]): PlatformMenuType {
  if (type === "M") return "DIRECTORY";
  if (type === "F") return "BUTTON";
  return "PAGE";
}

function toRuoyiMenuType(type?: PlatformMenuType): SysMenu["menuType"] {
  if (type === "DIRECTORY") return "M";
  if (type === "BUTTON") return "F";
  return "C";
}

function mapMenu(item: SysMenu): PlatformMenuItem {
  const routePath = item.path
    ? item.path.startsWith("/")
      ? item.path
      : `/${item.path}`
    : "";
  return {
    id: Number(item.menuId ?? 0),
    menuId: item.menuId,
    parentId: item.parentId,
    menuCode: String(item.menuId ?? item.path ?? item.menuName ?? ""),
    menuName: item.menuName ?? "",
    menuType: toPlatformMenuType(item.menuType),
    routePath,
    path: routePath,
    routeName: item.routeName,
    componentPath: item.component,
    component: item.component,
    routeQuery: item.query,
    permissionCode: item.perms,
    perms: item.perms,
    icon: item.icon,
    sortNo: item.orderNum,
    orderNum: item.orderNum,
    visible: item.visible !== "1",
    cacheable: item.isCache !== "1",
    externalLink: item.isFrame === "0",
    status: fromRuoyiStatus(item.status),
    createdAt: item.createTime,
    children: item.children?.map(mapMenu) ?? [],
  };
}

function flattenMenus(items: PlatformMenuItem[]): PlatformMenuItem[] {
  return items.flatMap((item) => [item, ...flattenMenus(item.children ?? [])]);
}

function toMenuPayload(
  data: PlatformMenuCreateRequest | PlatformMenuUpdateRequest,
  menuId?: PlatformId,
): SysMenu {
  return {
    menuId: menuId === undefined ? undefined : Number(menuId),
    parentId: data.parentId,
    menuName: data.menuName,
    menuType: toRuoyiMenuType(data.menuType),
    path: data.routePath?.replace(/^\//, ""),
    routeName: data.routeName,
    component: data.componentPath,
    query: data.routeQuery,
    perms: "permissionCode" in data ? data.permissionCode : undefined,
    icon: data.icon,
    orderNum: data.sortNo,
    visible: data.visible === false ? "1" : "0",
    isCache: data.cacheable ? "0" : "1",
    isFrame: data.externalLink ? "0" : "1",
    status: toRuoyiStatus(data.status),
  };
}

export async function fetchPlatformMenus(
  params?: PlatformMenuQuery,
): Promise<PlatformMenuItem[]> {
  const response = await request<SysMenu[]>({
    url: "/system/menu/list",
    method: "get",
    params: {
      menuName: params?.menuName || params?.keyword,
      status: toRuoyiStatus(params?.status),
    },
  });
  return normalizeTree(
    response.map(mapMenu),
    (item) => item.id,
    (item) => item.parentId,
    (item, children) => ({ ...item, children }),
  );
}

export function fetchPlatformMenuDetail(
  menuId: PlatformId,
): Promise<PlatformMenuItem> {
  return request<SysMenu>({
    url: `/system/menu/${menuId}`,
    method: "get",
  }).then(mapMenu);
}

export function createPlatformMenu(
  data: PlatformMenuCreateRequest,
): Promise<void> {
  return request<void>({
    url: "/system/menu",
    method: "post",
    data: toMenuPayload(data),
  });
}

export function updatePlatformMenu(
  menuId: PlatformId,
  data: PlatformMenuUpdateRequest,
): Promise<void> {
  return request<void>({
    url: "/system/menu",
    method: "put",
    data: toMenuPayload(data, menuId),
  });
}

export async function enablePlatformMenu(menuId: PlatformId): Promise<void> {
  await updatePlatformMenu(menuId, {
    ...(await fetchPlatformMenuUpdatePatch(menuId)),
    status: "ENABLED",
  });
}

export async function disablePlatformMenu(menuId: PlatformId): Promise<void> {
  await updatePlatformMenu(menuId, {
    ...(await fetchPlatformMenuUpdatePatch(menuId)),
    status: "DISABLED",
  });
}

async function fetchPlatformMenuUpdatePatch(
  menuId: PlatformId,
): Promise<PlatformMenuUpdateRequest> {
  const menu = await request<SysMenu>({
    url: `/system/menu/${menuId}`,
    method: "get",
  });
  return {
    parentId: menu.parentId,
    menuName: menu.menuName,
    menuType: toPlatformMenuType(menu.menuType),
    routePath: menu.path,
    routeName: menu.routeName,
    componentPath: menu.component,
    routeQuery: menu.query,
    permissionCode: menu.perms,
    icon: menu.icon,
    sortNo: menu.orderNum,
    visible: menu.visible !== "1",
    cacheable: menu.isCache !== "1",
    externalLink: menu.isFrame === "0",
  };
}

export function deletePlatformMenu(menuId: PlatformId): Promise<void> {
  return request<void>({
    url: `/system/menu/${menuId}`,
    method: "delete",
  });
}

function mapConfig(item: SysConfig): PlatformSystemConfigItem {
  return {
    id: Number(item.configId ?? 0),
    configName: item.configName ?? "",
    configKey: item.configKey ?? "",
    configValue: item.configValue,
    systemBuiltin: item.configType === "Y",
    status: fromRuoyiStatus(item.status),
    remark: item.remark,
    createdAt: item.createTime,
  };
}

function toConfigPayload(
  data: PlatformSystemConfigCreateRequest | PlatformSystemConfigUpdateRequest,
  configId?: PlatformId,
): SysConfig {
  return {
    configId: configId === undefined ? undefined : Number(configId),
    configName: data.configName,
    configKey: "configKey" in data ? data.configKey : undefined,
    configValue: data.configValue,
    configType: data.systemBuiltin ? "Y" : "N",
    status: toRuoyiStatus(data.status),
    remark: data.remark,
  };
}

export async function fetchPlatformSystemConfigsPage(
  params?: PlatformSystemConfigQuery,
): Promise<PlatformPageResponse<PlatformSystemConfigItem>> {
  const response = await httpClient.request<TableDataInfo<SysConfig>>({
    url: "/system/config/list",
    method: "get",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      configName: params?.configName,
      configKey: params?.configKey,
      configType:
        params?.systemBuiltin === undefined
          ? undefined
          : params.systemBuiltin
            ? "Y"
            : "N",
      status: toRuoyiStatus(params?.status),
      "params[beginTime]": params?.createdFrom,
      "params[endTime]": params?.createdTo,
    },
  });
  return mapPage(response.data, mapConfig, params?.pageNo, params?.pageSize);
}

export function fetchPlatformSystemConfigDetail(
  configId: PlatformId,
): Promise<PlatformSystemConfigItem> {
  return request<SysConfig>({
    url: `/system/config/${configId}`,
    method: "get",
  }).then(mapConfig);
}

export async function fetchPlatformSystemConfigValue(
  configKey: string,
): Promise<string | undefined> {
  const value = await request<string>({
    url: `/system/config/configKey/${encodeURIComponent(configKey)}`,
    method: "get",
    skipErrorToast: true,
  });
  return value == null ? undefined : String(value);
}

export function createPlatformSystemConfig(
  data: PlatformSystemConfigCreateRequest,
): Promise<void> {
  return request<void>({
    url: "/system/config",
    method: "post",
    data: toConfigPayload(data),
  });
}

export function updatePlatformSystemConfig(
  configId: PlatformId,
  data: PlatformSystemConfigUpdateRequest,
): Promise<void> {
  return request<SysConfig>({
    url: `/system/config/${configId}`,
    method: "get",
  }).then((current) =>
    request<void>({
      url: "/system/config",
      method: "put",
      data: { ...current, ...definedFields(toConfigPayload(data, configId)) },
    }),
  );
}

export function enablePlatformSystemConfig(
  configId: PlatformId,
): Promise<void> {
  return updatePlatformSystemConfig(configId, { status: "ENABLED" });
}

export function disablePlatformSystemConfig(
  configId: PlatformId,
): Promise<void> {
  return updatePlatformSystemConfig(configId, { status: "DISABLED" });
}

export function deletePlatformSystemConfigs(
  configIds: PlatformId[],
): Promise<void> {
  return request<void>({
    url: `/system/config/${joinIds(configIds)}`,
    method: "delete",
  });
}

export async function refreshPlatformSystemConfigCache(): Promise<PlatformSystemConfigRefreshResponse> {
  await request<void>({
    url: "/system/config/refreshCache",
    method: "delete",
  });
  return { refreshed: true, refreshedAt: new Date().toISOString() };
}

export async function exportPlatformSystemConfigs(
  params?: PlatformSystemConfigQuery,
): Promise<Blob> {
  const response = await httpClient.request<Blob>({
    url: "/system/config/export",
    method: "post",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      configName: params?.configName,
      configKey: params?.configKey,
      configType:
        params?.systemBuiltin === undefined
          ? undefined
          : params.systemBuiltin
            ? "Y"
            : "N",
      status: toRuoyiStatus(params?.status),
      "params[beginTime]": params?.createdFrom,
      "params[endTime]": params?.createdTo,
    },
    responseType: "blob",
  });
  return response.data;
}

function mapDictType(item: SysDictType): PlatformDictTypeDetail {
  return {
    id: Number(item.dictId ?? 0),
    dictTypeCode: item.dictType ?? "",
    dictTypeName: item.dictName ?? "",
    status: fromRuoyiStatus(item.status),
    remark: item.remark,
    createdAt: item.createTime,
  };
}

function toDictTypePayload(
  data: PlatformDictTypeCreateRequest | PlatformDictTypeUpdateRequest,
  dictId?: PlatformId,
): SysDictType {
  const status = toRuoyiStatus(data.status);
  return {
    dictId: dictId === undefined ? undefined : Number(dictId),
    dictName: data.dictTypeName,
    dictType: "dictTypeCode" in data ? data.dictTypeCode : undefined,
    status,
    remark: data.remark,
  };
}

export async function fetchPlatformDictTypesPage(
  params?: PlatformDictTypeQuery,
): Promise<PlatformPageResponse<PlatformDictTypeDetail>> {
  const dictTypeCode = params?.dictTypeCode?.trim() || undefined;
  const dictTypeName = params?.dictTypeName?.trim() || undefined;
  const keyword = params?.keyword?.trim() || undefined;
  const response = await httpClient.request<TableDataInfo<SysDictType>>({
    url: "/system/dict/type/list",
    method: "get",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      dictName: dictTypeName || (dictTypeCode ? undefined : keyword),
      dictType: dictTypeCode || (dictTypeName ? undefined : keyword),
      status: toRuoyiStatus(params?.status),
      "params[beginTime]": params?.createdFrom,
      "params[endTime]": params?.createdTo,
    },
  });
  return mapPage(response.data, mapDictType, params?.pageNo, params?.pageSize);
}

export function fetchPlatformDictTypeDetail(
  typeId: PlatformId,
): Promise<PlatformDictTypeDetail> {
  return request<SysDictType>({
    url: `/system/dict/type/${typeId}`,
    method: "get",
  }).then(mapDictType);
}

export function createPlatformDictType(
  data: PlatformDictTypeCreateRequest,
): Promise<void> {
  validateDictTypePayload(data);
  return request<void>({
    url: "/system/dict/type",
    method: "post",
    data: toDictTypePayload(data),
  });
}

export function updatePlatformDictType(
  typeId: PlatformId,
  data: PlatformDictTypeUpdateRequest,
): Promise<void> {
  return request<SysDictType>({
    url: `/system/dict/type/${typeId}`,
    method: "get",
  }).then((current) =>
    request<void>({
      url: "/system/dict/type",
      method: "put",
      data: { ...current, ...definedFields(toDictTypePayload(data, typeId)) },
    }),
  );
}

export function enablePlatformDictType(typeId: PlatformId): Promise<void> {
  return updatePlatformDictType(typeId, { status: "ENABLED" });
}

export function disablePlatformDictType(typeId: PlatformId): Promise<void> {
  return updatePlatformDictType(typeId, { status: "DISABLED" });
}

export function deletePlatformDictTypes(
  typeIds: PlatformId | PlatformId[],
): Promise<void> {
  return request<void>({
    url: `/system/dict/type/${joinIds(Array.isArray(typeIds) ? typeIds : [typeIds])}`,
    method: "delete",
  });
}

export function deletePlatformDictType(typeId: PlatformId): Promise<void> {
  return deletePlatformDictTypes(typeId);
}

function mapDictItem(item: SysDictData): PlatformDictItemDetail {
  const value = item.dictValue ?? "";
  const label = item.dictLabel ?? "";
  return {
    id: Number(item.dictCode ?? 0),
    dictCode: item.dictCode,
    dictTypeCode: item.dictType ?? "",
    label,
    value,
    dictItemCode: value,
    dictItemLabel: label,
    sortNo: item.dictSort,
    defaulted: item.isDefault === "Y",
    cssClass: item.cssClass,
    listClass: item.listClass,
    styleClass: item.listClass || item.cssClass,
    status: fromRuoyiStatus(item.status),
    remark: item.remark,
    createdAt: item.createTime,
    raw: item,
  };
}

export async function exportPlatformDictTypes(
  params?: PlatformDictTypeQuery,
): Promise<Blob> {
  const response = await httpClient.request<Blob>({
    url: "/system/dict/type/export",
    method: "post",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      dictName: params?.dictTypeName || params?.keyword,
      dictType: params?.dictTypeCode,
      status: params?.status,
      "params[beginTime]": params?.createdFrom,
      "params[endTime]": params?.createdTo,
    },
    responseType: "blob",
  });
  return response.data;
}

export function refreshPlatformDictCache(): Promise<void> {
  return request<void>({
    url: "/system/dict/type/refreshCache",
    method: "delete",
  });
}

function toDictItemPayload(
  dictTypeCode: string,
  data: PlatformDictItemCreateRequest | PlatformDictItemUpdateRequest,
  itemId?: PlatformId,
): SysDictData {
  const status = toRuoyiStatus(data.status);
  return {
    dictCode: itemId === undefined ? undefined : Number(itemId),
    dictType: dictTypeCode || undefined,
    dictValue: "dictItemCode" in data ? data.dictItemCode : undefined,
    dictLabel: data.dictItemLabel,
    dictSort: data.sortNo,
    isDefault: data.defaulted ? "Y" : "N",
    cssClass: data.cssClass,
    listClass: data.listClass ?? data.styleClass,
    status,
    remark: data.remark,
  };
}

export async function fetchPlatformDictItemDetailsPage(
  dictTypeCode: string,
  params?: PlatformDictItemQuery,
): Promise<PlatformPageResponse<PlatformDictItemDetail>> {
  const dictItemCode = params?.dictItemCode?.trim() || undefined;
  const dictItemLabel = params?.dictItemLabel?.trim() || undefined;
  const keyword = params?.keyword?.trim() || undefined;
  const response = await httpClient.request<TableDataInfo<SysDictData>>({
    url: "/system/dict/data/list",
    method: "get",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      dictType: dictTypeCode,
      dictLabel: dictItemLabel || (dictItemCode ? undefined : keyword),
      dictValue: dictItemCode || (dictItemLabel ? undefined : keyword),
      status: toRuoyiStatus(params?.status),
    },
  });
  return mapPage(response.data, mapDictItem, params?.pageNo, params?.pageSize);
}

export async function fetchPlatformDictItems(dictTypeCode: string) {
  const committeeMockDictTypes = [
    "committee_meeting_level",
    "committee_review_status",
    "committee_approval_result_status",
    "committee_gate_status",
  ];
  if (
    isCommitteeMockEnabled() &&
    committeeMockDictTypes.includes(dictTypeCode)
  ) {
    return mockFetchPlatformDictItems(dictTypeCode);
  }
  const page = await fetchPlatformDictItemDetailsPage(dictTypeCode, {
    pageNo: 1,
    pageSize: 500,
  });
  return page.records;
}

export function fetchPlatformDictItemsByType(
  dictTypeCode: string,
): Promise<PlatformDictItemDetail[]> {
  return request<SysDictData[]>({
    url: `/system/dict/data/type/${dictTypeCode}`,
    method: "get",
  }).then((items) => items.map(mapDictItem));
}

export function fetchPlatformDictItemDetail(
  itemId: PlatformId,
): Promise<PlatformDictItemDetail> {
  return request<SysDictData>({
    url: `/system/dict/data/${itemId}`,
    method: "get",
  }).then(mapDictItem);
}

export function createPlatformDictItem(
  dictTypeCode: string,
  data: PlatformDictItemCreateRequest,
): Promise<void> {
  validateDictItemPayload(dictTypeCode, data);
  return request<void>({
    url: "/system/dict/data",
    method: "post",
    data: toDictItemPayload(dictTypeCode, data),
  });
}

function validateDictTypePayload(
  data: PlatformDictTypeCreateRequest | PlatformDictTypeUpdateRequest,
) {
  const dictTypeCode = "dictTypeCode" in data ? data.dictTypeCode?.trim() : undefined;
  const dictTypeName = data.dictTypeName?.trim();
  if ("dictTypeCode" in data && !dictTypeCode) {
    throw new Error("字典类型编码不能为空");
  }
  if (!dictTypeName) {
    throw new Error("字典类型名称不能为空");
  }
  if (dictTypeCode && dictTypeCode.length > 100) {
    throw new Error("字典类型编码不能超过100个字符");
  }
  if (dictTypeName.length > 100) {
    throw new Error("字典类型名称不能超过100个字符");
  }
}

function validateDictItemPayload(
  dictTypeCode: string,
  data: PlatformDictItemCreateRequest | PlatformDictItemUpdateRequest,
) {
  if (!dictTypeCode.trim()) {
    throw new Error("字典类型不能为空");
  }
  const dictItemCode = "dictItemCode" in data ? data.dictItemCode?.trim() : undefined;
  const dictItemLabel = data.dictItemLabel?.trim();
  if ("dictItemCode" in data && !dictItemCode) {
    throw new Error("字典项编码和名称不能为空");
  }
  if (!dictItemLabel) {
    throw new Error("字典项编码和名称不能为空");
  }
  if (dictItemCode && dictItemCode.length > 100) {
    throw new Error("字典项编码不能超过100个字符");
  }
  if (dictItemLabel.length > 100) {
    throw new Error("字典项名称不能超过100个字符");
  }
}

export function updatePlatformDictItem(
  itemId: PlatformId,
  data: PlatformDictItemUpdateRequest,
): Promise<void> {
  return request<SysDictData>({
    url: `/system/dict/data/${itemId}`,
    method: "get",
  }).then((current) =>
    request<void>({
      url: "/system/dict/data",
      method: "put",
      data: {
        ...current,
        ...definedFields(
          toDictItemPayload(current.dictType ?? "", data, itemId),
        ),
      },
    }),
  );
}

export function enablePlatformDictItem(itemId: PlatformId): Promise<void> {
  return updatePlatformDictItem(itemId, { status: "ENABLED" });
}

export function disablePlatformDictItem(itemId: PlatformId): Promise<void> {
  return updatePlatformDictItem(itemId, { status: "DISABLED" });
}

export function deletePlatformDictItems(
  itemIds: PlatformId | PlatformId[],
): Promise<void> {
  return request<void>({
    url: `/system/dict/data/${joinIds(Array.isArray(itemIds) ? itemIds : [itemIds])}`,
    method: "delete",
  });
}


export function deletePlatformDictItem(itemId: PlatformId): Promise<void> {
  return deletePlatformDictItems(itemId);
}

export async function exportPlatformDictItems(
  dictTypeCode: string,
  params?: PlatformDictItemQuery,
): Promise<Blob> {
  const response = await httpClient.request<Blob>({
    url: "/system/dict/data/export",
    method: "post",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      dictType: dictTypeCode,
      dictLabel: params?.dictItemLabel || params?.keyword,
      dictValue: params?.dictItemCode,
      status: params?.status,
    },
    responseType: "blob",
  });
  return response.data;
}

function mapLoginLog(item: SysLoginLog): PlatformLoginLogItem {
  return {
    id: Number(item.infoId ?? 0),
    username: item.userName ?? "",
    ipaddr: item.ipaddr,
    loginLocation: item.loginLocation,
    browser: item.browser,
    os: item.os,
    status: fromRuoyiLogStatus(item.status),
    message: item.msg,
    loginTime: item.loginTime,
  };
}

export async function fetchPlatformLoginLogsPage(
  params?: PlatformLoginLogQuery,
): Promise<PlatformPageResponse<PlatformLoginLogItem>> {
  const response = await httpClient.request<TableDataInfo<SysLoginLog>>({
    url: "/monitor/logininfor/list",
    method: "get",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      userName: params?.username,
      ipaddr: params?.ipaddr,
      status: toRuoyiLogStatus(params?.status),
      "params[beginTime]": params?.loginFrom,
      "params[endTime]": params?.loginTo,
    },
  });
  return mapPage(response.data, mapLoginLog, params?.pageNo, params?.pageSize);
}

export async function exportPlatformLoginLogs(
  params?: PlatformLoginLogQuery,
): Promise<Blob> {
  const response = await httpClient.request<Blob>({
    url: "/monitor/logininfor/export",
    method: "post",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      userName: params?.username,
      ipaddr: params?.ipaddr,
      status: toRuoyiLogStatus(params?.status),
      "params[beginTime]": params?.loginFrom,
      "params[endTime]": params?.loginTo,
    },
    responseType: "blob",
  });
  return downloadBlob(response.data, "登录日志.xlsx");
}

export function deletePlatformLoginLogs(logIds: PlatformId[]): Promise<void> {
  return request<void>({
    url: `/monitor/logininfor/${joinIds(logIds)}`,
    method: "delete",
  });
}

export function cleanPlatformLoginLogs(): Promise<void> {
  return request<void>({
    url: "/monitor/logininfor/clean",
    method: "delete",
  });
}

export function unlockPlatformLoginUser(username: string): Promise<void> {
  return request<void>({
    url: `/monitor/logininfor/unlock/${encodeURIComponent(username)}`,
    method: "get",
  });
}

function mapOperationLog(item: SysOperationLog): PlatformOperationLogItem {
  return {
    id: Number(item.operId ?? 0),
    title: item.title ?? "",
    businessType:
      item.businessType === undefined ? undefined : String(item.businessType),
    method: item.method,
    requestMethod: item.requestMethod,
    operatorType:
      item.operatorType === undefined ? undefined : String(item.operatorType),
    operatorUsername: item.operName,
    deptName: item.deptName,
    requestPath: item.operUrl,
    operIp: item.operIp,
    operLocation: item.operLocation,
    requestParams: item.operParam,
    responseBody: item.jsonResult,
    status: fromRuoyiLogStatus(item.status),
    errorMessage: item.errorMsg,
    operatedAt: item.operTime,
    costTime: item.costTime,
  };
}

export async function fetchPlatformOperationLogsPage(
  params?: PlatformOperationLogQuery,
): Promise<PlatformPageResponse<PlatformOperationLogItem>> {
  const response = await httpClient.request<TableDataInfo<SysOperationLog>>({
    url: "/monitor/operlog/list",
    method: "get",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      title: params?.title,
      businessType: params?.businessType,
      operName: params?.operatorUsername,
      operIp: params?.operIp,
      status: toRuoyiLogStatus(params?.status),
      "params[beginTime]": params?.operatedFrom,
      "params[endTime]": params?.operatedTo,
    },
  });
  return mapPage(
    response.data,
    mapOperationLog,
    params?.pageNo,
    params?.pageSize,
  );
}

export async function exportPlatformOperationLogs(
  params?: PlatformOperationLogQuery,
): Promise<Blob> {
  const response = await httpClient.request<Blob>({
    url: "/monitor/operlog/export",
    method: "post",
    params: {
      pageNum: params?.pageNo,
      pageSize: params?.pageSize,
      title: params?.title,
      businessType: params?.businessType,
      operName: params?.operatorUsername,
      operIp: params?.operIp,
      status: toRuoyiLogStatus(params?.status),
      "params[beginTime]": params?.operatedFrom,
      "params[endTime]": params?.operatedTo,
    },
    responseType: "blob",
  });
  return downloadBlob(response.data, "操作日志.xlsx");
}

export function deletePlatformOperationLogs(
  logIds: PlatformId[],
): Promise<void> {
  return request<void>({
    url: `/monitor/operlog/${joinIds(logIds)}`,
    method: "delete",
  });
}

export function cleanPlatformOperationLogs(): Promise<void> {
  return request<void>({
    url: "/monitor/operlog/clean",
    method: "delete",
  });
}
