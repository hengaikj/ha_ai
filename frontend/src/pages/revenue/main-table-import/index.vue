<template>
  <div v-if="!hasMainTableShowPermission" class="rv-forbidden">
    <el-empty description="暂无查看主表导入项目列表权限" />
  </div>

  <template v-else>
    <section v-if="pageMode !== 'list'" class="main-crumb">
      首页 / 主表导入 / <b>{{ crumbText }}</b>
    </section>

    <PageContainer v-if="pageMode === 'list'" title="历史项目导入列表">
      <!-- ========== 搜索/筛选 ========== -->
      <el-form :model="searchForm" class="rv-search-form" inline @submit.prevent>
        <el-form-item label="项目搜索">
          <el-input
            v-model="searchForm.keyword"
            placeholder="请输入项目名称/编号/工厂代码"
            clearable
            style="width: 280px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- ========== 表格区 ========== -->
      <div v-loading="listLoading" class="rv-table-section">
        <el-table :data="projectList" border row-key="id">
          <el-table-column label="项目名称" min-width="220">
            <template #default="scope">
              <el-button link type="primary" class="rv-cell-link" @click="openProject(scope.row)">
                {{ getProjectName(scope.row) }}
              </el-button>
            </template>
          </el-table-column>

          <el-table-column label="更新时间" min-width="180">
            <template #default="scope">
              {{ getUpdateTime(scope.row) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="120" align="center" fixed="right">
            <template #default="scope">
              <el-button
                type="success"
                size="small"
                :icon="Download"
                @click="openProject(scope.row)"
              >
                导入
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <BasePagination
          :page-no="searchForm.pageNum"
          :page-size="searchForm.pageSize"
          :total="searchForm.total"
          @page-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </PageContainer>

    <ProjectDetail
      v-else
      :loading="detailLoading"
      :project="detailProject"
      :valve-list="normalizedDetailValveList"
      :view-mode="pageMode"
      :initial-valve-id="routeValveId"
      @back="goList"
      @open-preview="goPreview"
      @open-valve="goValve"
    />
  </template>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, reactive, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Search, Refresh, Download } from '@element-plus/icons-vue';
import { projectGet, projectValveList } from "@/api/project";
import { listSelectableProjectCostFlowProjects } from "@/api/system/expenses";
import { hasPermi } from "@/utils/hasPermi";
import PageContainer from "@/components/layout/PageContainer.vue";
import BasePagination from "@/components/base/BasePagination.vue";
import ProjectDetail from "./detail.vue";

const PAGE_MODES = ["list", "valve", "preview"];
const MAX_REQUEST_PAGE_SIZE = 200;
const MAIN_TABLE_SHOW_PERMISSION = "revenue:main-table:show";

// ===== Plain helpers =====
 
function normalizeProject(row: any = {}) {
  const vehicleModel =
    row.vehicleModel && typeof row.vehicleModel === "object" ? row.vehicleModel : {};
  const projectId = String(row.projectId || row.project_id || row.id || "").trim();
  const projectCode = String(row.projectCode || row.projectNo || row.wbsNumber || "").trim();
  const projectName = String(
    row.projectName ||
      row.modelName ||
      row.vehicleModelName ||
      vehicleModel.modelName ||
      projectCode ||
      projectId ||
      ""
  ).trim();
  const company = String(row.company || vehicleModel.company || "").trim();
  return {
    ...row,
    id: projectId,
    projectId,
    projectCode,
    projectNo: row.projectNo || projectCode,
    wbsNumber: row.wbsNumber || projectCode,
    projectName,
    modelName: row.modelName || projectName,
    company,
    factoryName: row.factoryName || vehicleModel.factoryName || "",
    vehicleModel: {
      ...vehicleModel,
      modelName: vehicleModel.modelName || projectName,
      company,
    },
  };
}

 
function normalizeProjectListPayload(payload: any = {}) {
  const data = payload && payload.data;
  const body = data && typeof data === "object" && !Array.isArray(data) ? data : payload;
  const rows = Array.isArray(body.rows)
    ? body.rows
    : Array.isArray(body.list)
      ? body.list
      : Array.isArray(body.records)
        ? body.records
        : Array.isArray(data)
          ? data
          : Array.isArray(payload)
            ? payload
            : [];
  return {
    rows,
    total: Number(body.total || payload.total) || rows.length,
    serverPaged: Boolean(Array.isArray(body.rows) || Number(body.total || payload.total) > 0),
  };
}

/** 兼容 http 解包与若依信封两种返回结构 */
function normalizeApiRows(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const body = payload as Record<string, unknown>;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.rows)) return body.rows;
  if (Array.isArray(body.records)) return body.records;
  const nested = body.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedBody = nested as Record<string, unknown>;
    if (Array.isArray(nestedBody.rows)) return nestedBody.rows;
    if (Array.isArray(nestedBody.records)) return nestedBody.records;
  }
  return [];
}

 
async function enrichProjectRowsWithSystemMeta(rows: any[]): Promise<any[]> {
  if (!Array.isArray(rows) || !rows.length) return rows;
  try {
    const projectRes = await projectGet({
      pageNum: 1,
      pageSize: MAX_REQUEST_PAGE_SIZE,
    });
    const { rows: systemRows } = normalizeProjectListPayload(projectRes);
    const metaById: Record<string, Record<string, unknown>> = {};
    (systemRows || []).forEach((item: any) => {
      const id = String(item.id || item.projectId || "").trim();
      if (id) metaById[id] = item;
    });
    return rows.map((row) => {
      const meta = metaById[String(row.projectId || row.id || "").trim()] || {};
      return normalizeProject({
        ...row,
        updateTime:
          row.updateTime ||
          row.updatedAt ||
          row.updated_at ||
          meta.updateTime ||
          meta.updatedAt ||
          meta.updated_at,
        createTime:
          row.createTime ||
          row.createdAt ||
          row.created_at ||
          meta.createTime ||
          meta.createdAt ||
          meta.created_at,
      });
    });
  } catch {
    return rows;
  }
}

