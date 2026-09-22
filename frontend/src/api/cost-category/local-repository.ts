import { COST_ANALYSIS_CATEGORY_TREE } from "@/api/cost-analysis/mock/categories";
import type {
  CostAnalysisCategoryLevel,
  CostAnalysisCategoryNode,
} from "@/types/cost-analysis";

export const LOCAL_COST_CATEGORY_STORAGE_KEY =
  "bq:cost-category:local-repository:v1";

const STORAGE_VERSION = 1;
const INITIAL_CREATED_AT = "2026-07-20 16:29:05";

export interface LocalCostCategoryNode extends CostAnalysisCategoryNode {
  status: "ENABLED" | "DISABLED";
  remark: string;
  version: number;
  createdAt: string;
  children?: LocalCostCategoryNode[];
}

export interface CreateLocalCostCategoryInput {
  parentId: string | null;
  name: string;
}

export interface UpdateLocalCostCategoryInput {
  parentId: string | null;
  name: string;
}

type StoredCategoryTree = {
  version: number;
  tree: LocalCostCategoryNode[];
};

let categoryTree: LocalCostCategoryNode[] | null = null;
let localIdCounter = 0;

function cloneCategory(node: LocalCostCategoryNode): LocalCostCategoryNode {
  return {
    ...node,
    engineers: node.engineers ? [...node.engineers] : undefined,
    coveredParts: node.coveredParts ? [...node.coveredParts] : undefined,
    children: node.children?.map(cloneCategory) ?? [],
  };
}

function createInitialCategoryTree(): LocalCostCategoryNode[] {
  const enrich = (node: CostAnalysisCategoryNode): LocalCostCategoryNode => ({
    ...node,
    status: "ENABLED",
    remark: "",
    version: 0,
    createdAt: INITIAL_CREATED_AT,
    engineers: node.engineers ? [...node.engineers] : undefined,
    coveredParts: node.coveredParts ? [...node.coveredParts] : undefined,
    children: node.children?.map(enrich) ?? [],
  });

  return COST_ANALYSIS_CATEGORY_TREE.map(enrich);
}

function isCategoryTree(value: unknown): value is LocalCostCategoryNode[] {
  return (
    Array.isArray(value) &&
    value.every(
      (node) =>
        node &&
        typeof node === "object" &&
        typeof (node as LocalCostCategoryNode).id === "string" &&
        typeof (node as LocalCostCategoryNode).name === "string" &&
        Array.isArray((node as LocalCostCategoryNode).children),
    )
  );
}

function readStoredCategoryTree(): LocalCostCategoryNode[] | null {
  try {
    const stored = localStorage.getItem(LOCAL_COST_CATEGORY_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as StoredCategoryTree;
    if (parsed.version !== STORAGE_VERSION || !isCategoryTree(parsed.tree)) {
      return null;
    }
    return parsed.tree.map(cloneCategory);
  } catch {
    return null;
  }
}

function persistCategoryTree(): void {
  if (!categoryTree) return;
  try {
    localStorage.setItem(
      LOCAL_COST_CATEGORY_STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        tree: categoryTree,
      } satisfies StoredCategoryTree),
    );
  } catch {
    // 本地存储不可用时仍保留当前页面会话内的分类编辑结果。
  }
}

function currentCategoryTree(): LocalCostCategoryNode[] {
  if (!categoryTree) {
    categoryTree = readStoredCategoryTree() ?? createInitialCategoryTree();
  }
  return categoryTree;
}

function flattenCategories(
  nodes: LocalCostCategoryNode[],
): LocalCostCategoryNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenCategories(node.children ?? []),
  ]);
}

function findCategory(id: string): LocalCostCategoryNode | undefined {
  return flattenCategories(currentCategoryTree()).find(
    (node) => node.id === id,
  );
}

function findSiblings(
  nodes: LocalCostCategoryNode[],
  id: string,
): LocalCostCategoryNode[] | undefined {
  if (nodes.some((node) => node.id === id)) return nodes;
  for (const node of nodes) {
    const siblings = findSiblings(node.children ?? [], id);
    if (siblings) return siblings;
  }
  return undefined;
}

function categoryDepth(node: LocalCostCategoryNode): number {
  if (!node.children?.length) return 1;
  return 1 + Math.max(...node.children.map((child) => categoryDepth(child)));
}

function updateNodeHierarchy(
  node: LocalCostCategoryNode,
  parent: LocalCostCategoryNode | undefined,
  level: CostAnalysisCategoryLevel,
): void {
  node.parentId = parent?.id ?? null;
  node.level = level;
  node.path = parent ? `${parent.path}/${node.name}` : node.name;
  node.children?.forEach((child) => {
    updateNodeHierarchy(child, node, (level + 1) as CostAnalysisCategoryLevel);
  });
}

