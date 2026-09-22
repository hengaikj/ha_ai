<script setup lang="ts">
import {
  Close,
  FullScreen,
  Plus,
  RefreshLeft,
  Search,
} from "@element-plus/icons-vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseSplitPane from "@/components/base/BaseSplitPane.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import CostAnalysisCategoryTree from "@/pages/cost/analysis/components/CostAnalysisCategoryTree.vue";
import CostAnalysisConditionList from "@/pages/cost/analysis/components/CostAnalysisConditionList.vue";
import CostAnalysisDifferenceDrawer from "@/pages/cost/analysis/components/CostAnalysisDifferenceDrawer.vue";
import CostAnalysisMatrix from "@/pages/cost/analysis/components/CostAnalysisMatrix.vue";
import {
  useCostAnalysisDifferenceTrace,
  type CostAnalysisTraceCellContext,
} from "@/pages/cost/analysis/composables/useCostAnalysisDifferenceTrace";
import { useCostAnalysisAiAnalysis } from "@/pages/cost/analysis/composables/useCostAnalysisAiAnalysis";
import { useCostAnalysisWorkbench } from "@/pages/cost/analysis/composables/useCostAnalysisWorkbench";
import {
  getCostAnalysisDimensionTitle,
  getCostAnalysisDimensionMaxLevel,
  normalizeCostAnalysisDimensionType,
} from "@/pages/cost/analysis/utils/analysis-dimension";
import {
  COST_ANALYSIS_MATRIX_SORT_LABELS,
  type CostAnalysisMatrixSortMode,
  type CostAnalysisMatrixSortSelection,
} from "@/pages/cost/analysis/utils/matrix-view";
import { useAuthStore } from "@/stores/auth";
import type { CostAnalysisDimensionType, CostAnalysisRemarkUpdate } from "@/types/cost-analysis";

type CategoryTreeInstance = {
  clearSearch: () => void;
};

const authStore = useAuthStore();
const workbench = useCostAnalysisWorkbench();
const differenceTrace = useCostAnalysisDifferenceTrace();
const aiAnalysis = useCostAnalysisAiAnalysis();
const categoryTreeRef = ref<CategoryTreeInstance>();
const isMatrixFocusMode = ref(false);
const matrixSortSelection = ref<CostAnalysisMatrixSortSelection | null>(null);
const canTraceDifferences = computed(() =>
  authStore.hasPermission("cost:analysis:trace"),
);
const hasLoadingBom = computed(() =>
  workbench.conditions.value.some((condition) => condition.loadingBom),
);
const canFocusMatrix = computed(
  () =>
    Boolean(workbench.result.value?.rows.length) &&
    Boolean(workbench.submittedQuery.value),
);
const activeDiffLabel = computed(() => {
  const selection = workbench.diffSelection.value;
  if (!selection) return "";
  const baseline = workbench.diffCandidates.value.find(
    (candidate) => candidate.columnKey === selection.baselineColumnKey,
  );
  return baseline
    ? `基准：${baseline.projectName} / ${baseline.valveName} / ${baseline.patternName}`
    : "";
});
const matrixSortMode = computed<CostAnalysisMatrixSortMode>(
  () => matrixSortSelection.value?.mode ?? "DEFAULT",
);
const matrixSortColumnKey = computed(
  () => matrixSortSelection.value?.columnKey ?? null,
);
const matrixSortColumn = computed(
  () =>
    workbench.result.value?.columns.find(
      (column) => column.columnKey === matrixSortColumnKey.value,
    ) ?? null,
);
const matrixSortSummary = computed(() =>
  matrixSortSelection.value
    ? [
        matrixSortColumn.value
          ? `${matrixSortColumn.value.point.projectName} / ${matrixSortColumn.value.point.valveName} / ${matrixSortColumn.value.pattern.patternName}`
          : null,
        COST_ANALYSIS_MATRIX_SORT_LABELS[matrixSortSelection.value.mode],
      ]
        .flatMap((item) => {
          if (!item) return [];
          return [item];
        })
        .join(" · ")
    : "",
);

function handleProjectChange(clientId: string, projectId: number | null) {
  const project =
    workbench.projects.value.find((item) => item.projectId === projectId) ??
    null;
  return workbench.changeProject(clientId, project);
}

async function handleValveChange(clientId: string, valveId: number | null) {
  const valve =
    workbench.valves.value.find((item) => item.valveId === valveId) ?? null;
  await workbench.changeValve(clientId, valve);
}

