<template>
  <div class="purchase-dashboard-wrap">
    <div class="dashboard-container" ref="screenRef" :style="dashboardStyle">
      <!-- Top Row -->
      <div class="top-row">
        <div class="top-card" v-for="(item, index) in topCards" :key="index">
          <div class="icon-wrap">
            <img :src="item.icon" alt="icon" class="top-card-icon" />
          </div>
          <div class="info">
            <div class="label">{{ item.title }}</div>
            <div class="value-wrap">
              <span class="value">{{ item.value }}</span>
              <span class="unit">{{ item.unit }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Middle Row -->
      <div class="middle-row">
        <div
          class="mid-card"
          v-for="(item, index) in midCards"
          :key="index"
          :class="[item.theme, { 'is-chart-mode': item.showChart }]"
        >
          <div class="card-header">
            <div class="title" :class="{ 'chart-title': item.showChart }">
              {{ item.title }}
            </div>
            <div class="tabs" :class="{ 'chart-tabs': item.showChart }">
              <span
                class="tab"
                :class="{ active: item.activeTab === '月' }"
                @click="handleMidTabChange(item, index, '月')"
                >月</span
              >
              <span
                class="tab"
                :class="{ active: item.activeTab === '季' }"
                @click="handleMidTabChange(item, index, '季')"
                >季</span
              >
              <span
                class="tab"
                :class="{ active: item.activeTab === '年' }"
                @click="handleMidTabChange(item, index, '年')"
                >年</span
              >
            </div>
          </div>

          <div class="main-metric" v-show="!item.showChart">
            <span class="label">降本额</span>
            <span class="value">{{ item.value1 }}</span>
            <span class="unit">万元</span>
          </div>

          <div class="sub-metrics" v-show="!item.showChart">
            <div class="sub-item">
              <div class="label">采购额</div>
              <div class="value">
                {{ item.value2 }}万元
                <!-- <span class="unit"></span> -->
              </div>
            </div>
            <div class="sub-item">
              <div class="label">降本率</div>
              <div class="value">
                {{ item.valRate }}%
                <!-- <span class="unit"></span> -->
              </div>
            </div>
            <div class="sub-item">
              <div class="label">采购周期</div>
              <div class="value">
                {{ item.valDays }}
                <!-- <span class="unit">天</span> -->
              </div>
            </div>
          </div>

          <!-- Chart View -->
          <div class="mid-chart-wrapper" v-show="item.showChart">
            <div class="legend-area mid-legend">
              <div class="unit-label">
                单位: <span class="blue-text">万元</span>
              </div>
              <div class="legend">
                <span class="legend-item"><i class="dot blue"></i>采购额</span>
                <span class="legend-item"><i class="dot dark"></i>降本额</span>
              </div>
            </div>
            <div class="mid-chart-view">
              <div class="chart-placeholder" :ref="'midChart' + index"></div>
            </div>
          </div>

          <div class="card-switch-wrap">
            <el-switch
              v-model="item.showChart"
              class="legacy-card-switch"
              active-color="#409eff"
              inactive-color="rgba(255,255,255,0.5)"
            >
            </el-switch>
          </div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="bottom-row">
        <!-- Chart Section -->
        <div class="chart-section">
          <div class="chart-header">
            <div class="main-tabs">
              <span
                class="tab"
                :class="{ active: chartTab === '运维' }"
                @click="chartTab = '运维'"
                >运维</span
              >
              <span
                class="tab"
                :class="{ active: chartTab === '研发' }"
                @click="chartTab = '研发'"
                >研发</span
              >
              <span
                class="tab"
                :class="{ active: chartTab === '营销' }"
                @click="chartTab = '营销'"
                >营销</span
              >
              <span
                class="tab"
                :class="{ active: chartTab === '设备' }"
                @click="chartTab = '设备'"
                >设备</span
              >
            </div>
            <div class="tabs">
              <span
                class="tab"
                :class="{ active: chartTimeTab === '月' }"
                @click="chartTimeTab = '月'"
                >月</span
              >
              <span
                class="tab"
                :class="{ active: chartTimeTab === '季' }"
                @click="chartTimeTab = '季'"
                >季</span
              >
              <span
                class="tab"
                :class="{ active: chartTimeTab === '年' }"
                @click="chartTimeTab = '年'"
                >年</span
              >
            </div>
          </div>
          <div class="legend-area">
            <div class="unit-label">单位/万元</div>
            <div class="legend">
              <span class="legend-item"><i class="dot blue"></i>采购额</span>
              <span class="legend-item"><i class="dot dark"></i>降本额</span>
            </div>
          </div>

          <div class="chart-body" ref="lineChart"></div>
        </div>

        <!-- Right Cards -->
        <div class="right-cards">
          <div
            class="bottom-card"
            v-for="(item, index) in bottomCards"
            :key="index"
          >
            <div class="card-header">
              <div class="title">{{ item.title }}</div>
              <div class="tabs">
                <span
                  class="tab"
                  :class="{ active: item.activeTab === '月' }"
                  @click="handleRightCardTabChange(item, index, '月')"
                  >月</span
                >
                <span
                  class="tab"
                  :class="{ active: item.activeTab === '季' }"
                  @click="handleRightCardTabChange(item, index, '季')"
                  >季</span
                >
                <span
                  class="tab"
                  :class="{ active: item.activeTab === '年' }"
                  @click="handleRightCardTabChange(item, index, '年')"
                  >年</span
                >
              </div>
            </div>
            <div class="b-sub-metrics">
              <div class="b-sub-item">
                <div class="label">采购额</div>
                <div class="value">{{ item.v1 }}</div>
              </div>
              <div class="b-sub-item">
                <div class="label">降本额</div>
                <div class="value">{{ item.v2 }}</div>
              </div>
              <div class="b-sub-item">
                <div class="label">降本率</div>
                <div class="value">{{ item.rate }}%</div>
              </div>
              <div class="b-sub-item">
                <div class="label">采购周期</div>
                <div class="value">{{ item.days }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import * as echarts from "echarts";
import { formatPrice, procurementStatics } from "@/api/legacy-dashboard";

export default {
  name: "PurchaseDashboard",
  data() {
    return {
      pageTotal: {},
      chartTab: "运维",
      chartTimeTab: "月",
      topCards: [
        {
          title: "采购额",
          value: "0",
          unit: "万元",
          icon: new URL("../../assets/legacy-dashboard/group-5.png", import.meta.url).href,
        },
        {
          title: "降本额",
          value: "0",
          unit: "万元",
          icon: new URL("../../assets/legacy-dashboard/group-6.png", import.meta.url).href,
        },
        {
          title: "降本率",
          value: "0",
          unit: "%",
          icon: new URL("../../assets/legacy-dashboard/group-7.png", import.meta.url).href,
        },
        {
          title: "采购周期",
          value: "0",
          unit: "天",
          icon: new URL("../../assets/legacy-dashboard/group-8.png", import.meta.url).href,
        },
      ],
      midCards: [
        {
          title: "北汽股份",
          value1: "0",
          value2: "0",
          valRate: "0",
          valDays: "0",
          activeTab: "月",
          theme: "theme-0",
          showChart: false,
          chartData: { xData: [], costData: [], procureData: [] },
        },
        {
          title: "北汽新能源",
          value1: "0",
          value2: "0",
          valRate: "0",
          valDays: "0",
          activeTab: "月",
          theme: "theme-1",
          showChart: false,
          chartData: { xData: [], costData: [], procureData: [] },
        },
        {
          title: "研究总院",
          value1: "0",
          value2: "0",
          valRate: "0",
          valDays: "0",
          activeTab: "月",
          theme: "theme-2",
          showChart: false,
          chartData: { xData: [], costData: [], procureData: [] },
        },
      ],
      bottomCards: [
        {
          title: "运维",
          v1: "0",
          v2: "0",
          rate: "0",
          days: "0",
          activeTab: "月",
        },
        {
          title: "研发",
          v1: "0",
          v2: "0",
          rate: "0",
          days: "0",
          activeTab: "月",
        },
        {
          title: "营销",
          v1: "0",
          v2: "0",
          rate: "0",
          days: "0",
          activeTab: "月",
        },
        {
          title: "设备",
          v1: "0",
          v2: "0",
          rate: "0",
          days: "0",
          activeTab: "月",
        },
      ],
      myChart: null,
    };
  },

  mounted() {
    window.addEventListener("resize", this.resizeCharts);
    this.$nextTick(() => {
      this.initChart();
      this.fetchTopData();
      this.midCards.forEach((_, index) => {
        this.fetchMidData(index);
      });
      this.fetchBottomChartData();
      this.bottomCards.forEach((_, index) => {
        this.fetchRightCardData(index);
      });
    });
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.resizeCharts);
    if (this.myChart) {
      this.myChart.dispose();
      this.myChart = null;
    }

    // Dispose mid charts
    this.midCards.forEach((_item, index) => {
      if (this["midChart" + index]) {
        this["midChart" + index].dispose();
      }
    });
  },
  computed: {
    dashboardStyle() {
      return {};
    },
  },
  watch: {
    chartTab() {
      this.fetchBottomChartData();
    },
    chartTimeTab() {
      this.fetchBottomChartData();
    },
    midCards: {
      deep: true,
      handler(newVal) {
        this.$nextTick(() => {
          newVal.forEach((item, idx) => {
            if (item.showChart) {
              this.initMidChart(idx, item.theme);
            }
          });
        });
      },
    },
  },
  methods: {
    formatPrice,
    handleMidTabChange(item, index, tab) {
      if (item.activeTab === tab) return;
      item.activeTab = tab;
      this.fetchMidData(index);
    },
    async fetchMidData(index) {
      const item = this.midCards[index];
      let searchDate = 1;
      if (item.activeTab === "月") searchDate = 1;
      else if (item.activeTab === "季") searchDate = 2;
      else if (item.activeTab === "年") searchDate = 3;

      let data = {
        type: 1,
        searchDate: searchDate,
        searchKey: item.title,
      };

      try {
        let res = await procurementStatics(data);
        if (res.data) {
          item.value1 =
            this.formatPrice(res.data.costReductionAmountTotal) || "0";
          item.value2 =
            this.formatPrice(res.data.procurementAmountTotal) || "0";

          let rateValue = res.data.costReductionRateStr || "0";
          item.valRate = rateValue.includes("%")
            ? rateValue.replace(/%/g, "")
            : rateValue;

          let cycleValue =
            res.data.procurementCycleStr || res.data.procurementCycle || "0";
          item.valDays = cycleValue;

          let xData = [];
          let costData = [];
          let procureData = [];
          if (res.data.list) {
            res.data.list.forEach((v) => {
              xData.push(v.ydate);
              costData.push(v.costReductionAmountTotal);
              procureData.push(v.procurementAmountTotal);
            });
          }
          item.chartData = { xData, costData, procureData };

          if (item.showChart) {
            this.initMidChart(index, item.theme);
          }
        }
      } catch (error) {
        console.error("Failed to fetch mid row data:", error);
      }
    },
    handleRightCardTabChange(item, index, tab) {
      if (item.activeTab === tab) return;
      item.activeTab = tab;
      this.fetchRightCardData(index);
    },
    async fetchRightCardData(index) {
      const item = this.bottomCards[index];
      let searchDate = 1;
      if (item.activeTab === "月") searchDate = 1;
      else if (item.activeTab === "季") searchDate = 2;
      else if (item.activeTab === "年") searchDate = 3;

      let searchKey = item.title + "采购";

      let data = {
        type: 2,
        searchDate: searchDate,
        searchKey: searchKey,
      };

      try {
        let res = await procurementStatics(data);
        if (res.data) {
          item.v1 = this.formatPrice(res.data.procurementAmountTotal) || "0";
          item.v2 = this.formatPrice(res.data.costReductionAmountTotal) || "0";

          let rateValue = res.data.costReductionRateStr || "0";
          item.rate = rateValue.includes("%")
            ? rateValue.replace(/%/g, "")
            : rateValue;

          let cycleValue =
            res.data.procurementCycleStr || res.data.procurementCycle || "0";
          item.days = cycleValue;
        }
      } catch (error) {
        console.error("Failed to fetch right card data:", error);
      }
    },
    async fetchTopData() {
      try {
        let res = await procurementStatics({ type: 0 });
        if (res.data) {
          this.pageTotal = res.data;

          // Map data to topCards
          // 采购额
          this.topCards[0].value =
            this.formatPrice(this.pageTotal.procurementAmountTotal) || 0;
          // 降本额
          this.topCards[1].value =
            this.formatPrice(this.pageTotal.costReductionAmountTotal) || 0;

          // 降本率
          let rateValue = this.pageTotal.costReductionRateStr || "0";
          // Extract percentage symbol if it's there
          if (rateValue.includes("%")) {
            this.topCards[2].value = rateValue.replace(/%/g, "");
            this.topCards[2].unit = "%";
          } else {
            this.topCards[2].value = rateValue;
            this.topCards[2].unit = ""; // Or keep as '%' depending on API response
          }

          // 采购周期
          this.topCards[3].value = this.pageTotal.procurementCycle || 0;
        }
      } catch (error) {
        console.error("Failed to fetch top row data:", error);
      }
    },
    initChart() {
      // Initialize middle cards default charts if any are true
      this.midCards.forEach((item, index) => {
        if (item.showChart) {
          this.initMidChart(index, item.theme);
        }
      });
    },
    resizeCharts() {
      if (this.myChart) {
        this.myChart.resize();
      }
      this.midCards.forEach((_, index) => {
        if (this["midChart" + index]) {
          this["midChart" + index].resize();
        }
      });
    },
    async fetchBottomChartData() {
      let searchDate = 1;
      if (this.chartTimeTab === "月") searchDate = 1;
      else if (this.chartTimeTab === "季") searchDate = 2;
      else if (this.chartTimeTab === "年") searchDate = 3;

      let searchKey = this.chartTab + "采购";

      let data = {
        type: 2,
        searchDate: searchDate,
        searchKey: searchKey,
      };

      try {
        let res = await procurementStatics(data);
        if (res.data && res.data.list) {
          let xData = [];
          let costData = [];
          let procureData = [];

          res.data.list.forEach((v) => {
            xData.push(v.ydate);
            costData.push(v.costReductionAmountTotal);
            procureData.push(v.procurementAmountTotal);
          });

          this.updateBottomChart(xData, costData, procureData);
        } else {
          this.updateBottomChart([], [], []);
        }
      } catch (error) {
        console.error("Failed to fetch bottom chart data:", error);
      }
    },
    updateBottomChart(xData, costData, procureData) {
      if (!this.$refs.lineChart) return;
      if (!this.myChart) {
        this.myChart = echarts.init(this.$refs.lineChart);
      }
      const option = {
        grid: {
          left: "3%",
          right: "4%",
          bottom: "3%",
          top: "30px",
          containLabel: true,
        },
        tooltip: {
          trigger: "axis",
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          axisLine: { lineStyle: { color: "#eee" } },
          axisLabel: { color: "#999" },
          data: xData,
        },
        yAxis: {
          type: "value",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#f5f5f5" } },
          axisLabel: { color: "#999" },
        },
        series: [
          {
            name: "采购额",
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 8,
            itemStyle: { color: "#8b5cff" },
            lineStyle: { color: "#8b5cff", width: 2 },
            data: procureData,
          },
          {
            name: "降本额",
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 8,
            itemStyle: { color: "#2d336b" },
            lineStyle: { color: "#2d336b", width: 2 },
            data: costData,
          },
        ],
      };
      this.myChart.setOption(option);
    },
    initMidChart(index, _theme) {
      const refName = "midChart" + index;
      const doms = this.$refs[refName];
      if (!doms || !doms[0]) return;

      let chartInstance = this[refName];
      if (!chartInstance) {
        chartInstance = echarts.init(doms[0]);
        this[refName] = chartInstance;
      }

      const item = this.midCards[index];
      const cData = item.chartData || {
        xData: [],
        costData: [],
        procureData: [],
      };

      const option = {
        grid: {
          left: "4%",
          right: "4%",
          bottom: "4%",
          top: "20px",
          containLabel: true,
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          axisLine: { lineStyle: { color: "#eee" } },
          axisLabel: { color: "#999" },
          data: cData.xData,
        },
        yAxis: {
          type: "value",
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#f5f5f5" } },
          axisLabel: { color: "#999" },
        },
        tooltip: { trigger: "axis" },
        series: [
          {
            name: "采购额",
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            itemStyle: { color: "#8b5cff" },
            lineStyle: { color: "#8b5cff", width: 2 },
            data: cData.procureData,
          },
          {
            name: "降本额",
            type: "line",
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            itemStyle: { color: "#2d336b" },
            lineStyle: { color: "#2d336b", width: 2 },
            data: cData.costData,
          },
        ],
      };

      chartInstance.setOption(option);
      chartInstance.resize();
    },
  },
};
</script>

<style scoped>
.purchase-dashboard-wrap {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #f0f2f5;
  position: relative;
  font-family: "Microsoft YaHei", sans-serif;
}

.dashboard-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 24px;
  justify-content: center;
}

