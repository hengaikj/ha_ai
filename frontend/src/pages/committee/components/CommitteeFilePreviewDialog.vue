<script setup lang="ts">
import { computed, nextTick, onDeactivated, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    file?: Blob | null;
    fileName?: string;
    title?: string;
  }>(),
  {
    file: null,
    fileName: "",
    title: "",
  },
);

const visible = defineModel<boolean>({ default: false });
const frame = ref<HTMLIFrameElement | null>(null);
const frameReady = ref(false);
const loading = computed(() => !props.file || !frameReady.value);

function previewInFrame() {
  const frameWindow = frame.value?.contentWindow as
    | (Window & { doPreview?: (file: Blob, name: string) => void })
    | null;
  if (
    !props.file ||
    !props.fileName ||
    !frameReady.value ||
    !frameWindow?.doPreview
  ) {
    return;
  }
  frameWindow.doPreview(props.file, props.fileName);
}

function handleFrameLoad() {
  frameReady.value = true;
  previewInFrame();
}

function clearPreview() {
  frameReady.value = false;
}

function close() {
  visible.value = false;
  clearPreview();
}

onDeactivated(close);

watch(
  () => [visible.value, props.file, props.fileName] as const,
  async () => {
    if (!visible.value) {
      clearPreview();
      return;
    }
    await nextTick();
    previewInFrame();
  },
);
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="props.title || props.fileName || '附件预览'"
    fullscreen
    append-to-body
    destroy-on-close
    :z-index="10050"
    @closed="close"
  >
    <div class="committee-file-preview-dialog__content">
      <div v-if="loading" class="committee-file-preview-dialog__loading">
        <span class="committee-file-preview-dialog__spinner" aria-hidden="true" />
        <span>文件加载中...</span>
      </div>
      <iframe
        ref="frame"
        src="/html/file-preview.html"
        frameborder="0"
        title="附件预览"
        @load="handleFrameLoad"
      />
    </div>
  </el-dialog>
</template>

<style scoped>
.committee-file-preview-dialog__content {
  position: relative;
  width: 100%;
  height: calc(100vh - 70px);
  overflow: hidden;
}

.committee-file-preview-dialog__loading {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--bq-color-text-secondary, #606266);
  background: var(--bq-color-surface, #fff);
}

.committee-file-preview-dialog__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--el-border-color-lighter, #ebeef5);
  border-top-color: var(--el-color-primary, #409eff);
  border-radius: 50%;
  animation: committee-file-preview-spin 0.8s linear infinite;
}

@keyframes committee-file-preview-spin {
  to {
    transform: rotate(360deg);
  }
}

.committee-file-preview-dialog__content iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

:global(.el-dialog.is-fullscreen .el-dialog__body) {
  padding: 0;
}
</style>