function handleReset() {
  setMatrixFocusMode(false);
  clearMatrixSort();
  differenceTrace.reset();
  aiAnalysis.reset();
  workbench.resetWorkbench();
  categoryTreeRef.value?.clearSearch();
}

function handleDimensionTypeChange(value: CostAnalysisDimensionType) {
  setMatrixFocusMode(false);
  clearMatrixSort();
  differenceTrace.reset();
  aiAnalysis.reset();
  BaseToast.info(
    `已切换至${getCostAnalysisDimensionTitle(value)}，请重新选择分析对象。`,
  );
  void workbench.changeDimensionType(value);
}

async function handleRunQuery() {
  differenceTrace.reset();
  aiAnalysis.reset();
  await workbench.runQuery();
}

function handleTraceClick(context: CostAnalysisTraceCellContext) {
  if (!canTraceDifferences.value) return;
  void differenceTrace.open(context);
}

function handleDifferenceDrawerVisible(visible: boolean) {
  if (!visible) {
    differenceTrace.close();
  }
}

function handleDiffModeChange(enabled: boolean) {
  const result = workbench.requestDiffMode(enabled);
  if (result === "INSUFFICIENT") {
    BaseToast.warning("请先选择至少 2 个项目 × 阀点 × 版型分析列。");
  }
}

function handleAdjustDiffSelection() {
  if (!workbench.openDiffSelectionDialog()) {
    BaseToast.warning("请先选择至少 2 个项目 × 阀点 × 版型分析列。");
  }
}

function handleMatrixSortChange(selection: CostAnalysisMatrixSortSelection) {
  if (!isMatrixSortSelectionValid(selection)) return;
  matrixSortSelection.value = selection;
}

function clearMatrixSort() {
  matrixSortSelection.value = null;
}

async function handleRemarkBlur(payload: CostAnalysisRemarkUpdate) {
  try {
    await workbench.saveRemark(payload);
  } catch (error) {
    BaseToast.error((error as { message?: string }).message || "备注保存失败，请再次失焦重试。");
  }
}

function isMatrixSortSelectionValid(
  selection: CostAnalysisMatrixSortSelection,
): boolean {
  const result = workbench.result.value;
  const query = workbench.submittedQuery.value;
  if (
    !result?.rows.length ||
    !query ||
    result.categories.length <= 1 ||
    !result.columns.some((column) => column.columnKey === selection.columnKey)
  ) {
    return false;
  }

  if (selection.mode === "VARIANCE_DESC") {
    if (
      result.categoryLevel ===
      getCostAnalysisDimensionMaxLevel(
        normalizeCostAnalysisDimensionType(result.dimensionType),
      )
    )
      return false;
    return true;
  }

  const diffSelection = workbench.activeDiffPointSelection.value;
  return Boolean(
    diffSelection &&
    result.columns.some(
      (column) => column.columnKey === diffSelection.baselineColumnKey,
    ) &&
    selection.columnKey !== diffSelection.baselineColumnKey,
  );
}

function setMatrixFocusMode(enabled: boolean) {
  isMatrixFocusMode.value = enabled && canFocusMatrix.value;
}

function toggleMatrixFocusMode() {
  setMatrixFocusMode(!isMatrixFocusMode.value);
}

function handleMatrixFocusKeydown(event: { key: string }) {
  if (
    event.key === "Escape" &&
    isMatrixFocusMode.value &&
    !workbench.diffSelectionDialogVisible.value &&
    !differenceTrace.visible.value
  ) {
    setMatrixFocusMode(false);
  }
}

function updateDiffDraft(columnKey: string) {
  const current = workbench.diffSelectionDraft.value;
  if (!current) return;
  workbench.diffSelectionDraft.value = {
    ...current,
    baselineColumnKey: columnKey,
  };
}

function confirmDiffSelection() {
  if (!workbench.confirmDiffSelection()) {
    BaseToast.warning("请选择有效的对比基准。");
  }
}

function diffCandidateLabel(columnKey: string): string {
  const condition = workbench.diffCandidates.value.find(
    (candidate) => candidate.columnKey === columnKey,
  );
  if (!condition) return "";
  return `${condition.projectName} / ${condition.valveName} / ${condition.patternName}`;
}

watch(isMatrixFocusMode, (enabled) => {
  document.body.classList.toggle("cost-analysis-focus-mode-open", enabled);
});
watch(
  [
    () => workbench.result.value,
    () => workbench.submittedQuery.value,
    () => workbench.activeDiffPointSelection.value,
  ],
  () => {
    if (
      matrixSortSelection.value &&
      !isMatrixSortSelectionValid(matrixSortSelection.value)
    ) {
      clearMatrixSort();
    }
  },
);

