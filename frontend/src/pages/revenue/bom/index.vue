<template>
  <PageContainer title="成本 BOM 管理" description="管理成本 BOM 数据，支持导入、导出、删除及过阀锁定等操作">
    <!-- 确认弹窗 -->
    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :loading="confirmState.loading"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
    <!-- 查询条件区域 -->
    <AppSearchBox v-show="showSearch">
      <template #itmes>
        ><el-form :inline="true" :model="searchForm" size="small">
          <el-form-item label="项目名称">
            <el-select
              v-model="selectProjectArr"
              multiple
              filterable
              default-first-option
              placeholder="请输入项目名称"
            >
              <el-option
                v-for="item in projectList"
                :key="item.id"
                :label="(item as any).vehicleModel.modelName"
                :value="(item as any).vehicleModel.modelName"
              >
              </el-option>
            </el-select>

            <!-- <el-input
              v-model="searchForm.vehicleModelName"
              placeholder="请输入项目名称"
              clearable
            >
            </el-input> -->
          </el-form-item>

          <el-form-item label="阀点">
            <el-select
              v-model="searchForm.valveId"
              placeholder="请选择阀点"
              style="width: 100%"
            >
              <el-option
                v-for="item in valueList"
                :key="item.id"
                :value="item.id"
                :label="item.valveName"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="创建时间">
            <el-date-picker
              v-model="createTime"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="yyyy-MM-dd"
              style="width: 100%"
            ></el-date-picker>
          </el-form-item>
        </el-form>
      </template>
      <template #btns>
        <el-button
          type="primary"
          :icon="Search"
          size="mini"
          @click="handQuery"
          >搜索</el-button
        >
        <el-button :icon="Refresh" size="mini" @click="resetForm"
          >重置</el-button
        ></template
      >
    </AppSearchBox>

    <!-- 操作按钮区域 -->
    <div class="mb20">
      <!--      <el-button type="primary" @click.stop="openDrawer('add')">新增</el-button>-->
      <!--      <el-button @click="handleExport" size="mini">下载模板</el-button>-->

      <el-button
        v-hasPermi="['system:version:import']"
        type="success"
        plain
        :icon="Download"
        size="mini"
        @click="addClick('dao')"
        >导入
      </el-button>
      <el-button
        v-hasPermi="['system:bom:export']"
        type="warning"
        plain
        :icon="Upload"
        size="mini"
        @click="handleExport"
        >导出
      </el-button>
      <el-button
        v-hasPermi="['system:version:remove']"
        type="danger"
        plain
        :icon="DeleteIcon"
        size="mini"
        @click="handleDelete"
        >批量删除
      </el-button>
      <el-button
        v-hasPermi="['system:version:download']"
        type="info"
        plain
        :icon="Download"
        size="mini"
        ><a download href="/template/【收益】成本BOM-导入模版.xlsx"
          >模板下载</a
        ></el-button
      >
      <right-toolbar
        v-model:show-search="showSearch"
        @query-table="getList"
      ></right-toolbar>
    </div>
    <!-- 数据表格区域  height="calc(100vh - 280px)"-->
    <el-table
      v-loading="loadingShow"
      :data="tableData"
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="50" align="center">
      </el-table-column>
      <el-table-column label="序号" type="index" width="60" align="center">
      </el-table-column>
      <el-table-column
        prop="vehicleModelName"
        label="项目名称"
        width="150"
        align="center"
      ></el-table-column>
      <el-table-column
        prop="valveName"
        label="阀点"
        width="60"
        align="center"
      ></el-table-column>
      <!-- <el-table-column  label="工厂编号" align="center"></el-table-column> -->
      <el-table-column prop="status" label="过阀状态" align="center">
        <template #default="scope">
          <span v-if="scope.row.status == '0'">
            <el-tag type="info">未过阀</el-tag></span
          >
          <span v-if="scope.row.status == '1'">
            <el-tag type="danger">不允许过阀</el-tag></span
          >
          <span v-if="scope.row.status == '2'">
            <el-tag type="warning">带条件过阀</el-tag></span
          >
          <span v-if="scope.row.status == '3'">
            <el-tag type="success">允许过阀</el-tag>
          </span>
        </template>
      </el-table-column>
      <el-table-column
        prop="valveTime"
        label="过阀时间"
        width="150"
        align="center"
      ></el-table-column>
      <el-table-column
        prop="createBy"
        label="创建人"
        align="center"
      ></el-table-column>
      <el-table-column
        prop="createTime"
        label="创建时间"
        width="150"
        align="center"
      ></el-table-column>
      <el-table-column label="操作" width="200" align="center">
        <template #default="scope">
          <el-button
            v-hasPermi="['system:bom:list']"
            type="text"
            plain
            size="mini"
            :icon="View"
            @click="handleView(scope.row)"
            >查看
          </el-button>
          <!-- <el-button type="text" icon="el-icon-delete" plain size="mini" :disabled="true"
            @click="deleteItem('2', scope.row)">删除
          </el-button> -->
          <el-button
            v-hasPermi="['system:version:isLock:edit']"
            type="text"
            plain
            size="mini"
            :loading="scope.row.loading"
            :disabled="['2', '3'].includes(scope.row.status)"
            :style="
              [0, '0', 'null', null].includes(scope.row.isLock)
                ? ''
                : 'color: #FF9000;background: transparent;'
            "
            :icon="
              [0, '0', 'null', null].includes(scope.row.isLock)
                ? Lock
                : Unlock
            "
            @click="lockClick(scope.row)"
            >{{
              [0, "0", "null", null].includes(scope.row.isLock)
                ? "锁定"
                : "解锁"
            }}
          </el-button>
          <el-dropdown
            v-hasPermi="['system:version:status:edit']"
            trigger="click"
            :disabled="['2', '3'].includes(scope.row.status)"
            @command="(command: any) => changeStatus(scope.row, command)"
          >
            <el-button
              :style="
                ['2', '3'].includes(scope.row.status)
                  ? 'margin-left: 5px;background: transparent;'
                  : ''
              "
              class="promotion-btn"
              type="text"
              :icon="Promotion"
              plain
              size="mini"
              :loading="scope.row.statusLoading"
            >
              过阀<ArrowDown style="margin-left:4px" />
            </el-button>
            <template #dropdown>
