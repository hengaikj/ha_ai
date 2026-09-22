<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { CirclePlus } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  createBusinessProject,
  // createBusinessProjectExportTask,
  deleteBusinessProject,
  disableBusinessProject,
  enableBusinessProject,
  fetchAllVehicleModels,
  fetchAvailableVehicleModels,
  fetchBusinessFactories,
  fetchBusinessProjectCompetitors,
  fetchBusinessProjectDetail,
  fetchBusinessProjectValves,
  fetchBusinessProjects,
  fetchBusinessValves,
  fetchChangeStatus,
} from "@/api/project";
import { fetchCostBomPatterns } from "@/api/cost-center";
import { fetchInformationDictionaryItems } from "@/api/information";
import { fetchPlatformDictItems } from "@/api/platform-system";
import { updateBusinessProject } from "@/api/project";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseInfiniteSelect, {
  type ValueType,
} from "@/components/base/BaseInfiniteSelect.vue";
import BaseTableOverflowPopover from "@/components/base/BaseTableOverflowPopover.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { resolvePageTotal } from "@/utils/pagination";
import type { CostBomPatternItem } from "@/types/cost-center";
import type { InformationDictionaryItem } from "@/types/information";
import type {
  BusinessFactoryItem,
  BusinessProjectItem,
  BusinessValveItem,
  VehicleModelItem,
} from "@/types/project";
import type { PlatformDictItem, PlatformStatus } from "@/types/platform-system";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type PatternId = number | string;

type ProjectForm = {
  projectId?: number;
  projectCode: string;
  projectName: string;
  wbsNumber: string;
  vehicleModelId?: number;
  vehicleModelCode: string;
  vehicleModelName: string;
  budgetPatternId?: PatternId;
  budgetPatternIds: PatternId[];
  budgetPatternName: string;
  costRevenuePatternId?: PatternId;
  costRevenuePatternIds: PatternId[];
  costRevenuePatternName: string;
  company: string;
  factory: string;
  competitor: string;
  competitorIds: number[];
  budgetDashboardStatus: string;
  revenueDashboardStatus: string;
  costDashboardStatus: string;
  legacyProjectNo: string;
  valvePlans: Array<{
    projectValveId?: number;
    valveId: number | null;
    plannedPassTime: string;
    actualValvePassageTime: string;
    version?: number;
  }>;
  budgetLocked: boolean;
  evaluateLocked: boolean;
  status: PlatformStatus;
  remark: string;
  version?: number;
};

type DashboardStatusField =
    | "budgetDashboardStatus"
    | "revenueDashboardStatus"
    | "costDashboardStatus";

const dashboardStatusColumns: Array<{
  field: DashboardStatusField;
  label: string;
}> = [
  { field: "budgetDashboardStatus", label: "预算看板" },
  { field: "revenueDashboardStatus", label: "收益看板" },
  { field: "costDashboardStatus", label: "成本看板" },
];

const queryTableRef = ref<QueryTableExpose | null>(null);
const formRef = ref<FormInstance>();
const query = reactive({
  code: "",
  name: "",
  wbsNumber: "",
  factory: "",
  company: "",
  createdAtRange: [] as string[] | null,
  status: "" as PlatformStatus | "",
});
const form = reactive<ProjectForm>(emptyForm());
const formVisible = ref(false);
const confirmVisible = ref(false);
const deleteConfirmVisible = ref(false);
const pendingStatusRow = ref<BusinessProjectItem | null>(null);
const pendingDeleteRows = ref<BusinessProjectItem[]>([]);
const selectedRows = ref<BusinessProjectItem[]>([]);
const vehicleOptions = ref<VehicleModelItem[]>([]);
const valveOptions = ref<BusinessValveItem[]>([]);
const patternOptions = ref<CostBomPatternItem[]>([]);
const competitorOptions = ref<InformationDictionaryItem[]>([]);
const factoryOptions = ref<BusinessFactoryItem[]>([]);
const companyOptions = ref<PlatformDictItem[]>([]);
const initialVehicleOption = ref<VehicleModelItem | VehicleModelItem[] | null>(null);
const initialBudgetPatternOptions = ref<CostBomPatternItem[]>([]);
const initialCostRevenuePatternOptions = ref<CostBomPatternItem[]>([]);
const initialCompetitorOptions = ref<InformationDictionaryItem[]>([]);
const allVehicleOptions = ref<VehicleModelItem[]>([]);
const companyQueryValue = computed(
    () =>
        companyOptions.value.find(
            (company) => String(company.value) === String(query.company),
        )?.label || query.company,
);
const formOptionsLoading = ref(false);
const formLoading = ref(false);
const savingProject = ref(false);
const deletingProject = ref(false);
// const exportLoading = ref(false);

const editing = computed(() => Boolean(form.projectId));
const formTitle = computed(() => (editing.value ? "编辑项目" : "新增项目"));
const projectNameDisabled = computed(
    () => editing.value || Boolean(form.vehicleModelId),
);
const formRules: FormRules<ProjectForm> = {
  projectName: [
    { required: true, message: "请输入项目代号", trigger: "blur" },
    { whitespace: true, message: "项目代号不能为空", trigger: "blur" },
  ],
  vehicleModelId: [
    {
      required: true,
      validator: (
          _rule: unknown,
          value: unknown,
          callback: (error?: Error) => void,
      ) => {
        if (!Number(value)) {
          callback(new Error("请选择车型"));
          return;
        }
        callback();
      },
      trigger: "change",
    },
  ],
  budgetPatternIds: [
    { required: true, message: "请选择预算版型", trigger: "change" },
  ],
  costRevenuePatternIds: [
    { required: true, message: "请选择成本收益版型", trigger: "change" },
  ],
  factory: [{ required: true, message: "请选择工厂", trigger: "change" }],
  valvePlans: [
    {
      validator: (
          _rule: unknown,
          value: unknown,
          callback: (error?: Error) => void,
      ) => {
        const plans = Array.isArray(value) ? value : [];
        if (!plans.length) {
          callback(new Error("请选择阀点"));
          return;
        }
        if (
            plans.some(
                (item) =>
                    !Number((item as { valveId?: number | null }).valveId) ||
                    !String(
                        (item as { plannedPassTime?: string }).plannedPassTime ?? "",
                    ).trim(),
            )
        ) {
          callback(new Error("请选择阀点并填写计划过阀时间"));
          return;
        }
        const valveIds = plans.map((item) =>
            String((item as { valveId: number }).valveId),
        );
        if (new Set(valveIds).size !== valveIds.length) {
          callback(new Error("同一项目不能选择相同阀点"));
          return;
        }
        callback();
      },
      trigger: "change",
    },
  ],
};
const statusConfirmContent = computed(() => {
  const row = pendingStatusRow.value;
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: row.status === "ENABLED" ? "disable" : "enable",
    object: "项目",
    name: row.projectName,
  });
});
const deleteConfirmContent = computed(() => {
  if (pendingDeleteRows.value.length > 1) {
    return buildBaseConfirmContent({
      scene: "batchDelete",
      object: "项目",
      count: pendingDeleteRows.value.length,
    });
  }
  const row = pendingDeleteRows.value[0];
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "delete",
    object: "项目",
    name: row.projectName,
  });
});

