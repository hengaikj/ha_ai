<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import {CirclePlus, Expand, Fold} from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  createCostBomCategory,
  deleteCostBomCategory,
  fetchCostBomCategories,
  updateCostBomCategory,
} from "@/api/cost-center";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { toDateTimeRangeParams } from "@/utils/date-range";

type CategoryRow = {
  id: number;
  code: string;
  name: string;
  parentId: number;
  level: number;
  sortNo: number;
  status: string;
  remark: string;
  version: number;
  createdAt: string;
  children?: CategoryRow[];
};

type CategoryForm = {
  id?: number;
  parentId: number;
  code: string;
  name: string;
  level: number;
  sortNo: number;
  status: string;
  remark: string;
  version?: number;
};

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
  getData?: () => CategoryRow[];
  getTableRef?: () => {
    toggleRowExpansion?: (row: unknown, expanded?: boolean) => void;
  } | null;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const formRef = ref<FormInstance>();
const query = reactive({
  name: "",
  createdAtRange: [] as string[],
});
const form = reactive<CategoryForm>(emptyForm());
const formVisible = ref(false);
const detailVisible = ref(false);
const activeDetail = ref<CategoryRow | null>(null);
const confirmVisible = ref(false);
const pendingDeleteRow = ref<CategoryRow | null>(null);
const treeSelectOptions = ref<CategoryRow[]>([]);
const allTreeExpanded = ref(false);
const expandedCategoryIds = ref(new Set<number>());

const editing = computed(() => Boolean(form.id));
const formTitle = computed(() =>
  editing.value ? "编辑成本分类" : "新增成本分类",
);
const formRules: FormRules<CategoryForm> = {
  name: [
    { required: true, message: "请输入分类名称", trigger: "blur" },
    { whitespace: true, message: "分类名称不能为空", trigger: "blur" },
  ],
};
const deleteConfirmContent = computed(() => {
  const row = pendingDeleteRow.value;
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "delete",
    object: "成本分类",
    name: row.name,
  });
});

function emptyForm(): CategoryForm {
  return {
    parentId: 0,
    code: "",
    name: "",
    level: 1,
    sortNo: 10,
    status: "ENABLED",
    remark: "",
  };
}

async function queryItems() {
  const { createdFrom, createdTo } = toDateTimeRangeParams(
    query.createdAtRange,
  );
  const records = await fetchCostBomCategories({
    categoryName: query.name || undefined,
    createdAtStart: createdFrom,
    createdAtEnd: createdTo,
  });
  const flatRows = records.map((item) => ({
    id: item.categoryId as number,
    code: item.categoryCode,
    name: item.categoryName,
    parentId: item.parentId as number,
    level: item.categoryLevel,
    sortNo: item.sortNo,
    status: item.status,
    remark: item.remark ?? "",
    version: item.version,
    createdAt: item.createdAt ?? "",
  }));
  const treeData = buildTree(flatRows);
  return {
    total: treeData.length,
    list: treeData,
    pageNo: 1,
    pageSize: 9999,
  };
}

function buildTree(rows: CategoryRow[]) {
  const map = new Map<number, CategoryRow>();
  const roots: CategoryRow[] = [];

  rows.forEach((row) => {
    map.set(row.id, { ...row, children: [] });
  });

  rows.forEach((row) => {
    const node = map.get(row.id);
    if (!node) {
      return;
    }
    if (row.parentId === 0 || !map.has(row.parentId)) {
      roots.push(node);
    } else {
      const parent = map.get(row.parentId);
      parent?.children?.push(node);
    }
  });

  function sortTree(nodes: CategoryRow[]) {
    nodes.sort((a, b) => (a.sortNo ?? 0) - (b.sortNo ?? 0));
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        sortTree(node.children);
      }
    });
  }
  sortTree(roots);

  return roots as CategoryRow[];
}

async function loadTreeSelectOptions() {
  const records = await fetchCostBomCategories();
  const flatRows = records.map((item) => ({
    id: item.categoryId as number,
    code: item.categoryCode,
    name: item.categoryName,
    parentId: item.parentId as number,
    level: item.categoryLevel,
    sortNo: item.sortNo,
    status: item.status,
    remark: item.remark ?? "",
    version: item.version,
    createdAt: item.createdAt ?? "",
  }));
  treeSelectOptions.value = buildTree(flatRows);
}

