<template>
  <div class="app-container revenue-project-flow-create rev-impact-theme">
    <div class="rv-page-header">
      <div class="rv-page-header-main">
        <h2 class="rv-page-title">启动阀点流程</h2>
        <p class="rv-page-desc">从项目列表中选择项目，为当前阀点启动收益成本流程。</p>
      </div>
      <el-button size="small" @click="goBack">返回</el-button>
    </div>

    <el-card shadow="never" class="rv-create-card">
      <el-form label-width="100px" size="small" class="rv-create-form">
        <el-form-item label="项目" required>
          <div class="rv-create-project-row">
            <el-input :value="createForm.projectName || ''" disabled placeholder="请选择项目" />
            <el-button size="small" @click="openProjectDialog">选择项目</el-button>
          </div>
        </el-form-item>

        <el-form-item label="项目编号">
          <el-input :value="createForm.projectCode || ''" disabled />
        </el-form-item>

        <el-form-item label="阀点" required>
          <el-select
            v-model="createForm.valvePoint"
            class="rv-create-valve-select"
            clearable
            filterable
            :disabled="valveLoading || !createForm.projectId || !valveOptions.length"
            :loading="valveLoading"
            :placeholder="valveSelectPlaceholder"
          >
            <el-option
              v-for="item in valveOptions"
              :key="item.key"
              :label="item.label"
              :value="item.valvePoint"
            >
              <div class="rv-valve-option">
                <span>{{ item.valvePoint }}</span>
                <small v-if="item.valvePassageTime">{{ item.valvePassageTime }}</small>
              </div>
            </el-option>
          </el-select>
          <div v-if="valveErrorMessage" class="rv-create-error">{{ valveErrorMessage }}</div>
        </el-form-item>

        <el-form-item label="模板" required>
          <el-select
            v-model="createForm.templateId"
            class="rv-create-template-select"
            clearable
            filterable
            :loading="templateLoading"
            :disabled="templateLoading || !templateOptions.length"
            :placeholder="templateSelectPlaceholder"
          >
            <el-option
              v-for="item in templateOptions"
              :key="item.id"
              :label="item.templateLabel"
              :value="item.id"
            >
              <div class="rv-template-option">
                <span class="rv-template-option-name">{{ item.templateName }}</span>
                <small v-if="item.versionLabel" class="rv-template-option-version">
                  版本 {{ item.versionLabel }}
                </small>
              </div>
            </el-option>
          </el-select>
          <div v-if="templateErrorMessage" class="rv-create-error">{{ templateErrorMessage }}</div>
        </el-form-item>

        <el-form-item label="初始节点">
          <el-input value="S1 业务经理填报" disabled />
        </el-form-item>
      </el-form>

      <div class="rv-create-footer">
        <el-button @click="goBack">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">保存</el-button>
      </div>
    </el-card>

    <el-dialog
      v-model="projectDialogVisible"
      title="选择项目"
      width="960px"
      :close-on-click-modal="false"
    >
      <div class="rv-project-dialog-search">
        <el-form :inline="true" :model="projectQuery" size="small" @submit.prevent>
          <el-form-item label="项目搜索">
            <el-input
              v-model="projectQuery.modelName"
              clearable
              placeholder="请输入项目名称/编号/工厂代码"
              @keyup.enter="handleProjectSearch"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleProjectSearch">搜索</el-button>
            <el-button @click="handleProjectReset">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <el-table v-loading="projectLoading" :data="projectRows" row-key="id" @row-dblclick="selectProject">
        <el-table-column label="项目编号" min-width="160" align="center">
          <template #default="{ row }">
            {{ row.projectCode || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="项目名称" min-width="220" align="center">
          <template #default="{ row }">
            {{ row.projectName || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="工厂代码" min-width="140" align="center">
          <template #default="{ row }">
            {{ row.factoryName || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="所属公司" min-width="180" align="center">
          <template #default="{ row }">
            {{ row.company || "-" }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button type="text" size="mini" @click="selectProject(row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>

      <BasePagination
        :page-no="projectQuery.pageNum"
        :page-size="projectQuery.pageSize"
        :total="projectQuery.total"
        @page-change="handleProjectPageChange"
        @size-change="handleProjectSizeChange"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { projectValveList } from "@/api/project";
import {
  listExpenseTemplates,
  listSelectableProjectCostFlowProjects,
} from "@/api/system/expenses";
import { createRevenueProjectFlow } from "@/pages/revenue/project-list/service";
import { useAuthStore } from "@/stores/auth";
import BasePagination from "@/components/base/BasePagination.vue";

const ACTIVE_STATUS = "ACTIVE";
const TEMPLATE_FETCH_PAGE_SIZE = 200;

interface ValveOption {
  key: string;
  id: string;
  valvePoint: string;
  valvePassageTime: string;
  label: string;
}

interface TemplateOption {
  id: string | number;
  templateName: string;
  versionNo: string;
  versionLabel: string;
  templateLabel: string;
  status: string;
}

interface ProjectOption {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  factoryName: string;
  company: string;
  valveOptions: ValveOption[];
  [key: string]: unknown;
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const saving = ref(false);
const valveLoading = ref(false);
const valveErrorMessage = ref("");
const templateLoading = ref(false);
const templateErrorMessage = ref("");
const projectDialogVisible = ref(false);
const projectLoading = ref(false);

const createForm = reactive({
  projectId: "",
  projectCode: "",
  projectName: "",
  valvePoint: "",
  templateId: "" as string | number,
});

const projectQuery = reactive({
  modelName: "",
  pageNum: 1,
  pageSize: 10,
  total: 0,
});

const projectRows = ref<ProjectOption[]>([]);
const valveOptions = ref<ValveOption[]>([]);
const templateOptions = ref<TemplateOption[]>([]);

function safeText(value: unknown, fallback = ""): string {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

const operatorId = computed(() => safeText(authStore.currentUser?.id));
const operatorName = computed(() =>
  safeText(authStore.currentUser?.displayName || authStore.currentUser?.username || operatorId.value),
);

const valveSelectPlaceholder = computed(() => {
  if (!createForm.projectId) return "请先选择项目";
  if (valveLoading.value) return "正在加载阀点";
  if (!valveOptions.value.length) return "该项目未配置阀点";
  return "请选择阀点";
});

const templateSelectPlaceholder = computed(() => {
  if (templateLoading.value) return "正在加载模板";
  if (!templateOptions.value.length) return "暂无可用模板";
  return "请选择模板";
});

function normalizeStatusValue(value: unknown): string {
  const text = safeText(value).toUpperCase();
  return text || ACTIVE_STATUS;
}

function isActiveTemplate(row: TemplateOption): boolean {
  return normalizeStatusValue(row.status) === ACTIVE_STATUS;
}

function formatTemplateVersionLabel(value: unknown): string {
  const text = safeText(value);
  if (!text) return "";
  return /^v/i.test(text) ? text.replace(/^v/i, "V") : `V${text}`;
}

function formatTemplateDisplayName(templateName: string, versionNo: string): string {
  const versionLabel = formatTemplateVersionLabel(versionNo);
  return versionLabel ? `${templateName}（${versionLabel}）` : templateName;
}

function normalizeTemplateOption(row: Record<string, unknown> = {}): TemplateOption | null {
  const id = row.id != null ? row.id : row.templateId;
  const templateName = safeText(row.templateName || row.template_name || row.name);
  const versionNo = safeText(row.versionNo || row.version_no || row.templateVersion || row.version);
  const versionLabel = formatTemplateVersionLabel(versionNo);
  if (id == null || id === "" || !templateName) return null;
  return {
    id: id as string | number,
    templateName,
    versionNo,
    versionLabel,
    templateLabel: formatTemplateDisplayName(templateName, versionNo),
    status: normalizeStatusValue(row.status),
  };
}

function normalizeListRows(payload: unknown, data: unknown, body: Record<string, unknown>): unknown[] {
  if (Array.isArray(body.rows)) return body.rows as unknown[];
  if (Array.isArray(body.list)) return body.list as unknown[];
  if (Array.isArray(body.records)) return body.records as unknown[];
  if (Array.isArray(data)) return data as unknown[];
  if (Array.isArray(payload)) return payload as unknown[];
  return [];
}

function unwrapListPayload(payload: unknown): { rows: unknown[]; total: number; serverPaged: boolean } {
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>).data : undefined;
  const body =
    data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : (payload as Record<string, unknown>);
  const rows = normalizeListRows(payload, data, body);
  const total = Number(body.total || (payload as Record<string, unknown>).total) || rows.length;
  const serverPaged = Boolean(Array.isArray(body.rows) || Number(body.total || (payload as Record<string, unknown>).total) > 0);
  return { rows, total, serverPaged };
}

async function loadTemplateOptions() {
  templateLoading.value = true;
  templateErrorMessage.value = "";
  try {
    const response = await listExpenseTemplates({
      pageNum: 1,
      pageSize: TEMPLATE_FETCH_PAGE_SIZE,
      status: ACTIVE_STATUS,
    });
    const payload = unwrapListPayload(response);
    templateOptions.value = (payload.rows as Record<string, unknown>[])
      .map((item) => normalizeTemplateOption(item))
      .filter((item): item is TemplateOption => Boolean(item && isActiveTemplate(item)));
    templateErrorMessage.value = templateOptions.value.length ? "" : "暂无可用模板";
  } catch (_error) {
    templateOptions.value = [];
    templateErrorMessage.value = "模板加载失败";
    ElMessage.error("模板加载失败，请稍后重试");
  } finally {
    templateLoading.value = false;
  }
}

function normalizeValveOption(item: Record<string, unknown> = {}, index = 0): ValveOption | null {
  const nestedValve = (item.valve as Record<string, unknown>) || {};
  const valvePoint = safeText(
    nestedValve.valveName ||
      item.valveName ||
      item.valvePoint ||
      item.valveCode ||
      nestedValve.valveCode,
  );
  if (!valvePoint) return null;
  const valvePassageTime = safeText(item.valvePassageTime || item.valveTime || item.updateTime);
  const id = safeText(item.valveId || item.projectValveId || item.id || nestedValve.id);
  return {
    key: id || `${valvePoint}_${index}`,
    id,
    valvePoint,
    valvePassageTime,
    label: valvePassageTime ? `${valvePoint}（${valvePassageTime}）` : valvePoint,
  };
}

function normalizeValveOptions(row: Record<string, unknown>): ValveOption[] {
  const sourceList = Array.isArray(row.valveVos)
    ? (row.valveVos as Record<string, unknown>[])
    : Array.isArray(row.valveList)
      ? (row.valveList as Record<string, unknown>[])
      : Array.isArray(row.valves)
        ? (row.valves as Record<string, unknown>[])
        : Array.isArray(row.projectValves)
          ? (row.projectValves as Record<string, unknown>[])
          : Array.isArray(row.valveOptions)
            ? (row.valveOptions as Record<string, unknown>[])
            : [];
  const inlineValvePoint = safeText(row.valvePoint || row.valveName || row.valveCode);
  const list = sourceList.length ? sourceList : inlineValvePoint ? [row] : [];
  const seen: Record<string, boolean> = {};
  return list
    .map((item, index) => normalizeValveOption(item, index))
    .filter((item): item is ValveOption => {
      if (!item || seen[item.valvePoint]) return false;
      seen[item.valvePoint] = true;
      return true;
    });
}

function normalizeProject(row: Record<string, unknown>): ProjectOption {
  const vehicleModel = (row.vehicleModel as Record<string, unknown>) || {};
  const projectId = safeText(row.projectId || row.id);
  const projectCode = safeText(row.projectCode || row.wbsNumber || row.projectNo);
  const projectName = safeText(
    row.projectName || vehicleModel.modelName || row.modelName,
    projectCode || projectId,
  );
  return {
    ...row,
    id: projectId,
    projectId,
    projectCode,
    projectName,
    factoryName: safeText(row.factoryName),
    company: safeText(row.company || vehicleModel.company),
    valveOptions: normalizeValveOptions(row),
  };
}

function filterProjectRows(rows: ProjectOption[]): ProjectOption[] {
  const keyword = safeText(projectQuery.modelName).toLowerCase();
  if (!keyword) return rows;
  return rows.filter((item) => {
    const text = [item.projectCode, item.projectName, item.factoryName, item.company]
      .map((value) => safeText(value).toLowerCase())
      .join("|");
    return text.includes(keyword);
  });
}

function paginateProjectRows(rows: ProjectOption[]): ProjectOption[] {
  const pageNum = Number(projectQuery.pageNum) > 0 ? Number(projectQuery.pageNum) : 1;
  const pageSize = Number(projectQuery.pageSize) > 0 ? Number(projectQuery.pageSize) : 10;
  const start = (pageNum - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

async function loadProjectList() {
  projectLoading.value = true;
  try {
    const response = await listSelectableProjectCostFlowProjects({
      keyword: safeText(projectQuery.modelName) || undefined,
      pageNum: projectQuery.pageNum,
      pageSize: projectQuery.pageSize,
    });
    const payload = unwrapListPayload(response);
    const rows = (payload.rows as Record<string, unknown>[]).map((item) => normalizeProject(item));
    const displayRows = payload.serverPaged ? rows : filterProjectRows(rows);
    projectQuery.total = payload.serverPaged ? payload.total : displayRows.length;
    projectRows.value = payload.serverPaged ? displayRows : paginateProjectRows(displayRows);
  } finally {
    projectLoading.value = false;
  }
}

function openProjectDialog() {
  projectDialogVisible.value = true;
  loadProjectList();
}

function handleProjectSearch() {
  projectQuery.pageNum = 1;
  loadProjectList();
}

function handleProjectReset() {
  projectQuery.modelName = "";
  projectQuery.pageNum = 1;
  loadProjectList();
}

function handleProjectPageChange(page: number) {
  projectQuery.pageNum = page;
  loadProjectList();
}

function handleProjectSizeChange(size: number) {
  projectQuery.pageSize = size;
  projectQuery.pageNum = 1;
  loadProjectList();
}

function normalizeProjectValvePayload(payload: unknown): Record<string, unknown>[] {
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>).data : undefined;
  const body =
    data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : (payload as Record<string, unknown>);
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (Array.isArray(body.rows)) return body.rows as Record<string, unknown>[];
  if (Array.isArray(body.list)) return body.list as Record<string, unknown>[];
  if (Array.isArray(body.records)) return body.records as Record<string, unknown>[];
  if (Array.isArray(body.data)) return body.data as Record<string, unknown>[];
  return [];
}

async function loadProjectValveOptions(projectId: string) {
  valveLoading.value = true;
  try {
    const response = await projectValveList({ projectId });
    const valveRows = normalizeProjectValvePayload(response);
    const options = normalizeValveOptions({ valveList: valveRows });
    valveOptions.value = options;
    valveErrorMessage.value = options.length ? "" : "该项目未配置阀点";
  } catch (_error) {
    valveOptions.value = [];
    valveErrorMessage.value = "项目阀点加载失败";
    ElMessage.error("项目阀点加载失败，请稍后重试");
  } finally {
    valveLoading.value = false;
  }
}

async function selectProject(row: Record<string, unknown>) {
  const normalized = normalizeProject(row);
  createForm.projectId = normalized.projectId;
  createForm.projectCode = normalized.projectCode;
  createForm.projectName = normalized.projectName;
  createForm.valvePoint = "";
  valveOptions.value = [];
  valveErrorMessage.value = "";
  projectDialogVisible.value = false;
  await loadProjectValveOptions(normalized.projectId);
}

function goBack() {
  router.back();
}

function returnToProjectList() {
  const targetPath = safeText(route.query.fromPath, "/revenue/project-list");
  const target = {
    path: targetPath.split("?")[0],
    query: {} as Record<string, string>,
  };
  const queryText = targetPath.split("?")[1];
  if (queryText && typeof URLSearchParams !== "undefined") {
    const searchParams = new URLSearchParams(queryText);
    searchParams.forEach((value, key) => {
      target.query[key] = value;
    });
  }
  router.replace(target);
}

async function submitCreate() {
  if (!safeText(createForm.projectId)) {
    ElMessage.error("请选择项目");
    return;
  }
  if (!valveOptions.value.length) {
    ElMessage.error(valveErrorMessage.value || "该项目未配置阀点");
    return;
  }
  if (!safeText(createForm.valvePoint)) {
    ElMessage.error("请选择阀点");
    return;
  }
  if (!safeText(createForm.templateId)) {
    ElMessage.error("请选择模板");
    return;
  }
  if (!operatorId.value) {
    ElMessage.error("未获取到当前登录用户，请重新登录后重试");
    return;
  }

  saving.value = true;
  try {
    await createRevenueProjectFlow({
      projectId: createForm.projectId,
      projectName: createForm.projectName,
      projectNo: createForm.projectCode,
      valvePoint: createForm.valvePoint,
      templateId: createForm.templateId,
      creatorId: operatorId.value,
      creatorName: operatorName.value,
      node: "S1",
    });
    ElMessage.success("新增流程成功");
    returnToProjectList();
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadTemplateOptions();
});
</script>

<style lang="scss" scoped>
@use "../styles/revenue-visual-spec-g.scss" as *;

.revenue-project-flow-create {
  min-height: calc(100vh - var(--rv-layout-offset, 120px));

  .rv-page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px 16px;

    .rv-page-title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.4;
      color: var(--rv-text);
    }

    .rv-page-desc {
      margin: 4px 0 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--rv-text-4);
    }
  }

  .rv-create-card {
    border: 1px solid var(--rv-line);
    border-radius: 10px;
    background: var(--rv-surface);
    box-shadow: var(--rv-shadow-xs);

    .rv-create-form {
      max-width: 560px;

      .rv-create-project-row {
        display: flex;
        gap: 8px;
        width: 100%;
      }

      .rv-create-valve-select,
      .rv-create-template-select {
        width: 100%;
      }

      .rv-valve-option,
      .rv-template-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;

        small {
          color: var(--rv-text-4);
          white-space: nowrap;
        }
      }

      .rv-template-option-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rv-create-error {
        margin-top: 4px;
        font-size: 12px;
        line-height: 1.4;
        color: var(--rv-danger);
      }
    }

    .rv-create-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid var(--rv-line);
    }
  }

  .rv-project-dialog-search {
    margin-bottom: 12px;
  }

  :deep(.el-form-item__label) {
    font-weight: 700;
    color: var(--rv-text);
    font-size: 13px;
    line-height: 1.6;
  }
}
</style>
