<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { replaceToReturn } from "@/utils/return-navigation";
import { Back } from "@element-plus/icons-vue";
import { fetchInitiationPatterns, fetchInitiationWbsItems } from "@/api/budget";
import BaseColumnSettings from "@/components/base/BaseColumnSettings.vue";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import { useAuthStore } from "@/stores/auth";
import type { InitiationPatternItem, InitiationWbsItem } from "@/types/budget";
import { sameBackendId } from "@/utils/backend-id";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const hasReviewPermission = computed(() =>
  authStore.hasPermission("system:project:reviewRecord"),
);
const canDisplayEvaluation = computed(() =>
  authStore.hasPermission("system:project:eva:display"),
);

const projectId = computed(() => String(route.query.projectId ?? ""));
const modelName = computed(() => String(route.query.modelName ?? ""));
const majorVersion = computed(() => String(route.query.majorVersion ?? ""));
const gradeId = computed(() => {
  const raw = Array.isArray(route.query.gradeId)
    ? route.query.gradeId[0]
    : route.query.gradeId;
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
});

const loading = ref(false);
const patterns = ref<InitiationPatternItem[]>([]);
const tableData = ref<InitiationWbsItem[]>([]);
const total = ref(0);
const pageNo = ref(1);
const pageSize = ref(20);

const columnOptions = computed(() => {
  const evaluationDisabled = !canDisplayEvaluation.value;
  const options: { key: string; label: string; disabled?: boolean }[] = [
    { key: "level", label: "层级" },
    { key: "wbsNumber", label: "WBS" },
    { key: "wbsName", label: "WBS名称" },
    { key: "gradeName", label: "当前等级" },
    ...patterns.value.flatMap((p) => [
      { key: `${p.id}_budget`, label: p.patternName },
      { key: `${p.id}_remark`, label: `${p.patternName}费用说明` },
    ]),
    { key: "totalBudgetAmount", label: "预算总金额" },
    { key: "submitter", label: "预算提报人" },
    {
      key: "sorName",
      label: "集团统筹SOR名称",
      disabled: evaluationDisabled,
    },
    ...patterns.value.flatMap((p) => [
      {
        key: `${p.id}_assessBudget`,
        label: `${p.patternName}评估金额`,
        disabled: evaluationDisabled,
      },
      {
        key: `${p.id}_assessRemark`,
        label: `${p.patternName}评估说明`,
        disabled: evaluationDisabled,
      },
    ]),
    { key: "assessTotal", label: "合计 ", disabled: evaluationDisabled },
    {
      key: "paymentRatio",
      label: "支付比例",
      disabled: evaluationDisabled,
    },
    {
      key: "paymentEstimate",
      label: "支付评估金额",
      disabled: evaluationDisabled,
    },
    {
      key: "reductionDiff",
      label: "核减差值",
      disabled: evaluationDisabled,
    },
    {
      key: "reductionRatio",
      label: "核减比例",
      disabled: evaluationDisabled,
    },
    ...patterns.value.flatMap((p) => [
      {
        key: `${p.id}_paymentBudget`,
        label: `${p.patternName}评估支付金额`,
        disabled: evaluationDisabled,
      },
    ]),
    {
      key: "paymentAmount",
      label: "支付",
      disabled: evaluationDisabled || !hasReviewPermission.value,
    },
    {
      key: "amortizationAmount",
      label: "摊销",
      disabled: evaluationDisabled || !hasReviewPermission.value,
    },
    {
      key: "totalAmount",
      label: "合计",
      disabled: evaluationDisabled || !hasReviewPermission.value,
    },
    {
      key: "remark",
      label: "备注",
      disabled: evaluationDisabled || !hasReviewPermission.value,
    },
    {
      key: "totalOverspend",
      label: "总金额超支",
      disabled: evaluationDisabled || !hasReviewPermission.value,
    },
    {
      key: "paymentOverspend",
      label: "支付超支",
      disabled: evaluationDisabled || !hasReviewPermission.value,
    },
    { key: "version", label: "当前版本" },
    { key: "createBy", label: "创建人" },
    { key: "createTime", label: "创建时间" },
    { key: "updateBy", label: "更新人" },
    { key: "updateTime", label: "更新时间" },
  ];
  return options;
});
const visibleColumns = ref<string[]>([]);

