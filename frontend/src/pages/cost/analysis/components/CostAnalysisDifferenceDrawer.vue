<script setup lang="ts">
import {
  ArrowRight,
  Download,
  Search,
  WarningFilled,
} from "@element-plus/icons-vue";
import { computed, nextTick, ref, watch } from "vue";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import CostAnalysisAiSummary from "@/pages/cost/analysis/components/CostAnalysisAiSummary.vue";
import CostAnalysisDifferenceChart from "@/pages/cost/analysis/components/CostAnalysisDifferenceChart.vue";
import type { CostAnalysisDifferenceTraceEntry } from "@/pages/cost/analysis/composables/useCostAnalysisDifferenceTrace";
import {
  resolveDefaultDifferenceChartMode,
  type CostAnalysisDifferenceChartMode,
} from "@/pages/cost/analysis/utils/difference-chart";
import { getCostAnalysisMetricLabel } from "@/pages/cost/analysis/utils/matrix-view";
import type {
  CostAnalysisAiAnalysisResult,
  CostAnalysisDifferenceDetailResult,
  CostAnalysisDifferenceDetailRow,
  CostAnalysisDifferenceViewLevel,
  CostAnalysisPoint,
  CostAnalysisTraceError,
} from "@/types/cost-analysis";
import { normalizeCostAnalysisDimensionType } from "@/pages/cost/analysis/utils/analysis-dimension";
import {
  getCostAnalysisDifferenceViewLevelOptions,
  getDefaultCostAnalysisDifferenceViewLevel,
} from "@/pages/cost/analysis/utils/difference-view-level";
import { formatMoney, formatPercent } from "@/utils/formatters";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    loading: boolean;
    error: CostAnalysisTraceError | null;
    result: CostAnalysisDifferenceDetailResult | null;
    path: CostAnalysisDifferenceTraceEntry[];
    allPartRows?: CostAnalysisDifferenceDetailRow[] | null;
    allPartsLoading?: boolean;
    allPartsError?: CostAnalysisTraceError | null;
    aiLoading?: boolean;
    aiError?: CostAnalysisTraceError | null;
    aiResult?: CostAnalysisAiAnalysisResult | null;
    aiEnabled?: boolean;
    canExport?: boolean;
  }>(),
  {
    allPartRows: null,
    allPartsLoading: false,
    allPartsError: null,
    aiLoading: false,
    aiError: null,
    aiResult: null,
    aiEnabled: true,
    canExport: true,
  },
);

const emit = defineEmits<{
  "update:visible": [value: boolean];
  retry: [];
  drill: [row: CostAnalysisDifferenceDetailRow];
  "view-level-change": [level: CostAnalysisDifferenceViewLevel];
  back: [index: number];
  "show-all-parts": [];
  "retry-all-parts": [];
  "generate-ai": [];
  "regenerate-ai": [];
  "retry-ai": [];
  export: [];
}>();

type SummaryItemKey = "baseline" | "comparison" | "difference";

interface SummaryItem {
  key: SummaryItemKey;
  label: string;
  value: string;
}

const differenceRoot = ref<HTMLElement>();
const chartMode = ref<CostAnalysisDifferenceChartMode>("DIRECTION");
const activePartId = ref<string | null>(null);
const partSearchInput = ref("");
const partSearchKeyword = ref("");
let chartModeInitialized = false;

