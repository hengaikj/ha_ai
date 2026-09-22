export type CommitteeId = string;
export type CommitteeSignal = "EMPTY" | "GREEN" | "YELLOW" | "RED";
export type CommitteeMeetingLevel = "SECOND" | "GROUP";

export interface CommitteePage<T> {
  rows: T[];
  total: number | string;
}

export interface CommitteeDashboard {
  projectCount: number;
  inProgressProjectCount: number;
  pendingHeadApprovalCount: number;
  secondMeetingPreparationCount: number;
  groupMeetingPreparationCount: number;
  todos: CommitteeReviewTask[];
  recentActivities: Array<Record<string, unknown>>;
  navigationFilters: Record<string, Record<string, string>>;
}

export interface CommitteeProject {
  id?: CommitteeId;
  projectId: CommitteeId;
  projectName: string;
  brandName?: string | null;
  owningCompany?: string | null;
  projectCategory?: string | null;
  factoryName?: string | null;
  currentGateId?: CommitteeId;
  currentGateName?: string;
  plannedFinishDate?: string;
  gateStatus?: string;
  committeeStatus: string;
  secondMeetingConclusion?: string;
  groupMeetingConclusion?: string;
  createBy?: string | null;
  createName?: string | null;
  creator?: string | null;
  createTime?: string | null;
  [key: string]: unknown;
}

export interface CommitteeProjectInitPayload {
  totalInvestment: number;
  vehicleModelInvestment: number;
  executionRate: number;
  projectBackground?: string;
  /** 字典 committee_project_type 的值 */
  projectType?: string;
}

export interface CommitteeProjectProfileUpdateCommand {
  totalInvestment: number | string;
  vehicleModelInvestment: number | string;
  executionRate: number | string;
  projectBackground?: string;
  /** 字典 committee_project_type 的值 */
  projectType?: string;
}

export interface CommitteeGateMaterialCommand {
  materialName: string;
  materialRequirement?: string;
  materialType?: string;
  sourceTemplateId?: number | null;
}

export interface CommitteeGateAssignmentCommand {
  departmentId: number;
  applicableStage?: string;
  departmentGroup: string;
  requiredFlag: "0" | "1";
  headUserIds: CommitteeId[];
  reviewerUserIds: number[];
}

export interface CommitteeGateUpsertCommand {
  projectValveId: number;
  plannedFinishDate: string;
  actualFinishDate?: string;
  gatePurpose: string;
  coreWorkContent: string;
  materials: CommitteeGateMaterialCommand[];
  assignments: CommitteeGateAssignmentCommand[];
  clientRequestId: string;
}

export interface CommitteeProjectCandidate {
  projectId: number;
  wbsNumber?: string | null;
  projectName: string;
  brandName?: string | null;
  projectCategory?: string | null;
  company?: string | null;
  factoryCode?: string | null;
  factoryName?: string | null;
  /** @deprecated Use factoryName and factoryCode. */
  factory?: string | null;
  brandPatternAttachmentId?: CommitteeId | number | null;
  brandPatternFileName?: string | null;
  brandPatternFileUrl?: string | null;
}

export interface CommitteeProjectDetailProject {
  id: CommitteeId;
  projectId: CommitteeId;
  projectCode?: string | null;
  projectName: string;
  owningCompany?: string | null;
  brand?: string | null;
  brandName?: string | null;
  brandPatternAttachmentId?: CommitteeId | number | null;
  brandPatternFileName?: string | null;
  brandPatternFileUrl?: string | null;
  projectCategory?: string | null;
  /** 字典 committee_project_type 的值 */
  projectType?: string | null;
  factoryCode?: string | null;
  factoryName?: string | null;
  /** @deprecated Use factoryName and factoryCode. */
  productionBase?: string | null;
  totalInvestment?: number | null;
  vehicleModelInvestment?: number | null;
  executionRate?: number | null;
  projectBackground?: string | null;
  currentGateId?: CommitteeId | null;
  committeeStatus: string;
}

