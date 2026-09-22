import { computed, ref, type Ref } from "vue";
import type {
  TableCellSchema,
  TableDesignValidationRule,
  TableSheetSchema,
  TableTemplateSchema,
} from "@/types/custom-table";
import {
  appendBlankSheet,
  copySelection,
  deleteColumns,
  deleteRows,
  duplicateSheet,
  insertColumns,
  insertRows,
  mergeSelection,
  pasteSelection,
  removeSheet,
  renameSheet,
  unmergeSelection,
  type CellRange,
  type CopiedSelection,
} from "../utils/table-sheet";
import { useTableDesignerHistory } from "./useTableDesignerHistory";

export interface DesignerCommand {
  label: string;
  execute: (schema: TableTemplateSchema) => TableTemplateSchema;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withSheet(
  schema: TableTemplateSchema,
  sheetIndex: number,
  update: (sheet: TableSheetSchema) => TableSheetSchema,
) {
  const next = clone(schema);
  const sheet = next.sheets[sheetIndex];
  if (!sheet) throw new Error("工作表不存在");
  next.sheets.splice(sheetIndex, 1, update(sheet));
  return next;
}

function sheetCommand(
  label: string,
  sheetIndex: number,
  update: (sheet: TableSheetSchema) => TableSheetSchema,
): DesignerCommand {
  return {
    label,
    execute: (schema) => withSheet(schema, sheetIndex, update),
  };
}

function sameRange(rule: TableDesignValidationRule, range: CellRange) {
  return (
    rule.startRow === Math.min(range.startRow, range.endRow) &&
    rule.endRow === Math.max(range.startRow, range.endRow) &&
    rule.startColumn === Math.min(range.startColumn, range.endColumn) &&
    rule.endColumn === Math.max(range.startColumn, range.endColumn)
  );
}

function requiredRuleKey(sheetName: string, range: CellRange) {
  return [
    "required",
    sheetName,
    Math.min(range.startRow, range.endRow),
    Math.max(range.startRow, range.endRow),
    Math.min(range.startColumn, range.endColumn),
    Math.max(range.startColumn, range.endColumn),
  ].join("_");
}

function renameSheetReferences(
  schema: TableTemplateSchema,
  previousName: string,
  nextName: string,
) {
  const workbench = schema.extensions?.designWorkbench;
  if (!workbench) return;
  workbench.regions.forEach((item) => {
    if (item.sheetName === previousName) item.sheetName = nextName;
  });
  workbench.validationRules.forEach((item) => {
    if (item.sheetName === previousName) item.sheetName = nextName;
  });
  workbench.conditionalStyles.forEach((item) => {
    if (item.sheetName === previousName) item.sheetName = nextName;
  });
}

function deleteSheetReferences(schema: TableTemplateSchema, sheetName: string) {
  const workbench = schema.extensions?.designWorkbench;
  if (!workbench) return;
  workbench.regions = workbench.regions.filter(
    (item) => item.sheetName !== sheetName,
  );
  workbench.validationRules = workbench.validationRules.filter(
    (item) => item.sheetName !== sheetName,
  );
  workbench.conditionalStyles = workbench.conditionalStyles.filter(
    (item) => item.sheetName !== sheetName,
  );
}

export const designerCommands = {
  insertRows: (sheetIndex: number, at: number, count: number) =>
    sheetCommand("插入行", sheetIndex, (sheet) => insertRows(sheet, at, count)),
  deleteRows: (sheetIndex: number, at: number, count: number) =>
    sheetCommand("删除行", sheetIndex, (sheet) => deleteRows(sheet, at, count)),
  insertColumns: (sheetIndex: number, at: number, count: number) =>
    sheetCommand("插入列", sheetIndex, (sheet) =>
      insertColumns(sheet, at, count),
    ),
  deleteColumns: (sheetIndex: number, at: number, count: number) =>
    sheetCommand("删除列", sheetIndex, (sheet) =>
      deleteColumns(sheet, at, count),
    ),
  merge: (sheetIndex: number, range: CellRange) =>
    sheetCommand("合并单元格", sheetIndex, (sheet) =>
      mergeSelection(sheet, range),
    ),
  unmerge: (sheetIndex: number, range: CellRange) =>
    sheetCommand("拆分单元格", sheetIndex, (sheet) =>
      unmergeSelection(sheet, range),
    ),
  clear: (sheetIndex: number, range: CellRange) =>
    sheetCommand("清空选区", sheetIndex, (sheet) => {
      const startRow = Math.min(range.startRow, range.endRow);
      const endRow = Math.max(range.startRow, range.endRow);
      const startColumn = Math.min(range.startColumn, range.endColumn);
      const endColumn = Math.max(range.startColumn, range.endColumn);
      const next = clone(sheet);
      next.cells = next.cells.filter(
        (cell) =>
          cell.row < startRow ||
          cell.row > endRow ||
          cell.column < startColumn ||
          cell.column > endColumn,
      );
      return next;
    }),
  setCell: (
    sheetIndex: number,
    row: number,
    column: number,
    value: Pick<
      TableCellSchema,
      "valueType" | "staticValue" | "binding" | "style"
    >,
  ) =>
    sheetCommand("编辑单元格", sheetIndex, (sheet) => {
      const next = clone(sheet);
      const cell = { row, column, ...clone(value) };
      const index = next.cells.findIndex(
        (item) => item.row === row && item.column === column,
      );
      if (index >= 0) next.cells.splice(index, 1, cell);
      else next.cells.push(cell);
      return next;
    }),
  copy: (
    schema: TableTemplateSchema,
    sheetIndex: number,
    range: CellRange,
  ): CopiedSelection => {
    const sheet = schema.sheets[sheetIndex];
    if (!sheet) throw new Error("工作表不存在");
    return copySelection(sheet, range);
  },
  paste: (
    sheetIndex: number,
    row: number,
    column: number,
    copied: CopiedSelection,
  ) =>
    sheetCommand("粘贴选区", sheetIndex, (sheet) =>
      pasteSelection(sheet, row, column, copied),
    ),
  setRequired: (
    sheetIndex: number,
    range: CellRange,
    required: boolean,
  ): DesignerCommand => ({
    label: required ? "设为必填" : "取消必填",
    execute(schema) {
      const next = clone(schema);
      const sheet = next.sheets[sheetIndex];
      if (!sheet) throw new Error("工作表不存在");
      const workbench = next.extensions?.designWorkbench ?? {
        version: "1.0" as const,
        variables: [],
        regions: [],
        validationRules: [],
        conditionalStyles: [],
      };
      workbench.validationRules = workbench.validationRules.filter(
        (rule) =>
          !(
            rule.sheetName === sheet.name &&
            rule.operator === "REQUIRED" &&
            sameRange(rule, range)
          ),
      );
      if (required) {
        workbench.validationRules.push({
          key: requiredRuleKey(sheet.name, range),
          sheetName: sheet.name,
          startRow: Math.min(range.startRow, range.endRow),
          endRow: Math.max(range.startRow, range.endRow),
          startColumn: Math.min(range.startColumn, range.endColumn),
          endColumn: Math.max(range.startColumn, range.endColumn),
          operator: "REQUIRED",
          operand: null,
          message: "必填",
        });
      }
      next.extensions = { ...next.extensions, designWorkbench: workbench };
      return next;
    },
  }),
  addSheet: (): DesignerCommand => ({
    label: "新增工作表",
    execute: (schema) => ({
      ...clone(schema),
      sheets: appendBlankSheet(schema.sheets),
    }),
  }),
  renameSheet: (sheetIndex: number, name: string): DesignerCommand => ({
    label: "重命名工作表",
    execute(schema) {
      const next = clone(schema);
      const previousName = next.sheets[sheetIndex]?.name;
      if (!previousName) throw new Error("工作表不存在");
      next.sheets = renameSheet(next.sheets, sheetIndex, name);
      renameSheetReferences(next, previousName, next.sheets[sheetIndex].name);
      return next;
    },
  }),
  duplicateSheet: (sheetIndex: number, name: string): DesignerCommand => ({
    label: "复制工作表",
    execute: (schema) => ({
      ...clone(schema),
      sheets: duplicateSheet(schema.sheets, sheetIndex, name),
    }),
  }),
  deleteSheet: (sheetIndex: number): DesignerCommand => ({
    label: "删除工作表",
    execute(schema) {
      const next = clone(schema);
      const sheetName = next.sheets[sheetIndex]?.name;
      if (!sheetName) throw new Error("工作表不存在");
      next.sheets = removeSheet(next.sheets, sheetIndex);
      deleteSheetReferences(next, sheetName);
      return next;
    },
  }),
};

export interface DesignerCommandsState {
  current: Ref<TableTemplateSchema>;
  dirty: Readonly<Ref<boolean>>;
  canUndo: Readonly<Ref<boolean>>;
  canRedo: Readonly<Ref<boolean>>;
  execute: (command: DesignerCommand) => TableTemplateSchema;
  undo: () => TableTemplateSchema | undefined;
  redo: () => TableTemplateSchema | undefined;
  sync: (schema: TableTemplateSchema) => void;
  markSaved: () => void;
  reset: (schema: TableTemplateSchema) => void;
}

export function useDesignerCommands(
  initialSchema: TableTemplateSchema,
): DesignerCommandsState {
  const history = useTableDesignerHistory(initialSchema);
  const savedSnapshot = ref(JSON.stringify(initialSchema));
  const dirty = computed(
    () => JSON.stringify(history.current.value) !== savedSnapshot.value,
  );

  function execute(command: DesignerCommand) {
    return history.execute(command.execute(history.current.value));
  }

  function markSaved() {
    savedSnapshot.value = JSON.stringify(history.current.value);
  }

  function reset(schema: TableTemplateSchema) {
    history.reset(schema);
    savedSnapshot.value = JSON.stringify(schema);
  }

  return {
    current: history.current,
    dirty,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    execute,
    undo: history.undo,
    redo: history.redo,
    sync: history.sync,
    markSaved,
    reset,
  };
}
