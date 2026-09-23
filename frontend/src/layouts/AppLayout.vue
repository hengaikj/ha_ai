<script setup lang="ts">
import { hasCostCalculationFailures } from "@/utils/task-center-labels";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowDown,
  Bell,
  Expand,
  Fold,
  FullScreen,
  HomeFilled,
  SwitchButton,
  User,
} from "@element-plus/icons-vue";
import SidebarMenuItem from "@/components/layout/SidebarMenuItem.vue";
import AppRouteView from "@/components/layout/AppRouteView.vue";
import TaskDownloadAction from "@/components/task-center/TaskDownloadAction.vue";
import { BaseToast } from "@/components/base/BaseToast";
import { removeDynamicRoutes } from "@/router/dynamic-routes";
import { useAuthStore } from "@/stores/auth";
import { useTagsViewStore } from "@/stores/tags-view";
import { useTaskCenterStore } from "@/stores/task-center";
import type { MenuNode } from "@/types/auth";
import type { TaskCenterStatus } from "@/types/task-center";
import Watermark from "@/utils/watermark";
import TagsView from "@/components/layout/TagsView.vue";
import {
  isPageFullscreenEnabled,
  isTagsViewEnabled,
  isWatermarkEnabled,
} from "@/config/features";
import logo from "@/assets/logo/logo2.png";
import zhixingguanLogo from "@/assets/brand/zhixingguan-logo.svg";
const route = useRoute();
const isAiRoute = computed(() => route.path === "/ai" || route.path.startsWith("/ai/"));
const router = useRouter();
const authStore = useAuthStore();
const tagsViewStore = useTagsViewStore();
const taskCenterStore = useTaskCenterStore();
const isSidebarCollapsed = ref(false);
const isNarrowViewport = ref(false);
const layoutRef = ref<HTMLElement | null>(null);
const sidebarMenuRef = ref<HTMLElement | null>(null);
const preservedSidebarScrollTop = ref(0);
const isFullscreen = ref(false);
let narrowViewportMedia: ReturnType<typeof window.matchMedia> | undefined;
const currentUserDisplayName = computed(
  () =>
    authStore.currentUser?.displayName ||
    authStore.currentUser?.username ||
    "当前用户",
);
type BreadcrumbItem = {
  title: string;
  path?: string;
};

function isCostResearchSharedRoute(path: string): boolean {
  return (
    path === "/cost/research/detail" ||
    path.startsWith("/cost/research/parts/") ||
    path === "/cost/research/versions" ||
    path.startsWith("/cost/research/versions/compare")
  );
}

function isProductionProjectCostSharedRoute(path: string): boolean {
  return (
    path === "/cost/production/project-cost" ||
    path === "/cost/production/new-production-cost" ||
    path === "/new-production-cost" ||
    path === "/costmanagementnew/zc/projectcostnew" ||
    path.startsWith("/costmanagementnew/zc/projectcostnew/") ||
    path === "/costmanagementnew/zc/cost/production/project-cost" ||
    path.startsWith("/costmanagementnew/zc/cost/production/project-cost/") ||
    path === "/cost/production/new-production-cost/detail" ||
    path === "/cost/production/project-cost/detail" ||
    path === "/new-production-cost/detail" ||
    path === "/cost/production/new-production-cost/parts/histories" ||
    path === "/cost/production/project-cost/parts/histories" ||
    path === "/new-production-cost/parts/histories" ||
    path === "/cost/production/new-production-cost/versions" ||
    path.startsWith("/cost/production/new-production-cost/versions/") ||
    path === "/cost/production/project-cost/versions" ||
    path.startsWith("/cost/production/project-cost/versions/") ||
    path === "/new-production-cost/versions" ||
    path.startsWith("/new-production-cost/versions/")
  );
}

function isPurchaseBomSharedRoute(path: string): boolean {
  return (
    path === "/cost/bom/purchase-list/reorganize" ||
    path === "/cost/bom/reorganize" ||
    path === "/manageBom/purchaseBom/reorganize" ||
    path === "/costmanagementnew/manageBom/purchaseBom/reorganize" ||
    path === "/cost/bom/purchase-list/source-parts" ||
    path === "/manageBom/purchaseBom/source-parts" ||
    path === "/costmanagementnew/manageBom/purchaseBom/source-parts" ||
    path === "/cost/bom/purchase-list/diff-analysis" ||
    path === "/manageBom/purchaseBom/diff-analysis" ||
    path === "/costmanagementnew/manageBom/purchaseBom/diff-analysis"
  );
}

function resolveCostResearchContextTitle(
  path: string,
  activeMenu: string,
): string {
  let context = "";
  if (activeMenu === "/cost/research/new-project-cost") {
    context = "项目成本";
  } else if (activeMenu === "/cost/research/project-cost") {
    context = "项目成本";
  } else if (activeMenu === "/cost/research/new-history") {
    context = "成本履历";
  } else if (activeMenu === "/cost/research/history") {
    context = "成本履历";
  }
  if (!context) return "";

  if (path === "/cost/research/detail") return `${context}查看`;
  if (path.endsWith("/parts/add")) return `${context}新增零件`;
  if (path.endsWith("/parts/edit")) return `${context}编辑零件`;
  if (path.endsWith("/parts/copy")) return `${context}复制零件`;
  if (path.endsWith("/parts/histories")) return `${context}零件历史`;
  if (path.endsWith("/versions/compare/parts")) return `${context}零件详情对比`;
  if (path.endsWith("/versions/compare")) return `${context}版本对比`;
  if (path.endsWith("/versions")) return `${context}历史版本`;
  return "";
}

function resolveCommitteeActiveMenu(path: string): string {
  if (
    path === "/committee/projects" ||
    path.startsWith("/committee/projects/")
  ) {
    return "/committee/projects";
  }
  if (path === "/committee/reviews" || path.startsWith("/committee/reviews/")) {
    return "/committee/reviews";
  }
  if (
    path === "/committee/meetings/second" ||
    path.startsWith("/committee/meetings/second/")
  ) {
    return "/committee/meetings/second";
  }
  if (
    path === "/committee/meetings/group" ||
    path.startsWith("/committee/meetings/group/")
  ) {
    return "/committee/meetings/group";
  }
  if (path === "/committee/meetings/departments") {
    return "/committee/meetings/departments";
  }
  if (path === "/committee/meetings/materials") {
    return "/committee/meetings/materials";
  }
  if (path === "/committee/rectifications") {
    return "/committee/rectifications";
  }
  return "";
}

const pageTitle = computed(() => {
  const queryActiveMenu =
    typeof route.query?.activeMenu === "string" ? route.query.activeMenu : "";
  const contextTitle =
    queryActiveMenu && isCostResearchSharedRoute(route.path)
      ? resolveCostResearchContextTitle(route.path, queryActiveMenu)
      : "";
  return (
    contextTitle ||
    resolveBudgetDetailTitle() ||
    String(route.meta.title ?? "工作台")
  );
});

