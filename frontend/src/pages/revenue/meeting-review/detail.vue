<template>
  <section
    ref="pageHost"
    v-loading="loading"
    class="meeting-review-detail main-table-compare-fullscreen-host rev-impact-theme rv-card rv-list-card"
  >
    <section class="hero-header">
      <div class="hero-left">
        <div>
          <div class="hero-id">{{ projectHeaderIdText }}</div>
          <div class="hero-id-meta">{{ projectHeaderMetaText }}</div>
        </div>
      </div>
      <div class="hero-actions">
        <el-button size="small" @click="goBack">返回项目列表</el-button>
      </div>
    </section>

    <div class="card-block progress-card">
      <el-steps
        :active="currentStepIndex"
        finish-status="success"
        align-center
        class="review-steps"
      >
        <el-step
          v-for="(step, index) in steps"
          :key="`step_${step.code}_${index}`"
          :title="step.label"
        />
      </el-steps>
    </div>

    <div class="card-block stage-opinion-summary-card">
      <div class="block-title">各部门评审意见</div>
      <div class="stage-opinion-grid stage-opinion-grid--dept">
        <div
          v-for="card in departmentOpinionCards"
          :key="`dept_opinion_${card.code}`"
          class="stage-opinion-item"
          :title="card.cardTooltip"
        >
          <div class="stage-opinion-head">
            <span class="stage-opinion-code">{{
              formatDepartmentOpinionOrder(card.order)
            }}</span>
            <b class="stage-opinion-label">{{ card.label }}</b>
          </div>
          <div v-if="card.hasOperation" class="stage-opinion-entry">
            <div class="stage-opinion-entry-time">
              {{ card.operationTime || "-" }}
            </div>
            <div v-if="card.operationMeta" class="stage-opinion-entry-meta">
              {{ card.operationMeta }}
            </div>
            <div class="stage-opinion-entry-opinion">
              {{ card.operationOpinion || "已记录评审，无文字意见" }}
            </div>
          </div>
          <div v-else class="stage-opinion-empty">暂无记录</div>
        </div>
      </div>
    </div>

    <MeetingReviewVisualSummary
      :versions="meetingVisualSummaryVersions"
      :chart-versions="meetingVisualSummaryChartVersions"
      :subjects="subjects"
      :dimensions="dimensions"
      :selected-year-indexes="selectedYearIndexes"
      :default-trim-index="defaultTrimIndex"
      :primary-version-key="state.decisionSource"
      :loading="meetingVisualSummaryLoading"
      :get-version-value="getVersionValue"
      :format-number="formatNumber"
    />

    <MainTableComparePanel
      :state="state"
      :fixed-baseline-version-label="fixedBaselineVersionLabel"
      :lock-baseline="true"
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
      :open-calc-drawer="openCalcDrawer"
      :show-calculator="true"
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
    />

    <div class="card-block">
      <div class="block-title">集团上会评审定值</div>

      <div class="decision-row">
        <label>定值来源</label>
        <div class="decision-source-actions">
          <el-button
            v-for="item in decisionSourceOptions"
            :key="`src_${item.key}`"
            class="source-option"
            :class="{ selected: state.decisionSource === item.key }"
            size="mini"
            :type="state.decisionSource === item.key ? 'primary' : 'default'"
            :disabled="isMeetingDecisionFrozen"
            @click="state.decisionSource = item.key"
          >
            {{ item.label }}
          </el-button>
        </div>
      </div>

      <div
        v-if="state.decisionSource === 'custom'"
        class="decision-row custom-block"
      >
        <label>自定义值及来源说明</label>
        <el-input
          v-model="state.customDecisionValue"
          placeholder="输入自定义定值"
          size="small"
          :disabled="isMeetingDecisionFrozen"
        />
        <el-input
          v-model="state.customDecisionNote"
          type="textarea"
          :rows="3"
          placeholder="必须填写来源说明与影响范围"
          style="margin-top: 8px"
          :disabled="isMeetingDecisionFrozen"
        />
      </div>

      <div class="decision-row">
        <label>会议意见</label>
        <el-input
          v-model="state.meetingOpinion"
          type="textarea"
          :rows="4"
          placeholder="委员会综合意见"
          :disabled="isMeetingDecisionFrozen"
        />
      </div>
    </div>

    <div class="review-footer">
      <div class="review-footer-left">
        <el-tag type="success" size="small">候选值已冻结</el-tag>
        <span class="freeze-time"
          >冻结时间：{{ project.freezeTime || "-" }}</span
        >
        <span v-if="decisionResult" class="decision-version">
          {{ decisionResultText }}
        </span>
      </div>
      <div class="footer-actions">
        <el-button
          v-if="showMeetingReviewExportAction"
          size="small"
          @click="handleExport"
          type="warning"
          :icon="Upload"
          >导出评审报告</el-button
        >
        <el-button
          v-if="showMeetingReviewDraftAction"
          size="small"
          @click="handleSaveDraft"
          >保存草稿</el-button
        >
        <el-button
          size="small"
          type="danger"
          plain
          :loading="meetingDecisionSubmitting"
          :disabled="isMeetingDecisionFrozen || meetingDecisionSubmitting"
          @click="handleRejectDecision"
        >
          驳回并结束流程
        </el-button>
        <el-button
          size="small"
          type="primary"
          class="heavy-confirm-btn"
          :loading="meetingDecisionSubmitting"
          :disabled="isMeetingDecisionFrozen || meetingDecisionSubmitting"
          @click="handleSubmitDecision"
        >
          确认上会值版本
        </el-button>
      </div>
    </div>

    <div class="card-block process-review-card">
      <div class="process-review-head">
        <div>
          <div class="block-title">当前流程与节点评审信息</div>
          <div class="process-review-subtitle">
            流程号：{{ currentFlowId || "-" }} · 当前节点：{{
              projectStageText || "-"
            }}
          </div>
        </div>
        <el-tag
          size="small"
          :type="
            resolveProcessStatusTagType(project.nodeStatus || queryNodeStatus)
          "
        >
          {{ nodeStatusText || project.nodeStatus || queryNodeStatus || "-" }}
        </el-tag>
      </div>

      <div class="flow-meta-grid">
        <div
          v-for="item in currentFlowMetaItems"
          :key="`flow_meta_${item.label}`"
          class="flow-meta-item"
        >
          <span>{{ item.label }}</span>
          <b>{{ item.value || "-" }}</b>
        </div>
      </div>

      <div class="node-review-list">
        <div
          v-for="item in flowReviewNodeItems"
          :id="`node-review-${item.code}`"
          :key="`node_review_${item.code}`"
          class="node-review-item"
          :class="{
            'is-current': item.isCurrent,
            'is-empty': !item.reviews.length && !item.logs.length,
          }"
        >
          <div class="node-review-main">
            <div class="node-review-title">
              <span class="node-code">{{ item.code }}</span>
              <b>{{ item.label }}</b>
              <el-tag size="mini" :type="item.statusTagType">{{
                item.statusText
              }}</el-tag>
              <el-tag
                v-if="item.isCurrent"
                size="mini"
                type="warning"
                effect="plain"
                >当前</el-tag
              >
            </div>
            <div class="node-review-meta">{{ item.summaryText }}</div>
          </div>

          <div class="node-review-body">
            <div v-if="item.reviews.length" class="review-entry-list">
              <div
                v-for="review in item.reviews"
                :key="review.key"
                class="review-entry"
              >
                <div class="review-entry-head">
                  <span>{{ review.title }}</span>
                  <em>{{ review.time || "-" }}</em>
                </div>
                <div class="review-entry-meta">
                  {{ review.reviewerText }}
                  <span v-if="review.conclusionText">
                    · {{ review.conclusionText }}</span
                  >
                  <span v-if="review.reviewStatusText">
                    · {{ review.reviewStatusText }}</span
                  >
                </div>
                <div class="review-entry-opinion">
                  {{ review.opinion || "已记录评审，无文字意见" }}
                </div>
              </div>
            </div>
            <div v-if="item.logs.length" class="flow-log-list">
              <div
                v-for="log in item.logs"
                :key="log.key"
                class="flow-log-entry"
              >
                <span>{{ log.time || "-" }}</span>
                <b>{{ log.actor || "-" }}</b>
                <em>{{ log.remark || log.statusText || "流程动作" }}</em>
              </div>
            </div>
            <div
              v-if="!item.reviews.length && !item.logs.length"
              class="node-review-empty"
            >
              暂无评审信息
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showReviewTimeline" class="card-block">
      <div class="block-title">评审留痕时间线</div>
      <ul class="timeline-list">
        <li
          v-for="(item, index) in timeline"
          :key="`timeline_${index}`"
          class="timeline-item"
          :class="{ 'is-now': index === 0 }"
        >
          <div class="timeline-head">
            <b>{{ item.action }}</b>
            <span>{{ item.time }}</span>
          </div>
          <div class="timeline-note">处理人：{{ item.actor }}</div>
          <div class="timeline-note">{{ item.note }}</div>
        </li>
      </ul>
    </div>

    <el-dialog
      v-model="historyValveDialogVisible"
      title="添加当前项目历史阀点数据"
      width="380px"
      custom-class="history-valve-dialog"
      :append-to-body="false"
    >
      <div class="history-valve-picker">
        <div class="history-valve-project">
          {{ project.projectCode || queryProjectCode }} /
          {{ project.projectName || queryProjectName || "-" }}
        </div>
        <el-select
          v-model="historyValvePickerValue"
          filterable
          size="small"
          style="width: 100%"
          placeholder="请选择阀点"
          :loading="historyValveLoading"
          :popper-append-to-body="false"
        >
          <el-option
            v-for="item in historyValveOptions"
            :key="`history_valve_${item.value}`"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button size="small" @click="historyValveDialogVisible = false"
            >取消</el-button
          >
          <el-button
            type="primary"
            size="small"
            :loading="historyValveLoading"
            @click="confirmAddHistoryValveVersion"
          >
            添加
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
      :persist-draft="handleSaveDraft"
    />
  </section>
  <BaseConfirm
    v-model="confirmState.visible"
    v-bind="confirmState"
    @confirm="resolveConfirm"
    @cancel="rejectConfirm"
  />
</template>

