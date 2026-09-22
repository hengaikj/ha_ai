<script setup lang="ts">
import { computed, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import type { SchemaFormField } from "@/types/schema-components";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    modelValue: Record<string, unknown>;
    fields: SchemaFormField[];
    columns?: 1 | 2 | 3;
    labelWidth?: string | number;
    labelPosition?: "left" | "right" | "top";
    disabled?: boolean;
  }>(),
  {
    columns: 2,
    labelWidth: "96px",
    labelPosition: "right",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: Record<string, unknown>];
  change: [prop: string, value: unknown, model: Record<string, unknown>];
}>();

const formRef = ref<FormInstance>();

const visibleFields = computed(() =>
  props.fields.filter((field) => !field.hidden),
);
const formRules = computed<FormRules>(() =>
  props.fields.reduce<FormRules>((rules, field) => {
    const fieldRules = [
      ...(field.required
        ? [
            {
              required: true,
              message: field.placeholder ?? `请填写${field.label}`,
              trigger:
                field.component === "input" || field.component === "textarea"
                  ? "blur"
                  : "change",
            },
          ]
        : []),
      ...(Array.isArray(field.rules)
        ? field.rules
        : field.rules
          ? [field.rules]
          : []),
    ];

    if (fieldRules.length > 0) {
      rules[field.prop] = fieldRules;
    }
    return rules;
  }, {}),
);

const formStyle = computed(() => ({
  "--schema-form-columns": String(props.columns),
}));
const getFieldSpan = (field: SchemaFormField) =>
  Math.min(field.span ?? 1, props.columns);

const updateField = (field: SchemaFormField, value: unknown) => {
  const nextModel = {
    ...props.modelValue,
    [field.prop]: value,
  };
  emit("update:modelValue", nextModel);
  emit("change", field.prop, value, nextModel);
};

const readStringValue = (value: unknown) =>
  value as string | number | undefined;
const readSelectValue = (value: unknown) =>
  value as string | number | boolean | undefined;
const readCheckboxValue = (value: unknown) =>
  Array.isArray(value) ? (value as Array<string | number>) : [];
const readSwitchValue = (value: unknown) => Boolean(value);
const readNumberValue = (value: unknown) => value as number | undefined;

defineExpose({
  clearValidate: (props?: string | string[]) =>
    formRef.value?.clearValidate(props),
  resetFields: () => formRef.value?.resetFields(),
  validate: () => formRef.value?.validate(),
});
</script>

<template>
  <el-form
    ref="formRef"
    v-bind="$attrs"
    :model="modelValue"
    :rules="formRules"
    :disabled="disabled"
    :label-width="labelWidth"
    :label-position="labelPosition"
    class="schema-form"
    :style="formStyle"
  >
    <div class="schema-form__grid">
      <el-form-item
        v-for="field in visibleFields"
        :key="field.prop"
        :label="field.label"
        :prop="field.prop"
        class="schema-form__item"
        :class="`schema-form__item--span-${getFieldSpan(field)}`"
      >
        <slot
          :name="`field-${field.prop}`"
          :field="field"
          :value="modelValue[field.prop]"
          :update="(value: unknown) => updateField(field, value)"
        >
          <el-input
            v-if="field.component === 'input'"
            :model-value="readStringValue(modelValue[field.prop])"
            :clearable="field.clearable ?? true"
            :disabled="field.disabled"
            :placeholder="field.placeholder ?? `请输入${field.label}`"
            @update:model-value="(value: unknown) => updateField(field, value)"
          />
          <el-input
            v-else-if="field.component === 'textarea'"
            :model-value="readStringValue(modelValue[field.prop])"
            :clearable="field.clearable ?? true"
            :disabled="field.disabled"
            :placeholder="field.placeholder ?? `请输入${field.label}`"
            :rows="field.rows ?? 3"
            type="textarea"
            @update:model-value="(value: unknown) => updateField(field, value)"
          />
          <el-input-number
            v-else-if="field.component === 'input-number'"
            :model-value="readNumberValue(modelValue[field.prop])"
            :disabled="field.disabled"
            :min="field.min"
            :max="field.max"
            :precision="field.precision"
            controls-position="right"
            @update:model-value="(value: unknown) => updateField(field, value)"
          />
          <el-select
            v-else-if="field.component === 'select'"
            :model-value="readSelectValue(modelValue[field.prop])"
            :clearable="field.clearable ?? true"
            :disabled="field.disabled"
            :placeholder="field.placeholder ?? `请选择${field.label}`"
            @update:model-value="(value: unknown) => updateField(field, value)"
          >
            <el-option
              v-for="option in field.options ?? []"
              :key="String(option.value)"
              :disabled="option.disabled"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-radio-group
            v-else-if="field.component === 'radio'"
            :model-value="readSelectValue(modelValue[field.prop])"
            :disabled="field.disabled"
            @update:model-value="(value: unknown) => updateField(field, value)"
          >
            <el-radio
              v-for="option in field.options ?? []"
              :key="String(option.value)"
              :value="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </el-radio>
          </el-radio-group>
          <el-checkbox-group
            v-else-if="field.component === 'checkbox'"
            :model-value="readCheckboxValue(modelValue[field.prop])"
            :disabled="field.disabled"
            @update:model-value="(value: unknown) => updateField(field, value)"
          >
            <el-checkbox
              v-for="option in field.options ?? []"
              :key="String(option.value)"
              :value="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </el-checkbox>
          </el-checkbox-group>
          <el-date-picker
            v-else-if="field.component === 'date'"
            :model-value="readStringValue(modelValue[field.prop])"
            :clearable="field.clearable ?? true"
            :disabled="field.disabled"
            :placeholder="field.placeholder ?? `请选择${field.label}`"
            type="date"
            value-format="YYYY-MM-DD"
            @update:model-value="(value: unknown) => updateField(field, value)"
          />
          <el-switch
            v-else-if="field.component === 'switch'"
            :model-value="readSwitchValue(modelValue[field.prop])"
            :disabled="field.disabled"
            @change="(value: unknown) => updateField(field, value)"
          />
        </slot>
        <p v-if="field.help" class="schema-form__help">{{ field.help }}</p>
      </el-form-item>
    </div>
  </el-form>
</template>

<style scoped>
.schema-form {
  min-width: 0;
}

.schema-form__grid {
  display: grid;
  grid-template-columns: repeat(var(--schema-form-columns), minmax(0, 1fr));
  gap: 2px 20px;
}

.schema-form__item {
  min-width: 0;
}

.schema-form__item--span-2 {
  grid-column: span 2;
}

.schema-form__item--span-3 {
  grid-column: span 3;
}

.schema-form__item :deep(.el-select),
.schema-form__item :deep(.el-date-editor),
.schema-form__item :deep(.el-input-number) {
  width: 100%;
}

.schema-form__help {
  width: 100%;
  margin: 4px 0 0;
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

@media (max-width: 900px) {
  .schema-form__grid {
    grid-template-columns: 1fr;
  }

  .schema-form__item {
    grid-column: span 1;
  }

  .schema-form__item--span-2,
  .schema-form__item--span-3 {
    grid-column: span 1;
  }
}
</style>
