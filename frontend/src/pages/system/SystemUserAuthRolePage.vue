<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back, Search } from "@element-plus/icons-vue";
import type { TableInstance } from "element-plus";
import { fetchUserAuthRoles } from "@/api/system/user";
import { fetchM02Roles, replaceM02UserRoles, normalizeM02Error } from "@/api/system/m02-auth";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import type { SystemId, SysRole, SysUser } from "@/types/system";

type RoleWithFlag = SysRole & {
  flag?: boolean;
};

type UserAuthRoleResponse = {
  user?: SysUser;
  roles?: RoleWithFlag[];
};

const route = useRoute();
const router = useRouter();
const tableRef = ref<TableInstance>();
const loading = ref(false);
const saving = ref(false);
const user = ref<SysUser>({});
const roles = ref<RoleWithFlag[]>([]);
const selectedRoleIds = ref<SystemId[]>([]);
const roleNameKeyword = ref("");
const pageNo = ref(1);
const pageSize = ref(10);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);

const userId = computed(() => String(route.params.userId || ""));
const pagedRoles = computed(() => {
  const start = (pageNo.value - 1) * pageSize.value;
  return filteredRoles.value.slice(start, start + pageSize.value);
});
const filteredRoles = computed(() => {
  const keyword = roleNameKeyword.value.trim().toLocaleLowerCase();
  if (!keyword) {
    return roles.value;
  }
  return roles.value.filter((role) =>
    (role.roleName || "").toLocaleLowerCase().includes(keyword),
  );
});

void loadUserAuthRoles();

async function loadUserAuthRoles() {
  if (!userId.value) {
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const [response, m02Roles] = await Promise.all([
      fetchUserAuthRoles(userId.value),
      fetchM02Roles(),
    ]);
    const legacy = response as UserAuthRoleResponse;
    user.value = legacy.user ?? {};
    const selected = new Set((legacy.roles ?? []).filter((item) => item.flag).map((item) => String(item.roleId)));
    roles.value = m02Roles.map((item) => ({
      roleId: Number(item.id) || undefined, roleName: item.name, roleKey: item.code,
      status: item.status === "DISABLED" ? "1" : "0", flag: selected.has(String(item.id)),
    }));
    selectedRoleIds.value = roles.value
      .filter((role) => role.flag)
      .map((role) => role.roleId)
      .filter((id): id is number => id !== undefined);
    await nextTick();
    syncSelectedRows();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    loading.value = false;
  }
}

function syncSelectedRows() {
  const selected = new Set(selectedRoleIds.value.map(String));
  tableRef.value?.clearSelection();
  pagedRoles.value.forEach((role) => {
    if (role.roleId !== undefined && selected.has(String(role.roleId))) {
      tableRef.value?.toggleRowSelection(role, true);
    }
  });
}

function handleSelectionChange(selection: RoleWithFlag[]) {
  const currentPageIds = new Set(
    pagedRoles.value
      .map((role) => role.roleId)
      .filter((id): id is number => id !== undefined)
      .map(String),
  );
  const selectedOnPage = new Set(
    selection
      .map((role) => role.roleId)
      .filter((id): id is number => id !== undefined)
      .map(String),
  );
  const next = selectedRoleIds.value.filter(
    (id) => !currentPageIds.has(String(id)),
  );
  selection.forEach((role) => {
    if (role.roleId !== undefined && selectedOnPage.has(String(role.roleId))) {
      next.push(role.roleId);
    }
  });
  selectedRoleIds.value = Array.from(new Set(next.map(String))).map((id) =>
    Number.isFinite(Number(id)) ? Number(id) : id,
  );
}

function handleRowClick(row: RoleWithFlag) {
  if (isRoleSelectable(row)) {
    tableRef.value?.toggleRowSelection(row);
  }
}

function isRoleSelectable(role: RoleWithFlag) {
  return role.status !== "1";
}

async function submitAuthRoles() {
  if (!user.value.userId) {
    BaseToast.warning("用户信息不完整，无法保存角色授权");
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    const selectedRoleCodes = roles.value
      .filter((role) => role.roleId !== undefined && selectedRoleIds.value.some((id) => String(id) === String(role.roleId)))
      .map((role) => role.roleKey)
      .filter((code): code is string => Boolean(code));
    await replaceM02UserRoles(user.value.userId, selectedRoleCodes);
    BaseToast.success("授权成功");
    goBack();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    saving.value = false;
  }
}

function handlePageChange(nextPageNo: number) {
  pageNo.value = nextPageNo;
  nextTick(syncSelectedRows);
}

function searchRoles() {
  pageNo.value = 1;
  nextTick(syncSelectedRows);
}

function handleSizeChange(nextPageSize: number) {
  pageSize.value = nextPageSize;
  pageNo.value = 1;
  nextTick(syncSelectedRows);
}

