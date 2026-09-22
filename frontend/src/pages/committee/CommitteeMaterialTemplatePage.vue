<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  Delete,
  EditPen,
  Plus,
  RefreshRight,
  Search,
} from "@element-plus/icons-vue";
import {
  createCommitteeMaterialCategory,
  createCommitteeMaterialTemplate,
  deleteCommitteeMaterialCategory,
  deleteCommitteeMaterialTemplate,
  fetchCommitteeMaterialCategories,
  fetchCommitteeMaterialTemplatePage,
  updateCommitteeMaterialCategory,
  updateCommitteeMaterialTemplate,
} from "@/api/committee";
import PageContainer from "@/components/layout/PageContainer.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import BasePagination from "@/components/base/BasePagination.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import type {
  CommitteeId,
  CommitteeMaterialCategory,
  CommitteeMaterialTemplateItem,
} from "@/types/committee";
import type { CommitteeMaterialTemplatePageQuery } from "@/api/committee";

const loading = ref(false);
const categoryLoading = ref(false);
const materialLoading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const categories = ref<CommitteeMaterialCategory[]>([]);
const materials = ref<CommitteeMaterialTemplateItem[]>([]);
const categoryMaterialCounts = ref<Record<string, number>>({});
const activeCategoryId = ref<CommitteeId>("");
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const categoryKeyword = ref("");
const categoryDialogVisible = ref(false);
const materialDialogVisible = ref(false);
const editingCategoryId = ref<CommitteeId>("");
const editingMaterialId = ref<CommitteeId>("");

const categoryForm = reactive({
  categoryCode: "",
  categoryName: "",
  categoryDesc: "",
  sortNo: 0,
  enableFlag: "1" as "0" | "1",
});

const materialForm = reactive({
  materialName: "",
  materialRequirement: "",
  attachmentId: "" as CommitteeId | "",
  fileName: "",
  fileSize: 0,
  fileType: "",
  sortNo: 0,
  enableFlag: "1" as "0" | "1",
});

const activeCategory = computed(() =>
  categories.value.find(
    (item) => String(item.id) === String(activeCategoryId.value),
  ),
);

