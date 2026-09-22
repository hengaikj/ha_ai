<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { FullScreen, ScaleToOriginal, Upload } from "@element-plus/icons-vue";
import type { SelectInstance } from "element-plus";
import BaseRichEditor from "@/components/base/BaseRichEditor/BaseRichEditor.vue";
import BaseRichViewer from "@/components/base/BaseRichViewer.vue";
import type { UploadRequestOptions } from "element-plus";
import {
  deleteCommitteeAttachment,
  downloadCommitteeAttachment,
  fetchCommitteeRevenueReviewSuggestions,
  fetchCommitteeAttachments,
  fetchCommitteeParticipantUserOptions,
  uploadCommitteeAttachment,
  uploadCommitteeRichTextAttachment,
} from "@/api/committee";
import { BaseToast } from "@/components/base/BaseToast";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { formatDateTime } from "@/utils/formatters";
import type {
  CommitteeAttachment,
  CommitteeReviewContent,
  CommitteeReviewParticipant,
  CommitteeRevenueReviewOpinion,
  CommitteeSignal,
  CommitteeUserOption,
} from "@/types/committee";
import CommitteeSection from "./CommitteeSection.vue";
import CommitteeAttachmentList from "./CommitteeAttachmentList.vue";
import CommitteeFilePreviewDialog from "./CommitteeFilePreviewDialog.vue";
import { isSupportedCommitteeAttachment } from "../committee-attachment-utils";
import {
  filterNoticeUserOptions,
  filterResponsibleUserOptions,
} from "./committee-review-user-options";
import {
  committeeReviewContentMaxCharacters,
  countCommitteeReviewCharacters,
} from "../committee-review-content";

type ReviewContentField = keyof CommitteeReviewContent;
type ReviewSignalField =
  | "techSignal"
  | "revenueSignal"
  | "volumePriceSignal"
  | "competitivenessSignal"
  | "qualitySignal"
  | "conclusionSignal";

const props = defineProps<{
  modelValue: CommitteeReviewContent;
  editable: boolean;
  reviewTaskId?: string;
  taskId?: string;
  recordId?: string;
  departmentId?: string;
  projectId?: string;
  reviewerUserId?: string;
  currentVersionNo?: number;
  projectName?: string | null;
  valvePoint?: string | null;
}>();

const emit = defineEmits<{
  updateField: [
    field: ReviewContentField,
    value: CommitteeReviewContent[ReviewContentField],
  ];
}>();

const signalOptions: Array<{ label: string; value: CommitteeSignal }> = [
  { label: "--", value: "EMPTY" },
  { label: "", value: "GREEN" },
  { label: "", value: "YELLOW" },
  { label: "", value: "RED" },
];

const conclusionOptions: Array<{
  label: string;
  value: CommitteeSignal;
}> = [
  { label: "--", value: "EMPTY" },
  { label: "", value: "GREEN" },
  { label: "", value: "YELLOW" },
  { label: "", value: "RED" },
];

const fields: Array<{
  field: ReviewSignalField;
  label: string;
  options: typeof signalOptions | typeof conclusionOptions;
}> = [
  { field: "techSignal", label: "技术/费用", options: signalOptions },
  { field: "revenueSignal", label: "收益", options: signalOptions },
  { field: "volumePriceSignal", label: "量价", options: signalOptions },
  { field: "competitivenessSignal", label: "竞争力", options: signalOptions },
  { field: "qualitySignal", label: "质量", options: signalOptions },
  { field: "conclusionSignal", label: "结论建议", options: conclusionOptions },
];