function normalizeValve(item: any, index: number) {
  const id = String(item.valveId || item.projectValveId || item.id || `valve-${index}`);
  return {
    ...item,
    id,
    valveName: String(item.valveName || item.valvePoint || item.valveCode || "-").trim(),
    valvePoint: String(item.valveName || item.valvePoint || "").trim(),
    valvePassageTime:
      item.valvePassageTime || item.valveTime || item.updateTime || item.createTime || "-",
    valveStatus: item.valveStatus != null ? String(item.valveStatus) : "",
  };
}

// ===== Router =====
const route = useRoute();
const router = useRouter();

// ===== Reactive state =====
const listLoading = ref(false);
const detailLoading = ref(false);
 
const projectList = ref<any[]>([]);
 
const detailProject = ref<any>({});
 
const detailValveList = ref<any[]>([]);
const searchForm = reactive({
  keyword: "",
  pageNum: 1,
  pageSize: 10,
  total: 0,
});

// ===== Computed =====
const routeProjectId = computed(() => {
  return route.query.projectId || "";
});

const routeValveId = computed(() => {
  return route.query.valveId ? String(route.query.valveId) : "";
});

const pageMode = computed(() => {
  const page = String(route.query.page || "").trim();
  if (PAGE_MODES.includes(page)) {
    return page;
  }
  if (routeProjectId.value) {
    return "valve";
  }
  return "list";
});

const routeQueryKey = computed(() => {
  return [route.query.page || "", routeProjectId.value, routeValveId.value].join("::");
});

const hasMainTableShowPermission = computed(() => {
  return hasPermi(MAIN_TABLE_SHOW_PERMISSION);
});

const normalizedDetailValveList = computed(() => {
  return (detailValveList.value || []).map((item, index) => normalizeValve(item, index));
});

