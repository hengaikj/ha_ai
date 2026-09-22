import type { TableCellSchema, TableSheetSchema } from "@/types/custom-table";

export interface CellRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface CopiedSelection {
  cells: TableCellSchema[];
  rowCount: number;
  columnCount: number;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeRange(range: CellRange): CellRange {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    endRow: Math.max(range.startRow, range.endRow),
    startColumn: Math.min(range.startColumn, range.endColumn),
    endColumn: Math.max(range.startColumn, range.endColumn),
  };
}

function assertSheetIndex<T>(items: T[], index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    throw new Error("工作表不存在");
  }
}

function assertUniqueName(sheets: TableSheetSchema[], name: string, skip = -1) {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("工作表名称不能为空");
  if (
    sheets.some(
      (sheet, index) => index !== skip && sheet.name === normalizedName,
    )
  ) {
    throw new Error("工作表名称已存在");
  }
  return normalizedName;
}

function assertRangeInSheet(sheet: TableSheetSchema, range: CellRange) {
  const normalized = normalizeRange(range);
  if (
    normalized.startRow < 0 ||
    normalized.startColumn < 0 ||
    normalized.endRow >= sheet.rowCount ||
    normalized.endColumn >= sheet.columnCount
  ) {
    throw new Error("选择区域超出工作表范围");
  }
  return normalized;
}

function rangesOverlap(left: CellRange, right: CellRange) {
  const a = normalizeRange(left);
  const b = normalizeRange(right);
  return !(
    a.endRow < b.startRow ||
    b.endRow < a.startRow ||
    a.endColumn < b.startColumn ||
    b.endColumn < a.startColumn
  );
}

function sameRange(left: CellRange, right: CellRange) {
  const a = normalizeRange(left);
  const b = normalizeRange(right);
  return (
    a.startRow === b.startRow &&
    a.endRow === b.endRow &&
    a.startColumn === b.startColumn &&
    a.endColumn === b.endColumn
  );
}

function shiftIndex(index: number, at: number, count: number) {
  return index >= at ? index + count : index;
}

function deleteIndex(index: number, at: number, count: number) {
  if (index >= at && index < at + count) return null;
  return index >= at + count ? index - count : index;
}

export function cloneSheet(sheet: TableSheetSchema): TableSheetSchema {
  return clone(sheet);
}

export function createBlankSheet(name = "Sheet1"): TableSheetSchema {
  return {
    name,
    rowCount: 20,
    columnCount: 10,
    frozenRows: 0,
    frozenColumns: 0,
    mergeRegions: [],
    rowHeights: [],
    columnWidths: [],
    hiddenRows: [],
    hiddenColumns: [],
    cells: [],
  };
}

export function appendBlankSheet(
  sheets: TableSheetSchema[],
): TableSheetSchema[] {
  const names = new Set(sheets.map((sheet) => sheet.name));
  let index = sheets.length + 1;
  while (names.has(`Sheet${index}`)) index++;
  return [...clone(sheets), createBlankSheet(`Sheet${index}`)];
}

export function renameSheet(
  sheets: TableSheetSchema[],
  index: number,
  name: string,
): TableSheetSchema[] {
  assertSheetIndex(sheets, index);
  const normalizedName = assertUniqueName(sheets, name, index);
  const next = clone(sheets);
  next[index].name = normalizedName;
  return next;
}

export function duplicateSheet(
  sheets: TableSheetSchema[],
  index: number,
  name: string,
): TableSheetSchema[] {
  assertSheetIndex(sheets, index);
  const normalizedName = assertUniqueName(sheets, name);
  const next = clone(sheets);
  const duplicated = cloneSheet(next[index]);
  duplicated.name = normalizedName;
  next.splice(index + 1, 0, duplicated);
  return next;
}

export function removeSheet(
  sheets: TableSheetSchema[],
  index: number,
): TableSheetSchema[] {
  assertSheetIndex(sheets, index);
  if (sheets.length <= 1) throw new Error("至少保留一个工作表");
  const next = clone(sheets);
  next.splice(index, 1);
  return next;
}

