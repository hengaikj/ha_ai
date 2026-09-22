<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back, CirclePlus, Download } from "@element-plus/icons-vue";
import {
  createPlatformDictItem,
  deletePlatformDictItem,
  deletePlatformDictItems,
  exportPlatformDictItems,
  fetchPlatformDictItemDetail,
  fetchPlatformDictItemDetailsPage,
  updatePlatformDictItem,
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
import type {
  PlatformDictItemDetail,
  PlatformDictItemQuery,
  PlatformStatus,
} from "@/types/platform-system";

interface DictItemQueryState {
  dictItemCode: string;
  dictItemLabel: string;
  status: PlatformStatus | "";
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
  clearSelection?: () => void;
};

interface DictItemFormState {
  id?: number;
  dictItemCode: string;
  dictItemLabel: string;
  sortNo: number | undefined;
  defaulted: boolean;
  cssClass: string;
  listClass: string;
  status: PlatformStatus;
  remark: string;
}

const emptyItemForm = (): DictItemFormState => ({
  dictItemCode: "",
  dictItemLabel: "",
  sortNo: 0,
  defaulted: false,
  cssClass: "",
  listClass: "default",
  status: "ENABLED",
  remark: "",
});

const dictStyleOptions = [
  { label: "默认", value: "default" },
  { label: "主要", value: "primary" },
  { label: "成功", value: "success" },
  { label: "信息", value: "info" },
  { label: "警告", value: "warning" },
  { label: "危险", value: "danger" },
];

const dictStatusOptions = [
  { label: "正常", value: "ENABLED", type: "success" as const },
  { label: "停用", value: "DISABLED", type: "info" as const },
];

function dictStyleTagType(styleClass?: string) {
  if (
    styleClass === "primary" ||
    styleClass === "success" ||
    styleClass === "info" ||
    styleClass === "warning" ||
    styleClass === "danger"
  ) {
    return styleClass;
  }
  return undefined;
}

const saving = ref(false);
const exporting = ref(false);
const dialogVisible = ref(false);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const query = reactive<DictItemQueryState>({
  dictItemCode: "",
  dictItemLabel: "",
  status: "",
});
const form = reactive<DictItemFormState>(emptyItemForm());
const route = useRoute();
const router = useRouter();
const queryTableRef = ref<QueryTableExpose | null>(null);
const selectedRows = ref<PlatformDictItemDetail[]>([]);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const dictTypeCode = computed(() =>
  typeof route.params.dictTypeCode === "string"
    ? route.params.dictTypeCode
    : "",
);
const dictTypeName = computed(() =>
  typeof route.query.dictTypeName === "string"
    ? route.query.dictTypeName
    : dictTypeCode.value,
);
const editing = computed(() => Boolean(form.id));
const dialogTitle = computed(() =>
  editing.value ? "编辑字典项" : "新增字典项",
);

async function queryDictItems(pageSize: number, pageNo: number) {
  if (!dictTypeCode.value) {
    return {
      total: 0,
      list: [],
    };
  }
  error.value = null;
  try {
    const response = await fetchPlatformDictItemDetailsPage(
      dictTypeCode.value,
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

async function reloadDictItems() {
  await queryTableRef.value?.reload();
}

function openCreateDialog() {
  delete form.id;
  Object.assign(form, emptyItemForm());
  dialogVisible.value = true;
}

async function openEditDialog(row: PlatformDictItemDetail) {
  error.value = null;
  const detail = await fetchPlatformDictItemDetail(row.id).catch(
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
    dictItemCode: detail.dictItemCode,
    dictItemLabel: detail.dictItemLabel,
    sortNo: detail.sortNo,
    defaulted: detail.defaulted ?? false,
    cssClass: detail.cssClass ?? "",
    listClass: detail.listClass ?? detail.styleClass ?? "default",
    status: detail.status,
    remark: detail.remark ?? "",
  });
  dialogVisible.value = true;
}

async function saveItem() {
  if (!dictTypeCode.value) {
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    if (editing.value && form.id) {
      await updatePlatformDictItem(form.id, {
        dictItemLabel: form.dictItemLabel,
        sortNo: toOptionalNumber(form.sortNo),
        defaulted: form.defaulted,
        cssClass: form.cssClass,
        listClass: form.listClass,
        status: form.status,
        remark: form.remark,
      });
      BaseToast.success("字典项已编辑");
    } else {
      await createPlatformDictItem(dictTypeCode.value, {
        dictItemCode: form.dictItemCode,
        dictItemLabel: form.dictItemLabel,
        sortNo: toOptionalNumber(form.sortNo),
        defaulted: form.defaulted,
        cssClass: form.cssClass,
        listClass: form.listClass,
        status: form.status,
        remark: form.remark,
      });
      BaseToast.success("字典项已新增");
    }
    dialogVisible.value = false;
    queryTableRef.value?.search();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    saving.value = false;
  }
}

async function deleteDictItem(row: PlatformDictItemDetail) {
  try {
    await openConfirm({
      title: "删除字典项",
      message: `确认删除字典项「${row.dictItemLabel}」？删除后列表不再展示该记录。`,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformDictItem(row.id);
    BaseToast.success("字典项已删除");
    await reloadDictItems();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

function handleSelectionChange(selection: PlatformDictItemDetail[]) {
  selectedRows.value = selection;
}

async function deleteSelectedDictItems() {
  if (!selectedRows.value.length) {
    BaseToast.warning("请先选择要删除的字典项");
    return;
  }
  try {
    await openConfirm({
      title: "删除字典项",
      message: `确认删除选中的 ${selectedRows.value.length} 条字典项？删除后列表不再展示这些记录。`,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformDictItems(selectedRows.value.map((row) => row.id));
    BaseToast.success("字典项已删除");
    selectedRows.value = [];
    queryTableRef.value?.clearSelection?.();
    await reloadDictItems();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

async function exportDictItems() {
  if (!dictTypeCode.value) return;
  exporting.value = true;
  error.value = null;
  try {
    const blob = await exportPlatformDictItems(
      dictTypeCode.value,
      buildQueryParams(5000, 1),
    );
    downloadBlob(blob, `${dictTypeName.value || dictTypeCode.value}.xlsx`);
    BaseToast.success("字典数据已导出");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    exporting.value = false;
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

function searchDictItems() {
  queryTableRef.value?.search();
}

function resetDictItemQuery() {
  query.dictItemCode = "";
  query.dictItemLabel = "";
  query.status = "";
}

async function backToTypeList() {
  await router.push({ name: "systemDict" });
}

function buildQueryParams(
  pageSize: number,
  pageNo: number,
): PlatformDictItemQuery {
  const keyword = [query.dictItemCode, query.dictItemLabel]
    .map((item) => item.trim())
    .find(Boolean);
  return {
    pageNo,
    pageSize,
    keyword,
    dictItemCode: query.dictItemCode.trim() || undefined,
    dictItemLabel: query.dictItemLabel.trim() || undefined,
    status: query.status || undefined,
  };
}

function toOptionalNumber(
  value: number | string | undefined,
): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  return Number(value);
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
    message: "系统管理字典详情数据加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}

watch(
  () => route.params.dictTypeCode,
  () => {
    queryTableRef.value?.search();
  },
);
</script>

<template>
  <PageContainer
    class="system-dict-page"
    title="字典详情"
    :description="`查看并维护 ${dictTypeName} 的字典项。`"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        data-test="back-dict-types-button"
        @click="backToTypeList"
      >
        返回列表
      </PermissionButton>
    </template>

    <QueryTable
      ref="queryTableRef"
      :func="queryDictItems"
      :error="error"
      row-key="id"
      fit-table-height
      empty-title="暂无字典项"
      empty-description="当前字典类型下没有可展示的字典项。"
      @refresh="reloadDictItems"
      @reset="resetDictItemQuery"
      @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="字典标签">
            <el-input
              v-model="query.dictItemLabel"
              clearable
              maxlength="128"
              placeholder="请输入字典标签"
              data-test="dict-item-label-query"
              @keyup.enter="searchDictItems"
            />
          </el-form-item>
          <el-form-item label="字典项状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择字典项状态"
              data-test="dict-item-status-query"
            >
              <el-option label="正常" value="0" />
              <el-option label="停用" value="1" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <template #toolbar>
        <PermissionButton
        permission="system:dictDetail:add"
        variant="primary"
          type="primary"
          :icon="CirclePlus"
          data-test="create-dict-item-button"
          @click="openCreateDialog"
        >
          新增
        </PermissionButton>
        <PermissionButton
          permission="system:dictDetail:remove"
          variant="danger"
          type="danger"
          plain
          data-test="delete-selected-dict-items-button"
          @click="deleteSelectedDictItems"
        >
          删除
        </PermissionButton>
        <PermissionButton
          permission="system:dictDetail:export"
          variant="secondary"
          plain
          :icon="Download"
          :loading="exporting"
          data-test="export-dict-item-button"
          @click="exportDictItems"
          type="warning"
        >
          导出
        </PermissionButton>
      </template>
      <el-table-column type="selection" width="50" />
      <el-table-column label="字典编码" prop="dictCode" />
      <el-table-column label="字典标签" min-width="160">
        <template #default="{ row }">
          <span
            v-if="
              (!row.listClass || row.listClass === 'default') && !row.cssClass
            "
          >
            {{ row.dictItemLabel }}
          </span>
          <el-tag
            v-else
            :type="dictStyleTagType(row.listClass)"
            :class="row.cssClass"
            effect="light"
          >
            {{ row.dictItemLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="dictItemCode" label="字典键值" min-width="160" />
      <el-table-column prop="sortNo" label="显示排序" width="100" />
      <el-table-column label="字典项状态" width="120">
        <template #default="{ row }">
          <DictTag :value="row.status" :options="dictStatusOptions" />
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.remark || "--" }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          <BaseDateTime :value="row.createdAt || null" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right" align="center">
        <template #default="{ row }">
            <PermissionButton
              permission="system:dictDetail:edit"
              link
              :data-test="`edit-dict-item-${row.id}`"
              @click="openEditDialog(row)"
            >
              编辑
            </PermissionButton>
            <PermissionButton
              permission="system:dictDetail:remove"
              link
              :data-test="`delete-dict-item-${row.id}`"
              @click="deleteDictItem(row)"
            >
              删除
            </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="760px"
      :loading="saving"
      confirm-text="确定"
      compact
      :confirm-button-props="{ 'data-test': 'dict-item-save-button' }"
      @confirm="saveItem"
    >
      <TraceErrorAlert
        v-if="error"
        :code="error.code"
        :message="error.message"
        :trace-id="error.traceId"
      />
      <el-form :model="form" class="dict-item-form" label-position="top">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="字典类型">
              <el-input :model-value="dictTypeCode" disabled clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="字典标签" required>
              <el-input
                v-model="form.dictItemLabel"
                data-test="dict-item-label-input"
                maxlength="128"
                placeholder="请输入字典标签"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="字典键值" required>
              <el-input
                v-model="form.dictItemCode"
                data-test="dict-item-code-input"
                :disabled="editing"
                maxlength="128"
                placeholder="请输入字典键值"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="样式属性">
              <el-input
                v-model="form.cssClass"
                data-test="dict-item-css-class-input"
                maxlength="128"
                placeholder="请输入样式属性"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="显示排序">
              <el-input-number
                v-model="form.sortNo"
                controls-position="right"
                data-test="dict-item-sort-input"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="回显样式">
              <el-select
                v-model="form.listClass"
                data-test="dict-item-list-class-input"
                clearable
                placeholder="请选择回显样式"
              >
                <el-option
                  v-for="item in dictStyleOptions"
                  :key="item.value"
                  :label="`${item.label}(${item.value})`"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="字典项状态">
              <el-radio-group v-model="form.status">
                <el-radio value="0">正常</el-radio>
                <el-radio value="1">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                data-test="dict-item-remark-input"
                type="textarea"
                maxlength="500"
                placeholder="请输入备注"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :loading="confirmState.loading"
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

.dict-item-form :deep(.el-input-number),
.dict-item-form :deep(.el-select) {
  width: 100%;
}
</style>
