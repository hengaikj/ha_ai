<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { Back } from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import {
  decideCommitteeReview,
  fetchCommitteeAttachments,
  fetchCommitteeConclusions,
  fetchCommitteeGateMeetings,
  fetchCommitteeProject,
  fetchCommitteeReviewSummary,
  fetchCommitteeReviewTask,
  rollbackCommitteeReviewDraft,
  saveCommitteeReview,
} from "@/api/committee";
import PageContainer from "@/components/layout/PageContainer.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import { BaseToast } from "@/components/base/BaseToast";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import type {
  CommitteeConclusion,
  CommitteeAttachment,
  CommitteeGateMeetingHistory,
  CommitteeMeeting,
  CommitteeProjectDetail,
  CommitteeReviewContent,
  CommitteeReviewTask,
  CommitteeReviewSummary,
} from "@/types/committee";
import { committeeLevelLabel, committeeStatusLabel } from "./committee-ui";
import { fetchPlatformDictItems } from "@/api/platform-system";
import type { SchemaOption } from "@/types/schema-components";
import CommitteeReviewSummaryPanel from "./components/CommitteeReviewSummaryPanel.vue";
import CommitteeReviewCollaborationPanel from "./components/CommitteeReviewCollaborationPanel.vue";
import CommitteePageStack from "./components/CommitteePageStack.vue";
import CommitteeTimeBoard from "./components/CommitteeTimeBoard.vue";
import CommitteeReviewTaskInfoPanel from "./components/CommitteeReviewTaskInfoPanel.vue";
import CommitteeMeetingConclusionReferencePanel from "./components/CommitteeMeetingConclusionReferencePanel.vue";
import CommitteeReviewEditPanel from "./components/CommitteeReviewEditPanel.vue";
import CommitteeReviewAdvicePanel from "./components/CommitteeReviewAdvicePanel.vue";
import CommitteeReviewRecordPanel from "./components/CommitteeReviewRecordPanel.vue";
import {
  committeeReviewContentMaxCharacters,
  extractCommitteeReviewText,
} from "./committee-review-content";

const route = useRoute();
const router = useRouter();
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const props = defineProps<{
  mode?: "view" | "edit" | "approve" | "suggest" | "history";
}>();
const task = ref<CommitteeReviewTask>();
const projectDetail = ref<CommitteeProjectDetail | null>(null);
const meetingHistory = ref<CommitteeGateMeetingHistory>({
  second: [],
  group: [],
});
const meetingConclusions = ref<CommitteeConclusion[]>([]);
const reviewSummary = ref<CommitteeReviewSummary | null>(null);
const progressReviewSummary = ref<CommitteeReviewSummary | null>(null);
const conclusionAttachments = ref<Record<string, CommitteeAttachment[]>>({});
const meetingStatusOptions = ref<SchemaOption[]>([]);
const conclusionStatusOptions = ref<SchemaOption[]>([]);
const secondConfirmStatusOptions = ref<SchemaOption[]>([]);
const reviewStatusOptions = ref<SchemaOption[]>([]);
const approvalResultOptions = ref<SchemaOption[]>([]);
const loading = ref(false);
const conclusionLoading = ref(false);
const saving = ref(false);
const loadError = ref<{ code: string; message: string; traceId?: string }>();
const mode = computed(() => props.mode ?? String(route.query.mode ?? "view"));
const reviewContentMaxBytes = 50 * 1024 * 1024;
const allowedInlineImageDataSourcePattern =
  /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/i;
