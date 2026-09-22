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
  normalizeMainDataCheckValvePoint,
} from "./main-table-data-check";
import {
  fetchMainTableDataCheckHistoryValveSourcePayload,
  fetchMainTableDataCheckOtherProjectSourcePayload,
  fetchMainTableDataCheckSourcesPayload,
} from "./main-table-data-check.service";
import {
  buildCalculatedMainTablePayloadFromStageContextPayload,
  buildMainAuditFinalDetailPayload,
  buildMainTablePayloadForAuditDetailPayload,
  buildMainTableSnapshotPayloadFromStageContextPayload,
  buildS2SourceDetailForMainPayload,
  enrichSubtableAuditPayloadWithLoadedMainPreviewPayload,
  enrichSubtableAuditPayloadWithMainPreviewPayload,
  generateMainTableFromStageContextPayload,
  recalculateMainTableAuditPayload,
  submitMainTableAuditFinalPayload,
  submitMainTableVersionSelectionFinalPayload,
} from "./main-table.service";
import {
  normalizeAuditDetailResult,
} from "./payload-normalizer";
import {
  buildMainTableDecisionApprovalPayload,
  submitS5DecisionApprovalPayload,
} from "./s5-decision-approval";
import {
  ensureProjectCostFlow,
} from "./flow-context";
import {
  normalizeWorkbenchParams,
  safeText,
} from "./workbench-utils";

function requireDependency(dependencies = {}, key, message) {
  const value = dependencies[key];
  if (typeof value !== "function") {
    throw new Error(message);
  }
  return value;
}

function mainTableHelperDependencies(dependencies = {}) {
  return {
    fetchSubtableAuditDetail: requireDependency(
      dependencies,
      "fetchSubtableAuditDetail",
      "缺少子表审核详情加载器，无法构建主表载荷"
    ),
  };
}

async function invokeWorkbenchOperation(options = {}) {
  const { params = {}, realHandler } = options;
  const ctx = normalizeWorkbenchParams(params);
  return realHandler(ctx);
}

export async function enrichSubtableAuditPayloadWithMainPreviewEntry(
  ctx,
  flowSnapshot,
  auditPayload = {},
  dependencies = {}
) {
  return enrichSubtableAuditPayloadWithMainPreviewPayload(
    ctx,
    flowSnapshot,
    auditPayload,
    mainTableHelperDependencies(dependencies)
  );
}

export async function enrichSubtableAuditPayloadWithLoadedMainPreviewEntry(
  ctx,
  flowSnapshot,
  auditPayload = {},
  options = {},
  dependencies = {}
) {
  return enrichSubtableAuditPayloadWithLoadedMainPreviewPayload(
    ctx,
    flowSnapshot,
    auditPayload,
    options,
    mainTableHelperDependencies(dependencies)
  );
}

export async function refreshSubtableMainPreviewEntry(params = {}, dependencies = {}) {
  const payload = await invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return enrichSubtableAuditPayloadWithLoadedMainPreviewEntry(
        ctx,
        flowSnapshot,
        ctx.auditPayload || {},
        {
          mainDetail: ctx.mainPreviewDetail,
        },
        dependencies
      );
    },
  });
  return normalizeAuditDetailResult(payload);
}

export async function buildS2SourceDetailForMainEntry(
  ctx,
  flowSnapshot,
  options = {},
  dependencies = {}
) {
  return buildS2SourceDetailForMainPayload(
    ctx,
    flowSnapshot,
    options,
    mainTableHelperDependencies(dependencies)
  );
}

export async function buildCalculatedMainTablePayloadFromStageContextEntry(
  ctx,
  flowSnapshot,
  options = {},
  dependencies = {}
) {
  return buildCalculatedMainTablePayloadFromStageContextPayload(
    ctx,
    flowSnapshot,
    options,
    mainTableHelperDependencies(dependencies)
  );
}

export async function buildMainTablePayloadForAuditDetailEntry(
  ctx,
  flowSnapshot,
  dependencies = {}
) {
  return buildMainTablePayloadForAuditDetailPayload(
    ctx,
    flowSnapshot,
    mainTableHelperDependencies(dependencies)
  );
}

export async function buildMainTableSnapshotPayloadFromStageContextEntry(
  ctx,
  flowSnapshot,
  options = {}
) {
  return buildMainTableSnapshotPayloadFromStageContextPayload(ctx, flowSnapshot, options);
}

