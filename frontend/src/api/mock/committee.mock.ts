import type { AxiosResponse } from "axios";
import type {
  CommitteeAiSuggestions,
  CommitteeAttachment,
  CommitteeConclusion,
  CommitteeConfigDepartment,
  CommitteeDashboard,
  CommitteeGate,
  CommitteeGateAssignment,
  CommitteeGateAssignmentReviewer,
  CommitteeGateAssignmentSet,
  CommitteeGateMeetingHistory,
  CommitteeGateTemplate,
  CommitteeGateUpsertCommand,
  CommitteeId,
  CommitteeMaterialCategory,
  CommitteeMaterialTemplateItem,
  CommitteeMeeting,
  CommitteeMeetingCreateCommand,
  CommitteeMeetingLevel,
  CommitteeMeetingUpdateCommand,
  CommitteeOpinionSummary,
  CommitteePage,
  CommitteeProject,
  CommitteeProjectCandidate,
  CommitteeProjectDetail,
  CommitteeProjectInitPayload,
  CommitteeProjectProfileUpdateCommand,
  CommitteeRectification,
  CommitteeReplyMessage,
  CommitteeReplyTopic,
  CommitteeReviewContent,
  CommitteeReviewNotice,
  CommitteeReviewRecord,
  CommitteeReviewSummary,
  CommitteeReviewTask,
  CommitteeSubtotalWeightedData,
  CommitteeUserOption,
} from "@/types/committee";
import type {
  BusinessProjectValveItem,
  BusinessValveDetailItem,
  BusinessValveItem,
} from "@/types/project";
import type {
  PlatformDeptItem,
  PlatformDictItemDetail,
  PlatformPageResponse,
} from "@/types/platform-system";

type PageParams = Record<string, unknown>;

const projectProfiles = [
  {
    id: "1001",
    code: "BE22",
    name: "BE22 平台纯电 SUV 项目",
    company: "北汽新能源公司",
    brand: "北汽新能源",
    category: "全新平台",
    base: "北京基地",
    investment: 368000,
    vehicleInvestment: 214000,
    rate: 82,
    background: "面向中高端纯电 SUV 市场，承接智能化平台与热管理能力升级。",
    gate: { id: "gate-1001-g9", code: "G9", name: "G9", valveId: "9" },
    status: "IN_PROGRESS",
    planned: "2026-07-30",
  },
  {
    id: "1002",
    code: "X7-EXPORT",
    name: "X7 出口版产品规划项目",
    company: "北汽乘用车公司",
    brand: "北京汽车",
    category: "出口版",
    base: "株洲基地",
    investment: 156000,
    vehicleInvestment: 82000,
    rate: 64,
    background: "围绕海外法规、右舵车型与供应链本地化开展阶段审议。",
    gate: { id: "gate-1002-g7", code: "G7", name: "G7", valveId: "7" },
    status: "PENDING_APPROVAL",
    planned: "2026-08-12",
  },
  {
    id: "1003",
    code: "A15-COST",
    name: "A15 改款技术降本项目",
    company: "北汽新能源公司",
    brand: "北汽新能源",
    category: "改款降本",
    base: "青岛基地",
    investment: 86000,
    vehicleInvestment: 42000,
    rate: 91,
    background: "以配置优化、供应商协同和平台共用件替代为核心收益路径。",
    gate: { id: "gate-1003-g7", code: "G7", name: "G7", valveId: "7" },
    status: "PASSED",
    planned: "2026-06-26",
  },
  {
    id: "1004",
    code: "S22-IOT",
    name: "S22 智能网联升级项目",
    company: "北汽集团",
    brand: "北京汽车",
    category: "智能化升级",
    base: "北京基地",
    investment: 124000,
    vehicleInvestment: 61000,
    rate: 76,
    background: "聚焦座舱域控、OTA 平台和数据闭环能力的集团级审议。",
    gate: { id: "gate-1004-g6", code: "G6", name: "G6", valveId: "6" },
    status: "IN_PROGRESS",
    planned: "2026-09-05",
  },
  {
    id: "1005",
    code: "Q25-COCKPIT",
    name: "Q25 智能座舱域控整合项目",
    company: "北汽集团",
    brand: "北京汽车",
    category: "电子电器整合",
    base: "黄骅基地",
    investment: 98000,
    vehicleInvestment: 53000,
    rate: 58,
    background: "围绕座舱域控平台整合、软件复用和物料降本形成审议闭环。",
    gate: { id: "gate-1005-g8", code: "G8", name: "G8", valveId: "8" },
    status: "IN_PROGRESS",
    planned: "2026-08-28",
  },
] as const;

const valves: BusinessValveItem[] = [
  {
    valveId: 5,
    valveCode: "G5",
    valveName: "G5",
    sortNo: 5,
    status: "ENABLED",
    remark: "方案冻结",
    version: 1,
  },
  {
    valveId: 6,
    valveCode: "G6",
    valveName: "G6",
    sortNo: 6,
    status: "ENABLED",
    remark: "工程验证",
    version: 1,
  },
  {
    valveId: 7,
    valveCode: "G7",
    valveName: "G7",
    sortNo: 7,
    status: "ENABLED",
    remark: "样车验证",
    version: 1,
  },
  {
    valveId: 8,
    valveCode: "G8",
    valveName: "G8",
    sortNo: 8,
    status: "ENABLED",
    remark: "量产准备",
    version: 1,
  },
  {
    valveId: 9,
    valveCode: "G9",
    valveName: "G9",
    sortNo: 9,
    status: "ENABLED",
    remark: "上市决策",
    version: 1,
  },
];

let sequence = 9000;
function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function paginate<T>(records: T[], params?: PageParams): CommitteePage<T> {
  const pageNo = Number(params?.pageNo ?? params?.pageNum ?? 1) || 1;
  const pageSize = Number(params?.pageSize ?? 10) || 10;
  const start = (pageNo - 1) * pageSize;
  return {
    rows: clone(records.slice(start, start + pageSize)),
    total: records.length,
  };
}

function contains(value: unknown, keyword: unknown) {
  const input = String(keyword ?? "").trim();
  if (!input) return true;
  return String(value ?? "").includes(input);
}

const departments: CommitteeConfigDepartment[] = [
  {
    departmentId: "101",
    departmentName: "研发部",
    applicableStage: "SECOND",
    requiredByDefault: "1",
    visibleDeptIds: ["101", "102", "103", "104"],
    sortNo: 1,
    enableFlag: "1",
  },
  {
    departmentId: "102",
    departmentName: "财经部",
    applicableStage: "SECOND",
    requiredByDefault: "1",
    visibleDeptIds: ["101", "102", "103", "104"],
    sortNo: 2,
    enableFlag: "1",
  },
  {
    departmentId: "103",
    departmentName: "营销部",
    applicableStage: "SECOND",
    requiredByDefault: "1",
    visibleDeptIds: ["101", "102", "103", "104"],
    sortNo: 3,
    enableFlag: "1",
  },
  {
    departmentId: "104",
    departmentName: "质量部",
    applicableStage: "SECOND",
    requiredByDefault: "0",
    visibleDeptIds: ["101", "102", "103", "104"],
    sortNo: 4,
    enableFlag: "1",
  },
  {
    departmentId: "201",
    departmentName: "集团战略与投资管理部",
    applicableStage: "GROUP",
    requiredByDefault: "1",
    visibleDeptIds: ["201", "202", "203", "204", "205", "206", "207"],
    sortNo: 1,
    enableFlag: "1",
  },
  {
    departmentId: "202",
    departmentName: "集团财务部",
    applicableStage: "GROUP",
    requiredByDefault: "1",
    visibleDeptIds: ["201", "202", "203", "204", "205", "206", "207"],
    sortNo: 2,
    enableFlag: "1",
  },
  {
    departmentId: "203",
    departmentName: "集团商规办",
    applicableStage: "GROUP",
    requiredByDefault: "1",
    visibleDeptIds: ["201", "202", "203", "204", "205", "206", "207"],
    sortNo: 3,
    enableFlag: "1",
  },
  {
    departmentId: "204",
    departmentName: "集团经致办",
    applicableStage: "GROUP",
    requiredByDefault: "1",
    visibleDeptIds: ["201", "202", "203", "204", "205", "206", "207"],
    sortNo: 4,
    enableFlag: "1",
  },
  {
    departmentId: "205",
    departmentName: "集团质量办",
    applicableStage: "GROUP",
    requiredByDefault: "1",
    visibleDeptIds: ["201", "202", "203", "204", "205", "206", "207"],
    sortNo: 5,
    enableFlag: "1",
  },
  {
    departmentId: "206",
    departmentName: "集团营销办",
    applicableStage: "GROUP",
    requiredByDefault: "1",
    visibleDeptIds: ["201", "202", "203", "204", "205", "206", "207"],
    sortNo: 6,
    enableFlag: "1",
  },
  {
    departmentId: "207",
    departmentName: "集团国际办",
    applicableStage: "GROUP",
    requiredByDefault: "1",
    visibleDeptIds: ["201", "202", "203", "204", "205", "206", "207"],
    sortNo: 7,
    enableFlag: "1",
  },
];

const userOptions: CommitteeUserOption[] = [
  { userId: "u10101", displayName: "赵研发总", departmentId: "101" },
  { userId: "u10102", displayName: "孙平台", departmentId: "101" },
  { userId: "u10201", displayName: "吴财经总", departmentId: "102" },
  { userId: "u10202", displayName: "钱收益", departmentId: "102" },
  { userId: "u10301", displayName: "田营销总", departmentId: "103" },
  { userId: "u10401", displayName: "周质量", departmentId: "104" },
  { userId: "u20101", displayName: "张国强", departmentId: "201" },
  { userId: "u20201", displayName: "冯财务", departmentId: "202" },
  { userId: "u20301", displayName: "宋商规", departmentId: "203" },
  { userId: "u20401", displayName: "李经致", departmentId: "204" },
  { userId: "u20501", displayName: "周质量", departmentId: "205" },
  { userId: "u20601", displayName: "田营销", departmentId: "206" },
  { userId: "u20701", displayName: "何国际", departmentId: "207" },
];

