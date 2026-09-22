<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import { CirclePlus } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  fetchCommitteeGateTemplates,
  saveCommitteeGateTemplate,
} from "@/api/committee";
import {
  createBusinessValve,
  deleteBusinessValve,
  fetchBusinessValveDetail,
  fetchBusinessValveMaterialCategories,
  fetchBusinessValveMaterialTemplates,
  fetchBusinessValves,
  updateBusinessValve,
} from "@/api/project";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { toDateTimeRangeParams } from "@/utils/date-range";
import { resolvePageTotal } from "@/utils/pagination";
import { normalizeValveGateCode } from "@/utils/valve-material-template";
import type { CommitteeGateTemplate, CommitteeId } from "@/types/committee";
import type {
  BusinessValveMaterialCategory,
  BusinessValveMaterialTemplateItem,
} from "@/types/project";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type ValveRow = {
  id: number;
  code: string;
  name: string;
  gatePurpose: string;
  coreWorkContent: string;
  sortNo: number;
  remark: string;
  version: number;
  createdAt: string;
};

type ValveForm = {
  id?: number;
  code: string;
  name: string;
  gatePurpose: string;
  coreWorkContent: string;
  materialKeys: string[];
  sortNo?: number;
  remark: string;
  version?: number;
};

type ValveMaterialOption = {
  key: string;
  label: string;
  groupKey: string;
  sourceTemplateId: string | number | null;
};

type ValveMaterialGroup = {
  key: string;
  label: string;
  materials: ValveMaterialOption[];
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const formRef = ref<FormInstance>();
const query = reactive({
  name: "",
  createdAtRange: [] as string[],
});
const form = reactive<ValveForm>(emptyForm());
const formVisible = ref(false);
const saving = ref(false);
const confirmVisible = ref(false);
const deleteLoading = ref(false);
const pendingDeleteRows = ref<ValveRow[]>([]);
const selectedRows = ref<ValveRow[]>([]);
const materialListVisible = ref(false);
const materialLoading = ref(false);
const activeMaterialGroupKey = ref("");
const materialRenderKey = ref(0);
const valveMaterialGroups = ref<ValveMaterialGroup[]>([]);
const currentGateTemplate = ref<CommitteeGateTemplate | null>(null);

const valveMaterialOptions = computed(() =>
  valveMaterialGroups.value.flatMap((group) => group.materials),
);
const activeMaterialGroup = computed(
  () =>
    valveMaterialGroups.value.find(
      (group) => group.key === activeMaterialGroupKey.value,
    ) ?? null,
);
const activeMaterialItems = computed(
  () => activeMaterialGroup.value?.materials ?? [],
);
const hasSelectedMaterials = computed(() => form.materialKeys.length > 0);

const editing = computed(() => Boolean(form.id));
const formTitle = computed(() => (editing.value ? "编辑阀点" : "新增阀点"));
const formRules: FormRules<ValveForm> = {
  name: [
    { required: true, message: "请输入阀点", trigger: "blur" },
    { whitespace: true, message: "阀点不能为空", trigger: "blur" },
  ],
};
const deleteConfirmContent = computed(() => {
  if (pendingDeleteRows.value.length > 1) {
    return buildBaseConfirmContent({
      scene: "batchDelete",
      object: "阀点",
      count: pendingDeleteRows.value.length,
    });
  }
  const row = pendingDeleteRows.value[0];
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "delete",
    object: "阀点",
    name: row.name,
  });
});

async function queryItems(pageSize: number, pageNo: number) {
  const { createdFrom, createdTo } = toDateTimeRangeParams(
    query.createdAtRange,
  );
  const page = await fetchBusinessValves(
    {
      keyword: query.name.trim() || undefined,
      createdAtStart: createdFrom,
      createdAtEnd: createdTo,
      pageNo,
      pageSize,
    },
    { allowMock: false },
  );
  const list = (page.records ?? []).map((item) => ({
    id: item.valveId as number,
    code: item.valveCode,
    name: item.valveName,
    gatePurpose: item.gatePurpose ?? "",
    coreWorkContent: item.coreWorkContent ?? "",
    sortNo: item.sortNo,
    remark: item.remark ?? "",
    version: item.version,
    createdAt: item.createdAt ?? "",
  }));
  return {
    total: resolvePageTotal(
      { ...page, records: list, pageNo, pageSize },
      pageNo,
      pageSize,
    ),
    list,
    pageNo,
    pageSize,
  };
}

