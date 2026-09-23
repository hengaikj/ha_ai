import { request } from "@/api/http";
import {
  mockFetchCurrentMenus,
  mockFetchCurrentUser,
  mockLogin,
  mockLogout,
} from "@/api/mock/auth.mock";
import { isMockEnabled } from "@/api/mock/mock-mode";
import type {
  BackendCaptchaImage,
  BackendCurrentUserResult,
  BackendCurrentUser,
  BackendLoginResult,
  BackendMenuNode,
  CaptchaImage,
  CurrentUser,
  LoginRequest,
  LoginResult,
  MenuNode,
} from "@/types/auth";

export function mapCurrentUser(user: BackendCurrentUser): CurrentUser {
  return {
    id: String(user.userId),
    enterpriseId: user.enterpriseId ?? null,
    username: user.username || user.userName || "",
    displayName:
      user.displayName || user.nickName || user.username || user.userName || "",
    email: user.email,
    phone: user.phonenumber || user.phoneNumber,
    sex: user.sex,
    deptId: user.dept?.deptId ?? user.deptId,
    deptName: user.dept?.deptName || user.deptName,
    createTime: user.createTime,
    roles: user.roleCodes ?? user.roles ?? [],
    permissions: user.permissionCodes ?? user.permissions ?? [],
    projectIds: user.projectIds ?? [],
    dataScope: user.dataScope,
    dataScopes: user.dataScopes ?? [],
    deptIds: user.deptIds ?? [],
    roleIds: user.roleIds ?? [],
    menuCodes: user.menuCodes ?? [],
  };
}

function normalizeBackendMenuPath(path: string, parentPath = ""): string {
  const trimmedPath = path.trim();
  if (/^https?:\/\//.test(path)) {
    return trimmedPath;
  }
  if (trimmedPath.startsWith("/")) {
    return trimmedPath;
  }
  const normalizedParent =
    parentPath === "/" ? "" : parentPath.replace(/\/$/, "");
  const parentTopSegment = normalizedParent.split("/").filter(Boolean)[0];
  const pathSegments = trimmedPath.split("/").filter(Boolean);
  const pathTopSegment = pathSegments[0];
  if (
    pathSegments.length > 1 &&
    parentTopSegment &&
    parentTopSegment === pathTopSegment
  ) {
    return `/${trimmedPath}`.replace(/\/+/g, "/");
  }

  return `${normalizedParent}/${trimmedPath}`.replace(/\/+/g, "/");
}

function mapMenuNode(menu: BackendMenuNode, parentPath = ""): MenuNode {
  const title = menu.menuName || menu.meta?.title || menu.name || "";
  const id = menu.id ?? menu.menuId ?? menu.name ?? menu.path ?? title;
  const path = normalizeBackendMenuPath(
    menu.routePath || menu.path || "/",
    parentPath,
  );
  const permission = menu.permissionCode || menu.perms;
  const code =
    menu.menuCode || menu.name || String(menu.menuId ?? menu.path ?? title);
  const component = menu.componentPath || menu.component;
  return {
    id: String(id),
    code,
    title,
    path,
    menuType: menu.menuType,
    component,
    routeName: menu.routeName,
    icon: menu.icon || menu.meta?.icon,
    permission,
    visible: menu.visible ?? !menu.hidden,
    hidden: menu.hidden,
    cacheable: menu.cacheable ?? !menu.meta?.noCache,
    status: menu.status,
    children: menu.children?.map((child) => mapMenuNode(child, path)) ?? [],
  };
}

export function login(data: LoginRequest): Promise<LoginResult> {
  if (isMockEnabled()) {
    return mockLogin(data);
  }

  return loginWithBackend(data);
}

async function loginWithBackend(data: LoginRequest): Promise<LoginResult> {
  const result = await request<BackendLoginResult>({
    url: "/login",
    method: "post",
    data,
  });

  return {
    accessToken: result.accessToken || result.token || "",
    expiresIn: result.expiresIn ?? 0,
    user: result.user,
  };
}

export function fetchCaptchaImage(): Promise<CaptchaImage> {
  if (isMockEnabled()) {
    return Promise.resolve({
      captchaEnabled: true,
      uuid: "mock-captcha-uuid",
      img: "",
    });
  }

  return fetchCaptchaImageFromBackend();
}

function normalizeCaptchaImage(
  payload?: BackendCaptchaImage | null,
): CaptchaImage {
  const image = payload?.img || payload?.image || payload?.captchaImage || "";
  return {
    captchaEnabled: payload?.captchaEnabled ?? true,
    uuid: payload?.uuid ?? "",
    img: image,
  };
}

async function fetchCaptchaImageFromBackend(): Promise<CaptchaImage> {
  const captcha = await request<BackendCaptchaImage>({
    url: "/captchaImage",
    method: "get",
    params: { _captcha: Date.now() },
    skipErrorToast: true,
  });
  return normalizeCaptchaImage(captcha);
}

export function logout(): Promise<void> {
  if (isMockEnabled()) {
    return mockLogout();
  }

  return request<void>({
    url: "/logout",
    method: "post",
  });
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  if (isMockEnabled()) {
    return mockFetchCurrentUser();
  }

  const result = await request<BackendCurrentUserResult>({
    url: "/getInfo",
    method: "get",
    skipErrorToast: true,
  });
  return mapCurrentUser({
    ...result.user,
    roles: result.roles,
    permissions: result.permissions,
  });
}

export async function fetchCurrentMenus(): Promise<MenuNode[]> {
  if (isMockEnabled()) {
    return mockFetchCurrentMenus();
  }

  const menus = await request<BackendMenuNode[]>({
    url: "/getRouters",
    method: "get",
  });
  return menus.map((menu) => mapMenuNode(menu));
}
