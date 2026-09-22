<script setup lang="ts">
import DictTag from "@/components/base/DictTag.vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import {
  Back,
  DataAnalysis,
  Edit,
  Lock,
  Monitor,
  Refresh,
  Unlock,
} from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import {
  decideCommitteeConclusion,
  fetchCommitteeConclusions,
  fetchCommitteeGateMeetings,
  fetchCommitteeMeeting,
  fetchCommitteeReviewSummary,
  fetchCommitteeSecondConfirms,
  setCommitteeMeetingLock,
  unlockCommitteeMeeting,
  saveCommitteeConclusion,
} from "@/api/committee";
import { ApiBusinessError } from "@/api/http";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import type {
  CommitteeConclusion,
  CommitteeGateMeetingHistory,
  CommitteeLinkedSecondMeeting,
  CommitteeMeeting,
  CommitteeMeetingLevel,
  CommitteeReviewSummary,
} from "@/types/committee";
import { committeeStatusLabel } from "./committee-ui";
import { prefetchGroupMaterialData } from "./committee-material-prefetch";
import { fetchPlatformDictItems } from "@/api/platform-system";
import type { SchemaOption } from "@/types/schema-components";
import CommitteeAttachmentPanel from "./components/CommitteeAttachmentPanel.vue";
import CommitteeDate from "./components/CommitteeDate.vue";
import CommitteeReviewSummaryPanel from "./components/CommitteeReviewSummaryPanel.vue";
import CommitteeTimeBoard from "./components/CommitteeTimeBoard.vue";
import CommitteeMeetingConclusionPanel from "./components/CommitteeMeetingConclusionPanel.vue";
import CommitteeExpandableDecisionText from "./components/CommitteeExpandableDecisionText.vue";
import CommitteeReviewConclusionMatrixDialog from "./components/CommitteeReviewConclusionMatrixDialog.vue";

const route = useRoute();
const router = useRouter();
const level = computed<CommitteeMeetingLevel>(() => {
  const routeLevel = String(route.params.level ?? "").toUpperCase();
  if (routeLevel === "GROUP" || route.path.includes("/meetings/group/")) {
    return "GROUP";
  }
  return "SECOND";
});
const parentPath = computed(() =>
  level.value === "GROUP"
    ? "/committee/meetings/group"
    : "/committee/meetings/second",
);
const meeting = ref<CommitteeMeeting>();
const conclusions = ref<CommitteeConclusion[]>([]);
const timeBoardConclusions = ref<CommitteeConclusion[]>([]);
const gateMeetings = ref<CommitteeGateMeetingHistory>({
  second: [],
  group: [],
});
const reviewSummary = ref<CommitteeReviewSummary | null>(null);
const confirms = ref<Array<Record<string, unknown>>>([]);
const loading = ref(false);
const meetingStatusOptions = ref<SchemaOption[]>([]);
const conclusionStatusOptions = ref<SchemaOption[]>([]);
const secondConfirmStatusOptions = ref<SchemaOption[]>([]);
const reviewStatusOptions = ref<SchemaOption[]>([]);
const approvalResultOptions = ref<SchemaOption[]>([]);
const valveStatusOptions = ref<SchemaOption[]>([]);
const saving = ref(false);
const decisionVisible = ref(false);
const conclusionMatrixVisible = ref(false);
const decisionAction = ref<"submit-confirmation" | "confirm" | "reject">(
  "confirm",
);
const selectedConclusion = ref<CommitteeConclusion>();
const conclusionForm = reactive({
  decision: "PASS",
  conclusionText: "",
});
const opinion = ref("");
async function openConclusionMatrix() {
  conclusionMatrixVisible.value = true;
  try {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
    }
  } catch (err) {
    console.warn("Fullscreen request error", err);
  }
}
function isEffectiveConclusion(row?: CommitteeConclusion) {
  return row?.conclusionStatus === "EFFECTIVE";
}

function selectDisplayConclusion(rows: CommitteeConclusion[], currentId = "") {
  const sortedRows = [...rows].sort(
    (left, right) => right.conclusionVersion - left.conclusionVersion,
  );
  const currentEffective = sortedRows.find(
    (row) => String(row.id) === currentId && isEffectiveConclusion(row),
  );
  if (currentEffective) return currentEffective;
  const latestEffective = sortedRows.find(isEffectiveConclusion);
  if (latestEffective) return latestEffective;
  return (
    sortedRows.find((row) => String(row.id) === currentId) ??
    sortedRows.find((row) => row.conclusionStatus !== "SUPERSEDED") ??
    sortedRows[0]
  );
}

