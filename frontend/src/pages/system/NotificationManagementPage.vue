<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { Files, Refresh, RefreshLeft } from "@element-plus/icons-vue";
import {
  fetchNotificationIdentities,
  fetchNotificationMessages,
  fetchNotificationTemplates,
  resolveNotificationIdentity,
  retryNotificationMessage,
} from "@/api/notification";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  NotificationIdentity,
  NotificationMessage,
  NotificationStatus,
  NotificationTemplate,
} from "@/types/notification";

type QueryTableExpose = { reload: () => Promise<void>; search: () => void };

const activeTab = ref("messages");
const messageTable = ref<QueryTableExpose | null>(null);
const identityTable = ref<QueryTableExpose | null>(null);
const deadLetterTable = ref<QueryTableExpose | null>(null);
const templates = ref<NotificationTemplate[]>([]);
const templateDialogVisible = ref(false);
const messageQuery = reactive({
  status: "",
  sourceSystem: "",
  eventType: "",
  receiverUserId: "",
});
const identityQuery = reactive({ status: "", userId: "" });

async function queryMessages(pageSize: number, pageNo: number) {
  const result = await fetchNotificationMessages({
    pageNo,
    pageSize,
    status: messageQuery.status || undefined,
    sourceSystem: messageQuery.sourceSystem.trim() || undefined,
    eventType: messageQuery.eventType.trim() || undefined,
    receiverUserId: positiveNumber(messageQuery.receiverUserId),
  });
  return { total: result.total, list: result.records, pageNo, pageSize };
}

async function queryIdentities(pageSize: number, pageNo: number) {
  const result = await fetchNotificationIdentities({
    pageNo,
    pageSize,
    status: identityQuery.status || undefined,
    userId: positiveNumber(identityQuery.userId),
  });
  return { total: result.total, list: result.records, pageNo, pageSize };
}

async function queryDeadLetters(pageSize: number, pageNo: number) {
  const result = await fetchNotificationMessages({
    pageNo,
    pageSize,
    status: "DEAD_LETTER",
  });
  return { total: result.total, list: result.records, pageNo, pageSize };
}

async function retryMessage(row: NotificationMessage) {
  await retryNotificationMessage(row.id);
  BaseToast.success("通知已进入重试队列");
  await Promise.all([
    messageTable.value?.reload(),
    deadLetterTable.value?.reload(),
  ]);
}

async function resolveIdentity(row: NotificationIdentity) {
  await resolveNotificationIdentity(row.userId);
  BaseToast.success("身份已重新解析");
  await identityTable.value?.reload();
}

