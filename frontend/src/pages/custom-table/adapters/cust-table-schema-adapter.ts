import type { CustTableSchema } from "@/types/cust-table";
import type { TableTemplateSchema } from "@/types/custom-table";
import { EMPTY_TABLE_SCHEMA } from "@/types/custom-table";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function encodeCustTableSchema(
  schema: TableTemplateSchema,
): CustTableSchema {
  const workbench = schema.extensions?.designWorkbench;
  return {
    schemaVersion: "2.0",
    templateCode: schema.templateCode,
    title: schema.title,
    renderer: schema.renderer,
    sheets: schema.sheets.map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      frozenRows: sheet.frozenRows,
      frozenColumns: sheet.frozenColumns,
      mergeRegions: cloneJson(sheet.mergeRegions),
      rowHeights: cloneJson(sheet.rowHeights),
      columnWidths: cloneJson(sheet.columnWidths),
      hiddenRows: cloneJson(sheet.hiddenRows),
      hiddenColumns: cloneJson(sheet.hiddenColumns),
      cells: sheet.cells.map((cell) => ({
        row: cell.row,
        column: cell.column,
        valueType: cell.valueType,
        bindingType: cell.binding.type,
        bindingKey: cell.binding.key ?? null,
        staticValue: cell.staticValue ?? null,
        style: cloneJson(cell.style ?? {}),
      })),
    })),
    extension: {
      variables: cloneJson(workbench?.variables ?? []),
      regions: cloneJson(workbench?.regions ?? []),
      validationRules: cloneJson(workbench?.validationRules ?? []),
      conditionalStyles: cloneJson(workbench?.conditionalStyles ?? []),
      runtime: {},
    },
    compatibility: {
      templateKind: schema.templateKind ?? EMPTY_TABLE_SCHEMA.templateKind,
      provider: cloneJson(schema.provider ?? EMPTY_TABLE_SCHEMA.provider),
      query: cloneJson(schema.query ?? EMPTY_TABLE_SCHEMA.query),
      layout: cloneJson(schema.layout ?? EMPTY_TABLE_SCHEMA.layout),
      columns: cloneJson(schema.columns ?? EMPTY_TABLE_SCHEMA.columns),
      sections: cloneJson(schema.sections ?? EMPTY_TABLE_SCHEMA.sections),
      formulas: cloneJson(schema.formulas ?? EMPTY_TABLE_SCHEMA.formulas),
      permissions: cloneJson(
        schema.permissions ?? EMPTY_TABLE_SCHEMA.permissions,
      ),
      actions: cloneJson(schema.actions ?? EMPTY_TABLE_SCHEMA.actions),
    },
  };
}

export function decodeCustTableSchema(
  schema: CustTableSchema,
): TableTemplateSchema {
  return {
    schemaVersion: "1.0",
    templateCode: schema.templateCode,
    templateKind: schema.compatibility.templateKind,
    renderer: schema.renderer,
    title: schema.title,
    provider: cloneJson(schema.compatibility.provider),
    query: cloneJson(schema.compatibility.query),
    layout: cloneJson(schema.compatibility.layout),
    columns: cloneJson(schema.compatibility.columns),
    sections: cloneJson(schema.compatibility.sections),
    formulas: cloneJson(schema.compatibility.formulas),
    permissions: cloneJson(schema.compatibility.permissions),
    actions: cloneJson(schema.compatibility.actions),
    sheets: schema.sheets.map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      frozenRows: sheet.frozenRows,
      frozenColumns: sheet.frozenColumns,
      mergeRegions: cloneJson(sheet.mergeRegions),
      rowHeights: cloneJson(sheet.rowHeights),
      columnWidths: cloneJson(sheet.columnWidths),
      hiddenRows: cloneJson(sheet.hiddenRows),
      hiddenColumns: cloneJson(sheet.hiddenColumns),
      cells: sheet.cells.map((cell) => ({
        row: cell.row,
        column: cell.column,
        valueType:
          cell.valueType === "NUMBER"
            ? "DECIMAL"
            : cell.valueType === "FORMULA" || cell.valueType === "EMPTY"
              ? "TEXT"
              : cell.valueType,
        staticValue: cell.staticValue,
        binding: { type: cell.bindingType, key: cell.bindingKey },
        style: Object.keys(cell.style).length
          ? {
              ...cell.style,
              bold: cell.style.bold ?? false,
              italic: cell.style.italic ?? false,
              wrapText: cell.style.wrapText ?? false,
            }
          : null,
      })),
    })),
    extensions: {
      designWorkbench: {
        version: "1.0",
        variables: cloneJson(schema.extension.variables) as NonNullable<
          NonNullable<TableTemplateSchema["extensions"]>["designWorkbench"]
        >["variables"],
        regions: cloneJson(schema.extension.regions) as NonNullable<
          NonNullable<TableTemplateSchema["extensions"]>["designWorkbench"]
        >["regions"],
        validationRules: cloneJson(
          schema.extension.validationRules,
        ) as NonNullable<
          NonNullable<TableTemplateSchema["extensions"]>["designWorkbench"]
        >["validationRules"],
        conditionalStyles: cloneJson(
          schema.extension.conditionalStyles,
        ) as NonNullable<
          NonNullable<TableTemplateSchema["extensions"]>["designWorkbench"]
        >["conditionalStyles"],
      },
    },
  };
}