function resolveBudgetDetailTitle() {
  const path = route.path;
  if (
    (path === "/budget/initiation/detail" ||
      path === "/budget/lixiang/wbsProjectInfo" ||
      path === "/budget/lixiang/wbsProjectInfo/index")
  ) {
    return "立项评审详情";
  }

  if (
    (path === "/budget/clique/detail" ||
      path === "/budget/gate-review/detail")
  ) {
    return "过阀评审详情";
  }

  return "";
}
const foundationMenus: MenuNode[] = [
  {
    id: "dashboard",
    code: "dashboard",
    title: "首页",
    path: "/",
    icon: "dashboard",
  },
  {
    id: "component-guide",
    code: "component-guide",
    title: "组件规范",
    path: "/components",
    icon: "components",
  },
];
const taskStatusView: Record<
  TaskCenterStatus,
  { label: string; type: string }
> = {
  CREATED: { label: "已创建", type: "info" },
  WAITING: { label: "等待执行", type: "info" },
  RUNNING: { label: "执行中", type: "primary" },
  RETRY_WAITING: { label: "等待重试", type: "warning" },
  CANCEL_REQUESTED: { label: "取消中", type: "warning" },
  SUCCEEDED: { label: "已成功", type: "success" },
  FAILED: { label: "已失败", type: "danger" },
  TIMEOUT: { label: "已超时", type: "danger" },
  CANCELLED: { label: "已取消", type: "info" },
};
const taskTypeView: Record<string, string> = {
  TABLE_IMPORT: "表格导入",
  TABLE_EXPORT: "表格导出",
  BUDGET_IMPORT: "预算导入",
  BUDGET_EXPORT: "预算导出",
  COST_IMPORT: "成本导入",
  COST_EXPORT: "成本导出",
  COST_CALCULATE: "成本计算",
  COMMITTEE_EXPORT: "委员会导出",
  COMMITTEE_REPORT: "委员会报告",
  ATTACHMENT_PACKAGE: "附件打包",
  REPORT_GENERATE: "报告生成",
  FILE_PACKAGE: "文件打包",
  BATCH_CALCULATE: "批量计算",
};

function isVisibleSidebarMenu(menu: MenuNode): boolean {
  return (
    menu.visible !== false &&
    !menu.hidden &&
    menu.status !== "1" &&
    menu.menuType !== "F"
  );
}

function filterSidebarMenus(menus: MenuNode[]): MenuNode[] {
  return menus.reduce<MenuNode[]>((items, menu) => {
    const children = filterSidebarMenus(menu.children ?? []);
    if (!isVisibleSidebarMenu(menu)) {
      return items;
    }
    if (
      menu.component === "Layout" &&
      !menu.title.trim() &&
      children.length === 1
    ) {
      items.push(children[0]);
      return items;
    }
    items.push({
      ...menu,
      children,
    });
    return items;
  }, []);
}

const sidebarMenus = computed<MenuNode[]>(() =>
  filterSidebarMenus(
    authStore.menus.length ? authStore.menus : foundationMenus,
  ),
);

// 标签栏只允许收录左侧实际展示的菜单路由，供布局内的 TagsView 使用。
provide("app-sidebar-menus", sidebarMenus);

const costResearchActiveMenuAliases: Record<string, string[]> = {
  "/cost/research/project-cost": [
    "/costmanagementnew/zy/projectcost",
    "/costmanagementnew/projectcost",
  ],
  "/cost/research/new-project-cost": [
    "/costmanagementnew/zy/projectcostnew",
    "/costmanagementnew/projectcostnew",
  ],
  "/cost/research/history": [
    "/costmanagementnew/zy/costbomtwo",
    "/costmanagementnew/costbomtwo",
  ],
  "/cost/research/new-history": [
    "/costmanagementnew/zy/costbom",
    "/costmanagementnew/zy/costbomshree",
    "/costmanagementnew/costbomshree",
  ],
};

const productionProjectCostActiveMenuAliases: Record<string, string[]> = {
  "/cost/production/project-cost": [
    "/cost/production/new-production-cost",
    "/new-production-cost",
    "/costmanagementnew/zc/projectcostnew",
    "/costmanagementnew/zc/cost/production/project-cost",
  ],
};

const costBomActiveMenuAliases: Record<string, string[]> = {
  "/cost/bom/purchase-list": [
    "/costmanagementnew/manageBom/purchaseBom",
    "/manageBom/purchaseBom",
  ],
};

function hasSidebarMenuPath(menus: MenuNode[], targetPath: string): boolean {
  return menus.some(
    (menu) =>
      menu.path === targetPath ||
      (menu.children?.length
        ? hasSidebarMenuPath(menu.children, targetPath)
        : false),
  );
}

function resolveSidebarActiveMenuPath(activeMenu: string): string {
  if (!activeMenu) {
    return "";
  }
  const productionProjectCostPaths = [
    "/cost/production/project-cost",
    ...(productionProjectCostActiveMenuAliases[
      "/cost/production/project-cost"
    ] ?? []),
  ];
  const canonicalActiveMenu = productionProjectCostPaths.includes(activeMenu)
    ? "/cost/production/project-cost"
    : activeMenu;
  const candidates = [
    canonicalActiveMenu,
    ...(costResearchActiveMenuAliases[canonicalActiveMenu] ?? []),
    ...(productionProjectCostActiveMenuAliases[canonicalActiveMenu] ?? []),
    ...(costBomActiveMenuAliases[canonicalActiveMenu] ?? []),
  ];
  return (
    candidates.find((path) => hasSidebarMenuPath(sidebarMenus.value, path)) ??
    canonicalActiveMenu
  );
}

function resolveActiveMenuByPath(
  menus: MenuNode[],
  currentPath: string,
): string {
  let matchedPath = "";

  function walk(menuItems: MenuNode[]) {
    menuItems.forEach((menu) => {
      if (
        menu.path &&
        (menu.path === currentPath ||
          (menu.path !== "/" && currentPath.startsWith(`${menu.path}/`))) &&
        menu.path.length > matchedPath.length
      ) {
        matchedPath = menu.path;
      }

      if (menu.children?.length) {
        walk(menu.children);
      }
    });
  }

  walk(menus);
  return matchedPath;
}

