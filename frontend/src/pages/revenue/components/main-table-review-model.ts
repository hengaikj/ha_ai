import { safeText } from "@/utils/revenue-helpers";

// ============================================================
// Types
// ============================================================

export interface ReviewYearOption {
  label: string;
  value: number;
  lifecycle: boolean;
}

export interface DetailColumnDef {
  yearIndex: number;
  trimIndex: number;
  yearLabel: string;
  trimLabel: string;
  isLifecycle: boolean;
  columnKey: string;
}

export interface DetailHeaderGroup {
  key: string;
  label: string;
  yearIndex: number;
  colspan: number;
}

export interface BuildMainTableOptions {
  safeText?: (value: unknown, fallback?: string) => string;
  normalizeYearMatchKey?: (value: unknown) => string;
  trimIndexes?: number[];
}

export interface DimensionsInput {
  years?: string[];
  trims?: string[];
}

// ============================================================
// Internal helpers
// ============================================================

function defaultNormalizeYear(value: unknown): string {
  const text = safeText(value);
  if (text.includes("全生命周期") || text.includes("合计")) return "lifecycle";
  return text.replace(/年/g, "").replace(/\s+/g, "");
}

function getModelYears(dimensions: DimensionsInput = {}): string[] {
  return Array.isArray(dimensions.years) ? dimensions.years : [];
}

function getModelTrims(dimensions: DimensionsInput = {}): string[] {
  return Array.isArray(dimensions.trims) ? dimensions.trims : [];
}

function resolveSafeText(options: BuildMainTableOptions = {}): (value: unknown, fallback?: string) => string {
  return typeof options.safeText === "function" ? options.safeText : safeText;
}

function resolveNormalizeYear(options: BuildMainTableOptions = {}): (value: unknown) => string {
  return typeof options.normalizeYearMatchKey === "function"
    ? options.normalizeYearMatchKey
    : defaultNormalizeYear;
}

// ============================================================
// Public API - 年份选项
// ============================================================

export function buildMainTableReviewYearOptions(
  dimensions: DimensionsInput = {},
  options: BuildMainTableOptions = {}
): ReviewYearOption[] {
  const _safeText = resolveSafeText(options);
  const normalizeYearMatchKey = resolveNormalizeYear(options);
  return getModelYears(dimensions)
    .map((year, index) => {
      const label = _safeText(year);
      if (!label) return null;
      return {
        label,
        value: index,
        lifecycle: normalizeYearMatchKey(label) === "lifecycle",
      };
    })
    .filter((item): item is ReviewYearOption => item !== null);
}

export function buildMainTableDefaultYearIndexes(reviewYearOptions: ReviewYearOption[] = []): number[] {
  const indexes = (Array.isArray(reviewYearOptions) ? reviewYearOptions : [])
    .map((item) => Number(item && item.value))
    .filter((item) => Number.isInteger(item));
  return indexes.length ? indexes : [0];
}

export function buildMainTableLegacyDefaultYearIndexes(reviewYearOptions: ReviewYearOption[] = []): number[] {
  const opts = Array.isArray(reviewYearOptions) ? reviewYearOptions : [];
  const indexes: number[] = [];
  const firstRealYear = opts.find((item) => item && !item.lifecycle);
  const lifecycleYear = opts.find((item) => item && item.lifecycle);
  [firstRealYear, lifecycleYear].forEach((item) => {
    const value = Number(item && item.value);
    if (Number.isInteger(value) && !indexes.includes(value)) indexes.push(value);
  });
  if (!indexes.length && opts.length) {
    const firstValue = Number(opts[0] && opts[0].value);
    if (Number.isInteger(firstValue)) indexes.push(firstValue);
  }
  return indexes.length ? indexes : [0];
}

