<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back, Refresh, Search } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import { replaceToReturn } from "@/utils/return-navigation";
import PermissionButton from "@/components/security/PermissionButton.vue";
import {
  fetchPurchaseBomDiff,
  fetchPurchaseBomPartCompare,
} from "@/api/cost-center";
import type {
  PurchaseBomDiffItem,
  PurchaseBomDiffPage,
  PurchaseBomPartCompare,
} from "@/types/cost-center";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const diffPage = ref<PurchaseBomDiffPage | null>(null);
const diffRows = ref<PurchaseBomDiffItem[]>([]);
const selectedOldPartNo = ref("");
const selectedNewPartNo = ref("");
const compareVisible = ref(false);
const compareDetail = ref<PurchaseBomPartCompare | null>(null);

const compareFields = [
  { code: "partNo", label: "零件号" },
  { code: "partName", label: "零件名称" },
  { code: "pathQuantity", label: "单车用量" },
  { code: "unitCode", label: "基本单位" },
  { code: "modelUserd1st", label: "零件首用平台" },
  { code: "sorNum", label: "SOR名称" },
  { code: "engineerIncharge", label: "责任工程师" },
  { code: "sogForSug", label: "建议货源" },
  { code: "respDept", label: "责任部门" },
  { code: "pendingGeneralLevel", label: "通用化级别" },
  { code: "partType", label: "是否架构件" },
  { code: "ecnProcessNum", label: "ECN处理编号" },
  { code: "partCategory", label: "零件类别" },
] as const;

const projectId = computed(() => Number(route.query.projectId));
const purchaseBomId = computed(() => Number(route.query.purchaseBomId));
const baseVersionId = computed(() =>
  readRouteQueryString(route.query.baseVersionId),
);
const valveId = computed(() => Number(route.query.valveId));
const projectName = computed(() =>
  readRouteQueryString(route.query.projectName),
);
const reorganizeCode = computed(() =>
  readRouteQueryString(route.query.reorganizeCode),
);
const reorganizeName = computed(() =>
  readRouteQueryString(route.query.reorganizeName),
);
const baseVersionName = computed(() =>
  readRouteQueryString(route.query.baseVersionName),
);
const compareTitle = computed(
  () => `${baseVersionName.value || "成本BOM"} VS 最新BOM`,
);
const compareRows = computed(() =>
  [
    {
      version: baseVersionName.value || "旧版本",
      part: compareDetail.value?.oldVersionPart,
    },
    {
      version: "最新BOM",
      part: compareDetail.value?.newVersionPart,
    },
  ].map((row) => ({
    version: row.version,
    ...Object.fromEntries(
      compareFields.map((field) => [field.code, row.part?.[field.code] ?? ""]),
    ),
  })),
);

function isCompareValueChanged(fieldCode: (typeof compareFields)[number]["code"]) {
  const oldValue = compareDetail.value?.oldVersionPart?.[fieldCode] ?? "";
  const newValue = compareDetail.value?.newVersionPart?.[fieldCode] ?? "";
  return String(oldValue) !== String(newValue);
}

const diffQuery = reactive({
  partNo: "",
  partName: "",
});

const oldPartCount = computed(() => diffPage.value?.oldPartCount ?? 0);
const newPartCount = computed(() => diffPage.value?.newPartCount ?? 0);
const modifiedCount = computed(() => diffPage.value?.modifiedCount ?? 0);
const removedCount = computed(() => diffPage.value?.removedCount ?? 0);
const addedCount = computed(() => diffPage.value?.addedCount ?? 0);
const filteredDiffRows = computed(() => {
  const partNo = diffQuery.partNo.trim().toLowerCase();
  const partName = diffQuery.partName.trim().toLowerCase();
  if (!partNo && !partName) {
    return diffRows.value;
  }
  return diffRows.value.filter((row) => {
    const rowPartNo = row.partNo.toLowerCase();
    const rowPartName = [row.partName, row.oldPartName, row.newPartName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (!partNo || rowPartNo.includes(partNo)) &&
      (!partName || rowPartName.includes(partName))
    );
  });
});
const oldTableRows = computed(() =>
  filteredDiffRows.value.filter((row) => row.changeType !== "ADDED"),
);
const newTableRows = computed(() =>
  filteredDiffRows.value.filter((row) => row.changeType !== "REMOVED"),
);

