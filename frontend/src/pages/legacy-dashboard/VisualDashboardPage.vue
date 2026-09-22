<template>
  <div class="project-dashboard">
    <div class="top-grid">
      <section class="car-card">
        <div class="card-toolbar">
          <div class="selector-pair">
            <span>品牌</span>
            <div class="brand-text">{{ brandLabel }}</div>
          </div>
          <div class="selector-pair">
            <span>车型选择</span>
            <el-select
              v-model="activeModel"
              class="dashboard-model-select"
              popper-class="visual-dashboard-model-option"
              @change="selectChange"
            >
              <el-option
                v-for="item in modelOptions"
                :key="item.id"
                :label="
                  (item.vehicleModel && item.vehicleModel.modelName) || '-'
                "
                :value="item.id"
              ></el-option>
            </el-select>
          </div>
        </div>

        <div class="car-image-wrap">
          <img :src="modelImage" alt="vehicle" />
        </div>

        <div class="car-info">
          <div v-for="item in carInfo" :key="item.label" class="info-item">
            <strong>{{ item.label }}</strong>
            <span>{{ item.value }}</span>
          </div>
        </div>
      </section>

      <section class="top-chart-card">
        <div class="mode-switch">
          <button
            :class="{ active: topMode === 'budget' }"
            @click="topMode = 'budget'"
          >
            预算
          </button>
          <button
            :class="{ active: topMode === 'cost' }"
            @click="topMode = 'cost'"
          >
            成本
          </button>
          <button
            :class="{ active: topMode === 'revenue' }"
            @click="topMode = 'revenue'"
          >
            收益
          </button>
        </div>

        <template v-if="topMode === 'budget'">
          <template v-if="hasBudgetData">
            <div class="valve-axis">
              <span class="unit">单位：万元</span>
              <div v-for="item in valves" :key="item.name" class="valve-pill">
                {{ item.name }}
              </div>
              <div class="topborders"></div>
            </div>
            <div class="budget-legend">
              <span><i class="cyan"></i>预算</span>
              <span><i class="blue"></i>阀点已占用</span>
              <span><i class="orange"></i>预算执行率</span>
              <em>预算执行率%</em>
            </div>
            <div ref="budgetChart" class="budget-chart"></div>
          </template>
          <!-- 空状态 -->
          <div class="empty-state" v-else>
            <el-empty description="暂无项目数据"></el-empty>
          </div>
        </template>

        <template v-else-if="topMode === 'cost'">
          <template v-if="topCostRows && topCostRows.length > 0">
            <div class="valve-axis cost-axis">
              <span class="unit">单位：元</span>
              <div v-for="item in valves" :key="item.name" class="valve-pill">
                {{ item.name }}
              </div>
              <div class="topborders"></div>
            </div>
            <div class="cost-legend-line">
              <div class="cost-metric-legend">
                <span><i class="deep"></i>当前成本</span>
                <span><i class="blue"></i>目标成本</span>
                <span><i class="light"></i>偏差率</span>
              </div>
              <div class="status-legend">
                <span><i class="green"></i>允许过阀</span>
                <span><i class="yellow"></i>带条件过阀</span>
                <span><i class="red"></i>不允许过阀</span>
              </div>
            </div>
            <div class="cost-grid">
              <div v-for="row in topCostRows" :key="row.name" class="cost-row">
                <div class="row-title">{{ row.name }}</div>
                <div
                  v-for="cell in row.values"
                  :key="cell.valve"
                  class="cost-cell"
                  :class="cell.status"
                >
                  <p><i class="deep"></i>{{ cell.current }}</p>
                  <p><i class="blue"></i>{{ cell.target }}</p>
                  <p><i class="light"></i>{{ cell.rate }}</p>
                </div>
              </div>
            </div>
          </template>
          <!-- 空状态 -->
          <div class="empty-state" v-else>
            <el-empty description="暂无项目数据"></el-empty>
          </div>
        </template>

        <template v-else-if="topMode === 'revenue'">
          <template v-if="topRevenueRows && topRevenueRows.length > 0">
            <div class="valve-axis cost-axis">
              <span class="unit">单位：万元</span>
              <div v-for="item in valves" :key="item.name" class="valve-pill">
                {{ item.name }}
              </div>
              <div class="topborders"></div>
            </div>
            <div class="cost-legend-line">
              <div class="cost-metric-legend">
                <span><i style="background: #1e5dc8"></i>边贡</span>
                <span><i style="background: #1e5dc8"></i>边贡率</span>
                <span><i style="background: #2d8cff"></i>利润</span>
                <span><i style="background: #2d8cff"></i>利润率</span>
              </div>
            </div>
            <div class="cost-grid">
              <div v-for="row in topRevenueRows" :key="row.name" class="cost-row">
                <div class="row-title">{{ row.name }}</div>
                <div
                  v-for="cell in row.values"
                  :key="cell.valve"
                  class="cost-cell revenue-cell"
                  :class="cell.status"
                >
                  <p v-if="cell.marginalContribution !== '-'" :style="{ color: cell.isFirstNonZero ? '#1e5dc8' : '' }"><i style="background: #1e5dc8"></i>{{ cell.marginalContribution }}</p>
                  <p v-if="cell.marginalContributionRate !== '-'" :style="{ color: cell.isFirstNonZero ? '#1e5dc8' : '' }"><i style="background: #1e5dc8"></i>{{ cell.marginalContributionRate }}</p>
                  <p v-if="cell.operatingProfit !== '-'" :style="{ color: cell.isFirstNonZero ? '#2d8cff' : '' }"><i style="background: #2d8cff"></i>{{ cell.operatingProfit }}</p>
                  <p v-if="cell.operatingProfitRate !== '-'" :style="{ color: cell.isFirstNonZero ? '#2d8cff' : '' }"><i style="background: #2d8cff"></i>{{ cell.operatingProfitRate }}</p>

                  <template v-if="cell.marginalContribution === '-' && cell.marginalContributionRate === '-' && cell.operatingProfit === '-' && cell.operatingProfitRate === '-'">
                    <p>-</p>
                  </template>
                </div>
              </div>
            </div>
          </template>
          <!-- 空状态 -->
          <div class="empty-state" v-else>
            <el-empty description="暂无项目数据"></el-empty>
          </div>
        </template>
      </section>
    </div>

    <section class="bottom-card">
      <div class="bottom-toolbar">
        <div class="left-tools">
          <el-select
            v-model="activeModule"
            class="dashboard-model-select"
            popper-class="visual-dashboard-model-option"
          >
            <el-option
              v-for="item in moduleOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>

          <el-select
            v-model="bottomView"
            class="dashboard-model-select"
            popper-class="visual-dashboard-model-option"
          >
            <el-option
              v-for="item in bottomViewOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <h3 v-if="bottomView === 'cost'" class="part-title">
          未达成目标成本零部件
        </h3>
      </div>

      <template v-if="bottomView === 'cost'">
        <div class="cost-layout">
          <div class="cost-layout-left">
            <div class="chart-meta">
              <span>单位：万元</span>
              <div class="legend-group">
                <span class="green-dot"><i></i>实际</span>
                <span class="blue-dot"><i></i>目标</span>
              </div>
            </div>
            <div class="bar-chart">
              <div class="y-axis">
                <span v-for="tick in chartTicks" :key="tick">{{ tick }}</span>
              </div>
              <div class="plot">
                <div
                  v-for="tick in chartTicks"
                  :key="'cost-bottom-' + tick"
                  class="grid-line"
                  :style="{ bottom: chartBottom(tick) }"
                ></div>
                <div
                  v-for="item in moduleCostBars"
                  :key="item.name"
                  class="bar-group"
                >
                  <div class="bars">
                    <b
                      class="actual-green"
                      :style="{ height: chartHeight(item.actual) }"
                    ></b>
                    <b
                      class="target-blue-solid"
                      :style="{ height: chartHeight(item.target) }"
                    ></b>
                  </div>
                  <span>{{ item.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="part-panel">
            <div class="part-head">
              <span>单位：万元</span>
              <div class="legend-group">
                <span class="blue-dot"><i></i>实际</span>
                <span class="pale-dot"><i></i>目标</span>
              </div>
            </div>
            <div class="part-list">
              <div
                v-for="item in activeParts"
                :key="item.name"
                class="part-item"
              >
                <strong>{{ item.name }}</strong>
                <div class="progress">
                  <span
                    class="fill"
                    :style="{ width: progressWidth(item.actual, item.target) }"
                  ></span>
                  <i
                    :style="{ left: progressWidth(item.actual, item.target) }"
                  ></i>
                  <em
                    :style="{ left: progressWidth(item.actual, item.target) }"
                  >
                    {{ item.actual.toFixed(2) }}万
                  </em>
                  <b>{{ item.target.toFixed(2) }}万</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="chart-meta bottom-meta">
          <span>单位：个</span>
          <div class="legend-group">
            <span class="blue-dot"><i></i>实际</span>
            <span class="pale-dot"><i></i>目标</span>
          </div>
        </div>
        <div class="bar-chart wide-bottom">
          <div class="y-axis">
            <span v-for="tick in activeChartTicks" :key="tick">{{ tick }}</span>
          </div>
          <div class="plot">
            <div
              v-for="tick in activeChartTicks"
              :key="'done-' + tick"
              class="grid-line"
              :style="{ bottom: activeChartBottom(tick) }"
            ></div>
            <div
              v-for="item in activeCompleteBars"
              :key="item.name"
              class="bar-group"
            >
              <div class="bars">
                <b
                  class="actual-blue"
                  :style="{ height: activeChartHeight(item.actual) }"
                ></b>
                <b
                  class="target-blue"
                  :style="{ height: activeChartHeight(item.target) }"
                ></b>
              </div>
              <span>{{ item.name }}</span>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script>
import * as echarts from "echarts";
import { projectGet } from "@/api/legacy-dashboard";
import {
  boardBuget,
  getCostBomCountResearch,
  getCostBomCountResearchTwo,
  optionsValue,
} from "@/api/legacy-dashboard";

const VALVES = [
  { name: "G9", date: "(—)" },
  { name: "G8", date: "(2025-11-30)" },
  { name: "G7", date: "(2025-11-30)" },
  { name: "G6", date: "(2025-12-31)" },
  { name: "G5", date: "(—)" },
  { name: "G4", date: "(2026-02-28)" },
  { name: "G3", date: "(—)" },
  { name: "G2", date: "(—)" },
  { name: "G1", date: "(2026-03-31)" },
];

const BODY_MODULE = {
  complete: [
    { name: "定点完成", actual: 11, target: 6 },
    { name: "合同签署", actual: 6, target: 1 },
    { name: "到件", actual: 1, target: 12 },
  ],
  cost: [{ name: "成本达成", actual: 11, target: 6 }],
  parts: [
    { name: "电机塔铁线束总成", actual: 3.86, target: 7.86 },
    { name: "塔程发电机系统及高压线束总成", actual: 5.89, target: 5.89 },
    { name: "高压发电机集成控制器总成", actual: 2.52, target: 4.52 },
    { name: "高压附件线束", actual: 4.62, target: 5.62 },
    { name: "电机", actual: 3.8, target: 7.8 },
    { name: "线束", actual: 2.2, target: 6 },
    { name: "控制器", actual: 1.1, target: 3 },
    { name: "总成", actual: 3, target: 3 },
    { name: "保险杠", actual: 4.2, target: 22 },
    { name: "底盘前悬置", actual: 2.15, target: 5.0 },
  ],
  modules_cost: [{ name: "模块状态", actual: 9, target: 14 }],
  modules_parts: [
    { name: "底盘前悬置模块", actual: 2.15, target: 5.0 },
    { name: "车门控制系统总成", actual: 6.2, target: 4.5 },
    { name: "智能驾驶辅助系统", actual: 3.4, target: 6.1 },
    { name: "前后保险杠总成", actual: 1.8, target: 2.5 },
  ],
  modules_complete: [
    { name: "定点完成", actual: 3400, target: 4400 },
    { name: "合同签署", actual: 3500, target: 4500 },
    { name: "到件", actual: 2800, target: 3600 },
  ],
};

function makeTopCostValues(statusList) {
  return VALVES.map((valve, index) => ({
    valve: valve.name,
    status: statusList[index] || "empty",
    current: index % 3 === 0 ? "0.50" : index % 2 === 0 ? "0.32" : "1.76",
    target: index % 3 === 0 ? "2.00" : index % 2 === 0 ? "0.00" : "2.00",
    rate: "50%",
  }));
}

function cloneModule(scale) {
  return {
    complete: BODY_MODULE.complete.map((item) => ({
      ...item,
      actual: Math.round(item.actual * scale),
      target: Math.round(item.target * scale),
    })),
    cost: BODY_MODULE.cost.map((item) => ({
      ...item,
      actual: Math.round(item.actual * scale),
      target: Math.round(item.target * scale),
    })),
    parts: BODY_MODULE.parts.map((item) => ({
      ...item,
      actual: Number((item.actual * scale).toFixed(2)),
      target: Number((item.target * scale).toFixed(2)),
    })),
    modules_cost: BODY_MODULE.modules_cost.map((item) => ({
      ...item,
      actual: Math.round(item.actual * scale),
      target: Math.round(item.target * scale),
    })),
    modules_parts: BODY_MODULE.modules_parts.map((item) => ({
      ...item,
      actual: Number((item.actual * scale).toFixed(2)),
      target: Number((item.target * scale).toFixed(2)),
    })),
    modules_complete: BODY_MODULE.modules_complete.map((item) => ({
      ...item,
      actual: Math.round(item.actual * scale),
      target: Math.round(item.target * scale),
    })),
  };
}

export default {
  name: "VisualDashboard",
  data() {
    return {
      budgetChart: null,
      activeModel: "",
      modelPage: {
        vehicleModel: {},
      },
      topMode: "budget",
      activeModule: "body",
      bottomView: "cost",
      modelOptions: [],
      moduleOptions: [
        { label: "车身", value: "body" },
        { label: "底盘", value: "chassis" },
        { label: "电气", value: "electric" },
        { label: "动力", value: "power" },
        { label: "内外饰", value: "trim" },
      ],
      bottomViewOptions: [
        { label: "定点完成情况", value: "cost" },
        { label: "成本达成情况", value: "complete" },
        { label: "各个模块情况展示", value: "modules" },
      ],
      valves: VALVES,
      projectId: undefined,
      budgetTicks: [10000, 8000, 6000, 4000, 2000, 0],
      rateTicks: [100, 80, 60, 40, 20, 0],
      chartTicks: [15, 12, 9, 6, 3, 0],
      budgetValveData: VALVES.map((v) => ({
        name: v.name,
        date: v.date,
        budget: 0,
        used: 0,
        rate: 0,
      })),
      budgetRateData: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      hasBudgetData: false,
      topCostRows: [],
      topRevenueRows: [],
      moduleData: {
        body: BODY_MODULE,
        chassis: cloneModule(0.86),
        electric: cloneModule(0.92),
        power: cloneModule(1.06),
        trim: cloneModule(0.78),
      },
    };
  },
  watch: {
    topMode(value) {
      if (value === "budget") {
        this.$nextTick(this.renderBudgetChart);
      } else if (this.budgetChart) {
        this.budgetChart.dispose();
        this.budgetChart = null;
      }
    },
    hasBudgetData(val) {
      if (!val && this.budgetChart) {
        this.budgetChart.dispose();
        this.budgetChart = null;
      }
    },
    budgetValveData: {
      deep: true,
      handler() {
        this.$nextTick(this.renderBudgetChart);
      },
    },
  },
  mounted() {
    this.projectGet(this.$route.query.modelName);
    this.$nextTick(this.renderBudgetChart);
    window.addEventListener("resize", this.resizeBudgetChart);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.resizeBudgetChart);
    if (this.budgetChart) {
      this.budgetChart.dispose();
      this.budgetChart = null;
    }
  },
  computed: {
    brandLabel() {
      return this.activeVehicleModel.brand || "-";
    },
    activeModelName() {
      return this.activeVehicleModel.modelName || "-";
    },
    activeModelInfo() {
      return this.modelPage || {};
    },
    activeVehicleModel() {
      return this.activeModelInfo.vehicleModel || {};
    },
    modelImage() {
      if (!this.activeVehicleModel.modelImage) {
        return new URL("../../assets/legacy-dashboard/car.png", import.meta.url).href;
      }
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
      return `${baseUrl}${this.activeVehicleModel.modelImage}`;
    },
    carInfo() {
      const info = this.activeVehicleModel;
      return [
        { label: "项目代号", value: info.modelName || "-" },
        { label: "SOP时间", value: info.sopTime || "-" },
        { label: "MSRP（万元）", value: info.expectedPrice || "-" },
        {
          label: "生命周期（台）",
          value: info.salesPlan ? Number(info.salesPlan).toLocaleString() : "-",
        },
        { label: "通用化率（%）", value: "零部件数量/价值20;20" },
      ];
    },
    moduleLabel() {
      const item = (this.moduleOptions || []).find(
        (option) => option.value === this.activeModule
      );
      return item ? item.label : "车身";
    },
    bottomViewLabel() {
      const item = (this.bottomViewOptions || []).find(
        (option) => option.value === this.bottomView
      );
      return item ? item.label : "定点完成情况";
    },
    activeModuleData() {
      return (
        (this.moduleData && this.moduleData[this.activeModule]) || BODY_MODULE
      );
    },
    activeCompleteBars() {
      if (this.bottomView === "modules") {
        return this.activeModuleData.modules_complete || [];
      }
      return this.activeModuleData.complete || [];
    },
    moduleCostBars() {
      return this.activeModuleData.cost || [];
    },
    activeParts() {
      return this.activeModuleData.parts || [];
    },
    activeChartTicks() {
      if (this.bottomView === "modules") {
        return [5000, 4000, 3000, 2000, 1000, 0];
      }
      return [15, 12, 9, 6, 3, 0];
    },
    activeChartMax() {
      if (this.bottomView === "modules") {
        return 5000;
      }
      return 15;
    },
  },
  methods: {
    selectChange(modelId) {
      this.activeModel = modelId;
      this.projectId = modelId;
      const res = this.modelOptions.filter((item) => item.id == modelId)[0];
      this.modelPage = res;
      this.optionsValue(modelId);
    },
    async projectGet(modelName) {
      try {
        const res = await projectGet({
          pageSize: 999,
          currentPage: 1,
        });
        const rows = res && res.rows ? res.rows : [];
        this.modelOptions = rows;
        if (modelName) {
          const mname = decodeURIComponent(modelName);
          const curModel = this.modelOptions.find(
            (item) => item.vehicleModel && item.vehicleModel.modelName == mname
          );
          if (curModel) {
            this.projectId = curModel.id;
            this.activeModel = curModel.id;
            this.modelPage = curModel;
          } else if (rows.length) {
            this.projectId = rows[0].id;
            this.activeModel = rows[0].id;
            this.modelPage = rows[0];
          }
        } else if (rows.length) {
          this.projectId = rows[0].id;
          this.activeModel = rows[0].id;
          this.modelPage = rows[0];
        }
        if (this.projectId) {
          this.optionsValue(this.projectId);
        }
      } catch (error) {
        console.error("加载车型数据失败:", error);
      }
    },
    async loadBoardData() {
      await Promise.all([this.boardBuget(), this.getCostBom(), this.getRevenueData()]);
    },
    async boardBuget() {
      try {
        const res = await boardBuget({
          type: 0,
          projectId: this.projectId,
        });
        const first = res && res.data && res.data[0] ? res.data[0] : {};
        const valveList = Array.isArray(first.valveList) ? first.valveList : [];
        this.hasBudgetData = valveList.length > 0;
        this.budgetValveData = this.toNineValveList(valveList).map(
          (item, index) => {
            const valve = this.valves[index] || VALVES[index] || {};
            const budget = Number(item.valveBudgetTotal || 0);
            return {
              name: valve.name || item.valveName || `G${9 - index}`,
              date: valve.date || "(—)",
              budget,
              used: Number(item.valveUsed || 0),
              rate: item.valveExecuteRate || 0,
            };
          }
        );
      } catch (error) {
        console.error("加载预算数据失败:", error);
      }
    },
    async getCostBom() {
      try {
        const res = await getCostBomCountResearch({
          type: 0,
          id: this.activeVehicleModel.id,
        });
        const list = Array.isArray(res && res.data) ? res.data : [];
        if (!list.length) {
          this.topCostRows = [];
          return;
        }

        const rows = await Promise.all(
          list.map(async (item) => {
            const valveList = await this.initFilter(item.valveList || []);
            return {
              name: item.projectModelName || "-",
              values: this.toNineValveList(valveList).map((cell, index) => {
                const current = this.formatCellValue(cell.totalCostStatus);
                const target = this.formatCellValue(cell.targetMaterialCost);
                return {
                  valve:
                    (this.valves[index] && this.valves[index].name) ||
                    `G${9 - index}`,
                  status: this.getCostStatusClass(cell),
                  current,
                  target,
                  rate: this.getDeviationRate(current, target),
                };
              }),
            };
          })
        );
        this.topCostRows = rows;
      } catch (error) {
        console.error("加载成本数据失败:", error);
      }
    },
    async getRevenueData() {
      try {
        const res = await getCostBomCountResearchTwo({
          type: 0,
          id: this.activeVehicleModel.id,
        });
        const list = Array.isArray(res && res.data) ? res.data : [];
        if (!list.length) {
          this.topRevenueRows = [];
          return;
        }

        const rows = await Promise.all(
          list.map(async (item) => {
            const valveList = await this.initFilter(item.valveList || []);
            return {
              name: item.projectModelName || "-",
              values: this.toNineValveList(valveList).map((cell, index) => {
                const marginalContribution = this.formatCellValue(cell.marginalContribution);
                const operatingProfit = this.formatCellValue(cell.operatingProfit);
                let marginalContributionRate = cell.marginalContributionRate;
                if (marginalContributionRate !== undefined && marginalContributionRate !== null && marginalContributionRate !== '') {
                  marginalContributionRate = Number(marginalContributionRate).toFixed(2) + "%";
                } else {
                  marginalContributionRate = "-";
                }
                let operatingProfitRate = cell.operatingProfitRate;
                if (operatingProfitRate !== undefined && operatingProfitRate !== null && operatingProfitRate !== '') {
                  operatingProfitRate = Number(operatingProfitRate).toFixed(2) + "%";
                } else {
                  operatingProfitRate = "-";
                }

                return {
                  valve:
                    (this.valves[index] && this.valves[index].name) ||
                    `G${9 - index}`,
                  status: this.getRevenueStatusClass(cell),
                  isFirstNonZero: cell.isFirstNonZero === 1,
                  marginalContribution: marginalContribution || '-',
                  marginalContributionRate,
                  operatingProfit: operatingProfit || '-',
                  operatingProfitRate,
                };
              }),
            };
          })
        );
        this.topRevenueRows = rows;
      } catch (error) {
        console.error("加载收益数据失败:", error);
      }
    },
    async optionsValue(projectId) {
      try {
        const header = await optionsValue({
          projectId: projectId || this.projectId || this.modelPage.id,
        });
        const list = Array.isArray(header && header.data) ? header.data : [];

        this.valves = this.toNineValveList(list).map((item) => ({
          name: item.valveName || "-",
          date: `(${item.valvePassageTime || "—"})`,
          id: item.id,
        }));

        this.loadBoardData();
      } catch (error) {
        console.error("加载阀点数据失败:", error);
      }
    },
    async initFilter(list) {
      const arr = [...(list || [])];
      let foundFirst = false;
      for (let i = arr.length - 1; i >= 0; i--) {
        if (!foundFirst && arr[i].valveStatus && arr[i].valveStatus != 0) {
          foundFirst = true;
          arr[i] = { ...arr[i], isFirstNonZero: 1 };
        }
      }
      return arr;
    },
    toNineValveList(list) {
      const result = Array.isArray(list) ? list.slice(0, 9) : [];
      while (result.length < 9) {
        result.push({});
      }
      return result;
    },
    formatCellValue(value) {
      if (value === undefined || value === null || value === "") return "";
      const number = Number(value);
      return Number.isNaN(number) ? value : number.toFixed(2);
    },
    getDeviationRate(current, target) {
      const currentNumber = Number(current);
      const targetNumber = Number(target);
      if (
        !targetNumber ||
        Number.isNaN(currentNumber) ||
        Number.isNaN(targetNumber)
      ) {
        return "50%";
      }
      return `${Math.round(
        ((currentNumber - targetNumber) / targetNumber) * 100
      )}%`;
    },
    getCostStatusClass(cell) {
      if (!cell || (!cell.totalCostStatus && !cell.targetMaterialCost))
        return "empty";
      if (cell.isFirstNonZero) {
        if (cell.valveStatus == 1 || cell.valveStatus == "1") return "deny";
        if (cell.valveStatus == 2 || cell.valveStatus == "2") return "warn";
        if (cell.valveStatus == 3 || cell.valveStatus == "3") return "pass";
      }
      return "normal";
    },
    getRevenueStatusClass(cell) {
      if (!cell || (!cell.marginalContribution && !cell.operatingProfit))
        return "empty";
      if (cell.isFirstNonZero) {
        if (cell.valveStatus == 1 || cell.valveStatus == "1") return "deny";
        if (cell.valveStatus == 2 || cell.valveStatus == "2") return "warn";
        if (cell.valveStatus == 3 || cell.valveStatus == "3") return "pass";
      }
      return "normal";
    },
    renderBudgetChart() {
      if (this.topMode !== "budget" || !this.$refs.budgetChart) return;
      if (this.budgetChart && this.budgetChart.getDom() !== this.$refs.budgetChart) {
        this.budgetChart.dispose();
        this.budgetChart = null;
      }
      if (!this.budgetChart) {
        this.budgetChart = echarts.init(this.$refs.budgetChart);
      }

      const names = this.budgetValveData.map(
        (item) => `${item.name}\n${item.date}`
      );
      const budgets = this.budgetValveData.map((item) => item.budget);
      const used = this.budgetValveData.map((item) => item.used);
      const rates = this.budgetValveData.map((item) => item.rate);
      // Round the axis ceiling up to the nearest thousand so the chart keeps
      // only the headroom needed for the largest value.
      const maxBudgetValue = Math.max(...budgets, ...used, 0);
      const roundedBudgetMax = Math.max(
        1000,
        Math.ceil(maxBudgetValue / 1000) * 1000
      );
      // Increase the interval when needed to keep the axis within 10 sections.
      const axisUnit = Math.max(
        1000,
        Math.ceil(roundedBudgetMax / 10 / 1000) * 1000
      );
      const yMax = Math.max(
        axisUnit,
        Math.ceil(roundedBudgetMax / axisUnit) * axisUnit
      );

      this.budgetChart.setOption(
        {
          animation: false,
          grid: {
            top: 16,
            left: 68,
            right: 40,
            bottom: 48,
            containLabel: false,
          },
          tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderColor: "#e5e7eb",
            borderWidth: 1,
            padding: [12, 16],
            textStyle: { color: "#333" },
            formatter: (params) => {
              const colorMap = {
                预算: {
                  dot: "#15c0cf",
                  border: "none",
                  text: "#555",
                },
                阀点已占用: {
                  dot: "#258cff",
                  border: "none",
                  text: "#2b8df5",
                },
                预算执行率: {
                  dot: "#ffa11b",
                  border: "none",
                  text: "#ff9f1a",
                  suffix: "%",
                },
              };
              let result = `<div style="font-size: 12px; font-weight: bold; color: #333; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 6px;">${params[0].name.replace(
                "\n",
                " "
              )}</div>`;
              params.forEach((item) => {
                const style = colorMap[item.seriesName] || {
                  dot: item.color,
                  border: "none",
                  text: "#333",
                };
                const val = style.suffix
                  ? `${item.value}${style.suffix}`
                  : this.formatNumber(item.value);
                result += `
                  <div style="display: flex; align-items: center; margin-top: 6px; font-size: 12px;">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${style.dot}; border: ${style.border}; margin-right: 8px;"></span>
                    <span style="color: #666; margin-right: 20px;">${item.seriesName}</span>
                    <span style="color: ${style.text}; font-weight: bold; margin-left: auto;">${val}</span>
                  </div>
                `;
              });
              return result;
            },
          },
          xAxis: {
            type: "category",
            data: names,
            boundaryGap: true,
            axisTick: { show: false },
            axisLine: {
              lineStyle: { color: "#c5d5ff" },
            },
            axisLabel: {
              interval: 0,
              color: "#6f6f6f",
              fontSize: 12,
              lineHeight: 18,
              margin: 10,
            },
            splitLine: {
              show: true,
              lineStyle: {
                color: "#c7d8ff",
                type: "dashed",
                width: 1,
              },
            },
          },
          yAxis: [
            {
              type: "value",
              min: 0,
              max: yMax,
              interval: axisUnit,
              axisTick: { show: false },
              axisLine: { show: false },
              axisLabel: {
                color: "#9a9a9a",
                fontSize: 12,
                formatter: (value) => this.formatNumber(value),
              },
              splitLine: {
                show: true,
                lineStyle: {
                  color: "#c7d8ff",
                  type: "dashed",
                  width: 1,
                },
              },
            },
            {
              type: "value",
              min: 0,
              max: 100,
              interval: 20,
              axisTick: { show: false },
              axisLine: { show: false },
              axisLabel: {
                color: "#9a9a9a",
                fontSize: 12,
              },
              splitLine: { show: false },
            },
          ],
          series: [
            {
              name: "预算",
              type: "bar",
              z: 1,
              data: budgets,
              barWidth: 34,
              barGap: "-100%",
              itemStyle: {
                color: "#dff7fb",
                opacity: 0.8,
              },
              label: {
                show: false,
              },
            },
            {
              name: "阀点已占用",
              type: "bar",
              z: 1,
              data: used,
              barWidth: 34,
              barGap: "-100%",
              itemStyle: {
                color: "#2b8df5",
                opacity: 0.8,
              },
              label: {
                show: false,
              },
            },
            {
              name: "预算数值",
              type: "scatter",
              yAxisIndex: 0,
              z: 3,
              symbolSize: 1,
              itemStyle: { color: "transparent" },
              data: budgets.map((value, index) => [index, value]),
              tooltip: { show: false },
              label: {
                show: true,
                position: "top",
                color: "#777",
                fontSize: 12,
                formatter: ({ value }) =>
                  value[1] ? this.formatNumber(value[1]) : "0.00",
              },
            },
            {
              name: "阀点已占用数值",
              type: "scatter",
              yAxisIndex: 0,
              z: 3,
              symbolSize: 1,
              itemStyle: { color: "transparent" },
              data: used.map((value, index) => [index, value]),
              tooltip: { show: false },
              label: {
                show: true,
                position: "top",
                color: "#2b8df5",
                fontSize: 12,
                fontWeight: 700,
                formatter: ({ value }) =>
                  value[1] ? this.formatNumber(value[1]) : "",
              },
            },
            {
              name: "预算执行率",
              type: "line",
              z: 2,
              yAxisIndex: 1,
              data: rates,
              smooth: true,
              symbol: "none",
              lineStyle: {
                color: "#ff9f1a",
                width: 2,
              },
              label: { show: false },
            },
          ],
        },
        true
      );
    },
    resizeBudgetChart() {
      if (this.budgetChart) {
        this.budgetChart.resize();
      }
    },
    makeTopCostValues(statusList) {
      return makeTopCostValues(statusList);
    },
    cloneModule(scale) {
      return cloneModule(scale);
    },
    formatNumber(value) {
      return Number(value).toLocaleString();
    },
    barHeight(value, max) {
      return `${Math.max(0, Math.min(value / max, 1)) * 100}%`;
    },
    getBudgetBottom(tick) {
      return `${(tick / 10000) * 100}%`;
    },
    chartBottom(tick) {
      return `${(tick / 15) * 100}%`;
    },
    chartHeight(value) {
      return this.barHeight(value, 15);
    },
    activeChartBottom(tick) {
      return `${(tick / this.activeChartMax) * 100}%`;
    },
    activeChartHeight(value) {
      return this.barHeight(value, this.activeChartMax);
    },
    progressWidth(actual, target) {
      return `${Math.max(0, Math.min(actual / target, 1)) * 100}%`;
    },
  },
};
</script>

