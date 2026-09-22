<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue";
import { CirclePlus, Grid, List, Plus } from "@element-plus/icons-vue";
import type { FormInstance, FormRules, UploadFile } from "element-plus";
import {
  createVehicleModel,
  deleteVehicleModel,
  disableVehicleModel,
  enableVehicleModel,
  fetchBrandOptions,
  fetchVehicleModelDetail,
  fetchVehicleModels,
  updateVehicleModel,
  uploadVehicleModelImage as uploadVehicleModelImageFile,
} from "@/api/project";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDictSelect from "@/components/base/BaseDictSelect.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import VehicleImageFallback from "@/components/business/VehicleImageFallback.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { fetchPlatformDictItems } from "@/api/platform-system";
import { resolvePageTotal } from "@/utils/pagination";
import { validateVehicleImageFile } from "@/utils/vehicle-image";
import type { VehicleModelItem } from "@/types/project";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type ViewMode = "table" | "card";

type VehicleModelForm = {
  vehicleModelId?: number;
  vehicleModelCode: string;
  vehicleModelName: string;
  brand: string | number | null;
  company: string;
  modelYear?: number;
  modelImage: string;
  expectedPrice?: number;
  salesPlan?: number;
  sopTime: string;
  vehicleType: number | null;
  legacyModelNumber: string;
  remark: string;
  version?: number;
};

type DictSelectOption = {
  value: string | number;
  label: string;
};

type TypeOption = {
  value: number | null;
  label: string;
};

type VehicleTypeFormOption = {
  value: number;
  label: string;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const formRef = ref<FormInstance>();
const viewMode = ref<ViewMode>("table");
const query = reactive({
  code: "",
  name: "",
  company: "",
  brand: "",
  sopTime: "",
  vehicleType: null as number | null,
});
const form = reactive<VehicleModelForm>(emptyForm());
const formVisible = ref(false);
const savingModel = ref(false);
const imageUploading = ref(false);
const formImagePreviewUrl = ref("");
const confirmVisible = ref(false);
const deleteConfirmVisible = ref(false);
const deletingModel = ref(false);
const pendingStatusRow = ref<VehicleModelItem | null>(null);
const pendingDeleteRows = ref<VehicleModelItem[]>([]);
const selectedRows = ref<VehicleModelItem[]>([]);
const brandOptions = ref<DictSelectOption[]>([]);
const companyOptions = ref<DictSelectOption[]>([]);

const editing = computed(() => Boolean(form.vehicleModelId));
const formTitle = computed(() => (editing.value ? "编辑车型" : "新增车型"));
const formRules: FormRules<VehicleModelForm> = {
  vehicleModelCode: [
    { required: true, message: "请输入车型编号", trigger: "blur" },
    { whitespace: true, message: "车型编号不能为空", trigger: "blur" },
  ],
  vehicleModelName: [
    { required: true, message: "请输入车型名称", trigger: "blur" },
    { whitespace: true, message: "车型名称不能为空", trigger: "blur" },
  ],
  brand: [{ required: true, message: "请选择品牌", trigger: "change" }],
  vehicleType: [{ required: true, message: "请选择类型", trigger: "change" }],
  expectedPrice: [
    { required: true, message: "请输入MSRP", trigger: "blur" },
    { type: "number", message: "MSRP必须是数字", trigger: "blur" },
  ],
  sopTime: [
    { required: true, message: "请选择SOP时间", trigger: "blur" },
    { whitespace: true, message: "SOP时间不能为空", trigger: "blur" },
  ],
  salesPlan: [
    { required: true, message: "请输入生命周期", trigger: "blur" },
    { type: "number", message: "生命周期必须是数字", trigger: "blur" },
  ],
  company: [
    { required: true, message: "请选择所属公司", trigger: "change" },
    { whitespace: true, message: "所属公司不能为空", trigger: "blur" },
  ],
};
const viewModeOptions = [
  { label: "表格", value: "table" },
  { label: "卡片", value: "card" },
];
const typeOptions: TypeOption[] = [
  { value: null, label: "全部" },
  { value: 1, label: "在产" },
  { value: 2, label: "在研" },
];
const vehicleTypeFormOptions = typeOptions.filter(
    (item): item is VehicleTypeFormOption => item.value !== null,
);
const statusConfirmContent = computed(() => {
  const row = pendingStatusRow.value;
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: row.status === "ENABLED" ? "disable" : "enable",
    object: "车型",
    name: row.vehicleModelName,
  });
});
const deleteConfirmContent = computed(() => {
  if (pendingDeleteRows.value.length > 1) {
    return buildBaseConfirmContent({
      scene: "batchDelete",
      object: "车型",
      count: pendingDeleteRows.value.length,
    });
  }
  const row = pendingDeleteRows.value[0];
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "delete",
    object: "车型",
    name: row.vehicleModelName,
  });
});

