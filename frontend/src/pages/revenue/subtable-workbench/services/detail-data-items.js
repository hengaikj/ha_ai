import {
  REVENUE_MODULE_CODE,
  isRevenueYearOnlyRow,
} from "../domain-config";
import {
  buildRndInvestmentAmountColumns,
  getRndAmountAggregateModeByCellKey,
  isRndDirectYearInputRow,
  isRndDoubleAmountSourceRow,
} from "../formula-engine";
import { isMaterialDesignCostPersistableColumn } from "../material-design-cost";
import { isSavableMatrixRow } from "../matrix-utils";
import {
  buildDetailRealColumns,
  isColumnRequiredByInputScope,
  readRowMatrixColumnValue,
} from "./detail-matrix";
import {
  buildProjectCostDataItem,
  dedupeProjectCostDataItems,
  isOwnedDraftRecordMeta,
  readRowMatrixRecordMeta,
  readRowMatrixRecordMetaByCellKey,
} from "./project-cost-data-item";
import {
  resolveMatrixSubjectId,
  safeText,
} from "./workbench-utils";

export function buildRndAmountDataItemsFromRow(ctx, row = {}, options = {}) {
  if (!isRndDoubleAmountSourceRow(row)) return [];
  const includeRecordIds = options.includeRecordIds !== false;
  return buildRndInvestmentAmountColumns()
    .map((column) => {
      const cellKey = safeText(column.cellKey || column.key);
      const value = readRowMatrixColumnValue(row, column);
      if (safeText(value) === "") return null;
      const recordMeta = readRowMatrixRecordMetaByCellKey(row, cellKey);
      return buildProjectCostDataItem({
        projectCode: ctx.projectCode,
        subjectId: resolveMatrixSubjectId(row),
        id: includeRecordIds && isOwnedDraftRecordMeta(recordMeta, ctx) ? recordMeta.id : undefined,
        yearAggregateMode: getRndAmountAggregateModeByCellKey(cellKey),
        modelYear: undefined,
        trimName: "",
        unit: column.unit || row.unit,
        value,
      });
    })
    .filter(Boolean);
}

export function buildProjectCostDataItemsFromMatrix(ctx, detail = {}, options = {}) {
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  const includeRecordIds = options.includeRecordIds !== false;
  const rowFilter = typeof options.rowFilter === "function" ? options.rowFilter : null;
  const respectInputScope = options.respectInputScope === true;
  const items = [];

  rows.forEach((row) => {
    if (!isSavableMatrixRow(row)) return;
    if (rowFilter && !rowFilter(row)) return;
    const subjectId = safeText(row && row.subjectId);
    if (!subjectId) return;
    const yearOnly = isRevenueYearOnlyRow(row);
    if (isRndDoubleAmountSourceRow(row)) {
      items.push(...buildRndAmountDataItemsFromRow(ctx, row, { includeRecordIds }));
      return;
    }
    if (row.moduleCode === REVENUE_MODULE_CODE.RND_EXPENSE && !isRndDirectYearInputRow(row)) {
      return;
    }
    buildDetailRealColumns(detail, row).forEach((column) => {
      if (
        respectInputScope &&
        !isColumnRequiredByInputScope(row, column) &&
        !isMaterialDesignCostPersistableColumn(row, column)
      ) {
        return;
      }
      const value = readRowMatrixColumnValue(row, column);
      if (safeText(value) === "") return;
      const recordMeta = readRowMatrixRecordMeta(
        row,
        column.yearLabel,
        yearOnly ? "" : column.trimId || column.trimName,
        column.yearIndex,
        column.trimIndex
      );
      const item = buildProjectCostDataItem({
        projectCode: ctx.projectCode,
        subjectId,
        id: includeRecordIds && isOwnedDraftRecordMeta(recordMeta, ctx) ? recordMeta.id : undefined,
        yearLabel: column.yearLabel,
        trimName: yearOnly ? "" : column.trimName || column.trimId,
        unit: column.unit || row.unit,
        value,
        yearOnly,
      });
      if (item) items.push(item);
    });
  });

  return dedupeProjectCostDataItems(items);
}
