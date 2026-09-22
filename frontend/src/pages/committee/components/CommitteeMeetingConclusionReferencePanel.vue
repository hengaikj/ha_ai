<script setup lang="ts">
import { ref } from "vue";
import { downloadCommitteeAttachment } from "@/api/committee";
import { BaseToast } from "@/components/base/BaseToast";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import type { CommitteeAttachment } from "@/types/committee";
import CommitteeDate from "./CommitteeDate.vue";
import CommitteeSection from "./CommitteeSection.vue";
import CommitteeAttachmentList from "./CommitteeAttachmentList.vue";
import CommitteeFilePreviewDialog from "./CommitteeFilePreviewDialog.vue";
import { committeeStatusLabel, committeeTagType } from "../committee-ui";
import type { SchemaOption } from "@/types/schema-components";

interface MeetingConclusionReferenceItem {
  id: string;
  sourceTitle: string;
  meetingName: string;
  meetingTime?: string | null;
  decision?: string | null;
  decisionText?: string | null;
  attachments?: CommitteeAttachment[];
}

const props = withDefaults(
  defineProps<{
    items: MeetingConclusionReferenceItem[];
    loading?: boolean;
    title?: string;
    conclusionStatusOptions?: SchemaOption[];
  }>(),
  {
    loading: false,
    title: "会议结论",
    conclusionStatusOptions: () => [],
  },
);

const previewVisible = ref(false);
const previewFile = ref<Blob | null>(null);
const previewTitle = ref("");
const downloadingAttachmentId = ref<string | number | null>(null);

function displayValue(value?: string | number | null) {
  return value === null || value === undefined || value === "" ? "--" : value;
}

function conclusionLabel(value?: string | null) {
  if (!value) return "--";
  return (
    props.conclusionStatusOptions.find(
      (option) => String(option.value) === String(value),
    )?.label ?? committeeStatusLabel(value)
  );
}

async function previewAttachment(file: CommitteeAttachment) {
  previewFile.value = null;
  previewTitle.value = file.fileName;
  previewVisible.value = true;
  try {
    const blob = file.fileUrl
      ? await globalThis.fetch(file.fileUrl).then(async (response) => {
          if (!response.ok) throw new Error("附件下载失败");
          return response.blob();
        })
      : (await downloadCommitteeAttachment(file.id)).data;
    previewFile.value = blob;
  } catch {
    previewVisible.value = false;
    BaseToast.error("附件预览失败");
  }
}

async function downloadAttachment(file: CommitteeAttachment) {
  downloadingAttachmentId.value = file.id;
  try {
    const blob = file.fileUrl
      ? await globalThis.fetch(file.fileUrl).then(async (response) => {
          if (!response.ok) throw new Error("附件下载失败");
          return response.blob();
        })
      : (await downloadCommitteeAttachment(file.id)).data;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.fileName || "附件";
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    BaseToast.error("附件下载失败");
  } finally {
    downloadingAttachmentId.value = null;
  }
}
</script>

<template>
  <CommitteeSection
    v-loading="loading"
    class="meeting-conclusion-reference"
    :title="title"
  >
    <div v-if="items.length" class="meeting-conclusion-reference__list">
      <article
        v-for="item in items"
        :key="item.id"
        class="meeting-conclusion-reference__item"
        :aria-label="`${item.sourceTitle}会议结论`"
      >
        <div class="meeting-conclusion-reference__head">
          <strong class="meeting-conclusion-reference__source">
            {{ item.sourceTitle }}
          </strong>
          <div class="meeting-conclusion-reference__meta">
            <span>{{ displayValue(item.meetingName) }}</span>
            <span aria-hidden="true">·</span>
            <CommitteeDate :value="item.meetingTime" />
          </div>
        </div>

        <div class="meeting-conclusion-reference__content">
          <div
            class="meeting-conclusion-reference__result"
            :class="`is-${committeeTagType(item.decision ?? undefined)}`"
          >
            <span class="meeting-conclusion-reference__label">会议结论</span>
            <BaseStatusTag
              :label="conclusionLabel(item.decision)"
              :type="committeeTagType(item.decision ?? undefined)"
            />
          </div>

          <section class="meeting-conclusion-reference__decision">
            <strong>决议事项</strong>
            <p>{{ displayValue(item.decisionText) }}</p>
          </section>
        </div>

        <div
          v-if="item.attachments?.length"
          class="meeting-conclusion-reference__attachments"
        >
          <span class="meeting-conclusion-reference__attachment-label">
            附件
          </span>
          <CommitteeAttachmentList
            :files="item.attachments"
            :downloading-attachment-id="downloadingAttachmentId"
            data-testid="meeting-conclusion-attachment-list"
            @preview="previewAttachment"
            @download="downloadAttachment"
          />
        </div>
      </article>
    </div>
    <el-empty v-else description="暂无会议结论" />
    <CommitteeFilePreviewDialog
      v-model="previewVisible"
      :file="previewFile"
      :file-name="previewTitle"
    />
  </CommitteeSection>