const categoryTree = computed(() => {
  const keyword = categoryKeyword.value.trim().toLowerCase();
  return categories.value
    .filter((category) => {
      if (!keyword) return true;
      return [
        category.categoryName,
        category.categoryCode,
        category.categoryDesc,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    })
    .map((category) => ({
      id: String(category.id ?? ""),
      label: category.categoryName,
      description: category.categoryDesc,
      count: categoryMaterialCounts.value[String(category.id)] ?? 0,
      disabled: category.enableFlag === "0",
    }));
});

const activeMaterials = computed(() =>
  materials.value
    .filter(
      (item) => String(item.categoryId) === String(activeCategoryId.value),
    )
    .slice()
    .sort((first, second) => (first.sortNo ?? 0) - (second.sortNo ?? 0)),
);

function materialPageResult(
  result:
    | CommitteeMaterialTemplateItem[]
    | { rows?: CommitteeMaterialTemplateItem[]; total?: number | string },
  categoryId = activeCategoryId.value,
) {
  if (Array.isArray(result)) {
    const rows = result.filter(
      (item) => String(item.categoryId) === String(categoryId),
    );
    return { rows, total: rows.length };
  }
  const rows = result.rows ?? [];
  return { rows, total: Number(result.total ?? rows.length) || 0 };
}

async function load() {
  loading.value = true;
  try {
    await loadCategories();
  } finally {
    loading.value = false;
  }
}

async function loadCategories() {
  categoryLoading.value = true;
  try {
    categories.value = await fetchCommitteeMaterialCategories();
    activeCategoryId.value = String(categories.value[0]?.id ?? "");
    pageNo.value = 1;
    await Promise.all([loadCategoryMaterialCounts(), loadMaterials()]);
  } finally {
    categoryLoading.value = false;
  }
}

async function loadMaterials() {
  materialLoading.value = true;
  try {
    if (!activeCategoryId.value) {
      materials.value = [];
      total.value = 0;
      return;
    }
    const query: CommitteeMaterialTemplatePageQuery = {
      categoryId: String(activeCategoryId.value),
      pageNum: pageNo.value,
      pageSize: pageSize.value,
      orderByColumn: "sortNo",
      isAsc: "asc",
    };
    const normalized = materialPageResult(
      await fetchCommitteeMaterialTemplatePage(query),
    );
    materials.value = normalized.rows;
    total.value = normalized.total;
    categoryMaterialCounts.value = {
      ...categoryMaterialCounts.value,
      [String(activeCategoryId.value)]: normalized.total,
    };
  } finally {
    materialLoading.value = false;
  }
}

async function loadCategoryMaterialCounts() {
  const entries = await Promise.all(
    categories.value
      .filter(
        (category) => String(category.id) !== String(activeCategoryId.value),
      )
      .map(async (category) => {
        const categoryId = String(category.id ?? "");
        try {
          const result = await fetchCommitteeMaterialTemplatePage({
            categoryId,
            pageNum: 1,
            pageSize: 1,
            orderByColumn: "sortNo",
            isAsc: "asc",
          });
          return [
            categoryId,
            materialPageResult(result, categoryId).total,
          ] as const;
        } catch {
          return [categoryId, 0] as const;
        }
      }),
  );
  categoryMaterialCounts.value = {
    ...categoryMaterialCounts.value,
    ...Object.fromEntries(entries),
  };
}

async function selectCategory(categoryId: CommitteeId) {
  if (String(categoryId) === String(activeCategoryId.value)) return;
  activeCategoryId.value = categoryId;
  pageNo.value = 1;
  await loadMaterials();
}

async function changePage(nextPage: number) {
  pageNo.value = nextPage;
  await loadMaterials();
}

async function changePageSize(nextPageSize: number) {
  pageSize.value = nextPageSize;
  pageNo.value = 1;
  await loadMaterials();
}

function materialIndex(index: number) {
  return (pageNo.value - 1) * pageSize.value + index + 1;
}

function openCreateCategory() {
  editingCategoryId.value = "";
  Object.assign(categoryForm, {
    categoryCode: `category-${Date.now()}`,
    categoryName: "",
    categoryDesc: "",
    sortNo: categories.value.length + 1,
    enableFlag: "1",
  });
  categoryDialogVisible.value = true;
}

function openEditCategory(category: CommitteeMaterialCategory) {
  editingCategoryId.value = String(category.id ?? "");
  Object.assign(categoryForm, {
    categoryCode: category.categoryCode,
    categoryName: category.categoryName,
    categoryDesc: category.categoryDesc ?? "",
    sortNo: category.sortNo,
    enableFlag: category.enableFlag,
  });
  categoryDialogVisible.value = true;
}

async function saveCategory() {
  if (!categoryForm.categoryCode.trim() || !categoryForm.categoryName.trim())
    return;
  saving.value = true;
  try {
    const payload = {
      categoryCode: categoryForm.categoryCode.trim(),
      categoryName: categoryForm.categoryName.trim(),
      categoryDesc: categoryForm.categoryDesc.trim() || undefined,
      sortNo: categoryForm.sortNo,
      enableFlag: categoryForm.enableFlag,
    };
    if (editingCategoryId.value) {
      await updateCommitteeMaterialCategory(editingCategoryId.value, payload);
    } else {
      await createCommitteeMaterialCategory(payload);
    }
    BaseToast.success("材料分类已保存");
    categoryDialogVisible.value = false;
    await loadCategories();
  } finally {
    saving.value = false;
  }
}

async function removeCategory(category: CommitteeMaterialCategory) {
  try {
    await openConfirm({
      title: "删除确认",
      message: `确认删除材料分类“${category.categoryName}”吗？删除后分类下材料将不再展示。`,
      type: "danger",
      confirmText: "删除",
    });
  } catch {
    return;
  }
  if (deleting.value) return;
  deleting.value = true;
  try {
    await deleteCommitteeMaterialCategory(String(category.id));
    BaseToast.success("材料分类已删除");
    await loadCategories();
  } finally {
    deleting.value = false;
  }
}

function openCreateMaterial() {
  if (!activeCategory.value) return;
  editingMaterialId.value = "";
  Object.assign(materialForm, {
    materialName: "",
    materialRequirement: "",
    attachmentId: "",
    fileName: "",
    fileSize: 0,
    fileType: "",
    sortNo: activeMaterials.value.length + 1,
    enableFlag: "1",
  });
  materialDialogVisible.value = true;
}

function openEditMaterial(material: CommitteeMaterialTemplateItem) {
  editingMaterialId.value = String(material.id ?? "");
  Object.assign(materialForm, {
    materialName: material.materialName ?? material.label ?? "",
    materialRequirement:
      material.materialRequirement ?? material.requirement ?? "",
    attachmentId: material.attachmentId ?? "",
    fileName: material.fileName ?? "",
    fileSize: material.fileSize ?? 0,
    fileType: material.fileType ?? "",
    sortNo: material.sortNo ?? 0,
    enableFlag: material.enableFlag ?? "1",
  });
  materialDialogVisible.value = true;
}

async function saveMaterial() {
  if (!activeCategory.value || !materialForm.materialName.trim()) return;
  saving.value = true;
  try {
    const payload: Partial<CommitteeMaterialTemplateItem> = {
      materialName: materialForm.materialName.trim(),
      materialRequirement: materialForm.materialRequirement.trim() || undefined,
      sortNo: materialForm.sortNo,
      enableFlag: materialForm.enableFlag,
    };
    if (editingMaterialId.value) {
      if (
        materialForm.attachmentId ||
        materialForm.fileName ||
        materialForm.fileSize ||
        materialForm.fileType
      ) {
        Object.assign(payload, {
          attachmentId: materialForm.attachmentId || undefined,
          fileName: materialForm.fileName || undefined,
          fileSize: materialForm.fileSize || undefined,
          fileType: materialForm.fileType || undefined,
        });
      }
      await updateCommitteeMaterialTemplate(
        String(activeCategory.value.id),
        editingMaterialId.value,
        payload,
      );
    } else {
      await createCommitteeMaterialTemplate(
        String(activeCategory.value.id),
        payload,
      );
    }
    BaseToast.success("材料已保存");
    materialDialogVisible.value = false;
    pageNo.value = 1;
    await loadMaterials();
  } finally {
    saving.value = false;
  }
}

async function removeMaterial(row: CommitteeMaterialTemplateItem) {
  try {
    await openConfirm({
      scene: "delete",
      object: "材料",
      name: row.materialName ?? row.label,
    });
  } catch {
    return;
  }
  if (deleting.value) return;
  deleting.value = true;
  try {
    await deleteCommitteeMaterialTemplate(String(row.id));
    BaseToast.success("材料已删除");
    pageNo.value = 1;
    await loadMaterials();
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <PageContainer
    class="committee-material-template-page"
    title="材料清单管理"
  >
    <section v-loading="loading" class="committee-material-template">
      <aside
        v-loading="categoryLoading"
        class="committee-material-template__tree"
      >
        <header class="committee-material-template__tree-tools">
          <el-input
            v-model="categoryKeyword"
            clearable
            placeholder="请输入分类名称"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <div class="committee-material-template__tree-actions">
            <el-button
              :icon="Plus"
              circle
              @click="openCreateCategory"
            />
            <el-button
              :icon="EditPen"
              :disabled="!activeCategory"
              circle
              @click="activeCategory && openEditCategory(activeCategory)"
            />
            <el-button :icon="RefreshRight" circle @click="load" />
            <el-button
              :icon="Delete"
              :disabled="!activeCategory"
              circle
              @click="activeCategory && removeCategory(activeCategory)"
            />
          </div>
        </header>
<!--        <div class="committee-material-template__tree-title">-->
<!--          <span>材料分类</span>-->
<!--          <em>{{ categoryTree.length }} 类</em>-->
<!--        </div>-->
        <el-tree
          class="committee-material-template__category-tree"
          :data="categoryTree"
          node-key="id"
          :default-expanded-keys="[activeCategoryId]"
          highlight-current
          :current-node-key="activeCategoryId"
          empty-text="暂无分类"
          @node-click="selectCategory($event.id)"
        >
          <template #default="{ data }">
            <div class="committee-material-template__tree-node">
              <span>{{ data.label }}</span>
              <em>{{ data.count }}</em>
            </div>
          </template>
        </el-tree>
      </aside>

      <main class="committee-material-template__main">
        <section class="committee-material-template__toolbar">
          <div class="committee-material-template__toolbar-title">
            <strong>材料模板</strong>
            <span>按当前分类维护上会材料清单</span>
          </div>
          <PermissionButton
            type="primary"
            :disabled="!activeCategory"
            @click="openCreateMaterial"
            >新增材料</PermissionButton
          >
        </section>

        <div class="committee-material-template__table-wrapper">
          <el-table
            v-loading="materialLoading"
            class="committee-material-template__table"
            :data="activeMaterials"
            border
            row-key="id"
            height="100%"
            :scrollbar-always-on="true"
            empty-text="当前分类暂无材料"
          >
            <el-table-column
              type="index"
              label="序号"
              width="70"
              align="center"
              header-align="center"
              :index="materialIndex"
            />
            <el-table-column
              label="材料名称"
              min-width="220"
              align="center"
              header-align="center"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span class="committee-text-strong">{{
                  row.materialName ?? row.label
                }}</span>
              </template>
            </el-table-column>
            <el-table-column
              label="材料要求"
              min-width="240"
              header-align="center"
            >
              <template #default="{ row }">
                {{ row.materialRequirement ?? row.requirement ?? "--" }}
              </template>
            </el-table-column>
            <el-table-column
              label="排序"
              width="90"
              align="center"
              header-align="center"
            >
              <template #default="{ row }">{{ row.sortNo ?? "--" }}</template>
            </el-table-column>
            <el-table-column
              label="状态"
              width="100"
              align="center"
              header-align="center"
            >
              <template #default="{ row }">
                <BaseStatusTag
                  :status="row.enableFlag === '1' ? 'ENABLED' : 'DISABLED'"
                />
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              width="120"
              fixed="right"
              align="center"
              header-align="center"
            >
              <template #default="{ row }">
                <div class="bq-table-actions">
                  <PermissionButton
                    link
                    type="primary"
                    @click="openEditMaterial(row)"
                    >编辑</PermissionButton
                  >
                  <PermissionButton
                    link
                    type="danger"
                    @click="removeMaterial(row)"
                    >删除</PermissionButton
                  >
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="committee-material-template__pagination-wrapper">
          <BasePagination
            :page-no="pageNo"
            :page-size="pageSize"
            :total="total"
            @page-change="changePage"
            @size-change="changePageSize"
          />
        </div>
      </main>
    </section>

    <el-dialog
      v-model="categoryDialogVisible"
      :title="editingCategoryId ? '编辑材料分类' : '新增材料分类'"
      width="520px"
    >
      <el-form :model="categoryForm" label-width="96px">
        <el-form-item label="分类名称" required>
          <el-input
            v-model="categoryForm.categoryName"
            maxlength="128"
            clearable
          />
        </el-form-item>
        <el-form-item label="分类说明">
          <el-input
            v-model="categoryForm.categoryDesc"
            type="textarea"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="categoryForm.sortNo" :min="0" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch
            v-model="categoryForm.enableFlag"
            active-value="1"
            inactive-value="0"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <PermissionButton @click="categoryDialogVisible = false">
          取消
        </PermissionButton>
        <PermissionButton
          :permission="
            editingCategoryId
              ? 'committee:material-category:edit'
              : 'committee:material-category:add'
          "
          type="primary"
          :loading="saving"
          @click="saveCategory"
          >保存分类</PermissionButton
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="materialDialogVisible"
      :title="editingMaterialId ? '编辑材料' : '新增材料'"
      width="560px"
    >
      <el-form :model="materialForm" label-width="96px">
        <el-form-item label="材料名称" required>
          <el-input
            v-model="materialForm.materialName"
            maxlength="200"
            clearable
          />
        </el-form-item>
        <el-form-item label="材料要求">
          <el-input
            v-model="materialForm.materialRequirement"
            type="textarea"
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="materialForm.sortNo" :min="0" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch
            v-model="materialForm.enableFlag"
            active-value="1"
            inactive-value="0"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <PermissionButton @click="materialDialogVisible = false">
          取消
        </PermissionButton>
        <PermissionButton
          :permission="
            editingMaterialId
              ? 'committee:material-template:edit'
              : 'committee:material-template:add'
          "
          type="primary"
          :loading="saving"
          @click="saveMaterial"
          >保存材料</PermissionButton
        >
      </template>
    </el-dialog>
    <BaseConfirm
      v-model="confirmState.visible"
      v-bind="confirmState"
      :loading="deleting"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.committee-material-template {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 24px;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.committee-material-template-page {
  display: flex;
  box-sizing: border-box;
  min-height: 0;
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height, 0px) - var(--bq-space-page-y, 16px) * 2 - 14px
  );
  flex-direction: column;
}

.committee-material-template-page :deep(.page-container__body) {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.committee-material-template__tree,
.committee-material-template__main {
  min-width: 0;
  background: var(--bq-color-surface);
}

.committee-material-template__tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid var(--bq-color-border-subtle);
  padding: 12px 7px 12px 9px;
}

.committee-material-template__tree-tools {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 8px;
}

.committee-material-template__tree-tools :deep(.el-input__wrapper) {
  border-radius: 6px;
  box-shadow: 0 0 0 1px #d7dfed inset;
}

.committee-material-template__tree-tools :deep(.el-input__inner) {
  font-size: 15px;
}

.committee-material-template__tree-actions {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  gap: 14px;
}

.committee-material-template__category-tree {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  background: transparent;
}

.committee-material-template__category-tree :deep(.el-tree-node__content) {
  height: 42px;
  margin: 2px 0;
  border-radius: 0;
  color: #26364d;
}

.committee-material-template__tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  gap: 8px;
  padding-right: 10px;
}

.committee-material-template__tree-node span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.committee-material-template__tree-node em {
  min-width: 22px;
  color: var(--bq-color-text-secondary);
  font-style: normal;
  text-align: right;
}

.committee-material-template__main {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  gap: 12px;
}

.committee-material-template__toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 14px 2px;
}

