<script setup lang="ts">
import { computed } from "vue";
import type { CSSProperties } from "vue";
import type { TableCellSchema, TableSheetSchema } from "@/types/custom-table";

const props = withDefaults(
  defineProps<{
    sheet: TableSheetSchema;
    selectedRow?: number;
    selectedColumn?: number;
    selectedRange?: {
      startRow: number;
      endRow: number;
      startColumn: number;
      endColumn: number;
    };
    readonly?: boolean;
  }>(),
  {
    selectedRow: undefined,
    selectedColumn: undefined,
    selectedRange: undefined,
    readonly: false,
  },
);

defineEmits<{
  selectCell: [row: number, column: number, extend: boolean];
  editCell: [row: number, column: number];
}>();

const visibleRows = computed(() =>
  Array.from(
    { length: Math.min(props.sheet.rowCount, 100) },
    (_, index) => index,
  ).filter((index) => !props.sheet.hiddenRows.includes(index)),
);
const visibleColumns = computed(() =>
  Array.from(
    { length: Math.min(props.sheet.columnCount, 30) },
    (_, index) => index,
  ).filter((index) => !props.sheet.hiddenColumns.includes(index)),
);
const cellMap = computed(
  () =>
    new Map(
      props.sheet.cells.map((cell) => [`${cell.row}:${cell.column}`, cell]),
    ),
);

function findMergeRegion(row: number, column: number) {
  return props.sheet.mergeRegions.find(
    (region) =>
      row >= region.startRow &&
      row <= region.endRow &&
      column >= region.startColumn &&
      column <= region.endColumn,
  );
}

function isMergeMaster(row: number, column: number) {
  const region = findMergeRegion(row, column);
  return (
    Boolean(region) &&
    region?.startRow === row &&
    region?.startColumn === column
  );
}

function isMergeCovered(row: number, column: number) {
  const region = findMergeRegion(row, column);
  return Boolean(region) && !isMergeMaster(row, column);
}

function isInSelectedRange(row: number, column: number) {
  if (!props.selectedRange) return false;
  const startRow = Math.min(
    props.selectedRange.startRow,
    props.selectedRange.endRow,
  );
  const endRow = Math.max(
    props.selectedRange.startRow,
    props.selectedRange.endRow,
  );
  const startColumn = Math.min(
    props.selectedRange.startColumn,
    props.selectedRange.endColumn,
  );
  const endColumn = Math.max(
    props.selectedRange.startColumn,
    props.selectedRange.endColumn,
  );
  return (
    row >= startRow &&
    row <= endRow &&
    column >= startColumn &&
    column <= endColumn
  );
}

function columnLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value--;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function dimensionSize(
  dimensions: Array<{ index: number; size: number }>,
  index: number,
  fallback: number,
) {
  return dimensions.find((item) => item.index === index)?.size ?? fallback;
}

function gridColumns(value: TableSheetSchema) {
  return `44px ${visibleColumns.value
    .map((column) => `${dimensionSize(value.columnWidths, column, 120)}px`)
    .join(" ")}`;
}

function rowStyle(row: number) {
  return { minHeight: `${dimensionSize(props.sheet.rowHeights, row, 34)}px` };
}

function cellStyle(row: number, column: number) {
  const cell = cellMap.value.get(`${row}:${column}`);
  const style = cell?.style;
  const horizontalAlignment =
    style?.horizontalAlignment === "center" ||
    style?.horizontalAlignment === "right" ||
    style?.horizontalAlignment === "left"
      ? style.horizontalAlignment
      : undefined;
  const verticalAlignment =
    style?.verticalAlignment === "middle"
      ? "center"
      : style?.verticalAlignment === "bottom"
        ? "flex-end"
        : undefined;
  return {
    ...rowStyle(row),
    backgroundColor: style?.fillColor || undefined,
    color: style?.fontColor || undefined,
    fontWeight: style?.bold ? 700 : undefined,
    fontStyle: style?.italic ? "italic" : undefined,
    fontSize: style?.fontSize ? `${style.fontSize}px` : undefined,
    textAlign: horizontalAlignment,
    alignItems: verticalAlignment,
  } satisfies CSSProperties;
}

