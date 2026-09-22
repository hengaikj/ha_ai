<template>
  <PageContainer title="成本分析" class="cost-analysis-page">
    <div class="app-container">
      <div class="content-box">
        <el-splitter
          class="analysis-splitter"
          :class="{ 'is-left-collapsed': leftPanelCollapsed }"
          @resize-end="handleSplitterResizeEnd"
        >
          <el-splitter-panel v-model:size="leftPanelSize" min="1" max="420">
            <div class="left">
              <el-input
                v-model="leftSrarchValue"
                placeholder="请输入搜索内容"
                :suffix-icon="Search"
                clearable
              ></el-input>
              <div
                class="left-tree-scroll"
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
          </el-splitter-panel>
          <el-splitter-panel min="1">
            <div class="right">
              <BaseSearchForm :loading="tableLoading" @search="getTabledata" @reset="resetForm">
                <el-form :model="searchForm" label-position="left">
                  <el-form-item label="项目代号">
                    <el-cascader
                      v-model="searchForm.vehicleModelName"
                      style="width: 400px"
                      :options="cascaderOptions"
                      :props="{
                        multiple: true,
                        expandTrigger: 'hover',
                      }"
                      filterable
                      :before-filter="filterProjectOptions"
                      placeholder="请选择或搜索项目名称"
                      clearable
                      :show-all-levels="false"
                      collapse-tags
                      :max-collapse-tags="2"
                      @visible-change="handleProjectOptionsVisibleChange"
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

              <BaseToolbar class="analysis-toolbar" :show-refresh="false">
                <el-button
                  :icon="Download"
                  :loading="exportLoading"
                  plain
                  @click="handExport"
                  >导出</el-button
                >
              </BaseToolbar>

              <div class="analysis-table-scroll">
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
          </el-splitter-panel>
        </el-splitter>
      </div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { computed, ref, watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import { Search, Download } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import _ from "lodash";
import { valveOptions } from "@/api/project";
import { createCostBomAnalysisExportTask } from "@/api/cost-center";
import {
  getCategoryList,
  getProjectName,
  getanalyzeTableData,
} from "@/api/revenue";
import BaseSearchForm from "@/components/base/BaseSearchForm.vue";
import BaseToolbar from "@/components/base/BaseToolbar.vue";
import PageContainer from "@/components/layout/PageContainer.vue";

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
const route = useRoute();
const tableLoading = ref(false);
const exportLoading = ref(false);
const leftSrarchValue = ref("");
const leftPanelSize = ref(220);
const leftPanelCollapsed = computed(() => Number(leftPanelSize.value) <= 1);
const searchForm = ref({
  vehicleModelName: [] as string[][],
  valveId: "" as string | number,
});
const valueList = ref<{ id: string | number; valveName: string }[]>([]);
const projectOptions = ref<Record<string, unknown>[]>([]);
const projectSearchKeyword = ref("");
const cascaderOptions = computed(() => {
  const keyword = projectSearchKeyword.value.toLowerCase();
  if (!keyword) return projectOptions.value;
  return projectOptions.value.filter((item) =>
    String(item.label).toLowerCase().includes(keyword),
  );
});
const treeData = ref<Record<string, unknown>[]>([]);
const _assessmentArr = ref<Record<string, unknown>[]>([]);

// ============================================================
// 模板引用 (原 $refs)
// ============================================================

const leftTreeBox = ref<{ filter: (val: string) => void; getCheckedNodes: () => Record<string, unknown>[]; setCheckedKeys: (keys: any[]) => void }>();
const mainTable = ref<{ doLayout: () => void }>();

// ============================================================
// 方法 (原 methods)
// ============================================================

function leftTreefilterNode(val: string, data: Record<string, unknown>): boolean {
  if (!val) return true;
  return (data.name as string).indexOf(val) !== -1;
}

function handleSplitterResizeEnd(_index: number, sizes: number[]) {
  const nextSize = Number(sizes[0] ?? leftPanelSize.value);
  leftPanelSize.value = nextSize <= 8 ? 1 : nextSize;
}

function filterProjectOptions(keyword: string): boolean {
  projectSearchKeyword.value = keyword.trim();
  return false;
}

function handleProjectOptionsVisibleChange(visible: boolean) {
  if (!visible) projectSearchKeyword.value = "";
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
  projectOptions.value = res.map((item: Record<string, unknown>) => {
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

async function handExport() {
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
  const [projectId, versionId] = searchForm.value.vehicleModelName[0];
  exportLoading.value = true;
  try {
    const task = await createCostBomAnalysisExportTask(
      Number(projectId),
      Number(versionId),
      params,
    );
    BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
  } finally {
    exportLoading.value = false;
  }
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
// 生命周期与路由联动
// ============================================================

async function applyRouteParams() {
  const queryModelId = String(
    route.query.vehicleModelId || route.query.projectId || "",
  );
  const queryValveId = route.query.valveId ? String(route.query.valveId) : "";
  const shouldCheckAll =
    route.query.checkAllCategory === "1" ||
    Boolean(queryModelId || queryValveId);

  if (!queryModelId && !queryValveId && !shouldCheckAll) return;

  // 1. 回显阀点
  if (queryValveId) {
    const matchedValve = valueList.value.find(
      (item) => String(item.id) === queryValveId,
    );
    if (matchedValve) {
      searchForm.value.valveId = matchedValve.id;
    } else {
      searchForm.value.valveId = queryValveId;
    }
  }

  // 2. 回显项目代号（使用 vehicleModelId / projectId 自动选中该项目下的全部版型）
  if (queryModelId) {
    const matchedProject = projectOptions.value.find(
      (item) => String(item.value) === queryModelId,
    );
    if (matchedProject) {
      const children = Array.isArray(matchedProject.children)
        ? (matchedProject.children as Record<string, any>[])
        : [];
      if (children.length > 0) {
        searchForm.value.vehicleModelName = children.map((child) => [
          matchedProject.value as string,
          child.value as string,
        ]);
      } else {
        searchForm.value.vehicleModelName = [[matchedProject.value as string]];
      }
    }
  }

  await nextTick();

  // 3. 左侧分类全部勾选（成本专业科室与成本二级分类及其下所有子项全部选中）
  if (shouldCheckAll) {
    const allCategoryKeys = treeData.value.flatMap((item: any) => [
      item.id,
      ...(Array.isArray(item.children)
        ? item.children.map((c: any) => c.id)
        : []),
    ]);

    if (allCategoryKeys.length > 0) {
      leftTreeBox.value?.setCheckedKeys(allCategoryKeys);
    }
  }

  await nextTick();

  // 4. 触发搜索
  if (
    searchForm.value.vehicleModelName.length > 0 &&
    searchForm.value.valveId
  ) {
    getTabledata();
  }
}

async function initPage() {
  tableData.value = initalTableData;
  await Promise.allSettled([
    loadValveOptions(),
    getProjectOptions(),
    getLeftTreedData(),
  ]);
  await applyRouteParams();
}

void initPage();

// ============================================================
// 监听 (原 watch)
// ============================================================

watch(leftSrarchValue, (nv) => {
  leftTreeBox.value?.filter(nv);
});

watch(
  () => [
    route.query.vehicleModelId,
    route.query.projectId,
    route.query.valveId,
    route.query.checkAllCategory,
  ],
  ([newMid, newPid, newVid, newCheck], [oldMid, oldPid, oldVid, oldCheck]) => {
    if (
      (newMid || newPid || newVid || newCheck) &&
      (newMid !== oldMid ||
        newPid !== oldPid ||
        newVid !== oldVid ||
        newCheck !== oldCheck)
    ) {
      void applyRouteParams();
    }
  },
);

void _assessmentArr.value;
void _findMax;
</script>

<style lang="scss" scoped>
.content-box {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;

  .analysis-splitter {
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .analysis-splitter :deep(.el-splitter-panel:first-child) {
    min-width: 0;
    overflow: hidden;
  }

  .analysis-splitter :deep(.el-splitter-bar__dragger) {
    width: 16px !important;
  }

  .analysis-splitter.is-left-collapsed :deep(.el-splitter-bar) {
    z-index: 3;
    width: 12px !important;
  }

  .analysis-splitter.is-left-collapsed .left {
    margin: 0;
    padding: 0;
    border: 0;
    visibility: hidden;
  }

  .left {
    height: auto;
    border: solid 1px #dcdfe6;
    border-radius: 6px;
    margin-top: 20px;
    margin-right: 10px;
    padding: 10px;

    .left-tree-scroll {
      scrollbar-color: transparent transparent;
      scrollbar-width: thin;

      &::-webkit-scrollbar-thumb {
        background-color: transparent;
      }

      &:hover {
        scrollbar-color: var(--bq-scrollbar-thumb) transparent;
      }

      &:hover::-webkit-scrollbar-thumb {
        background-color: var(--bq-scrollbar-thumb);
      }

      &::-webkit-scrollbar-thumb:hover {
        background-color: var(--bq-scrollbar-thumb-hover);
      }
    }

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
    min-width: 0;
    overflow: hidden;
  }

  // .analysis-table-scroll {
  //   width: 100%;
  //   max-width: 100%;
  //   min-width: 0;
  //   overflow-x: auto;
  //   overflow-y: hidden;
  // }

  // .analysis-table-scroll :deep(.el-table) {
  //   min-width: 980px;
  // }
}

// .cost-analysis-page {
//   height: calc(100vh - var(--bq-header-height) - var(--bq-tags-height) - 80px);
//   min-height: 0;
//   min-width: 0;
//   max-width: 100%;
//   overflow: hidden;
// }

.cost-analysis-page :deep(.page-container__body),
.cost-analysis-page :deep(.app-container) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}

.cost-analysis-page :deep(.page-container__body) {
  overflow: hidden;
}

.cost-analysis-page :deep(.el-cascader) {
  width: 560px !important;
  max-width: 100%;
  min-width: 0;
}

.cost-analysis-page :deep(.base-search-form__content .el-form-item:first-child) {
  grid-column: span 2;
}

.cost-analysis-page :deep(.el-cascader .el-input__wrapper) {
  min-height: 32px;
}

.cost-analysis-page :deep(.el-cascader .el-tag) {
  max-width: 130px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .cost-analysis-page :deep(.base-search-form__content .el-form-item:first-child) {
    grid-column: auto;
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
