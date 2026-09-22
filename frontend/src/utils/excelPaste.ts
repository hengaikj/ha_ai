type PasteRow = Record<string, unknown>;

export type ExcelPasteColumn = {
  field: string;
  rowChildField?: string;
  childIndex?: number;
};

export type ExcelPasteTableOptions = {
  rowsData: PasteRow[];
  columns: ExcelPasteColumn[];
};

type ClipboardPasteEvent = Event & {
  clipboardData?: { getData: (format: string) => string } | null;
};

export function parseClipboardTable(text: string): string[][] {
  if (!text) return [];

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t").map((cell) => cell.trim()));
}

/**
 * Handles a copied Excel range from the table container. Inputs only need to
 * expose their row and column metadata through data-excel-paste-* attributes.
 */
export function pasteTableRange(
  event: Event,
  { rowsData, columns }: ExcelPasteTableOptions,
): boolean {
  const text =
    (event as ClipboardPasteEvent).clipboardData?.getData("text/plain") ?? "";
  const rows = parseClipboardTable(text);
  if (!rows.length || !rowsData?.length) {
    return false;
  }

  const input = event.composedPath().find(
    (node): node is HTMLElement =>
      node instanceof HTMLElement &&
      node.hasAttribute("data-excel-paste-field"),
  );
  const startRowIndex = Number(input?.dataset.excelPasteRowIndex);
  const startField = input?.dataset.excelPasteField;
  const startChildIndex = input?.dataset.excelPasteChildIndex;
  const startColumnIndex = columns.findIndex(
    (column) =>
      column.field === startField &&
      (column.childIndex === undefined ||
        String(column.childIndex) === startChildIndex),
  );

  if (
    !input ||
    !Number.isInteger(startRowIndex) ||
    startRowIndex < 0 ||
    startColumnIndex === -1
  ) {
    return false;
  }

  rows.forEach((rowCells, rowOffset) => {
    rowCells.forEach((cellText, columnOffset) => {
      const column = columns[startColumnIndex + columnOffset];
      const targetRow = rowsData[startRowIndex + rowOffset];
      if (!column || !targetRow) return;

      if (column.rowChildField) {
        const children = targetRow[column.rowChildField];
        const child = Array.isArray(children)
          ? (children[column.childIndex ?? 0] as PasteRow | undefined)
          : undefined;
        if (child) child[column.field] = cellText;
        return;
      }

      targetRow[column.field] = cellText;
    });
  });

  return true;
}

export function applyTablePaste({
  rows,
  startRowIndex,
  startField,
  fieldOrder,
  setCell,
}: {
  rows: string[][];
  startRowIndex: number;
  startField: string;
  fieldOrder: string[];
  setCell: (args: {
    rowIndex: number;
    fieldName: string;
    value: string;
  }) => void;
}) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  if (!Array.isArray(fieldOrder) || fieldOrder.length === 0) return;
  if (typeof setCell !== "function") return;

  const startFieldIndex = fieldOrder.indexOf(startField);
  if (startFieldIndex === -1) return;

  rows.forEach((rowCells, rowOffset) => {
    rowCells.forEach((cellText, colOffset) => {
      const fieldName = fieldOrder[startFieldIndex + colOffset];
      if (!fieldName) return;

      setCell({
        rowIndex: startRowIndex + rowOffset,
        fieldName,
        value: cellText,
      });
    });
  });
}

export function pasteByConfig({
  event,
  rowsData,
  startRowIndex,
  startField,
  fieldOrder,
  rowChildField,
  childIndex = 0,
  spreadChildIndex,
}: {
  event: ClipboardEvent;
  rowsData: PasteRow[];
  startRowIndex: number;
  startField: string;
  fieldOrder: string[];
  rowChildField?: string;
  childIndex?: number;
  spreadChildIndex?: boolean;
}) {
  const text = event.clipboardData?.getData("text/plain") ?? "";
  const rows = parseClipboardTable(text);
  if (!rowsData || !rows.length || !fieldOrder.length) return;

  const startFieldIndex = fieldOrder.indexOf(startField);
  if (startFieldIndex === -1) return;

  if (rowChildField && spreadChildIndex) {
    rows.forEach((rowCells, rowOffset) => {
      rowCells.forEach((cellText, colOffset) => {
        const targetRow = rowsData[startRowIndex + rowOffset];
        const targetChildren = targetRow?.[rowChildField];
        if (!Array.isArray(targetChildren)) return;

        const flatOffset = startFieldIndex + colOffset;
        const childOffset = Math.floor(flatOffset / fieldOrder.length);
        const fieldIndex = flatOffset % fieldOrder.length;
        const fieldName = fieldOrder[fieldIndex];
        const targetChild = targetChildren[childIndex + childOffset] as
          | PasteRow
          | undefined;
        if (!targetChild || !fieldName) return;

        targetChild[fieldName] = cellText;
      });
    });
    return;
  }

  if (rowChildField) {
    applyTablePaste({
      rows,
      startRowIndex,
      startField,
      fieldOrder,
      setCell: ({ rowIndex, fieldName, value }) => {
        const targetChildren = rowsData[rowIndex]?.[rowChildField];
        const targetChild = Array.isArray(targetChildren)
          ? (targetChildren[childIndex] as PasteRow | undefined)
          : undefined;
        if (targetChild) targetChild[fieldName] = value;
      },
    });
    return;
  }

  applyTablePaste({
    rows,
    startRowIndex,
    startField,
    fieldOrder,
    setCell: ({ rowIndex, fieldName, value }) => {
      const targetRow = rowsData[rowIndex];
      if (targetRow) targetRow[fieldName] = value;
    },
  });
}
