<script setup lang="ts">
import { resolveServerTotal } from "@/utils/pagination";
import { sortByCreateTimeThenVersionDesc } from "@/utils/history-version-sort";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back } from "@element-plus/icons-vue";
import { getProjectListGuofa } from "@/api/budget";
import { ApiBusinessError } from "@/api/http";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";

type WbsHistoryRow = Record<string, unknown> & {
  id?: number | string;
  wbsNumber?: string;
  wbsName?: string;
  gradeName?: string;
  grade?: { level?: number };
  level?: number | string;
  submitter?: string;
  sorName?: string;
  paymentRatio?: string;
  paymentEstimate?: number | string;
  reductionDiff?: number | string;
  reductionRatio?: number | string;
  createBy?: string;
  version?: number | string;
  createTime?: string;
  updateBy?: string;
  updateTime?: string;
  valveBudgetInfoVoList?: Array<{
    type?: number;
    valveType?: number;
    name?: string;
    budget?: number;
    remark?: string;
  }>;
};

interface PatternItem {
  name: string;
}

const route = useRoute();
const router = useRouter();
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const latestExportTaskId = ref<string>();

const projectId = computed(() => String(route.query.projectId ?? ""));
const valveId = computed(() => String(route.query.valveId ?? ""));
const projectName = computed(() => String(route.query.projectName ?? "--"));
const valveName = computed(() =>
  decodeQueryText(String(route.query.valveName ?? "--")),
);
const wbsNumber = computed(() => String(route.query.wbsNumber ?? ""));
const gradeId = computed(() => String(route.query.gradeId ?? ""));
const majorVersion = computed(() => String(route.query.majorVersion ?? ""));
const historyRowId = computed(() => String(route.query.historyRowId ?? ""));
const budgetLock = computed(() => String(route.query.budgetLock ?? ""));
const isLock = computed(() => String(route.query.isLock ?? ""));
const passStatus = computed(() => String(route.query.passStatus ?? ""));

