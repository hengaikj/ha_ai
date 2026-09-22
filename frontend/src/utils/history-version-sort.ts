/** Sort history rows: createTime desc, then version parts desc (e.g. V1.2 > V1.1). */

function toTimeMs(value?: string | null): number {
  if (!value) return 0;
  const normalized = String(value).trim().replace(/-/g, "/");
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseVersionParts(value: unknown): number[] {
  const matches = String(value ?? "").match(/\d+/g);
  return matches ? matches.map((part) => Number(part)) : [];
}

/** Compare version labels descending: higher version first. */
export function compareVersionLabelDesc(a: unknown, b: unknown): number {
  const left = parseVersionParts(a);
  const right = parseVersionParts(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    if (leftPart !== rightPart) {
      return rightPart - leftPart;
    }
  }
  return 0;
}

export function sortByCreateTimeThenVersionDesc<
  T extends { createTime?: string | null },
>(rows: T[], getVersion: (row: T) => unknown): T[] {
  return [...rows].sort((left, right) => {
    const timeDiff = toTimeMs(right.createTime) - toTimeMs(left.createTime);
    if (timeDiff !== 0) return timeDiff;
    return compareVersionLabelDesc(getVersion(left), getVersion(right));
  });
}