export async function generateMainTableFromStageContextEntry(
  ctx,
  flowSnapshot,
  options = {},
  dependencies = {}
) {
  return generateMainTableFromStageContextPayload(
    ctx,
    flowSnapshot,
    options,
    mainTableHelperDependencies(dependencies)
  );
}

async function buildMainAuditFinalDetail(ctx, flowSnapshot) {
  return buildMainAuditFinalDetailPayload(ctx, flowSnapshot);
}

export async function fetchMainTableVersionSelectionDetailEntry(params = {}) {
  const payload = await invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      if (flowSnapshot.flowId == null) {
        return buildAuditDetailPayloadFromFillPayload(ctx, {
          project: {},
          detail: {},
          permissions: {},
        });
      }
      const mainCtx = {
        ...ctx,
        subjectDomain: "main",
        subjectApiMode: "all",
      };
      const sourceStage = normalizeStageCode(ctx.selectedSourceStage || "S4");
      const s5Mode = safeText(ctx.s5Mode).toLowerCase();
      if (normalizeStageCode(ctx.stage || ctx.stageCode || "S5") === "S5" && s5Mode === "select_main") {
        const lockedPayload = await buildMainTableDecisionApprovalPayload(mainCtx, flowSnapshot, {
          buildMainTableSnapshotPayloadFromStageContext: buildMainTableSnapshotPayloadFromStageContextEntry,
        });
        const lockedMeta =
          lockedPayload &&
          lockedPayload.detail &&
          lockedPayload.detail.s5DecisionApproval;
        if (lockedMeta && lockedMeta.currentCycleMainSelected) {
          lockedPayload.detail = {
            ...(lockedPayload.detail || {}),
            s5MainSelectionLocked: {
              locked: true,
              sourceStage: "S5",
              lockedBy: lockedMeta.submittedBy || "",
              lockedAt: lockedMeta.submittedAt || "",
            },
          };
          setAuditContextCache(mainCtx, lockedPayload);
          return lockedPayload;
        }
      }
      const fillPayload = await buildMainTableSnapshotPayloadFromStageContextEntry(mainCtx, flowSnapshot, {
        sourceStageCode: sourceStage,
      });
      const auditPayload = buildAuditDetailPayloadFromFillPayload(mainCtx, fillPayload);
      setAuditContextCache(mainCtx, auditPayload);
      return auditPayload;
    },
  });
  return normalizeAuditDetailResult(payload);
}

export async function fetchMainTableDataCheckSourcesEntry(params = {}, dependencies = {}) {
  const payload = await invokeWorkbenchOperation({
    params: {
      ...params,
      subjectDomain: "main",
      subjectApiMode: "all",
      revenueTraceSource: safeText(params.revenueTraceSource, "数据校核主表快照"),
    },
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return fetchMainTableDataCheckSourcesPayload(ctx, flowSnapshot, {
        buildCalculatedMainTablePayloadFromStageContext: (nextCtx, nextFlowSnapshot, options) =>
          buildCalculatedMainTablePayloadFromStageContextEntry(nextCtx, nextFlowSnapshot, options, dependencies),
      });
    },
  });
  return payload;
}

export async function fetchMainTableDataCheckHistoryValveSourceEntry(params = {}, dependencies = {}) {
  const targetValvePoint = normalizeMainDataCheckValvePoint(
    params.historyValvePoint || params.targetValvePoint || params.valvePoint || params.valve
  );
  if (!targetValvePoint) {
    throw new Error("请选择历史阀点。");
  }
  const payload = await invokeWorkbenchOperation({
    params: {
      ...params,
      flowId: null,
      valve: targetValvePoint,
      valvePoint: targetValvePoint,
      stage: "S8",
      stageCode: "S8",
      subjectDomain: "main",
      subjectApiMode: "all",
      revenueTraceSource: safeText(params.revenueTraceSource, "数据校核历史阀点"),
    },
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return fetchMainTableDataCheckHistoryValveSourcePayload(ctx, flowSnapshot, targetValvePoint, {
        buildCalculatedMainTablePayloadFromStageContext: (nextCtx, nextFlowSnapshot, options) =>
          buildCalculatedMainTablePayloadFromStageContextEntry(nextCtx, nextFlowSnapshot, options, dependencies),
      });
    },
  });
  return payload;
}

