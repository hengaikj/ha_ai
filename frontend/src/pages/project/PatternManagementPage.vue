<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import { CirclePlus } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  createCostBomPattern,
  deleteCostBomPattern,
  fetchCostBomPatternDetail,
  fetchCostBomPatterns,
  updateCostBomPattern,
} from "@/api/cost-center";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { resolvePageTotal } from "@/utils/pagination";
import type {
  CostBomPatternItem,
  CostBomPatternPageResponse,
} from "@/types/cost-center";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type QueryTableSort = {
  sortField?: string;
  sortDirection?: "ASC" | "DESC";
};

type PatternForm = {
  patternId?: number;
  patternCode: string;
  patternName: string;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const formRef = ref<FormInstance>();
const query = reactive({
  patternCode: "",
  patternName: "",
  createdAtRange: [] as string[] | null,
});
const form = reactive<PatternForm>(emptyForm());
const formVisible = ref(false);
const savingPattern = ref(false);
const deleteConfirmVisible = ref(false);
const deleting = ref(false);
const pendingDeleteRows = ref<CostBomPatternItem[]>([]);
const selectedRows = ref<CostBomPatternItem[]>([]);

const editing = computed(() => Boolean(form.patternId));
const formTitle = computed(() => (editing.value ? "编辑版型" : "新增版型"));
const formRules: FormRules<PatternForm> = {
  patternName: [
    { required: true, message: "请输入版型名称", trigger: "blur" },
    { whitespace: true, message: "版型名称不能为空", trigger: "blur" },
  ],
};
const deleteConfirmContent = computed(() => {
  if (pendingDeleteRows.value.length > 1) {
    return buildBaseConfirmContent({
      scene: "batchDelete",
      object: "版型",
      count: pendingDeleteRows.value.length,
    });
  }
  const row = pendingDeleteRows.value[0];
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "delete",
    object: "版型",
    name: row.patternName,
  });
});

async function queryPatterns(
  pageSize: number,
  pageNo: number,
  sort: QueryTableSort,
) {
  const [createdAtStart, createdAtEnd] = Array.isArray(query.createdAtRange)
    ? query.createdAtRange
    : [];
  const page = await fetchCostBomPatterns({
    pageNo,
    pageSize,
    patternCode: query.patternCode.trim() || undefined,
    patternName: query.patternName.trim() || undefined,
    createdAtStart: createdAtStart ? `${createdAtStart} 00:00:00` : undefined,
    createdAtEnd: createdAtEnd ? `${createdAtEnd} 23:59:59` : undefined,
    sortField: sort.sortField,
    sortDirection: sort.sortDirection,
  });
  return normalizePatternPage(page, pageSize, pageNo);
}

function normalizePatternPage(
  page: CostBomPatternPageResponse,
  pageSize: number,
  pageNo: number,
) {
  if (!Array.isArray(page)) {
    return {
      total: resolvePageTotal(page, pageNo, pageSize),
      list: page.records,
      pageNo: page.pageNo,
      pageSize: page.pageSize,
    };
  }

  return {
    total: page.length,
    list: page,
    pageNo,
    pageSize,
  };
}

function emptyForm(): PatternForm {
  return {
    patternId: undefined,
    patternCode: "",
    patternName: "",
  };
}

function resetQuery() {
  query.patternCode = "";
  query.patternName = "";
  query.createdAtRange = [];
}

function searchPatterns() {
  queryTableRef.value?.search();
}

function handleSelectionChange(selection: CostBomPatternItem[]) {
  selectedRows.value = selection;
}