async function queryModels(pageSize: number, pageNo: number) {
  const page = await fetchVehicleModels({
    pageNo,
    pageSize,
    code: query.code || undefined,
    name: query.name || undefined,
    company: query.company || undefined,
    brand: query.brand || undefined,
    sopTime: query.sopTime || undefined,
    vehicleType: query.vehicleType ?? undefined,
    sortField: "code",
    sortDirection: "ASC",
  });
  return {
    total: resolvePageTotal(page, pageNo, pageSize),
    list: page.records,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function emptyForm(): VehicleModelForm {
  return {
    vehicleModelCode: "",
    vehicleModelName: "",
    brand: null,
    company: "",
    modelYear: undefined,
    modelImage: "",
    expectedPrice: undefined,
    salesPlan: undefined,
    sopTime: "",
    vehicleType: null,
    legacyModelNumber: "",
    remark: "",
  };
}

function resetQuery() {
  query.code = "";
  query.name = "";
  query.company = "";
  query.brand = "";
  query.sopTime = "";
  query.vehicleType = null;
}

function searchModels() {
  queryTableRef.value?.search();
}

function handleSelectionChange(selection: VehicleModelItem[]) {
  selectedRows.value = selection;
}

function asVehicleModels(list: unknown[]) {
  return list as VehicleModelItem[];
}

function resolveOptionLabel(
    options: Array<DictSelectOption | TypeOption>,
    value?: string | number | null,
) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return (
      options.find((item) => String(item.value) === String(value))?.label ??
      String(value)
  );
}

function resolveBrandLabel(value?: string | number | null) {
  return resolveOptionLabel(brandOptions.value, value);
}

function resolveVehicleTypeLabel(value?: string | number | null) {
  return resolveOptionLabel(typeOptions, value);
}

function toOptionalNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

async function loadBrandOptions() {
  if (brandOptions.value.length > 0) {
    return;
  }
  try {
    const items = await fetchBrandOptions();
    brandOptions.value = items.map((item) => {
      const value =
          item.brandId ?? item.id ?? item.brandCode ?? item.brandName ?? item.name ?? "";
      const label =
          item.brandName ?? item.name ?? item.label ?? String(value);
      return { label, value: String(value) };
    });
  } catch {
    brandOptions.value = [];
  }
}

async function loadCompanyOptions() {
  if (companyOptions.value.length > 0) {
    return;
  }
  try {
    const items = await fetchPlatformDictItems("company_list_set");
    companyOptions.value = items.map(({ value, label }) => ({ value, label }));
  } catch {
    companyOptions.value = [];
  }
}

function revokeObjectUrl(url?: string) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function resolveVehicleImageUrl(
    modelImage?: string | null,
    _businessId?: string | number | null,
) {
  void _businessId;
  const value = modelImage?.trim();
  if (!value) {
    return "";
  }
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) {
    return value;
  }
  if (value.startsWith("/api/") || value === "/api") {
    return value;
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${baseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
}

function resolveVehicleImageRequestUrl(modelImage?: string | null) {
  return resolveVehicleImageUrl(modelImage);
}

async function openCreateDialog() {
  await Promise.all([loadBrandOptions(), loadCompanyOptions()]);
  delete form.vehicleModelId;
  delete form.version;
  Object.assign(form, emptyForm());
  revokeObjectUrl(formImagePreviewUrl.value);
  formImagePreviewUrl.value = "";
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function openEditDialog(row: VehicleModelItem) {
  const [detail] = await Promise.all([
    fetchVehicleModelDetail(row.vehicleModelId).catch(() => row),
    loadBrandOptions(),
    loadCompanyOptions(),
  ]);
  Object.assign(form, {
    vehicleModelId: detail.vehicleModelId,
    vehicleModelCode: detail.vehicleModelCode,
    vehicleModelName: detail.vehicleModelName,
    brand: detail.brand === null || detail.brand === undefined ? "" : String(detail.brand),
    company: detail.company ?? "",
    modelYear: detail.modelYear ?? undefined,
    modelImage: detail.modelImage ?? "",
    expectedPrice: toOptionalNumber(detail.expectedPrice),
    salesPlan: detail.salesPlan ?? undefined,
    sopTime: detail.sopTime ?? "",
    vehicleType: toOptionalNumber(detail.vehicleType) ?? null,
    legacyModelNumber: detail.legacyModelNumber ?? "",
    remark: detail.remark ?? "",
    version: detail.version,
  });
  revokeObjectUrl(formImagePreviewUrl.value);
  formImagePreviewUrl.value = resolveVehicleImageUrl(
      detail.modelImage,
      detail.vehicleModelId,
  );
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function saveModel() {
  if (savingModel.value) {
    return;
  }
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const vehicleModelCode = form.vehicleModelCode.trim();
  const vehicleModelName = form.vehicleModelName.trim();

  const payload = {
    vehicleModelName,
    brand:
        form.brand !== null && form.brand !== undefined && form.brand !== ""
            ? String(form.brand)
            : undefined,
    company: form.company.trim() || undefined,
    modelYear: form.modelYear || undefined,
    modelImage: form.modelImage.trim() || undefined,
    expectedPrice: form.expectedPrice ?? undefined,
    salesPlan: form.salesPlan || undefined,
    sopTime: form.sopTime || undefined,
    vehicleType: form.vehicleType ?? undefined,
    legacyModelNumber: form.legacyModelNumber.trim() || undefined,
    remark: form.remark.trim() || undefined,
  };

  savingModel.value = true;
  try {
    if (form.vehicleModelId) {
      const vehicleModelId = form.vehicleModelId;
      const updated = await updateVehicleModel(vehicleModelId, {
        vehicleModelCode,
        ...payload,
        version: form.version ?? 0,
      });
      form.version = updated.version;
      BaseToast.success("车型已更新");
    } else {
      const created = await createVehicleModel({
        vehicleModelCode,
        ...payload,
        status: "ENABLED",
      });
      form.vehicleModelId = created.vehicleModelId;
      form.version = created.version;
      BaseToast.success("车型已新增");
    }
    formVisible.value = false;
    await queryTableRef.value?.reload();
  } finally {
    savingModel.value = false;
  }
}

async function handleImageFileChange(uploadFile: UploadFile) {
  const file = uploadFile.raw;
  if (!file) {
    return;
  }
  const validationMessage = validateVehicleImageFile(file);
  if (validationMessage) {
    BaseToast.warning(validationMessage);
    return;
  }

  revokeObjectUrl(formImagePreviewUrl.value);
  formImagePreviewUrl.value = URL.createObjectURL(file);
  imageUploading.value = true;
  try {
    form.modelImage = await uploadVehicleModelImageFile(file);
    BaseToast.success("车型图片已上传");
  } catch {
    form.modelImage = "";
  } finally {
    imageUploading.value = false;
  }
}

onBeforeUnmount(() => {
  revokeObjectUrl(formImagePreviewUrl.value);
});

onMounted(() => {
  void loadBrandOptions();
  void loadCompanyOptions();
});

async function changeStatus() {
  const row = pendingStatusRow.value;
  if (!row) {
    return;
  }
  if (row.status === "ENABLED") {
    await disableVehicleModel(row.vehicleModelId);
    BaseToast.success("车型已停用");
  } else {
    await enableVehicleModel(row.vehicleModelId);
    BaseToast.success("车型已启用");
  }
  confirmVisible.value = false;
  pendingStatusRow.value = null;
  await queryTableRef.value?.reload();
}

function openDeleteConfirm(row: VehicleModelItem) {
  pendingDeleteRows.value = [row];
  deleteConfirmVisible.value = true;
}

function openBatchDeleteConfirm() {
  if (!selectedRows.value.length) {
    BaseToast.warning("请先选择要删除的车型");
    return;
  }
  pendingDeleteRows.value = [...selectedRows.value];
  deleteConfirmVisible.value = true;
}

async function deleteModel() {
  if (deletingModel.value || !pendingDeleteRows.value.length) {
    return;
  }
  const ids = pendingDeleteRows.value
      .map((row) => row.vehicleModelId)
      .join(",");
  deletingModel.value = true;
  try {
    await deleteVehicleModel(ids);
    BaseToast.success(deleteConfirmContent.value.successMessage);
    deleteConfirmVisible.value = false;
    pendingDeleteRows.value = [];
    selectedRows.value = [];
    await queryTableRef.value?.reload();
  } finally {
    deletingModel.value = false;
  }
}
</script>

<template>
  <PageContainer
      title="车型管理"
      description="维护车型主数据，供项目、成本 BOM 和收益测算选择。"
  >
    <QueryTable
        ref="queryTableRef"
        :func="queryModels"
        row-key="vehicleModelId"
        fit-table-height
        :table-props="{ scrollbarAlwaysOn: true }"
        empty-title="暂无匹配车型"
        empty-description="当前筛选条件下没有可展示的车型数据。"
        @selection-change="handleSelectionChange"
        @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="车型编号">
            <el-input
                v-model="query.code"
                clearable
                placeholder="请输入车型编号"
                @keyup.enter="searchModels"
            />
          </el-form-item>
          <el-form-item label="车型名称">
            <el-input
                v-model="query.name"
                clearable
                placeholder="请输入车型名称"
                @keyup.enter="searchModels"
            />
          </el-form-item>
          <el-form-item label="所属公司">
            <el-select
                v-model="query.company"
                clearable
                placeholder="请选择所属公司"
            >
              <el-option
                  v-for="company in companyOptions"
                  :key="String(company.value)"
                  :label="company.label"
                  :value="company.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="SOP时间">
            <el-date-picker
                v-model="query.sopTime"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择SOP时间"
                clearable
            />
          </el-form-item>
          <el-form-item label="品牌">
            <el-input
                v-model="query.brand"
                clearable
                placeholder="请输入品牌"
                @keyup.enter="searchModels"
            />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="query.vehicleType" clearable placeholder="全部">
              <el-option
                  v-for="item in typeOptions"
                  :key="String(item.value)"
                  :label="item.label"
                  :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <div class="vehicle-model-toolbar">
          <div class="vehicle-model-toolbar-group">
            <PermissionButton
                permission="system:vehicle:model:add"
                variant="primary"
                type="primary"
                plain
                :icon="CirclePlus"
                @click="openCreateDialog"
            >新增</PermissionButton
            >
            <PermissionButton
                permission="system:vehicle:model:remove"
                variant="danger"
                type="danger"
                @click="openBatchDeleteConfirm"
            >
              批量删除
            </PermissionButton>
          </div>
          <div class="vehicle-model-toolbar-group">
            <el-segmented
                v-model="viewMode"
                :options="viewModeOptions"
                aria-label="车型展示方式"
            >
              <template #default="{ item }">
                <span class="vehicle-model-view-option">
                  <el-icon>
                    <List v-if="item.value === 'table'" />
                    <Grid v-else />
                  </el-icon>
                  <span>{{ item.label }}</span>
                </span>
              </template>
            </el-segmented>
          </div>
        </div>
      </template>

      <template v-if="viewMode === 'card'" #content="{ list, loading, height }">
        <div
            v-loading="loading"
            class="vehicle-model-card-panel"
            :style="{ height: height ? `${height}px` : undefined }"
        >
          <el-empty
              v-if="!loading && !list.length"
              description="当前筛选条件下没有可展示的车型数据。"
          />
          <div v-else class="vehicle-model-card-grid">
            <article
                v-for="row in asVehicleModels(list)"
                :key="row.vehicleModelId"
                class="vehicle-model-card"
            >
              <header class="vehicle-model-card__header">
                <el-image
                    class="vehicle-model-card__image"
                    :src="
                    resolveVehicleImageUrl(row.modelImage, row.vehicleModelId)
                  "
                    :preview-src-list="
                    resolveVehicleImageUrl(row.modelImage, row.vehicleModelId)
                      ? [
                          resolveVehicleImageUrl(
                            row.modelImage,
                            row.vehicleModelId,
                          ),
                        ]
                      : []
                  "
                    fit="cover"
                    preview-teleported
                >
                  <template #error>
                    <VehicleImageFallback />
                  </template>
                </el-image>
                <div class="vehicle-model-card__title">
                  <strong>{{ row.vehicleModelName || "-" }}</strong>
                  <span>车型编号：{{ row.vehicleModelCode || "-" }}</span>
                </div>
                <!--                <PermissionGuard-->
                <!--                    :permission="row.status === 'ENABLED' ? 'master-data:vehicle-model:disable' : 'master-data:vehicle-model:enable'"-->
                <!--                >-->
                <!--                  <el-switch-->
                <!--                      class="vehicle-model-card__status"-->
                <!--                      :model-value="row.status === 'ENABLED'"-->
                <!--                      @change="openStatusConfirm(row)"-->
                <!--                  />-->
                <!--                </PermissionGuard>-->
              </header>
              <dl class="vehicle-model-card__fields">
                <div class="vehicle-model-card__field">
                  <dt>品牌</dt>
                  <dd>{{ resolveBrandLabel(row.brand) }}</dd>
                </div>
                <div class="vehicle-model-card__field">
                  <dt>所属公司</dt>
                  <dd>{{ row.company || "-" }}</dd>
                </div>
                <div class="vehicle-model-card__field">
                  <dt>MSRP（万元）</dt>
                  <dd>{{ row.expectedPrice ?? "-" }}</dd>
                </div>
                <div class="vehicle-model-card__field">
                  <dt>生命周期（台）</dt>
                  <dd>{{ row.salesPlan ?? "-" }}</dd>
                </div>
                <div class="vehicle-model-card__field">
                  <dt>SOP时间</dt>
                  <dd>{{ row.sopTime || "-" }}</dd>
                </div>
                <div class="vehicle-model-card__field">
                  <dt>类型</dt>
                  <dd>{{ resolveVehicleTypeLabel(row.vehicleType) }}</dd>
                </div>
              </dl>
              <footer class="vehicle-model-card__actions">
                <PermissionButton
                    permission="system:vehicle:model:edit"
                    link
                    type="primary"
                    @click="openEditDialog(row)"
                >编辑
                </PermissionButton>
                <PermissionButton
                    permission="system:vehicle:model:remove"
                    link
                    @click="openDeleteConfirm(row)"
                >删除
                </PermissionButton>
              </footer>
            </article>
          </div>
        </div>
      </template>

      <el-table-column type="selection" width="48"  />
      <el-table-column type="index" label="序号" width="70" />
      <el-table-column
          prop="vehicleModelCode"
          label="车型编号"
          min-width="160"
          show-overflow-tooltip
      />
      <el-table-column
          prop="vehicleModelName"
          label="车型名称"
          min-width="180"
          show-overflow-tooltip
      />
      <el-table-column label="车型图片" width="180" align="center">
        <template #default="{ row }">
          <div class="vehicle-model-table-image-cell">
            <el-image
                class="vehicle-model-table-image"
                :src="resolveVehicleImageRequestUrl(row.modelImage)"
                :preview-src-list="
                resolveVehicleImageRequestUrl(row.modelImage)
                  ? [resolveVehicleImageRequestUrl(row.modelImage)]
                  : []
              "
                fit="cover"
                preview-teleported
            >
              <template #error>
                <VehicleImageFallback />
              </template>
            </el-image>
            <!--            <el-tooltip-->
            <!--              v-if="-->
            <!--                resolveVehicleImageRequestUrl(-->
            <!--                  row.modelImage,-->
            <!--                  row.vehicleModelId,-->
            <!--                )-->
            <!--              "-->
            <!--              :content="-->
            <!--                resolveVehicleImageRequestUrl(-->
            <!--                  row.modelImage,-->
            <!--                  row.vehicleModelId,-->
            <!--                )-->
            <!--              "-->
            <!--              placement="top"-->
            <!--            >-->
            <!--              <span class="vehicle-model-table-image__url">-->
            <!--                {{-->
            <!--                  resolveVehicleImageRequestUrl(-->
            <!--                    row.modelImage,-->
            <!--                    row.vehicleModelId,-->
            <!--                  )-->
            <!--                }}-->
            <!--              </span>-->
            <!--            </el-tooltip>-->
          </div>
        </template>
      </el-table-column>
      <el-table-column label="品牌" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ resolveBrandLabel(row.brand) }}
        </template>
      </el-table-column>
      <!--      <el-table-column label="项目状态" width="100">-->
      <!--        <template #default="{ row }">-->
      <!--          <PermissionGuard-->
      <!--              :permission="row.status === 'ENABLED' ? 'master-data:vehicle-model:disable' : 'master-data:vehicle-model:enable'"-->
      <!--          >-->
      <!--            <el-switch-->
      <!--                :model-value="row.status === 'ENABLED'"-->
      <!--                @change="openStatusConfirm(row)"-->
      <!--            />-->
      <!--          </PermissionGuard>-->
      <!--        </template>-->
      <!--      </el-table-column>-->
      <el-table-column
          prop="company"
          label="所属公司"
          min-width="150"
          show-overflow-tooltip
      />
      <el-table-column
          prop="expectedPrice"
          label="MSRP（万元）"
          min-width="140"
      />
      <el-table-column
          prop="salesPlan"
          label="生命周期（台）"
          min-width="130"
      />
      <el-table-column prop="sopTime" label="SOP时间" min-width="130" />
      <el-table-column label="类型" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">
          {{ resolveVehicleTypeLabel(row.vehicleType) }}
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="140">
        <template #default="{ row }">
          {{ row.createTime || "-" }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
              permission="system:vehicle:model:edit"
              link
              type="primary"
              @click="openEditDialog(row)"
          >编辑
          </PermissionButton>
          <PermissionButton
              permission="system:vehicle:model:remove"
              link
              @click="openDeleteConfirm(row)"
          >删除
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
        v-model="formVisible"
        :title="formTitle"
        :loading="savingModel"
        width="720px"
        @confirm="saveModel"
    >
      <el-form
          ref="formRef"
          :model="form"
          :rules="formRules"
          class="vehicle-model-form"
          label-position="top"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="车型编号" prop="vehicleModelCode">
              <el-input
                  v-model="form.vehicleModelCode"
                  placeholder="请输入车型编号"
              />
              <!--              :disabled="editing"-->
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="车型名称" prop="vehicleModelName">
              <el-input
                  v-model="form.vehicleModelName"
                  placeholder="请输入车型名称"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="品牌" prop="brand">
              <BaseDictSelect
                  v-model="form.brand"
                  dict-type="brand_type"
                  :options="brandOptions"
                  filterable
                  placeholder="请选择品牌"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属公司" prop="company">
              <BaseDictSelect
                  v-model="form.company"
                  dict-type="company_list_set"
                  :options="companyOptions"
                  clearable
                  placeholder="请选择所属公司"
              />
            </el-form-item>
          </el-col>
          <!--          <el-col :span="12">-->
          <!--            <el-form-item label="年款">-->
          <!--              <el-input-number v-model="form.modelYear" :min="1900" :max="2100" controls-position="right" />-->
          <!--            </el-form-item>-->
          <!--          </el-col>-->
          <el-col :span="12">
            <el-form-item label="MSRP（万元）" prop="expectedPrice">
              <el-input-number
                  v-model="form.expectedPrice"
                  :min="0"
                  :precision="2"
                  :step="1"
                  controls-position="right"
                  placeholder="请输入MSRP加权值"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="生命周期（台）" prop="salesPlan">
              <el-input-number
                  v-model="form.salesPlan"
                  placeholder="请输入生命周期"
                  :min="0"
                  controls-position="right"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="SOP时间" prop="sopTime">
              <el-date-picker
                  v-model="form.sopTime"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="请选择SOP时间"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="类型" prop="vehicleType">
              <el-select
                  v-model="form.vehicleType"
                  clearable
                  placeholder="请选择类型"
              >
                <el-option
                    v-for="item in vehicleTypeFormOptions"
                    :key="String(item.value)"
                    :label="item.label"
                    :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="车型图片（支持 JPG、PNG、JPEG格式）">
              <div class="vehicle-model-image-field">
                <el-upload
                    class="vehicle-model-image-uploader"
                    :class="{ 'is-uploading': imageUploading }"
                    :auto-upload="false"
                    :show-file-list="false"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    :on-change="handleImageFileChange"
                >
                  <el-image
                      v-if="formImagePreviewUrl"
                      class="vehicle-model-image-uploader__image"
                      :src="formImagePreviewUrl"
                      fit="cover"
                  />
                  <el-icon v-else class="vehicle-model-image-uploader__icon">
                    <Plus />
                  </el-icon>
                </el-upload>
                <!--                <span class="vehicle-model-image-tip">支持 JPG、PNG 等图片，大小不超过 5MB。</span>-->
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseConfirm
        v-model="confirmVisible"
        :title="statusConfirmContent.title"
        :message="statusConfirmContent.message"
        :type="statusConfirmContent.type"
        :confirm-text="statusConfirmContent.confirmText"
        @confirm="changeStatus"
    />
    <BaseConfirm
        v-model="deleteConfirmVisible"
        :title="deleteConfirmContent.title"
        :message="deleteConfirmContent.message"
        :type="deleteConfirmContent.type"
        :confirm-text="deleteConfirmContent.confirmText"
        :loading="deletingModel"
        @confirm="deleteModel"
    />
  </PageContainer>
</template>

<style scoped>
.vehicle-model-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.vehicle-model-toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 6px;
  background: var(--el-bg-color);
}

.vehicle-model-view-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 52px;
  justify-content: center;
}

.vehicle-model-form :deep(.el-input-number),
.vehicle-model-form :deep(.el-date-editor.el-input) {
  width: 100%;
}

.vehicle-model-card-panel {
  min-height: 260px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

.vehicle-model-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(292px, 1fr));
  gap: 14px;
}

