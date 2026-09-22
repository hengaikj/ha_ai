<script setup lang="ts">
import { computed, onDeactivated, ref, watch } from "vue";
import {
  decideCommitteeReview,
  fetchCommitteeReviewTask,
  fetchCommitteeReviewTaskLatestRecord,
  fetchCommitteeReviewSummary,
  resetCommitteeSecondConfirm,
  decideCommitteeSecondConfirm,
  fetchCommitteeMeetingNoticeUsers,
  sendCommitteeMeetingNotice,
} from "@/api/committee";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import { BaseToast } from "@/components/base/BaseToast";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  CommitteeMeetingLevel,
  CommitteeReviewRecord,
  CommitteeReviewSummary,
  CommitteeUserOption,
} from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import CommitteeReviewDetailDrawer from "./CommitteeReviewDetailDrawer.vue";
import CommitteeReviewSummaryGroupTable from "./CommitteeReviewSummaryGroupTable.vue";

type ReviewSummaryDepartment =
  CommitteeReviewSummary["groups"][number]["departments"][number];

const props = withDefaults(
  defineProps<{
    gateId?: string;
    meetingId?: string;
    reviewVersionId?: string;
    meetingName?: string;
    currentAttemptNo?: number | null;
    latestAttemptNo?: number | null;
    meetingLevel?: CommitteeMeetingLevel;
    meetingStatus?: string;
    meetingStatusOptions?: SchemaOption[];
    noticePermission?: string | string[];
    summary?: CommitteeReviewSummary | null;
    showDecisionActions?: boolean;
    meetingConclusionDecision?: string;
    showReturnModifyDepartments?: boolean;
    showSecondMeetingStatus?: boolean;
    showSecondConfirmActions?: boolean;
    secondConfirms?: Array<Record<string, unknown>>;
    secondConfirmStatusOptions?: SchemaOption[];
    reviewStatusOptions?: SchemaOption[];
    approvalResultOptions?: SchemaOption[];
    conclusionStatusOptions?: SchemaOption[];
    useLatestRecordOnView?: boolean;
  }>(),
  {
    gateId: undefined,
    meetingId: undefined,
    reviewVersionId: undefined,
    meetingName: undefined,
    currentAttemptNo: null,
    latestAttemptNo: null,
    meetingLevel: undefined,
    meetingStatus: undefined,
    meetingStatusOptions: () => [],
    noticePermission: "committee:review:notice",
    summary: undefined,
    showDecisionActions: false,
    meetingConclusionDecision: undefined,
    showReturnModifyDepartments: false,
    showSecondMeetingStatus: true,
    showSecondConfirmActions: false,
    useLatestRecordOnView: false,
  },
);

const emit = defineEmits<{
  decisionSuccess: [];
}>();

const loading = ref(false);
const fallbackSummary = ref<CommitteeReviewSummary>();
const selectedDepartment = ref<ReviewSummaryDepartment>();
const detailVisible = ref(false);
const reviewDetailLoading = ref(false);
const versionSelectVisible = ref(false);
const versionSelectOptions = ref<CommitteeReviewRecord[]>([]);
const selectedVersionId = ref("");
const latestVersionId = ref("");
const decidingKey = ref("");
const noticeVisible = ref(false);

onDeactivated(() => {
  detailVisible.value = false;
  versionSelectVisible.value = false;
  noticeVisible.value = false;
});
const noticeSending = ref(false);
const noticeRecipients = ref<string[]>([]);
const noticeContent = ref("");
const noticeUsers = ref<CommitteeUserOption[]>([]);
const noticeUsersLoading = ref(false);
const noticeUsersRequestNo = ref(0);
const returnModifyMode = ref(false);
const selectedDepartmentIds = ref<string[]>([]);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const resolvedSummary = computed(() =>
  props.summary !== undefined ? props.summary : fallbackSummary.value,
);
const versionLabel = computed(() =>
  props.meetingLevel === "SECOND" || props.meetingLevel === "GROUP"
    ? "上会版本"
    : "评审版本",
);
function shouldCheckLatestReviewVersion(status?: string) {
  if (status === "CONCLUDED") return true;

  const statusLabel = props.meetingStatusOptions?.find(
    (option) => String(option.value) === String(status),
  )?.label;
  return status === "已结束" || statusLabel === "已结束";
}
const selectedDepartmentNames = computed(() => {
  const selectedIds = new Set(selectedDepartmentIds.value);
  return (resolvedSummary.value?.groups ?? [])
    .flatMap((group) => group.departments)
    .filter((department) => selectedIds.has(String(department.departmentId)))
    .map((department) => department.departmentName);
});
const canSendNotice = computed(() => {
  const statusLabel = props.meetingStatusOptions?.find(
    (option) => String(option.value) === String(props.meetingStatus),
  )?.label;
  return (
    Boolean(props.meetingId) &&
    statusLabel !== "已结束" &&
    (props.meetingLevel === "SECOND" || props.meetingLevel === "GROUP")
  );
});

