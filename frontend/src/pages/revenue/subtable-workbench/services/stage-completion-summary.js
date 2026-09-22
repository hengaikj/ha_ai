import {
  REVENUE_INPUT_SCOPE,
  isReviewableAuditValueSource,
} from "../domain-config";
import { isRndAmountCellKey } from "../formula-engine";
import {
  buildRevenueModuleSections,
  isSavableMatrixRow,
} from "../matrix-utils";
import s1WorkflowGuards from "../s1-workflow-guards";
import {
  buildStageInputColumns,
  isColumnRequiredByInputScope,
  readRowMatrixColumnValue,
} from "./detail-matrix";
import { isMainPreviewModule } from "./main-table-preview";
import {
  findModuleEntry,
  resolveModuleIdentity,
} from "./review-metadata";
import {
  hasFullSubjectScope,
  resolveOperationPermissionKey,
} from "./workbench-permissions";
import {
  normalizeSubjectIdFilterList,
  safeText,
  toMaybeLong,
} from "./workbench-utils";

const {
  hasS1ModuleSubmittedInReviewState,
  normalizeS1ModuleProgressItem,
} = s1WorkflowGuards;

const S3_OWNER_CONFIRMATION_DEBUG_SAMPLE_LIMIT = 30;

export function isStageInputRow(row = {}) {
  if (!isSavableMatrixRow(row)) return false;
  return isReviewableAuditValueSource("subtable", row);
}

export function readRowS3Candidate(row = {}, column = {}) {
  if (!row || typeof row !== "object" || !column) return null;
  const map = row.s3CandidateMap && typeof row.s3CandidateMap === "object"
    ? row.s3CandidateMap
    : null;
  if (!map) return null;
  const cellKey = column.cellKey && isRndAmountCellKey(column.cellKey)
    ? safeText(column.cellKey)
    : `y${column.yearIndex}_t${column.trimIndex}`;
  if (Object.prototype.hasOwnProperty.call(map, cellKey)) return map[cellKey];
  const dimensionKey = `${safeText(column.yearLabel)}__${safeText(column.trimId || column.trimName)}`;
  if (Object.prototype.hasOwnProperty.call(map, dimensionKey)) return map[dimensionKey];
  if (safeText(column.trimName) && safeText(column.trimName) !== safeText(column.trimId)) {
    const nameKey = `${safeText(column.yearLabel)}__${safeText(column.trimName)}`;
    if (Object.prototype.hasOwnProperty.call(map, nameKey)) return map[nameKey];
  }
  return null;
}

export function hasS3ActionableCandidate(candidate = {}) {
  return Boolean(
    candidate &&
      typeof candidate === "object" &&
      (safeText(candidate.rowId) ||
        safeText(candidate.subjectId) ||
        safeText(candidate.cellKey) ||
        safeText(candidate.dimensionKey))
  );
}

function getS3CandidateSavedRecordStatus(candidate = {}) {
  return safeText(candidate && candidate.savedRecordStatus).toUpperCase();
}

export function isS3CandidateSavedAsDraft(candidate = {}) {
  return toMaybeLong(candidate && candidate.savedRecordId) != null &&
    getS3CandidateSavedRecordStatus(candidate) === "DRAFT";
}

export function isS3CandidateSavedAsArchived(candidate = {}) {
  return toMaybeLong(candidate && candidate.savedRecordId) != null &&
    getS3CandidateSavedRecordStatus(candidate) === "ARCHIVED";
}

export function isS3OwnerSubmitterContext(ctx = {}) {
  return !hasFullSubjectScope(ctx) && Boolean(resolveOperationPermissionKey(ctx, ""));
}

export function buildS3OwnerSubmitContext(ctx = {}) {
  return ctx;
}

function hasVisibleSubjectScope(ctx = {}) {
  return ctx && ctx.visibleSubjectScopeProvided === true;
}

function buildSubjectIdMap(subjectIds = []) {
  return normalizeSubjectIdFilterList(subjectIds).reduce((result, id) => {
    result[safeText(id)] = true;
    return result;
  }, {});
}

function buildS3CandidateIssueLabel(row = {}, column = {}) {
  return [row.subject || row.subjectName || row.fullNamePath || row.id, column.label || column.yearLabel, column.trimName]
    .map((value) => safeText(value))
    .filter(Boolean)
    .join(" / ");
}

