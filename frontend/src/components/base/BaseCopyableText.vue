<script setup lang="ts">
import { computed } from "vue";
import { CopyDocument } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";

const props = withDefaults(
  defineProps<{
    value: string | number | null | undefined;
    emptyText?: string;
    copiedMessage?: string;
  }>(),
  {
    emptyText: "--",
    copiedMessage: "已复制",
  },
);

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined || props.value === "") {
    return props.emptyText;
  }
  return String(props.value);
});

async function copyValue() {
  if (displayValue.value === props.emptyText) {
    return;
  }
  await globalThis.navigator?.clipboard?.writeText(displayValue.value);
  BaseToast.success(props.copiedMessage);
}
</script>

<template>
  <span class="base-copyable-text">
    <span>{{ displayValue }}</span>
    <button
      class="base-copyable-text__button"
      type="button"
      :disabled="displayValue === emptyText"
      aria-label="复制"
      @click="copyValue"
    >
      <el-icon><CopyDocument /></el-icon>
    </button>
  </span>
</template>

<style scoped>
.base-copyable-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.base-copyable-text__button {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--bq-color-text-secondary);
  cursor: pointer;
}

.base-copyable-text__button:hover:not(:disabled) {
  color: var(--bq-color-primary);
}

.base-copyable-text__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