const allowedRichTextImageUrlPattern = /^https?:\/\/[^\s"'<>]+$/i;
const inlineImageSourceAttributePattern =
  /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;

function extractRichTextAttachmentIds(content: string) {
  if (typeof DOMParser === "undefined") return [];
  const document = new DOMParser().parseFromString(content, "text/html");
  const ids = Array.from(document.body.querySelectorAll("img"))
    .map(
      (image) =>
        image.getAttribute("data-attachment-id") ??
        image.getAttribute("attachmentid") ??
        image.getAttribute("attachmentId") ??
        image.getAttribute("id"),
    )
    .map((id) => id?.trim())
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}
const editable = computed(
  () =>
    mode.value === "edit" &&
    ["NOT_STARTED", "DRAFT"].includes(String(task.value?.taskStatus ?? "")),
);
const approving = computed(() => mode.value === "approve");
const suggesting = computed(() => mode.value === "suggest");
const historyOnly = computed(() => mode.value === "history");
const viewOnly = computed(() => mode.value === "view");
const canRollbackDraft = computed(
  () =>
    !historyOnly.value && String(task.value?.taskStatus ?? "") === "APPROVED",
);
const fallbackReviewStatusOptions: SchemaOption[] = [
  "NOT_STARTED",
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "WAITING_MEETING",
  "REJECTED",
  "ARCHIVED",
].map((value) => ({ value, label: committeeStatusLabel(value) }));
const fallbackApprovalResultOptions: SchemaOption[] = [
  { value: "WAITING_APPROVAL", label: "待审批" },
  { value: "APPROVE", label: "同意" },
  { value: "REJECT", label: "驳回" },
  { value: "TO_FILL", label: "暂无结果" },
];
function createEmptyReviewContent(): CommitteeReviewContent {
  return {
    contentText: "",
    techSignal: "EMPTY",
    revenueSignal: "EMPTY",
    volumePriceSignal: "EMPTY",
    competitivenessSignal: "EMPTY",
    qualitySignal: "EMPTY",
    conclusionSignal: "EMPTY",
    headUsers: [],
    noticeUsers: [],
    projectMembers: [],
  };
}

const form = reactive<CommitteeReviewContent>(createEmptyReviewContent());
const opinion = ref("");
const taskId = computed(() => {
  const value = route.params.taskId;
  return String(Array.isArray(value) ? (value[0] ?? "") : (value ?? "")).trim();
});
let latestLoadRequestId = 0;
let isUnmounted = false;

function isCurrentLoadRequest(requestId: number) {
  return !isUnmounted && requestId === latestLoadRequestId;
}

const meetingConclusionItems = computed(() => {
  const meetingItems = [
    firstMeetingWithConclusion(meetingHistory.value.group),
    firstMeetingWithConclusion(meetingHistory.value.second),
  ]
    .filter((meeting): meeting is CommitteeMeeting => Boolean(meeting))
    .map((meeting) => {
      const conclusion = currentConclusionForMeeting(meeting);
      return {
        meetingId: String(meeting.id),
        item: {
          id: `${meeting.id}-${conclusion?.id ?? "current"}`,
          sourceTitle: committeeLevelLabel(meeting.meetingLevel),
          meetingName: `第${meeting.attemptNo}会次`,
          meetingTime: meeting.meetingTime,
          decision: conclusion?.decision ?? meeting.currentConclusionDecision,
          decisionText:
            conclusion?.conclusionText ?? meeting.conclusionText ?? undefined,
          attachments: conclusionAttachments.value[String(meeting.id)] ?? [],
        },
      };
    });
  return meetingItems.map(({ item }) => item);
});

function firstMeetingWithConclusion(meetings: CommitteeMeeting[]) {
  const meeting = meetings[0];
  return meeting && hasMeetingConclusion(meeting) ? meeting : undefined;
}

function hasMeetingConclusion(meeting: CommitteeMeeting) {
  return Boolean(
    currentConclusionForMeeting(meeting) ||
    meeting.currentConclusionDecision ||
    meeting.conclusionText,
  );
}

const conclusionMap = computed<Record<string, string>>(() =>
  Object.fromEntries(
    [...meetingHistory.value.second, ...meetingHistory.value.group]
      .map((meeting) => {
        const conclusion = currentConclusionForMeeting(meeting);
        const decision =
          conclusion?.decision ?? meeting.currentConclusionDecision;
        return decision ? [String(meeting.id), decision] : null;
      })
      .filter((entry): entry is [string, string] => entry !== null),
  ),
);

function currentConclusionForMeeting(meeting: CommitteeMeeting) {
  const rows = meetingConclusions.value
    .filter((row) => String(row.meetingId) === String(meeting.id))
    .sort((left, right) => right.conclusionVersion - left.conclusionVersion);
  if (!rows.length) return undefined;
  const currentId = String(meeting.currentConclusionId ?? "");
  const currentEffective = rows.find(
    (row) =>
      String(row.id) === currentId && row.conclusionStatus === "EFFECTIVE",
  );
  if (currentEffective) return currentEffective;
  const latestEffective = rows.find(
    (row) => row.conclusionStatus === "EFFECTIVE",
  );
  if (latestEffective) return latestEffective;
  return (
    rows.find((row) => String(row.id) === currentId) ??
    rows.find((row) => row.conclusionStatus !== "SUPERSEDED") ??
    rows[0]
  );
}

function updateReviewField(
  field: keyof CommitteeReviewContent,
  value: CommitteeReviewContent[keyof CommitteeReviewContent],
) {
  if (field === "contentText") {
    form.contentText = String(value);
    return;
  }
  if (field === "conclusionSignal") {
    form.conclusionSignal =
      value === "GREEN" || value === "YELLOW" || value === "RED"
        ? value
        : "EMPTY";
    return;
  }
  if (
    field === "headUsers" ||
    field === "noticeUsers" ||
    field === "projectMembers"
  ) {
    form[field] = Array.isArray(value) ? value : [];
    return;
  }
  form[field] =
    value === "GREEN" || value === "YELLOW" || value === "RED"
      ? value
      : "EMPTY";
}

async function loadMeetingConclusions(
  currentTask: CommitteeReviewTask,
  requestId: number,
) {
  if (!isCurrentLoadRequest(requestId)) return;
  meetingHistory.value = { second: [], group: [] };
  meetingConclusions.value = [];
  conclusionAttachments.value = {};
  conclusionLoading.value = false;
  if (!currentTask.projectId || !currentTask.gateId) return;

  conclusionLoading.value = true;
  try {
    const history = await fetchCommitteeGateMeetings(
      currentTask.projectId,
      currentTask.gateId,
    );
    if (!isCurrentLoadRequest(requestId)) return;
    meetingHistory.value = history;
    const meetings = [...history.second, ...history.group];
    const results = await Promise.allSettled(
      meetings.map((meeting) => fetchCommitteeConclusions(meeting.id)),
    );
    if (!isCurrentLoadRequest(requestId)) return;
    meetingConclusions.value = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const attachments = await loadMeetingAttachments(meetings);
    if (!isCurrentLoadRequest(requestId)) return;
    conclusionAttachments.value = attachments;
  } catch {
    if (!isCurrentLoadRequest(requestId)) return;
    meetingHistory.value = { second: [], group: [] };
    meetingConclusions.value = [];
    conclusionAttachments.value = {};
  } finally {
    if (isCurrentLoadRequest(requestId)) conclusionLoading.value = false;
  }
}

async function loadMeetingAttachments(
  meetings: CommitteeMeeting[],
): Promise<Record<string, CommitteeAttachment[]>> {
  const results = await Promise.allSettled(
    meetings.map(async (meeting) => {
      const files = await fetchCommitteeAttachments("MEETING", meeting.id);
      return [String(meeting.id), files] as const;
    }),
  );
  return Object.fromEntries(
    results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value),
  );
}