.vehicle-model-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  transition:
      border-color 0.16s ease,
      box-shadow 0.16s ease;
}

.vehicle-model-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 16px rgb(48 84 135 / 8%);
}

.vehicle-model-card__header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 64px;
  padding: 12px 72px 10px 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.vehicle-model-card__image {
  display: block;
  width: 76px;
  height: 44px;
  flex: 0 0 76px;
  overflow: hidden;
  border-radius: 4px;
  background: #eef3f8;
}

.vehicle-model-card__status {
  position: absolute;
  top: 14px;
  right: 16px;
}

.vehicle-model-card__image-fallback,
.vehicle-model-table-image__fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #2f5f8f;
  font-weight: 700;
}

.vehicle-model-card__image-fallback {
  font-size: 20px;
}

.vehicle-model-table-image {
  width: 56px;
  height: 42px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  background: #eef3f8;
  overflow: hidden;
  vertical-align: middle;
}

.vehicle-model-table-image-cell {
  display: grid;
  justify-items: center;
  gap: 4px;
  min-width: 0;
}

.vehicle-model-table-image__fallback {
  font-size: 16px;
}

.vehicle-model-table-image__url {
  display: block;
  max-width: 156px;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vehicle-model-image-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.vehicle-model-image-uploader {
  display: inline-block;
  width: 112px;
  height: 112px;
}

.vehicle-model-image-uploader :deep(.el-upload) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112px;
  height: 112px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: #eef3f8;
  cursor: pointer;
  transition:
      border-color 0.16s ease,
      color 0.16s ease;
}

