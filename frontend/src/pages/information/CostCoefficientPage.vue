<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import { CirclePlus } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  createCostCoefficient,
  deleteCostCoefficient,
  fetchCostCoefficientDetail,
  fetchCostCoefficients,
  updateCostCoefficient,
  type CostCoefficientPayload,
  type CostCoefficientRow,
} from "@/api/information-management";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { resolvePageTotal } from "@/utils/pagination";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type FormModel = CostCoefficientPayload;

const queryTableRef = ref<QueryTableExpose | null>(null);
const formRef = ref<FormInstance>();
const query = reactive({
  bomUnit: "",
  srmPriceUnit: "",
  conversionCoefficient: "",
});
const form = reactive<FormModel>(emptyForm());
const formVisible = ref(false);
const formLoading = ref(false);
const confirmVisible = ref(false);
const confirmLoading = ref(false);
const pendingDeleteRows = ref<CostCoefficientRow[]>([]);
const selectedRows = ref<CostCoefficientRow[]>([]);

const editing = computed(() => Boolean(form.id));
const formTitle = computed(() =>
  editing.value ? "编辑成本转换系数" : "新增成本转换系数",
);
const deleteConfirmContent = computed(() => {
  if (pendingDeleteRows.value.length > 1) {
    return buildBaseConfirmContent({
      scene: "batchDelete",
      object: "成本转换系数",
      count: pendingDeleteRows.value.length,
    });
  }
  const row = pendingDeleteRows.value[0];
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "delete",
    object: "成本转换系数",
    name: `${row.bomUnit ?? "-"} -> ${row.srmPriceUnit ?? "-"}`,
  });
});

const formRules: FormRules<FormModel> = {
  bomUnit: [
    { required: true, message: "请输入度量单位(BOM单位)", trigger: "blur" },
    { whitespace: true, message: "度量单位(BOM单位)不能为空", trigger: "blur" },
  ],
  srmPriceUnit: [
    { required: true, message: "请输入价格单位(SRM单位)", trigger: "blur" },
    { whitespace: true, message: "价格单位(SRM单位)不能为空", trigger: "blur" },
  ],
  conversionCoefficient: [
    { required: true, message: "请输入转换系数", trigger: "blur" },
    { whitespace: true, message: "转换系数不能为空", trigger: "blur" },
    {
      validator: (_rule, value: string, callback) => {
        if (isValidCostCoefficient(value)) {
          callback();
          return;
        }
        callback(new Error("转换系数必须大于0，整数最多14位且最多保留6位小数"));
      },
      trigger: "blur",
    },
  ],
};

function isValidCostCoefficient(value: string) {
  const normalized = value.trim();
  return (
    /^\d{1,14}(?:\.\d{1,6})?$/.test(normalized) &&
    Number(normalized) > 0
  );
}

function toPlainDecimal(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (!/[eE]/.test(text)) {
    return text;
  }
  const match = text.match(/^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/);
  if (!match) {
    return text;
  }
  const [, sign, integer, fraction = "", exponentText] = match;
  const digits = `${integer}${fraction}`;
  const decimalIndex = integer.length + Number(exponentText);
  let plain: string;
  if (decimalIndex <= 0) {
    plain = `0.${"0".repeat(-decimalIndex)}${digits}`;
  } else if (decimalIndex >= digits.length) {
    plain = `${digits}${"0".repeat(decimalIndex - digits.length)}`;
  } else {
    plain = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }
  return sign === "-" ? `-${plain}` : plain;
}

function emptyForm(): FormModel {
  return {
    bomUnit: "",
    srmPriceUnit: "",
    conversionCoefficient: "",
  };
}

