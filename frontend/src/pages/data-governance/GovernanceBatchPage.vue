<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import {
  cancelGovernanceBatch,
  fetchGovernanceBatchDetail,
  fetchGovernanceBatches,
  recoverStaleGovernanceBatches,
  retryGovernanceBatch,
} from "@/api/data-governance";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import GovernanceBatchDetailDrawer from "./components/GovernanceBatchDetailDrawer.vue";
import GovernanceStatusTag from "./components/GovernanceStatusTag.vue";
import {
  formatGovernanceCell,
  formatGovernanceTriggerType,
  formatGovernanceValue,
  normalizeGovernanceError,
} from "./governance-page-utils";
import type {
  GovernanceBatch,
  GovernanceBatchDetail,
  GovernanceBatchStatus,
} from "@/types/data-governance";

type QueryTableExpose = { reload: () => Promise<void> };

const route = useRoute();
const queryTableRef = ref<QueryTableExpose | null>(null);
const saving = ref(false);
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<GovernanceBatchDetail | null>(null);
const detailError = ref<ReturnType<typeof normalizeGovernanceError> | null>(
  null,
);
const confirmVisible = ref(false);
const confirmMode = ref<"cancel" | "recover">("cancel");
const active = ref<GovernanceBatch | null>(null);
const retryVisible = ref(false);
const retryNo = ref("");
const actionError = ref<ReturnType<typeof normalizeGovernanceError> | null>(
  null,
);
const query = reactive<{ jobCode: string; status: GovernanceBatchStatus | "" }>(
  {
    jobCode: "",
    status: (route.query.status as GovernanceBatchStatus) || "",
  },
);
let timer: number | undefined;

async function queryBatches(pageSize: number, pageNo: number) {
  const result = await fetchGovernanceBatches({
    jobCode: query.jobCode.trim() || undefined,
    status: query.status || undefined,
    pageNo,
    pageSize,
  });
  setupRefresh(result.records);
  return {
    list: result.records,
    total: result.total,
    pageNo: result.pageNo,
    pageSize: result.pageSize,
  };
}

function resetQuery() {
  query.jobCode = "";
  query.status = "";
}

function setupRefresh(rows: GovernanceBatch[]) {
  if (timer) window.clearInterval(timer);
  if (
    rows.some((row) => row.status === "PENDING" || row.status === "RUNNING")
  ) {
    timer = window.setInterval(() => {
      if (!document.hidden) void queryTableRef.value?.reload();
    }, 10000);
  }
}

async function showDetail(row: GovernanceBatch) {
  actionError.value = null;
  active.value = row;
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  detailError.value = null;
  try {
    detail.value = await fetchGovernanceBatchDetail(row.batchNo);
  } catch (error) {
    detailError.value = normalizeGovernanceError(error, "批次详情加载失败");
  } finally {
    detailLoading.value = false;
  }
}

function askCancel(row: GovernanceBatch) {
  actionError.value = null;
  active.value = row;
  confirmMode.value = "cancel";
  confirmVisible.value = true;
}

function askRecover() {
  actionError.value = null;
  active.value = null;
  confirmMode.value = "recover";
  confirmVisible.value = true;
}

async function confirm() {
  saving.value = true;
  actionError.value = null;
  try {
    if (confirmMode.value === "cancel" && active.value) {
      await cancelGovernanceBatch(active.value.batchNo);
      BaseToast.success("待执行批次已取消");
    } else {
      const count = await recoverStaleGovernanceBatches();
      BaseToast.success(`已标记 ${count} 个失联批次为失败`);
    }
    confirmVisible.value = false;
    await queryTableRef.value?.reload();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "批次操作失败");
  } finally {
    saving.value = false;
  }
}

function openRetry(row: GovernanceBatch) {
  actionError.value = null;
  active.value = row;
  retryNo.value = `WEB-RETRY-${row.batchNo}-${Date.now()}`;
  retryVisible.value = true;
}

async function retry() {
  if (!active.value || !retryNo.value.trim()) return;
  saving.value = true;
  actionError.value = null;
  try {
    const batch = await retryGovernanceBatch(
      active.value.batchNo,
      retryNo.value.trim(),
    );
    BaseToast.success(`已创建重跑批次 ${batch.batchNo}`);
    retryVisible.value = false;
    await queryTableRef.value?.reload();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "失败批次重跑失败");
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  const batchNo = String(route.query.batchNo || "");
  if (!batchNo) return;
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    detail.value = await fetchGovernanceBatchDetail(batchNo);
  } catch (error) {
    detailError.value = normalizeGovernanceError(error, "批次详情加载失败");
  } finally {
    detailLoading.value = false;
  }
});
onBeforeUnmount(() => timer && window.clearInterval(timer));
</script>

