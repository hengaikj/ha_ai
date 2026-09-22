export const REVENUE_VALUE_TYPE = Object.freeze({
  NUMBER: "NUMBER",
  TEXT: "TEXT",
});

export const REVENUE_UNIT_TYPE = Object.freeze({
  PERCENT: "percent",
  MONEY: "money",
  VOLUME: "volume",
  COUNT: "count",
  TEXT: "text",
  UNKNOWN: "unknown",
});

function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function stripLineBreaks(value) {
  return String(value == null ? "" : value).replace(/\r?\n/g, " ").trim();
}

function normalizeUnitText(unit) {
  return safeText(unit).replace(/％/g, "%");
}

function stripTrailingPercent(value) {
  return safeText(value).replace(/[%％]\s*$/u, "").trim();
}

function stripAllPercent(value) {
  return safeText(value).replace(/[%％]/gu, "").trim();
}

function hasPercentToken(value) {
  return /[%％]/u.test(safeText(value));
}

function normalizeNumericText(value, options = {}) {
  const allowPercent = options.allowPercent === true;
  const text = allowPercent ? stripTrailingPercent(value) : safeText(value);
  return text.replace(/,/g, "").trim();
}

function isPlainNumericText(value) {
  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/u.test(safeText(value));
}

function isPercentText(value) {
  return /[%％]\s*$/u.test(safeText(value));
}

function hasTenThousandUnit(unit) {
  const text = normalizeUnitText(unit);
  return /万元|万辆|万台|万\/台|万元\/台/u.test(text);
}

function getStoragePerDisplayUnit(unit) {
  if (isPercentUnit(unit)) return 0.01;
  if (hasTenThousandUnit(unit)) return 10000;
  return 1;
}

function isScaledUnit(unit) {
  return getStoragePerDisplayUnit(unit) !== 1;
}

function toFiniteNumber(value, options = {}) {
  const num = typeof value === "number"
    ? value
    : parseRevenueNumber(value, { allowPercent: options.allowPercent === true });
  return Number.isFinite(num) ? num : null;
}

function buildNumberPayload(numberValue) {
  const rawValue = formatRevenueRawNumber(numberValue);
  return {
    valueType: REVENUE_VALUE_TYPE.NUMBER,
    rawValue: rawValue == null ? "" : rawValue,
    numberValue,
    textValue: undefined,
  };
}

function buildTextPayload(value) {
  const rawValue = safeText(value);
  return {
    valueType: REVENUE_VALUE_TYPE.TEXT,
    rawValue,
    numberValue: undefined,
    textValue: rawValue,
  };
}

export function normalizeRevenueUnit(unit) {
  return normalizeUnitText(unit);
}

export function isPercentUnit(unit) {
  return normalizeUnitText(unit) === "%";
}

export function getRevenueUnitType(unit) {
  const text = normalizeUnitText(unit);
  if (!text) return REVENUE_UNIT_TYPE.UNKNOWN;
  if (text === "%") return REVENUE_UNIT_TYPE.PERCENT;
  if (/万元|元|万\/台|万元\/台/u.test(text)) return REVENUE_UNIT_TYPE.MONEY;
  if (/万辆|万台|辆|台/u.test(text)) return REVENUE_UNIT_TYPE.VOLUME;
  if (/个|项|次/u.test(text)) return REVENUE_UNIT_TYPE.COUNT;
  return REVENUE_UNIT_TYPE.TEXT;
}

