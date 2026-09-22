import { httpClient, request } from "@/api/http";
import { createIdempotencyKey } from "@/utils/idempotency";
import * as committeeMock from "@/api/mock/committee.mock";
import { isCommitteeMockEnabled } from "@/api/mock/mock-mode";
import type {
  CommitteeConclusion,
  CommitteeAttachment,
  CommitteeConfigDepartment,
  CommitteeDashboard,
  CommitteeGateMeetingHistory,
  CommitteeGateAssignmentSet,
  CommitteeGateTemplate,
  CommitteeId,
  CommitteeMeeting,
  CommitteeMeetingNoticeCommand,
  CommitteeMeetingCreateCommand,
  CommitteeMeetingLevel,
  CommitteeMeetingUpdateCommand,
  CommitteeOpinionSummary,
  CommitteeOpinionSummarySaveResult,
  CommitteePage,
  CommitteeMaterialCategory,
  CommitteeMaterialTemplateItem,
  CommitteeProject,
  CommitteeProjectCandidate,
  CommitteeProjectDetail,
  CommitteeProjectInitPayload,
  CommitteeProjectProfileUpdateCommand,
  CommitteeGateUpsertCommand,
  CommitteeRectification,
  CommitteeReviewContent,
  CommitteeReviewSummary,
  CommitteeReviewNotice,
  CommitteeReplyTopic,
  CommitteeReplyMessage,
  CommitteeReviewRecord,
  CommitteeMeetingReviewRecord,
  CommitteeReviewTask,
  CommitteeUserOption,
  CommitteeParticipantType,
  CommitteeSubtotalWeightedData,
  CommitteeRevenueReviewOpinion,
} from "@/types/committee";

const base = "/committee";
const DEFAULT_REVIEW_CONTENT_REQUEST_TIMEOUT_MS = 300_000;
const configuredReviewContentRequestTimeoutMs = Number(
  import.meta.env.VITE_COMMITTEE_REVIEW_CONTENT_TIMEOUT_MS,
);
const REVIEW_CONTENT_REQUEST_TIMEOUT_MS =
  Number.isFinite(configuredReviewContentRequestTimeoutMs) &&
  configuredReviewContentRequestTimeoutMs > 0
    ? configuredReviewContentRequestTimeoutMs
    : DEFAULT_REVIEW_CONTENT_REQUEST_TIMEOUT_MS;

export function committeeRequestId(): string {
  return createIdempotencyKey();
}

export function fetchCommitteeDashboard() {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeDashboard();
  }
  return request<CommitteeDashboard>({ url: `${base}/dashboard/overview` });
}

export function fetchCommitteeProjects(params: Record<string, unknown>) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeProjects(params);
  }
  return request<CommitteePage<CommitteeProject>>({
    url: `${base}/projects`,
    params,
  });
}

export function fetchCommitteeProject(projectId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeProject(projectId);
  }
  return request<CommitteeProjectDetail>({
    url: `${base}/projects/${projectId}`,
  });
}

export function fetchCommitteeProjectCandidates(params?: {
  company?: string;
  keyword?: string;
  limit?: number;
}) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeProjectCandidates(params);
  }
  return request<CommitteeProjectCandidate[]>({
    url: `${base}/projects/candidates`,
    params,
  });
}

export function fetchCommitteeProjectCompanyOptions() {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeProjectCompanyOptions();
  }
  return request<string[]>({
    url: `${base}/projects/company-options`,
  });
}

export function fetchCommitteeProjectVehicleInvestment(projectId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeProjectVehicleInvestment(projectId);
  }
  return request<{
    amount: string | number;
    sourceType?: string | null;
    sourceRecordId?: number | null;
    sourceVersion?: string | null;
  } | null>({
    url: `${base}/projects/${projectId}/vehicle-investment`,
  });
}

export function initializeCommitteeProject(
  projectId: CommitteeId,
  data: CommitteeProjectInitPayload,
  clientRequestId = committeeRequestId(),
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockInitializeCommitteeProject(projectId, data);
  }
  return request<Record<string, unknown>>({
    url: `${base}/projects/${projectId}/init`,
    method: "post",
    data: {
      totalInvestment: data.totalInvestment,
      vehicleModelInvestment: data.vehicleModelInvestment,
      executionRate: data.executionRate,
      ...(data.projectBackground === undefined
        ? {}
        : { projectBackground: data.projectBackground }),
      ...(data.projectType === undefined || data.projectType === ""
        ? {}
        : { projectType: data.projectType }),
      clientRequestId,
    },
  });
}