<script setup lang="ts">
import { Upload } from "@element-plus/icons-vue";
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  onUpdated,
  nextTick,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { BaseToast } from "@/components/base/BaseToast";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import {
  DEPARTMENT_OPINION_DEPTS,
  exportMeetingReviewReport,
  fetchDepartmentOpinionCards,
  fetchMeetingReviewDetail,
  getValveList,
  queryProjectCostRecords,
  rejectMeetingReviewDecision,
  saveMeetingReviewDraft,
  submitMeetingReviewDecision,
} from "./service";
import { parseReviewSuggestionDetail as parseRevenueReviewSuggestionDetail } from "./review-suggestion";
import OnsiteCalculatorDrawer from "./components/OnsiteCalculatorDrawer.vue";
import MeetingReviewVisualSummary from "./components/MeetingReviewVisualSummary.vue";
import MainTableComparePanel from "@/pages/revenue/components/MainTableComparePanel.vue";
import {
  REVENUE_MODULE_CODE,
  REVENUE_VALUE_SOURCE,
} from "@/pages/revenue/subtable-workbench/domain-config";
import {
  applyMainReviewFormulaAggregatesToValues,
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
  REVENUE_ROW_KIND,
  formatRevenueTableCellValue,
  resolveLifecycleFormula,
  resolveSubtotalAggregateFormula,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import {
  buildRevenueValuePayload,
  isPercentUnit as isRevenuePercentUnit,
  readRecordStorageValue,
} from "@/pages/revenue/subtable-workbench/value-normalizer";
import { formatPeriodExpenseDisplayText } from "@/utils/displayText";
import { useAuthStore } from "@/stores/auth";

const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const BASELINE_VERSION_KEY = "brand";
const REQUIRED_COMPARE_VERSION_KEY = "finance";
const ADD_HISTORY_VALVE_OPTION_KEY = "__add_history_valve__";
const ADD_HISTORY_VALVE_OPTION_LABEL = "添加当前项目历史阀点数据";
const MAIN_TABLE_IMPORT_NODE = "MAIN_TABLE";
const IMPORTED_LIFECYCLE_REFERENCE_FLAG = "__mainTableLifecycleImport";
const OTHER_PROJECT_OPTION_KEY = "__other_project__";
const OTHER_PROJECT_OPTION_LABEL = "添加其他项目历史阀点数据";
const FIXED_REVIEW_VERSION_CATALOG = [
  { key: "brand", label: "二级公司提报", dot: "brand", group: "baseline" },
  {
    key: "finance",
    label: "集团财务测算",
    dot: "finance",
    group: "candidate",
    required: true,
  },
  {
    key: "business",
    label: "业务经理填报",
    dot: "business",
    group: "candidate",
  },
  { key: "dept", label: "集团部室意见", dot: "dept", group: "candidate" },
];
const FIXED_COMPARE_VERSION_KEYS = FIXED_REVIEW_VERSION_CATALOG.filter(
  (item: any) => item.key !== BASELINE_VERSION_KEY,
).map((item: any) => item.key);
const DECISION_SOURCE_VERSION_KEYS = ["business", "dept", "brand", "finance"];
const HIDDEN_EXTRA_VERSION_KEYS = ["history", "competitor"];
const HIDDEN_EXTRA_VERSION_LABELS = [
  "当前项目的历史阀点数据",
  "当前项目的竞品数据",
];
// 临时隐藏 S8 评审留痕时间线，待需求口径确认后再恢复展示。
const SHOW_MEETING_REVIEW_TIMELINE = false;
// 临时隐藏 S8 导出与草稿入口，待需求口径确认后再恢复展示。
const SHOW_MEETING_REVIEW_EXPORT = false;
const SHOW_MEETING_REVIEW_DRAFT = false;
const MEETING_REVIEW_ENTRY_SESSION_PREFIX = "revenue:meeting-review-entry:";
const MEETING_REVIEW_ENTRY_MENU_KEYS = Object.freeze([
  "meeting_review",
  "flow_s8",
]);
const MEETING_REVIEW_PERMISSION = "revenue:s8:review";
const FIXED_FEE_PARENT_SUBJECT_ID = "fixed_total";
const QUICK_ENTRY_SIZE = 40;
const QUICK_ENTRY_HIT_SIZE = 48;
const QUICK_ENTRY_DRAG_THRESHOLD = 6;
const DEFAULT_FULLSCREEN_TABLE_FONT_SIZE = 12;
const MIN_FULLSCREEN_TABLE_FONT_SIZE = 8;
const FULLSCREEN_TABLE_FONT_SIZE_STEP = 1;

function safeRouteText(value: any, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function normalizeRouteStageCode(value: any) {
  const text = safeRouteText(value, "S8").toUpperCase();
  return /^S[1-8]$/.test(text) ? text : "S8";
}

function buildMeetingReviewEntryKey(query: any = {}) {
  return [
    safeRouteText(query.projectId),
    safeRouteText(query.flowId),
    safeRouteText(query.projectCode || query.projectNo),
    safeRouteText(query.valvePoint || query.valve),
    normalizeRouteStageCode(query.stage || "S8"),
  ].join("__");
}
const FIXED_FEE_CHILD_SUBJECT_IDS = [
  "fixed_tax",
  "fixed_mfg",
  "fixed_sale",
  "management",
  "rd_expense",
  "finance_exp",
];
const REVIEW_STAGE_STEPS = Object.freeze([
  { code: "S1", label: "业务经理填报" },
  { code: "S2", label: "集团部室审核" },
  { code: "S3", label: "业务经理二次确认" },
  { code: "S4", label: "二级公司财务审核" },
  { code: "S5", label: "二级公司最终提交" },
  { code: "S6", label: "集团财务审核" },
  { code: "S7", label: "会前窗口期" },
  { code: "S8", label: "集团上会评审" },
]);
const CALC_RESULT_METRIC_META = Object.freeze({
  margin: { unit: "元" },
  margin_rate: { unit: "%" },
  op_profit: { unit: "元" },
  op_rate: { unit: "%" },
  proj_rev: { unit: "万元" },
  proj_margin: { unit: "万元" },
  proj_profit: { unit: "万元" },
});
const SUBJECT_ID_BY_NAME = Object.freeze({
  MIX: "mix",
  "MIX%": "mix",
  市场指导价合同价含税: "msrp",
  市场指导价含税: "msrp",
  合同价含税: "msrp",
  促销政策含税: "promo",
  TP价含税: "tp",
  商务政策含税: "biz_policy",
  经销商底价含税: "dealer",
  销售收入: "revenue",
  消费税金及附加: "tax",
  材料成本: "material",
  设计成本: "design_cost",
  BOM辅料: "bom",
  零部件摊销: "part_amo",
  变动制造费用: "var_mfg",
  变动销售费用: "var_sale",
  华为服务费: "huawei_service_fee",
  边际贡献: "margin",
  边际贡献率: "margin_rate",
  "边际贡献率%": "margin_rate",
  固定费用: "fixed_total",
  固定费用合计: "fixed_total",
  固定税金及附加: "fixed_tax",
  固定制造费用: "fixed_mfg",
  固定销售费用: "fixed_sale",
  管理费用: "management",
  研发费用: "rd_expense",
  财务费用: "finance_exp",
  选装收益: "option_income",
  营业利润: "op_profit",
  营业利润率: "op_rate",
  "营业利润率%": "op_rate",
  销量: "proj_vol",
  项目销量: "proj_vol",
  项目销售收入: "proj_rev",
  项目边际贡献: "proj_margin",
  项目营业利润: "proj_profit",
});
const REVIEW_SOURCE_QUERY_RULES = Object.freeze({
  brand: {
    nodes: ["S7", "S5"],
    priority: [{ node: "S7" }, { node: "S5" }],
  },
  finance: {
    nodes: ["S7", "S6"],
    priority: [{ node: "S7" }, { node: "S6" }],
  },
  business: {
    nodes: ["S3"],
    priority: [{ node: "S3" }],
  },
  dept: {
    nodes: ["S7", "S2"],
    priority: [{ node: "S7" }, { node: "S2", latest: true }],
  },
});
const HISTORY_VALVE_SOURCE_RULE = Object.freeze({
  nodes: ["S8"],
  priority: [{ node: "S8" }],
});

const DEFAULT_STATE: any = {
  baselineVersion: BASELINE_VERSION_KEY,
  compareVersions: [REQUIRED_COMPARE_VERSION_KEY],
  viewMode: "compare",
  activeYear: 0,
  activeYears: [] as any[],
  activeTrims: [] as any[],
  autoDiff: true,
  deltaMode: false,
  calcVersions: [] as any[],
  calcVersionSeed: 0,
  activeCalcVersionKey: "",
  calcBaseVersion: BASELINE_VERSION_KEY,
  calcBaseYear: 0,
  calcDraftValues: {},
  calcMode: "single",
  calcMixInputMode: "mix",
  calcMixLockTotalVolume: true,
  decisionSource: "finance",
  meetingOpinion: "",
  customDecisionValue: "",
  customDecisionNote: "",
};

// === 模块级纯函数（提取自 methods，消除 forEach/map/for 回调中的 this.） ===
function safeText(value: any, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function safeNumber(value: any) {
  if (value == null || String(value).trim() === "") return null;
  const text = String(value).trim().replace(/,/g, "").replace(/[%％]$/, "");
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function displayUiText(value: any) {
  return formatPeriodExpenseDisplayText(value);
}

function formatFlowReviewTime(value: any) {
  const text = safeText(value);
  if (!text) return "";
  return text
    .replace("T", " ")
    .replace(/\.\d+(?=Z?$)/, "")
    .replace(/Z$/, "");
}

function compareFlowReviewTimeDesc(left: any, right: any) {
  return (Date.parse(right || "") || 0) - (Date.parse(left || "") || 0);
}

function normalizeReviewNodeCode(stageCode: any, fallback = "") {
  const code = safeText(stageCode).toUpperCase();
  if (/^S[1-8]$/.test(code)) return code;
  const fallbackCode = safeText(fallback).toUpperCase();
  if (/^S[1-8]$/.test(fallbackCode)) return fallbackCode;
  if (["CREATE", "START", "INIT"].includes(code)) return "S1";
  return "";
}

function resolveProcessStatusText(status: any) {
  const text = safeText(status);
  const code = text.toUpperCase();
  const statusMap = {
    IN_PROGRESS: "进行中",
    PROCESSING: "进行中",
    RUNNING: "进行中",
    FINISHED: "已完成",
    COMPLETED: "已完成",
    DONE: "已完成",
    SUCCESS: "已完成",
    ARCHIVED: "已归档",
    DRAFT: "草稿",
    VOIDED: "已作废",
    REJECTED: "已驳回",
    REJECT: "已驳回",
    FAILED: "失败",
  };
  return (statusMap as Record<string, any>)[code] || text;
}

function resolveProcessStatusTagType(status: any) {
  const text = safeText(status).toUpperCase();
  if (!text || text.includes("未开始")) return "info";
  if (
    ["FINISHED", "COMPLETED", "DONE", "SUCCESS", "ARCHIVED", "PASS"].includes(
      text,
    ) ||
    text.includes("已完成") ||
    text.includes("已归档") ||
    text.includes("已流转") ||
    text.includes("已处理")
  ) {
    return "success";
  }
  if (
    ["IN_PROGRESS", "PROCESSING", "RUNNING", "DRAFT"].includes(text) ||
    text.includes("进行中") ||
    text.includes("草稿")
  ) {
    return "warning";
  }
  if (
    ["VOIDED", "REJECTED", "REJECT", "FAILED"].includes(text) ||
    text.includes("作废") ||
    text.includes("驳回") ||
    text.includes("失败")
  ) {
    return "danger";
  }
  return "";
}

function resolveReviewConclusionText(value: any) {
  const text = safeText(value);
  const code = text.toUpperCase();
  const map = {
    PASS: "通过",
    PASS_WITH_ISSUES: "带意见通过",
    REJECT: "驳回",
    RETURN: "退回",
    PENDING: "待定",
    NEED_IMPROVEMENT: "需修改",
  };
  return (map as Record<string, any>)[code] || text;
}

function normalizeSubjectMatchName(value: any) {
  return safeText(value)
    .toUpperCase()
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/其中[:：]/g, "")
    .replace(/[\s\u3000]/g, "")
    .replace(/[()]/g, "")
    .replace(/[/\\_\-—]/g, "");
}

function normalizeYearMatchKey(value: any) {
  const text = safeText(value);
  if (text.includes("全生命周期") || text.includes("合计")) return "lifecycle";
  return text.replace(/年/g, "").replace(/\s+/g, "");
}

function isHiddenExtraVersion(key: any, label: any) {
  const versionKey = safeText(key);
  const versionLabel = safeText(label);
  return (
    HIDDEN_EXTRA_VERSION_KEYS.includes(versionKey) ||
    HIDDEN_EXTRA_VERSION_LABELS.includes(versionLabel)
  );
}

function inferExtraVersionDot(key: any, group: any, label: any) {
  const versionKey = safeText(key).toLowerCase();
  const versionGroup = safeText(group).toLowerCase();
  const versionLabel = safeText(label);
  if (versionGroup === "competitor" || versionKey.startsWith("comp_"))
    return "competitor";
  if (
    versionGroup === "history" ||
    versionKey.startsWith("gate_") ||
    versionLabel.includes("阀点")
  ) {
    return "history";
  }
  return "history";
}

function normalizeExtraVersion(item: any, index = 0) {
  if (!item || typeof item !== "object") return null;
  const key = safeText(item.key || item.id || item.value);
  const label = safeText(item.label || item.name || item.title, key);
  if (!key || isHiddenExtraVersion(key, label)) return null;
  const group = safeText(item.group || item.type || item.category);
  return {
    key,
    label: label || `扩展数据${index + 1}`,
    dot: safeText(item.dot, inferExtraVersionDot(key, group, label)),
    group: group || inferExtraVersionDot(key, group, label),
  };
}

function normalizeSubjectTreeNodes(nodes: any[] = []): any[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map((node, index) => {
      const normalizedChildren = normalizeSubjectTreeNodes(
        Array.isArray(node && node.children) ? node.children : [],
      );
      const hasExplicitLeaf =
        node && node.leaf !== undefined && node.leaf !== null;
      const isLeaf = hasExplicitLeaf
        ? Boolean(node.leaf)
        : !normalizedChildren.length;
      const nodeName = safeText(
        node && (node.subjectName || node.name || node.label),
      );
      const nodeId = safeText(
        node && (node.id || node.subjectId || node.subjectCode || node.code),
        `node_${index}`,
      );
      if (!nodeName) return null;
      return {
        ...node,
        id: nodeId,
        name: nodeName,
        unit: safeText(node && node.unit),
        entryMode: safeText(node && (node.entryMode || node.templateEntryMode)),
        templateEntryMode: safeText(
          node && (node.templateEntryMode || node.entryMode),
        ),
        formulaId: node && node.formulaId,
        formulaCode: safeText(node && (node.formulaCode || node.formulaKey)),
        formulaParamBindings: node && node.formulaParamBindings,
        aggregateFormula: safeText(node && node.aggregateFormula),
        rowKind: safeText(node && (node.rowKind || node.rowType)),
        valueSource: safeText(node && (node.valueSource || node.sourceType)),
        leaf: isLeaf,
        enabled: !node || node.enabled !== false,
        visible: !node || node.visible !== false,
        children: normalizedChildren,
      };
    })
    .filter(
      (item: any) => item && item.enabled !== false && item.visible !== false,
    );
}

function normalizeFlowLogEntry(row: any = {}, index = 0) {
  const source = row && typeof row === "object" ? row : {};
  const node = normalizeReviewNodeCode(
    source.node || source.stageCode || source.stage,
    "S1",
  );
  if (!node) return null;
  const time = formatFlowReviewTime(
    source.createdAt || source.createTime || source.updatedAt,
  );
  const rawStatus = safeText(source.nodeStatus || source.targetNodeStatus);
  return {
    key: `log_${safeText(source.id, String(index))}`,
    node,
    time,
    actor: safeText(source.operatorName, source.operatorId),
    operatorPermission: safeText(
      source.operatorPermission || source.permissionKey,
    ),
    rawStatus,
    statusText: resolveProcessStatusText(rawStatus),
    remark: safeText(source.actionRemark || source.remark || source.action),
  };
}

function normalizeFlowReviewEntry(row: any = {}, index = 0) {
  const source = row && typeof row === "object" ? row : {};
  const detail = parseRevenueReviewSuggestionDetail(source.reviewSuggestion);
  const node = normalizeReviewNodeCode(
    source.node || source.stageCode || source.stage,
    detail.stageCode,
  );
  if (!node) return null;
  const reviewer = safeText(source.reviewerName, source.reviewerId || "-");
  const reviewerPermission = safeText(
    source.reviewerPermission || source.permissionKey,
  );
  const rawStatus = safeText(source.reviewStatus);
  return {
    key: `review_${safeText(source.reviewId || source.id, String(index))}`,
    node,
    title: detail.title || "评审意见",
    time: formatFlowReviewTime(
      source.updatedAt || source.createdAt || source.createTime,
    ),
    reviewerText: reviewer,
    reviewerPermission,
    rawStatus,
    reviewStatusText: resolveProcessStatusText(rawStatus),
    conclusionText: resolveReviewConclusionText(source.reviewConclusion),
    opinion: safeText(detail.opinion),
  };
}

function buildReviewEntryMetaText(review: any = {}) {
  const parts = [safeText(review.reviewerText)];
  const conclusionText = safeText(review.conclusionText);
  const reviewStatusText = safeText(review.reviewStatusText);
  if (conclusionText) parts.push(conclusionText);
  if (reviewStatusText) parts.push(reviewStatusText);
  return parts.filter((text) => safeText(text)).join(" · ");
}

function normalizeStageOperationFromReview(review: any = {}) {
  const title = safeText(review.title) || "评审意见";
  const time = safeText(review.time) || "-";
  const meta = buildReviewEntryMetaText(review);
  const opinionText = safeText(review.opinion);
  return {
    type: "review",
    title,
    time,
    meta,
    opinion:
      opinionText || (review.reviewerText ? "已记录评审，无文字意见" : ""),
  };
}

function normalizeStageOperationFromLog(log: any = {}) {
  const actor = safeText(log.actor);
  const statusText = safeText(log.statusText);
  const remark = safeText(log.remark) || statusText || "流程动作";
  return {
    type: "log",
    title: remark,
    time: safeText(log.time) || "-",
    meta: actor,
    actor,
    remark,
    opinion: "",
  };
}

function resolveStageLatestReview(item: any = {}) {
  const reviews = Array.isArray(item.reviews) ? item.reviews : [];
  const logs = Array.isArray(item.logs) ? item.logs : [];
  if (reviews.length) return normalizeStageOperationFromReview(reviews[0]);
  if (logs.length) return normalizeStageOperationFromLog(logs[0]);
  return null;
}

function buildStageLastOperationCard(item: any = {}) {
  const operation: any = resolveStageLatestReview(item);
  const cardTooltip = operation
    ? operation.type === "log"
      ? [operation.time, operation.actor, operation.remark]
          .filter((text) => safeText(text))
          .join("\n")
      : [operation.title, operation.time, operation.meta, operation.opinion]
          .filter((text) => safeText(text))
          .join("\n")
    : "暂无记录";
  return {
    code: item.code,
    label: item.label,
    isCurrent: item.isCurrent,
    hasOperation: Boolean(operation),
    operationTitle: operation ? operation.title : "",
    operationTime: operation ? operation.time : "",
    operationMeta: operation ? operation.meta : "",
    operationOpinion: operation ? operation.opinion : "",
    operationActor: operation ? operation.actor || "" : "",
    operationRemark: operation ? operation.remark || "" : "",
    operationType: operation ? operation.type : "",
    cardTooltip,
  };
}

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

// ===== Data (ref) =====
const loading = ref(false);
const project = ref<any>({
  projectNo: "",
  projectCode: "",
  projectName: "",
  gate: "",
  stage: "",
  nodeStatus: "",
  meetingTime: "",
  freezeTime: "",
});
const steps = ref(REVIEW_STAGE_STEPS.map((item: any) => ({ ...item })));
const currentStep = ref("S8");
const dimensions = ref<any>({
  years: [] as any[],
  trims: [] as any[],
  yearFactors: [] as any[],
});
const subjects = ref<any[]>([]);
const subjectCollapseState = ref({
  [FIXED_FEE_PARENT_SUBJECT_ID]: false,
});
const candidateVersions = ref<any[]>([]);
const extraVersions = ref<any[]>([]);
const candidateValues = ref<Record<string, any>>({});
const extraValues = ref<Record<string, any>>({});
const calcEditableFields = ref<any[]>([]);
const state = ref<any>({
  ...DEFAULT_STATE,
});
const timeline = ref<any[]>([]);
const flowReviewHistory = ref<any>({
  flowId: "",
  logs: [] as any[],
  reviewSuggestions: [] as any[],
});
// S8 各部门评审意见（固定 6 部门卡）
const departmentOpinionCards = ref(
  DEPARTMENT_OPINION_DEPTS.map((item: any, index: any) => ({
    code: item.code,
    label: item.label,
    order: index + 1,
    hasOperation: false,
    operationTime: "",
    operationMeta: "",
    operationOpinion: "",
    cardTooltip: "暂无记录",
  })),
);
const decisionResult = ref<any>(null);
const meetingDecisionSubmitting = ref(false);
const calcDrawerVisible = ref(false);
const calcVersionNameInput = ref("");
const calcResult = ref<Record<string, any>>({});
const manualCellHighlights = ref<Record<string, any>>({});
const manualRowHighlights = ref<Record<string, any>>({});
const tableSystemFullscreen = ref(false);
const tableFullscreenCentered = ref(false);
const tableFullscreenLayoutRaf = ref<any>(null);
const tableFullscreenLayoutTimer = ref<any>(null);
const fullscreenModeTipVisible = ref(false);
const fullscreenModeTipTimer = ref<any>(null);
const compareControlDrawerVisible = ref(false);
const historyValveDialogVisible = ref(false);
const historyValvePickerValue = ref("");
const historyValveLoading = ref(false);
const historyValveOptions = ref<any[]>([]);
const moduleLoadPlan = ref<any[]>([]);
const moduleLoadStateMap = ref<Record<string, any>>({});
const moduleRecordMap = ref<Record<string, any>>({});
const _moduleBaseQuery = ref<any>(null);
const moduleLoadRunId = ref(0);
const fullscreenQuickMenuVisible = ref(false);
const quickEntryPosition = ref({ x: 0, y: 0 });
const quickEntryDragging = ref(false);
const quickEntryDragOffset = ref({ x: 0, y: 0 });
const quickEntryDragStart = ref({ x: 0, y: 0 });
const quickEntryMoved = ref(false);
const quickEntryIgnoreNextClick = ref(false);
const quickEntryClickGuardTimer = ref<any>(null);
const fullscreenTableFontSize = ref(DEFAULT_FULLSCREEN_TABLE_FONT_SIZE);
// ElMessage & ElMessageBox imported directly above
const _$refs = ref<Record<string, any>>({});
const _$el = ref<any>(null);
void _$refs.value;
void _$el.value;

// ---- computed ----
const queryProjectNo = computed(() => {
  return String(route.query.projectNo || "");
});
const queryProjectCode = computed(() => {
  return String(route.query.projectCode || queryProjectNo.value).trim();
});
const queryProjectId = computed(() => {
  return String(route.query.projectId || "").trim();
});
const queryFlowId = computed(() => {
  return String(route.query.flowId || "").trim();
});
const queryProjectName = computed(() => {
  return String(route.query.projectName || "").trim();
});
const queryPermissionKey = computed(() => {
  return String(
    route.query.permissionKey ||
      route.query.permission ||
      MEETING_REVIEW_PERMISSION,
  ).trim();
});
const canSubmitMeetingDecision = computed(() => {
  return (
    queryPermissionKey.value === MEETING_REVIEW_PERMISSION ||
    (authStore.permissions || []).includes("*:*:*")
  );
});
const normalizedNodeStatus = computed(() => {
  return String(project.value.nodeStatus || queryNodeStatus.value || "")
    .trim()
    .toUpperCase();
});
const isS8ReviewStage = computed(() => {
  return (
    normalizeReviewStageCode(
      project.value.stage || queryStage.value || "S8",
    ) === "S8"
  );
});
const isS8InProgressNodeStatus = computed(() => {
  return (
    isS8ReviewStage.value &&
    ["IN_PROGRESS", "PROCESSING", "RUNNING", "进行中"].includes(
      normalizedNodeStatus.value,
    )
  );
});
const queryStage = computed(() => {
  return String(route.query.stage || "S8");
});
const queryValve = computed(() => {
  return String(route.query.valvePoint || route.query.valve || "G5");
});
const queryNodeStatus = computed(() => {
  return String(route.query.nodeStatus || "").trim();
});
const queryFlowUpdatedAt = computed(() => {
  return String(route.query.flowUpdatedAt || "").trim();
});
const queryFlowCreatedAt = computed(() => {
  return String(route.query.flowCreatedAt || "").trim();
});
const queryUserName = computed(() => {
  return String(
    route.query.userName ||
      authStore.currentUser?.displayName ||
      authStore.currentUser?.username ||
      "产品委员会",
  ).trim();
});
const queryUserId = computed(() => {
  return String(route.query.user || authStore.currentUser?.id || "1").trim();
});
const projectTitle = computed(() => {
  return (
    project.value.projectName ||
    queryProjectName.value ||
    project.value.projectNo ||
    queryProjectNo.value ||
    "收益测算项目"
  );
});
const projectHeaderIdText = computed(() => {
  return projectTitle.value;
});
const projectHeaderMetaText = computed(() => {
  const gate = project.value.gate || queryValve.value || "-";
  const stage = projectStageText.value;
  const status = nodeStatusText.value;
  return [gate ? `${gate} 阀点` : "", stage, status]
    .filter(Boolean)
    .join(" · ");
});
const projectStageText = computed(() => {
  return normalizeStageText(project.value.stage || queryStage.value || "S8");
});
const nodeStatusText = computed(() => {
  const status = String(project.value.nodeStatus || queryNodeStatus.value || "")
    .trim()
    .toUpperCase();
  if (
    decisionResult.value &&
    decisionResult.value.rejected &&
    status === "VOIDED"
  ) {
    return "已驳回";
  }
  const statusMap = {
    IN_PROGRESS: "进行中",
    PROCESSING: "进行中",
    RUNNING: "进行中",
    FINISHED: "已完成",
    COMPLETED: "已完成",
    DONE: "已完成",
    SUCCESS: "已完成",
    VOIDED: "已作废",
    REJECTED: "已驳回",
    FAILED: "失败",
  };
  return (statusMap as Record<string, any>)[status] || "";
});
const _headerInfoItems = computed(() => {
  return [
    { label: "项目编号", value: project.value.projectCode || "-" },
    { label: "阀点", value: project.value.gate || queryValve.value || "-" },
    { label: "上会时间", value: project.value.meetingTime || "-" },
    { label: "当前权限", value: queryPermissionKey.value || "-" },
    { label: "当前用户", value: queryUserName.value || "-" },
    {
      label: "对比版本数",
      value: String((state.value.compareVersions || []).length),
    },
  ];
});
const currentStepIndex = computed(() => {
  const stepCode = normalizeReviewStageCode(currentStep.value);
  const idx = (steps.value || []).findIndex((item) => item.code === stepCode);
  if (idx < 0) return 0;
  return isTerminalNodeStatus(project.value.nodeStatus || queryNodeStatus.value)
    ? Math.min(idx + 1, (steps.value || []).length)
    : idx;
});
const currentFlowId = computed(() => {
  const history = flowReviewHistory.value || {};
  return safeText(history.flowId || project.value.flowId || queryFlowId.value);
});
const currentFlowMetaItems = computed(() => {
  const history = flowReviewHistory.value || {};
  const logs = Array.isArray(history.logs) ? history.logs : [];
  const firstLog = logs[0] || {};
  const latestLog = logs[logs.length - 1] || {};
  return [
    {
      label: "项目编号",
      value: project.value.projectCode || queryProjectCode.value,
    },
    {
      label: "阀点",
      value: project.value.gate || project.value.valvePoint || queryValve.value,
    },
    {
      label: "流程状态",
      value:
        nodeStatusText.value ||
        project.value.nodeStatus ||
        queryNodeStatus.value,
    },
    {
      label: "创建时间",
      value: formatFlowReviewTime(
        project.value.flowCreatedAt ||
          firstLog.createdAt ||
          firstLog.createTime,
      ),
    },
    {
      label: "更新时间",
      value: formatFlowReviewTime(
        project.value.flowUpdatedAt ||
          latestLog.createdAt ||
          latestLog.updatedAt ||
          latestLog.createTime,
      ),
    },
    {
      label: "意见条数",
      value: String((history.reviewSuggestions || []).length || 0),
    },
  ];
});
const flowReviewNodeItems = computed(() => {
  const history = flowReviewHistory.value || {};
  const logs = (Array.isArray(history.logs) ? history.logs : [])
    .map((item: any, index: any) => normalizeFlowLogEntry(item, index))
    .filter(Boolean);
  const reviews = (
    Array.isArray(history.reviewSuggestions) ? history.reviewSuggestions : []
  )
    .map((item: any, index: any) => normalizeFlowReviewEntry(item, index))
    .filter(Boolean);
  const currentCode = normalizeReviewStageCode(
    currentStep.value || project.value.stage || queryStage.value,
  );
  const currentIndex = (steps.value || []).findIndex(
    (item) => item.code === currentCode,
  );

  return (steps.value || []).map((step, index) => {
    const nodeLogs = logs
      .filter((item: any) => (item as any).node === step.code)
      .sort((a: any, b: any) =>
        compareFlowReviewTimeDesc((a as any).time, (b as any).time),
      );
    const nodeReviews = reviews
      .filter((item: any) => (item as any).node === step.code)
      .sort((a: any, b: any) =>
        compareFlowReviewTimeDesc((a as any).time, (b as any).time),
      );
    const latestReview = nodeReviews[0] || {};
    const latestLog = nodeLogs[0] || {};
    const isCurrent = step.code === currentCode;
    const rawStatus = isCurrent
      ? project.value.nodeStatus ||
        queryNodeStatus.value ||
        latestLog.rawStatus ||
        latestReview.rawStatus
      : latestLog.rawStatus || latestReview.rawStatus;
    const statusText = resolveNodeReviewStageStatus({
      index,
      currentIndex,
      isCurrent,
      rawStatus,
      hasActivity: Boolean(nodeLogs.length || nodeReviews.length),
    });
    return {
      ...step,
      isCurrent,
      logs: nodeLogs,
      reviews: nodeReviews,
      statusText,
      statusTagType: resolveProcessStatusTagType(statusText || rawStatus),
      summaryText: buildNodeReviewSummary(step, nodeReviews, nodeLogs),
    };
  });
});
const _stageLatestOpinionCards = computed(() => {
  // 保留计算属性兼容旧逻辑；页面展示已切换为 departmentOpinionCards
  return (flowReviewNodeItems.value || []).map((item: any) =>
    buildStageLastOperationCard(item),
  );
});
const isDetailMode = computed(() => {
  return state.value.viewMode === "detail";
});
const isFixedFeeCollapsed = computed(() => {
  return isSubjectCollapsed(FIXED_FEE_PARENT_SUBJECT_ID);
});
const displaySubjects = computed(() => {
  return (subjects.value || [])
    .map((group) => ({
      ...group,
      items: group.items || [],
    }))
    .filter((group) => group.items && group.items.length);
});
const displaySubjectRows = computed(() => {
  const rows: any[] = [];
  const fixedFeeCollapsed = isSubjectCollapsed(FIXED_FEE_PARENT_SUBJECT_ID);
  displaySubjects.value.forEach((group) => {
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
const reviewYearOptions = computed(() => {
  return buildMainTableReviewYearOptions(dimensions.value, {
    safeText: (value, fallback) => safeText(value, fallback),
    normalizeYearMatchKey: (value) => normalizeYearMatchKey(value),
  });
});
const defaultYearIndexes = computed(() => {
  return buildMainTableDefaultYearIndexes(reviewYearOptions.value);
});
const calcBaseYearOptions = computed(() => {
  return reviewYearOptions.value.length
    ? reviewYearOptions.value
    : [{ label: yearLabelByIndex(0) || "首年", value: 0 }];
});
const selectedYearIndexes = computed(() => {
  return buildMainTableNormalizedSelectedYearIndexes(
    state.value.activeYears,
    reviewYearOptions.value,
    { expandLegacyDefault: !state.value.activeYearsUserSelected },
  );
});
const defaultTrimIndex = computed(() => {
  return getDefaultTrimIndex();
});
const selectedTrimIndexes = computed(() => {
  const trimCount = (dimensions.value.trims || []).length;
  const defaultTrimIndex = getDefaultTrimIndex();
  const source = Array.isArray(state.value.activeTrims)
    ? state.value.activeTrims
    : [defaultTrimIndex];
  const map = {};
  const result = source
    .map((item: any) => Number(item))
    .filter(
      (item: any) => Number.isInteger(item) && item >= 0 && item < trimCount,
    )
    .filter((item: any) => {
      if ((map as Record<string, any>)[item]) return false;
      (map as Record<string, any>)[item] = true;
      return true;
    })
    .sort((a: any, b: any) => a - b);
  if (result.length) return result;
  if (trimCount <= 0) return [0];
  return [defaultTrimIndex];
});
const detailTrimIndexes = computed(() => {
  return buildMainTableDetailTrimIndexes(dimensions.value);
});
const detailColumnDefs = computed(() => {
  return buildMainTableDetailColumnDefs(dimensions.value, {
    trimIndexes: detailTrimIndexes.value,
    safeText: (value, fallback) => safeText(value, fallback),
    normalizeYearMatchKey: (value) => normalizeYearMatchKey(value),
  });
});
const detailHeaderGroups = computed(() => {
  return buildMainTableDetailHeaderGroups(detailColumnDefs.value);
});
const _selectedYearLabel = computed(() => {
  const index = Number(state.value.activeYear);
  return dimensions.value.years[index] || dimensions.value.years[0] || "-";
});
const fixedBaselineVersionLabel = computed(() => {
  return FIXED_REVIEW_VERSION_CATALOG.find(
    (item: any) => item.key === BASELINE_VERSION_KEY,
  )?.label;
});
const addHistoryValveOptionKey = computed(() => {
  return ADD_HISTORY_VALVE_OPTION_KEY;
});
const addHistoryValveOptionLabel = computed(() => {
  return ADD_HISTORY_VALVE_OPTION_LABEL;
});
const otherProjectOptionKey = computed(() => {
  return OTHER_PROJECT_OPTION_KEY;
});
const otherProjectOptionLabel = computed(() => {
  return OTHER_PROJECT_OPTION_LABEL;
});
const dynamicExtraVersions = computed(() => {
  return (Array.isArray(extraVersions.value) ? extraVersions.value : [])
    .map((item: any, index: any) => normalizeExtraVersion(item, index))
    .filter((item: any) => item && shouldDisplayExtraVersion(item));
});
const allVersions = computed(() => {
  const calcVersions = (state.value.calcVersions || []).map((item: any) => ({
    key: item.key,
    label: item.label,
    dot: item.dot || "calc",
    group: item.group || "calc",
  }));
  return FIXED_REVIEW_VERSION_CATALOG.map((item: any) => ({ ...item }))
    .concat(dynamicExtraVersions.value)
    .concat(calcVersions);
});
const allVersionMap = computed(() => {
  const map = {};
  allVersions.value.forEach((item: any) => {
    (map as Record<string, any>)[item.key] = item;
  });
  return map;
});
const compareVersionOptions = computed(() => {
  const fixedOptions = FIXED_REVIEW_VERSION_CATALOG.filter(
    (item: any) => item.key !== BASELINE_VERSION_KEY,
  ).map((item: any) => ({
    ...item,
    required: item.key === REQUIRED_COMPARE_VERSION_KEY,
  }));
  const calcOptions = (state.value.calcVersions || []).map((item: any) => ({
    key: item.key,
    label: item.label,
    dot: item.dot || "calc",
    group: item.group || "calc",
    required: false,
  }));
  return fixedOptions.concat(dynamicExtraVersions.value, calcOptions);
});
const meetingVisualSummaryVersions = computed(() => {
  const fixed = DECISION_SOURCE_VERSION_KEYS.map((key) =>
    FIXED_REVIEW_VERSION_CATALOG.find((item: any) => item.key === key),
  )
    .filter(Boolean)
    .map((item: any) => ({ ...item }));
  const calc = (state.value.calcVersions || []).map((item: any) => ({
    key: item.key,
    label: item.label,
    dot: item.dot || "calc",
    group: item.group || "calc",
  }));
  return fixed.concat(dynamicExtraVersions.value, calc);
});
const meetingVisualSummaryChartVersions = computed(() => {
  const seen = {};
  return [state.value.baselineVersion]
    .concat(state.value.compareVersions || [])
    .map((key) => safeText(key))
    .filter((key) => {
      if (!key || (seen as Record<string, any>)[key]) return false;
      (seen as Record<string, any>)[key] = true;
      return true;
    })
    .map((key) => (allVersionMap.value as Record<string, any>)[key])
    .filter(Boolean)
    .map((item: any) => ({ ...item }));
});
const meetingVisualSummaryLoading = computed(() => {
  const plans = Array.isArray(moduleLoadPlan.value) ? moduleLoadPlan.value : [];
  const targetPlans = plans.filter((plan) => {
    const name = safeText(plan && plan.moduleName);
    return name.includes("单车收益") || name.includes("项目利润");
  });
  if (!targetPlans.length) return loading.value;
  return targetPlans.some((plan) => {
    const state =
      (moduleLoadStateMap.value as Record<string, any>)[plan.moduleKey] || {};
    return ["idle", "loading"].includes(safeText(state.status, "idle"));
  });
});
const compareHeaderVersions = computed(() => {
  const versionKeys = [state.value.baselineVersion]
    .concat(state.value.compareVersions || [])
    .filter((key, index, arr) => key && arr.indexOf(key) === index);
  return versionKeys
    .map((key) => {
      const meta = (allVersionMap.value as Record<string, any>)[key];
      if (!meta) return null;
      const isCalc = isCalcVersionKey(key);
      const yearColumns = isCalc
        ? [
            {
              yearIndex: null,
              label: "测算值",
              columnKey: `${key}_calc`,
            },
          ]
        : selectedYearIndexes.value.map((yearIndex) => ({
            yearIndex,
            label: yearLabelByIndex(yearIndex),
            columnKey: `${key}_${yearIndex}`,
          }));
      return {
        ...meta,
        isCalc,
        yearColumns,
        colspan: yearColumns.length,
      };
    })
    .filter(Boolean);
});
const compareColumnDefs = computed(() => {
  const columns: any[] = [];
  compareHeaderVersions.value.forEach((item: any) => {
    item.yearColumns.forEach((yearColumn: any) => {
      columns.push({
        versionKey: item.key,
        yearIndex: yearColumn.yearIndex,
        trimIndex: item.isCalc ? null : defaultTrimIndex.value,
        isBaseline: item.key === state.value.baselineVersion,
        isCalc: item.isCalc,
        columnKey: yearColumn.columnKey,
      });
    });
  });
  return columns;
});
const isCompareFitMode = computed(() => {
  return compareHeaderVersions.value.length <= 4;
});
const compareTableStyle = computed(() => {
  const columnCount = Math.max(compareColumnDefs.value.length, 1);
  const minWidth = `calc(var(--subject-col-w) + ${columnCount} * var(--value-col-min-w))`;
  const valueWidth = isCompareFitMode.value
    ? `max(calc((100% - var(--subject-col-w)) / ${columnCount}), var(--value-col-min-w))`
    : "var(--value-col-min-w)";
  const width = isCompareFitMode.value ? `max(100%, ${minWidth})` : minWidth;
  return {
    ...fullscreenTableFontStyleVars.value,
    "--value-col-w": valueWidth,
    width,
    minWidth,
  };
});
const detailTableStyle = computed(() => {
  const columnCount = Math.max(detailColumnDefs.value.length, 1);
  const width = `calc(var(--subject-col-w) + ${columnCount} * var(--value-col-min-w))`;
  return {
    ...fullscreenTableFontStyleVars.value,
    "--value-col-w": "var(--value-col-min-w)",
    width,
    minWidth: width,
  };
});
const decisionSourceOptions = computed(() => {
  const candidates = DECISION_SOURCE_VERSION_KEYS.map((key) =>
    FIXED_REVIEW_VERSION_CATALOG.find((item: any) => item.key === key),
  )
    .filter(Boolean)
    .map((item: any) => ({
      key: item.key,
      label: `采用${item.label}`,
    }));
  const calc = (state.value.calcVersions || []).map((item: any) => ({
    key: item.key,
    label: `采用${item.label}`,
  }));
  return candidates.concat(calc);
});
const showReviewTimeline = computed(() => {
  return SHOW_MEETING_REVIEW_TIMELINE;
});
const showMeetingReviewExportAction = computed(() => {
  return SHOW_MEETING_REVIEW_EXPORT;
});
const showMeetingReviewDraftAction = computed(() => {
  return SHOW_MEETING_REVIEW_DRAFT;
});
const isMeetingDecisionFrozen = computed(() => {
  if (!canSubmitMeetingDecision.value) return true;
  if (decisionResult.value) return true;
  return !isS8InProgressNodeStatus.value;
});
const decisionResultText = computed(() => {
  if (!decisionResult.value) return "";
  if (decisionResult.value.rejected) return "处理结果：已驳回";
  return `已确认版本：${safeText(decisionResult.value.meetingVersion, "S8-MEETING")}`;
});
const fullscreenTableFontSizeValue = computed(() => {
  return normalizeFullscreenTableFontSize(fullscreenTableFontSize.value);
});
const fullscreenTableFontSizeLabel = computed(() => {
  return `${fullscreenTableFontSizeValue.value}px`;
});
const _fullscreenTableFontSizeTip = computed(() => {
  return `当前字号：${fullscreenTableFontSizeLabel.value}`;
});
const _isFullscreenTableFontSizeMin = computed(() => {
  return fullscreenTableFontSizeValue.value <= MIN_FULLSCREEN_TABLE_FONT_SIZE;
});
const fullscreenTableFontStyleVars = computed(() => {
  if (!tableSystemFullscreen.value) return {};
  const size = `${fullscreenTableFontSizeValue.value}px`;
  return {
    "--fullscreen-user-font-size": size,
    "--fullscreen-user-head-font-size": size,
    "--fullscreen-user-section-font-size": size,
  };
});
const _fullscreenEntryStyle = computed(() => {
  if (!tableSystemFullscreen.value) return {};
  return {
    left: `${quickEntryPosition.value.x}px`,
    top: `${quickEntryPosition.value.y}px`,
  };
});
const _fullscreenDockStyle = computed(() => {
  if (!tableSystemFullscreen.value) return {};
  const card = /* TODO: use template ref tableFullscreenTarget */ null;
  const rect =
    card && (card as any).getBoundingClientRect
      ? (card as any).getBoundingClientRect()
      : { width: window.innerWidth || 1280, height: window.innerHeight || 720 };
  const entrySize = QUICK_ENTRY_SIZE;
  const dockWidth = 156;
  const dockHeight = 154;
  const gap = 8;
  const preferRight = quickEntryPosition.value.x + entrySize + gap;
  const preferLeft = quickEntryPosition.value.x - dockWidth - gap;
  const left =
    preferRight + dockWidth <= rect.width
      ? preferRight
      : Math.max(8, preferLeft);
  const centerTop = quickEntryPosition.value.y + entrySize / 2 - dockHeight / 2;
  const top = Math.min(
    Math.max(centerTop, 8),
    Math.max(8, rect.height - dockHeight - 8),
  );
  return {
    left: `${left}px`,
    top: `${top}px`,
  };
});
const _controlDrawerSize = computed(() => {
  return tableSystemFullscreen.value ? "360px" : "420px";
});
const calcDrawerSize = computed(() => {
  return tableSystemFullscreen.value ? "420px" : "460px";
});

// ---- lifecycle hooks ----
onMounted(() => {
  if (redirectToReadonlyDetailIfUnauthorizedEntry()) return;
  loadPage();
  window.addEventListener("keydown", onGlobalKeydown);
  window.addEventListener("resize", scheduleFullscreenTableLayout);
  window.addEventListener("mousemove", onQuickEntryDragMove);
  window.addEventListener("mouseup", stopQuickEntryDrag);
  window.addEventListener("touchmove", onQuickEntryDragMove, {
    passive: false,
  });
  window.addEventListener("touchend", stopQuickEntryDrag);
  window.addEventListener("touchcancel", stopQuickEntryDrag);
  if (typeof document !== "undefined") {
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("fullscreenchange", onFullscreenChange);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onGlobalKeydown);
  window.removeEventListener("resize", scheduleFullscreenTableLayout);
  window.removeEventListener("mousemove", onQuickEntryDragMove);
  window.removeEventListener("mouseup", stopQuickEntryDrag);
  window.removeEventListener("touchmove", onQuickEntryDragMove);
  window.removeEventListener("touchend", stopQuickEntryDrag);
  window.removeEventListener("touchcancel", stopQuickEntryDrag);
  if (typeof document !== "undefined") {
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
  }
  if (tableFullscreenLayoutRaf.value) {
    window.cancelAnimationFrame(tableFullscreenLayoutRaf.value);
    tableFullscreenLayoutRaf.value = null;
  }
  if (tableFullscreenLayoutTimer.value) {
    window.clearTimeout(tableFullscreenLayoutTimer.value);
    tableFullscreenLayoutTimer.value = null;
  }
  if (fullscreenModeTipTimer.value) {
    window.clearTimeout(fullscreenModeTipTimer.value);
    fullscreenModeTipTimer.value = null;
  }
  if (quickEntryClickGuardTimer.value) {
    window.clearTimeout(quickEntryClickGuardTimer.value);
    quickEntryClickGuardTimer.value = null;
  }
  unlockPageScroll();
});

onUpdated(() => {
  if (tableSystemFullscreen.value) {
    scheduleFullscreenTableLayout();
  }
});

// ---- methods ----
function hasMeetingReviewEntryToken() {
  if (
    !MEETING_REVIEW_ENTRY_MENU_KEYS.includes(
      String(route.query.menuKey || "").trim(),
    )
  )
    return false;
  if (typeof window === "undefined" || !window.sessionStorage) return false;
  const key = buildMeetingReviewEntryKey(route.query || {});
  if (!key) return false;
  const storageKey = `${MEETING_REVIEW_ENTRY_SESSION_PREFIX}${key}`;
  try {
    const expiresAt = Number(window.sessionStorage.getItem(storageKey));
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      window.sessionStorage.removeItem(storageKey);
      return false;
    }
    return true;
  } catch (_error) {
    return false;
  }
}
function resolveReadonlyDetailPath() {
  return "/revenue/main-table-audit-detail";
}
function resolveReadonlySubjectDomain() {
  return resolveReadonlyDetailPath() === "/revenue/subtable-audit-detail"
    ? "subtable"
    : "main";
}
function buildReadonlyRedirectRoute() {
  return {
    path: resolveReadonlyDetailPath(),
    query: {
      ...route.query,
      stage: normalizeReviewStageCode(queryStage.value || "S8"),
      menuKey: "project_list",
      action: "view",
      subjectDomain: resolveReadonlySubjectDomain(),
      subjectApiMode: "all",
      readonlyAuthorizedScope: "1",
    },
  };
}
function redirectToReadonlyDetailIfUnauthorizedEntry() {
  if (hasMeetingReviewEntryToken()) return false;
  router.replace(buildReadonlyRedirectRoute());
  return true;
}
function isPercentUnit(unit: any) {
  return isRevenuePercentUnit(unit);
}
function _parseReviewSuggestionDetail(v: any) {
  return parseRevenueReviewSuggestionDetail(v);
}
function resolveNodeReviewStageStatus({
  index,
  currentIndex,
  isCurrent,
  rawStatus,
  hasActivity,
}: any) {
  const statusText = resolveProcessStatusText(rawStatus);
  if (rawStatus && statusText) return statusText;
  if (isCurrent) return nodeStatusText.value || "进行中";
  if (hasActivity) return "已处理";
  if (currentIndex >= 0 && index < currentIndex) return "已流转";
  return "未开始";
}
function buildNodeReviewSummary(
  step: any,
  reviews: any[] = [],
  logs: any[] = [],
) {
  if (reviews.length) {
    const latest = reviews[0] || {};
    return `${reviews.length} 条评审意见；最新处理人：${latest.reviewerText || "-"}${
      latest.time ? `，${latest.time}` : ""
    }`;
  }
  if (logs.length) {
    const latest = logs[0] || {};
    return `${logs.length} 条流程动作；最新处理人：${latest.actor || "-"}${
      latest.time ? `，${latest.time}` : ""
    }`;
  }
  return `${step.label}暂无审核意见或流程动作`;
}
function isTerminalNodeStatus(status: any) {
  const text = safeText(status).toUpperCase();
  return [
    "FINISHED",
    "COMPLETED",
    "DONE",
    "SUCCESS",
    "VOIDED",
    "REJECTED",
    "FAILED",
    "已完成",
    "已作废",
    "已驳回",
  ].includes(text);
}
function normalizeStageText(stage: any) {
  const text = safeText(stage, "S8");
  if (/^S[1-8]$/i.test(text)) return displayUiText(text);
  if (/^S8\s+上会评审定值$/i.test(text)) return "S8 集团上会评审";
  return text;
}
function normalizeReviewStageCode(stageCode: any) {
  const code = safeText(stageCode, "S8").toUpperCase();
  return REVIEW_STAGE_STEPS.some((item: any) => item.code === code)
    ? code
    : "S8";
}
function mergeProjectWithRoute(project: any = {}) {
  const source = project && typeof project === "object" ? project : {};
  const routeProjectNo = safeText(
    route.query.projectNo || route.query.projectCode,
  );
  const routeProjectCode = safeText(
    route.query.projectCode || route.query.projectNo,
  );
  const routeValve = safeText(route.query.valvePoint || route.query.valve);
  const routeStage = safeText(route.query.stage);
  return {
    ...source,
    projectNo: safeText(routeProjectNo, source.projectNo),
    projectCode: safeText(
      routeProjectCode,
      source.projectCode || source.projectNo,
    ),
    projectId: safeText(queryProjectId.value, source.projectId),
    flowId: safeText(queryFlowId.value, source.flowId),
    projectName: safeText(queryProjectName.value, source.projectName),
    gate: safeText(routeValve, source.gate),
    valvePoint: safeText(routeValve, source.valvePoint || source.gate),
    stage: normalizeStageText(safeText(routeStage, source.stage)),
    nodeStatus: safeText(source.nodeStatus, queryNodeStatus.value),
    meetingTime: safeText(source.meetingTime),
    freezeTime: safeText(source.freezeTime, queryFlowUpdatedAt.value),
    flowCreatedAt: safeText(queryFlowCreatedAt.value, source.flowCreatedAt),
    flowUpdatedAt: safeText(source.flowUpdatedAt, queryFlowUpdatedAt.value),
  };
}
function clone(value: any) {
  if (typeof value === "undefined") return value;
  return JSON.parse(JSON.stringify(value));
}
function isHistoryValveVersionMeta(version: any = {}) {
  const key = safeText(
    version && (version.key || version.id || version.value),
  ).toLowerCase();
  const label = safeText(
    version && (version.label || version.name || version.title),
  );
  const dot = safeText(version && version.dot).toLowerCase();
  const group = safeText(
    version && (version.group || version.type || version.category),
  ).toLowerCase();
  return (
    dot === "history" ||
    group === "history" ||
    key.startsWith("gate_") ||
    label.includes("阀点")
  );
}
function hasStoredDataValue(value: any): boolean {
  if (value == null) return false;
  if (Array.isArray(value))
    return value.some((item: any) => hasStoredDataValue(item));
  if (typeof value === "object") {
    return Object.keys(value).some((key) => hasStoredDataValue(value[key]));
  }
  const text = String(value).replace(/,/g, "").trim();
  if (!text) return false;
  return safeNumber(text) != null;
}
function hasCandidateVersionData(versionKey: any) {
  const key = safeText(versionKey);
  if (!key) return false;
  const values =
    candidateValues.value && typeof candidateValues.value === "object"
      ? candidateValues.value
      : {};
  return Object.keys(values).some((subjectId) => {
    const target = (values as Record<string, any>)[subjectId];
    if (!target || typeof target !== "object") return false;
    if (hasStoredDataValue(target[key])) return true;
    return ["trims", "years", "yearTrims", "lifecycleImportTrims"].some(
      (field) => {
        const store = target[field] && target[field][key];
        return hasStoredDataValue(store);
      },
    );
  });
}
function hasExtraVersionData(versionKey: any) {
  const key = safeText(versionKey);
  if (!key) return false;
  const extra =
    extraValues.value && (extraValues.value as Record<string, any>)[key];
  return hasStoredDataValue(extra);
}
function hasVersionDisplayData(versionKey: any) {
  return hasCandidateVersionData(versionKey) || hasExtraVersionData(versionKey);
}
function shouldDisplayExtraVersion(version: any = {}) {
  if (!isHistoryValveVersionMeta(version)) return true;
  return hasVersionDisplayData(version.key);
}
function yearLabelByIndex(yearIndex: any) {
  const index = Number(yearIndex);
  const years = Array.isArray(dimensions.value.years)
    ? dimensions.value.years
    : [];
  return safeText(years[index], "-");
}
function isSubjectCollapseParent(item: any) {
  return item && item.id === FIXED_FEE_PARENT_SUBJECT_ID;
}
function isSubjectCollapsed(subjectId: any) {
  return Boolean(
    subjectCollapseState.value &&
    (subjectCollapseState.value as Record<string, any>)[subjectId],
  );
}
function toggleSubjectCollapse(subjectId: any) {
  (subjectCollapseState.value as Record<string, any>)[subjectId] =
    !isSubjectCollapsed(subjectId);
  scheduleFullscreenTableLayout();
  scheduleFullscreenTableLayoutAfterRowsSettle();
}
function getManualRowHighlightKey(row: any) {
  if (!row || row.type !== "item" || !row.item) return "";
  const subjectId = safeText(
    row.item.templateId ||
      row.item.id ||
      row.item.subjectId ||
      row.item.subjectCode,
  );
  return subjectId ? `subject_${subjectId}` : "";
}
function getManualCellHighlightKey(row: any, column: any, mode: any) {
  const rowKey = getManualRowHighlightKey(row);
  if (!rowKey || !column) return "";
  const columnKey = safeText(
    column.columnKey ||
      [column.versionKey, column.yearIndex, column.trimIndex]
        .filter((item: any) => item != null)
        .join("_"),
  );
  return columnKey ? `${safeText(mode, "compare")}_${rowKey}_${columnKey}` : "";
}
function isManualRowHighlighted(row: any) {
  const key = getManualRowHighlightKey(row);
  return Boolean(
    key &&
    manualRowHighlights.value &&
    (manualRowHighlights.value as Record<string, any>)[key],
  );
}
function isManualCellHighlighted(row: any, column: any, mode: any) {
  const key = getManualCellHighlightKey(row, column, mode);
  return Boolean(
    key &&
    manualCellHighlights.value &&
    (manualCellHighlights.value as Record<string, any>)[key],
  );
}
function toggleManualRowHighlight(row: any) {
  const key = getManualRowHighlightKey(row);
  if (!key) return;
  if ((manualRowHighlights.value as Record<string, any>)[key]) {
    delete (manualRowHighlights.value as Record<string, any>)[key];
  } else {
    (manualRowHighlights.value as Record<string, any>)[key] = true;
  }
}
function toggleManualCellHighlight(row: any, column: any, mode: any) {
  const key = getManualCellHighlightKey(row, column, mode);
  if (!key) return;
  if ((manualCellHighlights.value as Record<string, any>)[key]) {
    delete (manualCellHighlights.value as Record<string, any>)[key];
  } else {
    (manualCellHighlights.value as Record<string, any>)[key] = true;
  }
}
function _focusReviewSubject(templateId: any) {
  const matched = findReviewSubjectByTemplateId(templateId);
  if (!matched || !matched.item) return;
  const row = {
    type: "item",
    group: matched.group,
    item: matched.item,
  };
  const key = getManualRowHighlightKey(row);
  if (key) {
    (manualRowHighlights.value as Record<string, any>)[key] = true;
  }
  if (state.value.viewMode !== "compare") {
    state.value.viewMode = "compare";
  }
  nextTick(() => {
    const target =
      null; /* TODO: use proper element ref for el.querySelector(".compare-card") */
    if (target && (target as any).scrollIntoView) {
      (target as any).scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}
function roundNumber(value: any, digits = 2) {
  const num = safeNumber(value);
  if (num == null) return null;
  const factor = Math.pow(10, digits);
  return Math.round(num * factor) / factor;
}
function formatNumber(value: any, item: any) {
  return formatRevenueTableCellValue(item, value);
}
function formatSignedNumber(value: any, item: any) {
  const num = safeNumber(value);
  if (num == null) return "-";
  const prefix = num > 0 ? "+" : "";
  return `${prefix}${formatRevenueTableCellValue(item, num)}`;
}
function isGroupedSubjects(subjects: any[] = []) {
  if (!Array.isArray(subjects)) return false;
  return subjects.some((group) => group && Array.isArray(group.items));
}
function normalizeGroupedSubjects(subjects: any[] = []) {
  if (!Array.isArray(subjects)) return [];
  return subjects
    .map((group, groupIndex) => {
      const items = Array.isArray(group && group.items) ? group.items : [];
      const groupName = safeText(
        group && (group.group || group.name),
        `分组${groupIndex + 1}`,
      );
      const normalizedItems = items
        .map((item: any, itemIndex: any) => {
          const rawItemId = safeText(
            item &&
              (item.id || item.subjectId || item.subjectCode || item.code),
            `subject_${groupIndex}_${itemIndex}`,
          );
          const itemName = safeText(
            item && (item.name || item.subjectName || item.label),
            rawItemId,
          );
          if (!itemName) return null;
          const templateId = inferTemplateId(
            { ...item, id: rawItemId, name: itemName },
            groupName,
          );
          return {
            ...item,
            id: templateId || rawItemId,
            templateId,
            subjectId: safeText(item && item.subjectId, rawItemId),
            name: itemName,
            unit: safeText(item && item.unit),
            bold:
              Boolean(item && item.bold) ||
              ["fixed_total", "margin", "op_profit", "proj_profit"].includes(
                templateId,
              ),
          };
        })
        .filter(Boolean);

      if (!normalizedItems.length) return null;
      return {
        group: groupName,
        unit: safeText(group && group.unit),
        items: normalizedItems,
      };
    })
    .filter(Boolean);
}
function formatSubjectGroupLabel(group: any) {
  const name = displayUiText(
    safeText(group && (group.group || group.name), "分组"),
  );
  const unit = safeText(group && group.unit);
  return unit ? `${name}（${unit}）` : name;
}
function _unwrapSubjectTreePayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  const source = payload && typeof payload === "object" ? payload : {};
  const data =
    source.data && typeof source.data === "object" ? source.data : source;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.subjects)) return data.subjects;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.list)) return data.list;
  return [];
}
function unwrapMainRootNodes(nodes: any[] = []) {
  const list = Array.isArray(nodes) ? nodes : [];
  const roots: any[] = [];
  list.forEach((node) => {
    if (!node) return;
    const normalizedName = safeText(node.name).replace(/\s+/g, "");
    if (
      normalizedName === "主表" &&
      Array.isArray(node.children) &&
      node.children.length
    ) {
      roots.push(...node.children);
      return;
    }
    roots.push(node);
  });
  return roots;
}
function inferTemplateId(row: any = {}, groupName = "") {
  const candidates = [
    row.templateId,
    row.formulaAlias,
    row.name,
    row.subjectName,
    row.subject,
    safeText(row.name || row.subjectName || row.subject)
      .replace(/（/g, "(")
      .replace(/）/g, ")"),
  ]
    .map((item: any) => normalizeSubjectMatchName(item))
    .filter(Boolean);
  for (let index = 0; index < candidates.length; index += 1) {
    const key = candidates[index];
    if (!(SUBJECT_ID_BY_NAME as Record<string, any>)[key]) continue;
    const id = (SUBJECT_ID_BY_NAME as Record<string, any>)[key];
    const normalizedGroup = normalizeSubjectMatchName(groupName);
    if (id === "revenue" && normalizedGroup.includes("项目")) return "proj_rev";
    if (id === "margin" && normalizedGroup.includes("项目"))
      return "proj_margin";
    if (id === "op_profit" && normalizedGroup.includes("项目"))
      return "proj_profit";
    return id;
  }
  return safeText(row.subjectId || row.id || row.rowId);
}
function resetSubjectDrivenData() {
  subjects.value = [];
  candidateVersions.value = [];
  extraVersions.value = [];
  candidateValues.value = {};
  extraValues.value = {};
  calcEditableFields.value = [];
  timeline.value = [];
  decisionResult.value = null;
  state.value = normalizeState({});
  calcResult.value = {};
}
function toQuerySubjectId(value: any) {
  const text = safeText(value);
  if (!text) return "";
  return /^\d+$/.test(text) ? Number(text) : text;
}
function toQueryFlowId(value: any) {
  const text = safeText(value);
  if (!/^\d+$/.test(text)) return undefined;
  const num = Number(text);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}
function getReviewSubjectIds(subjects: any[] = []) {
  const map = {};
  const ids: any[] = [];
  (Array.isArray(subjects) ? subjects : []).forEach((group) => {
    (group.items || []).forEach((item: any) => {
      const subjectId = safeText(item && item.subjectId);
      if (!subjectId || (map as Record<string, any>)[subjectId]) return;
      (map as Record<string, any>)[subjectId] = true;
      ids.push(toQuerySubjectId(subjectId));
    });
  });
  return ids;
}
function unwrapProjectCostRecordsPayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  const source = payload && typeof payload === "object" ? payload : {};
  const data =
    source.data && typeof source.data === "object" ? source.data : source;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.records)) return data.records;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.list)) return data.list;
  return [];
}
function extractValvePointValue(value: any): any {
  if (value == null) return "";
  const valueType = typeof value;
  if (valueType === "string" || valueType === "number") return value;
  if (valueType !== "object") return "";
  return (
    value.valvePoint ||
    value.valveName ||
    value.valveCode ||
    value.name ||
    value.code ||
    value.gate ||
    extractValvePointValue(value.valve)
  );
}
function normalizeValvePoint(value: any) {
  return safeText(extractValvePointValue(value))
    .replace(/\s+/g, "")
    .toUpperCase();
}
function getValveSortScore(value: any) {
  const text = normalizeValvePoint(value);
  const hit = text.match(/^G(\d+)$/i);
  return hit && hit[1] ? Number(hit[1]) : Number.MAX_SAFE_INTEGER;
}
function buildHistoryValveOption(value: any) {
  const valvePoint = normalizeValvePoint(value);
  if (!valvePoint) return null;
  return {
    label: `${valvePoint}阀点`,
    value: valvePoint,
  };
}
function mergeHistoryValveOptions(valveRows: any[] = []) {
  const map = {};
  const pushOption = (value: any) => {
    const option = buildHistoryValveOption(value);
    if (!option || (map as Record<string, any>)[option.value]) return;
    (map as Record<string, any>)[option.value] = option;
  };
  const pushValveRow = (row: any) => {
    pushOption(extractValvePointValue(row));
  };
  (Array.isArray(valveRows) ? valveRows : []).forEach(pushValveRow);
  const currentValve = normalizeValvePoint(
    project.value.gate || queryValve.value,
  );
  return Object.values(map)
    .filter((item: any) => (item as any).value !== currentValve)
    .sort((a: any, b: any) => {
      const aScore = getValveSortScore((a as any).value);
      const bScore = getValveSortScore((b as any).value);
      if (aScore !== bScore) return aScore - bScore;
      return (a as any).value.localeCompare(b.value);
    });
}
async function loadHistoryValveOptions() {
  historyValveLoading.value = true;
  try {
    const valveRows = await getValveList({
      pageNum: 1,
      pageSize: 999999,
    });
    historyValveOptions.value = mergeHistoryValveOptions(valveRows);
  } catch (error) {
    console.warn("[meeting-review] load history valve options failed:", error);
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
function getHistoryValveVersionKey(valvePoint: any) {
  return `gate_${normalizeValvePoint(valvePoint).toLowerCase()}`;
}
function getHistoryValveVersionLabel(valvePoint: any) {
  return `${normalizeValvePoint(valvePoint)}阀点数据`;
}
function ensureHistoryValveVersion(valvePoint: any) {
  const key = getHistoryValveVersionKey(valvePoint);
  const label = getHistoryValveVersionLabel(valvePoint);
  const exists = (extraVersions.value || []).some(
    (item: any) => item && item.key === key,
  );
  if (!exists) {
    extraVersions.value = (extraVersions.value || []).concat({
      key,
      label,
      dot: "history",
      group: "history",
      valvePoint: normalizeValvePoint(valvePoint),
    });
  }
  if (!state.value.compareVersions.includes(key)) {
    state.value.compareVersions = state.value.compareVersions.concat(key);
  }
  ensureStateAfterVersionChange();
  return key;
}
function discardHistoryValveVersion(versionKey: any) {
  const key = safeText(versionKey);
  if (!key) return;
  extraVersions.value = (
    Array.isArray(extraVersions.value) ? extraVersions.value : []
  ).filter((item: any) => safeText(item && item.key) !== key);
  state.value.compareVersions = (
    Array.isArray(state.value.compareVersions)
      ? state.value.compareVersions
      : []
  ).filter((item: any) => item !== key);
  const values = clone(candidateValues.value || {});
  clearCandidateVersionValues(values, key);
  candidateValues.value = values;
  ensureStateAfterVersionChange();
}
function clearCandidateVersionValues(values: any, versionKey: any) {
  Object.keys(values || {}).forEach((subjectId) => {
    const target = values[subjectId];
    if (!target || typeof target !== "object") return;
    delete target[versionKey];
    if (target.trims) delete target.trims[versionKey];
    if (target.years) delete target.years[versionKey];
    if (target.yearTrims) delete target.yearTrims[versionKey];
    if (target.lifecycleImportTrims)
      delete target.lifecycleImportTrims[versionKey];
  });
}
function mergeHistoryValveRecords(versionKey: any, records: any[] = []) {
  const values = clone(candidateValues.value || {});
  clearCandidateVersionValues(values, versionKey);
  if (
    records.length &&
    (!(dimensions.value.years || []).length ||
      !(dimensions.value.trims || []).length)
  ) {
    syncReviewDimensionsFromSourceRecords({ [versionKey]: records });
  }
  records.forEach((record) => {
    appendVersionRecordValue(values, versionKey, record);
  });
  candidateValues.value = applyReviewAggregatesToCandidateValues(
    values,
    subjects.value,
  );
}
async function queryHistoryValveRecords(
  valvePoint: any,
  subjectIds: any[] = [],
) {
  if (!subjectIds.length) return [];
  const rule = HISTORY_VALVE_SOURCE_RULE;
  const params = {
    projectId: queryProjectId.value || project.value.projectId,
    valvePoint: normalizeValvePoint(valvePoint),
    subjectIds,
    nodes: rule.nodes,
  };
  // 历史阀点必须按所选阀点查 S8，不能复用当前详情页 flowId。
  const [historyRecords, mainTableImportRecords] = await Promise.all([
    queryProjectCostRecordsStrict(params, rule),
    queryHistoryValveMainTableImportRecords(valvePoint, subjectIds),
  ]);
  return (historyRecords as any[]).concat(mainTableImportRecords);
}
async function queryHistoryValveMainTableImportRecords(
  valvePoint: any,
  subjectIds: any[] = [],
) {
  if (!subjectIds.length) return [];
  try {
    const payload = await queryProjectCostRecords({
      projectId: queryProjectId.value || project.value.projectId,
      valvePoint: normalizeValvePoint(valvePoint),
      subjectIds,
      nodes: [MAIN_TABLE_IMPORT_NODE],
    });
    const records = unwrapProjectCostRecordsPayload(payload).filter(
      (record: any) =>
        isMainTableReferenceImportRecord(record) &&
        recordHasUsableValue(record),
    );
    const latestBatchRecords = filterLatestRecordBatch(records);
    return selectLatestRecordsByLogicalCell(latestBatchRecords).map(
      (record) => {
        if (!isMainTableLifecycleImportRecord(record)) return record;
        return {
          ...record,
          [IMPORTED_LIFECYCLE_REFERENCE_FLAG]: true,
        };
      },
    );
  } catch (error) {
    console.warn(
      "[meeting-review] load main table import reference records failed:",
      error,
    );
    return [];
  }
}
async function confirmAddHistoryValveVersion() {
  const valvePoint = normalizeValvePoint(historyValvePickerValue.value);
  if (!valvePoint) {
    BaseToast.warning("请选择阀点");
    return;
  }
  const subjectIds = getReviewSubjectIds(subjects.value);
  if (!subjectIds.length) {
    BaseToast.warning("未找到可查询的科目");
    return;
  }

  const versionKey = getHistoryValveVersionKey(valvePoint);
  historyValveLoading.value = true;
  try {
    const records = await queryHistoryValveRecords(valvePoint, subjectIds);
    if (!records.some((record) => recordHasUsableValue(record))) {
      discardHistoryValveVersion(versionKey);
      historyValveDialogVisible.value = false;
      BaseToast.warning(`${valvePoint}阀点暂无数据`);
      return;
    }
    ensureHistoryValveVersion(valvePoint);
    mergeHistoryValveRecords(versionKey, records);
    if (!hasVersionDisplayData(versionKey)) {
      discardHistoryValveVersion(versionKey);
      historyValveDialogVisible.value = false;
      BaseToast.warning(`${valvePoint}阀点暂无数据`);
      return;
    }
    historyValveDialogVisible.value = false;
    BaseToast.success(`已添加${getHistoryValveVersionLabel(valvePoint)}`);
  } catch (error) {
    console.warn("[meeting-review] load history valve records failed:", error);
    BaseToast.error(`${getHistoryValveVersionLabel(valvePoint)}数据加载失败`);
  } finally {
    historyValveLoading.value = false;
  }
}
function normalizeRecordNode(record: any) {
  return safeText(record && record.node).toUpperCase();
}
function normalizeRecordAggregateMode(record: any) {
  return safeText(record && record.yearAggregateMode).toUpperCase();
}
function isMainTableImportRecord(record: any) {
  return normalizeRecordNode(record) === MAIN_TABLE_IMPORT_NODE;
}
function isMainTableReferenceImportRecord(record: any) {
  const mode = normalizeRecordAggregateMode(record);
  return isMainTableImportRecord(record) && mode === "SPECIFIC";
}
function isMainTableLifecycleImportRecord(record: any) {
  return (
    isMainTableImportRecord(record) &&
    normalizeRecordAggregateMode(record) === "COMBINED"
  );
}
function isImportedLifecycleReferenceRecord(record: any) {
  return Boolean(
    record &&
    (record[IMPORTED_LIFECYCLE_REFERENCE_FLAG] ||
      isMainTableLifecycleImportRecord(record)),
  );
}
async function queryProjectCostRecordsStrict(params: any = {}, rule: any = {}) {
  const payload = await queryProjectCostRecords(params);
  const selected = selectSourceRecords(
    unwrapProjectCostRecordsPayload(payload),
    rule,
  );
  return selected.records || [];
}
function normalizeRecordNumberValue(record: any) {
  if (!record || typeof record !== "object") return null;
  const value = readRecordStorageValue(record);
  if (value == null || String(value).trim() === "") return null;
  return safeNumber(String(value).replace(/,/g, ""));
}
function recordHasUsableValue(record: any) {
  return normalizeRecordNumberValue(record) != null;
}
function normalizeRecordSubmitIds(record: any) {
  const source = Array.isArray(record && record.submitIds)
    ? record.submitIds.slice()
    : [];
  [
    record && record.submitId,
    record && record.submissionId,
    record && record.batchId,
    record && record.batchNo,
  ].forEach((item: any) => {
    if (item != null && String(item).trim() !== "") {
      source.push(item);
    }
  });
  return source
    .map((item: any) => Number(item))
    .filter((item: any) => Number.isFinite(item) && item > 0);
}
function getRecordTimeScore(record: any) {
  const text = safeText(record && (record.updatedAt || record.createdAt));
  const time = text ? new Date(text).getTime() : NaN;
  if (Number.isFinite(time)) return time;
  const id = Number(record && (record.id || record.recordId));
  return Number.isFinite(id) ? id : 0;
}
function filterLatestRecordBatch(records: any[] = []) {
  const list = Array.isArray(records) ? records : [];
  if (!list.length) return [];

  let latestSubmitId: any = null;
  list.forEach((record) => {
    normalizeRecordSubmitIds(record).forEach((submitId: any) => {
      if (latestSubmitId == null || submitId > latestSubmitId) {
        latestSubmitId = submitId;
      }
    });
  });
  if (latestSubmitId != null) {
    return list.filter((record) =>
      normalizeRecordSubmitIds(record).includes(latestSubmitId),
    );
  }

  const maxScore = list.reduce(
    (score, record) => Math.max(score, getRecordTimeScore(record)),
    0,
  );
  if (!maxScore) return list;
  return list.filter((record) => getRecordTimeScore(record) === maxScore);
}
function getRecordLatestSubmitId(record: any) {
  const submitIds = normalizeRecordSubmitIds(record);
  if (!submitIds.length) return 0;
  return submitIds.reduce(
    (max: any, submitId: any) => Math.max(max, submitId),
    0,
  );
}
function isRecordNewerThan(left: any, right: any) {
  if (!right) return true;
  const leftSubmitId = getRecordLatestSubmitId(left);
  const rightSubmitId = getRecordLatestSubmitId(right);
  if (leftSubmitId !== rightSubmitId) return leftSubmitId > rightSubmitId;

  const leftTime = getRecordTimeScore(left);
  const rightTime = getRecordTimeScore(right);
  if (leftTime !== rightTime) return leftTime > rightTime;

  const leftId = Number(left && (left.id || left.recordId));
  const rightId = Number(right && (right.id || right.recordId));
  return (
    (Number.isFinite(leftId) ? leftId : 0) >
    (Number.isFinite(rightId) ? rightId : 0)
  );
}
function getRecordLogicalCellKey(record: any) {
  return [
    safeText(record && record.subjectId),
    safeText(record && record.vehicleSourceType).toUpperCase(),
    safeText(record && record.modelName).toLowerCase(),
    safeText(record && record.trimName).toLowerCase(),
    normalizeRecordAggregateMode(record),
    record && record.modelYear != null ? safeText(record.modelYear) : "",
  ].join("::");
}
function selectLatestRecordsByLogicalCell(records: any[] = []) {
  const selectedMap = {};
  const order: any[] = [];
  (Array.isArray(records) ? records : []).forEach((record) => {
    const key = getRecordLogicalCellKey(record);
    if (!key || key === ":::::") return;
    if (!(selectedMap as Record<string, any>)[key]) {
      (selectedMap as Record<string, any>)[key] = record;
      order.push(key);
      return;
    }
    if (isRecordNewerThan(record, (selectedMap as Record<string, any>)[key])) {
      (selectedMap as Record<string, any>)[key] = record;
    }
  });
  return order
    .map((key) => (selectedMap as Record<string, any>)[key])
    .filter(Boolean);
}
function selectSourceRecords(records: any[] = [], rule: any = {}) {
  const source = Array.isArray(records) ? records : [];
  const priorities = Array.isArray(rule.priority) ? rule.priority : [];
  for (let index = 0; index < priorities.length; index += 1) {
    const item = priorities[index];
    const node = safeText(item.node).toUpperCase();
    let matched = source.filter((record) => {
      if (node && normalizeRecordNode(record) !== node) return false;
      return true;
    });
    if (item.latest || matched.length) {
      matched = filterLatestRecordBatch(matched);
    }
    if (matched.some((record) => recordHasUsableValue(record))) {
      return {
        node,
        records: matched,
      };
    }
  }
  return { records: [] };
}
function normalizeRecordYearLabel(record: any) {
  const rawYear =
    record && record.modelYear != null
      ? record.modelYear
      : record && record.year != null
        ? record.year
        : record && record.bizYear != null
          ? record.bizYear
          : "";
  if (String(rawYear).trim() !== "") {
    const text = String(rawYear).trim();
    return /年$/.test(text) ? text : `${text}年`;
  }
  const mode = safeText(record && record.yearAggregateMode).toUpperCase();
  if (mode === "COMBINED") return "全生命周期";
  if (mode === "NONE") return "未区分";
  return "";
}
function getYearSortValue(value: any) {
  const text = safeText(value);
  const hit = text.match(/(\d{4})/);
  if (hit && hit[1]) return Number(hit[1]);
  if (normalizeYearMatchKey(text) === "lifecycle")
    return Number.MAX_SAFE_INTEGER;
  return Number.MAX_SAFE_INTEGER - 1;
}
function sortYearLabels(labels: any[] = []) {
  return (Array.isArray(labels) ? labels : [])
    .slice()
    .sort((a: any, b: any) => {
      const aScore = getYearSortValue(a);
      const bScore = getYearSortValue(b);
      if (aScore !== bScore) return aScore - bScore;
      return safeText(a).localeCompare(safeText(b), "zh-Hans-CN");
    });
}
function isSubtotalTrimLabel(value: any) {
  const text = safeText(value);
  return text === "小计" || text === "合计";
}
function isLifecycleYearIndex(yearIndex: any) {
  const years = Array.isArray(dimensions.value.years)
    ? dimensions.value.years
    : [];
  return normalizeYearMatchKey(years[Number(yearIndex)]) === "lifecycle";
}
function getLifecycleYearIndex() {
  const years = Array.isArray(dimensions.value.years)
    ? dimensions.value.years
    : [];
  return years.findIndex(
    (item: any) => normalizeYearMatchKey(item) === "lifecycle",
  );
}
function getSourceYearIndexes() {
  const years = Array.isArray(dimensions.value.years)
    ? dimensions.value.years
    : [];
  return years
    .map((item: any, index: any) => ({ item, index }))
    .filter(({ item }: any) => normalizeYearMatchKey(item) !== "lifecycle")
    .map(({ index }: any) => index);
}
function syncReviewDimensionsFromSourceRecords(sourceMap: any = {}) {
  const recordYears: any[] = [];
  const trimLabels: any[] = [];
  const yearSeen = {};
  const trimSeen = {};
  Object.keys(sourceMap || {}).forEach((versionKey) => {
    const records = Array.isArray(
      (sourceMap as Record<string, any>)[versionKey],
    )
      ? (sourceMap as Record<string, any>)[versionKey]
      : [];
    records.forEach((record: any) => {
      const yearLabel = normalizeRecordYearLabel(record);
      const yearKey = normalizeYearMatchKey(yearLabel);
      if (
        yearLabel &&
        yearKey &&
        yearKey !== "lifecycle" &&
        !(yearSeen as Record<string, any>)[yearKey]
      ) {
        (yearSeen as Record<string, any>)[yearKey] = true;
        recordYears.push(yearLabel);
      }

      const trimLabel = normalizeRecordTrimLabel(record);
      if (
        trimLabel &&
        !isSubtotalTrimLabel(trimLabel) &&
        !(trimSeen as Record<string, any>)[trimLabel]
      ) {
        (trimSeen as Record<string, any>)[trimLabel] = true;
        trimLabels.push(trimLabel);
      }
    });
  });

  if (!recordYears.length && !trimLabels.length) return;

  const years = sortYearLabels(recordYears);
  if (!years.some((item: any) => normalizeYearMatchKey(item) === "lifecycle")) {
    years.push("全生命周期");
  }

  const trims = trimLabels.length
    ? trimLabels.concat("小计")
    : ["未区分版型", "小计"];
  const previousFactors = Array.isArray(dimensions.value.yearFactors)
    ? dimensions.value.yearFactors
    : [];
  dimensions.value = {
    years,
    trims,
    yearFactors: years.map((year, index) => {
      if (normalizeYearMatchKey(year) === "lifecycle") return 1;
      const factor = Number(previousFactors[index]);
      return Number.isFinite(factor) ? factor : 1;
    }),
  };
}
function getYearIndexForRecord(record: any) {
  const years = Array.isArray(dimensions.value.years)
    ? dimensions.value.years
    : [];
  const yearKey = normalizeYearMatchKey(normalizeRecordYearLabel(record));
  if (yearKey) {
    const index = years.findIndex(
      (item: any) => normalizeYearMatchKey(item) === yearKey,
    );
    if (index >= 0) return index;
  }
  return 0;
}
function normalizeRecordTrimLabel(record: any) {
  return safeText(
    record &&
      (record.trimName ||
        record.trim ||
        record.trimCode ||
        record.modelName ||
        record.modelCode),
    "未区分版型",
  );
}
function getTrimIndexForRecord(record: any) {
  const trims = Array.isArray(dimensions.value.trims)
    ? dimensions.value.trims
    : [];
  if (!trims.length) return 0;
  const trimName = normalizeRecordTrimLabel(record);
  const index = trims.findIndex((item: any) => safeText(item) === trimName);
  return index >= 0 ? index : null;
}
function appendVersionRecordValue(values: any, versionKey: any, record: any) {
  const subjectId = safeText(record && record.subjectId);
  const value = normalizeRecordNumberValue(record);
  if (!subjectId || value == null) return;

  if (!values[subjectId]) {
    values[subjectId] = {
      trims: {},
      years: {},
      yearTrims: {},
    };
  }
  const target = values[subjectId];
  if (!target.trims) target.trims = {};
  if (!target.years) target.years = {};
  if (!target.yearTrims) target.yearTrims = {};
  if (!target.trims[versionKey]) target.trims[versionKey] = [];
  if (!target.years[versionKey]) target.years[versionKey] = {};
  if (!target.yearTrims[versionKey]) target.yearTrims[versionKey] = {};

  const yearIndex = getYearIndexForRecord(record);
  const trimIndex = getTrimIndexForRecord(record);
  if (!Number.isInteger(trimIndex)) return;
  if (!target.yearTrims[versionKey][yearIndex]) {
    target.yearTrims[versionKey][yearIndex] = [];
  }
  target.yearTrims[versionKey][yearIndex][trimIndex] = value;

  if (trimIndex === getDefaultTrimIndex()) {
    target.years[versionKey][yearIndex] = value;
  }
  if (yearIndex === 0) {
    target.trims[versionKey][trimIndex] = value;
    if (trimIndex === getDefaultTrimIndex() || target[versionKey] == null) {
      target[versionKey] = value;
    }
  }
  if (target[versionKey] == null) {
    target[versionKey] = value;
  }
  if (
    isImportedLifecycleReferenceRecord(record) &&
    isLifecycleYearIndex(yearIndex)
  ) {
    if (!target.lifecycleImportTrims) target.lifecycleImportTrims = {};
    if (!target.lifecycleImportTrims[versionKey])
      target.lifecycleImportTrims[versionKey] = {};
    target.lifecycleImportTrims[versionKey][trimIndex] = true;
  }
}
function findReviewSubjectByTemplateId(
  templateId: any,
  subjectList: any = subjects.value,
) {
  const expected = safeText(templateId);
  if (!expected) return null;
  for (
    let groupIndex = 0;
    groupIndex < (Array.isArray(subjectList) ? subjectList : []).length;
    groupIndex += 1
  ) {
    const group = subjectList[groupIndex];
    const items = Array.isArray(group && group.items) ? group.items : [];
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      const keys = resolveSubjectValueKeys(item);
      if (keys.includes(expected)) return { group, item };
    }
  }
  return null;
}
function getReviewSubjectPathCandidates(item: any, group: any) {
  const groupName = safeText(group && (group.group || group.name));
  const itemName = safeText(item && item.name);
  const formulaMeta = getReviewFormulaMeta(item, group);
  const subjectPath = Array.isArray(item && item.subjectPath)
    ? item.subjectPath.join("/")
    : safeText(item && item.subjectPath);
  return [
    subjectPath,
    formulaMeta && formulaMeta.targetPath,
    resolveCalcSubjectPath(item, group),
    ["主表", groupName, itemName].filter(Boolean).join("/"),
  ].filter(Boolean);
}
function findReviewSubjectByPath(path: any, subjectList: any = subjects.value) {
  const expected = normalizeSubjectMatchName(path);
  if (!expected) return null;
  let fallback = null;
  for (
    let groupIndex = 0;
    groupIndex < (Array.isArray(subjectList) ? subjectList : []).length;
    groupIndex += 1
  ) {
    const group = subjectList[groupIndex];
    const items = Array.isArray(group && group.items) ? group.items : [];
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      const candidates = getReviewSubjectPathCandidates(item, group)
        .map((candidate) => normalizeSubjectMatchName(candidate))
        .filter(Boolean);
      if (candidates.includes(expected)) return { group, item };
      if (
        !fallback &&
        candidates.some(
          (candidate) =>
            candidate.endsWith(expected) || expected.endsWith(candidate),
        )
      ) {
        fallback = { group, item };
      }
    }
  }
  return fallback;
}
function getReviewFormulaMeta(item: any, group: any) {
  const itemName = safeText(item && (item.name || item.subjectName));
  const groupName = safeText(group && group.group);
  const targetPath = safeText(
    Array.isArray(item && item.subjectPath)
      ? item.subjectPath.join("/")
      : item && item.subjectPath,
    ["主表", groupName, itemName].filter(Boolean).join("/"),
  );
  const entryMode = safeText(
    item && (item.entryMode || item.templateEntryMode),
  ).toUpperCase();
  const rowKind =
    safeText(item && (item.rowKind || item.rowType)) ||
    (entryMode === "CALCULATED"
      ? REVENUE_ROW_KIND.FORMULA
      : entryMode === "DATA_QUERY"
        ? REVENUE_ROW_KIND.LINKED
        : entryMode === "MANUAL"
          ? REVENUE_ROW_KIND.INPUT
          : "");
  const valueSource =
    safeText(item && (item.valueSource || item.sourceType)) ||
    (entryMode === "CALCULATED"
      ? REVENUE_VALUE_SOURCE.FORMULA
      : entryMode === "DATA_QUERY"
        ? REVENUE_VALUE_SOURCE.LINKED
        : entryMode === "MANUAL"
          ? REVENUE_VALUE_SOURCE.INPUT
          : "");
  const formulaKey = safeText(item && (item.formulaCode || item.formulaKey));
  const formulaExpression = safeText(
    item && (item.formulaExpression || item.expression),
  );
  // 有公式表达式时也要保留元数据，避免现场测算丢公式
  if (
    !entryMode &&
    !rowKind &&
    !valueSource &&
    !formulaKey &&
    !formulaExpression &&
    !(item && item.formulaId)
  )
    return null;
  return {
    code: formulaKey,
    formulaKey,
    formulaCode: formulaKey,
    formulaId: item && item.formulaId,
    formulaName: safeText(item && item.formulaName),
    formulaExpression,
    targetPath,
    rowKind,
    valueSource,
    entryMode,
    templateEntryMode: entryMode,
    aggregateFormula: safeText(item && item.aggregateFormula),
    lifecycleFormula: safeText(
      item && (item.lifecycleFormula || item.lifecycleAggregateFormula),
    ),
    // 比率小计：透出分子分母路径与公式参数绑定，供 S8 聚合引擎对齐 S1
    ratioNumeratorPath: safeText(item && item.ratioNumeratorPath),
    ratioDenominatorPath: safeText(item && item.ratioDenominatorPath),
    formulaParamBindings:
      item && item.formulaParamBindings != null
        ? item.formulaParamBindings
        : [],
  };
}
/**
 * 构造与 S1 矩阵行同构的轻量对象，供 matrix-utils 选择函数复用同一套聚合规则
 */
