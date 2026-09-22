<script setup lang="ts">
import { resolveServerTotal } from "@/utils/pagination";
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowDown,
  DocumentAdd,
  Download,
  Lock,
  RefreshRight,
  Tickets,
  Unlock,
  Upload,
} from "@element-plus/icons-vue";
import {
  confirmInitiationFeishu,
  exportInitiation,
  getInitiationFeishuDocuments,
  importInitiation,
  lixiangList,
  previewInitiationFeishu,
  updateImportLock,
} from "@/api/budget";
import { ApiBusinessError } from "@/api/http";
import { useAuthStore } from "@/stores/auth";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { downloadLocalTemplate } from "@/utils/download-template";
import BudgetGateReviewAttachmentDialog from "@/pages/budget/clique/BudgetGateReviewAttachmentDialog.vue";
import type { InputInstance, UploadFile } from "element-plus";
import type { BackendId } from "@/types/budget";

type QueryTableExpose = {
  search: () => void;
  reload: () => Promise<void>;
};

type LiXiangRow = Record<string, unknown> & {
  id?: number | string;
  vehicleModel?: { modelName?: string };
  valveName?: string;
  valvePoint?: string;
  majorVersion?: number | string;
  createTime?: string;
  budgetLock?: number | string;
  evaluateLock?: number | string;
  version?: number | string;
  feishuUrl?: string;
};

type FeishuMode = "NEW" | "REFRESH";

type FeishuPreviewResult = Record<string, unknown> & {
  status?: string;
  errorCount?: number;
  confirmable?: boolean;
  errors?: string[];
  warnings?: string[];
  previewId?: string;
  contentHash?: string;
};

type FeishuDocument = Record<string, unknown> & {
  id?: string | number;
};

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const queryTableRef = ref<QueryTableExpose | null>(null);
const attachmentDialogRef = ref<InstanceType<
  typeof BudgetGateReviewAttachmentDialog
> | null>(null);
const selectedRows = ref<LiXiangRow[]>([]);
const activeTaskId = ref("");
const currentRows = ref<LiXiangRow[]>([]);
const importDialogVisible = ref(false);
const importLoading = ref(false);
const feishuDialogVisible = ref(false);
const feishuLink = ref("");
const feishuPreviewLoading = ref(false);
const feishuRefreshLoading = ref(false);
const feishuConfirmLoading = ref(false);
const feishuConfirmKey = ref("");
const feishuMode = ref<FeishuMode>("NEW");
const feishuLinkInputRef = ref<InputInstance | null>(null);
const latestExportTaskId = ref<string | number>();
const isNarrowViewport = ref(false);
const lockingRowId = ref<string | null>(null);
let narrowViewportMedia: MediaQueryList | undefined;
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);

const query = reactive({
  modelName: "",
  createBy: "",
  createdAtRange: [] as string[] | null,
});

const PAGE_TITLE = "立项评审";
const PAGE_DESCRIPTION = "查看和管理立项评审项目、版本、锁定状态和附件。";

function syncNarrowViewport() {
  isNarrowViewport.value = narrowViewportMedia?.matches ?? false;
}

onMounted(() => {
  narrowViewportMedia = window.matchMedia("(max-width: 768px)");
  syncNarrowViewport();
  narrowViewportMedia.addEventListener?.("change", syncNarrowViewport);
});

onBeforeUnmount(() => {
  narrowViewportMedia?.removeEventListener?.("change", syncNarrowViewport);
});

function queryRows(pageSize: number, pageNo: number) {
  error.value = null;
  return lixiangList({
    modelName: query.modelName.trim() || undefined,
    createBy: query.createBy.trim() || undefined,
    params: {
      beginTime: query.createdAtRange?.[0]
        ? `${query.createdAtRange[0]} 00:00:00`
        : null,
      endTime: query.createdAtRange?.[1]
        ? `${query.createdAtRange[1]} 23:59:59`
        : null,
    },
    pageNum: pageNo,
    pageSize,
  })
    .then((response) => {
      const rows = (response.rows ?? []) as LiXiangRow[];
      currentRows.value = rows;
      return {
        total: resolveServerTotal(response.total),
        list: rows,
        pageNo,
        pageSize,
      };
    })
    .catch((unknownError: unknown) => {
      const normalizedError = normalizeError(unknownError);
      error.value = normalizedError;
      throw new Error(normalizedError.message, { cause: unknownError });
    });
}

