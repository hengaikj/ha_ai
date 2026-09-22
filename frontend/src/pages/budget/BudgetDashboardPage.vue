<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import BaseMoney from "@/components/base/BaseMoney.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import { fetchBudgetWorkbenchItems } from "@/api/budget";
import type {
  BackendId,
  BudgetWorkbenchItem,
  BudgetWorkbenchPageType,
} from "@/types/budget";

type DashboardRow = {
  id: string;
  pageType: BudgetWorkbenchPageType;
  projectId: BackendId;
  projectCode: string;
  projectName: string;
  valvePoint: string;
  versionId: BackendId;
  stageName: string;
  budgetAmount: string | number | null;
  assessmentAmount: string | number | null;
  versionStatus: string;
  updatedAt: string;
};

const router = useRouter();
const rows = ref<DashboardRow[]>([]);

const summary = computed(() => {
  const totalBudget = rows.value.reduce(
    (sum, item) => sum + Number(item.budgetAmount ?? 0),
    0,
  );
  const totalAssessment = rows.value.reduce(
    (sum, item) => sum + Number(item.assessmentAmount ?? 0),
    0,
  );
  return [
    {
      label: "项目数",
      value: new Set(rows.value.map((item) => item.projectId)).size,
    },
    { label: "版本数", value: rows.value.length },
    { label: "预算金额", value: totalBudget },
    { label: "评估金额", value: totalAssessment },
  ];
});

async function queryRows(pageSize: number, pageNo: number) {
  const [initiationPage, gateReviewPage] = await Promise.all([
    fetchBudgetWorkbenchItems({
      pageType: "initiation",
      pageNo: 1,
      pageSize: 100,
    }),
    fetchBudgetWorkbenchItems({
      pageType: "gate-review",
      pageNo: 1,
      pageSize: 100,
    }),
  ]);
  rows.value = [
    ...initiationPage.records.map((item) => toDashboardRow(item, "initiation")),
    ...gateReviewPage.records.map((item) =>
      toDashboardRow(item, "gate-review"),
    ),
  ];
  const start = (pageNo - 1) * pageSize;
  const list = rows.value.slice(start, start + pageSize);
  return {
    total: rows.value.length,
    list,
    pageNo,
    pageSize,
  };
}

function toDashboardRow(
  item: BudgetWorkbenchItem,
  pageType: BudgetWorkbenchPageType,
): DashboardRow {
  return {
    id: `${pageType}-${item.id}`,
    pageType,
    projectId: item.projectId,
    projectCode: item.projectCode,
    projectName: item.projectName,
    valvePoint: item.valvePoint || "--",
    versionId: item.versionId,
    stageName: pageType === "gate-review" ? "过阀评审" : "立项评审",
    budgetAmount: item.budgetAmount ?? null,
    assessmentAmount: item.assessmentAmount ?? null,
    versionStatus: item.versionStatus,
    updatedAt: item.updatedAt || "",
  };
}

function openWorkbench(row: DashboardRow) {
  void router.push(
    row.pageType === "gate-review"
      ? "/budget/gate-review"
      : "/budget/initiation",
  );
}
</script>

<template>
  <PageContainer
    title="预算看板"
    description="汇总立项评审、过阀评审的预算版本和金额状态。"
  >
    <div class="budget-dashboard__summary">
      <div
        v-for="item in summary"
        :key="item.label"
        class="budget-dashboard__summary-item"
      >
        <span>{{ item.label }}</span>
        <strong v-if="item.label.includes('金额')">
          <BaseMoney :value="item.value" />
        </strong>
        <strong v-else>{{ item.value }}</strong>
      </div>
    </div>

    <QueryTable
      :func="queryRows"
      row-key="id"
      fit-table-height
      :show-search="false"
      empty-title="暂无预算看板数据"
      empty-description="当前没有可汇总的预算版本。"
    >
      <el-table-column prop="stageName" label="阶段" width="120" />
      <el-table-column prop="projectCode" label="项目代号" min-width="130" />
      <el-table-column prop="projectName" label="项目代号" min-width="180" />
      <el-table-column prop="valvePoint" label="阀点" width="110" />
      <el-table-column prop="versionId" label="版本ID" width="120" />
      <el-table-column label="预算金额" width="150" align="right">
        <template #default="{ row }: { row: DashboardRow }">
          <BaseMoney :value="row.budgetAmount" />
        </template>
      </el-table-column>
      <el-table-column label="评估金额" width="150" align="right">
        <template #default="{ row }: { row: DashboardRow }">
          <BaseMoney :value="row.assessmentAmount" />
        </template>
      </el-table-column>
      <el-table-column prop="versionStatus" label="版本状态" width="130" />
      <el-table-column label="操作" width="120" fixed="right" align="center">
        <template #default="{ row }: { row: DashboardRow }">
            <PermissionButton link type="primary" @click="openWorkbench(row)"
              >查看</PermissionButton
            >
        </template>
      </el-table-column>
    </QueryTable>
  </PageContainer>
</template>

<style scoped>
.budget-dashboard__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.budget-dashboard__summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color);
}

.budget-dashboard__summary-item span {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.budget-dashboard__summary-item strong {
  color: var(--el-text-color-primary);
  font-size: 20px;
  font-weight: 600;
}

@media (max-width: 960px) {
  .budget-dashboard__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
