<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Delete, Refresh, WarningFilled } from "@element-plus/icons-vue";
import {
  clearAllCaches,
  clearCacheKey,
  clearCacheName,
  fetchCacheKeys,
  fetchCacheNames,
  fetchCacheValue,
} from "@/api/monitor";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import type { CacheNameItem, CacheValueDetail } from "@/types/monitor";

const cacheNames = ref<CacheNameItem[]>([]);
const cacheKeys = ref<string[]>([]);
const selectedCacheName = ref("");
const selectedCacheKey = ref("");
const cacheDetail = ref<CacheValueDetail>({});
const namesLoading = ref(false);
const keysLoading = ref(false);
const detailLoading = ref(false);
const actionLoading = ref(false);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const formattedCacheValue = computed(() => {
  const value = cacheDetail.value.cacheValue;
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
});

function displayCacheName(cacheName: string) {
  return cacheName.replace(/^:/, "");
}

function displayCacheKey(cacheKey: string) {
  return selectedCacheName.value && cacheKey.startsWith(selectedCacheName.value)
    ? cacheKey.slice(selectedCacheName.value.length)
    : cacheKey;
}

function resetDetail() {
  selectedCacheKey.value = "";
  cacheDetail.value = {};
}

async function loadCacheNames() {
  namesLoading.value = true;
  try {
    cacheNames.value = await fetchCacheNames();
    if (
      selectedCacheName.value &&
      !cacheNames.value.some(
        (item) => item.cacheName === selectedCacheName.value,
      )
    ) {
      selectedCacheName.value = "";
      cacheKeys.value = [];
      resetDetail();
    }
  } finally {
    namesLoading.value = false;
  }
}

async function loadCacheKeys(cacheName = selectedCacheName.value) {
  if (!cacheName) return;
  selectedCacheName.value = cacheName;
  keysLoading.value = true;
  resetDetail();
  try {
    cacheKeys.value = await fetchCacheKeys(cacheName);
  } finally {
    keysLoading.value = false;
  }
}

function handleCacheNameClick(row: CacheNameItem) {
  void loadCacheKeys(row.cacheName);
}

async function loadCacheValue(cacheKey: string) {
  if (!selectedCacheName.value) return;
  selectedCacheKey.value = cacheKey;
  detailLoading.value = true;
  try {
    cacheDetail.value = await fetchCacheValue(
      selectedCacheName.value,
      cacheKey,
    );
  } finally {
    detailLoading.value = false;
  }
}

async function confirmClearName(item: CacheNameItem) {
  try {
    await openConfirm({
      title: "清理缓存名称",
      message: `确认清理缓存“${displayCacheName(item.cacheName)}”下的全部键吗？`,
      type: "danger",
      confirmText: "清理",
      cancelText: "取消",
    });
    actionLoading.value = true;
    await clearCacheName(item.cacheName);
    BaseToast.success(`缓存“${displayCacheName(item.cacheName)}”已清理`);
    if (selectedCacheName.value === item.cacheName) {
      cacheKeys.value = [];
      resetDetail();
    }
    await loadCacheNames();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
  } finally {
    actionLoading.value = false;
  }
}

async function confirmClearKey(cacheKey: string) {
  try {
    await openConfirm({
      title: "清理缓存键",
      message: `确认清理缓存键“${displayCacheKey(cacheKey)}”吗？`,
      type: "danger",
      confirmText: "清理",
      cancelText: "取消",
    });
    actionLoading.value = true;
    await clearCacheKey(cacheKey);
    BaseToast.success("缓存键已清理");
    await loadCacheKeys();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
  } finally {
    actionLoading.value = false;
  }
}

async function confirmClearAll() {
  try {
    await openConfirm({
      title: "清理全部缓存",
      message: "确认清理全部缓存吗？该操作会影响当前系统中的所有缓存数据。",
      type: "danger",
      confirmText: "清理全部",
      cancelText: "取消",
    });
    actionLoading.value = true;
    await clearAllCaches();
    BaseToast.success("全部缓存已清理");
    selectedCacheName.value = "";
    cacheKeys.value = [];
    resetDetail();
    await loadCacheNames();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
  } finally {
    actionLoading.value = false;
  }
}

onMounted(loadCacheNames);
</script>