<el-dropdown-menu>
              <el-dropdown-item command="3">允许过阀</el-dropdown-item>
              <el-dropdown-item command="2">带条件过阀</el-dropdown-item>
              <el-dropdown-item command="1">不允许过阀</el-dropdown-item>
            </el-dropdown-menu>
</template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      :total="searchForm.total"
      :page="searchForm.pageNum"
      :limit="searchForm.pageSize"
      @pagination="pagination"
    >
    </Pagination>

    <!--    <el-drawer :title="title" :visible.sync="drawer" :direction="direction"-->
    <!--               :before-close="closeDrawer">-->
    <!--      <Add ref="Add" @close="closeChange"></Add>-->
    <!--      <div class="drawer-footer">-->
    <!--        <el-button @click="drawer = false">取消</el-button>-->
    <!--        <el-button type="primary" @click.stop="saveClick">确定</el-button>-->
    <!--      </div>-->
    <!--    </el-drawer>-->

    <el-dialog
      v-model="dialogVisible"
      :title="title"
      width="660px"
      :before-close="handleClose"
      :close-on-click-modal="false"
    >
      <div v-loading="isUploading">
        <el-form :inline="true">
          <el-form-item label="阀点" required :rules="[]">
            <el-select
              v-model="valveIds"
              placeholder="请选择阀点"
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
        <el-upload
          class="upload-demo"
          drag
          action="#"
          multiple
          :http-request="customUpload"
          :auto-upload="false"
          :file-list="fileList"
          :on-remove="handleRemove"
          :on-change="handleFileChange"
          accept=".xlsx"
        >
          <UploadTips></UploadTips>
        </el-upload>
        <div class="boottm-title">
          <div>
            温馨提示： <br />
            1. 请将文件置于第一个sheet，文件不支持多行表头
            <br />
            2. 请不要上传带宏的文件，将导致错误
          </div>
        </div>
      </div>
      <template #footer>
<div>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="isUploading"
          @click="handleConfirmUpload"
          >确定
        </el-button>
      </div>
</template>
    </el-dialog>
    <!--  -->
    <!-- <CheckBom
      v-if="deTailParams"
      :params_="deTailParams"
      @change="deTailParams = null"
    /> -->
  </PageContainer>
</template>
<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, watch, onMounted } from "vue";
import { ElLoading } from "element-plus";
import {
  Search,
  Refresh,
  Upload,
  Download,
  Delete as DeleteIcon,
  View,
  Lock,
  Unlock,
  Promotion,
  ArrowDown,
} from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import {
  bomDelVersion,
  bomImportData,
  bomList,
  versionBom,
  bomDelBom,
} from "@/api/revenue";
import { valveOptions, projectGet } from "@/api/project";
import { httpClient } from "@/api/http";
import UploadTips from "@/components/UploadTips.vue";
// import CheckBom from "./components/checkbom.vue";

