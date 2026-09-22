<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowDown, Delete, Download, Lock, Unlock, Upload } from "@element-plus/icons-vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import DictTag from "@/components/base/DictTag.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { buildCostBomExportFileName } from "@/utils/cost-bom-export";
import { ApiBusinessError } from "@/api/http";
import {
  createCostBomExport,
  deleteCostBomVersion,
  fetchCostBomVersions,
  importProjectCostBomData,
  updateCostBomVersionGateStatus,
  updateCostBomVersionLockStatus,
} from "@/api/cost-center";
import { fetchBusinessValves, fetchBusinessProjects } from "@/api/project";
import { fetchPlatformDictItemsByType } from "@/api/platform-system";
import type { UploadFile } from "element-plus";
import type { CostBomVersionItem } from "@/types/cost-center";
import type { BusinessProjectItem, BusinessValveItem } from "@/types/project";
import type { SchemaOption } from "@/types/schema-components";

type HistoryStatus = "0" | "1" | "2" | "3";
type PassGateCommand = "allow" | "conditional" | "deny";

const passGateStatusMap: Record<PassGateCommand, "1" | "2" | "3"> = {
  allow: "3",
  conditional: "2",
  deny: "1",
};

const passGateSuccessText: Record<PassGateCommand, string> = {
  allow: "已允许过阀",
  conditional: "已设为带条件过阀",
  deny: "已设为不允许过阀",
};

type CostHistoryQuery = {
  projectId: string;
  projectName: string;
  valveKeyword: string;
  valveStatus: "" | HistoryStatus;
  versionName: string;
  creator: string;
  createdRange: [string, string] | [];
};

type CostHistoryRow = {
  id: number;
  rowKey: string;
  projectId: number;
  versionId?: number | null;
  vehicleModelId?: number | null;
  valveId?: number | null;
  lockVersion: number;
  projectName: string;
  projectCode: string;
  vehicleModel: string;
  valvePoint: string;
  bomVersion: string;
  recordType: string;
  status: HistoryStatus;
  lockStatus: string;
  sourcePurchaseBom: string;
  sourceTask: string;
  valveTime: string;
  createdAt: string;
  updatedAt: string;
  operator: string;
  updater: string;
};

type QueryTableExpose = {
  search: () => void;
  reload: () => void | Promise<void>;
};

const listPagePermissionPrefix = "costmanage:costbom";
const route = useRoute();
const router = useRouter();
const queryTableRef = ref<QueryTableExpose | null>(null);
const defaultProjectId = "";

const query = reactive<CostHistoryQuery>({
  projectId: defaultProjectId,
  projectName: "",
  valveKeyword: "",
  valveStatus: "",
  versionName: "",
  creator: "",
  createdRange: [],
});

const selectedRows = ref<CostHistoryRow[]>([]);
const projectOptions = ref<BusinessProjectItem[]>([]);
const projectOptionsReady = ref(false);
let projectOptionsReadyPromise: Promise<void> | null = null;
const projectLoading = ref(false);
const projectKeyword = ref("");
const importDialogVisible = ref(false);
const importLoading = ref(false);
const latestTaskId = ref<string>();
const latestTaskFileName = ref("");
const importValveId = ref("");
const valveOptions = ref<BusinessValveItem[]>([]);
const valveLoading = ref(false);
const bomGenTypeOptions = ref<SchemaOption[]>([]);
const deleteConfirmVisible = ref(false);
const deleteLoading = ref(false);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const pendingDeleteRow = ref<CostHistoryRow | null>(null);

const selectedCountText = computed(() =>
  selectedRows.value.length > 0 ? `已选择 ${selectedRows.value.length} 项` : "",
);
const pageTitle = computed(() => String(route.meta.title || "成本履历"));

const deleteConfirmMessage = computed(() => {
  if (pendingDeleteRow.value) {
    return `确认删除「${pendingDeleteRow.value.bomVersion}」成本履历？删除后列表不再展示该记录。`;
  }
  return `确认删除已选 ${selectedRows.value.length} 条成本履历？删除后列表不再展示这些记录。`;
});

