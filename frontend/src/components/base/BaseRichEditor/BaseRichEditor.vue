<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  provide,
  ref,
  watch,
} from "vue";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { CustomTable } from "./extensions/custom-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

import { ElImageViewer } from "element-plus";
import { CustomImage } from "./extensions/custom-image";
import BaseRichEditorToolbar from "./BaseRichEditorToolbar.vue";
import TableBubbleMenu from "./components/TableBubbleMenu.vue";
import { countCommitteeReviewCharacters } from "@/pages/committee/committee-review-content";
import { BaseToast } from "@/components/base/BaseToast";

const editorBodyRef = ref<HTMLElement | null>(null);

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    editable?: boolean;
    placeholder?: string;
    maxCharacters?: number;
    currentVersionNo?: number | null;
    isFullscreen?: boolean;
    showFooter?: boolean;
    uploadImage?: (
      file: File,
    ) => Promise<{ url: string; attachmentId?: string | number }>;
  }>(),
  {
    modelValue: "",
    editable: true,
    placeholder: "请输入评审内容...",
    maxCharacters: 5000,
    currentVersionNo: null,
    isFullscreen: false,
    showFooter: false,
    uploadImage: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:isFullscreen": [value: boolean];
  change: [value: string];
  characterCountChange: [count: number];
}>();

const internalFullscreen = ref(false);
const isFullscreenState = computed(() =>
  props.isFullscreen !== undefined
    ? props.isFullscreen
    : internalFullscreen.value,
);

const fileInputRef = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
let previousBodyOverflow: string | null = null;
let active = true;

// 字符数统计（与业务契约保持一致，排除图片）
const characterCount = computed(() =>
  countCommitteeReviewCharacters(props.modelValue || ""),
);
const isOverLimit = computed(() => characterCount.value > props.maxCharacters);
const wordCountLabel = computed(
  () => `${characterCount.value} / ${props.maxCharacters} 字符`,
);

async function uploadFileAndInsert(file: File) {
  if (!props.uploadImage) {
    BaseToast.warning("当前未配置图片上传服务");
    return;
  }
  const imageType = file.type.toLowerCase();
  const imageExtension = file.name.split(".").pop()?.toLowerCase();
  if (
    !["image/png", "image/jpeg"].includes(imageType) &&
    !["png", "jpg", "jpeg"].includes(imageExtension ?? "")
  ) {
    BaseToast.warning("仅支持 PNG、JPG、JPEG 格式图片");
    return;
  }

  uploading.value = true;
  try {
    const result = await props.uploadImage(file);
    if (!result?.url) throw new Error("图片上传返回格式异常");
    if (!editor.value) return;

    editor.value
      .chain()
      .focus()
      .setImage({
        src: result.url,
        attachmentId: result.attachmentId ? String(result.attachmentId) : null,
      } as { src: string; attachmentId?: string | null })
      .run();
  } catch (error) {
    BaseToast.error(error instanceof Error ? error.message : "图片上传失败");
  } finally {
    uploading.value = false;
  }
}

function handleFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    void uploadFileAndInsert(file);
  }
  target.value = "";
}

function triggerUploadImage() {
  fileInputRef.value?.click();
}

const editor = useEditor({
  content: props.modelValue || "",
  editable: props.editable,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
    }),
    Underline,
    CustomImage.configure({
      allowBase64: true,
    }),
    CustomTable.configure({
      resizable: true,
      lastColumnResizable: false,
      cellMinWidth: 25,
      HTMLAttributes: {
        class: "bq-rich-table",
      },
    }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    TextStyle,
    Color,
    Link.configure({
      openOnClick: false,
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
  ],
  editorProps: {
    handlePaste(_view, event) {
      if (!props.uploadImage) return false;
      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          void uploadFileAndInsert(file);
          return true;
        }
      }
      return false;
    },
    handleDrop(_view, event) {
      if (!props.uploadImage) return false;
      const files = Array.from(event.dataTransfer?.files ?? []);
      const imageFile = files.find((file) => file.type.startsWith("image/"));
      if (imageFile) {
        void uploadFileAndInsert(imageFile);
        return true;
      }
      return false;
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    const html = currentEditor.getHTML();
    emit("update:modelValue", html);
    emit("change", html);
    emit("characterCountChange", countCommitteeReviewCharacters(html));
  },
});

watch(
  () => props.modelValue,
  (newValue) => {
    if (!editor.value) return;
    const isSame = editor.value.getHTML() === (newValue || "");
    if (!isSame) {
      editor.value.commands.setContent(newValue || "", { emitUpdate: false });
    }
  },
);

watch(
  () => props.editable,
  (newVal) => {
    editor.value?.setEditable(newVal);
  },
);

function toggleFullscreen() {
  const nextValue = !isFullscreenState.value;
  internalFullscreen.value = nextValue;
  emit("update:isFullscreen", nextValue);
  updateBodyOverflow(nextValue);
}

function updateBodyOverflow(fullscreen: boolean) {
  if (typeof document === "undefined") return;
  if (fullscreen) {
    if (previousBodyOverflow === null) {
      previousBodyOverflow = document.body.style.overflow;
    }
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = previousBodyOverflow ?? "";
    previousBodyOverflow = null;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && isFullscreenState.value) {
    toggleFullscreen();
  }
}

watch(isFullscreenState, (fullscreen) => {
  if (active) updateBodyOverflow(fullscreen);
});

