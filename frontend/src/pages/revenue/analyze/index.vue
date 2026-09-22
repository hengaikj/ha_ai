<template>
  <div>
    <div class="app-container" style="padding: 10px 20px 30px 20px">
      <div class="content-box">
        <div class="legacy-splitpanes">
          <div class="legacy-pane legacy-pane--sidebar">
            <div class="left">
              <el-input
                v-model="leftSrarchValue"
                placeholder="请输入搜索内容1"
                :suffix-icon="Search"
                clearable
              ></el-input>
              <div
                :style="{
                  overflow: 'auto',
                  paddingTop: '17px',
                  height: 'calc(100vh - 260px)',
                }"
              >
                <el-tree
                  ref="leftTreeBox"
                  :data="treeData"
                  node-key="id"
                  :props="{
                    label: 'name',
                    children: 'children',
                  }"
                  highlight-current
                  :expand-on-click-node="false"
                  show-checkbox
                  default-expand-all
                  :filter-node-method="leftTreefilterNode"
                >
                  <!--
                  @check="subRoleTreeCheck" -->
                </el-tree>
              </div>
            </div>
          </div>
          <div class="legacy-pane legacy-pane--content">
            <div class="right">
              <BaseSearchForm :loading="tableLoading" @search="getTabledata" @reset="resetForm">
                <el-form :model="searchForm" label-position="left">
                  <el-form-item label="项目名称">
                    <el-cascader
                      v-model="searchForm.vehicleModelName"
                      style="width: 400px"
                      :options="cascaderOptions"
                      :props="{
                        multiple: true,
                        expandTrigger: 'hover',
                      }"
                      clearable
                      :show-all-levels="false"
                    ></el-cascader>
                  </el-form-item>

                  <el-form-item label="阀点">
                    <el-select
                      v-model="searchForm.valveId"
                      placeholder="请选择"
                      style="width: 100%"
                    >
                      <el-option
                        v-for="item in valueList"
                        :key="item.id"
                        :value="item.id"
                        :label="item.valveName"
                      ></el-option>
                    </el-select>
                  </el-form-item>

                </el-form>
              </BaseSearchForm>

              <div class="mb20" style="display: flex; align-items: flex-end">
                <el-button
                  type="warning"
                  :icon="Upload"
                  size="mini"
                  plain
                  @click="handExport"
                  >导出</el-button
                >
              </div>

              <el-table
                v-if="tableShow"
                ref="mainTable"
                v-loading="tableLoading"
                height="calc(100vh - 300px)"
                :data="tableData"
                :span-method="spanMethod"
                border
                :header-row-style="tableRowStyle"
                :cell-style="cellStyle"
                :header-cell-style="headerCellStyle"
              >
                <!-- <el-table-column width="280" :fixed="'left'"
                  >
                </el-table-column> -->
                <el-table-column
                  prop="a"
                  align="center"
                  width="120"
                  :fixed="'left'"
                ></el-table-column>
                <el-table-column
                  prop="b"
                  align="center"
                  min-width="160"
                  :fixed="'left'"
                ></el-table-column>
                <el-table-column
                  label="当前成本"
                  align="center"
                  class-name="first-border-right"
                >
                  <el-table-column
                    v-for="(_item, index) in currentArr"
                    :key="'currentArr' + index"
                    min-width="160"
                    align="center"
                    :prop="`_currentLoop${index}`"
                  >
                    <template #default="scope">
                      <span
                        v-if="scope.row[`_currentLoop${index}`] == '加权'"
                        style="font-weight: bold; color: #000"
                        >加权</span
                      >
                      <span v-else>{{
                        scope.row[`_currentLoop${index}`]
                      }}</span>
                    </template>
                  </el-table-column>
                </el-table-column>
                <el-table-column label="目标成本" align="center">
                  <el-table-column
                    v-for="(_item, index) in targetArr"
                    :key="'targetArr' + index"
                    min-width="160"
                    align="center"
                    :prop="`_targetLoop${index}`"
                  >
                    <template #default="scope">
                      <span
                        v-if="scope.row[`_targetLoop${index}`] == '加权'"
                        style="font-weight: bold; color: #000"
                        >加权</span
                      >
                      <span v-else>{{ scope.row[`_targetLoop${index}`] }}</span>
                    </template>
                  </el-table-column>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, watch, nextTick } from "vue";