function emptyForm(): ValveForm {
  return {
    code: "",
    name: "",
    gatePurpose: "",
    coreWorkContent: "",
    materialKeys: [],
    sortNo: undefined,
    remark: "",
  };
}

function normalizeMaterialGroupKey(category: BusinessValveMaterialCategory) {
  return String(category.id ?? category.categoryCode);
}

function normalizeMaterialKey(
  material: BusinessValveMaterialTemplateItem,
  categoryKey: string,
) {
  return String(material.id ?? `${categoryKey}-${material.materialName ?? ""}`);
}

async function loadValveMaterials() {
  materialLoading.value = true;
  valveMaterialGroups.value = [];
  try {
    const [categories, materials] = await Promise.all([
      fetchBusinessValveMaterialCategories(),
      fetchBusinessValveMaterialTemplates(),
    ]);
    const nextGroups = categories
      .filter((category) => category.enableFlag !== "0")
      .slice()
      .sort((first, second) => (first.sortNo ?? 0) - (second.sortNo ?? 0))
      .map<ValveMaterialGroup>((category) => {
        const groupKey = normalizeMaterialGroupKey(category);
        return {
          key: groupKey,
          label: category.categoryName,
          materials: materials
            .filter(
              (material) =>
                material.enableFlag !== "0" &&
                String(material.categoryId ?? "") === String(category.id ?? ""),
            )
            .slice()
            .sort(
              (first, second) => (first.sortNo ?? 0) - (second.sortNo ?? 0),
            )
            .map((material) => ({
              key: normalizeMaterialKey(material, groupKey),
              label: material.materialName ?? "",
              groupKey,
              sourceTemplateId: material.id ?? null,
            }))
            .filter((material) => Boolean(material.label)),
        };
      });
    valveMaterialGroups.value = nextGroups;
    const validKeys = new Set(valveMaterialOptions.value.map((item) => item.key));
    form.materialKeys = form.materialKeys.filter((key) => validKeys.has(key));
    if (
      activeMaterialGroupKey.value &&
      !nextGroups.some((group) => group.key === activeMaterialGroupKey.value)
    ) {
      activeMaterialGroupKey.value = "";
    }
    materialRenderKey.value += 1;
  } finally {
    materialLoading.value = false;
  }
}

function resetQuery() {
  query.name = "";
  query.createdAtRange = [];
}

function searchItems() {
  queryTableRef.value?.search();
}

async function openCreateDialog() {
  delete form.id;
  delete form.version;
  Object.assign(form, emptyForm());
  form.materialKeys = [];
  materialListVisible.value = false;
  activeMaterialGroupKey.value = "";
  currentGateTemplate.value = null;
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
  await loadValveMaterials();
}

async function openEditDialog(row: ValveRow) {
  Object.assign(form, {
    ...emptyForm(),
    id: row.id,
    code: row.code,
    name: row.name,
    gatePurpose: row.gatePurpose,
    coreWorkContent: row.coreWorkContent,
    sortNo: row.sortNo,
    remark: row.remark,
    version: row.version,
  });
  materialListVisible.value = true;
  activeMaterialGroupKey.value = "";
  valveMaterialGroups.value = [];
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());

  const [detail, gateTemplates] = await Promise.all([
    fetchBusinessValveDetail(row.id),
    fetchCommitteeGateTemplates(),
    loadValveMaterials(),
  ]);

  Object.assign(form, {
    id: detail.valveId as number,
    code: detail.valveCode,
    name: detail.valveName,
    gatePurpose: detail.gatePurpose ?? "",
    coreWorkContent: detail.coreWorkContent ?? "",
    materialKeys: [],
    sortNo: detail.sortNo,
    remark: detail.remark ?? "",
    version: detail.version,
  });
  currentGateTemplate.value = findGateTemplate(
    gateTemplates,
    detail.valveName || row.name,
    detail.valveCode || row.code,
  );
  fillMaterialKeysFromTemplate(
    currentGateTemplate.value?.materialTemplateIds ?? [],
  );
}