<style lang="scss" scoped>
.project-dashboard {
  height: 100vh;
  padding: 10px 12px;
  box-sizing: border-box;
  background: #eef0f3;
  color: #3d3d3d;
  font-family: Microsoft YaHei, Arial, sans-serif;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.top-grid {
  flex: none;
  display: grid;
  grid-template-columns: 40% 59%;
  gap: 12px;
  margin-bottom: 12px;
}

.car-card,
.top-chart-card,
.bottom-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 8px 22px rgba(51, 63, 82, 0.08);
}

.car-card {
  min-height: 300px;
  padding: 20px 24px 18px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.card-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.selector-pair {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.soft-select {
  min-width: 84px;
  height: 34px;
  border: 0;
  border-radius: 17px;
  background: #f3f3f3;
  color: #303030;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;

  i {
    margin-left: 5px;
  }
}

.brand-text {
  min-width: 84px;
  height: 34px;
  line-height: 34px;
  border-radius: 17px;
  background: #f3f3f3;
  color: #303030;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
}

.model-select {
  min-width: 100px;
}

.dashboard-model-select {
  width: 128px;

  :deep(.el-select__wrapper) {
    height: 34px;
    min-height: 34px;
    padding: 0 12px;
    border: 0;
    border-radius: 17px;
    background: #f3f3f3;
    box-shadow: none;
  }

  :deep(.el-select__wrapper:hover),
  :deep(.el-select__wrapper.is-focused) {
    box-shadow: none;
  }

  :deep(.el-select__selected-item) {
    overflow: hidden;
    color: #303030;
    font-size: 14px;
    font-weight: 700;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.el-input__wrapper) {
    height: 34px;
    padding: 0;
    border: 0;
    border-radius: 17px;
    background: #f3f3f3;
    box-shadow: none;
  }

  :deep(.el-input__wrapper:hover),
  :deep(.el-input.is-focus .el-input__wrapper),
  :deep(.el-input__wrapper.is-focus) {
    box-shadow: none;
  }

  :deep(.el-input__inner) {
    height: 34px;
    line-height: 34px;
    border: 0;
    border-radius: 17px;
    background: transparent;
    color: #303030;
    font-size: 14px;
    font-weight: 700;
    padding: 0 28px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  ::v-deep .el-input__icon {
    line-height: 34px;
  }
}

.small-select {
  min-width: 86px;
}

.view-select {
  min-width: 154px;
}

.car-image-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin: 15px 0;
  height: 260px;
  background: radial-gradient(
    ellipse 60% 15% at 50% 90%,
    rgba(180, 180, 180, 0.4) 0%,
    rgba(255, 255, 255, 0) 70%
  );
}

.car-image-wrap img {
  width: 500px;
  max-height: 250px;
  object-fit: contain;
  position: relative;
  z-index: 1;
}

.car-info {
  display: flex;
  text-align: center;
  justify-content: space-between;
}

.info-item {
  span {
    display: block;
    line-height: 24px;
    font-size: 14px;
  }
  strong {
    display: block;
    font-size: 14px;
    font-weight: bold;
    color: #000;
    margin-bottom: 4px;
  }
}

.top-chart-card {
  position: relative;
  height: 462px;
  padding: 68px 35px 26px;
  box-sizing: border-box;
}

.mode-switch {
  position: absolute;
  top: 18px;
  right: 22px;
  height: 34px;
  display: flex;
  background: #f7f7f7;
  border-radius: 17px;

  button {
    width: 60px;
    border: 0;
    background: transparent;
    border-radius: 17px;
    font-size: 14px;
    color: #666;
    cursor: pointer;
    font-weight: 500;

    &.active {
      background: #fff;
      color: #333;
      border: 1px solid #d6d6d6;
    }
  }
}

.valve-axis {
  position: relative;
  display: grid;
  grid-template-columns: 68px repeat(9, minmax(64px, 1fr)) 40px;
  align-items: center;
  height: 36px;
  z-index: 10;
  // border-bottom: 1px solid #a9bfff;
  .topborders {
    height: 1px;
    background-color: #a9bfff;
    width: 100%;
    // border-top: 1px solid #a9bfff;
    position: absolute;
    top: 20px;
    z-index: 1;
  }

  .unit {
    grid-column: 1 / 2;
    font-size: 14px;
    font-weight: 700;
    color: #777;
    white-space: nowrap;
    margin-bottom: 24px;
  }
}

.cost-axis {
  grid-template-columns: 82px repeat(9, minmax(0, 1fr));
}

.valve-pill {
  justify-self: center;
  width: 62px;
  height: 28px;
  line-height: 26px;
  border: 1px solid #adc0ff;
  border-radius: 14px;
  text-align: center;
  background: #fff;
  font-size: 14px;
  color: #555;
  z-index: 20;
}

.valve-axis .valve-pill:last-child {
  grid-column: 10 / 11;
}

.cost-axis .valve-pill:last-child {
  grid-column: auto;
}

.budget-legend,
.cost-legend-line {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 18px;
  color: #606060;

  span {
    font-size: 12px;
  }

  i {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    margin-right: 5px;
  }
}

.budget-legend em {
  margin-left: auto;
  font-size: 12px;
  font-style: normal;
}

.cyan {
  background: #15c0cf;
}
.blue {
  background: #2d8cff;
}
.orange {
  background: #ffa11b;
}
.deep {
  background: #1e5dc8;
}
.light {
  background: #74b8ff;
}
.green {
  border: 2px solid #00c853;
  box-shadow: 0 0 10px rgba(0, 200, 83, 0.38);
}
.yellow {
  border: 2px solid #ffb300;
  box-shadow: 0 0 10px rgba(255, 179, 0, 0.38);
}
.red {
  border: 2px solid #ff2a1d;
  box-shadow: 0 0 10px rgba(255, 42, 29, 0.38);
}

.cost-legend-line {
  justify-content: space-between;
}

.cost-metric-legend,
.status-legend {
  display: flex;
  gap: 16px;
}

.budget-chart {
  width: 100%;
  height: 300px;
}

.left-scale,
.right-scale,
.y-axis {
  position: relative;
  color: #999;
  font-size: 13px;

  span {
    position: absolute;
    transform: translateY(50%);
  }
}

.left-scale span,
.y-axis span {
  right: 10px;
}

.right-scale span {
  left: 8px;
}

.left-scale span:nth-child(1),
.right-scale span:nth-child(1),
.y-axis span:nth-child(1) {
  bottom: 100%;
}
.left-scale span:nth-child(2),
.right-scale span:nth-child(2),
.y-axis span:nth-child(2) {
  bottom: 80%;
}
.left-scale span:nth-child(3),
.right-scale span:nth-child(3),
.y-axis span:nth-child(3) {
  bottom: 60%;
}
.left-scale span:nth-child(4),
.right-scale span:nth-child(4),
.y-axis span:nth-child(4) {
  bottom: 40%;
}
.left-scale span:nth-child(5),
.right-scale span:nth-child(5),
.y-axis span:nth-child(5) {
  bottom: 20%;
}
.left-scale span:nth-child(6),
.right-scale span:nth-child(6),
.y-axis span:nth-child(6) {
  bottom: 0;
}

.budget-plot,
.plot {
  position: relative;
}

.plot {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(120px, 1fr);
  align-items: end;
}

.grid-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  border-top: 1px dashed #cfdcff;
}

.cost-grid {
  display: flex;
  flex-direction: column;
  // justify-content: space-between;
  height: 300px;
  overflow-y: auto;
}

.cost-row {
  display: grid;
  grid-template-columns: 82px repeat(9, minmax(0, 1fr));
  min-height: 72px;
  background: #f0f4f8;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
}

.row-title {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(90deg, #bed0df 0%, #edf3f9 100%);
  font-size: 14px;
  line-height: 1.3;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  padding: 0 10px;
  box-sizing: border-box;
}

.cost-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  justify-self: center;
  color: #929292;

  p {
    margin: 2px 0;
    font-size: 13px;
  }

  i {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
  }

  &.pass,
  &.warn,
  &.deny {
    p:nth-child(1) {
      color: #1e5dc8;
    }
    p:nth-child(2) {
      color: #2d8cff;
    }
    p:nth-child(3) {
      color: #74b8ff;
    }
  }

  &.pass i {
    background: transparent;
    border: 2px solid #00c853;
  }

  &.warn i {
    background: transparent;
    border: 2px solid #ffb300;
  }

  &.deny i {
    background: transparent;
    border: 2px solid #ff2a1d;
  }

  &.empty {
    p {
      visibility: hidden;
    }
  }

  &.revenue-cell {
    i {
      border: none !important;
    }
  }
}

.bottom-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 22px 45px 20px;
}

