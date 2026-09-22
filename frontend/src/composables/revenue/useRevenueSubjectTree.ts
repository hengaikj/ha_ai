/**
 * 收益填报页·科目树 composable
 *
 * 负责科目树构建归一、矩阵行解析、展开折叠、单元格标签。
 * 原 mixin: subject-tree.mixin.js
 */
import { formatPeriodExpenseDisplayText } from "@/utils/displayText";
import {
  enrichMatrixRowPathContext,
  getDisplayAggregateFormulaLabel,
  getSubjectTreeDataRow,
  getSubjectTreeParentCellValue,
  getSubjectTreeRowDepth,
  getSubjectTreeRowKey,
  getSubjectTreeRowLabel,
  isDisplayAggregateColumn,
  isSubjectTreeParentRow,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import { resolveMaterialDesignCostInputScope } from "@/pages/revenue/subtable-workbench/material-design-cost";
import type {
  RevenueFillState,
  SubjectTreeNode,
  SubjectLeafMeta,
  MatrixRow,
  MatrixColumn,
} from "@/types/revenue";

export function useRevenueSubjectTree(state: RevenueFillState) {
  // ============================================================
  // 文本处理
  // ============================================================

  function normalizeExactSubjectName(value: unknown): string {
    return String(value || "")
      .replace(/\u00A0/g, "")
      .replace(/\r?\n/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function displayUiText(value: unknown): string {
    return formatPeriodExpenseDisplayText(value);
  }

  // ============================================================
  // 科目树元数据收集
  // ============================================================

  function resolveDisplayRootMeta(metaPath: SubjectLeafMeta[]): SubjectLeafMeta | null {
    const list = metaPath.filter(Boolean);
    return list.length > 1 ? list[1] : (list[0] || null);
  }

  function resolveTreeGroupName(path: string[]): string {
    const names = path.filter((item) => String(item || "").trim());
    if (!names.length) return "未分组";
    return names[0];
  }

  function resolveTreeSubjectDisplay(path: string[]): string {
    const names = path.filter((item) => String(item || "").trim());
    if (!names.length) return "-";
    if (names.length === 1) return names[0];
    return names.slice(1).join(" / ");
  }

  /** 对齐 Vue2 detail.vue：数字科目 ID 去掉 .0，保证树叶子与行能匹配 */
  function normalizeSubjectId(value: unknown): string {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    if (/^-?\d+(\.0+)?$/u.test(raw)) return String(Number(raw));
    return raw;
  }

  function resolveMatrixRow(row: MatrixRow): MatrixRow {
    return getSubjectTreeDataRow(row) as unknown as MatrixRow;
  }

  /** 对齐 Vue2：优先数字 subjectId，避免用模板主键对不上权限树叶子 */
  function resolveRowSubjectId(row: MatrixRow): string {
    const dataRow = (resolveMatrixRow(row) || row || {}) as MatrixRow & {
      templateItem?: { subjectId?: unknown };
      templateSubjectId?: unknown;
      expenseSubjectId?: unknown;
    };
    const candidates = [
      dataRow.subjectId,
      dataRow.templateSubjectId,
      dataRow.expenseSubjectId,
      dataRow.templateItem && dataRow.templateItem.subjectId,
      dataRow.id,
      dataRow.rowId,
    ].map((item) => normalizeSubjectId(item)).filter(Boolean);
    return candidates.find((item) => /^\d+$/u.test(item)) || candidates[0] || "";
  }

  function readTreeTemplateItem(node: SubjectTreeNode): Record<string, unknown> | null {
    const item = (node as SubjectTreeNode & { templateItem?: unknown }).templateItem;
    return item && typeof item === "object" ? (item as Record<string, unknown>) : null;
  }

  function resolveTreeLeafSubjectId(node: SubjectTreeNode): string {
    const templateItem = readTreeTemplateItem(node);
    const candidates = [
      node.subjectId,
      templateItem && templateItem.subjectId,
      node.id,
    ].map((item) => normalizeSubjectId(item)).filter(Boolean);
    return candidates.find((item) => /^\d+$/u.test(item)) || candidates[0] || "";
  }

  function collectTreeLeafMeta(
    nodes: SubjectTreeNode[],
    parentPath: string[] = [],
    bucket: SubjectLeafMeta[] = [],
    rootMeta: Partial<SubjectLeafMeta> | null = null,
    metaPath: SubjectLeafMeta[] = [],
  ): SubjectLeafMeta[] {
    const list = Array.isArray(nodes) ? nodes : [];
    list.forEach((node) => {
      if (!node || typeof node !== "object") return;
      const name = String(node.subjectName || node.name || "").trim();
      const nextPath = name ? parentPath.concat(name) : parentPath.slice();
      const children = Array.isArray(node.children) ? node.children : [];
      const currentMeta: SubjectLeafMeta = {
        subjectId: String(node.subjectId || node.id || "").trim(),
        subjectCode: "",
        unit: "",
        path: [],
        groupName: "",
        subjectDisplay: name || String(node.subjectName || node.name || node.id || "未分组").trim(),
        rootSubjectId: "",
        rootSubjectName: "",
        rootSortOrder: 0,
        displayRootSubjectId: "",
        displayRootSortOrder: 0,
        entryMode: "",
        templateEntryMode: "",
        readonly: false,
        calculated: false,
        editable: false,
        inputScope: "all" as const,
        inputType: "number",
        readonlyReason: "",
        formulaCode: "",
        formulaExpression: "",
        formulaParamBindings: [],
      };
      const nextMetaPath = currentMeta.subjectId || currentMeta.subjectDisplay
        ? metaPath.concat(currentMeta)
        : metaPath.slice();
      const displayRootMeta = resolveDisplayRootMeta(nextMetaPath);
      const nextRootMeta = rootMeta || {
        rootSubjectId: currentMeta.subjectId,
        rootSubjectName: currentMeta.subjectDisplay,
        rootSortOrder: Number(node.sortOrder || 0),
      };
      const isLeaf = Boolean(node.leaf) || children.length === 0;

      if (isLeaf) {
        // 对齐 Vue2：叶子 ID 优先数字 subjectId，避免和填报行对不上后生成空壳
        const subjectId = resolveTreeLeafSubjectId(node);
        if (!subjectId) return;
        const entryMode = String(node.entryMode || node.templateEntryMode || "").trim().toUpperCase();
        const formulaReadonly = entryMode === "CALCULATED" || entryMode === "DERIVED";
        const readonlyByMode = formulaReadonly || entryMode === "DATA_QUERY";
        const defaultInputScope: "all" | "readonly" = node.readonly === true || readonlyByMode ? "readonly" : "all";
        const inputScope = resolveMaterialDesignCostInputScope(
          {
            subjectId,
            subjectName: name,
            subject: name,
            subjectPath: nextPath,
            fullNamePath: Array.isArray(nextPath) ? nextPath.join("/") : nextPath,
            rootSubjectName: String(nextRootMeta?.rootSubjectName || ""),
            subtable: resolveTreeGroupName(nextPath),
            moduleCode: node.moduleCode,
          } as unknown as MatrixRow,
          defaultInputScope,
        ) as "all" | "first_year_only" | "year_independent" | "readonly";

        bucket.push({
          subjectId,
          subjectCode: String(node.subjectCode || "").trim(),
          unit: String(node.unit || "").trim(),
          path: nextPath,
          groupName: resolveTreeGroupName(nextPath),
          subjectDisplay: resolveTreeSubjectDisplay(nextPath),
          rootSubjectId: String(nextRootMeta?.rootSubjectId || ""),
          rootSubjectName: String(nextRootMeta?.rootSubjectName || ""),
          rootSortOrder: Number(nextRootMeta?.rootSortOrder || 0),
          displayRootSubjectId: String((displayRootMeta && displayRootMeta.subjectId) || (nextRootMeta?.rootSubjectId) || "").trim(),
          displayRootSortOrder: Number(displayRootMeta?.rootSortOrder || 0),
          entryMode,
          templateEntryMode: entryMode,
          readonly: node.readonly === true || readonlyByMode,
          calculated: formulaReadonly,
          editable: node.editable === true && !readonlyByMode,
          inputScope,
          inputType: formulaReadonly ? "calc" : "number",
          readonlyReason: String(node.readonlyReason || "").trim(),
          formulaId: node.formulaId as string | undefined,
          formulaCode: String(node.formulaCode || "").trim(),
          formulaExpression: String(node.formulaExpression || "").trim(),
          formulaParamBindings: Array.isArray(node.formulaParamBindings)
            ? node.formulaParamBindings
            : [],
        });
        return;
      }
      collectTreeLeafMeta(
        children,
        nextPath,
        bucket,
        nextRootMeta as Partial<SubjectLeafMeta>,
        nextMetaPath,
      );
    });
    return bucket;
  }

  // ============================================================
  // 可见/可写 ID 收集
  // ============================================================

  function collectVisibleSubjectIds(
    nodes: SubjectTreeNode[],
    bucket: Record<string, boolean>,
  ): Record<string, boolean> {
    collectTreeLeafMeta(nodes).forEach((meta) => {
      if (!meta || !meta.subjectId) return;
      bucket[String(meta.subjectId)] = true;
    });
    return bucket;
  }

  function collectSubjectIds(
    nodes: SubjectTreeNode[],
    bucket: Record<string, boolean>,
  ): Record<string, boolean> {
    return collectVisibleSubjectIds(nodes, bucket);
  }

  function collectVisibleRowSubjectIds(
    rows: MatrixRow[],
    bucket: Record<string, boolean>,
  ): Record<string, boolean> {
    rows.forEach((row) => {
      const id = resolveRowSubjectId(row);
      if (id) bucket[id] = true;
    });
    return bucket;
  }

  function collectRowSubjectIds(
    rows: MatrixRow[],
    bucket: Record<string, boolean>,
  ): Record<string, boolean> {
    return collectVisibleRowSubjectIds(rows, bucket);
  }

  // ============================================================
  // 按科目树归一化行列表
  // ============================================================

  function compareIdText(a: unknown, b: unknown): number {
    const textA = String(a == null ? "" : a).trim();
    const textB = String(b == null ? "" : b).trim();
    return textA.localeCompare(textB);
  }

  /** 对齐 Vue2 detail.vue：只认 data.subjects / payload.subjects，避免误用无模板的 tree/nodes。 */
  function resolveSubjectTreeNodes(payload: unknown): SubjectTreeNode[] {
    if (!payload || typeof payload !== "object") return [];
    if (Array.isArray(payload)) return payload as SubjectTreeNode[];
    const obj = payload as Record<string, unknown>;
    const data =
      obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : {};
    if (Array.isArray(data.subjects)) return data.subjects as SubjectTreeNode[];
    if (Array.isArray(obj.subjects)) return obj.subjects as SubjectTreeNode[];
    return [];
  }

  function normalizeRowsBySubjectTree(
    rows: MatrixRow[],
    subjectTree: SubjectTreeNode[],
  ): MatrixRow[] {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const leafMeta = collectTreeLeafMeta(subjectTree).slice().sort((left, right) =>
      compareIdText(left.subjectId, right.subjectId),
    );
    if (!leafMeta.length) return sourceRows;

    const rowBySubjectId: Record<string, MatrixRow> = {};
    sourceRows.forEach((row) => {
      const subjectId = resolveRowSubjectId(row);
      if (!subjectId || rowBySubjectId[subjectId]) return;
      rowBySubjectId[subjectId] = row;
    });

    const usedMap: Record<string, boolean> = {};
    const orderedRows: MatrixRow[] = [];

    leafMeta.forEach((meta) => {
      const matched = rowBySubjectId[meta.subjectId];
      if (matched) {
        matched.subtable = meta.groupName;
        matched.subject = meta.subjectDisplay || matched.subject;
        matched.subjectPath = Array.isArray(meta.path) ? meta.path.slice() : [];
        matched.subjectTreePath = Array.isArray(meta.path) ? meta.path.slice() : [];
        matched.rootSubjectId = meta.rootSubjectId;
        matched.rootSubjectName = meta.rootSubjectName || meta.groupName;
        matched.rootSortOrder = meta.rootSortOrder;
        matched.displayRootSubjectId = meta.displayRootSubjectId;
        matched.displayRootSortOrder = meta.displayRootSortOrder;
        // 对齐 Vue2：匹配行只同步 inputScope，不覆盖 entryMode/calculated/templateItem
        if (meta.inputScope) matched.inputScope = meta.inputScope;
        if (Array.isArray(meta.path) && meta.path.length) {
          const treePath = meta.path.join("/");
          const currentPath = String(matched.fullNamePath || "").trim();
          if (!currentPath || (!currentPath.includes("/") && treePath.includes("/"))) {
            matched.fullNamePath = treePath;
          }
        }
        orderedRows.push(matched);
        usedMap[meta.subjectId] = true;
        return;
      }

      orderedRows.push({
        id: meta.subjectId,
        rowId: meta.subjectId,
        subjectId: meta.subjectId,
        subjectCode: meta.subjectCode,
        subject: meta.subjectDisplay || meta.subjectId,
        unit: meta.unit,
        subtable: meta.groupName,
        rootSubjectId: meta.rootSubjectId,
        rootSubjectName: meta.rootSubjectName || meta.groupName,
        rootSortOrder: meta.rootSortOrder,
        displayRootSubjectId: meta.displayRootSubjectId,
        displayRootSortOrder: meta.displayRootSortOrder,
        owner: "",
        readonly: meta.readonly,
        calculated: meta.calculated,
        editable: meta.editable,
        inputScope: meta.inputScope,
        inputType: meta.inputType,
        templateEntryMode: meta.templateEntryMode,
        entryMode: meta.entryMode,
        readonlyReason: meta.readonlyReason,
        formulaId: meta.formulaId,
        formulaCode: meta.formulaCode,
        formulaExpression: meta.formulaExpression,
        formulaParamBindings: meta.formulaParamBindings,
        cells: {},
        cellMap: {},
        subjectPath: Array.isArray(meta.path) ? meta.path.slice() : [],
        subjectTreePath: Array.isArray(meta.path) ? meta.path.slice() : [],
      });
    });

    sourceRows
      .slice()
      .sort((a, b) => compareIdText(a.subjectId || a.id, b.subjectId || b.id))
      .forEach((row) => {
        const subjectId = resolveRowSubjectId(row);
        if (subjectId && usedMap[subjectId]) return;
        orderedRows.push(row);
      });

    return orderedRows;
  }

  // ============================================================
  // 单元格值读取
  // ============================================================

  function readCellObjectValue(cells: Record<string, unknown> | undefined, key: string): unknown {
    if (!cells || typeof cells !== "object") return null;
    if (!Object.prototype.hasOwnProperty.call(cells, key)) return null;
    return cells[key];
  }

  // ============================================================
  // 科目树展示
  // ============================================================

  function isSubjectTreeParent(row: MatrixRow): boolean {
    return isSubjectTreeParentRow(row as unknown as Record<string, unknown>);
  }

  function resolveSubjectTreeRowKey(row: MatrixRow): string {
    return getSubjectTreeRowKey(row as unknown as Record<string, unknown>);
  }

  function resolveSubjectTreeLabel(row: MatrixRow): string {
    const label = displayUiText(
      getSubjectTreeRowLabel(row as unknown as Record<string, unknown>),
    );
    if (isSubjectTreeParent(row)) return label;
    const dataRow = resolveMatrixRow(row);
    const unit = String((dataRow && dataRow.unit) || "").trim();
    if (!unit) return label;
    if (label.endsWith(`（${unit}）`) || label.endsWith(`(${unit})`)) return label;
    return `${label}（${unit}）`;
  }

  function resolveSubjectTreeUnit(row: MatrixRow): string {
    if (isSubjectTreeParent(row)) return "";
    const dataRow = resolveMatrixRow(row);
    return dataRow && dataRow.unit ? String(dataRow.unit) : "";
  }

  function displaySubjectTreeParentCellValue(row: MatrixRow, column: MatrixColumn): string {
    return getSubjectTreeParentCellValue(
      row as unknown as Record<string, unknown>,
      column as unknown as Record<string, unknown>,
    );
  }

  function displayAggregateLabel(row: MatrixRow, column: MatrixColumn): string {
    if (!isDisplayAggregateColumn(column as unknown as Record<string, unknown>)) return "";
    if (isSubjectTreeParent(row)) return "";
    const targetRow = enrichMatrixRowPathContext(
      resolveMatrixRow(row) as unknown as Record<string, unknown>,
      row as unknown as Record<string, unknown>,
    );
    return getDisplayAggregateFormulaLabel(
      targetRow,
      column as unknown as Record<string, unknown>,
    );
  }

  function subjectTreeCellStyle(row: MatrixRow): Record<string, string> {
    return {
      paddingLeft: `${getSubjectTreeRowDepth(row as unknown as Record<string, unknown>) * 18 + 8}px`,
    };
  }

  function subjectTreeIconClass(row: MatrixRow): string {
    return state.collapsedSubjectTreeMap[resolveSubjectTreeRowKey(row)]
      ? "el-icon-arrow-right"
      : "el-icon-arrow-down";
  }

  function toggleSubjectTreeRow(row: MatrixRow): void {
    if (!isSubjectTreeParent(row)) return;
    const key = resolveSubjectTreeRowKey(row);
    if (state.collapsedSubjectTreeMap[key]) {
      delete state.collapsedSubjectTreeMap[key];
    } else {
      state.collapsedSubjectTreeMap[key] = true;
    }
  }

  return {
    // 文本
    normalizeExactSubjectName,
    displayUiText,
    // 元数据
    collectTreeLeafMeta,
    resolveTreeGroupName,
    resolveTreeSubjectDisplay,
    resolveDisplayRootMeta,
    // ID 收集
    collectVisibleSubjectIds,
    collectSubjectIds,
    collectVisibleRowSubjectIds,
    collectRowSubjectIds,
    // 行解析
    resolveRowSubjectId,
    normalizeSubjectId,
    resolveMatrixRow,
    compareIdText,
    resolveSubjectTreeNodes,
    normalizeRowsBySubjectTree,
    // 单元格
    readCellObjectValue,
    // 科目树展示
    isSubjectTreeParent,
    resolveSubjectTreeRowKey,
    resolveSubjectTreeLabel,
    resolveSubjectTreeUnit,
    displaySubjectTreeParentCellValue,
    displayAggregateLabel,
    subjectTreeCellStyle,
    subjectTreeIconClass,
    toggleSubjectTreeRow,
  };
}
