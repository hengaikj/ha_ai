<script setup lang="ts">
defineProps<{ coordinate: string; modelValue: string; readonly?: boolean }>();
defineEmits<{ "update:modelValue": [value: string]; commit: [] }>();
</script>
<template>
  <div class="formula-bar">
    <span>{{ coordinate }}</span
    ><strong>fx</strong
    ><el-input
      :model-value="modelValue"
      :readonly="readonly"
      @update:model-value="$emit('update:modelValue', $event)"
      @keyup.enter="$emit('commit')"
    />
  </div>
</template>
<style scoped>
.formula-bar {
  height: 36px;
  display: grid;
  grid-template-columns: 64px 28px minmax(0, 1fr);
  align-items: center;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}
.formula-bar > span,
.formula-bar > strong {
  height: 100%;
  display: grid;
  place-items: center;
  border-right: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}
.formula-bar > strong {
  font-style: italic;
  color: var(--el-text-color-secondary);
}
.formula-bar :deep(.el-input__wrapper) {
  box-shadow: none;
}
</style>
