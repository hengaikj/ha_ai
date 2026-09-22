<script setup lang="ts">
import { reactive, ref } from "vue";
import { Download, RefreshRight, Unlock } from "@element-plus/icons-vue";
import {
  cleanPlatformLoginLogs,
  deletePlatformLoginLogs,
  exportPlatformLoginLogs,
  fetchPlatformLoginLogsPage,
  unlockPlatformLoginUser,
} from "@/api/platform-system";
import { ApiBusinessError } from "@/api/http";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { resolvePageTotal } from "@/utils/pagination";
import type {
  PlatformLogStatus,
  PlatformLoginLogItem,
  PlatformLoginLogQuery,
} from "@/types/platform-system";

interface LoginLogQueryState {
  username: string;
  ipaddr: string;
  status: PlatformLogStatus | "";
  loginTimeRange: [string, string] | [] | null;
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

const query = reactive<LoginLogQueryState>({
  username: "",
  ipaddr: "",
  status: "",
  loginTimeRange: [],
});
const selectedLogs = ref<PlatformLoginLogItem[]>([]);
const exporting = ref(false);
const queryTableRef = ref<QueryTableExpose | null>(null);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

async function queryLoginLogs(pageSize: number, pageNo: number) {
  error.value = null;
  try {
    const response = await fetchPlatformLoginLogsPage(
      buildLoginLogQueryParams(pageSize, pageNo),
    );
    return {
      total: resolvePageTotal(response, pageNo, pageSize),
      list: response.records,
      pageNo: response.pageNo,
      pageSize: response.pageSize,
    };
  } catch (unknownError) {
    const normalizedError = normalizeError(unknownError);
    error.value = normalizedError;
    throw new Error(normalizedError.message, { cause: unknownError });
  }
}

function buildLoginLogQueryParams(
  pageSize: number,
  pageNo: number,
): PlatformLoginLogQuery {
  const [loginFrom, loginTo] = Array.isArray(query.loginTimeRange)
    ? query.loginTimeRange
    : [];
  return {
    pageNo,
    pageSize,
    username: query.username.trim() || undefined,
    ipaddr: query.ipaddr.trim() || undefined,
    status: query.status || undefined,
    loginFrom: loginFrom ? `${loginFrom} 00:00:00` : undefined,
    loginTo: loginTo ? `${loginTo} 23:59:59` : undefined,
  };
}

function searchLoginLogs() {
  queryTableRef.value?.search();
}

async function reloadLoginLogs() {
  await queryTableRef.value?.reload();
}

function resetQuery() {
  query.username = "";
  query.ipaddr = "";
  query.status = "";
  query.loginTimeRange = [];
}

function handleSelectionChange(selection: PlatformLoginLogItem[]) {
  selectedLogs.value = selection;
}

async function deleteSelectedLoginLogs() {
  if (!selectedLogs.value.length) {
    BaseToast.warning("请先选择登录日志");
    return;
  }
  await confirmDelete(
    selectedLogs.value.map((log) => log.id),
    `确认删除选中的 ${selectedLogs.value.length} 条登录日志？删除后登录日志列表不再展示这些记录。`,
  );
}

async function confirmDelete(logIds: number[], message: string) {
  try {
    await openConfirm({
      title: "删除登录日志",
      message,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformLoginLogs(logIds);
    BaseToast.success("登录日志已删除");
    await reloadLoginLogs();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

async function cleanLoginLogs() {
  try {
    await openConfirm({
      title: "清空确认",
      message: "确认清空所有登录日志？",
      type: "danger",
      confirmText: "清空",
      cancelText: "取消",
    });
    await cleanPlatformLoginLogs();
    BaseToast.success("登录日志已清空");
    await reloadLoginLogs();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

async function unlockSelectedUsers() {
  const usernames = Array.from(
    new Set(
      selectedLogs.value
        .map((log) => log.username.trim())
        .filter((username) => Boolean(username)),
    ),
  );
  if (!usernames.length) {
    BaseToast.warning("请先选择登录日志");
    return;
  }

  error.value = null;
  try {
    await Promise.all(
      usernames.map((username) => unlockPlatformLoginUser(username)),
    );
    BaseToast.success(`已解锁 ${usernames.length} 个用户`);
    await reloadLoginLogs();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

async function exportLoginLogs() {
  exporting.value = true;
  error.value = null;
  try {
    const blob = await exportPlatformLoginLogs(
      buildLoginLogQueryParams(5000, 1),
    );
    downloadBlob(blob, "登录日志.xlsx");
    BaseToast.success("登录日志导出已开始下载");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    exporting.value = false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function statusTagType(status: PlatformLogStatus) {
  return status === "SUCCESS" ? "success" : "danger";
}

function statusLabel(status: PlatformLogStatus) {
  return status === "SUCCESS" ? "成功" : "失败";
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
    code: "FRONTEND-SYSTEM-LOGIN-LOG-001",
    message: "登录日志加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    title="登录日志"
    description="查看系统登录记录、失败原因，并处理锁定账号。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryLoginLogs"
      row-key="id"
      fit-table-height
      empty-title="暂无登录日志"
      empty-description="当前筛选条件下没有可展示的登录日志。"
      @reset="resetQuery"
      @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="用户名称">
            <el-input
              v-model="query.username"
              clearable
              maxlength="64"
              placeholder="请输入用户名称"
              data-test="login-log-search-username"
              @keyup.enter="searchLoginLogs"
            />
          </el-form-item>
          <el-form-item label="登录地址">
            <el-input
              v-model="query.ipaddr"
              clearable
              maxlength="64"
              placeholder="请输入登录地址"
              data-test="login-log-search-ip"
              @keyup.enter="searchLoginLogs"
            />
          </el-form-item>
          <el-form-item label="登录状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择登录状态"
              data-test="login-log-search-status"
            >
              <el-option label="成功" value="SUCCESS" />
              <el-option label="失败" value="FAILED" />
            </el-select>
          </el-form-item>
          <el-form-item label="登录时间">
            <el-date-picker
              v-model="query.loginTimeRange"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          permission="monitor:logininfor:clean"
          variant="secondary"
          plain
          type="primary"
          :icon="RefreshRight"
          data-test="clean-login-log-button"
          @click="cleanLoginLogs"
        >
          清空
        </PermissionButton>
        <PermissionButton
          permission="monitor:logininfor:unlock"
          variant="secondary"
          type="primary"
          plain
          :icon="Unlock"
          data-test="unlock-login-user-button"
          @click="unlockSelectedUsers"
        >
          解锁
        </PermissionButton>
        <PermissionButton
          permission="monitor:logininfor:export"
          variant="secondary"
          plain
          type="warning"
          :icon="Download"
          :loading="exporting"
          data-test="export-login-log-button"
          @click="exportLoginLogs"
        >
          导出
        </PermissionButton>
        <PermissionButton
            permission="monitor:logininfor:remove"
            variant="danger"
            type="danger"
            plain
            data-test="delete-selected-login-log-button"
            @click="deleteSelectedLoginLogs"
        >
          删除
        </PermissionButton>
      </template>

      <el-table-column type="selection" width="55" />
      <el-table-column prop="id" label="访问编号" width="110" />
      <el-table-column prop="username" label="用户名称" min-width="140" />
      <el-table-column prop="ipaddr" label="登录地址" min-width="150" />
      <el-table-column prop="loginLocation" label="登录地点" min-width="130" />
      <el-table-column prop="browser" label="浏览器" min-width="140" />
      <el-table-column prop="os" label="操作系统" min-width="130" />
      <el-table-column label="登录状态" width="120">
        <template #default="{ row }">
          <BaseStatusTag
            :label="statusLabel(row.status)"
            :type="statusTagType(row.status)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="message" label="操作信息" min-width="200" />
      <el-table-column label="登录日期" width="180">
        <template #default="{ row }">
          <BaseDateTime :value="row.loginTime || null" />
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
      :loading="confirmState.loading"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>
