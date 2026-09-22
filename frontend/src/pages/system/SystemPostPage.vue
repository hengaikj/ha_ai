<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { CirclePlus, Download } from "@element-plus/icons-vue";
import {
  createPlatformPost,
  deletePlatformPosts,
  disablePlatformPost,
  enablePlatformPost,
  exportPlatformPosts,
  fetchPlatformPostDetail,
  fetchPlatformPostsPage,
  updatePlatformPost,
} from "@/api/platform-system";
import { ApiBusinessError } from "@/api/http";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { toDateTimeRangeParams } from "@/utils/date-range";
import { resolvePageTotal } from "@/utils/pagination";
import type {
  PlatformPostItem,
  PlatformPostQuery,
  PlatformStatus,
} from "@/types/platform-system";

interface PostQueryState {
  postCode: string;
  postName: string;
  status: PlatformStatus | "";
  createdAtRange: [string, string] | [] | null;
}

interface PostFormState {
  id?: number;
  postCode: string;
  postName: string;
  postSort: number | string | undefined;
  status: PlatformStatus;
  remark: string;
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

const emptyPostForm = (): PostFormState => ({
  postCode: "",
  postName: "",
  postSort: 0,
  status: "ENABLED",
  remark: "",
});

const query = reactive<PostQueryState>({
  postCode: "",
  postName: "",
  status: "",
  createdAtRange: [],
});
const form = reactive<PostFormState>(emptyPostForm());
const selectedPosts = ref<PlatformPostItem[]>([]);
const saving = ref(false);
const exporting = ref(false);
const formDialogVisible = ref(false);
const formDialogMode = ref<"create" | "edit">("create");
const queryTableRef = ref<QueryTableExpose | null>(null);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const editing = computed(() => formDialogMode.value === "edit");
const formDialogTitle = computed(() =>
  editing.value ? "编辑岗位" : "新增岗位",
);

async function queryPosts(pageSize: number, pageNo: number) {
  error.value = null;
  try {
    const response = await fetchPlatformPostsPage(
      buildPostQueryParams(pageSize, pageNo),
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

function buildPostQueryParams(
  pageSize: number,
  pageNo: number,
): PlatformPostQuery {
  const dateRange = toDateTimeRangeParams(query.createdAtRange);
  return {
    pageNo,
    pageSize,
    postCode: query.postCode.trim() || undefined,
    postName: query.postName.trim() || undefined,
    status: query.status || undefined,
    ...dateRange,
  };
}

function searchPosts() {
  queryTableRef.value?.search();
}

async function reloadPosts() {
  await queryTableRef.value?.reload();
}

function resetQuery() {
  query.postCode = "";
  query.postName = "";
  query.status = "";
  query.createdAtRange = [];
}

function handleSelectionChange(selection: PlatformPostItem[]) {
  selectedPosts.value = selection;
}

function openCreateDialog() {
  formDialogMode.value = "create";
  delete form.id;
  Object.assign(form, emptyPostForm());
  formDialogVisible.value = true;
}

async function openEditDialog(post: PlatformPostItem) {
  error.value = null;
  const detail = await fetchPlatformPostDetail(post.id).catch(
    (unknownError) => {
      error.value = normalizeError(unknownError);
      return null;
    },
  );
  if (!detail) {
    return;
  }
  formDialogMode.value = "edit";
  Object.assign(form, {
    id: detail.id,
    postCode: detail.postCode,
    postName: detail.postName,
    postSort: detail.postSort ?? 0,
    status: detail.status,
    remark: detail.remark ?? "",
  });
  formDialogVisible.value = true;
}

async function savePost() {
  saving.value = true;
  error.value = null;
  try {
    if (editing.value && form.id) {
      await updatePlatformPost(form.id, {
        postName: form.postName,
        postSort: toOptionalNumber(form.postSort),
        status: form.status,
        remark: form.remark,
      });
      BaseToast.success("岗位已编辑");
    } else {
      await createPlatformPost({
        postCode: form.postCode,
        postName: form.postName,
        postSort: toOptionalNumber(form.postSort),
        status: form.status,
        remark: form.remark,
      });
      BaseToast.success("岗位已新增");
    }
    formDialogVisible.value = false;
    await reloadPosts();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    saving.value = false;
  }
}

async function deletePost(post: PlatformPostItem) {
  await confirmDelete(
    [post.id],
    `确认删除岗位「${post.postName}」？删除后岗位列表不再展示该记录。`,
  );
}

async function deleteSelectedPosts() {
  if (!selectedPosts.value.length) {
    BaseToast.warning("请先选择岗位");
    return;
  }
  await confirmDelete(
    selectedPosts.value.map((post) => post.id),
    `确认删除选中的 ${selectedPosts.value.length} 个岗位？删除后岗位列表不再展示这些记录。`,
  );
}

async function confirmDelete(postIds: number[], message: string) {
  try {
    await openConfirm({
      title: "删除岗位",
      message,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformPosts(postIds);
    BaseToast.success("岗位已删除");
    await reloadPosts();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

async function togglePostStatus(post: PlatformPostItem) {
  error.value = null;
  try {
    if (post.status === "ENABLED") {
      await disablePlatformPost(post.id);
      BaseToast.success("岗位已停用");
    } else {
      await enablePlatformPost(post.id);
      BaseToast.success("岗位已启用");
    }
    await reloadPosts();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

async function exportPosts() {
  exporting.value = true;
  error.value = null;
  try {
    const params = buildPostQueryParams(5000, 1);
    if (selectedPosts.value.length === 1) {
      params.postId = selectedPosts.value[0].id;
    }
    const blob = await exportPlatformPosts(params);
    downloadBlob(blob, "岗位数据.xlsx");
    BaseToast.success("岗位导出已开始下载");
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
    code: "FRONTEND-SYSTEM-POST-001",
    message: "岗位管理数据加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    title="岗位管理"
    description="配置系统用户可绑定的岗位和显示顺序。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryPosts"
      row-key="id"
      fit-table-height
      empty-title="暂无匹配岗位"
      empty-description="当前筛选条件下没有可展示的岗位数据。"
      @reset="resetQuery"
      @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="岗位编码">
            <el-input
              v-model="query.postCode"
              clearable
              maxlength="64"
              placeholder="请输入岗位编码"
              data-test="post-search-code"
              @keyup.enter="searchPosts"
            />
          </el-form-item>
          <el-form-item label="岗位名称">
            <el-input
              v-model="query.postName"
              clearable
              maxlength="128"
              placeholder="请输入岗位名称"
              data-test="post-search-name"
              @keyup.enter="searchPosts"
            />
          </el-form-item>
          <el-form-item label="岗位状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择岗位状态"
              data-test="post-search-status"
            >
              <el-option label="启用" value="ENABLED" />
              <el-option label="停用" value="DISABLED" />
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
          permission="system:post:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          data-test="create-post-button"
          @click="openCreateDialog"
        >
          新增
        </PermissionButton>
        <PermissionButton
          :permission="['system:post:export']"
          variant="secondary"
          plain
          type="warning"
          :icon="Download"
          :loading="exporting"
          data-test="export-post-button"
          @click="exportPosts"
        >
          导出
        </PermissionButton>
        <PermissionButton
            permission="system:post:remove"
            variant="danger"
            type="danger"
            plain
            data-test="delete-selected-post-button"
            @click="deleteSelectedPosts"
        >
          删除
        </PermissionButton>
      </template>

      <el-table-column type="selection" width="55" />
      <el-table-column label="序号" type="index" width="60" />
      <el-table-column prop="postCode" label="岗位编码" min-width="160" />
      <el-table-column prop="postName" label="岗位名称" min-width="180" />
      <el-table-column prop="postSort" label="岗位排序" width="120" />
      <el-table-column label="岗位状态" width="120">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 'ENABLED'"
            @change="togglePostStatus(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          <BaseDateTime :value="row.createdAt || null" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right" align="center">
        <template #default="{ row }">
            <PermissionButton
              permission="system:post:edit"
              link
              :data-test="`edit-post-${row.id}`"
              @click="openEditDialog(row)"
            >
              编辑
            </PermissionButton>
            <PermissionButton
              permission="system:post:remove"
              link
              :data-test="`delete-post-${row.id}`"
              @click="deletePost(row)"
            >
              删除
            </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="formDialogVisible"
      :title="formDialogTitle"
      width="620px"
      :loading="saving"
      confirm-text="确定"
      compact
      :confirm-button-props="{ 'data-test': 'post-save-button' }"
      @confirm="savePost"
    >
      <el-form :model="form" label-position="top">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="岗位名称" required>
              <el-input
                  v-model="form.postName"
                  maxlength="128"
                  data-test="post-name-input"
              />
            </el-form-item>
            <el-form-item label="岗位排序">
              <el-input-number
                  v-model="form.postSort"
                  :min="0"
                  :max="9999"
                  controls-position="right"
                  data-test="post-sort-input"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="岗位编码" required>
              <el-input
                  v-model="form.postCode"
                  maxlength="64"
                  :disabled="editing"
                  data-test="post-code-input"
              />
            </el-form-item>

            <el-form-item label="岗位状态">
              <el-radio-group v-model="form.status">
                <el-radio value="ENABLED">启用</el-radio>
                <el-radio value="DISABLED">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                maxlength="200"
                show-word-limit
                data-test="post-remark-input"
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
