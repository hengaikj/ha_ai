<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { fetchGovernanceArrivals } from "@/api/data-governance";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import BasePagination from "@/components/base/BasePagination.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import GovernanceStatusTag from "./GovernanceStatusTag.vue";
import {
  formatGovernanceCell,
  formatGovernanceValue,
  normalizeGovernanceError,
} from "../governance-page-utils";
import type {
  GovernanceArrival,
  GovernanceSource,
} from "@/types/data-governance";

const props = defineProps<{
  modelValue: boolean;
  source?: GovernanceSource | null;
}>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();
const loading = ref(false);
const records = ref<GovernanceArrival[]>([]);
const error = ref<ReturnType<typeof normalizeGovernanceError> | null>(null);
const page = reactive({ pageNo: 1, pageSize: 10, total: 0 });

async function load() {
  if (!props.source) return;
  loading.value = true;
  error.value = null;
  try {
    const result = await fetchGovernanceArrivals({
      sourceCode: props.source.sourceCode,
      pageNo: page.pageNo,
      pageSize: page.pageSize,
    });
    records.value = result.records;
    page.total = result.total;
  } catch (cause) {
    error.value = normalizeGovernanceError(cause, "到达记录加载失败");
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.modelValue, props.source?.sourceCode],
  ([visible]) => {
    if (!visible) return;
    page.pageNo = 1;
    void load();
  },
);
</script>

<template>
  <BaseDrawer
    :model-value="modelValue"
    :title="source?.sourceName ? source.sourceName + '到达记录' : '到达记录'"
    size="min(900px, 94vw)"
    :show-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <TraceErrorAlert v-if="error" v-bind="error" />
    <el-table
      v-loading="loading"
      :data="records"
      empty-text="当前数据源暂无到达记录"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="结果集摘要" :span="2">
              {{ formatGovernanceValue(row.rowHash) }}
            </el-descriptions-item>
            <el-descriptions-item label="到达时间">
              <BaseDateTime :value="row.arrivedAt" empty-text="-" />
            </el-descriptions-item>
            <el-descriptions-item label="验收时间">
              <BaseDateTime :value="row.acceptedAt" empty-text="-" />
            </el-descriptions-item>
            <el-descriptions-item label="拒绝原因" :span="2">
              {{ formatGovernanceValue(row.errorMessage) }}
            </el-descriptions-item>
          </el-descriptions>
        </template>
      </el-table-column>
      <el-table-column
        prop="sourceBatchNo"
        label="来源批次"
        min-width="170"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="bizDate"
        label="业务日期"
        width="115"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="recordCount"
        label="记录数"
        width="100"
        align="right"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="到达状态" width="100">
        <template #default="{ row }">
          <GovernanceStatusTag :status="row.status" />
        </template>
      </el-table-column>
      <el-table-column label="到达时间" min-width="170">
        <template #default="{ row }">
          <BaseDateTime :value="row.arrivedAt" empty-text="-" />
        </template>
      </el-table-column>
    </el-table>
    <BasePagination
      v-bind="page"
      :fixed="false"
      @page-change="
        page.pageNo = $event;
        load();
      "
      @size-change="
        page.pageSize = $event;
        page.pageNo = 1;
        load();
      "
    />
  </BaseDrawer>
</template>
