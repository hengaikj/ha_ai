<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Document, QuestionFilled, View } from "@element-plus/icons-vue";
import type { UploadRequestOptions } from "element-plus";
import {
  deleteCommitteeAttachment,
  downloadCommitteeAttachment,
  fetchCommitteeAttachments,
  uploadCommitteeAttachment,
} from "@/api/committee";
import { BaseToast } from "@/components/base/BaseToast";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type { CommitteeAttachment } from "@/types/committee";
import CommitteeFilePreviewDialog from "./CommitteeFilePreviewDialog.vue";
import { isSupportedCommitteeAttachment } from "../committee-attachment-utils";

type DisplayAttachment = Omit<CommitteeAttachment, "fileUrl"> & {
  fileUrl?: string | null;
};

const props = withDefaults(
  defineProps<{
    bizCode: string;
    bizId?: string;
    editable?: boolean;
    allowDelete?: boolean;
    compact?: boolean;
    sectionHeading?: boolean;
    titleSize?: "default" | "small";
    title?: string;
    description?: string;
    emptyHint?: string;
    emptyText?: string;
    showEmpty?: boolean;
    accept?: string;
    initialFiles?: DisplayAttachment[];
  }>(),
  {
    bizId: undefined,
    editable: false,
    allowDelete: false,
    compact: false,
    sectionHeading: false,
    titleSize: undefined,
    title: "附件",
    description: "支持 PDF、Office 文档和图片，单个文件不超过 20MB。",
    emptyHint: "",
    emptyText: "",
    showEmpty: true,
    accept: ".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc,.pptx",
    initialFiles: () => [],
  },
);
const loading = ref(false);
const files = ref<DisplayAttachment[]>([]);
const deleteVisible = ref(false);
const deleting = ref(false);
const pendingDelete = ref<DisplayAttachment>();
const previewVisible = ref(false);
const previewFile = ref<Blob | null>(null);
const previewTitle = ref("");
const showEmptyHint = computed(
  () =>
    !loading.value &&
    !props.editable &&
    files.value.length === 0 &&
    Boolean(props.emptyHint),
);
let previewRequestId = 0;
let unmounted = false;

async function load() {
  if (!props.bizId) {
    files.value = props.initialFiles;
    return;
  }
  loading.value = true;
  try {
    const remoteFiles = await fetchCommitteeAttachments(
      props.bizCode,
      props.bizId,
    );
    const remoteIds = new Set(remoteFiles.map((file) => String(file.id)));
    files.value = [
      ...props.initialFiles.filter((file) => !remoteIds.has(String(file.id))),
      ...remoteFiles,
    ];
  } finally {
    loading.value = false;
  }
}

function openDelete(row: DisplayAttachment) {
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
    await load();
  } finally {
    deleting.value = false;
  }
}

async function upload(options: UploadRequestOptions) {
  if (!props.bizId) return;
  if (!isSupportedCommitteeAttachment(options.file)) {
    options.onError({
      name: "UploadAjaxError",
      status: 400,
      method: "POST",
      url: "",
      message: "不支持该附件格式，仅支持 PPTX，不支持 PPT",
    });
    BaseToast.error("不支持该附件格式，仅支持 PPTX，不支持 PPT");
    return;
  }
  try {
    await uploadCommitteeAttachment(props.bizCode, props.bizId, options.file);
    options.onSuccess({});
    BaseToast.success("附件上传成功");
    await load();
  } catch {
    BaseToast.error("附件上传失败");
  }
}

async function previewAttachment(row: DisplayAttachment) {
  const requestId = ++previewRequestId;
  previewFile.value = null;
  previewTitle.value = row.fileName;
  previewVisible.value = true;
  try {
    if (row.fileUrl) {
      if (unmounted || requestId !== previewRequestId) return;
      const response = await globalThis.fetch(row.fileUrl);
      if (!response.ok) throw new Error("附件下载失败");
      previewFile.value = await response.blob();
      return;
    }
    const response = await downloadCommitteeAttachment(row.id);
    if (unmounted || requestId !== previewRequestId) return;
    previewFile.value = response.data;
  } catch {
    if (!unmounted && requestId === previewRequestId) {
      previewVisible.value = false;
      BaseToast.error("附件预览失败");
    }
  }
}

