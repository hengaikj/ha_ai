<script setup lang="ts">
import { reactive, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { CirclePlus, Download, RefreshRight } from "@element-plus/icons-vue";
import {
  createPlatformDictType,
  deletePlatformDictType,
  deletePlatformDictTypes,
  exportPlatformDictTypes,
  fetchPlatformDictTypeDetail,
  fetchPlatformDictTypesPage,
  refreshPlatformDictCache,
  updatePlatformDictType,
} from "@/api/platform-system";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import DictTag from "@/components/base/DictTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import { ApiBusinessError } from "@/api/http";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { resolvePageTotal } from "@/utils/pagination";
import { toDateTimeRangeParams } from "@/utils/date-range";
import type {
  PlatformDictTypeDetail,
  PlatformDictTypeQuery,
  PlatformStatus,
} from "@/types/platform-system";

interface DictTypeQueryState {
  dictTypeCode: string;
  dictTypeName: string;
  status: PlatformStatus | "";
  createdAtRange: [string, string] | [] | null;
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

interface DictTypeFormState {
  id?: number;
  dictTypeCode: string;
  dictTypeName: string;
  status: PlatformStatus;
  remark: string;
}

const emptyTypeForm = (): DictTypeFormState => ({
  dictTypeCode: "",
  dictTypeName: "",
  status: "ENABLED",
  remark: "",
});

const dictStatusOptions = [
  { label: "正常", value: "ENABLED", type: "success" as const },
  { label: "停用", value: "DISABLED", type: "info" as const },
];

const exporting = ref(false);
const refreshing = ref(false);
const selectedTypes = ref<PlatformDictTypeDetail[]>([]);
const saving = ref(false);
const dialogVisible = ref(false);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const query = reactive<DictTypeQueryState>({
  dictTypeCode: "",
  dictTypeName: "",
  status: "",
  createdAtRange: [],
});
const form = reactive<DictTypeFormState>(emptyTypeForm());
const router = useRouter();
const queryTableRef = ref<QueryTableExpose | null>(null);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const editing = computed(() => Boolean(form.id));
const dialogTitle = computed(() =>
  editing.value ? "编辑字典类型" : "新增字典类型",
);

async function queryDictTypes(pageSize: number, pageNo: number) {
  error.value = null;
  try {
    const response = await fetchPlatformDictTypesPage(
      buildQueryParams(pageSize, pageNo),
    );
    return {
      total: resolvePageTotal(response, pageNo, pageSize),
      list: response.records,
      pageNo: response.pageNo,
      pageSize: response.pageSize,
    };
  } catch (unknownError) {
    const normalizedError = normalizeError(unknownError);
    error.value = normalizedError;
    throw new Error(normalizedError.message, { cause: unknownError });
  }
}

async function reloadDictTypes() {
  await queryTableRef.value?.reload();
}

function openCreateDialog() {
  delete form.id;
  Object.assign(form, emptyTypeForm());
  dialogVisible.value = true;
}

async function openEditDialog(row: PlatformDictTypeDetail) {
  error.value = null;
  const detail = await fetchPlatformDictTypeDetail(row.id).catch(
    (unknownError) => {
      error.value = normalizeError(unknownError);
      return null;
    },
  );
  if (!detail) {
    return;
  }
  Object.assign(form, {
    id: detail.id,
    dictTypeCode: detail.dictTypeCode,
    dictTypeName: detail.dictTypeName,
    status: detail.status,
    remark: detail.remark ?? "",
  });
  dialogVisible.value = true;
}

async function saveType() {
  saving.value = true;
  error.value = null;
  try {
    if (editing.value && form.id) {
      await updatePlatformDictType(form.id, {
        dictTypeName: form.dictTypeName,
        status: form.status,
        remark: form.remark,
      });
    } else {
      await createPlatformDictType({
        dictTypeCode: form.dictTypeCode,
        dictTypeName: form.dictTypeName,
        status: form.status,
        remark: form.remark,
      });
      BaseToast.success("新增成功");
    }
    if (editing.value) {
      BaseToast.success("编辑成功");
    }
    dialogVisible.value = false;
    await reloadDictTypes();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    saving.value = false;
  }
}

async function deleteDictType(row: PlatformDictTypeDetail) {
  try {
    await openConfirm({
      title: "删除字典",
      message: `确认删除字典「${row.dictTypeName}」？删除后字典列表不再展示该记录，并会删除该类型下的字典项。`,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformDictType(row.id);
    BaseToast.success("字典已删除");
    await reloadDictTypes();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

function searchDictTypes() {
  queryTableRef.value?.search();
}

function resetDictTypeQuery() {
  query.dictTypeCode = "";
  query.dictTypeName = "";
  query.status = "";
  query.createdAtRange = [];
}

function buildQueryParams(
  pageSize: number,
  pageNo: number,
): PlatformDictTypeQuery {
  const dateRange = toDateTimeRangeParams(query.createdAtRange);
  const keyword = [query.dictTypeCode, query.dictTypeName]
    .map((item) => item.trim())
    .find(Boolean);
  return {
    pageNo,
    pageSize,
    keyword,
    dictTypeCode: query.dictTypeCode.trim() || undefined,
    dictTypeName: query.dictTypeName.trim() || undefined,
    status: query.status || undefined,
    ...dateRange,
  };
}

function handleSelectionChange(selection: PlatformDictTypeDetail[]) {
  selectedTypes.value = selection;
}

async function deleteSelectedDictTypes() {
  if (!selectedTypes.value.length) {
    BaseToast.warning("请先选择字典类型");
    return;
  }
  try {
    await openConfirm({
      title: "删除字典",
      message: `确认删除选中的 ${selectedTypes.value.length} 个字典类型？对应字典数据也将一并删除。`,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformDictTypes(selectedTypes.value.map((item) => item.id));
    selectedTypes.value = [];
    BaseToast.success("字典已删除");
    await reloadDictTypes();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") return;
    error.value = normalizeError(unknownError);
  }
}

async function exportDictTypes() {
  exporting.value = true;
  error.value = null;
  try {
    const blob = await exportPlatformDictTypes(buildQueryParams(5000, 1));
    downloadBlob(blob, "字典类型.xlsx");
    BaseToast.success("字典类型已导出");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    exporting.value = false;
  }
}

async function refreshDictCache() {
  refreshing.value = true;
  error.value = null;
  try {
    await refreshPlatformDictCache();
    BaseToast.success("字典缓存已刷新");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    refreshing.value = false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

async function openDictDetail(row: PlatformDictTypeDetail) {
  await router.push({
    name: "systemDictDetail",
    params: { dictTypeCode: row.dictTypeCode },
    query: { dictTypeName: row.dictTypeName },
  });
}

function normalizeError(unknownError: unknown) {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }

  return {
    code: "FRONTEND-SYSTEM-005",
    message: "系统管理字典数据加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    class="system-dict-page"
    title="字典管理"
    description="对接平台字典类型查询、新增、编辑接口。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryDictTypes"
      :error="error"
      row-key="id"
      fit-table-height
      empty-title="暂无字典类型"
      empty-description="当前没有可展示的字典类型。"
      @refresh="reloadDictTypes"
      @reset="resetDictTypeQuery"
      @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="字典类型">
            <el-input
              v-model="query.dictTypeCode"
              clearable
              maxlength="128"
              placeholder="请输入字典类型"
              data-test="dict-type-code-query"
              @keyup.enter="searchDictTypes"
            />
          </el-form-item>
          <el-form-item label="字典名称">
            <el-input
              v-model="query.dictTypeName"
              clearable
              maxlength="128"
              placeholder="请输入字典名称"
              data-test="dict-type-name-query"
              @keyup.enter="searchDictTypes"
            />
          </el-form-item>
          <el-form-item label="字典状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择字典状态"
              data-test="dict-type-status-query"
            >
              <el-option
                v-for="item in dictStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdAtRange"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #toolbar>
        <PermissionButton
          permission="system:dict:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          data-test="create-dict-type-button"
          @click="openCreateDialog"
        >
          新增
        </PermissionButton>
        <PermissionButton
          permission="system:dict:export"
          variant="secondary"
          plain
          type="warning"
          :icon="Download"
          :loading="exporting"
          data-test="export-dict-type-button"
          @click="exportDictTypes"
        >
          导出
        </PermissionButton>
        <PermissionButton
          permission="system:dict:refresh-cache"
          variant="secondary"
          plain
          type="success"
          :icon="RefreshRight"
          :loading="refreshing"
          data-test="refresh-dict-cache-button"
          @click="refreshDictCache"
        >
          刷新缓存
        </PermissionButton>
        <PermissionButton
            permission="system:dict:remove"
            variant="danger"
            type="danger"
            plain
            data-test="delete-selected-dict-types-button"
            @click="deleteSelectedDictTypes"
        >
          删除
        </PermissionButton>
      </template>
      <el-table-column type="selection" width="55" />
      <el-table-column label="序号" type="index" width="60" />
      <el-table-column prop="dictTypeName" label="字典名称" min-width="180" />
      <el-table-column prop="dictTypeCode" label="字典类型" min-width="180">
        <template #default="{ row }">
          <PermissionButton
            link
            type="primary"
            :data-test="`open-dict-detail-${row.id}`"
            @click="openDictDetail(row)"
          >
            {{ row.dictTypeCode }}
          </PermissionButton>
        </template>
      </el-table-column>
      <el-table-column label="字典状态" width="120">
        <template #default="{ row }">
          <DictTag :value="row.status" :options="dictStatusOptions" />
        </template>
      </el-table-column>
      <el-table-column
        prop="remark"
        label="备注"
        min-width="180"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row.remark || "--" }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          <BaseDateTime :value="row.createdAt || null" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right" align="center">
        <template #default="{ row }">
            <PermissionButton
              permission="system:dict:edit"
              link
              :data-test="`edit-dict-type-${row.id}`"
              @click="openEditDialog(row)"
            >
              编辑
            </PermissionButton>
            <PermissionButton
              permission="system:dict:remove"
              link
              :data-test="`delete-dict-type-${row.id}`"
              @click="deleteDictType(row)"
            >
              删除
            </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="520px"
      :loading="saving"
      confirm-text="确定"
      compact
      :confirm-button-props="{ 'data-test': 'dict-type-save-button' }"
      @confirm="saveType"
    >
      <TraceErrorAlert
        v-if="error"
        :code="error.code"
        :message="error.message"
        :trace-id="error.traceId"
      />
      <el-form :model="form" label-position="top">
        <el-form-item label="字典名称" required>
          <el-input
              v-model="form.dictTypeName"
              data-test="dict-type-name-input"
              maxlength="128"
          />
        </el-form-item>
        <el-form-item label="字典类型" required>
          <el-input
            v-model="form.dictTypeCode"
            data-test="dict-type-code-input"
            :disabled="editing"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item label="字典状态">
          <el-radio-group v-model="form.status">
            <el-radio
              v-for="item in dictStatusOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            data-test="dict-type-remark-input"
            type="textarea"
            maxlength="500"
          />
        </el-form-item>
      </el-form>
    </BaseFormDialog>

    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.system-dict-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: calc(100vh - var(--bq-header-height) - var(--bq-tags-height) - 40px);
  min-height: 0;
  overflow: hidden;
}

.system-dict-page :deep(.page-container__body) {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.system-dict-page :deep(.query-table) {
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  height: 100%;
  min-height: 0;
}

.system-dict-page :deep(.query-table__table) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.system-dict-page :deep(.base-data-table),
.system-dict-page :deep(.base-data-table > .el-table) {
  height: 100%;
  min-height: 0;
}
</style>
