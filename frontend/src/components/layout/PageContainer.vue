<script setup lang="ts">
import {
  computed,
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  nextTick,
  onUpdated,
  ref,
  useSlots,
  watch,
} from "vue";
import { Close, FullScreen } from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import { isPageFullscreenEnabled } from "@/config/features";
import { replaceToReturn } from "@/utils/return-navigation";
const SHOW_PAGE_DESCRIPTION = false;
const PAGE_FULLSCREEN_STORAGE_PREFIX = "bq.page-fullscreen.enabled:";
const FULLSCREEN_TARGET_SELECTOR =
  ".page-container__fullscreen-target, .page-container__body .base-toolbar__extra";
const isFullscreen = ref(false);
const isActive = ref(true);
const pageContainerRef = ref<HTMLElement>();
const hasToolbarTarget = ref(false);
const fullscreenTarget = ref<HTMLElement>();
let fullscreenTargetObserver: globalThis.MutationObserver | undefined;
let pageContainerEffectsActive = false;
const route = useRoute();
const router = useRouter();
const slots = useSlots();
const emits = defineEmits<{
  (event: "fullscreen-change", enabled: boolean): void;
}>();
const isSecondaryPage = inject("app-page-fullscreen-available", ref(false));

const props = defineProps<{
  title: string;
  description?: string;
  variant?: "framed" | "plain";
  hideTitle?: boolean;
  backFallbackPath?: string;
}>();

// 主菜单入口页以列表/工作区内容为主，标题由导航和页面内容承载；
// 隐藏路由或带父级面包屑的页面属于详情/辅助页，保留页面标题。
const shouldShowPageTitle = computed(() => {
  const meta = route?.meta ?? {};
  const hasRouteTitle = typeof meta.title === "string";
  const isMainMenuPage =
    hasRouteTitle &&
    meta.hidden !== true &&
    !meta.breadcrumbParentPath;
  return !props.hideTitle && !isMainMenuPage;
});

const shouldShowFullscreenButton = computed(
  () => isPageFullscreenEnabled.value && isSecondaryPage.value,
);

const shouldShowBackHeader = computed(
  () =>
    route.meta.hidden === true ||
    Boolean(route.meta.breadcrumbParentPath) ||
    typeof route.query?.returnPath === "string",
);

const shouldShowPageHeader = computed(
  () =>
    shouldShowPageTitle.value ||
    Boolean(slots.actions) ||
    Boolean(slots.titleExtra) ||
    shouldShowFullscreenButton.value ||
    shouldShowBackHeader.value,
);

const fullscreenStorageKey = computed(() => {
  const fullscreenGroup = route.meta.pageFullscreenGroup;
  const storageScope =
    typeof fullscreenGroup === "string" && fullscreenGroup.trim()
      ? `group:${fullscreenGroup.trim()}`
      : String(route.name ?? route.path);
  return `${PAGE_FULLSCREEN_STORAGE_PREFIX}${storageScope}`;
});

function readPersistedFullscreen(): boolean {
  try {
    return window.sessionStorage.getItem(fullscreenStorageKey.value) === "true";
  } catch {
    return false;
  }
}

