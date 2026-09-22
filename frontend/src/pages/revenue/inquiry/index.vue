<template>
  <div class="app-container">
    <AppSearchBox v-show="showSearch" max-width>
      <template #itmes>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" size="small">
          <el-form-item label="零件编号" prop="partNo">
            <el-input v-model="queryParams.partNo" placeholder="请输入零件编号" clearable />
          </el-form-item>
          <el-form-item label="零件名称" prop="partName">
            <el-input v-model="queryParams.partName" placeholder="请输入零件名称" clearable />
          </el-form-item>
          <el-form-item label="项目代码" prop="projectNo">
            <el-input v-model="queryParams.projectNo" placeholder="请输入项目代码" clearable />
          </el-form-item>
          <el-form-item label="工厂编码" prop="factoryCode">
            <el-input v-model="queryParams.factoryCode" placeholder="请输入工厂编码" clearable />
          </el-form-item>
          <el-form-item label="工厂名称" prop="factoryName">
            <el-input v-model="queryParams.factoryName" placeholder="请输入工厂名称" clearable />
          </el-form-item>
          <el-form-item label="价格类型">
            <el-select v-model="queryParams.priceFlag" placeholder="请选择">
              <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value">
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="不含税价">
            <div style="display: flex; gap: 8px; align-items: center">
              <el-input
v-model="queryParams.excludeTaxPriceStart" type="number" placeholder="起" clearable
                precision="3" style="width: 100%" />
              <span style="color: #666">至</span>
              <el-input
v-model="queryParams.excludeTaxPriceEnd" type="number" placeholder="止" clearable precision="3"
                 style="width: 100%" />
            </div>
          </el-form-item>
          <el-form-item label="供应商编码" prop="supplierCode">
            <el-input v-model="queryParams.supplierCode" placeholder="请输入供应商编码" clearable />
          </el-form-item>
          <el-form-item label="供应商名称" prop="supplierChName">
            <el-input v-model="queryParams.supplierChName" placeholder="请输入供应商名称" clearable />
          </el-form-item>
          <el-form-item label="采购工程师" prop="purchase">
            <el-input v-model="queryParams.purchase" placeholder="请输入采购工程师" clearable />
          </el-form-item>
          <el-form-item label="量产/售后">
            <el-select v-model="queryParams.productServiceFlag" placeholder="请选择">
              <el-option v-for="item in lcshOptions" :key="item.value" :label="item.label" :value="item.value">
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="有效时间" prop="sopTime">
            <el-date-picker
v-model="sopTime" type="daterange" range-separator="至" start-placeholder="开始日期"
              value-format="yyyy-MM-dd" end-placeholder="结束日期">
            </el-date-picker>
          </el-form-item>
        </el-form>
      </template>
      <template #btns>
        <el-button type="primary" size="mini" :icon="Search" @click="handleQuery">搜索
        </el-button>
        <el-button :icon="RefreshRight" size="mini" @click="resetQuery">重置
        </el-button>
      </template>
    </AppSearchBox>
    <div style="margin-bottom: 35px">
      <right-toolbar v-model:show-search="showSearch" @query-table="getList"></right-toolbar>
    </div>

    <el-table
ref="mainTableRef" v-loading="loading" :data="modelList" border style="width: 100%"
      height="calc(100vh - 340px)" @selection-change="handleSelectionChange">
      <el-table-column fixed type="selection" width="50" align="center" header-align="center"></el-table-column>
      <el-table-column label="序号" align="center" width="50">
        <template #default="scope">
          {{ scope.$index + 1 }}
        </template>
      </el-table-column>
      <el-table-column label="零件编号" prop="partNo" align="center" width="140" />
      <el-table-column
