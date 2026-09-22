import {
  normalizeStageCode,
} from "../domain-config";
import {
  buildDetailRowsFromPermissionTree,
} from "./detail-builder";
import {
  buildTrimOptions,
  requestProjectPatternList,
} from "./project-context";
import {
  queryProjectCostRecordsForNodes,
} from "./project-cost-record-query";
import {
  queryReviewSuggestionRows,
} from "./audit-record-queries";
import {
  buildCellReviewIndex,
} from "./review-metadata";
import {
  filterRecordsBySubjectIds,
} from "./record-utils";
import {
  buildSubjectIdFilterFromTree,
  filterMainSubjectTreePayload,
  getSubjectNodes,
} from "./subject-tree";
import {
  requestSubjectTreePreferPermission,
} from "./subject-tree-request";
import {
  mergeParentSubjectDisplayMap,
} from "./payload-normalizer";
import {
  resolveOperationPermissionKey,
} from "./workbench-permissions";
import {
  resolveProjectDisplayName,
  safeText,
} from "./workbench-utils";

export async function fetchMainTableFillPayloadForNode(ctx, flowSnapshot, sourceStageCode = "S4", options = {}) {
  const mainCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
    // 系统级主表填报：按模板全集组装主表树，不按当前用户授权裁剪
    subjectScope: "template",
  };
  const normalizedSourceStage = normalizeStageCode(sourceStageCode);
  const sourceCtx = {
    ...mainCtx,
    stage: normalizedSourceStage,
    stageCode: normalizedSourceStage,
  };

  let subjectTreePayload = await requestSubjectTreePreferPermission(mainCtx);
  if (!getSubjectNodes(subjectTreePayload).length) {
    subjectTreePayload = await requestSubjectTreePreferPermission(sourceCtx);
  }
  if (!getSubjectNodes(subjectTreePayload).length) {
    throw new Error("模板和授权过滤后无主表来源科目，无法构建主表填报数据");
  }

  const subjectIds = buildSubjectIdFilterFromTree(subjectTreePayload);
  const mainSubjectIds = buildSubjectIdFilterFromTree(filterMainSubjectTreePayload(subjectTreePayload));
  const preferReviewLinkedRecords = ["S4", "S6"].includes(normalizedSourceStage);
  const [patternList, preferredRecords, reviewSuggestions] = await Promise.all([
    requestProjectPatternList(sourceCtx),
    queryProjectCostRecordsForNodes(sourceCtx, flowSnapshot, false, normalizedSourceStage, {
      subjectIds,
      recordStatus: options.recordStatus,
    }),
    preferReviewLinkedRecords
      ? queryReviewSuggestionRows(sourceCtx, flowSnapshot, {
          node: normalizedSourceStage,
          includeReviewerFilter: false,
        })
      : Promise.resolve([]),
  ]);
  const scopedRecords = filterRecordsBySubjectIds(preferredRecords, subjectIds);
  const mainScopedRecords = filterRecordsBySubjectIds(preferredRecords, mainSubjectIds);
  const trimOptions = buildTrimOptions(patternList, scopedRecords);
  const reviewIndex = preferReviewLinkedRecords
    ? buildCellReviewIndex(reviewSuggestions)
    : null;
  const detailData = buildDetailRowsFromPermissionTree(
    getSubjectNodes(subjectTreePayload),
    scopedRecords,
    trimOptions,
    {
      preferDirectReviewLink: preferReviewLinkedRecords,
      reviewIndex,
    }
  );
  const currentStage = safeText((flowSnapshot && flowSnapshot.node) || ctx.stage, "S5").toUpperCase();

  return {
    project: {
      projectId: ctx.projectId || undefined,
      projectNo: ctx.projectCode,
      projectCode: ctx.projectCode,
      projectName: resolveProjectDisplayName(ctx),
      gate: ctx.valve,
      flowId: flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined,
      audit: {
        stageCode: currentStage,
        stage: currentStage,
      },
    },
    detail: {
      dimensions: detailData.dimensions,
      trimOptions: detailData.trimOptions,
      yearTrimConfig: detailData.yearTrimConfig,
      rows: detailData.rows,
      templateValidation: detailData.templateValidation,
      parentSubjectDisplay: mergeParentSubjectDisplayMap(),
      subtableProgress: [],
      lastSavedAt: "-",
      lastSavedBy: "-",
      flowId: flowSnapshot && flowSnapshot.flowId != null ? flowSnapshot.flowId : undefined,
      flowNode: currentStage,
      valueSourceNodes: [normalizedSourceStage],
      selectedSourceStage: normalizedSourceStage,
      mainSnapshotRecordCount: mainScopedRecords.length,
      mainSnapshotTotalRecordCount: scopedRecords.length,
      mainSnapshotRecordStatus: safeText(options.recordStatus),
    },
    permissions: {
      viewer: ctx.userId,
      permissionKey: resolveOperationPermissionKey(ctx, ""),
    },
    subjectTreePayload,
  };
}
