<script setup lang="ts">
import { computed } from "vue";
import { formatDateTime } from "@/utils/formatters";

const props = defineProps<{
  value: string | number | Date | null | undefined;
  emptyText?: string;
}>();

const displayValue = computed(() => {
  const value = formatDateTime(props.value);
  return value === "--" ? (props.emptyText ?? "--") : value;
});
</script>

<template>
  <span class="base-date-time">{{ displayValue }}</span>
</template>

<style scoped>
.base-date-time {
  color: var(--bq-color-text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
