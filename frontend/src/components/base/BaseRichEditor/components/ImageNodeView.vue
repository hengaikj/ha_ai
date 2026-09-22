<script setup lang="ts">
import { computed, inject } from "vue";
import { nodeViewProps, NodeViewWrapper } from "@tiptap/vue-3";
import {
  Back,
  Delete,
  Minus,
  Right,
  ZoomIn,
} from "@element-plus/icons-vue";

const props = defineProps(nodeViewProps);

const previewImage = inject<((url: string) => void) | null>(
  "bq-editor-preview-image",
  null,
);

const currentWidth = computed(() => props.node.attrs.width || "100%");
const currentAlign = computed(() => props.node.attrs.align || "center");

function updateWidth(width: string) {
  props.updateAttributes({ width });
}

function updateAlign(align: "left" | "center" | "right") {
  props.updateAttributes({ align });
}

function handlePreview() {
  const src = props.node.attrs.src;
  if (!src) return;

  if (previewImage) {
    previewImage(src);
  } else if (typeof window !== "undefined") {
    const event = new window.CustomEvent("bq-editor-preview-image", {
      bubbles: true,
      detail: { url: src },
    });
    window.dispatchEvent(event);
  }
}
</script>

<template>
  <node-view-wrapper
    class="bq-image-resizer"
    :class="[`is-align-${currentAlign}`, { 'is-selected': selected }]"
  >
    <div
      class="bq-image-resizer__container"
      :style="{ width: currentWidth }"
    >
      <img
        :src="node.attrs.src"
        :alt="node.attrs.alt"
        :data-attachment-id="node.attrs.attachmentId"
        class="bq-image-resizer__img"
      />

      <!-- 选中时浮动的操作胶囊工具栏 -->
      <transition name="bq-fade">
        <div
          v-if="selected && editor.isEditable"
          class="bq-image-resizer__toolbar"
          @mousedown.stop
        >
          <!-- 尺寸预设 -->
          <div class="bq-image-resizer__group">
            <button
              type="button"
              class="bq-image-resizer__btn"
              :class="{ 'is-active': currentWidth === '25%' }"
              title="小尺寸 (25%)"
              @click="updateWidth('25%')"
            >
              25%
            </button>
            <button
              type="button"
              class="bq-image-resizer__btn"
              :class="{ 'is-active': currentWidth === '50%' }"
              title="中尺寸 (50%)"
              @click="updateWidth('50%')"
            >
              50%
            </button>
            <button
              type="button"
              class="bq-image-resizer__btn"
              :class="{ 'is-active': currentWidth === '75%' }"
              title="大尺寸 (75%)"
              @click="updateWidth('75%')"
            >
              75%
            </button>
            <button
              type="button"
              class="bq-image-resizer__btn"
              :class="{ 'is-active': currentWidth === '100%' }"
              title="铺满 (100%)"
              @click="updateWidth('100%')"
            >
              100%
            </button>
          </div>

          <span class="bq-image-resizer__divider" />

          <!-- 对齐方式 -->
          <div class="bq-image-resizer__group">
            <button
              type="button"
              class="bq-image-resizer__btn bq-image-resizer__btn--icon"
              :class="{ 'is-active': currentAlign === 'left' }"
              title="居左对齐"
              @click="updateAlign('left')"
            >
              <el-icon :size="13"><Back /></el-icon>
            </button>
            <button
              type="button"
              class="bq-image-resizer__btn bq-image-resizer__btn--icon"
              :class="{ 'is-active': currentAlign === 'center' }"
              title="居中对齐"
              @click="updateAlign('center')"
            >
              <el-icon :size="13"><Minus /></el-icon>
            </button>
            <button
              type="button"
              class="bq-image-resizer__btn bq-image-resizer__btn--icon"
              :class="{ 'is-active': currentAlign === 'right' }"
              title="居右对齐"
              @click="updateAlign('right')"
            >
              <el-icon :size="13"><Right /></el-icon>
            </button>
          </div>

          <span class="bq-image-resizer__divider" />

          <!-- 预览与删除 -->
          <div class="bq-image-resizer__group">
            <button
              type="button"
              class="bq-image-resizer__btn bq-image-resizer__btn--icon"
              title="查看无损大图"
              @click="handlePreview"
            >
              <el-icon :size="13"><ZoomIn /></el-icon>
            </button>
            <button
              type="button"
              class="bq-image-resizer__btn bq-image-resizer__btn--icon is-danger"
              title="删除图片"
              @click="deleteNode"
            >
              <el-icon :size="13"><Delete /></el-icon>
            </button>
          </div>
        </div>
      </transition>
    </div>
  </node-view-wrapper>
</template>
