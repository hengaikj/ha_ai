<script setup lang="ts">
defineProps<{
  code: string;
  message: string;
  traceId?: string;
}>();
</script>

<template>
  <el-alert class="trace-error-alert" type="error" :closable="false" show-icon>
    <template #title>
      <span>{{ message }}</span>
    </template>
    <div class="trace-error-alert__meta">
      <span>错误码：{{ code }}</span>
      <span>追踪号：{{ traceId || "unknown" }}</span>
    </div>
  </el-alert>
</template>

<style scoped>
.trace-error-alert {
  border: 1px solid color-mix(in srgb, var(--bq-color-danger), white 72%);
}

.trace-error-alert__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--bq-color-text-secondary);
}
</style>
