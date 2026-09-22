<script setup lang="ts">
import { RefreshRight } from "@element-plus/icons-vue";
import { computed, onMounted, ref, watch } from "vue";
import BaseSelect from "@/components/base/BaseSelect.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import CostAnalysisCategoryGroupedList from "@/pages/cost/analysis/components/CostAnalysisCategoryGroupedList.vue";
import { flattenCostAnalysisCategories } from "@/pages/cost/analysis/utils/category-selection";
import {
  getCostAnalysisDimensionLevelLabel,
  getCostAnalysisDimensionMaxLevel,
  getCostAnalysisDimensionTitle,
  normalizeCostAnalysisDimensionType,
} from "@/pages/cost/analysis/utils/analysis-dimension";
import type {
  CostAnalysisCategoryLevel,
  CostAnalysisCategoryNode,
  CostAnalysisDimensionType,
  CostAnalysisTraceError,
} from "@/types/cost-analysis";

type CategorySelectionModel = {
  level: CostAnalysisCategoryLevel | null;
  ids: string[];
};

const DIMENSION_OPTIONS = [
  {
    label: getCostAnalysisDimensionTitle("VEHICLE_SYSTEM"),
    value: "VEHICLE_SYSTEM",
  },
  {
    label: getCostAnalysisDimensionTitle("RESPONSIBILITY_DEPARTMENT"),
    value: "RESPONSIBILITY_DEPARTMENT",
  },
] as const;

const DEFAULT_BROWSE_LEVEL: CostAnalysisCategoryLevel = 0;

function resolveBrowseLevel(
  dimensionType: CostAnalysisDimensionType,
  selectionLevel: CostAnalysisCategoryLevel | null,
): CostAnalysisCategoryLevel {
  if (
    selectionLevel !== null &&
    selectionLevel <= getCostAnalysisDimensionMaxLevel(dimensionType)
  ) {
    return selectionLevel;
  }
  return DEFAULT_BROWSE_LEVEL;
}

const props = withDefaults(
  defineProps<{
    dimensionType?: CostAnalysisDimensionType;
    data: CostAnalysisCategoryNode[];
    modelValue: CategorySelectionModel;
    loading?: boolean;
    error?: CostAnalysisTraceError | null;
    validationError?: string | null;
  }>(),
  {
    dimensionType: "VEHICLE_SYSTEM",
    loading: false,
    error: null,
    validationError: null,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: CategorySelectionModel];
  "update:dimensionType": [value: CostAnalysisDimensionType];
  retry: [];
  "browse-level-change": [value: CostAnalysisCategoryLevel];
}>();

const searchKeyword = ref("");
const browseLevel = ref<CostAnalysisCategoryLevel>(
  resolveBrowseLevel(
    normalizeCostAnalysisDimensionType(props.dimensionType),
    props.modelValue.level,
  ),
);
let selectionDataUnavailable = props.loading || Boolean(props.error);
const localSelection = ref<CategorySelectionModel>({
  level: props.modelValue.level,
  ids: [...props.modelValue.ids],
});

const allNodes = computed(() => flattenCostAnalysisCategories(props.data));
const normalizedDimensionType = computed(() =>
  normalizeCostAnalysisDimensionType(props.dimensionType),
);
const levelLabel = (level: CostAnalysisCategoryLevel) =>
  getCostAnalysisDimensionLevelLabel(normalizedDimensionType.value, level);
const levelOptionLabel = (level: CostAnalysisCategoryLevel) => {
  if (normalizedDimensionType.value === "VEHICLE_SYSTEM" && level === 2) {
    return "38个系统";
  }
  return levelLabel(level);
};
const levelOptions = computed(() =>
  ([0, 1, 2, 3] as const)
    .filter(
      (level) =>
        level <=
        getCostAnalysisDimensionMaxLevel(normalizedDimensionType.value),
    )
    .map((level) => ({
      label: levelOptionLabel(level),
      value: level,
    })),
);
const searchPlaceholder = computed(
  () => `搜索${levelLabel(browseLevel.value)}`,
);
const selectionSummary = computed(() => {
  if (localSelection.value.level === null) {
    return "未选择分析项";
  }

  return `已选：${levelLabel(localSelection.value.level)} ${localSelection.value.ids.length} 项`;
});

function sameSelection(
  left: CategorySelectionModel,
  right: CategorySelectionModel,
) {
  return (
    left.level === right.level &&
    left.ids.length === right.ids.length &&
    left.ids.every((id, index) => id === right.ids[index])
  );
}

