<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
} from "vue";
import type { Editor } from "@tiptap/vue-3";
import {
  Bottom,
  Delete,
  Top,
} from "@element-plus/icons-vue";

const props = defineProps<{
  editor: Editor;
  containerEl?: HTMLElement | null;
}>();

const visible = ref(false);
const position = ref({ top: 0, left: 0 });

function updatePosition() {
  if (!props.editor || !props.editor.isEditable) {
    visible.value = false;
    return;
  }

  const isInsideTable = props.editor.isActive("table");
  if (!isInsideTable) {
    visible.value = false;
    return;
  }

  const { view, state } = props.editor;
  const { from } = state.selection;

  let tableEl: HTMLElement | null;
  try {
    const dom = view.domAtPos(from).node;
    const element = dom.nodeType === 1 ? (dom as HTMLElement) : dom.parentElement;
    tableEl = element?.closest("table") ?? null;
  } catch {
    tableEl = null;
  }

  if (!tableEl) {
    visible.value = false;
    return;
  }

  const editorContainer = props.containerEl || view.dom.closest(".bq-rich-editor__body");
  if (!editorContainer) {
    visible.value = false;
    return;
  }

  const tableRect = tableEl.getBoundingClientRect();
  const containerRect = editorContainer.getBoundingClientRect();

  // 计算相对于容器的坐标
  const top = tableRect.top - containerRect.top + editorContainer.scrollTop - 44;
  const rawLeft = tableRect.left - containerRect.left + editorContainer.scrollLeft + tableRect.width / 2;
  const minLeft = 190;
  const maxLeft = Math.max(minLeft, containerRect.width - 190);
  const left = Math.max(minLeft, Math.min(maxLeft, rawLeft));

  position.value = {
    top: Math.max(8, top),
    left,
  };
  visible.value = true;
}

let animId: number | null = null;
let blurTimer: ReturnType<typeof setTimeout> | null = null;
let scrollContainer: HTMLElement | null = null;
function scheduleUpdate() {
  if (animId) window.cancelAnimationFrame(animId);
  animId = window.requestAnimationFrame(updatePosition);
}

function handleBlur() {
  if (blurTimer) clearTimeout(blurTimer);
  blurTimer = setTimeout(() => {
    blurTimer = null;
    if (!document.activeElement?.closest(".bq-table-bubble-menu")) {
      updatePosition();
    }
  }, 150);
}

function setupBubbleMenuEvents() {
  teardownBubbleMenuEvents();
  if (props.editor) {
    props.editor.on("selectionUpdate", scheduleUpdate);
    props.editor.on("transaction", scheduleUpdate);
    props.editor.on("focus", scheduleUpdate);
    props.editor.on("blur", handleBlur);
  }

  scrollContainer =
    props.containerEl || document.querySelector(".bq-rich-editor__body");
  scrollContainer?.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
}

function teardownBubbleMenuEvents() {
  if (props.editor) {
    props.editor.off("selectionUpdate", scheduleUpdate);
    props.editor.off("transaction", scheduleUpdate);
    props.editor.off("focus", scheduleUpdate);
    props.editor.off("blur", handleBlur);
  }
  scrollContainer?.removeEventListener("scroll", scheduleUpdate);
  scrollContainer = null;
  window.removeEventListener("resize", scheduleUpdate);
  if (animId) {
    window.cancelAnimationFrame(animId);
    animId = null;
  }
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }
  visible.value = false;
}

onMounted(setupBubbleMenuEvents);
onActivated(setupBubbleMenuEvents);
onDeactivated(teardownBubbleMenuEvents);
onBeforeUnmount(teardownBubbleMenuEvents);

const canMerge = computed(() => {
  try {
    return props.editor?.can().mergeCells() ?? false;
  } catch {
    return false;
  }
});

const canSplit = computed(() => {
  try {
    return props.editor?.can().splitCell() ?? false;
  } catch {
    return false;
  }
});

const currentTableWidth = computed(() => {
  try {
    const { state } = props.editor;
    const { $from } = state.selection;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (node.type.name === "table") {
        return (node.attrs.width as string) || "100%";
      }
    }
    return "100%";
  } catch {
    return "100%";
  }
});

function setTableWidth(width: string) {
  if (!props.editor) return;
  // 1. 通过 Tiptap 命令链触发事务更新与持久化
  // @ts-expect-error custom command
  if (typeof props.editor.commands.setTableWidth === "function") {
    // @ts-expect-error custom command
    props.editor.chain().focus().setTableWidth(width).run();
  } else {
    props.editor.chain().focus().updateAttributes("table", { width }).run();
  }

  // 2. 立即同步 DOM 元素属性与样式，提供毫秒级响应
  try {
    const { view, state } = props.editor;
    const dom = view.domAtPos(state.selection.from).node;
    const element = dom.nodeType === 1 ? (dom as HTMLElement) : dom.parentElement;
    const currentTable = element?.closest("table");
    if (currentTable) {
      currentTable.setAttribute("data-width", width);
      currentTable.style.width = width;
      currentTable.style.maxWidth = "100%";
      currentTable.style.margin = "1.2em auto";
    }
  } catch {
    // 忽略 DOM 属性即时同步容错
  }

  scheduleUpdate();
}
</script>