<template>
  <PageContainer
    class="governance-page"
    title="运行批次"
    description="跟踪治理任务执行进度、处理失败批次并查看执行步骤和数据血缘。"
  >
    <TraceErrorAlert v-if="actionError && !retryVisible" v-bind="actionError" />
    <QueryTable
      ref="queryTableRef"
      :func="queryBatches"
      fit-table-height
      empty-title="暂无运行批次"
      empty-description="当前筛选条件下没有可展示的治理批次。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="作业编码"
            ><el-input
              v-model="query.jobCode"
              clearable
              placeholder="请输入作业编码"
          /></el-form-item>
          <el-form-item label="批次状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择批次状态"
            >
              <el-option label="待执行" value="PENDING" />
              <el-option label="执行中" value="RUNNING" />
              <el-option label="成功" value="SUCCESS" />
              <el-option label="部分成功" value="PARTIAL_SUCCESS" />
              <el-option label="失败" value="FAILED" />
              <el-option label="重跑中" value="RETRYING" />
              <el-option label="已取消" value="CANCELLED" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <template #toolbar>
        <PermissionButton
          permission="data:governance:batch:recover"
          type="warning"
          plain
          @click="askRecover"
          >恢复失联批次</PermissionButton
        >
      </template>
      <el-table-column
        prop="batchNo"
        label="批次号"
        min-width="190"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="bizDate"
        label="业务日期"
        width="115"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="触发类型" min-width="150">
        <template #default="{ row }">
          {{ formatGovernanceTriggerType(row.triggerType) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="triggerBy"
        label="触发人"
        width="110"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="批次状态" width="100">
        <template #default="{ row }"
          ><GovernanceStatusTag :status="row.status"
        /></template>
      </el-table-column>
      <el-table-column label="质量状态" width="100">
        <template #default="{ row }">
          <GovernanceStatusTag :status="row.qualityStatus" />
        </template>
      </el-table-column>
      <el-table-column
        prop="missingSourceCount"
        label="缺失来源"
        width="95"
        align="right"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="当前步骤" min-width="130">
        <template #default="{ row }">
          {{ formatGovernanceValue(row.currentStep) }}
        </template>
      </el-table-column>
      <el-table-column label="成功/失败/总数" width="140" align="right">
        <template #default="{ row }"
          >{{ formatGovernanceValue(row.successCount) }} /
          {{ formatGovernanceValue(row.failedCount) }} /
          {{ formatGovernanceValue(row.totalCount) }}</template
        >
      </el-table-column>
      <el-table-column label="开始时间" min-width="170">
        <template #default="{ row }"
          ><BaseDateTime :value="row.startedAt" empty-text="-"
        /></template>
      </el-table-column>
      <el-table-column label="完成时间" min-width="170">
        <template #default="{ row }"
          ><BaseDateTime :value="row.finishedAt" empty-text="-"
        /></template>
      </el-table-column>
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <div class="bq-table-actions">
            <el-button link @click="showDetail(row)">查看</el-button>
            <PermissionButton
              v-if="row.status === 'PENDING'"
              link
              type="danger"
              permission="data:governance:batch:cancel"
              @click="askCancel(row)"
              >取消</PermissionButton
            >
            <PermissionButton
              v-if="['FAILED', 'PARTIAL_SUCCESS'].includes(row.status)"
              link
              permission="data:governance:batch:retry"
              @click="openRetry(row)"
              >重跑</PermissionButton
            >
          </div>
        </template>
      </el-table-column>
    </QueryTable>
    <GovernanceBatchDetailDrawer
      v-model="detailVisible"
      :detail="detail"
      :loading="detailLoading"
      :error="detailError"
    />
    <BaseConfirm
      v-model="confirmVisible"
      :title="confirmMode === 'cancel' ? '取消批次' : '恢复失联批次'"
      :message="
        confirmMode === 'cancel'
          ? `确认取消批次「${active?.batchNo || ''}」？仅待执行批次允许取消。`
          : '确认将租约过期的运行中批次标记为失败？该操作不会直接重新执行。'
      "
      :type="confirmMode === 'cancel' ? 'danger' : 'warning'"
      :loading="saving"
      @confirm="confirm"
    />
    <BaseFormDialog
      v-model="retryVisible"
      title="重跑失败批次"
      confirm-text="重跑"
      :loading="saving"
      @confirm="retry"
    >
      <TraceErrorAlert v-if="actionError" v-bind="actionError" />
      <el-form label-position="top">
        <el-form-item label="原批次"
          ><el-input :model-value="active?.batchNo" disabled clearable
        /></el-form-item>
        <el-form-item label="请求号" required
          ><el-input v-model="retryNo" clearable
        /></el-form-item>
      </el-form>
    </BaseFormDialog>
  </PageContainer>
</template>