function size(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function fileType(row: DisplayAttachment) {
  const extension = row.fileName.match(/\.([^.]+)$/)?.[1];
  if (extension) return extension.toUpperCase();

  const mimeSubtype = row.fileType.split("/").pop();
  return mimeSubtype?.toUpperCase() || "文件";
}

function fileMeta(row: DisplayAttachment) {
  return row.fileSize > 0
    ? `${fileType(row)} · ${size(row.fileSize)}`
    : fileType(row);
}

onMounted(load);
watch(() => [props.bizId, props.initialFiles], load, { deep: true });
onBeforeUnmount(() => {
  unmounted = true;
  previewRequestId += 1;
  previewFile.value = null;
});
</script>
<template>
  <section
    v-loading="loading"
    class="attachment-panel"
    :class="{
      'attachment-panel--compact': compact,
      'attachment-panel--section-heading': sectionHeading,
    }"
  >
    <BaseSectionTitle
      :title="props.title"
      :description="props.compact ? '' : props.description"
      heading-tag="h3"
    >
      <template v-if="props.compact && props.sectionHeading" #title-extra>
        <el-tooltip
          v-if="props.description"
          :content="props.description"
          placement="top"
        >
          <el-icon class="attachment-panel__help-icon"
            ><QuestionFilled
          /></el-icon>
        </el-tooltip>
        <span v-if="files.length" class="attachment-panel__count">
          共 {{ files.length }} 个
        </span>
      </template>
      <template #actions>
        <div class="attachment-panel__actions">
          <slot name="actions-extra" />
          <PermissionGuard v-if="props.editable && props.bizId">
            <el-upload
              :show-file-list="false"
              :http-request="upload"
              :accept="accept"
            >
              <PermissionButton
                :plain="compact"
                :size="compact ? 'small' : undefined"
                class="attachment-panel__upload-button"
              >
                上传附件
              </PermissionButton>
            </el-upload>
          </PermissionGuard>
          <span v-else-if="showEmptyHint" class="attachment-panel__empty-hint">
            {{ emptyHint }}
          </span>
        </div>
      </template>
    </BaseSectionTitle>
    <div v-if="files.length" class="file-list">
      <template v-for="row in files" :key="row.id">
        <div
          v-if="compact"
          class="attachment-file"
          :title="row.fileName"
          :aria-label="`预览附件：${row.fileName}`"
          role="button"
          tabindex="0"
          @click="previewAttachment(row)"
          @keydown.enter.prevent="previewAttachment(row)"
          @keydown.space.prevent="previewAttachment(row)"
        >
          <span class="attachment-file__icon">
            <el-icon aria-hidden="true"><Document /></el-icon>
          </span>
          <span class="attachment-file__content">
            <span class="attachment-file__name">{{ row.fileName }}</span>
            <span class="attachment-file__meta">{{ fileMeta(row) }}</span>
          </span>
          <span class="attachment-file__preview" aria-hidden="true">
            <el-icon><View /></el-icon>
            预览
          </span>
          <PermissionButton
            v-if="allowDelete && editable"
            class="attachment-file__delete"
            link
            :aria-label="`删除附件：${row.fileName}`"
            title="删除附件"
            @click.stop="openDelete(row)"
          >
            删除
          </PermissionButton>
        </div>
        <div v-else class="file-row">
          <div>
            <span class="committee-text-strong">{{ row.fileName }}</span
            ><span class="file-meta"
              >{{ size(row.fileSize) }} · {{ row.fileType }}</span
            >
          </div>
          <div style="display: flex">
            <PermissionGuard>
              <PermissionButton link @click="previewAttachment(row)">
                预览
              </PermissionButton>
            </PermissionGuard>
            <PermissionGuard v-if="allowDelete && editable">
              <PermissionButton link @click="openDelete(row)">
                删除
              </PermissionButton>
            </PermissionGuard>
          </div>
        </div>
      </template>
    </div>
    <el-empty
      v-else-if="showEmpty && !showEmptyHint && !emptyText"
      description="暂无附件"
      :image-size="60"
    />
    <span v-else-if="emptyText" class="attachment-panel__empty-text">
      {{ emptyText }}
    </span>
    <CommitteeFilePreviewDialog
      v-model="previewVisible"
      :file="previewFile"
      :file-name="previewTitle"
    />
    <BaseConfirm
      v-model="deleteVisible"
      title="删除附件"
      :message="`确认删除附件“${pendingDelete?.fileName ?? ''}”吗？删除后列表不再展示该文件。`"
      type="danger"
      confirm-text="删除"
      :loading="deleting"
      @confirm="confirmDelete"
    />
  </section>
</template>
<style scoped>
.attachment-panel {
  padding: 14px;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-surface);
}

.attachment-panel header,
.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.attachment-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

