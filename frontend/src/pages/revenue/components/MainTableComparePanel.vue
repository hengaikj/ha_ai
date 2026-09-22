<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <section ref="rootRef" class="main-table-compare-panel">
    <div
      ref="tableFullscreenTargetRef"
      class="card-block compare-card"
      :class="{
        'is-system-fullscreen': tableSystemFullscreen,
        'is-table-centered': tableSystemFullscreen && tableFullscreenCentered,
        'is-fixed-fee-collapsed': tableSystemFullscreen && isFixedFeeCollapsed,
        'is-fixed-fee-expanded': tableSystemFullscreen && !isFixedFeeCollapsed,
      }"
    >
      <div v-show="!tableSystemFullscreen" class="block-head toolbar-wrap control-toolbar">
        <div class="toolbar-line toolbar-line-actions">
          <div class="toolbar-actions">
            <el-button size="small" class="toolbar-reset-btn" @click="handleResetCompareControls">
              重置筛选
            </el-button>
            <el-button
              v-if="showCalculator"
              size="small"
              class="toolbar-calc-btn"
              @click.stop="handleOpenCalcDrawer"
            >
              现场计算器
            </el-button>
            <el-button
              v-if="enableFullscreen"
              size="small"
              class="toolbar-fullscreen-btn"
              @click="toggleTableSystemFullscreen"
            >
              {{ tableSystemFullscreen ? "退出全屏" : "表格全屏" }}
            </el-button>
          </div>
        </div>

        <div class="toolbar-line">
          <div class="toolbar-field">
            <span class="toolbar-label">基准版本</span>
            <el-input
              v-if="lockBaseline"
              :model-value="fixedBaselineVersionLabel"
              size="small"
              style="width: 180px"
              disabled
            />
            <el-select
              v-else
              v-model="state.baselineVersion"
              size="small"
              style="width: 180px"
              @change="handleBaselineVersionChange"
            >
              <el-option
                v-for="item in baselineSelectOptions"
                :key="`base_${item.key}`"
                :label="item.label"
                :value="item.key"
                :disabled="item.disabled"
              />
            </el-select>
          </div>

          <div v-if="!isDetailMode" class="toolbar-field">
            <span class="toolbar-label">对比版本</span>
            <el-select
              v-model="state.compareVersions"
              multiple
              collapse-tags
              size="small"
              style="width: 280px"
              @change="handleCompareVersionsChange"
            >
              <el-option
                v-for="item in compareVersionOptions"
                :key="`cmp_${(item as any).key}`"
                :label="(item as any).label"
                :value="(item as any).key"
                :disabled="(item as any).required"
              />
              <el-option
                v-if="showAddHistoryOption"
                class="compare-version-add-option"
                :label="addHistoryValveOptionLabel"
                :value="addHistoryValveOptionKey"
              >
                <el-icon><Plus /></el-icon>
                <span>{{ addHistoryValveOptionLabel }}</span>
              </el-option>
              <el-option
                v-if="showOtherProjectOption"
                class="compare-version-add-option"
                :label="otherProjectOptionLabel"
                :value="otherProjectOptionKey"
              >
                <el-icon><Plus /></el-icon>
                <span>{{ otherProjectOptionLabel }}</span>
              </el-option>
            </el-select>
          </div>

          <div class="toolbar-field">
            <span class="toolbar-label">模式</span>
            <el-radio-group v-model="state.viewMode" size="small" @change="handleViewModeChange">
              <el-radio-button label="compare">对比模式</el-radio-button>
              <el-radio-button label="detail">详情模式</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <div class="toolbar-line toolbar-line-controls">
          <div v-if="!isDetailMode" class="toolbar-field">
            <span class="toolbar-label">年份</span>
            <el-select
              v-model="state.activeYears"
              multiple
              collapse-tags
              size="small"
              style="width: 220px"
              @change="handleYearChange"
            >
              <el-option
                v-for="item in reviewYearOptions"
                :key="`year_${(item as any).value}`"
                :label="(item as any).label"
                :value="(item as any).value"
              />
            </el-select>
          </div>

          <div v-if="!isDetailMode" class="toolbar-switches compare-panel-switches">
            <div class="toolbar-switch-chip compare-mode-switch-chip" :class="{ active: state.deltaMode }">
              <el-switch
                v-model="state.deltaMode"
                class="compare-mode-switch"
                active-text="差值模式"
                inactive-text="原值模式"
              />
            </div>

            <div class="toolbar-switch-chip auto-diff-switch-chip" :class="{ active: state.autoDiff }">
              <el-switch
                v-model="state.autoDiff"
                class="auto-diff-switch"
                inactive-text="差异高亮"
              />
            </div>
          </div>
        </div>
      </div>

      <div ref="compareTableWrapRef" class="table-wrap">
        <table
          v-if="!isDetailMode"
          class="compare-table"
          :style="compareTableStyle"
        >
          <colgroup>
            <col class="subject-width-col" />
            <col
              v-for="column in compareColumnDefs"
              :key="`compare_col_${(column as any).columnKey}`"
              class="value-width-col"
            />
          </colgroup>
          <thead>
            <tr class="version-group-row">
              <th class="subject-col subject-head subject-head-compare" rowspan="2">科目</th>
              <th
                v-for="group in compareHeaderVersions"
                :key="`group_${(group as any).key}`"
                :colspan="(group as any).colspan"
                class="version-head"
                :class="{ 'is-frozen-version-head': isFrozenCompareVersion((group as any).key) }"
                :style="versionHeadStyle(group)"
              >
                <span class="chip-dot" :class="(group as any).dot" />
                {{ (group as any).label }}
                <span v-if="(group as any).key === state.baselineVersion">（基准）</span>
              </th>
            </tr>
            <tr>
              <template v-for="group in compareHeaderVersions" :key="(group as any).key">
                <th
                  v-for="column in (group as any).yearColumns"
                  :key="`year_${(group as any).key}_${column.columnKey}`"
                  class="trim-head"
                  :class="{ 'is-frozen-year-head': isFrozenCompareVersion((group as any).key) }"
                  :style="yearHeadStyle((group as any).key, column.yearIndex)"
                >
                  {{ column.label }}
                </th>
              </template>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="row in displaySubjectRows"
              :key="`compare_${(row as any).key}`"
              :class="{
                'section-row': (row as any).type === 'section',
                'fixed-fee-detail-row': (row as any).isFixedFeeChild,
                'is-fixed-fee-collapsed': (row as any).isFixedFeeChildCollapsed,
                'is-manual-row-highlight': isManualRowHighlighted(row),
              }"
            >
              <td v-if="(row as any).type === 'section'" class="subject-col">
                {{ formatSubjectGroupLabel((row as any).group) }}
                <span v-if="isMeetingModuleLoading((row as any).group)" class="module-inline-state">加载中</span>
                <button
                  v-if="isMeetingModuleError((row as any).group)"
                  type="button"
                  class="module-inline-retry"
                  @click.stop="retryMeetingModule((row as any).group)"
                >
                  重试
                </button>
              </td>
              <template v-if="(row as any).type === 'section'">
                <td
                  v-for="column in compareColumnDefs"
                  :key="`section_cell_${(row as any).key}_${(column as any).columnKey}`"
                  :class="sectionFillCellClass(column)"
                  :style="compareCellStyle(column)"
                ></td>
              </template>
              <template v-else>
                <td
                  class="subject-col"
                  :class="{
                    bold: (row as any).item.bold,
                    'is-collapse-parent': isSubjectCollapseParent((row as any).item),
                  }"
                  @click="handleSubjectCollapseClick((row as any).item)"
                  @dblclick.stop="toggleManualRowHighlight(row)"
                >
                  <div class="fixed-fee-cell-inner">
                    <span class="subject-cell-content">
                      <span>{{ formatSubjectName((row as any).item) }}</span>
                      <el-icon
                        v-if="isSubjectCollapseParent((row as any).item)"
                        class="subject-collapse-icon"
                      >
                        <ArrowRight v-if="isSubjectCollapsed((row as any).item.id)" />
                        <ArrowDown v-else />
                      </el-icon>
                    </span>
                  </div>
                </td>
                <td
                  v-for="column in compareColumnDefs"
                  :key="`cell_${(row as any).item.id}_${(column as any).columnKey}`"
                  :class="[
                    compareCellClass((row as any).item, column as any),
                    { 'is-manual-cell-highlight': isManualCellHighlighted(row, column as any, 'compare') },
                  ]"
                  :style="compareCellStyle(column)"
                  @dblclick.stop="toggleManualCellHighlight(row, column, 'compare')"
                >
                  <div class="fixed-fee-cell-inner">
                    {{ compareCellText((row as any).item, column) }}
                  </div>
                </td>
              </template>
            </tr>
          </tbody>
        </table>

        <table v-else class="compare-table detail-table" :style="detailTableStyle">
          <colgroup>
            <col class="subject-width-col" />
            <col
              v-for="column in detailColumnDefs"
              :key="`detail_col_${(column as any).columnKey}`"
              class="value-width-col"
            />
          </colgroup>
          <thead>
            <tr class="version-group-row">
              <th class="subject-col subject-head subject-head-compare" rowspan="2">科目</th>
              <th
                v-for="group in detailHeaderGroups"
                :key="`detail_year_${(group as any).key}`"
                :colspan="(group as any).colspan"
                class="version-head"
              >
                {{ (group as any).label }}
              </th>
            </tr>
            <tr class="year-row">
              <th
                v-for="column in detailColumnDefs"
                :key="`detail_trim_${(column as any).columnKey}`"
                class="trim-head"
              >
                {{ (column as any).trimLabel }}
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="row in displaySubjectRows"
              :key="`detail_${(row as any).key}`"
              :class="{
                'section-row': (row as any).type === 'section',
                'fixed-fee-detail-row': (row as any).isFixedFeeChild,
                'is-fixed-fee-collapsed': (row as any).isFixedFeeChildCollapsed,
                'is-manual-row-highlight': isManualRowHighlighted(row),
              }"
            >
              <td v-if="(row as any).type === 'section'" class="subject-col">
                {{ formatSubjectGroupLabel((row as any).group) }}
                <span v-if="isMeetingModuleLoading((row as any).group)" class="module-inline-state">加载中</span>
                <button
                  v-if="isMeetingModuleError((row as any).group)"
                  type="button"
                  class="module-inline-retry"
                  @click.stop="retryMeetingModule((row as any).group)"
                >
                  重试
                </button>
              </td>
              <template v-if="(row as any).type === 'section'">
                <td
                  v-for="column in detailColumnDefs"
                  :key="`detail_section_cell_${(row as any).key}_${(column as any).columnKey}`"
                  class="section-fill-cell"
                ></td>
              </template>
              <template v-else>
                <td
                  class="subject-col"
                  :class="{
                    bold: (row as any).item.bold,
                    'is-collapse-parent': isSubjectCollapseParent((row as any).item),
                  }"
                  @click="handleSubjectCollapseClick((row as any).item)"
                  @dblclick.stop="toggleManualRowHighlight(row)"
                >
                  <div class="fixed-fee-cell-inner">
                    <span class="subject-cell-content">
                      <span>{{ formatSubjectName((row as any).item) }}</span>
                      <el-icon
                        v-if="isSubjectCollapseParent((row as any).item)"
                        class="subject-collapse-icon"
                      >
                        <ArrowRight v-if="isSubjectCollapsed((row as any).item.id)" />
                        <ArrowDown v-else />
                      </el-icon>
                    </span>
                  </div>
                </td>
                <td
                  v-for="column in detailColumnDefs"
                  :key="`detail_cell_${(row as any).item.id}_${(column as any).columnKey}`"
                  :class="[
                    'num-cell',
                    'baseline',
                    { 'is-manual-cell-highlight': isManualCellHighlighted(row, column as any, 'detail') },
                  ]"
                  @dblclick.stop="toggleManualCellHighlight(row, column as any, 'detail')"
                >
                  <div class="fixed-fee-cell-inner">
                    {{ detailCellText((row as any).item, (column as any).trimIndex, (column as any).yearIndex) }}
                  </div>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="tableSystemFullscreen"
        class="fullscreen-edge-entry"
        :class="{ active: fullscreenQuickMenuVisible, dragging: quickEntryDragging }"
        :style="fullscreenEntryStyle"
        @click.stop
      >
        <el-button
          size="small"
          class="quick-entry-btn"
          @mousedown.stop.prevent="startQuickEntryDrag"
          @touchstart.stop="startQuickEntryDrag"
          @touchend.stop.prevent="onQuickEntryTouchEnd"
          @click.stop="onQuickEntryClick"
        >
          ···
        </el-button>
      </div>

      <div
        v-if="tableSystemFullscreen && fullscreenQuickMenuVisible"
        class="fullscreen-quick-dock"
        :class="{ 'has-calculator-action': showCalculator }"
        :style="fullscreenDockStyle"
        @click.stop
      >
        <el-button size="small" class="quick-btn" @click="openCompareControlDrawer">
          对比控制台
        </el-button>
        <el-button v-if="showCalculator" size="small" class="quick-btn" @click="handleOpenCalcDrawer">
          现场计算器
        </el-button>
        <div class="quick-font-control" :title="fullscreenTableFontSizeTip">
          <span class="quick-font-name">字号</span>
          <el-button
            size="small"
            class="quick-font-step"
            :icon="Minus"
            :disabled="isFullscreenTableFontSizeMin"
            @click="decreaseFullscreenTableFontSize"
          />
          <span class="quick-font-value">{{ fullscreenTableFontSizeLabel }}</span>
          <el-button
            size="small"
            class="quick-font-step"
            :icon="Plus"
            @click="increaseFullscreenTableFontSize"
          />
        </div>
        <el-button size="small" class="quick-btn" @click="toggleTableSystemFullscreen">
          退出全屏
        </el-button>
      </div>

      <div v-if="tableSystemFullscreen && fullscreenModeTipVisible" class="fullscreen-mode-tip">
        全屏视图已开启
      </div>
    </div>

    <el-drawer
      v-model="compareControlDrawerVisible"
      title="对比控制台"
      direction="rtl"
      :size="controlDrawerSize"
      custom-class="meeting-review-control-drawer"
      :append-to-body="false"
      :modal-append-to-body="false"
      @opened="scheduleFullscreenTableLayout"
    >
      <div class="control-drawer-body">
        <div class="control-drawer-head">
          <div class="control-drawer-title">表格对比筛选</div>
        </div>

        <div class="control-section">
          <div class="control-section-title">版本与模式</div>
          <div class="control-form-row">
            <span>基准版本</span>
            <el-input
              v-if="lockBaseline"
              :model-value="fixedBaselineVersionLabel"
              size="small"
              style="width: 210px"
              disabled
            />
            <el-select
              v-else
              v-model="state.baselineVersion"
              size="small"
              style="width: 210px"
              :popper-append-to-body="false"
              @change="handleBaselineVersionChange"
            >
              <el-option
                v-for="item in baselineSelectOptions"
                :key="`drawer_base_${item.key}`"
                :label="item.label"
                :value="item.key"
                :disabled="item.disabled"
              />
            </el-select>
          </div>
          <div v-if="!isDetailMode" class="control-form-row">
            <span>对比版本</span>
            <el-select
              v-model="state.compareVersions"
              multiple
              collapse-tags
              size="small"
              style="width: 210px"
              :popper-append-to-body="false"
              @change="handleCompareVersionsChange"
            >
              <el-option
                v-for="item in compareVersionOptions"
                :key="`drawer_cmp_${(item as any).key}`"
                :label="(item as any).label"
                :value="(item as any).key"
                :disabled="(item as any).required"
              />
              <el-option
                v-if="showAddHistoryOption"
                class="compare-version-add-option"
                :label="addHistoryValveOptionLabel"
                :value="addHistoryValveOptionKey"
              >
                <el-icon><Plus /></el-icon>
                <span>{{ addHistoryValveOptionLabel }}</span>
              </el-option>
              <el-option
                v-if="showOtherProjectOption"
                class="compare-version-add-option"
                :label="otherProjectOptionLabel"
                :value="otherProjectOptionKey"
              >
                <el-icon><Plus /></el-icon>
                <span>{{ otherProjectOptionLabel }}</span>
              </el-option>
            </el-select>
          </div>
          <div class="control-form-row">
            <span>模式</span>
            <el-radio-group v-model="state.viewMode" size="small" @change="handleViewModeChange">
              <el-radio-button label="compare">对比</el-radio-button>
              <el-radio-button label="detail">详情</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <div v-if="!isDetailMode" class="control-section">
          <div class="control-section-title">维度筛选</div>
          <div class="control-form-row">
            <span>年份</span>
            <el-select
              v-model="state.activeYears"
              multiple
              collapse-tags
              size="small"
              style="width: 210px"
              :popper-append-to-body="false"
              @change="handleYearChange"
            >
              <el-option
                v-for="item in reviewYearOptions"
                :key="`drawer_year_${(item as any).value}`"
                :label="(item as any).label"
                :value="(item as any).value"
              />
            </el-select>
          </div>
          <div class="control-switch-row compare-panel-switches">
            <div class="control-switch-chip compare-mode-switch-chip" :class="{ active: state.deltaMode }">
              <el-switch
                v-model="state.deltaMode"
                class="compare-mode-switch"
                active-text="差值模式"
                inactive-text="原值模式"
              />
            </div>
            <div class="control-switch-chip auto-diff-switch-chip" :class="{ active: state.autoDiff }">
              <el-switch
                v-model="state.autoDiff"
                class="auto-diff-switch"
                inactive-text="差异高亮"
              />
            </div>
          </div>
        </div>

        <div class="control-footer">
          <el-button size="small" @click="handleResetCompareControls">重置筛选</el-button>
          <el-button size="small" type="primary" class="tool-primary-btn" @click="compareControlDrawerVisible = false">
            完成
          </el-button>
        </div>
      </div>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
 
