import {
  buildDetailRowsFromPermissionTree,
} from "./detail-builder";
import {
  queryProjectCostRecordsForNodes,
} from "./project-cost-record-query";
import {
  buildTrimOptions,
  requestProjectPatternList,
} from "./project-context";
import {
  filterRecordsBySubjectIds,
} from "./record-utils";
import {
  buildSubjectIdFilterFromTree,
  getSubjectNodes,
} from "./subject-tree";
import {
  requestSubjectTreePreferPermission,
} from "./subject-tree-request";
import {
  normalizeSubjectIdFilterList,
  safeText,
} from "./workbench-utils";

export async function fetchSubtableDetailForNode(ctx, flowSnapshot, node, options = {}) {
  const sourceCtx = {
    ...ctx,
    subjectDomain: "subtable",
    subjectApiMode: safeText(ctx.subjectApiMode || "auto", "auto"),
    stage: node,
    stageCode: node,
  };
  const subjectTreePayload = await requestSubjectTreePreferPermission(sourceCtx);
  if (!getSubjectNodes(subjectTreePayload).length) {
    throw new Error(`模板和授权过滤后无 ${node} 子表科目，无法读取子表详情`);
  }
  const subjectNodes = getSubjectNodes(subjectTreePayload);
  const subjectIds = Array.isArray(options.subjectIds) && options.subjectIds.length
    ? normalizeSubjectIdFilterList(options.subjectIds)
    : buildSubjectIdFilterFromTree(subjectTreePayload);

  const patternList = Array.isArray(options.patternList)
    ? options.patternList
    : await requestProjectPatternList(sourceCtx);
  const records = Array.isArray(options.records)
    ? filterRecordsBySubjectIds(options.records, subjectIds)
    : options.skipRecords === true
      ? []
      : await queryProjectCostRecordsForNodes(
          sourceCtx,
          flowSnapshot,
          options.ownerScoped !== false,
          node,
          {
            subjectIds,
            traceLabel: options.traceLabel,
          }
        ).catch(() => []);
  const trimOptions = buildTrimOptions(patternList, records);
  const detailData = buildDetailRowsFromPermissionTree(
    subjectNodes,
    records,
    trimOptions
  );

  return {
    detail: detailData,
    records,
    trimOptions,
    subjectTreePayload,
    patternList,
  };
}
