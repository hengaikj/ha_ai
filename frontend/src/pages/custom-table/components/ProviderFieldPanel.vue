<script setup lang="ts">
import { computed } from "vue";
import type {
  TableProviderCatalogItem,
  TableProviderDescriptor,
} from "@/types/custom-table";

const props = defineProps<{
  providers: TableProviderCatalogItem[];
  selectedProviderCode?: string;
  selectedKeys: string[];
  readonly?: boolean;
}>();
const emit = defineEmits<{
  selectProvider: [provider: TableProviderDescriptor];
  toggleField: [key: string];
}>();
const selected = computed(
  () =>
    props.providers.find(
      (item) => item.providerCode === props.selectedProviderCode,
    )?.descriptor,
);
</script>

<template>
  <aside class="provider-panel">
    <div class="panel-title">数据资源</div>
    <el-select
      :model-value="selectedProviderCode"
      placeholder="选择 Provider"
      filterable
      :disabled="readonly"
      @change="
        (code: string) => {
          const item = providers.find((p) => p.providerCode === code);
          if (item) emit('selectProvider', item.descriptor);
        }
      "
    >
      <el-option
        v-for="item in providers"
        :key="item.providerCode"
        :label="item.displayName"
        :value="item.providerCode"
      />
    </el-select>
    <template v-if="selected">
      <div class="provider-meta">
        {{ selected.dataShape }} · v{{ selected.providerVersion }} · 最多
        {{ selected.maxRows }} 行
      </div>
      <div class="section-label">字段</div>
      <button
        v-for="field in selected.fields"
        :key="field.key"
        class="field-item"
        :class="{ active: selectedKeys.includes(field.key) }"
        type="button"
        :disabled="readonly"
        @click="emit('toggleField', field.key)"
      >
        <span>{{ field.label }}</span
        ><small>{{ field.valueType }}</small>
      </button>
      <div class="section-label">查询参数</div>
      <div
        v-for="param in selected.parameters"
        :key="param.key"
        class="parameter-item"
      >
        <span>{{ param.key }}</span
        ><small>{{ param.required ? "必填" : "可选" }}</small>
      </div>
    </template>
    <el-empty v-else description="请选择受控 Provider" :image-size="56" />
  </aside>
</template>

<style scoped>
.provider-panel {
  height: 100%;
  padding: 14px;
  overflow: auto;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}
.panel-title {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
}
.provider-meta {
  margin: 10px 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.section-label {
  margin: 16px 0 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
}
.field-item,
.parameter-item {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  align-items: center;
  justify-content: space-between;
  border: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: transparent;
  color: var(--el-text-color-primary);
  text-align: left;
}
.field-item {
  cursor: pointer;
}
.field-item:hover,
.field-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.field-item small,
.parameter-item small {
  color: var(--el-text-color-secondary);
}
</style>
