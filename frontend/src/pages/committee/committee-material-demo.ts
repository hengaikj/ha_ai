import type { CommitteeMeeting } from "@/types/committee";
import type { ReviewMatrixDisplayGroup, TimelinePoint } from "./committee-material-types";
import commitIconCheck from "@/assets/commit/group-19618.png";
import commitIconDocumentBlue from "@/assets/commit/group-19601.png";
import commitIconDownloadGreen from "@/assets/commit/group-19613.png";
import commitIconGridGreen from "@/assets/commit/group-19605.png";
import commitIconLayers from "@/assets/commit/group-19600.png";
import commitIconPieBlue from "@/assets/commit/group-19606.png";
import commitIconPieGreen from "@/assets/commit/group-19608.png";
import commitIconRobot from "@/assets/commit/group-19607.png";
import commitIconWalletBlue from "@/assets/commit/group-19612.png";

export const fallbackTimelineMonths = Array.from({ length: 36 }, (_, index) => {
  const date = new Date(2026, 5 + index, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
});
export const timelinePlanBase: TimelinePoint[] = [
  { gate: "G9", date: "2026/06/10", offset: 3.6 },
  { gate: "G8", date: "2026/06/10", offset: 11.2 },
  { gate: "G7", date: "2026/06/10", offset: 23.5 },
  { gate: "G6", date: "2026/06/10", offset: 30.3 },
  { gate: "G5", date: "2026/06/10", offset: 37.2 },
  { gate: "G4", date: "2026/06/10", offset: 44.8 },
  { gate: "G3", date: "2026/06/10", offset: 59.3 },
  { gate: "G2", date: "2026/06/10", offset: 68.5 },
  { gate: "G1", date: "2026/06/10", offset: 91 },
];
export const timelineActualBase: TimelinePoint[] = [
  { gate: "G9", date: "2026/06/10", offset: 3.6 },
  { gate: "G8", date: "2026/06/10", offset: 11.2 },
  { gate: "G7", date: "2026/06/10", offset: 23.5 },
  { gate: "G6", date: "2026/06/10", offset: 30.3 },
  { gate: "G5", date: "2026/06/10", offset: 37.2 },
  { gate: "G4", date: "2026/06/10", offset: 44.8 },
  { gate: "G3", date: "2026/06/10", offset: 59.3 },
  { gate: "G2", date: "2026/06/10", offset: 68.5 },
  { gate: "G1", date: "2026/06/10", offset: 91 },
];

export const fallbackDeliverableItems = [
  { label: "产品型谱方案", icon: commitIconPieBlue },
  { label: "平台与动力总成", icon: commitIconRobot },
  { label: "成本测算及收益测算", icon: commitIconWalletBlue },
  { label: "产品质量方案", icon: commitIconDocumentBlue },
  { label: "产品研发方案", icon: commitIconLayers },
  { label: "产品定义方案", icon: commitIconDocumentBlue },
  { label: "产品配置方案", icon: commitIconGridGreen },
  { label: "产品收益测算", icon: commitIconPieGreen },
  { label: "专项风险关闭清单", icon: commitIconCheck },
  { label: "产品投放方案", icon: commitIconDownloadGreen },
];

export const fallbackReviewMatrixGroups: ReviewMatrixDisplayGroup[] = [
  {
    title: "品牌公司职能部室",
    count: "8 个参评部室",
    departments: [
      { key: "tech", label: "技术/费用" },
      { key: "cost", label: "成本" },
      { key: "profit", label: "收益" },
      { key: "quality", label: "质量" },
      { key: "strategy", label: "战略" },
      { key: "marketing", label: "营销" },
      { key: "manufacture", label: "制造" },
      { key: "finance", label: "财务" },
    ],
    rows: [
      {
        dimension: "结论建议",
        tech: "green",
        cost: "yellow",
        profit: "green",
        quality: "green",
        strategy: "yellow",
        marketing: "green",
        manufacture: "green",
        finance: "green",
      },
    ],
  },
  {
    title: "集团部室及管委会办公室",
    count: "7 个参评部室",
    departments: [
      { key: "groupTech", label: "集团技术" },
      { key: "groupCost", label: "集团成本" },
      { key: "groupProfit", label: "集团收益" },
      { key: "groupQuality", label: "集团质量" },
      { key: "groupStrategy", label: "集团战略" },
      { key: "groupMarketing", label: "集团营销" },
      { key: "groupFinance", label: "集团财务" },
    ],
    rows: [
      {
        dimension: "技术/费用",
        groupTech: "green",
        groupCost: "yellow",
        groupProfit: "yellow",
        groupQuality: "green",
        groupStrategy: "yellow",
        groupMarketing: "green",
        groupFinance: "green",
      },
      {
        dimension: "收益",
        groupTech: "empty",
        groupCost: "empty",
        groupProfit: "green",
        groupQuality: "green",
        groupStrategy: "yellow",
        groupMarketing: "yellow",
        groupFinance: "yellow",
      },
      {
        dimension: "量价",
        groupTech: "empty",
        groupCost: "empty",
        groupProfit: "yellow",
        groupQuality: "green",
        groupStrategy: "green",
        groupMarketing: "yellow",
        groupFinance: "yellow",
      },
      {
        dimension: "竞争力",
        groupTech: "green",
        groupCost: "empty",
        groupProfit: "green",
        groupQuality: "green",
        groupStrategy: "yellow",
        groupMarketing: "yellow",
        groupFinance: "green",
      },
      {
        dimension: "质量",
        groupTech: "green",
        groupCost: "red",
        groupProfit: "green",
        groupQuality: "empty",
        groupStrategy: "yellow",
        groupMarketing: "empty",
        groupFinance: "green",
      },
      {
        dimension: "结论建议",
        groupTech: "green",
        groupCost: "yellow",
        groupProfit: "green",
        groupQuality: "green",
        groupStrategy: "yellow",
        groupMarketing: "green",
        groupFinance: "green",
      },
    ],
  },
];

export const fallbackQualityOpinionRows = [
  {
    index: 1,
    problem: "关键零部件质量风险需要结合量产爬坡节奏，细化闭环验证计划。",
    measure: "补充风险清单和验证计划，形成问题关闭责任人与验收要求。",
    owner: "质量部",
    date: "2026-07-20",
  },
  {
    index: 2,
    problem: "供应商质量稳定性对交付节奏存在一定影响。",
    measure: "组织供应商专项审批，纳入月度跟踪。",
    owner: "采购部 / 质量部",
    date: "2026-07-30",
  },
];

export function demoGroupMaterial(): CommitteeMeeting {
  return {
    id: "demo-group-material-meeting",
    meetingName: "BE22 平台纯电",
    meetingLevel: "GROUP",
    meetingType: "PRODUCT_COMMITTEE",
    projectId: "demo-project-be22",
    projectName: "BE22 平台纯电",
    gateId: "demo-gate-g9",
    gateName: "G9",
    attemptNo: 1,
    meetingTime: "2026-06-06 09:00",
    reviewDeadlineTime: "2026-06-06 09:00",
    meetingLocation: "集团技术中心 8 层第一会议室",
    meetingStatus: "CUTOFF_LOCKED",
    lockVersion: 0,
    materialLockVersion: 0,
    material: {
      coverTitle: "BE22 平台纯电 SUV 项目",
      reportDepartment: "集团技术与产品管理部",
      executiveSummary:
        "围绕型谱、阀点、交付物、质量、成本、收益与决议事项进行统一汇报。项目整体完成度 86%，当前阀点为 G9，已具备集团产品委员会集中评审条件。",
      previousGateRequirements: JSON.stringify({
        visible: true,
        rows: [
          {
            id: "previous-gate-requirement-1",
            requirement:
              "第二轮降本专项方案补充完整，形成量产成本锁定与收益测算闭环。",
            completion: "专项降本路径已完成评审并纳入本轮材料。",
          },
          {
            id: "previous-gate-requirement-2",
            requirement:
              "确认二级会后新增风险项关闭计划，并同步进入集团会审阅。",
            completion: "各责任部门反馈完成，当前风险均已形成处置要求。",
          },
        ],
      }),
      deliveryReview:
        "质量、成本、收益相关参评部门已形成正式评审意见。关键风险集中在量产爬坡、零部件成本锁定和收益达成路径，需要会议形成统一判断。",
      costPoints: JSON.stringify([
        "成本目标及当前实际（加权）存在 16 元级差距，当前需持续推进专项降本。",
        "通过平台化复用、采购价格重谈及配置优化，SOP 节点预计可回归目标线。",
        "集团技术与产品管理部建议将降本专项列入会后督办清单并按月复盘。",
      ]),
      revenuePoints: JSON.stringify([
        "立项目标收益维持高端系列项目要求，当前仍具备中长期兑现基础。",
        "当前实际收益受成本爬坡与量产准备影响承压，短期边贡较目标回落。",
        "建议将收益测算版本与财务、营销口径再次对齐后，作为下一轮会议的正式基线。",
      ]),
      qualityIssues: JSON.stringify([
        {
          id: "quality-issue-1",
          issue: "量产爬坡质量风险仍需跟踪。",
          action: "形成专项关闭计划并按周更新。",
          ownerDepartment: "质量管理部",
          dueDate: "2026-06-30",
        },
      ]),
      reviewBlocks: JSON.stringify([
        { id: "review-quality", kind: "quality", title: "质量板块" },
        { id: "review-cost", kind: "cost", title: "成本板块" },
        { id: "review-revenue", kind: "revenue", title: "收益板块" },
      ]),
      revenueForecastGroups: JSON.stringify([
        {
          id: "revenue-forecast-target-cost",
          label: "目标成本",
          margin: "78",
          profit: "14",
          metrics: {
            "metric-0": "19.88 元",
            "metric-1": "17.88 元",
            "metric-2": "12.00 元",
            "metric-3": "0.10 元",
            "metric-4": "1.00 元",
          },
        },
        {
          id: "revenue-forecast-current-actual",
          label: "当前实际",
          margin: "66",
          profit: "12",
          metrics: {
            "metric-0": "21.88 元",
            "metric-1": "19.88 元",
            "metric-2": "13.00 元",
            "metric-3": "0.10 元",
            "metric-4": "1.00 元",
          },
        },
        {
          id: "revenue-forecast-sop-forecast",
          label: "SOP预算",
          margin: "78",
          profit: "14",
          metrics: {
            "metric-0": "21.88 元",
            "metric-1": "19.88 元",
            "metric-2": "12.50 元",
            "metric-3": "0.10 元",
            "metric-4": "1.00 元",
          },
        },
        {
          id: "revenue-forecast-sop6-forecast",
          label: "SOP+6Y预算",
          margin: "0",
          profit: "0",
          metrics: {
            "metric-0": "0",
            "metric-1": "0",
            "metric-2": "0",
            "metric-3": "0",
            "metric-4": "0",
          },
        },
      ]),
      costForecastNodes: JSON.stringify([
        { id: "cost-forecast-1", label: "目标成本", value: "72" },
        { id: "cost-forecast-2", label: "当前实际", value: "88" },
        { id: "cost-forecast-3", label: "SOP 预计", value: "72" },
        { id: "cost-forecast-4", label: "SOP+6预计", value: "54" },
      ]),
      decisionText:
        "提请集团产品委员会确认项目是否具备进入下一阶段的决策条件，并明确后续重点督办事项、责任部门和完成时限。",
      aiQualitySuggestion:
        "建议突出当前质量风险清单、关闭率、未关闭项责任部门及预计关闭时间。",
      aiCostSuggestion:
        "建议补充车型投资、零部件目标成本、降本举措及成本偏差说明。",
      aiRevenueSuggestion:
        "建议补充销量、价格、毛利和收益敏感性测算，形成决策支撑。",
    },
  };
}
