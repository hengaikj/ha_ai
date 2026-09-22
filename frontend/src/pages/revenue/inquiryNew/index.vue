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
          <el-form-item label="供应商编码" prop="supplierCode">
            <el-input v-model="queryParams.supplierCode" placeholder="请输入供应商编码" clearable />
          </el-form-item>
          <el-form-item label="供应商名称" prop="supplierChName">
            <el-input v-model="queryParams.supplierChName" placeholder="请输入供应商名称" clearable />
          </el-form-item>
          <el-form-item label="采购工程师" prop="purchase">
            <el-input v-model="queryParams.purchase" placeholder="请输入采购工程师" clearable />
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
      <el-table-column label="零件编号" prop="partNo" align="center" />
      <el-table-column
label="零件名称" align="center" prop="partName" header-align="center"
        :show-overflow-tooltip="true">
      </el-table-column>
      <el-table-column label="项目代码" prop="projectNo" align="center" :show-overflow-tooltip="true" />
      <el-table-column label="供应商编码" prop="supplierCode" align="center" />
      <el-table-column
label="供应商名称" prop="supplierChName" width="160" align="center" header-align="center"
        :show-overflow-tooltip="true" />
      <el-table-column
label="采购工程师" prop="purchase" align="center" header-align="center"
        :show-overflow-tooltip="true" />
      <el-table-column
label="公司" prop="company" align="center" header-align="center"
        :show-overflow-tooltip="true" />
    </el-table>

    <pagination
v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total"
      @pagination="getList" />
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { Search, RefreshRight } from '@element-plus/icons-vue';
import { BaseToast } from '@/components/base/BaseToast';
import { costList } from "@/api/revenue";

// ===== Template refs =====
 
const queryFormRef = ref<any>(null);
 
const _mainTableRef = ref<any>(null);

// ===== Reactive state =====
const showSearch = ref(true);
const sopTime = ref<string[]>([]);
const loading = ref(true);
const _ids = ref<number[]>([]);
const _multiple = ref(true);
const total = ref(0);
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
});

const queryParams = reactive(defaultQueryParams());

const _form = reactive({
  file: null as File | null,
});

// ===== Methods =====
function bodyKeyUp(e: KeyboardEvent): void {
  if (e.keyCode == 13) {
    handleQuery();
  }
}

function handleSelectionChange(): void {}

function getList(): void {
  loading.value = true;
  costList(queryParams).then((response: any) => {
    modelList.value = response.rows;
    total.value = response.total;
    loading.value = false;
  });
}

function handleQuery(): void {
  if ((queryParams as any).excludeTaxPriceStart && (queryParams as any).excludeTaxPriceEnd) {
    const start = Number((queryParams as any).excludeTaxPriceStart);
    const end = Number((queryParams as any).excludeTaxPriceEnd);
    if (end < start) {
      BaseToast.warning("不含税价结束值不能小于起始值");
      return;
    }
  }
  if (sopTime.value.length > 0) {
    (queryParams as any).eftDate = sopTime.value[0] + " 00:00:00";
    (queryParams as any).expDate = sopTime.value[1] + " 23:59:59";
  } else {
    (queryParams as any).eftDate = null;
    (queryParams as any).expDate = null;
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
