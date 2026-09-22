<script setup lang="ts">
import type { TableColumnSchema } from "@/types/custom-table";
withDefaults(
  defineProps<{ columns: TableColumnSchema[]; readonly?: boolean }>(),
  { readonly: false },
);
</script>
<template>
  <div class="canvas">
    <div class="canvas-label">GRID 画布</div>
    <el-table :data="[]" border height="100%"
      ><el-table-column
        v-for="column in columns"
        :key="column.key"
        :prop="column.key"
        :label="column.label"
        min-width="140"
        ><template #header
          ><span>{{ column.label }}</span
          ><small>{{ column.valueType }}</small></template
        ></el-table-column
      ></el-table
    ><el-empty
      v-if="!columns.length"
      class="empty"
      :description="readonly ? '当前模板暂无字段' : '从左侧选择字段以构建表格'"
      :image-size="72"
    />
  </div>
</template>
<style scoped>
.canvas {
  position: relative;
  height: 100%;
  padding: 16px;
  background: #f5f7fa;
  box-sizing: border-box;
}
.canvas-label {
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.canvas :deep(th small) {
  display: block;
  color: var(--el-text-color-secondary);
  font-weight: 400;
}
.empty {
  position: absolute;
  inset: 60px 16px 16px;
  background: var(--el-bg-color);
}
</style>
