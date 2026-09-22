<template>
  <div
    class="table-wrap"
    :class="{
      'is-embedded': embedded,
      'has-unit-column': showUnitColumn,
    }"
  >
    <table class="audit-table">
      <thead>
        <tr>
          <th class="sticky-col subject-col">{{ subjectLabel }}</th>
          <th v-if="showUnitColumn" class="sticky-col-2 unit-col">{{ unitLabel }}</th>
          <th v-for="column in normalizedColumns" :key="column.key">
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in normalizedRows"
          :key="resolveRowKey(row)"
          :class="{
            'subject-tree-parent-row': isParentRow(row),
            'subject-tree-leaf-row': !isParentRow(row),
            'is-calculated-row': isCalculatedValueRow(row),
          }"
        >
          <td
            class="sticky-col subject-col subject-tree-col"
            :class="{ 'is-collapse-parent': isParentRow(row) }"
            @click="isParentRow(row) && toggleTreeRow(row)"
          >
            <div class="subject-tree-cell" :style="subjectCellStyle(row)">
              <button
                v-if="isParentRow(row)"
                type="button"
                class="subject-tree-toggle"
                @click.stop="toggleTreeRow(row)"
              >
                <el-icon v-if="collapsedSubjectTreeMap[resolveRowKey(row)]"><ArrowRight /></el-icon>
                <el-icon v-else><ArrowDown /></el-icon>
              </button>
              <span v-else class="subject-tree-leaf-mark"></span>
              <span class="subject-tree-label">{{ resolveSubjectLabel(row) }}</span>
            </div>
          </td>
          <td v-if="showUnitColumn" class="sticky-col-2 unit-col">{{ resolveUnitText(row) }}</td>
          <td
            v-for="column in normalizedColumns"
            :key="`${resolveRowKey(row)}_${column.key}`"
            :class="resolveCellClass(row, column)"
            @click="!isEditable(row, column) && closeCellEditor()"
          >
            <el-popover
              v-if="isEditable(row, column) && useValuePopover"
              :visible="isCellEditorOpen(row, column)"
              trigger="manual"
              placement="bottom-start"
              width="390"
              popper-class="revenue-audit-cell-popover"
              teleported
            >
              <div class="audit-cell-editor-panel" @click.stop>
                <div class="audit-popover-title">{{ resolvePopoverTitle(row, column) }}</div>
                <div class="audit-popover-sub">{{ cellPopoverSubText }}</div>

                <div v-if="activeHistoryItems.length" class="audit-choice-list">
                  <label
                    v-for="(item, index) in activeHistoryItems"
                    :key="item.key || index + '_' + item.value"
                    class="audit-choice-item"
                    :class="{ 'is-selected': editor.choice === 'history_' + index }"
                  >
                    <div class="audit-choice-head">
                      <el-radio v-model="editor.choice" :value="'history_' + index" :label="'history_' + index">
                        {{ item.level || "历史候选" }}
                      </el-radio>
                      <b>{{ formatHistoryValue(item) }}</b>
                    </div>
                    <div class="audit-choice-meta">
                      <span>{{ item.reviewer || "-" }}</span>
                      <span>{{ item.time || "-" }}</span>
                      <span v-if="item.status">{{ item.status }}</span>
                    </div>
                    <div v-if="item.opinion" class="audit-choice-note">
                      {{ item.opinion }}
                    </div>
                  </label>
                </div>
                <div v-else class="audit-choice-empty">暂无历史审核值，可直接输入本级确认值。</div>

                <div
                  class="audit-custom-row"
                  :class="{ 'is-selected': editor.choice === 'custom' }"
                  @click="selectEditorChoice('custom')"
                >
                  <el-radio
                    v-model="editor.choice"
                    value="custom"
                    label="custom"
                    @update:model-value="selectEditorChoice($event)"
                  >
                    {{ customValueLabel }}
                  </el-radio>
                  <el-input
                    v-if="editor.choice === 'custom'"
                    v-model="editor.customValue"
                    size="small"
                    placeholder="请输入本级确认值"
                    @focus="selectEditorChoice('custom')"
                  />
                </div>

                <div v-if="shouldShowOpinionEditor" class="audit-opinion-row">
                  <div class="audit-opinion-label">文字意见</div>
                  <el-input
                    v-model="editor.opinion"
                    type="textarea"
                    :rows="2"
                    :placeholder="opinionPlaceholder"
                  />
                </div>

                <div class="audit-popover-actions">
                  <el-button size="small" @click="closeCellEditor">取消</el-button>
                  <el-button size="small" type="primary" @click="confirmCellEditor">确认</el-button>
                </div>
              </div>
              <template #reference>
                <el-button
                  class="audit-cell-editor-trigger"
                  size="small"
                  :type="resolveCellType(row, column)"
                  plain
                  @click.stop="openCellEditor(row, column)"
                >
                  {{ resolveCellText(row, column) }}
                </el-button>
              </template>
            </el-popover>
            <el-button
              v-else-if="isEditable(row, column)"
              size="small"
              :type="resolveCellType(row, column)"
              plain
              @click.stop="emitCellClick(row, column)"
            >
              {{ resolveCellText(row, column) }}
            </el-button>
            <span v-else :class="{ 'calculated-cell-value': isCalculatedValueRow(row) }">
              <span v-if="resolveAggregateLabel(row, column)" class="aggregate-value-wrap">
                <span class="aggregate-value-text">{{ resolveCellText(row, column) }}</span>
                <span class="aggregate-calc-tag">{{ resolveAggregateLabel(row, column) }}</span>
              </span>
              <span v-else>{{ resolveCellText(row, column) }}</span>
            </span>
          </td>
        </tr>
        <tr v-if="!normalizedRows.length">
          <td :colspan="normalizedColumns.length + (showUnitColumn ? 2 : 1)" class="empty-row">{{ emptyText }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { reactive } from "vue";
import { ArrowRight, ArrowDown } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
  buildSubjectTreeRows,
  enrichMatrixRowPathContext,
  getDisplayAggregateFormulaLabel,
  getRowCellValue,
  getSubjectTreeDataRow,
  getSubjectTreeRowDepth,
  getSubjectTreeRowKey,
  getSubjectTreeRowLabel,
  getSubjectTreeParentCellValue,
  isDisplayAggregateColumn,
  isSubjectTreeParentRow,
  REVENUE_ROW_KIND,
  formatRevenueTableCellValue,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import { formatPeriodExpenseDisplayText } from "@/utils/displayText";

export default {
  name: "SubjectAuditMatrix",
  components: { ArrowRight, ArrowDown },
  props: {
    rows: {
      type: Array,
      default: () => [],
    },
    columns: {
      type: Array,
      default: () => [],
    },
    subjectLabel: {
      type: String,
      default: "科目",
    },
    unitLabel: {
      type: String,
      default: "单位",
    },
    showUnitColumn: {
      type: Boolean,
      default: true,
    },
    embedded: {
      type: Boolean,
      default: false,
    },
    emptyText: {
      type: String,
      default: "当前模块无可审核科目",
    },
    canEditCell: {
      type: Function,
      default: null,
    },
    cellText: {
      type: Function,
      default: null,
    },
    cellType: {
      type: Function,
      default: null,
    },
    cellClass: {
      type: Function,
      default: null,
    },
    unitText: {
      type: Function,
      default: null,
    },
    parentSubjectDisplay: {
      type: Object,
      default: () => ({}),
    },
    useValuePopover: {
      type: Boolean,
      default: true,
    },
    cellRecord: {
      type: Function,
      default: null,
    },
    cellHistory: {
      type: Function,
      default: null,
    },
    cellPopoverTitle: {
      type: Function,
      default: null,
    },
    cellPopoverSubText: {
      type: String,
      default: "可选择历史审核值，也可输入新值；确认后该单元格会记录为本级修改值。",
    },
    customValueLabel: {
      type: String,
      default: "输入新值（本级确认）",
    },
    opinionPlaceholder: {
      type: String,
      default: "可填写本次修改值的审核意见",
    },
  },
  emits: ["cell-click", "cell-confirm"],
  setup() {
    const collapsedSubjectTreeMap = reactive({});
    const editor = reactive({
      key: "",
      row: null,
      column: null,
      choice: "custom",
      customValue: "",
      opinion: "",
      history: [],
    });
    return { collapsedSubjectTreeMap, editor };
  },
  computed: {
    normalizedRows() {
      return buildSubjectTreeRows(this.rows, {
        collapsedMap: this.collapsedSubjectTreeMap,
        parentDisplayMap: this.parentSubjectDisplay,
        keyPrefix: this.treeKeyPrefix,
      });
    },
    treeKeyPrefix() {
      const first = Array.isArray(this.rows) && this.rows.length ? this.rows[0] : null;
      if (!first || typeof first !== "object") return "";
      return String(
        first.__moduleRootId ||
          first.__moduleRootName ||
          first.rootSubjectId ||
          first.rootSubjectName ||
          first.subtable ||
          ""
      ).trim();
    },
    normalizedColumns() {
      return (Array.isArray(this.columns) ? this.columns : [])
        .map((item, index) => {
          const key = String((item && item.key) || `col_${index}`);
          return {
            ...item,
            key,
            label: String((item && item.label) || key),
          };
        })
        .filter((item) => item.key);
    },
    activeHistoryItems() {
      return Array.isArray(this.editor.history) ? this.editor.history : [];
    },
    shouldShowOpinionEditor() {
      return this.editor.choice === "custom" &&
        String(this.editor.customValue == null ? "" : this.editor.customValue).trim() !== "";
    },
  },
  mounted() {
    document.addEventListener("click", this.onDocumentClick);
  },
  beforeUnmount() {
    this.closeCellEditor();
    document.removeEventListener("click", this.onDocumentClick);
  },
  methods: {
    dataRow(row) {
      return getSubjectTreeDataRow(row);
    },
    cellValueRow(row, column) {
      const dataRow = this.dataRow(row);
      if (column && column.rndInvestmentAmount && column.unit) {
        return {
          ...dataRow,
          unit: column.unit,
        };
      }
      return dataRow;
    },
    isParentRow(row) {
      return isSubjectTreeParentRow(row);
    },
    resolveRowKey(row) {
      return getSubjectTreeRowKey(row);
    },
    resolveSubjectLabel(row) {
      const label = formatPeriodExpenseDisplayText(getSubjectTreeRowLabel(row));
      if (this.isParentRow(row)) {
        return label;
      }
      const unit = this.resolveRawUnitText(row);
      if (!unit) return label;
      if (label.endsWith(`（${unit}）`) || label.endsWith(`(${unit})`)) return label;
      return `${label}（${unit}）`;
    },
    subjectCellStyle(row) {
      return {
        paddingLeft: `${getSubjectTreeRowDepth(row) * 18 + 8}px`,
      };
    },
    toggleTreeRow(row) {
      if (!this.isParentRow(row)) return;
      const key = this.resolveRowKey(row);
      if (this.collapsedSubjectTreeMap[key]) {
        delete this.collapsedSubjectTreeMap[key];
      } else {
        this.collapsedSubjectTreeMap[key] = true;
      }
    },
    emitCellClick(row, column) {
      if (this.isParentRow(row)) return;
      this.$emit("cell-click", this.dataRow(row), column);
    },
    isCalculatedValueRow(row) {
      if (this.isParentRow(row)) return false;
      const dataRow = this.dataRow(row);
      if (!dataRow || typeof dataRow !== "object") return false;
      const rowKind = String(dataRow.rowKind || dataRow.rowType || "").trim();
      const valueSource = String(dataRow.valueSource || dataRow.sourceType || "").trim().toLowerCase();
      const inputType = String(dataRow.inputType || "").trim().toLowerCase();
      return (
        rowKind === REVENUE_ROW_KIND.FORMULA ||
        rowKind === REVENUE_ROW_KIND.ROW_SUBTOTAL ||
        valueSource === "formula" ||
        valueSource === "calculation" ||
        valueSource === "computed" ||
        inputType === "calc" ||
        inputType === "formula"
      );
    },
    resolveCellClass(row, column) {
      const baseClass = {
        "is-calculated-cell": this.isCalculatedValueRow(row),
        "is-reviewable-cell": this.isEditable(row, column),
      };
      // 合并科目树路径，便于按科目名/路径做展示样式判断（如边际贡献小计加粗）
      const extraClass =
        !this.isParentRow(row) && typeof this.cellClass === "function"
          ? this.cellClass(enrichMatrixRowPathContext(this.dataRow(row), row), column)
          : null;
      return [baseClass, extraClass];
    },
    buildCellEditorKey(row, column) {
      return `${this.resolveRowKey(row)}__${column && column.key ? column.key : ""}`;
    },
    isCellEditorOpen(row, column) {
      return this.editor.key === this.buildCellEditorKey(row, column);
    },
    resolveCellRecord(row, column) {
      if (typeof this.cellRecord !== "function") return null;
      return this.cellRecord(this.dataRow(row), column) || null;
    },
    resolveCellHistory(row, column) {
      if (typeof this.cellHistory !== "function") return [];
      const list = this.cellHistory(this.dataRow(row), column);
      return Array.isArray(list) ? list : [];
    },
    resolvePopoverTitle(row, column) {
      if (typeof this.cellPopoverTitle === "function") {
        const title = this.cellPopoverTitle(this.dataRow(row), column);
        if (title) return formatPeriodExpenseDisplayText(title);
      }
      const subject = this.resolveSubjectLabel(row);
      const columnLabel = column && column.label ? column.label : "";
      return columnLabel ? `${subject} / ${columnLabel}` : subject;
    },
    resolveUnitText(row) {
      const text = this.resolveRawUnitText(row);
      return text || "-";
    },
    resolveRawUnitText(row) {
      if (this.isParentRow(row)) return "";
      const dataRow = this.dataRow(row);
      if (typeof this.unitText === "function") {
        const value = this.unitText(dataRow);
        const text = String(value == null ? "" : value).trim();
        return text === "-" ? "" : text;
      }
      const text = String(dataRow && dataRow.unit != null ? dataRow.unit : "").trim();
      return text === "-" ? "" : text;
    },
    findHistoryIndex(record, history) {
      if (!record || !Array.isArray(history) || !history.length) return -1;
      const sourceRecordId = String(record.sourceRecordId || record.recordId || "");
      const sourceReviewId = String(record.sourceReviewId || record.reviewId || "");
      if (sourceRecordId) {
        const index = history.findIndex((item) => String(item.recordId || "") === sourceRecordId);
        if (index >= 0) return index;
      }
      if (sourceReviewId) {
        const index = history.findIndex((item) => String(item.reviewId || "") === sourceReviewId);
        if (index >= 0) return index;
      }
      if (Number.isInteger(record.sourceIndex) && record.sourceIndex >= 0 && record.sourceIndex < history.length) {
        return record.sourceIndex;
      }
      return -1;
    },
    openCellEditor(row, column) {
      if (this.isParentRow(row)) return;
      const history = this.resolveCellHistory(row, column);
      const record = this.resolveCellRecord(row, column);
      const historyIndex = this.findHistoryIndex(record, history);

      this.editor.key = this.buildCellEditorKey(row, column);
      this.editor.row = this.dataRow(row);
      this.editor.column = column;
      this.editor.history = history;

      if (record && String(record.sourceType || "").toLowerCase().includes("history") && historyIndex >= 0) {
        this.editor.choice = `history_${historyIndex}`;
        this.editor.customValue = "";
        this.editor.opinion = "";
        return;
      }

      if (!record && history.length) {
        this.editor.choice = "history_0";
        this.editor.customValue = "";
        this.editor.opinion = "";
        return;
      }

      this.editor.choice = "custom";
      this.editor.customValue = record && record.value != null
        ? formatRevenueTableCellValue(this.cellValueRow(row, column), record.value)
        : "";
      this.editor.opinion = record && record.opinion ? String(record.opinion) : "";
    },
    selectEditorChoice(choice) {
      const nextChoice = String(choice || "custom");
      this.editor.choice = nextChoice;
      if (nextChoice !== "custom") {
        this.editor.opinion = "";
      }
    },
    blurActiveCellPopoverElement() {
      if (typeof document === "undefined") return;
      const activeElement = document.activeElement;
      if (
        activeElement &&
        typeof activeElement.blur === "function" &&
        typeof activeElement.closest === "function" &&
        activeElement.closest(".revenue-audit-cell-popover")
      ) {
        activeElement.blur();
      }
    },
    closeCellEditor() {
      this.blurActiveCellPopoverElement();
      this.editor.key = "";
      this.editor.row = null;
      this.editor.column = null;
      this.editor.choice = "custom";
      this.editor.customValue = "";
      this.editor.opinion = "";
      this.editor.history = [];
    },
    onDocumentClick(event) {
      const target = event && event.target;
      if (!target || !this.editor.key) return;
      if (
        target.closest &&
        (target.closest(".revenue-audit-cell-popover") ||
          target.closest(".audit-cell-editor-trigger"))
      ) {
        return;
      }
      this.closeCellEditor();
    },
    confirmCellEditor() {
      const row = this.editor.row;
      const column = this.editor.column;
      if (!row || !column) return;

      const doConfirm = (val) => {
        this.closeCellEditor();
        this.$emit("cell-confirm", row, column, val);
      };

      if (String(this.editor.choice).indexOf("history_") === 0) {
        const index = Number(String(this.editor.choice).replace("history_", ""));
        const picked = this.activeHistoryItems[index];
        if (!picked) {
          ElMessage.warning("请选择一个历史审核值");
          return;
        }
        doConfirm({
          sourceType: "history",
          sourceIndex: index,
          sourceRecordId: picked.recordId,
          sourceReviewId: picked.reviewId,
          sourceStageCode: picked.stageCode,
          value: picked.value,
          opinion: "",
        });
        return;
      }
      const value = String(this.editor.customValue == null ? "" : this.editor.customValue).trim();
      if (!value) {
        ElMessage.warning("请输入本级确认值");
        return;
      }
      doConfirm({
        sourceType: "custom",
        sourceIndex: -1,
        value,
        opinion: String(this.editor.opinion || "").trim(),
      });
    },
    formatHistoryValue(item) {
      const value = item && item.value != null ? String(item.value) : "";
      return value ? formatRevenueTableCellValue(this.cellValueRow(this.editor.row, this.editor.column), value) : "-";
    },
    isEditable(row, column) {
      if (this.isParentRow(row)) return false;
      return typeof this.canEditCell === "function" && this.canEditCell(this.dataRow(row), column);
    },
    resolveCellText(row, column) {
      if (this.isParentRow(row)) {
        return getSubjectTreeParentCellValue(row, column);
      }
      if (isDisplayAggregateColumn(column)) {
        const text = String(
          getRowCellValue(enrichMatrixRowPathContext(this.dataRow(row), row), column) || ""
        ).trim();
        return text || "-";
      }
      if (typeof this.cellText !== "function") return "-";
      const dataRow = this.dataRow(row);
      const value = this.cellText(dataRow, column);
      const formatted = formatRevenueTableCellValue(this.cellValueRow(row, column), value);
      if (formatted) return formatted;
      const text = String(value == null ? "" : value).trim();
      return text || "-";
    },
    resolveAggregateLabel(row, column) {
      if (!isDisplayAggregateColumn(column)) return "";
      if (this.isParentRow(row)) return "";
      return getDisplayAggregateFormulaLabel(
        enrichMatrixRowPathContext(this.dataRow(row), row),
        column
      );
    },
    resolveCellType(row, column) {
      if (typeof this.cellType !== "function") return "default";
      return this.cellType(this.dataRow(row), column) || "default";
    },
  },
};
</script>

<style lang="scss" scoped>
.table-wrap {
  margin: 0 16px;
  border: 1px solid var(--rv-line);
  border-radius: 8px;
  overflow: auto;
  background: #fff;

  &.is-embedded {
    margin: 0;
    border: 0;
    border-radius: 0;
  }
}

.audit-table {
  --subject-col-width: 320px;
  --unit-col-width: 100px;
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;

  th,
  td {
    border: 1px solid #e8edf5;
    padding: 6px 8px;
    font-size: 12px;
    color: #2f4258;
    white-space: nowrap;
    background: #fff;
  }

  th {
    background: #f6f9ff;
    color: #415670;
    font-weight: 600;
  }

  .sticky-col {
    position: sticky;
    left: 0;
    z-index: 2;
    background: #fff;
  }

  .sticky-col-2 {
    position: sticky;
    left: var(--subject-col-width);
    z-index: 2;
    background: #fff;
  }

  .subject-col {
    min-width: var(--subject-col-width);
    width: var(--subject-col-width);
  }

  .unit-col {
    min-width: var(--unit-col-width);
    width: var(--unit-col-width);
    color: #5f718c;
    text-align: left;
  }

  :deep(thead) .sticky-col,
  :deep(thead) .sticky-col-2 {
    z-index: 4;
    background: #f6f9ff;
  }

  .subject-tree-parent-row td {
    background: #f9fbff;
    font-weight: 600;
  }

  .subject-tree-parent-row .sticky-col,
  .subject-tree-parent-row .sticky-col-2 {
    background: #f9fbff;
  }

  .subject-tree-col.is-collapse-parent {
    cursor: pointer;
  }

  .subject-tree-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 20px;
  }

  .subject-tree-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    color: #60758e;
    background: transparent;
    cursor: pointer;
  }

  .subject-tree-leaf-mark {
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    position: relative;
  }

  .subject-tree-leaf-mark::after {
    content: "";
    position: absolute;
    left: 3px;
    top: 8px;
    width: 8px;
    border-top: 1px solid #9fb0c5;
  }

  .subject-tree-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-kind-badge {
    flex: 0 0 auto;
    padding: 1px 5px;
    border: 1px solid #dfe5ee;
    border-radius: 4px;
    background: #f7f9fc;
    color: #7b8796;
    font-size: 11px;
    line-height: 16px;
    font-weight: 500;
  }

  .subject-tree-leaf-row.is-calculated-row td {
    background: #fafbfd;
    color: #6f7d8d;
  }

  .subject-tree-leaf-row.is-calculated-row .sticky-col,
  .subject-tree-leaf-row.is-calculated-row .sticky-col-2 {
    background: #fafbfd;
  }

  .is-calculated-cell {
    cursor: not-allowed;
  }

  .history-value-diff-cell {
    background: #fff8ec;
    box-shadow: inset 0 0 0 1px #f3b85d;

    .audit-cell-editor-trigger,
    .audit-cell-editor-trigger.el-button--warning.is-plain {
      border-color: #e6a23c;
      color: #9a5b00;
      background: #fff8ec;
    }
  }

  /* 主表「边际贡献」小计/加权、全生命周期小计数字加粗 */
  td.margin-contrib-subtotal-bold-cell {
    font-weight: 700 !important;
    color: #303133;

    .calculated-cell-value,
    .aggregate-value-text,
    .aggregate-value-wrap,
    span {
      font-weight: 700 !important;
      color: #303133;
    }
  }

  .calculated-cell-value {
    display: inline-block;
    min-width: 24px;
    color: #6f7d8d;
  }

  .aggregate-value-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
    max-width: 100%;
    white-space: nowrap;
  }

  .aggregate-value-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .aggregate-calc-tag {
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 6px;
    border: 1px solid #b8d8f5;
    border-radius: 2px;
    background: #eef7ff;
    color: #2f6fa8;
    font-size: 11px;
    line-height: 16px;
    font-weight: 600;
  }

  .empty-row {
    text-align: center;
    color: #8093aa;
    padding: 16px 0;
  }
}

