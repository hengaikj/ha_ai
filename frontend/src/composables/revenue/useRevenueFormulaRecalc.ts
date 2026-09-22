/**
 * 收益填报页·公式重算与诊断 composable
 *
 * 负责公式源解析、重算调度(防抖)与即时应用、公式诊断日志。
 * 原 mixin: formula-recalc.mixin.js
 */
import { ElMessage } from "element-plus";
import {
  collectSalesVolumeMixDiagnostics,
} from "@/pages/revenue/subtable-workbench/formula-engine";
import { tryApplyRevenueFormulasToDetail } from "@/pages/revenue/subtable-workbench/services/detail-diagnostics";
import { resolveSubtableFormulaSourceDetail } from "@/pages/revenue/subtable-workbench/service";
import { isSavableMatrixColumn } from "@/pages/revenue/subtable-workbench/matrix-utils";
import { AUDIT_DOMAIN } from "@/pages/revenue/subtable-workbench/domain-config";
import type {
  RevenueFillState,
  MatrixRow,
  MatrixColumn,
  ModuleSection,
  TrimOption,
} from "@/types/revenue";

const FORMULA_RECALC_DEBOUNCE_MS = 120;

/** 其他 composable 依赖注入 */
export interface FormulaRecalcDeps {
  resolveMatrixRow: (row: MatrixRow) => MatrixRow;
  isSubjectTreeParent: (row: MatrixRow) => boolean;
  getCellValue: (row: MatrixRow, column: MatrixColumn) => string;
  getCellRecordMeta: (row: MatrixRow, column: MatrixColumn) => unknown;
  resolveCellLegacyKey: (column: MatrixColumn) => string;
  resolveCellDimensionKey: (column: MatrixColumn) => string;
  isColumnFillableByInputScope: (row: MatrixRow, column: MatrixColumn) => boolean;
  isEditableCell: (row: MatrixRow, column: MatrixColumn) => boolean;
  isEditableInputRow: (row: MatrixRow) => boolean;
  getPageTraceNow: () => number;
  formatPageTraceTime: (value: number) => string;
}

