<script setup lang="ts">
import { BaseToast } from "@/components/base/BaseToast";
import { computed, onDeactivated, reactive, ref, watch } from "vue";
import type {
  TableCellSchema,
  TableSheetSchema,
  TableValueType,
} from "@/types/custom-table";
import DesignerToolbar from "./DesignerToolbar.vue";
import CellInspector from "./CellInspector.vue";
import SheetCanvas from "./SheetCanvas.vue";
import SheetTabBar from "./SheetTabBar.vue";
import SheetFormulaBar from "./SheetFormulaBar.vue";
import DesignerStatusBar from "./DesignerStatusBar.vue";
import {
  copySelection,
  deleteColumns,
  deleteRows,
  insertColumns,
  insertRows,
  mergeSelection,
  pasteSelection,
  unmergeSelection,
} from "../utils/table-sheet";
import type { CellRange, CopiedSelection } from "../utils/table-sheet";
import {
  designerCommands,
  type DesignerCommand,
} from "../composables/useDesignerCommands";

const props = withDefaults(
  defineProps<{
    sheets: TableSheetSchema[];
    providerFields: Array<{
      key: string;
      label: string;
      valueType: TableValueType;
    }>;
    formulas: Array<{ key: string; expression: string }>;
    readonly?: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    saveStatus?: string;
  }>(),
  { readonly: false, canUndo: false, canRedo: false, saveStatus: "已同步" },
);
const emit = defineEmits<{
  updateSheet: [sheetIndex: number, sheet: TableSheetSchema];
  activeSheetChange: [sheetName: string];
  executeCommand: [command: DesignerCommand];
  undo: [];
  redo: [];
  setRequired: [sheetIndex: number, range: CellRange];
  openInspector: [tab: "properties" | "rules" | "permissions"];
}>();
const activeSheet = ref(0);
const dialogOpen = ref(false);

