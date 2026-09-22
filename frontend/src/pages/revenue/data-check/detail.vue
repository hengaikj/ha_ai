<template>
  <section
    v-loading="loading"
    class="data-check-detail main-table-compare-fullscreen-host rev-impact-theme rv-card rv-list-card"
  >
    <section class="hero-header">
      <div class="hero-left">
        <div>
          <div class="hero-id">{{ projectHeaderIdText }}</div>
          <div class="hero-id-meta">{{ projectHeaderMetaText }}</div>
        </div>
      </div>
      <div class="hero-actions">
        <el-button size="small" @click="goBack">返回</el-button>
      </div>
    </section>

    <div class="card-block source-card">
      <div class="source-head">
        <div>
          <div class="block-title">校核数据源</div>
          <div class="source-note">{{ sourceRuleText }}</div>
        </div>
        <el-tag size="small" type="info">{{ currentStageLabel }}</el-tag>
      </div>
      <div class="source-tags">
        <el-tag
          v-for="item in sourceVersions"
          :key="item.key"
          size="small"
          :type="item.key === state.baselineVersion ? 'success' : 'info'"
          effect="light"
        >
          {{ item.label }}
        </el-tag>
        <span v-if="!sourceVersions.length" class="source-empty">暂无可用主表数据</span>
      </div>
    </div>

    <el-alert
      v-if="pageMessage"
      class="page-message"
      :title="pageMessage"
      type="warning"
      show-icon
      :closable="false"
    />

    <MainTableComparePanel
      :state="state"
      :fixed-baseline-version-label="fixedBaselineVersionLabel"
      :lock-baseline="false"
      :baseline-version-options="baselineVersionOptions"
      :compare-version-options="compareVersionOptions"
      :add-history-valve-option-key="addHistoryValveOptionKey"
      :add-history-valve-option-label="addHistoryValveOptionLabel"
      :other-project-option-key="otherProjectOptionKey"
      :other-project-option-label="otherProjectOptionLabel"
      :review-year-options="reviewYearOptions"
      :is-detail-mode="isDetailMode"
      :compare-column-defs="compareColumnDefs"
      :compare-header-versions="compareHeaderVersions"
      :display-subject-rows="displaySubjectRows"
      :detail-column-defs="detailColumnDefs"
      :detail-header-groups="detailHeaderGroups"
      :compare-table-style="compareTableStyle"
      :detail-table-style="detailTableStyle"
      :reset-compare-controls="resetCompareControls"
      :on-baseline-version-change="onBaselineVersionChange"
      :on-compare-versions-change="onCompareVersionsChange"
      :on-view-mode-change="onViewModeChange"
      :on-year-change="onYearChange"
      :version-head-style="versionHeadStyle"
      :is-frozen-compare-version="isFrozenCompareVersion"
      :year-head-style="yearHeadStyle"
      :section-fill-cell-class="sectionFillCellClass"
      :compare-cell-style="compareCellStyle"
      :format-subject-group-label="formatSubjectGroupLabel"
      :is-meeting-module-loading="isMeetingModuleLoading"
      :is-meeting-module-error="isMeetingModuleError"
      :retry-meeting-module="retryMeetingModule"
      :is-manual-row-highlighted="isManualRowHighlighted"
      :is-subject-collapse-parent="isSubjectCollapseParent"
      :is-subject-collapsed="isSubjectCollapsed"
      :toggle-subject-collapse="toggleSubjectCollapse"
      :toggle-manual-row-highlight="toggleManualRowHighlight"
      :display-ui-text="displayUiText"
      :compare-cell-class="compareCellClass"
      :is-manual-cell-highlighted="isManualCellHighlighted"
      :toggle-manual-cell-highlight="toggleManualCellHighlight"
      :compare-cell-text="compareCellText"
      :detail-cell-text="detailCellText"
      :open-calc-drawer="openCalcDrawer"
      :show-calculator="true"
      :show-add-history-option="true"
      :show-other-project-option="true"
    />

    <el-dialog
      v-model="historyValveDialogVisible"
      title="添加当前项目历史阀点数据"
      width="420px"
      append-to-body
    >
      <el-form label-width="88px" size="small">
        <el-form-item label="历史阀点">
          <el-select
            v-model="historyValvePickerValue"
            filterable
            clearable
            placeholder="请选择阀点"
            :loading="historyValveLoading"
            style="width: 100%"
          >
            <el-option
              v-for="item in historyValveOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="historyValveDialogVisible = false">取消</el-button>
          <el-button
            size="small"
            type="primary"
            :loading="historyValveLoading"
            @click="confirmAddHistoryValveVersion"
          >
            添加
          </el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog
      v-model="otherProjectDialogVisible"
      title="添加其他项目历史阀点数据"
      width="480px"
      append-to-body
    >
      <el-form label-width="88px" size="small">
        <el-form-item label="对比项目">
          <el-select
            v-model="otherProjectPickerValue"
            filterable
            clearable
            placeholder="请选择授权项目"
            :loading="otherProjectLoading"
            style="width: 100%"
            @change="onOtherProjectPickerChange"
          >
            <el-option
              v-for="item in otherProjectOptions"
              :key="item.projectId"
              :label="item.label"
              :value="item.projectId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="阀点">
          <el-select
            v-model="otherProjectValvePickerValue"
            filterable
            clearable
            placeholder="请先选择项目"
            :disabled="!otherProjectPickerValue"
            :loading="otherProjectLoading"
            style="width: 100%"
          >
            <el-option
              v-for="item in otherProjectValveOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="otherProjectDialogVisible = false">取消</el-button>
          <el-button
            size="small"
            type="primary"
            :loading="otherProjectLoading"
            @click="confirmAddOtherProjectVersion"
          >
            导入
          </el-button>
        </span>
      </template>
    </el-dialog>

    <OnsiteCalculatorDrawer
      v-model:visible="calcDrawerVisible"
      :size="calcDrawerSize"
      :state="state"
      :all-versions="allVersions"
      :calc-base-year-options="calcBaseYearOptions"
      :calc-editable-fields="calcEditableFields"
      :subjects="subjects"
      :dimensions="dimensions"
      :default-trim-index="defaultTrimIndex"
      :build-base-snapshot="buildBaseSnapshot"
      :compute-calc-values="computeCalcValues"
      :get-version-value="getVersionValue"
      :format-number="formatNumber"
      :safe-number="safeNumber"
      :clone-value="clone"
      :resolve-calc-subject-path="resolveCalcSubjectPath"
      :resolve-calc-subject-meta="resolveCalcSubjectMeta"
      :ensure-state-after-version-change="ensureStateAfterVersionChange"
      :persist-draft="persistCalcDraft"
    />
  </section>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { BaseToast } from "@/components/base/BaseToast";