const activeMenuPath = computed(() => {
  if (isPurchaseBomSharedRoute(route.path)) {
    return resolveSidebarActiveMenuPath("/cost/bom/purchase-list");
  }
  if (isProductionProjectCostSharedRoute(route.path)) {
    return resolveSidebarActiveMenuPath("/cost/production/project-cost");
  }
  const queryActiveMenu = route.query?.activeMenu;
  if (typeof queryActiveMenu === "string" && queryActiveMenu) {
    return resolveSidebarActiveMenuPath(queryActiveMenu);
  }
  const metaActiveMenu = String(route.meta.activeMenu ?? "");
  if (metaActiveMenu) {
    return resolveSidebarActiveMenuPath(metaActiveMenu);
  }
  const committeeActiveMenu = resolveCommitteeActiveMenu(route.path);
  if (committeeActiveMenu) {
    return committeeActiveMenu;
  }
  const matchedMenuPath = resolveActiveMenuByPath(
    sidebarMenus.value,
    route.path,
  );
  if (matchedMenuPath) {
    return matchedMenuPath;
  }
  const title = String(route.meta.title ?? "");
  if (title.includes("成本履历")) {
    return resolveSidebarActiveMenuPath("/cost/research/new-history");
  }
  if (title.includes("成本履历")) {
    return resolveSidebarActiveMenuPath("/cost/research/history");
  }
  if (title.includes("项目成本")) {
    return resolveSidebarActiveMenuPath("/cost/research/new-project-cost");
  }
  if (title.includes("项目成本")) {
    return resolveSidebarActiveMenuPath("/cost/research/project-cost");
  }
  if (
    route.path === "/cost/bom/detail" ||
    route.path.startsWith("/cost/bom/parts/") ||
    route.path === "/cost/bom/versions" ||
    route.path.startsWith("/cost/bom/versions/compare")
  ) {
    return "/cost/bom/query";
  }
  const breadcrumbParentPath = String(route.meta.breadcrumbParentPath ?? "");
  return breadcrumbParentPath || route.path;
});

const defaultOpeneds = computed(() => {
  const openedIndexes: string[] = [];

  function walk(menus: MenuNode[], parents: string[]): boolean {
    return menus.some((menu) => {
      const menuIndex = menu.path || menu.code;
      if (menu.path === activeMenuPath.value) {
        openedIndexes.push(...parents);
        return true;
      }
      if (menu.children?.length) {
        return walk(menu.children, [...parents, menuIndex]);
      }
      return false;
    });
  }

  walk(sidebarMenus.value, []);
  return Array.from(new Set(openedIndexes));
});

// Element Plus 的 default-opened 只在菜单实例初始化时生效。
// 隐藏详情页切换时菜单可能被重新创建，因此单独保留用户已经展开的目录。
const preservedSidebarOpeneds = ref<string[]>([]);
const sidebarOpeneds = computed(() =>
  Array.from(new Set([...preservedSidebarOpeneds.value, ...defaultOpeneds.value])),
);

watch(
  defaultOpeneds,
  (openeds) => {
    if (!openeds.length) {
      return;
    }
    preservedSidebarOpeneds.value = Array.from(
      new Set([...preservedSidebarOpeneds.value, ...openeds]),
    );
  },
  { immediate: true },
);

const sidebarMenuKey = computed(() =>
  [
    activeMenuPath.value,
    ...sidebarMenus.value.flatMap((menu) => collectMenuPaths(menu)),
  ].join("|"),
);

function collectMenuPaths(menu: MenuNode): string[] {
  return [menu.path, ...(menu.children?.flatMap(collectMenuPaths) ?? [])];
}

function findMenuTrailByPath(
  menus: MenuNode[],
  targetPath: string,
  parents: BreadcrumbItem[] = [],
): BreadcrumbItem[] {
  for (const menu of menus) {
    const isDirectory =
      menu.menuType === "M" ||
      menu.menuType === "DIRECTORY" ||
      Boolean(menu.children?.some((child) => child.menuType !== "F"));
    const currentTrail = [
      ...parents,
      {
        title: menu.title,
        path: isDirectory ? undefined : menu.path,
      },
    ];
    if (menu.path === targetPath) {
      return currentTrail;
    }
    if (menu.children?.length) {
      const childTrail = findMenuTrailByPath(
        menu.children,
        targetPath,
        currentTrail,
      );
      if (childTrail.length) {
        return childTrail;
      }
    }
  }
  return [];
}

function readMetaBreadcrumbs(value: unknown): BreadcrumbItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.reduce<BreadcrumbItem[]>((items, item) => {
    if (!item || typeof item !== "object") {
      return items;
    }
    const breadcrumb = item as Record<string, unknown>;
    const title = String(breadcrumb.title ?? "");
    if (!title) {
      return items;
    }
    const path =
      typeof breadcrumb.path === "string" && breadcrumb.path
        ? breadcrumb.path
        : undefined;
    items.push({ title, path });
    return items;
  }, []);
}

const breadcrumbs = computed(() => {
  const metaBreadcrumbs = readMetaBreadcrumbs(route.meta.breadcrumbs);
  if (metaBreadcrumbs.length > 1) {
    return metaBreadcrumbs;
  }

  const breadcrumbParentPath = String(route.meta.breadcrumbParentPath ?? "");
  const committeeActiveMenu = resolveCommitteeActiveMenu(route.path);
  const queryActiveMenu =
    typeof route.query?.activeMenu === "string" ? route.query.activeMenu : "";
  const rawBreadcrumbTargetPath =
    queryActiveMenu &&
    (isCostResearchSharedRoute(route.path) ||
      isProductionProjectCostSharedRoute(route.path))
      ? queryActiveMenu
      : breadcrumbParentPath ||
        (committeeActiveMenu && committeeActiveMenu !== route.path
          ? committeeActiveMenu
          : route.path);
  const breadcrumbTargetPath = resolveSidebarActiveMenuPath(
    rawBreadcrumbTargetPath,
  );
  const menuTrail = findMenuTrailByPath(
    sidebarMenus.value,
    breadcrumbTargetPath,
  );
  const currentTitle = pageTitle.value;

  if (!menuTrail.length) {
    return metaBreadcrumbs.length
      ? metaBreadcrumbs
      : currentTitle
        ? [{ title: currentTitle }]
        : [];
  }

  const lastMenu = menuTrail[menuTrail.length - 1];
  if (
    rawBreadcrumbTargetPath !== route.path &&
    currentTitle &&
    lastMenu?.title !== currentTitle
  ) {
    return [...menuTrail, { title: currentTitle }];
  }
  return menuTrail;
});

provide(
  "app-page-fullscreen-available",
  computed(() => {
    if (
      !isPageFullscreenEnabled.value ||
      route.meta.menuAccessExempt === true ||
      route.meta.hidden !== true
    ) {
      return false;
    }

    return ["/budget/", "/cost/"].some((prefix) =>
      route.path.startsWith(prefix),
    );
  }),
);

const effectiveSidebarCollapsed = computed(
  () => isSidebarCollapsed.value || isNarrowViewport.value,
);

const layoutStyle = computed(() => ({
  "--app-sidebar-width": effectiveSidebarCollapsed.value
    ? "var(--bq-sidebar-collapsed-width)"
    : "var(--bq-sidebar-width)",
}));

watch(
  effectiveSidebarCollapsed,
  (collapsed) => {
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      collapsed
        ? "var(--bq-sidebar-collapsed-width)"
        : "var(--bq-sidebar-width)",
    );
  },
  { immediate: true },
);

