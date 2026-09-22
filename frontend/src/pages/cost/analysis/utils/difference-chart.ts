import type {
  CostAnalysisDifferenceDetailResult,
  CostAnalysisDifferenceDetailRow,
} from "@/types/cost-analysis";
import { formatMoney, formatPercent } from "@/utils/formatters";

export type CostAnalysisDifferenceChartMode = "SHARE" | "DIRECTION";

export type CostAnalysisDifferenceChartAction =
  | "DRILL"
  | "LOCATE_PART"
  | "SHOW_ALL_PARTS"
  | "NONE";

export interface CostAnalysisDifferenceChartItem {
  key: string;
  name: string;
  row: CostAnalysisDifferenceDetailRow | null;
  difference: number;
  absoluteDifference: number;
  movementShare: number | null;
  clickable: boolean;
  other: boolean;
  action: CostAnalysisDifferenceChartAction;
}

export interface CostAnalysisDifferenceChartTokens {
  primary: string;
  orange: string;
  cyan: string;
  success: string;
  warning: string;
  danger: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
}

const MAX_SHARE_ITEMS = 6;
const VISIBLE_SHARE_ROWS = 5;

function itemAction(
  result: CostAnalysisDifferenceDetailResult,
  row: CostAnalysisDifferenceDetailRow,
): CostAnalysisDifferenceChartAction {
  if (result.drillLevel === "PART") return "LOCATE_PART";
  return row.objectType === "CATEGORY" && row.hasChildren ? "DRILL" : "NONE";
}

function toChartItem(
  result: CostAnalysisDifferenceDetailResult,
  row: CostAnalysisDifferenceDetailRow,
  total: number,
): CostAnalysisDifferenceChartItem {
  const difference = row.difference ?? 0;
  const action = itemAction(result, row);
  return {
    key: row.objectId,
    name: row.objectName,
    row,
    difference,
    absoluteDifference: Math.abs(difference),
    movementShare: total === 0 ? null : Math.abs(difference) / total,
    clickable: action !== "NONE",
    other: false,
    action,
  };
}

function sortRows(
  rows: CostAnalysisDifferenceDetailRow[],
): CostAnalysisDifferenceDetailRow[] {
  return [...rows].sort(
    (left, right) =>
      Math.abs(right.difference ?? 0) - Math.abs(left.difference ?? 0) ||
      left.objectCode.localeCompare(right.objectCode),
  );
}

function otherItem(
  difference: number,
  absoluteDifference: number,
  total: number,
  action: CostAnalysisDifferenceChartAction = "NONE",
): CostAnalysisDifferenceChartItem {
  return {
    key: "__other__",
    name: "其他",
    row: null,
    difference,
    absoluteDifference,
    movementShare: total === 0 ? null : absoluteDifference / total,
    clickable: action !== "NONE",
    other: true,
    action,
  };
}

function otherItemAction(
  result: CostAnalysisDifferenceDetailResult,
): CostAnalysisDifferenceChartAction {
  return result.drillLevel === "PART" ? "SHOW_ALL_PARTS" : "NONE";
}

export function resolveDefaultDifferenceChartMode(): CostAnalysisDifferenceChartMode {
  return "DIRECTION";
}

export function buildDifferenceShareItems(
  result: CostAnalysisDifferenceDetailResult,
): CostAnalysisDifferenceChartItem[] {
  const total = result.visualization.absoluteDifferenceTotal ?? 0;
  if (total === 0) return [];

  const sortedRows = sortRows(result.rows).filter(
    (row) => row.difference !== null && row.difference !== 0,
  );
  if (
    sortedRows.length <= MAX_SHARE_ITEMS &&
    (result.visualization.otherAbsoluteDifference ?? 0) === 0
  ) {
    return sortedRows.map((row) => toChartItem(result, row, total));
  }

  const visibleRows = sortedRows.slice(0, VISIBLE_SHARE_ROWS);
  const omittedRows = sortedRows.slice(VISIBLE_SHARE_ROWS);
  const omittedDifference = omittedRows.reduce(
    (sum, row) => sum + (row.difference ?? 0),
    0,
  );
  const omittedAbsoluteDifference = omittedRows.reduce(
    (sum, row) => sum + Math.abs(row.difference ?? 0),
    0,
  );
  const otherDifference =
    omittedDifference + (result.summary.otherDifference ?? 0);
  const otherAbsoluteDifference =
    omittedAbsoluteDifference +
    (result.visualization.otherAbsoluteDifference ?? 0);

  return [
    ...visibleRows.map((row) => toChartItem(result, row, total)),
    ...(otherAbsoluteDifference > 0
      ? [
          otherItem(
            otherDifference,
            otherAbsoluteDifference,
            total,
            otherItemAction(result),
          ),
        ]
      : []),
  ];
}