import { ref, computed, onMounted, onBeforeUnmount, onUpdated, nextTick } from 'vue';
import { Plus, ArrowRight, ArrowDown, Minus } from '@element-plus/icons-vue';
import { BaseToast } from '@/components/base/BaseToast';

const QUICK_ENTRY_SIZE = 40;
const QUICK_ENTRY_HIT_SIZE = 48;
const QUICK_ENTRY_DRAG_THRESHOLD = 6;
const DEFAULT_FULLSCREEN_TABLE_FONT_SIZE = 16;
const MIN_FULLSCREEN_TABLE_FONT_SIZE = 8;
const FULLSCREEN_TABLE_FONT_SIZE_STEP = 1;
const FULLSCREEN_CELL_X = 12;
const FULLSCREEN_CELL_Y = 4;
const FULLSCREEN_HEAD_X = 12;
const FULLSCREEN_HEAD_Y = 4;
const FULLSCREEN_SUBJECT_COL_MIN_W = 160;
const FULLSCREEN_VALUE_COL_MIN_W = 140;
const FULLSCREEN_VALUE_COL_MAX_W = 200;

 
let measureCanvas: any = null;

// ===== Props =====
const props = defineProps({
  state: { type: Object, required: true },
  fixedBaselineVersionLabel: { type: String, default: "" },
  lockBaseline: { type: Boolean, default: true },
  baselineVersionOptions: { type: Array, default: () => [] },
  compareVersionOptions: { type: Array, default: () => [] },
  addHistoryValveOptionKey: { type: String, default: "" },
  addHistoryValveOptionLabel: { type: String, default: "" },
  otherProjectOptionKey: { type: String, default: "" },
  otherProjectOptionLabel: { type: String, default: "" },
  reviewYearOptions: { type: Array, default: () => [] },
  isDetailMode: { type: Boolean, default: false },
  compareColumnDefs: { type: Array, default: () => [] },
  compareHeaderVersions: { type: Array, default: () => [] },
  displaySubjectRows: { type: Array, default: () => [] },
  detailColumnDefs: { type: Array, default: () => [] },
  detailHeaderGroups: { type: Array, default: () => [] },
  compareTableStyle: { type: Object, default: () => ({}) },
  detailTableStyle: { type: Object, default: () => ({}) },
  fixedFeeParentSubjectId: { type: String, default: "fixed_total" },
  fullscreenHostSelector: { type: String, default: ".main-table-compare-fullscreen-host" },
  showCalculator: { type: Boolean, default: true },
  enableFullscreen: { type: Boolean, default: true },
  showAddHistoryOption: { type: Boolean, default: true },
  showOtherProjectOption: { type: Boolean, default: true },
  resetCompareControls: { type: Function, default: () => {} },
  openCalcDrawer: { type: Function, default: () => {} },
  onCompareVersionsChange: { type: Function, default: () => {} },
  onBaselineVersionChange: { type: Function, default: () => {} },
  onViewModeChange: { type: Function, default: () => {} },
  onYearChange: { type: Function, default: () => {} },
  versionHeadStyle: { type: Function, default: () => ({}) },
  isFrozenCompareVersion: { type: Function, default: () => false },
  yearHeadStyle: { type: Function, default: () => ({}) },
  sectionFillCellClass: { type: Function, default: () => [] },
  compareCellStyle: { type: Function, default: () => ({}) },
  formatSubjectGroupLabel: { type: Function, default: () => "-" },
  isMeetingModuleLoading: { type: Function, default: () => false },
  isMeetingModuleError: { type: Function, default: () => false },
  retryMeetingModule: { type: Function, default: () => {} },
  isManualRowHighlighted: { type: Function, default: () => false },
  isSubjectCollapseParent: { type: Function, default: () => false },
  isSubjectCollapsed: { type: Function, default: () => false },
  toggleSubjectCollapse: { type: Function, default: () => {} },
  toggleManualRowHighlight: { type: Function, default: () => {} },
   
  displayUiText: { type: Function, default: (value: any) => String(value == null ? "" : value) },
  compareCellClass: { type: Function, default: () => [] },
  isManualCellHighlighted: { type: Function, default: () => false },
  toggleManualCellHighlight: { type: Function, default: () => {} },
  compareCellText: { type: Function, default: () => "-" },
  detailCellText: { type: Function, default: () => "-" },
});

