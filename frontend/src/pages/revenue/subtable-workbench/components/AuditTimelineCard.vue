<template>
  <div class="timeline-card">
    <div class="timeline-title">{{ title }}</div>
    <ul class="timeline-list">
      <li v-for="(item, index) in normalizedItems" :key="`timeline_${index}`">
        <div class="head">
          <b>{{ item.action }}</b>
          <span>{{ item.time }}</span>
        </div>
        <div class="desc">处理人：{{ item.actor }}</div>
        <div class="desc">{{ item.note }}</div>
      </li>
      <li v-if="!normalizedItems.length">
        <div class="desc">暂无留痕记录</div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { computed } from 'vue';
import { formatPeriodExpenseDisplayText } from "@/utils/displayText";

const props = defineProps({
  title: { type: String, default: "审核留痕时间线" },
  items: { type: Array, default: () => [] },
});

 
const normalizedItems = computed(() => {
  return (Array.isArray(props.items) ? props.items : [])
    .map((item: any) => {
      const source = item && typeof item === "object" ? item : {};
      return {
        action: formatPeriodExpenseDisplayText(source.action || "-"),
        time: String(source.time || "-"),
        actor: String(source.actor || "-"),
        note: formatPeriodExpenseDisplayText(source.note || "-"),
      };
    })
    .filter((item: any) => item.action !== "-" || item.note !== "-");
});
</script>

<style lang="scss" scoped>
.timeline-card {
  margin: 14px 16px 0;
  border: 1px solid var(--rv-line);
  border-radius: 8px;
  background: #fff;
  padding: 10px;
}

.timeline-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--rv-text-2);
  margin-bottom: 8px;
}

.timeline-list {
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    border-top: 1px solid #edf2fa;
    padding: 8px 0;
  }

  li:first-child {
    border-top: none;
    padding-top: 0;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #2f4258;
  }

  .desc {
    margin-top: 2px;
    font-size: 12px;
    color: #607289;
  }
}
</style>
