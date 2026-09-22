import type {
  PlatformMenuItem,
  PlatformPermissionItem,
} from "@/types/platform-system";

export type RoleGrantTreeNode = {
  value: string;
  label: string;
  grantType: "menu" | "permission";
  menuCode?: string;
  permissionCode?: string;
  children?: RoleGrantTreeNode[];
};

type RoleGrantTreeExpose = {
  getNode: (key: string | number) => { expanded: boolean } | null | undefined;
};

export function buildRoleGrantTree(
  menuItems: PlatformMenuItem[],
  permissionItems: PlatformPermissionItem[],
): RoleGrantTreeNode[] {
  const usedPermissionCodes = new Set<string>();
  const menuNodes = menuItems.map((menu) =>
    buildMenuGrantNode(menu, usedPermissionCodes),
  );
  const loosePermissionNodes = permissionItems
    .filter((permission) => !usedPermissionCodes.has(permission.permissionCode))
    .map((permission) => ({
      value: toRolePermissionGrantKey(permission.permissionCode),
      label: permission.permissionName,
      grantType: "permission" as const,
      permissionCode: permission.permissionCode,
    }));

  if (!loosePermissionNodes.length) {
    return menuNodes;
  }

  return [
    ...menuNodes,
    {
      value: "permission:__loose__",
      label: "未挂菜单按钮权限",
      grantType: "permission",
      children: loosePermissionNodes,
    },
  ];
}

function buildMenuGrantNode(
  menu: PlatformMenuItem,
  usedPermissionCodes: Set<string>,
): RoleGrantTreeNode {
  if (menu.menuType === "BUTTON") {
    if (menu.permissionCode) {
      usedPermissionCodes.add(menu.permissionCode);
    }
    return {
      value: toRolePermissionGrantKey(menu.permissionCode || menu.menuCode),
      label: menu.menuName,
      grantType: "permission",
      menuCode: menu.menuCode,
      permissionCode: menu.permissionCode || menu.menuCode,
    };
  }

  return {
    value: toRoleMenuGrantKey(menu.menuCode),
    label: menu.menuName,
    grantType: "menu",
    menuCode: menu.menuCode,
    permissionCode: menu.permissionCode || undefined,
    children: (menu.children ?? []).map((child) =>
      buildMenuGrantNode(child, usedPermissionCodes),
    ),
  };
}

export function resolveEffectiveRoleGrantKeys(
  selectedKeys: string[],
  nodes: RoleGrantTreeNode[],
) {
  const validKeys = new Set(
    flattenRoleGrantTree(nodes).map((node) => node.value),
  );
  const keys = new Set(selectedKeys.filter((key) => validKeys.has(key)));

  for (const node of nodes) {
    collectSelectedDescendantKeys(node, keys);
  }

  return Array.from(keys);
}

function collectSelectedDescendantKeys(
  node: RoleGrantTreeNode,
  keys: Set<string>,
) {
  if (keys.has(node.value)) {
    flattenRoleGrantTree(node.children ?? []).forEach((child) => {
      keys.add(child.value);
    });
    return;
  }

  node.children?.forEach((child) => collectSelectedDescendantKeys(child, keys));
}

export function flattenRoleGrantTree(
  nodes: RoleGrantTreeNode[],
): RoleGrantTreeNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenRoleGrantTree(node.children ?? []),
  ]);
}

export function collapseRoleGrantTree(
  nodes: RoleGrantTreeNode[],
  tree: RoleGrantTreeExpose | null | undefined,
) {
  nodes.forEach((node) => {
    const treeNode = tree?.getNode(node.value);
    if (treeNode) treeNode.expanded = false;
  });
}

export function resolveRoleGrantPopperHeight(
  viewportHeight: number,
  popperTop: number,
  bottomMargin = 8,
) {
  return Math.max(96, Math.floor(viewportHeight - popperTop - bottomMargin));
}

export function resolveRoleGrantPopperTop(
  triggerBottom: number,
  popperOffset = 12,
) {
  return triggerBottom + popperOffset;
}

export function scheduleRoleGrantPopperLayoutUpdate(
  update: () => void,
  requestFrame: (callback: FrameRequestCallback) => number = requestAnimationFrame,
) {
  return requestFrame(() => requestFrame(() => update()));
}

type RoleGrantResizeObserver = Pick<ResizeObserver, "observe" | "disconnect">;

export function observeRoleGrantTriggerLayout(
  trigger: Element,
  update: () => void,
  createObserver: (
    callback: ResizeObserverCallback,
  ) => RoleGrantResizeObserver = (callback) => new ResizeObserver(callback),
) {
  const observer = createObserver(() => update());
  observer.observe(trigger);
  return observer;
}

export function toRoleMenuGrantKey(menuCode: string) {
  return `menu:${menuCode}`;
}

export function toRolePermissionGrantKey(permissionCode: string) {
  return `permission:${permissionCode}`;
}
