<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, reactive, ref } from "vue";
import {
  Minus,
  Plus,
  Refresh,
  RefreshRight,
  Search,
} from "@element-plus/icons-vue";
import {
  fetchGovernanceAdsTables,
  queryGovernanceAdsTable,
} from "@/api/data-governance";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { formatGovernanceAdsCell } from "./governance-page-utils";
import type {
  GovernanceAdsQueryCondition,
  GovernanceAdsQueryOperator,
  GovernanceAdsTableColumn,
  GovernanceTableMetadata,
} from "@/types/data-governance";

type QueryTableExpose = { reload: () => Promise<void>; search: () => void };
type AdsQueryConditionForm = GovernanceAdsQueryCondition;

const adsTableRef = ref<QueryTableExpose | null>(null);
const adsTableOptions = ref<GovernanceTableMetadata[]>([]);
const adsTableColumns = ref<GovernanceAdsTableColumn[]>([]);
const adsTableFieldOptions = ref<GovernanceAdsTableColumn[]>([]);
const selectedAdsTable = ref<GovernanceTableMetadata | null>(null);
const adsTableTotal = ref(0);
const adsTableLoading = ref(false);
const adsTableQuery = reactive({
  tableCode: "",
  orderBy: "",
  orderDirection: "ASC" as "ASC" | "DESC",
});
const selectedOutputFields = ref<string[]>([]);
const queryConditions = ref<AdsQueryConditionForm[]>([createCondition()]);

const textOperatorOptions: Array<{
  label: string;
  value: GovernanceAdsQueryOperator;
}> = [
  { label: "包含", value: "CONTAINS" },
  { label: "开头是", value: "STARTS_WITH" },
  { label: "结尾是", value: "ENDS_WITH" },
  { label: "等于", value: "EQ" },
  { label: "不等于", value: "NE" },
  { label: "为空", value: "IS_NULL" },
  { label: "不为空", value: "IS_NOT_NULL" },
];
const comparableOperatorOptions: Array<{
  label: string;
  value: GovernanceAdsQueryOperator;
}> = [
  { label: "等于", value: "EQ" },
  { label: "不等于", value: "NE" },
  { label: "大于", value: "GT" },
  { label: "大于等于", value: "GTE" },
  { label: "小于", value: "LT" },
  { label: "小于等于", value: "LTE" },
  { label: "区间", value: "BETWEEN" },
  { label: "为空", value: "IS_NULL" },
  { label: "不为空", value: "IS_NOT_NULL" },
];

function createCondition(): AdsQueryConditionForm {
  return { logic: "AND", field: "", operator: "CONTAINS", value: "" };
}

async function loadAdsTables() {
  adsTableLoading.value = true;
  try {
    adsTableOptions.value = await fetchGovernanceAdsTables();
    if (!adsTableQuery.tableCode && adsTableOptions.value[0]) {
      adsTableQuery.tableCode = adsTableOptions.value[0].tableCode;
      await nextTick();
      await adsTableRef.value?.reload();
    }
  } catch (error) {
    BaseToast.error(
      error instanceof Error ? error.message : "ADS表目录加载失败",
    );
  } finally {
    adsTableLoading.value = false;
  }
}

async function queryAdsTableContent(pageSize: number, pageNo: number) {
  if (!adsTableQuery.tableCode) {
    selectedAdsTable.value = null;
    adsTableColumns.value = [];
    adsTableFieldOptions.value = [];
    adsTableTotal.value = 0;
    return { list: [], total: 0, pageNo, pageSize };
  }
  const content = await queryGovernanceAdsTable({
    tableCode: adsTableQuery.tableCode,
    fields: selectedOutputFields.value.length
      ? selectedOutputFields.value
      : undefined,
    conditions: activeConditions(),
    orderBy: adsTableQuery.orderBy || undefined,
    orderDirection: adsTableQuery.orderBy
      ? adsTableQuery.orderDirection
      : undefined,
    pageNo,
    pageSize,
  });
  selectedAdsTable.value = content.table;
  if (adsTableFieldOptions.value.length === 0) {
    adsTableFieldOptions.value = content.columns;
  }
  adsTableColumns.value = content.columns;
  adsTableTotal.value = content.total;
  return {
    list: content.rows,
    total: content.total,
    pageNo: content.pageNo,
    pageSize: content.pageSize,
  };
}

