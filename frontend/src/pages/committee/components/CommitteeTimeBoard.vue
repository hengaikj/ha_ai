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
import {
  fetchCommitteeConclusions,
  fetchCommitteeGateMeetings,
  fetchCommitteeReviewSummary,
} from "@/api/committee";
import { ApiBusinessError } from "@/api/http";
import CommitteeDate from "./CommitteeDate.vue";
import DictTag from "@/components/base/DictTag.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import { formatDate } from "@/utils/formatters";
import type {
  CommitteeConclusion,
  CommitteeGate,
  CommitteeGateMeetingHistory,
  CommitteeMeeting,
  CommitteeMeetingLevel,
  CommitteeReviewSummary,
} from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import {
  committeeDepartmentGroupLabel,
  committeeStatusLabel,
  committeeTagType,
} from "../committee-ui";

type TimeNodeKey =
  | "second-deadline"
  | "second-meeting"
  | "group-deadline"
  | "group-meeting";

interface TimeNode {
  key: TimeNodeKey;
  label: string;
  time?: string;
  summary: string;
  status: string;
}

type TimeNodeVisualStatus = "done" | "active" | "pending";

interface TimeNodeView extends TimeNode {
  dateText: string;
  visualStatus: TimeNodeVisualStatus;
}

type BaseStatus = "DRAFT" | "EFFECTIVE" | "FAILED" | "WARNING";

interface ErrorInfo {
  code: string;
  message: string;
  traceId?: string;
}

const props = withDefaults(
  defineProps<{
    projectId?: string;
    gateId?: string;
    meetingId?: string;
    reviewVersionId?: string;
    currentGate?: CommitteeGate | null;
    companyName?: string | null;
    history?: CommitteeGateMeetingHistory;
    reviewSummary?: CommitteeReviewSummary | null;
    progressOnly?: boolean;
    conclusionMap?: Record<string, string>;
    meetingStatusOptions?: SchemaOption[];
    conclusionStatusOptions?: SchemaOption[];
    reviewStatusOptions?: SchemaOption[];
    approvalResultOptions?: SchemaOption[];
    secondConfirmStatusOptions?: SchemaOption[];
  }>(),
  {
    projectId: undefined,
    gateId: undefined,
    meetingId: undefined,
    reviewVersionId: undefined,
    currentGate: null,
    companyName: undefined,
    history: undefined,
    reviewSummary: undefined,
    progressOnly: false,
    conclusionMap: undefined,
    meetingStatusOptions: () => [],
    conclusionStatusOptions: () => [],
    reviewStatusOptions: () => [],
    approvalResultOptions: () => [],
    secondConfirmStatusOptions: () => [],
  },
);

const emptyHistory = (): CommitteeGateMeetingHistory => ({
  second: [],
  group: [],
});
const fallbackHistory = ref<CommitteeGateMeetingHistory>(emptyHistory());
const fallbackReviewSummary = ref<CommitteeReviewSummary | null>(null);
const fallbackConclusionMap = ref<Record<string, string>>({});
const selectedNodeKey = ref<TimeNodeKey | null>(null);
const boardRef = ref<HTMLElement | null>(null);
const loading = ref(false);
const historyError = ref<ErrorInfo>();
const reviewError = ref<ErrorInfo>();
const conclusionError = ref<ErrorInfo>();
const currentTime = ref(Date.now());
let clockTimer: number | undefined;
let loadRequestId = 0;
let unmounted = false;

function startClock() {
  if (clockTimer !== undefined) return;
  currentTime.value = Date.now();
  clockTimer = window.setInterval(() => {
    currentTime.value = Date.now();
  }, 60_000);
}

function stopClock() {
  if (clockTimer !== undefined) window.clearInterval(clockTimer);
  clockTimer = undefined;
}

const resolvedHistory = computed(() => props.history ?? fallbackHistory.value);
const resolvedReviewSummary = computed(() =>
  props.reviewSummary !== undefined
    ? props.reviewSummary
    : fallbackReviewSummary.value,
);
const resolvedCompanyName = computed(() => {
  const summaryCompanyName = String(
    resolvedReviewSummary.value?.companyName ?? "",
  ).trim();
  return summaryCompanyName || props.companyName;
});
function meetingStatusLabel(value?: string) {
  if (!value) return "--";
  return (
    props.meetingStatusOptions?.find(
      (option) => String(option.value) === String(value),
    )?.label ?? committeeStatusLabel(value)
  );
}

function conclusionLabel(value?: string) {
  if (!value) return "--";
  return (
    props.conclusionStatusOptions?.find(
      (option) => String(option.value) === String(value),
    )?.label ?? committeeStatusLabel(value)
  );
}

function signalClass(value?: string | null) {
  return `is-${String(value ?? "EMPTY").toLowerCase()}`;
}

function hasSignal(value?: string | null) {
  return value === "GREEN" || value === "YELLOW" || value === "RED";
}

