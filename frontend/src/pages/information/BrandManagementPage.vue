<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  shallowRef,
} from "vue";
import { CirclePlus, Close, UploadFilled } from "@element-plus/icons-vue";
import type { FormInstance, FormRules, UploadFile } from "element-plus";
import {
  createBrand,
  fetchBrands,
  updateBrand,
  uploadBrandSpectrumImage,
  type BackendId,
  type BrandRow,
  type BrandStatus,
} from "@/api/information-management";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { resolvePageTotal } from "@/utils/pagination";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type BrandTableRow = {
  id: BackendId;
  brandName: string;
  patternAttachmentId?: BackendId | null;
  patternFileName: string;
  patternImageUrl: string;
  brandSpectrumLabel: string;
  sortNo: number;
  status: BrandStatus;
  updateTime: string;
  remark: string;
  version?: BackendId | null;
};

type BrandForm = {
  id?: BackendId;
  brandName: string;
  patternAttachmentId?: BackendId | null;
  patternFileName: string;
  patternImageUrl: string;
  sortNo?: number;
  status: BrandStatus;
  remark: string;
  version?: BackendId | null;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const formRef = ref<FormInstance>();
const query = reactive({
  brandName: "",
  status: "" as BrandStatus | "",
});
const form = reactive<BrandForm>(emptyForm());
const formVisible = ref(false);
const statusConfirmVisible = ref(false);
const pendingStatusRow = ref<BrandTableRow | null>(null);
const pendingSpectrumFile = shallowRef<File>();
const spectrumUploading = ref(false);
const spectrumPreviewUrl = ref("");

const editing = computed(() => Boolean(form.id));
const formTitle = computed(() => (editing.value ? "编辑品牌" : "新增品牌"));
const statusConfirmContent = computed(() => {
  const row = pendingStatusRow.value;
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: row.status === "ENABLED" ? "disable" : "enable",
    object: "品牌",
    name: row.brandName,
  });
});
const formRules: FormRules<BrandForm> = {
  brandName: [
    { required: true, message: "请输入品牌名称", trigger: "blur" },
    { whitespace: true, message: "品牌名称不能为空", trigger: "blur" },
  ],
  sortNo: [
    {
      type: "number",
      min: 0,
      message: "排序不能小于 0",
      trigger: ["blur", "change"],
    },
  ],
};

