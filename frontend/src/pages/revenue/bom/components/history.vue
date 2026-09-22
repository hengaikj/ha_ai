<template>
  <div class="app-container">
    <div class="header-title">
      <el-button type="text" :icon="ArrowLeft" @click="$emit('change')"
        >返回
      </el-button>
      <div class="str">历史版本</div>
    </div>
    <!-- 查询条件区域 -->
    <!-- <el-form :inline="true" :model="searchForm" size="small"></el-form> -->
    <!-- 操作按钮区域 -->
    <div class="mb20">
      <!--      <el-button type="primary" >导出</el-button>-->
      <!--      <el-button type="primary" plain >批量删除</el-button>-->
      <!--      <el-button @click="batchChange" type="danger" plain>批量删除</el-button>-->
    </div>
    <!-- 数据表格区域 -->
    <el-table v-loading="loadingShow" :data="tableData" border>
      <!-- <el-table-column
          type="selection"
          width="50"
          align="center"
        ></el-table-column> -->
      <el-table-column
        label="序号"
        width="50"
        type="index"
        fixed="left"
        align="center"
      ></el-table-column>
      <el-table-column label="基础信息" align="center">
        <el-table-column
          label="项目代号"
          width="150"
          prop="projectName"
          align="center"
        ></el-table-column>
        <el-table-column
          label="工厂编号"
          width="100"
          prop="factoryCode"
          align="center"
        ></el-table-column>
        <el-table-column
          label="零件号"
          width="150"
          prop="partNumber"
          align="center"
        ></el-table-column>
        <el-table-column
          label="零件名称"
          :show-overflow-tooltip="true"
          width="150"
          prop="partName"
          align="center"
        ></el-table-column>
        <el-table-column
          label="SOR号"
          width="150"
          prop="sorNumber"
          align="center"
        ></el-table-column>
        <el-table-column
          label="SOR名称"
          width="150"
          prop="sorName"
          align="center"
        ></el-table-column>
        <el-table-column
          label="ECR号"
          width="150"
          prop="ecrNumber"
          :show-overflow-tooltip="true"
          align="center"
        ></el-table-column>
        <el-table-column
          label="ECR名称"
          width="150"
          prop="ecrName"
          align="center"
        ></el-table-column>
        <el-table-column
          label="装配级别"
          width="150"
          prop="assemblyLevel"
          align="center"
        ></el-table-column>

        <el-table-column
          label="零部件关键技术状态描述"
          width="200"
          prop="partTechDesc"
          align="center"
          :show-overflow-tooltip="true"
        ></el-table-column>
        <el-table-column
          label="单位用量"
          width="150"
          prop="unitUsage"
          align="center"
        ></el-table-column>
        <el-table-column
          label="模块标识"
          width="150"
          prop="moduleIdentifier"
          align="center"
        ></el-table-column>
        <el-table-column
          label="首用车型"
          width="150"
          prop="firstVehicleModel"
          align="center"
        ></el-table-column>
        <el-table-column
          label="供应商名称"
          :show-overflow-tooltip="true"
          width="150"
          prop="supplierName"
          align="center"
        ></el-table-column>
      </el-table-column>
      <el-table-column label="分类" align="center">
        <el-table-column
          label="通用化级别"
          width="150"
          prop="generalizationLevel"
          align="center"
        ></el-table-column>
        <el-table-column
          label="是否架构件"
          width="150"
          prop="isArchitectureComponent"
          align="center"
        ></el-table-column>
      </el-table-column>
      <el-table-column label="BOM补充信息" align="center">
        <el-table-column
          label="建议货源"
          width="150"
          prop="suggestedSupplySource"
          align="center"
        ></el-table-column>
        <el-table-column
          label="货源描述"
          width="150"
          prop="sourceDescription"
          align="center"
        ></el-table-column>
        <el-table-column
          label="多结构货源"
          width="150"
          prop="multiStructuredSupplySources"
          align="center"
        ></el-table-column>
        <el-table-column
          label="多结构货源货源描述"
          width="150"
          porp="multiSourcesDescription"
          align="center"
        ></el-table-column>
      </el-table-column>
      <el-table-column label="分工" align="center">
        <el-table-column
          label="研发专业部门"
          width="120"
          prop="developmentDepartment"
          align="center"
        ></el-table-column>
        <el-table-column
          label="专业工程师"
          width="120"
          prop="expertEngineer"
          align="center"
        ></el-table-column>
        <el-table-column
          label="零件属性"
          width="150"
          prop="partAttribute"
          align="center"
        ></el-table-column>
        <el-table-column
          label="成本专业科室"
          width="150"
          prop="firstClassification"
          align="center"
        ></el-table-column>
        <el-table-column
          label="成本二级分类"
          width="120"
          prop="secondClassification"
          align="center"
        ></el-table-column>
        <el-table-column
          label="成本三级分类"
          width="120"
          prop="threeClassification"
          align="center"
        ></el-table-column>
        <el-table-column
          label="成本工程师"
          width="120"
          prop="costEngineer"
          align="center"
        ></el-table-column>
        <!-- <el-table-column
          label="采购业务条线"
          width="120"
          prop="procurementBusinessLine"
          align="center"
        ></el-table-column> -->
        <el-table-column
          label="采购工程师"
          width="120"
          prop="procurementEngineer"
          align="center"
        ></el-table-column>
      </el-table-column>
      <el-table-column label="单车用量" align="center">
        <el-table-column
          v-for="(item, index) in costBomPattern"
          :key="'dancheyongliang' + index"
          :label="item.patternName"
          width="150"
          align="center"
          :prop="`list[${index}]`"
        ></el-table-column>
      </el-table-column>
      <el-table-column label="目标成本" align="center">
        <el-table-column
          label="材料成本（不含摊销）"
          width="180"
          prop="targetMaterialCost"
          align="center"
        >
          <template #default="scope">
            {{ formatPrice(scope.row.targetMaterialCost) }}
          </template>
        </el-table-column>
      </el-table-column>
      <el-table-column label="评估成本" align="center">
        <el-table-column
          label="材料成本（含摊销）"
          width="150"
          prop="assessMaterialCost"
          align="center"
        >
          <template #default="scope">
            {{ formatPrice(scope.row.assessMaterialCost) }}
          </template>
        </el-table-column>
        <el-table-column
          label="数据来源"
          width="150"
          prop="assessDataSources"
          align="center"
        ></el-table-column>
      </el-table-column>
      <el-table-column label="当前成本" align="center">
        <el-table-column
          label="当前-材料成本"
          width="150"
          prop="currentMaterialCostAmortize"
          align="center"
        >
          <template #default="scope">
            {{ formatPrice(scope.row.currentMaterialCostAmortize) }}
          </template>
        </el-table-column>
        <el-table-column
          label="材料成本（不含摊销）"
          width="180"
          prop="currentMaterialCost"
          align="center"
        >
          <template #default="scope">
            {{ formatPrice(scope.row.currentMaterialCost) }}
          </template>
        </el-table-column>
        <el-table-column
          label="摊销"
          width="150"
          prop="currentAmortize"
          align="center"
        >
          <template #default="scope">
            {{ formatPrice(scope.row.currentAmortize) }}
          </template>
        </el-table-column>
        <el-table-column
          label="数据来源"
          width="150"
          prop="currentDataSources"
          align="center"
        ></el-table-column>
                 <el-table-column
          label="询报价轮次"
          width="150"
          prop="bidRounds"
          align="center"
        ></el-table-column>
         <el-table-column
          label="出厂价格"
          width="150"
          prop="exFactoryPrice"
          align="center"
        ></el-table-column>
      </el-table-column>
      <el-table-column label="各版型目标成本统计（不含摊销）" align="center">
        <el-table-column
          v-for="(item, index) in costBomPattern"
          :key="'gebanxingmubiao' + index"
          :label="item.patternName"
          width="150"
          align="center"
          :prop="`targetCost[${index}]`"
        ></el-table-column>
      </el-table-column>
      <el-table-column label="各版型评估成本统计（不含摊销）" align="center">
        <el-table-column
          v-for="(item, index) in costBomPattern"
          :key="'gebanxingpinggu' + index"
          :label="item.patternName"
          width="150"
          align="center"
          :prop="`assessedCost[${index}]`"
        >
        </el-table-column>
      </el-table-column>
      <el-table-column label="各版型当前成本统计(不含摊销)" align="center">
        <el-table-column
          v-for="(item, index) in costBomPattern"
          :key="'gebanxingchengbenbuhan' + index"
          :label="item.patternName"
          width="150"
          align="center"
          :prop="`currentCost[${index}]`"
        ></el-table-column>
      </el-table-column>
      <el-table-column label=" 各版型当前成本统计(含摊销)" align="center">
        <el-table-column
          v-for="(item, index) in costBomPattern"
          :key="'gebanxingchengbenhan' + index"
          :label="item.patternName"
          width="150"
          :prop="`currentCostAmortize[${index}]`"
          align="center"
        ></el-table-column>
      </el-table-column>
      <el-table-column>
        <el-table-column
          label="当前版本"
          width="150"
          prop="version"
          align="center"
        >
          <template #default="scope">
            <span v-if="scope.row.version">V{{ scope.row.version }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="创建人"
          width="150"
          prop="createName"
          align="center"
        ></el-table-column>
        <el-table-column
          label="创建时间"
          width="200"
          prop="createTime"
          align="center"
        ></el-table-column>
        <el-table-column
          label="修改人"
          width="150"
          prop="updateBy"
          align="center"
        ></el-table-column>
        <el-table-column
          label="修改时间"
          width="200"
          prop="updateTime"
          align="center"
        ></el-table-column>
      </el-table-column>
    </el-table>
    <Pagination
      :total="searchForm.total"
      :page="searchForm.pageNum"
      :limit="searchForm.pageSize"
      @pagination="pagination"
    ></Pagination>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, onMounted } from "vue";
