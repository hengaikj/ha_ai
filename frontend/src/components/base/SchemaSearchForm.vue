<script setup lang="ts">
import BaseSearchForm from "@/components/base/BaseSearchForm.vue";
import type { SchemaSearchField } from "@/types/schema-components";

defineOptions({
  inheritAttrs: false,
});

withDefaults(
  defineProps<{
    modelValue: Record<string, unknown>;
    fields: SchemaSearchField[];
    loading?: boolean;
  }>(),
  {
    loading: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: Record<string, unknown>];
  search: [];
  reset: [];
}>();

const updateField = (
  modelValue: Record<string, unknown>,
  prop: string,
  value: unknown,
) => {
  emit("update:modelValue", {
    ...modelValue,
    [prop]: value,
  });
};

const readInputValue = (value: unknown) => value as string | number | undefined;
const readSelectValue = (value: unknown) =>
  value as string | number | boolean | undefined;
const readDateValue = (value: unknown) => value as string | undefined;
const handleFieldUpdate = (
  modelValue: Record<string, unknown>,
  prop: string,
  value: unknown,
) => updateField(modelValue, prop, value);
</script>

<template>
  <BaseSearchForm
    v-bind="$attrs"
    :loading="loading"
    @reset="emit('reset')"
    @search="emit('search')"
  >
    <el-form :model="modelValue" inline>
      <el-form-item
        v-for="field in fields"
        :key="field.prop"
        :label="field.label"
      >
        <el-input
          v-if="field.component === 'input'"
          :model-value="readInputValue(modelValue[field.prop])"
          :clearable="field.clearable ?? true"
          :disabled="field.disabled"
          :placeholder="field.placeholder ?? `请输入${field.label}`"
          @update:model-value="
            (value: unknown) => handleFieldUpdate(modelValue, field.prop, value)
          "
        />
        <el-select
          v-else-if="field.component === 'select'"
          :model-value="readSelectValue(modelValue[field.prop])"
          :clearable="field.clearable ?? true"
          :disabled="field.disabled"
          :placeholder="field.placeholder ?? `请选择${field.label}`"
          @update:model-value="
            (value: unknown) => handleFieldUpdate(modelValue, field.prop, value)
          "
        >
          <el-option
            v-for="option in field.options ?? []"
            :key="String(option.value)"
            :disabled="option.disabled"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-date-picker
          v-else-if="field.component === 'date'"
          :model-value="readDateValue(modelValue[field.prop])"
          :clearable="field.clearable ?? true"
          :disabled="field.disabled"
          :placeholder="field.placeholder ?? `请选择${field.label}`"
          type="date"
          value-format="YYYY-MM-DD"
          @update:model-value="
            (value: unknown) => handleFieldUpdate(modelValue, field.prop, value)
          "
        />
      </el-form-item>
    </el-form>
  </BaseSearchForm>
</template>
