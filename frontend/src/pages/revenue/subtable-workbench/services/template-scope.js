import { canWriteRevenueSubject, getSubjectNodes, normalizeSubjectTreeResult } from "./subject-tree";
import { safeText, toMaybeLong } from "./workbench-utils";

export function assertTemplateItemRuntimeReady(item = {}) {
  if (!item || item.subjectId == null) return;
  if (safeText(item.entryMode).toUpperCase() !== "CALCULATED") return;
  if (item.formulaId == null && !safeText(item.formulaCode)) {
    throw new Error(`模板科目缺少公式配置：subjectId=${item.subjectId}`);
  }
  if (!Array.isArray(item.formulaParamBindings) || !item.formulaParamBindings.length) {
    throw new Error(`模板科目缺少公式参数绑定：subjectId=${item.subjectId}`);
  }
}

export function normalizeBackendEntryMode(value, message = "后端模板返回科目录入模式缺失") {
  const mode = safeText(value).toUpperCase();
  if (!mode) throw new Error(message);
  if (["MANUAL", "CALCULATED", "DATA_QUERY", "DERIVED"].includes(mode)) return mode;
  throw new Error(`后端模板返回未知科目录入模式：${mode || "-"}`);
}

export function rowKindFromBackendEntryMode(entryMode) {
  if (entryMode === "CALCULATED") return "formula";
  if (entryMode === "DERIVED") return "formula";
  if (entryMode === "DATA_QUERY") return "linked";
  return "input";
}

export function valueSourceFromBackendEntryMode(entryMode) {
  if (entryMode === "CALCULATED") return "formula";
  if (entryMode === "DERIVED") return "derived";
  if (entryMode === "DATA_QUERY") return "linked";
  return "input";
}

const DIAGNOSTIC_CANDIDATE_LIMIT = 5;
const MAIN_SUBJECT_ROOT_NAMES = Object.freeze(["主表", "单车收益", "项目利润"]);

function addDiagnosticIndexEntry(index = {}, key, item = {}) {
  const normalizedKey = safeText(key);
  if (!normalizedKey) return;
  if (!index[normalizedKey]) index[normalizedKey] = [];
  index[normalizedKey].push(item);
}

function summarizeSubjectTreeNode(node = {}, path = []) {
  const rawSubjectId = node.subjectId || node.id;
  const subjectId = toMaybeLong(rawSubjectId);
  const children = Array.isArray(node.children) ? node.children : [];
  return {
    subjectId: subjectId == null ? safeText(rawSubjectId) : subjectId,
    subjectCode: safeText(node.subjectCode),
    subjectName: safeText(node.subjectName || node.name),
    path: path.join("/"),
    enabled: node.enabled,
    effectivePermissionLevel: safeText(node.effectivePermissionLevel),
    leaf: Boolean(node.leaf) || children.length === 0,
  };
}

function collectSubjectTreeDiagnostics(nodes = [], parentPath = [], bucket = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  list.forEach((node) => {
    if (!node || typeof node !== "object") return;
    const name = safeText(node.subjectName || node.name || node.subjectId || node.id, "未命名科目");
    const nextPath = name ? parentPath.concat(name) : parentPath.slice();
    bucket.push(summarizeSubjectTreeNode(node, nextPath));
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length) collectSubjectTreeDiagnostics(children, nextPath, bucket);
  });
  return bucket;
}

function buildSubjectTreeDiagnosticIndex(nodes = []) {
  const summaries = collectSubjectTreeDiagnostics(nodes);
  const bySubjectId = {};
  const bySubjectCode = {};
  const bySubjectName = {};
  const subjectIdSet = new Set();
  summaries.forEach((item) => {
    const idText = safeText(item.subjectId);
    if (idText) subjectIdSet.add(idText);
    addDiagnosticIndexEntry(bySubjectId, item.subjectId, item);
    addDiagnosticIndexEntry(bySubjectCode, item.subjectCode, item);
    addDiagnosticIndexEntry(bySubjectName, item.subjectName, item);
  });
  return {
    subjectIdSet,
    subjectCount: summaries.length,
    bySubjectId,
    bySubjectCode,
    bySubjectName,
  };
}

