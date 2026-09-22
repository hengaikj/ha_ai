<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
  }>(),
  {
    title: "暂无数据",
    description: "当前条件下没有可展示的数据。",
  },
);
</script>

<template>
  <div class="base-empty">
    <el-empty :description="title" />
    <p class="base-empty__desc">{{ description }}</p>
  </div>
</template>

<style scoped>
.base-empty {
  padding: 32px 16px;
  text-align: center;
}

.base-empty :deep(.el-empty) {
  --el-empty-padding: 0;
}

.base-empty :deep(.el-empty__description) {
  margin-top: 8px;
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 600;
}

.base-empty__desc {
  margin: 8px 0 0;
  color: var(--bq-color-text-muted);
  font-size: 14px;
}
</style>
