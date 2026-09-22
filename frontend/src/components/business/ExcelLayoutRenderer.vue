<script setup lang="ts">
import { computed, type CSSProperties } from "vue";

type ExcelColor =
  | string
  | {
      argb?: string;
      rgb?: string;
    };

type ExcelBorderSide = {
  style?: string;
  color?: ExcelColor;
};

type ExcelLayoutCell = {
  row: number;
  column: number;
  address?: string;
  value?: string | number | boolean | null;
  rowspan?: number;
  colspan?: number;
  style?: {
    font?: {
      name?: string;
      size?: number;
      bold?: boolean | string | number;
      italic?: boolean | string | number;
      underline?: boolean;
      color?: ExcelColor;
    };
    fill?: {
      color?: ExcelColor;
      fgColor?: ExcelColor;
    };
    alignment?: {
      horizontal?: string;
      vertical?: string;
      wrapText?: boolean;
    };
    border?: Record<
      "top" | "right" | "bottom" | "left",
      ExcelBorderSide | undefined
    >;
    numFmt?: string;
    bold?: boolean | string | number;
    italic?: boolean | string | number;
    textAlign?: string;
    align?: string;
    horizontal?: string;
    backgroundColor?: ExcelColor;
    fillColor?: ExcelColor;
    bgColor?: ExcelColor;
    textColor?: ExcelColor;
    fontColor?: ExcelColor;
    color?: ExcelColor;
  };
};

type ExcelLayoutSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  columns?: Array<{ index: number; key?: string; width?: number }>;
  rows?: Array<{ index: number; height?: number }>;
  cells?: ExcelLayoutCell[];
};

const props = defineProps<{
  sheet?: ExcelLayoutSheet | null;
  maxHeight?: string;
}>();

const tableStyle = computed<CSSProperties>(() => ({
  maxHeight: props.maxHeight ?? "100%",
}));

const cellsByRow = computed(() => {
  const rows = new Map<number, ExcelLayoutCell[]>();
  (props.sheet?.cells ?? []).forEach((cell) => {
    const rowCells = rows.get(cell.row) ?? [];
    rowCells.push(cell);
    rows.set(cell.row, rowCells);
  });
  rows.forEach((rowCells) =>
    rowCells.sort((left, right) => left.column - right.column),
  );
  return rows;
});

const rowIndexes = computed(() =>
  Array.from({ length: props.sheet?.rowCount ?? 0 }, (_, index) => index + 1),
);

const columnDefinitions = computed(() =>
  Array.from({ length: props.sheet?.columnCount ?? 0 }, (_, index) => {
    const columnIndex = index + 1;
    return (
      props.sheet?.columns?.find((column) => column.index === columnIndex) ?? {
        index: columnIndex,
        width: 12,
      }
    );
  }),
);

function getRowCells(rowIndex: number) {
  return cellsByRow.value.get(rowIndex) ?? [];
}

function getRowStyle(rowIndex: number): CSSProperties {
  const row = props.sheet?.rows?.find((item) => item.index === rowIndex);
  return {
    height: row?.height ? `${row.height}px` : undefined,
  };
}

function getColumnWidth(width: number | undefined) {
  return `${Math.max(48, Math.round((width ?? 12) * 7))}px`;
}

