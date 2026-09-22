import {
  REVENUE_MODULE_CODE,
  isRevenueYearOnlyRow,
} from "../domain-config";
import {
  applyRevenueFormulasToDetail,
  isRndDirectYearInputRow,
  isRndDoubleAmountSourceRow,
} from "../formula-engine";
import { isSavableMatrixRow } from "../matrix-utils";
import {
  inferDebugModuleCode,
  normalizeFormulaDebugText,
} from "./detail-builder";
import {
  buildRndAmountDataItemsFromRow,
} from "./detail-data-items";
import {
  buildDetailRealColumns,
  getDetailDimensions,
  readRowMatrixColumnValue,
} from "./detail-matrix";
import {
  isMainPreviewRow,
  normalizeMainPreviewPath,
} from "./main-table-preview";
import { buildProjectCostDataItem } from "./project-cost-data-item";
import {
  resolveMatrixSubjectId,
  safeText,
} from "./workbench-utils";

export function buildFormulaErrorResult(error) {
  const message = (error && error.message) || "公式计算失败";
  return {
    updatedRows: 0,
    errors: [{ message }],
  };
}

export function revenueMainGenerateLog(step, payload = {}) {
  if (typeof console === "undefined") return;
  try {
    if (typeof window !== "undefined") {
      const logs = Array.isArray(window.__revenueMainGenerateLogs)
        ? window.__revenueMainGenerateLogs
        : [];
      logs.push({
        at: new Date().toISOString(),
        step,
        payload,
      });
      if (logs.length > 100) logs.splice(0, logs.length - 100);
      window.__revenueMainGenerateLogs = logs;
    }
  } catch (_error) {
    // ignore debug cache errors
  }
  try {
    console.log(`[收益主表生成] ${step}`, payload);
  } catch (_error) {
    // ignore console serialization errors
  }
}

export function tryApplyRevenueFormulasToDetail(detail, options = {}) {
  try {
    return applyRevenueFormulasToDetail(detail, options);
  } catch (error) {
    try {
      revenueMainGenerateLog("公式计算异常", {
        error: buildErrorDebug(error),
        detail: buildDetailDebugSummary(detail),
        options: {
          targetModuleCode: safeText(options.targetModuleCode),
          calculationMode: safeText(
            options.calculationMode ||
              options.formulaCalculationMode ||
              options.formulaMode
          ),
          ignoreFormulaLocks: options.ignoreFormulaLocks === true,
          sourceDetailCount: Array.isArray(options.sourceDetails)
            ? options.sourceDetails.length
            : 0,
          sourceDetails: (Array.isArray(options.sourceDetails) ? options.sourceDetails : [])
            .slice(0, 3)
            .map((sourceDetail) => buildDetailDebugSummary(sourceDetail)),
        },
      });
    } catch (_logError) {
      // diagnostic logging must not affect the submit flow
    }
    rememberFormulaError(detail, error);
    return buildFormulaErrorResult(error);
  }
}

export function buildErrorDebug(error) {
  return {
    name: safeText(error && error.name),
    message: safeText((error && error.message) || error, "公式计算失败"),
    stack: safeText(error && error.stack),
  };
}

export function rememberFormulaError(detail, error) {
  if (!detail || typeof detail !== "object") return;
  const current = Array.isArray(detail.formulaErrors) ? detail.formulaErrors : [];
  detail.formulaErrors = current.concat(buildFormulaErrorResult(error).errors);
}

export function countFilledMatrixCells(rows = []) {
  return (Array.isArray(rows) ? rows : []).reduce((total, row) => {
    const cells = row && row.cells && typeof row.cells === "object" ? row.cells : {};
    return total + Object.keys(cells).filter((key) => safeText(cells[key]) !== "").length;
  }, 0);
}

