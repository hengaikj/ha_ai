<script setup lang="ts">
import { WarningFilled } from "@element-plus/icons-vue";
import { BarChart, PieChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { init, use, type ECElementEvent, type EChartsType } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BaseSelect from "@/components/base/BaseSelect.vue";
import {
  buildDifferenceBarOption,
  buildDifferenceDirectionItems,
  buildDifferencePieOption,
  buildDifferenceShareItems,
  type CostAnalysisDifferenceChartItem,
  type CostAnalysisDifferenceChartMode,
  type CostAnalysisDifferenceChartTokens,
} from "@/pages/cost/analysis/utils/difference-chart";
import type {
  CostAnalysisCategoryLevel,
  CostAnalysisDifferenceDetailResult,
  CostAnalysisDifferenceDetailRow,
} from "@/types/cost-analysis";
import type { CostAnalysisDifferenceViewLevelOption } from "@/pages/cost/analysis/utils/difference-view-level";

use([
  PieChart,
  BarChart,
  TooltipComponent,
  GridComponent,
  TitleComponent,
  AriaComponent,
  CanvasRenderer,
]);

const props = withDefaults(
  defineProps<{
    result: CostAnalysisDifferenceDetailResult;
    mode: CostAnalysisDifferenceChartMode;
    activeObjectId?: string | null;
    viewLevel?: CostAnalysisCategoryLevel | null;
    viewLevelOptions?: CostAnalysisDifferenceViewLevelOption[];
  }>(),
  {
    activeObjectId: null,
    viewLevel: null,
    viewLevelOptions: () => [],
  },
);

const emit = defineEmits<{
  "update:mode": [mode: CostAnalysisDifferenceChartMode];
  "update:view-level": [level: CostAnalysisCategoryLevel];
  drill: [row: CostAnalysisDifferenceDetailRow];
  "locate-part": [row: CostAnalysisDifferenceDetailRow];
  "show-all-parts": [];
}>();

const chartContainer = ref<HTMLElement>();
const chartItems = computed(() =>
  props.mode === "SHARE"
    ? buildDifferenceShareItems(props.result)
    : buildDifferenceDirectionItems(props.result),
);
const chartHeight = computed(() => {
  if (props.mode === "SHARE") {
    return Math.max(260, Math.min(420, chartItems.value.length * 24 + 180));
  }
  // 每条数据保留稳定的纵向阅读空间，避免 38 个系统被压缩在固定高度内。
  return Math.min(1200, Math.max(240, chartItems.value.length * 28 + 48));
});
const chartTitle = computed(() =>
  props.result.context.traceType === "COST_VARIANCE" ? "超差构成" : "差异构成",
);
const directionHelpText = computed(() =>
  props.result.context.traceType === "COST_VARIANCE"
    ? "正负贡献 = 当前成本 - 目标成本。"
    : "正负贡献 = 当前对比值 - 基准值。",
);
const ariaLabel = computed(() =>
  props.mode === "SHARE"
    ? `${chartTitle.value}变动规模占比图`
    : `${chartTitle.value}正负贡献图`,
);
const modeOptions = [
  { label: "正负贡献", value: "DIRECTION" },
  { label: "占比", value: "SHARE" },
] as const;

let chart: EChartsType | null = null;
let chartDom: HTMLElement | null = null;
let resizeObserver: ResizeObserver | null = null;

function disposeChart() {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (chart) {
    chart.off("click", handleChartClick);
    chart.dispose();
    chart = null;
  }
  chartDom = null;
}

interface CssTokenSource {
  getPropertyValue(name: string): string;
}

function cssToken(style: CssTokenSource, name: string, fallback: string) {
  return style.getPropertyValue(name).trim() || fallback;
}

function readTokens(): CostAnalysisDifferenceChartTokens {
  const style = window.getComputedStyle(document.documentElement);
  return {
    primary: cssToken(style, "--bq-color-primary", "#4e8ffd"),
    orange: cssToken(style, "--bq-color-orange", "#e05b3d"),
    cyan: cssToken(style, "--bq-color-cyan", "#79c9ea"),
    success: cssToken(style, "--bq-color-success", "#7ace87"),
    warning: cssToken(style, "--bq-color-warning", "#ffb156"),
    danger: cssToken(style, "--bq-color-danger", "#e55353"),
    text: cssToken(style, "--bq-color-text", "#333333"),
    textSecondary: cssToken(style, "--bq-color-text-secondary", "#555555"),
    textMuted: cssToken(style, "--bq-color-text-muted", "#8c8c8c"),
    border: cssToken(style, "--bq-color-border-subtle", "#edf0f2"),
  };
}

function findItem(
  key: string | undefined,
): CostAnalysisDifferenceChartItem | null {
  if (!key) return null;
  return chartItems.value.find((item) => item.key === key) ?? null;
}

function handleChartClick(params: ECElementEvent) {
  const data = params.data;
  const itemKey =
    typeof data === "object" &&
    data !== null &&
    "itemKey" in data &&
    typeof data.itemKey === "string"
      ? data.itemKey
      : undefined;
  const item = findItem(itemKey);
  if (!item?.clickable) return;
  if (item.action === "SHOW_ALL_PARTS") {
    emit("show-all-parts");
    return;
  }
  if (!item.row) return;
  if (item.action === "DRILL") {
    emit("drill", item.row);
    return;
  }
  if (item.action === "LOCATE_PART") {
    emit("locate-part", item.row);
  }
}

function highlightActiveItem() {
  if (!chart) return;
  chart.dispatchAction({ type: "downplay", seriesIndex: 0 });
  const activeIndex = chartItems.value.findIndex(
    (item) => item.key === props.activeObjectId,
  );
  if (activeIndex >= 0) {
    chart.dispatchAction({
      type: "highlight",
      seriesIndex: 0,
      dataIndex: activeIndex,
    });
  }
}

function ensureChartInstance(): EChartsType | null {
  const container = chartContainer.value;
  if (!container) return null;

  if (!chart || chartDom !== container) {
    disposeChart();
    chart = init(container);
    chartDom = container;
    chart.on("click", handleChartClick);
    resizeObserver = new ResizeObserver(() => chart?.resize());
    resizeObserver.observe(container);
  }
  return chart;
}

function renderChart() {
  if (chartItems.value.length === 0) {
    disposeChart();
    return;
  }

  const currentChart = ensureChartInstance();
  if (!currentChart) return;

  const tokens = readTokens();
  const option =
    props.mode === "SHARE"
      ? buildDifferencePieOption(props.result, chartItems.value, tokens)
      : buildDifferenceBarOption(props.result, chartItems.value, tokens);
  currentChart.setOption(option, { notMerge: true });
  currentChart.resize();
  highlightActiveItem();
}

function updateMode(value: string | number | boolean) {
  if (value === "SHARE" || value === "DIRECTION") {
    emit("update:mode", value);
  }
}

function updateViewLevel(value: string | number | boolean | null) {
  if (typeof value === "number" && Number.isInteger(value)) {
    emit("update:view-level", value as CostAnalysisCategoryLevel);
  }
}

onMounted(() => {
  renderChart();
});

watch(
  () => [props.result, props.mode] as const,
  async () => {
    await nextTick();
    renderChart();
  },
);

watch(
  () => props.activeObjectId,
  () => highlightActiveItem(),
);

onBeforeUnmount(() => {
  disposeChart();
});
</script>

<template>
  <section
    class="cost-analysis-difference-chart"
    data-test="difference-chart"
    :data-mode="mode"
  >
    <header class="cost-analysis-difference-chart__header">
      <h3>{{ chartTitle }}</h3>
      <div class="cost-analysis-difference-chart__mode">
        <div
          v-if="viewLevelOptions.length > 0"
          class="cost-analysis-difference-chart__view-level"
        >
          <span class="cost-analysis-difference-chart__view-level-label">
            查看层级
          </span>
          <BaseSelect
            :model-value="viewLevel"
            :options="viewLevelOptions"
            size="small"
            class="cost-analysis-difference-chart__view-level-select"
            data-test="difference-chart-view-level"
            aria-label="查看层级"
            @update:model-value="updateViewLevel"
          />
        </div>
        <el-segmented
          :model-value="mode"
          :options="modeOptions"
          size="small"
          data-test="difference-chart-mode"
          @update:model-value="updateMode"
        />
        <el-tooltip
          placement="top"
          popper-class="cost-analysis-difference-chart__mode-tooltip"
        >
          <template #content>
            <div class="cost-analysis-difference-chart__tooltip">
              <div>{{ directionHelpText }}</div>
              <div>占比 = |正负贡献| / 全部明细 |正负贡献| 合计。</div>
            </div>
          </template>
          <el-icon
            class="bq-help-icon"
            tabindex="0"
            data-test="difference-chart-mode-tip"
            aria-label="图表指标说明"
          >
            <WarningFilled />
          </el-icon>
        </el-tooltip>
      </div>
    </header>

    <BaseEmpty
      v-if="chartItems.length === 0"
      title="当前对象没有可视化差异"
      description="当前明细的变动规模为零。"
    />
    <div
      v-else
      ref="chartContainer"
      class="cost-analysis-difference-chart__canvas"
      :style="{ height: `${chartHeight}px` }"
      :aria-label="ariaLabel"
      role="img"
      data-test="difference-chart-canvas"
    />
  </section>
</template>

<style scoped>
.cost-analysis-difference-chart {
  display: grid;
  min-width: 0;
  gap: 10px;
  padding-block: 14px;
  border-block: 1px solid var(--bq-color-divider);
}

.cost-analysis-difference-chart__header {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.cost-analysis-difference-chart__header h3 {
  margin: 0;
  font-size: 15px;
  letter-spacing: 0;
}

.cost-analysis-difference-chart__mode {
  display: inline-flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.cost-analysis-difference-chart__mode .bq-help-icon {
  font-size: 14px;
  color: var(--bq-color-icon-muted, #9aa0a6);
  cursor: help;
  outline: none;
  transition: color 0.2s ease;
}

.cost-analysis-difference-chart__mode .bq-help-icon:hover,
.cost-analysis-difference-chart__mode .bq-help-icon:focus-visible {
  color: var(--bq-color-primary, #2f6fe8);
}

.cost-analysis-difference-chart__view-level {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cost-analysis-difference-chart__view-level-label {
  color: var(--bq-color-text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.cost-analysis-difference-chart__view-level-select {
  width: 132px;
}

.cost-analysis-difference-chart__tooltip {
  display: grid;
  max-width: 360px;
  gap: 6px;
  line-height: 1.6;
}

.cost-analysis-difference-chart__canvas {
  width: 100%;
  min-width: 0;
}

@media (max-width: 640px) {
  .cost-analysis-difference-chart__header {
    align-items: stretch;
  }

  .cost-analysis-difference-chart__header :deep(.el-segmented) {
    width: 100%;
  }

  .cost-analysis-difference-chart__mode {
    width: 100%;
  }

  .cost-analysis-difference-chart__view-level {
    width: 100%;
  }

  .cost-analysis-difference-chart__view-level-select {
    flex: 1;
    width: auto;
  }
}
</style>