function resetQuery() {
  query.modelName = "";
  query.createBy = "";
  query.createdAtRange = [];
}

function searchRows() {
  queryTableRef.value?.search();
}

function handleSelectionChange(selection: LiXiangRow[]) {
  selectedRows.value = selection;
}

function getProjectName(row: LiXiangRow) {
  return String(row.vehicleModel?.modelName ?? "");
}

function getSelectedOrActiveRows(row?: LiXiangRow) {
  return row ? [row] : selectedRows.value;
}

function openDetail(row: LiXiangRow) {
  void router.push({
    name: "budgetInitiationDetailPage",
    query: {
      projectId: String(row.id ?? ""),
      projectName: getProjectName(row),
      modelName: getProjectName(row),
      returnPath: route.fullPath,
      valveName: String(row.valveName ?? row.valvePoint ?? ""),
      budgetLock: isLocked(row.budgetLock) ? "1" : "0",
      evaluationLock: isLocked(row.evaluateLock) ? "1" : "0",
    },
  });
}

function openReportPage(row?: LiXiangRow) {
  const rows = getSelectedOrActiveRows(row);
  if (rows.length !== 1) {
    BaseToast.warning("请选择一个项目");
    return;
  }
  const target = rows[0];
  void router.push({
    path: "/budget/wbs/createreportforms",
      query: {
        id: String(target.id ?? ""),
        modelName: getProjectName(target),
        returnPath: route.fullPath,
      },
  });
}

function openVersionHistory(row: LiXiangRow) {
  void router.push({
    name: "budgetInitiationVersionHistory",
    query: {
      projectId: String(row.id ?? ""),
      versionId: String(row.id ?? ""),
      projectName: getProjectName(row),
      returnPath: route.fullPath,
      modelName: getProjectName(row),
    },
  });
}

function handleLockCommand(row: LiXiangRow, command: unknown) {
  const action = String(command);
  if (action === "budget") {
    void updateBudgetLock(row);
    return;
  }
  if (action === "evaluation") {
    void updateEvaluationLock(row);
  }
}

function getRowId(row: LiXiangRow) {
  return row.id == null ? null : String(row.id);
}

function isLocking(row: LiXiangRow) {
  const rowId = getRowId(row);
  return rowId !== null && lockingRowId.value === rowId;
}

function canBudgetLock(row: LiXiangRow) {
  const lock = Number(row.budgetLock ?? 0);
  const permission =
    lock === 0 ? "system:project:budget:lock" : "system:project:budget:unlock";
  return authStore.hasPermission(permission);
}

function canEvaluateLock(row: LiXiangRow) {
  const lock = Number(row.evaluateLock ?? 0);
  const permission =
    lock === 0
      ? "system:project:evaluate:lock"
      : "system:project:evaluate:unlock";
  return authStore.hasPermission(permission);
}

async function updateBudgetLock(row: LiXiangRow) {
  const nextLocked = isLocked(row.budgetLock) ? 0 : 1;
  const action = nextLocked === 1 ? "预算锁定" : "预算解锁";
  lockingRowId.value = getRowId(row);
  try {
    const confirmed = await confirmLockAction(action, row);
    if (!confirmed) return;
    await updateLockState({
      data: {
        id: row.id,
        version: Number(row.version ?? 0),
        budgetLock: nextLocked,
      },
      successMessage: `${action}成功`,
      errorMessage: `${action}失败`,
    });
  } finally {
    lockingRowId.value = null;
  }
}

async function updateEvaluationLock(row: LiXiangRow) {
  const nextLocked = isLocked(row.evaluateLock) ? 0 : 1;
  const action = nextLocked === 1 ? "评估锁定" : "评估解锁";
  lockingRowId.value = getRowId(row);
  try {
    const confirmed = await confirmLockAction(action, row);
    if (!confirmed) return;
    await updateLockState({
      data: {
        id: row.id,
        version: Number(row.version ?? 0),
        evaluateLock: nextLocked,
      },
      successMessage: `${action}成功`,
      errorMessage: `${action}失败`,
    });
  } finally {
    lockingRowId.value = null;
  }
}

async function confirmLockAction(action: string, row: LiXiangRow) {
  try {
    await openConfirm({
      title: "提示",
      message: `确定要${action}${getProjectName(row)}吗？`,
      type: "warning",
      confirmText: "确定",
      cancelText: "取消",
    });
    return true;
  } catch {
    return false;
  }
}

