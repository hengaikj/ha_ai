<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Refresh } from "@element-plus/icons-vue";
import { fetchMicroserviceHealth } from "@/api/microservice-monitor";
import { ApiBusinessError } from "@/api/http";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  MicroserviceHealthSnapshot,
  MicroserviceStatus,
} from "@/types/microservice-monitor";

const services = ref<MicroserviceHealthSnapshot[]>([]);
const loading = ref(false);
const error = ref<unknown>(null);

const upCount = computed(
  () => services.value.filter((item) => item.status === "UP").length,
);
const abnormalCount = computed(
  () => services.value.filter((item) => item.status !== "UP").length,
);
const errorInfo = computed(() => {
  if (error.value instanceof ApiBusinessError) {
    return {
      code: error.value.code,
      message: error.value.message,
      traceId: error.value.traceId,
    };
  }
  return {
    code: "FRONTEND-MONITOR-001",
    message: "服务状态加载失败，请稍后重试。",
  };
});

function statusLabel(status: MicroserviceStatus) {
  return { UP: "正常", DOWN: "不可用", UNKNOWN: "未知" }[status];
}

function statusType(status: MicroserviceStatus) {
  return { UP: "success", DOWN: "danger", UNKNOWN: "warning" }[status] as
    | "success"
    | "danger"
    | "warning";
}

async function loadServices() {
  loading.value = true;
  error.value = null;
  try {
    services.value = await fetchMicroserviceHealth();
  } catch (cause) {
    error.value = cause;
  } finally {
    loading.value = false;
  }
}

onMounted(loadServices);
</script>

<template>
  <PageContainer title="服务总览" description="查看微服务运行状态和健康检查结果">
    <template #actions>
      <PermissionButton
        permission="monitor:service:list"
        :loading="loading"
        :icon="Refresh"
        @click="loadServices"
      >
        刷新
      </PermissionButton>
    </template>

    <TraceErrorAlert v-if="error" v-bind="errorInfo" />

    <div class="service-summary" aria-label="服务状态摘要">
      <div class="summary-item">
        <span class="summary-label">服务总数</span>
        <strong>{{ services.length }}</strong>
      </div>
      <div class="summary-item summary-item--success">
        <span class="summary-label">运行正常</span>
        <strong>{{ upCount }}</strong>
      </div>
      <div class="summary-item summary-item--warning">
        <span class="summary-label">异常或未知</span>
        <strong>{{ abnormalCount }}</strong>
      </div>
    </div>

    <div v-if="!loading && !services.length && !error" class="service-empty">
      <BaseEmpty title="暂无服务状态" description="当前没有可展示的微服务健康检查结果。" />
    </div>

    <el-table v-else v-loading="loading" :data="services" row-key="serviceName">
      <el-table-column prop="displayName" label="服务名称" min-width="180" />
      <el-table-column prop="serviceName" label="服务标识" min-width="190" />
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="HTTP 状态" width="120">
        <template #default="{ row }">{{ row.httpStatus ?? "--" }}</template>
      </el-table-column>
      <el-table-column label="响应耗时" width="130">
        <template #default="{ row }">
          {{ row.responseTimeMs == null ? "--" : `${row.responseTimeMs} ms` }}
        </template>
      </el-table-column>
      <el-table-column label="检查时间" min-width="190">
        <template #default="{ row }">
          <BaseDateTime :value="row.checkedAt" />
        </template>
      </el-table-column>
      <el-table-column prop="message" label="检查结果" min-width="240" show-overflow-tooltip />
    </el-table>
  </PageContainer>
</template>

<style scoped>
.service-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--bq-space-section);
}

.summary-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bq-color-surface-muted);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-card);
}

.summary-item strong {
  font-size: 24px;
  color: var(--bq-color-text-primary);
}

.summary-label {
  color: var(--bq-color-text-secondary);
}

.summary-item--success strong {
  color: var(--el-color-success);
}

.summary-item--warning strong {
  color: var(--el-color-warning);
}

.service-empty {
  min-height: 240px;
  display: grid;
  place-items: center;
}

@media (max-width: 760px) {
  .service-summary {
    grid-template-columns: 1fr;
  }
}
</style>
