import {
  getProjectCostFlowLogs as getProjectCostFlowLogsApi,
} from "@/api/system/expenses";
import {
  normalizeStageCode,
} from "../domain-config";
import {
  buildAuditDetailPayloadFromFillPayload,
} from "./audit-payload";
import {
  setAuditContextCache,
} from "./audit-context-cache";
import {
  alignMainDetailDimensions,
  isMainPreviewRow,
  mergeReadonlySubtableRowsIntoMainAuditDetail,
} from "./main-table-preview";
import {
  queryS5SubmittedMainRecords,
} from "./project-cost-record-query";
import {
  resolveStageLabel,
} from "./stage-labels";
import {
  hasOperationPermission,
} from "./workbench-permissions";
import {
  toMaybeLong,
  safeText,
  parseListPayload,
} from "./workbench-utils";

function normalizeFlowOperatorId(value) {
  const normalized = toMaybeLong(value);
  if (normalized != null) return String(normalized);
  return safeText(value);
}

function isS5DecisionApprovalFlowLog(log = {}, ctx = {}) {
  const operatorId = normalizeFlowOperatorId(log.operatorId || log.operator_id);
  const currentUserId = normalizeFlowOperatorId(ctx.userId);
  if (!operatorId || !currentUserId || operatorId !== currentUserId) return false;
  if (normalizeStageCode(log.node || log.targetNode) !== "S6") return false;
  if (safeText(log.nodeStatus || log.targetNodeStatus).toUpperCase() !== "IN_PROGRESS") return false;
  return /^approve(?:\b|:)/i.test(safeText(log.actionRemark || log.remark));
}

function normalizeS5MainSelectionSourceStage(value) {
  const stage = normalizeStageCode(value);
  return ["S2", "S3", "S4"].includes(stage) ? stage : "";
}

function readS5MainSelectionSourceStage(log = {}) {
  const text = [
    log.actionRemark,
    log.remark,
    log.submitRemark,
    log.description,
  ].map((item) => safeText(item)).filter(Boolean).join(" ");
  const match = text.match(/AUTO_MAIN_FROM_S5_SELECT_(S[234])\b/i);
  return match ? normalizeS5MainSelectionSourceStage(match[1]) : "";
}

function sortFlowLogsByLatest(left = {}, right = {}) {
  const leftKey = getFlowLogOrderKey(left);
  const rightKey = getFlowLogOrderKey(right);
  return rightKey.time - leftKey.time || rightKey.id - leftKey.id;
}

/** 判断是否为「删除节点并退回 S5」的回退日志（与后端 ACTION_REMARK_DELETE_CURRENT_NODE 一致） */
function isRollbackToS5FlowLog(log = {}) {
  const remark = safeText(log.actionRemark || log.remark);
  if (!remark) return false;
  return /删除节点.*退回.*S5/i.test(remark);
}

/** S8 上会锁定后被成本模块驳回，流程回到 S1（SubtotalWeightedService.updateLockStatus） */
function isS8RejectToS1FlowLog(log = {}) {
  const remark = safeText(log.actionRemark || log.remark);
  return normalizeStageCode(log.node || log.targetNode) === "S1" && remark === "驳回";
}

function isS5NodeFlowLog(log = {}) {
  return normalizeStageCode(log.node || log.targetNode) === "S5";
}

function isS5DecisionCycleBoundaryLog(log = {}) {
  return isRollbackToS5FlowLog(log) || isS8RejectToS1FlowLog(log) || isS5NodeFlowLog(log);
}

