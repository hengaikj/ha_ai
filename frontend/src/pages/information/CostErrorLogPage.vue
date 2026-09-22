<script setup lang="ts">
import { Download } from "@element-plus/icons-vue";
import { onMounted, reactive, ref } from "vue";
import {
  createCostErrorLogExportTask,
  fetchCostErrorLogDetail,
  fetchCostErrorLogValveOptions,
  fetchCostErrorLogs,
} from "@/api/cost-center";
import BaseDetailDescriptions from "@/components/base/BaseDetailDescriptions.vue";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { resolvePageTotal } from "@/utils/pagination";
import type { CostErrorLogItem } from "@/types/cost-center";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type CostErrorLogQuery = {
  projectName: string;
  valveName: string | number;
  createdAtRange: string[];
};

type CostErrorLogRow = CostErrorLogItem & {
  createBy: string;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const query = reactive<CostErrorLogQuery>({
  projectName: "",
  valveName: "",
  createdAtRange: [],
});
const valveOptions = ref<{ label: string; value: string | number }[]>([]);
const exportLoading = ref(false);
const detailLoading = ref(false);
const detailVisible = ref(false);
const currentDetail = ref<CostErrorLogItem | null>(null);

async function queryLogs(pageSize: number, pageNo: number) {
  const [beginDate, endDate] = query.createdAtRange;
  const page = await fetchCostErrorLogs({
    projectName: query.projectName.trim() || undefined,
    valveName: query.valveName || undefined,
    createdFrom: beginDate ? `${beginDate} 00:00:00` : undefined,
    createdTo: endDate ? `${endDate} 23:59:59` : undefined,
    pageNo,
    pageSize,
  });
  const list: CostErrorLogRow[] = page.records.map((item) => ({
    ...item,
    createBy:
      ((item as Record<string, unknown>).createBy as string) ??
      ((item as Record<string, unknown>).createdByName as string) ??
      ((item as Record<string, unknown>).createdBy as string) ??
      "",
  }));
  return {
    total: resolvePageTotal(page, pageNo, pageSize),
    list,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function resetQuery() {
  query.projectName = "";
  query.valveName = "";
  query.createdAtRange = [];
}

function searchLogs() {
  queryTableRef.value?.search();
}

async function loadValveOptions() {
  valveOptions.value = await fetchCostErrorLogValveOptions();
}

function currentFilter() {
  const [beginDate, endDate] = query.createdAtRange;
  return {
    projectName: query.projectName.trim() || undefined,
    valveName: query.valveName || undefined,
    createdFrom: beginDate ? `${beginDate} 00:00:00` : undefined,
    createdTo: endDate ? `${endDate} 23:59:59` : undefined,
  };
}

async function exportLogs() {
  exportLoading.value = true;
  try {
    const task = await createCostErrorLogExportTask(currentFilter());
    BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
  } finally {
    exportLoading.value = false;
  }
}

async function showDetail(row: CostErrorLogRow) {
  detailLoading.value = true;
  try {
    currentDetail.value = await fetchCostErrorLogDetail(row.errorLogId);
    detailVisible.value = true;
  } finally {
    detailLoading.value = false;
  }
}

function detailItems() {
  const detail = currentDetail.value;
  return [
    { label: "项目代号", value: detail?.businessCode },
    { label: "阀点", value: detail?.businessName },
    { label: "创建人", value: detail?.createBy },
    { label: "创建时间", value: detail?.createdAt },
    { label: "报错信息", value: detail?.errorMessage, span: 2 },
  ];
}

onMounted(loadValveOptions);
</script>

<template>
  <PageContainer
    title="成本报错日志"
    description="查看成本导入、同步和计算过程中的异常日志。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryLogs"
      row-key="errorLogId"
      fit-table-height
      empty-title="暂无报错日志"
      empty-description="当前条件下没有可展示的成本报错日志。"
      @reset="resetQuery"
    >
      <template #toolbar>
        <PermissionButton
          permission="system:log:export"
          variant="secondary"
          plain
          type="warning"
          :loading="exportLoading"
          @click="exportLogs"
          :icon="Download"
        >
          导出
        </PermissionButton>
      </template>

      <template #search>
        <el-form :model="query">
          <el-form-item label="项目代号">
            <el-input
              v-model="query.projectName"
              clearable
              placeholder="请输入项目代号"
              @keyup.enter="searchLogs"
            />
          </el-form-item>
          <el-form-item label="阀点">
            <el-select
              v-model="query.valveName"
              clearable
              placeholder="请选择"
            >
              <el-option label="全部" value="" />
              <el-option
                v-for="item in valveOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdAtRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
            />
          </el-form-item>
        </el-form>
      </template>

      <el-table-column type="selection" width="55" align="center" />
      <el-table-column type="index" label="序号" width="70" />
      <el-table-column
        prop="businessCode"
        label="项目代号"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column
        prop="businessName"
        label="阀点"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="errorMessage"
        label="报错信息"
        min-width="260"
        show-overflow-tooltip
      />
      <el-table-column
        prop="createBy"
        label="创建人"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column label="创建时间" width="140">
        <template #default="{ row }">
          {{ row.createdAt ?? "-" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="system:log:query"
            link
            :loading="detailLoading"
            @click="showDetail(row)"
          >
            查看
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseDrawer
      v-model="detailVisible"
      title="查看成本报错日志"
      size="680px"
      :show-footer="false"
    >
      <BaseDetailDescriptions :items="detailItems()" />
    </BaseDrawer>
  </PageContainer>
</template>
