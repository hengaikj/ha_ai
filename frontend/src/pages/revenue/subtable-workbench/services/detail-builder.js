import {
  REVENUE_INPUT_SCOPE,
  REVENUE_MODULE_NAME_ALIASES,
  isRevenueYearOnlyRow,
  resolveRevenueModuleCodeByPath,
} from "../domain-config";
import { resolveMaterialDesignCostInputScope } from "../material-design-cost";
import {
  isForcedRatioAggregateRow,
  isMainProjectProfitAmountSumRow,
  isManualFeeRateRatioLabelRow,
} from "../matrix-utils";
import {
  RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
  RND_INVESTMENT_TAX_INCLUDED_CELL_KEY,
  getRndAmountCellKeyByAggregateMode,
  isRndDoubleAmountSourceRow,
} from "../formula-engine";
import {
  assertTemplateItemRuntimeReady,
  normalizeBackendEntryMode,
  rowKindFromBackendEntryMode,
  valueSourceFromBackendEntryMode,
} from "./template-scope";
import { isTargetlessMainAuditRow } from "./workbench-permissions";
import { buildCellTargetMeta } from "./project-context";
import {
  dedupePreferredRecords,
  normalizeRecordCellValue,
  normalizeRecordTrimLabel,
  normalizeRecordYearLabel,
  normalizeRndTechnicalAmountRecordCellValue,
} from "./record-utils";
import { collectPermissionLeafRows } from "./subject-tree";
import {
  compareIdText,
  compareSubjectOrderPath,
  safeText,
} from "./workbench-utils";
import { normalizeMainPreviewPath } from "./main-table-preview";

export const YEAR_ONLY_TRIM_INDEX = 0;

export function normalizeFormulaDebugText(value) {
  return safeText(value)
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "")
    .replace(/[/\\|｜>＞\-—_]/g, "")
    .toLowerCase();
}

export function inferDebugModuleCode(row = {}) {
  const explicit = safeText(row && row.moduleCode);
  if (explicit) return explicit;
  const pathModuleCode = resolveRevenueModuleCodeByPath(normalizeMainPreviewPath(row));
  if (pathModuleCode) return pathModuleCode;
  const sourceText = [
    normalizeMainPreviewPath(row),
    row && row.moduleName,
    row && row.subtable,
    row && row.rootSubjectName,
  ].filter(Boolean).join("/");
  const normalized = normalizeFormulaDebugText(sourceText);
  if (!normalized) return "";
  return Object.keys(REVENUE_MODULE_NAME_ALIASES).find((moduleCode) =>
    (REVENUE_MODULE_NAME_ALIASES[moduleCode] || []).some((alias) => {
      const normalizedAlias = normalizeFormulaDebugText(alias);
      return normalizedAlias && normalized.indexOf(normalizedAlias) >= 0;
    })
  ) || "";
}