// ===== Template refs =====
 
const rootRef = ref<any>(null);
 
const tableFullscreenTargetRef = ref<any>(null);
 
const compareTableWrapRef = ref<any>(null);

// ===== Reactive state =====
const tableSystemFullscreen = ref(false);
const tableFullscreenCentered = ref(false);
let tableFullscreenLayoutRaf: number | null = null;
let tableFullscreenLayoutTimer: number | null = null;
const fullscreenModeTipVisible = ref(false);
let fullscreenModeTipTimer: number | null = null;
const compareControlDrawerVisible = ref(false);
const fullscreenQuickMenuVisible = ref(false);
const quickEntryPosition = ref({ x: 0, y: 0 });
const quickEntryDragging = ref(false);
const quickEntryDragOffset = ref({ x: 0, y: 0 });
const quickEntryDragStart = ref({ x: 0, y: 0 });
let quickEntryMoved = false;
let quickEntryIgnoreNextClick = false;
let quickEntryClickGuardTimer: number | null = null;
const fullscreenTableFontSize = ref(DEFAULT_FULLSCREEN_TABLE_FONT_SIZE);

// ===== Computed =====
const isFixedFeeCollapsed = computed(() => {
  return props.isSubjectCollapsed(props.fixedFeeParentSubjectId);
});

const controlDrawerSize = computed(() => {
  return tableSystemFullscreen.value ? "360px" : "420px";
});

const fullscreenTableFontSizeValue = computed(() => {
  return normalizeFullscreenTableFontSize(fullscreenTableFontSize.value);
});

const fullscreenTableFontSizeLabel = computed(() => {
  return `${fullscreenTableFontSizeValue.value}px`;
});

const fullscreenTableFontSizeTip = computed(() => {
  return `当前字号：${fullscreenTableFontSizeLabel.value}`;
});

const isFullscreenTableFontSizeMin = computed(() => {
  return fullscreenTableFontSizeValue.value <= MIN_FULLSCREEN_TABLE_FONT_SIZE;
});

 
const baselineSelectOptions = computed((): any[] => {
  const options = Array.isArray(props.baselineVersionOptions)
    ? props.baselineVersionOptions
    : [];
  if (options.length) return options;
  const state = props.state as Record<string, unknown>;
  const currentKey = state && state.baselineVersion;
  const currentLabel = props.fixedBaselineVersionLabel || currentKey;
  const compareOptions = Array.isArray(props.compareVersionOptions)
    ? props.compareVersionOptions
    : [];
   
  if (!currentKey || compareOptions.some((item: any) => item && item.key === currentKey)) {
    return compareOptions;
  }
  return [{ key: currentKey, label: currentLabel }].concat(compareOptions as any[]);
});

const fullscreenEntryStyle = computed(() => {
  if (!tableSystemFullscreen.value) return {};
  return {
    left: `${quickEntryPosition.value.x}px`,
    top: `${quickEntryPosition.value.y}px`,
  };
});

const fullscreenDockStyle = computed(() => {
  if (!tableSystemFullscreen.value) return {};
  const card = tableFullscreenTargetRef.value;
  const rect = card && card.getBoundingClientRect
    ? card.getBoundingClientRect()
    : { width: window.innerWidth || 1280, height: window.innerHeight || 720 };
  const entrySize = QUICK_ENTRY_SIZE;
  const dockWidth = 156;
  const dockHeight = props.showCalculator ? 172 : 128;
  const gap = 8;
  const preferRight = quickEntryPosition.value.x + entrySize + gap;
  const preferLeft = quickEntryPosition.value.x - dockWidth - gap;
  const left = preferRight + dockWidth <= rect.width
    ? preferRight
    : Math.max(8, preferLeft);
  const centerTop = quickEntryPosition.value.y + entrySize / 2 - dockHeight / 2;
  const top = Math.min(Math.max(centerTop, 8), Math.max(8, rect.height - dockHeight - 8));
  return { left: `${left}px`, top: `${top}px` };
});

// ===== Methods =====
 
function formatSubjectName(item: any = {}): string {
  const name = props.displayUiText(item && item.name);
  const unit = String(item && item.unit == null ? "" : item.unit).trim();
  if (!String(name || "").trim() || !unit) return name;
  const displayUnit = props.displayUiText(unit);
  if (!displayUnit) return name;
  const suffixes = [`(${displayUnit})`, `（${displayUnit}）`];
  return suffixes.some((suffix: any) => String(name).endsWith(suffix))
    ? name
    : `${name}(${displayUnit})`;
}

