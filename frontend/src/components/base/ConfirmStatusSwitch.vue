<script setup lang="ts">
import { ref } from "vue";
import { ElMessageBox } from "element-plus";
import { BaseToast } from "@/components/base/BaseToast";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
    confirm?: boolean;
    confirmTitle?: string;
    confirmMessage?: string | ((value: boolean) => string);
    successMessage?: string;
    errorMessage?: string;
    beforeChange?: (value: boolean) => Promise<void> | void;
  }>(),
  {
    disabled: false,
    confirm: true,
    confirmTitle: "状态变更确认",
    confirmMessage: undefined,
    successMessage: "状态已更新",
    errorMessage: "状态更新失败",
    beforeChange: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  change: [value: boolean];
  reload: [];
}>();

const loading = ref(false);

const buildConfirmMessage = (value: boolean) => {
  if (typeof props.confirmMessage === "function") {
    return props.confirmMessage(value);
  }
  if (props.confirmMessage) {
    return props.confirmMessage;
  }
  return `确认${value ? "启用" : "停用"}当前数据？`;
};

const applyChange = async (value: boolean) => {
  loading.value = true;
  try {
    await props.beforeChange?.(value);
    emit("update:modelValue", value);
    emit("change", value);
    emit("reload");
    if (props.successMessage) {
      BaseToast.success(props.successMessage);
    }
  } catch {
    if (props.errorMessage) {
      BaseToast.error(props.errorMessage);
    }
  } finally {
    loading.value = false;
  }
};

const handleChange = async (value: boolean | string | number) => {
  const nextValue = Boolean(value);
  if (props.confirm) {
    try {
      await ElMessageBox.confirm(
        buildConfirmMessage(nextValue),
        props.confirmTitle,
        {
          confirmButtonText: "确认",
          cancelButtonText: "取消",
          type: nextValue ? "success" : "warning",
        },
      );
    } catch {
      return;
    }
  }
  await applyChange(nextValue);
};
</script>

<template>
  <el-switch
    :model-value="modelValue"
    :loading="loading"
    :disabled="disabled || loading"
    @change="handleChange"
  />
</template>