const isPartDetail = computed(() => props.result?.drillLevel === "PART");
const partContextKey = computed(() => {
  const result = props.result;
  if (result?.drillLevel !== "PART") return "";
  const categoryId = result.context.categoryPath.at(-1)?.categoryId ?? "";
  return `${result.snapshotId}|${categoryId}`;
});
const isResponsibilityDimension = computed(
  () =>
    normalizeCostAnalysisDimensionType(
      props.result?.context.dimensionType ??
        props.path.at(-1)?.query.dimensionType,
    ) === "RESPONSIBILITY_DEPARTMENT",
);
const dimensionObjectLabel = computed(() =>
  isResponsibilityDimension.value
    ? ({ 0: "项目", 1: "责任群组", 2: "研发专业", 3: "系统" }[
        currentViewLevel.value ?? 2
      ] ?? "研发分类")
    : "分类",
);
const currentQuery = computed(() => props.path.at(-1)?.query ?? null);
// AI 分析暂时隐藏，待后端正式能力和验收口径确定后再恢复。
const showAiSummary = computed(() => false);
const viewLevelOptions = computed(() =>
  getCostAnalysisDifferenceViewLevelOptions(
    props.result?.context.dimensionType ?? currentQuery.value?.dimensionType,
    currentQuery.value?.categoryLevel ?? null,
  ),
);
const currentViewLevel = computed(() =>
  props.result?.drillLevel === "PART"
    ? null
    : (props.result?.viewLevel ??
      (currentQuery.value
        ? getDefaultCostAnalysisDifferenceViewLevel(
            currentQuery.value.dimensionType,
            currentQuery.value.categoryLevel,
          )
        : null)),
);
const isVarianceTrace = computed(
  () => props.result?.context.traceType === "COST_VARIANCE",
);
const drawerTitle = computed(() =>
  isVarianceTrace.value ? "超差分析" : "差异分析",
);
const baselineLabel = computed(() =>
  isVarianceTrace.value ? "目标成本" : "基准值",
);
const comparisonLabel = computed(() =>
  isVarianceTrace.value ? "当前成本" : "当前对比值",
);
const differenceLabel = computed(() =>
  isVarianceTrace.value ? "超差" : "差异",
);
const baselinePoint = computed(() => {
  const context = props.result?.context;
  return context && "baseline" in context ? context.baseline : null;
});
const comparisonPoint = computed(() => {
  const context = props.result?.context;
  return context && "comparison" in context ? context.comparison : null;
});
const variancePoint = computed(() => {
  const context = props.result?.context;
  return context?.traceType === "COST_VARIANCE" ? context.point : null;
});
const baselinePatternName = computed(() => {
  const context = props.result?.context;
  return context && "baselinePattern" in context
    ? context.baselinePattern.patternName
    : "";
});
const comparisonPatternName = computed(() => {
  const context = props.result?.context;
  return context && "comparisonPattern" in context
    ? context.comparisonPattern.patternName
    : "";
});
const variancePatternName = computed(() => {
  const context = props.result?.context;
  return context?.traceType === "COST_VARIANCE"
    ? context.pattern.patternName
    : "";
});
const primarySummaryItems = computed<SummaryItem[]>(() => [
  {
    key: "baseline",
    label: baselineLabel.value,
    value: formatMetricValue(props.result?.summary.baselineValue ?? null),
  },
  {
    key: "comparison",
    label: comparisonLabel.value,
    value: formatMetricValue(props.result?.summary.comparisonValue ?? null),
  },
  {
    key: "difference",
    label: differenceLabel.value,
    value: formatMetricValue(props.result?.summary.difference ?? null),
  },
]);
const partTableRows = computed(() => {
  if (!props.result) return [];
  if (!isPartDetail.value) return props.result.rows;
  return props.allPartRows ?? props.result.rows;
});
const filteredTableRows = computed(() => {
  const keyword = partSearchKeyword.value.trim().toLowerCase();
  if (!isPartDetail.value || !keyword) return partTableRows.value;
  return partTableRows.value.filter((row) =>
    `${row.objectCode} ${row.objectName}`.toLowerCase().includes(keyword),
  );
});
const hasHiddenPartRows = computed(() => {
  const result = props.result;
  return (
    result?.drillLevel === "PART" &&
    !props.allPartRows &&
    result.rows.length < result.summary.totalChangedCount
  );
});
const partResultSummary = computed(() => {
  const total = partTableRows.value.length;
  if (partSearchKeyword.value) {
    return `筛选结果 ${filteredTableRows.value.length} 项 / 共 ${total} 项`;
  }
  if (hasHiddenPartRows.value) {
    return `当前展示 ${total} 项 / 共 ${props.result?.summary.totalChangedCount ?? total} 项`;
  }
  return `共 ${total} 项`;
});