async function saveItem() {
  if (saving.value) {
    return;
  }
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const payload = {
    valveName: form.name.trim(),
    gatePurpose: form.gatePurpose.trim(),
    coreWorkContent: form.coreWorkContent.trim(),
    sortNo: form.sortNo,
    remark: form.remark.trim() || undefined,
  };

  saving.value = true;
  try {
    if (form.id) {
      await updateBusinessValve(form.id, {
        ...payload,
        version: form.version ?? 0,
      });
      await saveValveGateTemplate();
      BaseToast.success("阀点已更新");
    } else {
      await saveValveGateTemplate();
      await createBusinessValve({
        valveCode: form.code.trim() || `VALVE-${Date.now()}`,
        ...payload,
      });
      BaseToast.success("阀点已新增");
    }
    formVisible.value = false;
    await queryTableRef.value?.reload();
  } finally {
    saving.value = false;
  }
}

function handleSelectionChange(selection: ValveRow[]) {
  selectedRows.value = selection;
}

function selectMaterialGroup(group: ValveMaterialGroup) {
  activeMaterialGroupKey.value = group.key;
}

function selectedMaterials(group: ValveMaterialGroup) {
  return group.materials.filter((item) => form.materialKeys.includes(item.key));
}

function findGateTemplate(
  templates: CommitteeGateTemplate[],
  valveName: string,
  fallbackCode: string,
) {
  const gateCode = normalizeValveGateCode(valveName, fallbackCode);
  return (
    templates.find((template) => template.gateCode === gateCode) ??
    templates.find((template) => template.gateName === valveName) ??
    null
  );
}

function fillMaterialKeysFromTemplate(materialTemplateIds: CommitteeId[]) {
  const selectedIds = new Set(materialTemplateIds.map(String));
  form.materialKeys = valveMaterialOptions.value
    .filter(
      (item) =>
        item.sourceTemplateId !== null &&
        selectedIds.has(String(item.sourceTemplateId)),
    )
    .map((item) => item.key);
}

async function saveValveGateTemplate() {
  const gateCode = normalizeValveGateCode(
    form.name,
    form.code || String(form.id ?? ""),
  );
  const existing = currentGateTemplate.value;
  const template: CommitteeGateTemplate = {
    ...(existing ?? { id: gateCode }),
    gateCode,
    gateName: form.name.trim(),
    sequenceNo: form.sortNo ?? 0,
    gatePurpose: form.gatePurpose.trim() || undefined,
    coreWorkContent: form.coreWorkContent.trim() || undefined,
    materialTemplateIds: selectedMaterialTemplateIds(),
    enableFlag: existing?.enableFlag ?? "1",
  };
  await saveCommitteeGateTemplate(gateCode, template);
  currentGateTemplate.value = template;
}

function selectedMaterialTemplateIds() {
  return valveMaterialOptions.value
    .filter((item) => form.materialKeys.includes(item.key))
    .flatMap((item) => {
      const id = Number(item.sourceTemplateId);
      return Number.isFinite(id) && id > 0 ? [String(id)] : [];
    });
}

function handleGroupChecked(group: ValveMaterialGroup, value: unknown) {
  selectMaterialGroup(group);
  setGroupChecked(group, Boolean(value));
}

function setGroupChecked(group: ValveMaterialGroup, checked: boolean) {
  const groupKeys = group.materials.map((item) => item.key);
  const nextKeys = new Set(form.materialKeys);
  groupKeys.forEach((key) => {
    if (checked) {
      nextKeys.add(key);
    } else {
      nextKeys.delete(key);
    }
  });
  form.materialKeys = valveMaterialOptions.value
    .map((item) => item.key)
    .filter((key) => nextKeys.has(key));
}