async function loadNoticeUsers(keyword = "") {
  const requestNo = ++noticeUsersRequestNo.value;
  noticeUsersLoading.value = true;
  try {
    if (!props.meetingId) return;
    const response = await fetchCommitteeMeetingNoticeUsers(
      props.meetingId,
      keyword.trim(),
    );
    if (requestNo === noticeUsersRequestNo.value) {
      noticeUsers.value = response;
    }
  } catch {
    if (requestNo === noticeUsersRequestNo.value) {
      noticeUsers.value = [];
      BaseToast.error("用户列表加载失败，请稍后重试");
    }
  } finally {
    if (requestNo === noticeUsersRequestNo.value) {
      noticeUsersLoading.value = false;
    }
  }
}

const NOTICE_MAX_LENGTH = 30;
let lastLimitToastTime = 0;

function notifyNoticeLimitExceeded(
  message = "通知内容超出字数限制，最多输入 30 个字",
) {
  const now = Date.now();
  if (now - lastLimitToastTime < 1500) {
    return;
  }
  lastLimitToastTime = now;
  BaseToast.warning(message);
}

function handleNoticeKeyDown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  const allowKeys = new Set([
    "Backspace",
    "Delete",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "Tab",
    "Escape",
    "Enter",
    "Shift",
    "Control",
    "Alt",
    "Meta",
    "CapsLock",
  ]);
  if (allowKeys.has(event.key)) {
    return;
  }
  if (event.isComposing || event.keyCode === 229) {
    return;
  }

  const target = event.target as HTMLTextAreaElement | null;
  const currentLength = target ? target.value.length : noticeContent.value.length;
  const selectionLength =
    target && target.selectionStart != null && target.selectionEnd != null
      ? target.selectionEnd - target.selectionStart
      : 0;

  if (selectionLength === 0 && currentLength >= NOTICE_MAX_LENGTH) {
    event.preventDefault();
    notifyNoticeLimitExceeded();
  }
}

function handleNoticeCompositionStart(event: CompositionEvent) {
  const target = event.target as HTMLTextAreaElement | null;
  const currentLength = target ? target.value.length : noticeContent.value.length;
  const selectionLength =
    target && target.selectionStart != null && target.selectionEnd != null
      ? target.selectionEnd - target.selectionStart
      : 0;

  if (selectionLength === 0 && currentLength >= NOTICE_MAX_LENGTH) {
    notifyNoticeLimitExceeded();
  }
}

function handleNoticeCompositionEnd(event: CompositionEvent) {
  const target = event.target as HTMLTextAreaElement | null;
  const currentLength = target ? target.value.length : noticeContent.value.length;
  const insertText = event.data || "";

  if (currentLength >= NOTICE_MAX_LENGTH && insertText.length > 0) {
    notifyNoticeLimitExceeded();
  }
}

function handleNoticePaste(event: ClipboardEvent) {
  const target = event.target as HTMLTextAreaElement | null;
  const pastedText = event.clipboardData?.getData("text") || "";
  if (!pastedText) return;

  const currentLength = target ? target.value.length : noticeContent.value.length;
  const selectionLength =
    target && target.selectionStart != null && target.selectionEnd != null
      ? target.selectionEnd - target.selectionStart
      : 0;

  if (currentLength - selectionLength + pastedText.length > NOTICE_MAX_LENGTH) {
    notifyNoticeLimitExceeded();
  }
}

function openNoticeDialog() {
  noticeRecipients.value = [];
  noticeContent.value = "";
  lastLimitToastTime = 0;
  noticeVisible.value = true;
  void loadNoticeUsers();
}