.vehicle-model-image-uploader :deep(.el-upload:hover) {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.vehicle-model-image-uploader.is-uploading :deep(.el-upload) {
  cursor: progress;
  opacity: 0.72;
}

.vehicle-model-image-uploader__image {
  width: 100%;
  height: 100%;
}

.vehicle-model-image-uploader__icon {
  color: var(--el-text-color-secondary);
  font-size: 22px;
}

.vehicle-model-image-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}

.vehicle-model-card__title {
  display: grid;
  flex: 1;
  gap: 5px;
  min-width: 0;
}

.vehicle-model-card__title strong,
.vehicle-model-card__title span,
.vehicle-model-card__fields dd {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vehicle-model-card__title strong {
  color: var(--el-text-color-primary);
  font-size: 16px;
  font-weight: 700;
  line-height: 18px;
}

.vehicle-model-card__title span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.vehicle-model-card__fields {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 6px 18px 8px;
}

.vehicle-model-card__field {
  display: grid;
  grid-template-columns: minmax(112px, 44%) 1fr;
  align-items: center;
  min-width: 0;
  min-height: 27px;
  border-bottom: 1px dashed #d8dee9;
}

.vehicle-model-card__field:last-child {
  border-bottom: 0;
}

.vehicle-model-card__field dt,
.vehicle-model-card__field dd {
  margin: 0;
  min-width: 0;
  font-size: 14px;
  line-height: 18px;
}

.vehicle-model-card__field dt {
  color: var(--el-text-color-secondary);
}

.vehicle-model-card__field dd {
  color: var(--el-text-color-primary);
  text-align: left;
}

.vehicle-model-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  min-height: 34px;
  padding: 7px 14px 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

@media (max-width: 640px) {
  .vehicle-model-card-grid {
    grid-template-columns: 1fr;
  }

  .vehicle-model-card__header {
    padding-right: 18px;
    align-items: flex-start;
  }

  .vehicle-model-card__status {
    position: static;
    flex: 0 0 auto;
  }

  .vehicle-model-card__field {
    grid-template-columns: 108px 1fr;
  }
}
</style>
