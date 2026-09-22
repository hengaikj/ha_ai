import type { BackendMenuNode } from "@/types/auth";

export type PlatformStatus = "ENABLED" | "DISABLED";
export type PlatformLogStatus = "SUCCESS" | "FAILED";
export type PlatformId = string | number;
export type PlatformDataScope =
  | "ALL"
  | "SELF_DEPT"
  | "CUSTOM_DEPT"
  | "DEPT_AND_CHILD"
  | "SELF";

export interface PlatformUserItem {
  id: number;
  externalSystem?: string;
  externalUserId?: string;
  username: string;
  displayName?: string;
  phone?: string;
  sex?: string;
  deptId?: number;
  deptExternalId?: string;
  status: PlatformStatus;
  online?: boolean;
  locked?: boolean;
  roleCodes: string[];
  postIds: string[];
  createdAt?: string;
}

export interface PlatformUserQuery extends PlatformPageQuery {
  keyword?: string;
  username?: string;
  displayName?: string;
  phone?: string;
  deptId?: number;
  deptExternalId?: string;
  status?: PlatformStatus;
  createdFrom?: string;
  createdTo?: string;
}

export interface PlatformUserCreateRequest {
  username: string;
  displayName?: string;
  phone?: string;
  sex?: string;
  deptId?: number;
  deptExternalId?: string;
  status?: PlatformStatus;
  roleCodes?: string[];
  postIds?: string[];
  initialPassword: string;
}

export interface PlatformUserUpdateRequest {
  displayName?: string;
  phone?: string;
  sex?: string;
  deptId?: number;
  deptExternalId?: string;
  status?: PlatformStatus;
  postIds?: string[];
}

export interface PlatformPageQuery {
  pageNo?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: "ASC" | "DESC";
}

export interface PlatformUserPageQuery extends PlatformPageQuery {
  keyword?: string;
  status?: PlatformStatus;
}

export interface PlatformRolePageQuery extends PlatformPageQuery {
  keyword?: string;
  dataScope?: PlatformDataScope;
  status?: PlatformStatus;
}

export interface PlatformDictTypePageQuery extends PlatformPageQuery {
  keyword?: string;
  status?: PlatformStatus;
}

export interface PlatformDictItemPageQuery extends PlatformPageQuery {
  keyword?: string;
  status?: PlatformStatus;
  defaulted?: boolean;
}

export interface PlatformPageResponse<T> {
  pageNo: number;
  pageSize: number;
  hasNext?: boolean;
  total?: number;
  records: T[];
}

export interface PlatformOperationConfirmRequest {
  confirmReason: string;
}

export interface PlatformUserSecurityDetail {
  userId: number;
  username: string;
  displayName?: string;
  userStatus: PlatformStatus;
  credentialStatus: string;
  failedAttempts: number;
  lockedUntil?: string;
  passwordUpdatedAt?: string;
  passwordVersion: number;
  tokenVersion: number;
  lastLoginSuccessAt?: string;
  lastLoginFailedAt?: string;
  roleCodes: string[];
}

export interface PlatformUserTokenVersionResponse {
  userId: number;
  revoked: boolean;
  tokenVersion: number;
}

export interface PlatformUserPasswordResetResponse {
  userId: number;
  reset: boolean;
}

export interface PlatformUserImportResponse {
  total: number;
  success: number;
  failure: number;
  errors: string[];
}

export interface PlatformRoleItem {
  id: number;
  roleCode: string;
  roleName: string;
  dataScope: PlatformDataScope;
  status: PlatformStatus;
  sortNo?: number;
  createdAt?: string;
  menuCheckStrictly?: boolean;
}

export interface PlatformRoleMenuTreeNode {
  id: PlatformId;
  label: string;
  children?: PlatformRoleMenuTreeNode[];
}

export interface PlatformRoleMenuTreeResponse {
  menus: PlatformRoleMenuTreeNode[];
  checkedKeys: PlatformId[];
}