export function createCommitteeGate(
  projectId: CommitteeId,
  data: CommitteeGateUpsertCommand,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockCreateCommitteeGate(projectId, data);
  }
  return request<Record<string, unknown>>({
    url: `${base}/projects/${projectId}/gates`,
    method: "post",
    data: buildCommitteeGatePayload(data),
  });
}

function buildCommitteeGatePayload(data: CommitteeGateUpsertCommand) {
  const actualFinishDate = data.actualFinishDate?.trim() || null;
  return {
    projectValveId: Number(data.projectValveId),
    plannedFinishDate: data.plannedFinishDate,
    actualFinishDate,
    gatePurpose: data.gatePurpose,
    coreWorkContent: data.coreWorkContent,
    materials: data.materials.map((material) => ({
      materialName: material.materialName,
      ...(material.materialRequirement === undefined
        ? {}
        : { materialRequirement: material.materialRequirement }),
      ...(material.materialType === undefined
        ? {}
        : { materialType: material.materialType }),
      ...(material.sourceTemplateId === undefined ||
      material.sourceTemplateId === null
        ? {}
        : { sourceTemplateId: Number(material.sourceTemplateId) }),
    })),
    assignments: data.assignments.map((assignment) => ({
      departmentId: Number(assignment.departmentId),
      ...(assignment.applicableStage === undefined
        ? {}
        : { applicableStage: assignment.applicableStage }),
      departmentGroup: assignment.departmentGroup,
      requiredFlag: assignment.requiredFlag,
      headUserIds: assignment.headUserIds,
      reviewerUserIds: assignment.reviewerUserIds.map((userId) =>
        Number(userId),
      ),
    })),
    clientRequestId: data.clientRequestId,
  };
}

export function updateCommitteeGate(
  gateId: CommitteeId,
  data: CommitteeGateUpsertCommand,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockUpdateCommitteeGate(gateId, data);
  }
  return request<Record<string, unknown>>({
    url: `${base}/gates/${gateId}`,
    method: "put",
    data: buildCommitteeGatePayload(data),
  });
}

export function updateCommitteeProjectProfile(
  projectId: CommitteeId,
  data: CommitteeProjectProfileUpdateCommand,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockUpdateCommitteeProjectProfile(projectId, data);
  }
  return request<Record<string, unknown>>({
    url: `${base}/projects/${projectId}/profile`,
    method: "put",
    data: {
      totalInvestment: String(data.totalInvestment),
      vehicleModelInvestment: String(data.vehicleModelInvestment),
      executionRate: String(data.executionRate),
      ...(data.projectBackground === undefined
        ? {}
        : { projectBackground: data.projectBackground }),
      ...(data.projectType === undefined || data.projectType === ""
        ? {}
        : { projectType: data.projectType }),
      clientRequestId: committeeRequestId(),
    },
  });
}

export function fetchCommitteeGateAssignments(gateId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeGateAssignments(gateId);
  }
  return request<CommitteeGateAssignmentSet>({
    url: `${base}/gates/${gateId}/assignments`,
  });
}

export function fetchCommitteeGateMeetings(
  projectId: CommitteeId,
  gateId: CommitteeId,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeGateMeetings(projectId, gateId);
  }
  return request<CommitteeGateMeetingHistory>({
    url: `${base}/projects/${projectId}/gates/${gateId}/meetings`,
  });
}

export function fetchCommitteeReviewSummary(
  gateId: CommitteeId,
  context?: {
    meetingId?: CommitteeId;
    reviewVersionId?: CommitteeId;
    progressOnly?: boolean;
  },
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeReviewSummary(gateId);
  }
  return request<CommitteeReviewSummary>({
    url: `${base}/reviews/gates/${gateId}/summary`,
    params: context,
  });
}

/** 获取集团会议下用于 AI 辅助的部室评审记录。 */
export function fetchCommitteeMeetingReviewRecords(meetingId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return Promise.resolve([] as CommitteeMeetingReviewRecord[]);
  }
  return request<
    | CommitteeMeetingReviewRecord[]
    | {
        records?: CommitteeMeetingReviewRecord[];
        rows?: CommitteeMeetingReviewRecord[];
        data?:
          | CommitteeMeetingReviewRecord[]
          | { records?: CommitteeMeetingReviewRecord[]; rows?: CommitteeMeetingReviewRecord[] };
      }
  >({
    url: `${base}/reviews/meetings/group/${meetingId}/records`,
  }).then((response) => {
    if (Array.isArray(response)) return response;
    if (response.records || response.rows) return response.records ?? response.rows ?? [];
    if (Array.isArray(response.data)) return response.data;
    return response.data?.records ?? response.data?.rows ?? [];
  });
}