async function updateLockState(payload: {
  data: Record<string, unknown>;
  successMessage: string;
  errorMessage: string;
}) {
  try {
    await updateImportLock(payload.data);
    BaseToast.success(payload.successMessage);
    await queryTableRef.value?.reload();
  } catch (unknownError) {
    handleActionError(unknownError, payload.errorMessage);
  }
}

async function exportRows(row?: LiXiangRow) {
  const rows = getSelectedOrActiveRows(row);
  if (rows.length !== 1) {
    BaseToast.warning("请选择一个项目");
    return;
  }
  try {
    const currentRow = rows[0];
    const task = await exportInitiation({
      projectId: currentRow.id as BackendId,
    });
    latestExportTaskId.value = task.taskId;
    BaseToast.success(`立项导出任务已创建：${task.taskNo || task.taskId}`);
  } catch (unknownError) {
    handleActionError(unknownError, "立项评审导出失败");
  }
}

function prepareImport() {
  importDialogVisible.value = true;
}

function openFeishuImportDialog() {
  resetFeishuPreviewState();
  feishuMode.value = "NEW";
  feishuLink.value = "";
  feishuDialogVisible.value = true;
  void nextTick(() => {
    feishuLinkInputRef.value?.focus();
  });
}

function closeFeishuImportDialog() {
  feishuDialogVisible.value = false;
  resetFeishuPreviewState();
  feishuLink.value = "";
}

function getSelectedProjectRow() {
  if (selectedRows.value.length !== 1) {
    BaseToast.error("请选择一个项目");
    return null;
  }
  return selectedRows.value[0];
}

function createFeishuIdempotencyKey() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  const random = Math.random().toString(16).slice(2);
  return `feishu-${Date.now()}-${random}`;
}

function resetFeishuPreviewState() {
  feishuPreviewLoading.value = false;
  feishuRefreshLoading.value = false;
  feishuConfirmLoading.value = false;
  feishuConfirmKey.value = "";
}

async function handleFeishuImportConfirm() {
  if (!feishuLink.value) {
    BaseToast.warning("请输入");
    return;
  }
  await previewFeishuImport({
    mode: "NEW",
    sourceUrl: feishuLink.value,
  });
}

async function handleFeishuRefresh() {
  const row = getSelectedProjectRow();
  if (!row) return;
  if (isLocked(row.budgetLock) || isLocked(row.evaluateLock)) {
    BaseToast.warning("当前项目已锁定，请解锁后重试");
    return;
  }
  try {
    await openConfirm({
      title: "提示",
      message: "是否确认刷新飞书文档？",
      type: "warning",
      confirmText: "确定",
      cancelText: "取消",
    });
  } catch {
    return;
  }
  feishuRefreshLoading.value = true;
  try {
    const result = await getInitiationFeishuDocuments({ projectId: row.id });
    const documents = Array.isArray(result)
      ? (result as FeishuDocument[])
      : (((result as { data?: FeishuDocument[] }).data ??
          []) as FeishuDocument[]);
    if (!documents.length) {
      BaseToast.warning("当前项目暂无已绑定飞书文档");
      return;
    }
    resetFeishuPreviewState();
    feishuMode.value = "REFRESH";
    await previewFeishuImport({
      mode: "REFRESH",
      documentId: documents[0].id,
      projectId: row.id,
    });
  } finally {
    feishuRefreshLoading.value = false;
  }
}

async function previewFeishuImport(payload: Record<string, unknown>) {
  feishuPreviewLoading.value = true;
  try {
    const preview = (await previewInitiationFeishu(
      payload,
    )) as FeishuPreviewResult;
    await handleFeishuPreviewResult(preview);
  } catch (error) {
    feishuConfirmKey.value = createFeishuIdempotencyKey();
    throw error;
  } finally {
    feishuPreviewLoading.value = false;
  }
}

async function handleFeishuPreviewResult(preview: FeishuPreviewResult | null) {
  if (!preview) return;
  if (preview.status === "NO_CHANGE") {
    BaseToast.success("飞书文档内容无变化");
    closeFeishuImportDialog();
    return;
  }
  if ((preview.errorCount ?? 0) > 0 || preview.confirmable === false) {
    feishuConfirmKey.value = createFeishuIdempotencyKey();
    showFeishuPreviewMessage(preview);
    return;
  }
  await confirmFeishuImport(preview);
}

