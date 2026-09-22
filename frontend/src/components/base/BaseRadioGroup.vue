<script setup lang="ts">
type RadioOption = {
  label: string;
  value: string | number | boolean;
  disabled?: boolean;
};

withDefaults(
  defineProps<{
    modelValue: string | number | boolean;
    options: RadioOption[];
    button?: boolean;
    disabled?: boolean;
  }>(),
  {
    button: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | number | boolean];
  change: [value: string | number | boolean];
}>();

function handleUpdate(value: string | number | boolean) {
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <el-radio-group
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="handleUpdate"
  >
    <template v-if="button">
      <el-radio-button
        v-for="option in options"
        :key="String(option.value)"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </el-radio-button>
    </template>
    <template v-else>
      <el-radio
        v-for="option in options"
        :key="String(option.value)"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </el-radio>
    </template>
  </el-radio-group>
</template>
