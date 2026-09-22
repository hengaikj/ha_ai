<script setup lang="ts">
import { reactive, ref } from "vue";
import { SwitchButton } from "@element-plus/icons-vue";
import { forceLogoutOnlineUser, fetchOnlineUsers } from "@/api/monitor";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import type { OnlineUser } from "@/types/monitor";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

const query = reactive({ ipaddr: "", userName: "" });
const queryTableRef = ref<QueryTableExpose | null>(null);
const logoutTarget = ref<OnlineUser | null>(null);
const actionLoading = ref(false);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

async function queryOnlineUsers(pageSize: number, pageNo: number) {
  const response = await fetchOnlineUsers({
    ipaddr: query.ipaddr.trim() || undefined,
    userName: query.userName.trim() || undefined,
  });
  const start = (pageNo - 1) * pageSize;
  return {
    total: response.records.length,
    list: response.records.slice(start, start + pageSize),
    pageNo,
    pageSize,
  };
}

function resetQuery() {
  query.ipaddr = "";
  query.userName = "";
}

async function confirmForceLogout(user: OnlineUser) {
  logoutTarget.value = user;
  try {
    await openConfirm({
      title: "强退确认",
      message: `确认强退用户“${user.userName}”吗？强退后该用户需要重新登录。`,
      type: "danger",
      confirmText: "强退",
      cancelText: "取消",
    });
    actionLoading.value = true;
    await forceLogoutOnlineUser(user.tokenId);
    BaseToast.success("用户已强退");
    await queryTableRef.value?.reload();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
  } finally {
    logoutTarget.value = null;
    actionLoading.value = false;
  }
}
</script>

<template>
  <PageContainer
    class="online-user-page"
    title="在线用户"
    description="查看当前登录会话并处理异常在线用户"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryOnlineUsers"
      row-key="tokenId"
      fit-table-height
      empty-title="暂无在线用户"
      empty-description="当前筛选条件下没有可展示的在线会话。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="登录地址">
            <el-input
              v-model="query.ipaddr"
              clearable
              maxlength="64"
              placeholder="请输入登录地址"
              @keyup.enter="queryTableRef?.search()"
            />
          </el-form-item>
          <el-form-item label="用户名称">
            <el-input
              v-model="query.userName"
              clearable
              maxlength="64"
              placeholder="请输入用户名称"
              @keyup.enter="queryTableRef?.search()"
            />
          </el-form-item>
        </el-form>
      </template>

      <el-table-column type="index" label="序号" width="72" />
      <el-table-column
        prop="tokenId"
        label="会话编号"
        min-width="210"
        show-overflow-tooltip
      />
      <el-table-column prop="userName" label="登录名称" min-width="130" />
      <el-table-column
        prop="deptName"
        label="部门名称"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column prop="ipaddr" label="主机" min-width="140" />
      <el-table-column prop="loginLocation" label="登录地点" min-width="130" />
      <el-table-column prop="browser" label="浏览器" min-width="120" />
      <el-table-column prop="os" label="操作系统" min-width="140" />
      <el-table-column label="登录时间" width="180">
        <template #default="{ row }">
          <BaseDateTime :value="row.loginTime" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="monitor:online:forceLogout"
            link
            type="danger"
            :icon="SwitchButton"
            @click="confirmForceLogout(row)"
          >
            强退
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :loading="actionLoading && Boolean(logoutTarget)"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.online-user-page {
  display: flex;
  flex-direction: column;
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height, 0px) - (var(--bq-space-page-y) * 2)
  );
  min-height: 0;
  overflow: hidden;
}

.online-user-page :deep(.page-container__body) {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.online-user-page :deep(.query-table) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.online-user-page :deep(.query-table__table) {
  box-sizing: border-box;
  display: flex;
  flex: 1;
  min-height: 0;
  padding-bottom: 64px;
}

.online-user-page :deep(.base-data-table) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.online-user-page :deep(.base-data-table .el-table) {
  flex: 1;
  height: 100% !important;
  min-height: 0;
}

.online-user-page :deep(.base-data-table .el-table__body-wrapper) {
  overflow-y: auto;
}
</style>