function buildReviewAggregateRow(item: any, group: any) {
  const meta = resolveCalcSubjectMeta(item, group) || {};
  return {
    ...item,
    ...meta,
    unit: safeText(item && item.unit),
    moduleName: "主表",
    rootSubjectName: "主表",
  };
}
/**
 * S8 年小计 / 全生命周期公式选择：直接复用 S1 的 matrix-utils 选择函数（上会口径以 S1 为准）
 * @param {string} [scope="year"] year=年小计，lifecycle=全生命周期
 */
function getReviewAggregateFormula(item: any, group: any, scope = "year") {
  const row = buildReviewAggregateRow(item, group);
  if (String(scope || "year").toLowerCase() === "lifecycle") {
    return String(resolveLifecycleFormula(row) || "sum_year").toLowerCase();
  }
  return String(
    resolveSubtotalAggregateFormula(row) || "weighted_by_mix",
  ).toLowerCase();
}
function toAggregateNumber(value: any) {
  if (value == null || String(value).trim() === "") return null;
  const num = safeNumber(value);
  return num == null ? null : num;
}
function applyReviewAggregatesToCandidateValues(
  values: any = {},
  subjects: any[] = [],
) {
  return applyMainReviewFormulaAggregatesToValues(values, subjects, {
    yearIndexes: getSourceYearIndexes(),
    lifecycleIndex: getLifecycleYearIndex(),
    subtotalTrimIndex: getDefaultTrimIndex(),
    trimCount: (dimensions.value.trims || []).length,
    safeText: (value: any, fallback: any) => safeText(value, fallback),
    toAggregateNumber: (value: any) => toAggregateNumber(value),
    roundNumber: (value: any, digits: any) => roundNumber(value, digits),
    resolveSubjectValueKeys: (itemOrId: any) =>
      resolveSubjectValueKeys(itemOrId),
    findReviewSubjectByTemplateId: (templateId: any, sourceSubjects: any) =>
      findReviewSubjectByTemplateId(templateId, sourceSubjects),
    findReviewSubjectByPath: (path: any, sourceSubjects: any) =>
      findReviewSubjectByPath(path, sourceSubjects),
    getReviewFormulaMeta: (item: any, group: any) =>
      getReviewFormulaMeta(item, group),
    getReviewAggregateFormula: (item: any, group: any, scope: any) =>
      getReviewAggregateFormula(item, group, scope),
  });
}
function buildCandidateValuesFromSourceRecords(
  sourceMap: any = {},
  subjects: any[] = [],
) {
  syncReviewDimensionsFromSourceRecords(sourceMap);
  const values = {};
  Object.keys(sourceMap).forEach((versionKey) => {
    const records = Array.isArray(
      (sourceMap as Record<string, any>)[versionKey],
    )
      ? (sourceMap as Record<string, any>)[versionKey]
      : [];
    records.forEach((record: any) => {
      appendVersionRecordValue(values, versionKey, record);
    });
  });
  return applyReviewAggregatesToCandidateValues(values, subjects);
}
async function queryReviewSourceRecords(
  versionKey: any,
  subjectIds: any[] = [],
  options: any = {},
) {
  const rule = (REVIEW_SOURCE_QUERY_RULES as Record<string, any>)[versionKey];
  if (!rule || !subjectIds.length) return [];

  const params = {
    projectId: queryProjectId.value || project.value.projectId,
    valvePoint: project.value.gate || queryValve.value,
    subjectIds,
    nodes: rule.nodes,
  };
  const flowId = toQueryFlowId(queryFlowId.value || project.value.flowId);
  if (flowId) (params as any).flowId = flowId;
  try {
    return await queryProjectCostRecordsStrict(params, rule);
  } catch (error) {
    console.warn(`[meeting-review] load ${versionKey} records failed:`, error);
    if (options && options.throwOnError) {
      throw error;
    }
    return [];
  }
}

