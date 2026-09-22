import {
  AUDIT_DOMAIN,
  REVENUE_MODULE_CODE,
} from "../domain-config";
import {
  buildBackendTemplateRow,
} from "./detail-builder";
import {
  findFormulaDependencySubjectIds,
  getFormulaSourceRowPath,
  isSalesVolumeFormulaSourcePath,
  rowDependsOnSalesVolumeFormulaSource,
} from "./formula-source";
import {
  collectPermissionLeafRows,
  getSubjectNodes,
  isAuthorizedRevenueSubject,
  normalizeSubjectTreeResult,
} from "./subject-tree";
import {
  normalizeSubjectIdFilterList,
  safeText,
  toMaybeLong,
} from "./workbench-utils";

export function buildSubtableModuleKey(rootNode = {}, index = 0) {
  const rootSubjectId = safeText(rootNode.subjectId || rootNode.id || rootNode.subjectCode);
  const rootSubjectName = safeText(rootNode.subjectName || rootNode.name || rootNode.label, `子表${index + 1}`);
  return `module:${rootSubjectId || rootSubjectName || index + 1}`;
}

export function buildSubtableModuleLoadPlan(subjectTreePayload) {
  const roots = getSubjectNodes(subjectTreePayload);
  const plans = roots
    .map((rootNode, index) => {
      const leafRows = collectPermissionLeafRows([rootNode]);
      const subjectIds = leafRows
        .map((item) => toMaybeLong(item && item.subjectId))
        .filter((item, itemIndex, list) => item != null && list.indexOf(item) === itemIndex);
      if (!subjectIds.length) return null;

      const rootSubjectId = safeText(rootNode.subjectId || rootNode.id || rootNode.subjectCode);
      const rootSubjectName = safeText(rootNode.subjectName || rootNode.name || rootNode.label, `子表${index + 1}`);
      const containsSalesVolumeSource = leafRows.some((item) =>
        isSalesVolumeFormulaSourcePath(item && item.path)
      );
      return {
        key: buildSubtableModuleKey(rootNode, index),
        moduleKey: buildSubtableModuleKey(rootNode, index),
        moduleName: rootSubjectName,
        rootSubjectId,
        rootSubjectName,
        subjectIds,
        subjectIdCount: subjectIds.length,
        orderIndex: index,
        containsSalesVolumeSource,
      };
    })
    .filter(Boolean);

  return plans.slice().sort((left, right) => {
    if (left.containsSalesVolumeSource !== right.containsSalesVolumeSource) {
      return left.containsSalesVolumeSource ? -1 : 1;
    }
    return left.orderIndex - right.orderIndex;
  });
}

export function buildReadonlyAuthorizedSubjectIdMap(subjectTreePayload, { isSuperAdmin = false } = {}) {
  return collectPermissionLeafRows(getSubjectNodes(subjectTreePayload))
    .filter((row) => {
      // 超级管理员可直接查看所有科目，无需显式权限级别（permissionLevel）
      if (isSuperAdmin) return true;
      return isAuthorizedRevenueSubject(row);
    })
    .reduce((result, row) => {
      const subjectId = safeText(row && row.subjectId);
      if (subjectId) result[subjectId] = true;
      return result;
    }, {});
}

export function filterSubjectTreeNodesBySubjectIdMap(nodes = [], subjectIdMap = {}) {
  return (Array.isArray(nodes) ? nodes : []).reduce((result, node) => {
    if (!node || typeof node !== "object") return result;
    const children = filterSubjectTreeNodesBySubjectIdMap(node.children || [], subjectIdMap);
    const subjectId = safeText(node.subjectId || node.id);
    const keepSelf = Boolean(subjectId && subjectIdMap[subjectId]);
    if (!keepSelf && !children.length) return result;
    result.push({
      ...node,
      leaf: children.length ? false : node.leaf,
      children,
    });
    return result;
  }, []);
}

export function filterSubjectTreePayloadBySubjectIdMap(subjectTreePayload, subjectIdMap = {}) {
  const normalized = normalizeSubjectTreeResult(subjectTreePayload);
  return {
    ...normalized,
    data: {
      ...(normalized && normalized.data && typeof normalized.data === "object"
        ? normalized.data
        : {}),
      subjects: filterSubjectTreeNodesBySubjectIdMap(getSubjectNodes(normalized), subjectIdMap),
    },
  };
}

