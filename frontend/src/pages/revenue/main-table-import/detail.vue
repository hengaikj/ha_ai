<template>
  <div class="project-detail">
    <div class="detail-header">
      <div>
        <div class="detail-title">
          {{ projectName }} / {{ currentValvePoint || "-" }}
          <span class="detail-title-sub">{{ isPreviewMode ? "导入预览" : "阀点详情" }}</span>
        </div>
        <div class="detail-subtitle">
          {{
            isPreviewMode
              ? "展示解析结果与校验信息，确认后执行入库。"
              : "在阀点详情中上传模板并解析，解析成功后进入导入预览确认入库。"
          }}
        </div>
      </div>
      <div class="detail-actions">
        <input
          ref="importInput"
          class="import-input"
          type="file"
          accept=".xlsx,.xls"
          @change="handleFileChange"
        />

        <template v-if="!isPreviewMode">
          <el-button
            size="small"
            type="primary"
            :icon="Upload"
            :loading="parsing"
            :disabled="savingImport"
            @click="triggerImport"
          >
            {{ importButtonText }}
          </el-button>
          <el-button
            v-if="canRemoveImportRecords"
            size="small"
            type="danger"
            plain
            :icon="Delete"
            :loading="deletingValveRecords"
            :disabled="parsing || savingImport || historyLoading || !projectId || !currentValvePoint"
            @click="handleDeleteCurrentValveRecords"
          >
            删除
          </el-button>
        </template>

        <template v-else>
          <el-button size="small" :icon="Back" @click="handleBackToValve">
            返回阀点详情
          </el-button>
          <el-button
            size="small"
            type="success"
            :icon="Check"
            :loading="savingImport"
            :disabled="!canConfirmImport || parsing"
            @click="confirmImportToServer"
          >
            确认入库
          </el-button>
        </template>

        <el-button size="small" :icon="HomeFilled" @click="$emit('back')">
          返回列表
        </el-button>
      </div>
    </div>

    <el-dialog
      v-model="importDialogVisible"
      title="选择导入信息"
      width="560px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form
        ref="importFormRef"
        :model="importForm"
        :rules="importFormRules"
        label-width="96px"
        size="small"
      >
        <el-form-item label="项目">
          <el-input :value="projectName" disabled />
        </el-form-item>
        <el-form-item label="项目编号">
          <el-input :value="projectCode || '-'" disabled />
        </el-form-item>
        <el-form-item label="项目阀点" prop="valveId">
          <el-select
            v-model="importForm.valveId"
            placeholder="请选择项目阀点"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="item in normalizedValveList"
              :key="item.id"
              :label="item.valveName || item.valvePoint || item.id"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目录" prop="rootSubjectId">
          <el-select
            v-model="importForm.rootSubjectId"
            placeholder="请选择科目目录"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="item in importSubjectRootOptions"
              :key="item.id"
              :label="item.label"
              :value="item.id"
            >
              <span>{{ item.label }}</span>
              <span style="float: right; color: #8b97a8; font-size: 12px">
                {{ item.leafCount }} 项
              </span>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
<span class="dialog-footer">
        <el-button size="small" @click="importDialogVisible = false">取消</el-button>
        <el-button
          size="small"
          type="success"
          :loading="parsing"
          :disabled="savingImport"
          @click="handleImportDialogConfirm"
          :icon="Download"
        >
          导入
        </el-button>
      </span>