function openCreateDialog() {
  Object.assign(form, emptyForm());
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function openEditDialog(row: CostBomPatternItem) {
  const detail = await fetchCostBomPatternDetail(row.patternId).catch(
    () => row,
  );
  Object.assign(form, {
    patternId: detail.patternId,
    patternCode: detail.patternCode,
    patternName: detail.patternName,
  });
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function savePattern() {
  if (savingPattern.value) {
    return;
  }
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const patternCode = form.patternCode.trim();
  const patternName = form.patternName.trim();

  savingPattern.value = true;
  try {
    if (form.patternId) {
      await updateCostBomPattern(form.patternId, {
        patternName,
        version: 0,
      });
      BaseToast.success("版型已更新");
    } else {
      await createCostBomPattern({
        patternCode,
        patternName,
      });
      BaseToast.success("版型已新增");
    }
    formVisible.value = false;
    await queryTableRef.value?.reload();
  } finally {
    savingPattern.value = false;
  }
}

function openDeleteConfirm(row: CostBomPatternItem) {
  pendingDeleteRows.value = [row];
  deleteConfirmVisible.value = true;
}

function openBatchDeleteConfirm() {
  if (!selectedRows.value.length) {
    BaseToast.warning("请先选择要删除的版型");
    return;
  }
  pendingDeleteRows.value = [...selectedRows.value];
  deleteConfirmVisible.value = true;
}

async function deletePattern() {
  if (deleting.value || !pendingDeleteRows.value.length) {
    return;
  }
  const ids = pendingDeleteRows.value.map((row) => row.patternId).join(",");
  deleting.value = true;
  try {
    await deleteCostBomPattern(ids);
    BaseToast.success(deleteConfirmContent.value.successMessage);
    deleteConfirmVisible.value = false;
    pendingDeleteRows.value = [];
    selectedRows.value = [];
    await queryTableRef.value?.reload();
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <PageContainer
    title="版型管理"
    description="维护车型项目可关联的预算版型和成本收益版型。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryPatterns"
      row-key="patternId"
      fit-table-height
      :default-sort="{ sortField: 'createdAt', sortDirection: 'DESC' }"
      :table-props="{ scrollbarAlwaysOn: true }"
      empty-title="暂无匹配版型"
      empty-description="当前筛选条件下没有可展示的版型数据。"
      @selection-change="handleSelectionChange"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="版型名称">
            <el-input
              v-model="query.patternName"
              clearable
              placeholder="请输入版型名称"
              @keyup.enter="searchPatterns"
            />
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdAtRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              clearable
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          permission="system:pattern:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="openCreateDialog"
          >新增</PermissionButton
        >
        <PermissionButton
          permission="system:pattern:remove"
          variant="danger"
          type="danger"
          @click="openBatchDeleteConfirm"
        >
          批量删除
        </PermissionButton>
      </template>

      <el-table-column type="selection" width="48" fixed="left" />
      <el-table-column type="index" label="序号" width="70" />
      <el-table-column
        prop="patternName"
        label="版型名称"
        show-overflow-tooltip
      />
      <el-table-column
        prop="createdAt"
        label="创建时间"
      >
        <template #default="{ row }">
          <BaseDateTime :value="row.createdAt || null" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="system:pattern:edit"
            link
            type="primary"
            @click="openEditDialog(row)"
            >编辑</PermissionButton
          >
          <PermissionButton
            permission="system:pattern:remove"
            link
            @click="openDeleteConfirm(row)"
            >删除</PermissionButton
          >
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="formVisible"
      :title="formTitle"
      :loading="savingPattern"
      width="460px"
      @confirm="savePattern"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-position="top"
      >


            <el-form-item label="版型名称" prop="patternName">
              <el-input
                v-model="form.patternName"
                placeholder="请输入版型名称"
              />
            </el-form-item>

      </el-form>
    </BaseFormDialog>

    <BaseConfirm
      v-model="deleteConfirmVisible"
      :title="deleteConfirmContent.title"
      :message="deleteConfirmContent.message"
      :type="deleteConfirmContent.type"
      :confirm-text="deleteConfirmContent.confirmText"
      :loading="deleting"
      @confirm="deletePattern"
    />
  </PageContainer>
</template>
