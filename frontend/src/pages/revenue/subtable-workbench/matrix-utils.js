import {
  aggregateRatio,
  getAggregateFormulaLabel,
  isWeightedAggregateFormula,
  parseAggregateRatio,
} from "./aggregate-engine";
import {
  formatRevenueDisplayValue,
  formatRevenueNumber,
  parseRevenueNumber,
} from "./value-normalizer";

export const REVENUE_AGGREGATE_MODE = Object.freeze({
  NONE: "NONE",
  YEAR_SUBTOTAL: "YEAR_SUBTOTAL",
  LIFECYCLE: "LIFECYCLE",
  VIRTUAL: "VIRTUAL",
});

export const REVENUE_ROW_KIND = Object.freeze({
  INPUT: "input",
  FORMULA: "formula",
  ROW_SUBTOTAL: "rowSubtotal",
  LINKED: "linked",
  EXTERNAL: "external",
  DISPLAY_AGGREGATE: "displayAggregate",
});

export const SUBJECT_TREE_ROW_TYPE = Object.freeze({
  PARENT: "subjectTreeParent",
  LEAF: "subjectTreeLeaf",
});

export const SUBJECT_TREE_PARENT_DISPLAY = Object.freeze({
  CATEGORY: "category",
  ROLLUP: "displayRollup",
});

export const SUBJECT_TREE_ROLLUP_SCOPE = Object.freeze({
  ALL_LEAVES: "allLeaves",
  DIRECT_CHILDREN: "directChildren",
});

export const LIFECYCLE_YEAR_KEY = "lifecycle";
export const LIFECYCLE_YEAR_LABEL = "全生命周期";
export const DEFAULT_LIFECYCLE_WEIGHT_SOURCE_PATH = "销量表/销量";

function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

export function isLifecycleYearLabel(value) {
  const text = safeText(value).toLowerCase();
  return text === LIFECYCLE_YEAR_KEY || text.includes("全生命周期");
}

export function isVirtualTrimValue(value) {
  const text = safeText(value).toLowerCase();
  return text === "subtotal" || text === "lifecycle" || text === "小计" || text === "合计" || text === "全生命周期";
}

export function normalizeRealYears(years = []) {
  return (Array.isArray(years) ? years : []).filter((year) => {
    const text = safeText(year);
    return text && !isLifecycleYearLabel(text);
  });
}

export function buildDisplayYearOptions(years = [], options = {}) {
  const realYears = normalizeRealYears(years);
  const result = realYears.map((year, index) => ({
    key: safeText(year),
    label: safeText(year),
    value: safeText(year),
    year,
    yearIndex: index,
    lifecycle: false,
    real: true,
  }));
  if (realYears.length > 1 || options.alwaysIncludeLifecycle === true) {
    result.push({
      key: LIFECYCLE_YEAR_KEY,
      label: LIFECYCLE_YEAR_LABEL,
      value: LIFECYCLE_YEAR_KEY,
      year: LIFECYCLE_YEAR_LABEL,
      yearIndex: -1,
      lifecycle: true,
      real: false,
      displayOnly: true,
    });
  }
  return result;
}

function splitSubjectPathValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => safeText(item)).filter(Boolean);
  }
  const text = safeText(value).replace(/\\/g, "/");
  if (!text) return [];
  return text
    .split("/")
    .map((item) => safeText(item))
    .filter(Boolean);
}

function subjectNamePathValue(value) {
  const text = safeText(value);
  return text ? [text] : [];
}

function splitExplicitSubjectPath(row = {}) {
  if (!row || typeof row !== "object") return [];
  const overridePath = splitSubjectPathValue(row.__subjectTreePath || row.subjectTreePath);
  if (overridePath.length) return overridePath;

  const rawPath = safeText(row.fullNamePath || row.subjectPath || row.path).replace(/\\/g, "/");
  if (!rawPath) return [];

  const leafName = safeText(row.subjectName || row.subject);
  if (leafName && leafName.includes("/") && (rawPath === leafName || rawPath.endsWith(`/${leafName}`))) {
    if (rawPath === leafName) return [leafName];
    const parentPath = rawPath.slice(0, rawPath.length - leafName.length - 1);
    return splitSubjectPathValue(parentPath).concat(leafName);
  }

  return splitSubjectPathValue(rawPath);
}

function compareIdText(a, b) {
  const left = safeText(a);
  const right = safeText(b);
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right, "zh-CN", { numeric: true });
}

function normalizeSubjectSortPath(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const number = Number(item);
    return Number.isFinite(number) ? number : 0;
  });
}

function normalizeSubjectIdPath(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeText(item)).filter(Boolean);
}

function readSubjectSortId(row = {}) {
  const sourceRow = getSubjectTreeDataRow(row);
  return safeText(sourceRow.subjectId || sourceRow.id || sourceRow.rowId);
}

function readSubjectDisplayRootSortOrder(row = {}) {
  const sourceRow = getSubjectTreeDataRow(row);
  return Number(sourceRow.displayRootSortOrder || sourceRow.rootSortOrder || 0);
}

function readSubjectDisplayRootId(row = {}) {
  const sourceRow = getSubjectTreeDataRow(row);
  return safeText(sourceRow.displayRootSubjectId || sourceRow.rootSubjectId || sourceRow.rootId);
}

function readSubjectLeafSortOrder(row = {}) {
  const sourceRow = getSubjectTreeDataRow(row);
  const value = Number(sourceRow.sortOrder);
  return Number.isFinite(value) ? value : 0;
}

function readSubjectSortPath(row = {}) {
  const sourceRow = getSubjectTreeDataRow(row);
  return normalizeSubjectSortPath(sourceRow.subjectSortPath || sourceRow.sortPath);
}

function readSubjectIdPath(row = {}) {
  const sourceRow = getSubjectTreeDataRow(row);
  return normalizeSubjectIdPath(sourceRow.subjectIdPath || sourceRow.idPath);
}

function readSubjectParentPathKey(row = {}) {
  const path = getSourceSubjectPath(row);
  return joinSubjectPathKey(path.slice(0, -1));
}

function compareSubjectOrderPath(a = {}, b = {}) {
  const leftSortPath = readSubjectSortPath(a);
  const rightSortPath = readSubjectSortPath(b);
  if (!leftSortPath.length || !rightSortPath.length) return 0;

  const leftIdPath = readSubjectIdPath(a);
  const rightIdPath = readSubjectIdPath(b);
  const maxLength = Math.max(leftSortPath.length, rightSortPath.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftHasSegment = index < leftSortPath.length;
    const rightHasSegment = index < rightSortPath.length;
    if (!leftHasSegment || !rightHasSegment) {
      return leftSortPath.length - rightSortPath.length;
    }

    const sortDiff = leftSortPath[index] - rightSortPath[index];
    if (sortDiff !== 0) return sortDiff;

    const idDiff = compareIdText(leftIdPath[index], rightIdPath[index]);
    if (idDiff !== 0) return idDiff;
  }
  return 0;
}

function compareSubjectRowsForDisplay(a, b) {
  const orderPathDiff = compareSubjectOrderPath(a, b);
  if (orderPathDiff !== 0) return orderPathDiff;
  const sortDiff = readSubjectDisplayRootSortOrder(a) - readSubjectDisplayRootSortOrder(b);
  if (sortDiff !== 0) return sortDiff;
  const rootIdDiff = compareIdText(readSubjectDisplayRootId(a), readSubjectDisplayRootId(b));
  if (rootIdDiff !== 0) return rootIdDiff;
  const parentPathDiff = readSubjectParentPathKey(a).localeCompare(readSubjectParentPathKey(b), "zh-CN", {
    numeric: true,
  });
  if (parentPathDiff !== 0) return parentPathDiff;
  const leafSortDiff = readSubjectLeafSortOrder(a) - readSubjectLeafSortOrder(b);
  if (leafSortDiff !== 0) return leafSortDiff;
  return compareIdText(readSubjectSortId(a), readSubjectSortId(b));
}

function joinSubjectPathKey(path = []) {
  return path.map((item) => safeText(item)).filter(Boolean).join("/");
}

function normalizeSubjectPathKey(value = "") {
  return joinSubjectPathKey(splitSubjectPathValue(value));
}

