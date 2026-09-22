<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import type {
  GovernanceJob,
  GovernanceTriggerRequest,
} from "@/types/data-governance";

const props = defineProps<{
  modelValue: boolean;
  job?: GovernanceJob | null;
  loading?: boolean;
  error?: { code: string; message: string; traceId?: string } | null;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  submit: [GovernanceTriggerRequest];
}>();
const formRef = ref<FormInstance>();
const form = reactive<GovernanceTriggerRequest>({
  jobCode: "",
  requestNo: "",
  bizDate: "",
});
const rules: FormRules<GovernanceTriggerRequest> = {
  bizDate: [{ required: true, message: "请选择业务日期", trigger: "change" }],
  requestNo: [{ required: true, message: "请输入请求号", trigger: "blur" }],
};

function createRequestNo(jobCode: string) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `WEB-${jobCode}-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

watch(
  () => [props.modelValue, props.job?.jobCode] as const,
  ([visible]) => {
    if (!visible || !props.job) return;
    Object.assign(form, {
      jobCode: props.job.jobCode,
      requestNo: createRequestNo(props.job.jobCode),
      bizDate: new Date().toISOString().slice(0, 10),
    });
  },
  { immediate: true },
);

async function submit() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  emit("submit", {
    ...form,
    requestNo: form.requestNo.trim(),
  });
}
</script>

<template>
  <BaseFormDialog
    :model-value="modelValue"
    title="手动触发治理作业"
    confirm-text="触发"
    :loading="loading"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="submit"
  >
    <TraceErrorAlert v-if="error" v-bind="error" />
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="作业编码"
        ><el-input
          v-model="form.jobCode"
          disabled
          clearable
      /></el-form-item>
      <el-form-item label="业务日期" prop="bizDate">
        <el-date-picker
          v-model="form.bizDate"
          value-format="YYYY-MM-DD"
          type="date"
        />
      </el-form-item>
      <el-form-item label="请求号" prop="requestNo"
        ><el-input
          v-model="form.requestNo"
          clearable
      /></el-form-item>
    </el-form>
  </BaseFormDialog>
</template>