export function fetchCommitteeReviewNotices(recordId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeReviewNotices();
  }
  return request<CommitteeReviewNotice[]>({
    url: `${base}/reviews/records/${recordId}/notices`,
  });
}

export function createCommitteeReviewNotice(
  recordId: CommitteeId,
  content: string,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockCreateCommitteeReviewNotice(content);
  }
  return request<CommitteeReviewNotice>({
    url: `${base}/reviews/records/${recordId}/notices`,
    method: "post",
    data: { content, clientRequestId: committeeRequestId() },
  });
}

export function fetchCommitteeReplyTopics(recordId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeReplyTopics();
  }
  return request<CommitteeReplyTopic[]>({
    url: `${base}/reviews/records/${recordId}/reply-topics`,
  });
}

export function createCommitteeReplyTopic(
  recordId: CommitteeId,
  title: string,
  content: string,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockCreateCommitteeReplyTopic(title, content);
  }
  return request<CommitteeReplyTopic>({
    url: `${base}/reviews/records/${recordId}/reply-topics`,
    method: "post",
    data: { title, content, clientRequestId: committeeRequestId() },
  });
}

export function fetchCommitteeReplyMessages(topicId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeReplyMessages(topicId);
  }
  return request<CommitteeReplyMessage[]>({
    url: `${base}/reviews/reply-topics/${topicId}/messages`,
  });
}

export function createCommitteeReplyMessage(
  topicId: CommitteeId,
  content: string,
  replyToMessageId?: CommitteeId,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockCreateCommitteeReplyMessage(
      topicId,
      content,
      replyToMessageId,
    );
  }
  return request<CommitteeReplyMessage>({
    url: `${base}/reviews/reply-topics/${topicId}/messages`,
    method: "post",
    data: { replyToMessageId, content, clientRequestId: committeeRequestId() },
  });
}

export function fetchCommitteeReviewTasks(params: Record<string, unknown>) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeReviewTasks(params);
  }
  return request<CommitteePage<CommitteeReviewTask> | CommitteeReviewTask[]>({
    url: `${base}/reviews/tasks`,
    params,
  });
}

export function fetchCommitteeReviewTask(taskId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeReviewTask(taskId);
  }
  return request<CommitteeReviewTask>({
    url: `${base}/reviews/tasks/${taskId}`,
    timeout: REVIEW_CONTENT_REQUEST_TIMEOUT_MS,
  });
}

export function fetchCommitteeReviewTaskLatestRecord(taskId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeReviewTask(taskId);
  }
  return request<CommitteeReviewTask>({
    url: `${base}/reviews/tasks/${taskId}/latest-record`,
    timeout: REVIEW_CONTENT_REQUEST_TIMEOUT_MS,
  });
}

export function fetchCommitteeReviewRecord(recordId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeReviewRecord(recordId);
  }
  return request<CommitteeReviewRecord>({
    url: `${base}/reviews/records/${recordId}`,
    timeout: REVIEW_CONTENT_REQUEST_TIMEOUT_MS,
  });
}

// 预留会议通知接口，后端路径确定后只需调整此处。
export function sendCommitteeMeetingNotice(
  meetingId: CommitteeId,
  data: CommitteeMeetingNoticeCommand,
) {
  return request<CommitteeReviewNotice>({
    url: `${base}/meetings/${meetingId}/notices`,
    method: "post",
    data: { ...data, clientRequestId: committeeRequestId() },
    skipErrorToast: true,
  });
}

export function fetchCommitteeMeetingNoticeUsers(
  meetingId: CommitteeId,
  keyword = "",
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeUserOptions("", keyword);
  }
  return request<CommitteeUserOption[]>({
    url: `${base}/meetings/${meetingId}/notice-users`,
    params: { keyword: keyword || undefined },
    skipErrorToast: true,
  });
}