function applyReviewContent(currentTask: CommitteeReviewTask) {
  const currentRecord =
    currentTask.records?.find(
      (record) => String(record.id) === String(currentTask.currentRecordId),
    ) ??
    currentTask.records?.find(
      (record) => record.versionNo === currentTask.currentVersionNo,
    );

  // 如果任务处于草稿/未提交状态且存在草稿内容，应优先使用草稿
  const hasDraft =
    currentTask.draft &&
    typeof currentTask.draft === "object" &&
    Object.keys(currentTask.draft).length > 0;

  const reviewContent =
    currentTask.taskStatus === "DRAFT" && hasDraft
      ? currentTask.draft
      : (currentRecord?.content ?? currentTask.draft ?? {});

  Object.assign(form, createEmptyReviewContent(), reviewContent);
}

async function loadProjectDetail(
  currentTask: CommitteeReviewTask,
  requestId: number,
) {
  if (!currentTask.projectId) return;
  try {
    const detail = await fetchCommitteeProject(currentTask.projectId);
    if (isCurrentLoadRequest(requestId)) projectDetail.value = detail;
  } catch {
    if (isCurrentLoadRequest(requestId)) projectDetail.value = null;
  }
}

async function loadReviewSummary(
  currentTask: CommitteeReviewTask,
  requestId: number,
  progressOnly: boolean,
) {
  if (!currentTask.gateId) return;
  try {
    const summary = await fetchCommitteeReviewSummary(currentTask.gateId, {
      reviewVersionId: currentTask.reviewVersionId,
      ...(progressOnly ? { progressOnly: true } : {}),
    });
    if (!isCurrentLoadRequest(requestId)) return;
    if (progressOnly) {
      progressReviewSummary.value = summary;
    } else {
      reviewSummary.value = summary;
    }
  } catch {
    if (!isCurrentLoadRequest(requestId)) return;
    if (progressOnly) {
      progressReviewSummary.value = null;
    } else {
      reviewSummary.value = null;
    }
  }
}

