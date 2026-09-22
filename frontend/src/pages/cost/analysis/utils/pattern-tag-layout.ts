export interface AdaptiveTagLimitInput {
  availableWidth: number;
  tagWidths: number[];
  collapsedTagWidth: number;
  gap: number;
  reservedWidth: number;
}

export function getAdaptiveTagLimit({
  availableWidth,
  tagWidths,
  collapsedTagWidth,
  gap,
  reservedWidth,
}: AdaptiveTagLimitInput): number {
  if (tagWidths.length === 0) return 1;

  const contentWidth = Math.max(0, availableWidth - reservedWidth);
  let visibleWidth = 0;
  let limit = 1;

  for (let index = 0; index < tagWidths.length; index += 1) {
    visibleWidth += index === 0 ? tagWidths[index] : gap + tagWidths[index];
    const hiddenCount = tagWidths.length - index - 1;
    const collapsedWidth = hiddenCount > 0 ? gap + collapsedTagWidth : 0;

    if (visibleWidth + collapsedWidth > contentWidth) break;
    limit = index + 1;
  }

  return limit;
}