/** 解析流程日志时间，兼容 ISO 字符串与 Jackson 数组序列化 */
function parseFlowLogTimestamp(log = {}) {
  const raw = log.createdAt ?? log.updatedAt ?? log.createTime;
  if (Array.isArray(raw) && raw.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = raw;
    return new Date(year, month - 1, day, hour, minute, second).getTime();
  }
  const parsed = Date.parse(safeText(raw));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** 取流程日志排序键，用于比较先后顺序 */
function getFlowLogOrderKey(log = {}) {
  return {
    time: parseFlowLogTimestamp(log),
    id: Number(log.id || 0),
  };
}

/** 判断日志是否晚于边界日志（不含边界本身） */
function isFlowLogAfterBoundary(log = {}, boundary = null) {
  if (!boundary) return true;
  const current = getFlowLogOrderKey(log);
  const edge = getFlowLogOrderKey(boundary);
  if (current.time !== edge.time) return current.time > edge.time;
  return current.id > edge.id;
}

/**
 * 当前流程在 S5 时，取最近一次「S5 决策评审周期」边界日志。
 * 仅统计该边界之后、当前用户的 S6 approve 记录为「已评审」。
 *
 * 边界类型（取时间/id 最新的一条）：
 * 1. 节点回退至 S5：删除节点 ... 并退回 S5
 * 2. S8 驳回至 S1：actionRemark=驳回（成本模块）
 * 3. 流程再次进入 S5：node=S5（如 S4 主表审核最终提交）
 */
function resolveLatestS5DecisionCycleBoundary(rows = [], flowSnapshot = {}, ctx = {}) {
  const currentNode = normalizeStageCode(
    flowSnapshot.node || flowSnapshot.currentNode || ctx.stage || ctx.stageCode || ""
  );
  if (currentNode !== "S5") return null;

  const boundaryCandidates = rows.filter(isS5DecisionCycleBoundaryLog);
  if (!boundaryCandidates.length) return null;
  boundaryCandidates.sort(sortFlowLogsByLatest);
  return boundaryCandidates[0];
}

/** 流程是否经历过 S8 驳回或节点回退至 S5 */
function hasFlowCycleResetLogs(rows = []) {
  return rows.some((log) => isS8RejectToS1FlowLog(log) || isRollbackToS5FlowLog(log));
}

function getRecordOrderKey(record = {}) {
  return getFlowLogOrderKey({
    createdAt: record.updatedAt || record.updated_at || record.createdAt || record.created_at,
    id: record.id || record.recordId,
  });
}

/** 判断 S5 主表记录是否在周期边界之后更新/创建 */
function hasRecordsAfterBoundary(records = [], boundary = null) {
  if (!Array.isArray(records) || !records.length) return false;
  if (!boundary) return true;
  const edge = getFlowLogOrderKey(boundary);
  return records.some((record) => {
    const recordKey = getRecordOrderKey(record);
    if (recordKey.time !== edge.time) return recordKey.time > edge.time;
    return recordKey.id > edge.id;
  });
}

/**
 * 判断当前 S5 周期内是否已有有效主表快照。
 * S8 驳回或回退后，旧周期遗留的 S5 ARCHIVED 记录不再视为当前周期数据。
 */
function evaluateCurrentCycleS5MainData(rows = [], flowSnapshot = {}, ctx = {}, s5Records = []) {
  if (!Array.isArray(s5Records) || !s5Records.length) {
    return false;
  }
  if (!hasFlowCycleResetLogs(rows)) {
    return true;
  }
  const cycleBoundary = resolveLatestS5DecisionCycleBoundary(rows, flowSnapshot, ctx);
  return hasRecordsAfterBoundary(s5Records, cycleBoundary);
}

async function loadProjectCostFlowLogRows(flowSnapshot, dependencies = {}) {
  const flowId = flowSnapshot && (flowSnapshot.flowId || flowSnapshot.id);
  if (flowId == null) return [];
  const getProjectCostFlowLogs = dependencies.getProjectCostFlowLogs || getProjectCostFlowLogsApi;
  if (typeof getProjectCostFlowLogs !== "function") return [];
  try {
    return parseListPayload(await getProjectCostFlowLogs(flowId));
  } catch (_error) {
    return [];
  }
}

export async function resolveCurrentS5DecisionApprovalTrigger(ctx, flowSnapshot, dependencies = {}) {
  const rows = dependencies.flowLogRows || await loadProjectCostFlowLogRows(flowSnapshot, dependencies);
  if (!rows.length && flowSnapshot && (flowSnapshot.flowId || flowSnapshot.id) == null) return null;
  try {
    const cycleBoundary = resolveLatestS5DecisionCycleBoundary(rows, flowSnapshot, ctx);
    const matches = rows
      .filter((row) => isS5DecisionApprovalFlowLog(row, ctx))
      .filter((row) => isFlowLogAfterBoundary(row, cycleBoundary));
    matches.sort(sortFlowLogsByLatest);
    return matches[0] || null;
  } catch (_error) {
    return null;
  }
}

export async function resolveS5MainSelectionSourceStage(ctx, flowSnapshot, dependencies = {}) {
  const rows = dependencies.flowLogRows || await loadProjectCostFlowLogRows(flowSnapshot, dependencies);
  if (!rows.length) return "";
  try {
    const cycleBoundary = resolveLatestS5DecisionCycleBoundary(rows, flowSnapshot, ctx);
    const matches = rows
      .filter((row) => isFlowLogAfterBoundary(row, cycleBoundary))
      .map((row) => ({
        row,
        sourceStage: readS5MainSelectionSourceStage(row),
      }))
      .filter((item) => item.sourceStage);
    matches.sort((left, right) => sortFlowLogsByLatest(left.row, right.row));
    return matches[0] ? matches[0].sourceStage : "";
  } catch (_error) {
    return "";
  }
}

export function buildS5DecisionApprovalMeta(hasS5Data, sourceStage, options = {}) {
  const currentCycleMainSelected = options.currentCycleMainSelected !== undefined
    ? Boolean(options.currentCycleMainSelected)
    : Boolean(hasS5Data);
  return {
    hasS5Data,
    currentCycleMainSelected,
    sourceStage,
    fallbackSourceStage: hasS5Data ? "" : "S4",
    submitted: Boolean(options.submitted),
    submittedAt: safeText(options.submittedAt),
    submittedBy: safeText(options.submittedBy),
  };
}

export async function buildS5DecisionApprovalMetaForContext(
  ctx,
  flowSnapshot,
  hasS5Data,
  sourceStage,
  dependencies = {},
  options = {}
) {
  const flowLogRows = dependencies.flowLogRows || await loadProjectCostFlowLogRows(flowSnapshot, dependencies);
  const approvalTrigger = await resolveCurrentS5DecisionApprovalTrigger(ctx, flowSnapshot, {
    ...dependencies,
    flowLogRows,
  });
  const currentCycleMainSelected = options.currentCycleMainSelected !== undefined
    ? Boolean(options.currentCycleMainSelected)
    : hasS5Data;
  return buildS5DecisionApprovalMeta(hasS5Data, sourceStage, {
    currentCycleMainSelected,
    submitted: Boolean(approvalTrigger),
    submittedAt: approvalTrigger && approvalTrigger.createdAt,
    submittedBy: approvalTrigger && (approvalTrigger.operatorName || approvalTrigger.operatorId),
  });
}

function normalizeSubjectId(value) {
  const id = toMaybeLong(value);
  return id == null ? "" : String(id);
}

function extractMainSnapshotSubjectIds(detail = {}) {
  return (Array.isArray(detail && detail.rows) ? detail.rows : [])
    .filter(isMainPreviewRow)
    .map((row) => normalizeSubjectId(row && row.subjectId))
    .filter((item, index, list) => item && list.indexOf(item) === index);
}

function buildS5LockedDisplayFillPayload(s5Payload = {}, readonlySourcePayload = {}, readonlySubtableSourceStage = "S4") {
  const s5Detail =
    s5Payload && s5Payload.detail && typeof s5Payload.detail === "object"
      ? s5Payload.detail
      : {};
  const sourceDetail =
    readonlySourcePayload && readonlySourcePayload.detail && typeof readonlySourcePayload.detail === "object"
      ? readonlySourcePayload.detail
      : {};
  const alignedS5Detail = alignMainDetailDimensions({
    ...s5Detail,
    rows: Array.isArray(s5Detail.rows) ? s5Detail.rows.map((row) => ({ ...row })) : [],
  }, sourceDetail);
  const mergedDetail = mergeReadonlySubtableRowsIntoMainAuditDetail(alignedS5Detail, sourceDetail);
  return {
    ...(s5Payload || {}),
    detail: {
      ...s5Detail,
      ...mergedDetail,
      valueSourceNodes: readonlySubtableSourceStage
        ? ["S5", readonlySubtableSourceStage]
          .filter((item, index, list) => item && list.indexOf(item) === index)
        : ["S5"],
      selectedSourceStage: "S5",
      mainSnapshotSourceStage: "S5",
      readonlySubtableSourceStage,
      mainPreviewSourceMode: "snapshot",
      calculatedMainPreview: false,
    },
    sourceStageCode: "S5",
  };
}

export async function buildMainTableDecisionApprovalPayload(ctx, flowSnapshot, dependencies = {}) {
  const buildMainTableSnapshotPayloadFromStageContext = dependencies.buildMainTableSnapshotPayloadFromStageContext;
  if (flowSnapshot.flowId == null) {
    const auditPayload = buildAuditDetailPayloadFromFillPayload({
      ...ctx,
      subjectDomain: "main",
    }, {
      project: {},
      detail: {},
      permissions: {},
    });
    auditPayload.detail = {
      ...(auditPayload.detail || {}),
      s5DecisionApproval: await buildS5DecisionApprovalMetaForContext(ctx, flowSnapshot, false, "S4", dependencies),
    };
    return auditPayload;
  }
  if (typeof buildMainTableSnapshotPayloadFromStageContext !== "function") {
    throw new Error("缺少主表快照构建器，无法打开 S5 决策评审详情");
  }
  const mainCtx = {
    ...ctx,
    subjectDomain: "main",
    subjectApiMode: "all",
    includeReadonlySubtablesInMain: true,
    stage: "S5",
    stageCode: "S5",
  };
  let s5Payload = await buildMainTableSnapshotPayloadFromStageContext(mainCtx, flowSnapshot, {
    sourceStageCode: "S5",
    recordStatus: "ARCHIVED",
  });
  let s5SubmittedRecords = await queryS5SubmittedMainRecords(
    mainCtx,
    flowSnapshot,
    extractMainSnapshotSubjectIds(s5Payload && s5Payload.detail)
  );
  const archivedRecordCount = Number(
    s5Payload &&
      s5Payload.detail &&
      s5Payload.detail.mainSnapshotRecordCount
  );
  if (s5SubmittedRecords.length > 0 && !archivedRecordCount) {
    s5Payload = await buildMainTableSnapshotPayloadFromStageContext(mainCtx, flowSnapshot, {
      sourceStageCode: "S5",
    });
    s5SubmittedRecords = await queryS5SubmittedMainRecords(
      mainCtx,
      flowSnapshot,
      extractMainSnapshotSubjectIds(s5Payload && s5Payload.detail)
    );
  }
  const flowLogRows = await loadProjectCostFlowLogRows(flowSnapshot, dependencies);
  const currentCycleMainSelected = evaluateCurrentCycleS5MainData(
    flowLogRows,
    flowSnapshot,
    mainCtx,
    s5SubmittedRecords
  );
  const hasS5Data = currentCycleMainSelected;
  const sourceStage = hasS5Data ? "S5" : "S4";
  let fillPayload;
  if (hasS5Data) {
    const readonlySubtableSourceStage =
      await resolveS5MainSelectionSourceStage(mainCtx, flowSnapshot, {
        ...dependencies,
        flowLogRows,
      }) || "S4";
    const readonlySourcePayload = await buildMainTableSnapshotPayloadFromStageContext(mainCtx, flowSnapshot, {
      sourceStageCode: readonlySubtableSourceStage,
    });
    fillPayload = buildS5LockedDisplayFillPayload(
      s5Payload,
      readonlySourcePayload,
      readonlySubtableSourceStage
    );
  } else {
    fillPayload = await buildMainTableSnapshotPayloadFromStageContext(mainCtx, flowSnapshot, {
      sourceStageCode: "S4",
    });
  }
  const auditPayload = buildAuditDetailPayloadFromFillPayload(mainCtx, fillPayload);
  auditPayload.detail = {
    ...(auditPayload.detail || {}),
    s5DecisionApproval: await buildS5DecisionApprovalMetaForContext(
      mainCtx,
      flowSnapshot,
      hasS5Data,
      sourceStage,
      {
        ...dependencies,
        flowLogRows,
      },
      {
        currentCycleMainSelected,
      }
    ),
  };
  setAuditContextCache(mainCtx, auditPayload);
  return auditPayload;
}

export async function submitS5DecisionApprovalPayload(mainCtx, flowSnapshot, dependencies = {}) {
  try {
    if (flowSnapshot.flowId == null) {
      return { ok: false, message: "未找到可用流程，无法提交 S5 决策评审" };
    }
    const executeStageSubmitFlow = dependencies.executeStageSubmitFlow;
    if (typeof executeStageSubmitFlow !== "function") {
      return { ok: false, message: "缺少流程提交器，无法提交 S5 决策评审" };
    }
    const buildMainTableSnapshotPayloadFromStageContext = dependencies.buildMainTableSnapshotPayloadFromStageContext;
    if (typeof buildMainTableSnapshotPayloadFromStageContext !== "function") {
      return { ok: false, message: "缺少主表快照构建器，无法校验 S5 主表数据" };
    }

    const currentStage = normalizeStageCode(flowSnapshot.node || mainCtx.stage || "S5");
    if (currentStage !== "S5") {
      return { ok: false, message: `当前流程已在 ${resolveStageLabel(currentStage)}，不能提交 S5 决策评审` };
    }
    if (!hasOperationPermission(mainCtx, "S5", "approve")) {
      return { ok: false, message: "当前权限不具备 S5 决策评审权限" };
    }

    const s5Payload = await buildMainTableSnapshotPayloadFromStageContext(mainCtx, flowSnapshot, {
      sourceStageCode: "S5",
      recordStatus: "ARCHIVED",
    });
    const s5Records = await queryS5SubmittedMainRecords(
      mainCtx,
      flowSnapshot,
      extractMainSnapshotSubjectIds(s5Payload && s5Payload.detail)
    );
    const flowLogRows = await loadProjectCostFlowLogRows(flowSnapshot, dependencies);
    const hasCurrentCycleS5Data = evaluateCurrentCycleS5MainData(
      flowLogRows,
      flowSnapshot,
      mainCtx,
      s5Records
    );
    if (!hasCurrentCycleS5Data) {
      return { ok: false, message: "请先完成本周期主表最终值选择，再提交 S5 决策评审" };
    }

    const flowResult = await executeStageSubmitFlow(
      mainCtx,
      flowSnapshot,
      "S6",
      `${resolveStageLabel("S5")} 决策评审通过`
    );
    return {
      ok: true,
      result: flowResult,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeText(error && error.message, "S5 决策评审提交失败"),
    };
  }
}
