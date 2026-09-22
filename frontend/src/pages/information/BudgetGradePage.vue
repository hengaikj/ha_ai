<script setup lang="ts">
import { computed, nextTick, reactive, ref, shallowRef } from "vue";
import { CirclePlus, Expand, Fold } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  createBudgetGrade,
  deleteBudgetGrade,
  enableBudgetGrade,
  fetchBudgetGradeTree,
  updateBudgetGrade,
} from "@/api/project";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import type { BackendId } from "@/types/information";
import BudgetGradeVirtualTable from "./BudgetGradeVirtualTable.vue";
import {
  buildLazyGradeTree,
  collectExpandableGradeIds,
  getLazyGradeChildren,
  type GradeRow,
} from "./budget-grade-tree";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const formRef = ref<FormInstance>();
const query = reactive({
  name: "",
  status: "",
  createdAtRange: [] as string[],
});
const form = reactive<Record<string, unknown>>({});
const formVisible = ref(false);
const confirmVisible = ref(false);
const pendingDeleteRow = ref<GradeRow | null>(null);
const treeSelectOptions = shallowRef<GradeRow[]>([]);
const treeSelectLoading = ref(false);
const parentSelectLocked = ref(false);
const lockedParentName = ref("");
const expandedRowIds = ref(new Set<number>());
const tableRows = shallowRef<GradeRow[]>([]);
const expandableRowCount = ref(0);

const allRowsExpanded = computed(
  () =>
    expandableRowCount.value > 0 &&
    expandedRowIds.value.size >= expandableRowCount.value,
);

const editing = computed(() => Boolean(form.id));
const formTitle = computed(() =>
  editing.value ? "编辑预算等级" : "新增预算等级",
);
const formRules: FormRules<Record<string, unknown>> = {
  code: [
    { required: true, message: "请输入等级编号", trigger: "blur" },
    { whitespace: true, message: "等级编号不能为空", trigger: "blur" },
  ],
  name: [
    { required: true, message: "请输入等级名称", trigger: "blur" },
    { whitespace: true, message: "等级名称不能为空", trigger: "blur" },
  ],
};
const voidConfirmContent = computed(() => {
  const row = pendingDeleteRow.value;
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "void",
    object: "预算等级",
    name: row.name,
  });
});

async function queryItems() {
  const [beginDate, endDate] = query.createdAtRange;
  const records = await fetchBudgetGradeTree({
    gradeName: query.name.trim() || undefined,
    abolishFlag:
      query.status === "ENABLED"
        ? "0"
        : query.status === "DISABLED"
          ? "1"
          : undefined,
    beginTime: beginDate ? `${beginDate} 00:00:00` : undefined,
    endTime: endDate ? `${endDate} 23:59:59` : undefined,
  });
  const tree = buildLazyGradeTree(records);
  return {
    total: tree.nodeCount,
    list: tree.roots,
    pageNo: 1,
    pageSize: 9999,
  };
}

async function loadTreeSelectOptions() {
  if (treeSelectOptions.value.length > 0 || treeSelectLoading.value) {
    return;
  }

  treeSelectLoading.value = true;
  try {
    const records = await fetchBudgetGradeTree();
    const tree = buildLazyGradeTree(records);
    treeSelectOptions.value = tree.roots;
  } finally {
    treeSelectLoading.value = false;
  }
}

function loadTreeSelectChildren(
  node: { data?: GradeRow },
  resolve: (children: GradeRow[]) => void,
) {
  resolve(getLazyGradeChildren(node.data));
}

const treeSelectModelValue = computed({
  get() {
    const val = form.parentId;
    if (val === 0 || val === "0" || val === undefined || val === null) {
      return undefined;
    }
    return val;
  },
  set(val: unknown) {
    if (val === undefined || val === null || val === "") {
      form.parentId = 0;
    } else {
      form.parentId = val;
    }
  },
});

function emptyForm() {
  return {
    code: "",
    name: "",
    parentId: 0,
    level: 0,
    sortNo: 10,
    status: "ENABLED",
    remark: "",
  };
}

function resetForm(row?: GradeRow) {
  Object.keys(form).forEach((key) => {
    delete form[key];
  });
  if (row) {
    form.code = row.code;
    form.name = row.name;
    form.parentId = row.parentId ?? 0;
    form.level = row.level ?? 0;
    form.sortNo = row.sortNo ?? 10;
    form.status = row.status;
    form.remark = row.remark ?? "";
    form.id = row.id;
    form.version = row.version ?? 0;
  } else {
    Object.assign(form, emptyForm());
  }
}

function resetQuery() {
  query.name = "";
  query.status = "";
  query.createdAtRange = [];
}

function searchItems() {
  queryTableRef.value?.search();
}