function getMeetingModuleKey(group: any = {}) {
  return safeText(group && (group.group || group.name), "未分组");
}

function buildMeetingModuleLoadPlan(subjects: any[] = []) {
  return (Array.isArray(subjects) ? subjects : [])
    .map((group, index) => {
      const subjectIds: any[] = [];
      (Array.isArray(group.items) ? group.items : []).forEach((item: any) => {
        const id = safeText(
          item && (item.subjectId || item.id || item.subjectCode),
        );
        if (id && !subjectIds.includes(id)) subjectIds.push(id);
      });
      if (!subjectIds.length) return null;
      const key = getMeetingModuleKey(group) || `module_${index + 1}`;
      return {
        key,
        moduleKey: key,
        moduleName: formatSubjectGroupLabel(group),
        subjectIds,
        orderIndex: index,
      };
    })
    .filter(Boolean);
}

function initializeMeetingModuleLoading(subjects: any[] = []) {
  const plans = buildMeetingModuleLoadPlan(subjects);
  moduleLoadPlan.value = plans;
  moduleRecordMap.value = {};
  const stateMap = {};
  plans.forEach((plan) => {
    (stateMap as Record<string, any>)[(plan as any).moduleKey] = {
      status: "idle",
      moduleKey: (plan as any).moduleKey,
      moduleName: (plan as any).moduleName,
      message: "",
    };
  });
  moduleLoadStateMap.value = stateMap;
}

function getMeetingModuleState(group: any = {}) {
  const key = getMeetingModuleKey(group);
  return key
    ? (moduleLoadStateMap.value as Record<string, any>)[key] || {
        status: "idle",
      }
    : { status: "idle" };
}

function isMeetingModuleLoading(group: any = {}) {
  return getMeetingModuleState(group).status === "loading";
}

function isMeetingModuleError(group: any = {}) {
  return getMeetingModuleState(group).status === "error";
}

function setMeetingModuleState(plan: any = {}, nextState: any = {}) {
  const key = plan.moduleKey || plan.key;
  if (!key) return;
  const previous = (moduleLoadStateMap.value as Record<string, any>)[key] || {};
  (moduleLoadStateMap.value as Record<string, any>)[key] = {
    ...previous,
    ...nextState,
    moduleKey: key,
    moduleName: plan.moduleName || previous.moduleName || "",
  };
}

function formatMeetingModuleTraceTime(value: any) {
  const date = new Date(value);
  const pad = (num: any, size = 2) => String(num).padStart(size, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
    `${pad(date.getMilliseconds(), 3)}`
  );
}

function getMeetingModuleTraceNow() {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
}

function logMeetingModuleLoad(phase: any, trace: any = {}, detail: any = {}) {
  const now = getMeetingModuleTraceNow();
  const wallAt = Date.now();
  console.groupCollapsed(
    `[收益模块加载] ${phase} ${formatMeetingModuleTraceTime(wallAt)} ` +
      `/revenue/meeting-review-detail / ${trace.moduleName || trace.moduleKey || "-"}`,
  );
  console.log("页面", "/revenue/meeting-review-detail");
  console.log("模块", trace.moduleName || trace.moduleKey || "-");
  console.log(
    "开始时间",
    trace.startedWallAt
      ? formatMeetingModuleTraceTime(trace.startedWallAt)
      : "-",
  );
  console.log(
    phase === "开始" ? "当前时间" : "返回时间",
    formatMeetingModuleTraceTime(wallAt),
  );
  console.log(
    "耗时(ms)",
    trace.startedAt != null ? Math.round(now - trace.startedAt) : 0,
  );
  console.log(
    "subjectIds数量",
    Array.isArray(trace.subjectIds) ? trace.subjectIds.length : 0,
  );
  console.log("详情", detail || {});
  console.groupEnd();
}

function rebuildCandidateValuesFromLoadedModules() {
  const sourceMap: Record<string, any> = {};
  Object.keys(moduleRecordMap.value || {}).forEach((moduleKey) => {
    const moduleMap =
      (moduleRecordMap.value as Record<string, any>)[moduleKey] || {};
    Object.keys(moduleMap).forEach((versionKey) => {
      if (!(sourceMap as Record<string, any>)[versionKey])
        sourceMap[versionKey] = [];
      (sourceMap as Record<string, any>)[versionKey].push(
        ...(Array.isArray(moduleMap[versionKey]) ? moduleMap[versionKey] : []),
      );
    });
  });
  candidateValues.value = buildCandidateValuesFromSourceRecords(
    sourceMap,
    subjects.value,
  );
}

async function loadSingleMeetingModule(plan: any = {}, options: any = {}) {
  if (!plan || !Array.isArray(plan.subjectIds) || !plan.subjectIds.length)
    return false;
  const trace = {
    moduleKey: plan.moduleKey,
    moduleName: plan.moduleName,
    subjectIds: plan.subjectIds,
    startedAt: getMeetingModuleTraceNow(),
    startedWallAt: Date.now(),
  };
  setMeetingModuleState(plan, {
    status: "loading",
    message: `${plan.moduleName || "当前模块"}数据加载中`,
  });
  logMeetingModuleLoad("开始", trace);
  try {
    const pairs = await Promise.all(
      DECISION_SOURCE_VERSION_KEYS.map(async (versionKey) => [
        versionKey,
        await queryReviewSourceRecords(versionKey, plan.subjectIds, {
          throwOnError: true,
        }),
      ]),
    );
    if (options.runId && options.runId !== moduleLoadRunId.value) return null;
    const moduleMap: Record<string, any> = {};
    pairs.forEach(([versionKey, records]: any) => {
      moduleMap[versionKey] = Array.isArray(records) ? records : [];
    });
    (moduleRecordMap.value as Record<string, any>)[plan.moduleKey] = moduleMap;
    rebuildCandidateValuesFromLoadedModules();
    setMeetingModuleState(plan, {
      status: "loaded",
      message: "",
      loadedAt: Date.now(),
    });
    logMeetingModuleLoad("完成", trace, {
      versions: Object.keys(moduleMap),
    });
    return true;
  } catch (error) {
    if (options.runId && options.runId !== moduleLoadRunId.value) return null;
    setMeetingModuleState(plan, {
      status: "error",
      message:
        (error && (error as any).message) ||
        `${plan.moduleName || "当前模块"}数据加载失败`,
      error,
    });
    logMeetingModuleLoad("失败", trace, { error });
    return false;
  }
}

async function loadMeetingModulesSerially() {
  const plans = Array.isArray(moduleLoadPlan.value) ? moduleLoadPlan.value : [];
  if (!plans.length) return;
  const runId = ++moduleLoadRunId.value;
  const startedAt = getMeetingModuleTraceNow();
  const startedWallAt = Date.now();
  let successCount = 0;
  let errorCount = 0;
  for (let index = 0; index < plans.length; index += 1) {
    if (runId !== moduleLoadRunId.value) return;

    const result = await loadSingleMeetingModule(plans[index], { runId });
    if (result === true) successCount += 1;
    if (result === false) errorCount += 1;
  }
  logMeetingModuleLoad(
    "全部完成",
    {
      moduleName: `成功 ${successCount} 失败 ${errorCount}`,
      subjectIds: [],
      startedAt,
      startedWallAt,
    },
    {
      totalCount: plans.length,
      successCount,
      errorCount,
    },
  );
}

async function retryMeetingModule(group: any = {}) {
  const key = getMeetingModuleKey(group);
  const plan = (moduleLoadPlan.value || []).find(
    (item: any) => item.moduleKey === key,
  );
  if (!plan || isMeetingModuleLoading(group)) return;
  await loadSingleMeetingModule(plan);
}

