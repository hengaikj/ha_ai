<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
import { computed, reactive, ref } from "vue";
import { Download, Refresh, Search, Upload } from "@element-plus/icons-vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseMoney from "@/components/base/BaseMoney.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { downloadLocalTemplate } from "@/utils/download-template";
import {
  createPurchaseMeetingPrice,
  createPurchaseMeetingPriceExportTask,
  createPurchaseMeetingPriceImportTask,
  deletePurchaseMeetingPrice,
  fetchPurchaseMeetingPrices,
  updatePurchaseMeetingPrice,
} from "@/api/cost-center";
import type { UploadFile } from "element-plus";
import type { PurchaseMeetingPriceItem } from "@/types/cost-center";

type MeetingImportQuery = {
  partNo: string;
  partName: string;
  meetingNo: string;
};
const activeTaskId = ref("");

type MeetingImportRow = {
  id: number;
  version: number;
  meetingDate: string;
  meetingNo: string;
  annualMeetingNo: string;
  sorEcn: string;
  vehicleModel: string;
  purchaseBusinessLine: string;
  purchaseMajor: string;
  issueType: string;
  partNo: string;
  partName: string;
  supplier: string;
  factoryPrice: number;
  packageFee: number;
  logisticsFee: number;
  taxExcludedAmortizedPrice: number;
  amortizedToolingMoldFee: number;
  amortizedTechDevelopmentFee: number;
  inboundUnitPrice: number;
  paidToolingMoldFee: number;
  paidTechDevelopmentFee: number;
  toolingMoldFee: number;
  techDevelopmentFee: number;
  amortizedQuantity: number;
  executeStartDate: string;
  executeEndDate: string;
  remark: string;
};

