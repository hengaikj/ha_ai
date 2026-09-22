export function toDateTimeRangeParams(
  range: string[] | null | undefined,
): { createdFrom?: string; createdTo?: string } {
  const [createdFrom, createdTo] = Array.isArray(range) ? range : [];

  return {
    createdFrom: createdFrom ? `${createdFrom} 00:00:00` : undefined,
    createdTo: createdTo ? `${createdTo} 23:59:59` : undefined,
  };
}
