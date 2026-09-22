type CostBomExportFileNameOptions = {
  projectName?: string | null;
  valveName?: string | null;
  version?: string | number | null;
  date?: Date;
};

function normalizeFileNameSegment(
  value: string | number | null | undefined,
  fallback = "--",
) {
  const text = String(value ?? "").trim();
  return (text || fallback).replace(/[\\/:*?"<>|]/g, "_");
}

export function normalizeCostBomVersion(
  value: string | number | null | undefined,
) {
  return String(value ?? "")
    .trim()
    .replace(/^V/i, "");
}

export function formatCostBomVersion(
  value: string | number | null | undefined,
) {
  const version = normalizeCostBomVersion(value);
  return version ? `V${version}` : "--";
}

export function buildCostBomExportFileName({
  projectName,
  valveName,
  version,
  date = new Date(),
}: CostBomExportFileNameOptions) {
  const dateText = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  return (
    [
      "成本BOM",
      normalizeFileNameSegment(projectName),
      normalizeFileNameSegment(valveName),
      normalizeFileNameSegment(formatCostBomVersion(version)),
      dateText,
    ].join("-") + ".xlsx"
  );
}
