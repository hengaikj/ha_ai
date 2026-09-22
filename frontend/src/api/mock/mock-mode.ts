export function isMockEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_MOCK === "true";
}

export function isCommitteeMockEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_COMMITTEE_MOCK === "true";
}
