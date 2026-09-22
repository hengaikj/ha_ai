<script setup lang="ts">
import { resolveServerTotal } from "@/utils/pagination";
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import {
  Delete,
  Download,
  Grid,
  List,
  Paperclip,
  RefreshRight,
  Search,
  Upload,
} from "@element-plus/icons-vue";
import type { UploadFile } from "element-plus";
import {
  attachmentUpload,
  createAttachmentPackageTask,
  lixiangDelete,
  lixiangDownload,
  lixiangList,
  type AttachmentRow,
} from "@/api/attachments";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import BasePagination from "@/components/base/BasePagination.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";

declare global {
  interface Window {
    previewFrameLoadingFun?: () => void;
  }
}

const types = [
  {
    name: "XLSX",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  { name: "XLS", type: "application/vnd.ms-excel" },
  { name: "DOC", type: "application/msword" },
  {
    name: "DOCX",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  { name: "PDF", type: "application/pdf" },
  { name: "TXT", type: "text/plain" },
];

type WorkbenchRow = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    bizCode?: string;
  }>(),
  {
    bizCode: "biz_pass",
  },
);

const visible = defineModel<boolean>({ default: false });

const loading = ref(false);
const downloading = ref(false);
const uploadVisible = ref(false);
const uploading = ref(false);
const previewVisible = ref(false);
const previewFrame = ref<HTMLIFrameElement | null>(null);
const iframeReady = ref(false);
const searTime = ref<[string, string] | null>(null);
const tableData = ref<AttachmentRow[]>([]);
const viewMode = ref<"table" | "grid">("table");
const latestPackageTaskId = ref<string>();
const pendingPreview = ref<{ blob: Blob; name: string } | null>(null);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const searchForm = reactive({
  startTime: "",
  endTime: "",
  pageNum: 1,
  pageSize: 10,
  bizCode: props.bizCode,
  bizId: null as string | number | null,
  total: 0,
  params: {
    beginTime: null as string | null,
    endTime: null as string | null,
  },
});

const haveChecked = computed(() =>
  tableData.value.some((item) => item.checked),
);
const checkedAll = computed({
  get: () =>
    tableData.value.length > 0 && tableData.value.every((item) => item.checked),
  set: (value: boolean) => {
    tableData.value.forEach((item) => {
      item.checked = value;
    });
  },
});

watch(searTime, (value) => {
  if (value) {
    searchForm.params.beginTime = `${value[0]} 00:00:00`;
    searchForm.params.endTime = `${value[1]} 23:59:59`;
  } else {
    searchForm.params.beginTime = null;
    searchForm.params.endTime = null;
  }
});

function handlePreviewFrameLoading() {
  iframeReady.value = true;
  flushPendingPreview();
}

function setupPreviewFrameCallback() {
  window.previewFrameLoadingFun = handlePreviewFrameLoading;
}

function teardownPreviewFrameCallback() {
  if (window.previewFrameLoadingFun === handlePreviewFrameLoading) {
    window.previewFrameLoadingFun = undefined;
  }
}

function deactivateAttachmentDialog() {
  teardownPreviewFrameCallback();
  visible.value = false;
  uploadVisible.value = false;
  handlePreviewClose();
}

onMounted(setupPreviewFrameCallback);
onActivated(setupPreviewFrameCallback);
onDeactivated(deactivateAttachmentDialog);
onBeforeUnmount(teardownPreviewFrameCallback);

function init(row: WorkbenchRow) {
  latestPackageTaskId.value = undefined;
  searchForm.pageNum = 1;
  searchForm.pageSize = 10;
  searchForm.bizCode = props.bizCode;
  searchForm.bizId = (row.id ?? null) as string | number | null;
  searchForm.total = 0;
  searchForm.params.beginTime = null;
  searchForm.params.endTime = null;
  searTime.value = null;
  visible.value = true;
  void getList();
}

