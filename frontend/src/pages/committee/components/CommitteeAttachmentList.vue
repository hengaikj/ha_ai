<script setup lang="ts">
import {
  DataAnalysis,
  Delete,
  Document,
  Download,
  Files,
  Memo,
  Picture,
  Tickets,
} from "@element-plus/icons-vue";
import type { CommitteeAttachment } from "@/types/committee";

type AttachmentType =
  | "image"
  | "pdf"
  | "word"
  | "powerpoint"
  | "spreadsheet"
  | "file";

const props = withDefaults(
  defineProps<{
    files: CommitteeAttachment[];
    editable?: boolean;
    deletable?: boolean;
    showDownload?: boolean;
    previewable?: boolean;
    downloadingAttachmentId?: string | number | null;
  }>(),
  {
    editable: false,
    deletable: true,
    showDownload: true,
    previewable: true,
    downloadingAttachmentId: null,
  },
);

const emit = defineEmits<{
  preview: [file: CommitteeAttachment];
  download: [file: CommitteeAttachment];
  delete: [file: CommitteeAttachment];
}>();

function attachmentType(row: CommitteeAttachment): AttachmentType {
  const extension = row.fileName.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
    return "image";
  }
  if (extension === "pdf") return "pdf";
  if (["doc", "docx"].includes(extension)) return "word";
  if (["ppt", "pptx"].includes(extension)) return "powerpoint";
  if (["xls", "xlsx", "csv"].includes(extension)) return "spreadsheet";
  return "file";
}

function attachmentIcon(row: CommitteeAttachment) {
  return {
    image: Picture,
    pdf: Tickets,
    word: Memo,
    powerpoint: DataAnalysis,
    spreadsheet: Files,
    file: Document,
  }[attachmentType(row)];
}

function displayAttachmentName(fileName: string) {
  const characters = Array.from(fileName);
  if (characters.length <= 15) return fileName;

  const extensionStart = fileName.lastIndexOf(".");
  const extension = extensionStart > 0 ? fileName.slice(extensionStart) : "";
  const extensionCharacters = Array.from(extension);
  const baseCharacters =
    extensionStart > 0 ? Array.from(fileName.slice(0, extensionStart)) : characters;
  const baseBudget = 15 - extensionCharacters.length - 1;
  if (baseBudget >= 2) {
    const frontLength = Math.ceil(baseBudget / 2);
    const backLength = Math.floor(baseBudget / 2);
    return `${baseCharacters.slice(0, frontLength).join("")}…${baseCharacters
      .slice(-backLength)
      .join("")}${extension}`;
  }

  return `${characters.slice(0, 7).join("")}…${characters.slice(-7).join("")}`;
}
</script>

<template>
  <div v-if="props.files.length" class="committee-attachment-list">
    <div
      v-for="file in props.files"
      :key="file.id"
      class="committee-attachment-list__chip"
      :data-file-type="attachmentType(file)"
    >
      <button
        v-if="props.previewable"
        type="button"
        class="committee-attachment-list__main"
        :title="file.fileName"
        :aria-label="`预览附件：${file.fileName}`"
        @click="emit('preview', file)"
      >
        <span class="committee-attachment-list__icon" aria-hidden="true">
          <el-icon><component :is="attachmentIcon(file)" /></el-icon>
        </span>
        <span class="committee-attachment-list__name review-edit-panel__attachment-name">
          {{ displayAttachmentName(file.fileName) }}
        </span>
      </button>
      <span v-else class="committee-attachment-list__main">
        <span class="committee-attachment-list__icon" aria-hidden="true">
          <el-icon><component :is="attachmentIcon(file)" /></el-icon>
        </span>
        <span class="committee-attachment-list__name review-edit-panel__attachment-name">
          {{ displayAttachmentName(file.fileName) }}
        </span>
      </span>
      <div class="committee-attachment-list__actions">
        <button
          v-if="props.showDownload"
          type="button"
          class="committee-attachment-list__action"
          :aria-label="`下载附件：${file.fileName}`"
          title="下载附件"
          :disabled="props.downloadingAttachmentId === file.id"
          @click.stop="emit('download', file)"
        >
          <el-icon aria-hidden="true"><Download /></el-icon>
        </button>
        <button
          v-if="props.editable && props.deletable"
          type="button"
          class="committee-attachment-list__action is-danger"
          :aria-label="`删除附件：${file.fileName}`"
          title="删除附件"
          @click.stop="emit('delete', file)"
        >
          <el-icon aria-hidden="true"><Delete /></el-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.committee-attachment-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.committee-attachment-list__chip {
  display: inline-flex;
  align-items: center;
  max-width: min(360px, 100%);
  min-height: 42px;
  overflow: hidden;
  background: var(--bq-color-bg-soft, #fbfcfd);
  border: 1px solid var(--bq-color-border-subtle, #edf0f2);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(48, 84, 135, 0.04);
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    background-color 0.16s ease;
}

.committee-attachment-list__chip:hover {
  background: var(--bq-color-surface, #fff);
  border-color: color-mix(
    in srgb,
    var(--bq-color-primary, var(--el-color-primary)) 32%,
    var(--bq-color-border-subtle, #edf0f2)
  );
  box-shadow: 0 5px 14px rgba(48, 84, 135, 0.08);
}

.committee-attachment-list__main {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  min-height: 42px;
  padding: 0 8px 0 11px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.committee-attachment-list__main:focus-visible,
.committee-attachment-list__action:focus-visible {
  outline: 2px solid var(--bq-color-primary, var(--el-color-primary));
  outline-offset: -2px;
}

.committee-attachment-list__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 26px;
  width: 26px;
  height: 26px;
  color: var(--bq-color-primary, var(--el-color-primary));
  background: var(--bq-color-primary-soft, #edf4ff);
  border-radius: 6px;
}

.committee-attachment-list__icon :deep(.el-icon) {
  font-size: 16px;
}

.committee-attachment-list__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--bq-font-body, 13px);
  line-height: 20px;
}

.committee-attachment-list__actions {
  display: inline-flex;
  align-items: center;
  align-self: stretch;
  gap: 2px;
  padding: 0 6px 0 2px;
  border-left: 1px solid var(--bq-color-border-subtle, #edf0f2);
}

.committee-attachment-list__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}

.committee-attachment-list__action:hover:not(:disabled) {
  color: var(--bq-color-primary, var(--el-color-primary));
  background: var(--bq-color-primary-soft, #edf4ff);
}

.committee-attachment-list__action.is-danger:hover:not(:disabled) {
  color: var(--bq-color-danger, var(--el-color-danger));
  background: var(--bq-color-danger-soft, #fef0f0);
}

.committee-attachment-list__action:disabled {
  cursor: wait;
  opacity: 0.55;
}

.committee-attachment-list__action :deep(.el-icon) {
  font-size: 15px;
}
</style>
