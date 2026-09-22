<script setup lang="ts">
import { Delete } from "@element-plus/icons-vue";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { CostAnalysisValveOption } from "@/api/cost-analysis";
import {
  buildCostAnalysisPointKey,
  buildCostAnalysisValueKey,
} from "@/api/cost-analysis/matrix-key";
import type { CostAnalysisConditionValidationError } from "@/pages/cost/analysis/composables/useCostAnalysisConditions";
import type { CostAnalysisDiffConditionSelection } from "@/pages/cost/analysis/composables/useCostAnalysisWorkbench";
import { getAdaptiveTagLimit } from "@/pages/cost/analysis/utils/pattern-tag-layout";
import type { CostAnalysisConditionDraft } from "@/types/cost-analysis";
import type { BusinessProjectItem } from "@/types/project";
import { formatDateTime } from "@/utils/formatters";

const props = withDefaults(
  defineProps<{
    modelValue: CostAnalysisConditionDraft[];
    projectOptions: BusinessProjectItem[];
    valveOptions: CostAnalysisValveOption[];
    valveIdsByProject?: Record<string, number[]>;
    validationErrors?: CostAnalysisConditionValidationError[];
    diffSelection?: CostAnalysisDiffConditionSelection | null;
  }>(),
  {
    validationErrors: () => [],
    diffSelection: null,
    valveIdsByProject: () => ({}),
  },
);

const emit = defineEmits<{
  remove: [clientId: string];
  "project-change": [clientId: string, projectId: number | null];
  "valve-change": [clientId: string, valveId: number | null];
  "patterns-change": [clientId: string, patternIds: number[]];
}>();

type TemplateElement = HTMLElement | { $el?: HTMLElement } | null;

const patternSelectElements = new Map<string, HTMLElement>();
const patternMeasureElements = new Map<string, HTMLElement>();
const patternResizeObservers = new Map<string, ResizeObserver>();
const patternTagLimits = ref<Record<string, number>>({});

function emitProjectChange(
  clientId: string,
  projectId: number | null | undefined,
) {
  emit("project-change", clientId, projectId ?? null);
}

function emitValveChange(clientId: string, valveId: number | null | undefined) {
  emit("valve-change", clientId, valveId ?? null);
}

function emitPatternsChange(clientId: string, patternIds: number[]) {
  if (patternIds.length === 0) return;
  emit("patterns-change", clientId, patternIds);
}

function bomDisplay(condition: CostAnalysisConditionDraft): string {
  if (condition.loadingBom) return "最新 BOM 加载中";
  if (!condition.projectId) return "选择项目后加载";
  if (!condition.bom) return "暂无可用 BOM";
  return `${condition.bom.bomVersionNo} · ${formatDateTime(
    condition.bom.bomUpdatedAt,
  )}`;
}

function validationMessages(clientId: string): string[] {
  return props.validationErrors
    .filter((error) => error.clientId === clientId)
    .map((error) => error.message);
}

function isBaseline(condition: CostAnalysisConditionDraft): boolean {
  if (!props.diffSelection || !condition.projectId || !condition.valveId) {
    return false;
  }
  const pointKey = buildCostAnalysisPointKey(
    condition.projectId,
    condition.valveId,
  );
  return condition.patternIds.some(
    (patternId) =>
      buildCostAnalysisValueKey(patternId, pointKey) ===
      props.diffSelection?.baselineColumnKey,
  );
}

function selectedPatterns(condition: CostAnalysisConditionDraft) {
  const patternMap = new Map(
    (condition.bom?.patterns ?? []).map((pattern) => [
      pattern.patternId,
      pattern,
    ]),
  );
  return condition.patternIds
    .map((patternId) => patternMap.get(patternId))
    .filter((pattern): pattern is NonNullable<typeof pattern> =>
      Boolean(pattern),
    );
}

