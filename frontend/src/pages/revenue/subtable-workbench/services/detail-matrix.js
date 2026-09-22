import {
  REVENUE_INPUT_SCOPE,
  REVENUE_MODULE_CODE,
  isRevenueYearOnlyRow,
} from "../domain-config";
import {
  RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
  RND_INVESTMENT_TAX_INCLUDED_CELL_KEY,
  buildRndInvestmentAmountColumns,
  isRndAmountCellKey,
  isRndDirectYearInputRow,
  isRndDoubleAmountSourceRow,
} from "../formula-engine";
import {
  isSavableTrimName,
  isSavableYearLabel,
  readRowMatrixValue,
} from "./project-cost-data-item";
import { YEAR_ONLY_TRIM_INDEX } from "./detail-builder";
import { safeText } from "./workbench-utils";

export function normalizeTrimOptions(trimOptions, fallbackTrims = []) {
  const list = Array.isArray(trimOptions) ? trimOptions : [];
  const source = list.length ? list : fallbackTrims;
  const map = {};
  const result = [];

  source.forEach((item, index) => {
    let trimId;
    let trimName;
    let trimIndex = index;

    if (item && typeof item === "object" && !Array.isArray(item)) {
      trimId = safeText(item.trimId || item.id || item.code || item.name);
      trimName = safeText(item.trimName || item.name || item.label || trimId);
      if (Number.isInteger(item.trimIndex)) {
        trimIndex = Number(item.trimIndex);
      }
    } else {
      trimName = safeText(item, `版型${index + 1}`);
      trimId = trimName;
    }

    if (!trimId || map[trimId]) return;
    map[trimId] = true;
    result.push({ trimId, trimName: trimName || trimId, trimIndex });
  });

  return result;
}

export function parseCellKey(cellKey = "") {
  const match = /^y(\d+)_t(\d+)$/.exec(safeText(cellKey));
  if (!match) return null;
  return {
    yearIndex: Number(match[1]),
    trimIndex: Number(match[2]),
  };
}

export function getDetailDimensions(detail = {}) {
  const dimensions =
    detail && detail.dimensions && typeof detail.dimensions === "object"
      ? detail.dimensions
      : { years: [], trims: [] };
  return {
    years: Array.isArray(dimensions.years) ? dimensions.years : [],
    trims: Array.isArray(dimensions.trims) ? dimensions.trims : [],
  };
}

export function buildYearOnlyDetailRealColumns(detail = {}) {
  const dimensions = getDetailDimensions(detail);
  const columns = [];
  dimensions.years.forEach((yearLabel, yearIndex) => {
    if (!isSavableYearLabel(yearLabel)) return;
    columns.push({
      key: `y${yearIndex}_t${YEAR_ONLY_TRIM_INDEX}`,
      yearLabel,
      yearIndex,
      trimId: "",
      trimName: "",
      trimIndex: YEAR_ONLY_TRIM_INDEX,
      real: true,
      displayOnly: false,
      aggregateMode: "NONE",
      yearOnly: true,
    });
  });
  return columns;
}

export function buildDetailRealColumns(detail = {}, row = null) {
  if (row && isRevenueYearOnlyRow(row)) {
    return buildYearOnlyDetailRealColumns(detail);
  }
  const dimensions = getDetailDimensions(detail);
  const trimOptions = normalizeTrimOptions(detail.trimOptions, dimensions.trims);
  const yearTrimConfig =
    detail && detail.yearTrimConfig && typeof detail.yearTrimConfig === "object"
      ? detail.yearTrimConfig
      : {};
  const columns = [];

  dimensions.years.forEach((yearLabel, yearIndex) => {
    if (!isSavableYearLabel(yearLabel)) return;
    const configured = Array.isArray(yearTrimConfig[yearLabel]) ? yearTrimConfig[yearLabel] : [];
    const configuredMap = {};
    configured.map((item) => safeText(item)).filter(Boolean).forEach((trimId) => {
      configuredMap[trimId] = true;
    });
    const hasConfigured = Object.keys(configuredMap).length > 0;

    trimOptions.forEach((trim, fallbackTrimIndex) => {
      const trimId = safeText(trim.trimId || trim.trimName);
      const trimName = safeText(trim.trimName || trimId, trimId);
      if (!isSavableTrimName(trimId) || !isSavableTrimName(trimName)) return;
      if (hasConfigured && !configuredMap[trimId]) return;
      columns.push({
        key: `y${yearIndex}_t${Number.isInteger(trim.trimIndex) ? trim.trimIndex : fallbackTrimIndex}`,
        yearLabel,
        yearIndex,
        trimId,
        trimName,
        trimIndex: Number.isInteger(trim.trimIndex) ? trim.trimIndex : fallbackTrimIndex,
        real: true,
        displayOnly: false,
        aggregateMode: "NONE",
      });
    });
  });

  return columns;
}

