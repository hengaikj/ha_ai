<script setup lang="ts">
import { Check, Sort, SortDown, SortUp } from "@element-plus/icons-vue";
import {
  computed,
  h,
  nextTick,
  ref,
  type Component,
  type FunctionalComponent,
  type PropType,
  watch,
} from "vue";
import { ElTableColumn } from "element-plus";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import BaseMoney from "@/components/base/BaseMoney.vue";
import BasePercent from "@/components/base/BasePercent.vue";
import {
  COST_ANALYSIS_MATRIX_SORT_LABELS,
  buildCostAnalysisColumnGroups,
  buildCostAnalysisDisplayRows,
  calculateCostAnalysisDifference,
  getCostAnalysisMetricLabel,
  sortCostAnalysisDisplayRows,
  type CostAnalysisColumnGroup,
  type CostAnalysisMatrixSortMode,
  type CostAnalysisMatrixSortSelection,
  type DisplayRow,
  type MatrixColumn,
} from "@/pages/cost/analysis/utils/matrix-view";
import type {
  CostAnalysisDifferenceCellContext,
  CostAnalysisVarianceCellContext,
} from "@/pages/cost/analysis/composables/useCostAnalysisDifferenceTrace";
import type {
  CostAnalysisDiffColumnSelection,
  CostAnalysisMetric,
  CostAnalysisPoint,
  CostAnalysisQuery,
  CostAnalysisResult,
} from "@/types/cost-analysis";
import {
  getCostAnalysisDimensionMaxLevel,
  normalizeCostAnalysisDimensionType,
} from "@/pages/cost/analysis/utils/analysis-dimension";
import { formatMoney } from "@/utils/formatters";

const props = withDefaults(
  defineProps<{
    result: CostAnalysisResult;
    query: CostAnalysisQuery;
    diffSelection?: CostAnalysisDiffColumnSelection | null;
    sortMode?: CostAnalysisMatrixSortMode;
    sortColumnKey?: string | null;
    traceable?: boolean;
    focusMode?: boolean;
  }>(),
  {
    diffSelection: null,
    sortMode: "DEFAULT",
    sortColumnKey: null,
    traceable: false,
    focusMode: false,
  },
);

const emit = defineEmits<{
  "difference-click": [context: CostAnalysisDifferenceCellContext];
  "variance-click": [context: CostAnalysisVarianceCellContext];
  "sort-change": [selection: CostAnalysisMatrixSortSelection];
  "sort-clear": [];
  "remark-blur": [payload: { categoryId: string; columnKey: string; remark: string }];
}>();

type MatrixRenderColumnGroup = CostAnalysisColumnGroup & {
  fixed?: "left";
};

const MatrixColumnGroup: FunctionalComponent<{
  group: MatrixRenderColumnGroup;
  baselineColumnKey?: string;
}> = (renderProps, { slots }) => {
  const columns = renderProps.group.columns.map((column, columnIndex) => {
    const isBaseline = column.valueKey === renderProps.baselineColumnKey;
    const columnClassName = resolvePointColumnClassName(
      renderProps,
      column,
      columnIndex,
      renderProps.group.columns.length,
    );
    return h(
      ElTableColumn,
      {
        key: column.id,
        minWidth: isBaseline ? 136 : 132,
        align: "center",
        fixed: renderProps.group.fixed,
        className: columnClassName,
        labelClassName: columnClassName,
      },
      {
        header: () => slots.columnHeader?.({ column }),
        default: ({ row }: { row: DisplayRow }) =>
          slots.default?.({ row, column, columnIndex }),
      },
    );
  });
  return h(
    ElTableColumn,
    {
      align: "center",
      fixed: renderProps.group.fixed,
      className: "cost-analysis-matrix__pattern-group",
      labelClassName: "cost-analysis-matrix__pattern-group",
    },
    {
      header: () => slots.groupHeader?.(),
      default: () => columns,
    },
  );
};

function resolvePointColumnClassName(
  renderProps: {
    baselineColumnKey?: string;
  },
  column: MatrixColumn,
  columnIndex: number,
  columnCount: number,
): string {
  const classes = ["cost-analysis-matrix__point-column"];
  if (columnIndex === 0) {
    classes.push("is-group-start");
  }
  if (columnIndex === columnCount - 1) {
    classes.push("is-group-end");
  }
  if (column.valueKey === renderProps.baselineColumnKey) {
    classes.push("is-baseline");
  }
  return classes.join(" ");
}

MatrixColumnGroup.props = {
  group: {
    type: Object as PropType<MatrixRenderColumnGroup>,
    required: true,
  },
  baselineColumnKey: {
    type: String,
    required: false,
  },
};