export function buildMainTableSelectedYearIndexes(
  activeYears: number[] = [],
  defaultYearIndexes: number[] = []
): number[] {
  const allowed = (Array.isArray(defaultYearIndexes) ? defaultYearIndexes : [])
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));
  const allowedIndexes = allowed.length ? allowed : [0];
  const allowedMap: Record<number, boolean> = {};
  for (const item of allowedIndexes) {
    allowedMap[item] = true;
  }
  const seen: Record<number, boolean> = {};
  const result = (Array.isArray(activeYears) ? activeYears : [])
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && allowedMap[item])
    .filter((item) => {
      if (seen[item]) return false;
      seen[item] = true;
      return true;
    })
    .sort((a, b) => allowedIndexes.indexOf(a) - allowedIndexes.indexOf(b));
  return result.length ? result : [...allowedIndexes];
}

export function buildMainTableNormalizedSelectedYearIndexes(
  activeYears: number[] = [],
  reviewYearOptions: ReviewYearOption[] = [],
  options: BuildMainTableOptions & { expandLegacyDefault?: boolean } = {}
): number[] {
  const defaultYearIndexes = buildMainTableDefaultYearIndexes(reviewYearOptions);
  const selectedYearIndexes = buildMainTableSelectedYearIndexes(activeYears, defaultYearIndexes);
  const sourceYearIndexes = (Array.isArray(activeYears) ? activeYears : [])
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));
  const legacyYearIndexes = buildMainTableLegacyDefaultYearIndexes(reviewYearOptions);
  const shouldExpandLegacyDefault =
    options.expandLegacyDefault !== false &&
    defaultYearIndexes.length > legacyYearIndexes.length &&
    sourceYearIndexes.length === legacyYearIndexes.length &&
    legacyYearIndexes.every((item) => sourceYearIndexes.includes(item));
  return shouldExpandLegacyDefault ? [...defaultYearIndexes] : selectedYearIndexes;
}

// ============================================================
// Public API - 列定义
// ============================================================

export function buildMainTableDetailTrimIndexes(dimensions: DimensionsInput = {}): number[] {
  const trims = getModelTrims(dimensions);
  if (!trims.length) return [0];
  return trims.map((_, index) => index);
}

export function buildMainTableDetailColumnDefs(
  dimensions: DimensionsInput = {},
  options: BuildMainTableOptions = {}
): DetailColumnDef[] {
  const _safeText = resolveSafeText(options);
  const normalizeYearMatchKey = resolveNormalizeYear(options);
  const years = getModelYears(dimensions);
  const trims = getModelTrims(dimensions);
  const trimIndexes = Array.isArray(options.trimIndexes)
    ? options.trimIndexes
    : buildMainTableDetailTrimIndexes(dimensions);
  const columns: DetailColumnDef[] = [];

  const appendYearColumns = (year: string, yearIndex: number, isLifecycle: boolean) => {
    const yearLabel = _safeText(year, "-");
    trimIndexes.forEach((trimIndex) => {
      columns.push({
        yearIndex,
        trimIndex,
        yearLabel,
        trimLabel: _safeText(trims[trimIndex], "-"),
        isLifecycle,
        columnKey: isLifecycle
          ? `${yearIndex}_${trimIndex}_lifecycle`
          : `${yearIndex}_${trimIndex}`,
      });
    });
  };

  const lifecycleYearIndex = years.findIndex(
    (year) => normalizeYearMatchKey(_safeText(year, "-")) === "lifecycle"
  );

  years.forEach((year, yearIndex) => {
    if (yearIndex === lifecycleYearIndex) return;
    appendYearColumns(year, yearIndex, false);
  });

  if (lifecycleYearIndex >= 0) {
    appendYearColumns(years[lifecycleYearIndex], lifecycleYearIndex, true);
  }

  return columns;
}

export function buildMainTableDetailHeaderGroups(
  detailColumnDefs: DetailColumnDef[] = []
): DetailHeaderGroup[] {
  const groups: DetailHeaderGroup[] = [];
  (Array.isArray(detailColumnDefs) ? detailColumnDefs : []).forEach((column) => {
    const last = groups[groups.length - 1];
    if (last && last.yearIndex === column.yearIndex) {
      last.colspan += 1;
      return;
    }
    groups.push({
      key: column.isLifecycle ? `${column.yearIndex}_lifecycle` : String(column.yearIndex),
      label: column.yearLabel,
      yearIndex: column.yearIndex,
      colspan: 1,
    });
  });
  return groups;
}