function noticeUserLabel(user: CommitteeUserOption) {
  return user.displayName;
}

const noticeUserOptions = computed(() =>
  noticeUsers.value.map((user) => ({
    label: user.departmentName
      ? `${noticeUserLabel(user)} (${user.departmentName})`
      : noticeUserLabel(user),
    value: String(user.userId),
  })),
);

async function sendNotice() {
  if (!props.meetingId) {
    BaseToast.warning("当前会议不存在，无法发送通知");
    return;
  }
  if (!noticeRecipients.value.length || !noticeContent.value.trim()) {
    BaseToast.warning("请填写接收人和通知内容");
    return;
  }
  if (noticeContent.value.trim().length > NOTICE_MAX_LENGTH) {
    notifyNoticeLimitExceeded();
    return;
  }
  noticeSending.value = true;
  try {
    await sendCommitteeMeetingNotice(props.meetingId, {
      recipients: noticeRecipients.value,
      content: noticeContent.value.trim(),
    });
    BaseToast.success("通知发送成功");
    noticeVisible.value = false;
  } catch (reason) {
    const source = reason as { message?: string };
    BaseToast.error(source.message || "通知发送失败");
  } finally {
    noticeSending.value = false;
  }
}

async function openDepartmentReview(
  _departmentGroup: string,
  row: ReviewSummaryDepartment,
) {
  selectedDepartment.value = row;
  const reviewTaskId = row.taskId ?? row.currentRecord?.reviewTaskId;
  if (!reviewTaskId) {
    detailVisible.value = true;
    return;
  }
  reviewDetailLoading.value = true;
  try {
    const task = props.useLatestRecordOnView
      ? await fetchCommitteeReviewTaskLatestRecord(reviewTaskId)
      : await fetchCommitteeReviewTask(reviewTaskId);
    const records = [
      ...(task.records ?? []),
      ...(row.currentRecord ? [row.currentRecord] : []),
    ].filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) => String(candidate.id) === String(item.id),
        ) === index,
    );
    records.sort(
      (left, right) => Number(right.versionNo) - Number(left.versionNo),
    );
    const latestRecord =
      task.currentRecord ??
      records.find(
        (item) => Number(item.versionNo) === Number(task.currentVersionNo),
      ) ??
      records[0];
    if (!latestRecord) {
      detailVisible.value = true;
      return;
    }
    const latestVersionNo = task.currentVersionNo ?? latestRecord.versionNo;
    if (!shouldCheckLatestReviewVersion(props.meetingStatus)) {
      selectedDepartment.value = {
        ...row,
        currentRecord: latestRecord,
        currentVersionNo: latestVersionNo,
        updateTime:
          task.updateTime ??
          latestRecord.approvalTime ??
          latestRecord.submitTime ??
          row.updateTime,
      };
      detailVisible.value = true;
      return;
    }
    if (
      row.currentVersionNo != null &&
      Number(latestVersionNo) === Number(row.currentVersionNo)
    ) {
      selectedDepartment.value = {
        ...row,
        currentRecord: latestRecord,
        currentVersionNo: row.currentVersionNo,
        updateTime:
          task.updateTime ??
          latestRecord.approvalTime ??
          latestRecord.submitTime ??
          row.updateTime,
      };
      detailVisible.value = true;
      return;
    }
    versionSelectOptions.value = records
      .map((item) => ({
        ...item,
        versionNo: item.versionNo ?? row.currentVersionNo ?? 0,
      }))
      .sort((left, right) => Number(right.versionNo) - Number(left.versionNo));
    latestVersionId.value = String(latestRecord.id);
    selectedVersionId.value = String(latestRecord.id);
    versionSelectVisible.value = true;
  } catch {
    BaseToast.error("评审版本加载失败，请稍后重试");
  } finally {
    reviewDetailLoading.value = false;
  }
}

function versionOptionLabel(record: CommitteeReviewRecord) {
  if (String(record.id) === latestVersionId.value) return "最新版本";
  if (
    selectedDepartment.value?.currentVersionNo != null &&
    Number(record.versionNo) ===
      Number(selectedDepartment.value.currentVersionNo)
  ) {
    return versionLabel.value;
  }
  return versionLabel.value;
}

