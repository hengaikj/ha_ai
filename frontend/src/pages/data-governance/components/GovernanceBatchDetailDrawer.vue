<script setup lang="ts">
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import GovernanceStatusTag from "./GovernanceStatusTag.vue";
import {
  formatGovernanceCell,
  formatGovernanceValue,
} from "../governance-page-utils";
import type { GovernanceBatchDetail } from "@/types/data-governance";

defineProps<{
  modelValue: boolean;
  detail?: GovernanceBatchDetail | null;
  loading?: boolean;
  error?: { code: string; message: string; traceId?: string } | null;
}>();

const emit = defineEmits<{ "update:modelValue": [boolean] }>();
</script>

<template>
  <BaseDrawer
    :model-value="modelValue"
    title="运行批次详情"
    size="min(920px, 92vw)"
    :show-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading">
      <TraceErrorAlert v-if="error" v-bind="error" />
      <el-tabs v-if="detail">
        <el-tab-pane label="批次信息">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="批次号">
              {{ formatGovernanceValue(detail.batch.batchNo) }}
            </el-descriptions-item>
            <el-descriptions-item label="批次状态">
              <GovernanceStatusTag :status="detail.batch.status" />
            </el-descriptions-item>
            <el-descriptions-item label="业务日期">
              {{ formatGovernanceValue(detail.batch.bizDate) }}
            </el-descriptions-item>
            <el-descriptions-item label="父批次">
              {{ formatGovernanceValue(detail.batch.parentBatchNo) }}
            </el-descriptions-item>
            <el-descriptions-item label="当前步骤">
              {{ formatGovernanceValue(detail.batch.currentStep) }}
            </el-descriptions-item>
            <el-descriptions-item label="开始时间">
              <BaseDateTime :value="detail.batch.startedAt" empty-text="-" />
            </el-descriptions-item>
            <el-descriptions-item label="错误信息" :span="2">
              {{ formatGovernanceValue(detail.batch.errorMessage) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane label="执行步骤">
          <el-table :data="detail.steps">
            <el-table-column
              prop="stepName"
              label="步骤"
              min-width="160"
              :formatter="formatGovernanceCell"
            />
            <el-table-column label="作业状态" width="100">
              <template #default="{ row }">
                <GovernanceStatusTag :status="row.status" />
              </template>
            </el-table-column>
            <el-table-column
              prop="inputCount"
              label="输入"
              width="100"
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="outputCount"
              label="输出"
              width="100"
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="errorMessage"
              label="错误信息"
              min-width="220"
              show-overflow-tooltip
              :formatter="formatGovernanceCell"
            />
          </el-table>
        </el-tab-pane>

        <el-tab-pane v-if="detail.qualityResults.length" label="质量结果">
          <el-table :data="detail.qualityResults">
            <el-table-column
              prop="ruleCode"
              label="规则编码"
              min-width="160"
              :formatter="formatGovernanceCell"
            />
            <el-table-column label="级别" width="90">
              <template #default="{ row }">
                <GovernanceStatusTag :status="row.severity" />
              </template>
            </el-table-column>
            <el-table-column
              prop="checkedCount"
              label="校验数"
              width="100"
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="failedCount"
              label="失败数"
              width="100"
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="sampleMessage"
              label="样例信息"
              min-width="220"
              show-overflow-tooltip
              :formatter="formatGovernanceCell"
            />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="数据血缘">
          <el-table :data="detail.lineages">
            <el-table-column
              prop="stepCode"
              label="步骤"
              min-width="130"
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="sourceTable"
              label="来源表"
              min-width="180"
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="targetTable"
              label="目标表"
              min-width="180"
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="recordCount"
              label="记录数"
              width="100"
              :formatter="formatGovernanceCell"
            />
            <el-table-column
              prop="scriptVersion"
              label="脚本版本"
              width="120"
              :formatter="formatGovernanceCell"
            />
          </el-table>
        </el-tab-pane>
      </el-tabs>
      <el-empty v-else description="暂无批次详情" />
    </div>
  </BaseDrawer>
</template>