async function _loadReviewCandidateValues(subjects: any[] = []) {
  const subjectIds = getReviewSubjectIds(subjects);
  if (!subjectIds.length) return {};
  const sourceMap = {};
  await Promise.all(
    DECISION_SOURCE_VERSION_KEYS.map(async (versionKey) => {
      (sourceMap as Record<string, any>)[versionKey] =
        await queryReviewSourceRecords(versionKey, subjectIds);
    }),
  );
  return buildCandidateValuesFromSourceRecords(sourceMap, subjects);
}
function buildTreeSubjectItem(
  node: any,
  depth = 0,
  fallbackId = "",
  groupName = "",
) {
  const rawItemId = safeText(node && node.id, fallbackId || "subject");
  const itemName = safeText(node && node.name, rawItemId);
  const safeDepth = Math.max(0, Number(depth) || 0);
  const indent = safeDepth > 0 ? "　".repeat(Math.min(safeDepth, 6)) : "";
  const templateId = inferTemplateId(
    { ...node, id: rawItemId, name: itemName },
    groupName,
  );
  return {
    // 保留模板公式元数据，供 S8 年小计/生命周期比率聚合使用
    ...node,
    id: templateId || rawItemId,
    templateId,
    subjectId: safeText(node && node.subjectId, rawItemId),
    subjectCode: safeText(node && node.subjectCode),
    name: `${indent}${itemName}`,
    unit: safeText(node && node.unit),
    entryMode: safeText(node && (node.entryMode || node.templateEntryMode)),
    templateEntryMode: safeText(
      node && (node.templateEntryMode || node.entryMode),
    ),
    formulaId: node && node.formulaId,
    formulaCode: safeText(node && (node.formulaCode || node.formulaKey)),
    formulaKey: safeText(node && (node.formulaKey || node.formulaCode)),
    formulaName: safeText(node && node.formulaName),
    formulaExpression: safeText(
      node && (node.formulaExpression || node.expression),
    ),
    formulaParamBindings: node && node.formulaParamBindings,
    ratioNumeratorPath: safeText(node && node.ratioNumeratorPath),
    ratioDenominatorPath: safeText(node && node.ratioDenominatorPath),
    aggregateFormula: safeText(node && node.aggregateFormula),
    lifecycleFormula: safeText(
      node && (node.lifecycleFormula || node.lifecycleAggregateFormula),
    ),
    rowKind: safeText(node && (node.rowKind || node.rowType)),
    valueSource: safeText(node && (node.valueSource || node.sourceType)),
    bold:
      Boolean(node && node.leaf === false) ||
      ["fixed_total", "margin", "op_profit", "proj_profit"].includes(
        templateId,
      ),
  };
}
function collectGroupItemsFromTree(
  node: any,
  depth = 0,
  bucket: any[] = [],
  fallbackPrefix = "subject",
  groupName = "",
) {
  if (!node) return;
  const children = Array.isArray(node.children) ? node.children : [];
  if (!children.length || node.leaf) {
    bucket.push(buildTreeSubjectItem(node, depth, fallbackPrefix, groupName));
    return;
  }

  bucket.push(
    buildTreeSubjectItem(node, depth, `${fallbackPrefix}_parent`, groupName),
  );
  children.forEach((child: any, index: any) => {
    collectGroupItemsFromTree(
      child,
      depth + 1,
      bucket,
      `${fallbackPrefix}_${index}`,
      groupName,
    );
  });
}
function buildSubjectsFromTree(nodes: any[] = []) {
  const normalizedRoots = unwrapMainRootNodes(normalizeSubjectTreeNodes(nodes));
  if (!normalizedRoots.length) return [];

  const groups: any[] = [];
  const ungroupedItems: any[] = [];

  normalizedRoots.forEach((root, rootIndex) => {
    if (!root) return;
    const children = Array.isArray(root.children) ? root.children : [];
    if (!children.length || root.leaf) {
      ungroupedItems.push(
        buildTreeSubjectItem(root, 0, `ungrouped_${rootIndex}`),
      );
      return;
    }

    const items: any[] = [];
    const groupName = safeText(root.name, `分组${rootIndex + 1}`);
    children.forEach((child: any, childIndex: any) => {
      collectGroupItemsFromTree(
        child,
        0,
        items,
        `${root.id || `root_${rootIndex}`}_${childIndex}`,
        groupName,
      );
    });

    if (!items.length) return;
    groups.push({
      group: groupName,
      items,
    });
  });

  if (ungroupedItems.length) {
    groups.unshift({
      group: "未分组",
      items: ungroupedItems,
    });
  }
  return groups;
}
function resolveDisplaySubjects(payloadSubjects: any[] = []) {
  if (isGroupedSubjects(payloadSubjects)) {
    return normalizeGroupedSubjects(payloadSubjects);
  }
  return buildSubjectsFromTree(payloadSubjects);
}
function resolveCalcSubjectPath(
  item: any,
  group: any,
  matchedSubject: any = {},
) {
  const itemName = safeText(item && item.name).replace(/^[\s\u3000]+/, "");
  const groupName = safeText(group && (group.group || group.name));
  const matchedPath = Array.isArray(matchedSubject && matchedSubject.pathNames)
    ? matchedSubject.pathNames.join("/")
    : Array.isArray(item && item.subjectPath)
      ? item.subjectPath.join("/")
      : safeText(item && item.subjectPath);
  return matchedPath
    ? normalizeSubjectMatchName(matchedPath).startsWith(
        normalizeSubjectMatchName("主表"),
      )
      ? matchedPath
      : ["主表", matchedPath].filter(Boolean).join("/")
    : ["主表", groupName, itemName].filter(Boolean).join("/");
}
function resolveCalcSubjectMeta(
  item: any,
  group: any,
  matchedSubject: any = {},
) {
  const itemName = safeText(item && item.name).replace(/^[\s\u3000]+/, "");
  const subjectPath = resolveCalcSubjectPath(item, group, matchedSubject);
  const meta =
    getReviewFormulaMeta(
      {
        ...item,
        ...matchedSubject,
        name: itemName,
        subjectName: itemName,
        subjectPath,
      },
      group,
    ) || {};
  return {
    ...meta,
    subject: itemName,
    subjectName: itemName,
    subjectPath,
    fullNamePath: subjectPath,
    subtable: "主表",
    moduleCode: REVENUE_MODULE_CODE.MAIN_PNL,
  };
}
function isCalcInputSubject(item: any, group: any) {
  if (!item || typeof item !== "object") return false;
  const rowKind = safeText(item.rowKind || item.rowType).toLowerCase();
  if (rowKind) {
    return [
      REVENUE_ROW_KIND.INPUT,
      REVENUE_ROW_KIND.LINKED,
      REVENUE_ROW_KIND.EXTERNAL,
    ]
      .map((item: any) => String(item).toLowerCase())
      .includes(rowKind);
  }
  const valueSource = safeText(
    item.valueSource || item.sourceType,
  ).toLowerCase();
  if (valueSource) {
    return [
      REVENUE_VALUE_SOURCE.INPUT,
      REVENUE_VALUE_SOURCE.LINKED,
      REVENUE_VALUE_SOURCE.EXTERNAL,
      "fromsubtable",
      "subtable",
      "derivedfromsubtable",
    ].includes(valueSource);
  }
  const type = safeText(item.type).toLowerCase();
  if (type) return type === REVENUE_ROW_KIND.INPUT;
  const inputType = safeText(item.inputType).toLowerCase();
  if (inputType)
    return !["calc", "formula", "computed", "calculation", "readonly"].includes(
      inputType,
    );

  const formulaMeta = getReviewFormulaMeta(item, group);
  if (!formulaMeta) return true;
  return ![
    REVENUE_ROW_KIND.FORMULA,
    REVENUE_ROW_KIND.ROW_SUBTOTAL,
    REVENUE_ROW_KIND.DISPLAY_AGGREGATE,
  ]
    .map((item: any) => String(item).toLowerCase())
    .includes(safeText(formulaMeta.rowKind).toLowerCase());
}
function orderCalcEditableFields(fields: any[] = []) {
  const next = Array.isArray(fields) ? fields.slice() : [];
  const designIndex = next.findIndex(
    (field) => field && field.id === "design_cost",
  );
  const volumeIndex = next.findIndex((field) => {
    if (!field) return false;
    return field.id === "proj_vol" || safeText(field.label) === "销量";
  });
  if (designIndex < 0 || volumeIndex < 0 || volumeIndex < designIndex)
    return next;
  const [volumeField] = next.splice(volumeIndex, 1);
  const nextDesignIndex = next.findIndex(
    (field) => field && field.id === "design_cost",
  );
  next.splice(Math.max(nextDesignIndex, 0), 0, volumeField);
  return next;
}
function buildCalcEditableFields(subjects: any[] = []) {
  const fields: any[] = [];
  const seen = {};
  (Array.isArray(subjects) ? subjects : []).forEach((group) => {
    (group.items || []).forEach((item: any) => {
      if (!isCalcInputSubject(item, group)) return;
      const id = safeText(item && (item.templateId || item.id));
      if (!id || (seen as Record<string, any>)[id]) return;
      (seen as Record<string, any>)[id] = true;
      fields.push({
        id,
        label: safeText(item && item.name, id).replace(/^[\s\u3000]+/, ""),
        unit: safeText(item && item.unit, group && group.unit),
        rowKind: safeText(item && item.rowKind),
        valueSource: safeText(item && item.valueSource),
      });
    });
  });
  return orderCalcEditableFields(fields);
}
function normalizeState(state: any = {}) {
  const next = {
    ...clone(DEFAULT_STATE),
    ...(state && typeof state === "object" ? clone(state) : {}),
  };

  const calcVersions = Array.isArray(next.calcVersions)
    ? next.calcVersions
    : [];
  let maxSeed = Number(next.calcVersionSeed) || 0;
  next.calcVersions = calcVersions
    .map((item: any, index: any) => {
      if (!item || typeof item !== "object") return null;
      const key = safeText(item.key, `calc_v${index + 1}`);
      if (!key) return null;
      const hit = key.match(/^calc_v(\d+)$/);
      if (hit && hit[1]) {
        maxSeed = Math.max(maxSeed, Number(hit[1]) || 0);
      }
      return {
        key,
        label: safeText(item.label, `测算值v${index + 1}`),
        dot: "calc",
        group: "calc",
        values:
          item.values && typeof item.values === "object"
            ? clone(item.values)
            : {},
        calcMode: item.calcMode === "mix" ? "mix" : "single",
        mixScenario:
          item.mixScenario && typeof item.mixScenario === "object"
            ? clone(item.mixScenario)
            : null,
      };
    })
    .filter(Boolean);
  next.calcVersionSeed = maxSeed;

  const fixedVersionKeys = FIXED_REVIEW_VERSION_CATALOG.map(
    (item: any) => item.key,
  );
  const extraVersionKeys = (dynamicExtraVersions as any).value.map(
    (item: any) => item.key,
  );
  const calcVersionKeys = next.calcVersions.map((item: any) => item.key);
  const allKeys = fixedVersionKeys.concat(extraVersionKeys, calcVersionKeys);
  const compareVersionKeys = FIXED_COMPARE_VERSION_KEYS.concat(
    extraVersionKeys,
    calcVersionKeys,
  );
  const compareKeyOrder = compareVersionKeys.reduce((map, key, index) => {
    (map as Record<string, any>)[key] = index;
    return map;
  }, {});

  next.baselineVersion = BASELINE_VERSION_KEY;

  const seen = {};
  const compare = Array.isArray(next.compareVersions)
    ? next.compareVersions
    : [];
  next.compareVersions = compare
    .map((key: any) => safeText(key))
    .filter((key: any) => key && compareVersionKeys.includes(key))
    .filter((key: any) => {
      if ((seen as Record<string, any>)[key]) return false;
      (seen as Record<string, any>)[key] = true;
      return true;
    })
    .sort(
      (a: any, b: any) =>
        (compareKeyOrder as Record<string, any>)[a] - compareKeyOrder[b],
    );

  if (!next.compareVersions.includes(REQUIRED_COMPARE_VERSION_KEY)) {
    next.compareVersions.unshift(REQUIRED_COMPARE_VERSION_KEY);
  }
  next.compareVersions = next.compareVersions.sort(
    (a: any, b: any) =>
      (compareKeyOrder as Record<string, any>)[a] - compareKeyOrder[b],
  );

  next.viewMode = next.viewMode === "detail" ? "detail" : "compare";
  const allowedYearIndexes = defaultYearIndexes.value;
  const allowedYearMap = allowedYearIndexes.reduce((map, item) => {
    (map as Record<string, any>)[item] = true;
    return map;
  }, {});
  const activeYearsUserSelected = Boolean(next.activeYearsUserSelected);
  next.activeYears = buildMainTableNormalizedSelectedYearIndexes(
    next.activeYears,
    reviewYearOptions.value,
    { expandLegacyDefault: !activeYearsUserSelected },
  ).filter((item: any) => (allowedYearMap as Record<string, any>)[item]);
  next.activeYearsUserSelected = activeYearsUserSelected;
  next.activeYear = next.activeYears[0] || allowedYearIndexes[0] || 0;

  const trimCount = (dimensions.value.trims || []).length;
  const defaultTrimIndex = getDefaultTrimIndex();
  const trimMap = {};
  next.activeTrims = (
    Array.isArray(next.activeTrims) ? next.activeTrims : [defaultTrimIndex]
  )
    .map((item: any) => Number(item))
    .filter(
      (item: any) => Number.isInteger(item) && item >= 0 && item < trimCount,
    )
    .filter((item: any) => {
      if ((trimMap as Record<string, any>)[item]) return false;
      (trimMap as Record<string, any>)[item] = true;
      return true;
    })
    .sort((a: any, b: any) => a - b);
  if (!next.activeTrims.length) {
    next.activeTrims = trimCount > 0 ? [defaultTrimIndex] : [0];
  }

  next.autoDiff = Boolean(next.autoDiff);
  next.deltaMode = Boolean(next.deltaMode);

  if (!allKeys.includes(next.calcBaseVersion)) {
    next.calcBaseVersion = next.baselineVersion || BASELINE_VERSION_KEY;
  }

  const calcBaseYearValues = calcBaseYearOptions.value.map((item: any) =>
    Number(item.value),
  );
  const calcBaseYear = Number(next.calcBaseYear);
  next.calcBaseYear = calcBaseYearValues.includes(calcBaseYear)
    ? calcBaseYear
    : calcBaseYearValues[0] != null
      ? calcBaseYearValues[0]
      : 0;

  next.calcDraftValues =
    next.calcDraftValues && typeof next.calcDraftValues === "object"
      ? clone(next.calcDraftValues)
      : {};
  next.calcMode = next.calcMode === "mix" ? "mix" : "single";
  next.calcMixInputMode = next.calcMixInputMode === "volume" ? "volume" : "mix";
  next.calcMixLockTotalVolume = next.calcMixLockTotalVolume !== false;

  next.activeCalcVersionKey = safeText(next.activeCalcVersionKey);
  const hasActiveCalc = next.calcVersions.some(
    (item: any) => item.key === next.activeCalcVersionKey,
  );
  if (!hasActiveCalc) {
    next.activeCalcVersionKey = "";
  }

  next.decisionSource = safeText(next.decisionSource, "finance");
  if (!allKeys.includes(next.decisionSource)) {
    next.decisionSource = "finance";
  }

  next.meetingOpinion = safeText(next.meetingOpinion);
  next.customDecisionValue = safeText(next.customDecisionValue);
  next.customDecisionNote = safeText(next.customDecisionNote);

  return next;
}
async function loadPage() {
  loading.value = true;
  try {
    if (!queryProjectId.value) {
      throw new Error("当前链接缺少项目 ID，请从收益流程列表重新进入");
    }
    const payload = await fetchMeetingReviewDetail({
      projectNo: queryProjectNo.value,
      projectCode: queryProjectCode.value,
      projectId: queryProjectId.value,
      flowId: queryFlowId.value,
      projectName: queryProjectName.value,
      permissionKey: queryPermissionKey.value,
      stage: queryStage.value,
      valve: queryValve.value,
      nodeStatus: queryNodeStatus.value,
      flowCreatedAt: queryFlowCreatedAt.value,
      flowUpdatedAt: queryFlowUpdatedAt.value,
      userId: queryUserId.value,
      userName: queryUserName.value,
      fullAccess: (authStore.permissions || []).includes("*:*:*"),
    });

    project.value = mergeProjectWithRoute(payload.project || project.value);
    steps.value = REVIEW_STAGE_STEPS.map((item: any) => ({ ...item }));
    currentStep.value = normalizeReviewStageCode(
      payload.currentStep || queryStage.value || "S8",
    );
    const payloadDimensions =
      payload.dimensions && typeof payload.dimensions === "object"
        ? payload.dimensions
        : {};
    dimensions.value = {
      years: Array.isArray((payloadDimensions as any).years)
        ? (payloadDimensions as any).years
        : [],
      trims: Array.isArray((payloadDimensions as any).trims)
        ? (payloadDimensions as any).trims
        : [],
      yearFactors: Array.isArray((payloadDimensions as any).yearFactors)
        ? (payloadDimensions as any).yearFactors
        : [],
    };
    const resolvedSubjects = resolveDisplaySubjects(payload.subjects);
    if (!resolvedSubjects.length) {
      resetSubjectDrivenData();
      BaseToast.error("当前流程模板未返回主表科目，无法打开上会评审");
      return;
    }
    subjects.value = resolvedSubjects;
    candidateVersions.value =
      (payload.versions && payload.versions.candidates) || [];
    extraVersions.value = (payload.versions && payload.versions.extras) || [];
    candidateValues.value = {};
    initializeMeetingModuleLoading(resolvedSubjects);
    extraValues.value = (payload.values && payload.values.extras) || {};
    calcEditableFields.value = buildCalcEditableFields(resolvedSubjects);
    timeline.value = Array.isArray(payload.timeline) ? payload.timeline : [];
    flowReviewHistory.value = {
      flowId: safeText(
        (payload as any).flowReviewHistory &&
          (payload as any).flowReviewHistory.flowId,
        project.value.flowId || queryFlowId.value,
      ),
      logs: Array.isArray(
        (payload as any).flowReviewHistory &&
          (payload as any).flowReviewHistory.logs,
      )
        ? (payload as any).flowReviewHistory.logs
        : [],
      reviewSuggestions: Array.isArray(
        (payload as any).flowReviewHistory &&
          (payload as any).flowReviewHistory.reviewSuggestions,
      )
        ? (payload as any).flowReviewHistory.reviewSuggestions
        : [],
    };
    decisionResult.value = payload.decisionResult || null;
    departmentOpinionCards.value = await fetchDepartmentOpinionCards({
      projectName: safeText(project.value.projectName, queryProjectName.value),
      valvePoint: safeText(
        project.value.gate || project.value.valvePoint,
        queryValve.value,
      ),
    });

    state.value = normalizeState(payload.state || {});
    ensureStateAfterVersionChange();
    initCalcDraftFromBase();
    loading.value = false;
    await loadMeetingModulesSerially();
  } finally {
    loading.value = false;
  }
}
function formatDepartmentOpinionOrder(order: any) {
  const num = Number(order);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return String(num).padStart(2, "0");
}
function goBack() {
  router.back();
}
function _scrollToNodeReview(stageCode: any) {
  const code = safeText(stageCode).toUpperCase();
  if (!code) return;
  const target = document.getElementById(`node-review-${code}`);
  if (!target || typeof target.scrollIntoView !== "function") {
    return;
  }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}