export function resolveS3CandidateSubmitValue(row = {}, column = {}, candidate = null) {
  if (hasS3ActionableCandidate(candidate)) {
    return safeText(candidate && candidate.finalValue);
  }
  return safeText(readRowMatrixColumnValue(row, column));
}

function buildS3OwnerCellDebugEntry(ctx = {}, module = {}, row = {}, column = {}, candidate = null, value = "") {
  const cellKey = column && column.cellKey && isRndAmountCellKey(column.cellKey)
    ? safeText(column.cellKey)
    : `y${column.yearIndex}_t${column.trimIndex}`;
  const dimensionKey = column && column.cellKey && isRndAmountCellKey(column.cellKey)
    ? cellKey
    : `${safeText(column.yearLabel)}__${safeText(column.trimId || column.trimName)}`;
  const nameDimensionKey = `${safeText(column.yearLabel)}__${safeText(column.trimName || column.trimId)}`;
  const cells = row && row.cells && typeof row.cells === "object" ? row.cells : {};
  const cellMap = row && row.cellMap && typeof row.cellMap === "object" ? row.cellMap : {};
  const subjectId = safeText(row && row.subjectId);
  const rowId = safeText(row && (row.id || row.rowId));
  const visibleSubjectMap = buildSubjectIdMap(ctx.visibleSubjectIds);
  const visibleScopeProvided = hasVisibleSubjectScope(ctx);
  const hasCandidate = hasS3ActionableCandidate(candidate);

  return {
    moduleKey: safeText(module.rootSubjectId || module.key || module.name),
    moduleName: safeText(module.name, "未分组"),
    subjectId,
    rowId,
    subject: safeText(row.subject || row.subjectName || row.fullNamePath || row.id, "-"),
    subjectPath: Array.isArray(row.subjectPath)
      ? row.subjectPath.map((item) => safeText(item)).filter(Boolean).join(" / ")
      : safeText(row.subjectPath || row.fullNamePath),
    visibleInPage: visibleScopeProvided ? Boolean(visibleSubjectMap[subjectId] || visibleSubjectMap[rowId]) : null,
    inputScope: safeText(row.inputScope || REVENUE_INPUT_SCOPE.ALL),
    valueSource: safeText(row.valueSource || row.sourceType),
    rowKind: safeText(row.rowKind || row.rowType),
    yearLabel: safeText(column.yearLabel),
    trimId: safeText(column.trimId),
    trimName: safeText(column.trimName || column.label),
    yearIndex: Number(column.yearIndex),
    trimIndex: Number(column.trimIndex),
    cellKey,
    dimensionKey,
    resolvedSubmitValue: value,
    matrixValue: safeText(readRowMatrixColumnValue(row, column)),
    cellsLegacyValue: Object.prototype.hasOwnProperty.call(cells, cellKey) ? cells[cellKey] : undefined,
    cellMapDimensionValue: Object.prototype.hasOwnProperty.call(cellMap, dimensionKey)
      ? cellMap[dimensionKey]
      : undefined,
    cellMapNameValue: Object.prototype.hasOwnProperty.call(cellMap, nameDimensionKey)
      ? cellMap[nameDimensionKey]
      : undefined,
    hasCandidate,
    candidate: hasCandidate
      ? {
        decision: safeText(candidate.decision),
        finalValue: safeText(candidate.finalValue),
        originalValue: safeText(candidate.originalValue),
        s2Value: safeText(candidate.s2Value),
        hasS2Value: candidate.hasS2Value === true,
        savedRecordId: candidate.savedRecordId,
        savedRecordStatus: safeText(candidate.savedRecordStatus),
        rowId: safeText(candidate.rowId),
        subjectId: safeText(candidate.subjectId),
        cellKey: safeText(candidate.cellKey),
        dimensionKey: safeText(candidate.dimensionKey),
      }
      : null,
  };
}

