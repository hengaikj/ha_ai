<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back, CirclePlus } from "@element-plus/icons-vue";
import {
  cancelRoleUser,
  cancelRoleUsers,
  fetchAllocatedRoleUsers,
  fetchUnallocatedRoleUsers,
  selectRoleUsers,
} from "@/api/system/role";
import { ApiBusinessError } from "@/api/http";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import type { SysUser } from "@/types/system";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

interface UserQueryState {
  userName: string;
  phonenumber: string;
}

const route = useRoute();
const router = useRouter();
const queryTableRef = ref<QueryTableExpose | null>(null);
const selectQueryTableRef = ref<QueryTableExpose | null>(null);
const selectedUsers = ref<SysUser[]>([]);
const selectedCandidateUsers = ref<SysUser[]>([]);
const selectDialogVisible = ref(false);
const assigning = ref(false);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const selectError = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const query = reactive<UserQueryState>({
  userName: "",
  phonenumber: "",
});
const selectQuery = reactive<UserQueryState>({
  userName: "",
  phonenumber: "",
});

const roleId = computed(() => String(route.params.roleId || ""));
const roleName = computed(() =>
  typeof route.query.roleName === "string" ? route.query.roleName : "",
);
const pageDescription = computed(() =>
  roleName.value ? `角色：${roleName.value}` : "管理角色已授权用户。",
);

async function queryAssignedUsers(pageSize: number, pageNo: number) {
  if (!roleId.value) {
    return { total: 0, list: [] };
  }
  error.value = null;
  try {
    const response = await fetchAllocatedRoleUsers({
      roleId: roleId.value,
      userName: query.userName.trim() || undefined,
      phonenumber: query.phonenumber.trim() || undefined,
      pageNum: pageNo,
      pageSize,
    });
    return {
      total: response.total,
      list: response.records,
      pageNo: response.pageNum ?? pageNo,
      pageSize: response.pageSize ?? pageSize,
    };
  } catch (unknownError) {
    const normalizedError = normalizeError(unknownError);
    error.value = normalizedError;
    throw new Error(normalizedError.message, { cause: unknownError });
  }
}

async function queryUnassignedUsers(pageSize: number, pageNo: number) {
  if (!roleId.value) {
    return { total: 0, list: [] };
  }
  selectError.value = null;
  try {
    const response = await fetchUnallocatedRoleUsers({
      roleId: roleId.value,
      userName: selectQuery.userName.trim() || undefined,
      phonenumber: selectQuery.phonenumber.trim() || undefined,
      pageNum: pageNo,
      pageSize,
    });
    return {
      total: response.total,
      list: response.records,
      pageNo: response.pageNum ?? pageNo,
      pageSize: response.pageSize ?? pageSize,
    };
  } catch (unknownError) {
    const normalizedError = normalizeError(unknownError);
    selectError.value = normalizedError;
    throw new Error(normalizedError.message, { cause: unknownError });
  }
}

function handleAssignedSelectionChange(selection: SysUser[]) {
  selectedUsers.value = selection;
}

function handleCandidateSelectionChange(selection: SysUser[]) {
  selectedCandidateUsers.value = selection;
}

function searchAssignedUsers() {
  queryTableRef.value?.search();
}

function resetAssignedQuery() {
  query.userName = "";
  query.phonenumber = "";
}

function searchCandidateUsers() {
  selectQueryTableRef.value?.search();
}

function resetCandidateQuery() {
  selectQuery.userName = "";
  selectQuery.phonenumber = "";
}

function openSelectUserDialog() {
  selectedCandidateUsers.value = [];
  selectDialogVisible.value = true;
}

async function submitSelectUsers() {
  const userIds = selectedCandidateUsers.value
    .map((user) => user.userId)
    .filter((id): id is number => id !== undefined);
  if (userIds.length === 0) {
    BaseToast.warning("请选择要分配的用户");
    return;
  }
  assigning.value = true;
  selectError.value = null;
  try {
    await selectRoleUsers({ roleId: roleId.value, userIds });
    BaseToast.success("用户已分配");
    selectDialogVisible.value = false;
    await queryTableRef.value?.reload();
  } catch (unknownError) {
    selectError.value = normalizeError(unknownError);
  } finally {
    assigning.value = false;
  }
}

async function cancelUserAuthorization(user: SysUser) {
  if (!user.userId) return;
  try {
    await openConfirm({
      title: "取消授权",
      message: `确认取消用户「${user.userName || user.nickName || user.userId}」的角色授权？`,
      type: "danger",
      confirmText: "取消授权",
      cancelText: "返回",
    });
    await cancelRoleUser({ roleId: roleId.value, userId: user.userId });
    BaseToast.success("取消授权成功");
    await queryTableRef.value?.reload();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") return;
    error.value = normalizeError(unknownError);
  }
}

async function cancelSelectedUserAuthorization() {
  const userIds = selectedUsers.value
    .map((user) => user.userId)
    .filter((id): id is number => id !== undefined);
  if (userIds.length === 0) {
    BaseToast.warning("请先选择用户");
    return;
  }
  try {
    await openConfirm({
      title: "批量取消授权",
      message: `确认取消选中的 ${userIds.length} 个用户角色授权？取消后这些用户将不再拥有该角色。`,
      type: "danger",
      confirmText: "取消授权",
      cancelText: "返回",
    });
    await cancelRoleUsers({ roleId: roleId.value, userIds });
    selectedUsers.value = [];
    BaseToast.success("取消授权成功");
    await queryTableRef.value?.reload();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") return;
    error.value = normalizeError(unknownError);
  }
}

