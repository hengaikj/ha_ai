<script setup lang="ts">
import { reactive } from "vue";
import { useRouter } from "vue-router";
import { fetchGovernanceCostSummaries } from "@/api/data-governance";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseMoney from "@/components/base/BaseMoney.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import GovernanceStatusTag from "./components/GovernanceStatusTag.vue";
import {
  formatGovernanceCell,
  formatGovernanceValue,
} from "./governance-page-utils";
import type { AdsCostSummary } from "@/types/data-governance";

const router = useRouter();
const query = reactive({ projectNo: "", vehiclem: "" });

async function querySummaries(pageSize: number, pageNo: number) {
  const result = await fetchGovernanceCostSummaries({
    projectNo: query.projectNo.trim() || undefined,
    vehiclem: query.vehiclem.trim() || undefined,
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
  query.projectNo = "";
  query.vehiclem = "";
}

function openBatch(row: AdsCostSummary) {
  router.push({
    path: "/data-governance/batches",
    query: { batchNo: row.batchNo },
  });
}
</script>

<template>
  <PageContainer
    class="governance-page"
    title="ADS 成本结果"
    description="查看治理后发布的项目成本汇总及其质量状态和来源批次。"
  >
    <QueryTable
      :func="querySummaries"
      fit-table-height
      empty-title="暂无成本结果"
      empty-description="当前筛选条件下没有可展示的 ADS 成本结果。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="项目代号">
            <el-input
              v-model="query.projectNo"
              clearable
              placeholder="请输入项目代号"
            />
          </el-form-item>
          <el-form-item label="整编编号">
            <el-input
              v-model="query.vehiclem"
              clearable
              placeholder="请输入整编编号"
            />
          </el-form-item>
        </el-form>
      </template>
      <el-table-column
        prop="bizDate"
        label="业务日期"
        width="115"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="projectNo"
        label="项目代号"
        min-width="120"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="vehiclem"
        label="整编编号"
        min-width="120"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="材料成本" min-width="130" align="right">
        <template #default="{ row }"
          ><BaseMoney :value="row.materialCost" empty-text="-"
        /></template>
      </el-table-column>
      <el-table-column label="采购成本" min-width="130" align="right">
        <template #default="{ row }"
          ><BaseMoney :value="row.purchaseCost" empty-text="-"
        /></template>
      </el-table-column>
      <el-table-column label="配额成本" min-width="130" align="right">
        <template #default="{ row }"
          ><BaseMoney :value="row.quotaCost" empty-text="-"
        /></template>
      </el-table-column>
      <el-table-column label="其他成本" min-width="130" align="right">
        <template #default="{ row }"
          ><BaseMoney :value="row.otherCost" empty-text="-"
        /></template>
      </el-table-column>
      <el-table-column label="总成本" min-width="140" align="right">
        <template #default="{ row }"
          ><strong><BaseMoney :value="row.totalCost" empty-text="-" /></strong
        ></template>
      </el-table-column>
      <el-table-column
        prop="partCount"
        label="零件数"
        width="100"
        align="right"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="质量状态" width="110">
        <template #default="{ row }"
          ><GovernanceStatusTag :status="row.qualityStatus"
        /></template>
      </el-table-column>
      <el-table-column label="批次号" min-width="190">
        <template #default="{ row }">
          <el-button link @click="openBatch(row)">{{
            formatGovernanceValue(row.batchNo)
          }}</el-button>
        </template>
      </el-table-column>
      <el-table-column label="生成时间" min-width="170">
        <template #default="{ row }"
          ><BaseDateTime :value="row.createTime" empty-text="-"
        /></template>
      </el-table-column>
    </QueryTable>
  </PageContainer>
</template>
