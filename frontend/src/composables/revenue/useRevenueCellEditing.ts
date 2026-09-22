/**
 * 收益填报页·单元格编辑 composable
 *
 * 负责单元格取值/输入/本地回写/记录元数据/草稿键/填报 popover/单元格意见。
 * 原 mixin: cell-editing.mixin.js
 */
import {
  enrichMatrixRowPathContext,
  formatRevenueTableCellValue,
  getRowCellValue,
  isDisplayAggregateColumn,
  isSavableMatrixColumn,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import { REVENUE_INPUT_SCOPE, REVENUE_MODULE_CODE } from "@/pages/revenue/subtable-workbench/domain-config";
import {
  RND_INVESTMENT_AMOUNT_CELL_KEY,
  RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
  RND_INVESTMENT_TAX_INCLUDED_CELL_KEY,
  isMainNonManualFillRow,
  isRndAmountCellKey,
  isRndDirectYearInputRow as isRndDirectYearInputPathRow,
  isRndDoubleAmountSourceRow,
} from "@/pages/revenue/subtable-workbench/formula-engine";
import { FORMULA_TOOLTIP_MAP } from "@/pages/revenue/subtable-fill/formula-tooltip-map";
import {
  normalizeEditableValue,
  validateEditableValue,
} from "@/pages/revenue/subtable-workbench/value-normalizer";
import type {
  RevenueFillState,
  MatrixRow,
  MatrixColumn,
  CellRecordMeta,
} from "@/types/revenue";

/** 其他 composable 依赖注入 */
export interface CellEditingDeps {
  isSubjectTreeParent: (row: MatrixRow) => boolean;
  resolveMatrixRow: (row: MatrixRow) => MatrixRow;
  readCellObjectValue: (cells: Record<string, unknown> | undefined, key: string) => unknown;
  normalizeSubjectId: (value: unknown) => string;
  normalizeExactSubjectName: (value: unknown) => string;
  displayUiText: (value: unknown) => string;
  resolveRowSubjectId: (row: MatrixRow) => string;
  /** 公式重算调度（由 formula-recalc composable 注入） */
  scheduleFormulaRecalc: () => void;
  /** S1 已提交子表不可再改，对齐 Vue2 isEditableCell */
  resolveModuleSectionBySource?: (row: MatrixRow) => { key?: string } | null | undefined;
  isS1ModuleSubmitted?: (module: { key?: string }) => boolean;
}

export function useRevenueCellEditing(state: RevenueFillState, deps: CellEditingDeps) {
  // ============================================================
  // 研发投资列判断
  // ============================================================

  function isRndInvestmentAmountColumn(column: MatrixColumn | Record<string, unknown>): boolean {
    const source = column && typeof column === "object" ? (column as Record<string, unknown>) : {};
    return Boolean(
      source.rndInvestmentAmount ||
        isRndAmountCellKey(String(source.cellKey || source.key || "")),
    );
  }

  /** 对齐 Vue2 getRndComparablePath：用科目全路径判断研发行 */
  function getRndComparablePath(row: MatrixRow | Record<string, unknown> = {}): string {
    const source = row && typeof row === "object" ? row : {};
    const explicitPath =
      (source as MatrixRow).subjectPath ||
      (source as MatrixRow).subjectTreePath ||
      (source as MatrixRow).path;
    if (Array.isArray(explicitPath) && explicitPath.length > 1) {
      return explicitPath.map((item) => String(item || "").trim()).filter(Boolean).join("/");
    }
    const fullNameRaw = (source as MatrixRow).fullNamePath || (source as MatrixRow).fullPath || "";
    const fullNamePath = Array.isArray(fullNameRaw)
      ? fullNameRaw.map((item) => String(item || "").trim()).filter(Boolean).join("/")
      : String(fullNameRaw || "").trim();
    if (fullNamePath && fullNamePath.includes("/")) return fullNamePath;
    const path =
      fullNamePath ||
      explicitPath ||
      [(source as MatrixRow).rootSubjectName, (source as MatrixRow).subtable, (source as MatrixRow).subject]
        .filter(Boolean)
        .join("/");
    if (Array.isArray(path)) {
      return path.map((item) => String(item || "").trim()).filter(Boolean).join("/");
    }
    return String(path || "").trim();
  }

  function isRndExpenseRow(row: MatrixRow): boolean {
    if (!row || typeof row !== "object") return false;
    if (row.moduleCode === REVENUE_MODULE_CODE.RND_EXPENSE) return true;
    const moduleNames = [
      row.moduleName,
      row.subtable,
      row.rootSubjectName,
      (row as MatrixRow & { __moduleRootName?: string }).__moduleRootName,
    ].map((item) => String(item || "").trim());
    if (moduleNames.some((item) => item === "研发投资" || item === "研发费用")) return true;
    const path = getRndComparablePath(row)
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(/^\/|\/$/g, "");
    return /^研发投资(\/|$)|^研发费用(\/|$)/.test(path);
  }

  function isRndInvestmentSourceRow(row: MatrixRow): boolean {
    return isRndExpenseRow(row) && isRndDoubleAmountSourceRow(row);
  }

  function isRndDirectYearInputRow(row: MatrixRow): boolean {
    return isRndExpenseRow(row) && isRndDirectYearInputPathRow(row);
  }

  function isYearOnlyRow(row: MatrixRow): boolean {
    return row.inputScope === "year_independent";
  }

  // ============================================================
  // 公式悬浮说明（静态字典，移植自 Vue2 formula-tooltip-map）
  // ============================================================

  /** 规范化科目路径，作为悬浮字典 key */
  function normalizeFormulaTooltipPath(value: unknown): string {
    return String(value == null ? "" : value)
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "");
  }

  /** 从行上取科目全路径（优先命中字典的候选） */
  function resolveFormulaTooltipPath(row: MatrixRow | Record<string, unknown> = {}): string {
    const dataRow =
      typeof deps.resolveMatrixRow === "function"
        ? deps.resolveMatrixRow(row as MatrixRow) || row || {}
        : row || {};
    const toPath = (value: unknown) => {
      if (Array.isArray(value)) {
        return normalizeFormulaTooltipPath(value.filter(Boolean).join("/"));
      }
      return normalizeFormulaTooltipPath(value);
    };
    const candidates = [
      toPath((dataRow as MatrixRow).fullNamePath),
      toPath((dataRow as MatrixRow).fullPath),
      toPath((dataRow as MatrixRow).subjectPath),
      toPath((dataRow as Record<string, unknown>).subjectTreePath),
      toPath((row as MatrixRow).fullNamePath),
      toPath((row as MatrixRow).subjectPath),
    ].filter(Boolean) as string[];

    for (let index = 0; index < candidates.length; index += 1) {
      const path = candidates[index];
      if (Object.prototype.hasOwnProperty.call(FORMULA_TOOLTIP_MAP, path)) {
        return path;
      }
    }
    return candidates.find((path) => path.includes("/")) || candidates[0] || "";
  }

  /**
   * 是否展示公式悬浮：仅字典命中的真实计算项（不含「等于」）。
   * 只用于悬浮展示，不参与编辑/保存判断。
   */
  function isFormulaCalculatedRow(row: MatrixRow): boolean {
    if (deps.isSubjectTreeParent(row)) {
      return false;
    }
    return Boolean(resolveFormulaTooltipText(row));
  }

  /** 公式悬浮文案：直接取静态字典 value */
  function resolveFormulaTooltipText(row: MatrixRow): string {
    const path = resolveFormulaTooltipPath(row);
    if (!path) return "";
    const text = (FORMULA_TOOLTIP_MAP as Record<string, string>)[path];
    return text ? String(text) : "";
  }

  // ============================================================
  // 可编辑性判断
  // ============================================================

  function isComputedRow(row: MatrixRow): boolean {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow) return false;
    // 主表按年份/版型：仅消费税金及附加、华为服务费、选装收益可填，其余由子表公式回写
    if (isMainNonManualFillRow(dataRow)) return true;
    return Boolean(
      dataRow.readonly ||
        dataRow.calculated ||
        String(dataRow.inputType || "").toLowerCase() === "calc",
    );
  }

  function isEditableInputRow(row: MatrixRow): boolean {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || isComputedRow(dataRow)) return false;
    const map = state.writableSubjectMap || {};
    const keys = [
      String(dataRow.subjectId || ""),
      String(dataRow.id || ""),
      deps.resolveRowSubjectId(dataRow),
      deps.normalizeSubjectId(dataRow.subjectId),
      deps.normalizeSubjectId(dataRow.id),
    ].filter(Boolean);
    return keys.some((key) => Boolean(map[key]));
  }

  function isColumnFillableByInputScope(row: MatrixRow, column: MatrixColumn): boolean {
    if (isRndInvestmentAmountColumn(column)) {
      return isRndInvestmentSourceRow(row);
    }
    if (isRndExpenseRow(row) && !isRndDirectYearInputRow(row)) return false;
    const scope = String((row && row.inputScope) || REVENUE_INPUT_SCOPE.ALL).trim();
    if (scope === REVENUE_INPUT_SCOPE.READONLY) return false;
    if (scope === REVENUE_INPUT_SCOPE.FIRST_YEAR_ONLY) {
      return Number(column && column.yearIndex) === 0;
    }
    if (scope === REVENUE_INPUT_SCOPE.YEAR_INDEPENDENT) {
      return Number(column && column.yearIndex) === 0;
    }
    return true;
  }

  function isEditableCell(row: MatrixRow, column: MatrixColumn): boolean {
    if (deps.isSubjectTreeParent(row)) return false;
    const dataRow = deps.resolveMatrixRow(row);
    if (!state.canEditFill) return false;
    if (state.isAnyModuleLoading || state.hasModuleLoadErrors) return false;
    if (state.isS1FlowPermissionEntry && state.currentStageCode === "S1") {
      const module = deps.resolveModuleSectionBySource
        ? deps.resolveModuleSectionBySource(dataRow || row)
        : null;
      if (module && deps.isS1ModuleSubmitted && deps.isS1ModuleSubmitted(module)) return false;
    }
    if (state.isS3ConfirmationStage) return false;
    if (isRndInvestmentAmountColumn(column)) {
      return isEditableInputRow(dataRow) && isRndInvestmentSourceRow(dataRow);
    }
    if (state.viewMode === "overview") return false;
    if (isRndExpenseRow(dataRow) && !isRndDirectYearInputRow(dataRow)) return false;
    if (!isSavableMatrixColumn(column as unknown as Record<string, unknown>)) return false;
    if (!isColumnFillableByInputScope(dataRow, column)) return false;
    return isEditableInputRow(dataRow);
  }

  // ============================================================
  // Popover 事件
  // ============================================================

  function blurActivePopoverElement(selector: string): void {
    if (typeof document === "undefined") return;
    const activeElement = document.activeElement as HTMLElement | null;
    if (
      activeElement &&
      typeof activeElement.blur === "function" &&
      typeof activeElement.closest === "function" &&
      activeElement.closest(selector)
    ) {
      activeElement.blur();
    }
  }

  // ============================================================
  // 单元格取值
  // ============================================================

  function getCellValue(row: MatrixRow, column: MatrixColumn): string {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return "";

    if (isRndInvestmentAmountColumn(column)) {
      const cells = (dataRow.cells || {}) as Record<string, unknown>;
      const cellKey = String(column.cellKey || column.key || "").trim();
      const value = deps.readCellObjectValue(cells, cellKey);
      if (value != null) return String(value);
      if (cellKey === RND_INVESTMENT_TAX_INCLUDED_CELL_KEY) {
        return String(dataRow.rndInvestmentTaxIncludedAmount || "");
      }
      if (cellKey === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY) {
        return String(dataRow.rndInvestmentTaxExcludedAmount || dataRow.rndInvestmentAmount || "");
      }
      const legacyValue = deps.readCellObjectValue(cells, RND_INVESTMENT_AMOUNT_CELL_KEY);
      if (legacyValue != null) return String(legacyValue);
      return String(dataRow.rndInvestmentAmount || "");
    }

    if (isDisplayAggregateColumn(column as unknown as Record<string, unknown>)) {
      return getRowCellValue(
        enrichMatrixRowPathContext(dataRow as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>),
        column as unknown as Record<string, unknown>,
      );
    }

    const yearLabel = String(column.yearLabel || "").trim();
    const trimId = String(column.trimId || "").trim();
    const legacyKey = `y${column.yearIndex}_t${column.trimIndex}`;
    const byDimensionKey = `${yearLabel}__${trimId}`;
    const cells = (dataRow.cells || {}) as Record<string, unknown>;
    const cellMap = (dataRow.cellMap || dataRow.cellsByDimension || dataRow.dimensionCells || {}) as Record<string, unknown>;

    const legacyValue = deps.readCellObjectValue(cells, legacyKey);
    const mixedKey = `${yearLabel}_${trimId}`;
    const mixedValue = deps.readCellObjectValue(cells, mixedKey);
    // 预取维度键值，供 computed 分支与正常分支共用。
    // 原实现中 computed 分支只查 legacy/mixed，遗漏了 cellMap[year__trim]，
    // 导致主表行（通过 isMainNonManualFillRow 进入 computed 分支）全部显示为空。
    const byDimensionValue = deps.readCellObjectValue(cellMap, byDimensionKey);

    // 临时诊断：首次遇到主表行时输出数据结构（开发环境）
    if (
      typeof window !== "undefined" &&
      isMainNonManualFillRow(dataRow) &&
      !(window as unknown as Record<string, unknown>)["__mainTableDiagLogged"]
    ) {
      (window as unknown as Record<string, unknown>)["__mainTableDiagLogged"] = true;
      const path = [
        dataRow.rootSubjectName,
        dataRow.subtable,
        dataRow.subjectName || dataRow.subject,
      ]
        .filter(Boolean)
        .join("/");
      const d = dataRow as Record<string, unknown>;
      const templateItem = d.templateItem as Record<string, unknown> | undefined;
      console.groupCollapsed("[主表数据诊断] 主表行取值");
      console.log("行路径:", path);
      console.log("rowId:", dataRow.id || dataRow.rowId);
      console.log("moduleCode:", dataRow.moduleCode);
      console.log("templateEntryMode:", d.templateEntryMode || d.entryMode || (templateItem && templateItem.entryMode));
      console.log("hasBackendTemplateMeta:", Boolean(d.templateItem || d.templateSubject || d.templateEntryMode || d.entryMode));
      console.log("calculated:", dataRow.calculated, "readonly:", dataRow.readonly);
      console.log("templateItem:", d.templateItem);
      console.log("formulaExpression:", d.formulaExpression);
      console.log("formulaParamBindings:", d.formulaParamBindings);
      console.log("formulaId:", d.formulaId);
      console.log("cellMap keys:", Object.keys(cellMap || {}));
      console.log("cellMap values:", cellMap);
      console.log("cells keys:", Object.keys(cells || {}));
      console.log("column:", {
        key: column.key,
        yearLabel,
        trimId,
        yearIndex: column.yearIndex,
        trimIndex: column.trimIndex,
      });
      console.log("lookup keys:", { byDimensionKey, legacyKey, mixedKey });
      console.log("lookup values:", {
        byDimensionValue,
        legacyValue,
        mixedValue,
      });
      console.groupEnd();
    }

    if (isComputedRow(dataRow)) {
      if (byDimensionValue != null) return String(byDimensionValue);
      if (legacyValue != null) return String(legacyValue);
      if (mixedValue != null) return String(mixedValue);
    }

    if (byDimensionValue != null) return String(byDimensionValue);

    if (legacyValue != null) return String(legacyValue);
    if (mixedValue != null) return String(mixedValue);
    return "";
  }

  // ============================================================
  // 草稿键
  // ============================================================

  function buildCellDraftKey(row: MatrixRow, column: MatrixColumn): string {
    const dataRow = deps.resolveMatrixRow(row);
    const rowId = String((dataRow && (dataRow.id || dataRow.rowId || dataRow.subjectId)) || "").trim();
    if (isRndInvestmentAmountColumn(column)) {
      return `${rowId}__${String((column && (column.cellKey || column.key)) || "").trim()}`;
    }
    const yearLabel = String((column && column.yearLabel) || "").trim();
    const trimId = String((column && column.trimId) || "").trim();
    return `${rowId}__${yearLabel}__${trimId}`;
  }

  // ============================================================
  // 可编辑单元格值
  // ============================================================

  function resolveCellLegacyKey(column: MatrixColumn): string {
    if (!column) return "";
    if (column.cellKey) return String(column.cellKey || "").trim();
    return `y${column.yearIndex}_t${column.trimIndex}`;
  }

  function resolveCellDimensionKey(column: MatrixColumn): string {
    if (!column) return "";
    const yearLabel = String(column.yearLabel || "").trim();
    const trimId = String(column.trimId || column.trimName || "").trim();
    return yearLabel && trimId ? `${yearLabel}__${trimId}` : "";
  }

  function resolveCellValueRow(row: MatrixRow, column: MatrixColumn): MatrixRow {
    const dataRow = deps.resolveMatrixRow(row);
    if (isRndInvestmentAmountColumn(column) && column && column.unit) {
      return {
        ...dataRow,
        unit: String(column.unit),
      };
    }
    return dataRow;
  }

  function getEditableCellValue(row: MatrixRow, column: MatrixColumn): string {
    const key = buildCellDraftKey(row, column);
    const drafts = state.cellInputDrafts as Record<string, string>;
    // 直接读 proxy 属性以建立依赖；勿用 hasOwnProperty（会漏追踪导致输入框不回显）
    if (drafts && drafts[key] !== undefined) {
      return drafts[key];
    }
    const dataRow = deps.resolveMatrixRow(row);
    const value = getCellValue(row, column);
    if (value == null || String(value).trim() === "") return "";
    return formatRevenueTableCellValue(
      resolveCellValueRow(dataRow, column) as unknown as Record<string, unknown>,
      value,
    );
  }

  // ============================================================
  // 单元格输入
  // ============================================================

  /**
   * 对齐 Vue2：走 value-normalizer。
   * 无缩放单位的文本（如产品竞争力分析「车型」「版型」）允许原样入库；
   * 万元/% 等缩放单位仍校验为数字并换算存储值。
   */
  function normalizeDisplayInput(
    row: MatrixRow,
    value: string,
  ): { ok: boolean; storageValue?: string; value?: string; message?: string } {
    const dataRow = deps.resolveMatrixRow(row) || row;
    return normalizeEditableValue(value, dataRow);
  }

  function validatePercentDisplayInput(
    row: MatrixRow,
    value: string,
    options: { max?: number; min?: number; invalidMessage?: string; rangeMessage?: string } = {},
  ): { ok: boolean; value?: string; message?: string } {
    const dataRow = deps.resolveMatrixRow(row) || row;
    const result = validateEditableValue(dataRow, value, options);
    return {
      ok: result.ok,
      value: result.storageValue != null ? result.storageValue : result.value,
      message: result.message,
    };
  }

  function onCellInput(row: MatrixRow, column: MatrixColumn, value: unknown): void {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column || deps.isSubjectTreeParent(row as MatrixRow) || isComputedRow(dataRow)) return;
    const key = buildCellDraftKey(dataRow, column);
    // 整体替换 map，确保 Vue3 受控输入框能立刻回显（对齐跨年同步 / writeS1ModuleMap）
    if (state.cellInputOriginals[key] === undefined) {
      const originalValue = getCellValue(dataRow, column);
      state.cellInputOriginals = {
        ...state.cellInputOriginals,
        [key]: String(originalValue == null ? "" : originalValue),
      };
    }
    const nextValue = String(value == null ? "" : value);
    state.cellInputDrafts = {
      ...state.cellInputDrafts,
      [key]: nextValue,
    };
    const normalized = normalizeDisplayInput(resolveCellValueRow(dataRow, column), nextValue);
    updateCellValueLocally(
      dataRow,
      column,
      normalized.ok && normalized.storageValue != null ? normalized.storageValue : nextValue,
    );
    deps.scheduleFormulaRecalc();
  }

  function clearCellInputDraft(row: MatrixRow, column: MatrixColumn): void {
    const key = buildCellDraftKey(row, column);
    if (state.cellInputDrafts[key] !== undefined) {
      const nextDrafts = { ...state.cellInputDrafts };
      delete nextDrafts[key];
      state.cellInputDrafts = nextDrafts;
    }
    if (state.cellInputOriginals[key] !== undefined) {
      const nextOriginals = { ...state.cellInputOriginals };
      delete nextOriginals[key];
      state.cellInputOriginals = nextOriginals;
    }
  }

  // ============================================================
  // 本地回写
  // ============================================================

  function updateCellValueLocally(row: MatrixRow, column: MatrixColumn, value: unknown): void {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return;

    if (isRndInvestmentAmountColumn(column)) {
      if (!dataRow.cells || typeof dataRow.cells !== "object") {
        dataRow.cells = {};
      }
      const cellKey = String(column.cellKey || column.key || "").trim();
      (dataRow.cells as Record<string, unknown>)[cellKey] = value;
      if (cellKey === RND_INVESTMENT_TAX_INCLUDED_CELL_KEY) {
        dataRow.rndInvestmentTaxIncludedAmount = value;
      }
      if (cellKey === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY) {
        dataRow.rndInvestmentTaxExcludedAmount = value;
        dataRow.rndInvestmentAmount = value;
      }
      return;
    }

    const yearLabel = String(column.yearLabel || "").trim();
    const trimId = String(column.trimId || "").trim();
    const legacyKey = `y${column.yearIndex}_t${column.trimIndex}`;
    const byDimensionKey = `${yearLabel}__${trimId}`;

    if (!dataRow.cells || typeof dataRow.cells !== "object") {
      dataRow.cells = {};
    }
    const rowCellMap = dataRow.cellMap && typeof dataRow.cellMap === "object"
      ? (dataRow.cellMap as Record<string, unknown>)
      : {};
    if (!dataRow.cellMap || typeof dataRow.cellMap !== "object") {
      dataRow.cellMap = rowCellMap;
    }

    (dataRow.cells as Record<string, unknown>)[legacyKey] = value;
    (dataRow.cellMap as Record<string, unknown>)[byDimensionKey] = value;
  }

  // ============================================================
  // 记录元数据
  // ============================================================

  function getCellRecordMeta(
    row: MatrixRow,
    column: MatrixColumn,
  ): CellRecordMeta | null {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return null;
    const recordMap = (dataRow.cellRecordMap || dataRow.recordMap) as Record<string, unknown> | undefined;
    if (!recordMap || typeof recordMap !== "object") return null;

    if (isRndInvestmentAmountColumn(column)) {
      const cellKey = String(column.cellKey || column.key || "").trim();
      return Object.prototype.hasOwnProperty.call(recordMap, cellKey)
        ? (recordMap[cellKey] as CellRecordMeta)
        : null;
    }

    const legacyKey = `y${column.yearIndex}_t${column.trimIndex}`;
    if (Object.prototype.hasOwnProperty.call(recordMap, legacyKey)) {
      return recordMap[legacyKey] as CellRecordMeta;
    }

    const yearLabel = String(column.yearLabel || "").trim();
    const trimId = String(column.trimId || "").trim();
    const byDimensionKey = `${yearLabel}__${trimId}`;
    if (Object.prototype.hasOwnProperty.call(recordMap, byDimensionKey)) {
      return recordMap[byDimensionKey] as CellRecordMeta;
    }

    return null;
  }

  function updateCellRecordMeta(
    row: MatrixRow,
    column: MatrixColumn,
    recordId: string | number,
    options: { recordStatus?: string } = {},
  ): void {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column || !recordId) return;

    const yearLabel = String(column.yearLabel || "").trim();
    const trimId = String(column.trimId || "").trim();
    const recordStatus = String(options.recordStatus || "DRAFT").trim().toUpperCase() || "DRAFT";

    const ensureMap = (name: string) => {
      if (!(dataRow as Record<string, unknown>)[name] || typeof (dataRow as Record<string, unknown>)[name] !== "object") {
        (dataRow as Record<string, unknown>)[name] = {};
      }
      return (dataRow as Record<string, unknown>)[name] as Record<string, unknown>;
    };

    if (isRndInvestmentAmountColumn(column)) {
      const cellKey = String(column.cellKey || column.key || "").trim();
      const map = ensureMap("cellRecordMap");
      map[cellKey] = {
        id: recordId,
        recordStatus,
        ownerId: state.queryOwnerUserId || state.currentUser,
        ownerPermission: state.queryPermissionKey,
      };
      return;
    }

    const legacyKey = `y${column.yearIndex}_t${column.trimIndex}`;

    const map = ensureMap("cellRecordMap");
    const meta: CellRecordMeta = {
      id: recordId,
      recordStatus,
      ownerId: state.queryOwnerUserId || state.currentUser,
      ownerPermission: state.queryPermissionKey,
    };
    map[legacyKey] = meta;

    // Also store by dimension key for display
    const dimMap = ensureMap("cellRecordMap");
    dimMap[`${yearLabel}__${trimId}`] = meta;
  }

  // ============================================================
  // 单元格意见
  // ============================================================

  function readLocalCellOpinion(
    row: MatrixRow,
    column: MatrixColumn,
    mapName = "fillOpinionMap",
  ): Record<string, unknown> | null {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return null;
    const map = (dataRow as Record<string, unknown>)[mapName] as Record<string, unknown> | undefined;
    if (!map || typeof map !== "object") return null;
    const legacyKey = resolveCellLegacyKey(column);
    if (legacyKey && Object.prototype.hasOwnProperty.call(map, legacyKey)) return map[legacyKey] as Record<string, unknown>;
    const dimensionKey = resolveCellDimensionKey(column);
    if (dimensionKey && Object.prototype.hasOwnProperty.call(map, dimensionKey)) return map[dimensionKey] as Record<string, unknown>;
    return null;
  }

  function writeLocalCellOpinion(
    row: MatrixRow,
    column: MatrixColumn,
    opinionData: Record<string, unknown> = {},
    mapName = "fillOpinionMap",
  ): void {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return;
    const existingMap = (dataRow as Record<string, unknown>)[mapName] as Record<string, unknown> | undefined;
    const map = existingMap && typeof existingMap === "object" ? existingMap : {};
    if (!(dataRow as Record<string, unknown>)[mapName] || typeof (dataRow as Record<string, unknown>)[mapName] !== "object") {
      (dataRow as Record<string, unknown>)[mapName] = map;
    }
    const value = {
      ...opinionData,
      opinion: String((opinionData && opinionData.opinion) || ""),
    };
    const legacyKey = resolveCellLegacyKey(column);
    const dimensionKey = resolveCellDimensionKey(column);
    if (legacyKey) map[legacyKey] = value;
    if (dimensionKey) map[dimensionKey] = value;
  }

  function getFillCellOpinion(row: MatrixRow, column: MatrixColumn): string {
    const data = readLocalCellOpinion(row, column, "fillOpinionMap");
    return String((data && data.opinion) || "").trim();
  }

  function hasFillCellOpinion(row: MatrixRow, column: MatrixColumn): boolean {
    return Boolean(getFillCellOpinion(row, column));
  }

  function fillCellButtonType(row: MatrixRow, column: MatrixColumn): string {
    if (hasFillCellOpinion(row, column)) return "warning";
    return "primary";
  }

  // ============================================================
  // 填报 Popover
  // ============================================================

  function buildFillPopoverKey(row: MatrixRow, column: MatrixColumn): string {
    return `fillpopover__${buildCellDraftKey(row, column)}`;
  }

  function isFillPopoverVisible(row: MatrixRow, column: MatrixColumn): boolean {
    return state.activeFillPopoverKey === buildFillPopoverKey(row, column);
  }

  function openFillCellEditor(row: MatrixRow, column: MatrixColumn): void {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return;
    const key = buildFillPopoverKey(dataRow, column);
    state.activeS3PopoverKey = "";
    state.activeFillPopoverKey = key;
    state.fillCellEditor = {
      key,
      row: dataRow,
      column,
      value: String(getEditableCellValue(dataRow, column) == null ? "" : getEditableCellValue(dataRow, column)),
      opinion: getFillCellOpinion(dataRow, column),
    };
  }

  function closeFillCellEditor(): void {
    blurActivePopoverElement(".revenue-fill-cell-popover");
    state.activeFillPopoverKey = "";
    state.fillCellEditor = {
      key: "",
      row: null,
      column: null,
      value: "",
      opinion: "",
    };
  }

  function handleDocumentClickForCellPopover(event: Event): void {
    if (!state.activeFillPopoverKey) return;
    const target = event && event.target as HTMLElement | null;
    if (
      target &&
      typeof target.closest === "function" &&
      target.closest(".revenue-fill-cell-popover, .fill-opinion-icon-btn, .el-select-dropdown")
    ) {
      return;
    }
    closeFillCellEditor();
  }

  function onFillEditorValueInput(value: unknown): void {
    state.fillCellEditor = {
      ...state.fillCellEditor,
      value: String(value == null ? "" : value),
    };
  }

  function onFillEditorOpinionInput(value: unknown): void {
    state.fillCellEditor = {
      ...state.fillCellEditor,
      opinion: String(value == null ? "" : value),
    };
  }

  // ============================================================
  // 展示
  // ============================================================

  function displayCellValue(row: MatrixRow, column: MatrixColumn): string {
    if (deps.isSubjectTreeParent(row)) return "";
    const dataRow = deps.resolveMatrixRow(row);
    const value = getCellValue(row, column);
    if (isDisplayAggregateColumn(column as unknown as Record<string, unknown>)) {
      const text = String(value == null ? "" : value).trim();
      return text || "-";
    }
    return formatRevenueTableCellValue(
      resolveCellValueRow(dataRow, column) as unknown as Record<string, unknown>,
      value,
    );
  }

  function displayFillCellTriggerText(row: MatrixRow, column: MatrixColumn): string {
    return displayCellValue(row, column);
  }

  function resolveFillPopoverTitle(row: MatrixRow, column: MatrixColumn): string {
    const dataRow = deps.resolveMatrixRow(row);
    const subject = deps.displayUiText(String((dataRow && (dataRow.subject || dataRow.subjectName)) || "-").trim());
    const year = String((column && column.yearLabel) || "").trim();
    const trim = String((column && (column.label || column.trimName || column.trimId)) || "").trim();
    return [subject, year, trim].filter(Boolean).join(" / ");
  }

  return {
    // 判断
    isEditableCell,
    isEditableInputRow,
    isColumnFillableByInputScope,
    isComputedRow,
    isRndInvestmentAmountColumn,
    isRndInvestmentSourceRow,
    isRndExpenseRow,
    isRndDirectYearInputRow,
    isYearOnlyRow,
    // 公式悬浮
    normalizeFormulaTooltipPath,
    resolveFormulaTooltipPath,
    isFormulaCalculatedRow,
    resolveFormulaTooltipText,
    // 取值
    getCellValue,
    getEditableCellValue,
    buildCellDraftKey,
    // 输入
    onCellInput,
    clearCellInputDraft,
    normalizeDisplayInput,
    validatePercentDisplayInput,
    updateCellValueLocally,
    // 元数据
    getCellRecordMeta,
    updateCellRecordMeta,
    resolveCellLegacyKey,
    resolveCellDimensionKey,
    resolveCellValueRow,
    // 意见
    readLocalCellOpinion,
    writeLocalCellOpinion,
    getFillCellOpinion,
    hasFillCellOpinion,
    fillCellButtonType,
    // Popover
    blurActivePopoverElement,
    buildFillPopoverKey,
    isFillPopoverVisible,
    openFillCellEditor,
    closeFillCellEditor,
    handleDocumentClickForCellPopover,
    onFillEditorValueInput,
    onFillEditorOpinionInput,
    // 展示
    displayCellValue,
    displayFillCellTriggerText,
    resolveFillPopoverTitle,
  };
}
