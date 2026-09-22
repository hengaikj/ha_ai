export function normalizeValveGateCode(name: string, fallback = "") {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .slice(0, 32);
  return normalized || fallback.trim().slice(0, 32);
}