export interface PlatformRoleQuery extends PlatformPageQuery {
  keyword?: string;
  roleCode?: string;
  roleName?: string;
  dataScope?: PlatformDataScope;
  status?: PlatformStatus;
  createdFrom?: string;
  createdTo?: string;
}

export interface PlatformRoleCreateRequest {
  roleCode: string;
  roleName: string;
  dataScope?: PlatformDataScope;
  status?: PlatformStatus;
  sortNo?: number;
  menuIds?: number[];
  menuCheckStrictly?: boolean;
}

export interface PlatformRoleUpdateRequest {
  roleName?: string;
  dataScope?: PlatformDataScope;
  status?: PlatformStatus;
  sortNo?: number;
  menuIds?: number[];
  menuCheckStrictly?: boolean;
}

export interface PlatformDeptItem {
  id: PlatformId;
  parentId: PlatformId;
  deptCode: string;
  deptName: string;
  ancestorPath?: string;
  sortNo?: number;
  leaderUserId?: PlatformId;
  phone?: string;
  email?: string;
  status: PlatformStatus;
  createdAt?: string;
  children: PlatformDeptItem[];
}

export interface PlatformDeptQuery {
  keyword?: string;
  deptName?: string;
  status?: PlatformStatus;
}

export interface PlatformDeptCreateRequest {
  parentId: PlatformId;
  deptCode: string;
  deptName: string;
  sortNo?: number;
  leaderUserId?: PlatformId;
  phone?: string;
  email?: string;
  status?: PlatformStatus;
}

export interface PlatformDeptUpdateRequest {
  parentId?: PlatformId;
  deptName?: string;
  sortNo?: number;
  leaderUserId?: PlatformId;
  phone?: string;
  email?: string;
  status?: PlatformStatus;
}

export interface PlatformPostItem {
  id: number;
  postCode: string;
  postName: string;
  postSort?: number;
  status: PlatformStatus;
  remark?: string;
  createdAt?: string;
}

export interface PlatformPostQuery extends PlatformPageQuery {
  postId?: PlatformId;
  postCode?: string;
  postName?: string;
  status?: PlatformStatus;
  createdFrom?: string;
  createdTo?: string;
}

export interface PlatformPostCreateRequest {
  postCode: string;
  postName: string;
  postSort?: number;
  status?: PlatformStatus;
  remark?: string;
}

export interface PlatformPostUpdateRequest {
  postName?: string;
  postSort?: number;
  status?: PlatformStatus;
  remark?: string;
}

export interface PlatformSystemConfigItem {
  id: number;
  configName: string;
  configKey: string;
  configValue?: string;
  systemBuiltin: boolean;
  status: PlatformStatus;
  remark?: string;
  createdAt?: string;
}

export interface PlatformSystemConfigQuery extends PlatformPageQuery {
  configName?: string;
  configKey?: string;
  systemBuiltin?: boolean;
  status?: PlatformStatus;
  createdFrom?: string;
  createdTo?: string;
}

export interface PlatformSystemConfigCreateRequest {
  configName: string;
  configKey: string;
  configValue?: string;
  systemBuiltin?: boolean;
  status?: PlatformStatus;
  remark?: string;
}

export interface PlatformSystemConfigUpdateRequest {
  configName?: string;
  configValue?: string;
  systemBuiltin?: boolean;
  status?: PlatformStatus;
  remark?: string;
}

export interface PlatformSystemConfigRefreshResponse {
  refreshed: boolean;
  refreshedAt?: string;
}

export type PlatformMenuType = "DIRECTORY" | "PAGE" | "BUTTON";

export interface PlatformMenuItem extends BackendMenuNode {
  id: PlatformId;
  parentId?: PlatformId;
  menuCode: string;
  menuName: string;
  menuType?: PlatformMenuType;
  routePath?: string;
  componentPath?: string;
  routeName?: string;
  routeQuery?: string;
  permissionCode?: string;
  icon?: string;
  sortNo?: number;
  visible?: boolean;
  cacheable?: boolean;
  externalLink?: boolean;
  status?: PlatformStatus;
  createdAt?: string;
  children?: PlatformMenuItem[];
}