const materialCategories: CommitteeMaterialCategory[] = [
  {
    id: "cat-1",
    categoryCode: "SECOND_REVIEW",
    categoryName: "二级会材料",
    categoryDesc: "二级公司产品委员会审议材料。",
    sortNo: 1,
    enableFlag: "1",
  },
  {
    id: "cat-2",
    categoryCode: "GROUP_REVIEW",
    categoryName: "集团会材料",
    categoryDesc: "集团产品委员会固定汇报材料。",
    sortNo: 2,
    enableFlag: "1",
  },
  {
    id: "cat-3",
    categoryCode: "SUPPORTING",
    categoryName: "支撑附件",
    categoryDesc: "型谱、收益测算、风险清单等支撑文件。",
    sortNo: 3,
    enableFlag: "1",
  },
];

const materialTemplates: CommitteeMaterialTemplateItem[] = [
  {
    id: "mat-1",
    categoryId: "cat-1",
    materialName: "项目立项汇报稿",
    materialRequirement: "说明项目边界、投资收益和关键风险。",
    fileType: "PDF",
    fileName: "项目立项汇报稿.pdf",
    fileSize: 1024 * 620,
    attachmentId: "att-template-1",
    sortNo: 1,
    enableFlag: "1",
  },
  {
    id: "mat-2",
    categoryId: "cat-1",
    materialName: "部门评审意见汇总",
    materialRequirement: "汇总研发、财经、营销、质量等评审意见。",
    fileType: "PDF",
    fileName: "部门评审意见汇总.pdf",
    fileSize: 1024 * 430,
    attachmentId: "att-template-2",
    sortNo: 2,
    enableFlag: "1",
  },
  {
    id: "mat-3",
    categoryId: "cat-2",
    materialName: "集团产品委员会汇报稿",
    materialRequirement: "按集团固定版式输出决策事项。",
    fileType: "PDF",
    fileName: "集团产品委员会汇报稿.pdf",
    fileSize: 1024 * 760,
    attachmentId: "att-template-3",
    sortNo: 1,
    enableFlag: "1",
  },
  {
    id: "mat-4",
    categoryId: "cat-3",
    materialName: "专项风险关闭清单",
    materialRequirement: "说明风险关闭计划、责任部门和截止时间。",
    fileType: "PDF",
    fileName: "专项风险关闭清单.pdf",
    fileSize: 1024 * 380,
    attachmentId: "att-template-4",
    sortNo: 1,
    enableFlag: "1",
  },
];

function buildGate(profile: (typeof projectProfiles)[number]): CommitteeGate {
  return {
    id: profile.gate.id,
    projectId: profile.id,
    projectValveId: `pv-${profile.id}-${profile.gate.valveId}`,
    valveId: profile.gate.valveId,
    projectName: profile.name,
    gateCode: profile.gate.code,
    gateName: profile.gate.name,
    sequenceNo: Number(profile.gate.valveId),
    plannedFinishDate: profile.planned,
    actualFinishDate: profile.status === "PASSED" ? "2026-06-28" : null,
    gatePurpose: `确认${profile.name}是否具备通过${profile.gate.name}阀点的条件。`,
    coreWorkContent: "型谱方案、成本收益测算、质量风险和会后整改闭环。",
    gateStatus: profile.status,
    isCurrent: "1",
    previousGateId: null,
    finalConclusion: profile.status === "PASSED" ? "PASS" : null,
    finalConclusionTime:
      profile.status === "PASSED" ? "2026-06-28 16:30:00" : null,
    lockVersion: 1,
  };
}

function buildProjectDetail(
  profile: (typeof projectProfiles)[number],
): CommitteeProjectDetail {
  const currentGate = buildGate(profile);
  const assignments = departments.map<CommitteeGateAssignment>(
    (department) => ({
      id: `assign-${profile.id}-${department.departmentId}`,
      gateId: currentGate.id,
      departmentId: department.departmentId,
      departmentName: department.departmentName ?? "",
      departmentGroup:
        department.applicableStage === "GROUP" ? "GROUP" : "SECOND_COMPANY",
      headUserName:
        userOptions.find(
          (user) => user.departmentId === department.departmentId,
        )?.displayName ?? "负责人",
      requiredFlag: department.requiredByDefault,
      sortNo: department.sortNo,
    }),
  );
  return {
    project: {
      id: profile.id,
      projectId: profile.id,
      projectCode: profile.code,
      projectName: profile.name,
      owningCompany: profile.company,
      brand: profile.brand,
      projectCategory: profile.category,
      productionBase: profile.base,
      totalInvestment: profile.investment,
      vehicleModelInvestment: profile.vehicleInvestment,
      executionRate: profile.rate,
      projectBackground: profile.background,
      currentGateId: currentGate.id,
      committeeStatus: profile.status,
    },
    currentGate,
    materials: materialTemplates.slice(0, 3).map((template, index) => ({
      id: `gate-mat-${profile.id}-${index + 1}`,
      gateId: currentGate.id,
      materialName: template.materialName ?? "",
      materialRequirement: template.materialRequirement ?? null,
      materialType: template.fileType ?? "PDF",
      sourceTemplateId: template.id ?? null,
      sortNo: index + 1,
    })),
    assignments,
    reviewers: assignments.map<CommitteeGateAssignmentReviewer>(
      (assignment, index) => ({
        id: `reviewer-${assignment.id}`,
        assignmentId: assignment.id,
        gateId: currentGate.id,
        departmentId: assignment.departmentId,
        reviewerUserName:
          userOptions.find(
            (user) => user.departmentId === assignment.departmentId,
          )?.displayName ?? `评审人${index + 1}`,
        sortNo: index + 1,
      }),
    ),
    gateHistory: [
      {
        ...currentGate,
        id: `${currentGate.id}-prev`,
        gateCode: "G8",
        gateName: "G8",
        sequenceNo: 8,
        isCurrent: "0",
        finalConclusion: "PASS",
        finalConclusionTime: "2026-05-20 15:30:00",
        materials: materialTemplates.slice(0, 2).map((template, index) => ({
          id: `gate-mat-${profile.id}-prev-${index + 1}`,
          gateId: `${currentGate.id}-prev`,
          materialName: template.materialName ?? "",
          materialRequirement: template.materialRequirement ?? null,
          materialType: template.fileType ?? "PDF",
          sourceTemplateId: template.id ?? null,
          sortNo: index + 1,
        })),
      },
      currentGate,
    ],
  };
}

const projectDetails = new Map<string, CommitteeProjectDetail>(
  projectProfiles.map((profile) => [profile.id, buildProjectDetail(profile)]),
);

const reviewTasks: CommitteeReviewTask[] = projectProfiles.flatMap((profile) =>
  departments.map((department, index) => {
    const isGroupDepartment = department.applicableStage === "GROUP";
    const status = isGroupDepartment
      ? "APPROVED"
      : ["NOT_STARTED", "DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"][
          (Number(profile.id) + index) % 5
        ];
    const recordId = `record-${profile.id}-${department.departmentId}`;
    return {
      id: `task-${profile.id}-${department.departmentId}`,
      projectId: profile.id,
      projectName: profile.name,
      owningCompany: profile.company,
      companyName: profile.company,
      gateId: profile.gate.id,
      gateName: profile.gate.name,
      departmentId: department.departmentId,
      departmentName: department.departmentName ?? "",
      departmentGroup:
        department.applicableStage === "GROUP" ? "GROUP" : "SECOND_COMPANY",
      reviewerUserName:
        userOptions.find(
          (user) => user.departmentId === department.departmentId,
        )?.displayName ?? "评审人",
      headUserName:
        userOptions.find(
          (user) => user.departmentId === department.departmentId,
        )?.displayName ?? "负责人",
      reviewStage: department.applicableStage,
      taskStatus: status,
      draft: {
        contentText: `${department.departmentName}对${profile.name}${profile.gate.name}阶段的评审意见草稿。`,
        techSignal: index % 2 ? "GREEN" : "YELLOW",
        revenueSignal: "GREEN",
        volumePriceSignal: "YELLOW",
        competitivenessSignal: "GREEN",
        qualitySignal: index % 3 ? "GREEN" : "RED",
        conclusionSignal: status === "REJECTED" ? "YELLOW" : "GREEN",
      },
      currentRecordId: recordId,
      currentVersionNo: status === "NOT_STARTED" ? undefined : 1,
      lockVersion: 1,
      updateTime: "2026-07-18 15:30:00",
      records:
        status === "NOT_STARTED"
          ? []
          : [
              {
                id: recordId,
                versionNo: 1,
                recordStatus: status === "APPROVED" ? "APPROVED" : "DRAFT",
                content: {
                  contentText: `${department.departmentName}确认当前资料可支撑产品委员会审议，建议持续跟踪成本、质量和上市节奏风险。`,
                  techSignal: "GREEN",
                  revenueSignal: "GREEN",
                  volumePriceSignal: "YELLOW",
                  competitivenessSignal: "GREEN",
                  qualitySignal: "GREEN",
                  conclusionSignal: "GREEN",
                },
                submitterName:
                  userOptions.find(
                    (user) => user.departmentId === department.departmentId,
                  )?.displayName ?? "评审人",
                submitTime: "2026-07-18 15:30:00",
                approveTime: "2026-07-18 16:30:00",
                approvalAction:
                  status === "APPROVED"
                    ? "APPROVE"
                    : status === "REJECTED"
                      ? "REJECT"
                      : undefined,
                approverName:
                  userOptions.find(
                    (user) => user.departmentId === department.departmentId,
                  )?.displayName ?? "负责人",
                auditOpinion:
                  status === "APPROVED"
                    ? "保留当前正式版，作为后续会议审议基础。"
                    : "--",
                submitModeLabel: "人工提交",
                auditModeLabel: "人工审批",
                meetingName:
                  department.applicableStage === "GROUP"
                    ? "集团产品委员会第 1 次会议"
                    : "二级公司产品委员会第 1 次会议",
                meetingTime: "2026-07-12 09:00:00",
                meetingConclusionLabel:
                  department.applicableStage === "GROUP"
                    ? "通过"
                    : "带条件通过",
                meetingDecisionItems:
                  department.applicableStage === "GROUP"
                    ? "请会议审议是否同意项目进入下一阶段评审。"
                    : "请会议审议是否同意项目带条件进入集团会前评审。",
                meetingDetails: [
                  {
                    id: `meeting-detail-${recordId}`,
                    meetingTitle:
                      department.applicableStage === "GROUP"
                        ? "集团产品委员会第 1 次会议"
                        : "二级公司产品委员会第 1 次会议",
                    meetingName: `${profile.name} ${profile.gate.name} ${
                      department.applicableStage === "GROUP" ? "集团" : "二级"
                    }阀点评审会`,
                    meetingTime: "2026-07-12 09:00:00",
                    conclusionLabel:
                      department.applicableStage === "GROUP"
                        ? "通过"
                        : "带条件通过",
                    decisionItems:
                      department.applicableStage === "GROUP"
                        ? "请会议审议是否同意项目进入下一阶段评审。"
                        : "请会议审议是否同意项目带条件进入集团会前评审。",
                    attachments: [
                      {
                        id: `att-meeting-${recordId}`,
                        bizCode: "CONCLUSION",
                        bizId: `meeting-detail-${recordId}`,
                        fileName: "座舱域控切换影响分析.xlsx",
                        fileSize: 1024 * 240,
                        fileType:
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      },
                    ],
                  },
                ],
              },
            ],
    };
  }),
);

