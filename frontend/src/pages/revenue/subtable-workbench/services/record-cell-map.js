import {
  isRndAmountCellKey,
} from "../formula-engine";
import {
  parseCellKey,
} from "./detail-matrix";
import {
  buildCellTargetMeta,
} from "./project-context";
import {
  buildCellReviewIndex,
} from "./review-metadata";
import {
  normalizeRecordId,
  normalizeRecordStatus,
  normalizeRecordSubmitIds,
  shouldReplaceRecordCandidate,
} from "./record-utils";
import {
  nowText,
  readOwnerPermission,
  readReviewerPermission,
  safeText,
  toMaybeLong,
} from "./workbench-utils";
import {
  getAuditContextCache,
} from "./audit-context-cache";
import {
  resolveOperationPermissionKey,
} from "./workbench-permissions";
import {
  pickCellReviewEntryForRecord,
  resolveRecordCellRef,
} from "./cell-history";

export function buildRecordCellMap(ctx, records = [], suggestions = [], options = {}) {
  const cache = getAuditContextCache(ctx);
  const reviewIndex = buildCellReviewIndex(suggestions);
  const map = {};
  (Array.isArray(records) ? records : []).forEach((record) => {
    const ref = resolveRecordCellRef(cache, record);
    if (!ref || !ref.rowId || !ref.cellKey) return;
    const reviewEntry = pickCellReviewEntryForRecord(ref, record, reviewIndex, {
      requireDirectReviewLink: options.requireDirectReviewLink === true,
    });
    if (options.requireDirectReviewLink === true && !reviewEntry) return;
    const parsedCell = parseCellKey(ref.cellKey) || {};
    const recordMeta = buildCellTargetMeta(record, {
      yearLabel: ref.yearLabel,
      trimId: ref.trimName,
      trimName: ref.trimName,
      trimIndex: parsedCell.trimIndex,
      cellKey: ref.cellKey,
      dimensionKey: isRndAmountCellKey(ref.cellKey) ? ref.cellKey : undefined,
    });
    const entry = {
      rowId: ref.rowId,
      cellKey: ref.cellKey,
      value: ref.value,
      recordId: normalizeRecordId(record),
      sourceStageCode: safeText(record && record.node),
      stageCode: safeText(record && record.node),
      recordStatus: normalizeRecordStatus(record),
      submitIds: normalizeRecordSubmitIds(record),
      reviewId: reviewEntry && reviewEntry.reviewId,
      reviewDataSubmitId: reviewEntry && reviewEntry.reviewDataSubmitId,
      opinion: safeText(reviewEntry && reviewEntry.opinion),
      reviewConclusion: safeText(reviewEntry && reviewEntry.reviewConclusion),
      reviewStatus: safeText(reviewEntry && reviewEntry.reviewStatus),
      reviewer: safeText(
        (reviewEntry && reviewEntry.reviewerName) ||
          (record && record.ownerName) ||
          (reviewEntry && reviewEntry.reviewerId) ||
          (record && record.ownerId)
      ),
      reviewerId: safeText((reviewEntry && reviewEntry.reviewerId) || (record && record.ownerId)),
      reviewerPermission: readReviewerPermission(reviewEntry) || readOwnerPermission(record),
      time: safeText((record && (record.updatedAt || record.createdAt)) || (reviewEntry && reviewEntry.time)),
      recordMeta,
    };
    if (!map[ref.rowId]) map[ref.rowId] = {};
    if (shouldReplaceRecordCandidate(entry, map[ref.rowId][ref.cellKey], options)) {
      map[ref.rowId][ref.cellKey] = entry;
    }
  });
  return map;
}

export function buildDraftMapFromRecords(ctx, records = [], reviewIndex = null, options = {}) {
  const cache = getAuditContextCache(ctx);
  const includeOwnerPermissionFilter = options.includeOwnerPermissionFilter !== false;
  const ownerPermission = resolveOperationPermissionKey(ctx, "");
  const bucket = {};
  (Array.isArray(records) ? records : []).forEach((record) => {
    const recordOwnerPermission = readOwnerPermission(record);
    if (
      includeOwnerPermissionFilter &&
      recordOwnerPermission &&
      recordOwnerPermission !== ownerPermission
    ) {
      return;
    }

    const ref = resolveRecordCellRef(cache, record);
    if (!ref || !ref.rowId || !ref.cellKey) return;
    const reviewEntry = pickCellReviewEntryForRecord(ref, record, reviewIndex);

    const nextEntry = {
      sourceType: "review_save",
      sourceIndex: -1,
      recordId: normalizeRecordId(record),
      sourceRecordId: normalizeRecordId(record),
      sourceReviewId: reviewEntry && reviewEntry.reviewId,
      sourceStageCode: safeText(record && record.node),
      flowId: toMaybeLong(record && record.flowId),
      ownerId: safeText(record && record.ownerId),
      ownerName: safeText(record && record.ownerName),
      ownerPermission: recordOwnerPermission,
      subjectId: toMaybeLong(record && record.subjectId),
      modelName: safeText(record && record.modelName),
      trimName: safeText(record && record.trimName),
      modelYear: record && record.modelYear,
      yearAggregateMode: safeText(record && record.yearAggregateMode),
      dimensionKey: isRndAmountCellKey(ref.cellKey) ? ref.cellKey : `${ref.yearLabel}__${ref.trimName}`,
      value: ref.value,
      recordStatus: normalizeRecordStatus(record),
      submitIds: normalizeRecordSubmitIds(record),
      reviewDataSubmitId: reviewEntry && reviewEntry.reviewDataSubmitId,
      opinion: safeText(reviewEntry && reviewEntry.opinion),
      time: safeText(record && (record.updatedAt || record.createdAt)),
      updatedAt: safeText(record && (record.updatedAt || record.createdAt), nowText()),
      updatedBy: safeText(record && (record.ownerName || record.ownerId), ctx.userId),
    };
    if (!bucket[ref.rowId]) {
      bucket[ref.rowId] = {};
    }
    if (shouldReplaceRecordCandidate(nextEntry, bucket[ref.rowId][ref.cellKey])) {
      bucket[ref.rowId][ref.cellKey] = nextEntry;
    }
  });

  return bucket;
}