function getRawImageUrl(value: unknown) {
  const source = String(value ?? "").trim();
  const match = source.match(/https?:\/\/[^\s"'<>()[\]\\]+/i);
  return match?.[0] ?? source;
}
const reviewAttachmentBizCode = "REVIEW_TASK";
const legacyReviewAttachmentBizCode = "REVIEW_RECORD";
const attachments = ref<CommitteeAttachment[]>([]);
const attachmentLoading = ref(false);
const uploadLoading = ref(false);
const downloadingAttachmentId = ref<string | number | null>(null);
const deleteVisible = ref(false);
const deleting = ref(false);
const pendingDelete = ref<CommitteeAttachment>();
const userLoading = reactive({ head: false, notice: false, project: false });
const headUserOptions = ref<CommitteeUserOption[]>([]);
const noticeUserOptions = ref<CommitteeUserOption[]>([]);
const projectMemberOptions = ref<CommitteeUserOption[]>([]);
const selectedUsers = ref<Record<string, CommitteeUserOption>>({});
const headUserId = ref("");
const noticeUserIds = ref<string[]>([]);
const projectMemberUserIds = ref<string[]>([]);
const committedHeadUserId = ref("");
const committedNoticeUserIds = ref<string[]>([]);
const committedProjectMemberUserIds = ref<string[]>([]);
const projectMemberActionHandledOnMouseDown = ref(false);
const headSelectRef = ref<SelectInstance>();
const noticeSelectRef = ref<SelectInstance>();
const projectMemberSelectRef = ref<SelectInstance>();
const selectVisible = reactive({ head: false, notice: false, project: false });
const revenueRecordDialogVisible = ref(false);
const revenueRecordLoading = ref(false);
const revenueRecordRows = ref<CommitteeRevenueReviewOpinion[]>([]);
const previewVisible = ref(false);
const previewFile = ref<Blob | null>(null);
const previewTitle = ref("");
const isContentFullscreen = ref(false);
const richEditorRef = ref<InstanceType<typeof BaseRichEditor> | null>(null);
let previousBodyOverflow: string | null = null;
let fullscreenTriggerElement: HTMLElement | null = null;
const richTextImageUploading = ref(false);

const contentCharacterCount = computed(() =>
  countCommitteeReviewCharacters(props.modelValue.contentText),
);
const contentCharacterLabel = computed(
  () =>
    `${contentCharacterCount.value} / ${committeeReviewContentMaxCharacters} 字符`,
);
const contentCharacterLimitExceeded = computed(
  () => contentCharacterCount.value > committeeReviewContentMaxCharacters,
);

function handleEditorContentUpdate(content: string) {
  emit("updateField", "contentText", content);
}

async function handleRichTextImageUpload(file: File) {
  richTextImageUploading.value = true;
  try {
    const result = await uploadCommitteeRichTextAttachment(file);
    const imageUrl = getRawImageUrl(result?.url);
    if (!imageUrl || result.attachmentId == null) {
      throw new Error("图片上传接口返回数据不完整");
    }
    return {
      url: imageUrl,
      attachmentId: result.attachmentId,
    };
  } catch (reason) {
    BaseToast.error(reason instanceof Error ? reason.message : "图片上传失败");
    throw reason;
  } finally {
    richTextImageUploading.value = false;
  }
}

function uniqueUsers(users: CommitteeUserOption[]) {
  return users.filter(
    (user, index, source) =>
      source.findIndex(
        (item) => String(item.userId) === String(user.userId),
      ) === index,
  );
}
const selectableHeadUsers = computed(() =>
  filterResponsibleUserOptions(
    uniqueUsers(headUserOptions.value),
    props.reviewerUserId,
  ),
);
const selectableNoticeUsers = computed(() =>
  filterNoticeUserOptions(
    uniqueUsers(noticeUserOptions.value),
    props.reviewerUserId,
  ),
);
const selectableProjectMembers = computed(() =>
  uniqueUsers(projectMemberOptions.value),
);

function isTaskReviewer(userId: string) {
  return (
    Boolean(props.reviewerUserId) &&
    String(userId) === String(props.reviewerUserId)
  );
}

function cacheUsers(rows: CommitteeUserOption[]) {
  selectedUsers.value = rows.reduce(
    (records, user) => ({ ...records, [user.userId]: user }),
    selectedUsers.value,
  );
}

function toParticipant(userId: string): CommitteeReviewParticipant {
  const user = selectedUsers.value[userId];
  return {
    userId,
    displayName: user?.displayName,
    departmentId: user?.departmentId,
  };
}

function syncParticipants() {
  emit(
    "updateField",
    "headUsers",
    committedHeadUserId.value ? [toParticipant(committedHeadUserId.value)] : [],
  );
  emit(
    "updateField",
    "noticeUsers",
    committedNoticeUserIds.value.map(toParticipant),
  );
  emit(
    "updateField",
    "projectMembers",
    committedProjectMemberUserIds.value.map(toParticipant),
  );
}

function signalClass(value?: string) {
  return `is-${String(value ?? "EMPTY").toLowerCase()}`;
}

function signalLabel(value?: CommitteeSignal) {
  if (value === "GREEN") return "绿灯";
  if (value === "YELLOW") return "黄灯";
  if (value === "RED") return "红灯";
  return "--";
}

function formatParticipantNames(
  participants: CommitteeReviewParticipant[] | undefined,
) {
  const names = (participants ?? [])
    .map((participant) => participant.displayName?.trim())
    .filter((name): name is string => Boolean(name));
  return names.length ? names.join("、") : "--";
}

const headParticipantNames = computed(() =>
  formatParticipantNames(props.modelValue.headUsers),
);
const noticeParticipantNames = computed(() =>
  formatParticipantNames(props.modelValue.noticeUsers),
);
const projectMemberNames = computed(() =>
  formatParticipantNames(props.modelValue.projectMembers),
);

function updateField(field: ReviewContentField, value: unknown) {
  emit(
    "updateField",
    field,
    value as CommitteeReviewContent[ReviewContentField],
  );
}

function restoreBodyScroll() {
  if (previousBodyOverflow === null) return;
  document.body.style.overflow = previousBodyOverflow;
  previousBodyOverflow = null;
}

function setContentFullscreen(fullscreen: boolean) {
  if (fullscreen && !props.editable) return;
  if (isContentFullscreen.value === fullscreen) return;

  if (fullscreen) {
    fullscreenTriggerElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  } else {
    restoreBodyScroll();
  }

  isContentFullscreen.value = fullscreen;
  void nextTick(() => {
    if (fullscreen) {
      richEditorRef.value?.focus();
      return;
    }
    fullscreenTriggerElement?.focus();
    fullscreenTriggerElement = null;
  });
}

function toggleContentFullscreen() {
  setContentFullscreen(!isContentFullscreen.value);
}

function handleContentFullscreenEscape(event: KeyboardEvent) {
  if (event.key !== "Escape" || !isContentFullscreen.value) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setContentFullscreen(false);
}

async function searchUsers(type: "head" | "notice" | "project", keyword = "") {
  if (type === "project" && !props.projectId) {
    projectMemberOptions.value = [];
    BaseToast.warning("当前评审任务缺少项目信息，无法加载项目组成员");
    return;
  }
  if (type !== "project" && !props.departmentId) {
    if (type === "head") headUserOptions.value = [];
    if (type === "notice") noticeUserOptions.value = [];
    BaseToast.warning("当前评审任务缺少部门信息，无法加载用户列表");
    return;
  }
  userLoading[type] = true;
  try {
    const participantType = {
      head: "HEAD",
      notice: "NOTICE",
      project: "PROJECT_MEMBER",
    } as const;
    const rows = await fetchCommitteeParticipantUserOptions(
      props.departmentId,
      participantType[type],
      keyword,
      type === "project" ? props.projectId : undefined,
    );
    if (type === "head") headUserOptions.value = rows;
    if (type === "notice") noticeUserOptions.value = rows;
    if (type === "project") projectMemberOptions.value = rows;
    cacheUsers(rows);
  } catch {
    if (type === "head") headUserOptions.value = [];
    if (type === "notice") noticeUserOptions.value = [];
    if (type === "project") projectMemberOptions.value = [];
    BaseToast.warning("用户列表加载失败，请检查部门配置或后端服务");
  } finally {
    userLoading[type] = false;
  }
}

function addHeadUser() {
  if (!headUserId.value) return;
  if (isTaskReviewer(headUserId.value)) {
    headUserId.value = "";
    BaseToast.warning("评审人不能选择自己作为负责人");
    return;
  }
  committedHeadUserId.value = headUserId.value;
  headUserId.value = "";
  syncParticipants();
}

function addNoticeUsers() {
  if (!noticeUserIds.value.length) return;
  const selfSelected = noticeUserIds.value.some(isTaskReviewer);
  const nextNoticeUserIds = noticeUserIds.value.filter(
    (userId) => !isTaskReviewer(userId),
  );
  if (selfSelected) {
    BaseToast.warning("评审人不能选择自己作为知会人");
  }
  if (!nextNoticeUserIds.length) {
    noticeUserIds.value = [];
    return;
  }
  committedNoticeUserIds.value = Array.from(
    new Set([...committedNoticeUserIds.value, ...nextNoticeUserIds]),
  );
  noticeUserIds.value = [];
  syncParticipants();
}

function addProjectMemberUsers() {
  if (!projectMemberUserIds.value.length) return;
  committedProjectMemberUserIds.value = Array.from(
    new Set([
      ...committedProjectMemberUserIds.value,
      ...projectMemberUserIds.value,
    ]),
  );
  projectMemberUserIds.value = [];
  syncParticipants();
}

function handleProjectMemberMouseDown() {
  projectMemberActionHandledOnMouseDown.value =
    projectMemberUserIds.value.length > 0;
  if (projectMemberActionHandledOnMouseDown.value) {
    addProjectMemberUsers();
  }
}

function handlePersonAction(type: "head" | "notice" | "project") {
  if (type === "project" && projectMemberUserIds.value.length) {
    addProjectMemberUsers();
    return;
  }
  if (type === "project" && projectMemberActionHandledOnMouseDown.value) {
    projectMemberActionHandledOnMouseDown.value = false;
    return;
  }

  if (selectVisible[type]) {
    if (type === "head") addHeadUser();
    if (type === "notice") addNoticeUsers();
    if (type === "project") addProjectMemberUsers();
    const selectRef = {
      head: headSelectRef,
      notice: noticeSelectRef,
      project: projectMemberSelectRef,
    }[type];
    selectRef.value?.toggleMenu();
    return;
  }

  const selectRef = {
    head: headSelectRef,
    notice: noticeSelectRef,
    project: projectMemberSelectRef,
  }[type];
  selectRef.value?.toggleMenu();
}

function handleSelectVisibleChange(type: "head" | "notice" | "project", visible: boolean) {
  selectVisible[type] = visible;
  if (visible) void searchUsers(type, "");
}

function removeCommittedUser(
  type: "head" | "notice" | "project",
  userId: string,
) {
  if (type === "head") {
    committedHeadUserId.value = "";
    syncParticipants();
    return;
  }
  if (type === "notice") {
    committedNoticeUserIds.value = committedNoticeUserIds.value.filter(
      (id) => id !== userId,
    );
    syncParticipants();
    return;
  }
  committedProjectMemberUserIds.value =
    committedProjectMemberUserIds.value.filter((id) => id !== userId);
  syncParticipants();
}

watch(
  () => props.modelValue,
  (value) => {
    const headUsers = value.headUsers ?? [];
    committedHeadUserId.value = String(headUsers[0]?.userId ?? "");
    committedNoticeUserIds.value = (value.noticeUsers ?? []).map((user) =>
      String(user.userId),
    );
    committedProjectMemberUserIds.value = (value.projectMembers ?? []).map(
      (user) => String(user.userId),
    );
    cacheUsers(
      [
        ...headUsers,
        ...(value.noticeUsers ?? []),
        ...(value.projectMembers ?? []),
      ].map((user) => ({
        userId: String(user.userId),
        displayName: user.displayName ?? String(user.userId),
        departmentId: String(user.departmentId ?? props.departmentId ?? ""),
      })),
    );
  },
  { immediate: true, deep: true },
);

async function loadAttachments() {
  if (!props.taskId) {
    attachments.value = [];
    return;
  }
  attachmentLoading.value = true;
  try {
    attachments.value = await fetchCommitteeAttachments(
      reviewAttachmentBizCode,
      props.taskId,
    );
  } finally {
    attachmentLoading.value = false;
  }
}

const revenueRecord = computed(() => revenueRecordRows.value[0]);
const revenueRecordElement = ref<HTMLElement | null>(null);
const revenueRecordContent = computed(
  () => revenueRecord.value?.opinionContent?.trim() || "",
);
const revenueRecordSubmittedTime = computed(() =>
  formatDateTime(revenueRecord.value?.submittedTime),
);

async function importRevenueReviewRecord() {
  const projectName = props.projectName?.trim();
  const valvePoint = props.valvePoint?.trim();
  if (!projectName || !valvePoint) {
    BaseToast.warning("当前评审缺少项目名称或阀点，无法导入收益评审记录");
    return;
  }
  revenueRecordLoading.value = true;
  try {
    revenueRecordDialogVisible.value = true;
    revenueRecordRows.value = await fetchCommitteeRevenueReviewSuggestions(
      projectName,
      valvePoint,
      props.reviewTaskId ?? props.taskId ?? "",
    );
  } catch (reason) {
    const source = reason as { message?: string };
    BaseToast.error(source.message || "收益评审记录导入失败");
  } finally {
    revenueRecordLoading.value = false;
  }
}

async function copyRevenueRecord() {
  try {
    const content = revenueRecordElement.value?.textContent?.trim() || "";
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(content);
      } catch {
        copyTextWithFallback(content);
      }
    } else {
      copyTextWithFallback(content);
    }
    BaseToast.success("收益评审记录已复制");
  } catch {
    BaseToast.error("复制失败，请手动复制");
  }
}

