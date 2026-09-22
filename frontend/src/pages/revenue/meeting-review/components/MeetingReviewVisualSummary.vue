<template>
  <section class="meeting-visual-summary card-block">
    <div class="visual-head">
      <div>
        <div class="block-title">收益分析摘要</div>
        <div class="visual-subtitle">
          {{ primaryVersionLabel }} · {{ activeYearLabel }}
        </div>
      </div>
      <div class="visual-controls">
        <el-radio-group
          v-if="yearOptions.length > 1"
          v-model="activeYearIndex"
          size="small"
          @change="queueChartRender"
        >
          <el-radio-button
            v-for="item in yearOptions"
            :key="`visual_year_${item.value}`"
            :label="item.value"
          >
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div v-if="loading" class="visual-state">收益指标加载中</div>
    <template v-else>
      <div class="metric-grid">
        <div
          v-for="metric in metricCards"
          :key="`metric_${metric.id}`"
          class="metric-card"
        >
          <span class="metric-label">{{ metric.label }}</span>
          <strong>{{ metric.text }}</strong>
          <em :class="metric.deltaClass">{{ metric.deltaText }}</em>
        </div>
      </div>

      <div class="chart-grid">
        <div class="chart-panel">
          <div ref="amountCompareChartRef" class="chart-box" />
        </div>
        <div class="chart-panel">
          <div ref="rateCompareChartRef" class="chart-box" />
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 与 S8 主表对比数据口径一致，沿用历史 any 结构 */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import * as echarts from "echarts";

const METRIC_DEFS = Object.freeze([
  { id: "margin", label: "边际贡献" },
  { id: "margin_rate", label: "边际贡献率" },
  { id: "op_profit", label: "营业利润" },
  { id: "op_rate", label: "营业利润率" },
  { id: "material", label: "材料成本" },
  { id: "fixed_total", label: "固定费用" },
]);

const AMOUNT_COMPARE_METRIC_IDS = Object.freeze(["margin", "op_profit"]);
const RATE_COMPARE_METRIC_IDS = Object.freeze(["margin_rate", "op_rate"]);

const SOURCE_LABELS: Record<string, string> = Object.freeze({
  brand: "二级公司提报",
  finance: "集团财务测算",
  business: "业务经理填报",
  dept: "集团部室意见",
  calc: "现场测算值",
  history: "历史阀点",
  competitor: "竞品/其他项目",
  baseline: "基准候选值",
  candidate: "候选值",
});

const COMPARE_COLORS: Record<string, string> = Object.freeze({
  margin: "#0071e3",
  op_profit: "#0f766e",
  margin_rate: "#0071e3",
  op_rate: "#0f766e",
});

interface VersionItem {
  key: string;
  label: string;
  dot?: string;
  group?: string;
  sourceKey?: string;
  sourceLabel?: string;
}

interface MetricCard {
  id: string;
  label: string;
  text: string;
  deltaText: string;
  deltaClass: string;
}

const props = withDefaults(
  defineProps<{
    versions?: Array<Record<string, any>>;
    chartVersions?: Array<Record<string, any>>;
    subjects?: Array<Record<string, any>>;
    dimensions?: { years?: string[]; trims?: string[] };
    selectedYearIndexes?: number[];
    defaultTrimIndex?: number;
    primaryVersionKey?: string;
    loading?: boolean;
    getVersionValue: (
      itemOrId: any,
      versionKey: any,
      trimIndex: any,
      yearIndex: any,
    ) => number | null;
    formatNumber: (value: any, item?: any) => string;
  }>(),
  {
    versions: () => [],
    chartVersions: () => [],
    subjects: () => [],
    dimensions: () => ({ years: [], trims: [] }),
    selectedYearIndexes: () => [],
    defaultTrimIndex: 0,
    primaryVersionKey: "finance",
    loading: false,
  },
);

const activeYearIndex = ref<number | null>(null);
const amountCompareChartRef = ref<HTMLElement | null>(null);
const rateCompareChartRef = ref<HTMLElement | null>(null);
let amountCompareChart: echarts.ECharts | null = null;
let rateCompareChart: echarts.ECharts | null = null;
let chartRenderTimer: number | null = null;