export async function fetchCommitteeRevenueReviewSuggestions(
  projectName: string,
  valvePoint: string,
  reviewTaskId: CommitteeId,
) {
  const result = await request<
    | {
        code?: string | number;
        data?: CommitteeRevenueReviewOpinion[] | null;
        message?: string;
      }
    | CommitteeRevenueReviewOpinion[]
  >({
    url: `${base}/revenue/query-suggestions`,
    method: "post",
    data: { projectName, valvePoint, reviewTaskId },
    skipErrorToast: true,
  });

  if (Array.isArray(result)) {
    return result;
  }
  return Array.isArray(result?.data) ? result.data : [];
}

export function saveCommitteeReview(
  taskId: CommitteeId,
  lockVersion: number,
  content: Partial<CommitteeReviewContent>,
  submit: true,
  attachmentIds?: Array<string | number>,
): Promise<CommitteeReviewRecord>;
export function saveCommitteeReview(
  taskId: CommitteeId,
  lockVersion: number,
  content: Partial<CommitteeReviewContent>,
  submit?: false,
  attachmentIds?: Array<string | number>,
): Promise<CommitteeReviewTask>;
export function saveCommitteeReview(
  taskId: CommitteeId,
  lockVersion: number,
  content: Partial<CommitteeReviewContent>,
  submit = false,
  attachmentIds: Array<string | number> = [],
): Promise<CommitteeReviewTask | CommitteeReviewRecord> {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockSaveCommitteeReview(
      taskId,
      lockVersion,
      content,
      submit,
    );
  }
  return request<CommitteeReviewTask | CommitteeReviewRecord>({
    url: `${base}/reviews/tasks/${taskId}/${submit ? "submit" : "draft"}`,
    method: "post",
    timeout: REVIEW_CONTENT_REQUEST_TIMEOUT_MS,
    data: {
      expectedLockVersion: lockVersion,
      content,
      ...(attachmentIds.length ? { attachmentIds } : {}),
      clientRequestId: committeeRequestId(),
    },
  });
}

export function rollbackCommitteeReviewDraft(
  taskId: CommitteeId,
  expectedLockVersion: number,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockRollbackCommitteeReviewDraft(
      taskId,
      expectedLockVersion,
    );
  }
  return request<CommitteeReviewTask>({
    url: `${base}/reviews/tasks/${taskId}/rollback-draft`,
    method: "post",
    data: {
      expectedLockVersion,
      requestId: committeeRequestId(),
    },
  });
}

export function decideCommitteeReview(
  recordId: CommitteeId,
  action: "approve" | "reject",
  expectedLockVersion: number,
  opinion: string,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockDecideCommitteeReview(recordId, action);
  }
  return request<CommitteeReviewTask>({
    url: `${base}/reviews/records/${recordId}/${action}`,
    method: "post",
    data: {
      expectedLockVersion,
      opinion,
      clientRequestId: committeeRequestId(),
    },
  });
}

export function fetchCommitteeMeetings(
  level: CommitteeMeetingLevel,
  params: Record<string, unknown>,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeMeetings(level, params);
  }
  return request<CommitteePage<CommitteeMeeting> | CommitteeMeeting[]>({
    url: `${base}/meetings/${level.toLowerCase()}`,
    params,
  });
}

export function fetchCommitteeMeeting(
  level: CommitteeMeetingLevel,
  meetingId: CommitteeId,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeMeeting(level, meetingId);
  }
  return request<CommitteeMeeting>({
    url: `${base}/meetings/${level.toLowerCase()}/${meetingId}`,
  });
}

export function createCommitteeMeeting(
  level: CommitteeMeetingLevel,
  data: CommitteeMeetingCreateCommand,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockCreateCommitteeMeeting(level, data);
  }
  const command: CommitteeMeetingCreateCommand = {
    projectId: data.projectId,
    ...(data.projectName === undefined
      ? {}
      : { projectName: data.projectName }),
    gateId: data.gateId,
    meetingType: data.meetingType,
    meetingTime: data.meetingTime,
    reviewDeadlineTime: data.reviewDeadlineTime,
    ...(data.meetingLocation === undefined
      ? {}
      : { meetingLocation: data.meetingLocation }),
    ...(data.meetingHost === undefined
      ? {}
      : { meetingHost: data.meetingHost }),
    ...(data.linkedSecondMeetingId === undefined
      ? {}
      : { linkedSecondMeetingId: data.linkedSecondMeetingId }),
    ...(data.linkedSecondConclusionId === undefined
      ? {}
      : { linkedSecondConclusionId: data.linkedSecondConclusionId }),
    ...(data.remark === undefined ? {} : { remark: data.remark }),
  };
  return request<CommitteeMeeting>({
    url: `${base}/meetings/${level.toLowerCase()}`,
    method: "post",
    data: { ...command, clientRequestId: committeeRequestId() },
  });
}

