<script setup lang="ts">
type CheckboxOption = {
  label: string;
  value: string | number;
  disabled?: boolean;
};

withDefaults(
  defineProps<{
    modelValue: Array<string | number>;
    options: CheckboxOption[];
    border?: boolean;
    disabled?: boolean;
  }>(),
  {
    border: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: Array<string | number>];
  change: [value: Array<string | number>];
}>();

function handleUpdate(value: Array<string | number>) {
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <el-checkbox-group
    :model-value="modelValue"
    :disabled="disabled"
    class="base-checkbox-group"
    @update:model-value="handleUpdate"
  >
    <el-checkbox
      v-for="option in options"
      :key="String(option.value)"
      :value="option.value"
      :border="border"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </el-checkbox>
  </el-checkbox-group>
</template>

<style scoped>
.base-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
