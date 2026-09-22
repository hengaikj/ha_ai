<script setup lang="ts">
type SelectOption = {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
};

withDefaults(
  defineProps<{
    modelValue: string | number | boolean | null;
    options: SelectOption[];
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
  }>(),
  {
    placeholder: "请选择",
    clearable: true,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | number | boolean | null];
  change: [value: string | number | boolean | null];
}>();

function handleUpdate(value: string | number | boolean | null) {
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <el-select
    :model-value="modelValue"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    class="base-select"
    @update:model-value="handleUpdate"
  >
    <el-option
      v-for="option in options"
      :key="String(option.value)"
      :label="option.label"
      :value="option.value"
      :disabled="option.disabled"
    />
  </el-select>
</template>

<style scoped>
.base-select {
  width: 100%;
}
</style>
