<template>
  <div class="scale-container">
    <div class="checkbox">
      <!-- 头部 -->
      <!-- <headerbox></headerbox> -->

      <!-- 主体卡片容器 -->
      <div class="main-card">
        <!-- 顶部控制栏：品牌页签与预算/成本切换 -->
        <div class="control-bar">
          <!-- 左侧品牌页签 -->
          <div class="brand-tabs">
            <div
              v-for="tab in dict.type.brand_type"
              :key="tab.value"
              :class="['brand-tab-item', { active: activeBrand === tab.value }]"
              @click="activeBrand = tab.value"
            >
              {{ tab.label }}
            </div>
          </div>

          <!-- 右侧模式切换开关 -->
          <div class="mode-toggle">
            <div
              :class="['mode-toggle-btn', { active: activeMode === 'budget' }]"
              @click="activeMode = 'budget'"
            >
              预算
            </div>
            <div
              :class="['mode-toggle-btn', { active: activeMode === 'cost' }]"
              @click="activeMode = 'cost'"
            >
              成本
            </div>
            <div
              :class="['mode-toggle-btn', { active: activeMode === 'revenue' }]"
              @click="activeMode = 'revenue'"
            >
              收益
            </div>
          </div>
        </div>

        <!-- 阀点时间轴与单位行 -->
        <div class="valve-row">
          <div class="unit-label">
            单位：万元
            <!-- {{ activeMode === "budget" ? "万元" : "元" }} -->
          </div>

          <!-- 横向阀点轴线连接 -->
          <div class="valve-timeline-container">
            <div class="valve-line"></div>
            <div class="valve-nodes">
              <div
                v-for="valve in periodItems"
                :key="valve.id"
                class="valve-node-item"
              >
                <div class="valve-node-pill">
                  {{ valve.text }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 图例行 -->
        <div class="legend-row">
          <!-- 左侧指标图例 -->
          <div class="metrics-legend">
            <template v-if="activeMode === 'budget'">
              <span class="legend-dot-item"
                ><i class="dot yellow"></i> 预算</span
              >
              <span class="legend-dot-item"
                ><i class="dot blue"></i> 预算执行率</span
              >
            </template>
            <template v-else-if="activeMode === 'cost'">
              <span class="legend-dot-item cost-current"
                ><i class="dot yellow"></i> 当前成本</span
              >
              <span class="legend-dot-item cost-target"
                ><i class="dot blue"></i> 目标成本</span
              >
              <span class="legend-dot-item cost-deviation"
                ><i class="dot pink"></i> 偏差率</span
              >
            </template>
            <template v-else-if="activeMode === 'revenue'">
              <span class="legend-dot-item"><i class="dot" style="background: #1e5dc8; border: none"></i> 边贡</span>
              <span class="legend-dot-item"><i class="dot" style="background: #1e5dc8; border: none"></i> 边贡率</span>
              <span class="legend-dot-item"><i class="dot" style="background: #2d8cff; border: none"></i> 利润</span>
              <span class="legend-dot-item"><i class="dot" style="background: #2d8cff; border: none"></i> 利润率</span>
            </template>
          </div>

          <!-- 右侧状态图例 -->
          <div class="status-legend" v-if="activeMode !== 'revenue'">
            <span class="legend-status-item status-pass"
              ><i class="ring green"></i> 允许过阀</span
            >
            <span class="legend-status-item status-condition"
              ><i class="ring yellow"></i> 带条件过阀</span
            >
            <span class="legend-status-item status-deny"
              ><i class="ring red"></i> 不允许过阀</span
            >
          </div>
        </div>

        <!-- 数据展示网格 -->
        <div class="grid-container">
          <div class="grid-scroll-box" ref="scrollBox" @scroll="handleScroll">
            <table
              :class="[
                'grid-table',
                { 'grid-table-cost': activeMode === 'cost', 'grid-table-revenue': activeMode === 'revenue' },
              ]"
              v-if="filteredRows && filteredRows.length > 0"
            >
              <tbody>
                <tr v-for="(row, rowIndex) in filteredRows" :key="rowIndex">
                  <!-- 项目代号 (粘性定位在左侧) -->
                  <td class="project-cell">
                    <div class="project-pill-wrapper">
                      <div class="project-pillbox">
                        <div class="project-pill" @click="toVisualpage(row)">
                          {{ row.title }}
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- 阀点对应数值列 -->
                  <td
                    v-for="valve in periodItems"
                    :key="valve.id"
                    class="valve-value-cell"
                  >
                    <template v-if="getValveData(row, valve.id)">
                      <div
                        :class="[
                          'cell-value-group',
                          getHighlightClass(row, valve.id),
                          { 'mode-cost-hover': activeMode === 'cost' },
                        ]"
                        @click="handleCellClick(row, valve.id)"
                      >
                        <!-- 循环渲染多行指标值 -->
                        <div
                          v-for="(valItem, valIndex) in getValveData(
                            row,
                            valve.id
                          ).items"
                          :key="valIndex"
                          class="value-item-row"
                        >
                          <!-- 指示点 (实心蓝/浅蓝/黄/红或对应的空心状态圆圈) -->
                          <span
                            v-if="activeMode !== 'revenue'"
                            :class="[
                              'cell-indicator',
                              getIndicatorClass(row, valve.id, valIndex),
                            ]"
                          ></span>
                          <span
                            :class="[
                              'cell-text',
                              isValveStatusCell(row, valve.id) && activeMode !== 'revenue'
                                ? `metric-text-${valIndex}`
                                : '',
                            ]"
                            :style="activeMode === 'revenue' && valItem.highlightColor ? { color: valItem.highlightColor } : {}"
                            >{{ valItem.text }}</span
                          >
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <div class="cell-empty">-</div>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
            <!-- 空状态 -->
            <div class="empty-state" v-else>
              <el-empty description="暂无项目数据"></el-empty>
            </div>
          </div>
        </div>

        <!-- 底部向上滑动提示 -->
        <div class="slide-tip">(向上滑动查看)</div>
      </div>
    </div>

    <!-- 成本弹窗部分 -->
    <el-dialog
      v-model="open"
      :close-on-click-modal="false"
      modal-append-to-body
      append-to-body
      class="el-dash-dlog"
      :show-close="false"
      width="582px"
    >
      <div class="dilog-header">
        <div class="dilog-title">{{ carModel }}（{{ clickValveName }}）</div>
        <div class="el-icon-closes" @click="open = false">×</div>
      </div>
      <div class="unit-box">单位：万元</div>
      <div class="dialog-content">
        <table v-if="tableList.length" class="dialog-content-table">
          <thead>
            <tr>
              <th>类型</th>
              <th v-for="(row, rowIndex) in tableList" :key="rowIndex">
                {{ row.patternName }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>当前成本</td>
              <td v-for="(item, index) in tableListTwo" :key="'curr-' + index">
                {{ item }}
              </td>
            </tr>
            <tr>
              <td>目标成本</td>
              <td
                v-for="(item, index) in tableListThree"
                :key="'target-' + index"
              >
                {{ item }}
              </td>
            </tr>
            <tr>
              <td>偏差率</td>
              <td
                v-for="(item, index) in tableListDeviation"
                :key="'deviation-' + index"
              >
                {{ item }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="dialog-empty">暂无成本明细数据</div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
// import headerbox from "../productionnew/components/headerbox.vue";
import { ElLoading } from "element-plus";
import {
  boardBuget,
  getMeasureChange,
  getCostBomValveVoList,
  optionsValue,
  // 收益接口暂时停用，后续恢复收益看板时取消此处注释。
  // getMeasureCount,
} from "@/api/legacy-dashboard";
import { formatPrice, projectGet } from "@/api/legacy-dashboard";
import { fetchPlatformDictItems } from "@/api/platform-system";

export default {
  name: "BrandDashboard",
  components: {
    // headerbox,
  },
  data() {
    return {
      dict: {
        type: {
          brand_type: [],
        },
      },
      // 页签和切换状态
      activeBrand: "",
      activeMode: "budget", // budget: 预算, cost: 成本
      initialized: false,

      // 阀点配置
      periodItems: [],

      // 项目到品牌的映射
      projectList: [],
      modelToBrand: {},
      idToBrand: {},

      // 原始数据
      rawBudgetList: [],
      rawCostList: [],
      rawRevenueList: [],

      // 分页及缓存数据
      pageNum: 1,
      pageSize: 10,
      hasMore: true,
      loadingMore: false,

      // 弹窗数据
      open: false,
      carModel: "",
      clickValveName: "",
      tableList: [],
      tableListTwo: [],
      tableListThree: [],
      tableListDeviation: [],
    };
  },
  computed: {
    // 后端已经根据 brand 和 type 进行了过滤，前端直接展示即可
    filteredRows() {
      if (this.activeMode === "budget") return this.rawBudgetList;
      if (this.activeMode === "cost") return this.rawCostList;
      return this.rawRevenueList;
    },
  },
  watch: {
    "dict.type.brand_type"(val) {
      if (val && val.length > 0 && !this.activeBrand && !this.initialized) {
        this.activeBrand = val[0].value;
      }
    },
    activeBrand() {
      if (this.initialized) this.fetchData();
    },
    activeMode() {
      if (this.initialized) this.fetchData();
    },
  },
  mounted() {
    this.initData();
  },
  methods: {
    formatPrice,
    async initData() {
      const loading = ElLoading.service({
        lock: true,
        text: "正在加载数据...",
        spinner: "el-icon-loading",
        background: "rgba(0, 0, 0, 0.7)",
      });

      try {
        // 1. 加载品牌字典，顶部页签与系统字典保持一致
        const brandItems = await fetchPlatformDictItems("brand_type");
        this.dict.type.brand_type = brandItems.map((item) => ({
          label: item.label,
          value: item.value,
        }));
        const defaultBrand = this.dict.type.brand_type.find(
          (item) => item.value === "jihubrand"
        );
        this.activeBrand = defaultBrand?.value || this.dict.type.brand_type[0]?.value || "";

        // 2. 加载阀点选项
        const header = await optionsValue();
        this.periodItems = (header.data || []).map((item) => ({
          text: item.valveName,
          id: item.id,
        }));

        // 3. 加载项目列表用于映射品牌 (如果后续不需要前端映射，可按需移除，这里暂保留)
        const projectRes = await projectGet({ pageSize: 999, currentPage: 1 });
        this.projectList = projectRes.rows || [];
        this.projectList.forEach((p) => {
          if (p.vehicleModel && p.vehicleModel.modelName) {
            this.modelToBrand[p.vehicleModel.modelName] = p.vehicleModel.brand;
          }
          if (p.id && p.vehicleModel) {
            this.idToBrand[p.id] = p.vehicleModel.brand;
          }
        });
      } catch (err) {
        console.error("加载基础数据错误:", err);
      } finally {
        loading.close();
      }

      this.initialized = true;
      this.fetchData();
    },
    async fetchData(isLoadMore = false) {
      if (this.loadingMore || (isLoadMore && !this.hasMore)) return;

      const requestPageNum = isLoadMore ? this.pageNum + 1 : 1;
      this.loadingMore = true;

      if (!isLoadMore) {
        this.pageNum = 1;
        this.hasMore = true;
        this.rawBudgetList = [];
        this.rawCostList = [];
        this.rawRevenueList = [];

        // 重置滚动条位置为顶部
        if (this.$refs.scrollBox) {
          this.$refs.scrollBox.scrollTop = 0;
        }
      }

      const loading = !isLoadMore
        ? ElLoading.service({
            lock: true,
            text: "正在加载数据...",
            spinner: "el-icon-loading",
            background: "rgba(0, 0, 0, 0.7)",
          })
        : null;

      try {
        // 将字典 value 转换为后端期望的 brand 参数（取字典的完整 label）
        let currentBrandText = "";
        const brandObj = this.dict?.type?.brand_type?.find(
          (b) => b.value === this.activeBrand
        );
        if (brandObj) {
          currentBrandText = brandObj.label;
        }

        if (this.activeMode === "budget") {
          const budgetRes = await boardBuget({
            type: 1,
            brand: currentBrandText,
            pageNum: requestPageNum,
            pageSize: this.pageSize,
          });
          const budgetList = this.getPageList(budgetRes);
          const parsedBudgetList = this.parseBudgetData(budgetList);
          this.rawBudgetList = isLoadMore
            ? this.rawBudgetList.concat(parsedBudgetList)
            : parsedBudgetList;
          this.hasMore = this.hasNextPage(budgetRes, budgetList);
        } else if (this.activeMode === "cost") {
          const costRes = await getMeasureChange({
            brand: currentBrandText,
            pageNum: requestPageNum,
            pageSize: this.pageSize,
          });
          const costList = this.getPageList(costRes);
          const parsedCostList = this.parseCostData(costList);
          this.rawCostList = isLoadMore
            ? this.rawCostList.concat(parsedCostList)
            : parsedCostList;
          this.hasMore = this.hasNextPage(costRes, costList);
        } else if (this.activeMode === "revenue") {
          // 收益接口暂时停用，后续恢复收益看板时取消以下代码注释。
          /*
          const revenueRes = await getMeasureCount({
            brand: currentBrandText,
            pageNum: requestPageNum,
            pageSize: this.pageSize,
          });
          const revenueList = this.getPageList(revenueRes);
          const parsedRevenueList = this.parseRevenueData(revenueList);
          this.rawRevenueList = isLoadMore
            ? this.rawRevenueList.concat(parsedRevenueList)
            : parsedRevenueList;
          this.hasMore = this.hasNextPage(revenueRes, revenueList);
          */
          this.hasMore = false;
        }

        this.pageNum = requestPageNum;
      } catch (err) {
        console.error("加载报表数据错误:", err);
      } finally {
        this.loadingMore = false;
        if (loading) loading.close();
      }
    },
    getPageList(res) {
      if (Array.isArray(res?.rows)) return res.rows;
      if (Array.isArray(res?.data?.rows)) return res.data.rows;
      if (Array.isArray(res?.data?.records)) return res.data.records;
      if (Array.isArray(res?.data?.list)) return res.data.list;
      if (Array.isArray(res?.data)) return res.data;
      return [];
    },
    hasNextPage(res, list) {
      const total =
        res?.total ??
        res?.data?.total ??
        res?.data?.totalCount ??
        res?.data?.count;
      if (total !== undefined && total !== null) {
        const loadedCount =
          this.activeMode === "budget"
            ? this.rawBudgetList.length
            : this.rawCostList.length;
        return loadedCount < Number(total);
      }
      return list.length >= this.pageSize;
    },
    handleScroll(e) {
      const target = e.target;
      if (
        target.scrollHeight - target.scrollTop - target.clientHeight <= 20 &&
        !this.loadingMore &&
        this.hasMore
      ) {
        this.fetchData(true);
      }
    },
    // 解析预算数据
    parseBudgetData(list) {
      const results = [];
      list.forEach((item) => {
        const rowData = {
          projectId: item.vehicleModelId || item.projectId,
          title: item.projectModelName,
          values: [],
        };

        this.periodItems.forEach((periodItem) => {
          const vName = periodItem.text.substring(0, 2);
          const hasData = item.valveList.find(
            (valveItem) => valveItem.valveName === vName
          );

          let pushData;
          if (hasData) {
            pushData = {
              status: hasData.valveStatus,
              valveId: hasData.valveId,
              items: [
                { text: this.formatPrice(hasData.valveBudgetTotal) },
                { text: Number(hasData.valveExecuteRate).toFixed(2) + "%" },
              ],
            };
          } else {
            pushData = null;
          }
          rowData.values.push({
            valveId: periodItem.id,
            data: pushData,
          });
        });

        // 倒序寻找第一个有效的 status 高亮
        let firstStatusNot0 = false;
        for (let i = rowData.values.length - 1; i >= 0; i--) {
          const cell = rowData.values[i];
          if (cell.data) {
            const status = cell.data.status;
            if (status != 0 && !firstStatusNot0) {
              firstStatusNot0 = true;
              switch (parseInt(status)) {
                case 1:
                  cell.highlightClass = "textred";
                  break;
                case 2:
                  cell.highlightClass = "textyellow";
                  break;
                case 3:
                  cell.highlightClass = "textgreen";
                  break;
              }
              cell.data.items.forEach((itemVal) => {
                itemVal.highlight = true;
              });
            } else {
              cell.highlightClass = "textnone";
            }
          }
        }

        results.push(rowData);
      });
      return results;
    },
    // 解析成本数据
    parseCostData(list) {
      const results = [];
      list.forEach((item) => {
        const rowData = {
          projectId: item.vehicleModelId || item.projectId,
          title: item.projectModelName,
          vehicleModelName: item.vehicleModelName || item.projectModelName,
          values: [],
        };

        this.periodItems.forEach((periodItem) => {
          const vName = periodItem.text.substring(0, 2);
          const hasData = item.valveList.find(
            (valveItem) => valveItem.valveName === vName
          );

          let pushData;
          if (hasData) {
            const currentVal = Number(hasData.totalCostStatus);
            const targetVal = Number(hasData.targetMaterialCost);
            let deviationRateText = "--";

            if (targetVal && !isNaN(currentVal) && !isNaN(targetVal)) {
              deviationRateText =
                (((currentVal - targetVal) / targetVal) * 100).toFixed(2) + "%";
            }

            pushData = {
              status: hasData.valveStatus,
              valveId: hasData.valveId,
              items: [
                { text: this.formatPrice(hasData.totalCostStatus) },
                { text: this.formatPrice(hasData.targetMaterialCost) },
                { text: deviationRateText },
              ],
            };
          } else {
            pushData = null;
          }
          rowData.values.push({
            valveId: periodItem.id,
            data: pushData,
          });
        });

        // 倒序寻找第一个有效的 status 高亮
        let firstStatusNot0 = false;
        for (let i = rowData.values.length - 1; i >= 0; i--) {
          const cell = rowData.values[i];
          if (cell.data) {
            const status = cell.data.status;
            if (status != 0 && !firstStatusNot0) {
              firstStatusNot0 = true;
              switch (parseInt(status)) {
                case 1:
                  cell.highlightClass = "textred";
                  break;
                case 2:
                  cell.highlightClass = "textyellow";
                  break;
                case 3:
                  cell.highlightClass = "textgreen";
                  break;
              }
              cell.data.items.forEach((itemVal) => {
                itemVal.highlight = true;
              });
            } else {
              cell.highlightClass = "textnone";
            }
          }
        }

        results.push(rowData);
      });
      return results;
    },
    // 解析收益数据
    parseRevenueData(list) {
      const results = [];
      list.forEach((item) => {
        const rowData = {
          projectId: item.vehicleModelId || item.projectId,
          title: item.projectModelName,
          vehicleModelName: item.vehicleModelName || item.projectModelName,
          values: [],
        };

        this.periodItems.forEach((periodItem) => {
          const vName = periodItem.text.substring(0, 2);
          const hasData = item.valveList.find(
            (valveItem) => valveItem.valveName === vName
          );

          let pushData;
          if (hasData) {
            pushData = {
              status: hasData.valveStatus,
              valveId: hasData.valveId,
              items: [
                { text: this.formatPrice(hasData.marginalContribution) },
                { text: Number(hasData.marginalContributionRate).toFixed(2) + "%" },
                { text: this.formatPrice(hasData.operatingProfit) },
                { text: Number(hasData.operatingProfitRate).toFixed(2) + "%" },
              ],
            };
          } else {
            pushData = null;
          }
          rowData.values.push({
            valveId: periodItem.id,
            data: pushData,
          });
        });

        // 倒序寻找第一个有效的 status 高亮
        let firstStatusNot0 = false;
        for (let i = rowData.values.length - 1; i >= 0; i--) {
          const cell = rowData.values[i];
          if (cell.data) {
            const status = cell.data.status;
            if (status != 0 && !firstStatusNot0) {
              firstStatusNot0 = true;
              cell.data.items[0].highlightColor = '#1e5dc8';
              cell.data.items[1].highlightColor = '#1e5dc8';
              cell.data.items[2].highlightColor = '#2d8cff';
              cell.data.items[3].highlightColor = '#2d8cff';
            }
          }
        }

        results.push(rowData);
      });
      return results;
    },
    // 获取指定阀点的单元格包装数据
    getValveData(row, valveId) {
      const cell = row.values.find((v) => v.valveId === valveId);
      return cell ? cell.data : null;
    },
    // 获取单元格高亮类名
    getHighlightClass(row, valveId) {
      const cell = row.values.find((v) => v.valveId === valveId);
      return cell ? cell.highlightClass : "";
    },
    // 只有当前带过阀状态的格子，才使用指标文字颜色
    isValveStatusCell(row, valveId) {
      const highlightClass = this.getHighlightClass(row, valveId);
      return !!highlightClass && highlightClass !== "textnone";
    },
    // 根据是否高亮和索引返回指示点类名
    getIndicatorClass(row, valveId, index) {
      const cell = row.values.find((v) => v.valveId === valveId);
      if (!cell || !cell.data) return "";

      const isHighlighted =
        cell.highlightClass && cell.highlightClass !== "textnone";
      if (isHighlighted) {
        // 高亮时：空心状态色圆圈
        if (cell.highlightClass === "textgreen") return "ring-green";
        if (cell.highlightClass === "textyellow") return "ring-yellow";
        if (cell.highlightClass === "textred") return "ring-red";
      }

      // 未高亮或无状态：实心标准色圆圈
      if (this.activeMode === "budget") {
        return index === 0 ? "dot-yellow" : "dot-blue";
      } else {
        if (index === 0) return "dot-yellow";
        if (index === 1) return "dot-blue";
        return "dot-pink";
      }
    },
    // 点击项目代号跳转可视化页面
    toVisualpage(row) {
      const { href } = this.$router.resolve({
        path: "/visualnew",
        query: {
          projectId: row.projectId,
          modelName: encodeURIComponent(row.title),
        },
      });
      window.open(href, "_blank");
    },
    // 点击单元格
    handleCellClick(row, valveId) {
      if (this.activeMode !== "cost") return; // 只有成本模式下支持弹窗详情

      const cell = row.values.find((v) => v.valveId === valveId);
      if (!cell || !cell.data || !cell.data.valveId) return;

      this.popupCostBreakdown(row.projectId, cell.data.valveId, row.title);
    },
    // 弹出详细成本拆分
    async popupCostBreakdown(projectId, valveId, modelName) {
      this.carModel = modelName;
      this.clickValveName =
        this.periodItems.find((item) => item.id === valveId)?.text ?? "";
      this.tableList = [];
      this.tableListTwo = [];
      this.tableListThree = [];
      this.tableListDeviation = [];
      this.open = true;

      try {
        let res = await getCostBomValveVoList({
          vehicleModelId: projectId,
          valveId,
        });
        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.patternList)
          ? res.data.patternList
          : Array.isArray(res.rows)
          ? res.rows
          : Array.isArray(res.data?.rows)
          ? res.data.rows
          : Array.isArray(res.data?.list)
          ? res.data.list
          : [];
        this.tableList = data;
        this.tableListTwo = this.tableList.map(
          (item) => item.currentCost ?? item.totalCostStatus
        );
        this.tableListThree = this.tableList.map(
          (item) => item.targetCost ?? item.targetMaterialCost
        );
        this.tableListDeviation = this.tableList.map((item) =>
          item.deviationRate !== undefined && item.deviationRate !== null
            ? this.formatDeviationRate(item.deviationRate)
            : this.getDeviationRate(
                item.currentCost ?? item.totalCostStatus,
                item.targetCost ?? item.targetMaterialCost
              )
        );
      } catch (err) {
        console.error("加载成本详情出错:", err);
      }
    },
    getDeviationRate(current, target) {
      const currentVal = Number(current);
      const targetVal = Number(target);
      if (!targetVal || isNaN(currentVal) || isNaN(targetVal)) return "0.00%";
      return (((currentVal - targetVal) / targetVal) * 100).toFixed(2) + "%";
    },
    formatDeviationRate(value) {
      const num = Number(value);
      if (isNaN(num)) return "0.00%";
      return (Math.abs(num) <= 1 ? num * 100 : num).toFixed(2) + "%";
    },
  },
};
</script>

<style lang="scss" scoped>
.scale-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #f3f4f6;

  .checkbox {
    width: 100%;
    height: 100%;
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: 7px 4px 8px 4px;
  }
}