const crumbText = computed(() => {
  const map: Record<string, string> = {
    list: "历史项目导入列表",
    valve: "阀点详情",
    preview: "导入预览",
  };
  return map[pageMode.value] || "主表导入";
});

// ===== Watch =====
watch(routeQueryKey, () => {
  handleRouteChange();
}, { immediate: true });

// ===== Methods =====
async function handleRouteChange(): Promise<void> {
  if (!hasMainTableShowPermission.value) {
    projectList.value = [];
    detailProject.value = {};
    detailValveList.value = [];
    searchForm.total = 0;
    return;
  }
  if (!routeProjectId.value) {
    detailProject.value = {};
    detailValveList.value = [];
    getList();
    return;
  }

  await loadDetail(routeProjectId.value as string);

  if (String(route.query.page || "").trim() === "project") {
    updateQuery(
      {
        page: "valve",
        projectId: routeProjectId.value as string,
        valveId: routeValveId.value || getDefaultValveId(normalizedDetailValveList.value),
      },
      true
    );
    return;
  }

  if ((pageMode.value === "valve" || pageMode.value === "preview") && !routeValveId.value) {
    const defaultValveId = getDefaultValveId(normalizedDetailValveList.value);
    if (defaultValveId) {
      updateQuery(
        {
          page: pageMode.value,
          projectId: routeProjectId.value as string,
          valveId: defaultValveId,
        },
        true
      );
    }
  }
}

async function getList(): Promise<void> {
  if (!hasMainTableShowPermission.value) {
    projectList.value = [];
    searchForm.total = 0;
    return;
  }
  listLoading.value = true;
  try {
    const res = await listSelectableProjectCostFlowProjects({
      keyword: searchForm.keyword,
      pageNum: searchForm.pageNum,
      pageSize: searchForm.pageSize,
    });
    const payload = normalizeProjectListPayload(res);
    const rows = payload.rows.map(normalizeProject);
    projectList.value = await enrichProjectRowsWithSystemMeta(rows);
    searchForm.total = payload.total;
  } finally {
    listLoading.value = false;
  }
}

async function resolveDetailProject(projectId: string, projectRows: any[]): Promise<any> {
  const listProject = projectList.value.find((item) => {
    return (
      String(item.projectId || "") === String(projectId) ||
      String(item.id || "") === String(projectId)
    );
  });
  let current =
    projectRows.find((item: any) => String(item.id) === String(projectId)) ||
    projectRows.find((item: any) => String(item.projectId) === String(projectId)) ||
    listProject ||
    null;

  if (!current || (!current.projectId && !current.id)) {
    try {
      const res = await listSelectableProjectCostFlowProjects({
        pageNum: 1,
        pageSize: MAX_REQUEST_PAGE_SIZE,
      });
      const { rows } = normalizeProjectListPayload(res);
      current =
        rows.find(
          (item: any) => String(item.projectId || item.id) === String(projectId)
        ) || current;
    } catch {
      // 可选项目列表仅用于补全项目元数据，失败时仍保留路由中的项目 ID。
    }
  }

  return normalizeProject({
    id: projectId,
    projectId,
    ...(current || {}),
  });
}

async function loadDetail(projectId: string): Promise<void> {
  if (!hasMainTableShowPermission.value) {
    detailProject.value = {};
    detailValveList.value = [];
    return;
  }
  detailLoading.value = true;
  try {
    const [projectRes, valveRes] = await Promise.all([
      projectGet({
        id: projectId,
        pageNum: 1,
        pageSize: MAX_REQUEST_PAGE_SIZE,
      }).catch(() => ({ rows: [] })),
      projectValveList({
        projectId,
      }).catch(() => []),
    ]);

    const projectPayload = normalizeProjectListPayload(projectRes);
    const projectRows = projectPayload.rows.map(normalizeProject);
    const currentProject = await resolveDetailProject(projectId, projectRows);

    detailProject.value = currentProject;
    const valves = normalizeApiRows(valveRes);
    detailValveList.value = valves.length
      ? valves
      : normalizeApiRows((currentProject as any).valveList);
  } finally {
    detailLoading.value = false;
  }
}