async function load() {
  const requestId = ++latestLoadRequestId;
  if (!taskId.value) return;
  loading.value = true;
  loadError.value = undefined;
  try {
    const currentTask = await fetchCommitteeReviewTask(taskId.value);
    if (!isCurrentLoadRequest(requestId)) return;

    task.value = currentTask;
    projectDetail.value = null;
    reviewSummary.value = null;
    progressReviewSummary.value = null;
    applyReviewContent(currentTask);

    void loadMeetingConclusions(currentTask, requestId);
    void loadProjectDetail(currentTask, requestId);
    void loadReviewSummary(currentTask, requestId, false);
    void loadReviewSummary(currentTask, requestId, true);
  } catch (reason) {
    if (!isCurrentLoadRequest(requestId)) return;
    const source = reason as {
      code?: string;
      message?: string;
      traceId?: string;
    };
    task.value = undefined;
    loadError.value = {
      code: source.code ?? "COMMITTEE_REVIEW_DETAIL_ERROR",
      message: source.message ?? "评审详情加载失败",
      traceId: source.traceId,
    };
  } finally {
    if (isCurrentLoadRequest(requestId)) loading.value = false;
  }
}

async function save(submit: boolean) {
  if (!task.value) return;
  const rawContentText = String(form.contentText ?? "");
  if (form.conclusionSignal === "EMPTY") {
    BaseToast.warning("请选择结论建议");
    return;
  }
  if (new Blob([rawContentText]).size > reviewContentMaxBytes) {
    BaseToast.warning("评审内容数据过大，请减少图片或附件后重试");
    return;
  }
  const contentText = extractCommitteeReviewText(rawContentText);
  const contentCharacterCount = Array.from(contentText).length;
  const hasAllowedInlineImage = Array.from(
    rawContentText.matchAll(inlineImageSourceAttributePattern),
  ).some((match) =>
    [match[1] ?? match[2] ?? match[3] ?? ""].some(
      (source) =>
        allowedInlineImageDataSourcePattern.test(source) ||
        allowedRichTextImageUrlPattern.test(source),
    ),
  );
  if (!contentText.trim() && !hasAllowedInlineImage) {
    BaseToast.warning("请填写评审内容");
    return;
  }
  if (contentCharacterCount > committeeReviewContentMaxCharacters) {
    BaseToast.warning("评审内容不能超过 5000 个字符");
    return;
  }
  if (!form.headUsers?.length) {
    BaseToast.warning("请选择负责人");
    return;
  }
  const attachmentIds = extractRichTextAttachmentIds(rawContentText);
  saving.value = true;
  try {
    if (submit) {
      await saveCommitteeReview(
        task.value.id,
        task.value.lockVersion,
        { ...form },
        true,
        attachmentIds,
      );
    } else {
      task.value = await saveCommitteeReview(
        task.value.id,
        task.value.lockVersion,
        { ...form },
        false,
        attachmentIds,
      );
    }
    BaseToast.success(submit ? "评审已提交负责人审批" : "评审草稿已保存");
    if (submit) await router.replace(`/committee/reviews/${taskId.value}`);
    await load();
  } finally {
    saving.value = false;
  }
}

