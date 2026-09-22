<script setup lang="ts">
import { ref } from "vue";
import { Upload } from "@element-plus/icons-vue";
import type { UploadFile } from "element-plus";
import {
  fetchKanbanCurrentProduction,
  importKanbanCurrentProduction,
} from "@/api/information-management";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { downloadLocalTemplate } from "@/utils/download-template";
import { resolvePageTotal } from "@/utils/pagination";

const importDialogVisible = ref(false);
const importLoading = ref(false);
const activeTaskId = ref("");

const pageTitle = "在产数据";
const pageDescription = "旧系统在产数据看板。";

async function queryRows(pageSize: number, pageNo: number) {
  const page = await fetchKanbanCurrentProduction({ pageNo, pageSize });
  return {
    total: resolvePageTotal(page, pageNo, pageSize),
    list: page.records,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function downloadImportTemplate() {
  downloadLocalTemplate(
    "\u770b\u677f-\u5728\u4ea7\u6570\u636e\u6a21\u7248.xlsx",
  );
}

async function handleImport(uploadFile: UploadFile) {
  const file = uploadFile.raw;
  if (!file) {
    BaseToast.warning("请选择需要导入的文件");
    return;
  }
  importLoading.value = true;
  try {
    const task = await importKanbanCurrentProduction(file);
    importDialogVisible.value = false;
    BaseToast.success(`导入任务已创建：${task.taskNo || task.taskId}`);
  } finally {
    importLoading.value = false;
  }
}
</script>

<template>
  <PageContainer :title="pageTitle" :description="pageDescription">
    <QueryTable
      :func="queryRows"
      row-key="id"
      fit-table-height
      :table-props="{ scrollbarAlwaysOn: true }"
      :show-search="false"
      empty-title="暂无看板数据"
      empty-description="当前没有可展示的看板数据。"
    >
      <template #toolbar>
        <PermissionButton
          permission="system:production:car:import"
          plain
          :icon="Upload"
          @click="importDialogVisible = true"
        >
          导入
        </PermissionButton>
        <!--        <PermissionButton-->
        <!--          :permission="`${permissionPrefix}:import`"-->
        <!--          plain-->
        <!--          :icon="Download"-->
        <!--          @click="downloadImportTemplate"-->
        <!--        >-->
        <!--          模板下载-->
        <!--        </PermissionButton>-->
      </template>

      <el-table-column type="index" label="序号" width="70" align="center" />
      <el-table-column
        prop="company"
        label="集团"
        min-width="160"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="subCompany"
        label="子公司"
        min-width="160"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="status"
        label="信息状态"
        min-width="120"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="brand"
        label="品牌"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="carModel"
        label="车型"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="versionType"
        label="版型"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="salesVolume"
        label="销量（台）"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="salesCompletionRate"
        label="销量完成率"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="operatingIncome"
        label="营业收入（万元）"
        min-width="160"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="revenueCompletionRate"
        label="营收完成率"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="totalProfit"
        label="利润总额（万元）"
        min-width="160"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="profitCompletionRate"
        label="利润完成率"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="profitMargin"
        label="利润率"
        min-width="120"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="marginalContribution"
        label="边际贡献（万元）"
        min-width="160"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="marginalContributionRate"
        label="边际贡献率"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="msrp"
        label="MSRP（市场指导价）"
        min-width="180"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="tp"
        label="TP（实际成交价）"
        min-width="160"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="cost"
        label="成本（万元）"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="createTime"
        label="创建时间"
        min-width="180"
        align="center"
        show-overflow-tooltip
      />
    </QueryTable>

    <BaseImportDialog
      v-model="importDialogVisible"
      :module-name="pageTitle"
      :loading="importLoading"
      accept=".xlsx,.xls"
      template-text="下载导入模板"
      template-title="下载模板"
      template-description="请按照要求导入标准 Excel 文件"
      upload-tip="只能上传 xlsx 格式文件，且不超过 20MB"
      @import="handleImport"
      @download-template="downloadImportTemplate"
    />
    <TaskStatusPanel v-if="false" :task-id="activeTaskId" />
  </PageContainer>
</template>