function getFullscreenHost(): HTMLElement | null {
  const el = rootRef.value;
  if (props.fullscreenHostSelector && el && el.closest) {
    const host = el.closest(props.fullscreenHostSelector);
    if (host) return host;
  }
  return el;
}

function applyHostFullscreenClass(): void {
  const host = getFullscreenHost();
  if (host && host.classList) {
    host.classList.add("is-table-fullscreen");
  }
}

function removeHostFullscreenClass(): void {
  const host = getFullscreenHost();
  if (host && host.classList) {
    host.classList.remove("is-table-fullscreen");
  }
}

function handleResetCompareControls(): void {
  props.resetCompareControls();
  nextTick(() => scheduleFullscreenTableLayout());
}

function handleOpenCalcDrawer(): void {
  fullscreenQuickMenuVisible.value = false;
  compareControlDrawerVisible.value = false;
  if (typeof props.openCalcDrawer === "function") {
    props.openCalcDrawer();
  }
}

function handleCompareVersionsChange(): void {
  props.onCompareVersionsChange();
  nextTick(() => scheduleFullscreenTableLayout());
}

 
function handleBaselineVersionChange(value: any): void {
  const state = props.state as Record<string, unknown>;
  if (state && Array.isArray(state.compareVersions)) {
    state.compareVersions = state.compareVersions.filter((key: unknown) => key !== value);
  }
  props.onBaselineVersionChange(value);
  nextTick(() => scheduleFullscreenTableLayout());
}

function handleViewModeChange(): void {
  props.onViewModeChange();
  nextTick(() => scheduleFullscreenTableLayout());
}

function handleYearChange(): void {
  props.onYearChange();
  nextTick(() => scheduleFullscreenTableLayout());
}

 
function handleSubjectCollapseClick(item: any): void {
  if (!props.isSubjectCollapseParent(item)) return;
  props.toggleSubjectCollapse(item.id);
  nextTick(() => {
    scheduleFullscreenTableLayout();
    scheduleFullscreenTableLayoutAfterRowsSettle();
  });
}

async function toggleTableSystemFullscreen(): Promise<void> {
  if (tableSystemFullscreen.value) {
    await leaveTableFullscreen();
    return;
  }
  await enterTableFullscreen();
}

async function enterTableFullscreen(): Promise<void> {
  const target = getFullscreenHost();
  if (!target) return;
  try {
    await requestElementFullscreen(target);
    applyTableFullscreenState();
     
  } catch (error: any) {
    console.error("[main-table-compare] request fullscreen failed:", error);
    BaseToast.warning("浏览器全屏调用失败，请检查浏览器权限");
  }
}

function applyTableFullscreenState(): void {
  tableSystemFullscreen.value = true;
  tableFullscreenCentered.value = false;
  fullscreenQuickMenuVisible.value = false;
  quickEntryDragging.value = false;
  quickEntryMoved = false;
  applyHostFullscreenClass();
  if (!props.isSubjectCollapsed(props.fixedFeeParentSubjectId)) {
    props.toggleSubjectCollapse(props.fixedFeeParentSubjectId);
  }
  lockPageScroll();
  showFullscreenModeTip();
  nextTick(() => {
    resetQuickEntryPosition();
    scheduleFullscreenTableLayout();
  });
}

async function leaveTableFullscreen(): Promise<void> {
  tableSystemFullscreen.value = false;
  tableFullscreenCentered.value = false;
  compareControlDrawerVisible.value = false;
  fullscreenQuickMenuVisible.value = false;
  quickEntryDragging.value = false;
  clearFullscreenTableFitStyles();
  hideFullscreenModeTip();
  removeHostFullscreenClass();
  unlockPageScroll();
  const target = getFullscreenHost();
  const currentFullscreenEl = getFullscreenElement();
  if (target && currentFullscreenEl === target) {
    await exitDocumentFullscreen();
  }
}

function scheduleFullscreenTableLayout(): void {
  if (!tableSystemFullscreen.value) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  if (tableFullscreenLayoutRaf) {
    window.cancelAnimationFrame(tableFullscreenLayoutRaf);
  }
  tableFullscreenLayoutRaf = window.requestAnimationFrame(() => {
    tableFullscreenLayoutRaf = null;
    updateFullscreenTableLayout();
  });
}

function updateFullscreenTableLayout(): void {
  if (!tableSystemFullscreen.value) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  const wrap = compareTableWrapRef.value;
  const table = wrap && wrap.querySelector ? wrap.querySelector(".compare-table") : null;
  if (!wrap || !table) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  applyFullscreenColumnLayout(table, wrap);
  if (!isFixedFeeCollapsed.value) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableRowFitStyles(table);
    return;
  }
  const body = table.tBodies && table.tBodies[0];
  const visibleRows = body
    ? Array.from(body.rows).filter((row: any) => {
      if (!row || row.classList.contains("is-fixed-fee-collapsed")) return false;
      return window.getComputedStyle(row).display !== "none";
    }).length
    : 0;
  if (!visibleRows) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  const wrapHeight = Math.max(0, Number(wrap.clientHeight) || 0);
  if (!wrapHeight) {
    tableFullscreenCentered.value = false;
    clearFullscreenTableFitStyles();
    return;
  }
  const visibleHeadRows = table.tHead
    ? Array.from(table.tHead.rows).filter((row: any) => (
      window.getComputedStyle(row).display !== "none"
    )).length
    : 0;
  const fullscreenFontSize = fullscreenTableFontSizeValue.value;
  const minBodyRowHeight = Math.ceil(fullscreenFontSize * 1.45 + FULLSCREEN_CELL_Y * 2);
  const maxBodyRowHeight = Math.max(28, wrapHeight);
  const minHeadRowHeight = Math.ceil(fullscreenFontSize * 1.45 + FULLSCREEN_HEAD_Y * 2);
  const maxHeadRowHeight = Math.max(32, minHeadRowHeight);
  const applySizing = (bodyRowHeight: number, headRowHeight: number) => {
    const targetBodyRowHeight = Math.max(minBodyRowHeight, bodyRowHeight);
    const lineHeight = Math.max(
      Math.ceil(fullscreenFontSize * 1.25),
      targetBodyRowHeight - FULLSCREEN_CELL_Y * 2 - 1
    );
    const targetHeadRowHeight = visibleHeadRows
      ? Math.max(minHeadRowHeight, headRowHeight)
      : 0;
    const headLineHeight = visibleHeadRows
      ? Math.max(Math.ceil(fullscreenFontSize * 1.25), targetHeadRowHeight - FULLSCREEN_HEAD_Y * 2 - 1)
      : Math.ceil(fullscreenFontSize * 1.25);
    table.style.setProperty("--fullscreen-table-h", `${wrapHeight}px`);
    table.style.setProperty("--fullscreen-row-h", `${targetBodyRowHeight}px`);
    table.style.setProperty("--fullscreen-cell-y", `${FULLSCREEN_CELL_Y}px`);
    table.style.setProperty("--fullscreen-cell-x", `${FULLSCREEN_CELL_X}px`);
    table.style.setProperty("--fullscreen-line-h", `${lineHeight}px`);
    table.style.setProperty("--fullscreen-head-row-h", `${targetHeadRowHeight}px`);
    table.style.setProperty("--fullscreen-head-y", `${FULLSCREEN_HEAD_Y}px`);
    table.style.setProperty("--fullscreen-head-x", `${FULLSCREEN_HEAD_X}px`);
    table.style.setProperty("--fullscreen-head-line-h", `${headLineHeight}px`);
    table.style.setProperty("--fullscreen-user-font-size", `${fullscreenFontSize}px`);
    table.style.setProperty("--fullscreen-user-head-font-size", `${fullscreenFontSize}px`);
    table.style.setProperty("--fullscreen-user-section-font-size", `${fullscreenFontSize}px`);
  };
  let headRowHeight = visibleHeadRows ? maxHeadRowHeight : 0;
  applySizing(maxBodyRowHeight, headRowHeight);
  const headHeight = table.tHead ? Number(table.tHead.offsetHeight) || 0 : 0;
  const bodyAvailable = Math.max(minBodyRowHeight, wrapHeight - headHeight - visibleRows - 4);
  let rowHeight = Math.max(minBodyRowHeight, Math.min(maxBodyRowHeight, bodyAvailable / visibleRows));
  applySizing(rowHeight, headRowHeight);
  for (let i = 0; i < 32; i += 1) {
    const rendered = Number(table.offsetHeight) || 0;
    const overflow = rendered - wrapHeight;
    if (Math.abs(overflow) <= 0.5) break;
    if (overflow > 0 && rowHeight > minBodyRowHeight) {
      rowHeight = Math.max(minBodyRowHeight, rowHeight - Math.max(0.1, overflow / visibleRows));
    } else if (overflow > 0 && headRowHeight > minHeadRowHeight) {
      headRowHeight = Math.max(minHeadRowHeight, headRowHeight - Math.max(0.1, overflow / Math.max(1, visibleHeadRows)));
    } else if (overflow < 0 && rowHeight < maxBodyRowHeight) {
      rowHeight = Math.min(maxBodyRowHeight, rowHeight + Math.max(0.1, Math.abs(overflow) / visibleRows));
    } else {
      break;
    }
    applySizing(rowHeight, headRowHeight);
  }
  const renderedHeight = Number(table.offsetHeight) || 0;
  tableFullscreenCentered.value = renderedHeight > 0 && Math.abs(renderedHeight - wrapHeight) <= 1;
}