import { Search, Upload } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import _ from "lodash";
import { valveOptions } from "@/api/project";
import {
  getCategoryList,
  getProjectName,
  getanalyzeTableData,
} from "@/api/revenue";
import { httpClient } from "@/api/http";
import BaseSearchForm from "@/components/base/BaseSearchForm.vue";

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

async function downloadPost(
  url: string,
  params: Record<string, unknown>,
  fileName: string,
): Promise<void> {
  try {
    const response = await httpClient.post(url, params, {
      responseType: "blob",
    });
    const blob = response.data as Blob;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch {
    BaseToast.error("导出失败，请稍后重试");
  }
}

// ============================================================
// 初始化数据常量
// ============================================================

interface InitalTableRow {
  a: string;
  b: string;
  push?: number;
  [key: string]: unknown;
}

const initalTableData: InitalTableRow[] = [
  {
    a: "",
    b: "车型代号",
  },
  {
    a: "",
    b: "阀点",
  },
  {
    a: "",
    b: "版型",
  },
  {
    a: "成本专业科室",
    b: "",
    push: 1,
  },
  {
    a: "成本二级分类",
    b: "",
    push: 2,
  },
];

// ============================================================
// 响应式状态 (原 data)
// ============================================================

const tableShow = ref(true);
const currentArr = ref<Record<string, unknown>[]>([]);
const targetArr = ref<Record<string, unknown>[]>([]);
const resValveName = ref<string | null>(null);
const bumenList = ref<InitalTableRow[]>([]);
const fenleiList = ref<InitalTableRow[]>([]);
const bumenLength = ref(0);
const fenleiLength = ref(0);

const tableData = ref<InitalTableRow[]>([]);
const tableLoading = ref(false);
const leftSrarchValue = ref("");
const searchForm = ref({
  vehicleModelName: [] as string[][],
  valveId: "",
});
const valueList = ref<{ id: string | number; valveName: string }[]>([]);
const cascaderOptions = ref<Record<string, unknown>[]>([]);
const treeData = ref<Record<string, unknown>[]>([]);
const _assessmentArr = ref<Record<string, unknown>[]>([]);

// ============================================================
// 模板引用 (原 $refs)
// ============================================================

const leftTreeBox = ref<{ filter: (val: string) => void; getCheckedNodes: () => Record<string, unknown>[]; setCheckedKeys: (keys: string[]) => void }>();
const mainTable = ref<{ doLayout: () => void }>();

// ============================================================
// 方法 (原 methods)
// ============================================================

function leftTreefilterNode(val: string, data: Record<string, unknown>): boolean {
  if (!val) return true;
  return (data.name as string).indexOf(val) !== -1;
}

function _findMax(arr: Record<string, unknown>[], key: string): unknown[] {
  let max = 0;
  let cur: unknown[] | null = null;
  arr.forEach((item) => {
    const len = (item[key] as unknown[])?.length ?? 0;
    if (len > max) {
      max = len;
      cur = item[key] as unknown[];
    }
  });
  return cur || [];
}

function doChangeTable(res: Record<string, unknown>[]) {
  const baseData: InitalTableRow[] = _.cloneDeep(initalTableData);
  tableData.value = initalTableData;
  if (res.length) {
    // 按部门数量 追加行数
    bumenLength.value = bumenList.value.length;
    const cur = baseData.findIndex((item) => item.push === 1);
    baseData.splice(cur, 1, ...bumenList.value);
    // end

    // 按分类数量 追加行数
    fenleiLength.value = fenleiList.value.length;
    const cur2 = baseData.findIndex((item) => item.push === 2);
    baseData.splice(cur2, 1, ...fenleiList.value);
    // end

    let currentNum = 0;
    let targetNum = 0;
    res.forEach((item) => {
      if (item.type == "当前成本") {
        currentArr.value.push(item);
        baseData[0]["_currentLoop" + currentNum] = item.projectName; // 车型代号这一行
        baseData[1]["_currentLoop" + currentNum] = resValveName.value; // 版型这一行
        baseData[2]["_currentLoop" + currentNum] = item.projectPatternName; // 版型这一行

        // 组装专业部门的当前成本数据
        if (item.analysisCategoryVoList) {
          (item.analysisCategoryVoList as Record<string, unknown>[])?.forEach((bumenObj) => {
            const findIndex = bumenList.value.findIndex(
              (xxx) => xxx.b == bumenObj.categoryName,
            );
            baseData[3 + findIndex]["_currentLoop" + currentNum] =
              formatPrice(bumenObj.cost as number | string | null);
          });
        } else {
          if (item.projectPatternName == "加权") {
            bumenList.value.forEach((_xxxx, index) => {
              baseData[3 + index]["_currentLoop" + currentNum] =
                formatPrice(item.weight as number | string | null);
            });
          }
        }
        // end

        // 组装成本二级分类的当前成本数据
        if (item.costBomCategoryVoList) {
          (item.costBomCategoryVoList as Record<string, unknown>[])?.forEach((fenleiObj) => {
            const findIndex = fenleiList.value.findIndex(
              (xxx) => xxx.b == fenleiObj.categoryName,
            );
            baseData[3 + findIndex + bumenList.value.length][
              "_currentLoop" + currentNum
            ] = formatPrice(fenleiObj.cost as number | string | null);
          });
        } else {
          if (item.projectPatternName == "加权") {
            fenleiList.value.forEach((_xxxx, index) => {
              baseData[3 + index + bumenList.value.length][
                "_currentLoop" + currentNum
              ] = formatPrice(item.weight as number | string | null);
            });
          }
        }
        // end
        currentNum++;
      }
      if (item.type == "目标成本") {
        targetArr.value.push(item);
        baseData[0]["_targetLoop" + targetNum] = item.projectName; // 车型代号这一行
        baseData[1]["_targetLoop" + targetNum] = resValveName.value; // 版型这一行
        baseData[2]["_targetLoop" + targetNum] = item.projectPatternName; // 版型这一

        // 组装专业部门的目标成本数据
        if (item.analysisCategoryVoList) {
          (item.analysisCategoryVoList as Record<string, unknown>[])?.forEach((bumenObj) => {
            const findIndex = bumenList.value.findIndex(
              (xxx) => xxx.b == bumenObj.categoryName,
            );
            baseData[3 + findIndex]["_targetLoop" + targetNum] =
              formatPrice(bumenObj.cost as number | string | null);
          });
        } else {
          if (item.projectPatternName == "加权") {
            bumenList.value.forEach((_xxxx, index) => {
              baseData[3 + index]["_targetLoop" + targetNum] =
                formatPrice(item.weight as number | string | null);
            });
          }
        }
        // end

        // 组装成本二级分类的目标成本数据
        if (item.costBomCategoryVoList) {
          (item.costBomCategoryVoList as Record<string, unknown>[])?.forEach((fenleiObj) => {
            const findIndex = fenleiList.value.findIndex(
              (xxx) => xxx.b == fenleiObj.categoryName,
            );
            baseData[3 + findIndex + bumenList.value.length][
              "_targetLoop" + targetNum
            ] = formatPrice(fenleiObj.cost as number | string | null);
          });
        } else {
          if (item.projectPatternName == "加权") {
            fenleiList.value.forEach((_xxxx, index) => {
              baseData[3 + index + bumenList.value.length][
                "_targetLoop" + targetNum
              ] = formatPrice(item.weight as number | string | null);
            });
          }
        }
        // end
        targetNum++;
      }
    });

    tableData.value = baseData;
    nextTick(() => {
      mainTable.value?.doLayout();
    });
  }
}

function spanMethod({ row, columnIndex }: { row: InitalTableRow; column: Record<string, unknown>; rowIndex: number; columnIndex: number }) {
  if (columnIndex == 0 && row.a == "成本专业科室") {
    const n = Math.max(bumenLength.value - 1, 1);
    return [n, 1];
  }
  if (columnIndex == 0 && row.a == "成本二级分类") {
    const n = Math.max(fenleiLength.value - 1, 1);
    return [n, 1];
  }
  if (columnIndex == 0 && row.a == "DELETE") {
    return [0, 0];
  }
  return [1, 1];
}

function headerCellStyle({ rowIndex }: { row: Record<string, unknown>; column: Record<string, unknown>; rowIndex: number; columnIndex: number }) {
  if (rowIndex == 0) {
    return {
      fontSize: "16px",
      color: "#000",
    };
  }
}

function cellStyle({ row, column, columnIndex }: { row: InitalTableRow; column: Record<string, unknown>; rowIndex: number; columnIndex: number }) {
  const styles: Record<string, string> = {};
  if (column.property == "b") {
    if (["车型代号", "阀点", "版型", "小计"].includes(row.b)) {
      styles.fontWeight = "bold";
      styles.color = "#000";
    }
  }
  if (columnIndex == 0) {
    styles.fontWeight = "bold";
    styles.color = "#000";
  }
  if (columnIndex == 1) {
    if (row.___color) {
      styles.color = "#000";
    }
  }
  if (column.property == "_currentLoop" + (currentArr.value.length - 1)) {
    styles.borderRightColor = "#999";
  }
  return styles;
}

function tableRowStyle({ rowIndex }: { row: Record<string, unknown>; rowIndex: number }) {
  const styles: Record<string, string> = {};
  if (rowIndex == 1) {
    styles.display = "none";
  }
  return styles;
}

async function getProjectOptions() {
  const res = (await getProjectName()) as any[];
  (cascaderOptions as any).value = res.map((item: Record<string, unknown>) => {
    const cur: Record<string, unknown> = {
      value: item.projectId,
      label: item.projectName,
    };
    if (item.patternList && (item.patternList as unknown[]).length) {
      const children = (item.patternList as Record<string, unknown>[]).map((item2) => {
        return {
          value: item2.id,
          label: item2.patternName,
        };
      });
      cur.children = children;
    }
    return cur;
  });
}

async function getLeftTreedData() {
  const res = await getCategoryList();
  const treeDataVal = [
    {
      id: "-8888",
      name: "成本专业科室",
      children: (() => {
        return ((res as any).department as Record<string, unknown>[]).map((item) => {
          return {
            id: item.id,
            name: item.categoryName,
            level: item.level,
          };
        });
      })(),
    },
    {
      id: "-9999",
      name: "成本二级分类",
      children: (() => {
        return ((res as any).category as Record<string, unknown>[]).map((item) => {
          return {
            id: item.id,
            name: item.categoryName,
            level: item.level,
          };
        });
      })(),
    },
  ];
  treeData.value = treeDataVal;
}

function handExport() {
  const selectTreeData = leftTreeBox.value!.getCheckedNodes();
  if (!selectTreeData.length) {
    BaseToast.warning("请选择左侧部门！");
    return;
  } else if (searchForm.value.vehicleModelName.length == 0) {
    BaseToast.warning("请选择项目名称！");
    return;
  } else if (!searchForm.value.valveId) {
    BaseToast.warning("请选择阀点！");
    return;
  }

  const params: Record<string, unknown> = {};
  const treeFilter = selectTreeData.filter((item: Record<string, unknown>) => {
    return !["-8888", "-9999"].includes(item.id as string);
  });
  params.costBomCategoryList = treeFilter.map((item: Record<string, unknown>) => {
    return { level: item.level, categoryName: item.name };
  });
  params.valveId = searchForm.value.valveId;
  const projectObj: Record<string, Set<string>> = {};
  searchForm.value.vehicleModelName.forEach((item) => {
    const pid = item[0];
    if (!projectObj[pid]) {
      projectObj[pid] = new Set([item[1]]);
    } else {
      projectObj[pid].add(item[1]);
    }
  });
  Object.keys(projectObj).forEach((key) => {
    params.projectPatternVoList = [
      ...(params.projectPatternVoList as Record<string, unknown>[] || []),
      {
        projectId: key,
        patternList: Array.from(projectObj[key]).map((item) => {
          return {
            id: item,
          };
        }),
      },
    ];
  });
  // 调用导出接口
  downloadPost("/system/analysis/export", params, `成本分析导出.xlsx`);
}

function resetForm() {
  searchForm.value = {
    vehicleModelName: [],
    valveId: "",
  };

  leftTreeBox.value!.setCheckedKeys([]);

  tableShow.value = false;

  tableData.value = initalTableData;
  clearInsertData();
  nextTick(() => {
    tableShow.value = true;
  });
}

async function loadValveOptions() {
  const res = await valveOptions();
  const rows = Array.isArray(res) ? res : (res as any)?.data;
  valueList.value = (rows ?? []) as { id: string | number; valveName: string }[];
}

function clearInsertData() {
  bumenList.value = [];
  fenleiList.value = [];
  currentArr.value = [];
  targetArr.value = [];
  resValveName.value = null;
  bumenLength.value = 0;
  fenleiLength.value = 0;
}

function setBumenAndFenlei(treedata: Record<string, unknown>[]) {
  // 部门
  bumenList.value = [];
  fenleiList.value = [];
  currentArr.value = [];
  targetArr.value = [];
  treedata
    .filter((item) => item.level == 2)
    .map((item, index) => {
      bumenList.value.push({
        a: index == 0 ? "成本专业科室" : "DELETE",
        b: item.name as string,
        ___color: true,
      });
    });
  if (bumenList.value.length) {
    bumenList.value.push({
      a: "",
      b: "小计",
    });
  }
  // 分类
  treedata
    .filter((item) => item.level == 3)
    .map((item, index) => {
      fenleiList.value.push({
        a: index == 0 ? "成本二级分类" : "DELETE",
        b: item.name as string,
        ___color: true,
      });
    });
  if (fenleiList.value.length) {
    fenleiList.value.push({
      a: "",
      b: "小计",
    });
  }
}

function getTabledata() {
  // 必填校验
  const selectTreeData = leftTreeBox.value!.getCheckedNodes();
  if (!selectTreeData.length) {
    BaseToast.warning("请选择左侧部门！");
    return;
  } else if (searchForm.value.vehicleModelName.length == 0) {
    BaseToast.warning("请选择项目名称！");
    return;
  } else if (!searchForm.value.valveId) {
    BaseToast.warning("请选择阀点！");
    return;
  }
  const params: Record<string, unknown> = {};
  const treeFilter = selectTreeData.filter((item: Record<string, unknown>) => {
    return !["-8888", "-9999"].includes(item.id as string);
  });
  setBumenAndFenlei(treeFilter);
  params.costBomCategoryList = treeFilter.map((item: Record<string, unknown>) => {
    return { level: item.level, categoryName: item.name };
  });
  params.valveId = searchForm.value.valveId;
  const projectObj: Record<string, Set<string>> = {};
  searchForm.value.vehicleModelName.forEach((item) => {
    const pid = item[0];
    if (!projectObj[pid]) {
      projectObj[pid] = new Set([item[1]]);
    } else {
      projectObj[pid].add(item[1]);
    }
  });
  Object.keys(projectObj).forEach((key) => {
    params.projectPatternVoList = [
      ...(params.projectPatternVoList as Record<string, unknown>[] || []),
      {
        projectId: key,
        patternList: Array.from(projectObj[key]).map((item) => {
          return {
            id: item,
          };
        }),
      },
    ];
  });
  tableLoading.value = true;
  getanalyzeTableData(params)
    .then((res: any) => {
      resValveName.value = valueList.value.find(
        (item) => item.id == searchForm.value.valveId,
      )!.valveName;
      doChangeTable(res as Record<string, unknown>[]);
    })
    .catch(() => {
      tableShow.value = false;
      tableData.value = initalTableData;
      clearInsertData();
      nextTick(() => {
        tableShow.value = true;
      });
    })
    .finally(() => {
      tableLoading.value = false;
    });
}

// ============================================================
// 生命周期 (原 created)
// ============================================================

tableData.value = initalTableData;

loadValveOptions();
getProjectOptions();
getLeftTreedData();

// ============================================================
// 监听 (原 watch)
// ============================================================

watch(leftSrarchValue, (nv) => {
  leftTreeBox.value?.filter(nv);
});

void _assessmentArr.value;
void _findMax;
</script>

<style lang="scss" scoped>
.content-box {
  width: 100%;

  .legacy-splitpanes {
    display: flex;
    width: 100%;
    min-height: calc(100vh - 170px);
  }

  .legacy-pane--sidebar {
    flex: 0 0 16%;
    min-width: 220px;
  }

  .legacy-pane--content {
    flex: 1 1 auto;
    min-width: 0;
  }

  .left {
    height: auto;
    border: solid 1px #dcdfe6;
    border-radius: 6px;
    margin-top: 20px;
    margin-right: 10px;
    padding: 10px;

    .tree-root {
      cursor: pointer;
      line-height: 24px;
      font-size: 13px;
      margin-top: 20px;

      &.cur {
        color: #1890ff;
      }
    }
  }

  .right {
    margin-left: 10px;
  }
}

.right ::v-deep {
  .first-border-right {
    border-right-color: #ddcfcf !important;
  }
}

.left ::v-deep {
  .el-tree-node__label {
    font-size: 13px;
  }

  .el-tree--highlight-current
    .el-tree-node.is-current
    > .el-tree-node__content {
    color: #1890ff;
    background: none;
  }
}
</style>
