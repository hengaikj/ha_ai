<script setup lang="ts">
import { resolveServerTotal } from "@/utils/pagination";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back } from "@element-plus/icons-vue";
import { fetchCostBomPartHistories } from "@/api/cost-center";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import { replaceToReturn } from "@/utils/return-navigation";
import type { CostBomPartItem } from "@/types/cost-center";
import { formatCostBomVersion } from "@/utils/cost-bom-export";

type PartHistoryRow = CostBomPartItem & {
  costBomVersionId: number;
  costBomVersionNo: number;
  costBomVersionStatus: string;
  costBomSubmittedAt?: string | null;
  costBomPattern?: unknown[] | null;
};

type PatternColumn = {
  key: string;
  label: string;
  patternCode?: string;
  patternId?: string | number;
  index: number;
};

type ValueType = "money" | "quantity" | "text";

const route = useRoute();
const router = useRouter();

const projectId = computed(() => Number(route.query.projectId));
const versionId = computed(() =>
  Number(route.query.bomVersionId || route.query.versionId),
);
const partId = computed(() => String(route.query.partId ?? ""));
const parentId = computed(() =>
  String(route.query.parentId || partId.value || ""),
);
const partNo = ref(String(route.query.partNo ?? ""));
// 优先使用外层详情页传入的版本号，历史接口有返回时再用行数据兜底。
const versionNo = computed(() =>
  String(
    route.query.version ||
      route.query.versionNo ||
      route.query.bomVersion ||
      route.query.costBomVersionNo ||
      rows.value.find(
        (row) => String(row.version || row.costBomVersionNo || "").trim(),
      )?.version ||
      rows.value.find((row) => String(row.costBomVersionNo ?? "").trim())
        ?.costBomVersionNo ||
      "",
  ),
);
const projectName = computed(
  () =>
    String(
      route.query.projectName ||
        route.query.vehicleModelName ||
        (() => {
          try {
            const decoded = decodeURIComponent(String(route.query.returnPath || ""));
            const queryStart = decoded.indexOf("?");
            return queryStart >= 0
              ? new URLSearchParams(decoded.slice(queryStart + 1)).get("projectName") || ""
              : "";
          } catch {
            return "";
          }
        })(),
    ) || "--",
);
const factoryCode = computed(
  () =>
    String(
      route.query.factoryCode ||
        rows.value.find((row) => String(row.factoryCode ?? "").trim())
          ?.factoryCode ||
        "",
    ) || "--",
);
const versionLabel = computed(() => formatCostBomVersion(versionNo.value));
const vehicleModelId = computed(() => Number(route.query.vehicleModelId || 0));
const valveId = computed(() => Number(route.query.valveId || 0));
const activeMenuPath = computed(() => {
  if (
    route.path.startsWith("/cost/production/project-cost/") ||
    route.path.startsWith("/cost/production/new-production-cost/") ||
    route.path.startsWith("/new-production-cost/") ||
    route.path.startsWith("/costmanagementnew/zc/projectcostnew/") ||
    route.path.startsWith(
      "/costmanagementnew/zc/cost/production/project-cost/",
    )
  ) {
    return "/cost/production/project-cost";
  }
  if (typeof route.query.activeMenu === "string") {
    return route.query.activeMenu;
  }
  if (route.path.startsWith("/cost/production/project-cost/parts/histories")) {
    return "/cost/production/project-cost";
  }
  if (
    route.path.startsWith(
      "/cost/production/new-production-cost/parts/histories",
    ) ||
    route.path.startsWith("/new-production-cost/parts/histories") ||
    route.path.startsWith(
      "/costmanagementnew/zc/projectcostnew/parts/histories",
    )
  ) {
    return "/cost/production/new-production-cost";
  }
  if (route.meta.activeMenu) {
    return String(route.meta.activeMenu);
  }
  const title = String(route.meta.title ?? "");
  if (title.includes("成本履历")) {
    return "/cost/research/new-history";
  }
  if (title.includes("成本履历")) {
    return "/cost/research/history";
  }
  if (title.includes("项目成本")) {
    return "/cost/research/project-cost";
  }
  return "";
});
const pageTitle = computed(() => {
  if (activeMenuPath.value === "/cost/research/history") {
    return "成本履历零件历史";
  }
  if (activeMenuPath.value === "/cost/research/new-history") {
    return "成本履历零件历史";
  }
  if (
    activeMenuPath.value === "/cost/research/project-cost" ||
    activeMenuPath.value === "/cost/research/new-project-cost" ||
    activeMenuPath.value === "/cost/production/new-production-cost" ||
    activeMenuPath.value === "/cost/production/project-cost" ||
    activeMenuPath.value === "/new-production-cost"
  ) {
    return "项目成本零件历史";
  }
  return String(route.meta.title ?? "零件历史版本");
});
const routeBase = computed(
  () =>
    route.path.replace(/\/parts\/histories$/, "") ||
    String(route.meta.breadcrumbParentPath ?? "/cost/research/project-cost"),
);
const detailPath = computed(() => ({
  path: `${routeBase.value}/detail`,
  query: {
    projectId: String(projectId.value || ""),
    bomVersionId: String(versionId.value || ""),
    versionId: String(versionId.value || ""),
    version: versionNo.value || undefined,
    vehicleModelId: vehicleModelId.value
      ? String(vehicleModelId.value)
      : undefined,
    valveId: valveId.value ? String(valveId.value) : undefined,
    activeMenu: activeMenuPath.value || undefined,
    returnPath: activeMenuPath.value || routeBase.value,
    projectName: route.query.projectName
      ? String(route.query.projectName)
      : undefined,
    projectCode: route.query.projectCode
      ? String(route.query.projectCode)
      : undefined,
    vehicleModelName: route.query.vehicleModelName
      ? String(route.query.vehicleModelName)
      : undefined,
    valveName: route.query.valveName
      ? String(route.query.valveName)
      : undefined,
    lockStatus: route.query.lockStatus
      ? String(route.query.lockStatus)
      : undefined,
  },
}));
const loading = ref(false);
const rows = ref<PartHistoryRow[]>([]);
const total = ref(0);
const pageNo = ref(1);
const pageSize = ref(10);
const pagedRows = computed(() => rows.value);
const patternColumns = computed(() => {
  const columns: PatternColumn[] = [];
  const keySet = new Set<string>();
  rows.value.forEach((row) => {
    getRowPatterns(row).forEach((pattern, index) => {
      const rawPatternId = readRecordValue(pattern, ["patternId", "id"]);
      const rawPatternCode = readRecordValue(pattern, ["patternCode", "code"]);
      const rawPatternName = readRecordValue(pattern, [
        "patternName",
        "name",
        "vehiclePatternName",
      ]);
      const patternId =
        typeof rawPatternId === "string" || typeof rawPatternId === "number"
          ? rawPatternId
          : undefined;
      const patternCode =
        typeof rawPatternCode === "string" || typeof rawPatternCode === "number"
          ? String(rawPatternCode)
          : undefined;
      const patternName =
        typeof rawPatternName === "string" || typeof rawPatternName === "number"
          ? String(rawPatternName)
          : undefined;
      const label = formatText(
        patternName ?? patternCode ?? `版型${index + 1}`,
      );
      const key = String(patternId ?? patternCode ?? label);
      if (!keySet.has(key)) {
        keySet.add(key);
        columns.push({
          key,
          label,
          patternCode,
          patternId,
          index,
        });
      }
    });
  });
  return columns;
});

