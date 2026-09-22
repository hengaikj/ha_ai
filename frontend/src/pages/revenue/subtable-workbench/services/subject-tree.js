import {
  AUDIT_DOMAIN,
  REVENUE_MODULE_CODE,
} from "../domain-config";
import { safeText, toMaybeLong } from "./workbench-utils";

function filterEnabledSubjectTreeNodes(nodes = []) {
  return (Array.isArray(nodes) ? nodes : []).reduce((result, node) => {
    if (!node || typeof node !== "object") return result;
    if (node.enabled === false) return result;
    const originalChildren = Array.isArray(node.children) ? node.children : [];
    const children = filterEnabledSubjectTreeNodes(originalChildren);
    const explicitLeaf = node.leaf === true;
    if (originalChildren.length && !children.length && !explicitLeaf) return result;
    result.push({
      ...node,
      children,
    });
    return result;
  }, []);
}

export function normalizeSubjectTreeResult(payload) {
  const data = payload && typeof payload === "object" ? payload.data : null;
  if (Array.isArray(data)) {
    return {
      ...(payload || {}),
      data: {
        subjects: filterEnabledSubjectTreeNodes(data),
      },
    };
  }
  if (data && typeof data === "object" && Array.isArray(data.subjects)) {
    return {
      ...(payload || {}),
      data: {
        ...data,
        subjects: filterEnabledSubjectTreeNodes(data.subjects),
      },
    };
  }
  return {
    ...(payload || {}),
    data: {
      ...(data && typeof data === "object" ? data : {}),
      subjects: [],
    },
  };
}

export function getSubjectNodes(payload) {
  const normalized = normalizeSubjectTreeResult(payload);
  const data = normalized && normalized.data ? normalized.data : {};
  return Array.isArray(data.subjects) ? data.subjects : [];
}

function resolveDisplayRootMeta(metaPath = []) {
  const list = Array.isArray(metaPath) ? metaPath.filter(Boolean) : [];
  return list.length > 1 ? list[1] : (list[0] || null);
}

function buildSubjectSortPath(metaPath = []) {
  return (Array.isArray(metaPath) ? metaPath : []).map((item) => {
    const number = Number(item && item.sortOrder);
    return Number.isFinite(number) ? number : 0;
  });
}

function buildSubjectIdPath(metaPath = []) {
  return (Array.isArray(metaPath) ? metaPath : [])
    .map((item) => safeText(item && (item.id || item.name)))
    .filter(Boolean);
}