function isActiveRequest(requestId: number) {
  return !unmounted && requestId === loadRequestId;
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

async function resolveHistory(
  requestId: number,
  projectId: string | undefined,
  gateId: string | undefined,
) {
  if (props.history !== undefined) return props.history;
  if (!projectId || !gateId) return emptyHistory();

  try {
    const history = await fetchCommitteeGateMeetings(projectId, gateId);
    if (isActiveRequest(requestId)) fallbackHistory.value = history;
    return history;
  } catch (unknownError) {
    if (isActiveRequest(requestId)) {
      historyError.value = normalizeError(
        unknownError,
        "FRONTEND-COMMITTEE-MEETING-001",
        "会议历史加载失败，请稍后重试。",
      );
    }
    return emptyHistory();
  }
}

async function resolveReviewSummary(
  requestId: number,
  gateId: string | undefined,
) {
  if (props.reviewSummary !== undefined) return;
  if (!gateId) return;

  try {
    const summary = await fetchCommitteeReviewSummary(gateId, {
      meetingId: props.meetingId,
      reviewVersionId: props.reviewVersionId,
      progressOnly: true,
    });
    if (isActiveRequest(requestId)) fallbackReviewSummary.value = summary;
  } catch (unknownError) {
    if (isActiveRequest(requestId)) {
      reviewError.value = normalizeError(
        unknownError,
        "FRONTEND-COMMITTEE-REVIEW-001",
        "评审摘要加载失败，请稍后重试。",
      );
    }
  }
}

async function resolveConclusions(
  requestId: number,
  historyPromise: Promise<CommitteeGateMeetingHistory>,
) {
  if (props.conclusionMap !== undefined) return;
  const history = await historyPromise;
  if (!isActiveRequest(requestId)) return;

  const meetings = [...history.second, ...history.group];
  if (!meetings.length) return;
  const results = await Promise.allSettled(
    meetings.map((meeting) => fetchCommitteeConclusions(meeting.id)),
  );
  if (!isActiveRequest(requestId)) return;

  const failedResult = results.find((result) => result.status === "rejected");
  if (failedResult?.status === "rejected") {
    conclusionError.value = normalizeError(
      failedResult.reason,
      "FRONTEND-COMMITTEE-CONCLUSION-001",
      "会议结论加载失败，请稍后重试。",
    );
  }

  const validMeetingIds = new Set(meetings.map((meeting) => meeting.id));
  const latestByMeeting = new Map<string, CommitteeConclusion>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const conclusion of result.value) {
      if (!validMeetingIds.has(conclusion.meetingId)) continue;
      const previous = latestByMeeting.get(conclusion.meetingId);
      if (
        !previous ||
        conclusion.conclusionVersion > previous.conclusionVersion
      ) {
        latestByMeeting.set(conclusion.meetingId, conclusion);
      }
    }
  }
  fallbackConclusionMap.value = Object.fromEntries(
    [...latestByMeeting].map(([meetingId, conclusion]) => [
      meetingId,
      conclusion.decision,
    ]),
  );
}

async function loadFallbackData() {
  const requestId = ++loadRequestId;
  const projectId = props.projectId;
  const gateId = props.gateId;
  fallbackHistory.value = emptyHistory();
  fallbackReviewSummary.value = null;
  fallbackConclusionMap.value = {};
  historyError.value = undefined;
  reviewError.value = undefined;
  conclusionError.value = undefined;

  const shouldLoadHistory =
    props.history === undefined && Boolean(projectId && gateId);
  const shouldLoadReview = props.reviewSummary === undefined && Boolean(gateId);
  const shouldLoadConclusions =
    props.conclusionMap === undefined &&
    (shouldLoadHistory ||
      Boolean(props.history?.second.length || props.history?.group.length));
  loading.value =
    shouldLoadHistory || shouldLoadReview || shouldLoadConclusions;

  const historyPromise = resolveHistory(requestId, projectId, gateId);
  await Promise.all([
    historyPromise,
    resolveReviewSummary(requestId, gateId),
    resolveConclusions(requestId, historyPromise),
  ]);
  if (isActiveRequest(requestId)) loading.value = false;
}

watch(
  () => [
    props.projectId,
    props.gateId,
    props.meetingId,
    props.reviewVersionId,
    props.history,
    props.reviewSummary,
    props.conclusionMap,
  ],
  loadFallbackData,
  { immediate: true },
);

onMounted(startClock);
onActivated(startClock);
onDeactivated(stopClock);
onBeforeUnmount(() => {
  unmounted = true;
  loadRequestId += 1;
  stopClock();
});

function meetingsForLevel(level: CommitteeMeetingLevel): CommitteeMeeting[] {
  const rows =
    level === "SECOND"
      ? resolvedHistory.value.second
      : resolvedHistory.value.group;
  return [...rows].sort((left, right) => right.attemptNo - left.attemptNo);
}

function latest(level: CommitteeMeetingLevel) {
  return meetingsForLevel(level)[0];
}

