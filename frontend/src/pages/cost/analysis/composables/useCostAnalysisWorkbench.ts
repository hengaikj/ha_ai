import { createCostAnalysisProjectTree } from "@/api/cost-analysis/dimensions";
import { computed, reactive, ref, watch } from "vue";
import {
  createCostAnalysisExportTask,
  downloadCostAnalysisExport,
  fetchCostAnalysisBomScopes,
  fetchCostAnalysisDimensionTree,
  fetchCostAnalysisProjectOptions,
  fetchCostAnalysisValveOptions,
  getCostAnalysisExportTask,
  queryCostAnalysis,
  saveCostAnalysisRemark,
  type CostAnalysisValveOption,
} from "@/api/cost-analysis";
import {
  buildCostAnalysisPointKey,
  buildCostAnalysisValueKey,
} from "@/api/cost-analysis/matrix-key";
import {
  useCostAnalysisConditions,
  type CostAnalysisConditionValidationError,
} from "@/pages/cost/analysis/composables/useCostAnalysisConditions";
import type {
  CostAnalysisCategoryLevel,
  CostAnalysisCategoryNode,
  CostAnalysisConditionDraft,
  CostAnalysisDiffColumnSelection,
  CostAnalysisDimensionType,
  CostAnalysisExportTask,
  CostAnalysisLatestBom,
  CostAnalysisQuery,
  CostAnalysisRemarkUpdate,
  CostAnalysisResult,
  CostAnalysisTraceError,
} from "@/types/cost-analysis";
import type { BusinessProjectItem } from "@/types/project";

const EXPORT_POLL_INTERVAL = 500;
const EXPORT_TIMEOUT = 30_000;

export interface CategorySelectionModel {
  level: CostAnalysisCategoryLevel | null;
  ids: string[];
}

export interface CostAnalysisDiffColumnCandidate {
  columnKey: string;
  clientId: string;
  projectName: string;
  valveName: string;
  bomVersionNo: string;
  patternId: number;
  patternName: string;
}

export interface CostAnalysisDiffConditionSelection {
  baselineColumnKey: string;
}

export type CostAnalysisDiffModeRequestResult =
  | "ENABLED"
  | "SELECTION_REQUIRED"
  | "INSUFFICIENT"
  | "DISABLED";

function normalizeError(
  error: unknown,
  code: string,
  message: string,
): CostAnalysisTraceError {
  if (typeof error === "object" && error !== null) {
    const candidate = error as Partial<CostAnalysisTraceError>;
    if (
      typeof candidate.code === "string" &&
      typeof candidate.message === "string"
    ) {
      return {
        code: candidate.code,
        message: candidate.message,
        ...(typeof candidate.traceId === "string"
          ? { traceId: candidate.traceId }
          : {}),
      };
    }
  }
  return {
    code,
    message: error instanceof Error ? error.message : message,
  };
}

function cloneBom(bom: CostAnalysisLatestBom): CostAnalysisLatestBom {
  return {
    ...bom,
    patterns: bom.patterns.map((pattern) => ({ ...pattern })),
  };
}

function cloneCondition(
  condition: CostAnalysisConditionDraft,
): CostAnalysisConditionDraft {
  return {
    ...condition,
    bom: condition.bom ? cloneBom(condition.bom) : null,
    patternIds: [...condition.patternIds],
    bomError: condition.bomError ? { ...condition.bomError } : null,
  };
}

