<script setup lang="ts">
import { computed } from "vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import { formatMoney } from "@/utils/formatters";

type DetailItem = {
  label: string;
  value: string;
};

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    row?: Record<string, any> | null;
    marker?: number;
    projectName?: string;
    patterns?: { id: number | string; patternName: string }[];
  }>(),
  {
    row: null,
    marker: 0,
    projectName: "",
    patterns: () => [],
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});

function formatText(value: unknown) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

function formatAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const text = formatMoney(value as never);
  return text || "";
}

function formatRatio(value: unknown) {
  return value === null || value === undefined || value === "" ? "" : `${value}%`;
}

function resetRatio(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  return String(value)
    .split(",")
    .map((item) => `${item}%`)
    .join("，");
}

function resolveValue(field: string) {
  const row = props.row ?? {};
  const prefix = `__BEIQI${props.marker ?? 0}__`;
  const prefixedKey = `${prefix}${field}`;
  if (Object.prototype.hasOwnProperty.call(row, prefixedKey)) {
    return row[prefixedKey];
  }
  if (Object.prototype.hasOwnProperty.call(row, field)) {
    return row[field];
  }
  return undefined;
}

function resolveGradeLevel() {
  const grade = resolveValue("grade") as Record<string, any> | undefined;
  return grade?.realLevel ?? grade?.level ?? "";
}

const title = "查看";

const reviewItems = computed<DetailItem[]>(() => [
  { label: "层级", value: formatText(resolveGradeLevel()) },
  { label: "WBS", value: formatText(resolveValue("wbsNumber")) },
  { label: "WBS名称", value: formatText(resolveValue("wbsName")) },
  { label: "预算总金额", value: formatAmount(resolveValue("totalBudgetAmount")) },
  { label: "总费用说明", value: formatText(resolveValue("remark")) },
  { label: "评估总金额", value: formatAmount(resolveValue("assessTotalAmount")) },
  { label: "支付比例", value: resetRatio(resolveValue("paymentRatio")) },
  { label: "支付评估金额", value: formatAmount(resolveValue("paymentEstimate")) },
  { label: "核减比例", value: formatRatio(resolveValue("reductionRatio")) },
]);

const reviewRecordItems = computed<DetailItem[]>(() => [
  { label: "支付", value: formatAmount(resolveValue("paymentAmount")) },
  { label: "摊销", value: formatAmount(resolveValue("amortizationAmount")) },
  { label: "合计", value: formatAmount(resolveValue("totalAmount")) },
  { label: "备注", value: formatText(resolveValue("remark")) },
  { label: "总金额超支", value: formatAmount(resolveValue("totalOverspend")) },
  { label: "支付超支", value: formatAmount(resolveValue("paymentOverspend")) },
]);
</script>

<template>
  <BaseFormDialog
    v-model="visible"
    class="budget-compare-wbs-dialog"
    :title="title"
    width="850px"
    :show-footer="false"
    body-max-height="calc(100vh - 212px)"
  >
    <div class="budget-compare-wbs-dialog__body">
      <section class="dialog-section">
        <BaseSectionTitle title="评审" size="small" heading-tag="h3" />
        <div class="field-grid">
          <div v-for="item in reviewItems" :key="item.label" class="field-item">
            <span class="field-label">{{ item.label }}:</span>
            <span class="field-value">{{ item.value }}</span>
          </div>
        </div>
      </section>

      <section class="dialog-section">
        <BaseSectionTitle title="评审记录" size="small" heading-tag="h3" />
        <div class="field-grid">
          <div v-for="item in reviewRecordItems" :key="item.label" class="field-item">
            <span class="field-label">{{ item.label }}:</span>
            <span class="field-value">{{ item.value }}</span>
          </div>
        </div>
      </section>
    </div>
  </BaseFormDialog>
</template>

<style scoped>
.budget-compare-wbs-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 28px;
  align-items: center;
}

.dialog-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 40px;
  row-gap: 16px;
  width: min(760px, 100%);
  margin: 0 auto;
}

.field-item {
  display: flex;
  min-width: 0;
  min-height: 24px;
  align-items: baseline;
  gap: 6px;
}

.field-label {
  flex: 0 0 auto;
  color: #606266;
  font-size: 14px;
  line-height: 22px;
  white-space: nowrap;
}

.field-value {
  min-width: 0;
  color: var(--el-color-primary);
  font-size: 14px;
  line-height: 22px;
  word-break: break-word;
}

.field-value:empty::before {
  content: "";
}

</style>
