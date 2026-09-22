<script setup lang="ts">
type PageTab = {
  name: string;
  label: string;
  closable?: boolean;
};

defineProps<{
  modelValue: string;
  tabs: PageTab[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [value: string];
  close: [value: string];
}>();

function handleUpdate(value: string | number) {
  const nextValue = String(value);
  emit("update:modelValue", nextValue);
  emit("change", nextValue);
}
</script>

<template>
  <el-tabs
    :model-value="modelValue"
    type="card"
    class="base-page-tabs"
    @update:model-value="handleUpdate"
    @tab-remove="emit('close', String($event))"
  >
    <el-tab-pane
      v-for="tab in tabs"
      :key="tab.name"
      :name="tab.name"
      :label="tab.label"
      :closable="tab.closable"
    />
  </el-tabs>
</template>

<style scoped>
.base-page-tabs {
  min-width: 0;
}
</style>
