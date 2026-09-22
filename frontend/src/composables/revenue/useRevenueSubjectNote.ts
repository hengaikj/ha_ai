/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
/**
 * 收益填报页·科目说明 composable
 *
 * S1 科目说明：按科目一条说明，UI 对标单元格填报意见 popover。
 * 原 mixin: subject-note.mixin.js
 */
import { ElMessage } from "element-plus";
import {
  listSubtableSubjectNotes,
  saveSubtableSubjectNote,
} from "@/pages/revenue/subtable-workbench/service";
import type {
  RevenueFillState,
  MatrixRow,
  ModuleSection,
} from "@/types/revenue";

export interface SubjectNoteDeps {
  isSubjectTreeParent: (row: MatrixRow) => boolean;
  resolveMatrixRow: (row: MatrixRow) => MatrixRow;
  resolveRowSubjectId: (row: MatrixRow) => string;
  resolveSubjectTreeLabel: (row: MatrixRow) => string;
  isS1ModuleSubmitted: (section: ModuleSection) => boolean;
  /** 可填报权限（来自页面 computed，避免依赖 state.canEditFill 同步） */
  getCanEditFill?: () => boolean;
}

export function useRevenueSubjectNote(state: RevenueFillState, deps: SubjectNoteDeps) {
  function resolveCanEditFill(): boolean {
    if (typeof deps.getCanEditFill === "function") return Boolean(deps.getCanEditFill());
    return Boolean(state.canEditFill);
  }

  /**
   * 解析当前阶段：优先 state.currentStageCode，否则回退 project.audit / queryStage。
   * Vue3 填报页真实阶段在 computed，state 字段可能尚未同步。
   */
  function resolveEffectiveStageCode(): string {
    const fromState = String(state.currentStageCode || "").trim().toUpperCase();
    if (fromState) return fromState;
    const audit = (state.project && state.project.audit) as
      | { stageCode?: string; stage?: string }
      | undefined;
    return String(
      (audit && (audit.stageCode || audit.stage)) || state.queryStage || "",
    )
      .trim()
      .toUpperCase();
  }

  /**
   * 科目说明入口权限：可见叶子科目即可（含主表、公式/只读行）。
   * 不要求单元格可编辑——无单元格值时也要能先写说明。
   */
  function hasSubjectNoteDataPermission(row: MatrixRow = {} as MatrixRow): boolean {
    const dataRow = deps.resolveMatrixRow(row) || row || {};
    const subjectId = String(
      deps.resolveRowSubjectId(dataRow) ||
        dataRow.subjectId ||
        dataRow.id ||
        "",
    ).trim();
    if (!subjectId) return false;
    const visibleMap = state.visibleSubjectMap || {};
    const writableMap = state.writableSubjectMap || {};
    const hasPermissionMap =
      Object.keys(visibleMap).length > 0 || Object.keys(writableMap).length > 0;
    if (hasPermissionMap) {
      if (visibleMap[subjectId] || writableMap[subjectId]) return true;
      // 已有说明时仍展示入口，便于只读查看
      return Boolean(state.subjectNoteMap && state.subjectNoteMap[subjectId]);
    }
    // 权限图尚未就绪：S1 可填报页先放行；否则仅已有说明时展示
    if (resolveCanEditFill() || resolveEffectiveStageCode() === "S1") return true;
    return Boolean(state.subjectNoteMap && state.subjectNoteMap[subjectId]);
  }

  function shouldShowSubjectNoteIcon(
    row: MatrixRow = {} as MatrixRow,
    _section: ModuleSection = {} as ModuleSection,
  ): boolean {
    if (resolveEffectiveStageCode() !== "S1") return false;
    if (deps.isSubjectTreeParent(row)) return false;
    // 主表与子表均支持科目说明
    if (!hasSubjectNoteDataPermission(row)) return false;
    return Boolean(resolveSubjectNoteKey(row));
  }

  function resolveSubjectNoteKey(row: MatrixRow = {} as MatrixRow): string {
    const dataRow = deps.resolveMatrixRow(row) || row || {};
    return String(
      deps.resolveRowSubjectId(dataRow) ||
        dataRow.subjectId ||
        dataRow.id ||
        "",
    ).trim();
  }

  function resolveSubjectNoteEntry(row: MatrixRow = {} as MatrixRow) {
    const subjectId = resolveSubjectNoteKey(row);
    if (!subjectId) return null;
    return state.subjectNoteMap[subjectId] || null;
  }

  function hasSubjectNote(row: MatrixRow = {} as MatrixRow): boolean {
    const entry = resolveSubjectNoteEntry(row);
    return Boolean(entry && String(entry.noteText || "").trim());
  }

  function isSubjectNoteReadonly(section: ModuleSection = {} as ModuleSection): boolean {
    if (!resolveCanEditFill()) return true;
    if (deps.isS1ModuleSubmitted(section)) return true;
    return false;
  }

  function resolveSubjectNotePopoverTitle(
    row: MatrixRow = {} as MatrixRow,
    section: ModuleSection = {} as ModuleSection,
  ): string {
    const dataRow = deps.resolveMatrixRow(row) || row || {};
    const pathParts: string[] = [];
    const pushPath = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          const text = String(item == null ? "" : item).trim();
          if (text) pathParts.push(text);
        });
        return;
      }
      const text = String(value == null ? "" : value).trim();
      if (!text) return;
      text
        .split(/[/\\]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => {
          pathParts.push(item);
        });
    };
    pushPath(
      (dataRow as Record<string, unknown>).__subjectTreePath ||
        (dataRow as Record<string, unknown>).subjectTreePath,
    );
    if (!pathParts.length) {
      pushPath(dataRow.fullNamePath || dataRow.subjectPath || (dataRow as Record<string, unknown>).path);
    }
    if (!pathParts.length) {
      const moduleName = String(
        (section && (section.name || section.moduleName || section.rootSubjectName)) || "",
      ).trim();
      const label = String(
        deps.resolveSubjectTreeLabel(row) || dataRow.subjectName || dataRow.subject || "",
      ).trim();
      if (moduleName) pathParts.push(moduleName);
      if (label) {
        pathParts.push(
          label.replace(/（[^）]*）$/u, "").replace(/\([^)]*\)$/u, "").trim(),
        );
      }
    }
    const unique: string[] = [];
    pathParts.forEach((item) => {
      if (!unique.includes(item)) unique.push(item);
    });
    return unique.join(" / ") || "科目说明";
  }

  function isSubjectNotePopoverVisible(row: MatrixRow = {} as MatrixRow): boolean {
    const key = resolveSubjectNoteKey(row);
    return Boolean(key && state.subjectNoteEditor.visibleKey === key);
  }

  function openSubjectNoteEditor(
    row: MatrixRow = {} as MatrixRow,
    section: ModuleSection = {} as ModuleSection,
  ): void {
    if (!shouldShowSubjectNoteIcon(row, section)) return;
    const subjectId = resolveSubjectNoteKey(row);
    if (!subjectId) {
      ElMessage.warning("无法识别科目，不能填写说明");
      return;
    }
    const entry = resolveSubjectNoteEntry(row) || {};
    const readonly = isSubjectNoteReadonly(section);
    state.subjectNoteEditor = {
      visibleKey: subjectId,
      subjectId,
      sectionKey: String(
        (section && (section.key || section.moduleKey || section.rootSubjectId)) || "",
      ),
      title: resolveSubjectNotePopoverTitle(row, section),
      noteText: String((entry as { noteText?: string }).noteText || ""),
      readonly,
    };
  }

  function closeSubjectNoteEditor(): void {
    state.subjectNoteEditor = {
      visibleKey: "",
      subjectId: "",
      sectionKey: "",
      title: "",
      noteText: "",
      readonly: false,
    };
  }

  function onSubjectNoteEditorInput(value: unknown): void {
    if (state.subjectNoteEditor.readonly) return;
    state.subjectNoteEditor = {
      ...state.subjectNoteEditor,
      noteText: String(value == null ? "" : value),
    };
  }

  async function loadSubjectNotes(query: Record<string, unknown> = {}): Promise<void> {
    if (resolveEffectiveStageCode() !== "S1") {
      state.subjectNoteMap = {};
      return;
    }
    try {
      const map = await listSubtableSubjectNotes({
        ...query,
        userId: state.currentUser || query.userId,
        stage: "S1",
        stageCode: "S1",
        subjectDomain: "subtable",
      });
      state.subjectNoteMap = map && typeof map === "object" ? (map as any) : {};
    } catch (_error) {
      state.subjectNoteMap = {};
    }
  }

  async function submitSubjectNote(
    row: MatrixRow = {} as MatrixRow,
    section: ModuleSection = {} as ModuleSection,
  ): Promise<void> {
    if (state.subjectNoteSubmitting) return;
    if (isSubjectNoteReadonly(section)) {
      ElMessage.warning("当前模块已提交，科目说明只读，不能再补录");
      return;
    }
    const subjectId = resolveSubjectNoteKey(row);
    const noteText = String(state.subjectNoteEditor.noteText || "").trim();
    if (!subjectId) {
      ElMessage.warning("无法识别科目，不能提交说明");
      return;
    }
    if (!noteText) {
      ElMessage.warning("请填写科目说明后再提交");
      return;
    }
    const dataRow = deps.resolveMatrixRow(row) || row || {};
    state.subjectNoteSubmitting = true;
    try {
      const result = (await saveSubtableSubjectNote({
        projectId: state.queryProjectId,
        flowId: state.queryFlowId || state.activeFlowId || (state.project as { flowId?: string })?.flowId,
        projectCode: state.queryProjectCode,
        projectName: state.queryProjectName,
        valve: state.queryValve,
        userId: state.currentUser,
        userName: state.currentUserName,
        stage: "S1",
        stageCode: "S1",
        subjectDomain: "subtable",
        subjectId,
        subjectName: String(
          dataRow.subjectName || dataRow.subject || deps.resolveSubjectTreeLabel(row) || "",
        ).trim(),
        subjectPath:
          (dataRow as Record<string, unknown>).__subjectTreePath ||
          (dataRow as Record<string, unknown>).subjectTreePath ||
          dataRow.fullNamePath,
        rootSubjectId: section && (section.rootSubjectId || section.moduleKey || section.key),
        moduleKey: section && (section.moduleKey || section.key || section.rootSubjectId),
        moduleName: section && (section.name || section.moduleName || section.rootSubjectName),
        noteText,
      })) as { ok?: boolean; message?: string; reviewId?: unknown; savedAt?: string };
      if (!result || !result.ok) {
        ElMessage.warning((result && result.message) || "提交科目说明失败");
        return;
      }
      state.subjectNoteMap[subjectId] = {
        subjectId,
        noteText,
        reviewerId: state.currentUser,
        reviewerName: state.currentUserName,
        reviewId: result.reviewId,
        time: result.savedAt,
        moduleKey: section && (section.moduleKey || section.key),
        moduleName: section && (section.name || section.moduleName),
      };
      ElMessage.success("科目说明已提交");
      closeSubjectNoteEditor();
    } catch (error: unknown) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message || "")
          : "";
      ElMessage.error(message || "提交科目说明失败");
    } finally {
      state.subjectNoteSubmitting = false;
    }
  }

  return {
    hasSubjectNoteDataPermission,
    shouldShowSubjectNoteIcon,
    resolveSubjectNoteKey,
    resolveSubjectNoteEntry,
    hasSubjectNote,
    isSubjectNoteReadonly,
    resolveSubjectNotePopoverTitle,
    isSubjectNotePopoverVisible,
    openSubjectNoteEditor,
    closeSubjectNoteEditor,
    onSubjectNoteEditorInput,
    loadSubjectNotes,
    submitSubjectNote,
  };
}
