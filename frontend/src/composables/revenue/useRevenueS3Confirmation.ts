/**
 * 收益填报页·S3 确认 composable
 *
 * 负责 S3 阶段业务经理二次确认的 popover UI 逻辑与本地状态应用。
 * 原 mixin: s3-confirmation.mixin.js
 */
import { ElMessage } from "element-plus";
import { saveS3ConfirmationCell } from "@/pages/revenue/subtable-workbench/service";
import {
  enrichMatrixRowPathContext,
  formatRevenueTableCellValue,
  isDisplayAggregateColumn,
  isMainMarginContributionRow,
  isSavableMatrixColumn,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import { resolveVisibleFillRows } from "@/composables/revenue/resolve-visible-fill-rows";
import type {
  RevenueFillState,
  MatrixRow,
  MatrixColumn,
  ModuleSection,
  S3Candidate,
} from "@/types/revenue";

/** 其他 composable 依赖注入 */
export interface S3ConfirmationDeps {
  resolveMatrixRow: (row: MatrixRow) => MatrixRow;
  isSubjectTreeParent: (row: MatrixRow) => boolean;
  isEditableInputRow: (row: MatrixRow) => boolean;
  isColumnFillableByInputScope: (row: MatrixRow, column: MatrixColumn) => boolean;
  getCellValue: (row: MatrixRow, column: MatrixColumn) => string;
  buildCellDraftKey: (row: MatrixRow, column: MatrixColumn) => string;
  resolveCellLegacyKey: (column: MatrixColumn) => string;
  updateCellValueLocally: (row: MatrixRow, column: MatrixColumn, value: unknown) => void;
  getCellRecordMeta: (row: MatrixRow, column: MatrixColumn) => unknown;
  updateCellRecordMeta: (
    row: MatrixRow,
    column: MatrixColumn,
    recordId: string | number,
    options?: { recordStatus?: string },
  ) => void;
  readLocalCellOpinion: (
    row: MatrixRow,
    column: MatrixColumn,
    mapName?: string,
  ) => Record<string, unknown> | null;
  writeLocalCellOpinion: (
    row: MatrixRow,
    column: MatrixColumn,
    opinionData: Record<string, unknown>,
    mapName?: string,
  ) => void;
  blurActivePopoverElement: (selector: string) => void;
  displayUiText: (value: unknown) => string;
  resolveRowSubjectId: (row: MatrixRow) => string;
  isRndInvestmentAmountColumn: (column: MatrixColumn) => boolean;
  isYearOnlyRow: (row: MatrixRow) => boolean;
  validatePercentDisplayInput: (
    row: MatrixRow,
    value: string,
    options?: { max?: number },
  ) => { ok: boolean; value?: string; message?: string };
  scheduleFormulaRecalc: () => void;
  buildSaveDraftParams: () => Record<string, unknown>;
  saveCellOpinion?: (
    row: MatrixRow,
    column: MatrixColumn,
    opinion: string,
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  /** 行所属子表是否仍可二次确认改值（未锁定 / 已点重新编辑） */
  isS3ModuleEditableForRow?: (row: MatrixRow) => boolean;
}

export function useRevenueS3Confirmation(state: RevenueFillState, deps: S3ConfirmationDeps) {
  function resolveS3CellKey(column: MatrixColumn): string {
    if (!column) return "";
    if (column.cellKey) return String(column.cellKey || "").trim();
    return `y${column.yearIndex}_t${column.trimIndex}`;
  }

  function getS3Candidate(row: MatrixRow, column: MatrixColumn): S3Candidate | null {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return null;
    const map = dataRow.s3CandidateMap;
    if (!map || typeof map !== "object") return null;
    const cellKey = resolveS3CellKey(column);
    if (Object.prototype.hasOwnProperty.call(map, cellKey)) return map[cellKey] as S3Candidate;
    const yearLabel = String(column.yearLabel || "").trim();
    const trimId = String(column.trimId || "").trim();
    const trimName = String(column.trimName || "").trim();
    const idKey = `${yearLabel}__${trimId}`;
    if (Object.prototype.hasOwnProperty.call(map, idKey)) return map[idKey] as S3Candidate;
    const nameKey = `${yearLabel}__${trimName}`;
    if (Object.prototype.hasOwnProperty.call(map, nameKey)) return map[nameKey] as S3Candidate;
    return null;
  }

  function isS3ModuleEditableForRow(row: MatrixRow): boolean {
    if (typeof deps.isS3ModuleEditableForRow === "function") {
      return deps.isS3ModuleEditableForRow(row) !== false;
    }
    return true;
  }

  /** 是否为 S3 二次确认单元格（含已锁定只读展示） */
  function isS3ConfirmationStageCell(row: MatrixRow, column: MatrixColumn): boolean {
    if (!state.isS3ConfirmationStage) return false;
    if (deps.isSubjectTreeParent(row)) return false;
    const dataRow = deps.resolveMatrixRow(row);
    if (!state.canEditFill) return false;
    if (!isSavableMatrixColumn(column as unknown as Record<string, unknown>)) return false;
    if (!deps.isEditableInputRow(dataRow)) return false;
    if (!deps.isColumnFillableByInputScope(dataRow, column)) return false;
    return true;
  }

  /** 可改值：未锁定子表（保存意见后需点「重新编辑」） */
  function isS3ConfirmableCell(row: MatrixRow, column: MatrixColumn): boolean {
    if (!isS3ConfirmationStageCell(row, column)) return false;
    return isS3ModuleEditableForRow(row);
  }

  function isS3ConfirmationCell(row: MatrixRow, column: MatrixColumn): boolean {
    if (state.viewMode === "overview" && !deps.isYearOnlyRow(row)) return false;
    return isS3ConfirmationStageCell(row, column);
  }

  function resolveS3CellValueRow(row: MatrixRow, column: MatrixColumn): MatrixRow {
    const dataRow = deps.resolveMatrixRow(row);
    // 研发投资总额列单位在 column.unit（万元），不能只用行单位，否则会把「元」存储值原样显示成上千万
    if (deps.isRndInvestmentAmountColumn(column) && column && column.unit) {
      return {
        ...dataRow,
        unit: String(column.unit),
      };
    }
    return dataRow;
  }

  function normalizeS3DisplayValue(
    value: unknown,
    row: MatrixRow,
    column: MatrixColumn,
  ): string {
    return formatRevenueTableCellValue(
      resolveS3CellValueRow(row, column) as unknown as Record<string, unknown>,
      value,
    );
  }

  function displayS3FinalValue(row: MatrixRow, column: MatrixColumn): string {
    const candidate = getS3Candidate(row, column);
    return normalizeS3DisplayValue(
      candidate ? candidate.finalValue : deps.getCellValue(row, column),
      row,
      column,
    );
  }

  function displayS3OriginalValue(row: MatrixRow, column: MatrixColumn): string {
    return normalizeS3DisplayValue(resolveS3OriginalValue(row, column), row, column);
  }

  function displayS3Value(row: MatrixRow, column: MatrixColumn): string {
    const candidate = getS3Candidate(row, column);
    if (!candidate || !candidate.hasS2Value) return "无调整";
    return normalizeS3DisplayValue(candidate.s2Value, row, column);
  }

  function hasS3SuggestedValue(row: MatrixRow, column: MatrixColumn): boolean {
    const candidate = getS3Candidate(row, column);
    return Boolean(
      candidate &&
        (candidate.hasS2Value || String(candidate.s2Value || "").trim() !== ""),
    );
  }

  function resolveS3OriginalValue(row: MatrixRow, column: MatrixColumn): string {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return "";
    const candidate = getS3Candidate(dataRow, column);
    if (candidate && Object.prototype.hasOwnProperty.call(candidate, "originalValue")) {
      return String(candidate.originalValue == null ? "" : candidate.originalValue);
    }
    const value = deps.getCellValue(dataRow, column);
    return String(value == null ? "" : value);
  }

  function s3OpinionText(row: MatrixRow, column: MatrixColumn): string {
    const candidate = getS3Candidate(row, column);
    if (!candidate) return "";
    return String(candidate.s2Opinion || "").trim();
  }

  function s3ReviewerText(row: MatrixRow, column: MatrixColumn): string {
    const candidate = getS3Candidate(row, column);
    return String((candidate && candidate.s2Reviewer) || "S2 集团部室审核").trim();
  }

  function s3ReviewConclusionText(row: MatrixRow, column: MatrixColumn): string {
    const candidate = getS3Candidate(row, column);
    const conclusion = String((candidate && candidate.s2ReviewConclusion) || "").trim();
    if (!conclusion) return "有评审意见";
    const map: Record<string, string> = {
      PASS: "通过",
      PASS_WITH_ISSUES: "有意见",
      REJECT: "不通过",
      REJECTED: "不通过",
      FAIL: "不通过",
    };
    return map[conclusion] || conclusion;
  }

  function isS3ReviewRejected(row: MatrixRow, column: MatrixColumn): boolean {
    const candidate = getS3Candidate(row, column);
    if (!candidate || !candidate.hasS2Value) return false;
    const conclusion = String(candidate.s2ReviewConclusion || "").trim().toUpperCase();
    if (conclusion && !["PASS", "APPROVED", "AGREE"].includes(conclusion)) return true;
    return !conclusion && Boolean(String(candidate.s2Opinion || "").trim());
  }

  function s3DecisionLabel(row: MatrixRow, column: MatrixColumn): string {
    const decision = String((getS3Candidate(row, column) || {}).decision || "").trim();
    if (decision === "accept_s2") return "接受S2";
    if (decision === "keep_original") return "坚持原值";
    if (decision === "custom") return "重新给值";
    return "待确认";
  }

  function s3DecisionTagType(row: MatrixRow, column: MatrixColumn): string {
    const decision = String((getS3Candidate(row, column) || {}).decision || "").trim();
    if (decision === "custom") return "success";
    if (decision === "keep_original") return "info";
    if (isS3ReviewRejected(row, column)) return "warning";
    return "";
  }

  function matrixCellClass(row: MatrixRow, column: MatrixColumn) {
    const dataRow = enrichMatrixRowPathContext(
      deps.resolveMatrixRow(row) as unknown as Record<string, unknown>,
      row as unknown as Record<string, unknown>,
    );
    return {
      "rnd-investment-amount-cell": deps.isRndInvestmentAmountColumn(column),
      "s3-review-rejected": isS3ReviewRejected(row, column),
      "s3-confirmed-custom":
        state.isS3ConfirmationStage &&
        String((getS3Candidate(row, column) || {}).decision || "") === "custom",
      "margin-contrib-subtotal-bold-cell":
        isDisplayAggregateColumn(column as unknown as Record<string, unknown>) &&
        isMainMarginContributionRow(dataRow),
    };
  }

  // ============================================================
  // Popover
  // ============================================================

  function resolveS3PopoverTitle(row: MatrixRow, column: MatrixColumn): string {
    const dataRow = deps.resolveMatrixRow(row);
    const subject = deps.displayUiText(
      String((dataRow && (dataRow.subject || dataRow.subjectName)) || "-").trim(),
    );
    const year = String((column && column.yearLabel) || "").trim();
    const trim = String(
      (column && (column.label || column.trimName || column.trimId)) || "",
    ).trim();
    return [subject, year, trim].filter(Boolean).join(" / ");
  }

  function buildS3ChoiceDraftKey(row: MatrixRow, column: MatrixColumn): string {
    return `s3choice__${deps.buildCellDraftKey(row, column)}`;
  }

  function buildS3PopoverKey(row: MatrixRow, column: MatrixColumn): string {
    return `s3popover__${deps.buildCellDraftKey(row, column)}`;
  }

  function isS3PopoverVisible(row: MatrixRow, column: MatrixColumn): boolean {
    return state.activeS3PopoverKey === buildS3PopoverKey(row, column);
  }

  function isS3EditorForCell(row: MatrixRow, column: MatrixColumn): boolean {
    return state.s3CellEditor.key === buildS3PopoverKey(row, column);
  }

  function resetS3CellEditor() {
    state.s3CellEditor = {
      key: "",
      row: null,
      column: null,
      choice: "",
      customValue: "",
      opinion: "",
    };
  }

  function resolveS3EditorChoice(row: MatrixRow, column: MatrixColumn): string {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return "keep_original";
    const choiceKey = buildS3ChoiceDraftKey(dataRow, column);
    if (Object.prototype.hasOwnProperty.call(state.cellInputDrafts, choiceKey)) {
      return state.cellInputDrafts[choiceKey];
    }
    const decision = String((getS3Candidate(dataRow, column) || {}).decision || "").trim();
    if (decision === "custom" || decision === "keep_original" || decision === "accept_s2") {
      return decision;
    }
    return hasS3SuggestedValue(dataRow, column) ? "accept_s2" : "keep_original";
  }

  function resolveS3EditorCustomValue(row: MatrixRow, column: MatrixColumn): string {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return "";
    const customKey = buildS3CustomDraftKey(dataRow, column);
    if (Object.prototype.hasOwnProperty.call(state.cellInputDrafts, customKey)) {
      return state.cellInputDrafts[customKey];
    }
    const candidate = getS3Candidate(dataRow, column);
    if (candidate && candidate.decision === "custom") {
      return normalizeS3DisplayValue(candidate.finalValue, dataRow, column);
    }
    return "";
  }

  function resolveS3EditorOpinion(row: MatrixRow, column: MatrixColumn): string {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return "";
    const opinionKey = buildS3OpinionDraftKey(dataRow, column);
    if (Object.prototype.hasOwnProperty.call(state.cellInputDrafts, opinionKey)) {
      return state.cellInputDrafts[opinionKey];
    }
    // 仅回填已持久化的确认意见，避免把确认数值误当作意见
    return getS3StoredOpinion(dataRow, column);
  }

  /** 关闭弹层前把编辑器内容写回草稿，避免仅用 v-model 时丢失 */
  function flushS3CellEditorToDrafts() {
    const editor = state.s3CellEditor;
    const dataRow = editor && editor.row;
    const column = editor && editor.column;
    if (!dataRow || !column || !editor.key) return;
    const choiceKey = buildS3ChoiceDraftKey(dataRow, column);
    const customKey = buildS3CustomDraftKey(dataRow, column);
    const opinionKey = buildS3OpinionDraftKey(dataRow, column);
    state.cellInputDrafts[choiceKey] = String(editor.choice || "");
    state.cellInputDrafts[customKey] = String(editor.customValue == null ? "" : editor.customValue);
    state.cellInputDrafts[opinionKey] = String(editor.opinion == null ? "" : editor.opinion);
  }

  function openS3CellEditor(row: MatrixRow, column: MatrixColumn) {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return;
    const key = buildS3PopoverKey(dataRow, column);
    const customValue = resolveS3EditorCustomValue(dataRow, column);
    let opinion = resolveS3EditorOpinion(dataRow, column);
    // 防止草稿串写：意见与当前新值完全相同且为纯数字时，视为误写入，不预填
    const customTrim = String(customValue || "").trim();
    const opinionTrim = String(opinion || "").trim();
    if (
      opinionTrim &&
      customTrim &&
      opinionTrim === customTrim &&
      /^-?\d+(\.\d+)?$/.test(opinionTrim)
    ) {
      const stored = getS3StoredOpinion(dataRow, column);
      if (String(stored || "").trim() !== opinionTrim) {
        opinion = "";
        delete state.cellInputDrafts[buildS3OpinionDraftKey(dataRow, column)];
      }
    }
    state.s3CellEditor = {
      key,
      row: dataRow,
      column,
      choice: resolveS3EditorChoice(dataRow, column),
      customValue,
      opinion,
    };
  }

  function toggleS3Popover(row: MatrixRow, column: MatrixColumn) {
    const key = buildS3PopoverKey(row, column);
    if (state.activeS3PopoverKey === key) {
      closeS3Popover({ flushDrafts: true });
      return;
    }
    openS3CellEditor(row, column);
    state.activeS3PopoverKey = key;
  }

  function closeS3Popover(options: { flushDrafts?: boolean } = {}) {
    if (options.flushDrafts) {
      flushS3CellEditorToDrafts();
    }
    deps.blurActivePopoverElement(".revenue-s3-confirm-popover");
    state.activeS3PopoverKey = "";
    resetS3CellEditor();
  }

  function handleDocumentClickForS3Popover(event: Event) {
    if (!state.activeS3PopoverKey) return;
    const target = event && (event.target as HTMLElement | null);
    if (
      target &&
      typeof target.closest === "function" &&
      target.closest(
        [
          ".revenue-s3-confirm-popover",
          ".s3-confirm-cell",
          ".s3-cell-trigger",
          ".el-select-dropdown",
          ".el-popper",
          ".el-textarea",
          ".el-textarea__inner",
          ".el-input",
          ".el-input__wrapper",
          ".el-input__inner",
          ".el-radio",
          ".el-radio-group",
        ].join(", "),
      )
    ) {
      return;
    }
    closeS3Popover({ flushDrafts: true });
  }

  function getS3SelectedChoice(row: MatrixRow, column: MatrixColumn): string {
    if (isS3EditorForCell(row, column)) {
      return state.s3CellEditor.choice;
    }
    return resolveS3EditorChoice(row, column);
  }

  function onS3ChoiceChange(row: MatrixRow, column: MatrixColumn, value: string) {
    const nextChoice = String(value || "custom");
    if (isS3EditorForCell(row, column)) {
      state.s3CellEditor = {
        ...state.s3CellEditor,
        choice: nextChoice,
      };
      return;
    }
    const key = buildS3ChoiceDraftKey(row, column);
    state.cellInputDrafts[key] = nextChoice;
  }

  function buildS3CustomDraftKey(row: MatrixRow, column: MatrixColumn): string {
    return `s3custom__${deps.buildCellDraftKey(row, column)}`;
  }

  function getS3CustomInputValue(row: MatrixRow, column: MatrixColumn): string {
    if (isS3EditorForCell(row, column)) {
      return state.s3CellEditor.customValue;
    }
    return resolveS3EditorCustomValue(row, column);
  }

  function onS3CustomInput(row: MatrixRow, column: MatrixColumn, value: unknown) {
    const nextValue = String(value == null ? "" : value);
    if (isS3EditorForCell(row, column)) {
      state.s3CellEditor.choice = "custom";
      state.s3CellEditor.customValue = nextValue;
      state.cellInputDrafts[buildS3CustomDraftKey(row, column)] = nextValue;
      state.cellInputDrafts[buildS3ChoiceDraftKey(row, column)] = "custom";
      return;
    }
    const key = buildS3CustomDraftKey(row, column);
    state.cellInputDrafts[key] = nextValue;
    onS3ChoiceChange(row, column, "custom");
  }

  function buildS3OpinionDraftKey(row: MatrixRow, column: MatrixColumn): string {
    return `s3opinion__${deps.buildCellDraftKey(row, column)}`;
  }

  function getS3StoredOpinion(row: MatrixRow, column: MatrixColumn): string {
    const local = deps.readLocalCellOpinion(row, column, "s3OpinionMap");
    if (local && String(local.opinion || "").trim()) return String(local.opinion || "").trim();
    const candidate = getS3Candidate(row, column);
    return String((candidate && candidate.s3Opinion) || "").trim();
  }

  function getS3OpinionInputValue(row: MatrixRow, column: MatrixColumn): string {
    if (isS3EditorForCell(row, column)) {
      return state.s3CellEditor.opinion;
    }
    return resolveS3EditorOpinion(row, column);
  }

  function onS3OpinionInput(row: MatrixRow, column: MatrixColumn, value: unknown) {
    // 意见与新值草稿分离写入，避免互相覆盖
    const nextOpinion = String(value == null ? "" : value);
    if (isS3EditorForCell(row, column)) {
      state.s3CellEditor.opinion = nextOpinion;
      state.cellInputDrafts[buildS3OpinionDraftKey(row, column)] = nextOpinion;
      return;
    }
    const key = buildS3OpinionDraftKey(row, column);
    state.cellInputDrafts[key] = nextOpinion;
  }

  function hasS3CellOpinion(row: MatrixRow, column: MatrixColumn): boolean {
    return Boolean(getS3StoredOpinion(row, column));
  }

  // ============================================================
  // 本地状态更新
  // ============================================================

  function updateS3CandidateLocally(
    row: MatrixRow,
    column: MatrixColumn,
    value: unknown,
    decision: string,
    options: Record<string, unknown> = {},
  ) {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return;
    const cellKey = resolveS3CellKey(column);
    const yearLabel = String(column.yearLabel || "").trim();
    const trimId = String(column.trimId || "").trim();
    const trimName = String(column.trimName || "").trim();
    const byDimensionKey = `${yearLabel}__${trimId}`;
    const byNameKey = `${yearLabel}__${trimName}`;
    const rowSubjectId = deps.resolveRowSubjectId(dataRow);
    const current = getS3Candidate(dataRow, column) || {
      rowId: dataRow.id || dataRow.rowId || dataRow.subjectId,
      cellKey,
      dimensionKey: byDimensionKey,
      subjectId: rowSubjectId,
      yearLabel,
      trimId,
      trimName,
      originalValue: resolveS3OriginalValue(dataRow, column),
      s2Value: "",
      hasS2Value: false,
    } as S3Candidate;
    const next: S3Candidate = {
      ...current,
      decision: decision as S3Candidate["decision"],
      finalValue: String(value == null ? "" : value),
    };
    if (options.recordId != null) next.savedRecordId = options.recordId as string | number;
    if (Object.prototype.hasOwnProperty.call(options, "recordStatus")) {
      next.savedRecordStatus = String(options.recordStatus == null ? "" : options.recordStatus).trim();
    }
    if (Object.prototype.hasOwnProperty.call(options, "savedValue")) {
      next.savedValue = String(options.savedValue == null ? "" : options.savedValue);
    }
    if (options.s3Opinion) {
      next.s3Opinion = String(options.s3Opinion == null ? "" : options.s3Opinion);
    }

    if (!dataRow.s3CandidateMap || typeof dataRow.s3CandidateMap !== "object") {
      dataRow.s3CandidateMap = {};
    }
    const map = dataRow.s3CandidateMap as Record<string, unknown>;
    map[cellKey] = next;
    map[byDimensionKey] = next;
    if (trimName && trimName !== trimId) {
      map[byNameKey] = next;
    }
    deps.updateCellValueLocally(dataRow, column, next.finalValue);
    if (options.recalculate === false) return;
    deps.scheduleFormulaRecalc();
  }

  function resolveS3DecisionValue(
    row: MatrixRow,
    column: MatrixColumn,
    decision: string,
  ): string {
    const candidate = getS3Candidate(row, column);
    if (decision === "keep_original") {
      return resolveS3OriginalValue(row, column);
    }
    if (!candidate) return "";
    if (decision === "accept_s2") return String(candidate.s2Value == null ? "" : candidate.s2Value);
    return String(candidate.finalValue == null ? "" : candidate.finalValue);
  }

  function applyS3DecisionValue(
    row: MatrixRow,
    column: MatrixColumn,
    value: string,
    decision: string,
    options: Record<string, unknown> = {},
  ): { ok: boolean; message?: string } {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return { ok: false, message: "未定位到确认单元格" };
    updateS3CandidateLocally(dataRow, column, value, decision, options);
    // Clear related drafts
    const choiceKey = buildS3ChoiceDraftKey(dataRow, column);
    if (Object.prototype.hasOwnProperty.call(state.cellInputDrafts, choiceKey)) {
      delete state.cellInputDrafts[choiceKey];
    }
    const customKey = buildS3CustomDraftKey(dataRow, column);
    if (Object.prototype.hasOwnProperty.call(state.cellInputDrafts, customKey)) {
      delete state.cellInputDrafts[customKey];
    }
    const opinionKey = buildS3OpinionDraftKey(dataRow, column);
    if (Object.prototype.hasOwnProperty.call(state.cellInputDrafts, opinionKey)) {
      delete state.cellInputDrafts[opinionKey];
    }
    // 确认成功后清空草稿并关弹层（不再回写草稿）
    closeS3Popover({ flushDrafts: false });
    return { ok: true };
  }

  // ============================================================
  // 持久化
  // ============================================================

  async function persistS3CellDecision(
    row: MatrixRow,
    column: MatrixColumn,
    value: string,
    decision: string,
    opinion = "",
  ): Promise<Record<string, unknown>> {
    const dataRow = deps.resolveMatrixRow(row);
    if (!dataRow || !column) return { ok: false, message: "未定位到确认单元格" };
    const candidate = getS3Candidate(dataRow, column) || ({} as S3Candidate);
    const recordId =
      candidate.savedRecordId &&
        String(candidate.savedRecordStatus || "").toUpperCase() !== "ARCHIVED"
        ? candidate.savedRecordId
        : undefined;
    const valueRow = resolveS3CellValueRow(dataRow, column);
    const rowSubjectId = deps.resolveRowSubjectId(dataRow);
    const isRndAmountColumn = deps.isRndInvestmentAmountColumn(column);
    const rndAggregateMode = isRndAmountColumn
      ? String(column.yearAggregateMode || "").trim()
      : "";
    const result = await saveS3ConfirmationCell({
      ...deps.buildSaveDraftParams(),
      rowId: dataRow.id || dataRow.rowId || dataRow.subjectId,
      subjectId: rowSubjectId,
      templateSubjectId: dataRow.templateSubjectId,
      expenseSubjectId: dataRow.expenseSubjectId,
      moduleCode: dataRow.moduleCode,
      moduleName:
        dataRow.moduleName || dataRow.subtable || dataRow.rootSubjectName,
      subtable: dataRow.subtable,
      rootSubjectName: dataRow.rootSubjectName,
      fullNamePath: dataRow.fullNamePath,
      subjectPath: dataRow.subjectPath,
      subject: dataRow.subject,
      subjectName: dataRow.subjectName,
      unit: (valueRow && valueRow.unit) || (isRndAmountColumn ? column.unit : dataRow.unit),
      cellKey: deps.resolveCellLegacyKey(column),
      // 研发投资总额列：无年份/版型，靠 yearAggregateMode 区分含税/不含税
      year: isRndAmountColumn ? "" : column.yearLabel,
      trimId: isRndAmountColumn ? "" : column.trimId,
      trimName: isRndAmountColumn ? "" : column.trimName || column.label || column.trimId,
      yearIndex: isRndAmountColumn ? -1 : column.yearIndex,
      trimIndex: column.trimIndex,
      yearAggregateMode: rndAggregateMode || undefined,
      yearOnly: Boolean(dataRow.yearOnly),
      value,
      decision,
      recordId,
    } as Record<string, unknown>);
    if (!result || !(result as Record<string, unknown>).ok)
      return (result as Record<string, unknown>) || { ok: false };

    const resultObj = result as Record<string, unknown>;
    const nextRecordId = (resultObj.recordId as string | number) || recordId;
    const nextOpinion = String(opinion == null ? "" : opinion).trim();
    updateS3CandidateLocally(dataRow, column, value, decision, {
      recordId: nextRecordId,
      recordStatus: resultObj.recordStatus || "DRAFT",
      savedValue: Object.prototype.hasOwnProperty.call(result, "savedValue")
        ? resultObj.savedValue
        : value,
      savedAt: resultObj.savedAt,
      s3Opinion: nextOpinion,
      recalculate: false,
    });
    deps.updateCellRecordMeta(dataRow, column, nextRecordId as string | number, {
      recordStatus: (resultObj.recordStatus as string) || "DRAFT",
    });
    // 有意见才落库；避免空意见或误把数值当意见写入
    const looksLikeBareNumber = /^-?\d+(\.\d+)?$/.test(nextOpinion);
    const shouldPersistOpinion =
      Boolean(nextOpinion) &&
      !(looksLikeBareNumber && nextOpinion === String(value == null ? "" : value).trim());
    if (typeof deps.saveCellOpinion === "function" && shouldPersistOpinion) {
      const opinionResult = await deps.saveCellOpinion(dataRow, column, nextOpinion, {
        recordId: nextRecordId,
        recordMeta: deps.getCellRecordMeta(dataRow, column),
        sourceType: "s3_confirm_opinion",
        mapName: "s3OpinionMap",
      });
      if (!opinionResult || !opinionResult.ok) {
        return opinionResult || { ok: false, message: "意见保存失败" };
      }
      deps.writeLocalCellOpinion(
        dataRow,
        column,
        {
          opinion: nextOpinion,
          sourceType: "s3_confirm_opinion",
          targetRecordIds: nextRecordId ? [nextRecordId] : [],
          time: resultObj.savedAt,
        },
        "s3OpinionMap",
      );
    } else if (!shouldPersistOpinion && nextOpinion) {
      // 数值误入意见：不落库；清掉本地 candidate 上的误写意见
      const localCandidate = getS3Candidate(dataRow, column);
      if (localCandidate) {
        localCandidate.s3Opinion = "";
      }
    }
    return resultObj;
  }

  async function confirmS3CellDecision(
    row: MatrixRow,
    column: MatrixColumn,
    decision: string,
  ) {
    if (!isS3ConfirmableCell(row, column)) {
      ElMessage.warning("当前子表已保存意见，请先点击「重新编辑」后再改值");
      return;
    }
    if (decision === "accept_s2" && !hasS3SuggestedValue(row, column)) {
      ElMessage.warning("该单元格没有 S2 集团部室审核调整值");
      return;
    }
    const dataRow = deps.resolveMatrixRow(row);
    const previousCandidate = getS3Candidate(dataRow, column);
    const value = resolveS3DecisionValue(row, column, decision);
    const opinion = sanitizeS3ConfirmOpinion(readS3EditorOpinion(row, column), value);
    const result = applyS3DecisionValue(row, column, value, decision, { s3Opinion: opinion });
    if (!result || !result.ok) {
      ElMessage.error((result && result.message) || "确认值处理失败");
      return;
    }
    const persistResult = await persistS3CellDecision(row, column, value, decision, opinion);
    if (!persistResult || !persistResult.ok) {
      // 保存失败时回滚本地展示，避免刷新前看起来已成功
      if (previousCandidate) {
        updateS3CandidateLocally(
          dataRow,
          column,
          String(previousCandidate.finalValue ?? previousCandidate.savedValue ?? ""),
          String(previousCandidate.decision || "keep_original"),
          {
            recordId: previousCandidate.savedRecordId,
            recordStatus: previousCandidate.savedRecordStatus,
            savedValue: previousCandidate.savedValue,
            savedAt: previousCandidate.savedAt,
            s3Opinion: previousCandidate.s3Opinion,
            recalculate: false,
          },
        );
      }
      ElMessage.warning(
        (persistResult && (persistResult.message as string)) || "确认值保存失败，请重试",
      );
      return;
    }
    ElMessage.success(
      decision === "accept_s2"
        ? "已选择接受 S2 集团部室审核值"
        : "已选择坚持 S1 业务经理填报原值",
    );
  }

  /** 过滤「确认值误写入意见」：纯数字且与确认值相同则丢弃 */
  function sanitizeS3ConfirmOpinion(opinion: string, value: unknown): string {
    const next = String(opinion == null ? "" : opinion).trim();
    if (!next) return "";
    const valueText = String(value == null ? "" : value).trim();
    if (valueText && next === valueText && /^-?\d+(\.\d+)?$/.test(next)) return "";
    return next;
  }

  async function confirmS3CustomValue(row: MatrixRow, column: MatrixColumn) {
    if (!isS3ConfirmableCell(row, column)) {
      ElMessage.warning("当前子表已保存意见，请先点击「重新编辑」后再改值");
      return;
    }
    const value = readS3EditorCustomValue(row, column);
    if (String(value == null ? "" : value).trim() === "") {
      ElMessage.warning("请输入重新给值");
      return;
    }
    const dataRow = deps.resolveMatrixRow(row);
    const previousCandidate = getS3Candidate(dataRow, column);
    const validation = deps.validatePercentDisplayInput(
      resolveS3CellValueRow(dataRow, column),
      value,
    );
    if (!validation.ok) {
      ElMessage.warning(validation.message || "输入值格式不正确");
      return;
    }
    const storageValue = validation.value!;
    const opinion = sanitizeS3ConfirmOpinion(readS3EditorOpinion(row, column), storageValue);
    const result = applyS3DecisionValue(row, column, storageValue, "custom", { s3Opinion: opinion });
    if (!result || !result.ok) {
      ElMessage.error((result && result.message) || "重新给值处理失败");
      return;
    }
    const persistResult = await persistS3CellDecision(row, column, storageValue, "custom", opinion);
    if (!persistResult || !persistResult.ok) {
      if (previousCandidate) {
        updateS3CandidateLocally(
          dataRow,
          column,
          String(previousCandidate.finalValue ?? previousCandidate.savedValue ?? ""),
          String(previousCandidate.decision || "keep_original"),
          {
            recordId: previousCandidate.savedRecordId,
            recordStatus: previousCandidate.savedRecordStatus,
            savedValue: previousCandidate.savedValue,
            savedAt: previousCandidate.savedAt,
            s3Opinion: previousCandidate.s3Opinion,
            recalculate: false,
          },
        );
      }
      ElMessage.warning(
        (persistResult && (persistResult.message as string)) || "重新给值保存失败，请重试",
      );
      return;
    }
    ElMessage.success("已保存重新给值");
  }

  async function confirmS3SelectedValue(row: MatrixRow, column: MatrixColumn) {
    if (!isS3ConfirmableCell(row, column)) {
      ElMessage.warning("当前子表已保存意见，请先点击「重新编辑」后再改值");
      return;
    }
    const choice = getS3SelectedChoice(row, column);
    if (choice === "custom") {
      await confirmS3CustomValue(row, column);
      return;
    }
    await confirmS3CellDecision(row, column, choice);
  }

  function readS3EditorOpinion(row: MatrixRow, column: MatrixColumn): string {
    if (isS3EditorForCell(row, column)) {
      return String(state.s3CellEditor.opinion || "").trim();
    }
    return String(getS3OpinionInputValue(row, column) || "").trim();
  }

  function readS3EditorCustomValue(row: MatrixRow, column: MatrixColumn): string {
    if (isS3EditorForCell(row, column)) {
      return String(state.s3CellEditor.customValue || "");
    }
    return String(getS3CustomInputValue(row, column) || "");
  }

  // ============================================================
  // 批量操作
  // ============================================================

  function collectS3DecisionTargets(
    section: ModuleSection | null,
    decision: string,
  ) {
    const rows =
      section && Array.isArray(section.rows)
        ? section.rows
        : resolveVisibleFillRows(state);
    const targets: Array<{ row: MatrixRow; column: MatrixColumn; value: string }> = [];
    rows.forEach((row) => {
      const dataRow = deps.resolveMatrixRow(row);
      if (!dataRow) return;
      const columns = (state.activeColumns || []).filter(
        (col) => col && col.real && !col.displayOnly,
      );
      columns.forEach((column) => {
        if (!isS3ConfirmableCell(dataRow, column)) return;
        if (!hasS3SuggestedValue(dataRow, column)) return;
        let value: string;
        if (decision === "keep_original") {
          value = resolveS3OriginalValue(dataRow, column);
        } else {
          value = resolveS3DecisionValue(dataRow, column, decision);
        }
        targets.push({ row: dataRow, column, value });
      });
    });
    return targets;
  }

  async function applyS3BulkDecision(section: ModuleSection | null, decision: string) {
    if (!state.showS3BulkActions || state.s3BulkApplying) return;
    const targets = collectS3DecisionTargets(section, decision);
    if (!targets.length) {
      ElMessage.warning("当前范围没有可批量处理的 S3 业务经理二次确认候选单元格");
      return;
    }
    state.s3BulkApplying = true;
    try {
      let appliedCount = 0;
      let failedCount = 0;
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        const dataRow = deps.resolveMatrixRow(target.row);
        const previousCandidate = getS3Candidate(dataRow, target.column);
        const result = applyS3DecisionValue(
          target.row,
          target.column,
          target.value,
          decision,
          { recalculate: false },
        );
        if (!result || !result.ok) {
          failedCount += 1;
          continue;
        }
        const persistResult = await persistS3CellDecision(
          target.row,
          target.column,
          target.value,
          decision,
          "",
        );
        if (!persistResult || !persistResult.ok) {
          if (previousCandidate) {
            updateS3CandidateLocally(
              dataRow,
              target.column,
              String(previousCandidate.finalValue ?? previousCandidate.savedValue ?? ""),
              String(previousCandidate.decision || "keep_original"),
              {
                recordId: previousCandidate.savedRecordId,
                recordStatus: previousCandidate.savedRecordStatus,
                savedValue: previousCandidate.savedValue,
                savedAt: previousCandidate.savedAt,
                s3Opinion: previousCandidate.s3Opinion,
                recalculate: false,
              },
            );
          }
          failedCount += 1;
          continue;
        }
        appliedCount += 1;
      }
      deps.scheduleFormulaRecalc();
      if (appliedCount > 0 && failedCount === 0) {
        ElMessage.success(
          `${decision === "accept_s2" ? "已批量接受 S2 集团部室审核值" : "已批量坚持原值"}并保存，共 ${appliedCount} 个单元格`,
        );
        return;
      }
      if (appliedCount > 0) {
        ElMessage.warning(
          `${decision === "accept_s2" ? "批量接受 S2" : "批量坚持原值"}部分成功：成功 ${appliedCount}，失败 ${failedCount}`,
        );
        return;
      }
      ElMessage.error(
        `${decision === "accept_s2" ? "批量接受 S2 集团部室审核值" : "批量坚持原值"}保存失败`,
      );
    } finally {
      state.s3BulkApplying = false;
    }
  }

  return {
    resolveS3CellKey,
    getS3Candidate,
    isS3ConfirmableCell,
    isS3ConfirmationCell,
    isS3ModuleEditableForRow,
    resolveS3CellValueRow,
    normalizeS3DisplayValue,
    displayS3FinalValue,
    displayS3OriginalValue,
    displayS3Value,
    hasS3SuggestedValue,
    hasS3ActionableCandidate: (row: MatrixRow, column: MatrixColumn) => {
      const candidate = getS3Candidate(row, column);
      if (!candidate) return false;
      return Boolean(
        String(candidate.rowId || "").trim() ||
        String(candidate.subjectId || "").trim() ||
        String(candidate.cellKey || "").trim() ||
        String(candidate.dimensionKey || "").trim(),
      );
    },
    resolveS3OriginalValue,
    s3OpinionText,
    s3ReviewerText,
    s3ReviewConclusionText,
    isS3ReviewRejected,
    s3DecisionLabel,
    s3DecisionTagType,
    s3CandidateClass: (row: MatrixRow, column: MatrixColumn) => {
      const candidate = getS3Candidate(row, column) || ({} as S3Candidate);
      return {
        "is-s2-rejected": isS3ReviewRejected(row, column),
        "is-custom": candidate.decision === "custom",
        "is-keep-original": candidate.decision === "keep_original",
      };
    },
    matrixCellClass,
    s3CellButtonType: (row: MatrixRow, column: MatrixColumn) => {
      if (isS3ReviewRejected(row, column)) return "warning";
      if (String((getS3Candidate(row, column) || {}).decision || "") === "custom") return "warning";
      return "default";
    },
    resolveS3PopoverTitle,
    s3PopoverSubText: (row: MatrixRow, column: MatrixColumn) => {
      if (hasS3SuggestedValue(row, column)) {
        return "可选择 S2 集团部室审核值、S1 业务经理填报原值，也可输入新值；确认时保存草稿，提交本人二次确认后形成 S3 最终值。";
      }
      return "可保留 S1 业务经理填报原值，也可输入新值；确认时保存草稿，提交本人二次确认后形成 S3 最终值。";
    },
    buildS3ChoiceDraftKey,
    buildS3PopoverKey,
    isS3PopoverVisible,
    toggleS3Popover,
    closeS3Popover,
    handleDocumentClickForS3Popover,
    getS3SelectedChoice,
    onS3ChoiceChange,
    buildS3CustomDraftKey,
    getS3CustomInputValue,
    onS3CustomInput,
    buildS3OpinionDraftKey,
    getS3StoredOpinion,
    getS3OpinionInputValue,
    onS3OpinionInput,
    hasS3CellOpinion,
    updateS3CandidateLocally,
    resolveS3DecisionValue,
    applyS3DecisionValue,
    persistS3CellDecision,
    confirmS3CellDecision,
    confirmS3CustomValue,
    confirmS3SelectedValue,
    collectS3DecisionTargets,
    applyS3BulkDecision,
  };
}