async function showTemplates() {
  templates.value = await fetchNotificationTemplates();
  templateDialogVisible.value = true;
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function resetMessageQuery() {
  Object.assign(messageQuery, {
    status: "",
    sourceSystem: "",
    eventType: "",
    receiverUserId: "",
  });
}

function resetIdentityQuery() {
  Object.assign(identityQuery, { status: "", userId: "" });
}

function statusType(status: NotificationStatus) {
  if (status === "SUCCESS") return "success";
  if (["DEAD_LETTER", "IDENTITY_UNRESOLVED"].includes(status)) return "danger";
  if (["RETRY_WAIT", "SENDING", "RESOLVING_IDENTITY"].includes(status))
    return "warning";
  return "info";
}

function statusLabel(status: NotificationStatus) {
  return {
    PENDING: "待处理",
    RESOLVING_IDENTITY: "解析身份中",
    READY: "待发送",
    SENDING: "发送中",
    SUCCESS: "发送成功",
    IDENTITY_UNRESOLVED: "身份未解析",
    RETRY_WAIT: "等待重试",
    DEAD_LETTER: "死信",
    CANCELLED: "已取消",
  }[status];
}

onMounted(() =>
  fetchNotificationTemplates().then((value) => (templates.value = value)),
);
</script>

<template>
  <PageContainer title="通知管理" class="notification-page">
    <div class="notification-tabs-shell">
      <PermissionButton
        class="notification-tabs-action"
        permission="notification:template:list"
        variant="secondary"
        type="primary"
        plain
        :icon="Files"
        @click="showTemplates"
      >
        模板版本
      </PermissionButton>

      <el-tabs v-model="activeTab" class="notification-tabs">
        <el-tab-pane label="通知消息" name="messages">
          <QueryTable
            ref="messageTable"
            class="notification-query-table"
            :func="queryMessages"
            row-key="id"
            fit-table-height
            @reset="resetMessageQuery"
          >
            <template #search>
              <el-form :model="messageQuery">
                <el-form-item label="状态">
                  <el-select
                    v-model="messageQuery.status"
                    clearable
                    placeholder="全部状态"
                  >
                    <el-option
                      v-for="status in [
                        'PENDING',
                        'READY',
                        'RETRY_WAIT',
                        'SUCCESS',
                        'IDENTITY_UNRESOLVED',
                        'DEAD_LETTER',
                        'CANCELLED',
                      ]"
                      :key="status"
                      :label="status"
                      :value="status"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="来源"
                  ><el-input v-model="messageQuery.sourceSystem" clearable
                /></el-form-item>
                <el-form-item label="事件"
                  ><el-input v-model="messageQuery.eventType" clearable
                /></el-form-item>
                <el-form-item label="接收人ID"
                  ><el-input v-model="messageQuery.receiverUserId" clearable
                /></el-form-item>
              </el-form>
            </template>
            <el-table-column prop="id" label="消息ID" width="100" />
            <el-table-column prop="sourceSystem" label="来源" width="120" />
            <el-table-column
              prop="eventType"
              label="事件"
              min-width="210"
              show-overflow-tooltip
            />
            <el-table-column
              prop="receiverUserId"
              label="接收人ID"
              width="120"
            />
            <el-table-column label="状态" width="150">
              <template #default="{ row }">
                <BaseStatusTag
                  :label="statusLabel(row.messageStatus)"
                  :type="statusType(row.messageStatus)"
                />
              </template>
            </el-table-column>
            <el-table-column prop="retryCount" label="重试" width="80" />
            <el-table-column
              prop="lastErrorMessage"
              label="最近错误"
              min-width="220"
              show-overflow-tooltip
            />
            <el-table-column label="创建时间" width="180"
              ><template #default="{ row }"
                ><BaseDateTime :value="row.createTime" /></template
            ></el-table-column>
            <el-table-column label="操作" width="100" fixed="right"
              ><template #default="{ row }"
                ><PermissionButton
                  v-if="
                    [
                      'IDENTITY_UNRESOLVED',
                      'RETRY_WAIT',
                      'DEAD_LETTER',
                    ].includes(row.messageStatus)
                  "
                  permission="notification:message:retry"
                  link
                  :icon="RefreshLeft"
                  @click="retryMessage(row)"
                  >重试</PermissionButton
                ></template
              ></el-table-column
            >
          </QueryTable>
        </el-tab-pane>

        <el-tab-pane label="身份映射" name="identities">
          <QueryTable
            ref="identityTable"
            class="notification-query-table"
            :func="queryIdentities"
            row-key="userId"
            fit-table-height
            @reset="resetIdentityQuery"
          >
            <template #search>
              <el-form :model="identityQuery">
                <el-form-item label="状态"
                  ><el-select v-model="identityQuery.status" clearable
                    ><el-option label="已解析" value="RESOLVED" /><el-option
                      label="未解析"
                      value="UNRESOLVED" /><el-option
                      label="已停用"
                      value="DISABLED" /></el-select
                ></el-form-item>
                <el-form-item label="用户ID"
                  ><el-input v-model="identityQuery.userId" clearable
                /></el-form-item>
              </el-form>
            </template>
            <el-table-column prop="userId" label="用户ID" width="110" />
            <el-table-column prop="provider" label="提供方" width="100" />
            <el-table-column prop="matchType" label="匹配方式" width="110" />
            <el-table-column prop="identityStatus" label="状态" width="130" />
            <el-table-column
              prop="externalIdMasked"
              label="外部标识"
              min-width="150"
            />
            <el-table-column
              prop="failureMessage"
              label="异常摘要"
              min-width="240"
              show-overflow-tooltip
            />
            <el-table-column label="更新时间" width="180"
              ><template #default="{ row }"
                ><BaseDateTime :value="row.updateTime" /></template
            ></el-table-column>
            <el-table-column label="操作" width="110" fixed="right"
              ><template #default="{ row }"
                ><PermissionButton
                  permission="notification:identity:resolve"
                  link
                  :icon="Refresh"
                  @click="resolveIdentity(row)"
                  >重新解析</PermissionButton
                ></template
              ></el-table-column
            >
          </QueryTable>
        </el-tab-pane>

        <el-tab-pane label="死信与重试" name="deadLetters">
          <QueryTable
            ref="deadLetterTable"
            class="notification-query-table notification-query-table--without-search"
            :func="queryDeadLetters"
            row-key="id"
            :show-search="false"
            fit-table-height
          >
            <el-table-column prop="id" label="消息ID" width="100" />
            <el-table-column prop="eventType" label="事件" min-width="210" />
            <el-table-column
              prop="receiverUserId"
              label="接收人ID"
              width="120"
            />
            <el-table-column prop="retryCount" label="尝试次数" width="100" />
            <el-table-column
              prop="lastErrorCode"
              label="错误码"
              min-width="160"
            />
            <el-table-column
              prop="lastErrorMessage"
              label="错误摘要"
              min-width="260"
              show-overflow-tooltip
            />
            <el-table-column label="操作" width="100" fixed="right"
              ><template #default="{ row }"
                ><PermissionButton
                  permission="notification:message:retry"
                  link
                  :icon="RefreshLeft"
                  @click="retryMessage(row)"
                  >重试</PermissionButton
                ></template
              ></el-table-column
            >
          </QueryTable>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog v-model="templateDialogVisible" title="已发布模板" width="760px">
      <el-table :data="templates" row-key="id">
        <el-table-column prop="templateCode" label="模板编码" min-width="260" />
        <el-table-column prop="channel" label="通道" width="100" />
        <el-table-column prop="templateVersion" label="版本" width="90" />
        <el-table-column prop="templateStatus" label="状态" width="110" />
        <el-table-column label="发布时间" width="180"
          ><template #default="{ row }"
            ><BaseDateTime :value="row.publishTime" /></template
        ></el-table-column>
      </el-table>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.notification-page :deep(.page-container__header) {
  display: none;
}

.notification-page {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height) - 10px - var(--bq-space-page-y)
  );
  min-height: 0;
  overflow: hidden;
}

.notification-page :deep(.page-container__body) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.notification-tabs-shell {
  position: relative;
  box-sizing: border-box;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.notification-tabs-action {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
}

.notification-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.notification-tabs :deep(.el-tabs__header) {
  margin-bottom: var(--bq-space-section);
}

.notification-tabs :deep(.el-tabs__nav-wrap) {
  padding-right: 148px;
}

.notification-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.notification-tabs :deep(.el-tab-pane) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.notification-query-table {
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.notification-query-table--without-search {
  grid-template-rows: minmax(0, 1fr) auto;
}

.notification-query-table :deep(.query-table__table) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.notification-query-table :deep(.base-data-table),
.notification-query-table :deep(.base-data-table > .el-table) {
  height: 100%;
  min-height: 0;
}

@media (max-width: 640px) {
  .notification-tabs-shell {
    padding-top: 44px;
  }

  .notification-tabs :deep(.el-tabs__nav-wrap) {
    padding-right: 0;
  }
}
</style>
