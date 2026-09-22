<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { Monitor, Odometer, PieChart, Refresh } from "@element-plus/icons-vue";
import * as echarts from "echarts";
import { fetchCacheMonitor } from "@/api/monitor";
import PageContainer from "@/components/layout/PageContainer.vue";
import type { CacheMonitorSnapshot } from "@/types/monitor";

const snapshot = ref<CacheMonitorSnapshot>({});
const loading = ref(false);
const commandChartElement = ref<globalThis.HTMLDivElement | null>(null);
const memoryChartElement = ref<globalThis.HTMLDivElement | null>(null);
let commandChart: echarts.ECharts | null = null;
let memoryChart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

const basicInfo = computed(() => {
  const info = snapshot.value.info;
  return [
    ["Redis 版本", info?.redis_version || "--"],
    [
      "运行模式",
      info?.redis_mode === "standalone"
        ? "单机"
        : info?.redis_mode === "cluster"
          ? "集群"
          : info?.redis_mode || "--",
    ],
    ["端口", info?.tcp_port ?? "--"],
    ["客户端数", info?.connected_clients ?? "--"],
    ["运行时间（天）", info?.uptime_in_days ?? "--"],
    ["使用内存", info?.used_memory_human || "--"],
    ["使用 CPU", formatNumber(info?.used_cpu_user_children)],
    ["内存配置", info?.maxmemory_human || "--"],
    ["AOF 已开启", String(info?.aof_enabled ?? "0") === "0" ? "否" : "是"],
    ["RDB 最近状态", info?.rdb_last_bgsave_status || "--"],
    ["Key 数量", snapshot.value.dbSize ?? "--"],
    [
      "网络入口 / 出口",
      `${info?.instantaneous_input_kbps ?? "--"} / ${info?.instantaneous_output_kbps ?? "--"} kB/s`,
    ],
  ];
});

function formatNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "--";
}

function renderCharts() {
  if (!commandChartElement.value || !memoryChartElement.value) return;
  commandChart ??= echarts.init(commandChartElement.value);
  memoryChart ??= echarts.init(memoryChartElement.value);
  const commandStats = snapshot.value.commandStats ?? [];
  commandChart.setOption(
    {
      tooltip: {
        trigger: "item",
        formatter: "{a} <br/>{b} : {c} ({d}%)",
      },
      series: [
        {
          name: "命令",
          type: "pie",
          roseType: "radius",
          radius: [15, 95],
          center: ["50%", "38%"],
          data: commandStats,
          animationEasing: "cubicInOut",
          animationDuration: 1000,
        },
      ],
    },
    true,
  );

  const info = snapshot.value.info;
  const usedMemory = Number.parseFloat(info?.used_memory_human || "0");
  memoryChart.setOption(
    {
      series: [
        {
          name: "峰值",
          type: "gauge",
          min: 0,
          max: 1000,
          detail: {
            formatter: info?.used_memory_human || "--",
          },
          data: [
            {
              value: Number.isFinite(usedMemory) ? usedMemory : 0,
              name: "内存消耗",
            },
          ],
        },
      ],
    },
    true,
  );
}

async function loadCacheMonitor() {
  loading.value = true;
  try {
    snapshot.value = await fetchCacheMonitor();
    await nextTick();
    renderCharts();
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    commandChart?.resize();
    memoryChart?.resize();
  });
  if (commandChartElement.value)
    resizeObserver.observe(commandChartElement.value);
  if (memoryChartElement.value)
    resizeObserver.observe(memoryChartElement.value);
  void loadCacheMonitor();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  commandChart?.dispose();
  memoryChart?.dispose();
});
</script>

<template>
  <PageContainer
    title="缓存监控"
    description="查看 Redis 运行状态、命令调用与内存使用情况"
  >
    <div v-loading="loading" class="cache-monitor">
      <section class="monitor-band monitor-band--wide">
        <header class="monitor-band__header">
          <h2>
            <el-icon><Monitor /></el-icon>基本信息
          </h2>
          <el-tooltip content="刷新缓存监控" placement="top">
            <el-button
              circle
              :icon="Refresh"
              :loading="loading"
              aria-label="刷新缓存监控"
              @click="loadCacheMonitor"
            />
          </el-tooltip>
        </header>
        <div class="cache-info-grid">
          <div
            v-for="item in basicInfo"
            :key="String(item[0])"
            class="cache-info-item"
          >
            <span>{{ item[0] }}</span>
            <strong>{{ item[1] }}</strong>
          </div>
        </div>
      </section>

      <section class="monitor-band">
        <header class="monitor-band__header">
          <h2>
            <el-icon><PieChart /></el-icon>命令统计
          </h2>
        </header>
        <div
          ref="commandChartElement"
          class="chart"
          aria-label="Redis 命令统计图"
        />
      </section>

      <section class="monitor-band">
        <header class="monitor-band__header">
          <h2>
            <el-icon><Odometer /></el-icon>内存信息
          </h2>
        </header>
        <div
          ref="memoryChartElement"
          class="chart"
          aria-label="Redis 内存使用仪表盘"
        />
      </section>
    </div>
  </PageContainer>
</template>

<style scoped>
.cache-monitor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--bq-space-section);
}

.monitor-band {
  min-width: 0;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-surface);
  overflow: hidden;
}

.monitor-band--wide {
  grid-column: 1 / -1;
}

.monitor-band__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
  background: var(--bq-color-surface);
}

.monitor-band__header h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.monitor-band__header .el-icon {
  color: var(--bq-color-text-secondary);
}

.cache-info-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.cache-info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 54px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.cache-info-item:nth-last-child(-n + 4) {
  border-bottom: 0;
}

.cache-info-item span {
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  white-space: nowrap;
}

.cache-info-item strong {
  font-size: 16px;
  font-weight: 400;
  text-align: right;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.chart {
  width: 100%;
  height: 540px;
}

@media (max-width: 1000px) {
  .cache-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cache-info-item:nth-last-child(-n + 4) {
    border-bottom: 1px solid var(--bq-color-border-subtle);
  }

  .cache-info-item:nth-last-child(-n + 2) {
    border-bottom: 0;
  }
}

@media (max-width: 760px) {
  .cache-monitor {
    grid-template-columns: 1fr;
  }

  .monitor-band--wide {
    grid-column: auto;
  }

  .chart {
    height: 440px;
  }
}
</style>
