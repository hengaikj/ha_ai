<script setup lang="ts">
import { BaseToast } from "@/components/base/BaseToast";
import { computed, onMounted, reactive, ref } from "vue";
import { type FormInstance, type FormRules } from "element-plus";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { Refresh, Search } from "@element-plus/icons-vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import {
  createCustTableCategory,
  deleteCustTableCategory,
  listCustTableCategories,
  updateCustTableCategory,
} from "@/api/cust-table";
import type {
  TableTemplateCategory,
  TableTemplateCategoryCommand,
} from "@/types/custom-table";
import type { CustTableCategory } from "@/types/cust-table";

const loading = ref(false);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const saving = ref(false);
const keyword = ref("");
const categories = ref<TableTemplateCategory[]>([]);
const selectedId = ref<string>();
const dialogOpen = ref(false);
const editing = ref<TableTemplateCategory>();
const formRef = ref<FormInstance>();
const form = reactive<TableTemplateCategoryCommand>({
  parentId: "0",
  categoryName: "",
  sortOrder: 0,
  remark: "",
});
const createPermission = "base:cust-table:category:edit";
const editPermission = "base:cust-table:category:edit";
const deletePermission = "base:cust-table:category:edit";
const rules: FormRules = {
  categoryName: [
    { required: true, message: "请输入分类名称", trigger: "blur" },
    { max: 64, message: "分类名称不能超过64个字符", trigger: "blur" },
  ],
  remark: [{ max: 256, message: "备注不能超过256个字符", trigger: "blur" }],
};

function flatten(nodes: TableTemplateCategory[]): TableTemplateCategory[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}
function adaptCustCategory(
  node: CustTableCategory,
  level = 1,
  parentPath = "",
): TableTemplateCategory {
  const categoryPath = parentPath
    ? `${parentPath}/${node.categoryName}`
    : node.categoryName;
  return {
    id: node.id,
    parentId: node.parentId,
    categoryName: node.categoryName,
    categoryPath,
    categoryLevel: level,
    templateCount: 0,
    sortOrder: node.sortOrder,
    status: node.status,
    lockVersion: node.lockVersion,
    remark: null,
    createBy: "",
    createTime: "",
    updateBy: "",
    updateTime: "",
    children: (node.children ?? []).map((child) =>
      adaptCustCategory(child, level + 1, categoryPath),
    ),
  };
}
const allCategories = computed(() => flatten(categories.value));
const selected = computed(() =>
  allCategories.value.find((item) => item.id === selectedId.value),
);
const tableRows = computed(() =>
  selected.value ? flatten([selected.value]) : allCategories.value,
);
function excludeTree(
  nodes: TableTemplateCategory[],
  excluded: Set<string>,
): TableTemplateCategory[] {
  return nodes
    .filter((node) => !excluded.has(node.id))
    .map((node) => ({
      ...node,
      children: excludeTree(node.children ?? [], excluded),
    }));
}
const parentOptions = computed(() => {
  if (!editing.value) return categories.value;
  const excluded = new Set(flatten([editing.value]).map((item) => item.id));
  return excludeTree(categories.value, excluded);
});

async function load() {
  loading.value = true;
  try {
    categories.value = (await listCustTableCategories(keyword.value)).map(
      (item) => adaptCustCategory(item),
    );
    if (
      selectedId.value &&
      !allCategories.value.some((item) => item.id === selectedId.value)
    ) {
      selectedId.value = undefined;
    }
  } finally {
    loading.value = false;
  }
}
function openCreate(parent?: TableTemplateCategory) {
  editing.value = undefined;
  Object.assign(form, {
    parentId: parent?.id ?? selected.value?.id ?? "0",
    categoryName: "",
    sortOrder: 0,
    remark: "",
    expectedLockVersion: undefined,
  });
  dialogOpen.value = true;
}
function openEdit(row: TableTemplateCategory) {
  editing.value = row;
  Object.assign(form, {
    parentId: row.parentId,
    categoryName: row.categoryName,
    sortOrder: row.sortOrder,
    remark: row.remark ?? "",
    expectedLockVersion: row.lockVersion,
  });
  dialogOpen.value = true;
}
async function submit() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    const payload = {
      ...form,
      categoryName: form.categoryName.trim(),
      remark: form.remark?.trim(),
    };
    if (editing.value) {
      await updateCustTableCategory(editing.value.id, {
        parentId: payload.parentId,
        categoryName: payload.categoryName,
        sortOrder: payload.sortOrder,
        expectedLockVersion: editing.value.lockVersion,
      });
      BaseToast.success("分类已更新");
    } else {
      await createCustTableCategory({
        parentId: payload.parentId,
        categoryName: payload.categoryName,
        sortOrder: payload.sortOrder,
      });
      BaseToast.success("分类已创建");
    }
    dialogOpen.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
