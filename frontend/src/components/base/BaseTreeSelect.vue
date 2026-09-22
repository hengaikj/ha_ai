<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string | number | Array<string | number> | null;
    data: object[];
    placeholder?: string;
    multiple?: boolean;
    checkStrictly?: boolean;
    clearable?: boolean;
    disabled?: boolean;
    filterable?: boolean;
    defaultExpandAll?: boolean;
    nodeKey?: string;
    props?: Record<string, string>;
  }>(),
  {
    placeholder: "请选择",
    multiple: false,
    checkStrictly: true,
    clearable: true,
    disabled: false,
    filterable: false,
    defaultExpandAll: false,
    nodeKey: "id",
    props: () => ({
      label: "label",
      value: "id",
      children: "children",
    }),
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | number | Array<string | number> | null];
  change: [value: string | number | Array<string | number> | null];
}>();

function handleUpdate(value: string | number | Array<string | number> | null) {
  emit("update:modelValue", value);
  emit("change", value);
}
</script>

<template>
  <el-tree-select
    :model-value="modelValue"
    :data="data"
    :props="props"
    :node-key="nodeKey"
    :placeholder="placeholder"
    :multiple="multiple"
    :check-strictly="checkStrictly"
    :clearable="clearable"
    :disabled="disabled"
    :filterable="filterable"
    :default-expand-all="defaultExpandAll"
    class="base-tree-select"
    @update:model-value="handleUpdate"
  />
</template>

<style scoped>
.base-tree-select {
  width: 100%;
}
</style>