function displayValue(cell?: TableCellSchema) {
  if (!cell) return "";
  if (cell.binding.type === "STATIC") return cell.staticValue ?? "";
  return `{{ ${cell.binding.key ?? ""} }}`;
}
</script>

<template>
  <div class="sheet-scroll">
    <div
      class="sheet-grid"
      :style="{ gridTemplateColumns: gridColumns(sheet) }"
    >
      <div class="corner" />
      <div v-for="column in visibleColumns" :key="column" class="column-head">
        {{ columnLabel(column) }}
      </div>
      <template v-for="row in visibleRows" :key="row">
        <div class="row-head" :style="rowStyle(row)">{{ row + 1 }}</div>
        <button
          v-for="column in visibleColumns"
          :key="`${row}-${column}`"
          type="button"
          class="cell"
          :style="cellStyle(row, column)"
          :class="{
            bound: cellMap.get(`${row}:${column}`)?.binding.type !== 'STATIC',
            wrap: cellMap.get(`${row}:${column}`)?.style?.wrapText,
            selected: row === selectedRow && column === selectedColumn,
            'range-selected': isInSelectedRange(row, column),
            'merged-master': isMergeMaster(row, column),
            'merged-covered': isMergeCovered(row, column),
          }"
          :disabled="readonly"
          :title="`${columnLabel(column)}${row + 1}`"
          @click="$emit('selectCell', row, column, $event.shiftKey)"
          @dblclick="$emit('editCell', row, column)"
        >
          {{ displayValue(cellMap.get(`${row}:${column}`)) }}
        </button>
      </template>
    </div>
    <el-alert
      v-if="
        sheet.rowCount > visibleRows.length ||
        sheet.columnCount > visibleColumns.length
      "
      type="info"
      :closable="false"
      title="画布仅显示前100行和30列，完整结构会随模板保存和导出。"
    />
  </div>
</template>

<style scoped>
.sheet-scroll {
  height: 100%;
  overflow: auto;
}
.sheet-grid {
  display: grid;
  width: max-content;
  min-width: 100%;
  background: white;
  border-top: 1px solid var(--el-border-color);
  border-left: 1px solid var(--el-border-color);
}
.corner,
.column-head,
.row-head,
.cell {
  min-height: 34px;
  border: 0;
  border-right: 1px solid var(--el-border-color);
  border-bottom: 1px solid var(--el-border-color);
  box-sizing: border-box;
}
.column-head,
.row-head {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f2f3f5;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.cell {
  padding: 5px 8px;
  overflow: hidden;
  background: white;
  color: var(--el-text-color-primary);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.cell.wrap {
  white-space: normal;
  word-break: break-word;
}
.cell:hover:not(:disabled) {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}
.cell.selected {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
  box-shadow: inset 0 0 0 1px var(--el-color-primary);
}
.cell.range-selected {
  background-image: linear-gradient(
    rgb(78 143 253 / 10%),
    rgb(78 143 253 / 10%)
  );
}
.cell.bound {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.cell.merged-master {
  position: relative;
  box-shadow: inset 0 0 0 2px var(--el-color-warning);
}
.cell.merged-master::after {
  position: absolute;
  right: 4px;
  bottom: 2px;
  color: var(--el-color-warning);
  font-size: 11px;
  content: "合并";
}
.cell.merged-covered {
  color: transparent;
  background-image: repeating-linear-gradient(
    -45deg,
    rgb(0 0 0 / 3%) 0,
    rgb(0 0 0 / 3%) 6px,
    transparent 6px,
    transparent 12px
  );
}
.cell:disabled {
  cursor: default;
}
</style>