function pickDiagnosticCandidates(index = {}, key) {
  const normalizedKey = safeText(key);
  if (!normalizedKey || !Array.isArray(index[normalizedKey])) return [];
  return index[normalizedKey].slice(0, DIAGNOSTIC_CANDIDATE_LIMIT);
}

function getDiagnosticCandidates(index = {}, key) {
  const normalizedKey = safeText(key);
  if (!normalizedKey || !Array.isArray(index[normalizedKey])) return [];
  return index[normalizedKey];
}

function splitSubjectPath(value) {
  if (Array.isArray(value)) return value.map((item) => safeText(item)).filter(Boolean);
  return safeText(value)
    .split(/[/>＞｜|]/)
    .map((item) => safeText(item))
    .filter(Boolean);
}

function readTemplateItemPathSegments(item = {}) {
  const pathSegments = splitSubjectPath(
    item.fullNamePath ||
      item.subjectPath ||
      item.fullPath ||
      item.path ||
      item.pathText
  );
  if (pathSegments.length) return pathSegments;
  return splitSubjectPath(item.rootSubjectName || item.moduleName || item.subtable);
}

function hasTemplateItemPathHint(item = {}) {
  return readTemplateItemPathSegments(item).length > 0;
}

function isMainTemplateItem(item = {}) {
  const pathSegments = readTemplateItemPathSegments(item);
  if (!pathSegments.length) return true;
  return pathSegments.some((segment) => MAIN_SUBJECT_ROOT_NAMES.includes(segment));
}

function isMainSubjectPath(value) {
  const pathSegments = splitSubjectPath(value);
  return pathSegments.some((segment) => MAIN_SUBJECT_ROOT_NAMES.includes(segment));
}

function isExactFullTreeNonMainItem(item = {}, fullTreeIndex = null) {
  if (!fullTreeIndex || !fullTreeIndex.bySubjectId) return false;
  const candidates = getDiagnosticCandidates(fullTreeIndex.bySubjectId, item.subjectId);
  if (!candidates.length) return false;
  return candidates.every((candidate) => !isMainSubjectPath(candidate.path));
}

function isExactFullTreeMainItem(item = {}, fullTreeIndex = null) {
  if (!fullTreeIndex || !fullTreeIndex.bySubjectId) return false;
  const candidates = getDiagnosticCandidates(fullTreeIndex.bySubjectId, item.subjectId);
  if (!candidates.length) return false;
  return candidates.some((candidate) => isMainSubjectPath(candidate.path));
}

function shouldIgnoreMissingMainFilteredTemplateItem(
  item = {},
  normalized = {},
  treeIndex = {},
  options = {},
  fullTreeIndex = null
) {
  const data = normalized && normalized.data && typeof normalized.data === "object"
    ? normalized.data
    : {};
  if (safeText(options.subjectDomain).toLowerCase() !== "main") return false;
  if (safeText(data.__mainFiltered) !== "1") return false;

  const subjectCode = safeText(item.subjectCode);
  const sameCodeCandidates = pickDiagnosticCandidates(treeIndex.bySubjectCode, subjectCode);
  const sameNameCandidates = pickDiagnosticCandidates(treeIndex.bySubjectName, item.subjectName);
  if (sameCodeCandidates.length) return false;
  if (!subjectCode && sameNameCandidates.length) return false;

  if (hasTemplateItemPathHint(item)) {
    if (!isMainTemplateItem(item)) return true;
    return isExactFullTreeNonMainItem(item, fullTreeIndex);
  }
  if (isExactFullTreeMainItem(item, fullTreeIndex)) return false;
  return true;
}

