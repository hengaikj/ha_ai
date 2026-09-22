export interface BackendMenuNode {
  id?: string | number;
  menuId?: string | number;
  parentId?: string | number;
  name?: string;
  menuCode?: string;
  menuName?: string;
  menuType?: string;
  path?: string;
  component?: string;
  routePath?: string;
  componentPath?: string;
  routeName?: string;
  perms?: string;
  permissionCode?: string;
  icon?: string;
  sortNo?: number;
  orderNum?: number;
  visible?: boolean;
  hidden?: boolean;
  cacheable?: boolean;
  meta?: {
    title?: string;
    icon?: string;
    noCache?: boolean;
    link?: string;
    [key: string]: unknown;
  };
  redirect?: string;
  externalLink?: boolean;
  status?: string;
  children?: BackendMenuNode[];
}

export interface MenuNode {
  id: string;
  code: string;
  title: string;
  path: string;
  menuType?: string;
  component?: string;
  routeName?: string;
  icon?: string;
  permission?: string;
  visible?: boolean;
  hidden?: boolean;
  cacheable?: boolean;
  status?: string;
  children?: MenuNode[];
}

export interface BackendCurrentUser {
  userId: number;
  username?: string;
  userName?: string;
  displayName?: string;
  nickName?: string;
  email?: string;
  phonenumber?: string;
  phoneNumber?: string;
  sex?: string;
  dept?: {
    deptId?: number;
    deptName?: string;
    parentName?: string;
  };
  deptId?: number;
  deptName?: string;
  createTime?: string;
  roleCodes?: string[];
  permissionCodes?: string[];
  roles?: string[];
  permissions?: string[];
  projectIds?: number[];
  dataScope?: string;
  dataScopes?: string[];
  deptIds?: number[];
  roleIds?: number[];
  menuCodes?: string[];
}

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  phone?: string;
  sex?: string;
  deptId?: number;
  deptName?: string;
  createTime?: string;
  roles: string[];
  permissions: string[];
  projectIds: number[];
  dataScope?: string;
  dataScopes: string[];
  deptIds: number[];
  roleIds: number[];
  menuCodes: string[];
  securityLevel?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  code?: string;
  uuid?: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType?: string;
  expiresIn: number;
  user?: BackendCurrentUser;
}

export interface BackendLoginResult {
  token?: string;
  accessToken?: string;
  expiresIn?: number;
  user?: BackendCurrentUser;
}

export interface BackendCurrentUserResult {
  user: BackendCurrentUser;
  roles?: string[];
  permissions?: string[];
}

export interface CaptchaImage {
  captchaEnabled: boolean;
  uuid?: string;
  img?: string;
}

export interface BackendCaptchaImage {
  captchaEnabled?: boolean;
  uuid?: string;
  img?: string;
  image?: string;
  captchaImage?: string;
}