.committee-material-template__toolbar-title {
  display: grid;
  gap: 4px;
}

.committee-material-template__toolbar-title strong {
  color: var(--bq-color-text-primary);
  font-size: 16px;
}

.committee-material-template__toolbar-title span {
  color: var(--bq-color-text-secondary);
  font-size: 12px;
}

.committee-material-template__table-wrapper {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  position: relative;
  padding: 0 14px;
  overflow: hidden;
}

.committee-material-template__table {
  width: 100%;
  height: 100%;
}

.committee-material-template__table :deep(.el-table__header th) {
  height: 48px;
  color: #1f2937;
  background: #f6f8fb;
  font-weight: 500;
}

.committee-material-template__table :deep(.el-table__row td) {
  height: 52px;
}

.committee-material-template__pagination-wrapper {
  flex: 0 0 auto;
  padding: 4px 14px 12px;
}

@media (max-width: 1080px) {
  .committee-material-template-page {
    height: auto;
    min-height: 100%;
  }

  .committee-material-template {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  .committee-material-template__tree {
    height: 280px;
    max-height: 280px;
    border-right: 0;
    border-bottom: 1px solid var(--bq-color-border-subtle);
    padding-right: 18px;
  }

  .committee-material-template__main {
    height: auto;
    overflow: visible;
  }

  .committee-material-template__table-wrapper {
    height: 480px;
  }
}

@media (max-width: 640px) {
  .committee-material-template__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