function decodeQueryText(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasRequestValue(value: unknown) {
  return value !== "" && value !== null && value !== undefined;
}

function compactParams<T extends Record<string, unknown>>(params: T) {
  return Object.entries(params).reduce<Record<string, unknown>>(
    (result, [key, value]) => {
      if (hasRequestValue(value)) {
        result[key] = value;
      }
      return result;
    },
    {},
  ) as Partial<T>;
}

const patterns = ref<PatternItem[]>([]);
const defaultColumnOptions = buildColumnOptions([], "");
const columnOptions =
  ref<{ key: string; label: string; visible: boolean }[]>(defaultColumnOptions);
const visibleColumns = ref<string[]>(
  defaultColumnOptions.map((item) => item.key),
);
const knownColumnKeys = ref<string[]>([]);

function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (isNaN(num)) return "";
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function yusuanZong(list: WbsHistoryRow["valveBudgetInfoVoList"]): string {
  if (!list || !list.length) return "";
  const cur = list.find((item) => item.type === 1);
  return cur ? formatPrice(cur.budget) : "";
}

function valveType(
  list: WbsHistoryRow["valveBudgetInfoVoList"],
  num: number,
  remark?: boolean,
): string {
  if (!list || !list.length) return "";
  const cur = list.find((item) => item.valveType === num);
  if (!cur) return "";
  if (remark) return cur.remark || "";
  return formatPrice(cur.budget);
}

function resetRatio(ratioString?: string): string {
  if (!ratioString) return "";
  const arr = ratioString.split(",");
  if (arr.length > 1) {
    return arr.map((i) => i + "%").join("；");
  }
  return ratioString + "%";
}

function resolveCliqueTitle(
  list: WbsHistoryRow["valveBudgetInfoVoList"],
): string {
  if (!list || !list.length) return "";
  return (
    list.find((item) => item.valveType === 1 || item.valveType === 2)?.name ||
    list[list.length - 1]?.name ||
    ""
  );
}

function getPatternBudgetValue(
  list: WbsHistoryRow["valveBudgetInfoVoList"],
  patternName: string,
  remark = false,
): string {
  const patternBudget = list?.find(
    (candidate) => candidate.type === 0 && candidate.name === patternName,
  );
  if (!patternBudget) return "";
  return remark
    ? patternBudget.remark || ""
    : formatPrice(patternBudget.budget);
}

function displayLevel(row: WbsHistoryRow): string {
  const level =
    row.level ??
    (row.grade?.level !== null && row.grade?.level !== undefined
      ? row.grade.level + 1
      : 1);
  return level === "" ? "1" : String(level);
}

function buildColumnOptions(dynamic: PatternItem[], cliqueTitle: string) {
  const cols: { key: string; label: string; visible: boolean }[] = [
    { key: "level", label: "层级", visible: true },
    { key: "wbsNumber", label: "WBS", visible: true },
    { key: "wbsName", label: "WBS名称", visible: true },
    { key: "gradeName", label: "当前等级", visible: true },
  ];
  for (const p of dynamic) {
    cols.push({ key: `${p.name}_budget`, label: p.name, visible: true });
    cols.push({
      key: `${p.name}_remark`,
      label: `${p.name}费用说明`,
      visible: true,
    });
  }
  cols.push({ key: "totalBudget", label: "预算总金额", visible: true });
  cols.push({ key: "valveOccupied", label: "阀点已占用金额", visible: true });
  cols.push({
    key: "valveOccupiedRemark",
    label: "阀点已占用费用说明",
    visible: true,
  });
  cols.push({
    key: "valveRelease",
    label: `${cliqueTitle}阀点释放预算`,
    visible: true,
  });
  cols.push({
    key: "valveReleaseRemark",
    label: "阀点释放费用说明",
    visible: true,
  });
  cols.push({ key: "submitter", label: "预算提报人", visible: true });
  cols.push({ key: "sorName", label: "集团统筹SOR名称", visible: true });
  cols.push({
    key: "valveReleaseAssess",
    label: `${cliqueTitle}阀点释放评估金额`,
    visible: true,
  });
  cols.push({
    key: "valveReleaseAssessRemark",
    label: "评估说明",
    visible: true,
  });
  cols.push({ key: "paymentRatio", label: "支付比例", visible: true });
  cols.push({ key: "paymentEstimate", label: "支付评估金额", visible: true });
  cols.push({ key: "reductionDiff", label: "核减差值", visible: true });
  cols.push({ key: "reductionRatio", label: "核减比例", visible: true });
  cols.push({ key: "createBy", label: "创建人", visible: true });
  cols.push({ key: "version", label: "当前版本", visible: true });
  cols.push({ key: "createTime", label: "创建时间", visible: true });
  cols.push({ key: "updateBy", label: "更新人", visible: true });
  cols.push({ key: "updateTime", label: "更新时间", visible: true });
  return cols;
}

function _getPatterns(rows: WbsHistoryRow[]) {
  const dynamic: PatternItem[] = [];
  const patternNames = new Set<string>();
  const allBudgetItems = rows.flatMap((row) => row.valveBudgetInfoVoList ?? []);
  for (const item of allBudgetItems) {
    if (item.type === 0 && item.name && !patternNames.has(item.name)) {
      patternNames.add(item.name);
      dynamic.push({ name: item.name });
    }
  }
  patterns.value = dynamic;

  const cliqueTitle = resolveCliqueTitle(allBudgetItems) || valveName.value;
  const cols = buildColumnOptions(dynamic, cliqueTitle);
  columnOptions.value = cols;

  const allKeys = cols.map((c) => c.key);
  if (!knownColumnKeys.value.length) {
    visibleColumns.value = allKeys;
  } else {
    const nextOptionKeySet = new Set(allKeys);
    const knownKeySet = new Set(knownColumnKeys.value);
    const keptVisibleKeys = visibleColumns.value.filter((key) =>
      nextOptionKeySet.has(key),
    );
    const addedOptionKeys = allKeys.filter((key) => !knownKeySet.has(key));
    visibleColumns.value = [...keptVisibleKeys, ...addedOptionKeys];
  }
  knownColumnKeys.value = allKeys;
}

async function queryList(pageSize: number, pageNo: number) {
  error.value = null;
  if (!projectId.value || !valveId.value) {
    return { total: 0, list: [], pageNo: 1, pageSize };
  }
  try {
    const params = compactParams({
      projectId: projectId.value,
      valveId: valveId.value,
      isLatestVersion: 0,
      pageNum: pageNo,
      pageSize,
      gradeId: gradeId.value,
      wbsNumber: wbsNumber.value
        ? decodeURIComponent(wbsNumber.value)
        : undefined,
      majorVersion: majorVersion.value,
      includeDetails: true,
      historyRowId: historyRowId.value || undefined,
    });
    const res = await getProjectListGuofa(params);
    const rows = sortByCreateTimeThenVersionDesc(
      (res.rows ?? []) as unknown as WbsHistoryRow[],
      (row) => row.version,
    );
    _getPatterns(rows);
    return {
      total: resolveServerTotal(res.total),
      list: rows,
      pageNo,
      pageSize,
    };
  } catch (unknownError) {
    _getPatterns([]);
    const normalizedError = normalizeError(unknownError);
    error.value = normalizedError;
    throw new Error(normalizedError.message, { cause: unknownError });
  }
}

function goBack() {
  if (typeof route.query.returnPath === "string" && route.query.returnPath) {
    void router.replace(route.query.returnPath);
    return;
  }

  void router.replace({
    name: "过阀评审查看",
    query: compactParams({
      projectId: projectId.value,
      valveId: valveId.value,
      projectName: projectName.value,
      valveName: encodeURIComponent(valveName.value),
      majorVersion: majorVersion.value,
      isLock: isLock.value,
      passStatus: passStatus.value,
      budgetLock: budgetLock.value,
    }),
  });
}

function normalizeError(
  unknownError: unknown,
  fallbackMessage = "历史版本加载失败，请检查后端服务。",
) {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }
  return {
    code: "FRONTEND-BUDGET-GATE-WBS-VERSION-001",
    message: fallbackMessage,
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer class="budget-gate-wbs-history-page" title="过阀评审历史版本">
    <template #titleExtra>
      <span class="bq-page-inline-meta">
        项目代号：{{ projectName }}（{{ valveName }}）
      </span>
    </template>
    <template #actions>
      <el-button class="bq-page-return-button" :icon="Back" @click="goBack">
        返回列表
      </el-button>
    </template>

    <TaskStatusPanel v-if="false" :task-id="latestExportTaskId" />
    <QueryTable
      :func="queryList"
      row-key="id"
      :table-props="{ height: '100%' }"
      :error="error"
      empty-title="暂无历史版本"
      empty-description="当前项目阀点没有可展示的历史版本。"
      :show-search="false"
    >
      <el-table-column type="index" label="序号" width="70" align="center" />
      <el-table-column
        v-if="visibleColumns.includes('level')"
        prop="level"
        label="层级"
        align="center"
        width="60"
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          {{ displayLevel(row) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('wbsNumber')"
        prop="wbsNumber"
        label="WBS"
        align="center"
        width="150"
        show-overflow-tooltip
      />
      <el-table-column
        v-if="visibleColumns.includes('wbsName')"
        prop="wbsName"
        label="WBS名称"
        align="center"
        width="150"
        show-overflow-tooltip
      />
      <el-table-column
        v-if="visibleColumns.includes('gradeName')"
        prop="gradeName"
        label="当前等级"
        align="center"
        width="150"
      />

      <template v-for="(item, index) in patterns" :key="item.name + index">
        <el-table-column
          v-if="visibleColumns.includes(item.name + '_budget')"
          :key="`${item.name}_budget`"
          :label="item.name"
          align="center"
          width="130"
        >
          <template #default="{ row }: { row: WbsHistoryRow }">
            {{ getPatternBudgetValue(row.valveBudgetInfoVoList, item.name) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.includes(item.name + '_remark')"
          :key="`${item.name}_remark`"
          :label="`费用说明`"
          align="center"
          width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }: { row: WbsHistoryRow }">
            {{
              getPatternBudgetValue(row.valveBudgetInfoVoList, item.name, true)
            }}
          </template>
        </el-table-column>
      </template>

      <el-table-column
        v-if="visibleColumns.includes('totalBudget')"
        label="预算总金额"
        align="center"
        width="130"
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          {{ yusuanZong(row.valveBudgetInfoVoList) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('valveOccupied')"
        label="阀点已占用金额"
        align="center"
        width="130"
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          {{ valveType(row.valveBudgetInfoVoList, 0) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('valveOccupiedRemark')"
        prop="totalAmount"
        label="阀点已占用费用说明"
        align="center"
        width="150"
        show-overflow-tooltip
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          {{ valveType(row.valveBudgetInfoVoList, 0, true) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('valveRelease')"
        label="阀点释放预算"
        align="center"
        width="130"
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          {{ valveType(row.valveBudgetInfoVoList, 1) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('valveReleaseRemark')"
        label="阀点释放费用说明"
        align="center"
        width="150"
        show-overflow-tooltip
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          {{ valveType(row.valveBudgetInfoVoList, 1, true) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('submitter')"
        prop="submitter"
        label="预算提报人"
        align="center"
        width="90"
      />
      <el-table-column
        v-if="visibleColumns.includes('sorName')"
        prop="sorName"
        label="集团统筹SOR名称"
        align="center"
        width="130"
      />
      <el-table-column
        v-if="visibleColumns.includes('valveReleaseAssess')"
        label="阀点释放评估金额"
        align="center"
        width="130"
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          {{ valveType(row.valveBudgetInfoVoList, 2) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('valveReleaseAssessRemark')"
        label="评估说明"
        align="center"
        width="150"
        show-overflow-tooltip
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          {{ valveType(row.valveBudgetInfoVoList, 2, true) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('paymentRatio')"
        label="支付比例"
        align="center"
        width="90"
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          <el-tooltip :content="resetRatio(row.paymentRatio)" placement="top">
            <span class="ellipsis-text">{{
              resetRatio(row.paymentRatio)
            }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('paymentEstimate')"
        prop="paymentEstimate"
        label="支付评估金额"
        align="center"
        width="130"
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          {{ formatPrice(row.paymentEstimate) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('reductionDiff')"
        label="核减差值"
        align="center"
        width="130"
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          {{ formatPrice(row.reductionDiff) }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('reductionRatio')"
        label="核减比例"
        align="center"
      >
        <template #default="{ row }: { row: WbsHistoryRow }">
          <span v-if="row.reductionRatio">{{ row.reductionRatio }}%</span>
        </template>
      </el-table-column>
      <el-table-column
        v-if="visibleColumns.includes('createBy')"
        prop="createBy"
        label="创建人"
        align="center"
      />
      <el-table-column
        v-if="visibleColumns.includes('version')"
        prop="version"
        label="当前版本"
        align="center"
        width="80"
      />
      <el-table-column
        v-if="visibleColumns.includes('createTime')"
        prop="createTime"
        label="创建时间"
        align="center"
        width="160"
      />
      <el-table-column
        v-if="visibleColumns.includes('updateBy')"
        prop="updateBy"
        label="更新人"
        align="center"
      />
      <el-table-column
        v-if="visibleColumns.includes('updateTime')"
        prop="updateTime"
        label="更新时间"
        align="center"
        width="160"
      />
<!--      <el-table-column label="操作" fixed="right" width="120" align="center">-->
<!--        <template #default="{ row }: { row: WbsHistoryRow }">-->
<!--          <div class="bq-table-actions" @click.stop>-->
<!--            <PermissionButton-->
<!--              link-->
<!--              type="primary"-->
<!--              :icon="View"-->
<!--              @click="viewDetail(row)"-->
<!--            >-->
<!--              查看-->
<!--            </PermissionButton>-->
<!--            <PermissionButton-->
<!--              link-->
<!--              type="warning"-->
<!--              :icon="Upload"-->
<!--              @click="exportRow(row)"-->
<!--            >-->
<!--              导出-->
<!--            </PermissionButton>-->
<!--          </div>-->
<!--        </template>-->
<!--      </el-table-column>-->
    </QueryTable>
  </PageContainer>
</template>

<style scoped>
.budget-gate-wbs-history-page {
  display: flex;
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--app-route-tags-height) - 40px
  );
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
}

.budget-gate-wbs-history-page.is-page-fullscreen {
  height: 100vh;
  min-height: 100vh;
  overflow: auto;
}

.budget-gate-wbs-history-page :deep(.page-container__body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  grid-template-rows: minmax(0, 1fr);
}

.budget-gate-wbs-history-page :deep(.query-table) {
  min-height: 0;
  height: 100%;
  grid-template-rows: minmax(0, 1fr) auto;
}

.budget-gate-wbs-history-page :deep(.query-table__table),
.budget-gate-wbs-history-page :deep(.base-data-table) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.budget-gate-wbs-history-page :deep(.el-table__body-wrapper .el-scrollbar) {
  padding-bottom: 14px;
}

.budget-gate-wbs-history-page
  :deep(.el-table__body-wrapper .el-scrollbar__bar.is-horizontal) {
  bottom: 4px;
}

.ellipsis-text {
  display: inline-block;
  max-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