export function normalizeSubjectTreePath(row = {}) {
  if (!row || typeof row !== "object") return [];
  const displayPath = splitSubjectPathValue(row.__subjectTreePath);
  if (displayPath.length) return displayPath;
  const subtable = safeText(row.subtable || row.moduleName);
  const explicitPath = splitExplicitSubjectPath(row);
  if (explicitPath.length > 1) return explicitPath;

  const subjectPath = subjectNamePathValue(row.subjectName || row.subject);
  if (subjectPath.length > 1) {
    if (subtable && subjectPath[0] !== subtable) return [subtable].concat(subjectPath);
    return subjectPath;
  }

  const leafName = explicitPath[0] || subjectPath[0] || safeText(row.subjectName || row.subject || row.id, "-");
  if (subtable && leafName && leafName !== subtable) return [subtable, leafName];
  return leafName ? [leafName] : [];
}

export function getSubjectTreeRootName(row = {}) {
  const path = normalizeSubjectTreePath(row);
  return path[0] || safeText(row.subtable || row.moduleName, "未分组");
}

export function getSubjectTreeDataRow(row = {}) {
  return row && row.__sourceRow ? row.__sourceRow : row;
}

function normalizeMatrixSubjectId(value) {
  const text = safeText(value);
  if (!text) return "";
  if (/^\d+(\.0+)?$/u.test(text)) return String(Number(text));
  return "";
}

export function resolveMatrixRowSubjectId(row = {}) {
  const dataRow = getSubjectTreeDataRow(row);
  if (!dataRow || typeof dataRow !== "object") return "";
  const candidates = [
    dataRow.subjectId,
    dataRow.templateSubjectId,
    dataRow.expenseSubjectId,
    dataRow.templateItem && dataRow.templateItem.subjectId,
    dataRow.id,
    dataRow.rowId,
  ];
  for (let index = 0; index < candidates.length; index += 1) {
    const subjectId = normalizeMatrixSubjectId(candidates[index]);
    if (subjectId) return subjectId;
  }
  return "";
}

export function getSubjectTreeMeta(row = {}) {
  return row && row.__subjectTree && typeof row.__subjectTree === "object" ? row.__subjectTree : null;
}

export function isSubjectTreeParentRow(row = {}) {
  const meta = getSubjectTreeMeta(row);
  return Boolean(meta && meta.type === SUBJECT_TREE_ROW_TYPE.PARENT);
}

export function getSubjectTreeRowKey(row = {}) {
  const meta = getSubjectTreeMeta(row);
  if (meta && meta.key) return meta.key;
  return safeText(row && (row.id || row.rowId || row.subjectId || row.subject), "subject_row");
}

export function getSubjectTreeRowLabel(row = {}) {
  const meta = getSubjectTreeMeta(row);
  if (meta && meta.label) return meta.label;
  const path = normalizeSubjectTreePath(row);
  return path.length ? path[path.length - 1] : safeText(row.subjectName || row.subject, "-");
}

export function getSubjectTreeRowDepth(row = {}) {
  const meta = getSubjectTreeMeta(row);
  return meta ? Number(meta.depth || 0) : 0;
}

export function isRealSubjectRow(row = {}) {
  const dataRow = getSubjectTreeDataRow(row);
  if (!dataRow || typeof dataRow !== "object") return false;
  if (isSubjectTreeParentRow(dataRow)) return false;
  if (dataRow.isRealSubject === false || dataRow.virtual === true) return false;
  return Boolean(resolveMatrixRowSubjectId(dataRow));
}

function getSourceSubjectPath(row = {}) {
  if (!row || typeof row !== "object") return [];
  const sourceRow = getSubjectTreeDataRow(row);
  const explicitPath = splitExplicitSubjectPath(sourceRow);
  if (explicitPath.length) return explicitPath;
  return normalizeSubjectTreePath(sourceRow);
}

function resolveModuleRootName(row = {}, path = []) {
  return (
    safeText(row.rootSubjectName || row.rootName) ||
    safeText(path[0]) ||
    safeText(row.subtable || row.moduleName, "未分组")
  );
}

function resolveModuleRootId(row = {}, rootName = "") {
  return safeText(row.rootSubjectId || row.rootId || row.moduleId || row.subtableId, rootName);
}

function createModuleDisplayRow(row, relativePath = [], module = {}) {
  const sourceRow = getSubjectTreeDataRow(row);
  const displayPath = relativePath.length
    ? relativePath
    : subjectNamePathValue(sourceRow.subjectName || sourceRow.subject || sourceRow.id);
  return {
    ...sourceRow,
    __sourceRow: sourceRow,
    __subjectTreePath: displayPath.length ? displayPath : [safeText(sourceRow.subject || sourceRow.subjectName, "-")],
    __moduleRootId: module.rootSubjectId || "",
    __moduleRootName: module.name || "",
    __moduleRootPath: Array.isArray(module.rootPath) ? module.rootPath.slice() : [],
  };
}

export function buildRevenueModuleSections(rows = [], options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const sections = [];
  const sectionMap = {};
  const includeEmptyRootLeaf = Boolean(options.includeEmptyRootLeaf);

  list.forEach((row, _index) => {
    if (!row || typeof row !== "object") return;
    const sourceRow = getSubjectTreeDataRow(row);
    const fullPath = getSourceSubjectPath(sourceRow);
    const rootName = resolveModuleRootName(sourceRow, fullPath);
    const rootSubjectId = resolveModuleRootId(sourceRow, rootName);
    const key = `module:${rootSubjectId || rootName}`;
    if (!sectionMap[key]) {
      sectionMap[key] = {
        key,
        moduleKey: key,
        rootSubjectId,
        rootSubjectName: rootName,
        rootPath: rootName ? [rootName] : [],
        name: rootName || "未分组",
        moduleName: rootName || "未分组",
        moduleCode: safeText(sourceRow.moduleCode),
        orderIndex: sections.length,
        sortOrder: Number.isFinite(Number(sourceRow.rootSortOrder))
          ? Number(sourceRow.rootSortOrder)
          : sections.length,
        rows: [],
        sourceRows: [],
      };
      sections.push(sectionMap[key]);
    }

    const section = sectionMap[key];
    let relativePath =
      fullPath.length > 1 && fullPath[0] === section.rootSubjectName
        ? fullPath.slice(1)
        : fullPath.length > 1
        ? fullPath.slice(1)
        : includeEmptyRootLeaf
        ? fullPath
        : subjectNamePathValue(sourceRow.subjectName || sourceRow.subject || sourceRow.id);
    while (
      relativePath.length > 1 &&
      section.rootSubjectName &&
      relativePath[0] === section.rootSubjectName
    ) {
      relativePath = relativePath.slice(1);
    }
    section.rows.push(createModuleDisplayRow(sourceRow, relativePath, section));
    section.sourceRows.push(sourceRow);
  });

  sections.forEach((section) => {
    section.rows = section.rows.slice().sort(compareSubjectRowsForDisplay);
    section.sourceRows = section.sourceRows.slice().sort(compareSubjectRowsForDisplay);
  });

  return sections.slice().sort((a, b) => {
    const sortDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (sortDiff !== 0) return sortDiff;
    const idDiff = compareIdText(a.rootSubjectId, b.rootSubjectId);
    if (idDiff !== 0) return idDiff;
    return Number(a.orderIndex || 0) - Number(b.orderIndex || 0);
  });
}

function resolveParentDisplayConfig(path = [], displayMap = {}) {
  const map = displayMap && typeof displayMap === "object" && !Array.isArray(displayMap) ? displayMap : {};
  const fullPath = joinSubjectPathKey(path);
  const label = path[path.length - 1] || "";
  const normalizedFullPath = normalizeSubjectPathKey(fullPath);
  const normalizedLabel = normalizeSubjectPathKey(label);
  const entries = Object.keys(map);
  const exactKey =
    entries.find((key) => normalizeSubjectPathKey(key) === normalizedFullPath) ||
    entries.find((key) => normalizeSubjectPathKey(key) === normalizedLabel) ||
    entries.find((key) => {
      const normalizedKey = normalizeSubjectPathKey(key);
      return normalizedKey && normalizedFullPath.endsWith(normalizedKey);
    });
  const config = exactKey ? map[exactKey] : null;
  return config && typeof config === "object" && !Array.isArray(config) ? config : {};
}

function resolveParentDisplayMode(config = {}) {
  const mode = safeText(config.displayMode || config.mode || config.nodeKind || config.kind).toLowerCase();
  if (["rollup", "displayrollup", "aggregate", "summary", "sum"].includes(mode)) {
    return SUBJECT_TREE_PARENT_DISPLAY.ROLLUP;
  }
  return SUBJECT_TREE_PARENT_DISPLAY.CATEGORY;
}