export function buildS1CompletionSummaryFromDetail(_ctx, detail = {}, moduleSubmitMap = {}) {
  const modules = buildRevenueModuleSections(detail.rows || [])
    .filter((module) => !isMainPreviewModule(module));
  const summary = {
    stageCode: "S1",
    subjectDomain: "subtable",
    ok: true,
    total: 0,
    done: 0,
    missingCount: 0,
    blockingCount: 0,
    issues: [],
    modules: [],
    message: "S1 业务经理填报完成清单已通过",
  };

  modules.forEach((module) => {
    const identity = resolveModuleIdentity({
      rootSubjectId: module.rootSubjectId,
      moduleKey: module.moduleKey || module.key,
      moduleName: module.name,
    });
    const submittedEntry = findModuleEntry(moduleSubmitMap, identity);
    const moduleSubmitted = hasS1ModuleSubmittedInReviewState(
      { submitMap: moduleSubmitMap },
      identity.lookupKeys
    );
    const item = {
      key: safeText(module.rootSubjectId || module.key || module.name),
      rootSubjectId: safeText(module.rootSubjectId),
      name: safeText(module.name, "未分组"),
      total: 0,
      done: 0,
      missing: 0,
      blocking: false,
      status: "无可填项",
      issues: [],
      moduleSubmitted,
      submitted: 0,
      submittedAt: submittedEntry && (submittedEntry.submittedAt || submittedEntry.time),
      submittedBy: submittedEntry && (submittedEntry.submittedBy || submittedEntry.reviewerName || submittedEntry.reviewerId),
    };

    (module.rows || []).forEach((row) => {
      if (!isStageInputRow(row)) return;
      const columns = buildStageInputColumns(detail, row);
      columns.forEach((column) => {
        if (!isColumnRequiredByInputScope(row, column)) return;
        item.total += 1;
        summary.total += 1;
        const value = readRowMatrixColumnValue(row, column);
        if (safeText(value) !== "") {
          item.done += 1;
        }
      });
    });

    if (moduleSubmitted) {
      Object.assign(item, normalizeS1ModuleProgressItem(item));
    } else {
      Object.assign(item, normalizeS1ModuleProgressItem(item));
      if (item.total > 0) {
        item.blocking = true;
        summary.blockingCount += 1;
        summary.issues.push({
          type: "module_not_submitted",
          moduleKey: item.key,
          moduleName: item.name,
          message: `${item.name} 尚未提交模块`,
        });
      }
    }
    summary.done += item.done;
    summary.modules.push(item);
  });

  summary.ok = summary.blockingCount === 0;
  if (summary.blockingCount > 0) {
    summary.message = `有 ${summary.blockingCount} 个子表模块尚未提交`;
  } else if (!summary.total) {
    summary.message = "未发现需要填报的真实输入项，请确认科目权限树";
  }
  return summary;
}

export function buildS2CompletionSummaryFromDetail(_ctx, detail = {}, latestModuleMap = {}) {
  const modules = buildRevenueModuleSections(detail.rows || [])
    .filter((module) => !isMainPreviewModule(module));
  const summary = {
    stageCode: "S2",
    subjectDomain: "subtable",
    ok: true,
    total: 0,
    done: 0,
    blockingCount: 0,
    issues: [],
    modules: [],
    message: "S2 集团部室审核模块完成清单已通过",
  };

  modules.forEach((module) => {
    const identity = resolveModuleIdentity({
      rootSubjectId: module.rootSubjectId,
      moduleKey: module.moduleKey || module.key,
      moduleName: module.name,
    });
    const reviewableRows = (module.rows || []).filter((row) => isStageInputRow(row));
    const submittedEntry = findModuleEntry(latestModuleMap, identity);
    const submitted = Boolean(submittedEntry && submittedEntry.submitted);
    const item = {
      key: identity.moduleKey || safeText(module.key || module.name),
      rootSubjectId: identity.rootSubjectId,
      name: safeText(module.name, "未分组"),
      total: reviewableRows.length,
      done: submitted ? reviewableRows.length : 0,
      missing: submitted ? 0 : reviewableRows.length,
      blocking: false,
      status: reviewableRows.length ? "未提交" : "无可审核项",
      issues: [],
      submitted,
      submittedAt: submittedEntry && submittedEntry.time,
      submittedBy: submittedEntry && (submittedEntry.reviewerName || submittedEntry.reviewerId),
    };

    summary.total += reviewableRows.length;
    summary.done += item.done;

    if (reviewableRows.length && !submitted) {
      item.blocking = true;
      item.status = "未提交";
      summary.blockingCount += 1;
      summary.issues.push({
        type: "module_not_submitted",
        moduleKey: item.key,
        moduleName: item.name,
        message: `${item.name} 尚未提交模块审核意见`,
      });
    } else if (submitted) {
      item.status = "已提交";
    }

    summary.modules.push(item);
  });

  summary.ok = summary.blockingCount === 0;
  if (!summary.ok) {
    summary.message = `仍有 ${summary.blockingCount} 项阻塞，暂不能最终提交`;
  } else if (!summary.total) {
    summary.message = "未发现需要审核的真实填报项，请确认科目权限树";
  }
  return summary;
}