onDeactivated(() => {
  dialogOpen.value = false;
});
const copiedSelection = ref<CopiedSelection>();
const structure = reactive({
  rowCount: 1,
  columnCount: 1,
  frozenRows: 0,
  frozenColumns: 0,
  hiddenRowsText: "",
  hiddenColumnsText: "",
  rowHeightIndex: 1,
  rowHeightSize: 34,
  columnWidthIndex: 1,
  columnWidthSize: 120,
  mergeStartRow: 1,
  mergeEndRow: 1,
  mergeStartColumn: 1,
  mergeEndColumn: 1,
});
const selected = reactive<TableCellSchema>({
  row: 0,
  column: 0,
  valueType: "TEXT",
  staticValue: "",
  binding: { type: "STATIC", key: null },
  style: null,
});
const formulaBarValue = computed({
  get: () =>
    selected.binding.type === "FORMULA"
      ? `=${selected.binding.key ?? ""}`
      : String(selected.staticValue ?? ""),
  set: (value: string) => {
    if (value.startsWith("=")) {
      selected.binding = { type: "FORMULA", key: value.slice(1).trim() };
      selected.valueType = "DECIMAL";
      selected.staticValue = null;
      return;
    }
    selected.binding = { type: "STATIC", key: null };
    selected.valueType = "TEXT";
    selected.staticValue = value;
  },
});
const selectedRange = reactive({
  startRow: 0,
  endRow: 0,
  startColumn: 0,
  endColumn: 0,
});
const sheet = computed(() => props.sheets[activeSheet.value]);
const cellMap = computed(
  () =>
    new Map(
      (sheet.value?.cells ?? []).map((cell) => [
        `${cell.row}:${cell.column}`,
        cell,
      ]),
    ),
);
function normalizedSelectedRange() {
  return {
    startRow: Math.min(selectedRange.startRow, selectedRange.endRow),
    endRow: Math.max(selectedRange.startRow, selectedRange.endRow),
    startColumn: Math.min(selectedRange.startColumn, selectedRange.endColumn),
    endColumn: Math.max(selectedRange.startColumn, selectedRange.endColumn),
  };
}
function isInSelectedRange(row: number, column: number) {
  const range = normalizedSelectedRange();
  return (
    row >= range.startRow &&
    row <= range.endRow &&
    column >= range.startColumn &&
    column <= range.endColumn
  );
}
watch(
  () => props.sheets.length,
  (length) => {
    if (activeSheet.value >= length) activeSheet.value = 0;
  },
);
watch(
  sheet,
  (value) => {
    if (!value) return;
    emit("activeSheetChange", value.name);
    structure.rowCount = value.rowCount;
    structure.columnCount = value.columnCount;
    structure.frozenRows = value.frozenRows;
    structure.frozenColumns = value.frozenColumns;
    structure.hiddenRowsText = toHumanIndexText(value.hiddenRows ?? []);
    structure.hiddenColumnsText = toHumanIndexText(value.hiddenColumns ?? []);
  },
  { immediate: true },
);
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
function toHumanIndexText(indexes: number[]) {
  return indexes.map((index) => String(index + 1)).join(",");
}
function parseHumanIndexes(text: string, max: number) {
  if (!text.trim()) return [];
  const values = text
    .split(/[,，\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item));
  return [
    ...new Set(
      values.map((item) => item - 1).filter((item) => item >= 0 && item < max),
    ),
  ];
}
function commitSheet(next: TableSheetSchema) {
  if (!sheet.value) return;
  emit("updateSheet", activeSheet.value, next);
}
function assignSelectedCell(row: number, column: number) {
  const cell = cellMap.value.get(`${row}:${column}`);
  Object.assign(selected, {
    row,
    column,
    valueType: cell?.valueType ?? "TEXT",
    staticValue: cell?.staticValue ?? "",
    binding: { ...(cell?.binding ?? { type: "STATIC", key: null }) },
    style: cell?.style ? { ...cell.style } : null,
  });
}
function editCell(row: number, column: number) {
  if (props.readonly) return;
  if (isInSelectedRange(row, column)) assignSelectedCell(row, column);
  else selectCell(row, column);
  dialogOpen.value = true;
}
function selectCell(row: number, column: number, extend = false) {
  if (props.readonly) return;
  if (extend) {
    selectedRange.endRow = row;
    selectedRange.endColumn = column;
  } else {
    selectedRange.startRow = row;
    selectedRange.endRow = row;
    selectedRange.startColumn = column;
    selectedRange.endColumn = column;
  }
  assignSelectedCell(row, column);
  structure.mergeStartRow =
    Math.min(selectedRange.startRow, selectedRange.endRow) + 1;
  structure.mergeEndRow =
    Math.max(selectedRange.startRow, selectedRange.endRow) + 1;
  structure.mergeStartColumn =
    Math.min(selectedRange.startColumn, selectedRange.endColumn) + 1;
  structure.mergeEndColumn =
    Math.max(selectedRange.startColumn, selectedRange.endColumn) + 1;
}
function saveCell() {
  if (!sheet.value || props.readonly) return;
  if (selected.binding.type === "PROVIDER_FIELD") {
    const field = props.providerFields.find(
      (item) => item.key === selected.binding.key,
    );
    if (field) selected.valueType = field.valueType;
    selected.staticValue = null;
  } else if (selected.binding.type === "FORMULA") {
    selected.valueType = "DECIMAL";
    selected.staticValue = null;
  } else {
    selected.binding.key = null;
  }
  const next = JSON.parse(JSON.stringify(sheet.value)) as TableSheetSchema;
  const cell = JSON.parse(JSON.stringify(selected)) as TableCellSchema;
  const index = next.cells.findIndex(
    (item) => item.row === cell.row && item.column === cell.column,
  );
  if (index >= 0) next.cells.splice(index, 1, cell);
  else next.cells.push(cell);
  if (selected.style) {
    const range = normalizedSelectedRange();
    const style = JSON.parse(JSON.stringify(selected.style)) as NonNullable<
      TableCellSchema["style"]
    >;
    for (let row = range.startRow; row <= range.endRow; row++) {
      for (
        let column = range.startColumn;
        column <= range.endColumn;
        column++
      ) {
        const cellIndex = next.cells.findIndex(
          (item) => item.row === row && item.column === column,
        );
        if (cellIndex >= 0) {
          next.cells[cellIndex].style = { ...style };
        } else {
          next.cells.push({
            row,
            column,
            valueType: "TEXT",
            staticValue: "",
            binding: { type: "STATIC", key: null },
            style: { ...style },
          });
        }
      }
    }
  }
  next.cells.sort(
    (left, right) => left.row - right.row || left.column - right.column,
  );
  commitSheet(next);
  dialogOpen.value = false;
}
function applyStructure() {
  if (!sheet.value || props.readonly) return;
  const next = JSON.parse(JSON.stringify(sheet.value)) as TableSheetSchema;
  next.rowCount = Math.max(
    1,
    Math.min(1_048_576, Number(structure.rowCount) || 1),
  );
  next.columnCount = Math.max(
    1,
    Math.min(16_384, Number(structure.columnCount) || 1),
  );
  next.frozenRows = Math.max(
    0,
    Math.min(next.rowCount, Number(structure.frozenRows) || 0),
  );
  next.frozenColumns = Math.max(
    0,
    Math.min(next.columnCount, Number(structure.frozenColumns) || 0),
  );
  next.hiddenRows = parseHumanIndexes(structure.hiddenRowsText, next.rowCount);
  next.hiddenColumns = parseHumanIndexes(
    structure.hiddenColumnsText,
    next.columnCount,
  );
  next.cells = next.cells.filter(
    (cell) => cell.row < next.rowCount && cell.column < next.columnCount,
  );
  commitSheet(next);
}
function upsertDimension(
  field: "rowHeights" | "columnWidths",
  humanIndex: number,
  size: number,
) {
  if (!sheet.value || props.readonly) return;
  const next = JSON.parse(JSON.stringify(sheet.value)) as TableSheetSchema;
  const index = Math.max(0, Number(humanIndex) - 1);
  const max = field === "rowHeights" ? next.rowCount : next.columnCount;
  if (index >= max) return;
  const dimensions = next[field];
  const existing = dimensions.findIndex((item) => item.index === index);
  const normalizedSize = Math.max(1, Number(size) || 1);
  if (existing >= 0)
    dimensions.splice(existing, 1, { index, size: normalizedSize });
  else dimensions.push({ index, size: normalizedSize });
  dimensions.sort((left, right) => left.index - right.index);
  commitSheet(next);
}
function addMergeRegion() {
  if (!sheet.value || props.readonly) return;
  try {
    commitSheet(
      mergeSelection(sheet.value, {
        startRow: Math.max(0, Number(structure.mergeStartRow) - 1),
        endRow: Math.max(0, Number(structure.mergeEndRow) - 1),
        startColumn: Math.max(0, Number(structure.mergeStartColumn) - 1),
        endColumn: Math.max(0, Number(structure.mergeEndColumn) - 1),
      }),
    );
  } catch (error) {
    BaseToast.error(error instanceof Error ? error.message : "合并失败");
  }
}
function mergeSelectedRange() {
  if (!sheet.value || props.readonly) return;
  try {
    commitSheet(
      mergeSelection(sheet.value, {
        startRow: selectedRange.startRow,
        endRow: selectedRange.endRow,
        startColumn: selectedRange.startColumn,
        endColumn: selectedRange.endColumn,
      }),
    );
  } catch (error) {
    BaseToast.error(error instanceof Error ? error.message : "合并失败");
  }
}
function removeMergeRegion(index: number) {
  if (!sheet.value || props.readonly) return;
  const next = JSON.parse(JSON.stringify(sheet.value)) as TableSheetSchema;
  next.mergeRegions.splice(index, 1);
  commitSheet(next);
}
function undoSheet() {
  emit("undo");
}
function redoSheet() {
  emit("redo");
}
function copyCurrentSelection() {
  if (!sheet.value) return;
  copiedSelection.value = copySelection(sheet.value, {
    startRow: selectedRange.startRow,
    endRow: selectedRange.endRow,
    startColumn: selectedRange.startColumn,
    endColumn: selectedRange.endColumn,
  });
  BaseToast.success("已复制当前选区");
}
function pasteCurrentSelection() {
  if (!sheet.value || !copiedSelection.value) {
    BaseToast.warning("请先复制单元格");
    return;
  }
  try {
    commitSheet(
      pasteSelection(
        sheet.value,
        selected.row,
        selected.column,
        copiedSelection.value,
      ),
    );
  } catch (error) {
    BaseToast.error(error instanceof Error ? error.message : "粘贴失败");
  }
}
function insertRowAtSelection() {
  if (!sheet.value) return;
  commitSheet(insertRows(sheet.value, selected.row, 1));
}
function insertColumnAtSelection() {
  if (!sheet.value) return;
  commitSheet(insertColumns(sheet.value, selected.column, 1));
}
function deleteRowAtSelection() {
  if (!sheet.value) return;
  commitSheet(deleteRows(sheet.value, selected.row, 1));
}
function deleteColumnAtSelection() {
  if (!sheet.value) return;
  commitSheet(deleteColumns(sheet.value, selected.column, 1));
}
function unmergeByStructure() {
  if (!sheet.value) return;
  commitSheet(
    unmergeSelection(sheet.value, {
      startRow: Math.max(0, Number(structure.mergeStartRow) - 1),
      endRow: Math.max(0, Number(structure.mergeEndRow) - 1),
      startColumn: Math.max(0, Number(structure.mergeStartColumn) - 1),
      endColumn: Math.max(0, Number(structure.mergeEndColumn) - 1),
    }),
  );
}
function clearSelectedRange() {
  if (!sheet.value || props.readonly) return;
  const range = normalizedSelectedRange();
  const next = JSON.parse(JSON.stringify(sheet.value)) as TableSheetSchema;
  next.cells = next.cells.filter(
    (cell) =>
      cell.row < range.startRow ||
      cell.row > range.endRow ||
      cell.column < range.startColumn ||
      cell.column > range.endColumn,
  );
  commitSheet(next);
}
function applyFormat(preset: "BOLD" | "CURRENCY" | "PERCENT") {
  if (!sheet.value || props.readonly) return;
  const range = normalizedSelectedRange();
  const next = JSON.parse(JSON.stringify(sheet.value)) as TableSheetSchema;
  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let column = range.startColumn; column <= range.endColumn; column++) {
      let cell = next.cells.find(
        (item) => item.row === row && item.column === column,
      );
      if (!cell) {
        cell = {
          row,
          column,
          valueType: "TEXT",
          staticValue: "",
          binding: { type: "STATIC", key: null },
          style: null,
        };
        next.cells.push(cell);
      }
      cell.style = {
        fillColor: null,
        fontColor: null,
        bold: false,
        italic: false,
        fontSize: null,
        horizontalAlignment: null,
        verticalAlignment: null,
        wrapText: false,
        dataFormat: null,
        ...(cell.style ?? {}),
        ...(preset === "BOLD" ? { bold: !cell.style?.bold } : {}),
        ...(preset === "CURRENCY" ? { dataFormat: "¥#,##0.00" } : {}),
        ...(preset === "PERCENT" ? { dataFormat: "0.00%" } : {}),
      };
    }
  }
  commitSheet(next);
}
function setSelectedRangeRequired() {
  if (props.readonly) return;
  emit("setRequired", activeSheet.value, normalizedSelectedRange());
}
function validateSheet() {
  if (!sheet.value) return;
  BaseToast.success(
    `当前工作表 ${sheet.value.name}：${sheet.value.rowCount} 行、${sheet.value.columnCount} 列、${sheet.value.cells.length} 个单元格`,
  );
}
function addSheet() {
  activeSheet.value = props.sheets.length;
  emit("executeCommand", designerCommands.addSheet());
}
function deleteActiveSheet(index: number) {
  activeSheet.value = Math.min(index, props.sheets.length - 2);
  emit("executeCommand", designerCommands.deleteSheet(index));
}
function renameActiveSheet(index: number, name: string) {
  emit("executeCommand", designerCommands.renameSheet(index, name));
}
function duplicateActiveSheet(index: number, name: string) {
  activeSheet.value = index + 1;
  emit("executeCommand", designerCommands.duplicateSheet(index, name));
}
</script>

