<script setup lang="ts">
import { reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { Delete, Plus } from "@element-plus/icons-vue";
import {
  createGovernanceJob,
  fetchGovernanceJobs,
  triggerGovernanceJob,
  updateGovernanceJobStatus,
} from "@/api/data-governance";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import GovernanceStatusTag from "./components/GovernanceStatusTag.vue";
import GovernanceTriggerDialog from "./components/GovernanceTriggerDialog.vue";
import {
  formatGovernanceCell,
  formatGovernanceValue,
  normalizeGovernanceError,
} from "./governance-page-utils";
import type {
  GovernanceCollectionObject,
  GovernanceJob,
  GovernanceJobCreateRequest,
  GovernanceJobStepRequest,
  GovernanceTableMetadata,
  GovernanceScript,
  GovernanceTriggerRequest,
} from "@/types/data-governance";

type QueryTableExpose = { reload: () => Promise<void> };

type JobForm = Omit<GovernanceJobCreateRequest, "sources" | "steps"> & {
  sourceCodes: string[];
  steps: JobStepForm[];
};

type JobStepForm = Omit<GovernanceJobStepRequest, "inputTables"> & {
  inputTables: string[];
};

const defaultStep = (order: number): JobStepForm => ({
  stepCode: `SQL_STEP_${order}`,
  stepName: "",
  stepOrder: order,
  stepType: "SQL",
  scriptCode: "",
  inputLayer: "DWD",
  outputLayer: "ADS",
  inputTables: [],
  outputTable: "",
  failFast: true,
});

const defaultJobForm = (): JobForm => ({
  jobCode: "",
  jobName: "",
  jobType: "ADS",
  sourceSystem: "DATA_LAKE",
  targetLayer: "ADS",
  scheduleType: "SYNC",
  enabled: true,
  remark: "",
  sourceCodes: [],
  steps: [defaultStep(10)],
});

const queryTableRef = ref<QueryTableExpose | null>(null);
const jobFormRef = ref<FormInstance>();
const saving = ref(false);
const optionsLoading = ref(false);
const confirmVisible = ref(false);
const triggerVisible = ref(false);
const createVisible = ref(false);
const active = ref<GovernanceJob | null>(null);
const pendingEnabled = ref(false);
const sourceOptions = ref<GovernanceCollectionObject[]>([]);
const scriptOptions = ref<GovernanceScript[]>([]);
const tableOptions = ref<GovernanceTableMetadata[]>([]);
const actionError = ref<ReturnType<typeof normalizeGovernanceError> | null>(
  null,
);
const jobForm = reactive<JobForm>(defaultJobForm());
const jobRules: FormRules<JobForm> = {
  jobCode: [
    { required: true, message: "请输入作业编码", trigger: "blur" },
    {
      pattern: /^[A-Z][A-Z0-9_]{1,63}$/,
      message: "请输入大写字母、数字或下划线组成的编码",
      trigger: "blur",
    },
  ],
  jobName: [{ required: true, message: "请输入作业名称", trigger: "blur" }],
  sourceSystem: [
    { required: true, message: "请输入来源系统", trigger: "blur" },
  ],
  sourceCodes: [
    {
      validator: (_rule, value, callback) => {
        if (jobForm.scheduleType !== "SYNC" || value.length) callback();
        else callback(new Error("同步触发作业至少选择一个必需采集对象"));
      },
      trigger: "change",
    },
  ],
};

async function queryJobs(pageSize: number, pageNo: number) {
  const result = await fetchGovernanceJobs({ pageNo, pageSize });
  return {
    list: result.records,
    total: result.total,
    pageNo: result.pageNo,
    pageSize: result.pageSize,
  };
}

function askStatus(row: GovernanceJob, value: boolean) {
  actionError.value = null;
  active.value = row;
  pendingEnabled.value = value;
  confirmVisible.value = true;
}

async function saveStatus() {
  if (!active.value) return;
  saving.value = true;
  actionError.value = null;
  try {
    await updateGovernanceJobStatus(active.value.jobCode, pendingEnabled.value);
    BaseToast.success(`作业已${pendingEnabled.value ? "启用" : "停用"}`);
    confirmVisible.value = false;
    await queryTableRef.value?.reload();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "作业状态更新失败");
  } finally {
    saving.value = false;
  }
}

