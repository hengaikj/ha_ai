<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
type TreeNode = Record<string, unknown>;

withDefaults(
  defineProps<{
    title: string;
    data: TreeNode[];
    nodeKey?: string;
    props?: Record<string, string>;
    currentKey?: string | number;
    emptyText?: string;
  }>(),
  {
    nodeKey: "id",
    props: () => ({
      label: "label",
      children: "children",
    }),
    currentKey: undefined,
    emptyText: "暂无数据",
  },
);

const emit = defineEmits<{
  "node-click": [node: TreeNode];
  refresh: [];
}>();
</script>

<template>
  <aside class="base-tree-panel">
    <header class="base-tree-panel__header">
      <h3>{{ title }}</h3>
      <slot name="actions">
        <PermissionButton text @click="emit('refresh')">刷新</PermissionButton>
      </slot>
    </header>
    <div v-if="$slots.filters" class="base-tree-panel__filters">
      <slot name="filters" />
    </div>
    <el-tree
      :data="data"
      :props="props"
      :node-key="nodeKey"
      :current-node-key="currentKey"
      :empty-text="emptyText"
      highlight-current
      default-expand-all
      @node-click="emit('node-click', $event)"
    />
  </aside>
</template>

<style scoped>
.base-tree-panel {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-surface);
}

.base-tree-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.base-tree-panel__header h3 {
  margin: 0;
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}

.base-tree-panel__filters {
  margin-bottom: 10px;
}
</style>