export interface CommitteeGate {
  id: CommitteeId;
  projectId: CommitteeId;
  projectValveId: CommitteeId;
  valveId: CommitteeId;
  projectName: string;
  gateCode: string;
  gateName: string;
  sequenceNo: number;
  plannedFinishDate?: string | null;
  actualFinishDate?: string | null;
  gatePurpose?: string | null;
  coreWorkContent?: string | null;
  gateStatus: string;
  isCurrent: "0" | "1";
  previousGateId?: CommitteeId | null;
  finalConclusion?: string | null;
  finalConclusionTime?: string | null;
  lockVersion: number;
  materials?: CommitteeGateMaterial[];
}

export interface CommitteeGateMaterial {
  id: CommitteeId;
  gateId: CommitteeId;
  materialName: string;
  materialRequirement?: string | null;
  materialType?: string | null;
  sourceTemplateId?: CommitteeId | null;
  sortNo: number;
}

export interface CommitteeGateAssignment {
  id: CommitteeId;
  gateId: CommitteeId;
  departmentId: CommitteeId;
  departmentName: string;
  departmentGroup: string;
  headUserName?: string | null;
  requiredFlag: "0" | "1";
  sortNo: number;
}

export interface CommitteeGateAssignmentReviewer {
  id: CommitteeId;
  assignmentId: CommitteeId;
  gateId: CommitteeId;
  departmentId: CommitteeId;
  reviewerUserName: string;
  sortNo: number;
}

export interface CommitteeProjectDetail {
  project: CommitteeProjectDetailProject;
  currentGate: CommitteeGate | null;
  materials: CommitteeGateMaterial[];
  assignments: CommitteeGateAssignment[];
  reviewers: CommitteeGateAssignmentReviewer[];
  gateHistory: CommitteeGate[];
}

export interface CommitteeGateAssignmentSet {
  gateId: CommitteeId;
  assignments: CommitteeGateAssignment[];
  reviewers: CommitteeGateAssignmentReviewer[];
}

export interface CommitteeReviewContent {
  contentText: string;
  techSignal: CommitteeSignal;
  revenueSignal: CommitteeSignal;
  volumePriceSignal: CommitteeSignal;
  competitivenessSignal: CommitteeSignal;
  qualitySignal: CommitteeSignal;
  conclusionSignal: CommitteeSignal;
  headUsers?: CommitteeReviewParticipant[];
  noticeUsers?: CommitteeReviewParticipant[];
  projectMembers?: CommitteeReviewParticipant[];
}

export interface CommitteeReviewParticipant {
  userId: CommitteeId;
  displayName?: string;
  departmentId?: CommitteeId;
}

export interface CommitteeReviewMeetingDetail {
  id: CommitteeId;
  meetingTitle: string;
  meetingName: string;
  meetingTime?: string;
  conclusionLabel?: string;
  conclusionDecision?: string;
  meetingConclusionDecision?: string;
  decisionItems?: string;
  attachments?: CommitteeAttachment[];
}

export interface CommitteeReviewRecord {
  id: CommitteeId;
  reviewTaskId?: CommitteeId;
  reviewerUserName?: string | null;
  reviewVersionNo?: number | null;
  finalDepartmentOpinion?: string | null;
  versionNo: number;
  recordStatus: string;
  approvalAction?: string;
  content?: CommitteeReviewContent | null;
  submitterName: string;
  submitTime: string;
  approvalTime?: string;
  approveTime?: string;
  auditTime?: string;
  reviewTime?: string;
  headApproveTime?: string;
  approverName?: string;
  auditOpinion?: string;
  approvalOpinion?: string;
  rejectReason?: string;
  submitModeLabel?: string;
  auditModeLabel?: string;
  meetingName?: string;
  meetingTime?: string;
  meetingConclusionLabel?: string;
  meetingDecisionItems?: string;
  meetingAttachments?: CommitteeAttachment[];
  meetingDetails?: CommitteeReviewMeetingDetail[];
  attachments?: CommitteeAttachment[];
  lockVersion?: number;
}

