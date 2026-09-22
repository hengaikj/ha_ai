<template>
  <section
    ref="rootRef"
    v-loading.fullscreen.lock="pageBlocking"
    class="revenue-audit-workbench-detail rev-impact-theme rv-card rv-list-card"
    :class="rootClass"
    :element-loading-text="pageBlockingText"
  >
    <workbench-header
      :title="pageTitle"
      :subtitle="projectTitle"
      :info-items="headerInfoItems"
    >
      <template #actions>
        <el-tooltip
          v-if="actionMode === 'close'"
          content="关闭"
          placement="bottom"
        >
          <el-button
            class="detail-close-btn"
            size="mini"
            :icon="Close"
            circle
            aria-label="关闭"
            @click="closePage"
          />
        </el-tooltip>
        <el-button v-else size="small" @click="goBack">返回项目列表</el-button>
        <el-button
          v-if="showMeetingStartAction"
          size="small"
          type="primary"
          :loading="meetingStartSubmitting"
          :disabled="!canStartMeeting"
          @click="onStartMeeting"
        >
          开始上会
        </el-button>
        <el-tooltip
          v-if="showMainFinalSubmitAction"
          :content="mainSubmitOverviewGuardHint"
          :disabled="!showMainSubmitOverviewGuardHint"
          placement="bottom"
        >
          <span
            class="submit-disabled-tooltip"
            :tabindex="showMainSubmitOverviewGuardHint ? 0 : -1"
          >
            <el-button
              size="small"
              type="success"
              :loading="mainFinalSubmitting"
              :disabled="!canSubmitMainFinal"
              @click="onSubmitMainAuditFinal"
            >
              提交主表审核
            </el-button>
          </span>
        </el-tooltip>
        <el-button
          v-if="showStageFinalSubmitAction"
          size="small"
          type="success"
          :loading="stageFinalSubmitting"
          :disabled="!canSubmitStageFinal"
          @click="onSubmitS2StageFinal"
        >
          生成主表并流转到 S3 业务经理二次确认
        </el-button>
      </template>
    </workbench-header>

    <div
      v-if="showS2ModeSwitch"
      class="toolbar-line workbench-toolbar s2-mode-toolbar"
    >
      <div class="toolbar-group">
        <span class="label">模式</span>
        <stage-mode-switch
          :value="s2DetailMode === 'review' ? 'edit' : 'view_submit'"
          edit-label="审核模式"
          submit-label="查看提交模式"
          :visible="true"
          size="mini"
          @value-update="switchS2UnifiedMode"
        />
      </div>
    </div>

    <div
      v-if="showS5ModeSwitch"
      class="toolbar-line workbench-toolbar s5-mode-toolbar"
    >
      <div class="toolbar-group">
        <span class="label">模式</span>
        <stage-mode-switch
          :value="s5UnifiedMode"
          edit-label="主表选择"
          submit-label="二人确认"
          :visible="true"
          size="mini"
          @value-update="switchS5UnifiedMode"
        />
      </div>
    </div>

    <div v-if="!usesModuleViewMode" class="toolbar-line workbench-toolbar">
      <div v-if="usesMainViewMode" class="toolbar-group">
        <span class="label">视图</span>
        <el-radio-group v-model="mainViewMode" size="small">
          <el-radio-button value="overview">总览</el-radio-button>
          <el-radio-button value="year">按年份</el-radio-button>
          <el-radio-button value="trim">按版型</el-radio-button>
        </el-radio-group>
      </div>

      <div
        v-if="
          !usesModuleViewMode && (!usesMainViewMode || mainViewMode === 'year')
        "
        class="toolbar-group"
      >
        <span class="label">年份</span>
        <el-select v-model="activeYearKey" size="small" style="width: 160px">
          <el-option
            v-for="option in displayYearOptions"
            :key="`year_${option.key}`"
            :label="option.label"
            :value="option.key"
          />
        </el-select>
      </div>

      <div
        v-if="usesMainViewMode && mainViewMode === 'trim'"
        class="toolbar-group"
      >
        <span class="label">版型</span>
        <el-select v-model="activeTrimId" size="small" style="width: 180px">
          <el-option
            v-for="trim in trimOptions"
            :key="`main_trim_${trim.trimId}`"
            :label="trim.trimName"
            :value="trim.trimId"
          />
        </el-select>
      </div>
    </div>

    <div
      v-if="isMeetingNoticeStage"
      v-loading="meetingInfoLoading"
      class="meeting-notice-card"
    >
      <div class="meeting-notice-head">
        <div>
          <div class="meeting-notice-title">上会信息</div>
          <div class="meeting-notice-sub">项目上会时间与冻结截止时间。</div>
        </div>
        <el-tag
          :type="meetingNoticeForm.published ? 'success' : 'info'"
          size="small"
        >
          {{ meetingNoticeStatusText }}
        </el-tag>
      </div>

      <div v-if="meetingNoticeForm.published" class="meeting-notice-summary">
        <div class="meeting-summary-item">
          <span>上会时间</span>
          <b>{{ meetingNoticeForm.meetingTime || "-" }}</b>
        </div>
        <div class="meeting-summary-item">
          <span>截止冻结时间</span>
          <b>{{ meetingNoticeForm.freezeTime || "-" }}</b>
        </div>
        <div class="meeting-summary-item">
          <span>当前节点</span>
          <b>{{ meetingNoticeForm.nodeText || "-" }}</b>
        </div>
        <div class="meeting-summary-item">
          <span>更新信息</span>
          <b
            >{{ meetingNoticeForm.publishedBy || "-" }} /
            {{ meetingNoticeForm.publishedAt || "-" }}</b
          >
        </div>
      </div>
      <div v-else class="meeting-notice-empty">暂无上会信息</div>
    </div>

    <!-- S2：8 个子表审核提交进度卡片（与 moduleSubmitMap / 完成清单同源） -->
    <div v-if="showS2ModuleProgressCards" class="s2-module-progress-card">
      <div class="s2-module-progress-head">
        <span>S2 子表审核提交进度</span>
        <b :class="{ 'is-ok': s2ModuleProgressAllDone }">
          {{ s2ModuleProgressDoneCount }}/{{ s2ModuleProgressCards.length }} 已提交
        </b>
      </div>
      <div class="s2-module-progress-grid">
        <div
          v-for="card in s2ModuleProgressCards"
          :key="`s2_progress_${card.code}`"
          class="s2-module-progress-item"
          :class="{ 'is-submitted': card.submitted }"
          role="button"
          tabindex="0"
          :title="card.cardTooltip"
          @click="scrollToModuleHeader(card.scrollTarget)"
          @keyup.enter="scrollToModuleHeader(card.scrollTarget)"
        >
          <div class="s2-module-progress-item-head">
            <span class="s2-module-progress-index">{{ card.index }}</span>
            <b class="s2-module-progress-label">{{ displayUiText(card.label) }}</b>
          </div>
          <div class="s2-module-progress-status" :class="{ 'is-submitted': card.submitted }">
            {{ card.statusText }}
          </div>
          <div v-if="card.submitted" class="s2-module-progress-meta">
            <div v-if="card.submittedBy">{{ displayUiText(card.submittedBy) }}</div>
            <div v-if="card.submittedAt">{{ card.submittedAt }}</div>
          </div>
          <div v-else class="s2-module-progress-empty">尚未审核提交</div>
        </div>
      </div>
    </div>

    <div v-if="showStageFinalSubmitAction" class="stage-final-card">
      <div class="stage-final-head">
        <span>S2 集团部室审核阶段完成清单</span>
        <b :class="{ 'is-ok': canSubmitStageFinal }">{{
          stageCompletionStatusText
        }}</b>
      </div>
      <el-table :data="stageCompletionRows" border size="mini">
        <el-table-column label="根科目模块" min-width="200">
          <template #default="scope">
            <button
              type="button"
              class="module-scroll-link"
              @click="scrollToModuleHeader(scope.row)"
            >
              {{ displayUiText(scope.row.name) }}
            </button>
          </template>
        </el-table-column>
        <el-table-column label="完成进度" min-width="140">
          <template #default="scope"
            >{{ scope.row.done }}/{{ scope.row.total }}</template
          >
        </el-table-column>
        <el-table-column prop="status" label="状态" min-width="120" />
        <el-table-column label="异常项" min-width="260">
          <template #default="scope">{{
            formatStageCompletionIssues(scope.row)
          }}</template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="showMainSelectionCard" class="main-selection-card">
      <div class="main-selection-head">
        <span>{{ mainSelectionTitle }}</span>
        <b>{{ mainSelectionModeText }}</b>
      </div>
      <el-radio-group
        v-model="selectedMainSourceStage"
        size="small"
        @change="onMainSelectionChange"
      >
        <el-radio-button
          v-for="item in mainSelectionOptions"
          :key="item.value"
          :label="item.value"
          :disabled="isS5MainSelectionLocked"
        >
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>
      <el-tooltip
        v-if="showMainSelectionSubmitAction"
        :content="mainSubmitOverviewGuardHint"
        :disabled="!showMainSelectionOverviewGuardHint"
        placement="top"
      >
        <span
          class="submit-disabled-tooltip"
          :tabindex="showMainSelectionOverviewGuardHint ? 0 : -1"
        >
          <el-button
            size="small"
            type="success"
            :loading="mainFinalSubmitting"
            :disabled="!canSubmitMainSelection"
            @click="onSubmitMainSelectionFinal"
          >
            提交所选主表值
          </el-button>
        </span>
      </el-tooltip>
    </div>

    <div v-if="isS5DecisionApprovalStage" class="s5-decision-card">
      <div class="s5-decision-head">
        <div>
          <div class="s5-decision-title">S5 决策评审</div>
          <div class="s5-decision-sub">{{ s5DecisionApprovalSourceText }}</div>
        </div>
        <el-tag :type="s5DecisionApprovalTagType" size="small">
          {{ s5DecisionApprovalTagText }}
        </el-tag>
      </div>
      <div class="s5-decision-actions">
        <span class="s5-decision-tip">{{ s5DecisionApprovalHint }}</span>
        <el-button
          size="small"
          type="success"
          :loading="decisionApprovalSubmitting"
          :disabled="!canSubmitS5DecisionApproval"
          @click="onSubmitS5DecisionApproval"
        >
          通过并流转到 S6
        </el-button>
      </div>
    </div>

    <div v-if="visibleModules.length" class="module-section-list">
      <section
        v-for="module in visibleModules"
        :key="resolveModuleKey(module)"
        class="module-section"
        :data-module-scroll-key="moduleScrollKey(module)"
      >
        <div class="module-section-head">
          <div>
            <div class="module-title-row">
              <div class="module-title">{{ displayUiText(module.name) }}</div>
              <span
                v-if="resolveModuleTitleNotice(module)"
                class="module-title-warning"
              >
                {{ resolveModuleTitleNotice(module) }}
              </span>
            </div>
          </div>
          <div
            class="module-state"
            :class="{
              'is-submitted': !isMainDomain && isModuleSubmitted(module),
              'is-readonly':
                isMeetingNoticeStage ||
                isMainReadonlyPreviewStage ||
                isReadonlySubtableMainPreviewModule(module) ||
                isReadonlyMainDomainReferenceModule(module),
            }"
          >
            {{ resolveModuleStateText(module) }}
          </div>
        </div>

        <div v-if="isModuleLoading(module)" class="module-load-status">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>{{ moduleLoadingText(module) }}</span>
        </div>

        <div v-if="isModuleLoadError(module)" class="module-load-error">
          <span>{{ moduleLoadErrorText(module) }}</span>
          <el-button
            size="mini"
            type="primary"
            plain
            @click.stop.prevent="retryLoadModule(module)"
          >
            重试
          </el-button>
        </div>

        <div
          v-if="usesModuleViewMode && !isYearOnlyModule(module)"
          class="toolbar-line module-view-toolbar"
        >
          <div class="toolbar-group">
            <span class="label">视图</span>
            <el-radio-group
              :model-value="getModuleViewMode(module)"
              size="small"
              @update:model-value="(val: string) => setModuleViewMode(module, val)"
            >
              <el-radio-button value="overview">总览</el-radio-button>
              <el-radio-button value="year">按年份</el-radio-button>
              <el-radio-button value="trim">按版型</el-radio-button>
            </el-radio-group>
          </div>
          <div
            v-if="getModuleViewMode(module) === 'year'"
            class="toolbar-group"
          >
            <span class="label">年份</span>
            <el-select
              :model-value="getModuleActiveYearKey(module)"
              size="small"
              style="width: 160px"
              @update:model-value="(val: string) => setModuleActiveYearKey(module, val)"
            >
              <el-option
                v-for="option in displayYearOptions"
                :key="`module_year_${resolveModuleKey(module)}_${option.key}`"
                :label="option.label"
                :value="option.key"
              />
            </el-select>
          </div>
          <div
            v-if="getModuleViewMode(module) === 'trim'"
            class="toolbar-group"
          >
            <span class="label">版型</span>
            <el-select
              :model-value="getModuleActiveTrimId(module)"
              size="small"
              style="width: 180px"
              @update:model-value="(val: string) => setModuleActiveTrimId(module, val)"
            >
              <el-option
                v-for="trim in trimOptions"
                :key="`module_trim_${resolveModuleKey(module)}_${trim.trimId}`"
                :label="trim.trimName"
                :value="trim.trimId"
              />
            </el-select>
          </div>
        </div>

        <subject-audit-matrix
          :key="`${matrixRenderKey}_${resolveModuleKey(module)}_${moduleViewRenderKey(module)}`"
          embedded
          :rows="module.rows"
          :columns="resolveMatrixColumns(module)"
          :empty-text="emptyText"
          :show-unit-column="showMatrixUnitColumn"
          :parent-subject-display="parentSubjectDisplayMap"
          :can-edit-cell="canEditCell"
          :cell-text="resolveCellText"
          :cell-type="resolveCellType"
          :cell-class="resolveCellHighlightClass"
          :unit-text="resolveUnitText"
          :cell-record="resolveCellRecord"
          :cell-history="resolveCellHistory"
          :cell-popover-title="resolveCellPopoverTitle"
          :cell-popover-sub-text="cellPopoverSubText"
          @cell-confirm="onMatrixCellConfirm"
          @cell-click="onMatrixCellClick"
        />

        <module-opinion-card
          v-if="shouldShowModuleOpinionCard(module)"
          :title="resolveModuleOpinionTitle(module)"
          :prior-opinions="resolvePriorOpinionsForModule(module)"
          :value="resolveModuleOpinion(module)"
          :disabled="!canEditModuleOpinion(module)"
          :submit-disabled="!canSubmitModule(module) || isSubmitBlocking"
          :submit-loading="isModuleSubmitting(module)"
          :submit-hint="
            !isSubmitBlocking && !isMainDomain && !canSubmitModule(module)
              ? resolveSubmitHint(module)
              : ''
          "
          :placeholder="moduleOpinionPlaceholder"
          :show-editor="shouldShowModuleOpinionEditor(module)"
          :show-save="shouldShowModuleOpinionSave(module)"
          :show-submit="
            !isMainDomain &&
            (!isModuleSubmitted(module) || isModuleReediting(module))
          "
          :show-reedit="
            !isMainDomain &&
            isModuleSubmitted(module) &&
            !isModuleReediting(module)
          "
          :reedit-disabled="isSubmitBlocking"
          save-text="保存审核意见"
          :submit-text="resolveModuleSubmitText(module)"
          :handle-submit="(text: string) => submitModule(module, text)"
          @value-update="setModuleOpinion(module, $event)"
          @blur="saveModuleOpinion(module)"
          @save="saveModuleOpinion(module)"
          @reedit="enableModuleReedit(module)"
        />
      </section>
    </div>
    <div v-else class="empty-module-state">{{ emptyStateText }}</div>

    <audit-timeline-card :items="mergedTimeline" />
    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :loading="confirmState.loading"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Close, Loading } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { listMeetings } from "@/api/system/expenses";
import {
  buildStageCompletionSummary,
  fetchMainTableDecisionApprovalDetail,
  fetchMainTableVersionSelectionDetail,
  fetchRevenueAuditModuleRecords,
  fetchRevenueAuditShell,
  buildModulePriorOpinionCards,
  loadFlowOpinionTimelineEntry,
  listSubtableAuditAuxiliaryState,
  listSubtableAuditCellDrafts,
  listSubtableAuditCellHistories,
  listSubtableAuditModuleSubmitTimeline,
  refreshSubtableMainPreview,
  saveSubtableAuditCellDraft,
  saveSubtableAuditModuleOpinion,
  submitMainTableAuditFinal,
  submitMainTableVersionSelectionFinal,
  submitS5DecisionApproval,
  submitS7StartMeeting,
  submitS2StageFinal,
  submitSubtableAuditModule,
  resolveSubtableFormulaSourceDetail,
} from "@/pages/revenue/subtable-workbench/service";
import {
  AUDIT_ACCESS,
  AUDIT_DOMAIN,
  AUDIT_ROW_SCOPE,
  isReviewableAuditValueSource,
  normalizeStageCode,
} from "@/pages/revenue/subtable-workbench/domain-config";
import {
  hasFlowStageActionPermission,
  hasRevenuePermission,
  resolveFlowStageActionPermission,
} from "@/pages/revenue/permissions";
import WorkbenchHeader from "@/pages/revenue/subtable-workbench/components/WorkbenchHeader.vue";
import StageModeSwitch from "@/pages/revenue/subtable-workbench/components/StageModeSwitch.vue";
import SubjectAuditMatrix from "@/pages/revenue/subtable-workbench/components/SubjectAuditMatrix.vue";
import ModuleOpinionCard from "@/pages/revenue/subtable-workbench/components/ModuleOpinionCard.vue";
import AuditTimelineCard from "@/pages/revenue/subtable-workbench/components/AuditTimelineCard.vue";
import {
  RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY,
  RND_INVESTMENT_TAX_INCLUDED_CELL_KEY,
  REVENUE_FORMULA_CALCULATION_MODE,
  applyRevenueFormulasToDetail,
  buildRndInvestmentAmountColumns,
  isRndAmountCellKey,
  isRndDirectYearInputRow,
  isRndDoubleAmountSourceRow,
} from "@/pages/revenue/subtable-workbench/formula-engine";
import { isColumnRequiredByInputScope } from "@/pages/revenue/subtable-workbench/services/detail-matrix";
import {
  REVENUE_MODULE_CODE,
  REVENUE_MODULE_NAME_ALIASES,
  isRevenueYearOnlyRow,
  resolveRevenueModuleTitleNotice,
} from "@/pages/revenue/subtable-workbench/domain-config";
import {
  buildLifecycleColumn,
  buildLifecycleSubtotalColumn,
  buildLifecycleTrimColumns,
  buildDisplayYearOptions,
  buildRevenueModuleSections,
  buildYearSubtotalColumn,
  getRowCellValue,
  isDisplayAggregateColumn,
  isMainMarginContributionRow,
  isSavableMatrixCell,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import {
  formatPeriodExpenseDisplayText,
  formatRevenueStageDisplayText,
} from "@/utils/displayText";
import { validateEditableValue } from "@/pages/revenue/subtable-workbench/value-normalizer";
import { useAuthStore } from "@/stores/auth";
import type {
  MatrixColumn,
  MatrixRow,
  ModuleLoadPlan,
  ModuleLoadState,
  ModuleSection,
  RevenueDimensions,
  SubjectTreeNode,
} from "@/types/revenue";
import type { FormulaRow } from "@/pages/revenue/subtable-workbench/domain-config";

interface WorkbenchConfig extends Record<string, unknown> {
  subjectDomain: string;
  defaultStage: string;
  defaultPermissionKey: string;
  rootClass: string;
  actionMode: string;
  enableRecalculate: boolean;
}

const DEFAULT_CONFIG = Object.freeze<WorkbenchConfig>({
  subjectDomain: AUDIT_DOMAIN.SUBTABLE,
  defaultStage: "S2",
  defaultPermissionKey: "",
  rootClass: "",
  actionMode: "back",
  enableRecalculate: false,
});

// 纯工具函数（提取自 methods，用于在 forEach/map 回调中去除 this.）
function displayUiText(value: unknown) {
  return formatPeriodExpenseDisplayText(value);
}

function resolveModuleKey(module: Record<string, unknown> = {}) {
  return String(
    module.rootSubjectId ||
      module.moduleKey ||
      module.key ||
      module.moduleName ||
      module.name ||
      "",
  ).trim();
}

function normalizeModuleScrollKey(value: unknown) {
  return String(value == null ? "" : value)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5:-]+/g, "_")
    .toLowerCase();
}

function normalizeLocalId(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeHistoryValueForCompare(value: unknown) {
  const text = String(value == null ? "" : value).trim();
  if (!text || text === "-" || text === "—") return "";
  const compact = text.replace(/,/g, "").replace(/\s+/g, "");
  const isPercent = compact.endsWith("%");
  const numericText = isPercent ? compact.slice(0, -1) : compact;
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(numericText)) {
    const numericValue = Number(numericText);
    if (Number.isFinite(numericValue)) {
      return `${isPercent ? "percent" : "number"}:${numericValue}`;
    }
  }
  return `text:${compact}`;
}

function normalizeLocalText(value: unknown) {
  return String(value == null ? "" : value).trim();
}

function normalizeLocalIdList(value: unknown) {
  const source = Array.isArray(value) ? value : [value];
  return source
    .reduce((result: unknown[], item: unknown) => {
      if (Array.isArray(item)) {
        result.push(...item);
        return result;
      }
      result.push(item);
      return result;
    }, [] as unknown[])
    .map((item: unknown) => normalizeLocalId(item))
    .filter(
      (item: unknown, index: number, list: unknown[]) =>
        item != null && list.indexOf(item) === index,
    );
}

const MAIN_SELECTION_SOURCE_OPTIONS = Object.freeze({
  S5: Object.freeze([
    { value: "S2", label: "S2 集团部室审核值" },
    { value: "S3", label: "S3 业务经理二次确认值" },
    { value: "S4", label: "S4 二级公司财务审核值" },
  ]),
  S7: Object.freeze([
    { value: "S6", label: "S6 集团财务审核值" },
    { value: "S5", label: "S5 二级公司最终提交值" },
    { value: "S2", label: "S2 集团部室审核值" },
  ]),
});

const FLOW_STAGE_MENU_STAGE_MAP = Object.freeze({
  flow_s2: "S2",
  flow_s4: "S4",
  flow_s5: "S5",
  flow_s6: "S6",
  flow_s7: "S7",
});
const MAIN_FLOW_PERMISSION_STAGES = Object.freeze(["S4", "S5", "S6", "S7"]);
const MAIN_AUDIT_FLOW_PERMISSION_STAGES = Object.freeze(["S4", "S6"]);
const FLOW_SUBMIT_ACTION_KEYS = Object.freeze([
  "stage_final_submit",
  "final_submit",
  "submit",
]);
const FLOW_REVIEW_ACTION_KEYS = Object.freeze(["review", "audit"]);
const FLOW_SELECT_MAIN_ACTION_KEYS = Object.freeze([
  "select_main",
  "select-main",
  "select_main_table",
  "select",
]);
const FLOW_APPROVE_ACTION_KEYS = Object.freeze([
  "approve",
  "decision",
  "decide",
]);

// S2 审核进度卡片固定 8 个子表（不含主表 / 汇总表 / 固定费用标准）
const S2_MODULE_PROGRESS_CODES = Object.freeze([
  REVENUE_MODULE_CODE.SALES_VOLUME,
  REVENUE_MODULE_CODE.PRODUCT_COMPETITIVENESS,
  REVENUE_MODULE_CODE.PROMOTION_BUSINESS,
  REVENUE_MODULE_CODE.MATERIAL_COST,
  REVENUE_MODULE_CODE.VARIABLE_MANUFACTURING_COST,
  REVENUE_MODULE_CODE.SALES_EXPENSE,
  REVENUE_MODULE_CODE.PERIOD_EXPENSE,
  REVENUE_MODULE_CODE.RND_EXPENSE,
]);

function safeText(value: unknown, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function isTruthyFlag(value: unknown) {
  if (value === true || value === 1) return true;
  const text = safeText(value).toLowerCase();
  return text === "1" || text === "true" || text === "yes" || text === "y";
}

function normalizeMeetingListRows(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  const root =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  if (root && Array.isArray(root.rows)) return root.rows;
  if (root && Array.isArray(root.list)) return root.list;
  if (root && Array.isArray(root.records)) return root.records;
  const data = root ? root.data : null;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>;
    if (Array.isArray(dataRecord.rows)) return dataRecord.rows;
    if (Array.isArray(dataRecord.list)) return dataRecord.list;
    if (Array.isArray(dataRecord.records)) return dataRecord.records;
  }
  return [];
}

