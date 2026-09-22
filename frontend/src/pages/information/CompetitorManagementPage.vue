<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { FormInstance } from "element-plus";
import { CirclePlus, Download, Upload } from "@element-plus/icons-vue";
import {
  createCompetitorExportTask,
  createInformationDictionaryItem,
  deleteInformationDictionaryItem,
  fetchInformationDictionaryItems,
  importCompetitors,
  updateInformationDictionaryItem,
} from "@/api/information";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { downloadLocalTemplate } from "@/utils/download-template";
import { resolvePageTotal } from "@/utils/pagination";
import type { InformationDictionaryItem } from "@/types/information";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type CompetitorForm = {
  id?: number;
  code: string;
  name: string;
  brand: string;
  level: string;
  sortNo: number | null;
  remark: string;
  version?: number;
};

const MODULE_TYPE = "competitors";
const activeTaskId = ref("");

const queryTableRef = ref<QueryTableExpose | null>(null);
const query = reactive({
  name: "",
  brand: "",
  createdAtRange: [] as string[],
});
const form = reactive<CompetitorForm>(emptyForm());
const formRef = ref<FormInstance | null>(null);
const formVisible = ref(false);
const saving = ref(false);
const selectedRows = ref<InformationDictionaryItem[]>([]);
const confirmVisible = ref(false);
const deleteLoading = ref(false);
const pendingDeleteRows = ref<InformationDictionaryItem[]>([]);
const importDialogVisible = ref(false);
const importLoading = ref(false);
const exportLoading = ref(false);

const editing = computed(() => Boolean(form.id));
const formTitle = computed(() => (editing.value ? "编辑竞品" : "新增竞品"));
const deleteConfirmContent = computed(() => {
  if (pendingDeleteRows.value.length > 1) {
    return buildBaseConfirmContent({
      scene: "batchDelete",
      object: "竞品",
      count: pendingDeleteRows.value.length,
    });
  }
  const row = pendingDeleteRows.value[0];
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "delete",
    object: "竞品",
    name: row.name,
  });
});
const formRules: Record<string, unknown> = {
  name: [{ required: true, message: "请填写车型名称", trigger: "blur" }],
  brand: [{ required: true, message: "请填写品牌", trigger: "blur" }],
  level: [
    { required: true, message: "请填写销量（台）", trigger: "blur" },
    {
      pattern: /^[1-9]\d*$/,
      message: "请输入正整数",
      trigger: ["blur", "change"],
    },
  ],
  sortNo: [
    { required: true, message: "请填写实际成交价（万元）", trigger: "blur" },
  ],
  remark: [
    { required: true, message: "请填写市场指导价（万元）", trigger: "blur" },
  ],
};