function persistFullscreen(enabled: boolean): void {
  try {
    if (enabled) {
      window.sessionStorage.setItem(fullscreenStorageKey.value, "true");
    } else {
      window.sessionStorage.removeItem(fullscreenStorageKey.value);
    }
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
  persistFullscreen(isFullscreen.value);
}

function handleBack() {
  // Keep page-specific guards (for example unsaved-form confirmation) compatible.
  const customBackButton = pageContainerRef.value?.querySelector<HTMLElement>(
    ".bq-page-return-button",
  );
  if (customBackButton) {
    customBackButton.click();
    return;
  }

  const fallbackPath =
    props.backFallbackPath ||
    String(route.meta.breadcrumbParentPath || route.meta.activeMenu || "/");
  replaceToReturn(router, route, fallbackPath);
}

function updateToolbarTarget() {
  fullscreenTarget.value =
    pageContainerRef.value?.querySelector<HTMLElement>(
      FULLSCREEN_TARGET_SELECTOR,
    ) ?? undefined;
  hasToolbarTarget.value = Boolean(fullscreenTarget.value);
}

function handleKeydown(event: globalThis.KeyboardEvent) {
  if (event.key === "Escape" && isFullscreen.value) {
    isFullscreen.value = false;
    persistFullscreen(false);
  }
}

function syncFullscreenLayerClass(enabled: boolean) {
  document.body.classList.toggle("bq-page-fullscreen-active", enabled);
  emits('fullscreen-change',enabled)
}

watch(isFullscreen, (enabled) => {
  if (isActive.value) syncFullscreenLayerClass(enabled);
});

function setupPageContainerEffects() {
  if (pageContainerEffectsActive) return;
  pageContainerEffectsActive = true;
  fullscreenTargetObserver?.disconnect();
  isFullscreen.value =
    shouldShowFullscreenButton.value && readPersistedFullscreen();
  syncFullscreenLayerClass(isFullscreen.value);
  void nextTick(updateToolbarTarget);
  fullscreenTargetObserver = new globalThis.MutationObserver(
    updateToolbarTarget,
  );
  if (!pageContainerRef.value) return;
  fullscreenTargetObserver.observe(pageContainerRef.value, {
    childList: true,
    subtree: true,
  });
  document.addEventListener("keydown", handleKeydown);
}

function teardownPageContainerEffects() {
  if (!pageContainerEffectsActive) return;
  pageContainerEffectsActive = false;
  fullscreenTargetObserver?.disconnect();
  fullscreenTargetObserver = undefined;
  document.removeEventListener("keydown", handleKeydown);
  syncFullscreenLayerClass(false);
}

onMounted(setupPageContainerEffects);
onActivated(() => {
  isActive.value = true;
  setupPageContainerEffects();
});
onDeactivated(() => {
  isActive.value = false;
  teardownPageContainerEffects();
});

onUpdated(updateToolbarTarget);

onBeforeUnmount(teardownPageContainerEffects);

</script>

<template>
  <section
    ref="pageContainerRef"
    class="page-container"
    :class="[
      `page-container--${variant ?? 'framed'}`,
      { 'is-page-fullscreen': isFullscreen },
      { 'has-page-back': shouldShowBackHeader },
    ]"
  >
    <header v-if="shouldShowPageHeader" class="page-container__header">
      <div class="page-container__title-group">
        <el-page-header
          class="page-container__back-header"
          @back="handleBack"
        >
          <template #content>
            <h1 class="bq-page-title">{{ title }}</h1>
          </template>
        </el-page-header>
        <h1 v-if="shouldShowPageTitle" class="bq-page-title">{{ title }}</h1>
        <slot name="titleExtra" />
        <p v-if="SHOW_PAGE_DESCRIPTION && description" class="bq-page-desc">
          {{ description }}
        </p>
      </div>
      <div class="page-container__actions">
        <slot name="actions" />
        <el-button
          v-if="shouldShowFullscreenButton && !hasToolbarTarget"
          class="page-container__fullscreen-button"
          :class="{ 'is-fullscreen-active': isFullscreen }"
          circle
          :aria-label="isFullscreen ? '退出全屏' : '全屏'"
          :title="isFullscreen ? '退出全屏' : '全屏'"
          :type="isFullscreen ? 'primary' : 'default'"
          :icon="isFullscreen ? Close : FullScreen"
          @click="toggleFullscreen"
        />
      </div>
    </header>
    <Teleport
      v-if="isActive && shouldShowFullscreenButton && hasToolbarTarget"
      :to="fullscreenTarget"
    >
      <el-button
        class="page-container__fullscreen-button"
        :class="{ 'is-fullscreen-active': isFullscreen }"
        circle
        :aria-label="isFullscreen ? '退出全屏' : '全屏'"
        :title="isFullscreen ? '退出全屏' : '全屏'"
        :type="isFullscreen ? 'primary' : 'default'"
        :icon="isFullscreen ? Close : FullScreen"
        @click="toggleFullscreen"
      />
    </Teleport>
    <div class="page-container__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.page-container {
  box-sizing: border-box;
  min-height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height) - 40px
  );
  margin: 0;
}

