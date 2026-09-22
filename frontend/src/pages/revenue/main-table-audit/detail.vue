<template>
  <revenue-audit-workbench-detail :config="workbenchConfig" />
</template>

<script setup lang="ts">
import RevenueAuditWorkbenchDetail from "@/pages/revenue/subtable-workbench/components/RevenueAuditWorkbenchDetail.vue";
import {
  AUDIT_DOMAIN,
} from "@/pages/revenue/subtable-workbench/domain-config";

const workbenchConfig = {
  subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
  defaultStage: "S6",
  rootClass: "main-table-audit-detail",
  actionMode: "back",
  enableRecalculate: false,
  showUnitColumn: false,
};
</script>