/* 主体内容卡片 */
.main-card {
  flex: 1;
  min-height: 0;
  margin: 0;
  background: #ffffff;
  border-radius: 30px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 0 30px 14px 30px;
  overflow: hidden;
  border: none;
  box-shadow: 0 8px 20px rgba(38, 44, 54, 0.08);
}

/* 顶部控制栏 */
.control-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  height: 128px;
  margin-bottom: 0;
}

/* 左侧品牌页签 */
.brand-tabs {
  display: flex;
  gap: 31px;
  background: transparent;
  border-radius: 0;
  padding: 0;
  border: none;

  .brand-tab-item {
    font-family: Microsoft YaHei;
    font-weight: bold;
    font-size: 20px;
    line-height: 52px;
    min-width: 140px;
    height: 52px;
    color: #2d8cff;
    background: #fbfbfb;
    text-align: center;
    padding: 0 18px;
    border-radius: 0 0 22px 22px;
    cursor: default;
    transition: all 0.2s;

    &:hover {
      color: #1784ff;
    }

    &.active {
      background: #2a8cff;
      color: #ffffff;
      box-shadow: none;
    }
  }
}

/* 右侧模式切换开关 */
.mode-toggle {
  display: flex;
  margin-top: 65px;
  background: #f8f8f8;
  border-radius: 18px;
  padding: 0;
  border: none;
  overflow: hidden;

  .mode-toggle-btn {
    font-family: Microsoft YaHei;
    font-weight: 400;
    font-size: 16px;
    color: #676b72;
    min-width: 96px;
    height: 36px;
    line-height: 34px;
    text-align: center;
    padding: 0;
    border-radius: 18px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: #333333;
    }

    &.active {
      background: #ffffff;
      color: #333333;
      border: 1px solid #c9cdd4;
      box-shadow: none;
    }
  }
}