function activeConditions(): AdsQueryConditionForm[] {
  return queryConditions.value
    .filter((condition) =>
      Boolean(
        condition.field ||
        condition.value?.trim() ||
        condition.secondValue?.trim(),
      ),
    )
    .map((condition, index) => ({
      logic: index === 0 ? "AND" : condition.logic,
      field: condition.field,
      operator: condition.operator,
      value: condition.value?.trim() || undefined,
      secondValue: condition.secondValue?.trim() || undefined,
    }));
}

function isNullOperator(operator: GovernanceAdsQueryOperator) {
  return operator === "IS_NULL" || operator === "IS_NOT_NULL";
}

function needsSecondValue(operator: GovernanceAdsQueryOperator) {
  return operator === "BETWEEN";
}

function selectedColumn(fieldName: string) {
  return adsTableFieldOptions.value.find((column) => column.name === fieldName);
}

function isComparableColumn(fieldName: string) {
  const dataType = selectedColumn(fieldName)?.dataType?.toLowerCase() ?? "";
  return /(int|decimal|numeric|number|float|double|date|time)/.test(dataType);
}

function operatorOptions(condition: AdsQueryConditionForm) {
  return isComparableColumn(condition.field)
    ? comparableOperatorOptions
    : textOperatorOptions;
}

function normalizeConditionOperator(condition: AdsQueryConditionForm) {
  const options = operatorOptions(condition);
  if (!options.some((option) => option.value === condition.operator)) {
    condition.operator = isComparableColumn(condition.field)
      ? "EQ"
      : "CONTAINS";
  }
  if (isNullOperator(condition.operator)) {
    condition.value = "";
    condition.secondValue = "";
  }
}

function validateConditions() {
  for (const condition of queryConditions.value) {
    const touched = Boolean(
      condition.field ||
      condition.value?.trim() ||
      condition.secondValue?.trim(),
    );
    if (!touched) {
      continue;
    }
    if (!condition.field) {
      BaseToast.warning("请选择查询字段");
      return false;
    }
    if (!isNullOperator(condition.operator) && !condition.value?.trim()) {
      BaseToast.warning("请填写查询条件值");
      return false;
    }
    if (
      needsSecondValue(condition.operator) &&
      !condition.secondValue?.trim()
    ) {
      BaseToast.warning("请填写区间结束值");
      return false;
    }
  }
  return true;
}

function submitAdsQuery() {
  if (!validateConditions()) {
    return;
  }
  adsTableRef.value?.search();
}

function changeAdsTable() {
  selectedAdsTable.value = null;
  adsTableColumns.value = [];
  adsTableFieldOptions.value = [];
  adsTableTotal.value = 0;
  adsTableQuery.orderBy = "";
  selectedOutputFields.value = [];
  queryConditions.value = [createCondition()];
  adsTableRef.value?.search();
}

function resetAdsTableQuery() {
  adsTableQuery.tableCode = adsTableOptions.value[0]?.tableCode ?? "";
  adsTableQuery.orderBy = "";
  adsTableQuery.orderDirection = "ASC";
  selectedOutputFields.value = [];
  queryConditions.value = [createCondition()];
  selectedAdsTable.value = null;
  adsTableColumns.value = [];
  adsTableFieldOptions.value = [];
  adsTableTotal.value = 0;
}

function resetAndQuery() {
  resetAdsTableQuery();
  adsTableRef.value?.search();
}