export interface PlatformMenuQuery {
  keyword?: string;
  menuName?: string;
  menuType?: PlatformMenuType;
  status?: PlatformStatus;
}

export interface PlatformMenuCreateRequest {
  parentId: PlatformId;
  menuCode: string;
  menuName: string;
  menuType: PlatformMenuType;
  routePath?: string;
  componentPath?: string;
  routeName?: string;
  routeQuery?: string;
  permissionCode?: string;
  icon?: string;
  sortNo?: number;
  visible?: boolean;
  cacheable?: boolean;
  externalLink?: boolean;
  status?: PlatformStatus;
}

export interface PlatformMenuUpdateRequest {
  parentId?: PlatformId;
  menuName?: string;
  menuType?: PlatformMenuType;
  routePath?: string;
  componentPath?: string;
  routeName?: string;
  routeQuery?: string;
  permissionCode?: string;
  icon?: string;
  sortNo?: number;
  visible?: boolean;
  cacheable?: boolean;
  externalLink?: boolean;
  status?: PlatformStatus;
}

export interface PlatformDictItem {
  dictCode?: number;
  label: string;
  value: string;
  dictItemCode: string;
  dictItemLabel: string;
  sortNo?: number;
  defaulted?: boolean;
  cssClass?: string;
  listClass?: string;
  styleClass?: string;
  status: PlatformStatus;
  raw?: Record<string, unknown>;
}

export interface PlatformDictTypeDetail {
  id: number;
  dictTypeCode: string;
  dictTypeName: string;
  status: PlatformStatus;
  remark?: string;
  createdAt?: string;
}

export interface PlatformDictItemDetail extends PlatformDictItem {
  id: number;
  dictTypeCode: string;
  remark?: string;
  createdAt?: string;
}

export interface PlatformDictTypeQuery extends PlatformPageQuery {
  keyword?: string;
  dictTypeCode?: string;
  dictTypeName?: string;
  status?: PlatformStatus;
  createdFrom?: string;
  createdTo?: string;
}

export interface PlatformDictItemQuery extends PlatformPageQuery {
  keyword?: string;
  dictItemCode?: string;
  dictItemLabel?: string;
  status?: PlatformStatus;
  defaulted?: boolean;
}

export interface PlatformDictTypeCreateRequest {
  dictTypeCode: string;
  dictTypeName: string;
  status?: PlatformStatus;
  remark?: string;
}

export interface PlatformDictTypeUpdateRequest {
  dictTypeName?: string;
  status?: PlatformStatus;
  remark?: string;
}

export interface PlatformDictItemCreateRequest {
  dictItemCode: string;
  dictItemLabel: string;
  sortNo?: number;
  defaulted?: boolean;
  cssClass?: string;
  listClass?: string;
  styleClass?: string;
  status?: PlatformStatus;
  remark?: string;
}

export interface PlatformDictItemUpdateRequest {
  dictItemLabel?: string;
  sortNo?: number;
  defaulted?: boolean;
  cssClass?: string;
  listClass?: string;
  styleClass?: string;
  status?: PlatformStatus;
  remark?: string;
}

export interface PlatformPermissionItem {
  id: number;
  permissionCode: string;
  permissionName: string;
  moduleCode: string;
  resourceCode: string;
  actionCode: string;
  status: PlatformStatus;
}

export interface PlatformRoleAuthorizationDetail {
  roleId: number;
  roleCode: string;
  roleName: string;
  dataScope: PlatformDataScope;
  status: PlatformStatus;
  permissionCodes: string[];
  menuCodes: string[];
  customDeptIds: number[];
}

export interface PlatformUserRoleAssignResponse {
  userId: number;
  roleCodes: string[];
}

