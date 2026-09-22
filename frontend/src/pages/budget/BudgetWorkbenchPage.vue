<script setup lang="ts">
import { resolveServerTotal } from "@/utils/pagination";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { UploadRequestOptions } from "element-plus";
import { Download, Lock, MoreFilled, Unlock, Upload } from "@element-plus/icons-vue";
import {
  createBudgetExport,
  createBudgetImportTask,
  fetchBudgetWorkbenchItemAttachments,
  fetchBudgetWorkbenchItems,
  updateBudgetWorkbenchLock,
  updateBudgetWorkbenchPassStatus,
} from "@/api/budget";
import { ApiBusinessError } from "@/api/http";
import { fetchBusinessValves } from "@/api/project";
import {
  deletePlatformFile,
  downloadPlatformFile,
  previewPlatformFile,
  uploadPlatformFile,
} from "@/api/platform-file";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { downloadLocalTemplate } from "@/utils/download-template";
import type { UploadFile } from "element-plus";
import type {
  PlatformFileMetadataResponse,
  PlatformFilePreviewResponse,
} from "@/types/platform-file";
import type {
  BackendId,
  BudgetWorkbenchItem,
  BudgetWorkbenchPageType,
} from "@/types/budget";
import type { BusinessValveItem } from "@/types/project";
import { resolveBudgetWorkbenchPageType } from "./budget-page-type";
import { resolveBudgetAttachmentContext } from "./budget-attachment-context";

const props = defineProps<{
  pageType?: BudgetWorkbenchPageType;
}>();

type QueryTableExpose = {
  search: () => void;
  reload: () => Promise<void>;
};

type BudgetConfig = {
  title: string;
  description: string;
  pageType: BudgetWorkbenchPageType;
  permissionPrefix: string;
  emptyTitle: string;
  emptyDescription: string;
};

const route = useRoute();
const router = useRouter();
const queryTableRef = ref<QueryTableExpose | null>(null);
const selectedRows = ref<BudgetWorkbenchItem[]>([]);
const latestExportTaskId = ref<string>();
const latestImportTaskId = ref<string>();
const currentRows = ref<BudgetWorkbenchItem[]>([]);
const detailVisible = ref(false);
const detailLoading = ref(false);
const activeRow = ref<BudgetWorkbenchItem | null>(null);
const attachmentsVisible = ref(false);
const attachmentsLoading = ref(false);
const attachmentsUploading = ref(false);
const attachmentRow = ref<BudgetWorkbenchItem | null>(null);
const attachments = ref<PlatformFileMetadataResponse[]>([]);
const attachmentPreviewVisible = ref(false);
const attachmentPreviewLoading = ref(false);
const attachmentPreview = ref<PlatformFilePreviewResponse | null>(null);
const valveOptions = ref<BusinessValveItem[]>([]);
const importTargetRow = ref<BudgetWorkbenchItem | null>(null);
const importDialogVisible = ref(false);
const importLoading = ref(false);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const query = reactive({
  keyword: "",
  valveId: undefined as BackendId | undefined,
  createdBy: "",
  createdAtRange: [] as string[] | null,
  status: "",
});

const importTemplateDescription = computed(() => {
  const targetName = importTargetRow.value?.projectName;
  if (targetName) {
    return `导入目标：${targetName}。未勾选记录时自动使用当前筛选结果第一条预算记录。`;
  }
  return `请按照要求导入${config.value.title}标准 Excel 文件。未勾选记录时自动使用当前筛选结果第一条预算记录。`;
});
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const configs: Record<BudgetWorkbenchPageType, BudgetConfig> = {
  initiation: {
    title: "立项评审",
    description:
      "参考旧系统 WBS 立项入口，按项目维度查看立项预算版本、预算金额、评估金额和报表动作。",
    pageType: "initiation",
    permissionPrefix: "budget:initiation",
    emptyTitle: "暂无立项评审",
    emptyDescription: "当前条件下没有可展示的立项预算数据。",
  },
  "gate-review": {
    title: "过阀评审",
    description:
      "参考旧系统过阀入口，按项目和阀点查看过阀预算版本、过阀状态、预算金额和评审动作。",
    pageType: "gate-review",
    permissionPrefix: "budget:gate-review",
    emptyTitle: "暂无过阀评审",
    emptyDescription: "当前条件下没有可展示的过阀预算数据。",
  },
};