function sanitizeSelection(
  selection: CategorySelectionModel,
): CategorySelectionModel {
  if (selection.level === null) {
    return { level: null, ids: [] };
  }

  const nodesById = new Map(allNodes.value.map((node) => [node.id, node]));
  const ids = Array.from(
    new Set(
      selection.ids.filter(
        (id) => nodesById.get(id)?.level === selection.level,
      ),
    ),
  );

  return ids.length > 0
    ? { level: selection.level, ids }
    : { level: null, ids: [] };
}

function syncFromModel() {
  const modelSelection = {
    level: props.modelValue.level,
    ids: [...props.modelValue.ids],
  };

  if (props.loading || props.error) {
    localSelection.value = modelSelection;
    return;
  }

  const nextSelection = sanitizeSelection(modelSelection);

  localSelection.value = nextSelection;
  if (nextSelection.level !== null) {
    browseLevel.value = nextSelection.level;
  }
  if (!sameSelection(modelSelection, nextSelection)) {
    emit("update:modelValue", {
      level: nextSelection.level,
      ids: [...nextSelection.ids],
    });
  }
}

function updateSelection(nextSelection: CategorySelectionModel) {
  if (sameSelection(localSelection.value, nextSelection)) return;

  localSelection.value = nextSelection;
  emit("update:modelValue", {
    level: nextSelection.level,
    ids: [...nextSelection.ids],
  });
}

function setDimensionType(value: string | number | boolean) {
  if (value !== "VEHICLE_SYSTEM" && value !== "RESPONSIBILITY_DEPARTMENT") {
    return;
  }
  if (value === normalizedDimensionType.value) return;

  emit("update:dimensionType", value);
}

function setBrowseLevel(value: string | number | boolean | null) {
  if (value !== 0 && value !== 1 && value !== 2 && value !== 3) return;
  if (value > getCostAnalysisDimensionMaxLevel(normalizedDimensionType.value))
    return;
  if (value === browseLevel.value) return;

  browseLevel.value = value;
  searchKeyword.value = "";
  updateSelection({ level: null, ids: [] });
  emit("browse-level-change", value);
}

function clearSelection() {
  updateSelection({ level: null, ids: [] });
}

function clearSearch() {
  searchKeyword.value = "";
}

watch(
  () => props.dimensionType,
  () => {
    browseLevel.value = DEFAULT_BROWSE_LEVEL;
    searchKeyword.value = "";
  },
);

watch(
  [browseLevel, allNodes],
  ([level, nodes]) => {
    if (level !== 0) return;

    const projectNodes = nodes.filter((node) => node.level === 0);
    if (projectNodes.length !== 1) return;

    updateSelection({
      level: 0,
      ids: [projectNodes[0].id],
    });
  },
  { immediate: true },
);

watch(
  () => props.modelValue,
  () => {
    syncFromModel();
  },
  { deep: true },
);

watch(
  () => props.data,
  () => {
    if (props.loading || props.error || selectionDataUnavailable) return;

    const nextSelection = sanitizeSelection(localSelection.value);
    const selectionChanged = !sameSelection(
      localSelection.value,
      nextSelection,
    );

    localSelection.value = nextSelection;
    if (selectionChanged) {
      emit("update:modelValue", {
        level: nextSelection.level,
        ids: [...nextSelection.ids],
      });
    }
  },
  { deep: true },
);

watch([() => props.loading, () => props.error], () => {
  if (props.loading || props.error) {
    selectionDataUnavailable = true;
    return;
  }

  selectionDataUnavailable = false;
  syncFromModel();
});

onMounted(syncFromModel);

defineExpose({ clearSearch });
</script>

