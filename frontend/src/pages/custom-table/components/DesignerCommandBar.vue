<script setup lang="ts">
import {
  ArrowLeft,
  Check,
  Expand,
  Fold,
  Promotion,
  View,
} from "@element-plus/icons-vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type { TableRendererType } from "@/types/custom-table";

defineProps<{
  title: string;
  status: string;
  providerLabel: string;
  renderer: TableRendererType;
  readonly?: boolean;
  inspectorCollapsed?: boolean;
  showInspectorToggle?: boolean;
}>();
const emit = defineEmits<{
  back: [];
  preview: [];
  save: [];
  publish: [];
  toggleInspector: [];
  "update:renderer": [value: TableRendererType];
}>();
</script>

<template>
  <header class="designer-command-bar">
    <div class="command-identity">
      <el-tooltip content="返回模板中心" placement="bottom">
        <el-button :icon="ArrowLeft" text circle @click="emit('back')" />
      </el-tooltip>
      <div>
        <strong>{{ title || "新建模板" }}</strong
        ><span>{{ status }} · {{ providerLabel }}</span>
      </div>
    </div>
    <el-segmented
      :model-value="renderer"
      :options="[
        { label: 'Grid', value: 'GRID' },
        { label: 'Sheet', value: 'SHEET' },
      ]"
      :disabled="readonly"
      @update:model-value="emit('update:renderer', $event as TableRendererType)"
    />
    <div class="command-actions">
      <el-button :icon="View" @click="emit('preview')">预览</el-button>
      <PermissionButton
        permission="base:cust-table:template:edit"
        :icon="Check"
        :disabled="readonly"
        data-test="save"
        @click="emit('save')"
        >保存草稿</PermissionButton
      >
      <el-tooltip
        v-if="showInspectorToggle !== false"
        :content="inspectorCollapsed ? '展开检查器' : '收起检查器'"
        placement="bottom"
      >
        <el-button
          data-test="toggle-inspector"
          :icon="inspectorCollapsed ? Expand : Fold"
          @click="emit('toggleInspector')"
        />
      </el-tooltip>
      <PermissionButton
        permission="base:cust-table:template:publish"
        type="primary"
        :icon="Promotion"
        :disabled="readonly"
        @click="emit('publish')"
        >发布</PermissionButton
      >
    </div>
  </header>
</template>

<style scoped>
.designer-command-bar {
  height: 58px;
  flex: 0 0 auto;
  padding: 0 12px;
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto minmax(300px, 1fr);
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  box-sizing: border-box;
}
.command-identity,
.command-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.command-identity div {
  display: grid;
  min-width: 0;
}
.command-identity strong,
.command-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.command-identity span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.command-actions {
  justify-content: flex-end;
}
@media (max-width: 1360px) {
  .designer-command-bar {
    height: auto;
    min-height: 96px;
    padding: 10px 12px;
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .command-actions {
    grid-column: 1 / -1;
  }
}
@media (max-width: 760px) {
  .designer-command-bar {
    height: auto;
    min-height: 104px;
    grid-template-columns: 1fr;
    padding: 10px;
  }
  .designer-command-bar > :deep(.el-segmented) {
    display: none;
  }
  .command-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
