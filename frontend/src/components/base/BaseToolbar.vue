<script setup lang="ts">
import { computed } from "vue";
import { RefreshRight, Search } from "@element-plus/icons-vue";
import { useAuthStore } from "@/stores/auth";

const props = withDefaults(
  defineProps<{
    showRefresh?: boolean;
    refreshText?: string;
    refreshPermission?: string | string[];
    showSearchToggle?: boolean;
    searchVisible?: boolean;
  }>(),
  {
    showRefresh: true,
    refreshText: "刷新",
    refreshPermission: undefined,
    showSearchToggle: false,
    searchVisible: true,
  },
);

const authStore = useAuthStore();
const canRefresh = computed(() =>
  authStore.hasPermission(props.refreshPermission),
);

const emit = defineEmits<{
  refresh: [];
  "toggle-search": [];
}>();
</script>

<template>
  <div class="base-toolbar">
    <div class="base-toolbar__main">
      <slot />
    </div>
    <div class="base-toolbar__extra">
      <slot name="extra" />
      <el-button
        v-if="showSearchToggle"
        class="toolbar-icon-button"
        circle
        :icon="Search"
        :aria-label="searchVisible ? '隐藏搜索' : '显示搜索'"
        :title="searchVisible ? '隐藏搜索' : '显示搜索'"
        @click="emit('toggle-search')"
      />
      <el-button
        v-if="showRefresh && canRefresh"
        class="toolbar-icon-button"
        circle
        :icon="RefreshRight"
        :aria-label="refreshText"
        :title="refreshText"
        @click="emit('refresh')"
      />
    </div>
  </div>
</template>

<style scoped>
.toolbar-icon-button {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  flex: 0 0 28px;
  --el-button-text-color: #909399;
  --el-button-border-color: #dcdfe6;
  --el-button-hover-text-color: #409eff;
  --el-button-hover-border-color: #b3d8ff;
  --el-button-hover-bg-color: #ecf5ff;
}

.base-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  min-height: 40px;
}

.base-toolbar__main,
.base-toolbar__extra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.base-toolbar__extra {
  justify-content: flex-end;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .base-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .base-toolbar__extra {
    justify-content: flex-start;
  }
}
</style>