async function loadDiffParts() {
  loading.value = true;
  try {
    const page = await fetchPurchaseBomDiff(
      projectId.value,
      purchaseBomId.value,
      reorganizeCode.value,
      {
        baseVersionId: baseVersionId.value,
        valveId: valveId.value,
      },
    );
    diffPage.value = page;
    diffRows.value = page.records;
    selectedOldPartNo.value = "";
    selectedNewPartNo.value = "";
  } finally {
    loading.value = false;
  }
}

function resetDiffQuery() {
  diffQuery.partNo = "";
  diffQuery.partName = "";
  selectedOldPartNo.value = "";
  selectedNewPartNo.value = "";
}

function searchDiffParts() {
  selectedOldPartNo.value = "";
  selectedNewPartNo.value = "";
}

async function openCompare(row: PurchaseBomDiffItem) {
  compareDetail.value = await fetchPurchaseBomPartCompare(
    projectId.value,
    purchaseBomId.value,
    reorganizeCode.value,
    row.partNo,
    {
      baseVersionId: baseVersionId.value,
      valveId: valveId.value,
    },
  );
  compareVisible.value = true;
}

async function compareSelectedParts() {
  const oldPart = oldTableRows.value.find(
    (row) => row.partNo === selectedOldPartNo.value,
  );
  const newPart = newTableRows.value.find(
    (row) => row.partNo === selectedNewPartNo.value,
  );
  if (!oldPart || !newPart) {
    BaseToast.warning("左右两侧各选择一条零件后再对比。");
    return;
  }
  if (oldPart.partNo !== newPart.partNo) {
    BaseToast.warning("请选择相同零件号进行对比。");
    return;
  }
  await openCompare(newPart);
}

function goBack() {
  replaceToReturn(router, route, "/cost/bom/purchase-list/reorganize");
}

function resolveRowClass({ row }: { row: PurchaseBomDiffItem }) {
  if (row.changeType === "ADDED") {
    return "is-added";
  }
  if (row.changeType === "REMOVED") {
    return "is-removed";
  }
  if (row.changeType === "MODIFIED") {
    return "is-modified";
  }
  return "";
}

function readRouteQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }
  return typeof value === "string" ? value : "";
}

onMounted(loadDiffParts);
</script>