<template>
  <PageContainer
    title="缓存列表"
    description="按缓存名称和键查看或清理 Redis 缓存内容"
  >
    <div class="cache-browser">
      <section class="cache-pane">
        <header class="cache-pane__header">
          <h2>缓存名称</h2>
          <el-tooltip content="刷新缓存名称" placement="top">
            <el-button
              circle
              :icon="Refresh"
              :loading="namesLoading"
              aria-label="刷新缓存名称"
              @click="loadCacheNames"
            />
          </el-tooltip>
        </header>
        <el-table
          v-loading="namesLoading"
          :data="cacheNames"
          row-key="cacheName"
          highlight-current-row
          height="100%"
          @row-click="handleCacheNameClick"
        >
          <el-table-column type="index" label="序号" width="64" />
          <el-table-column
            label="缓存名称"
            min-width="150"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              displayCacheName(row.cacheName)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="remark"
            label="备注"
            min-width="120"
            show-overflow-tooltip
          />
          <el-table-column label="操作" width="64" fixed="right">
            <template #default="{ row }">
              <el-tooltip content="清理该缓存" placement="top">
                <el-button
                  circle
                  type="danger"
                  :icon="Delete"
                  aria-label="清理该缓存"
                  @click.stop="confirmClearName(row)"
                />
              </el-tooltip>
            </template>
          </el-table-column>
          <template #empty>暂无缓存名称</template>
        </el-table>
      </section>

      <section class="cache-pane">
        <header class="cache-pane__header">
          <h2>键名列表</h2>
          <el-tooltip content="刷新缓存键" placement="top">
            <el-button
              circle
              :icon="Refresh"
              :loading="keysLoading"
              :disabled="!selectedCacheName"
              aria-label="刷新缓存键"
              @click="loadCacheKeys()"
            />
          </el-tooltip>
        </header>
        <el-table
          v-loading="keysLoading"
          :data="cacheKeys"
          highlight-current-row
          height="100%"
          @row-click="loadCacheValue"
        >
          <el-table-column type="index" label="序号" width="64" />
          <el-table-column
            label="缓存键名"
            min-width="200"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ displayCacheKey(row) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="64" fixed="right">
            <template #default="{ row }">
              <el-tooltip content="清理该缓存键" placement="top">
                <el-button
                  circle
                  type="danger"
                  :icon="Delete"
                  aria-label="清理该缓存键"
                  @click.stop="confirmClearKey(row)"
                />
              </el-tooltip>
            </template>
          </el-table-column>
          <template #empty>{{
            selectedCacheName ? "暂无缓存键" : "请先选择缓存名称"
          }}</template>
        </el-table>
      </section>

      <section class="cache-pane cache-pane--detail">
        <header class="cache-pane__header">
          <h2>缓存内容</h2>
          <PermissionButton
            permission="monitor:cache:list"
            variant="danger"
            type="danger"
            plain
            :icon="WarningFilled"
            :loading="actionLoading"
            @click="confirmClearAll"
          >
            清理全部
          </PermissionButton>
        </header>
        <div v-loading="detailLoading" class="cache-detail">
          <el-form label-position="top">
            <el-form-item label="缓存名称">
              <el-input
                :model-value="cacheDetail.cacheName || selectedCacheName"
                readonly
              />
            </el-form-item>
            <el-form-item label="缓存键名">
              <el-input
                :model-value="cacheDetail.cacheKey || selectedCacheKey"
                readonly
              />
            </el-form-item>
            <el-form-item label="缓存内容">
              <el-input
                :model-value="formattedCacheValue"
                type="textarea"
                :rows="12"
                readonly
              />
            </el-form-item>
          </el-form>
        </div>
      </section>
    </div>

    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :loading="actionLoading"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.cache-browser {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(300px, 1fr) minmax(
      340px,
      1.1fr
    );
  gap: var(--bq-space-section);
  min-height: 600px;
  height: calc(100vh - 180px);
  overflow: visible;
}

.cache-pane {
  display: grid;
  grid-template-rows: 54px minmax(0, 1fr);
  min-width: 0;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-surface);
  overflow: hidden;
}

.cache-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  background: var(--bq-color-surface-muted);
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.cache-pane__header h2 {
  margin: 0;
  font-size: 15px;
}

.cache-detail {
  padding: 16px;
  overflow: auto;
}

@media (max-width: 1100px) {
  .cache-browser {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    height: auto;
    min-height: 0;
  }

  .cache-pane {
    height: 520px;
  }

  .cache-pane--detail {
    grid-column: 1 / -1;
    height: auto;
  }
}

@media (max-width: 700px) {
  .cache-browser {
    grid-template-columns: 1fr;
  }

  .cache-pane--detail {
    grid-column: auto;
  }
}
</style>