type QueryTableExpose = {
  search: () => void;
  reload: () => void;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const query = reactive<MeetingImportQuery>({
  partNo: "",
  partName: "",
  meetingNo: "",
});

const selectedRows = ref<MeetingImportRow[]>([]);
const editDialogVisible = ref(false);
const editingRowId = ref<number | null>(null);
const editForm = reactive<MeetingImportRow>(createEmptyMeetingImportRow());
const deleteConfirmVisible = ref(false);
const deleteLoading = ref(false);
const deletingRow = ref<MeetingImportRow | null>(null);
const importDialogVisible = ref(false);
const importLoading = ref(false);

const selectedCountText = computed(() =>
  selectedRows.value.length > 0 ? `已选择 ${selectedRows.value.length} 项` : "",
);
const deleteConfirmMessage = computed(() =>
  deletingRow.value
    ? `确认删除采购上会价格「${deletingRow.value.id}」？删除后列表不再展示该记录。`
    : "确认删除当前采购上会价格？删除后列表不再展示该记录。",
);

function createEmptyMeetingImportRow(): MeetingImportRow {
  return {
    id: 0,
    version: 0,
    meetingDate: "",
    meetingNo: "",
    annualMeetingNo: "",
    sorEcn: "",
    vehicleModel: "",
    purchaseBusinessLine: "",
    purchaseMajor: "",
    issueType: "",
    partNo: "",
    partName: "",
    supplier: "",
    factoryPrice: 0,
    packageFee: 0,
    logisticsFee: 0,
    taxExcludedAmortizedPrice: 0,
    amortizedToolingMoldFee: 0,
    amortizedTechDevelopmentFee: 0,
    inboundUnitPrice: 0,
    paidToolingMoldFee: 0,
    paidTechDevelopmentFee: 0,
    toolingMoldFee: 0,
    techDevelopmentFee: 0,
    amortizedQuantity: 0,
    executeStartDate: "",
    executeEndDate: "",
    remark: "",
  };
}

async function queryMeetingImports(pageSize: number, pageNum: number) {
  const page = await fetchPurchaseMeetingPrices({
    partNo: readText(query.partNo),
    partName: readText(query.partName),
    meetingNo: readText(query.meetingNo),
    pageNo: pageNum,
    pageSize,
  });

  return {
    total: page.total ?? 0,
    list: page.records.map(toMeetingImportRow),
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function toMeetingImportRow(item: PurchaseMeetingPriceItem): MeetingImportRow {
  return {
    id: item.purchaseMeetingPriceId,
    version: item.version,
    meetingDate: item.meetingDate || "",
    meetingNo: item.meetingNo || "",
    annualMeetingNo: item.yearMeetingNo || "",
    sorEcn: item.pricingBasis || "",
    vehicleModel: item.vehicleModel || "",
    purchaseBusinessLine: item.purchaseBusinessLine || "",
    purchaseMajor: item.purchaseMajor || "",
    issueType: item.topicType || "",
    partNo: item.partNo,
    partName: item.partName || "",
    supplier: item.supplier || "",
    factoryPrice: toNumber(item.exFactoryPrice),
    packageFee: toNumber(item.packingFee),
    logisticsFee: toNumber(item.logisticsFee),
    taxExcludedAmortizedPrice: toNumber(item.noAmortizationPrice),
    amortizedToolingMoldFee: toNumber(item.toolingAmortizationFee),
    amortizedTechDevelopmentFee: toNumber(item.techDevAmortizationFee),
    inboundUnitPrice: toNumber(item.factoryUnitPrice),
    paidToolingMoldFee: toNumber(item.paymentToolingFee),
    paidTechDevelopmentFee: toNumber(item.paymentTechDevFee),
    toolingMoldFee: toNumber(item.amortizationToolingFee),
    techDevelopmentFee: toNumber(item.amortizationTechDevFee),
    amortizedQuantity: toNumber(item.amortizationQuantity),
    executeStartDate: item.effectiveStartDate || "",
    executeEndDate: item.effectiveEndDate || "",
    remark: item.remark || "",
  };
}

function resetQuery() {
  Object.assign(query, {
    partNo: "",
    partName: "",
    meetingNo: "",
  });
}

function searchMeetingImports() {
  queryTableRef.value?.search();
}

function refreshMeetingImports() {
  queryTableRef.value?.reload();
}

function handleSelectionChange(rows: MeetingImportRow[]) {
  selectedRows.value = rows;
}

function openImportDialog() {
  importDialogVisible.value = true;
}

async function handleImport(file: UploadFile) {
  const rawFile = file.raw;
  if (!rawFile) {
    BaseToast.warning("请选择需要导入的文件");
    return;
  }
  importLoading.value = true;
  try {
    const task = await createPurchaseMeetingPriceImportTask({
      file: rawFile,
      sourceBatchNo: `PMP-${Date.now()}`,
      remark: rawFile.name,
    });
    activeTaskId.value = task.taskId;
    importDialogVisible.value = false;
    BaseToast.success(`导入任务已创建：${task.taskNo || task.taskId}`);
    queryTableRef.value?.reload();
  } finally {
    importLoading.value = false;
  }
}

function handleDownloadTemplate() {
  downloadLocalTemplate(
    "\u4e0a\u4f1a\u4ef7\u683c-\u5bfc\u5165\u6a21\u677f.xlsx",
  );
}

function openEditDialog(row: MeetingImportRow) {
  editingRowId.value = row.id;
  Object.assign(editForm, row);
  editDialogVisible.value = true;
}

async function saveEditForm() {
  if (editingRowId.value) {
    await updatePurchaseMeetingPrice(
      editingRowId.value,
      toMeetingPayload(editForm),
    );
  } else {
    await createPurchaseMeetingPrice(toMeetingPayload(editForm));
  }
  editDialogVisible.value = false;
  BaseToast.success("上会价已保存");
  queryTableRef.value?.reload();
}

function openDeleteConfirm(row: MeetingImportRow) {
  deletingRow.value = row;
  deleteConfirmVisible.value = true;
}

async function confirmDelete() {
  if (deleteLoading.value || !deletingRow.value) {
    deleteConfirmVisible.value = false;
    return;
  }

  const deletingId = deletingRow.value.id;
  deleteLoading.value = true;
  try {
    await deletePurchaseMeetingPrice(deletingId);
    selectedRows.value = selectedRows.value.filter(
      (row) => row.id !== deletingId,
    );
    deleteConfirmVisible.value = false;
    deletingRow.value = null;
    BaseToast.success("上会价已删除");
    queryTableRef.value?.reload();
  } finally {
    deleteLoading.value = false;
  }
}

async function exportMeetingImports() {
  const task = await createPurchaseMeetingPriceExportTask({
    partNo: readText(query.partNo),
    partName: readText(query.partName),
    meetingNo: readText(query.meetingNo),
  });
  activeTaskId.value = task.taskId;
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

function toMeetingPayload(row: MeetingImportRow) {
  return {
    meetingNo: row.meetingNo,
    yearMeetingNo: row.annualMeetingNo,
    meetingDate: row.meetingDate,
    pricingBasis: row.sorEcn,
    vehicleModel: row.vehicleModel,
    purchaseBusinessLine: row.purchaseBusinessLine,
    purchaseMajor: row.purchaseMajor,
    topicType: row.issueType,
    partNo: row.partNo,
    partName: row.partName,
    supplier: row.supplier,
    exFactoryPrice: row.factoryPrice,
    packingFee: row.packageFee,
    logisticsFee: row.logisticsFee,
    noAmortizationPrice: row.taxExcludedAmortizedPrice,
    toolingAmortizationFee: row.amortizedToolingMoldFee,
    techDevAmortizationFee: row.amortizedTechDevelopmentFee,
    factoryUnitPrice: row.inboundUnitPrice,
    paymentToolingFee: row.paidToolingMoldFee,
    paymentTechDevFee: row.paidTechDevelopmentFee,
    amortizationToolingFee: row.toolingMoldFee,
    amortizationTechDevFee: row.techDevelopmentFee,
    amortizationQuantity: row.amortizedQuantity,
    effectiveStartDate: row.executeStartDate,
    effectiveEndDate: row.executeEndDate,
    remark: row.remark,
    version: row.version,
  };
}

function readText(value: string) {
  return value.trim() || undefined;
}

function toNumber(value?: string | null) {
  return value ? Number(value) : 0;
}
</script>

<template>
  <PageContainer class="meeting-import-page" title="上会价格导入">
    <QueryTable
      ref="queryTableRef"
      :func="queryMeetingImports"
      row-key="id"
      show-toolbar
      fit-table-height
      :table-props="{ onSelectionChange: handleSelectionChange }"
      empty-title="暂无上会价数据"
      empty-description="当前筛选条件下没有可展示的上会价导入数据。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="零件号">
            <el-input
              v-model="query.partNo"
              clearable
              placeholder="请输入零件号"
            />
          </el-form-item>
          <el-form-item label="零件名称">
            <el-input
              v-model="query.partName"
              clearable
              placeholder="请输入零件名称"
            />
          </el-form-item>
          <el-form-item label="会次">
            <el-input
              v-model="query.meetingNo"
              clearable
              placeholder="请输入会次"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          variant="secondary"
          type="success"
          plain
          :icon="Upload"
          @click="openImportDialog"
        >
          导入
        </PermissionButton>
        <PermissionButton
          permission="system:PurchaseMeetingPrice:export"
          :icon="Download"
          @click="exportMeetingImports"
        >
          导出
        </PermissionButton>
        <span v-if="selectedCountText" class="meeting-import-page__selection">
          {{ selectedCountText }}
        </span>
      </template>

      <el-table-column type="selection" width="48" fixed="left" />
<!--      <el-table-column prop="id" label="主键ID" min-width="110" fixed="left" />-->
      <el-table-column type="index" label="序号" min-width="120" />
      <el-table-column prop="meetingDate" label="会议日期" min-width="130" />
      <el-table-column prop="meetingNo" label="会次" min-width="190" />
      <el-table-column
        prop="sorEcn"
        label="SOR/ECN"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column prop="vehicleModel" label="对应车型" min-width="120" />
      <el-table-column
        prop="purchaseBusinessLine"
        label="零部件采购业务线"
        min-width="150"
      >
        <template #default="{ row }">
          {{ row.purchaseBusinessLine || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="purchaseMajor" label="采购专业" min-width="120">
        <template #default="{ row }">
          {{ row.purchaseMajor || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="issueType" label="议题类型" min-width="120">
        <template #default="{ row }">
          {{ row.issueType || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="partNo" label="零件号" min-width="130" />
      <el-table-column prop="partName" label="零件名称" min-width="140" />
      <el-table-column prop="supplier" label="供应商名称" min-width="120">
        <template #default="{ row }">
          {{ row.supplier || "--" }}
        </template>
      </el-table-column>
      <el-table-column label="出厂价" min-width="120" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.factoryPrice" />
        </template>
      </el-table-column>
      <el-table-column label="包装费" min-width="110" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.packageFee" />
        </template>
      </el-table-column>
      <el-table-column label="物流费" min-width="110" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.logisticsFee" />
        </template>
      </el-table-column>
      <el-table-column label="不含摊销价" min-width="130" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.taxExcludedAmortizedPrice" />
        </template>
      </el-table-column>
      <el-table-column label="摊销-工装模具费" min-width="150" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.amortizedToolingMoldFee" />
        </template>
      </el-table-column>
      <el-table-column label="摊销-技术开发费" min-width="150" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.amortizedTechDevelopmentFee" />
        </template>
      </el-table-column>
      <el-table-column label="入厂单价" min-width="120" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.inboundUnitPrice" />
        </template>
      </el-table-column>
      <el-table-column label="支付-工装模具费" min-width="150" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.paidToolingMoldFee" />
        </template>
      </el-table-column>
      <el-table-column label="支付-技术开发费" min-width="150" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.paidTechDevelopmentFee" />
        </template>
      </el-table-column>
      <el-table-column label="摊销工装模具费" min-width="150" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.toolingMoldFee" />
        </template>
      </el-table-column>
      <el-table-column label="摊销技术开发费" min-width="150" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.techDevelopmentFee" />
        </template>
      </el-table-column>
      <el-table-column label="摊销数量" min-width="120" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.amortizedQuantity" />
        </template>
      </el-table-column>
      <el-table-column
        prop="executeStartDate"
        label="执行日期-开始"
        min-width="140"
      />
      <el-table-column
        prop="executeEndDate"
        label="执行日期-结束"
        min-width="140"
      />
      <el-table-column prop="remark" label="备注" min-width="120">
        <template #default="{ row }">
          {{ row.remark || "--" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            link
            type="primary"
            permission="system:PurchaseMeetingPrice:edit"
            @click="openEditDialog(row)"
          >
            编辑
          </PermissionButton>
          <PermissionButton
            link
            permission="system:PurchaseMeetingPrice:remove"
            @click="openDeleteConfirm(row)"
          >
            删除
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="editDialogVisible"
      title="修改采购上会价格"
      width="920px"
      top="5vh"
      compact
      body-max-height="62vh"
      confirm-text="保存"
      cancel-text="取消"
      @confirm="saveEditForm"
    >
      <el-form
        class="meeting-import-page__form"
        :model="editForm"
        label-position="top"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="会次">
              <el-input v-model="editForm.meetingNo" placeholder="请输入会次" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="2026年会次">
              <el-input
                v-model="editForm.annualMeetingNo"
                placeholder="请输入年度会次"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="定价基准(SOR/ECN)">
              <el-input
                v-model="editForm.sorEcn"
                placeholder="请输入定价基准"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="对应车型">
              <el-input
                v-model="editForm.vehicleModel"
                placeholder="请输入对应车型"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="零部件采购业务线">
              <el-input
                v-model="editForm.purchaseBusinessLine"
                placeholder="请输入零部件采购业务线"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="采购专业">
              <el-input
                v-model="editForm.purchaseMajor"
                placeholder="请输入采购专业"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="零件号">
              <el-input
                v-model="editForm.partNo"
                placeholder="请输入零件号"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="零件名称">
              <el-input
                v-model="editForm.partName"
                placeholder="请输入零件名称"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商名称">
              <el-input
                v-model="editForm.supplier"
                placeholder="请输入供应商"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出厂价">
              <el-input-number v-model="editForm.factoryPrice" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="包装费">
              <el-input-number v-model="editForm.packageFee" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="物流费">
              <el-input-number v-model="editForm.logisticsFee" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="不含摊销价(出厂价+包装费+物流费)">
              <el-input-number
                v-model="editForm.taxExcludedAmortizedPrice"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="摊销-工装模具费">
              <el-input-number
                v-model="editForm.amortizedToolingMoldFee"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="摊销-技术开发费">
              <el-input-number
                v-model="editForm.amortizedTechDevelopmentFee"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入厂单价">
              <el-input-number v-model="editForm.inboundUnitPrice" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="支付-工装模具费">
              <el-input-number v-model="editForm.paidToolingMoldFee" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="支付-技术开发费">
              <el-input-number
                v-model="editForm.paidTechDevelopmentFee"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="投资费-摊销工装模具费">
              <el-input-number v-model="editForm.toolingMoldFee" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="投资费-摊销技术开发费">
              <el-input-number v-model="editForm.techDevelopmentFee" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="摊销数量(万个)">
              <el-input-number v-model="editForm.amortizedQuantity" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="执行日期-开始时间">
              <el-date-picker
                v-model="editForm.executeStartDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择开始时间"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="执行日期-结束时间">
              <el-date-picker
                v-model="editForm.executeEndDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择结束时间"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="editForm.remark"
                type="textarea"
                :rows="2"
                placeholder="请输入备注"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseImportDialog
      v-model="importDialogVisible"
      module-name="上会价"
      :loading="importLoading"
      template-text="下载导入模板"
      template-description="请按照要求导入采购上会价格标准 Excel 文件"
      upload-tip="只能上传 xlsx 格式文件，且不超过 20MB"
      @import="handleImport"
      @download-template="handleDownloadTemplate"
    />

    <BaseConfirm
      v-model="deleteConfirmVisible"
      title="删除采购上会价格"
      type="danger"
      width="520px"
      confirm-text="删除"
      cancel-text="取消"
      :message="deleteConfirmMessage"
      :loading="deleteLoading"
      @confirm="confirmDelete"
    />
    <TaskStatusPanel v-if="false" :task-id="activeTaskId" />
  </PageContainer>
</template>

<style scoped>
.meeting-import-page :deep(.base-toolbar) {
  border-top: 0;
}

.meeting-import-page :deep(.page-container__body) {
  grid-template-columns: minmax(0, 1fr);
}

.meeting-import-page :deep(.el-table__cell) {
  white-space: nowrap;
}

.meeting-import-page__selection {
  color: var(--bq-color-text-muted);
  font-size: 14px;
  line-height: 24px;
}

.meeting-import-page__form {
  padding-right: 4px;
}

.meeting-import-page__form :deep(.el-input-number),
.meeting-import-page__form :deep(.el-date-editor.el-input) {
  width: 100%;
}
</style>