function versionSubmitTime(record: CommitteeReviewRecord) {
  const source = record as CommitteeReviewRecord & Record<string, unknown>;
  return String(
    source.submitTime ??
      source.submitAt ??
      source.createdTime ??
      source.updateTime ??
      source.approvalTime ??
      "--",
  );
}

async function openSelectedReviewVersion() {
  const selectedRecord = versionSelectOptions.value.find(
    (item) => String(item.id) === selectedVersionId.value,
  );
  if (!selectedRecord || !selectedDepartment.value) {
    BaseToast.warning(`请选择${versionLabel.value}`);
    return;
  }
  const currentDepartment = selectedDepartment.value;
  const reviewTaskId =
    currentDepartment.taskId ??
    currentDepartment.currentRecord?.reviewTaskId ??
    selectedRecord.reviewTaskId;

  if (!reviewTaskId) {
    selectedDepartment.value = {
      ...currentDepartment,
      currentRecord: selectedRecord,
      currentVersionNo: selectedRecord.versionNo,
      updateTime: selectedRecord.approvalTime ?? selectedRecord.submitTime,
    };
    versionSelectVisible.value = false;
    detailVisible.value = true;
    return;
  }

  reviewDetailLoading.value = true;
  try {
    const task = await fetchCommitteeReviewTask(reviewTaskId);
    const taskRecords = [
      ...(task.currentRecord ? [task.currentRecord] : []),
      ...(task.records ?? []),
    ];
    const record =
      taskRecords.find(
        (item) => String(item.id) === String(selectedRecord.id),
      ) ??
      taskRecords.find(
        (item) => Number(item.versionNo) === Number(selectedRecord.versionNo),
      ) ??
      selectedRecord;
    selectedDepartment.value = {
      ...currentDepartment,
      currentRecord: record,
      currentVersionNo: record.versionNo,
      updateTime:
        record.approvalTime ?? record.submitTime ?? currentDepartment.updateTime,
    };
    versionSelectVisible.value = false;
    detailVisible.value = true;
  } catch {
    BaseToast.error("评审详情加载失败，请稍后重试");
  } finally {
    reviewDetailLoading.value = false;
  }
}

function toggleReturnModifyDepartment(departmentId: string) {
  const id = String(departmentId);
  selectedDepartmentIds.value = selectedDepartmentIds.value.includes(id)
    ? selectedDepartmentIds.value.filter((item) => item !== id)
    : [...selectedDepartmentIds.value, id];
}

function toggleReturnModifyMode() {
  returnModifyMode.value = !returnModifyMode.value;
  if (!returnModifyMode.value) selectedDepartmentIds.value = [];
}

function cancelReturnModifySelection() {
  returnModifyMode.value = false;
  selectedDepartmentIds.value = [];
}

async function confirmReturnModify() {
  const departmentIds = [...selectedDepartmentIds.value];
  if (!departmentIds.length) {
    BaseToast.warning("请先选择需要返回修改的部室");
    return;
  }

  const selectedRows = (resolvedSummary.value?.groups ?? [])
    .flatMap((group) => group.departments)
    .filter((department) =>
      departmentIds.includes(String(department.departmentId)),
    );
  const reviewRecordIds = selectedRows
    .map((department) => department.currentRecord?.id)
    .filter((id): id is string => Boolean(id));
  if (reviewRecordIds.length !== selectedRows.length) {
    BaseToast.warning("所选部室没有可返回修改的评审记录");
    return;
  }

  // TODO: 接入返回修改接口，例如 await returnModifyDepartments(command)
  try {
    await openConfirm({
      title: "确认会后处理",
      message: `确认将${selectedDepartmentNames.value.join("、")}返回修改吗？未选部室将自动确认同意。`,
      type: "warning",
      confirmText: "确认处理",
      cancelText: "取消",
      successMessage: "",
    });
  } catch {
    return;
  }

  try {
    await resetCommitteeSecondConfirm(reviewRecordIds);
    BaseToast.success("已返回修改");
    cancelReturnModifySelection();
    await load();
    emit("decisionSuccess");
  } catch (reason) {
    const source = reason as { message?: string };
    BaseToast.error(source.message || "返回修改失败");
  }
}