<template>
  <aside
    class="cost-analysis-category-panel"
    :class="{ 'is-error': props.validationError }"
  >
    <div
      id="cost-analysis-category-panel-title"
      class="cost-analysis-category-panel__title"
      data-test="category-tree-title"
    >
      分析对象
    </div>

    <div class="cost-analysis-category-panel__tools">
      <div class="cost-analysis-category-panel__dimension">
        <span class="cost-analysis-category-panel__field-label">
          分析维度
        </span>
        <el-segmented
          :model-value="normalizedDimensionType"
          :options="DIMENSION_OPTIONS"
          block
          size="small"
          aria-label="成本分析维度"
          class="cost-analysis-category-panel__dimension-switch"
          data-test="dimension-type-switch"
          @update:model-value="setDimensionType"
        >
          <template #default="{ item }">
            <span :data-test="`dimension-type-${item.value}`">
              {{ item.label }}
            </span>
          </template>
        </el-segmented>
      </div>

      <div class="cost-analysis-category-panel__level">
        <span class="cost-analysis-category-panel__field-label">
          分析层级
        </span>
        <BaseSelect
          :model-value="browseLevel"
          :options="levelOptions"
          :clearable="false"
          aria-label="分析层级"
          data-test="category-level-switch"
          @update:model-value="setBrowseLevel"
        />
      </div>

      <el-input
        v-if="browseLevel !== 0"
        v-model="searchKeyword"
        class="cost-analysis-category-panel__search"
        clearable
        :placeholder="searchPlaceholder"
        :aria-label="searchPlaceholder"
        data-test="category-search"
      />

      <div
        v-if="localSelection.ids.length > 0"
        class="cost-analysis-category-panel__selection"
        data-test="category-selection-summary"
      >
        <span>{{ selectionSummary }}</span>
        <button
          v-if="browseLevel !== 0"
          type="button"
          class="cost-analysis-category-panel__clear"
          data-test="category-selection-clear"
          @click="clearSelection"
        >
          清空
        </button>
      </div>

      <div
        v-if="props.validationError"
        class="cost-analysis-category-panel__validation"
        data-test="category-validation-error"
        role="alert"
      >
        {{ props.validationError }}
      </div>
    </div>

    <div class="cost-analysis-category-panel__content">
      <el-skeleton v-if="props.loading" :rows="8" animated />

      <div v-else-if="props.error" class="cost-analysis-category-panel__error">
        <TraceErrorAlert
          :code="props.error.code"
          :message="props.error.message"
          :trace-id="props.error.traceId"
        />
        <el-tooltip content="重试加载分析项" placement="top">
          <el-button
            :icon="RefreshRight"
            text
            circle
            aria-label="重试加载分析项"
            data-test="category-retry"
            @click="emit('retry')"
          />
        </el-tooltip>
      </div>

      <el-empty
        v-else-if="props.data.length === 0"
        description="暂无可访问的分析项"
        :image-size="64"
      />

      <div
        v-else-if="browseLevel === 0"
        class="cost-analysis-category-panel__project-scope"
        data-test="category-project-scope"
      >
        分析整个项目
      </div>

      <CostAnalysisCategoryGroupedList
        v-else
        :data="props.data"
        :model-value="localSelection"
        :browse-level="browseLevel"
        :keyword="searchKeyword"
        @update:model-value="updateSelection"
      />
    </div>
  </aside>
</template>

<style scoped>
.cost-analysis-category-panel {
  display: flex;
  flex: 0 0 clamp(240px, 22vw, 320px);
  flex-direction: column;
  width: clamp(240px, 22vw, 320px);
  max-width: 100%;
  min-width: 0;
  max-height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      (var(--bq-space-page-y) * 2)
  );
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-surface);
}

.cost-analysis-category-panel__title {
  flex: 0 0 auto;
  padding: var(--bq-space-md);
  border-bottom: 1px solid var(--bq-color-divider);
  color: var(--bq-color-text);
  font-size: var(--bq-font-section-title);
  font-weight: 600;
  line-height: 24px;
}

.cost-analysis-category-panel__tools {
  display: grid;
  flex: 0 0 auto;
  gap: var(--bq-space-sm);
  padding: var(--bq-space-sm) var(--bq-space-md);
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.cost-analysis-category-panel__dimension {
  display: grid;
  gap: var(--bq-space-xs);
  min-width: 0;
}

.cost-analysis-category-panel__dimension-switch {
  width: 100%;
}

.cost-analysis-category-panel__level {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--bq-space-sm);
  align-items: center;
  min-width: 0;
}

.cost-analysis-category-panel__field-label {
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper);
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
}

.cost-analysis-category-panel__search {
  width: 100%;
}

.cost-analysis-category-panel__selection {
  display: flex;
  flex: 0 0 auto;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--bq-space-sm);
  min-height: 24px;
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.cost-analysis-category-panel__selection > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-analysis-category-panel__clear {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--bq-color-primary);
  cursor: pointer;
  font: inherit;
}

.cost-analysis-category-panel.is-error {
  border-color: var(--bq-color-danger);
}

.cost-analysis-category-panel__validation {
  color: var(--bq-color-danger);
  font-size: 12px;
  line-height: 18px;
}

.cost-analysis-category-panel__content {
  flex: 1 1 auto;
  min-height: 180px;
  overflow: auto;
  padding: var(--bq-space-sm);
}

.cost-analysis-category-panel__project-scope {
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--bq-color-border);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-bg-soft);
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-body);
}

.cost-analysis-category-panel__error {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: var(--bq-space-sm);
  align-items: start;
}

@media (max-width: 960px) {
  .cost-analysis-category-panel {
    flex-basis: auto;
    width: 100%;
    max-height: 360px;
  }
}
</style>