import { ArrowLeft } from "@element-plus/icons-vue";
import { bomListTwo } from "@/api/revenue";

const props = defineProps<{
  parentId: string | number;
}>();

const _emit = defineEmits<{
  (e: "change"): void;
}>();

// ============================================================
// 工具函数
// ============================================================

function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ============================================================
// 响应式状态
// ============================================================

const searchForm = ref<Record<string, unknown>>({
  pageSize: 10,
  total: 0,
  pageNum: 1,
  bomVersionId: "",
  version: "",
  partNumber: "",
  partName: "",
});
const tableData = ref<Record<string, unknown>[]>([{}]);
const loadingShow = ref(false);
const unfoldShow = ref(true);
const _tableId = ref<Record<string, unknown>[]>([]);
const costBomPattern = ref<Record<string, unknown>[]>([]);

// ============================================================
// 方法
// ============================================================

async function getList() {
  loadingShow.value = true;
  const res: any = await bomListTwo(searchForm.value);
  (tableData as any).value = res.rows as Record<string, unknown>[];
  let list: unknown[] = [];
  let targetCost: unknown[] = [];
  let assessedCost: unknown[] = [];
  let currentCost: unknown[] = [];
  let currentCostAmortize: unknown[] = [];
  tableData.value.forEach((item) => {
    if (item.costBomPattern) {
      list = [];
      targetCost = [];
      assessedCost = [];
      currentCost = [];
      currentCostAmortize = [];
      (item.costBomPattern as Record<string, unknown>[]).forEach((item1) => {
        list.push(item1.usagePerVehicle);
        targetCost.push(formatPrice(item1.targetCost as number | string | null));
        assessedCost.push(formatPrice(item1.assessedCost as number | string | null));
        currentCost.push(formatPrice(item1.currentCost as number | string | null));
        currentCostAmortize.push(
          formatPrice(item1.currentCostAmortize as number | string | null),
        );
        item.list = list;
        item.targetCost = targetCost;
        item.assessedCost = assessedCost;
        item.currentCost = currentCost;
        item.currentCostAmortize = currentCostAmortize;
      });
    }
  });
  loadingShow.value = false;
  (searchForm as any).value.total = res.total;
  (costBomPattern as any).value = (res.rows[0]?.costBomPattern ?? []) as Record<string, unknown>[];
}

