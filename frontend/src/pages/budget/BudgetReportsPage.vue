<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useRouter } from "vue-router";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import { fetchBudgetWorkbenchItems } from "@/api/budget";
import type {
  BackendId,
  BudgetWorkbenchItem,
  BudgetWorkbenchPageType,
} from "@/types/budget";

type ReportRow = {
  id: string;
  pageType: BudgetWorkbenchPageType;
  itemId: BackendId;
  projectId: BackendId;
  valveId?: BackendId | null;
  projectName: string;
  valvePoint: string;
  stageName: string;
  reportType: string;
  reportStatus: string;
};

const router = useRouter();

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
  const rows = [
    ...initiationPage.records.map((item) => toReportRow(item, "initiation")),
    ...gateReviewPage.records.map((item) => toReportRow(item, "gate-review")),
  ];
  const start = (pageNo - 1) * pageSize;
  return {
    total: rows.length,
    list: rows.slice(start, start + pageSize),
    pageNo,
    pageSize,
  };
}

function toReportRow(
  item: BudgetWorkbenchItem,
  pageType: BudgetWorkbenchPageType,
): ReportRow {
  return {
    id: `${pageType}-${item.id}`,
    pageType,
    itemId: item.id,
    projectId: item.projectId,
    valveId: item.valveId,
    projectName: item.projectName,
    valvePoint: item.valvePoint || "--",
    stageName: pageType === "gate-review" ? "过阀评审" : "立项评审",
    reportType: pageType === "gate-review" ? "自评/品牌评审表" : "立项评审表",
    reportStatus: item.reportStatus,
  };
}

function openReport(row: ReportRow) {
  void router.push({
    path:
      row.pageType === "gate-review"
        ? "/budget/wbs/cliquecreatereportforms"
        : "/budget/wbs/createreportforms",
    query: {
      projectId: row.projectId,
      valveId: row.valveId ?? undefined,
      itemId: row.itemId,
    },
  });
}
</script>

<template>
  <PageContainer
    title="预算报表"
    description="集中查看立项评审、过阀评审的评审表生成入口。"
  >
    <QueryTable
      :func="queryRows"
      row-key="id"
      fit-table-height
      :show-search="false"
      empty-title="暂无预算报表"
      empty-description="当前没有可生成评审表的预算数据。"
    >
      <el-table-column prop="stageName" label="阶段" width="120" />
      <el-table-column prop="projectName" label="项目代号" min-width="190" />
      <el-table-column prop="valvePoint" label="阀点" width="110" />
      <el-table-column prop="reportType" label="报表类型" min-width="170" />
      <el-table-column prop="reportStatus" label="报表状态" width="130" />
      <el-table-column label="操作" width="140" fixed="right" align="center">
        <template #default="{ row }: { row: ReportRow }">
            <PermissionButton link type="primary" @click="openReport(row)"
              >生成报表</PermissionButton
            >
        </template>
      </el-table-column>
    </QueryTable>
  </PageContainer>
</template>
