<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { UploadFile, UploadUserFile } from "element-plus";
import {
  CircleCheckFilled,
  CircleCloseFilled,
  Check,
  WarningFilled,
} from "@element-plus/icons-vue";
import {
  downloadCommitteeAttachment,
  fetchCommitteeAttachments,
} from "@/api/committee";
import { BaseToast } from "@/components/base/BaseToast";
import DictTag from "@/components/base/DictTag.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import CommitteeAttachmentList from "./CommitteeAttachmentList.vue";
import CommitteeFilePreviewDialog from "./CommitteeFilePreviewDialog.vue";
import type {
  CommitteeAttachment,
  CommitteeConclusion,
  CommitteeId,
  CommitteeMeetingLevel,
} from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import { isSupportedCommitteeAttachment } from "../committee-attachment-utils";

type DecisionAction = "submit-confirmation" | "confirm" | "reject";
type DisplayAttachment = Omit<CommitteeAttachment, "fileUrl"> & {
  fileUrl?: string | null;
};

const props = withDefaults(
  defineProps<{
    conclusion?: CommitteeConclusion;
    decisionLabel: string;
    toneClass: string;
    meetingConclusionDecision?: string;
    meetingConclusionText?: string;
    meetingConclusionId?: CommitteeId;
    meetingId?: CommitteeId;
    conclusionStatusOptions?: SchemaOption[];
    level: CommitteeMeetingLevel;
    canRecord?: boolean;
    recordDecision?: string;
    recordText?: string;
    saving?: boolean;
  }>(),
  {
    canRecord: false,
    recordDecision: "PASS",
    recordText: "",
    saving: false,
    meetingConclusionDecision: "",
    meetingConclusionText: "",
    meetingConclusionId: "",
    meetingId: "",
    conclusionStatusOptions: () => [],
  },
);

const hasConclusion = computed(
  () =>
    Boolean(props.conclusion?.decision) ||
    Boolean(props.meetingConclusionDecision),
);
const displayedDecision = computed(
  () => props.conclusion?.decision ?? props.meetingConclusionDecision,
);
const displayedText = computed(
  () => props.conclusion?.conclusionText ?? props.meetingConclusionText,
);
const conclusionAttachmentBizId = computed(() => props.meetingId);
const attachmentFiles = ref<UploadUserFile[]>([]);
const conclusionAttachments = ref<DisplayAttachment[]>([]);
const pendingAttachmentItems = computed<CommitteeAttachment[]>(() =>
  attachmentFiles.value.map((file) => ({
    id: String(file.uid),
    bizCode: "",
    bizId: "",
    fileName: file.name || file.raw?.name || "附件",
    fileSize: file.size || file.raw?.size || 0,
    fileType: file.raw?.type || "application/octet-stream",
  })),
);
const attachmentLoading = ref(false);
const attachmentPreviewVisible = ref(false);
const attachmentPreviewFile = ref<Blob | null>(null);
const attachmentPreviewTitle = ref("");
let attachmentRequestId = 0;
let conclusionPanelUnmounted = false;

const conclusionOptions = [
  {
    value: "PASS",
    label: "通过",
    icon: CircleCheckFilled,
    className: "is-pass",
  },
  {
    value: "CONDITIONAL_PASS",
    label: "带条件通过",
    icon: WarningFilled,
    className: "is-conditional",
  },
  {
    value: "FAIL",
    label: "不通过",
    icon: CircleCloseFilled,
    className: "is-fail",
  },
];

const emit = defineEmits<{
  decision: [conclusion: CommitteeConclusion, action: DecisionAction];
  record: [files: File[]];
  "update:recordDecision": [value: string];
  "update:recordText": [value: string];
}>();

function handleAttachmentChange(file: UploadFile, fileList: UploadUserFile[]) {
  if (file.raw && !isSupportedCommitteeAttachment(file.raw)) {
    attachmentFiles.value = fileList.filter((item) => item.uid !== file.uid);
    BaseToast.error("不支持该附件格式，仅支持 PPTX，不支持 PPT");
    return;
  }
  attachmentFiles.value = fileList;
}