export function buildDifferenceDirectionItems(
  result: CostAnalysisDifferenceDetailResult,
): CostAnalysisDifferenceChartItem[] {
  const total = result.visualization.absoluteDifferenceTotal ?? 0;
  const items = sortRows(result.rows)
    .filter((row) => row.difference !== null && row.difference !== 0)
    .map((row) => toChartItem(result, row, total));
  const otherAbsoluteDifference =
    result.visualization.otherAbsoluteDifference ?? 0;

  return [
    ...items,
    ...(otherAbsoluteDifference > 0
      ? [
          otherItem(
            result.summary.otherDifference ?? 0,
            otherAbsoluteDifference,
            total,
            otherItemAction(result),
          ),
        ]
      : []),
  ];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMetricValue(
  value: number | null,
  result: CostAnalysisDifferenceDetailResult,
): string {
  if (value === null) return "--";
  return result.context.metric === "MIX"
    ? formatPercent(value)
    : formatMoney(value);
}

function directionLabel(
  item: CostAnalysisDifferenceChartItem,
  result: CostAnalysisDifferenceDetailResult,
): string {
  if (result.context.traceType === "COST_VARIANCE") {
    return item.difference >= 0 ? "超目标" : "低于目标";
  }
  return item.difference >= 0 ? "增加" : "减少";
}

function tooltipHtml(
  item: CostAnalysisDifferenceChartItem,
  result: CostAnalysisDifferenceDetailResult,
): string {
  const baselineLabel =
    result.context.traceType === "COST_VARIANCE" ? "目标成本" : "基准值";
  const comparisonLabel =
    result.context.traceType === "COST_VARIANCE" ? "当前成本" : "当前对比值";
  const differenceLabel =
    result.context.traceType === "COST_VARIANCE" ? "超差" : "差异";
  const lines = [
    `<strong>${escapeHtml(item.name)}</strong>`,
    `方向：${directionLabel(item, result)}`,
  ];
  if (item.row) {
    lines.push(
      `${baselineLabel}：${formatMetricValue(item.row.baselineValue, result)}`,
      `${comparisonLabel}：${formatMetricValue(item.row.comparisonValue, result)}`,
    );
  }
  lines.push(
    `${differenceLabel}：${formatMetricValue(item.difference, result)}`,
    `变动规模占比：${formatPercent(item.movementShare)}`,
  );
  if (
    item.row?.contributionRate !== null &&
    item.row?.contributionRate !== undefined
  ) {
    lines.push(`贡献率：${formatPercent(item.row.contributionRate)}`);
  }
  return lines.join("<br />");
}

function signedMetricValue(
  value: number,
  result: CostAnalysisDifferenceDetailResult,
): string {
  const formatted = formatMetricValue(Math.abs(value), result);
  if (value === 0) return formatted;
  return `${value > 0 ? "+" : "-"}${formatted}`;
}

function directionColor(
  item: CostAnalysisDifferenceChartItem,
  tokens: CostAnalysisDifferenceChartTokens,
): string {
  return item.difference >= 0 ? tokens.danger : tokens.success;
}

export function buildDifferencePieOption(
  result: CostAnalysisDifferenceDetailResult,
  items: CostAnalysisDifferenceChartItem[],
  tokens: CostAnalysisDifferenceChartTokens,
): Record<string, unknown> {
  const palette = [
    tokens.primary,
    tokens.orange,
    tokens.cyan,
    tokens.success,
    tokens.warning,
    tokens.textMuted,
  ];
  const itemMap = new Map(items.map((item) => [item.key, item]));

  return {
    animationDuration: 240,
    aria: {
      enabled: true,
      decal: { show: false },
    },
    title: {
      text: "总变动规模",
      subtext: `${formatMetricValue(
        result.visualization.absoluteDifferenceTotal,
        result,
      )}\n净差异 ${formatMetricValue(result.visualization.netDifference, result)}`,
      left: "center",
      top: "36%",
      textStyle: {
        color: tokens.textMuted,
        fontSize: 12,
        fontWeight: 400,
      },
      subtextStyle: {
        color: tokens.text,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 20,
      },
    },
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (params: { data?: { itemKey?: string } }) => {
        const item = itemMap.get(params.data?.itemKey ?? "");
        return item ? tooltipHtml(item, result) : "";
      },
    },
    series: [
      {
        name: "变动规模占比",
        type: "pie",
        radius: ["47%", "70%"],
        center: ["50%", "52%"],
        minAngle: 3,
        avoidLabelOverlap: true,
        selectedMode: false,
        label: {
          color: tokens.textSecondary,
          fontSize: 11,
          formatter: (params: {
            data?: { itemKey?: string };
            percent?: number;
          }) => {
            const item = itemMap.get(params.data?.itemKey ?? "");
            if (!item) return "";
            const percent = params.percent ?? 0;
            return percent < 5 ? "" : `${item.name}\n${percent.toFixed(1)}%`;
          },
        },
        labelLine: {
          length: 10,
          length2: 8,
          lineStyle: { color: tokens.border },
        },
        emphasis: {
          scaleSize: 5,
        },
        data: items.map((item, index) => ({
          value: item.absoluteDifference,
          name: item.name,
          itemKey: item.key,
          cursor: item.clickable ? "pointer" : "default",
          itemStyle: {
            color: item.other
              ? tokens.textMuted
              : palette[index % palette.length],
          },
        })),
      },
    ],
  };
}