function showFeishuPreviewMessage(preview: FeishuPreviewResult) {
  const message =
    preview.errors?.[0] ||
    preview.warnings?.[0] ||
    "飞书预览未通过，请检查文档内容";
  BaseToast.warning(message);
}

async function confirmFeishuImport(preview: FeishuPreviewResult) {
  if (!preview.previewId || !preview.contentHash) {
    BaseToast.warning("预览信息已失效，请重新预览");
    resetFeishuPreviewState();
    return;
  }
  feishuConfirmLoading.value = true;
  feishuConfirmKey.value =
    feishuConfirmKey.value || createFeishuIdempotencyKey();
  try {
    await confirmInitiationFeishu(
      {
        previewId: preview.previewId,
        contentHash: preview.contentHash,
      },
      feishuConfirmKey.value,
    );
    BaseToast.success("飞书文档导入成功");
    closeFeishuImportDialog();
    await queryTableRef.value?.reload();
  } catch (error) {
    feishuConfirmKey.value = createFeishuIdempotencyKey();
    throw error;
  } finally {
    feishuConfirmLoading.value = false;
  }
}

async function handleImport(file: UploadFile) {
  const rawFile = file.raw;
  if (!rawFile) {
    BaseToast.warning("请选择需要导入的文件");
    return;
  }
  importLoading.value = true;
  try {
    const formData = new FormData();
    formData.append("file", rawFile);
    const task = await importInitiation(formData);
    activeTaskId.value = task.taskId;
    importDialogVisible.value = false;
    BaseToast.success(`立项导入任务已创建：${task.taskNo || task.taskId}`);
    await queryTableRef.value?.reload();
  } catch (unknownError) {
    handleActionError(unknownError, "立项导入失败");
  } finally {
    importLoading.value = false;
  }
}

function downloadImportTemplate() {
  downloadLocalTemplate("立项导入模板.xlsx");
}

function openAttachments(row: LiXiangRow) {
  attachmentDialogRef.value?.init(row);
}

function handleActionError(unknownError: unknown, fallbackMessage: string) {
  const normalizedError = normalizeError(unknownError, fallbackMessage);
  BaseToast.error(normalizedError.message);
  error.value = normalizedError;
}

function formatText(value?: string | number | null) {
  return value === undefined || value === null || value === ""
    ? "--"
    : String(value);
}

function isLocked(value?: string | number | null) {
  return Number(value) === 1;
}