reviewTasks.unshift({
  id: "task-test-editable",
  projectId: "1001",
  projectName: "测试",
  gateId: "gate-1001-g9",
  gateName: "G9",
  departmentId: "dept-test-editable",
  departmentName: "测试部门",
  departmentGroup: "SECOND_COMPANY",
  reviewerUserName: "测试评审人",
  headUserName: "测试负责人",
  reviewStage: "GROUP_PRE",
  taskStatus: "DRAFT",
  draft: {
    contentText: "测试评审意见草稿，可用于验证阀点评审编辑状态。",
    techSignal: "GREEN",
    revenueSignal: "GREEN",
    volumePriceSignal: "YELLOW",
    competitivenessSignal: "GREEN",
    qualitySignal: "GREEN",
    conclusionSignal: "GREEN",
  },
  currentRecordId: "record-test-editable",
  currentVersionNo: 1,
  lockVersion: 1,
  updateTime: "2026-07-28 10:00:00",
  records: [
    {
      id: "record-test-editable-v0",
      versionNo: 0,
      recordStatus: "APPROVED",
      content: {
        contentText: "历史评审意见正文，仅在打开该版本时加载。",
        techSignal: "YELLOW",
        revenueSignal: "GREEN",
        volumePriceSignal: "YELLOW",
        competitivenessSignal: "GREEN",
        qualitySignal: "GREEN",
        conclusionSignal: "GREEN",
      },
      submitterName: "测试评审人",
      submitTime: "2026-07-27 10:00:00",
      approveTime: "2026-07-27 11:00:00",
      approvalAction: "APPROVE",
      approverName: "测试负责人",
      auditOpinion: "历史版本已审批。",
      submitModeLabel: "人工提交",
      auditModeLabel: "人工审批",
    },
    {
      id: "record-test-editable",
      versionNo: 1,
      recordStatus: "DRAFT",
      content: {
        contentText: "测试评审意见草稿，可用于验证阀点评审编辑状态。",
        techSignal: "GREEN",
        revenueSignal: "GREEN",
        volumePriceSignal: "YELLOW",
        competitivenessSignal: "GREEN",
        qualitySignal: "GREEN",
        conclusionSignal: "GREEN",
      },
      submitterName: "测试评审人",
      submitTime: "2026-07-28 10:00:00",
      submitModeLabel: "人工保存",
      auditModeLabel: "--",
    },
  ],
});

const meetings: CommitteeMeeting[] = projectProfiles.flatMap(
  (profile, index) => {
    const secondId = `meeting-second-${profile.id}`;
    const groupId = `meeting-group-${profile.id}`;
    const second: CommitteeMeeting = {
      id: secondId,
      meetingName: `${profile.name}`,
      meetingLevel: "SECOND",
      meetingType: "PRODUCT_COMMITTEE",
      projectId: profile.id,
      projectName: profile.name,
      companyName: profile.company,
      gateId: profile.gate.id,
      gateName: profile.gate.name,
      attemptNo: 1,
      meetingTime: `2026-07-${String(12 + index).padStart(2, "0")} 09:30:00`,
      reviewDeadlineTime: `2026-07-${String(10 + index).padStart(2, "0")} 18:00:00`,
      meetingLocation: "品牌公司会议室 A",
      remark: "mock 二级会审议。",
      meetingStatus: index % 2 ? "PREPARING" : "CONCLUDED",
      currentSnapshotId: `snapshot-${secondId}`,
      currentConclusionId: `conclusion-${secondId}`,
      currentConclusionDecision: index % 2 ? undefined : "PASS",
      lockVersion: 1,
    };
    const group: CommitteeMeeting = {
      ...second,
      id: groupId,
      meetingName: `${profile.name} ${profile.gate.name} 集团产品委员会`,
      meetingLevel: "GROUP",
      meetingTime: `2026-07-${String(20 + index).padStart(2, "0")} 14:00:00`,
      reviewDeadlineTime: `2026-07-${String(18 + index).padStart(2, "0")} 18:00:00`,
      meetingLocation: "集团总部 3 号会议室",
      remark: "mock 集团会审议。",
      meetingStatus: index % 3 ? "PREPARING" : "CONCLUDED",
      linkedSecondMeetingId: secondId,
      linkedSecondMeetingName: second.meetingName,
      linkedSecondMeetingConclusion: "PASS",
      linkedSecondConclusionId: `conclusion-${secondId}`,
      currentSnapshotId: `snapshot-${groupId}`,
      currentConclusionId: `conclusion-${groupId}`,
      materialId: `material-${groupId}`,
      materialStatus: "DRAFT",
      materialLockVersion: 1,
      material: {
        ...(profile.id === "1001"
          ? {
              sourceData: {
                operatingProfit: "-1000.60",
                sourceStatus: "COMPLETE" as const,
              },
              revenueForecastGroups: JSON.stringify([
                {
                  id: "revenue-forecast-target-cost",
                  label: "目标成本",
                  margin: "80000",
                  profit: "50000",
                },
                {
                  id: "revenue-forecast-current-actual",
                  label: "当前实际",
                  margin: "3171.18",
                  profit: "-1000.60",
                },
                {
                  id: "revenue-forecast-sop-forecast",
                  label: "SOP预算",
                  margin: "6000",
                  profit: "3000",
                },
                {
                  id: "revenue-forecast-sop6-forecast",
                  label: "SOP+6Y预算",
                  margin: "90000",
                  profit: "70000",
                },
              ]),
            }
          : {}),
        coverTitle: `${profile.name} ${profile.gate.name} 集团产品委员会汇报`,
        reportDepartment: "集团技术与产品管理部",
        executiveSummary:
          "项目总体进展符合计划，成本收益和质量风险需持续跟踪。",
        previousGateRequirements:
          "上一阀点要求已形成责任清单，核心事项进入本次审议。",
        deliveryReview: "研发、财经、营销和质量部门均已提交阶段评审意见。",
        costPoints: JSON.stringify([
          "成本目标及当前实际（加权）存在 16 万元级差距，当前需持续推进专项降本。",
          "通过平台化复用、采购价格重谈及配置优化，SOP 节点预计可回归目标线。",
          "集团技术与产品管理部建议将降本专项列入会后督办清单并按月复盘。",
        ]),
        costForecastNodes: JSON.stringify([
          { id: "cost-forecast-1", label: "目标成本", value: "72" },
          { id: "cost-forecast-2", label: "当前实际", value: "88" },
          { id: "cost-forecast-3", label: "SOP 预计", value: "72" },
          { id: "cost-forecast-4", label: "SOP+6预计", value: "54" },
        ]),
        decisionText: "请审议是否同意项目通过当前阀点并进入下一阶段。",
        aiQualitySuggestion: "建议补充热管理和座舱软件稳定性专项验证。",
        aiCostSuggestion: "建议固化供应商降本承诺和量产爬坡成本口径。",
        aiRevenueSuggestion: "建议明确海外版销量敏感性测算边界。",
      },
    };
    return [second, group];
  },
);

let conclusions: CommitteeConclusion[] = meetings.map((meeting) => ({
  id: `conclusion-${meeting.id}`,
  meetingId: meeting.id,
  snapshotId: `snapshot-${meeting.id}`,
  conclusionVersion: 1,
  conclusionStatus:
    meeting.meetingStatus === "CONCLUDED" ? "CONFIRMED" : "DRAFT",
  decision: meeting.meetingStatus === "CONCLUDED" ? "PASS" : "CONDITIONAL_PASS",
  conclusionText:
    meeting.meetingLevel === "GROUP"
      ? "集团产品委员会同意项目带条件通过当前阀点，按会后整改清单闭环。"
      : "二级公司产品委员会同意项目进入下一审议环节。",
  followUps: ["补齐收益测算敏感性说明", "跟踪质量风险关闭计划"],
  operatorUserId: "u20101",
  operatorName: "张国强",
  generatedTime: "2026-07-20 16:00:00",
  confirmedByName: meeting.meetingStatus === "CONCLUDED" ? "张国强" : undefined,
  confirmedTime:
    meeting.meetingStatus === "CONCLUDED" ? "2026-07-20 16:30:00" : undefined,
}));

