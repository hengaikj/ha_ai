import {
  buildAuditDetailPayloadFromFillPayload,
} from "./audit-payload";
import {
  setAuditContextCache,
} from "./audit-context-cache";
import {
  rememberFormulaError,
} from "./detail-diagnostics";
import {
  fetchRealSubtableFillPayload,
} from "./fill.service";
import {
  ensureProjectCostFlow,
} from "./flow-context";
import {
  normalizeAuditDetailResult,
} from "./payload-normalizer";
import {
  normalizeWorkbenchParams,
} from "./workbench-utils";

function requireDependency(dependencies = {}, key, message) {
  const value = dependencies[key];
  if (typeof value !== "function") {
    throw new Error(message);
  }
  return value;
}

async function invokeWorkbenchOperation(options = {}) {
  const { params = {}, realHandler } = options;
  const ctx = normalizeWorkbenchParams(params);
  return realHandler(ctx);
}

export async function fetchSubtableAuditDetailEntry(params = {}, dependencies = {}) {
  const payload = await invokeWorkbenchOperation({
    params,
    realHandler: async (ctx) => {
      const flowSnapshot = await ensureProjectCostFlow(ctx, { createIfMissing: false });
      const auditCtx = ctx.subjectDomain === "main"
        ? {
            ...ctx,
            subjectDomain: "main",
            subjectApiMode: "all",
            includeReadonlySubtablesInMain: true,
          }
        : ctx;
      const fillPayload = auditCtx.subjectDomain === "main"
        ? await requireDependency(
            dependencies,
            "buildMainTablePayloadForAuditDetail",
            "缺少主表审核载荷构建器，无法加载审核详情"
          )(auditCtx, flowSnapshot)
        : await fetchRealSubtableFillPayload(auditCtx, { ownerScoped: false });
      let auditPayload = buildAuditDetailPayloadFromFillPayload(auditCtx, fillPayload);
      if (auditCtx.subjectDomain !== "main") {
        try {
          auditPayload = await requireDependency(
            dependencies,
            "enrichSubtableAuditPayloadWithMainPreview",
            "缺少主表预览构建器，无法加载审核详情"
          )(auditCtx, flowSnapshot, auditPayload);
        } catch (error) {
          rememberFormulaError(auditPayload && auditPayload.detail, error);
        }
      }

      setAuditContextCache(auditCtx, auditPayload);
      return auditPayload;
    },
  });
  return normalizeAuditDetailResult(payload);
}
