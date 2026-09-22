<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";
import { Folder, FullScreen, ScaleToOriginal } from "@element-plus/icons-vue";
import BaseRichViewer from "@/components/base/BaseRichViewer.vue";
import {
  downloadCommitteeAttachment,
  fetchCommitteeAttachments,
  fetchCommitteeReplyMessages,
  fetchCommitteeReplyTopics,
  fetchCommitteeReviewRecord,
  fetchCommitteeReviewNotices,
} from "@/api/committee";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import DictTag from "@/components/base/DictTag.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  CommitteeAttachment,
  CommitteeReplyMessage,
  CommitteeReplyTopic,
  CommitteeReviewContent,
  CommitteeReviewMeetingDetail,
  CommitteeReviewNotice,
  CommitteeReviewRecord,
  CommitteeSignal,
} from "@/types/committee";
import CommitteeDate from "./CommitteeDate.vue";
import CommitteeAttachmentList from "./CommitteeAttachmentList.vue";
import CommitteeFilePreviewDialog from "./CommitteeFilePreviewDialog.vue";
import type { SchemaOption } from "@/types/schema-components";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    versionLabel?: string;
    reviewRecordId?: string;
    contentLoading?: boolean;
    record?: CommitteeReviewRecord | null;
    departmentName?: string;
    taskStatus?: string;
    versionNo?: number;
    updateTime?: string;
    reviewStatusOptions?: SchemaOption[];
    approvalResultOptions?: SchemaOption[];
    conclusionStatusOptions?: SchemaOption[];
  }>(),
  {
    title: "版本详情",
    versionLabel: "评审版本",
    contentLoading: false,
    record: null,
    departmentName: undefined,
    taskStatus: undefined,
    versionNo: undefined,
    updateTime: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

interface ReplyTopicBundle {
  topic: CommitteeReplyTopic;
  messages: CommitteeReplyMessage[];
  topicAttachments: CommitteeAttachment[];
  messageAttachments: Record<string, CommitteeAttachment[]>;
  collapsed: boolean;
}

const replyTopicAttachmentBizCode = "REPLY_TOPIC";
const replyMessageAttachmentBizCode = "REPLY_MESSAGE";
const reviewRecordAttachmentBizCode = "REVIEW_RECORD";
const collaborationLoading = ref(false);
const replyBundles = ref<ReplyTopicBundle[]>([]);
const noticeLoading = ref(false);
const notices = ref<CommitteeReviewNotice[]>([]);
const reviewAttachments = ref<CommitteeAttachment[]>([]);
const reviewAttachmentLoading = ref(false);
const previewVisible = ref(false);
const previewFile = ref<Blob | null>(null);
const previewTitle = ref("");
const isFullscreen = ref(false);
const loadedReviewContent = ref<CommitteeReviewContent | null>(null);
let reviewContentRequestSequence = 0;

const reviewContentLoading = computed(
  () => props.contentLoading || reviewAttachmentLoading.value,
);

const drawerSize = computed(() =>
  isFullscreen.value ? "100%" : "min(720px, 100vw)",
);

const detailTitle = computed(() =>
  props.departmentName ? `${props.departmentName}评审详情` : props.title,
);

const departmentDetail = computed(() => Boolean(props.departmentName));

const recordSource = computed<Record<string, unknown>>(
  () => (props.record ?? {}) as unknown as Record<string, unknown>,
);

const content = computed<Partial<CommitteeReviewContent>>(
  () => loadedReviewContent.value ?? props.record?.content ?? {},
);

const reviewContentText = computed(() =>
  String(content.value.contentText ?? ""),
);

const resolvedVersionNo = computed(
  () => props.record?.versionNo ?? props.versionNo,
);

const statusValue = computed(
  () =>
    String(
      recordValue(["recordStatus", "auditResult", "reviewStatus"]) ??
        props.taskStatus ??
        "",
    ) || undefined,
);

const approvalActionValue = computed(() =>
  String(recordValue(["approvalAction"]) ?? ""),
);

const approvalTime = computed(() =>
  recordValue([
    "approveTime",
    "approvalTime",
    "auditTime",
    "reviewTime",
    "headApproveTime",
    "decidedAt",
    "decidedTime",
  ]),
);

const meetingUsageText = computed(() => {
  const text = recordValue([
    "meetingName",
    "meetingLabel",
    "meetingTitle",
    "meetingDisplayName",
    "meetingNo",
  ]);
  if (text) return String(text);
  if (typeof recordSource.value.attendMeeting === "boolean") {
    return recordSource.value.attendMeeting ? "是" : "否";
  }
  if (typeof recordSource.value.canMeeting === "boolean") {
    return recordSource.value.canMeeting ? "是" : "否";
  }
  return "--";
});

const signalRows: Array<{
  key: keyof CommitteeReviewContent;
  label: string;
}> = [
  { key: "techSignal", label: "技术/费用" },
  { key: "revenueSignal", label: "收益" },
  { key: "volumePriceSignal", label: "量价" },
  { key: "competitivenessSignal", label: "竞争力" },
  { key: "qualitySignal", label: "质量" },
  { key: "conclusionSignal", label: "结论建议" },
];

const latestReplyTime = computed(() => {
  const times = replyBundles.value.flatMap((bundle) => [
    topicTime(bundle.topic),
    ...bundle.messages.map((message) => message.replyTime),
  ]);
  return times
    .filter(Boolean)
    .sort((a, b) => String(b).localeCompare(String(a)))[0];
});

const meetingDetails = computed<CommitteeReviewMeetingDetail[]>(() => {
  const embeddedDetails = (
    props.record as unknown as {
      meetingDetails?: CommitteeReviewMeetingDetail[];
    } | null
  )?.meetingDetails;
  if (Array.isArray(embeddedDetails) && embeddedDetails.length) {
    return sortMeetingDetails(embeddedDetails);
  }
  const meetingName = String(recordValue(["meetingName"]) ?? "");
  if (!meetingName || meetingName === "--") return [];
  return sortMeetingDetails([
    {
      id: String(recordValue(["meetingId"]) ?? props.record?.id ?? "meeting"),
      meetingTitle: meetingName,
      meetingName,
      meetingTime: String(recordValue(["meetingTime"]) ?? ""),
      conclusionLabel: String(recordValue(["meetingConclusionLabel"]) ?? "--"),
      conclusionDecision: String(
        recordValue(["meetingConclusionDecision", "conclusionDecision"]) ?? "",
      ),
      decisionItems: String(recordValue(["meetingDecisionItems"]) ?? "--"),
      attachments:
        (
          props.record as unknown as {
            meetingAttachments?: CommitteeAttachment[];
          } | null
        )?.meetingAttachments ?? [],
    },
  ]);
});

function sortMeetingDetails(rows: CommitteeReviewMeetingDetail[]) {
  return [...rows].sort((left, right) => {
    const levelDifference = meetingLevelRank(left) - meetingLevelRank(right);
    if (levelDifference) return levelDifference;

    const attemptDifference = meetingAttemptNo(right) - meetingAttemptNo(left);
    if (attemptDifference) return attemptDifference;

    const timeDifference = String(right.meetingTime ?? "").localeCompare(
      String(left.meetingTime ?? ""),
    );
    if (timeDifference) return timeDifference;

    return String(left.id).localeCompare(String(right.id));
  });
}

function meetingLevelRank(meeting: CommitteeReviewMeetingDetail) {
  const source = meeting as CommitteeReviewMeetingDetail &
    Record<string, unknown>;
  const level = String(source.meetingLevel ?? "").toUpperCase();
  if (level === "GROUP") return 0;
  if (level === "SECOND") return 1;

  const meetingText = `${meeting.meetingTitle} ${meeting.meetingName}`;
  if (meetingText.includes("集团")) return 0;
  if (meetingText.includes("二级")) return 1;
  return 2;
}

function meetingAttemptNo(meeting: CommitteeReviewMeetingDetail) {
  const source = meeting as CommitteeReviewMeetingDetail &
    Record<string, unknown>;
  const attemptNo = Number(source.attemptNo);
  if (Number.isFinite(attemptNo)) return attemptNo;

  const meetingText = `${meeting.meetingTitle} ${meeting.meetingName}`;
  const matchedAttempt = meetingText.match(/第\s*(\d+)\s*(?:会次|次)/);
  return matchedAttempt ? Number(matchedAttempt[1]) : 0;
}

function meetingConclusionValue(meeting: CommitteeReviewMeetingDetail) {
  const source = meeting as CommitteeReviewMeetingDetail &
    Record<string, unknown>;
  return (
    source.conclusionDecision ??
    source.meetingConclusionDecision ??
    meeting.conclusionLabel ??
    ""
  );
}

function updateVisible(value: boolean) {
  emit("update:modelValue", value);
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

function handleFullscreenEscape(event: KeyboardEvent) {
  if (event.key !== "Escape" || !props.modelValue || !isFullscreen.value) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  isFullscreen.value = false;
}

function recordValue(keys: string[]): string | number | Date | undefined {
  for (const key of keys) {
    const value = recordSource.value[key];
    if (value !== null && value !== undefined && value !== "") {
      return value as string | number | Date;
    }
  }
  return undefined;
}

function signalLabel(value?: CommitteeSignal) {
  if (value === "EMPTY") return "--";
  if (value === "GREEN") return "绿";
  if (value === "YELLOW") return "黄";
  if (value === "RED") return "红";
  return "--";
}

function hasSignal(value?: CommitteeSignal) {
  return value === "GREEN" || value === "YELLOW" || value === "RED";
}

function signalClass(value?: CommitteeSignal) {
  return `is-${String(value ?? "EMPTY").toLowerCase()}`;
}

function topicTime(row: CommitteeReplyTopic) {
  const source = row as unknown as Record<string, unknown>;
  const value =
    source.createTime ??
    source.createdTime ??
    source.startTime ??
    source.starterTime ??
    row.lastReplyTime;
  return value as string | number | Date | undefined;
}

async function fetchAttachments(bizCode: string, bizId: string) {
  try {
    return await fetchCommitteeAttachments(bizCode, bizId);
  } catch {
    return [];
  }
}

function isCurrentReviewContentRequest(
  requestSequence: number,
  record: CommitteeReviewRecord,
) {
  return (
    requestSequence === reviewContentRequestSequence &&
    props.modelValue &&
    props.record === record &&
    props.record.content == null
  );
}

async function loadReviewContent() {
  const requestSequence = ++reviewContentRequestSequence;
  loadedReviewContent.value = null;
  const record = props.record;
  if (!props.modelValue || !record?.id || record.content != null) return;

  try {
    const fullRecord = await fetchCommitteeReviewRecord(record.id);
    if (!isCurrentReviewContentRequest(requestSequence, record)) return;
    loadedReviewContent.value = fullRecord.content ?? null;
  } catch {
    // Keep the caller-provided metadata visible when content loading fails.
  }
}

async function loadCollaboration() {
  replyBundles.value = [];
  if (!props.modelValue || !props.record?.id) return;
  collaborationLoading.value = true;
  try {
    const topics = await fetchCommitteeReplyTopics(props.record.id);
    const bundles = await Promise.all(
      topics.map(async (topic) => {
        const [messagesResult, topicAttachments] = await Promise.all([
          fetchCommitteeReplyMessages(topic.id).catch(() => []),
          fetchAttachments(replyTopicAttachmentBizCode, topic.id),
        ]);
        const messageAttachmentEntries = await Promise.all(
          messagesResult.map(async (message) => {
            const embeddedAttachments = (
              message as unknown as {
                attachments?: CommitteeAttachment[];
              }
            ).attachments;
            const attachments = Array.isArray(embeddedAttachments)
              ? embeddedAttachments
              : await fetchAttachments(
                  replyMessageAttachmentBizCode,
                  message.id,
                );
            return [message.id, attachments] as const;
          }),
        );
        return {
          topic,
          messages: messagesResult,
          topicAttachments,
          messageAttachments: Object.fromEntries(messageAttachmentEntries),
          collapsed: false,
        };
      }),
    );
    replyBundles.value = bundles.sort((left, right) =>
      String(
        topicTime(right.topic) ?? right.topic.lastReplyTime ?? "",
      ).localeCompare(
        String(topicTime(left.topic) ?? left.topic.lastReplyTime ?? ""),
      ),
    );
  } finally {
    collaborationLoading.value = false;
  }
}

async function loadNotices() {
  notices.value = [];
  if (!props.modelValue || !props.record?.id) return;
  noticeLoading.value = true;
  try {
    notices.value = await fetchCommitteeReviewNotices(props.record.id);
  } finally {
    noticeLoading.value = false;
  }
}

async function loadReviewAttachments() {
  reviewAttachments.value = [];
  const reviewRecordId = props.record?.id ?? props.reviewRecordId;
  if (!props.modelValue || !reviewRecordId) return;

  reviewAttachmentLoading.value = true;
  try {
    reviewAttachments.value = await fetchAttachments(
      reviewRecordAttachmentBizCode,
      reviewRecordId,
    );
  } finally {
    reviewAttachmentLoading.value = false;
  }
}

async function previewAttachment(row: CommitteeAttachment) {
  previewFile.value = null;
  previewTitle.value = row.fileName;
  previewVisible.value = true;
  try {
    if (row.fileUrl) {
      const response = await globalThis.fetch(row.fileUrl);
      if (!response.ok) throw new Error("附件下载失败");
      previewFile.value = await response.blob();
      return;
    }
    const response = await downloadCommitteeAttachment(row.id);
    previewFile.value = response.data;
  } catch {
    previewVisible.value = false;
    // Keep the drawer usable when an attachment cannot be fetched.
  }
}

async function downloadAttachment(row: CommitteeAttachment) {
  try {
    const blob = row.fileUrl
      ? await fetchAttachmentBlob(row.fileUrl)
      : (await downloadCommitteeAttachment(row.id)).data;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = row.fileName || "附件";
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    // Keep the drawer usable when an attachment cannot be downloaded.
  }
}

async function fetchAttachmentBlob(fileUrl: string) {
  const response = await globalThis.fetch(fileUrl);
  if (!response.ok) throw new Error("附件下载失败");
  return response.blob();
}

watch(() => [props.modelValue, props.record?.id] as const, loadCollaboration, {
  immediate: true,
});
watch(() => [props.modelValue, props.record?.id] as const, loadNotices, {
  immediate: true,
});
watch(
  () => [props.modelValue, props.record?.id, props.reviewRecordId] as const,
  loadReviewAttachments,
  {
    immediate: true,
  },
);
watch(
  () => [props.modelValue, props.record, props.record?.content] as const,
  loadReviewContent,
  { immediate: true },
);
watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) isFullscreen.value = false;
  },
);

