<template>
  <el-dialog
    :title="pageHeaderTitle"
    :append-to-body="true"
    :fullscreen="true"
    :visible="true"
    :before-close="pageClose"
    custom-class="wbs-list-dialog"
  >
    <div>
      <editBom
        v-if="editBomShow"
        :backfill="backfillData"
        :mode="currentMode"
        @back="editBack"
      />
      <History
        v-if="historyParentId_"
        :parent-id="historyParentId_"
        @change="() => (historyParentId_ = null)"
      />
      <div v-if="!editBomShow && !historyParentId_" class="app-container">
        <!-- 查询条件区域 -->
        <AppSearchBox>
          <template #items>
            <el-form :inline="true" :model="searchForm" size="small">
              <el-form-item label="零件号">
                <el-input
                  v-model="searchForm.partNumber"
                  placeholder="请输入零件号"
                  clearable
                >
                </el-input>
              </el-form-item>

              <el-form-item label="零件名称">
                <el-input
                  v-model="searchForm.partName"
                  placeholder="请输入零件名称"
                  clearable
                >
                </el-input>
              </el-form-item>

              <el-form-item label="SOR名称">
                <el-input
                  v-model="searchForm.sorName"
                  placeholder="请输入SOR名称"
                  clearable
                >
                </el-input>
              </el-form-item>
              <el-form-item label="首用车型">
                <el-input
                  v-model="searchForm.firstVehicleModel"
                  placeholder="请输入首用车型"
                  clearable
                >
                </el-input>
              </el-form-item>

              <el-form-item label="供应商名称">
                <el-input
                  v-model="searchForm.supplierName"
                  placeholder="请输入供应商名称"
                  clearable
                >
                </el-input>
              </el-form-item>

              <el-form-item label="通用化级别">
                <el-input
                  v-model="searchForm.generalizationLevel"
                  placeholder="请输入通用化级别"
                  clearable
                >
                </el-input>
              </el-form-item>

              <el-form-item label="当前成本(含摊销)" class="span-3">
                <el-input
                  v-model="searchForm.currentMaterialCostAmortize"
                  type="number"
                  placeholder="请输入金额"
                >
                  <template #prepend>
                    <el-select
                    v-model="searchForm.currentMaterialCostAmortizeOperator"
                    placeholder="全部"
                    style="width: 76px"
                  >
                    <el-option label="全部" value=""></el-option>
                    <el-option label="≥" value="1"></el-option>
                    <el-option label="≤" value="2"></el-option>
                    <el-option label=">" value="3"></el-option>
                    <el-option label="<" value="4"></el-option>
                    <el-option label="空" value="9"></el-option>
                  </el-select>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="当前成本(不含摊销)" class="span-3">
                <el-input
                  v-model="searchForm.currentMaterialCost"
                  type="number"
                  placeholder="请输入金额"
                >
                  <template #prepend>
                    <el-select
                    v-model="searchForm.currentMaterialCostOperator"
                    placeholder="全部"
                    style="width: 76px"
                  >
                    <el-option label="全部" value=""></el-option>
                    <el-option label="≥" value="1"></el-option>
                    <el-option label="≤" value="2"></el-option>
                    <el-option label=">" value="3"></el-option>
                    <el-option label="<" value="4"></el-option>
                    <el-option label="空" value="9"></el-option>
                  </el-select>
                  </template>
                </el-input>
              </el-form-item>

              <el-form-item label="当前摊销" class="span-3">
                <el-input
                  v-model="searchForm.currentAmortize"
                  type="number"
                  placeholder="请输入金额"
                >
                  <template #prepend>
                    <el-select
                    v-model="searchForm.currentAmortizeOperator"
                    placeholder="全部"
                    style="width: 76px"
                  >
                    <el-option label="全部" value=""></el-option>
                    <el-option label="≥" value="1"></el-option>
                    <el-option label="≤" value="2"></el-option>
                    <el-option label=">" value="3"></el-option>
                    <el-option label="<" value="4"></el-option>
                    <el-option label="空" value="9"></el-option>
                  </el-select>
                  </template>
                </el-input>
              </el-form-item>
            </el-form>
          </template>
          <template #btns>
            <el-button
              type="primary"
              :icon="Search"
              size="mini"
              @click="handQuery()"
            >搜索
            </el-button
            >
            <el-button
              style="margin-left: 10px"
              :icon="Refresh"
              size="mini"
              @click="resetForm()"
            >重置
            </el-button
            >
          </template>
        </AppSearchBox>

        <!-- 操作按钮区域 -->
        <div class="mb20">
          <el-button
            v-hasPermi="['system:bom:export']"
            type="warning"
            plain
            :icon="Upload"
            size="mini"
            :disabled="tableId.length == 0"
            @click="handleExport"
          >导出
          </el-button
          >
          <el-button
            v-hasPermi="['system:sync:srm:getSrmData']"
            type="primary"
            plain
            :icon="Tickets"
            size="mini"
            :loading="bomCalculating"
            :disabled="bomCalculating"
            @click="handleCalculator"
          >{{ bomCalculating ? "计算中" : "计算" }}
          </el-button
          >
          <!-- <el-button
          @click="handleDelete"
          :disabled="true"
          type="danger"
          plain
          :icon="DeleteIcon"
          size="mini"
          v-hasPermi="['system:version:remove']"
          >批量删除</el-button
        > -->
          <Columns
            v-if="columns.length"
            v-model:columns="columns"
            style="float: right"
          />
        </div>
        <!-- 数据表格区域 -->
        <el-table
          ref="mainTable"
          v-loading="loadingShow"
          :data="tableData"
          border
          style="width: 100%"
          @selection-change="handleSelectionChange"
        >
          <el-table-column
            type="selection"
            width="50"
            align="center"
            fixed="left"
          ></el-table-column>
          <el-table-column
            align="center"
            label="序号"
            width="50"
            fixed="left"
            prop="serialNumber"
          ></el-table-column>
          <el-table-column v-if="setShow(1) && hasPermi('system:bom:basic')" align="center" label="基本信息">
            <!--        <el-table-column label="项目代号" width="150" prop="projectName"></el-table-column>-->
            <!--        <el-table-column label="工厂编号" width="150" prop="factoryCode"></el-table-column>-->
            <el-table-column
              v-if="setShow(1, 0)"
              align="center"
              label="零件号"
              width="150"
              prop="partNumber"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 1)"
              align="center"
              label="零件名称"
              width="150"
              :show-overflow-tooltip="true"
              prop="partName"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 2)"
              align="center"
              label="SOR号"
              width="150"
              prop="sorNumber"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 3)"
              align="center"
              label="SOR名称"
              width="150"
              prop="sorName"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 4)"
              align="center"
              label="ECR号"
              width="150"
              :show-overflow-tooltip="true"
              prop="ecrNumber"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 5)"
              align="center"
              label="ECR名称"
              width="150"
              prop="ecrName"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 6)"
              align="center"
              label="装配级别"
              width="150"
              prop="assemblyLevel"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 7)"
              align="center"
              label="零部件关键技术状态描述"
              width="180"
              prop="partTechDesc"
              :show-overflow-tooltip="true"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 8)"
              align="center"
              label="单位"
              width="150"
              prop="unitUsage"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 9)"
              align="center"
              label="模块标识"
              width="150"
              prop="moduleIdentifier"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 10)"
              align="center"
              label="首用车型"
              width="150"
              prop="firstVehicleModel"
            ></el-table-column>
            <el-table-column
              v-if="setShow(1, 11)"
              align="center"
              label="供应商名称"
              :show-overflow-tooltip="true"
              width="150"
              prop="supplierName"
            ></el-table-column>
          </el-table-column>
          <el-table-column v-if="setShow(2) && hasPermi('system:bom:category')" label="分类" align="center">
            <el-table-column
              v-if="setShow(2, 0)"
              align="center"
              label="通用化级别"
              width="150"
              prop="generalizationLevel"
            ></el-table-column>
            <el-table-column
              v-if="setShow(2, 1)"
              align="center"
              label="是否架构件"
              width="150"
              prop="isArchitectureComponent"
            ></el-table-column>
          </el-table-column>
          <el-table-column v-if="setShow(3) && hasPermi('system:bom:supplement')" label="BOM补充信息" align="center">
            <el-table-column
              v-if="setShow(3, 0)"
              align="center"
              label="建议货源"
              width="150"
              prop="suggestedSupplySource"
            ></el-table-column>
            <el-table-column
              v-if="setShow(3, 1)"
              align="center"
              label="货源描述"
              width="150"
              prop="sourceDescription"
            ></el-table-column>
            <el-table-column
              v-if="setShow(3, 2)"
              align="center"
              label="结构货源"
              width="150"
              prop="multiStructuredSupplySources"
            ></el-table-column>
            <el-table-column
              v-if="setShow(3, 3)"
              align="center"
              label="结构货源描述"
              width="150"
              prop="multiSourcesDescription"
            ></el-table-column>
          </el-table-column>
          <el-table-column v-if="setShow(4) && hasPermi('system:bom:division')" label="分工" align="center">
            <el-table-column
              v-if="setShow(4, 0)"
              align="center"
              label="研发专业部门"
              width="260"
              prop="developmentDepartment"
            ></el-table-column>
            <el-table-column
              v-if="setShow(4, 1)"
              align="center"
              label="专业工程师"
              width="120"
              prop="expertEngineer"
            ></el-table-column>
            <el-table-column
              v-if="setShow(4, 2)"
              align="center"
              label="零件属性"
              width="120"
              prop="partAttribute"
            ></el-table-column>
            <el-table-column
              v-if="setShow(4, 3)"
              align="center"
              label="成本专业科室"
              width="120"
              prop="firstClassification"
            ></el-table-column>
            <el-table-column
              v-if="setShow(4, 4)"
              align="center"
              label="成本二级分类"
              width="120"
              prop="secondClassification"
            ></el-table-column>
            <el-table-column
              v-if="setShow(4, 5)"
              align="center"
              label="成本三级分类"
              width="120"
              prop="threeClassification"
            ></el-table-column>
            <el-table-column
              v-if="setShow(4, 6)"
              align="center"
              label="成本工程师"
              width="120"
              prop="costEngineer"
            ></el-table-column>
            <el-table-column
              v-if="setShow(4, 7)"
              align="center"
              label="采购工程师"
              width="120"
              prop="procurementEngineer"
            ></el-table-column>
          </el-table-column>
          <el-table-column v-if="setShow(5) && hasPermi('system:bom:usage')" label="单车用量" align="center">
            <template v-for="(item, index) in costBomPattern" :key="'list' + index"><el-table-column v-if="item.patternName !== '加权' && setShow(5, index)" align="center" :label="item.patternName" width="150" :prop="`list[${index}]`"></el-table-column></template>
          </el-table-column>
          <el-table-column v-if="setShow(6) && hasPermi('system:bom:target')" label="目标成本" align="center">
            <el-table-column
              v-if="setShow(6, 0)"
              align="center"
              label="目标-材料成本（不含摊销）"
              width="200"
              prop="targetMaterialCost"
            >
              <template #default="scope">
                {{ formatPrice(scope.row.targetMaterialCost) }}
              </template>
            </el-table-column>
          </el-table-column>
          <el-table-column v-if="setShow(7) && hasPermi('system:bom:assess')" label="评估成本" align="center">
            <el-table-column
              v-if="setShow(7, 0)"
              align="center"
              label="评估-材料成本（不含摊销）"
              width="200"
              prop="assessMaterialCost"
            >
              <template #default="scope">
                {{ formatPrice(scope.row.assessMaterialCost) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="setShow(7, 1)"
              align="center"
              label="评估-数据来源"
              width="150"
              prop="assessDataSources"
            ></el-table-column>
          </el-table-column>
          <el-table-column v-if="setShow(8) && hasPermi('system:bom:current')" label="当前成本" align="center">
            <el-table-column
              v-if="setShow(8, 0)"
              align="center"
              label="当前-材料成本（含摊销）"
              width="180"
              prop="currentMaterialCostAmortize"
            >
              <template #default="scope">
                {{ formatPrice3(scope.row.currentMaterialCostAmortize, 3) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="setShow(8, 1)"
              align="center"
              label="当前-数据来源（含摊销）"
              width="180"
              prop="currentAmortizeDataSources"
            >
            </el-table-column>
            <el-table-column
              v-if="setShow(8, 2)"
              align="center"
              label="当前-材料成本（不含摊销）"
              width="200"
              prop="currentMaterialCost"
            >
              <template #default="scope">
                {{ formatPrice3(scope.row.currentMaterialCost, 3) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="setShow(8, 3)"
              align="center"
              label="当前-数据来源（不含摊销）"
              width="200"
              prop="currentDataSources"
            >
            </el-table-column>
            <el-table-column
              v-if="setShow(8, 4)"
              align="center"
              label="当前-摊销"
              width="150"
              prop="currentAmortize"
            >
              <template #default="scope">
                {{ formatPrice3(scope.row.currentAmortize, 3) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="setShow(8, 5)"
              align="center"
              label="询报价轮次"
              width="150"
              prop="bidRounds"
            >
              <template #default="scope">
                {{ scope.row.bidRounds }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="setShow(8, 6)"
              align="center"
              label="出厂价格"
              width="150"
              prop="exFactoryPrice"
            >
              <template #default="scope">
                {{ scope.row.exFactoryPrice }}
              </template>
            </el-table-column>
          </el-table-column>
          <el-table-column
            v-if="setShow(9) && hasPermi('system:bom:target:pattern')"
            label="各版型目标成本统计（不含摊销）"
            align="center"
          >
            <template v-for="(item, index) in costBomPattern" :key="'targetCost' + index"><el-table-column v-if="setShow(9, index)" align="center" :label="item.patternName" width="150" :prop="`targetCost[${index}]`">
              <template #default="scope">
                {{ scope.row.targetCost[index] }}
              </template>
            </el-table-column></template>
          </el-table-column>
          <el-table-column
            v-if="setShow(10) && hasPermi('system:bom:assess:pattern')"
            label="各版型评估成本统计（不含摊销）"
            align="center"
          >
            <template v-for="(item, index) in costBomPattern" :key="'assessedCost' + index"><el-table-column v-if="setShow(10, index)" align="center" :label="item.patternName" width="150" :prop="`assessedCost[${index}]`">
              <template #default="scope">
                {{ formatPrice(scope.row.assessedCost[index]) }}
              </template>
            </el-table-column></template>
          </el-table-column>
          <el-table-column
            v-if="setShow(11) && hasPermi('system:bom:current:pattern')"
            label="各版型当前成本统计（不含摊销）"
            align="center"
          >
            <template v-for="(item, index) in costBomPattern" :key="'currentCost' + index"><el-table-column v-if="setShow(11, index)" align="center" :label="item.patternName" width="150" :prop="`currentCost[${index}]`">
              <template #default="scope">
                {{ formatPrice(scope.row.currentCost[index]) }}
              </template>
            </el-table-column></template>
          </el-table-column>
          <el-table-column
            v-if="setShow(12) && hasPermi('system:bom:current:amortize:pattern')"
            label="各版型当前成本统计（含摊销）"
            align="center"
          >
            <template v-for="(item, index) in costBomPattern" :key="'currentCostAmortize' + index"><el-table-column v-if="setShow(12, index)" align="center" :label="item.patternName" width="150" :prop="`currentCostAmortize[${index}]`">
              <template #default="scope">
                {{ formatPrice(scope.row.currentCostAmortize[index]) }}
              </template>
            </el-table-column></template>
          </el-table-column>
          <el-table-column v-if="setShow(13) && hasPermi('system:bom:version')" label="其他" align="center">
            <el-table-column
              v-if="setShow(13, 0)"
              align="center"
              label="当前版本"
              width="100"
              prop="version"
            >
              <template #default="scope">
                <span v-if="scope.row.version">V{{ scope.row.version }}</span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="setShow(13, 1)"
              align="center"
              label="创建人"
              width="150"
              prop="createName"
            ></el-table-column>
            <el-table-column
              v-if="setShow(13, 2)"
              align="center"
              label="创建时间"
              width="160"
              prop="createTime"
            ></el-table-column>
            <el-table-column
              v-if="setShow(13, 3)"
              align="center"
              label="修改人"
              width="150"
              prop="updateBy"
            ></el-table-column>
            <el-table-column
              v-if="setShow(13, 4)"
              align="center"
              label="修改时间"
              width="160"
              prop="updateTime"
            ></el-table-column>
          </el-table-column>
          <el-table-column
            label="操作"
            fixed="right"
            width="160"
            align="center"
          >
            <template #default="scope">
              <el-button
                v-hasPermi="['system:bom:edit']"
                size="mini"
                type="text"
                :icon="Edit"
                plain
                @click="handleEdit('edit', scope.row)"
              >编辑
              </el-button>
              <el-button
                size="mini"
                type="text"
                plain
                :icon="Clock"
                @click="handleEdit('history', scope.row)"
              >历史版本
              </el-button
              >
            </template>
          </el-table-column>
        </el-table>
        <div style="height: 70px"></div>
        <div class="pager-div">
          <Pagination
            :total="searchForm.total"
            :page="searchForm.pageNum"
            :limit="searchForm.pageSize"
            @pagination="pagination"
          ></Pagination>
        </div>
      </div>
    </div>
  </el-dialog>
</template>
<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ElMessage } from "element-plus";
import { ref, reactive, computed, watch, nextTick, onMounted } from "vue";
import { useRoute } from "vue-router";
import { Search, Refresh, Tickets, Edit, Clock, Upload } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import { bomListTwo, costCalculate, getCalculatingStatus, syncBidPriceToCostBom } from "@/api/revenue";
import { httpClient } from "@/api/http";
import editBom from "./components/editBom.vue";
import History from "./components/history.vue";
import Columns from "./components/columns.vue";
import { hasPermi } from "@/utils/hasPermi";

const route = useRoute();

// ===== 本地工具函数 =====
function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPrice3(value: number | string | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString("zh-CN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

async function downloadPost(url: string, params: unknown, fileName: string): Promise<void> {
  const response = await httpClient.post(url, params, { responseType: "blob" });
  const blob = response.data as Blob;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function parseTime(time: number | string | Date, pattern: string): string {
  if (!time) return "";
  const date = new Date(time);
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const i = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  if (pattern) {
    return pattern
      .replace("{y}", y)
      .replace("{m}", m)
      .replace("{d}", d)
      .replace("{h}", h)
      .replace("{i}", i)
      .replace("{s}", s);
  }
  return `${y}-${m}-${d} ${h}:${i}:${s}`;
}

// ===== 状态 =====
const params_ = reactive({
  bomVersionId: "",
  isLatestVersion: 1 as string | number,
  vehicleModelName: "",
  valveName: "",
  version: "",
});

const columns = ref<{ id: number; label: string; show: boolean; children: { id: number; label: string; show: boolean }[] }[]>([]);
const bomCalculating = ref(true);
const historyParentId_ = ref<string | null>(null);
const _unfoldShow = ref(true);
const searchForm = ref<Record<string, unknown>>({
  pageSize: 10,
  total: 0,
  pageNum: 1,
  bomVersionId: "",
  version: "",
  partNumber: "",
  partName: "",
  sorName: "",
  firstVehicleModel: "",
  supplierName: "",
  generalizationLevel: "",
  currentMaterialCostAmortize: null,
  currentMaterialCostAmortizeOperator: null,
  currentMaterialCost: null,
  currentMaterialCostOperator: null,
  currentAmortize: null,
  currentAmortizeOperator: null,
});
const tableData = ref<Record<string, unknown>[]>([{}]);
const loadingShow = ref(false);
const tableId = ref<Record<string, unknown>[]>([]);
const costBomPattern = ref<{ patternName: string; usagePerVehicle?: unknown; targetCost?: unknown; assessedCost?: unknown; currentCost?: unknown; currentCostAmortize?: unknown }[]>([]);
const page = reactive({
  vehicleModelName: "",
  valveName: "",
  factoryCode: "",
});
const backfillData = ref<Record<string, unknown>>({});
const editBomShow = ref(false);
const currentMode = ref("");

const mainTable = ref();

// ===== Computed =====
const pageHeaderTitle = computed(() => {
  return (
    "成本BOM：" +
    page.vehicleModelName +
    "（" +
    page.valveName +
    "," +
    page.factoryCode +
    "）"
  );
});

// ===== Watch =====
watch(columns, () => {
  nextTick(() => {
    mainTable.value?.doLayout();
  });
}, { deep: true });

// ===== Methods =====
function pageClose() {
  window.close();
}

function setShow(parentId: number, cindex?: number): boolean {
  if (!columns.value.length) {
    return true;
  }
  const cur = columns.value.find((item) => item.id === parentId);
  if (cindex === undefined) {
    let show = false;
    if (!cur) return false;
    for (const child of cur.children) {
      if (child.show) {
        show = true;
        break;
      }
    }
    return show;
  }
  return cur ? cur.children[cindex].show : true;
}

function editBack(refresh?: boolean) {
  editBomShow.value = false;
  if (refresh) {
    getList();
  }
}

function _handleDelete() {
  // 预留
}

async function getList() {
  loadingShow.value = true;
  const res: any = await bomListTwo(
    Object.assign({ isLatestVersion: 1 }, searchForm.value)
  );
  (tableData as any).value = res.rows;
  if ((res as any).rows.length > 0) {
    if ((res as any).rows[1]) {
      (page as any).factoryCode = res.rows[1].factoryCode;
    } else {
      (page as any).factoryCode = res.rows[0].factoryCode;
    }
  }
  let list: unknown[] = [];
  let targetCost: string[] = [];
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
      (item.costBomPattern as Record<string, unknown>[]).forEach((item1, _index1) => {
        list.push(item1.usagePerVehicle);
        targetCost.push(formatPrice(item1.targetCost as number));
        assessedCost.push(item1.assessedCost);
        currentCost.push(item1.currentCost);
        currentCostAmortize.push(item1.currentCostAmortize);
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
  (costBomPattern as any).value = res.rows[0].costBomPattern;

  if (!columns.value.length) {
    columns.value = [
      {
        label: "基本信息",
        id: 1,
        show: true,
        children: [
          { id: 101, label: "零件号", show: true },
          { id: 102, label: "零件名称", show: true },
          { id: 103, label: "SOR号", show: true },
          { id: 104, label: "SOR名称", show: true },
          { id: 105, label: "ECR号", show: true },
          { id: 106, label: "ECR名称", show: true },
          { id: 107, label: "装配级别", show: true },
          { id: 108, label: "零部件关键技术状态描述", show: true },
          { id: 109, label: "单位", show: true },
          { id: 110, label: "模块标识", show: true },
          { id: 111, label: "首用车型", show: true },
          { id: 112, label: "供应商名称", show: true },
        ],
      },
      {
        label: "分类",
        id: 2,
        show: true,
        children: [
          { id: 201, label: "通用化级别", show: true },
          { id: 202, label: "是否架构件", show: true },
        ],
      },
      {
        label: "BOM补充信息",
        id: 3,
        show: true,
        children: [
          { id: 301, label: "建议货源", show: true },
          { id: 302, label: "货源描述", show: true },
          { id: 303, label: "结构货源", show: true },
          { id: 304, label: "结构货源描述", show: true },
        ],
      },
      {
        label: "分工",
        id: 4,
        show: true,
        children: [
          { id: 401, label: "研发专业部门", show: true },
          { id: 402, label: "专业工程师", show: true },
          { id: 403, label: "零件属性", show: true },
          { id: 404, label: "成本专业科室", show: true },
          { id: 405, label: "成本二级分类", show: true },
          { id: 406, label: "成本三级分类", show: true },
          { id: 407, label: "成本工程师", show: true },
          { id: 408, label: "采购工程师", show: true },
        ],
      },
      {
        label: "单车用量",
        id: 5,
        show: true,
        children: (() => {
          const res: { id: number; label: string; show: boolean }[] = [];
          costBomPattern.value.forEach((item, index) => {
            if (item.patternName !== "加权") {
              res.push({
                id: 500 + index + 1,
                label: item.patternName,
                show: true,
              });
            }
          });
          return res;
        })(),
      },
      {
        label: "目标成本",
        id: 6,
        show: true,
        children: [
          { id: 601, label: "目标-材料成本（不含摊销）", show: true },
        ],
      },
      {
        label: "评估成本",
        id: 7,
        show: true,
        children: [
          { id: 701, label: "评估-材料成本（不含摊销）", show: true },
          { id: 702, label: "评估-数据来源", show: true },
        ],
      },
      {
        label: "当前成本",
        id: 8,
        show: true,
        children: [
          { id: 801, label: "当前-材料成本（含摊销）", show: true },
          { id: 802, label: "当前-数据来源（含摊销）", show: true },
          { id: 803, label: "当前-材料成本（不含摊销）", show: true },
          { id: 804, label: "当前-数据来源（不含摊销）", show: true },
          { id: 805, label: "当前-摊销", show: true },
          { id: 806, label: "询报价轮次", show: true },
          { id: 807, label: "出厂价格", show: true },
        ],
      },
      {
        label: "各版型目标成本统计（不含摊销）",
        id: 9,
        show: true,
        children: (() => {
          const res: { id: number; label: string; show: boolean }[] = [];
          costBomPattern.value.forEach((item, index) => {
            res.push({
              id: 900 + index + 1,
              label: item.patternName,
              show: true,
            });
          });
          return res;
        })(),
      },
      {
        label: "各版型评估成本统计（不含摊销）",
        id: 10,
        show: true,
        children: (() => {
          const res: { id: number; label: string; show: boolean }[] = [];
          costBomPattern.value.forEach((item, index) => {
            res.push({
              id: 1000 + index + 1,
              label: item.patternName,
              show: true,
            });
          });
          return res;
        })(),
      },
      {
        label: "各版型当前成本统计（不含摊销）",
        id: 11,
        show: true,
        children: (() => {
          const res: { id: number; label: string; show: boolean }[] = [];
          costBomPattern.value.forEach((item, index) => {
            res.push({
              id: 1100 + index + 1,
              label: item.patternName,
              show: true,
            });
          });
          return res;
        })(),
      },
      {
        label: "各版型当前成本统计（含摊销）",
        id: 12,
        show: true,
        children: (() => {
          const res: { id: number; label: string; show: boolean }[] = [];
          costBomPattern.value.forEach((item, index) => {
            res.push({
              id: 1200 + index + 1,
              label: item.patternName,
              show: true,
            });
          });
          return res;
        })(),
      },
      {
        label: "其他",
        id: 13,
        show: true,
        children: [
          { id: 1301, label: "当前版本", show: true },
          { id: 1302, label: "创建人", show: true },
          { id: 1303, label: "创建时间", show: true },
          { id: 1304, label: "修改人", show: true },
          { id: 1305, label: "修改时间", show: true },
        ],
      },
    ];
  }
}

function handQuery() {
  searchForm.value.pageNum = 1;
  getList();
}

function resetForm() {
  searchForm.value = {
    pageSize: 10,
    total: 0,
    pageNum: 1,
    bomVersionId: "",
    version: "",
    partNumber: "",
    partName: "",
    currentMaterialCostAmortize: null,
    currentMaterialCostAmortizeOperator: null,
    currentMaterialCost: null,
    currentMaterialCostOperator: null,
    currentAmortize: null,
    currentAmortizeOperator: null,
  };
  searchForm.value.bomVersionId = params_.bomVersionId;
  searchForm.value.version = params_.version;
  getList();
}

function handleEdit(type: string, row: Record<string, unknown>) {
  if (type == "edit") {
    backfillData.value = row;
    currentMode.value = "edit";
    editBomShow.value = true;
  } else if (type == "history") {
    historyParentId_.value = row.parentId as string;
  }
}

function pagination(pageParam: { limit: number; page: number }) {
  searchForm.value.pageSize = pageParam.limit;
  searchForm.value.pageNum = pageParam.page;
  getList();
}

function handleSelectionChange(e: Record<string, unknown>[]) {
  tableId.value = e;
}

function handleExport() {
  if (tableId.value.length == 0) {
    BaseToast.warning("请选择 1 条要导出的数据！");
    return;
  }

  const ids: { id: unknown }[] = [];
  tableId.value.forEach((item) => {
    ids.push({ id: item.id });
  });
  const { vehicleModelName, valveName } = params_;
  downloadPost(
    "system/bom/export",
    ids,
    `成本BOM-${vehicleModelName}-${valveName}-${parseTime(
      Date.now(),
      "{y}{m}{d}"
    )}.xlsx`
  );
}

async function handleCalculator() {
  if (!searchForm.value.bomVersionId) {
    BaseToast.warning("缺少BOM版本ID");
    return;
  }

  let loadingMessage: ReturnType<typeof ElMessage> | null = null;
  try {
    loadingShow.value = true;

    loadingMessage = ElMessage({
      message: "正在计算SRM成本数据，预计需要30秒左右，请稍候...",
      type: "info",
      duration: 5000,
    });
    bomCalculating.value = true;
    await costCalculate({
      id: searchForm.value.bomVersionId,
      version: params_.version,
    });
    syncBidPriceToCostBom({
      id: searchForm.value.bomVersionId,
      version: params_.version,
    });

    if (loadingMessage) {
      loadingMessage.close();
    }

    BaseToast.success("SRM成本数据计算成功");
    await getList();
  } catch (error) {
    if (loadingMessage) {
      loadingMessage.close();
    }
    console.error("计算失败:", error);
  } finally {
    loadingShow.value = false;
    bomCalculating.value = false;
  }
}

// ===== 初始化 =====
const { bomVersionId, isLatestVersion, vehicleModelName, valveName, version } = route.query;
params_.bomVersionId = bomVersionId as string;
params_.isLatestVersion = isLatestVersion as string;
params_.vehicleModelName = vehicleModelName as string;
params_.valveName = valveName as string;
params_.version = version as string;

onMounted(() => {
  getCalculatingStatus(params_.bomVersionId).then((res: any) => {
    if (res.data == false) {
      bomCalculating.value = false;
    }
    if (res.data == true) {
      bomCalculating.value = true;
    }
  });
  searchForm.value.bomVersionId = params_.bomVersionId;
  searchForm.value.version = params_.version;
  page.vehicleModelName = params_.vehicleModelName;
  page.valveName = params_.valveName;
  getList();
});

void _unfoldShow.value;
void _handleDelete;
</script>
<style scoped lang="scss">
.app-container {
  padding: 0;
  margin: 0;
  box-shadow: none;
  border-radius: 0;
}

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

.app-container ::v-deep {
  .el-table--medium .el-table__cell {
    padding: 4px 0;
  }
}

.pager-div {
  background: #fff;
  position: fixed;
  height: 70px;
  z-index: 99;
  width: calc(100vw - 40px);
  bottom: 0;
}
</style>

<style>
.wbs-list-dialog .el-dialog__body {
  padding-top: 0;
  padding-bottom: 20px;
}
</style>
