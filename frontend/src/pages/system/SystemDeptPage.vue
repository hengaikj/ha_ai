<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import { CirclePlus, Expand, Fold } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  createPlatformDept,
  deletePlatformDept,
  disablePlatformDept,
  enablePlatformDept,
  fetchPlatformDeptDetail,
  fetchPlatformDepts,
  updatePlatformDept,
} from "@/api/platform-system";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseTreeSelect from "@/components/base/BaseTreeSelect.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import { ApiBusinessError } from "@/api/http";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import type {
  PlatformId,
  PlatformDeptItem,
  PlatformStatus,
} from "@/types/platform-system";

interface DeptQueryState {
  deptName: string;
  status: PlatformStatus | "";
}

interface DeptFormState {
  id?: PlatformId;
  parentId: PlatformId | null;
  deptCode: string;
  deptName: string;
  sortNo: number | string | undefined;
  leaderUserId: string;
  phone: string;
  email: string;
  status: PlatformStatus;
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
  getData?: () => PlatformDeptItem[];
  getTableRef?: () => {
    toggleRowExpansion?: (row: unknown, expanded?: boolean) => void;
  } | null;
};

const emptyDeptForm = (): DeptFormState => ({
  parentId: null,
  deptCode: "",
  deptName: "",
  sortNo: undefined,
  leaderUserId: "",
  phone: "",
  email: "",
  status: "ENABLED",
});

const depts = ref<PlatformDeptItem[]>([]);
const saving = ref(false);
const drawerVisible = ref(false);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const query = reactive<DeptQueryState>({
  deptName: "",
  status: "",
});
const form = reactive<DeptFormState>(emptyDeptForm());
const formRef = ref<FormInstance>();
const queryTableRef = ref<QueryTableExpose | null>(null);
const allTreeExpanded = ref(true);
const editing = computed(() => Boolean(form.id));
const drawerTitle = computed(() => (editing.value ? "编辑部门" : "新增部门"));
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const parentDeptOptions = computed(() =>
  filterUnavailableParentDepts(depts.value, form.id),
);
const formRules: FormRules<DeptFormState> = {
  deptName: [
    {
      required: true,
      whitespace: true,
      message: "请输入部门名称",
      trigger: "blur",
    },
  ],
  sortNo: [
    {
      required: true,
      message: "请输入显示排序",
      trigger: "blur",
    },
  ],
  phone: [
    {
      validator: (_rule, value, callback) => {
        const phone = String(value ?? "").trim();
        if (phone && !/^\d{11}$/.test(phone)) {
          callback(new Error("联系电话必须为 11 位数字"));
          return;
        }
        callback();
      },
      trigger: ["blur", "change"],
    },
  ],
};

async function queryDepts() {
  error.value = null;
  try {
    depts.value = await fetchPlatformDepts(buildDeptQueryParams());
    return {
      total: depts.value.length,
      list: depts.value,
    };
  } catch (unknownError) {
    const normalizedError = normalizeError(unknownError);
    error.value = normalizedError;
    throw new Error(normalizedError.message, { cause: unknownError });
  }
}

async function reloadDepts() {
  await queryTableRef.value?.reload();
}

async function reloadDeptsAfterStatusMutation(nextStatus: PlatformStatus) {
  await reloadDepts();
  if (query.status && query.status !== nextStatus && !depts.value.length) {
    query.status = "";
    await reloadDepts();
  }
}

async function openCreateDrawer() {
  delete form.id;
  Object.assign(form, emptyDeptForm());
  drawerVisible.value = true;
  await resetDeptFormValidation();
}

async function openCreateChildDrawer(dept: PlatformDeptItem) {
  delete form.id;
  Object.assign(form, {
    ...emptyDeptForm(),
    parentId: dept.id,
  });
  drawerVisible.value = true;
  await resetDeptFormValidation();
}

async function openEditDrawer(dept: PlatformDeptItem) {
  error.value = null;
  const detail = await fetchPlatformDeptDetail(dept.id).catch(
    (unknownError) => {
      error.value = normalizeError(unknownError);
      return null;
    },
  );
  if (!detail) {
    return;
  }
  Object.assign(form, {
    id: detail.id,
    parentId: detail.parentId || null,
    deptCode: detail.deptCode,
    deptName: detail.deptName,
    sortNo: detail.sortNo,
    leaderUserId:
      detail.leaderUserId == null ? "" : String(detail.leaderUserId),
    phone: detail.phone ?? "",
    email: detail.email ?? "",
    status: detail.status,
  });
  drawerVisible.value = true;
  await resetDeptFormValidation();
}