/* 阀点时间轴与单位行 */
.valve-row {
  position: relative;
  display: flex;
  align-items: flex-end;
  height: 48px;
  margin-bottom: 22px;
  padding-bottom: 0;
  border-bottom: none;

  .unit-label {
    position: absolute;
    left: 0;
    bottom: 28px;
    z-index: 3;
    width: 160px;
    font-family: Microsoft YaHei;
    font-size: 14px;
    color: #666666;
    font-weight: 400;
  }

  .valve-timeline-container {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    padding-left: 164px;

    .valve-line {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 1px;
      background: #9fb9ff;
      z-index: 1;
    }

    .valve-nodes {
      display: flex;
      flex-wrap: nowrap;
      width: 100%;
      position: relative;
      z-index: 2;
    }

    .valve-node-item {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      justify-content: center;
      align-items: center;

      .valve-node-pill {
        background: #ffffff;
        border: 1px solid #9fb9ff;
        color: #333333;
        font-family: Arial, Helvetica, sans-serif;
        font-weight: 400;
        font-size: 16px;
        width: min(70px, 100%);
        height: 34px;
        border-radius: 17px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: none;
        text-align: center;
        line-height: 1;
      }
    }
  }
}

/* 图例行 */
.legend-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 28px;
  margin-bottom: 24px;
  padding: 0;

  .metrics-legend,
  .status-legend {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .legend-dot-item,
  .legend-status-item {
    display: flex;
    align-items: center;
    font-family: Microsoft YaHei;
    font-size: 14px;
    color: #333333;
    font-weight: 400;

    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 4px;

      &.yellow {
        background: #1e5dc8;
      }
      &.blue {
        background: #2d8cff;
      }
      &.pink {
        background: #74b8ff;
      }
    }

    .ring {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border-width: 2px;
      border-style: solid;
      margin-right: 4px;

      &.green {
        border-color: #00c853;
      }
      &.yellow {
        border-color: #ffb300;
      }
      &.red {
        border-color: #ff2a1d;
      }
    }
  }

  .cost-current {
    color: #333333;
  }

  .cost-target {
    color: #333333;
  }

  .cost-deviation {
    color: #333333;
  }

  .status-pass {
    color: #333333;
  }

  .status-condition {
    color: #333333;
  }

  .status-deny {
    color: #333333;
  }
}

