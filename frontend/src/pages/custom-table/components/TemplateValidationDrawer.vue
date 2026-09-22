<script setup lang="ts">
import type { TableTemplateValidationResult } from "@/types/custom-table";

defineProps<{
  modelValue: boolean;
  result?: TableTemplateValidationResult | null;
}>();

defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="模板校验报告"
    size="420px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-empty v-if="!result" description="尚未执行校验" />
    <el-result
      v-else-if="result.valid"
      icon="success"
      title="校验通过"
      :sub-title="
        result.schemaHash ? `Schema Hash：${result.schemaHash}` : undefined
      "
    />
    <el-descriptions v-else :column="1" border>
      <el-descriptions-item label="错误码">
        {{ result.errorCode || "-" }}
      </el-descriptions-item>
      <el-descriptions-item label="字段路径">
        {{ result.fieldPath || "-" }}
      </el-descriptions-item>
      <el-descriptions-item label="错误信息">
        {{ result.message }}
      </el-descriptions-item>
      <el-descriptions-item label="Schema Hash">
        {{ result.schemaHash || "-" }}
      </el-descriptions-item>
    </el-descriptions>
  </el-drawer>
</template>