function safeText(value: unknown, fallback = ""): string {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function resolveVersionSourceKey(version: Record<string, any> = {}): string {
  const key = safeText(version.sourceKey || version.dataSourceKey);
  if (key) return key;
  const dot = safeText(version.dot);
  if (dot) return dot;
  const group = safeText(version.group);
  if (group) return group;
  return safeText(version.key);
}

function resolveVersionSourceLabel(version: Record<string, any> = {}): string {
  const explicit = safeText(version.sourceLabel || version.dataSourceLabel);
  if (explicit) return explicit;
  const sourceKey = resolveVersionSourceKey(version);
  return (
    SOURCE_LABELS[sourceKey] ||
    safeText(version.group) ||
    safeText(version.label, sourceKey)
  );
}

function normalizeVersions(versions: Array<Record<string, any>> = []): VersionItem[] {
  return versions
    .map((item) => ({
      key: safeText(item?.key),
      label: safeText(item?.label, item?.key),
      dot: safeText(item?.dot),
      group: safeText(item?.group),
      sourceKey: resolveVersionSourceKey(item),
      sourceLabel: resolveVersionSourceLabel(item),
    }))
    .filter((item) => item.key);
}

const yearOptions = computed(() => {
  const years = Array.isArray(props.dimensions?.years) ? props.dimensions.years : [];
  const indexes =
    Array.isArray(props.selectedYearIndexes) && props.selectedYearIndexes.length
      ? props.selectedYearIndexes
      : years.map((_item, index) => index);
  return indexes
    .filter((index) => Number.isInteger(Number(index)))
    .map((index) => ({
      value: Number(index),
      label: safeText(years[Number(index)], `年份${Number(index) + 1}`),
    }));
});

const resolvedYearIndex = computed(() => {
  const active = Number(activeYearIndex.value);
  if (yearOptions.value.some((item) => item.value === active)) return active;
  return yearOptions.value.length ? yearOptions.value[0].value : 0;
});

const activeYearLabel = computed(() => {
  const hit = yearOptions.value.find((item) => item.value === resolvedYearIndex.value);
  return hit ? hit.label : "当前年份";
});

const availableVersions = computed(() => normalizeVersions(props.versions));

const displayVersions = computed(() => {
  const versions = normalizeVersions(props.chartVersions);
  return versions.length ? versions : availableVersions.value;
});

const primaryVersionOptions = computed(() =>
  availableVersions.value.length ? availableVersions.value : displayVersions.value,
);

const primaryVersion = computed(() => {
  const expected = safeText(props.primaryVersionKey, "finance");
  return (
    primaryVersionOptions.value.find((item) => item.key === expected) ||
    primaryVersionOptions.value.find((item) => item.key === "finance") ||
    primaryVersionOptions.value[0] || { key: expected, label: expected }
  );
});

const primaryVersionLabel = computed(() => primaryVersion.value.label || "当前版本");

const subjectLookup = computed(() => {
  const lookup: Record<string, { group: Record<string, any>; item: Record<string, any> }> = {};
  const push = (key: unknown, payload: { group: Record<string, any>; item: Record<string, any> }) => {
    const normalized = safeText(key);
    if (normalized && !lookup[normalized]) lookup[normalized] = payload;
  };
  (Array.isArray(props.subjects) ? props.subjects : []).forEach((group) => {
    (Array.isArray(group.items) ? group.items : []).forEach((item: Record<string, any>) => {
      const payload = { group, item };
      push(item?.id, payload);
      push(item?.templateId, payload);
      push(item?.subjectId, payload);
      push(item?.subjectCode, payload);
    });
  });
  return lookup;
});

function findSubject(metricId: string) {
  return (
    subjectLookup.value[metricId] || {
      item: { id: metricId, name: metricId },
    }
  );
}

function readMetric(metricId: string, versionKey: string) {
  const subject = findSubject(metricId);
  const item = subject.item || { id: metricId, name: metricId };
  const value = props.getVersionValue(
    item,
    versionKey,
    props.defaultTrimIndex,
    resolvedYearIndex.value,
  );
  return {
    item,
    value,
    text: value == null ? "-" : props.formatNumber(value, item),
  };
}

function formatSigned(value: number, item: Record<string, any>) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const prefix = num > 0 ? "+" : "";
  return `${prefix}${props.formatNumber(num, item)}`;
}

function metricDefById(metricId: string) {
  return METRIC_DEFS.find((item) => item.id === metricId) || { id: metricId, label: metricId };
}

function formatVersionAxisLabel(version: VersionItem = { key: "", label: "" }) {
  const label = safeText(version.label, version.sourceLabel || version.key);
  return label.replace(/阀点数据$/, "阀点");
}