function handleAttachmentRemove(_file: UploadFile, fileList: UploadUserFile[]) {
  attachmentFiles.value = fileList;
}

function removeAttachment(index: number) {
  attachmentFiles.value = attachmentFiles.value.filter(
    (_file, fileIndex) => fileIndex !== index,
  );
}

function removePendingAttachment(file: CommitteeAttachment) {
  const index = attachmentFiles.value.findIndex(
    (item) => String(item.uid) === String(file.id),
  );
  if (index >= 0) removeAttachment(index);
}

function submitRecord() {
  const files = attachmentFiles.value.flatMap((file) =>
    file.raw ? [file.raw] : [],
  );
  emit("record", files);
}

async function loadConclusionAttachments() {
  const bizId = conclusionAttachmentBizId.value;
  if (!bizId) {
    conclusionAttachments.value = [];
    return;
  }
  attachmentLoading.value = true;
  try {
    conclusionAttachments.value = await fetchCommitteeAttachments(
      "MEETING",
      bizId,
    );
  } finally {
    attachmentLoading.value = false;
  }
}

async function previewConclusionAttachment(file: DisplayAttachment) {
  const requestId = ++attachmentRequestId;
  attachmentPreviewFile.value = null;
  attachmentPreviewTitle.value = file.fileName;
  attachmentPreviewVisible.value = true;
  try {
    const response = file.fileUrl
      ? await globalThis.fetch(file.fileUrl).then(async (result) => {
          if (!result.ok) throw new Error("附件下载失败");
          return { data: await result.blob() };
        })
      : await downloadCommitteeAttachment(file.id);
    if (conclusionPanelUnmounted || requestId !== attachmentRequestId) return;
    attachmentPreviewFile.value = response.data;
  } catch {
    if (!conclusionPanelUnmounted && requestId === attachmentRequestId) {
      attachmentPreviewVisible.value = false;
      BaseToast.error("附件预览失败");
    }
  }
}

async function downloadConclusionAttachment(file: DisplayAttachment) {
  try {
    const response = file.fileUrl
      ? await globalThis.fetch(file.fileUrl).then(async (result) => {
          if (!result.ok) throw new Error("附件下载失败");
          return { data: await result.blob() };
        })
      : await downloadCommitteeAttachment(file.id);
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.fileName || "附件";
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    BaseToast.error("附件下载失败");
  }
}

onMounted(loadConclusionAttachments);
watch(conclusionAttachmentBizId, loadConclusionAttachments);
onBeforeUnmount(() => {
  conclusionPanelUnmounted = true;
  attachmentRequestId += 1;
  attachmentPreviewFile.value = null;
});
</script>