function onViewModeChange() {
  state.value.activeTrims = [getDefaultTrimIndex()];
  state.value = normalizeState(state.value);
  if (tableSystemFullscreen.value) {
    nextTick((scheduleFullscreenTableLayout as any).value);
  }
}
function _onBaselineChange() {
  state.value.baselineVersion = BASELINE_VERSION_KEY;
  ensureStateAfterVersionChange();
  if (state.value.calcBaseVersion === state.value.baselineVersion) {
    initCalcDraftFromBase();
  }
}
function onCompareVersionsChange() {
  if (
    (state.value.compareVersions || []).includes(ADD_HISTORY_VALVE_OPTION_KEY)
  ) {
    state.value.compareVersions = (state.value.compareVersions || []).filter(
      (key: any) => key !== ADD_HISTORY_VALVE_OPTION_KEY,
    );
    openHistoryValveDialog();
    return;
  }
  if ((state.value.compareVersions || []).includes(OTHER_PROJECT_OPTION_KEY)) {
    state.value.compareVersions = (state.value.compareVersions || []).filter(
      (key: any) => key !== OTHER_PROJECT_OPTION_KEY,
    );
    showOtherProjectComingSoon();
    return;
  }
  ensureStateAfterVersionChange();
}
function showOtherProjectComingSoon() {
  openConfirm({
    title: "即将上线",
    message: "其他项目对比功能即将上线，敬请期待。",
    type: "warning",
    confirmText: "知道了",
  }).catch(() => {});
}
function onYearChange() {
  const before = Array.isArray(state.value.activeYears)
    ? state.value.activeYears.slice()
    : [];
  state.value = normalizeState({
    ...state.value,
    activeYears: before,
    activeYearsUserSelected: true,
  });
}
function _onTrimChange() {
  if (!state.value.activeTrims.length) {
    state.value.activeTrims = [getDefaultTrimIndex()];
  }
  state.value.activeTrims = selectedTrimIndexes.value.slice();
}
async function _toggleTableSystemFullscreen() {
  if (tableSystemFullscreen.value) {
    await leaveTableFullscreen();
    return;
  }
  await enterTableFullscreen();
}
async function enterTableFullscreen() {
  const target = /* TODO: use template ref fullscreenHost */ null;
  if (!target) return;
  try {
    await requestElementFullscreen(target);
    applyTableFullscreenState();
  } catch (error) {
    console.error("[meeting-review] request fullscreen failed:", error);
    BaseToast.warning("浏览器全屏调用失败，请检查浏览器权限");
  }
}
function applyTableFullscreenState() {
  tableSystemFullscreen.value = true;
  tableFullscreenCentered.value = false;
  fullscreenQuickMenuVisible.value = false;
  quickEntryDragging.value = false;
  quickEntryMoved.value = false;
  lockPageScroll();
  showFullscreenModeTip();
  nextTick(() => {
    resetQuickEntryPosition();
    scheduleFullscreenTableLayout();
  });
}
async function leaveTableFullscreen() {
  tableSystemFullscreen.value = false;
  tableFullscreenCentered.value = false;
  compareControlDrawerVisible.value = false;
  fullscreenQuickMenuVisible.value = false;
  quickEntryDragging.value = false;
  clearFullscreenTableFitStyles();
  hideFullscreenModeTip();
  unlockPageScroll();
  const target = /* TODO: use template ref fullscreenHost */ null;
  const currentFullscreenEl = getFullscreenElement();
  if (target && currentFullscreenEl === target) {
    await exitDocumentFullscreen();
  }
}
function scheduleFullscreenTableLayout() {
  if (!tableSystemFullscreen.value) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  if (tableFullscreenLayoutRaf.value) {
    window.cancelAnimationFrame(tableFullscreenLayoutRaf.value);
  }
  tableFullscreenLayoutRaf.value = window.requestAnimationFrame(() => {
    tableFullscreenLayoutRaf.value = null;
    updateFullscreenTableLayout();
  });
}
function updateFullscreenTableLayout() {
  if (!tableSystemFullscreen.value) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  const wrap = /* TODO: use template ref compareTableWrap */ null;
  const table =
    wrap && (wrap as any).querySelector
      ? (wrap as any).querySelector(".compare-table")
      : null;
  if (!wrap || !table) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  if (!isFixedFeeCollapsed.value) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  const body = table.tBodies && table.tBodies[0];
  const visibleRows = body
    ? Array.from(body.rows).filter((row: any) => {
        if (!row || (row as any).classList.contains("is-fixed-fee-collapsed"))
          return false;
        return window.getComputedStyle(row).display !== "none";
      }).length
    : 0;
  if (!visibleRows) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  const wrapHeight = Math.max(0, Number((wrap as any).clientHeight) || 0);
  if (!wrapHeight) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  const visibleHeadRows = table.tHead
    ? Array.from((table.tHead.rows || []) as any).filter(
        (row: any) => window.getComputedStyle(row as any).display !== "none",
      ).length
    : 0;
  const minBodyRowHeight = 4;
  const maxBodyRowHeight = Math.max(28, wrapHeight);
  const minHeadRowHeight = 8;
  const maxHeadRowHeight = 24;
  // Actual table height includes borders and sticky header rows, so verify after applying.
  const applySizing = (bodyRowHeight: any, headRowHeight: any) => {
    const _baseBodyFontSize =
      bodyRowHeight <= 11 ? 10 : bodyRowHeight <= 13 ? 11 : 12;
    void _baseBodyFontSize;
    const targetBodyRowHeight = Math.max(minBodyRowHeight, bodyRowHeight);
    const cellY = 0;
    const lineHeight = Math.max(1, targetBodyRowHeight - 1);
    const baseHeadFontSize = headRowHeight <= 19 ? 11 : 12;
    const targetHeadRowHeight = visibleHeadRows
      ? Math.max(minHeadRowHeight, headRowHeight, baseHeadFontSize)
      : 0;
    const headY = 0;
    const headLineHeight = visibleHeadRows
      ? Math.max(1, targetHeadRowHeight - 1)
      : baseHeadFontSize;
    table.style.setProperty("--fullscreen-table-h", `${wrapHeight}px`);
    table.style.setProperty("--fullscreen-row-h", `${targetBodyRowHeight}px`);
    table.style.setProperty("--fullscreen-cell-y", `${cellY}px`);
    table.style.setProperty("--fullscreen-line-h", `${lineHeight}px`);
    table.style.setProperty(
      "--fullscreen-head-row-h",
      `${targetHeadRowHeight}px`,
    );
    table.style.setProperty("--fullscreen-head-y", `${headY}px`);
    table.style.setProperty("--fullscreen-head-line-h", `${headLineHeight}px`);
  };
  let headRowHeight = visibleHeadRows ? maxHeadRowHeight : 0;
  applySizing(maxBodyRowHeight, headRowHeight);
  const headHeight = table.tHead ? Number(table.tHead.offsetHeight) || 0 : 0;
  const bodyAvailable = Math.max(
    minBodyRowHeight,
    wrapHeight - headHeight - visibleRows - 4,
  );
  let rowHeight = Math.max(
    minBodyRowHeight,
    Math.min(maxBodyRowHeight, bodyAvailable / visibleRows),
  );
  applySizing(rowHeight, headRowHeight);
  for (let i = 0; i < 32; i += 1) {
    const rendered = Number(table.offsetHeight) || 0;
    const overflow = rendered - wrapHeight;
    if (Math.abs(overflow) <= 0.5) break;
    if (overflow > 0 && rowHeight > minBodyRowHeight) {
      rowHeight = Math.max(
        minBodyRowHeight,
        rowHeight - Math.max(0.1, overflow / visibleRows),
      );
    } else if (overflow > 0 && headRowHeight > minHeadRowHeight) {
      headRowHeight = Math.max(
        minHeadRowHeight,
        headRowHeight - Math.max(0.1, overflow / Math.max(1, visibleHeadRows)),
      );
    } else if (overflow < 0 && rowHeight < maxBodyRowHeight) {
      rowHeight = Math.min(
        maxBodyRowHeight,
        rowHeight + Math.max(0.1, Math.abs(overflow) / visibleRows),
      );
    } else {
      break;
    }
    applySizing(rowHeight, headRowHeight);
  }
  const renderedHeight = Number(table.offsetHeight) || 0;
  const shouldCenter =
    renderedHeight > 0 && Math.abs(renderedHeight - wrapHeight) <= 1;
  if (tableFullscreenCentered.value !== shouldCenter) {
    tableFullscreenCentered.value = shouldCenter;
  }
}
function clearFullscreenTableFitStyles() {
  const wrap = /* TODO: use template ref compareTableWrap */ null;
  const table =
    wrap && (wrap as any).querySelector
      ? (wrap as any).querySelector(".compare-table")
      : null;
  if (!table) return;
  table.style.removeProperty("--fullscreen-row-h");
  table.style.removeProperty("--fullscreen-table-h");
  table.style.removeProperty("--fullscreen-cell-y");
  table.style.removeProperty("--fullscreen-line-h");
  table.style.removeProperty("--fullscreen-head-row-h");
  table.style.removeProperty("--fullscreen-head-y");
  table.style.removeProperty("--fullscreen-head-line-h");
}
function scheduleFullscreenTableLayoutAfterRowsSettle() {
  if (!tableSystemFullscreen.value) return;
  if (tableFullscreenLayoutTimer.value) {
    window.clearTimeout(tableFullscreenLayoutTimer.value);
  }
  tableFullscreenLayoutTimer.value = window.setTimeout(() => {
    tableFullscreenLayoutTimer.value = null;
    scheduleFullscreenTableLayout();
  }, 320);
}
function _openCompareControlDrawer() {
  compareControlDrawerVisible.value = true;
  fullscreenQuickMenuVisible.value = false;
}
function toggleFullscreenQuickMenu() {
  fullscreenQuickMenuVisible.value = !fullscreenQuickMenuVisible.value;
}
function normalizeFullscreenTableFontSize(value: any) {
  const size = Math.round(Number(value));
  return Number.isFinite(size)
    ? Math.max(MIN_FULLSCREEN_TABLE_FONT_SIZE, size)
    : DEFAULT_FULLSCREEN_TABLE_FONT_SIZE;
}
function setFullscreenTableFontSize(size: any) {
  fullscreenTableFontSize.value = normalizeFullscreenTableFontSize(size);
  nextTick((scheduleFullscreenTableLayout as any).value);
}
function _increaseFullscreenTableFontSize() {
  setFullscreenTableFontSize(
    fullscreenTableFontSizeValue.value + FULLSCREEN_TABLE_FONT_SIZE_STEP,
  );
}
function _decreaseFullscreenTableFontSize() {
  setFullscreenTableFontSize(
    fullscreenTableFontSizeValue.value - FULLSCREEN_TABLE_FONT_SIZE_STEP,
  );
}
function _onQuickEntryClick() {
  if (quickEntryIgnoreNextClick.value) {
    quickEntryIgnoreNextClick.value = false;
    return;
  }
  if (quickEntryMoved.value) {
    quickEntryMoved.value = false;
    return;
  }
  toggleFullscreenQuickMenu();
}
function getPointerPosition(event: any) {
  if (!event) return { clientX: 0, clientY: 0 };
  const touch =
    event.touches && event.touches[0]
      ? event.touches[0]
      : event.changedTouches && event.changedTouches[0]
        ? event.changedTouches[0]
        : event;
  return {
    clientX: Number(touch.clientX) || 0,
    clientY: Number(touch.clientY) || 0,
  };
}
function _startQuickEntryDrag(event: any) {
  if (!tableSystemFullscreen.value) return;
  const card = /* TODO: use template ref tableFullscreenTarget */ null;
  if (!card) return;
  const rect = (card as any).getBoundingClientRect();
  const point = getPointerPosition(event);
  quickEntryDragging.value = true;
  quickEntryMoved.value = false;
  quickEntryDragStart.value = {
    x: point.clientX,
    y: point.clientY,
  };
  quickEntryDragOffset.value = {
    x: point.clientX - rect.left - quickEntryPosition.value.x,
    y: point.clientY - rect.top - quickEntryPosition.value.y,
  };
}
function onQuickEntryDragMove(event: any) {
  if (!quickEntryDragging.value || !tableSystemFullscreen.value) return;
  const card = /* TODO: use template ref tableFullscreenTarget */ null;
  if (!card) return;
  if (event && event.cancelable) {
    event.preventDefault();
  }
  const rect = (card as any).getBoundingClientRect();
  const point = getPointerPosition(event);
  const moveX = point.clientX - quickEntryDragStart.value.x;
  const moveY = point.clientY - quickEntryDragStart.value.y;
  const movedDistance = Math.sqrt(moveX * moveX + moveY * moveY);
  if (!quickEntryMoved.value && movedDistance < QUICK_ENTRY_DRAG_THRESHOLD) {
    return;
  }
  const nextX = point.clientX - rect.left - quickEntryDragOffset.value.x;
  const nextY = point.clientY - rect.top - quickEntryDragOffset.value.y;
  quickEntryPosition.value = clampQuickEntryPosition(nextX, nextY, rect);
  quickEntryMoved.value = true;
}
function stopQuickEntryDrag() {
  quickEntryDragging.value = false;
}
function _onQuickEntryTouchEnd() {
  const moved = quickEntryMoved.value;
  stopQuickEntryDrag();
  if (moved) {
    quickEntryMoved.value = false;
    return;
  }
  quickEntryIgnoreNextClick.value = true;
  if (quickEntryClickGuardTimer.value) {
    window.clearTimeout(quickEntryClickGuardTimer.value);
  }
  quickEntryClickGuardTimer.value = window.setTimeout(() => {
    quickEntryIgnoreNextClick.value = false;
    quickEntryClickGuardTimer.value = null;
  }, 350);
  toggleFullscreenQuickMenu();
}
function clampQuickEntryPosition(x: any, y: any, rect: any) {
  const width = (rect && rect.width) || window.innerWidth || 1280;
  const height = (rect && rect.height) || window.innerHeight || 720;
  const btnSize = QUICK_ENTRY_HIT_SIZE;
  const margin = 8;
  return {
    x: Math.min(
      Math.max(Number(x) || 0, margin),
      Math.max(margin, width - btnSize - margin),
    ),
    y: Math.min(
      Math.max(Number(y) || 0, margin),
      Math.max(margin, height - btnSize - margin),
    ),
  };
}
function resetQuickEntryPosition() {
  const card = /* TODO: use template ref tableFullscreenTarget */ null;
  const rect =
    card && (card as any).getBoundingClientRect
      ? (card as any).getBoundingClientRect()
      : { width: window.innerWidth || 1280, height: window.innerHeight || 720 };
  quickEntryPosition.value = clampQuickEntryPosition(16, 16, rect);
}
function lockPageScroll() {
  if (typeof document === "undefined" || !document.body) return;
  document.body.classList.add("meeting-review-fullscreen-lock");
}
function unlockPageScroll() {
  if (typeof document === "undefined" || !document.body) return;
  document.body.classList.remove("meeting-review-fullscreen-lock");
}
function showFullscreenModeTip() {
  if (fullscreenModeTipTimer.value) {
    window.clearTimeout(fullscreenModeTipTimer.value);
  }
  fullscreenModeTipVisible.value = true;
  fullscreenModeTipTimer.value = window.setTimeout(() => {
    fullscreenModeTipVisible.value = false;
    fullscreenModeTipTimer.value = null;
  }, 1600);
}
function hideFullscreenModeTip() {
  if (fullscreenModeTipTimer.value) {
    window.clearTimeout(fullscreenModeTipTimer.value);
    fullscreenModeTipTimer.value = null;
  }
  fullscreenModeTipVisible.value = false;
}
function onDocumentClick(event: any) {
  if (!tableSystemFullscreen.value || !fullscreenQuickMenuVisible.value) return;
  const target = event && event.target;
  if (
    target &&
    target.closest &&
    (target.closest(".fullscreen-edge-entry") ||
      target.closest(".fullscreen-quick-dock"))
  ) {
    return;
  }
  fullscreenQuickMenuVisible.value = false;
}
async function requestElementFullscreen(element: any) {
  const fn =
    element.requestFullscreen ||
    element.webkitRequestFullscreen ||
    element.mozRequestFullScreen ||
    element.msRequestFullscreen;
  if (fn) {
    await fn.call(element);
    return;
  }
  throw new Error("Fullscreen API is not supported by this browser");
}
async function exitDocumentFullscreen() {
  const doc = document as typeof document & {
    webkitExitFullscreen?: () => void;
    msExitFullscreen?: () => void;
    mozCancelFullScreen?: () => void;
  };
  const fn =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen;
  if (fn) {
    await fn.call(document);
  }
}
function getFullscreenElement() {
  const doc = document as typeof document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  );
}
function onFullscreenChange() {
  const target = /* TODO: use template ref fullscreenHost */ null;
  const currentFullscreenEl = getFullscreenElement();
  const isNativeFullscreen = Boolean(target && currentFullscreenEl === target);
  if (isNativeFullscreen && !tableSystemFullscreen.value) {
    applyTableFullscreenState();
  }
  if (
    !isNativeFullscreen &&
    currentFullscreenEl == null &&
    tableSystemFullscreen.value
  ) {
    leaveTableFullscreen();
  }
}
function onGlobalKeydown(event: any) {
  if (!event || event.key !== "Escape") return;
  if (!tableSystemFullscreen.value) return;
  event.preventDefault();
  leaveTableFullscreen();
}
function resetCompareControls() {
  state.value.viewMode = "compare";
  state.value.baselineVersion = BASELINE_VERSION_KEY;
  state.value.compareVersions = [REQUIRED_COMPARE_VERSION_KEY];
  state.value.activeYears = defaultYearIndexes.value.slice();
  state.value.activeYearsUserSelected = false;
  state.value.activeYear = state.value.activeYears[0] || 0;
  state.value.activeTrims = [getDefaultTrimIndex()];
  state.value.deltaMode = false;
  state.value.autoDiff = true;
  ensureStateAfterVersionChange();
}
function ensureStateAfterVersionChange() {
  state.value = normalizeState(state.value);
  if (state.value.activeCalcVersionKey) {
    const active = findCalcVersionByKey(state.value.activeCalcVersionKey);
    calcVersionNameInput.value = active ? active.label : "";
  }
}
function getDefaultTrimIndex() {
  const trims = dimensions.value.trims || [];
  if (!trims.length) return 0;
  // 对齐 Vue2 数据校核：优先取「小计/合计」列作为现场计算器基准列
  const subtotalIndex = trims.findIndex((item: any) => isSubtotalTrimLabel(item));
  return subtotalIndex >= 0 ? subtotalIndex : trims.length - 1;
}
function _versionSupportsTrim(versionKey: any) {
  if (!(dimensions.value.trims || []).length) return false;
  const key = resolveValueVersionKey(versionKey);
  if (!key) return false;
  const values =
    candidateValues.value && typeof candidateValues.value === "object"
      ? candidateValues.value
      : {};
  const fromCandidate = Object.keys(values).some((subjectId) => {
    const item = (values as Record<string, any>)[subjectId];
    const trims = item && item.trims ? item.trims[key] : null;
    if (Array.isArray(trims)) return trims.length > 0;
    if (trims && typeof trims === "object") {
      return Object.keys(trims).length > 0;
    }
    return trims != null;
  });
  if (fromCandidate) return true;
  const extraVersion =
    extraValues.value && (extraValues.value as Record<string, any>)[key];
  const extraTrims = extraVersion && extraVersion.trims;
  if (Array.isArray(extraTrims)) return extraTrims.length > 0;
  if (extraTrims && typeof extraTrims === "object") {
    return Object.keys(extraTrims).length > 0;
  }
  return false;
}
function findCalcVersionByKey(key: any) {
  const list = state.value.calcVersions || [];
  return list.find((item: any) => item.key === key) || null;
}
function isCalcVersionKey(key: any) {
  return Boolean(findCalcVersionByKey(key));
}
function getVersionMeta(key: any) {
  return (
    (allVersionMap.value as Record<string, any>)[key] || {
      key,
      label: key,
      dot: "history",
    }
  );
}
function isFrozenCompareVersion(versionKey: any) {
  const key = safeText(versionKey);
  return key === BASELINE_VERSION_KEY || key === REQUIRED_COMPARE_VERSION_KEY;
}
function getFrozenVersionStartIndex(versionKey: any) {
  const key = safeText(versionKey);
  if (!isFrozenCompareVersion(key)) return -1;
  const frozenKeys = compareHeaderVersions.value
    .map((item: any) => item.key)
    .filter((item: any) => isFrozenCompareVersion(item));
  const versionIndex = frozenKeys.indexOf(key);
  if (versionIndex < 0) return -1;
  return versionIndex * Math.max(selectedYearIndexes.value.length, 1);
}
function getFrozenCompareColumnOffset(versionKey: any, yearIndex: any) {
  const start = getFrozenVersionStartIndex(versionKey);
  if (start < 0) return -1;
  const yearOffset = selectedYearIndexes.value.indexOf(Number(yearIndex));
  return yearOffset >= 0 ? start + yearOffset : start;
}
function isFrozenCompareColumn(column: any) {
  if (!column) return false;
  return getFrozenCompareColumnOffset(column.versionKey, column.yearIndex) >= 0;
}
function frozenLeftStyle(offsetIndex: any) {
  if (offsetIndex < 0) return {};
  return {
    left: `calc(var(--subject-col-w) + ${offsetIndex} * var(--value-col-w))`,
  };
}
function valueColumnSizeStyle() {
  return {
    width: "var(--value-col-w)",
    minWidth: "var(--value-col-w)",
  };
}
function versionHeadStyle(group: any) {
  if (!group) return {};
  const width = `calc(${group.colspan || 1} * var(--value-col-w))`;
  return {
    ...frozenLeftStyle(getFrozenVersionStartIndex(group.key)),
    width,
    minWidth: width,
  };
}
function yearHeadStyle(versionKey: any, yearIndex: any) {
  return {
    ...valueColumnSizeStyle(),
    ...frozenLeftStyle(getFrozenCompareColumnOffset(versionKey, yearIndex)),
  };
}
function compareCellStyle(column: any) {
  if (!column) return {};
  return {
    ...valueColumnSizeStyle(),
    ...frozenLeftStyle(
      getFrozenCompareColumnOffset(column.versionKey, column.yearIndex),
    ),
  };
}
function hasCandidateValueKey(versionKey: any) {
  const key = safeText(versionKey);
  if (!key) return false;
  const values =
    candidateValues.value && typeof candidateValues.value === "object"
      ? candidateValues.value
      : {};
  return Object.keys(values).some((subjectId) => {
    const item = (values as Record<string, any>)[subjectId];
    if (!item || typeof item !== "object") return false;
    if (item[key] != null) return true;
    const trims = item.trims && item.trims[key];
    return trims != null;
  });
}
function resolveValueVersionKey(versionKey: any) {
  const key = safeText(versionKey);
  if (key === "business" && !hasCandidateValueKey("business")) {
    return "brand";
  }
  if (key === "history" && !(extraValues.value && extraValues.value.history)) {
    const fallback = ["gate_g6", "gate_g7", "gate_g8"].find(
      (item) =>
        extraValues.value && (extraValues.value as Record<string, any>)[item],
    );
    return fallback || key;
  }
  if (
    key === "competitor" &&
    !(extraValues.value && extraValues.value.competitor)
  ) {
    const fallback = ["comp_a", "comp_x"].find(
      (item) =>
        extraValues.value && (extraValues.value as Record<string, any>)[item],
    );
    return fallback || key;
  }
  return key;
}
function getYearFactor(yearIndex: any) {
  const factors = dimensions.value.yearFactors || [1, 0.96, 0.92, 0.88];
  const idx = Number(yearIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= factors.length) {
    return 1;
  }
  return Number(factors[idx]) || 1;
}
function resolveSubjectValueKeys(itemOrId: any) {
  const keys: any[] = [];
  const push = (value: any) => {
    const key = safeText(value);
    if (key && !keys.includes(key)) {
      keys.push(key);
    }
  };

  if (itemOrId && typeof itemOrId === "object") {
    push(itemOrId.subjectId);
    push(itemOrId.id);
    push(itemOrId.templateId);
    push(itemOrId.subjectCode);
  } else {
    push(itemOrId);
  }
  return keys;
}
function isRateOrVolume(itemOrId: any) {
  const keys = resolveSubjectValueKeys(itemOrId);
  if (keys.includes("proj_vol")) return true;
  if (
    itemOrId &&
    typeof itemOrId === "object" &&
    isPercentUnit(itemOrId.unit)
  ) {
    return true;
  }
  let isPercent = false;
  subjects.value.forEach((group) => {
    (group.items || []).forEach((item: any) => {
      const itemKeys = resolveSubjectValueKeys(item);
      if (itemKeys.some((key) => keys.includes(key))) {
        isPercent = isPercent || isPercentUnit(item.unit || group.unit);
      }
    });
  });
  return isPercent;
}
function hasExplicitYearVersionValue(
  itemOrId: any,
  versionKey: any,
  trimIndex: any,
  yearIndex: any,
) {
  const yearKey = Number(yearIndex);
  if (!Number.isInteger(yearKey)) return false;
  const hasTrimIndex =
    trimIndex !== null &&
    typeof trimIndex !== "undefined" &&
    String(trimIndex).trim() !== "" &&
    Number.isInteger(Number(trimIndex));
  const normalizedTrimIndex: any = hasTrimIndex ? Number(trimIndex) : null;
  const defaultTrimIndex = getDefaultTrimIndex();
  const valueVersionKey = resolveValueVersionKey(versionKey);
  const subjectValueKeys = resolveSubjectValueKeys(itemOrId);
  for (let index = 0; index < subjectValueKeys.length; index += 1) {
    const key = subjectValueKeys[index];
    const candidate = (candidateValues.value as Record<string, any>)[key];
    if (!candidate) continue;
    const yearTrims =
      candidate.yearTrims && candidate.yearTrims[valueVersionKey];
    const yearTrimValues = yearTrims && yearTrims[yearKey];
    if (
      yearTrims &&
      hasTrimIndex &&
      Array.isArray(yearTrimValues) &&
      yearTrimValues[normalizedTrimIndex] != null
    ) {
      return true;
    }
    if (Array.isArray(yearTrimValues)) {
      if (hasTrimIndex && normalizedTrimIndex !== defaultTrimIndex) continue;
      const defaultValue = yearTrimValues[defaultTrimIndex];
      if (defaultValue != null) return true;
    }
    if (yearTrims && hasTrimIndex && normalizedTrimIndex !== defaultTrimIndex)
      continue;
    const years = candidate.years && candidate.years[valueVersionKey];
    if (
      years &&
      years[yearKey] != null &&
      (!hasTrimIndex || normalizedTrimIndex === defaultTrimIndex)
    ) {
      return true;
    }
  }
  return false;
}
function getRawVersionValue(
  itemOrId: any,
  versionKey: any,
  trimIndex: any,
  yearIndex: any,
) {
  const subjectValueKeys = resolveSubjectValueKeys(itemOrId);
  const calcVersion = findCalcVersionByKey(versionKey);
  if (calcVersion && calcVersion.values) {
    for (let index = 0; index < subjectValueKeys.length; index += 1) {
      const key = subjectValueKeys[index];
      if (calcVersion.values[key] != null) {
        return safeNumber(calcVersion.values[key]);
      }
    }
  }

  const valueVersionKey = resolveValueVersionKey(versionKey);
  const hasYearIndex =
    yearIndex !== null &&
    typeof yearIndex !== "undefined" &&
    String(yearIndex).trim() !== "" &&
    Number.isInteger(Number(yearIndex));
  const hasTrimIndex =
    trimIndex !== null &&
    typeof trimIndex !== "undefined" &&
    String(trimIndex).trim() !== "" &&
    Number.isInteger(Number(trimIndex));
  const normalizedYearIndex: any = hasYearIndex ? Number(yearIndex) : null;
  const normalizedTrimIndex: any = hasTrimIndex ? Number(trimIndex) : null;
  const defaultTrimIndex = getDefaultTrimIndex();
  for (let index = 0; index < subjectValueKeys.length; index += 1) {
    const key = subjectValueKeys[index];
    const candidate = (candidateValues.value as Record<string, any>)[key];
    if (candidate) {
      const yearTrims =
        candidate.yearTrims && candidate.yearTrims[valueVersionKey];
      const years = candidate.years && candidate.years[valueVersionKey];
      const trims = candidate.trims && candidate.trims[valueVersionKey];
      if (hasYearIndex) {
        const yearTrimValues = yearTrims && yearTrims[normalizedYearIndex];
        if (Array.isArray(yearTrimValues)) {
          if (hasTrimIndex) {
            const cell = yearTrimValues[normalizedTrimIndex];
            // 空字符串不能当有效值返回，否则现场计算器打开时基准值为空
            if (cell != null && String(cell).trim() !== "") {
              return safeNumber(cell);
            }
            if (normalizedTrimIndex !== defaultTrimIndex) return null;
          } else {
            const defaultValue = yearTrimValues[defaultTrimIndex];
            if (defaultValue != null && String(defaultValue).trim() !== "") {
              return safeNumber(defaultValue);
            }
          }
        }
        if (
          yearTrims &&
          hasTrimIndex &&
          normalizedTrimIndex !== defaultTrimIndex
        )
          return null;
        if (
          years &&
          years[normalizedYearIndex] != null &&
          (!hasTrimIndex || normalizedTrimIndex === defaultTrimIndex)
        ) {
          return safeNumber(years[normalizedYearIndex]);
        }
        if (hasTrimIndex && trims && normalizedYearIndex === 0) {
          const trimVal = trims[normalizedTrimIndex];
          return trimVal != null ? safeNumber(trimVal) : null;
        }
        if (hasTrimIndex) return null;
      }
      if (hasTrimIndex && trims) {
        const trimVal = trims[normalizedTrimIndex];
        if (trimVal != null) return safeNumber(trimVal);
      }
      if (
        candidate[valueVersionKey] != null &&
        (!hasTrimIndex || normalizedTrimIndex === defaultTrimIndex)
      ) {
        return safeNumber(candidate[valueVersionKey]);
      }
    }
  }

  const extra = (extraValues.value as Record<string, any>)[valueVersionKey];
  if (extra) {
    if (hasTrimIndex && normalizedTrimIndex !== defaultTrimIndex) return null;
    for (let index = 0; index < subjectValueKeys.length; index += 1) {
      const key = subjectValueKeys[index];
      if (extra[key] != null) {
        return safeNumber(extra[key]);
      }
    }
  }

  return null;
}
function getVersionValue(
  itemOrId: any,
  versionKey: any,
  trimIndex: any,
  yearIndex: any,
) {
  const raw = getRawVersionValue(itemOrId, versionKey, trimIndex, yearIndex);
  if (raw == null) return null;
  if (isCalcVersionKey(versionKey)) {
    return raw;
  }
  if (!Number.isInteger(Number(yearIndex)) || Number(yearIndex) === 0) {
    return raw;
  }
  if (hasExplicitYearVersionValue(itemOrId, versionKey, trimIndex, yearIndex)) {
    return raw;
  }
  if (isRateOrVolume(itemOrId)) {
    return raw;
  }
  return roundNumber(raw * getYearFactor(Number(yearIndex)));
}
function compareCellClass(item: any, column: any) {
  const cls = ["num-cell"];
  if (column.isBaseline) {
    cls.push("baseline");
  } else {
    cls.push("compare");
  }

  const meta = getVersionMeta(column.versionKey);
  if (meta && meta.dot) {
    cls.push(`dot-${meta.dot}`);
  }

  if (isFrozenCompareColumn(column)) {
    cls.push("is-frozen-value-cell");
  }

  if (state.value.autoDiff && !column.isBaseline && hasDiff(item, column)) {
    cls.push("diff-auto");
  }
  return cls;
}
function sectionFillCellClass(column: any) {
  const cls = ["section-fill-cell"];
  if (isFrozenCompareColumn(column)) {
    cls.push("is-frozen-value-cell");
  }
  return cls;
}
function hasDiff(item: any, column: any) {
  const yearIndex = Number.isInteger(Number(column.yearIndex))
    ? Number(column.yearIndex)
    : 0;
  const baseTrim = getDefaultTrimIndex();
  const base = getVersionValue(
    item,
    state.value.baselineVersion,
    baseTrim,
    yearIndex,
  );
  const current = getVersionValue(
    item,
    column.versionKey,
    column.trimIndex,
    yearIndex,
  );
  if (base == null || current == null) return false;
  return Math.abs(current - base) >= 0.005;
}
function compareCellText(item: any, column: any) {
  const yearIndex = Number.isInteger(Number(column.yearIndex))
    ? Number(column.yearIndex)
    : 0;
  const baseTrim = getDefaultTrimIndex();
  const baseValue = getVersionValue(
    item,
    state.value.baselineVersion,
    baseTrim,
    yearIndex,
  );
  const currentValue = getVersionValue(
    item,
    column.versionKey,
    column.trimIndex,
    yearIndex,
  );

  if (state.value.deltaMode && !column.isBaseline) {
    if (currentValue == null || baseValue == null) return "-";
    const delta = roundNumber(currentValue - baseValue);
    if (delta == null) return "-";
    return formatSignedNumber(delta, item);
  }

  return formatNumber(currentValue, item);
}
function detailCellText(item: any, trimIndex: any, yearIndex: any) {
  const value = getVersionValue(
    item,
    state.value.baselineVersion,
    trimIndex,
    yearIndex,
  );
  return formatNumber(value, item);
}
function openCalcDrawer() {
  calcDrawerVisible.value = true;
  fullscreenQuickMenuVisible.value = false;
  if (!state.value.calcBaseVersion) {
    state.value.calcBaseVersion =
      state.value.baselineVersion || BASELINE_VERSION_KEY;
  }
  state.value = normalizeState(state.value);
}
function _onCalcBaseChange() {
  state.value.activeCalcVersionKey = "";
  calcVersionNameInput.value = "";
  state.value = normalizeState(state.value);
  initCalcDraftFromBase();
}
function buildBaseSnapshot(
  versionKey: any,
  yearIndex = state.value.calcBaseYear,
) {
  const snapshot = {};
  const baseYearIndex = Number.isInteger(Number(yearIndex))
    ? Number(yearIndex)
    : 0;
  subjects.value.forEach((group) => {
    (group.items || []).forEach((item: any) => {
      const key = safeText(item && (item.templateId || item.id));
      if (!key) return;
      const value = getVersionValue(
        item,
        versionKey,
        getDefaultTrimIndex(),
        baseYearIndex,
      );
      if (value != null) {
        (snapshot as Record<string, any>)[key] = value;
      }
    });
  });
  return snapshot;
}
function initCalcDraftFromBase() {
  if (state.value.activeCalcVersionKey) {
    const active = findCalcVersionByKey(state.value.activeCalcVersionKey);
    if (active) {
      const draft = {};
      calcEditableFields.value.forEach((field) => {
        const val = active.values[field.id];
        (draft as Record<string, any>)[field.id] =
          val == null ? "" : String(val);
      });
      state.value.calcDraftValues = draft;
      calcVersionNameInput.value = active.label;
      runCalc();
      return;
    }
  }

  const baseSnapshot = buildBaseSnapshot(
    state.value.calcBaseVersion ||
      state.value.baselineVersion ||
      BASELINE_VERSION_KEY,
    state.value.calcBaseYear,
  );
  const draft = {};
  calcEditableFields.value.forEach((field) => {
    const val = (baseSnapshot as Record<string, any>)[field.id];
    (draft as Record<string, any>)[field.id] = val == null ? "" : String(val);
  });
  state.value.calcDraftValues = draft;
  calcVersionNameInput.value = "";
  runCalc();
}
function _onCalcFieldInput(fieldId: any, value: any) {
  (state.value.calcDraftValues as Record<string, any>)[fieldId] = value;
}
function parseCalcFormulaNumber(value: any) {
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
function isProjectProfitCalcRow(row: any = {}) {
  const path = [
    Array.isArray(row.subjectPath) ? row.subjectPath.join("/") : row.subjectPath,
    row.fullNamePath,
    row.rootSubjectName,
  ]
    .map((item: any) => safeText(item))
    .join("/");
  return path.includes("项目利润");
}
function isPerVehicleCalcRow(row: any = {}) {
  if (isProjectProfitCalcRow(row)) return false;
  const path = [
    Array.isArray(row.subjectPath) ? row.subjectPath.join("/") : row.subjectPath,
    row.fullNamePath,
    row.rootSubjectName,
  ]
    .map((item: any) => safeText(item))
    .join("/");
  return path.includes("单车收益") || path.includes("单车");
}
function normalizeCalcSubjectName(row: any = {}) {
  return safeText(row.subjectName || row.subject || row.name)
    .replace(/^[\s\u3000]+/, "")
    .replace(/[（()）]/g, "")
    .replace(/[%％]/g, "");
}
/** 优先取单车收益行的单元格，避免项目利润同名科目抢键 */
function pickSingleCalcAmount(
  rows: any[] = [],
  seed: Record<string, any> = {},
  templateId = "",
  subjectName = "",
  options: { allowProject?: boolean } = {},
) {
  const expectedId = safeText(templateId);
  const expectedName = safeText(subjectName);
  const allowProject = options.allowProject === true;
  let fallback: number | null = null;
  let preferred: number | null = null;
  rows.forEach((row: any) => {
    const id = safeText(row && row.templateId);
    const name = normalizeCalcSubjectName(row);
    const idMatch = Boolean(expectedId && id === expectedId);
    const nameMatch = Boolean(expectedName && name === expectedName);
    if (!idMatch && !nameMatch) return;
    if (!allowProject && isProjectProfitCalcRow(row)) return;
    const cells =
      row && row.cells && typeof row.cells === "object" ? row.cells : {};
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
function firstFiniteNonZero(values: any[] = []) {
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
function applySingleCalcRatioAliases(result: Record<string, any>, rows: any[] = [], seed: Record<string, any> = {}) {
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
      const rate = roundNumber(Number(margin) / Number(revenue), 4);
      if (rate != null) result.margin_rate = rate;
    }
    if (opProfit != null) {
      const rate = roundNumber(Number(opProfit) / Number(revenue), 4);
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
      const value = roundNumber(Number(revenue) * Number(volume), 4);
      if (value != null) result.proj_rev = value;
    }
    if (margin != null) {
      const value = roundNumber(Number(margin) * Number(volume), 4);
      if (value != null) result.proj_margin = value;
    }
    if (opProfit != null) {
      const value = roundNumber(Number(opProfit) * Number(volume), 4);
      if (value != null) result.proj_profit = value;
    }
  }
  return result;
}
/** 保留数组或 JSON 字符串绑定，避免现场测算公式参数被清空 */
function resolveCalcFormulaParamBindings(meta: any = {}, item: any = {}) {
  const candidates = [
    meta && meta.formulaParamBindings,
    item && item.formulaParamBindings,
  ];
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
function buildCalcFormulaDetail(values: any = {}) {
  const year = "现场测算";
  const trimId = "calc";
  const trimName = "现场测算";
  const rows: any[] = [];
  subjects.value.forEach((group) => {
    const groupName = safeText(group && (group.group || group.name));
    (group.items || []).forEach((item: any) => {
      const templateId = safeText(item && (item.templateId || item.id));
      const subjectId = safeText(item && item.subjectId);
      const valueKey = Object.prototype.hasOwnProperty.call(values, templateId)
        ? templateId
        : subjectId;
      const rawValue = Object.prototype.hasOwnProperty.call(values, valueKey)
        ? (values as Record<string, any>)[valueKey]
        : "";
      const subjectName = safeText(item && item.name).replace(
        /^[\s\u3000]+/,
        "",
      );
      const subjectPath = resolveCalcSubjectPath(item, group);
      const meta = resolveCalcSubjectMeta(item, group) || {};
      const resolvedFormulaExpression = safeText(
        (meta as any).formulaExpression ||
          (item && (item.formulaExpression || item.expression)),
      );
      const isRateSubject =
        templateId === "margin_rate" ||
        templateId === "op_rate" ||
        subjectName === "边际贡献率" ||
        subjectName === "营业利润率";
      // 对齐 Vue2：不要把录入行强改成 CALCULATED，否则打开计算器时会把主表基准值冲成 0
      const resolvedEntryMode = safeText(
        (meta as any).entryMode,
        item && item.entryMode,
      );
      const rowKind = safeText(
        item && (item.rowKind || item.rowType),
        (meta as any).formulaKey ? (meta as any).rowKind : REVENUE_ROW_KIND.INPUT,
      );
      rows.push({
        ...item,
        id: subjectId || templateId,
        rowId: subjectId || templateId,
        templateId,
        subjectId,
        subjectCode: safeText(item && item.subjectCode),
        subject: subjectName,
        subjectName,
        subjectPath,
        fullNamePath: subjectPath,
        rootSubjectName: groupName,
        subtable: "主表",
        moduleCode: REVENUE_MODULE_CODE.MAIN_PNL,
        rowKind,
        valueSource: safeText(
          item && (item.valueSource || item.sourceType),
          rowKind === REVENUE_ROW_KIND.INPUT
            ? REVENUE_VALUE_SOURCE.INPUT
            : (meta as any).valueSource,
        ),
        inputType: safeText(item && item.inputType),
        unit: safeText(item && item.unit, group && group.unit),
        entryMode: resolvedEntryMode,
        templateEntryMode: safeText(
          (meta as any).templateEntryMode ||
            resolvedEntryMode ||
            (item && (item.templateEntryMode || item.entryMode)),
        ),
        formulaId: isRateSubject
          ? undefined
          : (meta as any).formulaId || (item && item.formulaId),
        formulaKey: isRateSubject
          ? ""
          : safeText(
              (meta as any).formulaKey ||
                (item && (item.formulaKey || item.formulaCode)),
            ),
        formulaCode: isRateSubject
          ? ""
          : safeText(
              (meta as any).formulaCode ||
                (item && (item.formulaCode || item.formulaKey)),
            ),
        formulaName: safeText(
          (meta as any).formulaName || (item && item.formulaName),
        ),
        formulaExpression: isRateSubject ? "" : resolvedFormulaExpression,
        formulaParamBindings: isRateSubject
          ? []
          : resolveCalcFormulaParamBindings(meta, item),
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
function extractCalcFormulaValues(detail: any, seed: any = {}) {
  const result = { ...seed };
  const rows = detail && Array.isArray(detail.rows) ? detail.rows : [];
  rows.forEach((row: any) => {
    const key = safeText(row && row.templateId);
    if (!key) return;
    const cells =
      row && row.cells && typeof row.cells === "object" ? row.cells : {};
    const value = parseCalcFormulaNumber(cells.y0_t0);
    if (value == null) return;
    const seedValue = parseCalcFormulaNumber((result as Record<string, any>)[key]);
    // 对齐 Vue2：缺子表绑定时公式会写成 0，不能覆盖主表快照里的基准值
    if (Number(value) === 0 && seedValue != null && Number(seedValue) !== 0) return;
    (result as Record<string, any>)[key] = value;
  });
  return applySingleCalcRatioAliases(result as Record<string, any>, rows, seed);
}
function computeCalcValues(values: any) {
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
    console.warn("[meeting-review] calc formula failed:", error);
    return result;
  }
}
function runCalc() {
  const baseSnapshot = buildBaseSnapshot(
    state.value.calcBaseVersion ||
      state.value.baselineVersion ||
      BASELINE_VERSION_KEY,
    state.value.calcBaseYear,
  );
  const draftInput = state.value.calcDraftValues || {};
  const merged = { ...baseSnapshot };

  calcEditableFields.value.forEach((field) => {
    const raw = (draftInput as Record<string, any>)[field.id];
    if (String(raw).trim() === "") {
      return;
    }
    const num = safeNumber(raw);
    if (num != null) {
      (merged as Record<string, any>)[field.id] = num;
    }
  });

  const calcValues = computeCalcValues(merged);
  calcResult.value = calcValues;
  return calcValues;
}
function _calcMetricText(metricKey: any) {
  const item =
    (CALC_RESULT_METRIC_META as Record<string, any>)[metricKey] || {};
  return formatNumber(
    (calcResult.value as Record<string, any>)[metricKey],
    item,
  );
}
function _createCalcVersionDraft() {
  state.value.activeCalcVersionKey = "";
  calcVersionNameInput.value = "";
  initCalcDraftFromBase();
}
function _selectCalcVersion(key: any) {
  const version = findCalcVersionByKey(key);
  if (!version) return;
  state.value.activeCalcVersionKey = key;
  calcVersionNameInput.value = version.label;

  const draft = {};
  calcEditableFields.value.forEach((field) => {
    const value = version.values[field.id];
    (draft as Record<string, any>)[field.id] =
      value == null ? "" : String(value);
  });
  state.value.calcDraftValues = draft;
  runCalc();
}
async function _removeCalcVersion(key: any) {
  if (!key) return;
  const list = state.value.calcVersions || [];
  state.value.calcVersions = list.filter((item: any) => item.key !== key);
  state.value.compareVersions = (state.value.compareVersions || []).filter(
    (item: any) => item !== key,
  );

  if (state.value.baselineVersion === key) {
    state.value.baselineVersion = "brand";
  }
  if (state.value.decisionSource === key) {
    state.value.decisionSource = "finance";
  }
  if (state.value.activeCalcVersionKey === key) {
    state.value.activeCalcVersionKey = "";
    calcVersionNameInput.value = "";
  }

  ensureStateAfterVersionChange();
  initCalcDraftFromBase();
  await handleSaveDraft(false);
}
async function _applyCalcToMatrix() {
  const calcValues = runCalc();
  if (!calcValues) {
    BaseToast.warning("请先完成测算");
    return;
  }

  const currentKey = safeText(state.value.activeCalcVersionKey);
  const customLabel = safeText(calcVersionNameInput.value);

  if (currentKey) {
    const item = findCalcVersionByKey(currentKey);
    if (!item) return;
    item.values = clone(calcValues);
    item.label = customLabel || item.label;
  } else {
    const nextSeed = Number(state.value.calcVersionSeed || 0) + 1;
    state.value.calcVersionSeed = nextSeed;
    const key = `calc_v${nextSeed}`;
    const label = customLabel || `测算值v${nextSeed}`;
    state.value.calcVersions.push({
      key,
      label,
      dot: "calc",
      group: "calc",
      values: clone(calcValues),
    });
    state.value.activeCalcVersionKey = key;
    calcVersionNameInput.value = label;
  }

  if (
    state.value.activeCalcVersionKey &&
    state.value.activeCalcVersionKey !== state.value.baselineVersion &&
    !state.value.compareVersions.includes(state.value.activeCalcVersionKey)
  ) {
    state.value.compareVersions.push(state.value.activeCalcVersionKey);
  }

  ensureStateAfterVersionChange();
  const response = await handleSaveDraft(false);
  if (response && response.ok) {
    BaseToast.success("测算版本已保存");
  } else {
    BaseToast.warning(
      (response && response.message) ||
        "测算版本已在当前页面更新，草稿保存失败",
    );
  }
}
function getDecisionSourceLabel(key: any) {
  const hit = decisionSourceOptions.value.find((item: any) => item.key === key);
  return hit ? hit.label : key;
}
function toMaybeLong(value: any) {
  const text = safeText(value);
  if (!text || !/^\d+$/.test(text)) return null;
  const num = Number(text);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}
function normalizeReviewIdList(value: any) {
  const list = Array.isArray(value) ? value : [value];
  return list
    .reduce((result, item) => {
      if (Array.isArray(item)) {
        result.push(...item);
        return result;
      }
      result.push(item);
      return result;
    }, [])
    .map((item: any) => toMaybeLong(item))
    .filter(
      (item: any, index: any, array: any) =>
        item != null && array.indexOf(item) === index,
    );
}
function normalizeRecordId(record: any) {
  return toMaybeLong(record && (record.id || record.recordId));
}
function collectDecisionTargetRefs(records: any[] = []) {
  const targetRecordIds: any[] = [];
  const targetSubmitIds: any[] = [];
  const append = (bucket: any, values: any) => {
    normalizeReviewIdList(values).forEach((id: any) => {
      if (!bucket.includes(id)) bucket.push(id);
    });
  };
  (Array.isArray(records) ? records : []).forEach((record) => {
    const recordId = normalizeRecordId(record);
    if (recordId != null) append(targetRecordIds, recordId);
    append(targetSubmitIds, normalizeRecordSubmitIds(record));
  });
  return {
    targetRecordIds,
    targetSubmitIds,
  };
}
function getDecisionTargetSourceKey(sourceKey: any) {
  const source = safeText(sourceKey, "finance");
  if (DECISION_SOURCE_VERSION_KEYS.includes(source)) return source;
  return safeText(
    state.value.calcBaseVersion,
    state.value.baselineVersion || BASELINE_VERSION_KEY,
  );
}
async function buildDecisionTargetRefs(sourceKey: any) {
  const targetSource = getDecisionTargetSourceKey(sourceKey);
  const subjectIds = getReviewSubjectIds(subjects.value);
  if (!subjectIds.length) {
    return {
      targetRecordIds: [],
      targetSubmitIds: [],
    };
  }
  const records = await queryReviewSourceRecords(targetSource, subjectIds);
  return collectDecisionTargetRefs(records);
}
function isSavableDecisionYearLabel(yearLabel: any) {
  const text = safeText(yearLabel);
  if (!text || normalizeYearMatchKey(text) === "lifecycle") return false;
  return resolveDecisionModelYear(text) != null;
}
function resolveDecisionModelYear(yearLabel: any) {
  const text = safeText(yearLabel);
  const hit = text.match(/(\d{4})/);
  if (!hit || !hit[1]) return null;
  const year = Number(hit[1]);
  return Number.isFinite(year) ? year : null;
}
function isSavableDecisionTrimLabel(trimName: any) {
  const text = safeText(trimName);
  return Boolean(text && !isSubtotalTrimLabel(text));
}
function getSavableDecisionYearIndexes() {
  const years = Array.isArray(dimensions.value.years)
    ? dimensions.value.years
    : [];
  return years
    .map((year: any, index: any) => ({ year, index }))
    .filter(({ year }: any) => isSavableDecisionYearLabel(year))
    .map(({ index }: any) => index);
}
function getSavableDecisionTrimIndexes() {
  const trims = Array.isArray(dimensions.value.trims)
    ? dimensions.value.trims
    : [];
  return trims
    .map((trim: any, index: any) => ({ trim, index }))
    .filter(({ trim }: any) => isSavableDecisionTrimLabel(trim))
    .map(({ index }: any) => index);
}
function resolveDecisionValuePayload(value: any, item: any = {}) {
  return buildRevenueValuePayload(value, item);
}
function buildMeetingReviewDataItem(
  item: any,
  trimName: any,
  yearLabel: any,
  value: any,
) {
  const subjectId = toMaybeLong(item && item.subjectId);
  const modelYear = resolveDecisionModelYear(yearLabel);
  if (subjectId == null || modelYear == null) return null;
  const valuePayload = resolveDecisionValuePayload(value, item);
  if (!valuePayload.rawValue) return null;
  return {
    subjectId,
    modelName:
      project.value.projectCode ||
      queryProjectCode.value ||
      queryProjectNo.value,
    trimName: safeText(trimName, "默认版型"),
    modelYear,
    yearAggregateMode: "SPECIFIC",
    valueType: valuePayload.valueType,
    rawValue: valuePayload.rawValue,
    numberValue: valuePayload.numberValue,
    textValue: valuePayload.textValue,
  };
}
function readExplicitCandidateYearTrimValue(
  itemOrId: any,
  versionKey: any,
  yearIndex: any,
  trimIndex: any,
) {
  const valueVersionKey = resolveValueVersionKey(versionKey);
  const subjectValueKeys = resolveSubjectValueKeys(itemOrId);
  for (let index = 0; index < subjectValueKeys.length; index += 1) {
    const key = subjectValueKeys[index];
    const candidate = (candidateValues.value as Record<string, any>)[key];
    const yearTrims =
      candidate && candidate.yearTrims && candidate.yearTrims[valueVersionKey];
    const yearTrimValues = yearTrims && yearTrims[Number(yearIndex)];
    if (
      Array.isArray(yearTrimValues) &&
      yearTrimValues[Number(trimIndex)] != null
    ) {
      return yearTrimValues[Number(trimIndex)];
    }
  }
  return null;
}
function readCandidateYearFallbackValue(
  itemOrId: any,
  versionKey: any,
  yearIndex: any,
) {
  const valueVersionKey = resolveValueVersionKey(versionKey);
  const subjectValueKeys = resolveSubjectValueKeys(itemOrId);
  for (let index = 0; index < subjectValueKeys.length; index += 1) {
    const key = subjectValueKeys[index];
    const candidate = (candidateValues.value as Record<string, any>)[key];
    const years =
      candidate && candidate.years && candidate.years[valueVersionKey];
    if (years && years[Number(yearIndex)] != null) {
      return years[Number(yearIndex)];
    }
  }
  return null;
}
function getDecisionValueForSave(
  item: any,
  sourceKey: any,
  trimIndex: any,
  yearIndex: any,
  allowYearFallback: any,
) {
  if (isCalcVersionKey(sourceKey)) {
    return getRawVersionValue(item, sourceKey, trimIndex, yearIndex);
  }
  const explicitValue = readExplicitCandidateYearTrimValue(
    item,
    sourceKey,
    yearIndex,
    trimIndex,
  );
  if (explicitValue != null) return explicitValue;
  return allowYearFallback
    ? readCandidateYearFallbackValue(item, sourceKey, yearIndex)
    : null;
}
function dedupeMeetingReviewDataItems(items: any[] = []) {
  const map = {};
  const order: any[] = [];
  (Array.isArray(items) ? items : []).forEach((item: any) => {
    if (!item) return;
    const key = [
      item.subjectId,
      safeText(item.modelName).toLowerCase(),
      safeText(item.trimName).toLowerCase(),
      item.modelYear,
    ].join("__");
    if (!(map as Record<string, any>)[key]) order.push(key);
    (map as Record<string, any>)[key] = item;
  });
  return order.map((key) => (map as Record<string, any>)[key]);
}
function buildMeetingReviewDataItems(sourceKey: any) {
  const source = safeText(sourceKey, "finance");
  if (!source || source === "custom") return [];
  const yearIndexes = getSavableDecisionYearIndexes();
  const trimIndexes = getSavableDecisionTrimIndexes();
  if (!yearIndexes.length || !trimIndexes.length) return [];
  const isCalc = isCalcVersionKey(source);
  const saveYearIndexes = isCalc ? yearIndexes.slice(0, 1) : yearIndexes;
  const saveTrimIndexes = isCalc ? trimIndexes.slice(0, 1) : trimIndexes;
  const allowYearFallback = saveTrimIndexes.length === 1;
  const years = Array.isArray(dimensions.value.years)
    ? dimensions.value.years
    : [];
  const trims = Array.isArray(dimensions.value.trims)
    ? dimensions.value.trims
    : [];
  const items: any[] = [];

  subjects.value.forEach((group) => {
    (group.items || []).forEach((item: any) => {
      saveYearIndexes.forEach((yearIndex: any) => {
        saveTrimIndexes.forEach((trimIndex: any) => {
          const value = getDecisionValueForSave(
            item,
            source,
            trimIndex,
            yearIndex,
            allowYearFallback,
          );
          const dataItem = buildMeetingReviewDataItem(
            item,
            trims[trimIndex],
            years[yearIndex],
            value,
          );
          if (dataItem) items.push(dataItem);
        });
      });
    });
  });

  return dedupeMeetingReviewDataItems(items);
}
async function buildMeetingReviewSavePayload(options: any = {}) {
  const source = safeText(state.value.decisionSource, "finance");
  const decisionAction = safeText(
    options.decisionAction,
    "CONFIRM",
  ).toUpperCase();
  const shouldSaveDecisionData = decisionAction !== "REJECT";
  const targetRefs = await buildDecisionTargetRefs(source);
  return {
    projectNo: queryProjectNo.value,
    projectCode: queryProjectCode.value,
    projectId: queryProjectId.value,
    flowId: queryFlowId.value || project.value.flowId,
    valve: queryValve.value,
    stage: queryStage.value,
    nodeStatus: normalizedNodeStatus.value,
    permissionKey: queryPermissionKey.value,
    userId: queryUserId.value,
    userName: queryUserName.value,
    state: state.value,
    source,
    sourceLabel: getDecisionSourceLabel(source),
    meetingOpinion: state.value.meetingOpinion,
    decisionAction,
    dataItems: shouldSaveDecisionData
      ? buildMeetingReviewDataItems(source)
      : [],
    ...targetRefs,
  };
}
async function handleSaveDraft(showMessage = true) {
  const response = await saveMeetingReviewDraft(
    await buildMeetingReviewSavePayload(),
  );
  if (showMessage && response && response.ok) {
    BaseToast.success("草稿已保存");
  } else if (showMessage) {
    BaseToast.warning((response && response.message) || "草稿保存失败");
  }
  return response;
}
async function handleExport() {
  const response = await exportMeetingReviewReport({
    projectNo: queryProjectNo.value,
  });
  if (response && response.ok) {
    BaseToast.success(`已生成导出文件：${(response as any).fileName}`);
  } else {
    BaseToast.warning((response && response.message) || "导出失败");
  }
}
async function confirmStageFlowSubmit(message: any, title = "提交确认") {
  try {
    await openConfirm({
      title,
      message,
      type: "warning",
      confirmText: "确认提交",
    });
    return true;
  } catch {
    return false;
  }
}
async function handleSubmitDecision() {
  if (isMeetingDecisionFrozen.value || meetingDecisionSubmitting.value) {
    return;
  }
  if (!safeText(state.value.meetingOpinion)) {
    BaseToast.warning("请先填写会议意见");
    return;
  }

  if (state.value.decisionSource === "custom") {
    if (!safeText(state.value.customDecisionValue)) {
      BaseToast.warning("请选择自定义值并填写定值");
      return;
    }
    if (!safeText(state.value.customDecisionNote)) {
      BaseToast.warning("请填写自定义值来源说明");
      return;
    }
  }

  const confirmed =
    await confirmStageFlowSubmit("确认提交上会值并完成本次收益评审吗？");
  if (!confirmed) return;

  meetingDecisionSubmitting.value = true;
  try {
    const response = await submitMeetingReviewDecision(
      await buildMeetingReviewSavePayload(),
    );

    if (!response || !response.ok) {
      BaseToast.error(
        (response && response.message) || "确认上会值失败，请稍后重试",
      );
      return;
    }

    const result = (response as any).result || {};
    decisionResult.value = result;
    project.value = {
      ...project.value,
      nodeStatus:
        ((response as any).flowResult &&
          (response as any).flowResult.nodeStatus) ||
        result.flowNodeStatus ||
        "FINISHED",
      flowUpdatedAt: result.completedAt || project.value.flowUpdatedAt,
    };
    currentStep.value = "S8";
    if ((response as any).timelineItem) {
      timeline.value = [(response as any).timelineItem].concat(
        timeline.value || [],
      );
    }
    if (
      (response as any).flowResult &&
      (response as any).flowResult.pendingConfirm
    ) {
      BaseToast.success(
        `上会值版本已确认：${safeText(result.meetingVersion, "S8-MEETING")}，等待第二人确认后完成流程`,
      );
    } else {
      BaseToast.success(
        `上会值版本已确认：${safeText(result.meetingVersion, "S8-MEETING")}`,
      );
    }
  } finally {
    meetingDecisionSubmitting.value = false;
  }
}
async function handleRejectDecision() {
  if (isMeetingDecisionFrozen.value || meetingDecisionSubmitting.value) {
    return;
  }
  if (!safeText(state.value.meetingOpinion)) {
    BaseToast.warning("请先填写会议意见");
    return;
  }

  const confirmed = await confirmStageFlowSubmit(
    "确认驳回本次上会评审，并结束当前收益流程吗？",
    "驳回确认",
  );
  if (!confirmed) return;

  meetingDecisionSubmitting.value = true;
  try {
    const response = await rejectMeetingReviewDecision(
      await buildMeetingReviewSavePayload({
        decisionAction: "REJECT",
      }),
    );

    if (!response || !response.ok) {
      BaseToast.error((response && response.message) || "驳回失败，请稍后重试");
      return;
    }

    const result = (response as any).result || {};
    decisionResult.value = {
      ...result,
      rejected: true,
    };
    project.value = {
      ...project.value,
      nodeStatus:
        ((response as any).flowResult &&
          (response as any).flowResult.nodeStatus) ||
        result.flowNodeStatus ||
        "VOIDED",
      flowUpdatedAt: result.completedAt || project.value.flowUpdatedAt,
    };
    currentStep.value = "S8";
    if ((response as any).timelineItem) {
      timeline.value = [(response as any).timelineItem].concat(
        timeline.value || [],
      );
    }
    if (
      (response as any).flowResult &&
      (response as any).flowResult.pendingConfirm
    ) {
      BaseToast.success("驳回意见已提交，等待第二人确认后结束流程");
    } else {
      BaseToast.success("已驳回并结束当前收益流程");
    }
  } finally {
    meetingDecisionSubmitting.value = false;
  }
}

void _moduleBaseQuery.value;
void _headerInfoItems.value;
void _stageLatestOpinionCards.value;
void _selectedYearLabel.value;
void _fullscreenTableFontSizeTip.value;
void _isFullscreenTableFontSizeMin.value;
void _fullscreenEntryStyle.value;
void _fullscreenDockStyle.value;
void _controlDrawerSize.value;
void _parseReviewSuggestionDetail;
void _focusReviewSubject;
void _unwrapSubjectTreePayload;
void _loadReviewCandidateValues;
void _scrollToNodeReview;
void _onBaselineChange;
void _onTrimChange;
void _toggleTableSystemFullscreen;
void _openCompareControlDrawer;
void _increaseFullscreenTableFontSize;
void _decreaseFullscreenTableFontSize;
void _onQuickEntryClick;
void _startQuickEntryDrag;
void _onQuickEntryTouchEnd;
void _versionSupportsTrim;
void _onCalcBaseChange;
void _onCalcFieldInput;
void _calcMetricText;
void _createCalcVersionDraft;
void _selectCalcVersion;
void _removeCalcVersion;
void _applyCalcToMatrix;
</script>

<style lang="scss" scoped>
@use "../styles/revenue-visual-spec-g.scss" as *;

.meeting-review-detail {
  --g-bg: #fafaf9;
  --g-surface: #ffffff;
  --g-focus-bg: #eff6ff;
  --g-line: #e7e5e4;
  --g-line-strong: #d6d3d1;
  --g-focus-soft: #bfdbfe;
  --g-text: #0c0a09;
  --g-text-2: #44403c;
  --g-text-3: #78716c;
  --g-text-4: #a8a29e;
  --g-focus: #0071e3;
  --g-focus-strong: #005bb5;
  --g-action-ink: var(--g-focus);
  --g-action-ink-hover: var(--g-focus-strong);
  --g-action-ink-soft: rgba(0, 113, 227, 0.08);
  --g-tool-accent: #9aa0aa;
  --g-tool-accent-soft: #fcfcfd;
  --g-tool-accent-text: #4b5563;
  --g-src-brand: #b45309;
  --g-src-dept: #6d28d9;
  --g-src-finance: #1d4ed8;
  --g-impact-pos: #166534;
  --g-impact-neg: #7c2d12;
  --g-radius-sm: 4px;
  --g-radius-md: 6px;
  --g-radius-lg: 10px;
  --g-shadow-xs: 0 0 0 1px rgba(12, 10, 9, 0.04);
  --g-shadow-sm:
    0 1px 3px rgba(12, 10, 9, 0.06), 0 0 0 1px rgba(12, 10, 9, 0.04);
  --g-focus-ring: 0 0 0 3px rgba(0, 113, 227, 0.08);
  --g-motion: 180ms cubic-bezier(0.4, 0, 0.2, 1);
  --g-font-sans:
    "PingFang SC", "Inter", "Microsoft YaHei", -apple-system, sans-serif;
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
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    flex: 1 1 auto;
    min-width: 0;
  }

  .hero-id {
    font-family: var(--g-font-mono);
    font-size: clamp(18px, 2vw, 24px);
    letter-spacing: -0.4px;
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

  :deep() .hero-actions .el-button {
    margin-left: 0;
    height: 30px;
    border-radius: var(--g-radius-sm);
    font-size: 12px;
    font-weight: 600;
    padding: 0 12px;
    border-color: var(--g-line-strong);
    color: var(--g-text-2);
    background: var(--g-surface);
    transition: all var(--g-motion);
  }

  :deep() .hero-actions .el-button:hover,
  :deep() .hero-actions .el-button:focus {
    border-color: var(--g-focus);
    color: var(--g-focus);
    background: var(--g-focus-bg);
  }

  :deep() .hero-actions .el-button--primary {
    border-color: var(--g-focus);
    background: var(--g-focus);
    color: #fff;
    box-shadow: 0 4px 12px rgba(0, 113, 227, 0.2);
  }

  :deep() .hero-actions .el-button--primary:hover,
  :deep() .hero-actions .el-button--primary:focus {
    border-color: var(--g-focus-strong);
    background: var(--g-focus-strong);
    color: #fff;
  }

  :deep() .hero-actions .calc-entry-btn {
    border-color: var(--g-focus);
    background: var(--g-focus);
    color: #fff;
    box-shadow: 0 4px 12px rgba(0, 113, 227, 0.2);
  }

  :deep() .hero-actions .calc-entry-btn:hover,
  :deep() .hero-actions .calc-entry-btn:focus {
    border-color: var(--g-focus-strong);
    background: var(--g-focus-strong);
    color: #fff;
  }

  .card-block {
    margin: 10px 18px 0;
    border: 1px solid var(--g-line);
    border-radius: var(--g-radius-md);
    background: var(--g-surface);
    padding: 14px;
    box-shadow: var(--g-shadow-xs);
  }

  .block-title {
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--g-text-3);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 700;
  }

  .progress-card {
    margin: 8px 12px 0;
    border: 0;
    background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
    box-shadow: none;
  }

  :deep() .el-steps {
    padding: 8px 10px;
    border-radius: var(--g-radius-sm);
    border: 1px solid var(--g-line);
    background: var(--g-bg);
  }

  :deep() .el-step__icon {
    width: 22px;
    height: 22px;
    font-size: 12px;
    font-weight: 700;
  }

  :deep() .el-step__title {
    font-size: 12px;
    color: var(--g-text-3);
  }

  :deep() .el-step__head.is-success .el-step__icon {
    border-color: #16a34a;
    color: #16a34a;
    background: #ecfdf3;
  }

  :deep() .el-step__title.is-success {
    color: #166534;
    font-weight: 700;
  }

  :deep() .el-step__head.is-process .el-step__icon {
    border-color: var(--g-focus);
    color: var(--g-focus);
    background: #ffffff;
    box-shadow: var(--g-focus-ring);
  }

  :deep() .el-step__title.is-process {
    color: var(--g-focus);
    font-weight: 700;
  }

  .toolbar-wrap {
    display: grid;
    gap: 10px;
    margin-bottom: 12px;
    padding: 12px;
    border: 1px solid var(--g-line);
    border-radius: var(--g-radius-sm);
    background: var(--g-bg);
  }

  .control-toolbar {
    border-color: #e7e5e4;
    background: linear-gradient(180deg, #fcfcfb 0%, #f7f6f4 100%);
  }

  .toolbar-top {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px dashed var(--g-line);
  }

  .toolbar-reset-btn {
    min-width: 86px;
  }

  :deep() .toolbar-reset-btn.el-button {
    border-color: var(--g-line-strong);
    color: var(--g-text-2);
    background: #ffffff;
    border-radius: var(--g-radius-sm);
  }

  :deep() .toolbar-reset-btn.el-button:hover,
  :deep() .toolbar-reset-btn.el-button:focus {
    border-color: var(--g-action-ink);
    color: var(--g-action-ink);
    background: var(--g-action-ink-soft);
  }

  :deep() .toolbar-calc-btn.el-button {
    border-color: var(--g-action-ink);
    background: var(--g-action-ink);
    color: #fff;
    border-radius: var(--g-radius-sm);
  }

  :deep() .toolbar-calc-btn.el-button:hover,
  :deep() .toolbar-calc-btn.el-button:focus {
    border-color: var(--g-action-ink-hover);
    background: var(--g-action-ink-hover);
    color: #fff;
  }

  .toolbar-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .toolbar-field {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1px solid transparent;
    border-radius: var(--g-radius-sm);
    background: rgba(255, 255, 255, 0.6);
  }

  .toolbar-field:hover {
    border-color: #d6d3d1;
    background: #ffffff;
  }

  .toolbar-label {
    font-size: 12px;
    color: var(--g-text-4);
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    font-weight: 700;
  }

  .toolbar-switches {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, auto));
    align-items: center;
    gap: 6px;
    margin-left: auto;
    padding: 0;
    background: transparent;
    border: 0;
  }

  .toolbar-switch-chip {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    transition:
      border-color var(--g-motion),
      background-color var(--g-motion);
  }

  .toolbar-switch-chip.active {
    border-color: var(--g-tool-accent);
    background: var(--g-tool-accent-soft);
  }

  :deep() .toolbar-switches .el-switch {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    min-height: 20px;
    gap: 8px;
  }

  .toolbar-mode-tip {
    margin-left: auto;
    font-size: 11px;
    color: var(--g-action-ink);
    background: rgba(0, 113, 227, 0.08);
    border: 1px solid rgba(0, 113, 227, 0.18);
    border-radius: 999px;
    padding: 2px 9px;
    font-weight: 600;
  }

  :deep() .toolbar-switches .el-switch__label {
    color: var(--g-text-3);
    font-size: 11px !important;
    font-weight: 600;
    line-height: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    padding: 0;
    border-radius: 8px;
    transition:
      color var(--g-motion),
      background-color var(--g-motion);
  }

  :deep() .toolbar-switches .el-switch__label span {
    font-size: 11px !important;
    line-height: 18px !important;
  }

  :deep() .toolbar-switches .el-switch__label.is-active {
    color: var(--g-tool-accent-text);
    background: transparent;
  }

  :deep() .toolbar-switches .el-switch__core {
    width: 34px !important;
    height: 20px;
    border-color: #e5e7eb;
    background: #ffffff;
  }

  :deep() .toolbar-switches .el-switch.is-checked .el-switch__core {
    border-color: var(--g-tool-accent);
    background: #f9fafb;
  }

  :deep() .toolbar-switches .el-switch__core:after {
    width: 14px;
    height: 14px;
    top: 2px;
    background-color: #9ca3af;
  }

  :deep() .toolbar-switches .el-switch.is-checked .el-switch__core:after {
    background-color: var(--g-tool-accent-text);
  }

  :deep() .toolbar-line .el-input__inner,
  :deep() .toolbar-line .el-select .el-input__inner {
    border-color: var(--g-line-strong);
    border-radius: var(--g-radius-sm);
    background: var(--g-surface);
    transition:
      border-color var(--g-motion),
      box-shadow var(--g-motion);
  }

  :deep() .toolbar-line .el-input__inner:focus,
  :deep() .toolbar-line .el-select .el-input.is-focus .el-input__inner {
    border-color: var(--g-action-ink);
    box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.12);
  }

  :deep() .compare-version-add-option {
    margin-top: 4px;
    border-top: 1px solid #e7e5e4;
    color: var(--g-focus);
    font-weight: 600;

    i {
      margin-right: 6px;
      font-size: 12px;
    }
  }

  :deep() .toolbar-line .el-radio-button__inner {
    border-color: #e5e7eb;
    color: var(--g-text-3);
    font-size: 11px;
    font-weight: 600;
    height: 30px;
    line-height: 28px;
    padding: 0 12px;
    background: #fff;
    transition: all var(--g-motion);
  }

  :deep() .toolbar-line .el-radio-group {
    display: inline-flex;
  }

  :deep()
    .toolbar-line
    .el-radio-button__orig-radio:checked
    + .el-radio-button__inner {
    border-color: var(--g-tool-accent);
    background: var(--g-tool-accent-soft);
    color: var(--g-tool-accent-text);
    box-shadow: none;
  }

  .table-wrap {
    position: relative;
    overflow: auto;
    border: 1px solid var(--g-line);
    border-radius: var(--g-radius-sm);
    max-height: 620px;
    background: var(--g-surface);
  }

  .compare-card {
    position: relative;
    margin: 8px 12px 0;
    border: 0;
    box-shadow: none;
  }

  .toolbar-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  :deep() .toolbar-fullscreen-btn.el-button {
    border-color: var(--g-action-ink);
    background: var(--g-action-ink);
    color: #fff;
    border-radius: var(--g-radius-sm);
  }

  :deep() .toolbar-fullscreen-btn.el-button:hover,
  :deep() .toolbar-fullscreen-btn.el-button:focus {
    border-color: var(--g-action-ink-hover);
    background: var(--g-action-ink-hover);
    color: #fff;
  }

  .compare-card.is-system-fullscreen {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 2400;
    margin: 0;
    border-radius: 0;
    box-shadow: 0 18px 48px rgba(12, 10, 9, 0.2);
    display: flex;
    flex-direction: column;
    background: #ffffff;
  }

  .compare-card.is-system-fullscreen .table-wrap {
    flex: 1;
    max-height: none;
    min-height: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding-bottom: 0;
    scrollbar-gutter: stable;
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed .table-wrap {
    overflow-x: auto;
    overflow-y: hidden;
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-expanded .table-wrap {
    overflow: auto;
    scrollbar-width: none;
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-expanded
    .table-wrap::-webkit-scrollbar:vertical {
    width: 0;
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-expanded
    .table-wrap::-webkit-scrollbar:horizontal {
    height: 8px;
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-expanded
    .table-wrap::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 999px;
  }

  .compare-card.is-system-fullscreen.is-table-centered .table-wrap {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
  }

  .compare-card.is-system-fullscreen .table-wrap .compare-table {
    flex: 0 0 auto;
    font-size: var(--fullscreen-user-font-size, 12px);
  }

  .compare-card.is-system-fullscreen .compare-table th {
    font-size: var(--fullscreen-user-head-font-size, 12px);
  }

  .compare-card.is-system-fullscreen .compare-table .section-row .subject-col {
    font-size: var(
      --fullscreen-user-section-font-size,
      var(--fullscreen-user-font-size, 12px)
    );
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed .compare-table {
    font-size: var(--fullscreen-user-font-size, 12px);
    height: var(--fullscreen-table-h, 100%);
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed
    .compare-table
    thead
    th {
    padding-top: var(--fullscreen-head-y, 2px);
    padding-bottom: var(--fullscreen-head-y, 2px);
    padding-left: 0;
    padding-right: 0;
    line-height: var(--fullscreen-head-line-h, 16px);
    overflow: hidden;
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed
    .compare-table
    thead
    tr:first-child
    th {
    height: var(--fullscreen-head-row-h, 24px);
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed
    .compare-table
    thead
    tr:nth-child(2)
    th {
    top: var(--fullscreen-head-row-h, 24px);
    height: var(--fullscreen-head-row-h, 24px);
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed
    .compare-table
    thead
    .subject-head-compare {
    height: calc(var(--fullscreen-head-row-h, 24px) * 2);
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed
    .compare-table
    tbody
    tr {
    height: var(--fullscreen-row-h, auto);
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed
    .compare-table
    tbody
    td {
    padding-top: var(--fullscreen-cell-y, 3px);
    padding-bottom: var(--fullscreen-cell-y, 3px);
    padding-left: 0;
    padding-right: 0;
    line-height: var(--fullscreen-line-h, 16px);
    overflow: hidden;
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed
    .compare-table
    tbody
    .fixed-fee-cell-inner {
    height: var(--fullscreen-line-h, 16px);
    max-height: var(--fullscreen-line-h, 16px);
    line-height: var(--fullscreen-line-h, 16px);
    overflow: hidden;
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed
    .compare-table
    .subject-cell-content {
    gap: 2px;
  }

  .compare-card.is-system-fullscreen.is-fixed-fee-collapsed
    .fixed-fee-detail-row.is-fixed-fee-collapsed {
    display: none;
  }

  .fullscreen-edge-entry {
    position: absolute;
    z-index: 3200;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    touch-action: none;
    user-select: none;
    transition: opacity var(--g-motion);
  }

  :deep() .fullscreen-edge-entry .quick-entry-btn.el-button {
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: 50%;
    border-color: var(--g-action-ink);
    background: rgba(0, 113, 227, 0.72);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0;
    box-shadow: 0 6px 16px rgba(0, 113, 227, 0.22);
  }

  .fullscreen-edge-entry.active {
    opacity: 1;
  }

  .fullscreen-edge-entry.dragging {
    opacity: 1;
  }

  :deep() .fullscreen-edge-entry .quick-entry-btn.el-button:hover,
  :deep() .fullscreen-edge-entry .quick-entry-btn.el-button:focus {
    border-color: var(--g-action-ink-hover);
    background: rgba(0, 91, 181, 0.92);
    color: #fff;
  }

  .fullscreen-quick-dock {
    position: absolute;
    z-index: 3200;
    display: grid;
    grid-template-columns: 1fr;
    width: 154px;
    justify-items: stretch;
    gap: 6px;
    padding: 6px;
    border: 1px solid var(--g-line);
    border-radius: var(--g-radius-sm);
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(2px);
    box-sizing: border-box;
  }

  .fullscreen-mode-tip {
    position: absolute;
    top: 16px;
    left: 50%;
    z-index: 3150;
    transform: translateX(-50%);
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    background: #eff6ff;
    color: #005bb5;
    box-shadow: 0 8px 20px rgba(0, 113, 227, 0.16);
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 700;
    pointer-events: none;
  }

  :deep() .fullscreen-quick-dock .quick-btn.el-button {
    margin: 0;
    width: 100% !important;
    min-width: 0;
    display: inline-flex;
    justify-content: center;
    border-radius: var(--g-radius-sm);
    border-color: var(--g-action-ink);
    color: #fff;
    background: var(--g-action-ink);
    font-size: 12px;
    font-weight: 600;
    box-sizing: border-box;
  }

  :deep() .fullscreen-quick-dock .quick-btn.el-button + .quick-btn.el-button {
    margin-left: 0;
  }

  :deep() .fullscreen-quick-dock .quick-btn.el-button:hover,
  :deep() .fullscreen-quick-dock .quick-btn.el-button:focus {
    border-color: var(--g-action-ink-hover);
    background: var(--g-action-ink-hover);
    color: #fff;
  }

  .quick-font-control {
    display: grid;
    grid-template-columns: 1fr 28px 48px 28px;
    align-items: center;
    gap: 4px;
    min-height: 28px;
    padding: 4px;
    border: 1px solid #bfdbfe;
    border-radius: var(--g-radius-sm);
    background: #eff6ff;
    color: #005bb5;
    box-sizing: border-box;
  }

  .quick-font-name,
  .quick-font-value {
    font-size: 12px;
    font-weight: 700;
    line-height: 20px;
    letter-spacing: 0;
    text-align: center;
    white-space: nowrap;
  }

  .quick-font-value {
    color: var(--g-text);
  }

  :deep() .quick-font-control .quick-font-step.el-button {
    width: 28px;
    height: 24px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border-radius: var(--g-radius-sm);
    border-color: #93c5fd;
    background: #ffffff;
    color: #005bb5;
  }

  :deep() .quick-font-control .quick-font-step.el-button:hover,
  :deep() .quick-font-control .quick-font-step.el-button:focus {
    border-color: var(--g-action-ink);
    color: var(--g-action-ink);
  }

  :deep() .quick-font-control .quick-font-step.el-button.is-disabled,
  :deep() .quick-font-control .quick-font-step.el-button.is-disabled:hover,
  :deep() .quick-font-control .quick-font-step.el-button.is-disabled:focus {
    border-color: #dbeafe;
    color: #93a4b8;
    background: #f8fbff;
  }

  .compare-table {
    --subject-col-w: 132px;
    --value-col-min-w: 112px;
    --value-col-w: 112px;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    font-size: 12px;

    th,
    td {
      border-bottom: 1px solid var(--g-line);
      border-right: 1px solid var(--g-line);
      padding: 6px 12px;
      white-space: nowrap;
      box-sizing: border-box;
    }

    .subject-width-col {
      width: var(--subject-col-w);
    }

    .value-width-col {
      width: var(--value-col-w);
    }

    th:first-child,
    td:first-child {
      border-left: 1px solid var(--g-line);
    }

    tr:first-child th {
      border-top: 1px solid var(--g-line);
    }

    th {
      position: sticky;
      top: 0;
      z-index: 6;
      background: var(--g-bg);
      color: var(--g-text-3);
      text-align: center;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: 600;
    }

    thead tr:first-child th {
      top: 0;
      height: 36px;
      z-index: 8;
    }

    thead tr:nth-child(2) th {
      top: 36px;
      z-index: 7;
    }

    .subject-col {
      position: sticky;
      left: 0;
      z-index: 9;
      background: var(--g-surface);
      color: var(--g-text);
      text-align: left;
      width: var(--subject-col-w);
      min-width: var(--subject-col-w);
      max-width: var(--subject-col-w);
      box-shadow: 1px 0 0 0 var(--g-line);
    }

    thead .subject-col {
      top: 0;
      background: var(--g-bg);
      color: var(--g-text-3);
      z-index: 24;
    }

    thead tr:first-child th.subject-head {
      top: 0;
      z-index: 30;
      background: var(--g-bg);
    }

    thead .subject-head {
      vertical-align: middle;
    }

    thead .subject-head-compare {
      height: 72px;
    }

    thead tr:first-child th.is-frozen-version-head {
      position: sticky;
      z-index: 24;
      background: var(--g-bg);
      box-shadow: 1px 0 0 0 var(--g-line);
    }

    thead tr:nth-child(2) th.is-frozen-year-head {
      position: sticky;
      z-index: 22;
      background: var(--g-bg);
      box-shadow: 1px 0 0 0 var(--g-line);
    }

    .trim-head,
    .num-cell,
    .section-fill-cell {
      min-width: var(--value-col-w);
      width: var(--value-col-w);
    }

    .is-frozen-value-cell {
      position: sticky;
      z-index: 8;
      background: var(--g-surface);
      box-shadow: 1px 0 0 0 var(--g-line);
    }

    .section-row .subject-col {
      background: #f6f5f4;
      color: var(--g-text-3);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 700;
    }

    .section-row .section-fill-cell {
      background: #f6f5f4;
    }

    .section-row .section-fill-cell.is-frozen-value-cell {
      background: #f6f5f4;
    }

    .subject-col.bold {
      font-weight: 700;
    }

    .subject-col.is-collapse-parent {
      font-weight: 700;
      cursor: pointer;
    }

    .subject-cell-content {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
    }

    .subject-collapse-icon {
      margin-left: auto;
      color: var(--g-text-3);
      font-size: 12px;
      line-height: 1;
      transition: color var(--g-motion);
    }

    .subject-col.is-collapse-parent:hover .subject-collapse-icon {
      color: var(--g-focus);
    }

    .fixed-fee-detail-row td {
      transition:
        padding 0.2s ease,
        border-color 0.2s ease;
    }

    .fixed-fee-cell-inner {
      max-height: 32px;
      overflow: hidden;
      opacity: 1;
      transform: translateY(0);
      transition:
        max-height 0.22s ease,
        opacity 0.16s ease,
        transform 0.22s ease;
    }

    .fixed-fee-detail-row.is-fixed-fee-collapsed td {
      padding-top: 0;
      padding-bottom: 0;
      border-bottom-color: transparent;
    }

    .fixed-fee-detail-row.is-fixed-fee-collapsed .fixed-fee-cell-inner {
      max-height: 0;
      opacity: 0;
      transform: translateY(-8px);
    }

    .version-head {
      text-align: center;
      font-weight: 700;
      color: var(--g-text-2);
    }

    .trim-head {
      text-align: center;
      font-weight: 600;
      color: var(--g-text-3);
      text-transform: none;
      letter-spacing: 0;
      font-size: 12px;
    }

    .num-cell {
      text-align: right;
      color: var(--g-text);
      font-family: var(--g-font-mono);
      font-variant-numeric: tabular-nums;
    }

    .num-cell.baseline {
      background: #fafaf9;
      font-weight: 700;
    }

    .num-cell.compare.dot-calc {
      background: #fff8ec;
    }

    .num-cell.diff-auto {
      color: var(--g-impact-neg);
      font-weight: 700;
    }

    .num-cell.baseline.is-frozen-value-cell {
      background: #fafaf9;
    }

    .num-cell.diff-auto.is-frozen-value-cell {
      background: transparent;
    }

    tbody tr.is-manual-row-highlight > td,
    tbody tr.is-manual-row-highlight > td.is-frozen-value-cell,
    tbody tr.is-manual-row-highlight > td.num-cell.baseline,
    tbody tr.is-manual-row-highlight > td.num-cell.diff-auto,
    tbody td.is-manual-cell-highlight {
      background: #fff4a8 !important;
      color: #3f2f00;
    }

    tbody td.is-manual-cell-highlight {
      box-shadow: inset 0 0 0 2px #facc15;
    }

    .chip-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 6px;
      vertical-align: middle;
    }

    .chip-dot.brand {
      background: var(--g-src-brand);
    }

    .chip-dot.business {
      background: #0f766e;
    }

    .chip-dot.dept {
      background: var(--g-src-dept);
    }

    .chip-dot.finance {
      background: var(--g-src-finance);
    }

    .chip-dot.calc {
      background: #d97706;
    }

    .chip-dot.competitor {
      background: #b91c1c;
    }

    .chip-dot.history {
      background: var(--g-text-4);
    }
  }

  .decision-row {
    display: grid;
    gap: 8px;
    margin-bottom: 12px;

    label {
      font-size: 12px;
      color: var(--g-text-3);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
  }

  .decision-source-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  :deep() .decision-source-actions .source-option {
    height: 56px;
    border-radius: var(--g-radius-sm);
    border-color: var(--g-line-strong);
    color: var(--g-text-2);
    transition: all var(--g-motion);
    margin: 0;
  }

  :deep() .decision-source-actions .source-option.selected {
    border-color: var(--g-focus);
    background: color-mix(in srgb, var(--g-focus) 50%, transparent);
    color: var(--g-focus);
    box-shadow: inset 3px 0 0 var(--g-focus);
  }

  .review-footer {
    margin: 10px 18px 0;
    border: 1px solid var(--g-line);
    border-radius: var(--g-radius-md);
    background: var(--g-surface);
    padding: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .review-footer-left {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    .freeze-time,
    .decision-version {
      font-size: 12px;
      color: var(--g-text-3);
      letter-spacing: 0.2px;
    }

    .decision-version {
      color: var(--g-focus);
      font-weight: 700;
      font-family: var(--g-font-mono);
    }
  }

  .footer-actions {
    display: inline-flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  :deep() .footer-actions .el-button {
    border-radius: var(--g-radius-sm);
  }

  :deep() .footer-actions .heavy-confirm-btn {
    height: 38px;
    padding: 0 22px;
    font-weight: 700;
    box-shadow: 0 4px 12px rgba(0, 113, 227, 0.2);
  }

  :deep() .footer-actions .el-button--default:hover,
  :deep() .footer-actions .el-button--default:focus {
    border-color: var(--g-focus);
    color: var(--g-focus);
    background: var(--g-focus-bg);
  }

  .process-review-card {
    display: grid;
    gap: 12px;
  }

  .process-review-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .process-review-subtitle {
    font-size: 12px;
    color: var(--g-text-3);
    line-height: 1.5;
  }

  .flow-meta-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
  }

  .flow-meta-item {
    min-width: 0;
    border: 1px solid var(--g-line);
    border-radius: var(--g-radius-sm);
    background: var(--g-bg);
    padding: 8px 10px;

    span {
      display: block;
      margin-bottom: 4px;
      font-size: 11px;
      color: var(--g-text-4);
      font-weight: 700;
    }

    b {
      display: block;
      color: var(--g-text-2);
      font-size: 12px;
      font-weight: 700;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
  }

  .stage-opinion-summary-card {
    display: grid;
    gap: 10px;
  }

  .stage-opinion-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 8px;

    &.stage-opinion-grid--dept {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  .stage-opinion-item {
    min-width: 0;
    border: 1px solid var(--g-line);
    border-radius: var(--g-radius-sm);
    background: var(--g-bg);
    padding: 8px 10px;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;

    &.is-current {
      border-color: var(--g-focus-soft);
      background: #fbfdff;
      box-shadow: inset 3px 0 0 var(--g-focus);
    }
  }

  .stage-opinion-head {
    display: grid;
    gap: 2px;
    margin-bottom: 6px;
  }

  .stage-opinion-code {
    font-size: 11px;
    color: var(--g-text-4);
    font-weight: 700;
    line-height: 1.2;
  }

  .stage-opinion-label {
    display: block;
    color: var(--g-text-2);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .stage-opinion-entry {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .stage-opinion-entry-title {
    color: var(--g-text-2);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.4;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .stage-opinion-entry-time {
    color: var(--g-text-4);
    font-size: 11px;
    line-height: 1.3;
  }

  .stage-opinion-entry-meta {
    color: var(--g-text-3);
    font-size: 11px;
    line-height: 1.45;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .stage-opinion-entry-opinion {
    color: var(--g-text-2);
    font-size: 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
  }

  .stage-opinion-entry--log {
    .stage-opinion-entry-time {
      font-family: var(--g-font-mono);
      color: var(--g-text-4);
      font-size: 11px;
      line-height: 1.3;
    }

    .stage-opinion-entry-actor {
      color: var(--g-text-2);
      font-size: 12px;
      font-weight: 700;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .stage-opinion-entry-remark {
      color: var(--g-text-3);
      font-size: 12px;
      line-height: 1.5;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      overflow: hidden;
    }
  }

  .stage-opinion-empty {
    color: var(--g-text-4);
    font-size: 12px;
    line-height: 1.5;
  }

  .node-review-list {
    display: grid;
    gap: 10px;
  }

  .node-review-item {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    gap: 14px;
    border: 1px solid var(--g-line);
    border-radius: var(--g-radius-sm);
    background: #fff;
    padding: 12px;
    scroll-margin-top: 16px;
  }

  .node-review-item.is-current {
    border-color: var(--g-focus-soft);
    background: #fbfdff;
    box-shadow: inset 3px 0 0 var(--g-focus);
  }

  .node-review-item.is-empty {
    background: #fcfcfb;
  }

  .node-review-main {
    min-width: 0;
  }

  .node-review-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;

    b {
      color: var(--g-text);
      font-size: 13px;
      line-height: 1.4;
    }
  }

  .node-code {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    height: 22px;
    border-radius: var(--g-radius-sm);
    background: var(--g-focus-bg);
    color: var(--g-focus);
    font-size: 12px;
    font-family: var(--g-font-mono);
    font-weight: 700;
  }

  .node-review-meta {
    margin-top: 8px;
    color: var(--g-text-3);
    font-size: 12px;
    line-height: 1.6;
  }

  .node-review-body {
    min-width: 0;
    display: grid;
    gap: 8px;
  }

  .review-entry-list {
    display: grid;
    gap: 8px;
    max-height: 320px;
    overflow: auto;
    padding-right: 4px;
  }

  .review-entry {
    border: 1px solid #eef2f7;
    border-radius: var(--g-radius-sm);
    background: #ffffff;
    padding: 9px 10px;
  }

  .review-entry-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;

    span {
      color: var(--g-text-2);
      font-size: 12px;
      font-weight: 700;
      line-height: 1.4;
    }

    em {
      flex: 0 0 auto;
      color: var(--g-text-4);
      font-size: 12px;
      font-style: normal;
      font-family: var(--g-font-mono);
      line-height: 1.4;
    }
  }

  .review-entry-meta {
    margin-top: 4px;
    color: var(--g-text-3);
    font-size: 12px;
    line-height: 1.5;
  }

  .review-entry-opinion {
    margin-top: 7px;
    color: var(--g-text);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .flow-log-list {
    display: grid;
    gap: 4px;
    border-top: 1px dashed var(--g-line);
    padding-top: 8px;
  }

  .flow-log-entry {
    display: grid;
    grid-template-columns: 142px 120px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
    color: var(--g-text-3);
    font-size: 12px;
    line-height: 1.5;

    span {
      font-family: var(--g-font-mono);
      color: var(--g-text-4);
    }

    b {
      color: var(--g-text-2);
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    em {
      font-style: normal;
      overflow-wrap: anywhere;
    }
  }

  .node-review-empty {
    border: 1px dashed var(--g-line);
    border-radius: var(--g-radius-sm);
    color: var(--g-text-4);
    font-size: 12px;
    padding: 10px;
    text-align: center;
    background: var(--g-bg);
  }

  .timeline-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
  }

  .timeline-item {
    display: grid;
    grid-template-columns: 130px 1fr;
    align-items: center;
    gap: 10px 14px;
    border-bottom: 1px solid var(--g-line);
    background: transparent;
    border-radius: 0;
    padding: 10px 0;

    &:last-child {
      border-bottom: none;
    }
  }

  .timeline-item.is-now {
    background: var(--g-focus-bg);
    border: 1px solid var(--g-focus-soft);
    border-radius: var(--g-radius-sm);
    padding: 10px 12px;
    margin-bottom: 4px;
  }

  .timeline-head {
    display: contents;

    b {
      grid-column: 2;
      grid-row: 1;
      font-size: 13px;
      color: var(--g-text);
      font-weight: 700;
    }

    span {
      grid-column: 1;
      grid-row: 1;
      font-family: var(--g-font-mono);
      font-size: 13px;
      color: var(--g-text-3);
      font-weight: 600;
    }
  }

  .timeline-item.is-now .timeline-head b,
  .timeline-item.is-now .timeline-head span {
    color: var(--g-focus);
  }

  .timeline-note {
    grid-column: 2;
    font-size: 12px;
    color: var(--g-text-3);
    line-height: 1.5;
  }

  .calc-body {
    padding: 0 12px 16px;
  }

  .calc-section {
    margin-bottom: 14px;
  }

  .calc-base-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .calc-base-label {
    margin-bottom: 6px;
    font-size: 11px;
    color: var(--g-text-3);
    font-weight: 700;
  }

  .calc-title {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--g-text-2);
  }

  .calc-empty {
    border: 1px dashed var(--g-line);
    border-radius: var(--g-radius-sm);
    color: var(--g-text-4);
    font-size: 12px;
    padding: 10px;
    text-align: center;
  }

  .calc-version-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .calc-version-edit-row {
    margin-top: 8px;
    display: flex;
    gap: 8px;
  }

  .calc-row {
    display: grid;
    grid-template-columns: 132px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;

    label {
      font-size: 12px;
      color: var(--g-text-3);
      font-weight: 600;
    }

    .unit {
      font-size: 12px;
      color: var(--g-text-4);
      text-align: right;
    }
  }

  .calc-result-section {
    display: grid;
    gap: 10px;
  }

  .calc-result-group {
    border: 1px solid #dbece2;
    border-radius: var(--g-radius-sm);
    background: #f3fcf6;
    padding: 10px;
  }

  .calc-result-project {
    border-color: #bfdbfe;
    background: #eff6ff;
  }

  .calc-result-title {
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
    color: #334155;
  }

  .calc-result-grid {
    display: grid;
    gap: 8px;
  }

  .calc-result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: #3f5f50;

    b {
      color: #167546;
      font-size: 14px;
      font-family: var(--g-font-mono);
    }
  }
}

@media (max-width: 1200px) {
  .meeting-review-detail {
    .hero-left {
      width: 100%;
    }

    .decision-source-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .timeline-item {
      grid-template-columns: 1fr;
      gap: 4px;
    }

    .flow-meta-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .stage-opinion-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));

      &.stage-opinion-grid--dept {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    .node-review-item {
      grid-template-columns: 1fr;
    }

    .timeline-head b,
    .timeline-head span,
    .timeline-note {
      grid-column: auto;
      grid-row: auto;
    }
  }
}

@media (max-width: 768px) {
  .meeting-review-detail {
    .hero-header {
      padding: 12px 14px;
    }

    .hero-left {
      gap: 10px;
    }

    .hero-id {
      font-size: 18px;
    }

    .hero-id-meta {
      font-size: 12px;
    }

    .hero-actions {
      flex-shrink: 0;
    }

    .card-block {
      margin: 10px 14px 0;
    }

    .review-footer {
      margin: 10px 14px 0;
    }

    .process-review-head {
      flex-direction: column;
    }

    .flow-meta-grid {
      grid-template-columns: 1fr;
    }

    .stage-opinion-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));

      &.stage-opinion-grid--dept {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .review-entry-head {
      flex-direction: column;
      gap: 2px;
    }

    .flow-log-entry {
      grid-template-columns: 1fr;
      gap: 2px;
    }

    .toolbar-line {
      align-items: flex-start;
      flex-direction: column;
    }

    .toolbar-top {
      align-items: flex-start;
      flex-direction: column;
    }

    .toolbar-actions {
      margin-left: 0;
      width: 100%;
    }

    .toolbar-field {
      width: 100%;
      justify-content: space-between;
    }

    .toolbar-switches {
      margin-left: 0;
      width: 100%;
      justify-content: space-between;
    }

    .toolbar-mode-tip {
      margin-left: 0;
      width: 100%;
      text-align: center;
    }

    .fullscreen-quick-dock {
      position: fixed;
      right: 8px;
      left: 8px;
      bottom: 8px;
      top: auto;
      transform: none;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 8px;
    }

    .fullscreen-edge-entry {
      z-index: 3200;
      width: 48px;
      height: 48px;
    }

    :deep() .fullscreen-edge-entry .quick-entry-btn.el-button {
      width: 40px;
      height: 40px;
      writing-mode: horizontal-tb;
      border-radius: 50%;
      letter-spacing: 0;
    }

    :deep() .fullscreen-quick-dock .quick-btn.el-button {
      width: 100%;
    }

    .decision-source-actions {
      grid-template-columns: 1fr;
    }

    .review-footer {
      flex-direction: column;
      align-items: flex-start;
    }

    .calc-row {
      grid-template-columns: 1fr;

      .unit {
        text-align: left;
      }
    }
  }
}
</style>

<style lang="scss">
body.meeting-review-fullscreen-lock {
  overflow: hidden !important;
}

.meeting-review-detail:fullscreen,
.meeting-review-detail:-webkit-full-screen {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #fff;
}

.meeting-review-detail.is-table-fullscreen .el-drawer__wrapper {
  z-index: 3300 !important;
}

.module-inline-state {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  color: #2f6fb3;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

.module-inline-retry {
  margin-left: 8px;
  border: 1px solid #f3c7c7;
  border-radius: 4px;
  background: #fff7f7;
  color: #9f2d2d;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  padding: 0 6px;
  cursor: pointer;
}

.meeting-review-control-drawer {
  z-index: 3100 !important;
  background: #fafaf9;
  color: #0c0a09;
  --ctl-line: #e6e9ee;
  --ctl-line-strong: #d8dde6;
  --ctl-accent: #0071e3;
  --ctl-accent-text: #005bb5;
  --ctl-accent-bg: #eff6ff;

  .el-drawer__header {
    margin-bottom: 0;
    padding: 14px 16px 13px;
    border-bottom: 1px solid var(--ctl-line);
    background: #fff;
    color: #0c0a09;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .el-drawer__body {
    padding: 0;
    background: #f8f8f7;
  }

  .control-drawer-body {
    padding: 12px 12px 10px;
  }

  .control-drawer-head {
    border: 1px solid #005bb5;
    border-radius: 6px;
    background: linear-gradient(180deg, #0071e3, #005bb5);
    padding: 10px 11px;
    margin-bottom: 10px;
    box-shadow: 0 4px 14px rgba(0, 113, 227, 0.22);
  }

  .control-drawer-title {
    font-size: 13px;
    color: #fff;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .control-section {
    border: 1px solid var(--ctl-line);
    border-radius: 6px;
    background: #fff;
    padding: 10px 11px;
    margin-bottom: 8px;
    box-shadow: 0 1px 2px rgba(12, 10, 9, 0.03);
  }

  .control-section-title {
    margin-bottom: 7px;
    font-size: 11px;
    color: #78716c;
    text-transform: uppercase;
    letter-spacing: 0.9px;
    font-weight: 700;
  }

  .control-form-row {
    display: grid;
    grid-template-columns: 76px 1fr;
    align-items: center;
    gap: 10px;
    margin-bottom: 7px;
    min-height: 30px;
  }

  .control-form-row:last-child {
    margin-bottom: 0;
  }

  .control-form-row > span {
    font-size: 11px;
    color: #44403c;
    font-weight: 600;
  }

  .history-valve-picker {
    display: grid;
    gap: 10px;
  }

  .history-valve-project {
    min-height: 30px;
    padding: 7px 9px;
    border: 1px solid var(--g-line);
    border-radius: var(--g-radius-sm);
    background: var(--g-bg);
    color: var(--g-text-2);
    font-size: 12px;
    font-weight: 600;
  }

  .control-switch-row {
    display: grid;
    gap: 6px;
    margin-top: 4px;
  }

  .control-switch-chip {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--ctl-line);
    background: #fff;
    transition:
      border-color 180ms cubic-bezier(0.4, 0, 0.2, 1),
      background-color 180ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .control-switch-chip.active {
    border-color: var(--ctl-accent);
    background: var(--ctl-accent-bg);
  }

  .control-switch-row .el-switch {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    min-height: 20px;
    gap: 8px;
  }

  .control-switch-row .el-switch__label {
    color: #78716c;
    font-size: 11px !important;
    font-weight: 600;
    line-height: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    padding: 0;
    border-radius: 8px;
  }

  .control-switch-row .el-switch__label span {
    font-size: 11px !important;
    line-height: 18px !important;
  }

  .control-switch-row .el-switch__label.is-active {
    color: var(--ctl-accent-text);
    background: transparent;
  }

  .control-switch-row .el-switch__core {
    width: 34px !important;
    height: 20px;
    border-color: var(--ctl-line);
    background: #ffffff;
  }

  .control-switch-row .el-switch.is-checked .el-switch__core {
    border-color: var(--ctl-accent);
    background: #f9fafb;
  }

  .control-switch-row .el-switch__core:after {
    width: 14px;
    height: 14px;
    top: 2px;
    background-color: #9ca3af;
  }

  .control-switch-row .el-switch.is-checked .el-switch__core:after {
    background-color: var(--ctl-accent-text);
  }

  .control-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
    padding-top: 2px;
  }

  .control-footer .el-button:not(.el-button--primary) {
    border-color: var(--ctl-line-strong);
    color: #44403c;
    background: #fff;
  }

  .control-footer .el-button:not(.el-button--primary):hover,
  .control-footer .el-button:not(.el-button--primary):focus {
    border-color: #0071e3;
    color: #0071e3;
    background: rgba(0, 113, 227, 0.08);
  }

  .control-footer .el-button--primary,
  .control-footer .tool-primary-btn.el-button--primary {
    border-color: #0071e3;
    background: #0071e3;
    color: #fff;
  }

  .control-footer .el-button--primary:hover,
  .control-footer .el-button--primary:focus,
  .control-footer .tool-primary-btn.el-button--primary:hover,
  .control-footer .tool-primary-btn.el-button--primary:focus {
    border-color: #005bb5;
    background: #005bb5;
    color: #fff;
  }

  .el-input__inner {
    border-color: var(--ctl-line-strong);
    border-radius: 4px;
  }

  .el-input__inner:focus {
    border-color: #0071e3;
    box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.12);
  }

  .el-radio-button__inner {
    border-color: var(--ctl-line);
    color: #78716c;
    font-size: 11px;
    font-weight: 600;
    height: 30px;
    line-height: 28px;
    padding: 0 12px;
    background: #fff;
  }

  .el-radio-button__orig-radio:checked + .el-radio-button__inner {
    border-color: var(--ctl-accent);
    color: var(--ctl-accent-text);
    background: var(--ctl-accent-bg);
    box-shadow: none;
  }
}
</style>