const previewViewerVisible = ref(false);
const previewViewerUrls = ref<string[]>([]);
const previewViewerIndex = ref(0);

function openImageViewer(url: string) {
  if (!url) return;
  previewViewerUrls.value = [url];
  previewViewerIndex.value = 0;
  previewViewerVisible.value = true;
}

// 优先通过 provide 为内部节点提供图片灯箱唤起方法，避免全局广播污染
provide("bq-editor-preview-image", openImageViewer);

function handlePreviewImageEvent(event: Event) {
  const customEvent = event as { detail?: { url?: string } };
  if (customEvent.detail?.url) {
    openImageViewer(customEvent.detail.url);
  }
}

function setupEditorEvents() {
  teardownEditorEvents();
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("bq-editor-preview-image", handlePreviewImageEvent);
  if (isFullscreenState.value) {
    updateBodyOverflow(true);
  }
}

function teardownEditorEvents() {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("bq-editor-preview-image", handlePreviewImageEvent);
}

onMounted(setupEditorEvents);
onActivated(() => {
  active = true;
  setupEditorEvents();
});
onDeactivated(() => {
  active = false;
  teardownEditorEvents();
  previewViewerVisible.value = false;
  if (isFullscreenState.value) {
    internalFullscreen.value = false;
    emit("update:isFullscreen", false);
  }
  updateBodyOverflow(false);
});

onBeforeUnmount(() => {
  teardownEditorEvents();
  if (previousBodyOverflow !== null && typeof document !== "undefined") {
    document.body.style.overflow = previousBodyOverflow;
  }
  editor.value?.destroy();
});

// 暴露 API 供外部调用
function insertHtml(html: string) {
  if (!editor.value) return;
  editor.value.chain().focus().insertContent(html).run();
}

function focus() {
  editor.value?.commands.focus();
}

function handleBodyClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  // 如果在只读态下点击了图片，直接打开大图无损预览灯箱
  if (!props.editable && target.tagName === "IMG") {
    const src = (target as HTMLImageElement).src;
    if (src) {
      openImageViewer(src);
      return;
    }
  }

  if (!props.editable || !editor.value) return;

  // 如果点击的是悬浮气泡菜单、图片控制条、工具栏或下拉弹层，绝对不要重置焦点
  if (
    target.closest(".bq-table-bubble-menu") ||
    target.closest(".bq-image-resizer") ||
    target.closest(".bq-rich-editor__toolbar") ||
    target.closest(".el-popper") ||
    target.closest("button")
  ) {
    return;
  }

  // 只有点击的是 ProseMirror 外部真正的空白底层且未聚焦时，才激活编辑器，保持当前选区，绝不强制跳到 end
  if (!target.closest(".ProseMirror")) {
    if (!editor.value.isFocused) {
      editor.value.commands.focus();
    }
  }
}

defineExpose({
  editor,
  insertHtml,
  focus,
  toggleFullscreen,
});
</script>

<template>
  <div
    v-loading="uploading"
    class="bq-rich-editor"
    :class="{
      'is-readonly': !editable,
      'is-fullscreen': isFullscreenState,
    }"
    element-loading-text="正在上传并插入图片..."
  >
    <!-- 顶部操作与工具栏（仅在编辑态展示） -->
    <div v-if="editable" class="bq-rich-editor__header">
      <BaseRichEditorToolbar
        :editor="editor ?? null"
        :is-fullscreen="isFullscreenState"
        @toggle-fullscreen="toggleFullscreen"
        @trigger-upload-image="triggerUploadImage"
      />

      <div class="bq-rich-editor__actions-extra">
        <slot name="extra-actions" />
        <div v-if="isFullscreenState" class="bq-rich-editor__meta">
          <span v-if="currentVersionNo">V{{ currentVersionNo }}</span>
          <span :class="{ 'is-over-limit': isOverLimit }">
            {{ wordCountLabel }}
          </span>
        </div>
      </div>
    </div>

    <!-- 编辑器主体 -->
    <div
      ref="editorBodyRef"
      class="bq-rich-editor__body"
      @click="handleBodyClick"
    >
      <!-- 表格就地悬浮胶囊工具栏 -->
      <TableBubbleMenu
        v-if="editor && editable"
        :editor="editor"
        :container-el="editorBodyRef"
      />

      <EditorContent
        v-if="editable"
        :editor="editor"
        class="bq-rich-editor__content bq-rich-content"
      />
      <!-- 只读态直接展示渲染好的内容 -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        v-else
        class="bq-rich-editor__content bq-rich-content is-readonly"
        v-html="modelValue || '--'"
      />
    </div>

    <!-- 底部字数统计（仅在显式开启且非全屏的编辑态展示） -->
    <div
      v-if="showFooter && editable && !isFullscreenState"
      class="bq-rich-editor__footer"
    >
      <span
        class="bq-rich-editor__word-count"
        :class="{ 'is-over-limit': isOverLimit }"
        aria-live="polite"
      >
        {{ wordCountLabel }}
      </span>
    </div>

    <!-- 隐藏的文件选择器 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
      style="display: none"
      @change="handleFileInputChange"
    />

    <!-- 全屏无损大图预览灯箱 -->
    <ElImageViewer
      v-if="previewViewerVisible"
      :url-list="previewViewerUrls"
      :initial-index="previewViewerIndex"
      @close="previewViewerVisible = false"
    />
  </div>
</template>

<style lang="scss">
@use "./styles/editor.scss";
</style>
