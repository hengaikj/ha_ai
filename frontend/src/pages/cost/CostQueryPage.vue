<script setup lang="ts">
import { reactive, ref } from "vue";
import { ArrowDown, ArrowRight } from "@element-plus/icons-vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import { fetchCostQueryPrices } from "@/api/cost-center";
import type { CostQueryPriceItem } from "@/types/cost-center";

type PriceType = "" | "R" | "E";
type SaleStage = "" | "LC" | "SH";

type CostQueryForm = {
  partNo: string;
  partName: string;
  projectCode: string;
  factoryCode: string;
  factoryName: string;
  priceType: PriceType;
  minTaxExcludedPrice: string;
  maxTaxExcludedPrice: string;
  supplierCode: string;
  supplierName: string;
  engineer: string;
  saleStage: SaleStage;
  validDateRange: [string, string] | [];
};

type CostQueryRow = {
  id: number;
  partNo: string;
  partName: string;
  projectCode: string;
  factoryCode: string;
  factoryName: string;
  taxExcludedPrice: number;
  taxIncludedSellingPrice: number | null;
  taxExcludedSellingPrice: number;
  quota: string;
  packagingCost: number | null;
  logisticsCost: number | null;
  measureUnit: string;
  priceUnit: string;
  orderUnit: string;
  conversionCoefficient: string;
  supplierCode: string;
  supplierName: string;
  engineer: string;
  priceType: PriceType;
  saleStage: SaleStage;
  validFrom: string;
  validTo: string;
  transmittedAt: string;
  company: string;
};

type QueryTableExpose = {
  search: () => void;
  getTableRef?: () => {
    toggleRowExpansion?: (row: unknown, expanded?: boolean) => void;
  } | null;
};

const typeOptions: Array<{ value: PriceType; label: string }> = [
  { value: "", label: "全部" },
  { value: "R", label: "合同价（R）" },
  { value: "E", label: "预估价（E）" },
];

const query = reactive<CostQueryForm>({
  partNo: "",
  partName: "",
  projectCode: "",
  factoryCode: "",
  factoryName: "",
  priceType: "",
  minTaxExcludedPrice: "",
  maxTaxExcludedPrice: "",
  supplierCode: "",
  supplierName: "",
  engineer: "",
  saleStage: "",
  validDateRange: [],
});

const queryTableRef = ref<QueryTableExpose | null>(null);
const expandedRowIds = ref(new Set<number>());

function costQueryFilter() {
  const [validFrom, validTo] = query.validDateRange;
  return {
    partNo: readText(query.partNo),
    partName: readText(query.partName),
    projectNo: readText(query.projectCode),
    factoryCode: readText(query.factoryCode),
    factoryName: readText(query.factoryName),
    priceFlag: query.priceType || undefined,
    supplierCode: readText(query.supplierCode),
    supplierChName: readText(query.supplierName),
    productServiceFlag: query.saleStage || undefined,
    purchase: readText(query.engineer),
    excludeTaxPriceStart: readNumber(query.minTaxExcludedPrice),
    excludeTaxPriceEnd: readNumber(query.maxTaxExcludedPrice),
    eftDate: validFrom ? `${validFrom} 00:00:00` : undefined,
    expDate: validTo ? `${validTo} 23:59:59` : undefined,
  };
}

