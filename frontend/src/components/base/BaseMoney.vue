<script setup lang="ts">
import { computed } from "vue";
import { formatMoney } from "@/utils/formatters";

const props = defineProps<{
  value: number | string | null | undefined;
  emptyText?: string;
}>();

const displayValue = computed(() => {
  const value = formatMoney(props.value);
  return value === "--" ? (props.emptyText ?? "--") : value;
});
const isNegative = computed(() => Number(props.value ?? 0) < 0);
</script>

<template>
  <span class="base-money" :class="{ 'base-money--negative': isNegative }">
    {{ displayValue }}
  </span>
</template>

<style scoped>
.base-money {
  display: inline-block;
  font-variant-numeric: tabular-nums;
}

.base-money--negative {
  color: var(--bq-color-danger);
}
</style>