export function insertRows(
  sheet: TableSheetSchema,
  at: number,
  count: number,
): TableSheetSchema {
  if (!Number.isInteger(at) || at < 0 || at > sheet.rowCount) {
    throw new Error("插入行位置不正确");
  }
  if (!Number.isInteger(count) || count < 1) throw new Error("插入行数不正确");
  const next = cloneSheet(sheet);
  next.rowCount += count;
  next.frozenRows = shiftIndex(next.frozenRows, at, count);
  next.hiddenRows = next.hiddenRows.map((index) =>
    shiftIndex(index, at, count),
  );
  next.rowHeights = next.rowHeights.map((item) => ({
    ...item,
    index: shiftIndex(item.index, at, count),
  }));
  next.cells = next.cells.map((cell) => ({
    ...cell,
    row: shiftIndex(cell.row, at, count),
  }));
  next.mergeRegions = next.mergeRegions.map((region) => ({
    ...region,
    startRow: shiftIndex(region.startRow, at, count),
    endRow: shiftIndex(region.endRow, at, count),
  }));
  return next;
}

export function insertColumns(
  sheet: TableSheetSchema,
  at: number,
  count: number,
): TableSheetSchema {
  if (!Number.isInteger(at) || at < 0 || at > sheet.columnCount) {
    throw new Error("插入列位置不正确");
  }
  if (!Number.isInteger(count) || count < 1) throw new Error("插入列数不正确");
  const next = cloneSheet(sheet);
  next.columnCount += count;
  next.frozenColumns = shiftIndex(next.frozenColumns, at, count);
  next.hiddenColumns = next.hiddenColumns.map((index) =>
    shiftIndex(index, at, count),
  );
  next.columnWidths = next.columnWidths.map((item) => ({
    ...item,
    index: shiftIndex(item.index, at, count),
  }));
  next.cells = next.cells.map((cell) => ({
    ...cell,
    column: shiftIndex(cell.column, at, count),
  }));
  next.mergeRegions = next.mergeRegions.map((region) => ({
    ...region,
    startColumn: shiftIndex(region.startColumn, at, count),
    endColumn: shiftIndex(region.endColumn, at, count),
  }));
  return next;
}

export function deleteRows(
  sheet: TableSheetSchema,
  at: number,
  count: number,
): TableSheetSchema {
  if (!Number.isInteger(at) || at < 0 || at >= sheet.rowCount) {
    throw new Error("删除行位置不正确");
  }
  if (!Number.isInteger(count) || count < 1 || sheet.rowCount - count < 1) {
    throw new Error("删除行数不正确");
  }
  const next = cloneSheet(sheet);
  next.rowCount -= count;
  next.frozenRows = Math.min(next.frozenRows, next.rowCount);
  next.hiddenRows = next.hiddenRows
    .map((index) => deleteIndex(index, at, count))
    .filter(
      (index): index is number => index !== null && index < next.rowCount,
    );
  next.rowHeights = next.rowHeights
    .map((item) => {
      const index = deleteIndex(item.index, at, count);
      return index === null ? null : { ...item, index };
    })
    .filter((item): item is { index: number; size: number } => item !== null);
  next.cells = next.cells
    .map((cell) => {
      const row = deleteIndex(cell.row, at, count);
      return row === null ? null : { ...cell, row };
    })
    .filter((cell): cell is TableCellSchema => cell !== null);
  next.mergeRegions = next.mergeRegions
    .filter((region) => region.endRow < at || region.startRow >= at + count)
    .map((region) => ({
      ...region,
      startRow:
        region.startRow >= at + count
          ? region.startRow - count
          : region.startRow,
      endRow:
        region.endRow >= at + count ? region.endRow - count : region.endRow,
    }));
  return next;
}

