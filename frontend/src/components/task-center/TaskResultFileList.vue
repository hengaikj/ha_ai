<script setup lang="ts">
import { Download } from "@element-plus/icons-vue";
import { computed, ref } from "vue";
import { downloadTaskCenterFile } from "@/api/task-center";
import { BaseToast } from "@/components/base/BaseToast";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  TaskCenterFileResponse,
  TaskCenterStatus,
} from "@/types/task-center";

const props = defineProps<{
  taskId: string;
  files: TaskCenterFileResponse[];
  downloadFileName?: string;
  status?: TaskCenterStatus | string;
}>();

const downloadingFileId = ref<string>();
const canDownload = computed(
  () => String(props.status ?? "").toUpperCase() !== "FAILED",
);

function fileSizeLabel(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function resolveFileName(file: TaskCenterFileResponse) {
  return props.downloadFileName || file.fileName;
}

async function download(file: TaskCenterFileResponse) {
  downloadingFileId.value = file.fileId;
  try {
    const result = await downloadTaskCenterFile(props.taskId, file.fileId);
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = props.downloadFileName || result.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    BaseToast.success("任务文件下载已开始");
  } finally {
    downloadingFileId.value = undefined;
  }
}
</script>

<template>
  <div v-if="files.length" class="task-files">
    <div v-for="file in files" :key="file.fileId" class="task-file-row">
      <div class="task-file-main">
        <span class="task-file-name">{{ resolveFileName(file) }}</span>
        <span class="task-file-meta">{{ fileSizeLabel(file.fileSize) }}</span>
      </div>
      <PermissionButton
        v-if="canDownload"
        permission="system:task-center:download"
        link
        type="primary"
        :icon="Download"
        :loading="downloadingFileId === file.fileId"
        @click="download(file)"
      >
        下载
      </PermissionButton>
    </div>
  </div>
</template>

<style scoped>
.task-files {
  display: grid;
  gap: 6px;
}

.task-file-row {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.task-file-main {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 10px;
}

.task-file-name {
  overflow: hidden;
  color: var(--bq-color-text, #333333);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-file-meta {
  flex: none;
  color: var(--bq-color-text-muted, #8c8c8c);
  font-size: 12px;
}
</style>