<template>
  <section class="committee-block meeting-conclusion-panel">
    <BaseSectionTitle title="会议结论" heading-tag="h2" />

    <div v-if="canRecord" class="meeting-conclusion-entry__body">
      <section class="meeting-conclusion-entry__section">
        <BaseSectionTitle title="会议结论" size="small" heading-tag="h3" />
        <el-radio-group
          :model-value="props.recordDecision"
          class="meeting-conclusion-options"
          @update:model-value="emit('update:recordDecision', String($event))"
        >
          <el-radio
            v-for="option in conclusionOptions"
            :key="option.value"
            class="meeting-conclusion-option"
            :class="[
              option.className,
              { 'is-selected': props.recordDecision === option.value },
            ]"
            :value="option.value"
            border
          >
            <span class="meeting-conclusion-option__icon" aria-hidden="true">
              <component :is="option.icon" />
            </span>
            <strong>{{ option.label }}</strong>
            <span class="meeting-conclusion-option__check" aria-hidden="true">
              <Check />
            </span>
          </el-radio>
        </el-radio-group>
      </section>
      <section class="meeting-conclusion-entry__section">
        <BaseSectionTitle
          title="会议决议事项"
          size="small"
          heading-tag="h3"
        />
        <el-input
          :model-value="props.recordText"
          type="textarea"
          :rows="6"
          maxlength="2000"
          show-word-limit
          placeholder="请输入本次会议形成的正式决议内容"
          @update:model-value="emit('update:recordText', String($event))"
        />
        <div class="meeting-conclusion-entry__attachments">
          <el-upload
            v-model:file-list="attachmentFiles"
            :auto-upload="false"
            :show-file-list="false"
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc,.pptx"
            :limit="5"
            @change="handleAttachmentChange"
            @remove="handleAttachmentRemove"
          >
            <PermissionButton plain :disabled="saving">
              上传附件
            </PermissionButton>
          </el-upload>
          <CommitteeAttachmentList
            :files="pendingAttachmentItems"
            editable
            :show-download="false"
            :previewable="false"
            @delete="removePendingAttachment"
          />
        </div>
      </section>
      <div class="meeting-conclusion-entry__actions">
        <PermissionButton
          type="primary"
          :loading="saving"
          @click="submitRecord"
        >
          提交会议结论
        </PermissionButton>
      </div>
    </div>
    <!--    <article-->
    <!--      v-else-if="conclusion"-->
    <!--      class="meeting-conclusion-card"-->
    <!--      :class="toneClass"-->
    <!--    >-->
    <!--      <div class="meeting-conclusion-card__body">-->
    <!--        <div class="meeting-conclusion-card__row">-->
    <!--          <div class="committee-text-strong">会议结论</div>-->
    <!--          <span class="meeting-conclusion-card__decision">-->
    <!--            {{ decisionLabel }}-->
    <!--          </span>-->
    <!--        </div>-->
    <!--        <div class="meeting-conclusion-card__row">-->
    <!--          <div class="committee-text-strong">会议决议事项</div>-->
    <!--          <p>{{ conclusion.conclusionText || "&#45;&#45;" }}</p>-->
    <!--        </div>-->
    <!--      </div>-->
    <!--      <div class="meeting-conclusion-card__actions bq-table-actions">-->
    <!--        <PermissionButton-->
    <!--          v-if="conclusion.conclusionStatus === 'DRAFT'"-->
    <!--          link-->
    <!--          :permission="[`committee:meeting:${level.toLowerCase()}:conclude`]"-->
    <!--          @click="emit('decision', conclusion, 'submit-confirmation')"-->
    <!--        >-->
    <!--          提交确认-->
    <!--        </PermissionButton>-->
    <!--        <PermissionButton-->
    <!--          v-if="conclusion.conclusionStatus === 'PENDING_CONFIRMATION'"-->
    <!--          link-->
    <!--          permission="committee:conclusion:confirm"-->
    <!--          @click="emit('decision', conclusion, 'confirm')"-->
    <!--        >-->
    <!--          确认-->
    <!--        </PermissionButton>-->
    <!--        <PermissionButton-->
    <!--          v-if="conclusion.conclusionStatus === 'PENDING_CONFIRMATION'"-->
    <!--          link-->
    <!--          type="danger"-->
    <!--          permission="committee:conclusion:reject"-->
    <!--          @click="emit('decision', conclusion, 'reject')"-->
    <!--        >-->
    <!--          驳回结论-->
    <!--        </PermissionButton>-->
    <!--      </div>-->
    <!--    </article>-->
    <article
      v-if="hasConclusion"
      class="meeting-conclusion-card"
      :class="toneClass"
    >
      <div class="meeting-conclusion-card__body">
        <div class="meeting-conclusion-card__summary">
          <span class="meeting-conclusion-card__label">会议结论</span>
          <DictTag
            class="meeting-conclusion-card__decision-tag"
            :value="displayedDecision"
            :options="props.conclusionStatusOptions"
          />
        </div>
        <section class="meeting-conclusion-card__resolution">
          <div class="meeting-conclusion-card__section-title">会议决议事项</div>
          <p>{{ displayedText || "--" }}</p>
        </section>
        <section
          v-if="hasConclusion"
          v-loading="attachmentLoading"
          class="meeting-conclusion-card__attachments"
          data-testid="conclusion-attachments"
        >
          <div class="meeting-conclusion-card__attachments-head">
            <div class="meeting-conclusion-card__attachments-title">
              <span class="meeting-conclusion-card__section-title"
                >结论附件</span
              >
              <span
                v-if="conclusionAttachments.length"
                class="meeting-conclusion-card__attachment-count"
              >
                共 {{ conclusionAttachments.length }} 个
              </span>
            </div>
          </div>
          <CommitteeAttachmentList
            v-if="conclusionAttachments.length"
            :files="conclusionAttachments"
            :editable="false"
            @preview="previewConclusionAttachment"
            @download="downloadConclusionAttachment"
          />
          <span v-else class="meeting-conclusion-card__attachments-empty">
            暂无附件
          </span>
          <CommitteeFilePreviewDialog
            v-model="attachmentPreviewVisible"
            :file="attachmentPreviewFile"
            :file-name="attachmentPreviewTitle"
          />
        </section>
      </div>
    </article>
    <el-empty v-else-if="!canRecord" description="尚未录入会议结论" />
  </section>
