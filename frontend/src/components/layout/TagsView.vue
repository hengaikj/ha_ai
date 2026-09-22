<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  inject,
  type Ref,
} from "vue";
import {
  Back,
  CircleClose,
  Close,
  Right,
} from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import { useTagsViewStore, type TagView } from "@/stores/tags-view";

const route = useRoute();
const router = useRouter();
const tagsViewStore = useTagsViewStore();

type SidebarMenuNode = {
  path?: string;
  children?: SidebarMenuNode[];
};

const sidebarMenus = inject<Ref<SidebarMenuNode[]>>("app-sidebar-menus");

function isSidebarMenuRoute(path: string): boolean {
  if (!sidebarMenus?.value?.length) return false;
  const visit = (menus: SidebarMenuNode[]): boolean =>
    menus.some(
      (menu) =>
        menu.path === path || (menu.children?.length ? visit(menu.children) : false),
    );
  return visit(sidebarMenus.value);
}

function pruneNonSidebarViews(): void {
  if (!sidebarMenus?.value?.length) return;
  for (const view of [...tagsViewStore.visitedViews]) {
    if (view.affix) continue;
    try {
      const path = new URL(view.fullPath, window.location.origin).pathname;
      if (!isSidebarMenuRoute(path)) tagsViewStore.removeView(view.key);
    } catch {
      tagsViewStore.removeView(view.key);
    }
  }
}

type ContextMenuState = {
  view: TagView;
  left: number;
  top: number;
};

const contextMenu = ref<ContextMenuState | null>(null);
const tagsViewRef = ref<HTMLElement | null>(null);

function isActive(view: TagView): boolean {
  return (
    view.key === route.fullPath ||
    (route.meta.hidden !== true && view.routeName === String(route.name))
  );
}

async function closeView(view: TagView): Promise<void> {
  if (view.affix) return;

  const currentIndex = tagsViewStore.visitedViews.findIndex(
    (item) => item.key === view.key,
  );
  const shouldNavigate = isActive(view);
  tagsViewStore.removeView(view.key);

  if (!shouldNavigate) return;

  const nextView =
    tagsViewStore.visitedViews[currentIndex - 1] ??
    tagsViewStore.visitedViews[currentIndex] ??
    tagsViewStore.lastView;
  await router.push(nextView?.fullPath ?? "/");
}

function closeContextMenu(): void {
  contextMenu.value = null;
}

function openContextMenu(event: MouseEvent, view: TagView): void {
  const menuWidth = 132;
  const menuHeight = 244;
  contextMenu.value = {
    view,
    left: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
    top: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
  };
}

function scrollActiveTagIntoView(): void {
  const root = tagsViewRef.value;
  const wrap = root?.querySelector<HTMLElement>(".el-scrollbar__wrap");
  const activeTag = root?.querySelector<HTMLElement>(
    ".tags-view__item.is-active",
  );
  if (!wrap || !activeTag) return;

  const wrapRect = wrap.getBoundingClientRect();
  const tagRect = activeTag.getBoundingClientRect();
  const edgePadding = 12;

  if (tagRect.left < wrapRect.left + edgePadding) {
    wrap.scrollLeft -= wrapRect.left + edgePadding - tagRect.left;
  } else if (tagRect.right > wrapRect.right - edgePadding) {
    wrap.scrollLeft += tagRect.right - (wrapRect.right - edgePadding);
  }
}

function scheduleActiveTagScroll(): void {
  void nextTick(() => {
    requestAnimationFrame(scrollActiveTagIntoView);
  });
}

async function closeCurrentView(view: TagView): Promise<void> {
  closeContextMenu();
  await closeView(view);
}

async function closeOtherViews(view: TagView): Promise<void> {
  closeContextMenu();
  tagsViewStore.removeOtherViews(view.key);
  if (isActive(view)) return;
  await router.push(view.fullPath);
}

async function closeLeftViews(view: TagView): Promise<void> {
  closeContextMenu();
  const currentWasClosed =
    !view.affix &&
    tagsViewStore.visitedViews.some(
      (item) => item.key === route.fullPath && item.key !== view.key,
    ) &&
    tagsViewStore.visitedViews.findIndex((item) => item.key === route.fullPath) <
      tagsViewStore.visitedViews.findIndex((item) => item.key === view.key);
  tagsViewStore.removeLeftViews(view.key);
  if (currentWasClosed) await router.push(view.fullPath);
}

async function closeRightViews(view: TagView): Promise<void> {
  closeContextMenu();
  const targetIndex = tagsViewStore.visitedViews.findIndex(
    (item) => item.key === view.key,
  );
  const currentIndex = tagsViewStore.visitedViews.findIndex((item) =>
    isActive(item),
  );
  const currentWasClosed = currentIndex > targetIndex && currentIndex >= 0;
  tagsViewStore.removeViewsAfter(view.key);
  if (currentWasClosed) await router.push(view.fullPath);
}

async function closeAllViews(): Promise<void> {
  closeContextMenu();
  const currentView = tagsViewStore.visitedViews.find(
    (view) => view.key === route.fullPath,
  );
  tagsViewStore.removeAllViews();
  if (currentView && !currentView.affix) {
    await router.push(tagsViewStore.visitedViews[0]?.fullPath ?? "/");
  }
}

onMounted(() => document.addEventListener("click", closeContextMenu));
onBeforeUnmount(() =>
  document.removeEventListener("click", closeContextMenu),
);

