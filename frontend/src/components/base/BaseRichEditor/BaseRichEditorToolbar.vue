<script setup lang="ts">
import { computed, ref } from "vue";
import type { Editor } from "@tiptap/vue-3";
import {
  ChatLineSquare,
  Delete,
  Document,
  FullScreen,
  Grid,
  Link,
  Picture,
  RefreshLeft,
  RefreshRight,
  ScaleToOriginal,
} from "@element-plus/icons-vue";
import TableGridPicker from "./components/TableGridPicker.vue";

const props = defineProps<{
  editor: Editor | null;
  isFullscreen?: boolean;
}>();

const emit = defineEmits<{
  toggleFullscreen: [];
  triggerUploadImage: [];
}>();

const headingValue = computed(() => {
  if (!props.editor) return "p";
  if (props.editor.isActive("heading", { level: 1 })) return "1";
  if (props.editor.isActive("heading", { level: 2 })) return "2";
  if (props.editor.isActive("heading", { level: 3 })) return "3";
  if (props.editor.isActive("heading", { level: 4 })) return "4";
  return "p";
});

function handleHeadingChange(value: string) {
  if (!props.editor) return;
  if (value === "p") {
    props.editor.chain().focus().setParagraph().run();
  } else {
    props.editor
      .chain()
      .focus()
      .setHeading({ level: parseInt(value, 10) as 1 | 2 | 3 | 4 })
      .run();
  }
}

// 预设高频颜色
const textColor = ref("#333333");
function handleTextColorChange(color: string | null) {
  if (!props.editor) return;
  if (!color) {
    props.editor.chain().focus().unsetColor().run();
  } else {
    props.editor.chain().focus().setColor(color).run();
  }
}

function handleHighlightToggle() {
  if (!props.editor) return;
  props.editor.chain().focus().toggleHighlight({ color: "#fff3a8" }).run();
}

function setLink() {
  if (!props.editor) return;
  const previousUrl = props.editor.getAttributes("link").href;
  const url = window.prompt("请输入链接地址 (URL):", previousUrl);
  if (url === null) return;
  if (url === "") {
    props.editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  props.editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: url })
    .run();
}


function handleGridSelect(rows: number, cols: number) {
  if (!props.editor) return;
  props.editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
}

function handleTableCommand(command: string) {
  if (!props.editor) return;
  const chain = props.editor.chain().focus();
  switch (command) {
    case "insert":
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      break;
    case "addRowBefore":
      chain.addRowBefore().run();
      break;
    case "addRowAfter":
      chain.addRowAfter().run();
      break;
    case "deleteRow":
      chain.deleteRow().run();
      break;
    case "addColumnBefore":
      chain.addColumnBefore().run();
      break;
    case "addColumnAfter":
      chain.addColumnAfter().run();
      break;
    case "deleteColumn":
      chain.deleteColumn().run();
      break;
    case "mergeCells":
      chain.mergeCells().run();
      break;
    case "splitCell":
      chain.splitCell().run();
      break;
    case "toggleHeaderRow":
      chain.toggleHeaderRow().run();
      break;
    case "deleteTable":
      chain.deleteTable().run();
      break;
  }
}

const isInTable = computed(() => Boolean(props.editor?.isActive("table")));
</script>