function goBack() {
  router.push("/system/role");
}

function renderStatus(status?: string) {
  return status === "1" ? "停用" : "启用";
}

function statusTagType(status?: string) {
  return status === "1" ? "info" : "success";
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
    code: "FRONTEND-SYSTEM-ROLE-AUTH-USER",
    message: "角色分配用户数据加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    class="system-role-auth-user-page"
    title="分配用户"
    :description="pageDescription"
  >
    <template #actions>
      <PermissionButton class="bq-page-return-button" :icon="Back" plain @click="goBack">
        返回
      </PermissionButton>
    </template>

    <TraceErrorAlert
      v-if="error"
      :code="error.code"
      :message="error.message"
      :trace-id="error.traceId"
    />
    <QueryTable
      ref="queryTableRef"
      :func="queryAssignedUsers"
      row-key="userId"
      fit-table-height
      empty-title="暂无已授权用户"
      empty-description="当前角色下没有已授权用户。"
      @reset="resetAssignedQuery"
      @selection-change="handleAssignedSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="用户名称">
            <el-input
              v-model="query.userName"
              clearable
              placeholder="请输入用户名称"
              @keyup.enter="searchAssignedUsers"
            />
          </el-form-item>
          <el-form-item label="手机号码">
            <el-input
              v-model="query.phonenumber"
              clearable
              placeholder="请输入手机号码"
              @keyup.enter="searchAssignedUsers"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #toolbar>
        <PermissionButton
          permission="system:role:assign-user"
          type="primary"
          :icon="CirclePlus"
          @click="openSelectUserDialog"
        >
          添加用户
        </PermissionButton>
        <PermissionButton
          permission="system:role:cancel-user"
          variant="danger"
          type="danger"
          plain
          :disabled="selectedUsers.length === 0"
          @click="cancelSelectedUserAuthorization"
        >
          批量取消授权
        </PermissionButton>
      </template>
      <el-table-column type="selection" width="55" />
      <el-table-column prop="userName" label="用户名称" min-width="140" />
      <el-table-column prop="nickName" label="用户昵称" min-width="140" />
      <el-table-column prop="email" label="邮箱" min-width="180">
        <template #default="{ row }">{{ row.email || "--" }}</template>
      </el-table-column>
      <el-table-column prop="phonenumber" label="手机" min-width="140">
        <template #default="{ row }">{{ row.phonenumber || "--" }}</template>
      </el-table-column>
      <el-table-column label="用户状态" width="100" align="center">
        <template #default="{ row }">
          <BaseStatusTag
              :label="renderStatus(row.status)"
              :type="statusTagType(row.status)"
            />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="180">
        <template #default="{ row }">
          <BaseDateTime :value="row.createTime || null" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right" align="center">
        <template #default="{ row }">
            <PermissionButton
              permission="system:role:cancel-user"
              link
              @click="cancelUserAuthorization(row)"
            >
              取消授权
            </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="selectDialogVisible"
      title="选择用户"
      width="860px"
      :loading="assigning"
      compact
      confirm-text="确定"
      @confirm="submitSelectUsers"
    >
      <TraceErrorAlert
        v-if="selectError"
        :code="selectError.code"
        :message="selectError.message"
        :trace-id="selectError.traceId"
      />
      <QueryTable
        ref="selectQueryTableRef"
        class="system-role-auth-user-page__select-table"
        :func="queryUnassignedUsers"
        row-key="userId"
        :fixed-pagination="false"
        :fit-table-height="false"
        empty-title="暂无可分配用户"
        empty-description="当前筛选条件下没有可分配给该角色的用户。"
        @reset="resetCandidateQuery"
        @selection-change="handleCandidateSelectionChange"
      >
        <template #search>
          <el-form :model="selectQuery">
            <el-form-item label="用户名称">
              <el-input
                v-model="selectQuery.userName"
                clearable
                placeholder="请输入用户名称"
                @keyup.enter="searchCandidateUsers"
              />
            </el-form-item>
            <el-form-item label="手机号码">
              <el-input
                v-model="selectQuery.phonenumber"
                clearable
                placeholder="请输入手机号码"
                @keyup.enter="searchCandidateUsers"
              />
            </el-form-item>
          </el-form>
        </template>
        <el-table-column type="selection" width="55" />
        <el-table-column prop="userName" label="用户名称" min-width="140" />
        <el-table-column prop="nickName" label="用户昵称" min-width="140" />
        <el-table-column prop="email" label="邮箱" min-width="180">
          <template #default="{ row }">{{ row.email || "--" }}</template>
        </el-table-column>
        <el-table-column prop="phonenumber" label="手机" min-width="140">
          <template #default="{ row }">{{ row.phonenumber || "--" }}</template>
        </el-table-column>
        <el-table-column label="用户状态" width="100" align="center">
          <template #default="{ row }">
            <BaseStatusTag
              :label="renderStatus(row.status)"
              :type="statusTagType(row.status)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="180">
          <template #default="{ row }">
            <BaseDateTime :value="row.createTime || null" />
          </template>
        </el-table-column>
      </QueryTable>
    </BaseFormDialog>

    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.system-role-auth-user-page {
  min-width: 0;
}

.system-role-auth-user-page__select-table {
  min-height: 430px;
}
</style>