async function queryBrands(pageSize: number, pageNo: number) {
  const page = await fetchBrands({
    brandName: query.brandName.trim() || undefined,
    status: query.status || undefined,
    pageNo,
    pageSize,
  });
  const list = page.records.map(mapBrandRow);
  return {
    total: resolvePageTotal({ ...page, records: list }, pageNo, pageSize),
    list,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function mapBrandRow(item: BrandRow): BrandTableRow {
  const patternImageUrl = item.patternImageUrl ?? item.brandSpectrum ?? "";
  const patternFileName = item.patternFileName ?? item.spectrumName ?? "";
  return {
    id: item.id ?? item.brandName ?? item.name ?? "",
    brandName: item.brandName ?? item.name ?? "",
    patternAttachmentId: item.patternAttachmentId,
    patternFileName,
    patternImageUrl,
    brandSpectrumLabel:
      item.patternAttachmentId || patternImageUrl ? "已上传" : "未上传",
    sortNo: Number(item.sortNo ?? item.sort ?? 0),
    status: normalizeStatus(item.status),
    updateTime:
      item.updateTime ??
      item.updatedAt ??
      item.createTime ??
      item.createdAt ??
      "",
    remark: item.remark ?? "",
    version: item.version,
  };
}

function normalizeStatus(status?: string | null): BrandStatus {
  return status === "1" || status === "DISABLED" ? "DISABLED" : "ENABLED";
}

function emptyForm(): BrandForm {
  return {
    brandName: "",
    patternAttachmentId: null,
    patternFileName: "",
    patternImageUrl: "",
    sortNo: 1,
    status: "ENABLED",
    remark: "",
  };
}

function resetQuery() {
  query.brandName = "";
  query.status = "";
}

function searchBrands() {
  queryTableRef.value?.search();
}

function formatCellValue(value: unknown) {
  return value === undefined || value === null || value === ""
    ? "-"
    : String(value);
}

function openCreateDialog() {
  delete form.id;
  delete form.version;
  Object.assign(form, emptyForm());
  pendingSpectrumFile.value = undefined;
  revokeObjectUrl(spectrumPreviewUrl.value);
  spectrumPreviewUrl.value = "";
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

function openEditDialog(row: BrandTableRow) {
  Object.assign(form, {
    id: row.id,
    brandName: row.brandName,
    patternAttachmentId: row.patternAttachmentId,
    patternFileName: row.patternFileName,
    patternImageUrl: row.patternImageUrl,
    sortNo: row.sortNo,
    status: row.status,
    remark: row.remark,
    version: row.version,
  });
  pendingSpectrumFile.value = undefined;
  revokeObjectUrl(spectrumPreviewUrl.value);
  spectrumPreviewUrl.value = resolveBrandSpectrumUrl(row.patternImageUrl);
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function saveBrand() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  if (!form.patternAttachmentId && !pendingSpectrumFile.value) {
    BaseToast.warning("请上传品牌型谱");
    return;
  }

  const payload = {
    id: form.id,
    brandName: form.brandName.trim(),
    sortNo: form.sortNo,
    status: form.status,
    remark: form.remark.trim() || undefined,
    version: form.version,
  };

  const wasEditing = Boolean(form.id);
  let brandId = form.id;
  if (brandId) {
    await updateBrand(payload);
  } else {
    brandId = await createBrand(payload);
    form.id = brandId;
  }
  if (pendingSpectrumFile.value) {
    spectrumUploading.value = true;
    try {
      form.patternAttachmentId = await uploadBrandSpectrumImage(
        brandId,
        pendingSpectrumFile.value,
      );
      form.patternFileName = pendingSpectrumFile.value.name;
      pendingSpectrumFile.value = undefined;
    } finally {
      spectrumUploading.value = false;
    }
  }
  BaseToast.success(wasEditing ? "品牌已更新" : "品牌已新增");
  formVisible.value = false;
  await queryTableRef.value?.reload();
}

function revokeObjectUrl(url?: string) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function resolveBrandSpectrumUrl(value?: string | null) {
  const path = value?.trim();
  if (!path) {
    return "";
  }
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) {
    return path;
  }
  if (path.startsWith("/api/") || path === "/api") {
    return path;
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

function validateSpectrumFile(file: File) {
  const allowedTypes = ["image/jpeg", "image/png"];
  const allowedExtensions = /\.(jpe?g|png)$/i;
  if (!allowedTypes.includes(file.type) && !allowedExtensions.test(file.name)) {
    return "仅支持 JPG、JPEG、PNG 格式";
  }
  if (file.size > 5 * 1024 * 1024) {
    return "图片大小不能超过 5MB";
  }
  return "";
}

async function handleSpectrumFileChange(uploadFile: UploadFile) {
  const file = uploadFile.raw;
  if (!file) {
    return;
  }
  const validationMessage = validateSpectrumFile(file);
  if (validationMessage) {
    BaseToast.warning(validationMessage);
    return;
  }

  revokeObjectUrl(spectrumPreviewUrl.value);
  spectrumPreviewUrl.value = URL.createObjectURL(file);
  pendingSpectrumFile.value = file;
  form.patternFileName = file.name;
}

function clearSpectrumImage(event?: MouseEvent) {
  event?.preventDefault();
  event?.stopPropagation();
  revokeObjectUrl(spectrumPreviewUrl.value);
  spectrumPreviewUrl.value = "";
  pendingSpectrumFile.value = undefined;
  form.patternAttachmentId = null;
  form.patternFileName = "";
  form.patternImageUrl = "";
}

function confirmToggleStatus(row: BrandTableRow) {
  pendingStatusRow.value = row;
  statusConfirmVisible.value = true;
}

async function toggleStatus() {
  const row = pendingStatusRow.value;
  if (!row) return;

  const nextStatus: BrandStatus =
    row.status === "ENABLED" ? "DISABLED" : "ENABLED";
  await updateBrand({
    id: row.id,
    brandName: row.brandName,
    sortNo: row.sortNo,
    status: nextStatus,
    remark: row.remark || undefined,
    version: row.version,
  });
  statusConfirmVisible.value = false;
  BaseToast.success(statusConfirmContent.value.successMessage);
  await queryTableRef.value?.reload();
}

onBeforeUnmount(() => {
  revokeObjectUrl(spectrumPreviewUrl.value);
});
</script>

<template>
  <PageContainer
    class="brand-management-page"
    title="品牌管理"
    description="维护品牌名称、品牌型谱、排序和启停状态。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryBrands"
      row-key="id"
      fit-table-height
      :table-props="{ scrollbarAlwaysOn: true }"
      empty-title="暂无品牌"
      empty-description="当前条件下没有可展示的品牌数据。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="品牌名称">
            <el-input
              v-model="query.brandName"
              clearable
              placeholder="请输入品牌名称"
              @keyup.enter="searchBrands"
            />
          </el-form-item>
          <el-form-item label="品牌状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择品牌状态"
            >
              <el-option label="启用" value="ENABLED" />
              <el-option label="停用" value="DISABLED" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          permission="system:brand:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="openCreateDialog"
          >新增</PermissionButton
        >
      </template>

      <el-table-column type="index" label="序号"  />
      <el-table-column
        prop="brandName"
        label="品牌名称"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="品牌型谱" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.patternImageUrl"
            class="brand-spectrum-table-thumbnail"
            :src="resolveBrandSpectrumUrl(row.patternImageUrl)"
            fit="contain"
            :preview-src-list="[resolveBrandSpectrumUrl(row.patternImageUrl)]"
            preview-teleported
          />
          <span v-else>{{ row.brandSpectrumLabel }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="sortNo" label="排序"  >
        <template #default="{ row }">
          {{ formatCellValue(row.sortNo) }}
        </template>
      </el-table-column>
      <el-table-column label="品牌状态">
        <template #default="{ row }">
          <BaseStatusTag
            :status="row.status"
            :type="row.status === 'ENABLED' ? 'success' : 'danger'"
          />
        </template>
      </el-table-column>
      <el-table-column label="更新时间" >
        <template #default="{ row }">
          {{ row.updateTime || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="system:brand:edit"
            link
            type="primary"
            @click="openEditDialog(row)"
            >编辑</PermissionButton
          >
          <PermissionButton
            permission="system:brand:edit"
            link
            :type="row.status === 'ENABLED' ? 'danger' : 'primary'"
            @click="confirmToggleStatus(row)"
          >
            {{ row.status === "ENABLED" ? "停用" : "启用" }}
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="formVisible"
      :title="formTitle"
      class="brand-form-dialog"
      width="720px"
      top="12vh"
      @confirm="saveBrand"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        class="brand-form"
        label-position="top"
      >
        <el-form-item label="品牌名称" prop="brandName" required>
          <el-input
            v-model="form.brandName"
            clearable
            maxlength="100"
            show-word-limit
            placeholder="请输入品牌名称"
          />
        </el-form-item>
        <el-form-item label="排序" prop="sortNo">
          <el-input-number
            v-model="form.sortNo"
            :min="0"
            :precision="0"
            :step="1"
            controls-position="right"
            placeholder="请输入排序"
          />
        </el-form-item>
        <el-form-item label="品牌型谱" required>
          <PermissionGuard permission="system:brand:upload">
            <el-upload
              class="brand-spectrum-uploader"
              :class="{
                'brand-spectrum-uploader--preview': spectrumPreviewUrl,
              }"
              drag
              :auto-upload="false"
              :show-file-list="false"
              :disabled="spectrumUploading"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              :on-change="handleSpectrumFileChange"
            >
              <div
                v-if="spectrumPreviewUrl"
                class="brand-spectrum-upload-preview"
              >
                <el-image
                  class="brand-spectrum-uploader__image"
                  :src="spectrumPreviewUrl"
                  fit="contain"
                />
                <button
                  class="brand-spectrum-upload-preview__remove"
                  type="button"
                  aria-label="删除品牌型谱"
                  @click.stop.prevent="clearSpectrumImage"
                >
                  <el-icon><Close /></el-icon>
                </button>
              </div>
              <template v-else>
                <el-icon class="brand-spectrum-uploader__icon">
                  <UploadFilled />
                </el-icon>
                <div class="brand-spectrum-uploader__title">上传品牌型谱</div>
                <div class="brand-spectrum-uploader__tip">
                  JPG、JPEG、PNG，大小不超过5MB
                </div>
              </template>
            </el-upload>
          </PermissionGuard>
        </el-form-item>
      </el-form>
    </BaseFormDialog>

    <BaseConfirm
      v-model="statusConfirmVisible"
      :title="statusConfirmContent.title"
      :message="statusConfirmContent.message"
      :type="statusConfirmContent.type"
      :confirm-text="statusConfirmContent.confirmText"
      @confirm="toggleStatus"
    />
  </PageContainer>
</template>

<style scoped>
.brand-management-page {
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height) - 40px
  );
  min-height: 0;
  overflow: hidden;
}

.brand-form {
  display: grid;
  gap: 16px;
}

.brand-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.brand-form :deep(.el-form-item__label) {
  margin-bottom: 8px;
  color: var(--bq-color-text);
  font-weight: 500;
}

.brand-form :deep(.el-input),
.brand-form :deep(.el-input-number) {
  width: 100%;
}

.brand-form :deep(.el-input-number) {
  max-width: 146px;
}

.brand-spectrum-uploader {
  width: 100%;
}

.brand-spectrum-uploader :deep(.el-upload) {
  width: 100%;
}

.brand-spectrum-uploader :deep(.el-upload-dragger) {
  height: 230px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-color: var(--bq-color-border);
  border-radius: 4px;
  background: var(--bq-color-surface);
  text-align: center;
}

.brand-spectrum-uploader--preview :deep(.el-upload-dragger) {
  height: auto;
  min-height: 230px;
  padding: 12px;
}

.brand-spectrum-uploader__image {
  display: block;
  width: 100%;
  height: auto;
}

.brand-spectrum-uploader__image :deep(.el-image__inner) {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

.brand-spectrum-upload-preview {
  position: relative;
  width: 100%;
  max-height: 320px;
  overflow-y: auto;
}

.brand-spectrum-upload-preview__remove {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--bq-color-border);
  border-radius: 50%;
  color: var(--bq-color-text-secondary);
  background: var(--bq-color-surface);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  cursor: pointer;
}

.brand-spectrum-upload-preview__remove:hover {
  color: var(--bq-color-danger);
  border-color: var(--bq-color-danger);
}

.brand-spectrum-uploader__icon {
  display: block;
  margin: 0 0 10px;
  color: var(--bq-color-text-secondary);
  font-size: 28px;
}

.brand-spectrum-uploader__title {
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.brand-spectrum-uploader__tip {
  margin-top: 14px;
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.brand-spectrum-table-thumbnail {
  width: 96px;
  height: 48px;
  vertical-align: middle;
}

:global(.brand-form-dialog.el-dialog) {
  max-width: calc(100vw - 32px);
}

:global(.brand-form-dialog .el-dialog__header) {
  min-height: 68px;
  padding: 0 30px;
}

:global(.brand-form-dialog .el-dialog__headerbtn) {
  right: 20px;
  width: 68px;
  height: 68px;
}

:global(.brand-form-dialog .el-dialog__body) {
  padding: 26px 30px 30px;
}

:global(.brand-form-dialog .el-dialog__footer) {
  min-height: 58px;
  padding: 10px 30px 14px;
}

.brand-form {
  gap: 18px;
}

.brand-form :deep(.el-input__wrapper),
.brand-form :deep(.el-input-number .el-input__wrapper) {
  min-height: 40px;
}

.brand-form :deep(.el-input-number) {
  max-width: 184px;
}
</style>
