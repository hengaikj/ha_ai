<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back } from "@element-plus/icons-vue";
import { fetchCostBomPartCompareDetail } from "@/api/cost-center";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";

type CompareRow = Record<string, unknown>;

type FieldConfig = {
  label: string;
  keys: string[];
  minWidth?: number;
};

type TabConfig = {
  name: string;
  label: string;
  fields: FieldConfig[];
};

const versionColumn: FieldConfig = {
  label: "BOM版本",
  keys: ["version", "bomVersion", "versionNo"],
  minWidth: 110,
};

const tabs: TabConfig[] = [
  {
    name: "basic",
    label: "基础信息",
    fields: [
      { label: "零件号", keys: ["partNumber", "partNo"], minWidth: 150 },
      { label: "零件名称", keys: ["partName"], minWidth: 170 },
      { label: "SOR号", keys: ["sorNumber", "sorCode", "sorName"], minWidth: 130 },
      { label: "ECR号", keys: ["ecrNumber"], minWidth: 130 },
      { label: "装配级别", keys: ["assemblyLevel"], minWidth: 120 },
      { label: "单位", keys: ["unitUsage", "unit", "quantity"], minWidth: 100 },
      { label: "模块标识", keys: ["moduleIdentifier"], minWidth: 120 },
      { label: "首页车型", keys: ["firstVehicleModel"], minWidth: 130 },
      { label: "供应商名称", keys: ["supplierName"], minWidth: 160 },
    ],
  },
  {
    name: "category",
    label: "分类",
    fields: [
      { label: "通用化级别", keys: ["generalizationLevel"], minWidth: 140 },
      {
        label: "是否架构件",
        keys: ["isArchitectureComponent", "architectureComponent"],
        minWidth: 140,
      },
    ],
  },
  {
    name: "supplement",
    label: "BOM补充信息",
    fields: [
      { label: "建议货源", keys: ["suggestedSupplySource"], minWidth: 150 },
      { label: "货源描述", keys: ["sourceDescription"], minWidth: 220 },
      {
        label: "多结构货源",
        keys: ["multiStructuredSupplySources"],
        minWidth: 160,
      },
      { label: "多结构货源描述", keys: ["multiSourcesDescription"], minWidth: 220 },
    ],
  },
  {
    name: "division",
    label: "分工",
    fields: [
      { label: "研发专业部门", keys: ["developmentDepartment"], minWidth: 160 },
      { label: "专业工程师", keys: ["expertEngineer"], minWidth: 140 },
      { label: "零件属性", keys: ["partAttribute"], minWidth: 130 },
      {
        label: "成本专业科室",
        keys: ["firstClassification", "costDepartmentName"],
        minWidth: 160,
      },
      {
        label: "成本二级分类",
        keys: ["secondClassification", "costCategoryLevel2Name", "costCategoryLevel2"],
        minWidth: 160,
      },
      {
        label: "成本三级分类",
        keys: ["threeClassification", "costCategoryLevel3Name", "costCategoryLevel3"],
        minWidth: 160,
      },
    ],
  },
  {
    name: "target",
    label: "目标值",
    fields: [
      {
        label: "目标值",
        keys: ["targetMaterialCost", "targetValue", "targetCostAmount"],
        minWidth: 140,
      },
    ],
  },
  {
    name: "assess",
    label: "评估值",
    fields: [
      {
        label: "评估值",
        keys: ["assessMaterialCost", "initialEvaluationValue", "estimatedCostAmount"],
        minWidth: 140,
      },
      { label: "数据来源", keys: ["assessDataSources"], minWidth: 150 },
    ],
  },
  {
    name: "current",
    label: "当前成本",
    fields: [
      {
        label: "材料成本（含摊销）",
        keys: [
          "currentMaterialCostAmortize",
          "materialCostWithAmortization",
          "currentCostAmortize",
        ],
        minWidth: 170,
      },
      {
        label: "材料成本（不含摊销）",
        keys: [
          "currentMaterialCost",
          "materialCostWithoutAmortization",
          "materialCostAmount",
          "currentCostAmount",
        ],
        minWidth: 180,
      },
      {
        label: "摊销金额",
        keys: ["currentAmortize", "amortizationAmount"],
        minWidth: 140,
      },
    ],
  },
];

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const activeTab = ref("basic");
const compareRows = ref<CompareRow[]>([]);