function clearFullscreenTableFitStyles(): void {
  const wrap = compareTableWrapRef.value;
  const table = wrap && wrap.querySelector ? wrap.querySelector(".compare-table") : null;
  if (!table) return;
  clearFullscreenTableRowFitStyles(table);
  [
    "--fullscreen-user-font-size",
    "--fullscreen-user-head-font-size",
    "--fullscreen-user-section-font-size",
    "--fullscreen-subject-col-w",
    "--fullscreen-value-col-min-w",
    "--fullscreen-value-col-w",
    "--fullscreen-table-w",
  ].forEach((name: any) => table.style.removeProperty(name));
}

function clearFullscreenTableRowFitStyles(table: HTMLElement): void {
  if (!table) return;
  [
    "--fullscreen-row-h",
    "--fullscreen-table-h",
    "--fullscreen-cell-y",
    "--fullscreen-cell-x",
    "--fullscreen-line-h",
    "--fullscreen-head-row-h",
    "--fullscreen-head-y",
    "--fullscreen-head-x",
    "--fullscreen-head-line-h",
  ].forEach((name: any) => table.style.removeProperty(name));
}

function applyFullscreenColumnLayout(table: HTMLElement, wrap: HTMLElement): void {
  const valueColumnCount = getFullscreenValueColumnCount(table);
  const subjectWidth = getFullscreenSubjectColumnWidth(table);
  const fullscreenFontSize = fullscreenTableFontSizeValue.value;
  const wrapWidth = Math.max(0, Number(wrap && wrap.clientWidth) || 0);
  const subjectColW = Math.ceil(subjectWidth);
  const availableValueWidth = Math.max(0, wrapWidth - subjectWidth - valueColumnCount);
  const evenValueWidth = valueColumnCount
    ? availableValueWidth / valueColumnCount
    : FULLSCREEN_VALUE_COL_MIN_W;
  const clampedValueWidth = Math.max(
    FULLSCREEN_VALUE_COL_MIN_W,
    Math.min(FULLSCREEN_VALUE_COL_MAX_W, evenValueWidth || 0)
  );
  const rawTableWidth = Math.ceil(subjectWidth + clampedValueWidth * valueColumnCount);
  const tableWidth = Math.max(rawTableWidth, wrapWidth);
  const valueWidth = valueColumnCount
    ? Math.max(FULLSCREEN_VALUE_COL_MIN_W, Math.ceil((tableWidth - subjectColW) / valueColumnCount))
    : clampedValueWidth;
  table.style.setProperty("--fullscreen-user-font-size", `${fullscreenFontSize}px`);
  table.style.setProperty("--fullscreen-user-head-font-size", `${fullscreenFontSize}px`);
  table.style.setProperty("--fullscreen-user-section-font-size", `${fullscreenFontSize}px`);
  table.style.setProperty("--fullscreen-subject-col-w", `${subjectColW}px`);
  table.style.setProperty("--fullscreen-value-col-min-w", `${FULLSCREEN_VALUE_COL_MIN_W}px`);
  table.style.setProperty("--fullscreen-value-col-w", `${valueWidth}px`);
  table.style.setProperty("--fullscreen-table-w", `${tableWidth}px`);
}

function getFullscreenValueColumnCount(table: HTMLElement): number {
  const colCount = table && table.querySelectorAll
    ? table.querySelectorAll("col.value-width-col").length
    : 0;
  if (colCount) return colCount;
  const defs = props.isDetailMode ? props.detailColumnDefs : props.compareColumnDefs;
  return Math.max(1, Array.isArray(defs) ? defs.length : 0);
}

function getFullscreenSubjectColumnWidth(table: HTMLElement): number {
  const font = getFullscreenSubjectMeasureFont(table);
  let maxTextWidth = measureFullscreenTextWidth("科目", font);
   
  (Array.isArray(props.displaySubjectRows) ? props.displaySubjectRows : []).forEach((row: any) => {
    if (!row) return;
    const text = row.type === "section"
      ? props.formatSubjectGroupLabel(row.group)
      : formatSubjectName(row.item);
    if (!text) return;
    const iconWidth = row.type !== "section" && props.isSubjectCollapseParent(row.item) ? 24 : 0;
    maxTextWidth = Math.max(maxTextWidth, measureFullscreenTextWidth(text, font) + iconWidth);
  });
  return Math.max(FULLSCREEN_SUBJECT_COL_MIN_W, Math.ceil(maxTextWidth + FULLSCREEN_CELL_X * 2 + 8));
}

function getFullscreenSubjectMeasureFont(table: HTMLElement): string {
  const fallback = `${fullscreenTableFontSizeValue.value}px sans-serif`;
  if (typeof window === "undefined" || !table || !table.querySelector) return fallback;
  const sample =
    table.querySelector("tbody .subject-col") ||
    table.querySelector("thead .subject-col") ||
    table;
  const style = window.getComputedStyle(sample);
  const family = style.fontFamily || "sans-serif";
  return `700 ${fullscreenTableFontSizeValue.value}px ${family}`;
}

function measureFullscreenTextWidth(text: unknown, font: string): number {
  const value = String(text == null ? "" : text);
  if (!value) return 0;
  if (typeof document === "undefined") return value.length * fullscreenTableFontSizeValue.value;
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }
  const context = measureCanvas.getContext && measureCanvas.getContext("2d");
  if (!context) return value.length * fullscreenTableFontSizeValue.value;
  context.font = font;
  return context.measureText(value).width;
}

function scheduleFullscreenTableLayoutAfterRowsSettle(): void {
  if (!tableSystemFullscreen.value) return;
  if (tableFullscreenLayoutTimer) {
    window.clearTimeout(tableFullscreenLayoutTimer);
  }
  tableFullscreenLayoutTimer = window.setTimeout(() => {
    tableFullscreenLayoutTimer = null;
    scheduleFullscreenTableLayout();
  }, 320);
}

function openCompareControlDrawer(): void {
  fullscreenQuickMenuVisible.value = false;
  nextTick(() => {
    compareControlDrawerVisible.value = true;
  });
}

function toggleFullscreenQuickMenu(): void {
  fullscreenQuickMenuVisible.value = !fullscreenQuickMenuVisible.value;
}

function normalizeFullscreenTableFontSize(input: number): number {
  const size = Math.round(Number(input));
  return Number.isFinite(size)
    ? Math.max(MIN_FULLSCREEN_TABLE_FONT_SIZE, size)
    : DEFAULT_FULLSCREEN_TABLE_FONT_SIZE;
}

function setFullscreenTableFontSize(size: number): void {
  fullscreenTableFontSize.value = normalizeFullscreenTableFontSize(size);
  nextTick(() => scheduleFullscreenTableLayout());
}

function increaseFullscreenTableFontSize(): void {
  setFullscreenTableFontSize(fullscreenTableFontSizeValue.value + FULLSCREEN_TABLE_FONT_SIZE_STEP);
}

function decreaseFullscreenTableFontSize(): void {
  setFullscreenTableFontSize(fullscreenTableFontSizeValue.value - FULLSCREEN_TABLE_FONT_SIZE_STEP);
}

function onQuickEntryClick(): void {
  if (quickEntryIgnoreNextClick) {
    quickEntryIgnoreNextClick = false;
    return;
  }
  if (quickEntryMoved) {
    quickEntryMoved = false;
    return;
  }
  toggleFullscreenQuickMenu();
}

 
function getPointerPosition(event: any): { clientX: number; clientY: number } {
  if (!event) return { clientX: 0, clientY: 0 };
  const touch = event.touches && event.touches[0]
    ? event.touches[0]
    : event.changedTouches && event.changedTouches[0]
      ? event.changedTouches[0]
      : event;
  return { clientX: Number(touch.clientX) || 0, clientY: Number(touch.clientY) || 0 };
}

 
function startQuickEntryDrag(event: any): void {
  if (!tableSystemFullscreen.value) return;
  const card = tableFullscreenTargetRef.value;
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const point = getPointerPosition(event);
  quickEntryDragging.value = true;
  quickEntryMoved = false;
  quickEntryDragStart.value = { x: point.clientX, y: point.clientY };
  quickEntryDragOffset.value = {
    x: point.clientX - rect.left - quickEntryPosition.value.x,
    y: point.clientY - rect.top - quickEntryPosition.value.y,
  };
}

 
function onQuickEntryDragMove(event: any): void {
  if (!quickEntryDragging.value || !tableSystemFullscreen.value) return;
  const card = tableFullscreenTargetRef.value;
  if (!card) return;
  if (event && event.cancelable) {
    event.preventDefault();
  }
  const rect = card.getBoundingClientRect();
  const point = getPointerPosition(event);
  const moveX = point.clientX - quickEntryDragStart.value.x;
  const moveY = point.clientY - quickEntryDragStart.value.y;
  const movedDistance = Math.sqrt(moveX * moveX + moveY * moveY);
  if (!quickEntryMoved && movedDistance < QUICK_ENTRY_DRAG_THRESHOLD) {
    return;
  }
  const nextX = point.clientX - rect.left - quickEntryDragOffset.value.x;
  const nextY = point.clientY - rect.top - quickEntryDragOffset.value.y;
  quickEntryPosition.value = clampQuickEntryPosition(nextX, nextY, rect);
  quickEntryMoved = true;
}