function downloadPost(url: string, params: unknown, fileName: string): Promise<void> {
  return httpClient
    .post(url, params, { responseType: "blob" })
    .then((response) => {
      const blob = response.data as Blob;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
    });
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

// 确认弹窗
const {
  confirmState,
  openConfirm,
  resolveConfirm,
  rejectConfirm,
} = useBaseConfirmDialog();

const _deleteLoading = ref(false);
const searchForm = ref<Record<string, unknown>>({
  vehicleModelName: "",
  pageSize: 10,
  total: 0,
  pageNum: 1,
  valveId: "",
});
const showSearch = ref(true);
const _drawer = ref(false);
const _direction = ref("rtl");
const tableData = ref<Record<string, unknown>[]>([{}]);
const loadingShow = ref(false);
const _unfoldShow = ref(true);
const _type = ref("");
const title = ref("");
const tableId = ref<Record<string, unknown>[]>([]);
const createTime = ref<string[]>([]);
const dialogVisible = ref(false);
const valueList = ref<{ id: string | number; valveName: string }[]>([]);
const fileList = ref<Record<string, unknown>[]>([]);
const selectedFiles = ref<File[]>([]);
const valveIds = ref("");
const responseShow = ref(false);
const isUploading = ref(false);
const projectList = ref<Record<string, unknown>[]>([]);
const selectProjectArr = ref<string[]>([]);

watch(selectProjectArr, (nv) => {
  searchForm.value.vehicleModelName = nv.join(",");
});

function getProjectList() {
  projectGet({
    pageSize: 999999,
  }).then((res: any) => {
    console.log(res);
    projectList.value = res.rows;
  });
}

async function handleDelete() {
  try {
    await openConfirm({
      title: "提示",
      message: "是否确认删除数据项？",
      type: "danger",
      confirmText: "确定",
    });
  } catch {
    return;
  }
  const ids = tableId.value.map((item) => item.id);
  const loadingInstance = ElLoading.service({
    fullscreen: true,
    text: "删除中，请稍候...",
  });
  try {
    const res: any = await bomDelBom(ids);
    if (res.code == 200) {
      BaseToast.success("删除成功");
      getList();
    }
  } finally {
    loadingInstance.close();
  }
}

async function changeStatus(row: Record<string, unknown>, status: string) {
  const cur = tableData.value.find((item) => item.id == row.id) as Record<string, unknown>;
  let text;
  switch (parseInt(status)) {
    case 1:
      text = "不允许过阀";
      break;
    case 2:
      text = "带条件过阀";
      break;
    case 3:
      text = "允许过阀";
      break;
  }
  try {
    await openConfirm({
      title: "提示",
      message: `确定将${row.vehicleModelName}（${row.valveName}）设置为 ${text} 吗？`,
      type: "warning",
      confirmText: "确定",
    });
  } catch {
    return;
  }
  cur.statusLoading = true;
  versionBom({
    id: row.id,
    status,
  })
    .then((res: any) => {
      if (res.code == 200) {
        BaseToast.success(`操作成功`);
      }
    })
    .finally(() => {
      getList();
    });
}

async function lockClick(row: Record<string, unknown>) {
  const cur = tableData.value.find((item) => item.id == row.id) as Record<string, unknown>;
  const type_flag = row.isLock == 0 || row.isLock == null;
  const put = {
    id: row.id,
    isLock: type_flag ? 1 : 0,
  };
  try {
    await openConfirm({
      title: "提示",
      message: `确定要${type_flag ? "锁定" : "解锁"} ${row.vehicleModelName}（${
        row.valveName
      }）吗？${type_flag ? "\n锁定后数据不可进行编辑、导入。" : ""}`,
      type: "warning",
      confirmText: "确定",
    });
  } catch {
    return;
  }
  cur.statusLoading = true;
  versionBom(put)
    .then((res: any) => {
      if (res.code == 200) {
        BaseToast.success(`${type_flag ? "锁定" : "解锁"}成功`);
      }
    })
    .finally(() => {
      getList();
    });
}

async function getList() {
  loadingShow.value = true;
  let res: any = await bomList(searchForm.value);
  loadingShow.value = false;
  (tableData as any).value = res.rows;
  (searchForm as any).value.total = res.total;
}

/** 批量删除 */
async function _deleteItem(type_flag: number, row: Record<string, unknown>) {
  if (type_flag == 1 && tableId.value.length == 0) {
    BaseToast.error("请选择要删除的项！");
    return;
  }
  try {
    await openConfirm({
      title: "提示",
      message: "确定要删除该项目吗？",
      type: "warning",
      confirmText: "确定",
    });
  } catch {
    return;
  }
  const res: any = await bomDelVersion(
    type_flag == 1
      ? tableId.value.map((item) => item.id).join(",")
      : (row.id as string)
  );
  if ((res as any).code == 200) {
    BaseToast.success("删除成功");
    searchForm.value.pageNum = 1;
    getList();
  }
}

function handleSelectionChange(e: Record<string, unknown>[]) {
  tableId.value = e;
}

function addClick(_arg0: any) {
  fileList.value = [];
  selectedFiles.value = [];
  title.value = "导入";
  valveIds.value = "";
  responseShow.value = false;
  dialogVisible.value = true;
}

async function loadValveOptions() {
  let res: any = await valveOptions();
  valueList.value = res.data;
}

function handleClose() {
  dialogVisible.value = false;
}

function handleFileChange(_file: Record<string, unknown>, fileListArr: Record<string, unknown>[]) {
  selectedFiles.value = fileListArr.map((item) => item.raw as File);
  fileList.value = fileListArr;
}

function handleRemove(_file: Record<string, unknown>, fileListArr: Record<string, unknown>[]) {
  selectedFiles.value = fileListArr.map((item) => item.raw as File);
  fileList.value = fileListArr;
}

async function handleConfirmUpload() {
  if (!valveIds.value) {
    BaseToast.error("请选择阀点！");
    return;
  }
  if (selectedFiles.value.length === 0) {
    BaseToast.warning("请先选择文件");
    return;
  }

  isUploading.value = true;
  try {
    for (const file of selectedFiles.value) {
      await customUpload({ file });
    }
    if (responseShow.value) {
      BaseToast.success("所有文件上传成功");
    } else {
      return;
    }
    fileList.value = [];
    selectedFiles.value = [];
    dialogVisible.value = false;
    isUploading.value = false;
    searchForm.value.pageNum = 1;
    getList();
    fileList.value = [];
    selectedFiles.value = [];
  } catch (_error) {
    isUploading.value = false;
  } finally {
    isUploading.value = false;
  }
}

async function customUpload(options: { file: File }) {
  const { file } = options;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("valveId", valveIds.value as string);
  try {
    const response = await bomImportData(formData);
    let res2 = JSON.parse(response as string);
    if (res2.code == 200) {
      responseShow.value = true;
    } else {
      responseShow.value = false;
      if (response) {
        let res1 = JSON.parse(response as string);
        (BaseToast as any).error(res1.msg, {
          duration: 18000,
          showClose: true,
        });
        return;
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message && error.message.indexOf("timeout") > -1) {
      BaseToast.success("上传处理中，请稍后查看");
    }
  }
}

function handleView(row: Record<string, unknown>) {
  console.log(row);
  const url = `/bomdetail?bomVersionId=${row.id}&isLatestVersion=1&vehicleModelName=${row.vehicleModelName}&valveName=${row.valveName}&version=${row.version}`;
  window.open(url, "_blank");
  return;
}

/** 导出按钮操作 */
function handleExport() {
  if (tableId.value.length == 0) {
    BaseToast.warning("请选择 1 条要导出的数据！");
    return;
  } else if (tableId.value.length > 1) {
    BaseToast.warning("请选择 1条 数据导出！");
    return;
  }

  let params = [
    {
      vehicleModelId: tableId.value[0].vehicleModelId,
      valveId: tableId.value[0].valveId,
      isLatestVersion: 1,
    },
  ];

  const { vehicleModelName, valveName } = tableId.value[0];
  downloadPost(
    "system/bom/export",
    params,
    `成本BOM-${vehicleModelName}-${valveName}-${parseTime(
      Date.now(),
      "{y}{m}{d}"
    )}.xlsx`
  );
}

function pagination(page: { limit: number; page: number }) {
  searchForm.value.pageSize = page.limit;
  searchForm.value.pageNum = page.page;
  getList();
}

function handQuery() {
  searchForm.value.startTime = createTime.value ? createTime.value[0] : "";
  searchForm.value.endTime = createTime.value ? createTime.value[1] : "";
  searchForm.value.pageNum = 1;
  getList();
}

function resetForm() {
  searchForm.value = {
    vehicleModelName: "",
    valveId: "",
    startTime: "",
    endTime: "",
    pageNum: 1,
    pageSize: 10,
    total: 0,
  };
  createTime.value = [];
  selectProjectArr.value = [];
  getList();
}

onMounted(() => {
  getList();
  loadValveOptions();
  getProjectList();
});

void _deleteLoading.value;
void _drawer.value;
void _direction.value;
void _unfoldShow.value;
void _type.value;
void _deleteItem;
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

  ::v-deep.el-upload {
    width: 100% !important;
  }

  ::v-deep.el-upload-dragger {
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

.el-dropdown {
  margin-left: 10px;
}

.el-dropdown-selfdefine {
  margin-left: 0 !important;
}
</style>