const bomVersionId = computed(() =>
  String(route.query.bomVersionId || route.query.versionId || ""),
);
const baseBomVersion = computed(() =>
  String(route.query.baseBomVersion || route.query.baseVersion || ""),
);
const targetBomVersion = computed(() =>
  String(route.query.targetBomVersion || route.query.targetVersion || ""),
);
const oldPartId = computed(() => String(route.query.oldPartId || ""));
const newPartId = computed(() => String(route.query.newPartId || ""));
const partNumber = computed(
  () => readText(compareRows.value[0], ["partNumber", "partNo"]) || String(route.query.partNumber || ""),
);
const partName = computed(
  () => readText(compareRows.value[1] || compareRows.value[0], ["partName"]) || String(route.query.partName || ""),
);
const pageTitle = computed(() => String(route.meta.title ?? "零件详情对比"));
const compareBasePath = computed(() =>
  route.path.replace(/\/versions\/compare\/parts$/, "/versions/compare"),
);
const usageFields = computed<FieldConfig[]>(() =>
  patternNames.value.map((patternName) => ({
    label: patternName,
    keys: [`pattern:${patternName}`],
    minWidth: 130,
  })),
);
const patternNames = computed(() => {
  const names = new Set<string>();
  compareRows.value.forEach((row) => {
    getPatterns(row).forEach((pattern) => {
      const patternName = readText(pattern, ["patternName"]);
      if (patternName && patternName !== "加权") {
        names.add(patternName);
      }
    });
  });
  return [...names];
});
const allTabs = computed<TabConfig[]>(() => [
  ...tabs.slice(0, 4),
  {
    name: "usage",
    label: "单车用量",
    fields: usageFields.value,
  },
  ...tabs.slice(4),
]);

async function loadCompareDetail() {
  if (!oldPartId.value || !newPartId.value || !bomVersionId.value) {
    compareRows.value = [];
    return;
  }

  loading.value = true;
  try {
    const response = await fetchCostBomPartCompareDetail({
      oldId: oldPartId.value,
      diffId: newPartId.value,
      bomVersionId: bomVersionId.value,
      oldBomVersion: baseBomVersion.value,
      diffBomVersion: targetBomVersion.value,
      vehicleModelId: route.query.vehicleModelId
        ? String(route.query.vehicleModelId)
        : undefined,
      valveId: route.query.valveId ? String(route.query.valveId) : undefined,
      partName: String(route.query.partName || ""),
      partNumber: String(route.query.partNumber || ""),
    });
    compareRows.value = readCompareRows(response);
  } finally {
    loading.value = false;
  }
}

function readCompareRows(response: Record<string, unknown>) {
  const data = asRecord(response.data ?? response);
  const rows = data.bomCompareList ?? data.compareList ?? data.rows ?? data.records;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map(asRecord).sort((left, right) => rowOrder(left) - rowOrder(right));
}

function rowOrder(row: CompareRow) {
  const version = normalizeVersion(readText(row, ["version", "bomVersion", "versionNo"]));
  if (version && version === normalizeVersion(baseBomVersion.value)) {
    return 0;
  }
  if (version && version === normalizeVersion(targetBomVersion.value)) {
    return 1;
  }
  const id = readText(row, ["id", "partId"]);
  if (id && id === oldPartId.value) {
    return 0;
  }
  if (id && id === newPartId.value) {
    return 1;
  }
  return 2;
}

function fieldValue(row: CompareRow, field: FieldConfig) {
  const patternKey = field.keys.find((key) => key.startsWith("pattern:"));
  if (patternKey) {
    return patternUsage(row, patternKey.replace("pattern:", ""));
  }
  return readText(row, field.keys);
}

function displayFieldValue(row: CompareRow, field: FieldConfig) {
  const value = fieldValue(row, field);
  if (field === versionColumn) {
    return value ? `V${value}` : "--";
  }
  return value || "--";
}

