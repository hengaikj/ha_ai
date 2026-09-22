<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  Delete,
  EditPen,
  InfoFilled,
  Plus,
  RefreshRight,
} from "@element-plus/icons-vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import BasePagination from "@/components/base/BasePagination.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { useAuthStore } from "@/stores/auth";
import {
  deleteRdGroup,
  deleteRdProfession,
  fetchRdCategoryOptions,
  fetchRdGroups,
  fetchRdProfessionCategories,
  fetchRdProfessions,
  replaceRdProfessionCategories,
  saveRdGroup,
  saveRdProfession,
} from "@/api/rd-category";
import type {
  RdCategoryOption,
  RdGroup,
  RdProfession,
} from "@/types/rd-category";

type GroupForm = {
  id?: number;
  groupCode: string;
  groupName: string;
  sortNo: number;
};

type ProfessionForm = {
  id?: number;
  groupId: number;
  professionCode: string;
  professionName: string;
  sortNo: number;
};

const authStore = useAuthStore();
const canAddGroup = computed(() =>
  authStore.hasPermission("base:rd-category:group:add"),
);
const canEditGroup = computed(() =>
  authStore.hasPermission("base:rd-category:group:edit"),
);
const canDeleteGroup = computed(() =>
  authStore.hasPermission("base:rd-category:group:remove"),
);

const loading = ref(false);
const groupLoading = ref(false);
const professionLoading = ref(false);
const saving = ref(false);
const deleting = ref(false);

const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const groups = ref<RdGroup[]>([]);
const professions = ref<RdProfession[]>([]);
const groupProfessionCounts = ref<Record<number, number>>({});
const selectedGroupId = ref<number>();

const pageNo = ref(1);
const pageSize = ref(10);

const groupDialogVisible = ref(false);
const professionDialogVisible = ref(false);

const editingGroupId = ref<number>();
const editingProfessionId = ref<number>();
const categoryOptions = ref<RdCategoryOption[]>([]);
const selectedCategoryIds = ref<number[]>([]);

const groupForm = reactive<GroupForm>(emptyGroupForm());
const professionForm = reactive<ProfessionForm>(emptyProfessionForm());

function emptyGroupForm(): GroupForm {
  return {
    id: undefined,
    groupCode: "",
    groupName: "",
    sortNo: (groups.value?.length || 0) > 0 ? (groups.value.length + 1) * 10 : 10,
  };
}

function emptyProfessionForm(): ProfessionForm {
  return {
    id: undefined,
    groupId: selectedGroupId.value ?? 0,
    professionCode: "",
    professionName: "",
    sortNo: (professions.value?.length || 0) > 0 ? (professions.value.length + 1) * 10 : 10,
  };
}

const selectedGroup = computed(() =>
  groups.value.find((group) => group.id === selectedGroupId.value),
);

const groupTree = computed(() => {
  return groups.value.map((group) => ({
    id: group.id,
    label: group.groupName,
    code: group.groupCode,
    count: groupProfessionCounts.value[group.id] ?? 0,
  }));
});

const pagedProfessions = computed(() => {
  const start = (pageNo.value - 1) * pageSize.value;
  return professions.value.slice(start, start + pageSize.value);
});

const selectedCategoryTableData = computed(() =>
  categoryOptions.value.filter((item) =>
    selectedCategoryIds.value.includes(item.categoryId),
  ),
);

function professionIndex(index: number) {
  return (pageNo.value - 1) * pageSize.value + index + 1;
}