async function getList() {
  if (!searchForm.bizId) return;
  loading.value = true;
  try {
    const res = await lixiangList(
      searchForm as unknown as Record<string, unknown>,
    );
    const rows = res.rows ?? [];
    rows.forEach((item) => {
      const type = types.find((typeItem) => typeItem.type === item.fileType);
      item.checked = false;
      if (type) item.fileType = type.name;
    });
    tableData.value = rows;
    searchForm.total = resolveServerTotal(res.total);
  } catch {
    BaseToast.error("附件列表加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  searchForm.pageNum = 1;
  void getList();
}

function handleReset() {
  searTime.value = null;
  searchForm.pageNum = 1;
  void nextTick(() => getList());
}

function handlePageChange(pageNo: number) {
  searchForm.pageNum = pageNo;
  void getList();
}

function handleSizeChange(pageSize: number) {
  searchForm.pageSize = pageSize;
  searchForm.pageNum = 1;
  void getList();
}

function handleSelectionChange(selection: AttachmentRow[]) {
  tableData.value.forEach((item) => {
    item.checked = selection.some((selected) => selected.id === item.id);
  });
}

function handleUpload() {
  uploadVisible.value = true;
}

async function uploadFun(file: File, name: string) {
  if (!searchForm.bizId) return;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", name);
  await attachmentUpload(searchForm.bizId, formData, props.bizCode);
}

async function submitUpload(file: UploadFile) {
  if (!file.raw) return;
  uploading.value = true;
  try {
    await uploadFun(file.raw, file.name);
    BaseToast.success("操作成功");
    uploadVisible.value = false;
    await getList();
  } catch {
    BaseToast.error("附件上传失败");
  } finally {
    uploading.value = false;
  }
}

async function handleBatchDelete() {
  try {
    await openConfirm({
      title: "提示",
      message: "确定删除选中项吗？",
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
  } catch {
    return;
  }
  downloading.value = true;
  try {
    const ids = tableData.value
      .filter((item) => item.checked)
      .map((item) => item.id);
    const formData = new FormData();
    formData.append("ids", ids.join(","));
    await lixiangDelete(formData);
    BaseToast.success("操作成功");
    await getList();
  } catch {
    BaseToast.error("删除失败");
  } finally {
    downloading.value = false;
  }
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function getFileMimeType(row: AttachmentRow) {
  return types.find((item) => item.name === row.fileType)?.type || "";
}

async function handleBatchDownload() {
  const attachmentIds = tableData.value
    .filter((item) => item.checked)
    .map((item) => Number(item.id))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!attachmentIds.length) {
    BaseToast.warning("请选择有效附件");
    return;
  }
  downloading.value = true;
  try {
    const task = await createAttachmentPackageTask(attachmentIds);
    latestPackageTaskId.value = task.taskId;
    BaseToast.success(`附件打包任务已创建：${task.taskNo || task.taskId}`);
  } catch {
    BaseToast.error("附件打包任务创建失败");
  } finally {
    downloading.value = false;
  }
}

async function handleDownload(row: AttachmentRow) {
  if (!row.filePath && !row.fileUrl) return;
  try {
    const response = row.fileUrl
      ? { data: await fetchFileUrl(row.fileUrl) }
      : await lixiangDownload(String(row.filePath));
    const mimeType = getFileMimeType(row);
    const blob = mimeType
      ? new Blob([response.data], { type: mimeType })
      : response.data;
    downloadBlob(blob, row.fileName || "附件");
  } catch {
    BaseToast.error("下载失败");
  }
}

async function handlePreview(row: AttachmentRow) {
  if (!row.filePath && !row.fileUrl) return;
  try {
    const response = row.fileUrl
      ? { data: await fetchFileUrl(row.fileUrl) }
      : await lixiangDownload(String(row.filePath));
    const mimeType = getFileMimeType(row);
    const blob = mimeType
      ? new Blob([response.data], { type: mimeType })
      : response.data;
    pendingPreview.value = { blob, name: row.fileName || "附件" };
    previewVisible.value = true;
    await nextTick();
    flushPendingPreview();
  } catch {
    BaseToast.error("预览失败");
  }
}

async function fetchFileUrl(fileUrl: string): Promise<Blob> {
  const response = await globalThis.fetch(fileUrl);
  if (!response.ok) {
    throw new Error("附件资源获取失败");
  }
  return response.blob();
}

function flushPendingPreview() {
  const pending = pendingPreview.value;
  const frameWindow = previewFrame.value?.contentWindow as
    | (Window & { doPreview?: (blob: Blob, name: string) => void })
    | null;
  if (!pending || !iframeReady.value || !frameWindow?.doPreview) return;
  frameWindow.doPreview(pending.blob, pending.name);
}

function handlePreviewClose() {
  previewVisible.value = false;
  pendingPreview.value = null;
  iframeReady.value = false;
}

function toggleViewMode() {
  viewMode.value = viewMode.value === "table" ? "grid" : "table";
}

defineExpose({ init });
</script>

<template>
  <BaseFormDialog
    v-model="visible"
    title="附件"
    width="1100px"
    top="6vh"
    :show-footer="false"
    body-max-height="76vh"
  >
    <div class="attachment-dialog">
      <el-form :inline="true" class="attachment-dialog__search">
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="searTime"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            搜索
          </el-button>
          <el-button :icon="RefreshRight" @click="handleReset">
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <div class="attachment-dialog__toolbar">
        <PermissionButton
          variant="primary"
          type="primary"
          plain
          :icon="Upload"
          @click="handleUpload"
        >
          附件上传
        </PermissionButton>
        <PermissionButton
          variant="danger"
          type="danger"
          plain
          :icon="Delete"
          :loading="downloading"
          @click="handleBatchDelete"
        >
          批量删除
        </PermissionButton>
        <PermissionButton
          variant="secondary"
          type="warning"
          plain
          :icon="Download"
          :loading="downloading"
          :disabled="!haveChecked"
          @click="handleBatchDownload"
        >
          批量下载
        </PermissionButton>
        <el-button class="attachment-dialog__mode" @click="toggleViewMode">
          <el-icon><Grid v-if="viewMode === 'table'" /><List v-else /></el-icon>
        </el-button>
      </div>

      <TaskStatusPanel v-if="false" :task-id="latestPackageTaskId" />

      <BaseDataTable
        v-if="viewMode === 'table'"
        :data="tableData"
        :loading="loading"
        row-key="id"
        border
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column
          prop="fileName"
          label="附件名称"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column prop="fileType" label="文件类型" width="120" />
        <el-table-column prop="createTime" label="上传时间" width="180" />
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <PermissionButton
              link
              type="primary"
              @click="handlePreview(row)"
              >预览</PermissionButton
            >
            <PermissionButton
              link
              type="primary"
              @click="handleDownload(row)"
              >下载</PermissionButton
            >
          </template>
        </el-table-column>
      </BaseDataTable>

      <div v-else class="attachment-grid">
        <div class="attachment-grid__header">
          <el-checkbox
            v-model="checkedAll"
            :indeterminate="haveChecked && !checkedAll"
          >
            全选
          </el-checkbox>
        </div>
        <el-empty v-if="!tableData.length" description="暂无数据" />
        <div v-else class="attachment-grid__list">
          <div v-for="item in tableData" :key="item.id" class="attachment-card">
            <el-checkbox
              v-model="item.checked"
              class="attachment-card__check"
            />
            <el-icon class="attachment-card__icon"><Paperclip /></el-icon>
            <div class="attachment-card__name">{{ item.fileName }}</div>
            <div class="attachment-card__time">{{ item.createTime }}</div>
            <div class="attachment-card__actions">
              <PermissionButton
                variant="secondary"
                @click="handlePreview(item)"
                >预览</PermissionButton
              >
              <PermissionButton
                variant="secondary"
                @click="handleDownload(item)"
                >下载</PermissionButton
              >
            </div>
          </div>
        </div>
      </div>

      <BasePagination
        class="attachment-dialog__pagination"
        :page-no="searchForm.pageNum"
        :page-size="searchForm.pageSize"
        :total="searchForm.total"
        @page-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </BaseFormDialog>

  <BaseImportDialog
    v-model="uploadVisible"
    title="附件上传"
    module-name="附件"
    accept=".pdf,.doc,.docx,.xls,.xlsx"
    :loading="uploading"
    :max-size-mb="50"
    template-title="附件上传"
    template-description="支持上传 pdf、doc、docx、xls、xlsx 格式附件"
    template-text=""
    upload-tip="支持格式：pdf、doc、docx、xls、xlsx，单文件最大 50MB"
    @import="submitUpload"
  />

  <el-dialog
    v-model="previewVisible"
    title="预览"
    fullscreen
    append-to-body
    destroy-on-close
    @closed="handlePreviewClose"
  >
    <div class="attachment-preview">
      <iframe
        ref="previewFrame"
        src="/html/file-preview.html"
        frameborder="0"
        width="100%"
        height="100%"
      />
    </div>
  </el-dialog>

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
</template>

<style scoped>
.attachment-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attachment-dialog__search :deep(.el-form-item) {
  margin-bottom: 0;
}

.attachment-dialog__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.attachment-dialog__mode {
  margin-left: auto;
}

.attachment-dialog__pagination {
  margin-top: 4px;
}

.attachment-grid__header {
  margin-bottom: 10px;
}

.attachment-grid__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.attachment-card {
  position: relative;
  min-height: 168px;
  padding: 18px 12px 12px;
  border: 1px solid var(--bq-color-border);
  border-radius: 6px;
  background: var(--bq-color-surface);
  text-align: center;
}

.attachment-card__check {
  position: absolute;
  top: 8px;
  left: 8px;
}

.attachment-card__icon {
  margin: 20px 0 10px;
  color: var(--bq-color-primary);
  font-size: 36px;
}

.attachment-card__name {
  height: 40px;
  overflow: hidden;
  color: var(--bq-color-text);
  font-weight: 500;
  line-height: 20px;
}

.attachment-card__time {
  margin-top: 4px;
  color: var(--bq-color-text-muted);
  font-size: 12px;
}

.attachment-card__actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}

.attachment-preview {
  width: 100%;
  height: calc(100vh - 70px);
  overflow: hidden;
}

:global(.el-dialog.is-fullscreen .el-dialog__body) {
  padding: 0;
}
</style>
