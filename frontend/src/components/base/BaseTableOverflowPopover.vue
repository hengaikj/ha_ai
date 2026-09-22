<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref } from "vue";
import type { Placement } from "element-plus";

const props = withDefaults(
  defineProps<{
    value?: string | number | null;
    values?: Array<string | number | null | undefined>;
    label: string;
    title?: string | number | null;
    titleLabel?: string;
    emptyText?: string;
    width?: number;
    placement?: Placement;
    maxWidth?: string;
  }>(),
  {
    value: null,
    values: undefined,
    title: "",
    titleLabel: "项目代号",
    emptyText: "--",
    width: 260,
    placement: "bottom-start",
    maxWidth: "100%",
  },
);

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined || props.value === "") {
    return props.emptyText;
  }
  return String(props.value);
});

const detailValues = computed(() => {
  const sourceValues = props.values?.length
    ? props.values
    : String(props.value ?? "")
        .split(/[\r\n,，、;；]+/)
        .map((item) => item.trim());
  return sourceValues.map((item) => String(item ?? "").trim()).filter(Boolean);
});

const hasContent = computed(() => detailValues.value.length > 0);
const active = ref(true);

onActivated(() => {
  active.value = true;
});
onDeactivated(() => {
  active.value = false;
});
</script>

<template>
  <el-popover
    :disabled="!active || !hasContent"
    :visible="active ? null : false"
    trigger="hover"
    :placement="placement"
    :fallback-placements="['top-start', 'bottom-end', 'top-end']"
    :width="width"
    popper-class="base-table-overflow-popover"
  >
    <template #reference>
      <span
        class="base-table-overflow-popover__reference"
        :style="{ maxWidth }"
      >
        {{ displayValue }}
      </span>
    </template>

    <div class="base-table-overflow-popover__content">
      <div v-if="title" class="base-table-overflow-popover__title">
        <span>{{ titleLabel }}：</span>{{ title }}
      </div>
      <div class="base-table-overflow-popover__list">
        <div class="base-table-overflow-popover__list-header">
          {{ label }}
        </div>
        <div class="base-table-overflow-popover__list-body">
          <div
            v-for="item in detailValues"
            :key="item"
            class="base-table-overflow-popover__list-item"
          >
            {{ item }}
          </div>
        </div>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.base-table-overflow-popover__reference {
  display: inline-block;
  min-width: 0;
  overflow: hidden;
  color: var(--bq-color-primary);
  line-height: 20px;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.base-table-overflow-popover__content {
  max-height: min(520px, calc(100vh - 140px));
  overflow: hidden;
  color: var(--bq-color-text);
  font-size: 14px;
}

.base-table-overflow-popover__title {
  padding: 10px 12px 8px;
  color: var(--bq-color-text-secondary);
  line-height: 22px;
  word-break: break-word;
}

.base-table-overflow-popover__title span {
  color: var(--bq-color-text);
}

.base-table-overflow-popover__list {
  min-height: 0;
  margin: 8px 12px 14px;
  border: 1px solid var(--bq-color-border);
}

.base-table-overflow-popover__list-header {
  min-height: 40px;
  padding: 9px 10px;
  color: var(--bq-color-text);
  line-height: 20px;
  background: #86bef0;
}

.base-table-overflow-popover__list-body {
  max-height: min(360px, calc(100vh - 220px));
  overflow-y: auto;
}

.base-table-overflow-popover__list-item {
  min-height: 38px;
  padding: 8px 10px;
  color: var(--bq-color-text-secondary);
  line-height: 20px;
  word-break: break-word;
  background: var(--bq-color-surface);
  border-top: 1px solid var(--bq-color-border);
}

:global(.base-table-overflow-popover.el-popper) {
  padding: 0;
  border: 1px solid var(--bq-color-border);
  border-radius: 4px;
  box-shadow: var(--bq-shadow-panel);
}
</style>