import MainTableComparePanel from "@/pages/revenue/components/MainTableComparePanel.vue";
import OnsiteCalculatorDrawer from "@/pages/revenue/meeting-review/components/OnsiteCalculatorDrawer.vue";
import { REVENUE_MODULE_CODE, REVENUE_VALUE_SOURCE } from "@/pages/revenue/subtable-workbench/domain-config";
import {
  REVENUE_ROW_KIND,
  formatRevenueTableCellValue,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import {
  applyRevenueFormulasToDetail,
  REVENUE_FORMULA_CALCULATION_MODE,
} from "@/pages/revenue/subtable-workbench/formula-engine";
import {
  buildMainTableDefaultYearIndexes,
  buildMainTableDetailColumnDefs,
  buildMainTableDetailHeaderGroups,
  buildMainTableDetailTrimIndexes,
  buildMainTableNormalizedSelectedYearIndexes,
  buildMainTableReviewYearOptions,
} from "@/pages/revenue/components/main-table-review-model";
import {
  fetchMainTableDataCheckSources,
  fetchMainTableDataCheckHistoryValveSource,
  fetchMainTableDataCheckOtherProjectSource,
} from "@/pages/revenue/subtable-workbench/service";
import { getValveList } from "@/pages/revenue/meeting-review/service";
import { queryRevenueProjectPage } from "@/api/revenue/flow";
import { createDataCheckSourceModel } from "./data-check-detail-source";

import { formatPeriodExpenseDisplayText } from "@/utils/displayText";
import { useAuthStore } from "@/stores/auth";

interface StageStep {
  code: string;
  label: string;
}

interface SourceVersion {
  key: string;
  stage: string;
  label: string;
  dot: string;
  group: string;
  sourceType: string;
  recordStatus: string;
  recordCount: number;
}

interface OtherProjectOption {
  projectId: string;
  projectCode: string;
  projectName: string;
  label: string;
  valves: { label: string; value: string }[];
}

interface ProjectInfo {
  projectNo: string;
  projectCode: string;
  projectId: string;
  flowId: string;
  projectName: string;
  gate: string;
  stage: string;
  nodeStatus: string;
  valvePoint?: string;
}

interface Dimensions {
  years: string[];
  trims: string[];
  yearFactors: number[];
}

interface SubjectItem {
  id: string;
  templateId?: string;
  subjectId?: string;
  subjectCode?: string;
  formulaKey?: string;
  name?: string;
  unit?: string;
  subjectPath?: string[];
  bold?: boolean;
  rowKind?: string;
  rowType?: string;
  valueSource?: string;
  sourceType?: string;
  inputType?: string;
  entryMode?: string;
  templateEntryMode?: string;
  formulaId?: string;
  formulaCode?: string;
  formulaName?: string;
  formulaExpression?: string;
  expression?: string;
  aggregateFormula?: string;
  formulaParamBindings?: unknown[];
  [key: string]: unknown;
}

interface SubjectGroup {
  group: string;
  unit?: string;
  name?: string;
  items: SubjectItem[];
}

interface CalcVersion {
  key: string;
  label: string;
  dot: string;
  group: string;
  values: Record<string, unknown>;
  calcMode: string;
  mixScenario: unknown;
}

interface CompareState {
  baselineVersion: string;
  compareVersions: string[];
  viewMode: string;
  activeYear: number;
  activeYears: number[];
  activeYearsUserSelected?: boolean;
  activeTrims: number[];
  autoDiff: boolean;
  deltaMode: boolean;
  calcVersions: CalcVersion[];
  calcVersionSeed: number;
  activeCalcVersionKey: string;
  calcBaseVersion: string;
  calcBaseYear: number;
  calcDraftValues: Record<string, unknown>;
  calcMode: string;
  calcMixInputMode: string;
  calcMixLockTotalVolume: boolean;
}

interface CandidateTarget {
  trims: Record<string, number[]>;
  years: Record<string, Record<number, number>>;
  yearTrims: Record<string, Record<number, number[]>>;
  [key: string]: unknown;
}

interface VersionMeta {
  key: string;
  label: string;
  dot: string;
  group: string;
  stage?: string;
  disabled?: boolean;
  required?: boolean;
}

interface ColumnDef {
  versionKey: string;
  yearIndex: number;
  trimIndex: number;
  isBaseline: boolean;
  columnKey: string;
}

interface HeaderVersion {
  key: string;
  label: string;
  dot: string;
  yearColumns: { yearIndex: number; label: string; columnKey: string }[];
  colspan: number;
}

interface DisplaySubjectRow {
  type: string;
  key: string;
  group?: SubjectGroup;
  item?: SubjectItem;
  isFixedFeeChild?: boolean;
  isFixedFeeChildCollapsed?: boolean;
}

const STAGE_STEPS: readonly StageStep[] = Object.freeze([
  { code: "S1", label: "S1 业务经理填报" },
  { code: "S2", label: "S2 集团部室审核" },
  { code: "S3", label: "S3 业务经理二次确认" },
  { code: "S4", label: "S4 二级公司财务审核" },
  { code: "S5", label: "S5 二级公司最终提交" },
  { code: "S6", label: "S6 集团财务审核" },
  { code: "S7", label: "S7 会前窗口期" },
  { code: "S8", label: "S8 集团上会评审" },
]);

const STAGE_ORDER = STAGE_STEPS.map((item: any) => item.code);
const FIXED_FEE_PARENT_SUBJECT_ID = "fixed_total";
const FIXED_FEE_CHILD_SUBJECT_IDS = [
  "fixed_tax",
  "fixed_mfg",
  "fixed_sale",
  "management",
  "rd_expense",
  "finance_exp",
];
const ADD_HISTORY_VALVE_OPTION_KEY = "__add_history_valve__";
const ADD_HISTORY_VALVE_OPTION_LABEL = "添加当前项目历史阀点数据";
const OTHER_PROJECT_OPTION_KEY = "__other_project__";
const OTHER_PROJECT_OPTION_LABEL = "添加其他项目历史阀点数据";

function normalizeStageCode(value: unknown, fallback = "S1"): string {
  const text = String(value == null ? "" : value).trim().toUpperCase();
  return STAGE_ORDER.includes(text) ? text : fallback;
}

function normalizeText(value: unknown, fallback = ""): string {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

// ---- 组合式 API 初始化 ----
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

// ---- 响应式数据 ----
const loading = ref(false);
const pageMessage = ref("");
const project = reactive<ProjectInfo>({
  projectNo: "",
  projectCode: "",
  projectId: "",
  flowId: "",
  projectName: "",
  gate: "",
  stage: "",
  nodeStatus: "",
});
const dimensions = reactive<Dimensions>({
  years: [],
  trims: [],
  yearFactors: [],
});
const subjects = ref<SubjectGroup[]>([]);
const sourceVersions = ref<SourceVersion[]>([]);
const candidateValues = ref<Record<string, CandidateTarget>>({});
const sourceRecordMap = ref<Record<string, Record<string, unknown>>>({});
const calcDrawerVisible = ref(false);
const calcEditableFields = ref<{ id: string; label: string; unit: string; rowKind: string; valueSource: string }[]>([]);
const historyValveDialogVisible = ref(false);
const historyValvePickerValue = ref("");
const historyValveLoading = ref(false);
const historyValveOptions = ref<{ label: string; value: string }[]>([]);
const otherProjectDialogVisible = ref(false);
const otherProjectPickerValue = ref("");
const otherProjectValvePickerValue = ref("");
const otherProjectLoading = ref(false);
const otherProjectOptions = ref<OtherProjectOption[]>([]);
const otherProjectValveOptions = ref<{ label: string; value: string }[]>([]);
const subjectCollapseState = reactive<Record<string, boolean>>({
  [FIXED_FEE_PARENT_SUBJECT_ID]: false,
});
const manualCellHighlights = reactive<Record<string, boolean>>({});
const manualRowHighlights = reactive<Record<string, boolean>>({});
const state = reactive<CompareState>({
  baselineVersion: "",
  compareVersions: [],
  viewMode: "compare",
  activeYear: 0,
  activeYears: [],
  activeTrims: [],
  autoDiff: true,
  deltaMode: false,
  calcVersions: [],
  calcVersionSeed: 0,
  activeCalcVersionKey: "",
  calcBaseVersion: "",
  calcBaseYear: 0,
  calcDraftValues: {},
  calcMode: "single",
  calcMixInputMode: "mix",
  calcMixLockTotalVolume: true,
});

// ---- computed ----
const queryProjectNo = computed(() =>
  normalizeText(route.query.projectNo || route.query.projectCode)
);
const queryProjectCode = computed(() =>
  normalizeText(route.query.projectCode || queryProjectNo.value)
);
const queryProjectId = computed(() => normalizeText(route.query.projectId));
const queryFlowId = computed(() => normalizeText(route.query.flowId));
const queryProjectName = computed(() => normalizeText(route.query.projectName));
const queryStage = computed(() =>
  normalizeStageCode(route.query.stage || "S1", "S1")
);
const queryValve = computed(() =>
  normalizeText(route.query.valvePoint || route.query.valve)
);
const queryNodeStatus = computed(() => normalizeText(route.query.nodeStatus));
const hasAllPermission = computed(() => {
  const permissions = authStore.permissions || [];
  return permissions.includes("*:*:*");
});
const queryPermissionKey = computed(() =>
  normalizeText(route.query.permissionKey || route.query.permission, "revenue:s8:view")
);
const projectTitle = computed(() =>
  project.projectName || queryProjectName.value || project.projectNo || queryProjectNo.value || "收益测算项目"
);
const projectHeaderIdText = computed(() => projectTitle.value);
const projectHeaderMetaText = computed(() => {
  return [
    project.projectCode || queryProjectCode.value,
    project.gate || queryValve.value ? `${project.gate || queryValve.value} 阀点` : "",
    currentStageLabel.value,
    nodeStatusText.value,
  ].filter(Boolean).join(" · ");
});
const currentStage = computed(() =>
  normalizeStageCode(project.stage || queryStage.value, "S1")
);
const currentStageLabel = computed(() => getStageLabel(currentStage.value));

const nodeStatusText = computed(() => {
  const status = normalizeText(project.nodeStatus || queryNodeStatus.value).toUpperCase();
  const map: Record<string, string> = {
    IN_PROGRESS: "进行中",
    PROCESSING: "进行中",
    RUNNING: "进行中",
    FINISHED: "已完成",
    COMPLETED: "已完成",
    DONE: "已完成",
    VOIDED: "已作废",
    REJECTED: "已驳回",
  };
  return map[status] || "";
});

const sourceRuleText = computed(() => {
  const previous = resolveSourceStageCodes(currentStage.value)
    .filter((item: any) => item !== currentStage.value)
    .join("、");
  const currentSnapshotIncluded = sourceVersions.value
    .some((item: any) =>
      item.group === "stage" &&
      item.stage === currentStage.value &&
      item.sourceType !== "mainPreview"
    );
  const currentPreviewIncluded = sourceVersions.value
    .some((item: any) => item.group === "preview" && item.stage === currentStage.value);
  const base = previous ? `当前节点前置阶段：${previous}` : "当前节点前无前置阶段";
  if (currentSnapshotIncluded) {
    return `${base}；当前节点已形成主表快照，已纳入校核。`;
  }
  return currentPreviewIncluded
    ? `${base}；当前节点暂无主表快照，已纳入主表预览。`
    : `${base}；当前节点暂无主表快照。`;
});

const _sourceVersionMap = computed(() =>
  sourceVersions.value.reduce<Record<string, SourceVersion>>((map, item) => {
    map[item.key] = item;
    return map;
  }, {})
);

const fixedBaselineVersionLabel = computed(() => {
  const meta = allVersionMap.value[state.baselineVersion];
  return meta ? meta.label : "-";
});

const addHistoryValveOptionKey = computed(() => ADD_HISTORY_VALVE_OPTION_KEY);
const addHistoryValveOptionLabel = computed(() => ADD_HISTORY_VALVE_OPTION_LABEL);
const otherProjectOptionKey = computed(() => OTHER_PROJECT_OPTION_KEY);
const otherProjectOptionLabel = computed(() => OTHER_PROJECT_OPTION_LABEL);

const baselineVersionOptions = computed(() =>
  allVersions.value.map((item: any) => ({
    ...item,
    disabled: false,
  }))
);

const compareVersionOptions = computed(() =>
  allVersions.value
    .filter((item: any) => item.key !== state.baselineVersion)
    .map((item: any) => ({
      ...item,
      required: false,
    }))
);

const calcVersionOptions = computed(() =>
  (Array.isArray(state.calcVersions) ? state.calcVersions : [])
    .map((item: any) => ({
      key: item.key,
      label: item.label,
      dot: item.dot || "calc",
      group: item.group || "calc",
    }))
    .filter((item: any) => item.key)
);

const allVersions = computed(() =>
  (sourceVersions.value as any[]).concat(calcVersionOptions.value) as VersionMeta[]
);

const allVersionMap = computed(() =>
  allVersions.value.reduce<Record<string, VersionMeta>>((map, item) => {
    map[item.key] = item;
    return map;
  }, {})
);

const isDetailMode = computed(() => state.viewMode === "detail");

const displaySubjects = computed(() =>
  (subjects.value || [])
    .map((group: any) => ({
      ...group,
      items: group.items || [],
    }))
    .filter((group: any) => group.items && group.items.length)
);

const displaySubjectRows = computed(() => {
  const rows: DisplaySubjectRow[] = [];
  const fixedFeeCollapsed = isSubjectCollapsed(FIXED_FEE_PARENT_SUBJECT_ID);
  displaySubjects.value.forEach((group: any) => {
    rows.push({
      type: "section",
      key: `section_${group.group}`,
      group,
    });
    (group.items || []).forEach((item: any) => {
      rows.push({
        type: "item",
        key: `item_${group.group}_${item.id}`,
        group,
        item,
        isFixedFeeChild: FIXED_FEE_CHILD_SUBJECT_IDS.includes(item.id),
        isFixedFeeChildCollapsed:
          fixedFeeCollapsed && FIXED_FEE_CHILD_SUBJECT_IDS.includes(item.id),
      });
    });
  });
  return rows;
});

const reviewYearOptions = computed(() =>
  buildMainTableReviewYearOptions(dimensions, {
    safeText: (value: unknown, fallback?: string) => safeText(value, fallback || ""),
    normalizeYearMatchKey: (value: unknown) => normalizeYearMatchKey(value),
  })
);

const defaultYearIndexes = computed(() =>
  buildMainTableDefaultYearIndexes(reviewYearOptions.value)
);

const calcBaseYearOptions = computed(() =>
  reviewYearOptions.value.length
    ? reviewYearOptions.value
    : [{ label: yearLabelByIndex(0) || "首年", value: 0 }]
);

function roundNumber(value: unknown, digits = 2): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const factor = Math.pow(10, digits);
  return Math.round(num * factor) / factor;
}

const sourceModel: import("./data-check-detail-source").DataCheckSourceModel = createDataCheckSourceModel({
  project,
  dimensions,
  subjects,
  sourceVersions,
  candidateValues,
  sourceRecordMap,
  calcEditableFields,
  state,
  pageMessage,
  mergeProjectWithRoute,
  getStageLabel,
  getCurrentStage: () => currentStage.value,
  getReviewYearOptions: () => reviewYearOptions.value,
  getCalcBaseYearOptions: () => calcBaseYearOptions.value,
  getDefaultYearIndexes: () => defaultYearIndexes.value,
  clone,
  safeText,
  roundNumber,
  STAGE_ORDER,
});

const {
  applyDataCheckPayload,
  upsertCompareSource,
  normalizeState,
  getVersionValue,
  getDefaultTrimIndex,
  buildCalcEditableFields: buildSourceCalcEditableFields,
  resolveCalcSubjectPath: resolveSourceCalcSubjectPath,
  resolveCalcSubjectMeta: resolveSourceCalcSubjectMeta,
  alignCompareSourceSubjects,
} = sourceModel;

const defaultTrimIndex = computed(() => getDefaultTrimIndex());
const calcDrawerSize = computed(() => "460px");

const selectedYearIndexes = computed(() =>
  buildMainTableNormalizedSelectedYearIndexes(
    state.activeYears,
    reviewYearOptions.value,
    { expandLegacyDefault: !state.activeYearsUserSelected }
  )
);

const detailTrimIndexes = computed(() =>
  buildMainTableDetailTrimIndexes(dimensions)
);

const detailColumnDefs = computed(() =>
  buildMainTableDetailColumnDefs(dimensions, {
    trimIndexes: detailTrimIndexes.value,
    safeText: (value: unknown, fallback?: string) => safeText(value, fallback || ""),
    normalizeYearMatchKey: (value: unknown) => normalizeYearMatchKey(value),
  })
);

const detailHeaderGroups = computed(() =>
  buildMainTableDetailHeaderGroups(detailColumnDefs.value)
);

const compareHeaderVersions = computed(() => {
  const versionKeys = [state.baselineVersion]
    .concat(state.compareVersions || [])
    .filter((key: any, index: any, arr: any) => key && arr.indexOf(key) === index);
  return versionKeys
    .map((key: any) => {
      const meta = allVersionMap.value[key];
      if (!meta) return null;
      const yearColumns = selectedYearIndexes.value.map((yearIndex: any) => ({
        yearIndex,
        label: yearLabelByIndex(yearIndex),
        columnKey: `${key}_${yearIndex}`,
      }));
      return {
        ...meta,
        yearColumns,
        colspan: yearColumns.length || 1,
      } as HeaderVersion;
    })
    .filter(Boolean) as HeaderVersion[];
});

const compareColumnDefs = computed(() => {
  const columns: ColumnDef[] = [];
  compareHeaderVersions.value.forEach((item: any) => {
    item.yearColumns.forEach((yearColumn: any) => {
      columns.push({
        versionKey: item.key,
        yearIndex: yearColumn.yearIndex,
        trimIndex: getDefaultTrimIndex(),
        isBaseline: item.key === state.baselineVersion,
        columnKey: yearColumn.columnKey,
      });
    });
  });
  return columns;
});

const isCompareFitMode = computed(() => compareHeaderVersions.value.length <= 4);

const compareTableStyle = computed(() => {
  const columnCount = Math.max(compareColumnDefs.value.length, 1);
  const minWidth = `calc(var(--subject-col-w) + ${columnCount} * var(--value-col-min-w))`;
  const valueWidth = isCompareFitMode.value
    ? `max(calc((100% - var(--subject-col-w)) / ${columnCount}), var(--value-col-min-w))`
    : "var(--value-col-min-w)";
  const width = isCompareFitMode.value
    ? `max(100%, ${minWidth})`
    : minWidth;
  return {
    "--value-col-w": valueWidth,
    width,
    minWidth,
  };
});

const detailTableStyle = computed(() => {
  const columnCount = Math.max(detailColumnDefs.value.length, 1);
  const width = `calc(var(--subject-col-w) + ${columnCount} * var(--value-col-min-w))`;
  return {
    "--value-col-w": "var(--value-col-min-w)",
    width,
    minWidth: width,
  };
});

// ---- 辅助函数（先于 computed 引用定义） ----
function safeText(value: unknown, fallback = ""): string {
  return normalizeText(value, fallback);
}

function normalizeYearMatchKey(value: unknown): string {
  const text = normalizeText(value);
  if (text.includes("全生命周期") || text.includes("合计")) return "lifecycle";
  return text.replace(/年/g, "").replace(/\s+/g, "");
}

function yearLabelByIndex(yearIndex: number): string {
  const index = Number(yearIndex);
  const years = Array.isArray(dimensions.years) ? dimensions.years : [];
  return normalizeText(years[index], "-");
}

function getStageLabel(stageCode: string): string {
  const stage = normalizeStageCode(stageCode, "S1");
  const hit = STAGE_STEPS.find((item: any) => item.code === stage);
  return hit ? hit.label : stage;
}

function resolveSourceStageCodes(currentStageCode: string): string[] {
  const stage = normalizeStageCode(currentStageCode, "S1");
  const index = STAGE_ORDER.indexOf(stage);
  if (index < 0) return [];
  return STAGE_ORDER.slice(0, index + 1);
}

// ---- 方法 ----
function displayUiText(value: unknown) {
  return formatPeriodExpenseDisplayText(value);
}

function goBack() {
  router.back();
}

function mergeProjectWithRoute(flow: Record<string, unknown> = {}) {
  const source = flow && typeof flow === "object" ? flow : {};
  return {
    ...source,
    projectNo: normalizeText(queryProjectNo.value, source.projectNo as string),
    projectCode: normalizeText(queryProjectCode.value, (source.projectCode || source.projectNo) as string),
    projectId: normalizeText(queryProjectId.value, source.projectId as string),
    flowId: normalizeText(queryFlowId.value, (source.flowId || source.id) as string),
    projectName: normalizeText(queryProjectName.value, (source.projectName || source.projectCode) as string),
    gate: normalizeText(queryValve.value, (source.valvePoint || source.valve) as string),
    valvePoint: normalizeText(queryValve.value, (source.valvePoint || source.valve) as string),
    stage: normalizeStageCode(route.query.stage || source.node || source.stage, "S1"),
    nodeStatus: normalizeText(source.nodeStatus as string, queryNodeStatus.value),
  };
}

function buildDataCheckQuery() {
  return {
    projectId: queryProjectId.value,
    flowId: queryFlowId.value,
    projectNo: queryProjectNo.value,
    projectCode: queryProjectCode.value,
    projectName: queryProjectName.value,
    valve: queryValve.value,
    valvePoint: queryValve.value,
    stage: queryStage.value,
    permissionKey: queryPermissionKey.value,
    fullAccess: hasAllPermission.value,
    userId: route.query.user || authStore.currentUser?.id,
    userName: route.query.userName || (authStore.currentUser as any)?.name || authStore.currentUser?.displayName,
    subjectDomain: "main",
    subjectApiMode: "all",
  };
}

async function loadPage() {
  loading.value = true;
  pageMessage.value = "";
  try {
    if (!queryProjectId.value) {
      pageMessage.value = "当前链接缺少项目 ID，请从数据校核菜单重新进入。";
      return;
    }
    const payload = await fetchMainTableDataCheckSources(
      buildDataCheckQuery() as unknown as Record<string, unknown>
    );
    applyDataCheckPayload(payload);
  } catch (error) {
    console.error("[data-check] load page failed:", error);
    pageMessage.value =
      error && typeof error === "object" && "message" in error
        ? normalizeText((error as { message?: string }).message)
        : "数据校核加载失败。";
  } finally {
    loading.value = false;
  }
}

// ===== compare panel methods =====
function resetCompareControls() {
  const baseline = sourceModel.getDefaultBaselineVersionKey();
  Object.assign(
    state,
    normalizeState({
      ...state,
      baselineVersion: baseline,
      compareVersions: sourceVersions.value
        .map((item) => item.key)
        .filter((key) => key !== baseline),
      viewMode: "compare",
      activeYears: defaultYearIndexes.value.slice(),
      activeYearsUserSelected: false,
      activeTrims: [getDefaultTrimIndex()],
      deltaMode: false,
      autoDiff: true,
    })
  );
}

function onBaselineVersionChange() {
  Object.assign(
    state,
    normalizeState({
      ...state,
      compareVersions: (state.compareVersions || []).filter(
        (key) => key !== state.baselineVersion
      ),
    })
  );
}

function onCompareVersionsChange() {
  const compare = Array.isArray(state.compareVersions) ? state.compareVersions : [];
  if (compare.includes(ADD_HISTORY_VALVE_OPTION_KEY)) {
    state.compareVersions = compare.filter((key) => key !== ADD_HISTORY_VALVE_OPTION_KEY);
    openHistoryValveDialog();
    return;
  }
  if (compare.includes(OTHER_PROJECT_OPTION_KEY)) {
    state.compareVersions = compare.filter((key) => key !== OTHER_PROJECT_OPTION_KEY);
    openOtherProjectDialog();
    return;
  }
  Object.assign(state, normalizeState(state));
}

function onViewModeChange() {
  state.activeTrims = [getDefaultTrimIndex()];
  Object.assign(state, normalizeState(state));
}

function onYearChange() {
  Object.assign(
    state,
    normalizeState({
      ...state,
      activeYearsUserSelected: true,
    })
  );
}

// ===== table style helpers =====
function versionHeadStyle(versionKey: string): Record<string, string> {
  return versionKey === state.baselineVersion
    ? { color: "var(--g-focus)", fontWeight: "700" }
    : {};
}

function isFrozenCompareVersion(key: string): boolean {
  return key === state.baselineVersion;
}

function yearHeadStyle(_yearIndex: number): Record<string, string> {
  return {};
}

function sectionFillCellClass(column: ColumnDef): string[] {
  const classes: string[] = ["section-fill-cell"];
  if (isFrozenCompareColumn(column)) classes.push("is-frozen-value-cell");
  return classes;
}

function compareCellStyle(column: ColumnDef): Record<string, string> {
  if (!column) return {};
  return {};
}

function hasDiff(item: SubjectItem, column: ColumnDef): boolean {
  const yearIndex = Number.isInteger(Number(column.yearIndex))
    ? Number(column.yearIndex)
    : 0;
  const baseTrim = getDefaultTrimIndex();
  const base = getVersionValue(item, state.baselineVersion, baseTrim, yearIndex);
  const current = getVersionValue(item, column.versionKey, column.trimIndex, yearIndex);
  if (base == null || current == null) return false;
  return Math.abs(current - base) >= 0.005;
}

function getVersionMeta(key: string): VersionMeta | { key: string; label: string; dot: string } {
  return allVersionMap.value[key] || { key, label: key, dot: "stage" };
}

function isFrozenCompareColumn(column: ColumnDef): boolean {
  return column?.versionKey === state.baselineVersion;
}

function formatSubjectGroupLabel(group: SubjectGroup): string {
  const name = displayUiText(normalizeText(group.group || group.name, "分组"));
  const unit = normalizeText(group.unit);
  return unit ? `${name}（${unit}）` : name;
}

function isMeetingModuleLoading(): boolean {
  return false;
}

function isMeetingModuleError(): boolean {
  return false;
}

function retryMeetingModule(): void {
  loadPage();
}

function getManualRowHighlightKey(row: DisplaySubjectRow): string {
  if (!row || row.type !== "item" || !row.item) return "";
  const subjectId = normalizeText(
    row.item.templateId || row.item.id || row.item.subjectId || row.item.subjectCode
  );
  return subjectId ? `subject_${subjectId}` : "";
}

function getManualCellHighlightKey(
  row: DisplaySubjectRow,
  column: ColumnDef,
  mode = "compare"
): string {
  const rowKey = getManualRowHighlightKey(row);
  if (!rowKey || !column) return "";
  const columnKey = normalizeText(
    column.columnKey ||
      [column.versionKey, column.yearIndex, column.trimIndex]
        .filter((item) => item != null)
        .join("_")
  );
  return columnKey ? `${normalizeText(mode, "compare")}_${rowKey}_${columnKey}` : "";
}

function isManualRowHighlighted(row: DisplaySubjectRow): boolean {
  const key = getManualRowHighlightKey(row);
  return Boolean(key && manualRowHighlights[key]);
}

function isSubjectCollapseParent(subjectId: string): boolean {
  return subjectId === FIXED_FEE_PARENT_SUBJECT_ID;
}

function isSubjectCollapsed(subjectId: string): boolean {
  return !!subjectCollapseState[subjectId];
}

function toggleSubjectCollapse(subjectId: string): void {
  subjectCollapseState[subjectId] = !subjectCollapseState[subjectId];
}

function toggleManualRowHighlight(row: DisplaySubjectRow): void {
  const key = getManualRowHighlightKey(row);
  if (!key) return;
  manualRowHighlights[key] = !manualRowHighlights[key];
}

function compareCellClass(item: SubjectItem, column: ColumnDef): string[] {
  const classes: string[] = ["num-cell"];
  if (column.isBaseline) {
    classes.push("baseline");
  } else {
    classes.push("compare");
  }
  const meta = getVersionMeta(column.versionKey);
  if (meta && meta.dot) {
    classes.push(`dot-${meta.dot}`);
  }
  if (isFrozenCompareColumn(column)) {
    classes.push("is-frozen-value-cell");
  }
  if (state.autoDiff && !column.isBaseline && hasDiff(item, column)) {
    classes.push("diff-auto");
  }
  return classes;
}

function isManualCellHighlighted(
  row: DisplaySubjectRow,
  column: ColumnDef,
  mode = "compare"
): boolean {
  const key = getManualCellHighlightKey(row, column, mode);
  return Boolean(key && manualCellHighlights[key]);
}

function toggleManualCellHighlight(
  row: DisplaySubjectRow,
  column: ColumnDef,
  mode = "compare"
): void {
  const key = getManualCellHighlightKey(row, column, mode);
  if (!key) return;
  manualCellHighlights[key] = !manualCellHighlights[key];
}

// ===== 取数引擎 =====
function compareCellText(item: SubjectItem, column: ColumnDef): string {
  const yearIndex = Number.isInteger(Number(column.yearIndex))
    ? Number(column.yearIndex)
    : 0;
  const baseTrim = getDefaultTrimIndex();
  const baseValue = getVersionValue(item, state.baselineVersion, baseTrim, yearIndex);
  const currentValue = getVersionValue(
    item,
    column.versionKey,
    column.trimIndex,
    yearIndex
  );
  if (state.deltaMode && !column.isBaseline) {
    if (currentValue == null || baseValue == null) return "-";
    const delta = roundNumber(currentValue - baseValue);
    if (delta == null) return "-";
    return formatSignedNumber(delta, item);
  }
  return formatNumber(currentValue, item);
}

function detailCellText(item: SubjectItem, trimIndex: number, yearIndex: number): string {
  const value = getVersionValue(item, state.baselineVersion, trimIndex, yearIndex);
  return formatNumber(value, item);
}

function formatSignedNumber(value: number, item: SubjectItem): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  const prefix = num > 0 ? "+" : "";
  return `${prefix}${formatRevenueTableCellValue(item, num)}`;
}