function stopQuickEntryDrag(): void {
  quickEntryDragging.value = false;
}

function onQuickEntryTouchEnd(): void {
  const moved = quickEntryMoved;
  stopQuickEntryDrag();
  if (moved) {
    quickEntryMoved = false;
    return;
  }
  quickEntryIgnoreNextClick = true;
  if (quickEntryClickGuardTimer) {
    window.clearTimeout(quickEntryClickGuardTimer);
  }
  quickEntryClickGuardTimer = window.setTimeout(() => {
    quickEntryIgnoreNextClick = false;
    quickEntryClickGuardTimer = null;
  }, 350);
  toggleFullscreenQuickMenu();
}

function clampQuickEntryPosition(x: number, y: number, rect: DOMRect): { x: number; y: number } {
  const width = (rect && rect.width) || window.innerWidth || 1280;
  const height = (rect && rect.height) || window.innerHeight || 720;
  const btnSize = QUICK_ENTRY_HIT_SIZE;
  const margin = 8;
  return {
    x: Math.min(Math.max(Number(x) || 0, margin), Math.max(margin, width - btnSize - margin)),
    y: Math.min(Math.max(Number(y) || 0, margin), Math.max(margin, height - btnSize - margin)),
  };
}

function resetQuickEntryPosition(): void {
  const card = tableFullscreenTargetRef.value;
  const rect = card && card.getBoundingClientRect
    ? card.getBoundingClientRect()
    : { width: window.innerWidth || 1280, height: window.innerHeight || 720 };
  quickEntryPosition.value = clampQuickEntryPosition(16, 16, rect);
}

function lockPageScroll(): void {
  if (typeof document === "undefined" || !document.body) return;
  document.body.classList.add("meeting-review-fullscreen-lock");
}

function unlockPageScroll(): void {
  if (typeof document === "undefined" || !document.body) return;
  document.body.classList.remove("meeting-review-fullscreen-lock");
}

function showFullscreenModeTip(): void {
  if (fullscreenModeTipTimer) {
    window.clearTimeout(fullscreenModeTipTimer);
  }
  fullscreenModeTipVisible.value = true;
  fullscreenModeTipTimer = window.setTimeout(() => {
    fullscreenModeTipVisible.value = false;
    fullscreenModeTipTimer = null;
  }, 1600);
}

function hideFullscreenModeTip(): void {
  if (fullscreenModeTipTimer) {
    window.clearTimeout(fullscreenModeTipTimer);
    fullscreenModeTipTimer = null;
  }
  fullscreenModeTipVisible.value = false;
}

 
function onDocumentClick(event: any): void {
  if (!tableSystemFullscreen.value || !fullscreenQuickMenuVisible.value) return;
  const target = event && event.target;
  if (
    target &&
    target.closest &&
    (target.closest(".fullscreen-edge-entry") || target.closest(".fullscreen-quick-dock"))
  ) {
    return;
  }
  fullscreenQuickMenuVisible.value = false;
}

async function requestElementFullscreen(element: any): Promise<void> {
  const fn =
    element.requestFullscreen ||
    (element as any).webkitRequestFullscreen ||
    (element as any).mozRequestFullScreen ||
    (element as any).msRequestFullscreen;
  if (fn) {
    await fn.call(element);
    return;
  }
  throw new Error("Fullscreen API is not supported by this browser");
}

async function exitDocumentFullscreen(): Promise<void> {
  const fn =
    (document as any).exitFullscreen ||
    (document as any).webkitExitFullscreen ||
    (document as any).mozCancelFullScreen ||
    (document as any).msExitFullscreen;
  if (fn) {
    await fn.call(document);
  }
}

function getFullscreenElement(): HTMLElement | null {
  return (
    (document as any).fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement ||
    null
  );
}

function onFullscreenChange(): void {
  const target = getFullscreenHost();
  const currentFullscreenEl = getFullscreenElement();
  const isNativeFullscreen = Boolean(target && currentFullscreenEl === target);
  if (isNativeFullscreen && !tableSystemFullscreen.value) {
    applyTableFullscreenState();
  }
  if (!isNativeFullscreen && currentFullscreenEl == null && tableSystemFullscreen.value) {
    leaveTableFullscreen();
  }
}

 
function onGlobalKeydown(event: any): void {
  if (!event || event.key !== "Escape") return;
  if (!tableSystemFullscreen.value) return;
  event.preventDefault();
  leaveTableFullscreen();
}

// ===== Lifecycle =====
onMounted(() => {
  window.addEventListener("keydown", onGlobalKeydown);
  window.addEventListener("resize", scheduleFullscreenTableLayout);
  window.addEventListener("mousemove", onQuickEntryDragMove);
  window.addEventListener("mouseup", stopQuickEntryDrag);
  window.addEventListener("touchmove", onQuickEntryDragMove, { passive: false });
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
  if (tableFullscreenLayoutRaf) {
    window.cancelAnimationFrame(tableFullscreenLayoutRaf);
    tableFullscreenLayoutRaf = null;
  }
  if (tableFullscreenLayoutTimer) {
    window.clearTimeout(tableFullscreenLayoutTimer);
    tableFullscreenLayoutTimer = null;
  }
  if (fullscreenModeTipTimer) {
    window.clearTimeout(fullscreenModeTipTimer);
    fullscreenModeTipTimer = null;
  }
  if (quickEntryClickGuardTimer) {
    window.clearTimeout(quickEntryClickGuardTimer);
    quickEntryClickGuardTimer = null;
  }
  removeHostFullscreenClass();
  unlockPageScroll();
});

onUpdated(() => {
  if (tableSystemFullscreen.value) {
    scheduleFullscreenTableLayout();
  }
});
</script>

<!-- Styles unchanged - kept as-is from original -->
<style lang="scss" scoped>
.main-table-compare-panel {
  --g-bg: #fafaf9;
  --g-surface: #ffffff;
  --g-focus-bg: #eff6ff;
  --g-line: #e7e5e4;
  --g-line-strong: #d6d3d1;
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
  --g-impact-neg: #7c2d12;
  --g-radius-sm: 4px;
  --g-radius-md: 6px;
  --g-shadow-xs: 0 0 0 1px rgba(12, 10, 9, 0.04);
  --g-focus-ring: 0 0 0 3px rgba(0, 113, 227, 0.08);
  --g-motion: 180ms cubic-bezier(0.4, 0, 0.2, 1);
  --g-font-mono: "SF Mono", "JetBrains Mono", "Roboto Mono", monospace;
}

.card-block {
  margin: 10px 18px 0;
  border: 1px solid var(--g-line);
  border-radius: var(--g-radius-md);
  background: var(--g-surface);
  padding: 14px;
  box-shadow: var(--g-shadow-xs);
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

.toolbar-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-line-controls {
  align-items: center;
}

.toolbar-line-actions {
  justify-content: flex-end;
}

.toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
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
}

.toolbar-switch-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  transition: border-color var(--g-motion), background-color var(--g-motion);
}

.toolbar-switch-chip.active,
.compare-mode-switch-chip.active,
.auto-diff-switch-chip.active {
  border-color: var(--g-action-ink);
  background: var(--g-action-ink-soft);
}

:deep(.compare-panel-switches .el-switch) {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  min-height: 20px;
  gap: 8px;
}

:deep(.compare-panel-switches .el-switch__label) {
  color: var(--g-text-3);
  font-size: 11px !important;
  font-weight: 600;
  line-height: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  padding: 0;
}

:deep(.compare-panel-switches .el-switch__label span) {
  font-size: 11px !important;
  line-height: 18px !important;
}

:deep(.compare-panel-switches .el-switch__label.is-active) {
  color: var(--g-action-ink);
}

:deep(.compare-panel-switches .el-switch__core) {
  width: 34px !important;
  height: 20px;
  border-color: #d1d5db;
  background: #e5e7eb;
}

:deep(.compare-panel-switches .el-switch__core:after) {
  width: 14px;
  height: 14px;
  top: 2px;
  background-color: #9ca3af;
}

/* 原值/差值：选中差值模式时轨道与圆点高亮为品牌蓝 */
:deep(.compare-mode-switch.el-switch.is-checked .el-switch__core) {
  border-color: var(--g-action-ink);
  background: var(--g-action-ink);
}

