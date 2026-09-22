<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BasePageHeader from "@/components/base/BasePageHeader.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import { createProjectModelsService } from "@/api/ai/project-models";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const error = ref<{ code: string; message: string } | null>(null);
const service = createProjectModelsService();

async function load() {
  loading.value = true;
  error.value = null;
  try {
    await service.list(String(route.params.projectId));
  } catch (value) {
    const result = value as { code?: string; message?: string };
    error.value = {
      code: result.code || "REQUEST_FAILED",
      message: result.message || "项目模型权限暂时无法加载。",
    };
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="project-models-page bq-management-page">
    <BasePageHeader title="项目模型权限">
      <el-button @click="router.push('/ai/projects')">返回项目</el-button>
    </BasePageHeader>
    <p class="project-models-page__help">
      项目：{{ route.params.projectId }}。配置后将限制该项目可调用的逻辑模型。
    </p>
    <TraceErrorAlert v-if="error" :code="error.code" :message="error.message" />
    <BaseEmpty
      v-else-if="!loading"
      title="接口契约待接入"
      description="项目模型权限列表和保存接口待平台 Contract Owner 完成响应确认。"
    />
    <el-skeleton v-else :rows="4" animated />
  </section>
</template>

<style scoped>
.project-models-page {
  min-height: 100%;
  padding: 0 24px 24px;
  background: var(--bq-color-surface);
}

.project-models-page__help {
  margin: 20px 0 0;
  color: var(--bq-color-text-secondary);
  font-size: 13px;
}
</style>
