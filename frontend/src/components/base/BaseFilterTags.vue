<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
type FilterTag = {
  key: string;
  label: string;
  value: string | number;
};

withDefaults(
  defineProps<{
    filters: FilterTag[];
    clearText?: string;
  }>(),
  {
    clearText: "清空筛选",
  },
);

const emit = defineEmits<{
  remove: [key: string];
  clear: [];
}>();
</script>

<template>
  <div v-if="filters.length > 0" class="base-filter-tags">
    <span class="base-filter-tags__label">当前筛选</span>
    <el-tag
      v-for="filter in filters"
      :key="filter.key"
      closable
      @close="emit('remove', filter.key)"
    >
      {{ filter.label }}：{{ filter.value }}
    </el-tag>
    <PermissionButton text @click="emit('clear')">{{ clearText }}</PermissionButton>
  </div>
</template>

<style scoped>
.base-filter-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.base-filter-tags__label {
  color: var(--bq-color-text-secondary);
  font-size: 14px;
}
</style>