async function decideDepartmentReview(
  _departmentGroup: string,
  row: ReviewSummaryDepartment,
  action: "approve" | "reject",
) {
  const object = "部室评审意见";
  const name = row.departmentName;
  try {
    await openConfirm({
      title: action === "approve" ? `同意${object}` : `驳回${object}`,
      message:
        action === "approve"
          ? `确认同意${object}“${name}”吗？`
          : `确认驳回${object}“${name}”吗？`,
      type: "warning",
      confirmText: action === "approve" ? "确认同意" : "确认驳回",
      successMessage:
        action === "approve" ? `${object}已同意` : `${object}已驳回`,
    });
  } catch {
    return;
  }
  const recordId = row.currentRecord?.id;
  if (!recordId) {
    BaseToast.warning("当前部室暂无可处理的正式评审版本");
    return;
  }
  const key = `${recordId}-${action}`;
  decidingKey.value = key;
  try {
    await decideCommitteeReview(
      recordId,
      action,
      row.currentRecord?.lockVersion ?? 1,
      action === "approve" ? "会议详情汇总同意" : "会议详情汇总驳回",
    );
    BaseToast.success(action === "approve" ? "评审已同意" : "评审已驳回");
    if (props.summary === undefined) {
      await load();
    }
    emit("decisionSuccess");
  } catch (reason) {
    const source = reason as { message?: string };
    BaseToast.error(source.message || "评审处理失败，请稍后重试");
  } finally {
    if (decidingKey.value === key) {
      decidingKey.value = "";
    }
  }
}

async function decideSecondConfirm(
  confirm: Record<string, unknown>,
  action: "approve" | "reject",
) {
  const department = (resolvedSummary.value?.groups ?? [])
    .flatMap((group) => group.departments)
    .find(
      (item) =>
        String(item.departmentId) === String(confirm.departmentId ?? ""),
    );
  let reviewRecordId =
    confirm.reviewRecordId ?? confirm.recordId ?? department?.currentRecord?.id;
  let lockVersion = Number(confirm.lockVersion ?? 1);
  if (!reviewRecordId) {
    const reviewTaskId = String(
      confirm.reviewTaskId ??
        department?.taskId ??
        department?.currentRecord?.reviewTaskId ??
        "",
    );
    if (!reviewTaskId) {
      BaseToast.warning("当前部室暂无可处理的正式评审版本");
      return;
    }
    try {
      const task = await fetchCommitteeReviewTaskLatestRecord(reviewTaskId);
      reviewRecordId =
        task.currentRecord?.id ??
        task.currentRecordId ??
        task.records?.find(
          (record) =>
            task.currentVersionNo != null &&
            Number(record.versionNo) === Number(task.currentVersionNo),
        )?.id ??
        task.records?.[0]?.id;
      lockVersion = Number(confirm.lockVersion ?? task.lockVersion ?? 1);
    } catch (reason) {
      const source = reason as { message?: string };
      BaseToast.error(source.message || "评审记录加载失败，请稍后重试");
      return;
    }
  }
  if (!reviewRecordId) {
    BaseToast.warning("当前部室暂无可处理的正式评审版本");
    return;
  }
  try {
    await openConfirm({
      title: action === "approve" ? "同意品牌公司确认" : "驳回品牌公司确认",
      message:
        action === "approve"
          ? "确认同意该品牌公司评审意见吗？"
          : "确认驳回该品牌公司评审意见吗？",
      type: "warning",
      confirmText: action === "approve" ? "确认同意" : "确认驳回",
      successMessage: action === "approve" ? "已同意" : "已驳回",
    });
  } catch {
    return;
  }
  const key = `${String(reviewRecordId)}-${action}`;
  decidingKey.value = key;
  try {
    await decideCommitteeSecondConfirm(
      String(reviewRecordId),
      action,
      lockVersion,
      action === "approve" ? "会议详情同意" : "会议详情驳回",
    );
    BaseToast.success(
      action === "approve" ? "品牌公司确认已同意" : "品牌公司确认已驳回",
    );
    emit("decisionSuccess");
  } catch (reason) {
    const source = reason as { message?: string };
    BaseToast.error(source.message || "品牌公司确认处理失败，请稍后重试");
  } finally {
    if (decidingKey.value === key) decidingKey.value = "";
  }
}