async function loadPartHistories() {
  loading.value = true;
  try {
    if (!versionId.value || !parentId.value) {
      rows.value = [];
      total.value = 0;
      return;
    }
    const page = await fetchCostBomPartHistories(
      versionId.value,
      parentId.value,
      {
        pageNum: pageNo.value,
        pageSize: pageSize.value,
        total: 0,
      },
    );
    rows.value = page.records.map((part) => ({
      ...part,
      costBomVersionId: versionId.value,
      costBomVersionNo: Number(part.version || versionNo.value || 0),
      costBomVersionStatus: "",
      costBomSubmittedAt: null,
    }));
    total.value = resolveServerTotal(page.total);
  } finally {
    loading.value = false;
  }
}

function handlePageSizeChange(nextPageSize: number) {
  pageSize.value = nextPageSize;
  pageNo.value = 1;
  void loadPartHistories();
}

function handlePageNoChange(nextPageNo: number) {
  pageNo.value = nextPageNo;
  void loadPartHistories();
}

function goBack() {
  if (
    typeof route.query.returnPath === "string" &&
    route.query.returnPath.startsWith("/")
  ) {
    replaceToReturn(router, route, detailPath.value.path);
    return;
  }
  router.replace(detailPath.value);
}

function anchorClass(value: string) {
  return `column-anchor-${value}`;
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readRecordValue(source: unknown, paths: string[]) {
  const record = asRecord(source);
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce<unknown>((current, key) => asRecord(current)[key], record);
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return null;
}

function getRowPatterns(row: PartHistoryRow) {
  const patterns = row.patterns ?? row.costBomPattern;
  return Array.isArray(patterns) ? patterns : [];
}

function getPatternValue(
  row: PartHistoryRow,
  column: PatternColumn,
  paths: string[],
  type: ValueType,
) {
  const pattern = getRowPatterns(row).find((item, index) => {
    const patternId = readRecordValue(item, ["patternId", "id"]);
    const patternCode = readRecordValue(item, ["patternCode", "code"]);
    return (
      index === column.index ||
      (column.patternId != null && patternId === column.patternId) ||
      (column.patternCode && String(patternCode) === column.patternCode)
    );
  });
  const value = readRecordValue(pattern, paths);
  if (type === "money") {
    return formatMoney(value as string | number | null);
  }
  if (type === "quantity") {
    return formatQuantity(value as string | number | null);
  }
  return formatText(value as string | number | null);
}

function formatFromPaths(
  row: PartHistoryRow,
  paths: string[],
  type: ValueType = "text",
) {
  const value = readRecordValue(row, paths);
  if (type === "money") {
    return formatMoney(value as string | number | null);
  }
  if (type === "quantity") {
    return formatQuantity(value as string | number | null);
  }
  return formatText(value as string | number | null);
}

function formatDataSource(value?: string | number | null) {
  const text = formatText(value);
  return text === "初始评估值" ? "评估值" : text;
}

function formatMoney(value?: string | number | null) {
  if (value == null || value === "") {
    return "--";
  }
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    return String(value);
  }
  return numberValue.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value?: string | number | null) {
  if (value == null || value === "") {
    return "--";
  }
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    return String(value);
  }
  return numberValue.toLocaleString("zh-CN", {
    maximumFractionDigits: 4,
  });
}