function addCondition() {
  if (queryConditions.value.length >= 20) {
    BaseToast.warning("最多添加20个查询条件");
    return;
  }
  queryConditions.value.push(createCondition());
}

function removeCondition(index: number) {
  if (queryConditions.value.length === 1) {
    queryConditions.value = [createCondition()];
    return;
  }
  queryConditions.value.splice(index, 1);
}

function retryAdsTableDirectory(visible: boolean) {
  if (visible && !adsTableLoading.value && adsTableOptions.value.length === 0) {
    void loadAdsTables();
  }
}

function columnMeta(column: GovernanceAdsTableColumn) {
  const size = column.columnSize ? `(${column.columnSize})` : "";
  return `${column.dataType ?? "未知类型"}${size} · ${column.nullable ? "可空" : "非空"}`;
}

function fieldLabel(column: GovernanceAdsTableColumn) {
  const conciseLabels: Record<string, string> = {
    old_version: "旧版本",
    new_snapshot: "新快照",
    part_code: "零件号",
    diff_type: "差异类型",
    changed_fields: "变更字段",
    old_values: "旧值快照",
    new_values: "新值快照",
    calculation_version: "计算版本",
    rule_version: "规则版本",
    calculation_time: "计算时间",
    data_date: "数据日期",
    input_batch_ids: "输入批次",
    result_status: "结果状态",
    valid_date: "生效日",
    warning_date: "预警日",
    report_date: "报告日",
    period_type: "周期类型",
    period_value: "周期值",
    meeting_id: "会议编号",
    variance_amount: "成本差额",
    variance_rate: "差异率",
  };
  if (conciseLabels[column.name]) {
    return conciseLabels[column.name];
  }
  const comment = column.comment?.trim();
  if (!comment || /^业务字段[：:]/.test(comment)) {
    return column.name;
  }
  const conciseComments: Record<string, string> = {
    旧版本号: "旧版本",
    新快照标识: "新快照",
    发生变化的业务字段清单: "变更字段",
    旧版本字段值快照: "旧值快照",
    新版本字段值快照: "新值快照",
    当前成本减目标成本的差额: "成本差额",
    成本差额除以目标成本: "差异率",
    参与计算的输入批次集合: "输入批次",
    按阈值判断的预警等级: "预警等级",
  };
  return conciseComments[comment] ?? comment.replace(/[：:].*$/, "");
}

function fieldOptionLabel(column: GovernanceAdsTableColumn) {
  return `${fieldLabel(column)} · ${column.name}`;
}

function fieldTooltip(column: GovernanceAdsTableColumn) {
  const description = column.comment?.trim();
  return `${fieldLabel(column)}\n字段编码：${column.name}${description ? `\n说明：${description}` : ""}\n${columnMeta(column)}`;
}

function previewValue(value?: string) {
  return `'${(value ?? "").replaceAll("'", "''")}'`;
}

function conditionSql(condition: AdsQueryConditionForm) {
  const field = `\`${condition.field}\``;
  switch (condition.operator) {
    case "CONTAINS":
      return `${field} LIKE ${previewValue(`%${condition.value ?? ""}%`)}`;
    case "STARTS_WITH":
      return `${field} LIKE ${previewValue(`${condition.value ?? ""}%`)}`;
    case "ENDS_WITH":
      return `${field} LIKE ${previewValue(`%${condition.value ?? ""}`)}`;
    case "EQ":
      return `${field} = ${previewValue(condition.value)}`;
    case "NE":
      return `${field} <> ${previewValue(condition.value)}`;
    case "GT":
      return `${field} > ${previewValue(condition.value)}`;
    case "GTE":
      return `${field} >= ${previewValue(condition.value)}`;
    case "LT":
      return `${field} < ${previewValue(condition.value)}`;
    case "LTE":
      return `${field} <= ${previewValue(condition.value)}`;
    case "BETWEEN":
      return `${field} BETWEEN ${previewValue(condition.value)} AND ${previewValue(condition.secondValue)}`;
    case "IS_NULL":
      return `${field} IS NULL`;
    case "IS_NOT_NULL":
      return `${field} IS NOT NULL`;
  }
}

