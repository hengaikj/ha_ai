<template>
  <el-dialog
    :title="`收益测算：${objPage}`"
    :append-to-body="true"
    :fullscreen="true"
    :model-value="true"
    :before-close="handleClose"
    custom-class="wbs-list-dialog"
  >
    <div class="app-container">
      <div class="toolbar">
        <el-button
          v-hasPermi="['system:measure:calculate']"
          type="primary"
          :icon="Tickets"
          @click="handleCalculate"
          >计算</el-button
        >
      </div>
      <el-table
        ref="table"
        v-loading="loadingShow"
        :data="tableData"
        border
        height="calc(100vh - 170px)"
        :span-method="arraySpanMethod"
        :cell-class-name="tableCellClassName"
      >
        <el-table-column
          :label="objPage"
          align="center"
          class-name="td-font first-td"
          label-class-name="noborder1"
        >
          <el-table-column
            prop="a"
            align="center"
            class-name="td-font"
            width="144"
            label-class-name="noborder2"
          >
            <template #default="scope">
              <ToolTip :scope="scope" :cell="'a'"></ToolTip>
            </template>
          </el-table-column>
          <el-table-column
            prop="b"
            align="center"
            class-name="td-font"
            width="144"
          >
            <template #default="scope">
              <ToolTip :scope="scope" :cell="'b'"></ToolTip>
            </template>
          </el-table-column>
        </el-table-column>
        <el-table-column label="版型" align="center" class-name="td-font">
          <el-table-column
            v-for="(item, index) in titleList"
            :key="'title' + index"
            :label="item"
            :prop="`row${index}`"
            align="center"
            class-name="td-font"
            min-width="160"
          />
        </el-table-column>
      </el-table>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, reactive, onMounted, nextTick } from "vue";
import { ElLoading } from "element-plus";
// 使用原生 structuredClone 替代 lodash.cloneDeep
import {
  getVehicleModelAndValveName,
  measureList,
  postCalculate,
} from "@/api/revenue";
import { Tickets } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import ToolTip from "./ToolTip.vue";

const LOOK_TABLE_CLONE: Array<Record<string, unknown>> = [
  { a: "销量", b: 2 },
  { a: "MIX", b: 2 },
  { a: "市场指导价/合同价/MSRP（含税）", b: 2 },
  { a: "减：促销", b: 2 },
  { a: "", b: "终端促销" },
  { a: "", b: "变动促销" },
  { a: "客户成交价/TP（含税）", b: 2 },
  { a: "减：商务政策", b: 2 },
  { a: "经销商底价", b: 2 },
  { a: "减：销项税", b: 2 },
  { a: "销售收入", b: 2 },
  { a: "减：消费税及附加", b: 2 },
  { a: "", b: "消费税" },
  { a: "", b: "附加税" },
  { a: "减：变动成本", b: 2 },
  { a: "", b: "材料成本" },
  { a: "", b: "BOM材料成本" },
  { a: "", b: "油辅料" },
  { a: "", b: "摊销" },
  { a: "", b: "变动制造费用" },
  { a: "", b: "其中：工厂" },
  { a: "", b: "动总" },
  { a: "", b: "人工" },
  { a: "", b: "变动销售费用" },
  { a: "", b: "首保+终身" },
  { a: "", b: "质量索赔" },
  { a: "", b: "流量费" },
  { a: "", b: "整车运费" },
  { a: "边际贡献", b: 2 },
  { a: "边际贡献率", b: 2 },
  { a: "减:固定费用", b: 2 },
  { a: "", b: "固定制造费用" },
  { a: "", b: "固定销售费用" },
  { a: "", b: "管理费用" },
  { a: "", b: "研发费用" },
  { a: "", b: "财务费用" },
  { a: "营业利润", b: 2 },
  { a: "营业利润率", b: 2 },
];

const props = defineProps<{
  query_: {
    measureVersionId: string;
    version: string;
  };
}>();

const emit = defineEmits<{
  change: [];
}>();

const table = ref<any>(null);
const loadingShow = ref(true);
const page = reactive<Record<string, string>>({
  measureVersionId: "",
  version: "",
});
const titleList = ref<string[]>([]);
const objPage = ref("");
const tableDataClone = ref<Array<Record<string, unknown>>>(structuredClone(LOOK_TABLE_CLONE));
const tableData = ref<Array<Record<string, unknown>>>(structuredClone(LOOK_TABLE_CLONE));