/** 集团会议下的评审记录，接口同时返回部室维度信息。 */
export interface CommitteeMeetingReviewRecord extends CommitteeReviewRecord {
  departmentId: CommitteeId;
  departmentName: string;
  taskId?: CommitteeId;
  requiredFlag?: "0" | "1";
  taskStatus?: string;
  secondConfirmStatus?: string | null;
  conclusionSignal?: CommitteeSignal | string | null;
  hasFormalVersion?: boolean;
  canViewDetail?: boolean;
  updateTime?: string;
}

export interface CommitteeReviewTask {
  id: CommitteeId;
  projectId: CommitteeId;
  projectName?: string | null;
  owningCompany?: string | null;
  companyName?: string | null;
  gateId: CommitteeId;
  gateName?: string | null;
  reviewVersionId?: CommitteeId;
  departmentId: CommitteeId;
  departmentName: string;
  departmentGroup: string;
  reviewerUserId?: CommitteeId;
  reviewerUserName: string;
  headUserName: string;
  reviewStage: string;
  taskStatus: string;
  secondConfirmStatus?: string | null;
  draft?: Partial<CommitteeReviewContent>;
  currentRecord?: CommitteeReviewRecord;
  currentRecordId?: CommitteeId;
  currentVersionNo?: number;
  lockVersion: number;
  updateTime?: string;
  records?: CommitteeReviewRecord[];
}

export interface CommitteeRevenueReviewOpinion {
  reviewId: CommitteeId;
  node: string;
  department: string;
  submitterName: string;
  opinionContent: string;
  opinionResult: string;
  submittedTime: string;
}

export interface CommitteeReviewSummary {
  gateId: CommitteeId;
  companyName?: string | null;
  requiredCount: number;
  notSubmittedCount?: number;
  pendingApprovalCount?: number;
  approvedCount: number;
  waitingMeetingCount?: number;
  archivedCount?: number;
  pendingCount: number;
  rejectedCount: number;
  groups: Array<{
    departmentGroup: string;
    departments: Array<{
      taskId?: CommitteeId;
      departmentId: CommitteeId;
      departmentName: string;
      requiredFlag: "0" | "1";
      taskStatus: string;
      conclusionSignal?: CommitteeSignal | string | null;
      secondConfirmStatus?: string | null;
      currentVersionNo?: number;
      hasFormalVersion?: boolean;
      canViewDetail?: boolean;
      updateTime?: string;
      currentRecord?: CommitteeReviewRecord;
    }>;
  }>;
}

export interface CommitteeReviewNotice {
  id: CommitteeId;
  noticeUserName: string;
  noticeDeptName?: string;
  noticeContent: string;
  handleStatus: string;
  noticeTime: string;
}

export interface CommitteeMeetingNoticeCommand {
  recipients: string[];
  content: string;
}

export interface CommitteeReplyTopic {
  id: CommitteeId;
  topicTitle: string;
  topicContent?: string;
  starterName: string;
  lastReplyTime?: string;
  replyCount: number;
}

export interface CommitteeReplyMessage {
  id: CommitteeId;
  topicId: CommitteeId;
  replyToMessageId?: CommitteeId;
  replyUserName: string;
  replyContent: string;
  replyTime: string;
}

export interface CommitteeAttachment {
  id: CommitteeId;
  bizCode: string;
  bizId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl?: string | null;
  uploadedAt?: string | null;
}

export interface CommitteeMaterialTemplateItem {
  id?: CommitteeId;
  categoryId?: CommitteeId;
  key?: string;
  label?: string;
  materialName?: string;
  materialRequirement?: string | null;
  requirement?: string | null;
  categoryKey?: string;
  attachmentId?: CommitteeId | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileType?: string | null;
  sortNo?: number | null;
  enableFlag?: "0" | "1";
}

