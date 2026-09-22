/**
 * 收益模板新建/编辑弹窗的领域模型与校验
 * 逻辑对齐旧 Vue2 template-list/list-page.vue，供 Vue3 弹窗复用。
 */
import type { TemplateEntryMode, TemplateItemPayload } from "@/api/revenue/template";

export const MANUAL_SOURCE = "MANUAL";
export const CALCULATED_SOURCE = "CALCULATED";
export const DERIVED_SOURCE = "DERIVED";
export const DATA_QUERY_SOURCE = "DATA_QUERY";

export const DATA_SOURCE_OPTIONS: Array<{ label: string; value: TemplateEntryMode }> = [
  { label: "手工录入", value: MANUAL_SOURCE },
  { label: "公式计算", value: CALCULATED_SOURCE },
  { label: "系统计算", value: DERIVED_SOURCE },
  { label: "数据查询", value: DATA_QUERY_SOURCE },
];

const DATA_SOURCE_VALUES: TemplateEntryMode[] = DATA_SOURCE_OPTIONS.map(
  (item) => item.value,
);
const FORMULA_REF_REGEXP = /\$\{([^}]*)\}/g;
const ACTIVE_STATUS = "ACTIVE";

export type SubjectTreeNode = {
  id: string | number;
  label: string;
  subjectCode: string;
  subjectName: string;
  disabled?: boolean;
  children?: SubjectTreeNode[];
};

export type FlatSubject = {
  id: string | number;
  subjectCode: string;
  subjectName: string;
  pathLabel: string;
  isLeaf: boolean;
};

export type FormulaParameterDef = {
  parameterKey: string;
  parameterLabel: string;
  parameterName: string;
};

export type FormulaOption = {
  id: string | number;
  value: string | number;
  label: string;
  formulaCode: string;
  formulaName: string;
  expression: string;
  parameters: FormulaParameterDef[];
};

export type FormulaParameterBinding = {
  parameterIndex: number;
  parameterKey: string;
  parameterLabel: string;
  parameterName: string;
  subjectId: string | number | null;
  subjectCode?: string;
  subjectName?: string;
};

export type TemplateDialogRow = {
  uid: string;
  id: string;
  subjectId: string | number | null;
  subjectCode: string;
  subjectName: string;
  dataSourceType: TemplateEntryMode;
  formulaId: string | number | null;
  formulaCode: string;
  formulaName: string;
  formulaExpression: string;
  formulaParameterBindings: FormulaParameterBinding[];
};