<template>
  <div class="sheet-designer">
    <SheetTabBar
      v-if="sheets.length"
      :sheets="sheets"
      :active-index="activeSheet"
      :readonly="readonly"
      @update:active-index="activeSheet = $event"
      @add-sheet="addSheet"
      @delete-sheet="deleteActiveSheet"
      @rename-sheet="renameActiveSheet"
      @duplicate-sheet="duplicateActiveSheet"
    />
    <DesignerToolbar
      v-if="sheet && !readonly"
      :readonly="readonly"
      :can-undo="canUndo"
      :can-redo="canRedo"
      @undo="undoSheet"
      @redo="redoSheet"
      @copy="copyCurrentSelection"
      @paste="pasteCurrentSelection"
      @insert-row="insertRowAtSelection"
      @insert-column="insertColumnAtSelection"
      @delete-row="deleteRowAtSelection"
      @delete-column="deleteColumnAtSelection"
      @merge="mergeSelectedRange"
      @unmerge="unmergeByStructure"
      @clear="clearSelectedRange"
      @required="setSelectedRangeRequired"
      @format="applyFormat"
      @open-inspector="$emit('openInspector', $event)"
      @validate="validateSheet"
    />
    <div v-if="sheet && !readonly" class="sheet-tools">
      <el-form :model="structure" inline>
        <el-form-item label="行数">
          <el-input-number
            v-model="structure.rowCount"
            :min="1"
            :max="1048576"
            size="small"
          />
        </el-form-item>
        <el-form-item label="列数">
          <el-input-number
            v-model="structure.columnCount"
            :min="1"
            :max="16384"
            size="small"
          />
        </el-form-item>
        <el-form-item label="冻结行">
          <el-input-number
            v-model="structure.frozenRows"
            :min="0"
            :max="structure.rowCount"
            size="small"
          />
        </el-form-item>
        <el-form-item label="冻结列">
          <el-input-number
            v-model="structure.frozenColumns"
            :min="0"
            :max="structure.columnCount"
            size="small"
          />
        </el-form-item>
        <el-form-item label="隐藏行">
          <el-input
            v-model="structure.hiddenRowsText"
            placeholder="如 2,5,8"
            size="small"
          />
        </el-form-item>
        <el-form-item label="隐藏列">
          <el-input
            v-model="structure.hiddenColumnsText"
            placeholder="如 3,6"
            size="small"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="small" @click="applyStructure"
            >应用结构</el-button
          >
        </el-form-item>
      </el-form>
      <el-form :model="structure" inline>
        <el-form-item label="行高">
          <el-input-number
            v-model="structure.rowHeightIndex"
            :min="1"
            :max="structure.rowCount"
            size="small"
          />
          <el-input-number
            v-model="structure.rowHeightSize"
            :min="1"
            :max="409"
            size="small"
          />
          <el-button
            size="small"
            @click="
              upsertDimension(
                'rowHeights',
                structure.rowHeightIndex,
                structure.rowHeightSize,
              )
            "
            >设置</el-button
          >
        </el-form-item>
        <el-form-item label="列宽">
          <el-input-number
            v-model="structure.columnWidthIndex"
            :min="1"
            :max="structure.columnCount"
            size="small"
          />
          <el-input-number
            v-model="structure.columnWidthSize"
            :min="1"
            :max="2048"
            size="small"
          />
          <el-button
            size="small"
            @click="
              upsertDimension(
                'columnWidths',
                structure.columnWidthIndex,
                structure.columnWidthSize,
              )
            "
            >设置</el-button
          >
        </el-form-item>
        <el-form-item label="合并区域">
          <el-input-number
            v-model="structure.mergeStartRow"
            :min="1"
            :max="structure.rowCount"
            size="small"
          />
          <el-input-number
            v-model="structure.mergeEndRow"
            :min="1"
            :max="structure.rowCount"
            size="small"
          />
          <el-input-number
            v-model="structure.mergeStartColumn"
            :min="1"
            :max="structure.columnCount"
            size="small"
          />
          <el-input-number
            v-model="structure.mergeEndColumn"
            :min="1"
            :max="structure.columnCount"
            size="small"
          />
          <el-button size="small" @click="addMergeRegion">添加</el-button>
        </el-form-item>
      </el-form>
      <div v-if="sheet.mergeRegions.length" class="merge-list">
        <el-tag
          v-for="(region, index) in sheet.mergeRegions"
          :key="`${region.startRow}-${region.startColumn}-${index}`"
          closable
          @close="removeMergeRegion(index)"
        >
          {{ region.startRow + 1 }}:{{ region.endRow + 1 }} /
          {{ columnLabel(region.startColumn) }}:{{
            columnLabel(region.endColumn)
          }}
        </el-tag>
      </div>
    </div>
    <SheetFormulaBar
      v-if="sheet"
      :coordinate="`${columnLabel(selected.column)}${selected.row + 1}`"
      :model-value="formulaBarValue"
      :readonly="readonly"
      @update:model-value="formulaBarValue = $event"
      @commit="saveCell"
    />
    <SheetCanvas
      v-if="sheet"
      class="sheet-canvas"
      :sheet="sheet"
      :readonly="readonly"
      :selected-row="selected.row"
      :selected-column="selected.column"
      :selected-range="selectedRange"
      @select-cell="selectCell"
      @edit-cell="editCell"
    />
    <el-empty v-else description="请导入Excel创建Sheet模板" :image-size="72" />
    <DesignerStatusBar
      :selection="`${columnLabel(selectedRange.startColumn)}${selectedRange.startRow + 1}:${columnLabel(selectedRange.endColumn)}${selectedRange.endRow + 1}`"
      :value-type="selected.valueType"
      :readonly="readonly"
      :save-status="saveStatus"
    />
    <el-dialog
      v-model="dialogOpen"
      :title="`设置 ${columnLabel(selected.column)}${selected.row + 1}`"
      width="480px"
      append-to-body
    >
      <CellInspector
        :model-value="selected"
        :provider-fields="providerFields"
        :formulas="formulas"
        @update:model-value="Object.assign(selected, $event)"
      />
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="
            selected.binding.type !== 'STATIC' && !selected.binding.key
          "
          @click="saveCell"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.sheet-designer {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  background: #f5f7fa;
}
.sheet-designer > * {
  flex: 0 0 auto;
}
.sheet-tools {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 150px;
  padding: 8px 10px;
  overflow: auto;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.sheet-tools :deep(.el-form-item) {
  margin-bottom: 4px;
}
.sheet-tools :deep(.el-input-number) {
  width: 96px;
}
.merge-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sheet-canvas {
  min-height: 180px;
  flex: 1 1 auto;
}
</style>