<template>
  <transition name="bq-fade">
    <div
      v-if="visible"
      class="bq-table-bubble-menu"
      :style="{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }"
      @mousedown.prevent.stop
    >
      <!-- 行操作组 -->
      <div class="bq-table-bubble-menu__group">
        <el-tooltip content="在上方添加行" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn"
            @mousedown.prevent.stop
            @click.stop="editor.chain().focus().addRowBefore().run()"
          >
            <el-icon :size="13"><Top /></el-icon>
            <span>上加行</span>
          </button>
        </el-tooltip>
        <el-tooltip content="在下方添加行" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn"
            @mousedown.prevent.stop
            @click.stop="editor.chain().focus().addRowAfter().run()"
          >
            <el-icon :size="13"><Bottom /></el-icon>
            <span>下加行</span>
          </button>
        </el-tooltip>
        <el-tooltip content="删除当前行" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn is-danger-text"
            @mousedown.prevent.stop
            @click.stop="editor.chain().focus().deleteRow().run()"
          >
            <span>删行</span>
          </button>
        </el-tooltip>
      </div>

      <span class="bq-table-bubble-menu__divider" />

      <!-- 列操作组 -->
      <div class="bq-table-bubble-menu__group">
        <el-tooltip content="在左侧添加列" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn"
            @mousedown.prevent.stop
            @click.stop="editor.chain().focus().addColumnBefore().run()"
          >
            <span>左加列</span>
          </button>
        </el-tooltip>
        <el-tooltip content="在右侧添加列" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn"
            @mousedown.prevent.stop
            @click.stop="editor.chain().focus().addColumnAfter().run()"
          >
            <span>右加列</span>
          </button>
        </el-tooltip>
        <el-tooltip content="删除当前列" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn is-danger-text"
            @mousedown.prevent.stop
            @click.stop="editor.chain().focus().deleteColumn().run()"
          >
            <span>删列</span>
          </button>
        </el-tooltip>
      </div>

      <span class="bq-table-bubble-menu__divider" />

      <!-- 单元格操作组 -->
      <div class="bq-table-bubble-menu__group">
        <el-tooltip content="合并选中的单元格" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn"
            :disabled="!canMerge"
            @mousedown.prevent.stop
            @click.stop="editor.chain().focus().mergeCells().run()"
          >
            <span>合并</span>
          </button>
        </el-tooltip>
        <el-tooltip content="拆分单元格" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn"
            :disabled="!canSplit"
            @mousedown.prevent.stop
            @click.stop="editor.chain().focus().splitCell().run()"
          >
            <span>拆分</span>
          </button>
        </el-tooltip>
        <el-tooltip content="切换首行表头高亮" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn"
            @mousedown.prevent.stop
            @click.stop="editor.chain().focus().toggleHeaderRow().run()"
          >
            <span>表头</span>
          </button>
        </el-tooltip>
      </div>

      <span class="bq-table-bubble-menu__divider" />

      <!-- 表格整表宽度组 -->
      <div class="bq-table-bubble-menu__group">
        <el-tooltip content="半宽 (50%) 居中" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn"
            :class="{ 'is-active': currentTableWidth === '50%' }"
            @mousedown.prevent.stop
            @click.stop="setTableWidth('50%')"
          >
            <span>50%</span>
          </button>
        </el-tooltip>
        <el-tooltip content="中大宽 (75%) 居中" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn"
            :class="{ 'is-active': currentTableWidth === '75%' }"
            @mousedown.prevent.stop
            @click.stop="setTableWidth('75%')"
          >
            <span>75%</span>
          </button>
        </el-tooltip>
        <el-tooltip content="铺满页面 (100%)" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn"
            :class="{ 'is-active': currentTableWidth === '100%' }"
            @mousedown.prevent.stop
            @click.stop="setTableWidth('100%')"
          >
            <span>100%</span>
          </button>
        </el-tooltip>
      </div>

      <span class="bq-table-bubble-menu__divider" />

      <!-- 删除表格 -->
      <div class="bq-table-bubble-menu__group">
        <el-tooltip content="删除整张表格" placement="top" :show-after="300">
          <button
            type="button"
            class="bq-table-bubble-menu__btn is-danger"
            @mousedown.prevent.stop
            @click.stop="editor.chain().focus().deleteTable().run()"
          >
            <el-icon :size="13"><Delete /></el-icon>
            <span>删表</span>
          </button>
        </el-tooltip>
      </div>
    </div>
  </transition>
</template>

<style lang="scss" scoped>
.bq-table-bubble-menu {
  position: absolute;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(30, 36, 45, 0.94);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.24);
  white-space: nowrap;
  user-select: none;

  &::after {
    content: "";
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px 5px 0;
    border-style: solid;
    border-color: rgba(30, 36, 45, 0.94) transparent transparent;
  }

  &__group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  &__divider {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.22);
    margin: 0 4px;
  }

  &__btn {
    border: none;
    background: transparent;
    color: #e2e8f0;
    font-size: 12px;
    font-weight: 500;
    padding: 3px 7px;
    border-radius: 12px;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 3px;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    &.is-active {
      background: var(--bq-color-primary, #2F6FE8);
      color: #ffffff;
      font-weight: 600;
    }

    &.is-danger-text {
      color: #fca5a5;
      &:hover:not(:disabled) {
        background: rgba(239, 68, 68, 0.2);
        color: #fecaca;
      }
    }

    &.is-danger {
      color: #fca5a5;
      &:hover:not(:disabled) {
        background: var(--bq-color-danger, #e55353);
        color: #ffffff;
      }
    }
  }
}
</style>
