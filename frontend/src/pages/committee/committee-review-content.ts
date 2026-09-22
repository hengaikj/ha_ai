export const committeeReviewContentMaxCharacters = 5000;

const ignoredEditorCharactersPattern = /[\u200b\ufeff]/g;

function extractTextWithoutDomParser(content: string) {
  return content
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function extractCommitteeReviewText(content: unknown) {
  const source = String(content ?? "");
  if (!source) return "";
  const contentWithoutImages = source.replace(/<img\b[^>]*>/gi, "");
  if (typeof DOMParser === "undefined") {
    return extractTextWithoutDomParser(contentWithoutImages).replace(
      ignoredEditorCharactersPattern,
      "",
    );
  }
  const document = new DOMParser().parseFromString(
    contentWithoutImages,
    "text/html",
  );
  document.body.querySelectorAll("script, style").forEach((node) => {
    node.remove();
  });
  return (document.body.textContent ?? "").replace(
    ignoredEditorCharactersPattern,
    "",
  );
}

export function countCommitteeReviewCharacters(content: unknown) {
  return Array.from(extractCommitteeReviewText(content)).length;
}
