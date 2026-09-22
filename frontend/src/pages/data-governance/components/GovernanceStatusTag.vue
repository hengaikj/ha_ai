<script setup lang="ts">
import { computed } from "vue";
import { formatGovernanceValue } from "../governance-page-utils";

const props = defineProps<{ status?: string | boolean }>();
const statusMap: Record<
  string,
  { label: string; type: "success" | "warning" | "danger" | "info" | "primary" }
> = {
  PENDING: { label: "待执行", type: "info" },
  RUNNING: { label: "执行中", type: "primary" },
  SUCCESS: { label: "成功", type: "success" },
  PARTIAL_SUCCESS: { label: "部分成功", type: "warning" },
  FAILED: { label: "失败", type: "danger" },
  RETRYING: { label: "重跑中", type: "primary" },
  CANCELLED: { label: "已取消", type: "info" },
  ARRIVED: { label: "已到达", type: "primary" },
  ACCEPTED: { label: "已验收", type: "success" },
  REJECTED: { label: "已拒绝", type: "danger" },
  WARN: { label: "警告", type: "warning" },
  PASS: { label: "通过", type: "success" },
  RISK: { label: "风险", type: "danger" },
  OPEN: { label: "待处理", type: "warning" },
  IGNORED: { label: "已忽略", type: "info" },
  RESOLVED: { label: "已处理", type: "success" },
  WARNING: { label: "警告", type: "warning" },
  ERROR: { label: "风险", type: "danger" },
  PASSED: { label: "已通过", type: "success" },
  SKIPPED: { label: "已跳过", type: "info" },
  DRAFT: { label: "草稿", type: "info" },
  REVIEWING: { label: "审批中", type: "warning" },
  PUBLISHED: { label: "已发布", type: "success" },
  RETIRED: { label: "已退役", type: "info" },
  true: { label: "启用", type: "success" },
  false: { label: "停用", type: "info" },
};
const display = computed(
  () =>
    statusMap[String(props.status)] ?? {
      label: formatGovernanceValue(props.status),
      type: "info" as const,
    },
);
</script>
<template>
  <el-tag
    class="governance-status-tag"
    :type="display.type"
    size="small"
    :effect="status === 'RUNNING' ? 'dark' : 'light'"
    >{{ display.label }}</el-tag
  >
</template>
