/**
 * 收益填报页·模块加载 composable
 *
 * 负责按模块的数据加载编排、加载态/错误态、加载结果应用与加载链路追踪日志。
 * 原 mixin: module-loading.mixin.js
 */
import { ElMessage } from "element-plus";
import {
  buildStageCompletionSummary,
  fetchSubtableFillShell,
  fetchSubtableModuleRecords,
  fetchSubtableS3ModuleRecords,
  listSubtableAuditModuleReviewState,
  loadFlowOpinionTimelineEntry,
  mergeFillOpinionMapToDetail,
} from "@/pages/revenue/subtable-workbench/service";
import { getProjectCostFlowLastSave } from "@/api/system/expenses";
import { AUDIT_DOMAIN } from "@/pages/revenue/subtable-workbench/domain-config";
import { hasS1ModuleSubmittedInReviewState } from "@/pages/revenue/subtable-workbench/s1-workflow-guards";
import type {
  RevenueFillState,
  ModuleLoadPlan,
  ModuleSection,
  SubjectTreeNode,
  MatrixRow,
} from "@/types/revenue";

let subtableModuleLoadTraceSeq = 0;

/** 壳层加载超时（毫秒），防止请求/组装挂起时 loading 永不结束 */
const FILL_SHELL_LOAD_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** 其他 composable 依赖注入 */
export interface ModuleLoadingDeps {
  getPageTraceNow: () => number;
  formatPageTraceTime: (value: number) => string;
  createPageRenderTrace: () => { id: number; startedAt: number; startedWallAt: number };
  buildPageRenderSummary: () => Record<string, unknown>;
  logPageRenderTiming: (
    trace: { id: number; startedAt: number; startedWallAt: number },
    dataReadyAt: number,
    dataReadyWallAt: number,
    summary: Record<string, unknown>,
  ) => Promise<void>;
  resolveSubjectTreeNodes: (payload: unknown) => SubjectTreeNode[];
  normalizeRowsBySubjectTree: (rows: MatrixRow[], tree: SubjectTreeNode[]) => MatrixRow[];
  collectVisibleSubjectIds: (nodes: SubjectTreeNode[], bucket: Record<string, boolean>) => Record<string, boolean>;
  collectSubjectIds: (nodes: SubjectTreeNode[], bucket: Record<string, boolean>) => Record<string, boolean>;
  collectVisibleRowSubjectIds: (rows: MatrixRow[], bucket: Record<string, boolean>) => Record<string, boolean>;
  collectRowSubjectIds: (rows: MatrixRow[], bucket: Record<string, boolean>) => Record<string, boolean>;
  mergeStoredYearsIntoDetail: () => void;
  syncTopLevelDimensionStateFromDetail: () => void;
  syncActiveDimensionSelection: () => void;
  applyCurrentDetailFormulas: () => unknown;
  loadFormulaSourceDetail: (query: Record<string, unknown>) => Promise<void>;
  loadSubjectNotes: (query?: Record<string, unknown>) => Promise<void>;
  /** loadPage 开始前同步 computed → state（避免 watch 写回引发连锁更新） */
  syncRuntimeFlagsToState?: () => void;
  scheduleManagementRateInputScopeDiagnostics: () => void;
  /** S1 相关方法 */
  isS1FlowPermissionEntry: boolean;
  hasS1FlowFillPermission: boolean;
  hasS1FlowSubmitPermission: boolean;
  hasS1FlowCancelSubmitPermission: boolean;
  isS1ModuleSubmitted: (section: ModuleSection) => boolean;
  isS1ModuleOpinionReediting: (section: ModuleSection) => boolean;
  resolveS1ModuleOpinionKeys: (section: ModuleSection) => string[];
  applyS1ModuleReviewState: (state: Record<string, unknown>) => void;
  applyS2ModuleReviewState: (state: Record<string, unknown>) => void;
  buildS1ModuleSaveParams: (section: ModuleSection, extra?: Record<string, unknown>) => Record<string, unknown>;
  buildSaveDraftParams: () => Record<string, unknown>;
  redirectToStageDetailIfNeeded: () => boolean;
  clearDataImportCompareState: () => void;
}