watch(
  () => [route.fullPath, sidebarMenus?.value],
  () => {
    pruneNonSidebarViews();
    // 只有左侧实际展示的菜单路由才进入标签栏；详情/辅助路由即使未标记
    // hidden，也不能因为被程序导航到而产生标签。
    if (
      route.meta.hidden !== true &&
      (route.name === "dashboard" ||
        tagsViewStore.consumeMenuNavigation(route.path) ||
        isSidebarMenuRoute(route.path))
    ) {
      tagsViewStore.addView(route);
    }
    scheduleActiveTagScroll();
  },
  { immediate: true },
);

watch(
  () => tagsViewStore.visitedViews.length,
  scheduleActiveTagScroll,
);
</script>

<template>
  <nav ref="tagsViewRef" class="tags-view" aria-label="已打开页面">
    <el-scrollbar
      class="tags-view__scrollbar"
      view-class="tags-view__content"
      :always="true"
    >
      <RouterLink
        v-for="view in tagsViewStore.visitedViews"
        :key="view.key"
        :to="view.fullPath"
        class="tags-view__item"
        :class="{ 'is-active': isActive(view) }"
        @contextmenu.prevent.stop="openContextMenu($event, view)"
      >
        <span class="tags-view__title">{{ view.title }}</span>
        <button
          v-if="!view.affix"
          class="tags-view__close"
          type="button"
          :aria-label="`关闭${view.title}`"
          @click.prevent.stop="closeView(view)"
        >
          <el-icon><Close /></el-icon>
        </button>
      </RouterLink>
    </el-scrollbar>

    <div
      v-if="contextMenu"
      class="tags-view__context-menu"
      :style="{ left: `${contextMenu.left}px`, top: `${contextMenu.top}px` }"
      @click.stop
    >
      <button
        type="button"
        :disabled="contextMenu.view.affix"
        @click="closeCurrentView(contextMenu.view)"
      >
        <el-icon><Close /></el-icon>
        关闭当前
      </button>
      <button type="button" @click="closeOtherViews(contextMenu.view)">
        <el-icon><CircleClose /></el-icon>
        关闭其他
      </button>
      <button type="button" @click="closeLeftViews(contextMenu.view)">
        <el-icon><Back /></el-icon>
        关闭左侧
      </button>
      <button type="button" @click="closeRightViews(contextMenu.view)">
        <el-icon><Right /></el-icon>
        关闭右侧
      </button>
      <button type="button" @click="closeAllViews">
        <el-icon><CircleClose /></el-icon>
        全部关闭
      </button>
    </div>
  </nav>
</template>

<style scoped>
.tags-view {
  box-sizing: border-box;
  height: 40px;
  overflow: visible;
  background: var(--bq-color-bg-soft);
  border-bottom: 1px solid var(--bq-color-border-subtle);
  box-shadow: 0 1px 4px rgba(31, 94, 184, 0.06);
}

.tags-view__scrollbar {
  height: 40px;
}

.tags-view__scrollbar :deep(.tags-view__content) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: max-content;
  height: 40px;
  padding: 5px 12px;
  white-space: nowrap;
}

.tags-view__scrollbar :deep(.el-scrollbar__bar.is-horizontal) {
  right: 12px;
  bottom: 0;
  left: 12px;
  height: 6px;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.tags-view:hover :deep(.el-scrollbar__bar.is-horizontal) {
  opacity: 1;
}

.tags-view__item {
  position: relative;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  height: 30px;
  padding: 0 10px;
  color: var(--bq-color-text-muted);
  border: 1px solid var(--bq-color-border);
  border-radius: 6px;
  background: var(--bq-color-surface);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  text-decoration: none;
  transition:
    color 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.tags-view__item:hover {
  color: var(--bq-color-primary);
  background: var(--bq-color-surface);
  border-color: var(--bq-color-primary);
  box-shadow: 0 2px 6px rgba(31, 94, 184, 0.08);
}

.tags-view__item.is-active {
  color: var(--bq-color-primary);
  border-color: var(--bq-color-primary);
  background: var(--bq-color-surface);
  box-shadow:
    0 2px 8px rgba(31, 94, 184, 0.12),
    inset 0 -2px 0 var(--bq-color-primary);
}

.tags-view__title {
  font-size: 14px;
  line-height: 20px;
}

.tags-view__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 5px;
  padding: 0;
  color: inherit;
  border: 0;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  opacity: 0.62;
  transition:
    color 0.16s ease,
    background-color 0.16s ease,
    opacity 0.16s ease;
}

.tags-view__item:hover .tags-view__close,
.tags-view__item.is-active .tags-view__close,
.tags-view__close:focus-visible {
  opacity: 1;
}

.tags-view__close:hover {
  color: var(--bq-color-danger, #f56c6c);
  background: var(--bq-color-danger-soft);
}

.tags-view__context-menu {
  position: fixed;
  z-index: 2000;
  width: 132px;
  padding: 5px 0;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border);
  border-radius: 4px;
  box-shadow: var(--bq-shadow-panel);
}

.tags-view__context-menu button {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  height: 34px;
  padding: 0 14px;
  color: var(--bq-color-text);
  font: inherit;
  font-size: 12px;
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.tags-view__context-menu .el-icon {
  flex: 0 0 auto;
  font-size: 14px;
}

.tags-view__context-menu button:hover:not(:disabled) {
  color: var(--bq-color-primary);
  background: var(--bq-color-primary-light, #ecf5ff);
}

.tags-view__context-menu button:disabled {
  color: var(--bq-color-text-tertiary, #a8abb2);
  cursor: not-allowed;
}
</style>
