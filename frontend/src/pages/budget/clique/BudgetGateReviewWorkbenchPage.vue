<script setup lang="ts">
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { nextTick, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowDown,
  DocumentAdd,
  Download,
  Lock,
  Tickets,
  Upload,
  Unlock,
  RefreshRight,
} from "@element-plus/icons-vue";
import {
  confirmValveFeishu,
  exportProjectPassValve,
  getCliqueNameList,
  getValveFeishuDocuments,
  guofaList,
  importProjectValve,
  previewValveFeishu,
  projectStatusValve,
  updateImportLockValve,
} from "@/api/budget";
import { ApiBusinessError } from "@/api/http";
import { useAuthStore } from "@/stores/auth";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import BudgetGateReviewAttachmentDialog from "./BudgetGateReviewAttachmentDialog.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { downloadLocalTemplate } from "@/utils/download-template";
import type { BackendId } from "@/types/information";
import type { InputInstance, UploadFile } from "element-plus";

type QueryTableExpose = {
  search: () => void;
  reload: () => Promise<void>;
};

type GuofaRow = Record<string, unknown> & {
  id?: number | string;
  projectId?: BackendId;
  valveId?: BackendId;
  projectName?: string;
  valveName?: string;
  isLock?: number | string;
  budgetLock?: number | string;
  evaluateLock?: number | string;
  status?: number | string;
  majorVersion?: number | string;
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

type AttachmentDialogExpose = {
  init: (row: GuofaRow) => void;
};

const route = useRoute();
const router = useRouter();
const queryTableRef = ref<QueryTableExpose | null>(null);
const attachmentDialogRef = ref<AttachmentDialogExpose | null>(null);
const selectedRows = ref<GuofaRow[]>([]);
const exportRows = ref<{ projectId: BackendId; valveId: BackendId }[]>([]);
const exportProjectName = ref("");
const exportValveName = ref("");
const loading = ref(false);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const query = ref({
  projectName: "",
  createBy: "",
  valveId: "" as string,
  dateRange: null as [string, string] | null,
});

const selectValve = ref<{ label: string; value: string | number }[]>([]);

const importDialogVisible = ref(false);
const importLoading = ref(false);
const importValveId = ref<string | number | null>(null);
const feishuDialogVisible = ref(false);
const feishuLink = ref("");
const feishuPreviewLoading = ref(false);
const feishuConfirmLoading = ref(false);
const feishuConfirmKey = ref("");
const feishuMode = ref<FeishuMode>("NEW");
const feishuLinkInputRef = ref<InputInstance | null>(null);
const feishuRefreshLoading = ref(false);
const attachmentDialogVisible = ref(false);

loadValveOptions();

function loadValveOptions() {
  getCliqueNameList()
    .then(({ rows }) => {
      selectValve.value = (rows ?? []).map((item) => ({
        label: item.valveName,
        value: item.id,
      }));
    })
    .catch(() => undefined);
}

function getDateParams() {
  if (query.value.dateRange) {
    return {
      beginTime: query.value.dateRange[0] + " 00:00:00",
      endTime: query.value.dateRange[1] + " 23:59:59",
    };
  }
  return { beginTime: undefined, endTime: undefined };
}

function hasRequestValue(value: unknown) {
  return value !== "" && value !== null && value !== undefined;
}

function compactParams<T extends Record<string, unknown>>(params: T) {
  return Object.entries(params).reduce<Record<string, unknown>>(
    (result, [key, value]) => {
      if (hasRequestValue(value)) {
        result[key] = value;
      }
      return result;
    },
    {},
  ) as Partial<T>;
}

async function queryRows(pageSize: number, pageNum: number) {
  loading.value = true;
  try {
    const dateParams = getDateParams();
    const response = await guofaList(
      compactParams({
        projectName: query.value.projectName,
        createBy: query.value.createBy,
        valveId: query.value.valveId,
        beginTime: dateParams.beginTime,
        endTime: dateParams.endTime,
        pageSize,
        pageNum,
      }),
    );
    return {
      total: response.total ?? 0,
      list: response.rows ?? [],
      pageNo: pageNum,
      pageSize,
    };
  } catch (unknownError) {
    const msg =
      unknownError instanceof ApiBusinessError
        ? unknownError.message
        : "数据加载失败";
    BaseToast.error(msg);
    throw unknownError;
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  query.value.projectName = "";
  query.value.createBy = "";
  query.value.valveId = "";
  query.value.dateRange = null;
}

function handleSelectionChange(selection: GuofaRow[]) {
  selectedRows.value = selection;
  if (selection.length === 1) {
    exportProjectName.value = String(selection[0].projectName ?? "");
    exportValveName.value = String(selection[0].valveName ?? "");
  } else {
    exportProjectName.value = "";
    exportValveName.value = "";
  }
  exportRows.value = selection.map((row) => ({
    projectId: row.projectId as BackendId,
    valveId: row.valveId as BackendId,
  }));
}

function resolvePassStatusLabel(status?: unknown) {
  const map: Record<string, string> = {
    "0": "未过阀",
    "1": "不允许过阀",
    "2": "带条件过阀",
    "3": "允许过阀",
  };
  return map[String(status ?? "0")] ?? "--";
}

function resolvePassStatusType(status?: unknown) {
  if (status === "3") return "success";
  if (status === "2") return "warning";
  if (status === "1") return "danger";
  return "info";
}

function isPassValveCompleted(row: GuofaRow) {
  return ["2", "3"].includes(String(row.status ?? "0"));
}

function canBudgetLock(row: GuofaRow) {
  if (isPassValveCompleted(row)) return false;
  const lock = Number(row.budgetLock ?? 0);
  const auth =
    lock === 0 ? "system:project:budget:lock" : "system:project:budget:unlock";
  return checkAuth(auth);
}

function canEvaluateLock(row: GuofaRow) {
  if (isPassValveCompleted(row)) return false;
  const lock = Number(row.evaluateLock ?? 0);
  const auth =
    lock === 0
      ? "system:project:evaluate:lock"
      : "system:project:evaluate:unlock";
  return checkAuth(auth);
}

function checkAuth(perm: string) {
  const store = useAuthStore();
  return store.hasPermission(perm);
}

function handleLockCommand(row: GuofaRow, command: unknown) {
  if (isPassValveCompleted(row)) {
    BaseToast.warning("已过阀不能修改");
    return;
  }
  const type = String(command);
  const config: Record<
    string,
    {
      api: (data: Record<string, unknown>) => Promise<void>;
      data: Record<string, unknown>;
      action: string;
    }
  > = {
    budgetLock: {
      api: updateImportLockValve as (
        data: Record<string, unknown>,
      ) => Promise<void>,
      data: {
        id: row.id,
        budgetLock: Number(row.budgetLock ?? 0) === 1 ? 0 : 1,
      },
      action: Number(row.budgetLock ?? 0) === 1 ? "预算解锁" : "预算锁定",
    },
    evaluateLock: {
      api: updateImportLockValve as (
        data: Record<string, unknown>,
      ) => Promise<void>,
      data: {
        id: row.id,
        evaluateLock: Number(row.evaluateLock ?? 0) === 1 ? 0 : 1,
      },
      action: Number(row.evaluateLock ?? 0) === 1 ? "评估解锁" : "评估锁定",
    },
  };
  const entry = config[type];
  if (!entry) return;
  void executeLockAction(
    entry.api,
    entry.data,
    entry.action,
    String(row.projectName ?? ""),
  );
}

function handlePassStatusCommand(row: GuofaRow, command: unknown) {
  const status = String(command);
  const labelMap: Record<string, string> = {
    "1": "不允许过阀",
    "2": "带条件过阀",
    "3": "允许过阀",
  };
  const label = labelMap[status] ?? status;
  void executePassStatusAction(row, status, label);
}

function canPass(row: GuofaRow) {
  return !["2", "3"].includes(String(row.status ?? "0"));
}

async function executeLockAction(
  api: (data: Record<string, unknown>) => Promise<void>,
  data: Record<string, unknown>,
  action: string,
  projectName: string,
) {
  try {
    await openConfirm({
      title: "提示",
      message: `确定要${action}${projectName}吗？`,
      type: "warning",
      confirmText: "确定",
      cancelText: "取消",
    });
  } catch {
    return;
  }
  try {
    await api(data);
    BaseToast.success(`${action}成功`);
    await queryTableRef.value?.reload();
  } catch (unknownError) {
    const msg =
      unknownError instanceof ApiBusinessError
        ? unknownError.message
        : `${action}失败`;
    BaseToast.error(msg);
  }
}

async function executePassStatusAction(
  row: GuofaRow,
  status: string,
  label: string,
) {
  try {
    await openConfirm({
      title: "提示",
      message: `确定将${String(row.projectName ?? "")}（${String(row.valveName ?? "")}）设置为 ${label} 吗？`,
      type: "warning",
      confirmText: "确定",
      cancelText: "取消",
    });
  } catch {
    return;
  }
  try {
    await projectStatusValve({ id: row.id as number | string, status });
    BaseToast.success("操作成功");
    await queryTableRef.value?.reload();
  } catch (unknownError) {
    const msg =
      unknownError instanceof ApiBusinessError
        ? unknownError.message
        : "操作失败";
    BaseToast.error(msg);
  }
}

function openDetail(row: GuofaRow) {
  router.push({
    name: "过阀评审查看",
    query: compactParams({
      projectId: String(row.projectId ?? ""),
      valveId: String(row.valveId ?? ""),
      projectName: String(row.projectName ?? ""),
      valveName: encodeURIComponent(String(row.valveName ?? "")),
      isLock: String(row.isLock ?? ""),
      passStatus: String(row.status ?? ""),
      evaluationLock: String(row.evaluateLock ?? ""),
      budgetLock: String(row.budgetLock ?? ""),
      returnPath: route.fullPath,
    }),
  });
}

function openVersionHistory(row: GuofaRow) {
  router.push({
    name: "过阀评审历史版本",
    query: compactParams({
      projectId: String(row.projectId ?? ""),
      valveId: String(row.valveId ?? ""),
      projectName: String(row.projectName ?? ""),
      valveName: encodeURIComponent(String(row.valveName ?? "")),
      isLock: String(row.isLock ?? ""),
      passStatus: String(row.status ?? ""),
      budgetLock: String(row.budgetLock ?? ""),
    }),
  });
}

function openReportForms() {
  if (exportRows.value.length !== 1) {
    BaseToast.warning("请选择一个项目");
    return;
  }
  void router.push({
    name: "过阀评审生成报表",
    query: {
      id: String(selectedRows.value[0]?.id ?? ""),
      modelName: exportProjectName.value,
      valveName: exportValveName.value,
      returnPath: route.fullPath,
    },
  });
}

function openImport() {
  importValveId.value = null;
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

function getSelectedValveRow() {
  if (selectedRows.value.length !== 1) {
    BaseToast.error("请选择一个项目");
    return null;
  }
  return selectedRows.value[0];
}

function createFeishuIdempotencyKey() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  const random = Math.random().toString(16).slice(2);
  return `feishu-${Date.now()}-${random}`;
}

function resetFeishuPreviewState() {
  feishuPreviewLoading.value = false;
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
  const row = getSelectedValveRow();
  if (!row) return;
  if (
    Number(row.budgetLock ?? 0) === 1 ||
    Number(row.evaluateLock ?? 0) === 1 ||
    Number(row.status ?? 0) !== 0
  ) {
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
    const result = await getValveFeishuDocuments({
      projectId: row.projectId,
      valveId: row.valveId,
    });
    const documents = Array.isArray(result)
      ? (result as FeishuDocument[])
      : (((result as { data?: FeishuDocument[] }).data ?? []) as FeishuDocument[]);
    if (!documents.length) {
      BaseToast.warning("当前项目暂无已绑定飞书文档");
      return;
    }
    resetFeishuPreviewState();
    feishuMode.value = "REFRESH";
    const refreshPayload = {
      mode: "REFRESH",
      documentId: documents[0].id,
      projectId: row.projectId,
      valveId: row.valveId,
    };
    await previewFeishuImport(refreshPayload, {
      forceConfirm: true,
      confirmPayload: refreshPayload,
    });
  } finally {
    feishuRefreshLoading.value = false;
  }
}

async function previewFeishuImport(
  payload: Record<string, unknown>,
  options: {
    forceConfirm?: boolean;
    confirmPayload?: Record<string, unknown>;
  } = {},
) {
  feishuPreviewLoading.value = true;
  try {
    const preview = (await previewValveFeishu(payload)) as FeishuPreviewResult;
    await handleFeishuPreviewResult(preview, options);
  } catch (error) {
    feishuConfirmKey.value = createFeishuIdempotencyKey();
    throw error;
  } finally {
    feishuPreviewLoading.value = false;
  }
}

async function handleFeishuPreviewResult(
  preview: FeishuPreviewResult | null,
  options: {
    forceConfirm?: boolean;
    confirmPayload?: Record<string, unknown>;
  } = {},
) {
  if (!preview) {
    if (options.forceConfirm && options.confirmPayload) {
      await confirmFeishuImport({}, options.confirmPayload);
    }
    return;
  }
  if (preview.status === "NO_CHANGE" && !options.forceConfirm) {
    BaseToast.success("飞书文档内容无变化");
    closeFeishuImportDialog();
    return;
  }
  if (preview.errorCount && preview.errorCount > 0) {
    feishuConfirmKey.value = createFeishuIdempotencyKey();
    showFeishuPreviewMessage(preview);
    return;
  }
  if (!options.forceConfirm && !preview.confirmable) {
    feishuConfirmKey.value = createFeishuIdempotencyKey();
    showFeishuPreviewMessage(preview);
    return;
  }
  await confirmFeishuImport(preview, options.confirmPayload);
}

function showFeishuPreviewMessage(preview: FeishuPreviewResult) {
  const message =
    (preview.errors && preview.errors[0]) ||
    (preview.warnings && preview.warnings[0]) ||
    "飞书预览未通过，请检查文档内容";
  BaseToast.warning(message);
}

async function confirmFeishuImport(
  preview: FeishuPreviewResult,
  confirmPayload: Record<string, unknown> = {},
) {
  const canConfirmByPreview = preview.previewId && preview.contentHash;
  const canConfirmByDocument = confirmPayload.documentId;
  if (!canConfirmByPreview && !canConfirmByDocument) {
    BaseToast.warning("预览信息已失效，请重新预览");
    resetFeishuPreviewState();
    return;
  }
  feishuConfirmLoading.value = true;
  feishuConfirmKey.value =
    feishuConfirmKey.value || createFeishuIdempotencyKey();
  try {
    await confirmValveFeishu(
      {
        ...confirmPayload,
        ...(canConfirmByPreview
          ? {
              previewId: preview.previewId,
              contentHash: preview.contentHash,
            }
          : {}),
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

function openAttachment(row: GuofaRow) {
  attachmentDialogVisible.value = true;
  attachmentDialogRef.value?.init(row);
}

function handleImport(file: UploadFile) {
  void doImport(file);
}

async function doImport(file: UploadFile) {
  const raw = file.raw;
  if (!importValveId.value) {
    BaseToast.warning("\u8bf7\u9009\u62e9\u9600\u70b9");
    return;
  }
  if (!raw) {
    BaseToast.warning(
      "\u8bf7\u9009\u62e9\u9700\u8981\u5bfc\u5165\u7684\u6587\u4ef6",
    );
    return;
  }
  importLoading.value = true;
  try {
    const formData = new FormData();
    formData.append("file", raw);
    formData.append("valveId", String(importValveId.value));
    const task = await importProjectValve(formData);
    BaseToast.success(
      `\u8fc7\u9600\u9884\u7b97\u5bfc\u5165\u4efb\u52a1\u5df2\u521b\u5efa\uff1a${task.taskNo || task.taskId}`,
    );
    importDialogVisible.value = false;
  } catch (unknownError) {
    const msg =
      unknownError instanceof ApiBusinessError
        ? unknownError.message
        : "\u5bfc\u5165\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5";
    BaseToast.error(msg);
  } finally {
    importLoading.value = false;
  }
}

function downloadImportTemplate() {
  downloadLocalTemplate("阀点预算导入模版.xlsx");
}

async function doExport() {
  if (exportRows.value.length !== 1) {
    BaseToast.warning("请选择一个项目");
    return;
  }
  if (!selectedRows.value[0]?.majorVersion) {
    BaseToast.warning("该项目阀点尚未导入过阀数据，暂无可导出内容");
    return;
  }
  try {
    const task = await exportProjectPassValve([exportRows.value[0]]);
    BaseToast.success(`过阀预算导出任务已创建：${task.taskNo || task.taskId}`);
  } catch (unknownError) {
    const msg =
      unknownError instanceof ApiBusinessError
        ? unknownError.message
        : "导出失败";
    BaseToast.error(msg);
  }
}
</script>

<template>
  <PageContainer
    title="过阀评审"
    description="按项目和阀点查看过阀预算版本、过阀状态和评审动作。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryRows"
      row-key="id"
      fit-table-height
      @reset="resetQuery"
      @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="项目代号">
            <el-input
              v-model="query.projectName"
              clearable
              placeholder="请输入项目代号"
              @keyup.enter="queryTableRef?.search()"
            />
          </el-form-item>
          <el-form-item label="创建人">
            <el-input
              v-model="query.createBy"
              clearable
              placeholder="请输入创建人"
              @keyup.enter="queryTableRef?.search()"
            />
          </el-form-item>
          <el-form-item label="阀点">
            <el-select v-model="query.valveId" clearable placeholder="请选择">
              <el-option
                v-for="(item, index) in [
                  { label: '全部', value: '' },
                  ...selectValve,
                ]"
                :key="item.label + index"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.dateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
<!--          permission="budget:initiation:generate-report"-->
        <PermissionButton
          permission="system:table:data:get"
          variant="primary"
          type="primary"
          plain
          :icon="Tickets"
          @click="openReportForms"
        >
          生成报表
        </PermissionButton>
        <PermissionButton
            permission="system:project:valve:import"
          variant="secondary"
          type="success"
          plain
          :icon="Upload"
          @click="openImport"
        >
          导入
        </PermissionButton>
        <PermissionButton
            permission="system:project:valve:export"
          variant="secondary"
          type="warning"
          plain
          :icon="Download"
          @click="doExport"
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
          permission="system:project:valve:import"
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
        <span v-if="selectedRows.length" class="clique-workbench__selection">
          已选择 {{ selectedRows.length }} 项
        </span>
      </template>

      <el-table-column type="selection"  fixed="left" />
      <el-table-column
        type="index"
        label="序号"
        fixed="left"
        align="center"
      />
      <el-table-column
        prop="projectName"
        label="项目代号"
        show-overflow-tooltip
      >
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
                {{ row.projectName }}
              </el-button>
            </template>
          </el-popover>
          <span v-else>{{ row.projectName }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="valveName"
        label="阀点"
        show-overflow-tooltip
      />
      <el-table-column
        prop="status"
        label="过阀状态"
        align="center"
      >
        <template #default="{ row }">
          <BaseStatusTag
            :label="resolvePassStatusLabel(row.status)"
            :type="resolvePassStatusType(row.status)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="valveTime" label="过阀时间" />
      <el-table-column label="创建人">
        <template #default>
          --
        </template>
      </el-table-column>
      <el-table-column prop="majorVersion" label="版本号" />
      <el-table-column prop="createTime" label="创建时间"  />
      <el-table-column label="操作" width="240" fixed="right" align="center">
        <template #default="{ row }">
          <div class="bq-table-actions" @click.stop>
            <PermissionButton
              permission="system:project:valve:list"
              link
              type="primary"
              @click="openDetail(row)"
            >
              查看
            </PermissionButton>
            <PermissionGuard permission="system:project:status:edit">
              <el-dropdown
                trigger="click"
                :disabled="isPassValveCompleted(row)"
                @command="handleLockCommand(row, $event)"
              >
                <PermissionButton
                  link
                  type="primary"
                  :disabled="isPassValveCompleted(row)"
                >
                  锁定
                  <el-icon class="clique-workbench__dropdown-icon"><ArrowDown /></el-icon>
                </PermissionButton>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      command="budgetLock"
                      :disabled="!canBudgetLock(row)"
                      :style="{
                        color:
                          Number(row.budgetLock ?? 0) === 1 &&
                          canBudgetLock(row)
                            ? 'var(--bq-color-warning)'
                            : undefined,
                        borderBottom: '1px solid var(--bq-color-border)',
                      }"
                    >
                      <el-icon>
                        <Unlock v-if="Number(row.budgetLock ?? 0) === 1" />
                        <Lock v-else />
                      </el-icon>
                      {{
                        Number(row.budgetLock ?? 0) === 1
                          ? "预算解锁"
                          : "预算锁定"
                      }}
                    </el-dropdown-item>
                    <el-dropdown-item
                      command="evaluateLock"
                      :disabled="!canEvaluateLock(row)"
                      :style="{
                        color:
                          Number(row.evaluateLock ?? 0) === 1 &&
                          canEvaluateLock(row)
                            ? 'var(--bq-color-warning)'
                            : undefined,
                      }"
                    >
                      <el-icon>
                        <Unlock v-if="Number(row.evaluateLock ?? 0) === 1" />
                        <Lock v-else />
                      </el-icon>
                      {{
                        Number(row.evaluateLock ?? 0) === 1
                          ? "评估解锁"
                          : "评估锁定"
                      }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </PermissionGuard>

            <PermissionGuard permission="system:valve:project:edit">
              <el-dropdown
                trigger="click"
                :disabled="!canPass(row)"
                @command="handlePassStatusCommand(row, $event)"
              >
                <PermissionButton link :disabled="!canPass(row)">
                  过阀
                  <el-icon class="clique-workbench__dropdown-icon"><ArrowDown /></el-icon>
                </PermissionButton>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="3">允许过阀</el-dropdown-item>
                    <el-dropdown-item command="2">带条件过阀</el-dropdown-item>
                    <el-dropdown-item command="1">不允许过阀</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </PermissionGuard>

            <el-dropdown trigger="click">
              <PermissionButton link type="primary">
                更多
                <el-icon class="clique-workbench__dropdown-icon"><ArrowDown /></el-icon>
              </PermissionButton>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openAttachment(row)">
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
      module-name="过阀预算"
      :loading="importLoading"
      template-text="下载导入模板"
      template-description="请按照要求导入过阀预算标准 Excel 文件"
      upload-tip="只能上传 xlsx 格式文件，且不超过 20MB"
      @import="handleImport"
      @download-template="downloadImportTemplate"
      :template-button-props="{
        permission: 'system:project:valve:download',
      }"
    >
      <el-form label-width="72px">
        <el-form-item label="&#38400;&#28857;" required>
          <el-select
            v-model="importValveId"
            clearable
            filterable
            placeholder="&#35831;&#36873;&#25321;"
            style="width: 100%"
          >
            <el-option
              v-for="item in selectValve"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </BaseImportDialog>
    <BaseFormDialog
      v-model="feishuDialogVisible"
      title="飞书数据导入"
      width="520px"
      append-to-body
      :close-on-click-modal="false"
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
          <div class="feishu-dialog-heading">输入飞书链接</div>
          <div class="feishu-dialog-subtitle">系统将读取飞书文档并进行导入校验。</div>
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
      v-model="attachmentDialogVisible"
    />
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
.clique-workbench__selection {
  color: var(--bq-color-text-muted);
  font-size: 13px;
  line-height: 24px;
}

.clique-workbench__dropdown-icon {
  margin-left: 3px;
  font-size: 12px;
}

.feishu-url-copyable {
  color: var(--bq-color-primary, #409eff);
  white-space: nowrap;
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

