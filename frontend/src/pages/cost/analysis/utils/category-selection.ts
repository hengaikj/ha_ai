import type {
  CostAnalysisCategoryLevel,
  CostAnalysisCategoryNode,
} from "@/types/cost-analysis";

export interface CostAnalysisCategoryGroup {
  id: string;
  label: string;
  nodes: CostAnalysisCategoryNode[];
}

export interface CategoryGroupCheckState {
  checked: boolean;
  indeterminate: boolean;
}

export function flattenCostAnalysisCategories(
  nodes: CostAnalysisCategoryNode[],
): CostAnalysisCategoryNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenCostAnalysisCategories(node.children ?? []),
  ]);
}

export function replaceCategoryLevelSelection(
  currentIds: string[],
  node: Pick<CostAnalysisCategoryNode, "id" | "level">,
  allNodes: CostAnalysisCategoryNode[],
): { level: CostAnalysisCategoryLevel; ids: string[] } {
  const nodesById = new Map(allNodes.map((item) => [item.id, item]));
  const ids = Array.from(
    new Set([
      ...currentIds.filter((id) => nodesById.get(id)?.level === node.level),
      node.id,
    ]),
  );

  return { level: node.level, ids };
}

export function filterCostAnalysisCategoriesByLevel(
  nodes: CostAnalysisCategoryNode[],
  level: CostAnalysisCategoryLevel,
  keyword: string,
): CostAnalysisCategoryNode[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();

  return flattenCostAnalysisCategories(nodes).filter(
    (node) =>
      node.level === level &&
      (!normalizedKeyword ||
        node.name.toLocaleLowerCase().includes(normalizedKeyword)),
  );
}

function categorySortPath(
  node: CostAnalysisCategoryNode | undefined,
  nodesById: ReadonlyMap<string, CostAnalysisCategoryNode>,
): number[] {
  const path: number[] = [];
  let current = node;

  while (current) {
    path.unshift(current.sortNo);
    current = current.parentId ? nodesById.get(current.parentId) : undefined;
  }

  return path;
}

function compareCategoryHierarchy(
  left: CostAnalysisCategoryNode | undefined,
  right: CostAnalysisCategoryNode | undefined,
  nodesById: ReadonlyMap<string, CostAnalysisCategoryNode>,
): number {
  const leftPath = categorySortPath(left, nodesById);
  const rightPath = categorySortPath(right, nodesById);
  const comparableLength = Math.min(leftPath.length, rightPath.length);

  for (let index = 0; index < comparableLength; index += 1) {
    const difference = leftPath[index] - rightPath[index];
    if (difference !== 0) return difference;
  }

  return leftPath.length - rightPath.length;
}

export function buildCostAnalysisCategoryGroups(
  nodes: CostAnalysisCategoryNode[],
  level: CostAnalysisCategoryLevel,
  keyword: string,
): CostAnalysisCategoryGroup[] {
  const visibleNodes = filterCostAnalysisCategoriesByLevel(
    nodes,
    level,
    keyword,
  );

  if (level === 0 || level === 1) {
    return visibleNodes.length
      ? [{ id: "level-1", label: "", nodes: visibleNodes }]
      : [];
  }

  const nodesById = new Map(
    flattenCostAnalysisCategories(nodes).map((node) => [node.id, node]),
  );
  const groups = new Map<string, CostAnalysisCategoryGroup>();

  visibleNodes.forEach((node) => {
    const parent = nodesById.get(node.parentId ?? "");
    const groupId = parent?.id ?? node.parentId ?? "";
    const groupLabel =
      level === 2
        ? (node.parentName ?? parent?.name ?? "")
        : (node.parentPath ?? parent?.path ?? "")
            .split("/")
            .map((segment) => segment.trim())
            .join(" / ");
    const group = groups.get(groupId) ?? {
      id: groupId,
      label: groupLabel,
      nodes: [],
    };

    group.nodes.push(node);
    groups.set(groupId, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      nodes: [...group.nodes].sort((left, right) => left.sortNo - right.sortNo),
    }))
    .sort((left, right) => {
      const leftParent = nodesById.get(left.id);
      const rightParent = nodesById.get(right.id);
      return compareCategoryHierarchy(leftParent, rightParent, nodesById);
    });
}

export function getCategoryGroupCheckState(
  selectedIds: string[],
  visibleIds: string[],
): CategoryGroupCheckState {
  const selectedIdSet = new Set(selectedIds);
  const selectedCount = visibleIds.filter((id) => selectedIdSet.has(id)).length;

  return {
    checked: visibleIds.length > 0 && selectedCount === visibleIds.length,
    indeterminate: selectedCount > 0 && selectedCount < visibleIds.length,
  };
}

export function applyCategoryGroupSelection(
  current: {
    level: CostAnalysisCategoryLevel | null;
    ids: string[];
  },
  level: CostAnalysisCategoryLevel,
  visibleIds: string[],
  checked: boolean,
): {
  level: CostAnalysisCategoryLevel | null;
  ids: string[];
} {
  const currentIds = current.level === level ? current.ids : [];
  const visibleIdSet = new Set(visibleIds);
  const ids = checked
    ? Array.from(new Set([...currentIds, ...visibleIds]))
    : currentIds.filter((id) => !visibleIdSet.has(id));

  return ids.length > 0 ? { level, ids } : { level: null, ids: [] };
}
