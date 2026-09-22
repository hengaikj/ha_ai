/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
/**
 * 收益填报页·S1 模块流程 composable
 *
 * 承载子表填报页"按模块的意见 + 提交 + 重新编辑"状态机。
 * 原 mixin: s1-module-flow.mixin.js
 */
import s1WorkflowGuards from "@/pages/revenue/subtable-workbench/s1-workflow-guards";
import { isSavableMatrixColumn } from "@/pages/revenue/subtable-workbench/matrix-utils";
import { AUDIT_DOMAIN } from "@/pages/revenue/subtable-workbench/domain-config";
import type {
  RevenueFillState,
  ModuleSection,
  MatrixRow,
  MatrixColumn,
} from "@/types/revenue";

const {
  canShowS1ModuleReeditAction,
  collectS1ModuleSubmitTargets,
  hasS1ModuleSubmittedInReviewState,
} = s1WorkflowGuards;

/** 其他 composable 依赖注入 */
export interface S1ModuleFlowDeps {
  resolveMatrixRow: (row: MatrixRow) => MatrixRow;
  isSubjectTreeParent: (row: MatrixRow) => boolean;
  isEditableInputRow: (row: MatrixRow) => boolean;
  isColumnFillableByInputScope: (row: MatrixRow, column: MatrixColumn) => boolean;
  getCellRecordMeta: (row: MatrixRow, column: MatrixColumn) => unknown;
  normalizeSubjectId: (value: unknown) => string;
  normalizeExactSubjectName: (value: unknown) => string;
  displayUiText: (value: unknown) => string;
  resolveRowSubjectId: (row: MatrixRow) => string;
  resolveModuleSectionBySource: (source: unknown) => ModuleSection | null;
  isMainPnlSection: (section: ModuleSection) => boolean;
  rowAllActionColumns: (row: MatrixRow) => MatrixColumn[];
  appendUniquePositiveNumber: (list: (string | number)[], id: unknown) => void;
  buildSaveDraftParams: () => Record<string, unknown>;
}

