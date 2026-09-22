<script setup lang="ts">
import { computed } from "vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import type {
  CostAnalysisAiAnalysisResult,
  CostAnalysisAiFinding,
  CostAnalysisTraceError,
} from "@/types/cost-analysis";

const props = defineProps<{
  loading: boolean;
  error: CostAnalysisTraceError | null;
  result: CostAnalysisAiAnalysisResult | null;
}>();

const emit = defineEmits<{
  generate: [];
  regenerate: [];
  retry: [];
}>();

const visibleFindings = computed(
  () => props.result?.findings.slice(0, 4) ?? [],
);

function findingType(
  finding: CostAnalysisAiFinding,
): "success" | "warning" | "danger" | "info" | "primary" {
  if (finding.kind === "UNRESOLVED") return "warning";
  if (finding.kind === "BUSINESS_ATTRIBUTION") {
    if (finding.label === "缺少变更记录") return "warning";
    return finding.label.includes("集中") ? "primary" : "info";
  }
  if (finding.kind === "RELATED_CHANGE") return "info";
  if (finding.kind === "TARGET_DEVIATION") return "danger";
  if (finding.kind === "DISTRIBUTION") return "primary";
  if (finding.kind === "CONCENTRATION") {
    return finding.direction === "INCREASE" ? "danger" : "success";
  }
  if (finding.kind === "OFFSET") {
    return finding.direction === "INCREASE" ? "warning" : "success";
  }
  return "primary";
}
</script>

<template>
  <section
    class="cost-analysis-ai-summary"
    data-test="cost-analysis-ai-summary"
  >
    <header class="cost-analysis-ai-summary__header">
      <h3>AI 差异分析</h3>
      <el-button
        v-if="result && !loading && !error"
        link
        type="primary"
        data-test="ai-analysis-regenerate"
        @click="emit('regenerate')"
      >
        重新分析
      </el-button>
    </header>

    <el-skeleton v-if="loading" :rows="5" animated />

    <div v-else-if="error" class="cost-analysis-ai-summary__error">
      <TraceErrorAlert v-bind="error" />
      <el-button
        type="primary"
        plain
        data-test="ai-analysis-retry"
        @click="emit('retry')"
      >
        重试
      </el-button>
    </div>

    <template v-else-if="result">
      <div class="cost-analysis-ai-summary__conclusion">
        <span>结论</span>
        <strong>{{ result.headline }}</strong>
      </div>

      <div
        v-if="visibleFindings.length"
        class="cost-analysis-ai-summary__findings"
      >
        <article
          v-for="finding in visibleFindings"
          :key="finding.id"
          class="cost-analysis-ai-summary__finding"
        >
          <div class="cost-analysis-ai-summary__finding-title">
            <BaseStatusTag
              :label="finding.label"
              :type="findingType(finding)"
            />
            <strong>{{ finding.title }}</strong>
          </div>
          <p>{{ finding.description }}</p>
          <div
            v-if="finding.evidence.length"
            class="cost-analysis-ai-summary__evidence"
          >
            <span class="cost-analysis-ai-summary__evidence-label">
              优先核查
            </span>
            <span
              v-for="item in finding.evidence"
              :key="`${finding.id}-${item.objectId}-${item.fieldCodes.join('-')}`"
            >
              {{ item.categoryPath.join(" / ") }}
            </span>
          </div>
        </article>
      </div>

      <BaseEmpty
        v-else
        title="暂无额外判断"
        description="当前明细未识别到需要单独关注的结构性问题。"
      />
    </template>

    <div v-else class="cost-analysis-ai-summary__empty">
      <BaseEmpty
        title="当前节点尚未生成 AI 分析"
        description="当前节点暂无已生成结果。"
      />
      <el-button
        type="primary"
        data-test="ai-analysis-generate"
        @click="emit('generate')"
      >
        生成 AI 分析
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.cost-analysis-ai-summary {
  display: grid;
  min-width: 0;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--bq-color-divider);
}

.cost-analysis-ai-summary__header,
.cost-analysis-ai-summary__finding-title,
.cost-analysis-ai-summary__evidence {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.cost-analysis-ai-summary__header h3,
.cost-analysis-ai-summary__finding p {
  margin: 0;
}

.cost-analysis-ai-summary__header h3 {
  font-size: 15px;
  letter-spacing: 0;
}

.cost-analysis-ai-summary__header {
  justify-content: space-between;
}

.cost-analysis-ai-summary__finding p {
  color: var(--bq-color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.cost-analysis-ai-summary__conclusion {
  display: grid;
  gap: 6px;
  padding: 12px;
  background: var(--bq-color-bg-soft);
  border-left: 3px solid var(--bq-color-primary);
}

.cost-analysis-ai-summary__conclusion strong {
  font-size: 14px;
  line-height: 1.6;
  letter-spacing: 0;
}

.cost-analysis-ai-summary__conclusion span {
  color: var(--bq-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.cost-analysis-ai-summary__findings,
.cost-analysis-ai-summary__error,
.cost-analysis-ai-summary__empty {
  display: grid;
  gap: 10px;
}

.cost-analysis-ai-summary__finding {
  display: grid;
  gap: 6px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.cost-analysis-ai-summary__finding:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.cost-analysis-ai-summary__finding-title strong {
  min-width: 0;
  font-size: 13px;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.cost-analysis-ai-summary__evidence span {
  max-width: 100%;
  padding: 2px 6px;
  color: var(--bq-color-text-secondary);
  background: var(--bq-color-info-soft);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 4px;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.cost-analysis-ai-summary__evidence .cost-analysis-ai-summary__evidence-label {
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--bq-color-text-muted);
}

.cost-analysis-ai-summary__error {
  justify-items: start;
}

.cost-analysis-ai-summary__empty {
  justify-items: center;
}

.cost-analysis-ai-summary__empty :deep(.base-empty) {
  width: 100%;
  padding-block: 16px 4px;
}
</style>