export function updateCommitteeMeeting(
  level: CommitteeMeetingLevel,
  meetingId: CommitteeId,
  data: CommitteeMeetingUpdateCommand,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockUpdateCommitteeMeeting(level, meetingId, data);
  }
  const command: CommitteeMeetingUpdateCommand = {
    expectedLockVersion: data.expectedLockVersion,
    meetingTime: data.meetingTime,
    reviewDeadlineTime: data.reviewDeadlineTime,
    ...(data.meetingLocation === undefined
      ? {}
      : { meetingLocation: data.meetingLocation }),
    ...(data.meetingHost === undefined
      ? {}
      : { meetingHost: data.meetingHost }),
    ...(data.remark === undefined ? {} : { remark: data.remark }),
    ...(data.changeReason === undefined
      ? {}
      : { changeReason: data.changeReason }),
  };
  return request<CommitteeMeeting>({
    url: `${base}/meetings/${level.toLowerCase()}/${meetingId}`,
    method: "put",
    data: { ...command, clientRequestId: committeeRequestId() },
  });
}

export function setCommitteeMeetingLock(
  meetingId: CommitteeId,
  expectedLockVersion: number,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockSetCommitteeMeetingLock(
      meetingId,
      expectedLockVersion,
    );
  }
  return request<CommitteeMeeting>({
    url: `${base}/meetings/${meetingId}/lock`,
    method: "put",
    data: {
      expectedLockVersion,
      locked: true,
      clientRequestId: committeeRequestId(),
    },
  });
}

/** 预留当前阀点过阀锁定接口，待后端接口就绪后直接启用。 */
export function unlockCommitteeMeeting(
  meetingId: CommitteeId,
  expectedLockVersion: number,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockUnlockCommitteeMeeting(
      meetingId,
      expectedLockVersion,
    );
  }
  return request<CommitteeMeeting>({
    url: `${base}/meetings/${meetingId}/unlock`,
    method: "put",
    data: {
      expectedLockVersion,
      clientRequestId: committeeRequestId(),
    },
  });
}

export function lockCommitteeGate(
  gateId: CommitteeId,
  expectedLockVersion: number,
) {
  return request<Record<string, unknown>>({
    url: `${base}/gates/${gateId}/lock`,
    method: "post",
    data: {
      expectedLockVersion,
      clientRequestId: committeeRequestId(),
    },
  });
}

export function deleteCommitteeGate(
  projectId: CommitteeId,
  expectedLockVersion: number,
) {
  return request<Record<string, unknown>>({
    url: `${base}/meetings/group/${projectId}/gate`,
    method: "delete",
    params: { expectedLockVersion },
  });
}

export function fetchCommitteeConclusions(meetingId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeConclusions(meetingId);
  }
  return request<CommitteeConclusion[]>({
    url: `${base}/meetings/${meetingId}/conclusions`,
  });
}

export function fetchCommitteeSnapshots(meetingId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeSnapshots(meetingId);
  }
  return request<Array<Record<string, unknown>>>({
    url: `${base}/meetings/${meetingId}/snapshots`,
  });
}

export function fetchCommitteeSnapshotList(params: Record<string, unknown>) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeSnapshotList(params);
  }
  return request<
    CommitteePage<Record<string, unknown>> | Array<Record<string, unknown>>
  >({
    url: `${base}/snapshots`,
    params,
  });
}

export function fetchCommitteeSnapshot(snapshotId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeSnapshot(snapshotId);
  }
  return request<Record<string, unknown>>({
    url: `${base}/snapshots/${snapshotId}`,
  });
}

export function fetchCommitteeSecondConfirms(meetingId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeSecondConfirms(meetingId);
  }
  return request<Array<Record<string, unknown>>>({
    url: `${base}/meetings/second/${meetingId}/confirms`,
  });
}

export function resetCommitteeSecondConfirm(reviewRecordIds: CommitteeId[]) {
  if (isCommitteeMockEnabled()) {
    return Promise.resolve<Record<string, unknown>>({});
  }
  return request<Record<string, unknown>>({
    url: `${base}/reviews/tasks/second-confirm/reset`,
    method: "post",
    data: { reviewRecordIds },
  });
}