watch(
  () => props.visible,
  (visible) => {
    if (visible) return;
    chartModeInitialized = false;
    chartMode.value = "DIRECTION";
    activePartId.value = null;
    partSearchInput.value = "";
    partSearchKeyword.value = "";
  },
);

watch(partContextKey, () => {
  partSearchInput.value = "";
  partSearchKeyword.value = "";
});

watch(
  () => props.allPartRows,
  async (rows) => {
    if (!rows) return;
    await nextTick();
    differenceRoot.value
      ?.querySelector<HTMLElement>(".cost-analysis-difference__table-toolbar")
      ?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  },
);

watch(
  () => props.result,
  (result) => {
    activePartId.value = null;
    if (!result || chartModeInitialized) return;
    chartMode.value = resolveDefaultDifferenceChartMode();
    chartModeInitialized = true;
  },
  { immediate: true },
);

const statusLabels = {
  ADDED: "新增",
  REMOVED: "删除",
  CHANGED: "变更",
} as const;

function updateVisible(value: boolean): void {
  emit("update:visible", value);
}

function close(): void {
  updateVisible(false);
}

function exportDetail(): void {
  emit("export");
}

function updateChartMode(mode: CostAnalysisDifferenceChartMode): void {
  chartMode.value = mode;
}

function updateViewLevel(level: CostAnalysisDifferenceViewLevel): void {
  emit("view-level-change", level);
}

