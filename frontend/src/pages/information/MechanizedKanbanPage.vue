<script setup lang="ts">
import { ref } from "vue";
import { Upload } from "@element-plus/icons-vue";
import type { UploadFile } from "element-plus";
import {
  fetchKanbanMechanized,
  importKanbanMechanized,
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

const pageTitle = "综采数据";
const pageDescription = "旧系统综采数据看板。";

async function queryRows(pageSize: number, pageNo: number) {
  const page = await fetchKanbanMechanized({ pageNo, pageSize });
  return {
    total: resolvePageTotal(page, pageNo, pageSize),
    list: page.records,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function downloadImportTemplate() {
  downloadLocalTemplate("综采看板-数据导入模版.xlsx");
}

async function handleImport(uploadFile: UploadFile) {
  const file = uploadFile.raw;
  if (!file) {
    BaseToast.warning("请选择需要导入的文件");
    return;
  }
  importLoading.value = true;
  try {
    const task = await importKanbanMechanized(file);
    importDialogVisible.value = false;
    BaseToast.success(`导入任务已创建：${task.taskNo || task.taskId}`);
  } finally {
    importLoading.value = false;
  }
}
</script>

<template>
  <PageContainer
    :title="pageTitle"
    :description="pageDescription"
    hide-title
  >
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
          permission="system:comprehensive:import"
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
        label="公司"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="businessLine"
        label="采购业务线"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="orderNo"
        label="申请单号"
        min-width="180"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="procurementAmount"
        label="采购额"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="procurementResultAmount"
        label="采购结果报告金额"
        min-width="190"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="costReductionAmount"
        label="降本额"
        min-width="140"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="costReductionRate"
        label="降本率"
        min-width="120"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="requirementConfirmationDate"
        label="需求确认日期"
        min-width="150"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="procurementResultsEndDate"
        label="采购结果结束日期"
        min-width="160"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="procurementResultsEndMonth"
        label="采购结果结束月"
        min-width="150"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="procurementAmountCompletionRate"
        label="节假日周期（法定节假日周期）"
        min-width="260"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="procurementCycle"
        label="采购周期"
        min-width="120"
        align="center"
        show-overflow-tooltip
      />
    </QueryTable>

    <BaseImportDialog
      v-model="importDialogVisible"
      :module-name="pageTitle"
      :loading="importLoading"
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