function setupFullscreenEvent() {
  window.removeEventListener("keydown", handleFullscreenEscape, true);
  window.addEventListener("keydown", handleFullscreenEscape, true);
}

function teardownFullscreenEvent() {
  window.removeEventListener("keydown", handleFullscreenEscape, true);
}

onMounted(setupFullscreenEvent);
onActivated(setupFullscreenEvent);
onDeactivated(() => {
  ++reviewContentRequestSequence;
  isFullscreen.value = false;
  teardownFullscreenEvent();
  if (props.modelValue) emit("update:modelValue", false);
});

onBeforeUnmount(() => {
  ++reviewContentRequestSequence;
  teardownFullscreenEvent();
});
</script>

<template>
  <BaseDrawer
    :model-value="modelValue"
    :title="detailTitle"
    :size="drawerSize"
    :show-footer="false"
    :close-on-press-escape="!isFullscreen"
    class="review-detail-drawer-shell"
    :class="{ 'is-fullscreen': isFullscreen }"
    @update:model-value="updateVisible"
  >
    <template #header-extra>
      <PermissionButton
        class="review-detail-drawer__fullscreen-toggle"
        data-testid="review-detail-fullscreen-toggle"
        link
        :icon="isFullscreen ? ScaleToOriginal : FullScreen"
        :aria-label="isFullscreen ? '退出全屏' : '全屏查看'"
        :aria-pressed="isFullscreen"
        :title="isFullscreen ? '退出全屏' : '全屏查看'"
        @click="toggleFullscreen"
      >
        {{ isFullscreen ? "退出全屏" : "全屏查看" }}
      </PermissionButton>
    </template>
    <div
      class="review-detail-drawer bq-drawer-detail"
      :class="{ 'is-fullscreen': isFullscreen }"
    >
      <section class="bq-drawer-detail__section">
        <BaseSectionTitle
          class="bq-drawer-detail__section-head"
          :title="departmentDetail ? '评审的基本信息' : '基本信息'"
          size="small"
          heading-tag="h3"
        />
        <el-descriptions v-if="departmentDetail" :column="2" border>
          <el-descriptions-item label="评审部室">
            {{ departmentName }}
          </el-descriptions-item>
          <el-descriptions-item label="评审版本">
            {{ resolvedVersionNo ? `V${resolvedVersionNo}` : "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交人">
            {{ record?.submitterName || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            <CommitteeDate :value="record?.submitTime" with-seconds />
          </el-descriptions-item>
          <el-descriptions-item label="负责人">
            {{
              recordValue(["approverName", "auditUserName", "decidedByName"]) ||
              "--"
            }}
          </el-descriptions-item>
          <el-descriptions-item label="审批时间">
            <CommitteeDate :value="approvalTime" with-seconds />
          </el-descriptions-item>
          <el-descriptions-item label="评审状态">
            <DictTag
              :value="statusValue"
              :options="reviewStatusOptions ?? []"
            />
          </el-descriptions-item>
          <el-descriptions-item label="审批结果">
            <DictTag
              :value="approvalActionValue"
              :options="approvalResultOptions ?? []"
            />
          </el-descriptions-item>
        </el-descriptions>
        <el-descriptions v-else :column="2" border>
          <el-descriptions-item :label="versionLabel">
            {{ resolvedVersionNo ? `V${resolvedVersionNo}` : "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="关联会议">
            {{ meetingUsageText }}
          </el-descriptions-item>
          <el-descriptions-item label="提交人">
            {{ record?.submitterName || "--" }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            <CommitteeDate :value="record?.submitTime" with-seconds />
          </el-descriptions-item>
          <el-descriptions-item label="审批时间">
            <CommitteeDate :value="approvalTime" with-seconds />
          </el-descriptions-item>
          <el-descriptions-item label="审批结果">
            <DictTag
              :value="approvalActionValue"
              :options="approvalResultOptions ?? []"
            />
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="bq-drawer-detail__section">
        <BaseSectionTitle
          class="bq-drawer-detail__section-head"
          title="部门评审结论"
          size="small"
          heading-tag="h3"
        />
        <div
          class="review-detail-drawer__signals"
          data-testid="review-detail-signals"
          role="list"
        >
          <div
            v-for="item in signalRows"
            :key="item.key"
            class="review-detail-drawer__signal"
            :class="[
              signalClass(content[item.key] as CommitteeSignal),
              { 'is-conclusion': item.key === 'conclusionSignal' },
            ]"
            :data-testid="
              item.key === 'conclusionSignal'
                ? 'review-detail-conclusion-signal'
                : undefined
            "
            role="listitem"
          >
            <span class="review-detail-drawer__signal-label">{{
              item.label
            }}</span>
            <span
              v-if="hasSignal(content[item.key] as CommitteeSignal)"
              class="review-detail-drawer__signal-dot"
              role="img"
              :aria-label="signalLabel(content[item.key] as CommitteeSignal)"
              :title="signalLabel(content[item.key] as CommitteeSignal)"
            />
            <strong v-else>--</strong>
          </div>
        </div>
      </section>

      <section class="bq-drawer-detail__section">
        <BaseSectionTitle
          class="bq-drawer-detail__section-head"
          title="评审内容"
          size="small"
          heading-tag="h3"
        />
        <div
          v-loading="reviewContentLoading"
          class="review-detail-drawer__rich-text bq-drawer-detail__rich-text"
        >
          <BaseRichViewer
            class="review-detail-drawer__content-html"
            :content="reviewContentText"
          />
          <div
            v-if="reviewAttachments.length"
            class="review-detail-drawer__content-attachments"
          >
            <span>附件</span>
            <CommitteeAttachmentList
              :files="reviewAttachments"
              :editable="false"
              @preview="previewAttachment"
              @download="downloadAttachment"
            />
          </div>
        </div>
      </section>

      <section class="bq-drawer-detail__section">
        <BaseSectionTitle
          class="bq-drawer-detail__section-head"
          title="审批内容"
          size="small"
          heading-tag="h3"
        />
        <el-descriptions :column="1" border>
          <el-descriptions-item label="负责人">
            {{
              recordValue(["approverName", "auditUserName", "decidedByName"]) ||
              "--"
            }}
          </el-descriptions-item>
          <el-descriptions-item label="审批意见">
            {{
              recordValue([
                "rejectReason",
                "auditOpinion",
                "approvalOpinion",
              ]) || "--"
            }}
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section v-if="notices.length" class="bq-drawer-detail__section">
        <BaseSectionTitle
          class="bq-drawer-detail__section-head"
          title="知会人建议"
          size="small"
          heading-tag="h3"
        />
        <div
          v-loading="noticeLoading"
          class="review-detail-drawer__notice-list"
        >
          <article
            v-for="notice in notices"
            :key="notice.id"
            class="review-detail-drawer__notice-card"
          >
            <div class="review-detail-drawer__notice-card-head">
              <strong>{{ notice.noticeUserName || "--" }}</strong>
              <span>
                <CommitteeDate :value="notice.noticeTime" with-seconds />
              </span>
            </div>
            <p>{{ notice.noticeContent || "--" }}</p>
          </article>
        </div>
      </section>

      <section v-if="replyBundles.length" class="bq-drawer-detail__section">
        <BaseSectionTitle
          class="bq-drawer-detail__section-head"
          title="项目组协同回复"
          size="small"
          heading-tag="h3"
        />
        <div
          v-loading="collaborationLoading"
          class="review-detail-drawer__reply-list"
        >
          <article
            v-for="bundle in replyBundles"
            :key="bundle.topic.id"
            class="review-detail-drawer__reply-topic"
          >
            <header class="review-detail-drawer__reply-topic-head">
              <div class="review-detail-drawer__reply-topic-main">
                <strong>{{ bundle.topic.topicTitle }}</strong>
                <span>
                  {{ bundle.topic.starterName || "--" }} 发起于
                  <CommitteeDate :value="topicTime(bundle.topic)" with-seconds />
                </span>
              </div>
              <div class="review-detail-drawer__reply-topic-extra">
                <span>
                  {{ 1 + bundle.messages.length }} 条消息
                  <template v-if="latestReplyTime">
                    / 最近 <CommitteeDate :value="latestReplyTime" with-seconds />
                  </template>
                </span>
                <button
                  type="button"
                  class="review-detail-drawer__reply-collapse"
                  @click="bundle.collapsed = !bundle.collapsed"
                >
                  {{ bundle.collapsed ? "全部展示" : "收起" }}
                </button>
              </div>
            </header>

            <div
              v-if="!bundle.collapsed"
              class="review-detail-drawer__reply-timeline"
            >
              <article class="review-detail-drawer__reply-message">
                <span class="review-detail-drawer__reply-node" />
                <div class="review-detail-drawer__reply-message-body">
                  <header class="review-detail-drawer__reply-message-head">
                    <div>
<!--                      <span class="review-detail-drawer__reply-role">-->
<!--                        项目组成员-->
<!--                      </span>-->
                      <strong>{{ bundle.topic.starterName || "--" }}</strong>
<!--                      <span>项目部</span>-->
                    </div>
                    <CommitteeDate :value="topicTime(bundle.topic)" with-seconds />
                  </header>
                  <p>{{ bundle.topic.topicContent || "--" }}</p>
                  <div
                    v-if="bundle.topicAttachments.length"
                    class="review-detail-drawer__reply-attachments"
                  >
                    <span>附件</span>
                    <CommitteeAttachmentList
                      :files="bundle.topicAttachments"
                      :editable="false"
                      @preview="previewAttachment"
                      @download="downloadAttachment"
                    />
                  </div>
                </div>
              </article>

              <article
                v-for="message in bundle.messages"
                :key="message.id"
                class="review-detail-drawer__reply-message"
              >
                <span class="review-detail-drawer__reply-node" />
                <div class="review-detail-drawer__reply-message-body">
                  <header class="review-detail-drawer__reply-message-head">
                    <div>
<!--                      <span class="review-detail-drawer__reply-role">-->
<!--                        评审人-->
<!--                      </span>-->
                      <strong>{{ message.replyUserName || "--" }}</strong>
                      <span>
<!--                        {{ departmentName || "&#45;&#45;" }} -->
                        回复给
                        {{ bundle.topic.starterName || "--" }}
                      </span>
                    </div>
                    <CommitteeDate :value="message.replyTime" with-seconds />
                  </header>
                  <p>{{ message.replyContent || "--" }}</p>
                  <div
                    v-if="bundle.messageAttachments[message.id]?.length"
                    class="review-detail-drawer__reply-attachments"
                  >
                    <span>附件</span>
                    <CommitteeAttachmentList
                      :files="bundle.messageAttachments[message.id] ?? []"
                      :editable="false"
                      @preview="previewAttachment"
                      @download="downloadAttachment"
                    />
                  </div>
                </div>
              </article>
            </div>
          </article>
        </div>
      </section>

      <section v-if="meetingDetails.length" class="bq-drawer-detail__section">
        <BaseSectionTitle
          class="bq-drawer-detail__section-head"
          title="会议详情"
          size="small"
          heading-tag="h3"
        />
        <div
          v-if="meetingDetails.length"
          class="review-detail-drawer__meeting-list"
        >
          <article
            v-for="meeting in meetingDetails"
            :key="meeting.id"
            class="review-detail-drawer__meeting-card"
          >
            <header class="review-detail-drawer__meeting-head">
              <strong>{{ meeting.meetingTitle }}</strong>
              <CommitteeDate :value="meeting.meetingTime" with-seconds />
            </header>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="会议名称">
                {{ meeting.meetingName || "--" }}
              </el-descriptions-item>
              <el-descriptions-item label="会议结论">
                <DictTag
                  :value="meetingConclusionValue(meeting)"
                  :options="conclusionStatusOptions ?? []"
                  :fallback="meeting.conclusionLabel || '--'"
                />
              </el-descriptions-item>
              <el-descriptions-item label="会议决议事项">
                {{ meeting.decisionItems || "--" }}
              </el-descriptions-item>
              <el-descriptions-item
                v-if="meeting.attachments?.length"
                label="附件"
              >
                <div class="review-detail-drawer__meeting-attachments">
                  <button
                    v-for="file in meeting.attachments"
                    :key="file.id"
                    type="button"
                    @click="previewAttachment(file)"
                  >
                    <el-icon><Folder /></el-icon>
                    {{ file.fileName }}
                  </button>
                </div>
              </el-descriptions-item>
            </el-descriptions>
          </article>
        </div>
        <el-empty v-else description="当前版本暂无会议详情。" />
      </section>
    </div>
    <CommitteeFilePreviewDialog
      v-model="previewVisible"
      :file="previewFile"
      :file-name="previewTitle"
    />
  </BaseDrawer>
</template>

<style scoped>
.review-detail-drawer {
  gap: 14px;
}

:global(.review-detail-drawer-shell) {
  transition: width 0.2s ease;
}

:global(.review-detail-drawer-shell.is-fullscreen .el-drawer__header) {
  position: sticky;
  top: 0;
  z-index: 3;
  border-bottom: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-light));
  background: var(--bq-color-surface, #ffffff);
}

:global(.review-detail-drawer-shell.is-fullscreen .el-drawer__body) {
  padding: 20px 24px 24px;
  background: var(--bq-color-bg-soft, #fbfcfd);
}

.review-detail-drawer.is-fullscreen {
  width: min(1280px, 100%);
  margin: 0 auto;
}

.review-detail-drawer__fullscreen-toggle {
  min-height: 28px;
  padding: 0 8px;
  font-size: 13px;
}

.review-detail-drawer :deep(.bq-drawer-detail__section-head) {
  min-height: 24px;
}

.review-detail-drawer :deep(.el-descriptions__table) {
  table-layout: fixed;
}

.review-detail-drawer :deep(.el-descriptions__label),
.review-detail-drawer :deep(.el-descriptions__label.is-bordered-label) {
  width: 118px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 13px;
  font-weight: 400;
  background: #f8f9fb;
}

.review-detail-drawer :deep(.el-descriptions__content) {
  min-width: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 13px;
  font-weight: 400;
}

.review-detail-drawer__notice-list {
  display: grid;
  gap: 10px;
}

.review-detail-drawer__notice-card {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 10px;
  background: var(--bq-color-surface, #fff);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.review-detail-drawer__notice-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.review-detail-drawer__notice-card-head strong {
  min-width: 0;
  overflow: hidden;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-detail-drawer__notice-card-head span {
  flex: 0 0 auto;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  line-height: 20px;
}

.review-detail-drawer__notice-card p {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  line-height: 24px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.review-detail-drawer__signals {
  display: grid;
  grid-template-columns: repeat(5, minmax(max-content, 1fr)) minmax(
      132px,
      1.35fr
    );
  gap: 0;
  align-items: stretch;
  min-height: 56px;
  padding: 8px 10px;
  background: var(--bq-color-bg-soft, #fbfcfd);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.review-detail-drawer__signal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding: 8px 10px;
  background: transparent;
  border: 0;
  border-radius: 0;
  white-space: nowrap;
}

.review-detail-drawer__signal.is-conclusion {
  justify-content: flex-start;
  margin-left: 8px;
  padding: 8px 12px 8px 16px;
  background: var(--bq-color-primary-soft, #edf4ff);
  border-left: 1px solid var(--bq-color-border, var(--el-border-color));
  border-radius: var(--bq-radius-control, 4px);
}

.review-detail-drawer__signal-label {
  flex: 0 0 auto;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-body, 13px);
  line-height: 20px;
}

.review-detail-drawer__signal.is-conclusion
  .review-detail-drawer__signal-label {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-weight: 700;
}

.review-detail-drawer__signal-dot {
  display: inline-flex;
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--bq-color-text-muted, var(--el-text-color-placeholder));
}

.review-detail-drawer__signal.is-conclusion .review-detail-drawer__signal-dot {
  width: 12px;
  height: 12px;
}

.review-detail-drawer__signal strong {
  min-width: 0;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-body, 13px);
  font-weight: 600;
  line-height: 20px;
}

.review-detail-drawer__signal.is-green .review-detail-drawer__signal-dot {
  background: var(--bq-color-success, var(--el-color-success));
}

.review-detail-drawer__signal.is-yellow .review-detail-drawer__signal-dot {
  background: var(--bq-color-warning, var(--el-color-warning));
}

.review-detail-drawer__signal.is-red .review-detail-drawer__signal-dot {
  background: var(--bq-color-danger, var(--el-color-danger));
}

.review-detail-drawer__rich-text {
  display: grid;
  gap: 14px;
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
}

.review-detail-drawer__rich-text :deep(img) {
  max-width: 100%;
  height: auto;
  cursor: zoom-in;
  border-radius: 4px;
  transition:
    opacity 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    opacity: 0.95;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
}

.review-detail-drawer__rich-text :deep(video),
.review-detail-drawer__rich-text :deep(canvas) {
  max-width: 100%;
  height: auto;
}

.review-detail-drawer__rich-text :deep(table) {
  max-width: 100%;
}

.review-detail-drawer__content-attachments,
.review-detail-drawer__meeting-list,
.review-detail-drawer__reply-list {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.review-detail-drawer__content-attachments {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 10px 12px;
  border-top: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-light));
}

.review-detail-drawer__content-attachments > span {
  flex: 0 0 auto;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 13px;
  line-height: 22px;
}

.review-detail-drawer__meeting-attachments button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 0 8px;
  color: var(--bq-color-primary, var(--el-color-primary));
  font-size: 13px;
  line-height: 22px;
  background: var(--bq-color-surface, #ffffff);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
  cursor: pointer;
}

.review-detail-drawer__meeting-card {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  background: var(--bq-color-surface, #ffffff);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.review-detail-drawer__meeting-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.review-detail-drawer__meeting-head strong {
  min-width: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 15px;
  font-weight: 700;
  line-height: 24px;
}

.review-detail-drawer__meeting-head :deep(.committee-date) {
  flex: 0 0 auto;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: 13px;
  line-height: 22px;
}

.review-detail-drawer__meeting-attachments {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.review-detail-drawer__reply-list {
  min-height: 120px;
}

.review-detail-drawer__reply-topic {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 14px;
  background: var(--bq-color-surface, #ffffff);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.review-detail-drawer__reply-topic-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding-bottom: 12px;
  border-bottom: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-light));
}

.review-detail-drawer__reply-topic-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.review-detail-drawer__reply-topic-main strong {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
}

.review-detail-drawer__reply-topic-main span,
.review-detail-drawer__reply-topic-extra {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 13px;
  line-height: 20px;
}

.review-detail-drawer__reply-topic-extra {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 10px;
}

.review-detail-drawer__reply-collapse {
  height: 28px;
  padding: 0 8px;
  color: var(--bq-color-primary, var(--el-color-primary));
  font-size: 13px;
  line-height: 26px;
  background: var(--bq-color-primary-soft, #edf4ff);
  border: 1px solid
    color-mix(in srgb, var(--bq-color-primary, #4e8ffd) 16%, white);
  border-radius: var(--bq-radius-control, 4px);
  cursor: pointer;
}

.review-detail-drawer__reply-timeline {
  display: grid;
  gap: 0;
  min-width: 0;
}

.review-detail-drawer__reply-message {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 0;
  min-width: 0;
}

.review-detail-drawer__reply-message::before {
  position: absolute;
  top: 18px;
  bottom: -4px;
  left: 5px;
  width: 1px;
  background: var(--bq-color-border-subtle, var(--el-border-color-light));
  content: "";
}

.review-detail-drawer__reply-message:last-child::before {
  display: none;
}

.review-detail-drawer__reply-node {
  width: 12px;
  height: 12px;
  margin-top: 7px;
  background: var(--bq-color-surface, #ffffff);
  border: 2px solid var(--bq-color-primary, #4e8ffd);
  border-radius: 50%;
}

.review-detail-drawer__reply-message-body {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 0 0 14px;
}

.review-detail-drawer__reply-message-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.review-detail-drawer__reply-message-head > div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.review-detail-drawer__reply-role {
  height: 22px;
  padding: 0 6px;
  color: var(--bq-color-primary, var(--el-color-primary));
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  background: var(--bq-color-primary-soft, #edf4ff);
  border: 1px solid
    color-mix(in srgb, var(--bq-color-primary, #4e8ffd) 18%, white);
  border-radius: var(--bq-radius-control, 4px);
}

.review-detail-drawer__reply-message-head strong {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 13px;
  font-weight: 700;
  line-height: 22px;
}

.review-detail-drawer__reply-message-head
  span:not(.review-detail-drawer__reply-role),
.review-detail-drawer__reply-message-head :deep(.committee-date) {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 13px;
  line-height: 20px;
}

.review-detail-drawer__reply-message-body p {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  line-height: 24px;
  white-space: pre-wrap;
}

.review-detail-drawer__reply-attachments {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 8px 10px;
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.review-detail-drawer__reply-attachments span {
  flex: 0 0 auto;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 13px;
  font-weight: 700;
  line-height: 22px;
}

@media (max-width: 760px) {
  :global(.review-detail-drawer-shell.is-fullscreen .el-drawer__body) {
    padding: 12px;
  }

  .review-detail-drawer__signals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .review-detail-drawer__signal.is-conclusion {
    grid-column: 1 / -1;
    margin: 4px 0 0;
    padding-left: 10px;
    border-top: 1px solid var(--bq-color-border, var(--el-border-color));
    border-left: 0;
  }

  .review-detail-drawer__reply-topic-head,
  .review-detail-drawer__meeting-head,
  .review-detail-drawer__reply-message-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .review-detail-drawer__reply-topic-extra {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  :global(.review-detail-drawer-shell) {
    transition: none;
  }
}
</style>
