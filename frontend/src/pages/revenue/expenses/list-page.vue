<script setup lang="ts">
/**
 * 费用科目管理
 * 维护收益填报使用的科目树，支持新增、编辑、启停和删除。
 */
import { computed, nextTick, reactive, ref } from "vue";
import { CirclePlus } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  addExpenseSubject,
  deleteExpenseSubject,
  expenseSubjectTree,
  updateExpenseSubject,
  updateExpenseSubjectStatus,
} from "@/api/system/expenses";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { useAuthStore } from "@/stores/auth";

type VehicleSourceType = "OWN" | "COMPETITOR";

type SubjectRow = {
  id: number;
  subjectCode: string;
  subjectName: string;
  unit: string;
  vehicleSourceType: VehicleSourceType | "";
  parentId: number;
  level: number;
  sortOrder: number;
  leaf: boolean;
  enabled: boolean;
  remark: string;
  createdAt: string;
  children?: SubjectRow[];
};

type SubjectForm = {
  id?: number;
  parentId: number;
  subjectName: string;
  unit: string;
  vehicleSourceType: VehicleSourceType;
  sortOrder: number;
  remark: string;
};

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
  getData?: () => SubjectRow[];
  getTableRef?: () => {
    toggleRowExpansion?: (row: unknown, expanded?: boolean) => void;
  } | null;
};

const SUBJECT_ADD_PERMISSION = "system:periodExpenseSubject:add";
const SUBJECT_EDIT_PERMISSION = "system:periodExpenseSubject:edit";
const SUBJECT_STATUS_PERMISSION = "system:periodExpenseSubject:status";
const SUBJECT_REMOVE_PERMISSION = "system:periodExpenseSubject:remove";

const authStore = useAuthStore();
const queryTableRef = ref<QueryTableExpose | null>(null);
const formRef = ref<FormInstance>();
const query = reactive({
  subjectName: "",
  enabled: "" as "" | "true" | "false",
  createdAtRange: [] as string[],
});
const form = reactive<SubjectForm>(emptyForm());
const formVisible = ref(false);
const confirmVisible = ref(false);
const statusConfirmVisible = ref(false);
const pendingDeleteRow = ref<SubjectRow | null>(null);
const pendingStatusRow = ref<SubjectRow | null>(null);
const treeSelectOptions = ref<SubjectRow[]>([]);
const allTreeExpanded = ref(false);

const editing = computed(() => Boolean(form.id));
const formTitle = computed(() => (editing.value ? "编辑费用科目" : "新增费用科目"));
const currentUserId = computed(() => String(authStore.currentUser?.id || "").trim());
const currentUserName = computed(() =>
  String(
    authStore.currentUser?.displayName ||
      authStore.currentUser?.username ||
      "",
  ).trim(),
);
const formRules: FormRules<SubjectForm> = {
  subjectName: [
    { required: true, message: "请输入科目名称", trigger: "blur" },
    { whitespace: true, message: "科目名称不能为空", trigger: "blur" },
  ],
  vehicleSourceType: [
    { required: true, message: "请选择车型来源", trigger: "change" },
  ],
};
const deleteConfirmContent = computed(() => {
  const row = pendingDeleteRow.value;
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "delete",
    object: "费用科目",
    name: row.subjectName,
  });
});
const statusConfirmContent = computed(() => {
  const row = pendingStatusRow.value;
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: row.enabled ? "disable" : "enable",
    object: "费用科目",
    name: row.subjectName,
  });
});

function emptyForm(): SubjectForm {
  return {
    parentId: 0,
    subjectName: "",
    unit: "",
    vehicleSourceType: "OWN",
    sortOrder: 0,
    remark: "",
  };
}

function safeText(value: unknown): string {
  return String(value == null ? "" : value).trim();
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function unwrapSubjectTree(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const source = payload as Record<string, unknown>;
    if (Array.isArray(source.data)) {
      return source.data;
    }
    if (Array.isArray(source.rows)) {
      return source.rows;
    }
  }
  return [];
}

function normalizeVehicleSourceType(value: unknown): VehicleSourceType | "" {
  const text = safeText(value).toUpperCase();
  if (text === "OWN" || text === "COMPETITOR") {
    return text;
  }
  return "";
}

function formatDateTime(value: unknown): string {
  const text = safeText(value);
  if (!text) {
    return "";
  }
  return text.replace("T", " ").slice(0, 19);
}

function mapSubjectNode(node: unknown): SubjectRow {
  const source =
    node && typeof node === "object" ? (node as Record<string, unknown>) : {};
  const children = Array.isArray(source.children)
    ? source.children.map((item) => mapSubjectNode(item))
    : [];
  return {
    id: toNumber(source.id),
    subjectCode: safeText(source.subjectCode || source.subject_code),
    subjectName: safeText(source.subjectName || source.subject_name),
    unit: safeText(source.unit),
    vehicleSourceType: normalizeVehicleSourceType(source.vehicleSourceType),
    parentId: toNumber(source.parentId ?? source.parent_id),
    level: toNumber(source.level, 1),
    sortOrder: toNumber(source.sortOrder ?? source.sort_order),
    leaf: Boolean(source.leaf ?? children.length === 0),
    enabled: source.enabled !== false,
    remark: safeText(source.remark),
    createdAt: formatDateTime(source.createdAt || source.created_at),
    children,
  };
}