function formatAxisNumber(value: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function chartValue(metricId: string, versionKey: string, rateAxis = false) {
  const metric = readMetric(metricId, versionKey);
  const value = Number(metric.value);
  if (!Number.isFinite(value)) return null;
  return rateAxis ? Number((value * 100).toFixed(4)) : value;
}

function emptyChartOption(text: string): echarts.EChartsOption {
  return {
    backgroundColor: "transparent",
    xAxis: { type: "category", data: [], axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: "value", splitLine: { show: false }, axisLine: { show: false } },
    series: [],
    graphic: {
      type: "text",
      left: "center",
      top: "middle",
      style: {
        text,
        fill: "#a8a29e",
        fontSize: 12,
        fontWeight: 600,
      },
    },
  };
}

function buildGroupedMetricChartOption({
  metricIds,
  emptyText,
  rateAxis = false,
  yAxisName = "",
}: {
  metricIds: readonly string[];
  emptyText: string;
  rateAxis?: boolean;
  yAxisName?: string;
}): echarts.EChartsOption {
  const versions = displayVersions.value;
  const metrics = metricIds.map((metricId) => metricDefById(metricId));
  if (!versions.length) return emptyChartOption(emptyText);
  const seriesData = metrics.map((metric) =>
    versions.map((version) => chartValue(metric.id, version.key, rateAxis)),
  );
  const hasValue = seriesData.some((values) =>
    values.some((value) => Number.isFinite(value as number)),
  );
  if (!hasValue) return emptyChartOption(emptyText);
  return {
    backgroundColor: "transparent",
    legend: {
      top: 0,
      right: 0,
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: "#57534e", fontSize: 11, fontWeight: 700 },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params) ? params : [params];
        const item = rows[0] as { dataIndex?: number; seriesIndex?: number; marker?: string; seriesName?: string };
        if (!item) return "";
        const version = versions[item.dataIndex ?? 0] || { key: "", label: "" };
        const metricRows = rows.map((row) => {
          const r = row as { dataIndex?: number; seriesIndex?: number; marker?: string; seriesName?: string };
          const metric =
            metrics[r.seriesIndex ?? 0] || metricDefById(String(r.seriesName || ""));
          const metricValue = readMetric(metric.id, version.key);
          return `${r.marker || ""}${metric.label}：${metricValue.text}`;
        });
        return [
          formatVersionAxisLabel(version),
          `年份：${activeYearLabel.value}`,
          ...metricRows,
        ].join("<br/>");
      },
    },
    grid: { top: 34, left: 64, right: 14, bottom: versions.length > 4 ? 52 : 36 },
    xAxis: {
      type: "category",
      data: versions.map((version) => formatVersionAxisLabel(version)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#d6d3d1" } },
      axisLabel: {
        color: "#57534e",
        fontSize: 11,
        fontWeight: 700,
        interval: 0,
        rotate: versions.length > 4 ? 18 : 0,
      },
    },
    yAxis: {
      type: "value",
      name: yAxisName,
      nameTextStyle: { color: "#78716c", fontSize: 11, fontWeight: 700 },
      splitLine: { lineStyle: { color: "#ece9e4" } },
      axisLabel: {
        color: "#78716c",
        fontSize: 11,
        formatter: (value: number) =>
          rateAxis ? `${value}%` : formatAxisNumber(value),
      },
    },
    series: metrics.map((metric, index) => ({
      name: metric.label,
      type: "bar",
      barMaxWidth: 24,
      data: seriesData[index],
      itemStyle: {
        color: COMPARE_COLORS[metric.id] || "#0071e3",
        borderRadius: [4, 4, 0, 0],
      },
    })),
  };
}

const metricCards = computed<MetricCard[]>(() =>
  METRIC_DEFS.map((def) => {
    const current = readMetric(def.id, primaryVersion.value.key);
    const base =
      primaryVersion.value.key === "brand" ? null : readMetric(def.id, "brand");
    const delta =
      current.value != null && base && base.value != null
        ? current.value - base.value
        : null;
    return {
      ...def,
      text: current.text,
      deltaText:
        delta == null
          ? "基准差 -"
          : `基准差 ${formatSigned(delta, current.item)}`,
      deltaClass: delta == null ? "muted" : delta >= 0 ? "up" : "down",
    };
  }),
);

const amountCompareChartOption = computed(() =>
  buildGroupedMetricChartOption({
    metricIds: AMOUNT_COMPARE_METRIC_IDS,
    emptyText: "当前暂无边际贡献/营业利润数据",
    yAxisName: "元",
  }),
);