const sourceColumnGroups = computed(() =>
  buildCostAnalysisColumnGroups(props.result, props.query),
);
const columnGroups = computed<MatrixRenderColumnGroup[]>(() => {
  const baselineColumnKey = props.diffSelection?.baselineColumnKey;
  if (!baselineColumnKey) return sourceColumnGroups.value;

  let baselineGroup: MatrixRenderColumnGroup | null = null;
  const remainingGroups = sourceColumnGroups.value.flatMap((group) => {
    const baselineColumn = group.columns.find(
      (column) => column.valueKey === baselineColumnKey,
    );
    if (!baselineColumn) return [group];

    baselineGroup = {
      ...group,
      id: `baseline-${baselineColumn.id}`,
      columns: [baselineColumn],
      fixed: "left",
    };
    const remainingColumns = group.columns.filter(
      (column) => column.valueKey !== baselineColumnKey,
    );
    return remainingColumns.length > 0
      ? [{ ...group, columns: remainingColumns }]
      : [];
  });

  return baselineGroup ? [baselineGroup, ...remainingGroups] : remainingGroups;
});
const sourceDisplayRows = computed(() =>
  buildCostAnalysisDisplayRows(props.result),
);
const sortedDisplayRows = computed(() =>
  sortCostAnalysisDisplayRows(sourceDisplayRows.value, {
    mode: props.sortMode,
    columnKey: props.sortColumnKey,
    baselineColumnKey: props.diffSelection?.baselineColumnKey ?? null,
  }),
);
const displayRows = computed<DisplayRow[]>(() =>
  sortedDisplayRows.value.flatMap((row) => {
    if (row.subtotal || row.metric !== "VARIANCE") {
      return [row];
    }

    const remarkRow = props.result.rows.find(
      (candidate) =>
        candidate.categoryId === row.categoryId &&
        (candidate.metric as string) === "REMARK",
    );
    return [
      row,
      {
        ...row,
        id: `${row.categoryId}:remark`,
        metric: "REMARK",
        values: Object.fromEntries(
          Object.keys(row.values).map((valueKey) => [
            valueKey,
            typeof remarkRow?.values[valueKey] === "string"
              ? remarkRow.values[valueKey]
              : "",
          ]),
        ),
      },
    ];
  }),
);
const dimensionType = computed(() =>
  normalizeCostAnalysisDimensionType(props.result.dimensionType),
);
const terminalLevel = computed(() =>
  getCostAnalysisDimensionMaxLevel(dimensionType.value),
);
const categoryNameColumnWidth = computed(() =>
  Math.max(
    104,
    ...props.result.categories.map((category) =>
      resolveCategoryNameColumnWidth(category.name),
    ),
  ),
);
const parentCategoryNameColumnWidth = computed(() =>
  Math.max(
    104,
    ...displayRows.value.map((row) =>
      resolveCategoryNameColumnWidth(row.parentCategoryName),
    ),
  ),
);
const categorySpanMap = computed(() => buildSpanMap((row) => row.categoryId));
const parentCategorySpanMap = computed(() =>
  buildSpanMap((row) => row.parentCategoryId),
);
const showDifference = computed(() => Boolean(props.diffSelection));
const tableHeight = computed(() => (props.focusMode ? "100%" : undefined));
const tableMaxHeight = computed(() =>
  props.focusMode ? "none" : "min(680px, calc(100dvh - 240px))",
);
const allColumns = computed(() =>
  columnGroups.value.flatMap((group) => group.columns),
);
const baselineColumn = computed(
  () =>
    allColumns.value.find(
      (column) => column.valueKey === props.diffSelection?.baselineColumnKey,
    ) ?? null,
);
const diffContextAriaLabel = computed(() => {
  if (!baselineColumn.value) {
    return "当前成本列差异对比基准";
  }
  return `基准 ${columnLabel(
    baselineColumn.value,
  )}，其余独立列差异等于当前列减基准列`;
});
const hasSortableCategories = computed(
  () => props.result.rows.length > 0 && props.result.categories.length > 1,
);
const remarkDrafts = ref<Record<string, string>>({});

watch(
  () => props.result.snapshotId,
  () => {
    remarkDrafts.value = {};
  },
);

type MatrixSortCommand = CostAnalysisMatrixSortSelection | "CLEAR";

interface MatrixSortMenuOption {
  key: string;
  selection: CostAnalysisMatrixSortSelection;
  label: string;
  icon: Component;
  help: string;
}

function matrixSortMenuOptions(column: MatrixColumn): MatrixSortMenuOption[] {
  const varianceOption: MatrixSortMenuOption = {
    key: "VARIANCE_DESC",
    selection: {
      mode: "VARIANCE_DESC",
      columnKey: column.valueKey,
    },
    label: COST_ANALYSIS_MATRIX_SORT_LABELS.VARIANCE_DESC,
    icon: SortDown,
    help: "按当前列的超差金额由大到小。",
  };
  if (!props.diffSelection?.baselineColumnKey || isBaselineColumn(column)) {
    return [varianceOption];
  }
  return [
    {
      key: "CURRENT_COST_DIFF_DESC",
      selection: {
        mode: "CURRENT_COST_DIFF_DESC",
        columnKey: column.valueKey,
      },
      label: COST_ANALYSIS_MATRIX_SORT_LABELS.CURRENT_COST_DIFF_DESC,
      icon: SortDown,
      help: "相对基准列的当前成本差异由大到小。",
    },
    {
      key: "CURRENT_COST_DIFF_ASC",
      selection: {
        mode: "CURRENT_COST_DIFF_ASC",
        columnKey: column.valueKey,
      },
      label: COST_ANALYSIS_MATRIX_SORT_LABELS.CURRENT_COST_DIFF_ASC,
      icon: SortUp,
      help: "相对基准列的当前成本差异由小到大。",
    },
    varianceOption,
  ];
}

function isColumnSortAvailable(
  column: MatrixColumn,
  selection: CostAnalysisMatrixSortSelection,
): boolean {
  if (!hasSortableCategories.value) return false;

  if (selection.mode === "VARIANCE_DESC") {
    return props.result.categoryLevel !== 3;
  }
  return Boolean(
    props.diffSelection?.baselineColumnKey &&
    selection.columnKey === column.valueKey &&
    !isBaselineColumn(column),
  );
}

function isColumnSortActive(
  column: MatrixColumn,
  selection?: CostAnalysisMatrixSortSelection,
): boolean {
  return (
    props.sortColumnKey === column.valueKey &&
    (selection
      ? props.sortMode === selection.mode
      : props.sortMode !== "DEFAULT")
  );
}

function isColumnSortModeActive(
  column: MatrixColumn,
  mode: Exclude<CostAnalysisMatrixSortMode, "DEFAULT">,
): boolean {
  return props.sortColumnKey === column.valueKey && props.sortMode === mode;
}

function handleColumnSortCommand(
  column: MatrixColumn,
  command: MatrixSortCommand,
): void {
  if (command === "CLEAR") {
    emit("sort-clear");
    return;
  }
  if (!isColumnSortAvailable(column, command)) return;
  emit("sort-change", command);
}

function pointLabel(point: CostAnalysisPoint): string {
  return `${point.projectName} / ${point.valveName}`;
}

function columnLabel(column: MatrixColumn): string {
  return `${pointLabel(column.point)} / ${column.pattern.patternName}`;
}

