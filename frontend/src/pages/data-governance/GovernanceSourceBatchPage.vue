<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { fetchGovernanceSourceBatches } from "@/api/data-governance";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import GovernanceStatusTag from "./components/GovernanceStatusTag.vue";
import { formatGovernanceCell } from "./governance-page-utils";

type QueryTableExpose = { reload: () => Promise<void> };

const route = useRoute();
const queryTableRef = ref<QueryTableExpose | null>(null);
const routeObjectCode = Array.isArray(route.query.objectCode)
  ? route.query.objectCode[0]
  : route.query.objectCode;
const query = reactive({
  objectCode: routeObjectCode || "",
});

async function load(pageSize: number, pageNo: number) {
  const result = await fetchGovernanceSourceBatches({
    objectCode: query.objectCode.trim() || undefined,
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

watch(
  () => route.query.objectCode,
  (value) => {
    const objectCode = Array.isArray(value) ? value[0] || "" : value || "";
    if (query.objectCode === objectCode) return;
    query.objectCode = objectCode;
    void queryTableRef.value?.reload();
  },
);

function resetQuery() {
  query.objectCode = "";
}
</script>

<template>
  <PageContainer
    class="governance-page"
    title="来源批次"
    description="查询同步程序自动登记的 ODS 来源批次，并跟踪到达、质量和记录数。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="load"
      fit-table-height
      empty-title="暂无来源批次"
      empty-description="当前筛选条件下没有可展示的来源批次。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="采集对象编码">
            <el-input
              v-model="query.objectCode"
              clearable
              placeholder="请输入采集对象编码"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #default>
        <el-table-column
          prop="objectCode"
          label="采集对象"
          min-width="160"
          :formatter="formatGovernanceCell"
        />
        <el-table-column
          prop="sourceBatchNo"
          label="来源批次号"
          min-width="180"
          :formatter="formatGovernanceCell"
        />
        <el-table-column
          prop="bizDate"
          label="业务日期"
          width="120"
          :formatter="formatGovernanceCell"
        />
        <el-table-column label="到达状态" width="110">
          <template #default="{ row }">
            <GovernanceStatusTag :status="row.arrivalStatus" />
          </template>
        </el-table-column>
        <el-table-column label="质量状态" width="110">
          <template #default="{ row }">
            <GovernanceStatusTag :status="row.qualityStatus" />
          </template>
        </el-table-column>
        <el-table-column
          prop="recordCount"
          label="记录数"
          width="100"
          :formatter="formatGovernanceCell"
        />
        <el-table-column
          prop="ownerName"
          label="责任人"
          min-width="120"
          :formatter="formatGovernanceCell"
        />
        <el-table-column
          prop="targetOdsTable"
          label="ODS目标表"
          min-width="200"
          show-overflow-tooltip
          :formatter="formatGovernanceCell"
        />
        <el-table-column label="到达时间" min-width="170">
          <template #default="{ row }">
            <BaseDateTime :value="row.arrivedAt" empty-text="-" />
          </template>
        </el-table-column>
      </template>
    </QueryTable>
  </PageContainer>
</template>