// ===== calculator drawer =====
function openCalcDrawer() {
  calcEditableFields.value = buildSourceCalcEditableFields(subjects.value) as typeof calcEditableFields.value;
  if (!state.calcBaseVersion) {
    state.calcBaseVersion = state.baselineVersion;
  }
  ensureStateAfterVersionChange();
  calcDrawerVisible.value = true;
}

function buildBaseSnapshot(versionKey?: string, yearIndex: number | string = state.calcBaseYear) {
  const snapshot: Record<string, unknown> = {};
  const baseYearIndex = Number.isInteger(Number(yearIndex)) ? Number(yearIndex) : 0;
  const resolvedVersionKey = normalizeText(versionKey, state.baselineVersion);
  subjects.value.forEach((group) => {
    (group.items || []).forEach((item) => {
      const key = normalizeText(item.templateId || item.id);
      if (!key) return;
      const value = getVersionValue(
        item,
        resolvedVersionKey,
        getDefaultTrimIndex(),
        baseYearIndex
      );
      if (value != null) snapshot[key] = value;
    });
  });
  return snapshot;
}

function parseCalcFormulaNumber(value: unknown): number | null {
  if (
    value == null ||
    String(value).trim() === "" ||
    String(value).trim() === "-"
  ) {
    return null;
  }
  const text = String(value).trim().replace(/,/g, "");
  const num = Number(text.replace(/[%％]$/, ""));
  return Number.isFinite(num) ? num : null;
}

