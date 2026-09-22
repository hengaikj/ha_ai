<script setup lang="ts">
import { computed } from "vue";
import type { SchemaOption } from "@/types/schema-components";

const props = withDefaults(
  defineProps<{
    value: string | number | boolean | null | undefined;
    options: SchemaOption[];
    fallback?: string;
  }>(),
  {
    fallback: "--",
  },
);

const matched = computed(() =>
  props.options.find((option) => String(option.value) === String(props.value)),
);
const tagType = computed(() => {
  const styleClass = matched.value?.styleClass || matched.value?.listClass;
  if (!styleClass || styleClass === "default") {
    return matched.value?.type;
  }
  if (
    ["primary", "success", "warning", "danger", "info"].includes(styleClass)
  ) {
    return styleClass as "primary" | "success" | "warning" | "danger" | "info";
  }
  return matched.value?.type;
});
</script>

<template>
  <el-tag
    v-if="matched"
    :class="matched.cssClass"
    :color="matched.color"
    :type="tagType"
    size="small"
  >
    {{ matched.label }}
  </el-tag>
  <span v-else class="dict-tag__fallback">{{ fallback }}</span>
</template>

<style scoped>
.dict-tag__fallback {
  color: var(--bq-color-text-secondary);
}
</style>
