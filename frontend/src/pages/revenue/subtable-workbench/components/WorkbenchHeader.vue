<template>
  <div class="workbench-header-block" :class="{ 'is-actions-only': !hasHeading && hasActions }">
    <div v-if="hasHeading || hasActions" class="rv-list-head">
      <div v-if="hasHeading">
        <div v-if="title" class="rv-list-title">{{ title }}</div>
        <div v-if="subtitle" class="page-sub">{{ subtitle }}</div>
      </div>
      <div v-if="hasActions" class="rv-list-toolbar">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="normalizedInfoItems.length" class="info-grid">
      <div
        v-for="(item, index) in normalizedInfoItems"
        :key="`info_${index}`"
        class="info-item"
      >
        <span>{{ (item as any).label }}</span>
        <b>{{ (item as any).value }}</b>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { computed, useSlots } from 'vue';

const props = defineProps({
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" },
  infoItems: { type: Array, default: () => [] },
});

const slots = useSlots();

const hasHeading = computed(() => {
  return Boolean(String(props.title || "").trim() || String(props.subtitle || "").trim());
});

const hasActions = computed(() => {
  return Boolean(slots.actions);
});

 
const normalizedInfoItems = computed(() => {
  return (props.infoItems || [])
    .map((item: any) => {
      if (!item || typeof item !== "object") return null;
      return {
        label: String(item.label || "").trim(),
        value: String(item.value == null ? "-" : item.value),
      };
    })
    .filter((item) => item && item.label);
});
</script>

<style lang="scss" scoped>
.workbench-header-block {
  .rv-list-head {
    padding: 12px 14px;
    border-bottom: 1px solid var(--rv-line);
    background: linear-gradient(180deg, var(--rv-bg), var(--rv-surface));
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    position: sticky;
    top: 0;
    z-index: 30;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
  }

  .rv-list-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--rv-text);
  }

  .rv-list-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
    margin-left: auto;
  }

  .rv-list-toolbar > * {
    margin-left: 0;
  }

  .rv-list-toolbar :deep(.el-button) {
    margin-left: 0;
  }

  &.is-actions-only .rv-list-head {
    justify-content: flex-end;
    padding: 10px 14px 0;
    border-bottom: 0;
    background: transparent;
  }

  &.is-actions-only .info-grid {
    margin-top: 6px;
  }

  .page-sub {
    margin-top: 6px;
    color: var(--rv-text-3);
    font-size: 12px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 8px 16px 0;
  }

  .info-item {
    border: 1px solid var(--rv-line);
    background: #fff;
    border-radius: 8px;
    padding: 8px 10px;
    display: grid;
    gap: 4px;

    span {
      font-size: 12px;
      color: var(--rv-text-4);
    }

    b {
      font-size: 13px;
      color: var(--rv-text-1);
      font-weight: 600;
      word-break: break-all;
    }
  }
}
</style>