async function queryCostHistories(pageSize: number, pageNum: number) {
  await ensureProjectOptionsReady();
  const projectId = currentProjectId();
  const page = await fetchCostBomVersions(
    projectId,
    historyGenerateVersionParams(pageNum, pageSize, selectedProject()),
  );
  const project = selectedProject();
  const list = page.versions.map((item) => toCostHistoryRow(item, project));

  return {
    total: page.total ?? 0,
    list,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function historyGenerateVersionParams(
  pageNo: number,
  pageSize: number,
  project?: BusinessProjectItem,
) {
  const [startTime, endTime] = query.createdRange;
  return {
    pageNum: pageNo,
    pageSize,
    vehicleModelId: project?.vehicleModelId || undefined,
    vehicleModelName: query.projectName || undefined,
    valveId: resolveValveId(query.valveKeyword),
    status: query.valveStatus || undefined,
    version: normalizeHistoryVersion(query.versionName),
    createBy: query.creator.trim() || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
  };
}

function normalizeHistoryVersion(version: string) {
  return version.trim().replace(/^V/i, "") || undefined;
}

function resolveValveId(gateCode: string) {
  if (!gateCode) {
    return undefined;
  }
  const numericValveId = Number(gateCode);
  if (Number.isFinite(numericValveId) && numericValveId > 0) {
    return numericValveId;
  }
  return valveOptions.value.find(
    (valve) => valve.valveCode === gateCode || valve.valveName === gateCode,
  )?.valveId;
}

function toCostHistoryRow(
  item: CostBomVersionItem,
  project = projectOptions.value.find(
    (option) => Number(option.vehicleModelId) === Number(item.vehicleModelId),
  ) ?? selectedProject(),
): CostHistoryRow {
  const projectId =
    Number(project?.projectId ?? item.vehicleModelId ?? currentProjectId()) ||
    0;
  return {
    id: item.versionId,
    rowKey: `${projectId}-bom-${item.versionId}`,
    projectId,
    versionId: item.versionId,
    vehicleModelId: item.vehicleModelId ?? null,
    valveId: item.valveId ?? null,
    lockVersion: item.version,
    projectName:
      project?.projectName ||
      item.vehicleModelName ||
      resolveProjectName(project, projectId),
    projectCode: project?.projectCode || String(projectId),
    vehicleModel: item.vehicleModelName || project?.vehicleModelName || "--",
    valvePoint: item.valveName || "",
    bomVersion:
      (item.bomVersion ? `V${item.bomVersion}` : "") ||
      (item.versionNo ? `V${item.versionNo}` : "") ||
      (item.version ? `V${item.version}` : "") ||
      (item.versionId ? `版本 ${item.versionId}` : "--"),
    recordType: item.recordType || "--",
    status: mapHistoryStatus(item.status),
    lockStatus: item.lockStatus || "--",
    sourcePurchaseBom: "--",
    sourceTask: "--",
    valveTime: item.valveTime || "--",
    createdAt: item.submittedAt || "--",
    updatedAt: item.updatedAt || item.submittedAt || "--",
    operator:
      item.submittedByName ||
      (item.submittedBy ? String(item.submittedBy) : "--"),
    updater:
      item.updatedByName || (item.updatedBy ? String(item.updatedBy) : "--"),
  };
}

async function loadProjectOptions(keyword = projectKeyword.value) {
  projectLoading.value = true;
  try {
    const result = await fetchBusinessProjects({
      pageNo: 1,
      pageSize: 200,
      keyword: keyword.trim() || undefined,
      status: "ENABLED",
    });
    projectOptions.value = result.records;
  } finally {
    projectLoading.value = false;
  }
}

async function loadValveOptions() {
  valveLoading.value = true;
  try {
    const page = await fetchBusinessValves({
      pageNo: 1,
      pageSize: 200,
      status: "ENABLED",
    });
    valveOptions.value = page.records;
  } finally {
    valveLoading.value = false;
  }
}

function valveOptionLabel(valve: BusinessValveItem) {
  return valve.valveName || "";
}

async function loadBomGenTypeOptions() {
  const items = await fetchPlatformDictItemsByType("bom_gen_type");
  bomGenTypeOptions.value = items.map((item) => ({
    label: item.label,
    value: item.value,
    cssClass: item.cssClass,
    listClass: item.listClass,
    styleClass: item.listClass,
    raw: item.raw,
  }));
}

function ensureProjectOptionsReady() {
  if (projectOptionsReady.value) {
    return Promise.resolve();
  }
  if (!projectOptionsReadyPromise) {
    projectOptionsReadyPromise = Promise.all([
      loadProjectOptions(),
      loadValveOptions(),
      loadBomGenTypeOptions(),
    ])
      .then(() => {
        projectOptionsReady.value = true;
      })
      .catch((error) => {
        projectOptionsReadyPromise = null;
        throw error;
      });
  }
  return projectOptionsReadyPromise;
}

async function searchProjects(value: string) {
  projectKeyword.value = value;
  await loadProjectOptions(value);
}

function selectedProject() {
  return projectOptions.value.find(
    (project) => project.projectId === currentProjectId(),
  );
}

function currentProjectId() {
  return Number(query.projectId || 0);
}

function resolveProjectName(
  project?: BusinessProjectItem,
  fallbackProjectId?: number | null,
) {
  if (project) {
    return project.projectCode
      ? `${project.projectName}（${project.projectCode}）`
      : project.projectName;
  }
  const projectId = fallbackProjectId ?? currentProjectId();
  return projectId ? `项目 ${projectId}` : "--";
}

function resetQuery() {
  Object.assign(query, {
    projectId: defaultProjectId,
    projectName: "",
    valveKeyword: "",
    valveStatus: "",
    versionName: "",
    creator: "",
    createdRange: [],
  });
}

function searchCostHistories() {
  queryTableRef.value?.search();
}

function refreshCostHistories() {
  void queryTableRef.value?.reload();
}

function handleSelectionChange(rows: CostHistoryRow[]) {
  selectedRows.value = rows;
}

function resetPageStateAndReload() {
  resetQuery();
  selectedRows.value = [];
  pendingDeleteRow.value = null;
  deleteConfirmVisible.value = false;
  if (projectOptionsReady.value) {
    searchCostHistories();
  }
}

function mapHistoryStatus(status?: string | null): HistoryStatus {
  if (status === "1" || status === "2" || status === "3") {
    return status;
  }
  if (status === "REJECTED") {
    return "1";
  }
  if (status === "CONDITIONALLY_PASSED") {
    return "2";
  }
  if (status === "PASSED") {
    return "3";
  }
  return "0";
}

function statusLabel(status: HistoryStatus) {
  const labelMap: Record<HistoryStatus, string> = {
    "0": "未过阀",
    "1": "不允许过阀",
    "2": "带条件过阀",
    "3": "允许过阀",
  };
  return labelMap[status];
}

function statusType(status: HistoryStatus) {
  if (status === "3") {
    return "success";
  }
  if (status === "2") {
    return "warning";
  }
  if (status === "1") {
    return "danger";
  }
  return "info";
}

function resolveRowVersionId(row: CostHistoryRow) {
  return row.versionId || undefined;
}

function resolveHistoryActiveMenu() {
  if (route.path.startsWith("/costmanagementnew/")) {
    return route.path;
  }
  return "/cost/research/history";
}

async function openDetail(row: CostHistoryRow) {
  const versionId = resolveRowVersionId(row);
  if (!row.projectId || !versionId) {
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }
  await router.push({
    path: "/cost/research/history/detail",
    query: {
      projectId: String(row.projectId),
      bomVersionId: String(versionId),
      versionId: String(versionId),
      version: resolveHistoryVersionParam(row),
      vehicleModelId: String(row.vehicleModelId || ""),
      valveId: resolveHistoryValveId(row),
      vehicleModelName: row.vehicleModel || row.projectName || "",
      projectName: row.projectName || "",
      projectCode: row.projectCode || String(row.projectId),
      valveName: row.valvePoint || "",
      lockStatus: row.lockStatus,
      activeMenu: resolveHistoryActiveMenu(),
      returnPath: route.fullPath,
    },
  });
}

async function openVersionHistory(row: CostHistoryRow) {
  const versionId = resolveRowVersionId(row);
  if (!row.projectId || !versionId) {
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }

  await router.push({
    path: "/cost/research/versions",
    query: {
      projectId: String(row.projectId),
      bomVersionId: String(versionId),
      versionId: String(versionId),
      version: resolveHistoryVersionParam(row),
      vehicleModelId: String(row.vehicleModelId || ""),
      valveId: resolveHistoryValveId(row),
      vehicleModelName: row.vehicleModel || row.projectName || "",
      projectName: row.projectName || "",
      projectCode: row.projectCode || String(row.projectId),
      valveName: row.valvePoint || "",
      lockStatus: row.lockStatus,
      activeMenu: resolveHistoryActiveMenu(),
      returnPath: route.fullPath,
    },
  });
}

function resolveHistoryVersionParam(row: CostHistoryRow) {
  return row.bomVersion.replace(/^V/i, "").replace(/^版本\s*/, "") || "";
}

function resolveHistoryValveId(row: CostHistoryRow) {
  if (row.valveId) {
    return String(row.valveId);
  }
  const matchedValve = valveOptions.value.find(
    (valve) =>
      valve.valveName === row.valvePoint || valve.valveCode === row.valvePoint,
  );
  return String(matchedValve?.valveId ?? "");
}

async function handleToggleLock(row: CostHistoryRow) {
  if (isHistoryActionDisabled(row)) {
    return;
  }
  const versionId = resolveRowVersionId(row);
  if (!row.projectId || !versionId) {
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }

  const nextLocked = row.lockStatus !== "LOCKED";
  try {
    await openConfirm({
      title: nextLocked ? "锁定成本履历" : "解锁成本履历",
      message: buildLockConfirmMessage(
        `${row.vehicleModel || row.projectName || "--"}（${
          row.valvePoint || "--"
        }）`,
        nextLocked,
      ),
      type: "warning",
      confirmText: nextLocked ? "锁定" : "解锁",
      cancelText: "取消",
    });
  } catch {
    return;
  }
  const result = await updateCostBomVersionLockStatus(
    row.projectId,
    versionId,
    nextLocked,
  );
  BaseToast.success(`${result.lockStatus === "LOCKED" ? "锁定" : "解锁"}成功`);
  refreshCostHistories();
}

function buildLockConfirmMessage(targetName: string, targetLocked: boolean) {
  return `确定要${targetLocked ? "锁定" : "解锁"} ${targetName}吗？${
    targetLocked ? "锁定后数据不可进行编辑、导入。" : ""
  }`;
}

async function handlePassGate(row: CostHistoryRow, command: PassGateCommand) {
  if (isHistoryActionDisabled(row)) {
    return;
  }
  const versionId = resolveRowVersionId(row);
  if (!row.projectId || !versionId) {
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }

  await updateCostBomVersionGateStatus(
    row.projectId,
    versionId,
    passGateStatusMap[command],
  );
  BaseToast.success(passGateSuccessText[command]);
  refreshCostHistories();
}

function handlePassGateCommand(row: CostHistoryRow, command: unknown) {
  if (command === "allow" || command === "conditional" || command === "deny") {
    void handlePassGate(row, command);
  }
}

function isHistoryActionDisabled(row: CostHistoryRow) {
  return row.status !== "0" && row.status !== "1";
}

async function exportSelectedHistory() {
  const selected = selectedRows.value[0];
  const versionId = selected ? resolveRowVersionId(selected) : undefined;
  if (!selected || !versionId || !selected.vehicleModelId) {
    BaseToast.info("请选择一个车型和版本信息完整的成本履历。");
    return;
  }
  const task = await createCostBomExport(selected.vehicleModelId, {
    versionId,
    versionIds: selectedRows.value
      .map((row) => resolveRowVersionId(row))
      .filter((id): id is number => Boolean(id)),
    format: "xlsx",
  });
  latestTaskId.value = task.taskId;
  latestTaskFileName.value = buildCostBomExportFileName({
    projectName: selected.projectName,
    valveName: selected.valvePoint,
    version: selected.bomVersion,
  });
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

function openImportDialog() {
  importValveId.value = "";
  importDialogVisible.value = true;
}

async function handleImport(file: UploadFile) {
  const rawFile = file.raw;
  if (!rawFile) {
    BaseToast.warning("请选择需要导入的文件。");
    return;
  }
  if (!importValveId.value) {
    BaseToast.warning("请选择阀点后再导入。");
    return;
  }
  importLoading.value = true;
  try {
    const task = await importProjectCostBomData({
      file: rawFile,
      valveId: importValveId.value,
    });
    importDialogVisible.value = false;
    latestTaskId.value = task.taskId;
    latestTaskFileName.value = "";
    BaseToast.success(`导入任务已创建：${task.taskNo || task.taskId}`);
  } catch (unknownError) {
    BaseToast.error(resolveImportErrorMessage(unknownError), 5000);
  } finally {
    importLoading.value = false;
  }
}

function handleTaskUpdate(detail: {
  task: { taskType: string; status: string };
}) {
  if (
    detail.task.taskType === "COST_IMPORT" &&
    detail.task.status === "SUCCEEDED"
  ) {
    refreshCostHistories();
  }
}

function resolveImportErrorMessage(unknownError: unknown) {
  if (unknownError instanceof ApiBusinessError) {
    return unknownError.message;
  }
  if (unknownError instanceof Error) {
    return unknownError.message || "成本履历导入失败，请检查文件或后端服务。";
  }
  return "成本履历导入失败，请检查文件或后端服务。";
}

async function downloadHistoryTemplate() {
  const link = document.createElement("a");
  link.href = "/template/成本BOM-导入模版.xlsx";
  link.download = "成本BOM-导入模版.xlsx";
  link.click();
}

function requestDeleteSelected() {
  if (selectedRows.value.length === 0) {
    BaseToast.warning("请选择需要删除的成本履历。");
    return;
  }
  pendingDeleteRow.value = null;
  deleteConfirmVisible.value = true;
}

async function confirmDelete() {
  const rows = pendingDeleteRow.value
    ? [pendingDeleteRow.value]
    : selectedRows.value;
  if (rows.length === 0) {
    deleteConfirmVisible.value = false;
    return;
  }

  deleteLoading.value = true;
  try {
    await Promise.all(
      rows.map((row) => {
        const versionId = resolveRowVersionId(row);
        if (!versionId) {
          throw new Error("当前成本履历缺少版本信息。");
        }
        return deleteCostBomVersion(row.projectId, versionId, row.lockVersion);
      }),
    );
    BaseToast.success(`已删除 ${rows.length} 条成本履历。`);
    selectedRows.value = [];
    pendingDeleteRow.value = null;
    deleteConfirmVisible.value = false;
    refreshCostHistories();
  } finally {
    deleteLoading.value = false;
  }
}

onMounted(() => {
  void ensureProjectOptionsReady();
});

watch(
  () => route.path,
  () => {
    resetPageStateAndReload();
  },
);
</script>

<template>
  <PageContainer class="cost-history-page" :title="pageTitle">
    <QueryTable
      ref="queryTableRef"
      :func="queryCostHistories"
      row-key="rowKey"
      show-toolbar
      fit-table-height
      :table-props="{
        onSelectionChange: handleSelectionChange,
        scrollbarAlwaysOn: true,
      }"
      empty-title="暂无成本履历"
      empty-description="当前筛选条件下没有可展示的成本履历。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="项目代号">
            <el-select
              v-model="query.projectId"
              clearable
              filterable
              remote
              reserve-keyword
              :remote-method="searchProjects"
              :loading="projectLoading"
              placeholder="请输入项目代号"
              @change="searchCostHistories"
            >
              <el-option
                v-for="project in projectOptions"
                :key="project.projectId"
                :label="
                  project.projectCode
                    ? `${project.projectName}（${project.projectCode}）`
                    : project.projectName
                "
                :value="String(project.projectId)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="阀点">
            <el-select
              v-model="query.valveKeyword"
              clearable
              filterable
              :loading="valveLoading"
              placeholder="请选择阀点"
            >
              <el-option
                v-for="valve in valveOptions"
                :key="String(valve.valveId)"
                :label="valveOptionLabel(valve)"
                :value="String(valve.valveId)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="过阀状态">
            <el-select
              v-model="query.valveStatus"
              clearable
              placeholder="请选择过阀状态"
            >
              <el-option label="未过阀" value="0" />
              <el-option label="不允许过阀" value="1" />
              <el-option label="带条件过阀" value="2" />
              <el-option label="允许过阀" value="3" />
            </el-select>
          </el-form-item>
<!--          <el-form-item label="BOM版本">-->
<!--            <el-input-->
<!--              v-model="query.versionName"-->
<!--              clearable-->
<!--              placeholder="请输入BOM版本"-->
<!--              @keyup.enter="searchCostHistories"-->
<!--            />-->
<!--          </el-form-item>-->
          <el-form-item label="创建人">
            <el-input
              v-model="query.creator"
              clearable
              placeholder="请输入创建人"
              @keyup.enter="searchCostHistories"
            />
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
           permission="costmanage:costbom:import"
          variant="secondary"
          type="success"
          plain
          :icon="Upload"
          @click="openImportDialog"
        >
          导入
        </PermissionButton>
        <PermissionButton
          permission="costmanage:costbom:export"
          variant="secondary"
          type="warning"
          plain
          :icon="Download"
          @click="exportSelectedHistory"
        >
          导出
        </PermissionButton>
        <PermissionButton
            permission="costmanage:costbom:remove"
          variant="danger"
          type="danger"
          plain
          :icon="Delete"
          @click="requestDeleteSelected"
        >
          批量删除
        </PermissionButton>
        <span v-if="selectedCountText" class="cost-history-page__selection">
          {{ selectedCountText }}
        </span>
      </template>

                    <el-table-column
        type="selection"
        width="50"
        fixed="left"
        align="center"
      />
      <el-table-column
        type="index"
        label="序号"
        width="60"
        fixed="left"
        align="center"
      />
      <el-table-column
        prop="vehicleModel"
        label="项目代号"
        width="150"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="bomVersion"
        label="BOM版本"
        width="120"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="recordType"
        label="类型"
        width="120"
        align="center"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <DictTag
            :value="row.recordType"
            :options="bomGenTypeOptions"
            :fallback="row.recordType || '-'"
          />
        </template>
      </el-table-column>
      <el-table-column
        prop="valvePoint"
        label="阀点"
        width="60"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column label="过阀状态" width="120" align="center">
        <template #default="{ row }">
          <BaseStatusTag
            :label="statusLabel(row.status)"
            :type="statusType(row.status)"
          />
        </template>
      </el-table-column>
      <el-table-column label="锁定状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.lockStatus === 'LOCKED' ? 'success' : 'info'" size="small">
            {{ row.lockStatus === "LOCKED" ? "已锁定" : "未锁定" }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="valveTime"
        label="过阀时间"
        width="150"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="operator"
        label="创建人"
        width="120"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="createdAt"
        label="创建时间"
        width="150"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="updater"
        label="更新人"
        width="150"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column
        prop="updatedAt"
        label="更新时间"
        width="150"
        align="center"
        show-overflow-tooltip
      />
      <el-table-column label="操作" width="180" fixed="right" align="center">
        <template #default="{ row }">
          <div class="bq-table-actions">
            <PermissionButton
              permission="costmanage:costbom:show"
              link
              @click="openDetail(row)"
            >
              查看
<!--              -->
            </PermissionButton>
            <el-dropdown
              trigger="click"
              :disabled="isHistoryActionDisabled(row)"
              @command="handlePassGateCommand(row, $event)"
            >
              <span class="cost-history-dropdown-trigger">
                <PermissionButton
                  permission="costmanage:costbom:pass"
                  link
                  :disabled="isHistoryActionDisabled(row)"
                >
                  过阀  costmanage:costbom:pass
                  <el-icon class="cost-history-dropdown-trigger__icon"><ArrowDown /></el-icon>
                </PermissionButton>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="allow">允许过阀</el-dropdown-item>
                  <el-dropdown-item command="conditional"
                    >带条件过阀</el-dropdown-item
                  >
                  <el-dropdown-item command="deny">不允许过阀</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-dropdown trigger="click">
              <el-button link type="primary" class="cost-history-more-trigger">
                更多
                <el-icon class="cost-history-dropdown-trigger__icon"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <PermissionGuard permission="costmanage:costbom:locking">
                    <el-dropdown-item
                      :disabled="isHistoryActionDisabled(row)"
                      :style="{
                        color:
                          row.lockStatus === 'LOCKED'
                            ? 'var(--bq-color-warning)'
                            : undefined,
                      }"
                      @click="handleToggleLock(row)"
                    >
                      <el-icon>
                        <Unlock v-if="row.lockStatus === 'LOCKED'" />
                        <Lock v-else />
                      </el-icon>
                      {{ row.lockStatus === "LOCKED" ? "解锁" : "锁定" }}
                    </el-dropdown-item>
                  </PermissionGuard>
                  <PermissionGuard
                    permission="costmanage:costbom:historical"
                  >
                    <el-dropdown-item @click="openVersionHistory(row)">
                      历史版本
                    </el-dropdown-item>
                  </PermissionGuard>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
    </QueryTable>

    <TaskStatusPanel
      v-if="false"
      :task-id="latestTaskId"
      :download-file-name="latestTaskFileName"
      @update="handleTaskUpdate"
    />

    <BaseImportDialog
      v-model="importDialogVisible"
      module-name="成本履历"
      :loading="importLoading"
      :max-size-mb="20"
      template-text="下载导入模板"
      template-description="请按照成本履历导入模板填写并上传 Excel 文件"
      upload-tip="只能上传 xlsx 格式文件，且不超过 20MB"
      :template-button-props="{
        permission: `${listPagePermissionPrefix}:download`,
      }" 
      @import="handleImport"
      @download-template="downloadHistoryTemplate"
    >
      <el-form label-position="top">
        <el-form-item label="阀点" required>
          <el-select
            v-model="importValveId"
            filterable
            :loading="valveLoading"
            placeholder="请选择阀点"
            style="width: 100%"
          >
            <el-option
              v-for="valve in valveOptions"
              :key="String(valve.valveId)"
              :label="valveOptionLabel(valve)"
              :value="String(valve.valveId)"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </BaseImportDialog>

    <BaseConfirm
      v-model="deleteConfirmVisible"
      title="删除成本履历"
      type="danger"
      confirm-text="确认删除"
      :loading="deleteLoading"
      :message="deleteConfirmMessage"
      :confirm-button-props="{
        permission: `${listPagePermissionPrefix}:remove`,
      }"
      @confirm="confirmDelete"
    />
    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :confirm-button-props="{
        permission: `${listPagePermissionPrefix}:confirm`,
      }"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.cost-history-page :deep(.page-container__body) {
  grid-template-columns: minmax(0, 1fr);
}

.cost-history-page :deep(.base-toolbar) {
  border-top: 0;
}

.cost-history-page :deep(.el-table__cell) {
  white-space: nowrap;
}

.cost-history-page__selection {
  color: var(--bq-color-text-muted);
  font-size: 14px;
  line-height: 24px;
}

.cost-history-dropdown-trigger__icon {
  margin-left: 3px;
  font-size: 12px;
}
</style>