function formatMeetingDateTimeMinute(value: unknown) {
  const text = safeText(value);
  if (!text) return "";
  const match = text.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2}))?/,
  );
  if (!match) return text;
  const [, year, month, day, hour, minute] = match;
  const dateText = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (!hour || !minute) return dateText;
  return `${dateText} ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function getMeetingSortTime(row: Record<string, unknown> = {}) {
  const raw = safeText(
    row.updatedAt ||
      row.updateTime ||
      row.createdAt ||
      row.createTime ||
      row.meetingTime ||
      row.meetingDate,
  );
  const time = Date.parse(raw.replace(/-/g, "/"));
  return Number.isFinite(time) ? time : 0;
}

function normalizeMeetingInfoRow(row: Record<string, unknown> = {}, index = 0) {
  const node = normalizeStageCode(
    safeText(row.node || row.stageCode || row.stage, "S7"),
  );
  const updatedAt = formatMeetingDateTimeMinute(
    row.updatedAt || row.updateTime || row.createdAt || row.createTime,
  );
  return {
    id:
      row.id != null
        ? row.id
        : row.meetingId != null
          ? row.meetingId
          : `meeting_${index + 1}`,
    flowId: safeText(row.flowId != null ? row.flowId : row.projectCostFlowId),
    projectId: safeText(row.projectId),
    projectCode: safeText(row.projectCode || row.projectNo),
    valvePoint: safeText(row.valvePoint || row.valve),
    node,
    nodeText: formatRevenueStageDisplayText(node),
    meetingTime: formatMeetingDateTimeMinute(
      row.meetingTime || row.meetingDate,
    ),
    freezeTime:
      formatMeetingDateTimeMinute(
        row.freezeTime || row.frozenTime || row.deadlineTime,
      ) || "-",
    published: true,
    publishedAt: updatedAt || "-",
    publishedBy: safeText(
      row.updatedByName ||
        row.updateByName ||
        row.creatorName ||
        row.createByName ||
        row.createBy,
      "-",
    ),
    sortTime: getMeetingSortTime(row),
  };
}

// ==================== Props ====================
const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },
  configuredSubjectDomain: {
    type: String,
    default: "",
  },
});

// ==================== Composables ====================
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { openConfirm, confirmState, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

// ==================== State ====================
const loading = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const project = reactive<{
  projectNo: string;
  projectName: string;
  gate: string;
  [key: string]: unknown;
}>({
  projectNo: "",
  projectName: "",
  gate: "",
});
const detail = reactive<{
  stageCode: string;
  stage: string;
  rows: MatrixRow[];
  timeline: unknown[];
  calcRound: number;
  [key: string]: unknown;
}>({
  stageCode: "",
  stage: "",
  rows: [] as MatrixRow[],
  timeline: [] as unknown[],
  calcRound: 1,
});
const dimensions = reactive<RevenueDimensions>({
  years: [] as string[],
  trims: [] as string[],
});
const currentUser = ref("");
const currentUserName = ref("");
const rowScope = ref("all");
const mainViewMode = ref("year");
const activeYearIndex = ref(0);
const activeYearKey = ref("");
const activeTrimId = ref("");
const visibleRowMap = reactive<Record<string, boolean>>({});
const editableRowMap = reactive<Record<string, boolean>>({});
const cellDrafts = reactive<Record<string, unknown>>({});
const cellHistories = reactive<Record<string, unknown>>({});
const moduleOpinionMap = reactive<Record<string, unknown>>({});
const moduleOpinionDraftMap = reactive<Record<string, string>>({});

/** Vue3 reactive 对象不能靠 Object.assign({}, {}) 清空，需删 key（对齐 Vue2 整表替换） */
function clearReactiveMap<T extends object>(map: T) {
  Object.keys(map || {}).forEach((key) => {
    delete (map as Record<string, unknown>)[key];
  });
}
function replaceReactiveMap<T extends object>(
  map: T,
  next: Partial<T> | Record<string, unknown> = {},
) {
  clearReactiveMap(map);
  Object.assign(map, next || {});
}
const moduleSubmitMap = reactive<Record<string, unknown>>({});
const moduleReeditMap = reactive<Record<string, boolean>>({});
const moduleViewStateMap = reactive<Record<string, unknown>>({});
const formulaSourceDetail = ref<Record<string, unknown> | null>(null);
const submitTimeline = ref<unknown[]>([]);
const flowOpinionItems = ref<unknown[]>([]);
const stageCompletionSummary = ref<Record<string, unknown> | null>(null);
const moduleLoadPlan = ref<ModuleLoadPlan[]>([]);
const moduleLoadStateMap = reactive<Record<string, ModuleLoadState>>({});
const moduleRecordMap = reactive<Record<string, unknown[]>>({});
const moduleSubjectTreePayload = ref<SubjectTreeNode[] | null>(null);
const modulePatternList = ref<unknown[]>([]);
const moduleBaseQuery = ref<Record<string, unknown> | null>(null);
const moduleLoadRunId = ref(0);
const moduleSubmittingKey = ref("");
const stageFinalSubmitting = ref(false);
const mainFinalSubmitting = ref(false);
const decisionApprovalSubmitting = ref(false);
const meetingStartSubmitting = ref(false);
const meetingInfoLoading = ref(false);
const meetingInfoRequestSeq = ref(0);
const meetingNoticeForm = reactive({
  meetingTime: "",
  freezeTime: "",
  nodeText: "",
  published: false,
  publishedAt: "",
  publishedBy: "",
});
const selectedMainSourceStage = ref("S4");
const pendingSaveOperations = ref<unknown[]>([]);
const pendingSaveCount = ref(0);
const loadPageRequestSeq = ref(0);
const lastLoadedRouteFullPath = ref("");

// ==================== Watch ====================
watch(
  () => route.fullPath,
  (next, prev) => {
    if (next && next !== prev) {
      reloadForRoute();
    }
  },
);

// ==================== Computed ====================
const workbenchConfig = computed(() => {
  return {
    ...DEFAULT_CONFIG,
    ...(props.config || {}),
  };
});
const rootClass = computed(() => {
  return workbenchConfig.value.rootClass || "";
});
const showMatrixUnitColumn = computed(() => {
  return workbenchConfig.value.showUnitColumn !== false;
});
const actionMode = computed(() => {
  return workbenchConfig.value.actionMode === "close" ? "close" : "back";
});
const _configuredSubjectDomain = computed(() => {
  return String(workbenchConfig.value.subjectDomain || AUDIT_DOMAIN.SUBTABLE)
    .trim()
    .toLowerCase();
});
const currentPermissions = computed(() => {
  return authStore.permissions || [];
});
const routeMenuKey = computed(() => {
  return String(route.query.menuKey || "").trim();
});
const routeActionKey = computed(() => {
  return String(route.query.action || "")
    .trim()
    .toLowerCase();
});
const flowPermissionStageCode = computed(() => {
  return (
    (FLOW_STAGE_MENU_STAGE_MAP as Record<string, string>)[routeMenuKey.value] ||
    ""
  );
});
const isS2FlowPermissionEntry = computed(() => {
  return (
    flowPermissionStageCode.value === "S2" &&
    normalizeStageCode(queryStage.value || "S2") === "S2"
  );
});
const isS2SubtableStage = computed(() => {
  return isSubtableDomain.value && currentStageCode.value === "S2";
});
const hasS2ReviewActionPermission = computed(() => {
  return isS2SubtableStage.value && hasStageActionPermission("review");
});
const hasS2SubmitActionPermission = computed(() => {
  return isS2SubtableStage.value && hasStageActionPermission("submit");
});
const isS2StageSubmitAction = computed(() => {
  return (
    isS2SubtableStage.value &&
    FLOW_SUBMIT_ACTION_KEYS.includes(routeActionKey.value) &&
    hasStageActionPermission("submit")
  );
});
const isS2ViewAction = computed(() => {
  return (
    isS2SubtableStage.value &&
    (routeActionKey.value === "view" || routeActionKey.value === "open_flow")
  );
});
const showS2ModeSwitch = computed(() => {
  return hasS2ReviewActionPermission.value && hasS2SubmitActionPermission.value;
});
const s2DetailMode = computed(() => {
  if (!isS2SubtableStage.value) return "";
  if (isS2StageSubmitAction.value) return "stage_submit";
  if (isS2ViewAction.value)
    return hasS2SubmitActionPermission.value ? "stage_submit" : "view";
  if (hasS2ReviewActionPermission.value) return "review";
  if (hasS2SubmitActionPermission.value) return "stage_submit";
  return hasStageActionPermission("view") ? "view" : "";
});
const isMainFlowPermissionEntry = computed(() => {
  const stage = flowPermissionStageCode.value;
  return (
    MAIN_FLOW_PERMISSION_STAGES.includes(stage) &&
    normalizeStageCode(queryStage.value || stage) === stage
  );
});
const isMainAuditFlowPermissionEntry = computed(() => {
  return (
    isMainFlowPermissionEntry.value &&
    MAIN_AUDIT_FLOW_PERMISSION_STAGES.includes(flowPermissionStageCode.value)
  );
});
const isS5FlowPermissionEntry = computed(() => {
  return (
    isMainFlowPermissionEntry.value && flowPermissionStageCode.value === "S5"
  );
});
const s5WorkbenchMode = computed(() => {
  const mode = String(workbenchConfig.value.s5Mode || route.query.s5Mode || "")
    .trim()
    .toLowerCase();
  if (
    ["select_main", "select-main", "main_selection", "main-selection"].includes(
      mode,
    )
  ) {
    return "select_main";
  }
  if (
    ["decision_approval", "decision-approval", "approve", "approval"].includes(
      mode,
    )
  ) {
    return "decision_approval";
  }
  return "";
});
const isS5MainSelectionPage = computed(() => {
  return (
    isMainValueSelectionStage.value && s5WorkbenchMode.value === "select_main"
  );
});
const isS5DecisionApprovalPage = computed(() => {
  return (
    isMainValueSelectionStage.value &&
    s5WorkbenchMode.value === "decision_approval"
  );
});
const showS5ModeSwitch = computed(() => {
  return (
    isS5FlowPermissionEntry.value &&
    currentStageCode.value === "S5" &&
    hasStageActionPermission("select_main") &&
    hasStageActionPermission("approve")
  );
});
const s5UnifiedMode = computed(() => {
  if (
    s5WorkbenchMode.value === "decision_approval" ||
    (!s5WorkbenchMode.value && isS5DecisionApprovalStage.value)
  ) {
    return "view_submit";
  }
  return "edit";
});
const _isFlowPermissionEntry = computed(() => {
  return isS2FlowPermissionEntry.value || isMainFlowPermissionEntry.value;
});
const isMainFlowReviewAction = computed(() => {
  return (
    isMainAuditFlowPermissionEntry.value &&
    FLOW_REVIEW_ACTION_KEYS.includes(routeActionKey.value) &&
    hasFlowStageActionPermission(
      currentPermissions.value,
      flowPermissionStageCode.value,
      "review",
    )
  );
});
const isMainFlowSubmitAction = computed(() => {
  if (!isMainAuditFlowPermissionEntry.value) return false;
  const action = routeActionKey.value;
  const stage = flowPermissionStageCode.value;
  if (stage === "S4" || stage === "S6") {
    return (
      (FLOW_SUBMIT_ACTION_KEYS.includes(action) ||
        FLOW_REVIEW_ACTION_KEYS.includes(action)) &&
      hasFlowStageActionPermission(currentPermissions.value, stage, "review")
    );
  }
  return (
    FLOW_SUBMIT_ACTION_KEYS.includes(action) &&
    hasFlowStageActionPermission(currentPermissions.value, stage, "submit")
  );
});
const isS5SelectMainAction = computed(() => {
  return (
    isS5FlowPermissionEntry.value &&
    FLOW_SELECT_MAIN_ACTION_KEYS.includes(routeActionKey.value) &&
    hasFlowStageActionPermission(
      currentPermissions.value,
      flowPermissionStageCode.value,
      "select_main",
    )
  );
});
const isS5ApproveAction = computed(() => {
  return (
    isS5FlowPermissionEntry.value &&
    FLOW_APPROVE_ACTION_KEYS.includes(routeActionKey.value) &&
    hasFlowStageActionPermission(
      currentPermissions.value,
      flowPermissionStageCode.value,
      "approve",
    )
  );
});
const canViewMainFlowPermissionEntry = computed(() => {
  if (!isMainFlowPermissionEntry.value) return false;
  const action = routeActionKey.value || "view";
  if (action === "view" || action === "open_flow") {
    return hasFlowStageActionPermission(
      currentPermissions.value,
      flowPermissionStageCode.value,
      "view",
    );
  }
  if (FLOW_REVIEW_ACTION_KEYS.includes(action))
    return isMainFlowReviewAction.value;
  if (FLOW_SUBMIT_ACTION_KEYS.includes(action))
    return isMainFlowSubmitAction.value;
  if (FLOW_SELECT_MAIN_ACTION_KEYS.includes(action))
    return isS5SelectMainAction.value;
  if (FLOW_APPROVE_ACTION_KEYS.includes(action)) return isS5ApproveAction.value;
  return false;
});
const queryPermissionKey = computed(() => {
  const routePermission = String(
    route.query.permissionKey || route.query.permission || "",
  ).trim();
  if (routePermission) return routePermission;
  const stage =
    flowPermissionStageCode.value || currentStageCode.value || queryStage.value;
  const action = routeActionKey.value || "view";
  return (
    resolveFlowStageActionPermission(stage, action) ||
    workbenchConfig.value.defaultPermissionKey ||
    ""
  );
});
const hasAllPermission = computed(() => {
  return hasRevenuePermission(currentPermissions.value, "*:*:*");
});
const queryUserId = computed(() => {
  return String(
    route.query.user || route.query.userId || authStore.currentUser?.id || "",
  ).trim();
});
const queryUserName = computed(() => {
  return String(
    route.query.userName ||
      route.query.nickName ||
      authStore.currentUser?.displayName ||
      authStore.currentUser?.username ||
      "",
  ).trim();
});
const queryProjectCode = computed(() => {
  return String(route.query.projectCode || route.query.projectNo || "").trim();
});
const queryProjectName = computed(() => {
  return String(route.query.projectName || "").trim();
});
const queryProjectId = computed(() => {
  return String(route.query.projectId || "").trim();
});
const queryFlowId = computed(() => {
  return String(route.query.flowId || "").trim();
});
const queryStage = computed(() => {
  return String(
    route.query.stage || workbenchConfig.value.defaultStage || "S2",
  );
});
const querySelectedSourceStage = computed(() => {
  return String(
    route.query.selectedSourceStage || route.query.sourceStage || "",
  ).trim();
});
const _isReadonlyStageTrace = computed(() => {
  return String(route.query.readonlyStage || "").trim() === "1";
});
const queryValve = computed(() => {
  return String(route.query.valvePoint || route.query.valve || "G6");
});
const querySubjectDomain = computed(() => {
  return String(route.query.subjectDomain || props.configuredSubjectDomain)
    .trim()
    .toLowerCase();
});
const queryReadonlyAuthorizedScope = computed(() => {
  return isTruthyFlag(route.query.readonlyAuthorizedScope);
});
const queryIsSuperAdmin = computed(() => {
  // 1) authStore 角色判断（超级管理员角色）
  // 2) URL query 中显式标记（从列表跳转时带入）
  // 3) 权限中包含 *:*:*
  return Boolean(
    authStore.isSuperAdmin ||
      isTruthyFlag(route.query.isSuperAdmin) ||
      isTruthyFlag(route.query.superAdmin) ||
      isTruthyFlag(route.query.isAdmin) ||
      hasAllPermission.value
  );
});
const auditDomain = computed(() => {
  return querySubjectDomain.value === AUDIT_DOMAIN.MAIN_TABLE
    ? AUDIT_DOMAIN.MAIN_TABLE
    : AUDIT_DOMAIN.SUBTABLE;
});
const isSubtableDomain = computed(() => {
  return auditDomain.value === AUDIT_DOMAIN.SUBTABLE;
});
const isMainDomain = computed(() => {
  return auditDomain.value === AUDIT_DOMAIN.MAIN_TABLE;
});
const usesModuleViewMode = computed(() => {
  return isSubtableDomain.value && currentStageCode.value === "S2";
});
const usesMainViewMode = computed(() => {
  return (
    isMainDomain.value &&
    ["S2", "S4", "S5", "S6"].includes(currentStageCode.value)
  );
});
const currentStageCode = computed(() => {
  const routeStage = String(route.query.stage || "").trim();
  if (routeStage) return normalizeStageCode(routeStage);
  return normalizeStageCode(detail.stageCode || queryStage.value || "");
});
const isBrandFinancePreviewStage = computed(() => {
  return false;
});
const _isBrandFinanceMainReviewStage = computed(() => {
  return (
    isMainDomain.value &&
    currentStageCode.value === "S4" &&
    hasStageActionPermission("review")
  );
});
const isMainReadonlyPreviewStage = computed(() => {
  return isMainDomain.value && currentStageCode.value === "S2";
});
const shouldHideGroupDeptMainPreview = computed(() => {
  return false;
});
const isMainAuditFinalStage = computed(() => {
  return isMainDomain.value && ["S4", "S6"].includes(currentStageCode.value);
});
const _shouldShowMainPriorOpinions = computed(() => {
  return false;
});
const isMainAuditFormulaMode = computed(() => {
  return (
    isMainDomain.value &&
    ["S4", "S5", "S6", "S7", "S8"].includes(currentStageCode.value)
  );
});
const isMainValueSelectionStage = computed(() => {
  return isMainDomain.value && currentStageCode.value === "S5";
});
const isS5DecisionApprovalStage = computed(() => {
  if (!isMainValueSelectionStage.value) return false;
  if (s5WorkbenchMode.value) return isS5DecisionApprovalPage.value;
  return hasStageActionPermission("approve") && !isS5SelectMainAction.value;
});
const isMeetingNoticeStage = computed(() => {
  return isMainDomain.value && currentStageCode.value === "S7";
});
const isMainSourceSwitchStage = computed(() => {
  return (
    (isMainValueSelectionStage.value && !isS5DecisionApprovalStage.value) ||
    isMeetingNoticeStage.value
  );
});
const pageTitle = computed(() => {
  if (isMainDomain.value) {
    if (isMeetingNoticeStage.value) return "上会管理";
    if (isMainReadonlyPreviewStage.value) return "主表只读预览";
    if (isS5DecisionApprovalStage.value) return "S5 决策评审";
    return isMainValueSelectionStage.value ? "主表最终值选择" : "主表审核详情";
  }
  return isBrandFinancePreviewStage.value ? "子表预览详情" : "子表审核详情";
});
const _mineScopeLabel = computed(() => {
  if (isMainDomain.value) {
    if (isMeetingNoticeStage.value) return "只读科目";
    if (isMainReadonlyPreviewStage.value) return "只读科目";
    return isMainValueSelectionStage.value ? "可改科目" : "仅可审核项";
  }
  return isBrandFinancePreviewStage.value ? "仅可处理项" : "仅可审核项";
});
const permissionLabel = computed(() => {
  if (isMeetingNoticeStage.value) return "通知权限";
  if (isMainReadonlyPreviewStage.value) return "查看权限";
  if (isS5DecisionApprovalStage.value) return "评审权限";
  if (isMainDomain.value)
    return isMainValueSelectionStage.value ? "最终提交权限" : "审核权限";
  return isBrandFinancePreviewStage.value ? "处理权限" : "审核权限";
});
const moduleOpinionPlaceholder = computed(() => {
  if (isMainDomain.value) {
    if (isMeetingNoticeStage.value) return "S7 会前窗口期仅支持只读查看";
    if (isMainReadonlyPreviewStage.value)
      return "S2 主表由集团部室子表审核值计算生成，仅支持只读预览";
    return isMainValueSelectionStage.value
      ? "当前阶段按选中主表逐项改值，不填写模块意见"
      : "请输入该主表模块审核意见";
  }
  return isBrandFinancePreviewStage.value
    ? "请输入该子表预览沟通意见"
    : "请输入该子表整体审核意见";
});
const moduleSubmitText = computed(() => {
  if (isMainDomain.value) {
    return "保存审核意见";
  }
  return isBrandFinancePreviewStage.value
    ? "提交当前子表至集团部室审核"
    : "提交";
});
const cellPopoverSubText = computed(() => {
  if (isMainDomain.value) {
    if (isMainReadonlyPreviewStage.value) {
      return "S2 主表无审核意见，仅展示集团部室子表审核值计算后的只读预览。";
    }
    if (isMainValueSelectionStage.value) {
      return "先选择一份主表作为基准；需要调整时点击单元格选择历史值或输入新值。";
    }
    return "可采纳历史候选值，也可填写本阶段主表审核值；确认后会单独记录该值。";
  }
  return "可采纳历史审核值，也可填写本级修改值；确认后会单独记录该值和本次给值意见。";
});
const isStageFinalSubmitter = computed(() => {
  return hasStageActionPermission("submit");
});
const showStageFinalSubmitAction = computed(() => {
  return (
    isSubtableDomain.value &&
    currentStageCode.value === "S2" &&
    isStageFinalSubmitter.value &&
    s2DetailMode.value === "stage_submit"
  );
});
// S2 页始终展示 8 张子表审核提交进度卡片
const showS2ModuleProgressCards = computed(() => isS2SubtableStage.value);
const s2ModuleProgressCards = computed(() => buildS2ModuleProgressCards());
const s2ModuleProgressDoneCount = computed(() =>
  s2ModuleProgressCards.value.filter((card) => card.submitted).length
);
const s2ModuleProgressAllDone = computed(() => {
  return (
    s2ModuleProgressCards.value.length > 0 &&
    s2ModuleProgressDoneCount.value === s2ModuleProgressCards.value.length
  );
});
const _canRecalculate = computed(() => {
  return false;
});
const showMainFinalSubmitAction = computed(() => {
  if (isMainFlowPermissionEntry.value) {
    return isMainAuditFinalStage.value && isMainFlowSubmitAction.value;
  }
  return isMainAuditFinalStage.value && hasStageActionPermission("review");
});
const isMainSubmitOverviewMode = computed(() => {
  return !usesMainViewMode.value || mainViewMode.value === "overview";
});
const mainSubmitOverviewGuardHint = computed(() => {
  return "请切换到总览，确认全部年份与版型后再提交";
});
const showMainSubmitOverviewGuardHint = computed(() => {
  return showMainFinalSubmitAction.value && !isMainSubmitOverviewMode.value;
});
const showMainSelectionOverviewGuardHint = computed(() => {
  return showMainSelectionSubmitAction.value && !isMainSubmitOverviewMode.value;
});
const canSubmitMainFinal = computed(() => {
  return (
    showMainFinalSubmitAction.value &&
    !isSubmitBlocking.value &&
    !isAnyModuleLoading.value &&
    !hasModuleLoadErrors.value &&
    !mainFinalSubmitting.value &&
    isMainSubmitOverviewMode.value &&
    (isMainFlowPermissionEntry.value
      ? isMainFlowSubmitAction.value
      : canEditAudit.value && canEditStage.value)
  );
});
const showMeetingStartAction = computed(() => {
  // 仅屏蔽 S7 详情页右上角「开始上会」；上会管理列表仍可操作，权限配置不改
  return false;
});
const canStartMeeting = computed(() => {
  return (
    showMeetingStartAction.value &&
    !loading.value &&
    !isSubmitBlocking.value &&
    !meetingStartSubmitting.value
  );
});
const meetingNoticeStatusText = computed(() => {
  return meetingNoticeForm.published ? "已有上会信息" : "暂无上会信息";
});
const showMainSelectionCard = computed(() => {
  if (s5WorkbenchMode.value) return isS5MainSelectionPage.value;
  if (isS5FlowPermissionEntry.value) {
    return isMainValueSelectionStage.value && isS5SelectMainAction.value;
  }
  return isMainSourceSwitchStage.value && !isS5DecisionApprovalStage.value;
});
const showMainSelectionSubmitAction = computed(() => {
  if (isS5MainSelectionLocked.value) return false;
  if (s5WorkbenchMode.value) return isS5MainSelectionPage.value;
  if (isS5FlowPermissionEntry.value) {
    return isMainValueSelectionStage.value && isS5SelectMainAction.value;
  }
  return isMainValueSelectionStage.value && !isS5DecisionApprovalStage.value;
});
const mainSelectionTitle = computed(() => {
  return isMeetingNoticeStage.value ? "查看会前主表数据" : "选择主表最终值";
});
const mainSelectionModeText = computed(() => {
  if (isS5MainSelectionLocked.value) return "已锁定";
  if (isS5FlowPermissionEntry.value && !isS5SelectMainAction.value)
    return "只读查看";
  return isMeetingNoticeStage.value ? "只读查看" : "选中后可改新值";
});
const mainSelectionOptions = computed(() => {
  if (isS5MainSelectionLocked.value) {
    return [
      {
        value: "S5",
        label: "已锁定 S5 主表快照",
      },
    ];
  }
  return getMainSourceOptions();
});
const s5MainSelectionLockMeta = computed(() => {
  const meta = detail && detail.s5MainSelectionLocked;
  return meta && typeof meta === "object"
    ? (meta as Record<string, unknown>)
    : ({} as Record<string, unknown>);
});
const isS5MainSelectionLocked = computed(() => {
  return (
    isS5MainSelectionPage.value && Boolean(s5MainSelectionLockMeta.value.locked)
  );
});
const selectedMainSourceLabel = computed(() => {
  const hit = mainSelectionOptions.value.find(
    (item) => item.value === selectedMainSourceStage.value,
  );
  return hit ? hit.label : selectedMainSourceStage.value;
});
const canSubmitMainSelection = computed(() => {
  return (
    showMainSelectionSubmitAction.value &&
    !isS5MainSelectionLocked.value &&
    !isSubmitBlocking.value &&
    !isAnyModuleLoading.value &&
    !hasModuleLoadErrors.value &&
    !mainFinalSubmitting.value &&
    isMainSubmitOverviewMode.value &&
    canEditAudit.value &&
    canEditStage.value &&
    hasStageActionPermission("select_main") &&
    (isS5FlowPermissionEntry.value ? isS5SelectMainAction.value : true) &&
    ["S2", "S3", "S4"].includes(selectedMainSourceStage.value)
  );
});
const s5DecisionApprovalMeta = computed(() => {
  const meta = detail && detail.s5DecisionApproval;
  return meta && typeof meta === "object"
    ? (meta as Record<string, unknown>)
    : ({} as Record<string, unknown>);
});
const hasS5DecisionApprovalData = computed(() => {
  return Boolean(s5DecisionApprovalMeta.value.hasS5Data);
});
const hasSubmittedS5DecisionApproval = computed(() => {
  return Boolean(s5DecisionApprovalMeta.value.submitted);
});
const s5DecisionApprovalTagType = computed(() => {
  if (hasSubmittedS5DecisionApproval.value) return "info";
  return hasS5DecisionApprovalData.value ? "success" : "warning";
});
const s5DecisionApprovalTagText = computed(() => {
  if (hasSubmittedS5DecisionApproval.value) return "已评审";
  return hasS5DecisionApprovalData.value ? "可评审" : "仅预览";
});
const s5DecisionApprovalSourceStage = computed<string>(() => {
  const sourceStage = s5DecisionApprovalMeta.value.sourceStage;
  if (sourceStage != null && String(sourceStage).trim() !== "")
    return String(sourceStage);
  return hasS5DecisionApprovalData.value ? "S5" : "S4";
});
const s5DecisionApprovalSourceText = computed(() => {
  return hasS5DecisionApprovalData.value
    ? "当前展示 S5 管理经理提交数据"
    : "未查询到管理经理提交的 S5 主表值，当前展示 S4 数据";
});
const s5DecisionApprovalHint = computed(() => {
  if (hasSubmittedS5DecisionApproval.value) {
    return "当前决策权限已有评审记录，可换用另一账号再次提交以完成第二人确认。";
  }
  if (hasS5DecisionApprovalData.value) {
    return "确认后流转至 S6。";
  }
  return "需要管理经理先提交 S5 主表值，才能确认流转至 S6。";
});
const canConfirmS5DecisionApproval = computed(() => {
  return (
    isS5DecisionApprovalStage.value &&
    hasS5DecisionApprovalData.value &&
    !hasSubmittedS5DecisionApproval.value &&
    !isSubmitBlocking.value &&
    !decisionApprovalSubmitting.value &&
    hasStageActionPermission("approve")
  );
});
const canSubmitS5DecisionApproval = computed(() => {
  return (
    canConfirmS5DecisionApproval.value &&
    !isAnyModuleLoading.value &&
    !hasModuleLoadErrors.value &&
    hasStageActionPermission("approve")
  );
});
const canSubmitStageFinal = computed(() => {
  return (
    showStageFinalSubmitAction.value &&
    !isSubmitBlocking.value &&
    !isAnyModuleLoading.value &&
    !hasModuleLoadErrors.value &&
    !stageFinalSubmitting.value &&
    Boolean(stageCompletionSummary.value && stageCompletionSummary.value.ok)
  );
});
const isAnyModuleLoading = computed(() => {
  return Object.values(moduleLoadStateMap || {}).some(
    (state) => state && state.status === "loading",
  );
});
const hasModuleLoadErrors = computed(() => {
  return Object.values(moduleLoadStateMap || {}).some(
    (state) => state && state.status === "error",
  );
});
const isSubmitBlocking = computed(() => {
  return (
    Boolean(moduleSubmittingKey.value) ||
    stageFinalSubmitting.value ||
    mainFinalSubmitting.value ||
    decisionApprovalSubmitting.value ||
    meetingStartSubmitting.value
  );
});
const pageBlocking = computed(() => {
  return loading.value || isSubmitBlocking.value;
});
const pageBlockingText = computed(() => {
  return isSubmitBlocking.value ? "提交处理中，请勿重复操作" : "加载中";
});
const stageCompletionRows = computed(() => {
  return stageCompletionSummary.value &&
    Array.isArray(stageCompletionSummary.value.modules)
    ? stageCompletionSummary.value.modules
    : [];
});
const stageCompletionStatusText = computed(() => {
  if (!stageCompletionSummary.value) return "正在检查";
  return stageCompletionSummary.value.ok
    ? "可最终提交"
    : stageCompletionSummary.value.message || "存在阻塞项";
});
const auditAccessPolicy = computed(() => {
  if (isS2SubtableStage.value) {
    const canViewStage = hasStageActionPermission("view");
    const canReviewStage = hasStageActionPermission("review");
    const canSubmitStage = hasStageActionPermission("submit");
    return {
      access: canReviewStage
        ? AUDIT_ACCESS.AUDIT
        : canViewStage || canSubmitStage
          ? AUDIT_ACCESS.VIEW
          : AUDIT_ACCESS.NONE,
      rowScope:
        hasAllPermission.value ||
        isMainDomain.value ||
        String(route.query.subjectApiMode || "")
          .trim()
          .toLowerCase() === "all"
          ? AUDIT_ROW_SCOPE.ALL
          : AUDIT_ROW_SCOPE.RESPONSIBLE_SUBJECTS,
      canSubmit: canReviewStage && !isS2StageSubmitAction.value,
      canWriteOpinion: false,
      canApproveS5: false,
    };
  }

  const canView = hasStageActionPermission("view");
  const canReview =
    hasStageActionPermission("review") ||
    hasStageActionPermission("select_main") ||
    hasStageActionPermission("approve") ||
    hasStageActionPermission("edit") ||
    hasStageActionPermission("start_meeting");
  const canSubmit =
    hasStageActionPermission("review") ||
    hasStageActionPermission("submit") ||
    hasStageActionPermission("select_main") ||
    hasStageActionPermission("approve");
  return {
    access:
      canReview || canSubmit
        ? AUDIT_ACCESS.AUDIT
        : canView
          ? AUDIT_ACCESS.VIEW
          : AUDIT_ACCESS.NONE,
    rowScope:
      hasAllPermission.value ||
      isMainDomain.value ||
      String(route.query.subjectApiMode || "")
        .trim()
        .toLowerCase() === "all"
        ? AUDIT_ROW_SCOPE.ALL
        : AUDIT_ROW_SCOPE.RESPONSIBLE_SUBJECTS,
    canSubmit,
    canWriteOpinion: hasStageActionPermission("approve"),
    canApproveS5: hasStageActionPermission("approve"),
  };
});
const canViewAudit = computed(() => {
  if (isMainFlowPermissionEntry.value)
    return canViewMainFlowPermissionEntry.value;
  return (
    auditAccessPolicy.value.access === AUDIT_ACCESS.VIEW ||
    auditAccessPolicy.value.access === AUDIT_ACCESS.AUDIT
  );
});
const canEditAudit = computed(() => {
  if (queryReadonlyAuthorizedScope.value) return false;
  if (isMeetingNoticeStage.value) return false;
  if (isS2StageSubmitAction.value) return false;
  if (isS2ViewAction.value) return false;
  if (isS5FlowPermissionEntry.value) return isS5SelectMainAction.value;
  if (isMainFlowPermissionEntry.value) return isMainFlowReviewAction.value;
  return auditAccessPolicy.value.access === AUDIT_ACCESS.AUDIT;
});
const canEditStage = computed(() => {
  if (queryReadonlyAuthorizedScope.value) return false;
  if (isMeetingNoticeStage.value) return false;
  if (isS2StageSubmitAction.value) return false;
  if (isS2ViewAction.value) return false;
  if (isS5FlowPermissionEntry.value) return isS5SelectMainAction.value;
  if (isMainFlowPermissionEntry.value) return isMainFlowReviewAction.value;
  return auditAccessPolicy.value.access === AUDIT_ACCESS.AUDIT;
});
const _canViewAllRows = computed(() => {
  return auditAccessPolicy.value.rowScope === AUDIT_ROW_SCOPE.ALL;
});
const usesResponsibleSubjectScope = computed(() => {
  return (
    auditAccessPolicy.value.rowScope === AUDIT_ROW_SCOPE.RESPONSIBLE_SUBJECTS
  );
});
const showScopeSwitch = computed(() => {
  return false;
});
const effectiveRowScope = computed(() => {
  if (queryReadonlyAuthorizedScope.value) return "mine";
  if (!showScopeSwitch.value) {
    return usesResponsibleSubjectScope.value ? "mine" : "all";
  }
  return rowScope.value === "mine" ? "mine" : "all";
});
const currentYearLabel = computed(() => {
  if (isLifecycleYearActive.value) return "全生命周期";
  const years = dimensions.years || [];
  const index = Math.min(
    Math.max(activeRealYearIndex.value, 0),
    Math.max(years.length - 1, 0),
  );
  return years[index] || "-";
});
interface DisplayYearOption {
  key: string;
  label: string;
  value: string;
  year: unknown;
  yearIndex: number;
  lifecycle?: boolean;
  real?: boolean;
  displayOnly?: boolean;
  readonly?: boolean;
  aggregateMode?: string;
  [key: string]: unknown;
}

const displayYearOptions = computed<DisplayYearOption[]>(() => {
  return (buildDisplayYearOptions(dimensions.years || []) ||
    []) as DisplayYearOption[];
});
const trimOptions = computed(() => {
  return (dimensions.trims || []).map((trim: unknown, index: number) => {
    if (trim && typeof trim === "object") {
      const trimRecord = trim as Record<string, unknown>;
      const trimId = String(
        trimRecord.trimId ||
          trimRecord.id ||
          trimRecord.code ||
          trimRecord.name ||
          trimRecord.label ||
          `trim_${index + 1}`,
      ).trim();
      return {
        trimId,
        trimName:
          String(
            trimRecord.trimName ||
              trimRecord.name ||
              trimRecord.label ||
              trimId,
          ).trim() || trimId,
        trimIndex: Number.isInteger(trimRecord.trimIndex)
          ? Number(trimRecord.trimIndex)
          : index,
      };
    }
    const trimId = String(trim || `trim_${index + 1}`).trim();
    return {
      trimId,
      trimName: trimId || `版型${index + 1}`,
      trimIndex: index,
    };
  });
});
const activeYearOption = computed(() => {
  const key = String(activeYearKey.value || "").trim();
  const options = displayYearOptions.value;
  return (
    options.find((item) => item.key === key) ||
    options.find((item) => item.yearIndex === activeYearIndex.value) ||
    options[0] ||
    null
  );
});
const isLifecycleYearActive = computed(() => {
  return Boolean(activeYearOption.value && activeYearOption.value.lifecycle);
});
const activeRealYearIndex = computed(() => {
  if (isLifecycleYearActive.value) return -1;
  const option = activeYearOption.value;
  if (option && Number.isInteger(option.yearIndex)) return option.yearIndex;
  const years = dimensions.years || [];
  return Math.min(
    Math.max(activeYearIndex.value, 0),
    Math.max(years.length - 1, 0),
  );
});
const projectTitle = computed(() => {
  const projectNo = project.projectNo || queryProjectCode.value;
  const projectName =
    project.projectName || queryProjectName.value || "收益测算项目";
  const gate = project.gate || queryValve.value;
  return `${projectNo} / ${projectName}（阀点 ${gate}）`;
});
const modules = computed<ModuleSection[]>(() => {
  return (buildRevenueModuleSections(detail.rows || []) ||
    []) as ModuleSection[];
});
const fullScopeRows = computed(() => {
  return Array.isArray(detail.rows) ? detail.rows : [];
});
const _hasReviewableRowsInFullScope = computed(() => {
  return fullScopeRows.value.some((row) => isReviewableRowInFullScope(row));
});
const _hasReadonlyRowsInFullScope = computed(() => {
  return fullScopeRows.value.some((row) => !isReviewableRowInFullScope(row));
});
const visibleModules = computed(() => {
  return modules.value
    .filter((module) => !shouldHideCurrentRoleModule(module))
    .map((module) => ({
      ...module,
      rows: (module.rows || []).filter((row) => canViewRow(row)),
    }))
    .filter((module) => module.rows.length);
});
const editableCount = computed(() => {
  return Object.keys(editableRowMap || {}).length;
});
const mergedTimeline = computed(() => {
  const timeline = (detail.timeline || []) as Record<string, unknown>[];
  const merged = timeline.concat(
    (submitTimeline.value || []) as Record<string, unknown>[],
  );
  return merged.sort((a, b) =>
    String(b.time || "").localeCompare(String(a.time || "")),
  );
});
const matrixRenderKey = computed(() => {
  const years = (dimensions.years || []).join("|");
  const trims = (dimensions.trims || []).join("|");
  return [
    currentStageCode.value,
    auditDomain.value,
    isMainSourceSwitchStage.value ? selectedMainSourceStage.value : "",
    usesMainViewMode.value ? mainViewMode.value : "",
    activeYearKey.value,
    activeTrimId.value,
    years,
    trims,
  ].join("__");
});
const matrixColumns = computed(() => {
  if (usesMainViewMode.value) return resolveMainMatrixColumns();
  const years = dimensions.years || [];
  if (isLifecycleYearActive.value) {
    const lifecycleTrimColumns = buildLifecycleTrimColumns(
      years,
      dimensions.trims || [],
      {
        sourceRows: getAggregateSourceRows(),
      },
    );
    return lifecycleTrimColumns
      .concat(
        buildLifecycleSubtotalColumn(lifecycleTrimColumns, {
          sourceRows: getAggregateSourceRows(),
        }),
      )
      .filter((column: MatrixColumn) => !isHiddenSubtotalColumn(column));
  }

  const yearIndex = Math.min(
    Math.max(activeRealYearIndex.value, 0),
    Math.max(years.length - 1, 0),
  );
  const sourceColumns = (dimensions.trims || []).map(
    (trim: string, trimIndex: number) => ({
      key: `trim_${trimIndex}`,
      // 按年份视图：表头仅显示版型名，与填报侧一致；年份仍保留在 yearLabel 供数据定位
      label: trim,
      yearLabel: currentYearLabel.value,
      yearIndex,
      trimIndex,
      trimId: trim,
      trimName: trim,
      real: true,
      displayOnly: false,
      aggregateMode: "NONE",
    }),
  );

  const columns = sourceColumns.slice();

  if (sourceColumns.length > 0) {
    columns.push(
      buildYearSubtotalColumn(
        currentYearLabel.value,
        sourceColumns[0].yearIndex,
        sourceColumns,
        { sourceRows: getAggregateSourceRows() },
      ),
    );
  }
  return columns.filter((column) => !isHiddenSubtotalColumn(column));
});
const emptyText = computed(() => {
  const scopedToMine = effectiveRowScope.value === "mine";
  if (isMainDomain.value) {
    if (isMeetingNoticeStage.value) return "当前模块暂无主表科目";
    if (isMainReadonlyPreviewStage.value) return "当前模块暂无可查看主表科目";
    if (isMainValueSelectionStage.value) return "当前模块无可提交主表科目";
    if (!canEditAudit.value)
      return scopedToMine
        ? "当前范围无你可查看主表科目"
        : "当前模块暂无可查看主表科目";
    return scopedToMine ? "当前范围无你可审核科目" : "当前模块无可审核科目";
  }
  if (isBrandFinancePreviewStage.value) {
    return scopedToMine ? "当前范围无你可处理科目" : "当前模块无可处理科目";
  }
  if (!canEditAudit.value)
    return scopedToMine
      ? "当前范围无你可查看子表科目"
      : "当前模块暂无可查看子表科目";
  return scopedToMine ? "当前范围无你可审核科目" : "当前模块无可审核科目";
});
const emptyStateText = computed(() => {
  const scopedToMine = effectiveRowScope.value === "mine";
  if (isMainDomain.value) {
    if (isMeetingNoticeStage.value) return "当前暂无可查看主表科目";
    if (isMainReadonlyPreviewStage.value) return "当前暂无可查看主表科目";
    if (!canEditAudit.value)
      return scopedToMine
        ? "当前用户暂无可查看主表科目"
        : "当前暂无可查看主表科目";
    return scopedToMine ? "当前用户暂无可处理主表科目" : "当前暂无主表科目";
  }
  if (!canEditAudit.value)
    return scopedToMine
      ? "当前用户暂无可查看子表科目"
      : "当前暂无可查看子表科目";
  return scopedToMine ? "当前用户暂无可处理子表科目" : "当前暂无子表科目";
});
const headerInfoItems = computed(() => {
  const items = [
    { label: "项目编号", value: project.projectNo || "-" },
    { label: "阀点", value: project.gate || "-" },
    {
      label: "阶段",
      value: displayUiText(currentStageCode.value || detail.stage || "-"),
    },
    { label: permissionLabel.value, value: queryPermissionKey.value || "-" },
    { label: "当前用户", value: currentUserName.value },
    {
      label:
        isMeetingNoticeStage.value ||
        isMainReadonlyPreviewStage.value ||
        !canEditAudit.value
          ? "查看科目"
          : isMainDomain.value
            ? "可编辑科目"
            : "可处理科目",
      value:
        isMeetingNoticeStage.value ||
        isMainReadonlyPreviewStage.value ||
        !canEditAudit.value
          ? fullScopeRows.value.length
          : editableCount.value,
    },
  ];
  if (showMainSelectionCard.value) {
    items.push({
      label: isMeetingNoticeStage.value ? "查看来源" : "选择来源",
      value: selectedMainSourceLabel.value,
    });
  }
  if (isS5DecisionApprovalStage.value) {
    items.push({
      label: "查看来源",
      value: s5DecisionApprovalSourceStage.value,
    });
  }
  return items;
});
const parentSubjectDisplayMap = computed(() => {
  const map = detail && detail.parentSubjectDisplay;
  return map && typeof map === "object" && !Array.isArray(map) ? map : {};
});
const _created = computed(() => {
  reloadForRoute();
  return true;
});
const _activated = computed(() => {
  if (lastLoadedRouteFullPath.value !== route.fullPath) {
    reloadForRoute();
  }
  return true;
});

function hasStageActionPermission(actionKey: string) {
  return hasFlowStageActionPermission(
    currentPermissions.value,
    currentStageCode.value,
    actionKey,
  );
}

// 统一模式组件回调：edit↔审核(review)，view_submit↔查看提交(stage_submit)
function switchS2UnifiedMode(mode: string) {
  switchS2DetailMode(mode === "edit" ? "review" : "stage_submit");
}
// 统一模式组件回调：edit↔主表选择(select_main)，view_submit↔二人确认(decision_approval)
function switchS5UnifiedMode(mode: string) {
  switchS5WorkbenchMode(mode === "edit" ? "select_main" : "decision_approval");
}
function switchS5WorkbenchMode(mode: string) {
  if (!showS5ModeSwitch.value) return;
  const normalizedMode =
    String(mode || "")
      .trim()
      .toLowerCase() === "decision_approval"
      ? "decision_approval"
      : "select_main";
  const routeMap = {
    select_main: {
      action: "select_main",
      path: "/revenue/s5-main-selection-detail",
    },
    decision_approval: {
      action: "approve",
      path: "/revenue/s5-decision-approval-detail",
    },
  };
  const routeConfig = routeMap[normalizedMode];
  const action = routeConfig.action;
  const path = routeConfig.path;
  if (
    route.path === path &&
    s5WorkbenchMode.value === normalizedMode &&
    routeActionKey.value === action
  ) {
    return;
  }

  const query: Record<string, unknown> = {
    ...route.query,
    action,
    permissionKey: resolveFlowStageActionPermission("S5", action),
    s5Mode: normalizedMode,
    subjectApiMode: "all",
  };
  if (normalizedMode === "select_main") {
    query.selectedSourceStage =
      selectedMainSourceStage.value || query.selectedSourceStage || "S4";
  } else {
    delete query.selectedSourceStage;
  }

  router
    .replace({ path, query: query as Record<string, string> })
    .catch((error) => {
      if (!error || error.name === "NavigationDuplicated") return;
      throw error;
    });
}
function switchS2DetailMode(mode: string) {
  if (!showS2ModeSwitch.value) return;
  const normalizedMode = String(mode || "").trim();
  const action =
    normalizedMode === "stage_submit" ? "stage_final_submit" : "review";
  if (routeActionKey.value === action) return;

  const query: Record<string, unknown> = {
    ...route.query,
    action,
    permissionKey: resolveFlowStageActionPermission("S2", action),
  };
  if (normalizedMode === "stage_submit") {
    query.subjectApiMode = "all";
    // 查看提交模式 = 模板全集（系统聚合视图），不按当前用户授权裁剪
    query.subjectScope = "template";
  } else {
    delete query.subjectApiMode;
    delete query.subjectScope;
  }

  router
    .replace({ path: route.path, query: query as Record<string, string> })
    .catch((error) => {
      if (!error || error.name === "NavigationDuplicated") return;
      throw error;
    });
}

function isHiddenSubtotalColumn(_column: MatrixColumn) {
  return false;
}

function prepareRouteState() {
  const stage = normalizeStageCode(queryStage.value);
  const routeUserId = queryUserId.value;
  const routeUserName = queryUserName.value || routeUserId;
  currentUser.value = routeUserId || "";
  currentUserName.value = routeUserName || "-";
  Object.assign(project, {
    projectNo: queryProjectCode.value,
    projectName: queryProjectName.value,
    gate: queryValve.value,
  });
  Object.assign(detail, {
    stageCode: stage,
    stage,
    rows: [],
    timeline: [],
  });
  Object.assign(dimensions, {
    years: [],
    trims: [],
  });
  replaceReactiveMap(visibleRowMap);
  replaceReactiveMap(editableRowMap);
  replaceReactiveMap(cellDrafts);
  replaceReactiveMap(cellHistories);
  replaceReactiveMap(moduleOpinionMap);
  replaceReactiveMap(moduleOpinionDraftMap);
  replaceReactiveMap(moduleSubmitMap);
  replaceReactiveMap(moduleReeditMap);
  replaceReactiveMap(moduleViewStateMap);
  moduleLoadPlan.value = [];
  Object.assign(moduleLoadStateMap, {});
  Object.assign(moduleRecordMap, {});
  moduleSubjectTreePayload.value = null;
  modulePatternList.value = [];
  moduleBaseQuery.value = null;
  submitTimeline.value = [];
  flowOpinionItems.value = [];
  stageCompletionSummary.value = null;
  activeYearIndex.value = 0;
  activeYearKey.value = "";
  activeTrimId.value = "";
  mainViewMode.value = "year";
  resetMeetingNoticeForm();
  meetingInfoLoading.value = false;
  meetingInfoRequestSeq.value += 1;
  if (isMainDomain.value && ["S5", "S7"].includes(stage)) {
    ensureSelectedMainSourceStage(stage);
  }
}
const reloadForRoute = async () => {
  prepareRouteState();
  await loadPage();
};
function buildQueryPayload() {
  const requestUserId = queryUserId.value || currentUser.value || "";
  const requestUserName =
    queryUserName.value || currentUserName.value || requestUserId;
  const accessPolicy = auditAccessPolicy.value || {};
  const isReadonlyAllSubtable =
    isSubtableDomain.value &&
    accessPolicy.access === AUDIT_ACCESS.VIEW &&
    accessPolicy.rowScope === AUDIT_ROW_SCOPE.ALL;
  const subjectApiMode =
    queryReadonlyAuthorizedScope.value ||
    isMainDomain.value ||
    isReadonlyAllSubtable ||
    hasAllPermission.value
      ? "all"
      : showStageFinalSubmitAction.value
        ? "auto"
        : "";
  // 模式派生科目源：仅审核(编辑)模式按用户授权裁剪；查看与提交都是模板全集（全量查看）
  const subjectScope = isS2SubtableStage.value
    ? s2DetailMode.value === "review"
      ? ""
      : "template"
    : "";
  return {
    projectId: queryProjectId.value,
    flowId: queryFlowId.value,
    projectCode: queryProjectCode.value,
    projectName: queryProjectName.value,
    permissionKey: queryPermissionKey.value,
    fullAccess: hasAllPermission.value,
    isSuperAdmin: queryIsSuperAdmin.value,
    userId: requestUserId,
    userName: requestUserName,
    stage: queryStage.value,
    valve: queryValve.value,
    workbenchAction: routeActionKey.value,
    subjectDomain: auditDomain.value,
    includeReadonlySubtablesInMain: isMainDomain.value,
    readonlyAuthorizedScope: queryIsSuperAdmin.value ? "" : queryReadonlyAuthorizedScope.value,
    ...(s5WorkbenchMode.value ? { s5Mode: s5WorkbenchMode.value } : {}),
    ...(isS2SubtableStage.value && s2DetailMode.value
      ? { s2DetailMode: s2DetailMode.value }
      : {}),
    ...(subjectApiMode ? { subjectApiMode } : {}),
    ...(subjectScope ? { subjectScope } : {}),
  };
}
function buildCurrentMineDetailPayload() {
  const rows = Array.isArray(detail && detail.rows) ? detail.rows : [];
  const visibleMap = visibleRowMap || {};
  const editableMap = editableRowMap || {};
  const resolveRowId = (row: unknown) =>
    String(
      row &&
        typeof row === "object" &&
        (row as Record<string, unknown>).id != null
        ? (row as Record<string, unknown>).id
        : "",
    ).trim();
  const visibleRows = rows.filter((row) => {
    const rowId = resolveRowId(row);
    return rowId && (visibleMap[rowId] || editableMap[rowId]);
  });
  const editableRows = rows.filter((row) => {
    const rowId = resolveRowId(row);
    return rowId && editableMap[rowId];
  });
  return {
    rows: visibleRows,
    editableRows,
  };
}
function buildCurrentAuditPayload() {
  return {
    detail: detail,
    mineDetail: buildCurrentMineDetailPayload(),
    fillDetail: {
      dimensions: dimensions,
      trimOptions: trimOptions.value,
      yearTrimConfig: detail && detail.yearTrimConfig,
      parentSubjectDisplay: detail && detail.parentSubjectDisplay,
    },
    subjectTreePayload: moduleSubjectTreePayload.value,
    moduleLoadPlan: moduleLoadPlan.value,
    patternList: modulePatternList.value,
  };
}
type MainSourceOption = { value: string; label: string };
function getMainSourceOptions(stageCode?: string) {
  const stage = normalizeStageCode(stageCode || queryStage.value);
  const options =
    (
      MAIN_SELECTION_SOURCE_OPTIONS as unknown as Record<
        string,
        MainSourceOption[]
      >
    )[stage] || MAIN_SELECTION_SOURCE_OPTIONS.S5;
  return options.map((item) => ({ ...item }));
}
function ensureSelectedMainSourceStage(stageCode: string) {
  const options = getMainSourceOptions(stageCode);
  const allowed = options.map((item) => item.value);
  const routeSource = normalizeStageCode(querySelectedSourceStage.value || "");
  if (allowed.includes(routeSource)) {
    selectedMainSourceStage.value = routeSource;
    return;
  }
  if (allowed.includes(selectedMainSourceStage.value)) return;
  selectedMainSourceStage.value = options[0] ? options[0].value : "S4";
}
function syncS5MainSelectionLockState() {
  if (isS5MainSelectionLocked.value) {
    selectedMainSourceStage.value = "S5";
  }
}
function resetMeetingNoticeForm() {
  Object.assign(meetingNoticeForm, {
    meetingTime: "",
    freezeTime: "",
    nodeText: "",
    published: false,
    publishedAt: "",
    publishedBy: "",
  });
}
function pickMeetingNoticeInfo(rows: unknown) {
  const projectId = safeText(queryProjectId.value || project.projectId);
  const valvePoint = safeText(queryValve.value || project.gate).toLowerCase();
  const flowId = safeText(queryFlowId.value);
  const candidates = (Array.isArray(rows) ? rows : [])
    .map((row: unknown, index: number) =>
      normalizeMeetingInfoRow(row as Record<string, unknown>, index),
    )
    .filter((row) => {
      if (projectId && safeText(row.projectId) !== projectId) return false;
      if (valvePoint && safeText(row.valvePoint).toLowerCase() !== valvePoint)
        return false;
      if (flowId && row.flowId && row.flowId !== flowId) return false;
      return true;
    });
  candidates.sort((a, b) => {
    if (b.sortTime !== a.sortTime) return b.sortTime - a.sortTime;
    return String(b.id).localeCompare(String(a.id), "zh-CN", { numeric: true });
  });
  return candidates[0] || null;
}
const loadMeetingNoticeInfo = async () => {
  if (!isMeetingNoticeStage.value) return;
  const requestSeq = meetingInfoRequestSeq.value + 1;
  meetingInfoRequestSeq.value = requestSeq;
  resetMeetingNoticeForm();
  meetingInfoLoading.value = true;
  try {
    const payload = await listMeetings({
      projectIds: queryProjectId.value,
      valvePoints: queryValve.value,
      nodes: "S7",
      pageNum: 1,
      pageSize: 20,
    });
    const meetingInfo = pickMeetingNoticeInfo(
      normalizeMeetingListRows(payload),
    );
    if (requestSeq !== meetingInfoRequestSeq.value) return;
    if (meetingInfo) {
      Object.assign(meetingNoticeForm, {
        meetingTime: meetingInfo.meetingTime || "-",
        freezeTime: meetingInfo.freezeTime || "-",
        nodeText: meetingInfo.nodeText || "-",
        published: true,
        publishedAt: meetingInfo.publishedAt || "-",
        publishedBy: meetingInfo.publishedBy || "-",
      });
    }
  } catch (_error) {
    if (requestSeq === meetingInfoRequestSeq.value) {
      BaseToast.warning("上会信息加载失败");
    }
  } finally {
    if (requestSeq === meetingInfoRequestSeq.value) {
      meetingInfoLoading.value = false;
    }
  }
};
function applyRowPermissionMaps(detailRes: Record<string, unknown>) {
  const mineDetail: Record<string, unknown> =
    detailRes &&
    detailRes.mineDetail &&
    typeof detailRes.mineDetail === "object"
      ? (detailRes.mineDetail as Record<string, unknown>)
      : {};
  const scopedRows = Array.isArray(mineDetail.rows) ? mineDetail.rows : [];
  // 多模块串行加载时，每个模块的 mineDetail 往往只含本模块科目。
  // 若整表替换会冲掉已加载模块的可编/可见行，切到「总览」后意见框与提交会变灰。
  // 因此在同一次页面加载内做增量合并（路由切换时由 prepareRouteState 清空）。
  scopedRows.forEach((row: unknown) => {
    const rowId = String(
      row &&
        typeof row === "object" &&
        (row as Record<string, unknown>).id != null
        ? (row as Record<string, unknown>).id
        : "",
    ).trim();
    if (!rowId) return;
    visibleRowMap[rowId] = true;
  });

  const editableRows = Array.isArray(mineDetail.editableRows)
    ? mineDetail.editableRows
    : scopedRows;
  editableRows.forEach((row: unknown) => {
    const rowId = String(
      row &&
        typeof row === "object" &&
        (row as Record<string, unknown>).id != null
        ? (row as Record<string, unknown>).id
        : "",
    ).trim();
    if (!rowId) return;
    // 对齐 Vue2：可编辑行写入 editableRowMap（此前误写入 visibleMap，导致审核意见框始终禁用）
    editableRowMap[rowId] = true;
  });
  normalizeRowScope();
}
function syncActiveMatrixState() {
  if (activeYearIndex.value >= (dimensions.years || []).length) {
    activeYearIndex.value = 0;
  }
  const yearOptions = displayYearOptions.value;
  if (!yearOptions.some((item) => item.key === activeYearKey.value)) {
    activeYearKey.value = yearOptions[0] ? yearOptions[0].key : "";
  }
  if (!trimOptions.value.some((item) => item.trimId === activeTrimId.value)) {
    activeTrimId.value = trimOptions.value[0]
      ? trimOptions.value[0].trimId
      : "";
  }
  syncModuleViewStateMap();
}

function getModuleTraceNow() {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
}

function formatModuleTraceTime(value: number) {
  const date = new Date(value);
  const pad = (num: number, size = 2) => String(num).padStart(size, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
    `${pad(date.getMilliseconds(), 3)}`
  );
}

function getModuleLoadState(module: ModuleLoadPlan) {
  const key = resolveModuleKey(module);
  return key
    ? moduleLoadStateMap[key] || { status: "idle" }
    : { status: "idle" };
}

function setModuleLoadState(
  module: ModuleLoadPlan,
  nextState: ModuleLoadState,
) {
  const key = resolveModuleKey(module);
  if (!key) return;
  const previous = moduleLoadStateMap[key] || {};
  moduleLoadStateMap[key] = {
    ...previous,
    ...nextState,
    moduleKey: key,
    moduleName:
      module.moduleName ||
      module.rootSubjectName ||
      module.name ||
      previous.moduleName ||
      "",
  };
}

function isModuleLoading(module: ModuleLoadPlan) {
  return getModuleLoadState(module).status === "loading";
}

function isModuleLoadError(module: ModuleLoadPlan) {
  return getModuleLoadState(module).status === "error";
}

function moduleLoadingText(module: ModuleLoadPlan) {
  const state = getModuleLoadState(module) as ModuleLoadState;
  return state.message || "模块数据加载中";
}

function moduleLoadErrorText(module: ModuleLoadPlan) {
  const state = getModuleLoadState(module) as ModuleLoadState;
  return state.message || "当前模块数据加载失败";
}

function initializeModuleLoading(detailRes: Record<string, unknown>) {
  const plans = Array.isArray(detailRes.moduleLoadPlan)
    ? detailRes.moduleLoadPlan
    : [];
  moduleLoadPlan.value = plans as ModuleLoadPlan[];
  moduleSubjectTreePayload.value =
    (detailRes.subjectTreePayload as SubjectTreeNode[]) || null;
  modulePatternList.value = Array.isArray(detailRes.patternList)
    ? detailRes.patternList
    : [];
  Object.assign(moduleRecordMap, {});
  const stateMap: Record<string, ModuleLoadState> = {};
  plans.forEach((plan: unknown) => {
    const key = resolveModuleKey(plan as Record<string, unknown>);
    if (!key) return;
    stateMap[key] = {
      status: "idle",
      moduleKey: key,
      moduleName: String(
        plan && typeof plan === "object"
          ? (plan as Record<string, unknown>).moduleName ||
              (plan as Record<string, unknown>).rootSubjectName ||
              (plan as Record<string, unknown>).name ||
              ""
          : "",
      ),
      message: "",
    };
  });
  Object.assign(moduleLoadStateMap, stateMap);
}

function collectLoadedModuleRecords(excludeModuleKey: string) {
  return Object.keys(moduleRecordMap || {}).reduce(
    (result: unknown[], key: string) => {
      if (key === excludeModuleKey) return result;
      result.push(
        ...(Array.isArray(moduleRecordMap[key]) ? moduleRecordMap[key] : []),
      );
      return result;
    },
    [] as unknown[],
  );
}

function collectModulePlanSubjectIds() {
  const ids: string[] = [];
  (Array.isArray(moduleLoadPlan.value) ? moduleLoadPlan.value : []).forEach(
    (plan) => {
      (Array.isArray(plan.subjectIds) ? plan.subjectIds : []).forEach((id) => {
        const text = String(id == null ? "" : id).trim();
        if (text && !ids.includes(text)) ids.push(text);
      });
    },
  );
  return ids;
}

function shouldUseLocalS2CellHistories() {
  return isSubtableDomain.value && currentStageCode.value === "S2";
}

function shouldDeferModuleMainPreview() {
  return isS2SubtableStage.value && s2DetailMode.value === "review";
}

function resolveLocalBaselineTarget(row: MatrixRow, cellKey: string) {
  const targetMap =
    (row.cellTargetMap && typeof row.cellTargetMap === "object"
      ? row.cellTargetMap
      : null) ||
    (row.cellRecordMap && typeof row.cellRecordMap === "object"
      ? row.cellRecordMap
      : null);
  if (!targetMap) return null;
  if (Object.prototype.hasOwnProperty.call(targetMap, cellKey))
    return targetMap[cellKey];
  const dimension = getCellDimension(cellKey);
  if (
    dimension &&
    Object.prototype.hasOwnProperty.call(targetMap, dimension.dimensionKey)
  ) {
    return targetMap[dimension.dimensionKey];
  }
  return null;
}

function mergeS2BaselineCellHistories(detail: Record<string, unknown>) {
  if (!shouldUseLocalS2CellHistories()) return;
  const rawRows = detail && detail.rows;
  const rows: unknown[] = Array.isArray(rawRows) ? rawRows : [];
  const currentStage = normalizeStageCode(
    String((detail && detail.stageCode) || currentStageCode.value || ""),
  );
  rows.forEach((row: unknown) => {
    const rowRecord =
      row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    if (
      !rowRecord ||
      rowRecord.id == null ||
      !rowRecord.cells ||
      typeof rowRecord.cells !== "object"
    )
      return;
    if (!canReviewRow(rowRecord as MatrixRow)) return;
    const rowId = String(rowRecord.id);
    Object.keys(rowRecord.cells).forEach((cellKey: string) => {
      const cells = rowRecord.cells as Record<string, unknown>;
      const value = String(cells[cellKey] == null ? "" : cells[cellKey]).trim();
      if (!value) return;
      const target =
        (resolveLocalBaselineTarget(rowRecord as MatrixRow, cellKey) as Record<
          string,
          unknown
        >) || {};
      const baselineStage = normalizeStageCode(
        String(
          target.node || target.stageCode || target.sourceStageCode || "S1",
        ),
      );
      if (baselineStage === currentStage) return;
      const targetRecordIds = normalizeLocalIdList(
        target.targetRecordIds ||
          target.recordIds ||
          target.recordId ||
          target.id ||
          target.sourceRecordId,
      );
      const submitIds = normalizeLocalIdList(
        target.targetSubmitIds || target.submitIds || target.submitId,
      );
      const historyEntry = {
        key: `baseline_${baselineStage}_${rowId}_${cellKey}_${targetRecordIds[0] || "no_record"}`,
        rowId,
        cellKey,
        recordId: targetRecordIds[0],
        submitIds,
        stageCode: baselineStage,
        level: formatRevenueStageDisplayText(baselineStage),
        reviewer: String(target.ownerName || target.ownerId || "-"),
        reviewerId: String(target.ownerId || ""),
        value,
        opinion: "",
        time: String(target.updatedAt || target.createdAt || ""),
        status: String(target.recordStatus || target.status || ""),
        sourceType: "baseline",
      };
      if (!cellHistories[rowId]) {
        cellHistories[rowId] = {};
      }
      const rowHistories = cellHistories[rowId] as Record<string, unknown>;
      const existing = Array.isArray(rowHistories[cellKey])
        ? (rowHistories[cellKey] as unknown[])
        : [];
      const hasBaselineStage = existing.some(
        (item: unknown) =>
          normalizeStageCode(
            String(
              item && typeof item === "object"
                ? (item as Record<string, unknown>).stageCode || ""
                : "",
            ),
          ) === baselineStage,
      );
      if (!hasBaselineStage) {
        rowHistories[cellKey] = [historyEntry].concat(
          existing as (typeof historyEntry)[],
        );
      }
    });
  });
}

function applyAuditModuleDetail(moduleRes: Record<string, unknown>) {
  const detailRecord = detail as unknown as Record<string, unknown>;
  const s5MainSelectionLocked = detailRecord.s5MainSelectionLocked;
  Object.assign(
    project,
    (moduleRes.project as Record<string, unknown>) || project,
  );
  Object.assign(
    detail,
    (moduleRes.detail as Record<string, unknown>) || detail,
  );
  if (
    s5MainSelectionLocked &&
    detailRecord &&
    !detailRecord.s5MainSelectionLocked
  ) {
    detailRecord["s5MainSelectionLocked"] = s5MainSelectionLocked;
  }
  const fillDetail =
    moduleRes.fillDetail && typeof moduleRes.fillDetail === "object"
      ? (moduleRes.fillDetail as Record<string, unknown>)
      : null;
  const resDetail =
    moduleRes.detail && typeof moduleRes.detail === "object"
      ? (moduleRes.detail as Record<string, unknown>)
      : null;
  Object.assign(
    dimensions,
    (fillDetail && fillDetail.dimensions) ||
      (resDetail && resDetail.dimensions) ||
      dimensions,
  );
  applyRowPermissionMaps(moduleRes);
  mergeS2BaselineCellHistories(detail as unknown as Record<string, unknown>);
  if (shouldApplyCurrentStageCellDrafts()) {
    applyDraftsToDetail(cellDrafts);
  }
  if (shouldRecalculateLoadedDetailFormulas()) {
    recalculateDetailFormulas();
  }
  syncS5MainSelectionLockState();
  syncActiveMatrixState();
}

function logRevenueModuleLoad(
  phase: string,
  trace: Record<string, unknown>,
  _arg2?: unknown,
) {
  const now = getModuleTraceNow();
  const wallAt = Date.now();

  console.groupCollapsed(
    `[收益模块加载] ${phase} ${formatModuleTraceTime(wallAt)} ` +
      `${safeText(trace.page, "-")} / ${safeText(trace.moduleName || trace.moduleKey, "-")}`,
  );

  console.log("页面", trace.page || "-");

  console.log("模块", trace.moduleName || trace.moduleKey || "-");

  console.log(
    "开始时间",
    trace.startedWallAt
      ? formatModuleTraceTime(Number(trace.startedWallAt))
      : "-",
  );

  console.log(
    phase === "开始" ? "当前时间" : "返回时间",
    formatModuleTraceTime(wallAt),
  );

  console.log(
    "耗时(ms)",
    trace.startedAt != null ? Math.round(now - Number(trace.startedAt)) : 0,
  );

  console.log(
    "subjectIds数量",
    Array.isArray(trace.subjectIds) ? trace.subjectIds.length : 0,
  );

  console.log("详情", detail || {});
  if (_arg2) {
    console.log("附加信息", _arg2);
  }

  console.groupEnd();
}

const loadSingleAuditModule = async (
  query: Record<string, unknown>,
  plan: ModuleLoadPlan,
  options: Record<string, unknown> = {},
) => {
  const moduleKey = resolveModuleKey(plan);
  if (!moduleKey || !Array.isArray(plan.subjectIds) || !plan.subjectIds.length)
    return false;
  const trace = {
    page: isMainDomain.value
      ? "/revenue/main-table-audit-detail"
      : "/revenue/subtable-audit-detail",
    moduleKey,
    moduleName: plan.moduleName || plan.rootSubjectName || plan.name || "",
    subjectIds: plan.subjectIds,
    startedAt: getModuleTraceNow(),
    startedWallAt: Date.now(),
  };
  setModuleLoadState(plan, {
    status: "loading",
    message: `${trace.moduleName || "当前模块"}数据加载中`,
  });
  logRevenueModuleLoad("开始", trace);
  try {
    const moduleRes = await fetchRevenueAuditModuleRecords({
      ...query,
      moduleKey,
      moduleName: trace.moduleName,
      subjectIds: plan.subjectIds,
      subjectTreePayload: moduleSubjectTreePayload.value,
      patternList: modulePatternList.value,
      loadedRecords: collectLoadedModuleRecords(moduleKey),
      mainPreviewDetail: detail,
      deferMainPreview: shouldDeferModuleMainPreview(),
      selectedSourceStage: isMainSourceSwitchStage.value
        ? selectedMainSourceStage.value
        : undefined,
      decisionApprovalMode: isS5DecisionApprovalStage.value,
      recordStatus: isS5DecisionApprovalStage.value ? "ARCHIVED" : undefined,
    });
    if (options.runId && Number(options.runId) !== moduleLoadRunId.value)
      return null;
    moduleRecordMap[moduleKey] = Array.isArray(moduleRes.records)
      ? moduleRes.records
      : [];
    applyAuditModuleDetail(moduleRes);
    setModuleLoadState(plan, {
      status: "loaded",
      message: "",
      loadedAt: Date.now(),
    });
    logRevenueModuleLoad("完成", trace, {
      recordCount: Array.isArray(moduleRes.records)
        ? moduleRes.records.length
        : 0,
    });
    return true;
  } catch (error) {
    if (options.runId && Number(options.runId) !== moduleLoadRunId.value)
      return null;
    const message = String(
      (error && (error as Record<string, unknown>).message) ||
        `${trace.moduleName || "当前模块"}数据加载失败`,
    );
    setModuleLoadState(plan, {
      status: "error",
      message,
      error: error as Error,
    });
    logRevenueModuleLoad("失败", trace, { error });
    return false;
  }
};

const loadAuditModulesSerially = async (
  shellQuery: Record<string, unknown>,
) => {
  const plans = Array.isArray(moduleLoadPlan.value) ? moduleLoadPlan.value : [];
  if (!plans.length) return;
  const runId = ++moduleLoadRunId.value;
  const startedAt = getModuleTraceNow();
  const startedWallAt = Date.now();
  let successCount = 0;
  let errorCount = 0;
  for (let index = 0; index < plans.length; index += 1) {
    if (runId !== moduleLoadRunId.value) return;

    const result = await loadSingleAuditModule(shellQuery, plans[index], {
      runId,
    });
    if (result === true) successCount += 1;
    if (result === false) errorCount += 1;
  }
  logRevenueModuleLoad(
    "全部完成",
    {
      page: isMainDomain.value
        ? "/revenue/main-table-audit-detail"
        : "/revenue/subtable-audit-detail",
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
};

const refreshDeferredMainPreview = async (
  shellQuery: Record<string, unknown>,
) => {
  if (!shouldDeferModuleMainPreview()) return;
  if (hasModuleLoadErrors.value) return;
  try {
    const previewRes = await refreshSubtableMainPreview({
      ...shellQuery,
      userId: currentUser.value,
      stageCode: detail.stageCode,
      auditPayload: buildCurrentAuditPayload(),
      mainPreviewDetail: detail,
    });
    applyAuditModuleDetail(previewRes);
  } catch (_error) {
    BaseToast.warning("主表预览生成失败，已保留当前子表数据展示");
  }
};

const retryLoadModule = async (module: Record<string, unknown>) => {
  const key = resolveModuleKey(module);
  const plan = (moduleLoadPlan.value || []).find(
    (item) => resolveModuleKey(item) === key,
  );
  if (!plan || isModuleLoading(plan)) return;
  const result = await loadSingleAuditModule(moduleBaseQuery.value || {}, plan);
  if (result === true) {
    await refreshStageCompletionSummary();
  }
};

const loadPage = async () => {
  const requestSeq = loadPageRequestSeq.value + 1;
  loadPageRequestSeq.value = requestSeq;
  lastLoadedRouteFullPath.value = route.fullPath;
  loading.value = true;
  try {
    const query = buildQueryPayload();
    if (!query.projectId) {
      throw new Error("当前链接缺少项目 ID，请从收益流程列表重新进入");
    }
    const requestedStage = String(queryStage.value || "")
      .trim()
      .toUpperCase();
    const isS5DecisionApprovalRequest = isS5DecisionApprovalStage.value;
    const isMainSourceSwitchRequest =
      isMainSourceSwitchStage.value &&
      isMainDomain.value &&
      ["S5", "S7"].includes(requestedStage) &&
      !isS5DecisionApprovalRequest;
    if (isMainSourceSwitchRequest) {
      ensureSelectedMainSourceStage(requestedStage);
    }
    const shellQuery = {
      ...query,
      selectedSourceStage: isMainSourceSwitchRequest
        ? selectedMainSourceStage.value
        : undefined,
      decisionApprovalMode: isS5DecisionApprovalRequest,
    };
    console.groupCollapsed("%c[S2加载诊断] Shell 请求参数 + 返回", "color:#d97706;font-weight:bold");
    console.log("shellQuery:", JSON.parse(JSON.stringify(shellQuery)));
    console.log("queryIsSuperAdmin:", queryIsSuperAdmin.value, "hasAllPermission:", hasAllPermission.value, "authStore.isSuperAdmin:", authStore.isSuperAdmin);
    console.log("readonlyAuthorizedScope(传入shell):", shellQuery.readonlyAuthorizedScope);
    moduleBaseQuery.value = shellQuery;
    const loadShellDetail = isS5DecisionApprovalRequest
      ? fetchMainTableDecisionApprovalDetail
      : isMainValueSelectionStage.value
        ? fetchMainTableVersionSelectionDetail
        : fetchRevenueAuditShell;
    const detailRes = await loadShellDetail(shellQuery);
    console.log("Shell 返回 detailRes:", {
      project: detailRes.project || null,
      detail_rows_count: (detailRes.detail && Array.isArray(detailRes.detail.rows)) ? detailRes.detail.rows.length : 0,
      detail_status: detailRes.detail?.status || "",
      detail_stage: detailRes.detail?.stage || detailRes.detail?.currentStage || "",
      moduleLoadPlan_count: Array.isArray(detailRes.moduleLoadPlan) ? detailRes.moduleLoadPlan.length : 0,
      moduleLoadPlan_summary: (detailRes.moduleLoadPlan || []).slice(0, 20).map((m: Record<string, unknown>) => ({
        key: m.key, moduleName: m.moduleName, subjectIdCount: m.subjectIdCount || 0
      })),
      subjectTreePayload_leaves_count: (() => {
        try {
          const n = (detailRes.subjectTreePayload?.data?.subjects || []).length;
          return n;
        } catch { return -1; }
      })(),
      fillDetail_null: detailRes.fillDetail == null,
      fillDetail_dimensions: (detailRes.fillDetail && detailRes.fillDetail.dimensions) ? JSON.parse(JSON.stringify(detailRes.fillDetail.dimensions)) : null,
      mainSnapshot_null: !(detailRes.detail?.mainSnapshot || detailRes.detail?.mainSnapshotRows),
      mainSnapshotRows_count: Array.isArray(detailRes.detail?.mainSnapshotRows) ? detailRes.detail.mainSnapshotRows.length : 0,
    });
    // ===== [S2加载诊断] detail.rows 关键检查 =====
    const shellRows = (detailRes.detail && Array.isArray(detailRes.detail.rows)) ? detailRes.detail.rows as unknown[] : [];
    const rowIdSample = shellRows.slice(0, 5).map((r, i) => {
      const ro = r as Record<string, unknown> || {};
      return {
        i,
        id: ro.id ?? null,
        hasId: ro.id != null,
        subjectId: ro.subjectId ?? null,
        moduleKey: ro.moduleKey ?? ((ro.module && typeof ro.module === "object") ? (ro.module as Record<string, unknown>).key : null) ?? null,
        subjectName: ro.subjectName ?? ro.name ?? null,
        rowCode: ro.rowCode ?? ro.code ?? null,
        cellKeys_count: ro.cells ? Object.keys(ro.cells as Record<string, unknown>).length : 0,
      };
    });
    console.log("[S2加载诊断] detail.rows 抽样(前5个):", rowIdSample);
    const withIdCount = shellRows.filter((r) => (r as Record<string, unknown>)?.id != null).length;
    console.log("[S2加载诊断] detail.rows 总数量 =", shellRows.length, "其中有 row.id 的 =", withIdCount);
    // 分组预览
    try {
      const shellModules = buildRevenueModuleSections(shellRows) as unknown[] || [];
      console.log("[S2加载诊断] buildRevenueModuleSections(shellRows) =",
        shellModules.map((m) => {
          const mo = m as Record<string, unknown> || {};
          return {
            moduleKey: mo.moduleKey ?? mo.key ?? null,
            moduleName: mo.moduleName ?? mo.name ?? null,
            rows_count: Array.isArray(mo.rows) ? mo.rows.length : 0,
          };
        })
      );
      // 计算 canViewRow 模拟
      const cvsr = auditAccessPolicy.value.rowScope === AUDIT_ROW_SCOPE.ALL ? "ALL" : "RESPONSIBLE_SUBJECTS";
      console.log("[S2加载诊断] admin权限诊断:", {
        queryIsSuperAdmin: queryIsSuperAdmin.value,
        hasAllPermission: hasAllPermission.value,
        authStore_superAdmin: authStore.isSuperAdmin,
        effectiveRowScope: effectiveRowScope.value,
        usesResponsibleSubjectScope: usesResponsibleSubjectScope.value,
        rowScope: cvsr,
        _canViewAllRows: _canViewAllRows.value,
        queryReadonlyAuthorizedScope: queryReadonlyAuthorizedScope.value,
        canViewAudit: canViewAudit.value,
        visibleRowMap_keys: Object.keys(visibleRowMap).length,
      });
      // 抽样 canViewRow 返回
      const canViewSample = shellRows.slice(0, 8).map((r, i) => {
        const ro = r as MatrixRow;
        const hasRow = !!(r && (r as Record<string, unknown>).id != null);
        return {
          i,
          id: hasRow ? String((ro as unknown as Record<string, unknown>).id) : null,
          canViewRow: hasRow ? canViewRow(ro) : "NO_ID/NULL",
          isReadonlySubtableMainPreviewRow: hasRow ? isReadonlySubtableMainPreviewRow(ro) : null,
          isReadonlyMainDomainReferenceRow: hasRow ? isReadonlyMainDomainReferenceRow(ro) : null,
        };
      });
      console.log("[S2加载诊断] canViewRow 抽样(前8行):", canViewSample);
    } catch (_e) {
      console.warn("[S2加载诊断] 抽样异常", _e);
    }
    console.groupEnd();
    if (requestSeq !== loadPageRequestSeq.value) return;
    Object.assign(project, detailRes.project || project);
    Object.assign(detail, detailRes.detail || detail);
    initializeModuleLoading(detailRes);
    currentUser.value =
      queryUserId.value ||
      (detailRes.permissions && detailRes.permissions.viewer) ||
      currentUser.value ||
      authStore.currentUser?.id ||
      "";
    currentUserName.value =
      queryUserName.value || currentUserName.value || currentUser.value || "-";
    Object.assign(
      dimensions,
      (detailRes.fillDetail && detailRes.fillDetail.dimensions) ||
        (detailRes.detail && detailRes.detail.dimensions) ||
        dimensions,
    );
    if (isMeetingNoticeStage.value) {
      await loadMeetingNoticeInfo();
      if (requestSeq !== loadPageRequestSeq.value) return;
    }
    applyRowPermissionMaps(detailRes);
    syncS5MainSelectionLockState();
    syncActiveMatrixState();
    // 模块提交进度/时间线按 flow 拉全量已归档意见，不按当前审核人过滤；
    // 单元格草稿等可写数据仍可按 owner 收敛；可编/可交由权限与科目授权单独控制。
    const listOptions = {
      includeReviewerFilter: false,
      ...(showStageFinalSubmitAction.value
        ? {
            includeOwnerFilter: false,
            includeOwnerPermissionFilter: false,
          }
        : {}),
    };
    const skipAuditLists =
      isMeetingNoticeStage.value || queryReadonlyAuthorizedScope.value;

    let histories: Record<string, unknown> = {};
    let auxiliaryState: Record<string, unknown> = {};
    let moduleReviewState: Record<string, unknown> = {};
    const useLocalCellHistories = shouldUseLocalS2CellHistories();
    const subjectIds = collectModulePlanSubjectIds();
    try {
      [auxiliaryState, histories] = await Promise.all([
        skipAuditLists
          ? Promise.resolve({})
          : listSubtableAuditAuxiliaryState({
              ...query,
              ...listOptions,
              userId: currentUser.value,
              stageCode: detail.stageCode,
              subjectIds,
            }),
        skipAuditLists || useLocalCellHistories
          ? Promise.resolve({})
          : listSubtableAuditCellHistories({
              ...query,
              userId: currentUser.value,
              stageCode: detail.stageCode,
              subjectIds,
            }),
      ]);
      moduleReviewState =
        ((auxiliaryState as Record<string, unknown>)
          .moduleReviewState as Record<string, unknown>) || {};
    } catch (_error) {
      BaseToast.warning("辅助审核数据加载失败，已先展示当前权限范围内的表格");
    }
    if (requestSeq !== loadPageRequestSeq.value) return;

    await loadFormulaSourceDetail(query);
    if (requestSeq !== loadPageRequestSeq.value) return;

    Object.assign(
      cellDrafts,
      (auxiliaryState as Record<string, unknown>).cellDrafts || {},
    );
    Object.assign(cellHistories, histories || {});
    replaceReactiveMap(
      moduleOpinionMap,
      isMainDomain.value
        ? {}
        : ((moduleReviewState as Record<string, unknown>).opinionMap ||
            {}) as Record<string, unknown>,
    );
    replaceReactiveMap(moduleOpinionDraftMap);
    replaceReactiveMap(
      moduleSubmitMap,
      isMainDomain.value
        ? {}
        : ((moduleReviewState as Record<string, unknown>).submitMap ||
            {}) as Record<string, unknown>,
    );
    replaceReactiveMap(moduleReeditMap);
    submitTimeline.value = isMainDomain.value
      ? []
      : (((moduleReviewState as Record<string, unknown>).timeline ||
          []) as unknown[]);
    if (!skipAuditLists && !isMainDomain.value) {
      try {
        const flowOpinion = await loadFlowOpinionTimelineEntry({
          ...query,
          userId: currentUser.value,
          stageCode: detail.stageCode,
        });
        if (requestSeq === loadPageRequestSeq.value) {
          flowOpinionItems.value = (flowOpinion && flowOpinion.items) || [];
        }
      } catch (_error) {
        flowOpinionItems.value = [];
      }
    } else {
      flowOpinionItems.value = [];
    }
    try {
      if (shouldApplyCurrentStageCellDrafts()) {
        applyDraftsToDetail(cellDrafts);
      }
      if (shouldRecalculateLoadedDetailFormulas()) {
        recalculateDetailFormulas();
      }
    } catch (_error) {
      BaseToast.warning("部分草稿或公式数据处理失败，已保留原始表格展示");
    }
    syncActiveMatrixState();
    if (requestSeq === loadPageRequestSeq.value) {
      loading.value = false;
    }
    await loadAuditModulesSerially(shellQuery);
    if (requestSeq !== loadPageRequestSeq.value) return;
    // ===== [S2加载诊断] 模块加载完成后 detail状态 =====
    console.groupCollapsed("%c[S2加载诊断] 模块加载后 final detail 状态", "color:#16a34a;font-weight:bold");
    try {
      const finalRows = Array.isArray(detail.rows) ? detail.rows : [];
      console.log("[模块加载后] detail.rows.length =", finalRows.length);
      console.log("[模块加载后] 前8行抽样:", finalRows.slice(0, 8).map((r, i) => {
        const ro = r as unknown as Record<string, unknown> || {};
        return {
          i,
          id: ro.id ?? null,
          subjectName: ro.subjectName ?? ro.name ?? null,
          moduleKey: ro.moduleKey ?? ((ro.module && typeof ro.module === "object") ? (ro.module as Record<string, unknown>).key : null) ?? null,
          cellKeys: ro.cells ? Object.keys(ro.cells as Record<string, unknown>).length : 0,
        };
      }));
      const mods = modules.value;
      console.log("[模块加载后] modules.value.length =", mods.length);
      mods.forEach((m, i) => {
        console.log(`[模块加载后] modules[${i}] moduleKey=${m.moduleKey || "?"} rows.length=${Array.isArray(m.rows) ? m.rows.length : 0}`);
      });
      console.log("[模块加载后] visibleModules.length =", visibleModules.value.length);
      visibleModules.value.forEach((m, i) => {
        console.log(`[模块加载后] visibleModules[${i}] moduleKey=${m.moduleKey || "?"} name=${m.moduleName || m.name || "?"} rows.length=${Array.isArray(m.rows) ? m.rows.length : 0}`);
      });
      if (visibleModules.value.length === 0) {
        // 深入分析原因
        const rng = mods.length ? mods[0].rows || [] : [];
        console.log("[模块加载后] modules[0].rows 前5个 canViewRow 结果:", rng.slice(0, 5).map((r, i) => ({
          i,
          id: (r as unknown as Record<string, unknown>)?.id ?? null,
          canViewRow: canViewRow(r as MatrixRow),
          canViewAudit: canViewAudit.value,
          qras: queryReadonlyAuthorizedScope.value,
          effectiveRowScope: effectiveRowScope.value,
          usesResponsibleSubjectScope: usesResponsibleSubjectScope.value,
          visMap: visibleRowMap,
        })));
      }
    } catch (_e) {
      console.warn("[S2加载诊断] 模块加载后诊断异常", _e);
    }
    console.groupEnd();
    await refreshDeferredMainPreview(shellQuery);
    if (requestSeq !== loadPageRequestSeq.value) return;
    if (!skipAuditLists) {
      try {
        const latestCellDrafts = await listSubtableAuditCellDrafts({
          ...query,
          ...listOptions,
          userId: currentUser.value,
          stageCode: detail.stageCode,
          subjectIds: collectModulePlanSubjectIds(),
        });
        if (requestSeq !== loadPageRequestSeq.value) return;
        Object.assign(cellDrafts, latestCellDrafts || {});
        if (shouldApplyCurrentStageCellDrafts()) {
          applyDraftsToDetail(cellDrafts);
        }
        if (shouldRecalculateLoadedDetailFormulas()) {
          recalculateDetailFormulas();
        }
        syncActiveMatrixState();
      } catch (_error) {
        BaseToast.warning("本阶段审核值刷新失败，已保留当前表格展示");
      }
    }
    if (requestSeq !== loadPageRequestSeq.value) return;
    await refreshStageCompletionSummary();
  } catch (error) {
    BaseToast.error(
      String((error && (error as Error).message) || "页面数据加载失败"),
    );
  } finally {
    if (requestSeq === loadPageRequestSeq.value) {
      loading.value = false;
    }
  }
};

const refreshStageCompletionSummary = async () => {
  if (!showStageFinalSubmitAction.value) {
    stageCompletionSummary.value = null;
    return;
  }
  const result = await buildStageCompletionSummary({
    ...buildQueryPayload(),
    userId: currentUser.value,
    stageCode: detail.stageCode,
    subjectApiMode: "auto",
    auditPayload: buildCurrentAuditPayload(),
  });
  stageCompletionSummary.value = result || null;
};

// resolveModuleKey / normalizeModuleScrollKey 已提取为模块级纯函数
function moduleScrollKey(module: Record<string, unknown>) {
  return normalizeModuleScrollKey(resolveModuleKey(module));
}
function scrollToModuleHeader(module: Record<string, unknown>) {
  const key = moduleScrollKey(module);
  if (
    !key ||
    !rootRef.value ||
    typeof rootRef.value.querySelectorAll !== "function"
  )
    return;
  const sections = Array.from(
    rootRef.value.querySelectorAll("[data-module-scroll-key]"),
  );
  const target = sections.find(
    (item) => item.getAttribute("data-module-scroll-key") === key,
  );
  if (!target) {
    BaseToast.warning("未定位到对应模块");
    return;
  }
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
function resolveModuleLookupKeys(module: Record<string, unknown>) {
  return [
    resolveModuleKey(module),
    module.rootSubjectId,
    module.moduleKey,
    module.key,
    module.moduleName,
    module.name,
  ]
    .map((item) => String(item || "").trim())
    .filter((item, index, list) => item && list.indexOf(item) === index);
}
function normalizeModuleViewState(state: Record<string, unknown>) {
  const mode = ["overview", "year", "trim"].includes(String(state.mode || ""))
    ? String(state.mode)
    : "year";
  const yearOptions = displayYearOptions.value;
  const fallbackYearKey = yearOptions[0] ? yearOptions[0].key : "";
  const requestedYearKey = String(state.activeYearKey || "").trim();
  const activeYearKey = yearOptions.some(
    (item) => item.key === requestedYearKey,
  )
    ? requestedYearKey
    : fallbackYearKey;
  const trims = trimOptions.value;
  const fallbackTrimId = trims[0] ? trims[0].trimId : "";
  const requestedTrimId = String(state.activeTrimId || "").trim();
  const activeTrimId = trims.some((item) => item.trimId === requestedTrimId)
    ? requestedTrimId
    : fallbackTrimId;
  return { mode, activeYearKey, activeTrimId };
}
function syncModuleViewStateMap() {
  if (!usesModuleViewMode.value) {
    replaceReactiveMap(moduleViewStateMap);
    return;
  }
  const next: Record<string, unknown> = {};
  visibleModules.value.forEach((module) => {
    const key = resolveModuleKey(module);
    if (!key) return;
    next[key] = normalizeModuleViewState(
      (moduleViewStateMap[key] || {}) as Record<string, unknown>,
    );
  });
  replaceReactiveMap(moduleViewStateMap, next);
}
function resolveModuleViewState(module: Record<string, unknown>) {
  const key = resolveModuleKey(module);
  return normalizeModuleViewState(
    ((key && moduleViewStateMap[key]) || {}) as Record<string, unknown>,
  );
}
function commitModuleViewState(
  module: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  const key = resolveModuleKey(module);
  if (!key) return;
  const next = normalizeModuleViewState({
    ...resolveModuleViewState(module),
    ...patch,
  } as Record<string, unknown>);
  moduleViewStateMap[key] = next;
}
function getModuleViewMode(module: Record<string, unknown>) {
  return resolveModuleViewState(module).mode;
}
function getModuleActiveYearKey(module: Record<string, unknown>) {
  return resolveModuleViewState(module).activeYearKey;
}
function getModuleActiveTrimId(module: Record<string, unknown>) {
  return resolveModuleViewState(module).activeTrimId;
}
function setModuleViewMode(module: Record<string, unknown>, mode: string) {
  const nextMode = ["overview", "year", "trim"].includes(String(mode || ""))
    ? String(mode)
    : "year";
  commitModuleViewState(module, { mode: nextMode });
}
function setModuleActiveYearKey(
  module: Record<string, unknown>,
  activeYearKey: string,
) {
  commitModuleViewState(module, { activeYearKey });
}
function setModuleActiveTrimId(
  module: Record<string, unknown>,
  activeTrimId: string,
) {
  commitModuleViewState(module, { activeTrimId });
}
function moduleViewRenderKey(module: Record<string, unknown>) {
  const state = resolveModuleViewState(module);
  return [state.mode, state.activeYearKey, state.activeTrimId].join("_");
}
function isYearOnlyRow(row: Record<string, unknown>) {
  return isRevenueYearOnlyRow(row);
}
function isYearOnlyModule(module: Record<string, unknown>) {
  if (!module || typeof module !== "object") return false;
  if (isRevenueYearOnlyRow(module)) return true;
  const rows: unknown[] = ([] as unknown[])
    .concat(Array.isArray(module.rows) ? module.rows : [])
    .concat(Array.isArray(module.sourceRows) ? module.sourceRows : []);
  return rows.some((row) => isYearOnlyRow(row as Record<string, unknown>));
}
function shouldShowRndAmountColumns(module: Record<string, unknown>) {
  if (isMainDomain.value) return false;
  const rows: unknown[] = ([] as unknown[])
    .concat(Array.isArray(module.rows) ? module.rows : [])
    .concat(Array.isArray(module.sourceRows) ? module.sourceRows : []);
  return rows.some((row) =>
    isRndDoubleAmountSourceRow(row as Record<string, unknown>),
  );
}
function rndAmountColumns() {
  return buildRndInvestmentAmountColumns();
}
function isRndAmountColumn(column: Record<string, unknown>) {
  return Boolean(
    column &&
    (column.rndInvestmentAmount ||
      isRndAmountCellKey(column.cellKey || column.key)),
  );
}
function decorateRndAmountColumns(
  module: Record<string, unknown>,
  columns: MatrixColumn[],
) {
  if (!shouldShowRndAmountColumns(module)) return columns;
  if (columns.some((column) => isRndAmountColumn(column))) return columns;
  return rndAmountColumns().concat(columns);
}
function isModuleOverviewMode(module: Record<string, unknown>) {
  if (isYearOnlyModule(module)) return true;
  return getModuleViewMode(module) === "overview";
}
function resolveYearOptionByKey(yearKey: unknown) {
  const key = String(yearKey || "").trim();
  return (
    displayYearOptions.value.find((item) => item.key === key) ||
    displayYearOptions.value[0] ||
    null
  );
}
function buildModuleRealColumn(
  yearOption: Record<string, unknown>,
  trim: Record<string, unknown>,
  options: Record<string, unknown>,
): MatrixColumn {
  const yearLabel = String((yearOption && yearOption.label) || "").trim();
  const yearIndex = Number.isInteger(yearOption && yearOption.yearIndex)
    ? Number(yearOption.yearIndex)
    : 0;
  const trimId = String(trim && trim.trimId != null ? trim.trimId : "").trim();
  const trimName = String(
    trim && trim.trimName != null ? trim.trimName : trimId,
  ).trim();
  const trimIndex = Number.isInteger(trim && trim.trimIndex)
    ? Number(trim.trimIndex)
    : 0;
  return {
    key: `${options.keyPrefix || "module"}_y${yearIndex}_t${trimIndex}`,
    label: String(options.label || `${yearLabel} / ${trimName}`),
    yearLabel,
    yearIndex,
    trimId,
    trimName,
    trimIndex,
    real: true,
    displayOnly: false,
    readonly: options.readonly === true,
    aggregateMode: "NONE",
  };
}
function buildYearOnlyColumns() {
  return displayYearOptions.value
    .filter((item) => item.real)
    .map((yearOption) => ({
      key: `year_only_y${yearOption.yearIndex}`,
      label: yearOption.label,
      yearLabel: yearOption.label,
      yearIndex: yearOption.yearIndex,
      trimId: "",
      trimName: "",
      trimIndex: 0,
      real: true,
      displayOnly: false,
      readonly: false,
      aggregateMode: "NONE",
      yearOnly: true,
    }));
}
function buildAllModuleRealColumns(options: Record<string, unknown>) {
  const columns: MatrixColumn[] = [];
  displayYearOptions.value
    .filter((item) => item.real)
    .forEach((yearOption) => {
      trimOptions.value.forEach((trim) => {
        columns.push(buildModuleRealColumn(yearOption, trim, options));
      });
    });
  return columns;
}
function buildModuleLifecycleColumns(options: Record<string, unknown>) {
  const sourceRows = getAggregateSourceRows();
  const allSourceColumns = buildAllModuleRealColumns({
    keyPrefix: options.keyPrefix || "lifecycle_all",
  });
  const lifecycleTrimColumns = trimOptions.value.map((trim) => {
    const sourceColumns = displayYearOptions.value
      .filter((item) => item.real)
      .map((yearOption) =>
        buildModuleRealColumn(yearOption, trim, {
          keyPrefix: options.keyPrefix || "lifecycle_source",
        }),
      );
    return buildLifecycleColumn(sourceColumns, {
      key: `${options.keyPrefix || "module"}_lifecycle_${trim.trimIndex}`,
      // 按年份选中「全生命周期」时表头用纯版型名，与普通年份列一致
      label: trim.trimName,
      trimId: trim.trimId,
      trimName: trim.trimName,
      trimIndex: trim.trimIndex,
      sourceRows,
      allSourceColumns,
    });
  });
  if (!lifecycleTrimColumns.length) return [];
  return lifecycleTrimColumns
    .concat(
      buildLifecycleSubtotalColumn(lifecycleTrimColumns, {
        key: `${options.keyPrefix || "module"}_lifecycle_subtotal`,
        label: "小计/加权",
        sourceRows,
      }),
    )
    .filter((column: MatrixColumn) => !isHiddenSubtotalColumn(column));
}
function buildModuleOverviewColumns(module: Record<string, unknown>) {
  const cols: MatrixColumn[] = [];
  const allRealColumns: MatrixColumn[] = [];
  const realYears = displayYearOptions.value.filter((item) => item.real);
  realYears.forEach((yearOption) => {
    const yearColumns = trimOptions.value.map((trim) => {
      const column = buildModuleRealColumn(yearOption, trim, {
        keyPrefix: `overview_${resolveModuleKey(module)}`,
        readonly: true,
      });
      allRealColumns.push(column);
      return column;
    });
    cols.push(...yearColumns);
    if (yearColumns.length) {
      cols.push({
        ...buildYearSubtotalColumn(
          yearOption.label,
          yearOption.yearIndex,
          yearColumns,
          {
            sourceRows: getAggregateSourceRows(),
          },
        ),
        label: `${yearOption.label} / 小计/加权`,
      });
    }
  });
  if (realYears.length > 1) {
    const lifecycleTrimColumns = trimOptions.value.map((trim) => {
      const sourceColumns = allRealColumns.filter(
        (column) => column.trimId === trim.trimId,
      );
      return buildLifecycleColumn(sourceColumns, {
        key: `overview_${resolveModuleKey(module)}_lifecycle_${trim.trimIndex}`,
        label: `全生命周期 / ${trim.trimName}`,
        trimId: trim.trimId,
        trimName: trim.trimName,
        trimIndex: trim.trimIndex,
        sourceRows: getAggregateSourceRows(),
        allSourceColumns: allRealColumns,
      });
    });
    cols.push(...lifecycleTrimColumns);
    if (lifecycleTrimColumns.length) {
      cols.push(
        buildLifecycleSubtotalColumn(lifecycleTrimColumns, {
          key: `overview_${resolveModuleKey(module)}_lifecycle_subtotal`,
          label: "全生命周期 / 小计/加权",
          sourceRows: getAggregateSourceRows(),
        }),
      );
    }
  }
  return cols.filter((column) => !isHiddenSubtotalColumn(column));
}
function buildModuleYearColumns(module: Record<string, unknown>) {
  const state = resolveModuleViewState(module);
  const yearOption = resolveYearOptionByKey(state.activeYearKey);
  if (!yearOption) return [];
  if (yearOption.lifecycle) {
    return buildModuleLifecycleColumns({
      keyPrefix: `year_${resolveModuleKey(module)}`,
    });
  }
  const sourceColumns = trimOptions.value.map((trim) =>
    buildModuleRealColumn(yearOption, trim, {
      keyPrefix: `year_${resolveModuleKey(module)}`,
      // 按年份视图：表头去掉年份前缀，仅保留版型名
      label: trim.trimName,
    }),
  );
  if (sourceColumns.length) {
    // 沿用默认「小计/加权」，不再拼接年份
    sourceColumns.push(
      buildYearSubtotalColumn(
        yearOption.label,
        yearOption.yearIndex,
        sourceColumns,
        {
          sourceRows: getAggregateSourceRows(),
        },
      ),
    );
  }
  return sourceColumns.filter((column) => !isHiddenSubtotalColumn(column));
}
function buildModuleTrimColumns(module: Record<string, unknown>) {
  const state = resolveModuleViewState(module);
  const activeTrim =
    trimOptions.value.find((item) => item.trimId === state.activeTrimId) ||
    trimOptions.value[0] ||
    null;
  if (!activeTrim) return [];
  const sourceColumns = displayYearOptions.value
    .filter((item) => item.real)
    .map((yearOption) =>
      buildModuleRealColumn(yearOption, activeTrim, {
        keyPrefix: `trim_${resolveModuleKey(module)}`,
      }),
    );
  if (sourceColumns.length > 1) {
    sourceColumns.push(
      buildLifecycleColumn(sourceColumns, {
        key: `trim_${resolveModuleKey(module)}_lifecycle_${activeTrim.trimIndex}`,
        label: `全生命周期 / ${activeTrim.trimName}`,
        trimId: activeTrim.trimId,
        trimName: activeTrim.trimName,
        trimIndex: activeTrim.trimIndex,
        sourceRows: getAggregateSourceRows(),
        allSourceColumns: buildAllModuleRealColumns({
          keyPrefix: `trim_${resolveModuleKey(module)}_all`,
        }),
      }),
    );
  }
  return sourceColumns.filter((column) => !isHiddenSubtotalColumn(column));
}
function resolveMatrixColumns(module: Record<string, unknown>) {
  if (isYearOnlyModule(module)) return buildYearOnlyColumns();
  if (!usesModuleViewMode.value)
    return decorateRndAmountColumns(module, matrixColumns.value);
  const mode = getModuleViewMode(module);
  if (mode === "overview")
    return decorateRndAmountColumns(module, buildModuleOverviewColumns(module));
  if (mode === "trim")
    return decorateRndAmountColumns(module, buildModuleTrimColumns(module));
  return decorateRndAmountColumns(module, buildModuleYearColumns(module));
}
function buildMainYearColumns() {
  const yearOption = resolveYearOptionByKey(activeYearKey.value);
  if (!yearOption) return [];
  if (yearOption.lifecycle) {
    return buildModuleLifecycleColumns({
      keyPrefix: "main_year",
    });
  }
  const sourceColumns = trimOptions.value.map((trim) =>
    buildModuleRealColumn(yearOption, trim, {
      keyPrefix: "main_year",
      // 主表按年份视图：表头去掉年份前缀，仅保留版型名
      label: trim.trimName,
    }),
  );
  if (sourceColumns.length) {
    // 沿用默认「小计/加权」，不再拼接年份
    sourceColumns.push(
      buildYearSubtotalColumn(
        yearOption.label,
        yearOption.yearIndex,
        sourceColumns,
        {
          sourceRows: getAggregateSourceRows(),
        },
      ),
    );
  }
  return sourceColumns.filter((column) => !isHiddenSubtotalColumn(column));
}
function buildMainTrimColumns() {
  const activeTrim =
    trimOptions.value.find((item) => item.trimId === activeTrimId.value) ||
    trimOptions.value[0] ||
    null;
  if (!activeTrim) return [];
  const sourceColumns = displayYearOptions.value
    .filter((item) => item.real)
    .map((yearOption) =>
      buildModuleRealColumn(yearOption, activeTrim, {
        keyPrefix: "main_trim",
      }),
    );
  if (sourceColumns.length > 1) {
    sourceColumns.push(
      buildLifecycleColumn(sourceColumns, {
        key: `main_trim_lifecycle_${activeTrim.trimIndex}`,
        label: `全生命周期 / ${activeTrim.trimName}`,
        trimId: activeTrim.trimId,
        trimName: activeTrim.trimName,
        trimIndex: activeTrim.trimIndex,
        sourceRows: getAggregateSourceRows(),
        allSourceColumns: buildAllModuleRealColumns({
          keyPrefix: "main_trim_all",
        }),
      }),
    );
  }
  return sourceColumns.filter((column) => !isHiddenSubtotalColumn(column));
}
function resolveMainMatrixColumns() {
  if (mainViewMode.value === "overview") {
    return buildModuleOverviewColumns({ moduleKey: "main_table" });
  }
  if (mainViewMode.value === "trim") return buildMainTrimColumns();
  return buildMainYearColumns();
}
function readModuleMap(
  map: Record<string, unknown> = {},
  module: Record<string, unknown> = {},
) {
  // 对齐 Vue2：参数顺序为 (map, module)
  const keys = resolveModuleLookupKeys(module);
  for (let index = 0; index < keys.length; index += 1) {
    // 使用 "key in map" 而非 Object.prototype.hasOwnProperty.call，
    // 让 Vue3 reactive Proxy 的 has 陷阱正确追踪依赖，保证提交后禁用态能刷新
    if (keys[index] in map) {
      return map[keys[index]];
    }
  }
  return undefined;
}
// displayUiText 已提取为模块级纯函数
// normalizeLocalText 已提取为模块级纯函数
function isMainPreviewRow(row: Record<string, unknown>) {
  if (!row || typeof row !== "object") return false;
  if (row.mainPreviewReadonly === true) return true;
  const moduleCode = normalizeLocalText(row.moduleCode);
  if (moduleCode === REVENUE_MODULE_CODE.MAIN_PNL) return true;
  const moduleName = normalizeLocalText(
    row.moduleName || row.subtable || row.rootSubjectName,
  );
  if (moduleName === "主表") return true;
  const path = normalizeLocalText(
    row.fullNamePath ||
      row.subjectPath ||
      row.fullPath ||
      row.path ||
      [row.rootSubjectName, row.subtable, row.subject]
        .filter(Boolean)
        .join("/"),
  );
  return (
    path === "主表" ||
    path.indexOf("主表/") === 0 ||
    path.indexOf("单车收益/") === 0 ||
    path.indexOf("项目利润/") === 0
  );
}
function isMainPreviewModule(module: Record<string, unknown>) {
  if (!module || typeof module !== "object") return false;
  const moduleCode = normalizeLocalText(
    module.moduleCode || module.moduleKey || module.key,
  );
  if (moduleCode === REVENUE_MODULE_CODE.MAIN_PNL) return true;
  const moduleName = normalizeLocalText(
    module.name || module.moduleName || module.rootSubjectName,
  );
  if (moduleName === "主表") return true;
  const rows: unknown[] = ([] as unknown[])
    .concat(Array.isArray(module.rows) ? module.rows : [])
    .concat(Array.isArray(module.sourceRows) ? module.sourceRows : []);
  return rows.some((row) => isMainPreviewRow(row as Record<string, unknown>));
}
function isReadonlySubtableMainPreviewRow(row: Record<string, unknown>) {
  return isSubtableDomain.value && isMainPreviewRow(row);
}
function isReadonlySubtableMainPreviewModule(module: Record<string, unknown>) {
  return isSubtableDomain.value && isMainPreviewModule(module);
}
function shouldHideCurrentRoleModule(module: Record<string, unknown>) {
  if (
    shouldHideGroupDeptMainPreview.value &&
    isReadonlySubtableMainPreviewModule(module)
  ) {
    return true;
  }
  return false;
}
function isReadonlyMainDomainReferenceRow(row: Record<string, unknown>) {
  return isMainDomain.value && !isMainPreviewRow(row);
}
function isReadonlyMainDomainReferenceModule(module: Record<string, unknown>) {
  return isMainDomain.value && !isMainPreviewModule(module);
}
function resolveModuleTitleNotice(module: Record<string, unknown>) {
  return resolveRevenueModuleTitleNotice(module);
}
function writeModuleMap(
  mapName: string,
  module: Record<string, unknown>,
  value: unknown,
) {
  const maps: Record<string, Record<string, unknown>> = {
    moduleOpinionDraftMap,
    moduleReeditMap,
    moduleOpinionMap,
  };
  const map = maps[mapName];
  if (!map) return;
  const keys = resolveModuleLookupKeys(module);
  keys.forEach((key) => {
    map[key] = value;
  });
}
function deleteModuleMap(mapName: string, module: Record<string, unknown>) {
  const maps: Record<string, Record<string, unknown>> = {
    moduleOpinionDraftMap,
    moduleReeditMap,
    moduleOpinionMap,
  };
  const map = maps[mapName];
  if (!map) return;
  resolveModuleLookupKeys(module).forEach((key) => {
    if (key in map) delete map[key];
  });
}
function resolveModuleOpinion(module: Record<string, unknown>) {
  const draft = readModuleMap(moduleOpinionDraftMap, module);
  if (draft !== undefined) return String(draft || "");
  const saved = readModuleMap(moduleOpinionMap, module);
  return String(saved || "");
}
function setModuleOpinion(module: Record<string, unknown>, value: unknown) {
  writeModuleMap("moduleOpinionDraftMap", module, value);
}
function resolvePriorOpinionsForModule(module: Record<string, unknown>) {
  const currentStageCode = (detail && detail.stageCode) || queryStage.value;
  const source: Record<string, unknown> =
    module && typeof module === "object" ? module : {};
  const identity = {
    moduleKey: String(source.moduleKey || source.key || "").trim(),
    rootSubjectId: String(
      source.rootSubjectId || source.displayRootSubjectId || "",
    ).trim(),
    moduleName: String(
      source.moduleName || source.name || source.rootSubjectName || "",
    ).trim(),
  };
  return buildModulePriorOpinionCards(
    flowOpinionItems.value,
    identity,
    currentStageCode,
  );
}
function resolveModuleSubmit(module: Record<string, unknown>) {
  return readModuleMap(moduleSubmitMap, module);
}
function isModuleSubmitted(module: Record<string, unknown>) {
  return Boolean(resolveModuleSubmit(module));
}
function isModuleReediting(module: Record<string, unknown>) {
  return Boolean(readModuleMap(moduleReeditMap, module));
}
function enableModuleReedit(module: Record<string, unknown>) {
  if (!isModuleSubmitted(module) || isSubmitBlocking.value) return;
  writeModuleMap("moduleReeditMap", module, true);
}
function clearModuleReedit(module: Record<string, unknown>) {
  deleteModuleMap("moduleReeditMap", module);
}
function resolveModuleStateText(module: Record<string, unknown>) {
  if (isMeetingNoticeStage.value) return "只读";
  if (isMainReadonlyPreviewStage.value) return "只读预览";
  if (isReadonlySubtableMainPreviewModule(module)) return "只读预览";
  if (isReadonlyMainDomainReferenceModule(module)) return "只读参考";
  if (isMainValueSelectionStage.value) return "可改值";
  if (isMainDomain.value) return "审核中";
  if (isModuleSubmitted(module)) {
    return isModuleReediting(module) ? "已提交（编辑中）" : "已提交";
  }
  return "待处理";
}
function resolveModuleOpinionTitle(module: Record<string, unknown>) {
  const moduleName = displayUiText(module.name || "-");
  if (isMainDomain.value) {
    if (isReadonlyMainDomainReferenceModule(module))
      return `前序意见（${moduleName}）`;
    return `主表值确认（${moduleName}）`;
  }
  return isBrandFinancePreviewStage.value
    ? `子表预览意见（${moduleName}）`
    : `子表审核意见（${moduleName}）`;
}
function resolveModuleSubmitText(module: Record<string, unknown>) {
  if (isMainDomain.value) return "保存审核意见";
  return isModuleSubmitted(module) ? "重新提交" : moduleSubmitText.value;
}
// 构建 S2 固定 8 子表进度卡片：优先 moduleSubmitMap，完成清单作补充
function buildS2ModuleProgressCards() {
  const moduleList = Array.isArray(modules.value) ? modules.value : [];
  const completionRows = Array.isArray(stageCompletionRows.value) ? stageCompletionRows.value : [];

  return (S2_MODULE_PROGRESS_CODES as unknown[]).map((moduleCodeVal, index) => {
    const moduleCode = String(moduleCodeVal || "");
    const aliases = Array.isArray(
      (REVENUE_MODULE_NAME_ALIASES as Record<string, unknown>)[moduleCode]
    )
      ? ((REVENUE_MODULE_NAME_ALIASES as Record<string, unknown>)[moduleCode] as unknown[])
      : [];
    const label = (aliases[0] as string) || moduleCode;
    const module = findS2ProgressModule(moduleList, moduleCode, aliases) as Record<string, unknown> | null;
    const completion = findS2ProgressCompletion(completionRows, module, aliases, label) as Record<string, unknown> | null;
    const submitEntry = resolveS2ProgressSubmitEntry(module, moduleCode, aliases);
    const submittedFromMap = Boolean(
      submitEntry && (submitEntry === true || (submitEntry as Record<string, unknown>).submitted !== false)
    );
    const submittedFromCompletion = Boolean(
      completion &&
        ((completion as Record<string, unknown>).submitted === true ||
          (completion as Record<string, unknown>).status === "已提交")
    );
    const submitted = submittedFromMap || submittedFromCompletion;
    const submitRecord = (
      submitEntry && typeof submitEntry === "object"
        ? submitEntry
        : {}
    ) as Record<string, unknown>;
    const completionObj = (completion || {}) as Record<string, unknown>;
    const submittedAt = safeText(submitRecord.submittedAt || completionObj.submittedAt);
    const submittedBy = safeText(submitRecord.submittedBy || completionObj.submittedBy);
    const scrollTarget = module || {
      key: moduleCode,
      moduleKey: moduleCode,
      moduleCode,
      name: label,
      moduleName: label,
      rootSubjectId: completionObj.rootSubjectId,
    };
    const statusText = submitted ? "已提交" : "未提交";
    const tipParts = [label, statusText];
    if (submittedBy) tipParts.push(submittedBy);
    if (submittedAt) tipParts.push(submittedAt);

    return {
      code: moduleCode,
      index: index + 1,
      label,
      submitted,
      statusText,
      submittedAt,
      submittedBy,
      scrollTarget,
      cardTooltip: tipParts.join(" / "),
    };
  });
}
function findS2ProgressModule(
  modulesArr: unknown[] = [],
  moduleCode = "",
  aliases: unknown[] = []
) {
  const code = safeText(moduleCode);
  const aliasSet = new Set(
    (aliases || []).map((item) => safeText(item)).filter(Boolean)
  );
  return (Array.isArray(modulesArr) ? modulesArr : []).find((item) => {
    if (!item || typeof item !== "object") return false;
    const obj = item as Record<string, unknown>;
    if (safeText(obj.moduleCode) === code) return true;
    const name = safeText(obj.name || obj.moduleName || obj.rootSubjectName);
    return Boolean(name && aliasSet.has(name));
  }) || null;
}
function findS2ProgressCompletion(
  completionRowsArr: unknown[] = [],
  module: Record<string, unknown> | null = null,
  aliases: unknown[] = [],
  label = ""
) {
  const moduleObj = module || ({} as Record<string, unknown>);
  const moduleFields: unknown[] = moduleObj
    ? [
        moduleObj.name,
        moduleObj.moduleName,
        moduleObj.rootSubjectName,
        moduleObj.key,
        moduleObj.moduleKey,
        moduleObj.rootSubjectId,
      ]
    : [];
  const all = ([label] as unknown[])
    .concat(aliases || [])
    .concat(moduleFields);
  const aliasSet = new Set(
    all
      .map((item) => safeText(item))
      .filter(Boolean)
  );
  return (Array.isArray(completionRowsArr) ? completionRowsArr : []).find((row) => {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    const keys = [r.key, r.rootSubjectId, r.name]
      .map((item) => safeText(item))
      .filter(Boolean);
    return keys.some((key) => aliasSet.has(key));
  }) || null;
}
function resolveS2ProgressSubmitEntry(
  module: Record<string, unknown> | null = null,
  moduleCode = "",
  aliases: unknown[] = []
) {
  if (module && typeof module === "object") {
    const entry = resolveModuleSubmit(module);
    if (entry) return entry;
  }
  const probes = ([moduleCode] as unknown[])
    .concat(aliases || [])
    .map((item) => safeText(item))
    .filter(Boolean);
  for (let index = 0; index < probes.length; index += 1) {
    const key = probes[index];
    const entry = readModuleMap(
      moduleSubmitMap as Record<string, unknown>,
      {
        key,
        moduleKey: key,
        moduleCode: key,
        name: key,
        moduleName: key,
      },
    );
    if (entry) return entry;
  }
  return undefined;
}
function shouldShowModuleOpinionCard(module: Record<string, unknown>) {
  if (isMeetingNoticeStage.value) return false;
  if (isMainDomain.value) {
    return false;
  }
  if (isReadonlySubtableMainPreviewModule(module)) return false;
  return true;
}
function shouldShowModuleOpinionSave(_module: Record<string, unknown>) {
  return false;
}
function shouldShowModuleOpinionEditor(_module: Record<string, unknown>) {
  if (isMainDomain.value) return false;
  return true;
}
function normalizeRowScope() {
  if (!showScopeSwitch.value) {
    rowScope.value = usesResponsibleSubjectScope.value ? "mine" : "all";
    return;
  }
  if (rowScope.value !== "mine" && rowScope.value !== "all") {
    rowScope.value = "all";
  }
}
function parseCellKey(cellKey: unknown) {
  const match = /^y(\d+)_t(\d+)$/.exec(String(cellKey || "").trim());
  if (!match) return null;
  return {
    yearIndex: Number(match[1]),
    trimIndex: Number(match[2]),
  };
}
function resolveColumnCellKey(column: Record<string, unknown>) {
  if (column && column.cellKey) return String(column.cellKey || "").trim();
  return getCellKey(column && column.trimIndex, column && column.yearIndex);
}
function findDetailRow(rowOrId: unknown) {
  const rowId = String(
    rowOrId && typeof rowOrId === "object"
      ? (rowOrId as Record<string, unknown>).id
      : rowOrId,
  ).trim();
  const rows = Array.isArray(detail.rows) ? detail.rows : [];
  return rows.find((row) => String(row && row.id).trim() === rowId) || null;
}
function getCellDimension(cellKey: unknown) {
  const parsed = parseCellKey(cellKey);
  if (!parsed) return null;
  const years = dimensions.years || [];
  const trims = dimensions.trims || [];
  const yearLabel = years[parsed.yearIndex] || "";
  const trimName = trims[parsed.trimIndex] || "";
  if (!yearLabel || !trimName) return null;
  return {
    ...parsed,
    yearLabel,
    trimName,
    dimensionKey: `${yearLabel}__${trimName}`,
  };
}
function snapshotDetailCellValue(rowOrId: unknown, cellKey: unknown) {
  const row = findDetailRow(rowOrId);
  if (!row) return null;
  const dimension = getCellDimension(cellKey);
  const cellMapKey = dimension && dimension.dimensionKey;
  const rowRecord = row as Record<string, unknown>;
  const cellKeyText = String(cellKey ?? "");
  const cells = rowRecord.cells as Record<string, unknown> | undefined;
  const cellMap = rowRecord.cellMap as Record<string, unknown> | undefined;
  const formulaLockedCellMap = rowRecord.formulaLockedCellMap as
    | Record<string, unknown>
    | undefined;
  return {
    rowId: row.id,
    cellKey,
    cellMapKey,
    hadCell: Boolean(
      cells && Object.prototype.hasOwnProperty.call(cells, cellKeyText),
    ),
    cellValue: cells && cells[cellKeyText],
    hadCellMapValue: Boolean(
      cellMapKey &&
      cellMap &&
      Object.prototype.hasOwnProperty.call(cellMap, cellMapKey),
    ),
    cellMapValue: cellMapKey && cellMap && cellMap[cellMapKey],
    hadFormulaLock: Boolean(
      formulaLockedCellMap &&
      Object.prototype.hasOwnProperty.call(formulaLockedCellMap, cellKeyText),
    ),
    formulaLockValue: formulaLockedCellMap && formulaLockedCellMap[cellKeyText],
  };
}
function restoreDetailCellValueSnapshot(snapshot: Record<string, unknown>) {
  if (!snapshot) return false;
  const row = findDetailRow(snapshot.rowId);
  if (!row) return false;
  if (!row.cells || typeof row.cells !== "object") {
    row.cells = {};
  }
  const cells = row.cells as Record<string, unknown>;
  const cellKeyText = String(snapshot.cellKey ?? "");
  if (snapshot.hadCell) {
    cells[cellKeyText] = snapshot.cellValue;
  } else {
    delete cells[cellKeyText];
  }
  if (snapshot.cellMapKey) {
    if (!row.cellMap || typeof row.cellMap !== "object") {
      row.cellMap = {};
    }
    const cellMap = row.cellMap as Record<string, unknown>;
    const cellMapKeyText = String(snapshot.cellMapKey);
    if (snapshot.hadCellMapValue) {
      cellMap[cellMapKeyText] = snapshot.cellMapValue;
    } else {
      delete cellMap[cellMapKeyText];
    }
  }
  if (
    !row.formulaLockedCellMap ||
    typeof row.formulaLockedCellMap !== "object"
  ) {
    row.formulaLockedCellMap = {};
  }
  const formulaLockedCellMap = row.formulaLockedCellMap as Record<
    string,
    unknown
  >;
  if (snapshot.hadFormulaLock) {
    formulaLockedCellMap[cellKeyText] = snapshot.formulaLockValue;
  } else {
    delete formulaLockedCellMap[cellKeyText];
  }
  return true;
}
function writeDetailCellValue(
  rowOrId: unknown,
  cellKey: unknown,
  value: unknown,
) {
  const row = findDetailRow(rowOrId);
  if (!row) return false;
  if (!row.cells || typeof row.cells !== "object") {
    row.cells = {};
  }
  const cells = row.cells as Record<string, unknown>;
  const cellKeyText = String(cellKey ?? "");
  cells[cellKeyText] = value;
  if (cellKeyText === RND_INVESTMENT_TAX_INCLUDED_CELL_KEY) {
    cells[RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY] = value;
  }
  if (cellKeyText === RND_INVESTMENT_TAX_EXCLUDED_CELL_KEY) {
    cells[RND_INVESTMENT_TAX_INCLUDED_CELL_KEY] = value;
  }
  if (
    !row.formulaLockedCellMap ||
    typeof row.formulaLockedCellMap !== "object"
  ) {
    row.formulaLockedCellMap = {};
  }
  const formulaLockedCellMap = row.formulaLockedCellMap as Record<
    string,
    unknown
  >;
  formulaLockedCellMap[cellKeyText] = true;
  const dimension = getCellDimension(cellKey);
  if (dimension) {
    if (!row.cellMap || typeof row.cellMap !== "object") {
      row.cellMap = {};
    }
    const cellMap = row.cellMap as Record<string, unknown>;
    cellMap[cellKeyText] = value;
  }
  return true;
}
// normalizeLocalId / normalizeLocalIdList 已提取为模块级纯函数
function mergeSavedCellTargetIds(
  target: Record<string, unknown>,
  result: Record<string, unknown>,
) {
  const append = (
    current: unknown = [],
    next: unknown = [],
  ): (number | null)[] => {
    const values = normalizeLocalIdList(current);
    normalizeLocalIdList(next).forEach((id) => {
      if (!values.includes(id)) values.push(id);
    });
    return values;
  };
  const targetRecordIds = append(
    [target.targetRecordIds, target.recordIds, target.recordId, target.id],
    [result.targetRecordIds, result.affectedRecordIds, result.recordId],
  );
  const targetSubmitIds = append(
    [target.targetSubmitIds, target.submitIds, target.submitId],
    [result.targetSubmitIds, result.submitIds, result.submitId],
  );
  return {
    targetRecordIds,
    targetSubmitIds,
    recordId: targetRecordIds[0],
    id: targetRecordIds[0],
    submitIds: targetSubmitIds,
    submitId: targetSubmitIds[0],
  };
}
function rememberSavedCellTarget(
  rowOrId: unknown,
  column: Record<string, unknown>,
  result: Record<string, unknown>,
) {
  const row = findDetailRow(rowOrId);
  if (!row || !column || !result) return false;
  const savedTarget = mergeSavedCellTargetIds(
    (resolveCellTarget(row, column) || {}) as Record<string, unknown>,
    result,
  );
  if (
    !savedTarget.targetRecordIds.length &&
    !savedTarget.targetSubmitIds.length
  )
    return false;

  const cellKey = resolveColumnCellKey(column);
  if (!row.cellTargetMap || typeof row.cellTargetMap !== "object") {
    row.cellTargetMap = {};
  }
  const cellTargetMap = row.cellTargetMap as Record<string, unknown>;
  cellTargetMap[cellKey] = {
    ...savedTarget,
    cellKey,
    yearLabel: column.yearLabel || currentYearLabel.value,
    trimId: column.trimId || "",
    trimName: column.trimName || column.trimId || "",
  };

  const dimensionKey = `${column.yearLabel || currentYearLabel.value}__${column.trimId || ""}`;
  cellTargetMap[dimensionKey] = cellTargetMap[cellKey];
  return true;
}
function shouldApplyCurrentStageCellDrafts() {
  if (isS5DecisionApprovalStage.value || isS5MainSelectionLocked.value)
    return false;
  return !isMainSourceSwitchStage.value;
}
function shouldRecalculateLoadedDetailFormulas() {
  if (isS5DecisionApprovalStage.value || isS5MainSelectionLocked.value)
    return false;
  return !isMainSourceSwitchStage.value;
}
function applyDraftsToDetail(draftMap: Record<string, unknown>) {
  Object.keys(draftMap || {}).forEach((rowId) => {
    const cells = (draftMap[rowId] || {}) as Record<string, unknown>;
    Object.keys(cells).forEach((cellKey) => {
      const draft = cells[cellKey] as Record<string, unknown> | undefined;
      if (!draft || draft.value == null) return;
      writeDetailCellValue(rowId, cellKey, String(draft.value));
    });
  });
}
function getFormulaSourceDetails() {
  return formulaSourceDetail.value &&
    Array.isArray(formulaSourceDetail.value.rows) &&
    formulaSourceDetail.value.rows.length
    ? [formulaSourceDetail.value]
    : [];
}
function getAggregateSourceRows() {
  const rows: MatrixRow[] = [];
  const seen: Record<string, boolean> = {};
  const appendRows = (items: unknown) => {
    (Array.isArray(items) ? items : []).forEach((row, index) => {
      if (!row || typeof row !== "object") return;
      if (isMainAuditFormulaMode.value && !isMainPreviewRow(row)) return;
      const key = String(
        row.id ||
          row.rowId ||
          row.subjectId ||
          row.fullNamePath ||
          row.subjectPath ||
          `row_${index}`,
      ).trim();
      if (seen[key]) return;
      seen[key] = true;
      rows.push(row);
    });
  };
  appendRows(detail && detail.rows);
  appendRows(formulaSourceDetail.value && formulaSourceDetail.value.rows);
  return rows;
}
const loadFormulaSourceDetail = async (query: Record<string, unknown>) => {
  formulaSourceDetail.value = null;
  if (!isSubtableDomain.value) return;
  formulaSourceDetail.value = await resolveSubtableFormulaSourceDetail(
    {
      ...query,
      userId: currentUser.value || query.userId,
    },
    detail,
  );
};
function recalculateDetailFormulas() {
  if (!detail || !Array.isArray(detail.rows) || !detail.rows.length) return;
  const formulaOptions = {
    ignoreFormulaLocks: isSubtableDomain.value,
    sourceDetails: isMainAuditFormulaMode.value
      ? []
      : getFormulaSourceDetails(),
  };
  if (isMainDomain.value) {
    (formulaOptions as Record<string, unknown>).targetModuleCode =
      REVENUE_MODULE_CODE.MAIN_PNL;
    if (isMainAuditFormulaMode.value) {
      (formulaOptions as Record<string, unknown>).calculationMode =
        REVENUE_FORMULA_CALCULATION_MODE.MAIN_AUDIT;
    }
  }
  applyRevenueFormulasToDetail(
    {
      ...detail,
      dimensions: dimensions,
    },
    formulaOptions,
  );
  Object.assign(detail, {
    ...detail,
    rows: detail.rows.slice(),
  });
}
function isReviewableRowInFullScope(row: Record<string, unknown>) {
  if (!row || !row.id) return false;
  if (isReadonlySubtableMainPreviewRow(row)) return false;
  if (isReadonlyMainDomainReferenceRow(row)) return false;
  if (!canEditAudit.value || !canEditStage.value) return false;
  if (!isSavableMatrixCell(row, { real: true, aggregateMode: "NONE" }))
    return false;
  return isReviewableAuditValueSource(auditDomain.value, row, {
    rows: (detail && detail.rows) as unknown as FormulaRow[],
  });
}
function canViewRow(row: Record<string, unknown>) {
  if (!row || !row.id) return false;
  if (!canViewAudit.value) return false;
  if (queryReadonlyAuthorizedScope.value) {
    return Boolean(
      visibleRowMap[String(row.id)] || editableRowMap[String(row.id)],
    );
  }
  if (isReadonlySubtableMainPreviewRow(row)) return true;
  if (isReadonlyMainDomainReferenceRow(row)) return true;
  if (effectiveRowScope.value === "mine" || usesResponsibleSubjectScope.value) {
    return Boolean(
      visibleRowMap[String(row.id)] || editableRowMap[String(row.id)],
    );
  }
  return true;
}
function canEditRow(row: Record<string, unknown>) {
  if (!row || !row.id) return false;
  if (isS5MainSelectionPage.value || isS5DecisionApprovalStage.value)
    return false;
  if (isReadonlySubtableMainPreviewRow(row)) return false;
  if (isReadonlyMainDomainReferenceRow(row)) return false;
  if (!canEditAudit.value) return false;
  if (!canEditStage.value) return false;
  if (usesResponsibleSubjectScope.value || effectiveRowScope.value === "mine") {
    return Boolean(editableRowMap[String(row.id)]);
  }
  return true;
}
function canReviewRow(row: Record<string, unknown>) {
  if (!canEditRow(row)) return false;
  if (!isSavableMatrixCell(row, { real: true, aggregateMode: "NONE" }))
    return false;
  return isReviewableAuditValueSource(auditDomain.value, row, {
    rows: (detail && detail.rows) as unknown as FormulaRow[],
  });
}
function canEditModuleOpinion(module: Record<string, unknown>) {
  if (isReadonlySubtableMainPreviewModule(module)) return false;
  if (isReadonlyMainDomainReferenceModule(module)) return false;
  if (isMainValueSelectionStage.value) return false;
  if (!canEditAudit.value) return false;
  if (!canEditStage.value) return false;
  if (isMainDomain.value) return true;
  return canSubmitModuleBase(module);
}
function canSubmitModuleBase(module: Record<string, unknown>) {
  if (isMainDomain.value) return false;
  if (!module || !Array.isArray(module.rows)) return false;
  if (!canEditAudit.value) return false;
  if (!canEditStage.value) return false;
  if (!auditAccessPolicy.value.canSubmit) return false;
  // 优先用完整模块行（visibleModules 可能已按可见性过滤），避免漏判可审科目
  const moduleKey = resolveModuleKey(module);
  const fullModule =
    (moduleKey &&
      modules.value.find((item) => resolveModuleKey(item) === moduleKey)) ||
    module;
  const reviewRows: unknown[] = ([] as unknown[])
    .concat(Array.isArray(fullModule.rows) ? fullModule.rows : [])
    .concat(Array.isArray(module.rows) ? module.rows : []);
  const seen = new Set<string>();
  const hasReviewable = reviewRows.some((row: unknown) => {
    const rowObj = row as Record<string, unknown>;
    const id = String((rowObj && rowObj.id) || "").trim();
    if (id) {
      if (seen.has(id)) return false;
      seen.add(id);
    }
    return canReviewRow(rowObj);
  });
  if (!hasReviewable) return false;
  if (isModuleSubmitted(module) && !isModuleReediting(module)) return false;
  return true;
}
function canSubmitModule(module: Record<string, unknown>) {
  if (!canSubmitModuleBase(module)) return false;
  if (isYearOnlyModule(module)) return true;
  if (usesModuleViewMode.value && !isModuleOverviewMode(module)) return false;
  return true;
}
function resolveSubmitHint(module: Record<string, unknown>) {
  if (isMainDomain.value) return "";
  if (!module || !module.name) return "当前无可处理模块";
  if (!canEditAudit.value) return "当前权限仅可查看，不具备提交流程权限";
  if (!canEditStage.value) return "当前阶段不可提交流程";
  if (!auditAccessPolicy.value.canSubmit)
    return "当前权限不具备该模块提交流程权限";
  if (isModuleSubmitted(module) && !isModuleReediting(module)) {
    return "当前模块已提交，可重新编辑后再次提交";
  }
  const reviewableRows = Array.isArray(module.rows) ? module.rows : [];
  if (
    !reviewableRows.some((row: unknown) =>
      canReviewRow(row as Record<string, unknown>),
    )
  )
    return "当前模块无你可处理的科目";
  if (
    !isYearOnlyModule(module) &&
    usesModuleViewMode.value &&
    !isModuleOverviewMode(module)
  ) {
    return "请切换到总览，确认全部年份与版型后再提交审核意见";
  }
  return "";
}
function canEditCell(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  // 对齐 Vue2 / SubjectAuditMatrix：参数顺序为 (row, column)
  if (column && column.readonly === true) return false;
  if (isAnyModuleLoading.value || hasModuleLoadErrors.value) return false;
  if (!canReviewRow(row)) return false;
  if (isRndAmountColumn(column)) {
    return (
      isRndDoubleAmountSourceRow(row) &&
      (hasCellTarget(row, column) ||
        canCreateTargetlessSubtableAuditCell(row, column))
    );
  }
  if (row && row.moduleCode === "rnd_expense" && !isRndDirectYearInputRow(row))
    return false;
  if (!isSavableMatrixCell(row, column)) return false;
  // 设计成本等 first_year_only：后续年不可审改
  if (!isColumnRequiredByInputScope(row, column)) return false;
  return (
    hasCellTarget(row, column) ||
    canCreateTargetlessSubtableAuditCell(row, column)
  );
}
function getCellKey(trimIndex: unknown, yearIndexValue: unknown) {
  const yearIndex = Number.isInteger(yearIndexValue)
    ? yearIndexValue
    : Math.min(
        Math.max(activeRealYearIndex.value, 0),
        Math.max((dimensions.years || []).length - 1, 0),
      );
  return `y${yearIndex}_t${trimIndex}`;
}
function resolveCellTarget(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!row || !column) return null;
  const rawTargetMap =
    (row.cellTargetMap && typeof row.cellTargetMap === "object"
      ? row.cellTargetMap
      : null) ||
    (row.cellRecordMap && typeof row.cellRecordMap === "object"
      ? row.cellRecordMap
      : null);
  if (!rawTargetMap) return null;
  const targetMap = rawTargetMap as Record<string, unknown>;
  const key = resolveColumnCellKey(column);
  if (Object.prototype.hasOwnProperty.call(targetMap, key))
    return targetMap[key] as Record<string, unknown>;
  const dimensionKey = `${column.yearLabel || currentYearLabel.value}__${column.trimId || ""}`;
  if (Object.prototype.hasOwnProperty.call(targetMap, dimensionKey))
    return targetMap[dimensionKey] as Record<string, unknown>;
  return null;
}
function hasCellTarget(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  if (isMainDomain.value) return true;
  const target = resolveCellTarget(row, column);
  if (!target || typeof target !== "object") return false;
  const recordIds = Array.isArray(target.targetRecordIds)
    ? target.targetRecordIds
    : [];
  const submitIds = Array.isArray(target.targetSubmitIds)
    ? target.targetSubmitIds
    : Array.isArray(target.submitIds)
      ? target.submitIds
      : [];
  return Boolean(
    recordIds.length ||
    submitIds.length ||
    target.recordId ||
    target.id ||
    target.submitId,
  );
}
function canCreateTargetlessSubtableAuditCell(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  return (
    isSubtableDomain.value &&
    currentStageCode.value === "S2" &&
    row &&
    column &&
    isSavableMatrixCell(row, column)
  );
}
function getBaseCellValue(
  row: Record<string, unknown> | null,
  trimIndex: unknown,
  yearIndexValue: unknown,
  column: Record<string, unknown> | null = null,
) {
  const key = column
    ? resolveColumnCellKey(column)
    : getCellKey(trimIndex, yearIndexValue);
  const cells = (row && row.cells ? row.cells : {}) as Record<string, unknown>;
  return String(cells[key] == null ? "" : cells[key]);
}
function getDraftCell(
  row: Record<string, unknown>,
  trimIndex: unknown,
  yearIndexValue: unknown,
  column: unknown = null,
) {
  if (!shouldApplyCurrentStageCellDrafts()) return null;
  const rowMap = (
    cellDrafts && cellDrafts[String(row.id)] ? cellDrafts[String(row.id)] : null
  ) as Record<string, unknown> | null;
  if (!rowMap) return null;
  const key = column
    ? resolveColumnCellKey(column as Record<string, unknown>)
    : getCellKey(trimIndex, yearIndexValue);
  return (rowMap[key] || null) as Record<string, unknown> | null;
}
function getCurrentStageCellTargetRecord(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  const target = resolveCellTarget(row, column);
  if (!target || typeof target !== "object") return null;
  const targetStage = normalizeStageCode(
    String(target.node || target.stageCode || target.sourceStageCode || ""),
  );
  if (targetStage !== currentStageCode.value) return null;
  const value = getBaseCellValue(
    row,
    column.trimIndex,
    column.yearIndex,
    column,
  );
  return {
    sourceType: "review_save",
    sourceIndex: -1,
    sourceRecordId: target.recordId || target.id,
    sourceStageCode: targetStage,
    value,
    opinion: target.opinion || "",
    recordStatus: target.recordStatus || target.status || "",
    ownerId: target.ownerId || "",
    ownerName: target.ownerName || "",
    ownerPermission: target.ownerPermission || target.permissionKey || "",
  };
}
function getCurrentStageAuditCellRecord(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  return (
    getDraftCell(row, column.trimIndex, column.yearIndex, column) ||
    getCurrentStageCellTargetRecord(row, column)
  );
}
function resolveCellRecord(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  return getCurrentStageAuditCellRecord(row, column);
}
function hasAuditedCellRecord(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  if (!row || !column) return false;
  return Boolean(getCurrentStageAuditCellRecord(row, column));
}
function resolveCellHistory(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  const rowMap = (
    cellHistories && cellHistories[String(row.id)]
      ? cellHistories[String(row.id)]
      : null
  ) as Record<string, unknown> | null;
  if (!rowMap) return [];
  return (rowMap[resolveColumnCellKey(column)] || []) as unknown[];
}
// normalizeHistoryValueForCompare 已提取为模块级纯函数
function hasHistoryValueDiff(
  row: Record<string, unknown>,
  trimIndex: unknown,
  yearIndexValue: unknown,
  column: unknown = null,
) {
  const rowId = String(row && row.id != null ? row.id : "").trim();
  if (!rowId || trimIndex == null) return false;
  const rowMap = (
    cellHistories && cellHistories[rowId] ? cellHistories[rowId] : null
  ) as Record<string, unknown> | null;
  if (!rowMap) return false;
  const history =
    rowMap[
      column
        ? resolveColumnCellKey(column as Record<string, unknown>)
        : getCellKey(trimIndex, yearIndexValue)
    ] || [];
  if (!Array.isArray(history) || history.length < 2) return false;
  const values = new Set();
  history.forEach((item) => {
    const normalized = normalizeHistoryValueForCompare(item && item.value);
    if (normalized) values.add(normalized);
  });
  return values.size > 1;
}
function resolveCellPopoverTitle(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  if (isRndAmountColumn(column)) {
    return `${displayUiText(row.subject || "-")} / ${column.label || "投资总额"}`;
  }
  const year =
    column && column.yearLabel ? column.yearLabel : currentYearLabel.value;
  const trim =
    column && (column.trimName || column.label)
      ? column.trimName || column.label
      : "-";
  return `${displayUiText(row.subject || "-")} / ${year} / ${trim}`;
}
function resolveUnitText(row: Record<string, unknown>) {
  return row && row.unit ? row.unit : "-";
}
function resolveCellValueRow(
  column: Record<string, unknown>,
  row: Record<string, unknown>,
) {
  if (isRndAmountColumn(column)) {
    return {
      ...row,
      unit: "万元",
    };
  }
  return row;
}
function cellText(
  row: Record<string, unknown>,
  trimIndex: unknown,
  yearIndexValue: unknown,
  column: Record<string, unknown> | null = null,
) {
  const draft = getDraftCell(row, trimIndex, yearIndexValue, column);
  return draft
    ? draft.value
    : getBaseCellValue(row, trimIndex, yearIndexValue, column);
}
function resolveCellText(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  if (isDisplayAggregateColumn(column)) {
    return getRowCellValue(row, column);
  }
  return cellText(row, column.trimIndex, column.yearIndex, column);
}
function cellType(
  row: Record<string, unknown>,
  trimIndex: unknown,
  yearIndexValue: unknown,
  column: Record<string, unknown> | null = null,
) {
  const draft = getDraftCell(row, trimIndex, yearIndexValue, column);
  if (draft) return "warning";
  if (hasHistoryValueDiff(row, trimIndex, yearIndexValue, column))
    return "danger";
  const conflictIndex = isMainDomain.value ? 1 : 0;
  if (
    String(row.auditCase || "").toLowerCase() === "conflict" &&
    Number(trimIndex) % 2 === conflictIndex
  ) {
    return "danger";
  }
  return "default";
}
function resolveCellType(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  return cellType(row, column.trimIndex, column.yearIndex, column);
}
function resolveCellHighlightClass(
  row: Record<string, unknown>,
  column: Record<string, unknown>,
) {
  // 主表两处「边际贡献」的小计/加权、全生命周期小计数字加粗（仅展示）
  if (isDisplayAggregateColumn(column) && isMainMarginContributionRow(row)) {
    return "margin-contrib-subtotal-bold-cell";
  }
  if (isDisplayAggregateColumn(column)) return "";
  if (hasAuditedCellRecord(row, column)) return "history-value-diff-cell";
  return hasHistoryValueDiff(row, column.trimIndex, column.yearIndex, column)
    ? "history-value-diff-cell"
    : "";
}
const onMatrixCellClick = async (
  _row: Record<string, unknown>,
  column: Record<string, unknown>,
) => {
  if (isDisplayAggregateColumn(column)) {
    BaseToast.warning("列小计仅用于展示，不保存");
    return;
  }
  BaseToast.info("请在弹出的给值面板中处理该单元格");
};
const onMatrixCellConfirm = async (
  row: Record<string, unknown>,
  column: Record<string, unknown>,
  decision: unknown,
) => {
  if (isDisplayAggregateColumn(column)) {
    BaseToast.warning("列小计仅用于展示，不保存");
    return;
  }
  await handleCellDecision(row, column, decision as Record<string, unknown>);
};
function trackSaveOperation(runSave: () => Promise<unknown>) {
  const promise = Promise.resolve().then(() => runSave());
  pendingSaveOperations.value.push(promise);
  pendingSaveCount.value += 1;
  promise
    .finally(() => {
      pendingSaveOperations.value = pendingSaveOperations.value.filter(
        (item) => item !== promise,
      );
      pendingSaveCount.value = Math.max(pendingSaveCount.value - 1, 0);
    })
    .catch(() => null);
  return promise;
}
const waitForPendingSaveOperations = async () => {
  while (pendingSaveOperations.value.length) {
    const pending = pendingSaveOperations.value.slice();
    await Promise.all(
      pending.map((item) => (item as Promise<unknown>).catch(() => null)),
    );
  }
};
function isModuleSubmitting(module: Record<string, unknown>) {
  return (
    Boolean(moduleSubmittingKey.value) &&
    moduleSubmittingKey.value === resolveModuleKey(module)
  );
}
const handleCellDecision = async (
  row: Record<string, unknown>,
  column: Record<string, unknown>,
  decision: Record<string, unknown>,
) => {
  if (!canEditCell(row, column)) return;
  const _trimIndex = column.trimIndex;
  void _trimIndex;
  const inputValue = String(
    decision.value == null ? "" : decision.value,
  ).trim();
  if (!inputValue) {
    BaseToast.warning("请输入有效值");
    return;
  }
  const sourceType =
    decision.sourceType || (isMainDomain.value ? "main_custom" : "custom");
  let nextValue = inputValue;
  if (String(sourceType).toLowerCase().includes("custom")) {
    const validation = validateEditableValue(
      resolveCellValueRow(row, column),
      inputValue,
    );
    if (!validation.ok) {
      BaseToast.warning(validation.message || "输入值格式不正确");
      return;
    }
    nextValue = String(
      validation.storageValue == null ? "" : validation.storageValue,
    );
  }

  const key = resolveColumnCellKey(column);
  const payload = {
    sourceType,
    sourceIndex: Number.isInteger(decision.sourceIndex)
      ? decision.sourceIndex
      : -1,
    sourceRecordId: decision.sourceRecordId,
    sourceReviewId: decision.sourceReviewId,
    sourceStageCode: decision.sourceStageCode,
    value: nextValue,
    opinion: String(decision.opinion || "").trim(),
    updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    updatedBy: currentUserName.value || currentUser.value,
  };

  const rowId = String(row.id);
  const cellSnapshot = snapshotDetailCellValue(rowId, key);
  const rowDrafts = cellDrafts[rowId] as Record<string, unknown> | undefined;
  const hadDraftRow = Boolean(rowDrafts);
  const hadDraft = Boolean(
    rowDrafts && Object.prototype.hasOwnProperty.call(rowDrafts, key),
  );
  const previousDraft = rowDrafts ? rowDrafts[key] : undefined;
  if (!rowDrafts) {
    cellDrafts[rowId] = {};
  }
  const targetDrafts = (cellDrafts[rowId] as Record<string, unknown>) || {};
  targetDrafts[key] = payload;
  writeDetailCellValue(rowId, key, payload.value);
  recalculateDetailFormulas();

  const result = (await trackSaveOperation(() =>
    saveSubtableAuditCellDraft({
      ...buildQueryPayload(),
      userId: currentUser.value,
      rowId,
      cellKey: key,
      record: payload,
    }),
  )) as { ok?: boolean; message?: string; [key: string]: unknown } | null;
  if (!result || !result.ok) {
    if (hadDraft) {
      (cellDrafts[rowId] as Record<string, unknown>)[key] = previousDraft;
    } else if (hadDraftRow) {
      delete (cellDrafts[rowId] as Record<string, unknown>)[key];
    } else {
      delete cellDrafts[rowId];
    }
    if (cellSnapshot) {
      restoreDetailCellValueSnapshot(cellSnapshot);
    }
    recalculateDetailFormulas();
    BaseToast.error(String((result && result.message) || "保存失败"));
    return;
  }

  rememberSavedCellTarget(rowId, column, result);
};
const saveModuleOpinion = async (module: Record<string, unknown>) => {
  if (!module || !module.name) return;
  if (!canEditModuleOpinion(module)) return;
  if (isModuleSubmitted(module) && isModuleReediting(module)) return;
  return trackSaveOperation(async () => {
    const opinion = resolveModuleOpinion(module);
    const rowIds = (Array.isArray(module.rows) ? module.rows : [])
      .filter((row) => canReviewRow(row))
      .map((row) => row.id);
    const result = await saveSubtableAuditModuleOpinion({
      ...buildQueryPayload(),
      userId: currentUser.value,
      stageCode: detail.stageCode,
      rootSubjectId: module.rootSubjectId,
      moduleKey: resolveModuleKey(module),
      moduleName: module.name,
      rowIds,
      opinion,
    });
    if (!result || !result.ok) {
      BaseToast.warning((result && result.message) || "保存意见失败");
      return;
    }

    writeModuleMap("moduleOpinionMap", module, opinion);
  });
};
const submitModule = async (module: Record<string, unknown>, prefilledText?: string) => {
  if (!module || !module.name) return;
  if (isSubmitBlocking.value) return;
  if (isMainDomain.value) {
    await saveModuleOpinion(module);
    return;
  }
  if (!canSubmitModuleBase(module)) {
    BaseToast.warning(resolveSubmitHint(module) || "当前模块不可提交");
    return;
  }
  if (
    !isYearOnlyModule(module) &&
    usesModuleViewMode.value &&
    !isModuleOverviewMode(module)
  ) {
    BaseToast.warning("请切换到总览，确认全部年份与版型后再提交审核意见");
    return;
  }
  // 优先使用组件直接传来的文本（避免 emit 链路问题导致取不到值）
  const rawOpinion = prefilledText != null
    ? String(prefilledText)
    : String(resolveModuleOpinion(module) || "");
  const opinion = rawOpinion.trim();
  if (!opinion) {
    BaseToast.warning(`请先填写${resolveModuleOpinionTitle(module)}`);
    return;
  }
  const isResubmitting = isModuleSubmitted(module);
  const confirmed = await confirmStageFlowSubmit(
    isResubmitting
      ? `确认重新提交「${displayUiText(module.name)}」子表审核意见吗？提交后将作为最新审核意见。`
      : `确认提交「${displayUiText(module.name)}」子表审核意见吗？提交后等待管理经理最终提交。`,
  );
  if (!confirmed) return;
  const rowIds = (Array.isArray(module.rows) ? module.rows : [])
    .filter((row) => canReviewRow(row))
    .map((row) => row.id);

  moduleSubmittingKey.value = resolveModuleKey(module);
  try {
    await waitForPendingSaveOperations();
    const result = await submitSubtableAuditModule({
      ...buildQueryPayload(),
      userId: currentUser.value,
      stageCode: detail.stageCode,
      rootSubjectId: module.rootSubjectId,
      moduleKey: resolveModuleKey(module),
      moduleName: module.name,
      submittedBy: currentUser.value,
      submittedName: currentUserName.value || currentUser.value,
      rowIds,
      opinion,
    });
    if (!result || !result.ok) {
      BaseToast.warning((result && result.message) || "提交失败");
      return;
    }

    const moduleReviewState = result.moduleReviewState || {};
    // 对齐 Vue2：整表替换 submitMap，确保 isModuleSubmitted 立刻生效并禁用输入框/提交按钮
    const nextSubmitMap =
      result.submitMap || moduleReviewState.submitMap || null;
    if (nextSubmitMap && typeof nextSubmitMap === "object") {
      replaceReactiveMap(
        moduleSubmitMap,
        nextSubmitMap as Record<string, unknown>,
      );
    }
    if (moduleReviewState.opinionMap) {
      replaceReactiveMap(
        moduleOpinionMap,
        moduleReviewState.opinionMap as Record<string, unknown>,
      );
    }
    if (moduleReviewState.timeline) {
      submitTimeline.value = moduleReviewState.timeline;
    } else {
      submitTimeline.value = await listSubtableAuditModuleSubmitTimeline({
        ...buildQueryPayload(),
        userId: currentUser.value,
        stageCode: detail.stageCode,
      });
    }
    clearModuleReedit(module);
    deleteModuleMap("moduleOpinionDraftMap", module);
    await refreshStageCompletionSummary();

    if (isResubmitting) {
      BaseToast.success(`已重新提交模块：${displayUiText(module.name)}`);
      return;
    }

    const pendingModules = modules.value.filter((item) =>
      canSubmitModuleBase(item),
    );
    if (pendingModules.length) {
      BaseToast.success(
        `已提交模块：${displayUiText(module.name)}，剩余 ${pendingModules.length} 个模块待提交`,
      );
      return;
    }

    BaseToast.success(
      `已提交模块：${displayUiText(module.name)}，等待管理经理最终提交`,
    );
  } finally {
    moduleSubmittingKey.value = "";
  }
};
function formatStageCompletionIssues(row: Record<string, unknown>) {
  const issues = Array.isArray(row.issues) ? row.issues : [];
  if (!issues.length) return "-";
  return (
    issues.slice(0, 3).map(displayUiText).join("；") +
    (issues.length > 3 ? ` 等 ${issues.length} 项` : "")
  );
}
function ensureMainSubmitOverviewMode() {
  if (isMainSubmitOverviewMode.value) return true;
  BaseToast.warning(mainSubmitOverviewGuardHint.value);
  return false;
}
const confirmStageFlowSubmit = async (
  message: string,
  title: string = "提交确认",
) => {
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
};
const onSubmitS2StageFinal = async () => {
  if (!showStageFinalSubmitAction.value || isSubmitBlocking.value) return;
  if (!canSubmitStageFinal.value) {
    await refreshStageCompletionSummary();
    BaseToast.warning(
      String(
        (stageCompletionSummary.value &&
          stageCompletionSummary.value.message) ||
          "完成清单未通过，不能最终提交",
      ),
    );
    return;
  }
  const confirmed = await confirmStageFlowSubmit(
    "确认生成 S2 集团部室审核主表并流转到 S3 业务经理二次确认吗？",
  );
  if (!confirmed) return;
  stageFinalSubmitting.value = true;
  try {
    await waitForPendingSaveOperations();
    const result = await submitS2StageFinal({
      ...buildQueryPayload(),
      userId: currentUser.value,
      actor: currentUserName.value || currentUser.value,
      subjectApiMode: "auto",
      auditPayload: buildCurrentAuditPayload(),
    });
    if (!result || !result.ok) {
      if (result && result.summary) {
        stageCompletionSummary.value = result.summary;
      }
      BaseToast.warning(
        (result && result.message) || "S2 集团部室审核最终提交失败",
      );
      return;
    }
    const flowResult = result.result || {};
    if (flowResult.pendingConfirm) {
      BaseToast.success(
        `已生成 S2 集团部室审核主表，等待第二人确认后流转到：${displayUiText(flowResult.targetStage || "S3")}`,
      );
      await loadPage();
      return;
    }
    BaseToast.success(
      `已生成 S2 集团部室审核主表并流转到：${displayUiText(flowResult.nextStage || "S3")}`,
    );
    returnToPreviousPageAfterSubmit();
  } finally {
    stageFinalSubmitting.value = false;
  }
};
const onStartMeeting = async () => {
  if (!canStartMeeting.value) return;
  const confirmed = await confirmStageFlowSubmit(
    "确认开始上会并流转到 S8 上会评审吗？",
  );
  if (!confirmed) return;
  meetingStartSubmitting.value = true;
  try {
    await waitForPendingSaveOperations();
    const result = await submitS7StartMeeting({
      ...buildQueryPayload(),
      stage: "S7",
      stageCode: "S7",
      userId: currentUser.value,
      actor: currentUserName.value || currentUser.value,
    });
    if (!result || !result.ok) {
      BaseToast.warning((result && result.message) || "开始上会失败");
      return;
    }

    const flowResult = result.result || {};
    if (flowResult.pendingConfirm) {
      BaseToast.success(
        `已提交开始上会确认，等待第二人确认后流转到：${displayUiText(flowResult.targetStage || "S8")}`,
      );
      await loadPage();
      return;
    }
    const nextStage = flowResult.nextStage || "S8";
    BaseToast.success(`已开始上会，流转到：${displayUiText(nextStage)}`);
    returnToPreviousPageAfterSubmit();
  } finally {
    meetingStartSubmitting.value = false;
  }
};
const onSubmitMainAuditFinal = async () => {
  if (!ensureMainSubmitOverviewMode()) return;
  if (!canSubmitMainFinal.value) return;
  const confirmed =
    await confirmStageFlowSubmit("确认提交主表审核并流转到下一阶段吗？");
  if (!confirmed) return;
  mainFinalSubmitting.value = true;
  try {
    await waitForPendingSaveOperations();
    const result = await submitMainTableAuditFinal({
      ...buildQueryPayload(),
      userId: currentUser.value,
      actor: currentUserName.value || currentUser.value,
      mainPreviewDetail: {
        ...detail,
        dimensions: { ...dimensions },
      },
    });
    if (!result || !result.ok) {
      BaseToast.warning((result && result.message) || "主表审核提交失败");
      return;
    }
    const flowResult = result.result || {};
    if (flowResult.pendingConfirm) {
      BaseToast.success(
        `主表审核已提交，等待第二人确认后流转到：${displayUiText(flowResult.targetStage || "-")}`,
      );
      await loadPage();
      return;
    }
    const nextStage = flowResult.nextStage || "";
    BaseToast.success(
      `主表审核已提交，流转到：${displayUiText(nextStage || "-")}`,
    );
    returnToPreviousPageAfterSubmit();
  } finally {
    mainFinalSubmitting.value = false;
  }
};
const onMainSelectionChange = async () => {
  if (!showMainSelectionCard.value) return;
  if (isS5MainSelectionLocked.value) return;
  const previousFullPath = route.fullPath;
  await router
    .replace({
      path: route.path,
      query: {
        ...route.query,
        selectedSourceStage: selectedMainSourceStage.value,
      },
    })
    .catch(() => {});
  if (route.fullPath === previousFullPath) {
    await loadPage();
  }
};
const onSubmitMainSelectionFinal = async () => {
  if (!ensureMainSubmitOverviewMode()) return;
  if (!canSubmitMainSelection.value) return;
  const confirmed = await confirmStageFlowSubmit(
    `确认提交 ${displayUiText(selectedMainSourceLabel.value || selectedMainSourceStage.value)} 主表值并流转到下一阶段吗？`,
  );
  if (!confirmed) return;
  mainFinalSubmitting.value = true;
  try {
    await waitForPendingSaveOperations();
    const result = await submitMainTableVersionSelectionFinal({
      ...buildQueryPayload(),
      userId: currentUser.value,
      actor: currentUserName.value || currentUser.value,
      selectedSourceStage: selectedMainSourceStage.value,
    });
    if (!result || !result.ok) {
      BaseToast.warning((result && result.message) || "主表最终值选择提交失败");
      return;
    }
    BaseToast.success(
      `已提交 ${displayUiText(result.sourceStage || selectedMainSourceStage.value)} 主表值，等待决策评审后流转到 S6`,
    );
    await loadPage();
  } finally {
    mainFinalSubmitting.value = false;
  }
};
const onSubmitS5DecisionApproval = async () => {
  if (!canSubmitS5DecisionApproval.value) return;
  const confirmed = await confirmStageFlowSubmit(
    "确认通过 S5 决策评审并流转到 S6 集团财务审核吗？",
  );
  if (!confirmed) return;
  decisionApprovalSubmitting.value = true;
  try {
    await waitForPendingSaveOperations();
    const result = await submitS5DecisionApproval({
      ...buildQueryPayload(),
      permissionKey: resolveFlowStageActionPermission("S5", "approve"),
      workbenchAction: "approve",
      userId: currentUser.value,
      actor: currentUserName.value || currentUser.value,
    });
    if (!result || !result.ok) {
      BaseToast.warning((result && result.message) || "S5 决策评审提交失败");
      return;
    }
    const flowResult = result.result || {};
    if (flowResult.pendingConfirm) {
      BaseToast.success(
        `已提交决策确认，等待另一位决策账号确认后流转到：${displayUiText(flowResult.targetStage || "S6")}`,
      );
      await loadPage();
      return;
    }
    BaseToast.success(
      `S5 决策评审已通过，流转到：${displayUiText(flowResult.nextStage || "S6")}`,
    );
    returnToPreviousPageAfterSubmit();
  } finally {
    decisionApprovalSubmitting.value = false;
  }
};
const _syncRouteStage = async (stageCode: unknown) => {
  const nextStage = String(stageCode || "")
    .trim()
    .toUpperCase();
  if (
    !nextStage ||
    String(route.query.stage || "")
      .trim()
      .toUpperCase() === nextStage
  )
    return;
  await router
    .replace({
      path: route.path,
      query: {
        ...route.query,
        stage: nextStage,
        action: "review",
      },
    })
    .catch(() => {});
};
void _syncRouteStage;
function returnToPreviousPageAfterSubmit() {
  // 对齐 Vue2：提交成功后延迟返回；全屏详情下明确回到列表
  window.setTimeout(() => {
    const fromPath = String(route.query.fromPath || "").trim();
    const listPath = fromPath.startsWith("/")
      ? fromPath.split("?")[0] || "/revenue/project-list"
      : "/revenue/project-list";
    router.replace(listPath).catch(() => {
      goBack();
    });
  }, 800);
}
function goBack() {
  // 对齐 Vue2：优先返回上一页；无历史时回项目列表
  try {
    const historyState = router.options.history.state as
      | { back?: unknown }
      | null
      | undefined;
    if (historyState && historyState.back != null && historyState.back !== "") {
      router.back();
      return;
    }
  } catch (_error) {
    // ignore
  }
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  const fromPath = String(route.query.fromPath || "").trim();
  router.replace(
    fromPath.startsWith("/")
      ? fromPath.split("?")[0] || "/revenue/project-list"
      : "/revenue/project-list",
  );
}
function closePage() {
  const tabHandle = (window as Window & { $tab?: { closePage?: () => void } })
    .$tab;
  if (tabHandle && tabHandle.closePage) {
    tabHandle.closePage();
    return;
  }
  goBack();
}

void _configuredSubjectDomain.value;
void _isFlowPermissionEntry.value;
void _isReadonlyStageTrace.value;
void _isBrandFinanceMainReviewStage.value;
void _shouldShowMainPriorOpinions.value;
void _mineScopeLabel.value;
void _canRecalculate.value;
void _canViewAllRows.value;
void _hasReviewableRowsInFullScope.value;
void _hasReadonlyRowsInFullScope.value;
void _created.value;
void _activated.value;
</script>

<style lang="scss" scoped>
@use "../../styles/revenue-visual-spec-g.scss" as *;

.revenue-audit-workbench-detail {
  border: 1px solid var(--rv-line);
  border-radius: 10px;
  background: var(--rv-surface);
  box-shadow: var(--rv-shadow-xs);
  padding-bottom: 16px;

  &.rv-list-card {
    overflow: visible;
  }

  :deep(.detail-close-btn) {
    width: 28px;
    height: 28px;
    padding: 0;
    border-color: var(--rv-line-strong);
    color: var(--rv-text-3);
    background: var(--rv-surface);
    box-shadow: var(--rv-shadow-xs);

    &:hover,
    &:focus {
      border-color: var(--rv-focus);
      color: var(--rv-focus-strong);
      background: var(--rv-focus-bg);
    }
  }

  .toolbar-line {
    margin: 12px 16px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .toolbar-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    .label {
      font-size: 12px;
      color: var(--rv-text-4);
    }
  }

  .workbench-toolbar,
  .module-view-toolbar {
    padding: 10px 12px;
    border: 1px solid var(--rv-line);
    border-radius: 8px;
    background: #fff;
  }

  /* 视图切换按钮：选中态强制蓝底白字，避免主题覆盖不生效 */
  .workbench-toolbar,
  .module-view-toolbar {
    :deep(.el-radio-button__inner) {
      font-weight: 500;
      color: #4a5a70;
      background: #fff;
      border-color: #c7d3e1;
    }

    :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner),
    :deep(.el-radio-button.is-active .el-radio-button__inner) {
      background: #2563eb !important;
      border-color: #2563eb !important;
      color: #fff !important;
      font-weight: 600;
      box-shadow: none;
    }

    :deep(.el-radio-button:hover .el-radio-button__inner) {
      color: #2563eb;
    }
  }

  .meeting-notice-card {
    margin: 12px 16px 0;
    border: 1px solid #d7e2ef;
    border-radius: 8px;
    background: #fff;
    padding: 12px;
    box-shadow: 0 8px 20px rgba(45, 74, 105, 0.05);
  }

  .meeting-notice-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e7eef7;
  }

  .meeting-notice-title {
    color: var(--rv-text-1);
    font-size: 15px;
    font-weight: 700;
    line-height: 22px;
  }

  .meeting-notice-sub {
    margin-top: 2px;
    color: var(--rv-text-4);
    font-size: 12px;
    line-height: 18px;
  }

  .meeting-notice-summary {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .meeting-summary-item {
    border: 1px solid #e1eaf4;
    border-radius: 8px;
    background: #f8fbff;
    padding: 9px 10px;

    span {
      display: block;
      color: var(--rv-text-4);
      font-size: 12px;
      line-height: 18px;
    }

    b {
      display: block;
      margin-top: 2px;
      color: var(--rv-text-1);
      font-size: 13px;
      font-weight: 700;
      line-height: 20px;
      word-break: break-word;
    }
  }

  .meeting-notice-empty {
    margin-top: 12px;
    border: 1px dashed #d6e1ee;
    border-radius: 8px;
    background: #fbfdff;
    padding: 18px 12px;
    color: #70859d;
    font-size: 13px;
    text-align: center;
  }

  .s2-module-progress-card {
    margin: 12px 16px 0;
    border: 1px solid var(--rv-line);
    border-radius: 8px;
    background: #fff;
    padding: 10px 12px;
    display: grid;
    gap: 10px;
  }

  .s2-module-progress-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--rv-text-2);
    font-size: 13px;
    font-weight: 600;

    b {
      color: #b35a1f;
      font-size: 12px;
      font-weight: 600;
    }

    b.is-ok {
      color: #237a3f;
    }
  }

  .s2-module-progress-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 8px;
  }

  .s2-module-progress-item {
    min-width: 0;
    border: 1px solid var(--rv-line);
    border-radius: 8px;
    background: #f8fafc;
    padding: 8px 10px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    &:hover,
    &:focus {
      outline: none;
      border-color: var(--rv-focus);
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    }

    &.is-submitted {
      border-color: #b7e0c4;
      background: #f4fbf6;
      box-shadow: inset 3px 0 0 #237a3f;
    }
  }

  .s2-module-progress-item-head {
    display: grid;
    gap: 2px;
    margin-bottom: 6px;
  }

  .s2-module-progress-index {
    font-size: 11px;
    color: var(--rv-text-4);
    font-weight: 700;
    line-height: 1.2;
  }

  .s2-module-progress-label {
    display: block;
    color: var(--rv-text-2);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .s2-module-progress-status {
    color: #b35a1f;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.4;

    &.is-submitted {
      color: #237a3f;
    }
  }

  .s2-module-progress-meta,
  .s2-module-progress-empty {
    margin-top: 4px;
    color: var(--rv-text-4);
    font-size: 11px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .stage-final-card {
    margin: 12px 16px 0;
    border: 1px solid var(--rv-line);
    border-radius: 8px;
    background: #fff;
    padding: 10px;
  }

  .main-selection-card {
    margin: 12px 16px 0;
    border: 1px solid var(--rv-line);
    border-radius: 8px;
    background: #fff;
    padding: 10px 12px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .stage-final-head,
  .main-selection-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    color: var(--rv-text-2);
    font-size: 13px;
    font-weight: 600;

    b {
      color: #b35a1f;
      font-size: 12px;
      font-weight: 600;
    }

    b.is-ok {
      color: #237a3f;
    }
  }

  .main-selection-head {
    margin-bottom: 0;
    min-width: 160px;

    b {
      color: #60758e;
    }
  }

  .s5-decision-card {
    margin: 12px 16px 0;
    border: 1px solid var(--rv-line);
    border-radius: 8px;
    background: #fff;
    padding: 12px;
    box-shadow: 0 8px 20px rgba(45, 74, 105, 0.05);
  }

  .s5-decision-head,
  .s5-decision-actions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .s5-decision-head {
    margin-bottom: 10px;
  }

  .s5-decision-title {
    color: var(--rv-text-1);
    font-size: 14px;
    font-weight: 700;
    line-height: 22px;
  }

  .s5-decision-sub,
  .s5-decision-tip {
    color: var(--rv-text-4);
    font-size: 12px;
    line-height: 18px;
  }

  .s5-decision-actions {
    align-items: center;
    margin-top: 10px;
  }

  .module-section-list {
    margin: 12px 16px 0;
  }

  .module-section {
    border: 1px solid #dce6f2;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 8px 20px rgba(45, 74, 105, 0.06);
    overflow: hidden;
    scroll-margin-top: 84px;
  }

  .module-section + .module-section {
    margin-top: 16px;
  }

  .module-section-head {
    min-height: 48px;
    padding: 12px 16px 10px 18px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid #e7eef7;
    background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
    position: relative;
  }

  .module-section-head::before {
    content: "";
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 10px;
    width: 4px;
    border-radius: 0 4px 4px 0;
    background: #2f6fb3;
  }

  .module-view-toolbar {
    margin: 0;
    padding: 10px 16px;
    border-bottom: 1px solid #e7eef7;
    background: #fbfdff;
  }

  .module-load-status {
    margin: 10px 14px 0;
    border: 1px solid #d5e4f5;
    border-radius: 6px;
    background: #f7fbff;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #245f9c;
    font-size: 12px;
    line-height: 18px;
    pointer-events: none;
  }

  .module-load-error {
    margin: 10px 14px 0;
    border: 1px solid #f3c7c7;
    border-radius: 6px;
    background: #fff7f7;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: #9f2d2d;
    font-size: 12px;
    line-height: 18px;
  }

  .submit-disabled-tooltip {
    display: inline-flex;
    vertical-align: middle;
  }

  // 对齐 Vue2（Element UI）的 success 按钮视觉：Enabled 深绿，Disabled 浅绿
  :deep(.el-button--success) {
    // Enabled 状态：深一点的绿色（对齐 Element UI Vue2 默认 success）
    color: #fff;
    background-color: #67c23a;
    border-color: #67c23a;

    &:hover,
    &:focus {
      background-color: #85ce61;
      border-color: #85ce61;
    }

    &:active {
      background-color: #5daf34;
      border-color: #5daf34;
    }

    // Disabled 状态：浅绿色（带透明度，体现不可用）
    &.is-disabled,
    &.is-disabled:hover,
    &.is-disabled:focus,
    &.is-disabled.is-plain,
    &.is-disabled.is-plain:hover {
      color: #fff;
      background-color: #95d475;
      border-color: #95d475;
      opacity: 0.7;
    }
  }

  .module-scroll-link {
    display: inline;
    padding: 0;
    border: 0;
    background: transparent;
    color: #2f6fb3;
    font: inherit;
    font-weight: 600;
    line-height: 18px;
    cursor: pointer;
    text-align: left;
  }

  .module-scroll-link:hover {
    color: #1f4f86;
    text-decoration: underline;
  }

  .module-title {
    font-size: 16px;
    color: var(--rv-text-1);
    font-weight: 700;
    line-height: 24px;
  }

  .module-title-row {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }

  .module-title-warning {
    color: #c62828;
    font-size: 12px;
    font-weight: 600;
    line-height: 20px;
  }

  .module-state {
    flex: 0 0 auto;
    border: 1px solid #d7e2ef;
    border-radius: 999px;
    padding: 3px 9px;
    color: #60758e;
    background: #fff;
    font-size: 12px;
    line-height: 18px;
  }

  .module-state.is-submitted {
    border-color: #b7ddc3;
    color: #237a3f;
    background: #f1fbf4;
  }

  .module-state.is-readonly {
    border-color: #d7e2ef;
    color: #60758e;
    background: #f8fbff;
  }

  .empty-module-state {
    margin: 12px 16px 0;
    border: 1px dashed var(--rv-line);
    border-radius: 8px;
    background: #fff;
    padding: 18px;
    text-align: center;
    color: #8093aa;
    font-size: 13px;
  }
}

@media (max-width: 1200px) {
  .revenue-audit-workbench-detail {
    .meeting-notice-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .s2-module-progress-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
}

@media (max-width: 768px) {
  .revenue-audit-workbench-detail {
    .meeting-notice-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .meeting-notice-summary {
      grid-template-columns: 1fr;
    }

    .s2-module-progress-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}
</style>