export function buildBackendTemplateRow(row = {}) {
  const item = row.templateItem && typeof row.templateItem === "object"
    ? row.templateItem
    : null;
  if (!item) {
    throw new Error(`科目未绑定后端模板：${safeText(row.fullNamePath || row.subjectPath || row.subject || row.subjectId, "-")}`);
  }
  // 优先使用 templateItem.entryMode（模板编辑器配置的数据源）
  // 兼容后端可能使用的多种字段名：entryMode / dataSourceType / data_source_type / sourceType
  // 如果 templateItem.entryMode 缺失或无效时，回退到 row 上的 entryMode/templateEntryMode
  let entryMode;
  const rawEntryMode = safeText(item.entryMode || item.dataSourceType || item.data_source_type || item.sourceType);
  try {
    entryMode = normalizeBackendEntryMode(rawEntryMode, `模板科目录入模式缺失：subjectId=${item.subjectId}`);
  } catch (_e) {
    const fallbackMode = safeText(row.templateEntryMode || row.entryMode);
    if (fallbackMode) {
      entryMode = normalizeBackendEntryMode(fallbackMode, `模板科目录入模式缺失（fallback）：subjectId=${item.subjectId}`);
    } else {
      throw _e;
    }
  }
  if (entryMode === "CALCULATED") {
    // 使用 row 上已有的公式配置作为 fallback（如果 templateItem 中缺失）
    if (!item.formulaExpression && row.formulaExpression) item.formulaExpression = row.formulaExpression;
    if (!item.formulaId && row.formulaId) item.formulaId = row.formulaId;
    if (!item.formulaParamBindings && Array.isArray(row.formulaParamBindings) && row.formulaParamBindings.length > 0) {
      item.formulaParamBindings = row.formulaParamBindings;
    }
    if (!item.formulaCode && row.formulaCode) item.formulaCode = row.formulaCode;
    if (!item.formulaName && row.formulaText) item.formulaName = row.formulaText;
    assertTemplateItemRuntimeReady(item);
  }
  const moduleCode = inferDebugModuleCode(row);
  const moduleName = moduleCode
    ? ((REVENUE_MODULE_NAME_ALIASES[moduleCode] || [])[0] || safeText(row.subtable || row.moduleName))
    : safeText(row.subtable || row.moduleName);
  const readonly = entryMode !== "MANUAL" || row.readonly === true || row.editable === false;
  const rowKind = rowKindFromBackendEntryMode(entryMode);
  const valueSource = valueSourceFromBackendEntryMode(entryMode);
  // 优先保留完整路径；避免只有叶子名时无法识别「项目利润」
  const pathFromArray = Array.isArray(row.subjectPath)
    ? row.subjectPath.map((part) => safeText(part)).filter(Boolean).join("/")
    : Array.isArray(row.path)
    ? row.path.map((part) => safeText(part)).filter(Boolean).join("/")
    : "";
  const pathCandidates = [
    pathFromArray,
    safeText(row.fullNamePath),
    safeText(Array.isArray(row.subjectPath) ? "" : row.subjectPath),
    safeText(row.subject),
  ].filter(Boolean);
  const path =
    pathCandidates.find((item) => item.includes("/")) ||
    pathCandidates[0] ||
    "";
  const templateSubjectId = safeText(item.subjectId);
  const rowSubjectId = safeText(templateSubjectId || row.subjectId || row.expenseSubjectId || row.id);
  const fullNamePath = path.includes("/") ? path : safeText(row.fullNamePath || path);
  const forceProjectProfitSum = isMainProjectProfitAmountSumRow({
    ...row,
    subjectPath: path,
    fullNamePath,
    subjectName: safeText(row.subjectName || row.subject),
    subject: safeText(row.subject || row.subjectName),
  });
  const rowPathMeta = {
    ...row,
    subjectPath: path,
    fullNamePath,
    subjectName: safeText(row.subjectName || row.subject),
    subject: safeText(row.subject || row.subjectName),
  };
  const forceRatioAggregate = isForcedRatioAggregateRow(rowPathMeta);
  // 手工费率数值走加权，避免误打 ratio 导致小计变空
  const forceFeeRateWeighted = isManualFeeRateRatioLabelRow(rowPathMeta);
  return {
    ...row,
    subjectId: rowSubjectId,
    templateSubjectId,
    expenseSubjectId: safeText(row.expenseSubjectId || rowSubjectId),
    moduleCode,
    moduleName,
    fullNamePath,
    subjectPath: path,
    rowKind,
    // 设计成本保持 MANUAL，但 inputScope 收成仅首年
    inputScope: resolveMaterialDesignCostInputScope(
      { ...row, subjectPath: path, moduleCode, moduleName },
      entryMode === "MANUAL" ? REVENUE_INPUT_SCOPE.ALL : REVENUE_INPUT_SCOPE.READONLY
    ),
    formulaKey: entryMode === "CALCULATED" ? safeText(item.formulaCode || row.formulaCode) : "",
    formulaCode: entryMode === "CALCULATED" ? safeText(item.formulaCode || row.formulaCode) : "",
    formulaId: entryMode === "CALCULATED" ? item.formulaId : undefined,
    formulaText: entryMode === "CALCULATED" ? safeText(item.formulaName || row.formulaText) : "",
    formulaExpression: entryMode === "CALCULATED" ? safeText(item.formulaExpression || row.formulaExpression) : "",
    formulaParamBindings: entryMode === "CALCULATED" ? item.formulaParamBindings : [],
    // 仅项目利润三项求和、指定比率类打标；手工费率打加权；不改科目名/展示路径
    aggregateFormula: forceProjectProfitSum
      ? "sum"
      : forceFeeRateWeighted
      ? "weighted_by_mix"
      : forceRatioAggregate
      ? "ratio"
      : safeText(row.aggregateFormula || item.aggregateFormula),
    lifecycleFormula: forceProjectProfitSum
      ? "sum_year"
      : forceFeeRateWeighted
      ? "volume_weighted"
      : forceRatioAggregate
      ? "ratio"
      : safeText(row.lifecycleFormula),
    weightSourcePath: safeText(row.weightSourcePath),
    ratioNumeratorPath: safeText(row.ratioNumeratorPath),
    ratioDenominatorPath: safeText(row.ratioDenominatorPath),
    savePolicy: "subject_cell",
    valueSource,
    mainReviewable: isTargetlessMainAuditRow({ ...row, subjectPath: path }),
    reviewableInMain: isTargetlessMainAuditRow({ ...row, subjectPath: path }),
    isRealSubject: row.isRealSubject === false ? false : true,
    savable: true,
    calculated: entryMode === "CALCULATED" || entryMode === "DERIVED",
    readonly,
    templateMatched: true,
    templateSubject: true,
    templateItem: item,
    templateEntryMode: entryMode,
    entryMode,
  };
}