function committeeBaseStatus(value?: string): BaseStatus {
  const tagType = committeeTagType(value);
  if (tagType === "success") return "EFFECTIVE";
  if (tagType === "warning") return "WARNING";
  if (tagType === "danger") return "FAILED";
  return "DRAFT";
}

function reviewApprovalResultSource(
  department: CommitteeReviewSummary["groups"][number]["departments"][number],
) {
  return department.currentRecord?.approvalAction?.trim();
}

function reviewConclusionSource(
  department: CommitteeReviewSummary["groups"][number]["departments"][number],
) {
  return props.progressOnly
    ? department.conclusionSignal?.trim()
    : department.currentRecord?.content?.conclusionSignal?.trim();
}

function reviewDepartments(departmentGroup: "SECOND_COMPANY" | "GROUP") {
  const group = resolvedReviewSummary.value?.groups.find(
    (item) => item.departmentGroup === departmentGroup,
  );
  return (group?.departments ?? []).map((department) => ({
    ...department,
    id: department.departmentId,
    statusLabel:
      props.reviewStatusOptions?.find(
        (option) => String(option.value) === String(department.taskStatus),
      )?.label ?? "--",
    approvalStatus: reviewApprovalResultSource(department),
    conclusionStatus: reviewConclusionSource(department),
  }));
}

const secondReviewRows = computed(() => reviewDepartments("SECOND_COMPANY"));
const groupReviewRows = computed(() => reviewDepartments("GROUP"));
const reviewDepartmentTotal = computed(
  () => secondReviewRows.value.length + groupReviewRows.value.length,
);

const reviewOverviewGroups = computed(() =>
  [
    {
      key: "second",
      departmentGroup: "SECOND_COMPANY",
      rows: secondReviewRows.value,
    },
    {
      key: "group",
      departmentGroup: "GROUP",
      rows: groupReviewRows.value,
    },
  ].map((group) => {
    const approved = group.rows.filter((row) =>
      ["APPROVED", "WAITING_MEETING", "ARCHIVED"].includes(row.taskStatus),
    ).length;
    return {
      ...group,
      title: committeeDepartmentGroupLabel(
        group.departmentGroup,
        resolvedCompanyName.value,
      ),
      value: `${approved}/${group.rows.length}`,
      progressPercent: group.rows.length
        ? Math.round((approved / group.rows.length) * 100)
        : 0,
    };
  }),
);

function meetingRows(level: CommitteeMeetingLevel) {
  return meetingsForLevel(level).map((meeting) => {
    const conclusion = meeting.currentConclusionDecision;
    return {
      ...meeting,
      statusLabel: meetingStatusLabel(meeting.meetingStatus),
      attemptLabel: `第 ${meeting.attemptNo} 次`,
      conclusion,
      conclusionLabel: conclusionLabel(conclusion),
    };
  });
}

const secondMeetingRows = computed(() => meetingRows("SECOND"));
const groupMeetingRows = computed(() => meetingRows("GROUP"));

function hasReachedTime(value?: string) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp <= currentTime.value;
}

function meetingSummary(meeting?: CommitteeMeeting) {
  if (!meeting) return loading.value ? "--" : meetingStatusLabel("NOT_STARTED");
  const conclusion = meeting.currentConclusionDecision;
  return conclusion
    ? conclusionLabel(conclusion)
    : meetingStatusLabel(meeting.meetingStatus);
}

const nodes = computed<TimeNode[]>(() => {
  const second = latest("SECOND");
  const group = latest("GROUP");
  return [
    {
      key: "second-deadline",
      label: "品牌公司上会评审截止",
      time: second?.reviewDeadlineTime,
      summary: loading.value
        ? "--"
        : reviewDepartmentTotal.value
          ? `${reviewDepartmentTotal.value} 个部室`
          : "暂无评审数据",
      status: second?.meetingStatus ?? "NOT_STARTED",
    },
    {
      key: "second-meeting",
      label: "品牌公司会议时间",
      time: second?.meetingTime,
      summary: meetingSummary(second),
      status: second?.meetingStatus ?? "NOT_STARTED",
    },
    {
      key: "group-deadline",
      label: "集团会议评审截止",
      time: group?.reviewDeadlineTime,
      summary: loading.value
        ? "--"
        : reviewDepartmentTotal.value
          ? `${reviewDepartmentTotal.value} 个部室`
          : "暂无评审数据",
      status: group?.meetingStatus ?? "NOT_STARTED",
    },
    {
      key: "group-meeting",
      label: "集团会议时间",
      time: group?.meetingTime,
      summary: meetingSummary(group),
      status: group?.meetingStatus ?? "NOT_STARTED",
    },
  ];
});

function formatNodeDate(value?: string) {
  return formatDate(value);
}

