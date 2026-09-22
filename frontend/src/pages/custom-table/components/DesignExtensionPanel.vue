<script setup lang="ts">
import { computed } from "vue";
import type {
  TableCellStyleSchema,
  TableDesignConditionalStyle,
  TableDesignRegion,
  TableDesignValidationRule,
  TableDesignVariable,
  TableTemplateExtensions,
} from "@/types/custom-table";

const props = defineProps<{
  modelValue?: TableTemplateExtensions | null;
  activeSheetName: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: TableTemplateExtensions];
}>();

const validationOperators = [
  { label: "必填", value: "REQUIRED" },
  { label: "数值范围", value: "NUMBER_RANGE" },
  { label: "文本长度", value: "TEXT_LENGTH" },
  { label: "枚举", value: "ENUM" },
  { label: "日期范围", value: "DATE_RANGE" },
] as const;

const conditionOperators = [
  { label: "等于", value: "EQUALS" },
  { label: "不等于", value: "NOT_EQUALS" },
  { label: "大于", value: "GREATER_THAN" },
  { label: "大于等于", value: "GREATER_OR_EQUAL" },
  { label: "小于", value: "LESS_THAN" },
  { label: "小于等于", value: "LESS_OR_EQUAL" },
  { label: "包含", value: "CONTAINS" },
  { label: "为空", value: "IS_EMPTY" },
  { label: "不为空", value: "IS_NOT_EMPTY" },
] as const;

const extension = computed(() => {
  const designWorkbench = props.modelValue?.designWorkbench;
  return {
    designWorkbench: {
      version: "1.0" as const,
      variables: designWorkbench?.variables ?? [],
      regions: designWorkbench?.regions ?? [],
      validationRules: designWorkbench?.validationRules ?? [],
      conditionalStyles: designWorkbench?.conditionalStyles ?? [],
    },
  };
});

function update(partial: Partial<TableTemplateExtensions["designWorkbench"]>) {
  emit("update:modelValue", {
    designWorkbench: {
      ...extension.value.designWorkbench,
      ...partial,
    },
  });
}

function appendVariable() {
  const variables: TableDesignVariable[] = [
    ...extension.value.designWorkbench.variables,
    {
      key: `var_${extension.value.designWorkbench.variables.length + 1}`,
      valueType: "TEXT",
    },
  ];
  if (variables.length <= 128) update({ variables });
}

function appendRegion() {
  const regions: TableDesignRegion[] = [
    ...extension.value.designWorkbench.regions,
    {
      key: `region_${extension.value.designWorkbench.regions.length + 1}`,
      sheetName: props.activeSheetName,
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 0,
      mode: "STATIC",
      providerFieldKey: null,
    },
  ];
  if (regions.length <= 128) update({ regions });
}

function appendValidationRule() {
  const validationRules: TableDesignValidationRule[] = [
    ...extension.value.designWorkbench.validationRules,
    {
      key: `rule_${extension.value.designWorkbench.validationRules.length + 1}`,
      sheetName: props.activeSheetName,
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 0,
      operator: "REQUIRED",
      operand: null,
      message: "必填",
    },
  ];
  if (validationRules.length <= 256) update({ validationRules });
}

function appendConditionalStyle() {
  const style: TableCellStyleSchema = {
    fillColor: "#fff7e6",
    fontColor: null,
    bold: false,
    italic: false,
    fontSize: null,
    horizontalAlignment: null,
    verticalAlignment: null,
    wrapText: false,
    dataFormat: null,
  };
  const conditionalStyles: TableDesignConditionalStyle[] = [
    ...extension.value.designWorkbench.conditionalStyles,
    {
      key: `style_${extension.value.designWorkbench.conditionalStyles.length + 1}`,
      sheetName: props.activeSheetName,
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 0,
      operator: "EQUALS",
      operand: null,
      style,
    },
  ];
  if (conditionalStyles.length <= 256) update({ conditionalStyles });
}
</script>

<template>
  <section class="extension-panel">
    <div class="panel-title">设计扩展</div>
    <p class="panel-help">
      仅支持当前协议固定字段：变量、区域、校验规则和条件样式。
    </p>
    <div class="operator-list">
      <span>校验操作符</span>
      <el-tag
        v-for="item in validationOperators"
        :key="item.value"
        size="small"
      >
        {{ item.label }}
      </el-tag>
    </div>
    <div class="operator-list">
      <span>条件操作符</span>
      <el-tag v-for="item in conditionOperators" :key="item.value" size="small">
        {{ item.label }}
      </el-tag>
    </div>
    <div class="extension-actions">
      <el-button size="small" @click="appendVariable">新增变量</el-button>
      <el-button data-test="add-region" size="small" @click="appendRegion"
        >新增区域</el-button
      >
      <el-button
        data-test="add-validation"
        size="small"
        @click="appendValidationRule"
        >新增校验</el-button
      >
      <el-button
        data-test="add-style"
        size="small"
        @click="appendConditionalStyle"
        >新增样式</el-button
      >
    </div>
    <el-descriptions :column="2" size="small" border>
      <el-descriptions-item label="变量">
        {{ extension.designWorkbench.variables.length }} / 128
      </el-descriptions-item>
      <el-descriptions-item label="区域">
        {{ extension.designWorkbench.regions.length }} / 128
      </el-descriptions-item>
      <el-descriptions-item label="校验">
        {{ extension.designWorkbench.validationRules.length }} / 256
      </el-descriptions-item>
      <el-descriptions-item label="条件样式">
        {{ extension.designWorkbench.conditionalStyles.length }} / 256
      </el-descriptions-item>
    </el-descriptions>
  </section>
</template>

<style scoped>
.extension-panel {
  display: grid;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-light);
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
}
.panel-help {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.operator-list,
.extension-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.operator-list span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
