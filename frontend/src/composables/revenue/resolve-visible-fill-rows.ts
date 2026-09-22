import type { MatrixRow } from "@/types/revenue";

interface VisibleFillRowSource {
  canEditFill?: boolean;
  visibleSubjectMap?: Record<string, boolean>;
  detail?: { rows?: unknown } | Record<string, unknown> | null;
}

/**
 * 从填报详情行中解析当前账号可见科目。
 *
 * 页面展示走 computed `filteredRows`，composable 不能依赖从未回写的
 * `state.filteredRows`（迁移后该字段始终为空）。
 */
export function resolveVisibleFillRows(
  state: VisibleFillRowSource,
  canEditFill = Boolean(state.canEditFill),
): MatrixRow[] {
  const detail = state.detail as { rows?: MatrixRow[] } | undefined;
  const rows = Array.isArray(detail?.rows) ? detail.rows : [];
  if (!canEditFill) return rows;
  const visibleMap = state.visibleSubjectMap || {};
  if (!Object.keys(visibleMap).length) return [];
  return rows.filter((row) => {
    const subjectId = String(row.subjectId || row.id || row.rowId || "").trim();
    const rowId = String(row.id ?? "");
    return Boolean(visibleMap[subjectId] || visibleMap[rowId]);
  });
}
