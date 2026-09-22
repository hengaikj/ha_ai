<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  CircleCheck,
  CirclePlus,
  CopyDocument,
  Delete,
  Download,
  Minus,
  Operation,
  Plus,
  RefreshRight,
  Search,
  Upload,
} from "@element-plus/icons-vue";
import {
  copyCostBomValveData,
  createCostBomAnalysisExportTask,
  createCostBomExport,
  createCostBomExtendCalculationTask,
  createCostBomPriceRefreshTask,
  createSyncBomQueryExportTask,
  deleteCostBomPart,
  deleteCostBomVersion,
  fetchBomQueryPageList,
  fetchBomQueryProjects,
  fetchCostBomAnalysisCategories,
  fetchCostBomCategories,
  fetchCostBomDashboardPatternDetails,
  fetchCostBomDashboardPatternSummaries,
  fetchCostBomGenerateVersions,
  fetchCostBomParts,
  fetchCostBomVersions,
  importProjectCostBomData,
  recalculateCostBomVersion,
  saveCostBomParts,
  submitCostBomVersion,
  updateCostBomVersionLockStatus,
  useCostBomVersion,
} from "@/api/cost-center";
import { fetchBusinessProjects, fetchBusinessValves } from "@/api/project";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { downloadLocalTemplate } from "@/utils/download-template";
import { useAuthStore } from "@/stores/auth";
import type { UploadFile } from "element-plus";
import type {
  CostBomAnalysisCategoryItem,
  CostBomCategoryItem,
  CostBomDashboardPatternDetail,
  CostBomDashboardPatternSummary,
  CostBomGenerateVersionItem,
  BomQueryItem,
  CostBomPartItem,
  CostBomPartSaveItem,
  CostBomVersionItem,
  SupplyRatioPart,
} from "@/types/cost-center";
import type { BusinessProjectItem, BusinessValveItem } from "@/types/project";

type WorkbenchType = "research-history" | "cost-analysis" | "bom-query";

type DetailLogic = "AND" | "OR";
type DetailOperator = "eq" | "gt" | "gte" | "lt" | "lte" | "isNull" | "isNotNull" | "like";
const nullOperators = new Set<DetailOperator>(["isNull", "isNotNull"]);
type PartEditMode = "add" | "edit" | "copy";

type CostWorkbenchRow = {
  id: number | string;
  rowKey: string;
  projectId?: number | null;
  versionId?: number | null;
  lockVersion?: number | null;
  rowType: "VERSION" | "PART" | "ANALYSIS" | "GENERATED" | "BOM_QUERY";
  projectName: string;
  projectCode: string;
  vehicleModel: string;
  valvePoint: string;
  bomVersion: string;
  partNo: string;
  partName: string;
  supplierName: string;
  vehicleReorganizeCode?: string | null;
  vehicleReorganizeName?: string | null;
  firstVehicleModel?: string | null;
  sorName?: string | null;
  expertEngineer?: string | null;
  suggestedSupplySource?: string | null;
  developmentDepartment?: string | null;
  generalizationLevel?: string | null;
  architectureComponent?: string | null;
  ecrNumber?: string | null;
  ecnProcessNum?: string | null;
  costAmount: number;
  reductionAmount: number;
  reductionRate: number;
  quantity?: string | null;
  unit?: string | null;
  targetCostAmount?: string | null;
  estimatedCostAmount?: string | null;
  currentCostAmount?: string | null;
  costCategoryLevel2Code?: string | null;
  costCategoryLevel2Name?: string | null;
  costCategoryLevel3Code?: string | null;
  costCategoryLevel3Name?: string | null;
  partCategory?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  status:
    | "PENDING"
    | "RUNNING"
    | "COMPLETED"
    | "FAILED"
    | "LOCKED"
    | "DRAFT"
    | "GENERATED"
    | "PASSED"
    | "CONDITIONALLY_PASSED"
    | "REJECTED";
  updatedAt: string;
  operator: string;
};

type AnalysisReportColumn = {
  key: string;
  group: "current" | "target";
  label: string;
  vehicleModelName: string;
  patternName: string;
};

type AnalysisReportRow = {
  groupName: string;
  categoryName: string;
  rowType: "MODEL" | "VALVE" | "PATTERN" | "CATEGORY";
  values: Record<string, string>;
};

type AnalysisCategoryTreeNode = {
  id: string;
  label: string;
  categoryId?: number;
  categoryLevel?: number;
  categoryName?: string;
  children?: AnalysisCategoryTreeNode[];
};

type WorkbenchConfig = {
  title: string;
  description: string;
  permissionPrefix: string;
  emptyTitle: string;
  emptyDescription: string;
  showImport?: boolean;
  showSync?: boolean;
  columns: Array<keyof CostWorkbenchRow>;
};

type QueryTableExpose = {
  search: () => void;
  reload: () => Promise<void>;
};

const route = useRoute();
const router = useRouter();
const queryTableRef = ref<QueryTableExpose | null>(null);
const importDialogVisible = ref(false);
const importLoading = ref(false);
const importProjectId = ref<number | null>(null);
const detailVisible = ref(false);
const versionHistoryVisible = ref(false);
const partEditorVisible = ref(false);
const partHistoryVisible = ref(false);
const deleteConfirmVisible = ref(false);
const copyValveVisible = ref(false);
const supplyRatioVisible = ref(false);
const activeRow = ref<CostWorkbenchRow | null>(null);
const pendingDeleteRow = ref<CostWorkbenchRow | null>(null);
const selectedRows = ref<CostWorkbenchRow[]>([]);
const bomQueryFilterFieldSet = ref<Set<string>>(new Set());
const selectedProjectIds = ref<Array<number | string>>([]);
const supplyRatioDetail = ref<SupplyRatioPart | null>(null);
const dashboardPatternSummaries = ref<CostBomDashboardPatternSummary[]>([]);
const dashboardPatternDetails = ref<CostBomDashboardPatternDetail[]>([]);
const detailParts = ref<CostBomPartItem[]>([]);
const detailSelectedParts = ref<CostBomPartItem[]>([]);
const versionHistoryRows = ref<CostBomVersionItem[]>([]);
const selectedHistoryVersions = ref<CostBomVersionItem[]>([]);
const versionCompareVisible = ref(false);
const versionCompareRows = ref<Array<Record<string, string>>>([]);
const partEditMode = ref<PartEditMode>("add");
const activePart = ref<CostBomPartItem | null>(null);
const projectOptions = ref<BusinessProjectItem[]>([]);
const projectLoading = ref(false);
const projectKeyword = ref("");
const valveOptions = ref<BusinessValveItem[]>([]);
const valveLoading = ref(false);
const analysisLoading = ref(false);
const analysisReportColumns = ref<AnalysisReportColumn[]>([]);
const analysisReportRows = ref<AnalysisReportRow[]>([]);
const analysisCategoryTreeRef = ref();
const analysisCategoryKeyword = ref("");
const analysisCategoryTree = ref<AnalysisCategoryTreeNode[]>([]);
const selectedAnalysisCategoryIds = ref<string[]>([]);
const latestTaskId = ref<string>();
const latestTaskFileName = ref("");
const authStore = useAuthStore();
const copyValveForm = reactive({
  sourceValveId: "",
  targetValveId: "",
});
const detailConditions = ref([
  {
    logic: "AND" as DetailLogic,
    moduleName: "",
    attributeName: "partNo",
    operator: "" as DetailOperator,
    value: "",
  },
]);
const partForm = reactive<CostBomPartSaveItem>({
  partNo: "",
  partName: "",
  moduleIdentifier: "",
  supplierName: "",
  quantity: "",
  unit: "",
  targetCostAmount: "",
  estimatedCostAmount: "",
  currentCostAmount: "",
  costCategoryLevel2Name: "",
  costCategoryLevel3Name: "",
  generalizationLevel: "",
  architectureComponent: "",
  summaryRemark: "",
});
const query = reactive({
  projectId: "",
  keyword: "",
  projectName: "",
  vehicleReorganizeCode: "",
  vehicleReorganizeName: "",
  partNo: "",
  partName: "",
  valvePoint: "",
  status: "",
  updatedRange: [] as string[] | null,
});

const deleteConfirmMessage = computed(() => {
  if (!pendingDeleteRow.value) {
    return "确认删除当前成本BOM数据？删除后列表不再展示该记录。";
  }
  const targetName =
    pendingDeleteRow.value.rowType === "PART"
      ? `${pendingDeleteRow.value.partNo} ${pendingDeleteRow.value.partName}`
      : `${pendingDeleteRow.value.bomVersion} ${pendingDeleteRow.value.partName}`;
  return `确认删除「${targetName}」？删除后列表不再展示该记录。`;
});

const configs: Record<WorkbenchType, WorkbenchConfig> = {
  "research-history": {
    title: "成本履历",
    description:
      "同步旧系统成本履历入口，查看项目成本版本、过阀记录和启用状态。",
    permissionPrefix: "cost:research:history",
    emptyTitle: "暂无成本履历",
    emptyDescription: "当前筛选条件下没有可展示的成本履历。",
    showImport: true,
    columns: [
      "projectName",
      "vehicleModel",
      "valvePoint",
      "bomVersion",
      "status",
      "operator",
      "updatedAt",
    ],
  },
  "cost-analysis": {
    title: "成本分析",
    description:
      "汇总在研和在产成本数据，用于项目、车型、供应商和零件维度分析。",
    permissionPrefix: "cost:analysis",
    emptyTitle: "暂无成本分析",
    emptyDescription: "当前筛选条件下没有可展示的成本分析数据。",
    columns: [
      "projectName",
      "vehicleModel",
      "valvePoint",
      "supplierName",
      "costAmount",
      "reductionAmount",
      "reductionRate",
    ],
  },
  "bom-query": {
    title: "BOM查询",
    description:
      "同步旧系统 BOM 查询入口，支持按项目、零件和供应商检索 BOM 明细。",
    permissionPrefix: "cost:bom:query",
    emptyTitle: "暂无 BOM 数据",
    emptyDescription: "当前筛选条件下没有可展示的 BOM 明细。",
    columns: [
      "projectName",
      "vehicleReorganizeCode",
      "vehicleReorganizeName",
      "partNo",
      "partName",
      "quantity",
      "unit",
      "firstVehicleModel",
      "sorName",
      "expertEngineer",
      "suggestedSupplySource",
      "developmentDepartment",
      "generalizationLevel",
      "architectureComponent",
      "ecnProcessNum",
      "partCategory",
      "createdBy",
      "createdAt",
    ],
  },
};

const workbenchType = computed<WorkbenchType>(() => "bom-query");
const config = computed(
  () => configs[workbenchType.value] ?? configs["cost-analysis"],
);
const viewPermission = computed(() =>
  config.value.permissionPrefix === "cost:bom:query"
    ? `${config.value.permissionPrefix}:view`
    : `${config.value.permissionPrefix}:list`,
);
const deletePermission = computed(() =>
  config.value.permissionPrefix === "cost:bom:query"
    ? `${config.value.permissionPrefix}:remove`
    : `${config.value.permissionPrefix}:delete`,
);
const selectedProject = computed(() =>
  projectOptions.value.find(
    (item) => String(item.projectId) === String(query.projectId || ""),
  ),
);
const projectTreeData = computed(() =>
  projectOptions.value.map((item) => ({
    id: item.projectId,
    label: item.projectCode
      ? `${item.projectName}（${item.projectCode}）`
      : item.projectName,
  })),
);
const projectSelectOptions = computed(() =>
  projectOptions.value.map((item) => ({
    label: item.projectCode
      ? `${item.projectName}（${item.projectCode}）`
      : item.projectName,
    value: String(item.projectId),
  })),
);
const selectedCountText = computed(() =>
  selectedRows.value.length > 0 ? `已选择 ${selectedRows.value.length} 项` : "",
);
const allProjectsSelected = computed(
  () =>
    projectOptions.value.length > 0 &&
    selectedProjectIds.value.length === projectOptions.value.length,
);
const allProjectsIndeterminate = computed(
  () =>
    selectedProjectIds.value.length > 0 &&
    selectedProjectIds.value.length < projectOptions.value.length,
);
const statusFilterOptions = computed(() => {
  if (workbenchType.value === "research-history") {
    return [
      { label: "草稿", value: "DRAFT" },
      { label: "已生成", value: "GENERATED" },
      { label: "允许过阀", value: "PASSED" },
      { label: "带条件过阀", value: "CONDITIONALLY_PASSED" },
      { label: "不允许过阀", value: "REJECTED" },
    ];
  }
  return [
    { label: "待处理", value: "PENDING" },
    { label: "处理中", value: "RUNNING" },
    { label: "已完成", value: "COMPLETED" },
    { label: "失败", value: "FAILED" },
    { label: "已锁定", value: "LOCKED" },
  ];
});
watch(
  workbenchType,
  async () => {
    resetQuery();
    await loadProjectOptions();
    if (workbenchType.value === "cost-analysis") {
      await Promise.all([loadAnalysisCategoryTree(), loadValveOptions()]);
    }
    await queryTableRef.value?.reload();
  },
  { immediate: true },
);