function nextLocalId(): string {
  const existingIds = new Set(
    flattenCategories(currentCategoryTree()).map((node) => node.id),
  );
  let id: string;
  do {
    localIdCounter += 1;
    id = `local-category-${String(localIdCounter).padStart(4, "0")}`;
  } while (existingIds.has(id));
  return id;
}

function currentDateTime(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  ].join(" ");
}

export function getLocalCostCategoryTree(): LocalCostCategoryNode[] {
  return currentCategoryTree().map(cloneCategory);
}

export function createLocalCostCategory(
  input: CreateLocalCostCategoryInput,
): LocalCostCategoryNode {
  const name = input.name.trim();
  if (!name) {
    throw new Error("分类名称不能为空");
  }
  const parent = input.parentId ? findCategory(input.parentId) : undefined;
  if (input.parentId && !parent) {
    throw new Error("上级分类不存在");
  }
  if (parent?.level === 3) {
    throw new Error("成本分类最多支持三级");
  }

  const siblings = parent ? (parent.children ??= []) : currentCategoryTree();
  const id = nextLocalId();
  const level = (parent ? parent.level + 1 : 1) as CostAnalysisCategoryLevel;
  const node: LocalCostCategoryNode = {
    id,
    parentId: parent?.id ?? null,
    level,
    code: `LOCAL_${String(localIdCounter).padStart(4, "0")}`,
    name,
    path: parent ? `${parent.path}/${name}` : name,
    sortNo: siblings.length + 1,
    status: "ENABLED",
    remark: "",
    version: 0,
    createdAt: currentDateTime(),
    children: [],
  };
  siblings.push(node);
  persistCategoryTree();
  return cloneCategory(node);
}

export function updateLocalCostCategory(
  id: string,
  input: UpdateLocalCostCategoryInput,
): LocalCostCategoryNode {
  const node = findCategory(id);
  if (!node) {
    throw new Error("成本分类不存在");
  }
  const name = input.name.trim();
  if (!name) {
    throw new Error("分类名称不能为空");
  }
  const parent = input.parentId ? findCategory(input.parentId) : undefined;
  if (input.parentId && !parent) {
    throw new Error("上级分类不存在");
  }
  const descendantIds = new Set(
    flattenCategories([node]).map((item) => item.id),
  );
  if (parent && descendantIds.has(parent.id)) {
    throw new Error("上级分类不能选择当前分类或其下级分类");
  }

  const nextLevel = (
    parent ? parent.level + 1 : 1
  ) as CostAnalysisCategoryLevel;
  if (nextLevel + categoryDepth(node) - 1 > 3) {
    throw new Error("成本分类最多支持三级");
  }

  if (node.parentId !== (parent?.id ?? null)) {
    const currentSiblings = findSiblings(currentCategoryTree(), node.id);
    const currentIndex =
      currentSiblings?.findIndex((item) => item.id === node.id) ?? -1;
    if (currentSiblings && currentIndex >= 0) {
      currentSiblings.splice(currentIndex, 1);
    }
    const nextSiblings = parent
      ? (parent.children ??= [])
      : currentCategoryTree();
    node.sortNo = nextSiblings.length + 1;
    nextSiblings.push(node);
  }

  node.name = name;
  node.version += 1;
  updateNodeHierarchy(node, parent, nextLevel);
  persistCategoryTree();
  return cloneCategory(node);
}

export function deleteLocalCostCategory(id: string): void {
  const node = findCategory(id);
  if (!node) {
    throw new Error("成本分类不存在");
  }
  if (node.children?.length) {
    throw new Error("存在下级分类，不能删除");
  }
  const siblings = findSiblings(currentCategoryTree(), id);
  const index = siblings?.findIndex((item) => item.id === id) ?? -1;
  if (!siblings || index < 0) {
    throw new Error("成本分类不存在");
  }
  siblings.splice(index, 1);
  siblings.forEach((sibling, siblingIndex) => {
    sibling.sortNo = siblingIndex + 1;
  });
  persistCategoryTree();
}

export function resetLocalCostCategoryRepository(): void {
  categoryTree = createInitialCategoryTree();
  localIdCounter = 0;
  try {
    localStorage.removeItem(LOCAL_COST_CATEGORY_STORAGE_KEY);
  } catch {
    // 测试或隐私模式下无法访问存储时无需额外处理。
  }
}