export function useRevenueFormulaRecalc(state: RevenueFillState, deps: FormulaRecalcDeps) {
  // ============================================================
  // 公式来源
  // ============================================================

  function getFormulaSourceDetails(): Array<{ rows: MatrixRow[] }> {
    const detail = state.formulaSourceDetail as Record<string, unknown> | null;
    return detail && Array.isArray(detail.rows) && detail.rows.length
      ? [detail as unknown as { rows: MatrixRow[] }]
      : [];
  }

  function getAggregateSourceRows(): MatrixRow[] {
    const rows: MatrixRow[] = [];
    const seen: Record<string, boolean> = {};
    const appendRows = (items: unknown) => {
      (Array.isArray(items) ? items : []).forEach((row, index) => {
        if (!row || typeof row !== "object") return;
        const key = String(
          (row as MatrixRow).id || (row as MatrixRow).rowId || (row as MatrixRow).subjectId ||
          (row as MatrixRow).fullNamePath || (row as MatrixRow).subjectPath || `row_${index}`,
        ).trim();
        if (seen[key]) return;
        seen[key] = true;
        rows.push(row as MatrixRow);
      });
    };
    const detail = state.detail as Record<string, unknown>;
    appendRows(detail && detail.rows);
    const formulaDetail = state.formulaSourceDetail as Record<string, unknown> | null;
    appendRows(formulaDetail && formulaDetail.rows);
    return rows;
  }

  // ============================================================
  // 重算调度
  // ============================================================

  function cancelScheduledFormulaRecalc(): void {
    if (!state.formulaRecalcTimerId) return;
    window.clearTimeout(state.formulaRecalcTimerId);
    state.formulaRecalcTimerId = null;
  }

  function scheduleFormulaRecalc(): void {
    cancelScheduledFormulaRecalc();
    state.formulaRecalcTimerId = window.setTimeout(() => {
      state.formulaRecalcTimerId = null;
      applyCurrentDetailFormulas();
    }, FORMULA_RECALC_DEBOUNCE_MS);
  }

  function flushScheduledFormulaRecalc(): unknown {
    if (!state.formulaRecalcTimerId) return null;
    cancelScheduledFormulaRecalc();
    return applyCurrentDetailFormulas();
  }

  function applyCurrentDetailFormulas(): unknown {
    // 对齐 Vue2 formula-recalc.mixin：实时重算只跑公式，不做落库计算值 capture/restore。
    // 否则曾落库的 CALCULATED 行（主表销量/边际贡献/营业利润等）会被旧值盖回，表现为「改了不刷新」。
    // 加载组包时的覆盖保留仍由 fill.service / fill-payload 负责；真·公式锁由 formulaLockedCellMap 处理。
    const detail = state.detail as Record<string, unknown>;
    const result = tryApplyRevenueFormulasToDetail(detail, {
      sourceDetails: getFormulaSourceDetails(),
    });
    // 替代 Vue2 $forceUpdate：换 rows 引用，驱动依赖矩阵的视图刷新
    if (Array.isArray(detail.rows)) {
      detail.rows = (detail.rows as MatrixRow[]).slice();
    }
    logSalesMixFormulaDiagnostics(result);
    return result;
  }

  // ============================================================
  // 调试辅助
  // ============================================================

  function getDebugRowPath(row: MatrixRow): string {
    const path =
      row.fullNamePath ||
      row.subjectPath ||
      row.subjectTreePath ||
      row.path ||
      [row.rootSubjectName, row.subtable, row.subject].filter(Boolean).join("/");
    if (Array.isArray(path)) return path.map((item) => String(item || "").trim()).filter(Boolean).join("/");
    return String(path || "").trim();
  }

  function isConsumerCreditDebugRow(row: MatrixRow): boolean {
    const dataRow = deps.resolveMatrixRow(row);
    const text = [
      getDebugRowPath(dataRow),
      dataRow && dataRow.subject,
      dataRow && dataRow.subjectName,
      dataRow && dataRow.fullNamePath,
      dataRow && dataRow.subjectPath,
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(" / ");
    return text.includes("消费信贷");
  }

  function collectRowsForRevenueDebug(): Array<{ source: string; row: MatrixRow }> {
    const entries: Array<{ source: string; row: MatrixRow }> = [];
    const append = (source: string, rows: unknown) => {
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (!row || typeof row !== "object") return;
        entries.push({ source, row: row as MatrixRow });
      });
    };
    const detail = state.detail as Record<string, unknown>;
    append("currentDetail", detail && detail.rows);
    const formulaDetail = state.formulaSourceDetail as Record<string, unknown> | null;
    append("formulaSourceDetail", formulaDetail && formulaDetail.rows);
    return entries;
  }

  function buildRevenueDebugCellSnapshot(row: MatrixRow, column: MatrixColumn) {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return null;
    const legacyKey = deps.resolveCellLegacyKey(column);
    const dimensionKey = deps.resolveCellDimensionKey(column);
    const cells = dataRow.cells && typeof dataRow.cells === "object" ? dataRow.cells : {};
    const cellMap = dataRow.cellMap && typeof dataRow.cellMap === "object" ? dataRow.cellMap : {};
    return {
      subjectId: dataRow.subjectId,
      rowId: dataRow.id || dataRow.rowId,
      moduleCode: dataRow.moduleCode,
      moduleName: dataRow.moduleName || dataRow.subtable || dataRow.rootSubjectName,
      subject: dataRow.subject || dataRow.subjectName,
      path: getDebugRowPath(dataRow),
      cellKey: legacyKey,
      dimensionKey,
      displayedValue: deps.getCellValue(dataRow, column),
      cellValue: legacyKey && Object.prototype.hasOwnProperty.call(cells, legacyKey) ? (cells as Record<string, unknown>)[legacyKey] : undefined,
      dimensionValue: dimensionKey && Object.prototype.hasOwnProperty.call(cellMap, dimensionKey) ? (cellMap as Record<string, unknown>)[dimensionKey] : undefined,
      recordMeta: deps.getCellRecordMeta(dataRow, column),
    };
  }

  function buildConsumerCreditFormulaDebugSnapshot(
    row: MatrixRow,
    column: MatrixColumn,
    extra: Record<string, unknown> = {},
  ) {
    const debugTargets = [
      { label: "消费信贷", includes: ["消费信贷"] },
      { label: "销量表/单价-指导价", includes: ["销量表/单价-指导价", "单价-指导价"] },
      { label: "促销商务政策/单车促销政策/小计", includes: ["单车促销政策/小计"] },
      { label: "主表/市场指导价/合同价（含税）", includes: ["主表/单车收益/市场指导价/合同价（含税）"] },
      { label: "主表/促销政策（含税）", includes: ["主表/单车收益/促销政策（含税）"] },
      { label: "主表/TP价（含税）", includes: ["主表/单车收益/TP价（含税）"] },
      { label: "主表/商务政策（含税）", includes: ["主表/单车收益/商务政策（含税）"] },
      { label: "主表/经销商底价（含税）", includes: ["主表/单车收益/经销商底价（含税）"] },
      { label: "主表/销售收入", includes: ["主表/单车收益/销售收入"] },
    ];
    const entries = collectRowsForRevenueDebug();
    const matchedRows: unknown[] = [];
    debugTargets.forEach((target) => {
      entries.forEach((entry) => {
        const rowPath = getDebugRowPath(entry.row);
        const text = [rowPath, entry.row.subject, entry.row.subjectName]
          .map((item) => String(item || "").trim())
          .filter(Boolean)
          .join(" / ");
        if (!target.includes.some((keyword) => text.includes(keyword))) return;
        const cell = buildRevenueDebugCellSnapshot(entry.row, column);
        matchedRows.push({
          label: target.label,
          source: entry.source,
          ...(cell || {}),
        });
      });
    });
    return {
      phase: extra.phase || "",
      time: new Date().toISOString(),
      route: {
        stage: state.queryStage,
        permissionKey: state.queryPermissionKey,
        projectCode: state.queryProjectCode,
        flowId: state.queryFlowId || state.activeFlowId,
      },
      editedCell: buildRevenueDebugCellSnapshot(row, column),
      save: extra.save || {},
      formulaResult: extra.formulaResult || null,
      rows: matchedRows,
    };
  }

  function logConsumerCreditSaveDebug(
    phase: string,
    row: MatrixRow,
    column: MatrixColumn,
    extra: Record<string, unknown> = {},
  ) {
    if (!isConsumerCreditDebugRow(row)) return;
    const snapshot = buildConsumerCreditFormulaDebugSnapshot(row, column, {
      ...extra,
      phase,
    });
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__revenueConsumerCreditDebug = snapshot;
      const history = Array.isArray(
        (window as unknown as Record<string, unknown>).__revenueConsumerCreditDebugHistory,
      )
        ? ((window as unknown as Record<string, unknown>).__revenueConsumerCreditDebugHistory as unknown[])
        : [];
      history.push(snapshot);
      (window as unknown as Record<string, unknown>).__revenueConsumerCreditDebugHistory = history.slice(-20);
    }
    const tableRows = ((snapshot.rows || []) as Array<Record<string, unknown>>).map((item) => ({
      label: item.label,
      source: item.source,
      subjectId: item.subjectId,
      rowId: item.rowId,
      path: item.path,
      displayedValue: item.displayedValue,
      cellValue: item.cellValue,
      dimensionValue: item.dimensionValue,
      recordId: item.recordMeta && (item.recordMeta as Record<string, unknown>).id,
      recordStatus: item.recordMeta && (item.recordMeta as Record<string, unknown>).recordStatus,
    }));
     
    console.groupCollapsed(`[Revenue Formula Debug] 消费信贷保存链路 - ${phase}`);
     
    console.log("snapshot", snapshot);
     
    console.table(tableRows);
     
    console.groupEnd();
  }

  // ============================================================
  // 销量结构 MIX 诊断
  // ============================================================

  function collectVisibleMixRowsForDiagnostics() {
    const result: unknown[] = [];
    const sections = Array.isArray(state.moduleSections) ? state.moduleSections : [];
    sections.forEach((section) => {
      // 需要外部注入 sectionVisibleActiveColumns
      const columns = state.activeColumns || [];
      (section.treeRows || []).forEach((treeRow) => {
        if (deps.isSubjectTreeParent(treeRow)) return;
        const dataRow = deps.resolveMatrixRow(treeRow);
        if (!dataRow) return;
        const path = getDebugRowPath(dataRow);
        const subject = String(dataRow.subjectName || dataRow.subject || "").trim();
        if (!/mix/i.test(path) && !/mix/i.test(subject)) return;
        const rowInfo: Record<string, unknown> = {
          section: section.name || section.moduleName || section.rootSubjectName || "",
          rowKey: "", // 需要 resolveSubjectTreeRowKey 注入
          id: String(dataRow.id || dataRow.rowId || dataRow.subjectId || "").trim(),
          subjectId: String(dataRow.subjectId || "").trim(),
          subject,
          path,
          cells: dataRow.cells && typeof dataRow.cells === "object" ? { ...dataRow.cells } : {},
          cellMap: dataRow.cellMap && typeof dataRow.cellMap === "object" ? { ...dataRow.cellMap } : {},
          columns: [] as unknown[],
        };
        columns.forEach((column) => {
          const legacyKey = `y${column.yearIndex}_t${column.trimIndex}`;
          const dimensionKey = `${String(column.yearLabel || "").trim()}__${String(column.trimId || "").trim()}`;
          (rowInfo.columns as unknown[]).push({
            label: column.label,
            yearLabel: column.yearLabel,
            trimId: column.trimId,
            trimIndex: column.trimIndex,
            displayOnly: Boolean(column.displayOnly || column.real === false),
            legacyKey,
            dimensionKey,
            displayedValue: deps.getCellValue(treeRow, column),
            rawCellValue:
              dataRow.cells && Object.prototype.hasOwnProperty.call(dataRow.cells, legacyKey)
                ? (dataRow.cells as Record<string, unknown>)[legacyKey]
                : undefined,
            rawDimensionValue:
              dataRow.cellMap && Object.prototype.hasOwnProperty.call(dataRow.cellMap, dimensionKey)
                ? (dataRow.cellMap as Record<string, unknown>)[dimensionKey]
                : undefined,
          });
        });
        result.push(rowInfo);
      });
    });
    return result;
  }

  function logSalesMixFormulaDiagnostics(formulaResult: unknown = null) {
    if (!state.formulaDebugEnabled) return;
    const diagnostics = {
      route: {
        stage: state.queryStage,
        permissionKey: state.queryPermissionKey,
        projectCode: state.queryProjectCode,
        valve: state.queryValve,
        viewMode: state.viewMode,
        activeYearLabel: state.activeYearLabel,
      },
      formulaResult,
      engine: collectSalesVolumeMixDiagnostics(state.detail as Record<string, unknown>),
      visibleMixRows: collectVisibleMixRowsForDiagnostics(),
    };
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__revenueSalesMixDiagnostics = diagnostics;
    }
     
    console.groupCollapsed("[Revenue Formula Debug] 销量表 MIX");
     
    console.log("diagnostics", diagnostics);
     
    console.table((diagnostics.engine as Record<string, unknown>).probes || []);
    const visibleCells: unknown[] = [];
    (diagnostics.visibleMixRows as Array<Record<string, unknown>>).forEach((row) => {
      (row.columns as Array<Record<string, unknown>>).forEach((column) => {
        visibleCells.push({
          rowPath: row.path,
          rowId: row.id,
          subjectId: row.subjectId,
          label: column.label,
          yearLabel: column.yearLabel,
          trimId: column.trimId,
          legacyKey: column.legacyKey,
          dimensionKey: column.dimensionKey,
          displayedValue: column.displayedValue,
          rawCellValue: column.rawCellValue,
          rawDimensionValue: column.rawDimensionValue,
        });
      });
    });
     
    console.table(visibleCells);
     
    console.groupEnd();
  }

  // ============================================================
  // 管理费率 inputScope 诊断
  // ============================================================

  function buildAllRealColumns(): MatrixColumn[] {
    const detail = state.detail as Record<string, unknown>;
    const detailDims = (detail.dimensions || {}) as { years?: string[] };
    const years =
      (Array.isArray(state.dimensions?.years) && state.dimensions.years.length
        ? state.dimensions.years
        : detailDims.years) || [];
    const detailTrims = Array.isArray(detail.trimOptions) ? detail.trimOptions : [];
    const trimOptions =
      (Array.isArray(state.trimOptions) && state.trimOptions.length
        ? state.trimOptions
        : detailTrims) || [];
    const columns: MatrixColumn[] = [];
    years.forEach((_year, yearIndex) => {
      trimOptions.forEach((trim: TrimOption | Record<string, unknown>) => {
        const trimId = String(
          (trim as TrimOption).trimId ||
            (trim as Record<string, unknown>).id ||
            (trim as Record<string, unknown>).code ||
            "",
        ).trim();
        if (!trimId) return;
        const trimName = String(
          (trim as TrimOption).trimName ||
            (trim as Record<string, unknown>).name ||
            trimId,
        ).trim();
        const trimIndex = Number.isInteger((trim as TrimOption).trimIndex)
          ? Number((trim as TrimOption).trimIndex)
          : 0;
        columns.push({
          key: `y${yearIndex}_t${trimId}`,
          label: trimName,
          yearLabel: years[yearIndex],
          yearIndex,
          trimId,
          trimName,
          trimIndex,
          real: true,
          displayOnly: false,
          aggregateMode: "NONE",
        });
      });
    });
    return columns;
  }

  function scheduleManagementRateInputScopeDiagnostics() {
    if (!state.inputScopeDebugEnabled) return;
    // 使用 queueMicrotask 替代 nextTick
    queueMicrotask(() => {
      logManagementRateInputScopeDiagnostics();
    });
  }

  function logManagementRateInputScopeDiagnostics(force = false) {
    if (!force && !state.inputScopeDebugEnabled) return;

    const normalizeText = (value: unknown): string => {
      if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean).join("/");
      }
      return String(value == null ? "" : value).trim();
    };
    const buildPathText = (row: MatrixRow) =>
      [
        normalizeText(row.fullNamePath),
        normalizeText(row.fullPath),
        normalizeText(row.subjectPath),
        normalizeText(row.subjectTreePath),
        normalizeText(row.path),
        normalizeText(row.rootSubjectName),
        normalizeText(row.subtable),
        normalizeText(row.subjectName),
        normalizeText(row.subject),
      ]
        .filter(Boolean)
        .join("/");
    const normalizeComparableText = (value: string) =>
      String(value || "")
        .replace(/\s+/g, "")
        .replace(/[（）()]/g, "")
        .replace(/[/\\|｜>＞\-—_]/g, "")
        .toLowerCase();
    const isManagementRateRow = (item: { pathText: string }) => {
      const text = normalizeComparableText(item.pathText);
      return text.includes("其他固定费用") && text.includes("管理费用") && text.includes("费率");
    };

    const rowItems: Array<{
      row: MatrixRow;
      dataRow: MatrixRow;
      pathText: string;
      sectionName: string;
    }> = [];
    const seen: Record<string, boolean> = {};
    const pushRow = (row: MatrixRow, section?: ModuleSection) => {
      const dataRow = deps.resolveMatrixRow(row) || row;
      if (!dataRow || typeof dataRow !== "object") return;
      const pathText = buildPathText(dataRow) || buildPathText(row);
      const key = [dataRow.id, dataRow.rowId, dataRow.subjectId, pathText]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .join("__");
      if (key && seen[key]) return;
      if (key) seen[key] = true;
      rowItems.push({
        row,
        dataRow,
        pathText,
        sectionName:
          (section && (section.name || section.moduleName || section.rootSubjectName)) || "",
      });
    };

    const detail = state.detail as Record<string, unknown>;
    ((detail.rows || []) as MatrixRow[]).forEach((row) => pushRow(row));
    (state.moduleSections || []).forEach((section) => {
      (section.treeRows || section.rows || []).forEach((row) => pushRow(row, section));
    });

    const matched = rowItems.find(isManagementRateRow);
    const dataRow = matched && matched.dataRow;
    const candidateRows = rowItems
      .filter((item) => {
        const text = normalizeComparableText(item.pathText);
        return text.includes("管理费用") || text.includes("费率");
      })
      .slice(0, 30)
      .map((item) => ({
        sectionName: item.sectionName,
        pathText: item.pathText,
        subject: item.dataRow && (item.dataRow.subject || item.dataRow.subjectName),
        inputScope: item.dataRow && item.dataRow.inputScope,
        rowKind: item.dataRow && item.dataRow.rowKind,
        formulaKey: item.dataRow && item.dataRow.formulaKey,
      }));

    const columns = dataRow
      ? (state.activeColumns || []).map((column) => ({
        label: column.label,
        yearLabel: column.yearLabel,
        yearIndex: column.yearIndex,
        trimId: column.trimId,
        trimIndex: column.trimIndex,
        real: column.real,
        displayOnly: Boolean(column.displayOnly),
        aggregateMode: column.aggregateMode,
        savable: isSavableMatrixColumn(column as unknown as Record<string, unknown>),
        fillable: deps.isColumnFillableByInputScope(dataRow, column),
        editable: deps.isEditableCell(dataRow, column),
        value: deps.getCellValue(dataRow, column),
      }))
      : [];
    const allYearColumns = dataRow
      ? buildAllRealColumns().map((column) => ({
        label: column.label,
        yearLabel: column.yearLabel,
        yearIndex: column.yearIndex,
        trimId: column.trimId,
        trimIndex: column.trimIndex,
        real: column.real,
        displayOnly: Boolean(column.displayOnly),
        aggregateMode: column.aggregateMode,
        savable: isSavableMatrixColumn(column as unknown as Record<string, unknown>),
        fillable: deps.isColumnFillableByInputScope(dataRow, column),
        editable: deps.isEditableCell(dataRow, column),
        value: deps.getCellValue(dataRow, column),
      }))
      : [];

    const diagnostics = {
      route: {
        stage: state.queryStage,
        permissionKey: state.queryPermissionKey,
        projectCode: state.queryProjectCode,
        valve: state.queryValve,
        viewMode: state.viewMode,
        activeYearLabel: state.activeYearLabel,
        activeYearIndex: state.activeYearIndex,
        activeRealYearIndex: state.activeRealYearIndex,
      },
      pageState: {
        canEditFill: state.canEditFill,
        currentStageCode: state.currentStageCode,
        isS3ConfirmationStage: state.isS3ConfirmationStage,
        hasWritableSubjects: state.hasWritableSubjects,
      },
      row: dataRow
        ? {
          sectionName: matched?.sectionName,
          pathText: matched?.pathText,
          id: dataRow.id,
          rowId: dataRow.rowId,
          subjectId: dataRow.subjectId,
          subject: dataRow.subject || dataRow.subjectName,
          fullNamePath: dataRow.fullNamePath,
          subjectPath: dataRow.subjectPath,
          inputScope: dataRow.inputScope,
          inputType: dataRow.inputType,
          rowKind: dataRow.rowKind,
          formulaKey: dataRow.formulaKey,
          readonly: dataRow.readonly,
          calculated: dataRow.calculated,
          writable: deps.isEditableInputRow(dataRow),
        }
        : null,
      columns,
      allYearColumns,
      candidateRows,
    };

    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__managementRateInputScopeDiagnostics =
        diagnostics;
    }
     
    console.groupCollapsed("[Revenue InputScope Debug] 其他固定费用 / 管理费用 / 费率");
     
    console.log("diagnostics", diagnostics);
    if (!dataRow) {
       
      console.warn("未匹配到 其他固定费用 / 管理费用 / 费率，下面是候选行。");
       
      console.table(candidateRows);
    } else {
       
      console.log("row", diagnostics.row);
       
      console.table(columns);
       
      console.table(allYearColumns);
    }
     
    console.groupEnd();
  }

  // ============================================================
  // 加载公式源
  // ============================================================

  async function loadFormulaSourceDetail(query: Record<string, unknown> = {}) {
    state.formulaSourceDetail = null;
    // 填报页按子表域拉公式源；忽略 URL 误带的 subjectDomain=main
    try {
      state.formulaSourceDetail = (await resolveSubtableFormulaSourceDetail(
        {
          ...query,
          subjectDomain: AUDIT_DOMAIN.SUBTABLE,
          // 与壳层一致：透传调用方 mode；服务层若覆盖为 all 也不阻断 loading（已在遮罩之后）
          userId: state.currentUser || query.userId,
        },
        state.detail,
      )) as Record<string, unknown>;
    } catch (error) {
      state.formulaSourceDetail = null;
      const message = (error as Error).message || "公式来源加载失败";
      // 不抛穿到 loadPage；仅提示（Vue2 会 throw，但遮罩已关）
      ElMessage.warning(message);
    }
    applyCurrentDetailFormulas();
  }

  return {
    getFormulaSourceDetails,
    getAggregateSourceRows,
    cancelScheduledFormulaRecalc,
    scheduleFormulaRecalc,
    flushScheduledFormulaRecalc,
    applyCurrentDetailFormulas,
    getDebugRowPath,
    isConsumerCreditDebugRow,
    collectRowsForRevenueDebug,
    buildRevenueDebugCellSnapshot,
    buildConsumerCreditFormulaDebugSnapshot,
    logConsumerCreditSaveDebug,
    collectVisibleMixRowsForDiagnostics,
    logSalesMixFormulaDiagnostics,
    scheduleManagementRateInputScopeDiagnostics,
    logManagementRateInputScopeDiagnostics,
    buildAllRealColumns,
    loadFormulaSourceDetail,
  };
}
