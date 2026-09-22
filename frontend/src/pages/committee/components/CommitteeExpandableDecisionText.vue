<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from "vue";

const props = withDefaults(
  defineProps<{
    text?: string | null;
    emptyText?: string;
  }>(),
  {
    text: "",
    emptyText: "--",
  },
);

const contentRef = ref<HTMLElement | null>(null);
const expanded = ref(false);
const overflowing = ref(false);
const displayText = computed(() => props.text?.trim() || props.emptyText);
const hasContent = computed(() => Boolean(props.text?.trim()));
let resizeObserver: ResizeObserver | null = null;

function measureOverflow() {
  const content = contentRef.value;
  if (!content || expanded.value) return;
  overflowing.value = content.scrollWidth > content.clientWidth + 1;
}

function toggleExpanded() {
  expanded.value = !expanded.value;
  if (!expanded.value) void nextTick(measureOverflow);
}

function startOverflowObserver() {
  resizeObserver?.disconnect();
  const content = contentRef.value;
  if (!content || typeof globalThis.ResizeObserver === "undefined") return;
  resizeObserver = new globalThis.ResizeObserver(measureOverflow);
  resizeObserver.observe(content);
}

watch(
  () => props.text,
  async () => {
    expanded.value = false;
    await nextTick();
    measureOverflow();
  },
);

onMounted(async () => {
  await nextTick();
  measureOverflow();
  startOverflowObserver();
});

function stopOverflowObserver() {
  resizeObserver?.disconnect();
  resizeObserver = null;
}

onActivated(async () => {
  await nextTick();
  measureOverflow();
  startOverflowObserver();
});
onDeactivated(stopOverflowObserver);
onBeforeUnmount(stopOverflowObserver);
</script>

<template>
  <div
    class="committee-expandable-decision-text"
    :class="{ 'is-expanded': expanded }"
  >
    <span ref="contentRef" class="committee-expandable-decision-text__content">
      {{ displayText }}
    </span>
    <el-button
      v-if="hasContent && overflowing"
      link
      type="primary"
      class="committee-expandable-decision-text__toggle"
      :aria-expanded="expanded"
      @click="toggleExpanded"
    >
      {{ expanded ? "收起" : "更多" }}
    </el-button>
  </div>
</template>

<style scoped>
.committee-expandable-decision-text {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  text-align: left;
}

.committee-expandable-decision-text__content {
  display: block;
  min-width: 0;
  overflow: hidden;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.committee-expandable-decision-text.is-expanded
  .committee-expandable-decision-text__content {
  overflow: visible;
  text-overflow: clip;
  white-space: pre-wrap;
  word-break: break-word;
}

.committee-expandable-decision-text__toggle.el-button {
  flex: none;
  min-height: 22px;
  padding: 0;
  font-size: var(--bq-font-compact, 14px);
  line-height: 22px;
}
</style>
