<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
import { computed, reactive, ref } from "vue";
import { Download, Search, Upload } from "@element-plus/icons-vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseMoney from "@/components/base/BaseMoney.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { downloadLocalTemplate } from "@/utils/download-template";
import {
  createOaEvaluationPrice,
  createOaEvaluationPriceExportTask,
  createOaEvaluationPriceImportTask,
  deleteOaEvaluationPrice,
  fetchOaEvaluationPrices,
  updateOaEvaluationPrice,
} from "@/api/cost-center";
import type { UploadFile } from "element-plus";
import type { OaEvaluationPriceItem } from "@/types/cost-center";

type EvaluationImportQuery = {
  partNo: string;
  partName: string;
};

type EvaluationImportRow = {
  id: number;
  costMajor: string;
  secondarySystem: string;
  tertiarySystem: string;
  evaluator: string;
  project: string;
  evaluationType: string;
  fileNo: string;
  partNo: string;
  partName: string;
  initialEvaluationValue: number;
  factoryPrice: number;
  packageFee: number;
  logisticsFee: number;
  warehouseFee: number;
  costBreakdownTargetB: number;
  differenceAB: number;
  targetAchievementRate: string;
  changePlanDescription: string;
  beforeChangePartNo: string;
  afterChangePartNo: string;
  afterChangePartName: string;
  originalCost: number;
  changedCost: number;
  costChange: number;
  toolingMoldQuantity: number;
  toolingMoldQuote: number;
  toolingMoldEvaluation: number;
  differenceEvaluationQuote: number;
  designWorkingDays: number;
  designFee: number;
  testFee: number;
  calibrationFee: number;
  rpPart: string;
  evaluationTotal: number;
  developmentQuote: number;
  developmentDifference: number;
  purchaseInputQuoteC: number;
  quoteEvaluationCA: number;
  finalQuoteD: number;
  negotiationResultDC: number;
  remark: string;
  version: number;
};