function initVisibleColumns() {
  visibleColumns.value = columnOptions.value.map((c) => c.key);
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (isNaN(num)) return "-";
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resetRatio(ratioString: string | null | undefined) {
  if (!ratioString) return "";
  const arr = ratioString.split(",");
  if (arr.length > 1) {
    return arr.map((i) => `${i}%`).join("，");
  }
  return `${ratioString}%`;
}

function setPatternContent(
  budgetArr: InitiationWbsItem["initiationBudget"] | undefined,
  curIndex: number,
  isAssess = false,
) {
  const res = { budget: "-", remark: "-", paymentBudget: "-" };
  if (!budgetArr || !budgetArr.length) return res;
  const curId = patterns.value[curIndex]?.id;
  if (!curId) return res;
  const matched = budgetArr.find((item) =>
    sameBackendId(item.patternId, curId),
  );
  if (!matched) return res;
  if (!isAssess) {
    res.budget = formatPrice(matched.budget) || "0";
    res.remark = matched.remark || "-";
  } else {
    res.budget = formatPrice(matched.assessBudget) || "0";
    res.paymentBudget = formatPrice(matched.paymentBudget) || "0";
    res.remark = matched.assessRemark || "-";
  }
  return res;
}

async function getPatternData() {
  try {
    patterns.value = await fetchInitiationPatterns(projectId.value);
  } catch {
    patterns.value = [];
    BaseToast.error("预算版型加载失败");
  }
  initVisibleColumns();
}

async function getTableData() {
  const selectedGradeId = gradeId.value;
  if (!projectId.value || selectedGradeId === null) return;
  loading.value = true;
  try {
    const res = await fetchInitiationWbsItems({
      projectId: projectId.value,
      gradeId: String(selectedGradeId),
      isLatestVersion: 0,
      majorVersion: majorVersion.value || null,
      historyRowId: typeof route.query.historyRowId === "string" ? route.query.historyRowId : undefined,
      pageNum: pageNo.value,
      pageSize: pageSize.value,
    });
    total.value = res.total;
    tableData.value = (res.rows || []).map((item) => ({
      ...item,
      grade: item.grade
        ? { ...item.grade, realLevel: (item.grade.level ?? 0) + 1 }
        : { gradeName: "", level: 0, realLevel: 1 },
    }));
  } catch {
    total.value = 0;
    tableData.value = [];
    BaseToast.error("历史版本加载失败");
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number) {
  pageNo.value = page;
  getTableData();
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  pageNo.value = 1;
  getTableData();
}

function goBack() {
  if (typeof route.query.returnPath === "string" && route.query.returnPath) {
    replaceToReturn(router, route, "/budget/wbs-touzi/lixiang");
    return;
  }

  const returnPath = String(
    route.query.returnPath || "/budget/wbs-touzi/lixiang",
  );
  void router.replace({
    path: "/budget/initiation/detail",
    query: {
      projectId: projectId.value,
      modelName: modelName.value,
      majorVersion: majorVersion.value,
      isLatestVersion: 1,
      returnPath,
    },
  });
}

onMounted(async () => {
  await getPatternData();
  await getTableData();
});
</script>

<template>
  <PageContainer
    class="budget-initiation-history-page"
    title="立项评审历史版本"
  >
    <template #titleExtra>
      <span class="bq-page-inline-meta">
       项目代码： {{ modelName }}
      </span>
    </template>
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack"
        >返回</PermissionButton
      >
      <BaseColumnSettings v-model="visibleColumns" :columns="columnOptions" />
    </template>
    <BaseDataTable :data="tableData" :loading="loading" height="100%">
      <el-table-column
        v-if="visibleColumns.includes('level')"
        prop="grade.realLevel"
        width="60"
        label="层级"
      />
      <el-table-column
        v-if="visibleColumns.includes('wbsNumber')"
        prop="wbsNumber"
        width="150"
        label="WBS"
        show-overflow-tooltip
      />
      <el-table-column
        v-if="visibleColumns.includes('wbsName')"
        prop="wbsName"
        width="160"
        label="WBS名称"
        show-overflow-tooltip
      />
      <el-table-column
        v-if="visibleColumns.includes('gradeName')"
        prop="grade.gradeName"
        width="150"
        label="当前等级"
        show-overflow-tooltip
      />
      <template v-for="(item, index) in patterns" :key="`h-bgt-${item.id}`">
        <el-table-column
          v-if="visibleColumns.includes(`${item.id}_budget`)"
          :label="item.patternName"
          width="130"
        >
          <template #default="{ row }">
            {{ setPatternContent(row.initiationBudget, index).budget }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.includes(`${item.id}_remark`)"
          :label="`费用说明`"
          width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ setPatternContent(row.initiationBudget, index).remark }}
          </template>
        </el-table-column>
      </template>
      <el-table-column
        v-if="visibleColumns.includes('totalBudgetAmount')"
        prop="totalBudgetAmount"
        width="130"
        label="预算总金额"
      >
        <template #default="{ row }">{{
          formatPrice(row.totalBudgetAmount)
        }}</template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('submitter')"
        prop="submitter"
        width="90"
        label="预算提报人"
      />
      <template v-if="canDisplayEvaluation">
        <el-table-column
          v-if="visibleColumns.includes('sorName')"
          prop="sorName"
          width="130"
          label="集团统筹SOR名称"
          show-overflow-tooltip
        />
        <template
          v-for="(item, index) in patterns"
          :key="`h-assess-${item.id}`"
        >
          <el-table-column
            v-if="visibleColumns.includes(`${item.id}_assessBudget`)"
            :label="`${item.patternName}评估金额`"
            width="130"
          >
            <template #default="{ row }">
              {{ setPatternContent(row.initiationBudget, index, true).budget }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="visibleColumns.includes(`${item.id}_assessRemark`)"
            :label="`${item.patternName}评估说明`"
            width="120"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ setPatternContent(row.initiationBudget, index, true).remark }}
            </template>
          </el-table-column>
        </template>
        <el-table-column
          v-if="visibleColumns.includes('assessTotal')"
          prop="assessTotalAmount"
          width="150"
          label="合计"
        >
          <template #default="{ row }">{{
            formatPrice(row.assessTotalAmount)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.includes('paymentRatio')"
          label="支付比例"
          width="90"
        >
          <template #default="{ row }">
            <el-tooltip :content="resetRatio(row.paymentRatio)" placement="top">
              <span>{{ resetRatio(row.paymentRatio) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.includes('paymentEstimate')"
          prop="paymentEstimate"
          width="130"
          label="支付评估金额"
        >
          <template #default="{ row }">{{
            formatPrice(row.paymentEstimate)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.includes('reductionDiff')"
          width="130"
          label="核减差值"
        >
          <template #default="{ row }">{{
            formatPrice(row.reductionDiff)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.includes('reductionRatio')"
          width="130"
          label="核减比例"
        >
          <template #default="{ row }"
            ><span v-if="row.reductionRatio"
              >{{ row.reductionRatio }}%</span
            ></template
          >
        </el-table-column>
        <template
          v-for="(item, index) in patterns"
          :key="`h-payment-${item.id}`"
        >
          <el-table-column
            v-if="visibleColumns.includes(`${item.id}_paymentBudget`)"
            width="120"
            show-overflow-tooltip
          >
            <template #header
              ><span>{{ item.patternName }}评估支付金额</span></template
            >
            <template #default="{ row }">
              {{
                setPatternContent(row.initiationBudget, index, true)
                  .paymentBudget
              }}
            </template>
          </el-table-column>
        </template>
        <el-table-column
          v-if="visibleColumns.includes('paymentAmount')"
          prop="paymentAmount"
          width="80"
          label="支付"
        >
          <template #default="{ row }">{{
            formatPrice(row.paymentAmount)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.includes('amortizationAmount')"
          prop="amortizationAmount"
          width="80"
          label="摊销"
        >
          <template #default="{ row }">{{
            formatPrice(row.amortizationAmount)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.includes('totalAmount')"
          prop="totalAmount"
          width="80"
          label="合计 (总额)"
        >
          <template #default="{ row }">{{
            formatPrice(row.totalAmount)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.includes('remark')"
          prop="remark"
          width="80"
          label="备注"
          show-overflow-tooltip
        />
        <el-table-column
          v-if="visibleColumns.includes('totalOverspend')"
          prop="totalOverspend"
          width="100"
          label="总金额超支"
        >
          <template #default="{ row }">{{
            formatPrice(row.totalOverspend)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.includes('paymentOverspend')"
          prop="paymentOverspend"
          width="80"
          label="支付超支"
        >
          <template #default="{ row }">{{
            formatPrice(row.paymentOverspend)
          }}</template>
        </el-table-column>
      </template>
      <el-table-column
        v-if="visibleColumns.includes('version')"
        prop="version"
        width="80"
        label="当前版本"
      />
      <el-table-column
        v-if="visibleColumns.includes('createBy')"
        prop="createBy"
        width="100"
        label="创建人"
        show-overflow-tooltip
      />
      <el-table-column
        v-if="visibleColumns.includes('createTime')"
        prop="createTime"
        width="160"
        label="创建时间"
      />
      <el-table-column
        v-if="visibleColumns.includes('updateBy')"
        prop="updateBy"
        width="100"
        label="更新人"
        show-overflow-tooltip
      />
      <el-table-column
        v-if="visibleColumns.includes('updateTime')"
        prop="updateTime"
        width="160"
        label="更新时间"
      />
    </BaseDataTable>
    <QueryTable
      pagination-only
      fixed-pagination
      :pagination="{ pageNo, pageSize, total }"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
    />
  </PageContainer>
</template>

<style scoped>
.budget-initiation-history-page {
  display: flex;
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height) - 40px
  );
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
}

.budget-initiation-history-page.is-page-fullscreen {
  height: 100vh;
  min-height: 100vh;
  overflow: auto;
}

:global(body.bq-page-fullscreen-active .base-pagination.is-fixed) {
  left: 0;
}

.budget-initiation-history-page :deep(.page-container__body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  grid-template-rows: minmax(0, 1fr) auto;
}

.budget-initiation-history-page :deep(.base-data-table) {
  min-height: 0;
  overflow: hidden;
  grid-template-rows: minmax(0, 1fr);
}

.budget-initiation-history-page :deep(.page-container__actions) {
  align-items: center;
  flex-wrap: nowrap;
}
</style>