function insertRevenueRecordToEditor() {
  if (!revenueRecordContent.value) return;
  const paragraph = `<p><strong>【收益评审记录】</strong></p><blockquote><p>${revenueRecordContent.value.replace(/\n/g, "<br/>")}</p></blockquote>`;
  richEditorRef.value?.insertHtml(paragraph);
  revenueRecordDialogVisible.value = false;
  BaseToast.success("已插入收益评审记录到正文");
}

function copyTextWithFallback(content: string) {
  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.className = "allow-copy";
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("浏览器未允许复制内容");
  }
}

async function uploadAttachment(options: UploadRequestOptions) {
  uploadLoading.value = true;
  if (!isSupportedCommitteeAttachment(options.file)) {
    options.onError({
      name: "UploadAjaxError",
      status: 400,
      method: "POST",
      url: "",
      message: "不支持该附件格式，仅支持 PPTX，不支持 PPT",
    });
    BaseToast.error("不支持该附件格式，仅支持 PPTX，不支持 PPT");
    uploadLoading.value = false;
    return;
  }
  const bizId = props.taskId ?? props.recordId;
  const bizCode = props.taskId
    ? reviewAttachmentBizCode
    : legacyReviewAttachmentBizCode;
  if (!bizId) {
    const uploadErr = {
      name: "UploadAjaxError",
      status: 500,
      method: "POST",
      url: "",
      message: "当前评审任务不存在",
    };
    options.onError(uploadErr);
    BaseToast.warning("当前评审任务不存在，无法上传附件");
    uploadLoading.value = false;
    return;
  }
  try {
    await uploadCommitteeAttachment(bizCode, bizId, options.file);
    options.onSuccess({});
    BaseToast.success("附件上传成功");
    await loadAttachments();
  } catch (reason) {
    const uploadErr = {
      name: "UploadAjaxError",
      status: 500,
      method: "POST",
      url: "",
      message: reason instanceof Error ? reason.message : "附件上传失败",
    };
    options.onError(uploadErr);
    BaseToast.error("附件上传失败");
  } finally {
    uploadLoading.value = false;
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
    BaseToast.error("附件预览失败");
  }
}