const completedPrefixIndex = computed(() => {
  const firstIncompleteIndex = visualNodes.value.findIndex(
    (node) => node.visualStatus !== "done",
  );
  return firstIncompleteIndex === -1
    ? visualNodes.value.length - 1
    : firstIncompleteIndex - 1;
});
const visualNodes = computed<TimeNodeView[]>(() =>
  nodes.value.map((node, index) => {
    let visualStatus: TimeNodeVisualStatus = "pending";
    const previousNodesReached = nodes.value
      .slice(0, index)
      .every((previousNode) => hasReachedTime(previousNode.time));
    if (hasReachedTime(node.time) && previousNodesReached) {
      visualStatus = "done";
    } else if (
      nodes.value
        .slice(0, index)
        .every((previousNode) => hasReachedTime(previousNode.time))
    ) {
      visualStatus = "active";
    }
    return {
      ...node,
      dateText: formatNodeDate(node.time),
      visualStatus,
    };
  }),
);
const doneTrackStyle = computed(() =>
  completedPrefixIndex.value <= 0
    ? { width: "0%" }
    : { width: `calc(${completedPrefixIndex.value * 25}%)` },
);
const selectedNode = computed(() =>
  nodes.value.find((node) => node.key === selectedNodeKey.value),
);
const isDeadlineNode = computed(() =>
  selectedNodeKey.value?.endsWith("deadline"),
);
const showSecondConfirmColumn = computed(
  () => selectedNodeKey.value === "group-deadline",
);
const selectedReviewRows = computed(() =>
  selectedNodeKey.value?.endsWith("deadline")
    ? [...secondReviewRows.value, ...groupReviewRows.value]
    : [],
);
const selectedReviewGroups = computed(() =>
  selectedNodeKey.value?.endsWith("deadline") ? reviewOverviewGroups.value : [],
);
const selectedMeetingRows = computed(() =>
  selectedNodeKey.value === "second-meeting"
    ? secondMeetingRows.value
    : groupMeetingRows.value,
);
const selectedLevelLabel = computed(() =>
  selectedNodeKey.value?.startsWith("second") ? "品牌公司" : "集团",
);
const selectedDetailTitle = computed(() =>
  selectedNodeKey.value?.endsWith("deadline")
    ? "同步评审"
    : selectedNodeKey.value === "second-meeting"
      ? "品牌公司会议"
      : selectedNodeKey.value === "group-meeting"
        ? "集团会议"
        : selectedNode.value
          ? `${selectedNode.value.label} · 会议记录`
          : "节点详情",
);
const selectedDetailCountLabel = computed(() => {
  return "";
});

function toggleNode(key: TimeNodeKey) {
  selectedNodeKey.value = selectedNodeKey.value === key ? null : key;
}

function openNode(key: TimeNodeKey) {
  selectedNodeKey.value = key;
}

function openFirstStep() {
  openNode("second-deadline");
}