onMounted(() => {
  void workbench.loadBootstrap();
  window.addEventListener("keydown", handleMatrixFocusKeydown);
});
watch(
  () => differenceTrace.path.value.at(-1),
  (entry) => {
    if (!entry) {
      aiAnalysis.clearCurrent();
      return;
    }
    aiAnalysis.selectContext(entry.snapshotId, entry.query);
  },
);
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleMatrixFocusKeydown);
  document.body.classList.remove("cost-analysis-focus-mode-open");
  differenceTrace.reset();
  aiAnalysis.reset();
  workbench.dispose();
});
</script>

<template>
  <PageContainer title="成本分析" class="cost-analysis-workbench">
    <PermissionGuard
      permission="cost:analysis:list"
      mode="placeholder"
      reason="无成本分析查看权限"
    >
      <BaseSplitPane side-width="272px">
        <template #side>
          <CostAnalysisCategoryTree
            ref="categoryTreeRef"
            v-model="workbench.selection.value"
            :dimension-type="workbench.dimensionType.value"
            :data="workbench.categories.value"
            :loading="workbench.loading.bootstrap"
            :error="workbench.bootstrapError.value"
            :validation-error="workbench.categoryValidationError.value"
            @update:dimension-type="handleDimensionTypeChange"
            @browse-level-change="workbench.changeBrowseLevel"
            @retry="workbench.loadBootstrap"
          />
        </template>

        <section
          class="cost-analysis-workbench__main"
          :aria-busy="
            workbench.loading.bootstrap ||
            workbench.loading.query ||
            workbench.loading.export
          "
        >
          <CostAnalysisConditionList
            :model-value="workbench.conditions.value"
            :project-options="workbench.projects.value"
            :valve-options="workbench.valves.value"
            :valve-ids-by-project="workbench.valveIdsByProject.value"
            :validation-errors="workbench.validationErrors.value"
            :diff-selection="workbench.diffSelection.value"
            @remove="workbench.removeCondition"
            @project-change="handleProjectChange"
            @valve-change="handleValveChange"
            @patterns-change="workbench.changePatterns"
          />

          <section
            class="cost-analysis-workbench__result-panel"
            :class="{ 'is-focus-mode': isMatrixFocusMode }"
            data-test="cost-analysis-result-panel"
            aria-label="成本矩阵结果区"
          >
            <div class="cost-analysis-workbench__toolbar">
              <div class="cost-analysis-workbench__query-actions">
                <el-button
                  data-test="cost-analysis-query"
                  type="primary"
                  :icon="Search"
                  :loading="workbench.loading.query"
                  :disabled="
                    workbench.loading.bootstrap ||
                    hasLoadingBom ||
                    Boolean(workbench.bootstrapError.value)
                  "
                  @click="handleRunQuery"
                >
                  查询
                </el-button>
                <el-button
                  data-test="cost-analysis-reset"
                  :icon="RefreshLeft"
                  @click="handleReset"
                >
                  重置
                </el-button>
                <el-button
                  data-test="cost-analysis-add-condition"
                  :icon="Plus"
                  @click="workbench.addCondition"
                >
                  添加条件
                </el-button>
              </div>

              <strong
                v-if="isMatrixFocusMode"
                class="cost-analysis-workbench__focus-title"
              >
                成本矩阵
              </strong>
              <span class="cost-analysis-workbench__toolbar-spacer" />

              <div class="cost-analysis-workbench__view-actions">
                <el-switch
                  data-test="cost-analysis-diff-mode"
                  :model-value="workbench.diffMode.value"
                  active-text="成本列差异对比"
                  @update:model-value="handleDiffModeChange"
                />
                <span
                  v-if="activeDiffLabel"
                  class="cost-analysis-workbench__diff-summary"
                  data-test="cost-analysis-diff-summary"
                  :title="activeDiffLabel"
                >
                  {{ activeDiffLabel }}
                </span>
                <el-button
                  v-if="workbench.diffMode.value"
                  link
                  data-test="cost-analysis-change-diff-selection"
                  @click="handleAdjustDiffSelection"
                >
                  更换基准
                </el-button>
                <div
                  v-if="matrixSortSelection"
                  class="cost-analysis-workbench__sort-controls"
                >
                  <span
                    class="cost-analysis-workbench__sort-status"
                    data-test="cost-analysis-matrix-sort-status"
                    :title="matrixSortSummary"
                  >
                    <span class="cost-analysis-workbench__sort-status-text">
                      {{ matrixSortSummary }}
                    </span>
                    <el-tooltip content="清除矩阵排序" placement="top">
                      <button
                        type="button"
                        class="cost-analysis-workbench__sort-clear"
                        data-test="cost-analysis-matrix-sort-clear"
                        aria-label="清除矩阵排序"
                        @click="clearMatrixSort"
                      >
                        <el-icon aria-hidden="true">
                          <Close />
                        </el-icon>
                      </button>
                    </el-tooltip>
                  </span>
                </div>
                <PermissionButton
                  data-test="cost-analysis-export"
                  permission="cost:analysis:export"
                  :loading="workbench.loading.export"
                  :disabled="
                    !workbench.result.value?.snapshotId ||
                    workbench.loading.export
                  "
                  @click="workbench.exportSnapshot"
                >
                  导出
                </PermissionButton>
                <el-tooltip
                  :content="isMatrixFocusMode ? '退出最大化' : '最大化查看矩阵'"
                  placement="top"
                >
                  <span class="cost-analysis-workbench__focus-toggle">
                    <el-button
                      data-test="cost-analysis-matrix-focus-toggle"
                      :icon="isMatrixFocusMode ? Close : FullScreen"
                      :disabled="!canFocusMatrix"
                      :aria-pressed="isMatrixFocusMode"
                      @click="toggleMatrixFocusMode"
                    >
                      {{ isMatrixFocusMode ? "退出" : "最大化" }}
                    </el-button>
                  </span>
                </el-tooltip>
              </div>
            </div>

            <TraceErrorAlert
              v-if="workbench.exportError.value"
              v-bind="workbench.exportError.value"
            />
            <TraceErrorAlert
              v-if="workbench.queryError.value"
              v-bind="workbench.queryError.value"
            />
            <CostAnalysisMatrix
              v-else-if="
                workbench.result.value?.rows.length &&
                workbench.submittedQuery.value
              "
              :result="workbench.result.value"
              :query="workbench.submittedQuery.value"
              :diff-selection="workbench.activeDiffPointSelection.value"
              :sort-mode="matrixSortMode"
              :sort-column-key="matrixSortColumnKey"
              :traceable="canTraceDifferences"
              :focus-mode="isMatrixFocusMode"
              @difference-click="handleTraceClick"
              @variance-click="handleTraceClick"
              @sort-change="handleMatrixSortChange"
              @sort-clear="clearMatrixSort"
              @remark-blur="handleRemarkBlur"
            />
            <BaseEmpty
              v-else-if="workbench.result.value"
              title="当前查询条件下没有成本分析数据"
              description="请调整分类或对比条件后重新查询。"
            />
            <BaseEmpty
              v-else
              title="请选择分析项并设置对比条件"
              description="完成分析项和对比条件设置后，点击查询生成成本矩阵。"
            />
          </section>
        </section>
      </BaseSplitPane>

      <BaseFormDialog
        v-model="workbench.diffSelectionDialogVisible.value"
        title="选择对比基准"
        width="480px"
        confirm-text="确定"
        compact
        data-test="cost-analysis-diff-selection-dialog"
        @confirm="confirmDiffSelection"
      >
        <el-form label-position="top">
          <el-form-item label="基准对象" required>
            <el-select
              :model-value="
                workbench.diffSelectionDraft.value?.baselineColumnKey
              "
              data-test="cost-analysis-diff-baseline"
              @update:model-value="
                (columnKey: string) => updateDiffDraft(columnKey)
              "
            >
              <el-option
                v-for="candidate in workbench.diffCandidates.value"
                :key="candidate.columnKey"
                :label="diffCandidateLabel(candidate.columnKey)"
                :value="candidate.columnKey"
              />
            </el-select>
          </el-form-item>
          <p class="cost-analysis-workbench__diff-help">
            其他项目 × 阀点 × 版型独立列将自动按“当前列 - 基准列”计算差异。
          </p>
        </el-form>
      </BaseFormDialog>

      <CostAnalysisDifferenceDrawer
        :visible="differenceTrace.visible.value"
        :loading="differenceTrace.loading.value"
        :error="differenceTrace.error.value"
        :result="differenceTrace.current.value"
        :path="differenceTrace.path.value"
        :all-part-rows="differenceTrace.allPartRows.value"
        :all-parts-loading="differenceTrace.allPartsLoading.value"
        :all-parts-error="differenceTrace.allPartsError.value"
        :ai-loading="aiAnalysis.loading.value"
        :ai-error="aiAnalysis.error.value"
        :ai-result="aiAnalysis.current.value"
        ai-enabled
        :can-export="authStore.hasPermission('cost:analysis:export')"
        @update:visible="handleDifferenceDrawerVisible"
        @retry="differenceTrace.retry"
        @show-all-parts="differenceTrace.showAllParts"
        @retry-all-parts="differenceTrace.retryAllParts"
        @generate-ai="aiAnalysis.generate"
        @regenerate-ai="aiAnalysis.regenerate"
        @retry-ai="aiAnalysis.retry"
        @export="workbench.exportSnapshot"
        @drill="differenceTrace.drill"
        @view-level-change="differenceTrace.changeViewLevel"
        @back="differenceTrace.backTo"
      />
    </PermissionGuard>
  </PageContainer>
