<script setup lang="ts">
import { computed } from "vue";
import type {
  TableCellBindingType,
  TableCellSchema,
  TableValueType,
} from "@/types/custom-table";

const props = defineProps<{
  modelValue: TableCellSchema;
  providerFields: Array<{
    key: string;
    label: string;
    valueType: TableValueType;
  }>;
  formulas: Array<{ key: string; expression: string }>;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: TableCellSchema];
}>();

const draft = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

function patch(value: Partial<TableCellSchema>) {
  draft.value = {
    ...draft.value,
    ...value,
    binding: value.binding ?? { ...draft.value.binding },
    style: value.style ?? (draft.value.style ? { ...draft.value.style } : null),
  };
}

function patchBinding(type: TableCellBindingType) {
  patch({
    binding: { type, key: null },
    valueType: type === "FORMULA" ? "DECIMAL" : "TEXT",
    staticValue: type === "STATIC" ? (draft.value.staticValue ?? "") : null,
  });
}

function patchStyle(value: Record<string, unknown>) {
  patch({
    style: {
      fillColor: null,
      fontColor: null,
      bold: false,
      italic: false,
      fontSize: null,
      horizontalAlignment: null,
      verticalAlignment: null,
      wrapText: false,
      dataFormat: null,
      ...(draft.value.style ?? {}),
      ...value,
    },
  });
}
</script>

<template>
  <el-form label-width="92px" class="cell-inspector">
    <el-form-item label="绑定类型">
      <el-segmented
        :model-value="draft.binding.type"
        :options="[
          { label: '静态值', value: 'STATIC' },
          { label: '数据元', value: 'PROVIDER_FIELD' },
          { label: '公式', value: 'FORMULA' },
        ]"
        @update:model-value="patchBinding($event as TableCellBindingType)"
      />
    </el-form-item>
    <el-form-item v-if="draft.binding.type === 'STATIC'" label="单元格值">
      <el-input
        :model-value="draft.staticValue ?? ''"
        maxlength="1000"
        @update:model-value="patch({ staticValue: String($event) })"
      />
    </el-form-item>
    <el-form-item
      v-else-if="draft.binding.type === 'PROVIDER_FIELD'"
      label="数据元"
    >
      <el-select
        :model-value="draft.binding.key"
        filterable
        style="width: 100%"
        @update:model-value="
          patch({ binding: { type: 'PROVIDER_FIELD', key: String($event) } })
        "
      >
        <el-option
          v-for="field in providerFields"
          :key="field.key"
          :label="field.label"
          :value="field.key"
        />
      </el-select>
    </el-form-item>
    <el-form-item v-else label="公式">
      <el-select
        :model-value="draft.binding.key"
        filterable
        style="width: 100%"
        @update:model-value="
          patch({ binding: { type: 'FORMULA', key: String($event) } })
        "
      >
        <el-option
          v-for="formula in formulas"
          :key="formula.key"
          :label="formula.key"
          :value="formula.key"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="值类型">
      <el-select
        :model-value="draft.valueType"
        style="width: 100%"
        @update:model-value="patch({ valueType: $event as TableValueType })"
      >
        <el-option label="文本" value="TEXT" />
        <el-option label="整数" value="INTEGER" />
        <el-option label="小数" value="DECIMAL" />
        <el-option label="百分比" value="PERCENT" />
        <el-option label="日期" value="DATE" />
        <el-option label="日期时间" value="DATETIME" />
        <el-option label="布尔" value="BOOLEAN" />
      </el-select>
    </el-form-item>
    <el-form-item label="填充色">
      <el-color-picker
        :model-value="draft.style?.fillColor ?? ''"
        @update:model-value="patchStyle({ fillColor: $event || null })"
      />
    </el-form-item>
    <el-form-item label="字体色">
      <el-color-picker
        :model-value="draft.style?.fontColor ?? ''"
        @update:model-value="patchStyle({ fontColor: $event || null })"
      />
    </el-form-item>
    <el-form-item label="字号">
      <el-input-number
        :model-value="draft.style?.fontSize ?? 12"
        :min="8"
        :max="72"
        @update:model-value="patchStyle({ fontSize: $event })"
      />
    </el-form-item>
    <el-form-item label="水平对齐">
      <el-select
        data-test="horizontal-alignment"
        :model-value="draft.style?.horizontalAlignment ?? ''"
        style="width: 100%"
        @update:model-value="
          patchStyle({ horizontalAlignment: String($event) || null })
        "
      >
        <el-option label="默认" value="" />
        <el-option label="左对齐" value="left" />
        <el-option label="居中" value="center" />
        <el-option label="右对齐" value="right" />
      </el-select>
    </el-form-item>
    <el-form-item label="垂直对齐">
      <el-select
        data-test="vertical-alignment"
        :model-value="draft.style?.verticalAlignment ?? ''"
        style="width: 100%"
        @update:model-value="
          patchStyle({ verticalAlignment: String($event) || null })
        "
      >
        <el-option label="默认" value="" />
        <el-option label="顶部" value="top" />
        <el-option label="居中" value="middle" />
        <el-option label="底部" value="bottom" />
      </el-select>
    </el-form-item>
    <el-form-item label="样式">
      <el-checkbox
        :model-value="draft.style?.bold ?? false"
        @update:model-value="patchStyle({ bold: Boolean($event) })"
        >加粗</el-checkbox
      >
      <el-checkbox
        :model-value="draft.style?.italic ?? false"
        @update:model-value="patchStyle({ italic: Boolean($event) })"
        >斜体</el-checkbox
      >
      <el-checkbox
        :model-value="draft.style?.wrapText ?? false"
        @update:model-value="patchStyle({ wrapText: Boolean($event) })"
        >自动换行</el-checkbox
      >
    </el-form-item>
    <el-form-item label="格式">
      <el-input
        :model-value="draft.style?.dataFormat ?? ''"
        maxlength="64"
        placeholder="例如 yyyy-MM-dd"
        @update:model-value="patchStyle({ dataFormat: String($event) || null })"
      />
    </el-form-item>
  </el-form>
</template>