async function locatePart(row: CostAnalysisDifferenceDetailRow): Promise<void> {
  if (row.objectType !== "PART") return;
  partSearchInput.value = "";
  partSearchKeyword.value = "";
  activePartId.value = row.objectId;
  await nextTick();
  differenceRoot.value
    ?.querySelector<HTMLElement>(".cost-analysis-difference__table-row--active")
    ?.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

function showAllParts(): void {
  emit("show-all-parts");
}

function searchParts(): void {
  partSearchKeyword.value = partSearchInput.value.trim();
  if (hasHiddenPartRows.value) {
    showAllParts();
  }
}

function clearPartSearch(): void {
  partSearchInput.value = "";
  partSearchKeyword.value = "";
}

function rowClassName({
  row,
}: {
  row: CostAnalysisDifferenceDetailRow;
}): string {
  return row.objectId === activePartId.value
    ? "cost-analysis-difference__table-row--active"
    : "";
}

function pointLabel(point: CostAnalysisPoint): string {
  return `${point.projectName} / ${point.valveName} / ${point.bomVersionNo}`;
}

function summaryHelpText(key: SummaryItemKey): string {
  switch (key) {
    case "baseline":
      return isVarianceTrace.value
        ? "作为参照的目标成本数值，用来和当前成本比较。"
        : "用户选定的基准项目阀点在当前节点的取值。";
    case "comparison":
      return isVarianceTrace.value
        ? "当前实际成本数值，用来和目标成本比较。"
        : "本次点击差异角标所在项目阀点的取值。";
    case "difference":
      return isVarianceTrace.value
        ? "当前节点的总超差，计算方式为 当前成本 - 目标成本。"
        : "当前节点的总差异，计算方式为 当前对比值 - 基准值。";
  }
}

function formatMetricValue(value: number | null): string {
  if (!props.result || value === null) return "--";
  return props.result.context.metric === "MIX"
    ? formatPercent(value)
    : formatMoney(value);
}

function formatRate(value: number | null): string {
  return value === null ? "--" : formatPercent(value);
}

function statusLabel(
  status: CostAnalysisDifferenceDetailRow["status"],
): string {
  return statusLabels[status];
}
</script>

<template>
  <BaseDrawer
    :model-value="visible"
    :title="drawerTitle"
    size="min(720px, 100vw)"
    :show-footer="true"
    @update:model-value="updateVisible"
  >
    <div ref="differenceRoot" class="cost-analysis-difference">
      <div v-if="loading && !result" class="cost-analysis-difference__loading">
        <el-skeleton :rows="8" animated />
      </div>

      <div v-else-if="error && !result" class="cost-analysis-difference__error">
        <TraceErrorAlert v-bind="error" />
        <el-button
          type="primary"
          plain
          data-test="difference-retry"
          @click="emit('retry')"
        >
          重试
        </el-button>
      </div>

      <template v-else-if="result">
        <div
          v-if="loading"
          class="cost-analysis-difference__refreshing"
          data-test="difference-refreshing"
        >
          <el-skeleton :rows="2" animated />
        </div>
        <TraceErrorAlert
          v-if="error"
          v-bind="error"
          class="cost-analysis-difference__inline-error"
        />
        <section class="cost-analysis-difference__context">
          <div v-if="variancePoint">
            <span class="cost-analysis-difference__role">分析对象</span>
            <strong>
              {{ pointLabel(variancePoint) }} / {{ variancePatternName }}
            </strong>
          </div>
          <div v-if="baselinePoint">
            <span class="cost-analysis-difference__role">基准对象</span>
            <strong>
              {{ pointLabel(baselinePoint) }} / {{ baselinePatternName }}
            </strong>
          </div>
          <div v-if="comparisonPoint">
            <span class="cost-analysis-difference__role is-comparison">
              当前对比对象
            </span>
            <strong>
              {{ pointLabel(comparisonPoint) }} / {{ comparisonPatternName }}
            </strong>
          </div>
          <div class="cost-analysis-difference__context-meta">
            <span>
              指标：{{ getCostAnalysisMetricLabel(result.context.metric) }}
            </span>
            <span v-if="isVarianceTrace"> 超差 = 当前成本 - 目标成本 </span>
            <span v-else>差异 = 当前对比值 - 基准值</span>
          </div>
        </section>

        <nav class="cost-analysis-difference__path" aria-label="差异溯源路径">
          <template
            v-for="(entry, index) in path"
            :key="`${entry.query.categoryLevel}-${entry.query.categoryId}`"
          >
            <el-button
              v-if="index < path.length - 1"
              link
              :data-test="`difference-path-${index}`"
              @click="emit('back', index)"
            >
              {{
                entry.result.context.categoryPath.at(-1)?.categoryName ??
                entry.query.categoryId
              }}
            </el-button>
            <span v-else class="cost-analysis-difference__path-current">
              {{
                entry.result.context.categoryPath.at(-1)?.categoryName ??
                entry.query.categoryId
              }}
            </span>
            <el-icon v-if="index < path.length - 1" aria-hidden="true">
              <ArrowRight />
            </el-icon>
          </template>
        </nav>

        <section class="cost-analysis-difference__summary">
          <el-alert
            v-if="result.summary.overlappingGroups"
            type="warning"
            :closable="false"
            :title="
              result.summary.scopeNotice ||
              '分组存在共享零件，顶部金额按当前范围去重统计，不能直接累加分组金额'
            "
          />
          <el-alert
            v-if="result.summary.missingValueCount"
            type="warning"
            :closable="false"
            :title="`${result.summary.missingValueCount}项明细金额不完整，超差仅累计金额完整的明细`"
          />
          <dl class="cost-analysis-difference__summary-primary">
            <div
              v-for="item in primarySummaryItems"
              :key="item.key"
              :data-test="`difference-summary-${item.key}`"
            >
              <dt>
                <span>{{ item.label }}</span>
                <el-tooltip
                  :content="summaryHelpText(item.key)"
                  placement="top"
                >
                  <el-icon
                    class="bq-help-icon"
                    tabindex="0"
                    :aria-label="`${item.label}说明`"
                  >
                    <WarningFilled />
                  </el-icon>
                </el-tooltip>
              </dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </section>

        <CostAnalysisDifferenceChart
          :result="result"
          :mode="chartMode"
          :view-level="currentViewLevel"
          :view-level-options="viewLevelOptions"
          :active-object-id="activePartId"
          @update:mode="updateChartMode"
          @update:view-level="updateViewLevel"
          @drill="emit('drill', $event)"
          @locate-part="locatePart"
          @show-all-parts="showAllParts"
        />

        <section
          v-if="isPartDetail && result.rows.length > 0"
          class="cost-analysis-difference__table-toolbar"
        >
          <div class="cost-analysis-difference__table-search">
            <el-input
              v-model="partSearchInput"
              clearable
              placeholder="请输入零件号或零件名称"
              data-test="difference-part-search"
              @keyup.enter="searchParts"
              @clear="clearPartSearch"
            >
              <template #prefix>
                <el-icon aria-hidden="true"><Search /></el-icon>
              </template>
            </el-input>
            <el-button
              type="primary"
              plain
              data-test="difference-part-search-button"
              @click="searchParts"
            >
              搜索
            </el-button>
          </div>
          <div class="cost-analysis-difference__table-actions">
            <span>{{ partResultSummary }}</span>
            <el-button
              v-if="hasHiddenPartRows"
              :loading="allPartsLoading"
              data-test="difference-show-all-parts"
              @click="showAllParts"
            >
              展示全部（{{ result.summary.totalChangedCount }}）
            </el-button>
          </div>
        </section>

        <div
          v-if="isPartDetail && allPartsError"
          class="cost-analysis-difference__parts-error"
        >
          <TraceErrorAlert v-bind="allPartsError" />
          <el-button
            plain
            data-test="difference-retry-all-parts"
            @click="emit('retry-all-parts')"
          >
            重试
          </el-button>
        </div>

        <BaseEmpty
          v-if="result.rows.length === 0"
          :title="
            isVarianceTrace ? '当前对象没有超差明细' : '当前对象没有差异明细'
          "
          :description="
            isVarianceTrace
              ? '当前成本与目标成本可能相同，或下级超差已相互抵消。'
              : '基准值与当前对比值可能相同，或下级差异已相互抵消。'
          "
        />

        <BaseDataTable
          v-else
          :data="filteredTableRows"
          row-key="objectId"
          border
          :row-class-name="rowClassName"
          class="cost-analysis-difference__table"
          data-test="difference-detail-table"
        >
          <el-table-column
            v-if="isPartDetail"
            type="index"
            label="排名"
            width="64"
            align="center"
          />
          <el-table-column
            v-if="isPartDetail"
            label="零件号"
            prop="objectCode"
            min-width="136"
          />
          <el-table-column
            :label="isPartDetail ? '零件名称' : `${dimensionObjectLabel}名称`"
            prop="objectName"
            min-width="136"
          >
            <template #default="{ row }">
              {{ row.objectName }}
              <el-tag v-if="row.amountMissing" type="warning" size="small"
                >金额缺失</el-tag
              >
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isPartDetail"
            label="指标"
            width="96"
            align="center"
          >
            <template #default>
              {{ getCostAnalysisMetricLabel(result.context.metric) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isVarianceTrace"
            label="状态"
            width="72"
            align="center"
          >
            <template #default="{ row }">
              {{ statusLabel(row.status) }}
            </template>
          </el-table-column>
          <el-table-column :label="baselineLabel" min-width="112" align="right">
            <template #default="{ row }">
              {{ formatMetricValue(row.baselineValue) }}
            </template>
          </el-table-column>
          <el-table-column
            :label="comparisonLabel"
            min-width="112"
            align="right"
          >
            <template #default="{ row }">
              {{ formatMetricValue(row.comparisonValue) }}
            </template>
          </el-table-column>
          <el-table-column
            :label="differenceLabel"
            min-width="112"
            align="right"
          >
            <template #default="{ row }">
              {{ formatMetricValue(row.difference) }}
            </template>
          </el-table-column>
          <el-table-column label="占比" width="88" align="right">
            <template #default="{ row }">
              {{ formatRate(row.contributionRate) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isPartDetail"
            label="操作"
            width="64"
            fixed="right"
          >
            <template #default="{ row }">
              <el-button
                v-if="row.hasChildren"
                link
                :aria-label="`查看${row.objectName}`"
                :data-test="`difference-drill-${row.objectId}`"
                @click="emit('drill', row)"
              >
                查看
              </el-button>
            </template>
          </el-table-column>
        </BaseDataTable>

        <CostAnalysisAiSummary
          v-if="showAiSummary"
          :loading="aiLoading"
          :error="aiError"
          :result="aiResult"
          @generate="emit('generate-ai')"
          @regenerate="emit('regenerate-ai')"
          @retry="emit('retry-ai')"
        />
      </template>
    </div>

    <template #footer>
      <el-button
        v-if="canExport"
        :icon="Download"
        data-test="difference-export"
        @click="exportDetail"
      >
        导出
      </el-button>
      <el-button data-test="difference-close" @click="close">关闭</el-button>
    </template>
  </BaseDrawer>
</template>

<style scoped>
.cost-analysis-difference {
  display: grid;
  min-width: 0;
  gap: 16px;
}

.cost-analysis-difference__loading,
.cost-analysis-difference__error {
  display: grid;
  gap: 12px;
}

.cost-analysis-difference__error {
  justify-items: start;
}

.cost-analysis-difference__refreshing {
  padding: 8px 0;
  border-bottom: 1px solid var(--bq-color-divider);
}

.cost-analysis-difference__inline-error {
  margin-bottom: -4px;
}

.cost-analysis-difference__context {
  display: grid;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--bq-color-divider);
}

.cost-analysis-difference__context > div {
  display: flex;
  min-width: 0;
  gap: 8px;
  align-items: baseline;
}

.cost-analysis-difference__context strong {
  overflow-wrap: anywhere;
  font-size: 14px;
  letter-spacing: 0;
}

.cost-analysis-difference__role {
  flex: 0 0 84px;
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.cost-analysis-difference__role.is-comparison {
  color: var(--bq-color-primary-active);
}

.cost-analysis-difference__context-meta {
  flex-wrap: wrap;
  color: var(--bq-color-text-secondary);
  font-size: 12px;
}

.cost-analysis-difference__context-meta span {
  padding-right: 8px;
  border-right: 1px solid var(--bq-color-divider);
}

.cost-analysis-difference__path {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  font-size: 13px;
}

.cost-analysis-difference__path-current {
  color: var(--bq-color-text);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.cost-analysis-difference__summary {
  display: grid;
  gap: 10px;
}

.cost-analysis-difference__summary dl {
  display: grid;
  margin: 0;
  border-top: 1px solid var(--bq-color-divider);
  border-left: 1px solid var(--bq-color-divider);
}

.cost-analysis-difference__summary-primary {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.cost-analysis-difference__summary dl > div {
  min-width: 0;
  padding: 8px;
  border-right: 1px solid var(--bq-color-divider);
  border-bottom: 1px solid var(--bq-color-divider);
}

.cost-analysis-difference__summary dt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--bq-color-text-muted);
  font-size: 12px;
}

.cost-analysis-difference__summary dt .bq-help-icon {
  font-size: 14px;
  color: var(--bq-color-icon-muted, #9aa0a6);
  cursor: help;
  outline: none;
  transition: color 0.2s ease;
}

.cost-analysis-difference__summary dt .bq-help-icon:hover,
.cost-analysis-difference__summary dt .bq-help-icon:focus-visible {
  color: var(--bq-color-primary, #2f6fe8);
}

.cost-analysis-difference__summary dd {
  margin: 4px 0 0;
  color: var(--bq-color-text);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.cost-analysis-difference__table {
  min-width: 0;
}

.cost-analysis-difference__table-toolbar {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  justify-content: space-between;
}

.cost-analysis-difference__table-search {
  display: flex;
  min-width: min(100%, 320px);
  gap: 8px;
  align-items: center;
}

.cost-analysis-difference__table-search :deep(.el-input) {
  width: 240px;
}

.cost-analysis-difference__table-actions {
  display: flex;
  min-width: 0;
  gap: 8px;
  align-items: center;
  color: var(--bq-color-text-secondary);
  font-size: 12px;
}

.cost-analysis-difference__parts-error {
  display: grid;
  gap: 8px;
  justify-items: start;
}

.cost-analysis-difference__table
  :deep(.cost-analysis-difference__table-row--active > td.el-table__cell) {
  background: var(--bq-color-primary-soft);
}

@media (max-width: 640px) {
  .cost-analysis-difference__summary-primary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cost-analysis-difference__table-search,
  .cost-analysis-difference__table-actions {
    width: 100%;
  }

  .cost-analysis-difference__table-search :deep(.el-input) {
    width: 100%;
  }
}
</style>