function normalizeError(
  unknownError: unknown,
  fallbackMessage = "立项评审数据加载失败，请检查后端服务。",
) {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }
  return {
    code: "FRONTEND-BUDGET-INITIATION-001",
    message: fallbackMessage,
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer :title="PAGE_TITLE" :description="PAGE_DESCRIPTION">
    <TaskStatusPanel v-if="false" :task-id="latestExportTaskId" />
    <QueryTable
      ref="queryTableRef"
      :func="queryRows"
      row-key="id"
      fit-table-height
      :error="error"
      empty-title="暂无立项评审"
      empty-description="当前条件下没有可展示的立项评审数据"
      @reset="resetQuery"
      @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="项目代号">
            <el-input
              v-model="query.modelName"
              clearable
              placeholder="请输入项目代号"
              @keyup.enter="searchRows"
            />
          </el-form-item>
          <el-form-item label="创建人">
            <el-input
              v-model="query.createBy"
              clearable
              placeholder="请输入创建人"
              @keyup.enter="searchRows"
            />
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdAtRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          permission="system:project:comments:list"
          variant="primary"
          type="primary"
          plain
          :icon="Tickets"
          @click="openReportPage()"
        >
          生成报表
        </PermissionButton>
        <PermissionButton
          permission="system:project:initiation:import"
          variant="secondary"
          type="success"
          plain
          :icon="Upload"
          @click="prepareImport"
        >
          导入
        </PermissionButton>
        <PermissionButton
          permission="system:project:initiation:export"
          variant="secondary"
          type="warning"
          plain
          :icon="Download"
          @click="exportRows()"
        >
          导出
        </PermissionButton>
        <PermissionButton
          permission="system:project:feishu:import"
          variant="secondary"
          type="success"
          plain
          :icon="Upload"
          @click="openFeishuImportDialog"
        >
          飞书数据导入
        </PermissionButton>
        <PermissionButton
          v-if="false"
          permission="system:project:initiation:import"
          variant="secondary"
          type="primary"
          plain
          :icon="RefreshRight"
          :loading="feishuRefreshLoading"
          :disabled="feishuRefreshLoading"
          @click="handleFeishuRefresh"
        >
          刷新飞书文档
        </PermissionButton>
        <!--        <el-button plain @click="downloadImportTemplate">模板下载</el-button>-->
        <span v-if="selectedRows.length" class="budget-initiation__selection">
          已选择 {{ selectedRows.length }} 项
        </span>
      </template>

      <el-table-column
        type="selection"
        width="48"
        :fixed="isNarrowViewport ? false : 'left'"
      />
      <el-table-column
        v-if="!isNarrowViewport"
        type="index"
        label="序号"
        fixed="left"
        align="center"
      />
      <el-table-column label="项目代号" show-overflow-tooltip>
        <template #default="{ row }">
          <el-popover
            v-if="row.feishuUrl"
            placement="top-start"
            trigger="hover"
            width="auto"
          >
            <span class="feishu-url-copyable">{{ row.feishuUrl }}</span>
            <template #reference>
              <el-button link type="primary">
                {{ formatText(getProjectName(row)) }}
              </el-button>
            </template>
          </el-popover>
          <span v-else>{{ formatText(getProjectName(row)) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="创建人" show-overflow-tooltip>
        <template #default>--</template>
      </el-table-column>
      <el-table-column label="版本号">
        <template #default="{ row }">{{
          formatText(row.majorVersion)
        }}</template>
      </el-table-column>
      <el-table-column label="创建时间">
        <template #default="{ row }">
          <BaseDateTime :value="row.createTime || null" />
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        width="180"
        :fixed="isNarrowViewport ? false : 'right'"
        align="center"
      >
        <template #default="{ row }">
          <div
            class="bq-table-actions budget-initiation__row-actions"
            @click.stop
          >
            <PermissionButton
              permission="system:project:initiation:list"
              link
              type="primary"
              @click="openDetail(row)"
            >
              查看
            </PermissionButton>
            <!-- 迁移自旧版：system:project:status:edit -->
            <PermissionGuard permission="system:project:status:edit">
              <el-dropdown
                trigger="click"
                @command="handleLockCommand(row, $event)"
              >
                <PermissionButton
                  link
                  type="primary"
                  :loading="isLocking(row)"
                  :disabled="isLocking(row)"
                >
                  锁定
                  <el-icon class="budget-initiation__dropdown-icon"
                    ><ArrowDown
                  /></el-icon>
                </PermissionButton>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      command="budget"
                      :disabled="!canBudgetLock(row)"
                      :style="{
                        color:
                          isLocked(row.budgetLock) && canBudgetLock(row)
                            ? 'var(--bq-color-warning)'
                            : undefined,
                        borderBottom: '1px solid var(--bq-color-border)',
                      }"
                    >
                      <el-icon
                        :style="{
                          color:
                            isLocked(row.budgetLock) && canBudgetLock(row)
                              ? 'var(--bq-color-warning)'
                              : undefined,
                        }"
                      >
                        <Unlock v-if="isLocked(row.budgetLock)" />
                        <Lock v-else />
                      </el-icon>
                      <span
                        :style="{
                          color:
                            isLocked(row.budgetLock) && canBudgetLock(row)
                              ? 'var(--bq-color-warning)'
                              : undefined,
                        }"
                      >
                        {{ isLocked(row.budgetLock) ? "预算解锁" : "预算锁定" }}
                      </span>
                    </el-dropdown-item>
                    <el-dropdown-item
                      command="evaluation"
                      :disabled="!canEvaluateLock(row)"
                      :style="{
                        color:
                          isLocked(row.evaluateLock) && canEvaluateLock(row)
                            ? 'var(--bq-color-warning)'
                            : undefined,
                      }"
                    >
                      <el-icon
                        :style="{
                          color:
                            isLocked(row.evaluateLock) && canEvaluateLock(row)
                              ? 'var(--bq-color-warning)'
                              : undefined,
                        }"
                      >
                        <Unlock v-if="isLocked(row.evaluateLock)" />
                        <Lock v-else />
                      </el-icon>
                      <span
                        :style="{
                          color:
                            isLocked(row.evaluateLock) && canEvaluateLock(row)
                              ? 'var(--bq-color-warning)'
                              : undefined,
                        }"
                      >
                        {{
                          isLocked(row.evaluateLock) ? "评估解锁" : "评估锁定"
                        }}
                      </span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </PermissionGuard>
            <el-dropdown trigger="click">
              <PermissionButton link type="primary">
                更多
                <el-icon class="budget-initiation__dropdown-icon"
                  ><ArrowDown
                /></el-icon>
              </PermissionButton>
              <template #dropdown>
                <el-dropdown-menu>
                  <!-- 旧版未配置单独权限，保持无额外权限壳 -->
                  <el-dropdown-item @click="openAttachments(row)">
                    附件
                  </el-dropdown-item>
                  <el-dropdown-item @click="openVersionHistory(row)">
                    历史版本
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseImportDialog
      v-model="importDialogVisible"
      :module-name="PAGE_TITLE"
      :loading="importLoading"
      template-text="下载导入模板"
      template-description="请按立项导入模板上传 Excel 文件"
      :template-button-props="{
        permission: 'system:project:initiation:download',
      }"
      upload-tip="只能上传 xlsx 格式文件，且不超过 20MB"
      @import="handleImport"
      @download-template="downloadImportTemplate"
    />

    <BaseFormDialog
      v-model="feishuDialogVisible"
      title="飞书数据导入"
      width="520px"
      :loading="feishuPreviewLoading || feishuConfirmLoading"
      confirm-text="确定"
      cancel-text="取消"
      @confirm="handleFeishuImportConfirm"
      @cancel="closeFeishuImportDialog"
    >
      <div class="feishu-dialog-title">
        <span class="feishu-dialog-icon">
          <el-icon><DocumentAdd /></el-icon>
        </span>
        <div>
          <div class="feishu-dialog-heading">请输入飞书链接</div>
          <div class="feishu-dialog-subtitle">
            系统将读取飞书文档并进行导入校验。
          </div>
        </div>
      </div>
      <div class="feishu-dialog-body">
        <template v-if="feishuMode === 'NEW'">
          <el-input
            ref="feishuLinkInputRef"
            v-model.trim="feishuLink"
            clearable
            :disabled="feishuPreviewLoading || feishuConfirmLoading"
            placeholder="请输入"
            @keyup.enter="handleFeishuImportConfirm"
          />
        </template>
        <div class="feishu-import-tips">
          <div class="feishu-tips-title">导入前请确认:</div>
          <ol>
            <li>已通过【WBS立项导入模板】或【WBS过阀导入模板】创建副本；</li>
            <li>已在副本文档中完成数据编辑；</li>
            <li>已将副本文档添加到「收益与成本管理系统-预算管理」文档应用。</li>
          </ol>
        </div>
      </div>
    </BaseFormDialog>

    <BudgetGateReviewAttachmentDialog
      ref="attachmentDialogRef"
      biz-code="biz_project"
    />

    <TaskStatusPanel v-if="false" :task-id="activeTaskId" />

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
.budget-initiation__selection {
  color: var(--bq-color-text-muted);
  font-size: 13px;
  line-height: 24px;
}