function roundCalcFormulaNumber(value: number, precision = 4): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const base = Math.pow(10, precision);
  return Math.round(num * base) / base;
}

function isProjectProfitCalcRow(row: Record<string, unknown> = {}): boolean {
  const path = [
    Array.isArray(row.subjectPath) ? row.subjectPath.join("/") : row.subjectPath,
    row.fullNamePath,
    row.rootSubjectName,
  ]
    .map((item) => normalizeText(item))
    .join("/");
  return path.includes("项目利润");
}

function isPerVehicleCalcRow(row: Record<string, unknown> = {}): boolean {
  if (isProjectProfitCalcRow(row)) return false;
  const path = [
    Array.isArray(row.subjectPath) ? row.subjectPath.join("/") : row.subjectPath,
    row.fullNamePath,
    row.rootSubjectName,
  ]
    .map((item) => normalizeText(item))
    .join("/");
  return path.includes("单车收益") || path.includes("单车");
}

function normalizeCalcSubjectName(row: Record<string, unknown> = {}): string {
  return normalizeText(row.subjectName || row.subject || row.name)
    .replace(/^[\s\u3000]+/, "")
    .replace(/[（()）]/g, "")
    .replace(/[%％]/g, "");
}

/** 优先取单车收益行的单元格，避免项目利润同名科目抢键 */
function pickSingleCalcAmount(
  rows: Record<string, unknown>[] = [],
  seed: Record<string, unknown> = {},
  templateId = "",
  subjectName = "",
  options: { allowProject?: boolean } = {},
): number | null {
  const expectedId = normalizeText(templateId);
  const expectedName = normalizeText(subjectName);
  const allowProject = options.allowProject === true;
  let fallback: number | null = null;
  let preferred: number | null = null;
  rows.forEach((row) => {
    const id = normalizeText(row && row.templateId);
    const name = normalizeCalcSubjectName(row);
    const idMatch = Boolean(expectedId && id === expectedId);
    const nameMatch = Boolean(expectedName && name === expectedName);
    if (!idMatch && !nameMatch) return;
    if (!allowProject && isProjectProfitCalcRow(row)) return;
    const cells =
      row && row.cells && typeof row.cells === "object"
        ? (row.cells as Record<string, unknown>)
        : {};
    let value = parseCalcFormulaNumber(cells.y0_t0);
    // 公式把单元格写成 0 时，回退主表快照，避免打开计算器初始值被冲掉
    if (value == null || Number(value) === 0) {
      const seedValue =
        parseCalcFormulaNumber(id ? seed[id] : undefined) ??
        parseCalcFormulaNumber(seed[expectedId]);
      if (seedValue != null && (value == null || Number(seedValue) !== 0)) {
        value = seedValue;
      }
    }
    if (value == null) return;
    fallback = value;
    if (isPerVehicleCalcRow(row) || (allowProject && isProjectProfitCalcRow(row))) {
      preferred = value;
    }
  });
  if (preferred != null) return preferred;
  if (fallback != null) return fallback;
  return parseCalcFormulaNumber(seed[expectedId]);
}

