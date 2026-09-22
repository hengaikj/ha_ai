<script setup lang="ts">
import { computed, ref } from "vue";
import { Refresh } from "@element-plus/icons-vue";
import PageContainer from "@/components/layout/PageContainer.vue";

const frameKey = ref(0);
const loading = ref(true);
const failed = ref(false);
const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
const druidUrl = computed(() => `${apiBaseUrl}/druid/login.html`);

function reloadFrame() {
  loading.value = true;
  failed.value = false;
  frameKey.value += 1;
}
</script>

<template>
  <PageContainer title="数据监控" description="查看数据库连接池和 SQL 执行状态">
    <template #actions>
      <el-button :icon="Refresh" :loading="loading" @click="reloadFrame"
        >刷新</el-button
      >
    </template>

    <div v-loading="loading" class="druid-frame-wrap">
      <el-alert
        v-if="failed"
        title="数据监控页面加载失败，请确认后端已启用 Druid 监控入口。"
        type="error"
        show-icon
        :closable="false"
      />
      <iframe
        :key="frameKey"
        :src="druidUrl"
        title="Druid 数据监控"
        class="druid-frame"
        @load="loading = false"
        @error="
          failed = true;
          loading = false;
        "
      />
    </div>
  </PageContainer>
</template>

<style scoped>
.druid-frame-wrap {
  position: relative;
  min-height: 560px;
  height: calc(100vh - 180px);
  border: 1px solid var(--bq-color-border-subtle);
  overflow: hidden;
}

.druid-frame-wrap .el-alert {
  position: absolute;
  z-index: 1;
  inset: 12px 12px auto;
}

.druid-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--bq-color-surface);
}
</style>