function immutableQuery(query: CostAnalysisQuery): CostAnalysisQuery {
  const conditions = query.conditions.map((condition) =>
    Object.freeze({
      ...condition,
      patternIds: Object.freeze([...condition.patternIds]) as number[],
    }),
  );
  return Object.freeze({
    ...query,
    categoryIds: Object.freeze([...query.categoryIds]) as string[],
    conditions: Object.freeze(conditions) as CostAnalysisQuery["conditions"],
  });
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function useCostAnalysisWorkbench() {
  const dimensionType = ref<CostAnalysisDimensionType>("VEHICLE_SYSTEM");
  const categories = ref<CostAnalysisCategoryNode[]>([]);
  const browseLevel = ref<CostAnalysisCategoryLevel>(0);
  const projects = ref<BusinessProjectItem[]>([]);
  const valves = ref<CostAnalysisValveOption[]>([]);
  const valveIdsByProject = ref<Record<string, number[]>>({});
  const selection = ref<CategorySelectionModel>({ level: null, ids: [] });
  const result = ref<CostAnalysisResult | null>(null);
  const submittedQuery = ref<CostAnalysisQuery | null>(null);
  const diffSelection = ref<CostAnalysisDiffConditionSelection | null>(null);
  const submittedDiffSelection = ref<CostAnalysisDiffColumnSelection | null>(
    null,
  );
  const diffSelectionDraft = ref<CostAnalysisDiffConditionSelection | null>(
    null,
  );
  const diffSelectionDialogVisible = ref(false);
  const loading = reactive({
    bootstrap: false,
    query: false,
    export: false,
  });
  const bootstrapError = ref<CostAnalysisTraceError | null>(null);
  const queryError = ref<CostAnalysisTraceError | null>(null);
  const exportError = ref<CostAnalysisTraceError | null>(null);
  const categoryValidationError = ref<string | null>(null);
  const validationErrors = ref<CostAnalysisConditionValidationError[]>([]);
  const conditionState = useCostAnalysisConditions();
  let bootstrapReady = false;
  let queryGeneration = 0;
  let exportGeneration = 0;
  let exportTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveExportWait: ((active: boolean) => void) | null = null;
  let disposed = false;
  const projectRevisions = new Map<string, number>();

  function isCompleteDiffCondition(
    condition: CostAnalysisConditionDraft,
  ): boolean {
    if (
      condition.loadingBom ||
      !Number.isSafeInteger(condition.projectId) ||
      Number(condition.projectId) <= 0 ||
      !Number.isSafeInteger(condition.valveId) ||
      Number(condition.valveId) <= 0 ||
      !condition.bom ||
      condition.bom.projectId !== condition.projectId
    ) {
      return false;
    }
    const availablePatternIds = new Set(
      condition.bom.patterns.map((pattern) => pattern.patternId),
    );
    return condition.patternIds.some((patternId) =>
      availablePatternIds.has(patternId),
    );
  }

  function completeDiffCandidates(): CostAnalysisDiffColumnCandidate[] {
    return conditionState.conditions.value.flatMap((condition) => {
      if (!isCompleteDiffCondition(condition) || !condition.bom) return [];
      const selectedPatternIds = new Set(condition.patternIds);
      const pointKey = buildCostAnalysisPointKey(
        condition.projectId as number,
        condition.valveId as number,
      );
      return condition.bom.patterns.flatMap((pattern) =>
        selectedPatternIds.has(pattern.patternId)
          ? [
              {
                columnKey: buildCostAnalysisValueKey(
                  pattern.patternId,
                  pointKey,
                ),
                clientId: condition.clientId,
                projectName: condition.projectName,
                valveName: condition.valveName,
                bomVersionNo: condition.bom!.bomVersionNo,
                patternId: pattern.patternId,
                patternName: pattern.patternName,
              },
            ]
          : [],
      );
    });
  }
  const diffCandidates = computed(completeDiffCandidates);

  function disableDiffMode(): void {
    conditionState.setDiffMode(false);
    diffSelection.value = null;
    submittedDiffSelection.value = null;
    diffSelectionDraft.value = null;
    diffSelectionDialogVisible.value = false;
  }

  function requestDiffMode(
    enabled: boolean,
  ): CostAnalysisDiffModeRequestResult {
    if (!enabled) {
      disableDiffMode();
      return "DISABLED";
    }

    const candidates = completeDiffCandidates();
    if (candidates.length < 2) {
      disableDiffMode();
      return "INSUFFICIENT";
    }
    const candidateKeys = new Set(
      candidates.map((candidate) => candidate.columnKey),
    );
    const current = diffSelection.value;
    diffSelectionDraft.value =
      current && candidateKeys.has(current.baselineColumnKey)
        ? { ...current }
        : {
            baselineColumnKey: candidates[0].columnKey,
          };
    if (!conditionState.diffMode.value) {
      diffSelection.value = null;
    }
    diffSelectionDialogVisible.value = true;
    return "SELECTION_REQUIRED";
  }

  function openDiffSelectionDialog(): boolean {
    const candidates = completeDiffCandidates();
    if (candidates.length < 2) {
      return false;
    }

    const candidateKeys = new Set(
      candidates.map((candidate) => candidate.columnKey),
    );
    const current = diffSelection.value;
    diffSelectionDraft.value =
      current && candidateKeys.has(current.baselineColumnKey)
        ? { ...current }
        : {
            baselineColumnKey: candidates[0].columnKey,
          };
    diffSelectionDialogVisible.value = true;
    return true;
  }

  function confirmDiffSelection(): boolean {
    const draft = diffSelectionDraft.value;
    const candidateKeys = new Set(
      completeDiffCandidates().map((candidate) => candidate.columnKey),
    );
    if (!draft || !candidateKeys.has(draft.baselineColumnKey)) {
      return false;
    }
    diffSelection.value = { ...draft };
    submittedDiffSelection.value = null;
    conditionState.setDiffMode(true);
    diffSelectionDialogVisible.value = false;
    return true;
  }

  function resolveDiffColumnSelection(
    conditions: CostAnalysisConditionDraft[],
  ): CostAnalysisDiffColumnSelection | null {
    const selection = diffSelection.value;
    if (!conditionState.diffMode.value || !selection) return null;
    const candidateExists = conditions.some((condition) => {
      if (!isCompleteDiffCondition(condition)) return false;
      const pointKey = buildCostAnalysisPointKey(
        condition.projectId as number,
        condition.valveId as number,
      );
      return condition.patternIds.some(
        (patternId) =>
          buildCostAnalysisValueKey(patternId, pointKey) ===
          selection.baselineColumnKey,
      );
    });
    if (!candidateExists) {
      return null;
    }
    return {
      baselineColumnKey: selection.baselineColumnKey,
    };
  }
  const activeDiffPointSelection = computed(() =>
    resolveDiffColumnSelection(conditionState.conditions.value),
  );

  function invalidateDiffSelection(clientId: string): void {
    const selection = diffSelection.value;
    const selectedCandidate = completeDiffCandidates().find(
      (candidate) => candidate.columnKey === selection?.baselineColumnKey,
    );
    if (selectedCandidate?.clientId === clientId) {
      disableDiffMode();
    }
  }

  watch(
    selection,
    () => {
      categoryValidationError.value = null;
    },
    { deep: true, flush: "sync" },
  );

  function cancelExportPolling(): void {
    exportGeneration += 1;
    if (exportTimer !== null) {
      clearTimeout(exportTimer);
      exportTimer = null;
    }
    if (resolveExportWait) {
      resolveExportWait(false);
      resolveExportWait = null;
    }
  }

  function cancelExport(): void {
    cancelExportPolling();
    loading.export = false;
    exportError.value = null;
  }

  function waitForNextPoll(generation: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (disposed || generation !== exportGeneration) {
        resolve(false);
        return;
      }
      resolveExportWait = resolve;
      exportTimer = setTimeout(() => {
        exportTimer = null;
        resolveExportWait = null;
        resolve(!disposed && generation === exportGeneration);
      }, EXPORT_POLL_INTERVAL);
    });
  }

  async function loadBootstrap(): Promise<void> {
    const generation = ++queryGeneration;
    loading.bootstrap = true;
    bootstrapError.value = null;
    bootstrapReady = false;

    try {
      const [categoryOptions, projectOptions, valveOptions, bomScopes] =
        await Promise.all([
          browseLevel.value === 0
            ? Promise.resolve(
                createCostAnalysisProjectTree(dimensionType.value),
              )
            : fetchCostAnalysisDimensionTree(
                dimensionType.value,
                undefined,
                undefined,
                browseLevel.value,
              ),
          fetchCostAnalysisProjectOptions(),
          fetchCostAnalysisValveOptions(),
          fetchCostAnalysisBomScopes(),
        ]);
      if (disposed || generation !== queryGeneration) return;
      const scopedProjectIds = new Set(
        bomScopes.map((scope) => scope.projectId),
      );
      const scopedValveIds = new Set(
        bomScopes.flatMap((scope) => scope.valveIds),
      );
      categories.value = categoryOptions;
      if (browseLevel.value === 0 && categoryOptions.length === 1) {
        selection.value = { level: 0, ids: [categoryOptions[0].id] };
      }
      projects.value = projectOptions.filter((project) =>
        scopedProjectIds.has(project.projectId),
      );
      valves.value = valveOptions.filter((valve) =>
        scopedValveIds.has(valve.valveId),
      );
      valveIdsByProject.value = Object.fromEntries(
        bomScopes.map((scope) => [String(scope.projectId), scope.valveIds]),
      );
      bootstrapReady = true;
    } catch (error) {
      if (disposed || generation !== queryGeneration) return;
      categories.value = [];
      projects.value = [];
      valves.value = [];
      valveIdsByProject.value = {};
      bootstrapError.value = normalizeError(
        error,
        "COST_ANALYSIS_BOOTSTRAP_FAILED",
        "成本分析基础数据加载失败。",
      );
    } finally {
      if (generation === queryGeneration) {
        loading.bootstrap = false;
      }
    }
  }

  async function loadCategoryOptions(generation: number): Promise<void> {
    loading.bootstrap = true;
    bootstrapError.value = null;

    try {
      const categoryOptions =
        browseLevel.value === 0
          ? createCostAnalysisProjectTree(dimensionType.value)
          : await fetchCostAnalysisDimensionTree(
              dimensionType.value,
              undefined,
              undefined,
              browseLevel.value,
            );
      if (disposed || generation !== queryGeneration) return;
      categories.value = categoryOptions;
      if (browseLevel.value === 0 && categoryOptions.length === 1) {
        selection.value = { level: 0, ids: [categoryOptions[0].id] };
      }
      bootstrapReady = true;
    } catch (error) {
      if (disposed || generation !== queryGeneration) return;
      categories.value = [];
      bootstrapReady = false;
      bootstrapError.value = normalizeError(
        error,
        "COST_ANALYSIS_BOOTSTRAP_FAILED",
        "成本分析分类数据加载失败。",
      );
    } finally {
      if (generation === queryGeneration) {
        loading.bootstrap = false;
      }
    }
  }

  function structuralValidationErrors(
    state: ReturnType<typeof useCostAnalysisConditions>,
  ) {
    return state
      .validateConditions()
      .filter(
        (error) =>
          error.code !== "BOM_REQUIRED" && error.code !== "PATTERN_REQUIRED",
      );
  }

  async function runQuery(): Promise<void> {
    cancelExport();
    const loadingConditions = conditionState.conditions.value.filter(
      (condition) => condition.loadingBom,
    );
    if (loadingConditions.length > 0) {
      validationErrors.value = loadingConditions.map((condition) => ({
        code: "BOM_LOADING",
        clientId: condition.clientId,
        message: "最新 BOM 加载中，请稍后查询。",
      }));
      return;
    }
    if (loading.query) return;

    queryError.value = null;
    categoryValidationError.value = null;
    validationErrors.value = [];

    const generation = ++queryGeneration;
    loading.query = false;
    result.value = null;
    submittedQuery.value = null;
    submittedDiffSelection.value = null;

    if (!bootstrapReady && bootstrapError.value) {
      return;
    }
    if (selection.value.level === null || selection.value.ids.length === 0) {
      categoryValidationError.value = "请选择分析项。";
      return;
    }

    const querySelection = {
      level: selection.value.level,
      ids: [...selection.value.ids],
    };
    const queryDiffMode = conditionState.diffMode.value;
    const queryConditions = conditionState.conditions.value.map(cloneCondition);
    loading.query = true;
    try {
      const queryDiffSelection = resolveDiffColumnSelection(queryConditions);
      if (queryDiffMode && !queryDiffSelection) {
        queryError.value = {
          code: "COST_ANALYSIS_DIFF_SELECTION_INVALID",
          message: "差异对比对象已变化，请重新选择。",
        };
        return;
      }
      const queryConditionState = useCostAnalysisConditions(queryConditions);
      queryConditionState.diffMode.value = queryDiffMode;
      const structuralErrors = structuralValidationErrors(queryConditionState);
      if (structuralErrors.length > 0) {
        validationErrors.value = structuralErrors;
        return;
      }
      const conditionErrors = queryConditionState.validateConditions();
      if (conditionErrors.length > 0) {
        validationErrors.value = conditionErrors;
        return;
      }
      validationErrors.value = [];

      const query = immutableQuery({
        dimensionType: dimensionType.value,
        categoryLevel: querySelection.level,
        categoryIds: querySelection.ids,
        diffMode: queryDiffMode,
        conditions: queryConditionState.toQueryConditions(),
      });
      const queriedResult = await queryCostAnalysis(query);
      if (disposed || generation !== queryGeneration) return;
      submittedQuery.value = query;
      submittedDiffSelection.value = queryDiffSelection;
      result.value = queriedResult;
    } catch (error) {
      if (disposed || generation !== queryGeneration) return;
      queryError.value = normalizeError(
        error,
        "COST_ANALYSIS_QUERY_FAILED",
        "成本分析查询失败。",
      );
    } finally {
      if (generation === queryGeneration) {
        loading.query = false;
      }
    }
  }

  function resetWorkbench(): void {
    queryGeneration += 1;
    cancelExport();
    conditionState.resetConditions();
    selection.value = { level: null, ids: [] };
    result.value = null;
    submittedQuery.value = null;
    diffSelection.value = null;
    submittedDiffSelection.value = null;
    diffSelectionDraft.value = null;
    diffSelectionDialogVisible.value = false;
    queryError.value = null;
    categoryValidationError.value = null;
    validationErrors.value = [];
    loading.query = false;
    projectRevisions.clear();
  }

  async function changeBrowseLevel(
    level: CostAnalysisCategoryLevel,
  ): Promise<void> {
    const generation = ++queryGeneration;
    browseLevel.value = level;
    selection.value = { level: null, ids: [] };
    await loadCategoryOptions(generation);
  }

  async function changeDimensionType(
    nextType: CostAnalysisDimensionType,
  ): Promise<void> {
    if (dimensionType.value === nextType) return;

    const generation = ++queryGeneration;
    cancelExport();
    dimensionType.value = nextType;
    browseLevel.value = 0;
    categories.value = [];
    selection.value = { level: null, ids: [] };
    result.value = null;
    submittedQuery.value = null;
    submittedDiffSelection.value = null;
    queryError.value = null;
    categoryValidationError.value = null;
    bootstrapError.value = null;
    loading.bootstrap = true;
    loading.query = false;
    try {
      const nextCategories = createCostAnalysisProjectTree(nextType);
      if (
        disposed ||
        generation !== queryGeneration ||
        dimensionType.value !== nextType
      ) {
        return;
      }
      categories.value = nextCategories;
      selection.value = { level: 0, ids: [nextCategories[0].id] };
      bootstrapReady = true;
    } catch (error) {
      if (
        disposed ||
        generation !== queryGeneration ||
        dimensionType.value !== nextType
      ) {
        return;
      }
      categories.value = [];
      bootstrapReady = false;
      bootstrapError.value = normalizeError(
        error,
        "COST_ANALYSIS_BOOTSTRAP_FAILED",
        "分析维度加载失败。",
      );
    } finally {
      if (generation === queryGeneration) {
        loading.bootstrap = false;
      }
    }
  }

  async function changeProject(
    clientId: string,
    project: BusinessProjectItem | null,
  ): Promise<void> {
    invalidateDiffSelection(clientId);
    validationErrors.value = validationErrors.value.filter(
      (error) => error.clientId !== clientId,
    );
    const revision = (projectRevisions.get(clientId) ?? 0) + 1;
    projectRevisions.set(clientId, revision);
    const condition = conditionState.conditions.value.find(
      (candidate) => candidate.clientId === clientId,
    );
    const scopeConfigured = Boolean(
      project && String(project.projectId) in valveIdsByProject.value,
    );
    const allowedValveIds = project
      ? (valveIdsByProject.value[String(project.projectId)] ?? [])
      : [];
    if (
      condition &&
      condition.valveId !== null &&
      (project === null || scopeConfigured) &&
      !allowedValveIds.includes(condition.valveId)
    ) {
      await conditionState.changeValve(clientId, null);
    }
    await conditionState.changeProject(clientId, project);
    if (projectRevisions.get(clientId) !== revision) return;
    validationErrors.value = validationErrors.value.filter(
      (error) => error.clientId !== clientId || error.code !== "BOM_LOADING",
    );
  }

  async function changeValve(
    clientId: string,
    valve: CostAnalysisValveOption | null,
  ): Promise<void> {
    invalidateDiffSelection(clientId);
    validationErrors.value = validationErrors.value.filter(
      (error) => error.clientId !== clientId,
    );
    await conditionState.changeValve(clientId, valve);
  }

  function changePatterns(clientId: string, patternIds: number[]): void {
    validationErrors.value = validationErrors.value.filter(
      (error) => error.clientId !== clientId,
    );
    conditionState.changePatterns(clientId, patternIds);
    if (
      diffSelection.value &&
      !completeDiffCandidates().some(
        (candidate) =>
          candidate.columnKey === diffSelection.value?.baselineColumnKey,
      )
    ) {
      disableDiffMode();
    }
  }

  function exportFailure(task: CostAnalysisExportTask): CostAnalysisTraceError {
    return (
      task.error ?? {
        code: "COST_ANALYSIS_EXPORT_FAILED",
        message: "成本分析导出失败。",
      }
    );
  }

  async function completeExportTask(
    task: CostAnalysisExportTask,
    generation: number,
  ): Promise<boolean> {
    if (task.status === "FAILED") {
      exportError.value = exportFailure(task);
      return true;
    }
    if (task.status !== "SUCCEEDED") return false;
    if (!task.fileId) {
      exportError.value = {
        code: "COST_ANALYSIS_EXPORT_FILE_MISSING",
        message: "导出任务未返回可下载文件。",
      };
      return true;
    }
    const file = await downloadCostAnalysisExport(
      task.taskId,
      task.fileId,
      task.fileName,
    );
    if (disposed || generation !== exportGeneration) return true;
    triggerDownload(file.blob, file.fileName);
    return true;
  }

  async function exportSnapshot(): Promise<void> {
    if (loading.export || !result.value?.snapshotId) return;
    cancelExport();
    const generation = exportGeneration;
    loading.export = true;

    try {
      let task = await createCostAnalysisExportTask(result.value.snapshotId);
      if (disposed || generation !== exportGeneration) return;
      if (await completeExportTask(task, generation)) return;

      let elapsed = 0;
      while (elapsed < EXPORT_TIMEOUT) {
        const active = await waitForNextPoll(generation);
        if (!active) return;
        elapsed += EXPORT_POLL_INTERVAL;
        task = await getCostAnalysisExportTask(task.taskId);
        if (disposed || generation !== exportGeneration) return;
        if (await completeExportTask(task, generation)) return;
      }

      exportError.value = {
        code: "COST_ANALYSIS_EXPORT_TIMEOUT",
        message: "成本分析导出等待超时，请稍后重试。",
      };
    } catch (error) {
      if (disposed || generation !== exportGeneration) return;
      exportError.value = normalizeError(
        error,
        "COST_ANALYSIS_EXPORT_FAILED",
        "成本分析导出失败。",
      );
    } finally {
      if (generation === exportGeneration) {
        loading.export = false;
      }
    }
  }

  async function saveRemark(
    payload: CostAnalysisRemarkUpdate,
  ): Promise<void> {
    if (!result.value?.snapshotId) return;
    try {
      await saveCostAnalysisRemark(result.value.snapshotId, payload);
    } catch (error) {
      throw normalizeError(
        error,
        "COST_ANALYSIS_REMARK_SAVE_FAILED",
        "成本分析备注保存失败。",
      );
    }
  }

  function dispose(): void {
    disposed = true;
    queryGeneration += 1;
    cancelExport();
    loading.bootstrap = false;
    loading.query = false;
    loading.export = false;
  }

  return {
    dimensionType,
    browseLevel,
    changeBrowseLevel,
    categories,
    projects,
    valves,
    valveIdsByProject,
    selection,
    result,
    submittedQuery,
    diffSelection,
    submittedDiffSelection,
    activeDiffPointSelection,
    diffSelectionDraft,
    diffSelectionDialogVisible,
    diffCandidates,
    loading,
    bootstrapError,
    queryError,
    exportError,
    categoryValidationError,
    validationErrors,
    conditions: conditionState.conditions,
    diffMode: conditionState.diffMode,
    addCondition: conditionState.addCondition,
    removeCondition(clientId: string) {
      invalidateDiffSelection(clientId);
      conditionState.removeCondition(clientId);
    },
    changeProject,
    changeValve,
    changePatterns,
    requestDiffMode,
    openDiffSelectionDialog,
    confirmDiffSelection,
    loadBootstrap,
    runQuery,
    resetWorkbench,
    changeDimensionType,
    exportSnapshot,
    saveRemark,
    dispose,
  };
}