async function remove(row: TableTemplateCategory) {
  try {
    await openConfirm({
      title: "删除确认",
      message: `确认删除模板分类“${row.categoryName}”吗？存在子分类或模板引用时系统将拒绝删除。`,
      type: "danger",
      confirmText: "删除",
    });
  } catch {
    return;
  }
  await deleteCustTableCategory(row.id, row.lockVersion);
  BaseToast.success("分类已删除");
  if (selectedId.value === row.id) selectedId.value = undefined;
  await load();
}
onMounted(load);
</script>

<template>
  <PageContainer
    title="模板分类"
    description="维护最多八级的模板分类树与模板归属关系。"
  >
    <template #actions>
      <PermissionButton
        :permission="createPermission"
        type="primary"
        @click="openCreate()"
      >
        新增分类
      </PermissionButton>
    </template>
    <div class="category-toolbar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索分类名称"
        @keyup.enter="load"
      >
        <template #prefix
          ><el-icon><Search /></el-icon
        ></template>
      </el-input>
      <el-button type="primary" :icon="Search" @click="load">查询</el-button>
      <el-button
        :icon="Refresh"
        @click="
          keyword = '';
          selectedId = undefined;
          load();
        "
        >重置</el-button
      >
    </div>
    <div v-loading="loading" class="category-layout">
      <aside>
        <div class="pane-title">分类树</div>
        <el-tree
          v-if="categories.length"
          :data="categories"
          node-key="id"
          default-expand-all
          highlight-current
          :props="{ label: 'categoryName', children: 'children' }"
          @node-click="(node: TableTemplateCategory) => (selectedId = node.id)"
        />
        <el-empty v-else description="暂无分类数据" :image-size="64" />
      </aside>
      <main>
        <div class="pane-heading">
          <strong>{{ selected ? selected.categoryName : "全部分类" }}</strong>
          <PermissionButton
            v-if="selected"
            :permission="createPermission"
            @click="openCreate(selected)"
            >新增子分类</PermissionButton
          >
        </div>
        <el-table :data="tableRows" row-key="id" border>
          <el-table-column
            prop="categoryName"
            label="分类名称"
            min-width="180"
          />
          <el-table-column prop="categoryLevel" label="层级" width="72" />
          <el-table-column prop="templateCount" label="模板数" width="88" />
          <el-table-column prop="sortOrder" label="排序" width="80" />
          <el-table-column label="分类状态" width="92">
            <template #default="{ row }">
              <BaseStatusTag
                :label="row.status === 'ACTIVE' ? '启用' : '停用'"
                :type="row.status === 'ACTIVE' ? 'success' : 'info'"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="remark"
            label="备注"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column label="操作" fixed="right" width="210">
            <template #default="{ row }">
              <PermissionButton
                :permission="editPermission"
                link
                type="primary"
                @click="openEdit(row)"
                >编辑</PermissionButton
              >
              <PermissionButton
                :permission="deletePermission"
                link
                @click="remove(row)"
                >删除</PermissionButton
              >
            </template>
          </el-table-column>
        </el-table>
      </main>
    </div>
    <el-dialog
      v-model="dialogOpen"
      :title="editing ? '编辑分类' : '新增分类'"
      width="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
        <el-form-item label="上级分类" prop="parentId">
          <el-tree-select
            v-model="form.parentId"
            :data="parentOptions"
            node-key="id"
            :props="{ label: 'categoryName', children: 'children' }"
            check-strictly
            clearable
            placeholder="不选择则为一级分类"
            style="width: 100%"
            @clear="form.parentId = '0'"
          />
        </el-form-item>
        <el-form-item label="分类名称" prop="categoryName"
          ><el-input
            v-model="form.categoryName"
            maxlength="64"
            show-word-limit
            clearable
        /></el-form-item>
        <el-form-item label="排序" prop="sortOrder"
          ><el-input-number
            v-model="form.sortOrder"
            :min="-999999"
            :max="999999"
        /></el-form-item>
        <el-form-item label="备注" prop="remark"
          ><el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="256"
            show-word-limit
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="dialogOpen = false">取消</el-button
        ><PermissionButton
          :permission="editing ? editPermission : createPermission"
          type="primary"
          :loading="saving"
          @click="submit"
          >保存</PermissionButton
        ></template
      >
    </el-dialog>
    <BaseConfirm
      v-model="confirmState.visible"
      v-bind="confirmState"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.category-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.category-toolbar .el-input {
  width: min(320px, 100%);
}
.category-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 520px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}
.category-layout aside {
  padding: 16px;
  border-right: 1px solid var(--el-border-color);
  overflow: auto;
}
.category-layout main {
  padding: 16px;
  min-width: 0;
}
.pane-title {
  margin-bottom: 12px;
  font-weight: 600;
}
.pane-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
  margin-bottom: 12px;
}
@media (max-width: 700px) {
  .category-toolbar {
    flex-wrap: wrap;
  }
  .category-layout {
    grid-template-columns: 1fr;
  }
  .category-layout aside {
    border-right: 0;
    border-bottom: 1px solid var(--el-border-color);
  }
}
</style>