async function loadSubjectTree(params: Record<string, unknown> = {}) {
  const payload = await expenseSubjectTree(params);
  return unwrapSubjectTree(payload).map((item) => mapSubjectNode(item));
}

async function queryItems() {
  const [createdAtStart, createdAtEnd] = query.createdAtRange;
  const treeData = await loadSubjectTree({
    subjectName: query.subjectName.trim() || undefined,
    enabled:
      query.enabled === ""
        ? undefined
        : query.enabled === "true",
    createdAtStart: createdAtStart || undefined,
    createdAtEnd: createdAtEnd || undefined,
  });
  return {
    total: treeData.length,
    list: treeData,
    pageNo: 1,
    pageSize: 9999,
  };
}

async function loadTreeSelectOptions() {
  treeSelectOptions.value = await loadSubjectTree({ enabled: true });
}

const treeSelectModelValue = computed({
  get() {
    if (!form.parentId) {
      return undefined;
    }
    return form.parentId;
  },
  set(val: unknown) {
    if (val === undefined || val === null || val === "") {
      form.parentId = 0;
    } else {
      form.parentId = Number(val);
    }
  },
});

function resetQuery() {
  query.subjectName = "";
  query.enabled = "";
  query.createdAtRange = [];
}

function searchItems() {
  queryTableRef.value?.search();
}