async function openCreateDialog(parentRow?: GradeRow) {
  resetForm();
  parentSelectLocked.value = Boolean(parentRow);
  lockedParentName.value = parentRow?.name ?? "";
  if (parentRow) {
    form.parentId = parentRow.id;
  } else {
    await loadTreeSelectOptions();
  }
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

function openEditDialog(row: GradeRow) {
  resetForm(row);
  parentSelectLocked.value = true;
  lockedParentName.value =
    row.parentName || (row.parentId ? `父级 ID：${row.parentId}` : "无");
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function toggleRowStatus(row: GradeRow) {
  const currentStatus = row.status;
  const targetStatus = currentStatus === "ENABLED" ? "DISABLED" : "ENABLED";
  const actionText = targetStatus === "ENABLED" ? "启用" : "作废";
  try {
    if (targetStatus === "ENABLED") {
      await enableBudgetGrade(row.id as BackendId);
    } else {
      await deleteBudgetGrade(row.id);
    }
    BaseToast.success(`预算等级已${actionText}`);
    clearTreeSelectCache();
    await queryTableRef.value?.reload();
  } catch (unknownError) {
    BaseToast.error(
      unknownError instanceof Error
        ? unknownError.message
        : `${actionText}失败`,
    );
  }
}

async function saveItem() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const name = String(form.name ?? "").trim();

  if (form.id) {
    await updateBudgetGrade(form.id as number, {
      gradeCode: String(form.code ?? ""),
      gradeName: name,
      parentId: Number(form.parentId ?? 0),
    });
    BaseToast.success("预算等级已更新");
  } else {
    await createBudgetGrade({
      gradeCode: String(form.code ?? ""),
      gradeName: name,
      parentId: Number(form.parentId ?? 0),
    });
    BaseToast.success("预算等级已新增");
  }
  formVisible.value = false;
  clearTreeSelectCache();
  await queryTableRef.value?.reload();
}

function confirmDelete(row?: GradeRow) {
  if (!row) return;
  pendingDeleteRow.value = row;
  confirmVisible.value = true;
}

async function deleteItems() {
  const row = pendingDeleteRow.value;
  if (!row) return;
  await deleteBudgetGrade(row.id);
  confirmVisible.value = false;
  BaseToast.success(voidConfirmContent.value.successMessage);
  clearTreeSelectCache();
  await queryTableRef.value?.reload();
}

function collapseAllTreeRows() {
  expandedRowIds.value = new Set<number>();
}

function expandAllTreeRows() {
  expandedRowIds.value = collectExpandableGradeIds(tableRows.value);
}

function toggleAllTreeRows() {
  if (allRowsExpanded.value) {
    collapseAllTreeRows();
  } else {
    expandAllTreeRows();
  }
}

function toggleTreeRow(row: GradeRow) {
  const nextExpandedIds = new Set(expandedRowIds.value);
  if (!nextExpandedIds.has(row.id)) {
    nextExpandedIds.add(row.id);
  } else {
    const pending = [row];
    while (pending.length > 0) {
      const current = pending.pop()!;
      nextExpandedIds.delete(current.id);
      pending.push(...getLazyGradeChildren(current));
    }
  }
  expandedRowIds.value = nextExpandedIds;
}

function handleTreeLoaded(rows: unknown[]) {
  tableRows.value = rows as GradeRow[];
  const expandableIds = collectExpandableGradeIds(tableRows.value);
  expandedRowIds.value = new Set(
    [...expandedRowIds.value].filter((id) => expandableIds.has(id)),
  );
  expandableRowCount.value = expandableIds.size;
}

function handleVirtualStatusAction(row: GradeRow) {
  if (row.status === "ENABLED") {
    confirmDelete(row);
  } else {
    void toggleRowStatus(row);
  }
}

function clearTreeSelectCache() {
  treeSelectOptions.value = [];
}
</script>

<template>
  <PageContainer
    title="预算等级管理"
    description="维护预算测算等级、编号和生效状态。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryItems"
      row-key="id"
      :show-pagination="false"
      :enable-column-settings="false"
      fit-table-height
      empty-title="暂无预算等级"
      empty-description="当前条件下没有可展示的预算等级。"
      @reset="resetQuery"
      @loaded="handleTreeLoaded"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="等级名称">
            <el-input
              v-model="query.name"
              clearable
              placeholder="请输入等级名称"
              @keyup.enter="searchItems"
            />
          </el-form-item>
          <el-form-item label="等级状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择等级状态"
            >
              <el-option label="生效" value="ENABLED" />
              <el-option label="作废" value="DISABLED" />
            </el-select>
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
          permission="system:grade:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="openCreateDialog()"
          >新增</PermissionButton
        >
        <PermissionButton
          variant="secondary"
          plain
          :icon="allRowsExpanded ? Fold : Expand"
          @click="toggleAllTreeRows"
        >
          {{ allRowsExpanded ? "全部折叠" : "全部展示" }}
        </PermissionButton>
      </template>
      <template #content="{ list, loading, error, height }">
        <BudgetGradeVirtualTable
          :rows="list as GradeRow[]"
          :expanded-ids="expandedRowIds"
          :loading="loading"
          :error="error"
          :height="height"
          @toggle-expand="toggleTreeRow"
          @create="openCreateDialog"
          @edit="openEditDialog"
          @toggle-status="handleVirtualStatusAction"
        />
      </template>
    </QueryTable>

    <BaseFormDialog
      v-model="formVisible"
      :title="formTitle"
      width="640px"
      body-max-height="60vh"
      @confirm="saveItem"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-position="top"
      >
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="上级名称">
              <el-tree-select
                v-if="!parentSelectLocked"
                v-model="treeSelectModelValue"
                :data="treeSelectOptions"
                :props="{
                  label: 'name',
                  children: 'children',
                  isLeaf: 'isLeaf',
                }"
                placeholder="请选择上级名称"
                node-key="id"
                check-strictly
                lazy
                :load="loadTreeSelectChildren"
                :loading="treeSelectLoading"
                style="width: 100%"
                clearable
              />
              <el-input v-else :model-value="lockedParentName" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="等级编号" prop="code">
              <el-input
                v-model="form.code as string"
                placeholder="请输入等级编号"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="等级名称" prop="name">
              <el-input
                v-model="form.name as string"
                placeholder="请输入等级名称"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseConfirm
      v-model="confirmVisible"
      :title="voidConfirmContent.title"
      :message="voidConfirmContent.message"
      :type="voidConfirmContent.type"
      :confirm-text="voidConfirmContent.confirmText"
      @confirm="deleteItems"
    />
  </PageContainer>
</template>