<template>
  <div v-if="editor" class="bq-rich-editor__toolbar" role="toolbar">
    <!-- 历史撤销重做 -->
    <div class="bq-rich-editor__toolbar-group">
      <el-tooltip content="撤销 (Ctrl+Z)" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :disabled="!editor.can().chain().focus().undo().run()"
          @click="editor.chain().focus().undo().run()"
        >
          <el-icon><RefreshLeft /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip content="重做 (Ctrl+Y)" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :disabled="!editor.can().chain().focus().redo().run()"
          @click="editor.chain().focus().redo().run()"
        >
          <el-icon><RefreshRight /></el-icon>
        </button>
      </el-tooltip>
    </div>

    <!-- 标题层级 -->
    <div class="bq-rich-editor__toolbar-group">
      <el-select
        :model-value="headingValue"
        class="bq-rich-editor__select"
        size="small"
        @change="handleHeadingChange"
      >
        <el-option label="正文" value="p" />
        <el-option label="标题 1" value="1" />
        <el-option label="标题 2" value="2" />
        <el-option label="标题 3" value="3" />
        <el-option label="标题 4" value="4" />
      </el-select>
    </div>

    <!-- 文字样式 -->
    <div class="bq-rich-editor__toolbar-group">
      <el-tooltip content="加粗 (Ctrl+B)" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('bold') }"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <strong style="font-size: 15px">B</strong>
        </button>
      </el-tooltip>

      <el-tooltip content="斜体 (Ctrl+I)" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('italic') }"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <em style="font-size: 15px; font-family: serif">I</em>
        </button>
      </el-tooltip>

      <el-tooltip content="下划线 (Ctrl+U)" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('underline') }"
          @click="editor.chain().focus().toggleUnderline().run()"
        >
          <span style="text-decoration: underline; font-size: 14px">U</span>
        </button>
      </el-tooltip>

      <el-tooltip content="删除线" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('strike') }"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <span style="text-decoration: line-through; font-size: 14px">S</span>
        </button>
      </el-tooltip>

      <el-tooltip content="行内代码" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('code') }"
          @click="editor.chain().focus().toggleCode().run()"
        >
          <span style="font-family: monospace; font-size: 13px">&lt;/&gt;</span>
        </button>
      </el-tooltip>
    </div>

    <!-- 颜色与高亮 -->
    <div class="bq-rich-editor__toolbar-group">
      <el-tooltip content="文字颜色" placement="top" :show-after="400">
        <div class="bq-rich-editor__color-picker">
          <el-color-picker
            v-model="textColor"
            size="small"
            show-alpha
            :predefine="[
              '#333333',
              '#2F6FE8',
              '#E05B3D',
              '#7ACE87',
              '#FFB156',
              '#E55353',
              '#64748B',
            ]"
            @change="handleTextColorChange"
          />
        </div>
      </el-tooltip>

      <el-tooltip content="高亮标记" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('highlight') }"
          @click="handleHighlightToggle"
        >
          <span
            style="
              background: #fff3a8;
              padding: 0 3px;
              border-radius: 2px;
              font-size: 12px;
            "
          >
            A
          </span>
        </button>
      </el-tooltip>
    </div>

    <!-- 对齐方式 -->
    <div class="bq-rich-editor__toolbar-group">
      <el-tooltip content="左对齐" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }"
          @click="editor.chain().focus().setTextAlign('left').run()"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M3 5h18v2H3V5zm0 4h12v2H3V9zm0 4h18v2H3v-2zm0 4h12v2H3v-2z"
            />
          </svg>
        </button>
      </el-tooltip>

      <el-tooltip content="居中对齐" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }"
          @click="editor.chain().focus().setTextAlign('center').run()"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M3 5h18v2H3V5zm3 4h12v2H6V9zm-3 4h18v2H3v-2zm3 4h12v2H6v-2z"
            />
          </svg>
        </button>
      </el-tooltip>

      <el-tooltip content="右对齐" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }"
          @click="editor.chain().focus().setTextAlign('right').run()"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M3 5h18v2H3V5zm6 4h12v2H9V9zm-6 4h18v2H3v-2zm6 4h12v2H9v-2z"
            />
          </svg>
        </button>
      </el-tooltip>
    </div>

    <!-- 列表与结构 -->
    <div class="bq-rich-editor__toolbar-group">
      <el-tooltip content="无序列表" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('bulletList') }"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M4 6h2v2H4V6zm0 5h2v2H4v-2zm0 5h2v2H4v-2zm5-10h11v2H9V6zm0 5h11v2H9v-2zm0 5h11v2H9v-2z"
            />
          </svg>
        </button>
      </el-tooltip>

      <el-tooltip content="有序列表" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('orderedList') }"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M3 5h2v1H4v1h1v1H3V5zm0 5h1.8L3.2 12H5v1H3v-.8l1.6-1.8H3v-.4zm0 5h1.5v.5H4v1h.5v.5H3V18h2v-3H3zm6-9h11v2H9V6zm0 5h11v2H9v-2zm0 5h11v2H9v-2z"
            />
          </svg>
        </button>
      </el-tooltip>

      <el-tooltip content="任务清单 (待办)" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('taskList') }"
          @click="editor.chain().focus().toggleTaskList().run()"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.6 8.4l-1.4-1.4-6.2 6.2-2.8-2.8-1.4 1.4 4.2 4.2z"
            />
          </svg>
        </button>
      </el-tooltip>

      <el-tooltip content="引用块" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('blockquote') }"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          <el-icon><ChatLineSquare /></el-icon>
        </button>
      </el-tooltip>

      <el-tooltip content="代码块" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('codeBlock') }"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          <el-icon><Document /></el-icon>
        </button>
      </el-tooltip>

      <el-tooltip content="水平分割线" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          @click="editor.chain().focus().setHorizontalRule().run()"
        >
          <span style="font-weight: bold">—</span>
        </button>
      </el-tooltip>
    </div>

    <!-- 表格功能 -->
    <div class="bq-rich-editor__toolbar-group">
      <el-dropdown trigger="click" @command="handleTableCommand">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': isInTable }"
          title="表格操作"
        >
          <el-icon><Grid /></el-icon>
        </button>
        <template #dropdown>
          <div class="bq-rich-editor__table-menu-panel">
            <TableGridPicker @select="handleGridSelect" />
            <el-dropdown-menu>
              <el-dropdown-item
                :disabled="!isInTable"
                command="addRowBefore"
              >
              在上方插入行
            </el-dropdown-item>
            <el-dropdown-item :disabled="!isInTable" command="addRowAfter">
              在下方插入行
            </el-dropdown-item>
            <el-dropdown-item :disabled="!isInTable" command="deleteRow">
              删除整行
            </el-dropdown-item>
            <el-dropdown-item
              divided
              :disabled="!isInTable"
              command="addColumnBefore"
            >
              在左侧插入列
            </el-dropdown-item>
            <el-dropdown-item :disabled="!isInTable" command="addColumnAfter">
              在右侧插入列
            </el-dropdown-item>
            <el-dropdown-item :disabled="!isInTable" command="deleteColumn">
              删除整列
            </el-dropdown-item>
            <el-dropdown-item
              divided
              :disabled="!isInTable"
              command="mergeCells"
            >
              合并单元格
            </el-dropdown-item>
            <el-dropdown-item :disabled="!isInTable" command="splitCell">
              拆分单元格
            </el-dropdown-item>
            <el-dropdown-item
              :disabled="!isInTable"
              command="toggleHeaderRow"
            >
              切换首行表头
            </el-dropdown-item>
            <el-dropdown-item
              divided
              :disabled="!isInTable"
              command="deleteTable"
              style="color: var(--bq-color-danger)"
            >
              删除表格
            </el-dropdown-item>
            </el-dropdown-menu>
          </div>
        </template>
      </el-dropdown>
    </div>

    <!-- 链接与图片 -->
    <div class="bq-rich-editor__toolbar-group">
      <el-tooltip content="插入/修改超链接" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': editor.isActive('link') }"
          @click="setLink"
        >
          <el-icon><Link /></el-icon>
        </button>
      </el-tooltip>

      <el-tooltip content="上传图片" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          @click="emit('triggerUploadImage')"
        >
          <el-icon><Picture /></el-icon>
        </button>
      </el-tooltip>

      <el-tooltip content="清除格式" placement="top" :show-after="400">
        <button
          type="button"
          class="bq-rich-editor__btn"
          @click="editor.chain().focus().clearNodes().unsetAllMarks().run()"
        >
          <el-icon><Delete /></el-icon>
        </button>
      </el-tooltip>
    </div>

    <!-- 全屏按钮 -->
    <div class="bq-rich-editor__toolbar-group" style="margin-left: auto">
      <el-tooltip
        :content="isFullscreen ? '退出全屏 (Esc)' : '全屏编辑'"
        placement="top"
        :show-after="400"
      >
        <button
          type="button"
          class="bq-rich-editor__btn"
          :class="{ 'is-active': isFullscreen }"
          @click="emit('toggleFullscreen')"
        >
          <el-icon>
            <ScaleToOriginal v-if="isFullscreen" />
            <FullScreen v-else />
          </el-icon>
        </button>
      </el-tooltip>
    </div>
  </div>
</template>
