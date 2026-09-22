<script setup lang="ts">
import { reactive, ref } from "vue";
import { Download, RefreshRight } from "@element-plus/icons-vue";
import {
  cleanPlatformOperationLogs,
  deletePlatformOperationLogs,
  exportPlatformOperationLogs,
  fetchPlatformOperationLogsPage,
} from "@/api/platform-system";
import { ApiBusinessError } from "@/api/http";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { resolvePageTotal } from "@/utils/pagination";
import type {
  PlatformLogStatus,
  PlatformOperationLogDetail,
  PlatformOperationLogItem,
  PlatformOperationLogQuery,
} from "@/types/platform-system";

interface OperationLogQueryState {
  title: string;
  businessType: string;
  operatorUsername: string;
  operIp: string;
  status: PlatformLogStatus | "";
  operatedAtRange: [string, string] | [] | null;
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

const query = reactive<OperationLogQueryState>({
  title: "",
  businessType: "",
  operatorUsername: "",
  operIp: "",
  status: "",
  operatedAtRange: [],
});
const selectedLogs = ref<PlatformOperationLogItem[]>([]);
const exporting = ref(false);
const detailDrawerVisible = ref(false);
const currentDetail = ref<PlatformOperationLogDetail | null>(null);
const queryTableRef = ref<QueryTableExpose | null>(null);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

async function queryOperationLogs(pageSize: number, pageNo: number) {
  error.value = null;
  try {
    const response = await fetchPlatformOperationLogsPage(
      buildOperationLogQueryParams(pageSize, pageNo),
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

function buildOperationLogQueryParams(
  pageSize: number,
  pageNo: number,
): PlatformOperationLogQuery {
  const [operatedFrom, operatedTo] = Array.isArray(query.operatedAtRange)
    ? query.operatedAtRange
    : [];
  return {
    pageNo,
    pageSize,
    title: query.title.trim() || undefined,
    businessType: query.businessType || undefined,
    operatorUsername: query.operatorUsername.trim() || undefined,
    operIp: query.operIp.trim() || undefined,
    status: query.status || undefined,
    operatedFrom: operatedFrom ? `${operatedFrom} 00:00:00` : undefined,
    operatedTo: operatedTo ? `${operatedTo} 23:59:59` : undefined,
  };
}

function searchOperationLogs() {
  queryTableRef.value?.search();
}

async function reloadOperationLogs() {
  await queryTableRef.value?.reload();
}

function resetQuery() {
  query.title = "";
  query.businessType = "";
  query.operatorUsername = "";
  query.operIp = "";
  query.status = "";
  query.operatedAtRange = [];
}

function handleSelectionChange(selection: PlatformOperationLogItem[]) {
  selectedLogs.value = selection;
}

function openDetailDrawer(row: PlatformOperationLogItem) {
  detailDrawerVisible.value = true;
  currentDetail.value = row;
}

async function deleteOperationLog(log: PlatformOperationLogItem) {
  await confirmDelete(
    [log.id],
    `确认删除操作日志「${log.title}」？删除后操作日志列表不再展示该记录。`,
  );
}

async function deleteSelectedOperationLogs() {
  if (!selectedLogs.value.length) {
    BaseToast.warning("请先选择操作日志");
    return;
  }
  await confirmDelete(
    selectedLogs.value.map((log) => log.id),
    `确认删除选中的 ${selectedLogs.value.length} 条操作日志？删除后操作日志列表不再展示这些记录。`,
  );
}

async function confirmDelete(logIds: number[], message: string) {
  try {
    await openConfirm({
      title: "删除操作日志",
      message,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformOperationLogs(logIds);
    BaseToast.success("操作日志已删除");
    await reloadOperationLogs();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

async function cleanOperationLogs() {
  try {
    await openConfirm({
      title: "清空确认",
      message: "确认清空所有操作日志？",
      type: "danger",
      confirmText: "清空",
      cancelText: "取消",
    });
    await cleanPlatformOperationLogs();
    BaseToast.success("操作日志已清空");
    await reloadOperationLogs();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

async function exportOperationLogs() {
  exporting.value = true;
  error.value = null;
  try {
    const blob = await exportPlatformOperationLogs(
      buildOperationLogQueryParams(5000, 1),
    );
    downloadBlob(blob, "操作日志.xlsx");
    BaseToast.success("操作日志导出已开始下载");
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

function businessTypeLabel(type?: string) {
  const map: Record<string, string> = {
    "0": "其他",
    "1": "新增",
    "2": "修改",
    "3": "删除",
    "4": "授权",
    "5": "导出",
    "6": "导入",
    "7": "强退",
    "8": "生成代码",
    "9": "清空数据",
    CREATE: "新增",
    UPDATE: "修改",
    DELETE: "删除",
    GRANT: "授权",
    CLEAN: "清空",
    QUERY: "查询",
    IMPORT: "导入",
    CANCEL: "取消",
  };
  return type ? (map[type] ?? type) : "-";
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
    code: "FRONTEND-SYSTEM-OPERATION-LOG-001",
    message: "操作日志加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    title="操作日志"
    description="查看后台操作记录、接口请求和执行结果。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryOperationLogs"
      row-key="id"
      fit-table-height
      empty-title="暂无操作日志"
      empty-description="当前筛选条件下没有可展示的操作日志。"
      @reset="resetQuery"
      @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="系统模块">
            <el-input
              v-model="query.title"
              clearable
              maxlength="64"
              placeholder="请输入系统模块"
              data-test="operation-log-search-title"
              @keyup.enter="searchOperationLogs"
            />
          </el-form-item>
          <el-form-item label="操作类型">
            <el-select
              v-model="query.businessType"
              clearable
              placeholder="请选择类型"
              data-test="operation-log-search-business-type"
            >
              <el-option label="其他" value="0" />
              <el-option label="新增" value="1" />
              <el-option label="修改" value="2" />
              <el-option label="删除" value="3" />
              <el-option label="授权" value="4" />
              <el-option label="导出" value="5" />
              <el-option label="导入" value="6" />
              <el-option label="强退" value="7" />
              <el-option label="生成代码" value="8" />
              <el-option label="清空数据" value="9" />
            </el-select>
          </el-form-item>
          <el-form-item label="操作人员">
            <el-input
              v-model="query.operatorUsername"
              clearable
              maxlength="64"
              placeholder="请输入操作人员"
              data-test="operation-log-search-operator"
              @keyup.enter="searchOperationLogs"
            />
          </el-form-item>
          <el-form-item label="操作地址">
            <el-input
              v-model="query.operIp"
              clearable
              maxlength="64"
              placeholder="请输入操作地址"
              data-test="operation-log-search-ip"
              @keyup.enter="searchOperationLogs"
            />
          </el-form-item>
          <el-form-item label="操作状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择操作状态"
              data-test="operation-log-search-status"
            >
              <el-option label="成功" value="SUCCESS" />
              <el-option label="失败" value="FAILED" />
            </el-select>
          </el-form-item>
          <el-form-item label="操作时间">
            <el-date-picker
              v-model="query.operatedAtRange"
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
          permission="monitor:operlog:clean"
          variant="secondary"
          plain
          type="primary"
          :icon="RefreshRight"
          data-test="clean-operation-log-button"
          @click="cleanOperationLogs"
        >
          清空
        </PermissionButton>
        <PermissionButton
          permission="monitor:operlog:export"
          variant="secondary"
          plain
          type="warning"
          :icon="Download"
          :loading="exporting"
          data-test="export-operation-log-button"
          @click="exportOperationLogs"
        >
          导出
        </PermissionButton>
        <PermissionButton
            permission="monitor:operlog:remove"
            variant="danger"
            type="danger"
            plain
            data-test="delete-selected-operation-log-button"
            @click="deleteSelectedOperationLogs"
        >
          删除
        </PermissionButton>
      </template>

      <el-table-column type="selection" width="55" />
      <el-table-column prop="id" label="日志编号" width="110" />
      <el-table-column prop="title" label="系统模块" min-width="150" />
      <el-table-column label="操作类型" width="110">
        <template #default="{ row }">
          {{ businessTypeLabel(row.businessType) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="operatorUsername"
        label="操作人员"
        min-width="130"
      />
      <el-table-column prop="operIp" label="操作地址" min-width="140" />
      <el-table-column prop="operLocation" label="操作地点" min-width="120" />
      <el-table-column label="操作状态" width="120">
        <template #default="{ row }">
          <BaseStatusTag
            :label="statusLabel(row.status)"
            :type="statusTagType(row.status)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作日期" width="180">
        <template #default="{ row }">
          <BaseDateTime :value="row.operatedAt || null" />
        </template>
      </el-table-column>
      <el-table-column label="消耗时间" width="110" align="right">
        <template #default="{ row }"> {{ row.costTime ?? 0 }} ms </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right" align="center">
        <template #default="{ row }">
            <PermissionButton
              permission="monitor:operlog:query"
              link
              :data-test="`detail-operation-log-${row.id}`"
              @click="openDetailDrawer(row)"
            >
              详情
            </PermissionButton>
            <PermissionButton
              permission="monitor:operlog:remove"
              link
              :data-test="`delete-operation-log-${row.id}`"
              @click="deleteOperationLog(row)"
            >
              删除
            </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseDrawer
      v-model="detailDrawerVisible"
      title="操作日志详情"
      size="640px"
      :show-footer="false"
    >
      <el-descriptions
        v-if="currentDetail"
        :column="1"
        border
        data-test="operation-log-detail"
      >
        <el-descriptions-item label="系统模块">
          {{ currentDetail.title }}
        </el-descriptions-item>
        <el-descriptions-item label="操作类型">
          {{ businessTypeLabel(currentDetail.businessType) }}
        </el-descriptions-item>
        <el-descriptions-item label="操作方法">
          {{ currentDetail.method || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="请求方式">
          {{ currentDetail.requestMethod || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="请求地址">
          {{ currentDetail.requestPath || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="操作人员">
          {{ currentDetail.operatorUsername || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="部门名称">
          {{ currentDetail.deptName || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="操作地址">
          {{ currentDetail.operIp || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="操作地点">
          {{ currentDetail.operLocation || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="操作状态">
          <BaseStatusTag
            :label="statusLabel(currentDetail.status)"
            :type="statusTagType(currentDetail.status)"
          />
        </el-descriptions-item>
        <el-descriptions-item label="消耗时间">
          {{ currentDetail.costTime ?? 0 }} ms
        </el-descriptions-item>
        <el-descriptions-item label="操作时间">
          <BaseDateTime :value="currentDetail.operatedAt || null" />
        </el-descriptions-item>
        <el-descriptions-item label="TraceId">
          {{ currentDetail.traceId || "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="请求参数">
          <pre class="system-operation-log-page__code">{{
            currentDetail.requestParams || "-"
          }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="返回参数">
          <pre class="system-operation-log-page__code">{{
            currentDetail.responseBody || "-"
          }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="异常信息">
          {{ currentDetail.errorMessage || "-" }}
        </el-descriptions-item>
      </el-descriptions>
    </BaseDrawer>
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

<style scoped>
.system-operation-log-page__code {
  max-height: 180px;
  margin: 0;
  overflow: auto;
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
