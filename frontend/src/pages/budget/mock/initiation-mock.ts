import type {
  InitiationCompareProject,
  InitiationGradeTreeNode,
  InitiationPatternItem,
  InitiationWbsItem,
} from "@/types/budget";

export const mockGradeTree: InitiationGradeTreeNode[] = [
  {
    id: 1,
    name: "整车项目",
    children: [
      { id: 11, name: "产品规划" },
      { id: 12, name: "研究开发" },
      { id: 13, name: "采购" },
      { id: 14, name: "制造" },
      { id: 15, name: "质量" },
    ],
  },
  {
    id: 2,
    name: "动力系统",
    children: [
      { id: 21, name: "发动机" },
      { id: 22, name: "变速箱" },
      { id: 23, name: "电驱动" },
    ],
  },
];

export const mockPatterns: InitiationPatternItem[] = [
  { id: 101, patternName: "人工工时费用" },
  { id: 102, patternName: "发动机费用" },
  { id: 103, patternName: "模具费用" },
];

function rng(base: number): number {
  return Math.round((base + Math.random() * base * 0.2) * 100) / 100;
}

function makeWbsItem(
  id: number,
  level: number,
  gradeId: number,
  gradeName: string,
): InitiationWbsItem {
  const base = Math.round(Math.random() * 100000 * 100) / 100;
  return {
    id,
    wbsNumber: `WBS-${String(id).padStart(4, "0")}`,
    wbsName: `${gradeName}开发任务-${id}`,
    grade: { gradeName, level, realLevel: level + 1 },
    gradeId,
    totalBudgetAmount: rng(base),
    submitter: "张三",
    sorName: "SOR-2026-00" + String(id).padStart(2, "0"),
    assessTotalAmount: rng(base * 0.9),
    paymentRatio: "30,40,30",
    paymentEstimate: rng(base * 0.85),
    reductionDiff: rng(base * 0.05),
    reductionRatio: Math.round(Math.random() * 10) / 10,
    paymentAmount: rng(base * 0.3),
    amortizationAmount: rng(base * 0.1),
    totalAmount: rng(base * 0.4),
    remark: "备注信息-" + id,
    totalOverspend: Math.random() > 0.7 ? rng(base * 0.02) : 0,
    paymentOverspend: Math.random() > 0.8 ? rng(base * 0.01) : 0,
    version: 1,
    createBy: "张三",
    createTime: "2026-06-01 10:00:00",
    updateBy: "李四",
    updateTime: "2026-06-15 14:30:00",
    initiationBudget: mockPatterns.map((p) => ({
      patternId: p.id,
      budget: rng(base * 0.3),
      remark: `${p.patternName}说明-${id}`,
      assessBudget: rng(base * 0.28),
      assessRemark: `${p.patternName}评估说明-${id}`,
      paymentBudget: rng(base * 0.25),
    })),
  };
}

const allWbsItems: InitiationWbsItem[] = [];
for (let id = 1; id <= 25; id++) {
  const gradeIdx = id % mockGradeTree[0].children!.length;
  const grade = mockGradeTree[0].children![gradeIdx];
  allWbsItems.push(makeWbsItem(id, (id % 6) + 1, grade.id!, grade.name));
}

export function getMockTreeData(): Promise<InitiationGradeTreeNode[]> {
  return Promise.resolve(JSON.parse(JSON.stringify(mockGradeTree)));
}

export function getMockPatterns(): Promise<InitiationPatternItem[]> {
  return Promise.resolve([...mockPatterns]);
}

export function getMockWbsItems(): Promise<{
  rows: InitiationWbsItem[];
  total: number;
}> {
  const rows = JSON.parse(JSON.stringify(allWbsItems));
  return Promise.resolve({ rows, total: rows.length });
}

export const mockCompareProjects: InitiationCompareProject[] = [
  {
    id: 1,
    label: "A项目-新车型",
    children: [
      { id: "1-101", label: "人工工时费用", pid: 1 },
      { id: "1-102", label: "发动机费用", pid: 1 },
    ],
  },
  {
    id: 2,
    label: "B项目-改款",
    children: [
      { id: "2-101", label: "人工工时费用", pid: 2 },
      { id: "2-103", label: "模具费用", pid: 2 },
    ],
  },
];

export function getMockCompareList(): Promise<InitiationCompareProject[]> {
  return Promise.resolve(JSON.parse(JSON.stringify(mockCompareProjects)));
}