function getSidebarMenuElement(): HTMLElement | null {
  const menu = sidebarMenuRef.value as unknown as {
    $el?: HTMLElement;
  } | null;
  return menu?.$el ?? (sidebarMenuRef.value as HTMLElement | null);
}

function preserveSidebarScrollPosition() {
  preservedSidebarScrollTop.value = getSidebarMenuElement()?.scrollTop ?? 0;
}

function preserveSidebarOpenedMenu(index: string | number) {
  const menuIndex = String(index);
  if (!preservedSidebarOpeneds.value.includes(menuIndex)) {
    preservedSidebarOpeneds.value = [
      ...preservedSidebarOpeneds.value,
      menuIndex,
    ];
  }
}

function removePreservedSidebarMenu(index: string | number) {
  const menuIndex = String(index);
  preservedSidebarOpeneds.value = preservedSidebarOpeneds.value.filter(
    (item) => item !== menuIndex,
  );
}

function restoreSidebarScrollPosition() {
  const menu = getSidebarMenuElement();
  if (!menu) {
    return;
  }

  menu.scrollTop = preservedSidebarScrollTop.value;
}

function restoreSidebarScrollPositionAfterMenuUpdate() {
  void nextTick(() => {
    restoreSidebarScrollPosition();
    requestAnimationFrame(restoreSidebarScrollPosition);
  });
}

async function handleLogout() {
  removeDynamicRoutes(router, authStore.clearDynamicRoutes());
  await authStore.signOut();
  await router.push({ name: "login" });
}

