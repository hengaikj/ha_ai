<template>
  <div class="app-container">
    <!-- 查询条件区域 -->
    <AppSearchBox v-show="showSearch">
      <template #itmes>
        <el-form :inline="true" :model="searchForm" size="small">
          <el-form-item label="项目名称">
            <el-input
              v-model="searchForm.vehicleModelName"
              placeholder="请输入项目名称"
              style="width: 100%"
            >
            </el-input>
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
              ></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="createTime"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="选束日期"
              value-format="yyyy-MM-dd"
              style="width: 100%"
            ></el-date-picker>
          </el-form-item> </el-form
      ></template>
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
        >
      </template>
    </AppSearchBox>
    <!-- 操作按钮区域 -->
    <!-- <div class="mb20">
      <el-button
        type="success"
        plain
        :icon="Upload"
        size="mini"
        @click.stop="addClick('dao')"
        v-hasPermi="['system:measure:version:import']"
        >导入
      </el-button>
      <el-button
        type="warning"
        plain
        :icon="Download"
        size="mini"
        @click="handleExport"
        :disabled="isMultipleSelect"
        v-hasPermi="['system:measure:export']"
        >导出
      </el-button>
      <el-button type="danger" plain :icon="Delete" @click="deleteItem('1')" :disabled="true"
        size="mini" v-hasPermi="['system:measure:version:remove']">批量删除</el-button>
      <el-button
        type="info"
        plain
        :icon="Bottom"
        size="mini"
        v-hasPermi="['system:measure:version:download']"
        ><a download href="/template/【收益】收益测算-导入模版.xlsx"
          >模板下载</a
        ></el-button
      >
      <right-toolbar
        v-model:show-search="showSearch"
        @queryTable="getList"
      ></right-toolbar>
    </div> -->
    <!-- 数据表格区域 -->

    <el-table
      v-loading="loadingShow"
      :data="tableData"
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="50" align="center">
      </el-table-column>
      <el-table-column
        label="序号"
        width="60"
        type="index"
        align="center"
      ></el-table-column>
      <el-table-column
        prop="vehicleModelName"
        label="项目名称"
        align="center"
        width="150"
      ></el-table-column>
      <el-table-column
        prop="valveName"
        label="阀点"
        align="center"
        width="60"
      ></el-table-column>
      <el-table-column
        prop="status"
        label="过阀状态"
        align="center"
        width="120"
      >
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
        wdith="160"
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
        wdith="160"
        align="center"
      ></el-table-column>
      <el-table-column label="操作" width="250" fixed="right" align="center">
        <template #default="scope">
          <el-button
            v-hasPermi="['system:measure:list']"
            type="text"
            plain
            size="mini"
            :icon="View"
            @click="lookClick(scope.row)"
            >查看
          </el-button>
          <el-button
            v-hasPermi="['system:measure:version:remove']"
            type="text"
            :icon="Delete"
            plain
            size="mini"
            @click="deleteItem('2', scope.row)"
            >删除
          </el-button>
          <el-button
            v-hasPermi="['system:measure:version:isLock:edit']"
            type="text"
            plain
            size="mini"
            :loading="scope.row.loading"
            :disabled="['2', '3'].includes(scope.row.status)"
            :style="
              [0, '0', 'null', null].includes(scope.row.isLock)
                ? 'color:#1890ff;background: transparent;'
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
            v-hasPermi="['system:measure:version:status:edit']"
            trigger="click"
            :disabled="['2', '3'].includes(scope.row.status)"
            @command="(command: any) => changeStatus(scope.row, command)"
          >
            <el-button
              type="text"
              :icon="Promotion"
              plain
              size="mini"
              :loading="scope.row.statusLoading"
              :disabled="['2', '3'].includes(scope.row.status)"
              :style="
                ['2', '3'].includes(scope.row.status)
                  ? 'margin-left: 5px;background: transparent;'
                  : ''
              "
              class="promotion-btn"
            >
              过阀<el-icon class="el-icon--right"><ArrowDown /></el-icon>
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
      @pagination="paginationChange"
    ></Pagination>

    <el-dialog
      v-model="dialogVisible"
      title="导入"
      :close-on-click-modal="false"
      width="660px"
      :before-close="handleClose"
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
          :on-success="handleSuccess"
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
        <el-button
          type="primary"
          :disabled="isUploading"
          @click="handleConfirmUpload"
          >确定</el-button
        >
        <el-button @click="dialogVisible = false">取消</el-button>
      </template>
    </el-dialog>
    <Look v-if="lookQuery" :query_="lookQuery" @change="lookQuery = null" />
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
  </div>
</template>
<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, onMounted } from "vue";
import { Search, Refresh, Delete, View, Lock, Unlock, Promotion, ArrowDown } from "@element-plus/icons-vue";
import UploadTips from "@/components/UploadTips.vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import Look from "./compoent/look.vue";
import { delVersion, importData, versionId, versionList } from "@/api/revenue";
import { valveOptions } from "@/api/project";
import { httpClient } from "@/api/http";
import { BaseToast } from "@/components/base/BaseToast";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";

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

