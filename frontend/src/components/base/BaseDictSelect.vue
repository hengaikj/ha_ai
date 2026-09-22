<script setup lang="ts">
type DictOption = {
  label: string;
  value: string | number;
  disabled?: boolean;
};

withDefaults(
  defineProps<{
    modelValue: string | number | null;
    dictType: string;
    options: DictOption[];
    placeholder?: string;
    clearable?: boolean;
  }>(),
  {
    placeholder: "请选择字典项",
    clearable: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | number | null];
  change: [value: string | number | null];
}>();

function handleUpdate(value: string | number | null) {
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <el-select
    :model-value="modelValue"
    :placeholder="placeholder"
    :clearable="clearable"
    class="base-dict-select"
    :data-dict-type="dictType"
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
.base-dict-select {
  width: 100%;
}
</style>