const sqlPreview = computed(() => {
  const tableCode = adsTableQuery.tableCode || "bq_ads.<请选择表>";
  const selectedColumns = selectedOutputFields.value.length
    ? selectedOutputFields.value.map((field) => `\`${field}\``).join(", ")
    : "*";
  const conditions = activeConditions();
  const whereClause = conditions.length
    ? ` WHERE ${conditions
        .map((condition, index) =>
          index === 0
            ? `(${conditionSql(condition)})`
            : `${condition.logic} (${conditionSql(condition)})`,
        )
        .join(" ")}`
    : "";
  const orderByClause = adsTableQuery.orderBy
    ? ` ORDER BY \`${adsTableQuery.orderBy}\` ${adsTableQuery.orderDirection}`
    : "";
  return `SELECT ${selectedColumns} FROM ${tableCode}${whereClause}${orderByClause} LIMIT :limit OFFSET :offset`;
});

onMounted(() => {
  void loadAdsTables();
});

onActivated(() => {
  if (adsTableOptions.value.length === 0) {
    void loadAdsTables();
  }
});
</script>

<template>
  <PageContainer
    class="governance-page ads-result-page"
    title="ADS结果"
    description="浏览已登记的ADS结果表，并按字段条件查询表内数据。"
  >
    <QueryTable
      ref="adsTableRef"
      :func="queryAdsTableContent"
      :enable-column-settings="false"
      fit-table-height
      empty-title="当前ADS表暂无数据"
      empty-description="当前筛选条件下没有可展示的结果。"
      @reset="resetAdsTableQuery"
    >
      <template #search>
        <el-form :model="adsTableQuery" class="ads-result-page__query-form">
          <el-form-item label="ADS表">
            <el-select
              v-model="adsTableQuery.tableCode"
              class="ads-result-page__table-select"
              filterable
              clearable
              :loading="adsTableLoading"
              placeholder="输入已登记的表名搜索"
              @change="changeAdsTable"
              @visible-change="retryAdsTableDirectory"
            >
              <el-option
                v-for="table in adsTableOptions"
                :key="table.tableCode"
                :label="table.qualifiedName"
                :value="table.tableCode"
              >
                <span>{{ table.qualifiedName }}</span>
                <span
                  v-if="table.tableComment"
                  class="ads-result-page__table-option-comment"
                  >{{ table.tableComment }}</span
                >
              </el-option>
            </el-select>
            <el-tooltip content="刷新ADS表目录" placement="top">
              <PermissionButton
                :icon="Refresh"
                :loading="adsTableLoading"
                circle
                aria-label="刷新ADS表目录"
                @click="loadAdsTables"
              />
            </el-tooltip>
          </el-form-item>

          <el-form-item label="返回字段">
            <el-select
              v-model="selectedOutputFields"
              class="ads-result-page__output-fields"
              multiple
              filterable
              clearable
              collapse-tags
              collapse-tags-tooltip
              :disabled="adsTableFieldOptions.length === 0"
              placeholder="默认返回全部字段"
            >
              <el-option
                v-for="column in adsTableFieldOptions"
                :key="column.name"
                :label="fieldOptionLabel(column)"
                :value="column.name"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="查询条件">
            <div class="ads-query-builder">
              <div
                v-for="(condition, index) in queryConditions"
                :key="index"
                class="ads-query-builder__row"
              >
                <el-select
                  v-if="index > 0"
                  v-model="condition.logic"
                  class="ads-query-builder__logic"
                  aria-label="条件连接符"
                >
                  <el-option label="并且" value="AND" />
                  <el-option label="或者" value="OR" />
                </el-select>
                <span
                  v-else
                  class="ads-query-builder__logic ads-query-builder__logic-placeholder"
                  aria-hidden="true"
                  >条件</span
                >
                <el-select
                  v-model="condition.field"
                  class="ads-query-builder__field"
                  filterable
                  clearable
                  :disabled="adsTableFieldOptions.length === 0"
                  placeholder="字段"
                  @change="normalizeConditionOperator(condition)"
                >
                  <el-option
                    v-for="column in adsTableFieldOptions"
                    :key="column.name"
                    :label="fieldOptionLabel(column)"
                    :value="column.name"
                  />
                </el-select>
                <el-select
                  v-model="condition.operator"
                  class="ads-query-builder__operator"
                  placeholder="条件"
                >
                  <el-option
                    v-for="option in operatorOptions(condition)"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
                <el-input
                  v-if="!isNullOperator(condition.operator)"
                  v-model="condition.value"
                  class="ads-query-builder__value"
                  clearable
                  placeholder="查询值"
                  @keyup.enter="submitAdsQuery"
                />
                <el-input
                  v-if="needsSecondValue(condition.operator)"
                  v-model="condition.secondValue"
                  class="ads-query-builder__second-value"
                  clearable
                  placeholder="结束值"
                  @keyup.enter="submitAdsQuery"
                />
                <div class="ads-query-builder__actions">
                  <el-tooltip
                    v-if="index === queryConditions.length - 1"
                    content="添加条件"
                    placement="top"
                  >
                    <PermissionButton
                      :icon="Plus"
                      circle
                      plain
                      type="primary"
                      aria-label="添加条件"
                      @click="addCondition"
                    />
                  </el-tooltip>
                  <el-tooltip
                    v-if="queryConditions.length > 1"
                    content="删除条件"
                    placement="top"
                  >
                    <PermissionButton
                      :icon="Minus"
                      circle
                      plain
                      type="danger"
                      aria-label="删除条件"
                      @click="removeCondition(index)"
                    />
                  </el-tooltip>
                </div>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="排序">
            <div class="ads-result-page__sort-control">
              <el-select
                v-model="adsTableQuery.orderBy"
                filterable
                clearable
                :disabled="adsTableFieldOptions.length === 0"
                placeholder="不排序"
              >
                <el-option
                  v-for="column in adsTableFieldOptions"
                  :key="column.name"
                  :label="fieldOptionLabel(column)"
                  :value="column.name"
                />
              </el-select>
              <el-radio-group
                v-if="adsTableQuery.orderBy"
                v-model="adsTableQuery.orderDirection"
                aria-label="排序方向"
              >
                <el-radio-button label="ASC">升序</el-radio-button>
                <el-radio-button label="DESC">降序</el-radio-button>
              </el-radio-group>
            </div>
          </el-form-item>
        </el-form>
      </template>
      <template #searchActions>
        <PermissionButton
          permission="data:governance:ads:view"
          type="primary"
          :icon="Search"
          :loading="adsTableLoading"
          @click="submitAdsQuery"
          >查询</PermissionButton
        >
        <PermissionButton
          permission="data:governance:ads:view"
          :icon="RefreshRight"
          @click="resetAndQuery"
          >重置</PermissionButton
        >
      </template>
      <template #beforeTable>
        <div class="ads-result-page__query-context">
          <div v-if="selectedAdsTable" class="ads-result-page__table-summary">
            <span>表：{{ selectedAdsTable.qualifiedName }}</span>
            <span v-if="selectedAdsTable.tableComment">{{
              selectedAdsTable.tableComment
            }}</span>
            <span>字段：{{ adsTableColumns.length }}</span>
            <span>数据总数：{{ adsTableTotal }}</span>
          </div>
          <div class="ads-result-page__sql-preview">
            <span>SQL</span>
            <code>{{ sqlPreview }}</code>
          </div>
        </div>
      </template>
      <template #content="{ list, loading, height }">
        <el-table
          :data="list"
          :height="height"
          :loading="loading"
          border
          show-overflow-tooltip
        >
          <el-table-column
            v-for="column in adsTableColumns"
            :key="column.name"
            :prop="column.name"
            :label="fieldLabel(column)"
            min-width="160"
            show-overflow-tooltip
            :formatter="
              (
                _row: Record<string, unknown>,
                _tableColumn: unknown,
                cellValue: unknown,
              ) => formatGovernanceAdsCell(column, cellValue)
            "
          >
            <template #header>
              <div
                class="ads-result-page__field-header"
                :title="fieldTooltip(column)"
              >
                <span>{{ fieldLabel(column) }}</span>
                <small>{{ column.name }}</small>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </QueryTable>
  </PageContainer>
