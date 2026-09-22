<script setup lang="ts">
import { onDeactivated } from "vue";
import { computed, ref } from "vue";
import { ElImageViewer } from "element-plus";

const props = withDefaults(
  defineProps<{
    content?: string | null;
    fallback?: string;
    previewImages?: boolean;
  }>(),
  {
    content: "",
    fallback: "--",
    previewImages: true,
  },
);

const emit = defineEmits<{
  clickImage: [url: string, index: number, urls: string[]];
}>();

const contentContainerRef = ref<HTMLElement | null>(null);
const imageViewerVisible = ref(false);
const imageViewerUrls = ref<string[]>([]);
const imageViewerIndex = ref(0);

const trimmedContent = computed(() => String(props.content ?? "").trim());

const hasContent = computed(() => {
  const text = trimmedContent.value;
  if (!text) return false;
  const stripped = text.replace(/<[^>]+>/g, "").trim();
  const hasImageOrMedia = /<(img|video|audio|iframe|table)\b/i.test(text);
  return Boolean(stripped || hasImageOrMedia);
});

function handleContentClick(event: MouseEvent) {
  if (!props.previewImages) return;

  const target = event.target as HTMLElement | null;
  if (!target) return;

  const clickedImg =
    target.tagName === "IMG"
      ? (target as HTMLImageElement)
      : (target.closest("img") as HTMLImageElement | null);
  if (!clickedImg) return;

  event.preventDefault();
  event.stopPropagation();

  const currentSrc =
    clickedImg.currentSrc || clickedImg.getAttribute("src") || clickedImg.src;
  if (!currentSrc) return;

  const container = contentContainerRef.value;
  const allImgs = container
    ? Array.from(container.querySelectorAll<HTMLImageElement>("img"))
    : [];
  const urls = allImgs
    .map((img) => img.currentSrc || img.getAttribute("src") || img.src)
    .filter((url): url is string => Boolean(url));

  if (urls.length === 0 || !urls.includes(currentSrc)) {
    urls.push(currentSrc);
  }

  const matchedIndex = urls.indexOf(currentSrc);
  const finalIndex = matchedIndex >= 0 ? matchedIndex : 0;
  imageViewerUrls.value = urls;
  imageViewerIndex.value = finalIndex;
  imageViewerVisible.value = true;

  emit("clickImage", currentSrc, finalIndex, urls);
}

onDeactivated(() => {
  imageViewerVisible.value = false;
});
</script>

<template>
  <div class="bq-rich-viewer bq-rich-content">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div
      v-if="hasContent"
      ref="contentContainerRef"
      class="bq-rich-viewer__content bq-rich-content"
      :class="{ 'is-image-previewable': previewImages }"
      @click="handleContentClick"
      v-html="content"
    />
    <span v-else class="bq-rich-viewer__fallback">{{ fallback }}</span>

    <ElImageViewer
      v-if="previewImages && imageViewerVisible"
      :url-list="imageViewerUrls"
      :initial-index="imageViewerIndex"
      teleported
      @close="imageViewerVisible = false"
    />
  </div>
</template>

<style lang="scss">
@use "./BaseRichEditor/styles/editor.scss";

.bq-rich-viewer {
  position: relative;
  min-width: 0;
  max-width: 100%;

  &__content {
    word-break: break-word;
    white-space: normal;

    &.is-image-previewable {
      img {
        cursor: zoom-in;
        border-radius: 4px;
        display: block !important;
        float: none !important;
        clear: both !important;
        max-width: 100%;
        height: auto;
        margin: 16px auto;
        transition:
          opacity 0.2s ease,
          box-shadow 0.2s ease;

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
    }

    table {
      display: table !important;
      float: none !important;
      clear: both !important;
      margin: 1.2em auto !important;
      width: 100%;
      max-width: 100% !important;
    }
  }

  &__fallback {
    color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
    font-size: var(--bq-font-body, 13px);
  }
}
</style>
