<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back, Download } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import { replaceToReturn } from "@/utils/return-navigation";
import QueryTable from "@/components/business/QueryTable.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import {
  createPurchaseBomSourcePartExportTask,
  fetchPurchaseBomSourceParts,
} from "@/api/cost-center";
import type { PurchaseBomSourcePartItem } from "@/types/cost-center";

const route = useRoute();
const router = useRouter();
const activeTaskId = ref("");

const projectId = computed(() => Number(route.query.projectId));
const purchaseBomId = computed(() => Number(route.query.purchaseBomId));
const projectName = computed(() =>
  readRouteQueryString(route.query.projectName),
);
const reorganizeCode = computed(() =>
  readRouteQueryString(route.query.reorganizeCode),
);
const reorganizeName = computed(() =>
  readRouteQueryString(route.query.reorganizeName),
);

const sourceQuery = reactive({
  partNo: "",
  partName: "",
  sorName: "",
  generalLevel: "",
  partType: "",
  createdRange: [] as string[],
});

async function loadSourceParts(pageSize: number, pageNum: number) {
  const page = await fetchPurchaseBomSourceParts(undefined, undefined, {
    reorganizeCode: reorganizeCode.value || undefined,
    partNo: sourceQuery.partNo || undefined,
    partName: sourceQuery.partName || undefined,
    sorName: sourceQuery.sorName || undefined,
    generalLevel: sourceQuery.generalLevel || undefined,
    partType: sourceQuery.partType || undefined,
    createdAtStart: sourceQuery.createdRange?.[0],
    createdAtEnd: sourceQuery.createdRange?.[1],
    pageNo: pageNum,
    pageSize,
  });
  return {
    total: page.total ?? 0,
    list: page.records as PurchaseBomSourcePartItem[],
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function resetSourcePartQuery() {
  sourceQuery.partNo = "";
  sourceQuery.partName = "";
  sourceQuery.sorName = "";
  sourceQuery.generalLevel = "";
  sourceQuery.partType = "";
  sourceQuery.createdRange = [];
}

async function exportSourceParts() {
  const task = await createPurchaseBomSourcePartExportTask(
    projectId.value,
    purchaseBomId.value,
    {
      projectName: projectName.value || undefined,
      reorganizeCode: reorganizeCode.value || undefined,
      partNo: sourceQuery.partNo || undefined,
      partName: sourceQuery.partName || undefined,
      sorName: sourceQuery.sorName || undefined,
      generalLevel: sourceQuery.generalLevel || undefined,
      partType: sourceQuery.partType || undefined,
      createdAtStart: sourceQuery.createdRange?.[0],
      createdAtEnd: sourceQuery.createdRange?.[1],
      remark: `导出${reorganizeName.value || reorganizeCode.value || ""}来源零件`,
    },
  );
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

function goBack() {
  replaceToReturn(router, route, "/cost/bom/purchase-list/reorganize");
}

function readRouteQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }
  return typeof value === "string" ? value : "";
}
</script>

<template>
  <PageContainer class="purchase-bom-source-parts-container" title="查看零件">
    <template #titleExtra>
      <div class="purchase-bom-source-parts-page__summary">
        <span
          >整编编号：<span>{{ reorganizeCode || "--" }}</span></span
        >
        <span
          >整编名称：<span>{{ reorganizeName || "--" }}</span></span
        >
      </div>
    </template>

    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack"
        >返回</PermissionButton
      >
    </template>

    <section class="purchase-bom-source-parts-page">
      <QueryTable
        class="purchase-bom-source-parts-page__table"
        :func="loadSourceParts"
        row-key="sourcePartId"
        show-toolbar
        fit-table-height
        empty-title="暂无零件数据"
        empty-description="当前整编下暂无符合条件的来源零件。"
        @reset="resetSourcePartQuery"
      >
        <template #search>
          <el-form :model="sourceQuery">
            <el-form-item label="零件号">
              <el-input
                v-model="sourceQuery.partNo"
                clearable
                placeholder="请输入零件号"
              />
            </el-form-item>
            <el-form-item label="零件名称">
              <el-input
                v-model="sourceQuery.partName"
                clearable
                placeholder="请输入零件名称"
              />
            </el-form-item>
            <el-form-item label="SOR名称">
              <el-input
                v-model="sourceQuery.sorName"
                clearable
                placeholder="SOR名称"
              />
            </el-form-item>
            <el-form-item label="通用化级别">
              <el-input
                v-model="sourceQuery.generalLevel"
                clearable
                placeholder="请输入通用化级别"
              />
            </el-form-item>
            <el-form-item label="是否架构件">
              <el-select
                v-model="sourceQuery.partType"
                clearable
                placeholder="全部"
              >
                <el-option label="全部" value="" />
                <el-option label="是" value="0" />
                <el-option label="否" value="1" />
              </el-select>
            </el-form-item>
            <el-form-item label="创建时间">
              <el-date-picker
                v-model="sourceQuery.createdRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-form>
        </template>

        <template #toolbar>
          <PermissionButton
            permission="manage:look:export"
            variant="secondary"
            :icon="Download"
            @click="exportSourceParts"
          >
            导出
          </PermissionButton>
        </template>

        <el-table-column type="selection" width="48" fixed="left" />
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="partNo" label="零件号" min-width="150" />
        <el-table-column prop="partName" label="零件名称" min-width="180" />
        <el-table-column
          prop="pathQuantity"
          label="单车用量"
          min-width="120"
          align="center"
        />
        <el-table-column prop="unitCode" label="基本单位" min-width="110" />
        <el-table-column
          prop="modelUserd1st"
          label="零件首用平台"
          min-width="150"
        />
        <el-table-column prop="sorNum" label="SOR名称" min-width="150" />
        <el-table-column
          prop="engineerIncharge"
          label="责任工程师"
          min-width="130"
        />
        <el-table-column prop="sogForSug" label="建议货源" min-width="150" />
        <el-table-column prop="respDept" label="责任部门" min-width="130" />
        <el-table-column
          prop="pendingGeneralLevel"
          label="通用化级别"
          min-width="130"
        />
        <el-table-column prop="partType" label="是否架构件" min-width="130" />
        <el-table-column
          prop="ecnProcessNum"
          label="ECN处理编号"
          min-width="150"
        />
        <el-table-column prop="partCategory" label="零件类别" min-width="130" />
        <el-table-column prop="createBy" label="创建人" min-width="130" />
        <el-table-column prop="createTime" label="创建时间" min-width="160" />
      </QueryTable>
    </section>
    <TaskStatusPanel v-if="false" :task-id="activeTaskId" />
  </PageContainer>
</template>

<style scoped>
.purchase-bom-source-parts-page {
  min-height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) - 96px
  );
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: hidden;
}

.purchase-bom-source-parts-page__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  color: var(--bq-color-text-secondary);
  line-height: 24px;
  font-size: 14px;
}

.purchase-bom-source-parts-page__table {
  min-height: 0;
}

.purchase-bom-source-parts-page__table
  :deep(.base-search-form__content .el-form) {
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  row-gap: 14px;
  column-gap: 16px;
}

.purchase-bom-source-parts-page__table :deep(.base-toolbar) {
  min-height: 38px;
  padding: 6px 0 10px;
  border: 0;
}

@media (max-width: 1100px) {
  .purchase-bom-source-parts-page__table
    :deep(.base-search-form__content .el-form) {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }
}

@media (max-width: 720px) {
  .purchase-bom-source-parts-page__table
    :deep(.base-search-form__content .el-form) {
    grid-template-columns: 1fr;
  }
}
</style>
