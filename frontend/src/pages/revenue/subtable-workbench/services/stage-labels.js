import { normalizeStageCode } from "../domain-config";
import { safeText } from "./workbench-utils";

export const STAGE_FLOW_CODES = Object.freeze(["S1", "S2", "S3", "S4", "S5", "S6", "S8"]);

const STAGE_LABEL_MAP = Object.freeze({
  S1: "S1 业务经理填报",
  S2: "S2 集团部室审核",
  S3: "S3 业务经理二次确认",
  S4: "S4 二级公司财务审核",
  S5: "S5 二级公司最终提交",
  S6: "S6 集团财务审核",
  S8: "S8 集团上会评审",
});

export function resolveStageLabel(stageCode = "") {
  const normalized = normalizeStageCode(stageCode || "S1");
  return STAGE_LABEL_MAP[normalized] || normalized;
}

export function resolveNextStageCode(stageCode = "S1") {
  const normalized = normalizeStageCode(stageCode);
  const index = STAGE_FLOW_CODES.indexOf(normalized);
  if (index < 0) return "S2";
  return STAGE_FLOW_CODES[Math.min(index + 1, STAGE_FLOW_CODES.length - 1)];
}

export function resolveFillSubmitNextStage(stageCode = "S1") {
  const normalized = normalizeStageCode(stageCode);
  if (normalized === "S1") return "S2";
  if (normalized === "S2") return "S3";
  return resolveNextStageCode(normalized);
}

export function normalizeStageNodeList(nodes) {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  const seen = {};
  return list.reduce((result, item) => {
    const raw = safeText(item);
    if (!raw) return result;
    const normalized = normalizeStageCode(raw);
    if (!normalized || seen[normalized]) return result;
    seen[normalized] = true;
    result.push(normalized);
    return result;
  }, []);
}

export function resolveSubmittedValueSourceNodes(ctx = {}, flowSnapshot = null) {
  const currentNode = normalizeStageCode(
    (flowSnapshot && flowSnapshot.node) || ctx.stage || "S1"
  );
  const index = STAGE_FLOW_CODES.indexOf(currentNode);
  if (index <= 0) return ["S1"];

  return STAGE_FLOW_CODES.slice(0, index).reverse();
}