/* Top Row */
.top-row {
  display: flex;
  gap: 24px;
  height: 160px;
  background: #fff;
  border-radius: 12px;
}

.top-card {
  flex: 1;
  /* background: #fff; */
  /* border-radius: 12px; */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 30px;
  /* box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); */
}

.top-card-icon {
  width: 68px;
  height: 68px;
  object-fit: contain;
}

.icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
}

.info {
  display: flex;
  flex-direction: column;
}

.info .label {
  color: #666;
  font-size: 16px;
  margin-bottom: 8px;
}

.info .value-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.info .value {
  font-size: 38px;
  font-weight: bold;
  color: #222;
  line-height: 1;
}

.info .unit {
  font-size: 16px;
  color: #666;
}

/* Middle Row */
.middle-row {
  display: flex;
  gap: 24px;
  height: 350px;
}

.mid-card {
  flex: 1;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  border-radius: 12px;
  padding: 16px 30px 50px 30px;
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  position: relative;
}

.theme-0 {
  background: linear-gradient(135deg, #a4bde2, #c6d6f0);
}
.theme-1 {
  background: linear-gradient(135deg, #f79e5e, #fbc6a0);
}
.theme-2 {
  background: linear-gradient(135deg, #2b2e83, #535da8);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header .title {
  font-size: 24px;
  font-weight: bold;
  letter-spacing: 1px;
}

.tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 4px;
}

.tabs .tab {
  padding: 4px 16px;
  font-size: 14px;
  border-radius: 16px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
  transition: all 0.3s;
}

.tabs .tab.active,
.tabs .tab:hover {
  background: #fff;
  color: #333;
  font-weight: bold;
}

.main-metric {
  text-align: center;
  margin-top: 20px;
}

.main-metric .label {
  font-size: 18px;
  margin-right: 16px;
}

.main-metric .value {
  font-size: 48px;
  font-weight: bold;
}

.main-metric .unit {
  font-size: 18px;
  margin-left: 8px;
}

.sub-metrics {
  display: flex;
  justify-content: space-between;
  min-height: 3.33333vw;
  box-sizing: border-box;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 16px;
}

.sub-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.sub-item .label {
  font-size: 16px;
  margin-bottom: 8px;
  white-space: nowrap;
}

.sub-item .value {
  font-size: 20px;
  font-weight: bold;
  white-space: nowrap;
}

.sub-item .value .unit {
  font-size: 14px;
  font-weight: normal;
  margin-left: 4px;
}

.mid-chart-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mid-chart-wrapper .mid-legend {
  margin-bottom: 0px;
  margin-top: 10px;
}

.mid-chart-wrapper .unit-label .blue-text {
  color: #409eff;
}

.mid-chart-view {
  flex: 1;
  min-height: 0;
  display: flex;
}

.chart-placeholder {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.card-switch-wrap {
  position: absolute;
  right: 36px;
  bottom: 10px;
  z-index: 10;
}

.legacy-card-switch {
  --el-switch-off-color: rgba(255, 255, 255, 0.5);
}

.legacy-card-switch:not(.is-checked) :deep(.el-switch__core) {
  background-color: rgba(255, 255, 255, 0.5);
  border-color: rgba(255, 255, 255, 0.5);
}

.legacy-card-switch.is-checked :deep(.el-switch__core) {
  background-color: #409eff !important;
  border-color: #409eff !important;
}

/* Bottom Row */
.bottom-row {
  display: flex;
  gap: 24px;
  height: 500px;
}

.chart-section {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.chart-header .main-tabs {
  display: flex;
  background: #f5f5f5;
  border-radius: 20px;
  padding: 4px;
}

.main-tabs .tab {
  padding: 6px 24px;
  font-size: 16px;
  color: #999;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.main-tabs .tab.active,
.main-tabs .tab:hover {
  background: #fff;
  color: #333;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.legend-area {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.unit-label {
  font-size: 14px;
  color: #999;
}

.legend {
  display: flex;
  gap: 24px;
}

.legend-item {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #666;
}

/* is-chart-mode styles */
.mid-card.is-chart-mode {
  background: #fff;
  border: 1px solid #eef2f8;
}

.title.chart-title {
  color: #409eff;
}

.tabs.chart-tabs {
  background: #f5f5f5;
}

.tabs.chart-tabs .tab {
  color: #666;
}

.tabs.chart-tabs .tab.active {
  background: #fff;
  color: #333;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #ccc;
  margin-right: 8px;
}

.dot.blue {
  background: #8b5cff;
  box-shadow: 0 0 0 1px #8b5cff;
}
.dot.dark {
  background: #2d336b;
  box-shadow: 0 0 0 1px #2d336b;
}

.chart-body {
  flex: 1;
  min-height: 0;
}

.right-cards {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 24px;
}

.bottom-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  border: 1px solid #eef2f8;
}

.bottom-card .card-header .title {
  color: #333;
  font-size: 20px;
}

.chart-header .tabs,
.bottom-card .tabs {
  background: #f5f5f5;
}

.chart-header .tabs .tab,
.bottom-card .tabs .tab {
  color: #666;
}

.chart-header .tabs .tab.active,
.bottom-card .tabs .tab.active {
  background: #fff;
  color: #333;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.b-sub-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 12px;
  margin-top: 24px;
}

.b-sub-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.b-sub-item .label {
  color: #666;
  font-size: 13px;
  margin-bottom: 8px;
}

.b-sub-item .value {
  color: #222;
  font-size: 14px;
  font-weight: bold;
}

</style>
