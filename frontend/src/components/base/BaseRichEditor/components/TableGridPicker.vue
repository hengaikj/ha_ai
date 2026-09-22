<script setup lang="ts">
import { ref } from "vue";

withDefaults(
  defineProps<{
    maxRows?: number;
    maxCols?: number;
  }>(),
  {
    maxRows: 6,
    maxCols: 6,
  },
);

const emit = defineEmits<{
  select: [rows: number, cols: number];
}>();

const hoverRow = ref(3);
const hoverCol = ref(3);

function handleCellHover(r: number, c: number) {
  hoverRow.value = r;
  hoverCol.value = c;
}

function handleCellClick(r: number, c: number) {
  emit("select", r, c);
}
</script>

<template>
  <div class="bq-table-grid-picker" @mouseleave="hoverRow = 0; hoverCol = 0">
    <div class="bq-table-grid-picker__header">
      <span class="bq-table-grid-picker__title">插入表格</span>
      <span class="bq-table-grid-picker__desc">
        {{ hoverRow > 0 && hoverCol > 0 ? `${hoverRow} 行 × ${hoverCol} 列` : "请滑动选择行列" }}
      </span>
    </div>
    <div class="bq-table-grid-picker__matrix">
      <div
        v-for="r in maxRows"
        :key="`row-${r}`"
        class="bq-table-grid-picker__row"
      >
        <div
          v-for="c in maxCols"
          :key="`col-${c}`"
          class="bq-table-grid-picker__cell"
          :class="{ 'is-active': r <= hoverRow && c <= hoverCol }"
          @mouseenter="handleCellHover(r, c)"
          @click="handleCellClick(r, c)"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bq-table-grid-picker {
  padding: 10px 12px;
  user-select: none;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 12px;
  }

  &__title {
    font-weight: 600;
    color: var(--bq-color-text, #1e293b);
  }

  &__desc {
    color: var(--bq-color-primary, #2f6fe8);
    font-weight: 500;
  }

  &__matrix {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__row {
    display: flex;
    gap: 4px;
  }

  &__cell {
    width: 18px;
    height: 18px;
    border-radius: 2px;
    border: 1px solid #cbd5e1;
    background-color: #f8fafc;
    cursor: pointer;
    transition: background-color 0.1s ease, border-color 0.1s ease;

    &:hover,
    &.is-active {
      background-color: rgba(47, 111, 232, 0.22);
      border-color: var(--bq-color-primary, #2f6fe8);
    }
  }
}
</style>