async function resetDeptFormValidation() {
  await nextTick();
  formRef.value?.clearValidate();
}

function handlePhoneInput(value: string) {
  form.phone = normalizePhone(value);
}

async function saveDept() {
  await formRef.value?.validate();
  saving.value = true;
  error.value = null;
  try {
    if (editing.value && form.id) {
      await updatePlatformDept(form.id, {
        parentId: toId(form.parentId, 0),
        deptName: form.deptName,
        sortNo: toOptionalNumber(form.sortNo),
        leaderUserId: form.leaderUserId.trim() || undefined,
        phone: normalizePhone(form.phone) || undefined,
        email: form.email.trim() || undefined,
        status: form.status,
      });
    } else {
      await createPlatformDept({
        parentId: toId(form.parentId, 0),
        deptCode: form.deptCode,
        deptName: form.deptName,
        sortNo: toOptionalNumber(form.sortNo),
        leaderUserId: form.leaderUserId.trim() || undefined,
        phone: normalizePhone(form.phone) || undefined,
        email: form.email.trim() || undefined,
        status: form.status,
      });
    }
    drawerVisible.value = false;
    BaseToast.success(editing.value ? "操作成功" : "新增成功");
    await reloadDeptsAfterStatusMutation(form.status);
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    saving.value = false;
  }
}