function firstFiniteNonZero(values: unknown[] = []): number | null {
  for (let index = 0; index < values.length; index += 1) {
    const num = parseCalcFormulaNumber(values[index]);
    if (num != null && Number(num) !== 0) return num;
  }
  return null;
}

/**
 * 对齐 Vue2 现场测算公式：
 * - 边际贡献率 = 边际贡献/销售收入
 * - 营业利润率 = 营业利润/销售收入
 * - 项目销售收入/边际贡献/营业利润 = 对应单车金额 * 销量
 */
function applySingleCalcRatioAliases(
  result: Record<string, unknown>,
  rows: Record<string, unknown>[] = [],
  seed: Record<string, unknown> = {},
) {
  const margin =
    pickSingleCalcAmount(rows, seed, "margin", "边际贡献") ??
    parseCalcFormulaNumber(result.margin);
  const opProfit =
    pickSingleCalcAmount(rows, seed, "op_profit", "营业利润") ??
    parseCalcFormulaNumber(result.op_profit);
  let revenue = firstFiniteNonZero([
    pickSingleCalcAmount(rows, seed, "revenue", "销售收入"),
    seed.revenue,
    result.revenue,
  ]);
  if (revenue == null) {
    const dealer = firstFiniteNonZero([
      pickSingleCalcAmount(rows, seed, "dealer", "经销商底价含税"),
      seed.dealer,
      result.dealer,
    ]);
    if (dealer != null) revenue = dealer / 1.13;
  }
  if (revenue == null) {
    const tp = firstFiniteNonZero([
      pickSingleCalcAmount(rows, seed, "tp", "TP价含税"),
      seed.tp,
      result.tp,
    ]);
    if (tp != null) revenue = tp / 1.13;
  }
  if (revenue != null && Number(revenue) !== 0) {
    if (margin != null) {
      const rate = roundCalcFormulaNumber(Number(margin) / Number(revenue), 4);
      if (rate != null) result.margin_rate = rate;
    }
    if (opProfit != null) {
      const rate = roundCalcFormulaNumber(Number(opProfit) / Number(revenue), 4);
      if (rate != null) result.op_rate = rate;
    }
    result.revenue = revenue;
  }
  const volume = firstFiniteNonZero([
    pickSingleCalcAmount(rows, seed, "proj_vol", "销量", { allowProject: true }),
    seed.proj_vol,
    result.proj_vol,
  ]);
  if (volume != null && Number(volume) !== 0) {
    if (revenue != null) {
      const value = roundCalcFormulaNumber(Number(revenue) * Number(volume), 4);
      if (value != null) result.proj_rev = value;
    }
    if (margin != null) {
      const value = roundCalcFormulaNumber(Number(margin) * Number(volume), 4);
      if (value != null) result.proj_margin = value;
    }
    if (opProfit != null) {
      const value = roundCalcFormulaNumber(Number(opProfit) * Number(volume), 4);
      if (value != null) result.proj_profit = value;
    }
  }
  return result;
}

