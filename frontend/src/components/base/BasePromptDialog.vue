<script setup lang="ts">
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";

withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    label: string;
    value: string;
    placeholder?: string;
    inputType?: "text" | "textarea";
    confirmText?: string;
    cancelText?: string;
    error?: string;
    loading?: boolean;
    required?: boolean;
  }>(),
  {
    placeholder: "",
    inputType: "text",
    confirmText: "确定",
    cancelText: "取消",
    error: "",
    loading: false,
    required: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  "update:value": [value: string];
  confirm: [];
  cancel: [];
}>();

function updateVisible(value: boolean) {
  if (!value) {
    emit("cancel");
  }
  emit("update:modelValue", value);
}
</script>

<template>
  <BaseFormDialog
    :model-value="modelValue"
    :title="title"
    width="520px"
    :confirm-text="confirmText"
    :cancel-text="cancelText"
    :loading="loading"
    @update:model-value="updateVisible"
    @confirm="emit('confirm')"
  >
    <el-form label-position="top">
      <el-form-item :label="label" :error="error" :required="required">
        <el-input
          :model-value="value"
          :type="inputType"
          :rows="inputType === 'textarea' ? 4 : undefined"
          :placeholder="placeholder"
          clearable
          @update:model-value="emit('update:value', String($event))"
          @keyup.enter="inputType === 'text' && emit('confirm')"
        />
      </el-form-item>
    </el-form>
  </BaseFormDialog>
</template>
