function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

export function parseAggregateNumber(value) {
  const text = safeText(value);
  if (!text || text === "-") return null;
  const normalized = text.replace(/,/g, "").replace(/[%％]$/, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function parseAggregateRatio(value) {
  const text = safeText(value);
  const num = parseAggregateNumber(text);
  if (num === null) return null;
  if (/[%％]$/.test(text)) return num / 100;
  return num;
}

export function isWeightedAggregateFormula(formula) {
  const text = safeText(formula).toLowerCase();
  return text === "weighted" || text === "weighted_by_mix";
}

export function isRatioAggregateFormula(formula) {
  return safeText(formula).toLowerCase() === "ratio";
}

export function getAggregateFormulaLabel(formula) {
  const text = safeText(formula).toLowerCase();
  if (isWeightedAggregateFormula(text) || text === "volume_weighted") return "加权";
  if (text === "avg" || text === "average") return "平均";
  if (isRatioAggregateFormula(text)) return "比率";
  if (text === "mix") return "MIX";
  if (text === "max") return "最大";
  if (text === "min") return "最小";
  if (text === "count" || text === "count_non_empty") return "计数";
  if (text === "sum" || text === "sum_year") return "求和";
  return "";
}

export function weightedSumByRatios(values = [], ratios = []) {
  let total = 0;
  let hasValue = false;
  (Array.isArray(values) ? values : []).forEach((value, index) => {
    const num = parseAggregateNumber(value);
    const ratio = parseAggregateRatio((Array.isArray(ratios) ? ratios : [])[index]);
    if (num === null || ratio === null) return;
    total += num * ratio;
    hasValue = true;
  });
  return hasValue ? total : null;
}

export function aggregateRatio(numeratorValue, denominatorValue) {
  const numerator = parseAggregateNumber(numeratorValue);
  const denominator = parseAggregateNumber(denominatorValue);
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

export function aggregateNumbers(values = [], formula = "sum", options = {}) {
  const normalized = safeText(formula, "sum").toLowerCase();
  if (isRatioAggregateFormula(normalized)) {
    return aggregateRatio(options.numerator, options.denominator);
  }

  const source = (Array.isArray(values) ? values : [])
    .map((value) => parseAggregateNumber(value))
    .filter((num) => num !== null);
  if (!source.length) return null;

  if (isWeightedAggregateFormula(normalized)) {
    return weightedSumByRatios(values, options.weights || options.ratios || []);
  }
  if (normalized === "avg" || normalized === "average") {
    return source.reduce((sum, num) => sum + num, 0) / source.length;
  }
  if (normalized === "max") return Math.max(...source);
  if (normalized === "min") return Math.min(...source);
  return source.reduce((sum, num) => sum + num, 0);
}
