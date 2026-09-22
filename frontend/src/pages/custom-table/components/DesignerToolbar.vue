<script setup lang="ts">
import {
  Brush,
  CopyDocument,
  Delete,
  EditPen,
  Finished,
  FolderChecked,
  Lock,
  Plus,
  RefreshLeft,
  RefreshRight,
  Setting,
} from "@element-plus/icons-vue";
import PermissionButton from "@/components/security/PermissionButton.vue";

withDefaults(
  defineProps<{
    readonly?: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    showPersistence?: boolean;
    savePermission?: string;
    publishPermission?: string;
  }>(),
  {
    readonly: false,
    canUndo: false,
    canRedo: false,
    showPersistence: false,
    savePermission: "base:cust-table:template:edit",
    publishPermission: "base:cust-table:template:publish",
  },
);

defineEmits<{
  undo: [];
  redo: [];
  copy: [];
  paste: [];
  insertRow: [];
  insertColumn: [];
  deleteRow: [];
  deleteColumn: [];
  merge: [];
  unmerge: [];
  clear: [];
  required: [];
  format: [preset: "BOLD" | "CURRENCY" | "PERCENT"];
  openInspector: [tab: "properties" | "rules" | "permissions"];
  validate: [];
  save: [];
  publish: [];
}>();
</script>

<template>
  <div class="designer-toolbar" aria-label="设计工作台工具栏">
    <div class="toolbar-group" data-group="structure">
      <span>结构</span>
      <el-button-group>
        <el-button :icon="Plus" :disabled="readonly" @click="$emit('insertRow')"
          >插入行</el-button
        >
        <el-button
          :icon="Plus"
          :disabled="readonly"
          @click="$emit('insertColumn')"
          >插入列</el-button
        >
        <el-button
          :icon="Delete"
          :disabled="readonly"
          @click="$emit('deleteRow')"
          >删除行</el-button
        >
        <el-button
          :icon="Delete"
          :disabled="readonly"
          @click="$emit('deleteColumn')"
          >删除列</el-button
        >
      </el-button-group>
    </div>
    <div class="toolbar-group" data-group="selection">
      <span>选区</span>
      <el-button-group>
        <el-button :disabled="readonly" @click="$emit('merge')">合并</el-button>
        <el-button :disabled="readonly" @click="$emit('unmerge')"
          >拆分</el-button
        >
        <el-button :icon="Lock" :disabled="readonly" @click="$emit('required')"
          >必填</el-button
        >
        <el-button :icon="Delete" :disabled="readonly" @click="$emit('clear')"
          >清空</el-button
        >
      </el-button-group>
    </div>
    <div class="toolbar-group" data-group="edit">
      <span>编辑</span>
      <el-button-group>
        <el-tooltip content="撤销" placement="bottom">
          <el-button
            :icon="RefreshLeft"
            :disabled="readonly || !canUndo"
            title="撤销"
            @click="$emit('undo')"
          />
        </el-tooltip>
        <el-tooltip content="重做" placement="bottom">
          <el-button
            :icon="RefreshRight"
            :disabled="readonly || !canRedo"
            title="重做"
            @click="$emit('redo')"
          />
        </el-tooltip>
        <el-button
          :icon="CopyDocument"
          :disabled="readonly"
          @click="$emit('copy')"
          >复制</el-button
        >
        <el-button :icon="EditPen" :disabled="readonly" @click="$emit('paste')"
          >粘贴</el-button
        >
      </el-button-group>
    </div>
    <div class="toolbar-group" data-group="format">
      <span>格式</span>
      <el-button-group>
        <el-button
          :icon="Brush"
          :disabled="readonly"
          @click="$emit('format', 'BOLD')"
          >加粗</el-button
        >
        <el-button :disabled="readonly" @click="$emit('format', 'CURRENCY')"
          >金额</el-button
        >
        <el-button :disabled="readonly" @click="$emit('format', 'PERCENT')"
          >百分比</el-button
        >
      </el-button-group>
    </div>
    <div class="toolbar-group" data-group="configuration">
      <span>配置</span>
      <el-button-group>
        <el-button
          :icon="Setting"
          :disabled="readonly"
          @click="$emit('openInspector', 'properties')"
          >属性</el-button
        >
        <el-button :disabled="readonly" @click="$emit('openInspector', 'rules')"
          >规则</el-button
        >
        <el-button
          :disabled="readonly"
          @click="$emit('openInspector', 'permissions')"
          >权限</el-button
        >
        <el-button :icon="Finished" @click="$emit('validate')">校验</el-button>
      </el-button-group>
    </div>
    <template v-if="showPersistence">
      <PermissionButton
        :permission="savePermission"
        :icon="FolderChecked"
        :disabled="readonly"
        @click="$emit('save')"
        >保存</PermissionButton
      >
      <PermissionButton
        :permission="publishPermission"
        type="primary"
        :disabled="readonly"
        @click="$emit('publish')"
        >发布</PermissionButton
      >
    </template>
  </div>
</template>

<style scoped>
.designer-toolbar {
  display: flex;
  align-items: stretch;
  gap: 4px;
  padding: 6px 8px;
  overflow-x: auto;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.toolbar-group {
  display: grid;
  flex: 0 0 auto;
  gap: 3px;
  padding: 0 8px;
  border-right: 1px solid var(--el-border-color-lighter);
}
.toolbar-group:last-of-type {
  border-right: 0;
}
.toolbar-group > span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 16px;
}
</style>