export function decideCommitteeSecondConfirm(
  confirmId: CommitteeId,
  action: "approve" | "reject",
  expectedLockVersion: number,
  opinion: string,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockDecideCommitteeSecondConfirm(confirmId, action);
  }
  return request<Record<string, unknown>>({
    url: `${base}/second-confirms/${confirmId}/${action}`,
    method: "post",
    data: {
      expectedLockVersion,
      opinion,
      clientRequestId: committeeRequestId(),
    },
  });
}

export function saveCommitteeConclusion(
  level: CommitteeMeetingLevel,
  meetingId: CommitteeId,
  data: Record<string, unknown>,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockSaveCommitteeConclusion(meetingId, data);
  }
  const { files, ...conclusionData } = data;
  const formData = new FormData();

  Object.entries({
    ...conclusionData,
    clientRequestId: committeeRequestId(),
  }).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, String(value));
  });

  if (Array.isArray(files)) {
    files.forEach((file) => {
      if (file instanceof File) formData.append("files", file);
    });
  }

  return request<CommitteeConclusion>({
    url: `${base}/meetings/${level.toLowerCase()}/${meetingId}/conclusions`,
    method: "post",
    data: formData,
  });
}

export function decideCommitteeConclusion(
  conclusionId: CommitteeId,
  action: "submit-confirmation" | "confirm" | "reject",
  opinion?: string,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockDecideCommitteeConclusion(
      conclusionId,
      action,
      opinion,
    );
  }
  return request<CommitteeConclusion>({
    url: `${base}/meeting-conclusions/${conclusionId}/${action}`,
    method: "post",
    data: { opinion, clientRequestId: committeeRequestId() },
  });
}

export function fetchGroupMaterial(meetingId: CommitteeId, display = false) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchGroupMaterial(meetingId);
  }
  return request<CommitteeMeeting>({
    url: `${base}/group-materials/${meetingId}${display ? "/display" : ""}`,
  });
}

export async function fetchCommitteeSubtotalWeighted(
  projectName: string,
  valvePoint: string,
) {
  if (
    isCommitteeMockEnabled() ||
    import.meta.env.VITE_COMMITTEE_YELR_MOCK === "true"
  ) {
    return committeeMock.mockFetchCommitteeSubtotalWeighted();
  }
  return request<CommitteeSubtotalWeightedData | null>({
    url: `${base}/revenue/subtotal-weighted`,
    method: "post",
    data: { projectName, valvePoint },
    skipErrorToast: true,
  });
}

export function saveGroupMaterial(
  meetingId: CommitteeId,
  data: Record<string, unknown>,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockSaveGroupMaterial(meetingId, data);
  }
  return request<CommitteeMeeting>({
    url: `${base}/group-materials/${meetingId}`,
    method: "put",
    data: { ...data, clientRequestId: committeeRequestId() },
  });
}

export function refreshGroupMaterialSourceData(
  meetingId: CommitteeId,
  expectedLockVersion: number,
) {
  return request<NonNullable<CommitteeMeeting["material"]>["sourceData"]>({
    url: `${base}/group-materials/${meetingId}/source-data/refresh`,
    method: "post",
    data: { expectedLockVersion, clientRequestId: committeeRequestId() },
  });
}

export function generateGroupMaterialSuggestions(
  meetingId: CommitteeId,
  expectedLockVersion: number,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockGenerateGroupMaterialSuggestions(meetingId);
  }
  void expectedLockVersion;
  return request<CommitteeOpinionSummary>({
    url: `${base}/reviews/meetings/group/${meetingId}/opinion-summary`,
    method: "post",
  });
}

export function summarizeCommitteeOpinions(meetingId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockSummarizeCommitteeOpinions(meetingId);
  }
  return request<CommitteeOpinionSummary>({
    url: `${base}/group-materials/${meetingId}/opinion-summary`,
    method: "post",
  });
}

export function saveCommitteeOpinionSummary(
  meetingId: CommitteeId,
  expectedLockVersion: number,
  clientRequestId = committeeRequestId(),
) {
  return request<CommitteeOpinionSummarySaveResult>({
    url: `${base}/group-materials/${meetingId}/opinion-summary/save`,
    method: "post",
    data: { expectedLockVersion, clientRequestId },
  });
}

export function fetchCommitteeRectifications(params: Record<string, unknown>) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeRectifications(params);
  }
  return request<
    CommitteePage<CommitteeRectification> | CommitteeRectification[]
  >({
    url: `${base}/rectifications`,
    params,
  });
}