function activeColumnSortLabel(column: MatrixColumn): string | null {
  if (!isColumnSortActive(column) || props.sortMode === "DEFAULT") {
    return null;
  }
  return COST_ANALYSIS_MATRIX_SORT_LABELS[props.sortMode];
}

function sortTriggerAriaLabel(column: MatrixColumn): string {
  const activeLabel = activeColumnSortLabel(column);
  if (activeLabel) {
    return `已按${columnLabel(column)}的${activeLabel}排序，点击调整`;
  }
  return `设置${columnLabel(column)}排序`;
}

function sortTriggerTitle(column: MatrixColumn): string {
  const activeLabel = activeColumnSortLabel(column);
  if (activeLabel) {
    return `当前排序：${columnLabel(column)} · ${activeLabel}`;
  }
  return `按${columnLabel(column)}排序`;
}

function resolveCategoryNameColumnWidth(categoryName: string): number {
  const contentWidth = Array.from(categoryName).reduce(
    (width, character) => width + (character.charCodeAt(0) > 255 ? 14 : 8),
    0,
  );

  return Math.ceil((contentWidth + 28) / 8) * 8;
}

function buildSpanMap(
  getKey: (row: DisplayRow) => string,
): Map<number, number> {
  const spans = new Map<number, number>();
  let previousKey: string | null = null;
  let firstIndex = -1;

  displayRows.value.forEach((row, rowIndex) => {
    if (row.subtotal) {
      previousKey = null;
      return;
    }

    const key = getKey(row);
    if (key === previousKey && firstIndex >= 0) {
      spans.set(firstIndex, (spans.get(firstIndex) ?? 1) + 1);
      return;
    }

    firstIndex = rowIndex;
    spans.set(firstIndex, 1);
    previousKey = key;
  });

  return spans;
}

function cellValue(
  row: DisplayRow,
  column: MatrixColumn,
): number | string | null {
  return row.values[column.valueKey] ?? null;
}

function remarkCellKey(row: DisplayRow, column: MatrixColumn): string {
  return `${row.categoryId}:${column.valueKey}`;
}

function remarkValue(row: DisplayRow, column: MatrixColumn): string {
  const key = remarkCellKey(row, column);
  if (Object.hasOwn(remarkDrafts.value, key)) {
    return remarkDrafts.value[key] ?? "";
  }
  const value = cellValue(row, column);
  return typeof value === "string" ? value : "";
}

function updateRemark(
  row: DisplayRow,
  column: MatrixColumn,
  event: Event,
): void {
  remarkDrafts.value[remarkCellKey(row, column)] = (
    event.target as HTMLInputElement
  ).value;
}

function saveRemark(row: DisplayRow, column: MatrixColumn): void {
  emit("remark-blur", {
    categoryId: row.categoryId,
    columnKey: column.valueKey,
    remark: remarkValue(row, column),
  });
}

function isWeightedMixCell(row: DisplayRow, column: MatrixColumn): boolean {
  return row.metric === "MIX" && column.pattern.patternType === "WEIGHTED";
}

function isNumericValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBaselineColumn(column: MatrixColumn): boolean {
  return column.valueKey === props.diffSelection?.baselineColumnKey;
}

function findBaselineColumn(): MatrixColumn | null {
  return baselineColumn.value;
}

function supportsPointDifference(row: DisplayRow): row is DisplayRow & {
  metric: "CURRENT_COST" | "TARGET_COST";
} {
  return row.metric === "CURRENT_COST" || row.metric === "TARGET_COST";
}

function isDifferent(
  row: DisplayRow,
  column: MatrixColumn,
  columns: MatrixColumn[],
): boolean {
  if (
    !showDifference.value ||
    !supportsPointDifference(row) ||
    isBaselineColumn(column)
  ) {
    return false;
  }
  const difference = differenceValue(row, column, columns);
  return difference !== null && difference !== 0;
}

function differenceValue(
  row: DisplayRow,
  column: MatrixColumn,
  _columns: MatrixColumn[],
): number | null {
  const selectedBaselineColumn = findBaselineColumn();
  if (!selectedBaselineColumn || isBaselineColumn(column)) {
    return null;
  }
  return calculateCostAnalysisDifference(
    cellValue(row, selectedBaselineColumn),
    cellValue(row, column),
    row.metric as CostAnalysisMetric,
  );
}

function selectedDifferenceValues(
  row: DisplayRow,
  column: MatrixColumn,
  columns: MatrixColumn[],
): {
  baselineValue: number;
  comparisonValue: number;
  difference: number;
} | null {
  const selectedBaselineColumn = findBaselineColumn();
  if (!selectedBaselineColumn || isBaselineColumn(column)) return null;
  const baselineValue = cellValue(row, selectedBaselineColumn);
  const comparisonValue = cellValue(row, column);
  const difference = differenceValue(row, column, columns);
  return isNumericValue(baselineValue) &&
    isNumericValue(comparisonValue) &&
    difference !== null
    ? { baselineValue, comparisonValue, difference }
    : null;
}

function isTraceableDifference(
  row: DisplayRow,
  column: MatrixColumn,
  _group: CostAnalysisColumnGroup,
): boolean {
  return Boolean(
    props.traceable &&
    !row.subtotal &&
    supportsPointDifference(row) &&
    (row.categoryLevel !== terminalLevel.value ||
      row.metric === "CURRENT_COST") &&
    props.diffSelection &&
    selectedDifferenceValues(row, column, allColumns.value),
  );
}

function differenceActionAriaLabel(
  row: DisplayRow,
  column: MatrixColumn,
): string {
  return `${row.categoryName}${getCostAnalysisMetricLabel(row.metric)}，${pointLabel(
    column.point,
  )}相对基准的差异，查看差异溯源`;
}