async function queryProjects(pageSize: number, pageNo: number) {
  const [startTime, endTime] = Array.isArray(query.createdAtRange)
      ? query.createdAtRange
      : [];
  const page = await fetchBusinessProjects({
    pageNo,
    pageSize,
    code: query.code || undefined,
    name: query.name || undefined,
    projectName: query.name || undefined,
    wbsNumber: query.wbsNumber || undefined,
    factoryName: query.factory || undefined,
    company: companyQueryValue.value || undefined,
    startTime: startTime ? `${startTime} 00:00:00` : undefined,
    endTime: endTime ? `${endTime} 23:59:59` : undefined,
    status: query.status || undefined,
  });
  return {
    total: resolvePageTotal(page, pageNo, pageSize),
    list: page.records,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function emptyForm(): ProjectForm {
  return {
    projectCode: "",
    projectName: "",
    wbsNumber: "",
    vehicleModelId: undefined,
    vehicleModelCode: "",
    vehicleModelName: "",
    budgetPatternId: undefined,
    budgetPatternIds: [],
    budgetPatternName: "",
    costRevenuePatternId: undefined,
    costRevenuePatternIds: [],
    costRevenuePatternName: "",
    company: "",
    factory: "",
    competitor: "",
    competitorIds: [],
    budgetDashboardStatus: "DISABLED",
    revenueDashboardStatus: "DISABLED",
    costDashboardStatus: "DISABLED",
    legacyProjectNo: "",
    valvePlans: [],
    budgetLocked: false,
    evaluateLocked: false,
    status: "ENABLED",
    remark: "",
  };
}

function normalizeDashboardStatus(value?: string | null) {
  const normalized = String(value ?? "")
      .trim()
      .toUpperCase();
  return ["1", "TRUE", "Y", "YES", "ON", "OPEN", "ENABLE", "ENABLED"].includes(
      normalized,
  )
      ? "ENABLED"
      : "DISABLED";
}

function isDashboardStatusEnabled(value?: string | null) {
  return normalizeDashboardStatus(value) === "ENABLED";
}

function setFormDashboardStatus(field: DashboardStatusField, enabled: boolean) {
  form[field] = enabled ? "ENABLED" : "DISABLED";
}

function resetQuery() {
  query.code = "";
  query.name = "";
  query.wbsNumber = "";
  query.factory = "";
  query.company = "";
  query.createdAtRange = [];
  query.status = "";
}

function searchProjects() {
  queryTableRef.value?.search();
}

// async function exportProjects() {
//   const [startTime, endTime] = Array.isArray(query.createdAtRange)
//       ? query.createdAtRange
//       : [];
//   exportLoading.value = true;
//   try {
//     const task = await createBusinessProjectExportTask({
//       code: query.code || undefined,
//       name: query.name || undefined,
//       wbsNumber: query.wbsNumber || undefined,
//       factoryName: query.factory || undefined,
//       company: companyQueryValue.value || undefined,
//       startTime: startTime ? `${startTime} 00:00:00` : undefined,
//       endTime: endTime ? `${endTime} 23:59:59` : undefined,
//       status: query.status || undefined,
//     });
//     BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
//   } finally {
//     exportLoading.value = false;
//   }
// }

function displayProjectName(row: BusinessProjectItem) {
  return row.vehicleModelName || row.projectName || "--";
}

function displayFactoryName(row: BusinessProjectItem) {
  const factory = String(row.wbsNumber ?? "").trim();
  if (!factory) {
    return "--";
  }
  return (
      factoryOptions.value.find(
          (item) => item.factoryCode === factory || item.factoryName === factory,
      )?.factoryName || factory
  );
}

function normalizeFactoryList(
  response: Awaited<ReturnType<typeof fetchBusinessFactories>>,
) {
  const records = Array.isArray(response) ? response : response?.records ?? [];
  return records.filter((item) => item.status !== "DISABLED");
}

async function loadFactoryOptions() {
  try {
    const factories = await fetchBusinessFactories({
      pageNo: 1,
      pageSize: 10,
      status: "ENABLED",
    });
    factoryOptions.value = normalizeFactoryList(factories);
  } catch {
    // The project list remains usable when the optional factory dictionary is unavailable.
  }
}

async function loadCompanyOptions() {
  try {
    companyOptions.value = await fetchPlatformDictItems("company_list_set");
  } catch {
    companyOptions.value = [];
  }
}

function ensureFactoryOption(factoryName: string) {
  const name = factoryName.trim();
  if (
      !name ||
      factoryOptions.value.some(
          (item) => item.factoryName === name || item.factoryCode === name,
      )
  ) {
    return;
  }
  factoryOptions.value.push({ factoryCode: null, factoryName: name });
}

function resolveFactoryCode(factoryValue?: string | null) {
  const value = factoryValue?.trim() || "";
  if (!value) {
    return "";
  }
  return (
    factoryOptions.value.find(
      (item) => item.factoryName === value || item.factoryCode === value,
    )?.factoryCode || value
  );
}

async function fetchFactorySelectPage({
  pageNo,
  pageSize,
  keyword,
}: {
  pageNo: number;
  pageSize: number;
  keyword: string;
}) {
  const kw = keyword.trim();
  const params: Parameters<typeof fetchBusinessFactories>[0] = {
    pageNo,
    pageSize,
    status: "ENABLED",
  };
  if (kw) {
    if (/[\u4e00-\u9fa5]/.test(kw)) {
      params.factoryName = kw;
    } else {
      params.factoryCode = kw;
    }
  }
  const res = await fetchBusinessFactories(params);
  return {
    records: normalizeFactoryList(res),
    total: res.total,
  };
}

function formatFactoryLabel(factory: BusinessFactoryItem) {
  const name = factory.factoryName?.trim() || "";
  const code = factory.factoryCode?.trim() || "";
  if (!name && !code) return "";
  // 若编码与名称相同，或只存在一项，直接展示单个名称，避免出现 XX/XX 重复
  if (!code || name === code) return name || code;
  if (!name) return code;
  return `${name}/${code}`;
}


function handleFactorySelectChange(
  _value: string | number | (string | number)[] | null | undefined,
  row?: BusinessFactoryItem | BusinessFactoryItem[] | null,
) {
  const factoryRow = Array.isArray(row) ? row[0] : row;
  if (factoryRow?.factoryName) {
    ensureFactoryOption(factoryRow.factoryName);
  }
}

async function fetchVehicleSelectPage({
  pageNo,
  pageSize,
  keyword,
}: {
  pageNo: number;
  pageSize: number;
  keyword: string;
}) {
  const kw = keyword.trim().toLowerCase();
  let list = allVehicleOptions.value;
  if (!list.length) {
    list = editing.value
      ? await fetchAllVehicleModels()
      : await fetchAvailableVehicleModels();
    allVehicleOptions.value = list;
  }
  if (kw) {
    list = list.filter(
      (item) =>
        item.vehicleModelName?.toLowerCase().includes(kw) ||
        item.vehicleModelCode?.toLowerCase().includes(kw),
    );
  }
  const total = list.length;
  const start = (pageNo - 1) * pageSize;
  const records = list.slice(start, start + pageSize);
  records.forEach((v) => {
    if (!vehicleOptions.value.some((item) => item.vehicleModelId === v.vehicleModelId)) {
      vehicleOptions.value.push(v);
    }
  });
  return {
    records,
    total,
  };
}

function formatVehicleLabel(vehicle: VehicleModelItem) {
  return vehicle.vehicleModelName || vehicle.vehicleModelCode || "";
}

function handleVehicleSelectChange(
  value: ValueType | ValueType[] | null | undefined,
  row?: VehicleModelItem | VehicleModelItem[] | null,
) {
  const vehicleRow = Array.isArray(row) ? row[0] : row;
  const vehicleModelId = value ? Number(value) : undefined;
  form.vehicleModelId = vehicleModelId;
  const vehicle =
    vehicleRow ||
    vehicleOptions.value.find(
      (item) => Number(item.vehicleModelId) === Number(vehicleModelId),
    ) ||
    allVehicleOptions.value.find(
      (item) => Number(item.vehicleModelId) === Number(vehicleModelId),
    );
  form.vehicleModelCode = vehicle?.vehicleModelCode ?? "";
  form.vehicleModelName = vehicle?.vehicleModelName ?? "";
  if (vehicle?.vehicleModelName) {
    form.projectName = vehicle.vehicleModelName;
  }
  form.company = vehicle?.company ?? "";
  nextTick(() => {
    formRef.value?.validateField("vehicleModelId");
    formRef.value?.validateField("projectName");
  });
}

async function fetchPatternSelectPage({
  pageNo,
  pageSize,
  keyword,
}: {
  pageNo: number;
  pageSize: number;
  keyword: string;
}) {
  const kw = keyword.trim();
  const res = await fetchCostBomPatterns({
    pageNo,
    pageSize,
    keyword: kw || undefined,
    patternName: kw || undefined,
    status: "ENABLED",
  });
  const records = Array.isArray(res) ? res : res.records || [];
  records.forEach((pattern) => {
    if (!patternOptions.value.some((p) => String(p.patternId) === String(pattern.patternId))) {
      patternOptions.value.push(pattern);
    }
  });
  return {
    records,
    total: Array.isArray(res) ? records.length : res.total,
  };
}

function formatPatternLabel(pattern: CostBomPatternItem) {
  return pattern.patternName || String(pattern.patternId || "");
}

function handleBudgetPatternSelectChange(
  value: ValueType | ValueType[] | null | undefined,
  rows?: CostBomPatternItem | CostBomPatternItem[] | null,
) {
  const patternIds = Array.isArray(value) ? (value as PatternId[]) : [];
  form.budgetPatternIds = patternIds;
  form.budgetPatternId = patternIds[0];
  const selectedList = Array.isArray(rows) ? rows : rows ? [rows] : [];
  selectedList.forEach((item) => {
    if (!patternOptions.value.some((p) => String(p.patternId) === String(item.patternId))) {
      patternOptions.value.push(item);
    }
  });
  form.budgetPatternName = resolvePatternNames(patternIds, selectedList).join("、");
  nextTick(() => {
    formRef.value?.validateField("budgetPatternIds");
  });
}

function handleCostRevenuePatternSelectChange(
  value: ValueType | ValueType[] | null | undefined,
  rows?: CostBomPatternItem | CostBomPatternItem[] | null,
) {
  const patternIds = Array.isArray(value) ? (value as PatternId[]) : [];
  form.costRevenuePatternIds = patternIds;
  form.costRevenuePatternId = patternIds[0];
  const selectedList = Array.isArray(rows) ? rows : rows ? [rows] : [];
  selectedList.forEach((item) => {
    if (!patternOptions.value.some((p) => String(p.patternId) === String(item.patternId))) {
      patternOptions.value.push(item);
    }
  });
  form.costRevenuePatternName = resolvePatternNames(patternIds, selectedList).join("、");
  nextTick(() => {
    formRef.value?.validateField("costRevenuePatternIds");
  });
}

async function fetchCompetitorSelectPage({
  pageNo,
  pageSize,
  keyword,
}: {
  pageNo: number;
  pageSize: number;
  keyword: string;
}) {
  const kw = keyword.trim();
  const res = await fetchInformationDictionaryItems("competitors", {
    pageNo,
    pageSize,
    keyword: kw || undefined,
    status: "ENABLED",
  });
  const records = res.records || [];
  records.forEach((comp) => {
    if (!competitorOptions.value.some((c) => Number(c.itemId) === Number(comp.itemId))) {
      competitorOptions.value.push(comp);
    }
  });
  return {
    records,
    total: res.total,
  };
}

function formatCompetitorLabel(competitor: InformationDictionaryItem) {
  const brand = competitor.brand?.trim();
  const name = competitor.name?.trim() || "";
  if (brand && name) {
    return `${brand} / ${name}`;
  }
  return name || brand || "";
}

function handleCompetitorSelectChange(
  value: ValueType | ValueType[] | null | undefined,
  rows?: InformationDictionaryItem | InformationDictionaryItem[] | null,
) {
  const numericIds = normalizeNumericIds(Array.isArray(value) ? value : value ? [value] : []);
  const selectedList = Array.isArray(rows) ? rows : rows ? [rows] : [];
  selectedList.forEach((item) => {
    if (!competitorOptions.value.some((c) => Number(c.itemId) === Number(item.itemId))) {
      competitorOptions.value.push(item);
    }
  });
  form.competitorIds = numericIds;
  const competitors = competitorOptions.value.filter((item) =>
    numericIds.includes(Number(item.itemId)),
  );
  form.competitor = competitors.map((item) => item.name).join("、");
}

function openCreateDialog() {
  delete form.projectId;
  delete form.version;
  Object.assign(form, emptyForm());
  initialVehicleOption.value = null;
  initialBudgetPatternOptions.value = [];
  initialCostRevenuePatternOptions.value = [];
  initialCompetitorOptions.value = [];
  allVehicleOptions.value = [];
  formLoading.value = false;
  formVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
  void loadFormOptions(false);
}

async function openEditDialog(row: BusinessProjectItem) {
  Object.assign(form, emptyForm(), {
    projectId: row.projectId,
    projectCode: row.projectCode,
    projectName: row.projectName ?? "",
    wbsNumber: row.wbsNumber ?? "",
    vehicleModelId: row.vehicleModelId ?? undefined,
    vehicleModelCode: row.vehicleModelCode ?? "",
    vehicleModelName: row.vehicleModelName ?? "",
    budgetPatternId: row.budgetPatternId ?? undefined,
    budgetPatternIds: row.budgetPatternIds ?? [],
    budgetPatternName: row.budgetPatternName ?? "",
    costRevenuePatternId: row.costRevenuePatternId ?? undefined,
    costRevenuePatternIds: row.costRevenuePatternIds ?? [],
    costRevenuePatternName: row.costRevenuePatternName ?? "",
    company: row.company ?? "",
    factory: row.factory ?? "",
    budgetDashboardStatus: normalizeDashboardStatus(row.budgetDashboardStatus),
    revenueDashboardStatus: normalizeDashboardStatus(row.revenueDashboardStatus),
    costDashboardStatus: normalizeDashboardStatus(row.costDashboardStatus),
    budgetLocked: row.budgetLocked,
    evaluateLocked: row.evaluateLocked,
    status: row.status,
    remark: row.remark ?? "",
    version: row.version,
  });
  formVisible.value = true;
  formLoading.value = true;
  nextTick(() => formRef.value?.clearValidate());

  try {
    await loadFormOptions(true);
  } catch {
    BaseToast.error("项目选项加载失败，暂时无法编辑");
    formLoading.value = false;
    formVisible.value = false;
    return;
  }
  let detail = row;
  try {
    const latestDetail = await fetchBusinessProjectDetail(row.projectId);
    if (latestDetail?.version !== undefined) {
      detail = {
        ...row,
        factory: latestDetail.factory ?? row.factory,
        version: latestDetail.version,
      };
    }
  } catch {
    // Detail refresh keeps optimistic-lock versions fresh when available.
  }
  const detailVehicle = vehicleOptions.value.find(
      (item) => item.vehicleModelId === detail.vehicleModelId,
  );
  const detailVehicleModelName =
      detail.vehicleModelName || detailVehicle?.vehicleModelName || "";
  let projectValves;
  let projectCompetitors;
  try {
    [projectValves, projectCompetitors] = await Promise.all([
      detail.valves?.length
          ? Promise.resolve({ records: detail.valves })
          : fetchBusinessProjectValves(row.projectId),
      fetchBusinessProjectCompetitors(row.projectId),
    ]);
  } catch {
    BaseToast.error("项目关联数据加载失败，暂时无法编辑");
    formLoading.value = false;
    formVisible.value = false;
    return;
  }
  ensureFactoryOption(detail.factory ?? "");
  Object.assign(form, {
    projectId: detail.projectId,
    projectCode: detail.projectCode,
    projectName: detailVehicleModelName || detail.projectName,
    wbsNumber: detail.wbsNumber ?? "",
    vehicleModelId: detail.vehicleModelId ?? undefined,
    vehicleModelCode: detail.vehicleModelCode ?? "",
    vehicleModelName: detailVehicleModelName,
    budgetPatternId: detail.budgetPatternId ?? undefined,
    budgetPatternIds: normalizePatternIds(
        detail.budgetPatternIds,
        detail.budgetPatternId,
        detail.budgetPatternNames,
        detail.budgetPatternName,
    ),
    budgetPatternName: displayList(
        detail.budgetPatternNames,
        detail.budgetPatternName,
    ),
    costRevenuePatternId: detail.costRevenuePatternId ?? undefined,
    costRevenuePatternIds: normalizePatternIds(
        detail.costRevenuePatternIds,
        detail.costRevenuePatternId,
        detail.costRevenuePatternNames,
        detail.costRevenuePatternName,
    ),
    costRevenuePatternName: displayList(
        detail.costRevenuePatternNames,
        detail.costRevenuePatternName,
    ),
    company: detail.company ?? "",
    factory: resolveFactoryCode(detail.factory),
    competitor: displayList(projectCompetitors.competitorNames),
    competitorIds: normalizeNumericIds(projectCompetitors.competitorIds),
    budgetDashboardStatus: normalizeDashboardStatus(
        detail.budgetDashboardStatus,
    ),
    revenueDashboardStatus: normalizeDashboardStatus(
        detail.revenueDashboardStatus,
    ),
    costDashboardStatus: normalizeDashboardStatus(detail.costDashboardStatus),
    legacyProjectNo: detail.legacyProjectNo ?? "",
    valvePlans: projectValves.records.map((item) => ({
      projectValveId: item.projectValveId,
      valveId: item.valveId,
      plannedPassTime: item.plannedPassTime?.slice(0, 10) ?? "",
      actualValvePassageTime:
        item.actualValvePassageTime?.slice(0, 10) ?? "",
      version: item.version,
    })),
    budgetLocked: detail.budgetLocked,
    evaluateLocked: detail.evaluateLocked,
    status: detail.status,
    remark: detail.remark ?? "",
    version: detail.version,
  });
  if (detail.vehicleModelId) {
    initialVehicleOption.value = {
      vehicleModelId: detail.vehicleModelId,
      vehicleModelCode: detail.vehicleModelCode || "",
      vehicleModelName: detailVehicleModelName || detail.projectName || "",
      company: detail.company || "",
      status: "ENABLED",
    } as VehicleModelItem;
  } else {
    initialVehicleOption.value = null;
  }
  const budgetNameList = splitTextList(form.budgetPatternName);
  initialBudgetPatternOptions.value = form.budgetPatternIds.map((id, index) => {
    const existing = patternOptions.value.find(
        (item) => String(item.patternId) === String(id),
    );
    if (existing) return existing;
    return {
      patternId: id,
      patternName: budgetNameList[index] || String(id),
    } as CostBomPatternItem;
  });
  const costRevenueNameList = splitTextList(form.costRevenuePatternName);
  initialCostRevenuePatternOptions.value = form.costRevenuePatternIds.map((id, index) => {
    const existing = patternOptions.value.find(
        (item) => String(item.patternId) === String(id),
    );
    if (existing) return existing;
    return {
      patternId: id,
      patternName: costRevenueNameList[index] || String(id),
    } as CostBomPatternItem;
  });
  const competitorNameList = splitTextList(form.competitor);
  initialCompetitorOptions.value = form.competitorIds.map((id, index) => {
    const existing = competitorOptions.value.find(
        (item) => Number(item.itemId) === Number(id),
    );
    if (existing) return existing;
    return {
      itemId: id,
      moduleType: "competitors",
      code: String(id),
      name: competitorNameList[index] || String(id),
      sortNo: 0,
      status: "ENABLED",
      version: 0,
    } as InformationDictionaryItem;
  });
  competitorOptions.value = normalizeCompetitorOptions(competitorOptions.value);
  nextTick(() => formRef.value?.clearValidate());
  formLoading.value = false;
}

async function loadFormOptions(_includeAssignedVehicles: boolean) {
  formOptionsLoading.value = true;
  try {
    const vehicleModelsRequest = _includeAssignedVehicles
      ? fetchAllVehicleModels()
      : fetchAvailableVehicleModels();
    const [vehicles, valves, patterns, competitors, factories] =
        await Promise.all([
          vehicleModelsRequest,
          fetchBusinessValves({ pageNo: 1, pageSize: 10, status: "ENABLED" }),
          fetchCostBomPatterns({ pageNo: 1, pageSize: 10, status: "ENABLED" }),
          fetchInformationDictionaryItems("competitors", {
            pageNo: 1,
            pageSize: 10,
            status: "ENABLED",
          }),
          fetchBusinessFactories({ pageNo: 1, pageSize: 10, status: "ENABLED" }),
        ]);
    vehicleOptions.value = vehicles;
    allVehicleOptions.value = vehicles;
    if (!editing.value) {
      initialVehicleOption.value = vehicles;
    }
    if (
      form.vehicleModelId &&
      !vehicleOptions.value.some(
        (item) => item.vehicleModelId === form.vehicleModelId,
      )
    ) {
      const fallbackVehicle = {
        vehicleModelId: form.vehicleModelId,
        vehicleModelCode: form.vehicleModelCode,
        vehicleModelName: form.vehicleModelName,
        status: "ENABLED",
      } as VehicleModelItem;
      vehicleOptions.value.unshift(fallbackVehicle);
      if (!allVehicleOptions.value.some((item) => item.vehicleModelId === form.vehicleModelId)) {
        allVehicleOptions.value.unshift(fallbackVehicle);
      }
    }
    valveOptions.value = valves.records;
    patternOptions.value = Array.isArray(patterns)
        ? patterns
        : patterns.records;
    competitorOptions.value = normalizeCompetitorOptions(competitors.records);
    factoryOptions.value = normalizeFactoryList(factories);
    ensureFactoryOption(form.factory);
  } finally {
    formOptionsLoading.value = false;
  }
}

onMounted(() => {
  void loadFactoryOptions();
  void loadCompanyOptions();
});

function normalizeCompetitorOptions(
    options: InformationDictionaryItem[],
): InformationDictionaryItem[] {
  const currentCompetitor = form.competitor.trim();
  if (
      !currentCompetitor ||
      options.some((item) => item.name === currentCompetitor)
  ) {
    return options;
  }
  return [
    ...options,
    {
      itemId: currentCompetitor,
      moduleType: "competitors",
      code: currentCompetitor,
      name: currentCompetitor,
      sortNo: 0,
      status: "ENABLED",
      version: 0,
    },
  ];
}

function resolvePatternNames(
  patternIds: PatternId[],
  knownItems?: CostBomPatternItem[],
) {
  const knownMap = new Map<string, string>();
  (knownItems || []).forEach((item) => {
    if (item.patternName) knownMap.set(String(item.patternId), item.patternName);
  });
  return patternIds
      .map(
          (patternId) =>
              knownMap.get(String(patternId)) ||
              patternOptions.value.find(
                  (item) => String(item.patternId) === String(patternId),
              )?.patternName,
      )
      .filter((name): name is string => Boolean(name));
}

function normalizePatternIds(
    ids?: PatternId[] | null,
    fallback?: PatternId | null,
    names?: string[] | null,
    fallbackName?: string | null,
) {
  const values = ids?.length
      ? ids
      : fallback !== undefined && fallback !== null && fallback !== ""
          ? String(fallback)
              .split(/[、,，]/)
              .map((id) => id.trim())
              .filter(Boolean)
          : patternIdsFromNames(names, fallbackName);
  return values.map((id) => {
    const option = patternOptions.value.find(
        (item) => String(item.patternId) === String(id),
    );
    return option?.patternId ?? id;
  });
}

function patternIdsFromNames(
    names?: string[] | null,
    fallbackName?: string | null,
) {
  const patternNames = names?.length ? names : splitTextList(fallbackName);
  return patternNames
      .map(
          (name) =>
              patternOptions.value.find((item) => item.patternName === name)
                  ?.patternId,
      )
      .filter(
          (id): id is NonNullable<typeof id> => id !== undefined && id !== null,
      );
}

function displayList(values?: string[] | null, fallback?: string | null) {
  const text = values?.filter(Boolean).join("、");
  return text || fallback || "";
}

function splitTextList(value?: string | null) {
  return String(value ?? "")
      .split(/[、,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
}

function normalizeNumericIds(ids?: Array<string | number> | null) {
  return (ids ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
}

function optionalPatternIdList(ids: PatternId[]) {
  return ids.length ? ids : undefined;
}

function handleSelectionChange(selection: BusinessProjectItem[]) {
  selectedRows.value = selection;
}

async function saveProject() {
  if (savingProject.value) {
    return;
  }
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const projectCode = form.projectCode.trim();
  const projectName = form.projectName.trim();
  const vehicleModelName = form.vehicleModelName.trim();
  if (!editing.value && (await isProjectCodeDuplicated(projectCode))) {
    BaseToast.warning(`项目代号“${projectCode}”已存在`);
    return;
  }

  const budgetPatternNames = resolvePatternNames(form.budgetPatternIds);
  const costRevenuePatternNames = resolvePatternNames(
      form.costRevenuePatternIds,
  );
  const valves = form.valvePlans
      .filter((item): item is typeof item & { valveId: number } =>
          Boolean(item.valveId && item.plannedPassTime),
      )
      .map((item) => ({
        valveId: item.valveId,
        valvePassageTime: item.plannedPassTime,
        actualValvePassageTime: item.actualValvePassageTime || undefined,
      }));

  const payload = {
    projectName,
    wbsNumber: editing.value ? undefined : form.wbsNumber.trim() || undefined,
    vehicleModelId: editing.value ? undefined : form.vehicleModelId,
    vehicleModelCode: editing.value
        ? undefined
        : form.vehicleModelCode.trim() || undefined,
    vehicleModelName: editing.value ? undefined : vehicleModelName || undefined,
    budgetPatternIds: optionalPatternIdList(form.budgetPatternIds),
    budgetPatternName:
        budgetPatternNames.join("、") ||
        form.budgetPatternName.trim() ||
        undefined,
    budgetPatternNames,
    costRevenuePatternIds: optionalPatternIdList(form.costRevenuePatternIds),
    costRevenuePatternName:
        costRevenuePatternNames.join("、") ||
        form.costRevenuePatternName.trim() ||
        undefined,
    costRevenuePatternNames,
    company: form.company.trim() || undefined,
    factory: form.factory.trim() || undefined,
    competitor: form.competitor.trim() || undefined,
    competitorIds: form.competitorIds,
    budgetDashboardStatus: normalizeDashboardStatus(form.budgetDashboardStatus),
    revenueDashboardStatus: normalizeDashboardStatus(
        form.revenueDashboardStatus,
    ),
    costDashboardStatus: normalizeDashboardStatus(form.costDashboardStatus),
    legacyProjectNo: form.legacyProjectNo.trim() || undefined,
    budgetLocked: form.budgetLocked,
    evaluateLocked: form.evaluateLocked,
    status: form.status,
    remark: form.remark.trim() || undefined,
    valves,
  };

  savingProject.value = true;
  try {
    if (form.projectId) {
      await updateBusinessProject(form.projectId, {
        ...payload,
        version: form.version ?? 0,
      });
      BaseToast.success("项目已更新");
    } else {
      await createBusinessProject({
        projectCode,
        ...payload,
      });
      BaseToast.success("项目已新增");
    }
    formVisible.value = false;
    await queryTableRef.value?.reload();
  } finally {
    savingProject.value = false;
  }
}

async function changeDashboardStatus(
  row: BusinessProjectItem,
  field: DashboardStatusField,
  enabled: boolean,
) {
  const nextValue = enabled ? "1" : "0";
  const nextStatus = enabled ? "ENABLED" : "DISABLED";
  // [ "budgetDashboardStatus", "revenueDashboardStatus", "costDashboardStatus"]
  const realKeys = {
    budgetDashboardStatus: 'budgetShow',
    revenueDashboardStatus: 'incomeShow',
    costDashboardStatus: 'costShow'
  }
  const data = {
    id: row.projectId,
    [realKeys[field]]: nextValue
  }
  row.btnLoading = true
  try {
    await fetchChangeStatus(data)
    BaseToast.success("看板状态已更新");
    row[field] = nextStatus;
  } catch {
    BaseToast.error("看板状态更新失败");
  }
  row.btnLoading = false
}
// async function changeDashboardStatus(
//     row: BusinessProjectItem,
//     field: DashboardStatusField,
//     enabled: boolean,
// ) {
//   const nextStatus = enabled ? "ENABLED" : "DISABLED";
//   const previousStatus = row[field] ?? "";
//   row[field] = nextStatus;
//   try {
//     const updated = await updateBusinessProject(row.projectId, {
//       [field]: nextStatus,
//       version: row.version,
//     });
//     row[field] = updated[field] ?? nextStatus;
//     row.version = updated.version;
//     BaseToast.success("看板状态已更新");
//   } catch {
//     row[field] = previousStatus;
//     BaseToast.error("看板状态更新失败");
//   }
// }

async function isProjectCodeDuplicated(projectCode: string) {
  const page = await fetchBusinessProjects({
    pageNo: 1,
    pageSize: 200,
    code: projectCode,
  });
  return page.records.some((item) => item.projectCode === projectCode);
}

function addValvePlan() {
  form.valvePlans.push({
    valveId: null,
    plannedPassTime: "",
    actualValvePassageTime: "",
  });
  nextTick(() => formRef.value?.validateField("valvePlans"));
}

function isValveSelected(valveId: number | string, currentIndex: number) {
  return form.valvePlans.some(
      (item, index) =>
          index !== currentIndex && String(item.valveId ?? "") === String(valveId),
  );
}

function removeValvePlan(index: number) {
  form.valvePlans.splice(index, 1);
  nextTick(() => formRef.value?.validateField("valvePlans"));
}

async function changeStatus() {
  const row = pendingStatusRow.value;
  if (!row) {
    return;
  }
  if (row.status === "ENABLED") {
    await disableBusinessProject(row.projectId, row.version);
    BaseToast.success("项目已停用");
  } else {
    await enableBusinessProject(row.projectId, row.version);
    BaseToast.success("项目已启用");
  }
  confirmVisible.value = false;
  pendingStatusRow.value = null;
  await queryTableRef.value?.reload();
}

function openDeleteConfirm(row: BusinessProjectItem) {
  pendingDeleteRows.value = [row];
  deleteConfirmVisible.value = true;
}

function openBatchDeleteConfirm() {
  if (!selectedRows.value.length) {
    BaseToast.warning("请先选择要删除的项目");
    return;
  }
  pendingDeleteRows.value = [...selectedRows.value];
  deleteConfirmVisible.value = true;
}

async function deleteProject() {
  if (deletingProject.value || !pendingDeleteRows.value.length) {
    return;
  }
  const ids = pendingDeleteRows.value.map((row) => row.projectId).join(",");
  deletingProject.value = true;
  try {
    await deleteBusinessProject(ids);
    BaseToast.success(deleteConfirmContent.value.successMessage);
    deleteConfirmVisible.value = false;
    pendingDeleteRows.value = [];
    selectedRows.value = [];
    await queryTableRef.value?.reload();
  } finally {
    deletingProject.value = false;
  }
}
</script>

<template>
  <PageContainer
      title="项目管理"
      description="维护项目主数据、车型快照和预算/评估锁定状态。"
  >
    <QueryTable
        ref="queryTableRef"
        :func="queryProjects"
        row-key="projectId"
        fit-table-height
        :table-props="{ scrollbarAlwaysOn: true, tableLayout: 'fixed' }"
        empty-title="暂无匹配项目"
        empty-description="当前筛选条件下没有可展示的车型项目。"
        @selection-change="handleSelectionChange"
        @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="项目代号">
            <el-input
                v-model="query.name"
                clearable
                placeholder="请输入项目代号"
                @keyup.enter="searchProjects"
            />
          </el-form-item>
          <el-form-item label="WBS编码">
            <el-input
                v-model="query.wbsNumber"
                clearable
                placeholder="请输入WBS编码"
                @keyup.enter="searchProjects"
            />
          </el-form-item>
          <el-form-item label="工厂名称">
            <BaseInfiniteSelect
                v-model="query.factory"
                :fetch-api="fetchFactorySelectPage"
                :value-key="(item) => item.factoryCode || item.factoryName"
                label-key="factoryName"
                :label-formatter="formatFactoryLabel"
                :page-size="8"
                max-height="250px"
                placeholder="请选择工厂名称"
            />
          </el-form-item>
          <el-form-item label="所属公司">
            <el-select
                v-model="query.company"
                clearable
                filterable
                placeholder="请选择所属公司"
                data-test="project-company-select"
            >
              <el-option
                  v-for="company in companyOptions"
                  :key="company"
                  :label="company.label"
                  :value="company.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
                v-model="query.createdAtRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                clearable
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
            permission="system:project:add"
            variant="primary"
            type="primary"
            plain
            :icon="CirclePlus"
            @click="openCreateDialog"
        >新增</PermissionButton
        >
        <!-- <PermissionButton
            permission="system:project:export"
            variant="secondary"
            :icon="Download"
            plain
            type="warning"
            :loading="exportLoading"
            @click="exportProjects"
        >
          导出
        </PermissionButton> -->
        <PermissionButton
            permission="system:project:remove"
            variant="danger"
            type="danger"
            @click="openBatchDeleteConfirm"
        >
          批量删除
        </PermissionButton>
      </template>

      <el-table-column type="selection" width="48" />
      <el-table-column type="index" label="序号" width="70" />
      <el-table-column
          prop="wbsNumber"
          label="WBS编码"
          min-width="150"
          show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ displayFactoryName(row) }}
        </template>
      </el-table-column>
      <el-table-column
          prop="projectName"
          label="项目代号"
          min-width="200"
          show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ displayProjectName(row) }}
        </template>
      </el-table-column>
      <el-table-column
          prop="budgetPatternName"
          label="预算版型"
          width="150"
          class-name="project-pattern-column"
          :show-overflow-tooltip="false"
      >
        <template #default="{ row }">
          <div class="project-pattern-cell">
            <BaseTableOverflowPopover
                :value="displayList(row.budgetPatternNames, row.budgetPatternName)"
                :values="row.budgetPatternNames"
                label="预算版型"
                :title="displayProjectName(row)"
                placement="top-start"
            />
          </div>
        </template>
      </el-table-column>
      <el-table-column
          prop="costRevenuePatternName"
          label="成本收益版型"
          width="150"
          class-name="project-pattern-column"
          :show-overflow-tooltip="false"
      >
        <template #default="{ row }">
          <div class="project-pattern-cell">
            <BaseTableOverflowPopover
                :value="
                displayList(
                  row.costRevenuePatternNames,
                  row.costRevenuePatternName,
                )
              "
                :values="row.costRevenuePatternNames"
                label="成本收益版型"
                :title="displayProjectName(row)"
                placement="top-start"
            />
          </div>
        </template>
      </el-table-column>
      <el-table-column
          prop="factory"
          label="工厂名称"
          min-width="120"
          show-overflow-tooltip
      />
      <el-table-column
          v-for="column in dashboardStatusColumns"
          :key="column.field"
          :label="column.label"
          width="100"
          align="center"
      >
        <template #default="{ row }">
          <el-switch
              :loading="row.btnLoading"
              :model-value="isDashboardStatusEnabled(row[column.field])"
              @change="changeDashboardStatus(row, column.field, Boolean($event))"
          />
        </template>
      </el-table-column>
      <el-table-column
          prop="company"
          label="所属公司"
          min-width="150"
          show-overflow-tooltip
      />
      <el-table-column label="创建时间" width="160" align="center">
        <template #default="{ row }">
          <BaseDateTime :value="row.createdAt || null" />
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="120" align="center">
        <template #default="{ row }">
          <PermissionButton
              permission="system:project:edit"
              link
              type="primary"
              @click="openEditDialog(row)"
          >编辑</PermissionButton
          >
          <PermissionButton
              permission="system:project:remove"
              link
              @click="openDeleteConfirm(row)"
          >删除</PermissionButton
          >
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
        v-model="formVisible"
        :title="formTitle"
        width="760px"
        :loading="formLoading || savingProject"
        @confirm="saveProject"
    >
      <div v-loading="formLoading" data-test="project-form-loading">
        <el-form
            ref="formRef"
            :model="form"
            :rules="formRules"
            label-position="top"
        >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="车型" prop="vehicleModelId">
              <BaseInfiniteSelect
                  v-model="form.vehicleModelId"
                  :fetch-api="fetchVehicleSelectPage"
                  :value-key="(item) => Number(item.vehicleModelId)"
                  label-key="vehicleModelName"
                  :label-formatter="formatVehicleLabel"
                  :page-size="8"
                  max-height="250px"
                  placeholder="请选择车型"
                  :disabled="editing"
                  :initial-option="initialVehicleOption"
                  data-test="project-vehicle-select"
                  @change="handleVehicleSelectChange"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">

            <el-form-item label="WBS编码" prop="wbsNumber">
              <el-input
                  v-model="form.wbsNumber"
                  placeholder="请输入WBS编码"
                  clearable
                  :disabled="editing"
                  data-test="project-wbs-input"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">

            <el-form-item label="项目代号" prop="projectName">
              <el-input
                  v-model="form.projectName"
                  :disabled="projectNameDisabled"
                  placeholder="请输入项目代号"
                  data-test="project-name-input"
              />
            </el-form-item>

          </el-col>
          <el-col :span="12">
            <el-form-item label="预算版型" prop="budgetPatternIds">
              <BaseInfiniteSelect
                  v-model="form.budgetPatternIds"
                  :fetch-api="fetchPatternSelectPage"
                  value-key="patternId"
                  label-key="patternName"
                  :label-formatter="formatPatternLabel"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  :page-size="8"
                  max-height="250px"
                  placeholder="请选择预算版型"
                  :initial-option="initialBudgetPatternOptions"
                  data-test="project-budget-pattern-select"
                  @change="handleBudgetPatternSelectChange"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="成本收益版型" prop="costRevenuePatternIds">
              <BaseInfiniteSelect
                  v-model="form.costRevenuePatternIds"
                  :fetch-api="fetchPatternSelectPage"
                  value-key="patternId"
                  label-key="patternName"
                  :label-formatter="formatPatternLabel"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  :page-size="8"
                  max-height="250px"
                  placeholder="请选择成本收益版型"
                  :initial-option="initialCostRevenuePatternOptions"
                  data-test="project-cost-pattern-select"
                  @change="handleCostRevenuePatternSelectChange"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属公司">
              <el-input
                  v-model="form.company"
                  disabled
                  placeholder="选择车型后自动带出"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工厂名称" prop="factory">
              <BaseInfiniteSelect
                  v-model="form.factory"
                  :fetch-api="fetchFactorySelectPage"
                  :value-key="(item) => item.factoryCode || item.factoryName"
                  label-key="factoryName"
                  :label-formatter="formatFactoryLabel"
                  :page-size="8"
                  max-height="250px"
                  placeholder="请选择工厂名称"
                  @change="handleFactorySelectChange"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="竞品">
              <BaseInfiniteSelect
                  v-model="form.competitorIds"
                  :fetch-api="fetchCompetitorSelectPage"
                  :value-key="(item) => Number(item.itemId)"
                  label-key="name"
                  :label-formatter="formatCompetitorLabel"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  :page-size="8"
                  max-height="250px"
                  placeholder="请选择竞品"
                  :initial-option="initialCompetitorOptions"
                  data-test="project-competitor-select"
                  @change="handleCompetitorSelectChange"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="看板状态">
              <div class="project-dashboard-status">
                <div
                    v-for="item in dashboardStatusColumns"
                    :key="item.field"
                    class="project-dashboard-status__item"
                >
                  <span>{{ item.label }}</span>
                  <el-switch
                      :model-value="isDashboardStatusEnabled(form[item.field])"
                      @change="
                      setFormDashboardStatus(item.field, Boolean($event))
                    "
                  />
                </div>
              </div>
            </el-form-item>
          </el-col>
          <!--          <el-col :span="12">-->
          <!--            <el-form-item label="旧系统编号">-->
          <!--              <el-input v-model="form.legacyProjectNo" placeholder="请输入旧系统编号" />-->
          <!--            </el-form-item>-->
          <!--          </el-col>-->
          <!--          <el-col :span="12">-->
          <!--            <el-form-item label="项目状态">-->
          <!--              <el-select v-model="form.status" placeholder="请选择状态">-->
          <!--                <el-option label="启用" value="ENABLED" />-->
          <!--                <el-option label="停用" value="DISABLED" />-->
          <!--              </el-select>-->
          <!--            </el-form-item>-->
          <!--          </el-col>-->
        </el-row>
        <el-form-item label="阀点计划" prop="valvePlans">
          <div class="project-valve-plans">
            <div
                v-for="(item, index) in form.valvePlans"
                :key="index"
                class="project-valve-plans__row"
            >
              <el-select
                  v-model="item.valveId"
                  filterable
                  clearable
                  placeholder="请选择阀点"
                  @change="formRef?.validateField('valvePlans')"
              >
                <el-option
                    v-for="valve in valveOptions"
                    :key="valve.valveId"
                    :label="`${valve.valveName}`"
                    :value="valve.valveId"
                    :disabled="isValveSelected(valve.valveId, index)"
                />
              </el-select>
              <el-date-picker
                  v-model="item.plannedPassTime"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="计划过阀时间"
                  @change="formRef?.validateField('valvePlans')"
              />
              <el-date-picker
                  v-model="item.actualValvePassageTime"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="实际过阀时间"
              />
              <PermissionButton
                  link
                  type="danger"
                  @click="removeValvePlan(index)"
              >删除</PermissionButton
              >
            </div>
            <PermissionButton
                link
                type="primary"
                :icon="CirclePlus"
                @click="addValvePlan"
            >添加阀点</PermissionButton
            >
          </div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
              v-model="form.remark"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
          />
        </el-form-item>
        </el-form>
      </div>
    </BaseFormDialog>

    <BaseConfirm
        v-model="confirmVisible"
        :title="statusConfirmContent.title"
        :message="statusConfirmContent.message"
        :type="statusConfirmContent.type"
        :confirm-text="statusConfirmContent.confirmText"
        @confirm="changeStatus"
    />
    <BaseConfirm
        v-model="deleteConfirmVisible"
        :title="deleteConfirmContent.title"
        :message="deleteConfirmContent.message"
        :type="deleteConfirmContent.type"
        :confirm-text="deleteConfirmContent.confirmText"
        :loading="deletingProject"
        @confirm="deleteProject"
    />
  </PageContainer>
</template>

<style scoped>
.project-pattern-cell {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.project-pattern-cell :deep(.base-table-overflow-popover__reference) {
  display: block;
  width: 100%;
  max-width: 100%;
}

:deep(.project-pattern-column .cell) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.base-table-overflow-popover) {
  max-height: min(420px, calc(100vh - 180px));
  overflow: hidden;
}

:global(.base-table-overflow-popover .base-table-overflow-popover__list) {
  display: flex;
  max-height: min(340px, calc(100vh - 220px));
  flex-direction: column;
}

:global(.base-table-overflow-popover .base-table-overflow-popover__list-header) {
  flex: 0 0 auto;
}

:global(.base-table-overflow-popover .base-table-overflow-popover__list-body) {
  min-height: 0;
  flex: 1 1 auto;
  max-height: min(280px, calc(100vh - 260px));
}

.project-valve-plans {
  width: 100%;
  display: grid;
  gap: 8px;
}

.project-valve-plans__row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 210px 210px 52px;
  gap: 12px;
  align-items: center;
}

.project-valve-plans__row :deep(.el-date-editor) {
  width: 100%;
  min-width: 0;
}

.project-dashboard-status {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 12px;
}

.project-dashboard-status__item {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 6px;
  background: var(--bq-color-bg-soft);
  color: var(--bq-color-text);
  font-weight: 500;
}

@media (max-width: 768px) {
  .project-dashboard-status {
    grid-template-columns: 1fr;
  }
}
</style>