export function validateBackendTemplateRows(rows = []) {
  const result = {
    matched: [],
    unmatched: [],
  };
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const item = {
      subjectId: safeText(row.subjectId || row.id),
      subjectName: safeText(row.subject || row.subjectName),
      path: safeText(row.subjectPath || row.fullNamePath),
      entryMode: safeText(row.entryMode || row.templateEntryMode),
      formulaCode: safeText(row.formulaCode),
    };
    if (row.templateMatched === true && row.templateItem) {
      result.matched.push(item);
    } else {
      result.unmatched.push(item);
    }
  });
  return result;
}

function sortYearLabels(years = []) {
  const numeric = [];
  const text = [];
  years.forEach((item) => {
    if (/^\d+$/.test(item)) {
      numeric.push(item);
    } else {
      text.push(item);
    }
  });
  numeric.sort((a, b) => Number(a) - Number(b));
  text.sort((a, b) => a.localeCompare(b, "zh-CN"));
  return numeric.concat(text);
}

export function isRndTechnicalAmountRecord(row = {}, record = {}) {
  if (!isRndDoubleAmountSourceRow(row)) return false;
  if (safeText(record && record.modelYear) || safeText(record && (record.trimName || record.trimId))) return false;
  return Boolean(getRndAmountCellKeyByAggregateMode(record && record.yearAggregateMode));
}

export function isRndLegacyCalculatedRecord(row = {}, record = {}) {
  if (!isRndDoubleAmountSourceRow(row)) return false;
  return !isRndTechnicalAmountRecord(row, record);
}

function writeRndTechnicalAmountRecordToRow(row = {}, record = {}) {
  if (!isRndTechnicalAmountRecord(row, record)) return false;
  const cellKey = getRndAmountCellKeyByAggregateMode(record && record.yearAggregateMode);
  if (!cellKey) return false;
  const value = normalizeRndTechnicalAmountRecordCellValue(record);
  if (!row.cells || typeof row.cells !== "object") row.cells = {};
  if (!row.cellRecordMap || typeof row.cellRecordMap !== "object") row.cellRecordMap = {};
  if (!row.cellTargetMap || typeof row.cellTargetMap !== "object") row.cellTargetMap = {};
  if (safeText(value) !== "") {
    row.cells[cellKey] = value;
    if (cellKey === RND_INVESTMENT_TAX_INCLUDED_CELL_KEY) {
      row.rndInvestmentTaxIncludedAmount = value;
    }
    if (cellKey === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY) {
      row.rndInvestmentTaxExcludedAmount = value;
      row.rndInvestmentAmount = value;
    }
  }
  const recordMeta = buildCellTargetMeta(record, {
    yearLabel: "",
    trimId: "",
    trimName: "",
    cellKey,
    dimensionKey: cellKey,
  });
  row.cellRecordMap[cellKey] = recordMeta;
  row.cellTargetMap[cellKey] = recordMeta;
  return true;
}

