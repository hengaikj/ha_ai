export type FieldPermission = "READABLE" | "MASKED" | "UNREADABLE";

export type FieldPermissionMap = Record<string, FieldPermission | undefined>;

interface MenuLike {
  code?: string;
  children?: MenuLike[];
}

const SUPER_ADMIN_ROLE_CODES = new Set([
  "admin",
  "administrator",
  "平台管理员",
  "platform-admin",
  "platform_admin",
  "superadmin",
  "super-admin",
  "super_admin",
  "超级管理员",
]);
const ALL_PERMISSION_CODE = "*:*:*";

export function hasSuperAdminRole(roleCodes: string[] = []): boolean {
  return roleCodes.some((roleCode) =>
    SUPER_ADMIN_ROLE_CODES.has(roleCode.trim().toLowerCase()),
  );
}

export function canAccessPermission(
  permissions: string[],
  permissionCode?: string | string[],
  roleCodes: string[] = [],
): boolean {
  if (hasSuperAdminRole(roleCodes)) {
    return true;
  }

  if (
    !permissionCode ||
    (Array.isArray(permissionCode) && !permissionCode.length)
  ) {
    return true;
  }

  if (permissions.includes(ALL_PERMISSION_CODE)) {
    return true;
  }

  if (Array.isArray(permissionCode)) {
    return permissionCode.some((candidate) => permissions.includes(candidate));
  }

  return permissions.includes(permissionCode);
}

export function containsMenuCode(
  menus: MenuLike[],
  menuCode?: string,
): boolean {
  if (!menuCode) {
    return true;
  }

  return menus.some((menu) => {
    if (menu.code === menuCode) {
      return true;
    }
    return containsMenuCode(menu.children ?? [], menuCode);
  });
}

export function canReadField(
  fieldPermissions: FieldPermissionMap,
  fieldName: string,
): boolean {
  return fieldPermissions[fieldName] !== "UNREADABLE";
}

export function shouldMaskField(
  fieldPermissions: FieldPermissionMap,
  fieldName: string,
): boolean {
  return fieldPermissions[fieldName] === "MASKED";
}
