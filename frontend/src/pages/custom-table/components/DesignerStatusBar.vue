<script setup lang="ts">
defineProps<{
  selection: string;
  valueType: string;
  readonly?: boolean;
  saveStatus?: string;
}>();
</script>
<template>
  <footer class="designer-status-bar">
    <span>{{ selection }}</span
    ><span>{{ valueType }}</span
    ><span>{{ readonly ? "只读" : "可编辑" }}</span
    ><span class="save-status">{{ saveStatus }}</span>
  </footer>
</template>
<style scoped>
.designer-status-bar {
  height: 28px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.save-status {
  margin-left: auto;
}
</style>