function addStep() {
  const lastOrder = jobForm.steps.at(-1)?.stepOrder ?? 0;
  jobForm.steps.push(defaultStep(lastOrder + 10));
}

function removeStep(index: number) {
  if (jobForm.steps.length === 1) return;
  jobForm.steps.splice(index, 1);
}

function tablesForLayer(layer?: string) {
  return tableOptions.value.filter((table) => table.layerType === layer);
}

function normalizeStepTables(step: JobStepForm) {
  if (step.stepType === "ODS_TO_DWD_DEDUP") {
    const odsCodes = new Set(
      tablesForLayer("ODS").map((table) => table.qualifiedName),
    );
    step.inputTables = step.inputTables
      .filter((table) => odsCodes.has(table))
      .slice(-1);
    step.outputTable = step.inputTables.length
      ? defaultDwdMirrorTable(step.inputTables[0])
      : "";
    return;
  }
  const inputCodes = new Set(
    tablesForLayer(step.inputLayer).map((table) => table.qualifiedName),
  );
  step.inputTables = step.inputTables.filter((table) => inputCodes.has(table));
  if (
    step.outputTable &&
    !tablesForLayer(step.outputLayer).some(
      (table) => table.qualifiedName === step.outputTable,
    )
  ) {
    step.outputTable = "";
  }
}

function defaultDwdMirrorTable(odsTable: string) {
  const tableName = odsTable.split(".")[1] || "";
  const suffix = /^(ods_|dws_)/.test(tableName)
    ? tableName.slice(4)
    : tableName;
  return `bq_dwd.${tableName.startsWith("dwd_") ? tableName : `dwd_${suffix}`}`;
}

function changeStepType(step: JobStepForm) {
  if (step.stepType === "ODS_TO_DWD_DEDUP") {
    step.stepCode = `ODS_TO_DWD_DEDUP_${step.stepOrder}`;
    step.scriptCode = "";
    step.inputLayer = "ODS";
    step.outputLayer = "DWD";
    normalizeStepTables(step);
    return;
  }
  if (step.stepCode.startsWith("ODS_TO_DWD_")) {
    step.stepCode = `SQL_STEP_${step.stepOrder}`;
  }
  step.inputLayer = "DWD";
  step.outputLayer = "ADS";
  step.inputTables = [];
  step.outputTable = "";
}

function setDedupInput(step: JobStepForm, table?: string) {
  step.inputTables = table ? [table] : [];
  normalizeStepTables(step);
}

async function saveJob() {
  if (!(await jobFormRef.value?.validate().catch(() => false))) return;
  const invalidStep = jobForm.steps.find(
    (step) =>
      !step.stepCode.trim() ||
      !step.stepName.trim() ||
      (step.stepType === "SQL" && !step.scriptCode) ||
      (step.stepType === "ODS_TO_DWD_DEDUP" && step.inputTables.length !== 1) ||
      !step.outputTable.trim(),
  );
  if (invalidStep) {
    BaseToast.error("请完整填写每个步骤的编码、名称、输入和输出配置");
    return;
  }
  saving.value = true;
  actionError.value = null;
  try {
    await createGovernanceJob({
      ...jobForm,
      remark: jobForm.remark?.trim() || undefined,
      sources: jobForm.sourceCodes.map((collectionObjectCode) => ({
        collectionObjectCode,
        required: true,
      })),
      steps: jobForm.steps.map((step) => ({
        ...step,
        stepCode: step.stepCode.trim(),
        stepName: step.stepName.trim(),
        inputTables: step.inputTables.length
          ? JSON.stringify(step.inputTables)
          : undefined,
        outputTable: step.outputTable.trim(),
      })),
    });
    BaseToast.success("治理作业已新增");
    createVisible.value = false;
    await queryTableRef.value?.reload();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "治理作业新增失败");
  } finally {
    saving.value = false;
  }
}