:deep(.compare-mode-switch.el-switch.is-checked .el-switch__core:after) {
  background-color: #ffffff;
}

:deep(.compare-mode-switch.el-switch:not(.is-checked) .el-switch__core) {
  border-color: #d1d5db;
  background: #e5e7eb;
}

:deep(.compare-mode-switch.el-switch:not(.is-checked) .el-switch__core:after) {
  background-color: #9ca3af;
}

/* 差异高亮：圆点居右=开启(蓝底)，居左=关闭(灰底)；仅保留左侧文案 */
:deep(.auto-diff-switch.el-switch .el-switch__label--right) {
  display: none;
}

:deep(.auto-diff-switch.el-switch.is-checked .el-switch__core) {
  border-color: var(--g-action-ink);
  background: var(--g-action-ink);
}

:deep(.auto-diff-switch.el-switch.is-checked .el-switch__core:after) {
  background-color: #ffffff;
}

:deep(.auto-diff-switch.el-switch:not(.is-checked) .el-switch__core) {
  border-color: #d1d5db;
  background: #e5e7eb;
}

:deep(.auto-diff-switch.el-switch:not(.is-checked) .el-switch__core:after) {
  background-color: #9ca3af;
}

.control-switch-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, auto));
  align-items: center;
  gap: 6px;
}

.control-switch-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  transition: border-color var(--g-motion), background-color var(--g-motion);
}

:deep(.toolbar-reset-btn.el-button) {
  border-color: var(--g-line-strong);
  color: var(--g-text-2);
  background: #ffffff;
  border-radius: var(--g-radius-sm);
}

:deep(.toolbar-reset-btn.el-button:hover), :deep(.toolbar-reset-btn.el-button:focus) {
  border-color: var(--g-action-ink);
  color: var(--g-action-ink);
  background: var(--g-action-ink-soft);
}

:deep(.toolbar-calc-btn.el-button), :deep(.toolbar-fullscreen-btn.el-button) {
  border-color: var(--g-action-ink);
  background: var(--g-action-ink);
  color: #fff;
  border-radius: var(--g-radius-sm);
}

:deep(.toolbar-calc-btn.el-button:hover), :deep(.toolbar-calc-btn.el-button:focus),
:deep(.toolbar-fullscreen-btn.el-button:hover), :deep(.toolbar-fullscreen-btn.el-button:focus) {
  border-color: var(--g-action-ink-hover);
  background: var(--g-action-ink-hover);
  color: #fff;
}