export function deleteColumns(
  sheet: TableSheetSchema,
  at: number,
  count: number,
): TableSheetSchema {
  if (!Number.isInteger(at) || at < 0 || at >= sheet.columnCount) {
    throw new Error("删除列位置不正确");
  }
  if (!Number.isInteger(count) || count < 1 || sheet.columnCount - count < 1) {
    throw new Error("删除列数不正确");
  }
  const next = cloneSheet(sheet);
  next.columnCount -= count;
  next.frozenColumns = Math.min(next.frozenColumns, next.columnCount);
  next.hiddenColumns = next.hiddenColumns
    .map((index) => deleteIndex(index, at, count))
    .filter(
      (index): index is number => index !== null && index < next.columnCount,
    );
  next.columnWidths = next.columnWidths
    .map((item) => {
      const index = deleteIndex(item.index, at, count);
      return index === null ? null : { ...item, index };
    })
    .filter((item): item is { index: number; size: number } => item !== null);
  next.cells = next.cells
    .map((cell) => {
      const column = deleteIndex(cell.column, at, count);
      return column === null ? null : { ...cell, column };
    })
    .filter((cell): cell is TableCellSchema => cell !== null);
  next.mergeRegions = next.mergeRegions
    .filter(
      (region) => region.endColumn < at || region.startColumn >= at + count,
    )
    .map((region) => ({
      ...region,
      startColumn:
        region.startColumn >= at + count
          ? region.startColumn - count
          : region.startColumn,
      endColumn:
        region.endColumn >= at + count
          ? region.endColumn - count
          : region.endColumn,
    }));
  return next;
}

export function copySelection(
  sheet: TableSheetSchema,
  range: CellRange,
): CopiedSelection {
  const normalized = assertRangeInSheet(sheet, range);
  return {
    rowCount: normalized.endRow - normalized.startRow + 1,
    columnCount: normalized.endColumn - normalized.startColumn + 1,
    cells: clone(
      sheet.cells.filter(
        (cell) =>
          cell.row >= normalized.startRow &&
          cell.row <= normalized.endRow &&
          cell.column >= normalized.startColumn &&
          cell.column <= normalized.endColumn,
      ),
    ),
  };
}

export function pasteSelection(
  sheet: TableSheetSchema,
  targetRow: number,
  targetColumn: number,
  selection: CopiedSelection,
): TableSheetSchema {
  if (
    targetRow < 0 ||
    targetColumn < 0 ||
    targetRow + selection.rowCount > sheet.rowCount ||
    targetColumn + selection.columnCount > sheet.columnCount
  ) {
    throw new Error("粘贴区域超出工作表范围");
  }
  const next = cloneSheet(sheet);
  const sourceStartRow = Math.min(...selection.cells.map((cell) => cell.row));
  const sourceStartColumn = Math.min(
    ...selection.cells.map((cell) => cell.column),
  );
  const targetKeys = new Set<string>();
  const pastedCells = selection.cells.map((cell) => {
    const row = targetRow + cell.row - sourceStartRow;
    const column = targetColumn + cell.column - sourceStartColumn;
    targetKeys.add(`${row}:${column}`);
    return { ...clone(cell), row, column };
  });
  next.cells = [
    ...next.cells.filter(
      (cell) => !targetKeys.has(`${cell.row}:${cell.column}`),
    ),
    ...pastedCells,
  ].sort((left, right) => left.row - right.row || left.column - right.column);
  return next;
}

export function mergeSelection(
  sheet: TableSheetSchema,
  range: CellRange,
): TableSheetSchema {
  const normalized = assertRangeInSheet(sheet, range);
  if (
    normalized.startRow === normalized.endRow &&
    normalized.startColumn === normalized.endColumn
  ) {
    throw new Error("至少选择两个单元格进行合并");
  }
  if (
    sheet.mergeRegions.some(
      (region) =>
        rangesOverlap(region, normalized) && !sameRange(region, normalized),
    )
  ) {
    throw new Error("合并区域不能重叠");
  }
  if (sheet.mergeRegions.some((region) => sameRange(region, normalized))) {
    return cloneSheet(sheet);
  }
  const next = cloneSheet(sheet);
  next.mergeRegions.push(normalized);
  return next;
}

export function unmergeSelection(
  sheet: TableSheetSchema,
  range: CellRange,
): TableSheetSchema {
  const normalized = normalizeRange(range);
  const next = cloneSheet(sheet);
  next.mergeRegions = next.mergeRegions.filter(
    (region) => !sameRange(region, normalized),
  );
  return next;
}
