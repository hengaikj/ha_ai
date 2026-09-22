<script setup lang="ts">
type DetailItem = {
  label: string;
  value?: string | number | null;
  span?: number;
  slot?: string;
};

withDefaults(
  defineProps<{
    items: DetailItem[];
    column?: number;
    border?: boolean;
    emptyText?: string;
  }>(),
  {
    column: 2,
    border: true,
    emptyText: "--",
  },
);
</script>

<template>
  <el-descriptions :column="column" :border="border" class="base-detail">
    <el-descriptions-item
      v-for="item in items"
      :key="item.label"
      :label="item.label"
      :span="item.span"
    >
      <slot v-if="item.slot" :name="item.slot" :item="item">
        {{ item.value ?? emptyText }}
      </slot>
      <template v-else>
        {{ item.value ?? emptyText }}
      </template>
    </el-descriptions-item>
  </el-descriptions>
</template>

<style scoped>
.base-detail {
  width: 100%;
}
</style>