export function buildS3CompletionSummaryFromDetail(_ctx, detail = {}) {
  const modules = buildRevenueModuleSections(detail.rows || [])
    .filter((module) => !isMainPreviewModule(module));
  const summary = {
    stageCode: "S3",
    subjectDomain: "subtable",
    total: 0,
    done: 0,
    missingCount: 0,
    blockingCount: 0,
    ok: false,
    message: "S3 业务经理二次确认完成清单未通过",
    modules: [],
    issues: [],
  };

  modules.forEach((module) => {
    const item = {
      key: safeText(module.rootSubjectId || module.key || module.name),
      rootSubjectId: safeText(module.rootSubjectId),
      name: safeText(module.name, "未分组"),
      total: 0,
      done: 0,
      missing: 0,
      blocking: false,
      status: "无待确认项",
      issues: [],
    };

    (module.rows || []).forEach((row) => {
      if (!isStageInputRow(row)) return;
      const columns = buildStageInputColumns(detail, row);
      columns.forEach((column) => {
        if (!isColumnRequiredByInputScope(row, column)) return;
        const candidate = readRowS3Candidate(row, column);
        const value = resolveS3CandidateSubmitValue(row, column, candidate);
        item.total += 1;
        summary.total += 1;
        if (isS3CandidateSavedAsArchived(candidate)) {
          item.done += 1;
          summary.done += 1;
          return;
        }
        if (value === "") {
          item.done += 1;
          summary.done += 1;
          return;
        }
        item.missing += 1;
        summary.missingCount += 1;
        const issue = buildS3CandidateIssueLabel(row, column);
        item.issues.push(issue);
        summary.issues.push({
          type: "s3_confirmation_missing",
          moduleKey: item.key,
          moduleName: item.name,
          message: issue,
        });
      });
    });

    if (item.missing > 0) {
      item.blocking = true;
      item.status = "待确认";
      summary.blockingCount += 1;
    } else if (item.total > 0) {
      item.status = "已确认";
    }
    summary.modules.push(item);
  });

  summary.ok = summary.total > 0 && summary.missingCount === 0;
  summary.message = summary.ok
    ? "S3 业务经理二次确认已全部完成，可生成主表并流转到 S4"
    : "仍有业务经理责任科目未完成 S3 二次确认";
  return summary;
}

export function logS3OwnerConfirmationSummary(ctx = {}, summary = {}) {
  if (!summary || typeof console === "undefined") return;
  if (summary.ok && !summary.emptyCount) return;
  const debug = summary.debug || {};
  const missingSamples = Array.isArray(debug.missingSamples) ? debug.missingSamples : [];
  const emptySamples = Array.isArray(debug.emptySamples) ? debug.emptySamples : [];
  const payload = {
    message: summary.message,
    permissionKey: resolveOperationPermissionKey(ctx, ""),
    userId: ctx.userId,
    subjectApiMode: ctx.subjectApiMode,
    visibleSubjectScopeProvided: debug.visibleSubjectScopeProvided,
    visibleSubjectCount: debug.visibleSubjectCount,
    detailRowCount: debug.detailRowCount,
    total: summary.total,
    done: summary.done,
    emptyCount: summary.emptyCount,
    missingCount: summary.missingCount,
    missingVisibleCount: debug.missingVisibleCount,
    missingOutsideVisibleCount: debug.missingOutsideVisibleCount,
    blockingCount: summary.blockingCount,
    modules: (summary.modules || [])
      .filter((item) => item && item.missing > 0)
      .map((item) => ({
        key: item.key,
        name: item.name,
        total: item.total,
        done: item.done,
        missing: item.missing,
        status: item.status,
      })),
    emptySamples,
    missingSamples,
  };

  const title = summary.ok
    ? "[收益测算][S3本人提交] 空值按空提交诊断"
    : "[收益测算][S3本人提交] 二次确认缺失诊断";
  const logPayload = summary.ok ? console.info : console.warn;
  if (typeof console.groupCollapsed === "function") {
    console.groupCollapsed(title);
    logPayload.call(console, payload);
    const tableSamples = missingSamples.length ? missingSamples : emptySamples;
    if (tableSamples.length && typeof console.table === "function") {
      console.table(tableSamples.map((item) => ({
        moduleName: item.moduleName,
        subjectId: item.subjectId,
        subject: item.subject,
        visibleInPage: item.visibleInPage,
        yearLabel: item.yearLabel,
        trimName: item.trimName,
        cellKey: item.cellKey,
        hasCandidate: item.hasCandidate,
        matrixValue: item.matrixValue,
        candidateFinalValue: item.candidate && item.candidate.finalValue,
      })));
    }
    console.groupEnd();
    return;
  }
  logPayload.call(console, title, payload);
}