export function buildDetailDebugSummary(detail = {}) {
  const rows = Array.isArray(detail && detail.rows) ? detail.rows : [];
  const dimensions = getDetailDimensions(detail);
  return {
    rowCount: rows.length,
    mainRowCount: rows.filter(isMainPreviewRow).length,
    savableRowCount: rows.filter(isSavableMatrixRow).length,
    filledCellCount: countFilledMatrixCells(rows),
    years: dimensions.years,
    trims: dimensions.trims,
    trimOptionsCount: Array.isArray(detail.trimOptions) ? detail.trimOptions.length : 0,
  };
}

export function buildRowsDebugSample(rows = [], limit = 8) {
  return (Array.isArray(rows) ? rows : []).slice(0, limit).map((row) => ({
    id: safeText(row && (row.id || row.rowId)),
    subjectId: safeText(row && row.subjectId),
    subject: safeText(row && (row.subjectName || row.subject)),
    path: normalizeMainPreviewPath(row),
    moduleCode: safeText(row && row.moduleCode),
    savable: row && row.savable,
    savePolicy: safeText(row && row.savePolicy),
    rowKind: safeText(row && (row.rowKind || row.rowType)),
    inputScope: safeText(row && row.inputScope),
    filledCellKeys: Object.keys(row && row.cells && typeof row.cells === "object" ? row.cells : {})
      .filter((key) => safeText(row.cells[key]) !== "")
      .slice(0, 5),
  }));
}

export function buildDebugPathCandidates(candidates = []) {
  return (Array.isArray(candidates) ? candidates : [candidates]).reduce((result, candidate) => {
    const text = safeText(candidate);
    const normalized = normalizeFormulaDebugText(text);
    if (normalized && !result.includes(normalized)) result.push(normalized);
    const parts = text
      .split(/[/\\|｜>＞]/)
      .map((part) => safeText(part))
      .filter(Boolean);
    const tail = parts.length > 1 ? normalizeFormulaDebugText(parts.slice(1).join("/")) : "";
    if (tail && !result.includes(tail)) result.push(tail);
    return result;
  }, []);
}

export function findDebugRowByPath(rows = [], candidates = []) {
  const rowList = Array.isArray(rows) ? rows : [];
  const normalizedCandidates = buildDebugPathCandidates(candidates);
  if (!normalizedCandidates.length) return null;
  const rowPaths = rowList.map((row) => ({
    row,
    path: normalizeFormulaDebugText(normalizeMainPreviewPath(row)),
  }));
  for (let index = 0; index < normalizedCandidates.length; index += 1) {
    const candidate = normalizedCandidates[index];
    const hit = rowPaths.find((item) => item.path === candidate);
    if (hit) return hit.row;
  }
  for (let index = 0; index < normalizedCandidates.length; index += 1) {
    const candidate = normalizedCandidates[index];
    const hit = rowPaths.find((item) => item.path.endsWith(candidate));
    if (hit) return hit.row;
  }
  for (let index = 0; index < normalizedCandidates.length; index += 1) {
    const candidate = normalizedCandidates[index];
    const hit = rowPaths.find((item) => item.path.indexOf(candidate) >= 0);
    if (hit) return hit.row;
  }
  return null;
}

export function buildDebugRowProbe(rows = [], probe = {}) {
  const rowList = Array.isArray(rows) ? rows : [];
  const scopedRows = safeText(probe.moduleCode)
    ? rowList.filter((row) => inferDebugModuleCode(row) === probe.moduleCode)
    : rowList;
  const row = findDebugRowByPath(scopedRows, probe.paths || probe.path || probe.label);
  const summary = row ? buildRowsDebugSample([row], 1)[0] : null;
  return {
    label: safeText(probe.label || probe.path || probe.paths),
    moduleCode: safeText(probe.moduleCode),
    matched: Boolean(row),
    filledCellCount: row ? countFilledMatrixCells([row]) : 0,
    row: summary,
  };
}