function getCellStyle(cell: ExcelLayoutCell): CSSProperties {
  const style = cell.style ?? {};
  const font = style.font ?? {};
  const alignment = style.alignment ?? {};
  const textColor = firstColor(
    font.color,
    style.textColor,
    style.fontColor,
    style.color,
  );
  const backgroundColor = firstColor(
    style.fill?.color,
    style.fill?.fgColor,
    style.backgroundColor,
    style.fillColor,
    style.bgColor,
  );
  return {
    minWidth: getColumnWidth(
      props.sheet?.columns?.find((column) => column.index === cell.column)
        ?.width,
    ),
    width: getColumnWidth(
      props.sheet?.columns?.find((column) => column.index === cell.column)
        ?.width,
    ),
    fontFamily: font.name,
    fontSize: font.size ? `${font.size}px` : undefined,
    fontWeight: toBoolean(font.bold ?? style.bold) ? 600 : undefined,
    fontStyle: toBoolean(font.italic ?? style.italic) ? "italic" : undefined,
    textDecoration: font.underline ? "underline" : undefined,
    color: textColor,
    backgroundColor,
    textAlign: normalizeHorizontal(
      alignment.horizontal ??
        style.textAlign ??
        style.align ??
        style.horizontal,
    ),
    verticalAlign: normalizeVertical(alignment.vertical),
    whiteSpace: alignment.wrapText ? "normal" : "nowrap",
    borderTop: toBorderCss(style.border?.top),
    borderRight: toBorderCss(style.border?.right),
    borderBottom: toBorderCss(style.border?.bottom),
    borderLeft: toBorderCss(style.border?.left),
  };
}

function normalizeHorizontal(
  value: string | undefined,
): CSSProperties["textAlign"] {
  if (value === "center" || value === "right" || value === "left") {
    return value;
  }
  return "left";
}

function normalizeVertical(
  value: string | undefined,
): CSSProperties["verticalAlign"] {
  if (value === "top" || value === "middle" || value === "bottom") {
    return value;
  }
  return "middle";
}

function toBorderCss(border: ExcelBorderSide | undefined) {
  if (!border?.style) {
    return "1px solid #dcdfe6";
  }
  const width = border.style === "thick" ? 2 : 1;
  return `${width}px solid ${normalizeColor(border.color) ?? "#2f3542"}`;
}

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function firstColor(...values: unknown[]) {
  for (const value of values) {
    const color = normalizeColor(value);
    if (color) {
      return color;
    }
  }
  return undefined;
}

function normalizeColor(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === "object") {
    const color = value as { argb?: unknown; rgb?: unknown };
    return normalizeColor(color.argb ?? color.rgb);
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const color = value.trim();
  if (!color) {
    return undefined;
  }
  if (color.startsWith("#")) {
    return color;
  }
  if (/^[0-9A-Fa-f]{6}$/.test(color)) {
    return `#${color}`;
  }
  if (/^[0-9A-Fa-f]{8}$/.test(color)) {
    return `#${color.slice(-6)}`;
  }
  if (/^(rgb|rgba|hsl|hsla)\(/i.test(color)) {
    return color;
  }
  return undefined;
}

function formatValue(value: ExcelLayoutCell["value"]) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}
</script>

<template>
  <div class="excel-layout-renderer" :style="tableStyle">
    <table v-if="sheet" class="excel-layout-renderer__table">
      <colgroup>
        <col
          v-for="column in columnDefinitions"
          :key="column.index"
          :style="{ width: getColumnWidth(column.width) }"
        />
      </colgroup>
      <tbody>
        <tr
          v-for="rowIndex in rowIndexes"
          :key="rowIndex"
          :style="getRowStyle(rowIndex)"
        >
          <td
            v-for="cell in getRowCells(rowIndex)"
            :key="cell.address || `${cell.row}-${cell.column}`"
            :rowspan="cell.rowspan || 1"
            :colspan="cell.colspan || 1"
            :style="getCellStyle(cell)"
          >
            {{ formatValue(cell.value) }}
          </td>
        </tr>
      </tbody>
    </table>
    <el-empty v-else description="当前模板没有 Excel 还原布局" />
  </div>
</template>

<style scoped>
.excel-layout-renderer {
  max-width: 100%;
  overflow: auto;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 6px;
}

.excel-layout-renderer__table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 14px;
}

.excel-layout-renderer__table td {
  min-height: 28px;
  padding: 4px 6px;
  overflow: hidden;
  line-height: 1.35;
  text-overflow: ellipsis;
}
</style>
