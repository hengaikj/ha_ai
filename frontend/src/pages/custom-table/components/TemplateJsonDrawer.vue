<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean;
  schemaJson: string;
  templateCode: string;
}>();

defineEmits<{
  "update:modelValue": [value: boolean];
}>();

function downloadJson() {
  const blob = new Blob([props.schemaJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${props.templateCode || "table-template"}-schema.json`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="Schema JSON"
    size="min(720px, 90vw)"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #default>
      <el-input :model-value="schemaJson" type="textarea" :rows="24" readonly clearable />
    </template>
    <template #footer>
      <el-button @click="downloadJson">下载 JSON</el-button>
    </template>
  </el-drawer>
</template>
