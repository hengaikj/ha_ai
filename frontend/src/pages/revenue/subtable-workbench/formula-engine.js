import {
  REVENUE_CALCULATION_ORDER,
  REVENUE_MODULE_CODE,
  REVENUE_MODULE_NAME_ALIASES,
  isRevenueYearOnlyRow,
  resolveRevenueModuleCodeByPath,
} from "./domain-config";
import {
  isMaterialDesignCostInputRow,
  isMaterialDesignCostReductionRateRow,
  isMaterialLisenceRow,
} from "./material-design-cost";
import {
  formatFormulaValueForStorage,
  toStorageValue,
} from "./value-normalizer";
import {
  aggregateNumbers,
  aggregateRatio,
  isRatioAggregateFormula,
  isWeightedAggregateFormula,
} from "./aggregate-engine";
import {
  readMatrixCellValue,
  writeMatrixCellValue,
  isForcedRatioAggregateRow,
} from "./matrix-utils";

export const REVENUE_FORMULA_CALCULATION_MODE = Object.freeze({
  SOURCE_TO_MAIN: "source_to_main",
  MAIN_AUDIT: "main_audit",
});

function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function normalizeFormulaText(value) {
  return safeText(value)
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "")
    .replace(/[/\\|｜>＞\-—_]/g, "")
    .toLowerCase();
}

export function toNumber(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!text || text === "-") return null;
  const num = Number(text.replace(/,/g, "").replace(/[%％]$/, ""));
  return Number.isFinite(num) ? num : null;
}

function toRatio(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  const num = toNumber(text);
  if (num === null) return null;
  if (/[%％]$/.test(text)) return num / 100;
  return num;
}

function toPercentRatio(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  const num = toNumber(text);
  if (num === null) return null;
  if (/[%％]$/.test(text)) return num / 100;
  return num;
}

function roundNumber(value, precision = 4) {
  if (!Number.isFinite(value)) return null;
  const base = Math.pow(10, precision);
  return Math.round(value * base) / base;
}

function formatFormulaValue(value, row = {}, precision = 4, options = {}) {
  if (options.valueMode === "display") {
    const normalized = toStorageValue(value, row && row.unit, { precision });
    return normalized.ok && normalized.storageValue != null
      ? normalized.storageValue
      : safeText(value);
  }
  return formatFormulaValueForStorage(value, row, { precision });
}

function ensureCells(row) {
  if (!row.cells || typeof row.cells !== "object") row.cells = {};
  return row.cells;
}

function isFormulaCellLocked(row, cellKey) {
  if (!row || !cellKey) return false;
  if (row.__revenueIgnoreFormulaLocks) return false;
  const maps = [
    row.formulaLockedCellMap,
    row.reviewLockedCellMap,
    row.lockedCellMap,
  ];
  return maps.some(
    (map) =>
      map &&
      typeof map === "object" &&
      Object.prototype.hasOwnProperty.call(map, cellKey),
  );
}

function resolveCellKey(yearIndex, trimIndex) {
  return `y${yearIndex}_t${trimIndex}`;
}

function getRowPath(row = {}) {
  const path =
    row.fullNamePath ||
    row.subjectPath ||
    row.fullPath ||
    row.path ||
    [row.rootSubjectName, row.subtable, row.subject].filter(Boolean).join("/");
  if (Array.isArray(path))
    return path
      .map((item) => safeText(item))
      .filter(Boolean)
      .join("/");
  return safeText(path);
}

function inferLifecycleFormula(row = {}, meta = {}) {
  const explicit = safeText(meta.lifecycleFormula || row.lifecycleFormula);
  if (explicit) return explicit;
  const path = getRowPath(row);
  const subject = safeText(row.subjectName || row.subject);
  if (/MIX$/i.test(subject) || /MIX$/i.test(path)) return "mix";
  const aggregate = safeText(
    meta.aggregateFormula || row.aggregateFormula,
    "sum",
  ).toLowerCase();
  if (aggregate === "weighted" || aggregate === "weighted_by_mix")
    return "volume_weighted";
  if (aggregate === "ratio") return "ratio";
  return "sum_year";
}

function getBackendTemplateEntryMode(row = {}) {
  return safeText(
    row.templateEntryMode ||
      row.entryMode ||
      (row.templateItem && row.templateItem.entryMode),
  ).toUpperCase();
}

function hasBackendTemplateMeta(row = {}) {
  return Boolean(
    row &&
    (row.templateItem ||
      row.templateSubject ||
      getBackendTemplateEntryMode(row)),
  );
}