function download(url: string, params: unknown, fileName: string): Promise<void> {
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

const lookQuery = ref<any>(null);
const searchForm = ref<Record<string, unknown>>({
  vehicleModelName: "",
  valveId: "",
  startTime: "",
  endTime: "",
  pageNum: 1,
  pageSize: 10,
  total: 0,
});
const showSearch = ref(true);
const createTime = ref<string[]>([]);
const dialogVisible = ref(false);
const tableData = ref<Record<string, unknown>[]>([]);
const title = ref("");
const fileList = ref<Record<string, unknown>[]>([]);
const selectedFiles = ref<File[]>([]);
const valueList = ref<{ id: string | number; valveName: string }[]>([]);
const valveIds = ref("");
const tableId = ref<Record<string, unknown>[]>([]);
const isMultipleSelect = ref(false);
const loadingShow = ref(false);
const { openConfirm, confirmState, resolveConfirm, rejectConfirm } = useBaseConfirmDialog();
const isUploading = ref(false);
const responseShow = ref(false);

async function changeStatus(row: Record<string, unknown>, status: string) {
  const cur = tableData.value.find((item) => item.id == row.id) as Record<string, unknown>;
  let text = "";
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
  await openConfirm({
    title: "提示",
    message: `确定将${row.vehicleModelName}（${row.valveName}）设置为 ${text} 吗？`,
    type: "warning",
  });
  cur.statusLoading = true;
  versionId({
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
  await openConfirm({
    title: "提示",
    message: `确定要${type_flag ? "锁定" : "解锁"} ${row.vehicleModelName}（${row.valveName}）吗？${type_flag ? "锁定后数据不可进行编辑、导入。" : ""}`,
    type: "warning",
  });
  cur.loading = true;
  versionId(put)
    .then((res: any) => {
      if (res.code == 200) {
        BaseToast.success(`${type_flag ? "锁定" : "解锁"}成功`);
      }
    })
    .finally(() => {
      getList();
    });
}

function paginationChange(e: { page: number; limit: number }) {
  searchForm.value.pageNum = e.page;
  searchForm.value.pageSize = e.limit;
  getList();
}

async function getList() {
  loadingShow.value = true;
  let res: any = await versionList(searchForm.value);
  loadingShow.value = false;
  (tableData as any).value = res.rows;
  (searchForm as any).value.total = res.total;
}

async function loadValveOptions() {
  let res: any = await valveOptions();
  valueList.value = res.data;
}

function handleSelectionChange(selection: Record<string, unknown>[]) {
  tableId.value = selection;
  isMultipleSelect.value = selection.length > 1;
}

function lookClick(row: Record<string, unknown>) {
  lookQuery.value = {
    measureVersionId: row.id,
    version: row.version,
  };
}

/** 批量删除 */
async function deleteItem(type_flag: number | string, row: Record<string, unknown>) {
  if (type_flag == 1 && tableId.value.length == 0) {
    BaseToast.error("请选择要删除的项！");
    return;
  }
  try {
    await openConfirm({
      title: "提示",
      message: `确定要删除该项目吗？`,
      confirmText: "确定",
      type: "warning",
    });
    let res = await delVersion(
      type_flag == 1
        ? tableId.value.map((item) => item.id).join(",")
        : row.id
    );
    if ((res as any).code == 200) {
      BaseToast.success("删除成功");
      searchForm.value.pageNum = 1;
      getList();
    }
  } catch {
    // 用户取消
  }
}

function handQuery() {
  searchForm.value.startTime = createTime.value ? createTime.value[0] : "";
  searchForm.value.endTime = createTime.value ? createTime.value[1] : "";
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
  getList();
}

/** 导出按钮操作 */
function _handleExport() {
  if (tableId.value.length === 0) {
    BaseToast.warning("请先选择要导出的数据");
    return;
  }
  const { vehicleModelName, valveName } = tableId.value[0];
  const ids = tableId.value.map((item) => item.id).join(",");
  download(
    "/system/measure/export",
    { id: ids },
    `收益测算-${vehicleModelName}-${valveName}-${parseTime(
      Date.now(),
      "{y}{m}{d}"
    )}.xlsx`
  );
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
    searchForm.value.pageNum = 1;
    isUploading.value = false;
    fileList.value = [];
    selectedFiles.value = [];
    getList();
  } catch {
    isUploading.value = false;
  } finally {
    isUploading.value = false;
  }
}

// 1. 自定义上传方法（核心）
async function customUpload(options: { file: File }) {
  const { file } = options;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("valveId", valveIds.value as string);
  try {
    const response = await importData(formData);
    let res2 = JSON.parse(response as string);
    if (res2.code == 200) {
      responseShow.value = true;
    } else {
      responseShow.value = false;
      if (response) {
        let res1 = JSON.parse(response as string);
        BaseToast.error(res1.msg);
        responseShow.value = false;
        return;
      }
    }
  } catch {
    responseShow.value = false;
  }
}

function handleSuccess(e: { code: number; msg: string }) {
  if (e.code == 200) {
    BaseToast.success("文件导入成功！");
  } else {
    BaseToast.error(e.msg);
  }
}

function _addClick(type: string) {
  switch (type) {
    case "dao":
      title.value = "导入";
      fileList.value = [];
      selectedFiles.value = [];
      valveIds.value = "";
      dialogVisible.value = true;
      break;
  }
}

function handleClose() {
  dialogVisible.value = false;
}

onMounted(() => {
  getList();
  loadValveOptions();
});

void _handleExport;
void _addClick;
</script>
<style scoped lang="scss">
.button-box-shou {
  cursor: pointer;
  margin-right: 20px;
}

/* 弹窗底部 */
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

.upload-demo {
  width: 100%;
}

.upload-demo ::v-deep .el-upload {
  width: 100% !important;
}

.upload-demo ::v-deep .el-upload-dragger {
  width: 100% !important;
}

.boottm-title {
  margin-top: 35px;
}

/* 自定义抽屉样式：仅在右侧内容区内全屏 */
.custom-drawer {
  /* 关键：覆盖 Element UI 默认定位，使抽屉相对于 content-area 定位 */
  /*
  position: absolute !important;
  right: 0;
  top: 50px;
  bottom: 0;
  width: 100% !important;
  margin: 0 !important;
  border-radius: 0; 清除圆角 */

  .el-drawer__header {
    margin-bottom: 0 !important;
    padding: 20px 20px 0 20px !important;
  }
}
</style>