async function queryItems(pageSize: number, pageNo: number) {
  const { beginTime, endTime } = buildDateRangeParams(createdAtRange());
  const page = await fetchInformationDictionaryItems(MODULE_TYPE, {
    name: query.name.trim() || undefined,
    brand: query.brand.trim() || undefined,
    createdAtStart: beginTime,
    createdAtEnd: endTime,
    pageNo,
    pageSize,
  });
  return {
    total: resolvePageTotal(page, pageNo, pageSize),
    list: page.records,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function createdAtRange() {
  return Array.isArray(query.createdAtRange) ? query.createdAtRange : [];
}

function emptyForm(): CompetitorForm {
  return {
    code: "",
    name: "",
    brand: "",
    level: "",
    sortNo: null,
    remark: "",
  };
}

function resetQuery() {
  query.name = "";
  query.brand = "";
  query.createdAtRange = [];
}

function searchItems() {
  queryTableRef.value?.search();
}

function openCreateDialog() {
  delete form.id;
  delete form.version;
  Object.assign(form, emptyForm());
  formVisible.value = true;
}

function openEditDialog(row: InformationDictionaryItem) {
  Object.assign(form, {
    id: row.itemId,
    code: row.code,
    name: row.name,
    brand: row.brand ?? "",
    level: row.level ?? "",
    sortNo: row.sortNo,
    remark: row.remark ?? "",
    version: row.version,
  });
  formVisible.value = true;
}

async function saveItem() {
  if (saving.value) {
    return;
  }
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  const name = form.name.trim();
  if (!/^[1-9]\d*$/.test(form.level.trim())) {
    BaseToast.error("请输入正整数");
    return;
  }
  const payload = {
    code: form.code.trim() || generateCode(name),
    name,
    brand: form.brand.trim(),
    level: form.level.trim(),
    sortNo: form.sortNo ?? undefined,
    remark: form.remark.trim(),
  };

  saving.value = true;
  try {
    if (form.id) {
      await updateInformationDictionaryItem(MODULE_TYPE, form.id, {
        ...payload,
        version: form.version ?? 0,
      });
      BaseToast.success("竞品已更新");
    } else {
      await createInformationDictionaryItem(MODULE_TYPE, payload);
      BaseToast.success("竞品已新增");
    }
    formVisible.value = false;
    await queryTableRef.value?.reload();
  } finally {
    saving.value = false;
  }
}

function generateCode(name: string) {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `COMP-${hash.toString(36).toUpperCase()}`;
}

function handleSelectionChange(selection: InformationDictionaryItem[]) {
  selectedRows.value = selection;
}

function confirmDelete(row?: InformationDictionaryItem) {
  const ids = row ? [row] : selectedRows.value;
  if (!ids.length) {
    BaseToast.warning("请先选择竞品");
    return;
  }
  pendingDeleteRows.value = ids;
  confirmVisible.value = true;
}

async function deleteItems() {
  if (deleteLoading.value || pendingDeleteRows.value.length === 0) {
    return;
  }
  deleteLoading.value = true;
  try {
    await Promise.all(
      pendingDeleteRows.value.map((row) =>
        deleteInformationDictionaryItem(MODULE_TYPE, row.itemId, row.version),
      ),
    );
    confirmVisible.value = false;
    BaseToast.success(deleteConfirmContent.value.successMessage);
    await queryTableRef.value?.reload();
  } finally {
    deleteLoading.value = false;
  }
}

async function downloadImportTemplate() {
  downloadLocalTemplate("竞品导入模板.xlsx");
}

async function handleImport(uploadFile: { raw?: File }) {
  const file = uploadFile.raw;
  if (!file) {
    BaseToast.warning("请选择需要导入的文件");
    return;
  }
  importLoading.value = true;
  try {
    const task = await importCompetitors(file);
    importDialogVisible.value = false;
    activeTaskId.value = task.taskId;
    BaseToast.success(`竞品导入任务已创建：${task.taskNo || task.taskId}`);
  } catch {
    // BaseToast.error("竞品导入失败");
  } finally {
    importLoading.value = false;
  }
}

async function exportItems() {
  const { beginTime, endTime } = buildDateRangeParams(createdAtRange());
  exportLoading.value = true;
  try {
    const task = await createCompetitorExportTask({
      name: query.name.trim() || undefined,
      brand: query.brand.trim() || undefined,
      createdAtStart: beginTime,
      createdAtEnd: endTime,
    });
    BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
  } finally {
    exportLoading.value = false;
  }
}

function buildDateRangeParams(range: string[]) {
  const [begin, end] = range;
  return {
    beginTime: begin ? `${begin} 00:00:00` : undefined,
    endTime: end ? `${end} 23:59:59` : undefined,
  };
}

function formatCellValue(value: unknown) {
  return value === undefined || value === null || value === ""
    ? "-"
    : String(value);
}
</script>

<template>
  <PageContainer
    title="竞品管理"
    description="维护车型项目对标竞品的基础信息。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryItems"
      row-key="itemId"
      fit-table-height
      empty-title="暂无竞品"
      empty-description="当前条件下没有可展示的竞品。"
      @selection-change="handleSelectionChange"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="车型名称">
            <el-input
              v-model="query.name"
              clearable
              placeholder="请输入车型名称"
              @keyup.enter="searchItems"
            />
          </el-form-item>
          <el-form-item label="品牌">
            <el-input
              v-model="query.brand"
              clearable
              placeholder="请输入品牌"
              @keyup.enter="searchItems"
            />
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdAtRange as string[]"
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
          permission="system:competitor:add"
          variant="primary"
          plain
          type="primary"
          :icon="CirclePlus"
          @click="openCreateDialog"
          >新增</PermissionButton
        >
        <!--        <PermissionButton-->
        <!--          permission="system:competitor:add"-->
        <!--          plain-->
        <!--          :icon="Download"-->
        <!--          @click="downloadImportTemplate"-->
        <!--          >模板下载</PermissionButton-->
        <!--        >-->
        <PermissionButton
          permission="system:competitor:import"
          variant="secondary"
          type="success"
          plain
          :icon="Upload"
          @click="importDialogVisible = true"
          >导入</PermissionButton
        >
        <PermissionButton
          permission="system:competitor:export"
          variant="secondary"
          plain
          type="warning"
          :icon="Download"
          :loading="exportLoading"
          @click="exportItems"
          >导出</PermissionButton
        >
        <PermissionButton
            permission="system:competitor:remove"
            variant="danger"
            type="danger"

            @click="confirmDelete()"
        >删除</PermissionButton
        >
      </template>

      <el-table-column type="selection"  />
      <el-table-column type="index" label="序号"  />
      <el-table-column
        prop="name"
        label="车型名称"
        show-overflow-tooltip
        align="center"
      />
      <el-table-column
        prop="brand"
        label="品牌"
        show-overflow-tooltip
      />
      <el-table-column
        prop="level"
        label="销量（台）"
        align="center"
      >
        <template #default="{ row }">
          {{ formatCellValue(row.level) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="sortNo"
        label="实际成交价（万元）"
        align="center"
      >
        <template #default="{ row }">
          {{ formatCellValue(row.sortNo) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="remark"
        label="市场指导价（万元）"
        show-overflow-tooltip
        align="center"
      />
      <el-table-column label="创建时间" >
        <template #default="{ row }">
          {{ row.createdAt ?? "-" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="system:competitor:edit"
            link
            type="primary"
            @click="openEditDialog(row)"
            >编辑</PermissionButton
          >
          <PermissionButton
            permission="system:competitor:remove"
            link
            @click="confirmDelete(row)"
            >删除</PermissionButton
          >
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="formVisible"
      :title="formTitle"
      :loading="saving"
      width="640px"
      @confirm="saveItem"
    >
      <el-form
        ref="formRef"
        :model="form"
        label-position="top"
        :rules="formRules"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="车型名称" required prop="name">
              <el-input
                v-model="form.name"
                placeholder="请输入车型名称"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="品牌" required prop="brand">
              <el-input
                v-model="form.brand"
                placeholder="请输入品牌"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="销量（台）" required prop="level">
              <el-input
                v-model="form.level"
                type="number"
                min="0"
                placeholder="请输入销量"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="实际成交价（万元）" required prop="sortNo">
              <el-input
                v-model.number="form.sortNo"
                type="number"
                min="0"
                placeholder="请输入实际成交价"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="市场指导价（万元）" required prop="remark">
              <el-input
                v-model="form.remark"
                type="number"
                min="0"
                placeholder="请输入市场指导价"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseImportDialog
      v-model="importDialogVisible"
      module-name="竞品"
      :loading="importLoading"
      template-text="下载导入模板"
      template-title="下载模板"
      template-description="请按照要求导入标准 Excel 文件"
      upload-tip="只能上传 xlsx 格式文件，且不超过 20MB"
      @import="handleImport"
      @download-template="downloadImportTemplate"
    />

    <BaseConfirm
      v-model="confirmVisible"
      :title="deleteConfirmContent.title"
      :message="deleteConfirmContent.message"
      :type="deleteConfirmContent.type"
      :confirm-text="deleteConfirmContent.confirmText"
      :loading="deleteLoading"
      @confirm="deleteItems"
    />
    <TaskStatusPanel v-if="false" :task-id="activeTaskId" />
  </PageContainer>
</template>