export interface CommitteeMaterialCategory {
  id?: CommitteeId;
  categoryCode: string;
  categoryName: string;
  categoryDesc?: string | null;
  sortNo: number;
  enableFlag: "0" | "1";
}

export interface CommitteeUserOption {
  userId: CommitteeId;
  displayName: string;
  departmentId: CommitteeId;
  departmentName?: string | null;
}

export type CommitteeParticipantType =
  | "HEAD"
  | "REVIEWER"
  | "NOTICE"
  | "PROJECT_MEMBER";

export interface CommitteeMeeting {
  id: CommitteeId;
  meetingName: string;
  meetingLevel: CommitteeMeetingLevel;
  meetingType: "PRODUCT_COMMITTEE" | "GATE_REVIEW";
  projectId: CommitteeId;
  projectName: string;
  companyName?: string | null;
  owningCompany?: string | null;
  gateId: CommitteeId;
  gateName: string;
  /** 会议关联阀点状态字典值；空值或未知值表示未关联 */
  valveStatus?: string | null;
  attemptNo: number;
  meetingTime: string;
  reviewDeadlineTime: string;
  createBy?: string | null;
  createTime?: string | null;
  meetingLocation?: string;
  meetingHost?: string | null;
  remark?: string;
  conclusionText?: string | null;
  meetingStatus: string;
  linkedSecondMeetingId?: CommitteeId;
  linkedSecondConclusionId?: CommitteeId | null;
  linkedSecondMeetingName?: string;
  linkedSecondMeetingTime?: string;
  linkedSecondMeetingConclusion?: string;
  linkedSecondMeetings?: CommitteeLinkedSecondMeeting[];
  currentSnapshotId?: CommitteeId;
  currentConclusionId?: CommitteeId;
  currentConclusionDecision?: string;
  secondReviewCompletedCount?: number;
  secondReviewTotalCount?: number;
  groupReviewCompletedCount?: number;
  groupReviewTotalCount?: number;
  lockVersion: number;
  materialId?: CommitteeId;
  materialStatus?: string;
  materialLockVersion?: number;
  material?: CommitteeMaterial;
  display?: CommitteeGroupMaterialDisplay;
  createName?: string | null;
  creator?: string | null;
}

export interface CommitteeLinkedSecondMeeting {
  id: CommitteeId;
  attemptNo: number;
  meetingTime?: string;
  conclusionLabel?: string;
  decisionItems?: string;
}