export function useRevenueS1ModuleFlow(state: RevenueFillState, deps: S1ModuleFlowDeps) {
  // ============================================================
  // S2 模块状态
  // ============================================================

  function normalizeS2ModuleOpinionMap(mapState: Record<string, unknown>) {
    const map =
      mapState && mapState.opinionMap && typeof mapState.opinionMap === "object"
        ? (mapState.opinionMap as Record<string, string>)
        : {};
    return Array.isArray(map) ? {} : map;
  }

  function normalizeS2ModuleSubmitMap(mapState: Record<string, unknown>) {
    const map =
      mapState && mapState.submitMap && typeof mapState.submitMap === "object"
        ? (mapState.submitMap as Record<string, unknown>)
        : {};
    return Array.isArray(map) ? {} : map;
  }

  function applyS2ModuleReviewState(mapState: Record<string, unknown>) {
    const opinionMap = normalizeS2ModuleOpinionMap(mapState);
    Object.keys(opinionMap).forEach((key) => {
      state.s2ModuleOpinionMap[key] = opinionMap[key];
    });
    const submitMap = normalizeS2ModuleSubmitMap(mapState);
    Object.keys(submitMap).forEach((key) => {
      state.s2ModuleSubmitMap[key] = submitMap[key];
    });
  }

  function resolveS2ModuleOpinionKeys(section: ModuleSection): string[] {
    const keys: string[] = [];
    const push = (value: unknown) => {
      const key = String(value == null ? "" : value).trim();
      if (key && keys.indexOf(key) === -1) keys.push(key);
    };
    const pushSource = (source: Record<string, unknown>) => {
      if (!source || typeof source !== "object") return;
      push(source.rootSubjectId);
      push(source.moduleKey);
      push(source.key);
      push(source.moduleName);
      push(source.name);
      push(source.rootSubjectName);
      push(source.subtable);
      push(source.__moduleRootId);
      push(source.__moduleRootName);
    };
    pushSource(section);
    pushSource(section.__sourceRow as Record<string, unknown>);
    const firstRow = (section.rows || [])[0] || (section.sourceRows || [])[0] || {};
    pushSource(firstRow as Record<string, unknown>);
    return keys;
  }

  function resolveS2ModuleSubmit(section: ModuleSection): unknown {
    const map = state.s2ModuleSubmitMap || {};
    const keys = resolveS2ModuleOpinionKeys(section);
    for (let index = 0; index < keys.length; index += 1) {
      if (Object.prototype.hasOwnProperty.call(map, keys[index])) {
        return map[keys[index]];
      }
    }
    return null;
  }

  function resolveS2ModuleOpinion(section: ModuleSection): string {
    const map = state.s2ModuleOpinionMap || {};
    const keys = resolveS2ModuleOpinionKeys(section);
    for (let index = 0; index < keys.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(map, keys[index])) continue;
      const opinion = String(map[keys[index]] == null ? "" : map[keys[index]]).trim();
      if (opinion) return opinion;
    }
    return "";
  }

  function shouldShowS2ModuleOpinionCard(section: ModuleSection): boolean {
    return state.isS3ConfirmationStage && Boolean(resolveS2ModuleOpinion(section));
  }

  function resolveS2ModuleOpinionTitle(section: ModuleSection): string {
    const name =
      section.name ||
      section.moduleName ||
      section.rootSubjectName ||
      section.subtable ||
      "未命名";
    return `S2子表整体意见（${deps.displayUiText(name)}）`;
  }

  // ============================================================
  // S1 模块状态
  // ============================================================

  function normalizeS1ModuleReviewState(mapState: Record<string, unknown>) {
    return {
      opinionMap:
        mapState &&
          mapState.opinionMap &&
          typeof mapState.opinionMap === "object" &&
          !Array.isArray(mapState.opinionMap)
          ? (mapState.opinionMap as Record<string, string>)
          : {},
      submitMap:
        mapState &&
          mapState.submitMap &&
          typeof mapState.submitMap === "object" &&
          !Array.isArray(mapState.submitMap)
          ? (mapState.submitMap as Record<string, unknown>)
          : {},
      timeline: Array.isArray(mapState && mapState.timeline) ? mapState.timeline : [],
    };
  }

  function applyS1ModuleReviewState(mapState: Record<string, unknown>) {
    const normalized = normalizeS1ModuleReviewState(mapState);
    state.s1ModuleOpinionMap = normalized.opinionMap;
    state.s1ModuleSubmitMap = normalized.submitMap;
    state.s1ModuleTimeline = normalized.timeline as never;
    state.s1ModuleOpinionDraftMap = {};
    state.s1ModuleDraftTargetMap = {};
    state.s1ModuleOpinionLockedMap = {};
    state.s1ModuleOpinionReeditMap = {};
    // 仅锁定「已提交」模块；重新编辑退回草稿后不应因历史意见误锁输入框
    Object.keys(normalized.submitMap || {}).forEach((key) => {
      state.s1ModuleOpinionLockedMap[key] = true;
    });
  }

  function resolveS1ModuleOpinionKeys(section: ModuleSection): string[] {
    // 与写入共用含兜底的 key 列表，避免提交后 isS1ModuleSubmitted 读不到 submitMap
    return resolveS1ModuleWriteKeys(section);
  }

  function resolveS1ModuleWriteKeys(section: ModuleSection): string[] {
    const keys = resolveS2ModuleOpinionKeys(section);
    if (keys.length) return keys;
    // 兜底：避免 keys 为空时写入失败，导致意见无法回显/提交
    const fallback = String(
      section.key ||
        section.moduleKey ||
        section.rootSubjectId ||
        section.name ||
        section.moduleName ||
        section.rootSubjectName ||
        "",
    ).trim();
    return fallback ? [fallback] : [];
  }

  function readS1ModuleMap(
    mapName: keyof RevenueFillState,
    section: ModuleSection,
  ): unknown {
    const map = (state[mapName] || {}) as Record<string, unknown>;
    const keys = resolveS1ModuleWriteKeys(section);
    for (let index = 0; index < keys.length; index += 1) {
      if (Object.prototype.hasOwnProperty.call(map, keys[index])) {
        return map[keys[index]];
      }
    }
    return undefined;
  }

  function writeS1ModuleMap(
    mapName: keyof RevenueFillState,
    section: ModuleSection,
    value: unknown,
  ) {
    const keys = resolveS1ModuleWriteKeys(section);
    if (!keys.length) return;
    // 整体替换 map，确保 Vue 响应式能驱动输入框回显
    const prev = {
      ...(((state[mapName] || {}) as Record<string, unknown>) || {}),
    };
    keys.forEach((key) => {
      prev[key] = value;
    });
    (state as Record<string, unknown>)[mapName as string] = prev;
  }

  function deleteS1ModuleMap(mapName: keyof RevenueFillState, section: ModuleSection) {
    const keys = resolveS1ModuleWriteKeys(section);
    if (!keys.length) return;
    const prev = {
      ...(((state[mapName] || {}) as Record<string, unknown>) || {}),
    };
    keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(prev, key)) delete prev[key];
    });
    (state as Record<string, unknown>)[mapName as string] = prev;
  }

  function resolveS1ModuleOpinion(section: ModuleSection): string {
    const draft = readS1ModuleMap("s1ModuleOpinionDraftMap" as keyof RevenueFillState, section);
    if (draft !== undefined) return String(draft || "");
    const saved = readS1ModuleMap("s1ModuleOpinionMap" as keyof RevenueFillState, section);
    return String(saved || "");
  }

  function setS1ModuleOpinion(section: ModuleSection, value = "") {
    writeS1ModuleMap("s1ModuleOpinionDraftMap" as keyof RevenueFillState, section, value);
  }

  function hasS1ModuleSavedOpinion(section: ModuleSection): boolean {
    const saved = readS1ModuleMap("s1ModuleOpinionMap" as keyof RevenueFillState, section);
    if (saved === undefined) return false;
    // 空字符串不算「已有意见」，避免误锁输入框
    return String(saved || "").trim().length > 0;
  }

  function isS1ModuleOpinionReediting(section: ModuleSection): boolean {
    return Boolean(readS1ModuleMap("s1ModuleOpinionReeditMap" as keyof RevenueFillState, section));
  }

  function isS1ModuleOpinionLocked(section: ModuleSection): boolean {
    if (isS1ModuleOpinionReediting(section)) return false;
    if (isS1ModuleSubmitted(section)) return true;
    // 未提交（含重新编辑退回草稿）时不锁意见
    return false;
  }

  function canReeditS1ModuleOpinion(section: ModuleSection): boolean {
    return canReeditS1Subtable(section);
  }

  function enableS1ModuleOpinionReedit(section: ModuleSection) {
    if (!canReeditS1ModuleOpinion(section)) return;
    writeS1ModuleMap("s1ModuleOpinionReeditMap" as keyof RevenueFillState, section, true);
  }

  function restoreS1ModuleOpinionAfterReedit(
    section: ModuleSection,
    previousOpinion = "",
  ) {
    const opinion = String(previousOpinion == null ? "" : previousOpinion);
    deleteS1ModuleMap("s1ModuleSubmitMap" as keyof RevenueFillState, section);
    deleteS1ModuleMap("s1ModuleOpinionLockedMap" as keyof RevenueFillState, section);
    writeS1ModuleMap("s1ModuleOpinionReeditMap" as keyof RevenueFillState, section, true);
    if (opinion.trim()) {
      writeS1ModuleMap("s1ModuleOpinionDraftMap" as keyof RevenueFillState, section, opinion);
    }
  }

  function resolveS1ModuleSubmit(section: ModuleSection): unknown {
    return readS1ModuleMap("s1ModuleSubmitMap" as keyof RevenueFillState, section);
  }

  function isS1ModuleSubmitted(section: ModuleSection): boolean {
    return hasS1ModuleSubmittedInReviewState(
      { submitMap: state.s1ModuleSubmitMap },
      resolveS1ModuleOpinionKeys(section),
    );
  }

  // ============================================================
  // 工具栏 & 权限
  // ============================================================

  function shouldShowS1ModuleToolbar(section: ModuleSection): boolean {
    return (
      state.isS1FlowPermissionEntry &&
      state.currentStageCode === "S1" &&
      canSaveS1ModuleDraft(section)
    );
  }

  function shouldShowS1ModuleOpinionCard(section: ModuleSection): boolean {
    return (
      state.isS1FlowPermissionEntry &&
      state.currentStageCode === "S1" &&
      !deps.isMainPnlSection(section)
    );
  }

  function resolveS1ModuleOpinionTitle(_section?: ModuleSection): string {
    return "填报意见";
  }

  function canEditS1ModuleOpinion(section: ModuleSection): boolean {
    return canSaveS1ModuleDraft(section) && !isS1ModuleOpinionLocked(section);
  }

  function canSaveS1ModuleDraft(section: ModuleSection): boolean {
    return (
      state.currentStageCode === "S1" &&
      state.canEditFill &&
      !state.isAnyModuleLoading &&
      !state.hasModuleLoadErrors &&
      !state.ownerSubmitDraftLocked &&
      !isS1ModuleSubmitted(section) &&
      collectS1ModuleVisibleSubjectIds(section).length > 0
    );
  }

  function canImportS1ModuleDraft(section: ModuleSection): boolean {
    return canSaveS1ModuleDraft(section);
  }

  function canSubmitS1Module(section: ModuleSection): boolean {
    return !deps.isMainPnlSection(section) && canSaveS1ModuleDraft(section);
  }

  function resolveS1ModuleSubmitHint(section: ModuleSection): string {
    if (canSubmitS1Module(section)) return "";
    if (deps.isMainPnlSection(section)) return "主表由最终提交统一生成，无需单独提交";
    if (isS1ModuleSubmitted(section)) return "当前表已提交，需重新编辑后才能再次提交";
    if (!state.canEditFill) return "当前账号无子表填报权限";
    if (state.isAnyModuleLoading || state.hasModuleLoadErrors) return "子表数据仍在加载或存在加载失败";
    return "";
  }

  // ============================================================
  // 提交目标收集
  // ============================================================

  function resolveS1SubtableActionKey(source: Record<string, unknown>, action = ""): string {
    const key = String(
      source.key ||
      source.moduleKey ||
      source.rootSubjectId ||
      source.rootSubjectName ||
      source.moduleName ||
      source.name ||
      source.subtable ||
      "unknown",
    ).trim();
    return `${action}:${key}`;
  }

  function isS1SubtableSubmitting(section: ModuleSection): boolean {
    return (
      state.s1SubtableSubmittingKey ===
      resolveS1SubtableActionKey(section as unknown as Record<string, unknown>, "submit")
    );
  }

  function isS1SubtableActionLoading(source: Record<string, unknown>, action = ""): boolean {
    return (
      state.s1SubtableActionLoadingKey === resolveS1SubtableActionKey(source, action)
    );
  }

  function appendUniquePositiveNumber(
    list: (string | number)[],
    id: unknown,
  ) {
    const num = Number(id);
    if (!Number.isFinite(num) || num <= 0) return;
    if (!list.includes(num)) list.push(num);
  }

  function collectS1SubtableSubmittedTargets(source: ModuleSection) {
    const module = deps.resolveModuleSectionBySource(source) || source;
    const rows = Array.isArray(module.rows) ? module.rows : [];
    const targetRecordIds: (string | number)[] = [];
    const targetSubmitIds: (string | number)[] = [];

    const appendTargetsFromSubmitState = (submitState: unknown) => {
      const targets = collectS1ModuleSubmitTargets(submitState as Record<string, unknown>);
      targets.targetRecordIds.forEach((id: unknown) =>
        appendUniquePositiveNumber(targetRecordIds, id),
      );
      targets.targetSubmitIds.forEach((id: unknown) =>
        appendUniquePositiveNumber(targetSubmitIds, id),
      );
    };
    appendTargetsFromSubmitState(resolveS1ModuleSubmit(module));
    if (module !== source) appendTargetsFromSubmitState(resolveS1ModuleSubmit(source));

    rows.forEach((row) => {
      const dataRow = deps.resolveMatrixRow(row);
      if (!dataRow || deps.isSubjectTreeParent(dataRow)) return;
      deps.rowAllActionColumns(dataRow).forEach((column) => {
        if (!isSavableMatrixColumn(column as unknown as Record<string, unknown>)) return;
        if (!deps.isColumnFillableByInputScope(dataRow, column)) return;
        const recordMeta = deps.getCellRecordMeta(dataRow, column) as Record<string, unknown>;
        if (!recordMeta || String(recordMeta.recordStatus || "").toUpperCase() !== "ARCHIVED") return;
        appendUniquePositiveNumber(targetRecordIds, recordMeta.id || recordMeta.recordId);
        const submitIds = ([] as any[])
          .concat(recordMeta.submitIds || [])
          .concat(recordMeta.targetSubmitIds || [])
          .concat(recordMeta.submitId || []);
        submitIds.forEach((submitId: unknown) =>
          appendUniquePositiveNumber(targetSubmitIds, submitId),
        );
      });
    });

    const savedDraftTargets = readS1ModuleMap(
      "s1ModuleDraftTargetMap" as keyof RevenueFillState,
      source,
    ) as Record<string, unknown> | undefined;
    if (savedDraftTargets && typeof savedDraftTargets === "object") {
      (savedDraftTargets.targetRecordIds as unknown[] || []).forEach((id: unknown) =>
        appendUniquePositiveNumber(targetRecordIds, id),
      );
      (savedDraftTargets.targetSubmitIds as unknown[] || []).forEach((id: unknown) =>
        appendUniquePositiveNumber(targetSubmitIds, id),
      );
    }
    return { targetRecordIds, targetSubmitIds, module };
  }

  function canReeditS1Subtable(source: ModuleSection): boolean {
    return canShowS1ModuleReeditAction({
      showActions: true, // showS1SubtableStateActions
      moduleSubmitted: isS1ModuleSubmitted(source),
      reediting: isS1ModuleOpinionReediting(source),
    });
  }

  function resolveS1SubtableDisplayName(source: ModuleSection): string {
    const module = deps.resolveModuleSectionBySource(source) || source;
    return deps.displayUiText(
      module.name ||
      module.moduleName ||
      module.rootSubjectName ||
      module.subtable ||
      source.name ||
      source.moduleName ||
      "当前子表",
    );
  }

  function resolveS1ModuleIdentity(section: ModuleSection) {
    const module = deps.resolveModuleSectionBySource(section) || section;
    const firstRow =
      (module.rows || [])[0] || (module.sourceRows || [])[0] || {};
    const moduleName =
      module.name ||
      module.moduleName ||
      (firstRow as Record<string, unknown>).subtable ||
      (firstRow as Record<string, unknown>).rootSubjectName ||
      "当前子表";
    const rootSubjectId = deps.normalizeSubjectId(
      module.rootSubjectId ||
      module.displayRootSubjectId ||
      (firstRow as Record<string, unknown>).rootSubjectId ||
      (firstRow as Record<string, unknown>).__moduleRootId ||
      "",
    );
    const moduleKey = String(
      module.moduleKey || module.key || rootSubjectId || moduleName,
    ).trim();
    return { module, moduleName, moduleKey, rootSubjectId };
  }

  function collectS1ModuleVisibleSubjectIds(section: ModuleSection): string[] {
    const module = deps.resolveModuleSectionBySource(section) || section;
    const rows = Array.isArray(module.rows) ? module.rows : [];
    const seen: Record<string, boolean> = {};
    const result: string[] = [];
    rows.forEach((row) => {
      const dataRow = deps.resolveMatrixRow(row);
      if (!dataRow || deps.isSubjectTreeParent(dataRow)) return;
      const subjectId = deps.resolveRowSubjectId(dataRow);
      if (!subjectId || seen[subjectId]) return;
      seen[subjectId] = true;
      result.push(subjectId);
    });
    return result;
  }

  function collectS1ModuleRecordTargets(
    section: ModuleSection,
    options: { includeDraft?: boolean; includeArchived?: boolean } = {},
  ) {
    const includeDraft = options.includeDraft !== false;
    const includeArchived = options.includeArchived !== false;
    const module = deps.resolveModuleSectionBySource(section) || section;
    const rows = Array.isArray(module.rows) ? module.rows : [];
    const targetRecordIds: (string | number)[] = [];
    const targetSubmitIds: (string | number)[] = [];
    rows.forEach((row) => {
      const dataRow = deps.resolveMatrixRow(row);
      if (!dataRow || deps.isSubjectTreeParent(dataRow)) return;
      deps.rowAllActionColumns(dataRow).forEach((column) => {
        if (!isSavableMatrixColumn(column as unknown as Record<string, unknown>)) return;
        if (!deps.isColumnFillableByInputScope(dataRow, column)) return;
        const recordMeta = deps.getCellRecordMeta(dataRow, column) as Record<string, unknown>;
        if (!recordMeta) return;
        const status = String(recordMeta.recordStatus || "").toUpperCase();
        if (status === "ARCHIVED" && !includeArchived) return;
        if (status !== "ARCHIVED" && !includeDraft) return;
        appendUniquePositiveNumber(targetRecordIds, recordMeta.id || recordMeta.recordId);
        ([] as any[])
          .concat(recordMeta.submitIds || [])
          .concat(recordMeta.targetSubmitIds || [])
          .concat(recordMeta.submitId || [])
          .forEach((submitId: unknown) =>
            appendUniquePositiveNumber(targetSubmitIds, submitId),
          );
      });
    });
    const savedDraftTargets = readS1ModuleMap(
      "s1ModuleDraftTargetMap" as keyof RevenueFillState,
      section,
    ) as Record<string, unknown> | undefined;
    if (savedDraftTargets && typeof savedDraftTargets === "object") {
      (savedDraftTargets.targetRecordIds as unknown[] || []).forEach((id: unknown) =>
        appendUniquePositiveNumber(targetRecordIds, id),
      );
      (savedDraftTargets.targetSubmitIds as unknown[] || []).forEach((id: unknown) =>
        appendUniquePositiveNumber(targetSubmitIds, id),
      );
    }
    return { targetRecordIds, targetSubmitIds };
  }

  function buildS1ModuleSaveParams(
    section: ModuleSection,
    extra: Record<string, unknown> = {},
  ) {
    const identity = resolveS1ModuleIdentity(section);
    return {
      ...deps.buildSaveDraftParams(),
      ...extra,
      visibleSubjectIds: collectS1ModuleVisibleSubjectIds(section),
      rootSubjectId: identity.rootSubjectId,
      moduleKey: identity.moduleKey,
      moduleName: identity.moduleName,
      stageCode: "S1",
      subjectDomain: AUDIT_DOMAIN.SUBTABLE,
    };
  }

  return {
    // S2
    applyS2ModuleReviewState,
    resolveS2ModuleOpinionKeys,
    resolveS2ModuleSubmit,
    resolveS2ModuleOpinion,
    shouldShowS2ModuleOpinionCard,
    resolveS2ModuleOpinionTitle,
    // S1 状态
    applyS1ModuleReviewState,
    resolveS1ModuleOpinionKeys,
    readS1ModuleMap,
    writeS1ModuleMap,
    deleteS1ModuleMap,
    resolveS1ModuleOpinion,
    setS1ModuleOpinion,
    hasS1ModuleSavedOpinion,
    isS1ModuleOpinionReediting,
    isS1ModuleOpinionLocked,
    canReeditS1ModuleOpinion,
    enableS1ModuleOpinionReedit,
    restoreS1ModuleOpinionAfterReedit,
    resolveS1ModuleSubmit,
    isS1ModuleSubmitted,
    // 工具栏
    shouldShowS1ModuleToolbar,
    shouldShowS1ModuleOpinionCard,
    resolveS1ModuleOpinionTitle,
    canEditS1ModuleOpinion,
    canSaveS1ModuleDraft,
    canImportS1ModuleDraft,
    canSubmitS1Module,
    resolveS1ModuleSubmitHint,
    isS1SubtableSubmitting,
    isS1SubtableActionLoading,
    resolveS1SubtableActionKey,
    // 提交目标
    appendUniquePositiveNumber,
    collectS1SubtableSubmittedTargets,
    canReeditS1Subtable,
    resolveS1SubtableDisplayName,
    resolveS1ModuleIdentity,
    collectS1ModuleVisibleSubjectIds,
    collectS1ModuleRecordTargets,
    buildS1ModuleSaveParams,
  };
}