async function queryCoefficients(pageSize: number, pageNo: number) {
  const page = await fetchCostCoefficients({
    pageNo,
    pageSize,
    bomUnit: query.bomUnit.trim() || undefined,
    srmPriceUnit: query.srmPriceUnit.trim() || undefined,
    conversionCoefficient: query.conversionCoefficient.trim() || undefined,
  });
  return {
    total: resolvePageTotal(page, pageNo, pageSize),
    list: page.records,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function resetQuery() {
  query.bomUnit = "";
  query.srmPriceUnit = "";
  query.conversionCoefficient = "";
}

function searchList() {
  queryTableRef.value?.search();
}

function openCreateDialog() {
  Object.assign(form, emptyForm());
  delete form.id;
  delete form.version;
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function openEditDialog(row: CostCoefficientRow) {
  if (!row.id) {
    BaseToast.warning("当前记录缺少主键，无法编辑");
    return;
  }
  formLoading.value = true;
  try {
    const detail = await fetchCostCoefficientDetail(row.id);
    Object.assign(form, {
      id: detail.id ?? row.id,
      bomUnit: detail.bomUnit ?? "",
      srmPriceUnit: detail.srmPriceUnit ?? "",
      conversionCoefficient: toPlainDecimal(detail.conversionCoefficient),
      version: detail.version ?? undefined,
    });
    formVisible.value = true;
    nextTick(() => formRef.value?.clearValidate());
  } finally {
    formLoading.value = false;
  }
}

async function saveItem() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  if (!isValidCostCoefficient(form.conversionCoefficient)) {
    BaseToast.warning("转换系数必须大于0，整数最多14位且最多保留6位小数");
    return;
  }

  formLoading.value = true;
  try {
    const payload = {
      id: form.id,
      bomUnit: form.bomUnit.trim(),
      srmPriceUnit: form.srmPriceUnit.trim(),
      conversionCoefficient: form.conversionCoefficient.trim(),
      version: form.version,
    };
    if (editing.value) {
      await updateCostCoefficient(payload);
      BaseToast.success("成本转换系数已更新");
    } else {
      await createCostCoefficient(payload);
      BaseToast.success("成本转换系数已新增");
    }
    formVisible.value = false;
    await queryTableRef.value?.reload();
  } finally {
    formLoading.value = false;
  }
}

function handleSelectionChange(selection: CostCoefficientRow[]) {
  selectedRows.value = selection;
}

function confirmDelete(row?: CostCoefficientRow) {
  const rows = row ? [row] : selectedRows.value;
  if (!rows.length) {
    BaseToast.warning("请先选择成本转换系数");
    return;
  }
  pendingDeleteRows.value = rows;
  confirmVisible.value = true;
}

async function deleteItems() {
  const ids = pendingDeleteRows.value
    .map((item) => item.id)
    .filter((id): id is string | number => id !== undefined);
  if (!ids.length) {
    confirmVisible.value = false;
    return;
  }
  confirmLoading.value = true;
  try {
    await deleteCostCoefficient(ids);
    confirmVisible.value = false;
    BaseToast.success(deleteConfirmContent.value.successMessage);
    await queryTableRef.value?.reload();
  } finally {
    confirmLoading.value = false;
  }
}
</script>

<template>
  <PageContainer
    title="成本转换系数"
    description="维护 BOM 单位与 SRM 价格单位的转换关系。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryCoefficients"
      row-key="id"
      fit-table-height
      empty-title="暂无成本转换系数"
      empty-description="当前条件下没有可展示的成本转换系数。"
      @selection-change="handleSelectionChange"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="度量单位(BOM单位)">
            <el-input
              v-model="query.bomUnit"
              clearable
              placeholder="请输入度量单位(BOM单位)"
              @keyup.enter="searchList"
            />
          </el-form-item>
          <el-form-item label="价格单位(SRM单位)">
            <el-input
              v-model="query.srmPriceUnit"
              clearable
              placeholder="请输入价格单位(SRM单位)"
              @keyup.enter="searchList"
            />
          </el-form-item>
          <el-form-item label="转换系数">
            <el-input
              v-model="query.conversionCoefficient"
              clearable
              placeholder="请输入转换系数"
              @keyup.enter="searchList"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          permission="system:coefficient:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="openCreateDialog"
        >
          新增
        </PermissionButton>
        <PermissionButton
          permission="system:coefficient:remove"
          variant="danger"
          plain
          type="danger"
          @click="confirmDelete()"
        >
          批量删除
        </PermissionButton>
      </template>

      <el-table-column type="selection" width="48" />
      <el-table-column type="index" label="序号" width="70" />
      <el-table-column
        prop="bomUnit"
        label="度量单位(BOM单位)"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="srmPriceUnit"
        label="价格单位(SRM单位)"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="conversionCoefficient"
        label="转换系数"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column
        prop="createBy"
        label="创建人"
        min-width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row.createBy || "--" }}
        </template>
      </el-table-column>
      <el-table-column
        prop="createTime"
        label="创建时间"
        min-width="180"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <BaseDateTime :value="row.createTime" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="system:coefficient:edit"
            link
            type="primary"
            @click="openEditDialog(row)"
          >
            编辑
          </PermissionButton>
          <PermissionButton
            permission="system:coefficient:remove"
            link
            @click="confirmDelete(row)"
          >
            删除
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="formVisible"
      :title="formTitle"
      width="560px"
      :loading="formLoading"
      @confirm="saveItem"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-position="top"
      >
        <el-form-item label="度量单位(BOM单位)" prop="bomUnit">
          <el-input
            v-model="form.bomUnit"
            placeholder="请输入度量单位(BOM单位)"
            maxlength="50"
          />
        </el-form-item>
        <el-form-item label="价格单位(SRM单位)" prop="srmPriceUnit">
          <el-input
            v-model="form.srmPriceUnit"
            placeholder="请输入价格单位(SRM单位)"
            maxlength="50"
          />
        </el-form-item>
        <el-form-item label="转换系数" prop="conversionCoefficient">
          <el-input
            v-model="form.conversionCoefficient"
            placeholder="请输入转换系数"
            inputmode="decimal"
            maxlength="21"
          />
        </el-form-item>
      </el-form>
    </BaseFormDialog>

    <BaseConfirm
      v-model="confirmVisible"
      :title="deleteConfirmContent.title"
      :message="deleteConfirmContent.message"
      :type="deleteConfirmContent.type"
      :confirm-text="deleteConfirmContent.confirmText"
      :loading="confirmLoading"
      @confirm="deleteItems"
    />
  </PageContainer>
</template>