function valveOptionsFor(condition: CostAnalysisConditionDraft) {
  if (condition.projectId === null) return [];
  if (!(String(condition.projectId) in props.valveIdsByProject)) {
    return props.valveOptions;
  }
  const allowed = new Set(
    props.valveIdsByProject[String(condition.projectId)] ?? [],
  );
  return props.valveOptions.filter((valve) => allowed.has(valve.valveId));
}

function resolveTemplateElement(value: TemplateElement): HTMLElement | null {
  if (value instanceof HTMLElement) return value;
  return value?.$el instanceof HTMLElement ? value.$el : null;
}

function schedulePatternTagLimit(clientId: string) {
  void nextTick(() => updatePatternTagLimit(clientId));
}

function updatePatternTagLimit(clientId: string) {
  const select = patternSelectElements.get(clientId);
  const measure = patternMeasureElements.get(clientId);
  if (!select || !measure) return;

  const selection = select.querySelector<HTMLElement>(".el-select__selection");
  const tagWidths = Array.from(
    measure.querySelectorAll<HTMLElement>("[data-pattern-tag-measure]"),
  ).map((tag) => tag.getBoundingClientRect().width);
  const collapsedTagWidth =
    measure
      .querySelector<HTMLElement>("[data-pattern-tag-measure-collapse]")
      ?.getBoundingClientRect().width ?? 0;
  const availableWidth = selection?.clientWidth ?? select.clientWidth;

  if (
    availableWidth <= 0 ||
    collapsedTagWidth <= 0 ||
    tagWidths.some((width) => width <= 0)
  ) {
    return;
  }

  const gap = Number.parseFloat(
    selection ? window.getComputedStyle(selection).gap : "6",
  );

  const nextLimit = getAdaptiveTagLimit({
    availableWidth,
    tagWidths,
    collapsedTagWidth,
    gap: Number.isFinite(gap) ? gap : 6,
    reservedWidth: 32,
  });
  if (patternTagLimits.value[clientId] === nextLimit) return;

  patternTagLimits.value = {
    ...patternTagLimits.value,
    [clientId]: nextLimit,
  };
}

function setPatternSelectRef(clientId: string, value: TemplateElement) {
  const element = resolveTemplateElement(value);
  const current = patternSelectElements.get(clientId);
  if (current === element) return;

  patternResizeObservers.get(clientId)?.disconnect();
  patternResizeObservers.delete(clientId);

  if (!element) {
    patternSelectElements.delete(clientId);
    return;
  }

  patternSelectElements.set(clientId, element);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() =>
      schedulePatternTagLimit(clientId),
    );
    observer.observe(element);
    patternResizeObservers.set(clientId, observer);
  }
  schedulePatternTagLimit(clientId);
}

function setPatternMeasureRef(clientId: string, element: HTMLElement | null) {
  if (!element) {
    patternMeasureElements.delete(clientId);
    return;
  }
  patternMeasureElements.set(clientId, element);
  schedulePatternTagLimit(clientId);
}

watch(
  () =>
    props.modelValue.map((condition) => ({
      clientId: condition.clientId,
      patternIds: condition.patternIds,
      patterns: condition.bom?.patterns,
    })),
  (conditions) => {
    for (const condition of conditions) {
      schedulePatternTagLimit(condition.clientId);
    }
  },
  { deep: true, immediate: true },
);

onBeforeUnmount(() => {
  for (const observer of patternResizeObservers.values()) {
    observer.disconnect();
  }
});
</script>