function isDiffField(field: FieldConfig) {
  if (compareRows.value.length < 2) {
    return false;
  }
  return normalizeValue(fieldValue(compareRows.value[0], field)) !== normalizeValue(fieldValue(compareRows.value[1], field));
}

function tabDiffCount(tab: TabConfig) {
  return tab.fields.reduce((count, field) => count + (isDiffField(field) ? 1 : 0), 0);
}

function getPatterns(row: CompareRow) {
  const source = row.costBomPattern ?? row.patterns;
  return Array.isArray(source) ? source.map(asRecord) : [];
}

function patternUsage(row: CompareRow, patternName: string) {
  const pattern = getPatterns(row).find(
    (item) => readText(item, ["patternName"]) === patternName,
  );
  return readText(pattern, ["usagePerVehicle"]);
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readText(source: CompareRow | undefined, keys: string[]) {
  const row = source ?? {};
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return "";
}

function normalizeValue(value: string) {
  return value == null || value === "" ? "" : String(value);
}

function normalizeVersion(value: string) {
  return normalizeValue(value).replace(/^V/i, "");
}

function goBack() {
  router.replace({
    path: compareBasePath.value,
    query: {
      ...route.query,
      oldPartId: undefined,
      newPartId: undefined,
      partNumber: undefined,
      partName: undefined,
    },
  });
}

onMounted(loadCompareDetail);
</script>

<template>
  <PageContainer :title="pageTitle">
    <template #titleExtra>
      <div class="cost-bom-part-compare-page__summary">
        <span>零件号：{{ partNumber || "--" }}</span>
        <span>零件名称：{{ partName || "--" }}</span>
      </div>
    </template>

    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack"
      >
        返回
      </PermissionButton>
    </template>

    <section v-loading="loading" class="cost-bom-part-compare-page">
      <el-tabs v-model="activeTab" class="cost-bom-part-compare-page__tabs">
        <el-tab-pane v-for="tab in allTabs" :key="tab.name" :name="tab.name">
          <template #label>
            <span>{{ tab.label }}</span>
            <span class="cost-bom-part-compare-page__count">
              （{{ tabDiffCount(tab) }}）
            </span>
          </template>

          <div class="cost-bom-part-compare-page__table-scroll">
            <el-table
              :data="compareRows"
              border
              class="cost-bom-part-compare-page__table"
              :empty-text="loading ? '加载中' : '暂无零件详情对比数据'"
            >
              <el-table-column
                :label="versionColumn.label"
                width="110"
                align="center"
              >
                <template #default="{ row }">
                  {{ displayFieldValue(row, versionColumn) }}
                </template>
              </el-table-column>
              <el-table-column
                v-for="field in tab.fields"
                :key="`${tab.name}-${field.label}`"
                :min-width="field.minWidth ?? 140"
                align="center"
              >
                <template #header>
                  <span :class="{ 'is-diff': isDiffField(field) }">
                    {{ field.label }}
                  </span>
                </template>
                <template #default="{ row }">
                  <span :class="{ 'is-diff': isDiffField(field) }">
                    {{ displayFieldValue(row, field) }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </PageContainer>
</template>

<style scoped>
.cost-bom-part-compare-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 420px;
  overflow-x: hidden;
}

.cost-bom-part-compare-page__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  color: var(--bq-color-text);
  font-size: 14px;
}

.cost-bom-part-compare-page__tabs {
  width: 0;
  min-width: 100%;
}

.cost-bom-part-compare-page__tabs :deep(.el-tabs__content),
.cost-bom-part-compare-page__tabs :deep(.el-tab-pane) {
  width: 100%;
  min-width: 0;
}

.cost-bom-part-compare-page__count {
  margin-left: 4px;
  color: var(--bq-color-danger);
}

.cost-bom-part-compare-page__table-scroll {
  display: block;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: auto;
}

.cost-bom-part-compare-page__table {
  width: 100%;
  min-width: 0;
}

.cost-bom-part-compare-page__table :deep(.is-diff) {
  color: var(--bq-color-warning);
  font-weight: 600;
}
</style>