export function buildSourceModuleDebugSummary(detail = {}) {
  const rows = Array.isArray(detail && detail.rows) ? detail.rows : [];
  const modules = {};
  rows.forEach((row) => {
    const moduleCode = inferDebugModuleCode(row) || "unknown";
    if (!modules[moduleCode]) {
      modules[moduleCode] = {
        rowCount: 0,
        filledCellCount: 0,
        sample: [],
      };
    }
    modules[moduleCode].rowCount += 1;
    modules[moduleCode].filledCellCount += countFilledMatrixCells([row]);
    if (modules[moduleCode].sample.length < 3) {
      modules[moduleCode].sample.push(buildRowsDebugSample([row], 1)[0]);
    }
  });
  return modules;
}

export function buildMainFormulaDebugDiagnostics(mainDetail = {}, sourceDetail = {}) {
  const mainRows = Array.isArray(mainDetail && mainDetail.rows) ? mainDetail.rows : [];
  const sourceRows = Array.isArray(sourceDetail && sourceDetail.rows) ? sourceDetail.rows : [];
  const targetRows = mainRows
    .filter((row) => {
      const entryMode = safeText(row && (row.entryMode || row.templateEntryMode)).toUpperCase();
      return entryMode === "CALCULATED" || row.formulaId != null || safeText(row.formulaCode || row.formulaKey);
    })
    .map((row) => {
      const targetPath = safeText(row && (row.subjectPath || row.fullNamePath || row.path));
      const formulaCode = safeText(row && (row.formulaCode || row.formulaKey));
      return {
        code: formulaCode,
        targetPath,
        matched: Boolean(row),
        filledCellCount: countFilledMatrixCells([row]),
        row: buildRowsDebugSample([row], 1)[0],
      };
    });
  const sourceProbes = [
    {
      label: "销量表/销量",
      moduleCode: REVENUE_MODULE_CODE.SALES_VOLUME,
      paths: ["销量表/销量", "销量", "销量表/目标销量", "目标销量"],
    },
    {
      label: "销量表/单价-指导价",
      moduleCode: REVENUE_MODULE_CODE.SALES_VOLUME,
      paths: [
        "销量表/单价-指导价",
        "单价-指导价",
        "销量表/目标单价-指导价",
        "目标单价-指导价",
        "销量表/实际单价-指导价",
        "实际单价-指导价",
      ],
    },
    {
      label: "产品竞争力分析/本品MSRP",
      moduleCode: REVENUE_MODULE_CODE.PRODUCT_COMPETITIVENESS,
      paths: ["本品信息/价格/本品MSRP", "本品MSRP"],
    },
    {
      label: "促销商务政策/单车促销政策/小计",
      moduleCode: REVENUE_MODULE_CODE.PROMOTION_BUSINESS,
      paths: ["单车促销政策/小计"],
    },
    {
      label: "促销商务政策/单车促销政策/变动促销/消费信贷",
      moduleCode: REVENUE_MODULE_CODE.PROMOTION_BUSINESS,
      paths: ["单车促销政策/变动促销/消费信贷", "消费信贷"],
    },
    {
      label: "促销商务政策/单车商务政策/小计",
      moduleCode: REVENUE_MODULE_CODE.PROMOTION_BUSINESS,
      paths: ["单车商务政策/小计"],
    },
    {
      label: "材料成本/小计",
      moduleCode: REVENUE_MODULE_CODE.MATERIAL_COST,
      paths: ["材料成本/小计", "小计"],
    },
    {
      label: "材料成本/设计成本",
      moduleCode: REVENUE_MODULE_CODE.MATERIAL_COST,
      paths: ["材料成本/设计成本/设计成本", "设计成本/设计成本", "设计成本"],
    },
    {
      label: "材料成本/BOM辅料",
      moduleCode: REVENUE_MODULE_CODE.MATERIAL_COST,
      paths: ["材料成本/BOM辅料", "BOM辅料"],
    },
    {
      label: "材料成本/零部件摊销/单车费用",
      moduleCode: REVENUE_MODULE_CODE.MATERIAL_COST,
      paths: ["零部件摊销/单车费用"],
    },
    {
      label: "变动制造费用/小计",
      moduleCode: REVENUE_MODULE_CODE.VARIABLE_MANUFACTURING_COST,
      paths: ["变动制造费用/小计", "小计"],
    },
    {
      label: "销售费用/单车变动销售费用/小计",
      moduleCode: REVENUE_MODULE_CODE.SALES_EXPENSE,
      paths: ["单车变动销售费用/小计"],
    },
    {
      label: "其他固定费用/固定税金及附加/单车费用",
      moduleCode: REVENUE_MODULE_CODE.PERIOD_EXPENSE,
      paths: ["固定税金及附加/单车费用"],
    },
    {
      label: "其他固定费用/固定制造费用/单车费用",
      moduleCode: REVENUE_MODULE_CODE.PERIOD_EXPENSE,
      paths: ["固定制造费用/单车费用", "固定制造费用/单台"],
    },
    {
      label: "销售费用/固定销售费用/费率",
      moduleCode: REVENUE_MODULE_CODE.SALES_EXPENSE,
      paths: ["销售费用/固定销售费用/费率", "固定销售费用/费率"],
    },
    {
      label: "其他固定费用/管理费用/费率",
      moduleCode: REVENUE_MODULE_CODE.PERIOD_EXPENSE,
      paths: ["其他固定费用/管理费用/费率", "期间费用/管理费用/费率", "管理费用/费率"],
    },
    {
      label: "研发投资/合计",
      moduleCode: REVENUE_MODULE_CODE.RND_EXPENSE,
      paths: ["研发投资/合计", "研发费用/合计", "合计"],
    },
    {
      label: "其他固定费用/财务费用/单车费用",
      moduleCode: REVENUE_MODULE_CODE.PERIOD_EXPENSE,
      paths: ["财务费用/单车费用"],
    },
  ].map((probe) => buildDebugRowProbe(sourceRows, probe));

  return {
    sourceDetail: buildDetailDebugSummary(sourceDetail),
    mainDetail: buildDetailDebugSummary(mainDetail),
    sourceModules: buildSourceModuleDebugSummary(sourceDetail),
    mainTargetMatchedCount: targetRows.filter((item) => item.matched).length,
    mainTargetTotal: targetRows.length,
    missingMainTargets: targetRows.filter((item) => !item.matched).map((item) => item.targetPath),
    mainTargetSamples: targetRows.slice(0, 12),
    sourceProbeSamples: sourceProbes,
  };
}

