<script setup lang="ts">
import {
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUpdated,
  ref,
} from "vue";

const props = withDefaults(
  defineProps<{
    pageNo: number;
    pageSize: number;
    total: number;
    pageSizes?: number[];
    layout?: string;
    pagerCount?: number;
    fixed?: boolean;
  }>(),
  {
    pageSizes: () => [10, 20, 50, 100],
    layout: "total, prev, pager, next, sizes, jumper",
    pagerCount: 7,
    fixed: false,
  },
);

const emit = defineEmits<{
  "page-change": [pageNo: number];
  "size-change": [pageSize: number];
}>();

const containerRef = ref<HTMLElement>();
const active = ref(true);

async function labelPaginationInputs() {
  await nextTick();
  containerRef.value
    ?.querySelector<HTMLElement>('[role="combobox"]')
    ?.setAttribute("aria-label", "每页显示条数");
  containerRef.value
    ?.querySelector<HTMLInputElement>(".el-pagination__editor input")
    ?.setAttribute("aria-label", "跳转页码");
}

defineExpose({
  getElement: () => containerRef.value,
});

onMounted(labelPaginationInputs);
onUpdated(labelPaginationInputs);
onActivated(() => {
  active.value = true;
});
onDeactivated(() => {
  active.value = false;
});
</script>

<template>
  <Teleport to="body" :disabled="!fixed">
    <div
      v-show="active"
      ref="containerRef"
      class="base-pagination"
      :class="{ 'is-fixed': fixed }"
    >
      <el-pagination
        background
        :layout="props.layout"
        :pager-count="props.pagerCount"
        :current-page="props.pageNo"
        :page-size="props.pageSize"
        :page-sizes="props.pageSizes"
        :total="props.total"
        @current-change="emit('page-change', $event)"
        @size-change="emit('size-change', $event)"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.base-pagination {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
  padding: 2px 0;
}

.base-pagination.is-fixed {
  position: fixed;
  right: 0;
  bottom: 0;
  left: var(--app-sidebar-width, var(--bq-sidebar-width));
  z-index: 20;
  padding: 10px var(--bq-space-page-x);
  border-top: 1px solid var(--bq-color-border-subtle);
  background: color-mix(in srgb, var(--bq-color-surface), transparent 4%);
  box-shadow: 0 -8px 20px rgba(15, 23, 42, 0.06);
}

.base-pagination :deep(.el-pagination) {
  --el-pagination-button-width: 30px;
  --el-pagination-button-height: 30px;
  --el-pagination-font-size: 14px;
  align-items: center;
  gap: 6px;
  color: var(--bq-color-text-secondary);
}

.base-pagination :deep(.btn-prev),
.base-pagination :deep(.btn-next),
.base-pagination :deep(.el-pager li) {
  min-width: 30px;
  height: 30px;
  margin: 0;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-surface);
  color: var(--bq-color-text-secondary);
  line-height: 28px;
}

.base-pagination :deep(.el-pager) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.base-pagination :deep(.el-pager li.is-active) {
  border-color: var(--bq-color-primary);
  background: var(--bq-color-primary-soft);
  color: var(--bq-color-primary);
  font-weight: 500;
}

.base-pagination :deep(.el-pager li.more) {
  border-color: transparent;
  background: transparent;
}

.base-pagination :deep(.el-select) {
  width: 96px;
}

.base-pagination :deep(.el-select__wrapper),
.base-pagination :deep(.el-input__wrapper) {
  min-height: 30px;
}

.base-pagination :deep(.el-pagination__jump) {
  margin-left: 2px;
  color: var(--bq-color-text-secondary);
}

.base-pagination :deep(.el-pagination__editor) {
  width: 64px;
}

.base-pagination :deep(.el-pagination__editor.el-input) {
  height: 30px;
}

.base-pagination.is-compact :deep(.el-pagination) {
  --el-pagination-button-width: 26px;
  --el-pagination-button-height: 28px;
  gap: 3px;
}

.base-pagination.is-compact :deep(.btn-prev),
.base-pagination.is-compact :deep(.btn-next),
.base-pagination.is-compact :deep(.el-pager li) {
  min-width: 26px;
  height: 28px;
  line-height: 26px;
}

.base-pagination.is-compact :deep(.el-pager) {
  gap: 3px;
}

@media (max-width: 768px) {
  .base-pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