</template>
    </el-dialog>

    <div v-loading="loading" class="detail-body">
      <div v-if="!isPreviewMode" class="detail-card valve-tabs-card">
        <el-empty
          v-if="!normalizedValveList.length && !loading"
          description="当前项目暂无阀点信息"
          :image-size="96"
        />

        <el-tabs
          v-else
          v-model="activeValveId"
          class="valve-tabs"
          @tab-click="handleTabClick"
        >
          <el-tab-pane
            v-for="item in normalizedValveList"
            :key="item.id"
            :label="item.valveName"
            :name="item.id"
          />
        </el-tabs>
      </div>

      <el-card v-if="!isPreviewMode" shadow="never" class="detail-card placeholder-card">
        <div v-if="activeValve" class="placeholder-content">
          <div v-loading="historyLoading" class="history-panel">
            <el-empty
              v-if="historyError"
              :description="historyError"
              :image-size="72"
            />

            <el-empty
              v-else-if="!historyTableColumnGroups.length"
              description="当前阀点暂无历史数据"
              :image-size="72"
            />

            <div v-else class="expense-table-wrap">
              <table class="expense-table">
                <thead>
                  <tr>
                    <th rowspan="2" class="sticky-col subject-header">项目</th>
                    <th
                      v-for="group in historyTableColumnGroups"
                      :key="group.year"
                      :colspan="group.columns.length"
                      class="year-header"
                    >
                      {{ group.year }}
                    </th>
                  </tr>
                  <tr>
                    <th
                      v-for="column in historyTableColumns"
                      :key="column.key"
                      class="trim-header"
                    >
                      {{ column.trimName }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in historyTableRows"
                    :key="row.subjectId"
                    :class="{
                      'is-group-row': !row.isLeaf,
                      'is-leaf-row': row.isLeaf,
                    }"
                  >
                    <td class="sticky-col subject-cell">
                      <div
                        class="subject-label"
                        :style="{ paddingLeft: `${row.level * 18 + 12}px` }"
                      >
                        <span>{{ row.subjectName }}</span>
                        <span v-if="row.unit" class="subject-unit">{{ row.unit }}</span>
                      </div>
                    </td>
                    <td
                      v-for="column in historyTableColumns"
                      :key="`${row.subjectId}-${column.key}`"
                      :class="{
                        'cell-value': true,
                        'is-empty': !row.cellMap[column.key],
                      }"
                    >
                      {{ row.cellMap[column.key] || "-" }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <el-empty
          v-else
          description="请选择阀点"
          :image-size="96"
        />
      </el-card>

      <el-card v-else shadow="never" class="detail-card preview-card">
        <div class="preview-summary-grid">
          <div class="summary-item">
            <div class="k">解析文件</div>
            <div class="v">{{ parseFileText }}</div>
          </div>
          <div class="summary-item">
            <div class="k">选择目录</div>
            <div class="v">{{ parseRootSubjectText }}</div>
          </div>
          <div class="summary-item">
            <div class="k">可入库数据</div>
            <div class="v">{{ dryRunPayloadCount }}</div>
          </div>
          <div class="summary-item">
            <div class="k">未匹配科目</div>
            <div class="v">{{ dryRunUnmatched.length }}</div>
          </div>
          <div class="summary-item">
            <div class="k">跳过单元格</div>
            <div class="v">{{ dryRunSkipped.length }}</div>
          </div>
        </div>

        <el-empty
          v-if="!displayParsedWorkbook"
          description="请先在阀点详情中解析文件"
          :image-size="90"
        />

        <template v-else>
          <el-alert
            v-if="displayPreparation && displayPreparation.dryRunError"
            class="preview-alert"
            type="warning"
            :closable="false"
            :title="displayUiText(displayPreparation.dryRunError)"
            show-icon
          />

          <div class="expense-table-wrap preview-table-wrap">
            <table class="expense-table preview-table">
              <thead>
                <tr>
                  <th class="sticky-col preview-sticky-col row-index-col">模板行</th>
                  <th class="sticky-col preview-sticky-col second-col">分组</th>
                  <th class="sticky-col preview-sticky-col third-col">科目</th>
                  <th
                    v-for="column in previewColumns"
                    :key="column.key"
                    :class="{
                      'trim-header': true,
                      'is-computed-lifecycle': column.isComputedLifecycle,
                    }"
                  >
                    {{ column.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in previewRows" :key="row.rowIndex">
                  <td class="sticky-col preview-sticky-col row-index-col cell-value">{{ row.rowIndex }}</td>
                  <td class="sticky-col preview-sticky-col second-col cell-value">{{ displayUiText(row.group || "-") }}</td>
                  <td class="sticky-col preview-sticky-col third-col cell-value">{{ displayUiText(row.item || "-") }}</td>
                  <td
                    v-for="column in previewColumns"
                    :key="`${row.rowIndex}-${column.key}`"
                    :class="{
                      'cell-value': true,
                      'is-empty': row.cellMap[column.key].text === '-',
                      'is-error': row.cellMap[column.key].isError,
                      'is-computed-lifecycle': column.isComputedLifecycle,
                    }"
                  >
                    {{ row.cellMap[column.key].text }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="dryRunUnmatched.length || dryRunSkipped.length" class="preview-issues">
            <div v-if="dryRunUnmatched.length" class="issue-panel">
              <div class="issue-title">未匹配科目（{{ dryRunUnmatched.length }}）</div>
              <ul>
                <li v-for="(item, index) in dryRunUnmatched.slice(0, 20)" :key="`u-${index}`">
                  行 {{ item.rowIndex }} / {{ displayUiText(item.item) }}：{{ displayUiText(item.reason) }}
                </li>
              </ul>
            </div>
            <div v-if="dryRunSkipped.length" class="issue-panel">
              <div class="issue-title">跳过单元格（{{ dryRunSkipped.length }}）</div>
              <ul>
                <li v-for="(item, index) in dryRunSkipped.slice(0, 20)" :key="`s-${index}`">
                  {{ item.address }}（{{ displayUiText(item.item) }}）：{{ displayUiText(item.reason) }}
                </li>
              </ul>
            </div>
          </div>
        </template>
      </el-card>
    </div>
  </div>
</template>

<script>
import { Upload, Delete, Back, Check, HomeFilled, Download } from "@element-plus/icons-vue";
import {
  deleteImportedProjectCostRecords,
  getAuthorizedProjectCostRecords,
  getProjectCostWritableSubjects,
  getUserExpenseSubjectPermissionTree,
  importProjectCosts,
} from "@/api/system/expenses";
import { useAuthStore } from "@/stores/auth";
import { hasPermi } from "@/utils/hasPermi";
import { AUDIT_DOMAIN } from "@/pages/revenue/subtable-workbench/domain-config";
import { parseRevenueImportWorkbookFile } from "@/pages/revenue/subtable-workbench/excel-template-parser";
import { formatPeriodExpenseDisplayText } from "@/utils/displayText";
import {
  REVENUE_AGGREGATE_MODE,
  getDisplayAggregateValue,
  isLifecycleYearLabel,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import { applyRevenueTemplateMeta } from "@/pages/revenue/subtable-workbench/template-meta";
import {
  formatRevenueDisplayValue,
  isPercentUnit,
  normalizeExcelCellForRevenue,
  parseRevenueNumber,
} from "@/pages/revenue/subtable-workbench/value-normalizer";

const MAIN_TABLE_SUBJECT_ROOT_NAMES = Object.freeze(["主表", "单车收益", "项目利润"]);

export default {
  name: "MainTableImportDetail",
  emits: ["back", "open-valve", "open-preview"],
  setup() {
    const authStore = useAuthStore();
    return {
      Upload,
      Download,
      Delete,
      Back,
      Check,
      HomeFilled,
      authStore,
    };
  },
  props: {
    loading: {
      type: Boolean,
      default: false,
    },
    project: {
      type: Object,
      default: function () {
        return {};
      },
    },
    valveList: {
      type: Array,
      default: function () {
        return [];
      },
    },
    viewMode: {
      type: String,
      default: "valve",
    },
    initialValveId: {
      type: [String, Number],
      default: "",
    },
  },
  data() {
    return {
      activeValveId: "",
      authorizedSubjectTree: [],
      writableSubjectTree: [],
      writableLeafSubjects: [],
      historyError: "",
      historyLoading: false,
      historySnapshot: null,
      deletingValveRecords: false,
      parsing: false,
      savingImport: false,
      parsedWorkbook: null,
      pendingImportPreparation: null,
      importDialogVisible: false,
      selectedImportRootSubjectId: "",
      importForm: {
        valveId: "",
        rootSubjectId: "",
      },
      importFormRules: {
        valveId: [{ required: true, message: "请选择项目阀点", trigger: "change" }],
        rootSubjectId: [{ required: true, message: "请选择科目目录", trigger: "change" }],
      },
    };
  },
  computed: {
    projectId() {
      const fromProject = this.project.id || this.project.projectId;
      if (fromProject) {
        return String(fromProject);
      }
      const fromRoute = this.$route.query.projectId;
      return fromRoute ? String(fromRoute) : "";
    },
    projectName() {
      return (
        (this.project.vehicleModel && this.project.vehicleModel.modelName) ||
        this.project.modelName ||
        this.project.projectName ||
        "其他固定费用详情"
      );
    },
    projectCode() {
      return (
        this.project.projectCode ||
        this.project.wbsNumber ||
        this.project.projectNo ||
        this.projectId ||
        ""
      );
    },
    currentUserId() {
      return String(this.authStore.currentUser?.id || "").trim();
    },
    currentUserName() {
      return (
        this.authStore.currentUser?.displayName ||
        this.authStore.currentUser?.username ||
        "system"
      );
    },
    importSubjectRootOptions() {
      return this.buildRootSubjectOptions(this.writableSubjectTree);
    },
    selectedImportRootSubject() {
      return this.getImportRootSubjectById(this.selectedImportRootSubjectId);
    },
    viewModeValue() {
      return this.viewMode === "preview" ? "preview" : "valve";
    },
    isPreviewMode() {
      return this.viewModeValue === "preview";
    },
    hasPendingImport() {
      return Boolean(
        this.pendingImportPreparation &&
          this.pendingImportPreparation.parsedWorkbook
      );
    },
    canConfirmImport() {
      if (!this.hasPendingImport) {
        return false;
      }
      if (!this.pendingImportPreparation) {
        return false;
      }
      if (this.pendingImportPreparation.dryRunError) {
        return false;
      }
      return Boolean(this.pendingImportPreparation.preparedImport);
    },
    hasImportedValveData() {
      return this.historyRecords.length > 0;
    },
    canRemoveImportRecords() {
      return hasPermi("revenue:main-table:remove");
    },
    importButtonText() {
      return this.hasImportedValveData ? "重新导入" : "导入表格";
    },
    displayPreparation() {
      if (this.pendingImportPreparation) {
        return this.pendingImportPreparation;
      }
      if (this.parsedWorkbook) {
        return {
          fileName: this.parsedWorkbook.fileName,
          parsedWorkbook: this.parsedWorkbook,
          preparedImport: this.parsedWorkbook.preparedImport || null,
          dryRunError: this.parsedWorkbook.dryRunError || "",
        };
      }
      return null;
    },
    displayParsedWorkbook() {
      if (!this.displayPreparation) {
        return null;
      }
      return this.displayPreparation.parsedWorkbook || null;
    },
    dryRunResult() {
      if (!this.displayPreparation) {
        return null;
      }
      return this.displayPreparation.preparedImport || null;
    },
    dryRunPayloadCount() {
      const payload = this.dryRunResult && this.dryRunResult.payload;
      const items =
        (payload && payload.dataItems) ||
        (payload && payload.data) ||
        [];
      return (
        Array.isArray(items) ? items.length : 0
      );
    },
    dryRunUnmatched() {
      return (this.dryRunResult && this.dryRunResult.unmatchedSubjects) || [];
    },
    dryRunSkipped() {
      return (this.dryRunResult && this.dryRunResult.skippedCells) || [];
    },
    parseFileText() {
      if (!this.displayPreparation) {
        return "-";
      }
      return this.displayPreparation.fileName || "-";
    },
    parseRootSubjectText() {
      if (!this.displayPreparation) {
        return "-";
      }
      const rootSubject =
        this.displayPreparation.importContext &&
        this.displayPreparation.importContext.rootSubject;
      return (rootSubject && rootSubject.label) || "-";
    },
    currentValvePoint() {
      if (!this.activeValve) {
        return "";
      }
      return this.activeValve.valvePoint || "";
    },
    normalizedValveList() {
      return (this.valveList || []).map((item, index) => {
        const id = String(
          item.valveId ||
            item.projectValveId ||
            item.id ||
            `valve-${index}`
        );
        return {
          ...item,
          id,
          valveName: String(item.valveName || item.valvePoint || item.valveCode || "-").trim(),
          valvePoint: String(item.valvePoint || item.valveName || "").trim(),
          valvePassageTime:
            item.valvePassageTime || item.valveTime || item.createTime || "-",
          valveStatus:
            item.valveStatus != null ? String(item.valveStatus) : "",
          valveCode: String(item.valveCode || "").trim(),
        };
      });
    },
    activeValve() {
      return (
        this.normalizedValveList.find((item) => item.id === this.activeValveId) ||
        this.normalizedValveList[0] ||
        null
      );
    },
    currentBenefitCostPatternNames() {
      const list = Array.isArray(this.project.benefitCostPatternVos)
        ? this.project.benefitCostPatternVos
        : [];
      const seen = {};
      const result = [];
      list.forEach((item) => {
        const pattern =
          item && item.pattern && typeof item.pattern === "object"
            ? item.pattern
            : item;
        const patternName = this.normalizePatternName(
          pattern && (pattern.patternName || pattern.patternNumber || pattern.name || pattern.label)
        );
        if (!patternName || seen[patternName]) {
          return;
        }
        seen[patternName] = true;
        result.push(patternName);
      });
      return result;
    },
    historyRecords() {
      const snapshot = this.historySnapshot || {};
      return this.filterHistoryRecordsByCurrentPatterns(
        Array.isArray(snapshot.records) ? snapshot.records : []
      );
    },
    historyDisplaySubjects() {
      const rows = this.flattenDisplaySubjects(this.authorizedSubjectTree).filter(
        (item) =>
          this.normalizeExactSubjectName(item.subjectName || "") !== "主表"
      );
      if (!rows.length) {
        return [];
      }
      const minLevel = rows.reduce((min, item) => {
        const level = Number(item.level || 0);
        return level < min ? level : min;
      }, Number.POSITIVE_INFINITY);
      const baseLevel = Number.isFinite(minLevel) ? minLevel : 0;
      return rows.map((item) => {
        return {
          ...item,
          level: Math.max(0, Number(item.level || 0) - baseLevel),
        };
      });
    },
    historyTableColumnGroups() {
      const yearMap = new Map();
      this.historyRecords.forEach((item) => {
        const year = item.modelYear != null ? String(item.modelYear) : "-";
        const trimName = item.trimName || "-";
        if (!yearMap.has(year)) {
          yearMap.set(year, new Map());
        }
        const trimMap = yearMap.get(year);
        const key = `${year}::${trimName}`;
        if (!trimMap.has(key)) {
          trimMap.set(key, {
            key,
            year,
            trimName,
          });
        }
      });

      return Array.from(yearMap.entries())
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([year, trimMap]) => {
          const columns = Array.from(trimMap.values()).sort((a, b) =>
            String(a.trimName).localeCompare(String(b.trimName), "zh-CN")
          );
          return {
            year,
            columns,
          };
        });
    },
    historyTableColumns() {
      return this.historyTableColumnGroups.reduce((acc, item) => {
        return acc.concat(item.columns);
      }, []);
    },
    historyTableRows() {
      const recordMap = new Map();
      this.historyRecords.forEach((item) => {
        const key = this.buildHistoryCellKey(
          item.subjectId,
          item.modelYear,
          item.trimName
        );
        recordMap.set(key, item);
      });

      return this.historyDisplaySubjects.map((item) => {
        const cellMap = {};
        this.historyTableColumns.forEach((column) => {
          const key = this.buildHistoryCellKey(
            item.subjectId,
            column.year,
            column.trimName
          );
          const record = recordMap.get(key);
          cellMap[column.key] = record ? this.resolveRecordDisplayValue(record, item) : "";
        });
        return {
          ...item,
          cellMap,
        };
      });
    },
    previewColumns() {
      const workbook = this.displayParsedWorkbook;
      const table = workbook && workbook.tables && workbook.tables[0];
      if (!table || !Array.isArray(table.columns)) {
        return [];
      }
      const columns = [];
      const lifecycleTrimMap = new Map();
      const lifecycleSourceColumns = [];
      let hasLifecycleGroup = false;
      table.columns.forEach((columnGroup, yearIndex) => {
        const yearLabel = columnGroup.year || `年份${yearIndex + 1}`;
        const isLifecycleGroup = isLifecycleYearLabel(yearLabel);
        if (isLifecycleGroup) {
          hasLifecycleGroup = true;
        }
        (columnGroup.variants || []).forEach((variant, variantIndex) => {
          const variantName = variant.name || variant.key || `列${variantIndex + 1}`;
          columns.push({
            key: `${yearLabel}::${variant.key}::${variantIndex}`,
            yearLabel,
            columnKey: variant.key,
            variantName,
            label: `${yearLabel}/${variantName}`,
          });
          if (isLifecycleGroup) return;

          const trimKey = this.normalizePreviewTrimKey(variantName, `trim_${variantIndex}`);
          if (!lifecycleTrimMap.has(trimKey)) {
            lifecycleTrimMap.set(trimKey, {
              trimKey,
              trimName: variantName,
              trimIndex: lifecycleTrimMap.size,
              sourceColumns: [],
            });
          }
          const trimMeta = lifecycleTrimMap.get(trimKey);
          const sourceColumn = {
            key: `preview_source_${yearIndex}_${variantIndex}`,
            cellKey: `preview_source_${yearIndex}_${variantIndex}`,
            yearIndex,
            yearLabel,
            columnKey: variant.key,
            trimIndex: trimMeta.trimIndex,
            trimId: trimMeta.trimKey,
            trimName: trimMeta.trimName,
            real: true,
          };
          trimMeta.sourceColumns.push(sourceColumn);
          lifecycleSourceColumns.push(sourceColumn);
        });
      });
      if (!hasLifecycleGroup && lifecycleSourceColumns.length) {
        const matrixRows = this.buildPreviewMatrixRows(table, lifecycleSourceColumns);
        const matrixRowMap = matrixRows.reduce((acc, row) => {
          acc[String(row.rowIndex)] = row;
          return acc;
        }, {});
        lifecycleTrimMap.forEach((trimMeta) => {
          columns.push({
            key: `__preview_lifecycle__::${trimMeta.trimKey}`,
            yearLabel: "全生命周期",
            columnKey: "__preview_lifecycle__",
            variantName: trimMeta.trimName,
            label: `全生命周期/${trimMeta.trimName}`,
            isComputedLifecycle: true,
            displayOnly: true,
            real: false,
            aggregateMode: REVENUE_AGGREGATE_MODE.LIFECYCLE,
            trimIndex: trimMeta.trimIndex,
            trimId: trimMeta.trimKey,
            trimName: trimMeta.trimName,
            sourceColumns: trimMeta.sourceColumns,
            allSourceColumns: lifecycleSourceColumns,
            sourceRows: matrixRows,
            matrixRowMap,
          });
        });
      }
      return columns;
    },
    previewRows() {
      const workbook = this.displayParsedWorkbook;
      const table = workbook && workbook.tables && workbook.tables[0];
      if (!table || !Array.isArray(table.rows)) {
        return [];
      }
      return table.rows
        .filter((row) => row.item || row.group)
        .map((row) => {
          const cellMap = {};
          this.previewColumns.forEach((column) => {
            cellMap[column.key] = this.resolvePreviewCell(row, column);
          });
          return {
            rowIndex: row.rowIndex,
            group: row.group || "",
            item: row.item || "",
            cellMap,
          };
        });
    },
    lastImportSummary() {
      if (!this.parsedWorkbook) {
        return "";
      }
      const importPayload = this.parsedWorkbook.importPayload || {};
      const importItems =
        (Array.isArray(importPayload.dataItems) && importPayload.dataItems) ||
        (Array.isArray(importPayload.data) && importPayload.data) ||
        [];
      const importCount =
        importItems.length;
      const unmatchedCount =
        (this.parsedWorkbook.unmatchedSubjects || []).length || 0;
      const skippedCount = (this.parsedWorkbook.skippedCells || []).length || 0;
      return `${this.parsedWorkbook.fileName}，已提交 ${importCount} 条，未匹配 ${unmatchedCount} 条，跳过 ${skippedCount} 个`;
    },
  },
  watch: {
    valveList: {
      immediate: true,
      handler() {
        this.syncActiveValve();
      },
    },
    currentValvePoint: {
      immediate: true,
      handler(newValue, oldValue) {
        if (!newValue) {
          return;
        }
        if (newValue === oldValue && (this.historySnapshot || this.historyLoading)) {
          return;
        }
        this.loadValveHistory();
      },
    },
    initialValveId: {
      immediate: true,
      handler() {
        this.syncActiveValve();
      },
    },
    projectId() {
      this.handleProjectContextChange();
    },
    projectCode() {
      this.handleProjectContextChange();
    },
    viewModeValue(newValue, oldValue) {
      if (oldValue === "preview" && newValue === "valve") {
        this.resetImportedData();
      }
    },
    activeValveId(newValue, oldValue) {
      if (oldValue && newValue !== oldValue) {
        this.resetImportedData();
      }
      this.loadValveHistory();
    },
  },
  methods: {
    displayUiText(value) {
      return formatPeriodExpenseDisplayText(value);
    },
    normalizePatternName(value) {
      const text = String(value == null ? "" : value).trim();
      return text;
    },
    isAlwaysVisiblePatternName(value) {
      const text = this.normalizePatternName(value);
      return !text || text === "加权";
    },
    filterHistoryRecordsByCurrentPatterns(records = []) {
      const recordList = Array.isArray(records) ? records : [];
      const patternNames = this.currentBenefitCostPatternNames || [];
      if (!patternNames.length || !recordList.length) {
        return recordList;
      }
      const patternMap = patternNames.reduce((acc, item) => {
        acc[item] = true;
        return acc;
      }, {});
      let matchedPatternCount = 0;
      const filteredRecords = recordList.filter((record) => {
        const trimName = this.normalizePatternName(record && record.trimName);
        if (this.isAlwaysVisiblePatternName(trimName)) {
          return true;
        }
        if (patternMap[trimName]) {
          matchedPatternCount += 1;
          return true;
        }
        return false;
      });
      return matchedPatternCount > 0 ? filteredRecords : recordList;
    },
    getImportRootSubjectById(id) {
      const target = String(id || "").trim();
      return (
        this.importSubjectRootOptions.find((item) => item.id === target) ||
        this.importSubjectRootOptions[0] ||
        null
      );
    },
    async handleProjectContextChange() {
      this.resetImportedData();
      this.authorizedSubjectTree = [];
      this.writableSubjectTree = [];
      this.writableLeafSubjects = [];
      this.selectedImportRootSubjectId = "";
      this.historySnapshot = null;
      this.historyError = "";
      await this.$nextTick();
      this.syncActiveValve();
      this.loadValveHistory();
    },
    async triggerImport() {
      if (this.parsing || this.savingImport) {
        return;
      }
      if (!this.projectId) {
        this.$message.error("当前项目缺少项目 ID，暂时无法导入");
        return;
      }
      if (!this.normalizedValveList.length) {
        this.$message.error("当前项目暂无可选阀点");
        return;
      }
      if (!this.currentUserId) {
        this.$message.error("未获取到当前用户信息，暂时无法导入");
        return;
      }
      this.parsing = true;
      try {
        await this.loadWritableSubjects();
        if (!this.importSubjectRootOptions.length) {
          this.$message.error("当前项目下没有可选科目目录");
          return;
        }
        const selectedRoot = this.getImportRootSubjectById(this.selectedImportRootSubjectId);
        const defaultRoot = selectedRoot || this.importSubjectRootOptions[0];
        this.importForm = {
          valveId: this.activeValveId || (this.activeValve && this.activeValve.id) || "",
          rootSubjectId: defaultRoot ? defaultRoot.id : "",
        };
        this.importDialogVisible = true;
        this.$nextTick(() => {
          if (this.$refs.importFormRef) {
            this.$refs.importFormRef.clearValidate();
          }
        });
      } catch (error) {
        this.$message.error(error.message || "科目目录加载失败");
      } finally {
        this.parsing = false;
      }
    },
    handleImportDialogConfirm() {
      const formRef = this.$refs.importFormRef;
      if (!formRef) {
        this.openImportFilePicker();
        return;
      }
      formRef.validate((valid) => {
        if (!valid) {
          return;
        }
        this.activeValveId = this.importForm.valveId;
        this.selectedImportRootSubjectId = this.importForm.rootSubjectId;
        this.importDialogVisible = false;
        this.$nextTick(() => {
          this.openImportFilePicker();
        });
      });
    },
    openImportFilePicker() {
      const input = this.$refs.importInput;
      if (!input) {
        return;
      }
      input.value = "";
      input.click();
    },
    handleBackToValve() {
      this.resetImportedData();
      this.$emit("open-valve", {
        valveId: this.activeValveId,
      });
    },
    normalizePreviewTrimKey(value, fallback = "") {
      const text = String(value == null ? "" : value).trim();
      return text || String(fallback || "trim");
    },
    resolvePreviewMatrixStorageText(cellMeta) {
      const candidates = [
        cellMeta && cellMeta.normalizedStorageValue,
        cellMeta && cellMeta.storageValue,
        cellMeta && cellMeta.numberValue != null ? String(cellMeta.numberValue) : "",
        cellMeta && cellMeta.numericValue != null ? String(cellMeta.numericValue) : "",
        cellMeta && cellMeta.rawValue,
        cellMeta && cellMeta.normalizedDisplayText,
        cellMeta && cellMeta.displayValue,
        cellMeta && cellMeta.displayText,
      ];
      for (let index = 0; index < candidates.length; index += 1) {
        const text = String(candidates[index] == null ? "" : candidates[index]).trim();
        if (text) return text;
      }
      return "";
    },
    buildPreviewMatrixRows(table, sourceColumns = []) {
      const rows = Array.isArray(table && table.rows) ? table.rows : [];
      return rows.map((row) => {
        const cells = {};
        const displayCells = {};
        (Array.isArray(sourceColumns) ? sourceColumns : []).forEach((column) => {
          const text = this.getPreviewMatrixCellText(row, column);
          if (text) {
            cells[column.key] = text;
          }
          const displayText = this.getPreviewMatrixCellDisplayText(row, column);
          if (displayText) {
            displayCells[column.key] = displayText;
          }
        });
        const path = row.fullPath || [row.group, row.item].filter(Boolean).join("/");
        return applyRevenueTemplateMeta({
          rowIndex: row.rowIndex,
          subjectId: row.subjectId || "",
          group: row.group || "",
          subject: row.item || "",
          subjectName: row.item || "",
          unit: row.unit || "",
          path,
          fullNamePath: path,
          subjectPath: path,
          cells,
          displayCells,
        });
      });
    },
    getPreviewMatrixCellText(row, column) {
      const yearValues = row && row.values && row.values[column.yearLabel];
      const cellMeta = yearValues && yearValues[column.columnKey];
      if (!cellMeta || cellMeta.isBlank || cellMeta.isError) {
        return "";
      }
      return this.resolvePreviewMatrixStorageText(cellMeta);
    },
    getPreviewMatrixCellDisplayText(row, column) {
      const yearValues = row && row.values && row.values[column.yearLabel];
      const cellMeta = yearValues && yearValues[column.columnKey];
      if (!cellMeta || cellMeta.isBlank || cellMeta.isError) {
        return "";
      }
      return String(
        cellMeta.normalizedDisplayText ||
          cellMeta.displayValue ||
          cellMeta.displayText ||
          cellMeta.rawValue ||
          cellMeta.normalizedStorageValue ||
          ""
      ).trim();
    },
    resolvePreviewLifecycleCell(row, column) {
      const matrixRow =
        column &&
        column.matrixRowMap &&
        column.matrixRowMap[String(row && row.rowIndex)];
      if (!matrixRow) {
        return {
          text: "-",
          isError: false,
        };
      }
      const aggregateText = String(getDisplayAggregateValue(matrixRow, column) || "").trim();
      const formattedAggregateText = this.formatPreviewLifecycleAggregateText(
        aggregateText,
        matrixRow,
        column
      );
      const text =
        formattedAggregateText ||
        this.resolvePreviewLifecycleFallbackText(matrixRow, column) ||
        "-";
      return {
        text,
        isError: false,
      };
    },
    formatPreviewLifecycleAggregateText(value, row, column) {
      const text = String(value == null ? "" : value).trim();
      if (!text) return "";
      if (!this.shouldShowPreviewLifecyclePercent(row, column) || /[%％]/u.test(text)) {
        return text;
      }
      const num = parseRevenueNumber(text, { allowPercent: true });
      return num === null
        ? text
        : formatRevenueDisplayValue(num, { ...row, unit: "%" }, { precision: 6 });
    },
    shouldShowPreviewLifecyclePercent(row, column) {
      if (isPercentUnit(row && row.unit)) {
        return true;
      }
      const sourceColumns = Array.isArray(column && column.sourceColumns)
        ? column.sourceColumns
        : [];
      return sourceColumns.some((sourceColumn) => {
        const displayValue =
          row && row.displayCells ? row.displayCells[sourceColumn.key] : "";
        const storageValue =
          row && row.cells ? row.cells[sourceColumn.key] : "";
        return /[%％]/u.test(String(displayValue || storageValue || ""));
      });
    },
    resolvePreviewLifecycleFallbackText(row, column) {
      if (!this.shouldUsePreviewLifecycleFallback(row, column)) {
        return "";
      }
      const sourceColumns = Array.isArray(column && column.sourceColumns)
        ? column.sourceColumns
        : [];
      const values = sourceColumns
        .map((sourceColumn) => parseRevenueNumber(
          row && row.cells ? row.cells[sourceColumn.key] : "",
          { allowPercent: true }
        ))
        .filter((value) => value != null);
      if (!values.length) return "";
      const value = values.reduce((sum, item) => sum + item, 0);
      const displayRow = this.shouldShowPreviewLifecyclePercent(row, column)
        ? { ...row, unit: "%" }
        : row;
      return formatRevenueDisplayValue(value, displayRow, { precision: 6 });
    },
    shouldUsePreviewLifecycleFallback(row, column) {
      const lifecycleFormula = String(
        (row && row.lifecycleFormula) || (column && column.lifecycleFormula) || ""
      ).toLowerCase();
      const aggregateFormula = String(
        (row && (row.aggregateFormula || row.formulaAggregate)) ||
          (column && column.formula) ||
          ""
      ).toLowerCase();
      if (
        lifecycleFormula === "mix" ||
        lifecycleFormula === "ratio" ||
        lifecycleFormula === "volume_weighted" ||
        aggregateFormula === "weighted" ||
        aggregateFormula === "weighted_by_mix" ||
        aggregateFormula === "ratio"
      ) {
        return false;
      }
      return lifecycleFormula === "sum_year" || aggregateFormula === "sum";
    },
    resolvePreviewCell(row, column) {
      if (column && column.isComputedLifecycle) {
        return this.resolvePreviewLifecycleCell(row, column);
      }
      const yearValues = row.values && row.values[column.yearLabel];
      const cellMeta = yearValues && yearValues[column.columnKey];
      if (!cellMeta || cellMeta.isBlank) {
        return {
          text: "-",
          isError: false,
        };
      }
      const text = String(
        cellMeta.normalizedDisplayText ||
          cellMeta.displayValue ||
          cellMeta.displayText ||
          cellMeta.rawValue ||
          "-"
      ).trim() || "-";
      return {
        text,
        isError: Boolean(cellMeta.isError),
      };
    },
    async handleFileChange(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      const activeValveContext = this.getActiveValveContext();
      if (!this.projectId) {
        this.$message.error("当前项目缺少项目 ID，暂时无法导入");
        return;
      }
      if (!this.currentUserId) {
        this.$message.error("未获取到当前用户信息，暂时无法导入");
        return;
      }
      if (!activeValveContext.valvePoint) {
        this.$message.error("请先选择阀点后再导入");
        return;
      }
      if (!activeValveContext.rootSubject || !activeValveContext.rootSubject.id) {
        this.$message.error("请先选择科目目录后再导入");
        return;
      }
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        this.$message.error("仅支持导入 xlsx、xls 格式文件");
        return;
      }
      this.parsing = true;
      try {
        const parsedWorkbook = await this.parseWorkbook(file);
        const preparation = {
          fileName: parsedWorkbook.fileName,
          parsedAt: new Date().toISOString(),
          importContext: activeValveContext,
          parsedWorkbook,
        };

        try {
          const writableSubjectResult = await this.loadWritableSubjects();
          const importPreparation = this.buildImportPayload(
            parsedWorkbook,
            writableSubjectResult.leafSubjects,
            activeValveContext
          );
          preparation.preparedImport = importPreparation;
          preparation.authorization = {
            totalLeafSubjects: writableSubjectResult.leafSubjects.length,
            matchedSubjectCount: importPreparation.matchedSubjectIds.length,
            authorizedSubjectIds: importPreparation.matchedSubjectIds,
            forcedParentSubjectCount:
              importPreparation.forcedParentSubjectIds.length,
            forcedParentSubjectIds: importPreparation.forcedParentSubjectIds,
          };
        } catch (dryRunError) {
          preparation.dryRunError =
            dryRunError.message || "解析成功，但预校验失败，请检查模板顺序与内容";
        }

        this.pendingImportPreparation = preparation;
        if (preparation.dryRunError) {
          this.$message.warning(preparation.dryRunError);
          this.$message.info("解析完成，已进入导入预览，请先处理校验问题");
        } else {
          this.$message.success("表格解析成功，已进入导入预览");
        }
        this.$emit("open-preview", {
          valveId: this.activeValveId,
        });
      } catch (error) {
        console.error(error);
        this.$message.error(error.message || "表格解析失败");
      } finally {
        this.parsing = false;
      }
    },
    async confirmImportToServer() {
      if (!this.hasPendingImport) {
        this.$message.warning("请先解析表格，再确认入库");
        return;
      }
      const preparation = this.pendingImportPreparation;
      const activeValveContext = this.getActiveValveContext();
      if (!activeValveContext.valvePoint) {
        this.$message.error("请先选择阀点后再确认入库");
        return;
      }
      if (
        preparation.importContext &&
        preparation.importContext.valvePoint &&
        preparation.importContext.valvePoint !== activeValveContext.valvePoint
      ) {
        this.$message.error("阀点已变更，请重新解析表格后再确认入库");
        return;
      }
      if (
        preparation.importContext &&
        preparation.importContext.rootSubject &&
        activeValveContext.rootSubject &&
        preparation.importContext.rootSubject.id !== activeValveContext.rootSubject.id
      ) {
        this.$message.error("科目目录已变更，请重新解析表格后再确认入库");
        return;
      }

      await this.$confirm("确认将当前解析结果入库吗？", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      });

      this.savingImport = true;
      try {
        let importPreparation = preparation.preparedImport;
        let writableSubjectResult = {
          leafSubjects: [],
        };
        if (!importPreparation) {
          writableSubjectResult = await this.loadWritableSubjects();
          importPreparation = this.buildImportPayload(
            preparation.parsedWorkbook,
            writableSubjectResult.leafSubjects,
            activeValveContext
          );
          preparation.preparedImport = importPreparation;
          preparation.authorization = {
            totalLeafSubjects: writableSubjectResult.leafSubjects.length,
            matchedSubjectCount: importPreparation.matchedSubjectIds.length,
            authorizedSubjectIds: importPreparation.matchedSubjectIds,
            forcedParentSubjectCount:
              importPreparation.forcedParentSubjectIds.length,
            forcedParentSubjectIds: importPreparation.forcedParentSubjectIds,
          };
        }

        const importItems =
          (Array.isArray(importPreparation.payload.dataItems) && importPreparation.payload.dataItems) ||
          (Array.isArray(importPreparation.payload.data) && importPreparation.payload.data) ||
          [];
        if (!importItems.length) {
          throw new Error("未生成可提交的入库数据，请先检查解析结果");
        }

        const importRes = await importProjectCosts(importPreparation.payload);
        const currentSnapshot = await this.loadValveHistory({
          silent: true,
          valvePoint: activeValveContext.valvePoint,
          updateView: this.currentValvePoint === activeValveContext.valvePoint,
        });

        this.parsedWorkbook = {
          ...preparation.parsedWorkbook,
          importContext: activeValveContext,
          authorization: preparation.authorization || {
            totalLeafSubjects: writableSubjectResult.leafSubjects.length,
            matchedSubjectCount: importPreparation.matchedSubjectIds.length,
            authorizedSubjectIds: importPreparation.matchedSubjectIds,
            forcedParentSubjectCount:
              importPreparation.forcedParentSubjectIds.length,
            forcedParentSubjectIds: importPreparation.forcedParentSubjectIds,
          },
          unmatchedSubjects: importPreparation.unmatchedSubjects,
          skippedCells: importPreparation.skippedCells,
          importPayload: importPreparation.payload,
          columnMappings: importPreparation.columnMappings,
          preparedImport: importPreparation,
          dryRunError: preparation.dryRunError || "",
          importResponse: importRes.data || importRes,
          currentSnapshot,
        };

        console.log("Main table import payload:", importPreparation.payload);
        console.log("Main table import response:", importRes);
        this.$message.success(
          `入库成功，阀点 ${activeValveContext.valvePoint} 共提交 ${importItems.length} 条数据`
        );
        this.pendingImportPreparation = null;
        this.$emit("open-valve", {
          valveId: this.activeValveId,
        });
      } catch (error) {
        if (error && error !== "cancel") {
          console.error(error);
          this.$message.error(error.message || "确认入库失败");
        }
      } finally {
        this.savingImport = false;
      }
    },
    parseWorkbook(file) {
      return parseRevenueImportWorkbookFile(file, {
        includeMappingSheet: true,
      });
    },
    buildMainTableSubjectScope(extra = {}) {
      return {
        userId: this.currentUserId,
        projectId: this.projectId,
        subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
        ...extra,
      };
    },
    isMainTableSubjectRootName(value) {
      const name = this.normalizeExactSubjectName(value);
      return MAIN_TABLE_SUBJECT_ROOT_NAMES.includes(name);
    },
    isMainTableSubjectPath(pathParts) {
      const path = this.normalizeSubjectPathParts(pathParts);
      return Boolean(path.length && this.isMainTableSubjectRootName(path[0]));
    },
    readSubjectNodePath(node = {}) {
      const candidates = [
        node.full_path,
        node.fullPath,
        node.fullNamePath,
        node.subjectTreePath,
        node.subjectPath,
        node.path,
      ];
      for (let index = 0; index < candidates.length; index += 1) {
        const value = candidates[index];
        if (Array.isArray(value)) {
          const path = this.normalizeSubjectPathParts(value);
          if (path.length) {
            return path;
          }
        }
        const text = this.normalizeExactSubjectName(value);
        if (!text) {
          continue;
        }
        const path = this.normalizeSubjectPathParts(
          text.replace(/\\/g, "/").split(/[/>＞]/)
        );
        if (path.length) {
          return path;
        }
      }
      return [];
    },
    isMainTableSubjectNode(node = {}, pathParts = []) {
      if (String(node.moduleCode || "").trim() === "main_pnl") {
        return true;
      }
      const directNames = [
        node.rootSubjectName,
        node.__moduleRootName,
        node.moduleName,
        node.subjectName,
        node.name,
      ];
      if (directNames.some((item) => this.isMainTableSubjectRootName(item))) {
        return true;
      }
      const explicitPath = this.readSubjectNodePath(node);
      return (
        this.isMainTableSubjectPath(pathParts) ||
        this.isMainTableSubjectPath(explicitPath)
      );
    },
    filterMainTableSubjectTree(nodes) {
      const walk = (items, parentPath = [], insideMainTable = false) => {
        return (items || []).reduce((acc, node) => {
          const subjectName = node.subjectName || node.name || "";
          const currentPath = this.normalizeSubjectPathParts(
            parentPath.concat(subjectName)
          );
          const isMainTableNode =
            insideMainTable || this.isMainTableSubjectNode(node, currentPath);
          const children = walk(
            node.children || [],
            currentPath,
            isMainTableNode
          );
          if (isMainTableNode) {
            acc.push({
              ...node,
              children,
              leaf:
                node.leaf != null
                  ? Boolean(node.leaf)
                  : children.length === 0,
            });
          } else if (children.length) {
            acc.push(...children);
          }
          return acc;
        }, []);
      };
      return walk(nodes);
    },
    async loadAuthorizedSubjectTree() {
      if (!this.projectId || !this.currentUserId) {
        this.authorizedSubjectTree = [];
        return [];
      }
      const res = await getUserExpenseSubjectPermissionTree(
        this.buildMainTableSubjectScope()
      );
      const subjectNodes = Array.isArray(res.data)
        ? res.data
        : (res.data && res.data.subjects) || [];
      const treeData = this.filterMainTableSubjectTree(
        this.normalizePermissionTree(subjectNodes, null)
      ).filter((item) => item.enabled !== false);
      this.authorizedSubjectTree = treeData;
      return treeData;
    },
    async loadValveHistory(options = {}) {
      const { silent = false, valvePoint = "", updateView = true } = options;
      const targetValvePoint = valvePoint || this.currentValvePoint;

      if (!this.projectId || !targetValvePoint || !this.currentUserId) {
        if (updateView) {
          this.historySnapshot = null;
          this.historyError = "";
        }
        return null;
      }

      if (!silent) {
        this.historyLoading = true;
      }

      try {
        if (!this.authorizedSubjectTree.length) {
          await this.loadAuthorizedSubjectTree();
        }

        const snapshot = await this.fetchValveHistorySnapshot(targetValvePoint);
        if (updateView) {
          this.historySnapshot = snapshot;
          this.historyError = "";
        }
        return snapshot;
      } catch (error) {
        if (updateView) {
          this.historySnapshot = null;
          this.historyError = error.message || "历史数据加载失败";
        }
        return null;
      } finally {
        if (!silent) {
          this.historyLoading = false;
        }
      }
    },
    async fetchValveHistorySnapshot(valvePoint) {
      const res = await getAuthorizedProjectCostRecords({
        projectId: this.projectId,
        valvePoint,
      });
      return this.normalizeHistorySnapshot(res.data || res, "authorized");
    },
    normalizeHistorySnapshot(snapshot, source) {
      const data = snapshot || {};
      const records = Array.isArray(data)
        ? data
        : Array.isArray(data.records)
          ? data.records
          : Array.isArray(data.data)
            ? data.data
            : [];
      return {
        source,
        process: data.process || null,
        recordCount:
          data.recordCount != null
            ? Number(data.recordCount)
            : records.length,
        records,
      };
    },
    async loadWritableSubjects() {
      const res = await getProjectCostWritableSubjects(
        this.buildMainTableSubjectScope()
      );
      const treeData = Array.isArray(res.data)
        ? res.data
        : (res.data && res.data.subjects) || [];
      const normalizedTree = this.filterMainTableSubjectTree(
        this.normalizeSubjectTree(treeData, null)
      );
      const leafSubjects = this.flattenLeafSubjects(normalizedTree).filter(
        (item) => item.enabled !== false
      );
      this.writableSubjectTree = normalizedTree;
      this.writableLeafSubjects = leafSubjects;

      if (!leafSubjects.length) {
        throw new Error("当前项目下没有可导入的主表科目");
      }

      return {
        treeData: normalizedTree,
        leafSubjects,
      };
    },
    buildRootSubjectOptions(nodes) {
      return (nodes || [])
        .map((node, index) => {
          const subjectName = node.subjectName || node.name || "";
          const normalizedId = this.normalizeSubjectId(node.id || node.subjectId);
          const id = normalizedId || `root-${index}-${subjectName}`;
          const leafCount = this.flattenLeafSubjects([node]).filter(
            (item) => item.enabled !== false
          ).length;
          return {
            ...node,
            id,
            rootSubjectId: id,
            rootSubjectName: subjectName,
            subjectName,
            label: this.displayUiText(subjectName || id),
            leafCount,
          };
        })
        .filter((item) => item.enabled !== false && item.leafCount > 0);
    },
    normalizePermissionTree(nodes, parentId) {
      return (nodes || []).map((node) => {
        const id = node.id || node.subjectId;
        const children = this.normalizePermissionTree(node.children || [], id);
        const visibleChildren = children.filter((item) => item.enabled !== false);
        const hasPermission =
          Boolean(node.directPermissionConfigured) ||
          Boolean(node.effectivePermissionLevel) ||
          Boolean(node.permissionLevel);
        return {
          ...node,
          id,
          parentId:
            node.parentId === undefined || node.parentId === null
              ? parentId
              : node.parentId,
          subjectName: node.subjectName || node.name || "",
          unit: node.unit || "",
          enabled: node.enabled !== false,
          leaf:
            node.leaf != null ? Boolean(node.leaf) : visibleChildren.length === 0,
          visible: hasPermission || visibleChildren.length > 0,
          children: visibleChildren,
        };
      }).filter((item) => item.visible && item.enabled !== false);
    },
    normalizeSubjectTree(nodes, parentId) {
      return (nodes || []).map((node) => {
        const id = node.id || node.subjectId;
        const children = this.normalizeSubjectTree(node.children || [], id);
        const isLeaf =
          node.leaf != null ? Boolean(node.leaf) : children.length === 0;
        return {
          ...node,
          id,
          parentId:
            node.parentId === undefined || node.parentId === null
              ? parentId
              : node.parentId,
          subjectName: node.subjectName || node.name || "",
          enabled: node.enabled !== false,
          leaf: isLeaf,
          children,
        };
      });
    },
    flattenLeafSubjects(nodes) {
      const result = [];
      const walk = (items, path = [], rootSubject = null) => {
        (items || []).forEach((item) => {
          const subjectName = item.subjectName || item.name || "";
          const normalizedId = this.normalizeSubjectId(item.id || item.subjectId);
          const currentPath = path.concat(subjectName);
          const currentRoot =
            rootSubject ||
            {
              id: normalizedId,
              subjectName,
            };
          if (item.leaf) {
            result.push({
              ...item,
              subjectPath: currentPath,
              rootSubjectId: currentRoot.id || "",
              rootSubjectName: currentRoot.subjectName || currentPath[0] || "",
            });
            return;
          }
          walk(item.children || [], currentPath, currentRoot);
        });
      };
      walk(nodes);
      return result;
    },
    filterLeafSubjectsByRootSubject(leafSubjects, rootSubject) {
      const rootSubjectId = this.normalizeSubjectId(
        rootSubject && (rootSubject.id || rootSubject.rootSubjectId || rootSubject.subjectId)
      );
      const rootSubjectName = this.normalizeExactSubjectName(
        rootSubject && (rootSubject.rootSubjectName || rootSubject.subjectName || rootSubject.label)
      );
      if (!rootSubjectId && !rootSubjectName) {
        return leafSubjects || [];
      }
      const filtered = (leafSubjects || []).filter((item) => {
        const itemRootId = this.normalizeSubjectId(
          item.rootSubjectId ||
            (Array.isArray(item.subjectPath) && item.subjectPath.length
              ? ""
              : item.id || item.subjectId)
        );
        const itemRoot = this.normalizeExactSubjectName(
          item.rootSubjectName ||
            (Array.isArray(item.subjectPath) ? item.subjectPath[0] : "")
        );
        return (
          (rootSubjectId && itemRootId === rootSubjectId) ||
          (rootSubjectName && itemRoot === rootSubjectName)
        );
      });
      if (!filtered.length) {
        const rootSubjectLabel = (rootSubject && rootSubject.label) || rootSubjectName;
        throw new Error(`当前项目下没有“${rootSubjectLabel}”可导入科目`);
      }
      return filtered;
    },
    buildOrderedLeafSubjects(leafSubjects) {
      const ordered = [];
      const seenIds = new Set();
      (leafSubjects || []).forEach((item) => {
        const normalizedId = this.normalizeSubjectId(item.id || item.subjectId);
        if (!normalizedId || seenIds.has(normalizedId)) {
          return;
        }
        seenIds.add(normalizedId);
        ordered.push({
          ...item,
          id: normalizedId,
        });
      });
      return ordered;
    },
    buildSubjectPathMatcher(leafSubjects, rootSubject) {
      const leafByPath = new Map();
      const leafByName = new Map();
      const parentByPath = new Map();
      const parentPathsByName = new Map();
      const rootName =
        (rootSubject && (rootSubject.rootSubjectName || rootSubject.subjectName || rootSubject.label)) ||
        "";
      const rootPath = rootName ? [rootName] : [];

      (leafSubjects || []).forEach((item) => {
        const subjectPath = this.normalizeSubjectPathParts(
          item.subjectPath && item.subjectPath.length
            ? item.subjectPath
            : [item.rootSubjectName, item.subjectName || item.name]
        );
        if (!subjectPath.length) {
          return;
        }

        const leafKey = this.buildSubjectPathKey(subjectPath);
        leafByPath.set(leafKey, item);

        const leafNameKey = this.normalizeSubjectMatchText(
          subjectPath[subjectPath.length - 1]
        );
        if (leafNameKey) {
          if (!leafByName.has(leafNameKey)) {
            leafByName.set(leafNameKey, []);
          }
          leafByName.get(leafNameKey).push(item);
        }

        for (let index = 1; index < subjectPath.length; index += 1) {
          const parentPath = subjectPath.slice(0, index);
          const parentKey = this.buildSubjectPathKey(parentPath);
          if (!parentKey || parentByPath.has(parentKey)) {
            continue;
          }
          parentByPath.set(parentKey, parentPath);
          const parentNameKey = this.normalizeSubjectMatchText(
            parentPath[parentPath.length - 1]
          );
          if (parentNameKey) {
            if (!parentPathsByName.has(parentNameKey)) {
              parentPathsByName.set(parentNameKey, []);
            }
            parentPathsByName.get(parentNameKey).push(parentPath);
          }
        }
      });

      return {
        rootPath,
        leafByPath,
        leafByName,
        parentByPath,
        parentPathsByName,
      };
    },
    normalizeSubjectPathParts(parts) {
      return (Array.isArray(parts) ? parts : [])
        .map((item) => this.normalizeExactSubjectName(item))
        .filter(Boolean);
    },
    readTemplateFullPathParts(source = {}) {
      const candidates = [
        source.full_path,
        source.fullPath,
        source.fullNamePath,
        source.subject_full_path,
        source.subjectFullPath,
      ];
      for (let index = 0; index < candidates.length; index += 1) {
        const value = candidates[index];
        if (Array.isArray(value)) {
          const path = this.normalizeSubjectPathParts(value);
          if (path.length) {
            return path;
          }
        }
        const text = this.normalizeExactSubjectName(value);
        if (!text) {
          continue;
        }
        const path = this.normalizeSubjectPathParts(
          text.replace(/\\/g, "/").split(/[/>＞]/)
        );
        if (path.length) {
          return path;
        }
      }
      return [];
    },
    normalizeSubjectMatchText(value) {
      return this.normalizeExactSubjectName(value)
        .replace(/（/g, "(")
        .replace(/）/g, ")")
        .replace(/\s+/g, "")
        .toLowerCase();
    },
    buildSubjectPathKey(parts) {
      return this.normalizeSubjectPathParts(parts)
        .map((item) => this.normalizeSubjectMatchText(item))
        .filter(Boolean)
        .join("/");
    },
    isSameSubjectPathPrefix(pathParts, prefixParts) {
      const pathKeys = this.normalizeSubjectPathParts(pathParts).map((item) =>
        this.normalizeSubjectMatchText(item)
      );
      const prefixKeys = this.normalizeSubjectPathParts(prefixParts).map((item) =>
        this.normalizeSubjectMatchText(item)
      );
      if (!prefixKeys.length || prefixKeys.length > pathKeys.length) {
        return false;
      }
      return prefixKeys.every((item, index) => pathKeys[index] === item);
    },
    findParentPathByName(name, basePath, matcher) {
      const nameKey = this.normalizeSubjectMatchText(name);
      if (!nameKey || !matcher || !matcher.parentPathsByName) {
        return null;
      }
      const candidates = matcher.parentPathsByName.get(nameKey) || [];
      const scopedCandidates = candidates
        .filter((item) => this.isSameSubjectPathPrefix(item, basePath || []))
        .sort((left, right) => left.length - right.length);
      return scopedCandidates[0] || null;
    },
    getLeafSubjectByPath(pathParts, matcher) {
      if (!matcher || !matcher.leafByPath) {
        return null;
      }
      return matcher.leafByPath.get(this.buildSubjectPathKey(pathParts)) || null;
    },
    getDirectParentPath(pathParts, matcher) {
      if (!matcher || !matcher.parentByPath) {
        return null;
      }
      return matcher.parentByPath.get(this.buildSubjectPathKey(pathParts)) || null;
    },
    normalizeTemplatePathForSelectedRoot(pathParts, rootPath = []) {
      const path = this.normalizeSubjectPathParts(pathParts);
      const rootName = rootPath[0] || "";
      if (
        path.length > 1 &&
        rootName &&
        rootName !== "主表" &&
        path[0] === "主表" &&
        path[1] === rootName
      ) {
        return path.slice(1);
      }
      return path;
    },
    resolveTemplateRowSubject(row, state, matcher) {
      const itemName = this.normalizeExactSubjectName(row && row.item);
      const rawGroupName = this.normalizeExactSubjectName(row && row.rawGroup);
      if (!itemName) {
        return { skip: true };
      }

      const rootPath = matcher.rootPath || [];
      const explicitPath = this.normalizeTemplatePathForSelectedRoot(
        this.readTemplateFullPathParts(row),
        rootPath
      );
      const explicitFullPath =
        explicitPath.length && rootPath.length && !this.isSameSubjectPathPrefix(explicitPath, rootPath)
          ? rootPath.concat(explicitPath)
          : explicitPath;
      if (rawGroupName) {
        const groupParentPath = this.findParentPathByName(
          rawGroupName,
          rootPath,
          matcher
        );
        state.groupPath = groupParentPath || rootPath;
        state.contextPath = state.groupPath;
      }

      const groupPath = state.groupPath || rootPath;
      const contextPath = state.contextPath || groupPath || rootPath;
      const candidatePaths = [
        explicitFullPath,
        contextPath.concat(itemName),
        groupPath.concat(itemName),
        rootPath.concat(itemName),
      ].filter((item) => Array.isArray(item) && item.length);

      for (const pathParts of candidatePaths) {
        const subject = this.getLeafSubjectByPath(pathParts, matcher);
        if (subject) {
          return { subject, mappingPath: pathParts };
        }
      }

      const directParentPath =
        this.getDirectParentPath(contextPath.concat(itemName), matcher) ||
        this.getDirectParentPath(groupPath.concat(itemName), matcher) ||
        this.findParentPathByName(itemName, groupPath, matcher) ||
        this.findParentPathByName(itemName, rootPath, matcher);
      if (directParentPath) {
        state.contextPath = directParentPath;
        return { skip: true, isParentRow: true };
      }

      const nameKey = this.normalizeSubjectMatchText(itemName);
      const byNameSubjects =
        nameKey && matcher.leafByName ? matcher.leafByName.get(nameKey) : null;
      if (byNameSubjects && byNameSubjects.length === 1) {
        return {
          subject: byNameSubjects[0],
          mappingPath: byNameSubjects[0].subjectPath || [itemName],
        };
      }

      return {
        subject: null,
        reason: byNameSubjects && byNameSubjects.length > 1
          ? "存在多个同名科目，无法确定导入科目"
          : "当前科目树中未找到对应叶子科目",
      };
    },
    buildImportPayload(parsedWorkbook, leafSubjects, importContext = {}) {
      const selectedTable = parsedWorkbook.tables[0] || null;
      const mappingStrategy = "subject-tree-context";
      const selectedRootSubject =
        importContext.rootSubject || this.selectedImportRootSubject;
      const scopedLeafSubjects = this.filterLeafSubjectsByRootSubject(
        leafSubjects,
        selectedRootSubject
      );
      const orderedLeafSubjects = this.buildOrderedLeafSubjects(scopedLeafSubjects);
      const subjectMatcher = this.buildSubjectPathMatcher(
        orderedLeafSubjects,
        selectedRootSubject
      );
      const rowMatchState = {
        groupPath: subjectMatcher.rootPath,
        contextPath: subjectMatcher.rootPath,
      };

      if (!selectedTable) {
        throw new Error("未识别到可导入的数据表块");
      }
      if (!orderedLeafSubjects.length) {
        throw new Error("当前项目下没有可导入的主表科目");
      }

      const _dataRows = (selectedTable.rows || []).filter((item) => {
        return this.normalizeExactSubjectName(item && item.item);
      });

      const payload = {
        projectId: this.projectId,
        projectName: this.projectName,
        valvePoint: importContext.valvePoint || this.currentValvePoint,
        operatorId: this.currentUserId,
        operatorName: this.currentUserName,
        importNode: "MAIN_TABLE",
        dataItems: [],
      };
      const matchedSubjectIds = new Set();
      const unmatchedSubjects = [];
      const skippedCells = [];
      const columnMappings = [];

      selectedTable.columns.forEach((columnGroup, yearIndex) => {
        columnGroup.variants.forEach((variant, variantIndex) => {
          columnMappings.push(
            this.resolveColumnMapping(columnGroup, variant, yearIndex, variantIndex)
          );
        });
      });

      selectedTable.rows.forEach((row) => {
        if (!this.normalizeExactSubjectName(row.item)) {
          return;
        }
        const matchedRow = this.resolveTemplateRowSubject(
          row,
          rowMatchState,
          subjectMatcher
        );
        if (matchedRow.skip) {
          return;
        }
        const subject = matchedRow.subject || null;
        if (!subject) {
          unmatchedSubjects.push({
            rowIndex: row.rowIndex,
            group: row.group,
            item: row.item,
            reason: matchedRow.reason || "当前科目树中未找到对应叶子科目",
            expectedSubjectId: "",
          });
          return;
        }
        const importSubjectId = this.toNumericSubjectId(subject.id || subject.subjectId);
        if (importSubjectId == null) {
          unmatchedSubjects.push({
            rowIndex: row.rowIndex,
            group: row.group,
            item: row.item,
            reason: "科目ID不是有效数字，无法提交到真实接口",
            expectedSubjectId: subject.id || subject.subjectId || "",
          });
          return;
        }
        row.subjectId = subject.id || subject.subjectId || "";
        row.subjectName = subject.subjectName || subject.name || row.item || "";
        row.unit = subject.unit || row.unit || "";
        matchedSubjectIds.add(String(importSubjectId));

        selectedTable.columns.forEach((columnGroup, yearIndex) => {
          columnGroup.variants.forEach((variant, variantIndex) => {
            const columnMeta = this.resolveColumnMapping(
              columnGroup,
              variant,
              yearIndex,
              variantIndex
            );
            if (columnMeta.yearAggregateMode === "COMBINED") {
              return;
            }

            const cellMeta = this.getRowCellMeta(row, columnGroup, variant);
            if (!cellMeta || cellMeta.isBlank) {
              return;
            }
            const valuePayload = this.resolveImportValue(cellMeta, subject);
            if (valuePayload && valuePayload.displayValue) {
              cellMeta.normalizedDisplayText = valuePayload.displayValue;
              cellMeta.normalizedStorageValue = valuePayload.storageValue || valuePayload.rawValue;
              if (valuePayload.numberValue != null) {
                cellMeta.numberValue = valuePayload.numberValue;
              }
            }

            if (!columnMeta.modelYear && columnMeta.yearAggregateMode !== "COMBINED") {
              skippedCells.push({
                rowIndex: row.rowIndex,
                item: row.item,
                address: cellMeta.address,
                reason: `未识别年份：${columnGroup.year || "-"}`,
              });
              return;
            }
            if (!valuePayload) {
              skippedCells.push({
                rowIndex: row.rowIndex,
                item: row.item,
                address: cellMeta.address,
                reason: cellMeta.isError ? "公式错误值已跳过" : "空值已跳过",
              });
              return;
            }

            const dataItem = {
              modelName: columnMeta.modelName,
              trimName: columnMeta.trimName,
              subjectId: importSubjectId,
              vehicleSourceType: subject.vehicleSourceType || undefined,
              yearAggregateMode: columnMeta.yearAggregateMode,
              valueType: valuePayload.valueType,
              numberValue: valuePayload.numberValue,
              textValue: valuePayload.textValue,
              rawValue: valuePayload.rawValue,
            };
            if (columnMeta.modelYear != null) {
              dataItem.modelYear = columnMeta.modelYear;
            }
            payload.dataItems.push(dataItem);
          });
        });
      });

      const duplicates = this.findDuplicateCells(payload.dataItems);
      if (duplicates.length) {
        throw new Error(
          `导入数据存在重复单元格，请检查：${duplicates.slice(0, 3).join("；")}`
        );
      }

      return {
        payload,
        mappingStrategy,
        matchedSubjectIds: Array.from(matchedSubjectIds),
        forcedParentSubjectIds: [],
        unmatchedSubjects,
        skippedCells,
        columnMappings,
      };
    },
    buildOrderedTemplateMappings(templateMappingLookup) {
      return Array.from(templateMappingLookup.values()).sort(
        (a, b) => Number(a.rowIndex || 0) - Number(b.rowIndex || 0)
      );
    },
    resolveMappingStrategy(rows, templateMappingOrder, templateMappingLookup) {
      const dataRows = (rows || []).filter((item) =>
        this.normalizeExactSubjectName(item.item)
      );
      const rowIndexCovered = dataRows.every((row) => {
        return templateMappingLookup.has(Number(row.rowIndex));
      });
      if (rowIndexCovered) {
        return "row-index";
      }
      if (dataRows.length <= (templateMappingOrder || []).length) {
        return "sequence";
      }
      throw new Error(
        `科目映射行数不足：数据行 ${dataRows.length} 条，映射行 ${(templateMappingOrder || []).length} 条`
      );
    },
    getRowCellMeta(row, columnGroup, variant) {
      return (
        row &&
        row.values &&
        row.values[columnGroup.year] &&
        row.values[columnGroup.year][variant.key]
      );
    },
    buildSubjectLookups(leafSubjects) {
      const byId = this.buildSubjectIdLookup(leafSubjects);
      const byCode = new Map();
      const byName = new Map();

      (leafSubjects || []).forEach((item) => {
        const codeKey = this.normalizeSubjectCode(item.subjectCode || item.code);
        if (codeKey && !byCode.has(codeKey)) {
          byCode.set(codeKey, item);
        }

        const nameKey = this.normalizeExactSubjectName(
          item.subjectName || item.name
        );
        if (!nameKey) {
          return;
        }
        if (!byName.has(nameKey)) {
          byName.set(nameKey, []);
        }
        byName.get(nameKey).push(item);
      });

      return {
        byId,
        byCode,
        byName,
      };
    },
    buildSubjectIdLookup(leafSubjects) {
      const lookup = new Map();
      leafSubjects.forEach((item) => {
        const normalizedId = this.normalizeSubjectId(item.id || item.subjectId);
        if (!normalizedId) {
          return;
        }
        lookup.set(normalizedId, item);
      });
      return lookup;
    },
    flattenDisplaySubjects(nodes, level = 0) {
      const result = [];
      (nodes || []).forEach((item) => {
        result.push({
          subjectId: item.id,
          subjectName: this.displayUiText(item.subjectName || "-"),
          unit: item.unit || "",
          level,
          isLeaf: Boolean(item.leaf),
        });
        if (item.children && item.children.length) {
          result.push(...this.flattenDisplaySubjects(item.children, level + 1));
        }
      });
      return result;
    },
    buildTemplateMappingLookup(mappingRows) {
      const lookup = new Map();
      (mappingRows || []).forEach((item) => {
        const rowIndex = Number(
          this.pickMappingField(item, [
            "模板行号",
            "templateRowIndex",
            "rowIndex",
            "模板行",
            "行号",
          ]) || 0
        );
        const subjectId = this.normalizeSubjectId(
          this.pickMappingField(item, [
            "subjectId",
            "subject_id",
            "科目ID",
            "科目Id",
            "科目id",
          ])
        );
        const subjectCode = this.normalizeSubjectCode(
          this.pickMappingField(item, ["subjectCode", "subject_code", "科目编码"])
        );
        const subjectName = this.normalizeExactSubjectName(
          this.pickMappingField(item, [
            "subjectName",
            "subject_name",
            "科目名称",
            "name",
            "显示名称",
          ])
        );
        const group = this.normalizeExactSubjectName(
          this.pickMappingField(item, ["分组", "group", "科目分组"])
        );

        if (!rowIndex || !subjectName) {
          return;
        }

        lookup.set(rowIndex, {
          rowIndex,
          group,
          subjectId,
          subjectCode,
          subjectName,
          isLeaf: this.parseLeafFlag(
            this.pickMappingField(item, ["是否叶子", "isLeaf", "leaf"])
          ),
          displayName: this.normalizeExactSubjectName(
            this.pickMappingField(item, [
              "显示名称",
              "displayName",
              "subjectName",
              "科目名称",
            ]) || subjectName
          ),
          unit: this.normalizeExactSubjectName(
            this.pickMappingField(item, [
              "填报单位",
              "节点单位",
              "unit",
              "填报口径",
            ])
          ),
        });
      });
      return lookup;
    },
    pickMappingField(item, candidates = []) {
      for (let index = 0; index < candidates.length; index += 1) {
        const key = candidates[index];
        if (
          Object.prototype.hasOwnProperty.call(item, key) &&
          item[key] !== undefined &&
          item[key] !== null &&
          String(item[key]).trim() !== ""
        ) {
          return item[key];
        }
      }
      return "";
    },
    parseLeafFlag(value) {
      const normalizedValue = this.normalizeExactSubjectName(value).toUpperCase();
      if (!normalizedValue) {
        return null;
      }
      if (
        normalizedValue === "Y" ||
        normalizedValue === "YES" ||
        normalizedValue === "TRUE" ||
        normalizedValue === "1" ||
        normalizedValue === "是"
      ) {
        return true;
      }
      if (
        normalizedValue === "N" ||
        normalizedValue === "NO" ||
        normalizedValue === "FALSE" ||
        normalizedValue === "0" ||
        normalizedValue === "否"
      ) {
        return false;
      }
      return null;
    },
    normalizeSubjectId(value) {
      const raw = String(value == null ? "" : value).trim();
      if (!raw) {
        return "";
      }
      if (/^-?\d+(\.0+)?$/u.test(raw)) {
        return String(Number(raw));
      }
      return raw;
    },
    toNumericSubjectId(value) {
      const normalized = this.normalizeSubjectId(value);
      if (!normalized) return null;
      if (!/^-?\d+$/u.test(normalized)) {
        return null;
      }
      const numeric = Number(normalized);
      if (!Number.isFinite(numeric)) return null;
      return numeric;
    },
    normalizeSubjectCode(value) {
      return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[^0-9A-Z]/gu, "");
    },
    normalizeExactSubjectName(value) {
      return String(value || "")
        .replace(/\u00A0/g, "")
        .replace(/\r?\n/g, " ")
        .trim()
        .replace(/\s+/g, " ");
    },
    pickSubjectByNameCandidates(nameKey, candidates, nameMatchState) {
      if (!Array.isArray(candidates) || !candidates.length) {
        return null;
      }
      if (candidates.length === 1 || !nameMatchState) {
        return candidates[0];
      }
      const usedMap = nameMatchState.usedSubjectIdsByName || new Map();
      const cursorMap = nameMatchState.cursorByName || new Map();
      const usedIds = usedMap.get(nameKey) || new Set();
      const startCursor = Number(cursorMap.get(nameKey) || 0);

      let selected = null;
      let selectedIndex = -1;
      for (let offset = 0; offset < candidates.length; offset += 1) {
        const index = (startCursor + offset) % candidates.length;
        const candidate = candidates[index];
        const candidateId = this.normalizeSubjectId(
          candidate && (candidate.id || candidate.subjectId)
        );
        if (!candidateId || !usedIds.has(candidateId)) {
          selected = candidate;
          selectedIndex = index;
          break;
        }
      }

      if (!selected) {
        selectedIndex = startCursor % candidates.length;
        selected = candidates[selectedIndex];
      }

      const selectedId = this.normalizeSubjectId(
        selected && (selected.id || selected.subjectId)
      );
      if (selectedId) {
        if (!usedMap.has(nameKey)) {
          usedMap.set(nameKey, new Set());
        }
        usedMap.get(nameKey).add(selectedId);
      }

      cursorMap.set(nameKey, selectedIndex + 1);
      nameMatchState.usedSubjectIdsByName = usedMap;
      nameMatchState.cursorByName = cursorMap;
      return selected;
    },
    resolveMappedSubject(mappedItem, subjectLookups, nameMatchState) {
      if (!mappedItem || !subjectLookups) {
        return null;
      }
      const mappedSubjectId = this.normalizeSubjectId(mappedItem.subjectId);
      const byIdSubject =
        mappedSubjectId && subjectLookups.byId
          ? subjectLookups.byId.get(mappedSubjectId)
          : null;
      if (byIdSubject) {
        return byIdSubject;
      }
      const codeKey = this.normalizeSubjectCode(mappedItem.subjectCode);
      if (codeKey && subjectLookups.byCode && subjectLookups.byCode.has(codeKey)) {
        return subjectLookups.byCode.get(codeKey);
      }
      const nameKey = this.normalizeExactSubjectName(mappedItem.subjectName);
      if (!nameKey || !subjectLookups.byName) {
        return null;
      }
      const byNameSubjects = subjectLookups.byName.get(nameKey);
      if (!byNameSubjects || !byNameSubjects.length) {
        return null;
      }
      return this.pickSubjectByNameCandidates(
        nameKey,
        byNameSubjects,
        nameMatchState
      );
    },
    matchMappedSubject(
      row,
      templateMappingLookup,
      subjectLookups,
      templateMappingOrder = [],
      rowOrderIndex = 0,
      mappingStrategy = "sequence",
      nameMatchState = null
    ) {
      const rowIndex = Number(row.rowIndex);
      const mappedItem =
        mappingStrategy === "row-index"
          ? templateMappingLookup.get(rowIndex) || templateMappingOrder[rowOrderIndex]
          : templateMappingOrder[rowOrderIndex] || templateMappingLookup.get(rowIndex);

      if (!mappedItem) {
        return {
          subject: null,
          reason:
            mappingStrategy === "row-index"
              ? "模板行未在“科目映射”工作表中定义"
              : "顺序映射失败：模板行超出“科目映射”定义范围",
        };
      }

      if (mappedItem.isLeaf === false) {
        return {
          subject: null,
          reason: "父节点不允许导入，仅支持叶子科目",
          expectedSubjectId: mappedItem.subjectId || "",
        };
      }

      const subject = this.resolveMappedSubject(
        mappedItem,
        subjectLookups,
        nameMatchState
      );
      if (!subject) {
        return {
          subject: null,
          reason: "当前用户未被授权导入该科目",
          expectedSubjectId: mappedItem.subjectId,
        };
      }

      return {
        subject,
        mapping: mappedItem,
      };
    },
    resolveColumnMapping(columnGroup, variant, yearIndex, _variantIndex) {
      const variantLabel = variant.name || `列${variant.key}`;
      const yearLabel = columnGroup.year || `年份${yearIndex + 1}`;
      const yearInfo = this.resolveModelYear(yearLabel, yearIndex);

      return {
        columnKey: variant.key,
        yearLabel,
        yearAggregateMode: yearInfo.value == null ? "COMBINED" : "SPECIFIC",
        modelYear: yearInfo.value,
        yearSource: yearInfo.source,
        modelName: this.projectName,
        trimName: variantLabel,
        variantLabel,
      };
    },
    resolveModelYear(label, yearIndex) {
      const normalizedLabel = String(label || "").toLowerCase();
      if (normalizedLabel.includes("全生命周期")) {
        return {
          value: null,
          source: "lifecycle-display",
        };
      }

      const explicitYearMatch = String(label || "").match(/(19|20)\d{2}/);
      if (explicitYearMatch) {
        return {
          value: Number(explicitYearMatch[0]),
          source: "header",
        };
      }

      const baseYear = this.getBaseModelYear();
      if (normalizedLabel.includes("首年") || normalizedLabel.includes("n年")) {
        return {
          value: baseYear,
          source: "base-year",
        };
      }
      if (normalizedLabel.includes("n+1")) {
        return {
          value: baseYear + 1,
          source: "base-year+1",
        };
      }
      if (normalizedLabel.includes("n+n")) {
        return {
          value: baseYear + 2,
          source: "base-year+2",
        };
      }
      return {
        value: baseYear + yearIndex,
        source: "fallback-sequence",
      };
    },
    buildHistoryCellKey(subjectId, modelYear, trimName) {
      return [
        subjectId || "",
        modelYear != null ? String(modelYear) : "",
        String(trimName || "").trim(),
      ].join("::");
    },
    async handleDeleteCurrentValveRecords() {
      if (!this.projectId) {
        this.$message.error("当前项目缺少项目 ID，无法删除");
        return;
      }
      if (!this.currentValvePoint) {
        this.$message.error("当前阀点为空，无法删除");
        return;
      }

      try {
        await this.$confirm(
          `确认删除当前项目阀点“${this.currentValvePoint}”下的全部导入数据吗？`,
          "删除确认",
          {
            confirmButtonText: "删除",
            cancelButtonText: "取消",
            type: "warning",
          }
        );
      } catch (_error) {
        return;
      }

      this.deletingValveRecords = true;
      try {
        const res = await deleteImportedProjectCostRecords({
          projectId: this.projectId,
          valvePoint: this.currentValvePoint,
        });
        const deletedCount =
          res && res.data && res.data.deletedCount != null
            ? Number(res.data.deletedCount)
            : null;
        this.$message.success(
          deletedCount != null ? `删除成功，共删除 ${deletedCount} 条数据` : "删除成功"
        );
        await this.loadValveHistory({ valvePoint: this.currentValvePoint });
      } catch (error) {
        if (error && error !== "cancel") {
          console.error(error);
          this.$message.error((error && error.message) || "删除失败");
        }
      } finally {
        this.deletingValveRecords = false;
      }
    },
    getActiveValveContext() {
      const activeValve = this.activeValve;
      const rootSubject = this.selectedImportRootSubject;
      return {
        id: this.activeValveId,
        valveName: activeValve ? activeValve.valveName || "" : "",
        valvePoint: activeValve ? activeValve.valvePoint || "" : "",
        rootSubject: rootSubject
          ? {
              id: rootSubject.id,
              label: rootSubject.label,
              rootSubjectName: rootSubject.rootSubjectName,
              leafCount: rootSubject.leafCount,
            }
          : null,
      };
    },
    resolveRecordDisplayValue(record, row = {}) {
      if (!record) {
        return "";
      }
      if (record.numberValue != null && record.numberValue !== "") {
        return formatRevenueDisplayValue(record.numberValue, row, { precision: 6 });
      }
      if (record.textValue != null && record.textValue !== "") {
        return formatRevenueDisplayValue(record.textValue, row, { precision: 6 });
      }
      if (record.rawValue != null && record.rawValue !== "") {
        return formatRevenueDisplayValue(record.rawValue, row, { precision: 6 });
      }
      return "";
    },
    getBaseModelYear() {
      const candidates = [
        this.project.modelYear,
        this.project.year,
        this.project.projectYear,
        this.project.planYear,
        this.project.vehicleModel && this.project.vehicleModel.modelYear,
        this.project.vehicleModel && this.project.vehicleModel.year,
      ];
      for (let index = 0; index < candidates.length; index += 1) {
        const value = candidates[index];
        const matched = String(value || "").match(/(19|20)\d{2}/);
        if (matched) {
          return Number(matched[0]);
        }
      }
      return new Date().getFullYear();
    },
    resolveImportValue(cellMeta, subject = {}) {
      return normalizeExcelCellForRevenue(cellMeta, subject);
    },
    findDuplicateCells(data) {
      const seen = new Map();
      const duplicates = [];
      (data || []).forEach((item) => {
        const key = [
          item.modelName,
          item.trimName,
          item.subjectId,
          item.yearAggregateMode,
          item.modelYear,
        ].join("::");
        if (seen.has(key)) {
          duplicates.push(key);
          return;
        }
        seen.set(key, true);
      });
      return duplicates;
    },
    resetImportedData() {
      this.parsedWorkbook = null;
      this.pendingImportPreparation = null;
      this.parsing = false;
      this.savingImport = false;
      if (this.$refs.importInput) {
        this.$refs.importInput.value = "";
      }
    },
    syncActiveValve() {
      const routeValveId = String(this.initialValveId || "");
      if (routeValveId) {
        const routeValve = this.normalizedValveList.find(
          (item) => item.id === routeValveId
        );
        if (routeValve) {
          this.activeValveId = routeValve.id;
          return;
        }
      }
      const preferredValve = this.normalizedValveList.find((item) => {
        const valvePoint = String(item.valvePoint || "").toUpperCase();
        const valveName = String(item.valveName || "").toUpperCase();
        return valvePoint === "G8" || valveName === "G8";
      });
      const firstValve = preferredValve || this.normalizedValveList[0];
      if (!firstValve) {
        this.activeValveId = "";
        return;
      }

      const exists = this.normalizedValveList.some(
        (item) => item.id === this.activeValveId
      );

      if (!exists) {
        this.activeValveId = firstValve.id;
      }
    },
    handleTabClick(tab) {
      this.activeValveId = tab.name;
    },
    statusText(status) {
      const map = {
        0: "未过阀",
        1: "不允许过阀",
        2: "带条件过阀",
        3: "允许过阀",
      };
      return map[status] || "-";
    },
  },
};
</script>