export interface PlatformRolePermissionGrantResponse {
  roleId: number;
  permissionCodes: string[];
}

export interface PlatformRolePermissionDiffResponse {
  roleId: number;
  currentPermissionCodes: string[];
  targetPermissionCodes: string[];
  addedPermissionCodes: string[];
  removedPermissionCodes: string[];
  containsHighRiskPermission: boolean;
}

export interface PlatformRolePermissionImpactResponse {
  roleId: number;
  roleCode: string;
  affectedUserCount: number;
  currentPermissionCodes: string[];
  targetPermissionCodes: string[];
  addedPermissionCodes: string[];
  removedPermissionCodes: string[];
  addedHighRiskPermissionCodes: string[];
  containsHighRiskPermission: boolean;
}

export interface PlatformRoleMenuGrantResponse {
  roleId: number;
  menuCodes: string[];
}

export interface PlatformRoleDataScopeGrantRequest {
  dataScope: PlatformDataScope;
  deptIds?: number[];
}

export interface PlatformRoleDataScopeGrantResponse {
  roleId: number;
  dataScope: PlatformDataScope;
  deptIds: number[];
}

export interface PlatformOperationAuditQuery extends PlatformPageQuery {
  operationType?: string;
  resourceType?: string;
  resourceId?: string;
  operatorId?: number;
  traceId?: string;
  operationResult?: "SUCCESS" | "FAILED";
  operatedFrom?: string;
  operatedTo?: string;
}

export interface PlatformOperationAuditItem {
  id: number;
  operationType: string;
  resourceType: string;
  resourceId?: string;
  operatorId?: number;
  operatorUsername?: string;
  beforeSnapshot?: string;
  afterSnapshot?: string;
  operationResult: string;
  failureReason?: string;
  traceId?: string;
  requestPath?: string;
  operatedAt?: string;
}

export type PlatformOperationAuditDetail = PlatformOperationAuditItem;

export interface PlatformLoginLogQuery extends PlatformPageQuery {
  username?: string;
  ipaddr?: string;
  status?: PlatformLogStatus;
  loginFrom?: string;
  loginTo?: string;
}

export interface PlatformLoginLogItem {
  id: number;
  username: string;
  ipaddr?: string;
  loginLocation?: string;
  browser?: string;
  os?: string;
  status: PlatformLogStatus;
  message?: string;
  loginTime?: string;
}

export interface PlatformOperationLogQuery extends PlatformPageQuery {
  title?: string;
  businessType?: string;
  operatorUsername?: string;
  operIp?: string;
  status?: PlatformLogStatus;
  operatedFrom?: string;
  operatedTo?: string;
}

export interface PlatformOperationLogItem {
  id: number;
  title: string;
  businessType?: string;
  method?: string;
  requestMethod?: string;
  operatorType?: string;
  operatorUsername?: string;
  deptName?: string;
  requestPath?: string;
  operIp?: string;
  operLocation?: string;
  requestParams?: string;
  responseBody?: string;
  status: PlatformLogStatus;
  errorMessage?: string;
  operatedAt?: string;
  costTime?: number;
  traceId?: string;
}

export type PlatformOperationLogDetail = PlatformOperationLogItem;

export interface PlatformDeptImpactResponse {
  deptId: PlatformId;
  deptCode: string;
  childDeptCount: number;
  directUserCount: number;
  roleDataScopeRefCount: number;
  disableAllowed: boolean;
}


export interface PlatformManagementBaselineResponse {
  generatedAt: string;
  userCount: number;
  roleCount: number;
  permissionCount: number;
  menuCount: number;
  deptCount: number;
  dictTypeCount: number;
  rolePermissions: Array<{ roleCode: string; permissionCode: string }>;
  roleMenus: Array<{ roleCode: string; menuCode: string }>;
  roleDataScopes: Array<{
    roleCode: string;
    dataScope: string;
    deptId?: number;
  }>;
}
