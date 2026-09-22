<script setup lang="ts">
import { computed } from "vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { formatMoney } from "@/utils/formatters";
import { useAuthStore } from "@/stores/auth";

type DetailItem = {
  label: string;
  value: string;
};

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    row?: Record<string, any> | null;
    marker?: number;
    valveName?: string;
  }>(),
  {
    row: null,
    marker: 0,
    valveName: "",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();
const authStore = useAuthStore();
const canDisplayEvaluation = computed(() =>
  authStore.hasPermission("system:project:eva:display"),
);

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

function resolveValveBudgetList() {
  return (resolveValue("valveBudgetInfoVoList") || []) as any[];
}

function yusuanZong(list: any[] | undefined, remark = false) {
  if (!list) return "";
  const cur = list.find((item: any) => String(item.type) === "1");
  if (!cur) return "";
  return remark ? cur.remark || "" : formatAmount(cur.budget);
}

function valveType(list: any[] | undefined, num: number, remark = false) {
  if (!list) return "";
  const cur = list.find((item: any) => String(item.valveType) === String(num));
  if (!cur) return "";
  return remark ? cur.remark || "" : formatAmount(cur.budget);
}

const title = "查看";

const detailItems = computed<DetailItem[]>(() => {
  const valveList = resolveValveBudgetList();
  const items: DetailItem[] = [
    { label: "层级", value: formatText(resolveValue("level")) },
    { label: "WBS", value: formatText(resolveValue("wbsNumber")) },
    { label: "WBS名称", value: formatText(resolveValue("wbsName")) },
    { label: "预算总金额", value: yusuanZong(valveList) },
    { label: "总费用说明", value: yusuanZong(valveList, true) },
    { label: "阀点已占用金额", value: valveType(valveList, 0) },
    { label: "阀点已占用费用说明", value: valveType(valveList, 0, true) },
    { label: `${props.valveName}阀点释放预算`, value: valveType(valveList, 1) },
    { label: "阀点释放费用说明", value: valveType(valveList, 1, true) },
  ];

  if (canDisplayEvaluation.value) {
    items.push(
      { label: `${props.valveName}阀点释放评估`, value: valveType(valveList, 2) },
      { label: "评估说明", value: valveType(valveList, 2, true) },
      { label: "支付比例", value: formatRatio(resolveValue("paymentRatio")) },
      {
        label: "支付评估金额",
        value: formatAmount(resolveValue("paymentEstimate")),
      },
      { label: "核减差值", value: formatAmount(resolveValue("reductionDiff")) },
      { label: "核减比例", value: formatRatio(resolveValue("reductionRatio")) },
    );
  }

  return items;
});
</script>

<template>
  <BaseFormDialog
    v-model="visible"
    class="budget-gate-review-compare-wbs-dialog"
    :title="title"
    width="850px"
    :show-footer="false"
    body-max-height="calc(100vh - 212px)"
  >
    <div class="budget-gate-review-compare-wbs-dialog__body">
      <section class="dialog-section">
        <div class="field-grid">
          <div v-for="item in detailItems" :key="item.label" class="field-item">
            <span class="field-label">{{ item.label }}:</span>
            <span class="field-value">{{ item.value }}</span>
          </div>
        </div>
      </section>
    </div>
  </BaseFormDialog>
</template>

<style scoped>
.budget-gate-review-compare-wbs-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 28px;
  align-items: center;
}

.dialog-section {
  display: flex;
  flex-direction: column;
  gap: 0;
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