:deep(.toolbar-line .el-input__inner), :deep(.toolbar-line .el-select .el-input__inner) {
  border-color: var(--g-line-strong); border-radius: var(--g-radius-sm); background: var(--g-surface);
  transition: border-color var(--g-motion), box-shadow var(--g-motion);
}
:deep(.toolbar-line .el-input__inner:focus), :deep(.toolbar-line .el-select .el-input.is-focus .el-input__inner) {
  border-color: var(--g-action-ink); box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.12);
}
:deep(.compare-version-add-option) { margin-top: 4px; border-top: 1px solid #e7e5e4; color: var(--g-focus); font-weight: 600; }
:deep(.compare-version-add-option i) { margin-right: 6px; font-size: 12px; }

:deep(.toolbar-line .el-radio-button__inner) {
  border-color: #e5e7eb; color: var(--g-text-3); font-size: 11px; font-weight: 600;
  height: 30px; line-height: 28px; padding: 0 12px; background: #fff; transition: all var(--g-motion);
}
:deep(.toolbar-line .el-radio-group) { display: inline-flex; }
:deep(.toolbar-line .el-radio-button__orig-radio:checked + .el-radio-button__inner) {
  border-color: var(--g-tool-accent); background: var(--g-tool-accent-soft); color: var(--g-tool-accent-text); box-shadow: none;
}

.table-wrap { position: relative; overflow: auto; isolation: isolate; border: 1px solid var(--g-line); border-radius: var(--g-radius-sm); max-height: 620px; background: var(--g-surface); }

/* fullscreen / compare-table / drawer styles preserved from original */
.compare-card { position: relative; margin: 8px 12px 0; border: 0; box-shadow: none; }
.compare-card.is-system-fullscreen { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 2400; margin: 0; border-radius: 0; box-shadow: 0 18px 48px rgba(12, 10, 9, 0.2); display: flex; flex-direction: column; background: #ffffff; }
.compare-card.is-system-fullscreen .table-wrap { flex: 1; max-height: none; min-height: 0; border: 0; border-radius: 0; background: transparent; padding-bottom: 0; scrollbar-gutter: stable; }
.compare-card.is-system-fullscreen.is-fixed-fee-collapsed .table-wrap { overflow-x: auto; overflow-y: auto; scrollbar-width: thin; }
.compare-card.is-system-fullscreen.is-fixed-fee-expanded .table-wrap { overflow: auto; scrollbar-width: none; }
.compare-card.is-system-fullscreen.is-fixed-fee-expanded .table-wrap::-webkit-scrollbar:vertical { width: 0; }
.compare-card.is-system-fullscreen.is-fixed-fee-expanded .table-wrap::-webkit-scrollbar:horizontal { height: 8px; }
.compare-card.is-system-fullscreen.is-fixed-fee-expanded .table-wrap::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
.compare-card.is-system-fullscreen.is-table-centered .table-wrap { display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }
.compare-card.is-system-fullscreen .table-wrap .compare-table { --subject-col-w: var(--fullscreen-subject-col-w, 180px) !important; --value-col-min-w: var(--fullscreen-value-col-min-w, 140px) !important; --value-col-w: var(--fullscreen-value-col-w, var(--fullscreen-value-col-min-w, 140px)) !important; width: var(--fullscreen-table-w, auto) !important; min-width: var(--fullscreen-table-w, auto) !important; flex: 0 0 auto; font-size: var(--fullscreen-user-font-size, 16px); }
.compare-card.is-system-fullscreen .compare-table th { font-size: var(--fullscreen-user-head-font-size, 16px); }
.compare-card.is-system-fullscreen .compare-table .section-row .subject-col { font-size: var(--fullscreen-user-section-font-size, var(--fullscreen-user-font-size, 16px)); }
.compare-card.is-system-fullscreen.is-fixed-fee-collapsed .compare-table { font-size: var(--fullscreen-user-font-size, 16px); height: var(--fullscreen-table-h, 100%); }
.compare-card.is-system-fullscreen.is-fixed-fee-collapsed .compare-table thead th { padding-top: var(--fullscreen-head-y, 2px); padding-bottom: var(--fullscreen-head-y, 2px); padding-left: var(--fullscreen-head-x, 12px); padding-right: var(--fullscreen-head-x, 12px); line-height: var(--fullscreen-head-line-h, 20px); overflow: hidden; }
.compare-card.is-system-fullscreen.is-fixed-fee-collapsed .compare-table thead tr:first-child th { height: var(--fullscreen-head-row-h, 24px); }
.compare-card.is-system-fullscreen.is-fixed-fee-collapsed .compare-table thead tr:nth-child(2) th { height: var(--fullscreen-head-row-h, 24px); }
.compare-card.is-system-fullscreen.is-fixed-fee-collapsed .compare-table thead .subject-head-compare { height: calc(var(--fullscreen-head-row-h, 24px) * 2); }
.compare-card.is-system-fullscreen.is-fixed-fee-collapsed .compare-table tbody tr { height: var(--fullscreen-row-h, auto); }
.compare-card.is-system-fullscreen.is-fixed-fee-collapsed .compare-table tbody td { padding-top: var(--fullscreen-cell-y, 3px); padding-bottom: var(--fullscreen-cell-y, 3px); padding-left: var(--fullscreen-cell-x, 12px); padding-right: var(--fullscreen-cell-x, 12px); line-height: var(--fullscreen-line-h, 20px); overflow: hidden; }
.compare-card.is-system-fullscreen.is-fixed-fee-collapsed .compare-table tbody .fixed-fee-cell-inner { height: var(--fullscreen-line-h, 20px); max-height: var(--fullscreen-line-h, 20px); line-height: var(--fullscreen-line-h, 20px); overflow: hidden; }
.compare-card.is-system-fullscreen.is-fixed-fee-collapsed .fixed-fee-detail-row.is-fixed-fee-collapsed { display: none; }

.fullscreen-edge-entry { position: absolute; z-index: 3200; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; pointer-events: auto; touch-action: none; user-select: none; transition: opacity var(--g-motion); }
:deep(.fullscreen-edge-entry .quick-entry-btn.el-button) { width: 40px; height: 40px; padding: 0; border-radius: 50%; border-color: var(--g-action-ink); background: rgba(0, 113, 227, 0.72); color: #fff; font-size: 14px; font-weight: 700; letter-spacing: 0; box-shadow: 0 6px 16px rgba(0, 113, 227, 0.22); }
:deep(.fullscreen-edge-entry .quick-entry-btn.el-button:hover), :deep(.fullscreen-edge-entry .quick-entry-btn.el-button:focus) { border-color: var(--g-action-ink-hover); background: rgba(0, 91, 181, 0.92); color: #fff; }

.fullscreen-quick-dock { position: absolute; z-index: 3200; display: grid; grid-template-columns: 1fr; width: 154px; justify-items: stretch; gap: 6px; padding: 6px; border: 1px solid var(--g-line); border-radius: var(--g-radius-sm); background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(2px); box-sizing: border-box; overflow: visible; }
.fullscreen-quick-dock.has-calculator-action { min-height: 154px; }
.fullscreen-mode-tip { position: absolute; top: 16px; left: 50%; z-index: 3150; transform: translateX(-50%); border: 1px solid #bfdbfe; border-radius: 6px; background: #eff6ff; color: #005bb5; box-shadow: 0 8px 20px rgba(0, 113, 227, 0.16); padding: 8px 14px; font-size: 12px; font-weight: 700; pointer-events: none; }
:deep(.fullscreen-quick-dock .quick-btn.el-button) { margin: 0; width: 100% !important; min-width: 0; display: inline-flex; justify-content: center; border-radius: var(--g-radius-sm); border-color: var(--g-action-ink); color: #fff; background: var(--g-action-ink); font-size: 12px; font-weight: 600; box-sizing: border-box; }
:deep(.fullscreen-quick-dock .quick-btn.el-button + .quick-btn.el-button) { margin-left: 0; }
:deep(.fullscreen-quick-dock .quick-btn.el-button:hover), :deep(.fullscreen-quick-dock .quick-btn.el-button:focus) { border-color: var(--g-action-ink-hover); background: var(--g-action-ink-hover); color: #fff; }

.quick-font-control { display: grid; grid-template-columns: 1fr 28px 48px 28px; align-items: center; gap: 4px; min-height: 28px; padding: 4px; border: 1px solid #bfdbfe; border-radius: var(--g-radius-sm); background: #eff6ff; color: #005bb5; box-sizing: border-box; }
.quick-font-name, .quick-font-value { font-size: 12px; font-weight: 700; line-height: 20px; letter-spacing: 0; text-align: center; white-space: nowrap; }
.quick-font-value { color: var(--g-text); }
:deep(.quick-font-control .quick-font-step.el-button) { width: 28px; height: 24px; min-width: 0; margin: 0; padding: 0; border-radius: var(--g-radius-sm); border-color: #93c5fd; background: #ffffff; color: #005bb5; }
:deep(.quick-font-control .quick-font-step.el-button:hover), :deep(.quick-font-control .quick-font-step.el-button:focus) { border-color: var(--g-action-ink); color: var(--g-action-ink); }
:deep(.quick-font-control .quick-font-step.el-button.is-disabled), :deep(.quick-font-control .quick-font-step.el-button.is-disabled:hover), :deep(.quick-font-control .quick-font-step.el-button.is-disabled:focus) { border-color: #dbeafe; color: #93a4b8; background: #f8fbff; }

.compare-table { --subject-col-w: 132px; --value-col-min-w: 112px; --value-col-w: 112px; border-collapse: separate; border-spacing: 0; table-layout: fixed; font-size: 12px; }
.compare-table th, .compare-table td { border-bottom: 1px solid var(--g-line); border-right: 1px solid var(--g-line); padding: 6px 12px; white-space: nowrap; box-sizing: border-box; }
.compare-table .subject-width-col { width: var(--subject-col-w); }
.compare-table .value-width-col { width: var(--value-col-w); }
.compare-table th:first-child, .compare-table td:first-child { border-left: 1px solid var(--g-line); }
.compare-table tr:first-child th { border-top: 1px solid var(--g-line); }
.compare-table thead { position: sticky; top: 0; z-index: 20; background: var(--g-bg); }
.compare-table th { z-index: 6; background: var(--g-bg); color: var(--g-text-3); text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; }
.compare-table thead tr:first-child th { height: 36px; z-index: 8; }
.compare-table thead tr:nth-child(2) th { z-index: 7; }
.compare-table .subject-col { position: sticky; left: 0; z-index: 9; background: var(--g-surface); color: var(--g-text); text-align: left; width: var(--subject-col-w); min-width: var(--subject-col-w); max-width: var(--subject-col-w); box-shadow: 1px 0 0 0 var(--g-line); }
.compare-table thead .subject-col { background: var(--g-bg); color: var(--g-text-3); z-index: 24; }
.compare-table thead tr:first-child th.subject-head { z-index: 30; background: var(--g-bg); }
.compare-table thead .subject-head { vertical-align: middle; }
.compare-table thead .subject-head-compare { height: 72px; }
.compare-table .trim-head, .compare-table .num-cell, .compare-table .section-fill-cell { min-width: var(--value-col-w); width: var(--value-col-w); }
.compare-table .is-frozen-value-cell { position: sticky; z-index: 8; background: var(--g-surface); box-shadow: 1px 0 0 0 var(--g-line); }
.compare-table .section-row .subject-col { background: #f6f5f4; color: var(--g-text-3); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.compare-table .section-row .section-fill-cell, .compare-table .section-row .section-fill-cell.is-frozen-value-cell { background: #f6f5f4; }
.compare-table .subject-col.bold, .compare-table .subject-col.is-collapse-parent { font-weight: 700; }
.compare-table .subject-col.is-collapse-parent { cursor: pointer; }
.compare-table .subject-cell-content { display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; }
.compare-table .subject-collapse-icon { margin-left: auto; color: var(--g-text-3); font-size: 12px; line-height: 1; transition: color var(--g-motion); }
.compare-table .subject-col.is-collapse-parent:hover .subject-collapse-icon { color: var(--g-focus); }
.compare-table .fixed-fee-detail-row td { transition: padding 0.2s ease, border-color 0.2s ease; }
.compare-table .fixed-fee-cell-inner { max-height: 32px; overflow: hidden; opacity: 1; transform: translateY(0); transition: max-height 0.22s ease, opacity 0.16s ease, transform 0.22s ease; }
.compare-table .fixed-fee-detail-row.is-fixed-fee-collapsed td { padding-top: 0; padding-bottom: 0; border-bottom-color: transparent; }
.compare-table .fixed-fee-detail-row.is-fixed-fee-collapsed .fixed-fee-cell-inner { max-height: 0; opacity: 0; transform: translateY(-8px); }
.compare-table .version-head { text-align: center; font-weight: 700; color: var(--g-text-2); }
.compare-table .trim-head { text-align: center; font-weight: 600; color: var(--g-text-3); text-transform: none; letter-spacing: 0; font-size: 12px; }
.compare-table .num-cell { text-align: right; color: var(--g-text); font-family: var(--g-font-mono); font-variant-numeric: tabular-nums; }
.compare-table .num-cell.baseline { background: #fafaf9; font-weight: 700; }
.compare-table .num-cell.compare.dot-calc { background: #fff8ec; }
.compare-table .num-cell.diff-auto { color: var(--g-impact-neg); font-weight: 700; }
.compare-table tbody tr.is-manual-row-highlight > td,
.compare-table tbody tr.is-manual-row-highlight > td.is-frozen-value-cell,
.compare-table tbody tr.is-manual-row-highlight > td.num-cell.baseline,
.compare-table tbody tr.is-manual-row-highlight > td.num-cell.diff-auto,
.compare-table tbody td.is-manual-cell-highlight { background: #fff4a8 !important; color: #3f2f00; }
.compare-table tbody td.is-manual-cell-highlight { box-shadow: inset 0 0 0 2px #facc15; }
</style>

<style lang="scss">
body.meeting-review-fullscreen-lock { overflow: hidden !important; }
.main-table-compare-fullscreen-host:fullscreen, .main-table-compare-fullscreen-host:-webkit-full-screen { width: 100vw; height: 100vh; overflow: hidden; background: #fff; }
.main-table-compare-fullscreen-host.is-table-fullscreen .el-drawer__wrapper { position: fixed; inset: 0; z-index: 3300 !important; }
.main-table-compare-fullscreen-host.is-table-fullscreen .el-drawer__container { position: relative; width: 100%; height: 100%; }
.main-table-compare-fullscreen-host.is-table-fullscreen .el-drawer.rtl { right: 0; left: auto; }
.main-table-compare-fullscreen-host.is-table-fullscreen .meeting-review-control-drawer,
.main-table-compare-fullscreen-host.is-table-fullscreen .meeting-review-calc-drawer { z-index: 3301 !important; }
.module-inline-state { display: inline-flex; align-items: center; margin-left: 8px; color: #2f6fb3; font-size: 11px; font-weight: 600; line-height: 18px; }
.module-inline-retry { margin-left: 8px; border: 1px solid #f3c7c7; border-radius: 4px; background: #fff7f7; color: #9f2d2d; font-size: 11px; font-weight: 600; line-height: 18px; padding: 0 6px; cursor: pointer; }
</style>
