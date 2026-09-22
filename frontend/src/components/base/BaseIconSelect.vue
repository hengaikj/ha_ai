<script setup lang="ts">
import { computed, ref } from "vue";
import { Search } from "@element-plus/icons-vue";
import * as ElementPlusIcons from "@element-plus/icons-vue";
import type { Component } from "vue";

const props = withDefaults(
  defineProps<{ modelValue: string; placeholder?: string }>(),
  { placeholder: "点击选择图标" },
);
const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [value: string];
}>();
const visible = ref(false);
const keyword = ref("");
const iconComponents = ElementPlusIcons as Record<string, Component>;
const iconEntries = Object.entries(ElementPlusIcons)
  .filter(([name]) => name !== "default")
  .map(([name, component]) => ({
    name,
    label: name,
    component: component as Component,
  }));
const selectedIcon = computed(() =>
  props.modelValue ? iconComponents[props.modelValue] : null,
);
const selectedIconLabel = computed(() => props.modelValue);
const filteredIcons = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  return value
    ? iconEntries.filter((item) => item.name.toLowerCase().includes(value))
    : iconEntries;
});
function selectIcon(value: string) {
  emit("update:modelValue", value);
  emit("change", value);
  visible.value = false;
}
function clearIcon() {
  selectIcon("");
}
</script>

<template>
  <el-popover v-model:visible="visible" placement="bottom-start" trigger="click" width="460">
    <template #reference>
      <el-input
        :model-value="selectedIconLabel"
        :placeholder="props.placeholder"
        clearable
        readonly
        @clear="clearIcon"
      >
        <template #prefix>
          <el-icon v-if="selectedIcon"><component :is="selectedIcon" /></el-icon>
          <el-icon v-else><Search /></el-icon>
        </template>
      </el-input>
    </template>
    <div class="base-icon-select">
      <el-input v-model="keyword" clearable placeholder="请输入图标名称">
        <template #suffix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-scrollbar max-height="250px">
        <div class="base-icon-select__grid">
          <button
            v-for="item in filteredIcons"
            :key="item.name"
            class="base-icon-select__item"
            :class="{ 'is-active': item.name === props.modelValue }"
            type="button"
            @click="selectIcon(item.name)"
          >
            <el-icon><component :is="item.component" /></el-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>
        <el-empty v-if="!filteredIcons.length" description="暂无匹配图标" :image-size="60" />
      </el-scrollbar>
    </div>
  </el-popover>
</template>

<style scoped>
.base-icon-select { display: grid; gap: 12px; }
.base-icon-select__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px 12px; padding: 10px 2px 2px; }
.base-icon-select__item { min-width: 0; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 6px; border: 0; border-radius: 4px; background: transparent; color: var(--bq-color-text-secondary); cursor: pointer; font: inherit; text-align: left; }
.base-icon-select__item:hover, .base-icon-select__item.is-active { background: var(--bq-color-primary-soft); color: var(--bq-color-primary); }
.base-icon-select__item span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