async function decide(action: "approve" | "reject") {
  if (!task.value?.currentRecordId) return;
  if (action === "reject" && !opinion.value.trim()) {
    BaseToast.warning("驳回时必须填写审批意见");
    return;
  }
  saving.value = true;
  try {
    await decideCommitteeReview(
      task.value.currentRecordId,
      action,
      task.value.lockVersion,
      opinion.value.trim(),
    );
    BaseToast.success(action === "approve" ? "评审已同意" : "评审已驳回");
    await router.replace(`/committee/reviews/${taskId.value}`);
    await load();
  } finally {
    saving.value = false;
  }
}

async function rollbackDraft() {
  if (!task.value || !canRollbackDraft.value) return;

  try {
    await openConfirm({
      title: "修改确认",
      message: "点击修改后，会退回到草稿状态，需负责人重新审批评审建议内容",
      type: "warning",
      confirmText: "确认修改",
      cancelText: "取消",
    });
  } catch {
    return;
  }

  saving.value = true;
  try {
    await rollbackCommitteeReviewDraft(task.value.id, task.value.lockVersion);
    BaseToast.success("已转为草稿，可重新修改评审内容");
    await router.replace({
      path: `/committee/reviews/${taskId.value}`,
      query: { mode: "edit" },
    });
    await load();
  } finally {
    saving.value = false;
  }
}

async function loadApprovalResultOptions() {
  try {
    const items = await fetchPlatformDictItems(
      "committee_approval_result_status",
    );
    approvalResultOptions.value = items.length
      ? items
      : fallbackApprovalResultOptions;
  } catch {
    approvalResultOptions.value = fallbackApprovalResultOptions;
  }
}

async function reload() {
  await Promise.all([load(), loadApprovalResultOptions()]);
}

watch(
  taskId,
  () => {
    void load();
  },
  { immediate: true, flush: "sync" },
);

onBeforeUnmount(() => {
  isUnmounted = true;
  latestLoadRequestId += 1;
});

onMounted(() => {
  void fetchPlatformDictItems("committee_review_status").then(
    (items) => {
      reviewStatusOptions.value = items.length
        ? items
        : fallbackReviewStatusOptions;
    },
    () => {
      reviewStatusOptions.value = fallbackReviewStatusOptions;
    },
  );
  void loadApprovalResultOptions();
  void fetchPlatformDictItems("committee_meeting_status").then(
    (items) => {
      meetingStatusOptions.value = items;
    },
    () => {
      meetingStatusOptions.value = [];
    },
  );
  void fetchPlatformDictItems("committee_conclusion_decision").then(
    (items) => {
      conclusionStatusOptions.value = items;
    },
    () => {
      conclusionStatusOptions.value = [];
    },
  );
  void fetchPlatformDictItems("committee_second_confirm_status").then(
    (items) => {
      secondConfirmStatusOptions.value = items;
    },
    () => {
      secondConfirmStatusOptions.value = [];
    },
  );
});
</script>

