<script setup lang="ts">
import {ArrowDown, Download} from "@element-plus/icons-vue";
import {ref} from "vue";
import {downloadTaskCenterFile} from "@/api/task-center";
import {BaseToast} from "@/components/base/BaseToast";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  TaskCenterFileResponse,
  TaskCenterStatus,
} from "@/types/task-center";

const props = defineProps<{
  taskId: string;
  files: TaskCenterFileResponse[];
  status?: TaskCenterStatus;
}>();

const downloadingFileId = ref<string>();

async function download(file: TaskCenterFileResponse) {
  downloadingFileId.value = file.fileId;
  try {
    const result = await downloadTaskCenterFile(props.taskId, file.fileId);
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    BaseToast.success("任务文件下载已开始");
  } finally {
    downloadingFileId.value = undefined;
  }
}

function handleCommand(fileId: string) {
  const file = props.files.find((item) => item.fileId === fileId);
  if (file) {
    void download(file);
  }
}
</script>

<template>
  <PermissionButton
      v-if="status !== 'FAILED' && files.length === 1"
      link
      type="primary"
      :loading="downloadingFileId === files[0]?.fileId"
      @click.stop="download(files[0]!)"
  >
    下载
  </PermissionButton>
  <el-dropdown
      v-else-if="status !== 'FAILED' && files.length > 1"
      trigger="click"
      @command="handleCommand"
      @click.stop
  >
    <PermissionButton
        link
        type="primary"
    >
      下载
      <el-icon class="task-download-action__arrow">
        <ArrowDown/>
      </el-icon>
    </PermissionButton>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
            v-for="file in files"
            :key="file.fileId"
            :command="file.fileId"
            :disabled="downloadingFileId === file.fileId"
        >
          <el-icon>
            <Download/>
          </el-icon>
          <span class="task-download-action__file-name">{{
              file.fileName
            }}</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.task-download-action__arrow {
  margin-left: 3px;
  font-size: 12px;
}

.task-download-action__file-name {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