function buildLeafTemplateRow(item = {}, overrides = {}) {
  return buildBackendTemplateRow({
    id: item.id,
    rowId: item.id,
    subjectId: item.subjectId,
    subjectCode: item.subjectCode,
    subject: item.subjectName,
    fullNamePath: item.fullNamePath || item.subjectName,
    subjectPath: Array.isArray(item.path) ? item.path.slice() : [],
    subjectTreePath: Array.isArray(item.path) ? item.path.slice() : [],
    unit: item.unit || "",
    subtable: item.subtable,
    rootSubjectId: item.rootSubjectId,
    rootSubjectName: item.rootSubjectName || item.subtable,
    rootSortOrder: item.rootSortOrder,
    displayRootSubjectId: item.displayRootSubjectId,
    displayRootSortOrder: item.displayRootSortOrder,
    subjectSortPath: item.subjectSortPath,
    subjectIdPath: item.subjectIdPath,
    sortOrder: item.sortOrder,
    directPermissionConfigured: item.directPermissionConfigured,
    directPermissionId: item.directPermissionId,
    directPermissionLevel: item.directPermissionLevel,
    directGrantScope: item.directGrantScope,
    directEnabled: item.directEnabled,
    effectivePermissionLevel: item.effectivePermissionLevel,
    editable: item.editable,
    readonlyReason: item.readonlyReason,
    templateItem: item.templateItem,
    templateSubject: item.templateSubject,
    templateEntryMode: item.templateEntryMode,
    entryMode: item.entryMode,
    formulaId: item.formulaId,
    formulaCode: item.formulaCode,
    formulaExpression: item.formulaExpression,
    formulaParamBindings: item.formulaParamBindings,
    isRealSubject: true,
    ...overrides,
  });
}