export function collectPermissionLeafRows(nodes = [], parentPath = [], bucket = [], rootMeta = null, metaPath = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  list.forEach((node) => {
    if (!node || typeof node !== "object") return;
    const name = safeText(node.subjectName || node.name);
    const children = Array.isArray(node.children) ? node.children : [];
    const nextPath = name ? parentPath.concat(name) : parentPath.slice();
    const currentMeta = {
      id: safeText(node.subjectId || node.id),
      name: name || safeText(node.subjectName || node.name || node.id, "未分组"),
      sortOrder: Number(node.sortOrder || 0),
    };
    const nextMetaPath = currentMeta.id || currentMeta.name ? metaPath.concat(currentMeta) : metaPath.slice();
    const displayRootMeta = resolveDisplayRootMeta(nextMetaPath);
    const nextRootMeta =
      rootMeta ||
      {
        rootSubjectId: currentMeta.id,
        rootSubjectName: currentMeta.name,
        rootSortOrder: currentMeta.sortOrder,
      };
    const isLeaf = Boolean(node.leaf) || children.length === 0;
    if (isLeaf) {
      const subjectId = safeText(node.subjectId || node.id);
      if (!subjectId) return;
      bucket.push({
        id: subjectId,
        subjectId,
        subjectCode: safeText(node.subjectCode),
        subjectName: name || subjectId,
        fullNamePath: nextPath.join("/"),
        path: nextPath.slice(),
        unit: safeText(node.unit),
        subtable: nextPath[0] || "未分组",
        rootSubjectId: nextRootMeta.rootSubjectId,
        rootSubjectName: nextRootMeta.rootSubjectName,
        rootSortOrder: nextRootMeta.rootSortOrder,
        displayRootSubjectId: safeText(displayRootMeta && displayRootMeta.id, nextRootMeta.rootSubjectId),
        displayRootSortOrder: Number(displayRootMeta && displayRootMeta.sortOrder),
        subjectSortPath: buildSubjectSortPath(nextMetaPath),
        subjectIdPath: buildSubjectIdPath(nextMetaPath),
        level: Number(node.level || 0),
        sortOrder: Number(node.sortOrder || 0),
        directPermissionConfigured: node.directPermissionConfigured === true,
        directPermissionId: node.directPermissionId,
        directPermissionLevel: safeText(node.directPermissionLevel),
        directGrantScope: safeText(node.directGrantScope),
        directEnabled: node.directEnabled === true,
        effectivePermissionLevel: safeText(node.effectivePermissionLevel),
        editable: node.editable === true,
        readonlyReason: safeText(node.readonlyReason),
        templateItem: node.templateItem,
        templateSubject: node.templateSubject === true,
        templateEntryMode: safeText(node.templateEntryMode || node.entryMode),
        entryMode: safeText(node.entryMode || node.templateEntryMode),
        formulaId: node.formulaId,
        formulaCode: safeText(node.formulaCode),
        formulaExpression: safeText(node.formulaExpression),
        formulaParamBindings: Array.isArray(node.formulaParamBindings)
          ? node.formulaParamBindings
          : [],
      });
      return;
    }
    collectPermissionLeafRows(children, nextPath, bucket, nextRootMeta, nextMetaPath);
  });
  return bucket;
}

export function buildSubjectIdFilterFromTree(subjectTreePayload) {
  return collectPermissionLeafRows(getSubjectNodes(subjectTreePayload))
    .map((item) => toMaybeLong(item && item.subjectId))
    .filter((item, index, list) => item != null && list.indexOf(item) === index);
}

const MAIN_SUBJECT_ROOT_NAMES = Object.freeze(["主表", "单车收益", "项目利润"]);

function isMainSubjectTreeName(value) {
  const name = safeText(value);
  return MAIN_SUBJECT_ROOT_NAMES.includes(name);
}

function filterMainSubjectTreeNodes(nodes = [], insideMain = false) {
  const list = Array.isArray(nodes) ? nodes : [];
  return list.reduce((result, node) => {
    if (!node || typeof node !== "object") return result;
    const name = safeText(node.subjectName || node.name);
    const nextInsideMain = insideMain || isMainSubjectTreeName(name);
    const children = Array.isArray(node.children) ? node.children : [];
    const nextChildren = nextInsideMain
      ? children
      : filterMainSubjectTreeNodes(children, false);
    if (nextInsideMain || nextChildren.length) {
      result.push({
        ...node,
        children: nextChildren,
      });
    }
    return result;
  }, []);
}

export function filterMainSubjectTreePayload(payload) {
  const normalized = normalizeSubjectTreeResult(payload);
  if (safeText(normalized && normalized.data && normalized.data.__mainFiltered) === "1") {
    return normalized;
  }
  return {
    ...normalized,
    data: {
      ...(normalized && normalized.data && typeof normalized.data === "object"
        ? normalized.data
        : {}),
      __mainFiltered: "1",
      subjects: filterMainSubjectTreeNodes(getSubjectNodes(normalized)),
    },
  };
}

export function shouldIncludeReadonlySubtablesInMain(params = {}) {
  const value = params.includeReadonlySubtablesInMain ||
    params.includeReadonlySubtables ||
    params.includeSubtableReadonly;
  if (value === true || value === 1) return true;
  const text = safeText(value).toLowerCase();
  return text === "1" || text === "true" || text === "yes" || text === "y";
}

export function shouldUseMainOnlyWorkbenchTree(ctx = {}) {
  if (safeText(ctx.subjectDomain).toLowerCase() !== AUDIT_DOMAIN.MAIN_TABLE) return false;
  return false;
}

