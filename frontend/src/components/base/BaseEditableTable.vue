<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
defineOptions({
  inheritAttrs: false,
});

withDefaults(
  defineProps<{
    data: unknown[];
    rowKey?: string;
  }>(),
  {
    rowKey: "id",
  },
);

const emit = defineEmits<{
  "add-row": [];
  "remove-row": [row: unknown, index: number];
}>();
</script>

<template>
  <section class="base-editable-table">
    <div class="base-editable-table__toolbar">
      <slot name="toolbar">
        <PermissionButton type="primary" @click="emit('add-row')">新增行</PermissionButton>
      </slot>
    </div>
    <el-table v-bind="$attrs" :data="data" :row-key="rowKey" border>
      <slot />
      <el-table-column label="操作" width="100" fixed="right" align="center">
        <template #default="{ row, $index }">
          <PermissionButton link @click="emit('remove-row', row, $index)">
            删除
          </PermissionButton>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<style scoped>
.base-editable-table {
  display: grid;
  gap: 10px;
}

.base-editable-table__toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