type QueryTableExpose = {
  search: () => void;
  reload: () => void;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const query = reactive<EvaluationImportQuery>({
  partNo: "",
  partName: "",
});
const selectedRows = ref<EvaluationImportRow[]>([]);
const importDialogVisible = ref(false);
const importLoading = ref(false);
const editDialogVisible = ref(false);
const editingRowId = ref<number | null>(null);
const editForm = reactive<EvaluationImportRow>(
  createEmptyEvaluationImportRow(),
);
const deleteConfirmVisible = ref(false);
const deleteLoading = ref(false);
const deletingRow = ref<EvaluationImportRow | null>(null);

const selectedCountText = computed(() =>
  selectedRows.value.length > 0 ? `已选择 ${selectedRows.value.length} 项` : "",
);
const deleteConfirmMessage = computed(() =>
  deletingRow.value
    ? `确认删除评估单「${deletingRow.value.id}」？删除后列表不再展示该记录。`
    : "确认删除当前评估单？删除后列表不再展示该记录。",
);

function createEmptyEvaluationImportRow(): EvaluationImportRow {
  return {
    id: 0,
    costMajor: "",
    secondarySystem: "",
    tertiarySystem: "",
    evaluator: "",
    project: "",
    evaluationType: "",
    fileNo: "",
    partNo: "",
    partName: "",
    initialEvaluationValue: 0,
    factoryPrice: 0,
    packageFee: 0,
    logisticsFee: 0,
    warehouseFee: 0,
    costBreakdownTargetB: 0,
    differenceAB: 0,
    targetAchievementRate: "",
    changePlanDescription: "",
    beforeChangePartNo: "",
    afterChangePartNo: "",
    afterChangePartName: "",
    originalCost: 0,
    changedCost: 0,
    costChange: 0,
    toolingMoldQuantity: 0,
    toolingMoldQuote: 0,
    toolingMoldEvaluation: 0,
    differenceEvaluationQuote: 0,
    designWorkingDays: 0,
    designFee: 0,
    testFee: 0,
    calibrationFee: 0,
    rpPart: "",
    evaluationTotal: 0,
    developmentQuote: 0,
    developmentDifference: 0,
    purchaseInputQuoteC: 0,
    quoteEvaluationCA: 0,
    finalQuoteD: 0,
    negotiationResultDC: 0,
    remark: "",
    version: 0,
  };
}

async function queryEvaluationImports(pageSize: number, pageNum: number) {
  const page = await fetchOaEvaluationPrices({
    partNo: readText(query.partNo),
    partName: readText(query.partName),
    pageNo: pageNum,
    pageSize,
  });

  return {
    total: page.total ?? 0,
    list: page.records.map(toEvaluationImportRow),
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function toEvaluationImportRow(
  item: OaEvaluationPriceItem,
): EvaluationImportRow {
  return {
    id: item.id,
    costMajor: item.costMajor || "",
    secondarySystem: item.secondarySystem || "",
    tertiarySystem: item.tertiarySystem || "",
    evaluator: item.evaluator || "",
    project: item.project || "",
    evaluationType: item.evaluationType || "",
    fileNo: item.fileNo || "",
    partNo: item.partNo,
    partName: item.partName || "",
    initialEvaluationValue: toNumber(item.initialEvaluationValue),
    factoryPrice: toNumber(item.factoryPrice),
    packageFee: toNumber(item.packageFee),
    logisticsFee: toNumber(item.logisticsFee),
    warehouseFee: toNumber(item.warehouseFee),
    costBreakdownTargetB: toNumber(item.costBreakdownTargetB),
    differenceAB: toNumber(item.differenceAB),
    targetAchievementRate: item.targetAchievementRate || "",
    changePlanDescription: item.changePlanDescription || "",
    beforeChangePartNo: item.beforeChangePartNo || "",
    afterChangePartNo: item.afterChangePartNo || "",
    afterChangePartName: item.afterChangePartName || "",
    originalCost: toNumber(item.originalCost),
    changedCost: toNumber(item.changedCost),
    costChange: toNumber(item.costChange),
    toolingMoldQuantity: item.toolingMoldQuantity || 0,
    toolingMoldQuote: toNumber(item.toolingMoldQuote),
    toolingMoldEvaluation: toNumber(item.toolingMoldEvaluation),
    differenceEvaluationQuote: toNumber(item.differenceEvaluationQuote),
    designWorkingDays: toNumber(item.designWorkingDays),
    designFee: toNumber(item.designFee),
    testFee: toNumber(item.testFee),
    calibrationFee: toNumber(item.calibrationFee),
    rpPart: item.rpPart || "",
    evaluationTotal: toNumber(item.evaluationTotal),
    developmentQuote: toNumber(item.developmentQuote),
    developmentDifference: toNumber(item.developmentDifference),
    purchaseInputQuoteC: toNumber(item.purchaseInputQuoteC),
    quoteEvaluationCA: toNumber(item.quoteEvaluationCA),
    finalQuoteD: toNumber(item.finalQuoteD),
    negotiationResultDC: toNumber(item.negotiationResultDC),
    remark: item.remark || "",
    version: item.version,
  };
}

function resetQuery() {
  Object.assign(query, {
    partNo: "",
    partName: "",
  });
}

function searchEvaluationImports() {
  queryTableRef.value?.search();
}

function refreshEvaluationImports() {
  queryTableRef.value?.reload();
}

function handleSelectionChange(rows: EvaluationImportRow[]) {
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
    const task = await createOaEvaluationPriceImportTask(rawFile);
    BaseToast.success(`导入任务已创建：${task.taskNo || task.taskId}`);
    importDialogVisible.value = false;
  } finally {
    importLoading.value = false;
  }
}

function downloadEvaluationTemplate() {
  downloadLocalTemplate("\u8bc4\u4f30\u5355-\u5bfc\u5165\u6a21\u677f.xlsx");
}

function openEditDialog(row: EvaluationImportRow) {
  editingRowId.value = row.id;
  Object.assign(editForm, row);
  editDialogVisible.value = true;
}

async function saveEditForm() {
  if (editingRowId.value) {
    await updateOaEvaluationPrice(
      editingRowId.value,
      toEvaluationPayload(editForm),
    );
  } else {
    await createOaEvaluationPrice(toEvaluationPayload(editForm));
  }
  editDialogVisible.value = false;
  editingRowId.value = null;
  BaseToast.success("评估单已保存");
  queryTableRef.value?.reload();
}

function openDeleteConfirm(row: EvaluationImportRow) {
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
    await deleteOaEvaluationPrice(deletingId);
    selectedRows.value = selectedRows.value.filter(
      (row) => row.id !== deletingId,
    );
    deleteConfirmVisible.value = false;
    deletingRow.value = null;
    BaseToast.success("评估单已删除");
    queryTableRef.value?.reload();
  } finally {
    deleteLoading.value = false;
  }
}

async function exportEvaluationImports() {
  const task = await createOaEvaluationPriceExportTask({
    partNo: readText(query.partNo),
    partName: readText(query.partName),
  });
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

function toEvaluationPayload(row: EvaluationImportRow) {
  return {
    costMajor: row.costMajor,
    secondarySystem: row.secondarySystem,
    tertiarySystem: row.tertiarySystem,
    evaluator: row.evaluator,
    project: row.project,
    evaluationType: row.evaluationType,
    fileNo: row.fileNo,
    partNo: row.partNo,
    partName: row.partName,
    initialEvaluationValue: row.initialEvaluationValue,
    factoryPrice: row.factoryPrice,
    packageFee: row.packageFee,
    logisticsFee: row.logisticsFee,
    warehouseFee: row.warehouseFee,
    costBreakdownTargetB: row.costBreakdownTargetB,
    differenceAB: row.differenceAB,
    targetAchievementRate: row.targetAchievementRate,
    changePlanDescription: row.changePlanDescription,
    beforeChangePartNo: row.beforeChangePartNo,
    afterChangePartNo: row.afterChangePartNo,
    afterChangePartName: row.afterChangePartName,
    originalCost: row.originalCost,
    changedCost: row.changedCost,
    costChange: row.costChange,
    toolingMoldQuantity: row.toolingMoldQuantity,
    toolingMoldQuote: row.toolingMoldQuote,
    toolingMoldEvaluation: row.toolingMoldEvaluation,
    differenceEvaluationQuote: row.differenceEvaluationQuote,
    designWorkingDays: row.designWorkingDays,
    designFee: row.designFee,
    testFee: row.testFee,
    calibrationFee: row.calibrationFee,
    rpPart: row.rpPart,
    evaluationTotal: row.evaluationTotal,
    developmentQuote: row.developmentQuote,
    developmentDifference: row.developmentDifference,
    purchaseInputQuoteC: row.purchaseInputQuoteC,
    quoteEvaluationCA: row.quoteEvaluationCA,
    finalQuoteD: row.finalQuoteD,
    negotiationResultDC: row.negotiationResultDC,
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
  <PageContainer title="评估价格导入">
    <QueryTable
      ref="queryTableRef"
      class="evaluation-import-page"
      :func="queryEvaluationImports"
      row-key="id"
      show-toolbar
      fit-table-height
      :table-props="{ onSelectionChange: handleSelectionChange }"
      empty-title="暂无评估单数据"
      empty-description="当前筛选条件下没有可展示的评估单导入数据。"
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
          permission="system:evaluate:export"
          plain
          variant="secondary"
          type="success"
          :icon="Download"
          @click="exportEvaluationImports"
        >
          导出
<!--          system:evaluate:export-->

        </PermissionButton>
<!--        <span-->
<!--          v-if="selectedCountText"-->
<!--          class="evaluation-import-page__selection"-->
<!--        >-->
<!--          {{ selectedCountText }}-->
<!--        </span>-->
      </template>

      <el-table-column type="selection" width="48" fixed="left" />
      <el-table-column type="index" label="序号" min-width="120" />
<!--      <el-table-column prop="id" label="主键ID" min-width="110" fixed="left" />-->
      <el-table-column prop="costMajor" label="成本专业" min-width="120">
        <template #default="{ row }">
          {{ row.costMajor || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="secondarySystem" label="二级系统" min-width="120">
        <template #default="{ row }">
          {{ row.secondarySystem || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="tertiarySystem" label="三级系统" min-width="120">
        <template #default="{ row }">
          {{ row.tertiarySystem || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="evaluator" label="评估人" min-width="110">
        <template #default="{ row }">
          {{ row.evaluator || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="project" label="项目" min-width="130" />
      <el-table-column prop="evaluationType" label="评估类型" min-width="110" />
      <el-table-column prop="fileNo" label="文件编号" min-width="130">
        <template #default="{ row }">
          {{ row.fileNo || "--" }}
        </template>
      </el-table-column>
      <el-table-column prop="partNo" label="零件号" min-width="130" />
      <el-table-column
        prop="partName"
        label="零件名称"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="初始评估值" min-width="120" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.initialEvaluationValue" />
        </template>
      </el-table-column>
      <el-table-column label="出厂价" min-width="110" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.factoryPrice" />
        </template>
      </el-table-column>
      <el-table-column label="包装费" min-width="100" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.packageFee" />
        </template>
      </el-table-column>
      <el-table-column label="物流费" min-width="100" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.logisticsFee" />
        </template>
      </el-table-column>
      <el-table-column label="仓储" min-width="100" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.warehouseFee" />
        </template>
      </el-table-column>
      <el-table-column label="成本分解目标B" min-width="140" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.costBreakdownTargetB" />
        </template>
      </el-table-column>
      <el-table-column label="差额(A-B)" min-width="120" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.differenceAB" />
        </template>
      </el-table-column>
      <el-table-column
        prop="targetAchievementRate"
        label="目标达成率A/B(%)"
        min-width="150"
      >
        <template #default="{ row }">
          {{ row.targetAchievementRate || "--" }}
        </template>
      </el-table-column>
      <el-table-column
        prop="changePlanDescription"
        label="变更方案描述"
        min-width="150"
      >
        <template #default="{ row }">
          {{ row.changePlanDescription || "--" }}
        </template>
      </el-table-column>
      <el-table-column
        prop="beforeChangePartNo"
        label="变更前零件号"
        min-width="140"
      >
        <template #default="{ row }">
          {{ row.beforeChangePartNo || "--" }}
        </template>
      </el-table-column>
      <el-table-column
        prop="afterChangePartNo"
        label="变更后零件号"
        min-width="140"
      >
        <template #default="{ row }">
          {{ row.afterChangePartNo || "--" }}
        </template>
      </el-table-column>
      <el-table-column
        prop="afterChangePartName"
        label="变更后零件名称"
        min-width="150"
      >
        <template #default="{ row }">
          {{ row.afterChangePartName || "--" }}
        </template>
      </el-table-column>
      <el-table-column label="原成本(评估成本)" min-width="150" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.originalCost" />
        </template>
      </el-table-column>
      <el-table-column label="变更后成本" min-width="130" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.changedCost" />
        </template>
      </el-table-column>
      <el-table-column label="成本变化" min-width="120" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.costChange" />
        </template>
      </el-table-column>
      <el-table-column label="工装模具数量(个)" min-width="160" align="right">
        <template #default="{ row }">
          {{ row.toolingMoldQuantity || "--" }}
        </template>
      </el-table-column>
      <el-table-column label="工装模具费报价(元)" min-width="160" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.toolingMoldQuote" />
        </template>
      </el-table-column>
      <el-table-column label="工装模具费评估(元)" min-width="160" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.toolingMoldEvaluation" />
        </template>
      </el-table-column>
      <el-table-column label="差值/元(评估-报价)" min-width="160" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.differenceEvaluationQuote" />
        </template>
      </el-table-column>
      <el-table-column label="设计工时数(人天)" min-width="150" align="right">
        <template #default="{ row }">
          {{ row.designWorkingDays || "--" }}
        </template>
      </el-table-column>
      <el-table-column label="设计费用" min-width="120" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.designFee" />
        </template>
      </el-table-column>
      <el-table-column label="试验费用" min-width="120" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.testFee" />
        </template>
      </el-table-column>
      <el-table-column label="标定费用" min-width="120" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.calibrationFee" />
        </template>
      </el-table-column>
      <el-table-column prop="rpPart" label="RP件" min-width="110">
        <template #default="{ row }">
          {{ row.rpPart || "--" }}
        </template>
      </el-table-column>
      <el-table-column label="评估合计(元)" min-width="130" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.evaluationTotal" />
        </template>
      </el-table-column>
      <el-table-column label="开发费报价(元)" min-width="140" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.developmentQuote" />
        </template>
      </el-table-column>
      <el-table-column label="差值/元(评估-报价)" min-width="160" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.developmentDifference" />
        </template>
      </el-table-column>
      <el-table-column label="采购输入报价C" min-width="140" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.purchaseInputQuoteC" />
        </template>
      </el-table-column>
      <el-table-column label="报价-评估C-A" min-width="140" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.quoteEvaluationCA" />
        </template>
      </el-table-column>
      <el-table-column label="最终报价D" min-width="120" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.finalQuoteD" />
        </template>
      </el-table-column>
      <el-table-column label="商谈协同结果D-C" min-width="150" align="right">
        <template #default="{ row }">
          <BaseMoney :value="row.negotiationResultDC" />
        </template>
      </el-table-column>
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
            permission="system:evaluate:edit"
            @click="openEditDialog(row)"
          >
            编辑
          </PermissionButton>
          <PermissionButton
            link
            permission="system:evaluate:remove"
            @click="openDeleteConfirm(row)"
          >
            删除
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseImportDialog
      v-model="importDialogVisible"
      module-name="评估单"
      :loading="importLoading"
      template-text="下载导入模板"
      template-description="请按照中文表头导入  评估单 Excel 文件"
      upload-tip="只能上传 xlsx 格式文件，且不超过 20MB"
      @import="handleImport"
      @download-template="downloadEvaluationTemplate"
    />

    <BaseFormDialog
      v-model="editDialogVisible"
      title="修改OA评估单导入数据"
      width="920px"
      top="5vh"
      compact
      body-max-height="62vh"
      confirm-text="保存"
      cancel-text="取消"
      @confirm="saveEditForm"
    >
      <el-form
        class="evaluation-import-page__form"
        :model="editForm"
        label-position="top"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="成本专业">
              <el-input
                v-model="editForm.costMajor"
                placeholder="请输入成本专业"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="二级系统">
              <el-input
                v-model="editForm.secondarySystem"
                placeholder="请输入二级系统"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="三级系统">
              <el-input
                v-model="editForm.tertiarySystem"
                placeholder="请输入三级系统"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="评估人">
              <el-input
                v-model="editForm.evaluator"
                placeholder="请输入评估人"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="项目">
              <el-input
                v-model="editForm.project"
                placeholder="请输入项目"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="评估类型">
              <el-input
                v-model="editForm.evaluationType"
                placeholder="请输入评估类型"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="文件编号">
              <el-input
                v-model="editForm.fileNo"
                placeholder="请输入文件编号"
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
            <el-form-item label="初始评估值">
              <el-input-number
                v-model="editForm.initialEvaluationValue"
                :min="0"
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
            <el-form-item label="仓储">
              <el-input-number v-model="editForm.warehouseFee" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="成本分解目标B">
              <el-input-number
                v-model="editForm.costBreakdownTargetB"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="差额(A-B)">
              <el-input-number v-model="editForm.differenceAB" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标达成率A/B(%)">
              <el-input
                v-model="editForm.targetAchievementRate"
                placeholder="请输入目标达成率A/B(%)"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="变更方案描述">
              <el-input
                v-model="editForm.changePlanDescription"
                type="textarea"
                :rows="2"
                placeholder="请输入变更方案描述"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="变更前零件号">
              <el-input
                v-model="editForm.beforeChangePartNo"
                placeholder="请输入变更前零件号"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="变更后零件号">
              <el-input
                v-model="editForm.afterChangePartNo"
                placeholder="请输入变更后零件号"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="变更后零件名称">
              <el-input
                v-model="editForm.afterChangePartName"
                placeholder="请输入变更后零件名称"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="原成本(评估成本)">
              <el-input-number v-model="editForm.originalCost" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="变更后成本">
              <el-input-number v-model="editForm.changedCost" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="成本变化">
              <el-input-number v-model="editForm.costChange" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工装模具数量(个)">
              <el-input-number
                v-model="editForm.toolingMoldQuantity"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工装模具费报价(元)">
              <el-input-number v-model="editForm.toolingMoldQuote" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工装模具费评估(元)">
              <el-input-number
                v-model="editForm.toolingMoldEvaluation"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="差值/元(评估-报价)">
              <el-input-number
                v-model="editForm.differenceEvaluationQuote"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设计工时数(人天)">
              <el-input-number v-model="editForm.designWorkingDays" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设计费用">
              <el-input-number v-model="editForm.designFee" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="试验费用">
              <el-input-number v-model="editForm.testFee" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="标定费用">
              <el-input-number v-model="editForm.calibrationFee" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="RP件">
              <el-input
                v-model="editForm.rpPart"
                placeholder="请输入RP件"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="评估合计(元)">
              <el-input-number v-model="editForm.evaluationTotal" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开发费报价(元)">
              <el-input-number v-model="editForm.developmentQuote" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="差值/元(评估-报价)">
              <el-input-number
                v-model="editForm.developmentDifference"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="采购输入报价C">
              <el-input-number
                v-model="editForm.purchaseInputQuoteC"
                :min="0"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="报价-评估C-A">
              <el-input-number v-model="editForm.quoteEvaluationCA" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最终报价D">
              <el-input-number v-model="editForm.finalQuoteD" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商谈协同结果D-C">
              <el-input-number
                v-model="editForm.negotiationResultDC"
                :min="0"
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

    <BaseConfirm
      v-model="deleteConfirmVisible"
      title="删除评估单"
      type="danger"
      width="520px"
      confirm-text="删除"
      cancel-text="取消"
      :message="deleteConfirmMessage"
      :loading="deleteLoading"
      @confirm="confirmDelete"
    />
  </PageContainer>
</template>

<style scoped>
.evaluation-import-page :deep(.base-toolbar) {
  border-top: 0;
}

.evaluation-import-page :deep(.el-table__cell) {
  white-space: nowrap;
}

.evaluation-import-page__selection {
  color: var(--bq-color-text-muted);
  font-size: 14px;
  line-height: 24px;
}

.evaluation-import-page__form {
  padding-right: 4px;
}

.evaluation-import-page__form :deep(.el-input-number) {
  width: 100%;
}
</style>