</template>

<style scoped>
.meeting-conclusion-reference {
  gap: 14px;
}

.meeting-conclusion-reference__list {
  overflow: hidden;
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color));
  border-radius: var(--bq-radius-card, 6px);
  background: var(--bq-color-surface, var(--el-bg-color));
}

.meeting-conclusion-reference__item {
  display: grid;
  gap: 14px;
  padding: 18px 20px;
}

.meeting-conclusion-reference__item + .meeting-conclusion-reference__item {
  border-top: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-light));
}

.meeting-conclusion-reference__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  min-width: 0;
}

.meeting-conclusion-reference__source {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 15px;
  font-weight: 600;
  line-height: 24px;
}

.meeting-conclusion-reference__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  line-height: 20px;
}

.meeting-conclusion-reference__content {
  display: grid;
  grid-template-columns: minmax(160px, 188px) minmax(0, 1fr);
  gap: 18px;
  min-width: 0;
}

.meeting-conclusion-reference__result {
  display: flex;
  min-height: 86px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
  background: var(--bq-color-info-soft, var(--bq-color-bg-soft));
}

.meeting-conclusion-reference__result.is-success {
  background: var(--bq-color-success-soft);
  border-color: color-mix(in srgb, var(--bq-color-success), white 68%);
}

.meeting-conclusion-reference__result.is-warning {
  background: var(--bq-color-warning-soft);
  border-color: color-mix(in srgb, var(--bq-color-warning), white 62%);
}

.meeting-conclusion-reference__result.is-danger {
  background: var(--bq-color-danger-soft);
  border-color: color-mix(in srgb, var(--bq-color-danger), white 72%);
}

.meeting-conclusion-reference__label {
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  font-weight: 600;
  line-height: 18px;
}

.meeting-conclusion-reference__result :deep(.el-tag) {
  height: 30px;
  padding: 0 12px;
  border-radius: var(--bq-radius-control, 4px);
  font-size: 15px;
  font-weight: 600;
}

.meeting-conclusion-reference__decision {
  display: grid;
  align-content: center;
  gap: 8px;
  min-width: 0;
  min-height: 86px;
  padding: 14px 18px;
  border-left: 3px solid var(--bq-color-primary);
  border-radius: 0 var(--bq-radius-control, 4px) var(--bq-radius-control, 4px) 0;
  background: var(--bq-color-bg-soft, var(--el-fill-color-extra-light));
}

.meeting-conclusion-reference__decision strong {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 13px;
  line-height: 20px;
}

.meeting-conclusion-reference__decision p {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 15px;
  line-height: 26px;
  white-space: pre-wrap;
  word-break: break-word;
}

.meeting-conclusion-reference__attachments {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-light));
}

.meeting-conclusion-reference__attachment-label {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: var(--bq-font-helper, 12px);
  line-height: 20px;
}

@media (max-width: 760px) {
  .meeting-conclusion-reference__item {
    padding: 16px;
  }

  .meeting-conclusion-reference__content {
    grid-template-columns: minmax(0, 1fr);
  }

  .meeting-conclusion-reference__result,
  .meeting-conclusion-reference__decision {
    min-height: 0;
  }
}
</style>