export function parseRevenueNumber(value, options = {}) {
  const text = safeText(value);
  if (!text || text === "-") return null;
  if (!options.allowPercent && isPercentText(text)) return null;
  const normalized = normalizeNumericText(text, { allowPercent: options.allowPercent === true });
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function formatRevenueNumber(value, options = {}) {
  const precision = Number.isInteger(options.precision) ? options.precision : 2;
  const num = typeof value === "number" ? value : parseRevenueNumber(value, { allowPercent: true });
  if (!Number.isFinite(num)) return "-";
  if (Math.abs(num - Math.round(num)) < 1e-9) return String(Math.round(num));
  const base = Math.pow(10, precision);
  return String(Math.round(num * base) / base);
}

export function formatRevenueRawNumber(value) {
  const num = typeof value === "number" ? value : parseRevenueNumber(value, { allowPercent: true });
  if (!Number.isFinite(num)) return null;
  if (Object.is(num, -0)) return "0";
  if (Math.abs(num - Math.round(num)) < 1e-12) return String(Math.round(num));
  return String(Number(num.toPrecision(15)));
}

export function getRevenueUnitScale(unit) {
  const normalizedUnit = normalizeUnitText(unit);
  const storagePerDisplay = getStoragePerDisplayUnit(normalizedUnit);
  return {
    unit: normalizedUnit,
    type: getRevenueUnitType(normalizedUnit),
    storagePerDisplay,
    displayPerStorage: storagePerDisplay === 0 ? 1 : 1 / storagePerDisplay,
    suffix: isPercentUnit(normalizedUnit) ? "%" : "",
    scaled: storagePerDisplay !== 1,
  };
}

export function toStorageValue(displayValue, unit, options = {}) {
  const rawDisplayValue = safeText(displayValue);
  if (!rawDisplayValue || rawDisplayValue === "-") {
    return {
      ok: true,
      value: "",
      storageValue: "",
      displayValue: "",
      numberValue: undefined,
      valueType: REVENUE_VALUE_TYPE.TEXT,
    };
  }
  const scale = getRevenueUnitScale(unit);
  const numericSource = isPercentUnit(unit) ? stripAllPercent(rawDisplayValue) : rawDisplayValue;
  const numericText = normalizeNumericText(numericSource);
  if (!isPlainNumericText(numericText)) {
    if (!scale.scaled) {
      return {
        ok: true,
        value: rawDisplayValue,
        storageValue: rawDisplayValue,
        displayValue: rawDisplayValue,
        numberValue: undefined,
        valueType: REVENUE_VALUE_TYPE.TEXT,
      };
    }
    return {
      ok: false,
      value: rawDisplayValue,
      storageValue: rawDisplayValue,
      displayValue: rawDisplayValue,
      message: options.invalidMessage || "请输入有效数字",
      valueType: REVENUE_VALUE_TYPE.TEXT,
    };
  }
  const displayNumber = Number(numericText);
  const storageNumber = displayNumber * scale.storagePerDisplay;
  const storageValue = formatRevenueRawNumber(storageNumber);
  return {
    ok: true,
    value: storageValue,
    storageValue,
    displayValue: toDisplayValue(storageValue, unit, options),
    numberValue: storageNumber,
    valueType: REVENUE_VALUE_TYPE.NUMBER,
  };
}

export function toDisplayValue(storageValue, unit, options = {}) {
  const text = safeText(storageValue);
  if (!text || text === "-") return options.blankAsDash === true ? "-" : "";
  const num = parseRevenueNumber(text);
  if (num === null) return text;
  const scale = getRevenueUnitScale(unit);
  const displayNumber = num * scale.displayPerStorage;
  const formatted = options.raw === true
    ? formatRevenueRawNumber(displayNumber)
    : formatRevenueNumber(displayNumber, options);
  if (formatted == null || formatted === "-") return text;
  return scale.suffix ? `${formatted}${scale.suffix}` : formatted;
}

export function formatRevenueDisplayValue(value, row = {}, options = {}) {
  return toDisplayValue(value, row && row.unit, {
    blankAsDash: true,
    ...options,
  });
}

export function formatFormulaValueForDisplay(value, row = {}, options = {}) {
  return toDisplayValue(value, row && row.unit, {
    raw: true,
    ...options,
  });
}

export function formatFormulaValueForStorage(value) {
  const text = safeText(value);
  if (!text) return "";
  const num = toFiniteNumber(text, { allowPercent: true });
  if (num === null) return text;
  return formatRevenueRawNumber(num) || "";
}

export function buildStoragePayload(displayValue, row = {}) {
  const normalized = toStorageValue(displayValue, row && row.unit);
  if (!normalized.ok) return buildTextPayload(displayValue);
  if (normalized.valueType === REVENUE_VALUE_TYPE.NUMBER) {
    return buildNumberPayload(normalized.numberValue);
  }
  return buildTextPayload(normalized.storageValue);
}

export function normalizeEditableValue(value, row = {}) {
  return toStorageValue(value, row && row.unit);
}

export function validateEditableValue(row = {}, value = "", options = {}) {
  const normalized = normalizeEditableValue(value, row);
  const rawInput = safeText(value);
  if (!rawInput) return { ok: true, value: "", storageValue: "", numberValue: undefined };
  const numericSource = isPercentUnit(row && row.unit) ? stripAllPercent(rawInput) : rawInput;
  const numericText = normalizeNumericText(numericSource);
  if (isScaledUnit(row && row.unit) && !isPlainNumericText(numericText)) {
    return {
      ok: false,
      message: options.invalidMessage || "请输入有效数字",
    };
  }
  if (!normalized.ok) return normalized;
  if (normalized.valueType !== REVENUE_VALUE_TYPE.NUMBER) {
    return {
      ok: true,
      value: normalized.storageValue,
      storageValue: normalized.storageValue,
      numberValue: undefined,
    };
  }
  const numberValue = Number(normalized.storageValue);
  const min = options.min != null ? Number(options.min) : Number.NEGATIVE_INFINITY;
  const max = options.max != null ? Number(options.max) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    return {
      ok: false,
      message: options.rangeMessage || "数值超出允许范围",
    };
  }
  return {
    ok: true,
    value: normalized.storageValue,
    storageValue: normalized.storageValue,
    numberValue,
  };
}