async function queryCostRows(pageSize: number, pageNo: number) {
  const page = await fetchCostQueryPrices({
    ...costQueryFilter(),
    pageNo,
    pageSize,
  });

  return {
    total: page.total ?? 0,
    list: page.records.map(toCostQueryRow),
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function toCostQueryRow(item: CostQueryPriceItem): CostQueryRow {
  return {
    id: item.priceId,
    partNo: item.partNo,
    partName: item.partName || "",
    projectCode: item.projectNo || "",
    factoryCode: item.factoryCode || "",
    factoryName: item.factoryName || "",
    taxExcludedPrice: toNumber(item.excludeTaxPrice),
    taxIncludedSellingPrice: toNullableNumber(item.amortizePrice),
    taxExcludedSellingPrice: toNumber(item.noAmortizePrice),
    quota: item.supplierRatio || "",
    packagingCost: toNullableNumber(item.wrapCost),
    logisticsCost: toNullableNumber(item.freightCost),
    measureUnit: item.measureUnitName || "",
    priceUnit: item.priceUnitName || "",
    orderUnit: item.orderUnitName || "",
    conversionCoefficient: item.conversionCoefficient || "",
    supplierCode: item.supplierCode || "",
    supplierName: item.supplierName || "",
    engineer: item.purchase || "",
    priceType:
      item.priceFlag === "R" || item.priceFlag === "E" ? item.priceFlag : "",
    saleStage:
      item.productServiceFlag === "LC" || item.productServiceFlag === "SH"
        ? item.productServiceFlag
        : "",
    validFrom: item.effectiveStartAt || "",
    validTo: item.effectiveEndAt || "",
    transmittedAt: item.transmitAt || "",
    company: item.company || "",
  };
}

function resetQuery() {
  Object.assign(query, {
    partNo: "",
    partName: "",
    projectCode: "",
    factoryCode: "",
    factoryName: "",
    priceType: "",
    minTaxExcludedPrice: "",
    maxTaxExcludedPrice: "",
    supplierCode: "",
    supplierName: "",
    engineer: "",
    saleStage: "",
    validDateRange: [],
  });
}

function searchCostRows() {
  queryTableRef.value?.search();
}

function toggleRowExpand(row: CostQueryRow) {
  const expanded = expandedRowIds.value.has(row.id);
  queryTableRef.value?.getTableRef?.()?.toggleRowExpansion?.(row, !expanded);
  const nextIds = new Set(expandedRowIds.value);
  if (expanded) {
    nextIds.delete(row.id);
  } else {
    nextIds.add(row.id);
  }
  expandedRowIds.value = nextIds;
}

function handleRowClick(
  row: CostQueryRow,
  _column: unknown,
  event: MouseEvent,
) {
  const target = event.target as HTMLElement | null;
  if (target?.closest("button, input, .el-checkbox, .cost-query-page__part-expand")) {
    return;
  }
  toggleRowExpand(row);
}

function readText(value: string) {
  return value.trim() || undefined;
}

function readNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : undefined;
}

function toNumber(value?: string | null) {
  return value ? Number(value) : 0;
}

function toNullableNumber(value?: string | null) {
  return value ? Number(value) : null;
}

function formatMoney(value: number | null) {
  return value === null ? "-" : value.toFixed(3);
}

function formatValidityDate(value: string) {
  const text = value.trim();
  if (!text) {
    return "--";
  }
  return text.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || text;
}

function resolvePriceTypeLabel(value: PriceType) {
  return typeOptions.find((item) => item.value === value)?.label || "--";
}

function resolveSaleStageLabel(value: SaleStage) {
  return value === "LC" ? "量产" : value === "SH" ? "售后" : "--";
}
</script>

<template>
  <PageContainer title="成本查询" class="cost-query-page">
    <QueryTable
      ref="queryTableRef"
      :func="queryCostRows"
      row-key="id"
      show-toolbar
      fit-table-height
      :table-props="{
        scrollbarAlwaysOn: true,
        tableLayout: 'fixed',
      }"
      :search-form-props="{ defaultExpanded: false }"
      empty-title="暂无成本数据"
      empty-description="当前筛选条件下没有可展示的成本数据。"
      @reset="resetQuery"
      @row-click="handleRowClick"
    >
      <template #search>
        <el-form :model="query" @submit.prevent>
          <el-form-item label="零件号">
            <el-input
              v-model="query.partNo"
              clearable
              placeholder="请输入零件号"
              @keyup.enter="searchCostRows"
            />
          </el-form-item>
          <el-form-item label="零件名称">
            <el-input
              v-model="query.partName"
              clearable
              placeholder="请输入零件名称"
              @keyup.enter="searchCostRows"
            />
          </el-form-item>
          <el-form-item label="项目代号">
            <el-input
              v-model="query.projectCode"
              clearable
              placeholder="请输入项目代号"
              @keyup.enter="searchCostRows"
            />
          </el-form-item>
          <el-form-item label="工厂代码">
            <el-input
              v-model="query.factoryCode"
              clearable
              placeholder="请输入工厂代码"
            />
          </el-form-item>
          <el-form-item label="工厂名称">
            <el-input
              v-model="query.factoryName"
              clearable
              placeholder="请输入工厂名称"
            />
          </el-form-item>
          <el-form-item label="价格类型">
            <el-select
              v-model="query.priceType"
              clearable
              placeholder="请选择价格类型"
            >
              <el-option
                v-for="item in typeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="不含税价">
            <div class="cost-query-page__range">
              <el-input
                v-model="query.minTaxExcludedPrice"
                clearable
                placeholder="最小值"
              />
              <span>至</span>
              <el-input
                v-model="query.maxTaxExcludedPrice"
                clearable
                placeholder="最大值"
              />
            </div>
          </el-form-item>
          <el-form-item label="供应商编码">
            <el-input
              v-model="query.supplierCode"
              clearable
              placeholder="请输入供应商编码"
            />
          </el-form-item>
          <el-form-item label="供应商名称">
            <el-input
              v-model="query.supplierName"
              clearable
              placeholder="请输入供应商名称"
            />
          </el-form-item>
          <el-form-item label="采购工程师">
            <el-input
              v-model="query.engineer"
              clearable
              placeholder="请输入采购工程师"
            />
          </el-form-item>
          <el-form-item label="量产/售后">
            <el-select
              v-model="query.saleStage"
              clearable
              placeholder="请选择阶段"
            >
              <el-option label="量产" value="LC" />
              <el-option label="售后" value="SH" />
            </el-select>
          </el-form-item>
          <el-form-item label="有效时间">
            <el-date-picker
              v-model="query.validDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <!--        <PermissionButton plain @click="syncSrmContractPrices"-->
        <!--          >同步合同价</PermissionButton-->
        <!--        >-->
      </template>

      <el-table-column type="selection" width="42" />
      <el-table-column
        type="expand"
        width="1"
        class-name="cost-query-page__expand-host"
      >
        <template #default="{ row }">
          <div class="cost-query-page__detail">
            <!--            <div class="cost-query-page__detail-title">价格明细</div>-->
            <el-descriptions :column="3" border size="small">
              <el-descriptions-item label="含摊销价">{{
                formatMoney(row.taxIncludedSellingPrice)
              }}</el-descriptions-item>
              <el-descriptions-item label="度量单位">{{
                row.measureUnit || "--"
              }}</el-descriptions-item>
              <el-descriptions-item label="传输时间">{{
                row.transmittedAt || "--"
              }}</el-descriptions-item>
              <el-descriptions-item label="不含摊销价">{{
                formatMoney(row.taxExcludedSellingPrice)
              }}</el-descriptions-item>
              <el-descriptions-item label="价格单位">{{
                row.priceUnit || "--"
              }}</el-descriptions-item>
              <el-descriptions-item label="价格类型">{{
                resolvePriceTypeLabel(row.priceType)
              }}</el-descriptions-item>
              <el-descriptions-item label="转换系数">{{
                row.conversionCoefficient || "--"
              }}</el-descriptions-item>
              <el-descriptions-item label="订单单位">{{
                row.orderUnit || "--"
              }}</el-descriptions-item>
              <el-descriptions-item label="公司">{{
                row.company || "--"
              }}</el-descriptions-item>
            </el-descriptions>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        prop="partNo"
        label="零件号"
        width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span class="cost-query-page__part-cell">
            <el-icon
              class="cost-query-page__part-expand"
              :class="{ 'is-expanded': expandedRowIds.has(row.id) }"
              :aria-label="expandedRowIds.has(row.id) ? '收起明细' : '展开明细'"
              @click.stop="toggleRowExpand(row)"
            >
              <ArrowDown v-if="expandedRowIds.has(row.id)" />
              <ArrowRight v-else />
            </el-icon>
            <span>{{ row.partNo }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column
        prop="partName"
        label="零件名称"
        width="140"
        show-overflow-tooltip
      />
      <el-table-column prop="projectCode" label="项目代号" width="110" />
      <el-table-column prop="factoryCode" label="工厂代码" width="100" />
      <el-table-column prop="factoryName" label="工厂名称" min-width="130" />
      <el-table-column label="不含税价" width="120" align="right"
        ><template #default="{ row }">{{
          formatMoney(row.taxExcludedPrice)
        }}</template></el-table-column
      >
      <el-table-column label="含摊销价" width="120" align="right"
        ><template #default="{ row }">{{
          formatMoney(row.taxIncludedSellingPrice)
        }}</template></el-table-column
      >
      <el-table-column label="不含摊销价" width="120" align="right"
        ><template #default="{ row }">{{
          formatMoney(row.taxExcludedSellingPrice)
        }}</template></el-table-column
      >
      <el-table-column prop="quota" label="配额" width="90" align="right" />
      <el-table-column label="包装费" width="120" align="right"
        ><template #default="{ row }">{{
          formatMoney(row.packagingCost)
        }}</template></el-table-column
      >
      <el-table-column label="物流费" width="120" align="right"
        ><template #default="{ row }">{{
          formatMoney(row.logisticsCost)
        }}</template></el-table-column
      >
      <el-table-column prop="measureUnit" label="度量单位" width="80" />
      <el-table-column prop="priceUnit" label="价格单位" width="80" />
      <el-table-column prop="orderUnit" label="订单单位" width="80" />
      <el-table-column
        prop="conversionCoefficient"
        label="转换系数"
        width="80"
      />
      <el-table-column label="有效时间" width="100" align="center">
        <template #default="{ row }">{{ formatValidityDate(row.validFrom) }}</template>
      </el-table-column>
      <el-table-column label="失效时间" width="100" align="center">
        <template #default="{ row }">{{ formatValidityDate(row.validTo) }}</template>
      </el-table-column>
      <el-table-column prop="transmittedAt" label="传输时间" width="160" />
      <el-table-column label="价格类型" width="100" align="center">
        <template #default="{ row }">{{ resolvePriceTypeLabel(row.priceType) }}</template>
      </el-table-column>
      <el-table-column label="量产/售后" width="100" align="center">
        <template #default="{ row }">{{ resolveSaleStageLabel(row.saleStage) }}</template>
      </el-table-column>
      <el-table-column
        prop="supplierCode"
        label="供应商编码"
        min-width="130"
        show-overflow-tooltip
      />
      <el-table-column
        prop="supplierName"
        label="供应商名称"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column prop="engineer" label="采购工程师" width="110" />
      <el-table-column prop="company" label="公司" min-width="120" show-overflow-tooltip />
    </QueryTable>
  </PageContainer>