function parseFormulaParamBindings(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function getFormulaRowLabel(row = {}) {
  return safeText(
    row.fullNamePath ||
      row.subjectPath ||
      row.path ||
      row.subjectName ||
      row.subject ||
      row.subjectId,
    "-",
  );
}

function isSystemDerivedMixRow(row = {}) {
  const subject = safeText(row.subjectName || row.subject);
  const path = getFormulaRowLabel(row);
  return /mix$/i.test(subject) || /(^|\/)[^/]*mix$/i.test(path);
}

function assertBackendCalculatedFormulaRow(row = {}, action = "公式计算") {
  if (!hasBackendTemplateMeta(row)) {
    throw new Error(`${action}缺少后端模板元数据：${getFormulaRowLabel(row)}`);
  }
  const entryMode = getBackendTemplateEntryMode(row);
  if (entryMode !== "CALCULATED") {
    throw new Error(
      `${action}禁止写入非计算型模板科目：${getFormulaRowLabel(row)}(${entryMode || "UNKNOWN"})`,
    );
  }
  const bindings = parseFormulaParamBindings(row.formulaParamBindings);
  if (!safeText(row.formulaCode || row.formulaKey) && row.formulaId == null) {
    throw new Error(`${action}缺少后端公式配置：${getFormulaRowLabel(row)}`);
  }
  if (!bindings.length) {
    throw new Error(
      `${action}缺少后端公式参数绑定：${getFormulaRowLabel(row)}`,
    );
  }
}

function assertBackendSystemFormulaRow(row = {}, action = "公式计算") {
  if (!hasBackendTemplateMeta(row)) {
    throw new Error(`${action}缺少后端模板元数据：${getFormulaRowLabel(row)}`);
  }
  const entryMode = getBackendTemplateEntryMode(row);
  if (entryMode === "CALCULATED") {
    assertBackendCalculatedFormulaRow(row, action);
    return;
  }
  if (entryMode === "DERIVED") return;
  throw new Error(
    `${action}禁止写入非计算型模板科目：${getFormulaRowLabel(row)}(${entryMode || "UNKNOWN"})`,
  );
}

function markFormulaRow(row, meta = {}) {
  if (!row || typeof row !== "object") return;
  if (hasBackendTemplateMeta(row)) {
    const entryMode = getBackendTemplateEntryMode(row);
    if (entryMode !== "CALCULATED" && entryMode !== "DERIVED") return;
    assertBackendSystemFormulaRow(row, "公式标记");
  } else {
    throw new Error(`公式标记缺少后端模板元数据：${getFormulaRowLabel(row)}`);
  }
  row.calculated = meta.rowKind !== "input";
  if (meta.rowKind) row.rowKind = meta.rowKind;
  if (
    meta.code &&
    !row.formulaCode &&
    getBackendTemplateEntryMode(row) !== "DERIVED"
  )
    row.formulaCode = meta.code;
  if (meta.formulaText) row.formulaText = meta.formulaText;
  if (meta.aggregateFormula) row.aggregateFormula = meta.aggregateFormula;
  const lifecycleFormula = inferLifecycleFormula(row, meta);
  if (lifecycleFormula) row.lifecycleFormula = lifecycleFormula;
  if (meta.weightSourcePath) row.weightSourcePath = meta.weightSourcePath;
  if (meta.mainReviewable) {
    row.mainReviewable = true;
    row.reviewableInMain = true;
  }
  if (
    !row.weightSourcePath &&
    (lifecycleFormula === "volume_weighted" || lifecycleFormula === "mix")
  ) {
    row.weightSourcePath = "销量表/销量";
  }
  if (meta.ratioNumeratorPath) row.ratioNumeratorPath = meta.ratioNumeratorPath;
  if (meta.ratioDenominatorPath)
    row.ratioDenominatorPath = meta.ratioDenominatorPath;
}

export const RevenueFormulaFns = Object.freeze({
  number: toNumber,
  ratio: toRatio,

  sum(values = []) {
    const nums = (Array.isArray(values) ? values : [])
      .map((item) => toNumber(item))
      .filter((item) => item !== null);
    return nums.reduce((total, item) => total + item, 0);
  },

  sumYear(values = []) {
    return RevenueFormulaFns.sum(values);
  },

  safeDiv(numerator, denominator, fallback = "") {
    const n = toNumber(numerator);
    const d = toNumber(denominator);
    if (n === null || d === null || d === 0) return fallback;
    return n / d;
  },

  weightedByMix(values = [], mixes = []) {
    const valueList = Array.isArray(values) ? values : [];
    const mixList = Array.isArray(mixes) ? mixes : [];
    let total = 0;
    let hasValue = false;
    valueList.forEach((value, index) => {
      const num = toNumber(value);
      const mix = toPercentRatio(mixList[index]);
      if (num === null || mix === null) return;
      total += num * mix;
      hasValue = true;
    });
    return hasValue ? total : "";
  },

  taxExcluded(value, taxRate = 0.13) {
    const num = toNumber(value);
    const rate = toRatio(taxRate);
    if (num === null || rate === null) return "";
    return num / (1 + rate);
  },

  round(value, precision = 4) {
    const num = toNumber(value);
    if (num === null) return "";
    return roundNumber(num, precision);
  },
});

function buildModuleIndex(rows = []) {
  const rowList = Array.isArray(rows) ? rows : [];
  return {
    rows: rowList,
    findRow(candidates = []) {
      const list = Array.isArray(candidates) ? candidates : [candidates];
      const normalizedCandidates = list.reduce((result, item) => {
        const text = safeText(item);
        const normalized = normalizeFormulaText(text);
        if (normalized) result.push(normalized);
        const parts = text
          .split(/[/\\|｜>＞]/)
          .map((part) => safeText(part))
          .filter(Boolean);
        const tail =
          parts.length > 2
            ? normalizeFormulaText(parts.slice(1).join("/"))
            : "";
        if (tail && !result.includes(tail)) result.push(tail);
        return result;
      }, []);
      if (!normalizedCandidates.length) return null;
      const rowPaths = rowList.map((row) => ({
        row,
        path: normalizeFormulaText(getRowPath(row)),
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
        const hit = rowPaths.find((item) => item.path.includes(candidate));
        if (hit) return hit.row;
      }
      return null;
    },
  };
}

function moduleCodeFromRow(row = {}) {
  const explicitModuleCode = safeText(row && row.moduleCode).toLowerCase();
  if (explicitModuleCode && REVENUE_MODULE_NAME_ALIASES[explicitModuleCode]) {
    return explicitModuleCode;
  }
  const pathText = getRowPath(row);
  const pathModuleCode = resolveRevenueModuleCodeByPath(pathText);
  if (pathModuleCode) return pathModuleCode;
  const path = normalizeFormulaText(pathText);
  const subtable = normalizeFormulaText(row.subtable);
  const subject = normalizeFormulaText(row.subject);
  const keys = Object.keys(REVENUE_MODULE_NAME_ALIASES);
  for (let i = 0; i < keys.length; i += 1) {
    const moduleCode = keys[i];
    const aliases = REVENUE_MODULE_NAME_ALIASES[moduleCode] || [];
    const matched = aliases.some((alias) => {
      const normalizedAlias = normalizeFormulaText(alias);
      return (
        path.includes(normalizedAlias) ||
        subtable.includes(normalizedAlias) ||
        subject === normalizedAlias
      );
    });
    if (matched) return moduleCode;
  }
  return "";
}

function isMainAuditCalculationMode(options = {}) {
  const mode = safeText(
    options.calculationMode ||
      options.formulaCalculationMode ||
      options.formulaMode,
  ).toLowerCase();
  return (
    mode === REVENUE_FORMULA_CALCULATION_MODE.MAIN_AUDIT ||
    options.mainAuditOnly === true
  );
}

function isMainFormulaRow(row = {}) {
  return moduleCodeFromRow(row) === REVENUE_MODULE_CODE.MAIN_PNL;
}

function filterDetailRows(detail = {}, predicate = null) {
  const rows = Array.isArray(detail && detail.rows) ? detail.rows : [];
  return {
    ...(detail || {}),
    rows:
      typeof predicate === "function" ? rows.filter(predicate) : rows.slice(),
  };
}

function collectDetailsRows(details = []) {
  const list = Array.isArray(details) ? details : [details];
  const rows = [];
  list.forEach((detail) => {
    if (!detail || typeof detail !== "object") return;
    const detailRows = Array.isArray(detail.rows) ? detail.rows : [];
    detailRows.forEach((row) => rows.push(row));
  });
  return rows;
}

export function buildRevenueFormulaModules(details = []) {
  const rows = collectDetailsRows(details);
  const bucket = {};
  rows.forEach((row) => {
    const moduleCode = moduleCodeFromRow(row);
    if (!moduleCode) return;
    if (!bucket[moduleCode]) bucket[moduleCode] = [];
    bucket[moduleCode].push(row);
  });

  const modules = {};
  Object.keys(bucket).forEach((moduleCode) => {
    modules[moduleCode] = buildModuleIndex(bucket[moduleCode]);
  });
  return modules;
}

function detailContainsModuleRows(detail, moduleCode) {
  const rows = detail && Array.isArray(detail.rows) ? detail.rows : [];
  return rows.some((row) => moduleCodeFromRow(row) === moduleCode);
}

function parseFormulaCellKey(cellKey = "") {
  const match = /^y(\d+)_t(\d+)$/.exec(safeText(cellKey));
  if (!match) return null;
  return {
    yearIndex: Number(match[1]),
    trimIndex: Number(match[2]),
  };
}

function readYearOnlyCell(row, cellKey, dimension = {}) {
  if (!row || typeof row !== "object") return null;
  const cells = row.cells && typeof row.cells === "object" ? row.cells : {};
  const parsed = parseFormulaCellKey(cellKey);
  if (parsed) {
    const yearOnlyKey = `y${parsed.yearIndex}_t0`;
    if (Object.prototype.hasOwnProperty.call(cells, yearOnlyKey))
      return cells[yearOnlyKey];
  }
  const year = safeText(dimension.year || dimension.yearLabel);
  if (!year) return null;
  const cellMap =
    (row.cellMap && typeof row.cellMap === "object" ? row.cellMap : null) ||
    (row.cellsByDimension && typeof row.cellsByDimension === "object"
      ? row.cellsByDimension
      : null) ||
    (row.dimensionCells && typeof row.dimensionCells === "object"
      ? row.dimensionCells
      : null);
  if (cellMap && Object.prototype.hasOwnProperty.call(cellMap, `${year}__`)) {
    return cellMap[`${year}__`];
  }
  return null;
}

function writeFormulaCell(row, cellKey, value, precision, dimension = {}) {
  if (!row) return;
  const entryMode = getBackendTemplateEntryMode(row);
  // force=true 时跳过 entryMode 检查，允许公式引擎对 MANUAL 行进行计算写入
  // （如 writeTargetVolumeMixRow 对 MIX 行的写入、applyBackendDynamicFormulas 对主表行的写入）
  if (
    !dimension.force &&
    hasBackendTemplateMeta(row) &&
    entryMode !== "CALCULATED" &&
    entryMode !== "DERIVED"
  ) {
    return;
  }
  if (
    dimension.preserveFormulaLocks === true &&
    isFormulaCellLocked(row, cellKey)
  )
    return;
  if (shouldPreserveBackendDynamicFormulaCell(row, dimension)) return;
  if (dimension.force) {
    // force=true 时跳过 assertBackendSystemFormulaRow，因为 MANUAL 行也可以被公式引擎计算写入
    if (!hasBackendTemplateMeta(row)) {
      throw new Error(`公式写入缺少后端模板元数据：${getFormulaRowLabel(row)}`);
    }
  } else {
    assertBackendSystemFormulaRow(row, "公式写入");
  }
  if (!dimension.force && isFormulaCellLocked(row, cellKey)) return;
  const cells = ensureCells(row);
  const formattedValue =
    dimension.rawValue === true
      ? String(value == null ? "" : value)
      : formatFormulaValue(value, row, precision, dimension);
  cells[cellKey] = formattedValue;
  const year = safeText(dimension.year);
  const trim = dimension.trim;
  const trimId = safeText(
    dimension.trimId ||
      (trim && typeof trim === "object"
        ? trim.trimId || trim.id || trim.code || trim.name || trim.label
        : trim),
  );
  if (year && trimId) {
    if (!row.cellMap || typeof row.cellMap !== "object") row.cellMap = {};
    row.cellMap[`${year}__${trimId}`] = formattedValue;
  }
}

function writeRndInvestmentDerivedCell(
  row,
  cellKey,
  value,
  precision,
  dimension = {},
) {
  if (!row || !isRndDoubleAmountSourceRow(row)) return;
  if (!dimension.force && isFormulaCellLocked(row, cellKey)) return;
  const formattedValue =
    dimension.rawValue === true
      ? String(value == null ? "" : value)
      : formatFormulaValue(value, row, precision, dimension);
  writeMatrixCellValue(row, { ...dimension, cellKey }, formattedValue);
}

function safeFormulaDiv(a, b) {
  const result = RevenueFormulaFns.safeDiv(a, b, null);
  return result == null ? "" : result;
}

function decodeFormulaExpressionText(value) {
  return safeText(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#36;/g, "$");
}

function getBackendFormulaExpression(row = {}) {
  const item =
    row.templateItem && typeof row.templateItem === "object"
      ? row.templateItem
      : {};
  return decodeFormulaExpressionText(
    row.formulaExpression ||
      row.formula_expression ||
      row.expression ||
      item.formulaExpression ||
      item.formula_expression ||
      item.expression,
  );
}

function shouldPreserveBackendDynamicFormulaCell(row = {}, dimension = {}) {
  if (dimension.backendDynamicFormula === true) return false;
  if (getBackendTemplateEntryMode(row) !== "CALCULATED") return false;
  if (!getBackendFormulaExpression(row)) return false;
  return parseFormulaParamBindings(row.formulaParamBindings).length > 0;
}

function getFormulaParamCode(binding = {}, index = 0) {
  return safeText(
    binding.paramCode ||
      binding.parameterCode ||
      binding.parameterKey ||
      binding.param ||
      binding.key ||
      binding.code ||
      binding.paramName ||
      binding.parameterName ||
      binding.parameterLabel ||
      binding.label ||
      binding.name,
    `P${index + 1}`,
  );
}

function collectFormulaRowIdentityValues(row = {}) {
  const item =
    row.templateItem && typeof row.templateItem === "object"
      ? row.templateItem
      : {};
  // 仅用科目身份匹配，禁止用 template_item 主键（row.id/rowId/item.id）参与比对，避免与 subjectId 串号
  return [
    row.subjectId,
    row.templateSubjectId,
    row.expenseSubjectId,
    row.subjectCode,
    item.subjectId,
    item.subjectCode,
  ]
    .map((itemValue) => safeText(itemValue))
    .filter(Boolean);
}

function collectFormulaBindingSubjectIds(binding = {}) {
  return [
    binding.subjectId,
    binding.sourceSubjectId,
    binding.templateSubjectId,
    binding.expenseSubjectId,
    binding.refSubjectId,
    binding.sourceId,
    binding.subjectCode,
  ]
    .map((item) => safeText(item))
    .filter(Boolean);
}

function collectFormulaBindingPathCandidates(binding = {}) {
  return [
    binding.subjectPath,
    binding.sourceSubjectPath,
    binding.fullNamePath,
    binding.path,
    binding.subjectName,
  ]
    .map((item) => safeText(item))
    .filter(Boolean);
}

function normalizeDirectFormulaExpression(value = "") {
  let text = decodeFormulaExpressionText(value)
    .replace(/^\s*=/, "")
    .replace(/\s+/g, "");
  while (text.startsWith("(") && text.endsWith(")") && text.length > 2) {
    text = text.slice(1, -1);
  }
  return text;
}

function isDirectBackendFormulaReference(
  expression = "",
  binding = {},
  index = 0,
) {
  const text = normalizeDirectFormulaExpression(expression);
  const tokenMatch = text.match(/^\$\{([^}]+)\}$/);
  const token = tokenMatch ? tokenMatch[1] : text;
  return (
    token ===
    normalizeDirectFormulaExpression(getFormulaParamCode(binding, index))
  );
}

function isMainFormulaBindingCandidate(binding = {}) {
  const moduleCode = safeText(binding.moduleCode).toLowerCase();
  if (moduleCode === REVENUE_MODULE_CODE.MAIN_PNL) return true;
  const moduleName = safeText(
    binding.moduleName || binding.subtable || binding.rootSubjectName,
  );
  if (
    (REVENUE_MODULE_NAME_ALIASES[REVENUE_MODULE_CODE.MAIN_PNL] || []).includes(
      moduleName,
    )
  )
    return true;
  const path = safeText(collectFormulaBindingPathCandidates(binding)[0])
    .replace(/[\\]+/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
  return (
    path === "主表" ||
    path.startsWith("主表/") ||
    path.startsWith("单车收益/") ||
    path.startsWith("项目利润/")
  );
}

function shouldPreserveMissingMainDirectReference(
  row = {},
  bindings = [],
  missingIndex = -1,
  options = {},
) {
  if (!isMainAuditCalculationMode(options)) return false;
  if (moduleCodeFromRow(row) !== REVENUE_MODULE_CODE.MAIN_PNL) return false;
  if (getBackendTemplateEntryMode(row) !== "CALCULATED") return false;
  if (!Array.isArray(bindings) || bindings.length !== 1 || missingIndex !== 0)
    return false;
  if (
    !isDirectBackendFormulaReference(
      getBackendFormulaExpression(row),
      bindings[0],
      0,
    )
  )
    return false;
  return !isMainFormulaBindingCandidate(bindings[0]);
}

function shouldPreserveMissingMainAuditSourceFormula(
  row = {},
  bindings = [],
  missingIndex = -1,
  options = {},
) {
  if (!isMainAuditCalculationMode(options)) return false;
  if (moduleCodeFromRow(row) !== REVENUE_MODULE_CODE.MAIN_PNL) return false;
  if (getBackendTemplateEntryMode(row) !== "CALCULATED") return false;
  if (!Array.isArray(bindings) || missingIndex < 0) return false;
  return !isMainFormulaBindingCandidate(bindings[missingIndex] || {});
}

function findBackendFormulaSourceRow(binding = {}, rows = []) {
  const subjectIds = collectFormulaBindingSubjectIds(binding);
  if (subjectIds.length) {
    const hit = (Array.isArray(rows) ? rows : []).find((row) => {
      const rowKeys = collectFormulaRowIdentityValues(row);
      return subjectIds.some((subjectId) => rowKeys.includes(subjectId));
    });
    if (hit) return hit;
  }

  const pathCandidates = collectFormulaBindingPathCandidates(binding);
  if (pathCandidates.length) {
    const index = buildModuleIndex(rows);
    return index.findRow(pathCandidates);
  }
  return null;
}

function collectFormulaExpressionParamCodes(expression = "", bindings = []) {
  const result = [];
  const add = (value) => {
    const text = safeText(value);
    if (text && !result.includes(text)) result.push(text);
  };
  const pattern = /\$\{\s*([^}]+?)\s*\}/g;
  let match = pattern.exec(expression);
  while (match) {
    add(match[1]);
    match = pattern.exec(expression);
  }
  if (result.length) return result;
  (Array.isArray(bindings) ? bindings : []).forEach((binding, index) => {
    add(getFormulaParamCode(binding, index));
  });
  return result;
}

function evaluateBackendFormulaExpression(
  expression = "",
  paramValues = {},
  bindings = [],
) {
  const text = decodeFormulaExpressionText(expression);
  if (!text) return "";
  const paramCodes = collectFormulaExpressionParamCodes(text, bindings);

  let transformed = text.replace(/\$\{\s*([^}]+?)\s*\}/g, (_, rawCode) => {
    const code = safeText(rawCode);
    const index = paramCodes.indexOf(code);
    return `__param(${index})`;
  });
  if (transformed === text) {
    paramCodes
      .slice()
      .sort((a, b) => b.length - a.length)
      .forEach((code) => {
        const token = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        transformed = transformed.replace(
          new RegExp(`\\b${token}\\b`, "g"),
          `__param("${code}")`,
        );
      });
  }

  if (!/^[0-9+\-*/%().,\s_A-Za-z"']+$/.test(transformed)) {
    throw new Error(`后端公式表达式包含暂不支持的字符：${text}`);
  }

  const readParam = (indexOrCode) => {
    const code =
      typeof indexOrCode === "number" ? paramCodes[indexOrCode] : indexOrCode;
    const value = toNumber(paramValues[code]);
    return value === null ? 0 : value;
  };
  const safeDiv = (numerator, denominator) =>
    RevenueFormulaFns.safeDiv(numerator, denominator, "");
  const sum = (...values) => RevenueFormulaFns.sum(values);
  const round = (value, precision = 4) =>
    RevenueFormulaFns.round(value, precision);
  const fn = new Function(
    "__param",
    "SAFE_DIV",
    "safeDiv",
    "SUM",
    "MIN",
    "MAX",
    "ABS",
    "ROUND",
    `"use strict"; return (${transformed});`,
  );
  const result = fn(
    readParam,
    safeDiv,
    safeDiv,
    sum,
    Math.min,
    Math.max,
    Math.abs,
    round,
  );
  if (result === "" || result == null) return "";
  const num = Number(result);
  return Number.isFinite(num) ? num : "";
}

function collectBackendDynamicFormulaRows(detail = {}, modules = {}) {
  const rows = [];
  const pushRow = (row) => {
    if (!row || typeof row !== "object") return;
    if (!rows.includes(row)) rows.push(row);
  };
  (Array.isArray(detail && detail.rows) ? detail.rows : []).forEach(pushRow);
  Object.keys(modules || {}).forEach((moduleCode) => {
    const module = modules[moduleCode];
    (Array.isArray(module && module.rows) ? module.rows : []).forEach(pushRow);
  });
  return rows;
}

function applyBackendDynamicFormulas(detail, modules = {}, options = {}) {
  if (!detail || !Array.isArray(detail.rows)) return 0;
  const allRows = collectBackendDynamicFormulaRows(detail, modules);
  const targetRows = detail.rows.filter((row) => {
    if (getBackendTemplateEntryMode(row) !== "CALCULATED") return false;
    if (isSystemDerivedMixRow(row)) return false;
    if (!getBackendFormulaExpression(row)) return false;
    return parseFormulaParamBindings(row.formulaParamBindings).length > 0;
  });
  if (!targetRows.length) return 0;

  const updatedRowSet = new Set();
  for (let pass = 0; pass < targetRows.length; pass += 1) {
    targetRows.forEach((row) => {
      const expression = getBackendFormulaExpression(row);
      const bindings = parseFormulaParamBindings(row.formulaParamBindings);
      const sourceRows = bindings.map((binding) =>
        findBackendFormulaSourceRow(binding, allRows),
      );
      const missingIndex = sourceRows.findIndex((sourceRow) => !sourceRow);
      if (missingIndex >= 0) {
        if (
          shouldPreserveMissingMainDirectReference(
            row,
            bindings,
            missingIndex,
            options,
          ) ||
          shouldPreserveMissingMainAuditSourceFormula(
            row,
            bindings,
            missingIndex,
            options,
          ) ||
          // 现场计算器等仅主表场景：缺失子表绑定时跳过该行，避免整次测算被中断
          options.ignoreMissingFormulaBindings === true
        )
          return;
        const binding = bindings[missingIndex] || {};
        throw new Error(
          `后端公式计算找不到参数绑定科目：${getFormulaRowLabel(row)}.${getFormulaParamCode(binding, missingIndex)}`,
        );
      }
      forEachDetailCell(detail, ({ year, trim, trimId, cellKey }) => {
        const dimension = {
          year,
          trim,
          trimId,
          force: true,
          backendDynamicFormula: true,
          preserveFormulaLocks: isMainAuditCalculationMode(options),
        };
        const paramValues = bindings.reduce((values, binding, index) => {
          const code = getFormulaParamCode(binding, index);
          const sourceRow = sourceRows[index];
          values[code] = isRevenueYearOnlyRow(sourceRow)
            ? readYearOnlyCell(sourceRow, cellKey, dimension)
            : readRowCell(sourceRow, cellKey, dimension);
          return values;
        }, {});
        const value = evaluateBackendFormulaExpression(
          expression,
          paramValues,
          bindings,
        );
        writeFormulaCell(row, cellKey, value, 4, dimension);
        updatedRowSet.add(row);
      });
    });
  }
  return updatedRowSet.size;
}

const TARGET_SALES_VOLUME_PATHS = Object.freeze([
  "销量表/销量",
  "销量",
  "销量表/目标销量",
  "目标销量",
]);
const SALES_VOLUME_MIX_PATHS = Object.freeze([
  "销量表/MIX",
  "MIX",
  "销量表/销量MIX",
  "销量MIX",
  "销量表/目标销量首年MIX",
  "目标销量首年MIX",
  "销量表/目标首年MIX",
  "目标首年MIX",
]);
const MATERIAL_DESIGN_MIX_PATHS = Object.freeze([
  "材料成本/设计成本/MIX",
  "设计成本/MIX",
  "材料成本/设计成本（含零部件摊销）/MIX",
]);
const PRODUCT_SELF_SALES_TARGET_PATHS = Object.freeze([
  "产品竞争力分析/本品信息/销量/本品销量目标",
  "本品信息/销量/本品销量目标",
  "销量/本品销量目标",
  "本品销量目标",
]);
const PRODUCT_SELF_SALES_MIX_PATHS = Object.freeze([
  "产品竞争力分析/本品信息/销量/本品销量MIX",
  "本品信息/销量/本品销量MIX",
  "销量/本品销量MIX",
  "本品销量MIX",
]);
const MAIN_PNL_MIX_PATHS = Object.freeze([
  "主表/单车收益/MIX",
  "单车收益/MIX",
  "主表/MIX",
]);
const MAIN_PNL_SALES_VOLUME_PATHS = Object.freeze([
  "主表/项目利润/销量",
  "项目利润/销量",
  "主表/项目利润/项目销量",
  "项目利润/项目销量",
  "主表/单车收益/销量",
  "单车收益/销量",
]);
function getTargetSalesVolumeRow(modules = {}) {
  const salesModule = modules[REVENUE_MODULE_CODE.SALES_VOLUME];
  return (
    (salesModule && salesModule.findRow(TARGET_SALES_VOLUME_PATHS)) || null
  );
}

function findMainPnlMixRow(rows = [], index = null) {
  const indexedRow =
    index && typeof index.findRow === "function"
      ? index.findRow(MAIN_PNL_MIX_PATHS)
      : null;
  if (
    indexedRow &&
    moduleCodeFromRow(indexedRow) === REVENUE_MODULE_CODE.MAIN_PNL
  )
    return indexedRow;
  return (
    (Array.isArray(rows) ? rows : []).find(
      (row) =>
        moduleCodeFromRow(row) === REVENUE_MODULE_CODE.MAIN_PNL &&
        isSystemDerivedMixRow(row),
    ) || null
  );
}

function getMainPnlSalesVolumeRow(index = null, modules = {}) {
  const targetRow =
    index && typeof index.findRow === "function"
      ? index.findRow(MAIN_PNL_SALES_VOLUME_PATHS)
      : null;
  if (targetRow) return targetRow;
  const mainModule = modules[REVENUE_MODULE_CODE.MAIN_PNL];
  return (
    (mainModule && mainModule.findRow(MAIN_PNL_SALES_VOLUME_PATHS)) || null
  );
}

function rowHasFormulaCellValue(row, detail = null) {
  if (!row) return false;
  if (detail && Array.isArray(detail.rows)) {
    let hasValue = false;
    forEachDetailCell(detail, ({ year, trim, trimId, cellKey }) => {
      if (hasValue) return;
      hasValue = hasFormulaCellValue(
        readRowCell(row, cellKey, { year, trim, trimId }),
      );
    });
    return hasValue;
  }
  return Object.keys((row && row.cells) || {}).some((cellKey) =>
    hasFormulaCellValue(row.cells[cellKey]),
  );
}

function canWriteBackendSystemFormulaRow(row = {}) {
  const entryMode = getBackendTemplateEntryMode(row);
  return entryMode === "CALCULATED" || entryMode === "DERIVED";
}

function writeDerivedReferenceRow(detail, targetRow, sourceRow, meta = {}) {
  if (!detail || !targetRow || !sourceRow) return 0;
  if (!canWriteBackendSystemFormulaRow(targetRow)) return 0;
  markFormulaRow(targetRow, {
    code: meta.code,
    formulaText: meta.formulaText,
    rowKind: "formula",
    aggregateFormula: meta.aggregateFormula || "sum",
  });
  forEachDetailCell(detail, ({ year, trim, trimId, cellKey }) => {
    const dimension = { year, trim, trimId };
    writeFormulaCell(
      targetRow,
      cellKey,
      readRowCell(sourceRow, cellKey, dimension),
      4,
      {
        year,
        trim,
        trimId,
        force: true,
      },
    );
  });
  return 1;
}

function getLifecycleTotalFromRow(row, detail = null) {
  if (!row) return 0;
  if (detail) {
    const values = [];
    forEachDetailCell(detail, ({ year, trim, trimId, cellKey }) => {
      values.push(readRowCell(row, cellKey, { year, trim, trimId }));
    });
    return RevenueFormulaFns.sum(values);
  }
  if (!row.cells || typeof row.cells !== "object") return 0;
  return RevenueFormulaFns.sum(
    Object.keys(row.cells)
      .filter((cellKey) => /^y\d+_t\d+$/.test(cellKey))
      .map((cellKey) => row.cells[cellKey]),
  );
}

function writeTargetVolumeMixRow(
  detail,
  targetRow,
  sourceVolumeRow,
  meta = {},
) {
  if (!detail || !targetRow || !sourceVolumeRow) return 0;
  markFormulaRow(targetRow, {
    code: meta.code,
    formulaText: meta.formulaText || "销量表/销量 / 当前年销量合计",
    rowKind: "formula",
    aggregateFormula: "sum",
  });
  forEachDetailCell(detail, ({ year, yearIndex, trim, trimId, cellKey }) => {
    const trimEntries = getDetailTrimEntries(detail, year);
    const yearVolumeTotal = getYearTotalFromRow(
      sourceVolumeRow,
      yearIndex,
      trimEntries,
      year,
    );
    writeFormulaCell(
      targetRow,
      cellKey,
      yearVolumeTotal
        ? safeFormulaDiv(
            readRowCell(sourceVolumeRow, cellKey, { year, trim, trimId }),
            yearVolumeTotal,
          )
        : "",
      4,
      { year, trim, trimId, force: true },
    );
  });
  return 1;
}

export const RND_INVESTMENT_TAX_INCLUDED_CELL_KEY =
  "__rnd_investment_tax_included_amount";
export const RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY =
  "__rnd_investment_tax_excluded_amount";
export const RND_INVESTMENT_AMOUNT_CELL_KEY =
  RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY;

export const RND_AMOUNT_AGGREGATE_MODE = Object.freeze({
  TAX_INCLUDED: "NONE",
  TAX_EXCLUDED: "COMBINED",
});

export const RND_INVESTMENT_AMOUNT_COLUMNS = Object.freeze([
  Object.freeze({
    key: RND_INVESTMENT_TAX_INCLUDED_CELL_KEY,
    cellKey: RND_INVESTMENT_TAX_INCLUDED_CELL_KEY,
    label: "投资总额-含税（万元）",
    unit: "万元",
    trimId: "rnd_investment_tax_included_amount",
    trimName: "投资总额-含税（万元）",
    trimIndex: -101,
    real: true,
    displayOnly: false,
    aggregateMode: "NONE",
    yearAggregateMode: RND_AMOUNT_AGGREGATE_MODE.TAX_INCLUDED,
    virtualInput: true,
    rndInvestmentAmount: true,
    rndAmountKind: "taxIncluded",
  }),
  Object.freeze({
    key: RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
    cellKey: RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
    label: "投资总额-不含税（万元）",
    unit: "万元",
    trimId: "rnd_investment_tax_excluded_amount",
    trimName: "投资总额-不含税（万元）",
    trimIndex: -102,
    real: true,
    displayOnly: false,
    aggregateMode: "COMBINED",
    yearAggregateMode: RND_AMOUNT_AGGREGATE_MODE.TAX_EXCLUDED,
    virtualInput: true,
    rndInvestmentAmount: true,
    rndAmountKind: "taxExcluded",
  }),
]);

const RND_CURRENT_CALCULATED_INVESTMENT_SOURCE_PATHS = Object.freeze([
  "研发投资/研发直接投资/车型投资/架构件投资",
  "研发投资/研发直接投资/车型投资/非架构件投资",
  "研发投资/研发直接投资/人工成本/直接人工成本",
  "研发投资/研发直接投资/人工成本/间接人工成本",
  "研发投资/研发间接费用/折旧摊销",
  "研发投资/研发间接费用/运营费用",
]);

const RND_LEGACY_CALCULATED_INVESTMENT_SOURCE_PATHS = Object.freeze([
  "研发投资/研发直接投资/车型投资/直接人工成本",
  "研发投资/研发直接投资/车型投资/间接人工成本",
]);

const RND_CALCULATED_INVESTMENT_SOURCE_GROUPS = Object.freeze([
  Object.freeze(["研发投资/研发直接投资/车型投资/架构件投资"]),
  Object.freeze(["研发投资/研发直接投资/车型投资/非架构件投资"]),
  Object.freeze([
    "研发投资/研发直接投资/人工成本/直接人工成本",
    "研发投资/研发直接投资/车型投资/直接人工成本",
  ]),
  Object.freeze([
    "研发投资/研发直接投资/人工成本/间接人工成本",
    "研发投资/研发直接投资/车型投资/间接人工成本",
  ]),
  Object.freeze(["研发投资/研发间接费用/折旧摊销"]),
  Object.freeze(["研发投资/研发间接费用/运营费用"]),
]);

export const RND_CALCULATED_INVESTMENT_SOURCE_PATHS = Object.freeze(
  RND_CURRENT_CALCULATED_INVESTMENT_SOURCE_PATHS.concat(
    RND_LEGACY_CALCULATED_INVESTMENT_SOURCE_PATHS,
  ),
);

export const RND_NON_CALCULATED_INVESTMENT_SOURCE_PATHS = Object.freeze([
  "研发投资/研发直接投资/零部件摊销",
]);

export const RND_DIRECT_YEAR_INPUT_PATHS = Object.freeze([
  "研发投资/年款及中期改款/年款",
  "研发投资/年款及中期改款/中期改款",
  "研发投资/年款及中期改款/其他",
]);

export const RND_INVESTMENT_SOURCE_PATHS = Object.freeze(
  RND_CALCULATED_INVESTMENT_SOURCE_PATHS.concat(
    RND_NON_CALCULATED_INVESTMENT_SOURCE_PATHS,
  ),
);

const RND_TOTAL_SOURCE_GROUPS = RND_CALCULATED_INVESTMENT_SOURCE_GROUPS;

function buildRndPathCandidates(paths = "") {
  const list = Array.isArray(paths) ? paths : [paths];
  return list.reduce((result, path) => {
    [
      path,
      String(path || "").replace(/^研发投资\//, ""),
      String(path || "").replace(/^研发费用\//, ""),
    ]
      .filter(Boolean)
      .forEach((candidate) => {
        if (!result.includes(candidate)) result.push(candidate);
      });
    return result;
  }, []);
}

export function buildRndInvestmentAmountColumns() {
  return RND_INVESTMENT_AMOUNT_COLUMNS.map((column) => ({ ...column }));
}

/**
 * 归一化 Excel 表头，用于识别研发投资「投资总额-含税/不含税」列。
 */
export function normalizeRndInvestmentAmountHeaderText(value = "") {
  return String(value == null ? "" : value)
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\s+/g, "")
    .replace(/万元/g, "")
    .replace(/[-—_]/g, "")
    .toLowerCase();
}

/**
 * 按表头匹配研发投资总额列；无法区分含税/不含税时返回 null。
 * 先判断「不含税」，避免被「含税」子串误伤。
 */
export function matchRndInvestmentAmountColumnByHeader(headerText = "") {
  const text = normalizeRndInvestmentAmountHeaderText(headerText);
  if (!text) return null;
  const looksLikeInvestmentTotal =
    text.includes("投资总额") ||
    text.includes("投资额") ||
    (text.includes("投资") && text.includes("总额"));
  if (!looksLikeInvestmentTotal) return null;

  const columns = buildRndInvestmentAmountColumns();
  if (text.includes("不含税") || text.includes("未税")) {
    return columns.find((item) => item.rndAmountKind === "taxExcluded") || null;
  }
  if (text.includes("含税")) {
    return columns.find((item) => item.rndAmountKind === "taxIncluded") || null;
  }
  return null;
}

/**
 * 是否为形态 A 的「投资总额」组年份行（非整年、非含税/不含税明细列名）。
 */
export function isRndInvestmentAmountGroupYearLabel(yearLabel = "") {
  const text = normalizeRndInvestmentAmountHeaderText(yearLabel);
  if (!text) return false;
  if (matchRndInvestmentAmountColumnByHeader(yearLabel)) return false;
  return text === "投资总额" || text === "投资总额列" || text === "rndinvestmentamount";
}

export function getRndAmountAggregateModeByCellKey(cellKey = "") {
  const key = safeText(cellKey);
  if (key === RND_INVESTMENT_TAX_INCLUDED_CELL_KEY)
    return RND_AMOUNT_AGGREGATE_MODE.TAX_INCLUDED;
  if (key === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY)
    return RND_AMOUNT_AGGREGATE_MODE.TAX_EXCLUDED;
  return "";
}

export function getRndAmountCellKeyByAggregateMode(mode = "") {
  const normalized = safeText(mode).toUpperCase();
  if (normalized === RND_AMOUNT_AGGREGATE_MODE.TAX_INCLUDED)
    return RND_INVESTMENT_TAX_INCLUDED_CELL_KEY;
  if (normalized === RND_AMOUNT_AGGREGATE_MODE.TAX_EXCLUDED)
    return RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY;
  return "";
}

export function isRndAmountCellKey(cellKey = "") {
  return Boolean(getRndAmountAggregateModeByCellKey(cellKey));
}

function normalizeRndComparablePath(value = "") {
  return String(value == null ? "" : value)
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "")
    .replace(/[/\\|｜>＞\-—_]/g, "")
    .toLowerCase();
}

function getRndComparablePath(row = {}) {
  const explicitPath = row.subjectPath || row.subjectTreePath || row.path;
  if (Array.isArray(explicitPath) && explicitPath.length > 1) {
    return explicitPath
      .map((item) => safeText(item))
      .filter(Boolean)
      .join("/");
  }
  const fullNamePath = safeText(row.fullNamePath || row.fullPath);
  if (fullNamePath && fullNamePath.includes("/")) return fullNamePath;
  if (Array.isArray(explicitPath))
    return explicitPath
      .map((item) => safeText(item))
      .filter(Boolean)
      .join("/");
  return safeText(
    explicitPath ||
      [row.rootSubjectName, row.subtable, row.subjectName || row.subject]
        .filter(Boolean)
        .join("/"),
  );
}

function isRndPathInList(rowOrPath = {}, paths = []) {
  const sourcePath =
    typeof rowOrPath === "string" ? rowOrPath : getRndComparablePath(rowOrPath);
  const normalizedPath = normalizeRndComparablePath(sourcePath);
  if (!normalizedPath) return false;
  return (Array.isArray(paths) ? paths : []).some((candidate) => {
    const normalized = normalizeRndComparablePath(candidate);
    const tail = normalizeRndComparablePath(
      String(candidate || "")
        .replace(/^研发投资\//, "")
        .replace(/^研发费用\//, ""),
    );
    return (
      normalizedPath === normalized ||
      normalizedPath.endsWith(normalized) ||
      normalizedPath === tail ||
      normalizedPath.endsWith(tail)
    );
  });
}

export function isRndDoubleAmountSourceRow(row = {}) {
  return isRndPathInList(row, RND_INVESTMENT_SOURCE_PATHS);
}

export function isRndCalculatedAmountSourceRow(row = {}) {
  return isRndPathInList(row, RND_CALCULATED_INVESTMENT_SOURCE_PATHS);
}

export function isRndNonCalculatedAmountSourceRow(row = {}) {
  return isRndPathInList(row, RND_NON_CALCULATED_INVESTMENT_SOURCE_PATHS);
}

export function isRndDirectYearInputRow(row = {}) {
  return isRndPathInList(row, RND_DIRECT_YEAR_INPUT_PATHS);
}

function _rowInCurrentDetail(detail, candidates = []) {
  const module = buildModuleIndex(
    Array.isArray(detail && detail.rows) ? detail.rows : [],
  );
  return module.findRow(candidates);
}

function isLifecycleYearLabel(value) {
  const text = safeText(value).toLowerCase();
  return text === "lifecycle" || text.includes("全生命周期");
}

function isVirtualTrimValue(value) {
  const text = safeText(value).toLowerCase();
  return (
    text === "subtotal" ||
    text === "lifecycle" ||
    text === "小计" ||
    text === "合计" ||
    text === "全生命周期"
  );
}

function getDetailTrimEntries(detail, yearLabel = "") {
  const trimOptions = Array.isArray(detail && detail.trimOptions)
    ? detail.trimOptions
    : [];
  const normalizedOptions = trimOptions
    .map((trim, index) => {
      if (!trim || typeof trim !== "object") return null;
      const trimId = safeText(
        trim.trimId || trim.id || trim.code || trim.name || trim.label,
      );
      const trimName = safeText(
        trim.trimName || trim.name || trim.label || trimId,
      );
      const trimIndex = Number.isInteger(trim.trimIndex)
        ? Number(trim.trimIndex)
        : index;
      if (!trimId || isVirtualTrimValue(trimId) || isVirtualTrimValue(trimName))
        return null;
      return {
        trim,
        trimId,
        trimName,
        trimIndex,
      };
    })
    .filter(Boolean);
  const allTrimEntries = normalizedOptions.length
    ? normalizedOptions
    : (() => {
        const dimensions =
          detail && detail.dimensions && typeof detail.dimensions === "object"
            ? detail.dimensions
            : { trims: [] };
        const trims = Array.isArray(dimensions.trims) ? dimensions.trims : [];
        return trims
          .map((trim, index) => {
            const trimId = safeText(
              trim && typeof trim === "object"
                ? trim.trimId || trim.id || trim.code || trim.name || trim.label
                : trim,
            );
            const trimName = safeText(
              trim && typeof trim === "object"
                ? trim.trimName || trim.name || trim.label
                : trim,
            );
            if (
              !trimId ||
              isVirtualTrimValue(trimId) ||
              isVirtualTrimValue(trimName)
            )
              return null;
            return {
              trim,
              trimId,
              trimName,
              trimIndex:
                trim &&
                typeof trim === "object" &&
                Number.isInteger(trim.trimIndex)
                  ? Number(trim.trimIndex)
                  : index,
            };
          })
          .filter(Boolean);
      })();

  const year = safeText(yearLabel);
  const yearTrimConfig =
    detail &&
    detail.yearTrimConfig &&
    typeof detail.yearTrimConfig === "object" &&
    !Array.isArray(detail.yearTrimConfig)
      ? detail.yearTrimConfig
      : {};
  const selected =
    year && Array.isArray(yearTrimConfig[year])
      ? yearTrimConfig[year].map((item) => safeText(item)).filter(Boolean)
      : [];
  if (!selected.length) return allTrimEntries;
  const selectedMap = selected.reduce((map, trimId) => {
    map[trimId] = true;
    return map;
  }, {});
  const filtered = allTrimEntries.filter(
    (entry) => selectedMap[entry.trimId] || selectedMap[entry.trimName],
  );
  return filtered.length ? filtered : allTrimEntries;
}

function forEachDetailCell(detail, iteratee) {
  const dimensions =
    detail && detail.dimensions && typeof detail.dimensions === "object"
      ? detail.dimensions
      : { years: [], trims: [] };
  const years = Array.isArray(dimensions.years) ? dimensions.years : [];
  years.forEach((year, yearIndex) => {
    if (!safeText(year) || isLifecycleYearLabel(year)) return;
    const trims = getDetailTrimEntries(detail, year);
    trims.forEach(({ trim, trimId, trimIndex }) => {
      iteratee({
        year,
        yearIndex,
        trim,
        trimId,
        trimIndex,
        cellKey: resolveCellKey(yearIndex, trimIndex),
      });
    });
  });
}

function _getDetailCellKeys(detail, options = {}) {
  if (options.yearOnly === true) {
    const dimensions =
      detail && detail.dimensions && typeof detail.dimensions === "object"
        ? detail.dimensions
        : { years: [] };
    return (Array.isArray(dimensions.years) ? dimensions.years : [])
      .map((year, yearIndex) =>
        safeText(year) && !isLifecycleYearLabel(year)
          ? resolveCellKey(yearIndex, 0)
          : "",
      )
      .filter(Boolean);
  }
  const keys = [];
  forEachDetailCell(detail, ({ cellKey }) => keys.push(cellKey));
  return keys;
}

function readRndInvestmentAmount(
  row = {},
  cellKey = RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
) {
  if (!row || typeof row !== "object") return null;
  const cells =
    row && row.cells && typeof row.cells === "object" ? row.cells : {};
  if (Object.prototype.hasOwnProperty.call(cells, cellKey)) {
    return toNumber(cells[cellKey]);
  }

  if (
    cellKey === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY &&
    Object.prototype.hasOwnProperty.call(row, "rndInvestmentAmount")
  ) {
    return toNumber(row.rndInvestmentAmount);
  }

  if (
    cellKey === RND_INVESTMENT_TAX_INCLUDED_CELL_KEY &&
    Object.prototype.hasOwnProperty.call(row, "rndInvestmentTaxIncludedAmount")
  ) {
    return toNumber(row.rndInvestmentTaxIncludedAmount);
  }

  if (
    cellKey === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY &&
    Object.prototype.hasOwnProperty.call(row, "rndInvestmentTaxExcludedAmount")
  ) {
    return toNumber(row.rndInvestmentTaxExcludedAmount);
  }

  return null;
}

function writeRndInvestmentAmount(row = {}, cellKey, amount) {
  if (!row || typeof row !== "object") return;
  const cells = ensureCells(row);
  const formatted =
    amount === null || amount === "" ? "" : formatFormulaValue(amount, row, 4);
  cells[cellKey] = formatted;
  if (cellKey === RND_INVESTMENT_TAX_INCLUDED_CELL_KEY) {
    row.rndInvestmentTaxIncludedAmount = formatted;
  }
  if (cellKey === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY) {
    row.rndInvestmentTaxExcludedAmount = formatted;
    row.rndInvestmentAmount = formatted;
  }
}

function sumNullableNumbers(values = []) {
  const nums = values
    .map((item) => toNumber(item))
    .filter((item) => item !== null);
  if (!nums.length) return null;
  return nums.reduce((total, item) => total + item, 0);
}

function readRndEntryInvestmentAmount(
  entry = {},
  cellKey = RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
) {
  if (entry && entry.targetRow) {
    const targetValue = readRndInvestmentAmount(entry.targetRow, cellKey);
    if (targetValue !== null) return targetValue;
  }
  if (entry.sourceRow && entry.sourceRow !== entry.targetRow) {
    return readRndInvestmentAmount(entry.sourceRow, cellKey);
  }
  return null;
}

function applyRndInvestmentFormulas(
  detail,
  index,
  targetSalesVolumeRow,
  sourceIndex = null,
) {
  const lookupIndex = sourceIndex || index;
  const seenSourceRows = new Set();
  const calculatedEntries = RND_TOTAL_SOURCE_GROUPS.map((paths) => {
    const candidates = buildRndPathCandidates(paths);
    const targetRow = index.findRow(candidates);
    const sourceRow =
      targetRow || (lookupIndex && lookupIndex.findRow(candidates));
    return { targetRow, sourceRow };
  }).filter((entry) => {
    const row = entry && entry.sourceRow;
    if (!row || seenSourceRows.has(row)) return false;
    seenSourceRows.add(row);
    return true;
  });
  const nonCalculatedEntries = RND_NON_CALCULATED_INVESTMENT_SOURCE_PATHS.map(
    (path) => {
      const candidates = buildRndPathCandidates(path);
      return { targetRow: index.findRow(candidates) };
    },
  ).filter((entry) => entry && entry.targetRow);
  const directYearEntries = RND_DIRECT_YEAR_INPUT_PATHS.map((path) => {
    const candidates = buildRndPathCandidates(path);
    const targetRow = index.findRow(candidates);
    const sourceRow =
      targetRow || (lookupIndex && lookupIndex.findRow(candidates));
    return { targetRow, sourceRow };
  }).filter((entry) => entry && entry.sourceRow);
  const rndTotal = index.findRow(["研发投资/合计", "研发费用/合计"]);
  if (
    !calculatedEntries.length &&
    !nonCalculatedEntries.length &&
    !directYearEntries.length &&
    !rndTotal
  )
    return 0;

  const lifecycleVolume = getLifecycleTotalFromRow(
    targetSalesVolumeRow,
    detail,
  );
  const taxIncludedAmounts = calculatedEntries.map((entry) =>
    readRndEntryInvestmentAmount(entry, RND_INVESTMENT_TAX_INCLUDED_CELL_KEY),
  );
  const taxExcludedAmounts = calculatedEntries.map((entry) =>
    readRndEntryInvestmentAmount(entry, RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY),
  );
  const nonCalculatedTaxIncludedAmounts = nonCalculatedEntries.map((entry) =>
    readRndEntryInvestmentAmount(entry, RND_INVESTMENT_TAX_INCLUDED_CELL_KEY),
  );
  const nonCalculatedTaxExcludedAmounts = nonCalculatedEntries.map((entry) =>
    readRndEntryInvestmentAmount(entry, RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY),
  );
  const unitFormulaText =
    "投资总额-不含税存储金额（元） / 销量表销量全生命周期合计";
  let updatedSourceRows = 0;

  calculatedEntries.forEach((entry, index) => {
    const row = entry.targetRow;
    if (!row) return;
    const taxIncludedAmount = taxIncludedAmounts[index];
    const taxExcludedAmount = taxExcludedAmounts[index];
    writeRndInvestmentAmount(
      row,
      RND_INVESTMENT_TAX_INCLUDED_CELL_KEY,
      taxIncludedAmount,
    );
    writeRndInvestmentAmount(
      row,
      RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
      taxExcludedAmount,
    );
    row.rndInvestmentAmountFormulaText = unitFormulaText;
    if (
      taxExcludedAmount !== null &&
      !lifecycleVolume &&
      typeof window !== "undefined"
    ) {
      console.warn(
        "[Revenue RND Investment] 摊销年份/版型单元格未计算：销量表全生命周期销量缺失或为 0",
        {
          rowPath: getRowPath(row),
          taxExcludedAmount,
          lifecycleVolume,
          hasTargetSalesVolumeRow: Boolean(targetSalesVolumeRow),
        },
      );
    }
    forEachDetailCell(detail, ({ year, trim, trimId, cellKey }) => {
      const value =
        taxExcludedAmount !== null && lifecycleVolume
          ? RevenueFormulaFns.safeDiv(taxExcludedAmount, lifecycleVolume, "")
          : "";
      writeRndInvestmentDerivedCell(row, cellKey, value, 4, {
        year,
        trim,
        trimId,
        force: true,
      });
    });
    updatedSourceRows += 1;
  });

  nonCalculatedEntries.forEach((entry, index) => {
    const row = entry.targetRow;
    if (!row) return;
    writeRndInvestmentAmount(
      row,
      RND_INVESTMENT_TAX_INCLUDED_CELL_KEY,
      nonCalculatedTaxIncludedAmounts[index],
    );
    writeRndInvestmentAmount(
      row,
      RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
      nonCalculatedTaxExcludedAmounts[index],
    );
    row.rndInvestmentAmountFormulaText = "";
    forEachDetailCell(detail, ({ year, trim, trimId, cellKey }) => {
      writeRndInvestmentDerivedCell(row, cellKey, "", 4, {
        year,
        trim,
        trimId,
        force: true,
      });
    });
  });

  if (rndTotal) {
    const taxIncludedTotal = sumNullableNumbers(
      taxIncludedAmounts.concat(nonCalculatedTaxIncludedAmounts),
    );
    const taxExcludedTotal = sumNullableNumbers(
      taxExcludedAmounts.concat(nonCalculatedTaxExcludedAmounts),
    );
    markFormulaRow(rndTotal, {
      code: "rnd.total_sum",
      formulaText:
        "按不含税研发投资摊销的单车费用 + 年款/中期改款/其他直接填报值",
      rowKind: "rowSubtotal",
      aggregateFormula: "weighted_by_mix",
    });
    writeRndInvestmentAmount(
      rndTotal,
      RND_INVESTMENT_TAX_INCLUDED_CELL_KEY,
      taxIncludedTotal,
    );
    writeRndInvestmentAmount(
      rndTotal,
      RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
      taxExcludedTotal,
    );
    forEachDetailCell(detail, ({ year, trim, trimId, cellKey }) => {
      const calculatedValue = lifecycleVolume
        ? sumNullableNumbers(
            taxExcludedAmounts.map((amount) =>
              amount !== null
                ? RevenueFormulaFns.safeDiv(amount, lifecycleVolume, "")
                : null,
            ),
          )
        : null;
      const directValue = sumNullableNumbers(
        directYearEntries.map(
          (entry) =>
            entry.sourceRow &&
            entry.sourceRow.cells &&
            entry.sourceRow.cells[cellKey],
        ),
      );
      const value = sumNullableNumbers([calculatedValue, directValue]);
      writeFormulaCell(rndTotal, cellKey, value === null ? "" : value, 4, {
        year,
        trim,
        trimId,
        force: true,
      });
    });
  }

  return updatedSourceRows + (rndTotal ? 1 : 0);
}

function applySalesVolumeMixFormulas(detail) {
  if (!detail || !Array.isArray(detail.rows)) return 0;
  const index = buildModuleIndex(detail.rows);
  const pairs = [
    {
      code: "sales.mix",
      volumeCandidates: TARGET_SALES_VOLUME_PATHS,
      mixCandidates: SALES_VOLUME_MIX_PATHS,
      formulaText: "本年本版型销量 / 本年所有版型销量合计",
    },
  ];
  let updatedRows = 0;

  pairs.forEach((pair) => {
    const volumeRow = index.findRow(pair.volumeCandidates);
    const mixRow = index.findRow(pair.mixCandidates);
    if (!volumeRow || !mixRow) return;
    markFormulaRow(mixRow, {
      code: pair.code,
      formulaText: pair.formulaText,
      rowKind: "formula",
      aggregateFormula: "sum",
    });
    forEachDetailCell(detail, ({ year, yearIndex, trim, trimId, cellKey }) => {
      const trimEntries = getDetailTrimEntries(detail, year);
      const dimension = { year, trim, trimId };
      const yearVolumeTotal = getYearTotalFromRow(
        volumeRow,
        yearIndex,
        trimEntries,
        year,
      );
      const volume = readRowCell(volumeRow, cellKey, dimension);
      writeFormulaCell(
        mixRow,
        cellKey,
        yearVolumeTotal ? safeFormulaDiv(volume, yearVolumeTotal) : "",
        4,
        { year, trim, trimId, force: true },
      );
    });
    updatedRows += 1;
  });

  return updatedRows;
}

function readRowCell(row, cellKey, dimension = {}) {
  if (!row) return null;
  return readMatrixCellValue(
    row,
    { ...dimension, cellKey },
    { defaultValue: null },
  );
}

function applySubtableFormulas(detail, modules = {}, options = {}) {
  if (!detail || !Array.isArray(detail.rows)) return { updatedRows: 0 };
  let updatedRows = 0;
  const targetSalesVolumeRow = getTargetSalesVolumeRow(modules);

  updatedRows += applySalesVolumeMixFormulas(detail);

  const index = buildModuleIndex(detail.rows);

  // ===== 诊断日志：applySubtableFormulas 关键行查找结果（仅含主表行时） =====
  const mainMix = findMainPnlMixRow(detail.rows, index);
  if (typeof window !== "undefined" && mainMix && !window.__subtableFormulaDiagLogged) {
    window.__subtableFormulaDiagLogged = true;
    const mainSalesVolumeRow = getMainPnlSalesVolumeRow(index, modules);
    const backendDynamicRows = detail.rows.filter(function (r) {
      return getBackendTemplateEntryMode(r) === "CALCULATED" &&
             !isSystemDerivedMixRow(r) &&
             getBackendFormulaExpression(r) &&
             parseFormulaParamBindings(r.formulaParamBindings).length > 0;
    });
    console.groupCollapsed("[公式引擎诊断] applySubtableFormulas 关键行查找");
    console.log("targetSalesVolumeRow:", targetSalesVolumeRow ? getRowPath(targetSalesVolumeRow) : "NOT FOUND",
      "| hasCells:", !!(targetSalesVolumeRow && targetSalesVolumeRow.cells && Object.keys(targetSalesVolumeRow.cells).length));
    console.log("mainMix (主表MIX行):", mainMix ? getRowPath(mainMix) : "NOT FOUND",
      "| moduleCode:", mainMix ? mainMix.moduleCode : "-");
    console.log("mainSalesVolumeRow:", mainSalesVolumeRow ? getRowPath(mainSalesVolumeRow) : "NOT FOUND",
      "| hasCells:", !!(mainSalesVolumeRow && mainSalesVolumeRow.cells && Object.keys(mainSalesVolumeRow.cells).length));
    console.log("CALCULATED+formula 行数 (applyBackendDynamicFormulas 目标):", backendDynamicRows.length);
    if (backendDynamicRows.length) {
      console.log("CALCULATED 行样例:", backendDynamicRows.slice(0, 5).map(function (r) {
        return { path: getRowPath(r), formulaExpression: getBackendFormulaExpression(r), entryMode: getBackendTemplateEntryMode(r) };
      }));
    }
    console.groupEnd();
  }

  const productSelfSalesTarget = index.findRow(PRODUCT_SELF_SALES_TARGET_PATHS);
  updatedRows += writeDerivedReferenceRow(
    detail,
    productSelfSalesTarget,
    targetSalesVolumeRow,
    {
      code: "product.self_sales_target",
      formulaText: "销量表/销量",
    },
  );
  const productSelfSalesMix = index.findRow(PRODUCT_SELF_SALES_MIX_PATHS);
  updatedRows += writeTargetVolumeMixRow(
    detail,
    productSelfSalesMix,
    rowHasFormulaCellValue(productSelfSalesTarget, detail)
      ? productSelfSalesTarget
      : targetSalesVolumeRow,
    {
      code: "product.self_sales_mix",
      formulaText: "本品销量目标 / 当前年本品销量目标合计",
    },
  );

  const materialMix = index.findRow(MATERIAL_DESIGN_MIX_PATHS);
  updatedRows += writeTargetVolumeMixRow(
    detail,
    materialMix,
    targetSalesVolumeRow,
    {
      code: "material.design_mix",
      formulaText: "销量表/销量 / 当前年销量合计",
    },
  );
  // 设计成本：首年手填，后续年 = 上年 × (1 - 上年年降本率)，空降本率按 0
  updatedRows += applyMaterialDesignCostYearCascade(detail);
  // 其中 Lisence：后续年强制覆盖 = 首年同版型 × (1 − 当年年降本率)，对齐生产
  updatedRows += applyMaterialLisenceYearForceCascade(detail);
  const mainSalesVolumeRow = getMainPnlSalesVolumeRow(index, modules);
  updatedRows += writeTargetVolumeMixRow(
    detail,
    mainMix,
    rowHasFormulaCellValue(mainSalesVolumeRow, detail)
      ? mainSalesVolumeRow
      : targetSalesVolumeRow,
    {
      code: "main.mix",
      formulaText: "主表/项目利润/销量 / 当前年销量合计",
    },
  );
  const variableMfgMix = index.findRow(["变动制造费用/MIX"]);
  updatedRows += writeTargetVolumeMixRow(
    detail,
    variableMfgMix,
    targetSalesVolumeRow,
    {
      code: "variable_mfg.mix",
      formulaText: "销量表/销量 / 当前年销量合计",
    },
  );

  updatedRows += applyRndInvestmentFormulas(
    detail,
    index,
    targetSalesVolumeRow,
    modules[REVENUE_MODULE_CODE.RND_EXPENSE] || index,
  );
  updatedRows += applyBackendDynamicFormulas(detail, modules, options);

  return { updatedRows };
}

function writeMaterialDesignCostCascadeCell(
  row,
  cellKey,
  value,
  dimension = {},
) {
  if (!row) return;
  // MANUAL 科目不能走 writeFormulaCell，直接写矩阵单元格
  const formattedValue =
    value === null || value === ""
      ? ""
      : formatFormulaValue(value, row, 4, dimension);
  writeMatrixCellValue(row, { ...dimension, cellKey }, formattedValue);
}

function findMaterialDesignCostCascadeRows(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    designCostRow:
      list.find((row) => isMaterialDesignCostInputRow(row)) || null,
    reductionRateRow:
      list.find((row) => isMaterialDesignCostReductionRateRow(row)) || null,
  };
}

/**
 * 材料成本/设计成本：Y_n = Y_(n-1) * (1 - 年降本率_(n-1))，空降本率按 0。
 * 仅覆盖 yearIndex >= 1，不改首年手填值。
 */
function applyMaterialDesignCostYearCascade(detail) {
  if (!detail || !Array.isArray(detail.rows)) return 0;
  const { designCostRow, reductionRateRow } = findMaterialDesignCostCascadeRows(
    detail.rows,
  );
  if (!designCostRow) return 0;

  const dimensions =
    detail.dimensions && typeof detail.dimensions === "object"
      ? detail.dimensions
      : { years: [] };
  const years = Array.isArray(dimensions.years) ? dimensions.years : [];
  let touched = false;

  years.forEach((year, yearIndex) => {
    if (!safeText(year) || isLifecycleYearLabel(year) || yearIndex <= 0) return;
    const prevYear = years[yearIndex - 1];
    if (!safeText(prevYear) || isLifecycleYearLabel(prevYear)) return;
    const trims = getDetailTrimEntries(detail, year);
    trims.forEach(({ trim, trimId, trimIndex }) => {
      const prevKey = resolveCellKey(yearIndex - 1, trimIndex);
      const cellKey = resolveCellKey(yearIndex, trimIndex);
      const prevDimension = {
        year: prevYear,
        trim,
        trimId,
        cellKey: prevKey,
      };
      const currDimension = {
        year,
        trim,
        trimId,
        cellKey,
      };
      const prevValue = toNumber(
        readRowCell(designCostRow, prevKey, prevDimension),
      );
      if (prevValue === null) {
        writeMaterialDesignCostCascadeCell(
          designCostRow,
          cellKey,
          "",
          currDimension,
        );
        touched = true;
        return;
      }
      const rateRaw = reductionRateRow
        ? readRowCell(reductionRateRow, prevKey, prevDimension)
        : null;
      // 空降本率按 0：保持上年值
      const rateRatio =
        rateRaw == null || rateRaw === "" ? 0 : (toPercentRatio(rateRaw) ?? 0);
      const nextValue = prevValue * (1 - rateRatio);
      writeMaterialDesignCostCascadeCell(
        designCostRow,
        cellKey,
        nextValue,
        currDimension,
      );
      touched = true;
    });
  });

  return touched ? 1 : 0;
}

/**
 * 材料成本/设计成本/其中 Lisence：
 * 后续年强制覆盖 = 首年同版型 Lisence × (1 − 当年同版型年降本率)，空降本率按 0。
 * 与设计成本不同：锚定首年（非上年递推），且用当年年降本率；导入脏数据也会被覆盖。
 * 不改首年手填值，不动 BOM / 设计成本等其它行。
 */
function applyMaterialLisenceYearForceCascade(detail) {
  if (!detail || !Array.isArray(detail.rows)) return 0;
  const list = detail.rows;
  const lisenceRow = list.find((row) => isMaterialLisenceRow(row)) || null;
  if (!lisenceRow) return 0;
  const reductionRateRow =
    list.find((row) => isMaterialDesignCostReductionRateRow(row)) || null;

  const dimensions =
    detail.dimensions && typeof detail.dimensions === "object"
      ? detail.dimensions
      : { years: [] };
  const years = Array.isArray(dimensions.years) ? dimensions.years : [];
  const firstYear = years[0];
  if (!safeText(firstYear) || isLifecycleYearLabel(firstYear)) return 0;
  let touched = false;

  years.forEach((year, yearIndex) => {
    if (!safeText(year) || isLifecycleYearLabel(year) || yearIndex <= 0) return;
    const trims = getDetailTrimEntries(detail, year);
    trims.forEach(({ trim, trimId, trimIndex }) => {
      const firstKey = resolveCellKey(0, trimIndex);
      const cellKey = resolveCellKey(yearIndex, trimIndex);
      const firstDimension = {
        year: firstYear,
        trim,
        trimId,
        cellKey: firstKey,
      };
      const currDimension = {
        year,
        trim,
        trimId,
        cellKey,
      };
      const firstValue = toNumber(
        readRowCell(lisenceRow, firstKey, firstDimension),
      );
      if (firstValue === null) {
        writeMaterialDesignCostCascadeCell(
          lisenceRow,
          cellKey,
          "",
          currDimension,
        );
        touched = true;
        return;
      }
      const rateRaw = reductionRateRow
        ? readRowCell(reductionRateRow, cellKey, currDimension)
        : null;
      // 空降本率按 0：保持首年值
      const rateRatio =
        rateRaw == null || rateRaw === "" ? 0 : (toPercentRatio(rateRaw) ?? 0);
      const nextValue = firstValue * (1 - rateRatio);
      writeMaterialDesignCostCascadeCell(
        lisenceRow,
        cellKey,
        nextValue,
        currDimension,
      );
      touched = true;
    });
  });

  return touched ? 1 : 0;
}

function getYearTotalFromRow(
  row,
  yearIndex,
  trimEntriesOrCount,
  yearLabel = "",
) {
  if (!row) return 0;
  const values = [];
  if (Array.isArray(trimEntriesOrCount)) {
    trimEntriesOrCount.forEach((trim) => {
      const trimIndex = Number(trim && trim.trimIndex);
      if (Number.isInteger(trimIndex)) {
        values.push(
          readRowCell(row, resolveCellKey(yearIndex, trimIndex), {
            year: yearLabel,
            trim: trim && trim.trim,
            trimId: trim && trim.trimId,
            trimName: trim && trim.trimName,
          }),
        );
      }
    });
  } else {
    const trimCount = Number(trimEntriesOrCount) || 0;
    for (let ti = 0; ti < trimCount; ti += 1) {
      values.push(readRowCell(row, resolveCellKey(yearIndex, ti)));
    }
  }
  return RevenueFormulaFns.sum(values);
}

function reviewOptionText(options = {}, value, fallback = "") {
  if (typeof options.safeText === "function")
    return options.safeText(value, fallback);
  return safeText(value, fallback);
}

function reviewOptionRound(options = {}, value, precision = 4) {
  if (typeof options.roundNumber === "function")
    return options.roundNumber(value, precision);
  return roundNumber(value, precision);
}

function reviewOptionNumber(options = {}, value) {
  if (typeof options.toAggregateNumber === "function") {
    const parsed = options.toAggregateNumber(value);
    return parsed == null ? toNumber(value) : parsed;
  }
  return toNumber(value);
}

function reviewResolveSubjectKeys(options = {}, itemOrId) {
  if (typeof options.resolveSubjectValueKeys === "function") {
    return options.resolveSubjectValueKeys(itemOrId);
  }
  if (itemOrId && typeof itemOrId === "object") {
    return [
      itemOrId.subjectId,
      itemOrId.id,
      itemOrId.templateId,
      itemOrId.subjectCode,
    ]
      .map((item) => safeText(item))
      .filter((item, index, list) => item && list.indexOf(item) === index);
  }
  const key = safeText(itemOrId);
  return key ? [key] : [];
}

function reviewSubjectId(item = {}) {
  return safeText(
    item && (item.templateId || item.id || item.subjectId || item.subjectCode),
  );
}

function reviewFormulaMeta(options = {}, item, group) {
  return typeof options.getReviewFormulaMeta === "function"
    ? options.getReviewFormulaMeta(item, group)
    : null;
}

function reviewAggregateFormula(options = {}, item, group, scope = "year") {
  if (typeof options.getReviewAggregateFormula === "function") {
    return safeText(
      options.getReviewAggregateFormula(item, group, scope),
      "sum",
    ).toLowerCase();
  }
  const meta = reviewFormulaMeta(options, item, group) || {};
  const formula = safeText(
    meta.aggregateFormula || (item && item.aggregateFormula),
  );
  if (formula) return formula.toLowerCase();
  if (safeText(item && item.unit) === "%") return "weighted_by_mix";
  return "sum";
}

function reviewFindSubjectByTemplateId(options = {}, templateId, subjects) {
  return typeof options.findReviewSubjectByTemplateId === "function"
    ? options.findReviewSubjectByTemplateId(templateId, subjects)
    : null;
}

function reviewFindSubjectByPath(options = {}, path, subjects) {
  return typeof options.findReviewSubjectByPath === "function"
    ? options.findReviewSubjectByPath(path, subjects)
    : null;
}

function reviewResolveValueTarget(
  values = {},
  targetRef,
  group = null,
  options = {},
  subjects = [],
) {
  const tryKeys = (keys = []) => {
    for (let index = 0; index < keys.length; index += 1) {
      const key = reviewOptionText(options, keys[index]);
      if (key && values && values[key]) return { key, target: values[key] };
    }
    return null;
  };

  if (targetRef && typeof targetRef === "object") {
    const item = targetRef.item || targetRef;
    const direct = tryKeys(reviewResolveSubjectKeys(options, item));
    if (direct) return { ...direct, item, group: targetRef.group || group };
  } else {
    const key = reviewOptionText(options, targetRef);
    const direct = tryKeys([key]);
    if (direct) return direct;
    const matched =
      reviewFindSubjectByTemplateId(options, key, subjects) ||
      reviewFindSubjectByPath(options, key, subjects);
    if (matched && matched.item) {
      const fromMatched = tryKeys(
        reviewResolveSubjectKeys(options, matched.item),
      );
      if (fromMatched) return { ...fromMatched, ...matched };
    }
  }
  return { key: "", target: null, item: null, group: null };
}

function reviewEnsureValueTarget(
  values = {},
  targetRef,
  group = null,
  options = {},
  subjects = [],
) {
  const resolved = reviewResolveValueTarget(
    values,
    targetRef,
    group,
    options,
    subjects,
  );
  if (resolved.target) return resolved;
  const item =
    targetRef && typeof targetRef === "object"
      ? targetRef.item || targetRef
      : null;
  const keys = reviewResolveSubjectKeys(options, item || targetRef);
  const primaryKey = reviewOptionText(options, keys[0]);
  if (!primaryKey) return resolved;
  const target = { trims: {}, years: {}, yearTrims: {} };
  keys.forEach((key) => {
    const normalized = reviewOptionText(options, key);
    if (normalized) values[normalized] = target;
  });
  return { key: primaryKey, target, item, group };
}

function reviewTargetYearTrimValues(
  values = {},
  targetRef,
  versionKey,
  yearIndex,
  options = {},
  subjects = [],
) {
  const { target } = reviewResolveValueTarget(
    values,
    targetRef,
    null,
    options,
    subjects,
  );
  const yearTrims = target && target.yearTrims && target.yearTrims[versionKey];
  return Array.isArray(yearTrims && yearTrims[yearIndex])
    ? yearTrims[yearIndex]
    : [];
}

function reviewCollectVersionKeys(values = {}) {
  const map = {};
  Object.keys(values || {}).forEach((subjectId) => {
    const target = values[subjectId];
    if (!target || typeof target !== "object") return;
    [target.yearTrims, target.years, target.trims].forEach((bucket) => {
      if (!bucket || typeof bucket !== "object") return;
      Object.keys(bucket).forEach((versionKey) => {
        if (versionKey) map[versionKey] = true;
      });
    });
  });
  return Object.keys(map);
}

function reviewNormalizeVolumeWeights(
  values = {},
  versionKey,
  yearIndex,
  subtotalTrimIndex,
  options = {},
  subjects = [],
) {
  const volumeSubject =
    reviewFindSubjectByTemplateId(options, "proj_vol", subjects) ||
    reviewFindSubjectByTemplateId(options, "sales_volume", subjects) ||
    reviewFindSubjectByTemplateId(options, "volume", subjects) ||
    "proj_vol";
  const volumeValues = reviewTargetYearTrimValues(
    values,
    volumeSubject,
    versionKey,
    yearIndex,
    options,
    subjects,
  );
  const numericValues = volumeValues.map((value, trimIndex) =>
    trimIndex === subtotalTrimIndex ? null : reviewOptionNumber(options, value),
  );
  const hasVolumeData = numericValues.some((value) => value != null);
  const total = numericValues.reduce(
    (sum, value) => (value == null || value === 0 ? sum : sum + value),
    0,
  );
  return {
    values: numericValues,
    hasVolumeData,
    total,
    weights: total
      ? numericValues.map((value) =>
          value == null || value === 0 ? null : value / total,
        )
      : numericValues.map(() => null),
  };
}

function reviewResolveYearWeights(
  values = {},
  versionKey,
  yearIndex,
  subtotalTrimIndex,
  options = {},
  subjects = [],
) {
  const volume = reviewNormalizeVolumeWeights(
    values,
    versionKey,
    yearIndex,
    subtotalTrimIndex,
    options,
    subjects,
  );
  if (volume.hasVolumeData) return volume.weights;
  const mixSubject =
    reviewFindSubjectByTemplateId(options, "mix", subjects) || "mix";
  const mixValues = reviewTargetYearTrimValues(
    values,
    mixSubject,
    versionKey,
    yearIndex,
    options,
    subjects,
  );
  return mixValues.map((value, trimIndex) =>
    trimIndex === subtotalTrimIndex ? null : value,
  );
}

function reviewResolveLifecycleWeights(
  values = {},
  versionKey,
  yearIndexes = [],
  trimIndex,
  subtotalTrimIndex,
  options = {},
  subjects = [],
) {
  const weights = (Array.isArray(yearIndexes) ? yearIndexes : []).map(
    (yearIndex) => {
      const volume = reviewNormalizeVolumeWeights(
        values,
        versionKey,
        yearIndex,
        subtotalTrimIndex,
        options,
        subjects,
      );
      if (!volume.hasVolumeData) return null;
      if (trimIndex === subtotalTrimIndex) return volume.total || null;
      return volume.values[trimIndex] || null;
    },
  );
  const totalWeight = weights.reduce(
    (sum, value) => (value == null || value === 0 ? sum : sum + value),
    0,
  );
  if (!totalWeight) return weights.map(() => null);
  return weights.map((value) =>
    value == null || value === 0 ? null : value / totalWeight,
  );
}

function reviewLifecycleTotalVolume(
  values = {},
  versionKey,
  yearIndexes = [],
  subtotalTrimIndex,
  options = {},
  subjects = [],
) {
  return (Array.isArray(yearIndexes) ? yearIndexes : []).reduce(
    (sum, yearIndex) => {
      const volume = reviewNormalizeVolumeWeights(
        values,
        versionKey,
        yearIndex,
        subtotalTrimIndex,
        options,
        subjects,
      );
      return sum + (volume.total || 0);
    },
    0,
  );
}

function reviewAggregateNumbers(
  numbers = [],
  item,
  group,
  scope = "year",
  context = {},
  options = {},
  subjects = [],
) {
  // scope 传入公式选择器，便于 S8 等场景按年小计 / 全生命周期分别对齐 S1 规则
  const rawFormula = reviewAggregateFormula(options, item, group, scope);
  // volume_weighted / sum_year 映射到评审聚合引擎已支持的加权 / 求和分支
  const formula =
    rawFormula === "volume_weighted"
      ? "weighted_by_mix"
      : rawFormula === "sum_year"
        ? "sum"
        : rawFormula;
  if (isRatioAggregateFormula(formula)) {
    const ratioValue = reviewAggregateRatio(
      item,
      group,
      scope,
      context,
      options,
      subjects,
    );
    if (ratioValue != null) return reviewOptionRound(options, ratioValue, 4);
    // 与 S1 一致：强制比率无法解析分子分母时，回退 MIX 加权，避免小计空白
    if (
      isForcedRatioAggregateRow(reviewBuildForcedRatioRow(item, group, options))
    ) {
      const weightedValue = aggregateNumbers(numbers, "weighted_by_mix", {
        weights: Array.isArray(context.weights) ? context.weights : [],
      });
      return weightedValue == null
        ? null
        : reviewOptionRound(options, weightedValue, 4);
    }
    return null;
  }

  const source = (Array.isArray(numbers) ? numbers : [])
    .map((value) => reviewOptionNumber(options, value))
    .filter((value) => value != null);
  if (!source.length && reviewSubjectId(item) !== "mix") return null;

  if (reviewSubjectId(item) === "mix") {
    if (scope === "lifecycle") {
      const totalVolume = reviewLifecycleTotalVolume(
        context.values,
        context.versionKey,
        context.yearIndexes,
        context.subtotalTrimIndex,
        options,
        subjects,
      );
      if (!totalVolume) {
        if (!source.length) return null;
        const fallbackValue =
          source.reduce((sum, num) => sum + num, 0) / source.length;
        return reviewOptionRound(options, fallbackValue, 4);
      }
      if (context.trimIndex === context.subtotalTrimIndex) return 1;
      const volumeSubject =
        reviewFindSubjectByTemplateId(options, "proj_vol", subjects) ||
        reviewFindSubjectByTemplateId(options, "sales_volume", subjects) ||
        reviewFindSubjectByTemplateId(options, "volume", subjects) ||
        "proj_vol";
      const volumeTarget = reviewResolveValueTarget(
        context.values,
        volumeSubject,
        null,
        options,
        subjects,
      ).target;
      const yearTrims =
        volumeTarget &&
        volumeTarget.yearTrims &&
        volumeTarget.yearTrims[context.versionKey];
      const numerator = (
        Array.isArray(context.yearIndexes) ? context.yearIndexes : []
      ).reduce((sum, yearIndex) => {
        const values = Array.isArray(yearTrims && yearTrims[yearIndex])
          ? yearTrims[yearIndex]
          : [];
        const value = reviewOptionNumber(options, values[context.trimIndex]);
        return sum + (value || 0);
      }, 0);
      return reviewOptionRound(options, numerator / totalVolume, 4);
    }
    return source.length ? 1 : null;
  }

  if (isWeightedAggregateFormula(formula) || formula === "volume_weighted") {
    const weightedValue = aggregateNumbers(numbers, "weighted_by_mix", {
      weights: Array.isArray(context.weights) ? context.weights : [],
    });
    return weightedValue == null
      ? null
      : reviewOptionRound(options, weightedValue, 4);
  }
  const value = aggregateNumbers(
    source,
    formula === "sum_year" ? "sum" : formula,
  );
  return value == null ? null : reviewOptionRound(options, value, 4);
}

function _reviewAggregatePathValue(
  path,
  scope = "year",
  context = {},
  options = {},
  subjects = [],
) {
  const matched = reviewFindSubjectByPath(options, path, subjects);
  return reviewAggregateMatchedValue(
    matched,
    scope,
    context,
    options,
    subjects,
  );
}

/**
 * 按已匹配科目聚合年小计 / 全生命周期值（供比率分子分母复用）
 */
function reviewAggregateMatchedValue(
  matched,
  scope = "year",
  context = {},
  options = {},
  subjects = [],
) {
  if (!matched || !matched.item) return null;
  const values = context.values || {};
  const versionKey = context.versionKey;
  const subtotalTrimIndex = Number.isInteger(context.subtotalTrimIndex)
    ? context.subtotalTrimIndex
    : 0;

  if (scope === "year") {
    const yearIndex = Number(context.yearIndex);
    if (!Number.isInteger(yearIndex)) return null;
    const yearTrimValues = reviewTargetYearTrimValues(
      values,
      matched,
      versionKey,
      yearIndex,
      options,
      subjects,
    );
    if (
      Number.isInteger(context.trimIndex) &&
      context.trimIndex !== subtotalTrimIndex
    ) {
      return reviewOptionNumber(options, yearTrimValues[context.trimIndex]);
    }
    const numbers = yearTrimValues.map((value, trimIndex) =>
      trimIndex === subtotalTrimIndex ? null : value,
    );
    return reviewAggregateNumbers(
      numbers,
      matched.item,
      matched.group,
      "year",
      {
        ...context,
        weights: reviewResolveYearWeights(
          values,
          versionKey,
          yearIndex,
          subtotalTrimIndex,
          options,
          subjects,
        ),
      },
      options,
      subjects,
    );
  }

  const yearIndexes = Array.isArray(context.yearIndexes)
    ? context.yearIndexes
    : [];
  const lifecycleSource = yearIndexes.map((yearIndex) =>
    reviewAggregateMatchedValue(
      matched,
      "year",
      {
        ...context,
        yearIndex,
        yearIndexes,
      },
      options,
      subjects,
    ),
  );
  return reviewAggregateNumbers(
    lifecycleSource,
    matched.item,
    matched.group,
    "lifecycle",
    {
      ...context,
      yearIndexes,
      weights: reviewResolveLifecycleWeights(
        values,
        versionKey,
        yearIndexes,
        Number.isInteger(context.trimIndex)
          ? context.trimIndex
          : subtotalTrimIndex,
        subtotalTrimIndex,
        options,
        subjects,
      ),
    },
    options,
    subjects,
  );
}

/**
 * 按公式参数绑定查找评审科目（subjectId 优先，路径兜底）
 */
function reviewFindSubjectByBinding(options = {}, binding = {}, subjects = []) {
  const subjectIds = collectFormulaBindingSubjectIds(binding);
  for (let index = 0; index < subjectIds.length; index += 1) {
    const matched = reviewFindSubjectByTemplateId(
      options,
      subjectIds[index],
      subjects,
    );
    if (matched && matched.item) return matched;
  }
  const pathCandidates = collectFormulaBindingPathCandidates(binding);
  for (let index = 0; index < pathCandidates.length; index += 1) {
    const matched = reviewFindSubjectByPath(
      options,
      pathCandidates[index],
      subjects,
    );
    if (matched && matched.item) return matched;
  }
  return null;
}

/**
 * 解析比率分子/分母：显式路径优先，否则按公式参数绑定（对齐 S1 resolveRatioComponentRows）
 */
function reviewResolveRatioComponents(
  item,
  group,
  options = {},
  subjects = [],
) {
  const meta = reviewFormulaMeta(options, item, group) || {};
  const numeratorPath = reviewOptionText(
    options,
    meta.ratioNumeratorPath || (item && item.ratioNumeratorPath),
  );
  const denominatorPath = reviewOptionText(
    options,
    meta.ratioDenominatorPath || (item && item.ratioDenominatorPath),
  );
  if (numeratorPath && denominatorPath) {
    const numeratorRef = reviewFindSubjectByPath(
      options,
      numeratorPath,
      subjects,
    );
    const denominatorRef = reviewFindSubjectByPath(
      options,
      denominatorPath,
      subjects,
    );
    if (
      numeratorRef &&
      numeratorRef.item &&
      denominatorRef &&
      denominatorRef.item
    ) {
      return { mode: "divide", numeratorRefs: [numeratorRef], denominatorRef };
    }
  }

  const bindings = parseFormulaParamBindings(
    meta.formulaParamBindings != null
      ? meta.formulaParamBindings
      : item && item.formulaParamBindings,
  );
  if (bindings.length) {
    const byCode = {};
    bindings.forEach((binding, index) => {
      const code = safeText(getFormulaParamCode(binding, index)).replace(
        /\s+/g,
        "",
      );
      if (!code) return;
      const matched = reviewFindSubjectByBinding(options, binding, subjects);
      byCode[code] = matched;
      byCode[code.toUpperCase()] = matched;
    });

    const p1 = byCode["参数1"] || byCode.PARAM1 || byCode.NUMERATOR;
    const p2 = byCode["参数2"] || byCode.PARAM2 || byCode.DENOMINATOR;
    const p3 = byCode["参数3"] || byCode.PARAM3;
    if (p1 && p1.item && p2 && p2.item && p3 && p3.item) {
      return { mode: "sum_over", numeratorRefs: [p1, p2], denominatorRef: p3 };
    }
    if (p1 && p1.item && p2 && p2.item) {
      return { mode: "divide", numeratorRefs: [p1], denominatorRef: p2 };
    }

    const componentRefs = bindings
      .map((binding) => reviewFindSubjectByBinding(options, binding, subjects))
      .filter((matched) => matched && matched.item);
    if (componentRefs.length === 3) {
      return {
        mode: "sum_over",
        numeratorRefs: [componentRefs[0], componentRefs[1]],
        denominatorRef: componentRefs[2],
      };
    }
    if (componentRefs.length === 2) {
      return {
        mode: "divide",
        numeratorRefs: [componentRefs[0]],
        denominatorRef: componentRefs[1],
      };
    }
  }

  // S8 兜底：按模板别名解析两个强制比率行（边际贡献率、营业利润率）
  return reviewResolveRatioComponentsByAlias(item, options, subjects);
}

/**
 * 强制比率行按模板别名找分子/分母（不依赖绑定是否落在 item 上）
 */
function reviewResolveRatioComponentsByAlias(
  item,
  options = {},
  subjects = [],
) {
  const templateId = reviewSubjectId(item).toLowerCase();
  const subjectName = safeText(
    item && (item.name || item.subjectName || item.subject),
  )
    .replace(/^[\s\u3000]+/, "")
    .replace(/[（）()]/g, "")
    .replace(/[%％]/g, "");
  let numeratorId;
  let denominatorId = "revenue";
  if (templateId === "margin_rate" || subjectName === "边际贡献率") {
    numeratorId = "margin";
  } else if (templateId === "op_rate" || subjectName === "营业利润率") {
    numeratorId = "op_profit";
  } else {
    return null;
  }
  const numeratorRef = reviewFindSubjectByTemplateId(
    options,
    numeratorId,
    subjects,
  );
  const denominatorRef = reviewFindSubjectByTemplateId(
    options,
    denominatorId,
    subjects,
  );
  if (
    !numeratorRef ||
    !numeratorRef.item ||
    !denominatorRef ||
    !denominatorRef.item
  )
    return null;
  return { mode: "divide", numeratorRefs: [numeratorRef], denominatorRef };
}

function reviewBuildForcedRatioRow(item, group, options = {}) {
  const meta = reviewFormulaMeta(options, item, group) || {};
  const itemName = safeText(
    item && (item.name || item.subjectName || item.subject),
  ).replace(/^[\s\u3000]+/, "");
  const groupName = safeText(group && (group.group || group.name));
  // 与 S8 resolveCalcSubjectPath 一致：无显式路径时用 主表/分组/科目，保证「单车收益」可识别
  const fallbackPath = ["主表", groupName, itemName].filter(Boolean).join("/");
  const path = safeText(
    meta.targetPath ||
      (item && (item.fullNamePath || item.subjectPath)) ||
      fallbackPath,
  );
  return {
    ...(item || {}),
    subject: itemName,
    subjectName: itemName,
    subjectPath: path,
    fullNamePath: path,
    rootSubjectName: "主表",
    subtable: "主表",
    moduleName: "主表",
  };
}

function reviewAggregateRatio(
  item,
  group,
  scope = "year",
  context = {},
  options = {},
  subjects = [],
) {
  const components = reviewResolveRatioComponents(
    item,
    group,
    options,
    subjects,
  );
  if (components && components.denominatorRef) {
    const readValue = (matched) =>
      reviewAggregateMatchedValue(matched, scope, context, options, subjects);
    const denominator = readValue(components.denominatorRef);
    if (denominator == null || denominator === 0) return null;
    const numeratorRefs = Array.isArray(components.numeratorRefs)
      ? components.numeratorRefs
      : [];
    if (components.mode === "sum_over") {
      const parts = numeratorRefs.map((matched) => readValue(matched));
      if (parts.some((num) => num == null)) return null;
      return parts.reduce((sum, num) => sum + num, 0) / denominator;
    }
    const numerator = numeratorRefs.length ? readValue(numeratorRefs[0]) : null;
    return aggregateRatio(numerator, denominator);
  }
  return null;
}

function reviewEnsureMixValuesFromVolume(
  values = {},
  subjects = [],
  options = {},
) {
  const mixSubject = reviewFindSubjectByTemplateId(options, "mix", subjects);
  if (!mixSubject || !mixSubject.item) return;
  const subtotalTrimIndex = Number(options.subtotalTrimIndex);
  const yearIndexes = Array.isArray(options.yearIndexes)
    ? options.yearIndexes
    : [];
  const mixResolved = reviewEnsureValueTarget(
    values,
    mixSubject,
    mixSubject.group,
    options,
    subjects,
  );
  const mixTarget = mixResolved.target;
  if (!mixTarget) return;
  const versionKeys = reviewCollectVersionKeys(values);
  versionKeys.forEach((versionKey) => {
    if (!mixTarget.yearTrims) mixTarget.yearTrims = {};
    if (!mixTarget.years) mixTarget.years = {};
    if (!mixTarget.trims) mixTarget.trims = {};
    if (!mixTarget.yearTrims[versionKey]) mixTarget.yearTrims[versionKey] = {};
    if (!mixTarget.years[versionKey]) mixTarget.years[versionKey] = {};
    yearIndexes.forEach((yearIndex) => {
      const volume = reviewNormalizeVolumeWeights(
        values,
        versionKey,
        yearIndex,
        subtotalTrimIndex,
        options,
        subjects,
      );
      if (!volume.hasVolumeData) return;
      const row = [];
      volume.weights.forEach((weight, trimIndex) => {
        row[trimIndex] =
          weight == null ? "" : reviewOptionRound(options, weight, 4);
      });
      if (volume.total) {
        row[subtotalTrimIndex] = 1;
        mixTarget.years[versionKey][yearIndex] = 1;
      } else {
        row[subtotalTrimIndex] = "";
        delete mixTarget.years[versionKey][yearIndex];
      }
      mixTarget.yearTrims[versionKey][yearIndex] = row;
    });
  });
}

function reviewBuildSubjectLookup(subjects = [], options = {}) {
  const lookup = {};
  const push = (key, payload) => {
    const normalized = reviewOptionText(options, key);
    if (normalized && !lookup[normalized]) lookup[normalized] = payload;
  };
  (Array.isArray(subjects) ? subjects : []).forEach((group) => {
    (Array.isArray(group && group.items) ? group.items : []).forEach((item) => {
      const payload = { group, item };
      reviewResolveSubjectKeys(options, item).forEach((key) =>
        push(key, payload),
      );
    });
  });
  return lookup;
}

function reviewResolveTrimIndexes(
  yearTrims = {},
  yearIndexes = [],
  trimCount = 0,
  subtotalTrimIndex = 0,
) {
  const map = {};
  if (Number(trimCount) > 0) {
    for (let index = 0; index < Number(trimCount); index += 1)
      map[index] = true;
  }
  (Array.isArray(yearIndexes) ? yearIndexes : []).forEach((yearIndex) => {
    const values = Array.isArray(yearTrims && yearTrims[yearIndex])
      ? yearTrims[yearIndex]
      : [];
    values.forEach((_value, trimIndex) => {
      if (trimIndex !== undefined) map[trimIndex] = true;
    });
  });
  map[subtotalTrimIndex] = true;
  return Object.keys(map)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item))
    .sort((a, b) => a - b);
}

export function applyMainReviewFormulaAggregatesToValues(
  values = {},
  subjects = [],
  options = {},
) {
  const yearIndexes = Array.isArray(options.yearIndexes)
    ? options.yearIndexes
    : [];
  const lifecycleIndex = Number(options.lifecycleIndex);
  const subtotalTrimIndex = Number(options.subtotalTrimIndex);
  if (!Number.isInteger(subtotalTrimIndex)) return values;
  const trimCount = Number(options.trimCount) || 0;
  const lookup = reviewBuildSubjectLookup(subjects, options);

  reviewEnsureMixValuesFromVolume(values, subjects, {
    ...options,
    yearIndexes,
    subtotalTrimIndex,
  });

  Object.keys(values || {}).forEach((subjectId) => {
    const target = values[subjectId];
    if (!target || typeof target !== "object") return;
    const matched = lookup[reviewOptionText(options, subjectId)] || {};
    const item = matched.item || {};
    const group = matched.group || {};
    const yearTrimsByVersion = target.yearTrims || {};
    Object.keys(yearTrimsByVersion).forEach((versionKey) => {
      if (!target.years) target.years = {};
      if (!target.years[versionKey]) target.years[versionKey] = {};
      if (!target.trims) target.trims = {};
      const yearTrims = yearTrimsByVersion[versionKey] || {};
      const years = target.years[versionKey];

      yearIndexes.forEach((yearIndex) => {
        const yearTrimValues = Array.isArray(yearTrims[yearIndex])
          ? yearTrims[yearIndex]
          : [];
        const numbers = yearTrimValues.map((value, trimIndex) =>
          trimIndex === subtotalTrimIndex ? null : value,
        );
        const subtotal = reviewAggregateNumbers(
          numbers,
          item,
          group,
          "year",
          {
            values,
            subjects,
            versionKey,
            yearIndex,
            yearIndexes,
            trimIndex: subtotalTrimIndex,
            subtotalTrimIndex,
            weights: reviewResolveYearWeights(
              values,
              versionKey,
              yearIndex,
              subtotalTrimIndex,
              options,
              subjects,
            ),
          },
          options,
          subjects,
        );
        if (subtotal == null) return;
        if (!Array.isArray(yearTrims[yearIndex])) yearTrims[yearIndex] = [];
        yearTrims[yearIndex][subtotalTrimIndex] = subtotal;
        years[yearIndex] = subtotal;
      });

      if (Number.isInteger(lifecycleIndex) && lifecycleIndex >= 0) {
        const lifecycleRow = Array.isArray(yearTrims[lifecycleIndex])
          ? yearTrims[lifecycleIndex]
          : [];
        reviewResolveTrimIndexes(
          yearTrims,
          yearIndexes,
          trimCount,
          subtotalTrimIndex,
        ).forEach((trimIndex) => {
          const lifecycleSource = yearIndexes.map((yearIndex) => {
            if (trimIndex === subtotalTrimIndex) return years[yearIndex];
            const row = Array.isArray(yearTrims[yearIndex])
              ? yearTrims[yearIndex]
              : [];
            return row[trimIndex];
          });
          const lifecycleValue = reviewAggregateNumbers(
            lifecycleSource,
            item,
            group,
            "lifecycle",
            {
              values,
              subjects,
              versionKey,
              yearIndexes,
              lifecycleIndex,
              trimIndex,
              subtotalTrimIndex,
              weights: reviewResolveLifecycleWeights(
                values,
                versionKey,
                yearIndexes,
                trimIndex,
                subtotalTrimIndex,
                options,
                subjects,
              ),
            },
            options,
            subjects,
          );
          if (lifecycleValue == null) return;
          lifecycleRow[trimIndex] = lifecycleValue;
          if (trimIndex === subtotalTrimIndex)
            years[lifecycleIndex] = lifecycleValue;
        });
        if (lifecycleRow.length) yearTrims[lifecycleIndex] = lifecycleRow;
      }

      const firstYearIndex = yearIndexes[0];
      const firstYearValues = Array.isArray(yearTrims[firstYearIndex])
        ? yearTrims[firstYearIndex].slice()
        : [];
      target.trims[versionKey] = firstYearValues;
      if (years[firstYearIndex] != null) {
        target[versionKey] = years[firstYearIndex];
      } else if (firstYearValues[subtotalTrimIndex] != null) {
        target[versionKey] = firstYearValues[subtotalTrimIndex];
      }
    });
  });
  return values;
}

function hasFormulaCellValue(value) {
  return toNumber(value) !== null || Boolean(safeText(value));
}

const LEGACY_MAIN_INPUT_BACKFILL_PATHS = Object.freeze([
  "主表/单车收益/消费税金及附加",
  "主表/单车收益/华为服务费",
  "主表/单车收益/选装收益",
]);

function normalizeBackfillSubjectId(row = {}) {
  return safeText(
    row.templateSubjectId ||
      row.subjectId ||
      row.expenseSubjectId ||
      (row.templateItem && row.templateItem.subjectId) ||
      row.id ||
      row.rowId,
  );
}

const MAIN_MANUAL_NAMED_SUBJECTS = Object.freeze([
  "消费税金及附加",
  "消费税及附加",
  "华为服务费",
  "选装收益",
]);

export function isMainManualInputBackfillRow(row = {}) {
  if (moduleCodeFromRow(row) !== REVENUE_MODULE_CODE.MAIN_PNL) return false;
  if (getBackendTemplateEntryMode(row) === "MANUAL") return true;
  const path = getRowPath(row);
  if (LEGACY_MAIN_INPUT_BACKFILL_PATHS.includes(path)) return true;
  const subject = safeText(row.subjectName || row.subject);
  return MAIN_MANUAL_NAMED_SUBJECTS.includes(subject);
}

/** 仅按科目名/路径识别主表 3 行手工项，不把误标 MANUAL 的计算行当成可填。 */
function isMainManualNamedFillRow(row = {}) {
  const path = getRowPath(row);
  if (LEGACY_MAIN_INPUT_BACKFILL_PATHS.includes(path)) return true;
  const normalizedPath = normalizeFormulaText(path);
  if (LEGACY_MAIN_INPUT_BACKFILL_PATHS.some((item) => normalizeFormulaText(item) === normalizedPath)) {
    return true;
  }
  const subject = safeText(row.subjectName || row.subject);
  if (MAIN_MANUAL_NAMED_SUBJECTS.includes(subject)) return true;
  const pathParts = Array.isArray(row.subjectPath)
    ? row.subjectPath
    : Array.isArray(row.subjectTreePath)
      ? row.subjectTreePath
      : path.split("/");
  const leaf = safeText(pathParts.length ? pathParts[pathParts.length - 1] : "");
  if (MAIN_MANUAL_NAMED_SUBJECTS.includes(leaf)) return true;
  return MAIN_MANUAL_NAMED_SUBJECTS.some((name) => {
    const normalizedName = normalizeFormulaText(name);
    return (
      normalizedPath.endsWith(normalizedName) ||
      normalizeFormulaText(subject).endsWith(normalizedName) ||
      normalizeFormulaText(leaf).endsWith(normalizedName)
    );
  });
}

/** 主表非手工行：按年份/版型应只读展示，由子表公式回写。 */
export function isMainNonManualFillRow(row = {}) {
  return moduleCodeFromRow(row) === REVENUE_MODULE_CODE.MAIN_PNL && !isMainManualNamedFillRow(row);
}

function getMainInputBackfillMetaList(detail = {}) {
  const rows = detail && Array.isArray(detail.rows) ? detail.rows : [];
  return rows
    .filter(isMainManualInputBackfillRow)
    .map((row) => ({
      row,
      targetPath: getRowPath(row),
      normalizedPath: normalizeFormulaText(getRowPath(row)),
      subjectId: normalizeBackfillSubjectId(row),
      subjectName: safeText(row.subjectName || row.subject),
    }))
    .filter((meta) => meta.targetPath || meta.subjectId);
}

function findMainInputBackfillSourceRow(sourceRows = [], meta = {}) {
  // 修复：从所有行中查找源数据（而非仅主表 MANUAL 行）
  // 这样主表行才能从子表行（销售费用、材料成本等）中获取数据
  if (!sourceRows.length) return null;
  if (meta.subjectId) {
    const idMatch = sourceRows.find(
      (row) => normalizeBackfillSubjectId(row) === meta.subjectId,
    );
    if (idMatch) return idMatch;
  }
  if (meta.normalizedPath) {
    const pathMatch = sourceRows.find(
      (row) => normalizeFormulaText(getRowPath(row)) === meta.normalizedPath,
    );
    if (pathMatch) return pathMatch;
  }
  // 最后 fallback：按科目名称匹配（主表行的 subjectId/路径在子表中不存在时使用）
  // 例如 主表"消费税金及附加" → 子表"销售费用/消费税金及附加"
  if (meta.subjectName) {
    const nameMatch = sourceRows.find(
      (row) => {
        const rowName = safeText(row.subjectName || row.subject);
        return rowName && rowName === meta.subjectName;
      },
    );
    if (nameMatch) return nameMatch;
  }
  return null;
}

function readMainInputBackfillSourceCell(row, cellKey, dimension = {}) {
  if (isRevenueYearOnlyRow(row)) {
    return readYearOnlyCell(row, cellKey, dimension);
  }
  const cells =
    row && row.cells && typeof row.cells === "object" ? row.cells : {};
  if (Object.prototype.hasOwnProperty.call(cells, cellKey))
    return cells[cellKey];
  return readRowCell(row, cellKey, dimension);
}

function writeMainInputBackfillCell(row, cellKey, value, dimension = {}) {
  if (!row) return;
  const existingValue = readMainInputBackfillSourceCell(
    row,
    cellKey,
    dimension,
  );
  if (hasFormulaCellValue(existingValue)) return;
  const formattedValue = String(value == null ? "" : value);
  ensureCells(row)[cellKey] = formattedValue;

  const year = safeText(dimension.year);
  if (!year) return;
  if (!row.cellMap || typeof row.cellMap !== "object") row.cellMap = {};
  if (isRevenueYearOnlyRow(row)) {
    row.cellMap[`${year}__`] = formattedValue;
    return;
  }
  const trim = dimension.trim;
  const trimId = safeText(
    dimension.trimId ||
      (trim && typeof trim === "object"
        ? trim.trimId || trim.id || trim.code || trim.name || trim.label
        : trim),
  );
  if (trimId) row.cellMap[`${year}__${trimId}`] = formattedValue;
}

function backfillMainInputRowsFromSources(detail, target, options = {}) {
  const sourceDetails = Array.isArray(options.sourceDetails)
    ? options.sourceDetails
    : [];
  if (!sourceDetails.length) return;
  const sourceRows = collectDetailsRows(sourceDetails);
  if (!sourceRows.length) return;
  const metas = getMainInputBackfillMetaList(detail);
  if (!metas.length) return;

  forEachDetailCell(detail, ({ year, trim, trimId, cellKey }) => {
    const dimension = { year, trim, trimId };
    metas.forEach((meta) => {
      const row = target.findRow(meta.targetPath);
      if (!row) return;
      const sourceRow = findMainInputBackfillSourceRow(sourceRows, meta);
      const sourceValue = readMainInputBackfillSourceCell(
        sourceRow,
        cellKey,
        dimension,
      );
      if (!hasFormulaCellValue(sourceValue)) return;
      writeMainInputBackfillCell(row, cellKey, sourceValue, dimension);
    });
  });
}

function applyMainFormulas(detail, _modules, options = {}) {
  if (!detail || !Array.isArray(detail.rows))
    return { updatedRows: 0, errors: [] };
  const target = buildModuleIndex(detail.rows);
  backfillMainInputRowsFromSources(detail, target, options);

  return {
    updatedRows: 0,
    errors: [],
  };
}

export function applyRevenueFormulasToDetail(detail, options = {}) {
  const extraSourceDetails = Array.isArray(options.sourceDetails)
    ? options.sourceDetails
    : [];
  const sourceDetails = [detail].concat(extraSourceDetails);
  const modules = buildRevenueFormulaModules(sourceDetails);
  const targetModuleCode =
    options.targetModuleCode || moduleCodeFromRow((detail.rows || [])[0] || {});
  const containsMainRows =
    targetModuleCode === REVENUE_MODULE_CODE.MAIN_PNL ||
    detailContainsModuleRows(detail, REVENUE_MODULE_CODE.MAIN_PNL);
  const mainAuditMode = isMainAuditCalculationMode(options);

  // ===== 诊断日志：公式引擎入口状态（仅主表 detail） =====
  if (typeof window !== "undefined" && containsMainRows && !window.__formulaEngineDiagLogged) {
    window.__formulaEngineDiagLogged = true;
    const allRows = Array.isArray(detail.rows) ? detail.rows : [];
    const rowsByModule = {};
    allRows.forEach(function (r) {
      const mc = String((r && r.moduleCode) || moduleCodeFromRow(r) || "unknown");
      if (!rowsByModule[mc]) rowsByModule[mc] = { count: 0, hasCellData: 0, samplePath: "" };
      rowsByModule[mc].count++;
      const hasData = (r && r.cells && Object.keys(r.cells).length > 0) ||
                      (r && r.cellMap && Object.keys(r.cellMap).length > 0);
      if (hasData) rowsByModule[mc].hasCellData++;
      if (!rowsByModule[mc].samplePath) {
        rowsByModule[mc].samplePath = getRowPath(r);
      }
    });
    const targetSalesVolumeRow = getTargetSalesVolumeRow(modules);
    console.groupCollapsed("[公式引擎诊断] applyRevenueFormulasToDetail 入口");
    console.log("detail.rows 总数:", allRows.length);
    console.log("extraSourceDetails 数量:", extraSourceDetails.length);
    console.log("sourceDetails 数量:", sourceDetails.length);
    console.log("modules keys:", Object.keys(modules));
    console.log("各 moduleCode 行统计:", rowsByModule);
    console.log("targetSalesVolumeRow:", targetSalesVolumeRow ? {
      path: getRowPath(targetSalesVolumeRow),
      hasCells: !!(targetSalesVolumeRow.cells && Object.keys(targetSalesVolumeRow.cells).length),
      cellsKeys: targetSalesVolumeRow.cells ? Object.keys(targetSalesVolumeRow.cells).slice(0, 5) : [],
    } : "NOT FOUND");
    console.log("containsMainRows:", containsMainRows);
    console.log("targetModuleCode:", targetModuleCode);
    console.groupEnd();
  }

  const subtableResult = applySubtableFormulas(detail, modules, options);
  if (containsMainRows) {
    const mainSourceDetails = mainAuditMode
      ? [filterDetailRows(detail, isMainFormulaRow)]
      : sourceDetails;
    const nextModules = buildRevenueFormulaModules(mainSourceDetails);
    // 对齐 Vue2：回填只用外部 options.sourceDetails（如 S2 子表 + S1 主表基准），
    // 不要把当前空壳 detail 并进 sourceDetails，否则 subjectId 会先命中自身空行，
    // 导致消费税金及附加/华为服务费/选装收益无法从 S1 基准回填。
    const mainResult = applyMainFormulas(detail, nextModules, options);
    return {
      updatedRows: subtableResult.updatedRows + mainResult.updatedRows,
      errors: mainResult.errors || [],
    };
  }
  return {
    updatedRows: subtableResult.updatedRows,
    errors: [],
  };
}

function describeFormulaRow(row = {}) {
  if (!row || typeof row !== "object") return null;
  const path = getRowPath(row);
  return {
    id: safeText(row.id || row.rowId || row.subjectId),
    subjectId: safeText(row.subjectId),
    subject: safeText(row.subjectName || row.subject),
    path,
    subtable: safeText(row.subtable),
    rootSubjectName: safeText(row.rootSubjectName),
    moduleCode: safeText(row.moduleCode || moduleCodeFromRow(row)),
    rowKind: safeText(row.rowKind),
    calculated: Boolean(row.calculated),
    readonly: Boolean(row.readonly),
    cellKeys:
      row.cells && typeof row.cells === "object" ? Object.keys(row.cells) : [],
    cellMapKeys:
      row.cellMap && typeof row.cellMap === "object"
        ? Object.keys(row.cellMap)
        : [],
  };
}

export function collectSalesVolumeMixDiagnostics(detail = {}) {
  const rows = Array.isArray(detail && detail.rows) ? detail.rows : [];
  const index = buildModuleIndex(rows);
  const volumeRow = index.findRow(TARGET_SALES_VOLUME_PATHS);
  const mixRow = index.findRow(SALES_VOLUME_MIX_PATHS);
  const dimensions =
    detail && detail.dimensions && typeof detail.dimensions === "object"
      ? detail.dimensions
      : { years: [], trims: [] };
  const salesRows = rows
    .filter(
      (row) => moduleCodeFromRow(row) === REVENUE_MODULE_CODE.SALES_VOLUME,
    )
    .map((row) => describeFormulaRow(row));
  const mixRows = rows
    .filter((row) => normalizeFormulaText(getRowPath(row)).includes("mix"))
    .map((row) => describeFormulaRow(row));
  const probes = [];

  forEachDetailCell(
    detail,
    ({ year, yearIndex, trim, trimId, trimIndex, cellKey }) => {
      const dimension = { year, trim, trimId };
      const trimEntries = getDetailTrimEntries(detail, year);
      const volume = readRowCell(volumeRow, cellKey, dimension);
      const total = getYearTotalFromRow(
        volumeRow,
        yearIndex,
        trimEntries,
        year,
      );
      const expected = total ? safeFormulaDiv(volume, total) : "";
      const mixValue = readRowCell(mixRow, cellKey, dimension);
      probes.push({
        year,
        yearIndex,
        trimId,
        trimIndex,
        cellKey,
        dimensionKey: `${safeText(year)}__${safeText(trimId)}`,
        volume,
        yearVolumeTotal: total,
        expectedRaw: expected,
        expectedDisplay: mixRow
          ? formatFormulaValue(expected, mixRow, 4)
          : safeText(expected),
        actualMixValue: mixValue,
        matchedVolumeRowId:
          volumeRow &&
          safeText(volumeRow.id || volumeRow.rowId || volumeRow.subjectId),
        matchedMixRowId:
          mixRow && safeText(mixRow.id || mixRow.rowId || mixRow.subjectId),
      });
    },
  );

  return {
    timestamp: new Date().toISOString(),
    dimensions: {
      years: Array.isArray(dimensions.years) ? dimensions.years.slice() : [],
      trims: Array.isArray(dimensions.trims) ? dimensions.trims.slice() : [],
    },
    trimOptions: Array.isArray(detail && detail.trimOptions)
      ? detail.trimOptions.slice()
      : [],
    yearTrimConfig:
      detail &&
      detail.yearTrimConfig &&
      typeof detail.yearTrimConfig === "object"
        ? { ...detail.yearTrimConfig }
        : {},
    matched: {
      volumeRow: describeFormulaRow(volumeRow),
      mixRow: describeFormulaRow(mixRow),
    },
    candidateRows: {
      salesRows,
      mixRows,
    },
    probes,
  };
}

export function createFormulaContext(options = {}) {
  return {
    modules: options.modules || {},
    params: {
      taxRate: 0.13,
      roundPrecision: 4,
      ...(options.params || {}),
    },
    traces: [],
    errors: [],
    read(ref = {}) {
      const moduleCode = String(ref.moduleCode || "").trim();
      const subjectPath = String(ref.subjectPath || "").trim();
      const cellKey = String(ref.cellKey || "").trim();
      const module = moduleCode ? this.modules[moduleCode] : null;
      if (!module || !subjectPath || !cellKey) return "";
      const row = module.rowByPath && module.rowByPath[subjectPath];
      if (!row || !row.cells) return "";
      return row.cells[cellKey] == null ? "" : row.cells[cellKey];
    },
    trace(item) {
      this.traces.push(item);
    },
    error(item) {
      this.errors.push(item);
    },
  };
}

export function sortModulesByCalculationOrder(moduleCodes = []) {
  const orderMap = {};
  REVENUE_CALCULATION_ORDER.forEach((moduleCode, index) => {
    orderMap[moduleCode] = index;
  });
  return (Array.isArray(moduleCodes) ? moduleCodes : [])
    .slice()
    .sort((a, b) => {
      const ai = Object.prototype.hasOwnProperty.call(orderMap, a)
        ? orderMap[a]
        : 999;
      const bi = Object.prototype.hasOwnProperty.call(orderMap, b)
        ? orderMap[b]
        : 999;
      if (ai !== bi) return ai - bi;
      return String(a).localeCompare(String(b), "zh-CN");
    });
}

export function evaluateFormulaRegistry(
  registry = {},
  context = createFormulaContext(),
) {
  const result = {};
  Object.keys(registry || {}).forEach((formulaKey) => {
    const formula = registry[formulaKey];
    if (typeof formula !== "function") return;
    try {
      result[formulaKey] = formula(RevenueFormulaFns, context);
    } catch (error) {
      context.error({
        formulaKey,
        message: error && error.message ? error.message : "公式计算失败",
      });
      result[formulaKey] = "";
    }
  });
  return {
    values: result,
    traces: context.traces,
    errors: context.errors,
  };
}
