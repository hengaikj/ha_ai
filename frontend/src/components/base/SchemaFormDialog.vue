<script setup lang="ts">
import { ref, watch } from "vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import SchemaForm from "@/components/base/SchemaForm.vue";
import type { SchemaFormField } from "@/types/schema-components";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    formModel: Record<string, unknown>;
    fields: SchemaFormField[];
    title: string;
    width?: string;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    columns?: 1 | 2 | 3;
    labelWidth?: string | number;
  }>(),
  {
    width: "640px",
    confirmText: "保存",
    cancelText: "取消",
    loading: false,
    columns: 2,
    labelWidth: "96px",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  "update:formModel": [value: Record<string, unknown>];
  change: [prop: string, value: unknown, model: Record<string, unknown>];
  confirm: [value: Record<string, unknown>];
  cancel: [];
}>();

const schemaFormRef = ref<InstanceType<typeof SchemaForm>>();
const currentFormModel = ref<Record<string, unknown>>(props.formModel);

watch(
  () => props.formModel,
  (value) => {
    currentFormModel.value = value;
  },
);

const handleConfirm = async () => {
  try {
    const valid = await schemaFormRef.value?.validate();
    if (!valid) {
      return;
    }
    emit("confirm", currentFormModel.value);
  } catch {
    // Element Plus has already marked invalid fields; keep the dialog open.
  }
};

const handleFormUpdate = (value: Record<string, unknown>) => {
  currentFormModel.value = value;
  emit("update:formModel", value);
};
</script>

<template>
  <BaseFormDialog
    :model-value="modelValue"
    :title="title"
    :width="width"
    :confirm-text="confirmText"
    :cancel-text="cancelText"
    :loading="loading"
    @update:model-value="(value) => emit('update:modelValue', value)"
    @cancel="emit('cancel')"
    @confirm="handleConfirm"
  >
    <SchemaForm
      ref="schemaFormRef"
      :model-value="formModel"
      :fields="fields"
      :columns="columns"
      :label-width="labelWidth"
      @update:model-value="handleFormUpdate"
      @change="(prop, value, model) => emit('change', prop, value, model)"
    />
  </BaseFormDialog>
</template>
