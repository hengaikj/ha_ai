<script setup lang="ts">
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import DashboardChart from "@/components/dashboard/DashboardChart.vue";
import type { DashboardOverview } from "@/types/dashboard";

defineProps<{
  title: string;
  loading?: boolean;
  overview?: DashboardOverview | null;
  error?: { code: string; message: string; traceId?: string } | null;
}>();

defineEmits<{ retry: [] }>();
</script>

<template>
  <section class="dashboard-module">
    <header class="dashboard-module__header">
      <h2>{{ title }}</h2>
      <time v-if="overview?.updatedAt">
        更新于 <BaseDateTime :value="overview.updatedAt" />
      </time>
    </header>

    <div v-if="loading" class="dashboard-module__state">
      <el-skeleton :rows="5" animated />
    </div>

    <div v-else-if="error" class="dashboard-module__state">
      <TraceErrorAlert
        :code="error.code"
        :message="error.message"
        :trace-id="error.traceId"
      />
      <el-button class="dashboard-module__retry" @click="$emit('retry')">
        重试
      </el-button>
    </div>

    <template v-else-if="overview">
      <div v-if="overview.summary.length" class="dashboard-module__metrics">
        <component
          :is="metric.target ? 'router-link' : 'div'"
          v-for="metric in overview.summary"
          :key="metric.code"
          class="dashboard-module__metric"
          :class="{ 'dashboard-module__metric--link': metric.target }"
          :to="metric.target || undefined"
        >
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value.toLocaleString("zh-CN") }}</strong>
        </component>
      </div>

      <div
        v-if="overview.statusDistribution.length || overview.trend.length"
        class="dashboard-module__charts"
      >
        <div v-if="overview.statusDistribution.length">
          <h3>状态分布</h3>
          <DashboardChart
            kind="distribution"
            :data="overview.statusDistribution"
          />
        </div>
        <div v-if="overview.trend.length">
          <h3>变化趋势</h3>
          <DashboardChart kind="trend" :data="overview.trend" />
        </div>
      </div>

      <BaseEmpty
        v-if="
          !overview.summary.length &&
          !overview.statusDistribution.length &&
          !overview.trend.length
        "
        title="暂无统计数据"
        description="当前时间范围内没有可展示的数据。"
      />
    </template>
  </section>
</template>

<style scoped>
.dashboard-module {
  min-width: 0;
  min-height: 220px;
  padding: 18px 20px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 6px;
}

.dashboard-module__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.dashboard-module__header h2,
.dashboard-module__charts h3 {
  margin: 0;
  color: var(--bq-color-text);
  font-size: 17px;
  letter-spacing: 0;
}

.dashboard-module__header time {
  color: var(--bq-color-text-muted);
  font-size: 12px;
}

.dashboard-module__state {
  min-height: 160px;
  padding-top: 18px;
}

.dashboard-module__retry {
  margin-top: 12px;
}

.dashboard-module__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1px;
  margin-top: 16px;
  overflow: hidden;
  background: var(--bq-color-border-subtle);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 4px;
}

.dashboard-module__metric {
  display: flex;
  min-height: 78px;
  flex-direction: column;
  justify-content: center;
  padding: 12px 16px;
  color: var(--bq-color-text-secondary);
  text-decoration: none;
  background: var(--bq-color-surface);
}

.dashboard-module__metric strong {
  margin-top: 6px;
  color: var(--bq-color-text);
  font-size: 24px;
  line-height: 1;
  letter-spacing: 0;
}

.dashboard-module__metric--link:hover {
  background: var(--bq-color-primary-soft);
}

.dashboard-module__charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  margin-top: 20px;
}

.dashboard-module__charts h3 {
  margin-bottom: 12px;
  font-size: 14px;
}

@media (max-width: 900px) {
  .dashboard-module__charts {
    grid-template-columns: 1fr;
  }
}
</style>
