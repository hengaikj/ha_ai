<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import type { TableInstance } from "element-plus";
import {
  fetchGovernanceBatchDetail,
  fetchGovernanceBatches,
} from "@/api/data-governance";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  GovernanceBatch,
  GovernanceBatchDetail,
  GovernanceBatchStatus,
} from "@/types/data-governance";
import {
  formatGovernanceCell,
  formatGovernanceTriggerType,
  formatGovernanceValue,
  normalizeGovernanceError,
} from "./governance-page-utils";
import GovernanceStatusTag from "./components/GovernanceStatusTag.vue";

const route = useRoute();
const query = reactive<{
  jobCode: string;
  status: GovernanceBatchStatus | "";
}>({
  jobCode: "",
  status: (route.query.status as GovernanceBatchStatus) || "",
});
const listError = ref<ReturnType<typeof normalizeGovernanceError> | null>(null);
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<GovernanceBatchDetail | null>(null);
const detailTableRef = ref<TableInstance>();
const detailError = ref<ReturnType<typeof normalizeGovernanceError> | null>(
  null,
);

async function queryBatches(pageSize: number, pageNo: number) {
  const result = await fetchGovernanceBatches({
    jobCode: query.jobCode.trim() || undefined,
    status: query.status || undefined,
    pageNo,
    pageSize,
  });
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

function handleListError(error: unknown) {
  listError.value = normalizeGovernanceError(error, "治理批次加载失败");
}

async function showLineage(row: GovernanceBatch) {
  await loadLineage(row.batchNo);
}

async function loadLineage(batchNo: string) {
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  detailError.value = null;
  try {
    detail.value = await fetchGovernanceBatchDetail(batchNo);
    await layoutDetailTable();
  } catch (error) {
    detailError.value = normalizeGovernanceError(error, "数据血缘加载失败");
  } finally {
    detailLoading.value = false;
  }
}

async function layoutDetailTable() {
  await nextTick();
  detailTableRef.value?.doLayout();
}

function handleDetailOpened() {
  void layoutDetailTable();
}

onMounted(() => {
  const batchNo = String(route.query.batchNo || "").trim();
  if (batchNo) {
    void loadLineage(batchNo);
  }
});
</script>

<template>
  <PageContainer
    class="governance-page"
    title="数据血缘"
    description="按治理批次查看来源表到目标表的流转记录。"
  >
    <TraceErrorAlert v-if="listError" v-bind="listError" />
    <QueryTable
      :func="queryBatches"
      fit-table-height
      :table-props="{ scrollbarAlwaysOn: true }"
      empty-title="暂无治理批次"
      empty-description="当前筛选条件下没有可查看的数据血缘。"
      @reset="resetQuery"
      @error="handleListError"
      @loaded="listError = null"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="作业编码">
            <el-input
              v-model="query.jobCode"
              clearable
              placeholder="请输入作业编码"
            />
          </el-form-item>
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
        prop="currentStep"
        label="当前步骤"
        min-width="130"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="批次状态" width="100">
        <template #default="{ row }">
          <GovernanceStatusTag :status="row.status" />
        </template>
      </el-table-column>
      <el-table-column label="完成时间" min-width="170">
        <template #default="{ row }">
          <BaseDateTime :value="row.finishedAt" empty-text="-" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="110" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton link @click="showLineage(row)">
            查看血缘
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseDrawer
      v-model="detailVisible"
      title="数据血缘详情"
      size="min(1120px, 94vw)"
      :show-footer="false"
      @opened="handleDetailOpened"
    >
      <div v-loading="detailLoading">
        <TraceErrorAlert v-if="detailError" v-bind="detailError" />
        <template v-if="detail">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="批次号">
              {{ formatGovernanceValue(detail.batch.batchNo) }}
            </el-descriptions-item>
            <el-descriptions-item label="业务日期">
              {{ formatGovernanceValue(detail.batch.bizDate) }}
            </el-descriptions-item>
            <el-descriptions-item label="批次状态">
              <GovernanceStatusTag :status="detail.batch.status" />
            </el-descriptions-item>
          </el-descriptions>
          <el-table
            ref="detailTableRef"
            :data="detail.lineages"
            border
            class="lineage-detail-table"
            empty-text="该批次暂无血缘记录"
            table-layout="fixed"
          >
            <el-table-column
              prop="stepCode"
              label="治理步骤"
              width="240"
              show-overflow-tooltip
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="sourceSystem"
              label="来源系统"
              width="120"
              :formatter="formatGovernanceCell"
            />
            <el-table-column label="来源层级" width="100">
              <template #default="{ row }">{{
                formatGovernanceValue(row.sourceLayer)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="sourceTable"
              label="来源表"
              width="250"
              show-overflow-tooltip
              :formatter="formatGovernanceCell"
            />
            <el-table-column label="目标层级" width="100">
              <template #default="{ row }">{{
                formatGovernanceValue(row.targetLayer)
              }}</template>
            </el-table-column>
            <el-table-column
              prop="targetTable"
              label="目标表"
              width="250"
              show-overflow-tooltip
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="recordCount"
              label="记录数"
              width="100"
              align="right"
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="scriptVersion"
              label="脚本版本"
              width="120"
              :formatter="formatGovernanceCell"
            />
          </el-table>
        </template>
        <el-empty v-else description="暂无批次血缘详情" />
      </div>
    </BaseDrawer>
  </PageContainer>
</template>

<style scoped>
.lineage-detail-table {
  margin-top: var(--bq-space-section);
  width: 100%;
}
</style>