export interface CommitteeGroupMaterialDisplay {
  cover?: {
    coverTitle?: string | null;
    reportDepartment?: string | null;
    projectName?: string | null;
    gateName?: string | null;
    meetingTime?: string | null;
    reviewDeadlineTime?: string | null;
    meetingLocation?: string | null;
  } | null;
  productSpectrum?: Array<{
    id?: CommitteeId | number | null;
    productLine?: string | null;
    model?: string | null;
    brandName?: string | null;
    base?: string | null;
    msrp?: string | number | null;
    status?: string | null;
    brandPatternAttachmentId?: CommitteeId | number | null;
    brandPatternFileName?: string | null;
    brandPatternFileUrl?: string | null;
    yearValues?: Record<string, string | number | null> | null;
  }>;
  projectOverview?: {
    projectId?: CommitteeId | number | null;
    vehicleModelId?: CommitteeId | number | null;
    projectCode?: string | null;
    projectName?: string | null;
    brand?: string | null;
    brandName?: string | null;
    projectCategory?: string | null;
    productionBase?: string | null;
    owningCompany?: string | null;
    totalInvestment?: string | number | null;
    vehicleInvestment?: string | number | null;
    executionRate?: string | number | null;
    projectBackground?: string | null;
    /** 展示用标签（字典 committee_project_type） */
    projectType?: string | null;
  } | null;
  gateInfo?: {
    gateId?: CommitteeId | number | null;
    valveId?: CommitteeId | number | null;
    gateCode?: string | null;
    gateName?: string | null;
    gatePurpose?: string | null;
    coreWorkContent?: string | null;
    gateStatus?: string | null;
    plannedFinishDate?: string | null;
    actualFinishDate?: string | null;
  } | null;
  gateProgress?: {
    overallProgress?: string | number | null;
    currentGateId?: CommitteeId | number | null;
    currentGateName?: string | null;
    plannedFinishDate?: string | null;
    gates?: Array<{
      gateId?: CommitteeId | number | null;
      gateCode?: string | null;
      gateName?: string | null;
      sequenceNo?: string | number | null;
      plannedFinishDate?: string | null;
      actualFinishDate?: string | null;
      gateStatus?: string | null;
      current?: boolean | null;
    }>;
  } | null;
  previousGate?: {
    gateId?: CommitteeId | number | null;
    gateCode?: string | null;
    gateName?: string | null;
    finalConclusion?: string | null;
    finalConclusionTime?: string | null;
    requirements?: {
      visible?: boolean | null;
      titles?: {
        requirement?: string | null;
        completion?: string | null;
      } | null;
      rows?: Array<{
        id?: string | null;
        requirement?: string | null;
        completion?: string | null;
      }>;
    } | null;
  } | null;
  deliverables?: Array<{
    id?: CommitteeId | number | null;
    gateId?: CommitteeId | number | null;
    materialName?: string | null;
    materialRequirement?: string | null;
    materialType?: string | null;
    sourceTemplateId?: CommitteeId | number | null;
    sortNo?: string | number | null;
  }>;
  reviewMatrix?: {
    groups?: Array<{
      departmentGroup?: string | null;
      departments?: Array<{
        taskId?: CommitteeId | number | null;
        departmentId?: CommitteeId | number | null;
        departmentName?: string | null;
        departmentGroup?: string | null;
        taskStatus?: string | null;
        reviewRecordId?: CommitteeId | number | null;
        versionNo?: string | number | null;
        opinionText?: string | null;
        techSignal?: CommitteeSignal | string | null;
        revenueSignal?: CommitteeSignal | string | null;
        volumePriceSignal?: CommitteeSignal | string | null;
        competitivenessSignal?: CommitteeSignal | string | null;
        qualitySignal?: CommitteeSignal | string | null;
        conclusionSignal?: CommitteeSignal | string | null;
      }>;
    }>;
  } | null;
  reviewBlocks?: Array<{
    id?: string | null;
    kind?: "quality" | "cost" | "revenue" | "custom" | string | null;
    title?: string | null;
    content?: string | null;
  }>;
  qualityIssues?: Array<{
    id?: string | null;
    title?: string | null;
    issue?: string | null;
    action?: string | null;
    ownerDepartment?: string | null;
    dueDate?: string | null;
  }>;
  cost?: {
    points?: Array<
      | string
      | {
          id?: string | null;
          label?: string | null;
          value?: string | number | null;
        }
    >;
    forecastNodes?: Array<{
      id?: string | null;
      label?: string | null;
      value?: string | number | null;
    }>;
    targetCost?: string | number | null;
    currentActualCost?: string | number | null;
    vehicleInvestment?: string | number | null;
    costVersionId?: CommitteeId | number | null;
    costVersion?: string | null;
    asOfTime?: string | null;
  } | null;
  revenue?: {
    points?: Array<
      | string
      | {
          id?: string | null;
          label?: string | null;
          value?: string | number | null;
        }
    >;
    forecastGroups?: Array<{
      id?: string | null;
      label?: string | null;
      margin?: string | number | null;
      profit?: string | number | null;
      metrics?: Record<string, string | number | null> | null;
    }>;
    supplementMetrics?: Array<{
      id?: string | null;
      label?: string | null;
      value?: string | number | null;
    }>;
    contributionMargin?: string | number | null;
    operatingProfit?: string | number | null;
    marketGuidePriceTaxIncluded?: string | number | null;
    tpPriceTaxIncluded?: string | number | null;
    materialCost?: string | number | null;
    variableManufacturingExpense?: string | number | null;
    variableSellingExpense?: string | number | null;
    revenueFlowId?: CommitteeId | number | null;
    revenueRecordIds?: Record<string, CommitteeId | number> | null;
  } | null;
  decision?: {
    requestedDecision?: string | null;
    currentDecision?: string | null;
    conclusionText?: string | null;
  } | null;
  attachments?: CommitteeAttachment[];
  meta?: {
    generatedAt?: string | null;
    dataStatus?: "COMPLETE" | "PARTIAL" | string | null;
    warnings?: Array<{
      section?: string | null;
      code?: string | null;
      message?: string | null;
    }>;
  } | null;
}