async function downloadAttachment(row: CommitteeAttachment) {
  downloadingAttachmentId.value = row.id;
  try {
    const blob = row.fileUrl
      ? await fetchAttachmentBlob(row.fileUrl)
      : (await downloadCommitteeAttachment(row.id)).data;
    downloadBlob(blob, row.fileName || "附件");
  } catch {
    BaseToast.error("附件下载失败");
  } finally {
    downloadingAttachmentId.value = null;
  }
}

async function fetchAttachmentBlob(fileUrl: string) {
  const response = await globalThis.fetch(fileUrl);
  if (!response.ok) throw new Error("附件下载失败");
  return response.blob();
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function openDelete(row: CommitteeAttachment) {
  pendingDelete.value = row;
  deleteVisible.value = true;
}

async function confirmDelete() {
  if (!pendingDelete.value) return;
  deleting.value = true;
  try {
    await deleteCommitteeAttachment(pendingDelete.value.id);
    BaseToast.success("附件已删除");
    deleteVisible.value = false;
    await loadAttachments();
  } finally {
    deleting.value = false;
  }
}

onMounted(loadAttachments);
let editorEventsActive = false;

function setupEditorPanelEvents() {
  if (editorEventsActive) return;
  editorEventsActive = true;
  window.addEventListener("keydown", handleContentFullscreenEscape, true);
}

function teardownEditorPanelEvents() {
  if (!editorEventsActive) return;
  editorEventsActive = false;
  window.removeEventListener("keydown", handleContentFullscreenEscape, true);
}

function deactivateEditorPanel() {
  teardownEditorPanelEvents();
  setContentFullscreen(false);
  deleteVisible.value = false;
  revenueRecordDialogVisible.value = false;
  previewVisible.value = false;
  selectVisible.head = false;
  selectVisible.notice = false;
  selectVisible.project = false;
}

onMounted(setupEditorPanelEvents);
onActivated(setupEditorPanelEvents);
onDeactivated(deactivateEditorPanel);
onBeforeUnmount(() => {
  teardownEditorPanelEvents();
  restoreBodyScroll();
});
watch(() => [props.taskId, props.recordId], loadAttachments);
watch(
  () => props.editable,
  (editable) => {
    if (!editable) {
      setContentFullscreen(false);
    }
  },
);
</script>

<template>
  <CommitteeSection class="review-edit-panel" title="阀点评审建议">
    <template #title-extra>
      <span class="review-edit-panel__version">
        <span class="review-edit-panel__version-label">当前评审版本</span>
        <strong>{{ currentVersionNo ? `V${currentVersionNo}` : "--" }}</strong>
      </span>
    </template>
    <template #actions>
      <PermissionButton
        v-if="editable && !isContentFullscreen"
        permission="committee:project:review-benefit-opinion-import"
        type="success"
        :icon="Upload"
        :loading="revenueRecordLoading"
        @click="importRevenueReviewRecord"
      >
        导入收益评审记录
      </PermissionButton>
      <slot v-if="!isContentFullscreen" name="actions-extra" />
    </template>
    <div
      class="review-edit-panel__signals"
      :class="{ 'is-readonly': !editable }"
    >
      <template v-if="editable">
        <label v-for="item in fields" :key="item.field">
          <span class="review-edit-panel__field-label">
            <i
              v-if="item.field === 'conclusionSignal'"
              class="review-edit-panel__required-mark"
              >*</i
            >
            <span>{{ item.label }}</span>
          </span>
          <el-select
            :model-value="modelValue[item.field]"
            :teleported="false"
            @update:model-value="
              (value: unknown) => updateField(item.field, value)
            "
          >
            <template #prefix>
              <i
                v-if="modelValue[item.field] !== 'EMPTY'"
                class="review-edit-panel__signal-dot"
                :class="signalClass(modelValue[item.field])"
              />
            </template>
            <el-option
              v-for="option in item.options"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            >
              <span class="review-edit-panel__option">
                <span
                  v-if="option.value === 'EMPTY'"
                  class="review-edit-panel__signal-empty"
                >
                  --
                </span>
                <i
                  v-else
                  class="review-edit-panel__signal-dot"
                  :class="signalClass(option.value)"
                />
                <span v-if="option.value !== 'EMPTY'">{{ option.label }}</span>
              </span>
            </el-option>
          </el-select>
        </label>
      </template>
      <article
        v-for="item in fields"
        v-else
        :key="item.field"
        class="review-edit-panel__signal-summary"
        :class="[
          signalClass(modelValue[item.field]),
          { 'is-conclusion': item.field === 'conclusionSignal' },
        ]"
      >
        <span class="review-edit-panel__signal-summary-label">
          {{ item.label }}
        </span>
        <span class="review-edit-panel__signal-summary-value">
          <i
            v-if="modelValue[item.field] !== 'EMPTY'"
            class="review-edit-panel__signal-dot"
            :class="signalClass(modelValue[item.field])"
            role="img"
            :aria-label="signalLabel(modelValue[item.field])"
          />
          <span v-else class="review-edit-panel__signal-summary-empty">--</span>
        </span>
      </article>
    </div>
    <Teleport v-if="editable" to="body" :disabled="!isContentFullscreen">
      <div
        class="review-edit-panel__editor-shell"
        :class="{ 'is-fullscreen': isContentFullscreen }"
        :role="isContentFullscreen ? 'dialog' : undefined"
        :aria-modal="isContentFullscreen ? 'true' : undefined"
        :aria-label="isContentFullscreen ? '评审内容全屏编辑' : undefined"
        :tabindex="isContentFullscreen ? -1 : undefined"
      >
        <div class="review-edit-panel__editor-heading">
          <div class="review-edit-panel__required-label">
            <span>
              <i class="review-edit-panel__required-mark">*</i> 评审内容
            </span>
            <span
              v-if="isContentFullscreen"
              class="review-edit-panel__fullscreen-meta"
              :class="{ 'is-over-limit': contentCharacterLimitExceeded }"
            >
              {{ currentVersionNo ? `V${currentVersionNo}` : "--" }}
              · {{ contentCharacterLabel }}
            </span>
          </div>
          <div class="review-edit-panel__editor-heading-actions">
            <template v-if="isContentFullscreen">
              <PermissionButton
                permission="committee:project:review-benefit-opinion-import"
                type="success"
                :icon="Upload"
                :loading="revenueRecordLoading"
                @click="importRevenueReviewRecord"
              >
                导入收益评审记录
              </PermissionButton>
              <slot name="actions-extra" />
            </template>
            <PermissionButton
              class="review-edit-panel__fullscreen-toggle"
              data-testid="review-content-fullscreen-toggle"
              link
              :icon="isContentFullscreen ? ScaleToOriginal : FullScreen"
              :aria-label="isContentFullscreen ? '退出全屏' : '全屏编辑'"
              :aria-pressed="isContentFullscreen"
              :title="isContentFullscreen ? '退出全屏' : '全屏编辑'"
              @click="toggleContentFullscreen"
            >
              {{ isContentFullscreen ? "退出全屏" : "全屏编辑" }}
            </PermissionButton>
          </div>
        </div>
        <div
          v-loading="richTextImageUploading"
          class="review-edit-panel__editor"
          :class="{ 'is-fullscreen': isContentFullscreen }"
          element-loading-text="图片上传中..."
        >
          <BaseRichEditor
            ref="richEditorRef"
            class="review-edit-panel__rich-editor review-edit-panel__quill"
            :model-value="modelValue.contentText || ''"
            :editable="editable"
            :max-characters="committeeReviewContentMaxCharacters"
            :current-version-no="currentVersionNo"
            :is-fullscreen="isContentFullscreen"
            :upload-image="handleRichTextImageUpload"
            @update:model-value="handleEditorContentUpdate"
            @update:is-fullscreen="toggleContentFullscreen"
          />
          <span
            class="review-edit-panel__word-count"
            :class="{ 'is-over-limit': contentCharacterLimitExceeded }"
            aria-live="polite"
          >
            {{ contentCharacterLabel }}
          </span>
        </div>
      </div>
    </Teleport>
    <div v-if="!editable" class="review-edit-panel__editor is-readonly">
      <BaseRichViewer
        class="review-edit-panel__readonly-content"
        :content="modelValue.contentText"
      />
    </div>
    <div
      v-if="editable || attachmentLoading || attachments.length > 0"
      v-loading="attachmentLoading"
      class="review-edit-panel__attachments"
    >
      <CommitteeAttachmentList
        :files="attachments"
        :editable="editable"
        :downloading-attachment-id="downloadingAttachmentId"
        @preview="previewAttachment"
        @download="downloadAttachment"
        @delete="openDelete"
      />
      <PermissionGuard v-if="editable && (taskId || recordId)">
        <div class="review-edit-panel__upload-actions">
          <el-upload
            :show-file-list="false"
            :http-request="uploadAttachment"
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc,.pptx"
          >
            <PermissionButton variant="primary" :loading="uploadLoading">
              上传附件
            </PermissionButton>
          </el-upload>
        </div>
      </PermissionGuard>
    </div>
    <CommitteeFilePreviewDialog
      v-model="previewVisible"
      :file="previewFile"
      :file-name="previewTitle"
    />
    <div
      class="review-edit-panel__people"
      :class="{ 'is-readonly': !editable }"
    >
      <section>
        <BaseSectionTitle
          class="review-edit-panel__person-title"
          title="负责人"
          size="small"
          heading-tag="h3"
        >
          <template #title-extra>
            <i v-if="editable" class="review-edit-panel__required-mark">*</i>
          </template>
        </BaseSectionTitle>
        <div v-if="editable" class="review-edit-panel__person-search">
          <el-select
            ref="headSelectRef"
            v-model="headUserId"
            filterable
            remote
            clearable
            :loading="userLoading.head"
            :remote-method="(keyword: string) => searchUsers('head', keyword)"
            placeholder="搜索负责人姓名"
            @visible-change="(visible: boolean) => handleSelectVisibleChange('head', visible)"
            @blur="addHeadUser"
          >
            <el-option
              v-for="user in selectableHeadUsers"
              :key="user.userId"
              :label="user.displayName"
              :value="user.userId"
            />
          </el-select>
          <PermissionButton
            permission="committee:project:review-owner-select"
            @mousedown.prevent
            @click="handlePersonAction('head')"
            >选择</PermissionButton
          >
        </div>
        <div
          v-if="editable && committedHeadUserId"
          class="review-edit-panel__person-tags"
        >
          <el-tag
            class="review-edit-panel__person-tag"
            closable
            @close="removeCommittedUser('head', committedHeadUserId)"
          >
            {{
              selectedUsers[committedHeadUserId]?.displayName ??
              committedHeadUserId
            }}
          </el-tag>
        </div>
        <p v-if="!editable" class="review-edit-panel__person-value">
          <span class="committee-text-strong">{{ headParticipantNames }}</span>
        </p>
      </section>
      <section>
        <BaseSectionTitle title="知会人" size="small" heading-tag="h3" />
        <div v-if="editable" class="review-edit-panel__person-search">
          <el-select
            ref="noticeSelectRef"
            v-model="noticeUserIds"
            multiple
            filterable
            remote
            clearable
            collapse-tags
            collapse-tags-tooltip
            :loading="userLoading.notice"
            :remote-method="(keyword: string) => searchUsers('notice', keyword)"
            placeholder="搜索知会人姓名"
            @visible-change="(visible: boolean) => handleSelectVisibleChange('notice', visible)"
            @blur="addNoticeUsers"
          >
            <el-option
              v-for="user in selectableNoticeUsers"
              :key="user.userId"
              :label="user.displayName"
              :value="user.userId"
            />
          </el-select>
          <PermissionButton
            permission="committee:project:review-cc-select"
            @mousedown.prevent
            @click="handlePersonAction('notice')"
            >添加</PermissionButton
          >
        </div>
        <div
          v-if="editable && committedNoticeUserIds.length"
          class="review-edit-panel__person-tags"
        >
          <el-tag
            v-for="userId in committedNoticeUserIds"
            :key="userId"
            class="review-edit-panel__person-tag"
            closable
            @close="removeCommittedUser('notice', userId)"
          >
            {{ selectedUsers[userId]?.displayName ?? userId }}
          </el-tag>
        </div>
        <p v-if="!editable" class="review-edit-panel__person-value">
          <span class="committee-text-strong">{{
            noticeParticipantNames
          }}</span>
        </p>
      </section>
      <section>
        <BaseSectionTitle title="项目组成员" size="small" heading-tag="h3" />
        <div v-if="editable" class="review-edit-panel__person-search">
          <el-select
            ref="projectMemberSelectRef"
            v-model="projectMemberUserIds"
            multiple
            filterable
            remote
            clearable
            collapse-tags
            collapse-tags-tooltip
            :loading="userLoading.project"
            :remote-method="
              (keyword: string) => searchUsers('project', keyword)
            "
            placeholder="搜索项目组成员姓名"
            @visible-change="(visible: boolean) => handleSelectVisibleChange('project', visible)"
            @blur="addProjectMemberUsers"
          >
            <el-option
              v-for="user in selectableProjectMembers"
              :key="user.userId"
              :label="
                user.departmentName
                  ? `${user.displayName}（${user.departmentName}）`
                  : user.displayName
              "
              :value="user.userId"
            />
          </el-select>
          <PermissionButton
            permission="committee:project:review-member-select"
            @mousedown.prevent="handleProjectMemberMouseDown"
            @click="handlePersonAction('project')"
            >添加</PermissionButton
          >
        </div>
        <div
          v-if="editable && committedProjectMemberUserIds.length"
          class="review-edit-panel__person-tags"
        >
          <el-tag
            v-for="userId in committedProjectMemberUserIds"
            :key="userId"
            class="review-edit-panel__person-tag"
            closable
            @close="removeCommittedUser('project', userId)"
          >
            {{ selectedUsers[userId]?.displayName ?? userId }}
          </el-tag>
        </div>
        <p v-if="!editable" class="review-edit-panel__person-value">
          <span class="committee-text-strong">{{ projectMemberNames }}</span>
        </p>
      </section>
    </div>

    <BaseConfirm
      v-model="deleteVisible"
      title="删除附件"
      :message="`确认删除附件“${pendingDelete?.fileName ?? ''}”吗？删除后列表不再展示该文件。`"
      type="danger"
      confirm-text="删除"
      :loading="deleting"
      @confirm="confirmDelete"
    />

    <BaseFormDialog
      v-model="revenueRecordDialogVisible"
      append-to-body
      title="收益评审记录"
      width="580px"
      confirm-text="收益评审记录"
      cancel-text="关闭"
    >
      <el-empty
        v-if="!revenueRecordRows.length"
        description="暂无收益评审记录"
      />
      <div v-else class="review-edit-panel__revenue-record-wrap">
        <pre
          ref="revenueRecordElement"
          class="review-edit-panel__revenue-record"
          >{{ revenueRecordContent || "--" }}</pre
        >
        <div class="review-edit-panel__revenue-meta">
          <span>部门：{{ revenueRecord?.department || "--" }}</span>
          <span>时间：{{ revenueRecordSubmittedTime }}</span>
          <span>提交人：{{ revenueRecord?.submitterName || "--" }}</span>
        </div>
      </div>
      <template #footer>
        <PermissionButton @click="revenueRecordDialogVisible = false">
          关闭
        </PermissionButton>
        <PermissionButton
          v-if="editable"
          type="primary"
          plain
          @click="insertRevenueRecordToEditor"
        >
          插入到正文
        </PermissionButton>
        <PermissionButton type="primary" @click="copyRevenueRecord">
          复制全部
        </PermissionButton>
      </template>
    </BaseFormDialog>
  </CommitteeSection>