function goBack() {
  router.push("/system/user");
}

function renderStatus(status?: string) {
  return status === "1" ? "停用" : "启用";
}

function statusTagType(status?: string) {
  return status === "1" ? "info" : "success";
}

function normalizeError(unknownError: unknown) {
  return normalizeM02Error(unknownError);
}
</script>

<template>
  <PageContainer
    class="system-user-auth-role-page"
    title="分配角色"
    description="为用户配置可用角色。"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        @click="goBack"
      >
        返回
      </PermissionButton>
      <PermissionButton
        permission="system:user:role:oper"
        type="primary"
        :loading="saving"
        @click="submitAuthRoles"
      >
        提交
      </PermissionButton>
    </template>

    <TraceErrorAlert
      v-if="error"
      :code="error.code"
      :message="error.message"
      :trace-id="error.traceId"
    />

    <div class="system-user-auth-role-page__layout">
      <div class="system-user-auth-role-page__content">
        <section class="system-user-auth-role-page__section">
          <h3>基本信息</h3>
          <el-form :model="user" label-position="top">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="用户昵称">
                  <el-input
                    :model-value="user.nickName || '--'"
                    disabled
                    clearable
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="登录账号">
                  <el-input
                    :model-value="user.userName || '--'"
                    disabled
                    clearable
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </section>

        <section class="system-user-auth-role-page__section is-table">
          <h3>角色信息</h3>
          <el-form
            class="system-user-auth-role-page__search"
            :inline="true"
            @submit.prevent="searchRoles"
          >
            <el-form-item label="角色名称">
              <el-input
                v-model="roleNameKeyword"
                clearable
                maxlength="128"
                placeholder="请输入角色名称"
                data-test="role-name-search"
                @keyup.enter="searchRoles"
                @clear="searchRoles"
              >
                <template #append>
                  <el-button :icon="Search" @click="searchRoles" />
                </template>
              </el-input>
            </el-form-item>
          </el-form>
          <div class="system-user-auth-role-page__table-wrap">
            <el-table
              ref="tableRef"
              v-loading="loading"
              :data="pagedRoles"
              row-key="roleId"
              border
              height="100%"
              @row-click="handleRowClick"
              @selection-change="handleSelectionChange"
            >
              <el-table-column
                label="序号"
                type="index"
                width="80"
                align="center"
              >
                <template #default="{ $index }">
                  {{ (pageNo - 1) * pageSize + $index + 1 }}
                </template>
              </el-table-column>
              <el-table-column
                type="selection"
                width="55"
                reserve-selection
                :selectable="isRoleSelectable"
              />
              <el-table-column
                prop="roleId"
                label="角色编号"
                min-width="120"
                align="center"
              />
              <el-table-column
                prop="roleName"
                label="角色名称"
                min-width="160"
                align="center"
              />
              <el-table-column
                prop="roleKey"
                label="权限字符"
                min-width="180"
                align="center"
              />
              <el-table-column label="角色状态" width="100" align="center">
                <template #default="{ row }">
                  <BaseStatusTag
                    :label="renderStatus(row.status)"
                    :type="statusTagType(row.status)"
                  />
                </template>
              </el-table-column>
              <el-table-column label="创建时间" width="180" align="center">
                <template #default="{ row }">
                  <BaseDateTime :value="row.createTime || null" />
                </template>
              </el-table-column>
            </el-table>
          </div>
          <QueryTable
            v-if="roles.length > 0"
            pagination-only
            :fixed-pagination="false"
            :pagination="{ pageNo, pageSize, total: filteredRoles.length }"
            @page-change="handlePageChange"
            @size-change="handleSizeChange"
          />
        </section>
      </div>
    </div>
  </PageContainer>
</template>

<style scoped>
.system-user-auth-role-page {
  min-width: 0;
}

.system-user-auth-role-page__layout {
  min-height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) - 116px
  );
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.system-user-auth-role-page__content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.system-user-auth-role-page__section {
  border: 1px solid var(--bq-color-border);
  background: var(--bq-color-surface);
  padding: 16px;
}

.system-user-auth-role-page__section h3 {
  margin: 0 0 14px;
  color: var(--bq-color-text);
  font-size: 16px;
  font-weight: 600;
}

.system-user-auth-role-page__search {
  margin-bottom: 8px;
}

.system-user-auth-role-page__search :deep(.el-form-item) {
  margin-bottom: 8px;
}

.system-user-auth-role-page__search :deep(.el-input) {
  width: min(320px, 100%);
}

.system-user-auth-role-page__section.is-table {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.system-user-auth-role-page__table-wrap {
  flex: 1 1 auto;
  min-height: 260px;
}
</style>
