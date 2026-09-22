<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import PageContainer from "@/components/layout/PageContainer.vue";

const route = useRoute();
const title = computed(() => String(route.meta.title || "功能开发中"));
</script>

<template>
  <PageContainer :title="title">
    <BaseEmpty
      title="功能开发中"
      description="旧系统该功能暂未开放，新系统按测试清单保持占位，不展示可操作业务数据。"
    />
  </PageContainer>
</template>