<template>
  <PageContainer
    class="purchase-bom-diff-analysis-container"
    title="差异化分析"
  >
    <template #titleExtra>
      <div class="purchase-bom-diff-analysis-page__meta">
        <span
          >项目代号:<span>{{ projectName || "--" }}</span></span
        >
        <span
          >整编名称:<span>{{
            reorganizeName || reorganizeCode || "--"
          }}</span></span
        >
      </div>
    </template>

    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack"
        >返回</PermissionButton
      >
    </template>

    <section v-loading="loading" class="purchase-bom-diff-analysis-page">
      <header class="purchase-bom-diff-analysis-page__header">
        <div class="purchase-bom-diff-analysis-page__compare">
          对比:<strong>{{ compareTitle }}</strong>
        </div>
      </header>

      <section class="purchase-bom-diff-analysis-page__search">
        <el-form :model="diffQuery" inline>
          <el-form-item label="零件号">
            <el-input
              v-model="diffQuery.partNo"
              clearable
              placeholder="请输入零件号"
              @keyup.enter="searchDiffParts"
            />
          </el-form-item>
          <el-form-item label="零件名称">
            <el-input
              v-model="diffQuery.partName"
              clearable
              placeholder="请输入零件名称"
              @keyup.enter="searchDiffParts"
            />
          </el-form-item>
          <el-form-item class="purchase-bom-diff-analysis-page__search-actions">
            <PermissionButton
              type="primary"
              :icon="Search"
              @click="searchDiffParts"
              >搜索</PermissionButton
            >
            <PermissionButton :icon="Refresh" @click="resetDiffQuery"
              >重置</PermissionButton
            >
            <PermissionButton
              permission="cost:bom:purchase-list:compare"
              variant="primary"
              type="primary"
              @click="compareSelectedParts"
            >
              对比
            </PermissionButton>
          </el-form-item>
        </el-form>
      </section>

      <section class="purchase-bom-diff-analysis-page__tables">
        <div class="purchase-bom-diff-analysis-page__panel">
          <div class="purchase-bom-diff-analysis-page__new-version-title">{{ baseVersionName || "成本BOM" }}-{{ oldPartCount }}件</div>
          <el-table
            :data="oldTableRows"
            border
            height="388"
            :row-class-name="resolveRowClass"
          >
            <el-table-column label="" align="center" width="62">
              <template #default="{ row }">
                <el-radio
                  v-if="row.changeType === 'MODIFIED'"
                  v-model="selectedOldPartNo"
                  :value="row.partNo"
                  class="purchase-bom-diff-analysis-page__radio"
                  :aria-label="`选择旧版本零件${row.partNo}`"
                />
              </template>
            </el-table-column>
            <el-table-column
              type="index"
              label="序号"
              width="74"
              align="center"
            />
            <el-table-column
              prop="partNo"
              label="零件号"
              min-width="160"
              align="center"
            >
              <template #default="{ row }">
                <span class="purchase-bom-diff-analysis-page__diff-text">
                  {{ row.partNo || "--" }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              prop="partName"
              label="零件名称"
              min-width="180"
              align="center"
            >
              <template #default="{ row }">
                <span class="purchase-bom-diff-analysis-page__diff-text">
                  {{ row.oldPartName || row.partName || "--" }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="purchase-bom-diff-analysis-page__panel">
          <div class="purchase-bom-diff-analysis-page__new-title">
            <div class="purchase-bom-diff-analysis-page__new-version-title">
              最新BOM -版本-{{ newPartCount }}件
            </div>
            <strong class="is-modified">变更零件:{{ modifiedCount }}项</strong>
            <strong class="is-removed">删除零件:{{ removedCount }}项</strong>
            <strong class="is-added">新增零件:{{ addedCount }}项</strong>
          </div>
          <el-table
            :data="newTableRows"
            border
            height="388"
            :row-class-name="resolveRowClass"
          >
            <el-table-column label="" align="center" width="62">
              <template #default="{ row }">
                <el-radio
                  v-if="row.changeType === 'MODIFIED'"
                  v-model="selectedNewPartNo"
                  :value="row.partNo"
                  class="purchase-bom-diff-analysis-page__radio"
                  :aria-label="`选择最新版本零件${row.partNo}`"
                />
              </template>
            </el-table-column>
            <el-table-column
              type="index"
              label="序号"
              width="74"
              align="center"
            />
            <el-table-column
              prop="partNo"
              label="零件号"
              min-width="160"
              align="center"
            >
              <template #default="{ row }">
                <span class="purchase-bom-diff-analysis-page__diff-text">
                  {{ row.partNo || "--" }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              prop="partName"
              label="零件名称"
              min-width="180"
              align="center"
            >
              <template #default="{ row }">
                <span class="purchase-bom-diff-analysis-page__diff-text">
                  {{ row.newPartName || row.partName || "--" }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>



      <BaseFormDialog
        v-model="compareVisible"
        :title="compareDetail ? `${compareDetail.partNo}零件对比` : '零件对比'"
        width="min(1500px, 92vw)"
        confirm-text="关闭"
        cancel-text="取消"
        close-on-confirm
      >
        <div class="purchase-bom-diff-analysis-page__compare-summary">
          <span>零件号：{{ compareDetail?.partNo || "--" }}</span>
          <span>零件名称：{{ compareDetail?.partName || "--" }}</span>
        </div>
        <el-table
          :data="compareRows"
          border
          max-height="480"
          class="purchase-bom-diff-analysis-page__compare-table"
        >
          <el-table-column align="center" prop="version" label="版本" width="120" fixed="left" />
          <el-table-column
            v-for="field in compareFields"
            :key="field.code"
            :prop="field.code"
            :label="field.label"
            min-width="150"
            align="center"
          >
            <template #default="{ row }">
              <span
                :class="{
                  'purchase-bom-diff-analysis-page__changed-value':
                    isCompareValueChanged(field.code),
                }"
              >
                {{ row[field.code] || "--" }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </BaseFormDialog>
    </section>
  </PageContainer>
</template>

<style scoped>
.purchase-bom-diff-analysis-page {
  min-height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) - 96px
  );
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: hidden;
}

.purchase-bom-diff-analysis-page__header {
  display: flex;
  min-height: 32px;
  align-items: center;
}

.purchase-bom-diff-analysis-page__header{
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  font-weight: 700;
  line-height: 28px;
}

.purchase-bom-diff-analysis-page__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
}

.purchase-bom-diff-analysis-page__meta span,
.purchase-bom-diff-analysis-page__compare {
  display: inline-flex;
  gap: 10px;
  align-items: center;
}

.purchase-bom-diff-analysis-page__header strong,
.purchase-bom-diff-analysis-page__meta strong {
  color: var(--bq-color-text);
  font-weight: 700;
}

.purchase-bom-diff-analysis-page__search-actions {
  justify-self: end;
}

.purchase-bom-diff-analysis-page__compare-button {
  width: 88px;
  min-height: 44px;
  font-size: 18px;
  font-weight: 700;
}

.purchase-bom-diff-analysis-page__tables {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 26px;
}

.purchase-bom-diff-analysis-page__panel {
  min-width: 0;
}


.purchase-bom-diff-analysis-page__new-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
}

