<script setup lang="ts">
import { computed } from "vue";
import {
  applyCategoryGroupSelection,
  buildCostAnalysisCategoryGroups,
  flattenCostAnalysisCategories,
  getCategoryGroupCheckState,
  replaceCategoryLevelSelection,
  type CostAnalysisCategoryGroup,
} from "@/pages/cost/analysis/utils/category-selection";
import type {
  CostAnalysisCategoryLevel,
  CostAnalysisCategoryNode,
} from "@/types/cost-analysis";

type CategorySelectionModel = {
  level: CostAnalysisCategoryLevel | null;
  ids: string[];
};

const props = defineProps<{
  data: CostAnalysisCategoryNode[];
  modelValue: CategorySelectionModel;
  browseLevel: CostAnalysisCategoryLevel;
  keyword: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: CategorySelectionModel];
}>();

const groups = computed(() =>
  buildCostAnalysisCategoryGroups(props.data, props.browseLevel, props.keyword),
);
const allNodes = computed(() => flattenCostAnalysisCategories(props.data));

function selectedIdsForLevel(level: CostAnalysisCategoryLevel): string[] {
  return props.modelValue.level === level ? props.modelValue.ids : [];
}

function groupState(group: CostAnalysisCategoryGroup) {
  return getCategoryGroupCheckState(
    selectedIdsForLevel(props.browseLevel),
    group.nodes.map((node) => node.id),
  );
}

function handleNodeChange(node: CostAnalysisCategoryNode, checked: boolean) {
  if (checked) {
    emit(
      "update:modelValue",
      replaceCategoryLevelSelection(props.modelValue.ids, node, allNodes.value),
    );
    return;
  }

  if (
    props.modelValue.level !== node.level ||
    !props.modelValue.ids.includes(node.id)
  ) {
    return;
  }

  const ids = props.modelValue.ids.filter((id) => id !== node.id);
  emit("update:modelValue", {
    level: ids.length > 0 ? node.level : null,
    ids,
  });
}

function handleGroupChange(group: CostAnalysisCategoryGroup, checked: boolean) {
  emit(
    "update:modelValue",
    applyCategoryGroupSelection(
      props.modelValue,
      props.browseLevel,
      group.nodes.map((node) => node.id),
      checked,
    ),
  );
}

function tooltipContent(node: CostAnalysisCategoryNode) {
  if (node.level !== 3) return "";

  return [
    node.engineers?.length ? `成本工程师：${node.engineers.join("、")}` : "",
    node.coveredParts?.length
      ? `涵盖零件：${node.coveredParts.join("、")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
</script>

<template>
  <div class="cost-analysis-category-grouped">
    <el-empty
      v-if="groups.length === 0"
      description="当前层级无匹配分类"
      :image-size="56"
    />

    <div v-else class="cost-analysis-category-grouped__groups">
      <section
        v-for="group in groups"
        :key="group.id"
        class="cost-analysis-category-grouped__group"
      >
        <header
          v-if="group.label"
          class="cost-analysis-category-grouped__group-header"
        >
          <span
            class="cost-analysis-category-grouped__group-title"
            :title="group.label"
          >
            {{ group.label }}
          </span>
          <el-checkbox
            :model-value="groupState(group).checked"
            :indeterminate="groupState(group).indeterminate"
            :aria-label="`选择分组 ${group.label}`"
            :data-test="`category-group-${group.id}`"
            @change="handleGroupChange(group, Boolean($event))"
          >
            全选
          </el-checkbox>
        </header>

        <div class="cost-analysis-category-grouped__items">
          <el-checkbox
            v-for="node in group.nodes"
            :key="node.id"
            :model-value="
              props.modelValue.level === node.level &&
              props.modelValue.ids.includes(node.id)
            "
            :data-test="`category-item-${node.id}`"
            @change="handleNodeChange(node, Boolean($event))"
          >
            <el-tooltip
              :content="tooltipContent(node)"
              :disabled="!tooltipContent(node)"
              placement="right"
              :show-after="400"
            >
              <span
                class="cost-analysis-category-grouped__node"
                :title="node.name"
              >
                {{ node.name }}
              </span>
            </el-tooltip>
            <span
              v-if="tooltipContent(node)"
              class="cost-analysis-category-grouped__visually-hidden"
            >
              {{ tooltipContent(node) }}
            </span>
          </el-checkbox>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cost-analysis-category-grouped {
  display: grid;
  min-width: 0;
  gap: var(--bq-space-sm);
}

.cost-analysis-category-grouped__groups {
  display: grid;
  min-width: 0;
  gap: var(--bq-space-sm);
}

.cost-analysis-category-grouped__group {
  min-width: 0;
}

.cost-analysis-category-grouped__group-header {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--bq-space-xs);
  min-height: 30px;
  padding: 0 var(--bq-space-xs);
  border-bottom: 1px solid var(--bq-color-border-subtle);
  background: var(--bq-color-bg-soft);
}

.cost-analysis-category-grouped__group-title {
  overflow: hidden;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact);
  font-weight: 600;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cost-analysis-category-grouped__items {
  display: grid;
  min-width: 0;
  padding: var(--bq-space-xs) 0;
}

.cost-analysis-category-grouped__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

.cost-analysis-category-grouped__items :deep(.el-checkbox) {
  width: 100%;
  min-width: 0;
  height: 30px;
  margin-right: 0;
  padding: 0 var(--bq-space-xs);
}

.cost-analysis-category-grouped__items :deep(.el-checkbox__label) {
  overflow: hidden;
  min-width: 0;
}

.cost-analysis-category-grouped__node {
  display: block;
  overflow: hidden;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact);
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