export function readRecordStorageValue(record = {}) {
  if (!record || typeof record !== "object") return "";
  const valueType = safeText(record.valueType).toUpperCase();
  const textValue = safeText(record.textValue);
  if (valueType === REVENUE_VALUE_TYPE.TEXT && textValue) return textValue;
  if (record.numberValue != null && String(record.numberValue).trim() !== "") {
    return String(record.numberValue);
  }
  const rawValue = safeText(record.rawValue);
  if (rawValue) return rawValue;
  return textValue;
}

export function buildRevenueValuePayload(value, row = {}, options = {}) {
  if (options.fromDisplay === true || (isPercentUnit(row && row.unit) && hasPercentToken(value))) {
    return buildStoragePayload(value, row);
  }
  const rawValue = safeText(value);
  const numericText = normalizeNumericText(rawValue);
  const canBeNumber = rawValue !== "" && isPlainNumericText(numericText);
  if (canBeNumber) {
    return buildNumberPayload(Number(numericText));
  }
  return buildTextPayload(rawValue);
}

export function normalizeExcelCellForRevenue(cellMeta, row = {}) {
  if (!cellMeta || cellMeta.isBlank || cellMeta.isError) return null;
  const displayText = safeText(cellMeta.displayText);
  const rawValue = safeText(cellMeta.rawValue);
  const numericValue = cellMeta.numericValue != null && Number.isFinite(Number(cellMeta.numericValue))
    ? Number(cellMeta.numericValue)
    : null;

  if (isPercentUnit(row && row.unit)) {
    const displaySource = displayText || rawValue;
    const numberFormat = safeText(cellMeta.numberFormat || cellMeta.format || cellMeta.z);
    const hasPercentFormat = hasPercentToken(numberFormat);
    let storageNumber = null;
    if (numericValue !== null) {
      if (hasPercentFormat) {
        storageNumber = numericValue;
      } else if (hasPercentToken(displaySource)) {
        const normalized = toStorageValue(displaySource, row && row.unit);
        storageNumber = normalized.ok ? normalized.numberValue : null;
      } else {
        storageNumber = Math.abs(numericValue) <= 1 ? numericValue : numericValue / 100;
      }
      if (storageNumber === null || !Number.isFinite(storageNumber)) {
        storageNumber = Math.abs(numericValue) <= 1 ? numericValue : numericValue / 100;
      }
    } else if (hasPercentToken(displaySource)) {
      const normalized = toStorageValue(displaySource, row && row.unit);
      storageNumber = normalized.ok ? normalized.numberValue : null;
    } else if (isPlainNumericText(normalizeNumericText(displaySource))) {
      const displayNumber = Number(normalizeNumericText(displaySource));
      storageNumber = Math.abs(displayNumber) <= 1 ? displayNumber : displayNumber / 100;
    }

    if (storageNumber !== null && Number.isFinite(storageNumber)) {
      const storageValue = formatRevenueRawNumber(storageNumber);
      const displayValue = toDisplayValue(storageValue, row && row.unit, { raw: true });
      return {
        valueType: REVENUE_VALUE_TYPE.NUMBER,
        numberValue: storageNumber,
        textValue: undefined,
        rawValue: storageValue,
        storageValue,
        displayValue,
        sourceDisplayValue: displayText,
        sourceRawValue: rawValue,
      };
    }
  }

  if (numericValue !== null) {
    const numericFallback = toStorageValue(String(numericValue), row && row.unit);
    const storageNumber = numericFallback.ok && numericFallback.valueType === REVENUE_VALUE_TYPE.NUMBER
      ? numericFallback.numberValue
      : numericValue;
    const storageValue = formatRevenueRawNumber(storageNumber);
    return {
      valueType: REVENUE_VALUE_TYPE.NUMBER,
      numberValue: storageNumber,
      textValue: undefined,
      rawValue: storageValue,
      storageValue,
      displayValue: toDisplayValue(storageValue, row && row.unit, { raw: true }) || displayText || String(numericValue),
      sourceDisplayValue: displayText,
      sourceRawValue: rawValue,
    };
  }

  const normalizedRaw = displayText || rawValue;
  if (!normalizedRaw) return null;
  const numericText = normalizeNumericText(normalizedRaw);
  if (!isPercentText(normalizedRaw) && isPlainNumericText(numericText)) {
    const normalized = toStorageValue(normalizedRaw, row && row.unit);
    const storageValue = normalized.ok && normalized.storageValue != null
      ? normalized.storageValue
      : numericText;
    const numberValue = Number(storageValue);
    return {
      valueType: REVENUE_VALUE_TYPE.NUMBER,
      numberValue,
      textValue: undefined,
      rawValue: storageValue,
      storageValue,
      displayValue: toDisplayValue(storageValue, row && row.unit, { raw: true }) || normalizedRaw,
      sourceDisplayValue: displayText,
      sourceRawValue: rawValue,
    };
  }
  return {
    valueType: REVENUE_VALUE_TYPE.TEXT,
    numberValue: undefined,
    textValue: normalizedRaw,
    rawValue: normalizedRaw,
    storageValue: normalizedRaw,
    displayValue: normalizedRaw,
    sourceDisplayValue: displayText,
    sourceRawValue: rawValue,
  };
}

export function buildRevenueCellMeta(cell, address) {
  const displayText = cell && cell.w != null && cell.w !== ""
    ? stripLineBreaks(cell.w)
    : cell && cell.v != null
      ? stripLineBreaks(cell.v)
      : "";
  const rawValue = cell && cell.v != null ? stripLineBreaks(cell.v) : displayText;
  const numericValue =
    cell && typeof cell.v === "number" && Number.isFinite(cell.v) ? Number(cell.v) : null;
  return {
    address,
    displayText,
    rawValue,
    formula: cell && cell.f ? String(cell.f) : "",
    numberFormat: cell && cell.z ? String(cell.z) : "",
    numericValue,
    isBlank: !displayText && !rawValue,
    isError: Boolean(cell && cell.t === "e"),
  };
}