</template>

<style scoped>
.cost-query-page__range {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) auto minmax(72px, 1fr);
  gap: 8px;
  align-items: center;
}

.cost-query-page__detail {
  width: var(--bq-table-viewport-width, 100%);
  max-width: none;
  min-width: 0;
  box-sizing: border-box;
  margin: 0;
  overflow: hidden;
  padding: 12px 18px 16px 18px;
  transform: translate3d(var(--bq-table-scroll-left, 0px), 0, 0);
  background: var(--bq-color-surface);
  border-top: 1px solid var(--bq-color-border-subtle);
}

.cost-query-page__detail-title {
  margin-bottom: 10px;
  color: var(--bq-color-text);
  font-weight: 600;
}

.cost-query-page__detail :deep(.el-descriptions__table) {
  table-layout: fixed;
  width: 100%;
  max-width: 100%;
  background: var(--bq-color-surface);
}

.cost-query-page__detail :deep(.el-descriptions) {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.cost-query-page__detail :deep(.el-descriptions__label) {
  width: 104px;
  min-width: 104px;
  white-space: nowrap;
  background-color: #fcfcfc;
  font-weight: 500 !important;
}

.cost-query-page__detail :deep(.el-descriptions__content) {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--bq-color-text);
  font-variant-numeric: tabular-nums;
}