export function buildReadonlyAuthorizedModuleLoadPlan(subjectTreePayload, options = {}) {
  const subjectIdMap = buildReadonlyAuthorizedSubjectIdMap(subjectTreePayload, options);
  return buildSubtableModuleLoadPlan(
    filterSubjectTreePayloadBySubjectIdMap(subjectTreePayload, subjectIdMap)
  );
}

export function appendUniqueSubjectIds(target = [], ids = []) {
  normalizeSubjectIdFilterList(ids).forEach((id) => {
    if (!target.includes(id)) target.push(id);
  });
  return target;
}

export function buildFormulaDependencyRowsFromTree(subjectTreePayload) {
  return collectPermissionLeafRows(getSubjectNodes(subjectTreePayload)).map((item) =>
    buildBackendTemplateRow({
      id: item.id,
      rowId: item.id,
      subjectId: item.subjectId,
      subjectCode: item.subjectCode,
      subject: item.subjectName,
      fullNamePath: item.fullNamePath || item.subjectName,
      subjectPath: Array.isArray(item.path) ? item.path.slice() : [],
      subjectTreePath: Array.isArray(item.path) ? item.path.slice() : [],
      unit: item.unit || "",
      subtable: item.subtable,
      rootSubjectId: item.rootSubjectId,
      rootSubjectName: item.rootSubjectName || item.subtable,
      rootSortOrder: item.rootSortOrder,
      displayRootSubjectId: item.displayRootSubjectId,
      displayRootSortOrder: item.displayRootSortOrder,
      subjectSortPath: item.subjectSortPath,
      subjectIdPath: item.subjectIdPath,
      sortOrder: item.sortOrder,
      directPermissionConfigured: item.directPermissionConfigured,
      directPermissionId: item.directPermissionId,
      directPermissionLevel: item.directPermissionLevel,
      directGrantScope: item.directGrantScope,
      directEnabled: item.directEnabled,
      effectivePermissionLevel: item.effectivePermissionLevel,
      editable: item.editable,
      readonlyReason: item.readonlyReason,
      templateItem: item.templateItem,
      templateSubject: item.templateSubject,
      templateEntryMode: item.templateEntryMode,
      entryMode: item.entryMode,
      formulaId: item.formulaId,
      formulaCode: item.formulaCode,
      formulaExpression: item.formulaExpression,
      formulaParamBindings: item.formulaParamBindings,
      isRealSubject: true,
    })
  );
}

export function resolveReadonlyAuthorizedDependencySubjectIds(ctx = {}, subjectTreePayload, visibleSubjectIds = []) {
  if (!ctx.readonlyAuthorizedScope) return [];
  const visibleIds = normalizeSubjectIdFilterList(visibleSubjectIds);
  if (!visibleIds.length) return [];
  const visibleIdMap = visibleIds.reduce((result, id) => {
    result[safeText(id)] = true;
    return result;
  }, {});
  const rows = buildFormulaDependencyRowsFromTree(subjectTreePayload);
  const visibleRows = rows.filter((row) => visibleIdMap[safeText(row && row.subjectId)]);
  const dependencies = [];
  visibleRows.forEach((row) => {
    appendUniqueSubjectIds(dependencies, findFormulaDependencySubjectIds(rows, row.weightSourcePath));
    appendUniqueSubjectIds(dependencies, findFormulaDependencySubjectIds(rows, row.ratioNumeratorPath));
    appendUniqueSubjectIds(dependencies, findFormulaDependencySubjectIds(rows, row.ratioDenominatorPath));
    if (rowDependsOnSalesVolumeFormulaSource(row)) {
      appendUniqueSubjectIds(
        dependencies,
        rows
          .filter((candidate) => isSalesVolumeFormulaSourcePath(getFormulaSourceRowPath(candidate)))
          .map((candidate) => candidate.subjectId)
      );
    }
    if (safeText(ctx.subjectDomain).toLowerCase() === AUDIT_DOMAIN.MAIN_TABLE && row.moduleCode === REVENUE_MODULE_CODE.MAIN_PNL) {
      appendUniqueSubjectIds(
        dependencies,
        rows
          .filter((candidate) => candidate.moduleCode === REVENUE_MODULE_CODE.MAIN_PNL)
          .map((candidate) => candidate.subjectId)
      );
    }
  });
  return dependencies.filter((id) => !visibleIdMap[safeText(id)]);
}
