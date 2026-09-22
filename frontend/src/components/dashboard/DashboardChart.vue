<script setup lang="ts">
import * as echarts from "echarts";
import type { ECharts, EChartsOption } from "echarts";
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from "vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import type {
  DashboardDistributionItem,
  DashboardTrendPoint,
} from "@/types/dashboard";

const props = defineProps<{
  kind: "distribution" | "trend";
  data: DashboardDistributionItem[] | DashboardTrendPoint[];
}>();

const chartRef = ref<HTMLElement>();
const hasData = computed(() => props.data.some((item) => item.value > 0));
let chart: ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;
let active = true;

function distributionOption(data: DashboardDistributionItem[]): EChartsOption {
  return {
    animationDuration: 300,
    color: ["#4e8ffd"],
    grid: { top: 8, right: 24, bottom: 24, left: 88 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: { type: "value", minInterval: 1 },
    yAxis: {
      type: "category",
      data: data.map((item) => item.label),
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 18,
        data: data.map((item) => item.value),
        itemStyle: { borderRadius: [0, 3, 3, 0] },
      },
    ],
  };
}

function trendOption(data: DashboardTrendPoint[]): EChartsOption {
  const dates = [...new Set(data.map((item) => item.date))].sort();
  const series = [...new Set(data.map((item) => item.seriesCode))].map(
    (seriesCode) => {
      const current = data.filter((item) => item.seriesCode === seriesCode);
      return {
        name: current[0]?.seriesName ?? seriesCode,
        type: "line" as const,
        smooth: true,
        symbolSize: 6,
        data: dates.map(
          (date) => current.find((item) => item.date === date)?.value ?? 0,
        ),
      };
    },
  );
  return {
    animationDuration: 300,
    color: ["#4e8ffd", "#7ace87", "#ffb156", "#e55353"],
    grid: { top: 36, right: 20, bottom: 28, left: 48 },
    legend: { top: 0, right: 0 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", boundaryGap: false, data: dates },
    yAxis: { type: "value", minInterval: 1 },
    series,
  };
}

function disposeChart() {
  resizeObserver?.disconnect();
  resizeObserver = null;
  chart?.dispose();
  chart = null;
}

async function renderChart() {
  if (!active) return;
  if (!hasData.value) {
    disposeChart();
    return;
  }
  await nextTick();
  if (!chartRef.value) return;
  chart ??= echarts.init(chartRef.value);
  chart.setOption(
    props.kind === "distribution"
      ? distributionOption(props.data as DashboardDistributionItem[])
      : trendOption(props.data as DashboardTrendPoint[]),
    true,
  );
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(() => chart?.resize());
    resizeObserver.observe(chartRef.value);
  }
}

watch(() => [props.kind, props.data] as const, renderChart, {
  deep: true,
  immediate: true,
});
onActivated(() => {
  active = true;
  void renderChart();
});
onDeactivated(() => {
  active = false;
  resizeObserver?.disconnect();
  resizeObserver = null;
});
onBeforeUnmount(disposeChart);
</script>

<template>
  <div v-if="hasData" ref="chartRef" class="dashboard-chart" />
  <BaseEmpty
    v-else
    title="暂无统计数据"
    description="当前时间范围内没有可展示的图表数据。"
  />
</template>

<style scoped>
.dashboard-chart {
  width: 100%;
  min-height: 240px;
}
</style>