.cost-query-page__detail :deep(.el-descriptions__cell) {
  min-width: 0;
  height: 38px;
  padding: 8px 12px;
}

.cost-query-page :deep(.base-search-form) {
  padding: 2px 0;
}

.cost-query-page :deep(.el-table__expanded-cell) {
  padding: 0;
  background: var(--bq-color-surface);
}

.cost-query-page :deep(.el-table__body tr) {
  cursor: pointer;
}

.cost-query-page :deep(.el-table-column--selection .cell) {
  padding-inline: 8px;
  text-align: center;
}

.cost-query-page :deep(.el-table__expand-column .cell) {
  padding-inline: 0;
  text-align: center;
}

.cost-query-page :deep(.cost-query-page__expand-host) {
  padding: 0;
  border-right: 0;
}

.cost-query-page :deep(.cost-query-page__expand-host .cell) {
  width: 0;
  padding: 0;
}

.cost-query-page :deep(.cost-query-page__expand-host .el-table__expand-icon) {
  visibility: hidden;
  pointer-events: none;
}

.cost-query-page__part-cell {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.cost-query-page__part-expand {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: var(--bq-color-primary);
  cursor: pointer;
}

.cost-query-page__part-expand:hover,
.cost-query-page__part-expand.is-expanded {
  color: var(--bq-color-primary-active);
}

.cost-query-page :deep(.el-table__expand-icon) {
  margin: 0;
}

.cost-query-page :deep(.el-table th:nth-child(3) .cell),
.cost-query-page :deep(.el-table td:nth-child(3) .cell) {
  padding-inline: 8px;
}

@media (max-width: 1100px) {
  .cost-query-page__detail {
    padding-inline: 12px;
  }
}
</style>