function resolveParentRollupFormula(config = {}) {
  return safeText(config.rollupFormula || config.formula || config.aggregator, "sum").toLowerCase();
}

function resolveParentRollupScope(config = {}) {
  const scope = safeText(config.rollupScope || config.scope || config.sourceScope).toLowerCase();
  if (["direct", "directchildren", "children", "immediate", "immediatechildren"].includes(scope)) {
    return SUBJECT_TREE_ROLLUP_SCOPE.DIRECT_CHILDREN;
  }
  return SUBJECT_TREE_ROLLUP_SCOPE.ALL_LEAVES;
}

function createParentTreeNode(path, parentKey, displayMap, keyPrefix = "") {
  const key = `${keyPrefix}parent:${joinSubjectPathKey(path)}`;
  const config = resolveParentDisplayConfig(path, displayMap);
  const displayMode = resolveParentDisplayMode(config);
  const rollupFormula = resolveParentRollupFormula(config);
  const rollupScope = resolveParentRollupScope(config);
  return {
    key,
    parentKey,
    type: SUBJECT_TREE_ROW_TYPE.PARENT,
    label: path[path.length - 1],
    path: path.slice(),
    depth: path.length - 1,
    children: [],
    row: {
      id: key,
      subject: path[path.length - 1],
      unit: "",
      isRealSubject: false,
      virtual: true,
      savePolicy: "display_only",
      savable: false,
      displayMode,
      rollupFormula,
      rollupScope,
      __subjectTree: {
        key,
        parentKey,
        type: SUBJECT_TREE_ROW_TYPE.PARENT,
        label: path[path.length - 1],
        path: path.slice(),
        depth: path.length - 1,
        hasChildren: true,
        isRealSubject: false,
        displayMode,
        rollupFormula,
        rollupScope,
        sourceRows: [],
        directChildRows: [],
      },
    },
  };
}

function createLeafTreeNode(row, path, parentKey, index, keyPrefix = "") {
  const sourceRow = getSubjectTreeDataRow(row);
  const key = `${keyPrefix}leaf:${safeText(sourceRow.id || sourceRow.rowId || sourceRow.subjectId, index)}:${joinSubjectPathKey(path)}`;
  return {
    key,
    parentKey,
    type: SUBJECT_TREE_ROW_TYPE.LEAF,
    label: path[path.length - 1],
    path: path.slice(),
    depth: Math.max(path.length - 1, 0),
    children: [],
    row: {
      ...row,
      __sourceRow: sourceRow,
      __subjectTree: {
        key,
        parentKey,
        type: SUBJECT_TREE_ROW_TYPE.LEAF,
        label: path[path.length - 1],
        path: path.slice(),
        depth: Math.max(path.length - 1, 0),
        hasChildren: false,
      },
    },
  };
}

export function buildSubjectTreeRows(rows = [], options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const collapsedMap =
    options && options.collapsedMap && typeof options.collapsedMap === "object"
      ? options.collapsedMap
      : {};
  const displayMap =
    options && options.parentDisplayMap && typeof options.parentDisplayMap === "object"
      ? options.parentDisplayMap
      : {};
  const keyPrefix = safeText(options && (options.keyPrefix || options.treeKeyPrefix));
  const normalizedKeyPrefix = keyPrefix ? `${keyPrefix}:` : "";
  const rootNodes = [];
  const nodeMap = {};

  function appendNode(parentKey, node) {
    const parent = parentKey ? nodeMap[parentKey] : null;
    if (parent) parent.children.push(node);
    else rootNodes.push(node);
  }

  function ensureParent(path) {
    const key = `${normalizedKeyPrefix}parent:${joinSubjectPathKey(path)}`;
    if (nodeMap[key]) return nodeMap[key];
    const parentPath = path.slice(0, -1);
    const parentKey = parentPath.length ? ensureParent(parentPath).key : "";
    const node = createParentTreeNode(path, parentKey, displayMap, normalizedKeyPrefix);
    nodeMap[key] = node;
    appendNode(parentKey, node);
    return node;
  }

  list.forEach((row, index) => {
    const path = normalizeSubjectTreePath(row);
    if (!path.length) return;
    let parentKey = "";
    if (path.length > 1) {
      parentKey = ensureParent(path.slice(0, -1)).key;
    }
    appendNode(parentKey, createLeafTreeNode(row, path, parentKey, index, normalizedKeyPrefix));
  });

  function attachSourceRows(node) {
    if (node.type === SUBJECT_TREE_ROW_TYPE.LEAF) return [getSubjectTreeDataRow(node.row)];
    const sourceRows = [];
    node.children.forEach((child) => {
      attachSourceRows(child).forEach((sourceRow) => {
        if (sourceRow) sourceRows.push(sourceRow);
      });
    });
    if (node.row && node.row.__subjectTree) {
      node.row.__subjectTree.sourceRows = sourceRows;
      node.row.__subjectTree.directChildRows = node.children
        .map((child) => child && child.row)
        .filter(Boolean);
    }
    return sourceRows;
  }
  rootNodes.forEach((node) => attachSourceRows(node));

  const result = [];
  function flatten(node) {
    result.push(node.row);
    if (node.type === SUBJECT_TREE_ROW_TYPE.PARENT && collapsedMap[node.key]) return;
    node.children.forEach((child) => flatten(child));
  }
  rootNodes.forEach((node) => flatten(node));
  return result;
}

export function isDisplayAggregateColumn(column) {
  if (!column || typeof column !== "object") return false;
  if (column.displayOnly === true || column.real === false) return true;
  const mode = safeText(column.aggregateMode).toUpperCase();
  return (
    mode === REVENUE_AGGREGATE_MODE.YEAR_SUBTOTAL ||
    mode === REVENUE_AGGREGATE_MODE.LIFECYCLE ||
    mode === REVENUE_AGGREGATE_MODE.VIRTUAL
  );
}

function getVisibleAggregateFormulaLabel(formula) {
  const text = safeText(formula).toLowerCase();
  if (isWeightedAggregateFormula(text) || text === "volume_weighted") return "";
  return getAggregateFormulaLabel(text);
}

export function getDisplayAggregateFormulaLabel(row = {}, column = {}) {
  if (!isDisplayAggregateColumn(column)) return "";
  const mode = safeText(column.aggregateMode).toUpperCase();
  if (
    isSubjectTreeRollupParentRow(row) &&
    (mode === REVENUE_AGGREGATE_MODE.YEAR_SUBTOTAL || mode === REVENUE_AGGREGATE_MODE.LIFECYCLE)
  ) {
    return getVisibleAggregateFormulaLabel(getSubjectTreeParentRollupFormula(row));
  }
  if (
    isMixLikeRow(row) &&
    (mode === REVENUE_AGGREGATE_MODE.YEAR_SUBTOTAL || mode === REVENUE_AGGREGATE_MODE.LIFECYCLE)
  ) {
    return getVisibleAggregateFormulaLabel("mix");
  }
  // 手工费率：计算走加权，标签仍显示「比率」
  if (
    isManualFeeRateRatioLabelRow(row) &&
    (mode === REVENUE_AGGREGATE_MODE.YEAR_SUBTOTAL || mode === REVENUE_AGGREGATE_MODE.LIFECYCLE)
  ) {
    return getVisibleAggregateFormulaLabel("ratio");
  }
  if (mode === REVENUE_AGGREGATE_MODE.YEAR_SUBTOTAL) {
    return getVisibleAggregateFormulaLabel(resolveSubtotalAggregateFormula(row, column));
  }
  if (mode === REVENUE_AGGREGATE_MODE.LIFECYCLE) {
    return getVisibleAggregateFormulaLabel(resolveLifecycleFormula(row, column));
  }
  return "";
}

export function formatDisplayAggregateText(row = {}, column = {}, value = "") {
  const text = safeText(value);
  if (!text || text === "-") return text || "-";
  const label = getDisplayAggregateFormulaLabel(row, column);
  return label ? `${text}（${label}）` : text;
}

export function isSavableMatrixColumn(column) {
  if (!column || typeof column !== "object") return false;
  if (isDisplayAggregateColumn(column)) return false;
  if (column.real === false) return false;
  return true;
}