export function isColumnRequiredByInputScope(row = {}, column = {}) {
  if (column && column.cellKey && isRndAmountCellKey(column.cellKey)) {
    return isRndDoubleAmountSourceRow(row);
  }
  if (row && row.moduleCode === REVENUE_MODULE_CODE.RND_EXPENSE && !isRndDirectYearInputRow(row)) {
    return false;
  }
  const scope = safeText(row.inputScope || REVENUE_INPUT_SCOPE.ALL);
  if (scope === REVENUE_INPUT_SCOPE.READONLY) return false;
  if (scope === REVENUE_INPUT_SCOPE.FIRST_YEAR_ONLY) {
    return Number(column.yearIndex) === 0;
  }
  if (scope === REVENUE_INPUT_SCOPE.YEAR_INDEPENDENT) {
    return Number(column.yearIndex) === 0;
  }
  return true;
}

export function buildStageInputColumns(detail = {}, row = {}) {
  if (isRndDoubleAmountSourceRow(row)) return buildRndInvestmentAmountColumns();
  if (row && row.moduleCode === REVENUE_MODULE_CODE.RND_EXPENSE && !isRndDirectYearInputRow(row)) return [];
  return buildDetailRealColumns(detail, row);
}

export function readRowMatrixColumnValue(row = {}, column = {}) {
  if (column && column.cellKey && isRndAmountCellKey(column.cellKey)) {
    const cells = row && row.cells && typeof row.cells === "object" ? row.cells : {};
    if (Object.prototype.hasOwnProperty.call(cells, column.cellKey)) return cells[column.cellKey];
    if (column.cellKey === RND_INVESTMENT_TAX_INCLUDED_CELL_KEY) return row.rndInvestmentTaxIncludedAmount || "";
    if (column.cellKey === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY) {
      return row.rndInvestmentTaxExcludedAmount || row.rndInvestmentAmount || "";
    }
    return "";
  }
  const byTrimId = readRowMatrixValue(
    row,
    column.yearLabel,
    column.trimId,
    column.yearIndex,
    column.trimIndex
  );
  if (safeText(byTrimId) || safeText(column.trimId) === safeText(column.trimName)) return byTrimId;
  return readRowMatrixValue(
    row,
    column.yearLabel,
    column.trimName,
    column.yearIndex,
    column.trimIndex
  );
}

export function writeRowMatrixColumnValue(row = {}, column = {}, value = "", recordMeta = null) {
  if (!row || typeof row !== "object" || !column) return;
  if (column.cellKey && isRndAmountCellKey(column.cellKey)) {
    const cellKey = safeText(column.cellKey);
    if (!row.cells || typeof row.cells !== "object") row.cells = {};
    row.cells[cellKey] = value;
    if (cellKey === RND_INVESTMENT_TAX_INCLUDED_CELL_KEY) row.rndInvestmentTaxIncludedAmount = value;
    if (cellKey === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY) {
      row.rndInvestmentTaxExcludedAmount = value;
      row.rndInvestmentAmount = value;
    }
    if (recordMeta && typeof recordMeta === "object") {
      if (!row.cellRecordMap || typeof row.cellRecordMap !== "object") row.cellRecordMap = {};
      if (!row.cellTargetMap || typeof row.cellTargetMap !== "object") row.cellTargetMap = {};
      row.cellRecordMap[cellKey] = recordMeta;
      row.cellTargetMap[cellKey] = recordMeta;
    }
    return;
  }
  const cellKey = `y${column.yearIndex}_t${column.trimIndex}`;
  const dimensionKey = `${safeText(column.yearLabel)}__${safeText(column.trimId || column.trimName)}`;
  if (!row.cells || typeof row.cells !== "object") row.cells = {};
  if (!row.cellMap || typeof row.cellMap !== "object") row.cellMap = {};
  row.cells[cellKey] = value;
  row.cellMap[dimensionKey] = value;
  if (safeText(column.trimName) && safeText(column.trimName) !== safeText(column.trimId)) {
    row.cellMap[`${safeText(column.yearLabel)}__${safeText(column.trimName)}`] = value;
  }
  if (recordMeta && typeof recordMeta === "object") {
    if (!row.cellRecordMap || typeof row.cellRecordMap !== "object") row.cellRecordMap = {};
    row.cellRecordMap[cellKey] = recordMeta;
    row.cellRecordMap[dimensionKey] = recordMeta;
  }
}
