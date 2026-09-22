<script setup lang="ts">
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BasePageHeader from "@/components/base/BasePageHeader.vue";

defineProps<{ title: string }>();
</script>

<template>
  <section class="ai-platform-page bq-management-page">
    <BasePageHeader :title="title" />
    <BaseEmpty
      title="接口契约待接入"
      description="页面入口已就绪，待平台管理接口完成响应解码后展示真实数据。"
    />
  </section>
</template>

<style scoped>
.ai-platform-page {
  min-height: 100%;
  padding: 0 24px 24px;
  background: var(--bq-color-surface);
}
</style>