</template>

<style scoped>
.review-edit-panel {
  gap: 18px;
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary-blue, var(--el-color-primary)) 18%,
    var(--bq-color-border, var(--el-border-color))
  );
  box-shadow:
    0 12px 28px rgba(47, 111, 232, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.9) inset;
}

.review-edit-panel:hover {
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary-blue, var(--el-color-primary)) 24%,
    var(--bq-color-border, var(--el-border-color))
  );
  box-shadow:
    0 14px 30px rgba(47, 111, 232, 0.09),
    0 1px 0 rgba(255, 255, 255, 0.92) inset;
  transform: none;
}

.review-edit-panel:focus-within {
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary-blue, var(--el-color-primary)) 34%,
    var(--bq-color-border, var(--el-border-color))
  );
}

.review-edit-panel :deep(.committee-section__header) {
  min-height: 42px;
  width: calc(100% + 32px);
  margin: -16px -16px 0;
  padding: 13px 16px;
  background: color-mix(
    in srgb,
    var(--bq-color-primary-soft, #edf4ff) 52%,
    var(--bq-color-surface, #ffffff)
  );
  border-bottom: 1px solid
    color-mix(
      in srgb,
      var(--bq-color-primary-blue, var(--el-color-primary)) 12%,
      var(--bq-color-border-subtle, var(--el-border-color-lighter))
    );
  border-radius: var(--bq-radius-control, 4px) var(--bq-radius-control, 4px) 0 0;
}

.review-edit-panel :deep(.base-section-title__actions) {
  column-gap: 8px;
}

.review-edit-panel :deep(.base-section-title__actions .el-button--success),
.review-edit-panel__editor-heading-actions :deep(.el-button--success) {
  --el-button-text-color: var(--bq-color-primary-blue, var(--el-color-primary));
  --el-button-bg-color: var(--bq-color-surface, #ffffff);
  --el-button-border-color: color-mix(
    in srgb,
    var(--bq-color-primary-blue, var(--el-color-primary)) 30%,
    var(--bq-color-border, var(--el-border-color))
  );
  --el-button-hover-text-color: var(
    --bq-color-primary-active,
    var(--el-color-primary-dark-2)
  );
  --el-button-hover-bg-color: var(--bq-color-primary-soft, #edf4ff);
  --el-button-hover-border-color: var(
    --bq-color-primary-blue,
    var(--el-color-primary)
  );
  --el-button-active-text-color: var(
    --bq-color-primary-active,
    var(--el-color-primary-dark-2)
  );
  --el-button-active-bg-color: color-mix(
    in srgb,
    var(--bq-color-primary-soft, #edf4ff) 78%,
    var(--bq-color-surface, #ffffff)
  );
  --el-button-active-border-color: var(
    --bq-color-primary-active,
    var(--el-color-primary-dark-2)
  );
}

.review-edit-panel__version {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 0 10px;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  line-height: 18px;
  background: color-mix(
    in srgb,
    var(--bq-color-surface, #ffffff) 88%,
    var(--bq-color-primary-soft, #edf4ff)
  );
  border: 1px solid
    color-mix(
      in srgb,
      var(--bq-color-primary-blue, var(--el-color-primary)) 14%,
      var(--bq-color-border-subtle, var(--el-border-color-light))
    );
  border-radius: var(--bq-radius-control, 4px);
}

.review-edit-panel__version-label::after {
  margin: 0 5px;
  color: var(--bq-color-border, var(--el-border-color));
  content: "|";
}

.review-edit-panel__version strong {
  color: var(--bq-color-primary-active, var(--el-color-primary-dark-2));
  font-size: 13px;
  font-weight: 700;
}

.review-edit-panel__signals {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr)) minmax(148px, 1.12fr);
  gap: 12px;
  padding: 14px 16px;
  background: color-mix(
    in srgb,
    var(--bq-color-primary-soft, #edf4ff) 18%,
    var(--bq-color-surface, #ffffff)
  );
  border: 1px solid
    color-mix(
      in srgb,
      var(--bq-color-primary-blue, var(--el-color-primary)) 10%,
      var(--bq-color-border-subtle, var(--el-border-color-lighter))
    );
  border-radius: var(--bq-radius-control);
}

.review-edit-panel__signals.is-readonly {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 10px 28px;
  padding: 12px 24px;
  background: var(--bq-color-white-soft, var(--el-bg-color));
}

.review-edit-panel__signals label {
  display: grid;
  gap: 8px;
  min-width: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
}

.review-edit-panel__field-label,
.review-edit-panel__person-title {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.review-edit-panel__field-label {
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-weight: 500;
}

@media (min-width: 1201px) {
  .review-edit-panel__signals:not(.is-readonly) label:last-child {
    padding-left: 14px;
    border-left: 1px solid
      color-mix(
        in srgb,
        var(--bq-color-primary-blue, var(--el-color-primary)) 14%,
        var(--bq-color-border-subtle, var(--el-border-color-lighter))
      );
  }

  .review-edit-panel__signals:not(.is-readonly)
    label:last-child
    .review-edit-panel__field-label {
    color: var(--bq-color-text, var(--el-text-color-primary));
    font-weight: 600;
  }
}

.review-edit-panel__required-mark {
  margin-left: 3px;
  color: var(--bq-color-danger, var(--el-color-danger));
  font-style: normal;
}

.review-edit-panel__signals :deep(.el-select) {
  width: 100%;
}

.review-edit-panel__signals :deep(.el-select__wrapper) {
  min-height: 36px;
  box-shadow: 0 0 0 1px var(--bq-color-border-subtle) inset;
}

.review-edit-panel__signal-summary {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
  min-height: 32px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.review-edit-panel__signal-summary.is-conclusion {
  margin-left: 4px;
  padding-left: 28px;
  border-left: 1px solid var(--bq-color-border-subtle);
}

.review-edit-panel__signal-summary-label {
  overflow: hidden;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-body, 13px);
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-edit-panel__signal-summary-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 10px;
  min-height: 18px;
}

.review-edit-panel__signal-summary-empty {
  color: var(--bq-color-text-muted, var(--el-text-color-placeholder));
  font-size: var(--bq-font-body, 13px);
  font-weight: 500;
  line-height: 20px;
}

.review-edit-panel__signal-summary-value .review-edit-panel__signal-dot {
  width: 10px;
  height: 10px;
  box-shadow: none;
}

.review-edit-panel__option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.review-edit-panel__signal-empty {
  color: var(--bq-color-text-muted, var(--el-text-color-placeholder));
  font-size: 14px;
  line-height: 14px;
}

.review-edit-panel__signal-dot {
  display: inline-flex;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--bq-color-text-muted, var(--el-text-color-placeholder));
  box-shadow: 0 0 0 5px var(--bq-color-bg-soft, var(--el-fill-color-light));
}

.review-edit-panel__signal-dot.is-green {
  background: var(--bq-color-success, var(--el-color-success));
}

.review-edit-panel__signal-dot.is-yellow {
  background: var(--bq-color-warning, var(--el-color-warning));
}

.review-edit-panel__signal-dot.is-red {
  background: var(--bq-color-danger, var(--el-color-danger));
}

.review-edit-panel__editor {
  --review-content-image-max-width: min(720px, 80%);
  --review-content-image-max-height: 420px;

  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid
    color-mix(
      in srgb,
      var(--bq-color-primary-blue, var(--el-color-primary)) 12%,
      var(--bq-color-border, var(--el-border-color))
    );
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-surface, var(--el-bg-color));
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

/* 评审编辑区允许浏览器为缺少 italic 字形的中文字体合成斜体 */
.review-edit-panel__rich-editor {
  font-synthesis: style;
}

.review-edit-panel__editor:focus-within {
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary-blue, var(--el-color-primary)) 46%,
    var(--bq-color-border, var(--el-border-color))
  );
  box-shadow: 0 0 0 2px
    color-mix(
      in srgb,
      var(--bq-color-primary-blue, var(--el-color-primary)) 10%,
      transparent
    );
}

.review-edit-panel__editor-shell {
  min-width: 0;
}

.review-edit-panel__editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  margin-bottom: 8px;
}

.review-edit-panel__required-label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-compact, 14px);
  font-weight: 600;
  line-height: 20px;
}

.review-edit-panel__editor-heading-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.review-edit-panel__fullscreen-toggle {
  min-height: 28px;
  padding: 0 6px;
  font-size: 13px;
}

.review-edit-panel__fullscreen-meta {
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  font-weight: 400;
}

.review-edit-panel__editor-shell.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: calc(var(--el-index-popper, 2000) - 100);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100vw;
  height: 100vh;
  padding: 16px 24px 24px;
  background: var(--bq-color-bg-soft, var(--el-bg-color-page));
}

.review-edit-panel__editor-shell.is-fullscreen
  .review-edit-panel__editor-heading {
  flex: 0 0 auto;
  min-height: 32px;
  margin-bottom: 0;
}

.review-edit-panel__editor.is-fullscreen {
  --review-content-image-max-width: min(960px, 75%);
  --review-content-image-max-height: calc(100vh - 220px);

  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  border-color: var(--bq-color-border, var(--el-border-color));
  border-radius: var(--bq-radius-page, 2px);
  box-shadow: var(--bq-shadow-panel);
}

.review-edit-panel__editor.is-readonly {
  min-height: 220px;
}

.review-edit-panel__rich-editor {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  border: 0;
  border-radius: 0;
  min-height: 380px;
}

.review-edit-panel__editor.is-fullscreen .review-edit-panel__rich-editor {
  height: 100%;
  min-height: 0;
}

@media (max-width: 680px) {
  .review-edit-panel__editor-shell.is-fullscreen {
    gap: 8px;
    padding: 12px;
  }

  .review-edit-panel__editor-shell.is-fullscreen
    .review-edit-panel__editor-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .review-edit-panel__editor-heading-actions {
    justify-content: flex-start;
  }

  .review-edit-panel__editor,
  .review-edit-panel__editor.is-fullscreen {
    --review-content-image-max-width: 100%;
  }
}

.review-edit-panel__readonly-content {
  min-height: 220px;
  padding: 22px 26px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 13px);
  line-height: 1.8;
  word-break: break-word;
  white-space: normal;
}

.review-edit-panel__readonly-content :deep(p) {
  margin: 0 0 10px;
}

.review-edit-panel__readonly-content :deep(ol),
.review-edit-panel__readonly-content :deep(ul) {
  margin: 0 0 10px;
  padding-left: 22px;
}

.review-edit-panel__readonly-content :deep(img) {
  cursor: zoom-in;
  display: block !important;
  float: none !important;
  clear: both !important;
  max-width: 100%;
  height: auto;
  margin: 16px auto;
  transition:
    opacity 0.2s ease,
    box-shadow 0.2s ease;
  border-radius: 4px;

  &[data-align="left"],
  &[align="left"] {
    display: block !important;
    float: none !important;
    clear: both !important;
    margin-left: 0 !important;
    margin-right: auto !important;
  }

  &[data-align="right"],
  &[align="right"] {
    display: block !important;
    float: none !important;
    clear: both !important;
    margin-left: auto !important;
    margin-right: 0 !important;
  }

  &[data-align="center"],
  &[align="center"] {
    display: block !important;
    float: none !important;
    clear: both !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  &:hover {
    opacity: 0.95;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
}

.review-edit-panel__readonly-content :deep(table) {
  display: table !important;
  float: none !important;
  clear: both !important;
  margin: 1.2em auto !important;
  width: 100%;
  max-width: 100% !important;
}

.review-edit-panel__word-count {
  position: absolute;
  right: 14px;
  bottom: 10px;
  z-index: 1;
  padding: 0 4px;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
  pointer-events: none;
}

.review-edit-panel__fullscreen-meta.is-over-limit,
.review-edit-panel__word-count.is-over-limit {
  color: var(--bq-color-danger, var(--el-color-danger));
  font-weight: 600;
}

.review-edit-panel__attachments {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  margin-top: -4px;
}

.review-edit-panel__upload-actions {
  display: flex;
  justify-content: flex-end;
  min-width: max-content;
}

.review-edit-panel__upload-actions :deep(.el-button) {
  min-height: 40px;
  padding: 0 18px;
  font-size: var(--bq-font-body, 13px);
}

.review-edit-panel__people {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  padding-top: 16px;
  border-top: 1px solid var(--bq-color-border-subtle);
}

.review-edit-panel__people section {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
  padding: 0 18px;
}

.review-edit-panel__people section:first-child {
  padding-left: 0;
}

.review-edit-panel__people section:last-child {
  padding-right: 0;
}

.review-edit-panel__people section + section {
  border-left: 1px solid var(--bq-color-border-subtle);
}

.review-edit-panel__people.is-readonly {
  padding: 18px 0 8px;
}

.review-edit-panel__people.is-readonly section {
  gap: 12px;
}

.review-edit-panel__people h3 {
  margin: 0;
  color: var(--bq-color-text-muted, var(--el-text-color-placeholder));
  font-size: 13px;
  font-weight: 700;
  line-height: 22px;
}

.review-edit-panel__person-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  margin: 0;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-body, 13px);
  line-height: 22px;
}

.review-edit-panel__person-value .committee-text-strong {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-weight: 600;
}

.review-edit-panel__person-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px;
  gap: 10px;
  min-width: 0;
}

