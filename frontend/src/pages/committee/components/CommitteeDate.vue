<script setup lang="ts">
import { computed } from "vue";
import { formatDate, formatDateTime } from "@/utils/formatters";

const props = withDefaults(
  defineProps<{
    value: string | number | Date | null | undefined;
    /** 会议时间等需要展示到具体时分的字段传 true */
    withTime?: boolean;
    /** 审批时间、提交时间等需要展示到具体秒的字段传 true */
    withSeconds?: boolean;
  }>(),
  { withTime: false, withSeconds: false },
);

const displayValue = computed(() => {
  if (props.withSeconds) return formatDateTime(props.value);
  if (!props.withTime) return formatDate(props.value);
  const formatted = formatDateTime(props.value);
  // 去掉秒，仅展示 yyyy-MM-dd HH:mm
  return formatted === "--" ? formatted : formatted.replace(/:\d{2}$/, "");
});
</script>

<template>
  <span class="committee-date">{{ displayValue }}</span>
</template>

<style scoped>
.committee-date {
  color: inherit;
  font-variant-numeric: tabular-nums;
}
</style>