.page-container.is-page-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  margin: 0;
  padding: 24px 32px;
  overflow: auto;
  background: var(--bq-color-surface, #ffffff);
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.page-container.is-page-fullscreen .page-container__body {
  flex: 1;
  min-height: 0;
}

.page-container.is-page-fullscreen .page-container__header {
  position: sticky;
  top: -24px;
  z-index: 1;
  margin: -24px -32px var(--bq-space-section);
  padding: 20px 32px;
  background: var(--bq-color-surface, #ffffff);
  border-bottom: 1px solid var(--bq-color-border-subtle, #e5e7eb);
}

.page-container--framed {
  padding: var(--bq-space-page-y) var(--bq-space-page-x) 0;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  box-shadow: var(--bq-shadow-page);
}

.page-container--plain {
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.page-container__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--bq-space-section);
  margin-bottom: 10px;
}

.page-container__title-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  min-width: 0;
}

.page-container__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

.page-container__back-header {
  display: none;
}

/* Secondary pages use Element Plus page-header for a consistent back action. */
:global(.page-container.has-page-back .page-container__header) {
  padding-left: 0;
}

:global(.page-container.has-page-back .page-container__back-header) {
  display: flex;
}

:global(.page-container.has-page-back .page-container__title-group > .bq-page-title) {
  display: none;
}

:global(.page-container__back-header .el-page-header__left),
:global(.page-container__back-header .el-page-header__icon),
:global(.page-container__back-header .el-page-header__title) {
  color: var(--el-color-primary, #2563eb);
}

:global(.page-container__back-header .el-page-header__left) {
  margin-right: 20px;
}

:global(.page-container.has-page-back .page-container__back-header .el-page-header__title) {
  font-size: 16px;
}

:global(.page-container__back-header .el-page-header__left:hover),
:global(.page-container__back-header .el-page-header__left:hover .el-page-header__icon),
:global(.page-container__back-header .el-page-header__left:hover .el-page-header__title) {
  color: var(--el-color-primary-light-3, #60a5fa);
}

.page-container__actions > :global(.bq-page-return-button) {
  display: none;
}

.page-container__fullscreen-button {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  flex: 0 0 28px !important;
  --el-button-text-color: #909399;
  --el-button-border-color: #dcdfe6;
  --el-button-hover-text-color: #409eff;
  --el-button-hover-border-color: #b3d8ff;
  --el-button-hover-bg-color: #ecf5ff;
}

.page-container__fullscreen-button.is-fullscreen-active {
  --el-button-text-color: #ffffff;
  --el-button-bg-color: var(--bq-color-primary-blue, #2f6fe8);
  --el-button-border-color: var(--bq-color-primary-blue, #2f6fe8);
  --el-button-hover-text-color: #ffffff;
  --el-button-hover-bg-color: var(--bq-color-primary-blue-hover, #245fc4);
  --el-button-hover-border-color: var(--bq-color-primary-blue-hover, #245fc4);
  --el-button-active-text-color: #ffffff;
  --el-button-active-bg-color: var(--bq-color-primary-blue-active, #1d5bb8);
  --el-button-active-border-color: var(--bq-color-primary-blue-active, #1d5bb8);
}

:global(.page-container__fullscreen-button.is-fullscreen-active:hover),
:global(.page-container__fullscreen-button.is-fullscreen-active:hover span),
:global(.page-container__fullscreen-button.is-fullscreen-active:hover .el-icon) {
  color: #ffffff;
}

:global(
  .page-container__fullscreen-target .page-container__fullscreen-button,
  .page-container__body .base-toolbar__extra .page-container__fullscreen-button
) {
  order: -1;
}

.page-container__body {
  display: grid;
  gap: var(--bq-space-section);
  min-width: 0;
}

/* Element Plus teleports select/date poppers to body; keep them above the page fullscreen layer. */
:global(body.bq-page-fullscreen-active .el-popper) {
  z-index: 4000 !important;
}
</style>
