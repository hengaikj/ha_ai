<template>
  <el-radio-group
    v-if="visible"
    :model-value="value"
    :size="size"
    class="stage-mode-switch"
    @update:model-value="onInput"
  >
    <el-radio-button label="edit">{{ editLabel }}</el-radio-button>
    <el-radio-button label="view_submit">{{ submitLabel }}</el-radio-button>
  </el-radio-group>
</template>

<script setup lang="ts">
defineProps({
  value: { type: String, default: "edit" },
  editLabel: { type: String, default: "编辑模式" },
  submitLabel: { type: String, default: "查看提交模式" },
  visible: { type: Boolean, default: false },
  size: { type: String, default: "small" },
});

const emit = defineEmits<{
  (e: "value-update", value: string): void;
  (e: "change", value: string): void;
}>();

function onInput(mode: string): void {
  const next = String(mode || "").trim();
  if (!next) return;
  emit("value-update", next);
  emit("change", next);
}
</script>

<style scoped>
.stage-mode-switch {
  white-space: nowrap;
}
</style>