<template>
  <PageContainer
    class="review-detail-page"
    :title="historyOnly ? '评审版本历史' : approving ? '评审审批' : '评审详情'"
  >
    <TraceErrorAlert v-if="loadError" v-bind="loadError" />
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
                '/committee/reviews',
            ),
          )
        "
        >返回
      </PermissionButton>
      <PermissionButton :loading="loading" @click="reload"
        >刷新
      </PermissionButton>
      <PermissionButton
        v-if="false && editable"
        permission="committee:project:review-draft-save"
        :loading="saving"
        @click="save(false)"
        >保存草稿
      </PermissionButton>
      <PermissionButton
        v-if="false && editable"
        permission="committee:project:review-submit"
        type="primary"
        :loading="saving"
        @click="save(true)"
        >正式提交
      </PermissionButton>
    </template>
    <CommitteePageStack v-loading="loading" class="review-detail">
      <!--      阀点评审信息-->
      <CommitteeReviewTaskInfoPanel
        :task="task"
        :project-detail="projectDetail"
        :review-status-options="reviewStatusOptions"
        :approval-result-options="approvalResultOptions"
        :second-confirm-status-options="secondConfirmStatusOptions"
      />
      <!--      时间进度看板-->
      <CommitteeTimeBoard
        v-if="!historyOnly"
        :project-id="task?.projectId"
        :gate-id="task?.gateId"
        :review-version-id="task?.reviewVersionId"
        :history="meetingHistory"
        :review-summary="progressReviewSummary"
        progress-only
        :conclusion-map="conclusionMap"
        :meeting-status-options="meetingStatusOptions"
        :conclusion-status-options="conclusionStatusOptions"
        :review-status-options="reviewStatusOptions"
        :approval-result-options="approvalResultOptions"
        :second-confirm-status-options="secondConfirmStatusOptions"
      />
      <!-- 会议结论-->
      <CommitteeMeetingConclusionReferencePanel
        v-if="!historyOnly && meetingConclusionItems.length"
        :items="meetingConclusionItems"
        :loading="conclusionLoading"
        :conclusion-status-options="conclusionStatusOptions"
      />
      <!--      阀点评审建议-->
      <CommitteeReviewEditPanel
        v-if="!historyOnly"
        :model-value="form"
        :editable="editable"
        :review-task-id="taskId"
        :task-id="task?.id"
        :record-id="task?.currentRecordId"
        :department-id="task?.departmentId"
        :project-id="task?.projectId"
        :reviewer-user-id="task?.reviewerUserId"
        :current-version-no="task?.currentVersionNo"
        :project-name="projectDetail?.project.projectName ?? task?.projectName"
        :valve-point="projectDetail?.currentGate?.gateName ?? task?.gateName"
        @update-field="updateReviewField"
      >
        <template #actions-extra>
          <PermissionButton
            v-if="canRollbackDraft"
            plain
            permission="committee:review:draft"
            type="primary"
            :loading="saving"
            @click="rollbackDraft"
          >
            修改
          </PermissionButton>
          <PermissionButton
            v-if="editable"
            permission="committee:project:review-draft-save"
            :loading="saving"
            @click="save(false)"
          >
            保存草稿
          </PermissionButton>
          <PermissionButton
            v-if="editable"
            permission="committee:project:review-submit"
            type="primary"
            :loading="saving"
            @click="save(true)"
          >
            正式提交
          </PermissionButton>
        </template>
      </CommitteeReviewEditPanel>
      <!--      审批与建议-->
      <CommitteeReviewAdvicePanel
        v-if="!historyOnly"
        v-model:opinion="opinion"
        :task="task"
        :record-id="task?.currentRecordId"
        :approving="approving"
        :notice-editable="suggesting"
        :saving="saving"
        :review-status-options="reviewStatusOptions"
        :approval-result-options="approvalResultOptions"
        @reject="decide('reject')"
        @approve="decide('approve')"
      />
      <!--      项目组协调回复-->
      <CommitteeReviewCollaborationPanel
        v-if="!historyOnly"
        :record-id="task?.currentRecordId"
        :editable="!viewOnly && !suggesting"
      />
      <!--      各部室评审建议汇总-->
      <PermissionGuard permission="committee:project:review-summary-vie">
        <CommitteeReviewSummaryPanel
          v-if="!historyOnly"
          :gate-id="task?.gateId"
          :review-version-id="task?.reviewVersionId"
          :summary="reviewSummary"
          :show-second-meeting-status="false"
          :review-status-options="reviewStatusOptions"
          :approval-result-options="approvalResultOptions"
          :conclusion-status-options="conclusionStatusOptions"
        />
      </PermissionGuard>
      <!--      本部室评审记录-->
      <CommitteeReviewRecordPanel
        v-if="!historyOnly"
        :review-record-id="task?.currentRecord?.id ?? task?.currentRecordId"
        :records="task?.records ?? []"
        :review-status-options="reviewStatusOptions"
        :approval-result-options="approvalResultOptions"
        :conclusion-status-options="conclusionStatusOptions"
      />
    </CommitteePageStack>
  </PageContainer>
  <BaseConfirm
    v-model="confirmState.visible"
    :title="confirmState.title"
    :message="confirmState.message"
    :type="confirmState.type"
    :confirm-text="confirmState.confirmText"
    :cancel-text="confirmState.cancelText"
    :loading="saving"
    @confirm="resolveConfirm"
    @cancel="rejectConfirm"
  />
