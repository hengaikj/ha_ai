<script setup lang="ts">
import { Refresh } from "@element-plus/icons-vue";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import {
  fetchBudgetDashboard,
  fetchCommitteeDashboardOverview,
  fetchCostDashboard,
  fetchSystemDashboard,
  fetchTaskDashboard,
} from "@/api/dashboard";
import { ApiBusinessError } from "@/api/http";
import DashboardModule from "@/components/dashboard/DashboardModule.vue";
import TaskDashboardModule from "@/components/dashboard/TaskDashboardModule.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useAuthStore } from "@/stores/auth";
import type {
  DashboardModuleKey,
  DashboardOverview,
  DashboardRange,
} from "@/types/dashboard";
import { resolveDashboardModules } from "@/utils/dashboard-permissions";

interface ModuleState {
  loading: boolean;
  overview: DashboardOverview | null;
  error: { code: string; message: string; traceId?: string } | null;
}

const authStore = useAuthStore();
const range = ref<DashboardRange>("30d");
const refreshing = ref(false);
const deniedModules = ref<DashboardModuleKey[]>([]);
const moduleStates = reactive<Record<DashboardModuleKey, ModuleState>>({
  task: { loading: false, overview: null, error: null },
  budget: { loading: false, overview: null, error: null },
  cost: { loading: false, overview: null, error: null },
  committee: { loading: false, overview: null, error: null },
  system: { loading: false, overview: null, error: null },
});

const moduleDefinitions = {
  task: { title: "任务中心", fetcher: fetchTaskDashboard },
  budget: { title: "预算概况", fetcher: fetchBudgetDashboard },
  cost: { title: "成本概况", fetcher: fetchCostDashboard },
  committee: {
    title: "产品委员会",
    fetcher: fetchCommitteeDashboardOverview,
  },
  system: { title: "系统概况", fetcher: fetchSystemDashboard },
} satisfies Record<
  DashboardModuleKey,
  {
    title: string;
    fetcher: (value: DashboardRange) => Promise<DashboardOverview>;
  }
>;

const rangeOptions = [
  { label: "近7天", value: "7d" },
  { label: "近30天", value: "30d" },
  { label: "近90天", value: "90d" },
];

const visibleModules = computed(() =>
  resolveDashboardModules({
    isAuthenticated: authStore.isAuthenticated,
    isSuperAdmin: authStore.isSuperAdmin,
    hasPermission: (codes) => authStore.hasPermission(codes),
  }).filter((key) => !deniedModules.value.includes(key)),
);

let taskRefreshTimer: ReturnType<typeof setInterval> | null = null;

function isForbidden(error: unknown): boolean {
  if (error instanceof ApiBusinessError) return error.code === "403";
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 403
  );
}

function normalizeError(error: unknown): ModuleState["error"] {
  if (error instanceof ApiBusinessError) {
    return { code: error.code, message: error.message, traceId: error.traceId };
  }
  if (error instanceof Error) {
    return { code: "NETWORK_ERROR", message: error.message };
  }
  return { code: "UNKNOWN_ERROR", message: "工作台模块加载失败。" };
}

function hasActiveTasks(overview: DashboardOverview | null): boolean {
  return Boolean(
    overview?.statusDistribution.some(
      (item) => ["WAITING", "RUNNING"].includes(item.code) && item.value > 0,
    ),
  );
}

function syncTaskRefreshTimer() {
  if (hasActiveTasks(moduleStates.task.overview)) {
    taskRefreshTimer ??= setInterval(() => void loadModule("task"), 30_000);
    return;
  }
  if (taskRefreshTimer) clearInterval(taskRefreshTimer);
  taskRefreshTimer = null;
}

async function loadModule(key: DashboardModuleKey) {
  const state = moduleStates[key];
  state.loading = true;
  state.error = null;
  try {
    state.overview = await moduleDefinitions[key].fetcher(range.value);
  } catch (error) {
    if (isForbidden(error)) {
      deniedModules.value = [...deniedModules.value, key];
      return;
    }
    state.error = normalizeError(error);
  } finally {
    state.loading = false;
    if (key === "task") syncTaskRefreshTimer();
  }
}

async function refreshVisibleModules() {
  if (refreshing.value) return;
  refreshing.value = true;
  try {
    await Promise.allSettled(
      visibleModules.value.map((key) => loadModule(key)),
    );
  } finally {
    refreshing.value = false;
  }
}

watch(range, refreshVisibleModules);
onMounted(refreshVisibleModules);
onBeforeUnmount(() => {
  if (taskRefreshTimer) clearInterval(taskRefreshTimer);
  taskRefreshTimer = null;
});
</script>

<template>
  <section class="dashboard-page">
    <header class="dashboard-page__header">
      <div>
        <h1 class="bq-page-title">工作台</h1>
        <p class="bq-page-desc">当前账号可访问业务的关键指标与处理进度</p>
      </div>
      <div class="dashboard-page__actions">
        <el-segmented
          v-model="range"
          data-test="range"
          :options="rangeOptions"
          aria-label="统计时间范围"
        />
        <PermissionButton
          :icon="Refresh"
          :loading="refreshing"
          title="刷新工作台"
          aria-label="刷新工作台"
          @click="refreshVisibleModules"
        />
      </div>
    </header>

    <div class="dashboard-page__modules">
      <component
        :is="key === 'task' ? TaskDashboardModule : DashboardModule"
        v-for="key in visibleModules"
        :key="key"
        :title="moduleDefinitions[key].title"
        :loading="moduleStates[key].loading"
        :overview="moduleStates[key].overview"
        :error="moduleStates[key].error"
        @retry="loadModule(key)"
      />
    </div>
  </section>
</template>

<style scoped>
.dashboard-page {
  min-width: 0;
}

.dashboard-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.dashboard-page__header :deep(.bq-page-desc) {
  margin-bottom: 0;
}

.dashboard-page__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dashboard-page__modules {
  display: grid;
  gap: 16px;
  margin-top: 18px;
}

@media (max-width: 768px) {
  .dashboard-page__header {
    flex-direction: column;
  }

  .dashboard-page__actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
