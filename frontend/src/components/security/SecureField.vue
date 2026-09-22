<script setup lang="ts">
import { computed } from "vue";
import type { FieldPermission } from "@/utils/permission";

const props = withDefaults(
  defineProps<{
    value: string | number | null | undefined;
    permission?: FieldPermission;
    maskedValue?: string;
    unreadableText?: string;
    tooltip?: string;
  }>(),
  {
    permission: "READABLE",
    maskedValue: "***",
    unreadableText: "--",
    tooltip: "无字段查看权限",
  },
);

const displayValue = computed(() => {
  if (props.permission === "UNREADABLE") {
    return props.unreadableText;
  }
  if (props.permission === "MASKED") {
    return props.maskedValue;
  }
  if (props.value === null || props.value === undefined || props.value === "") {
    return "--";
  }
  return String(props.value);
});
</script>

<template>
  <el-tooltip
    v-if="permission === 'UNREADABLE'"
    :content="tooltip"
    placement="top"
  >
    <span class="secure-field secure-field--unreadable">
      {{ displayValue }}
    </span>
  </el-tooltip>
  <span v-else class="secure-field" :class="`is-${permission.toLowerCase()}`">
    {{ displayValue }}
  </span>
</template>

<style scoped>
.secure-field {
  display: inline-flex;
  min-width: 24px;
  color: var(--bq-color-text);
}

.secure-field.is-masked,
.secure-field--unreadable {
  color: var(--bq-color-text-secondary);
}
</style>
