<script setup lang="ts">
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { Back } from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchCommitteeConclusions,
  fetchCommitteeGateMeetings,
  fetchCommitteeProject,
  fetchCommitteeReviewSummary,
  deleteCommitteeGate,
  lockCommitteeGate,
} from "@/api/committee";
import { ApiBusinessError } from "@/api/http";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BaseMoney from "@/components/base/BaseMoney.vue";
import BasePercent from "@/components/base/BasePercent.vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import { BaseToast } from "@/components/base/BaseToast";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import type {
  CommitteeConclusion,
  CommitteeGateMeetingHistory,
  CommitteeMeeting,
  CommitteeProjectDetail,
  CommitteeReviewSummary,
} from "@/types/committee";
import { committeeStatusLabel, committeeTagType } from "./committee-ui";
import CommitteeTimeBoard from "./components/CommitteeTimeBoard.vue";
import { fetchPlatformDictItems } from "@/api/platform-system";
import type { SchemaOption } from "@/types/schema-components";

const route = useRoute();
const router = useRouter();
const projectId = computed(() => {
  const value = route.params.projectId;
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized === undefined || normalized === null
    ? ""
    : String(normalized).trim();
});
const loading = ref(false);
const detail = ref<CommitteeProjectDetail | null>(null);
const reviewSummary = ref<CommitteeReviewSummary | null>(null);
const progressReviewSummary = ref<CommitteeReviewSummary | null>(null);
const gateMeetings = ref<CommitteeGateMeetingHistory>({
  second: [],
  group: [],
});
const historyGateMeetings = ref<Record<string, CommitteeGateMeetingHistory>>(
  {},
);
const historyGateMeetingLoading = ref<Record<string, boolean>>({});
const historyGateMeetingErrors = ref<Record<string, ErrorInfo>>({});
const conclusions = ref<CommitteeConclusion[]>([]);
const meetingStatusOptions = ref<SchemaOption[]>([]);
const conclusionStatusOptions = ref<SchemaOption[]>([]);
const reviewStatusOptions = ref<SchemaOption[]>([]);
const approvalResultOptions = ref<SchemaOption[]>([]);
const secondConfirmStatusOptions = ref<SchemaOption[]>([]);
const historyExpanded = ref(false);
const expandedHistoryGateId = ref<string | null>(null);
const materialDialogVisible = ref(false);
const selectedMaterialGateId = ref<string | null>(null);
const reviewerDialogVisible = ref(false);
const previewVisible = ref(false);
const previewUrl = ref("");
const previewTitle = ref("");
const timeBoardRef = ref<InstanceType<typeof CommitteeTimeBoard> | null>(null);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const gateLocking = ref(false);
type ErrorInfo = { code: string; message: string; traceId?: string };
const detailError = ref<ErrorInfo>();
const reviewError = ref<ErrorInfo>();
const meetingError = ref<ErrorInfo>();
const conclusionError = ref<ErrorInfo>();
const previewError = ref<ErrorInfo>();
let loadRequestId = 0;
let _previewRequestId = 0;
let unmounted = false;