async function handleSidebarMenuSelect(index: string | number): Promise<void> {
  preserveSidebarScrollPosition();
  const path = String(index);
  const standaloneDashboardPath = `/${path.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  if (
    /^\/(?:dashboard\/)?(?:productionnewtwo|visualnew|visualnew-dashboard|purchase)$/.test(
      standaloneDashboardPath,
    )
  ) {
    const target = router.resolve(standaloneDashboardPath).href;
    window.open(target, "_blank", "noopener,noreferrer");
    return;
  }
  if (/^https?:\/\//.test(path)) {
    window.open(path, "_blank", "noopener,noreferrer");
    return;
  }
  const resolvedPath = router.resolve(path).path;
  if (router.currentRoute.value.path === resolvedPath) {
    tagsViewStore.addView(router.currentRoute.value);
    return;
  }
  tagsViewStore.markMenuNavigation(resolvedPath);
  await router.push(resolvedPath);
}

async function openUserProfile() {
  await router.push({ name: "userProfile" });
}

function findSidebarMenuByPath(
  menus: MenuNode[],
  targetPath: string,
): MenuNode | undefined {
  for (const menu of menus) {
    if (menu.path === targetPath) {
      return menu;
    }
    const child = menu.children?.length
      ? findSidebarMenuByPath(menu.children, targetPath)
      : undefined;
    if (child) {
      return child;
    }
  }
  return undefined;
}

function isBreadcrumbNavigable(breadcrumb: BreadcrumbItem): boolean {
  if (!breadcrumb.path || breadcrumb.path === route.path) {
    return false;
  }

  const resolvedPath = resolveSidebarActiveMenuPath(breadcrumb.path);
  const menu = findSidebarMenuByPath(sidebarMenus.value, resolvedPath);
  return Boolean(menu && authStore.hasPermission(menu.permission));
}

async function navigateBreadcrumb(breadcrumb: BreadcrumbItem) {
  const path = breadcrumb.path;
  if (!path || !isBreadcrumbNavigable(breadcrumb)) {
    return;
  }
  await router.push(path);
}

async function toggleFullscreen() {
  const enteringFullscreen = !document.fullscreenElement;
  try {
    if (enteringFullscreen) {
      await layoutRef.value?.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  } catch {
    BaseToast.warning(
      enteringFullscreen
        ? "浏览器未允许进入全屏，请重试"
        : "退出全屏失败，请重试",
    );
  }
}

function formatTaskTime(value?: string | null) {
  if (!value) {
    return "";
  }
  return value.replace("T", " ").slice(0, 19);
}

function formatWatermarkTime(date = new Date()): string {
  return date.toLocaleString("zh-CN", { hour12: false });
}

function refreshWatermark() {
  if (!isWatermarkEnabled.value) {
    Watermark.clear();
    return;
  }

  const username = authStore.currentUser?.username;
  if (!username) {
    Watermark.clear();
    return;
  }

  Watermark.set({
    watermarkText: `${username}[${formatWatermarkTime()}]`,
  });
}

async function openTaskCenter() {
  taskCenterStore.markRead();
  await router.push("/task-center");
}

function syncFullscreenState() {
  isFullscreen.value = document.fullscreenElement === layoutRef.value;
}

function syncSidebarViewport() {
  isNarrowViewport.value = narrowViewportMedia?.matches ?? false;
}

onMounted(() => {
  if (!isAiRoute.value) taskCenterStore.connect();
  narrowViewportMedia = window.matchMedia("(max-width: 768px)");
  syncSidebarViewport();
  narrowViewportMedia.addEventListener?.("change", syncSidebarViewport);
  document.addEventListener("fullscreenchange", syncFullscreenState);
  refreshWatermark();
});

watch(
  () =>
    [
      route.fullPath,
      authStore.currentUser?.username,
      isWatermarkEnabled.value,
    ] as const,
  () => {
    refreshWatermark();
  },
  { flush: "post" },
);

watch(
  () => [route.fullPath, activeMenuPath.value, defaultOpeneds.value] as const,
  () => {
    restoreSidebarScrollPositionAfterMenuUpdate();
  },
  { flush: "post" },
);

onBeforeUnmount(() => {
  taskCenterStore.disconnect();
  Watermark.clear();
  narrowViewportMedia?.removeEventListener?.("change", syncSidebarViewport);
  document.removeEventListener("fullscreenchange", syncFullscreenState);
  document.documentElement.style.removeProperty("--app-sidebar-width");
});
</script>

<template>
  <div
    ref="layoutRef"
    class="app-layout"
    :class="{
    'is-sidebar-collapsed': effectiveSidebarCollapsed,
    'is-tags-view-enabled': isTagsViewEnabled,
  }"
    :style="layoutStyle"
  >
    <header class="app-layout__navbar">
      <div class="app-layout__brand">
        <img class="app-layout__brand-logo" :src="isAiRoute ? zhixingguanLogo : logo" :alt="isAiRoute ? '智行官' : 'BAIC'" />
        <span class="app-layout__brand-title">{{ isAiRoute ? "智行官" : "收益与成本管理系统" }}</span>
      </div>

      <!--      <div class="app-layout__navbar-left">-->
      <!--        <label class="app-layout__global-search">-->
      <!--          <el-icon><Search /></el-icon>-->
      <!--          <input-->
      <!--            v-model="searchQuery"-->
      <!--            type="search"-->
      <!--            placeholder="请输入功能名称搜索"-->
      <!--            role="combobox"-->
      <!--            aria-label="功能搜索"-->
      <!--            aria-autocomplete="list"-->
      <!--            aria-controls="app-layout-search-results"-->
      <!--            :aria-expanded="Boolean(searchQuery.trim())"-->
      <!--            :aria-activedescendant="-->
      <!--              searchResults.length-->
      <!--                ? `app-layout-search-option-${activeSearchIndex}`-->
      <!--                : undefined-->
      <!--            "-->
      <!--            @input="resetSearchSelection"-->
      <!--            @keydown="handleSearchKeydown"-->
      <!--          />-->
      <!--        </label>-->
      <!--        <div-->
      <!--          v-if="searchQuery.trim()"-->
      <!--          id="app-layout-search-results"-->
      <!--          class="app-layout__search-results"-->
      <!--          role="listbox"-->
      <!--        >-->
      <!--          <template v-if="searchResults.length">-->
      <!--            <button-->
      <!--              v-for="(result, index) in searchResults"-->
      <!--              :id="`app-layout-search-option-${index}`"-->
      <!--              :key="result.path"-->
      <!--              class="app-layout__search-option"-->
      <!--              :class="{ 'is-active': index === activeSearchIndex }"-->
      <!--              type="button"-->
      <!--              role="option"-->
      <!--              :aria-selected="index === activeSearchIndex"-->
      <!--              @click="openSearchResult(result)"-->
      <!--            >-->
      <!--              <strong>{{ result.title }}</strong>-->
      <!--              <span>{{ result.trail }}</span>-->
      <!--            </button>-->
      <!--          </template>-->
      <!--          <div v-else class="app-layout__search-empty" role="status">-->
      <!--            未找到匹配功能-->
      <!--          </div>-->
      <!--        </div>-->
      <!--      </div>-->

      <div class="app-layout__navbar-right">
        <!--        <button class="app-layout__quick-link" type="button">-->
        <!--          <el-icon><Monitor /></el-icon>-->
        <!--          <span>看板(综合)</span>-->
        <!--        </button>-->
        <!--        <button class="app-layout__quick-link" type="button">-->
        <!--          <el-icon><User /></el-icon>-->
        <!--          <span>管理层(季采)</span>-->
        <!--        </button>-->
        <!--        <button class="app-layout__quick-link is-active" type="button">-->
        <!--          <el-icon><Briefcase /></el-icon>-->
        <!--          <span>项目组(季采)</span>-->
        <!--        </button>-->
        <span class="app-layout__navbar-divider" aria-hidden="true" />
        <el-popover
          v-if="taskCenterStore.enabled"
          placement="bottom-end"
          trigger="click"
          width="360"
          :hide-after="0"
          @show="taskCenterStore.markRead"
        >
          <template #reference>
            <el-button class="app-layout__quick-link" native-type="button">
              <el-badge
                class="app-layout__task-badge"
                :value="taskCenterStore.unreadCount"
                :max="99"
                :hidden="taskCenterStore.unreadCount === 0"
              >
                <el-icon><Bell /></el-icon>
              </el-badge>
              <span style="margin-left: 5px">任务</span>
            </el-button>
          </template>
          <div class="app-layout__task-popover">
            <div class="app-layout__task-popover-header">
              <span>最新任务</span>
              <el-tag
                :type="taskCenterStore.connected ? 'success' : 'info'"
                size="small"
              >
                {{ taskCenterStore.connected ? "实时" : "重连中" }}
              </el-tag>
            </div>
            <el-empty
              v-if="taskCenterStore.latestTasks.length === 0"
              description="暂无任务更新"
              :image-size="56"
            />
            <div
              v-for="task in taskCenterStore.latestTasks"
              v-else
              :key="task.taskId"
              class="app-layout__task-item"
            >
              <div class="app-layout__task-item-header">
                <button
                  class="app-layout__task-item-open"
                  type="button"
                  @click="openTaskCenter"
                >
                  <span class="app-layout__task-item-main">
                    <span class="app-layout__task-item-title-row">
                      <span class="app-layout__task-item-title">
                        {{ taskTypeView[task.taskType] ?? task.taskType }}
                      </span>
                      <el-tag
                        :type="hasCostCalculationFailures(task) ? 'warning' : taskStatusView[task.status]?.type"
                        size="small"
                      >
                        {{ hasCostCalculationFailures(task) ? '已完成，存在计算失败' : (taskStatusView[task.status]?.label ?? task.status) }}
                      </el-tag>
                    </span>
                  </span>
                </button>
                <span class="app-layout__task-item-side">
                  <span>{{ task.progress }}%</span>
                </span>
                <TaskDownloadAction
                  class="app-layout__task-item-download"
                  :task-id="task.taskId"
                  :status="task.status"
                  :files="taskCenterStore.filesFor(task.taskId)"
                />
              </div>
              <button
                class="app-layout__task-item-subtitle"
                type="button"
                @click="openTaskCenter"
              >
                <span>
                  {{ task.taskNo }} · {{ formatTaskTime(task.createdAt) }}
                </span>
              </button>
            </div>
            <el-button
              class="app-layout__task-more"
              text
              @click="openTaskCenter"
            >
              查看任务中心
            </el-button>
          </div>
        </el-popover>
        <span class="app-layout__navbar-divider" aria-hidden="true" />
        <button
          class="app-layout__quick-link"
          type="button"
          :aria-pressed="isFullscreen"
          @click="toggleFullscreen"
        >
          <el-icon><FullScreen /></el-icon>
          <span>{{ isFullscreen ? "退出全屏" : "全屏" }}</span>
        </button>
        <span class="app-layout__navbar-divider" aria-hidden="true" />
        <el-dropdown trigger="click">
          <button
            class="app-layout__user"
            type="button"
            :aria-label="`当前用户菜单：${currentUserDisplayName}`"
          >
            <span class="app-layout__user-avatar" aria-hidden="true">
              {{
                (
                  authStore.currentUser?.displayName ||
                  authStore.currentUser?.username ||
                  "系"
                ).slice(0, 1)
              }}
            </span>
            <span class="app-layout__user-name">
              {{
                authStore.currentUser?.displayName ||
                authStore.currentUser?.username ||
                "当前用户"
              }}
            </span>
            <el-icon><ArrowDown /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="openUserProfile">
                <el-icon><User /></el-icon>
                个人中心
              </el-dropdown-item>
              <el-dropdown-item @click="handleLogout">
                <el-icon><SwitchButton /></el-icon>
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <aside class="app-layout__sidebar">
      <el-menu
        :key="sidebarMenuKey"
        ref="sidebarMenuRef"
        @mousedown.capture="preserveSidebarScrollPosition"
        @open="preserveSidebarOpenedMenu"
        @close="removePreservedSidebarMenu"
        @select="handleSidebarMenuSelect"
        :collapse="effectiveSidebarCollapsed"
        :collapse-transition="false"
        :default-active="activeMenuPath"
        :default-openeds="sidebarOpeneds"
        class="app-layout__menu"
      >
        <SidebarMenuItem
          v-for="item in sidebarMenus"
          :key="item.code"
          :item="item"
        />
      </el-menu>
      <div class="app-layout__sidebar-footer">
        <button
          class="app-layout__sidebar-toggle"
          type="button"
          :aria-label="
            effectiveSidebarCollapsed ? '展开侧边导航' : '收起侧边导航'
          "
          :aria-pressed="effectiveSidebarCollapsed"
          @click="isSidebarCollapsed = !isSidebarCollapsed"
        >
          <span class="app-layout__sidebar-toggle-label">
            {{ effectiveSidebarCollapsed ? "展开" : "收起侧边导航" }}
          </span>
          <el-icon>
            <Expand v-if="effectiveSidebarCollapsed" />
            <Fold v-else />
          </el-icon>
        </button>
      </div>
    </aside>

    <section class="app-layout__main">
      <nav
        v-if="breadcrumbs.length"
        class="app-layout__tags-view"
        aria-label="已打开页面"
      >
        <button
          class="app-layout__home-link"
          type="button"
          aria-label="返回首页"
          title="返回首页"
          @click="router.push({ name: 'dashboard' })"
        >
          <el-icon><HomeFilled /></el-icon>
        </button>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item
            v-for="(breadcrumb, index) in breadcrumbs"
            :key="`${breadcrumb.path ?? breadcrumb.title}-${index}`"
          >
            <span
              v-if="
                breadcrumb.path &&
                index < breadcrumbs.length - 1 &&
                isBreadcrumbNavigable(breadcrumb)
              "
              class="app-layout__tag-item app-layout__tag-item--link"
              role="link"
              tabindex="0"
              @click="navigateBreadcrumb(breadcrumb)"
            >
              {{ breadcrumb.title }}
            </span>
            <span
              v-else
              :class="[
                'app-layout__tag-item',
                {
                  'is-active': index === breadcrumbs.length - 1,
                  'is-disabled': index < breadcrumbs.length - 1,
                },
              ]"
            >
              {{ breadcrumb.title }}
            </span>
          </el-breadcrumb-item>
        </el-breadcrumb>
      </nav>

      <TagsView v-if="isTagsViewEnabled" class="app-layout__route-tags" />

      <main class="app-layout__content">
        <AppRouteView />
      </main>
    </section>
  </div>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
  background: var(--bq-color-bg);
  --app-route-tags-height: 0px;
}

.app-layout:fullscreen {
  width: 100vw;
  min-height: 100vh;
  overflow: auto;
  background: var(--bq-color-bg);
}

.app-layout__sidebar {
  position: fixed;
  inset: var(--bq-header-height) auto 0 0;
  z-index: 1000;
  width: var(--app-sidebar-width);
  min-height: calc(100vh - var(--bq-header-height));
  overflow: hidden;
  background: var(--bq-color-sidebar);
  color: var(--bq-color-text);
  border-right: 1px solid var(--bq-color-border-subtle);
  box-shadow: none;
  transition: width 0.18s ease;
}

.app-layout__brand {
  width: var(--bq-brand-width);
  height: var(--bq-header-height);
  flex: 0 0 var(--bq-brand-width);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 0 24px;
  overflow: hidden;
  text-align: left;
}

.app-layout__home-link {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  flex: 0 0 20px;
  margin-right: 8px;
  padding: 0;
  align-self: center;
  line-height: 20px;
  color: var(--bq-color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}

.app-layout__home-link :deep(.el-icon) {
  font-size: 16px;
  line-height: 20px;
  transform: translateY(-1px);
}

.app-layout__home-link:hover {
  color: var(--bq-color-primary);
  background: var(--bq-color-primary-soft);
}

.app-layout__brand-logo {
  width: 78px;
  height: 22px;
  flex: 0 0 78px;
  display: block;
  object-fit: contain;
  object-position: left center;
}

.app-layout__brand-title {
  color: var(--bq-color-on-primary);
  font-size: 16px;
  line-height: 20px;
  font-weight: 600;
  white-space: nowrap;
  transition:
    opacity 0.16s ease,
    width 0.16s ease;
}

.app-layout__menu {
  height: calc(100vh - var(--bq-header-height) - 48px);
  border-right: 0;
  background: transparent;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
  scrollbar-width: thin;
  padding: 8px 10px;
  transition: scrollbar-color 0.16s ease;
  padding-right: 0;
}

.app-layout__menu:hover {
  scrollbar-color: color-mix(in srgb, var(--bq-color-primary), white 68%)
    transparent;
}

.app-layout__menu::-webkit-scrollbar {
  width: 8px;
}

.app-layout__menu::-webkit-scrollbar-track {
  background: transparent;
}

.app-layout__menu::-webkit-scrollbar-thumb {
  min-height: 32px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: transparent;
  background-clip: content-box;
}

.app-layout__menu:hover::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--bq-color-primary), white 68%);
}

.app-layout__menu::-webkit-scrollbar-thumb:hover {
  background-color: color-mix(in srgb, var(--bq-color-primary), white 54%);
}

.app-layout__menu:not(.el-menu--collapse) {
  width: var(--bq-sidebar-width);
}

.app-layout__menu {
  --el-transition-duration: 0.15s;
}

.app-layout__menu :deep(.el-menu-item),
.app-layout__menu :deep(.el-sub-menu__title) {
  height: 38px;
  min-height: 38px;
  margin: 0 0 2px;
  padding: 0 12px !important;
  border-radius: 4px;
  color: var(--bq-color-text-secondary);
  font-size: 16px;
  font-weight: 400;
  line-height: 38px;
  white-space: nowrap;
  transition:
    background 0.16s ease,
    color 0.16s ease;
}

.app-layout__menu :deep(.el-menu-item span),
.app-layout__menu :deep(.el-sub-menu__title span) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-layout__menu :deep(.el-icon) {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  color: var(--bq-color-icon-muted);
  font-size: 16px;
}

.app-layout__menu :deep(.el-menu-item:hover),
.app-layout__menu :deep(.el-sub-menu__title:hover) {
  background: var(--bq-color-sidebar-hover);
  color: var(--bq-color-primary);
}

.app-layout__menu :deep(.el-menu-item.is-active),
.app-layout__menu :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: var(--bq-color-primary-hover);
  background: transparent;
  font-weight: 600;
  box-shadow: none;
}

.app-layout__menu :deep(.el-menu-item.is-active .el-icon),
.app-layout__menu :deep(.el-sub-menu.is-active > .el-sub-menu__title .el-icon) {
  color: var(--bq-color-primary-hover);
}

.app-layout__menu :deep(.el-menu-item:hover .el-icon),
.app-layout__menu :deep(.el-sub-menu__title:hover .el-icon) {
  color: var(--bq-color-primary);
}

.app-layout__menu :deep(.el-menu) {
  background: transparent;
}

.app-layout__menu :deep(.el-sub-menu .el-menu-item) {
  min-width: 0;
}

.app-layout__menu :deep(.sidebar-menu-item.is-level-0 > .el-sub-menu__title),
.app-layout__menu :deep(.sidebar-menu-item.is-level-0.el-menu-item) {
  padding-left: 12px !important;
  font-weight: 400;
}

.app-layout__menu :deep(.sidebar-menu-item.is-level-1.el-menu-item),
.app-layout__menu :deep(.sidebar-menu-item.is-level-1 > .el-sub-menu__title) {
  height: 34px;
  min-height: 34px;
  margin: 0 2px 2px;
  padding-left: 18px !important;
  border-radius: 4px;
  color: var(--bq-color-text-secondary);
  font-size: 16px;
  line-height: 34px;
}

.app-layout__menu :deep(.sidebar-menu-item.is-level-1.el-menu-item.is-active),
.app-layout__menu
  :deep(
    .sidebar-menu-item.is-level-1.el-sub-menu.is-active > .el-sub-menu__title
  ) {
  color: var(--bq-color-primary-hover);
  background: var(--bq-color-sidebar-active);
  font-weight: 600;
}

.app-layout__menu :deep(.sidebar-menu-item.is-level-2.el-menu-item),
.app-layout__menu :deep(.sidebar-menu-item.is-level-2 > .el-sub-menu__title) {
  height: 32px;
  min-height: 32px;
  margin: 0 6px 2px 12px;
  padding-left: 26px !important;
  border-radius: var(--bq-radius-control);
  color: var(--bq-color-text-secondary);
  font-size: 16px;
  line-height: 32px;
}

.app-layout__menu
  :deep(.sidebar-menu-item.is-level-2 .el-sub-menu__icon-arrow) {
  right: 10px;
}

.app-layout__menu :deep(.sidebar-menu-item.is-level-2 span[title]) {
  max-width: 118px;
}

.app-layout__menu :deep(.sidebar-menu-item.is-level-2.el-menu-item:hover),
.app-layout__menu
  :deep(.sidebar-menu-item.is-level-2 > .el-sub-menu__title:hover) {
  background: var(--bq-color-sidebar-hover);
  color: var(--bq-color-primary);
}

.app-layout__menu :deep(.sidebar-menu-item.is-level-2.el-menu-item.is-active),
.app-layout__menu
  :deep(
    .sidebar-menu-item.is-level-2.el-sub-menu.is-active > .el-sub-menu__title
  ) {
  background: var(--bq-color-sidebar-active);
  color: var(--bq-color-primary-hover);
  font-weight: 600;
}

.app-layout__menu :deep(.sidebar-menu-item__dot) {
  width: 4px;
  height: 4px;
  flex: 0 0 4px;
  margin: 0 14px 0 0;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
}

.app-layout__menu :deep(.sidebar-menu-item.is-level-2 .sidebar-menu-item__dot) {
  width: 3px;
  height: 3px;
  flex-basis: 3px;
  margin: 0 12px 0 0;
  background: var(--bq-color-text-muted);
  opacity: 0;
}

.app-layout__menu :deep(.el-menu-item.is-active .sidebar-menu-item__dot),
.app-layout__menu
  :deep(.el-sub-menu.is-active > .el-sub-menu__title .sidebar-menu-item__dot) {
  opacity: 1;
}

.app-layout__menu
  :deep(
    .sidebar-menu-item.is-level-2.el-menu-item.is-active .sidebar-menu-item__dot
  ),
.app-layout__menu
  :deep(
    .sidebar-menu-item.is-level-2.el-sub-menu.is-active
      > .el-sub-menu__title
      .sidebar-menu-item__dot
  ) {
  background: var(--bq-color-primary-hover);
}

.app-layout__menu
  :deep(
    .sidebar-menu-item.is-level-2.el-menu-item:hover .sidebar-menu-item__dot
  ),
.app-layout__menu
  :deep(
    .sidebar-menu-item.is-level-2
      > .el-sub-menu__title:hover
      .sidebar-menu-item__dot
  ) {
  background: var(--bq-color-primary);
}

.app-layout__menu :deep(.el-sub-menu__icon-arrow) {
  right: 12px;
  color: var(--bq-color-icon-muted);
  font-size: 12px;
}

.is-sidebar-collapsed .app-layout__menu :deep(.el-menu-item),
.is-sidebar-collapsed .app-layout__menu :deep(.el-sub-menu__title) {
  justify-content: center;
  padding: 0 !important;
}

.is-sidebar-collapsed .app-layout__menu :deep(.el-icon) {
  margin-right: 0;
}

.is-sidebar-collapsed .app-layout__menu {
  padding: 8px;
}

.app-layout__main {
  height: 100vh;
  margin-left: var(--app-sidebar-width);
  min-width: 0;
  overflow: hidden;
  background: var(--bq-color-bg);
}

.app-layout__navbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1001;
  height: var(--bq-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  background: linear-gradient(
    90deg,
    var(--bq-color-primary-active) 0%,
    var(--bq-color-primary) 55%,
    var(--bq-color-primary-hover) 100%
  );
  border-bottom: 0;
  box-shadow: var(--bq-shadow-navbar);
}

.app-layout__navbar-left {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  padding: 0 16px;
}

.app-layout__global-search {
  width: min(320px, 36vw);
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.82);
}

.app-layout__global-search .el-icon {
  flex: 0 0 auto;
  font-size: 15px;
}

.app-layout__global-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--bq-color-on-primary);
  font-size: 14px;
}

.app-layout__global-search input::placeholder {
  color: rgba(255, 255, 255, 0.62);
}

.app-layout__search-results {
  position: absolute;
  top: calc(100% + 8px);
  left: 16px;
  width: min(360px, calc(100vw - 32px));
  padding: 4px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-surface);
  box-shadow: var(--bq-shadow-panel);
}

.app-layout__search-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 44px;
  justify-content: center;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--bq-radius-control);
  background: transparent;
  color: var(--bq-color-text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.app-layout__search-option:hover,
.app-layout__search-option.is-active {
  background: var(--bq-color-bg-soft);
  color: var(--bq-color-primary);
}

.app-layout__search-option span {
  color: var(--bq-color-text-secondary);
  font-size: 12px;
}

.app-layout__search-empty {
  padding: 16px 10px;
  color: var(--bq-color-text-secondary);
  font-size: 13px;
  text-align: center;
}

.app-layout__sidebar-toggle {
  width: 100%;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-bg-soft);
  color: var(--bq-color-text-secondary);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.app-layout__sidebar-toggle:hover {
  border-color: var(--bq-color-primary);
  background: var(--bq-color-primary-soft);
  color: var(--bq-color-primary);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--bq-color-primary), white 82%);
}

.app-layout__sidebar-toggle .el-icon {
  font-size: 16px;
}

.app-layout__sidebar-toggle-label {
  min-width: 0;
  color: var(--bq-color-text-secondary);
  font-size: 15px;
  line-height: 20px;
  white-space: nowrap;
}

.app-layout__sidebar-footer {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-top: 1px solid var(--bq-color-border-subtle);
  background: var(--bq-color-surface);
}

.is-sidebar-collapsed .app-layout__sidebar-footer {
  justify-content: center;
  padding: 0 8px;
}

.is-sidebar-collapsed .app-layout__sidebar-toggle {
  height: 34px;
  justify-content: center;
  gap: 0;
  padding: 0;
}

.is-sidebar-collapsed .app-layout__sidebar-toggle-label {
  width: 0;
  opacity: 0;
  overflow: hidden;
}

.app-layout__navbar-right {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 16px 0 8px;
  color: rgba(255, 255, 255, 0.9);
}

.app-layout__quick-link {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  white-space: nowrap;
  cursor: pointer;
}

.app-layout__quick-link:hover,
.app-layout__quick-link.is-active {
  background: rgba(255, 255, 255, 0.14);
  color: var(--bq-color-on-primary);
}

.app-layout__quick-link .el-icon {
  font-size: 15px;
}

.app-layout__task-badge {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.app-layout__quick-link :deep(.el-badge__content) {
  border: 0;
}

.app-layout__task-popover {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app-layout__task-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 600;
}

.app-layout__task-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 8px;
  background: var(--bq-color-surface);
  color: var(--bq-color-text);
}

.app-layout__task-item:hover {
  border-color: var(--bq-color-primary);
  background: var(--bq-color-primary-soft);
}

.app-layout__task-item-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.app-layout__task-item-open {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.app-layout__task-item-download {
  flex: 0 0 auto;
}

.app-layout__task-item-main,
.app-layout__task-item-side {
  min-width: 0;
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
}

.app-layout__task-item-title,
.app-layout__task-item-subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-layout__task-item-title-row {
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-layout__task-item-title {
  min-width: 0;
  max-width: 210px;
  font-size: 13px;
  font-weight: 600;
}

.app-layout__task-item-subtitle,
.app-layout__task-item-side span:last-child {
  color: var(--bq-color-text-secondary);
  font-size: 12px;
}

.app-layout__task-item-side {
  flex: 0 0 auto;
  margin-left: auto;
  align-items: center;
}

.app-layout__task-item-subtitle {
  width: 100%;
  padding: 4px 0 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.app-layout__task-more {
  align-self: center;
}

.app-layout__navbar-divider {
  width: 1px;
  height: 18px;
  margin: 0 6px;
  background: rgba(255, 255, 255, 0.26);
}

.app-layout__user {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 8px;
  padding: 0 6px 0 8px;
  background: transparent;
  color: var(--bq-color-on-primary);
  cursor: pointer;
}

.app-layout__user:hover {
  background: rgba(255, 255, 255, 0.14);
  color: var(--bq-color-on-primary);
}

.app-layout__user-avatar {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.88);
  color: var(--bq-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.app-layout__user-name {
  white-space: nowrap;
}

.app-layout__tags-view {
  position: fixed;
  top: var(--bq-header-height);
  right: auto;
  left: var(--app-sidebar-width);
  z-index: 998;
  display: flex;
  align-items: center;
  width: calc(100% - var(--app-sidebar-width));
  min-width: 0;
  height: var(--bq-tags-height);
  padding: 0 24px;
  background: var(--bq-color-surface);
  border-bottom: 1px solid var(--bq-color-border);
  box-shadow: none;
  transition:
    left 0.18s ease,
    width 0.18s ease;
}

.app-layout__tags-view :deep(.el-breadcrumb__inner),
.app-layout__tags-view :deep(.el-breadcrumb__separator) {
  color: var(--bq-color-text-secondary);
  font-size: 14px;
}

.app-layout__tags-view :deep(.el-breadcrumb) {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  line-height: 20px;
}

.app-layout__tags-view :deep(.el-breadcrumb__item),
.app-layout__tags-view :deep(.el-breadcrumb__inner),
.app-layout__tags-view :deep(.el-breadcrumb__separator) {
  display: inline-flex;
  align-items: center;
  line-height: 20px;
}

.app-layout__tags-view
  :deep(.el-breadcrumb__item:last-child .el-breadcrumb__separator) {
  display: none;
}

.app-layout__tag-item {
  display: inline;
  height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--bq-color-text);
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
}

.app-layout__tag-item--link {
  cursor: pointer;
  transition: color 0.16s ease;
}

.app-layout__tag-item--link:hover {
  color: var(--bq-color-primary);
}

.app-layout__tag-item.is-active {
  color: var(--bq-color-primary);
}

.app-layout__tag-item.is-disabled {
  color: var(--bq-color-text-secondary);
  cursor: not-allowed;
}

.app-layout__content {
  box-sizing: border-box;
  height: 100vh;
  overflow: auto;
  padding-top: calc(var(--bq-header-height) + var(--bq-tags-height));
  padding-left:  var(--bq-space-page-x);
  padding-right:  var(--bq-space-page-x);
  scrollbar-gutter: auto;
}

.app-layout__content::-webkit-scrollbar-button:vertical {
  display: none;
  width: 0;
  height: 0;
}

.app-layout__route-tags {
  position: fixed;
  top: calc(var(--bq-header-height) + var(--bq-tags-height));
  right: 0;
  left: var(--app-sidebar-width);
  z-index: 1002;
  width: calc(100% - var(--app-sidebar-width));
  transition:
    left 0.18s ease,
    width 0.18s ease;
}

.is-tags-view-enabled .app-layout__content {
  padding-top: calc(
    var(--bq-header-height) + var(--bq-tags-height) + 40px + 10px
  );
}

.is-tags-view-enabled {
  --app-route-tags-height: 40px;
}

@media print {
  .app-layout,
  .app-layout__main,
  .app-layout__content {
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .app-layout__navbar,
  .app-layout__sidebar,
  .app-layout__tags-view {
    display: none !important;
  }

  .app-layout__main {
    margin-left: 0 !important;
  }

  .app-layout__content {
    padding: 0;
    scrollbar-gutter: auto;
  }

  .app-layout__content :deep(.page-container) {
    min-height: 0;
    padding: 0;
    border: 0;
    box-shadow: none;
  }

  .app-layout__content :deep(.page-container__header) {
    display: none !important;
  }
}

@media (max-width: 768px) {
  .app-layout {
    --app-sidebar-width: var(--bq-sidebar-collapsed-width);
  }

  .app-layout__user-name {
    display: none;
  }
}
</style>