export function isSavableMatrixRow(row) {
  if (!row || typeof row !== "object") return false;
  if (!isRealSubjectRow(row)) return false;
  if (row.savable === false) return false;
  if (safeText(row.savePolicy).toLowerCase() === "display_only") return false;
  if (safeText(row.rowKind || row.rowType) === REVENUE_ROW_KIND.DISPLAY_AGGREGATE) return false;
  return Boolean(resolveMatrixRowSubjectId(row));
}

export function isSavableMatrixCell(row, column, cell) {
  if (!row || !column) return false;
  if (!isSavableMatrixRow(row)) return false;
  if (!isSavableMatrixColumn(column)) return false;
  if (cell && cell.savable === false) return false;
  return true;
}

export function parseMatrixNumber(value) {
  return parseRevenueNumber(value, { allowPercent: true });
}

function parseMatrixRatio(value) {
  return parseAggregateRatio(value);
}

function parseSubjectRatio(_row = {}, value = "") {
  const text = safeText(value);
  const num = parseMatrixNumber(text);
  if (num === null) return null;
  if (/[%％]$/.test(text)) return num / 100;
  return parseMatrixRatio(text);
}

export function formatMatrixNumber(value, options = {}) {
  return formatRevenueNumber(value, options);
}

export function formatRevenueTableCellValue(row = {}, value = "", options = {}) {
  return formatRevenueDisplayValue(value, row, options);
}

function formatAggregateNumber(value, row) {
  const text = formatRevenueDisplayValue(value, row);
  return text === "-" ? "" : text;
}

export function getRealColumnCellKey(column = {}) {
  return getMatrixCellLookup(column).cellKey;
}

function resolveMatrixTrimInfo(column = {}) {
  const trim = column.trim;
  const trimId = safeText(
    column.trimId ||
      (trim && typeof trim === "object" ? trim.trimId || trim.id || trim.code || trim.name || trim.label : trim) ||
      column.trimName
  );
  const trimName = safeText(
    column.trimName ||
      (trim && typeof trim === "object" ? trim.trimName || trim.name || trim.label || trimId : trimId)
  );
  return { trimId, trimName };
}

export function getMatrixCellLookup(column = {}) {
  const explicitCellKey = safeText(column.cellKey);
  if (explicitCellKey) {
    const yearLabel = safeText(column.yearLabel || column.year);
    const { trimId, trimName } = resolveMatrixTrimInfo(column);
    return buildMatrixCellLookupResult(explicitCellKey, yearLabel, trimId, trimName);
  }

  const yearIndex = Number(column.yearIndex);
  const trimIndex = Number(column.trimIndex);
  const yearLabel = safeText(column.yearLabel || column.year);
  const { trimId, trimName } = resolveMatrixTrimInfo(column);
  let cellKey = "";
  if (Number.isInteger(yearIndex) && Number.isInteger(trimIndex)) {
    cellKey = `y${yearIndex}_t${trimIndex}`;
  } else if (column.key && !isDisplayAggregateColumn(column)) {
    cellKey = safeText(column.key);
  } else if (Number.isInteger(yearIndex) && trimId) {
    cellKey = `y${yearIndex}_t${trimId}`;
  }
  return buildMatrixCellLookupResult(cellKey, yearLabel, trimId, trimName);
}

function buildMatrixCellLookupResult(cellKey, yearLabel, trimId, trimName) {
  const dimensionKeys = [
    yearLabel && trimId ? `${yearLabel}__${trimId}` : "",
    yearLabel && trimName && trimName !== trimId ? `${yearLabel}__${trimName}` : "",
  ].filter(Boolean);
  const mixedKeys = [
    yearLabel && trimId ? `${yearLabel}_${trimId}` : "",
    yearLabel && trimName && trimName !== trimId ? `${yearLabel}_${trimName}` : "",
  ].filter(Boolean);
  return {
    cellKey: safeText(cellKey),
    yearLabel,
    trimId,
    trimName,
    dimensionKeys,
    mixedKeys,
  };
}

function readObjectValue(map, key) {
  if (!map || typeof map !== "object" || !key) return undefined;
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  return undefined;
}

