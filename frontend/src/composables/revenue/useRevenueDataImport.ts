/**
 * 收益填报页·数据导入 composable
 *
 * 负责下载填报模板、Excel 解析回填/清空、计算格覆盖公式对比。
 * 原 mixin: data-import.mixin.js
 */
import { nextTick } from "vue";
import { ElMessage } from "element-plus";
import {
  formatRevenueTableCellValue,
  isSavableMatrixColumn,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import { parseRevenueImportWorkbookFile } from "@/pages/revenue/subtable-workbench/excel-template-parser";
import {
  buildRevenueImportTemplateDataColumns,
  buildRevenueImportTemplateFileName,
  downloadRevenueImportTemplateFile,
} from "@/pages/revenue/subtable-workbench/excel-template-exporter";
import { normalizeExcelCellForRevenue } from "@/pages/revenue/subtable-workbench/value-normalizer";
import {
  buildRndInvestmentAmountColumns,
  isRndAmountCellKey,
  isRndDirectYearInputRow,
  isRndDoubleAmountSourceRow,
  matchRndInvestmentAmountColumnByHeader,
} from "@/pages/revenue/subtable-workbench/formula-engine";
import type {
  RevenueFillState,
  MatrixRow,
  MatrixColumn,
  TrimOption,
  ParsedImportWorkbook,
  DataImportRootSubjectOption,
  ModuleSection,
} from "@/types/revenue";

type DraftSaveResult = { ok?: boolean; [key: string]: unknown };

/** 其他 composable 依赖注入 */
export interface DataImportDeps {
  resolveMatrixRow: (row: MatrixRow) => MatrixRow;
  isEditableInputRow: (row: MatrixRow) => boolean;
  isComputedRow: (row: MatrixRow) => boolean;
  isColumnFillableByInputScope: (row: MatrixRow, column: MatrixColumn) => boolean;
  isYearOnlyRow: (row: MatrixRow) => boolean;
  isRndInvestmentSourceRow: (row: MatrixRow) => boolean;
  isRndExpenseRow: (row: MatrixRow) => boolean;
  isSubjectTreeParent: (row: MatrixRow) => boolean;
  getCellValue: (row: MatrixRow, column: MatrixColumn) => string;
  getEditableCellValue: (row: MatrixRow, column: MatrixColumn) => string;
  displayCellValue: (row: MatrixRow, column: MatrixColumn) => string;
  buildCellDraftKey: (row: MatrixRow, column: MatrixColumn) => string;
  resolveCellLegacyKey: (column: MatrixColumn) => string;
  resolveCellValueRow: (row: MatrixRow, column: MatrixColumn) => MatrixRow;
  updateCellValueLocally: (row: MatrixRow, column: MatrixColumn, value: unknown) => void;
  clearCellInputDraft: (row: MatrixRow, column: MatrixColumn) => void;
  validatePercentDisplayInput: (
    row: MatrixRow,
    value: string,
    options?: { max?: number },
  ) => { ok: boolean; value?: string; message?: string };
  normalizeSubjectId: (value: unknown) => string;
  normalizeExactSubjectName: (value: unknown) => string;
  displayUiText: (value: unknown) => string;
  compareIdText: (a: unknown, b: unknown) => number;
  applyCurrentDetailFormulas: () => unknown;
  sectionVisibleActiveColumns?: (section: ModuleSection) => MatrixColumn[];
  saveFillCellValue: (row: MatrixRow, column: MatrixColumn, value: unknown) => Promise<DraftSaveResult>;
  queueDraftSaveOperation: <T>(runSave: () => Promise<T>) => Promise<T>;
}

interface DataImportCellMeta {
  address?: string;
  isBlank?: boolean;
  isError?: boolean;
  formula?: boolean;
  textValue?: string;
  numberValue?: number;
  rawValue?: unknown;
  displayValue?: string;
  valueType?: string;
}

interface DataImportRowData {
  rowIndex: number;
  group?: string;
  rawGroup?: string;
  item: string;
  values?: Record<string, Record<string, DataImportCellMeta>>;
}

interface ImportColumnVariant {
  key: string;
  name: string;
  cellKey?: string;
  rndInvestmentAmount?: boolean;
  rndAmountKind?: string;
}

interface DataImportCompareMeta {
  originalValue: unknown;
  originalDisplay: string;
  importValue: unknown;
  importDisplay: string;
  formulaRow: boolean;
  alreadyLocked: boolean;
}

interface ImportColumnGroup {
  year: string;
  variants: ImportColumnVariant[];
  rndInvestmentAmountGroup?: boolean;
}

interface ImportTableSheet {
  rows: DataImportRowData[];
  columns: ImportColumnGroup[];
}

interface DataImportTarget {
  row: MatrixRow;
  column: MatrixColumn;
  value: unknown;
  displayValue: string;
  rowIndex: number;
  address: string;
}

interface DataImportLeafSubject extends MatrixRow {
  id: string;
  subjectId: string;
  subjectName: string;
  name: string;
  subjectPath: string[];
  fullPath: string[];
  fullPathKey: string;
  rootSubjectId: string;
  rootSubjectName: string;
}

interface SubjectPathMatcher {
  rootPath: string[];
  leafByPath: Map<string, MatrixRow>;
  leafByFullPath: Map<string, MatrixRow & { fullPath: string[]; fullPathKey: string }>;
  leafByName: Map<string, MatrixRow[]>;
  parentByPath: Map<string, string[]>;
  parentPathsByName: Map<string, string[][]>;
}

export function useRevenueDataImport(state: RevenueFillState, deps: DataImportDeps) {

  // ============================================================
  // 科目路径工具
  // ============================================================

  function normalizeSubjectPathParts(parts: unknown): string[] {
    return (Array.isArray(parts) ? parts : [])
      .map((item) => deps.normalizeExactSubjectName(item))
      .filter(Boolean);
  }

  function normalizeSubjectMatchText(value: unknown): string {
    return deps
      .normalizeExactSubjectName(value)
      .replace(/（/g, "(")
      .replace(/）/g, ")")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function buildSubjectPathKey(parts: string[]): string {
    return normalizeSubjectPathParts(parts)
      .map((item) => normalizeSubjectMatchText(item))
      .filter(Boolean)
      .join("/");
  }

  function isSameSubjectPathPrefix(pathParts: string[], prefixParts: string[]): boolean {
    const pathKeys = normalizeSubjectPathParts(pathParts).map((item) =>
      normalizeSubjectMatchText(item),
    );
    const prefixKeys = normalizeSubjectPathParts(prefixParts).map((item) =>
      normalizeSubjectMatchText(item),
    );
    if (!prefixKeys.length || prefixKeys.length > pathKeys.length) return false;
    return prefixKeys.every((item, index) => pathKeys[index] === item);
  }

  // ============================================================
  // 叶子科目构建
  // ============================================================

  /** 优先用同步后的 filteredRows，空则回退 detail.rows，避免迁移后选项恒空 */
  function resolveDataImportSourceRows(): MatrixRow[] {
    const filtered = Array.isArray(state.filteredRows) ? state.filteredRows : [];
    if (filtered.length) return filtered;
    const detailRows = state.detail && Array.isArray(state.detail.rows) ? state.detail.rows : [];
    return detailRows as MatrixRow[];
  }

  function buildDataImportLeafSubjects(
    options: { includeReadonly?: boolean } = {},
  ): DataImportLeafSubject[] {
    const includeReadonly = Boolean(options.includeReadonly);
    return resolveDataImportSourceRows()
      .filter((row) => includeReadonly || deps.isEditableInputRow(row))
      .map((row) => {
        const subjectId = deps.normalizeSubjectId(
          row.subjectId || row.id || row.rowId,
        );
        const subjectName = deps.normalizeExactSubjectName(
          row.subjectName || row.subject || subjectId,
        );
        const subjectPath = resolveDataImportRowSubjectPath(row);
        const fullPath = resolveDataImportRowFullPath(row, subjectPath);
        const rootSubjectName = deps.normalizeExactSubjectName(
          row.rootSubjectName ||
          (row as Record<string, unknown>).__moduleRootName ||
          subjectPath[0] ||
          row.subtable ||
          "未分组",
        );
        const rootSubjectId = deps.normalizeSubjectId(
          row.rootSubjectId || (row as Record<string, unknown>).__moduleRootId || rootSubjectName,
        );
        return {
          ...row,
          id: subjectId,
          subjectId,
          subjectName,
          name: subjectName,
          subjectPath,
          fullPath,
          fullPathKey: buildSubjectPathKey(fullPath),
          rootSubjectId,
          rootSubjectName,
        };
      })
      .filter((item) => item.subjectId && item.subjectPath.length);
  }

  function resolveDataImportRowSubjectPath(row: MatrixRow): string[] {
    const candidates = [
      row.full_path,
      row.fullPath,
      row.fullNamePath,
      row.subjectTreePath,
      row.subjectPath,
      row.path,
    ];
    let path: string[] = [];
    for (const source of candidates) {
      if (Array.isArray(source)) {
        path = source as string[];
      } else if (String(source || "").trim()) {
        path = String(source || "")
          .replace(/\\/g, "/")
          .split("/");
      }
      path = normalizeSubjectPathParts(path);
      if (path.length) break;
    }
    const rootName = deps.normalizeExactSubjectName(
      row.rootSubjectName || row.subtable || (row as Record<string, unknown>).__moduleRootName,
    );
    const leafName = deps.normalizeExactSubjectName(
      row.subjectName || row.subject || row.id || row.subjectId,
    );
    if (!path.length && leafName) path = [leafName];
    if (rootName && path[0] !== rootName) path = [rootName, ...path];
    return path;
  }

  function readDataImportFullPathParts(source: Record<string, unknown>): string[] {
    const candidates = [
      source.full_path,
      source.fullPath,
      source.fullNamePath,
      source.subject_full_path,
      source.subjectFullPath,
    ];
    for (const value of candidates) {
      if (Array.isArray(value)) {
        const path = normalizeSubjectPathParts(value);
        if (path.length) return path;
      }
      const text = deps.normalizeExactSubjectName(value);
      if (!text) continue;
      const path = normalizeSubjectPathParts(text.replace(/\\/g, "/").split(/[/>＞]/));
      if (path.length) return path;
    }
    return [];
  }

  function resolveDataImportRowFullPath(
    row: MatrixRow,
    subjectPath: string[],
  ): string[] {
    const explicitPath = readDataImportFullPathParts(row as Record<string, unknown>);
    if (explicitPath.length) return explicitPath;
    return normalizeSubjectPathParts(subjectPath);
  }

  // ============================================================
  // 根科目选项
  // ============================================================

  function buildDataImportRootSubjectOptions(): DataImportRootSubjectOption[] {
    const map: Record<string, DataImportRootSubjectOption> = {};
    buildDataImportLeafSubjects({ includeReadonly: true })
      .filter((row) => isDataImportTemplateRow(row))
      .forEach((row) => {
      const rootSubjectId = deps.normalizeSubjectId(
        row.rootSubjectId || (row as Record<string, unknown>).__moduleRootId,
      );
      const rootSubjectName = deps.normalizeExactSubjectName(
        row.rootSubjectName ||
        (row as Record<string, unknown>).__moduleRootName ||
        row.subtable ||
        "未分组",
      );
      const id = rootSubjectId || rootSubjectName;
      if (!id) return;
      if (!map[id]) {
        map[id] = {
          id,
          rootSubjectId,
          rootSubjectName,
          label: deps.displayUiText(rootSubjectName || id),
          leafCount: 0,
          sortOrder: Number((row as Record<string, unknown>).rootSortOrder || 0),
        };
      }
      map[id].leafCount += 1;
    });
    return Object.values(map).sort((left, right) => {
      const sortDiff = left.sortOrder - right.sortOrder;
      if (sortDiff !== 0) return sortDiff;
      return deps.compareIdText(left.id, right.id);
    });
  }

  function collectDataImportTemplateLeafSubjects(
    rootSubject: DataImportRootSubjectOption,
  ): DataImportLeafSubject[] {
    return filterDataImportLeafSubjectsByRootSubject(
      buildDataImportLeafSubjects({ includeReadonly: true }),
      rootSubject,
    ).filter((row) => isDataImportTemplateRow(row));
  }

  function filterDataImportLeafSubjectsByRootSubject(
    leafSubjects: DataImportLeafSubject[],
    rootSubject: DataImportRootSubjectOption,
  ): DataImportLeafSubject[] {
    const rootSubjectId = deps.normalizeSubjectId(
      rootSubject && (rootSubject.rootSubjectId || rootSubject.id),
    );
    const rootSubjectName = deps.normalizeExactSubjectName(
      rootSubject && rootSubject.rootSubjectName,
    );
    return leafSubjects.filter((item) => {
      const itemRootId = deps.normalizeSubjectId(
        item.rootSubjectId || (item as Record<string, unknown>).__moduleRootId,
      );
      const itemRootName = deps.normalizeExactSubjectName(
        item.rootSubjectName ||
        (item as Record<string, unknown>).__moduleRootName ||
        item.subtable,
      );
      return (
        (rootSubjectId && itemRootId === rootSubjectId) ||
        (rootSubjectName && itemRootName === rootSubjectName)
      );
    });
  }

  // ============================================================
  // 科目匹配器
  // ============================================================

  function buildDataImportSubjectPathMatcher(
    leafSubjects: DataImportLeafSubject[],
    rootSubject: DataImportRootSubjectOption,
  ): SubjectPathMatcher {
    const leafByPath = new Map<string, MatrixRow>();
    const leafByFullPath = new Map<string, MatrixRow & { fullPath: string[]; fullPathKey: string }>();
    const leafByName = new Map<string, MatrixRow[]>();
    const parentByPath = new Map<string, string[]>();
    const parentPathsByName = new Map<string, string[][]>();
    const rootName = rootSubject.rootSubjectName || "";
    const rootPath = rootName ? [rootName] : [];

    leafSubjects.forEach((item) => {
      const subjectPath = normalizeSubjectPathParts(
        item.subjectPath && item.subjectPath.length
          ? item.subjectPath
          : [item.rootSubjectName, item.subjectName || item.name],
      );
      if (!subjectPath.length) return;

      const leafKey = buildSubjectPathKey(subjectPath);
      leafByPath.set(leafKey, item);

      const fullPath = normalizeDataImportComparableFullPath(
        item.fullPath && item.fullPath.length ? item.fullPath : subjectPath,
        rootSubject,
      );
      const fullPathKey = buildSubjectPathKey(fullPath);
      if (fullPathKey) {
        leafByFullPath.set(fullPathKey, {
          ...item,
          fullPath,
          fullPathKey,
        } as MatrixRow & { fullPath: string[]; fullPathKey: string });
      }

      const leafNameKey = normalizeSubjectMatchText(subjectPath[subjectPath.length - 1]);
      if (leafNameKey) {
        if (!leafByName.has(leafNameKey)) leafByName.set(leafNameKey, []);
        leafByName.get(leafNameKey)!.push(item);
      }

      for (let index = 1; index < subjectPath.length; index += 1) {
        const parentPath = subjectPath.slice(0, index);
        const parentKey = buildSubjectPathKey(parentPath);
        if (!parentKey || parentByPath.has(parentKey)) continue;
        parentByPath.set(parentKey, parentPath);
        const parentNameKey = normalizeSubjectMatchText(
          parentPath[parentPath.length - 1],
        );
        if (parentNameKey) {
          if (!parentPathsByName.has(parentNameKey))
            parentPathsByName.set(parentNameKey, []);
          parentPathsByName.get(parentNameKey)!.push(parentPath);
        }
      }
    });

    return { rootPath, leafByPath, leafByFullPath, leafByName, parentByPath, parentPathsByName };
  }

  function normalizeDataImportComparableFullPath(
    pathParts: string[],
    rootSubject: { rootSubjectName?: string },
  ): string[] {
    const path = normalizeSubjectPathParts(pathParts);
    if (!path.length) return [];
    const rootSubjectName = deps.normalizeExactSubjectName(rootSubject?.rootSubjectName);
    const rootKey = normalizeSubjectMatchText(rootSubjectName);
    if (!rootKey) return path;
    const rootIndex = path.findIndex(
      (item) => normalizeSubjectMatchText(item) === rootKey,
    );
    return rootIndex >= 0 ? path.slice(rootIndex) : [rootSubjectName, ...path];
  }

  function findDataImportParentPathByName(
    name: string,
    basePath: string[],
    matcher: SubjectPathMatcher,
  ): string[] | null {
    const nameKey = normalizeSubjectMatchText(name);
    if (!nameKey || !matcher.parentPathsByName) return null;
    const candidates = matcher.parentPathsByName.get(nameKey) || [];
    const scoped = candidates
      .filter((item) => isSameSubjectPathPrefix(item, basePath || []))
      .sort((a, b) => a.length - b.length);
    return scoped[0] || null;
  }

  // ============================================================
  // 对话框操作
  // ============================================================

  function openDataImportDialog() {
    if (state.currentStageCode !== "S1") {
      ElMessage.warning("只有 S1 阶段支持数据导入");
      return;
    }
    if (!state.canEditFill) {
      ElMessage.warning("当前账号无可导入科目");
      return;
    }
    const options = buildDataImportRootSubjectOptions();
    if (!options.length) {
      ElMessage.warning("当前账号暂无可导入模板");
      return;
    }
    if (
      !state.dataImportRootSubjectId ||
      !options.some((item) => item.id === state.dataImportRootSubjectId)
    ) {
      state.dataImportRootSubjectId = options[0].id;
    }
    state.dataImportDialogVisible = true;
  }

  function downloadDataImportTemplate() {
    const rootSubject = resolveSelectedDataImportRootSubject();
    if (!rootSubject) {
      ElMessage.warning("请选择导入模块");
      return;
    }
    const leafSubjects = collectDataImportTemplateLeafSubjects(rootSubject);
    if (!leafSubjects.length) {
      ElMessage.warning("当前导入模块下没有可导入科目");
      return;
    }
    const years = (state.dimensions?.years || [])
      .map((item) => deps.normalizeExactSubjectName(item))
      .filter(Boolean);
    if (!years.length) {
      ElMessage.warning("当前页面没有可导出的年份列");
      return;
    }
    const yearOnly = leafSubjects.every((row) => deps.isYearOnlyRow(row));
    const trims = yearOnly ? [] : (state.trimOptions || []);
    if (!yearOnly && !trims.length) {
      ElMessage.warning("当前模块没有可导出的版型列");
      return;
    }
    const includeRndAmountColumns = leafSubjects.some((row) =>
      deps.isRndInvestmentSourceRow(row),
    );
    const dataColumns = buildRevenueImportTemplateDataColumns({
      years,
      trims,
      yearOnly,
      includeRndAmountColumns,
    }) as Array<{ year: string; trimName: string; rndInvestmentAmount?: boolean }>;
    const rows = leafSubjects.map((row) => {
      const comparablePath = normalizeDataImportComparableFullPath(
        row.fullPath && row.fullPath.length ? row.fullPath : row.subjectPath,
        rootSubject,
      );
      const fullPath = comparablePath.join("/");
      if (!fullPath) return null;
      return {
        fullPath,
        subjectName: row.subjectName || comparablePath[comparablePath.length - 1] || "",
        values: dataColumns.map((column) => resolveTemplateExportCellValue(row, column)),
      };
    }).filter(Boolean);
    if (!rows.length) {
      ElMessage.warning("当前导入模块下没有可导出的科目路径");
      return;
    }
    try {
      const moduleName = deps.displayUiText(
        rootSubject.rootSubjectName || rootSubject.label || rootSubject.id || "填报模板",
      );
      const projectName =
        String((state.project && state.project.projectName) || state.queryProjectName || "收益测算项目");
      const fileName = downloadRevenueImportTemplateFile({
        fileName: buildRevenueImportTemplateFileName({
          projectName,
          moduleName,
        }),
        years,
        trims,
        yearOnly,
        includeRndAmountColumns,
        rows,
      });
      ElMessage.success(`已下载 ${fileName}，填写后请再选择文件导入`);
    } catch (error) {
      ElMessage.error((error as Error).message || "下载模板失败");
    }
  }

  function resolveSelectedDataImportRootSubject(): DataImportRootSubjectOption | null {
    const options = buildDataImportRootSubjectOptions();
    const targetId = String(state.dataImportRootSubjectId || "").trim();
    return options.find((item) => item.id === targetId) || null;
  }

  function resolveTemplateExportCellValue(
    row: MatrixRow,
    column: { year?: string; trimName?: string; rndInvestmentAmount?: boolean } = {},
  ): string {
    const columnGroup = { year: String(column.year || ""), variants: [] };
    const variant = {
      key: String(column.trimName || ""),
      name: String(column.trimName || ""),
      rndInvestmentAmount: Boolean(column.rndInvestmentAmount),
    };
    const targetColumn = resolveDataImportTargetColumn(row, columnGroup, variant, 0, 0);
    if (!targetColumn) return "";
    const confirmOverwrite = isDataImportConfirmOverwriteRow(row);
    if (confirmOverwrite) {
      if (!isDataImportOverwriteTarget(row, targetColumn)) return "";
    } else {
      if (!isDataImportEditableTarget(row, targetColumn)) return "";
      if (isDataImportFormulaLockedTarget(row, targetColumn)) return "";
    }
    const text = deps.getEditableCellValue(row, targetColumn);
    return text == null || String(text).trim() === "" ? "" : String(text);
  }

  // ============================================================
  // 文件处理
  // ============================================================

  async function handleDataImportFileChange(
    event: Event,
    getSelectedRootSubject: () => DataImportRootSubjectOption | null,
  ) {
    const input = event && (event.target as HTMLInputElement | null);
    const file = input?.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      ElMessage.error("仅支持导入 xlsx、xls 格式文件");
      return;
    }
    state.dataImporting = true;
    try {
      const parsedWorkbook = await parseRevenueImportWorkbookFile(file) as ParsedImportWorkbook;
      const rootSubject = getSelectedRootSubject();
      if (!rootSubject) {
        ElMessage.warning("请选择导入模板");
        return;
      }
      const result = prepareSubtableDataImport(parsedWorkbook, rootSubject);
      const overwriteCount = (result.overwriteCandidates || []).length;
      if (!result.targets.length && !overwriteCount) {
        const ignoredText = result.ignoredCells.length
          ? `，已忽略 ${result.ignoredCells.length} 个不可填报单元格`
          : "";
        const message =
          result.unmatchedSubjects.length || result.skippedCells.length
            ? `未解析到可回填单元格：未匹配 ${result.unmatchedSubjects.length} 条，跳过 ${result.skippedCells.length} 个单元格`
            : `未解析到可回填数据${ignoredText}，请确认可填字段已填写数值`;
        ElMessage.warning(message);
        return;
      }
      clearDataImportCompareState();
      applySubtableDataImportTargets(result.targets);
      const compareCount = attachDataImportOverwriteCandidates(result.overwriteCandidates);
      state.dataImportDialogVisible = false;
      const ignoredText = result.ignoredCells.length
        ? `；已忽略 ${result.ignoredCells.length} 个不可填报单元格`
        : "";
      const compareText = compareCount
        ? `；${compareCount} 个计算格可对比导入值并选择是否覆盖公式（默认否）`
        : "";
      ElMessage.success(
        `已解析 ${file.name}，回填/清空 ${result.targets.length} 个单元格${compareText}；未匹配 ${result.unmatchedSubjects.length} 条，跳过 ${result.skippedCells.length} 个${ignoredText}。请确认后保存草稿。`,
      );
    } catch (error) {
      ElMessage.error((error as Error).message || "数据导入解析失败");
    } finally {
      state.dataImporting = false;
      if (input) input.value = "";
    }
  }

  // ============================================================
  // 数据导入核心
  // ============================================================

  function buildDataImportRowLookup(): Record<string, MatrixRow> {
    const map: Record<string, MatrixRow> = {};
    resolveDataImportSourceRows().forEach((row) => {
      const subjectId = deps.normalizeSubjectId(
        row.subjectId || row.id || row.rowId,
      );
      if (subjectId && !map[subjectId]) {
        map[subjectId] = row;
      }
    });
    return map;
  }

  function resolveDataImportTemplateExplicitFullPath(
    row: DataImportRowData,
    matcher: SubjectPathMatcher,
  ): string[] {
    const fullPath = readDataImportFullPathParts(row as unknown as Record<string, unknown>);
    if (!fullPath.length) return [];
    const rootPath = matcher.rootPath || [];
    return normalizeDataImportComparableFullPath(fullPath, {
      rootSubjectName: rootPath[0] || "",
    });
  }

  function buildDataImportTemplateFallbackFullPath(
    row: DataImportRowData,
    matcher: SubjectPathMatcher,
  ): string[] {
    const itemName = deps.normalizeExactSubjectName(row.item);
    if (!itemName) return [];
    const rootPath = normalizeSubjectPathParts(matcher.rootPath || []);
    const groupName = deps.normalizeExactSubjectName(row.group || row.rawGroup);
    const path = rootPath.slice();
    const rootTailKey = normalizeSubjectMatchText(path[path.length - 1]);
    const groupKey = normalizeSubjectMatchText(groupName);
    const itemKey = normalizeSubjectMatchText(itemName);
    if (groupName && groupKey !== itemKey && groupKey !== rootTailKey) {
      path.push(groupName);
    }
    path.push(itemName);
    return normalizeDataImportComparableFullPath(path, {
      rootSubjectName: rootPath[0] || "",
    });
  }

  function resolveDataImportTemplateRowSubject(
    row: DataImportRowData,
    state: { groupPath: string[]; contextPath: string[] },
    matcher: SubjectPathMatcher,
  ): {
    skip?: boolean;
    isParentRow?: boolean;
    subject?: MatrixRow | null;
    reason?: string;
    mappingPath?: string[];
  } {
    const itemName = deps.normalizeExactSubjectName(row.item);
    const rawGroupName = deps.normalizeExactSubjectName(row.rawGroup);
    if (!itemName) return { skip: true };

    const rootPath = matcher.rootPath || [];
    const explicitFullPath = resolveDataImportTemplateExplicitFullPath(row, matcher);
    if (rawGroupName) {
      const groupParentPath = findDataImportParentPathByName(rawGroupName, rootPath, matcher);
      state.groupPath = groupParentPath || rootPath;
      state.contextPath = state.groupPath;
    }

    const groupPath = state.groupPath || rootPath;
    const contextPath = state.contextPath || groupPath || rootPath;
    const candidatePaths = [
      explicitFullPath,
      buildDataImportTemplateFallbackFullPath(row, matcher),
      contextPath.concat(itemName),
      groupPath.concat(itemName),
      rootPath.concat(itemName),
    ].filter((item) => Array.isArray(item) && item.length);

    for (const pathParts of candidatePaths) {
      const fullPathKey = buildSubjectPathKey(pathParts);
      const subject = matcher.leafByFullPath.get(fullPathKey) || matcher.leafByPath.get(fullPathKey);
      if (subject) return { subject, mappingPath: pathParts };
    }

    const directParentPath =
      matcher.parentByPath.get(buildSubjectPathKey(contextPath.concat(itemName))) ||
      matcher.parentByPath.get(buildSubjectPathKey(groupPath.concat(itemName))) ||
      findDataImportParentPathByName(itemName, groupPath, matcher) ||
      findDataImportParentPathByName(itemName, rootPath, matcher);
    if (directParentPath) {
      state.contextPath = directParentPath;
      return { skip: true, isParentRow: true };
    }

    return { subject: null, reason: "当前科目树中未找到 full_path 对应科目" };
  }

  function getDataImportRowCellMeta(
    row: DataImportRowData,
    columnGroup: ImportColumnGroup,
    variant: ImportColumnVariant,
  ): DataImportCellMeta | undefined {
    return row.values?.[columnGroup.year]?.[variant.key];
  }

  function hasDataImportRowValue(
    row: DataImportRowData,
    selectedTable: ImportTableSheet,
  ): boolean {
    return selectedTable.columns.some((columnGroup) =>
      columnGroup.variants.some((variant) => {
        const cellMeta = getDataImportRowCellMeta(row, columnGroup, variant);
        return Boolean(cellMeta && !cellMeta.isBlank);
      }),
    );
  }

  function collectIgnoredDataImportCells(
    row: DataImportRowData,
    selectedTable: ImportTableSheet,
    bucket: Array<{ rowIndex: number; item: string; address: string; reason: string }>,
    reason = "目标单元格不可填报",
  ) {
    selectedTable.columns.forEach((columnGroup) => {
      columnGroup.variants.forEach((variant) => {
        const cellMeta = getDataImportRowCellMeta(row, columnGroup, variant);
        if (!cellMeta || cellMeta.isBlank) return;
        bucket.push({
          rowIndex: row.rowIndex,
          item: row.item,
          address: cellMeta.address || "",
          reason,
        });
      });
    });
  }

  function resolveDataImportYearTarget(
    columnGroup: ImportColumnGroup,
    _yearIndex: number,
  ): { yearLabel: string; yearIndex: number } | null {
    const years = state.dimensions?.years || [];
    if (!years.length) return null;
    const rawLabel = deps.normalizeExactSubjectName(columnGroup.year);
    const rawKey = normalizeSubjectMatchText(rawLabel);
    const exactIndex = years.findIndex(
      (year) => normalizeSubjectMatchText(year) === rawKey,
    );
    if (exactIndex >= 0) {
      return { yearLabel: years[exactIndex], yearIndex: exactIndex };
    }
    const explicitYearMatch = String(columnGroup.year || "").match(/(19|20)\d{2}/);
    if (explicitYearMatch) {
      const yearValue = Number(explicitYearMatch[0]);
      const numericIndex = years.findIndex((year) => {
        const matched = String(year || "").match(/(19|20)\d{2}/);
        return matched && Number(matched[0]) === yearValue;
      });
      if (numericIndex >= 0) {
        return { yearLabel: years[numericIndex], yearIndex: numericIndex };
      }
    }
    return null;
  }

  function resolveDataImportTrimTarget(
    variant: ImportColumnVariant,
    _variantIndex: number,
    row: MatrixRow,
  ): { trimId: string; trimName: string; trimIndex: number } | null {
    if (deps.isYearOnlyRow(row)) {
      return { trimId: "", trimName: "", trimIndex: 0 };
    }
    // 统一为 TrimOption[]，避免 unknown[] 导致 findIndex 回调与属性访问类型失败
    const trims: TrimOption[] =
      Array.isArray(state.trimOptions) && state.trimOptions.length
        ? (state.trimOptions as TrimOption[])
        : Array.isArray((state.detail as Record<string, unknown>)?.trimOptions)
          ? ((state.detail as Record<string, unknown>).trimOptions as TrimOption[])
          : [];
    if (!trims.length) return null;
    const variantName = normalizeSubjectMatchText(variant.name);
    const exactIndex = trims.findIndex((trim) => {
      return [trim.trimName, trim.trimId, String(trim.id || "")]
        .map((item) => normalizeSubjectMatchText(item))
        .some((item) => item && item === variantName);
    });
    if (exactIndex < 0) return null;
    const trim = trims[exactIndex];
    if (!trim) return null;
    const rawTrimId =
      trim.trimId !== undefined && trim.trimId !== null && String(trim.trimId).trim() !== ""
        ? trim.trimId
        : trim.id !== undefined && trim.id !== null && String(trim.id).trim() !== ""
          ? String(trim.id)
          : exactIndex;
    return {
      trimId: String(rawTrimId).trim(),
      trimName: String(trim.trimName || trim.name || trim.trimId || "").trim(),
      trimIndex: Number.isFinite(Number(trim.trimIndex))
        ? Number(trim.trimIndex)
        : exactIndex,
    };
  }

  function resolveDataImportTargetColumn(
    row: MatrixRow,
    columnGroup: ImportColumnGroup,
    variant: ImportColumnVariant,
    yearIndex: number,
    variantIndex: number,
  ): MatrixColumn | null {
    // 研发投资「投资总额-含税/不含税」：不走年份×版型匹配
    const amountColumn = resolveDataImportRndAmountTargetColumn(variant, columnGroup);
    if (amountColumn) {
      return amountColumn;
    }
    const yearTarget = resolveDataImportYearTarget(columnGroup, yearIndex);
    if (!yearTarget) return null;
    const trimTarget = resolveDataImportTrimTarget(variant, variantIndex, row);
    if (!trimTarget) return null;
    return {
      key: `y${yearTarget.yearIndex}_t${trimTarget.trimId || trimTarget.trimIndex}`,
      label: trimTarget.trimName || yearTarget.yearLabel,
      yearLabel: yearTarget.yearLabel,
      yearIndex: yearTarget.yearIndex,
      trimId: trimTarget.trimId,
      trimName: trimTarget.trimName,
      trimIndex: trimTarget.trimIndex,
      real: true,
      displayOnly: false,
      aggregateMode: "NONE",
      yearOnly: deps.isYearOnlyRow(row),
    };
  }

  /**
   * 解析研发投资投资总额列；仅当表头/解析标记命中含税或不含税时返回。
   */
  function resolveDataImportRndAmountTargetColumn(
    variant: ImportColumnVariant = { key: "", name: "" },
    columnGroup: ImportColumnGroup = { year: "", variants: [] },
  ): MatrixColumn | null {
    const columns = buildRndInvestmentAmountColumns() as MatrixColumn[];
    let matched: MatrixColumn | null | undefined;
    if (variant && variant.rndInvestmentAmount) {
      matched =
        columns.find((item) => item.cellKey === (variant.cellKey || variant.key)) ||
        columns.find((item) => item.rndAmountKind === variant.rndAmountKind) ||
        matchRndInvestmentAmountColumnByHeader(variant.name) ||
        null;
    } else {
      matched = matchRndInvestmentAmountColumnByHeader(variant && variant.name);
      // 形态 A：年份行写全名、版型行为空时，variant.name 可能已被解析器写成规范名
      if (!matched && !(variant && String(variant.name || "").trim())) {
        matched = matchRndInvestmentAmountColumnByHeader(columnGroup && columnGroup.year);
      }
    }
    if (!matched) return null;
    return {
      ...matched,
      key: String(matched.cellKey || matched.key),
      cellKey: String(matched.cellKey || matched.key),
      label: String(matched.label || matched.trimName),
      yearLabel: "",
      yearIndex: -1,
      trimIndex: Number(matched.trimIndex),
      real: true,
      displayOnly: false,
      rndInvestmentAmount: true,
    };
  }

  function isDataImportRndAmountColumn(column: MatrixColumn | Record<string, unknown> = {}): boolean {
    return Boolean(
      column &&
        (column.rndInvestmentAmount ||
          isRndAmountCellKey(String(column.cellKey || column.key || ""))),
    );
  }

  function isDataImportEditableTarget(row: MatrixRow, column: MatrixColumn): boolean {
    if (!row || !column) return false;
    if (!isDataImportEditableRow(row)) return false;
    // 投资总额列：仅双金额研发投资源行可导入，避免误写入年款/其它子表
    if (isDataImportRndAmountColumn(column)) {
      return deps.isRndInvestmentSourceRow(row);
    }
    // 各年份版型列：仅「年款」「中期改款」「其他」可导入，其余科目有数也忽略
    if (
      isDataImportRndYearTrimRestrictedRow(row) &&
      !isDataImportRndDirectYearInputRow(row)
    ) {
      return false;
    }
    if (!isSavableMatrixColumn(column as unknown as Record<string, unknown>)) return false;
    return deps.isColumnFillableByInputScope(row, column);
  }

  function isDataImportOverwriteTarget(row: MatrixRow, column: MatrixColumn): boolean {
    if (!row || !column) return false;
    if (!isDataImportConfirmOverwriteRow(row)) return false;
    if (isDataImportRndAmountColumn(column)) {
      return deps.isRndInvestmentSourceRow(row);
    }
    return isSavableMatrixColumn(column as unknown as Record<string, unknown>);
  }

  function isDataImportRndYearTrimRestrictedRow(row: MatrixRow): boolean {
    if (deps.isRndExpenseRow(row)) return true;
    return isRndDoubleAmountSourceRow(row) || isRndDirectYearInputRow(row);
  }

  function isDataImportRndDirectYearInputRow(row: MatrixRow): boolean {
    return isRndDirectYearInputRow(row);
  }

  function resolveDataImportIgnoreReason(row: MatrixRow, column: MatrixColumn): string {
    if (
      !isDataImportRndAmountColumn(column) &&
      isDataImportRndYearTrimRestrictedRow(row) &&
      !isDataImportRndDirectYearInputRow(row)
    ) {
      return "研发投资版型列仅支持年款/中期改款/其他导入";
    }
    return "目标单元格不可填报";
  }

  function resolveDataImportUnitRow(row: MatrixRow, column: MatrixColumn): MatrixRow {
    const dataRow = row || ({} as MatrixRow);
    if (!isDataImportRndAmountColumn(column)) {
      return dataRow;
    }
    if (typeof deps.resolveCellValueRow === "function") {
      return deps.resolveCellValueRow(dataRow, column);
    }
    const unit = column && column.unit ? String(column.unit) : "万元";
    return {
      ...dataRow,
      unit,
    };
  }

  function getDataImportCurrentDisplayValue(row: MatrixRow, column: MatrixColumn): string {
    const text =
      typeof deps.getEditableCellValue === "function"
        ? deps.getEditableCellValue(row, column)
        : deps.getCellValue(row, column);
    return text == null ? "" : String(text).trim();
  }

  function readDataImportEntryMode(row: MatrixRow = {} as MatrixRow): string {
    const item =
      row && row.templateItem && typeof row.templateItem === "object"
        ? (row.templateItem as Record<string, unknown>)
        : null;
    return String(
      (item && item.entryMode) ||
        row.templateEntryMode ||
        row.entryMode ||
        "",
    )
      .trim()
      .toUpperCase();
  }

  function isDataImportFormulaOverwriteRow(row: MatrixRow = {} as MatrixRow): boolean {
    const mode = readDataImportEntryMode(row);
    if (mode === "CALCULATED" || mode === "DERIVED") return true;
    if (mode === "DATA_QUERY" || mode === "MANUAL") return false;
    if (row && row.calculated === true) return true;
    return String((row && row.inputType) || "").trim().toLowerCase() === "calc";
  }

  function isDataImportConfirmOverwriteRow(row: MatrixRow): boolean {
    return isDataImportFormulaOverwriteRow(row);
  }

  function isDataImportTemplateRow(row: MatrixRow): boolean {
    if (!row) return false;
    if (isDataImportEditableRow(row)) return true;
    return isDataImportConfirmOverwriteRow(row);
  }

  function resolveDataImportAssignmentBucket(dataRow: MatrixRow): "target" | "overwrite" | "ignore" {
    if (isDataImportEditableRow(dataRow)) return "target";
    if (isDataImportConfirmOverwriteRow(dataRow)) return "overwrite";
    return "ignore";
  }

  function isDataImportFormulaLockedTarget(row: MatrixRow, column: MatrixColumn): boolean {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return false;
    const keys = [
      column.cellKey,
      column.key,
      `y${column.yearIndex}_t${column.trimIndex}`,
      `${String(column.yearLabel || "").trim()}__${String(column.trimId || "").trim()}`,
      `${String(column.yearLabel || "").trim()}__${String(column.trimName || "").trim()}`,
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    const maps = [
      dataRow.formulaLockedCellMap as Record<string, unknown> | undefined,
      dataRow.reviewLockedCellMap as Record<string, unknown> | undefined,
      dataRow.lockedCellMap as Record<string, unknown> | undefined,
    ];
    return maps.some(
      (map) =>
        map &&
        typeof map === "object" &&
        keys.some((key) => Object.prototype.hasOwnProperty.call(map, key)),
    );
  }

  function isDataImportEditableRow(row: MatrixRow): boolean {
    if (!row) return false;
    if (deps.isComputedRow(row)) return false;
    return deps.isEditableInputRow(row);
  }

  function resolveDataImportValue(cellMeta: DataImportCellMeta, row: MatrixRow = {} as MatrixRow) {
    return normalizeExcelCellForRevenue(cellMeta, row as Record<string, unknown>) as {
      displayValue?: string;
      textValue?: string;
      numberValue?: number;
      rawValue?: unknown;
      valueType?: string;
    } | null;
  }

  function resolveDataImportDisplayValue(valuePayload: {
    displayValue?: string;
    textValue?: string;
    numberValue?: number;
    rawValue?: unknown;
    valueType?: string;
  } | null): string {
    if (!valuePayload) return "";
    if (valuePayload.displayValue != null && valuePayload.displayValue !== "") {
      return String(valuePayload.displayValue);
    }
    if (valuePayload.valueType === "NUMBER" && valuePayload.numberValue != null) {
      return String(valuePayload.numberValue);
    }
    return String(valuePayload.textValue || valuePayload.rawValue || "");
  }

  function prepareSubtableDataImport(
    parsedWorkbook: ParsedImportWorkbook,
    rootSubject: DataImportRootSubjectOption,
  ) {
    const selectedTable = parsedWorkbook.tables?.[0];
    if (!selectedTable) {
      throw new Error("未识别到可导入的数据表块");
    }
    const leafSubjects = filterDataImportLeafSubjectsByRootSubject(
      buildDataImportLeafSubjects({ includeReadonly: true }),
      rootSubject,
    );
    if (!leafSubjects.length) {
      throw new Error("当前导入模板下没有可导入科目");
    }
    const subjectMatcher = buildDataImportSubjectPathMatcher(leafSubjects, rootSubject);
    const rowMatchState = {
      groupPath: subjectMatcher.rootPath,
      contextPath: subjectMatcher.rootPath,
    };
    const rowLookup = buildDataImportRowLookup();
    const targets: DataImportTarget[] = [];
    const overwriteCandidates: DataImportTarget[] = [];
    const unmatchedSubjects: Array<{
      rowIndex: number;
      group?: string;
      item: string;
      reason: string;
    }> = [];
    const skippedCells: Array<{
      rowIndex: number;
      item: string;
      address: string;
      reason: string;
    }> = [];
    const ignoredCells: Array<{
      rowIndex: number;
      item: string;
      address: string;
      reason: string;
    }> = [];
    const seenTargetKeys: Record<string, boolean> = {};
    const sheetHasValue = (selectedTable.rows || []).some((row) =>
      hasDataImportRowValue(row, selectedTable),
    );
    if (!sheetHasValue) {
      return {
        targets,
        overwriteCandidates,
        unmatchedSubjects,
        skippedCells,
        ignoredCells,
      };
    }

    selectedTable.rows.forEach((row) => {
      if (!deps.normalizeExactSubjectName(row.item)) return;
      const matchedRow = resolveDataImportTemplateRowSubject(row, rowMatchState, subjectMatcher);
      if (matchedRow.skip) return;
      const subject = matchedRow.subject || null;
      if (!subject) {
        unmatchedSubjects.push({
          rowIndex: row.rowIndex,
          group: row.group,
          item: row.item,
          reason: matchedRow.reason || "当前科目树中未找到对应叶子科目",
        });
        return;
      }
      const subjectId = deps.normalizeSubjectId(
        subject.id || subject.subjectId,
      );
      const dataRow = rowLookup[subjectId];
      if (!dataRow) {
        unmatchedSubjects.push({
          rowIndex: row.rowIndex,
          group: row.group,
          item: row.item,
          reason: "当前页面未找到可回填的科目行",
        });
        return;
      }
      const assignmentBucket = resolveDataImportAssignmentBucket(dataRow);
      if (assignmentBucket === "ignore") {
        collectIgnoredDataImportCells(row, selectedTable, ignoredCells, "目标科目不可填报");
        return;
      }

      selectedTable.columns.forEach((columnGroup, yearIndex) => {
        columnGroup.variants.forEach((variant, variantIndex) => {
          const cellMeta = getDataImportRowCellMeta(row, columnGroup, variant) || {
            isBlank: true,
            isError: false,
            formula: false,
            address: `${(variant && variant.key) || ""}${row.rowIndex || ""}`,
          };
          const column = resolveDataImportTargetColumn(
            dataRow,
            columnGroup,
            variant,
            yearIndex,
            variantIndex,
          );
          if (!column) {
            if (cellMeta.isBlank && !cellMeta.isError) return;
            skippedCells.push({
              rowIndex: row.rowIndex,
              item: row.item,
              address: cellMeta.address || "",
              reason: "未匹配到当前页面年份或版型",
            });
            return;
          }
          const canWriteCell = assignmentBucket === "overwrite"
            ? isDataImportOverwriteTarget(dataRow, column)
            : isDataImportEditableTarget(dataRow, column);
          if (!canWriteCell) {
            if (cellMeta.isBlank && !cellMeta.isError) return;
            ignoredCells.push({
              rowIndex: row.rowIndex,
              item: row.item,
              address: cellMeta.address || "",
              reason: resolveDataImportIgnoreReason(dataRow, column),
            });
            return;
          }
          if (
            assignmentBucket !== "overwrite" &&
            isDataImportFormulaLockedTarget(dataRow, column)
          ) {
            if (cellMeta.isBlank && !cellMeta.isError) return;
            ignoredCells.push({
              rowIndex: row.rowIndex,
              item: row.item,
              address: cellMeta.address || "",
              reason: "目标单元格已锁定公式，保持原值",
            });
            return;
          }
          if (cellMeta.isError) {
            skippedCells.push({
              rowIndex: row.rowIndex,
              item: row.item,
              address: cellMeta.address || "",
              reason: "公式错误值已跳过",
            });
            return;
          }
          const bucket = assignmentBucket === "overwrite" ? overwriteCandidates : targets;
          if (cellMeta.isBlank) {
            if (!getDataImportCurrentDisplayValue(dataRow, column)) return;
            const clearKey = `${subjectId}__${deps.buildCellDraftKey(dataRow, column)}`;
            if (seenTargetKeys[clearKey]) {
              skippedCells.push({
                rowIndex: row.rowIndex,
                item: row.item,
                address: cellMeta.address || "",
                reason: "重复目标单元格已跳过",
              });
              return;
            }
            seenTargetKeys[clearKey] = true;
            bucket.push({
              row: dataRow,
              column,
              value: "",
              displayValue: "",
              rowIndex: row.rowIndex,
              address: cellMeta.address || "",
            });
            return;
          }
          const unitRow = resolveDataImportUnitRow(dataRow, column);
          const valuePayload = resolveDataImportValue(cellMeta, unitRow);
          if (!valuePayload) {
            skippedCells.push({
              rowIndex: row.rowIndex,
              item: row.item,
              address: cellMeta.address || "",
              reason: cellMeta.formula ? "公式无可用计算值已跳过" : "空值已跳过",
            });
            return;
          }
          const rawValue = resolveDataImportDisplayValue(valuePayload);
          const validation = deps.validatePercentDisplayInput(unitRow, rawValue, {
            max: Number.POSITIVE_INFINITY,
          });
          if (!validation.ok) {
            skippedCells.push({
              rowIndex: row.rowIndex,
              item: row.item,
              address: cellMeta.address || "",
              reason: validation.message || "输入值格式不正确",
            });
            return;
          }
          const value = validation.value!;
          const displayValue = formatRevenueTableCellValue(
            unitRow as unknown as Record<string, unknown>,
            value,
          );
          const targetKey = `${subjectId}__${deps.buildCellDraftKey(dataRow, column)}`;
          if (seenTargetKeys[targetKey]) {
            skippedCells.push({
              rowIndex: row.rowIndex,
              item: row.item,
              address: cellMeta.address || "",
              reason: "重复目标单元格已跳过",
            });
            return;
          }
          seenTargetKeys[targetKey] = true;
          bucket.push({
            row: dataRow,
            column,
            value,
            displayValue,
            rowIndex: row.rowIndex,
            address: cellMeta.address || "",
          });
        });
      });
    });

    return {
      targets,
      overwriteCandidates,
      unmatchedSubjects,
      skippedCells,
      ignoredCells,
    };
  }

  function applySubtableDataImportTargets(targets: DataImportTarget[] = []) {
    targets.forEach((target) => {
      const dataRow = deps.resolveMatrixRow(target.row);
      const column = target.column;
      if (!dataRow || !column) return;
      const draftKey = deps.buildCellDraftKey(dataRow, column);
      if (!Object.prototype.hasOwnProperty.call(state.cellInputOriginals, draftKey)) {
        const originalValue = deps.getCellValue(dataRow, column);
        state.cellInputOriginals[draftKey] = String(
          originalValue == null ? "" : originalValue,
        );
      }
      const draftDisplayValue =
        target.displayValue != null ? target.displayValue : String(target.value);
      state.cellInputDrafts[draftKey] = String(
        draftDisplayValue == null ? "" : draftDisplayValue,
      );
      deps.updateCellValueLocally(dataRow, column, target.value);
    });
    deps.applyCurrentDetailFormulas();
  }

  function ensureDataImportCompareMaps() {
    if (!state.dataImportCompareByCell || typeof state.dataImportCompareByCell !== "object") {
      state.dataImportCompareByCell = {};
    }
    if (!state.dataImportFormulaOverwriteByCell || typeof state.dataImportFormulaOverwriteByCell !== "object") {
      state.dataImportFormulaOverwriteByCell = {};
    }
    if (!state.dataImportOverwriteSavingByCell || typeof state.dataImportOverwriteSavingByCell !== "object") {
      state.dataImportOverwriteSavingByCell = {};
    }
  }

  function collectDataImportCompareCellKeys(section: ModuleSection | Record<string, unknown> | null = null) {
    const keys = new Set<string>();
    const appendRowKeys = (row: MatrixRow, columns: MatrixColumn[] = []) => {
      const dataRow = deps.resolveMatrixRow(row);
      if (!dataRow) return;
      (Array.isArray(columns) ? columns : []).forEach((column) => {
        const cellKey = buildDataImportCompareCellKey(dataRow, column);
        if (cellKey) keys.add(cellKey);
      });
    };

    if (section && typeof section === "object") {
      const columns =
        typeof deps.sectionVisibleActiveColumns === "function"
          ? deps.sectionVisibleActiveColumns(section as ModuleSection)
          : [];
      const rows = Array.isArray((section as ModuleSection).treeRows)
        ? (section as ModuleSection).treeRows || []
        : (Array.isArray((section as { rows?: MatrixRow[] }).rows)
          ? (section as { rows?: MatrixRow[] }).rows || []
          : []);
      rows.forEach((row) => appendRowKeys(row, columns));
      return keys;
    }

    Object.keys(state.dataImportCompareByCell || {}).forEach((cellKey) => {
      if (cellKey) keys.add(cellKey);
    });
    return keys;
  }

  function clearDataImportCompareState(options: { section?: ModuleSection | Record<string, unknown> | null } = {}) {
    ensureDataImportCompareMaps();
    const section = options.section || null;
    let keys = collectDataImportCompareCellKeys(section);
    if (
      section &&
      !keys.size &&
      Object.keys(state.dataImportCompareByCell || {}).length
    ) {
      keys = collectDataImportCompareCellKeys(null);
    }
    if (!keys.size) {
      state.dataImportCompareByCell = {};
      state.dataImportFormulaOverwriteByCell = {};
      state.dataImportOverwriteSavingByCell = {};
    } else {
      keys.forEach((cellKey) => {
        delete state.dataImportCompareByCell[cellKey];
        delete state.dataImportFormulaOverwriteByCell[cellKey];
        delete state.dataImportOverwriteSavingByCell[cellKey];
      });
    }
  }

  function finalizeDataImportSessionAfterDraftSave(
    options: { section?: ModuleSection | Record<string, unknown> | null } = {},
  ) {
    clearDataImportCompareState(options);
    void nextTick();
  }

  function buildDataImportCompareCellKey(row: MatrixRow, column: MatrixColumn): string {
    return deps.buildCellDraftKey(row, column);
  }

  function isSameDataImportOverwriteValue(left: unknown, right: unknown): boolean {
    const leftText = String(left == null ? "" : left).trim();
    const rightText = String(right == null ? "" : right).trim();
    if (leftText === rightText) return true;
    const leftNumber = Number(leftText);
    const rightNumber = Number(rightText);
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber;
  }

  function getDataImportCompareMeta(row: MatrixRow, column: MatrixColumn): DataImportCompareMeta | null {
    const cellKey = buildDataImportCompareCellKey(row, column);
    if (!cellKey) return null;
    const meta = state.dataImportCompareByCell && state.dataImportCompareByCell[cellKey];
    return (meta as DataImportCompareMeta) || null;
  }

  function hasDataImportCompareValue(row: MatrixRow, column: MatrixColumn): boolean {
    const meta = getDataImportCompareMeta(row, column);
    return Boolean(meta && meta.importValue != null && meta.importValue !== "");
  }

  function isDataImportFormulaCompareCell(row: MatrixRow, column: MatrixColumn): boolean {
    return (
      isSavableMatrixColumn(column as unknown as Record<string, unknown>) &&
      !deps.isSubjectTreeParent(row) &&
      deps.isComputedRow(row) &&
      hasDataImportCompareValue(row, column)
    );
  }

  function isDataImportFormulaOverwrite(row: MatrixRow, column: MatrixColumn): boolean {
    const cellKey = buildDataImportCompareCellKey(row, column);
    return !!(cellKey && state.dataImportFormulaOverwriteByCell[cellKey]);
  }

  function isDataImportOverwriteSaving(row: MatrixRow, column: MatrixColumn): boolean {
    const cellKey = buildDataImportCompareCellKey(row, column);
    return !!(cellKey && state.dataImportOverwriteSavingByCell[cellKey]);
  }

  function displayDataImportImportValue(row: MatrixRow, column: MatrixColumn): string {
    const meta = getDataImportCompareMeta(row, column);
    if (!meta) return "";
    if (meta.importDisplay != null && String(meta.importDisplay).trim() !== "") {
      return String(meta.importDisplay).trim();
    }
    return formatRevenueTableCellValue(row as unknown as Record<string, unknown>, meta.importValue);
  }

  function displayDataImportFormulaCompareValue(row: MatrixRow, column: MatrixColumn): string {
    if (isDataImportFormulaOverwrite(row, column)) {
      return displayDataImportImportValue(row, column);
    }
    return deps.displayCellValue(row, column);
  }

  function attachDataImportOverwriteCandidates(candidates: DataImportTarget[] = []): number {
    const nextMap: Record<string, DataImportCompareMeta> = {};
    const items: Array<{ cellKey: string; dataRow: MatrixRow; column: MatrixColumn }> = [];
    (Array.isArray(candidates) ? candidates : []).forEach((item) => {
      const dataRow = deps.resolveMatrixRow(item.row);
      const column = item.column;
      if (!dataRow || !column) return;
      const originalDisplay = getDataImportCurrentDisplayValue(dataRow, column);
      const importDisplay = String(item.displayValue == null ? "" : item.displayValue).trim();
      if (originalDisplay === importDisplay) return;
      const cellKey = buildDataImportCompareCellKey(dataRow, column);
      if (!cellKey) return;
      const originalValue = deps.getCellValue(dataRow, column);
      nextMap[cellKey] = {
        originalValue: originalValue == null ? "" : originalValue,
        originalDisplay,
        importValue: item.value,
        importDisplay,
        formulaRow: isDataImportFormulaOverwriteRow(dataRow),
        alreadyLocked: isDataImportFormulaLockedTarget(dataRow, column),
      };
      items.push({ cellKey, dataRow, column });
    });
    syncDataImportComparePreview(nextMap, items);
    return items.length;
  }

  function applyDataImportOverwriteForCell(row: MatrixRow, column: MatrixColumn, overwrite: boolean) {
    const meta = getDataImportCompareMeta(row, column);
    if (!meta || !column) return;
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow) return;
    if (overwrite) {
      if (meta.importValue == null || meta.importValue === "") return;
      if (meta.formulaRow) {
        lockDataImportFormulaCell(dataRow, column, true);
      }
      deps.updateCellValueLocally(dataRow, column, meta.importValue);
      return;
    }
    if (meta.formulaRow && !meta.alreadyLocked) {
      lockDataImportFormulaCell(dataRow, column, false);
    }
    try {
      deps.applyCurrentDetailFormulas();
    } catch (_error) {
      // ignore
    }
  }

  function syncDataImportComparePreview(
    nextMap: Record<string, DataImportCompareMeta> = {},
    items: Array<{ cellKey: string; dataRow: MatrixRow; column: MatrixColumn }> = [],
  ) {
    ensureDataImportCompareMaps();
    const prevOverwrite = { ...(state.dataImportFormulaOverwriteByCell || {}) };
    const contextByKey: Record<string, { cellKey: string; dataRow: MatrixRow; column: MatrixColumn }> = {};
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (item && item.cellKey && item.dataRow && item.column) {
        contextByKey[item.cellKey] = item;
      }
    });

    state.dataImportCompareByCell = nextMap && typeof nextMap === "object" ? { ...nextMap } : {};

    Object.keys(prevOverwrite).forEach((cellKey) => {
      const context = contextByKey[cellKey];
      if (!nextMap[cellKey]) {
        if (prevOverwrite[cellKey] && context) {
          applyDataImportOverwriteForCell(context.dataRow, context.column, false);
        }
        delete state.dataImportFormulaOverwriteByCell[cellKey];
        return;
      }
      if (prevOverwrite[cellKey] && context) {
        state.dataImportFormulaOverwriteByCell[cellKey] = true;
        applyDataImportOverwriteForCell(context.dataRow, context.column, true);
      }
    });

    (Array.isArray(items) ? items : []).forEach((item) => {
      const { cellKey, dataRow, column } = item || {};
      const meta = cellKey && nextMap[cellKey];
      if (!dataRow || !column || !meta) return;
      if (state.dataImportFormulaOverwriteByCell[cellKey]) return;
      const currentValue = deps.getCellValue(dataRow, column);
      if (!isSameDataImportOverwriteValue(currentValue, meta.importValue)) return;
      state.dataImportFormulaOverwriteByCell[cellKey] = true;
      if (meta.formulaRow) {
        lockDataImportFormulaCell(dataRow, column, true);
      }
    });
  }

  function resolveDataImportFormulaLockKeys(column: MatrixColumn = {} as MatrixColumn): string[] {
    const legacyKey =
      typeof deps.resolveCellLegacyKey === "function" ? deps.resolveCellLegacyKey(column) : "";
    return [
      legacyKey,
      column.cellKey,
      column.key,
      `y${column.yearIndex}_t${column.trimIndex}`,
      `${String(column.yearLabel || "").trim()}__${String(column.trimId || "").trim()}`,
      `${String(column.yearLabel || "").trim()}__${String(column.trimName || "").trim()}`,
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index);
  }

  function lockDataImportFormulaCell(row: MatrixRow, column: MatrixColumn, locked: boolean) {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return;
    const keys = resolveDataImportFormulaLockKeys(column);
    if (!keys.length) return;
    if (!dataRow.formulaLockedCellMap || typeof dataRow.formulaLockedCellMap !== "object") {
      dataRow.formulaLockedCellMap = {};
    }
    const lockMap = dataRow.formulaLockedCellMap as Record<string, unknown>;
    keys.forEach((key) => {
      if (locked) lockMap[key] = true;
      else delete lockMap[key];
    });
  }

  function rollbackDataImportFormulaOverwrite(
    dataRow: MatrixRow,
    column: MatrixColumn,
    cellKey: string,
    restoreValue: unknown,
    restoreOverwrite: boolean,
  ) {
    const meta = getDataImportCompareMeta(dataRow, column);
    if (!dataRow || !column || !cellKey || !meta) return;
    if (restoreOverwrite) {
      state.dataImportFormulaOverwriteByCell[cellKey] = true;
      if (meta.formulaRow) {
        lockDataImportFormulaCell(dataRow, column, true);
      }
      deps.updateCellValueLocally(dataRow, column, restoreValue);
      return;
    }
    delete state.dataImportFormulaOverwriteByCell[cellKey];
    if (meta.formulaRow && !meta.alreadyLocked) {
      lockDataImportFormulaCell(dataRow, column, false);
    }
    if (restoreValue != null) {
      deps.updateCellValueLocally(dataRow, column, restoreValue);
    }
    try {
      deps.applyCurrentDetailFormulas();
    } catch (_error) {
      // ignore
    }
  }

  async function onDataImportFormulaOverwriteChange(
    row: MatrixRow,
    column: MatrixColumn,
    overwrite: boolean,
  ) {
    const cellKey = buildDataImportCompareCellKey(row, column);
    if (!cellKey) return;
    const meta = getDataImportCompareMeta(row, column);
    if (!meta) return;
    const next = overwrite === true;
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return;
    const prevOverwrite = !!state.dataImportFormulaOverwriteByCell[cellKey];
    if (prevOverwrite === next) return;
    if (state.dataImportOverwriteSavingByCell[cellKey]) return;

    const draftKey = deps.buildCellDraftKey(dataRow, column);
    state.dataImportOverwriteSavingByCell[cellKey] = true;
    try {
      if (next) {
        const importValue = meta.importValue;
        if (importValue == null || importValue === "") return;
        const originalValue = deps.getCellValue(dataRow, column);
        state.cellInputOriginals[draftKey] = String(originalValue == null ? "" : originalValue);
        state.dataImportFormulaOverwriteByCell[cellKey] = true;
        if (meta.formulaRow) {
          lockDataImportFormulaCell(dataRow, column, true);
        }
        deps.updateCellValueLocally(dataRow, column, importValue);
        try {
          const result = await deps.queueDraftSaveOperation(() =>
            deps.saveFillCellValue(dataRow, column, importValue),
          );
          if (!result || !result.ok) {
            rollbackDataImportFormulaOverwrite(dataRow, column, cellKey, originalValue, false);
            deps.clearCellInputDraft(dataRow, column);
          }
        } catch (error) {
          rollbackDataImportFormulaOverwrite(dataRow, column, cellKey, originalValue, false);
          deps.clearCellInputDraft(dataRow, column);
          ElMessage.error((error as Error).message || "覆盖公式保存失败");
        }
        return;
      }

      const previousImportValue = deps.getCellValue(dataRow, column);
      delete state.dataImportFormulaOverwriteByCell[cellKey];
      if (meta.formulaRow && !meta.alreadyLocked) {
        lockDataImportFormulaCell(dataRow, column, false);
      }
      try {
        deps.applyCurrentDetailFormulas();
      } catch (_error) {
        // ignore
      }
      const formulaValue = deps.getCellValue(dataRow, column);
      state.cellInputOriginals[draftKey] = String(
        previousImportValue == null ? "" : previousImportValue,
      );
      try {
        const result = await deps.queueDraftSaveOperation(() =>
          deps.saveFillCellValue(dataRow, column, formulaValue),
        );
        if (!result || !result.ok) {
          rollbackDataImportFormulaOverwrite(
            dataRow,
            column,
            cellKey,
            previousImportValue,
            true,
          );
          deps.clearCellInputDraft(dataRow, column);
        }
      } catch (error) {
        rollbackDataImportFormulaOverwrite(
          dataRow,
          column,
          cellKey,
          previousImportValue,
          true,
        );
        deps.clearCellInputDraft(dataRow, column);
        ElMessage.error((error as Error).message || "取消覆盖保存失败");
      }
    } finally {
      delete state.dataImportOverwriteSavingByCell[cellKey];
    }
  }

  return {
    // 选项
    buildDataImportRootSubjectOptions,
    buildDataImportLeafSubjects,
    collectDataImportTemplateLeafSubjects,
    // 对话框
    openDataImportDialog,
    downloadDataImportTemplate,
    handleDataImportFileChange,
    // 核心
    buildDataImportSubjectPathMatcher,
    prepareSubtableDataImport,
    applySubtableDataImportTargets,
    // 覆盖公式
    clearDataImportCompareState,
    finalizeDataImportSessionAfterDraftSave,
    attachDataImportOverwriteCandidates,
    isDataImportFormulaCompareCell,
    isDataImportFormulaOverwrite,
    isDataImportOverwriteSaving,
    displayDataImportImportValue,
    displayDataImportFormulaCompareValue,
    onDataImportFormulaOverwriteChange,
    // 工具
    buildDataImportRowLookup,
    normalizeSubjectPathParts,
    normalizeSubjectMatchText,
    buildSubjectPathKey,
    isSameSubjectPathPrefix,
    resolveDataImportRowSubjectPath,
    resolveDataImportRowFullPath,
    filterDataImportLeafSubjectsByRootSubject,
    isDataImportEditableRow,
    isDataImportEditableTarget,
    isDataImportOverwriteTarget,
    isDataImportFormulaLockedTarget,
    isDataImportTemplateRow,
  };
}