watch(analysisCategoryKeyword, (keyword) => {
  analysisCategoryTreeRef.value?.filter(keyword);
});

async function loadProjectOptions(keyword = projectKeyword.value) {
  projectLoading.value = true;
  try {
    if (workbenchType.value === "bom-query") {
      let records = await fetchBomQueryProjects({
        projectName: keyword.trim() || undefined,
        type: 2,
        userId: authStore.currentUser?.id,
        page: 1,
        pageSize: 999,
      });
      if (!records.length) {
        const fallback = await fetchBusinessProjects({
          pageNo: 1,
          pageSize: 999,
          keyword: keyword.trim() || undefined,
          status: "ENABLED",
        });
        records = fallback.records;
      }
      projectOptions.value = records;
      selectedProjectIds.value = records.map((item) => item.projectId);
      query.projectId =
        records.length === 1 ? String(records[0].projectId) : "";
      return;
    }
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

async function searchProjects(value: string) {
  projectKeyword.value = value;
  await loadProjectOptions(value);
}

async function loadValveOptions() {
  valveLoading.value = true;
  try {
    const page = await fetchBusinessValves({
      status: "ENABLED",
      pageSize: 200,
    });
    valveOptions.value = page.records;
  } finally {
    valveLoading.value = false;
  }
}

async function loadAnalysisCategoryTree() {
  analysisLoading.value = true;
  try {
    const categories = await fetchCostBomCategories();
    analysisCategoryTree.value = buildAnalysisCategoryTree(categories);
  } finally {
    analysisLoading.value = false;
  }
}

function buildAnalysisCategoryTree(categories: CostBomCategoryItem[]) {
  const enabledCategories = categories.filter(
    (item) => item.status !== "DISABLED",
  );
  const level2 = enabledCategories
    .filter((item) => item.categoryLevel === 2)
    .sort((a, b) => Number(a.sortNo ?? 0) - Number(b.sortNo ?? 0));
  const level3 = enabledCategories
    .filter((item) => item.categoryLevel === 3)
    .sort((a, b) => Number(a.sortNo ?? 0) - Number(b.sortNo ?? 0));

  return [
    {
      id: "level2",
      label: "成本专业科室",
      children: level2.map(toAnalysisCategoryNode),
    },
    {
      id: "level3",
      label: "成本二级分类",
      children: level3.map(toAnalysisCategoryNode),
    },
  ];
}

function toAnalysisCategoryNode(category: CostBomCategoryItem) {
  return {
    id: `${category.categoryLevel}:${category.categoryId}`,
    label: category.categoryName,
    categoryId: Number(category.categoryId),
    categoryLevel: category.categoryLevel,
    categoryName: category.categoryName,
  };
}

function filterAnalysisCategoryNode(
  keyword: string,
  data: AnalysisCategoryTreeNode,
) {
  if (!keyword) {
    return true;
  }
  return data.label.toLowerCase().includes(keyword.trim().toLowerCase());
}

async function searchBomProjects(value = projectKeyword.value) {
  projectKeyword.value = value;
  await loadProjectOptions(value);
  queryTableRef.value?.search();
}

async function selectProject(projectId: number | string) {
  query.projectId = String(projectId || "");
  selectedProjectIds.value = projectId ? [projectId] : [];
  if (workbenchType.value === "cost-analysis") {
    clearAnalysisReport();
    return;
  }
  await refreshRows();
}

async function selectAllProjects() {
  selectedProjectIds.value = allProjectsSelected.value
    ? []
    : projectOptions.value.map((item) => item.projectId);
  query.projectId =
    selectedProjectIds.value.length === 1
      ? String(selectedProjectIds.value[0])
      : "";
  await refreshRows();
}

async function handleProjectSelectionChange(
  projectIds: Array<number | string>,
) {
  selectedProjectIds.value = projectIds;
  query.projectId = projectIds.length === 1 ? String(projectIds[0]) : "";
  await refreshRows();
}

function emptyRows(pageSize: number, pageNo: number) {
  return { total: 0, list: [], pageNo, pageSize };
}

function clearAnalysisReport() {
  analysisReportColumns.value = [];
  analysisReportRows.value = [];
}

function selectedAnalysisCategories() {
  const selectedIds = new Set(selectedAnalysisCategoryIds.value);
  return analysisCategoryTree.value
    .flatMap((group) => group.children ?? [])
    .filter((item) => selectedIds.has(item.id));
}

function validateAnalysisSearch(showWarning = false) {
  if (workbenchType.value !== "cost-analysis") {
    return true;
  }
  if (selectedAnalysisCategories().length === 0) {
    if (showWarning) {
      BaseToast.warning("请选择左侧成本分类后再搜索。");
    }
    return false;
  }
  if (!query.projectId) {
    if (showWarning) {
      BaseToast.warning("请选择项目后再搜索。");
    }
    return false;
  }
  if (!query.valvePoint) {
    if (showWarning) {
      BaseToast.warning("请选择阀点后再搜索。");
    }
    return false;
  }
  return true;
}

function selectedValveId() {
  return Number(query.valvePoint || 0) || undefined;
}

function selectedValveLabel() {
  const valveId = selectedValveId();
  const valve = valveOptions.value.find(
    (item) => Number(item.valveId) === Number(valveId),
  );
  return valve
    ? `${valve.valveName}（${valve.valveCode}）`
    : query.valvePoint || "--";
}

function buildCostBomExportFileName(row: CostWorkbenchRow | null | undefined) {
  const project = projectOptions.value.find(
    (item) => Number(item.projectId) === Number(row?.projectId),
  );
  const projectName = project?.projectName || row?.projectName || "--";
  const projectCode = project?.projectCode || row?.projectCode || "--";
  const valve = valveOptions.value.find(
    (item) =>
      item.valveName === row?.valvePoint ||
      item.valveCode === row?.valvePoint ||
      Number(item.valveId) === selectedValveId(),
  );
  const valveName = valve?.valveName || row?.valvePoint || "--";
  const bomVersion = row?.bomVersion
    ? `V${row.bomVersion.replace(/^V/i, "")}`
    : "--";
  const date = new Date();
  const dateText = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  return `成本BOM-${projectName}-${projectCode}-${valveName}-${bomVersion}-${dateText}.xlsx`;
}

async function queryBomRows(pageSize: number, pageNum: number) {
  const page = await fetchBomQueryPageList(bomQueryParams(pageSize, pageNum));
  return {
    total: page.total ?? 0,
    list: page.records.map(toBomQueryRow),
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

async function queryRows(pageSize: number, pageNum: number) {
  const projectId = currentProjectId();
  if (workbenchType.value === "bom-query") {
    return queryBomRows(pageSize, pageNum);
  }
  if (isAnalysisWorkbench() && !validateAnalysisSearch(false)) {
    clearAnalysisReport();
    return emptyRows(pageSize, pageNum);
  }
  if (!projectId) {
    return queryRowsAcrossProjects(pageSize, pageNum);
  }

  if (isAnalysisWorkbench()) {
    const versions = await fetchCostBomVersions(projectId, {
      pageNo: 1,
      pageSize: 1,
      latestOnly: true,
    });
    const version = versions.versions[0];
    if (!version) {
      return { total: 0, list: [], pageNo: pageNum, pageSize };
    }
    const analysisRecords = await loadAnalysisCategoryRecords(
      projectId,
      version.versionId,
    );
    const selectedCategoryKeys = new Set(
      selectedAnalysisCategories().map(
        (item) => `${item.categoryLevel}:${item.categoryName}`,
      ),
    );
    const selectedRecords = analysisRecords.filter((item) =>
      selectedCategoryKeys.has(
        `${item.categoryLevel}:${item.categoryName ?? ""}`,
      ),
    );
    const list = selectedRecords.map((item, index) =>
      toAnalysisRow(version, item, index),
    );
    if (workbenchType.value === "cost-analysis") {
      buildAnalysisReport(analysisRecords);
    }
    const filtered =
      workbenchType.value === "cost-analysis"
        ? list
        : list.filter(matchesQuery);
    const start = (pageNum - 1) * pageSize;
    return {
      total: filtered.length,
      list: filtered.slice(start, start + pageSize),
      pageNo: pageNum,
      pageSize,
    };
  }

  if (workbenchType.value === "research-history") {
    const page = await fetchCostBomGenerateVersions(
      projectId,
      historyGenerateVersionParams(pageNum, pageSize),
    );
    const list = page.records.map((item) => toGenerateVersionRow(item));
    return {
      total: page.total ?? 0,
      list,
      pageNo: page.pageNo,
      pageSize: page.pageSize,
    };
  }

  const versionsPage = await fetchCostBomVersions(projectId, {
    status: query.status || undefined,
    pageNo: pageNum,
    pageSize,
  });
  const list = versionsPage.versions
    .map((version) => toVersionRow(version))
    .filter(matchesQuery);
  return {
    total: versionsPage.total ?? 0,
    list,
    pageNo: versionsPage.pageNo,
    pageSize: versionsPage.pageSize,
  };
}

async function queryRowsAcrossProjects(pageSize: number, pageNum: number) {
  const projects = projectOptions.value.slice(0, 20);
  if (!projects.length) {
    return { total: 0, list: [], pageNo: pageNum, pageSize };
  }
  const rows = (
    await Promise.all(
      projects.map((project) => queryProjectPreviewRows(project)),
    )
  ).flat();
  if (workbenchType.value === "research-history") {
    const start = (pageNum - 1) * pageSize;
    return {
      total: rows.length,
      list: rows.slice(start, start + pageSize),
      pageNo: pageNum,
      pageSize,
    };
  }
  const filtered = rows.filter(matchesQuery);
  const start = (pageNum - 1) * pageSize;
  return {
    total: filtered.length,
    list: filtered.slice(start, start + pageSize),
    pageNo: pageNum,
    pageSize,
  };
}

function buildAnalysisReport(records: CostBomAnalysisCategoryItem[]) {
  const currentRecords = records.filter((item) => item.rowType !== "TARGET");
  const columnSource = uniqueAnalysisColumns(
    currentRecords.length ? currentRecords : records,
  );
  analysisReportColumns.value = [
    ...columnSource.map((item, index) => ({
      key: `current-${index}`,
      group: "current" as const,
      label: item.patternName || "加权",
      vehicleModelName: item.vehicleModelName || "--",
      patternName: item.patternName || "加权",
    })),
    ...columnSource.map((item, index) => ({
      key: `target-${index}`,
      group: "target" as const,
      label: item.patternName || "加权",
      vehicleModelName: item.vehicleModelName || "--",
      patternName: item.patternName || "加权",
    })),
  ];

  const level2Names = uniqueNames(
    records.filter((item) => item.categoryLevel === 2),
  );
  const level3Names = uniqueNames(
    records.filter((item) => item.categoryLevel === 3),
  );

  const rows: AnalysisReportRow[] = [
    {
      groupName: "",
      categoryName: "车型代号",
      rowType: "MODEL",
      values: Object.fromEntries(
        analysisReportColumns.value.map((column) => [
          column.key,
          column.vehicleModelName,
        ]),
      ),
    },
    {
      groupName: "",
      categoryName: "阀点",
      rowType: "VALVE",
      values: Object.fromEntries(
        analysisReportColumns.value.map((column) => [
          column.key,
          selectedValveLabel(),
        ]),
      ),
    },
    {
      groupName: "",
      categoryName: "版型",
      rowType: "PATTERN",
      values: Object.fromEntries(
        analysisReportColumns.value.map((column) => [
          column.key,
          column.patternName,
        ]),
      ),
    },
  ];
  appendAnalysisCategoryRows(rows, "成本专业科室", 2, level2Names, records);
  appendAnalysisCategoryRows(rows, "成本二级分类", 3, level3Names, records);
  analysisReportRows.value = rows;
}

function uniqueAnalysisColumns(records: CostBomAnalysisCategoryItem[]) {
  const map = new Map<string, CostBomAnalysisCategoryItem>();
  records.forEach((item) => {
    const key = `${item.vehicleModelId ?? item.vehicleModelName ?? ""}:${item.patternId ?? item.patternName ?? ""}:${item.rowType}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
}

function uniqueNames(records: CostBomAnalysisCategoryItem[]) {
  return Array.from(
    new Set(
      records
        .map((item) => item.categoryName)
        .filter((name): name is string => Boolean(name)),
    ),
  );
}

function appendAnalysisCategoryRows(
  rows: AnalysisReportRow[],
  groupName: string,
  categoryLevel: number,
  categoryNames: string[],
  records: CostBomAnalysisCategoryItem[],
) {
  const selectedNames = categoryNames.filter((name) =>
    selectedAnalysisCategories().some(
      (item) =>
        item.categoryLevel === categoryLevel && item.categoryName === name,
    ),
  );
  selectedNames.forEach((categoryName, index) => {
    const values: Record<string, string> = {};
    analysisReportColumns.value.forEach((column) => {
      const source = records.find(
        (item) =>
          item.categoryLevel === categoryLevel &&
          item.categoryName === categoryName &&
          (item.patternName || "加权") === column.patternName &&
          (item.vehicleModelName || "--") === column.vehicleModelName,
      );
      values[column.key] =
        column.group === "current"
          ? formatMoney(source?.currentCostAmount)
          : formatMoney(source?.targetCostAmount);
    });
    rows.push({
      groupName: index === 0 ? groupName : "DELETE",
      categoryName,
      rowType: "CATEGORY",
      values,
    });
  });
  if (selectedNames.length) {
    rows.push({
      groupName: "",
      categoryName: "小计",
      rowType: "CATEGORY",
      values: Object.fromEntries(
        analysisReportColumns.value.map((column) => [
          column.key,
          formatMoney(
            selectedNames.reduce((total, categoryName) => {
              const source = records.find(
                (item) =>
                  item.categoryLevel === categoryLevel &&
                  item.categoryName === categoryName &&
                  (item.patternName || "加权") === column.patternName &&
                  (item.vehicleModelName || "--") === column.vehicleModelName,
              );
              const value =
                column.group === "current"
                  ? source?.currentCostAmount
                  : source?.targetCostAmount;
              return total + toNumber(value);
            }, 0),
          ),
        ]),
      ),
    });
  }
}

function handleAnalysisCategoryCheck(
  _node: unknown,
  checked: { checkedKeys: string[] },
) {
  selectedAnalysisCategoryIds.value = checked.checkedKeys.filter((key) =>
    key.includes(":"),
  );
  clearAnalysisReport();
}

async function queryProjectPreviewRows(project: BusinessProjectItem) {
  const projectId = Number(project.projectId);
  if (!projectId) {
    return [];
  }
  if (isAnalysisWorkbench()) {
    const versions = await fetchCostBomVersions(projectId, {
      pageNo: 1,
      pageSize: 1,
      latestOnly: true,
    });
    const version = versions.versions[0];
    if (!version) {
      return [];
    }
    const analysis = await fetchCostBomAnalysisCategories(
      projectId,
      version.versionId,
      {
        categoryLevel: 3,
      },
    );
    return analysis.records.map((item, index) =>
      toAnalysisRow(version, item, index, project),
    );
  }
  if (workbenchType.value === "bom-query") {
    const versions = await fetchCostBomVersions(projectId, {
      pageNo: 1,
      pageSize: 1,
      latestOnly: true,
    });
    const version = versions.versions[0];
    if (!version) {
      return [];
    }
    const partsPage = await fetchCostBomParts(projectId, version.versionId, {
      ...bomQueryPartParams(query.keyword.trim()),
      pageNo: 1,
      pageSize: 5,
    });
    return partsPage.records.map((part) => toPartRow(version, part, project));
  }
  if (workbenchType.value === "research-history") {
    const page = await fetchCostBomGenerateVersions(
      projectId,
      historyGenerateVersionParams(1, 5),
    );
    return page.records.map((item) => toGenerateVersionRow(item, project));
  }
  const versionsPage = await fetchCostBomVersions(projectId, {
    status: query.status || undefined,
    pageNo: 1,
    pageSize: 5,
  });
  return versionsPage.versions.map((version) => toVersionRow(version, project));
}

function isAnalysisWorkbench() {
  return workbenchType.value === "cost-analysis";
}

async function loadAnalysisCategoryRecords(
  projectId: number,
  versionId: number,
) {
  const params = { valveId: selectedValveId() };
  const [level2, level3] = await Promise.all([
    fetchCostBomAnalysisCategories(projectId, versionId, {
      ...params,
      categoryLevel: 2,
    }),
    fetchCostBomAnalysisCategories(projectId, versionId, {
      ...params,
      categoryLevel: 3,
    }),
  ]);
  return [...level2.records, ...level3.records];
}

function currentProjectId() {
  return Number(query.projectId || 0);
}

function historyGenerateVersionParams(pageNo: number, pageSize: number) {
  const [createdAtStart, createdAtEnd] = query.updatedRange ?? [];
  return {
    pageNo,
    pageSize,
    valveKeyword: query.valvePoint || undefined,
    valveStatus: query.status || undefined,
    createdAtStart: createdAtStart || undefined,
    createdAtEnd: createdAtEnd || undefined,
  };
}

function resolveProjectName(project = selectedProject.value) {
  if (project) {
    return project.projectCode
      ? `${project.projectName}（${project.projectCode}）`
      : project.projectName;
  }
  const projectId = currentProjectId();
  return projectId ? `项目 ${projectId}` : "--";
}

function resolveVehicleModelName(project = selectedProject.value) {
  return project?.vehicleModelName || resolveProjectName(project);
}

function resolveProjectCode(project = selectedProject.value) {
  return (
    project?.projectCode || String(project?.projectId ?? currentProjectId())
  );
}

function rowProjectId(row?: CostWorkbenchRow | null) {
  return Number(row?.projectId ?? currentProjectId() ?? 0);
}

function resolveRowCostBomVersionId(row?: CostWorkbenchRow | null) {
  if (!row) {
    return undefined;
  }
  if (row.versionId) {
    return row.versionId;
  }
  if (row.rowType !== "VERSION") {
    return undefined;
  }
  const versionId = Number(row.id);
  return versionId > 0 ? versionId : undefined;
}

function resolveRowVersionParam(row?: CostWorkbenchRow | null) {
  return String(row?.bomVersion ?? "").replace(/^V/i, "");
}

function toVersionRow(
  version: CostBomVersionItem,
  project = selectedProject.value,
): CostWorkbenchRow {
  return {
    id: version.versionId,
    rowKey: `${Number(project?.projectId ?? currentProjectId()) || 0}-version-${version.versionId}`,
    projectId: Number(project?.projectId ?? currentProjectId()) || null,
    versionId: version.versionId,
    lockVersion: version.version,
    rowType: "VERSION",
    projectName: resolveProjectName(project),
    projectCode: resolveProjectCode(project),
    vehicleModel: resolveVehicleModelName(project),
    valvePoint: version.valveName || "",
    bomVersion: `V${version.versionNo}`,
    partNo: "--",
    partName: `零件数 ${version.partCount}`,
    supplierName: "--",
    costAmount: toNumber(version.totalCurrentCostAmount),
    reductionAmount: 0,
    reductionRate: 0,
    quantity: null,
    unit: null,
    targetCostAmount: null,
    estimatedCostAmount: null,
    currentCostAmount: version.totalCurrentCostAmount ?? null,
    costCategoryLevel2Code: null,
    costCategoryLevel2Name: null,
    costCategoryLevel3Code: null,
    costCategoryLevel3Name: null,
    status: mapVersionStatus(version.status, version.latest),
    updatedAt: version.submittedAt || "--",
    operator: version.submittedBy ? String(version.submittedBy) : "--",
  };
}

function toGenerateVersionRow(
  item: CostBomGenerateVersionItem,
  project = selectedProject.value,
): CostWorkbenchRow {
  return {
    id: item.generateVersionId,
    rowKey: `${Number(project?.projectId ?? item.projectId ?? currentProjectId()) || 0}-generated-${item.generateVersionId}`,
    projectId:
      Number(project?.projectId ?? item.projectId ?? currentProjectId()) ||
      null,
    versionId: item.costBomVersionId ?? null,
    lockVersion: 0,
    rowType: "GENERATED",
    projectName: resolveProjectName(project),
    projectCode: resolveProjectCode(project),
    vehicleModel:
      item.versionName || item.recordType || resolveVehicleModelName(project),
    valvePoint: item.valveName || "",
    bomVersion:
      item.versionName ||
      (item.costBomVersionId ? `版本 ${item.costBomVersionId}` : "--"),
    partNo: item.recordType || "--",
    partName: item.lockStatus || "--",
    supplierName: item.sourcePurchaseBomId
      ? `采购BOM ${item.sourcePurchaseBomId}`
      : "--",
    costAmount: 0,
    reductionAmount: 0,
    reductionRate: 0,
    quantity: null,
    unit: null,
    targetCostAmount: null,
    estimatedCostAmount: null,
    currentCostAmount: null,
    costCategoryLevel2Code: null,
    costCategoryLevel2Name: null,
    costCategoryLevel3Code: null,
    costCategoryLevel3Name: null,
    status: mapValveStatus(item.valveStatus),
    updatedAt: item.updatedAt || item.createdAt || "--",
    operator: item.sourceTaskId ? `任务 ${item.sourceTaskId}` : "--",
  };
}

function toPartRow(
  version: CostBomVersionItem,
  part: CostBomPartItem,
  project = selectedProject.value,
): CostWorkbenchRow {
  const currentCost = toNumber(part.currentCostAmount);
  const targetCost = toNumber(part.targetCostAmount);
  const reductionAmount = Math.max(currentCost - targetCost, 0);
  return {
    id: part.partId,
    rowKey: `${Number(project?.projectId ?? currentProjectId()) || 0}-part-${part.partId}`,
    projectId: Number(project?.projectId ?? currentProjectId()) || null,
    versionId: version.versionId,
    lockVersion: part.version,
    rowType: "PART",
    projectName: resolveProjectName(project),
    projectCode: resolveProjectCode(project),
    vehicleModel: resolveVehicleModelName(project),
    valvePoint: version.valveName || "",
    bomVersion: `V${version.versionNo}`,
    partNo: part.partNo,
    partName: part.partName,
    supplierName: part.supplierName || "--",
    vehicleReorganizeCode: part.vehicleReorganizeCode ?? null,
    vehicleReorganizeName: part.vehicleReorganizeName ?? null,
    firstVehicleModel: part.firstVehicleModel ?? null,
    sorName: part.sorName ?? null,
    expertEngineer: part.expertEngineer ?? null,
    suggestedSupplySource: part.suggestedSupplySource ?? null,
    developmentDepartment: part.developmentDepartment ?? null,
    generalizationLevel: part.generalizationLevel ?? null,
    architectureComponent: part.architectureComponent ?? null,
    ecrNumber: part.ecrNumber ?? null,
    ecnProcessNum:
      (part as CostBomPartItem & { ecnProcessNum?: string | null })
        .ecnProcessNum ??
      part.ecrNumber ??
      null,
    costAmount: currentCost,
    reductionAmount,
    reductionRate: currentCost > 0 ? reductionAmount / currentCost : 0,
    quantity: part.quantity ?? null,
    unit: part.unit ?? null,
    targetCostAmount: part.targetCostAmount ?? null,
    estimatedCostAmount: part.estimatedCostAmount ?? null,
    currentCostAmount: part.currentCostAmount ?? null,
    costCategoryLevel2Code: part.costCategoryLevel2Code ?? null,
    costCategoryLevel2Name: part.costCategoryLevel2Name ?? null,
    costCategoryLevel3Code: part.costCategoryLevel3Code ?? null,
    costCategoryLevel3Name: part.costCategoryLevel3Name ?? null,
    status: mapVersionStatus(version.status, version.latest),
    updatedAt: version.submittedAt || "--",
    operator: version.submittedBy ? String(version.submittedBy) : "--",
  };
}

function toBomQueryRow(item: BomQueryItem): CostWorkbenchRow {
  const projectId = Number(item.projectId ?? 0) || null;
  const rowId = item.id || `${projectId ?? ""}-${item.partNo ?? ""}`;
  return {
    id: rowId,
    rowKey: `bom-query-${rowId}`,
    projectId,
    versionId: null,
    lockVersion: null,
    rowType: "BOM_QUERY",
    projectName: item.projectName || "--",
    projectCode: projectId ? String(projectId) : "--",
    vehicleModel: item.vehicleReorganizeName || "--",
    valvePoint: "",
    bomVersion: "--",
    partNo: item.partNo || "--",
    partName: item.partName || "--",
    supplierName: "--",
    vehicleReorganizeCode: item.vehicleReorganizeCode ?? null,
    vehicleReorganizeName: item.vehicleReorganizeName ?? null,
    firstVehicleModel: item.firstVehicleModel ?? null,
    sorName: item.sorName ?? null,
    expertEngineer: item.expertEngineer ?? null,
    suggestedSupplySource: item.suggestedSupplySource ?? null,
    developmentDepartment: item.developmentDepartment ?? null,
    generalizationLevel: item.generalizationLevel ?? null,
    architectureComponent: item.architectureComponent ?? null,
    ecrNumber: null,
    ecnProcessNum: item.ecnProcessNum ?? null,
    costAmount: 0,
    reductionAmount: 0,
    reductionRate: 0,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    targetCostAmount: null,
    estimatedCostAmount: null,
    currentCostAmount: null,
    costCategoryLevel2Code: null,
    costCategoryLevel2Name: null,
    costCategoryLevel3Code: null,
    costCategoryLevel3Name: null,
    partCategory: item.partCategory ?? null,
    createdBy: item.createdBy ?? null,
    createdAt: item.createdAt ?? null,
    status: "COMPLETED",
    updatedAt: item.createdAt || "--",
    operator: item.createdBy || "--",
  };
}

function toAnalysisRow(
  version: CostBomVersionItem,
  item: CostBomAnalysisCategoryItem,
  index: number,
  project = selectedProject.value,
): CostWorkbenchRow {
  const currentCost = toNumber(item.currentCostAmount);
  const targetCost = toNumber(item.targetCostAmount);
  const reductionAmount = Math.max(currentCost - targetCost, 0);
  return {
    id: Number(item.categoryId ?? item.patternId ?? index + 1),
    rowKey: `${Number(project?.projectId ?? currentProjectId()) || 0}-analysis-${item.categoryId ?? item.patternId ?? index + 1}`,
    projectId: Number(project?.projectId ?? currentProjectId()) || null,
    versionId: version.versionId,
    lockVersion: null,
    rowType: "ANALYSIS",
    projectName: resolveProjectName(project),
    projectCode: resolveProjectCode(project),
    vehicleModel: item.vehicleModelName || resolveProjectName(project),
    valvePoint: version.valveName || "",
    bomVersion: `V${version.versionNo}`,
    partNo: item.categoryCode || "--",
    partName: item.categoryName || item.patternName || "--",
    supplierName:
      item.patternName || (item.rowType === "WEIGHT" ? "加权" : "--"),
    costAmount: currentCost,
    reductionAmount,
    reductionRate: currentCost > 0 ? reductionAmount / currentCost : 0,
    quantity: item.partCount != null ? String(item.partCount) : null,
    unit: null,
    targetCostAmount: item.targetCostAmount ?? null,
    estimatedCostAmount: null,
    currentCostAmount: item.currentCostAmount ?? null,
    costCategoryLevel2Code:
      item.categoryLevel === 2 ? (item.categoryCode ?? null) : null,
    costCategoryLevel2Name:
      item.categoryLevel === 2 ? (item.categoryName ?? null) : null,
    costCategoryLevel3Code:
      item.categoryLevel === 3 ? (item.categoryCode ?? null) : null,
    costCategoryLevel3Name:
      item.categoryLevel === 3 ? (item.categoryName ?? null) : null,
    status: mapVersionStatus(version.status, version.latest),
    updatedAt: version.submittedAt || "--",
    operator: version.submittedBy ? String(version.submittedBy) : "--",
  };
}

function matchesQuery(row: CostWorkbenchRow) {
  const keyword = query.keyword.trim().toLowerCase();
  const [startDate, endDate] = query.updatedRange ?? [];
  return (
    (!keyword ||
      row.projectName.toLowerCase().includes(keyword) ||
      row.projectCode.toLowerCase().includes(keyword) ||
      row.partNo.toLowerCase().includes(keyword) ||
      row.partName.toLowerCase().includes(keyword) ||
      row.supplierName.toLowerCase().includes(keyword)) &&
    (!query.valvePoint || row.valvePoint === query.valvePoint) &&
    (!query.status || row.status === query.status) &&
    (!startDate || row.updatedAt.slice(0, 10) >= startDate) &&
    (!endDate || row.updatedAt.slice(0, 10) <= endDate)
  );
}

function mapVersionStatus(
  status: string,
  latest: boolean,
): CostWorkbenchRow["status"] {
  if (status === "FAILED") {
    return "FAILED";
  }
  if (status === "SUBMITTED" || status === "USED") {
    return "COMPLETED";
  }
  if (latest) {
    return "LOCKED";
  }
  return "PENDING";
}

function mapValveStatus(status?: string | null): CostWorkbenchRow["status"] {
  if (
    status === "DRAFT" ||
    status === "GENERATED" ||
    status === "PASSED" ||
    status === "CONDITIONALLY_PASSED" ||
    status === "REJECTED"
  ) {
    return status;
  }
  return "DRAFT";
}

function toNumber(value?: string | null) {
  return value ? Number(value) : 0;
}

function formatMoney(value?: string | number | null) {
  const numberValue = Number(value ?? 0);
  return numberValue.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resetQuery() {
  query.projectId = "";
  query.keyword = "";
  query.projectName = "";
  query.vehicleReorganizeCode = "";
  query.vehicleReorganizeName = "";
  query.partNo = "";
  query.partName = "";
  query.valvePoint = "";
  query.status = "";
  query.updatedRange = [];
  selectedRows.value = [];
  selectedProjectIds.value = [];
  selectedAnalysisCategoryIds.value = [];
  analysisCategoryTreeRef.value?.setCheckedKeys?.([]);
  analysisCategoryKeyword.value = "";
  clearAnalysisReport();
}

async function searchRows() {
  if (workbenchType.value === "bom-query") {
    queryTableRef.value?.search();
    return;
  }
  if (workbenchType.value === "cost-analysis") {
    if (!validateAnalysisSearch(true)) {
      clearAnalysisReport();
      return;
    }
  }
  if (workbenchType.value === "research-history" && !query.projectId) {
    await loadProjectOptions(query.keyword);
  }
  queryTableRef.value?.search();
}

function handleQueryTableSearch() {
  if (workbenchType.value === "cost-analysis") {
    validateAnalysisSearch(true);
  }
}

function handleAnalysisConditionChange() {
  if (workbenchType.value !== "cost-analysis") {
    return;
  }
  clearAnalysisReport();
}

async function refreshRows() {
  if (workbenchType.value === "bom-query") {
    await queryTableRef.value?.reload();
    return;
  }
  await queryTableRef.value?.reload();
}

async function resetBomQueryRows() {
  resetQuery();
  await loadProjectOptions();
  await refreshRows();
}

async function openDetail(row: CostWorkbenchRow) {
  if (workbenchType.value === "research-history") {
    const projectId = rowProjectId(row);
    const versionId = resolveRowCostBomVersionId(row);
    if (!projectId || !versionId) {
      BaseToast.warning("当前成本履历缺少项目或版本信息。");
      return;
    }
    await router.push({
      path: "/cost/research/history/detail",
      query: {
        projectId: String(projectId),
        bomVersionId: String(versionId),
        versionId: String(versionId),
        version: resolveRowVersionParam(row),
        vehicleModelName: row.vehicleModel || row.projectName || "",
        projectName: row.projectName || "",
        projectCode: row.projectCode || String(projectId),
        valveId: readValveId(row.valvePoint)
          ? String(readValveId(row.valvePoint))
          : undefined,
        valveName: row.valvePoint || "",
        returnPath: route.fullPath,
        activeMenu: "/cost/bom/query",
      },
    });
    return;
  }
  activeRow.value = row;
  dashboardPatternSummaries.value = [];
  dashboardPatternDetails.value = [];
  detailVisible.value = true;
  const valveId = readValveId(row.valvePoint);
  const projectId = rowProjectId(row);
  if (!projectId) {
    BaseToast.warning("当前行缺少项目ID。");
    return;
  }
  const [summaries, details] = await Promise.all([
    fetchCostBomDashboardPatternSummaries(projectId, { valveId }),
    fetchCostBomDashboardPatternDetails(projectId, { valveId }),
  ]);
  dashboardPatternSummaries.value = summaries;
  dashboardPatternDetails.value = details;
}

async function loadHistoryDetailParts() {
  const row = activeRow.value;
  const projectId = rowProjectId(row);
  const versionId = resolveRowCostBomVersionId(row);
  if (!projectId || !versionId) {
    detailParts.value = [];
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }
  const conditions = buildDetailConditionParams();
  const page = await fetchCostBomParts(projectId, versionId, {
    pageNo: 1,
    pageSize: 200,
    conditions: conditions.length ? JSON.stringify(conditions) : undefined,
  });
  detailParts.value = page.records;
  detailSelectedParts.value = [];
}

function addDetailCondition() {
  detailConditions.value.push({
    logic: "AND",
    moduleName: "",
    attributeName: "partNo",
    operator: "like",
    value: "",
  });
}

function buildDetailConditionParams() {
  return detailConditions.value
    .filter((item) => Boolean(item.attributeName && item.operator) && (nullOperators.has(item.operator) || item.value.trim()))
    .map((item) => ({
      logic: item.logic,
      moduleName: item.moduleName || undefined,
      attributeName: item.attributeName,
      operator: item.operator,
      attributeValue: nullOperators.has(item.operator) ? "" : item.value.trim(),
    }));
}

function removeDetailCondition(index: number) {
  if (detailConditions.value.length === 1) {
    Object.assign(detailConditions.value[0], {
      logic: "AND",
      moduleName: "",
      attributeName: "partNo",
      operator: "like",
      value: "",
    });
    return;
  }
  detailConditions.value.splice(index, 1);
}

function resetDetailConditions() {
  detailConditions.value = [
    {
      logic: "AND",
      moduleName: "",
      attributeName: "partNo",
      operator: "like",
      value: "",
    },
  ];
  void loadHistoryDetailParts();
}

function handleDetailSelectionChange(rows: CostBomPartItem[]) {
  detailSelectedParts.value = rows;
}

async function exportHistoryDetailParts() {
  const row = activeRow.value;
  const projectId = rowProjectId(row);
  const versionId = resolveRowCostBomVersionId(row);
  if (!projectId || !versionId) {
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }
  const task = await createCostBomExport(projectId, {
    versionId,
    format: "xlsx",
  });
  latestTaskId.value = String(task.taskId);
  latestTaskFileName.value = buildCostBomExportFileName(row);
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

async function calculateHistoryDetailParts() {
  const row = activeRow.value;
  const projectId = rowProjectId(row);
  const versionId = resolveRowCostBomVersionId(row);
  if (!projectId || !versionId) {
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }
  const task = await createCostBomExtendCalculationTask(
    projectId,
    versionId,
    resolveRowVersionParam(row),
  );
  BaseToast.success(`计算任务已创建：${task.taskNo || task.taskId}`);
}

async function copyHistoryDetailValveData() {
  const row = activeRow.value;
  const projectId = rowProjectId(row);
  const versionId = resolveRowCostBomVersionId(row);
  if (!projectId || !versionId) {
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }
  const result = await copyCostBomValveData(projectId, versionId, {
    sourceVersionId: versionId,
  });
  BaseToast.success(`阀点复制完成：${result.copiedPartCount ?? 0} 条`);
  await loadHistoryDetailParts();
}

async function saveHistoryDetailAsNewVersion() {
  const row = activeRow.value;
  const projectId = rowProjectId(row);
  const versionId = resolveRowCostBomVersionId(row);
  if (!projectId || !versionId) {
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }
  const result = await submitCostBomVersion(projectId, versionId, {
    submitRemark: "成本履历明细保存新版本",
    version: resolveRowVersionParam(row),
  });
  BaseToast.success(`已保存新版本：V${result.versionNo}`);
  await refreshRows();
}

async function deleteSelectedHistoryParts() {
  const row = activeRow.value;
  const projectId = rowProjectId(row);
  const versionId = resolveRowCostBomVersionId(row);
  if (!projectId || !versionId || detailSelectedParts.value.length === 0) {
    BaseToast.warning("请选择需要删除的零件。");
    return;
  }
  await Promise.all(
    detailSelectedParts.value.map((part) =>
      deleteCostBomPart(projectId, versionId, part.partId, part.version),
    ),
  );
  BaseToast.success(`已删除 ${detailSelectedParts.value.length} 条零件`);
  await loadHistoryDetailParts();
}

function openPartEditor(mode: PartEditMode, row?: CostBomPartItem) {
  partEditMode.value = mode;
  activePart.value = row ?? null;
  const source: Partial<CostBomPartItem> = row ?? {};
  Object.assign(partForm, {
    partNo:
      mode === "copy" ? `${source.partNo || ""}-COPY` : source.partNo || "",
    partName: source.partName || "",
    moduleIdentifier: source.moduleIdentifier || "",
    supplierName: source.supplierName || "",
    quantity: source.quantity || "",
    unit: source.unit || "",
    targetCostAmount: source.targetCostAmount || "",
    estimatedCostAmount: source.estimatedCostAmount || "",
    currentCostAmount: source.currentCostAmount || "",
    costCategoryLevel2Name: source.costCategoryLevel2Name || "",
    costCategoryLevel3Name: source.costCategoryLevel3Name || "",
    generalizationLevel: source.generalizationLevel || "",
    architectureComponent: source.architectureComponent || "",
    summaryRemark: source.summaryRemark || "",
  });
  partEditorVisible.value = true;
}

async function savePartEditor() {
  const row = activeRow.value;
  const projectId = rowProjectId(row);
  const versionId = resolveRowCostBomVersionId(row);
  if (!projectId || !versionId) {
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }
  if (!partForm.partNo?.trim() || !partForm.partName?.trim()) {
    BaseToast.warning("零件号和零件名称不能为空。");
    return;
  }
  const page = await fetchCostBomParts(projectId, versionId, {
    pageNo: 1,
    pageSize: 1000,
  });
  const nextParts = page.records.map(toPartSaveItem);
  if (partEditMode.value === "edit" && activePart.value) {
    const index = nextParts.findIndex(
      (item) => item.partNo === activePart.value?.partNo,
    );
    if (index >= 0) {
      nextParts[index] = { ...nextParts[index], ...partForm };
    }
  } else {
    nextParts.push({ ...partForm });
  }
  const result = await saveCostBomParts(projectId, versionId, {
    parts: nextParts,
  });
  BaseToast.success(`保存成功，当前零件数 ${result.partCount}`);
  partEditorVisible.value = false;
  await loadHistoryDetailParts();
}

function toPartSaveItem(part: CostBomPartItem): CostBomPartSaveItem {
  const payload: Partial<CostBomPartItem> = { ...part };
  delete payload.partId;
  delete payload.version;
  return payload as CostBomPartSaveItem;
}

function openPartHistory(row: CostBomPartItem) {
  activePart.value = row;
  partHistoryVisible.value = true;
}

async function openVersionHistory(row: CostWorkbenchRow) {
  const projectId = rowProjectId(row);
  const versionId = resolveRowCostBomVersionId(row);
  if (!projectId || !versionId) {
    BaseToast.warning("当前成本履历缺少项目或版本信息。");
    return;
  }
  await router.push({
    path: "/cost/research/versions",
    query: {
      projectId: String(projectId),
      versionId: String(versionId),
      projectName: row.projectName || undefined,
      valveName: row.valvePoint || undefined,
      activeMenu: "/cost/bom/query",
    },
  });
}

function handleHistoryVersionSelection(rows: CostBomVersionItem[]) {
  selectedHistoryVersions.value = rows;
}

async function compareHistoryVersions() {
  if (selectedHistoryVersions.value.length !== 2 || !activeRow.value) {
    BaseToast.warning("请选择两个版本进行对比。");
    return;
  }
  const projectId = rowProjectId(activeRow.value);
  const [base, target] = selectedHistoryVersions.value;
  const [baseParts, targetParts] = await Promise.all([
    fetchCostBomParts(projectId, base.versionId, { pageNo: 1, pageSize: 200 }),
    fetchCostBomParts(projectId, target.versionId, {
      pageNo: 1,
      pageSize: 200,
    }),
  ]);
  const targetMap = new Map(
    targetParts.records.map((item) => [item.partNo, item]),
  );
  versionCompareRows.value = baseParts.records.map((item) => {
    const other = targetMap.get(item.partNo);
    return {
      partNo: item.partNo,
      partName: item.partName,
      baseCost: item.currentCostAmount || "--",
      targetCost: other?.currentCostAmount || "--",
      diff: String(
        Number(other?.currentCostAmount ?? 0) -
          Number(item.currentCostAmount ?? 0),
      ),
    };
  });
  versionCompareVisible.value = true;
}

async function viewHistoryVersion(row: CostBomVersionItem) {
  if (!activeRow.value) {
    return;
  }
  await openDetail({
    ...activeRow.value,
    id: row.versionId,
    versionId: row.versionId,
    lockVersion: row.version,
    rowType: "VERSION",
    bomVersion: `V${row.versionNo}`,
  });
}

async function resolveLatestVersionId() {
  const projectId = rowProjectId(activeRow.value);
  if (!projectId) {
    return undefined;
  }
  const versions = await fetchCostBomVersions(projectId, {
    pageNo: 1,
    pageSize: 1,
    latestOnly: true,
  });
  return versions.versions[0]?.versionId;
}

async function handleImport() {
  const projectId = rowProjectId(selectedRows.value[0] ?? activeRow.value);
  if (!projectId) {
    BaseToast.warning("请选择一条成本履历后导入。");
    return;
  }
  importProjectId.value = projectId;
  importDialogVisible.value = true;
}

function downloadCostBomImportTemplate() {
  downloadLocalTemplate("\u6210\u672cBOM-\u5bfc\u5165\u6a21\u7248.xlsx");
}

function handleSelectionChange(rows: CostWorkbenchRow[]) {
  selectedRows.value = rows;
}

async function deleteSelectedRows() {
  const rows = selectedRows.value
    .map((row) => ({ row, versionId: resolveRowCostBomVersionId(row) }))
    .filter((item) => item.versionId);
  if (!rows.length) {
    BaseToast.warning("请选择需要删除的成本版本。");
    return;
  }
  await Promise.all(
    rows.map(({ row, versionId }) =>
      deleteCostBomVersion(
        rowProjectId(row),
        versionId as number,
        row.lockVersion ?? 0,
      ),
    ),
  );
  selectedRows.value = [];
  BaseToast.success(`已删除 ${rows.length} 个成本版本`);
  await refreshRows();
}

async function handleHistoryImport(file: UploadFile) {
  const rawFile = file.raw;
  if (!rawFile) {
    BaseToast.warning("请选择需要导入的文件");
    return;
  }
  const selectedRow = selectedRows.value[0] ?? activeRow.value;
  const projectId = importProjectId.value ?? rowProjectId(selectedRow);
  if (!projectId) {
    BaseToast.warning("请选择一条成本履历后导入。");
    return;
  }
  const valveId =
    selectedValveId() ?? readValveId(selectedRow?.valvePoint ?? "");
  if (!valveId) {
    BaseToast.warning("请选择阀点后再导入。");
    return;
  }
  importLoading.value = true;
  try {
    const task = await importProjectCostBomData({
      file: rawFile,
      valveId,
    });
    latestTaskId.value = String(task.taskId);
    importProjectId.value = null;
    importDialogVisible.value = false;
    BaseToast.success(`成本历史导入任务已创建：${task.taskNo || task.taskId}`);
  } catch (unknownError) {
    BaseToast.error(resolveImportErrorMessage(unknownError), 5000);
  } finally {
    importLoading.value = false;
  }
}

function resolveImportErrorMessage(unknownError: unknown) {
  if (unknownError instanceof Error) {
    return unknownError.message || "成本历史导入失败，请检查文件或后端服务。";
  }
  return "成本历史导入失败，请检查文件或后端服务。";
}

async function handleSync() {
  const versionId =
    resolveRowCostBomVersionId(activeRow.value) ??
    (await resolveLatestVersionId());
  const projectId = rowProjectId(activeRow.value);
  if (!versionId) {
    BaseToast.warning("暂无可同步的成本BOM版本。");
    return;
  }
  if (!projectId) {
    BaseToast.warning("请选择项目后同步。");
    return;
  }
  const task = await createCostBomPriceRefreshTask(projectId, versionId);
  BaseToast.success(`同步任务已创建：${task.taskNo || task.taskId}`);
  await refreshRows();
}

async function handleExport(row?: CostWorkbenchRow) {
  if (
    workbenchType.value === "cost-analysis" &&
    !validateAnalysisSearch(true)
  ) {
    return;
  }
  if (workbenchType.value === "bom-query") {
    const task = await createSyncBomQueryExportTask(
      row
        ? {
            projectId: row.projectId ? String(row.projectId) : undefined,
            vehiclem: row.vehicleReorganizeCode || undefined,
            partNum: row.partNo === "--" ? undefined : row.partNo,
          }
        : bomQueryExportParams(),
    );
    latestTaskId.value = String(task.taskId);
    latestTaskFileName.value = buildCostBomExportFileName(
      row ?? activeRow.value,
    );
    BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
    return;
  }
  const projectId = rowProjectId(row ?? activeRow.value);
  const versionId =
    resolveRowCostBomVersionId(row) ??
    resolveRowCostBomVersionId(activeRow.value) ??
    (await resolveLatestVersionId());
  if (!versionId) {
    BaseToast.warning("暂无可导出的成本BOM版本。");
    return;
  }
  if (!projectId) {
    BaseToast.warning("请选择项目后导出。");
    return;
  }
  const task = await createCostBomAnalysisExportTask(
    projectId,
    versionId,
    workbenchType.value === "cost-analysis"
      ? { valveId: selectedValveId() }
      : {},
  );
  latestTaskId.value = String(task.taskId);
  latestTaskFileName.value = buildCostBomExportFileName(row ?? activeRow.value);
  BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
}

function openCopyValveDialog(row: CostWorkbenchRow) {
  const versionId = resolveRowCostBomVersionId(row);
  if (!versionId) {
    BaseToast.warning("当前行没有可复制的目标版本。");
    return;
  }
  activeRow.value = row;
  Object.assign(copyValveForm, {
    sourceValveId: "",
    targetValveId: String(
      selectedValveId() ?? readValveId(row.valvePoint) ?? "",
    ),
  });
  copyValveVisible.value = true;
}

async function confirmCopyValveData() {
  const targetRow = activeRow.value;
  const targetVersionId = resolveRowCostBomVersionId(targetRow);
  const sourceValveId = readOptionalNumber(copyValveForm.sourceValveId);
  const targetValveId = readOptionalNumber(copyValveForm.targetValveId);
  if (!targetRow || !targetVersionId) {
    BaseToast.warning("请选择目标成本BOM版本。");
    return;
  }
  if (!sourceValveId || !targetValveId) {
    BaseToast.warning("请选择源阀点和目标阀点。");
    return;
  }
  if (sourceValveId === targetValveId) {
    BaseToast.warning("源阀点和目标阀点不能相同。");
    return;
  }
  await copyCostBomValveData(rowProjectId(targetRow), targetVersionId, {
    sourceValveId,
    targetValveId,
  });
  BaseToast.success("阀点数据复制完成");
  copyValveVisible.value = false;
  await refreshRows();
}

async function deleteRow(row: CostWorkbenchRow) {
  if (row.lockVersion == null) {
    BaseToast.warning("当前行缺少乐观锁版本，不能删除。");
    return;
  }
  pendingDeleteRow.value = row;
  deleteConfirmVisible.value = true;
}

async function handleRowCommand(row: CostWorkbenchRow, command: string) {
  if (command === "delete") {
    await deleteRow(row);
    return;
  }
  const versionId = resolveRowCostBomVersionId(row);
  const projectId = rowProjectId(row);
  if (!projectId || !versionId) {
    BaseToast.warning("当前行缺少项目或版本信息。");
    return;
  }
  if (command === "allow") {
    const result = await useCostBomVersion(projectId, versionId);
    BaseToast.success(`已允许过阀：V${result.versionNo}`);
  } else if (command === "lock") {
    const result = await updateCostBomVersionLockStatus(
      projectId,
      versionId,
      row.status !== "LOCKED",
    );
    BaseToast.success(
      `${result.lockStatus === "LOCKED" ? "锁定" : "解锁"}成功`,
    );
  } else if (command === "conditional") {
    const result = await submitCostBomVersion(projectId, versionId, {
      submitRemark: "成本履历带条件过阀提交",
      version: resolveRowVersionParam(row),
    });
    BaseToast.success(`已带条件过阀：V${result.versionNo}`);
  } else if (command === "deny") {
    const result = await recalculateCostBomVersion(projectId, versionId);
    BaseToast.success(`已不允许过阀并重算：V${result.versionNo}`);
  }
  await refreshRows();
}

async function confirmDeleteRow() {
  const row = pendingDeleteRow.value;
  if (!row) {
    deleteConfirmVisible.value = false;
    return;
  }
  const lockVersion = row.lockVersion;
  if (lockVersion == null) {
    BaseToast.warning("当前行缺少乐观锁版本，不能删除。");
    return;
  }

  if (row.rowType === "PART") {
    const versionId = row.versionId;
    const projectId = rowProjectId(row);
    const partId = String(row.id);
    if (!versionId) {
      BaseToast.warning("当前零件行缺少成本BOM版本ID。");
      return;
    }
    if (!projectId) {
      BaseToast.warning("当前零件行缺少项目ID。");
      return;
    }
    if (!partId) {
      BaseToast.warning("当前零件行缺少零件ID。");
      return;
    }
    await deleteCostBomPart(projectId, versionId, partId, lockVersion);
    BaseToast.success("零件行已删除");
  } else if (row.rowType === "VERSION" || row.rowType === "GENERATED") {
    const projectId = rowProjectId(row);
    const versionId = resolveRowCostBomVersionId(row);
    if (!projectId) {
      BaseToast.warning("当前版本行缺少项目ID。");
      return;
    }
    if (!versionId) {
      BaseToast.warning("当前行缺少成本BOM版本ID。");
      return;
    }
    await deleteCostBomVersion(projectId, versionId, lockVersion);
    BaseToast.success("成本BOM版本已删除");
  } else {
    BaseToast.warning("当前行不支持删除。");
    return;
  }
  deleteConfirmVisible.value = false;
  pendingDeleteRow.value = null;
  await refreshRows();
}

function readOptionalNumber(value: string) {
  const normalized = value.trim();
  return normalized ? Number(normalized) : undefined;
}

function bomQueryPartParams(keyword = "") {
  const params: Record<string, string | undefined> = {
    partNo: query.partNo.trim() || undefined,
    vehicleReorganizeCode: query.vehicleReorganizeCode.trim() || undefined,
    vehicleReorganizeName: query.vehicleReorganizeName.trim() || undefined,
  };
  if (keyword && !params.partNo) {
    params.partNo = keyword;
    params.partName = keyword;
    params.supplierName = keyword;
  }
  const filterFields = bomQueryFilterFieldSet.value;
  return Object.fromEntries(
    Object.entries(params).filter(
      ([field, value]) =>
        value && (filterFields.size === 0 || filterFields.has(field)),
    ),
  );
}

function bomQueryParams(pageSize: number, pageNum: number) {
  const [startTime, endTime] = query.updatedRange ?? [];
  const selectedIds = selectedProjectIds.value
    .map((projectId) => String(projectId).trim())
    .filter(Boolean);
  return {
    pageNum,
    pageSize,
    vehiclem: query.vehicleReorganizeCode.trim() || undefined,
    vehicleName: query.vehicleReorganizeName.trim() || undefined,
    partNum: query.partNo.trim() || undefined,
    chDesc: query.partName.trim() || undefined,
    projectName: query.projectName.trim() || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    projectId: selectedIds.length ? selectedIds.join(",") : "    ",
  };
}

function bomQueryExportParams() {
  const {
    pageNum: _pageNum,
    pageSize: _pageSize,
    ...filters
  } = bomQueryParams(1, 1);
  return filters;
}

function formatCell(row: CostWorkbenchRow, column: keyof CostWorkbenchRow) {
  const value = row[column];
  if (
    column === "costAmount" ||
    column === "reductionAmount" ||
    column === "targetCostAmount" ||
    column === "estimatedCostAmount" ||
    column === "currentCostAmount"
  ) {
    return Number(value).toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (column === "reductionRate") {
    return `${(Number(value) * 100).toFixed(2)}%`;
  }
  if (column === "status") {
    return resolveStatusLabel(row.status);
  }
  return String(value || "--");
}

function readValveId(valvePoint: string) {
  const matched = valvePoint.match(/\d+/);
  return matched ? Number(matched[0]) : undefined;
}

function resolveStatusLabel(status: CostWorkbenchRow["status"]) {
  if (workbenchType.value === "research-history") {
    const passStatusLabelMap: Record<CostWorkbenchRow["status"], string> = {
      PENDING: "未过阀",
      RUNNING: "处理中",
      COMPLETED: "允许过阀",
      FAILED: "不允许过阀",
      LOCKED: "已锁定",
      DRAFT: "草稿",
      GENERATED: "已生成",
      PASSED: "允许过阀",
      CONDITIONALLY_PASSED: "带条件过阀",
      REJECTED: "不允许过阀",
    };
    return passStatusLabelMap[status];
  }
  const labelMap: Record<CostWorkbenchRow["status"], string> = {
    PENDING: "待处理",
    RUNNING: "处理中",
    COMPLETED: "已完成",
    FAILED: "失败",
    LOCKED: "已锁定",
    DRAFT: "草稿",
    GENERATED: "已生成",
    PASSED: "允许过阀",
    CONDITIONALLY_PASSED: "带条件过阀",
    REJECTED: "不允许过阀",
  };
  return labelMap[status];
}

function resolveAnalysisCellClass({ row }: { row: AnalysisReportRow }) {
  return row.rowType === "MODEL" || row.rowType === "PATTERN"
    ? "is-strong"
    : "";
}

function resolveAnalysisSpanMethod({
  row,
  columnIndex,
}: {
  row: AnalysisReportRow;
  columnIndex: number;
}) {
  if (columnIndex !== 0) {
    return [1, 1];
  }
  if (row.groupName === "DELETE") {
    return [0, 0];
  }
  if (!row.groupName || row.rowType !== "CATEGORY") {
    return [1, 1];
  }
  const startIndex = analysisReportRows.value.indexOf(row);
  const span = analysisReportRows.value
    .slice(startIndex + 1)
    .findIndex((item) => item.groupName !== "DELETE");
  return [
    span === -1 ? analysisReportRows.value.length - startIndex : span + 1,
    1,
  ];
}
</script>

<template>
  <PageContainer
    :title="config.title"
    :description="config.description"
    :class="{ 'cost-workbench-page--fixed': workbenchType === 'bom-query' }"
  >
    <div
      class="cost-workbench"
      :class="{
        'cost-workbench--bom-query': workbenchType === 'bom-query',
        'cost-workbench--analysis': workbenchType === 'cost-analysis',
      }"
    >
      <aside
        v-if="
          workbenchType === 'bom-query' || workbenchType === 'cost-analysis'
        "
        class="cost-workbench__project-pane"
      >
        <template v-if="workbenchType === 'bom-query'">
          <div class="cost-workbench__project-header">项目</div>
          <el-input
            v-model="projectKeyword"
            clearable
            placeholder="请输入项目代号"
            @keyup.enter="searchBomProjects()"
            @clear="searchBomProjects('')"
          />
          <el-scrollbar class="cost-workbench__project-scroll">
            <el-checkbox
              class="cost-workbench__project-all-check"
              :model-value="allProjectsSelected"
              :indeterminate="allProjectsIndeterminate"
              @change="selectAllProjects"
            >
              全部
            </el-checkbox>
            <el-checkbox-group
              v-model="selectedProjectIds"
              v-loading="projectLoading"
              class="cost-workbench__project-checks"
              @change="handleProjectSelectionChange"
            >
              <el-checkbox
                v-for="item in projectTreeData"
                :key="item.id"
                :label="item.id"
                :value="item.id"
              >
                {{ item.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-scrollbar>
        </template>
        <template v-else>
          <div class="cost-workbench__project-header">成本分类</div>
          <el-input
            v-model="analysisCategoryKeyword"
            clearable
            placeholder="请输入分类名称"
          />
          <el-scrollbar class="cost-workbench__project-scroll">
            <el-tree
              ref="analysisCategoryTreeRef"
              v-loading="analysisLoading"
              :data="analysisCategoryTree"
              node-key="id"
              show-checkbox
              default-expand-all
              :default-checked-keys="selectedAnalysisCategoryIds"
              :filter-node-method="filterAnalysisCategoryNode"
              @check="handleAnalysisCategoryCheck"
            />
          </el-scrollbar>
        </template>
      </aside>

      <QueryTable
        v-if="workbenchType === 'bom-query'"
        ref="queryTableRef"
        :func="queryRows"
        row-key="rowKey"
        show-toolbar
        fit-table-height
        :table-props="{
          onSelectionChange: handleSelectionChange,
          scrollbarAlwaysOn: true,
        }"
        :empty-title="config.emptyTitle"
        :empty-description="config.emptyDescription"
        @reset="resetBomQueryRows"
      >
        <template #search>
          <el-form :model="query">
            <el-form-item label="整编编号">
              <el-input
                v-model="query.vehicleReorganizeCode"
                clearable
                placeholder="请输入整编编号"
                @keyup.enter="searchRows"
              />
            </el-form-item>
            <el-form-item label="整编名称">
              <el-input
                v-model="query.vehicleReorganizeName"
                clearable
                placeholder="请输入整编名称"
                @keyup.enter="searchRows"
              />
            </el-form-item>
            <el-form-item label="零件号">
              <el-input
                v-model="query.partNo"
                clearable
                placeholder="请输入零件号"
                @keyup.enter="searchRows"
              />
            </el-form-item>
            <el-form-item label="零件名称">
              <el-input
                v-model="query.partName"
                clearable
                placeholder="请输入零件名称"
                @keyup.enter="searchRows"
              />
            </el-form-item>
            <el-form-item label="项目代号">
              <el-input
                v-model="query.projectName"
                clearable
                placeholder="请输入项目代号"
                @keyup.enter="searchRows"
              />
            </el-form-item>
            <el-form-item label="创建时间">
              <el-date-picker
                v-model="query.updatedRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
              />
            </el-form-item>
          </el-form>
        </template>
            <!-- :permission="`${config.permissionPrefix}:export`" -->
        <template #toolbar>
          <PermissionButton
            variant="secondary"
            plain
            type="warning"
            :icon="Download"
            @click="handleExport()"
          >
            导出
          </PermissionButton>
          <span v-if="selectedCountText" class="cost-workbench__selection">
            {{ selectedCountText }}
          </span>
        </template>

        <el-table-column type="selection" width="48" fixed="left" />
        <el-table-column type="index" label="序号" width="70" fixed="left" />
        <el-table-column
          prop="projectName"
          label="项目代号"
          show-overflow-tooltip
        />
        <el-table-column
          prop="vehicleReorganizeCode"
          label="整编编号"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="vehicleReorganizeName"
          label="整编名称"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="partNo"
          label="零件号"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          prop="partName"
          label="零件名称"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          prop="quantity"
          label="单车用量"
          width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="unit"
          label="基本单位"
          width="100"
          show-overflow-tooltip
        />
        <el-table-column
          prop="firstVehicleModel"
          label="零件首用平台"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="sorName"
          label="SOR名称"
          width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="expertEngineer"
          label="责任工程师"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="suggestedSupplySource"
          label="建议货源"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="developmentDepartment"
          label="责任部门"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="generalizationLevel"
          label="通用化级别"
          width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="architectureComponent"
          label="是否架构件"
          width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="ecnProcessNum"
          label="ECN处理编号"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="partCategory"
          label="零件类别"
          width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="createdBy"
          label="创建人"
          width="100"
          show-overflow-tooltip
        />
        <el-table-column
          prop="createdAt"
          label="创建时间"
          width="180"
          show-overflow-tooltip
        />
      </QueryTable>

      <QueryTable
        v-else
        ref="queryTableRef"
        :func="queryRows"
        row-key="rowKey"
        fit-table-height
        :empty-title="config.emptyTitle"
        :empty-description="config.emptyDescription"
        :table-props="{ onSelectionChange: handleSelectionChange }"
        @search="handleQueryTableSearch"
        @reset="resetQuery"
      >
        <template #search>
          <el-form :model="query">
            <el-form-item label="项目">
              <el-select
                v-model="query.projectId"
                clearable
                filterable
                remote
                reserve-keyword
                :remote-method="searchProjects"
                :loading="projectLoading"
                :placeholder="
                  workbenchType === 'cost-analysis'
                    ? '请选择项目'
                    : '请输入项目代号'
                "
                @change="selectProject"
              >
                <el-option
                  v-for="item in projectSelectOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <template v-if="workbenchType !== 'cost-analysis'">
              <el-form-item label="关键词">
                <el-input
                  v-model="query.keyword"
                  clearable
                  placeholder="请输入项目、零件或供应商"
                  @keyup.enter="searchRows"
                />
              </el-form-item>
            </template>
            <el-form-item label="阀点">
              <el-select
                v-model="query.valvePoint"
                clearable
                filterable
                :loading="valveLoading"
                placeholder="请选择阀点"
                @change="handleAnalysisConditionChange"
              >
                <template v-if="workbenchType === 'cost-analysis'">
                  <el-option
                    v-for="valve in valveOptions"
                    :key="String(valve.valveId)"
                    :label="`${valve.valveName}（${valve.valveCode}）`"
                    :value="String(valve.valveId)"
                  />
                </template>
                <template v-else>
                  <el-option label="G6" value="G6" />
                  <el-option label="G8" value="G8" />
                  <el-option label="G9" value="G9" />
                </template>
              </el-select>
            </el-form-item>
            <template v-if="workbenchType !== 'cost-analysis'">
              <el-form-item
                :label="
                  workbenchType === 'research-history' ? '过阀状态' : '版本状态'
                "
              >
                <el-select
                  v-model="query.status"
                  clearable
                  placeholder="请选择过阀状态"
                >
                  <el-option
                    v-for="item in statusFilterOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item
                :label="
                  workbenchType === 'research-history' ? '创建时间' : '更新时间'
                "
              >
                <el-date-picker
                  v-model="query.updatedRange"
                  type="daterange"
                  value-format="YYYY-MM-DD"
                  start-placeholder="开始日期"
                  end-placeholder="结束日期"
                />
              </el-form-item>
            </template>
          </el-form>
        </template>

        <template #toolbar>
          <PermissionButton
            v-if="config.showImport"
            :permission="`${config.permissionPrefix}:import`"
            variant="secondary"
            type="success"
            :icon="Upload"
            @click="handleImport"
          >
            导入
          </PermissionButton>
          <PermissionButton
            v-if="config.showImport"
            :permission="deletePermission"
            variant="danger"
            type="danger"
            plain
            :icon="Delete"
            @click="deleteSelectedRows"
          >
            批量删除
          </PermissionButton>
          <PermissionButton
            v-if="config.showSync"
            :permission="`${config.permissionPrefix}:sync`"
            variant="secondary"
            type="primary"
            :icon="RefreshRight"
            @click="handleSync"
          >
            同步
          </PermissionButton>
          <PermissionButton
            :permission="`${config.permissionPrefix}:export`"
            variant="secondary"
            plain
            type="warning"
            :icon="Download"
            @click="handleExport()"
          >
            导出
          </PermissionButton>
          <span v-if="selectedCountText" class="cost-workbench__selection">
            {{ selectedCountText }}
          </span>
        </template>

        <template #toolbarExtra>
          <PermissionButton
            circle
            :icon="Search"
            aria-label="搜索"
            @click="searchRows"
          />
          <PermissionButton
            circle
            :icon="RefreshRight"
            aria-label="刷新"
            @click="refreshRows"
          />
        </template>

        <template
          v-if="workbenchType === 'cost-analysis'"
          #content="{ loading, height }"
        >
          <el-table
            v-loading="loading || analysisLoading"
            :data="analysisReportRows"
            :height="height"
            :cell-class-name="resolveAnalysisCellClass"
            :span-method="resolveAnalysisSpanMethod"
          >
            <el-table-column prop="groupName" label="" width="130" fixed="left">
              <template #default="{ row }">
                {{ row.groupName === "DELETE" ? "" : row.groupName }}
              </template>
            </el-table-column>
            <el-table-column
              prop="categoryName"
              label=""
              width="160"
              fixed="left"
            />
            <el-table-column label="当前成本" align="center">
              <el-table-column
                v-for="column in analysisReportColumns.filter(
                  (item) => item.group === 'current',
                )"
                :key="column.key"
                :label="column.label"
                min-width="150"
                align="right"
              >
                <template #default="{ row }">
                  {{ row.values[column.key] || "--" }}
                </template>
              </el-table-column>
            </el-table-column>
            <el-table-column label="目标成本" align="center">
              <el-table-column
                v-for="column in analysisReportColumns.filter(
                  (item) => item.group === 'target',
                )"
                :key="column.key"
                :label="column.label"
                min-width="150"
                align="right"
              >
                <template #default="{ row }">
                  {{ row.values[column.key] || "--" }}
                </template>
              </el-table-column>
            </el-table-column>
          </el-table>
        </template>

        <template v-if="workbenchType !== 'cost-analysis'">
          <el-table-column
            v-if="config.showImport"
            type="selection"
            width="48"
            fixed="left"
          />
          <el-table-column type="index" label="序号" width="70" fixed="left" />
          <el-table-column
            prop="projectName"
            label="项目代号"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="vehicleReorganizeCode"
            label="整编编号"
            width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="vehicleReorganizeName"
            label="整编名称"
            width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="partNo"
            label="零件号"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column
            prop="partName"
            label="零件名称"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column
            prop="quantity"
            label="单车用量"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="unit"
            label="基本单位"
            width="100"
            show-overflow-tooltip
          />
          <el-table-column
            prop="firstVehicleModel"
            label="零件首用平台"
            width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="sorName"
            label="SOR名称"
            width="180"
            show-overflow-tooltip
          />
          <el-table-column
            prop="expertEngineer"
            label="责任工程师"
            width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="suggestedSupplySource"
            label="建议货源"
            width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="developmentDepartment"
            label="责任部门"
            width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="generalizationLevel"
            label="通用化级别"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="architectureComponent"
            label="是否架构件"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="ecnProcessNum"
            label="ECN处理编号"
            width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="costCategoryLevel3Name"
            label="零件类别"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="operator"
            label="创建人"
            width="100"
            show-overflow-tooltip
          />
          <el-table-column
            prop="updatedAt"
            label="创建时间"
            width="180"
            show-overflow-tooltip
          />
          <el-table-column
            label="操作"
            min-width="300"
            fixed="right"
            align="center"
          >
            <template #default="{ row }">
              <PermissionButton
                :permission="viewPermission"
                link
                type="primary"
                @click="openDetail(row)"
              >
                查看
              </PermissionButton>
              <PermissionButton
                v-if="workbenchType !== 'research-history'"
                :permission="`${config.permissionPrefix}:export`"
                link
                type="warning"
                @click="handleExport(row)"
                :icon="Download"
              >
                导出
              </PermissionButton>
              <PermissionButton
                v-if="workbenchType === 'research-history'"
                :permission="`${config.permissionPrefix}:history`"
                link
                type="primary"
                @click="openVersionHistory(row)"
              >
                历史版本
              </PermissionButton>
              <PermissionButton
                v-if="workbenchType !== 'research-history'"
                :permission="`${config.permissionPrefix}:copy-valve`"
                link
                type="primary"
                @click="openCopyValveDialog(row)"
              >
                复制阀点
              </PermissionButton>
              <PermissionButton
                v-if="workbenchType === 'research-history'"
                :permission="`${config.permissionPrefix}:lock`"
                link
                :type="row.status === 'LOCKED' ? 'warning' : 'primary'"
                @click="handleRowCommand(row, 'lock')"
              >
                {{ row.status === "LOCKED" ? "解锁" : "锁定" }}
              </PermissionButton>
              <el-dropdown
                v-if="
                  workbenchType === 'research-history' &&
                  authStore.hasPermission(
                    `${config.permissionPrefix}:gate-action`,
                  ) &&
                  (row.rowType === 'VERSION' ||
                    row.rowType === 'PART' ||
                    row.rowType === 'GENERATED')
                "
                trigger="click"
                @command="handleRowCommand(row, String($event))"
              >
                <PermissionButton
                  :permission="`${config.permissionPrefix}:gate-action`"
                  link
                  type="primary"
                >
                  过阀
                </PermissionButton>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="allow"
                      >允许过阀</el-dropdown-item
                    >
                    <el-dropdown-item command="conditional"
                      >带条件过阀</el-dropdown-item
                    >
                    <el-dropdown-item command="deny"
                      >不允许过阀</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <PermissionButton
                v-if="
                  authStore.hasPermission(
                    deletePermission,
                  ) &&
                  (row.rowType === 'VERSION' ||
                    row.rowType === 'PART' ||
                    row.rowType === 'GENERATED')
                "
                :permission="deletePermission"
                link
                @click="handleRowCommand(row, 'delete')"
              >
                删除
              </PermissionButton>
            </template>
          </el-table-column>
        </template>
      </QueryTable>
    </div>

    <BaseFormDialog
      v-model="detailVisible"
      :title="`${config.title}详情`"
      :width="workbenchType === 'research-history' ? '1280px' : '680px'"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
    >
      <template v-if="workbenchType === 'research-history'">
        <div class="cost-workbench-detail">
          <div class="cost-workbench-detail__conditions">
            <div
              v-for="(condition, index) in detailConditions"
              :key="index"
              class="cost-workbench-detail__condition"
              :class="{
                'cost-workbench-detail__condition--first': index === 0,
              }"
            >
              <el-select v-if="index > 0" v-model="condition.logic" clearable>
                <el-option label="并且" value="AND" />
                <el-option label="或者" value="OR" />
              </el-select>
              <el-input
                v-model="condition.moduleName"
                clearable
                placeholder="模块名称"
              />
              <el-select
                v-model="condition.attributeName"
                filterable
                placeholder="属性名称"
              >
                <el-option label="零件号" value="partNo" />
                <el-option label="零件名称" value="partName" />
                <el-option label="供应商名称" value="supplierName" />
                <el-option label="目标成本" value="targetCostAmount" />
                <el-option label="评估成本" value="estimatedCostAmount" />
                <el-option label="当前成本" value="currentCostAmount" />
                <el-option
                  label="成本二级分类"
                  value="costCategoryLevel2Name"
                />
                <el-option
                  label="成本三级分类"
                  value="costCategoryLevel3Name"
                />
              </el-select>
              <el-select v-model="condition.operator" clearable>
                <el-option label="包含" value="like" />
                <el-option label="等于" value="eq" />
                <el-option label="大于" value="gt" />
                <el-option label="小于" value="lt" />
                <el-option label="为空" value="isNull" />
                <el-option label="不为空" value="isNotNull" />
              </el-select>
              <el-input
                v-model="condition.value"
                clearable
                :disabled="nullOperators.has(condition.operator)"
                placeholder="属性值"
                @keyup.enter="loadHistoryDetailParts"
              />
              <el-tooltip v-if="index === 0" content="添加条件" placement="top">
                <PermissionButton
                  class="cost-workbench-detail__condition-icon is-add"
                  circle
                  plain
                  type="primary"
                  :icon="Plus"
                  @click="addDetailCondition"
                />
              </el-tooltip>
              <template v-if="index === 0">
                <PermissionButton type="primary" @click="loadHistoryDetailParts"
                  >查询</PermissionButton
                >
                <PermissionButton :icon="RefreshRight" @click="resetDetailConditions"
                  >重置</PermissionButton
                >
              </template>
              <el-tooltip v-else content="删除条件" placement="top">
                <PermissionButton
                  class="cost-workbench-detail__condition-icon is-delete"
                  circle
                  plain
                  type="danger"
                  :icon="Minus"
                  @click="removeDetailCondition(index)"
                />
              </el-tooltip>
            </div>
          </div>
          <div class="cost-workbench-detail__toolbar">
            <PermissionButton
              :permission="`${config.permissionPrefix}:create`"
              variant="primary"
              type="primary"
              plain
              :icon="CirclePlus"
              @click="openPartEditor('add')"
            >
              新增
            </PermissionButton>
            <PermissionButton
              :permission="`${config.permissionPrefix}:export`"
              variant="secondary"
              plain
              @click="exportHistoryDetailParts"
              type="warning"
              :icon="Download"
            >
              导出
            </PermissionButton>
            <PermissionButton
              :permission="`${config.permissionPrefix}:calculate`"
              variant="secondary"
              type="primary"
              plain
              :icon="Operation"
              @click="calculateHistoryDetailParts"
            >
              计算
            </PermissionButton>
            <PermissionButton
              :permission="`${config.permissionPrefix}:copy-valve`"
              variant="secondary"
              type="primary"
              plain
              :icon="CopyDocument"
              @click="copyHistoryDetailValveData"
            >
              阀点复制
            </PermissionButton>
            <PermissionButton
                permission="costmanage:check:save"
              variant="secondary"
              type="success"
              plain
              :icon="CircleCheck"
              @click="saveHistoryDetailAsNewVersion"
            >
              保存新版本
            </PermissionButton>
            <PermissionButton
              :permission="deletePermission"
              variant="danger"
              type="danger"
              plain
              @click="deleteSelectedHistoryParts"
            >
              批量删除
            </PermissionButton>
          </div>
        </div>
        <el-table
          :data="detailParts"
          border
          height="420"
          @selection-change="handleDetailSelectionChange"
        >
          <el-table-column type="selection" width="48" fixed="left" />
          <el-table-column prop="partNo" label="零件号" min-width="150" />
          <el-table-column prop="partName" label="零件名称" min-width="180" />
          <el-table-column
            prop="moduleIdentifier"
            label="模块名称"
            min-width="140"
          />
          <el-table-column
            prop="supplierName"
            label="供应商名称"
            min-width="160"
          />
          <el-table-column
            prop="quantity"
            label="数量"
            width="100"
            align="right"
          />
          <el-table-column prop="unit" label="单位" width="90" />
          <el-table-column
            prop="targetCostAmount"
            label="目标成本"
            min-width="120"
            align="right"
          />
          <el-table-column
            prop="estimatedCostAmount"
            label="评估成本"
            min-width="120"
            align="right"
          />
          <el-table-column
            prop="currentCostAmount"
            label="当前成本"
            min-width="120"
            align="right"
          />
          <el-table-column
            prop="costCategoryLevel2Name"
            label="成本二级分类"
            min-width="150"
          />
          <el-table-column
            prop="costCategoryLevel3Name"
            label="成本三级分类"
            min-width="150"
          />
          <el-table-column
            label="操作"
            width="180"
            fixed="right"
            align="center"
          >
            <template #default="{ row }">
              <PermissionButton
                link
                type="primary"
                :permission="`${config.permissionPrefix}:edit`"
                @click="openPartEditor('edit', row)"
              >
                编辑
              </PermissionButton>
              <PermissionButton
                link
                type="primary"
                :permission="`${config.permissionPrefix}:history`"
                @click="openPartHistory(row)"
              >
                历史版本
              </PermissionButton>
              <PermissionButton
                link
                type="primary"
                :permission="`${config.permissionPrefix}:copy`"
                @click="openPartEditor('copy', row)"
              >
                复制
              </PermissionButton>
            </template>
          </el-table-column>
        </el-table>
      </template>
      <el-descriptions v-else-if="activeRow" :column="2" border>
        <el-descriptions-item label="项目代号">
          {{ activeRow.projectName }}
        </el-descriptions-item>
        <el-descriptions-item label="项目代号">
          {{ activeRow.projectCode }}
        </el-descriptions-item>
        <el-descriptions-item label="车型">
          {{ activeRow.vehicleModel }}
        </el-descriptions-item>
        <el-descriptions-item label="阀点">
          {{ activeRow.valvePoint }}
        </el-descriptions-item>
        <el-descriptions-item label="BOM版本">
          {{ activeRow.bomVersion }}
        </el-descriptions-item>
        <el-descriptions-item label="零件号">
          {{ activeRow.partNo }}
        </el-descriptions-item>
        <el-descriptions-item label="零件名称">
          {{ activeRow.partName }}
        </el-descriptions-item>
        <el-descriptions-item label="供应商名称">
          {{ activeRow.supplierName }}
        </el-descriptions-item>
        <el-descriptions-item label="成本金额">
          {{ formatCell(activeRow, "costAmount") }}
        </el-descriptions-item>
        <el-descriptions-item label="降本金额">
          {{ formatCell(activeRow, "reductionAmount") }}
        </el-descriptions-item>
        <el-descriptions-item label="降本率">
          {{ formatCell(activeRow, "reductionRate") }}
        </el-descriptions-item>
        <el-descriptions-item label="版本状态">
          {{ resolveStatusLabel(activeRow.status) }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ activeRow.updatedAt }}
        </el-descriptions-item>
        <el-descriptions-item label="操作人">
          {{ activeRow.operator }}
        </el-descriptions-item>
      </el-descriptions>
      <el-table
        v-if="dashboardPatternSummaries.length"
        :data="dashboardPatternSummaries"
        size="small"
        style="margin-top: 16px"
      >
        <el-table-column prop="patternCode" label="版型编码" min-width="120" />
        <el-table-column prop="patternName" label="版型名称" min-width="140" />
        <el-table-column label="阀点数" width="100" align="right">
          <template #default="{ row }">
            {{ row.valves.length }}
          </template>
        </el-table-column>
      </el-table>
      <el-table
        v-if="dashboardPatternDetails.length"
        :data="dashboardPatternDetails"
        size="small"
        style="margin-top: 12px"
      >
        <el-table-column prop="patternCode" label="版型编码" min-width="120" />
        <el-table-column prop="patternName" label="版型名称" min-width="140" />
        <el-table-column
          prop="targetCostAmount"
          label="目标成本"
          min-width="120"
          align="right"
        />
        <el-table-column
          prop="currentCostAmount"
          label="当前成本"
          min-width="120"
          align="right"
        />
        <el-table-column
          prop="partCount"
          label="行数"
          width="90"
          align="right"
        />
      </el-table>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="versionHistoryVisible"
      title="历史版本"
      width="920px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
    >
      <div class="cost-workbench-detail__toolbar">
          <PermissionButton
            :permission="`${config.permissionPrefix}:compare`"
            variant="primary"
            type="primary"
          :disabled="selectedHistoryVersions.length !== 2"
          @click="compareHistoryVersions"
        >
          对比
        </PermissionButton>
      </div>
      <el-table
        :data="versionHistoryRows"
        border
        height="360"
        @selection-change="handleHistoryVersionSelection"
      >
        <el-table-column type="selection" width="48" fixed="left" />
        <el-table-column prop="versionId" label="版本ID" min-width="140" />
        <el-table-column label="BOM版本" width="110">
          <template #default="{ row }">V{{ row.versionNo }}</template>
        </el-table-column>
        <el-table-column prop="status" label="版本状态" min-width="120" />
        <el-table-column
          prop="partCount"
          label="零件数"
          width="100"
          align="right"
        />
        <el-table-column
          prop="totalCurrentCostAmount"
          label="当前成本合计"
          min-width="150"
          align="right"
        />
        <el-table-column prop="submittedAt" label="提交时间" min-width="170" />
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <PermissionButton
              link
              type="primary"
              :permission="`${config.permissionPrefix}:list`"
              @click="viewHistoryVersion(row)"
            >
              查看
            </PermissionButton>
          </template>
        </el-table-column>
      </el-table>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="versionCompareVisible"
      title="版本对比"
      width="860px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
    >
      <el-table :data="versionCompareRows" border height="360">
        <el-table-column prop="partNo" label="零件号" min-width="150" />
        <el-table-column prop="partName" label="零件名称" min-width="180" />
        <el-table-column
          prop="baseCost"
          label="基准版本当前成本"
          min-width="150"
          align="right"
        />
        <el-table-column
          prop="targetCost"
          label="目标版本当前成本"
          min-width="150"
          align="right"
        />
        <el-table-column
          prop="diff"
          label="差异"
          min-width="120"
          align="right"
        />
      </el-table>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="partEditorVisible"
      :title="
        partEditMode === 'add'
          ? '新增零件'
          : partEditMode === 'edit'
            ? '编辑零件'
            : '复制零件'
      "
      width="760px"
      confirm-text="保存"
      cancel-text="取消"
      @confirm="savePartEditor"
    >
      <el-form :model="partForm" label-width="116px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="零件号" required>
              <el-input v-model="partForm.partNo" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="零件名称" required>
              <el-input v-model="partForm.partName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模块名称">
              <el-input v-model="partForm.moduleIdentifier" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商名称">
              <el-input v-model="partForm.supplierName" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数量">
              <el-input v-model="partForm.quantity" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单位">
              <el-input v-model="partForm.unit" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标成本">
              <el-input v-model="partForm.targetCostAmount" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="评估成本">
              <el-input v-model="partForm.estimatedCostAmount" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="当前成本">
              <el-input v-model="partForm.currentCostAmount" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="通用化级别">
              <el-input v-model="partForm.generalizationLevel" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否架构件">
              <el-select v-model="partForm.architectureComponent" clearable>
                <el-option label="是" value="是" />
                <el-option label="否" value="否" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="成本二级分类">
              <el-input v-model="partForm.costCategoryLevel2Name" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="成本三级分类">
              <el-input v-model="partForm.costCategoryLevel3Name" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="partForm.summaryRemark"
                type="textarea"
                :rows="3"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="partHistoryVisible"
      title="零件历史版本"
      width="980px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
    >
      <el-table :data="activePart ? [activePart] : []" border height="260">
        <el-table-column label="基础信息" align="center">
          <el-table-column prop="partNo" label="零件号" min-width="150" />
          <el-table-column prop="partName" label="零件名称" min-width="180" />
          <el-table-column
            prop="moduleIdentifier"
            label="模块名称"
            min-width="140"
          />
        </el-table-column>
        <el-table-column label="成本信息" align="center">
          <el-table-column
            prop="targetCostAmount"
            label="目标成本"
            min-width="120"
            align="right"
          />
          <el-table-column
            prop="estimatedCostAmount"
            label="评估成本"
            min-width="120"
            align="right"
          />
          <el-table-column
            prop="currentCostAmount"
            label="当前成本"
            min-width="120"
            align="right"
          />
        </el-table-column>
        <el-table-column label="分类信息" align="center">
          <el-table-column
            prop="costCategoryLevel2Name"
            label="成本二级分类"
            min-width="150"
          />
          <el-table-column
            prop="costCategoryLevel3Name"
            label="成本三级分类"
            min-width="150"
          />
        </el-table-column>
      </el-table>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="copyValveVisible"
      title="复制阀点数据"
      width="560px"
      confirm-text="复制"
      cancel-text="取消"
      @confirm="confirmCopyValveData"
    >
      <el-form :model="copyValveForm" label-width="128px">
        <el-form-item label="目标版本">
          <el-input
            :model-value="String(resolveRowCostBomVersionId(activeRow) ?? '')"
            disabled
          />
        </el-form-item>
        <el-form-item label="源阀点" required>
          <el-select
            v-model="copyValveForm.sourceValveId"
            placeholder="请选择源阀点"
            clearable
          >
            <el-option
              v-for="valve in valveOptions"
              :key="String(valve.valveId)"
              :label="`${valve.valveName}（${valve.valveCode}）`"
              :value="String(valve.valveId)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标阀点" required>
          <el-select
            v-model="copyValveForm.targetValveId"
            placeholder="请选择目标阀点"
            clearable
          >
            <el-option
              v-for="valve in valveOptions"
              :key="String(valve.valveId)"
              :label="`${valve.valveName}（${valve.valveCode}）`"
              :value="String(valve.valveId)"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="supplyRatioVisible"
      :title="
        supplyRatioDetail ? `${supplyRatioDetail.partNo}供货比例` : '供货比例'
      "
      width="720px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
    >
      <el-descriptions v-if="supplyRatioDetail" :column="3" border>
        <el-descriptions-item label="零件号">
          {{ supplyRatioDetail.partNo }}
        </el-descriptions-item>
        <el-descriptions-item label="比例合计">
          {{ supplyRatioDetail.ratioTotal }}
        </el-descriptions-item>
        <el-descriptions-item label="是否完整">
          {{ supplyRatioDetail.complete ? "是" : "否" }}
        </el-descriptions-item>
      </el-descriptions>
      <el-table
        class="cost-workbench__supply-ratio-table"
        :data="supplyRatioDetail?.suppliers ?? []"
        border
        max-height="320"
      >
        <el-table-column
          prop="supplierCode"
          label="供应商编码"
          min-width="140"
        />
        <el-table-column
          prop="supplierName"
          label="供应商名称"
          min-width="180"
        />
        <el-table-column
          prop="supplierRatio"
          label="供货比例"
          min-width="120"
          align="right"
        />
        <el-table-column prop="transmitAt" label="同步时间" min-width="160" />
      </el-table>
    </BaseFormDialog>

    <BaseImportDialog
      v-model="importDialogVisible"
      module-name="成本历史"
      :loading="importLoading"
      :max-size-mb="20"
      template-text="下载导入模板"
      template-description="请按照要求导入成本历史标准 Excel 文件"
      upload-tip="只能上传 xlsx 格式文件，且不超过 20MB"
      @import="handleHistoryImport"
      @download-template="downloadCostBomImportTemplate"
    />

    <BaseConfirm
      v-model="deleteConfirmVisible"
      title="删除成本BOM"
      type="danger"
      confirm-text="删除"
      cancel-text="取消"
      :message="deleteConfirmMessage"
      @confirm="confirmDeleteRow"
      @cancel="pendingDeleteRow = null"
    />
    <TaskStatusPanel
      v-if="false"
      :task-id="latestTaskId"
      :download-file-name="latestTaskFileName"
    />
  </PageContainer>
</template>

<style scoped>
:global(.cost-workbench-page--fixed.page-container) {
  display: flex;
  flex-direction: column;
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height) - 40px
  );
  min-height: 0;
  overflow: hidden;
}

:global(.cost-workbench-page--fixed.page-container .page-container__body) {
  display: block;
  flex: 1;
  min-height: 0;
}

.cost-workbench {
  min-width: 0;
}

.cost-workbench--bom-query,
.cost-workbench--analysis {
  display: grid;
  gap: 12px;
  align-items: stretch;
  min-height: 0;
}

.cost-workbench--analysis {
  grid-template-columns: 220px minmax(0, 1fr);
}

.cost-workbench--bom-query {
  grid-template-columns: 280px minmax(0, 1fr);
  height: 100%;
  overflow: hidden;
}

.cost-workbench--bom-query :deep(.query-table) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.cost-workbench--bom-query :deep(.query-table__table) {
  flex: 1;
  min-height: 0;
}

.cost-workbench__project-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 520px;
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color);
}

.cost-workbench--bom-query .cost-workbench__project-pane {
  height: 100%;
  min-height: 0;
  padding: 12px 10px;
  overflow: hidden;
}

.cost-workbench__project-header {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.cost-workbench__project-scroll {
  flex: 1;
  min-height: 0;
}

.cost-workbench__project-scroll :deep(.el-tree-node__label),
.cost-workbench__project-checks :deep(.el-checkbox__label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-workbench__project-checks {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cost-workbench--bom-query .cost-workbench__project-all-check {
  display: flex;
  align-items: center;
  width: 100%;
  height: 32px;
  margin-right: 0;
  padding: 0 6px;
  border-radius: 4px;
}

.cost-workbench--bom-query .cost-workbench__project-all-check:hover {
  background: var(--el-color-primary-light-9);
}

.cost-workbench__project-checks :deep(.el-checkbox) {
  display: flex;
  align-items: center;
  width: 100%;
  height: 32px;
  margin-right: 0;
  padding: 0 6px;
  border-radius: 4px;
}

.cost-workbench__project-checks :deep(.el-checkbox:hover) {
  background: var(--el-color-primary-light-9);
}

.cost-workbench__project-checks :deep(.el-checkbox__label) {
  min-width: 0;
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.cost-workbench__selection {
  color: var(--bq-color-text-muted);
  font-size: 14px;
  line-height: 24px;
}

.cost-workbench-detail__conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cost-workbench-detail__condition {
  display: grid;
  grid-template-columns:
    84px minmax(120px, 1fr) 160px 112px minmax(160px, 1.2fr)
    48px;
  gap: 8px;
  align-items: center;
}

.cost-workbench-detail__condition--first {
  grid-template-columns:
    minmax(120px, 1fr) 160px 112px minmax(160px, 1.2fr)
    32px auto auto;
}

.cost-workbench-detail__actions,
.cost-workbench-detail__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.cost-workbench-detail__condition-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
}

@media (max-width: 960px) {
  .cost-workbench--bom-query,
  .cost-workbench--analysis {
    grid-template-columns: 1fr;
  }

  .cost-workbench__project-pane {
    min-height: 260px;
  }

  .cost-workbench-detail__condition {
    grid-template-columns: 1fr;
  }
}
</style>