function _handQuery() {
  searchForm.value.startTime = (searchForm.value.createTime as string[]) ? (searchForm.value.createTime as string[])[0] : "";
  searchForm.value.endTime = (searchForm.value.createTime as string[]) ? (searchForm.value.createTime as string[])[1] : "";
  searchForm.value.pageNum = 1;
  getList();
}

function _resetForm() {
  searchForm.value = {
    pageSize: 10,
    total: 0,
    pageNum: 1,
    bomVersionId: "",
    version: "",
    partNumber: "",
    partName: "",
  };
  (searchForm.value as Record<string, unknown>).createTime = [];
  getList();
}

function pagination(page: { limit: number; page: number }) {
  searchForm.value.pageSize = page.limit;
  searchForm.value.pageNum = page.page;
  getList();
}

function _toggleUnfold() {
  unfoldShow.value = !unfoldShow.value;
}

// ============================================================
// 生命周期
// ============================================================

onMounted(() => {
  searchForm.value.parentId = props.parentId;
  getList();
});

void _tableId.value;
void _handQuery;
void _resetForm;
void _toggleUnfold;
</script>

<style scoped lang="scss">
// 组件容器样式
.wbs-list-container {
  padding: 20px;
}

.wbs-list-container-box {
  background: #fff;
  padding: 20px 15px 20px 15px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

// 抽屉底部样式
.drawer-footer {
  position: absolute;
  bottom: 0px;
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

// 上传组件样式
.upload-demo {
  width: 100%;

  .el-upload {
    width: 100% !important;
  }

  .el-upload-dragger {
    width: 100% !important;
  }
}

// 标题相关样式
.boottm-title {
  margin-top: 35px;
}

// 抽屉样式
.custom-drawer {
  position: absolute !important;
  right: 0;
  top: 50px;
  bottom: 0;
  width: 100% !important;
  overflow-y: hidden;
  margin: 0 !important;
  border-radius: 0;

  .el-drawer__header {
    margin-bottom: 0 !important;
  }

  .el-drawer__body {
    overflow-y: hidden;
  }
}

//表格弹窗

.custom-popover-content ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.custom-popover-content li {
  padding: 5px;
}

.custom-popover-box {
  border: 1px solid #999999;
}

.custom-popover-content-li {
  border-top: 1px solid #999999;
}

.custom-popover-content-title {
  background: rgba(24, 144, 255, 0.5);
  padding: 5px;
}

.form-item-box {
  display: flex;
  justify-content: flex-start;
  gap: 40px;
  margin-top: 20px;
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
</style>
