<template>
  <div class="base-page-title">
    <div class="title">{{ title }}</div>
    <div>
      <slot />
    </div>
  </div>
</template>
<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
  }>(),
  {
    title: "标题",
  },
);
</script>
<style scoped>
.base-page-title {
  height: 60px;
  border-bottom: 1px solid var(--bq-color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  width: calc(100% + 48px);
  left: -24px;
  padding: 0 24px;
}

.base-page-title > .title {
  font-size: 18px;
  font-weight: 600;
  color: var(--bq-color-text);
}
</style>