export interface CommitteeAiSuggestions {
  qualitySuggestion: string;
  costSuggestion: string;
  revenueSuggestion: string;
}

export interface CommitteeOpinionDepartmentSummary {
  departmentId: CommitteeId;
  department_id?: CommitteeId;
  department: string;
  polarity?: string | null;
  opinion: string | string[];
  opinionUrl?: string | null;
  opinion_url?: string | null;
  opinionSummary?: string | null;
  inputType?: string | null;
  error?: string | null;
  warning?: string | null;
}

export interface CommitteeOpinionSummary {
  success: boolean;
  projects: Array<{
    projectId: CommitteeId;
    project_id?: CommitteeId;
    projectName?: string | null;
    gatePoints: Array<{
      gatePointId: CommitteeId;
      gate_point_id?: CommitteeId;
      gatePointName?: string | null;
      gate_point_name?: string | null;
      departments: CommitteeOpinionDepartmentSummary[];
    }>;
    gate_points?: Array<{
      gate_point_id?: CommitteeId;
      gate_point_name?: string | null;
      departments: CommitteeOpinionDepartmentSummary[];
    }>;
  }>;
  projectCount: number;
  gatePointCount: number;
  departmentCount: number;
  positiveCount: number;
  negativeCount: number;
  processingMs: number;
  llmProfile?: string | null;
  modelName?: string | null;
  warning?: string | null;
}

export interface CommitteeOpinionSummarySourceReview {
  departmentId: CommitteeId;
  reviewTaskId: CommitteeId;
  reviewRecordId: CommitteeId;
  versionNo: number;
}

export interface CommitteeOpinionSummarySnapshot {
  snapshotVersion: number;
  generatedAt: string;
  generatedByUserId: CommitteeId;
  generatedByName: string;
  sourceMaterialLockVersion: number;
  sourceReviews: CommitteeOpinionSummarySourceReview[];
  result: CommitteeOpinionSummary;
}

export interface CommitteeOpinionSummarySaveResult {
  materialLockVersion: number;
  snapshot: CommitteeOpinionSummarySnapshot;
}

export interface CommitteeGateMeetingHistory {
  second: CommitteeMeeting[];
  group: CommitteeMeeting[];
}

export interface CommitteeMeetingCreateCommand {
  projectId: CommitteeId;
  projectName?: string;
  gateId: CommitteeId;
  meetingType: "PRODUCT_COMMITTEE" | "GATE_REVIEW";
  meetingTime: string;
  reviewDeadlineTime: string;
  meetingLocation?: string;
  meetingHost?: string;
  linkedSecondMeetingId?: CommitteeId;
  linkedSecondConclusionId?: CommitteeId;
  remark?: string;
}

export interface CommitteeMeetingUpdateCommand {
  expectedLockVersion: number;
  meetingTime: string;
  reviewDeadlineTime: string;
  meetingLocation?: string;
  meetingHost?: string;
  remark?: string;
  changeReason?: string;
}