</template>

<style scoped>
.review-detail-page {
  background-color: #f9f9f9;
}

.review-detail {
  --review-detail-panel-border-color: color-mix(
    in srgb,
    var(--bq-color-border, var(--el-border-color)) 72%,
    var(--bq-color-surface, #ffffff)
  );
  --review-detail-panel-shadow:
    0 9px 22px rgba(15, 23, 42, 0.06), 0 1px 0 rgba(255, 255, 255, 0.82) inset;

  min-width: 0;
}

.review-detail :deep(.committee-section) {
  gap: 18px;
}

.review-detail :deep(.review-task-info-panel),
.review-detail :deep(.project-detail__time-board),
.review-detail :deep(.meeting-conclusion-reference),
.review-detail :deep(.review-advice),
.review-detail :deep(.collaboration),
.review-detail :deep(.review-summary),
.review-detail :deep(.review-record-panel) {
  background: var(--bq-color-surface, #ffffff);
  border: 1px solid var(--review-detail-panel-border-color);
  border-radius: var(--bq-radius-control, 4px);
  box-shadow: var(--review-detail-panel-shadow);
  transform: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.review-detail :deep(.committee-section__header),
.review-detail :deep(.review-advice__header),
.review-detail :deep(.collaboration__header),
.review-detail :deep(.review-summary__header),
.review-detail :deep(.review-record-panel__header),
.review-detail :deep(.project-detail__time-board-head) {
  min-height: 32px;
  padding: 0 0 10px;
  background: transparent;
  border-bottom: 1px solid var(--bq-color-border-subtle);
  border-radius: 0;
}

.review-detail :deep(.review-edit-panel .committee-section__header) {
  width: calc(100% + 32px);
  margin: -16px -16px 0;
  padding: 12px 16px;
  background: linear-gradient(
    90deg,
    color-mix(
      in srgb,
      var(--bq-color-primary-soft, #edf4ff) 76%,
      var(--bq-color-surface, #ffffff)
    ),
    color-mix(
      in srgb,
      var(--bq-color-primary-soft, #edf4ff) 52%,
      var(--bq-color-surface, #ffffff)
    )
  );
  border: 0;
  border-bottom: 1px solid
    color-mix(
      in srgb,
      var(--bq-color-primary-blue, var(--el-color-primary)) 12%,
      var(--bq-color-border-subtle, var(--el-border-color-lighter))
    );
  border-radius: calc(var(--bq-radius-control, 4px) - 1px)
    calc(var(--bq-radius-control, 4px) - 1px) 0 0;
}

.review-detail :deep(.el-table .cell) {
  padding: 11px 14px;
  font-size: var(--bq-font-body, 14px);
  line-height: 22px;
}

.review-detail :deep(.el-table__header-wrapper th .cell) {
  font-weight: 700;
}

.review-detail :deep(.el-table__header-wrapper th) {
  color: var(--bq-color-text, var(--el-text-color-primary));
  /* background: var(--bq-color-table-header, var(--el-fill-color-light)); */
}

.review-detail :deep(.el-button.is-link) {
  font-size: var(--bq-font-body, 14px);
  line-height: 22px;
}
</style>
