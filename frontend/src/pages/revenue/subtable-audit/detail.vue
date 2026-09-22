<template>
  <revenue-audit-workbench-detail :config="workbenchConfig" />
</template>

<script setup lang="ts">
import RevenueAuditWorkbenchDetail from "@/pages/revenue/subtable-workbench/components/RevenueAuditWorkbenchDetail.vue";
import {
  AUDIT_DOMAIN,
} from "@/pages/revenue/subtable-workbench/domain-config";

const workbenchConfig = {
  subjectDomain: AUDIT_DOMAIN.SUBTABLE,
  defaultStage: "S2",
  rootClass: "subtable-audit-detail",
  actionMode: "close",
  enableRecalculate: false,
  showUnitColumn: false,
};
</script>