async function deleteDept(dept: PlatformDeptItem) {
  try {
    await openConfirm({
      title: "删除部门",
      message: `确认删除部门「${dept.deptName}」？删除后部门列表不再展示该记录。`,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformDept(dept.id);
    BaseToast.success("部门已删除");
    await reloadDepts();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

async function toggleDeptStatus(dept: PlatformDeptItem) {
  error.value = null;
  try {
    const nextStatus: PlatformStatus =
      dept.status === "ENABLED" ? "DISABLED" : "ENABLED";
    if (dept.status === "ENABLED") {
      await disablePlatformDept(dept.id);
      BaseToast.success("部门已停用");
    } else {
      await enablePlatformDept(dept.id);
      BaseToast.success("部门已启用");
    }
    await reloadDeptsAfterStatusMutation(nextStatus);
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

async function searchDepts() {
  queryTableRef.value?.search();
}

function resetDeptQuery() {
  query.deptName = "";
  query.status = "";
}

function toggleAllTreeExpand() {
  const tableRef = queryTableRef.value?.getTableRef?.();
  const tableData = queryTableRef.value?.getData?.() ?? depts.value;
  if (!tableRef || tableData.length === 0) {
    return;
  }
  flattenDeptRows(tableData).forEach((row) => {
    tableRef.toggleRowExpansion?.(row, !allTreeExpanded.value);
  });
  allTreeExpanded.value = !allTreeExpanded.value;
}

function flattenDeptRows(items: PlatformDeptItem[]): PlatformDeptItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenDeptRows(item.children ?? []),
  ]);
}

function buildDeptQueryParams() {
  const deptName = query.deptName.trim() || undefined;
  return {
    keyword: deptName,
    deptName,
    status: query.status || undefined,
  };
}

function filterUnavailableParentDepts(
  items: PlatformDeptItem[],
  unavailableId?: PlatformId,
): PlatformDeptItem[] {
  return items.reduce<PlatformDeptItem[]>((result, item) => {
    if (item.id === unavailableId) {
      return result;
    }

    result.push({
      ...item,
      children: filterUnavailableParentDepts(
        item.children ?? [],
        unavailableId,
      ),
    });
    return result;
  }, []);
}

function toId(
  value: PlatformId | null | undefined,
  fallback: PlatformId,
): PlatformId {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return value;
}

function toOptionalNumber(
  value: number | string | undefined,
): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  return Number(value);
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function normalizeError(unknownError: unknown) {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }

  return {
    code: "FRONTEND-SYSTEM-003",
    message: "系统管理部门列表加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    title="部门管理"
    description="维护组织部门树、显示顺序和部门状态。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryDepts"
      row-key="id"
      default-expand-all
      fit-table-height
      :show-pagination="false"
      empty-title="暂无匹配部门"
      empty-description="当前筛选条件下没有可展示的部门数据。"
      @refresh="reloadDepts"
      @reset="resetDeptQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="部门名称">
            <el-input
              v-model="query.deptName"
              clearable
              maxlength="128"
              placeholder="请输入部门名称"
              data-test="dept-name-query"
              @keyup.enter="searchDepts"
            />
          </el-form-item>
          <el-form-item label="部门状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择部门状态"
              data-test="dept-status-query"
            >
              <el-option label="正常" value="ENABLED" />
              <el-option label="停用" value="DISABLED" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <template #toolbar>
        <PermissionButton
          permission="system:dept:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          data-test="create-dept-button"
          @click="openCreateDrawer"
        >
          新增
        </PermissionButton>
        <PermissionButton
          plain
          :icon="allTreeExpanded ? Fold : Expand"
          @click="toggleAllTreeExpand"
        >
          {{ allTreeExpanded ? "全部折叠" : "全部展示" }}
        </PermissionButton>
      </template>
      <el-table-column prop="deptName" label="部门名称" align="left" />
      <el-table-column prop="sortNo" label="排序" />
      <!--      <el-table-column label="负责人" min-width="140">-->
      <!--        <template #default="{ row }">-->
      <!--          {{ row.leaderUserId || "--" }}-->
      <!--        </template>-->
      <!--      </el-table-column>-->
      <!--      <el-table-column prop="phone" label="联系电话" min-width="140" />-->
      <!--      <el-table-column prop="email" label="邮箱" min-width="180" />-->
      <el-table-column label="部门状态">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 'ENABLED'"
            @change="toggleDeptStatus(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建时间">
        <template #default="{ row }">
          <BaseDateTime :value="row.createdAt || null" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="system:dept:add"
            link
            :icon="CirclePlus"
            :data-test="`create-child-dept-${row.id}`"
            @click="openCreateChildDrawer(row)"
          >
            新增
          </PermissionButton>
          <PermissionButton
            permission="system:dept:edit"
            link
            :data-test="`edit-dept-${row.id}`"
            @click="openEditDrawer(row)"
          >
            编辑
          </PermissionButton>
          <PermissionButton
          permission="system:dept:remove"
            link
            :data-test="`delete-dept-${row.id}`"
            @click="deleteDept(row)"
          >
            删除
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="drawerVisible"
      :title="drawerTitle"
      width="760px"
      :loading="saving"
      confirm-text="确定"
      compact
      :confirm-button-props="{ 'data-test': 'dept-save-button' }"
      @confirm="saveDept"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-position="top"
      >
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="上级部门" prop="parentId">
              <BaseTreeSelect
                v-model="form.parentId"
                :data="parentDeptOptions"
                placeholder="请选择上级部门"
                :props="{
                  label: 'deptName',
                  value: 'id',
                  children: 'children',
                }"
                data-test="dept-parent-input"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <!--            <el-form-item label="部门编码">-->
            <!--              <el-input-->
            <!--                v-model="form.deptCode"-->
            <!--                data-test="dept-code-input"-->
            <!--                :disabled="editing"-->
            <!--                maxlength="128"-->
            <!--              />-->
            <!--            </el-form-item>-->
            <el-form-item label="部门名称" prop="deptName">
              <el-input
                v-model="form.deptName"
                data-test="dept-name-input"
                maxlength="128"
              />
            </el-form-item>
            <el-form-item label="显示排序" prop="sortNo">
              <el-input
                v-model="form.sortNo"
                data-test="dept-sort-input"
                clearable
              />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input
                v-model="form.email"
                data-test="dept-email-input"
                maxlength="128"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="负责人">
              <el-input
                v-model="form.leaderUserId"
                clearable
                maxlength="64"
                placeholder="请输入负责人"
                data-test="dept-leader-input"
              />
            </el-form-item>
            <el-form-item label="联系电话" prop="phone">
              <el-input
                v-model="form.phone"
                data-test="dept-phone-input"
                maxlength="11"
                inputmode="numeric"
                placeholder="请输入 11 位手机号"
                @input="handlePhoneInput"
              />
            </el-form-item>
            <el-form-item label="部门状态">
              <el-radio-group v-model="form.status">
                <el-radio value="ENABLED">正常</el-radio>
                <el-radio value="DISABLED">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>
    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :loading="confirmState.loading"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>