h3,
p {
  margin: 0;
}

h3 {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

header p,
.file-row span {
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper, 12px);
}

.attachment-panel__empty-hint {
  flex-shrink: 0;
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
  white-space: nowrap;
}

.attachment-panel__empty-text {
  display: block;
  padding: 22px 0;
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
  text-align: center;
}

.file-list {
  display: grid;
  margin-top: 12px;
}

.file-row {
  padding: 10px 0;
  border-top: 1px solid var(--bq-color-border-subtle);
}

.file-row > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.file-row .committee-text-strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--bq-font-compact, 14px);
}

.attachment-panel--compact {
  padding: 0;
  overflow: hidden;
}

.attachment-panel--compact header {
  min-height: 52px;
  padding: 10px 16px;
  background: var(
    --material-section-head-bg,
    color-mix(in srgb, var(--bq-color-primary-soft), white 58%)
  );
  border-bottom: 1px solid
    var(--material-section-head-divider, var(--bq-color-border-subtle));
  box-shadow: inset 3px 0 0
    var(
      --material-section-head-accent,
      color-mix(in srgb, var(--bq-color-primary), white 42%)
    );
}

.attachment-panel--compact.attachment-panel--section-heading header {
  box-shadow: none;
}

.attachment-panel--compact.attachment-panel--section-heading header::before {
  content: "";
}

.attachment-panel--compact.attachment-panel--section-heading
  .attachment-panel__title-row
  h3 {
  font-weight: 700;
}

.attachment-panel__help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--bq-color-text-muted);
  background: var(--bq-color-bg-soft);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 50%;
  font-size: 13px;
  cursor: help;
}

.attachment-panel__count {
  padding-left: 10px;
  border-left: 1px solid var(--bq-color-border);
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-helper, 12px);
  font-weight: 400;
  line-height: 18px;
}

.attachment-panel--compact .file-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: 8px;
  margin: 0;
  padding: 12px 16px 16px;
}

.attachment-panel--compact :deep(.el-empty) {
  padding: 20px 16px;
}

.attachment-panel--compact .attachment-panel__upload-button {
  color: var(--bq-color-primary-active);
  background: var(--bq-color-surface);
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary),
    var(--bq-color-border) 74%
  );
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.035);
}

.attachment-panel--compact .attachment-panel__upload-button:hover,
.attachment-panel--compact .attachment-panel__upload-button:focus-visible {
  color: var(--bq-color-primary-active);
  background: color-mix(in srgb, var(--bq-color-primary-soft), white 34%);
  border-color: var(--bq-color-primary);
  box-shadow: none;
}

.attachment-panel--compact .attachment-file {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  min-width: 0;
  padding: 9px 10px;
  background: var(--bq-color-bg-soft);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-control);
  box-shadow: 0 1px 2px rgba(31, 71, 133, 0.03);
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.attachment-panel--compact .attachment-file:hover,
.attachment-panel--compact .attachment-file:focus-visible {
  background: var(--bq-color-surface);
  border-color: var(--bq-color-primary);
  box-shadow: 0 4px 12px rgba(47, 111, 232, 0.09);
  outline: none;
}

.attachment-file__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  color: var(--bq-color-primary);
  font-size: 18px;
  background: var(--bq-color-primary-soft);
  border-radius: var(--bq-radius-control);
}

.attachment-file__content {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.attachment-file__name {
  overflow: hidden;
  color: var(--bq-color-text);
  font-size: var(--bq-font-compact, 14px);
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-file__meta {
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
}

.attachment-file__preview {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--bq-color-primary);
  font-size: var(--bq-font-helper, 12px);
  line-height: 18px;
  white-space: nowrap;
  opacity: 0.82;
}

.attachment-panel--compact :deep(.attachment-file__delete.el-button.is-link) {
  min-height: 24px;
  margin-left: -2px;
  padding: 2px 4px;
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-helper, 12px);
}

.attachment-panel--compact
  :deep(.attachment-file__delete.el-button.is-link:hover) {
  color: var(--bq-color-danger);
}

@media (max-width: 720px) {
  .attachment-panel--compact .file-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .attachment-panel--compact .attachment-file {
    grid-template-columns: 36px minmax(0, 1fr) auto;
  }

  .attachment-file__preview {
    display: none;
  }
}

.attachment-preview {
  display: flex;
  justify-content: center;
  max-height: 70vh;
  overflow: auto;
}

.attachment-preview img {
  max-width: 100%;
  height: auto;
  object-fit: contain;
}
</style>