async function load() {
  fallbackSummary.value = undefined;
  if (props.summary !== undefined) {
    loading.value = false;
    return;
  }
  if (!props.gateId) return;
  loading.value = true;
  try {
    fallbackSummary.value = await fetchCommitteeReviewSummary(props.gateId, {
      meetingId: props.meetingId,
      reviewVersionId: props.reviewVersionId,
    });
  } finally {
    loading.value = false;
  }
}
watch(
  () =>
    [
      props.gateId,
      props.meetingId,
      props.reviewVersionId,
      props.summary,
    ] as const,
  load,
  { immediate: true },
);
</script>
<template>
  <section
    v-loading="loading || reviewDetailLoading"
    class="review-summary bq-detail-panel bq-detail-panel--history"
  >
    <BaseSectionTitle
      class="review-summary__header"
      title="各部室评审建议汇总"
      heading-tag="h2"
    >
      <template #actions>
        <PermissionButton
          v-if="canSendNotice"
          type="primary"
          @click="openNoticeDialog"
        >
          发通知
        </PermissionButton>
        <PermissionButton
          v-if="
            showReturnModifyDepartments &&
            meetingLevel !== 'GROUP' &&
            currentAttemptNo != null &&
            currentAttemptNo === latestAttemptNo &&
            !returnModifyMode
          "
          :type="returnModifyMode ? 'primary' : 'default'"
          @click="toggleReturnModifyMode"
        >
          {{ returnModifyMode ? "完成选择" : "选择返回修改部室" }}
        </PermissionButton>
      </template>
    </BaseSectionTitle>
    <!--    <div v-if="resolvedSummary" class="review-summary__metrics">-->
    <!--      <span>-->
    <!--        必审-->
    <!--        <span class="committee-text-strong">{{-->
    <!--          resolvedSummary.requiredCount-->
    <!--        }}</span>-->
    <!--      </span>-->
    <!--      <span>-->
    <!--        已同意-->
    <!--        <span class="committee-text-strong">{{-->
    <!--          resolvedSummary.approvedCount-->
    <!--        }}</span>-->
    <!--      </span>-->
    <!--      <span>-->
    <!--        待处理-->
    <!--        <span class="committee-text-strong">{{-->
    <!--          resolvedSummary.pendingCount-->
    <!--        }}</span>-->
    <!--      </span>-->
    <!--      <span>-->
    <!--        已驳回-->
    <!--        <span class="committee-text-strong">{{-->
    <!--          resolvedSummary.rejectedCount-->
    <!--        }}</span>-->
    <!--      </span>-->
    <!--    </div>-->
    <div v-if="resolvedSummary?.groups.length" class="summary-groups">
      <CommitteeReviewSummaryGroupTable
        v-for="group in resolvedSummary.groups"
        :key="group.departmentGroup"
        :group="group"
        :company-name="resolvedSummary.companyName"
        :version-column-label="versionLabel"
        :show-decision-actions="showDecisionActions"
        :meeting-conclusion-decision="meetingConclusionDecision"
        :show-return-modify-departments="returnModifyMode"
        :selected-department-ids="selectedDepartmentIds"
        :show-second-meeting-status="showSecondMeetingStatus"
        :show-second-confirm-actions="showSecondConfirmActions"
        :second-confirms="secondConfirms"
        :second-confirm-status-options="secondConfirmStatusOptions"
        :review-status-options="reviewStatusOptions"
        :conclusion-status-options="conclusionStatusOptions"
        @view-details="openDepartmentReview"
        @decision="decideDepartmentReview"
        @second-confirm="decideSecondConfirm"
        @toggle-return-modify-department="toggleReturnModifyDepartment"
      />
    </div>
    <el-empty v-else description="当前阀点尚未配置参评部室" />

    <div v-if="returnModifyMode" class="review-summary__return-modify-bar">
      <span>已选择 {{ selectedDepartmentIds.length }} 个部室返回修改</span>
      <div class="review-summary__return-modify-actions">
        <PermissionButton @click="cancelReturnModifySelection">
          取消
        </PermissionButton>
        <PermissionButton
          type="primary"
          :disabled="selectedDepartmentIds.length === 0"
          @click="confirmReturnModify"
        >
          确认处理（已选 {{ selectedDepartmentIds.length }} 个）
        </PermissionButton>
      </div>
    </div>

    <CommitteeReviewDetailDrawer
      v-model="detailVisible"
      :record="selectedDepartment?.currentRecord"
      :review-record-id="selectedDepartment?.currentRecord?.id"
      :content-loading="reviewDetailLoading"
      :department-name="selectedDepartment?.departmentName"
      :task-status="selectedDepartment?.taskStatus"
      :version-no="selectedDepartment?.currentVersionNo"
      :version-label="versionLabel"
      :update-time="selectedDepartment?.updateTime"
      :review-status-options="reviewStatusOptions"
      :approval-result-options="approvalResultOptions"
      :conclusion-status-options="conclusionStatusOptions"
    />

    <BaseConfirm
      v-model="confirmState.visible"
      v-bind="confirmState"
      append-to-body
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />

    <BaseFormDialog
      v-model="versionSelectVisible"
      title="选择评审版本"
      width="520px"
      confirm-text="查看"
      cancel-text="取消"
      :loading="reviewDetailLoading"
      append-to-body
      @confirm="openSelectedReviewVersion"
    >
      <el-radio-group
        v-model="selectedVersionId"
        class="review-version-options"
      >
        <el-radio
          v-for="record in versionSelectOptions"
          :key="record.id"
          :value="String(record.id)"
        >
          {{ versionOptionLabel(record) }} V{{ record.versionNo }}
          <span class="review-version-options__time">
            {{ versionSubmitTime(record) }}
          </span>
        </el-radio>
      </el-radio-group>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="noticeVisible"
      title="发送消息通知"
      width="680px"
      confirm-text="发送"
      cancel-text="取消"
      :loading="noticeSending"
      append-to-body
      @confirm="sendNotice"
    >
      <el-form label-position="top">
        <el-form-item label="当前会议">
          <div class="review-summary__meeting-name">
            {{ meetingName || "--" }}
          </div>
        </el-form-item>
        <el-form-item label="接收人" required>
          <el-select-v2
            v-model="noticeRecipients"
            class="review-summary__recipient-select"
            multiple
            filterable
            remote
            reserve-keyword
            :remote-method="loadNoticeUsers"
            :loading="noticeUsersLoading"
            :options="noticeUserOptions"
            clearable
            placeholder="输入姓名或部门搜索，可多选"
          />
        </el-form-item>
        <el-form-item label="通知内容" required>
          <el-input
            v-model="noticeContent"
            type="textarea"
            :rows="5"
            :maxlength="NOTICE_MAX_LENGTH"
            show-word-limit
            placeholder="请输入需要向所有已选人员发送的通知"
            @keydown="handleNoticeKeyDown"
            @compositionstart="handleNoticeCompositionStart"
            @compositionend="handleNoticeCompositionEnd"
            @paste="handleNoticePaste"
          />
        </el-form-item>
      </el-form>
    </BaseFormDialog>
  </section>