function emitDifferenceClick(
  row: DisplayRow,
  column: MatrixColumn,
  group: CostAnalysisColumnGroup,
): void {
  if (!isTraceableDifference(row, column, group) || !props.diffSelection) {
    return;
  }
  const values = selectedDifferenceValues(row, column, allColumns.value);
  if (!values) return;
  emit("difference-click", {
    snapshotId: props.result.snapshotId,
    baselineColumnKey: props.diffSelection.baselineColumnKey,
    comparisonColumnKey: column.valueKey,
    dimensionType: dimensionType.value,
    categoryLevel: row.categoryLevel,
    categoryId: row.categoryId,
    metric: row.metric as CostAnalysisMetric,
    ...values,
  });
}

function shouldShowDifferenceBadge(
  row: DisplayRow,
  column: MatrixColumn,
): boolean {
  return (
    showDifference.value &&
    supportsPointDifference(row) &&
    !isBaselineColumn(column)
  );
}

function differenceBadgeText(
  row: DisplayRow,
  column: MatrixColumn,
  columns: MatrixColumn[],
): string {
  const difference = differenceValue(row, column, columns);
  return row.metric === "MIX"
    ? formatPercentagePointDifference(difference)
    : formatSignedMoney(difference);
}

function differenceBadgeSymbol(
  row: DisplayRow,
  column: MatrixColumn,
  columns: MatrixColumn[],
): "△" | "▽" | "Δ" {
  const difference = differenceValue(row, column, columns);
  if (difference === null || difference === 0) return "Δ";
  return difference > 0 ? "△" : "▽";
}

function differenceBadgeClass(
  row: DisplayRow,
  column: MatrixColumn,
  columns: MatrixColumn[],
): string {
  const difference = differenceValue(row, column, columns);
  if (difference === null || difference === 0 || row.metric === "MIX") {
    return "is-neutral";
  }
  const comparableDifferences = allColumns.value
    .map((candidate) => differenceValue(row, candidate, allColumns.value))
    .filter(isNumericValue);
  const minimumDifference = Math.min(...comparableDifferences);
  const maximumDifference = Math.max(...comparableDifferences);
  if (minimumDifference === maximumDifference) {
    return "is-neutral";
  }
  if (difference === maximumDifference) {
    return "is-increase";
  }
  if (difference === minimumDifference) {
    return "is-decrease";
  }
  return "is-neutral";
}

function differenceBadgeTitle(
  row: DisplayRow,
  column: MatrixColumn,
  columns: MatrixColumn[],
): string {
  if (!findBaselineColumn()) return "未找到当前基准列，无法对比";
  if (differenceValue(row, column, columns) === null) {
    return "当前值或基准值缺失，无法计算差异";
  }
  if (row.subtotal) return "小计仅展示差异，暂不支持溯源";
  if (!props.traceable) return "当前列相对基准列的差异";
  return `${columnLabel(column)} - ${
    baselineColumn.value ? columnLabel(baselineColumn.value) : "基准"
  }；点击查看差异溯源`;
}

function selectedVarianceValues(
  row: DisplayRow,
  column: MatrixColumn,
): {
  baselineValue: number;
  comparisonValue: number;
  difference: number;
} | null {
  if (row.metric !== "VARIANCE") return null;
  const currentRow = displayRows.value.find(
    (candidate) =>
      !candidate.subtotal &&
      candidate.categoryId === row.categoryId &&
      candidate.metric === "CURRENT_COST",
  );
  const targetRow = displayRows.value.find(
    (candidate) =>
      !candidate.subtotal &&
      candidate.categoryId === row.categoryId &&
      candidate.metric === "TARGET_COST",
  );
  const currentValue = currentRow ? cellValue(currentRow, column) : null;
  const targetValue = targetRow ? cellValue(targetRow, column) : null;
  const varianceValue = cellValue(row, column);
  return isNumericValue(currentValue) &&
    isNumericValue(targetValue) &&
    isNumericValue(varianceValue)
    ? {
        baselineValue: targetValue,
        comparisonValue: currentValue,
        difference: varianceValue,
      }
    : null;
}

function isTraceableVariance(row: DisplayRow, column: MatrixColumn): boolean {
  return Boolean(
    props.traceable &&
    !row.subtotal &&
    row.categoryLevel <= terminalLevel.value &&
    row.metric === "VARIANCE" &&
    selectedVarianceValues(row, column),
  );
}

function varianceActionAriaLabel(
  row: DisplayRow,
  column: MatrixColumn,
): string {
  return `${row.categoryName}${pointLabel(column.point)}超差，查看超差溯源`;
}

function emitVarianceClick(row: DisplayRow, column: MatrixColumn): void {
  if (!isTraceableVariance(row, column)) return;
  const values = selectedVarianceValues(row, column);
  if (!values) return;
  emit("variance-click", {
    traceType: "COST_VARIANCE",
    snapshotId: props.result.snapshotId,
    columnKey: column.valueKey,
    dimensionType: dimensionType.value,
    categoryLevel: row.categoryLevel,
    categoryId: row.categoryId,
    metric: "VARIANCE",
    ...values,
  });
}

function formatSignedMoney(value: number | null): string {
  if (value === null) {
    return "--";
  }
  const normalized = Object.is(value, -0) ? 0 : value;
  return `${normalized > 0 ? "+" : ""}${formatMoney(normalized)}`;
}