</template>

<style scoped>
.cost-analysis-workbench__main {
  display: grid;
  min-width: 0;
  gap: var(--bq-space-section);
  align-content: start;
}

.cost-analysis-workbench__result-panel {
  display: grid;
  min-width: 0;
  gap: var(--bq-space-section);
  align-content: start;
}

.cost-analysis-workbench__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--bq-space-sm);
  align-items: center;
  min-width: 0;
  padding-block: var(--bq-space-sm);
  border-block: 1px solid var(--bq-color-divider);
}

.cost-analysis-workbench__query-actions,
.cost-analysis-workbench__view-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--bq-space-sm);
  align-items: center;
  min-width: 0;
}

.cost-analysis-workbench__view-actions {
  justify-content: flex-end;
}

.cost-analysis-workbench__sort-controls {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 4px;
  align-items: center;
}

.cost-analysis-workbench__sort-status {
  display: inline-flex;
  max-width: 240px;
  min-width: 0;
  height: 28px;
  gap: 4px;
  align-items: center;
  padding-inline: 8px 4px;
  border: 1px solid
    color-mix(in srgb, var(--bq-color-primary) 24%, var(--bq-color-divider));
  border-radius: 4px;
  background: color-mix(
    in srgb,
    var(--bq-color-primary-soft) 52%,
    var(--bq-color-surface)
  );
  color: var(--bq-color-primary-active);
  font-size: var(--bq-font-compact);
  font-weight: 600;
}