async function openCreateDialog(parentRow?: SubjectRow) {
  if (parentRow && !parentRow.enabled) {
    BaseToast.warning("父级科目已作废，不能在其下新增子科目");
    return;
  }
  await loadTreeSelectOptions();
  delete form.id;
  Object.assign(form, emptyForm());
  if (parentRow) {
    form.parentId = parentRow.id;
    form.vehicleSourceType =
      parentRow.vehicleSourceType === "COMPETITOR" ? "COMPETITOR" : "OWN";
  }
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

function openEditDialog(row: SubjectRow) {
  Object.assign(form, {
    id: row.id,
    parentId: row.parentId,
    subjectName: row.subjectName,
    unit: row.unit,
    vehicleSourceType:
      row.vehicleSourceType === "COMPETITOR" ? "COMPETITOR" : "OWN",
    sortOrder: row.sortOrder,
    remark: row.remark,
  });
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

function resolveParentName(parentId: number): string {
  if (!parentId) {
    return "顶级科目";
  }
  const matched = flattenSubjectRows([
    ...treeSelectOptions.value,
    ...(queryTableRef.value?.getData?.() ?? []),
  ]).find((item) => item.id === parentId);
  return matched?.subjectName || `科目 #${parentId}`;
}

async function saveItem() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const payload = {
    subjectName: form.subjectName.trim(),
    unit: form.unit.trim() || undefined,
    vehicleSourceType: form.vehicleSourceType,
    sortOrder: form.sortOrder,
    remark: form.remark.trim() || undefined,
  };

  if (form.id) {
    await updateExpenseSubject(form.id, payload);
    BaseToast.success("费用科目已更新");
  } else {
    if (!currentUserId.value || !currentUserName.value) {
      BaseToast.warning("未获取到当前用户信息，无法新增科目");
      return;
    }
    await addExpenseSubject({
      ...payload,
      parentId: form.parentId || undefined,
      creatorId: currentUserId.value,
      creatorName: currentUserName.value,
    });
    BaseToast.success("费用科目已新增");
  }
  formVisible.value = false;
  await queryTableRef.value?.reload();
}

function confirmDelete(row: SubjectRow) {
  if (row.children?.length) {
    BaseToast.warning("存在下级科目，不能删除");
    return;
  }
  pendingDeleteRow.value = row;
  confirmVisible.value = true;
}

async function deleteItem() {
  const row = pendingDeleteRow.value;
  if (!row) {
    return;
  }
  await deleteExpenseSubject(row.id);
  confirmVisible.value = false;
  BaseToast.success(deleteConfirmContent.value.successMessage);
  await queryTableRef.value?.reload();
}

function confirmToggleStatus(row: SubjectRow) {
  pendingStatusRow.value = row;
  statusConfirmVisible.value = true;
}

async function toggleStatus() {
  const row = pendingStatusRow.value;
  if (!row) {
    return;
  }
  await updateExpenseSubjectStatus(row.id, !row.enabled);
  statusConfirmVisible.value = false;
  BaseToast.success(statusConfirmContent.value.successMessage);
  await queryTableRef.value?.reload();
}

function toggleAllTreeExpand() {
  const tableRef = queryTableRef.value?.getTableRef?.();
  const tableData = queryTableRef.value?.getData?.() ?? [];
  if (!tableRef || tableData.length === 0) {
    return;
  }
  flattenSubjectRows(tableData).forEach((row) => {
    tableRef.toggleRowExpansion?.(row, !allTreeExpanded.value);
  });
  allTreeExpanded.value = !allTreeExpanded.value;
}

function flattenSubjectRows(items: SubjectRow[]): SubjectRow[] {
  return items.flatMap((item) => [
    item,
    ...flattenSubjectRows(item.children ?? []),
  ]);
}
</script>

<template>
  <PageContainer
    title="费用科目管理"
    description="维护收益填报使用的科目树、车型来源和启停状态。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryItems as any"
      row-key="id"
      :default-expand-all="allTreeExpanded"
      :show-pagination="false"
      :enable-column-settings="false"
      fit-table-height
      empty-title="暂无费用科目"
      empty-description="当前条件下没有可展示的费用科目。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="科目名称">
            <el-input
              v-model="query.subjectName"
              clearable
              placeholder="请输入科目名称"
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
          <el-form-item label="状态">
            <el-select
              v-model="query.enabled"
              clearable
              placeholder="科目状态"
            >
              <el-option label="启用" value="true" />
              <el-option label="作废" value="false" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          :permission="SUBJECT_ADD_PERMISSION"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="openCreateDialog()"
          >新增</PermissionButton
        >
        <PermissionButton plain @click="toggleAllTreeExpand">
          展开/折叠
        </PermissionButton>
      </template>

      <!-- 对齐 Vue2：科目编号、科目名称、状态、创建时间、操作 -->
      <el-table-column
        prop="subjectCode"
        label="科目编号"
        min-width="180"
        header-align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="subjectName"
        label="科目名称"
        min-width="260"
        align="left"
        header-align="center"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span class="expense-subject-table__name">
            <span
              v-if="!row.children?.length"
              class="expense-subject-table__expand-placeholder"
              aria-hidden="true"
            />
            <span class="expense-subject-table__name-text">{{
              row.subjectName
            }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120" align="center" header-align="center">
        <template #default="{ row }">
          <BaseStatusTag
            :status="row.enabled ? 'ENABLED' : 'DISABLED'"
            :label="row.enabled ? '启用' : '作废'"
          />
        </template>
      </el-table-column>
      <el-table-column
        label="创建时间"
        min-width="180"
        align="center"
        header-align="center"
      >
        <template #default="{ row }">
          {{ row.createdAt || "-" }}
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        width="220"
        fixed="right"
        align="left"
        header-align="center"
      >
        <template #default="{ row }">
          <div class="bq-table-actions expense-subject-actions" @click.stop>
            <PermissionButton
              v-if="row.enabled"
              :permission="SUBJECT_ADD_PERMISSION"
              link
              type="primary"
              @click="openCreateDialog(row)"
              >新增</PermissionButton
            >
            <PermissionButton
              :permission="SUBJECT_EDIT_PERMISSION"
              link
              type="primary"
              @click="openEditDialog(row)"
              >编辑</PermissionButton
            >
            <PermissionButton
              :permission="SUBJECT_STATUS_PERMISSION"
              link
              :type="row.enabled ? 'danger' : 'primary'"
              @click="confirmToggleStatus(row)"
            >
              {{ row.enabled ? "作废" : "启用" }}
            </PermissionButton>
            <PermissionButton
              v-if="!row.children?.length"
              :permission="SUBJECT_REMOVE_PERMISSION"
              link
              @click="confirmDelete(row)"
              >删除</PermissionButton
            >
          </div>
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
            <el-form-item label="上级科目">
              <el-tree-select
                v-if="!editing"
                v-model="treeSelectModelValue"
                :data="treeSelectOptions"
                :props="{ label: 'subjectName', children: 'children' }"
                placeholder="不选则为顶级科目"
                node-key="id"
                check-strictly
                style="width: 100%"
                clearable
              />
              <el-input
                v-else
                :model-value="resolveParentName(form.parentId)"
                disabled
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="科目名称" prop="subjectName">
              <el-input
                v-model="form.subjectName"
                placeholder="请输入科目名称"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位">
              <el-input v-model="form.unit" placeholder="请输入单位" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="车型来源" prop="vehicleSourceType">
              <el-select
                v-model="form.vehicleSourceType"
                placeholder="请选择车型来源"
                style="width: 100%"
              >
                <el-option label="本品" value="OWN" />
                <el-option label="竞品" value="COMPETITOR" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序">
              <el-input-number
                v-model="form.sortOrder"
                :min="0"
                :precision="0"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                maxlength="4000"
                show-word-limit
                placeholder="请输入备注"
              />
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
      @confirm="deleteItem"
    />

    <BaseConfirm
      v-model="statusConfirmVisible"
      :title="statusConfirmContent.title"
      :message="statusConfirmContent.message"
      :type="statusConfirmContent.type"
      :confirm-text="statusConfirmContent.confirmText"
      @confirm="toggleStatus"
    />
  </PageContainer>
</template>

<style scoped>
.expense-subject-actions {
  justify-content: flex-start;
  width: auto;
}

.expense-subject-table__name {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.expense-subject-table__expand-placeholder {
  flex: 0 0 20px;
  width: 20px;
  height: 1px;
}

.expense-subject-table__name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
