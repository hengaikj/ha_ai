<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  onUpdated,
  ref,
} from "vue";
import { RefreshRight, Search } from "@element-plus/icons-vue";
import { resolveQueryFormColumns } from "@/utils/responsive-query-layout";

const props = withDefaults(
  defineProps<{
    searchText?: string;
    resetText?: string;
    loading?: boolean;
    defaultExpanded?: boolean;
    searchPermission?: string | string[];
    resetPermission?: string | string[];
    togglePermission?: string | string[];
  }>(),
  {
    searchText: "查询",
    resetText: "重置",
    loading: false,
    defaultExpanded: false,
    searchPermission: undefined,
    resetPermission: undefined,
    togglePermission: undefined,
  },
);

const emit = defineEmits<{
  search: [];
  reset: [];
}>();

const rootRef = ref<HTMLElement | null>(null);

let resizeObserver: ResizeObserver | null = null;

const isExpanded = ref(props.defaultExpanded);
const formItemCount = ref(0);
const queryFormColumns = ref<1 | 2 | 3>(3);
const hasExpandableItems = computed(() => formItemCount.value > 3);

function syncFormItemCount() {
  const container = rootRef.value?.querySelector(".base-search-form__content");
  if (!container) {
    return;
  }

  const items = Array.from(container.querySelectorAll(".el-form-item"));
  formItemCount.value = items.length;

  if (!hasExpandableItems.value) {
    isExpanded.value = props.defaultExpanded;
  }
}

function syncLayoutState() {
  if (rootRef.value) {
    queryFormColumns.value = resolveQueryFormColumns(
      rootRef.value.getBoundingClientRect().width,
    );
    rootRef.value.style.setProperty(
      "--base-search-form-columns",
      String(queryFormColumns.value),
    );
  }
  syncFormItemCount();
}

function scheduleSyncLayoutState() {
  void nextTick(syncLayoutState);
}

function setupResizeObserver() {
  resizeObserver?.disconnect();
  scheduleSyncLayoutState();

  const ResizeObserverConstructor = globalThis.ResizeObserver;
  if (rootRef.value && ResizeObserverConstructor) {
    resizeObserver = new ResizeObserverConstructor(() => {
      scheduleSyncLayoutState();
    });
    resizeObserver.observe(rootRef.value);
  }
}

function teardownResizeObserver() {
  resizeObserver?.disconnect();
  resizeObserver = null;
}

onMounted(setupResizeObserver);
onActivated(setupResizeObserver);
onDeactivated(teardownResizeObserver);

onUpdated(() => {
  scheduleSyncLayoutState();
});

onBeforeUnmount(teardownResizeObserver);
</script>

<template>
  <section
    ref="rootRef"
    class="base-search-form"
    :class="{
      'is-collapsed': hasExpandableItems && !isExpanded,
      'is-single-column': queryFormColumns === 1,
    }"
  >
    <div class="base-search-form__content">
      <slot />
    </div>
    <div class="base-search-form__actions">
      <PermissionButton
        v-if="hasExpandableItems"
        class="base-search-form__toggle"
        link
        :permission="togglePermission"
        @click="isExpanded = !isExpanded"
      >
        {{ isExpanded ? "收起" : "展开" }}
      </PermissionButton>
      <slot name="actions">
        <PermissionButton
          :permission="searchPermission"
          type="primary"
          :icon="Search"
          :loading="loading"
          @click="emit('search')"
        >
          {{ searchText }}
        </PermissionButton>
        <PermissionButton
          :permission="resetPermission"
          :icon="RefreshRight"
          :disabled="loading"
          @click="emit('reset')"
        >
          {{ resetText }}
        </PermissionButton>
      </slot>
    </div>
  </section>
</template>

<style scoped>
.base-search-form {
  --base-search-form-label-gap: var(--bq-space-md);
  --base-search-form-columns: 3;
  display: flex;
  justify-content: space-between;
}

.base-search-form.is-collapsed
  .base-search-form__content
  :deep(.el-form-item:nth-child(n + 4)) {
  display: none;
}

.base-search-form__content {
  width: 100%;
  min-width: 0;
  padding-right: 100px;
}

.base-search-form__content :deep(.el-form) {
  display: grid;
  grid-template-columns: repeat(
    var(--base-search-form-columns),
    minmax(0, 1fr)
  );
  row-gap: 16px;
  column-gap: 24px;
}

.base-search-form__content :deep(.el-form-item) {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: var(--base-search-form-label-gap);
  align-items: center;
  width: 100%;
  margin-right: 0;
  margin-bottom: 0;
}

.base-search-form__content :deep(.el-form-item__label) {
  width: auto;
  padding-right: 0;
  justify-content: flex-start;
  white-space: nowrap;
}

.base-search-form__content :deep(.el-form-item__content) {
  min-width: 0;
  width: 100%;
}

.base-search-form__content :deep(.el-input),
.base-search-form__content :deep(.el-select),
.base-search-form__content :deep(.el-date-editor) {
  width: 100%;
}

.base-search-form__actions {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 8px;
  white-space: nowrap;
}

.base-search-form__toggle {
  position: absolute;
  top: 0;
  left: -44px;
}

.base-search-form.is-single-column {
  flex-direction: column;
  gap: 16px;
}

.base-search-form.is-single-column .base-search-form__content {
  padding-right: 0;
}

.base-search-form.is-single-column .base-search-form__actions {
  width: 100%;
  flex-wrap: wrap;
}

.base-search-form.is-single-column .base-search-form__toggle {
  position: static;
}
</style>