function resolveBarItemLabel(
  item: CostAnalysisDifferenceChartItem,
  ratio: number,
  result: CostAnalysisDifferenceDetailResult,
  tokens: CostAnalysisDifferenceChartTokens,
) {
  const isNegative = item.difference < 0;
  const isLongNegative = isNegative && ratio >= 0.3;
  const isLongPositive = !isNegative && ratio >= 0.85;

  if (isLongNegative) {
    return {
      show: true,
      position: "insideLeft",
      distance: 6,
      color: "#ffffff",
      fontSize: 10,
      fontWeight: 500,
      textShadowColor: "rgba(0, 0, 0, 0.35)",
      textShadowBlur: 2,
      formatter: () => signedMetricValue(item.difference, result),
    };
  }

  if (isLongPositive) {
    return {
      show: true,
      position: "insideRight",
      distance: 6,
      color: "#ffffff",
      fontSize: 10,
      fontWeight: 500,
      textShadowColor: "rgba(0, 0, 0, 0.35)",
      textShadowBlur: 2,
      formatter: () => signedMetricValue(item.difference, result),
    };
  }

  return {
    show: true,
    position: "outside",
    color: tokens.textSecondary,
    fontSize: 10,
    formatter: () => signedMetricValue(item.difference, result),
  };
}

export function buildDifferenceBarOption(
  result: CostAnalysisDifferenceDetailResult,
  items: CostAnalysisDifferenceChartItem[],
  tokens: CostAnalysisDifferenceChartTokens,
): Record<string, unknown> {
  const itemMap = new Map(items.map((item) => [item.key, item]));
  const maxAbsDifference = Math.max(
    ...items.map((item) => Math.abs(item.difference)),
    1,
  );

  return {
    animationDuration: 220,
    aria: {
      enabled: true,
      decal: { show: false },
    },
    grid: {
      left: 128,
      right: 28,
      top: 12,
      bottom: 28,
      containLabel: false,
    },
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (params: { data?: { itemKey?: string } }) => {
        const item = itemMap.get(params.data?.itemKey ?? "");
        return item ? tooltipHtml(item, result) : "";
      },
    },
    xAxis: {
      type: "value",
      boundaryGap: ["10%", "10%"],
      axisLine: {
        show: true,
        lineStyle: { color: tokens.border },
      },
      axisLabel: {
        color: tokens.textMuted,
        fontSize: 10,
      },
      splitLine: {
        lineStyle: { color: tokens.border, type: "dashed" },
      },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: items.map((item) => item.name),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: tokens.textSecondary,
        fontSize: 11,
        width: 108,
        margin: 12,
        overflow: "truncate",
      },
    },
    series: [
      {
        name: "正负贡献",
        type: "bar",
        barMaxWidth: 18,
        data: items.map((item) => {
          const ratio = Math.abs(item.difference) / maxAbsDifference;
          return {
            value: item.difference,
            itemKey: item.key,
            cursor: item.clickable ? "pointer" : "default",
            label: resolveBarItemLabel(item, ratio, result, tokens),
            itemStyle: {
              color: directionColor(item, tokens),
              borderRadius:
                item.difference >= 0 ? [0, 2, 2, 0] : [2, 0, 0, 2],
            },
          };
        }),
      },
    ],
  };
}