export function buildS3OwnerConfirmationSummaryFromDetail(detail = {}, ctx = {}) {
  const visibleScopeProvided = hasVisibleSubjectScope(ctx);
  const modules = buildRevenueModuleSections(detail.rows || [])
    .filter((module) => !isMainPreviewModule(module));
  const summary = {
    stageCode: "S3",
    subjectDomain: "subtable",
    total: 0,
    done: 0,
    archived: 0,
    emptyCount: 0,
    missingCount: 0,
    blockingCount: 0,
    ok: false,
    message: "仍有业务经理责任科目缺少 S3 二次确认值",
    modules: [],
    issues: [],
    debug: {
      detailRowCount: Array.isArray(detail.rows) ? detail.rows.length : 0,
      visibleSubjectScopeProvided: visibleScopeProvided,
      visibleSubjectCount: normalizeSubjectIdFilterList(ctx.visibleSubjectIds).length,
      missingVisibleCount: 0,
      missingOutsideVisibleCount: 0,
      emptySamples: [],
      missingSamples: [],
    },
  };

  modules.forEach((module) => {
    const item = {
      key: safeText(module.rootSubjectId || module.key || module.name),
      rootSubjectId: safeText(module.rootSubjectId),
      name: safeText(module.name, "未分组"),
      total: 0,
      done: 0,
      archived: 0,
      empty: 0,
      missing: 0,
      blocking: false,
      status: "无待确认项",
      issues: [],
    };

    (module.rows || []).forEach((row) => {
      if (!isStageInputRow(row)) return;
      const columns = buildStageInputColumns(detail, row);
      columns.forEach((column) => {
        if (!isColumnRequiredByInputScope(row, column)) return;
        const candidate = readRowS3Candidate(row, column);
        item.total += 1;
        summary.total += 1;
        const value = resolveS3CandidateSubmitValue(row, column, candidate);
        if (value !== "") {
          item.done += 1;
          summary.done += 1;
          if (isS3CandidateSavedAsArchived(candidate)) {
            item.archived += 1;
            summary.archived += 1;
          }
          return;
        }
        item.empty += 1;
        summary.emptyCount += 1;
        item.done += 1;
        summary.done += 1;
        if (summary.debug.emptySamples.length < S3_OWNER_CONFIRMATION_DEBUG_SAMPLE_LIMIT) {
          summary.debug.emptySamples.push(
            buildS3OwnerCellDebugEntry(ctx, module, row, column, candidate, value)
          );
        }
      });
    });

    if (item.missing > 0) {
      item.blocking = true;
      item.status = "确认中";
      summary.blockingCount += 1;
    } else if (item.total > 0 && item.archived === item.total) {
      item.status = "已提交";
    } else if (item.total > 0) {
      item.status = "待提交";
    }
    summary.modules.push(item);
  });

  summary.ok = summary.total > 0 && summary.missingCount === 0;
  summary.message = summary.ok && summary.emptyCount > 0
    ? `有 ${summary.emptyCount} 个 S3 二次确认单元格为空，将按空值继续提交`
    : summary.ok
    ? "S3 业务经理二次确认值已完整，可提交本人最终值"
    : "仍有业务经理责任科目缺少 S3 二次确认值";
  return summary;
}