</template>
<style scoped>
.review-summary {
  display: grid;
  gap: 16px;
}

.review-summary__attempts {
  display: inline-flex;
  flex: none;
  gap: 16px;
  color: var(--bq-color-text-secondary, var(--el-text-color-regular));
  font-size: 14px;
  white-space: nowrap;
}

.review-summary__header :deep(.el-button) {
  flex: none;
}

.review-summary__meeting-name {
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  padding: 9px 12px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-weight: 600;
  line-height: 22px;
  background: var(--bq-color-bg-soft, var(--el-fill-color-light));
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.review-version-options {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.review-version-options__time {
  margin-left: 8px;
  color: var(--bq-color-text-secondary, var(--el-text-color-regular));
  font-size: 13px;
}

.review-summary__return-modify-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 64px;
  padding: 12px 20px;
  border-top: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-lighter));
  background: var(--bq-color-surface, #fff);
}

.review-summary__return-modify-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

@media (max-width: 760px) {
  .review-summary__return-modify-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .review-summary__return-modify-actions {
    justify-content: flex-end;
  }
}

.review-summary__recipient-select {
  width: 100%;
}

h2,
h3 {
  margin: 0;
}

h2 {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-section-title, 16px);
  font-weight: 700;
  line-height: 24px;
}

.review-summary__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.review-summary__metrics span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
  background: var(--bq-color-bg, #f8f9f9);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.review-summary__metrics span::after {
  margin: 0 6px;
  color: var(--bq-color-border, var(--el-border-color));
  content: "|";
}

.review-summary__metrics .committee-text-strong {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-weight: 700;
}

.summary-groups {
  display: grid;
  gap: 18px;
}

@media (max-width: 760px) {
  .review-summary__metrics {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