function tableCellClassName({
  rowIndex,
  columnIndex,
}: {
  rowIndex: number;
  columnIndex: number;
}) {
  const classes = new Set(["td-nowrap"]);
  if (columnIndex < 2) {
    if (
      [0, 1, 2, 6, 8, 10, 14, 15, 28, 29, 30, 36, 37].includes(rowIndex)
    ) {
      classes.add("td-bold");
    }
    if ([3, 7, 9, 11, 14, 15, 16, 19, 23, 30].includes(rowIndex)) {
      classes.add("td-left");
    }
    if (
      [
        4, 5, 12, 13, 17, 18, 20, 21, 22, 24, 25, 26, 27, 31, 32,
        33, 34, 35,
      ].includes(rowIndex)
    ) {
      classes.add("td-right");
    }
  }
  return [...classes].join(" ");
}

function arraySpanMethod({
  rowIndex,
  columnIndex,
}: {
  row: unknown;
  column: unknown;
  rowIndex: number;
  columnIndex: number;
}) {
  if (
    [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 14, 28, 29, 30, 36, 37].includes(
      rowIndex,
    )
  ) {
    if (columnIndex == 0) {
      return [1, 2] as [number, number];
    }
    if (columnIndex == 1) {
      return [0, 0] as [number, number];
    }
  }
  if (columnIndex == 0) {
    if (rowIndex == 4) return [2, 1] as [number, number];
    if (rowIndex == 12) return [2, 1] as [number, number];
    if (rowIndex == 15) return [13, 1] as [number, number];
    if (rowIndex == 31) return [5, 1] as [number, number];
  }
  if (
    [
      5, 13, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33,
      34, 35,
    ].includes(rowIndex)
  ) {
    if (columnIndex == 0) {
      return [0, 0] as [number, number];
    }
  }
  return [1, 1] as [number, number];
}

function handleClose() {
  emit("change");
}

async function fetchMeasureList() {
  let res: any = await measureList(page);
  let data = {
    id: page.measureVersionId,
  };
  loadingShow.value = true;
  let res1: any = await getVehicleModelAndValveName(data);
  (objPage as any).value = res1.msg;

  (titleList as any).value = res.rows[4];
  const cloneTableData = structuredClone(tableDataClone.value);
  titleList.value.forEach((_item, index) => {
    for (let rowOffset = 6; rowOffset <= 43; rowOffset++) {
      const rowData = (res as any).rows[rowOffset] || [];
      cloneTableData[rowOffset - 6]["row" + index] = rowData[index] || "";
    }
  });
  tableData.value = cloneTableData;
  await nextTick();
  table.value?.doLayout();
  loadingShow.value = false;
}

async function handleCalculate() {
  const loading = ElLoading.service({
    lock: true,
    text: "Loading",
    spinner: "el-icon-loading",
    background: "rgba(0, 0, 0, 0.7)",
  });

  let data = {
    measureVersionId: page.measureVersionId,
    version: page.version,
  };
  await postCalculate(data)
    .then((res: any) => {
      BaseToast.success(res.msg);
      fetchMeasureList();
    })
    .finally(() => {
      loading.close();
    });
}

onMounted(() => {
  if (props.query_) {
    page.measureVersionId = props.query_.measureVersionId;
    page.version = props.query_.version;
  }
  fetchMeasureList();
});
</script>

<style scoped lang="scss">
.app-container {
  padding: 0;
  box-shadow: none;
  border-radius: 0;
}
.app-container ::v-deep {
  .td-bold {
    font-weight: bold;
    color: #000;
  }
  .td-left {
    text-align: left;
  }
  .td-right {
    text-align: right;
  }
  .td-nowrap .cell {
    white-space: nowrap;
  }
  .noborder1 {
    border-bottom-color: transparent;
  }
  .noborder2 {
    border-right-color: transparent;
  }
  .td-font {
    font-size: 16px;
    color: #000;
  }
  .first-td {
    overflow: visible;
    .cell {
      top: 22px;
      z-index: 2;
    }
  }
}

.toolbar {
  padding: 15px 0 15px 0;
}

::v-deep .el-tooltip__popper .is-dark {
  background-color: #fff !important;
  color: #333 !important;
  border: 1px solid #ddd !important;
  padding: 10px 12px !important;
  border-radius: 4px !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1) !important;
}
</style>
<style>
.custom-tooltip {
  color: #333333 !important;
  background: #b0e2ff !important;
  box-shadow: none !important;
}
.custom-tooltip.el-tooltip__popper[x-placement^="top"] .popper__arrow::after {
  border-top-color: #b0e2ff !important;
}
.custom-tooltip.el-tooltip__popper[x-placement^="top"] .popper__arrow {
  border-top-color: #b0e2ff !important;
}

.wbs-list-dialog .el-dialog__body {
  padding-top: 0;
  padding-bottom: 20px;
}

.wbs-list-dialog {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.wbs-list-dialog .el-dialog__wrapper {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