function readFirstObjectValue(map, keys = []) {
  for (let index = 0; index < keys.length; index += 1) {
    const value = readObjectValue(map, keys[index]);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function getMatrixDimensionMap(row = {}) {
  if (!row || typeof row !== "object") return null;
  return (
    (row.cellMap && typeof row.cellMap === "object" ? row.cellMap : null) ||
    (row.cellsByDimension && typeof row.cellsByDimension === "object" ? row.cellsByDimension : null) ||
    (row.dimensionCells && typeof row.dimensionCells === "object" ? row.dimensionCells : null)
  );
}

export function readMatrixCellValue(row, column = {}, options = {}) {
  const defaultValue = Object.prototype.hasOwnProperty.call(options, "defaultValue") ? options.defaultValue : "";
  if (!row || typeof row !== "object") return defaultValue;
  const lookup = getMatrixCellLookup(column);
  const cells = row.cells && typeof row.cells === "object" ? row.cells : {};
  const cellValue = readObjectValue(cells, lookup.cellKey);
  if (cellValue !== undefined) return cellValue;

  const dimensionValue = readFirstObjectValue(getMatrixDimensionMap(row), lookup.dimensionKeys);
  if (dimensionValue !== undefined) return dimensionValue;

  const mixedValue = readFirstObjectValue(cells, lookup.mixedKeys);
  if (mixedValue !== undefined) return mixedValue;

  return defaultValue;
}

function ensureMatrixObject(row, key, setValue) {
  if (!row[key] || typeof row[key] !== "object" || Array.isArray(row[key])) {
    setValue(row, key, {});
  }
  return row[key];
}

export function writeMatrixCellValue(row, column = {}, value, options = {}) {
  if (!row || typeof row !== "object") return;
  const setValue = typeof options.set === "function"
    ? options.set
    : (target, key, nextValue) => {
        target[key] = nextValue;
      };
  const lookup = getMatrixCellLookup(column);
  const cells = ensureMatrixObject(row, "cells", setValue);
  if (lookup.cellKey) setValue(cells, lookup.cellKey, value);
  if (!lookup.dimensionKeys.length) return;
  const cellMap = ensureMatrixObject(row, "cellMap", setValue);
  lookup.dimensionKeys.forEach((key) => setValue(cellMap, key, value));
}

export function getRowCellValue(row, column) {
  if (!row || !column) return "";
  if (isDisplayAggregateColumn(column)) {
    return getDisplayAggregateValue(row, column);
  }
  return readMatrixCellValue(row, column);
}

export function getSubjectTreeParentSourceRows(row = {}) {
  const meta = getSubjectTreeMeta(row);
  return meta && Array.isArray(meta.sourceRows) ? meta.sourceRows : [];
}

export function getSubjectTreeParentDirectChildRows(row = {}) {
  const meta = getSubjectTreeMeta(row);
  return meta && Array.isArray(meta.directChildRows) ? meta.directChildRows : [];
}

export function getSubjectTreeParentDisplayMode(row = {}) {
  const meta = getSubjectTreeMeta(row);
  return safeText(
    (meta && meta.displayMode) || row.displayMode,
    SUBJECT_TREE_PARENT_DISPLAY.CATEGORY
  );
}

export function isSubjectTreeRollupParentRow(row = {}) {
  return (
    isSubjectTreeParentRow(row) &&
    getSubjectTreeParentDisplayMode(row) === SUBJECT_TREE_PARENT_DISPLAY.ROLLUP
  );
}

export function getSubjectTreeParentRollupFormula(row = {}) {
  const meta = getSubjectTreeMeta(row);
  return safeText((meta && meta.rollupFormula) || row.rollupFormula, "sum").toLowerCase();
}

export function getSubjectTreeParentRollupScope(row = {}) {
  const meta = getSubjectTreeMeta(row);
  return safeText(
    (meta && meta.rollupScope) || row.rollupScope,
    SUBJECT_TREE_ROLLUP_SCOPE.ALL_LEAVES
  );
}

function getSubjectTreeParentRollupRows(row = {}) {
  if (getSubjectTreeParentRollupScope(row) === SUBJECT_TREE_ROLLUP_SCOPE.DIRECT_CHILDREN) {
    return getSubjectTreeParentDirectChildRows(row);
  }
  return getSubjectTreeParentSourceRows(row).filter((sourceRow) => isRealSubjectRow(sourceRow));
}

function resolveSubjectTreeRollupDisplayRow(row = {}, column = {}) {
  const columnUnit = column && column.rndInvestmentAmount ? safeText(column.unit) : "";
  return columnUnit ? { ...row, unit: columnUnit } : row;
}

function calculateSubjectTreeParentRollupNumber(row, column) {
  if (!isSubjectTreeRollupParentRow(row)) return null;
  const numbers = getSubjectTreeParentRollupRows(row)
    .map((sourceRow) => getSubjectTreeRollupNumber(sourceRow, column))
    .filter((num) => num !== null);
  const formula = getSubjectTreeParentRollupFormula(row);
  if (!numbers.length) {
    if (formula === "count" || formula === "count_non_empty") return 0;
    return null;
  }
  if (formula === "avg" || formula === "average") {
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }
  if (formula === "max") return Math.max(...numbers);
  if (formula === "min") return Math.min(...numbers);
  if (formula === "count" || formula === "count_non_empty") return numbers.length;
  return numbers.reduce((sum, num) => sum + num, 0);
}

function getSubjectTreeRollupNumber(row, column) {
  if (isSubjectTreeRollupParentRow(row)) {
    return calculateSubjectTreeParentRollupNumber(row, column);
  }
  if (isSubjectTreeParentRow(row)) return null;
  return parseMatrixNumber(getRowCellValue(getSubjectTreeDataRow(row), column));
}

export function getSubjectTreeParentCellValue(row, column) {
  if (!isSubjectTreeRollupParentRow(row)) return "";
  const formula = getSubjectTreeParentRollupFormula(row);
  const value = calculateSubjectTreeParentRollupNumber(row, column);
  if (value === null) {
    return "";
  }
  if (formula === "count" || formula === "count_non_empty") return String(value);
  return formatRevenueDisplayValue(value, resolveSubjectTreeRollupDisplayRow(row, column));
}

function getRowComparablePath(row = {}) {
  const value = row.fullNamePath || row.subjectPath || row.path || row.subjectName || row.subject;
  const text = Array.isArray(value) ? value.map((item) => safeText(item)).filter(Boolean).join("/") : safeText(value);
  return text
    .replace(/\s+/g, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

/**
 * 剥掉科目名上的单位后缀，避免「销售收入（万元）」匹配失败。
 */
function stripSubjectUnitSuffix(value = "") {
  return safeText(value)
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "")
    .replace(/[-—_]/g, "")
    .replace(/(万元\/台|万\/台|万元|万辆|万台|元|辆|台|%)$/u, "");
}

const PROJECT_PROFIT_AMOUNT_SUBJECTS = Object.freeze(["销售收入", "边际贡献", "营业利润"]);

function collectRowPathCandidates(row = {}) {
  const result = [];
  const push = (value) => {
    if (Array.isArray(value)) {
      const joined = value.map((item) => safeText(item)).filter(Boolean).join("/");
      if (joined) result.push(joined);
      return;
    }
    const text = safeText(value);
    if (text) result.push(text);
  };
  push(row.fullNamePath);
  push(row.subjectPath);
  push(row.subjectTreePath);
  push(row.__subjectTreePath);
  push(row.path);
  push(row.fullPath);
  if (row.__subjectTree && Array.isArray(row.__subjectTree.path)) {
    push(row.__subjectTree.path);
  }
  push([row.rootSubjectName, row.subtable, row.subjectName || row.subject]);
  push([row.rootSubjectName, row.subjectName || row.subject]);
  push(getRowComparablePath(row));
  return result
    .map((item) => stripSubjectUnitSuffix(item))
    .filter((item, index, list) => item && list.indexOf(item) === index);
}

function resolveProjectProfitAmountLeaf(row = {}) {
  const texts = [];
  const push = (value) => {
    const text = stripSubjectUnitSuffix(value);
    if (text) texts.push(text);
  };
  push(row.subjectName);
  push(row.subject);
  if (row.__subjectTree) push(row.__subjectTree.label);
  collectRowPathCandidates(row).forEach((path) => {
    const parts = String(path || "")
      .split("/")
      .filter(Boolean);
    if (parts.length) push(parts[parts.length - 1]);
  });
  for (let i = 0; i < texts.length; i += 1) {
    const text = texts[i];
    if (PROJECT_PROFIT_AMOUNT_SUBJECTS.includes(text)) return text;
    const hit = PROJECT_PROFIT_AMOUNT_SUBJECTS.find((name) => text.endsWith(`/${name}`));
    if (hit) return hit;
  }
  return "";
}

/**
 * 主表/项目利润 下销售收入、边际贡献、营业利润：单元格已是总额，年小计/生命周期应求和。
 * 不含单车收益下同名科目。
 */
export function isMainProjectProfitAmountSumRow(row = {}) {
  if (!resolveProjectProfitAmountLeaf(row)) return false;
  const blob = collectRowPathCandidates(row).join("|");
  if (blob.includes("单车收益")) return false;
  return blob.includes("项目利润");
}

/**
 * 主表两处「边际贡献」叶子行（单车收益 / 项目利润），不含边际贡献率。
 * 用于小计/加权、全生命周期小计等展示列的样式加粗。
 * 注意：填报页树行路径在 __subjectTree 上，调用方宜先 enrichMatrixRowPathContext。
 */
export function isMainMarginContributionRow(row = {}) {
  if (!row || typeof row !== "object") return false;
  const labelCandidates = [
    row.subjectName,
    row.subject,
    row.name,
    row.__subjectTree && row.__subjectTree.label,
    getSubjectTreeRowLabel(row),
  ];
  // 科目名精确匹配「边际贡献」即可（已排除「边际贡献率」）；路径信息在部分页面缺失，不再作为硬条件
  return labelCandidates.some((value) => stripSubjectUnitSuffix(value) === "边际贡献");
}

/**
 * 手工费率：数值按销量/MIX 加权，标签仍显示「比率」（与生产一致）。
 * 仅：销售费用/固定销售费用/费率、其他固定费用/管理费用/费率。
 */
export function isManualFeeRateRatioLabelRow(row = {}) {
  const subject = stripSubjectUnitSuffix(row.subjectName || row.subject);
  if (subject !== "费率") return false;
  return collectRowPathCandidates(row).some(
    (path) =>
      (path.includes("固定销售费用") && path.includes("费率")) ||
      (path.includes("管理费用") && path.includes("费率"))
  );
}

/**
 * 与生产一致：下列比率类科目年小计/生命周期按 ratio 重算，并显示「比率」。
 * - 主表/单车收益/营业利润率、边际贡献率
 * - TP竞争力、综合权益TP竞争力
 * 注：两个手工「费率」见 isManualFeeRateRatioLabelRow（标签比率、数值加权）。
 */
export function isForcedRatioAggregateRow(row = {}) {
  const subject = stripSubjectUnitSuffix(row.subjectName || row.subject);
  const paths = collectRowPathCandidates(row);
  const blob = paths.join("|");

  if (subject === "营业利润率" || subject === "边际贡献率") {
    return paths.some((path) => path.includes("单车收益"));
  }
  if (subject === "综合权益TP竞争力") {
    return blob.includes("竞争力") || blob.includes("TP");
  }
  if (subject === "TP竞争力") {
    return blob.includes("竞争力") || blob.includes("TP");
  }
  return false;
}

/**
 * 聚合计算时临时带上科目树路径（返回新对象，绝不改写源行，避免界面显示全路径）。
 */
export function enrichMatrixRowPathContext(dataRow = {}, treeRow = null) {
  if (!dataRow || typeof dataRow !== "object") return dataRow;
  const treeMeta = treeRow && treeRow.__subjectTree ? treeRow.__subjectTree : null;
  const fromMeta =
    treeMeta && Array.isArray(treeMeta.path) && treeMeta.path.length ? treeMeta.path : null;
  const treePath =
    fromMeta ||
    (treeRow && (treeRow.__subjectTreePath || treeRow.subjectTreePath)) ||
    null;
  if (!treePath && !treeMeta) return dataRow;
  const next = { ...dataRow };
  if (treePath) next.__subjectTreePath = treePath;
  if (treeMeta) next.__subjectTree = treeMeta;
  return next;
}

function normalizeGuidePriceComparableText(value = "") {
  return safeText(value)
    .replace(/\s+/g, "")
    .replace(/\\/g, "/")
    .replace(/[（）()]/g, "")
    .replace(/[-—_]/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function isSalesGuidePriceRow(row = {}) {
  const path = normalizeGuidePriceComparableText(getRowComparablePath(row));
  const subject = normalizeGuidePriceComparableText(row.subjectName || row.subject);
  const moduleName = normalizeGuidePriceComparableText(row.subtable || row.moduleName || row.rootSubjectName);
  const salesScoped = moduleName === "销量表" || path === "销量表" || path.startsWith("销量表/");
  const candidates = ["单价指导价", "目标单价指导价", "实际单价指导价"];
  return candidates.some((candidate) => {
    const matchesLeaf = subject === candidate || path === candidate || path.endsWith(`/${candidate}`);
    const matchesSalesPath = path === `销量表/${candidate}` || path.endsWith(`/销量表/${candidate}`);
    return matchesSalesPath || (salesScoped && matchesLeaf) || path === candidate;
  });
}

export function resolveSubtotalAggregateFormula(row = {}, column = {}) {
  // 仅项目利润三项总额行强制求和（优先于行上 weighted 默认）
  if (isMainProjectProfitAmountSumRow(row)) return "sum";
  // 手工费率：数值强制加权（覆盖误打的 ratio 标），标签另显「比率」
  if (isManualFeeRateRatioLabelRow(row)) return "weighted_by_mix";
  // 仅指定比率类科目强制按比率重算（显示「比率」）
  if (isForcedRatioAggregateRow(row)) return "ratio";
  if (isSalesGuidePriceRow(row)) return "weighted_by_mix";
  const explicit = safeText(row.aggregateFormula || row.formulaAggregate || column.formula).toLowerCase();
  if (explicit === "sum" || explicit === "sum_year") return "sum";
  if (explicit) return explicit;
  const path = getRowComparablePath(row);
  const subject = safeText(row.subjectName || row.subject);
  if (/mix$/i.test(subject) || /mix$/i.test(path)) return "sum";
  if (/销量|数量|台数|产量/.test(path)) return "sum";
  return "weighted_by_mix";
}

function findMixRow(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return (
    list.find((row) => {
      const path = getRowComparablePath(row);
      return /(^|\/)MIX$/.test(path);
    }) ||
    list.find((row) => {
      const path = getRowComparablePath(row);
      return /(^|\/)销量MIX$/.test(path);
    }) ||
    list.find((row) => {
      const path = getRowComparablePath(row);
      return /(^|\/)(目标销量首年MIX|目标首年MIX)$/.test(path);
    }) ||
    list.find((row) => getRowComparablePath(row).includes("MIX")) ||
    null
  );
}

function isMixLikeRow(row = {}) {
  const path = getRowComparablePath(row);
  const subject = safeText(row.subjectName || row.subject);
  return /mix$/i.test(subject) || /(^|\/)[^/]*MIX$/i.test(path);
}

function normalizeComparableText(value) {
  return safeText(value)
    .replace(/\s+/g, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function normalizeWeightComparableText(value) {
  return normalizeComparableText(value)
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[（）()]/g, "")
    .replace(/[-—_]/g, "");
}

function findRowByPath(rows = [], path = "") {
  const expected = normalizeComparableText(path);
  if (!expected) return null;
  const list = Array.isArray(rows) ? rows : [];
  return (
    list.find((row) => getRowComparablePath(row) === expected) ||
    list.find((row) => getRowComparablePath(row).endsWith(expected)) ||
    list.find((row) => {
      const current = getRowComparablePath(row);
      return current && expected.endsWith(current);
    }) ||
    null
  );
}

function isLifecycleWeightCandidateRow(row = {}) {
  const path = normalizeWeightComparableText(getRowComparablePath(row));
  const subject = normalizeWeightComparableText(row.subjectName || row.subject);
  const candidates = [
    "销量",
    "目标销量",
    "项目销量",
    "总销量",
    "台数",
    "数量",
    "产量",
  ];
  if (candidates.includes(subject)) return true;
  return candidates.some((candidate) => path === candidate || path.endsWith(`/${candidate}`));
}

export function resolveLifecycleFormula(row = {}, column = {}) {
  // 仅项目利润三项总额行强制跨年求和
  if (isMainProjectProfitAmountSumRow(row)) return "sum_year";
  // 手工费率：生命周期数值走销量加权（覆盖误打的 ratio 标）
  if (isManualFeeRateRatioLabelRow(row)) return "volume_weighted";
  // 指定比率类科目生命周期也按比率重算
  if (isForcedRatioAggregateRow(row)) return "ratio";
  if (isSalesGuidePriceRow(row)) return "volume_weighted";
  const explicit = safeText(row.lifecycleFormula || column.lifecycleFormula).toLowerCase();
  if (explicit === "sum_year" || explicit === "sum") return "sum_year";
  if (explicit) return explicit;
  const path = getRowComparablePath(row);
  const subject = safeText(row.subjectName || row.subject);
  if (/mix$/i.test(subject) || /mix$/i.test(path)) return "mix";
  const aggregate = resolveSubtotalAggregateFormula(row, column);
  if (aggregate === "weighted" || aggregate === "weighted_by_mix") return "volume_weighted";
  if (aggregate === "ratio") return "ratio";
  if (aggregate === "avg" || aggregate === "average") return "avg";
  if (aggregate === "max") return "max";
  if (aggregate === "min") return "min";
  return "sum_year";
}

function getColumnSourceRows(column = {}) {
  const result = [];
  const seen = {};
  const appendRows = (rows) => {
    (Array.isArray(rows) ? rows : []).forEach((row, index) => {
      if (!row || typeof row !== "object") return;
      const key = safeText(row.id || row.rowId || row.subjectId || getRowComparablePath(row), `row_${index}`);
      if (seen[key]) return;
      seen[key] = true;
      result.push(row);
    });
  };
  appendRows(column.sourceRows);
  appendRows(column.detailRows);
  appendRows(column.aggregateSourceRows);
  (Array.isArray(column.sourceDetails) ? column.sourceDetails : []).forEach((detail) => {
    appendRows(detail && detail.rows);
  });
  return result;
}

function getLifecycleSourceColumns(column = {}) {
  return Array.isArray(column.sourceColumns) ? column.sourceColumns : [];
}

function getLifecycleAllSourceColumns(column = {}) {
  if (Array.isArray(column.allSourceColumns)) return column.allSourceColumns;
  if (Array.isArray(column.lifecycleAllSourceColumns)) return column.lifecycleAllSourceColumns;
  return getLifecycleSourceColumns(column);
}

function findWeightRow(row = {}, column = {}) {
  const sourceRows = getColumnSourceRows(column);
  const explicitPath = safeText(row.weightSourcePath || column.weightSourcePath);
  const candidates = [
    explicitPath,
    DEFAULT_LIFECYCLE_WEIGHT_SOURCE_PATH,
    "主表/项目利润/销量",
    "主表/项目利润/销量（辆）",
    "主表/项目利润/项目销量",
    "主表/项目利润/项目销量（辆）",
    "销量表/销量",
    "销量表/销量（辆）",
    "销量",
    "销量（辆）",
    "销量表/目标销量",
    "销量表/目标销量（辆）",
    "目标销量",
    "目标销量（辆）",
    "项目销量",
    "项目销量（辆）",
  ].filter(Boolean);
  for (let index = 0; index < candidates.length; index += 1) {
    const hit = findRowByPath(sourceRows, candidates[index]);
    if (hit) return hit;
  }
  return sourceRows.find((sourceRow) => isLifecycleWeightCandidateRow(sourceRow)) || null;
}

function findLifecycleWeightRow(row = {}, column = {}) {
  return findWeightRow(row, column);
}

function findVolumeWeightRow(row = {}, column = {}) {
  return findWeightRow(row, column);
}

function computeVolumeMixRatio(row = {}, column = {}, sourceColumn = {}) {
  const weightRow = findVolumeWeightRow(row, column);
  if (!weightRow) return null;
  const sourceColumns = Array.isArray(column.sourceColumns) ? column.sourceColumns : [];
  const value = parseMatrixNumber(getRowCellValue(weightRow, sourceColumn));
  if (value === null) return null;
  const denominator = sourceColumns
    .filter((item) => Number(item && item.yearIndex) === Number(sourceColumn && sourceColumn.yearIndex))
    .map((item) => parseMatrixNumber(getRowCellValue(weightRow, item)))
    .filter((num) => num !== null)
    .reduce((sum, num) => sum + num, 0);
  if (!denominator) return null;
  return value / denominator;
}

function computeMixSubtotalFromVolume(column = {}) {
  const sourceColumns = Array.isArray(column.sourceColumns) ? column.sourceColumns : [];
  let hasValue = false;
  sourceColumns.forEach((sourceColumn) => {
    const ratio = computeVolumeMixRatio({}, column, sourceColumn);
    if (ratio === null) return;
    hasValue = true;
  });
  // MIX subtotal is a business invariant: all valid trims for the year add up to 100%.
  return hasValue ? 1 : null;
}

function collectColumnNumbers(row, columns = []) {
  return (Array.isArray(columns) ? columns : [])
    .map((item) => parseMatrixNumber(getRowCellValue(row, item)))
    .filter((num) => num !== null);
}

function sumColumnNumbers(row, columns = []) {
  const numbers = collectColumnNumbers(row, columns);
  return numbers.length ? numbers.reduce((sum, num) => sum + num, 0) : null;
}

function computeLifecycleWeightedValue(row, column) {
  const weightRow = findLifecycleWeightRow(row, column);
  if (!weightRow) return null;
  let total = 0;
  let totalWeight = 0;
  let hasValue = false;
  getLifecycleSourceColumns(column).forEach((sourceColumn) => {
    const value = parseMatrixNumber(getRowCellValue(row, sourceColumn));
    const weight = parseMatrixNumber(getRowCellValue(weightRow, sourceColumn));
    if (weight === null || weight === 0) return;
    if (value !== null) {
      total += value * weight;
      hasValue = true;
    }
    totalWeight += weight;
  });
  if (!hasValue || !totalWeight) return null;
  return total / totalWeight;
}

function computeLifecycleMixValue(row, column) {
  const trimId = safeText(column.trimId).toLowerCase();
  if (trimId === "subtotal") return 1;
  const weightRow = findLifecycleWeightRow(row, column);
  if (!weightRow) return null;
  const numerator = sumColumnNumbers(weightRow, getLifecycleSourceColumns(column));
  const denominator = sumColumnNumbers(weightRow, getLifecycleAllSourceColumns(column));
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function computeLifecycleNumber(row, column, stack = []) {
  if (!row || !column) return null;
  const sourceColumns = getLifecycleSourceColumns(column);
  if (!sourceColumns.length) return null;
  const formula = resolveLifecycleFormula(row, column);

  if (formula === "ratio") {
    const components = resolveRatioComponentRows(row, column);
    const nextStack = stack.concat(row);
    if (components) {
      const ratioValue = computeRatioFromComponentRows(components, (componentRow) => {
        if (nextStack.includes(componentRow)) return null;
        return computeLifecycleNumber(componentRow, column, nextStack);
      });
      if (ratioValue !== null) return ratioValue;
    }
    // 强制比率但无法解析分子分母时（如手工费率），回退销量加权
    if (isForcedRatioAggregateRow(row)) {
      return computeLifecycleWeightedValue(row, column);
    }
    return null;
  }

  if (formula === "mix") {
    return computeLifecycleMixValue(row, column);
  }

  if (formula === "volume_weighted" || formula === "weighted" || formula === "weighted_by_mix") {
    return computeLifecycleWeightedValue(row, column);
  }

  const numbers = collectColumnNumbers(row, sourceColumns);
  if (!numbers.length) return null;
  if (formula === "avg" || formula === "average") {
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }
  if (formula === "max") return Math.max(...numbers);
  if (formula === "min") return Math.min(...numbers);
  return numbers.reduce((sum, num) => sum + num, 0);
}

function weightedByMixSubtotal(row, column, _numbers) {
  const sourceRows = getColumnSourceRows(column);
  const mixRow = findMixRow(sourceRows);
  let total = 0;
  let hasValue = false;
  (Array.isArray(column.sourceColumns) ? column.sourceColumns : []).forEach((sourceColumn) => {
    const value = parseMatrixNumber(getRowCellValue(row, sourceColumn));
    const volumeMix = computeVolumeMixRatio(row, column, sourceColumn);
    const mix = volumeMix === null
      ? parseSubjectRatio(mixRow, mixRow && getRowCellValue(mixRow, sourceColumn))
      : volumeMix;
    if (value === null || mix === null) return;
    total += value * mix;
    hasValue = true;
  });
  if (hasValue) return total;
  return null;
}

function parseRowFormulaParamBindings(row = {}) {
  const candidates = [
    row.formulaParamBindings,
    row.templateItem && row.templateItem.formulaParamBindings,
  ];
  for (let index = 0; index < candidates.length; index += 1) {
    const value = candidates[index];
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "string") continue;
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_e) {
      // 忽略非法 JSON，继续尝试下一候选
    }
  }
  return [];
}

function findRowBySubjectId(rows = [], subjectId) {
  const expected = normalizeMatrixSubjectId(subjectId);
  if (!expected) return null;
  const list = Array.isArray(rows) ? rows : [];
  return list.find((item) => resolveMatrixRowSubjectId(item) === expected) || null;
}

/**
 * 解析比率小计的分子/分母行：显式路径优先，否则按公式参数绑定（两参 A/B，三参 (A+B)/C）。
 */
function resolveRatioComponentRows(row = {}, column = {}) {
  const sourceRows = getColumnSourceRows(column);
  const numeratorPath = safeText(row.ratioNumeratorPath || (column && column.ratioNumeratorPath));
  const denominatorPath = safeText(row.ratioDenominatorPath || (column && column.ratioDenominatorPath));
  if (numeratorPath && denominatorPath) {
    const numeratorRow = findRowByPath(sourceRows, numeratorPath);
    const denominatorRow = findRowByPath(sourceRows, denominatorPath);
    if (numeratorRow && denominatorRow) {
      return { mode: "divide", numeratorRows: [numeratorRow], denominatorRow };
    }
  }

  const bindings = parseRowFormulaParamBindings(row);
  if (!bindings.length) return null;

  const byCode = {};
  bindings.forEach((binding) => {
    const code = safeText(binding && binding.paramCode).replace(/\s+/g, "");
    if (!code) return;
    const hit = findRowBySubjectId(sourceRows, binding.subjectId);
    byCode[code] = hit;
    byCode[code.toUpperCase()] = hit;
  });

  const p1 = byCode["参数1"] || byCode.PARAM1 || byCode.NUMERATOR;
  const p2 = byCode["参数2"] || byCode.PARAM2 || byCode.DENOMINATOR;
  const p3 = byCode["参数3"] || byCode.PARAM3;
  if (p1 && p2 && p3) {
    return { mode: "sum_over", numeratorRows: [p1, p2], denominatorRow: p3 };
  }
  if (p1 && p2) {
    return { mode: "divide", numeratorRows: [p1], denominatorRow: p2 };
  }

  const componentRows = bindings
    .map((binding) => findRowBySubjectId(sourceRows, binding && binding.subjectId))
    .filter(Boolean);
  if (componentRows.length === 3) {
    return {
      mode: "sum_over",
      numeratorRows: [componentRows[0], componentRows[1]],
      denominatorRow: componentRows[2],
    };
  }
  if (componentRows.length === 2) {
    return { mode: "divide", numeratorRows: [componentRows[0]], denominatorRow: componentRows[1] };
  }
  return null;
}

function computeRatioFromComponentRows(components, readValue) {
  if (!components || !components.denominatorRow || typeof readValue !== "function") return null;
  const denominator = readValue(components.denominatorRow);
  if (denominator === null || denominator === 0) return null;
  const numeratorRows = Array.isArray(components.numeratorRows) ? components.numeratorRows : [];
  if (components.mode === "sum_over") {
    const parts = numeratorRows.map((item) => readValue(item));
    if (parts.some((num) => num === null)) return null;
    return parts.reduce((sum, num) => sum + num, 0) / denominator;
  }
  const numerator = numeratorRows.length ? readValue(numeratorRows[0]) : null;
  return aggregateRatio(numerator, denominator);
}

function ratioSubtotal(row, column) {
  const components = resolveRatioComponentRows(row, column);
  if (!components) return null;
  return computeRatioFromComponentRows(components, (componentRow) =>
    parseMatrixNumber(getDisplayAggregateValue(componentRow, column))
  );
}

export function getDisplayAggregateValue(row, column) {
  if (!row || !column) return "";
  const mode = safeText(column.aggregateMode).toUpperCase();
  if (mode === REVENUE_AGGREGATE_MODE.YEAR_SUBTOTAL) {
    return getYearSubtotalValue(row, column);
  }
  if (mode === REVENUE_AGGREGATE_MODE.LIFECYCLE) {
    return getLifecycleValue(row, column);
  }
  return "";
}

export function getYearSubtotalValue(row, column) {
  const sourceColumns = Array.isArray(column.sourceColumns) ? column.sourceColumns : [];
  const numbers = sourceColumns
    .map((item) => parseMatrixNumber(getRowCellValue(row, item)))
    .filter((num) => num !== null);
  if (!numbers.length) return "";

  const aggregate = resolveSubtotalAggregateFormula(row, column);
  if (isMixLikeRow(row)) {
    const mixSubtotal = computeMixSubtotalFromVolume(column);
    if (mixSubtotal !== null) return formatAggregateNumber(mixSubtotal, row);
  }
  if (aggregate === "weighted" || aggregate === "weighted_by_mix") {
    const weightedValue = weightedByMixSubtotal(row, column, numbers);
    if (weightedValue !== null) return formatAggregateNumber(weightedValue, row);
    return "";
  }
  if (aggregate === "ratio") {
    const ratioValue = ratioSubtotal(row, column);
    if (ratioValue !== null) return formatAggregateNumber(ratioValue, row);
    // 强制比率但无法解析分子分母时（如手工费率），回退销量加权，标签仍为「比率」
    if (isForcedRatioAggregateRow(row)) {
      const weightedValue = weightedByMixSubtotal(row, column, numbers);
      if (weightedValue !== null) return formatAggregateNumber(weightedValue, row);
    }
    return "";
  }
  if (aggregate === "avg" || aggregate === "average") {
    return formatAggregateNumber(numbers.reduce((sum, num) => sum + num, 0) / numbers.length, row);
  }
  if (aggregate === "max") return formatAggregateNumber(Math.max(...numbers), row);
  if (aggregate === "min") return formatAggregateNumber(Math.min(...numbers), row);
  return formatAggregateNumber(numbers.reduce((sum, num) => sum + num, 0), row);
}

export function getLifecycleValue(row, column) {
  const value = computeLifecycleNumber(row, column);
  if (value === null) return "";
  return formatAggregateNumber(value, row);
}

export function buildYearSubtotalColumn(year, yearIndex, sourceColumns = [], options = {}) {
  return {
    key: `y${yearIndex}_subtotal`,
    label: "小计/加权",
    yearLabel: year,
    yearIndex,
    trimId: "subtotal",
    trimName: "小计",
    real: false,
    displayOnly: true,
    aggregateMode: REVENUE_AGGREGATE_MODE.YEAR_SUBTOTAL,
    sourceColumns: sourceColumns.slice(),
    sourceRows: Array.isArray(options.sourceRows) ? options.sourceRows : [],
    detailRows: Array.isArray(options.detailRows) ? options.detailRows : [],
    aggregateSourceRows: Array.isArray(options.aggregateSourceRows) ? options.aggregateSourceRows : [],
    sourceDetails: Array.isArray(options.sourceDetails) ? options.sourceDetails : [],
    weightSourcePath: safeText(options.weightSourcePath),
  };
}

export function buildLifecycleColumn(sourceColumns = [], options = {}) {
  return {
    key: safeText(options.key, "lifecycle_subtotal"),
    label: safeText(options.label, LIFECYCLE_YEAR_LABEL),
    yearLabel: safeText(options.yearLabel, LIFECYCLE_YEAR_LABEL),
    yearIndex: -1,
    trimId: safeText(options.trimId, "subtotal"),
    trimName: safeText(options.trimName, "小计"),
    trimIndex: Number.isInteger(options.trimIndex) ? options.trimIndex : -1,
    real: false,
    displayOnly: true,
    aggregateMode: REVENUE_AGGREGATE_MODE.LIFECYCLE,
    sourceColumns: sourceColumns.slice(),
    allSourceColumns: Array.isArray(options.allSourceColumns) ? options.allSourceColumns.slice() : sourceColumns.slice(),
    sourceRows: Array.isArray(options.sourceRows) ? options.sourceRows : [],
    detailRows: Array.isArray(options.detailRows) ? options.detailRows : [],
    weightSourcePath: safeText(options.weightSourcePath),
    ratioNumeratorPath: safeText(options.ratioNumeratorPath),
    ratioDenominatorPath: safeText(options.ratioDenominatorPath),
  };
}

function normalizeTrimOption(item, fallbackIndex = 0) {
  if (item && typeof item === "object") {
    const trimId = safeText(item.trimId || item.id || item.code || item.name || item.label, `trim_${fallbackIndex + 1}`);
    return {
      trimId,
      trimName: safeText(item.trimName || item.name || item.label || trimId, trimId),
      trimIndex: Number.isInteger(item.trimIndex) ? Number(item.trimIndex) : fallbackIndex,
    };
  }
  const trimId = safeText(item, `trim_${fallbackIndex + 1}`);
  return {
    trimId,
    trimName: trimId,
    trimIndex: fallbackIndex,
  };
}

function buildRealYearTrimColumn(year, yearIndex, trim) {
  return {
    key: `y${yearIndex}_t${trim.trimId}`,
    label: trim.trimName,
    yearLabel: year,
    yearIndex,
    trimId: trim.trimId,
    trimName: trim.trimName,
    trimIndex: trim.trimIndex,
    real: true,
    displayOnly: false,
    aggregateMode: REVENUE_AGGREGATE_MODE.NONE,
  };
}

function resolveLifecycleTrimOptions(trims, yearIndex, options = {}) {
  if (typeof options.resolveYearTrimOptions === "function") {
    return options.resolveYearTrimOptions(yearIndex).map((item, index) => normalizeTrimOption(item, index));
  }
  return (Array.isArray(trims) ? trims : []).map((item, index) => normalizeTrimOption(item, index));
}

export function buildLifecycleTrimColumns(realYears = [], trims = [], options = {}) {
  const years = normalizeRealYears(realYears);
  const normalizedTrims = (Array.isArray(trims) ? trims : [])
    .map((item, index) => normalizeTrimOption(item, index))
    .filter((trim) => trim.trimId && !isVirtualTrimValue(trim.trimId) && !isVirtualTrimValue(trim.trimName));
  const allSourceColumns = [];

  years.forEach((year, yearIndex) => {
    resolveLifecycleTrimOptions(normalizedTrims, yearIndex, options).forEach((trim) => {
      if (isVirtualTrimValue(trim.trimId) || isVirtualTrimValue(trim.trimName)) return;
      allSourceColumns.push(buildRealYearTrimColumn(year, yearIndex, trim));
    });
  });

  return normalizedTrims
    .map((trim) => {
      const sourceColumns = [];
      years.forEach((year, yearIndex) => {
        const yearTrim =
          resolveLifecycleTrimOptions(normalizedTrims, yearIndex, options).find((item) => item.trimId === trim.trimId) ||
          null;
        if (!yearTrim) return;
        sourceColumns.push(buildRealYearTrimColumn(year, yearIndex, yearTrim));
      });
      if (!sourceColumns.length) return null;
      return buildLifecycleColumn(sourceColumns, {
        ...options,
        key: safeText(options.keyPrefix ? `${options.keyPrefix}_${trim.trimId}` : "", `lifecycle_${trim.trimId}`),
        label: trim.trimName,
        trimId: trim.trimId,
        trimName: trim.trimName,
        trimIndex: trim.trimIndex,
        allSourceColumns,
      });
    })
    .filter(Boolean);
}

export function buildLifecycleSubtotalColumn(lifecycleTrimColumns = [], options = {}) {
  const sourceColumns = [];
  const allSourceColumns = [];
  (Array.isArray(lifecycleTrimColumns) ? lifecycleTrimColumns : []).forEach((column) => {
    if (Array.isArray(column.sourceColumns)) sourceColumns.push(...column.sourceColumns);
    if (Array.isArray(column.allSourceColumns)) allSourceColumns.push(...column.allSourceColumns);
  });
  const uniqueAllColumns = [];
  const seen = {};
  (allSourceColumns.length ? allSourceColumns : sourceColumns).forEach((column) => {
    const key = `${safeText(column.yearIndex)}__${safeText(column.trimId)}__${safeText(column.trimIndex)}`;
    if (seen[key]) return;
    seen[key] = true;
    uniqueAllColumns.push(column);
  });
  return buildLifecycleColumn(sourceColumns, {
    ...options,
    key: safeText(options.key, "lifecycle_subtotal"),
    label: safeText(options.label, "小计/加权"),
    trimId: "subtotal",
    trimName: "小计",
    allSourceColumns: uniqueAllColumns,
  });
}