export function safeText(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

export function normalizeId(value: unknown): number | null {
  if (!hasValue(value)) return null;
  const text = String(value);
  return /^\d+$/.test(text) ? Number(text) : null;
}

export function createUid(): string {
  return `row_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createTemplateRow(
  seed: Partial<TemplateDialogRow> = {},
): TemplateDialogRow {
  const sourceType = safeText(
    seed.dataSourceType,
  ).toUpperCase() as TemplateEntryMode;
  return {
    uid: seed.uid || createUid(),
    id: safeText(seed.id),
    subjectId: hasValue(seed.subjectId) ? (seed.subjectId as string | number) : null,
    subjectCode: safeText(seed.subjectCode),
    subjectName: safeText(seed.subjectName),
    dataSourceType: DATA_SOURCE_VALUES.includes(sourceType)
      ? sourceType
      : MANUAL_SOURCE,
    formulaId: hasValue(seed.formulaId) ? (seed.formulaId as string | number) : null,
    formulaCode: safeText(seed.formulaCode),
    formulaName: safeText(seed.formulaName),
    formulaExpression: safeText(seed.formulaExpression),
    formulaParameterBindings: Array.isArray(seed.formulaParameterBindings)
      ? seed.formulaParameterBindings
      : [],
  };
}

export function unwrapList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const source = payload as { data?: unknown; rows?: unknown; content?: unknown };
    if (Array.isArray(source.rows)) return source.rows;
    if (Array.isArray(source.data)) return source.data;
    if (Array.isArray(source.content)) return source.content;
  }
  return [];
}

function isTruthyFlag(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null) return false;
  return ["TRUE", "1", "Y", "YES", "ENABLED", "ENABLE", "ACTIVE"].includes(
    safeText(value).toUpperCase(),
  );
}

function isFalseFlag(value: unknown): boolean {
  if (value === false) return true;
  if (value === true || value == null) return false;
  return ["FALSE", "0", "N", "NO", "DISABLED", "DISABLE", "INACTIVE"].includes(
    safeText(value).toUpperCase(),
  );
}

function isSubjectEnabled(node: Record<string, unknown>): boolean {
  if (isFalseFlag(node.enabled) || isFalseFlag(node.isEnabled)) return false;
  if (isTruthyFlag(node.disabled) || isTruthyFlag(node.isDisabled)) return false;
  const status = safeText(
    node.status || node.subjectStatus || node.enabledStatus,
  ).toUpperCase();
  if (
    ["INACTIVE", "DISABLED", "DISABLE", "INVALID", "DELETED", "VOIDED", "1"].includes(
      status,
    )
  ) {
    return false;
  }
  return true;
}

export function filterEnabledSubjectTree(nodes: unknown[]): SubjectTreeNode[] {
  return (Array.isArray(nodes) ? nodes : [])
    .map((item) => {
      const node = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      if (!node || !hasValue(node.id) || !isSubjectEnabled(node)) return null;
      const sourceChildren = Array.isArray(node.children) ? node.children : [];
      const children = filterEnabledSubjectTree(sourceChildren);
      if (sourceChildren.length && !children.length) return null;
      const subjectName = safeText(node.subjectName || node.subject_name || node.name);
      return {
        id: node.id as string | number,
        label: subjectName,
        subjectCode: safeText(node.subjectCode || node.subject_code),
        subjectName,
        children: children.length ? children : undefined,
      } as SubjectTreeNode;
    })
    .filter((item): item is SubjectTreeNode => Boolean(item));
}

export function flattenSubjectTree(
  nodes: SubjectTreeNode[] = [],
  parentPath: string[] = [],
  target: FlatSubject[] = [],
): FlatSubject[] {
  nodes.forEach((node) => {
    if (!node || !hasValue(node.id)) return;
    const children = Array.isArray(node.children) ? node.children : [];
    const path = parentPath.concat(node.subjectName).filter(Boolean);
    target.push({
      id: node.id,
      subjectCode: node.subjectCode,
      subjectName: node.subjectName,
      pathLabel: path.join(" / "),
      isLeaf: !children.length,
    });
    flattenSubjectTree(children, path, target);
  });
  return target;
}

export function findSubjectById(
  list: FlatSubject[],
  subjectId: unknown,
): FlatSubject | null {
  if (!hasValue(subjectId)) return null;
  const targetId = String(subjectId);
  return list.find((item) => String(item.id) === targetId) || null;
}

export function collectSelectedLeafSubjects(
  tree: SubjectTreeNode[],
  flatList: FlatSubject[],
  subjectIds: Array<string | number>,
): FlatSubject[] {
  const selectedMap: Record<string, boolean> = {};
  subjectIds.forEach((id) => {
    if (hasValue(id)) selectedMap[String(id)] = true;
  });
  const result: FlatSubject[] = [];
  const seenMap: Record<string, boolean> = {};
  const walk = (nodes: SubjectTreeNode[] = [], parentSelected = false) => {
    nodes.forEach((node) => {
      if (!node || !hasValue(node.id)) return;
      const selected = parentSelected || Boolean(selectedMap[String(node.id)]);
      const children = Array.isArray(node.children) ? node.children : [];
      if (!children.length) {
        if (selected && !seenMap[String(node.id)]) {
          const subject = findSubjectById(flatList, node.id);
          if (subject) {
            seenMap[String(node.id)] = true;
            result.push(subject);
          }
        }
        return;
      }
      walk(children, selected);
    });
  };
  walk(tree);
  return result;
}

export function hasAvailableLeaf(
  node: SubjectTreeNode,
  availableLeafMap: Record<string, boolean>,
): boolean {
  if (!node || !hasValue(node.id)) return false;
  const children = Array.isArray(node.children) ? node.children : [];
  if (!children.length) return Boolean(availableLeafMap[String(node.id)]);
  return children.some((child) => hasAvailableLeaf(child, availableLeafMap));
}

export function collectAvailableRootIds(
  tree: SubjectTreeNode[],
  availableLeafMap: Record<string, boolean>,
): Array<string | number> {
  return (tree || [])
    .filter((node) => hasAvailableLeaf(node, availableLeafMap))
    .map((node) => node.id);
}

export function mapTreeWithDisabled(
  nodes: SubjectTreeNode[],
  predicate: (node: SubjectTreeNode, isLeaf: boolean) => boolean,
): SubjectTreeNode[] {
  return (nodes || []).map((node) => {
    const children = Array.isArray(node.children) ? node.children : [];
    const isLeaf = !children.length;
    const mappedChildren = children.length
      ? mapTreeWithDisabled(children, predicate)
      : undefined;
    return {
      ...node,
      disabled: predicate(node, isLeaf),
      children: mappedChildren,
    };
  });
}

export function extractFormulaParameters(expression: string): FormulaParameterDef[] {
  const parameters: FormulaParameterDef[] = [];
  const seenMap: Record<string, boolean> = {};
  let hit: RegExpExecArray | null;
  FORMULA_REF_REGEXP.lastIndex = 0;
  while ((hit = FORMULA_REF_REGEXP.exec(expression))) {
    const key = safeText(hit[1]);
    if (key && !seenMap[key]) {
      seenMap[key] = true;
      parameters.push({
        parameterKey: key,
        parameterLabel: key,
        parameterName: key,
      });
    }
  }
  return parameters;
}

export function normalizeFormulaOption(row: Record<string, unknown>): FormulaOption {
  const formulaCode = safeText(row.formulaCode || row.formula_code);
  const formulaName = safeText(row.formulaName || row.formula_name);
  const formulaExpression = safeText(row.formulaExpression || row.formula_expression);
  const formulaId = (row.id || formulaCode) as string | number;
  return {
    id: row.id as string | number,
    value: formulaId,
    label: formulaName || formulaCode || String(formulaId),
    formulaCode,
    formulaName,
    expression: formulaExpression,
    parameters: extractFormulaParameters(formulaExpression),
  };
}

export function isActiveFormula(row: Record<string, unknown>): boolean {
  const status = safeText(row.status, ACTIVE_STATUS).toUpperCase();
  return status === ACTIVE_STATUS;
}

function parseMaybeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readFirstValue(sources: Array<Record<string, unknown>>, keys: string[]): unknown {
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const key of keys) {
      if (hasValue(source[key])) return source[key];
    }
  }
  return undefined;
}

export function normalizeFormulaParameterBinding(
  item: unknown,
  index: number,
): FormulaParameterBinding {
  const source = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const subject =
    (source.subject as Record<string, unknown>) ||
    (source.expenseSubject as Record<string, unknown>) ||
    (source.boundSubject as Record<string, unknown>) ||
    {};
  const subjectId =
    typeof item === "object"
      ? readFirstValue([source, subject], [
          "subjectId",
          "parameterSubjectId",
          "boundSubjectId",
          "id",
        ])
      : item;
  const parameterKey =
    safeText(
      readFirstValue([source], ["paramCode", "parameterKey", "key", "parameterCode", "code"]),
    ) || `参数${index + 1}`;
  return {
    parameterIndex: index + 1,
    parameterKey,
    parameterLabel:
      safeText(
        readFirstValue([source], ["parameterLabel", "label", "parameterName", "name"]),
      ) || parameterKey,
    parameterName:
      safeText(
        readFirstValue([source], ["parameterName", "name", "parameterLabel", "label"]),
      ) || parameterKey,
    subjectId: hasValue(subjectId) ? (subjectId as string | number) : null,
    subjectCode: safeText(
      readFirstValue([source, subject], ["subjectCode", "subject_code", "code"]),
    ),
    subjectName: safeText(
      readFirstValue([source, subject], ["subjectName", "subject_name", "name"]),
    ),
  };
}

export function normalizeDialogRow(
  item: Record<string, unknown>,
  formulaOptions: FormulaOption[],
): TemplateDialogRow {
  const formulaSource =
    (item.formulaInfo as Record<string, unknown>) ||
    (item.formula as Record<string, unknown>) ||
    (item.expenseFormula as Record<string, unknown>) ||
    (item.periodExpenseFormula as Record<string, unknown>) ||
    {};
  const subject =
    (item.subject as Record<string, unknown>) ||
    (item.expenseSubject as Record<string, unknown>) ||
    {};
  const formulaId = readFirstValue([item, formulaSource], ["formulaId", "id"]);
  const formulaCode = readFirstValue(
    [item, formulaSource],
    ["formulaCode", "formula_code", "code"],
  );
  const matchedFormula = formulaOptions.find(
    (option) =>
      String(option.value) === String(formulaId) ||
      String(option.formulaCode) === String(formulaCode),
  );
  const sourceBindings = [
    item.formulaParameterBindings,
    item.formulaParameters,
    item.parameterBindings,
    item.parameters,
    item.formulaParamBindings,
    formulaSource.formulaParameterBindings,
    formulaSource.formulaParameters,
  ]
    .map((value) => parseMaybeArray(value))
    .find((value) => value.length) || [];
  const dataSourceType = (
    safeText(
      item.entryMode || item.dataSourceType || item.data_source_type || item.sourceType,
    ).toUpperCase() || MANUAL_SOURCE
  ) as TemplateEntryMode;
  const subjectId = readFirstValue([item, subject], ["subjectId", "id"]);
  const isCalculated = dataSourceType === CALCULATED_SOURCE;
  return createTemplateRow({
    id: safeText(item.id),
    subjectId: hasValue(subjectId) ? (subjectId as string | number) : null,
    subjectCode: safeText(
      readFirstValue([item, subject], ["subjectCode", "subject_code", "code"]),
    ),
    subjectName: safeText(
      readFirstValue([item, subject], ["subjectName", "subject_name", "name"]),
    ),
    dataSourceType,
    formulaId: isCalculated
      ? matchedFormula
        ? matchedFormula.value
        : (formulaId as string | number) || (formulaCode as string | number) || null
      : null,
    formulaCode: isCalculated
      ? matchedFormula
        ? matchedFormula.formulaCode
        : safeText(formulaCode)
      : "",
    formulaName: isCalculated
      ? matchedFormula
        ? matchedFormula.label
        : safeText(
            readFirstValue([item, formulaSource], ["formulaName", "formula_name", "name"]),
          )
      : "",
    formulaExpression: isCalculated
      ? matchedFormula
        ? matchedFormula.expression
        : safeText(
            readFirstValue(
              [item, formulaSource],
              ["formulaExpression", "formula_expression", "expression"],
            ),
          )
      : "",
    formulaParameterBindings: isCalculated
      ? sourceBindings.map((binding, index) =>
          normalizeFormulaParameterBinding(binding, index),
        )
      : [],
  });
}

export function isTemplateRowUnbound(row: TemplateDialogRow): boolean {
  return (
    row.dataSourceType === CALCULATED_SOURCE &&
    (!hasValue(row.formulaId) ||
      !Array.isArray(row.formulaParameterBindings) ||
      !row.formulaParameterBindings.length ||
      row.formulaParameterBindings.some((item) => !hasValue(item.subjectId)))
  );
}

function buildTemplateSubjectIdMap(rows: TemplateDialogRow[]): Record<string, boolean> {
  return rows.reduce<Record<string, boolean>>((map, row) => {
    if (hasValue(row.subjectId)) map[String(row.subjectId)] = true;
    return map;
  }, {});
}

function buildDependencyGraph(
  rows: TemplateDialogRow[],
  overrideRowUid = "",
  overrideBindings: FormulaParameterBinding[] | null = null,
): Record<string, string[]> {
  const subjectIdMap = buildTemplateSubjectIdMap(rows);
  return rows.reduce<Record<string, string[]>>((graph, row) => {
    if (row.dataSourceType !== CALCULATED_SOURCE || !hasValue(row.subjectId)) return graph;
    const bindings =
      row.uid === overrideRowUid && Array.isArray(overrideBindings)
        ? overrideBindings
        : row.formulaParameterBindings;
    graph[String(row.subjectId)] = (Array.isArray(bindings) ? bindings : [])
      .map((item) => (hasValue(item.subjectId) ? String(item.subjectId) : ""))
      .filter((subjectId) => subjectId && subjectIdMap[subjectId]);
    return graph;
  }, {});
}

function hasDependencyPath(
  startSubjectId: unknown,
  targetSubjectId: unknown,
  graph: Record<string, string[]>,
  visiting: Record<string, boolean> = {},
): boolean {
  const startKey = String(startSubjectId);
  const targetKey = String(targetSubjectId);
  if (startKey === targetKey) return true;
  if (visiting[startKey]) return false;
  visiting[startKey] = true;
  return (graph[startKey] || []).some((nextSubjectId) =>
    hasDependencyPath(nextSubjectId, targetKey, graph, visiting),
  );
}

function hasCircularDependency(graph: Record<string, string[]>): boolean {
  const visiting: Record<string, boolean> = {};
  const visited: Record<string, boolean> = {};
  const visit = (subjectId: string): boolean => {
    if (visited[subjectId]) return false;
    if (visiting[subjectId]) return true;
    visiting[subjectId] = true;
    const cycled = (graph[subjectId] || []).some((nextSubjectId) => visit(nextSubjectId));
    delete visiting[subjectId];
    visited[subjectId] = true;
    return cycled;
  };
  return Object.keys(graph).some((subjectId) => visit(subjectId));
}

export function wouldCreateDependencyCycle(
  rows: TemplateDialogRow[],
  currentRowUid: string,
  currentSubjectId: unknown,
  dependencySubjectId: unknown,
): boolean {
  if (!hasValue(currentSubjectId) || !hasValue(dependencySubjectId)) return false;
  if (String(currentSubjectId) === String(dependencySubjectId)) return true;
  const graph = buildDependencyGraph(rows, currentRowUid, []);
  return hasDependencyPath(dependencySubjectId, currentSubjectId, graph);
}

export function validateFormulaBindingsForRow(
  rows: TemplateDialogRow[],
  row: TemplateDialogRow,
  bindings: FormulaParameterBinding[],
  flatList: FlatSubject[],
): string {
  const subjectIdMap = buildTemplateSubjectIdMap(rows);
  for (const binding of bindings) {
    if (!subjectIdMap[String(binding.subjectId)]) {
      return "公式参数只能绑定当前模板中的科目";
    }
    const subject = findSubjectById(flatList, binding.subjectId);
    if (!subject || !subject.isLeaf) {
      return "公式参数只能绑定叶子科目";
    }
    if (hasValue(row.subjectId) && String(binding.subjectId) === String(row.subjectId)) {
      return "公式参数不能绑定当前计算科目本身";
    }
  }
  const graph = buildDependencyGraph(rows, row.uid, bindings);
  if (hasCircularDependency(graph)) {
    return "公式参数绑定会形成循环依赖";
  }
  return "";
}

export function validateDialogForm(
  templateName: string,
  rows: TemplateDialogRow[],
  flatList: FlatSubject[],
): string {
  if (!safeText(templateName)) return "模板名称不能为空";
  if (!rows.length) return "请至少配置一行模板科目";
  const selectedIds: Record<string, boolean> = {};
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const line = `第 ${index + 1} 行`;
    if (!hasValue(row.subjectId)) return `${line}请选择科目`;
    const subject = findSubjectById(flatList, row.subjectId);
    if (!subject || !subject.isLeaf) return `${line}请选择叶子科目`;
    const subjectKey = String(row.subjectId);
    if (selectedIds[subjectKey]) return "同一个科目只能选择一次";
    selectedIds[subjectKey] = true;
    if (!DATA_SOURCE_VALUES.includes(row.dataSourceType)) {
      return `${line}请选择数据来源`;
    }
    if (row.dataSourceType === CALCULATED_SOURCE && !hasValue(row.formulaId)) {
      return `${line}请绑定公式`;
    }
    if (row.dataSourceType === CALCULATED_SOURCE) {
      if (
        !Array.isArray(row.formulaParameterBindings) ||
        !row.formulaParameterBindings.length
      ) {
        return `${line}请绑定公式参数`;
      }
      if (row.formulaParameterBindings.some((item) => !hasValue(item.subjectId))) {
        return `${line}公式参数未绑定完整`;
      }
      const dependencyMessage = validateFormulaBindingsForRow(
        rows,
        row,
        row.formulaParameterBindings,
        flatList,
      );
      if (dependencyMessage) return `${line}${dependencyMessage}`;
    }
  }
  return "";
}

export function buildTemplateItemsPayload(rows: TemplateDialogRow[]): TemplateItemPayload[] {
  return rows.map((row, index) => {
    const isCalculated = row.dataSourceType === CALCULATED_SOURCE;
    const formulaParameterBindings = isCalculated
      ? row.formulaParameterBindings.map((item, parameterIndex) => ({
          paramCode: item.parameterKey || `参数${parameterIndex + 1}`,
          subjectId: normalizeId(item.subjectId),
        }))
      : [];
    return {
      subjectId: Number(normalizeId(row.subjectId)),
      entryMode: row.dataSourceType,
      sortOrder: index,
      formulaId: isCalculated ? (normalizeId(row.formulaId) ?? undefined) : undefined,
      formulaParamBindings: isCalculated ? JSON.stringify(formulaParameterBindings) : undefined,
    };
  });
}

export function clearFormulaFields(row: TemplateDialogRow): void {
  row.formulaId = null;
  row.formulaCode = "";
  row.formulaName = "";
  row.formulaExpression = "";
  row.formulaParameterBindings = [];
}
