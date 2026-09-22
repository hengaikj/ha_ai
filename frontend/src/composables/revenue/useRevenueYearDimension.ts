/**
 * 收益填报页·年份维度管理 composable
 *
 * 负责年份增删改重命名、本地存储同步、维度 key 迁移。
 * 原 mixin: year-dimension.mixin.js
 */
import { ElMessage } from "element-plus";
import type {
  RevenueFillState,
  TrimOption,
  MatrixColumn,
} from "@/types/revenue";
import { normalizeTrimOptions } from "@/pages/revenue/subtable-workbench/services/detail-matrix";
import {
  buildDisplayYearOptions,
  LIFECYCLE_YEAR_LABEL,
} from "@/pages/revenue/subtable-workbench/matrix-utils";

export function useRevenueYearDimension(state: RevenueFillState) {
  // ============================================================
  // 年份标签处理
  // ============================================================

  function normalizeYearLabelInput(value: unknown): string {
    const text = String(value == null ? "" : value).replace(/\s+/g, "").trim();
    const match = /^(\d{4})年?$/.exec(text);
    if (!match) return "";
    return match[1];
  }

  function getYearStorageKey(): string {
    const projectId = String(state.queryProjectId || "").trim() || "unknown";
    const flowId = String(state.activeFlowId || state.queryFlowId || "").trim() || "unknown";
    const valve = String(state.queryValve || "").trim() || "unknown";
    return ["revenue-subtable-fill-years", projectId, flowId, valve].join(":");
  }

  function normalizeYearList(years: unknown): string[] {
    const seen: Record<string, boolean> = {};
    return (Array.isArray(years) ? years : [])
      .map((item) => normalizeYearLabelInput(item))
      .filter((year) => {
        if (!year || seen[year]) return false;
        seen[year] = true;
        return true;
      });
  }

  function readStoredYearState(): { years: string[]; deletedYears: string[] } {
    try {
      const raw = window.localStorage.getItem(getYearStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        return {
          years: normalizeYearList(parsed),
          deletedYears: [],
        };
      }
      if (parsed && typeof parsed === "object") {
        return {
          years: normalizeYearList(parsed.years || parsed.extraYears || []),
          deletedYears: normalizeYearList(parsed.deletedYears || []),
        };
      }
    } catch {
      // Ignore invalid local persistence.
    }
    return { years: [], deletedYears: [] };
  }

  function readStoredYears(): string[] {
    return readStoredYearState().years;
  }

  function readDeletedStoredYears(): string[] {
    return readStoredYearState().deletedYears;
  }

  function writeStoredYears(years: unknown, deletedYears?: unknown): void {
    try {
      const normalized = normalizeYearList(years);
      const normalizedDeleted = normalizeYearList(
        deletedYears == null ? readDeletedStoredYears() : deletedYears,
      );
      window.localStorage.setItem(
        getYearStorageKey(),
        JSON.stringify({
          years: normalized,
          deletedYears: normalizedDeleted,
        }),
      );
    } catch {
      // Ignore local persistence failures.
    }
  }

  // ============================================================
  // 维度初始化
  // ============================================================

  function ensureDetailDimensions(): void {
    const detail = state.detail as Record<string, unknown>;
    if (!detail.dimensions || typeof detail.dimensions !== "object") {
      detail.dimensions = { years: [], trims: [] };
    }
    const dims = detail.dimensions as Record<string, unknown>;
    if (!Array.isArray(dims.years)) {
      dims.years = [];
    }
    if (!Array.isArray(dims.trims)) {
      dims.trims = [];
    }
    if (!detail.yearTrimConfig || typeof detail.yearTrimConfig !== "object") {
      detail.yearTrimConfig = {};
    }
  }

  /**
   * 从 detail 解析有效版型列表（优先 detail.trimOptions，避免顶层 state 未同步时为空）
   */
  function resolveEffectiveTrimOptions(): TrimOption[] {
    ensureDetailDimensions();
    const detail = state.detail as Record<string, unknown>;
    const dims = detail.dimensions as { years?: string[]; trims?: string[] };
    const fromDetail = normalizeTrimOptions(
      detail.trimOptions,
      Array.isArray(dims.trims) ? dims.trims : [],
    ) as TrimOption[];
    if (fromDetail.length) return fromDetail;
    if (Array.isArray(state.trimOptions) && state.trimOptions.length) {
      return state.trimOptions.slice();
    }
    return [];
  }

  /**
   * 将 detail 中的年份/版型同步到顶层 state，供列生成与 composable 共用
   */
  function syncTopLevelDimensionStateFromDetail(): void {
    ensureDetailDimensions();
    const detail = state.detail as Record<string, unknown>;
    const dims = detail.dimensions as { years: string[]; trims: string[] };
    state.dimensions = {
      years: Array.isArray(dims.years) ? dims.years.slice() : [],
      trims: Array.isArray(dims.trims) ? dims.trims.slice() : [],
    };
    const nextTrimOptions = resolveEffectiveTrimOptions();
    state.trimOptions = nextTrimOptions;
    // 回写规范化后的版型，保证工具栏与表格同源
    if (!Array.isArray(detail.trimOptions) || !(detail.trimOptions as unknown[]).length) {
      detail.trimOptions = nextTrimOptions.slice();
    }

    const displayOptions = buildDisplayYearOptions(state.dimensions.years || []);
    state.displayYearOptions = displayOptions as RevenueFillState["displayYearOptions"];

    const options = Array.isArray(state.displayYearOptions) ? state.displayYearOptions : [];
    const key = String(state.activeYearKey || "").trim();
    const matched =
      options.find((item) => String(item.key || "").trim() === key) ||
      options.find((item) => item.yearIndex === state.activeYearIndex) ||
      options[0] ||
      null;
    if (matched && (matched as { lifecycle?: boolean }).lifecycle) {
      state.activeYearLabel = LIFECYCLE_YEAR_LABEL;
      state.activeRealYearIndex = -1;
    } else if (matched && Number.isInteger(matched.yearIndex)) {
      state.activeYearIndex = matched.yearIndex;
      state.activeRealYearIndex = matched.yearIndex;
      state.activeYearLabel = String(
        state.dimensions.years[matched.yearIndex] ||
          (matched as { label?: string }).label ||
          "",
      );
    } else {
      const years = state.dimensions.years || [];
      const index = Math.min(Math.max(state.activeYearIndex, 0), Math.max(years.length - 1, 0));
      state.activeYearLabel = years[index] || "";
      state.activeRealYearIndex = years.length ? index : 0;
    }
  }

  function mergeStoredYearsIntoDetail(): void {
    ensureDetailDimensions();
    const detail = state.detail as Record<string, unknown>;
    const dims = detail.dimensions as Record<string, string[]>;
    const currentYears = dims.years || [];
    const deletedMap: Record<string, boolean> = {};
    readDeletedStoredYears().forEach((year) => {
      deletedMap[year] = true;
    });
    const merged = normalizeYearList(currentYears.concat(readStoredYears())).filter(
      (year) => !deletedMap[year],
    );
    if (merged.length) {
      dims.years = merged;
    }
    // 先同步顶层版型，再写 yearTrimConfig，避免用空 trimOptions 把配置刷空
    syncTopLevelDimensionStateFromDetail();
    ensureYearTrimConfigForYears();
  }

  function ensureYearTrimConfigForYears(): void {
    ensureDetailDimensions();
    const detail = state.detail as Record<string, unknown>;
    const dims = detail.dimensions as Record<string, string[]>;
    const trimIds = resolveEffectiveTrimOptions().map((item) => item.trimId);
    const yearTrimConfig = detail.yearTrimConfig as Record<string, string[]>;
    (dims.years || []).forEach((year) => {
      const yearKey = String(year || "").trim();
      if (!yearKey) return;
      const configured = Array.isArray(yearTrimConfig[yearKey])
        ? yearTrimConfig[yearKey]
        : [];
      const selected = configured.filter((trimId) => trimIds.includes(trimId));
      yearTrimConfig[yearKey] = selected.length ? selected : trimIds.slice();
    });
  }

  // ============================================================
  // 年份编辑器
  // ============================================================

  function suggestNextYearLabel(): string {
    const detail = state.detail as Record<string, unknown>;
    const dims = detail.dimensions as Record<string, string[]>;
    const years = normalizeYearList(dims.years || []);
    const sortedYears = years.slice().sort((a, b) => Number(a) - Number(b));
    const lastYear = sortedYears.length
      ? Number(sortedYears[sortedYears.length - 1])
      : new Date().getFullYear() - 1;
    return String(lastYear + 1);
  }

  function openYearEditor(mode: string): void {
    state.yearEditorMode = mode === "rename" ? "rename" : "add";
    state.yearEditorValue =
      state.yearEditorMode === "rename"
        ? String(state.activeYearLabel || "")
        : suggestNextYearLabel();
    state.yearEditorVisible = true;
  }

  // ============================================================
  // 年份操作（需要外部注入 applyFormulas 回调）
  // ============================================================

  interface YearOpsOptions {
    applyFormulas: () => void;
  }

  function confirmYearEditor(options: YearOpsOptions): void {
    const nextYear = normalizeYearLabelInput(state.yearEditorValue);
    if (!nextYear) {
      ElMessage.warning("请输入四位年份，例如 2029");
      return;
    }
    if (state.yearEditorMode === "rename") {
      renameActiveYear(nextYear, options);
    } else {
      addYear(nextYear, options);
    }
  }

  function addYear(yearLabel: string, options: YearOpsOptions): void {
    ensureDetailDimensions();
    const detail = state.detail as Record<string, unknown>;
    const dims = detail.dimensions as Record<string, string[]>;
    const years = normalizeYearList(dims.years || []);
    if (years.includes(yearLabel)) {
      ElMessage.warning(`年份已存在：${yearLabel}`);
      return;
    }
    const nextYears = normalizeYearList(years.concat(yearLabel));
    dims.years = nextYears;
    ensureYearTrimConfigForYears();
    state.localYearTrimConfig = buildLocalYearTrimConfig();
    state.activeYearIndex = nextYears.indexOf(yearLabel);
    state.activeYearKey = yearLabel;
    syncTopLevelDimensionStateFromDetail();
    state.yearEditorVisible = false;
    writeStoredYears(
      nextYears,
      readDeletedStoredYears().filter((year) => year !== yearLabel),
    );
    options.applyFormulas();
  }

  function renameActiveYear(yearLabel: string, options: YearOpsOptions): void {
    ensureDetailDimensions();
    const detail = state.detail as Record<string, unknown>;
    const dims = detail.dimensions as Record<string, string[]>;
    const years = (dims.years || []).slice();
    const oldYear = String(years[state.activeRealYearIndex] || "").trim();
    if (!oldYear) {
      ElMessage.warning("请选择要重命名的年份");
      return;
    }
    if (oldYear === yearLabel) {
      state.yearEditorVisible = false;
      return;
    }
    const activeIndex = state.activeRealYearIndex;
    if (years.some((year, index) => index !== activeIndex && String(year) === yearLabel)) {
      ElMessage.warning(`年份已存在：${yearLabel}`);
      return;
    }
    years[activeIndex] = yearLabel;
    const nextYears = normalizeYearList(years);
    moveYearDimensionKeys(oldYear, yearLabel);
    dims.years = nextYears;
    const yearTrimConfig = detail.yearTrimConfig as Record<string, string[]>;
    if (yearTrimConfig && yearTrimConfig[oldYear]) {
      yearTrimConfig[yearLabel] = yearTrimConfig[oldYear];
      delete yearTrimConfig[oldYear];
    }
    ensureYearTrimConfigForYears();
    state.localYearTrimConfig = buildLocalYearTrimConfig();
    state.activeYearIndex = nextYears.indexOf(yearLabel);
    state.activeYearKey = yearLabel;
    syncTopLevelDimensionStateFromDetail();
    state.yearEditorVisible = false;
    writeStoredYears(
      nextYears,
      normalizeYearList(readDeletedStoredYears().concat(oldYear)).filter(
        (year) => year !== yearLabel,
      ),
    );
    options.applyFormulas();
  }

  function deleteActiveYear(options: YearOpsOptions): boolean {
    ensureDetailDimensions();
    const detail = state.detail as Record<string, unknown>;
    const dims = detail.dimensions as Record<string, string[]>;
    const years = normalizeYearList(dims.years || []);
    if (years.length <= 1) {
      ElMessage.warning("至少保留一个年份");
      return false;
    }
    const deletedYearIndex = state.activeRealYearIndex;
    const yearLabel = String(years[deletedYearIndex] || "").trim();
    if (!yearLabel) {
      ElMessage.warning("请选择要删除的年份");
      return false;
    }

    removeYearDimensionKeys(yearLabel, deletedYearIndex);
    const nextYears = years.filter((_year, index) => index !== deletedYearIndex);
    dims.years = nextYears;
    const yearTrimConfig = detail.yearTrimConfig as Record<string, string[]>;
    if (yearTrimConfig && yearTrimConfig[yearLabel]) {
      delete yearTrimConfig[yearLabel];
    }
    if (state.localYearTrimConfig && state.localYearTrimConfig[yearLabel]) {
      delete state.localYearTrimConfig[yearLabel];
    }
    ensureYearTrimConfigForYears();
    state.localYearTrimConfig = buildLocalYearTrimConfig();
    const nextIndex = Math.min(deletedYearIndex, Math.max(nextYears.length - 1, 0));
    state.activeYearIndex = nextIndex;
    state.activeYearKey = nextYears[nextIndex] || "";
    syncTopLevelDimensionStateFromDetail();
    writeStoredYears(
      nextYears,
      normalizeYearList(readDeletedStoredYears().concat(yearLabel)),
    );
    options.applyFormulas();
    return true;
  }

  // ============================================================
  // 维度 key 迁移
  // ============================================================

  function moveYearDimensionKeys(oldYear: string, nextYear: string): void {
    const detail = state.detail as Record<string, unknown>;
    const rows = Array.isArray(detail.rows) ? detail.rows : [];
    rows.forEach((row) => {
      const r = row as Record<string, unknown>;
      moveYearKeysInMap(r.cellMap as Record<string, unknown> | undefined, oldYear, nextYear);
      moveYearKeysInMap(r.cellsByDimension as Record<string, unknown> | undefined, oldYear, nextYear);
      moveYearKeysInMap(r.dimensionCells as Record<string, unknown> | undefined, oldYear, nextYear);
      moveYearKeysInMap(r.cellRecordMap as Record<string, unknown> | undefined, oldYear, nextYear);
      moveYearKeysInMap(r.recordMap as Record<string, unknown> | undefined, oldYear, nextYear);
    });
  }

  function moveYearKeysInMap(
    map: Record<string, unknown> | undefined,
    oldYear: string,
    nextYear: string,
  ): void {
    if (!map || typeof map !== "object") return;
    Object.keys(map).forEach((key) => {
      if (!key.startsWith(`${oldYear}__`)) return;
      const nextKey = `${nextYear}__${key.slice(String(oldYear).length + 2)}`;
      map[nextKey] = map[key];
      delete map[key];
    });
  }

  function removeYearDimensionKeys(yearLabel: string, deletedYearIndex: number): void {
    const detail = state.detail as Record<string, unknown>;
    const rows = Array.isArray(detail.rows) ? detail.rows : [];

    rows.forEach((row) => {
      const r = row as Record<string, unknown>;
      const maps = [
        "cells", "cellMap", "cellsByDimension", "dimensionCells",
        "cellRecordMap", "recordMap", "cellTargetMap", "targetMap",
        "formulaLockedCellMap", "reviewLockedCellMap", "lockedCellMap",
        "s3CandidateMap",
      ];
      maps.forEach((mapName) => {
        removeYearKeysInMap(r[mapName] as Record<string, unknown> | undefined, yearLabel, deletedYearIndex);
      });
    });

    // 清理草稿中的相关 key
    Object.keys(state.cellInputDrafts || {}).forEach((key) => {
      if (key.includes(`__${yearLabel}__`)) {
        delete state.cellInputDrafts[key];
      }
    });
    Object.keys(state.cellInputOriginals || {}).forEach((key) => {
      if (key.includes(`__${yearLabel}__`)) {
        delete state.cellInputOriginals[key];
      }
    });
    [
      state.dataImportCompareByCell,
      state.dataImportFormulaOverwriteByCell,
      state.dataImportOverwriteSavingByCell,
    ].forEach((map) => {
      if (!map || typeof map !== "object") return;
      Object.keys(map).forEach((key) => {
        if (key.includes(`__${yearLabel}__`)) {
          delete map[key];
        }
      });
    });
  }

  function removeYearKeysInMap(
    map: Record<string, unknown> | undefined,
    yearLabel: string,
    deletedYearIndex: number,
  ): void {
    if (!map || typeof map !== "object") return;
    Object.keys(map).forEach((key) => {
      if (key.startsWith(`${yearLabel}__`)) {
        delete map[key];
        return;
      }
      const match = /^y(\d+)_t(.+)$/.exec(key);
      if (!match) return;
      const yearIndex = Number(match[1]);
      if (yearIndex === deletedYearIndex) {
        delete map[key];
        return;
      }
      if (yearIndex > deletedYearIndex) {
        const nextKey = `y${yearIndex - 1}_t${match[2]}`;
        map[nextKey] = map[key];
        delete map[key];
      }
    });
  }

  // ============================================================
  // 列构建
  // ============================================================

  function buildLocalYearTrimConfig(): Record<string, string[]> {
    const detail = state.detail as Record<string, unknown>;
    const yearTrimConfig = detail.yearTrimConfig as Record<string, string[]> | undefined;
    if (yearTrimConfig) return { ...yearTrimConfig };
    return {};
  }

  function buildRealYearTrimColumn(yearIndex: number, trim: TrimOption): MatrixColumn {
    const years = state.dimensions?.years || [];
    return {
      key: `y${yearIndex}_t${trim.trimId}`,
      label: trim.trimName,
      yearLabel: years[yearIndex] || "",
      yearIndex,
      trimId: trim.trimId,
      trimName: trim.trimName,
      trimIndex: trim.trimIndex,
      real: true,
      displayOnly: false,
      aggregateMode: "NONE",
    };
  }

  return {
    // 工具
    normalizeYearLabelInput,
    normalizeYearList,
    // 存储
    readStoredYears,
    readDeletedStoredYears,
    readStoredYearState,
    writeStoredYears,
    // 维度
    ensureDetailDimensions,
    mergeStoredYearsIntoDetail,
    ensureYearTrimConfigForYears,
    resolveEffectiveTrimOptions,
    syncTopLevelDimensionStateFromDetail,
    // 编辑器
    suggestNextYearLabel,
    openYearEditor,
    confirmYearEditor,
    // 年份操作
    addYear,
    renameActiveYear,
    deleteActiveYear,
    // Key 迁移
    moveYearDimensionKeys,
    moveYearKeysInMap,
    removeYearDimensionKeys,
    removeYearKeysInMap,
    // 列构建
    buildLocalYearTrimConfig,
    buildRealYearTrimColumn,
  };
}
