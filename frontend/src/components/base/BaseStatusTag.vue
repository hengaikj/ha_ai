<script setup lang="ts">
const props = defineProps<{
  status?:
    | "DRAFT"
    | "SUBMITTED"
    | "EFFECTIVE"
    | "PROCESSING"
    | "FAILED"
    | "WARNING"
    | "ENABLED"
    | "DISABLED";
  label?: string;
  type?: "success" | "warning" | "danger" | "info" | "primary";
}>();

const statusMap = {
  DRAFT: { label: "草稿", type: "info" },
  SUBMITTED: { label: "已提交", type: "primary" },
  EFFECTIVE: { label: "已生效", type: "success" },
  PROCESSING: { label: "处理中", type: "primary" },
  FAILED: { label: "校验失败", type: "danger" },
  WARNING: { label: "待确认", type: "warning" },
  ENABLED: { label: "启用", type: "success" },
  DISABLED: { label: "停用", type: "info" },
} as const;
</script>

<template>
  <el-tag
    :type="
      props.type || (props.status ? statusMap[props.status]?.type : 'info')
    "
    size="small"
  >
    {{ props.label || (props.status ? statusMap[props.status]?.label : "") }}
  </el-tag>
</template>