export function buildDetailRowsFromPermissionTree(subjectNodes = [], preferredRecords = [], trimOptions = [], buildOptions = {}) {
  const leafRows = collectPermissionLeafRows(subjectNodes);
  const seenSubjectIds = {};
  const orderedLeafRows = leafRows
    .filter((item) => {
      if (!item.subjectId || seenSubjectIds[item.subjectId]) return false;
      seenSubjectIds[item.subjectId] = true;
      return true;
    })
    .sort((a, b) => {
      const orderPathDiff = compareSubjectOrderPath(a, b);
      if (orderPathDiff !== 0) return orderPathDiff;
      const displaySortDiff = Number(a.displayRootSortOrder || 0) - Number(b.displayRootSortOrder || 0);
      if (displaySortDiff !== 0) return displaySortDiff;
      const displayRootIdDiff = compareIdText(a.displayRootSubjectId, b.displayRootSubjectId);
      if (displayRootIdDiff !== 0) return displayRootIdDiff;
      const parentPathDiff = (a.path || [])
        .slice(0, -1)
        .join("/")
        .localeCompare((b.path || []).slice(0, -1).join("/"), "zh-CN", { numeric: true });
      if (parentPathDiff !== 0) return parentPathDiff;
      const levelDiff = Number(a.level || 0) - Number(b.level || 0);
      if (levelDiff !== 0) return levelDiff;
      const sortDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      if (sortDiff !== 0) return sortDiff;
      const subjectIdDiff = compareIdText(a.subjectId, b.subjectId);
      if (subjectIdDiff !== 0) return subjectIdDiff;
      return String(a.subjectName || "").localeCompare(String(b.subjectName || ""), "zh-CN");
    });

  const yearSet = {};
  const records = dedupePreferredRecords(Array.isArray(preferredRecords) ? preferredRecords : [], buildOptions);
  const rowMetaBySubjectId = {};
  orderedLeafRows.forEach((item) => {
    rowMetaBySubjectId[item.subjectId] = buildLeafTemplateRow(item);
  });
  records.forEach((record) => {
    const rowMeta = rowMetaBySubjectId[safeText(record && record.subjectId)];
    if (rowMeta && (isRndTechnicalAmountRecord(rowMeta, record) || isRndLegacyCalculatedRecord(rowMeta, record))) {
      return;
    }
    const year = normalizeRecordYearLabel(record);
    yearSet[year] = true;
  });

  let years = sortYearLabels(Object.keys(yearSet));
  if (!years.length) {
    years = [String(new Date().getFullYear())];
  }

  const options = Array.isArray(trimOptions) && trimOptions.length
    ? trimOptions.map((item, index) => ({
        trimId: safeText(item.trimId || item.id || item.name),
        trimName: safeText(item.trimName || item.name || item.trimId),
        trimIndex: index,
      }))
    : [{ trimId: "默认版型", trimName: "默认版型", trimIndex: 0 }];

  const normalizedOptions = options
    .filter((item) => item.trimId)
    .map((item, index) => ({
      trimId: item.trimId,
      trimName: item.trimName || item.trimId,
      trimIndex: index,
    }));

  const yearIndexMap = {};
  years.forEach((year, index) => {
    yearIndexMap[year] = index;
  });
  const trimIndexMap = {};
  normalizedOptions.forEach((item) => {
    trimIndexMap[item.trimId] = Number(item.trimIndex);
    trimIndexMap[item.trimName] = Number(item.trimIndex);
  });

  const rowMap = {};
  const rows = orderedLeafRows.map((item) => {
    const row = buildLeafTemplateRow(item, {
      owner: "",
      readonly: false,
      calculated: false,
      inputType: "number",
      cells: {},
      cellMap: {},
      cellRecordMap: {},
      cellTargetMap: {},
    });
    rowMap[item.subjectId] = row;
    return row;
  });

  records.forEach((record) => {
    const subjectId = safeText(record && record.subjectId);
    const row = rowMap[subjectId];
    if (!row) return;
    if (writeRndTechnicalAmountRecordToRow(row, record)) return;
    if (isRndLegacyCalculatedRecord(row, record)) return;
    const yearOnly = isRevenueYearOnlyRow(row);
    if (yearOnly && safeText(record && record.trimName)) return;

    const year = normalizeRecordYearLabel(record);
    const trimName = yearOnly ? "" : normalizeRecordTrimLabel(record);
    const value = normalizeRecordCellValue(record);

    const yearIndex = yearIndexMap[year];
    const trimIndex = yearOnly ? YEAR_ONLY_TRIM_INDEX : trimIndexMap[trimName];
    if (!Number.isInteger(yearIndex) || !Number.isInteger(trimIndex)) return;

    const trimId = yearOnly ? "" : normalizedOptions[trimIndex] && normalizedOptions[trimIndex].trimId;
    if (!yearOnly && !trimId) return;

    const cellKey = `y${yearIndex}_t${trimIndex}`;
    const recordMeta = buildCellTargetMeta(record, {
      yearLabel: year,
      trimId,
      trimName: yearOnly ? "" : normalizedOptions[trimIndex] && normalizedOptions[trimIndex].trimName,
      trimIndex,
      cellKey,
    });
    row.cellRecordMap[`${year}__${trimId}`] = recordMeta;
    row.cellRecordMap[cellKey] = recordMeta;
    row.cellTargetMap[`${year}__${trimId}`] = recordMeta;
    row.cellTargetMap[cellKey] = recordMeta;
    if (safeText(value) === "") return;
    row.cellMap[`${year}__${trimId}`] = value;
    row.cells[cellKey] = value;
  });

  const yearTrimConfig = {};
  years.forEach((year) => {
    yearTrimConfig[year] = normalizedOptions.map((item) => item.trimId);
  });

  return {
    dimensions: {
      years,
      trims: normalizedOptions.map((item) => item.trimName),
    },
    trimOptions: normalizedOptions,
    yearTrimConfig,
    rows,
    templateValidation: validateBackendTemplateRows(rows),
  };
}
