<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
withDefaults(
  defineProps<{
    selectedCount: number;
    clearText?: string;
  }>(),
  {
    clearText: "清空选择",
  },
);

const emit = defineEmits<{
  clear: [];
}>();
</script>

<template>
  <section v-if="selectedCount > 0" class="base-batch-action-bar">
    <div class="base-batch-action-bar__summary">
      已选择 <strong>{{ selectedCount }}</strong> 项
    </div>
    <div class="base-batch-action-bar__actions">
      <slot />
      <PermissionButton text @click="emit('clear')">{{ clearText }}</PermissionButton>
    </div>
  </section>
</template>

<style scoped>
.base-batch-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--bq-space-section);
  padding: 10px 12px;
  margin-bottom: 10px;
  background: var(--bq-color-danger-soft);
  border: 1px solid color-mix(in srgb, var(--bq-color-danger), white 78%);
  border-radius: var(--bq-radius-control);
}

.base-batch-action-bar__summary {
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
}

.base-batch-action-bar__summary strong {
  color: var(--bq-color-primary);
  font-weight: 600;
}

.base-batch-action-bar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
</style>
