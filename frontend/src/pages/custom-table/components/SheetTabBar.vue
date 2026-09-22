<script setup lang="ts">
import { CopyDocument, Delete, EditPen, Plus } from "@element-plus/icons-vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BasePromptDialog from "@/components/base/BasePromptDialog.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { useBasePromptDialog } from "@/composables/useBasePromptDialog";
import type { TableSheetSchema } from "@/types/custom-table";
const props = defineProps<{
  sheets: TableSheetSchema[];
  activeIndex: number;
  readonly?: boolean;
}>();
const emit = defineEmits<{
  "update:activeIndex": [value: number];
  addSheet: [];
  deleteSheet: [index: number];
  renameSheet: [index: number, name: string];
  duplicateSheet: [index: number, name: string];
}>();
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const { promptState, openPrompt, resolvePrompt, rejectPrompt } =
  useBasePromptDialog();
async function renameSheet() {
  const currentName = props.sheets[props.activeIndex]?.name;
  if (!currentName) return;
  try {
    const name = await openPrompt({
      title: "重命名工作表",
      label: "工作表名称",
      initialValue: currentName,
      confirmText: "保存",
      validator: (value) =>
        props.sheets.some(
          (sheet, index) => index !== props.activeIndex && sheet.name === value,
        )
          ? "工作表名称不能重复"
          : true,
    });
    emit("renameSheet", props.activeIndex, name);
  } catch {
    return;
  }
}
function duplicateSheet() {
  const currentName = props.sheets[props.activeIndex]?.name;
  if (!currentName) return;
  const names = new Set(props.sheets.map((sheet) => sheet.name));
  let name = `${currentName}_副本`;
  let sequence = 2;
  while (names.has(name)) name = `${currentName}_副本${sequence++}`;
  emit("duplicateSheet", props.activeIndex, name);
}
async function deleteSheet() {
  if (props.sheets.length <= 1) return;
  try {
    await openConfirm({
      title: "删除工作表",
      message: `确认删除“${props.sheets[props.activeIndex]?.name}”吗？至少保留一个工作表。`,
      type: "danger",
      confirmText: "删除",
    });
    emit("deleteSheet", props.activeIndex);
  } catch {
    return;
  }
}
</script>
<template>
  <div class="sheet-tab-bar">
    <button
      v-for="(sheet, index) in sheets"
      :key="sheet.name"
      type="button"
      :class="{ active: index === activeIndex }"
      @click="emit('update:activeIndex', index)"
    >
      {{ sheet.name }}</button
    ><el-tooltip content="新增工作表"
      ><el-button
        :icon="Plus"
        text
        circle
        :disabled="readonly"
        @click="emit('addSheet')" /></el-tooltip
    ><el-tooltip content="重命名工作表"
      ><el-button
        :icon="EditPen"
        text
        circle
        :disabled="readonly"
        @click="renameSheet" /></el-tooltip
    ><el-tooltip content="复制工作表"
      ><el-button
        :icon="CopyDocument"
        text
        circle
        :disabled="readonly"
        @click="duplicateSheet" /></el-tooltip
    ><el-tooltip content="删除工作表"
      ><el-button
        data-test="delete-sheet"
        :icon="Delete"
        text
        circle
        :disabled="readonly || sheets.length <= 1"
        @click="deleteSheet" /></el-tooltip
    ><BaseConfirm
      v-model="confirmState.visible"
      v-bind="confirmState"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
    <BasePromptDialog
      v-model="promptState.visible"
      v-model:value="promptState.value"
      :title="promptState.title"
      :label="promptState.label"
      :placeholder="promptState.placeholder"
      :input-type="promptState.inputType"
      :confirm-text="promptState.confirmText"
      :cancel-text="promptState.cancelText"
      :error="promptState.error"
      :loading="promptState.loading"
      :required="promptState.required"
      @confirm="resolvePrompt"
      @cancel="rejectPrompt"
    />
  </div>
</template>
<style scoped>
.sheet-tab-bar {
  height: 38px;
  display: flex;
  align-items: flex-end;
  padding: 0 8px;
  gap: 2px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-fill-color-light);
}
.sheet-tab-bar > button {
  height: 32px;
  min-width: 88px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-bottom: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.sheet-tab-bar > button.active {
  border-color: var(--el-border-color);
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-weight: 600;
}
</style>
