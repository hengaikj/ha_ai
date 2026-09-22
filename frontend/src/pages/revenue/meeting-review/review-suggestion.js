export const MODULE_META_MARKER = "[[RV_MODULE_META]]";
export const CELL_META_MARKER = "[[RV_CELL_DRAFT]]";
export const DECISION_META_MARKER = "[[RV_DECISION_APPROVAL]]";
export const MEETING_REVIEW_SUGGESTION_TYPE = "MEETING_REVIEW_DECISION";

function safeReviewText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

export function decodeReviewSuggestionText(value) {
  let text = String(value == null ? "" : value);
  if (!text || text.indexOf("&") < 0) return text;

  for (let index = 0; index < 3; index += 1) {
    const next = text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|quot|amp|lt|gt|apos|nbsp);/g, (match, entity) => {
      const code = String(entity || "").toLowerCase();
      if (code === "quot") return "\"";
      if (code === "amp") return "&";
      if (code === "lt") return "<";
      if (code === "gt") return ">";
      if (code === "apos") return "'";
      if (code === "nbsp") return " ";
      if (code.startsWith("#x")) {
        const valueCode = Number.parseInt(code.slice(2), 16);
        return Number.isFinite(valueCode) ? String.fromCharCode(valueCode) : match;
      }
      if (code.startsWith("#")) {
        const valueCode = Number.parseInt(code.slice(1), 10);
        return Number.isFinite(valueCode) ? String.fromCharCode(valueCode) : match;
      }
      return match;
    });
    if (next === text) break;
    text = next;
  }
  return text;
}

function normalizePayloadStringValues(value) {
  if (Array.isArray(value)) return value.map((item) => normalizePayloadStringValues(item));
  if (value && typeof value === "object") {
    return Object.keys(value).reduce((result, key) => {
      result[key] = normalizePayloadStringValues(value[key]);
      return result;
    }, {});
  }
  return typeof value === "string" ? decodeReviewSuggestionText(value) : value;
}

function parseJsonObjectText(value) {
  const rawText = safeReviewText(value);
  if (!rawText) return null;
  const candidates = [decodeReviewSuggestionText(rawText), rawText]
    .filter((item, index, list) => item && list.indexOf(item) === index);

  for (let index = 0; index < candidates.length; index += 1) {
    try {
      const parsed = JSON.parse(candidates[index]);
      if (parsed && typeof parsed === "object") {
        return normalizePayloadStringValues(parsed);
      }
    } catch (_error) {
      // Try the next representation.
    }
  }
  return null;
}

export function parseMeetingReviewSuggestionText(value) {
  const parsed = parseJsonObjectText(value);
  if (!parsed || safeReviewText(parsed.type) !== MEETING_REVIEW_SUGGESTION_TYPE) return null;
  return parsed;
}

function parseMarkedReviewSuggestion(text, marker) {
  const body = text.slice(marker.length);
  const lineBreakIndex = body.indexOf("\n");
  const encodedMeta = lineBreakIndex >= 0 ? body.slice(0, lineBreakIndex) : body;
  const opinion = lineBreakIndex >= 0 ? body.slice(lineBreakIndex + 1) : "";
  let meta;
  try {
    meta = JSON.parse(decodeURIComponent(encodedMeta));
  } catch (_error) {
    meta = {};
  }

  if (marker === MODULE_META_MARKER) {
    return {
      title: safeReviewText(meta.moduleName, "模块评审"),
      stageCode: safeReviewText(meta.stageCode),
      opinion: decodeReviewSuggestionText(opinion),
    };
  }
  if (marker === DECISION_META_MARKER) {
    return {
      title: "决策评审",
      stageCode: safeReviewText(meta.stageCode, "S5"),
      opinion: decodeReviewSuggestionText(opinion),
    };
  }
  const titleParts = [
    safeReviewText(meta.moduleName || meta.rootSubjectId || meta.rowId),
    safeReviewText(meta.yearLabel),
    safeReviewText(meta.trimName),
  ].filter(Boolean);
  return {
    title: titleParts.length ? titleParts.join(" / ") : "单元格评审",
    stageCode: safeReviewText(meta.stageCode),
    opinion: decodeReviewSuggestionText(opinion),
  };
}

export function parseReviewSuggestionDetail(value) {
  const rawText = safeReviewText(value);
  const text = safeReviewText(decodeReviewSuggestionText(rawText));
  if (!text) return { title: "评审意见", opinion: "", stageCode: "" };

  const markers = [MODULE_META_MARKER, CELL_META_MARKER, DECISION_META_MARKER];
  const marker = markers.find((item) => text.startsWith(item));
  if (marker) return parseMarkedReviewSuggestion(text, marker);

  const parsed = parseJsonObjectText(rawText);
  if (parsed && typeof parsed === "object") {
    const sourceLabel = safeReviewText(parsed.sourceLabel);
    const title = sourceLabel ? `上会定值：${sourceLabel}` : "上会评审意见";
    const opinionParts = [
      safeReviewText(parsed.meetingOpinion),
      safeReviewText(parsed.customDecisionNote),
      safeReviewText(parsed.opinion || parsed.reviewOpinion || parsed.comment || parsed.remark),
    ].filter((item, index, list) => item && list.indexOf(item) === index);
    return {
      title,
      stageCode: safeReviewText(parsed.stageCode),
      opinion: opinionParts.join("；") || "已记录结构化评审意见",
    };
  }

  return { title: "评审意见", opinion: text, stageCode: "" };
}