function formatText(value?: string | number | null) {
  return value == null || value === "" ? "--" : String(value);
}

onMounted(loadPartHistories);
</script>

<template>
  <PageContainer :title="pageTitle">
    <template #titleExtra>
      <span class="bq-page-inline-meta">
        项目代号：{{ projectName }} / 工厂代码：{{ factoryCode }} / 版本：{{ versionLabel }} /
        零件号：{{
          partNo || "--"
        }}
        / 共 {{ rows.length }} 条
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
    </template>

    <div class="cost-bom-part-history-page">
      <el-table
        v-loading="loading"
        class="cost-bom-part-history-page__table"
        :data="pagedRows"
        border
        height="calc(100vh - var(--bq-header-height) - var(--bq-tags-height) - 180px)"
      >
        <el-table-column
          type="index"
          label="序号"
          width="56"
          fixed="left"
          align="center"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        />
        <el-table-column
          prop="partNo"
          label="零件号"
          width="150"
          fixed="left"
          align="center"
          show-overflow-tooltip
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        >
          <template #default="{ row }">{{ formatText(row.partNo) }}</template>
        </el-table-column>
        <el-table-column
          prop="partName"
          label="零件名称"
          width="180"
          fixed="left"
          align="center"
          show-overflow-tooltip
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        >
          <template #default="{ row }">{{ formatText(row.partName) }}</template>
        </el-table-column>
        <!-- 版本信息由外层详情页摘要展示，零件历史表格不从接口行数据取版本。 -->

        <el-table-column
          label="基本信息"
          align="center"
          :label-class-name="anchorClass('basic')"
          :class-name="anchorClass('basic')"
        >
          <el-table-column
            prop="sorCode"
            label="SOR号"
            width="140"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              formatFromPaths(row, ["sorCode", "sorNumber"])
            }}</template>
          </el-table-column>
          <el-table-column
            prop="sorName"
            label="SOR名称"
            width="150"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="ecrNumber"
            label="ECR号"
            width="140"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="ecrName"
            label="ECR名称"
            width="150"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="iaNumber"
            label="IA号"
            width="140"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="iaName"
            label="IA名称"
            width="150"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="assemblyLevel"
            label="装配级别"
            width="120"
            align="center"
          />
          <el-table-column
            prop="partTechDesc"
            label="零部件关键技术状态描述"
            width="220"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column prop="unit" label="单位" width="90" align="center" />
          <el-table-column
            prop="moduleIdentifier"
            label="模块标识"
            width="140"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="firstVehicleModel"
            label="首用车型"
            width="140"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="quotaSrm"
            label="配额(SRM)"
            width="120"
            align="center"
          />
          <el-table-column
            prop="supplierName"
            label="供应商名称"
            width="170"
            align="center"
            show-overflow-tooltip
          />
        </el-table-column>

        <el-table-column
          label="分类"
          align="center"
          :label-class-name="anchorClass('classify')"
          :class-name="anchorClass('classify')"
        >
          <el-table-column
            prop="generalizationLevel"
            label="通用化级别"
            width="130"
            align="center"
          />
          <el-table-column
            prop="architectureComponent"
            label="是否架构件"
            width="120"
            align="center"
          />
        </el-table-column>

        <el-table-column
          label="BOM补充信息"
          align="center"
          :label-class-name="anchorClass('bom-extra')"
          :class-name="anchorClass('bom-extra')"
        >
          <el-table-column
            prop="suggestedSupplySource"
            label="建议货源"
            width="150"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="sourceDescription"
            label="货源描述"
            width="170"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="multiStructuredSupplySources"
            label="结构货源"
            width="150"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="multiSourcesDescription"
            label="结构货源描述"
            width="170"
            align="center"
            show-overflow-tooltip
          />
        </el-table-column>

        <el-table-column
          label="分工"
          align="center"
          :label-class-name="anchorClass('division')"
          :class-name="anchorClass('division')"
        >
          <el-table-column
            prop="developmentDepartment"
            label="研发专业部门"
            width="150"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="expertEngineer"
            label="专业工程师"
            width="130"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="partAttribute"
            label="零件属性"
            width="130"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="procurementBusinessLine"
            label="成本专业科室"
            width="150"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="costCategoryLevel2Name"
            label="成本二级分类"
            width="150"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="costCategoryLevel3Name"
            label="成本三级分类"
            width="150"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="costEngineerName"
            label="成本工程师"
            width="130"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="procurementEngineerName"
            label="采购工程师"
            width="130"
            align="center"
            show-overflow-tooltip
          />
        </el-table-column>

        <el-table-column
          label="单车用量"
          align="center"
          :label-class-name="anchorClass('quantity')"
          :class-name="anchorClass('quantity')"
        >
          <el-table-column
            v-if="!patternColumns.length"
            prop="quantity"
            label="单车用量"
            width="120"
            align="center"
          >
            <template #default="{ row }">{{
              formatQuantity(row.quantity)
            }}</template>
          </el-table-column>
          <template v-else>
            <el-table-column
              v-for="pattern in patternColumns"
              :key="`usage-${pattern.key}`"
              :label="pattern.label"
              width="140"
              align="center"
            >
              <template #default="{ row }">
                {{
                  getPatternValue(
                    row,
                    pattern,
                    ["usagePerVehicle", "quantity", "usage"],
                    "quantity",
                  )
                }}
              </template>
            </el-table-column>
          </template>
        </el-table-column>

        <el-table-column
          label="目标值"
          align="center"
          :label-class-name="anchorClass('target')"
          :class-name="anchorClass('target')"
        >
          <el-table-column
            prop="targetValue"
            label="目标值"
            width="130"
            align="center"
          >
            <template #default="{ row }">{{
              formatFromPaths(row, ["targetValue", "targetCostAmount"], "money")
            }}</template>
          </el-table-column>
          <el-table-column
            prop="targetRemark"
            label="备注"
            width="170"
            align="center"
            show-overflow-tooltip
          />
        </el-table-column>

        <el-table-column
          label="评估值"
          align="center"
          :label-class-name="anchorClass('initial-eval')"
          :class-name="anchorClass('initial-eval')"
        >
          <el-table-column
            prop="initialEvaluationValue"
            label="评估值"
            width="140"
            align="center"
          >
            <template #default="{ row }">{{
              formatMoney(row.initialEvaluationValue)
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="上会价"
          align="center"
          :label-class-name="anchorClass('meeting')"
          :class-name="anchorClass('meeting')"
        >
          <el-table-column
            label="当前上会最新单号(采购)"
            width="190"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              formatFromPaths(row, ["costBomExtend.meetingOrderNo"])
            }}</template>
          </el-table-column>
          <el-table-column label="议题类型(采购)" width="140" align="center">
            <template #default="{ row }">{{
              formatFromPaths(row, ["costBomExtend.topicType"])
            }}</template>
          </el-table-column>
          <el-table-column label="采购专业(采购)" width="140" align="center">
            <template #default="{ row }">{{
              formatFromPaths(row, ["costBomExtend.purchaseMajor"])
            }}</template>
          </el-table-column>
          <el-table-column
            label="供应商编码（采购）"
            width="150"
            align="center"
          >
            <template #default="{ row }">{{
              formatFromPaths(row, [
                "costBomExtend.supplierCode",
                "supplierCode",
              ])
            }}</template>
          </el-table-column>
          <el-table-column
            label="供应商名称（采购）"
            width="160"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              formatFromPaths(row, [
                "costBomExtend.supplierName",
                "supplierName",
              ])
            }}</template>
          </el-table-column>
          <el-table-column
            label="定点会次(采购)"
            width="150"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{
              formatFromPaths(row, ["costBomExtend.fixedMeetingTimes"])
            }}</template>
          </el-table-column>
          <el-table-column
            label="定点成本(采购)"
            align="center"
            :label-class-name="anchorClass('meeting')"
          >
            <el-table-column label="出厂价" width="120" align="center">
              <template #default="{ row }">{{
                formatFromPaths(
                  row,
                  ["costBomExtend.exFactoryPricePurchase"],
                  "money",
                )
              }}</template>
            </el-table-column>
            <el-table-column label="包装费" width="120" align="center">
              <template #default="{ row }">{{
                formatFromPaths(
                  row,
                  ["costBomExtend.packingFeePurchase"],
                  "money",
                )
              }}</template>
            </el-table-column>
            <el-table-column label="物流费" width="120" align="center">
              <template #default="{ row }">{{
                formatFromPaths(
                  row,
                  ["costBomExtend.logisticsFeePurchase"],
                  "money",
                )
              }}</template>
            </el-table-column>
            <el-table-column label="不含摊销价" width="130" align="center">
              <template #default="{ row }">{{
                formatFromPaths(
                  row,
                  ["costBomExtend.noAmortizationPrice"],
                  "money",
                )
              }}</template>
            </el-table-column>
            <el-table-column label="工装模具摊销" width="150" align="center">
              <template #default="{ row }">{{
                formatFromPaths(
                  row,
                  ["costBomExtend.toolingAmortizationFee"],
                  "money",
                )
              }}</template>
            </el-table-column>
            <el-table-column label="技术开发摊销费" width="150" align="center">
              <template #default="{ row }">{{
                formatFromPaths(
                  row,
                  ["costBomExtend.techDevAmortizationFee"],
                  "money",
                )
              }}</template>
            </el-table-column>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="SRM价"
          align="center"
          :label-class-name="anchorClass('srm')"
          :class-name="anchorClass('srm')"
        >
          <el-table-column
            label="材料成本（含摊销）"
            width="170"
            align="center"
          >
            <template #default="{ row }">{{
              formatFromPaths(
                row,
                ["costBomExtend.materialCostWithAmortizationSrm"],
                "money",
              )
            }}</template>
          </el-table-column>
          <el-table-column
            label="材料成本（不含摊销）"
            width="180"
            align="center"
          >
            <template #default="{ row }">{{
              formatFromPaths(
                row,
                ["costBomExtend.materialCostWithoutAmortizationSrm"],
                "money",
              )
            }}</template>
          </el-table-column>
          <el-table-column label="工装模具-摊销数量" width="160" align="center">
            <template #default="{ row }">{{
              formatFromPaths(
                row,
                ["costBomExtend.toolingAmortizationQuantity"],
                "quantity",
              )
            }}</template>
          </el-table-column>
          <el-table-column label="技术开发-摊销数量" width="160" align="center">
            <template #default="{ row }">{{
              formatFromPaths(
                row,
                ["costBomExtend.techDevAmortizationQuantity"],
                "quantity",
              )
            }}</template>
          </el-table-column>
          <el-table-column label="包装费" width="120" align="center">
            <template #default="{ row }">{{
              formatFromPaths(row, ["costBomExtend.wrapCost"], "money")
            }}</template>
          </el-table-column>
          <el-table-column label="物流费" width="120" align="center">
            <template #default="{ row }">{{
              formatFromPaths(row, ["costBomExtend.freightCost"], "money")
            }}</template>
          </el-table-column>
          <el-table-column label="数据来源" width="140" align="center">
            <template #default="{ row }">{{
              formatFromPaths(row, ["costBomExtend.dataSourceSrm"])
            }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="当前成本"
          align="center"
          :label-class-name="anchorClass('current-cost')"
          :class-name="anchorClass('current-cost')"
        >
          <el-table-column
            prop="currentCostAmount"
            label="当前成本"
            width="120"
            align="center"
          >
            <template #default="{ row }">{{
              formatMoney(row.currentCostAmount)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="materialCostWithAmortization"
            label="材料成本（含摊销）"
            width="160"
            align="center"
          >
            <template #default="{ row }">{{
              formatMoney(row.materialCostWithAmortization)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="materialCostWithoutAmortization"
            label="材料成本（不含摊销）"
            width="180"
            align="center"
          >
            <template #default="{ row }">{{
              formatMoney(row.materialCostWithoutAmortization)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="currentAmortize"
            label="摊销数量"
            width="120"
            align="center"
          >
            <template #default="{ row }">{{
              formatQuantity(row.currentAmortize)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="amortizationAmount"
            label="摊销金额"
            width="120"
            align="center"
          >
            <template #default="{ row }">{{
              formatMoney(row.amortizationAmount)
            }}</template>
          </el-table-column>
          <el-table-column
            prop="currentDataSources"
            label="数据来源"
            width="140"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ formatDataSource(row.currentDataSources) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="summaryRemark"
            label="备注"
            width="170"
            align="center"
            show-overflow-tooltip
          />
        </el-table-column>

        <el-table-column
          v-if="patternColumns.length"
          label="各版型目标成本统计（不含摊销）"
          align="center"
          :label-class-name="anchorClass('pattern-target')"
          :class-name="anchorClass('pattern-target')"
        >
          <el-table-column
            v-for="pattern in patternColumns"
            :key="`target-${pattern.key}`"
            :label="pattern.label"
            width="140"
            align="center"
          >
            <template #default="{ row }">
              {{
                getPatternValue(
                  row,
                  pattern,
                  ["targetCost", "targetCostAmount"],
                  "money",
                )
              }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="patternColumns.length"
          label="各版型当前成本统计（不含摊销）"
          align="center"
          :label-class-name="anchorClass('pattern-current-no')"
          :class-name="anchorClass('pattern-current-no')"
        >
          <el-table-column
            v-for="pattern in patternColumns"
            :key="`current-no-${pattern.key}`"
            :label="pattern.label"
            width="140"
            align="center"
          >
            <template #default="{ row }">
              {{
                getPatternValue(
                  row,
                  pattern,
                  ["currentCost", "currentCostAmount"],
                  "money",
                )
              }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="patternColumns.length"
          label="各版型当前成本统计（含摊销）"
          align="center"
          :label-class-name="anchorClass('pattern-current-yes')"
          :class-name="anchorClass('pattern-current-yes')"
        >
          <el-table-column
            v-for="pattern in patternColumns"
            :key="`current-yes-${pattern.key}`"
            :label="pattern.label"
            width="140"
            align="center"
          >
            <template #default="{ row }">
              {{
                getPatternValue(
                  row,
                  pattern,
                  ["currentCostAmortize", "currentCostWithAmortization"],
                  "money",
                )
              }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="patternColumns.length"
          label="各版型包装费统计"
          align="center"
          :label-class-name="anchorClass('pattern-package')"
          :class-name="anchorClass('pattern-package')"
        >
          <el-table-column
            v-for="pattern in patternColumns"
            :key="`package-${pattern.key}`"
            :label="pattern.label"
            width="140"
            align="center"
          >
            <template #default="{ row }">
              {{
                getPatternValue(
                  row,
                  pattern,
                  ["packagingFee", "packagingCost", "wrapCost"],
                  "money",
                )
              }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          v-if="patternColumns.length"
          label="各版型物流费统计"
          align="center"
          :label-class-name="anchorClass('pattern-freight')"
          :class-name="anchorClass('pattern-freight')"
        >
          <el-table-column
            v-for="pattern in patternColumns"
            :key="`freight-${pattern.key}`"
            :label="pattern.label"
            width="140"
            align="center"
          >
            <template #default="{ row }">
              {{
                getPatternValue(
                  row,
                  pattern,
                  ["freightFee", "freightCost", "logisticsCost"],
                  "money",
                )
              }}
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column
          label="其他"
          align="center"
          :label-class-name="anchorClass('other')"
          :class-name="anchorClass('other')"
        >
          <el-table-column
            prop="partVersion"
            label="当前版本"
            width="120"
            align="center"
          >
            <template #default="{ row }">{{
              row.partVersion ? `V${row.partVersion}` : "--"
            }}</template>
          </el-table-column>
          <el-table-column label="创建人" width="130" align="center">
            <template #default="{ row }">{{
              formatFromPaths(row, ["createName", "createdBy"])
            }}</template>
          </el-table-column>
          <el-table-column label="创建时间" width="170" align="center">
            <template #default="{ row }">{{
              formatFromPaths(row, ["createTime", "createdAt"])
            }}</template>
          </el-table-column>
          <el-table-column label="更新人" width="130" align="center">
            <template #default="{ row }">{{
              formatFromPaths(row, ["updateBy", "updatedBy"])
            }}</template>
          </el-table-column>
          <el-table-column label="更新时间" width="170" align="center">
            <template #default="{ row }">{{
              formatFromPaths(row, ["updateTime", "updatedAt"])
            }}</template>
          </el-table-column>
        </el-table-column>
      </el-table>

      <div class="cost-bom-part-history-page__pagination">
        <QueryTable
          pagination-only
          :fixed-pagination="false"
          :pagination="{ pageNo, pageSize, total }"
          :pagination-props="{
            pageSizes: [10, 20, 50, 100],
            layout: 'total, sizes, prev, pager, next, jumper',
          }"
          @size-change="handlePageSizeChange"
          @page-change="handlePageNoChange"
        />
      </div>
    </div>
  </PageContainer>