const project = computed(() => detail.value?.project ?? null);
const brandPatternPreviewUrl = computed(() =>
  resolveResourceUrl(project.value?.brandPatternFileUrl),
);
const currentGate = computed(() => detail.value?.currentGate ?? null);
const gateHistory = computed(() =>
  (detail.value?.gateHistory ?? []).filter((gate) => {
    const isCurrent =
      gate.id === currentGate.value?.id ||
      gate.isCurrent === "1" ||
      gate.id === project.value?.currentGateId;
    const hasPassed =
      gate.gateStatus === "PASSED" ||
      ["PASS", "CONDITIONAL_PASS"].includes(String(gate.finalConclusion ?? ""));
    return !isCurrent && hasPassed;
  }),
);
const materials = computed(() => detail.value?.materials ?? []);
const materialDialogGate = computed(() => {
  const selectedGateId = selectedMaterialGateId.value;
  if (!selectedGateId || selectedGateId === currentGate.value?.id) {
    return currentGate.value;
  }
  return gateHistory.value.find((gate) => gate.id === selectedGateId) ?? null;
});
const materialDialogMaterials = computed(() => {
  const gate = materialDialogGate.value;
  if (!gate) return [];
  return gate.id === currentGate.value?.id
    ? materials.value
    : (gate.materials ?? []);
});
const assignments = computed(() => detail.value?.assignments ?? []);
const reviewers = computed(() => detail.value?.reviewers ?? []);
const conclusionMap = computed<Record<string, string>>(() => {
  const latestByMeeting = new Map<string, CommitteeConclusion>();
  conclusions.value.forEach((row) => {
    const current = latestByMeeting.get(row.meetingId);
    if (!current || row.conclusionVersion > current.conclusionVersion) {
      latestByMeeting.set(row.meetingId, row);
    }
  });
  return Object.fromEntries(
    [...latestByMeeting].map(([meetingId, row]) => [meetingId, row.decision]),
  );
});
const reviewProgressGroups = computed(() =>
  [
    {
      key: "second",
      label: "品牌公司",
      departmentGroup: "SECOND_COMPANY",
    },
    { key: "group", label: "集团部室", departmentGroup: "GROUP" },
  ].map((group) => {
    const departments =
      reviewSummary.value?.groups
        .find((item) => item.departmentGroup === group.departmentGroup)
        ?.departments.filter((department) => department.requiredFlag === "1") ??
      [];
    const completed = departments.filter((department) =>
      ["APPROVED", "WAITING_MEETING", "ARCHIVED"].includes(
        department.taskStatus,
      ),
    ).length;
    return {
      ...group,
      completed,
      total: departments.length,
    };
  }),
);
const reviewProgressPercent = computed(() => {
  const total = reviewProgressGroups.value.reduce(
    (sum, group) => sum + group.total,
    0,
  );
  if (!total) return "0%";
  const completed = reviewProgressGroups.value.reduce(
    (sum, group) => sum + group.completed,
    0,
  );
  return `${Math.round((completed / total) * 100)}%`;
});
const latestSecondMeeting = computed(
  () => sortMeetings(gateMeetings.value.second)[0],
);
const latestGroupMeeting = computed(
  () => sortMeetings(gateMeetings.value.group)[0],
);
const latestGroupDecision = computed(() => {
  const meeting = latestGroupMeeting.value;
  return meeting
    ? (meeting.currentConclusionDecision ?? conclusionMap.value[meeting.id])
    : undefined;
});
const currentGateLocked = computed(
  () =>
    ["READY", "PASSED", "LOCKED"].includes(
      String(currentGate.value?.gateStatus ?? ""),
    ) ||
    Boolean(
      (
        currentGate.value as
          | (NonNullable<typeof currentGate.value> & { locked?: boolean })
          | null
      )?.locked,
    ),
);
const showCurrentGateStatus = computed(
  () =>
    ["PASSED", "LOCKED"].includes(
      String(currentGate.value?.gateStatus ?? ""),
    ) ||
    Boolean(
      (
        currentGate.value as
          | (NonNullable<typeof currentGate.value> & { locked?: boolean })
          | null
      )?.locked,
    ),
);
const currentGateStatusLabel = computed(() =>
  currentGate.value?.gateStatus === "PASSED"
    ? "已过阀"
    : committeeStatusLabel(currentGate.value?.gateStatus),
);
const canDeleteCurrentGate = computed(
  () =>
    Boolean(currentGate.value) && currentGate.value?.gateStatus !== "PASSED",
);
const canLockCurrentGate = computed(
  () =>
    Boolean(currentGate.value) &&
    !currentGateLocked.value &&
    ["PASS", "CONDITIONAL_PASS"].includes(
      String(latestGroupDecision.value ?? ""),
    ),
);
const latestSecondConclusion = computed(() =>
  latestSecondMeeting.value
    ? meetingConclusionLabel(latestSecondMeeting.value)
    : "未上会",
);
const latestGroupConclusion = computed(() =>
  latestGroupMeeting.value
    ? meetingConclusionLabel(latestGroupMeeting.value)
    : "未上会",
);
const latestSecondMeetingPath = computed(() =>
  latestSecondMeeting.value
    ? `/committee/meetings/second/${latestSecondMeeting.value.id}`
    : "",
);
const latestGroupMeetingPath = computed(() =>
  latestGroupMeeting.value
    ? `/committee/meetings/group/${latestGroupMeeting.value.id}`
    : "",
);
const canCreateGate = computed(
  () =>
    Boolean(project.value) &&
    (!currentGate.value ||
      ["PASS", "CONDITIONAL_PASS"].includes(
        String(currentGate.value.finalConclusion ?? ""),
      ) ||
      currentGate.value.gateStatus === "PASSED"),
);
const currentGateEditPath = computed(() =>
  currentGate.value
    ? `/committee/projects/${projectId.value}/gates/${currentGate.value.id}/edit`
    : "",
);
const projectEditPath = computed(
  () => `/committee/projects/${projectId.value}/edit`,
);
const materialDialogTitle = computed(() =>
  materialDialogGate.value
    ? `${materialDialogGate.value.gateName} 材料清单`
    : "材料清单",
);
const reviewerRows = computed(() =>
  assignments.value.map((assignment) => {
    const matchedReviewers = reviewers.value.filter(
      (reviewer) =>
        reviewer.assignmentId === assignment.id ||
        reviewer.departmentId === assignment.departmentId,
    );
    return {
      id: assignment.id,
      departmentName: assignment.departmentName,
      departmentGroup: assignment.departmentGroup,
      sortNo: assignment.sortNo,
      reviewerNames: matchedReviewers
        .map((reviewer) => reviewer.reviewerUserName)
        .filter(Boolean),
    };
  }),
);
const orphanReviewerRows = computed(() =>
  reviewers.value
    .filter(
      (reviewer) =>
        !assignments.value.some(
          (assignment) =>
            assignment.id === reviewer.assignmentId ||
            assignment.departmentId === reviewer.departmentId,
        ),
    )
    .map((reviewer) => {
      const assignment = assignments.value.find(
        (row) =>
          row.id === reviewer.assignmentId ||
          row.departmentId === reviewer.departmentId,
      );
      return {
        id: reviewer.id,
        departmentName: assignment?.departmentName ?? "--",
        departmentGroup: assignment?.departmentGroup ?? "SECOND_COMPANY",
        sortNo: assignment?.sortNo ?? reviewer.sortNo,
        reviewerNames: [reviewer.reviewerUserName].filter(Boolean),
      };
    }),
);
const reviewerDialogRows = computed(() => [
  ...reviewerRows.value,
  ...orphanReviewerRows.value,
]);
const reviewerDialogGroups = computed(() =>
  [
    {
      key: "second-company",
      label: "品牌公司部门",
      rows: reviewerDialogRows.value.filter(
        (row) => row.departmentGroup !== "GROUP",
      ),
    },
    {
      key: "group",
      label: "集团部门",
      rows: reviewerDialogRows.value.filter(
        (row) => row.departmentGroup === "GROUP",
      ),
    },
  ]
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((left, right) => left.sortNo - right.sortNo),
    }))
    .filter((group) => group.rows.length > 0),
);

function displayValue(value: unknown): string {
  return value === null || value === undefined || value === ""
    ? "--"
    : String(value);
}

function displayBrand(brandName?: unknown, brand?: unknown): string {
  return displayValue(
    brandName !== null && brandName !== undefined && brandName !== ""
      ? brandName
      : brand,
  );
}

function displayFactory(
  factoryName?: unknown,
  factoryCode?: unknown,
  legacyFactory?: unknown,
): string {
  const name = displayValue(factoryName);
  const code = displayValue(factoryCode);
  if (name !== "--" && code !== "--") return `${name}/${code}`;
  return displayValue(legacyFactory);
}

function resolveResourceUrl(value?: string | null): string {
  const path = value?.trim();
  if (!path) return "";
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) return path;
  if (path.startsWith("/api/") || path === "/api") return path;
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

function displayDate(value: unknown): string {
  const text = displayValue(value);
  if (text === "--") return text;
  const matchedDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return matchedDate?.[1] ?? text;
}

function conclusionToneClass(value?: string) {
  const label = conclusionLabel(value);
  if (["通过", "已通过"].includes(label)) return "is-success";
  if (label === "带条件通过") return "is-warning";
  if (["不通过", "已驳回"].includes(label)) return "is-danger";
  if (label === "未上会" || label === "--") return "is-muted";
  return "";
}

function conclusionLabel(value?: string) {
  if (!value) return "--";
  return (
    conclusionStatusOptions.value.find(
      (option) => String(option.value) === String(value),
    )?.label ?? committeeStatusLabel(value)
  );
}

function openReviewProgress() {
  timeBoardRef.value?.openFirstStep();
  void nextTick(() => {
    timeBoardRef.value?.scrollIntoView();
  });
}

function emptyGateMeetings(): CommitteeGateMeetingHistory {
  return { second: [], group: [] };
}

function sortMeetings(rows: CommitteeMeeting[]) {
  return [...rows].sort((left, right) => right.attemptNo - left.attemptNo);
}

function latestMeeting(gateId: string, level: "SECOND" | "GROUP") {
  const history = historyGateMeetings.value[gateId] ?? emptyGateMeetings();
  const rows = level === "SECOND" ? history.second : history.group;
  return sortMeetings(rows)[0];
}

function meetingConclusionLabel(meeting?: CommitteeMeeting) {
  if (!meeting) return "--";
  const conclusion =
    meeting.currentConclusionDecision ?? conclusionMap.value[meeting.id];
  return conclusionLabel(conclusion);
}

function meetingConclusionToneClass(meeting?: CommitteeMeeting) {
  return conclusionToneClass(meetingConclusionLabel(meeting));
}