export interface CommitteeMaterial {
  coverTitle?: string;
  reportDepartment?: string;
  executiveSummary?: string;
  previousGateRequirements?: string;
  deliveryReview?: string;
  decisionText?: string;
  costPoints?: string;
  costForecastNodes?: string;
  costForecastRemark?: string;
  revenuePoints?: string;
  revenueForecastGroups?: string;
  revenueForecastRemark?: string;
  revenueSupplementMetrics?: string;
  reviewBlocks?: string;
  qualityIssues?: string;
  aiQualitySuggestion?: string;
  aiCostSuggestion?: string;
  aiRevenueSuggestion?: string;
  sourceData?: CommitteeMaterialSourceData;
  opinionSummarySnapshot?: CommitteeOpinionSummarySnapshot;
}

export interface CommitteeMaterialSourceData {
  vehicleInvestment?: string;
  vehicleInvestmentSource?: string;
  vehicleInvestmentSourceRecordId?: CommitteeId;
  vehicleInvestmentVersion?: string;
  targetCost?: string;
  currentActualCost?: string;
  contributionMargin?: string;
  operatingProfit?: string;
  marketGuidePriceTaxIncluded?: string;
  tpPriceTaxIncluded?: string;
  materialCost?: string;
  variableManufacturingExpense?: string;
  variableSellingExpense?: string;
  costVersionId?: CommitteeId;
  costVersion?: string;
  revenueFlowId?: CommitteeId;
  revenueRecordIds?: Record<string, CommitteeId>;
  s8Url?: string;
  asOfTime?: string;
  refreshedAt?: string;
  sourceStatus: "COMPLETE" | "PARTIAL";
  missingFields?: string[];
}

export interface CommitteeSubtotalWeightedData {
  bg?: string | number | null;
  yelr?: string | number | null;
  /** @deprecated Some older responses use the misspelled `yell` field. */
  yell?: string | number | null;
  zdPrice?: string | number | null;
  tpPrice?: string | number | null;
  clPrice?: string | number | null;
  bdzzPrice?: string | number | null;
  bdxsPrice?: string | number | null;
  s8Url?: string | null;
}

export interface CommitteeConclusion {
  id: CommitteeId;
  meetingId: CommitteeId;
  snapshotId: CommitteeId;
  conclusionVersion: number;
  conclusionStatus: string;
  decision: string;
  conclusionText: string;
  followUps: string[];
  operatorUserId: CommitteeId;
  operatorName: string;
  generatedTime: string;
  confirmedByName?: string;
  confirmedTime?: string;
  rejectionReason?: string;
}

export interface CommitteeRectification {
  id: CommitteeId;
  projectId: CommitteeId;
  projectName?: string;
  gateId: CommitteeId;
  requirementText?: string;
  responsibleDeptName?: string;
  responsibleUserName?: string;
  responsibleUserId?: CommitteeId;
  expectedFinishDate: string;
  rectificationStatus: string;
  completionText?: string;
  overdue?: boolean;
  isOverdue?: boolean;
  lockVersion: number;
  [key: string]: unknown;
}

export interface CommitteeConfigDepartment {
  departmentId: CommitteeId;
  departmentName?: string;
  applicableStage: string;
  requiredByDefault: "0" | "1";
  visibleDeptIds: CommitteeId[];
  sortNo: number;
  enableFlag: "0" | "1";
}

export interface CommitteeGateTemplate {
  id: CommitteeId;
  gateCode: string;
  gateName: string;
  sequenceNo: number;
  gatePurpose?: string;
  coreWorkContent?: string;
  materialTemplateIds: CommitteeId[];
  secondTemplateVersionId?: CommitteeId;
  secondSchemaHash?: string;
  groupTemplateVersionId?: CommitteeId;
  groupSchemaHash?: string;
  enableFlag: "0" | "1";
}
