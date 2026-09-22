<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import type { SchedulerJob, SchedulerJobPayload } from "@/types/scheduler";

const props = defineProps<{
  modelValue: boolean;
  job?: SchedulerJob | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [payload: SchedulerJobPayload];
}>();

const formRef = ref<FormInstance>();
const form = reactive<SchedulerJobPayload>(emptyForm());
const rules: FormRules<SchedulerJobPayload> = {
  jobName: [
    { required: true, message: "请输入任务名称", trigger: "blur" },
    { max: 64, message: "任务名称不能超过64个字符", trigger: "blur" },
  ],
  jobGroup: [{ required: true, message: "请选择任务组", trigger: "change" }],
  invokeTarget: [
    { required: true, message: "请输入调用目标", trigger: "blur" },
    { max: 500, message: "调用目标不能超过500个字符", trigger: "blur" },
  ],
  cronExpression: [
    { required: true, message: "请输入Cron表达式", trigger: "blur" },
    { max: 255, message: "Cron表达式不能超过255个字符", trigger: "blur" },
  ],
};

const jobGroups = [
  ["SYSTEM", "系统任务"],
  ["COMMITTEE", "产品委员会"],
  ["NOTIFICATION", "通知中心"],
  ["TASK_CENTER", "任务中心"],
  ["TABLE_PLATFORM", "自定义表格"],
  ["BASE", "基础中心"],
  ["BUDGET", "预算中心"],
  ["COST", "成本中心"],
  ["DATA_SYNC", "数据同步"],
  ["DATA_GOVERNANCE", "数据治理"],
] as const;

function emptyForm(): SchedulerJobPayload {
  return {
    jobName: "",
    jobGroup: "SYSTEM",
    invokeTarget: "",
    cronExpression: "0 0/5 * * * ?",
    misfirePolicy: "2",
    concurrent: "1",
    status: "1",
    maxRetryCount: 0,
    retryInterval: 30000,
    remark: "",
  };
}

watch(
  () => [props.modelValue, props.job] as const,
  ([visible, job]) => {
    if (!visible) return;
    Object.assign(form, emptyForm(), job ?? {});
    formRef.value?.clearValidate();
  },
  { immediate: true },
);

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  emit("save", { ...form });
}
</script>

<template>
  <BaseFormDialog
    :model-value="modelValue"
    :title="job ? '编辑定时任务' : '新增定时任务'"
    width="720px"
    body-max-height="calc(100vh - 220px)"
    :loading="saving"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="submit"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="任务名称" prop="jobName">
            <el-input
              v-model="form.jobName"
              maxlength="64"
              placeholder="请输入任务名称"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="任务组" prop="jobGroup">
            <el-select
              v-model="form.jobGroup"
              filterable
              placeholder="请选择任务组"
            >
              <el-option
                v-for="item in jobGroups"
                :key="item[0]"
                :label="item[1]"
                :value="item[0]"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="调用目标" prop="invokeTarget">
        <el-input
          v-model="form.invokeTarget"
          maxlength="500"
          placeholder="请输入已登记的任务Bean调用目标"
        />
      </el-form-item>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="Cron表达式" prop="cronExpression">
            <el-input
              v-model="form.cronExpression"
              maxlength="255"
              placeholder="例如：0 0/5 * * * ?"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="执行策略" prop="misfirePolicy">
            <el-select v-model="form.misfirePolicy">
              <el-option label="默认策略" value="0" />
              <el-option label="立即执行" value="1" />
              <el-option label="执行一次" value="2" />
              <el-option label="放弃执行" value="3" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="并发策略" prop="concurrent">
            <el-radio-group v-model="form.concurrent">
              <el-radio value="1">禁止并发</el-radio>
              <el-radio value="0">允许并发</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="任务状态" prop="status">
            <el-radio-group v-model="form.status">
              <el-radio value="0">启用</el-radio>
              <el-radio value="1">停用</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="最大重试次数" prop="maxRetryCount">
            <el-input-number
              v-model="form.maxRetryCount"
              :min="0"
              :max="20"
              controls-position="right"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="重试间隔" prop="retryInterval">
            <el-input-number
              v-model="form.retryInterval"
              :min="0"
              :max="3600000"
              :step="1000"
              controls-position="right"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="3"
          maxlength="255"
          show-word-limit
          placeholder="请输入备注"
        />
      </el-form-item>
    </el-form>
  </BaseFormDialog>
</template>

<style scoped>
:deep(.el-select),
:deep(.el-input-number) {
  width: 100%;
}
</style>
