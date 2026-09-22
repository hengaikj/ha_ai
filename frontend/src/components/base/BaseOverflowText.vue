<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: string | number | null | undefined;
    emptyText?: string;
    width?: string;
  }>(),
  {
    emptyText: "--",
    width: "180px",
  },
);

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined || props.value === "") {
    return props.emptyText;
  }
  return String(props.value);
});
</script>

<template>
  <el-tooltip :content="displayValue" placement="top" :disabled="!displayValue">
    <span class="base-overflow-text" :style="{ maxWidth: width }">
      {{ displayValue }}
    </span>
  </el-tooltip>
</template>

<style scoped>
.base-overflow-text {
  display: inline-block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
</style>
