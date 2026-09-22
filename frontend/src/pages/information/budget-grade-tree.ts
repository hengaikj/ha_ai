import type { BudgetGradeItem } from "@/types/project";

export type GradeRow = {
  id: number;
  code: string;
  name: string;
  parentId: number;
  level: number;
  fullPathIds: string;
  sortNo: number;
  status: string;
  remark: string;
  version: number;
  createdAt: string;
  hasChildren: boolean;
  isLeaf: boolean;
  parentName: string;
};

export type LazyGradeTree = {
  roots: GradeRow[];
  nodeCount: number;
};

export type VisibleGradeRow = {
  row: GradeRow;
  id: number;
  depth: number;
};

const lazyChildrenKey = Symbol("budget-grade-lazy-children");

type GradeRowWithLazyChildren = GradeRow & {
  [lazyChildrenKey]?: GradeRow[];
};

export function buildLazyGradeTree(items: BudgetGradeItem[]): LazyGradeTree {
  const nodesById = new Map<number, GradeRow>();
  const roots = items.map(mapGradeRow);
  const pending = items.map((item, index) => ({ item, row: roots[index]! }));

  let nodeCount = 0;
  while (pending.length > 0) {
    const current = pending.pop()!;
    const { item, row } = current;
    nodeCount += 1;
    nodesById.set(row.id, row);

    if (!item.children?.length) {
      continue;
    }

    const childRows = item.children.map(mapGradeRow);
    Object.defineProperty(row, lazyChildrenKey, {
      value: childRows,
      configurable: true,
    });
    for (let index = 0; index < item.children.length; index += 1) {
      pending.push({ item: item.children[index]!, row: childRows[index]! });
    }
  }

  nodesById.forEach((row) => {
    row.parentName = nodesById.get(row.parentId)?.name ?? "";
  });

  return { roots, nodeCount };
}

export function getLazyGradeChildren(row?: GradeRow): GradeRow[] {
  return (row as GradeRowWithLazyChildren | undefined)?.[lazyChildrenKey] ?? [];
}

export function flattenVisibleGradeRows(
  roots: GradeRow[],
  expandedIds: ReadonlySet<number>,
): VisibleGradeRow[] {
  const visibleRows: VisibleGradeRow[] = [];
  const pending = roots.map((row) => ({ row, depth: 0 })).reverse();

  while (pending.length > 0) {
    const current = pending.pop()!;
    visibleRows.push({ ...current, id: current.row.id });
    if (!expandedIds.has(current.row.id)) {
      continue;
    }

    const children = getLazyGradeChildren(current.row);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push({ row: children[index]!, depth: current.depth + 1 });
    }
  }

  return visibleRows;
}

export function collectExpandableGradeIds(roots: GradeRow[]): Set<number> {
  const ids = new Set<number>();
  const pending = [...roots];
  while (pending.length > 0) {
    const row = pending.pop()!;
    if (!row.hasChildren) {
      continue;
    }
    ids.add(row.id);
    pending.push(...getLazyGradeChildren(row));
  }
  return ids;
}

function mapGradeRow(item: BudgetGradeItem): GradeRow {
  const hasChildren = Boolean(item.children?.length);
  return {
    id: Number(item.gradeId),
    code: item.gradeCode,
    name: item.gradeName,
    parentId: Number(item.parentId),
    level: item.gradeLevel,
    fullPathIds: item.fullPathIds ?? "",
    sortNo: item.sortOrder,
    status: item.status,
    remark: "",
    version: item.version,
    createdAt: item.createdAt ?? "",
    hasChildren,
    isLeaf: !hasChildren,
    parentName: "",
  };
}