.purchase-bom-diff-analysis-page__new-version-title {
  font-size: 14px;
  font-weight: 700;
  line-height: 28px;
}


.purchase-bom-diff-analysis-page__new-title .is-modified {
  color: rgb(255, 153, 51);
}

.purchase-bom-diff-analysis-page__new-title .is-removed {
  color: var(--bq-color-danger);
}

.purchase-bom-diff-analysis-page__new-title .is-added {
  color: var(--bq-color-success);
}

.purchase-bom-diff-analysis-page__panel :deep(.el-table .el-table__row) {
  height: 56px;
}

.purchase-bom-diff-analysis-page__radio :deep(.el-radio__label) {
  display: none;
}

.purchase-bom-diff-analysis-page__panel
  :deep(.is-modified .purchase-bom-diff-analysis-page__diff-text) {
  color: rgb(255, 153, 51);
}

.purchase-bom-diff-analysis-page__panel
  :deep(.is-removed .purchase-bom-diff-analysis-page__diff-text) {
  color: var(--bq-color-danger);
}

.purchase-bom-diff-analysis-page__panel
  :deep(.is-added .purchase-bom-diff-analysis-page__diff-text) {
  color: var(--bq-color-success);
}

.purchase-bom-diff-analysis-page__changed-value {
  color: rgb(255, 153, 51);
  font-weight: 600;
}

.purchase-bom-diff-analysis-page__compare-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  margin-bottom: 22px;
  color: var(--bq-color-text-secondary);
  font-size: 16px;
  font-weight: 700;
}

.purchase-bom-diff-analysis-page__compare-table :deep(.el-table__cell) {
  white-space: normal;
  word-break: break-word;
}

@media (max-width: 1200px) {
  .purchase-bom-diff-analysis-page__search :deep(.el-form) {
    grid-template-columns: repeat(2, minmax(260px, 1fr));
  }

  .purchase-bom-diff-analysis-page__search-actions {
    justify-self: start;
  }

  .purchase-bom-diff-analysis-page__tables {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .purchase-bom-diff-analysis-page__search :deep(.el-form) {
    grid-template-columns: 1fr;
  }

  .purchase-bom-diff-analysis-page__search :deep(.el-input) {
    width: 100%;
  }
}
</style>
