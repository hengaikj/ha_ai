<script setup lang="ts">
withDefaults(
  defineProps<{
    columns?: 1 | 2 | 3;
  }>(),
  {
    columns: 2,
  },
);
</script>

<template>
  <div class="committee-form-grid" :class="`is-${columns}-columns`">
    <slot />
  </div>
</template>

<style scoped>
.committee-form-grid {
  display: grid;
  gap: 0 16px;
  min-width: 0;
}

.committee-form-grid.is-1-columns {
  grid-template-columns: minmax(0, 1fr);
}

.committee-form-grid.is-2-columns {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.committee-form-grid.is-3-columns {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.committee-form-grid :deep(.el-date-editor),
.committee-form-grid :deep(.el-select),
.committee-form-grid :deep(.el-input-number) {
  width: 100%;
}

@media (max-width: 760px) {
  .committee-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