/** 保留数组或 JSON 字符串绑定，避免现场测算公式参数被清空 */
function resolveCalcFormulaParamBindings(
  meta: Record<string, unknown> = {},
  item: SubjectItem | Record<string, unknown> = {},
) {
  const candidates = [meta.formulaParamBindings, (item as SubjectItem).formulaParamBindings];
  for (let index = 0; index < candidates.length; index += 1) {
    const value = candidates[index];
    if (Array.isArray(value) && value.length) return value;
    if (typeof value === "string" && value.trim()) return value;
  }
  for (let index = 0; index < candidates.length; index += 1) {
    const value = candidates[index];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function buildCalcFormulaDetail(values: Record<string, unknown> = {}) {
  const year = "现场测算";
  const trimId = "calc";
  const trimName = "现场测算";
  const rows: Record<string, unknown>[] = [];
  subjects.value.forEach((group) => {
    const groupName = normalizeText(group && (group.group || group.name));
    (group.items || []).forEach((item) => {
      const templateId = normalizeText(item && (item.templateId || item.id));
      const subjectId = normalizeText(item && item.subjectId);
      const valueKey = Object.prototype.hasOwnProperty.call(values, templateId)
        ? templateId
        : subjectId;
      const rawValue = Object.prototype.hasOwnProperty.call(values, valueKey)
        ? values[valueKey]
        : "";
      const subjectName = normalizeText(item && item.name).replace(/^[\s\u3000]+/, "");
      const subjectPath = resolveCalcSubjectPath(item, group);
      const meta = (resolveCalcSubjectMeta(item, group) || {}) as Record<string, any>;
      const resolvedFormulaExpression = normalizeText(
        meta.formulaExpression || item.formulaExpression || item.expression,
      );
      const isRateSubject =
        templateId === "margin_rate" ||
        templateId === "op_rate" ||
        subjectName === "边际贡献率" ||
        subjectName === "营业利润率";
      // 对齐 Vue2：不要把录入行强改成 CALCULATED，否则打开计算器时会把主表基准值冲成 0
      // 比率行仍不走公式引擎，后面用单车金额补算
      const resolvedEntryMode = normalizeText(meta.entryMode, item.entryMode);
      const rowKind = normalizeText(
        item.rowKind || item.rowType,
        meta.formulaKey ? meta.rowKind : REVENUE_ROW_KIND.INPUT,
      );
      rows.push({
        ...item,
        id: subjectId || templateId,
        rowId: subjectId || templateId,
        templateId,
        subjectId,
        subjectCode: normalizeText(item.subjectCode),
        subject: subjectName,
        subjectName,
        subjectPath,
        fullNamePath: subjectPath,
        rootSubjectName: groupName,
        subtable: "主表",
        moduleCode: REVENUE_MODULE_CODE.MAIN_PNL,
        rowKind,
        valueSource: normalizeText(
          item.valueSource || item.sourceType,
          rowKind === REVENUE_ROW_KIND.INPUT
            ? REVENUE_VALUE_SOURCE.INPUT
            : meta.valueSource,
        ),
        inputType: normalizeText(item.inputType),
        unit: normalizeText(item.unit, group.unit),
        entryMode: resolvedEntryMode,
        templateEntryMode: normalizeText(
          meta.templateEntryMode || resolvedEntryMode || item.templateEntryMode || item.entryMode,
        ),
        formulaId: isRateSubject ? undefined : meta.formulaId || item.formulaId,
        formulaKey: isRateSubject
          ? ""
          : normalizeText(meta.formulaKey || item.formulaKey || item.formulaCode),
        formulaCode: isRateSubject
          ? ""
          : normalizeText(meta.formulaCode || item.formulaCode || item.formulaKey),
        formulaName: normalizeText(meta.formulaName || item.formulaName),
        formulaExpression: isRateSubject ? "" : resolvedFormulaExpression,
        formulaParamBindings: isRateSubject ? [] : resolveCalcFormulaParamBindings(meta, item),
        cells: {
          y0_t0: rawValue == null ? "" : rawValue,
        },
        cellMap: {
          [`${year}__${trimId}`]: rawValue == null ? "" : rawValue,
          [`${year}__${trimName}`]: rawValue == null ? "" : rawValue,
        },
      });
    });
  });
  return {
    dimensions: {
      years: [year],
      trims: [{ trimId, trimName, name: trimName }],
    },
    rows,
  };
}

function extractCalcFormulaValues(
  detail: { rows?: Record<string, unknown>[] },
  seed: Record<string, unknown> = {},
) {
  const result = { ...seed };
  const sourceRows = detail?.rows;
  const rows: Record<string, unknown>[] = Array.isArray(sourceRows)
    ? sourceRows
    : [];
  rows.forEach((row) => {
    const key = normalizeText(row && row.templateId);
    if (!key) return;
    const cells =
      row && row.cells && typeof row.cells === "object"
        ? (row.cells as Record<string, unknown>)
        : {};
    const value = parseCalcFormulaNumber(cells.y0_t0);
    if (value == null) return;
    const seedValue = parseCalcFormulaNumber(result[key]);
    // 对齐 Vue2：缺子表绑定时公式会写成 0，不能覆盖主表快照里的基准值
    if (Number(value) === 0 && seedValue != null && Number(seedValue) !== 0) return;
    result[key] = value;
  });
  return applySingleCalcRatioAliases(result, rows, seed);
}

/** 对齐 Vue2 data-check：通过主表公式引擎测算，而非错误的三参数调用 */
function computeCalcValues(values: Record<string, unknown> = {}) {
  const result = { ...values };
  try {
    const detail = buildCalcFormulaDetail(result);
    applyRevenueFormulasToDetail(detail, {
      targetModuleCode: REVENUE_MODULE_CODE.MAIN_PNL,
      // 现场计算器只有主表：缺子表绑定时跳过该行，不中断整次测算（否则金额会全变成 0）
      calculationMode: REVENUE_FORMULA_CALCULATION_MODE.MAIN_AUDIT,
      ignoreMissingFormulaBindings: true,
    });
    return extractCalcFormulaValues(detail, result);
  } catch (error) {
    console.warn("[data-check] calc formula failed:", error);
    return result;
  }
}

function persistCalcDraft() {
  ensureStateAfterVersionChange();
  return Promise.resolve({ ok: true });
}

function formatNumber(value: unknown, item?: SubjectItem): string {
  return formatRevenueTableCellValue(item || {}, value);
}

function safeNumber(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const num = Number(String(value).replace(/,/g, "").replace(/[%％]$/, ""));
  return Number.isFinite(num) ? num : null;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function resolveCalcSubjectPath(item: SubjectItem, group: SubjectGroup): string {
  return resolveSourceCalcSubjectPath(item, group);
}

function resolveCalcSubjectMeta(item: SubjectItem, group: SubjectGroup) {
  return resolveSourceCalcSubjectMeta(item, group);
}

function ensureStateAfterVersionChange() {
  Object.assign(state, normalizeState(state));
}

// ===== history valve =====
function extractValvePointValue(value: unknown): string {
  if (value == null) return "";
  const valueType = typeof value;
  if (valueType === "string" || valueType === "number") return String(value);
  if (valueType !== "object") return "";
  const record = value as Record<string, unknown>;
  return normalizeText(
    record.valvePoint ||
      record.valveName ||
      record.valveCode ||
      record.name ||
      record.code ||
      record.gate ||
      extractValvePointValue(record.valve)
  );
}

function normalizeValvePoint(value: unknown): string {
  return normalizeText(extractValvePointValue(value)).replace(/\s+/g, "").toUpperCase();
}

function getValveSortScore(value: string): number {
  const text = normalizeValvePoint(value);
  const hit = text.match(/^G(\d+)$/i);
  return hit && hit[1] ? Number(hit[1]) : Number.MAX_SAFE_INTEGER;
}

function buildHistoryValveOption(value: unknown) {
  const valvePoint = normalizeValvePoint(value);
  if (!valvePoint) return null;
  return {
    label: `${valvePoint}阀点`,
    value: valvePoint,
  };
}

function mergeHistoryValveOptions(valveRows: unknown[] = []) {
  const map: Record<string, { label: string; value: string }> = {};
  const pushOption = (value: unknown) => {
    const option = buildHistoryValveOption(value);
    if (!option || map[option.value]) return;
    map[option.value] = option;
  };
  (Array.isArray(valveRows) ? valveRows : []).forEach((row) => {
    pushOption(extractValvePointValue(row));
  });
  const currentValve = normalizeValvePoint(project.gate || queryValve.value);
  return Object.values(map)
    .filter((item) => item.value !== currentValve)
    .sort((a, b) => {
      const aScore = getValveSortScore(a.value);
      const bScore = getValveSortScore(b.value);
      if (aScore !== bScore) return aScore - bScore;
      return a.value.localeCompare(b.value);
    });
}

async function loadHistoryValveOptions() {
  historyValveLoading.value = true;
  try {
    const valveRows = await getValveList({
      pageNum: 1,
      pageSize: 999999,
    });
    historyValveOptions.value = mergeHistoryValveOptions(valveRows as unknown[]);
  } catch (error) {
    console.warn("[data-check] load history valve options failed:", error);
    historyValveOptions.value = [];
  } finally {
    historyValveLoading.value = false;
  }
}

function openHistoryValveDialog() {
  historyValveDialogVisible.value = true;
  historyValvePickerValue.value = "";
  loadHistoryValveOptions();
}

const OTHER_PROJECT_FLOW_PAGE_SIZE = 200;
const OTHER_PROJECT_FLOW_MAX_PAGES = 50;

function extractFlowListRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const source = payload && typeof payload === "object"
    ? payload as Record<string, unknown>
    : {};
  if (Array.isArray(source.data)) return source.data as Record<string, unknown>[];
  const nested = source.data && typeof source.data === "object"
    ? source.data as Record<string, unknown>
    : source;
  const list = nested.records || nested.rows || nested.list || source.records || source.rows || [];
  return Array.isArray(list) ? list as Record<string, unknown>[] : [];
}

function extractFlowListTotal(payload: unknown, fallback = 0): number {
  if (Array.isArray(payload)) return payload.length;
  const source = payload && typeof payload === "object"
    ? payload as Record<string, unknown>
    : {};
  const nested = source.data && typeof source.data === "object" && !Array.isArray(source.data)
    ? source.data as Record<string, unknown>
    : source;
  const total = Number(nested.total ?? source.total ?? fallback);
  return Number.isFinite(total) && total >= 0 ? total : fallback;
}

async function fetchAllOtherProjectFlowRows() {
  const rows: Record<string, unknown>[] = [];
  let pageNum = 1;
  let total = Number.POSITIVE_INFINITY;
  while (pageNum <= OTHER_PROJECT_FLOW_MAX_PAGES && rows.length < total) {
    const payload = await queryRevenueProjectPage({
      pageNum,
      pageSize: OTHER_PROJECT_FLOW_PAGE_SIZE,
    });
    const pageRows = extractFlowListRows(payload);
    rows.push(...pageRows);
    total = extractFlowListTotal(payload, rows.length);
    if (!pageRows.length || pageRows.length < OTHER_PROJECT_FLOW_PAGE_SIZE) {
      break;
    }
    pageNum += 1;
  }
  return rows;
}

function normalizeProjectIdValue(value: unknown): string {
  const text = normalizeText(value);
  return /^\d+$/.test(text) ? text : "";
}

function sortValveOptions(options: { label: string; value: string }[] = []) {
  return options.slice().sort((a, b) => {
    const aScore = getValveSortScore(a.value);
    const bScore = getValveSortScore(b.value);
    if (aScore !== bScore) return aScore - bScore;
    return a.value.localeCompare(b.value);
  });
}

function mergeOtherProjectOptions(rows: Record<string, unknown>[] = [], currentProjectId = "") {
  const map: Record<string, OtherProjectOption> = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const projectId = normalizeProjectIdValue(row.projectId || row.project_id);
    if (!projectId || projectId === currentProjectId) return;
    const projectCode = normalizeText(row.projectCode || row.projectNo || row.wbsNumber);
    const projectName = normalizeText(row.projectName || row.project);
    const valveOption = buildHistoryValveOption(row.valvePoint || row.valve);
    if (!map[projectId]) {
      const displayName = projectCode && projectName && projectCode !== projectName
        ? `${projectCode} · ${projectName}`
        : (projectCode || projectName || projectId);
      map[projectId] = {
        projectId,
        projectCode,
        projectName,
        label: displayName,
        valves: [],
      };
    }
    if (valveOption && !map[projectId].valves.some((item) => item.value === valveOption.value)) {
      map[projectId].valves.push(valveOption);
    }
  });
  return Object.values(map)
    .map((item) => ({
      ...item,
      valves: sortValveOptions(item.valves),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}

function findSelectedOtherProject() {
  return otherProjectOptions.value.find(
    (item) => item.projectId === otherProjectPickerValue.value
  ) || null;
}

async function loadGlobalValveOptionsForOtherProject() {
  try {
    const valveRows = await getValveList({
      pageNum: 1,
      pageSize: 999999,
    });
    const map: Record<string, { label: string; value: string }> = {};
    (Array.isArray(valveRows) ? valveRows : []).forEach((row) => {
      const option = buildHistoryValveOption(extractValvePointValue(row));
      if (!option || map[option.value]) return;
      map[option.value] = option;
    });
    otherProjectValveOptions.value = sortValveOptions(Object.values(map));
  } catch (error) {
    console.warn("[data-check] load other project valve options failed:", error);
    otherProjectValveOptions.value = [];
  }
}

async function onOtherProjectPickerChange() {
  otherProjectValvePickerValue.value = "";
  const selected = findSelectedOtherProject();
  if (!selected) {
    otherProjectValveOptions.value = [];
    return;
  }
  if (selected.valves.length) {
    otherProjectValveOptions.value = selected.valves;
    return;
  }
  otherProjectLoading.value = true;
  try {
    await loadGlobalValveOptionsForOtherProject();
  } finally {
    otherProjectLoading.value = false;
  }
}

async function loadOtherProjectOptions() {
  otherProjectLoading.value = true;
  try {
    // 流程列表后端限制每页最多 200 条，这里分页拉全量后再按项目去重。
    const flowRows = await fetchAllOtherProjectFlowRows();
    otherProjectOptions.value = mergeOtherProjectOptions(
      flowRows,
      queryProjectId.value
    );
    if (!otherProjectOptions.value.length) {
      BaseToast.info("暂无其他可对比项目");
    }
  } catch (error) {
    console.warn("[data-check] load other project options failed:", error);
    otherProjectOptions.value = [];
  } finally {
    otherProjectLoading.value = false;
  }
}

function openOtherProjectDialog() {
  otherProjectDialogVisible.value = true;
  otherProjectPickerValue.value = "";
  otherProjectValvePickerValue.value = "";
  otherProjectValveOptions.value = [];
  loadOtherProjectOptions();
}

function collectPayloadSources(payload: unknown): Record<string, unknown>[] {
  const source = payload && typeof payload === "object"
    ? payload as { sources?: unknown[]; source?: unknown }
    : {};
  if (Array.isArray(source.sources) && source.sources.length) {
    return source.sources as Record<string, unknown>[];
  }
  return source.source ? [source.source as Record<string, unknown>] : [];
}

async function confirmAddHistoryValveVersion() {
  const valvePoint = normalizeValvePoint(historyValvePickerValue.value);
  if (!valvePoint) {
    BaseToast.warning("请选择阀点");
    return;
  }
  historyValveLoading.value = true;
  try {
    const payload = await fetchMainTableDataCheckHistoryValveSource({
      ...buildDataCheckQuery(),
      historyValvePoint: valvePoint,
      targetValvePoint: valvePoint,
    } as unknown as Record<string, unknown>);
    if (!payload || !(payload as { hasMainPermission?: boolean }).hasMainPermission) {
      BaseToast.warning("当前用户没有可用主表科目权限，无法添加历史阀点数据。");
      return;
    }
    if ((payload as { subjectTreeEmpty?: boolean }).subjectTreeEmpty) {
      BaseToast.warning("当前项目暂无可用主表科目。");
      return;
    }
    const payloadSources = Array.isArray((payload as { sources?: unknown[] }).sources)
      && (payload as { sources: unknown[] }).sources.length
      ? (payload as { sources: unknown[] }).sources
      : ((payload as { source?: unknown }).source ? [(payload as { source: unknown }).source] : []);
    if (!payloadSources.length) {
      BaseToast.warning(`${valvePoint}阀点暂无主表数据。`);
      return;
    }
    payloadSources.forEach((source) => {
      upsertCompareSource(source as Record<string, unknown>);
    });
    historyValveDialogVisible.value = false;
    pageMessage.value = "";
    const successLabel = payloadSources.length === 1
      ? normalizeText((payloadSources[0] as { label?: string }).label, `${valvePoint}阀点数据`)
      : `${valvePoint}阀点${payloadSources.length}个数据源`;
    BaseToast.success(`已添加${successLabel}`);
  } catch (error) {
    console.warn("[data-check] load history valve source failed:", error);
    BaseToast.error(`${valvePoint}阀点数据加载失败`);
  } finally {
    historyValveLoading.value = false;
  }
}

async function confirmAddOtherProjectVersion() {
  const selected = findSelectedOtherProject();
  if (!selected) {
    BaseToast.warning("请选择对比项目");
    return;
  }
  const valvePoint = normalizeValvePoint(otherProjectValvePickerValue.value);
  if (!valvePoint) {
    BaseToast.warning("请选择阀点");
    return;
  }
  otherProjectLoading.value = true;
  try {
    const payload = await fetchMainTableDataCheckOtherProjectSource({
      ...buildDataCheckQuery(),
      targetProjectId: selected.projectId,
      projectId: selected.projectId,
      flowId: null,
      id: null,
      targetProjectCode: selected.projectCode,
      targetProjectNo: selected.projectCode,
      targetProjectName: selected.projectName,
      projectCode: selected.projectCode,
      projectNo: selected.projectCode,
      projectName: selected.projectName,
      historyValvePoint: valvePoint,
      targetValvePoint: valvePoint,
    } as unknown as Record<string, unknown>);
    if (!payload || !(payload as { hasMainPermission?: boolean }).hasMainPermission) {
      BaseToast.warning("当前用户没有可用主表科目权限，无法导入其他项目数据。");
      return;
    }
    if ((payload as { subjectTreeEmpty?: boolean }).subjectTreeEmpty) {
      BaseToast.warning("所选项目暂无可用主表科目。");
      return;
    }
    const payloadSources = collectPayloadSources(payload);
    if (!payloadSources.length) {
      BaseToast.warning(`${selected.label} ${valvePoint}阀点暂无主表数据。`);
      return;
    }
    payloadSources.forEach((source) => {
      upsertCompareSource(alignCompareSourceSubjects(source, subjects.value));
    });
    otherProjectDialogVisible.value = false;
    pageMessage.value = "";
    const successLabel = payloadSources.length === 1
      ? normalizeText(payloadSources[0].label as string, `${selected.label} · ${valvePoint}阀点数据`)
      : `${selected.label} ${valvePoint}阀点${payloadSources.length}个数据源`;
    BaseToast.success(`已导入${successLabel}`);
  } catch (error) {
    console.warn("[data-check] load other project source failed:", error);
    BaseToast.error(`${selected.label} ${valvePoint}阀点数据加载失败`);
  } finally {
    otherProjectLoading.value = false;
  }
}

// ===== 生命周期 =====
onMounted(() => {
  loadPage();
});

void _sourceVersionMap.value;
</script>

<style lang="scss" scoped>
@use "../styles/revenue-visual-spec-g.scss" as *;

.data-check-detail {
  --g-bg: #fafaf9;
  --g-surface: #ffffff;
  --g-line: #e7e5e4;
  --g-line-strong: #d6d3d1;
  --g-text: #0c0a09;
  --g-text-2: #44403c;
  --g-text-3: #78716c;
  --g-focus: #0071e3;
  --g-radius-sm: 4px;
  --g-radius-md: 6px;
  --g-radius-lg: 10px;
  --g-shadow-xs: 0 0 0 1px rgba(12, 10, 9, 0.04);
  --g-font-sans: "PingFang SC", "Inter", "Microsoft YaHei", -apple-system, sans-serif;
  --g-font-mono: "SF Mono", "JetBrains Mono", "Roboto Mono", monospace;

  max-width: 1480px;
  margin: 0 auto;
  border: 1px solid var(--g-line);
  border-radius: var(--g-radius-lg);
  background: var(--g-surface);
  box-shadow: var(--g-shadow-xs);
  padding-bottom: 18px;
  color: var(--g-text);
  font-family: var(--g-font-sans);

  &.rv-list-card {
    overflow: visible;
  }
}

.hero-header {
  border-bottom: 1px solid var(--g-line);
  background: linear-gradient(180deg, var(--g-surface), #fbfcff);
  border-radius: var(--g-radius-lg) var(--g-radius-lg) 0 0;
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 30;
  box-shadow: 0 6px 16px rgba(12, 10, 9, 0.08);
}

.hero-left {
  min-width: 0;
}

.hero-id {
  font-family: var(--g-font-mono);
  font-size: clamp(18px, 2vw, 24px);
  line-height: 1.25;
  font-weight: 700;
  color: var(--g-text);
  word-break: break-word;
}

.hero-id-meta {
  margin-top: 4px;
  font-size: 13px;
  color: var(--g-text-3);
  line-height: 1.4;
}

.hero-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}

:deep(.hero-actions .el-button) {
  margin-left: 0;
}

.card-block {
  margin: 10px 18px 0;
  border: 1px solid var(--g-line);
  border-radius: var(--g-radius-md);
  background: var(--g-surface);
  padding: 14px;
  box-shadow: var(--g-shadow-xs);
}

.source-card {
  display: grid;
  gap: 10px;
}

.source-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.block-title {
  margin-bottom: 4px;
  font-size: 13px;
  color: var(--g-text-2);
  font-weight: 700;
}

.source-note {
  color: var(--g-text-3);
  font-size: 12px;
  line-height: 1.5;
}

.source-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.source-empty {
  color: var(--g-text-3);
  font-size: 12px;
}

.page-message {
  margin: 10px 18px 0;
  width: auto;
}

@media (max-width: 768px) {
  .hero-header,
  .source-head {
    flex-direction: column;
  }

  .hero-actions {
    margin-left: 0;
  }

  .card-block,
  .page-message {
    margin: 10px 14px 0;
  }
}
</style>