.feishu-url-copyable {
  color: var(--bq-color-primary, #409eff);
  white-space: nowrap;
}

.budget-initiation__dropdown-icon {
  margin-left: 3px;
  font-size: 12px;
}

.feishu-dialog-title {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.feishu-dialog-icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--bq-color-primary-light, #ecf5ff);
  color: var(--bq-color-primary, #409eff);
  font-size: 18px;
}

.feishu-dialog-heading {
  color: var(--bq-color-text-primary, #303133);
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
}

.feishu-dialog-subtitle {
  margin-top: 4px;
  color: var(--bq-color-text-secondary, #606266);
  font-size: 13px;
  line-height: 20px;
}

.feishu-dialog-body {
  display: grid;
  gap: 14px;
}

.feishu-form-label {
  margin-bottom: 8px;
  color: var(--bq-color-text-primary, #303133);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.feishu-import-tips {
  padding: 12px 14px;
  border: 1px solid var(--bq-color-border-subtle, #ebeef5);
  border-radius: 4px;
  background: var(--bq-color-fill-light, #f5f7fa);
  color: var(--bq-color-text-secondary, #606266);
  font-size: 13px;
  line-height: 20px;
}

.feishu-tips-title {
  margin-bottom: 6px;
  color: var(--bq-color-text-primary, #303133);
  font-weight: 600;
}

.feishu-import-tips ol {
  margin: 0;
  padding-left: 18px;
}
</style>