async function lockCurrentGate() {
  const gate = currentGate.value;
  if (!gate || !canLockCurrentGate.value || gateLocking.value) return;

  try {
    await openConfirm({
      scene: "lock",
      title: "过阀锁定确认",
      message: `确认将当前阀点“${gate.gateName}”按集团产品委员会结论进行过阀锁定吗？锁定后当前阀点不可再编辑。`,
      object: "当前阀点",
      name: gate.gateName,
      confirmText: "确认锁定",
      successMessage: "当前阀点已锁定",
    });
  } catch {
    return;
  }

  gateLocking.value = true;
  confirmState.loading = true;
  try {
    await lockCommitteeGate(gate.id, gate.lockVersion);
    BaseToast.success("当前阀点已锁定");
    resolveConfirm();
    await load();
  } catch (reason) {
    confirmState.loading = false;
    BaseToast.error(
      reason instanceof Error ? reason.message : "过阀锁定失败，请稍后重试",
    );
  } finally {
    gateLocking.value = false;
  }
}

async function deleteCurrentGate() {
  const gate = currentGate.value;
  if (!gate) return;

  try {
    await openConfirm({
      scene: "delete",
      title: "删除当前阀点确认",
      message: `确认删除当前阀点“${gate.gateName}”吗？删除后不可恢复。`,
      object: "当前阀点",
      name: gate.gateName,
      confirmText: "删除",
      successMessage: "当前阀点已删除",
    });
  } catch {
    return;
  }

  confirmState.loading = true;
  try {
    await deleteCommitteeGate(projectId.value, gate.lockVersion);
    BaseToast.success("当前阀点已删除");
    resolveConfirm();
    await load();
  } catch (reason) {
    confirmState.loading = false;
    BaseToast.error(
      reason instanceof Error ? reason.message : "当前阀点删除失败，请稍后重试",
    );
  }
}

function meetingRowsForGate(gateId: string) {
  const history = historyGateMeetings.value[gateId] ?? emptyGateMeetings();
  const hasGroupMeetings = history.group.length > 0;
  return [
    ...sortMeetings(history.group).map((meeting) => ({
      ...meeting,
      meetingLevel: "GROUP" as const,
      levelLabel: "集团会议",
      detailPath: `/committee/meetings/group/${meeting.id}`,
    })),
    ...sortMeetings(history.second).map((meeting, index) => ({
      ...meeting,
      meetingLevel: "SECOND" as const,
      levelLabel: "品牌公司会议",
      detailPath: `/committee/meetings/second/${meeting.id}`,
      isLevelBoundary: hasGroupMeetings && index === 0,
    })),
  ];
}

function meetingRowClassName({ row }: { row: { isLevelBoundary?: boolean } }) {
  return row.isLevelBoundary ? "is-level-boundary" : "";
}

function historyMaterialCountLabel(gateId: string) {
  return `共 ${historyMaterials(gateId).length} 项材料`;
}

function canViewHistoryGateMaterials(gateId: string) {
  return historyMaterials(gateId).length > 0;
}

function openHistoryGateMaterials(gateId: string) {
  if (!canViewHistoryGateMaterials(gateId)) return;
  selectedMaterialGateId.value = gateId;
  materialDialogVisible.value = true;
}

function openCurrentGateMaterials() {
  selectedMaterialGateId.value = currentGate.value?.id ?? null;
  materialDialogVisible.value = true;
}

function historyMaterials(gateId: string) {
  return gateHistory.value.find((gate) => gate.id === gateId)?.materials ?? [];
}

async function ensureHistoryGateMeetings(gateId: string) {
  if (
    historyGateMeetings.value[gateId] ||
    historyGateMeetingLoading.value[gateId]
  ) {
    return historyGateMeetings.value[gateId] ?? emptyGateMeetings();
  }

  historyGateMeetingLoading.value = {
    ...historyGateMeetingLoading.value,
    [gateId]: true,
  };
  delete historyGateMeetingErrors.value[gateId];
  try {
    const history = await fetchCommitteeGateMeetings(projectId.value, gateId);
    historyGateMeetings.value = {
      ...historyGateMeetings.value,
      [gateId]: history,
    };
    return history;
  } catch (reason) {
    historyGateMeetingErrors.value = {
      ...historyGateMeetingErrors.value,
      [gateId]: normalizeError(
        reason,
        "FRONTEND-COMMITTEE-HISTORY-MEETING-001",
        "历史阀点会议加载失败，请稍后重试。",
      ),
    };
    return emptyGateMeetings();
  } finally {
    historyGateMeetingLoading.value = {
      ...historyGateMeetingLoading.value,
      [gateId]: false,
    };
  }
}

function toggleHistoryGate(gateId: string) {
  expandedHistoryGateId.value =
    expandedHistoryGateId.value === gateId ? null : gateId;
  if (expandedHistoryGateId.value === gateId) {
    void ensureHistoryGateMeetings(gateId);
  }
}

async function openHistoryMeeting(
  gateId: string,
  preferredLevel?: "SECOND" | "GROUP",
) {
  const history = await ensureHistoryGateMeetings(gateId);
  if (preferredLevel === "SECOND") {
    const secondMeeting = sortMeetings(history.second)[0];
    if (secondMeeting) {
      router.push(`/committee/meetings/second/${secondMeeting.id}`);
      return;
    }
  }
  if (preferredLevel === "GROUP") {
    const groupMeeting = sortMeetings(history.group)[0];
    if (groupMeeting) {
      router.push(`/committee/meetings/group/${groupMeeting.id}`);
      return;
    }
  }
  const secondMeeting = sortMeetings(history.second)[0];
  if (secondMeeting) {
    router.push(`/committee/meetings/second/${secondMeeting.id}`);
    return;
  }
  const groupMeeting = sortMeetings(history.group)[0];
  if (groupMeeting) {
    router.push(`/committee/meetings/group/${groupMeeting.id}`);
    return;
  }
  router.push(
    `/committee/projects/${projectId.value}/gates/${gateId}/meeting-history`,
  );
}

function toggleHistorySection() {
  historyExpanded.value = !historyExpanded.value;
  if (historyExpanded.value) {
    gateHistory.value.forEach((gate) => {
      void ensureHistoryGateMeetings(gate.id);
    });
  }
}

function clearPreviewUrl() {
  if (previewUrl.value.startsWith("blob:")) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = "";
}

function normalizeError(
  unknownError: unknown,
  fallbackCode: string,
  fallbackMessage: string,
): ErrorInfo {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }

  return {
    code: fallbackCode,
    message: fallbackMessage,
    traceId: "unknown",
  };
}

function isActiveLoad(requestId: number, targetProjectId: string) {
  return (
    !unmounted &&
    requestId === loadRequestId &&
    targetProjectId === projectId.value
  );
}

