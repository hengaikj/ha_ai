<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, reactive, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, Refresh, VideoPlay, Edit, Delete } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { useRevenueProjectPermissions } from "@/utils/revenue-permissions";
import {
  listMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  startMeetingReview,
} from "@/api/system/expenses";
import { listUserProjects } from "@/api/system/project";
import { queryRevenueProjectPage } from "@/api/revenue/flow";
import AppSearchBox from "@/components/business/AppSearchBox.vue";
import BasePagination from "@/components/base/BasePagination.vue";

const route = useRoute();
const router = useRouter();
void route;
void router;

// 权限验证
const { currentProject, authChecked } =
  useRevenueProjectPermissions();
void currentProject;

// ============ 确认弹窗 ============
const {
  confirmState: startConfirmState,
  openConfirm: openStartConfirm,
  resolveConfirm: resolveStartConfirm,
  rejectConfirm: rejectStartConfirm,
} = useBaseConfirmDialog();

const {
  confirmState: deleteConfirmState,
  openConfirm: openDeleteConfirm,
  resolveConfirm: resolveDeleteConfirm,
  rejectConfirm: rejectDeleteConfirm,
} = useBaseConfirmDialog();

// ============ 状态 ============
const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const searchKeyword = ref("");
const currentPage = ref(1);
const pageSize = ref(10);

// 项目列表（用于下拉选择）
const projectList = ref<any[]>([]);

// 新建/编辑弹窗
const dialogVisible = ref(false);
const dialogTitle = ref("新建上会");
const editingId = ref<string | null>(null);
const formRef = ref<any>(null);
const formData = reactive({
  projectId: "",
  projectName: "",
  meetingDate: "",
  meetingTime: "",
  meetingMinutesFile: "",
  meetingMinutesFileName: "",
  meetingPlace: "",
  attendees: "",
  meetingAbstract: "",
  meetingConclusion: "",
});

// 开始上会弹窗（S8 项目选择）
const startDialogVisible = ref(false);
const startLoading = ref(false);
const startProjects = ref<any[]>([]);
const startProjectKeyword = ref("");
const startSelectedProjects = ref<any[]>([]);
const startProjectTotal = ref(0);
const startProjectPage = ref(1);
const startProjectPageSize = ref(10);
const currentMeetingRow = ref<any>(null);

// ============ 上会规则（表单校验）============
const rules = reactive({
  projectId: [{ required: true, message: "请选择关联项目", trigger: "change" }],
  meetingDate: [{ required: true, message: "请选择上会日期", trigger: "change" }],
});

// ============ 方法 ============
async function loadProjectList() {
  try {
    const res: any = await listUserProjects({ status: 1 });
    if (res?.rows || res?.data) {
      const list = Array.isArray(res.rows) ? res.rows : res.data?.rows || [];
      projectList.value = list.map((p: any) => ({
        label: p.projectName || p.name || String(p),
        value: p.projectId || p.id || p,
      }));
    }
  } catch {
    // 静默失败
  }
}

async function fetchTableData() {
  loading.value = true;
  try {
    const params: any = {
      pageNum: currentPage.value,
      pageSize: pageSize.value,
    };
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value;
    }
    const res: any = await listMeetings(params);
    if (res?.rows) {
      tableData.value = res.rows;
      total.value = res.total || 0;
    } else if (res?.data?.rows) {
      tableData.value = res.data.rows;
      total.value = res.data.total || 0;
    } else {
      tableData.value = [];
      total.value = 0;
    }
  } catch (error: any) {
    BaseToast.error(error?.msg || error?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  currentPage.value = 1;
  fetchTableData();
}

function handleRefresh() {
  searchKeyword.value = "";
  currentPage.value = 1;
  fetchTableData();
}

function onPageChange(page: number) {
  currentPage.value = page;
  fetchTableData();
}

function onSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
  fetchTableData();
}