const pageType = computed(
  () =>
    props.pageType ??
    resolveBudgetWorkbenchPageType(route.path, route.meta.budgetPageType),
);
const config = computed(() => configs[pageType.value] ?? configs.initiation);
const isGateReview = computed(() => pageType.value === "gate-review");

function formatWorkbenchDateTime(
  value: string | undefined,
  suffix: "00:00:00" | "23:59:59",
) {
  if (!value) {
    return undefined;
  }
  return isGateReview.value ? `${value} ${suffix}` : value;
}

watch(pageType, () => {
  resetQuery();
  selectedRows.value = [];
  if (isGateReview.value) {
    void loadValveOptions();
  }
  void queryTableRef.value?.reload();
});

if (isGateReview.value) {
  void loadValveOptions();
}

async function queryRows(pageSize: number, pageNo: number) {
  error.value = null;
  try {
    const response = await fetchBudgetWorkbenchItems({
      pageType: config.value.pageType,
      keyword: query.keyword.trim() || undefined,
      valveId: query.valveId,
      createdBy: query.createdBy.trim() || undefined,
      createdAtStart: formatWorkbenchDateTime(
        query.createdAtRange?.[0],
        "00:00:00",
      ),
      createdAtEnd: formatWorkbenchDateTime(
        query.createdAtRange?.[1],
        "23:59:59",
      ),
      status: query.status || undefined,
      pageNo,
      pageSize,
    });
    currentRows.value = response.records;
    return {
      total: resolveServerTotal(response.total),
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

function resetQuery() {
  query.keyword = "";
  query.valveId = undefined;
  query.createdBy = "";
  query.createdAtRange = [];
  query.status = "";
}

async function resolveImportTargetRow() {
  if (selectedRows.value.length === 1) {
    return selectedRows.value[0];
  }
  if (selectedRows.value.length > 1) {
    BaseToast.warning("已选择多条记录时，请保留一条预算记录后导入。");
    return null;
  }
  const cachedRow = currentRows.value[0];
  if (cachedRow) {
    return cachedRow;
  }
  const page = await fetchBudgetWorkbenchItems({
    pageType: config.value.pageType,
    keyword: query.keyword.trim() || undefined,
    valveId: query.valveId,
    createdBy: query.createdBy.trim() || undefined,
    createdAtStart: formatWorkbenchDateTime(
      query.createdAtRange?.[0],
      "00:00:00",
    ),
    createdAtEnd: formatWorkbenchDateTime(
      query.createdAtRange?.[1],
      "23:59:59",
    ),
    status: query.status || undefined,
    pageNo: 1,
    pageSize: 1,
  });
  return page.records[0] ?? null;
}

function searchRows() {
  queryTableRef.value?.search();
}

async function loadValveOptions() {
  try {
    const page = await fetchBusinessValves({
      status: "ENABLED",
      pageSize: 200,
    });
    valveOptions.value = page.records;
  } catch (unknownError) {
    handleActionError(unknownError, "阀点列表加载失败");
  }
}

function handleSelectionChange(selection: BudgetWorkbenchItem[]) {
  selectedRows.value = selection;
}

async function openDetail(row: BudgetWorkbenchItem) {
  if (!isGateReview.value) {
    router.push({
      name: "budgetInitiationDetailPage",
      query: {
        projectId: row.projectId,
        modelName: row.projectName || "",
        majorVersion: "",
        budgetLock: row.budgetLock ? "1" : "0",
        evaluationLock: row.evaluationLock ? "1" : "0",
        returnPath: route.fullPath,
      },
    });
    return;
  }
  router.push({
    name: "budgetGateReviewDetail",
    query: {
      projectId: row.projectId,
      valveId: row.valveId || "",
      projectName: row.projectName || "",
      valveName: row.valvePoint || "",
      passStatus: row.passStatus || "0",
      budgetLock: row.budgetLock ? "1" : "0",
      evaluationLock: row.evaluationLock ? "1" : "0",
      returnPath: route.fullPath,
    },
  });
}

function getStageCode() {
  return pageType.value === "gate-review" ? "PASS_VALVE" : "INITIATION";
}

function getAttachmentContext(row: BudgetWorkbenchItem) {
  return resolveBudgetAttachmentContext(row, pageType.value);
}

function getSelectedOrActiveRows(row?: BudgetWorkbenchItem) {
  if (row) {
    return [row];
  }
  return selectedRows.value;
}

async function exportRows(row?: BudgetWorkbenchItem) {
  const rows = getSelectedOrActiveRows(row);
  if (!rows.length) {
    BaseToast.warning("请先选择要导出的预算记录。");
    return;
  }

  try {
    for (const currentRow of rows) {
      const exportResult = await createBudgetExport(currentRow.projectId, {
        versionId: currentRow.versionId,
        stageCode: getStageCode(),
        valveId: currentRow.valveId,
        format: "xlsx",
      });
      latestExportTaskId.value = exportResult.taskId;
    }
    BaseToast.success(`已创建 ${rows.length} 个导出任务。`);
  } catch (unknownError) {
    handleActionError(unknownError, "预算导出失败");
  }
}

function openReportPage(row?: BudgetWorkbenchItem) {
  const rows = getSelectedOrActiveRows(row);
  if (rows.length !== 1) {
    BaseToast.warning("请选择一条预算记录后生成报表。");
    return;
  }
  const target = rows[0];
  void router.push({
    path:
      pageType.value === "gate-review"
        ? "/budget/wbs/cliquecreatereportforms"
        : "/budget/wbs/createreportforms",
    query: {
      itemId: String(target.id),
      projectId: String(target.projectId),
      versionId: String(target.versionId),
      valveId: target.valveId ? String(target.valveId) : undefined,
      projectName: target.projectName || target.projectCode,
      stageCode: getStageCode(),
      returnPath: route.fullPath,
    },
  });
}

function openVersionHistory(row: BudgetWorkbenchItem) {
  void router.push({
    path:
      pageType.value === "gate-review"
        ? "/budget/gate-review/versions"
        : "/budget/initiation/version-history",
    query: {
      projectId: String(row.projectId),
      versionId: String(row.versionId),
      projectName: row.projectName || row.projectCode,
      modelName: row.vehicleModel || "",
      stageCode: getStageCode(),
      returnPath: route.fullPath,
    },
  });
}

async function updatePassStatus(row: BudgetWorkbenchItem, passStatus: string) {
  const label = resolvePassStatusLabel(passStatus);
  try {
    await openConfirm({
      title: "过阀状态确认",
      message: `确认将项目“${row.projectName}”的阀点“${formatText(row.valvePoint || row.valveId)}”设置为“${label}”吗？`,
      confirmText: "确定",
    });
  } catch {
    return;
  }
  try {
    await updateBudgetWorkbenchPassStatus(row.id, passStatus);
    BaseToast.success(`过阀状态已更新为${label}。`);
    await queryTableRef.value?.reload();
  } catch (unknownError) {
    handleActionError(unknownError, "过阀状态更新失败");
  }
}

function canUpdatePassStatus(row: BudgetWorkbenchItem) {
  return !["2", "3"].includes(String(row.passStatus ?? "0"));
}

function isPassValveCompleted(row: BudgetWorkbenchItem) {
  return (
    isGateReview.value &&
    ["2", "3"].includes(String(row.passStatus ?? "0"))
  );
}

function handleLockCommand(row: BudgetWorkbenchItem, command: unknown) {
  if (isPassValveCompleted(row)) {
    BaseToast.warning("已过阀不能修改");
    return;
  }
  const action = String(command);
  if (action === "budget") {
    void updateBudgetLock(row);
    return;
  }
  if (action === "evaluation") {
    void updateEvaluationLock(row);
  }
}

function handlePassStatusCommand(row: BudgetWorkbenchItem, command: unknown) {
  void updatePassStatus(row, String(command));
}

async function updateBudgetLock(row: BudgetWorkbenchItem) {
  const nextLocked = !row.budgetLock;
  await updateLockState(row, {
    budgetLocked: nextLocked,
    evaluateLocked: row.evaluationLock,
    successMessage: nextLocked ? "预算已锁定。" : "预算已解锁。",
    errorMessage: nextLocked ? "预算锁定失败" : "预算解锁失败",
  });
}

async function updateEvaluationLock(row: BudgetWorkbenchItem) {
  const nextLocked = !row.evaluationLock;
  await updateLockState(row, {
    budgetLocked: row.budgetLock,
    evaluateLocked: nextLocked,
    successMessage: nextLocked ? "评估已锁定。" : "评估已解锁。",
    errorMessage: nextLocked ? "评估锁定失败" : "评估解锁失败",
  });
}

async function updateLockState(
  row: BudgetWorkbenchItem,
  payload: {
    budgetLocked: boolean;
    evaluateLocked: boolean;
    successMessage: string;
    errorMessage: string;
  },
) {
  try {
    await updateBudgetWorkbenchLock(row.projectId, {
      budgetLocked: payload.budgetLocked,
      evaluateLocked: payload.evaluateLocked,
    }, {
      stageCode: pageType.value,
      valveProjectId: row.valveProjectId,
    });
    BaseToast.success(payload.successMessage);
    await queryTableRef.value?.reload();
  } catch (unknownError) {
    handleActionError(unknownError, payload.errorMessage);
  }
}

async function prepareImport() {
  const row = await resolveImportTargetRow();
  if (!row) {
    BaseToast.warning("当前筛选条件下没有可导入的预算记录。");
    return;
  }
  importTargetRow.value = row;
  importDialogVisible.value = true;
}

async function handleImport(file: UploadFile) {
  const rawFile = file.raw;
  if (!rawFile) {
    BaseToast.warning("请选择需要导入的文件");
    return;
  }
  await importBudgetFile(rawFile);
}

async function importBudgetFile(file: File) {
  const row = importTargetRow.value;
  if (!row) {
    BaseToast.warning("当前筛选条件下没有可导入的预算记录。");
    return;
  }
  if (getStageCode() === "PASS_VALVE" && row.valveId == null) {
    BaseToast.warning("当前预算记录缺少阀点，无法创建导入任务。");
    return;
  }

  importLoading.value = true;
  try {
    const task = await createBudgetImportTask({
      stageCode: getStageCode(),
      file,
      valveId: row.valveId,
    });
    latestImportTaskId.value = task.taskId;
    importDialogVisible.value = false;
    BaseToast.success(`预算导入任务已创建：${task.batchNo || task.taskId}`);
  } catch (unknownError) {
    handleActionError(unknownError, "预算导入失败");
  } finally {
    importLoading.value = false;
    importTargetRow.value = null;
  }
}

function downloadImportTemplate() {
  if (pageType.value !== "gate-review") {
    downloadLocalTemplate("\u7acb\u9879\u5bfc\u5165\u6a21\u677f.xlsx");
    return;
  }
  downloadLocalTemplate("阀点预算导入模版.xlsx");
}

async function openAttachments(row: BudgetWorkbenchItem) {
  attachmentRow.value = row;
  attachmentsVisible.value = true;
  await loadAttachments(row);
}

async function loadAttachments(row = attachmentRow.value) {
  if (!row) {
    return;
  }
  attachmentsLoading.value = true;
  try {
    const context = getAttachmentContext(row);
    attachments.value = await fetchBudgetWorkbenchItemAttachments(
      context.businessModule,
      context.businessId,
    );
  } catch (unknownError) {
    handleActionError(unknownError, "附件加载失败");
  } finally {
    attachmentsLoading.value = false;
  }
}

async function uploadAttachment(options: UploadRequestOptions) {
  const row = attachmentRow.value;
  if (!row) {
    BaseToast.warning("请先打开预算附件。");
    return;
  }

  attachmentsUploading.value = true;
  try {
    const context = getAttachmentContext(row);
    await uploadPlatformFile(
      options.file as File,
      context.businessModule,
      context.businessId,
    );
    BaseToast.success("附件已上传。");
    await loadAttachments(row);
  } catch (unknownError) {
    handleActionError(unknownError, "附件上传失败");
  } finally {
    attachmentsUploading.value = false;
  }
}

async function downloadAttachment(file: PlatformFileMetadataResponse) {
  const row = attachmentRow.value;
  if (!row) {
    return;
  }

  try {
    const context = getAttachmentContext(row);
    const blob = await downloadPlatformFile(
      file.fileId,
      context.businessModule,
      context.businessId,
    );
    downloadBlob(
      blob,
      file.originalName || file.normalizedName || `${file.fileId}.xlsx`,
    );
  } catch (unknownError) {
    handleActionError(unknownError, "附件下载失败");
  }
}

async function previewAttachment(file: PlatformFileMetadataResponse) {
  const row = attachmentRow.value;
  if (!row) {
    return;
  }
  attachmentPreviewVisible.value = true;
  attachmentPreviewLoading.value = true;
  try {
    const context = getAttachmentContext(row);
    attachmentPreview.value = await previewPlatformFile(
      file.fileId,
      context.businessModule,
      context.businessId,
    );
  } catch (unknownError) {
    attachmentPreviewVisible.value = false;
    handleActionError(unknownError, "附件预览失败");
  } finally {
    attachmentPreviewLoading.value = false;
  }
}

async function deleteAttachment(file: PlatformFileMetadataResponse) {
  const row = attachmentRow.value;
  if (!row) {
    return;
  }
  try {
    await openConfirm({
      scene: "delete",
      object: "附件",
      name: file.originalName || file.normalizedName,
    });
  } catch {
    return;
  }
  try {
    const context = getAttachmentContext(row);
    await deletePlatformFile(
      file.fileId,
      context.businessModule,
      context.businessId,
    );
    BaseToast.success("附件已删除。");
    await loadAttachments(row);
  } catch (unknownError) {
    handleActionError(unknownError, "附件删除失败");
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function directPreviewUrl(preview: PlatformFilePreviewResponse | null) {
  const row = attachmentRow.value;
  if (!preview || !row) {
    return "";
  }
  const context = getAttachmentContext(row);
  const params = new globalThis.URLSearchParams({
    businessModule: context.businessModule,
    businessId: String(context.businessId),
  });
  return `/api/file/v1/files/${preview.fileId}/download?${params.toString()}`;
}

function handleActionError(unknownError: unknown, fallbackMessage: string) {
  const normalizedError = normalizeError(unknownError, fallbackMessage);
  BaseToast.error(normalizedError.message);
  error.value = normalizedError;
}

function formatAmount(value?: string | number | null) {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) {
    return "--";
  }
  return numberValue.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatText(value?: string | number | null) {
  return value === undefined || value === null || value === ""
    ? "--"
    : String(value);
}

function formatFileSize(value?: string | number | null) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "--";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function resolveStatusLabel(status?: string | null) {
  const labelMap: Record<string, string> = {
    DRAFT: "草稿",
    SUBMITTED: "已提交",
    REVIEWING: "评审中",
    APPROVED: "已通过",
    REJECTED: "已驳回",
    LOCKED: "已锁定",
    ARCHIVED: "已归档",
  };
  return labelMap[String(status ?? "")] ?? formatText(status);
}

function resolvePassStatusLabel(status?: string | null) {
  const labelMap: Record<string, string> = {
    "0": "未过阀",
    "1": "不允许过阀",
    "2": "带条件过阀",
    "3": "允许过阀",
  };
  return labelMap[String(status ?? "0")] ?? formatText(status);
}

function resolvePassStatusType(status?: string | null) {
  if (status === "3") {
    return "success";
  }
  if (status === "2") {
    return "warning";
  }
  if (status === "1") {
    return "danger";
  }
  return "info";
}

function resolveStatusType(status?: string | null) {
  if (status === "APPROVED") {
    return "success";
  }
  if (status === "SUBMITTED" || status === "REVIEWING" || status === "LOCKED") {
    return "warning";
  }
  if (status === "REJECTED") {
    return "danger";
  }
  return "info";
}

function normalizeError(
  unknownError: unknown,
  fallbackMessage = "预算工作台数据加载失败，请检查后端服务。",
) {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }

  return {
    code: "FRONTEND-BUDGET-WORKBENCH-001",
    message: fallbackMessage,
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer :title="config.title" :description="config.description">
    <TaskStatusPanel v-if="false" :task-id="latestImportTaskId" />
    <TaskStatusPanel v-if="false" :task-id="latestExportTaskId" />
    <QueryTable
      ref="queryTableRef"
      :func="queryRows"
      row-key="id"
      fit-table-height
      :error="error"
      :empty-title="config.emptyTitle"
      :empty-description="config.emptyDescription"
      @reset="resetQuery"
      @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="项目代号">
            <el-input
              v-model="query.keyword"
              clearable
              placeholder="请输入项目代号"
              @keyup.enter="searchRows"
            />
          </el-form-item>
          <el-form-item v-if="isGateReview" label="阀点">
            <el-select
              v-model="query.valveId"
              clearable
              filterable
              placeholder="请选择阀点"
            >
              <el-option
                v-for="valve in valveOptions"
                :key="String(valve.valveId)"
                :label="`${valve.valveName}（${valve.valveCode}）`"
                :value="String(valve.valveId)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="创建人">
            <el-input
              v-model="query.createdBy"
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
          :permission="`${config.permissionPrefix}:generate-report`"
          variant="primary"
          type="primary"
          @click="openReportPage()"
        >
          生成报表
        </PermissionButton>
        <PermissionButton
          :permission="`${config.permissionPrefix}:import`"
          variant="secondary"
          plain
          :icon="Upload"
          @click="prepareImport"
          type="success"
        >
          导入
        </PermissionButton>
        <PermissionButton
          :permission="`${config.permissionPrefix}:export`"
          variant="secondary"
          plain
          :icon="Download"
          @click="exportRows()"
          type="warning"
        >
          导出
        </PermissionButton>
        <!--        <PermissionButton plain @click="downloadImportTemplate">模板下载</PermissionButton>-->
        <span v-if="selectedRows.length" class="budget-workbench__selection">
          已选择 {{ selectedRows.length }} 项
        </span>
      </template>

      <el-table-column type="selection" width="48" fixed="left" />
      <el-table-column
        type="index"
        label="序号"
        width="70"
        fixed="left"
        align="center"
      />
      <el-table-column
        prop="projectName"
        label="项目代号"
        min-width="180"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ formatText(row.projectName) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="isGateReview"
        prop="valvePoint"
        label="阀点"
        width="110"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ formatText(row.valvePoint || row.valveId) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="owner"
        label="创建人"
        width="130"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{ formatText(row.owner) }}</template>
      </el-table-column>
      <el-table-column prop="versionId" label="版本号" width="130">
        <template #default="{ row }">{{ formatText(row.versionId) }}</template>
      </el-table-column>
      <el-table-column
        v-if="isGateReview"
        prop="passStatus"
        label="过阀状态"
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <BaseStatusTag
            :label="
              row.passStatusLabel || resolvePassStatusLabel(row.passStatus)
            "
            :type="resolvePassStatusType(row.passStatus)"
          />
        </template>
      </el-table-column>
      <el-table-column
        v-if="isGateReview"
        prop="passTime"
        label="过阀时间"
        width="180"
      >
        <template #default="{ row }">
          <BaseDateTime :value="row.passTime || null" />
        </template>
      </el-table-column>
      <el-table-column
        v-else
        prop="reportStatus"
        label="报表状态"
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <BaseStatusTag
            :label="resolveStatusLabel(row.reportStatus)"
            :type="resolveStatusType(row.reportStatus)"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          <BaseDateTime :value="row.createdAt || row.updatedAt || null" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            :permission="config.permissionPrefix + ':view'"
            link
            type="primary"
            @click="openDetail(row)"
          >
            查看
          </PermissionButton>
          <el-dropdown
            trigger="click"
            :disabled="isPassValveCompleted(row)"
            @command="handleLockCommand(row, $event)"
          >
            <PermissionButton
              permission="system:project:status:edit"
              link
              type="primary"
              :disabled="isPassValveCompleted(row)"
              >锁定</PermissionButton
            >
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  command="budget"
                  :disabled="isPassValveCompleted(row)"
                >
                  <el-icon>
                    <Unlock v-if="row.budgetLock" />
                    <Lock v-else />
                  </el-icon>
                  {{ row.budgetLock ? "预算解锁" : "预算锁定" }}
                </el-dropdown-item>
                <el-dropdown-item
                  command="evaluation"
                  :disabled="isPassValveCompleted(row)"
                >
                  <el-icon>
                    <Unlock v-if="row.evaluationLock" />
                    <Lock v-else />
                  </el-icon>
                  {{ row.evaluationLock ? "评估解锁" : "评估锁定" }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown trigger="click">
            <PermissionButton link type="primary" :icon="MoreFilled">
              更多
            </PermissionButton>
            <template #dropdown>
              <el-dropdown-menu>
                <PermissionGuard permission="system:attachment:list">
                  <el-dropdown-item @click="openAttachments(row)">
                    附件
                  </el-dropdown-item>
                </PermissionGuard>
                <PermissionGuard
                  v-if="isGateReview"
                  permission="system:project:valve:edit"
                >
                  <el-dropdown-item
                    :disabled="!canUpdatePassStatus(row)"
                    @click="handlePassStatusCommand(row, '3')"
                  >
                    允许过阀
                  </el-dropdown-item>
                  <el-dropdown-item
                    :disabled="!canUpdatePassStatus(row)"
                    @click="handlePassStatusCommand(row, '2')"
                  >
                    带条件过阀
                  </el-dropdown-item>
                  <el-dropdown-item
                    :disabled="!canUpdatePassStatus(row)"
                    @click="handlePassStatusCommand(row, '1')"
                  >
                    不允许过阀
                  </el-dropdown-item>
                </PermissionGuard>
                <el-dropdown-item @click="openVersionHistory(row)">
                  历史版本
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="detailVisible"
      :title="`${config.title}详情`"
      width="720px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
      :loading="detailLoading"
    >
      <el-descriptions v-if="activeRow" :column="2" border>
        <el-descriptions-item label="项目代号">
          {{ formatText(activeRow.projectCode) }}
        </el-descriptions-item>
        <el-descriptions-item label="项目代号">
          {{ formatText(activeRow.projectName) }}
        </el-descriptions-item>
        <el-descriptions-item label="车型">
          {{ formatText(activeRow.vehicleModel) }}
        </el-descriptions-item>
        <el-descriptions-item label="阀点">
          {{ formatText(activeRow.valvePoint || activeRow.valveId) }}
        </el-descriptions-item>
        <el-descriptions-item label="WBS编码">
          {{ formatText(activeRow.wbsNumber) }}
        </el-descriptions-item>
        <el-descriptions-item label="WBS名称">
          {{ formatText(activeRow.wbsName) }}
        </el-descriptions-item>
        <el-descriptions-item label="版本号">
          {{ formatText(activeRow.versionId) }}
        </el-descriptions-item>
        <el-descriptions-item label="阶段">
          {{ formatText(activeRow.stageCode) }}
        </el-descriptions-item>
        <el-descriptions-item label="预算金额">
          {{ formatAmount(activeRow.budgetAmount) }}
        </el-descriptions-item>
        <el-descriptions-item label="评估金额">
          {{ formatAmount(activeRow.assessmentAmount) }}
        </el-descriptions-item>
        <el-descriptions-item :label="isGateReview ? '过阀状态' : '报表状态'">
          {{
            isGateReview
              ? activeRow.passStatusLabel ||
                resolvePassStatusLabel(activeRow.passStatus)
              : resolveStatusLabel(activeRow.reportStatus)
          }}
        </el-descriptions-item>
        <el-descriptions-item v-if="isGateReview" label="过阀时间">
          <BaseDateTime :value="activeRow.passTime || null" />
        </el-descriptions-item>
        <el-descriptions-item label="预算锁定">
          {{ activeRow.budgetLock ? "已锁定" : "未锁定" }}
        </el-descriptions-item>
        <el-descriptions-item label="评估锁定">
          {{ activeRow.evaluationLock ? "已锁定" : "未锁定" }}
        </el-descriptions-item>
        <el-descriptions-item label="创建人">
          {{ formatText(activeRow.owner) }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          <BaseDateTime :value="activeRow.updatedAt || null" />
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          <BaseDateTime :value="activeRow.createdAt || null" />
        </el-descriptions-item>
      </el-descriptions>
    </BaseFormDialog>

    <BaseImportDialog
      v-model="importDialogVisible"
      :module-name="config.title"
      :loading="importLoading"
      template-text="下载导入模板"
      :template-description="importTemplateDescription"
      upload-tip="只能上传 xlsx 格式文件，且不超过 20MB"
      @import="handleImport"
      @download-template="downloadImportTemplate"
    />

    <BaseFormDialog
      v-model="attachmentsVisible"
      title="预算附件"
      width="760px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
      :loading="attachmentsLoading"
      body-max-height="520px"
    >
      <div class="budget-workbench__attachment-toolbar">
        <el-upload
          :show-file-list="false"
          :http-request="uploadAttachment"
          :disabled="attachmentsUploading"
          accept=".xlsx,.xls,.pdf,.doc,.docx,.png,.jpg,.jpeg"
        >
          <PermissionButton
            permission="system:attachment:upload"
            variant="primary"
            type="primary"
            :loading="attachmentsUploading"
            :icon="Upload"
          >
            上传附件
          </PermissionButton>
        </el-upload>
        <PermissionButton plain @click="loadAttachments()"
          >刷新</PermissionButton
        >
      </div>
      <el-table
        v-loading="attachmentsLoading"
        :data="attachments"
        row-key="fileId"
        empty-text="暂无附件"
      >
        <el-table-column
          prop="originalName"
          label="文件名"
          min-width="220"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ formatText(row.originalName || row.normalizedName) }}
          </template>
        </el-table-column>
        <el-table-column prop="fileSize" label="大小" width="110" align="right">
          <template #default="{ row }">
            {{ formatFileSize(row.fileSize) }}
          </template>
        </el-table-column>
        <el-table-column prop="virusScanStatus" label="安全状态" width="120">
          <template #default="{ row }">
            <BaseStatusTag
              :label="formatText(row.virusScanStatus)"
              type="success"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="上传时间" width="180">
          <template #default="{ row }">
            <BaseDateTime :value="row.createdAt || null" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <PermissionButton
              permission="system:attachment:list"
              link
              type="primary"
              @click="previewAttachment(row)"
            >
              预览
            </PermissionButton>
            <PermissionButton
              permission="system:attachment:download"
              link
              type="primary"
              @click="downloadAttachment(row)"
            >
              下载
            </PermissionButton>
            <PermissionButton
              permission="system:attachment:remove"
              link
              @click="deleteAttachment(row)"
            >
              删除
            </PermissionButton>
          </template>
        </el-table-column>
      </el-table>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="attachmentPreviewVisible"
      title="附件预览"
      width="860px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
      :loading="attachmentPreviewLoading"
      body-max-height="620px"
    >
      <div v-if="attachmentPreview" class="budget-workbench__preview">
        <div class="budget-workbench__preview-title">
          {{ attachmentPreview.fileName }}
        </div>
        <pre
          v-if="attachmentPreview.previewType === 'TEXT'"
          class="budget-workbench__preview-text"
          >{{ attachmentPreview.text }}</pre
        >
        <div
          v-else-if="attachmentPreview.previewType === 'TABLE'"
          class="budget-workbench__preview-table"
        >
          <el-tabs>
            <el-tab-pane
              v-for="sheet in attachmentPreview.sheets || []"
              :key="sheet.name"
              :label="sheet.name"
            >
              <el-table :data="sheet.rows" border size="small">
                <el-table-column
                  v-for="(_, index) in sheet.rows[0] || []"
                  :key="index"
                  :label="`列${index + 1}`"
                  min-width="120"
                >
                  <template #default="{ row }">
                    {{ row[index] || "" }}
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>
        <iframe
          v-else-if="attachmentPreview.directStream"
          class="budget-workbench__preview-frame"
          :src="directPreviewUrl(attachmentPreview)"
        />
        <el-empty v-else description="当前文件类型不支持预览" />
      </div>
    </BaseFormDialog>
    <BaseConfirm
      v-model="confirmState.visible"
      v-bind="confirmState"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.budget-workbench__selection {
  color: var(--bq-color-text-muted);
  font-size: 14px;
  line-height: 24px;
}

.budget-workbench__attachment-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.budget-workbench__preview-title {
  margin-bottom: 12px;
  font-weight: 600;
}

.budget-workbench__preview-text {
  min-height: 360px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--bq-border-color-light);
  border-radius: 4px;
  background: var(--bq-fill-color-lighter);
  white-space: pre-wrap;
}

.budget-workbench__preview-frame {
  width: 100%;
  min-height: 520px;
  border: 1px solid var(--bq-border-color-light);
  border-radius: 4px;
}
</style>