const currentConclusion = computed(() => {
  const currentId = String(meeting.value?.currentConclusionId ?? "");
  return selectDisplayConclusion(conclusions.value, currentId);
});
const conclusionMap = computed<Record<string, string>>(() => {
  const rowsByMeeting = new Map<string, CommitteeConclusion[]>();
  timeBoardConclusions.value.forEach((row) => {
    const meetingId = String(row.meetingId);
    const rows = rowsByMeeting.get(meetingId) ?? [];
    rows.push(row);
    rowsByMeeting.set(meetingId, rows);
  });
  return Object.fromEntries(
    [...rowsByMeeting].flatMap(([meetingId, rows]) => {
      const conclusion = selectDisplayConclusion(rows);
      return conclusion?.decision ? [[meetingId, conclusion.decision]] : [];
    }),
  );
});
type ErrorInfo = { code: string; message: string; traceId?: string };
const detailError = ref<ErrorInfo>();
const historyError = ref<ErrorInfo>();
const reviewError = ref<ErrorInfo>();
const conclusionError = ref<ErrorInfo>();
const confirmError = ref<ErrorInfo>();
const lockDialogVisible = ref(false);
const lockDialogTarget = ref(false);
let loadRequestId = 0;
let unmounted = false;
const currentConclusionLabel = computed(() =>
  committeeStatusLabel(
    currentConclusion.value?.decision ??
      meeting.value?.currentConclusionDecision,
  ),
);
type AssociatedValveStatus = "IN_PROGRESS" | "PASSED" | "UNASSOCIATED" | "";

function normalizeAssociatedValveStatus(
  value?: string | null,
): AssociatedValveStatus {
  const status = String(value ?? "")
    .trim()
    .toUpperCase();
  if (status === "0" || status === "IN_PROGRESS") return "IN_PROGRESS";
  if (
    status === "1" ||
    status === "2" ||
    status === "3" ||
    status === "PASSED"
  ) {
    return "PASSED";
  }
  if (status === "UNASSOCIATED") return "UNASSOCIATED";
  return "";
}

const associatedValveStatus = computed<AssociatedValveStatus>(() => {
  const rawStatus = String(meeting.value?.valveStatus ?? "").trim();
  return normalizeAssociatedValveStatus(rawStatus) || "UNASSOCIATED";
});
const canSelectReturnModifyDepartments = computed(() => {
  if (level.value !== "SECOND") return false;
  if (
    normalizeAssociatedValveStatus(meeting.value?.valveStatus) !== "IN_PROGRESS"
  ) {
    return false;
  }
  const decision = String(meeting.value?.currentConclusionDecision ?? "");
  const option = conclusionStatusOptions.value.find(
    (item) => String(item.value) === decision,
  );
  return ["通过", "待条件通过", "带条件通过"].includes(
    String(option?.label ?? ""),
  );
});
const currentConclusionToneClass = computed(() => {
  const decision =
    currentConclusion.value?.decision ??
    meeting.value?.currentConclusionDecision;
  if (decision === "PASS") return "is-success";
  if (decision === "CONDITIONAL_PASS") return "is-warning";
  if (decision === "FAIL") return "is-danger";
  return "is-muted";
});
const conclusionRecordableStatuses = ["READY", "LOCKED"];
const canRecordConclusion = computed(
  () =>
    conclusionRecordableStatuses.includes(meeting.value?.meetingStatus ?? "") &&
    !currentConclusion.value?.decision &&
    !meeting.value?.currentConclusionDecision,
);

const meetingCanBeLocked = computed(
  () =>
    level.value === "SECOND" && meeting.value?.meetingStatus === "PREPARING",
);
const meetingIsLocked = computed(
  () =>
    level.value === "SECOND" &&
    ["READY", "CUTOFF_LOCKED"].includes(meeting.value?.meetingStatus ?? ""),
);
const meetingIsConcluded = computed(() => {
  const status = String(meeting.value?.meetingStatus ?? "");
  const statusLabel = meetingStatusOptions.value.find(
    (option) => String(option.value) === status,
  )?.label;
  return (
    ["已结束", "已形成结论"].includes(String(statusLabel ?? "")) ||
    ["CONCLUDED", "CANCELLED", "VOIDED"].includes(status)
  );
});
const materialCanBeEdited = computed(
  () =>
    level.value === "GROUP" &&
    meeting.value?.meetingStatus !== "CUTOFF_LOCKED" &&
    !meetingIsConcluded.value,
);
const meetingMaterialUploadDisabled = computed(() => meetingIsConcluded.value);

const detailTitle = computed(
  () =>
    meeting.value?.meetingName ||
    (level.value === "GROUP"
      ? "集团产品委员会会议详情"
      : "品牌公司产品委员会会议详情"),
);
const meetingTypeLabel = computed(() =>
  level.value === "GROUP"
    ? "集团产品委员会"
    : String(
          (meeting.value as Record<string, unknown> | undefined)?.meetingType,
        ) === "GATE_REVIEW"
      ? "阀点评审会"
      : "品牌公司产品委员会",
);
function hasLinkedSecondMeetingConclusion(
  row?: CommitteeLinkedSecondMeeting | Record<string, unknown> | null,
): boolean {
  if (!row) return false;
  const rawRecord = row as Record<string, unknown>;
  const rawConclusion =
    row.conclusionLabel ??
    rawRecord.conclusionDecision ??
    rawRecord.decision ??
    rawRecord.conclusion ??
    rawRecord.linkedSecondMeetingConclusion ??
    rawRecord.currentConclusionDecision ??
    "";
  const str = String(rawConclusion ?? "").trim();
  return Boolean(str && str !== "--" && str !== "null" && str !== "undefined");
}

const displayLinkedSecondMeetings = computed<CommitteeLinkedSecondMeeting[]>(
  () => {
    const list = meeting.value?.linkedSecondMeetings ?? [];
    return list.filter((row) => hasLinkedSecondMeetingConclusion(row));
  },
);