label="零件名称" align="center" width="160" prop="partName" header-align="center"
        :show-overflow-tooltip="true">
      </el-table-column>
      <el-table-column label="项目代码" prop="projectNo" align="center" width="120" :show-overflow-tooltip="true" />
      <el-table-column label="工厂编码" prop="factoryCode" width="100" align="center" />
      <el-table-column label="工厂名称" align="center" header-align="center" :show-overflow-tooltip="true" width="150">
        <template #default="scope">
          {{ scope.row.factoryName }}
        </template>
      </el-table-column>
      <el-table-column label="不含税价" prop="excludeTaxPrice" width="120" align="center">
        <template #default="scope">
          {{ formatPrice3(scope.row.excludeTaxPrice, 3) || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="含摊销价" prop="amortizePrice" width="120" align="center">
        <template #default="scope">
          {{ formatPrice3(scope.row.amortizePrice, 3) || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="不含摊销价" prop="noAmortizePrice" width="120" align="center">
        <template #default="scope">
          {{ formatPrice3(scope.row.noAmortizePrice, 3) || "-" }}
        </template>
      </el-table-column>


      <el-table-column label="配额" prop="supplierRatio" width="120" align="center">
      </el-table-column>
      <el-table-column label="包装费" prop="wrapCost" width="120" align="center">
        <template #default="scope">
          {{ formatPrice3(scope.row.wrapCost, 3) || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="物流费" prop="freightCost" width="120" align="center">
        <template #default="scope">
          {{ formatPrice3(scope.row.freightCost, 3) || "-" }}
        </template>
      </el-table-column>

      <el-table-column label="度量单位" prop="unitName" width="80" align="center"></el-table-column>
      <el-table-column label="价格单位" prop="priceUnitName" width="80" align="center"></el-table-column>
      <el-table-column label="订单单位" prop="orderUnitName" width="80" align="center"></el-table-column>
      <el-table-column label="转换系数" prop="conversionCoefficient" width="80" align="center"></el-table-column>
      <el-table-column label="生效时间" prop="eftDate" width="160" align="center" />
      <el-table-column label="失效时间" prop="expDate" width="160" align="center" />
      <el-table-column label="传输时间" prop="transmitDate" width="160" align="center" />
      <el-table-column label="价格类型" prop="priceFlag" align="center" width="80" />
      <el-table-column label="量产/售后" prop="productServiceFlag" align="center" width="80" />

      <el-table-column label="供应商编码" prop="supplierCode" width="110" align="center" />
      <el-table-column
label="供应商名称" prop="supplierChName" width="160" align="center" header-align="center"
        :show-overflow-tooltip="true" />
      <el-table-column
label="采购工程师" prop="purchase" width="100" align="center" header-align="center"
        :show-overflow-tooltip="true" />
      <el-table-column
label="公司" prop="company" width="120" align="center" header-align="center"
        :show-overflow-tooltip="true" />
    </el-table>

    <pagination
v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total"
      @pagination="getList" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { Search, RefreshRight } from '@element-plus/icons-vue';
import { BaseToast } from '@/components/base/BaseToast';
import { costList } from "@/api/revenue";

// ===== Template refs =====
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queryFormRef = ref<any>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _mainTableRef = ref<any>(null);

// ===== Constants =====
const typeOptions = [
  { value: "", label: "全部" },
  { value: "R", label: "合同价(R)" },
  { value: "E", label: "预估价(E)" },
];

const lcshOptions = [
  { value: "", label: "全部" },
  { value: "LC", label: "量产(LC)" },
  { value: "SH", label: "售后(SH)" },
];

// ===== Reactive state =====
const showSearch = ref(true);
const sopTime = ref<string[]>([]);
const loading = ref(true);
const _ids = ref<number[]>([]);
const _multiple = ref(true);
const total = ref(0);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelList = ref<any[]>([]);
const _title = ref("");
const _open = ref(false);

const defaultQueryParams = () => ({
  pageNum: 1,
  pageSize: 10,
  partNo: null as string | null,
  projectNo: null as string | null,
  partName: null as string | null,
  projectName: null as string | null,
  purchase: null as string | null,
  priceFlag: null as string | null,
  supplierCode: null as string | null,
  supplierChName: null as string | null,
  factoryCode: null as string | null,
  factoryName: null as string | null,
  excludeTaxPriceStart: null as number | null,
  excludeTaxPriceEnd: null as number | null,
  productServiceFlag: null as string | null,
  eftDate: null as string | null,
  expDate: null as string | null,
});

const queryParams = reactive(defaultQueryParams());

const _form = reactive({
  file: null as File | null,
});

// ===== Methods =====
function formatPrice3(value: number | string | null, decimals = 3): string | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num.toFixed(decimals);
}

function bodyKeyUp(e: KeyboardEvent): void {
  if (e.keyCode == 13) {
    handleQuery();
  }
}

function handleSelectionChange(): void {}

 
function _typeText(key: string): string {
  return typeOptions.find((item) => item.value == key)?.label || "";
}

function getList(): void {
  loading.value = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  costList(queryParams).then((response: any) => {
    modelList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  });
}

function handleQuery(): void {
  if (queryParams.excludeTaxPriceStart && queryParams.excludeTaxPriceEnd) {
    const start = Number(queryParams.excludeTaxPriceStart);
    const end = Number(queryParams.excludeTaxPriceEnd);
    if (end < start) {
      BaseToast.warning("不含税价结束值不能小于起始值");
      return;
    }
  }
  if (sopTime.value.length > 0) {
    queryParams.eftDate = sopTime.value[0] + " 00:00:00";
    queryParams.expDate = sopTime.value[1] + " 23:59:59";
  } else {
    queryParams.eftDate = null;
    queryParams.expDate = null;
  }
  queryParams.pageNum = 1;
  getList();
}

function resetQuery(): void {
  Object.assign(queryParams, defaultQueryParams());
  sopTime.value = [];
  if (queryFormRef.value) {
    queryFormRef.value.resetFields();
  }
  handleQuery();
}

// ===== Lifecycle =====
onMounted(() => {
  getList();
  window.addEventListener("keyup", bodyKeyUp);
});

onUnmounted(() => {
  window.removeEventListener("keyup", bodyKeyUp);
});

void _mainTableRef.value;
void _ids.value;
void _multiple.value;
void _title.value;
void _open.value;
void _form;
void _typeText;
</script>

<style scoped>
.form-item-box {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
}


.form-item-box .el-form-item {
  margin-right: 0;
}

.form-btn-group {
  flex-shrink: 0;
  align-items: flex-end;
  display: flex;
  margin-left: auto;
}

.drawer-footer {
  position: absolute;
  bottom: 0px;
  left: 0;
  width: 100%;
  height: 60px;
  padding-right: 25px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: all 0.3s ease;
}
</style>