</template>

<style scoped>
.cost-bom-part-history-page {
  min-height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) - 96px
  );
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.cost-bom-part-history-page__table {
  flex: 1;
}

.cost-bom-part-history-page__pagination {
  position: sticky;
  bottom: 0;
  z-index: 3;
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 0;
  background: var(--bq-color-surface);
  border-top: 1px solid var(--bq-color-border-subtle);
}

.cost-bom-part-history-page__table :deep(.el-table__cell) {
  padding: 4px 0;
}

.cost-bom-part-history-page__table :deep(.cell) {
  line-height: 20px;
}

.cost-bom-part-history-page :deep(.el-table th.el-table__cell) {
  background: var(--bq-color-table-header);
  border-right: 1px solid var(--bq-color-border);
  border-bottom: 1px solid var(--bq-color-border);
  color: var(--bq-color-text);
  font-weight: 600;
}

.cost-bom-part-history-page :deep(.el-table th.el-table__cell:last-child) {
  border-right: 0;
}

.cost-bom-part-history-page :deep(.el-table thead.is-group th.el-table__cell) {
  border-right: 1px solid var(--bq-color-border);
  border-bottom: 1px solid var(--bq-color-border);
}

.cost-bom-part-history-page :deep(.el-table--border .el-table__cell) {
  border-right-color: var(--bq-color-border);
}

.cost-bom-part-history-page :deep(.el-table .cell) {
  white-space: nowrap;
}

.cost-bom-part-history-page__table :deep(.el-table__fixed),
.cost-bom-part-history-page__table :deep(.el-table__fixed-right) {
  height: auto !important;
}
</style>