function isGroupChecked(group: ValveMaterialGroup) {
  return (
    group.materials.length > 0 &&
    group.materials.every((item) => form.materialKeys.includes(item.key))
  );
}

function isGroupIndeterminate(group: ValveMaterialGroup) {
  if (!group.materials.length) return false;
  const selectedCount = selectedMaterials(group).length;
  return selectedCount > 0 && selectedCount < group.materials.length;
}

function removeMaterial(key: string) {
  form.materialKeys = form.materialKeys.filter((item) => item !== key);
}

function materialCount(group: ValveMaterialGroup) {
  return selectedMaterials(group).length;
}

function confirmDelete(row?: ValveRow) {
  const ids = row ? [row] : selectedRows.value;
  if (!ids.length) {
    BaseToast.warning("请先选择阀点");
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
      pendingDeleteRows.value.map((row) => deleteBusinessValve(row.id)),
    );
    confirmVisible.value = false;
    BaseToast.success(deleteConfirmContent.value.successMessage);
    await queryTableRef.value?.reload();
  } finally {
    deleteLoading.value = false;
  }
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
    title="阀点管理"
    description="维护项目过阀节点、排序和预算锁定控制信息。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryItems"
      row-key="id"
      fit-table-height
      empty-title="暂无阀点"
      empty-description="当前条件下没有可展示的阀点。"
      @selection-change="handleSelectionChange"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="阀点">
            <el-input
              v-model="query.name"
              clearable
              placeholder="请输入阀点"
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
            permission="system:valve:add"
          variant="primary"
          type="primary"
          :icon="CirclePlus"
          plain
          @click="openCreateDialog"
          >新增</PermissionButton
        >
        <PermissionButton
            permission="system:valve:remove"
          variant="danger"
          type="danger"
          plain
          @click="confirmDelete()"
          >删除</PermissionButton
        >
      </template>

      <el-table-column type="selection" />
      <el-table-column type="index" label="序号"  />
      <el-table-column prop="name" label="阀点" show-overflow-tooltip />
      <el-table-column prop="sortNo" label="排序" >
        <template #default="{ row }">
          {{ formatCellValue(row.sortNo) }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间">
        <template #default="{ row }">
          {{ row.createdAt ?? "-" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="system:valve:edit"
            link
            type="primary"
            @click="openEditDialog(row)"
            >编辑</PermissionButton
          >
          <PermissionButton
            permission="system:valve:remove"
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
        :rules="formRules"
        label-position="top"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="阀点" prop="name">
              <el-input
                v-model="form.name"
                placeholder="请输入阀点"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序">
              <el-input-number
                v-model="form.sortNo"
                class="valve-form-number"
                :min="0"
                :max="99999"
                placeholder="请输入排序"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="阀点目的" prop="gatePurpose">
          <el-input
            v-model="form.gatePurpose"
            type="textarea"
            :rows="3"
            maxlength="4000"
            show-word-limit
            placeholder="请输入阀点目的"
          />
        </el-form-item>
        <el-form-item label="核心工作内容" prop="coreWorkContent">
          <el-input
            v-model="form.coreWorkContent"
            type="textarea"
            :rows="4"
            maxlength="4000"
            show-word-limit
            placeholder="请输入核心工作内容"
          />
        </el-form-item>
        <el-form-item label="材料管理">
          <div :key="materialRenderKey" class="valve-material">
            <div class="valve-material__bar">
              <el-popover
                placement="bottom-start"
                width="420"
                trigger="click"
                popper-class="valve-material-popover"
              >
                <template #reference>
                  <button class="valve-material__trigger" type="button">
                    已选择 {{ form.materialKeys.length }} 项，点击调整
                  </button>
                </template>
                <div
                  v-loading="materialLoading"
                  class="valve-material-picker"
                  :class="{ 'has-active': activeMaterialGroup }"
                >
                  <div class="valve-material-picker__groups">
                    <div
                      v-for="group in valveMaterialGroups"
                      :key="group.key"
                      class="valve-material-picker__group"
                      :class="{
                        'is-active': activeMaterialGroupKey === group.key,
                      }"
                      @click="selectMaterialGroup(group)"
                    >
                      <el-checkbox
                        :model-value="isGroupChecked(group)"
                        :indeterminate="isGroupIndeterminate(group)"
                        @update:model-value="handleGroupChecked(group, $event)"
                        @click.stop
                      />
                      <span class="valve-material-picker__group-label">{{
                        group.label
                      }}</span>
                      <span class="valve-material-picker__arrow">&gt;</span>
                    </div>
                  </div>
                  <div
                    v-if="activeMaterialGroup"
                    class="valve-material-picker__items"
                  >
                    <el-checkbox-group v-model="form.materialKeys">
                      <el-checkbox
                        v-for="material in activeMaterialItems"
                        :key="material.key"
                        :label="material.key"
                      >
                        {{ material.label }}
                      </el-checkbox>
                    </el-checkbox-group>
                  </div>
                </div>
              </el-popover>
              <button
                class="valve-material__toggle"
                type="button"
                @click="materialListVisible = !materialListVisible"
              >
                {{ materialListVisible ? "收起清单" : "查看清单" }}
              </button>
            </div>
            <div
              v-if="materialListVisible && hasSelectedMaterials"
              class="valve-material__list"
            >
              <div
                v-for="group in valveMaterialGroups"
                v-show="selectedMaterials(group).length > 0"
                :key="group.key"
                class="valve-material__group"
              >
                <div class="valve-material__group-head">
                  <span>{{ group.label }}</span>
                  <span>{{ materialCount(group) }} 项</span>
                </div>
                <div class="valve-material__tags">
                  <el-tag
                    v-for="material in selectedMaterials(group)"
                    :key="material.key"
                    closable
                    effect="plain"
                    type="primary"
                    @close="removeMaterial(material.key)"
                  >
                    {{ material.label }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>
    </BaseFormDialog>

    <BaseConfirm
      v-model="confirmVisible"
      :title="deleteConfirmContent.title"
      :message="deleteConfirmContent.message"
      :type="deleteConfirmContent.type"
      :confirm-text="deleteConfirmContent.confirmText"
      :loading="deleteLoading"
      @confirm="deleteItems"
    />
  </PageContainer>
</template>
<style scoped>
.valve-form-number {
  width: 100%;
}

.valve-material {
  width: 100%;
}

.valve-material__bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.valve-material__trigger {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: 1px solid var(--el-border-color);
  background: #fff;
  border-radius: 4px;
  padding: 0 12px;
  text-align: left;
  color: var(--el-text-color-regular);
}

.valve-material__toggle {
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}

.valve-material__list {
  margin-top: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  padding: 12px 14px;
  background: #fff;
}

.valve-material__group + .valve-material__group {
  margin-top: 14px;
}

.valve-material__group-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  font-weight: 600;
}

.valve-material__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.valve-material-picker {
  display: grid;
  grid-template-columns: 190px;
  min-height: 180px;
}

.valve-material-picker.has-active {
  grid-template-columns: 170px 1fr;
}

.valve-material-picker__groups {
  padding-right: 12px;
}

.valve-material-picker.has-active .valve-material-picker__groups {
  border-right: 1px solid var(--el-border-color-lighter);
}

.valve-material-picker__group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  cursor: pointer;
}

.valve-material-picker__group-label {
  flex: 1;
  min-width: 0;
}

.valve-material-picker__group.is-active {
  color: var(--el-color-primary);
}

.valve-material-picker__arrow {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
}

.valve-material-picker__items {
  padding-left: 12px;
}

.valve-material-picker__items :deep(.el-checkbox) {
  display: flex;
  margin: 0 0 6px;
}

.valve-material-picker__groups :deep(.el-checkbox) {
  margin-right: 0;
}

.valve-material-picker__groups :deep(.el-checkbox__label) {
  padding-left: 4px;
}

.valve-material-picker__groups :deep(.el-checkbox__input),
.valve-material-picker__items :deep(.el-checkbox__input) {
  transform: scale(0.92);
  transform-origin: center;
}
</style>