function handleSearch(): void {
  searchForm.pageNum = 1;
  getList();
}

function handleReset(): void {
  Object.assign(searchForm, {
    keyword: "",
    pageNum: 1,
    pageSize: 10,
    total: 0,
  });
  getList();
}

function handlePageChange(pageNo: number): void {
  searchForm.pageNum = pageNo;
  getList();
}

function handleSizeChange(pageSize: number): void {
  searchForm.pageSize = pageSize;
  searchForm.pageNum = 1;
  getList();
}

function updateQuery(query: Record<string, unknown>, replace = false): void {
  const normalizedQuery: Record<string, string> = {};
  Object.keys(query || {}).forEach((key) => {
    const value = query[key];
    if (value !== "" && value !== undefined && value !== null) {
      normalizedQuery[key] = String(value);
    }
  });

  const location = {
    path: route.path,
    query: normalizedQuery,
  };
  if (replace) {
    router.replace(location);
  } else {
    router.push(location);
  }
}

 
function openProject(row: any): void {
  const projectId = row.projectId || row.id;
  if (!projectId) {
    return;
  }
  updateQuery({
    page: "valve",
    projectId,
  });
}

 
function getProjectName(row: any): string {
  return row.projectName || row.modelName || (row.vehicleModel && row.vehicleModel.modelName) || "-";
}

 
function getUpdateTime(row: any): string {
  return (
    row.updateTime ||
    row.updatedAt ||
    row.updated_at ||
    row.lastUpdateTime ||
    row.createTime ||
    row.createdAt ||
    row.created_at ||
    "-"
  );
}

 
function getDefaultValveId(valveList: any[]): string {
  const list = valveList || [];
  if (!list.length) {
    return "";
  }
  const preferred = list.find((item) => {
    const valvePoint = String(item.valvePoint || "").toUpperCase();
    const valveName = String(item.valveName || "").toUpperCase();
    return valvePoint === "G8" || valveName === "G8";
  });
  return String((preferred || list[0]).id || "");
}

function goPreview(payload: { valveId?: string } = {}): void {
  const valveId = payload.valveId || routeValveId.value || getDefaultValveId(normalizedDetailValveList.value);
  updateQuery({
    page: "preview",
    projectId: routeProjectId.value as string,
    valveId,
  });
}

function goValve(payload: { valveId?: string } = {}): void {
  const valveId = payload.valveId || routeValveId.value || getDefaultValveId(normalizedDetailValveList.value);
  updateQuery({
    page: "valve",
    projectId: routeProjectId.value as string,
    valveId,
  });
}

function goList(): void {
  updateQuery({}, false);
}
</script>

<style scoped lang="scss">
// ========== 权限拦截 ==========
.rv-forbidden {
  padding: 40px 0;
  text-align: center;
}

// ========== 面包屑（非列表视图） ==========
.main-crumb {
  background: var(--bq-color-bg-container);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--bq-color-text-secondary);

  b {
    color: var(--bq-color-text-primary);
  }
}

// ========== 搜索表单 ==========
.rv-search-form {
  margin-bottom: 0;

  :deep(.el-form-item) {
    margin-bottom: 8px;
  }

  :deep(.el-form-item__label) {
    color: var(--bq-color-text-secondary);
    font-weight: 500;
  }
}

// ========== 表格区域 ==========
.rv-table-section {
  :deep(.el-table) {
    --el-table-border-color: var(--bq-color-border-subtle);
    --el-table-header-bg-color: var(--bq-color-table-header);
    --el-table-row-hover-bg-color: var(--bq-color-bg-hover);
    font-size: 14px;
  }

  :deep(.el-table th) {
    font-weight: 600;
    color: var(--bq-color-text-secondary);
    height: 42px;
  }

  :deep(.el-table th .cell) {
    font-weight: 600;
  }
}

// ========== 链接按钮 ==========
.rv-cell-link {
  padding: 0;
  font-weight: 500;
}
</style>