export function buildMainWorkbenchContext(ctx = {}, flowSnapshot = null) {
  const mainOnly = shouldUseMainOnlyWorkbenchTree(ctx, flowSnapshot);
  return {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
    includeReadonlySubtablesInMain: !mainOnly,
  };
}

export function isMainWorkbenchMainModule(ctx = {}) {
  const moduleCode = safeText(ctx.moduleCode || ctx.moduleKey || ctx.key);
  if (moduleCode === REVENUE_MODULE_CODE.MAIN_PNL) return true;
  const moduleName = safeText(ctx.moduleName || ctx.rootSubjectName || ctx.name);
  return isMainSubjectTreeName(moduleName);
}

export function isMainWorkbenchReadonlySubtableModule(ctx = {}) {
  return safeText(ctx.subjectDomain).toLowerCase() === AUDIT_DOMAIN.MAIN_TABLE &&
    !isMainWorkbenchMainModule(ctx);
}

export function isFullTemplateSubjectScope(params = {}) {
  return safeText(params && params.subjectScope).toLowerCase() === "template";
}

export function normalizeSubjectTreeForDomain(payload, params = {}) {
  if (
    safeText(params.subjectDomain).toLowerCase() === "main" &&
    !shouldIncludeReadonlySubtablesInMain(params)
  ) {
    return filterMainSubjectTreePayload(payload);
  }
  return payload;
}

function hasNonNonePermissionLevel(value) {
  const level = safeText(value).toUpperCase();
  if (!level) return false;
  return level !== "NONE" && level !== "NO_PERMISSION" && level !== "DISABLED";
}

function readNodeEffectivePermissionLevel(node = {}) {
  return safeText(node.effectivePermissionLevel);
}

function isNodeAllowed(node) {
  if (!node || typeof node !== "object") return false;
  return hasNonNonePermissionLevel(readNodeEffectivePermissionLevel(node));
}

function filterPermissionTreeByGrant(nodes = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  const filtered = [];
  list.forEach((node) => {
    if (!node || typeof node !== "object") return;
    const children = Array.isArray(node.children) ? node.children : [];
    const nextChildren = children.length
      ? filterPermissionTreeByGrant(children)
      : [];
    const selfAllowed = isNodeAllowed(node);
    const shouldKeep = selfAllowed || nextChildren.length > 0;
    if (!shouldKeep) return;
    filtered.push({
      ...node,
      children: nextChildren,
    });
  });
  return filtered;
}

export function filterPermissionTreePayload(payload) {
  const normalized = normalizeSubjectTreeResult(payload);
  const subjects = getSubjectNodes(normalized);
  const filteredSubjects = filterPermissionTreeByGrant(subjects);
  return {
    ...normalized,
    data: {
      ...(normalized && normalized.data && typeof normalized.data === "object"
        ? normalized.data
        : {}),
      subjects: filteredSubjects,
    },
  };
}

export function readRevenueSubjectPermissionLevel(source = {}) {
  return safeText(
    source && (
      source.effectivePermissionLevel ||
      source.permissionLevel ||
      source.directPermissionLevel
    )
  ).toUpperCase();
}

export function hasExplicitRevenueSubjectPermission(source = {}) {
  return Boolean(readRevenueSubjectPermissionLevel(source));
}

export function canReadRevenueSubject(source = {}) {
  const level = readRevenueSubjectPermissionLevel(source);
  if (!level) return true;
  return level !== "NONE" && level !== "NO_PERMISSION" && level !== "DISABLED";
}

export function isAuthorizedRevenueSubject(source = {}) {
  return hasExplicitRevenueSubjectPermission(source) && canReadRevenueSubject(source);
}

export function canWriteRevenueSubject(source = {}) {
  const level = readRevenueSubjectPermissionLevel(source);
  if (!level) return true;
  return level === "DATA_ENTRY" || level === "WRITE" || level === "WRITABLE";
}