</template>

<style scoped>
.ads-result-page :deep(.base-search-form) {
  align-items: flex-start;
}

.ads-result-page :deep(.base-search-form__content) {
  padding-right: 32px;
}

.ads-result-page :deep(.base-search-form__content .el-form) {
  grid-template-columns: minmax(0, 1fr);
  max-width: none;
}

.ads-result-page :deep(.el-form-item__content) {
  flex-wrap: nowrap;
  gap: 8px;
}

.ads-result-page :deep(.ads-result-page__table-select) {
  flex: 0 1 520px;
  width: auto;
}

.ads-result-page :deep(.ads-result-page__output-fields) {
  width: min(100%, 760px);
}

.ads-query-builder {
  display: grid;
  width: 100%;
  gap: 8px;
}

.ads-query-builder__row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.ads-query-builder__logic {
  flex: 0 0 68px;
  width: 68px;
}

.ads-query-builder__field {
  flex: 1 1 220px;
  min-width: 180px;
}

.ads-query-builder__operator {
  flex: 0 0 120px;
  width: 120px;
}

.ads-query-builder__value {
  flex: 1 1 220px;
  min-width: 160px;
}

.ads-query-builder__second-value {
  flex: 1 1 180px;
  min-width: 140px;
}

.ads-query-builder__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.ads-query-builder__logic-placeholder {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.ads-result-page__sort-control {
  display: flex;
  align-items: center;
  width: min(100%, 540px);
  gap: 8px;
}

.ads-result-page__sort-control .el-select {
  flex: 1 1 auto;
}

.ads-result-page__table-option-comment {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
}

.ads-result-page__query-context {
  display: grid;
  gap: 8px;
}

.ads-result-page__table-summary,
.ads-result-page__sql-preview {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px 20px;
  padding: 8px 12px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-lighter);
  border-left: 3px solid var(--el-color-primary-light-5);
}

