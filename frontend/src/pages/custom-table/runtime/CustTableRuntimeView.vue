<script setup lang="ts">
import { BaseToast } from "@/components/base/BaseToast";
import { computed, onMounted, ref } from "vue";
import {
  getCustTableWorkbook,
  saveCustTableWorkbookCells,
} from "@/api/cust-table";
import SheetCanvas from "@/pages/custom-table/components/SheetCanvas.vue";
import TableTaskPanel from "@/pages/custom-table/components/TableTaskPanel.vue";
import type {
  CustTableCellValueType,
  CustTableSchemaSheet,
  CustTableWorkbookDetail,
} from "@/types/cust-table";
import type {
  TableCellSchema,
  TableCellStyleSchema,
  TableSheetSchema,
  TableValueType,
} from "@/types/custom-table";
import { createIdempotencyKey } from "@/utils/idempotency";
import PermissionButton from "@/components/security/PermissionButton.vue";

const props = defineProps<{
  workbookId: string;
  readonly?: boolean;
}>();

const workbook = ref<CustTableWorkbookDetail | null>(null);
const loading = ref(false);
const saving = ref(false);
const activeSheetName = ref("Sheet1");
const editorOpen = ref(false);
const editingRow = ref(0);
const editingColumn = ref(0);
const editingValue = ref("");

const activeSchemaSheet = computed(
  () =>
    workbook.value?.schema.sheets.find(
      (sheet) => sheet.name === activeSheetName.value,
    ) ?? workbook.value?.schema.sheets[0],
);

const activeSheet = computed<TableSheetSchema | null>(() => {
  const sheet = activeSchemaSheet.value;
  if (!sheet || !workbook.value) return null;
  const cells = new Map<string, TableCellSchema>();
  sheet.cells.forEach((cell) => {
    cells.set(`${cell.row}:${cell.column}`, {
      row: cell.row,
      column: cell.column,
      valueType: toLegacyValueType(cell.valueType),
      staticValue: cell.staticValue,
      binding: { type: cell.bindingType, key: cell.bindingKey },
      style: toLegacyStyle(cell.style),
    });
  });
  workbook.value.cells
    .filter((cell) => cell.sheetName === sheet.name)
    .forEach((cell) => {
      const key = `${cell.row}:${cell.column}`;
      const schemaCell = cells.get(key);
      cells.set(key, {
        row: cell.row,
        column: cell.column,
        valueType: toLegacyValueType(cell.valueType),
        staticValue: cell.rawValue,
        binding: { type: "STATIC", key: null },
        style: schemaCell?.style ?? null,
      });
    });
  return toLegacySheet(sheet, [...cells.values()]);
});

onMounted(loadWorkbook);

async function loadWorkbook() {
  loading.value = true;
  try {
    workbook.value = await getCustTableWorkbook(props.workbookId);
    activeSheetName.value = workbook.value.schema.sheets[0]?.name ?? "Sheet1";
  } finally {
    loading.value = false;
  }
}

function toLegacyValueType(valueType: CustTableCellValueType): TableValueType {
  if (valueType === "NUMBER") return "DECIMAL";
  if (valueType === "FORMULA" || valueType === "EMPTY") return "TEXT";
  return valueType;
}

function toLegacyStyle(
  style: Partial<TableCellStyleSchema>,
): TableCellStyleSchema | null {
  if (!Object.keys(style).length) return null;
  return {
    ...style,
    bold: style.bold ?? false,
    italic: style.italic ?? false,
    wrapText: style.wrapText ?? false,
  };
}

function toLegacySheet(
  sheet: CustTableSchemaSheet,
  cells: TableCellSchema[],
): TableSheetSchema {
  return {
    name: sheet.name,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    frozenRows: sheet.frozenRows,
    frozenColumns: sheet.frozenColumns,
    mergeRegions: sheet.mergeRegions,
    rowHeights: sheet.rowHeights,
    columnWidths: sheet.columnWidths,
    hiddenRows: sheet.hiddenRows,
    hiddenColumns: sheet.hiddenColumns,
    cells,
  };
}

function openCellEditor(row: number, column: number) {
  if (props.readonly || !workbook.value) return;
  editingRow.value = row;
  editingColumn.value = column;
  editingValue.value =
    workbook.value.cells.find(
      (cell) =>
        cell.sheetName === activeSheetName.value &&
        cell.row === row &&
        cell.column === column,
    )?.rawValue ?? "";
  editorOpen.value = true;
}

async function editCell(row: number, column: number, value: string) {
  if (!workbook.value) return;
  saving.value = true;
  try {
    const updated = await saveCustTableWorkbookCells(props.workbookId, {
      requestId: createIdempotencyKey("cust-table-cell"),
      expectedLockVersion: workbook.value.lockVersion,
      cells: [
        {
          sheetName: activeSheetName.value,
          row,
          column,
          valueType: "TEXT",
          rawValue: value,
        },
      ],
    });
    if (updated?.schema?.sheets) {
      workbook.value = updated;
    } else if (typeof updated?.lockVersion === "number") {
      workbook.value.lockVersion = updated.lockVersion;
    } else {
      workbook.value.lockVersion += 1;
    }
  } finally {
    saving.value = false;
  }
}

async function confirmCellEdit() {
  await editCell(editingRow.value, editingColumn.value, editingValue.value);
  editorOpen.value = false;
  BaseToast.success("单元格已保存");
}

defineExpose({ editCell, reload: loadWorkbook });
</script>

<template>
  <section v-loading="loading" class="cust-table-runtime">
    <TableTaskPanel
      :workbook-id="workbookId"
      :can-import="!readonly"
      @import-succeeded="loadWorkbook"
    />
    <el-tabs v-if="workbook" v-model="activeSheetName" class="sheet-tabs">
      <el-tab-pane
        v-for="sheet in workbook.schema.sheets"
        :key="sheet.name"
        :name="sheet.name"
        :label="sheet.name"
      />
    </el-tabs>
    <SheetCanvas
      v-if="activeSheet"
      :sheet="activeSheet"
      :readonly="readonly || saving"
      @edit-cell="openCellEditor"
    />
    <el-empty v-else-if="!loading" description="工作簿没有可显示的工作表" />

    <el-dialog v-model="editorOpen" title="编辑单元格" width="420px">
      <el-form label-position="top">
        <el-form-item
          :label="`${activeSheetName} / R${editingRow + 1}C${editingColumn + 1}`"
        >
          <el-input
            v-model="editingValue"
            type="textarea"
            :rows="4"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorOpen = false">取消</el-button>
        <PermissionButton
          permission="base:cust-table:workbook:edit"
          type="primary"
          :loading="saving"
          @click="confirmCellEdit"
        >
          保存
        </PermissionButton>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.cust-table-runtime {
  display: grid;
  grid-template-rows: auto auto minmax(320px, 1fr);
  min-height: 420px;
  overflow: hidden;
  background: var(--el-bg-color);
}

.sheet-tabs {
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.sheet-tabs :deep(.el-tabs__header) {
  margin: 0;
}
</style>