async function load() {
  loading.value = true;
  try {
    await loadGroups();
  } catch {
    BaseToast.error("研发分类数据加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadGroups() {
  groupLoading.value = true;
  try {
    groups.value = await fetchRdGroups();
    if (
      !selectedGroupId.value ||
      !groups.value.some((item) => item.id === selectedGroupId.value)
    ) {
      selectedGroupId.value = groups.value[0]?.id;
    }
    pageNo.value = 1;
    await Promise.all([loadGroupProfessionCounts(), loadProfessions()]);
  } finally {
    groupLoading.value = false;
  }
}

async function loadProfessions() {
  professionLoading.value = true;
  try {
    if (!selectedGroupId.value) {
      professions.value = [];
      return;
    }
    const list = await fetchRdProfessions(selectedGroupId.value);
    professions.value = (list ?? [])
      .slice()
      .sort((a, b) => (a.sortNo ?? 0) - (b.sortNo ?? 0));
    groupProfessionCounts.value = {
      ...groupProfessionCounts.value,
      [selectedGroupId.value]: professions.value.length,
    };
  } finally {
    professionLoading.value = false;
  }
}

async function loadGroupProfessionCounts() {
  const otherGroups = groups.value.filter(
    (item) => item.id !== selectedGroupId.value,
  );
  const entries = await Promise.all(
    otherGroups.map(async (group) => {
      try {
        const list = await fetchRdProfessions(group.id);
        return [group.id, list?.length ?? 0] as const;
      } catch {
        return [group.id, 0] as const;
      }
    }),
  );
  groupProfessionCounts.value = {
    ...groupProfessionCounts.value,
    ...Object.fromEntries(entries),
  };
}

async function selectGroupById(groupId: number) {
  if (groupId === selectedGroupId.value) return;
  selectedGroupId.value = groupId;
  pageNo.value = 1;
  await loadProfessions();
}

function changePage(nextPage: number) {
  pageNo.value = nextPage;
}

function changePageSize(nextPageSize: number) {
  pageSize.value = nextPageSize;
  pageNo.value = 1;
}

function openCreateGroup() {
  editingGroupId.value = undefined;
  delete groupForm.id;
  Object.assign(groupForm, emptyGroupForm());
  groupDialogVisible.value = true;
}

function handleGroupDialogClosed() {
  editingGroupId.value = undefined;
  delete groupForm.id;
  Object.assign(groupForm, emptyGroupForm());
}

function openEditGroup(group: RdGroup) {
  editingGroupId.value = group.id;
  Object.assign(groupForm, {
    id: group.id,
    groupCode: group.groupCode,
    groupName: group.groupName,
    sortNo: group.sortNo ?? 10,
  });
  groupDialogVisible.value = true;
}

async function saveGroupItem() {
  const code = groupForm.groupCode.trim();
  const name = groupForm.groupName.trim();
  if (!code || !name) {
    BaseToast.warning("请填写研发群组编码和名称");
    return;
  }

  const hasDuplicate = groups.value.some(
    (g) =>
      g.groupCode.trim().toLowerCase() === code.toLowerCase() &&
      g.id !== editingGroupId.value,
  );
  if (hasDuplicate) {
    BaseToast.warning(`群组编码“${code}”已存在，不能重复`);
    return;
  }

  saving.value = true;
  try {
    const payload = {
      groupCode: code,
      groupName: name,
      sortNo: groupForm.sortNo,
      status: "0",
    };
    const targetEditId = editingGroupId.value;
    await saveRdGroup(payload, targetEditId ? targetEditId : undefined);
    BaseToast.success(targetEditId ? "研发群组已更新" : "研发群组已新增");
    groupDialogVisible.value = false;
    await loadGroups();
  } finally {
    saving.value = false;
  }
}

async function removeGroup(group: RdGroup) {
  try {
    await openConfirm({
      title: "删除确认",
      message: `确认删除研发群组“${group.groupName}”吗？删除后该群组下的专业将不再展示。`,
      type: "danger",
      confirmText: "删除",
    });
  } catch {
    return;
  }
  if (deleting.value) return;
  deleting.value = true;
  try {
    await deleteRdGroup(group.id);
    BaseToast.success("研发群组已删除");
    if (selectedGroupId.value === group.id) {
      selectedGroupId.value = undefined;
    }
    await loadGroups();
  } finally {
    deleting.value = false;
  }
}

function openCreateProfession() {
  if (!selectedGroupId.value) {
    BaseToast.warning("请先在左侧选择所属群组");
    return;
  }
  editingProfessionId.value = undefined;
  delete professionForm.id;
  Object.assign(professionForm, emptyProfessionForm(), {
    groupId: selectedGroupId.value,
  });
  selectedCategoryIds.value = [];
  professionDialogVisible.value = true;
  ensureCategoryOptions();
}

function handleProfessionDialogClosed() {
  editingProfessionId.value = undefined;
  delete professionForm.id;
  Object.assign(professionForm, emptyProfessionForm());
  selectedCategoryIds.value = [];
}

async function ensureCategoryOptions() {
  if (categoryOptions.value.length === 0) {
    try {
      categoryOptions.value = await fetchRdCategoryOptions();
    } catch {
      BaseToast.error("成本专业分工选项加载失败");
    }
  }
}

async function openEditProfession(profession: RdProfession) {
  editingProfessionId.value = profession.id;
  Object.assign(professionForm, {
    id: profession.id,
    groupId: profession.groupId,
    professionCode: profession.professionCode,
    professionName: profession.professionName,
    sortNo: profession.sortNo ?? 10,
  });
  selectedCategoryIds.value = [];
  professionDialogVisible.value = true;
  try {
    const [, selected] = await Promise.all([
      ensureCategoryOptions(),
      fetchRdProfessionCategories(profession.id),
    ]);
    selectedCategoryIds.value = (selected ?? []).map((item) => item.categoryId);
  } catch {
    BaseToast.error("成本专业分工数据加载失败");
  }
}

function removeCategoryItem(categoryId: number) {
  selectedCategoryIds.value = selectedCategoryIds.value.filter(
    (id) => id !== categoryId,
  );
}

async function saveProfessionItem() {
  const code = professionForm.professionCode.trim();
  const name = professionForm.professionName.trim();
  const groupId = professionForm.groupId;

  if (!groupId || !code || !name) {
    BaseToast.warning("请填写所属群组、专业编码和名称");
    return;
  }

  const hasDuplicate = professions.value.some(
    (p) =>
      p.groupId === groupId &&
      p.professionCode.trim().toLowerCase() === code.toLowerCase() &&
      p.id !== editingProfessionId.value,
  );
  if (hasDuplicate) {
    BaseToast.warning(`当前群组下专业编码“${code}”已存在，不能重复`);
    return;
  }

  saving.value = true;
  try {
    const payload = {
      groupId,
      professionCode: code,
      professionName: name,
      sortNo: professionForm.sortNo,
      status: "0",
    };
    const targetEditId = editingProfessionId.value;
    if (targetEditId) {
      await Promise.all([
        saveRdProfession(payload, targetEditId),
        replaceRdProfessionCategories(
          targetEditId,
          selectedCategoryIds.value,
        ),
      ]);
      BaseToast.success("研发专业及成本专业分工已更新");
    } else {
      // 严格新增模式：确保绝不传老 ID，强制发 POST
      const created = await saveRdProfession(payload, undefined);
      if (created?.id && selectedCategoryIds.value.length > 0) {
        await replaceRdProfessionCategories(
          created.id,
          selectedCategoryIds.value,
        );
      }
      BaseToast.success("研发专业及成本专业分工已新增");
    }
    professionDialogVisible.value = false;
    await loadProfessions();
  } catch {
    BaseToast.error("保存失败，请重试");
  } finally {
    saving.value = false;
  }
}

async function removeProfession(profession: RdProfession) {
  try {
    await openConfirm({
      scene: "delete",
      object: "研发专业",
      name: profession.professionName,
    });
  } catch {
    return;
  }
  if (deleting.value) return;
  deleting.value = true;
  try {
    await deleteRdProfession(profession.id);
    BaseToast.success("研发专业已删除");
    await loadProfessions();
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <PageContainer class="rd-category-page" title="研发分类管理">
    <section v-loading="loading" class="rd-category-layout">
      <!-- 左侧群组管理面板 -->
      <aside v-loading="groupLoading" class="rd-category__tree">
        <header class="rd-category__tree-tools">
          <div class="rd-category__tree-title">
            <strong>群组管理</strong>
            <span>按群组组织研发专业</span>
          </div>
          <div class="rd-category__tree-actions">
            <el-button
              v-if="canAddGroup"
              :icon="Plus"
              circle
              title="新增群组"
              @click="openCreateGroup"
            />
            <el-button
              v-if="canEditGroup"
              :icon="EditPen"
              :disabled="!selectedGroup"
              circle
              title="编辑群组"
              @click="selectedGroup && openEditGroup(selectedGroup)"
            />
            <el-button :icon="RefreshRight" circle title="刷新" @click="load" />
            <el-button
              v-if="canDeleteGroup"
              :icon="Delete"
              :disabled="!selectedGroup"
              circle
              title="删除群组"
              @click="selectedGroup && removeGroup(selectedGroup)"
            />
          </div>
        </header>

        <el-tree
          class="rd-category__category-tree"
          :data="groupTree"
          node-key="id"
          :default-expanded-keys="selectedGroupId ? [selectedGroupId] : []"
          highlight-current
          :current-node-key="selectedGroupId"
          empty-text="暂无群组"
          @node-click="selectGroupById($event.id)"
        >
          <template #default="{ data }">
            <div class="rd-category__tree-node">
              <span :title="data.label">{{ data.label }}</span>
              <em>{{ data.count }}</em>
            </div>
          </template>
        </el-tree>
      </aside>

      <!-- 右侧研发专业主工作区 -->
      <main class="rd-category__main">
        <section class="rd-category__toolbar">
          <div class="rd-category__toolbar-title">
            <strong>{{ selectedGroup?.groupName || "研发专业" }}</strong>
            <span>按当前群组维护研发专业基础信息及成本专业分工</span>
          </div>
          <PermissionButton
            permission="base:rd-category:profession:add"
            type="primary"
            :disabled="!selectedGroup"
            @click="openCreateProfession"
          >
            新增专业
          </PermissionButton>
        </section>

        <div class="rd-category__table-wrapper">
          <el-table
            v-loading="professionLoading"
            class="rd-category__table"
            :data="pagedProfessions"
            border
            row-key="id"
            height="100%"
            :scrollbar-always-on="true"
            empty-text="当前群组暂无专业"
          >
            <el-table-column
              type="index"
              label="序号"
              width="70"
              align="center"
              header-align="center"
              :index="professionIndex"
            />
            <el-table-column
              label="专业名称"
              min-width="220"
              align="center"
              header-align="center"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span class="rd-text-strong">{{ row.professionName }}</span>
              </template>
            </el-table-column>
            <el-table-column
              label="专业编码"
              min-width="160"
              align="center"
              header-align="center"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span>{{ row.professionCode }}</span>
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
              label="操作"
              width="130"
              fixed="right"
              align="center"
              header-align="center"
            >
              <template #default="{ row }">
                <div class="bq-table-actions">
                  <PermissionButton
                    permission="base:rd-category:profession:edit"
                    link
                    type="primary"
                    @click="openEditProfession(row)"
                  >
                    编辑
                  </PermissionButton>
                  <PermissionButton
                    permission="base:rd-category:profession:remove"
                    link
                    type="danger"
                    @click="removeProfession(row)"
                  >
                    删除
                  </PermissionButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="rd-category__pagination-wrapper">
          <BasePagination
            :page-no="pageNo"
            :page-size="pageSize"
            :total="professions.length"
            @page-change="changePage"
            @size-change="changePageSize"
          />
        </div>
      </main>
    </section>

    <!-- 研发群组弹窗 -->
    <el-dialog
      v-model="groupDialogVisible"
      :title="editingGroupId ? '编辑研发群组' : '新增研发群组'"
      width="520px"
      append-to-body
      destroy-on-close
      @closed="handleGroupDialogClosed"
    >
      <el-form :model="groupForm" label-width="96px">
        <el-form-item label="群组名称" required>
          <el-input
            v-model="groupForm.groupName"
            maxlength="100"
            clearable
            placeholder="请输入研发群组名称"
          />
        </el-form-item>
        <el-form-item label="群组编码" required>
          <el-input
            v-model="groupForm.groupCode"
            maxlength="100"
            clearable
            placeholder="请输入群组编码"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number
            v-model="groupForm.sortNo"
            :min="0"
            style="width: 160px"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">取消</el-button>
        <PermissionButton
          :permission="
            editingGroupId
              ? 'base:rd-category:group:edit'
              : 'base:rd-category:group:add'
          "
          type="primary"
          :loading="saving"
          @click="saveGroupItem"
        >
          保存群组
        </PermissionButton>
      </template>
    </el-dialog>

    <!-- 研发专业及成本专业分工一站式维护弹窗 -->
    <el-dialog
      v-model="professionDialogVisible"
      :title="
        editingProfessionId
          ? `编辑研发专业 - ${professionForm.professionName || ''}`
          : '新增研发专业'
      "
      width="920px"
      top="5vh"
      append-to-body
      destroy-on-close
      class="rd-profession-dialog"
      @closed="handleProfessionDialogClosed"
    >
      <div class="rd-dialog-scroll">
        <!-- 基本信息卡片 -->
        <div class="rd-form-section">
          <div class="rd-form-section__header">
            <span class="rd-form-section__title">基本信息</span>
          </div>
          <el-form :model="professionForm" label-width="84px">
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="所属群组" required>
                  <el-select v-model="professionForm.groupId" style="width: 100%">
                    <el-option
                      v-for="group in groups"
                      :key="group.id"
                      :label="group.groupName"
                      :value="group.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="专业名称" required>
                  <el-input
                    v-model="professionForm.professionName"
                    maxlength="100"
                    clearable
                    placeholder="请输入研发专业名称"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="专业编码" required>
                  <el-input
                    v-model="professionForm.professionCode"
                    maxlength="100"
                    clearable
                    placeholder="请输入专业编码"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="显示排序">
                  <el-input-number
                    v-model="professionForm.sortNo"
                    :min="0"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </div>

        <!-- 成本专业分工卡片 -->
        <div class="rd-form-section">
          <div class="rd-form-section__header">
            <div class="rd-form-section__title-group">
              <span class="rd-form-section__title">关联成本专业分工</span>
              <el-tag size="small" type="primary" effect="plain" class="rd-count-tag">
                已关联 {{ selectedCategoryIds.length }} 项分工
              </el-tag>
              <el-tooltip
                content="研发专业关联统一成本分类的物理第4层节点（三级零部件），用于确定该专业承担的成本分工范围，层级名称由成本主数据统一维护。"
                placement="top"
              >
                <el-icon class="rd-section-help-icon">
                  <InfoFilled />
                </el-icon>
              </el-tooltip>
            </div>
            <el-button
              v-if="selectedCategoryIds.length"
              type="danger"
              link
              size="small"
              @click="selectedCategoryIds = []"
            >
              清空分工
            </el-button>
          </div>

          <div class="rd-category-select-bar">
            <el-select
              v-model="selectedCategoryIds"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              clearable
              style="width: 100%"
              placeholder="搜索并选择关联的成本零部件（支持输入零部件名称或完整分类路径快速搜索）..."
            >
              <el-option
                v-for="option in categoryOptions"
                :key="option.categoryId"
                :label="option.fullPath"
                :value="option.categoryId"
              />
            </el-select>
          </div>

          <el-table
            :data="selectedCategoryTableData"
            border
            max-height="290"
            class="rd-category-table"
            empty-text="当前专业暂未关联成本专业分工，请在上方搜索选择添加"
          >
            <el-table-column
              type="index"
              label="序号"
              width="60"
              align="center"
              header-align="center"
            />
            <el-table-column
              prop="partAttribute"
              label="零件属性"
              width="100"
              align="center"
              header-align="center"
              show-overflow-tooltip
            />
            <el-table-column
              prop="firstClassification"
              label="一级分类"
              width="110"
              align="center"
              header-align="center"
              show-overflow-tooltip
            />
            <el-table-column
              prop="secondClassification"
              label="二级分类（38个系统）"
              min-width="170"
              align="center"
              header-align="center"
              show-overflow-tooltip
            />
            <el-table-column
              prop="categoryName"
              label="三级零部件"
              min-width="180"
              align="center"
              header-align="center"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span class="rd-text-strong">{{ row.categoryName }}</span>
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              width="80"
              align="center"
              header-align="center"
              fixed="right"
            >
              <template #default="{ row }">
                <el-button
                  link
                  type="danger"
                  @click="removeCategoryItem(row.categoryId)"
                >
                  移除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <el-button @click="professionDialogVisible = false">取消</el-button>
        <PermissionButton
          :permission="
            editingProfessionId
              ? 'base:rd-category:profession:edit'
              : 'base:rd-category:profession:add'
          "
          type="primary"
          :loading="saving"
          @click="saveProfessionItem"
        >
          保存专业及分工
        </PermissionButton>
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
.rd-category-page {
  display: flex;
  box-sizing: border-box;
  min-height: 0;
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height, 0px) - var(--bq-space-page-y, 16px) * 2 - 14px
  );
  flex-direction: column;
}

.rd-category-page :deep(.page-container__body) {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}

.rd-category-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 24px;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.rd-category__tree,
.rd-category__main {
  min-width: 0;
  background: var(--bq-color-surface);
}

.rd-category__tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid var(--bq-color-border-subtle);
  padding: 12px 10px;
}

.rd-category__tree-tools {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px 8px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.rd-category__tree-title {
  display: grid;
  gap: 4px;
  padding: 0 4px;
}

.rd-category__tree-title strong {
  color: var(--bq-color-text-primary);
  font-size: 16px;
}

.rd-category__tree-title span {
  color: var(--bq-color-text-secondary);
  font-size: 12px;
}

.rd-category__tree-actions {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  padding: 0 4px;
  box-sizing: border-box;
}

.rd-category__tree-actions :deep(.el-button.is-circle) {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0 !important;
  margin: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 50% !important;
  border: 1px solid #d7dfed;
  background-color: #ffffff;
  color: var(--el-color-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.rd-category__tree-actions :deep(.el-button.is-circle:hover) {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  background-color: #f0f7ff;
}

.rd-category__tree-actions :deep(.el-button.is-circle.is-disabled) {
  color: #c0c4cc !important;
  border-color: #e4e7ed !important;
  background-color: #f5f7fa !important;
  box-shadow: none;
}

.rd-category__tree-actions :deep(.el-button.is-circle .el-icon) {
  width: 16px;
  height: 16px;
  margin: 0 !important;
  padding: 0 !important;
  font-size: 16px;
  line-height: 1;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.rd-category__tree-actions :deep(.el-button.is-circle .el-icon svg) {
  width: 16px;
  height: 16px;
  margin: 0 !important;
  display: block;
}

.rd-category__tree-actions :deep(.el-button.is-circle > *) {
  margin: 0 !important;
}

.rd-category__category-tree {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  background: transparent;
}

.rd-category__category-tree :deep(.el-tree-node__content) {
  height: 42px;
  margin: 2px 0;
  border-radius: 0;
  color: #26364d;
}

.rd-category__tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  gap: 8px;
  padding-right: 10px;
}

.rd-category__tree-node span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.rd-category__tree-node em {
  min-width: 22px;
  color: var(--bq-color-text-secondary);
  font-style: normal;
  text-align: right;
  font-size: 13px;
}

.rd-category__main {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  gap: 12px;
}

.rd-category__toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 14px 2px;
}

.rd-category__toolbar-title {
  display: grid;
  gap: 4px;
}

.rd-category__toolbar-title strong {
  color: var(--bq-color-text-primary);
  font-size: 16px;
}

.rd-category__toolbar-title span {
  color: var(--bq-color-text-secondary);
  font-size: 12px;
}

.rd-category__table-wrapper {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  position: relative;
  padding: 0 14px;
  overflow: hidden;
}

.rd-category__table {
  width: 100%;
  height: 100%;
}

.rd-category__table :deep(.el-table__header th) {
  height: 48px;
  color: #1f2937;
  background: #f6f8fb;
  font-weight: 500;
}

.rd-category__table :deep(.el-table__row td) {
  height: 52px;
}

.rd-text-strong {
  font-weight: 500;
  color: #1f2937;
}

.rd-category__pagination-wrapper {
  flex: 0 0 auto;
  padding: 4px 14px 12px;
}

.rd-dialog-scroll {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 6px;
}

.rd-form-section {
  background: #fbfcfe;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 8px;
  padding: 16px 18px 14px;
  margin-bottom: 16px;
}

.rd-form-section:last-child {
  margin-bottom: 0;
}

.rd-form-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.rd-form-section__title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rd-form-section__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--bq-color-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.rd-form-section__title::before {
  content: "";
  display: inline-block;
  width: 3px;
  height: 14px;
  background-color: var(--el-color-primary);
  border-radius: 2px;
}

.rd-section-help-icon {
  font-size: 15px;
  color: #909399;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: color 0.2s, transform 0.2s;
}

.rd-section-help-icon:hover {
  color: var(--el-color-primary);
  transform: scale(1.08);
}

.rd-category-select-bar {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 14px;
}

.rd-count-tag {
  font-size: 12px;
  height: 24px;
  line-height: 22px;
}

.rd-category-table {
  width: 100%;
}

.rd-category-table :deep(.el-table__header th) {
  background: #f6f8fb;
  color: #1f2937;
  font-weight: 500;
}

@media (max-width: 1080px) {
  .rd-category-page {
    height: auto;
    min-height: 100%;
  }

  .rd-category-layout {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  .rd-category__tree {
    height: 280px;
    max-height: 280px;
    border-right: 0;
    border-bottom: 1px solid var(--bq-color-border-subtle);
    padding-right: 18px;
  }

  .rd-category__main {
    height: auto;
    overflow: visible;
  }

  .rd-category__table-wrapper {
    height: 480px;
  }
}

@media (max-width: 640px) {
  .rd-category__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .rd-category-select-bar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

