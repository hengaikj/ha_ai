/**
 * Compare identifiers returned by services that may serialize BIGINT values
 * as either JSON numbers or strings.
 */
export function sameBackendId(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    return String(value);
  };

  const leftId = normalize(left);
  const rightId = normalize(right);
  if (leftId === null || rightId === null) {
    return false;
  }
  return leftId === rightId;
}