const rateCompareChartOption = computed(() =>
  buildGroupedMetricChartOption({
    metricIds: RATE_COMPARE_METRIC_IDS,
    emptyText: "当前暂无边际贡献率/营业利润率数据",
    rateAxis: true,
    yAxisName: "%",
  }),
);

function syncActiveYear() {
  const active = Number(activeYearIndex.value);
  if (yearOptions.value.some((item) => item.value === active)) return;
  activeYearIndex.value = yearOptions.value.length ? yearOptions.value[0].value : 0;
}

function resizeCharts() {
  amountCompareChart?.resize();
  rateCompareChart?.resize();
}

function renderCharts() {
  if (props.loading) return;
  nextTick(() => {
    if (!amountCompareChart || !rateCompareChart) {
      initCharts();
    }
    amountCompareChart?.setOption(amountCompareChartOption.value, true);
    rateCompareChart?.setOption(rateCompareChartOption.value, true);
    resizeCharts();
  });
}

function queueChartRender() {
  if (chartRenderTimer) window.clearTimeout(chartRenderTimer);
  chartRenderTimer = window.setTimeout(() => {
    chartRenderTimer = null;
    renderCharts();
  }, 0);
}

function initCharts() {
  nextTick(() => {
    if (amountCompareChartRef.value && !amountCompareChart) {
      amountCompareChart = echarts.init(amountCompareChartRef.value);
    }
    if (rateCompareChartRef.value && !rateCompareChart) {
      rateCompareChart = echarts.init(rateCompareChartRef.value);
    }
    renderCharts();
  });
}

watch(
  () => props.selectedYearIndexes,
  () => {
    syncActiveYear();
    queueChartRender();
  },
  { deep: true },
);

watch(
  () => props.subjects,
  () => queueChartRender(),
  { deep: true },
);

watch(
  () => props.versions,
  () => queueChartRender(),
  { deep: true },
);

watch(
  () => props.chartVersions,
  () => queueChartRender(),
  { deep: true },
);

watch(
  () => props.primaryVersionKey,
  () => queueChartRender(),
);

watch(
  () => props.loading,
  (value) => {
    if (!value) queueChartRender();
  },
);

watch(activeYearIndex, () => queueChartRender());

watch([amountCompareChartOption, rateCompareChartOption], () => {
  if (!props.loading) queueChartRender();
});

onMounted(() => {
  syncActiveYear();
  initCharts();
  window.addEventListener("resize", resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCharts);
  if (chartRenderTimer) {
    window.clearTimeout(chartRenderTimer);
    chartRenderTimer = null;
  }
  amountCompareChart?.dispose();
  rateCompareChart?.dispose();
  amountCompareChart = null;
  rateCompareChart = null;
});
</script>

<style lang="scss" scoped>
.meeting-visual-summary {
  display: grid;
  gap: 14px;
}

.visual-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.visual-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.visual-subtitle {
  margin-top: 4px;
  color: #78716c;
  font-size: 12px;
  font-weight: 600;
}

.visual-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 168px;
  border: 1px dashed var(--g-line);
  border-radius: var(--g-radius-sm);
  color: #78716c;
  background: #fafaf9;
  font-size: 13px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  border: 1px solid var(--g-line);
  border-radius: var(--g-radius-sm);
  background: #fff;
  min-height: 82px;
  padding: 10px 12px;
  text-align: left;
}

.metric-label {
  display: block;
  color: #78716c;
  font-size: 12px;
  font-weight: 700;
}

.metric-card strong {
  display: block;
  margin-top: 8px;
  color: #1c1917;
  font-size: 18px;
  line-height: 22px;
  font-weight: 800;
  word-break: break-all;
}

.metric-card em {
  display: block;
  margin-top: 8px;
  color: #78716c;
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
}

.metric-card em.up {
  color: #0f766e;
}

.metric-card em.down {
  color: #dc2626;
}

.metric-card em.muted {
  color: #a8a29e;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.chart-panel {
  min-width: 0;
  border: 1px solid var(--g-line);
  border-radius: var(--g-radius-sm);
  background: #fff;
  padding: 12px 12px 8px;
}

.chart-box {
  width: 100%;
  height: 220px;
}

:deep(.el-radio-button__inner) {
  height: 28px;
  line-height: 26px;
  padding: 0 12px;
  font-size: 11px;
}

@media (max-width: 1280px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .chart-grid {
    grid-template-columns: 1fr;
  }

  .visual-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .visual-controls {
    justify-content: flex-start;
  }
}
</style>