function resetAuxiliaryState() {
  reviewSummary.value = null;
  progressReviewSummary.value = null;
  gateMeetings.value = { second: [], group: [] };
  historyGateMeetings.value = {};
  historyGateMeetingLoading.value = {};
  historyGateMeetingErrors.value = {};
  conclusions.value = [];
  reviewError.value = undefined;
  meetingError.value = undefined;
  conclusionError.value = undefined;
  previewError.value = undefined;
}

async function loadGateSummary(
  gateId: string | undefined,
  targetProjectId: string,
  requestId: number,
) {
  if (!gateId) return;

  const [reviewResult, progressResult, meetingResult] =
    await Promise.allSettled([
      fetchCommitteeReviewSummary(gateId),
      fetchCommitteeReviewSummary(gateId, { progressOnly: true }),
      fetchCommitteeGateMeetings(targetProjectId, gateId),
    ]);
  if (!isActiveLoad(requestId, targetProjectId)) return;
  if (reviewResult.status === "fulfilled") {
    reviewSummary.value = reviewResult.value;
  } else {
    reviewError.value = normalizeError(
      reviewResult.reason,
      "FRONTEND-COMMITTEE-REVIEW-001",
      "评审摘要加载失败，请稍后重试。",
    );
  }
  if (progressResult.status === "fulfilled") {
    progressReviewSummary.value = progressResult.value;
  }
  if (meetingResult.status !== "fulfilled") {
    meetingError.value = normalizeError(
      meetingResult.reason,
      "FRONTEND-COMMITTEE-MEETING-001",
      "会议历史加载失败，请稍后重试。",
    );
    conclusionError.value = {
      code: meetingError.value.code,
      message: "会议结论加载失败：会议历史不可用。",
      traceId: meetingError.value.traceId,
    };
    return;
  }

  gateMeetings.value = meetingResult.value;
  const meetings = [
    ...meetingResult.value.second,
    ...meetingResult.value.group,
  ];
  const conclusionResults = await Promise.allSettled(
    meetings.map((meeting) => fetchCommitteeConclusions(meeting.id)),
  );
  if (!isActiveLoad(requestId, targetProjectId)) return;
  conclusions.value = conclusionResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const failedConclusion = conclusionResults.find(
    (result) => result.status === "rejected",
  );
  if (failedConclusion?.status === "rejected") {
    conclusionError.value = normalizeError(
      failedConclusion.reason,
      "FRONTEND-COMMITTEE-CONCLUSION-001",
      "会议结论加载失败，请稍后重试。",
    );
  }
}

async function loadMeetingStatusOptions() {
  try {
    const [
      meetingItems,
      conclusionItems,
      reviewItems,
      approvalResultItems,
      secondConfirmItems,
    ] = await Promise.all([
      fetchPlatformDictItems("committee_meeting_status"),
      fetchPlatformDictItems("committee_conclusion_decision"),
      fetchPlatformDictItems("committee_review_status"),
      fetchPlatformDictItems("committee_approval_result_status"),
      fetchPlatformDictItems("committee_second_confirm_status"),
    ]);
    meetingStatusOptions.value = meetingItems;
    conclusionStatusOptions.value = conclusionItems;
    reviewStatusOptions.value = reviewItems;
    approvalResultOptions.value = approvalResultItems;
    secondConfirmStatusOptions.value = secondConfirmItems;
  } catch {
    meetingStatusOptions.value = [];
    conclusionStatusOptions.value = [];
    reviewStatusOptions.value = [];
    approvalResultOptions.value = [];
    secondConfirmStatusOptions.value = [];
  }
}

async function load() {
  const requestId = ++loadRequestId;
  const targetProjectId = projectId.value;
  if (!targetProjectId) {
    loading.value = false;
    return;
  }
  loading.value = true;
  detail.value = null;
  detailError.value = undefined;
  historyExpanded.value = false;
  expandedHistoryGateId.value = null;
  _previewRequestId += 1;
  previewVisible.value = false;
  clearPreviewUrl();
  resetAuxiliaryState();
  try {
    const payload = await fetchCommitteeProject(targetProjectId);
    if (!isActiveLoad(requestId, targetProjectId)) return;
    detail.value = payload;
    await Promise.all([
      loadGateSummary(payload.currentGate?.id, targetProjectId, requestId),
      loadMeetingStatusOptions(),
    ]);
  } catch (reason) {
    if (isActiveLoad(requestId, targetProjectId)) {
      detailError.value = normalizeError(
        reason,
        "FRONTEND-COMMITTEE-PROJECT-DETAIL-001",
        "上会项目管理详情加载失败，请稍后重试。",
      );
    }
  } finally {
    if (isActiveLoad(requestId, targetProjectId)) {
      loading.value = false;
    }
  }
}

function previewBrandPattern() {
  const url = brandPatternPreviewUrl.value;
  if (!url) return;
  _previewRequestId += 1;
  clearPreviewUrl();
  previewUrl.value = url;
  previewTitle.value = "品牌型谱";
  previewVisible.value = true;
}

function closePreview() {
  _previewRequestId += 1;
  previewVisible.value = false;
  clearPreviewUrl();
}

onMounted(load);
watch(projectId, load);
onBeforeUnmount(() => {
  unmounted = true;
  loadRequestId += 1;
  _previewRequestId += 1;
  clearPreviewUrl();
});
</script>

