<script setup lang="ts">
import { ref } from "vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BasePageHeader from "@/components/base/BasePageHeader.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import ForbiddenPage from "@/pages/ForbiddenPage.vue";

type ErrorState = "loading" | "empty" | "400" | "403" | "404" | "409" | "500";

const state = ref<ErrorState>("loading");
const stateLabels: Record<ErrorState, string> = {
  loading: "Loading",
  empty: "Empty",
  "400": "400",
  "403": "403",
  "404": "404",
  "409": "409",
  "500": "500",
};

const traceByState: Record<Exclude<ErrorState, "loading" | "empty">, string> = {
  "400": "请求参数不合法",
  "403": "无权限访问",
  "404": "资源不存在",
  "409": "资源状态冲突，请检查输入后重试",
  "500": "服务暂时不可用",
};

function selectState(next: ErrorState) {
  state.value = next;
}
</script>

<template>
  <section class="ai-error-states bq-management-page">
    <BasePageHeader title="错误状态">
      <div
        class="ai-error-states__actions"
        role="group"
        aria-label="错误状态切换"
      >
        <el-button
          v-for="(label, value) in stateLabels"
          :key="value"
          :type="state === value ? 'primary' : undefined"
          @click="selectState(value)"
        >
          {{ label }}
        </el-button>
      </div>
    </BasePageHeader>

    <p class="ai-error-states__description">
      用于核验管理页面的加载、空数据、权限和接口错误状态。
    </p>

    <div class="ai-error-states__viewport" aria-live="polite">
      <el-skeleton v-if="state === 'loading'" :rows="5" animated />
      <BaseEmpty
        v-else-if="state === 'empty'"
        title="暂无数据"
        description="当前条件下没有可展示的数据。"
      />
      <ForbiddenPage v-else-if="state === '403'" />
      <BaseEmpty
        v-else-if="state === '404'"
        title="资源不存在"
        description="该资源不存在或已无法访问。"
      />
      <TraceErrorAlert
        v-else
        :code="state"
        :message="traceByState[state]"
        :trace-id="`mock-request-${state}`"
      />
    </div>
  </section>
</template>

<style scoped>
.ai-error-states {
  min-width: 0;
  padding: 0 24px 24px;
  background: var(--bq-color-surface);
}

.ai-error-states__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-error-states__actions .el-button + .el-button {
  margin-left: 0;
}

.ai-error-states__description {
  margin: 20px 0;
  color: var(--bq-color-text-secondary);
  font-size: 13px;
}

.ai-error-states__viewport {
  min-height: 220px;
  padding: 24px;
  border: 1px solid var(--bq-color-border);
  background: var(--bq-color-bg);
}

@media (max-width: 768px) {
  .ai-error-states :deep(.base-page-title) {
    height: auto;
    min-height: 60px;
    gap: 12px;
    padding-top: 12px;
    padding-bottom: 12px;
    flex-wrap: wrap;
  }

  .ai-error-states__viewport {
    padding: 16px;
  }
}
</style>
