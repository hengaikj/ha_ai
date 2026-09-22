<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    fullscreen
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @closed="handleClose"
  >
    <div v-loading="loading" class="file-preview-container">
      <iframe
        ref="frame"
        src="/html/file-preview.html"
        class="preview-iframe"
        frameborder="0"
        title="文件预览"
        @load="handleFrameLoad"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { nextTick, onDeactivated, ref } from "vue";

const emit = defineEmits<{
  (e: "close-preview"): void;
}>();

const visible = ref(false);
const loading = ref(false);
const frame = ref<HTMLIFrameElement | null>(null);
const frameReady = ref(false);
const pendingFile = ref<Blob | null>(null);
const pendingFileName = ref("");
const dialogTitle = ref("文件预览");

function previewInFrame() {
  const frameWindow = frame.value?.contentWindow as
    | (Window & { doPreview?: (file: Blob, name: string) => void })
    | null;
  if (
    !pendingFile.value ||
    !pendingFileName.value ||
    !frameReady.value ||
    !frameWindow?.doPreview
  ) {
    return;
  }
  loading.value = true;
  try {
    // 走 jit-viewer 预览页，避免浏览器对 office/pdf 直接下载
    frameWindow.doPreview(pendingFile.value, pendingFileName.value);
  } finally {
    nextTick(() => {
      loading.value = false;
    });
  }
}

function handleFrameLoad() {
  frameReady.value = true;
  previewInFrame();
}

function clearPreview() {
  frameReady.value = false;
  pendingFile.value = null;
  pendingFileName.value = "";
  dialogTitle.value = "文件预览";
}

function handleClose() {
  clearPreview();
  emit("close-preview");
}

onDeactivated(() => {
  visible.value = false;
  clearPreview();
});

/**
 * 兼容历史调用：传入预览接口返回的 Blob 与文件名
 */
function setFileToIframe(data: Blob, fileName: string): void {
  pendingFile.value = data;
  pendingFileName.value = fileName || "附件预览";
  dialogTitle.value = fileName || "文件预览";
  visible.value = true;
  nextTick(() => {
    previewInFrame();
  });
}

defineExpose({
  setFileToIframe,
});
</script>

<style scoped lang="scss">
.file-preview-container {
  width: 100%;
  height: calc(100vh - 70px);
  overflow: hidden;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
</style>

<style>
.el-dialog.is-fullscreen .el-dialog__body {
  padding: 0;
}
</style>
