<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    loading: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  change: [value: boolean];
}>();

function handleChange(value: boolean | string | number) {
  const nextValue = Boolean(value);
  emit("update:modelValue", nextValue);
  emit("change", nextValue);
}
</script>

<template>
  <el-switch
    :model-value="props.modelValue"
    :loading="loading"
    :disabled="disabled || loading"
    @change="handleChange"
  />
</template>
