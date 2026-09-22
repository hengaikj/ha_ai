export type SystemId = string | number;
export type SystemStatus = "0" | "1";
export type SystemDataScope = "1" | "2" | "3" | "4" | "5";

export interface SystemPageQuery {
  pageNum?: number;
  pageSize?: number;
}

export interface SystemPageResponse<T> {
  records: T[];
  total: number;
  pageNum?: number;
  pageSize?: number;
}

export interface TableDataInfo<T> {
  rows?: T[];
  total?: number;
}

export interface SysUser {
  userId?: number;
  deptId?: number;
  dept?: SysDept;
  userName?: string;
  nickName?: string;
  email?: string;
  phonenumber?: string;
  sex?: string;
  status?: SystemStatus;
  password?: string;
  roleIds?: number[];
  postIds?: number[];
  createTime?: string;
}

export interface SysUserProfile extends SysUser {
  roles?: Array<{
    roleName?: string;
  }>;
  roleGroup?: string;
  postGroup?: string;
}

export interface SysUserProfilePayload {
  userId?: number;
  userName?: string;
  nickName?: string;
  phonenumber?: string;
  email?: string;
  sex?: string;
}

export interface SysUserQuery extends SystemPageQuery {
  userName?: string;
  phonenumber?: string;
  status?: SystemStatus;
  deptId?: number;
  beginTime?: string;
  endTime?: string;
}

export interface SysRole {
  roleId?: number;
  roleName?: string;
  roleKey?: string;
  roleSort?: number;
  dataScope?: SystemDataScope;
  status?: SystemStatus;
  menuIds?: number[];
  deptIds?: number[];
  createTime?: string;
}

export interface SysRoleQuery extends SystemPageQuery {
  roleName?: string;
  roleKey?: string;
  status?: SystemStatus;
  beginTime?: string;
  endTime?: string;
}

export interface SysDept {
  deptId?: number;
  parentId?: number;
  deptName?: string;
  orderNum?: number;
  leader?: string;
  phone?: string;
  email?: string;
  status?: SystemStatus;
  children?: SysDept[];
}

export interface SysDeptQuery {
  deptName?: string;
  status?: SystemStatus;
}