</template>

<style scoped>
.meeting-conclusion-panel {
  padding: 20px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle, #dcdfe6);
  border-radius: 4px;
  box-shadow: none;
}

.meeting-conclusion-panel > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 0;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.meeting-conclusion-panel h2 {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-section-title, 16px);
  font-weight: 700;
  line-height: 24px;
}

.meeting-conclusion-entry__body {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding-top: 20px;
}

.meeting-conclusion-entry__section {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 16px;
  background: #fbfcfe;
  border: 1px solid var(--bq-color-border-subtle, #ebeef5);
  border-radius: 4px;
}

.meeting-conclusion-entry__section h3 {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.meeting-conclusion-entry__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.meeting-conclusion-entry__attachments {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.meeting-conclusion-entry__file-tags {
  display: flex;
  flex: 1 1 320px;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.meeting-conclusion-entry__file-tags :deep(.el-tag) {
  max-width: min(360px, 100%);
}

.meeting-conclusion-entry__file-tags :deep(.el-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meeting-conclusion-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
}

.meeting-conclusion-option.el-radio {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
  height: auto;
  min-height: 92px;
  margin: 0;
  padding: 0;
  white-space: normal;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.meeting-conclusion-option :deep(.el-radio__input) {
  display: none;
}

.meeting-conclusion-option :deep(.el-radio__label) {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-width: 0;
  width: 100%;
  min-height: 92px;
  padding: 16px 18px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  background: #ffffff;
  border: 1px solid #e5eaf1;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(25, 55, 95, 0.03);
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.meeting-conclusion-option :deep(.el-radio__label)::before {
  position: absolute;
  top: -1px;
  right: 14px;
  left: 14px;
  height: 2px;
  content: "";
  background: var(--meeting-conclusion-accent, transparent);
  border-radius: 999px;
  opacity: 0;
  transition:
    opacity 0.18s ease,
    background 0.18s ease;
}

.meeting-conclusion-option__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--bq-color-text-muted, #78879b);
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  background: #f4f6f9;
  border: 1px solid #e4e9ef;
  border-radius: 50%;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.meeting-conclusion-option > :deep(.el-radio__label) > strong {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.meeting-conclusion-option__check {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  color: transparent;
  background: transparent;
  border: 1px solid #dce3eb;
  border-radius: 50%;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease;
}

.meeting-conclusion-option__check :deep(svg) {
  width: 11px;
  height: 11px;
}

.meeting-conclusion-option:hover {
  transform: translateY(-1px);
}

.meeting-conclusion-option:hover :deep(.el-radio__label),
.meeting-conclusion-option:focus-within :deep(.el-radio__label) {
  border-color: #bdc9d7;
  box-shadow:
    0 8px 18px rgba(31, 71, 133, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.96);
}

.meeting-conclusion-option.is-pass .meeting-conclusion-option__icon {
  color: #2e9b68;
  background: #eaf8f0;
  border-color: #c9ead7;
}

.meeting-conclusion-option.is-conditional .meeting-conclusion-option__icon {
  color: #b97809;
  background: #fff5df;
  border-color: #f1d294;
}

.meeting-conclusion-option.is-fail .meeting-conclusion-option__icon {
  color: #d65353;
  background: #fff0f0;
  border-color: #f3cece;
}

.meeting-conclusion-option.is-selected :deep(.el-radio__label) {
  background: var(--meeting-conclusion-selected-bg, #f3fbf6);
  border-color: var(--meeting-conclusion-selected-border, #8ed2ab);
  box-shadow:
    0 8px 18px rgba(44, 133, 88, 0.1),
    inset 0 0 0 1px var(--meeting-conclusion-selected-ring, #d4f0df);
}

.meeting-conclusion-option.is-selected :deep(.el-radio__label)::before {
  opacity: 1;
}

.meeting-conclusion-option.is-selected .meeting-conclusion-option__check {
  color: #ffffff;
  background: var(--meeting-conclusion-accent, #2e9b68);
  border-color: var(--meeting-conclusion-accent, #2e9b68);
}

.meeting-conclusion-option.is-selected .meeting-conclusion-option__icon {
  color: #ffffff;
  background: var(--meeting-conclusion-accent, #2e9b68);
  border-color: var(--meeting-conclusion-accent, #2e9b68);
  transform: scale(1.04);
}

.meeting-conclusion-option.is-selected > :deep(.el-radio__label) > strong {
  color: var(--meeting-conclusion-accent, #2e9b68);
}

.meeting-conclusion-option.is-selected.is-conditional {
  --meeting-conclusion-accent: #c88312;
  --meeting-conclusion-selected-bg: #fffaf0;
  --meeting-conclusion-selected-border: #e5ba62;
  --meeting-conclusion-selected-ring: #fae8c3;
}

.meeting-conclusion-option.is-selected.is-fail {
  --meeting-conclusion-accent: #d65353;
  --meeting-conclusion-selected-bg: #fff7f7;
  --meeting-conclusion-selected-border: #e6a3a3;
  --meeting-conclusion-selected-ring: #f7dddd;
}

.meeting-conclusion-entry__body :deep(.el-textarea__inner) {
  min-height: 144px;
  padding: 12px;
  font-size: 14px;
  line-height: 22px;
  border-color: var(--bq-color-border-subtle, #dcdfe6);
  box-shadow: none;
}

.meeting-conclusion-entry__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
}

.meeting-conclusion-card {
  overflow: hidden;
  background: var(--bq-color-surface, var(--el-bg-color));
  border: 1px solid var(--bq-color-border, var(--el-border-color));
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(31, 71, 133, 0.06);
}

.meeting-conclusion-card__body {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  min-width: 0;
}

.meeting-conclusion-card__summary {
  display: flex;
  grid-row: 1 / span 2;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 22px 24px;
  background: var(--bq-color-info-soft, #f3f6f9);
  border-right: 1px solid var(--bq-color-border-subtle, #edf0f2);
  box-shadow: inset 3px 0 0 var(--bq-color-info, #64748b);
}

.meeting-conclusion-card.is-success .meeting-conclusion-card__summary {
  background: color-mix(
    in srgb,
    var(--bq-color-success-soft, #eefaf0) 62%,
    white
  );
  box-shadow: inset 3px 0 0 var(--bq-color-success, var(--el-color-success));
}

.meeting-conclusion-card.is-warning .meeting-conclusion-card__summary {
  background: color-mix(
    in srgb,
    var(--bq-color-warning-soft, #fff7ec) 70%,
    white
  );
  box-shadow: inset 3px 0 0 var(--bq-color-warning, var(--el-color-warning));
}

.meeting-conclusion-card.is-danger .meeting-conclusion-card__summary {
  background: color-mix(
    in srgb,
    var(--bq-color-danger-soft, #fef0f0) 56%,
    white
  );
  box-shadow: inset 3px 0 0 var(--bq-color-danger, var(--el-color-danger));
}

.meeting-conclusion-card__label,
.meeting-conclusion-card__section-title {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.meeting-conclusion-card__label {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  font-weight: 500;
  letter-spacing: 0.08em;
  line-height: 18px;
}

.meeting-conclusion-card__decision-tag {
  flex: 0 0 auto;
}

.meeting-conclusion-card :deep(.meeting-conclusion-card__decision-tag.el-tag) {
  height: auto;
  padding: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
  background: transparent;
  border: 0;
}

.meeting-conclusion-card.is-success
  :deep(.meeting-conclusion-card__decision-tag.el-tag) {
  color: var(--bq-color-success, var(--el-color-success));
}

.meeting-conclusion-card.is-warning
  :deep(.meeting-conclusion-card__decision-tag.el-tag) {
  color: #d98b00;
}

.meeting-conclusion-card.is-danger
  :deep(.meeting-conclusion-card__decision-tag.el-tag) {
  color: var(--bq-color-danger, var(--el-color-danger));
}

.meeting-conclusion-card__resolution {
  display: grid;
  grid-column: 2;
  gap: 10px;
  min-height: 96px;
  padding: 20px 24px 18px;
}

.meeting-conclusion-card__resolution p {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 15px;
  line-height: 26px;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: pre-wrap;
}

.meeting-conclusion-card__actions {
  justify-content: flex-end;
}

.meeting-conclusion-card__attachments {
  display: grid;
  grid-column: 2;
  gap: 10px;
  min-width: 0;
  padding: 14px 24px 18px;
  border-top: 1px solid var(--bq-color-border-subtle, #edf0f2);
}

.meeting-conclusion-card__attachments-head,
.meeting-conclusion-card__attachments-title,
.meeting-conclusion-card__file-action {
  display: flex;
  align-items: center;
}

.meeting-conclusion-card__attachments-head {
  gap: 12px;
}

.meeting-conclusion-card__attachments-title {
  gap: 8px;
}

.meeting-conclusion-card__attachment-count,
.meeting-conclusion-card__file-meta {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
}

.meeting-conclusion-card__attachment-count {
  padding-left: 8px;
  border-left: 1px solid var(--bq-color-border, #dedfdf);
}

.meeting-conclusion-card__attachments .file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meeting-conclusion-card__file {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  flex: 1 1 360px;
  max-width: 600px;
  min-width: 0;
  padding: 10px 12px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: var(--bq-color-bg-soft, #fbfcfd);
  border: 1px solid var(--bq-color-border-subtle, #edf0f2);
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(31, 71, 133, 0.03);
  transition:
    box-shadow 0.16s ease,
    transform 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.meeting-conclusion-card__file:hover,
.meeting-conclusion-card__file:focus-visible {
  background: var(--bq-color-surface, #ffffff);
  border-color: var(--bq-color-primary, var(--el-color-primary));
  box-shadow: 0 5px 14px rgba(47, 111, 232, 0.1);
  transform: translateY(-1px);
  outline: none;
}

.meeting-conclusion-card__file-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  color: var(--bq-color-primary, var(--el-color-primary));
  font-size: 18px;
  background: var(--bq-color-primary-soft, #edf4ff);
  border-radius: 6px;
}

.meeting-conclusion-card__file-content {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.meeting-conclusion-card__file-name {
  overflow: hidden;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-compact, 14px);
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meeting-conclusion-card__file-action {
  gap: 4px;
  color: var(--bq-color-primary, var(--el-color-primary));
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
  opacity: 0.82;
}

.meeting-conclusion-card__attachments-empty {
  display: block;
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
}

@media (max-width: 680px) {
  .meeting-conclusion-card__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .meeting-conclusion-card__summary {
    align-items: center;
    justify-content: flex-start;
    flex-direction: row;
    grid-row: auto;
    padding: 14px 16px;
    border-right: 0;
    border-bottom: 1px solid var(--bq-color-border-subtle, #edf0f2);
  }

  .meeting-conclusion-card__resolution,
  .meeting-conclusion-card__attachments {
    grid-column: auto;
    padding-right: 16px;
    padding-left: 16px;
  }

  .meeting-conclusion-card__actions {
    justify-content: flex-start;
  }

  .meeting-conclusion-card__file {
    flex-basis: 100%;
    max-width: none;
  }

  .meeting-conclusion-options {
    grid-template-columns: 1fr;
  }

  .meeting-conclusion-entry__section-head,
  .meeting-conclusion-entry__actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