.ads-result-page__table-summary {
  flex-wrap: wrap;
}

.ads-result-page__sql-preview > span {
  flex: 0 0 auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
}

.ads-result-page__sql-preview code {
  min-width: 0;
  overflow-x: auto;
  color: var(--el-text-color-primary);
  font-size: 12px;
  white-space: nowrap;
}

.ads-result-page__field-header {
  display: grid;
  gap: 4px;
  min-width: 0;
  line-height: 1.25;
}

.ads-result-page__field-header > span,
.ads-result-page__field-header small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ads-result-page__field-header small {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

@media (max-width: 960px) {
  .ads-result-page :deep(.base-search-form) {
    flex-direction: column;
  }

  .ads-result-page :deep(.base-search-form__content) {
    padding-right: 0;
  }

  .ads-result-page :deep(.base-search-form__actions) {
    width: 100%;
  }

  .ads-query-builder__row {
    flex-wrap: wrap;
  }

  .ads-query-builder__logic,
  .ads-query-builder__field,
  .ads-query-builder__operator,
  .ads-query-builder__value,
  .ads-query-builder__second-value {
    flex: 1 1 calc(50% - 8px);
    width: auto;
    min-width: 0;
  }

  .ads-result-page__sort-control {
    flex-wrap: wrap;
  }
}
</style>