function openTrigger(row: GovernanceJob) {
  if (!row.enabled) return;
  actionError.value = null;
  active.value = row;
  triggerVisible.value = true;
}

async function submitTrigger(data: GovernanceTriggerRequest) {
  saving.value = true;
  actionError.value = null;
  try {
    const batch = await triggerGovernanceJob(data);
    BaseToast.success(`已触发批次 ${batch.batchNo}`);
    triggerVisible.value = false;
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "治理作业触发失败");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <PageContainer
    class="governance-page"
    title="治理作业"
    description="配置来源依赖、内置ODS到DWD去重步骤或已发布SQL脚本。"
  >
    <TraceErrorAlert
      v-if="actionError && !triggerVisible && !createVisible"
      v-bind="actionError"
    />
    <QueryTable
      ref="queryTableRef"
      :func="queryJobs"
      :show-search="false"
      show-toolbar
      fit-table-height
      empty-title="暂无治理作业"
      empty-description="当前没有可执行的数据治理作业。"
    >
      <el-table-column
        prop="jobName"
        label="作业名称"
        min-width="150"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="jobCode"
        label="作业编码"
        min-width="180"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="jobType"
        label="类型"
        width="110"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="sourceSystem"
        label="来源系统"
        min-width="120"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="targetLayer"
        label="目标层"
        width="90"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="触发模式" min-width="150">
        <template #default="{ row }">
          {{
            row.scheduleType === "SYNC"
              ? "同步完成后自动触发"
            : row.scheduleType === "MANUAL"
                ? "仅手动触发"
                : row.scheduleType === "CRON"
                  ? "定时触发"
                  : formatGovernanceValue(row.scheduleType)
          }}
        </template>
      </el-table-column>
      <el-table-column label="脚本执行版本" min-width="150">
        <template #default="{ row }">
          {{
            row.scriptVersion === "DYNAMIC"
              ? "动态取已发布版本"
              : formatGovernanceValue(row.scriptVersion)
          }}
        </template>
      </el-table-column>
      <el-table-column label="启用状态" width="110">
        <template #default="{ row }">
          <PermissionButton
            link
            permission="data:governance:job:update"
            @click="askStatus(row, !row.enabled)"
          >
            <GovernanceStatusTag :status="row.enabled" />
          </PermissionButton>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="170">
        <template #default="{ row }"
          ><BaseDateTime :value="row.updateTime" empty-text="-"
        /></template>
      </el-table-column>
      <el-table-column
        prop="remark"
        label="备注"
        min-width="180"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <div class="bq-table-actions">
            <PermissionButton
              link
              permission="data:governance:batch:trigger"
              :disabled="!row.enabled"
              @click="openTrigger(row)"
              >手动触发</PermissionButton
            >
          </div>
        </template>
      </el-table-column>
    </QueryTable>
    <BaseConfirm
      v-model="confirmVisible"
      title="作业状态确认"
      :message="`确认${pendingEnabled ? '启用' : '停用'}作业「${active?.jobName || ''}」？`"
      type="warning"
      :loading="saving"
      @confirm="saveStatus"
    />
    <GovernanceTriggerDialog
      v-model="triggerVisible"
      :job="active"
      :loading="saving"
      :error="actionError"
      @submit="submitTrigger"
    />
    <BaseFormDialog
      v-model="createVisible"
      title="新增治理作业"
      width="860px"
      body-max-height="68vh"
      :loading="saving || optionsLoading"
      @confirm="saveJob"
    >
      <TraceErrorAlert v-if="actionError" v-bind="actionError" />
      <el-form
        ref="jobFormRef"
        :model="jobForm"
        :rules="jobRules"
        label-position="top"
      >
        <el-row :gutter="16">
          <el-col :span="12"
            ><el-form-item label="作业编码" prop="jobCode"
              ><el-input
                v-model="jobForm.jobCode"
                maxlength="64" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="作业名称" prop="jobName"
              ><el-input
                v-model="jobForm.jobName"
                maxlength="128" /></el-form-item
          ></el-col>
          <el-col :span="8"
            ><el-form-item label="作业类型"
              ><el-select v-model="jobForm.jobType"
                ><el-option label="全链路" value="FULL" /><el-option
                  label="ODS"
                  value="ODS" /><el-option label="DWD" value="DWD" /><el-option
                  label="ADS"
                  value="ADS" /></el-select></el-form-item
          ></el-col>
          <el-col :span="8"
            ><el-form-item label="来源系统" prop="sourceSystem"
              ><el-input
                v-model="jobForm.sourceSystem"
                maxlength="64" /></el-form-item
          ></el-col>
          <el-col :span="8"
            ><el-form-item label="目标层"
              ><el-select v-model="jobForm.targetLayer"
                ><el-option label="ODS" value="ODS" /><el-option
                  label="DWD"
                  value="DWD" /><el-option
                  label="ADS"
                  value="ADS" /></el-select></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="触发模式"
              ><el-radio-group v-model="jobForm.scheduleType"
                ><el-radio value="SYNC">同步完成后自动触发</el-radio
                ><el-radio value="MANUAL">仅手动触发</el-radio></el-radio-group
              ></el-form-item
            ></el-col
          >
          <el-col :span="12"
            ><el-form-item label="启用状态"
              ><el-switch v-model="jobForm.enabled" /></el-form-item
          ></el-col>
        </el-row>
        <el-form-item label="必需采集对象" prop="sourceCodes">
          <el-select
            v-model="jobForm.sourceCodes"
            multiple
            filterable
            :loading="optionsLoading"
          >
            <el-option
              v-for="source in sourceOptions"
              :key="source.objectCode"
              :label="`${source.objectCode} · ${source.sourceObject}`"
              :value="source.objectCode"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"
          ><el-input
            v-model="jobForm.remark"
            type="textarea"
            :rows="2"
            maxlength="500"
        /></el-form-item>
        <div class="job-step-header">
          <strong>治理步骤</strong>
          <el-button :icon="Plus" @click="addStep">新增步骤</el-button>
        </div>
        <section
          v-for="(step, index) in jobForm.steps"
          :key="`${index}-${step.stepOrder}`"
          class="job-step"
        >
          <div class="job-step-title">
            步骤 {{ index + 1
            }}<el-button
              :icon="Delete"
              text
              type="danger"
              :disabled="jobForm.steps.length === 1"
              @click="removeStep(index)"
            />
          </div>
          <el-row :gutter="12">
            <el-col :span="8"
              ><el-form-item label="步骤编码"
                ><el-input
                  v-model="step.stepCode"
                  maxlength="64" /></el-form-item
            ></el-col>
            <el-col :span="8"
              ><el-form-item label="步骤名称"
                ><el-input
                  v-model="step.stepName"
                  maxlength="128" /></el-form-item
            ></el-col>
            <el-col :span="8"
              ><el-form-item label="执行顺序"
                ><el-input-number
                  v-model="step.stepOrder"
                  :min="1" /></el-form-item
            ></el-col>
            <el-col :span="8"
              ><el-form-item label="步骤类型"
                ><el-radio-group
                  v-model="step.stepType"
                  @change="changeStepType(step)"
                  ><el-radio-button label="SQL">SQL脚本</el-radio-button
                  ><el-radio-button label="ODS_TO_DWD_DEDUP"
                    >ODS到DWD去重</el-radio-button
                  ></el-radio-group
                ></el-form-item
              ></el-col
            >
            <el-col v-if="step.stepType === 'SQL'" :span="12"
              ><el-form-item label="已发布SQL脚本"
                ><el-select
                  v-model="step.scriptCode"
                  filterable
                  :loading="optionsLoading"
                  ><el-option
                    v-for="script in scriptOptions"
                    :key="script.scriptCode"
                    :label="`${script.scriptCode} · ${script.scriptName}`"
                    :value="script.scriptCode" /></el-select></el-form-item
            ></el-col>
            <template v-if="step.stepType === 'SQL'">
              <el-col :span="6"
                ><el-form-item label="输入层"
                  ><el-select
                    v-model="step.inputLayer"
                    @change="normalizeStepTables(step)"
                    ><el-option label="ODS" value="ODS" /><el-option
                      label="DWD"
                      value="DWD" /><el-option
                      label="ADS"
                      value="ADS" /></el-select></el-form-item
              ></el-col>
              <el-col :span="6"
                ><el-form-item label="输出层"
                  ><el-select
                    v-model="step.outputLayer"
                    @change="normalizeStepTables(step)"
                    ><el-option label="DWD" value="DWD" /><el-option
                      label="ADS"
                      value="ADS" /></el-select></el-form-item
              ></el-col>
              <el-col :span="12"
                ><el-form-item label="输入表"
                  ><el-select
                    v-model="step.inputTables"
                    multiple
                    filterable
                    clearable
                    collapse-tags
                    collapse-tags-tooltip
                    :loading="optionsLoading"
                    placeholder="选择SQL步骤读取的表"
                    @change="normalizeStepTables(step)"
                    ><el-option
                      v-for="table in tablesForLayer(step.inputLayer)"
                      :key="table.qualifiedName"
                      :label="`${table.qualifiedName} · ${table.tableComment || table.tableName}`"
                      :value="table.qualifiedName" /></el-select></el-form-item
              ></el-col>
              <el-col :span="10"
                ><el-form-item label="输出表"
                  ><el-select
                    v-model="step.outputTable"
                    filterable
                    clearable
                    :loading="optionsLoading"
                    placeholder="选择SQL步骤写入的表"
                    @change="normalizeStepTables(step)"
                    ><el-option
                      v-for="table in tablesForLayer(step.outputLayer)"
                      :key="table.qualifiedName"
                      :label="`${table.qualifiedName} · ${table.tableComment || table.tableName}`"
                      :value="table.qualifiedName" /></el-select></el-form-item
              ></el-col>
            </template>
            <template v-else>
              <el-col :span="12"
                ><el-form-item label="输入ODS表"
                  ><el-select
                    :model-value="step.inputTables[0]"
                    filterable
                    clearable
                    :loading="optionsLoading"
                    placeholder="选择一张ODS表"
                    @update:model-value="setDedupInput(step, $event)"
                    ><el-option
                      v-for="table in tablesForLayer('ODS')"
                      :key="table.qualifiedName"
                      :label="`${table.qualifiedName} · ${table.tableComment || table.tableName}`"
                      :value="table.qualifiedName" /></el-select></el-form-item
              ></el-col>
              <el-col :span="12"
                ><el-form-item label="DWD镜像表"
                  ><el-input
                    v-model="step.outputTable"
                    readonly /></el-form-item
              ></el-col>
            </template>
            <el-col :span="14"
              ><el-form-item label="失败处理"
                ><el-switch
                  v-model="step.failFast"
                  active-text="立即终止"
                  inactive-text="继续执行" /></el-form-item
            ></el-col>
          </el-row>
        </section>
      </el-form>
    </BaseFormDialog>
  </PageContainer>
</template>

<style scoped>
.job-step-header,
.job-step-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.job-step-header {
  margin: 18px 0 10px;
}

.job-step {
  margin-bottom: 12px;
  padding: 14px;
  border: 1px solid var(--bq-color-border);
  border-radius: 6px;
}

.job-step-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
}
</style>