function formatPercentagePointDifference(value: number | null): string {
  if (value === null) {
    return "--";
  }
  const percentagePoints = Number((value * 100).toFixed(2));
  const normalized = Object.is(percentagePoints, -0) ? 0 : percentagePoints;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(2)} %`;
}

function varianceClass(row: DisplayRow, value: unknown): string {
  if (row.metric !== "VARIANCE" || !isNumericValue(value)) {
    return "";
  }
  return "cost-analysis-matrix__variance--primary";
}

function isCostAnalysisMetric(
  value: unknown,
): value is CostAnalysisMetric | "REMARK" {
  return (
    value === "MIX" ||
    value === "CURRENT_COST" ||
    value === "TARGET_COST" ||
    value === "VARIANCE" ||
    value === "REMARK"
  );
}

function displayMetricLabel(row: unknown): string {
  if (
    typeof row !== "object" ||
    row === null ||
    !("metric" in row) ||
    !isCostAnalysisMetric(row.metric)
  ) {
    return "";
  }

  return getCostAnalysisMetricLabel(row.metric);
}

function resolveSpanMethod({
  row,
  rowIndex,
  columnIndex,
}: {
  row: DisplayRow;
  rowIndex: number;
  columnIndex: number;
}): [number, number] {
  if (columnIndex > 1 || row.subtotal) {
    return [1, 1];
  }

  const spans =
    columnIndex === 0 ? parentCategorySpanMap.value : categorySpanMap.value;
  const span = spans.get(rowIndex);
  if (!span) {
    return [0, 0];
  }
  return [span, 1];
}

function resolveRowClassName({
  row,
  rowIndex,
}: {
  row: DisplayRow;
  rowIndex: number;
}): string {
  if (row.subtotal) {
    return "cost-analysis-matrix__row--subtotal";
  }

  const previousRow = displayRows.value[rowIndex - 1];
  return !previousRow || previousRow.categoryId !== row.categoryId
    ? "cost-analysis-matrix__row--category-start"
    : "";
}

const tableRef = ref<{ doLayout?: () => void } | null>(null);

watch(
  [
    () => props.diffSelection?.baselineColumnKey,
    () => props.result.snapshotId,
    () => props.focusMode,
  ],
  () => {
    void nextTick(() => {
      tableRef.value?.doLayout?.();
    });
  },
);
</script>

<template>
  <section
    class="cost-analysis-matrix__container"
    :class="{ 'is-focus-mode': focusMode }"
  >
    <div
      v-if="showDifference && baselineColumn"
      class="cost-analysis-matrix__diff-context"
      data-test="cost-analysis-diff-context"
      :aria-label="diffContextAriaLabel"
    >
      <span class="cost-analysis-matrix__diff-object">
        <span class="cost-analysis-matrix__diff-role">基准</span>
        <span
          class="cost-analysis-matrix__diff-point"
          :title="columnLabel(baselineColumn)"
        >
          {{ columnLabel(baselineColumn) }}
        </span>
      </span>
      <span class="cost-analysis-matrix__diff-description">
        其他项目 × 阀点 × 版型列均自动与基准比较
      </span>
      <span class="cost-analysis-matrix__diff-formula">
        差异 = 当前列 - 基准列
      </span>
    </div>

    <div class="cost-analysis-matrix__scroll">
      <BaseDataTable
        ref="tableRef"
        class="cost-analysis-matrix"
        :class="{ 'is-focus-mode': focusMode }"
        table-layout="fixed"
        :data="displayRows"
        row-key="id"
        border
        scrollbar-always-on
        :height="tableHeight"
        :max-height="tableMaxHeight"
        :span-method="resolveSpanMethod"
        :row-class-name="resolveRowClassName"
      >
        <el-table-column
          label="分类名称"
          :width="parentCategoryNameColumnWidth"
          fixed="left"
          align="left"
          header-align="center"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.parentCategoryName }}
          </template>
        </el-table-column>
        <el-table-column
          prop="categoryName"
          label="科目"
          :width="categoryNameColumnWidth"
          fixed="left"
          align="left"
          header-align="center"
          show-overflow-tooltip
        />
        <el-table-column label="指标" width="104" fixed="left" align="center">
          <template #default="{ row }">
            {{ displayMetricLabel(row) }}
          </template>
        </el-table-column>

        <MatrixColumnGroup
          v-for="group in columnGroups"
          :key="`${group.id}-${diffSelection?.baselineColumnKey ?? 'plain'}`"
          :group="group"
          :baseline-column-key="diffSelection?.baselineColumnKey"
        >
          <template #groupHeader>
            <el-tooltip
              :content="`${group.label}；BOM ${group.point.bomVersionNo}`"
              placement="top"
              :show-after="300"
            >
              <div class="cost-analysis-matrix__group-header">
                <span
                  class="cost-analysis-matrix__group-title"
                  :aria-label="group.ariaLabel"
                >
                  {{ group.label }}
                </span>
              </div>
            </el-tooltip>
          </template>

          <template #columnHeader="{ column }">
            <div class="cost-analysis-matrix__column-header">
              <el-dropdown
                trigger="click"
                placement="bottom-end"
                popper-class="cost-analysis-matrix__sort-popper"
                @command="
                  (command: MatrixSortCommand) =>
                    handleColumnSortCommand(column, command)
                "
              >
                <button
                  type="button"
                  class="cost-analysis-matrix__sort-trigger"
                  :class="{
                    'is-active': isColumnSortActive(column),
                    'has-baseline-marker': isBaselineColumn(column),
                  }"
                  :data-test="`cost-analysis-column-sort-${column.valueKey}`"
                  :aria-label="sortTriggerAriaLabel(column)"
                  :aria-pressed="isColumnSortActive(column)"
                  :title="sortTriggerTitle(column)"
                >
                  <span
                    v-if="isBaselineColumn(column)"
                    class="cost-analysis-matrix__baseline-marker"
                    :data-test="`cost-analysis-baseline-marker-${column.valueKey}`"
                  >
                    基准
                  </span>
                  <span
                    class="cost-analysis-matrix__column-title"
                    :aria-label="column.ariaLabel"
                  >
                    {{ column.label }}
                  </span>
                  <el-icon
                    class="cost-analysis-matrix__sort-icon"
                    aria-hidden="true"
                  >
                    <SortUp
                      v-if="
                        isColumnSortModeActive(column, 'CURRENT_COST_DIFF_ASC')
                      "
                    />
                    <SortDown
                      v-else-if="
                        isColumnSortModeActive(
                          column,
                          'CURRENT_COST_DIFF_DESC',
                        ) || isColumnSortModeActive(column, 'VARIANCE_DESC')
                      "
                    />
                    <Sort v-else />
                  </el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="option in matrixSortMenuOptions(column)"
                      :key="option.key"
                      :command="option.selection"
                      :disabled="
                        !isColumnSortAvailable(column, option.selection)
                      "
                    >
                      <span class="cost-analysis-matrix__sort-menu-item">
                        <el-icon aria-hidden="true">
                          <component :is="option.icon" />
                        </el-icon>
                        <span class="cost-analysis-matrix__sort-menu-copy">
                          <span class="cost-analysis-matrix__sort-menu-label">
                            {{ option.label }}
                          </span>
                          <span
                            class="cost-analysis-matrix__sort-menu-help"
                            :data-test="`cost-analysis-sort-help-${column.valueKey}-${option.key}`"
                            :title="option.help"
                          >
                            {{ option.help }}
                          </span>
                        </span>
                        <el-icon
                          v-if="isColumnSortActive(column, option.selection)"
                          class="cost-analysis-matrix__sort-menu-check"
                          aria-hidden="true"
                        >
                          <Check />
                        </el-icon>
                      </span>
                    </el-dropdown-item>
                    <el-dropdown-item
                      command="CLEAR"
                      divided
                      :disabled="sortMode === 'DEFAULT'"
                    >
                      清除当前排序
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>

          <template #default="{ row, column }">
            <div
              class="cost-analysis-matrix__cell"
              :data-point-key="column.point.pointKey"
              :class="[
                varianceClass(row, cellValue(row, column)),
                {
                  'is-different': isDifferent(row, column, group.columns),
                },
              ]"
            >
              <template v-if="row.metric === 'REMARK'">
                <input
                  class="cost-analysis-matrix__remark-input"
                  type="text"
                  maxlength="1000"
                  :value="remarkValue(row, column)"
                  data-test="cost-analysis-remark"
                  :data-category-id="row.categoryId"
                  :data-column-key="column.valueKey"
                  aria-label="成本分析备注"
                  placeholder="请输入备注"
                  @input="updateRemark(row, column, $event)"
                  @blur="saveRemark(row, column)"
                />
              </template>
              <template v-else>
                <span
                  v-if="isDifferent(row, column, group.columns)"
                  class="cost-analysis-matrix__sr-only"
                >
                  与基准不同
                </span>
                <span
                  v-if="isWeightedMixCell(row, column)"
                  class="cost-analysis-matrix__empty"
                >
                  -
                </span>
                <BasePercent
                  v-else-if="
                    row.metric === 'MIX' &&
                    isNumericValue(cellValue(row, column))
                  "
                  class="cost-analysis-matrix__numeric-value"
                  :style="{ minWidth: 0, textAlign: 'center' }"
                  :numerator="cellValue(row, column)"
                />
                <button
                  v-else-if="isTraceableVariance(row, column)"
                  type="button"
                  class="cost-analysis-matrix__difference-action cost-analysis-matrix__variance-action"
                  :data-test="`variance-pattern-${column.pattern.patternId}-${row.id}-${column.point.pointKey}`"
                  title="查看超差溯源"
                  :aria-label="varianceActionAriaLabel(row, column)"
                  @click.stop="emitVarianceClick(row, column)"
                  @keydown.enter.prevent="emitVarianceClick(row, column)"
                  @keydown.space.prevent="emitVarianceClick(row, column)"
                >
                  {{ formatMoney(Number(cellValue(row, column))) }}
                </button>
                <BaseMoney
                  v-else-if="isNumericValue(cellValue(row, column))"
                  class="cost-analysis-matrix__numeric-value"
                  :style="{ minWidth: 0, textAlign: 'center' }"
                  :value="cellValue(row, column)"
                />
                <span v-else class="cost-analysis-matrix__empty">--</span>
                <button
                  v-if="
                    shouldShowDifferenceBadge(row, column) &&
                    isTraceableDifference(row, column, group)
                  "
                  type="button"
                  class="cost-analysis-matrix__difference-badge"
                  :class="differenceBadgeClass(row, column, group.columns)"
                  :data-test="`difference-badge-pattern-${column.pattern.patternId}-${row.id}-${column.point.pointKey}`"
                  :title="differenceBadgeTitle(row, column, group.columns)"
                  :aria-label="differenceActionAriaLabel(row, column)"
                  @click.stop="emitDifferenceClick(row, column, group)"
                  @keydown.enter.stop.prevent="
                    emitDifferenceClick(row, column, group)
                  "
                  @keydown.space.stop.prevent="
                    emitDifferenceClick(row, column, group)
                  "
                >
                  {{ differenceBadgeSymbol(row, column, group.columns) }}
                  {{ differenceBadgeText(row, column, group.columns) }}
                </button>
                <span
                  v-else-if="shouldShowDifferenceBadge(row, column)"
                  class="cost-analysis-matrix__difference-badge is-static"
                  :class="differenceBadgeClass(row, column, group.columns)"
                  :data-test="`difference-badge-pattern-${column.pattern.patternId}-${row.id}-${column.point.pointKey}`"
                  :title="differenceBadgeTitle(row, column, group.columns)"
                >
                  {{ differenceBadgeSymbol(row, column, group.columns) }}
                  {{ differenceBadgeText(row, column, group.columns) }}
                </span>
              </template>
            </div>
          </template>
        </MatrixColumnGroup>
      </BaseDataTable>
    </div>
  </section>
</template>

<style scoped>
.cost-analysis-matrix__container {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 8px;
}

.cost-analysis-matrix__container.is-focus-mode {
  height: 100%;
  min-height: 0;
}

.cost-analysis-matrix__diff-context {
  display: flex;
  min-width: 0;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-block: 1px solid var(--bq-color-divider);
  background: var(--bq-color-bg-soft);
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 20px;
}

.cost-analysis-matrix__diff-object {
  display: flex;
  min-width: 0;
  gap: 6px;
  align-items: center;
}

.cost-analysis-matrix__diff-role {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  padding-inline: 6px;
  border: 1px solid
    color-mix(in srgb, var(--bq-color-primary) 38%, var(--bq-color-divider));
  border-radius: 3px;
  background: color-mix(
    in srgb,
    var(--bq-color-primary-soft) 68%,
    var(--bq-color-surface)
  );
  color: var(--bq-color-primary-active);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.cost-analysis-matrix__diff-point {
  overflow: hidden;
  max-width: 260px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-analysis-matrix__diff-description {
  color: var(--bq-color-text-muted);
}

.cost-analysis-matrix__diff-formula {
  flex: 0 0 auto;
  padding-inline-start: 8px;
  margin-inline-start: auto;
  border-inline-start: 1px solid var(--bq-color-divider);
  color: var(--bq-color-primary-active);
  font-weight: 600;
}

.cost-analysis-matrix__scroll {
  --el-table-border-color: var(--bq-color-border);
  --el-table-header-bg-color: var(--bq-color-table-header);
  --el-table-row-hover-bg-color: var(--bq-color-bg-soft);
  width: 100%;
  min-width: 0;
  overflow: hidden;
  font-variant-numeric: tabular-nums;
}

.cost-analysis-matrix__container.is-focus-mode .cost-analysis-matrix__scroll {
  flex: 1 1 auto;
  min-height: 0;
}

.cost-analysis-matrix {
  min-width: 100%;
}

.cost-analysis-matrix__container.is-focus-mode
  .cost-analysis-matrix__scroll
  :deep(.base-data-table) {
  height: 100%;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);
}

.cost-analysis-matrix.is-focus-mode {
  height: 100%;
  min-height: 0;
}

.cost-analysis-matrix__scroll :deep(th.el-table__cell) {
  padding: 7px 0;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact);
  font-weight: 600;
}

.cost-analysis-matrix__scroll :deep(td.el-table__cell) {
  padding: 5px 0;
}

.cost-analysis-matrix__scroll :deep(.el-table__body-wrapper thead) {
  position: sticky;
  z-index: 5;
  top: 0;
}

.cost-analysis-matrix__scroll
  :deep(.el-table__body-wrapper thead tr:last-child th.el-table__cell) {
  box-shadow: inset 0 -1px 0 var(--bq-color-border);
}

.cost-analysis-matrix__scroll
  :deep(.cost-analysis-matrix__row--category-start td.el-table__cell) {
  border-top-color: color-mix(
    in srgb,
    var(--bq-color-text-secondary) 28%,
    var(--bq-color-border)
  );
}

.cost-analysis-matrix__scroll
  :deep(.cost-analysis-matrix__row--subtotal td.el-table__cell) {
  background: var(--bq-color-bg-soft);
  font-weight: 600;
}

.cost-analysis-matrix__scroll
  :deep(
    .el-table__row:has(.cost-analysis-matrix__remark-input) td.el-table__cell
  ) {
  background: color-mix(
    in srgb,
    var(--bq-color-bg-soft) 62%,
    var(--bq-color-surface)
  );
}

.cost-analysis-matrix__remark-input {
  box-sizing: border-box;
  width: calc(100% - 16px);
  min-width: 96px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--bq-color-border);
  border-radius: 4px;
  outline: none;
  background: var(--bq-color-surface);
  color: var(--bq-color-text);
  font: inherit;
  text-align: left;
}

.cost-analysis-matrix__remark-input::placeholder {
  color: var(--bq-color-text-muted);
}

.cost-analysis-matrix__remark-input:focus {
  border-color: var(--bq-color-primary);
  box-shadow: 0 0 0 2px
    color-mix(in srgb, var(--bq-color-primary), transparent 82%);
}

.cost-analysis-matrix__scroll
  :deep(th.el-table__cell.cost-analysis-matrix__pattern-group) {
  border-inline-start: 1px solid
    color-mix(
      in srgb,
      var(--bq-color-text-secondary) 14%,
      var(--bq-color-border)
    );
  background: color-mix(
    in srgb,
    var(--bq-color-table-header) 76%,
    var(--bq-color-surface)
  );
  box-shadow: inset 0 -1px 0 var(--bq-color-border);
}

.cost-analysis-matrix__scroll
  :deep(.el-table__cell.cost-analysis-matrix__point-column.is-group-start) {
  border-inline-start: 1px solid
    color-mix(
      in srgb,
      var(--bq-color-text-secondary) 14%,
      var(--bq-color-border)
    );
}

.cost-analysis-matrix__scroll
  :deep(.el-table__cell.cost-analysis-matrix__point-column.is-baseline) {
  background: color-mix(
    in srgb,
    var(--bq-color-primary) 4%,
    var(--bq-color-surface)
  );
  box-shadow: none;
}

.cost-analysis-matrix__scroll
  :deep(th.el-table__cell.cost-analysis-matrix__point-column.is-baseline) {
  box-shadow: inset 0 2px 0 var(--bq-color-primary);
}

.cost-analysis-matrix__scroll
  :deep(
    .cost-analysis-matrix__row--subtotal
      td.el-table__cell.cost-analysis-matrix__point-column.is-baseline
  ) {
  background: color-mix(
    in srgb,
    var(--bq-color-primary) 7%,
    var(--bq-color-bg-soft)
  );
}

.cost-analysis-matrix__scroll
  :deep(
    .el-table__body
      tr:hover
      > td.el-table__cell.cost-analysis-matrix__point-column.is-baseline
  ) {
  background: color-mix(
    in srgb,
    var(--bq-color-primary) 8%,
    var(--bq-color-bg-soft)
  );
}

.cost-analysis-matrix__scroll
  :deep(.el-table-fixed-column--left.is-last-column::before) {
  box-shadow: 6px 0 10px -10px rgba(15, 23, 42, 0.45);
}

.cost-analysis-matrix__group-header {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 28px;
}

.cost-analysis-matrix__group-header :deep(.el-dropdown) {
  display: block;
  width: 100%;
}

.cost-analysis-matrix__group-header.is-sort-active::after {
  position: absolute;
  right: 8px;
  bottom: -7px;
  left: 8px;
  height: 2px;
  background: var(--bq-color-primary);
  content: "";
}

.cost-analysis-matrix__baseline-missing {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: var(--bq-color-text-muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-analysis-matrix__group-title,
.cost-analysis-matrix__column-title {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
}

.cost-analysis-matrix__group-title {
  font-size: var(--bq-font-table, 15px);
  font-weight: 600;
}

.cost-analysis-matrix__sort-trigger {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0 24px 0 12px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--bq-color-text);
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  letter-spacing: 0;
}

.cost-analysis-matrix__sort-icon {
  position: absolute;
  right: 7px;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  opacity: 0.35;
  transition:
    color 0.16s ease,
    opacity 0.16s ease;
}

.cost-analysis-matrix__sort-trigger:hover,
.cost-analysis-matrix__sort-trigger:focus-visible {
  background: transparent;
  color: var(--bq-color-primary-active);
  outline: 2px solid
    color-mix(in srgb, var(--bq-color-primary) 40%, transparent);
  outline-offset: -2px;
}

.cost-analysis-matrix__sort-trigger:hover .cost-analysis-matrix__sort-icon,
.cost-analysis-matrix__sort-trigger:focus-visible
  .cost-analysis-matrix__sort-icon {
  color: var(--bq-color-primary-active);
  opacity: 0.85;
}

.cost-analysis-matrix__sort-trigger.is-active {
  background: transparent;
  box-shadow: inset 0 -2px 0 var(--bq-color-primary);
  color: var(--bq-color-primary-active);
  font-weight: 600;
}

.cost-analysis-matrix__sort-trigger.is-active .cost-analysis-matrix__sort-icon {
  color: var(--bq-color-primary-active);
  opacity: 1;
}

.cost-analysis-matrix__sort-trigger.has-baseline-marker {
  padding-left: 50px;
}

.cost-analysis-matrix__baseline-marker {
  position: absolute;
  left: 5px;
  display: inline-flex;
  height: 18px;
  align-items: center;
  padding: 0 5px;
  border: 1px solid color-mix(in srgb, var(--bq-color-primary) 48%, transparent);
  border-radius: 3px;
  background: var(--bq-color-primary-soft);
  color: var(--bq-color-primary-active);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
}

.cost-analysis-matrix__sort-menu-item {
  display: grid;
  width: 224px;
  grid-template-columns: 16px minmax(0, 1fr) 16px;
  gap: 8px;
  align-items: start;
}

.cost-analysis-matrix__sort-menu-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.cost-analysis-matrix__sort-menu-label {
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.cost-analysis-matrix__sort-menu-help {
  color: var(--bq-color-text-muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}

.cost-analysis-matrix__sort-menu-check {
  color: var(--bq-color-primary-active);
}

:global(.cost-analysis-matrix__sort-popper) {
  z-index: 2100 !important;
}

.cost-analysis-matrix__column-header {
  display: grid;
  min-width: 0;
  gap: 0;
}

.cost-analysis-matrix__column-title {
  color: var(--bq-color-text);
  font-weight: 500;
}

.cost-analysis-matrix__cell {
  position: relative;
  min-height: 38px;
  padding: 14px 8px 2px;
  line-height: 22px;
  text-align: center;
  white-space: nowrap;
}

.cost-analysis-matrix__difference-badge {
  position: absolute;
  z-index: 1;
  top: 1px;
  right: 4px;
  max-width: calc(100% - 8px);
  padding: 0 4px;
  overflow: hidden;
  border: 0;
  border-radius: 3px;
  background: color-mix(
    in srgb,
    var(--bq-color-info-soft) 72%,
    var(--bq-color-surface)
  );
  color: var(--bq-color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  font-weight: 400;
  line-height: 14px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-analysis-matrix__difference-badge.is-increase {
  background: color-mix(
    in srgb,
    var(--bq-color-danger-soft) 64%,
    var(--bq-color-surface)
  );
  color: var(--bq-color-danger);
}

.cost-analysis-matrix__difference-badge.is-decrease {
  background: color-mix(
    in srgb,
    var(--bq-color-success-soft) 64%,
    var(--bq-color-surface)
  );
  color: var(--bq-color-success);
}

.cost-analysis-matrix__difference-badge.is-neutral {
  background: color-mix(
    in srgb,
    var(--bq-color-bg-muted) 72%,
    var(--bq-color-surface)
  );
  color: var(--bq-color-text-muted);
}

.cost-analysis-matrix__difference-badge.is-static {
  cursor: default;
}

button.cost-analysis-matrix__difference-badge:hover,
button.cost-analysis-matrix__difference-badge:focus-visible {
  text-decoration: underline;
  text-underline-offset: 2px;
  outline: none;
}

button.cost-analysis-matrix__difference-badge:focus-visible {
  box-shadow:
    0 0 0 1px var(--bq-color-surface),
    0 0 0 3px var(--bq-color-primary);
}

.cost-analysis-matrix__difference-action {
  display: inline-block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--bq-color-primary-active);
  cursor: pointer;
  font: inherit;
  font-variant-numeric: inherit;
  font-weight: inherit;
  letter-spacing: 0;
  text-align: center;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
}

.cost-analysis-matrix__difference-action:hover,
.cost-analysis-matrix__difference-action:focus-visible {
  text-decoration-color: currentcolor;
}

.cost-analysis-matrix__difference-action:focus-visible {
  outline: 2px solid var(--bq-color-primary);
  outline-offset: 2px;
}

.cost-analysis-matrix__variance-action {
  color: inherit;
}

.cost-analysis-matrix__variance--primary {
  color: var(--bq-color-primary);
}

.cost-analysis-matrix__numeric-value {
  width: 100%;
  text-align: center;
}

.cost-analysis-matrix__empty {
  color: var(--bq-color-text-muted);
  text-align: center;
}

.cost-analysis-matrix__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 760px) {
  .cost-analysis-matrix__diff-context {
    flex-wrap: wrap;
  }

  .cost-analysis-matrix__diff-object {
    max-width: calc(50% - 16px);
  }

  .cost-analysis-matrix__diff-formula {
    flex-basis: 100%;
    padding-inline-start: 0;
    margin-inline-start: 0;
    border-inline-start: 0;
  }
}
</style>
