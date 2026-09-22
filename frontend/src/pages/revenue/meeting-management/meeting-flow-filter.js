const ACTIVE_NODE_STATUSES = Object.freeze(["PROCESSING", "IN_PROGRESS", "RUNNING"]);

function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function normalizeFlowId(value) {
  const text = safeText(value);
  return /^\d+$/.test(text) ? text : "";
}

function normalizeStage(value) {
  const text = safeText(value).toUpperCase();
  const hit = text.match(/^S([1-8])(?=$|[^0-9])/);
  return hit ? `S${hit[1]}` : text;
}

function isActiveS7Flow(row = {}) {
  const stage = normalizeStage(row.node || row.stageCode || row.stage);
  const status = safeText(row.nodeStatus).toUpperCase();
  return stage === "S7" && (!status || ACTIVE_NODE_STATUSES.includes(status));
}

export function buildActiveS7FlowMap(flowRows = []) {
  const map = {};
  (Array.isArray(flowRows) ? flowRows : []).forEach((row) => {
    if (!isActiveS7Flow(row)) return;
    const flowId = normalizeFlowId(row.flowId || row.id);
    if (flowId) map[flowId] = row;
  });
  return map;
}

export function filterMeetingRowsByActiveS7Flows(meetingRows = [], flowRows = []) {
  const activeFlowMap = buildActiveS7FlowMap(flowRows);
  return (Array.isArray(meetingRows) ? meetingRows : [])
    .map((row) => {
      const flowId = normalizeFlowId(row && (row.flowId || row.projectCostFlowId));
      const flow = flowId ? activeFlowMap[flowId] : null;
      if (!flow) return null;
      return {
        ...row,
        flowId,
        node: normalizeStage(flow.node || flow.stageCode || flow.stage) || row.node,
        nodeStatus: safeText(flow.nodeStatus || row.nodeStatus).toUpperCase(),
      };
    })
    .filter(Boolean);
}