const snapshots: Array<Record<string, unknown>> = meetings.map(
  (meeting, index) => ({
    id: `snapshot-${meeting.id}`,
    meetingId: meeting.id,
    meetingName: meeting.meetingName,
    meetingLevel: meeting.meetingLevel,
    snapshotRound: index + 1,
    templateVersionId: "tpl-committee-v1",
    providerCode: "MOCK_SEED",
    generatedTime: "2026-07-20 15:40:00",
    projectName: meeting.projectName,
    gateName: meeting.gateName,
    conclusionText: "用于本地联调的产品委员会 mock 快照。",
  }),
);

let attachments: CommitteeAttachment[] = [
  {
    id: "att-template-1",
    bizCode: "MATERIAL_TEMPLATE",
    bizId: "cat-1",
    fileName: "项目立项汇报稿.pdf",
    fileSize: 1024 * 620,
    fileType: "application/pdf",
  },
  {
    id: "att-project-spectrum-1001",
    bizCode: "PROJECT_SPECTRUM",
    bizId: "1001",
    fileName: "BE22 型谱方案.pdf",
    fileSize: 1024 * 520,
    fileType: "application/pdf",
  },
  {
    id: "att-gate-1001",
    bizCode: "COMMITTEE_GATE",
    bizId: "gate-1001-g9",
    fileName: "G9 阀点支撑材料.pdf",
    fileSize: 1024 * 720,
    fileType: "application/pdf",
  },
  {
    id: "att-reply-topic-1",
    bizCode: "REPLY_TOPIC",
    bizId: "topic-1",
    fileName: "质量风险复核补充说明.pdf",
    fileSize: 1024 * 360,
    fileType: "application/pdf",
  },
  {
    id: "att-reply-message-1",
    bizCode: "REPLY_MESSAGE",
    bizId: "message-1",
    fileName: "集团会前质量补充清单.xlsx",
    fileSize: 1024 * 220,
    fileType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  ...reviewTasks.flatMap((task) =>
    (task.records ?? []).map((record) => ({
      id: `att-review-${record.id}`,
      bizCode: "REVIEW_RECORD",
      bizId: record.id,
      fileName:
        task.departmentGroup === "GROUP"
          ? "Q25 域控整合研发正式版.docx"
          : `${task.departmentName}评审意见正式版.docx`,
      fileSize: 1024 * 260,
      fileType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })),
  ),
  ...conclusions.slice(0, 6).map((conclusion, index) => ({
    id: `att-conclusion-${index + 1}`,
    bizCode: "CONCLUSION",
    bizId: conclusion.id,
    fileName:
      index % 2 === 0 ? "座舱域控切换影响分析.xlsx" : "会后整改责任清单.docx",
    fileSize: 1024 * (180 + index * 24),
    fileType:
      index % 2 === 0
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })),
];

const rectifications: CommitteeRectification[] = [
  {
    id: "rect-1",
    projectId: "1001",
    projectName: "BE22 平台纯电 SUV 项目",
    gateId: "gate-1001-g9",
    requirement: "补充热管理二轮验证计划，并在集团会后 5 个工作日内反馈。",
    responsibleDepartmentName: "研发部",
    responsibleUserName: "赵研发总",
    expectedFinishDate: "2026-08-05",
    rectificationStatus: "PENDING",
    lockVersion: 1,
  },
  {
    id: "rect-2",
    projectId: "1002",
    projectName: "X7 出口版产品规划项目",
    gateId: "gate-1002-g7",
    requirement: "完善海外法规适配清单与供应链切换风险说明。",
    responsibleDepartmentName: "营销部",
    responsibleUserName: "田营销总",
    expectedFinishDate: "2026-08-12",
    rectificationStatus: "PROCESSING",
    completionText: "已收集法规差异项，等待供应链确认。",
    lockVersion: 1,
  },
];

let notices: CommitteeReviewNotice[] = [
  {
    id: "notice-1",
    noticeUserName: "张国强",
    noticeDeptName: "集团技术与产品管理部",
    noticeContent: "请补充收益敏感性测算。",
    handleStatus: "PENDING",
    noticeTime: "2026-07-19 10:00:00",
  },
];

let topics: CommitteeReplyTopic[] = [
  {
    id: "topic-1",
    topicTitle: "收益测算口径确认",
    topicContent: "请财经部确认当前销量假设是否采用集团统一口径。",
    starterName: "张国强",
    lastReplyTime: "2026-07-19 11:00:00",
    replyCount: 1,
  },
];

let messages: CommitteeReplyMessage[] = [
  {
    id: "message-1",
    topicId: "topic-1",
    replyUserName: "吴财经总",
    replyContent: "已按集团统一口径补充敏感性测算。",
    replyTime: "2026-07-19 11:00:00",
  },
];

const gateTemplates: CommitteeGateTemplate[] = valves.map((valve) => ({
  id: `gate-template-${valve.valveCode}`,
  gateCode: valve.valveCode,
  gateName: valve.valveName,
  sequenceNo: valve.sortNo,
  gatePurpose: `${valve.valveName} 阀点审议目标`,
  coreWorkContent: "确认阶段交付物、成本收益、质量风险和会后整改要求。",
  materialTemplateIds: materialTemplates.flatMap((item) =>
    item.id ? [item.id] : [],
  ),
  secondTemplateVersionId: "second-template-v1",
  secondSchemaHash: "mock-second-schema",
  groupTemplateVersionId: "group-template-v1",
  groupSchemaHash: "mock-group-schema",
  enableFlag: "1",
}));

const platformDeptTree: PlatformDeptItem[] = [
  {
    id: 1,
    parentId: 0,
    deptCode: "BAIC",
    deptName: "北汽集团",
    sortNo: 1,
    status: "ENABLED",
    children: [
      {
        id: 201,
        parentId: 1,
        deptCode: "GROUP_PRODUCT",
        deptName: "集团技术与产品管理部",
        sortNo: 1,
        status: "ENABLED",
        children: [],
      },
      {
        id: 202,
        parentId: 1,
        deptCode: "GROUP_FINANCE",
        deptName: "集团财务部",
        sortNo: 2,
        status: "ENABLED",
        children: [],
      },
      {
        id: 203,
        parentId: 1,
        deptCode: "GROUP_STRATEGY",
        deptName: "集团战略与市场部",
        sortNo: 3,
        status: "ENABLED",
        children: [],
      },
      {
        id: 10,
        parentId: 1,
        deptCode: "SECOND_A",
        deptName: "北汽新能源公司",
        sortNo: 4,
        status: "ENABLED",
        children: [
          {
            id: 101,
            parentId: 10,
            deptCode: "RD",
            deptName: "研发部",
            sortNo: 1,
            status: "ENABLED",
            children: [],
          },
          {
            id: 102,
            parentId: 10,
            deptCode: "FINANCE",
            deptName: "财经部",
            sortNo: 2,
            status: "ENABLED",
            children: [],
          },
          {
            id: 103,
            parentId: 10,
            deptCode: "MARKETING",
            deptName: "营销部",
            sortNo: 3,
            status: "ENABLED",
            children: [],
          },
          {
            id: 104,
            parentId: 10,
            deptCode: "QUALITY",
            deptName: "质量部",
            sortNo: 4,
            status: "ENABLED",
            children: [],
          },
        ],
      },
    ],
  },
];

const meetingLevelDictItems: PlatformDictItemDetail[] = [
  {
    id: 1,
    dictTypeCode: "committee_meeting_level",
    label: "二级公司",
    value: "SECOND",
    dictItemCode: "SECOND",
    dictItemLabel: "二级公司",
    sortNo: 1,
    defaulted: true,
    status: "ENABLED",
  },
  {
    id: 2,
    dictTypeCode: "committee_meeting_level",
    label: "集团",
    value: "GROUP",
    dictItemCode: "GROUP",
    dictItemLabel: "集团",
    sortNo: 2,
    status: "ENABLED",
  },
];

const reviewStatusDictItems: PlatformDictItemDetail[] = [
  {
    id: 11,
    dictTypeCode: "committee_review_status",
    label: "未开始",
    value: "NOT_STARTED",
    dictItemCode: "NOT_STARTED",
    dictItemLabel: "未开始",
    sortNo: 1,
    status: "ENABLED",
  },
  {
    id: 12,
    dictTypeCode: "committee_review_status",
    label: "草稿",
    value: "DRAFT",
    dictItemCode: "DRAFT",
    dictItemLabel: "草稿",
    sortNo: 2,
    status: "ENABLED",
  },
  {
    id: 13,
    dictTypeCode: "committee_review_status",
    label: "待负责人审批",
    value: "PENDING_APPROVAL",
    dictItemCode: "PENDING_APPROVAL",
    dictItemLabel: "待负责人审批",
    sortNo: 3,
    status: "ENABLED",
  },
  {
    id: 14,
    dictTypeCode: "committee_review_status",
    label: "已同意",
    value: "APPROVED",
    dictItemCode: "APPROVED",
    dictItemLabel: "已同意",
    sortNo: 4,
    status: "ENABLED",
  },
  {
    id: 15,
    dictTypeCode: "committee_review_status",
    label: "待上会",
    value: "WAITING_MEETING",
    dictItemCode: "WAITING_MEETING",
    dictItemLabel: "待上会",
    sortNo: 5,
    status: "ENABLED",
  },
  {
    id: 16,
    dictTypeCode: "committee_review_status",
    label: "已驳回",
    value: "REJECTED",
    dictItemCode: "REJECTED",
    dictItemLabel: "已驳回",
    sortNo: 6,
    status: "ENABLED",
  },
  {
    id: 17,
    dictTypeCode: "committee_review_status",
    label: "已归档",
    value: "ARCHIVED",
    dictItemCode: "ARCHIVED",
    dictItemLabel: "已归档",
    sortNo: 7,
    status: "ENABLED",
  },
];

const gateStatusDictItems: PlatformDictItemDetail[] = [
  {
    id: 31,
    dictTypeCode: "committee_gate_status",
    label: "未关联",
    value: "UNASSOCIATED",
    dictItemCode: "UNASSOCIATED",
    dictItemLabel: "未关联",
    sortNo: 1,
    status: "ENABLED",
  },
  {
    id: 32,
    dictTypeCode: "committee_gate_status",
    label: "已通过",
    value: "PASSED",
    dictItemCode: "PASSED",
    dictItemLabel: "已通过",
    sortNo: 2,
    status: "ENABLED",
  },
  {
    id: 33,
    dictTypeCode: "committee_gate_status",
    label: "进行中",
    value: "IN_PROGRESS",
    dictItemCode: "IN_PROGRESS",
    dictItemLabel: "进行中",
    sortNo: 3,
    status: "ENABLED",
  },
];

const approvalResultStatusDictItems: PlatformDictItemDetail[] = [
  {
    id: 21,
    dictTypeCode: "committee_approval_result_status",
    label: "待审批",
    value: "WAITING_APPROVAL",
    dictItemCode: "WAITING_APPROVAL",
    dictItemLabel: "待审批",
    sortNo: 1,
    status: "ENABLED",
  },
  {
    id: 22,
    dictTypeCode: "committee_approval_result_status",
    label: "同意",
    value: "COMPLETED",
    dictItemCode: "COMPLETED",
    dictItemLabel: "同意",
    sortNo: 2,
    status: "ENABLED",
  },
  {
    id: 23,
    dictTypeCode: "committee_approval_result_status",
    label: "驳回",
    value: "NEED_MODIFICATION",
    dictItemCode: "NEED_MODIFICATION",
    dictItemLabel: "驳回",
    sortNo: 3,
    status: "ENABLED",
  },
  {
    id: 24,
    dictTypeCode: "committee_approval_result_status",
    label: "暂无结果",
    value: "TO_FILL",
    dictItemCode: "TO_FILL",
    dictItemLabel: "暂无结果",
    sortNo: 4,
    status: "ENABLED",
  },
];

const committeeDictItemMap: Record<string, PlatformDictItemDetail[]> = {
  committee_meeting_level: meetingLevelDictItems,
  committee_review_status: reviewStatusDictItems,
  committee_approval_result_status: approvalResultStatusDictItems,
  committee_gate_status: gateStatusDictItems,
};

export function mockFetchCommitteeDashboard(): Promise<CommitteeDashboard> {
  const todos = reviewTasks.filter((task) =>
    ["NOT_STARTED", "DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(
      task.taskStatus,
    ),
  );
  return Promise.resolve(
    clone({
      projectCount: projectProfiles.length,
      inProgressProjectCount: projectProfiles.filter(
        (item) => item.status === "IN_PROGRESS",
      ).length,
      pendingHeadApprovalCount: reviewTasks.filter(
        (task) => task.taskStatus === "PENDING_APPROVAL",
      ).length,
      secondMeetingPreparationCount: meetings.filter(
        (meeting) =>
          meeting.meetingLevel === "SECOND" &&
          meeting.meetingStatus === "PREPARING",
      ).length,
      groupMeetingPreparationCount: meetings.filter(
        (meeting) =>
          meeting.meetingLevel === "GROUP" &&
          meeting.meetingStatus === "PREPARING",
      ).length,
      todos: todos.slice(0, 8),
      recentActivities: [
        {
          time: "2026-07-20 16:30:00",
          title: "BE22 平台纯电 SUV 项目集团会结论已生成",
        },
        {
          time: "2026-07-19 11:00:00",
          title: "财经部补充了收益测算口径说明",
        },
        {
          time: "2026-07-18 15:30:00",
          title: "X7 出口版产品规划项目完成二级会材料准备",
        },
      ],
      navigationFilters: {
        projects: { committeeStatus: "IN_PROGRESS" },
        reviews: { taskStatus: "PENDING_APPROVAL" },
      },
    }),
  );
}

export function mockFetchCommitteeProjects(
  params: PageParams,
): Promise<CommitteePage<CommitteeProject>> {
  const projectGateStatus = (item: (typeof projectProfiles)[number]) => {
    if (!item.gate?.id) return "UNASSOCIATED";
    if (item.status === "PASSED") return "PASSED";
    return "IN_PROGRESS";
  };
  const records = projectProfiles
    .filter((item) => contains(item.name, params.projectName))
    .filter((item) => contains(item.brand, params.brand))
    .filter((item) => contains(item.category, params.projectCategory))
    .filter((item) => contains(item.base, params.productionBase))
    .filter((item) => contains(item.company, params.companyName))
    .filter((item) => contains(item.gate?.name, params.currentGateName))
    .filter(
      (item) =>
        !params.committeeStatus ||
        projectGateStatus(item) === String(params.committeeStatus),
    )
    .map<CommitteeProject>((item) => ({
      projectId: item.id,
      projectName: item.name,
      owningCompany: item.company,
      currentGateId: item.gate?.id,
      currentGateName: item.gate?.name,
      plannedFinishDate: item.planned,
      gateStatus: item.status,
      committeeStatus: item.status,
      secondMeetingConclusion: item.status === "PASSED" ? "PASS" : undefined,
      groupMeetingConclusion:
        item.status === "PASSED" ? "CONDITIONAL_PASS" : undefined,
      projectCode: item.code,
      brandName: item.brand,
      projectCategory: item.category,
      factoryName: item.base,
      totalInvestment: item.investment,
      vehicleModelInvestment: item.vehicleInvestment,
      executionRate: item.rate,
    }));
  return Promise.resolve(paginate(records, params));
}

export function mockFetchCommitteeProject(
  projectId: CommitteeId,
): Promise<CommitteeProjectDetail> {
  const detail =
    projectDetails.get(String(projectId)) ??
    projectDetails.get(projectProfiles[0].id);
  return Promise.resolve(clone(detail!));
}

export function mockFetchCommitteeProjectCandidates(params?: {
  company?: string;
  keyword?: string;
  limit?: number;
}): Promise<CommitteeProjectCandidate[]> {
  const rows = projectProfiles
    .filter((item) => contains(item.company, params?.company))
    .filter((item) => contains(`${item.name}${item.code}`, params?.keyword))
    .slice(0, params?.limit ?? 20)
    .map((item) => ({
      projectId: Number(item.id),
      wbsNumber: `WBS-${item.code}`,
      projectName: item.name,
      brandName: item.brand,
      projectCategory: item.category,
      company: item.company,
      factory: item.base,
    }));
  return Promise.resolve(clone(rows));
}

export function mockFetchCommitteeProjectCompanyOptions(): Promise<string[]> {
  return Promise.resolve(
    clone(Array.from(new Set(projectProfiles.map((item) => item.company)))),
  );
}

export function mockFetchCommitteeProjectVehicleInvestment(
  projectId: CommitteeId,
): Promise<{
  amount: string;
  sourceType: string;
  sourceRecordId: number;
  sourceVersion: string;
} | null> {
  const profile = projectProfiles.find((item) => item.id === String(projectId));
  return Promise.resolve(
    profile
      ? clone({
          amount: String(profile.vehicleInvestment),
          sourceType: "VALVE_BUDGET",
          sourceRecordId: 1,
          sourceVersion: "V1",
        })
      : null,
  );
}

export function mockInitializeCommitteeProject(
  projectId: CommitteeId,
  data: CommitteeProjectInitPayload,
): Promise<Record<string, unknown>> {
  const profile = projectProfiles.find((item) => item.id === String(projectId));
  return Promise.resolve(
    clone({
      projectId,
      initialized: true,
      projectName: profile?.name ?? `项目 ${projectId}`,
      ...data,
    }),
  );
}

export function mockCreateCommitteeGate(
  projectId: CommitteeId,
  data: CommitteeGateUpsertCommand,
): Promise<Record<string, unknown>> {
  return Promise.resolve(
    clone({ id: nextId("gate"), projectId: String(projectId), ...data }),
  );
}

export function mockUpdateCommitteeGate(
  gateId: CommitteeId,
  data: CommitteeGateUpsertCommand,
): Promise<Record<string, unknown>> {
  return Promise.resolve(clone({ id: gateId, ...data }));
}

export function mockUpdateCommitteeProjectProfile(
  projectId: CommitteeId,
  data: CommitteeProjectProfileUpdateCommand,
): Promise<Record<string, unknown>> {
  const detail = projectDetails.get(String(projectId));
  if (detail) {
    detail.project = {
      ...detail.project,
      ...data,
      totalInvestment: Number(data.totalInvestment),
      vehicleModelInvestment: Number(data.vehicleModelInvestment),
      executionRate: Number(data.executionRate),
    };
  }
  return Promise.resolve(clone({ projectId, ...data }));
}

export function mockFetchCommitteeGateAssignments(
  gateId: CommitteeId,
): Promise<CommitteeGateAssignmentSet> {
  const detail = [...projectDetails.values()].find(
    (item) => item.currentGate?.id === String(gateId),
  );
  return Promise.resolve(
    clone({
      gateId,
      assignments: detail?.assignments ?? [],
      reviewers: detail?.reviewers ?? [],
    }),
  );
}

export function mockFetchCommitteeGateMeetings(
  projectId: CommitteeId,
  gateId: CommitteeId,
): Promise<CommitteeGateMeetingHistory> {
  const rows = meetings.filter(
    (meeting) =>
      String(meeting.projectId) === String(projectId) &&
      String(meeting.gateId) === String(gateId),
  );
  return Promise.resolve(
    clone({
      second: rows.filter((meeting) => meeting.meetingLevel === "SECOND"),
      group: rows.filter((meeting) => meeting.meetingLevel === "GROUP"),
    }),
  );
}

export function mockFetchCommitteeReviewSummary(
  gateId: CommitteeId,
): Promise<CommitteeReviewSummary> {
  const tasks = reviewTasks.filter(
    (task) => String(task.gateId) === String(gateId),
  );
  const source = tasks.length ? tasks : reviewTasks.slice(0, 5);
  const groups = ["SECOND_COMPANY", "GROUP"].map((group) => ({
    departmentGroup: group,
    departments: source
      .filter((task) => task.departmentGroup === group)
      .map((task) => ({
        taskId: task.id,
        departmentId: task.departmentId,
        departmentName: task.departmentName,
        requiredFlag: "1" as const,
        taskStatus: task.taskStatus,
        currentVersionNo: task.currentVersionNo,
        hasFormalVersion:
          task.currentVersionNo !== null && task.currentVersionNo !== undefined,
        updateTime: task.updateTime,
        currentRecord: task.records?.find(
          (record) => record.versionNo === task.currentVersionNo,
        ),
      })),
  }));
  return Promise.resolve(
    clone({
      gateId,
      requiredCount: source.length,
      approvedCount: source.filter((task) => task.taskStatus === "APPROVED")
        .length,
      pendingCount: source.filter((task) =>
        ["NOT_STARTED", "DRAFT", "PENDING_APPROVAL"].includes(task.taskStatus),
      ).length,
      rejectedCount: source.filter((task) => task.taskStatus === "REJECTED")
        .length,
      groups,
    }),
  );
}

export function mockFetchCommitteeReviewNotices(): Promise<
  CommitteeReviewNotice[]
> {
  return Promise.resolve(clone(notices));
}

export function mockCreateCommitteeReviewNotice(
  content: string,
): Promise<CommitteeReviewNotice> {
  const row: CommitteeReviewNotice = {
    id: nextId("notice"),
    noticeUserName: "当前用户",
    noticeDeptName: "产品委员会办公室",
    noticeContent: content,
    handleStatus: "PENDING",
    noticeTime: "2026-07-21 10:00:00",
  };
  notices = [row, ...notices];
  return Promise.resolve(clone(row));
}

export function mockFetchCommitteeReplyTopics(): Promise<
  CommitteeReplyTopic[]
> {
  return Promise.resolve(clone(topics));
}

export function mockCreateCommitteeReplyTopic(
  title: string,
  content: string,
): Promise<CommitteeReplyTopic> {
  const row: CommitteeReplyTopic = {
    id: nextId("topic"),
    topicTitle: title,
    topicContent: content,
    starterName: "当前用户",
    lastReplyTime: "2026-07-21 10:00:00",
    replyCount: 0,
  };
  topics = [row, ...topics];
  return Promise.resolve(clone(row));
}

export function mockFetchCommitteeReplyMessages(
  topicId: CommitteeId,
): Promise<CommitteeReplyMessage[]> {
  return Promise.resolve(
    clone(
      messages.filter((message) => String(message.topicId) === String(topicId)),
    ),
  );
}

export function mockCreateCommitteeReplyMessage(
  topicId: CommitteeId,
  content: string,
  replyToMessageId?: CommitteeId,
): Promise<CommitteeReplyMessage> {
  const row: CommitteeReplyMessage = {
    id: nextId("message"),
    topicId,
    replyToMessageId,
    replyUserName: "当前用户",
    replyContent: content,
    replyTime: "2026-07-21 10:00:00",
  };
  messages = [...messages, row];
  return Promise.resolve(clone(row));
}

export function mockFetchCommitteeReviewTasks(
  params: PageParams,
): Promise<CommitteePage<CommitteeReviewTask> | CommitteeReviewTask[]> {
  const records = reviewTasks
    .filter(
      (task) =>
        !params.projectId ||
        String(task.projectId) === String(params.projectId),
    )
    .filter((task) => {
      if (!params.companyName) return true;
      const project = projectProfiles.find(
        (item) => String(item.id) === String(task.projectId),
      );
      return String(project?.company ?? "") === String(params.companyName);
    })
    .filter(
      (task) => !params.gateId || String(task.gateId) === String(params.gateId),
    )
    .filter((task) => {
      if (!params.valveId) return true;
      const project = projectProfiles.find(
        (item) => String(item.id) === String(task.projectId),
      );
      return String(project?.gate?.valveId) === String(params.valveId);
    })
    .filter(
      (task) =>
        !params.taskStatus || task.taskStatus === String(params.taskStatus),
    )
    .filter(
      (task) =>
        !params.departmentGroup ||
        task.departmentGroup === String(params.departmentGroup),
    )
    .filter(
      (task) =>
        !params.departmentId ||
        String(task.departmentId) === String(params.departmentId),
    )
    .filter(
      (task) =>
        !(params.approvalResult || params.actionRequirement) ||
        resolveReviewTaskActionRequirement(task) ===
          String(params.approvalResult || params.actionRequirement),
    )
    .map((task) => ({
      ...task,
      records: (task.records ?? [])
        .filter((record) => isCurrentReviewRecord(task, record))
        .map((record) => toReviewListRecord(record)),
    }));
  return Promise.resolve(paginate(records, params));
}

function resolveReviewTaskActionRequirement(task: CommitteeReviewTask) {
  if (task.taskStatus === "NOT_STARTED") return "TO_FILL";
  if (task.taskStatus === "DRAFT") return "TO_FILL";
  if (task.taskStatus === "REJECTED") return "NEED_MODIFICATION";
  if (task.taskStatus === "PENDING_APPROVAL") return "WAITING_APPROVAL";
  if (task.taskStatus === "APPROVED") return "COMPLETED";
  if (task.taskStatus === "ARCHIVED") return "COMPLETED";
  return "";
}

export function mockFetchCommitteeReviewTask(
  taskId: CommitteeId,
): Promise<CommitteeReviewTask> {
  const task =
    reviewTasks.find((item) => item.id === String(taskId)) ?? reviewTasks[0];
  const detail = clone(task);
  detail.records = detail.records?.map((record) => ({
    ...withoutReviewRecordContent(record),
    ...(isCurrentReviewRecord(task, record) ? { content: record.content } : {}),
  }));
  if (
    detail.currentRecord &&
    !isCurrentReviewRecord(task, detail.currentRecord)
  ) {
    detail.currentRecord = withoutReviewRecordContent(detail.currentRecord);
  }
  return Promise.resolve(detail);
}

function isCurrentReviewRecord(
  task: CommitteeReviewTask,
  record: CommitteeReviewRecord,
) {
  const currentRecordId = task.currentRecord?.id ?? task.currentRecordId;
  if (currentRecordId != null) {
    return String(record.id) === String(currentRecordId);
  }
  return (
    task.currentVersionNo != null &&
    Number(record.versionNo) === Number(task.currentVersionNo)
  );
}

function withoutReviewRecordContent(record: CommitteeReviewRecord) {
  const { content: _content, ...metadata } = record;
  return metadata;
}

function toReviewListRecord(record: CommitteeReviewRecord) {
  return {
    id: record.id,
    versionNo: record.versionNo,
    recordStatus: record.recordStatus,
    approvalAction: record.approvalAction,
    submitterName: record.submitterName,
    submitTime: record.submitTime,
    approveTime: record.approveTime,
  };
}

export function mockFetchCommitteeReviewRecord(
  recordId: CommitteeId,
): Promise<CommitteeReviewRecord> {
  const record = reviewTasks
    .flatMap((task) => task.records ?? [])
    .find((item) => String(item.id) === String(recordId));
  if (!record) return Promise.reject(new Error("评审记录不存在"));
  return Promise.resolve(clone(record));
}

export function mockSaveCommitteeReview(
  taskId: CommitteeId,
  lockVersion: number,
  content: Partial<CommitteeReviewContent>,
  submit = false,
): Promise<CommitteeReviewTask> {
  const task =
    reviewTasks.find((item) => item.id === String(taskId)) ?? reviewTasks[0];
  task.draft = content;
  task.taskStatus = submit ? "PENDING_APPROVAL" : "DRAFT";
  task.lockVersion = lockVersion + 1;
  task.updateTime = "2026-07-21 10:00:00";
  return Promise.resolve(clone(task));
}

export function mockRollbackCommitteeReviewDraft(
  taskId: CommitteeId,
  lockVersion: number,
): Promise<CommitteeReviewTask> {
  const task =
    reviewTasks.find((item) => item.id === String(taskId)) ?? reviewTasks[0];
  task.taskStatus = "DRAFT";
  task.lockVersion = lockVersion + 1;
  task.updateTime = "2026-08-15 14:15:01";
  return Promise.resolve(clone(task));
}

export function mockDecideCommitteeReview(
  recordId: CommitteeId,
  action: "approve" | "reject",
): Promise<CommitteeReviewTask> {
  const task =
    reviewTasks.find((item) => item.currentRecordId === String(recordId)) ??
    reviewTasks[0];
  task.taskStatus = action === "approve" ? "APPROVED" : "REJECTED";
  return Promise.resolve(clone(task));
}

export function mockFetchCommitteeMeetings(
  level: CommitteeMeetingLevel,
  params: PageParams,
): Promise<CommitteePage<CommitteeMeeting> | CommitteeMeeting[]> {
  const rows = meetings
    .filter((meeting) => meeting.meetingLevel === level)
    .filter(
      (meeting) =>
        !params.meetingType || meeting.meetingType === String(params.meetingType),
    )
    .filter(
      (meeting) =>
        !params.companyName ||
        meeting.companyName === String(params.companyName),
    )
    .filter((meeting) => contains(meeting.projectName, params.projectName))
    .filter((meeting) => contains(meeting.gateName, params.gateName))
    .filter(
      (meeting) =>
        !params.meetingStatus ||
        meeting.meetingStatus === String(params.meetingStatus),
    );
  return Promise.resolve(paginate(rows, params));
}

export function mockFetchCommitteeMeeting(
  level: CommitteeMeetingLevel,
  meetingId: CommitteeId,
): Promise<CommitteeMeeting> {
  return Promise.resolve(
    clone(
      meetings.find(
        (meeting) =>
          meeting.id === String(meetingId) && meeting.meetingLevel === level,
      ) ??
        meetings.find((meeting) => meeting.meetingLevel === level) ??
        meetings[0],
    ),
  );
}

export function mockCreateCommitteeMeeting(
  level: CommitteeMeetingLevel,
  data: CommitteeMeetingCreateCommand,
): Promise<CommitteeMeeting> {
  const detail = projectDetails.get(String(data.projectId));
  const projectName = detail?.project.projectName ?? `项目 ${data.projectId}`;
  const gateName = detail?.currentGate?.gateName ?? `阀点 ${data.gateId}`;
  const row: CommitteeMeeting = {
    id: nextId(`meeting-${level.toLowerCase()}`),
    meetingName: `${projectName} ${gateName} ${level === "GROUP" ? "集团" : "二级公司"}产品委员会`,
    meetingLevel: level,
    meetingType: data.meetingType,
    projectId: data.projectId,
    projectName,
    gateId: data.gateId,
    gateName,
    attemptNo: 1,
    meetingTime: data.meetingTime,
    reviewDeadlineTime: data.reviewDeadlineTime,
    meetingLocation: data.meetingLocation,
    meetingHost: data.meetingHost,
    linkedSecondMeetingId: data.linkedSecondMeetingId,
    linkedSecondConclusionId: data.linkedSecondConclusionId,
    remark: data.remark,
    meetingStatus: "PREPARING",
    lockVersion: 1,
  };
  meetings.push(row);
  return Promise.resolve(clone(row));
}

export function mockUpdateCommitteeMeeting(
  level: CommitteeMeetingLevel,
  meetingId: CommitteeId,
  data: CommitteeMeetingUpdateCommand,
): Promise<CommitteeMeeting> {
  const meeting =
    meetings.find((item) => item.id === String(meetingId)) ??
    meetings.find((item) => item.meetingLevel === level)!;
  Object.assign(meeting, {
    meetingTime: data.meetingTime,
    reviewDeadlineTime: data.reviewDeadlineTime,
    meetingLocation: data.meetingLocation,
    meetingHost: data.meetingHost,
    remark: data.remark,
    lockVersion: data.expectedLockVersion + 1,
  });
  return Promise.resolve(clone(meeting));
}

export function mockSetCommitteeMeetingLock(
  meetingId: CommitteeId,
  expectedLockVersion: number,
): Promise<CommitteeMeeting> {
  const meeting =
    meetings.find((item) => item.id === String(meetingId)) ??
    meetings.find((item) => item.meetingLevel === "SECOND")!;
  Object.assign(meeting, {
    meetingStatus: "LOCKED",
    lockVersion: expectedLockVersion + 1,
  });
  return Promise.resolve(clone(meeting));
}

export function mockUnlockCommitteeMeeting(
  meetingId: CommitteeId,
  expectedLockVersion: number,
): Promise<CommitteeMeeting> {
  const meeting =
    meetings.find((item) => item.id === String(meetingId)) ??
    meetings.find((item) => item.meetingLevel === "SECOND")!;
  Object.assign(meeting, {
    meetingStatus: "PREPARING",
    lockVersion: expectedLockVersion + 1,
  });
  return Promise.resolve(clone(meeting));
}

export function mockFetchCommitteeConclusions(
  meetingId: CommitteeId,
): Promise<CommitteeConclusion[]> {
  return Promise.resolve(
    clone(
      conclusions.filter(
        (item) => String(item.meetingId) === String(meetingId),
      ),
    ),
  );
}

export function mockFetchCommitteeSnapshots(
  meetingId: CommitteeId,
): Promise<Array<Record<string, unknown>>> {
  return Promise.resolve(
    clone(
      snapshots.filter((item) => String(item.meetingId) === String(meetingId)),
    ),
  );
}

export function mockFetchCommitteeSnapshotList(
  params: PageParams,
): Promise<
  CommitteePage<Record<string, unknown>> | Array<Record<string, unknown>>
> {
  const rows = snapshots
    .filter(
      (item) =>
        !params.meetingId ||
        String(item.meetingId) === String(params.meetingId),
    )
    .filter(
      (item) =>
        !params.meetingLevel ||
        String(item.meetingLevel) === String(params.meetingLevel),
    );
  return Promise.resolve(paginate(rows, params));
}

export function mockFetchCommitteeSnapshot(
  snapshotId: CommitteeId,
): Promise<Record<string, unknown>> {
  return Promise.resolve(
    clone(
      snapshots.find((item) => String(item.id) === String(snapshotId)) ??
        snapshots[0],
    ),
  );
}

export function mockFetchCommitteeSecondConfirms(
  meetingId: CommitteeId,
): Promise<Array<Record<string, unknown>>> {
  return Promise.resolve(
    clone(
      departments.slice(0, 3).map((department, index) => ({
        id: `confirm-${meetingId}-${department.departmentId}`,
        meetingId,
        departmentId: department.departmentId,
        departmentName: department.departmentName,
        confirmStatus: index === 0 ? "CONFIRMED" : "PENDING",
        opinion: index === 0 ? "同意进入集团会审议。" : "",
        lockVersion: 1,
      })),
    ),
  );
}

export function mockDecideCommitteeSecondConfirm(
  confirmId: CommitteeId,
  action: "approve" | "reject",
): Promise<Record<string, unknown>> {
  return Promise.resolve(
    clone({
      id: confirmId,
      confirmStatus: action === "approve" ? "CONFIRMED" : "REJECTED",
      lockVersion: 2,
    }),
  );
}

export function mockSaveCommitteeConclusion(
  meetingId: CommitteeId,
  data: Record<string, unknown>,
): Promise<CommitteeConclusion> {
  const row: CommitteeConclusion = {
    id: nextId("conclusion"),
    meetingId,
    snapshotId: `snapshot-${meetingId}`,
    conclusionVersion: 1,
    conclusionStatus: "DRAFT",
    decision: String(data.decision ?? "CONDITIONAL_PASS"),
    conclusionText: String(data.conclusionText ?? "会议结论已保存。"),
    followUps: Array.isArray(data.followUps) ? data.followUps.map(String) : [],
    operatorUserId: "u20101",
    operatorName: "张国强",
    generatedTime: "2026-07-21 10:00:00",
  };
  conclusions = [row, ...conclusions];
  return Promise.resolve(clone(row));
}

export function mockDecideCommitteeConclusion(
  conclusionId: CommitteeId,
  action: "submit-confirmation" | "confirm" | "reject",
  opinion?: string,
): Promise<CommitteeConclusion> {
  const row =
    conclusions.find((item) => item.id === String(conclusionId)) ??
    conclusions[0];
  row.conclusionStatus =
    action === "reject"
      ? "REJECTED"
      : action === "confirm"
        ? "CONFIRMED"
        : "PENDING_CONFIRMATION";
  row.rejectionReason = action === "reject" ? opinion : undefined;
  return Promise.resolve(clone(row));
}

export function mockFetchGroupMaterial(
  meetingId: CommitteeId,
): Promise<CommitteeMeeting> {
  const meeting =
    meetings.find((item) => item.id === String(meetingId)) ??
    meetings.find((item) => item.meetingLevel === "GROUP") ??
    meetings[0];
  return Promise.resolve(clone(meeting));
}

export function mockFetchCommitteeSubtotalWeighted(): Promise<CommitteeSubtotalWeightedData> {
  return Promise.resolve({ yelr: "-100000.60" });
}

export function mockSaveGroupMaterial(
  meetingId: CommitteeId,
  data: Record<string, unknown>,
): Promise<CommitteeMeeting> {
  const meeting =
    meetings.find((item) => item.id === String(meetingId)) ??
    meetings.find((item) => item.meetingLevel === "GROUP")!;
  meeting.material = {
    ...(meeting.material ?? {}),
    ...data,
  };
  meeting.materialLockVersion = Number(data.expectedLockVersion ?? 0) + 1;
  return Promise.resolve(clone(meeting));
}

export function mockGenerateGroupMaterialSuggestions(
  meetingId: CommitteeId,
): Promise<CommitteeAiSuggestions> {
  void meetingId;
  return Promise.resolve({
    qualitySuggestion: "建议将热管理验证和座舱域控稳定性作为会后重点跟踪。",
    costSuggestion: "建议锁定关键供应商降本承诺并同步量产成本基线。",
    revenueSuggestion: "建议补充销量敏感性与海外价格场景测算。",
  });
}

export function mockSummarizeCommitteeOpinions(
  meetingId: CommitteeId,
): Promise<CommitteeOpinionSummary> {
  void meetingId;
  return Promise.resolve({
    success: true,
    projects: [
      {
        projectId: "1001",
        projectName: "BE22",
        gatePoints: [
          {
            gatePointId: "gate-1001-g9",
            gatePointName: "G9",
            departments: [
              {
                departmentId: "group-finance",
                department: "集团财务部",
                polarity: "负向",
                opinion: ["建议补充投资测算依据。"],
                opinionSummary: "集团财务部建议补充投资测算依据。",
                inputType: "text",
                error: null,
                warning: null,
              },
            ],
          },
        ],
      },
    ],
    projectCount: 1,
    gatePointCount: 1,
    departmentCount: 1,
    positiveCount: 0,
    negativeCount: 1,
    processingMs: 1200,
    llmProfile: "mock",
    modelName: "mock-model",
    warning: null,
  });
}

export function mockFetchCommitteeRectifications(
  params: PageParams,
): Promise<CommitteePage<CommitteeRectification> | CommitteeRectification[]> {
  const rows = rectifications
    .filter((item) => contains(item.projectName, params.projectName))
    .filter(
      (item) =>
        !params.rectificationStatus ||
        item.rectificationStatus === String(params.rectificationStatus),
    );
  return Promise.resolve(paginate(rows, params));
}

export function mockActOnCommitteeRectification(
  id: CommitteeId,
  action: "submit" | "accept" | "reject",
  data: Record<string, unknown>,
): Promise<CommitteeRectification> {
  const row =
    rectifications.find((item) => item.id === String(id)) ?? rectifications[0];
  row.rectificationStatus =
    action === "accept"
      ? "ACCEPTED"
      : action === "reject"
        ? "REJECTED"
        : "SUBMITTED";
  row.completionText = String(data.completionText ?? row.completionText ?? "");
  row.lockVersion += 1;
  return Promise.resolve(clone(row));
}

export function mockFetchCommitteeDepartments(): Promise<
  CommitteeConfigDepartment[]
> {
  return Promise.resolve(clone(departments));
}

export function mockSaveCommitteeDepartments(
  rows: CommitteeConfigDepartment[],
): Promise<CommitteeConfigDepartment[]> {
  departments.splice(0, departments.length, ...clone(rows));
  return Promise.resolve(clone(departments));
}

export function mockFetchCommitteeGateTemplates(): Promise<
  CommitteeGateTemplate[]
> {
  return Promise.resolve(clone(gateTemplates));
}

export function mockFetchCommitteeUserOptions(
  departmentId: CommitteeId,
  keyword = "",
): Promise<CommitteeUserOption[]> {
  return Promise.resolve(
    clone(
      userOptions
        .filter((item) => String(item.departmentId) === String(departmentId))
        .filter((item) => contains(item.displayName, keyword)),
    ),
  );
}

export function mockSaveCommitteeGateTemplate(
  gateCode: string,
  template: CommitteeGateTemplate,
): Promise<CommitteeGateTemplate> {
  const index = gateTemplates.findIndex((item) => item.gateCode === gateCode);
  const row = clone(template);
  if (index >= 0) gateTemplates[index] = row;
  return Promise.resolve(clone(row));
}

export function mockFetchCommitteeMaterialCategories(): Promise<
  CommitteeMaterialCategory[]
> {
  return Promise.resolve(clone(materialCategories));
}

export function mockCreateCommitteeMaterialCategory(
  data: Omit<CommitteeMaterialCategory, "id">,
): Promise<CommitteeMaterialCategory> {
  const row = { id: nextId("cat"), ...data };
  materialCategories.push(row);
  return Promise.resolve(clone(row));
}

export function mockUpdateCommitteeMaterialCategory(
  categoryId: CommitteeId,
  data: Omit<CommitteeMaterialCategory, "id">,
): Promise<CommitteeMaterialCategory> {
  const index = materialCategories.findIndex(
    (item) => String(item.id) === String(categoryId),
  );
  const row = { id: categoryId, ...data };
  if (index >= 0) materialCategories[index] = row;
  return Promise.resolve(clone(row));
}

export function mockDeleteCommitteeMaterialCategory(
  categoryId: CommitteeId,
): Promise<void> {
  const index = materialCategories.findIndex(
    (item) => String(item.id) === String(categoryId),
  );
  if (index >= 0) materialCategories.splice(index, 1);
  return Promise.resolve();
}

export function mockFetchCommitteeMaterialTemplates(
  categoryId?: CommitteeId,
): Promise<CommitteeMaterialTemplateItem[]> {
  return Promise.resolve(
    clone(
      materialTemplates.filter(
        (item) => !categoryId || String(item.categoryId) === String(categoryId),
      ),
    ),
  );
}

export function mockCreateCommitteeMaterialTemplate(
  categoryId: CommitteeId,
  data: Partial<CommitteeMaterialTemplateItem>,
): Promise<CommitteeMaterialTemplateItem> {
  const row = { id: nextId("mat"), categoryId, ...data };
  materialTemplates.push(row);
  return Promise.resolve(clone(row));
}

export function mockUpdateCommitteeMaterialTemplate(
  categoryId: CommitteeId,
  materialId: CommitteeId,
  data: Partial<CommitteeMaterialTemplateItem>,
): Promise<CommitteeMaterialTemplateItem> {
  const index = materialTemplates.findIndex(
    (item) => String(item.id) === String(materialId),
  );
  const row = { id: materialId, categoryId, ...data };
  if (index >= 0) materialTemplates[index] = row;
  return Promise.resolve(clone(row));
}

export function mockDeleteCommitteeMaterialTemplate(
  materialId: CommitteeId,
): Promise<void> {
  const index = materialTemplates.findIndex(
    (item) => String(item.id) === String(materialId),
  );
  if (index >= 0) materialTemplates.splice(index, 1);
  return Promise.resolve();
}

export function mockDownloadCommitteeAttachment(
  attachmentId: CommitteeId,
): Promise<AxiosResponse<Blob>> {
  const attachment =
    attachments.find((item) => item.id === String(attachmentId)) ??
    attachments[0];
  return Promise.resolve({
    data: new Blob([`Mock file: ${attachment.fileName}`], {
      type: attachment.fileType || "application/octet-stream",
    }),
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as AxiosResponse<Blob>);
}

export function mockFetchCommitteeAttachments(
  bizCode: string,
  bizId: CommitteeId,
): Promise<CommitteeAttachment[]> {
  return Promise.resolve(
    clone(
      attachments.filter(
        (item) =>
          item.bizCode === bizCode && String(item.bizId) === String(bizId),
      ),
    ),
  );
}

export function mockUploadCommitteeAttachment(
  bizCode: string,
  bizId: CommitteeId,
  file: File,
): Promise<CommitteeId> {
  const id = nextId("att");
  attachments = [
    ...attachments,
    {
      id,
      bizCode,
      bizId: String(bizId),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "application/octet-stream",
    },
  ];
  return Promise.resolve(id);
}

export function mockDeleteCommitteeAttachment(
  attachmentId: CommitteeId,
): Promise<void> {
  attachments = attachments.filter((item) => item.id !== String(attachmentId));
  return Promise.resolve();
}

export function mockCreateCommitteeExport(): Promise<{ id: CommitteeId }> {
  return Promise.resolve({ id: nextId("export") });
}

export function mockFetchBusinessValves(params?: {
  pageNo?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
}): Promise<PlatformPageResponse<BusinessValveItem>> {
  const rows = valves.filter((item) =>
    contains(item.valveName, params?.keyword),
  );
  const page = paginate(rows, params);
  return Promise.resolve({
    pageNo: params?.pageNo ?? 1,
    pageSize: params?.pageSize ?? 200,
    records: page.rows,
    total: Number(page.total),
  });
}

export function mockFetchBusinessValveDetail(
  valveId: number | string,
): Promise<BusinessValveDetailItem> {
  const valve =
    valves.find((item) => String(item.valveId) === String(valveId)) ?? valves[0];
  const materials = materialTemplates.slice(0, 2).map((template) => ({
    materialName: template.materialName ?? "",
    materialRequirement: template.materialRequirement ?? null,
    materialType: template.fileType ?? "PDF",
    sourceTemplateId: template.id ?? null,
  }));
  return Promise.resolve(
    clone({
      ...valve,
      gatePurpose: `确认${valve.valveName}阀点是否满足评审条件。`,
      coreWorkContent: "确认阶段交付物、成本收益、质量风险和会后整改要求。",
      materials,
    }),
  );
}

export function mockFetchBusinessValveOptions(): Promise<
  PlatformPageResponse<BusinessValveItem>
> {
  return Promise.resolve({
    pageNo: 1,
    pageSize: valves.length,
    records: clone(valves),
    total: valves.length,
  });
}

export function mockFetchBusinessProjectValves(
  projectId: number,
): Promise<PlatformPageResponse<BusinessProjectValveItem>> {
  const profile =
    projectProfiles.find((item) => item.id === String(projectId)) ??
    projectProfiles[0];
  const records = valves.map<BusinessProjectValveItem>((valve) => ({
    projectValveId: Number(`${projectId}${valve.sortNo}`),
    projectId,
    projectCode: profile.code,
    projectName: profile.name,
    valveId: Number(valve.valveId),
    valveCode: valve.valveCode,
    valveName: valve.valveName,
    plannedPassTime:
      valve.sortNo <= Number(profile.gate.valveId) ? profile.planned : null,
    actualValvePassageTime:
      valve.sortNo < Number(profile.gate.valveId) ? "2026-05-20" : null,
    budgetLocked: false,
    evaluateLocked: false,
    status: "ENABLED",
    remark: valve.remark,
    version: 1,
  }));
  return Promise.resolve({
    pageNo: 1,
    pageSize: records.length,
    records,
    total: records.length,
  });
}

export function mockFetchPlatformDepts(): Promise<PlatformDeptItem[]> {
  return Promise.resolve(clone(platformDeptTree));
}

export function mockFetchPlatformDictItems(
  dictTypeCode: string,
): Promise<PlatformDictItemDetail[]> {
  return Promise.resolve(clone(committeeDictItemMap[dictTypeCode] ?? []));
}
