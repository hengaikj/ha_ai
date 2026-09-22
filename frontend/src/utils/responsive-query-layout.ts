export function resolveQueryFormColumns(containerWidth: number): 1 | 2 | 3 {
  if (containerWidth >= 960) return 3;
  if (containerWidth >= 560) return 2;
  return 1;
}
