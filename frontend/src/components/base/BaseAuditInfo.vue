<script setup lang="ts">
import BaseDateTime from "@/components/base/BaseDateTime.vue";

defineProps<{
  createdBy?: string | null;
  createdAt?: string | number | Date | null;
  updatedBy?: string | null;
  updatedAt?: string | number | Date | null;
}>();
</script>

<template>
  <dl class="base-audit-info">
    <div>
      <dt>创建人</dt>
      <dd>{{ createdBy || "--" }}</dd>
    </div>
    <div>
      <dt>创建时间</dt>
      <dd><BaseDateTime :value="createdAt" /></dd>
    </div>
    <div>
      <dt>更新人</dt>
      <dd>{{ updatedBy || "--" }}</dd>
    </div>
    <div>
      <dt>更新时间</dt>
      <dd><BaseDateTime :value="updatedAt" /></dd>
    </div>
  </dl>
</template>

<style scoped>
.base-audit-info {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.base-audit-info div {
  min-width: 0;
}

.base-audit-info dt {
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.base-audit-info dd {
  margin: 4px 0 0;
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
}

@media (max-width: 960px) {
  .base-audit-info {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