function scrollIntoView() {
  boardRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

defineExpose({
  openFirstStep,
  openNode,
  scrollIntoView,
});
</script>

<template>
  <section
    ref="boardRef"
    v-loading="loading"
    class="project-detail__time-board"
    aria-label="时间进度看板"
  >
    <BaseSectionTitle
      class="project-detail__time-board-head"
      title="时间进度看板"
      heading-tag="h3"
    >
      <template #actions>
        <span v-if="currentGate?.gateName" class="project-detail__gate-chip">
          {{ currentGate.gateName }}
        </span>
      </template>
    </BaseSectionTitle>

    <div
      v-if="historyError || reviewError || conclusionError"
      class="project-detail__time-errors"
    >
      <TraceErrorAlert v-if="historyError" v-bind="historyError" />
      <TraceErrorAlert v-if="reviewError" v-bind="reviewError" />
      <TraceErrorAlert v-if="conclusionError" v-bind="conclusionError" />
    </div>

    <div class="project-detail__time-track-scroll">
      <div class="project-detail__time-track">
        <span class="project-detail__time-track-base" />
        <span class="project-detail__time-track-done" :style="doneTrackStyle" />
        <button
          v-for="node in visualNodes"
          :id="`committee-time-node-${node.key}`"
          :key="node.key"
          type="button"
          class="project-detail__time-node"
          :class="{
            [`is-${node.visualStatus}`]: true,
            'is-selected': selectedNodeKey === node.key,
          }"
          :data-testid="`committee-time-node-${node.key}`"
          :aria-expanded="selectedNodeKey === node.key"
          :aria-current="selectedNodeKey === node.key ? 'step' : undefined"
          aria-controls="committee-time-detail"
          @click="toggleNode(node.key)"
        >
          <span class="project-detail__time-node-date">{{
            node.dateText
          }}</span>
          <span class="project-detail__time-node-dot">
            {{ node.visualStatus === "done" ? "✓" : "" }}
          </span>
          <span class="project-detail__time-node-name">{{ node.label }}</span>
          <span class="project-detail__time-node-subname">
            {{ node.summary }}
          </span>
          <span class="project-detail__time-node-accessible">
            <CommitteeDate :value="node.time" />
            <BaseStatusTag
              :status="committeeBaseStatus(node.status)"
              :label="meetingStatusLabel(node.status)"
            />
          </span>
        </button>
      </div>
    </div>

    <section
      v-if="selectedNode"
      id="committee-time-detail"
      class="time-board__detail"
      data-testid="committee-time-detail"
      :aria-labelledby="`committee-time-node-${selectedNode.key}`"
    >
      <header class="time-board__detail-header">
        <h3>{{ selectedDetailTitle }}</h3>
        <span v-if="selectedDetailCountLabel">
          {{ selectedDetailCountLabel }}
        </span>
      </header>

      <div
        v-if="loading"
        class="time-board__detail-loading"
        aria-busy="true"
        aria-label="加载中"
      />
      <template v-else-if="isDeadlineNode">
        <div v-if="selectedReviewRows.length" class="time-board__review-groups">
          <article
            v-for="group in selectedReviewGroups"
            :key="group.key"
            class="time-board__review-group"
            :class="{
              'time-board__review-group--single':
                selectedReviewGroups.length === 1,
            }"
          >
            <header class="time-board__review-group-header">
              <h4>{{ group.title }}</h4>
              <div class="time-board__review-progress">
                <span class="committee-text-strong">{{ group.value }}</span>
                <span class="time-board__review-progress-track">
                  <span
                    class="time-board__review-progress-value"
                    :style="{ width: `${group.progressPercent}%` }"
                  />
                </span>
              </div>
            </header>
            <div class="time-board__review-table-wrap">
              <el-table
                :data="group.rows"
                border
                class="time-board__review-table"
                empty-text="暂无部室数据"
              >
                <el-table-column
                  prop="departmentName"
                  label="部室"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    <span
                      class="time-board__review-department"
                      :title="row.departmentName"
                    >
                      {{ row.departmentName }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  label="评审状态"
                  class-name="time-board__review-status-cell"

                  align="center"
                >
                  <template #default="{ row }">
                    <DictTag
                      :value="row.taskStatus"
                      :options="reviewStatusOptions ?? []"
                    />
                  </template>
                </el-table-column>
                <el-table-column
                  label="审批结果"
                  align="center"
                >
                  <template #default="{ row }">
                    <DictTag
                      v-if="row.approvalStatus"
                      :value="row.approvalStatus"
                      :options="approvalResultOptions ?? []"
                    />
                    <span v-else class="time-board__review-empty">--</span>
                  </template>
                </el-table-column>
                <el-table-column
                  label="结论建议"
                  align="center"
                >
                  <template #default="{ row }">
                    <i
                      v-if="hasSignal(row.conclusionSignal)"
                      class="time-board__review-signal-dot"
                      :class="signalClass(row.conclusionSignal)"
                      role="img"
                      :aria-label="`${row.conclusionSignal} 结论建议`"
                    />
                    <span v-else class="time-board__review-empty">--</span>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="showSecondConfirmColumn"
                  label="品牌公司确认"
                  align="center"
                >
                  <template #default="{ row }">
                    <span class="time-board__review-confirm">
                      <DictTag
                        :value="row.secondConfirmStatus"
                        :options="secondConfirmStatusOptions ?? []"
                      />
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="更新时间" prop="updateTime" >
<!--                  <template #default="{ row }">-->
<!--                    <span class="time-board__review-time">-->
<!--                      <CommitteeDate :value="row.updateTime" with-seconds />-->
<!--                    </span>-->
<!--                  </template>-->
                </el-table-column>
              </el-table>
            </div>
          </article>
        </div>
        <el-empty v-else :description="`暂无${selectedLevelLabel}评审数据`" />
      </template>

      <template v-else>
        <div class="time-board__meeting-list">
          <el-table
            :data="selectedMeetingRows"
            border
            class="time-board__meeting-table"
            :empty-text="`暂无${selectedLevelLabel}会议记录`"
            :aria-label="`${selectedLevelLabel}会议记录`"
          >
            <el-table-column prop="attemptLabel" label="会次" min-width="20%">
              <template #default="{ row }">
                <span class="time-board__meeting-attempt">
                  {{ row.attemptLabel }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="上会时间" min-width="30%" align="center">
              <template #default="{ row }">
                <span class="time-board__meeting-time">
                  <CommitteeDate :value="row.meetingTime" with-time />
                </span>
              </template>
            </el-table-column>
            <el-table-column label="会议状态" min-width="25%" align="center">
              <template #default="{ row }">
                <span class="time-board__meeting-status">
                  <DictTag
                    :value="row.meetingStatus"
                    :options="meetingStatusOptions"
                  />
                </span>
              </template>
            </el-table-column>
            <el-table-column label="会议结论" min-width="25%" align="center">
              <template #default="{ row }">
                <DictTag
                  :value="row.conclusion"
                  :options="conclusionStatusOptions"
                />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </section>
  </section>
</template>

<style scoped>
.project-detail__time-board {
  display: grid;
  gap: 16px;
  padding: 16px;
  background: var(--bq-color-surface, #fff);
  border: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
  border-radius: var(--bq-radius-control, 4px);
}

.time-board__detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
}

.project-detail__title-wrap {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.project-detail__title-wrap h3,
.time-board__detail-header h3 {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-section-title, 16px);
  font-weight: 600;
  line-height: 24px;
}

.time-board__detail-header span {
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
}

.project-detail__gate-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  color: var(--bq-color-primary, var(--el-color-primary));
  font-size: var(--bq-font-helper, 12px);
  font-weight: 600;
  line-height: 20px;
  background: var(--bq-color-primary-soft, var(--el-color-primary-light-9));
  border: 1px solid
    color-mix(
      in srgb,
      var(--bq-color-primary, var(--el-color-primary)),
      white 76%
    );
  border-radius: 999px;
}

.project-detail__time-errors {
  display: grid;
  gap: 8px;
}

.project-detail__time-track-scroll {
  min-width: 0;
  overflow-x: auto;
}

.project-detail__time-track {
  --project-detail-time-track-padding-top: 14px;
  --project-detail-time-node-padding-top: 8px;
  --project-detail-time-date-height: 20px;
  --project-detail-time-node-gap: 8px;
  --project-detail-time-dot-size: 20px;
  --project-detail-time-track-height: 2px;
  --project-detail-time-track-top: calc(
    var(--project-detail-time-track-padding-top) +
      var(--project-detail-time-node-padding-top) +
      var(--project-detail-time-date-height) +
      var(--project-detail-time-node-gap) +
      var(--project-detail-time-dot-size) / 2 -
      var(--project-detail-time-track-height) / 2
  );
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  align-items: start;
  min-width: 720px;
  padding: var(--project-detail-time-track-padding-top) 16px 12px;
  background: var(--bq-color-bg-soft, #fbfcfd);
  border: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
  border-radius: var(--bq-radius-control, 4px);
}

.project-detail__time-track-base,
.project-detail__time-track-done {
  position: absolute;
  top: var(--project-detail-time-track-top);
  left: 12.5%;
  right: 12.5%;
  height: var(--project-detail-time-track-height);
  border-radius: 999px;
  pointer-events: none;
}

.project-detail__time-track-base {
  background: var(--bq-color-border, var(--el-border-color));
}

.project-detail__time-track-done {
  right: auto;
  background: var(--bq-color-success, var(--el-color-success));
}

.project-detail__time-node {
  position: relative;
  z-index: 3;
  display: grid;
  justify-items: center;
  gap: 6px;
  min-width: 0;
  padding: var(--project-detail-time-node-padding-top) 10px 10px;
  color: inherit;
  text-align: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--bq-radius-control, 4px);
  cursor: pointer;
}

.project-detail__time-node > span {
  position: relative;
  z-index: 1;
}

.project-detail__time-node:focus-visible {
  outline: none;
}

.project-detail__time-node-date {
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0;
}

.project-detail__time-node-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--bq-color-success, #67c23a);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  background: var(--bq-color-surface, #fff);
  border: 2px solid
    color-mix(in srgb, var(--bq-color-border, #dcdfe6), #b8c3cf 42%);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--bq-color-surface, #fff);
  transition:
    width 160ms ease,
    height 160ms ease,
    margin 160ms ease,
    transform 160ms ease,
    filter 160ms ease,
    box-shadow 160ms ease;
}

.project-detail__time-node:hover .project-detail__time-node-dot,
.project-detail__time-node:focus-visible .project-detail__time-node-dot {
  filter: brightness(1.08);
  box-shadow:
    0 0 0 2px var(--bq-color-surface, #fff),
    0 0 0 5px var(--bq-color-primary-soft, #edf4ff);
  transform: scale(1.16);
}

.project-detail__time-node-name {
  min-height: 17px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-compact, 14px);
  font-weight: 600;
  line-height: 18px;
}

.project-detail__time-node-subname {
  max-width: 132px;
  min-height: 18px;
  overflow: hidden;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-detail__time-node-accessible {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.project-detail__time-node.is-done .project-detail__time-node-dot {
  color: #fff;
  background: var(--bq-color-success, #67c23a);
  border-color: color-mix(
    in srgb,
    var(--bq-color-success, #67c23a),
    #5dad6e 36%
  );
  box-shadow: 0 0 0 2px var(--bq-color-surface, #fff);
}

.project-detail__time-node.is-active .project-detail__time-node-dot {
  width: 24px;
  height: 24px;
  margin-top: -2px;
  margin-bottom: -2px;
  color: #fff;
  background: var(--bq-color-primary, var(--el-color-primary));
  border-color: var(--bq-color-primary, var(--el-color-primary));
  box-shadow: 0 0 0 3px var(--bq-color-primary-soft, #edf4ff);
}

.project-detail__time-node.is-selected .project-detail__time-node-dot {
  width: 28px;
  height: 28px;
  margin-top: -4px;
  margin-bottom: -4px;
  color: #fff;
  background: var(--bq-color-primary, var(--el-color-primary));
  border-color: var(--bq-color-primary, var(--el-color-primary));
  box-shadow:
    0 0 0 2px var(--bq-color-surface, #fff),
    0 0 0 5px var(--bq-color-primary-soft, #edf4ff);
}

.project-detail__time-node.is-selected:hover .project-detail__time-node-dot,
.project-detail__time-node.is-selected:focus-visible
  .project-detail__time-node-dot {
  filter: brightness(1.05);
  transform: scale(1.04);
}

.project-detail__time-node.is-selected .project-detail__time-node-date,
.project-detail__time-node.is-selected .project-detail__time-node-name {
  color: var(--bq-color-primary, var(--el-color-primary));
}

.project-detail__time-node.is-done .project-detail__time-node-name,
.project-detail__time-node.is-done .project-detail__time-node-subname {
  color: var(--bq-color-text, var(--el-text-color-primary));
}

.project-detail__time-node.is-pending .project-detail__time-node-name {
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
}

.time-board__detail {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  background: var(--bq-color-bg-soft, #fbfcfd);
  border: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
  border-radius: var(--bq-radius-control, 4px);
}

.time-board__detail-header {
  min-height: 24px;
}

.time-board__detail-header h3 {
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.time-board__detail-loading {
  min-height: 72px;
}

.time-board__review-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
  min-width: 0;
}

.time-board__review-group {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0;
  align-content: start;
  overflow: hidden;
  min-width: 0;
  background: var(--bq-color-surface, #fff);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.035);
}

.time-board__review-group--single {
  grid-column: 1 / -1;
}

.time-board__review-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
  padding: 6px 12px;
  background: var(--bq-color-surface, #fff);
  border-bottom: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
}

.time-board__review-group-header h4 {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  min-width: 0;
  font-size: var(--bq-font-compact, 14px);
  font-weight: 600;
  line-height: 20px;
}

.time-board__review-progress {
  display: grid;
  flex: 0 0 48px;
  gap: 3px;
  justify-items: stretch;
}

.time-board__review-progress .committee-text-strong {
  text-align: right;
  color: var(--bq-color-primary, var(--el-color-primary));
  font-size: 13px;
  font-weight: 700;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

.time-board__review-progress-track {
  display: block;
  width: 48px;
  height: 2px;
  overflow: hidden;
  background: var(--bq-color-border-subtle, var(--el-border-color-lighter));
  border-radius: 999px;
}

.time-board__review-progress-value {
  display: block;
  height: 100%;
  background: var(--bq-color-primary, var(--el-color-primary));
  border-radius: inherit;
}

.time-board__review-table-wrap {
  min-width: 0;
  overflow-x: auto;
}

.time-board__review-table {
  width: 100%;
  min-width: 470px;
}

.time-board__review-table :deep(.el-table__header th.el-table__cell) {
  height: 26px;
  padding: 0 12px;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  font-weight: 500;
  line-height: 26px;
  background: color-mix(
    in srgb,
    var(--bq-color-table-header, #f0f1f2),
    white 78%
  );
}

.time-board__review-table :deep(.el-table__body td.el-table__cell) {
  height: 32px;
  padding: 0 12px;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: 13px;
  line-height: 32px;
  transition: background-color 160ms ease;
}

.time-board__review-table :deep(.time-board__review-status-cell .cell) {
  text-overflow: clip;
  white-space: nowrap;
}

.time-board__review-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.time-board__review-table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: color-mix(
    in srgb,
    var(--bq-color-primary-soft, var(--el-color-primary-light-9)),
    white 62%
  );
}

.time-board__review-department {
  display: block;
  overflow: hidden;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-compact, 14px);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-board__review-time :deep(.committee-date) {
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-variant-numeric: tabular-nums;
}

.time-board__review-empty {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
}

.time-board__review-signal-dot {
  display: inline-flex;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--bq-color-text-muted, var(--el-color-info));
  vertical-align: middle;
}

.time-board__review-signal-dot.is-green {
  background: var(--bq-color-success, var(--el-color-success));
}

.time-board__review-signal-dot.is-yellow {
  background: var(--bq-color-warning, var(--el-color-warning));
}

.time-board__review-signal-dot.is-red {
  background: var(--bq-color-danger, var(--el-color-danger));
}

.time-board__review-empty-row td {
  height: 32px;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  text-align: center;
}

.time-board__meeting-list {
  overflow-x: auto;
  min-width: 0;
  background: var(--bq-color-surface, #fff);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.035);
}

.time-board__meeting-table {
  width: 100%;
  min-width: 540px;
}

.time-board__meeting-table :deep(.el-table__header th.el-table__cell) {
  height: 30px;
  padding: 0 16px;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  font-weight: 500;
  line-height: 30px;
  background: color-mix(
    in srgb,
    var(--bq-color-table-header, #f0f1f2),
    white 76%
  );
}

.time-board__meeting-table :deep(.el-table__body td.el-table__cell) {
  height: 40px;
  padding: 0 16px;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: 13px;
  line-height: 40px;
  transition: background-color 160ms ease;
}

.time-board__meeting-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.time-board__meeting-table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: color-mix(
    in srgb,
    var(--bq-color-primary-soft, var(--el-color-primary-light-9)),
    white 64%
  );
}

.time-board__meeting-table
  :deep(.el-table__body tr:first-child > td.el-table__cell) {
  background: color-mix(
    in srgb,
    var(--bq-color-primary-soft, var(--el-color-primary-light-9)),
    white 58%
  );
}

.time-board__meeting-table
  :deep(.el-table__body tr:first-child > td:first-child) {
  box-shadow: inset 2px 0 0 var(--bq-color-primary, var(--el-color-primary));
}

.time-board__meeting-attempt {
  display: inline-flex;
  align-items: center;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-compact, 14px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}

.time-board__meeting-time :deep(.committee-date) {
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-variant-numeric: tabular-nums;
}

.time-board__meeting-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}

.time-board__meeting-status-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  background: var(--bq-color-info, var(--el-color-info));
  border-radius: 50%;
  box-shadow: 0 0 0 3px
    color-mix(
      in srgb,
      var(--bq-color-info, var(--el-color-info)),
      transparent 86%
    );
}

.time-board__meeting-status.is-effective .time-board__meeting-status-dot {
  background: var(--bq-color-success, var(--el-color-success));
  box-shadow: 0 0 0 3px
    color-mix(
      in srgb,
      var(--bq-color-success, var(--el-color-success)),
      transparent 84%
    );
}

.time-board__meeting-status.is-warning .time-board__meeting-status-dot {
  background: var(--bq-color-warning, var(--el-color-warning));
  box-shadow: 0 0 0 3px
    color-mix(
      in srgb,
      var(--bq-color-warning, var(--el-color-warning)),
      transparent 84%
    );
}

.time-board__meeting-status.is-failed .time-board__meeting-status-dot {
  background: var(--bq-color-danger, var(--el-color-danger));
  box-shadow: 0 0 0 3px
    color-mix(
      in srgb,
      var(--bq-color-danger, var(--el-color-danger)),
      transparent 84%
    );
}

.time-board__meeting-conclusion {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 20px;
  padding: 0 7px;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  font-weight: 600;
  line-height: 18px;
  background: var(--bq-color-info-soft, var(--el-fill-color-light));
  border: 1px solid
    color-mix(in srgb, var(--bq-color-info, var(--el-color-info)), white 78%);
  border-radius: 999px;
}

.time-board__meeting-conclusion.is-effective {
  color: color-mix(
    in srgb,
    var(--bq-color-success, var(--el-color-success)),
    black 24%
  );
  background: var(--bq-color-success-soft, var(--el-color-success-light-9));
  border-color: color-mix(
    in srgb,
    var(--bq-color-success, var(--el-color-success)),
    white 70%
  );
}

.time-board__meeting-conclusion.is-warning {
  color: color-mix(
    in srgb,
    var(--bq-color-warning, var(--el-color-warning)),
    black 32%
  );
  background: var(--bq-color-warning-soft, var(--el-color-warning-light-9));
  border-color: color-mix(
    in srgb,
    var(--bq-color-warning, var(--el-color-warning)),
    white 68%
  );
}

.time-board__meeting-conclusion.is-failed {
  color: var(--bq-color-danger, var(--el-color-danger));
  background: var(--bq-color-danger-soft, var(--el-color-danger-light-9));
  border-color: color-mix(
    in srgb,
    var(--bq-color-danger, var(--el-color-danger)),
    white 72%
  );
}

.time-board__meeting-conclusion.is-empty {
  min-width: 0;
  padding: 0;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-weight: 400;
  background: transparent;
  border-color: transparent;
}

.time-board__detail :deep(.el-empty) {
  padding: 20px 0;
}

@media (max-width: 1100px) {
  .time-board__review-groups {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }
}

@media (max-width: 900px) {
  .project-detail__time-track {
    min-width: 760px;
  }
}

@media (max-width: 640px) {
  .project-detail__time-board {
    gap: 12px;
    padding: 12px;
  }

  .project-detail__time-board-head {
    align-items: center;
  }

  .time-board__detail-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .project-detail__time-track-scroll {
    overflow: visible;
  }

  .project-detail__time-track {
    gap: 8px;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    padding: 8px;
  }

  .project-detail__time-track-base,
  .project-detail__time-track-done {
    display: none;
  }

  .project-detail__time-node {
    grid-template-columns: 76px 24px minmax(0, 1fr);
    grid-template-rows: auto auto;
    gap: 2px 10px;
    justify-items: start;
    min-height: 0;
    padding: 10px 12px;
    text-align: left;
  }

  .project-detail__time-node-date {
    grid-row: 1 / span 2;
    align-self: center;
  }

  .project-detail__time-node-dot {
    grid-row: 1 / span 2;
    align-self: center;
  }

  .project-detail__time-node-name {
    grid-column: 3;
    grid-row: 1;
  }

  .project-detail__time-node-subname {
    grid-column: 3;
    grid-row: 2;
    max-width: 100%;
  }

  .time-board__detail {
    padding: 12px;
  }
}
</style>