.audit-cell-editor-trigger {
  max-width: 132px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<style lang="scss">
.revenue-audit-cell-popover {
  padding: 0;
  border: 1px solid #d7e2ef;
  border-radius: 8px;
  box-shadow: 0 18px 38px rgba(22, 52, 91, 0.16);

  .audit-cell-editor-panel {
    padding: 12px;
  }

  .audit-popover-title {
    font-size: 14px;
    line-height: 20px;
    font-weight: 700;
    color: #2e3f57;
  }

  .audit-popover-sub {
    margin-top: 4px;
    color: #5f718c;
    font-size: 12px;
    line-height: 18px;
  }

  .audit-choice-list {
    display: grid;
    gap: 8px;
    margin-top: 10px;
    max-height: 220px;
    overflow: auto;
  }

  .audit-choice-item,
  .audit-custom-row {
    border: 1px solid #e1e9f3;
    border-radius: 8px;
    padding: 8px 9px;
    background: #f9fbff;
    display: grid;
    gap: 5px;
    cursor: pointer;
  }

  .audit-choice-item.is-selected,
  .audit-custom-row.is-selected {
    border-color: #7ca9df;
    background: #f4f8ff;
  }

  .audit-choice-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: #374c67;

    b {
      color: #123b6d;
      font-size: 13px;
      white-space: nowrap;
    }
  }

  .audit-choice-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-left: 23px;
    font-size: 11px;
    color: #7b8da5;
  }

  .audit-choice-note {
    padding-left: 23px;
    font-size: 12px;
    line-height: 18px;
    color: #60748f;
    white-space: normal;
  }

  .audit-choice-empty {
    margin-top: 10px;
    border: 1px dashed #d8e3f0;
    border-radius: 8px;
    padding: 10px;
    color: #7b8da5;
    background: #fbfdff;
    font-size: 12px;
  }

  .audit-custom-row {
    margin-top: 10px;
  }

  .audit-opinion-row {
    margin-top: 10px;
  }

  .audit-opinion-label {
    margin-bottom: 5px;
    color: #415670;
    font-size: 12px;
    font-weight: 600;
  }

  .audit-popover-actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
