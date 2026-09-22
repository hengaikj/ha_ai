<script setup lang="ts">
import { computed } from "vue";
import { formatPercent } from "@/utils/formatters";

const props = defineProps<{
  numerator: number | string | null | undefined;
  denominator?: number | string | null;
}>();

const displayValue = computed(() =>
  formatPercent(props.numerator, props.denominator),
);
</script>

<template>
  <span class="base-percent">{{ displayValue }}</span>
</template>

<style scoped>
.base-percent {
  display: inline-block;
  font-variant-numeric: tabular-nums;
}
</style>