.bottom-toolbar {
  flex: none;
  display: grid;
  grid-template-columns: 55% 45%;
  gap: 5px;
  margin-bottom: 14px;
}

.left-tools {
  display: flex;
  gap: 14px;
}

.part-title {
  margin-left: -10px;
  text-align: left;
  font-size: 15px;
  color: #555;
  font-weight: 700;
  display: flex;
  align-items: center;
}

.chart-meta,
.bottom-meta {
  height: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #808080;
  font-size: 14px;
  font-weight: 700;
  padding-right: 24px;
}

.legend-group {
  display: flex;
  gap: 22px;

  span {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #2f3440;
    font-weight: 400;
  }

  i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
  }
}

.green-dot i {
  border: 3px solid #4dd487;
  box-shadow: 0 0 10px rgba(77, 212, 135, 0.65);
}
.blue-dot i {
  border: 3px solid #258cff;
  box-shadow: 0 0 10px rgba(37, 140, 255, 0.65);
}
.pale-dot i {
  border: 3px solid #b6dcff;
  box-shadow: 0 0 10px rgba(120, 185, 255, 0.65);
}

.bar-chart {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 46px 1fr;
  margin-top: 14px;
}

.wide-bottom {
  flex: 1;
  min-height: 0;
}

.plot {
  padding: 0 36px 44px;
  column-gap: 44px;
  overflow: hidden;
}