<template>
  <div class="cost-analysis-condition-list">
    <div
      v-for="(condition, index) in props.modelValue"
      :key="condition.clientId"
      class="cost-analysis-condition-row"
      :class="{ 'is-error': validationMessages(condition.clientId).length }"
    >
      <div class="cost-analysis-condition-field">
        <span class="cost-analysis-condition-label">
          项目代号
          <el-tag
            v-if="isBaseline(condition)"
            size="small"
            effect="plain"
            type="info"
            :data-test="`condition-diff-role-${index}`"
          >
            基准
          </el-tag>
        </span>
        <el-select
          :model-value="condition.projectId"
          clearable
          filterable
          placeholder="请选择项目"
          :aria-label="`条件 ${index + 1} 项目`"
          :data-test="`condition-project-${index}`"
          @update:model-value="
            (projectId: number | null) =>
              emitProjectChange(condition.clientId, projectId)
          "
        >
          <el-option
            v-for="projectOption in props.projectOptions"
            :key="projectOption.projectId"
            :label="projectOption.projectName"
            :value="projectOption.projectId"
          >
            <el-tooltip
              :content="projectOption.projectName"
              placement="top"
              :show-after="400"
            >
              <span class="cost-analysis-condition-option-text">
                {{ projectOption.projectName }}
              </span>
            </el-tooltip>
          </el-option>
        </el-select>
      </div>

      <div class="cost-analysis-condition-field">
        <span class="cost-analysis-condition-label">阀点</span>
        <el-select
          :model-value="condition.valveId"
          clearable
          filterable
          placeholder="请选择阀点"
          :aria-label="`条件 ${index + 1} 阀点`"
          :data-test="`condition-valve-${index}`"
          @update:model-value="
            (valveId: number | null) =>
              emitValveChange(condition.clientId, valveId)
          "
        >
          <el-option
            v-for="valveOption in valveOptionsFor(condition)"
            :key="valveOption.valveId"
            :label="valveOption.valveName"
            :value="valveOption.valveId"
          >
            <el-tooltip
              :content="valveOption.valveName"
              placement="top"
              :show-after="400"
            >
              <span class="cost-analysis-condition-option-text">
                {{ valveOption.valveName }}
              </span>
            </el-tooltip>
          </el-option>
        </el-select>
      </div>

      <div class="cost-analysis-condition-field">
        <span class="cost-analysis-condition-label">最新 BOM</span>
        <el-tooltip
          :content="bomDisplay(condition)"
          placement="top"
          :show-after="400"
        >
          <div
            class="cost-analysis-condition-bom"
            :class="{
              'is-loading': condition.loadingBom,
              'is-error': condition.bomError,
            }"
            :data-test="`condition-bom-${index}`"
          >
            {{ bomDisplay(condition) }}
          </div>
        </el-tooltip>
        <div
          v-if="condition.bomError"
          class="cost-analysis-condition-error"
          :data-test="`condition-bom-error-${index}`"
        >
          <el-tooltip
            :content="
              [
                condition.bomError.message,
                condition.bomError.code,
                condition.bomError.traceId,
              ]
                .filter(Boolean)
                .join(' · ')
            "
            placement="top"
          >
            <span>
              {{ condition.bomError.message }}（{{ condition.bomError.code }}）
            </span>
          </el-tooltip>
        </div>
      </div>

      <div class="cost-analysis-condition-field">
        <span class="cost-analysis-condition-label">版型名称</span>
        <el-select
          :ref="
            (instance: TemplateElement) =>
              setPatternSelectRef(condition.clientId, instance)
          "
          :model-value="condition.patternIds"
          multiple
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="patternTagLimits[condition.clientId] ?? 1"
          filterable
          placeholder="请选择版型"
          :disabled="condition.loadingBom || !condition.bom"
          :aria-label="`条件 ${index + 1} 版型`"
          :data-test="`condition-patterns-${index}`"
          @update:model-value="
            (patternIds: number[]) =>
              emitPatternsChange(condition.clientId, patternIds)
          "
        >
          <el-option
            v-for="pattern in condition.bom?.patterns ?? []"
            :key="pattern.patternId"
            :label="pattern.patternName"
            :value="pattern.patternId"
          >
            <el-tooltip
              :content="pattern.patternName"
              placement="top"
              :show-after="400"
            >
              <span class="cost-analysis-condition-option-text">
                {{ pattern.patternName }}
              </span>
            </el-tooltip>
          </el-option>
        </el-select>
        <div
          :ref="
            (element) =>
              setPatternMeasureRef(condition.clientId, element as HTMLElement)
          "
          class="cost-analysis-condition-pattern-measure"
          :data-test="`condition-pattern-measure-${index}`"
          aria-hidden="true"
        >
          <el-tag
            v-for="pattern in selectedPatterns(condition)"
            :key="pattern.patternId"
            closable
            type="info"
            :data-pattern-tag-measure="pattern.patternId"
            :data-test="`condition-pattern-tag-measure-${index}-${pattern.patternId}`"
          >
            {{ pattern.patternName }}
          </el-tag>
          <el-tag
            type="info"
            data-pattern-tag-measure-collapse
            :data-test="`condition-pattern-collapse-measure-${index}`"
          >
            + {{ condition.patternIds.length }}
          </el-tag>
        </div>
      </div>

      <div
        v-if="props.modelValue.length > 1"
        class="cost-analysis-condition-action"
      >
        <el-tooltip content="删除条件" placement="top">
          <el-button
            :icon="Delete"
            text
            circle
            type="danger"
            aria-label="删除条件"
            :data-test="`condition-remove-${index}`"
            @click="emit('remove', condition.clientId)"
          />
        </el-tooltip>
      </div>

      <div
        v-if="validationMessages(condition.clientId).length"
        class="cost-analysis-condition-row__validation"
        :data-test="`condition-validation-${condition.clientId}`"
        role="alert"
      >
        <span
          v-for="message in validationMessages(condition.clientId)"
          :key="message"
        >
          {{ message }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cost-analysis-condition-list {
  display: grid;
  gap: 12px;
}

.cost-analysis-condition-row {
  display: grid;
  grid-template-columns:
    minmax(180px, 1.15fr) minmax(140px, 0.8fr) minmax(180px, 1fr)
    minmax(220px, 1.2fr) 32px;
  gap: 12px;
  align-items: end;
  padding: 12px;
  border: 1px solid var(--bq-color-border);
  border-radius: 6px;
  background: var(--bq-color-surface);
}

.cost-analysis-condition-row.is-error {
  border-color: var(--bq-color-danger);
}

.cost-analysis-condition-row__validation {
  display: grid;
  grid-column: 1 / -1;
  gap: 2px;
  color: var(--bq-color-danger);
  font-size: 12px;
  line-height: 18px;
}

.cost-analysis-condition-field {
  min-width: 0;
}

.cost-analysis-condition-label {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
  color: var(--bq-color-text-secondary);
  font-size: 13px;
  line-height: 20px;
}

.cost-analysis-condition-field :deep(.el-select) {
  width: 100%;
}

.cost-analysis-condition-pattern-measure {
  position: fixed;
  top: 0;
  left: -10000px;
  display: flex;
  gap: 6px;
  visibility: hidden;
  white-space: nowrap;
}

.cost-analysis-condition-bom {
  overflow: hidden;
  height: 32px;
  padding: 0 11px;
  border: 1px solid var(--bq-color-border);
  border-radius: 4px;
  background: var(--bq-color-bg);
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 30px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-analysis-condition-bom.is-loading {
  color: var(--bq-color-primary);
}

.cost-analysis-condition-bom.is-error {
  border-color: var(--bq-color-danger);
  color: var(--bq-color-danger);
}

.cost-analysis-condition-error {
  overflow: hidden;
  margin-top: 4px;
  color: var(--bq-color-danger);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-analysis-condition-option-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-analysis-condition-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
}

@media (max-width: 1280px) {
  .cost-analysis-condition-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cost-analysis-condition-action {
    justify-content: flex-end;
    grid-column: 2;
  }
}

@media (max-width: 600px) {
  .cost-analysis-condition-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .cost-analysis-condition-action {
    grid-column: 1;
  }
}
</style>