/* 数据展示网格 */
.grid-container {
  flex: 1;
  overflow: hidden;
  background: transparent;
  border-radius: 0;
  border: none;
  display: flex;
  flex-direction: column;
}

.grid-scroll-box {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 0;

  /* Sleek Scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.02);
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.08);
    border-radius: 3px;
    transition: all 0.3s;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.2);
  }
}

.grid-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 11px;
  table-layout: fixed;

  tr {
    transition: background-color 0.2s;

    &:hover {
      background-color: transparent;
    }
  }

  td {
    height: 76px;
    padding: 0;
    vertical-align: middle;
    background: #f0f4f8;
  }
}

.grid-table-cost {
  td {
    height: 84px;
  }

  .project-pill {
    // height: 84px;
  }
}

/* 项目代号单元格 (Sticky定位) */
.project-cell {
  position: sticky;
  left: 0;
  background: transparent !important;
  z-index: 10;
  width: 164px;
  min-width: 164px;
  max-width: 164px;
  box-shadow: none;
  border-right: none;

  .project-pill-wrapper {
    padding-left: 0;
    padding-right: 0;
    height: 100%;
  }
  .project-pillbox {
    background: #f0f4f8;
    border-radius: 14px 0 0 14px;
    height: 100%;
    display: flex;
    align-items: stretch;
  }
  .project-pill {
    width: 164px;
    // height: 76px;
    box-sizing: border-box;
    background: linear-gradient(90deg, #bed0df 0%, #edf3f9 100%);
    color: #333333;
    font-family: Microsoft YaHei;
    font-weight: 400;
    font-size: 20px;
    padding: 0 14px;
    border-radius: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all 0.2s;
    box-shadow: none;

    &:hover {
      background: linear-gradient(90deg, #bed0df 0%, #edf3f9 100%);
      color: #333333;
    }
  }
}

/* 阀点数值单元格 */
.valve-value-cell {
  width: calc((100% - 164px) / 9);
  min-width: 0;
  max-width: none;
  text-align: left;
  border-right: 2px solid #ffffff;

  &:last-child {
    border-right: none;
    border-radius: 0 14px 14px 0;
  }

  .cell-empty {
    font-family: Arial, sans-serif;
    color: transparent;
    font-size: 14px;
  }
}

/* 单元格多行数值包裹 */
.cell-value-group {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  min-height: 50px;
  margin-left: 30%;
  padding: 0;
  border-radius: 0;
  transition: all 0.2s;

  &.textgreen {
    background: transparent;
    .cell-text {
      font-weight: 400;
    }
  }
  &.textyellow {
    background: transparent;
    .cell-text {
      font-weight: 400;
    }
  }
  &.textred {
    background: transparent;
    .cell-text {
      font-weight: 400;
    }
  }

  // 成本模式下允许点击触发弹窗
  cursor: default;
  &:hover {
    background: transparent;
  }
}

// 成本模式下单元格有点击动作时指针变化
.mode-cost-hover {
  cursor: pointer !important;
}

.value-item-row {
  display: flex;
  align-items: center;
  height: 28px;
  margin: 0;

  .cell-indicator {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 5px;

    /* 标准实心点 */
    &.dot-yellow {
      background: #1e5dc8;
    }
    &.dot-blue {
      background: #2d8cff;
    }
    &.dot-pink {
      background: #74b8ff;
    }

    /* 高亮空心环 */
    &.ring-green {
      width: 8px;
      height: 8px;
      background: transparent;
      border: 2px solid #00c853;
      box-shadow: 0 0 12px rgba(0, 200, 83, 0.38);
    }
    &.ring-yellow {
      width: 8px;
      height: 8px;
      background: transparent;
      border: 2px solid #ffb300;
      box-shadow: 0 0 12px rgba(255, 179, 0, 0.38);
    }
    &.ring-red {
      width: 8px;
      height: 8px;
      background: transparent;
      border: 2px solid #ff2a1d;
      box-shadow: 0 0 12px rgba(255, 42, 29, 0.38);
    }
  }

  .cell-text {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 16px;
    color: #8c8c8c;
  }

  .metric-text-0 {
    color: #1e5dc8 !important;
  }

  .metric-text-1 {
    color: #2d8cff !important;
  }

  .metric-text-2 {
    color: #74b8ff !important;
  }
}

/* 底部向上滑动提示 */
.slide-tip {
  text-align: left;
  font-family: Microsoft YaHei;
  font-size: 16px;
  color: #333333;
  margin-top: 8px;
  letter-spacing: 0;
}

/* 弹窗及其他样式兼容 */
.el-dash-dlog {
  ::v-deep .el-dialog__wrapper {
    background: rgba(33, 44, 60, 0.35);
  }

  ::v-deep .el-dialog {
    width: 582px !important;
    background: #f5f9ff !important;
    height: auto !important;
    min-height: 386px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 18px 46px rgba(33, 44, 60, 0.18);
  }

  ::v-deep.el-dialog:not(.is-fullscreen) {
    margin-top: 18vh !important;
  }

  ::v-deep .el-dialog__header {
    display: none;
  }

  ::v-deep .el-dialog__body {
    padding: 0;
    color: #303742;
  }

  .dilog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 62px;
    margin: 0 10px 0 22px;
    border-bottom: 1px solid #d4dce8;

    .dilog-title {
      min-width: 0;
      text-align: left;
      font-family: Microsoft YaHei;
      font-size: 16px;
      font-weight: 400;
      color: #303742;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .el-icon-closes {
      flex: 0 0 auto;
      width: 20px;
      height: 20px;
      margin-left: 12px;
      border-radius: 50%;
      background: #8dbdff;
      color: #ffffff;
      font-size: 20px;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 20px;
      cursor: pointer;
    }
  }

  .unit-box {
    padding: 18px 20px 25px 20px;
    font-family: Microsoft YaHei;
    font-size: 14px;
    color: #606975;
  }

  .dialog-content {
    max-height: 242px;
    overflow: auto;
    padding: 0 10px 25px 20px;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(87, 110, 142, 0.18);
      border-radius: 3px;
    }
  }

  .dialog-empty {
    height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #606975;
    font-size: 16px;
  }

  .dialog-content-table {
    font-family: Microsoft YaHei;
    font-size: 16px;
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    color: #303742;

    th,
    td {
      width: 135px;
      min-width: 135px;
      height: 62px;
      border: 1px solid #d0d6de;
      padding: 0 10px;
      text-align: center;
      vertical-align: middle;
    }

    th {
      height: 42px;
      font-weight: 400;
      background: #f2f6fc;
      color: #435066;
    }

    td:first-child {
      background: #f2f6fc;
      color: #435066;
    }
  }
}

.empty-state {
  padding: 80px 0;
  display: flex;
  justify-content: center;
  align-items: center;

  ::v-deep .el-empty__description p {
    color: #a0aec0;
  }
}
</style>