export function actOnCommitteeRectification(
  id: CommitteeId,
  action: "submit" | "accept" | "reject",
  data: Record<string, unknown>,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockActOnCommitteeRectification(id, action, data);
  }
  return request<CommitteeRectification>({
    url: `${base}/rectifications/${id}/${action}`,
    method: "post",
    data: { ...data, clientRequestId: committeeRequestId() },
  });
}

export function fetchCommitteeDepartments() {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeDepartments();
  }
  return request<CommitteeConfigDepartment[]>({
    url: `${base}/config/departments`,
  });
}

export function saveCommitteeDepartments(
  departments: CommitteeConfigDepartment[],
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockSaveCommitteeDepartments(departments);
  }
  return request<CommitteeConfigDepartment[]>({
    url: `${base}/config/departments`,
    method: "put",
    data: departments.map((department) => ({
      departmentId: toPositiveNumberId(department.departmentId),
      applicableStage: department.applicableStage,
      requiredByDefault: department.requiredByDefault,
      visibleDeptIds: department.visibleDeptIds
        .map(toPositiveNumberId)
        .filter((id) => id > 0),
      sortNo: Number.isFinite(Number(department.sortNo))
        ? Number(department.sortNo)
        : 0,
      enableFlag: department.enableFlag,
    })),
    headers: { "Idempotency-Key": committeeRequestId() },
  });
}

function toPositiveNumberId(value: CommitteeId) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export function fetchCommitteeGateTemplates() {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeGateTemplates();
  }
  return request<CommitteeGateTemplate[]>({ url: `${base}/config/gates` });
}

export function fetchCommitteeUserOptions(
  departmentId: CommitteeId,
  keyword = "",
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeUserOptions(
      departmentId ?? "",
      keyword,
    );
  }
  return request<CommitteeUserOption[]>({
    url: `${base}/config/users`,
    params: { departmentId, keyword: keyword || undefined },
    skipErrorToast: true,
  });
}

export function fetchCommitteeParticipantUserOptions(
  departmentId: CommitteeId | undefined,
  participantType: CommitteeParticipantType,
  keyword = "",
  projectId?: CommitteeId,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeUserOptions(
      departmentId ?? "",
      keyword,
    );
  }
  return request<CommitteeUserOption[]>({
    url: `${base}/config/participant-users`,
    params: {
      departmentId,
      projectId: participantType === "PROJECT_MEMBER" ? projectId : undefined,
      participantType,
      keyword: keyword || undefined,
    },
    skipErrorToast: true,
  });
}

export function saveCommitteeGateTemplate(
  gateCode: string,
  template: CommitteeGateTemplate,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockSaveCommitteeGateTemplate(gateCode, template);
  }
  return request<CommitteeGateTemplate>({
    url: `${base}/config/gates/${encodeURIComponent(gateCode)}`,
    method: "put",
    data: {
      gateName: template.gateName,
      sequenceNo: template.sequenceNo,
      gatePurpose: template.gatePurpose,
      coreWorkContent: template.coreWorkContent,
      materialTemplateIds: template.materialTemplateIds.map(Number),
      secondTemplateVersionId: template.secondTemplateVersionId,
      secondSchemaHash: template.secondSchemaHash,
      groupTemplateVersionId: template.groupTemplateVersionId,
      groupSchemaHash: template.groupSchemaHash,
      enableFlag: template.enableFlag,
    },
  });
}

export function fetchCommitteeMaterialCategories() {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeMaterialCategories();
  }
  return request<CommitteeMaterialCategory[]>({
    url: `${base}/config/material-categories`,
  });
}

export function createCommitteeMaterialCategory(
  data: Omit<CommitteeMaterialCategory, "id">,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockCreateCommitteeMaterialCategory(data);
  }
  return request<CommitteeMaterialCategory>({
    url: `${base}/config/material-categories`,
    method: "post",
    data,
    headers: { "Idempotency-Key": committeeRequestId() },
  });
}

export function updateCommitteeMaterialCategory(
  categoryId: CommitteeId,
  data: Omit<CommitteeMaterialCategory, "id">,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockUpdateCommitteeMaterialCategory(categoryId, data);
  }
  return request<CommitteeMaterialCategory>({
    url: `${base}/config/material-categories/${categoryId}`,
    method: "put",
    data,
    headers: { "Idempotency-Key": committeeRequestId() },
  });
}

export function deleteCommitteeMaterialCategory(categoryId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockDeleteCommitteeMaterialCategory(categoryId);
  }
  return request<void>({
    url: `${base}/config/material-categories/${categoryId}`,
    method: "delete",
    headers: { "Idempotency-Key": committeeRequestId() },
  });
}

