import { normalizeStageCode } from "@/pages/revenue/subtable-workbench/domain-config";

const PROJECT_LIST_HIDDEN_STAGE_ACTIONS = Object.freeze({
  S7: Object.freeze(["start_meeting", "start-meeting", "startmeeting"]),
  S8: Object.freeze(["review", "audit"]),
});

function normalizeActionKey(actionKey = "") {
  return String(actionKey || "").trim().toLowerCase();
}

export function filterProjectListStageActions({
  menuKey = "",
  stageCode = "",
  actions = [],
} = {}) {
  const list = Array.isArray(actions) ? actions : [];
  if (menuKey !== "project_list") return list;

  const stage = normalizeStageCode(stageCode || "");
  const hiddenActions = PROJECT_LIST_HIDDEN_STAGE_ACTIONS[stage];
  if (!hiddenActions) return list;

  return list.filter((item) => !hiddenActions.includes(normalizeActionKey(item && item.key)));
}