.review-edit-panel__person-search :deep(.el-select) {
  width: 100%;
}

.review-edit-panel__person-search :deep(.el-select__wrapper) {
  min-height: 40px;
  box-shadow: 0 0 0 1px var(--bq-color-border-subtle) inset;
}

.review-edit-panel__person-search :deep(.el-input__wrapper) {
  min-height: 40px;
  box-shadow: 0 0 0 1px var(--bq-color-border-subtle) inset;
}

.review-edit-panel__person-search :deep(.el-button) {
  width: 92px;
  min-height: 40px;
  margin: 0;
}

.review-edit-panel__person-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 32px;
}

.review-edit-panel__person-tag {
  max-width: 100%;
  min-height: 32px;
  font-size: var(--bq-font-body, 13px);
  font-weight: 600;
}

.review-edit-panel__footer {
  display: flex;
  justify-content: flex-end;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
}

.review-edit-panel__revenue-record {
  box-sizing: border-box;
  min-height: 220px;
  max-height: 420px;
  margin: 0;
  padding: 18px;
  overflow: auto;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-family: inherit;
  font-size: var(--bq-font-body, 13px);
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--bq-color-bg-soft, var(--el-fill-color-light));
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
}

.review-edit-panel__revenue-record-wrap {
  min-width: 0;
}

.review-edit-panel__revenue-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  padding: 10px 2px 0;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-compact, 12px);
  line-height: 20px;
}

@media (max-width: 1200px) {
  .review-edit-panel__signals {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .review-edit-panel__signals.is-readonly {
    gap: 8px 24px;
  }

  .review-edit-panel__people {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .review-edit-panel__people section {
    padding: 0;
  }

  .review-edit-panel__people section + section {
    padding-top: 14px;
    border-top: 1px solid var(--bq-color-border-subtle);
    border-left: 0;
  }
}

@media (max-width: 680px) {
  .review-edit-panel__signals {
    grid-template-columns: 1fr;
  }

  .review-edit-panel__signals.is-readonly {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
    padding: 12px 16px;
  }

  .review-edit-panel__signal-summary.is-conclusion {
    margin-left: 0;
    padding-left: 0;
    border-left: 0;
  }

  .review-edit-panel__person-search {
    grid-template-columns: minmax(0, 1fr) 84px;
  }

  .review-edit-panel__person-search :deep(.el-button) {
    width: 84px;
  }
}
</style>