function handleAdd() {
  dialogTitle.value = "新建上会";
  editingId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function handleEdit(row: any) {
  dialogTitle.value = "修改上会";
  editingId.value = row.id;
  Object.assign(formData, {
    projectId: row.projectId || "",
    projectName: row.projectName || "",
    meetingDate: row.meetingDate || "",
    meetingTime: row.meetingTime || "",
    meetingMinutesFile: row.meetingMinutesFile || "",
    meetingMinutesFileName: row.meetingMinutesFileName || "",
    meetingPlace: row.meetingPlace || "",
    attendees: row.attendees || "",
    meetingAbstract: row.meetingAbstract || "",
    meetingConclusion: row.meetingConclusion || "",
  });
  dialogVisible.value = true;
}

function resetForm() {
  formData.projectId = "";
  formData.projectName = "";
  formData.meetingDate = "";
  formData.meetingTime = "";
  formData.meetingMinutesFile = "";
  formData.meetingMinutesFileName = "";
  formData.meetingPlace = "";
  formData.attendees = "";
  formData.meetingAbstract = "";
  formData.meetingConclusion = "";
  formRef.value?.resetFields();
}

async function handleSubmitForm() {
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  try {
    const params: any = { ...formData };
    delete params.projectName;

    if (editingId.value) {
      await updateMeeting(editingId.value, params);
      BaseToast.success("修改成功");
    } else {
      await createMeeting(params);
      BaseToast.success("新增成功");
    }
    dialogVisible.value = false;
    fetchTableData();
  } catch (error: any) {
    BaseToast.error(error?.msg || error?.message || "操作失败");
  }
}

// 删除
async function handleDelete(row: any) {
  try {
    await openDeleteConfirm({
      title: "删除确认",
      message: "确认删除该上会信息吗？",
      type: "danger",
      confirmText: "确定",
    });
    await deleteMeeting(row.id);
    BaseToast.success("删除成功");
    fetchTableData();
  } catch {
    // 用户取消
  }
}

// 开始上会
function handleStartMeeting(row: any) {
  currentMeetingRow.value = row;
  startSelectedProjects.value = [];
  startProjectKeyword.value = "";
  startProjectPage.value = 1;
  startDialogVisible.value = true;
  fetchStartProjects();
}

async function fetchStartProjects() {
  startLoading.value = true;
  try {
    const params: any = {
      pageNum: startProjectPage.value,
      pageSize: startProjectPageSize.value,
      node: "S7",
      nodeStatus: "IN_PROGRESS",
      flowType: "NORMAL",
    };
    if (startProjectKeyword.value) {
      params.projectName = startProjectKeyword.value;
    }
    const res: any = await queryRevenueProjectPage(params);
    if (res?.rows) {
      startProjects.value = res.rows;
      startProjectTotal.value = res.total || 0;
    } else if (res?.data?.rows) {
      startProjects.value = res.data.rows;
      startProjectTotal.value = res.data.total || 0;
    } else {
      startProjects.value = [];
      startProjectTotal.value = 0;
    }
  } catch (error: any) {
    BaseToast.error(error?.msg || error?.message || "加载项目列表失败");
  } finally {
    startLoading.value = false;
  }
}

function handleStartProjectSearch() {
  startProjectPage.value = 1;
  fetchStartProjects();
}

function onStartProjectPageChange(page: number) {
  startProjectPage.value = page;
  fetchStartProjects();
}

function onStartProjectSelectionChange(val: any[]) {
  startSelectedProjects.value = val;
}

async function confirmStartMeeting() {
  if (!startSelectedProjects.value.length) {
    BaseToast.warning("请至少选择一个项目");
    return;
  }

  try {
    await openStartConfirm({
      title: "开始上会确认",
      message: "确认开始上会并流转到 S8 上会评审吗？",
      type: "warning",
      confirmText: "确认流转",
    });

    const projectIds = startSelectedProjects.value.map((p: any) => p.projectId || p.id);
    await startMeetingReview(currentMeetingRow.value.id, {
      meetingId: currentMeetingRow.value.id,
      projectIds,
    });
    BaseToast.success("上会已开始");
    startDialogVisible.value = false;
    fetchTableData();
  } catch {
    // 用户取消
  }
}

// 项目选择变化
function onProjectChange(val: string) {
  const p = projectList.value.find((it: any) => it.value === val);
  formData.projectName = p?.label || "";
}

// ============ 初始化 ============
onMounted(() => {
  if (authChecked.value) {
    loadProjectList();
    fetchTableData();
  }
});

watch(authChecked, (val) => {
  if (val) {
    loadProjectList();
    fetchTableData();
  }
});

// ============ 表格列 ============
const columns = [
  { prop: "projectName", label: "关联项目", minWidth: "160" },
  { prop: "meetingDate", label: "上会日期", minWidth: "120" },
  { prop: "meetingPlace", label: "上会地点", minWidth: "140" },
  { prop: "attendees", label: "参会人员", minWidth: "160" },
  { prop: "meetingAbstract", label: "摘要信息", minWidth: "200", showOverflowTooltip: true },
];
</script>

<template>
  <PageContainer title="上会管理" description="管理项目上会信息，支持新增、修改、删除及开始上会操作">
    <!-- 确认弹窗：开始上会 -->
    <BaseConfirm
      v-model="startConfirmState.visible"
      :title="startConfirmState.title"
      :message="startConfirmState.message"
      :type="startConfirmState.type"
      :confirm-text="startConfirmState.confirmText"
      :cancel-text="startConfirmState.cancelText"
      @confirm="resolveStartConfirm"
      @cancel="rejectStartConfirm"
    />

    <!-- 确认弹窗：删除 -->
    <BaseConfirm
      v-model="deleteConfirmState.visible"
      :title="deleteConfirmState.title"
      :message="deleteConfirmState.message"
      :type="deleteConfirmState.type"
      :confirm-text="deleteConfirmState.confirmText"
      :cancel-text="deleteConfirmState.cancelText"
      @confirm="resolveDeleteConfirm"
      @cancel="rejectDeleteConfirm"
    />

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button type="primary" :icon="Plus" @click="handleAdd">新建上会</el-button>
      </div>
      <div class="toolbar-right">
        <AppSearchBox
          v-model="searchKeyword"
          placeholder="搜索上会信息..."
          @search="handleSearch"
        />
        <el-button :icon="Refresh" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <el-table
      v-loading="loading"
      :data="tableData"
      border
      stripe
      style="width: 100%"
      :header-cell-style="{ background: '#f5f7fa', color: '#303133' }"
    >
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :min-width="col.minWidth"
        :show-overflow-tooltip="col.showOverflowTooltip"
      />
      <el-table-column label="操作" width="200" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton type="primary" link :icon="VideoPlay" @click="handleStartMeeting(row)">
            开始上会
          </PermissionButton>
          <PermissionButton type="primary" link :icon="Edit" @click="handleEdit(row)">
            修改
          </PermissionButton>
          <PermissionButton type="danger" link :icon="Delete" @click="handleDelete(row)">
            删除
          </PermissionButton>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <BasePagination
      :total="total"
      :page-size="pageSize"
      :page-no="currentPage"
      @page-change="onPageChange"
      @size-change="onSizeChange"
    />

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
        <el-form-item label="关联项目" prop="projectId">
          <el-select
            v-model="formData.projectId"
            placeholder="请选择关联项目"
            filterable
            style="width: 100%"
            @change="onProjectChange"
          >
            <el-option
              v-for="p in projectList"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="上会日期" prop="meetingDate">
          <el-date-picker
            v-model="formData.meetingDate"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item label="上会地点">
          <el-input v-model="formData.meetingPlace" placeholder="请输入上会地点" />
        </el-form-item>
        <el-form-item label="参会人员">
          <el-input v-model="formData.attendees" placeholder="请输入参会人员" />
        </el-form-item>
        <el-form-item label="摘要信息">
          <el-input
            v-model="formData.meetingAbstract"
            type="textarea"
            :rows="3"
            placeholder="请输入摘要信息"
          />
        </el-form-item>
        <el-form-item label="会议结论">
          <el-input
            v-model="formData.meetingConclusion"
            type="textarea"
            :rows="3"
            placeholder="请输入会议结论"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 开始上会弹窗 -->
    <el-dialog
      v-model="startDialogVisible"
      title="开始上会 - 选择 S7 项目"
      width="800px"
      destroy-on-close
    >
      <div class="start-meeting-toolbar">
        <AppSearchBox
          v-model="startProjectKeyword"
          placeholder="搜索项目..."
          @search="handleStartProjectSearch"
        />
      </div>
      <el-table
        v-loading="startLoading"
        :data="startProjects"
        border
        stripe
        style="width: 100%"
        @selection-change="onStartProjectSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="projectName" label="项目名称" min-width="160" />
        <el-table-column prop="projectCode" label="项目编号" min-width="120" />
        <el-table-column prop="nodeStatus" label="流程状态" min-width="100" />
        <el-table-column prop="projectManager" label="项目经理" min-width="100" />
      </el-table>
      <BasePagination
        :total="startProjectTotal"
        :page-size="startProjectPageSize"
        :page-no="startProjectPage"
        @page-change="onStartProjectPageChange"
      />
      <template #footer>
        <el-button @click="startDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="startLoading" @click="confirmStartMeeting">
          确认流转
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.start-meeting-toolbar {
  margin-bottom: 12px;
}
</style>