function buildMissingTemplateSubjectDiagnostics(missingItems = [], treeIndex = {}, fullTreeIndex = null) {
  return missingItems.map((item = {}) => {
    const subjectId = item.subjectId;
    const fullTreeContainsSubjectId = fullTreeIndex && fullTreeIndex.subjectIdSet
      ? fullTreeIndex.subjectIdSet.has(safeText(subjectId))
      : false;
    return {
      templateItemId: item.id,
      templateId: item.templateId,
      templateSubjectId: subjectId,
      subjectCode: safeText(item.subjectCode),
      subjectName: safeText(item.subjectName),
      entryMode: safeText(item.entryMode),
      sortOrder: item.sortOrder,
      currentTreeContainsSubjectId: treeIndex.subjectIdSet
        ? treeIndex.subjectIdSet.has(safeText(subjectId))
        : false,
      sameCodeCandidates: pickDiagnosticCandidates(treeIndex.bySubjectCode, item.subjectCode),
      sameNameCandidates: pickDiagnosticCandidates(treeIndex.bySubjectName, item.subjectName),
      fullTreeContainsSubjectId,
      fullTreeSubjectIdCandidates: fullTreeIndex
        ? pickDiagnosticCandidates(fullTreeIndex.bySubjectId, subjectId)
        : [],
      fullTreeSameCodeCandidates: fullTreeIndex
        ? pickDiagnosticCandidates(fullTreeIndex.bySubjectCode, item.subjectCode)
        : [],
      fullTreeSameNameCandidates: fullTreeIndex
        ? pickDiagnosticCandidates(fullTreeIndex.bySubjectName, item.subjectName)
        : [],
    };
  });
}

function warnTemplateSubjectScopeMismatch(
  missingItems = [],
  flowSnapshot = {},
  normalized = {},
  options = {},
  treeIndexOverride = null,
  fullTreeIndexOverride = null
) {
  if (!missingItems.length || typeof console === "undefined" || typeof console.warn !== "function") return;
  const treeIndex = treeIndexOverride || buildSubjectTreeDiagnosticIndex(getSubjectNodes(normalized));
  const fullTreeIndex = fullTreeIndexOverride || null;
  const template = flowSnapshot.template && typeof flowSnapshot.template === "object"
    ? flowSnapshot.template
    : {};
   
  console.warn("[Revenue Template Scope] 模板科目无法按 subjectId 匹配当前科目树", {
    flowId: flowSnapshot.flowId,
    templateId: flowSnapshot.templateId,
    templateCode: safeText(template.templateCode),
    templateName: safeText(template.templateName),
    missingCount: missingItems.length,
    subjectTreeNodeCount: treeIndex.subjectCount,
    fullSubjectTreeNodeCount: fullTreeIndex ? fullTreeIndex.subjectCount : undefined,
    context: {
      flowId: flowSnapshot.flowId,
      stage: safeText(options.stage || options.stageCode),
      subjectDomain: safeText(options.subjectDomain),
      subjectApiMode: safeText(options.subjectApiMode),
    },
    missingSubjects: buildMissingTemplateSubjectDiagnostics(missingItems, treeIndex, fullTreeIndex),
  });
}

