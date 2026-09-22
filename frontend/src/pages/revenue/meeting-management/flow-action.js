function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

export function buildS7StartMeetingActionPayload({
  operatorId = "",
  operatorName = "",
} = {}) {
  const normalizedOperatorId = safeText(operatorId);
  const normalizedOperatorName = safeText(operatorName, normalizedOperatorId);

  return {
    action: "start-meeting",
    targetNode: "S8",
    targetNodeStatus: "IN_PROGRESS",
    operatorId: normalizedOperatorId,
    operatorName: normalizedOperatorName,
    actionRemark: "S7 \u4e0a\u4f1a\u7ba1\u7406\u5f00\u59cb\u4e0a\u4f1a\u5e76\u6d41\u8f6c\u5230 S8",
    secondTriggerRequired: false,
  };
}
