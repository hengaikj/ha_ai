<script setup lang="ts">
import { CirclePlus } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import { onActivated, onDeactivated, reactive, ref, watch } from "vue";
import type { TableSheetSchema } from "@/types/custom-table";
import {
  appendBlankSheet,
  duplicateSheet,
  removeSheet,
  renameSheet,
} from "@/pages/custom-table/utils/table-sheet";

const props = defineProps<{
  modelValue: boolean;
  sheets: TableSheetSchema[];
  activeIndex: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  updateSheets: [sheets: TableSheetSchema[], activeIndex: number];
}>();
const active = ref(true);

const form = reactive({
  selectedIndex: 0,
  name: "",
});

watch(
  () => [props.modelValue, props.activeIndex, props.sheets] as const,
  () => {
    form.selectedIndex = props.activeIndex;
    form.name = props.sheets[props.activeIndex]?.name ?? "";
  },
  { immediate: true },
);

function close() {
  emit("update:modelValue", false);
}

onActivated(() => {
  active.value = true;
});
onDeactivated(() => {
  active.value = false;
  if (props.modelValue) close();
});

function applyRename() {
  try {
    emit(
      "updateSheets",
      renameSheet(props.sheets, form.selectedIndex, form.name),
      form.selectedIndex,
    );
    BaseToast.success("工作表已重命名");
  } catch (error) {
    BaseToast.error(error instanceof Error ? error.message : "重命名失败");
  }
}

function applyDuplicate() {
  try {
    const nextName = `${form.name || "Sheet"}_副本`;
    const next = duplicateSheet(props.sheets, form.selectedIndex, nextName);
    emit("updateSheets", next, form.selectedIndex + 1);
    BaseToast.success("工作表已复制");
  } catch (error) {
    BaseToast.error(error instanceof Error ? error.message : "复制失败");
  }
}

function applyAppend() {
  const next = appendBlankSheet(props.sheets);
  emit("updateSheets", next, next.length - 1);
  BaseToast.success("工作表已新增");
}

function applyRemove() {
  try {
    const next = removeSheet(props.sheets, form.selectedIndex);
    emit("updateSheets", next, Math.max(0, form.selectedIndex - 1));
    BaseToast.success("工作表已删除");
  } catch (error) {
    BaseToast.error(error instanceof Error ? error.message : "删除失败");
  }
}
</script>

<template>
  <el-dialog
    :model-value="active && modelValue"
    title="Sheet 管理"
    width="520px"
    append-to-body
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form label-width="90px">
      <el-form-item label="工作表">
        <el-select v-model="form.selectedIndex" style="width: 100%" clearable>
          <el-option
            v-for="(sheet, index) in sheets"
            :key="`${index}-${sheet.name}`"
            :label="sheet.name"
            :value="index"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="名称">
        <el-input v-model="form.name" maxlength="64" clearable />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="close">关闭</el-button>
      <el-button :icon="CirclePlus" @click="applyAppend">新增</el-button>
      <el-button @click="applyDuplicate">复制</el-button>
      <el-button type="danger" @click="applyRemove">删除</el-button>
      <el-button type="primary" @click="applyRename">保存名称</el-button>
    </template>
  </el-dialog>
</template>