<style scoped lang="scss">
.project-detail {
  .detail-subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: #7a8598;
    line-height: 1.6;
  }

  .detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 30;
    background: #fff;
    border-bottom: 1px solid #e6ebf5;
    padding-bottom: 12px;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
  }

  .detail-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .detail-actions > * {
    margin-left: 0;
  }

  ::v-deep .detail-actions .el-button {
    margin-left: 0;
  }

  .import-input {
    display: none;
  }

  .detail-title {
    font-size: 18px;
    font-weight: 600;
    color: #30394a;
    line-height: 1.4;
  }

  .detail-title-sub {
    margin-left: 8px;
    font-size: 13px;
    color: #2a89e8;
    font-weight: 600;
  }

  .detail-body {
    min-height: calc(100vh - 210px);
  }

  .detail-card {
    margin-bottom: 12px;
    border: 1px solid #e2e8f1;
    border-radius: 10px;
  }

  .parse-info-card {
    .parse-box {
      border: 1px solid #e4ebf6;
      border-radius: 10px;
      background: #fff;
      padding: 10px;
      margin-bottom: 8px;

      p {
        margin: 0 0 6px;
        font-size: 12px;
        color: #4d627f;
        line-height: 1.6;
      }

      p:last-child {
        margin-bottom: 0;
      }
    }

    .parse-note {
      margin: 0;
      font-size: 12px;
      line-height: 1.6;
      color: #7a8598;
    }
  }

  .valve-tabs-card {
    margin-bottom: 12px;
  }

  .valve-tabs {
    ::v-deep .el-tabs__header {
      margin-bottom: 0;
    }

    ::v-deep .el-tabs__nav-wrap::after {
      height: 1px;
      background-color: #ebeef5;
    }

    ::v-deep .el-tabs__item {
      height: 42px;
      line-height: 42px;
      padding: 0 20px;
      font-size: 14px;
    }
  }

  .placeholder-card,
  .preview-card {
    min-height: 320px;

    ::v-deep .el-card__body {
      padding: 0;
    }
  }

  .placeholder-content {
    min-height: 0;
  }

  .history-panel {
    min-height: 0;
  }

  .expense-table-wrap {
    overflow-x: auto;
    overflow-y: auto;
    border: 1px solid #d9e5f4;
    background: #fff;
    border-radius: 6px;
  }

  .expense-table {
    width: max-content;
    min-width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: auto;
    font-size: 13px;
    color: #303133;
  }

  .expense-table th,
  .expense-table td {
    border-right: 1px solid #d9e5f4;
    border-bottom: 1px solid #d9e5f4;
    padding: 0;
    text-align: center;
    vertical-align: middle;
  }

  .expense-table tr:first-child th {
    border-top: 0;
  }

  .expense-table th:first-child,
  .expense-table td:first-child {
    border-left: 0;
  }

  .expense-table .sticky-col {
    position: sticky;
    left: 0;
    z-index: 2;
    background: #fff;
  }

  .expense-table .subject-header,
  .expense-table .year-header,
  .expense-table .trim-header {
    background: #f3f6fb;
    color: #55657d;
    font-weight: 600;
  }

  .expense-table .subject-header {
    min-width: 220px;
  }

  .expense-table .year-header {
    height: 40px;
    padding: 0 14px;
    font-size: 14px;
    white-space: nowrap;
  }

  .expense-table .trim-header {
    height: 38px;
    padding: 0 14px;
    font-size: 13px;
    white-space: nowrap;
  }

  .expense-table .subject-cell {
    background: #fbfcfe;
  }

  .expense-table .subject-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 40px;
    padding: 0 12px;
    text-align: left;
    font-weight: 500;
    white-space: nowrap;
  }

  .expense-table .subject-unit {
    flex-shrink: 0;
    color: #8b97a8;
    font-size: 12px;
    font-weight: 400;
  }

  .expense-table .cell-value {
    height: 40px;
    padding: 0 14px;
    background: #fff;
    white-space: nowrap;
  }

  .expense-table .is-empty {
    color: #c0c4cc;
  }

  .expense-table .is-computed-lifecycle {
    background: #eef7ff;
    color: #255b87;
  }

  .expense-table .is-group-row .subject-cell,
  .expense-table .is-group-row .sticky-col {
    background: #f4f8fd;
  }

  .expense-table .is-group-row .subject-label {
    font-weight: 600;
  }

  .expense-table .is-group-row .cell-value {
    background: #f8fbff;
  }

  .preview-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
    margin-bottom: 10px;
    padding: 12px 14px 0;
  }

  .summary-item {
    border: 1px solid #e4ecf7;
    border-radius: 10px;
    padding: 10px;
    background: #fbfdff;

    .k {
      font-size: 12px;
      color: #7a8598;
    }

    .v {
      margin-top: 4px;
      font-size: 16px;
      font-weight: 700;
      color: #2a5fa6;
      line-height: 1.4;
      word-break: break-all;
    }
  }

  .preview-table-wrap {
    margin: 0 14px 12px;
  }

  .preview-alert {
    margin: 0 14px 10px;
  }

  .preview-table {
    .preview-sticky-col {
      z-index: 3;
      background: #fff;
    }

    .row-index-col {
      min-width: 90px;
      max-width: 90px;
      left: 0;
    }

    .second-col {
      min-width: 180px;
      max-width: 180px;
      left: 90px;
    }

    .third-col {
      min-width: 220px;
      max-width: 220px;
      left: 270px;
    }

    th.preview-sticky-col {
      z-index: 6;
      background: #f3f6fb;
    }

    .is-error {
      color: #d95c5c;
      font-weight: 600;
      background: #fff6f6;
    }
  }

  .preview-issues {
    margin: 0 14px 14px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .issue-panel {
    border: 1px solid #f0cccc;
    background: #fff5f5;
    border-radius: 8px;
    padding: 10px;
    min-height: 120px;

    .issue-title {
      margin-bottom: 8px;
      font-size: 13px;
      color: #ad3f3f;
      font-weight: 600;
    }

    ul {
      margin: 0;
      padding-left: 18px;
      color: #a64343;
      font-size: 12px;
      line-height: 1.6;
    }
  }

  @media screen and (max-width: 768px) {
    .detail-header {
      flex-direction: column;
      align-items: stretch;
    }

    .detail-actions {
      width: 100%;
    }

    .detail-body {
      min-height: auto;
    }

    .placeholder-content {
      min-height: 180px;
    }

    .preview-summary-grid {
      grid-template-columns: 1fr;
      padding-top: 10px;
    }

    .preview-table-wrap {
      margin: 0 10px 10px;
    }

    .preview-issues {
      grid-template-columns: 1fr;
      margin: 0 10px 10px;
    }
  }
}
</style>