.bar-group {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-direction: column;
  min-width: 92px;

  span {
    position: absolute;
    bottom: -40px;
    width: 178px;
    text-align: center;
    color: #666;
    font-size: 13px;
    line-height: 18px;
  }
}

.bars {
  height: 100%;
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.bars b {
  width: 24px;
  display: block;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  transition: height 0.4s ease-out;
}

.actual-blue {
  background: linear-gradient(180deg, #258cff 0%, #0060c4 100%);
}
.target-blue {
  background: linear-gradient(180deg, #e3f2ff 0%, #c4e3ff 100%);
}
.actual-green {
  background: linear-gradient(180deg, #4dd487 0%, #17a956 100%);
}
.target-blue-solid {
  background: linear-gradient(180deg, #258cff 0%, #0060c4 100%);
}

.cost-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 53% 46%;
  gap: 27px;
}

.cost-layout-left {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.part-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.part-panel h3 {
  margin: 0;
  display: none;
}

.part-head {
  flex: none;
  display: flex;
  justify-content: space-between;
  color: #808080;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 16px;
  padding-right: 24px;
}

.part-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 8px;
}

.part-item strong {
  display: block;
  color: #4d6178;
  margin-bottom: 6px;
  font-size: 14px;
}

.progress {
  position: relative;
  height: 12px;
  background: #ebf4ff;
  // border-radius: 6px;
  margin-right: 66px;
}

.fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #258cff 0%, #5ba7ff 100%);
  // border-radius: 6px;
  transition: width 0.4s ease;
}

.progress i {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border: 3px solid #258cff;
  border-radius: 50%;
  background: #fff;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 6px rgba(37, 140, 255, 0.4);
}

.progress em,
.progress b {
  position: absolute;
  top: -24px;
  color: #258cff;
  font-size: 14px;
  font-style: normal;
  white-space: nowrap;
}

.progress em {
  transform: translateX(-50%);
}

.progress b {
  right: -56px;
  top: 50%;
  transform: translateY(-50%);
  color: #70b7ff;
}

.empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
}
</style>

<style lang="scss">
.dashboard-dropdown {
  .el-dropdown-menu__item {
    min-width: 120px;
    font-size: 14px;
  }
}

.visual-dashboard-model-option {
  max-width: 220px;

  .el-select-dropdown__item {
    max-width: 220px;
    padding-right: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