function buildTemplateScopedSubjectNode(node = {}, templateContext = {}) {
  if (!node || typeof node !== "object") return null;
  const children = Array.isArray(node.children) ? node.children : [];
  const nextChildren = children
    .map((child) => buildTemplateScopedSubjectNode(child, templateContext))
    .filter(Boolean);
  const subjectId = toMaybeLong(node.subjectId || node.id);
  const item = subjectId == null
    ? null
    : templateContext.itemBySubjectId[String(subjectId)];
  if (!item && !nextChildren.length) return null;

  if (item) {
    templateContext.matchedSubjectIds.add(String(item.subjectId));
    assertTemplateItemRuntimeReady(item);
  }

  // 诊断日志：输出 entryMode 来源
  if (item && item.entryMode && String(subjectId) === "4") {
    console.log("[ENTRY_MODE诊断] MIX行 templateItem:", {
      subjectId: item.subjectId,
      entryMode: item.entryMode,
      formulaId: item.formulaId,
      formulaExpression: item.formulaExpression,
      formulaParamBindingsLen: Array.isArray(item.formulaParamBindings) ? item.formulaParamBindings.length : 0,
      keys: Object.keys(item),
    });
  }

  const entryMode = item
    ? normalizeBackendEntryMode(item.entryMode, `模板科目录入模式缺失：subjectId=${item.subjectId}`)
    : "GROUP";
  const writable = item ? (templateContext.adminScope || canWriteRevenueSubject(node)) : false;
  const formulaReadonly = entryMode === "CALCULATED" || entryMode === "DERIVED";
  const editable = Boolean(item && writable && !formulaReadonly);
  const readonlyReason = editable
    ? ""
    : formulaReadonly
      ? "FORMULA"
      : item && !writable
        ? "NO_PERMISSION"
        : "TEMPLATE_GROUP";

  return {
    ...node,
    children: nextChildren,
    templateItem: item || undefined,
    templateSubject: Boolean(item),
    templateEntryMode: entryMode,
    entryMode,
    formulaId: item ? item.formulaId : node.formulaId,
    formulaCode: item ? item.formulaCode : node.formulaCode,
    formulaExpression: item ? item.formulaExpression : node.formulaExpression,
    formulaParamBindings: item ? item.formulaParamBindings : node.formulaParamBindings,
    visible: true,
    editable,
    readonlyReason,
  };
}

export function applyTemplateSubjectScope(payload, flowSnapshot = {}, options = {}) {
  const normalized = normalizeSubjectTreeResult(payload);
  const templateItems = Array.isArray(flowSnapshot.templateItems)
    ? flowSnapshot.templateItems
    : [];
  if (!templateItems.length) {
    throw new Error("当前流程模板未配置科目，无法打开工作台");
  }

  const templateContext = {
    itemBySubjectId: flowSnapshot.templateItemBySubjectId || {},
    matchedSubjectIds: new Set(),
    adminScope: options.adminScope === true,
  };
  const scopedSubjects = getSubjectNodes(normalized)
    .map((node) => buildTemplateScopedSubjectNode(node, templateContext))
    .filter(Boolean);
  const unmatchedItems = templateItems.filter((item) =>
    item.subjectId != null && !templateContext.matchedSubjectIds.has(String(item.subjectId))
  );
  let missingItems = unmatchedItems;
  let treeIndex = null;
  let fullTreeIndex = null;
  if (unmatchedItems.length) {
    treeIndex = buildSubjectTreeDiagnosticIndex(getSubjectNodes(normalized));
    if (options.fullSubjectTreePayload) {
      fullTreeIndex = buildSubjectTreeDiagnosticIndex(getSubjectNodes(options.fullSubjectTreePayload));
    }
    missingItems = unmatchedItems.filter((item) =>
      !shouldIgnoreMissingMainFilteredTemplateItem(item, normalized, treeIndex, options, fullTreeIndex)
    );
  }
  if (missingItems.length) {
    warnTemplateSubjectScopeMismatch(missingItems, flowSnapshot, normalized, options, treeIndex, fullTreeIndex);
    const sample = missingItems
      .slice(0, 5)
      .map((item) => `${item.subjectName || item.subjectCode || item.subjectId}`)
      .join("、");
    throw new Error(`模板科目无法在后端科目树中匹配：${sample}`);
  }

  return {
    ...normalized,
    data: {
      ...(normalized && normalized.data && typeof normalized.data === "object"
        ? normalized.data
        : {}),
      flowId: flowSnapshot.flowId,
      templateId: flowSnapshot.templateId,
      templateCode: flowSnapshot.template && flowSnapshot.template.templateCode,
      templateName: flowSnapshot.template && flowSnapshot.template.templateName,
      subjects: scopedSubjects,
    },
  };
}