<template>
  <PageContainer
    class="bq-management-page committee-project-detail"
    title="项目详情"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        @click="
          router.replace(
            String(
              route.query.returnPath ||
                route.meta.breadcrumbParentPath ||
                route.meta.activeMenu ||
                '/committee/projects',
            ),
          )
        "
      >
        返回
      </PermissionButton>
      <PermissionButton :loading="loading" @click="load">刷新</PermissionButton>
      <PermissionButton
        :type="canCreateGate ? 'default' : 'primary'"
        @click="router.push(projectEditPath)"
      >
        编辑项目
        <!--        permission="committee:project:edit"-->
      </PermissionButton>
      <PermissionButton
        v-if="canCreateGate"
        type="primary"
        @click="router.push(`/committee/projects/${projectId}/gates/new`)"
      >
        关联阀点
        <!--        permission="committee:gate:create"-->
      </PermissionButton>
    </template>

    <TraceErrorAlert v-if="detailError" v-bind="detailError" />
    <div v-else v-loading="loading" class="project-detail__stack">
      <section
        class="project-detail__panel project-detail__panel--hero"
        data-testid="project-detail-basic"
      >
        <BaseSectionTitle
          class="project-detail__panel-header"
          title="项目基础信息"
          heading-tag="h2"
        />
        <el-descriptions :column="2" border>
          <el-descriptions-item label="项目代号">
            {{ displayValue(project?.projectName) }}
          </el-descriptions-item>
          <el-descriptions-item label="品牌">
            {{ displayBrand(project?.brandName, project?.brand) }}
          </el-descriptions-item>
          <el-descriptions-item label="项目分类">
            {{ displayValue(project?.projectCategory) }}
          </el-descriptions-item>
          <el-descriptions-item label="工厂名称">
            {{
              displayFactory(
                project?.factoryName,
                project?.factoryCode,
                project?.productionBase,
              )
            }}
          </el-descriptions-item>
          <el-descriptions-item label="项目总投资（元）">
            <BaseMoney :value="project?.totalInvestment" />
          </el-descriptions-item>
          <el-descriptions-item label="车型投资（元）">
            <BaseMoney :value="project?.vehicleModelInvestment" />
          </el-descriptions-item>
          <el-descriptions-item label="预算执行率">
            <BasePercent
              :numerator="project?.executionRate"
              :denominator="100"
            />
          </el-descriptions-item>
          <el-descriptions-item label="品牌型谱">
            <div
              v-if="project?.brandPatternFileName && brandPatternPreviewUrl"
              class="spectrum-files"
            >
              <PermissionButton
                v-if="project?.brandPatternFileName && brandPatternPreviewUrl"
                link
                type="primary"
                data-testid="project-brand-spectrum-view"
                @click="previewBrandPattern"
              >
                查看
                <!--                     permission="committee:attachment:download"-->
              </PermissionButton>
            </div>
            <span v-else>--</span>
            <TraceErrorAlert
              v-if="previewError"
              class="spectrum-preview-error"
              v-bind="previewError"
            />
          </el-descriptions-item>
          <el-descriptions-item label="项目背景" :span="2">
            {{ displayValue(project?.projectBackground) }}
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section
        class="project-detail__panel project-detail__panel--focus project-detail__current-gate"
      >
        <BaseSectionTitle
          class="project-detail__panel-header"
          title="当前阀点总览"
          heading-tag="h2"
        >
          <template #actions>
          <div v-if="currentGate" class="project-detail__inline-actions">
            <PermissionButton
              v-if="canDeleteCurrentGate"
              type="danger"
              link
              permission="committee:project:remove"
              data-testid="project-gate-delete"
              @click="deleteCurrentGate"
            >
              删除关联阀点
            </PermissionButton>
            <BaseStatusTag
              v-if="showCurrentGateStatus"
              class="project-detail__current-gate-status"
              data-testid="project-current-gate-status"
              :label="currentGateStatusLabel"
              :type="committeeTagType(currentGate.gateStatus)"
            />
            <template v-else>
              <PermissionGuard
                v-if="currentGateEditPath && !canLockCurrentGate"
              >
                <PermissionButton
                  link
                  type="primary"
                  :data-testid="`project-gate-edit-${currentGate.id}`"
                  @click="router.push(currentGateEditPath)"
                >
                  编辑当前阀点
                </PermissionButton>
              </PermissionGuard>
              <PermissionButton
                v-if="canLockCurrentGate"
                type="primary"
                :loading="gateLocking"
                data-testid="project-gate-lock"
                @click="lockCurrentGate"
              >
                过阀锁定
              </PermissionButton>
            </template>
          </div>
          </template>
        </BaseSectionTitle>
        <template v-if="currentGate">
          <el-descriptions :column="4" border>
            <el-descriptions-item label="当前阀点">
              {{ displayValue(currentGate.gateName) }}
            </el-descriptions-item>
            <el-descriptions-item label="计划完成时间">
              {{ displayDate(currentGate.plannedFinishDate) }}
            </el-descriptions-item>
            <el-descriptions-item label="材料清单">
              <PermissionButton
                link
                type="primary"
                data-testid="project-current-gate-materials-trigger"
                @click="openCurrentGateMaterials"
              >
                查看
              </PermissionButton>
            </el-descriptions-item>
            <el-descriptions-item label="部门评审人">
              <PermissionButton
                link
                type="primary"
                data-testid="project-current-gate-reviewers-trigger"
                @click="reviewerDialogVisible = true"
              >
                查看
              </PermissionButton>
            </el-descriptions-item>
            <el-descriptions-item label="阀点目的" :span="4">
              {{ displayValue(currentGate.gatePurpose) }}
            </el-descriptions-item>
            <el-descriptions-item label="核心工作内容" :span="4">
              {{ displayValue(currentGate.coreWorkContent) }}
            </el-descriptions-item>
          </el-descriptions>
        </template>
        <div v-else class="project-detail__empty-current">
          <BaseEmpty title="暂无阀点" description="请先关联阀点后再推进流程" />
        </div>

        <section v-if="currentGate" class="project-detail__metric-strip">
          <article class="project-detail__metric-card">
            <div class="project-detail__metric-header">
              <span>评审意见进度</span>
              <PermissionButton
                link
                type="primary"
                data-testid="project-review-progress-view"
                @click="openReviewProgress"
              >
                查看
                <!--                permission="committee:review:query"-->
              </PermissionButton>
            </div>
            <TraceErrorAlert v-if="reviewError" v-bind="reviewError" />
            <template v-else>
              <span
                class="committee-text-strong"
                data-testid="project-review-progress"
                >{{ reviewProgressPercent }}</span
              >
              <div class="project-detail__metric-notes">
                <p
                  v-for="group in reviewProgressGroups"
                  :key="group.key"
                  :data-testid="`project-review-progress-${group.key}`"
                >
                  {{ group.label }} {{ group.completed }}/{{ group.total }}
                </p>
              </div>
            </template>
          </article>
          <article class="project-detail__metric-card">
            <div class="project-detail__metric-header">
              <span>品牌公司产品委员会</span>
              <PermissionButton
                v-if="latestSecondMeetingPath"
                permission="committee:project:second-meeting-query"
                link
                type="primary"
                data-testid="project-second-meeting-view"
                @click="router.push(latestSecondMeetingPath)"
              >
                查看
              </PermissionButton>
            </div>
            <TraceErrorAlert v-if="meetingError" v-bind="meetingError" />
            <template v-else>
              <span
                class="committee-text-strong"
                :class="meetingConclusionToneClass(latestSecondMeeting)"
                data-testid="project-second-conclusion"
              >
                {{ latestSecondConclusion }}
              </span>
              <p>第 {{ latestSecondMeeting?.attemptNo ?? 0 }} 次上会</p>
            </template>
          </article>
          <article class="project-detail__metric-card">
            <div class="project-detail__metric-header">
              <span>集团产品委员会</span>
              <PermissionButton
                v-if="latestGroupMeetingPath"
                permission="committee:project:group-meeting-query"
                link
                type="primary"
                data-testid="project-group-meeting-view"
                @click="router.push(latestGroupMeetingPath)"
              >
                查看
              </PermissionButton>
            </div>
            <TraceErrorAlert v-if="conclusionError" v-bind="conclusionError" />
            <template v-else>
              <span
                class="committee-text-strong"
                :class="meetingConclusionToneClass(latestGroupMeeting)"
                data-testid="project-group-conclusion"
              >
                {{ latestGroupConclusion }}
              </span>
              <p>第 {{ latestGroupMeeting?.attemptNo ?? 0 }} 次上会</p>
            </template>
          </article>
        </section>

        <CommitteeTimeBoard
          v-if="currentGate"
          ref="timeBoardRef"
          :project-id="projectId"
          :gate-id="currentGate.id"
          :current-gate="currentGate"
          :company-name="project?.owningCompany"
          :history="gateMeetings"
          :review-summary="progressReviewSummary"
          progress-only
          :conclusion-map="conclusionMap"
          :meeting-status-options="meetingStatusOptions"
          :conclusion-status-options="conclusionStatusOptions"
          :review-status-options="reviewStatusOptions"
          :approval-result-options="approvalResultOptions"
          :second-confirm-status-options="secondConfirmStatusOptions"
        />
      </section>

      <section
        class="project-detail__panel project-detail__panel--history project-detail__history-panel"
        data-testid="project-history-gates-panel"
      >
        <BaseSectionTitle
          class="project-detail__panel-header"
          :title="`历史阀点信息（${gateHistory.length}）`"
          heading-tag="h2"
        >
          <template #actions>
          <PermissionButton
            link
            type="primary"
            data-testid="project-history-toggle"
            @click="toggleHistorySection"
          >
            {{ historyExpanded ? "收起" : "展开" }}
          </PermissionButton>
          </template>
        </BaseSectionTitle>
        <div
          v-if="historyExpanded && gateHistory.length"
          class="history-gate-list"
        >
          <article
            v-for="gate in gateHistory"
            :key="gate.id"
            class="history-gate-card"
          >
            <div class="history-gate-card__summary">
              <div class="history-gate-card__name">
                <span class="committee-text-strong">{{
                  displayValue(gate.gateName)
                }}</span>
              </div>
              <div class="history-gate-card__field">
                <span>计划完成时间</span>
                <span class="committee-text-strong">{{
                  displayDate(gate.plannedFinishDate)
                }}</span>
              </div>
              <div class="history-gate-card__field">
                <span>实际完成时间</span>
                <span class="committee-text-strong">{{
                  displayDate(gate.actualFinishDate)
                }}</span>
              </div>
              <div class="history-gate-card__field">
                <span>品牌公司会议结论</span>
                <div class="history-gate-card__inline">
                  <span class="committee-text-strong">
                    {{
                      meetingConclusionLabel(latestMeeting(gate.id, "SECOND"))
                    }}
                  </span>
                  <PermissionButton
                    v-if="latestMeeting(gate.id, 'SECOND')"
                    link
                    type="primary"
                    @click="openHistoryMeeting(gate.id, 'SECOND')"
                  >
                    查看
                  </PermissionButton>
                </div>
              </div>
              <div class="history-gate-card__field">
                <span>集团会议结论</span>
                <div class="history-gate-card__inline">
                  <span class="committee-text-strong">
                    {{
                      meetingConclusionLabel(latestMeeting(gate.id, "GROUP"))
                    }}
                  </span>
                  <PermissionButton
                    v-if="latestMeeting(gate.id, 'GROUP')"
                    link
                    type="primary"
                    @click="openHistoryMeeting(gate.id, 'GROUP')"
                  >
                    查看
                  </PermissionButton>
                </div>
              </div>
              <div class="history-gate-card__actions">
                <PermissionButton
                  link
                  type="primary"
                  @click="toggleHistoryGate(gate.id)"
                >
                  {{ expandedHistoryGateId === gate.id ? "收起" : "展开" }}
                </PermissionButton>
              </div>
            </div>

            <div
              v-if="expandedHistoryGateId === gate.id"
              class="history-gate-card__detail"
            >
              <div class="history-gate-card__detail-table">
                <el-descriptions :column="3" border size="small">
                  <el-descriptions-item label="阀点">
                    {{ displayValue(gate.gateName) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="计划完成时间">
                    {{ displayDate(gate.plannedFinishDate) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="实际完成时间">
                    {{ displayDate(gate.actualFinishDate) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="阀点目的" :span="3">
                    {{ displayValue(gate.gatePurpose) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="核心工作内容" :span="3">
                    {{ displayValue(gate.coreWorkContent) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="材料清单" :span="3">
                    <div class="history-gate-card__materials-inline">
                      <span>{{ historyMaterialCountLabel(gate.id) }}</span>
                      <PermissionButton
                        v-if="canViewHistoryGateMaterials(gate.id)"
                        link
                        type="primary"
                        @click="openHistoryGateMaterials(gate.id)"
                      >
                        查看
                      </PermissionButton>
                    </div>
                  </el-descriptions-item>
                  <!--                  <el-descriptions-item label="会议历史" :span="3">-->
                  <!--                    <PermissionButton-->
                  <!--                      link-->
                  <!--                      type="primary"-->
                  <!--                      @click="openHistoryMeeting(gate.id)"-->
                  <!--                    >-->
                  <!--                      查看会议详情-->
                  <!--                    </PermissionButton>-->
                  <!--                  </el-descriptions-item>-->
                </el-descriptions>
              </div>

              <section class="history-gate-card__meeting">
                <h3>会议结论</h3>
                <TraceErrorAlert
                  v-if="historyGateMeetingErrors[gate.id]"
                  v-bind="historyGateMeetingErrors[gate.id]"
                />
                <div
                  v-else-if="historyGateMeetingLoading[gate.id]"
                  class="history-gate-card__meeting-loading"
                >
                  加载中...
                </div>
                <el-table
                  v-else-if="meetingRowsForGate(gate.id).length"
                  :data="meetingRowsForGate(gate.id)"
                  border
                  :row-class-name="meetingRowClassName"
                  size="small"
                  class="history-gate-card__meeting-table"
                >
                  <el-table-column label="会议层级" min-width="140">
                    <template #default="{ row }">
                      {{ row.levelLabel }}
                    </template>
                  </el-table-column>
                  <el-table-column label="会议结论" min-width="140">
                    <template #default="{ row }">
                      <BaseStatusTag
                        v-if="meetingConclusionLabel(row) !== '--'"
                        :label="meetingConclusionLabel(row)"
                        :type="committeeTagType(row.currentConclusionDecision)"
                      />
                      <span v-else class="history-gate-card__empty">--</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="会议时间" min-width="180">
                    <template #default="{ row }">
                      {{ displayDate(row.meetingTime) }}
                    </template>
                  </el-table-column>
                  <el-table-column label="会次" min-width="140">
                    <template #default="{ row }">
                      第 {{ row.attemptNo }} 次
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" min-width="160" align="center">
                    <template #default="{ row }">
                      <PermissionButton
                        link
                        type="primary"
                        @click="router.push(row.detailPath)"
                      >
                        查看
                      </PermissionButton>
                    </template>
                  </el-table-column>
                </el-table>
                <BaseEmpty
                  v-else
                  title="暂无会议记录"
                  description="当前阀点暂无会议历史。"
                />
              </section>
            </div>
          </article>
        </div>
        <el-empty
          v-else-if="historyExpanded && !gateHistory.length"
          data-testid="project-history-empty"
          description="暂无历史阀点"
        />
      </section>
    </div>

    <el-dialog
      v-model="materialDialogVisible"
      :title="materialDialogTitle"
      width="720px"
    >
      <div
        v-if="materialDialogMaterials.length"
        class="project-detail__materials-dialog"
      >
        <div class="project-detail__materials-summary">
          <span>共 {{ materialDialogMaterials.length }} 项材料</span>
        </div>
        <div class="project-detail__materials-grid" aria-label="材料清单">
          <div
            v-for="(material, index) in materialDialogMaterials"
            :key="material.id"
            class="project-detail__material-card"
          >
            <span class="project-detail__material-index">
              {{ String(index + 1).padStart(2, "0") }}
            </span>
            <div class="project-detail__material-main">
              <span class="committee-text-strong">{{
                material.materialName
              }}</span>
              <span>{{ displayValue(material.materialRequirement) }}</span>
            </div>
          </div>
        </div>
      </div>
      <BaseEmpty
        v-else
        title="暂无材料清单"
        description="当前阀点未配置材料项。"
      />
    </el-dialog>

    <el-dialog v-model="reviewerDialogVisible" title="部门评审人" width="720px">
      <div
        v-if="reviewerDialogRows.length"
        class="project-detail__review-assignment-groups"
      >
        <section
          v-for="group in reviewerDialogGroups"
          :key="group.key"
          class="project-detail__review-assignment-group"
          :data-testid="`reviewer-group-${group.key}`"
        >
          <h4 class="project-detail__review-assignment-group-title">
            {{ group.label }}（{{ group.rows.length }}）
          </h4>
          <div class="project-detail__review-assignment-table">
            <div
              v-for="row in group.rows"
              :key="row.id"
              class="project-detail__review-assignment-row"
            >
              <span class="project-detail__review-assignment-department">
                {{ row.departmentName }}
              </span>
              <div
                class="project-detail__review-assignment-users"
                :class="{
                  'project-detail__review-assignment-users--empty':
                    !row.reviewerNames.length,
                }"
              >
                <template v-if="row.reviewerNames.length">
                  <span
                    v-for="reviewerName in row.reviewerNames"
                    :key="reviewerName"
                    class="project-detail__review-assignment-user"
                  >
                    {{ reviewerName }}
                  </span>
                </template>
                <span v-else>暂未指定</span>
              </div>
            </div>
          </div>
        </section>
      </div>
      <BaseEmpty
        v-else
        title="当前阀点暂未配置部门评审人"
        description="请先在创建 / 编辑阀点页完成评审权限管理配置。"
      />
    </el-dialog>

    <el-dialog
      :model-value="previewVisible"
      :title="previewTitle"
      width="min(760px, 92vw)"
      @close="closePreview"
    >
      <div class="spectrum-preview">
        <img v-if="previewUrl" :src="previewUrl" :alt="previewTitle" />
      </div>
    </el-dialog>
    <BaseConfirm
      v-model="confirmState.visible"
      v-bind="confirmState"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.committee-project-detail {
  background-color: #f9f9f9;
}

.project-detail__stack,
.project-detail__current-gate {
  position: relative;
  display: grid;
  gap: var(--bq-space-section, 16px);
}

.project-detail__panel {
  position: relative;
  display: grid;
  gap: var(--bq-space-section, 16px);
  padding: 24px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 14px);
  background: var(--bq-color-surface, var(--el-bg-color));
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 6px);
  box-shadow: var(--bq-shadow-page, 0 1px 6px rgba(15, 23, 42, 0.06));
}

.project-detail__panel--hero {
  box-shadow: var(--bq-shadow-page, 0 1px 6px rgba(15, 23, 42, 0.06));
}

.project-detail__panel--focus {
  border-color: var(--bq-color-border-subtle, var(--el-border-color-light));
  box-shadow: var(--bq-shadow-page, 0 1px 6px rgba(15, 23, 42, 0.06));
}

.project-detail__panel--history {
  box-shadow: var(--bq-shadow-page, 0 1px 6px rgba(15, 23, 42, 0.06));
}

.project-detail__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  padding: 0 0 10px;
  background: transparent;
  border-bottom: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
  border-radius: 0;
}

.project-detail__inline-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.project-detail__current-gate-status {
  height: 28px;
  padding: 0 15px;
  font-size: 14px;
  line-height: 26px;
  border-radius: var(--bq-radius-control, 4px);
}

.project-detail__empty-current {
  display: grid;
  justify-items: center;
  padding: 8px 0;
}

.project-detail__panel :deep(.el-descriptions__table) {
  table-layout: fixed;
}

.project-detail__panel :deep(.el-descriptions__label) {
  width: 156px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  background: #f8f9fb;
}

.project-detail__panel :deep(.el-descriptions__content) {
  min-width: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  background: var(--bq-color-surface, var(--el-bg-color));
}

.project-detail__panel :deep(.el-descriptions__label),
.project-detail__panel :deep(.el-descriptions__content),
.project-detail__panel :deep(.el-table .cell) {
  padding: 11px 14px;
  font-size: var(--bq-font-body, 14px);
  line-height: 22px;
}

.project-detail__panel :deep(.el-descriptions__label),
.project-detail__panel :deep(.el-table__header-wrapper th .cell) {
  font-weight: 700;
}

.project-detail__panel :deep(.el-button.is-link) {
  font-size: var(--bq-font-body, 14px);
  line-height: 22px;
}

.spectrum-files {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.project-detail__metric-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.project-detail__metric-card {
  display: grid;
  grid-template-rows: 22px 24px 20px;
  align-content: start;
  gap: 8px;
  min-height: 92px;
  padding: 10px 16px;
  background: var(--bq-color-surface, var(--el-bg-color));
  border: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
  border-radius: var(--bq-radius-control, 6px);
}

.project-detail__metric-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 22px;
}

.project-detail__metric-header span {
  display: block;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  line-height: 20px;
}

.project-detail__metric-card .committee-text-strong {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  letter-spacing: 0;
}

.project-detail__metric-card p {
  margin: 0;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
}

.project-detail__metric-notes {
  display: flex;
  gap: 16px;
  min-width: 0;
  flex-wrap: wrap;
}

.project-detail__metric-card .committee-text-strong.is-success {
  color: var(--bq-color-success, var(--el-color-success));
}

.project-detail__metric-card .committee-text-strong.is-warning {
  color: var(--bq-color-warning, var(--el-color-warning));
}

.project-detail__metric-card .committee-text-strong.is-danger {
  color: var(--bq-color-danger, var(--el-color-danger));
}

.project-detail__metric-card .committee-text-strong.is-muted {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
}

.project-detail__materials-dialog {
  display: grid;
  gap: 12px;
}

.project-detail__materials-summary {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 0 2px;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
}

.project-detail__materials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  min-width: 0;
  padding: 12px;
  background: var(--bq-color-bg-soft, var(--el-fill-color-light));
  border: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
  border-radius: var(--bq-radius-control, 6px);
}

.project-detail__material-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  min-height: 54px;
  padding: 10px 12px;
  background: var(--bq-color-surface, var(--el-bg-color));
  border: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
  border-radius: var(--bq-radius-control, 6px);
}

.project-detail__material-index {
  flex: 0 0 auto;
  color: var(--bq-color-primary, var(--el-color-primary));
  font-size: var(--bq-font-helper, 12px);
  font-weight: 600;
  line-height: 20px;
}

.project-detail__material-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.project-detail__material-main .committee-text-strong {
  min-width: 0;
  overflow: hidden;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-compact, 14px);
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-detail__material-main span {
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
  overflow-wrap: anywhere;
}

.project-detail__review-assignment-groups {
  display: grid;
  gap: 16px;
}

.project-detail__review-assignment-group {
  min-width: 0;
}

.project-detail__review-assignment-group-title {
  margin: 0 0 8px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-compact, 14px);
  font-weight: 600;
  line-height: 20px;
}

.project-detail__review-assignment-table {
  display: grid;
  background: var(--bq-color-surface, var(--el-bg-color));
  border: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
  border-radius: var(--bq-radius-control, 6px);
  overflow: hidden;
}

.project-detail__review-assignment-row {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  align-items: start;
  min-height: 44px;
  border-bottom: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
}

.project-detail__review-assignment-row:last-child {
  border-bottom: none;
}

.project-detail__review-assignment-department {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 10px 12px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-compact, 14px);
  font-weight: 600;
  line-height: 20px;
  background: color-mix(
    in srgb,
    var(--bq-color-bg-soft, var(--el-fill-color-light)),
    white 45%
  );
  border-right: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
}

.project-detail__review-assignment-users {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
}

.project-detail__review-assignment-users--empty {
  align-items: center;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
}

.project-detail__review-assignment-user {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 1px 8px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  background: color-mix(in srgb, var(--bq-color-primary, #409eff), white 92%);
  border: 1px solid
    color-mix(in srgb, var(--bq-color-primary, #409eff), white 80%);
  border-radius: 999px;
}

.history-gate-list {
  display: grid;
  gap: 16px;
}

.history-gate-card {
  overflow: hidden;
  background: var(--bq-color-surface, var(--el-bg-color));
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 6px);
  box-shadow: none;
}

.history-gate-card__summary {
  display: grid;
  grid-template-columns: minmax(120px, 180px) repeat(4, minmax(0, 1fr)) auto;
  gap: 12px;
  align-items: center;
  min-height: 92px;
  padding: 16px 32px;
}

.history-gate-card__name,
.history-gate-card__field,
.history-gate-card__actions {
  display: grid;
  grid-template-rows: 22px 24px;
  gap: 4px;
  min-width: 0;
}

.history-gate-card__name .committee-text-strong,
.history-gate-card__actions .el-button {
  grid-row: 2;
}

.history-gate-card__field > span {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  line-height: 22px;
}

.history-gate-card__name .committee-text-strong,
.history-gate-card__field .committee-text-strong {
  min-width: 0;
  overflow: hidden;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  font-weight: 700;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-gate-card__inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.history-gate-card__inline .el-button,
.history-gate-card__actions .el-button,
.history-gate-card__meeting-table :deep(.el-button) {
  min-height: 24px;
  padding: 0;
  font-size: var(--bq-font-section-title, 16px);
  line-height: 24px;
}

.history-gate-card__actions {
  justify-items: end;
}

.history-gate-card__detail {
  display: grid;
  gap: 16px;
  padding: 16px 32px 24px;
  background: var(--bq-color-bg-soft, var(--el-fill-color-extra-light));
}

.history-gate-card__detail-table {
  min-width: 0;
}

.history-gate-card__detail-table :deep(.el-descriptions__body) {
  background: var(--bq-color-surface, var(--el-bg-color));
}

.history-gate-card__detail-table :deep(.el-descriptions__table) {
  table-layout: fixed;
}

.history-gate-card__detail-table :deep(.el-descriptions__label) {
  width: 132px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 14px);
  font-weight: 700;
  background: #f8f9fb;
}

.history-gate-card__detail-table :deep(.el-descriptions__content) {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 14px);
  line-height: 22px;
  background: var(--bq-color-surface, var(--el-bg-color));
}

.history-gate-card__detail-table :deep(.el-descriptions__cell) {
  padding: 11px 14px;
}

.history-gate-card__materials-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.history-gate-card__materials-inline span {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 14px);
  line-height: 22px;
}

.history-gate-card__materials-inline .el-button,
.history-gate-card__detail-table :deep(.el-button.is-link) {
  min-height: 22px;
  padding: 0;
  font-size: var(--bq-font-body, 14px);
  line-height: 22px;
}

.history-gate-card__meeting {
  display: grid;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
}

.history-gate-card__meeting h3 {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 14px);
  font-weight: 600;
  line-height: 22px;
}

.history-gate-card__meeting-table :deep(.el-table__header-wrapper th) {
  color: var(--bq-color-text, var(--el-text-color-primary));
  background: var(--bq-color-table-header, var(--el-fill-color-light));
  font-weight: 600;
}

.history-gate-card__meeting-table {
  overflow: hidden;
  border: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
  border-radius: var(--bq-radius-control, 4px);
}

.project-detail__panel .history-gate-card__meeting-table :deep(.cell) {
  padding: 7px 12px;
  font-size: var(--bq-font-helper, 12px);
  line-height: 20px;
}

.project-detail__panel
  .history-gate-card__meeting-table
  :deep(.el-table__cell) {
  padding: 0;
}

.history-gate-card__meeting-table
  :deep(.el-table__body tr.is-level-boundary > td) {
  border-top: 2px solid var(--bq-color-border, var(--el-border-color));
}

.history-gate-card__empty {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
}

.spectrum-preview {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 320px;
  max-height: 70vh;
  overflow: auto;
  background: var(--el-fill-color-light);
}

.spectrum-preview img {
  display: block;
  max-width: 100%;
  max-height: 68vh;
  object-fit: contain;
}

@media (max-width: 1100px) {
  .project-detail__metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .history-gate-card__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .history-gate-card__name,
  .history-gate-card__actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .project-detail__panel {
    padding: 16px;
  }

  .project-detail__metric-strip,
  .project-detail__materials-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .project-detail__panel-header {
    align-items: flex-start;
  }

  .history-gate-card__summary {
    grid-template-columns: minmax(0, 1fr);
    padding: 12px 14px;
  }

  .history-gate-card__detail {
    padding: 0 14px 14px;
  }

  .project-detail__review-assignment-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .project-detail__review-assignment-department {
    border-right: 0;
    border-bottom: 1px solid
      var(--bq-color-border-subtle, var(--el-border-color-lighter));
  }
}
</style>