const linkedMeetingAttemptColumnWidth = computed(() => {
  const maxAttemptLength = Math.max(
    1,
    ...displayLinkedSecondMeetings.value.map(
      (row) => String(row.attemptNo ?? "").length,
    ),
  );
  return 104 + (maxAttemptLength - 1) * 8;
});
const latestAttemptNo = computed(() => {
  const history =
    level.value === "GROUP"
      ? gateMeetings.value.group
      : gateMeetings.value.second;
  const attempts = history.map((row) => Number(row.attemptNo) || 0);
  return Math.max(meeting.value?.attemptNo ?? 0, ...attempts) || null;
});

function goToLinkedSecondMeetingDetail(linkedId?: string) {
  if (!linkedId) return;
  router.push(`/committee/meetings/second/${linkedId}`);
}

function goToAiPage() {
  if (!meeting.value?.id) return;
  router.push(`/committee/meetings/group/${meeting.value.id}/material/ai`);
}

function goToGroupMaterialDisplay() {
  if (!meeting.value?.id) return;
  router.replace(
    `/committee/meetings/group/${meeting.value.id}/material/presentation`,
  );
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

function isActiveLoad(
  requestId: number,
  targetLevel: CommitteeMeetingLevel,
  targetMeetingId: string,
) {
  return (
    !unmounted &&
    requestId === loadRequestId &&
    level.value === targetLevel &&
    String(route.params.meetingId) === targetMeetingId
  );
}

function resetLoadState() {
  meeting.value = undefined;
  conclusions.value = [];
  timeBoardConclusions.value = [];
  gateMeetings.value = { second: [], group: [] };
  reviewSummary.value = null;
  confirms.value = [];
  detailError.value = undefined;
  historyError.value = undefined;
  reviewError.value = undefined;
  conclusionError.value = undefined;
  confirmError.value = undefined;
}

async function loadOtherConclusions(
  history: CommitteeGateMeetingHistory,
  currentMeetingId: string,
  requestId: number,
  targetLevel: CommitteeMeetingLevel,
  targetMeetingId: string,
) {
  const meetingIds = new Set(
    [...history.second, ...history.group].map((row) => row.id),
  );
  meetingIds.delete(currentMeetingId);
  const uniqueMeetingIds = [...meetingIds];
  if (!uniqueMeetingIds.length) return;

  const results = await Promise.allSettled(
    uniqueMeetingIds.map((meetingId) => fetchCommitteeConclusions(meetingId)),
  );
  if (!isActiveLoad(requestId, targetLevel, targetMeetingId)) return;

  timeBoardConclusions.value = [
    ...timeBoardConclusions.value,
    ...results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
  ];
  const failedResult = results.find((result) => result.status === "rejected");
  if (failedResult?.status === "rejected" && !conclusionError.value) {
    conclusionError.value = normalizeError(
      failedResult.reason,
      "FRONTEND-COMMITTEE-CONCLUSION-001",
      "会议结论加载失败，请稍后重试。",
    );
  }
}

async function load() {
  const targetMeetingId = String(route.params.meetingId ?? "").trim();
  if (!targetMeetingId || targetMeetingId === "undefined") {
    // 离开详情路由时，路由参数会短暂变为空，不能因此发起无效请求。
    loadRequestId += 1;
    loading.value = false;
    return;
  }

  const requestId = ++loadRequestId;
  const targetLevel = level.value;
  loading.value = true;
  resetLoadState();
  try {
    const payload = await fetchCommitteeMeeting(targetLevel, targetMeetingId);
    if (!isActiveLoad(requestId, targetLevel, targetMeetingId)) return;
    meeting.value = payload;
    if (targetLevel === "GROUP" && payload?.id) {
      void prefetchGroupMaterialData(payload.id);
    }

    const [historyResult, reviewResult, conclusionResult, confirmResult] =
      await Promise.allSettled([
        fetchCommitteeGateMeetings(payload.projectId, payload.gateId),
        fetchCommitteeReviewSummary(payload.gateId, { meetingId: payload.id }),
        fetchCommitteeConclusions(payload.id),
        targetLevel === "SECOND"
          ? fetchCommitteeSecondConfirms(payload.id)
          : Promise.resolve([]),
      ] as const);
    if (!isActiveLoad(requestId, targetLevel, targetMeetingId)) return;

    if (reviewResult.status === "fulfilled") {
      reviewSummary.value = reviewResult.value;
    } else {
      reviewError.value = normalizeError(
        reviewResult.reason,
        "FRONTEND-COMMITTEE-REVIEW-001",
        "评审摘要加载失败，请稍后重试。",
      );
    }

    if (conclusionResult.status === "fulfilled") {
      conclusions.value = [...conclusionResult.value].sort(
        (left, right) => right.conclusionVersion - left.conclusionVersion,
      );
      timeBoardConclusions.value = [...conclusionResult.value];
    } else {
      conclusionError.value = normalizeError(
        conclusionResult.reason,
        "FRONTEND-COMMITTEE-CONCLUSION-001",
        "会议结论加载失败，请稍后重试。",
      );
    }

    if (confirmResult.status === "fulfilled") {
      confirms.value = confirmResult.value;
    } else {
      confirmError.value = normalizeError(
        confirmResult.reason,
        "FRONTEND-COMMITTEE-CONFIRM-001",
        "品牌公司确认加载失败，请稍后重试。",
      );
    }

    if (historyResult.status === "fulfilled") {
      gateMeetings.value = historyResult.value;
      await loadOtherConclusions(
        historyResult.value,
        payload.id,
        requestId,
        targetLevel,
        targetMeetingId,
      );
    } else {
      historyError.value = normalizeError(
        historyResult.reason,
        "FRONTEND-COMMITTEE-MEETING-001",
        "会议历史加载失败，请稍后重试。",
      );
    }
  } catch (reason) {
    if (isActiveLoad(requestId, targetLevel, targetMeetingId)) {
      detailError.value = normalizeError(
        reason,
        "FRONTEND-COMMITTEE-MEETING-DETAIL-001",
        "会议详情加载失败，请稍后重试。",
      );
    }
  } finally {
    if (isActiveLoad(requestId, targetLevel, targetMeetingId)) {
      loading.value = false;
    }
  }
}

async function loadMeetingStatusOptions() {
  try {
    const [
      meetingItems,
      conclusionItems,
      secondConfirmItems,
      reviewItems,
      approvalResultItems,
      valveStatusItems,
    ] = await Promise.all([
      fetchPlatformDictItems("committee_meeting_status"),
      fetchPlatformDictItems("committee_conclusion_decision"),
      fetchPlatformDictItems("committee_second_confirm_status"),
      fetchPlatformDictItems("committee_review_status"),
      fetchPlatformDictItems("committee_approval_result_status"),
      fetchPlatformDictItems("committee_gate_status"),
    ]);
    meetingStatusOptions.value = meetingItems;
    conclusionStatusOptions.value = conclusionItems;
    secondConfirmStatusOptions.value = secondConfirmItems;
    reviewStatusOptions.value = reviewItems;
    approvalResultOptions.value = approvalResultItems;
    valveStatusOptions.value = valveStatusItems;
  } catch {
    meetingStatusOptions.value = [];
    conclusionStatusOptions.value = [];
    secondConfirmStatusOptions.value = [];
    reviewStatusOptions.value = [];
    approvalResultOptions.value = [];
    valveStatusOptions.value = [];
  }
}
void loadMeetingStatusOptions();

watch(
  () => [level.value, String(route.params.meetingId)] as const,
  () => {
    void load();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  unmounted = true;
  loadRequestId += 1;
});
async function saveConclusion(pendingFiles: File[] = []) {
  const currentMeeting = meeting.value;
  if (!currentMeeting) return;
  if (!conclusionRecordableStatuses.includes(currentMeeting.meetingStatus)) {
    BaseToast.warning("会议尚未形成截止快照");
    return;
  }
  if (!conclusionForm.conclusionText.trim()) {
    BaseToast.warning("请输入会议决议事项");
    return;
  }
  saving.value = true;
  try {
    await saveCommitteeConclusion(level.value, currentMeeting.id, {
      expectedLockVersion: currentMeeting.lockVersion,
      ...(currentMeeting.currentSnapshotId
        ? { snapshotId: currentMeeting.currentSnapshotId }
        : {}),
      decision: conclusionForm.decision,
      conclusionText: conclusionForm.conclusionText.trim(),
      files: pendingFiles,
    });
    BaseToast.success("提交会议结论成功");
    await load();
  } finally {
    saving.value = false;
  }
}
function openDecision(
  row: CommitteeConclusion,
  action: typeof decisionAction.value,
) {
  selectedConclusion.value = row;
  decisionAction.value = action;
  opinion.value = "";
  decisionVisible.value = true;
}
async function submitDecision() {
  if (!selectedConclusion.value) return;
  saving.value = true;
  try {
    await decideCommitteeConclusion(
      selectedConclusion.value.id,
      decisionAction.value,
      opinion.value.trim() || undefined,
    );
    BaseToast.success("结论状态已更新");
    decisionVisible.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
function openMeetingLockDialog(locked: boolean) {
  if (locked && !meetingCanBeLocked.value) return;
  if (!locked && !meetingIsLocked.value) return;
  lockDialogTarget.value = locked;
  lockDialogVisible.value = true;
}

async function toggleMeetingLock() {
  if (!meeting.value) return;
  if (!lockDialogTarget.value) {
    saving.value = true;
    try {
      const updated = await unlockCommitteeMeeting(
        meeting.value.id,
        meeting.value.lockVersion,
      );
      meeting.value = updated;
      lockDialogVisible.value = false;
      BaseToast.success("解锁成功");
      await load();
    } finally {
      saving.value = false;
    }
    return;
  }
  saving.value = true;
  try {
    const updated = await setCommitteeMeetingLock(
      meeting.value.id,
      meeting.value.lockVersion,
    );
    meeting.value = updated;
    lockDialogVisible.value = false;
    BaseToast.success(
      lockDialogTarget.value
        ? "\u4f1a\u8bae\u5df2\u4e0a\u4f1a\u9501\u5b9a"
        : "\u4f1a\u8bae\u5df2\u89e3\u9501",
    );
    /*
    BaseToast.success(lockDialogTarget.value ? "浼氳宸蹭笂浼氬皝瀛? : "浼氳宸插紑鏀?);
    */
    await load();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <PageContainer class="committee-meeting-detail-page" :title="detailTitle">
    <template #actions>
      <PermissionButton plain :icon="Refresh" @click="load"
        >刷新</PermissionButton
      >
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        @click="
          router.replace(
            String(
              route.query.returnPath ||
                route.meta.breadcrumbParentPath ||
                route.meta.activeMenu ||
                parentPath,
            ),
          )
        "
      >
        返回
      </PermissionButton>
    </template>
    <div v-loading="loading" class="meeting-detail">
      <div
        v-if="
          detailError ||
          historyError ||
          reviewError ||
          conclusionError ||
          confirmError
        "
        class="meeting-detail__errors"
      >
        <TraceErrorAlert v-if="detailError" v-bind="detailError" />
        <TraceErrorAlert v-if="historyError" v-bind="historyError" />
        <TraceErrorAlert v-if="reviewError" v-bind="reviewError" />
        <TraceErrorAlert v-if="conclusionError" v-bind="conclusionError" />
        <TraceErrorAlert v-if="confirmError" v-bind="confirmError" />
      </div>
      <section v-if="level === 'GROUP'" class="committee-block material-entry">
        <BaseSectionTitle title="上会材料" heading-tag="h2">
          <template #actions>
            <div class="material-entry__actions">
              <PermissionButton
                plain
                :icon="Monitor"
                @click="goToGroupMaterialDisplay"
              >
                查看上会展示
              </PermissionButton>
              <PermissionButton
                v-if="materialCanBeEdited"
                type="primary"
                :icon="Edit"
                @click="
                  router.push(
                    `/committee/meetings/group/${meeting?.id}/material/edit`,
                  )
                "
              >
                编辑上会材料
              </PermissionButton>
            </div>
          </template>
        </BaseSectionTitle>
      </section>
      <section
        class="committee-block committee-block--primary meeting-info-card"
      >
        <BaseSectionTitle title="会议基础信息" heading-tag="h2">
          <template #actions>
            <div class="meeting-info-card__actions">
            <PermissionButton
              v-if="meetingCanBeLocked"
              type="danger"
              :icon="Lock"
              @click="openMeetingLockDialog(true)"
            >
              上会锁定
            </PermissionButton>
            <PermissionButton
              v-else-if="
                level === 'SECOND' && meeting?.meetingStatus === 'READY'
              "
              :icon="Unlock"
              @click="openMeetingLockDialog(false)"
            >
              &#35299;&#38145;
            </PermissionButton>
            <PermissionButton
              :disabled="meetingIsLocked || meetingIsConcluded"
              @click="
                router.push(
                  `/committee/meetings/${level.toLowerCase()}/${meeting?.id}/edit`,
                )
              "
            >
              编辑
            </PermissionButton>
            </div>
          </template>
        </BaseSectionTitle>
        <div class="meeting-status-strip">
          <div>
            <span>会议状态</span>
            <DictTag
              :value="meeting?.meetingStatus"
              :options="meetingStatusOptions"
            />
          </div>
          <div>
            <span>会议结论</span>
            <DictTag
              :value="meeting?.currentConclusionDecision"
              :options="conclusionStatusOptions"
            />
          </div>
        </div>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="会次">
            <template v-if="meeting?.attemptNo != null">
              第 {{ meeting.attemptNo }} 次
            </template>
            <template v-else>--</template>
          </el-descriptions-item>
          <el-descriptions-item label="会议类型">
            {{ meetingTypeLabel }}
          </el-descriptions-item>
          <el-descriptions-item label="关联项目">
            {{ meeting?.projectName }}
          </el-descriptions-item>
          <el-descriptions-item label="关联阀点">
            <div class="associated-valve-content">
              <span>{{ meeting?.gateName || "--" }}</span>
              <DictTag
                class="associated-valve-status"
                :value="associatedValveStatus"
                :options="valveStatusOptions"
                fallback="未关联"
              />
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="所属公司">
            {{ meeting?.companyName || meeting?.owningCompany || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="会议主持人">
            {{ meeting?.meetingHost || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="会议时间">
            <CommitteeDate :value="meeting?.meetingTime" with-time />
          </el-descriptions-item>
          <el-descriptions-item label="评审截止时间">
            <CommitteeDate :value="meeting?.reviewDeadlineTime"  with-time/>
          </el-descriptions-item>
          <el-descriptions-item label="会议地点">
            {{ meeting?.meetingLocation ?? "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="会议备注" :span="2">
            {{ meeting?.remark || "--" }}
          </el-descriptions-item>
        </el-descriptions>
        <section
          v-if="level === 'GROUP' && displayLinkedSecondMeetings.length > 0"
          class="meeting-info-card__linked-summary"
        >
          <BaseSectionTitle
            class="meeting-info-card__linked-summary-header"
            title="品牌公司历史会议"
            size="small"
            heading-tag="h3"
          />
          <div class="meeting-info-card__linked-table-wrap">
            <el-table
              :data="displayLinkedSecondMeetings"
              border
              class="meeting-info-card__linked-table"
            >
              <el-table-column
                label="会次"
                :width="linkedMeetingAttemptColumnWidth"
              >
                <template #default="{ row }">
                  <PermissionButton
                    v-if="row.id"
                    class="meeting-info-card__linked-meeting"
                    link
                    type="primary"
                    data-testid="group-linked-second-meeting-detail-entry"
                    @click="goToLinkedSecondMeetingDetail(row.id)"
                  >
                    第 {{ row.attemptNo }} 次
                  </PermissionButton>
                  <span v-else class="meeting-info-card__linked-meeting">
                    --
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="会议时间" width="150" align="center">
                <template #default="{ row }">
                  <CommitteeDate :value="row.meetingTime" with-time />
                </template>
              </el-table-column>
              <el-table-column label="会议结论" width="140" align="center">
                <template #default="{ row }">
                  <DictTag
                    :value="row.conclusionLabel"
                    :options="conclusionStatusOptions"
                  />
                </template>
              </el-table-column>
              <el-table-column
                prop="decisionItems"
                label="会议决议事项"
                min-width="360"
                header-align="center"
              >
                <template #default="{ row }">
                  <CommitteeExpandableDecisionText :text="row.decisionItems" />
                </template>
              </el-table-column>
            </el-table>
          </div>
        </section>
      </section>
      <CommitteeTimeBoard
        v-if="meeting"
        :project-id="meeting?.projectId"
        :gate-id="meeting?.gateId"
        :meeting-id="meeting?.id"
        :history="gateMeetings"
        :review-summary="reviewSummary"
        :conclusion-map="conclusionMap"
        :meeting-status-options="meetingStatusOptions"
        :conclusion-status-options="conclusionStatusOptions"
        :review-status-options="reviewStatusOptions"
        :approval-result-options="approvalResultOptions"
        :second-confirm-status-options="secondConfirmStatusOptions"
      />
      <CommitteeReviewSummaryPanel
        v-if="meeting"
        :gate-id="meeting.gateId"
        :meeting-id="meeting.id"
        :meeting-name="meeting.meetingName"
        :current-attempt-no="meeting.attemptNo"
        :latest-attempt-no="latestAttemptNo"
        :meeting-level="meeting.meetingLevel"
        :meeting-status="meeting.meetingStatus"
        :meeting-status-options="meetingStatusOptions"
        :summary="reviewSummary"
        :show-decision-actions="level === 'SECOND'"
        :show-second-confirm-actions="level === 'SECOND'"
        :second-confirms="confirms"
        :meeting-conclusion-decision="meeting.currentConclusionDecision"
        :show-return-modify-departments="canSelectReturnModifyDepartments"
        :second-confirm-status-options="secondConfirmStatusOptions"
        :review-status-options="reviewStatusOptions"
        :approval-result-options="approvalResultOptions"
        :conclusion-status-options="conclusionStatusOptions"
        :use-latest-record-on-view="level === 'SECOND'"
        @decision-success="load"
      />
      <section
        v-if="level === 'GROUP' && !meetingIsConcluded"
        class="committee-block meeting-ai-entry"
        data-testid="group-meeting-ai-review-panel"
      >
        <div class="meeting-ai-entry__label">
          <strong>AI 评审辅助</strong>
        </div>
        <PermissionButton type="primary" @click="goToAiPage">
          评审建议 AI 提炼
        </PermissionButton>
      </section>
      <section
        v-if="level === 'SECOND'"
        class="committee-block material-entry meeting-attachment-card"
      >
        <CommitteeAttachmentPanel
          biz-code="MEETING_MATERIAL"
          :biz-id="meeting?.id"
          :editable="!meetingMaterialUploadDisabled"
          allow-delete
          compact
          title="上会材料"
          description="支持上传会议议程和评审材料附件。"
          empty-hint="无上会材料"
          :show-empty="false"
        >
          <template #actions-extra>
            <PermissionButton
              type="primary"
              size="small"
              :icon="DataAnalysis"
              @click="openConclusionMatrix"
            >
              结论汇总
            </PermissionButton>
          </template>
        </CommitteeAttachmentPanel>
      </section>
      <CommitteeMeetingConclusionPanel
        :conclusion="currentConclusion"
        :meeting-id="meeting?.id"
        :decision-label="currentConclusionLabel"
        :tone-class="currentConclusionToneClass"
        :meeting-conclusion-decision="meeting?.currentConclusionDecision"
        :meeting-conclusion-text="meeting?.conclusionText ?? undefined"
        :meeting-conclusion-id="meeting?.currentConclusionId ?? undefined"
        :conclusion-status-options="conclusionStatusOptions"
        :level="level"
        :can-record="canRecordConclusion"
        :record-decision="conclusionForm.decision"
        :record-text="conclusionForm.conclusionText"
        :saving="saving"
        @update:record-decision="conclusionForm.decision = $event"
        @update:record-text="conclusionForm.conclusionText = $event"
        @record="saveConclusion"
        @decision="openDecision"
      />
      <!--      <section-->
      <!--        v-if="level === 'SECOND' && confirms.length"-->
      <!--        class="committee-block"-->
      <!--      >-->
      <!--        <header><h2>品牌公司确认</h2></header>-->
      <!--        <el-table :data="confirms"-->
      <!--          ><el-table-column-->
      <!--            prop="departmentName"-->
      <!--            label="部门"-->
      <!--            min-width="150"-->
      <!--          /><el-table-column-->
      <!--            prop="requiredConfirmerName"-->
      <!--            label="确认人"-->
      <!--            width="120"-->
      <!--          /><el-table-column prop="confirmStatus" label="确认状态" width="110"-->
      <!--            ><template #default="{ row }">{{-->
      <!--              committeeStatusLabel(row.confirmStatus)-->
      <!--            }}</template></el-table-column-->
      <!--          ><el-table-column-->
      <!--            prop="confirmOpinion"-->
      <!--            label="意见"-->
      <!--            min-width="220"-->
      <!--          /><el-table-column label="操作" width="150"-->
      <!--            ><template #default="{ row }"-->
      <!--              ><div-->
      <!--                v-if="row.confirmStatus === 'PENDING'"-->
      <!--                class="bq-table-actions"-->
      <!--              >-->
      <!--                <PermissionButton-->
      <!--                  link-->
      <!--                  permission="committee:second-confirm:approve"-->
      <!--                  @click="decideConfirm(row, 'approve')"-->
      <!--                  >同意</PermissionButton-->
      <!--                ><PermissionButton-->
      <!--                  link-->
      <!--                  type="danger"-->
      <!--                  permission="committee:second-confirm:reject"-->
      <!--                  @click="decideConfirm(row, 'reject')"-->
      <!--                  >驳回确认</PermissionButton-->
      <!--                >-->
      <!--              </div></template-->
      <!--            ></el-table-column-->
      <!--          ></el-table-->
      <!--        >-->
      <!--      </section>-->
    </div>
    <BaseFormDialog
      v-model="decisionVisible"
      :title="
        decisionAction === 'confirm'
          ? '确认会议结论'
          : decisionAction === 'reject'
            ? '驳回会议结论'
            : '提交结论确认'
      "
      width="520px"
      :loading="saving"
      @confirm="submitDecision"
      ><el-form label-position="top"
        ><el-form-item label="意见"
          ><el-input
            v-model="opinion"
            type="textarea"
            :rows="4"
            maxlength="1000" /></el-form-item></el-form></BaseFormDialog
  ></PageContainer>
  <BaseConfirm
    v-model="lockDialogVisible"
    :title="
      lockDialogTarget ? '&#19978;&#20250;&#38145;&#23450;' : '&#35299;&#38145;'
    "
    :message="
      lockDialogTarget
        ? '&#38145;&#23450;&#21518;&#25152;&#26377;&#35780;&#23457;&#36827;&#20837;&#19978;&#20250;&#38145;&#23450;&#29366;&#24577;&#65292;&#26080;&#27861;&#20462;&#25913;&#65292;&#30830;&#23450;&#35201;&#38145;&#23450;&#21527;&#65311;'
        : '&#35299;&#38145;&#21518;&#23558;&#24674;&#22797;&#35780;&#23457;&#32534;&#36753;&#65292;&#30830;&#23450;&#35201;&#35299;&#38145;&#21527;&#65311;'
    "
    :loading="saving"
    :type="lockDialogTarget ? 'danger' : 'warning'"
    :confirm-text="lockDialogTarget ? '&#38145;&#23450;' : '&#35299;&#38145;'"
    @confirm="toggleMeetingLock"
  />
  <CommitteeReviewConclusionMatrixDialog
    v-model="conclusionMatrixVisible"
    :meeting-id="meeting?.id"
    :meeting="meeting"
    :project-name="meeting?.projectName"
    :gate-name="meeting?.gateName"
    :meeting-name="meeting?.meetingName"
    :summary="reviewSummary"
    :company-name="reviewSummary?.companyName || meeting?.companyName || meeting?.owningCompany"
    :meeting-level="level"
    :review-status-options="reviewStatusOptions"
  />
</template>

<style scoped>
:global(.page-container.committee-meeting-detail-page),
:global(.page-container.committee-meeting-detail-page.is-page-fullscreen) {
  background-color: #f9f9f9;
}

.meeting-detail {
  position: relative;
  display: grid;
  gap: 14px;
}

.meeting-detail__errors {
  display: grid;
  gap: 8px;
}

.meeting-detail .committee-block {
  padding: 16px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
  box-shadow: var(--bq-shadow-card);
}

.meeting-detail .committee-block--primary {
  box-shadow: var(--bq-shadow-page);
}

.meeting-detail > :deep(.committee-block),
.meeting-detail > :deep(.project-detail__time-board),
.meeting-detail > :deep(.review-summary),
.meeting-detail > :deep(.meeting-conclusion-panel) {
  background: var(--bq-color-surface);
  border: 1px solid color-mix(in srgb, var(--bq-color-border), white 28%);
  border-radius: var(--bq-radius-control);
  box-shadow: var(--bq-shadow-card);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.meeting-detail > :deep(.committee-block:hover),
.meeting-detail > :deep(.project-detail__time-board:hover),
.meeting-detail > :deep(.review-summary:hover),
.meeting-detail > :deep(.meeting-conclusion-panel:hover) {
  border-color: color-mix(in srgb, var(--bq-color-border), #c8cfd8 42%);
  box-shadow:
    0 12px 24px rgba(15, 23, 42, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.88) inset;
  transform: translateY(-1px);
}

.meeting-detail :deep(.committee-block > header),
.meeting-detail .meeting-attachment-card :deep(.attachment-panel > header) {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.meeting-detail .meeting-attachment-card :deep(.attachment-panel > header) {
  min-height: 32px;
  padding: 0 0 10px;
  background: transparent;
  box-shadow: none;
}

.meeting-detail .committee-block header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.meeting-detail .committee-block h2,
.meeting-detail .committee-block p {
  margin: 0;
}

.meeting-detail .committee-block h2 {
  font-size: var(--bq-font-section-title, 16px);
  line-height: 24px;
}

.meeting-detail .committee-block p {
  margin-top: 4px;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact, 14px);
  line-height: 18px;
}

.meeting-detail .material-entry header {
  align-items: center;
}

.meeting-detail .material-entry__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.meeting-detail .meeting-attachment-card {
  padding: 0;
  overflow: hidden;
}

.meeting-detail .meeting-attachment-card :deep(.attachment-panel) {
  padding: 16px;
  border: 0;
}

.meeting-detail .meeting-attachment-card :deep(.attachment-panel--compact) {
  padding: 16px;
}

.meeting-detail .meeting-attachment-card :deep(.attachment-panel header) {
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.meeting-detail .meeting-attachment-card :deep(.attachment-panel h3) {
  font-size: var(--bq-font-section-title, 16px);
  line-height: 24px;
}

.meeting-detail .meeting-attachment-card :deep(.attachment-panel header p) {
  margin-top: 4px;
  font-size: var(--bq-font-compact, 14px);
  line-height: 18px;
}

.meeting-detail .meeting-ai-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  padding: 12px 16px;
  box-shadow: var(--bq-shadow-page);
}

.meeting-detail .meeting-ai-entry__label {
  min-width: 0;
}

.meeting-detail .meeting-ai-entry__label strong {
  overflow: hidden;
  color: var(--bq-color-text);
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meeting-detail .meeting-info-card {
  display: grid;
  gap: 12px;
}

.meeting-detail .meeting-status-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  padding: 12px 14px;
  background: var(--bq-color-bg-soft);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
}

.meeting-detail .meeting-status-strip > div {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.meeting-detail .meeting-status-strip > div + div {
  padding-left: 14px;
  border-left: 1px solid var(--bq-color-border-subtle);
}

.meeting-detail .meeting-status-strip span {
  font-size: var(--bq-font-compact, 14px);
  white-space: nowrap;
}

.meeting-detail :deep(.el-descriptions__table) {
  table-layout: fixed;
}

.meeting-detail :deep(.el-descriptions__label.is-bordered-label) {
  width: 112px;
  color: var(--bq-color-text);
  background: #f8f9fb;
}

.meeting-detail :deep(.el-descriptions__content.el-descriptions__cell) {
  color: var(--bq-color-text);
}

.meeting-detail .associated-valve-content {
  display: flex;
  align-items: center;
  gap: 5px;
}

.meeting-detail .associated-valve-content > span {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.meeting-detail .meeting-info-card__linked-summary {
  display: grid;
  gap: 14px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.meeting-detail .meeting-info-card__linked-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.meeting-detail .meeting-info-card__linked-summary-header h3 {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 14px);
  font-weight: 700;
  line-height: 22px;
}

.meeting-detail .meeting-info-card__linked-table-wrap {
  overflow-x: auto;
}

.meeting-detail .meeting-info-card__linked-table {
  width: 100%;
  min-width: 0;
  background: transparent;
  border: 0;
}

.meeting-detail
  .meeting-info-card__linked-table
  :deep(.el-table__header th.el-table__cell),
.meeting-detail
  .meeting-info-card__linked-table
  :deep(.el-table__body td.el-table__cell) {
  padding: 13px 16px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-compact, 14px);
  line-height: 22px;
  vertical-align: middle;
  word-break: break-word;
}

.meeting-detail
  .meeting-info-card__linked-table
  :deep(.el-table__header th.el-table__cell) {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-weight: 700;
  background: var(--bq-color-table-header, #f0f1f2);
}

.meeting-detail
  .meeting-info-card__linked-table
  :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.meeting-detail .meeting-info-card__linked-meeting {
  display: inline-flex;
  min-height: 22px;
  padding: 0;
  white-space: nowrap;
  font-weight: 500;
  font-size: var(--bq-font-compact, 14px);
  line-height: 22px;
  vertical-align: top;
}

@media (max-width: 680px) {
  .meeting-detail .committee-block header,
  .meeting-detail .material-entry__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .meeting-detail .meeting-ai-entry {
    align-items: stretch;
    flex-direction: column;
  }

  .meeting-detail .meeting-ai-entry :deep(.el-button) {
    width: 100%;
  }

  .meeting-detail .meeting-status-strip {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .meeting-detail .meeting-status-strip > div + div {
    padding-top: 10px;
    padding-left: 0;
    border-top: 1px solid var(--bq-color-border-subtle);
    border-left: 0;
  }
}
</style>
