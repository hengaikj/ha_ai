<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import { CirclePlus } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import { createSor, deleteSor, fetchSors, updateSor } from "@/api/project";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { resolvePageTotal } from "@/utils/pagination";
import { toDateTimeRangeParams } from "@/utils/date-range";
import type { SorItem } from "@/types/project";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type SorForm = {
  sorId?: number;
  sorCode: string;
  sorName: string;
  remark: string;
  version?: number;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const formRef = ref<FormInstance>();
const query = reactive({
  code: "",
  name: "",
  createdAtRange: [] as string[],
});
const form = reactive<SorForm>(emptyForm());
const formVisible = ref(false);
const saving = ref(false);
const confirmVisible = ref(false);
const deleteLoading = ref(false);
const pendingDeleteRows = ref<SorItem[]>([]);
const selectedRows = ref<SorItem[]>([]);

const editing = computed(() => Boolean(form.sorId));
const formTitle = computed(() => (editing.value ? "编辑SOR" : "新增SOR"));
const formRules: FormRules<SorForm> = {
  sorCode: [
    { required: true, message: "请输入系统级名称", trigger: "blur" },
    { whitespace: true, message: "系统级名称不能为空", trigger: "blur" },
  ],
  sorName: [
    { required: true, message: "请输入SOR名称", trigger: "blur" },
    { whitespace: true, message: "SOR名称不能为空", trigger: "blur" },
  ],
};
const deleteConfirmContent = computed(() => {
  if (pendingDeleteRows.value.length > 1) {
    return buildBaseConfirmContent({
      scene: "batchDelete",
      object: "SOR",
      count: pendingDeleteRows.value.length,
    });
  }
  const row = pendingDeleteRows.value[0];
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "delete",
    object: "SOR",
    name: row.sorName,
  });
});

async function querySors(pageSize: number, pageNo: number) {
  const { createdFrom, createdTo } = toDateTimeRangeParams(createdAtRange());
  const page = await fetchSors({
    sorCode: query.code.trim() || undefined,
    sorName: query.name.trim() || undefined,
    createdAtStart: createdFrom,
    createdAtEnd: createdTo,
    pageNo,
    pageSize,
  } as Parameters<typeof fetchSors>[0]);
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

function emptyForm(): SorForm {
  return {
    sorCode: "",
    sorName: "",
    remark: "",
  };
}

function resetQuery() {
  query.code = "";
  query.name = "";
  query.createdAtRange = [];
}

function searchSors() {
  queryTableRef.value?.search();
}

function openCreateDialog() {
  delete form.sorId;
  delete form.version;
  Object.assign(form, emptyForm());
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

function openEditDialog(row: SorItem) {
  Object.assign(form, {
    sorId: row.sorId,
    sorCode: row.sorCode,
    sorName: row.sorName,
    remark: row.remark ?? "",
    version: row.version,
  });
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function saveSor() {
  if (saving.value) {
    return;
  }
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const sorCode = form.sorCode.trim();
  const sorName = form.sorName.trim();

  const payload = {
    sorCode,
    sorName,
    remark: form.remark.trim() || undefined,
  };

  saving.value = true;
  try {
    if (form.sorId) {
      await updateSor(form.sorId, { ...payload, version: form.version ?? 0 });
      BaseToast.success("SOR已更新");
    } else {
      await createSor(payload);
      BaseToast.success("SOR已新增");
    }
    formVisible.value = false;
    await queryTableRef.value?.reload();
  } finally {
    saving.value = false;
  }
}

function handleSelectionChange(selection: SorItem[]) {
  selectedRows.value = selection;
}

function confirmDelete(row?: SorItem) {
  const ids = row ? [row] : selectedRows.value;
  if (!ids.length) {
    BaseToast.warning("请先选择SOR");
    return;
  }
  pendingDeleteRows.value = ids;
  confirmVisible.value = true;
}

async function deleteSors() {
  if (deleteLoading.value || pendingDeleteRows.value.length === 0) {
    return;
  }
  deleteLoading.value = true;
  try {
    await Promise.all(
      pendingDeleteRows.value.map((row) => deleteSor(row.sorId)),
    );
    confirmVisible.value = false;
    BaseToast.success(deleteConfirmContent.value.successMessage);
    await queryTableRef.value?.reload();
  } finally {
    deleteLoading.value = false;
  }
}
</script>

<template>
  <PageContainer
    title="SOR管理"
    description="维护 SOR 零件、供应商、车型和项目基础关系。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="querySors"
      row-key="sorId"
      fit-table-height
      empty-title="暂无 SOR"
      empty-description="当前条件下没有可展示的 SOR 数据。"
      @selection-change="handleSelectionChange"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="系统级名称">
            <el-input
              v-model="query.code"
              clearable
              placeholder="请输入系统级名称"
              @keyup.enter="searchSors"
            />
          </el-form-item>
          <el-form-item label="SOR名称">
            <el-input
              v-model="query.name"
              clearable
              placeholder="请输入SOR名称"
              @keyup.enter="searchSors"
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
          permission="system:sor:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="openCreateDialog"
          >新增</PermissionButton
        >
        <PermissionButton
          permission="system:sor:remove"
          variant="danger"
          type="danger"
          plain
          @click="confirmDelete()"
          >删除</PermissionButton
        >
      </template>

      <el-table-column type="selection"  />
      <el-table-column type="index" label="序号"  />
      <el-table-column
        prop="sorCode"
        label="系统级名称"
        show-overflow-tooltip
      />
      <el-table-column
        prop="sorName"
        label="SOR名称"
        show-overflow-tooltip
      />
      <el-table-column label="创建时间" >
        <template #default="{ row }">
          {{ row.createdAt ?? "-" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
            <PermissionButton
              permission="system:sor:edit"
              link
              type="primary"
              @click="openEditDialog(row)"
              >编辑</PermissionButton
            >
            <PermissionButton
              permission="system:sor:remove"
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
      @confirm="saveSor"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-position="top"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="系统级名称" prop="sorCode">
              <el-input
                v-model="form.sorCode"
                placeholder="请输入系统级名称"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="SOR名称" prop="sorName">
              <el-input v-model="form.sorName" placeholder="请输入SOR名称" clearable />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseConfirm
      v-model="confirmVisible"
      :title="deleteConfirmContent.title"
      :message="deleteConfirmContent.message"
      :type="deleteConfirmContent.type"
      :confirm-text="deleteConfirmContent.confirmText"
      :loading="deleteLoading"
      @confirm="deleteSors"
    />
  </PageContainer>
</template>