export interface CommitteeMaterialTemplatePageQuery {
  categoryId?: CommitteeId;
  pageNum?: number;
  pageSize?: number;
  orderByColumn?: string;
  isAsc?: string;
}

export function fetchCommitteeMaterialTemplates(categoryId?: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeMaterialTemplates(categoryId);
  }
  return request<CommitteeMaterialTemplateItem[]>({
    url: `${base}/config/materials`,
    params: { categoryId },
  });
}

export function fetchCommitteeMaterialTemplatePage(
  query: CommitteeMaterialTemplatePageQuery,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock
      .mockFetchCommitteeMaterialTemplates(query.categoryId)
      .then((rows) => {
        const pageNum = Math.max(1, query.pageNum ?? 1);
        const pageSize = Math.max(1, query.pageSize ?? 10);
        const start = (pageNum - 1) * pageSize;
        return {
          rows: rows.slice(start, start + pageSize),
          total: rows.length,
        };
      });
  }
  return request<CommitteePage<CommitteeMaterialTemplateItem>>({
    url: `${base}/config/materials/page`,
    params: query,
  });
}

export function createCommitteeMaterialTemplate(
  categoryId: CommitteeId,
  data: Partial<CommitteeMaterialTemplateItem>,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockCreateCommitteeMaterialTemplate(categoryId, data);
  }
  return request<CommitteeMaterialTemplateItem>({
    url: `${base}/config/material-categories/${categoryId}/materials`,
    method: "post",
    data,
    headers: { "Idempotency-Key": committeeRequestId() },
  });
}

export function updateCommitteeMaterialTemplate(
  categoryId: CommitteeId,
  materialId: CommitteeId,
  data: Partial<CommitteeMaterialTemplateItem>,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockUpdateCommitteeMaterialTemplate(
      categoryId,
      materialId,
      data,
    );
  }
  return request<CommitteeMaterialTemplateItem>({
    url: `${base}/config/material-categories/${categoryId}/materials/${materialId}`,
    method: "put",
    data,
    headers: { "Idempotency-Key": committeeRequestId() },
  });
}

export function deleteCommitteeMaterialTemplate(materialId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockDeleteCommitteeMaterialTemplate(materialId);
  }
  return request<void>({
    url: `${base}/config/materials/${materialId}`,
    method: "delete",
    headers: { "Idempotency-Key": committeeRequestId() },
  });
}

export async function downloadCommitteeAttachment(attachmentId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockDownloadCommitteeAttachment(attachmentId);
  }
  return httpClient.get<Blob>(`${base}/attachments/${attachmentId}/download`, {
    responseType: "blob",
  });
}

export function fetchCommitteeAttachments(bizCode: string, bizId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockFetchCommitteeAttachments(bizCode, bizId);
  }
  return request<CommitteeAttachment[]>({
    url: `${base}/attachments/${encodeURIComponent(bizCode)}/${bizId}`,
  });
}

export function uploadCommitteeAttachment(
  bizCode: string,
  bizId: CommitteeId,
  file: File,
) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockUploadCommitteeAttachment(bizCode, bizId, file);
  }
  const data = new FormData();
  data.append("file", file);
  return request<CommitteeId>({
    url: `${base}/attachments/${encodeURIComponent(bizCode)}/${bizId}`,
    method: "post",
    data,
  });
}

export interface CommitteeRichTextAttachment {
  attachmentId: CommitteeId;
  fileName?: string;
  url: string;
}

/** Upload an image used by rich-text content. */
export function uploadCommitteeRichTextAttachment(file: File) {
  const data = new FormData();
  data.append("file", file);
  return request<CommitteeRichTextAttachment>({
    url: `${base}/attachments/rich-text`,
    method: "post",
    data,
  });
}

export function deleteCommitteeAttachment(attachmentId: CommitteeId) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockDeleteCommitteeAttachment(attachmentId);
  }
  return request<void>({
    url: `${base}/attachments/${attachmentId}`,
    method: "delete",
  });
}

export function createCommitteeExport(data: Record<string, unknown>) {
  if (isCommitteeMockEnabled()) {
    return committeeMock.mockCreateCommitteeExport();
  }
  return request<{ id: CommitteeId }>({
    url: `${base}/exports`,
    method: "post",
    data: { ...data, clientRequestId: committeeRequestId() },
  });
}