export function buildSafeMainFormulaDebugDiagnostics(mainDetail = {}, sourceDetail = {}) {
  try {
    return buildMainFormulaDebugDiagnostics(mainDetail, sourceDetail);
  } catch (error) {
    return {
      diagnosticError: buildErrorDebug(error),
      sourceDetail: buildDetailDebugSummary(sourceDetail),
      mainDetail: buildDetailDebugSummary(mainDetail),
    };
  }
}

export function increaseDebugCount(map, key) {
  const name = safeText(key, "unknown");
  map[name] = (map[name] || 0) + 1;
}

export function resolveUnsavableRowReason(row = {}) {
  if (!row || typeof row !== "object") return "row_invalid";
  if (row.isRealSubject === false) return "not_real_subject";
  if (row.savable === false) return "row_savable_false";
  if (safeText(row.savePolicy).toLowerCase() === "display_only") return "display_only_save_policy";
  if (safeText(row.rowKind || row.rowType) === "displayAggregate") return "display_aggregate_row";
  if (!safeText(row.subjectId)) return "missing_subject_id";
  return "not_savable_matrix_row";
}

export function buildMainSaveDiagnostics(ctx, detail = {}) {
  const rows = Array.isArray(detail && detail.rows) ? detail.rows : [];
  const rowSkipReasons = {};
  const cellSkipReasons = {};
  const rowSamples = [];
  const cellSamples = [];
  let candidateCellCount = 0;
  let acceptedItemCountBeforeDedupe = 0;

  const pushRowSample = (reason, row, extra = {}) => {
    if (rowSamples.length >= 12) return;
    rowSamples.push({
      reason,
      ...buildRowsDebugSample([row], 1)[0],
      ...extra,
    });
  };
  const pushCellSample = (reason, row, column, value, extra = {}) => {
    if (cellSamples.length >= 12) return;
    cellSamples.push({
      reason,
      row: buildRowsDebugSample([row], 1)[0],
      column: {
        key: safeText(column && (column.key || column.cellKey)),
        yearLabel: safeText(column && column.yearLabel),
        trimId: safeText(column && column.trimId),
        trimName: safeText(column && column.trimName),
        yearIndex: column && column.yearIndex,
        trimIndex: column && column.trimIndex,
        yearOnly: column && column.yearOnly,
      },
      value,
      ...extra,
    });
  };

  rows.forEach((row) => {
    if (!isSavableMatrixRow(row)) {
      const reason = resolveUnsavableRowReason(row);
      increaseDebugCount(rowSkipReasons, reason);
      pushRowSample(reason, row);
      return;
    }
    if (!safeText(row && row.subjectId)) {
      increaseDebugCount(rowSkipReasons, "missing_subject_id");
      pushRowSample("missing_subject_id", row);
      return;
    }
    if (isRndDoubleAmountSourceRow(row)) {
      const rndItems = buildRndAmountDataItemsFromRow(ctx, row, { includeRecordIds: false });
      if (!rndItems.length) {
        increaseDebugCount(rowSkipReasons, "rnd_amount_no_savable_value");
        pushRowSample("rnd_amount_no_savable_value", row);
        return;
      }
      acceptedItemCountBeforeDedupe += rndItems.length;
      return;
    }
    if (row.moduleCode === REVENUE_MODULE_CODE.RND_EXPENSE && !isRndDirectYearInputRow(row)) {
      increaseDebugCount(rowSkipReasons, "rnd_non_direct_year_input");
      pushRowSample("rnd_non_direct_year_input", row);
      return;
    }

    const yearOnly = isRevenueYearOnlyRow(row);
    const columns = buildDetailRealColumns(detail, row);
    if (!columns.length) {
      const dimensions = getDetailDimensions(detail);
      increaseDebugCount(rowSkipReasons, "no_savable_columns");
      pushRowSample("no_savable_columns", row, {
        years: dimensions.years,
        trims: dimensions.trims,
      });
      return;
    }

    let nonEmptyCellCount = 0;
    let acceptedCellCount = 0;
    columns.forEach((column) => {
      const value = readRowMatrixColumnValue(row, column);
      if (safeText(value) === "") {
        increaseDebugCount(cellSkipReasons, "empty_cell_value");
        return;
      }
      nonEmptyCellCount += 1;
      candidateCellCount += 1;
      const item = buildProjectCostDataItem({
        projectCode: ctx.projectCode,
        subjectId: resolveMatrixSubjectId(row),
        yearLabel: column.yearLabel,
        trimName: yearOnly ? "" : column.trimName || column.trimId,
        unit: column.unit || row.unit,
        value,
        yearOnly,
      });
      if (!item) {
        increaseDebugCount(cellSkipReasons, "non_empty_cell_rejected_by_save_item");
        pushCellSample("non_empty_cell_rejected_by_save_item", row, column, value);
        return;
      }
      acceptedCellCount += 1;
      acceptedItemCountBeforeDedupe += 1;
    });

    if (!nonEmptyCellCount) {
      increaseDebugCount(rowSkipReasons, "all_savable_columns_empty");
      pushRowSample("all_savable_columns_empty", row, { columnCount: columns.length });
    } else if (!acceptedCellCount) {
      increaseDebugCount(rowSkipReasons, "non_empty_cells_all_rejected");
      pushRowSample("non_empty_cells_all_rejected", row, {
        columnCount: columns.length,
        nonEmptyCellCount,
      });
    }
  });

  return {
    detail: buildDetailDebugSummary(detail),
    mainRowCount: rows.filter(isMainPreviewRow).length,
    rowSkipReasons,
    cellSkipReasons,
    candidateCellCount,
    acceptedItemCountBeforeDedupe,
    rowSamples,
    cellSamples,
  };
}
