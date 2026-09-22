<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Refresh } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import { fetchGovernanceOverview } from "@/api/data-governance";
import PageContainer from "@/components/layout/PageContainer.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import {
  formatGovernanceValue,
  normalizeGovernanceError,
} from "./governance-page-utils";
import type { GovernanceOverview } from "@/types/data-governance";

const router = useRouter();
const loading = ref(false);
const overview = ref<GovernanceOverview | null>(null);
const errorInfo = ref<ReturnType<typeof normalizeGovernanceError> | null>(null);
const metrics = computed(() =>
  overview.value
    ? [
        {
          key: "enabled",
          label: "启用作业",
          value: overview.value.enabledJobs,
        },
        {
          key: "pending",
          label: "待执行",
          value: overview.value.pendingBatches,
          path: "/data-governance/batches?status=PENDING",
        },
        {
          key: "running",
          label: "执行中",
          value: overview.value.runningBatches,
          path: "/data-governance/batches?status=RUNNING",
        },
        {
          key: "stale",
          label: "失联运行",
          value: overview.value.staleRunningBatches,
          risk: overview.value.staleRunningBatches > 0,
          path: "/data-governance/batches?status=RUNNING",
        },
        {
          key: "failed",
          label: "近期失败",
          value: overview.value.failedBatches,
          risk: overview.value.failedBatches > 0,
          path: "/data-governance/batches?status=FAILED",
        },
        {
          key: "quality",
          label: "近期质量失败",
          value: overview.value.failedQualityRules,
          warning: overview.value.failedQualityRules > 0,
          path: "/data-governance/batches?quality=failed",
        },
        {
          key: "published",
          label: "已发布汇总",
          value: overview.value.publishedSummaries,
          path: "/data-governance/ads-results",
        },
      ]
    : [],
);
async function load() {
  loading.value = true;
  errorInfo.value = null;
  try {
    overview.value = await fetchGovernanceOverview();
  } catch (error) {
    errorInfo.value = normalizeGovernanceError(error, "治理总览加载失败");
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <PageContainer
    class="governance-page governance-overview"
    title="治理总览"
    description="集中查看治理作业、运行批次、质量风险与结果发布状态。"
    ><template #actions
      ><el-button :icon="Refresh" :loading="loading" @click="load"
        >刷新</el-button
      ></template
    >
    <TraceErrorAlert v-if="errorInfo" v-bind="errorInfo" />
    <div v-loading="loading" class="overview-strip">
      <button
        v-for="item in metrics"
        :key="item.key"
        class="metric"
        :class="{ 'is-risk': item.risk, 'is-warning': item.warning }"
        type="button"
        :disabled="!item.path"
        @click="item.path && router.push(item.path)"
      >
        <span>{{ item.label }}</span
        ><strong>{{ formatGovernanceValue(item.value) }}</strong>
      </button>
    </div></PageContainer
  >
</template>
<style scoped>
.overview-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(110px, 1fr));
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 6px;
  overflow: hidden;
}
.metric {
  min-height: 104px;
  padding: 18px;
  text-align: left;
  border: 0;
  border-right: 1px solid var(--bq-color-divider);
  background: var(--bq-color-surface);
  color: var(--bq-color-text-secondary);
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}
.metric:not(:disabled):hover {
  background: var(--bq-color-bg-soft);
  box-shadow: inset 0 -2px 0 var(--bq-color-primary);
}
.metric:focus-visible {
  position: relative;
  z-index: 1;
  outline: 2px solid var(--bq-color-primary);
  outline-offset: -2px;
}
.metric:last-child {
  border-right: 0;
}
.metric:disabled {
  cursor: default;
}
.metric strong {
  display: block;
  margin-top: 10px;
  color: var(--bq-color-text);
  font-size: 28px;
}
.metric.is-risk strong {
  color: var(--bq-color-danger);
}
.metric.is-warning strong {
  color: var(--bq-color-warning);
}
@media (max-width: 900px) {
  .overview-strip {
    grid-template-columns: repeat(2, minmax(130px, 1fr));
  }
  .metric {
    border-bottom: 1px solid var(--bq-color-divider);
  }
}
@media (min-width: 901px) and (max-width: 1280px) {
  .overview-strip {
    grid-template-columns: repeat(4, minmax(130px, 1fr));
  }
  .metric {
    border-bottom: 1px solid var(--bq-color-divider);
  }
}
</style>
