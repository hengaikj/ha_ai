<script setup lang="ts">
type TimelineItem = {
  timestamp: string;
  title: string;
  description?: string;
  type?: "primary" | "success" | "warning" | "danger" | "info";
};

defineProps<{
  items: TimelineItem[];
}>();
</script>

<template>
  <el-timeline>
    <el-timeline-item
      v-for="item in items"
      :key="`${item.timestamp}-${item.title}`"
      :timestamp="item.timestamp"
      :type="item.type"
      placement="top"
    >
      <strong>{{ item.title }}</strong>
      <p v-if="item.description" class="base-timeline__desc">
        {{ item.description }}
      </p>
    </el-timeline-item>
  </el-timeline>
</template>

<style scoped>
.base-timeline__desc {
  margin: 6px 0 0;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 20px;
}
</style>