export function useRevenueModuleLoading(state: RevenueFillState, deps: ModuleLoadingDeps) {
  // ============================================================
  // 模块键解析
  // ============================================================

  function getModuleLoadKey(section: ModuleSection | ModuleLoadPlan): string {
    const directKey = String(
      section.moduleKey || (section as Record<string, unknown>).key || "",
    ).trim();
    if (directKey) return directKey;
    const rootSubjectId = String(section.rootSubjectId || "").trim();
    if (rootSubjectId) return `module:${rootSubjectId}`;
    const name = String(
      section.moduleName || section.rootSubjectName || section.name || "",
    ).trim();
    return name ? `module:${name}` : "";
  }

  function findModuleLoadPlan(section: ModuleSection): ModuleLoadPlan | null {
    const key = getModuleLoadKey(section);
    const rootSubjectId = String(section.rootSubjectId || "").trim();
    const name = String(
      section.moduleName || section.rootSubjectName || section.name || "",
    ).trim();
    const plans = Array.isArray(state.moduleLoadPlan) ? state.moduleLoadPlan : [];
    return (
      plans.find((plan) => getModuleLoadKey(plan) === key) ||
      plans.find(
        (plan) => rootSubjectId && String(plan.rootSubjectId || "").trim() === rootSubjectId,
      ) ||
      plans.find(
        (plan) =>
          name &&
          String(plan.moduleName || plan.rootSubjectName || "").trim() === name,
      ) ||
      null
    );
  }

  function getModuleLoadState(section: ModuleSection) {
    const plan = findModuleLoadPlan(section) || section;
    const key = getModuleLoadKey(plan);
    if (!key) return { status: "idle" as const };
    return state.moduleLoadStateMap[key] || { status: "idle" as const };
  }

  function setModuleLoadState(plan: ModuleLoadPlan, nextState: Record<string, unknown>) {
    const key = getModuleLoadKey(plan);
    if (!key) return;
    const previous = state.moduleLoadStateMap[key] || {};
    state.moduleLoadStateMap[key] = {
      ...previous,
      ...nextState,
      moduleKey: key,
      moduleName:
        (nextState.moduleName as string) ||
        plan.moduleName ||
        plan.rootSubjectName ||
        plan.name ||
        (previous as Record<string, unknown>).moduleName ||
        "",
    } as never;
  }

  function isModuleLoading(section: ModuleSection): boolean {
    return getModuleLoadState(section).status === "loading";
  }

  function isModuleLoadError(section: ModuleSection): boolean {
    return getModuleLoadState(section).status === "error";
  }

  function moduleLoadingText(section: ModuleSection): string {
    return (getModuleLoadState(section) as Record<string, unknown>).message as string || "子表数据加载中";
  }

  function moduleLoadErrorText(section: ModuleSection): string {
    return (getModuleLoadState(section) as Record<string, unknown>).message as string || "当前子表数据加载失败";
  }

  // ============================================================
  // 初始化
  // ============================================================

  function initializeModuleLoading(detailRes: Record<string, unknown>) {
    const plans = Array.isArray(detailRes.moduleLoadPlan)
      ? (detailRes.moduleLoadPlan as ModuleLoadPlan[])
      : [];
    state.moduleLoadPlan = plans;
    state.moduleSubjectTreePayload = (detailRes.subjectTreePayload as SubjectTreeNode[]) || null;
    state.modulePatternList = Array.isArray(detailRes.patternList) ? detailRes.patternList : [];
    state.moduleOwnerScoped = detailRes.ownerScoped !== false;
    state.moduleS2Suggestions = Array.isArray(detailRes.s2Suggestions) ? detailRes.s2Suggestions : [];
    state.s2ModuleOpinionMap = {};
    state.s2ModuleSubmitMap = {};
    deps.applyS2ModuleReviewState(detailRes.s2ModuleReviewState as Record<string, unknown>);
    state.moduleRecordMap = {};

    const stateMap: Record<string, unknown> = {};
    plans.forEach((plan) => {
      const key = getModuleLoadKey(plan);
      if (!key) return;
      stateMap[key] = {
        status: detailRes.moduleRecordsPreloaded ? "loaded" : "idle",
        moduleKey: key,
        moduleName: plan.moduleName || plan.rootSubjectName || plan.name || "",
        message: "",
      };
    });
    state.moduleLoadStateMap = stateMap as never;
  }

  // ============================================================
  // 记录收集
  // ============================================================

  function collectLoadedModuleRecords(excludeModuleKey = ""): unknown[] {
    const recordMap = state.moduleRecordMap || {};
    return Object.keys(recordMap).reduce((result: unknown[], key) => {
      if (key === excludeModuleKey) return result;
      const rows = Array.isArray(recordMap[key]) ? recordMap[key] : [];
      result.push(...rows);
      return result;
    }, []);
  }

  function collectLoadedS3ModuleRecords(
    excludeModuleKey = "",
  ): { s1Records: unknown[]; s2Records: unknown[]; s3Records: unknown[] } {
    const recordMap = state.moduleRecordMap || {};
    return Object.keys(recordMap).reduce(
      (result, key) => {
        if (key === excludeModuleKey) return result;
        const entry =
          recordMap[key] && typeof recordMap[key] === "object"
            ? (recordMap[key] as Record<string, unknown>)
            : {};
        result.s1Records.push(
          ...(Array.isArray(entry.s1Records) ? (entry.s1Records as unknown[]) : []),
        );
        result.s2Records.push(
          ...(Array.isArray(entry.s2Records) ? (entry.s2Records as unknown[]) : []),
        );
        result.s3Records.push(
          ...(Array.isArray(entry.s3Records) ? (entry.s3Records as unknown[]) : []),
        );
        return result;
      },
      { s1Records: [] as unknown[], s2Records: [] as unknown[], s3Records: [] as unknown[] },
    );
  }

  // ============================================================
  // 维度同步
  // ============================================================

  function syncActiveDimensionSelection() {
    // 先把 detail 中的年份/版型同步到顶层，再做选中态校正
    deps.syncTopLevelDimensionStateFromDetail();
    state.localYearTrimConfig = buildLocalYearTrimConfig();
    const options = state.displayYearOptions || [];
    const currentYearKey = String(state.activeYearKey || "").trim();
    const currentYearOption = options.find((item) => item.key === currentYearKey);
    if (currentYearOption) {
      if (Number.isInteger(currentYearOption.yearIndex)) {
        state.activeYearIndex = currentYearOption.yearIndex;
      }
    } else {
      const firstOption = options[0] || null;
      state.activeYearKey = firstOption ? firstOption.key : "";
      state.activeYearIndex =
        firstOption && Number.isInteger(firstOption.yearIndex) ? firstOption.yearIndex : 0;
    }

    const trimIds = state.trimOptions.map((item) => item.trimId);
    if (!trimIds.includes(state.activeTrimId)) {
      state.activeTrimId = trimIds[0] || "";
    }
    // 选中态变更后再同步一次 activeYearLabel
    deps.syncTopLevelDimensionStateFromDetail();
  }

  function buildLocalYearTrimConfig(): Record<string, string[]> {
    const detail = state.detail as Record<string, unknown>;
    const yearTrimConfig = detail.yearTrimConfig as Record<string, string[]> | undefined;
    if (yearTrimConfig) return { ...yearTrimConfig };
    return {};
  }

  // ============================================================
  // 模块数据应用
  // ============================================================

  function applySubtableModuleDetail(moduleRes: Record<string, unknown>) {
    if (!moduleRes.detail || typeof moduleRes.detail !== "object") return;
    const previous = (state.detail || {}) as Record<string, unknown>;
    const nextDetail = moduleRes.detail as Record<string, unknown>;
    state.detail = {
      ...previous,
      ...nextDetail,
      lastSavedAt: previous.lastSavedAt || nextDetail.lastSavedAt,
      lastSavedBy: previous.lastSavedBy || nextDetail.lastSavedBy,
    };
    deps.mergeStoredYearsIntoDetail();
    const subjectTree = deps.resolveSubjectTreeNodes(state.moduleSubjectTreePayload);
    if (subjectTree.length) {
      (state.detail as Record<string, unknown>).rows = deps.normalizeRowsBySubjectTree(
        (state.detail as Record<string, unknown>).rows as MatrixRow[],
        subjectTree,
      );
    }
    if (state.fillOpinionMaps) {
      mergeFillOpinionMapToDetail(
        state.detail,
        state.fillOpinionMaps as Record<string, unknown>,
      );
    }
    syncActiveDimensionSelection();
    deps.applyCurrentDetailFormulas();
  }

  // ============================================================
  // 加载追踪日志
  // ============================================================

  function createSubtableModuleLoadTrace(plan: ModuleLoadPlan) {
    return {
      id: ++subtableModuleLoadTraceSeq,
      moduleKey: getModuleLoadKey(plan),
      moduleName: plan.moduleName || plan.rootSubjectName || plan.name || "",
      subjectIds: Array.isArray(plan.subjectIds) ? plan.subjectIds.slice() : [],
      startedAt: deps.getPageTraceNow(),
      startedWallAt: Date.now(),
    };
  }

  function logSubtableModuleStart(trace: ReturnType<typeof createSubtableModuleLoadTrace>) {
     
    console.groupCollapsed(
      `[收益模块加载] 开始 [#${trace.id}] ${deps.formatPageTraceTime(trace.startedWallAt)} ` +
        `${trace.moduleName || trace.moduleKey || "-"}`,
    );
     
    console.log("子表", trace.moduleName || "-");
     
    console.log("开始时间", deps.formatPageTraceTime(trace.startedWallAt));
     
    console.log("subjectIds数量", (trace.subjectIds || []).length);
     
    console.log("subjectIds", trace.subjectIds || []);
     
    console.groupEnd();
  }

  function logSubtableModuleComplete(
    trace: ReturnType<typeof createSubtableModuleLoadTrace>,
    moduleRes: Record<string, unknown>,
  ) {
    const finishedAt = deps.getPageTraceNow();
    const finishedWallAt = Date.now();
    const records = Array.isArray(moduleRes.records) ? moduleRes.records : [];
    const moduleRecords =
      moduleRes.moduleRecords && typeof moduleRes.moduleRecords === "object"
        ? (moduleRes.moduleRecords as Record<string, unknown>)
        : null;
    const moduleRecordCounts = moduleRecords
      ? {
        s1Records: Array.isArray(moduleRecords.s1Records) ? moduleRecords.s1Records.length : 0,
        s2Records: Array.isArray(moduleRecords.s2Records) ? moduleRecords.s2Records.length : 0,
        s3Records: Array.isArray(moduleRecords.s3Records) ? moduleRecords.s3Records.length : 0,
      }
      : null;
    const totalRecordCount = moduleRecordCounts
      ? moduleRecordCounts.s1Records + moduleRecordCounts.s2Records + moduleRecordCounts.s3Records
      : records.length;
     
    console.groupCollapsed(
      `[收益模块加载] 完成 [#${trace.id}] ${deps.formatPageTraceTime(finishedWallAt)} ` +
        `耗时 ${Math.round(finishedAt - trace.startedAt)}ms ${trace.moduleName || trace.moduleKey || "-"}`,
    );
     
    console.log("子表", trace.moduleName || "-");
     
    console.log("开始时间", deps.formatPageTraceTime(trace.startedWallAt));
     
    console.log("返回时间", deps.formatPageTraceTime(finishedWallAt));
     
    console.log("耗时(ms)", Math.round(finishedAt - trace.startedAt));
     
    console.log("subjectIds数量", (trace.subjectIds || []).length);
     
    console.log("返回记录数", totalRecordCount);
    if (moduleRecordCounts) {
       
      console.log("S3来源记录数", moduleRecordCounts);
    }
     
    console.groupEnd();
  }

  function logSubtableModuleFailure(
    trace: ReturnType<typeof createSubtableModuleLoadTrace>,
    error: unknown,
  ) {
    const failedAt = deps.getPageTraceNow();
    const failedWallAt = Date.now();
     
    console.groupCollapsed(
      `[收益模块加载] 失败 [#${trace.id}] ${deps.formatPageTraceTime(failedWallAt)} ` +
        `耗时 ${Math.round(failedAt - trace.startedAt)}ms ${trace.moduleName || trace.moduleKey || "-"}`,
    );
     
    console.log("子表", trace.moduleName || "-");
     
    console.log("开始时间", deps.formatPageTraceTime(trace.startedWallAt));
     
    console.log("失败时间", deps.formatPageTraceTime(failedWallAt));
     
    console.log("耗时(ms)", Math.round(failedAt - trace.startedAt));
     
    console.log("subjectIds数量", (trace.subjectIds || []).length);
     
    console.log("错误", error);
     
    console.groupEnd();
  }

  function logSubtableModuleAllComplete(summary: Record<string, unknown>) {
    const finishedAt = deps.getPageTraceNow();
    const finishedWallAt = Date.now();
     
    console.groupCollapsed(
      `[收益模块加载] 全部完成 ${deps.formatPageTraceTime(finishedWallAt)} ` +
        `成功 ${summary.successCount || 0} 失败 ${summary.errorCount || 0}`,
    );
     
    console.log("开始时间", deps.formatPageTraceTime(summary.startedWallAt as number || finishedWallAt));
     
    console.log("完成时间", deps.formatPageTraceTime(finishedWallAt));
     
    console.log("总耗时(ms)", Math.round(finishedAt - (summary.startedAt as number || finishedAt)));
     
    console.log("子表总数", summary.totalCount || 0);
     
    console.log("成功子表数", summary.successCount || 0);
     
    console.log("失败子表数", summary.errorCount || 0);
     
    console.groupEnd();
  }

  // ============================================================
  // 模块加载核心
  // ============================================================

  async function loadSingleSubtableModule(
    query: Record<string, unknown> = {},
    plan: ModuleLoadPlan,
    options: { runId?: number } = {},
  ): Promise<boolean | null> {
    const moduleKey = getModuleLoadKey(plan);
    if (!moduleKey || !Array.isArray(plan.subjectIds) || !plan.subjectIds.length) return false;
    const trace = createSubtableModuleLoadTrace(plan);
    setModuleLoadState(plan, {
      status: "loading",
      message: `${plan.moduleName || "当前子表"}数据加载中`,
    });
    logSubtableModuleStart(trace);
    try {
      const s3Mode = Boolean(
        state.detail &&
          (state.detail as Record<string, unknown>).s3Confirmation,
      );
      const moduleRes = s3Mode
        ? await fetchSubtableS3ModuleRecords({
          ...query,
          subjectDomain: AUDIT_DOMAIN.SUBTABLE,
          moduleKey,
          moduleName: plan.moduleName || plan.rootSubjectName || plan.name,
          subjectIds: plan.subjectIds,
          subjectTreePayload: state.moduleSubjectTreePayload,
          patternList: state.modulePatternList,
          ownerScoped: state.moduleOwnerScoped,
          loadedModuleRecords: collectLoadedS3ModuleRecords(moduleKey),
          s2Suggestions: state.moduleS2Suggestions,
        } as Record<string, unknown>)
        : await fetchSubtableModuleRecords({
          ...query,
          subjectDomain: AUDIT_DOMAIN.SUBTABLE,
          moduleKey,
          moduleName: plan.moduleName || plan.rootSubjectName || plan.name,
          subjectIds: plan.subjectIds,
          subjectTreePayload: state.moduleSubjectTreePayload,
          patternList: state.modulePatternList,
          ownerScoped: state.moduleOwnerScoped,
          loadedRecords: collectLoadedModuleRecords(moduleKey),
        } as Record<string, unknown>);
      if (options.runId && options.runId !== state.moduleLoadRunId) return null;
      deps.applyS2ModuleReviewState((moduleRes.s2ModuleReviewState as Record<string, unknown>) || {});
      state.moduleRecordMap[moduleKey] = s3Mode
        ? (moduleRes.moduleRecords || {})
        : (Array.isArray(moduleRes.records) ? moduleRes.records : []) as never;
      applySubtableModuleDetail(moduleRes as Record<string, unknown>);
      setModuleLoadState(plan, {
        status: "loaded",
        message: "",
        loadedAt: Date.now(),
      });
      logSubtableModuleComplete(trace, moduleRes as Record<string, unknown>);
      return true;
    } catch (error) {
      if (options.runId && options.runId !== state.moduleLoadRunId) return null;
      const message =
        (error as Error).message ||
        `${plan.moduleName || "当前子表"}数据加载失败`;
      setModuleLoadState(plan, {
        status: "error",
        message,
        error,
      });
      logSubtableModuleFailure(trace, error);
      return false;
    }
  }

  async function loadSubtableModulesSerially(query: Record<string, unknown> = {}) {
    const plans = Array.isArray(state.moduleLoadPlan) ? state.moduleLoadPlan : [];
    if (!plans.length) return;
    const runId = ++state.moduleLoadRunId;
    const summary = {
      startedAt: deps.getPageTraceNow(),
      startedWallAt: Date.now(),
      totalCount: plans.length,
      successCount: 0,
      errorCount: 0,
    };
    for (let index = 0; index < plans.length; index += 1) {
      if (runId !== state.moduleLoadRunId) return;
       
      const result = await loadSingleSubtableModule(query, plans[index], { runId });
      if (result === true) summary.successCount += 1;
      if (result === false) summary.errorCount += 1;
    }
    logSubtableModuleAllComplete(summary);
  }

  async function retryLoadModule(section: ModuleSection) {
    const plan = findModuleLoadPlan(section);
    if (!plan || isModuleLoading({ ...plan, name: "" } as ModuleSection)) return;
    const query = state.moduleBaseQuery || {};
    const result = await loadSingleSubtableModule(query, plan);
    if (result === true) {
      await deps.loadFormulaSourceDetail(query);
      await refreshStageCompletionSummary();
    }
  }

  // ============================================================
  // 完整页面加载
  // ============================================================

  /** 从库拉取流程最近保存时间（失败不影响进页） */
  async function refreshLastSavedInfoFromServer() {
    const project = (state.project || {}) as Record<string, unknown>;
    const detail = (state.detail || {}) as Record<string, unknown>;
    const rawFlowId =
      state.queryFlowId ??
      state.activeFlowId ??
      project.flowId ??
      detail.flowId;
    const flowIdText = String(rawFlowId == null ? "" : rawFlowId).trim();
    if (!flowIdText || flowIdText === "[object Object]") {
      return;
    }
    const flowId: string | number = /^\d+$/.test(flowIdText)
      ? Number(flowIdText)
      : flowIdText;
    try {
      const payload = (await getProjectCostFlowLastSave(flowId)) as Record<string, unknown>;
      const data =
        payload && typeof payload.data === "object" && payload.data
          ? (payload.data as Record<string, unknown>)
          : payload;
      const lastSavedAt = String(data?.lastSavedAt == null ? "" : data.lastSavedAt).trim();
      const lastSavedBy = String(data?.lastSavedBy == null ? "" : data.lastSavedBy).trim();
      state.detail = {
        ...(state.detail as Record<string, unknown>),
        lastSavedAt: lastSavedAt || "-",
        lastSavedBy: lastSavedBy || "-",
      };
    } catch (error) {
      console.warn("[refreshLastSavedInfoFromServer] failed", error);
    }
  }

  async function loadPage() {
    const renderTrace = deps.createPageRenderTrace();
    let dataReadyAt = 0;
    let dataReadyWallAt = 0;
    let dataReadySummary: Record<string, unknown> | null = null;
    state.loading = true;
    state.ownerSubmitDraftLocked = false;
    try {
      if (typeof deps.syncRuntimeFlagsToState === "function") {
        deps.syncRuntimeFlagsToState();
      }
      if (!state.queryProjectId) {
        throw new Error("当前链接缺少项目 ID，请从收益流程列表重新进入");
      }
      // query 构造对齐 Vue2 module-loading.mixin.js（487d70cc 同逻辑）
      // - 不透传 URL subjectDomain（默认 subtable）
      // - subjectApiMode：最终提交强制 all，否则透传 URL；不擅自改写成 permission
      // - view_submit 仅设 subjectScope=template，不再额外强制 all
      const query: Record<string, unknown> = {
        projectId: state.queryProjectId,
        flowId: state.queryFlowId,
        projectCode: state.queryProjectCode,
        projectName: state.queryProjectName,
        userId: state.queryUserId,
        userName: state.queryUserName,
        // S3 本人草稿过滤：与后端 ownerId（登录名）对齐
        ownerUserId: state.queryOwnerUserId || undefined,
        permissionKey: state.queryPermissionKey,
        fullAccess: state.hasAllPermission,
        stage: state.queryStage,
        valve: state.queryValve,
        s1FlowFillPermission:
          state.isS1FlowPermissionEntry && state.hasS1FlowFillPermission,
        s1FlowSubmitPermission:
          state.isS1FlowPermissionEntry && state.hasS1FlowSubmitPermission,
        s1FlowCancelSubmitPermission:
          state.isS1FlowPermissionEntry && state.hasS1FlowCancelSubmitPermission,
      };
      if (state.showStageFinalSubmitAction) {
        query.subjectApiMode = "all";
      } else if (state.querySubjectApiMode) {
        query.subjectApiMode = state.querySubjectApiMode;
      }
      // 仅编辑模式按用户授权裁剪；查看与提交都是模板全集（全量查看）
      if (state.flowPageMode === "view_submit") {
        query.subjectScope = "template";
      }

      state.moduleBaseQuery = query;
      state.fillOpinionMaps = null;
      state.formulaSourceDetail = null;
      const detailRes = (await withTimeout(
        fetchSubtableFillShell(query),
        FILL_SHELL_LOAD_TIMEOUT_MS,
        "页面数据加载超时，请刷新重试",
      )) as Record<string, unknown>;

      // 先落项目信息并关闭遮罩，避免后续同步重活把「加载中」卡死
      state.project = (detailRes.project as Record<string, unknown>) || state.project;
      if (typeof deps.syncRuntimeFlagsToState === "function") {
        deps.syncRuntimeFlagsToState();
      }
      state.currentUser =
        state.queryUserId ||
        ((detailRes.permissions as Record<string, unknown>)?.viewer as string) ||
        state.currentUser ||
        "1";
      state.currentUserName =
        state.queryUserName || state.currentUserName || state.currentUser || "当前用户";
      if (deps.redirectToStageDetailIfNeeded()) return;
      // 壳层已返回：先关遮罩（大表由模板 v-if 暂缓，避免 Vue3 深度 reactive 堵死）
      state.loading = false;

      // 让出主线程一帧，避免壳层同步组装后立刻深度 reactive + 大表渲染堵死
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 0);
      });

      state.detail = (detailRes.detail as Record<string, unknown>) || state.detail;
      deps.mergeStoredYearsIntoDetail();
      // 顶栏「最近保存」从库拉取，避免从项目列表重新进入后丢失
      await refreshLastSavedInfoFromServer();
      initializeModuleLoading(detailRes);

      const subjectTree = deps.resolveSubjectTreeNodes(detailRes.subjectTreePayload);
      const visibleMap: Record<string, boolean> = {};
      const writableMap: Record<string, boolean> = {};
      if (subjectTree.length) {
        deps.collectVisibleSubjectIds(subjectTree, visibleMap);
        deps.collectSubjectIds(subjectTree, writableMap);
      } else {
        deps.collectVisibleRowSubjectIds(
          ((state.detail as Record<string, unknown>).rows || []) as MatrixRow[],
          visibleMap,
        );
        deps.collectRowSubjectIds(
          ((state.detail as Record<string, unknown>).rows || []) as MatrixRow[],
          writableMap,
        );
      }
      state.visibleSubjectMap = visibleMap;
      state.writableSubjectMap = writableMap;
      if (subjectTree.length) {
        (state.detail as Record<string, unknown>).rows = deps.normalizeRowsBySubjectTree(
          ((state.detail as Record<string, unknown>).rows || []) as MatrixRow[],
          subjectTree,
        );
      }
      syncActiveDimensionSelection();
      state.cellInputDrafts = {};
      state.cellInputOriginals = {};
      state.activeS3PopoverKey = "";
      state.s3CellEditor = {
        key: "",
        row: null,
        column: null,
        choice: "",
        customValue: "",
        opinion: "",
      };
      deps.clearDataImportCompareState();
      await loadFillCellOpinions(query);
      await deps.loadSubjectNotes(query);
      await loadS1ModuleReviewState(query);
      await loadS3ModuleOpinions(query);
      await loadFlowOpinionCards(query);
      if (!detailRes.moduleRecordsPreloaded) {
        await loadSubtableModulesSerially(query);
      }
      await deps.loadFormulaSourceDetail(query);
      syncActiveDimensionSelection();
      await refreshStageCompletionSummary();
      dataReadyAt = deps.getPageTraceNow();
      dataReadyWallAt = Date.now();
      dataReadySummary = deps.buildPageRenderSummary();
      deps.scheduleManagementRateInputScopeDiagnostics();

      // ===== 最终诊断：页面加载完成后输出完整状态 =====
      if (typeof window !== "undefined") {
        const detail = state.detail as Record<string, unknown>;
        const allRows = (Array.isArray(detail.rows) ? detail.rows : []) as MatrixRow[];
        const moduleRecordMap = state.moduleRecordMap as Record<string, unknown> || {};
        let totalRecords = 0;
        const recordCountsByModule: Record<string, number> = {};
        Object.keys(moduleRecordMap).forEach((key) => {
          const val = moduleRecordMap[key];
          if (Array.isArray(val)) {
            recordCountsByModule[key] = val.length;
            totalRecords += val.length;
          } else if (val && typeof val === "object") {
            const entry = val as Record<string, unknown>;
            const s1 = Array.isArray(entry.s1Records) ? (entry.s1Records as unknown[]).length : 0;
            const s2 = Array.isArray(entry.s2Records) ? (entry.s2Records as unknown[]).length : 0;
            const s3 = Array.isArray(entry.s3Records) ? (entry.s3Records as unknown[]).length : 0;
            recordCountsByModule[key] = s1 + s2 + s3;
            totalRecords += s1 + s2 + s3;
          }
        });
        const rowsWithCells = allRows.filter((r) =>
          (r.cells && Object.keys(r.cells as object).length > 0) ||
          (r.cellMap && Object.keys(r.cellMap as object).length > 0)
        );
        const salesVolumeRows = allRows.filter((r) => r.moduleCode === "sales_volume" || r.moduleCode === "SALES_VOLUME");
        const salesVolumeRowsWithCells = salesVolumeRows.filter((r) =>
          r.cells && Object.keys(r.cells as object).length > 0
        );
        const mainRows = allRows.filter((r) => r.moduleCode === "main_pnl" || r.moduleCode === "MAIN_PNL");
        const mainRowsWithCells = mainRows.filter((r) =>
          (r.cells && Object.keys(r.cells as object).length > 0) ||
          (r.cellMap && Object.keys(r.cellMap as object).length > 0)
        );
        // 收集所有 records 的 subjectId，用于判断 records 是否包含主表行数据
        const allRecordSubjectIds = new Set<string>();
        Object.keys(moduleRecordMap).forEach((key) => {
          const val = moduleRecordMap[key];
          if (Array.isArray(val)) {
            (val as Array<Record<string, unknown>>).forEach((r) => {
              const sid = String(r?.subjectId || r?.subject_id || "");
              if (sid) allRecordSubjectIds.add(sid);
            });
          } else if (val && typeof val === "object") {
            const entry = val as Record<string, unknown>;
            ["s1Records", "s2Records", "s3Records"].forEach((rk) => {
              if (Array.isArray(entry[rk])) {
                (entry[rk] as Array<Record<string, unknown>>).forEach((r) => {
                  const sid = String(r?.subjectId || r?.subject_id || "");
                  if (sid) allRecordSubjectIds.add(sid);
                });
              }
            });
          }
        });
        const mainRowSubjectIds = mainRows.map((r) => String(r.subjectId || "")).filter(Boolean);
        const mainRowSubjectIdsWithRecords = mainRowSubjectIds.filter((sid) => allRecordSubjectIds.has(sid));
        const formulaSourceDetail = state.formulaSourceDetail as Record<string, unknown> | null;
        console.groupCollapsed("[页面加载完成诊断] 最终数据状态");
        console.log("detail.rows 总数:", allRows.length);
        console.log("有 cells 数据的行数:", rowsWithCells.length);
        console.log("moduleRecordMap keys:", Object.keys(moduleRecordMap));
        console.log("各模块 records 数量:", recordCountsByModule);
        console.log("总 records 数量:", totalRecords);
        console.log("formulaSourceDetail:", formulaSourceDetail ? "已加载" : "为空",
          formulaSourceDetail && Array.isArray(formulaSourceDetail.rows) ? `(${(formulaSourceDetail.rows as unknown[]).length} rows)` : "");
        console.log("销量表(sales_volume)行数:", salesVolumeRows.length,
          "| 其中有数据的行数:", salesVolumeRowsWithCells.length);
        if (salesVolumeRows.length) {
          console.log("销量表行样例:", salesVolumeRows.slice(0, 3).map((r) => ({
            path: [r.rootSubjectName, r.subtable, r.subjectName || r.subject].filter(Boolean).join("/"),
            subjectId: r.subjectId,
            cellsKeys: r.cells ? Object.keys(r.cells as object).slice(0, 5) : [],
            cellMapKeys: r.cellMap ? Object.keys(r.cellMap as object).slice(0, 5) : [],
          })));
        }
        console.log("主表(main_pnl)行数:", mainRows.length,
          "| 其中有数据的行数:", mainRowsWithCells.length,
          "| 其中有 records 的行数:", mainRowSubjectIdsWithRecords.length);
        console.log("主表行 subjectId 是否在 records 中:", mainRowSubjectIdsWithRecords.length > 0 ? "部分匹配" : "完全不匹配");
        if (mainRows.length) {
          const sampleRows = mainRows.slice(0, 10);
          const sampleDetails = sampleRows.map((r) => ({
            path: [r.rootSubjectName, r.subtable, r.subjectName || r.subject].filter(Boolean).join("/"),
            subjectId: r.subjectId,
            moduleCode: r.moduleCode,
            entryMode: r.templateEntryMode || r.entryMode,
            calculated: r.calculated,
            hasRecord: allRecordSubjectIds.has(String(r.subjectId || "")),
            cellsKeys: r.cells ? Object.keys(r.cells as object).slice(0, 5) : [],
            cellMapKeys: r.cellMap ? Object.keys(r.cellMap as object).slice(0, 5) : [],
            formulaExpression: r.formulaExpression || "",
            formulaId: r.formulaId,
            formulaParamBindingsLen: Array.isArray(r.formulaParamBindings) ? (r.formulaParamBindings as unknown[]).length : 0,
          }));
          console.log("主表行详细:");
          sampleDetails.forEach((d) => console.log("  ", d));
          // 输出第一行的完整 templateItem 结构
          const firstRow = mainRows[0];
          if (firstRow && firstRow.templateItem) {
            console.log("第一行 templateItem 字段:", Object.keys(firstRow.templateItem as object));
            const ti = firstRow.templateItem as Record<string, unknown>;
            console.log("  entryMode:", ti.entryMode, "| dataSourceType:", ti.dataSourceType,
              "| data_source_type:", ti.data_source_type, "| sourceType:", ti.sourceType);
            console.log("  formulaExpression:", ti.formulaExpression, "| formulaId:", ti.formulaId,
              "| formulaParamBindings:", ti.formulaParamBindings);
          }
        }
        console.groupEnd();
      }
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message || "")
          : "";
      ElMessage.error(message || "页面加载失败，请刷新重试");
    } finally {
      state.loading = false;
      if (dataReadyAt) {
        try {
          await deps.logPageRenderTiming(
            renderTrace,
            dataReadyAt,
            dataReadyWallAt,
            dataReadySummary!,
          );
        } catch {
          // 渲染耗时日志不阻断页面主流程。
        }
      }
    }
  }

  // ============================================================
  // 意见加载
  // ============================================================

  async function loadFillCellOpinions(query: Record<string, unknown> = {}) {
    try {
      // 使用动态导入避免循环依赖
      const { listSubtableFillCellOpinions } = await import(
        "@/pages/revenue/subtable-workbench/service"
      );
      const opinionMaps = await listSubtableFillCellOpinions({
        ...query,
        userId: state.currentUser || query.userId,
        stage: state.currentStageCode || query.stage,
        stageCode: state.currentStageCode || query.stage,
        subjectDomain: AUDIT_DOMAIN.SUBTABLE,
      });
      state.fillOpinionMaps = opinionMaps as unknown;
      mergeFillOpinionMapToDetail(
        state.detail,
        opinionMaps as Record<string, unknown>,
      );
    } catch {
      // 意见加载失败不阻断填报主流程。
    }
  }

  async function loadFlowOpinionCards(query: Record<string, unknown> = {}) {
    try {
      const result = await loadFlowOpinionTimelineEntry({
        ...query,
        userId: state.currentUser || query.userId,
        stage: state.currentStageCode || query.stage,
        stageCode: state.currentStageCode || query.stage,
      });
      state.flowOpinionItems = ((result as Record<string, unknown>)?.items as unknown[]) || [];
    } catch {
      state.flowOpinionItems = [];
    }
  }

  async function loadS1ModuleReviewState(query: Record<string, unknown> = {}) {
    if (!state.isS1FlowPermissionEntry || state.currentStageCode !== "S1") {
      deps.applyS1ModuleReviewState({});
      return;
    }
    try {
      const stateRes = await listSubtableAuditModuleReviewState({
        ...query,
        userId: state.currentUser || query.userId,
        stage: "S1",
        stageCode: "S1",
        subjectDomain: AUDIT_DOMAIN.SUBTABLE,
        includeReviewerFilter: false,
      });
      deps.applyS1ModuleReviewState(stateRes as Record<string, unknown>);
    } catch {
      deps.applyS1ModuleReviewState({});
    }
  }

  /** 进页回读 S3 二次确认模块意见（DRAFT/已提交均纳入 opinionMap） */
  async function loadS3ModuleOpinions(query: Record<string, unknown> = {}) {
    state.s3ModuleOpinionDraftMap = {};
    state.s3ModuleOpinionReeditMap = {};
    if (String(state.currentStageCode || "").toUpperCase() !== "S3") {
      state.s3ModuleOpinionMap = {};
      return;
    }
    try {
      const reviewState = (await listSubtableAuditModuleReviewState({
        ...query,
        userId: state.currentUser || query.userId,
        stage: "S3",
        stageCode: "S3",
        subjectDomain: AUDIT_DOMAIN.SUBTABLE,
        includeReviewerFilter: false,
      })) as Record<string, unknown>;
      state.s3ModuleOpinionMap =
        (reviewState && reviewState.opinionMap && typeof reviewState.opinionMap === "object"
          ? (reviewState.opinionMap as Record<string, string>)
          : {}) || {};
    } catch {
      state.s3ModuleOpinionMap = {};
    }
  }

  async function ensureS1ModuleCanSubmitLatest(
    section: ModuleSection,
  ): Promise<{ ok: boolean; message?: string; state?: unknown }> {
    if (!state.isS1FlowPermissionEntry || state.currentStageCode !== "S1") {
      return { ok: true };
    }
    if (deps.isS1ModuleOpinionReediting(section)) {
      return { ok: true };
    }
    try {
      const reviewState = await listSubtableAuditModuleReviewState({
        ...deps.buildSaveDraftParams(),
        ...deps.buildS1ModuleSaveParams(section),
        userId: state.currentUser || state.queryUserId,
        stage: "S1",
        stageCode: "S1",
        subjectDomain: AUDIT_DOMAIN.SUBTABLE,
        includeReviewerFilter: false,
      });
      const submitted = hasS1ModuleSubmittedInReviewState(
        reviewState as Record<string, unknown>,
        deps.resolveS1ModuleOpinionKeys(section),
      );
      if (!submitted) return { ok: true, state: reviewState };
      deps.applyS1ModuleReviewState(reviewState as Record<string, unknown>);
      return {
        ok: false,
        message: "当前子表已被提交，请刷新后查看；如需修改请执行重新编辑",
      };
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message || "")
          : "";
      return {
        ok: false,
        message: message || "当前子表状态已变化，请刷新后重试",
      };
    }
  }

  async function refreshStageCompletionSummary() {
    if (!state.showStageFinalSubmitAction) {
      state.stageCompletionSummary = null;
      return;
    }
    const result = await buildStageCompletionSummary({
      ...deps.buildSaveDraftParams(),
      subjectApiMode: "all",
    });
    state.stageCompletionSummary = result || null;
  }

  return {
    getModuleLoadKey,
    findModuleLoadPlan,
    getModuleLoadState,
    setModuleLoadState,
    isModuleLoading,
    isModuleLoadError,
    moduleLoadingText,
    moduleLoadErrorText,
    initializeModuleLoading,
    collectLoadedModuleRecords,
    collectLoadedS3ModuleRecords,
    syncActiveDimensionSelection,
    buildLocalYearTrimConfig,
    applySubtableModuleDetail,
    createSubtableModuleLoadTrace,
    logSubtableModuleStart,
    logSubtableModuleComplete,
    logSubtableModuleFailure,
    logSubtableModuleAllComplete,
    loadSingleSubtableModule,
    loadSubtableModulesSerially,
    retryLoadModule,
    loadPage,
    loadFillCellOpinions,
    loadFlowOpinionCards,
    loadS1ModuleReviewState,
    loadS3ModuleOpinions,
    ensureS1ModuleCanSubmitLatest,
    refreshStageCompletionSummary,
  };
}