.cost-analysis-workbench__sort-status-text {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-analysis-workbench__sort-clear {
  display: inline-grid;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: currentcolor;
  cursor: pointer;
  font-size: 12px;
}

.cost-analysis-workbench__sort-clear:hover,
.cost-analysis-workbench__sort-clear:focus-visible {
  background: color-mix(in srgb, var(--bq-color-primary) 12%, transparent);
  outline: none;
}

.cost-analysis-workbench__focus-title {
  color: var(--bq-color-text);
  font-size: 16px;
  line-height: 32px;
}

.cost-analysis-workbench__toolbar-spacer {
  flex: 1 1 24px;
}

.cost-analysis-workbench__diff-summary {
  overflow: hidden;
  max-width: 360px;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-analysis-workbench__focus-toggle {
  display: inline-flex;
}

.cost-analysis-workbench__result-panel.is-focus-mode {
  position: fixed;
  z-index: 1900;
  inset: 0;
  overflow: hidden;
  height: 100dvh;
  grid-template-rows: auto minmax(0, 1fr);
  align-content: stretch;
  padding: 12px 16px 16px;
  background: var(--bq-color-surface);
  overscroll-behavior: contain;
}

.cost-analysis-workbench__result-panel.is-focus-mode
  .cost-analysis-workbench__toolbar {
  position: sticky;
  z-index: 2;
  top: -12px;
  padding-block: 10px;
  border-top: 0;
  background: var(--bq-color-surface);
}

.cost-analysis-workbench__result-panel.is-focus-mode
  .cost-analysis-workbench__query-actions {
  display: none;
}

:global(body.cost-analysis-focus-mode-open) {
  overflow: hidden;
}

.cost-analysis-workbench__diff-help {
  margin: 0;
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-helper);
  line-height: 20px;
}

@media (max-width: 960px) {
  .cost-analysis-workbench__toolbar-spacer {
    flex-basis: 100%;
    height: 0;
  }

  .cost-analysis-workbench__view-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .cost-analysis-workbench__result-panel.is-focus-mode
    .cost-analysis-workbench__toolbar-spacer {
    display: none;
  }
}
</style>
