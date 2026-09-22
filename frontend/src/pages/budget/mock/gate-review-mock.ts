import type {
  GateReviewBudgetItem,
  GateReviewWbsItem,
  InitiationGradeTreeNode,
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

const patternNames = ["人工工时费用", "发动机费用", "模具费用"];
const cliqueName = "极致成本";

function rng(base: number): number {
  return Math.round((base + Math.random() * base * 0.2) * 100) / 100;
}

function makeBudgetItem(
  name: string,
  budget: number,
  type: number,
  valveType?: number,
): GateReviewBudgetItem {
  return { name, budget, remark: `${name}说明`, type, valveType };
}

const submitters = ["张三", "李四", "王五", "赵六", "陈七"];
const sorNames = [
  "SOR-2026-001",
  "SOR-2026-002",
  "SOR-2026-010",
  "SOR-2026-015",
  "SOR-2026-020",
];
const creators = ["张三", "李四", "王五"];
const updaters = ["赵六", "陈七", "孙八"];

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function makeWbsItem(
  id: number,
  level: number,
  gradeId: number,
  gradeName: string,
  gradeIdx: number,
): GateReviewWbsItem {
  const base = Math.round((50000 + Math.random() * 150000) * 100) / 100;
  const patternBudgets = patternNames.map(() => rng(base * 0.2));

  const valveBudgetInfoVoList: GateReviewBudgetItem[] = [
    ...patternNames.map((n, i) => makeBudgetItem(n, patternBudgets[i], 0)),
    makeBudgetItem(
      "预算总金额",
      patternBudgets.reduce((a, b) => a + b, 0),
      1,
    ),
    makeBudgetItem("阀点已占用", rng(base * 0.3), 2, 0),
    makeBudgetItem(`${cliqueName}阀点释放`, rng(base * 0.4), 2, 1),
    makeBudgetItem(`${cliqueName}阀点释放评估`, rng(base * 0.35), 2, 2),
  ];

  const submitter = submitters[id % submitters.length];
  const sorName = sorNames[gradeIdx % sorNames.length];
  const createBy = creators[id % creators.length];
  const updateBy = updaters[id % updaters.length];

  const createDate = new Date(2026, 4, 1 + (id % 30));
  const updateDate = new Date(2026, 5, 1 + (id % 25));

  return {
    id,
    wbsNumber: `WBS-${String(id).padStart(4, "0")}`,
    wbsName: `${gradeName}开发任务-${id}`,
    gradeName,
    level,
    projectName: "L426 车型项目",
    submitter,
    sorName,
    paymentRatio: "30,40,30",
    paymentEstimate: rng(base * 0.3),
    reductionDiff: rng(base * 0.05),
    reductionRatio: Math.round(Math.random() * 100) / 100,
    version: id % 3 === 0 ? 2 : 1,
    createBy,
    createTime: formatDate(createDate),
    updateBy,
    updateTime: formatDate(updateDate),
    gradeId,
    valveBudgetInfoVoList,
  };
}

const allWbsItems: GateReviewWbsItem[] = [];
for (let id = 1; id <= 25; id++) {
  const gradeIdx = id % mockGradeTree[0].children!.length;
  const grade = mockGradeTree[0].children![gradeIdx];
  allWbsItems.push(
    makeWbsItem(id, (id % 6) + 1, grade.id!, grade.name, gradeIdx),
  );
}

export function getMockGateGradeTree(): Promise<InitiationGradeTreeNode[]> {
  return Promise.resolve(JSON.parse(JSON.stringify(mockGradeTree)));
}

export function getMockGateWbsItems(query?: {
  pageNum?: number;
  pageSize?: number;
  isLatestVersion?: number | null;
}): Promise<{ rows: GateReviewWbsItem[]; total: number }> {
  const allItems = JSON.parse(JSON.stringify(allWbsItems));
  let rows = allItems;
  if (query?.isLatestVersion === 0) {
    rows = rows.slice(0, 8);
  }
  const total = rows.length;
  if (query?.pageNum && query?.pageSize) {
    const start = (query.pageNum - 1) * query.pageSize;
    return Promise.resolve({
      rows: rows.slice(start, start + query.pageSize),
      total,
    });
  }
  return Promise.resolve({ rows, total });
}
