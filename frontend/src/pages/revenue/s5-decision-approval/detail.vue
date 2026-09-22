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
  defaultStage: "S5",
  rootClass: "s5-decision-approval-detail",
  actionMode: "back",
  enableRecalculate: false,
  s5Mode: "decision_approval",
  showUnitColumn: false,
};
</script>