export async function fetchMainTableDataCheckOtherProjectSourceEntry(params = {}, dependencies = {}) {
  const targetValvePoint = normalizeMainDataCheckValvePoint(
    params.historyValvePoint || params.targetValvePoint || params.valvePoint || params.valve
  );
  const targetProjectId = safeText(params.targetProjectId || params.projectId);
  if (!targetProjectId) {
    throw new Error("请选择对比项目。");
  }
  if (!targetValvePoint) {
    throw new Error("请选择阀点。");
  }
  const payload = await invokeWorkbenchOperation({
    params: {
      ...params,
      projectId: targetProjectId,
      projectCode: safeText(params.targetProjectCode || params.projectCode),
      projectNo: safeText(params.targetProjectNo || params.projectNo || params.targetProjectCode || params.projectCode),
      projectName: safeText(params.targetProjectName || params.projectName),
      flowId: null,
      id: null,
      valve: targetValvePoint,
      valvePoint: targetValvePoint,
      subjectDomain: "main",
      subjectApiMode: "all",
      revenueTraceSource: safeText(params.revenueTraceSource, "数据校核其他项目"),
    },
    realHandler: async (ctx) => {
      let flowSnapshot = null;
      try {
        flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      } catch (error) {
        const message = safeText(error && error.message);
        // 目标项目尚未绑定流程时按无数据返回，避免把对比导入做成写流程。
        if (message.includes("未找到当前项目收益流程")) {
          return {
            ok: true,
            hasMainPermission: true,
            currentStage: "S8",
            project: null,
            source: null,
            sources: [],
          };
        }
        throw error;
      }
      return fetchMainTableDataCheckOtherProjectSourcePayload(ctx, flowSnapshot, targetValvePoint, {
        buildCalculatedMainTablePayloadFromStageContext: (nextCtx, nextFlowSnapshot, options) =>
          buildCalculatedMainTablePayloadFromStageContextEntry(nextCtx, nextFlowSnapshot, options, dependencies),
      });
    },
  });
  return payload;
}

export async function fetchMainTableDecisionApprovalDetailEntry(params = {}) {
  const payload = await invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return buildMainTableDecisionApprovalPayload(ctx, flowSnapshot, {
        buildMainTableSnapshotPayloadFromStageContext: buildMainTableSnapshotPayloadFromStageContextEntry,
      });
    },
  });
  return normalizeAuditDetailResult(payload);
}

export async function submitMainTableAuditFinalEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const mainCtx = {
        ...ctx,
        subjectDomain: "main",
        subjectApiMode: "all",
      };
      const flowSnapshot = await ensureProjectCostFlow(mainCtx, { createIfMissing: false });
      return submitMainTableAuditFinalPayload(mainCtx, flowSnapshot, {
        buildMainAuditFinalDetail,
        executeStageSubmitFlow: dependencies.executeStageSubmitFlow,
      });
    },
  });
}

export async function submitMainTableVersionSelectionFinalEntry(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const mainCtx = {
        ...ctx,
        subjectDomain: "main",
        subjectApiMode: "all",
      };
      const flowSnapshot = await ensureProjectCostFlow(mainCtx, { createIfMissing: false });
      return submitMainTableVersionSelectionFinalPayload(mainCtx, flowSnapshot, {
        buildMainTableSnapshotPayloadFromStageContext: buildMainTableSnapshotPayloadFromStageContextEntry,
      });
    },
  });
}

export async function submitS5DecisionApprovalEntry(params = {}, dependencies = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const mainCtx = {
        ...ctx,
        subjectDomain: "main",
        subjectApiMode: "all",
        stage: "S5",
        stageCode: "S5",
      };
      const flowSnapshot = await ensureProjectCostFlow(mainCtx, { createIfMissing: false });
      return submitS5DecisionApprovalPayload(mainCtx, flowSnapshot, {
        buildMainTableSnapshotPayloadFromStageContext: buildMainTableSnapshotPayloadFromStageContextEntry,
        executeStageSubmitFlow: dependencies.executeStageSubmitFlow,
      });
    },
  });
}

export function recalculateMainTableAuditEntry(params = {}) {
  return invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      return recalculateMainTableAuditPayload(ctx, flowSnapshot);
    },
  });
}