const treeSelectModelValue = computed({
  get() {
    const val = form.parentId;
    if (val === 0 || val === undefined || val === null) {
      return undefined;
    }
    return val;
  },
  set(val: unknown) {
    if (val === undefined || val === null || val === "") {
      form.parentId = 0;
    } else {
      form.parentId = val as number;
    }
  },
});

function resetQuery() {
  query.name = "";
  query.createdAtRange = [];
}

function searchItems() {
  queryTableRef.value?.search();
}

async function openCreateDialog(parentRow?: CategoryRow) {
  await loadTreeSelectOptions();
  delete form.id;
  delete form.version;
  Object.assign(form, emptyForm());
  if (parentRow) {
    form.parentId = parentRow.id;
    form.level = (parentRow.level || 1) + 1;
  }
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

function openEditDialog(row: CategoryRow) {
  Object.assign(form, {
    id: row.id,
    parentId: row.parentId,
    code: row.code,
    name: row.name,
    level: row.level,
    sortNo: row.sortNo,
    status: row.status,
    remark: row.remark,
    version: row.version,
  });
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function saveItem() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const payload = {
    categoryCode: form.code.trim() || `CAT-${Date.now()}`,
    categoryName: form.name.trim(),
    parentId: form.parentId,
    categoryLevel: form.level,
    sortNo: form.sortNo,
    status: form.status,
    remark: form.remark.trim() || null,
  };

  if (form.id) {
    await updateCostBomCategory(form.id, {
      ...payload,
      version: form.version ?? 0,
    });
    BaseToast.success("成本分类已更新");
  } else {
    await createCostBomCategory(payload);
    BaseToast.success("成本分类已新增");
  }
  formVisible.value = false;
  await queryTableRef.value?.reload();
}

function flattenCategoryRows(items: CategoryRow[]): CategoryRow[] {
  return items.flatMap((item) => [
    item,
    ...flattenCategoryRows(item.children ?? []),
  ]);
}

function expandableCategoryIds(items: CategoryRow[]) {
  return new Set(
    flattenCategoryRows(items)
      .filter((item) => item.children?.length)
      .map((item) => item.id),
  );
}

function handleCategoryLoaded(rows: unknown[]) {
  const categoryRows = rows as CategoryRow[];
  const expandableIds = expandableCategoryIds(categoryRows);
  expandedCategoryIds.value = allTreeExpanded.value
    ? expandableIds
    : new Set(
        [...expandedCategoryIds.value].filter((id) => expandableIds.has(id)),
      );

  nextTick(() => {
    const tableRef = queryTableRef.value?.getTableRef?.();
    if (!tableRef) return;
    flattenCategoryRows(categoryRows).forEach((row) => {
      if (expandedCategoryIds.value.has(row.id)) {
        tableRef.toggleRowExpansion?.(row, true);
      }
    });
  });
}

function handleCategoryExpand(row: CategoryRow, expandedRows: CategoryRow[]) {
  const expanded = expandedRows.some((item) => item.id === row.id);
  const nextExpandedIds = new Set(expandedCategoryIds.value);
  if (expanded) {
    nextExpandedIds.add(row.id);
  } else {
    nextExpandedIds.delete(row.id);
  }
  expandedCategoryIds.value = nextExpandedIds;
  const expandableIds = expandableCategoryIds(
    queryTableRef.value?.getData?.() ?? [],
  );
  allTreeExpanded.value =
    expandableIds.size > 0 &&
    [...expandableIds].every((id) => nextExpandedIds.has(id));
}

function confirmDelete(row: CategoryRow) {
  if (row.children?.length) {
    BaseToast.warning("存在下级分类，不能删除");
    return;
  }
  pendingDeleteRow.value = row;
  confirmVisible.value = true;
}

async function deleteItem() {
  const row = pendingDeleteRow.value;
  if (!row) return;
  await deleteCostBomCategory(row.id, row.version);
  confirmVisible.value = false;
  BaseToast.success(deleteConfirmContent.value.successMessage);
  await queryTableRef.value?.reload();
}

function toggleAllTreeExpand() {
  const tableRef = queryTableRef.value?.getTableRef?.();
  const tableData = queryTableRef.value?.getData?.() ?? [];
  if (!tableRef || tableData.length === 0) {
    return;
  }
  const shouldExpand = !allTreeExpanded.value;
  const expandableIds = expandableCategoryIds(tableData);
  flattenCategoryRows(tableData).forEach((row) => {
    tableRef.toggleRowExpansion?.(row, shouldExpand);
  });
  expandedCategoryIds.value = shouldExpand ? expandableIds : new Set<number>();
  allTreeExpanded.value = shouldExpand;
}

function formatCellValue(value: unknown) {
  if (value === "ENABLED") return "启用";
  if (value === "DISABLED") return "停用";
  return value === undefined || value === null || value === ""
    ? "-"
    : String(value);
}
</script>

<template>
  <PageContainer
    title="成本分类管理"
    description="维护成本 BOM 使用的分类目录和层级关系。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryItems as any"
      row-key="id"
      :show-pagination="false"
      :enable-column-settings="false"
      fit-table-height
      empty-title="暂无成本分类"
      empty-description="当前条件下没有可展示的成本分类。"
      @reset="resetQuery"
      @loaded="handleCategoryLoaded"
      @expand-change="handleCategoryExpand"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="分类名称">
            <el-input
              v-model="query.name"
              clearable
              placeholder="请输入分类名称"
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
            permission="system:category:add:tree"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="openCreateDialog()"
          >新增</PermissionButton
        >
        <PermissionButton variant="secondary" :icon="allTreeExpanded ? Fold : Expand" plain @click="toggleAllTreeExpand">
          {{ allTreeExpanded ? "全部折叠" : "全部展示" }}
        </PermissionButton>
      </template>

      <el-table-column
        prop="name"
        label="分类名称"
        min-width="320"
        align="left"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span class="cost-category-table__name">
            <span class="cost-category-table__name-text">{{ row.name }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          {{ row.createdAt || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
              permission="system:category:add:tree"
            link
            type="primary"
            @click.stop="openCreateDialog(row)"
            >新增</PermissionButton
          >
          <PermissionButton
              permission="system:category:edit"
            link
            type="primary"
            @click.stop="openEditDialog(row)"
            >编辑</PermissionButton
          >
          <PermissionButton
            v-if="!row.children?.length"
            permission="system:category:remove"
            link
            @click.stop="confirmDelete(row)"
            >删除</PermissionButton
          >
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="formVisible"
      :title="formTitle"
      width="640px"
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
            <el-form-item label="上级分类">
              <el-tree-select
                v-model="treeSelectModelValue"
                :data="treeSelectOptions"
                :props="{ label: 'name', children: 'children' }"
                placeholder="请选择上级分类"
                node-key="id"
                check-strictly
                style="width: 100%"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="分类名称" prop="name">
              <el-input
                v-model="form.name"
                placeholder="请输入分类名称"
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="detailVisible"
      title="成本分类管理详情"
      width="680px"
      confirm-text="关闭"
      cancel-text="取消"
      :show-close="true"
      close-on-confirm
    >
      <el-descriptions v-if="activeDetail" :column="2" border>
        <el-descriptions-item label="分类名称">{{
          formatCellValue(activeDetail.name)
        }}</el-descriptions-item>
        <el-descriptions-item label="分类层级">{{
          formatCellValue(activeDetail.level)
        }}</el-descriptions-item>
        <el-descriptions-item label="排序">{{
          formatCellValue(activeDetail.sortNo)
        }}</el-descriptions-item>
        <el-descriptions-item label="分类状态">{{
          formatCellValue(activeDetail.status)
        }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{
          activeDetail.createdAt
        }}</el-descriptions-item>
      </el-descriptions>
    </BaseFormDialog>

    <BaseConfirm
      v-model="confirmVisible"
      :title="deleteConfirmContent.title"
      :message="deleteConfirmContent.message"
      :type="deleteConfirmContent.type"
      :confirm-text="deleteConfirmContent.confirmText"
      @confirm="deleteItem"
    />
  </PageContainer>
</template>

<style scoped>
.cost-category-table__name {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.cost-category-table__name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
