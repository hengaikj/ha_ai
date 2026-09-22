<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import type { FormInstance, FormRules } from "element-plus";
import { MoreFilled } from "@element-plus/icons-vue";
import {
  fetchGovernanceSources,
  createGovernanceSource,
  deleteGovernanceSource,
  fetchGovernanceOdsTableMetadata,
  syncGovernanceSource,
  testGovernanceSourceConnection,
  updateGovernanceSource,
} from "@/api/data-governance";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import {
  formatGovernanceCell,
  formatGovernanceValue,
  normalizeGovernanceError,
} from "./governance-page-utils";
import {
  GOVERNANCE_ACCESS_METHOD_OPTIONS,
  GOVERNANCE_SOURCE_TABLE_OPTIONS,
} from "./governance-source-table-options";
import type {
  GovernanceSource,
  GovernanceSourceRequest,
  GovernanceTableMetadata,
} from "@/types/data-governance";

type QueryTableExpose = { reload: () => Promise<void> };

const DEFAULT_SYNC_EXPRESSION = "0 0 0 * * ?";

const router = useRouter();
const queryTableRef = ref<QueryTableExpose | null>(null);
const testingSource = ref("");
const syncingSource = ref("");
const syncConfirmVisible = ref(false);
const pendingSyncSource = ref<GovernanceSource | null>(null);
const sourceDialog = ref(false);
const editingSource = ref("");
const sourceSaving = ref(false);
const odsTableLoading = ref(false);
const odsTableOptions = ref<GovernanceTableMetadata[]>([]);
const sourceFormRef = ref<FormInstance>();
const filters = reactive({
  keyword: "",
  sourceSystem: "",
  accessMethod: "",
  connectionStatus: "",
});
const defaultSourceForm = (): GovernanceSourceRequest => ({
  sourceCode: "",
  sourceName: "",
  sourceSystem: "SRM",
  sourceTable: "",
  databaseType: "",
  accessMethod: "",
  endpoint: "",
  host: "",
  port: undefined,
  databaseName: "",
  schemaName: "",
  serviceName: "",
  jdbcUrl: "",
  username: "",
  password: "",
  passwordChanged: false,
  incrementalField: "",
  connectionStatus: "REGISTERED",
  lakePath: "",
  targetOdsTable: "",
  syncFrequency: DEFAULT_SYNC_EXPRESSION,
  ownerName: "",
  schemaVersion: "v1.0.0",
  enabled: true,
  remark: "",
});
const sourceForm = reactive<GovernanceSourceRequest>(defaultSourceForm());
const isEtlAccess = computed(() => sourceForm.accessMethod === "ETL");
const isOracleAccess = computed(() => sourceForm.accessMethod === "Oracle");
const isJdbcAccess = computed(() => !isEtlAccess.value);
const syncConfirmMessage = computed(() => {
  const source = pendingSyncSource.value;
  if (!source) return "";
  return `当前来源“${source.sourceName}”将全量替换 ODS 表 ${source.targetOdsTable}，成功后直接重建 DWD（跳过质量稽核和 ADS），是否继续？`;
});
const actionError = ref<ReturnType<typeof normalizeGovernanceError> | null>(
  null,
);
const sourceFormRules: FormRules<GovernanceSourceRequest> = {
  sourceCode: [
    { required: true, message: "请输入数据源编码", trigger: "blur" },
  ],
  sourceName: [{ required: true, message: "请输入来源名称", trigger: "blur" }],
  sourceSystem: [
    { required: true, message: "请输入来源系统", trigger: "blur" },
  ],
  sourceTable: [
    { required: true, message: "请选择来源表/视图", trigger: "change" },
  ],
  accessMethod: [
    { required: true, message: "请选择接入方式", trigger: "change" },
  ],
  host: [{ validator: requireJdbcField("请输入主机地址"), trigger: "blur" }],
  databaseName: [
    { validator: requireJdbcField("请输入数据库/库名"), trigger: "blur" },
  ],
  serviceName: [
    { validator: requireJdbcField("请输入 Oracle 服务名"), trigger: "blur" },
  ],
  username: [{ validator: requireJdbcField("请输入用户名"), trigger: "blur" }],
  password: [{ validator: requireJdbcPassword, trigger: "blur" }],
  targetOdsTable: [
    { required: true, message: "请选择目标 ODS 表", trigger: "change" },
  ],
  ownerName: [{ required: true, message: "请输入责任人", trigger: "blur" }],
  syncFrequency: [
    { required: true, message: "请输入时间表达式", trigger: "blur" },
  ],
  lakePath: [
    { required: true, message: "请输入入湖逻辑目录", trigger: "blur" },
  ],
  schemaVersion: [
    { required: true, message: "请输入结构版本", trigger: "blur" },
  ],
};

function requireJdbcField(message: string) {
  return (
    _rule: unknown,
    value: unknown,
    callback: (error?: Error) => void,
  ) => {
    if (!isJdbcAccess.value) {
      callback();
      return;
    }
    if (String(value ?? "").trim()) callback();
    else callback(new Error(message));
  };
}

function requireJdbcPassword(
  _rule: unknown,
  value: unknown,
  callback: (error?: Error) => void,
) {
  if (!isJdbcAccess.value) {
    callback();
    return;
  }
  if (!editingSource.value || sourceForm.passwordChanged) {
    if (String(value ?? "").trim()) callback();
    else callback(new Error("请输入连接密码"));
    return;
  }
  callback();
}

function canonicalAccessMethod(value?: string) {
  const normalized = value?.trim().toUpperCase() || "";
  if (normalized.includes("MYSQL") || normalized.includes("MARIADB"))
    return "MySQL";
  if (normalized.includes("ORACLE")) return "Oracle";
  if (normalized.includes("DENODO") || normalized.includes("丹诺德"))
    return "丹诺德";
  if (normalized.includes("ETL")) return "ETL";
  return "";
}

function defaultJdbcPort(accessMethod: string) {
  const normalized = canonicalAccessMethod(accessMethod);
  if (normalized === "Oracle") return 1521;
  if (normalized === "丹诺德") return 9999;
  if (normalized === "MySQL") return 3306;
  return undefined;
}

function resetJdbcConnectionFields() {
  sourceForm.host = "";
  sourceForm.port = undefined;
  sourceForm.databaseName = "";
  sourceForm.schemaName = "";
  sourceForm.serviceName = "";
  sourceForm.jdbcUrl = "";
  sourceForm.username = "";
  sourceForm.password = "";
  sourceForm.passwordChanged = false;
}

function buildConnectionSummary(accessMethod: string) {
  const normalized = canonicalAccessMethod(accessMethod);
  if (!normalized || normalized === "ETL") return "";
  const host = (sourceForm.host ?? "").trim();
  if (!host) return "";
  const port = sourceForm.port ? `:${sourceForm.port}` : "";
  const target =
    normalized === "Oracle"
      ? (sourceForm.serviceName || sourceForm.databaseName || "").trim()
      : (sourceForm.databaseName ?? "").trim();
  const schema = (sourceForm.schemaName ?? "").trim();
  const parts = [`${normalized.toLowerCase()}://${host}${port}`];
  if (target) parts.push(`/${target}`);
  if (schema) parts.push(` schema=${schema}`);
  return parts.join("");
}

function inferAccessMethod() {
  const accessMethod = canonicalAccessMethod(sourceForm.accessMethod);
  const databaseType = canonicalAccessMethod(sourceForm.databaseType);
  return accessMethod || databaseType || "";
}

function normalizeSourceConnectionForm() {
  const accessMethod = inferAccessMethod();
  sourceForm.accessMethod = accessMethod;
  sourceForm.databaseType = accessMethod;
  if (accessMethod === "ETL") {
    resetJdbcConnectionFields();
    sourceForm.endpoint = "";
    return;
  }
  if (accessMethod && !sourceForm.port) {
    sourceForm.port = defaultJdbcPort(accessMethod);
  }
  sourceForm.endpoint = buildConnectionSummary(accessMethod);
}

async function querySources(pageSize: number, pageNo: number) {
  const result = await fetchGovernanceSources({
    keyword: filters.keyword || undefined,
    sourceSystem: filters.sourceSystem || undefined,
    accessMethod: filters.accessMethod || undefined,
    connectionStatus: filters.connectionStatus || undefined,
    pageNo,
    pageSize,
  });
  const list = result.records;
  return {
    list,
    total: result.total,
    pageNo: result.pageNo,
    pageSize: result.pageSize,
  };
}

function handleMoreAction(command: string, source: GovernanceSource) {
  if (command === "delete") void removeSource(source);
}

function openSyncRecords(source: GovernanceSource) {
  void router.push({
    path: "/data-governance/ods-batches",
    query: { objectCode: source.sourceCode },
  });
}

function askManualSync(source: GovernanceSource) {
  if (!canManualSync(source)) return;
  actionError.value = null;
  pendingSyncSource.value = source;
  syncConfirmVisible.value = true;
}

function canManualSync(source: GovernanceSource) {
  return (
    source.enabled &&
    canonicalAccessMethod(source.accessMethod) !== "ETL" &&
    syncingSource.value !== source.sourceCode
  );
}

async function runManualSync() {
  const source = pendingSyncSource.value;
  if (!source) return;
  syncingSource.value = source.sourceCode;
  actionError.value = null;
  try {
    const result = await syncGovernanceSource(source.sourceCode);
    BaseToast.success(
      `ODS 全量同步 ${result.syncedRows} 条，DWD 重建 ${result.dwdRows} 条`,
    );
    syncConfirmVisible.value = false;
    pendingSyncSource.value = null;
    await queryTableRef.value?.reload();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "数据源全量同步失败");
  } finally {
    syncingSource.value = "";
  }
}

function resetFilters() {
  filters.keyword = "";
  filters.sourceSystem = "";
  filters.accessMethod = "";
  filters.connectionStatus = "";
}

function openSourceDialog(source?: GovernanceSource) {
  editingSource.value = source?.sourceCode || "";
  Object.assign(sourceForm, defaultSourceForm(), source || {}, {
    password: "",
    passwordChanged: false,
  });
  normalizeSourceConnectionForm();
  void loadOdsTableOptions(sourceForm.targetOdsTable);
  sourceDialog.value = true;
}

async function loadOdsTableOptions(keyword = "") {
  odsTableLoading.value = true;
  try {
    odsTableOptions.value = await fetchGovernanceOdsTableMetadata(
      keyword.trim() || undefined,
    );
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "ODS 表元数据查询失败");
  } finally {
    odsTableLoading.value = false;
  }
}

async function saveSource() {
  if (!(await sourceFormRef.value?.validate().catch(() => false))) return;
  sourceSaving.value = true;
  try {
    normalizeSourceConnectionForm();
    const password = sourceForm.password || undefined;
    const payload: GovernanceSourceRequest = {
      ...sourceForm,
      password,
      passwordChanged: Boolean(sourceForm.passwordChanged || password),
    };
    if (editingSource.value)
      await updateGovernanceSource(editingSource.value, payload);
    else await createGovernanceSource(payload);
    BaseToast.success(editingSource.value ? "数据源已更新" : "数据源已新增");
    sourceDialog.value = false;
    await queryTableRef.value?.reload();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "数据源保存失败");
  } finally {
    sourceSaving.value = false;
  }
}

async function removeSource(source: GovernanceSource) {
  if (!window.confirm(`确认删除 ${source.sourceName}？`)) return;
  try {
    await deleteGovernanceSource(source.sourceCode);
    BaseToast.success("数据源已删除");
    await queryTableRef.value?.reload();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "数据源删除失败");
  }
}

async function testConnection(source: GovernanceSource) {
  testingSource.value = source.sourceCode;
  actionError.value = null;
  try {
    const result = await testGovernanceSourceConnection(source.sourceCode);
    if (result.lastTestStatus === "SUCCESS")
      BaseToast.success("数据源连接正常");
    else BaseToast.error(result.lastTestMessage || "数据源连接失败");
    await queryTableRef.value?.reload();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "数据源连接检测失败");
  } finally {
    testingSource.value = "";
  }
}
</script>

<template>
  <PageContainer
    class="bq-management-page governance-page"
    title="数据源管理"
    description="维护治理数据源配置并检测连接状态。"
  >
    <TraceErrorAlert v-if="actionError && !sourceDialog" v-bind="actionError" />
    <QueryTable
      ref="queryTableRef"
      :func="querySources"
      fit-table-height
      :table-props="{ tableLayout: 'fixed' }"
      empty-title="暂无数据源"
      empty-description="当前筛选条件下没有可展示的数据源。"
      @reset="resetFilters"
    >
      <template #search>
        <el-form :model="filters">
          <el-form-item label="关键字">
            <el-input
              v-model="filters.keyword"
              clearable
              placeholder="名称、编码或来源表"
            />
          </el-form-item>
          <el-form-item label="来源系统">
            <el-select
              v-model="filters.sourceSystem"
              clearable
              placeholder="请选择来源系统"
            >
              <el-option label="SRM" value="SRM" />
              <el-option label="BOM" value="BOM" />
            </el-select>
          </el-form-item>
          <el-form-item label="接入方式">
            <el-select
              v-model="filters.accessMethod"
              clearable
              placeholder="请选择接入方式"
            >
              <el-option
                v-for="method in GOVERNANCE_ACCESS_METHOD_OPTIONS"
                :key="method"
                :label="method"
                :value="method"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="接入状态">
            <el-select
              v-model="filters.connectionStatus"
              clearable
              placeholder="请选择接入状态"
            >
              <el-option label="已登记" value="REGISTERED" />
              <el-option label="已接入" value="ACTIVE" />
              <el-option label="已停用" value="SUSPENDED" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <el-table-column
        prop="sourceName"
        label="来源名称"
        min-width="150"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="sourceCode"
        label="编码"
        min-width="130"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="sourceSystem"
        label="来源系统"
        min-width="120"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="sourceTable"
        label="来源表"
        min-width="220"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="databaseType"
        label="数据库"
        width="90"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="accessMethod"
        label="接入方式"
        width="100"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="endpoint"
        label="连接地址"
        min-width="260"
        show-overflow-tooltip
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="targetOdsTable"
        label="ODS 表"
        min-width="170"
        :formatter="formatGovernanceCell"
      />
      <el-table-column prop="syncFrequency" label="时间表达式" min-width="120">
        <template #default="{ row }">
          <el-tag v-if="row.syncFrequency === '待北汽确认'" type="warning"
            >待北汽确认</el-tag
          >
          <span v-else>{{ formatGovernanceValue(row.syncFrequency) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="ownerName"
        label="责任人"
        min-width="120"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="接入状态" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.connectionStatus === 'ACTIVE'" type="success"
            >已接入</el-tag
          >
          <el-tag v-else-if="row.connectionStatus === 'SUSPENDED'" type="danger"
            >已停用</el-tag
          >
          <el-tag v-else-if="row.connectionStatus === 'REGISTERED'" type="info"
            >已登记</el-tag
          >
          <span v-else>{{ formatGovernanceValue(row.connectionStatus) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="lastSourceBatchNo"
        label="最近批次"
        min-width="150"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="最近到达" min-width="170">
        <template #default="{ row }"
          ><BaseDateTime :value="row.lastArrivalAt" empty-text="-"
        /></template>
      </el-table-column>
      <el-table-column label="连接检测" min-width="170">
        <template #default="{ row }">
          <div>{{ formatGovernanceValue(row.lastTestMessage) }}</div>
          <BaseDateTime :value="row.lastTestAt" empty-text="-" />
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        width="380"
        fixed="right"
        align="center"
        class-name="governance-source-operation-column"
      >
        <template #default="{ row }">
          <div class="bq-table-actions governance-source-actions">
            <PermissionButton
              link
              permission="data:governance:source:manage"
              @click.stop="openSourceDialog(row)"
              >编辑</PermissionButton
            >
            <PermissionButton
              link
              :permission="[
                'data:governance:source:test',
                'data:governance:manage',
              ]"
              :loading="testingSource === row.sourceCode"
              @click.stop="testConnection(row)"
              >测试连接</PermissionButton
            >
            <PermissionButton
              link
              :permission="[
                'data:governance:run:execute',
                'data:governance:manage',
              ]"
              :disabled="!canManualSync(row)"
              :loading="syncingSource === row.sourceCode"
              @click.stop="askManualSync(row)"
              >手动同步</PermissionButton
            >
            <PermissionButton
              link
              permission="data:governance:batch:view"
              @click.stop="openSyncRecords(row)"
              >同步记录</PermissionButton
            >
            <el-dropdown
              trigger="click"
              @command="handleMoreAction(String($event), row)"
            >
              <el-button
                link
                :icon="MoreFilled"
                aria-label="更多操作"
                title="更多操作"
              />
              <template #dropdown>
                <el-dropdown-menu>
                  <PermissionGuard permission="data:governance:source:manage">
                    <el-dropdown-item command="delete" divided class="is-danger"
                      >删除</el-dropdown-item
                    >
                  </PermissionGuard>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseConfirm
      v-model="syncConfirmVisible"
      title="手动全量同步 ODS → DWD"
      :message="syncConfirmMessage"
      type="warning"
      confirm-text="开始同步"
      :loading="Boolean(syncingSource)"
      @confirm="runManualSync"
    />

    <BaseFormDialog
      v-model="sourceDialog"
      :title="editingSource ? '编辑数据源' : '新增数据源'"
      width="920px"
      body-max-height="65vh"
      :loading="sourceSaving"
      @confirm="saveSource"
    >
      <el-form
        ref="sourceFormRef"
        :model="sourceForm"
        :rules="sourceFormRules"
        label-position="top"
      >
        <el-row :gutter="16">
          <el-col :span="12"
            ><el-form-item label="数据源编码" prop="sourceCode" required
              ><el-input
                v-model="sourceForm.sourceCode"
                :disabled="!!editingSource" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="来源名称" prop="sourceName" required
              ><el-input v-model="sourceForm.sourceName" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="来源系统" prop="sourceSystem" required
              ><el-input v-model="sourceForm.sourceSystem" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="来源表" prop="sourceTable" required
              ><el-select
                v-model="sourceForm.sourceTable"
                filterable
                placeholder="请选择或搜索来源表/视图"
              >
                <el-option
                  v-for="tableName in GOVERNANCE_SOURCE_TABLE_OPTIONS"
                  :key="tableName"
                  :label="tableName"
                  :value="tableName"
                /> </el-select></el-form-item
          ></el-col>
          <el-col :span="8"
            ><el-form-item label="接入方式" prop="accessMethod"
              ><el-select
                v-model="sourceForm.accessMethod"
                @change="normalizeSourceConnectionForm"
              >
                <el-option
                  v-for="method in GOVERNANCE_ACCESS_METHOD_OPTIONS"
                  :key="method"
                  :label="method"
                  :value="method"
                /> </el-select></el-form-item
          ></el-col>
          <el-col :span="8"
            ><el-form-item label="接入状态"
              ><el-select v-model="sourceForm.connectionStatus"
                ><el-option label="已登记" value="REGISTERED" /><el-option
                  label="已接入"
                  value="ACTIVE" /><el-option
                  label="已停用"
                  value="SUSPENDED" /></el-select></el-form-item
          ></el-col>
          <template v-if="isJdbcAccess">
            <el-col :span="24"
              ><el-divider content-position="left">连接配置</el-divider></el-col
            >
            <el-col :span="8"
              ><el-form-item label="主机地址" prop="host" required
                ><el-input
                  v-model="sourceForm.host"
                  placeholder="例如：127.0.0.1" /></el-form-item
            ></el-col>
            <el-col :span="4"
              ><el-form-item label="端口" prop="port"
                ><el-input-number
                  v-model="sourceForm.port"
                  :min="1"
                  :max="65535"
                  controls-position="right"
                  style="width: 100%" /></el-form-item
            ></el-col>
            <el-col v-if="!isOracleAccess" :span="6"
              ><el-form-item label="数据库/库名" prop="databaseName" required
                ><el-input
                  v-model="sourceForm.databaseName"
                  placeholder="MySQL/丹诺德库名" /></el-form-item
            ></el-col>
            <el-col v-else :span="6"
              ><el-form-item label="Oracle 服务名" prop="serviceName" required
                ><el-input
                  v-model="sourceForm.serviceName"
                  placeholder="例如：ORCL 或服务名/SID" /></el-form-item
            ></el-col>
            <el-col :span="8"
              ><el-form-item label="Schema" prop="schemaName"
                ><el-input
                  v-model="sourceForm.schemaName"
                  placeholder="可选，如 BAIC_SRMX" /></el-form-item
            ></el-col>
            <el-col :span="8"
              ><el-form-item label="用户名" prop="username" required
                ><el-input
                  v-model="sourceForm.username"
                  autocomplete="off" /></el-form-item
            ></el-col>
            <el-col :span="8"
              ><el-form-item
                label="密码"
                prop="password"
                :required="!editingSource || sourceForm.passwordChanged"
                ><el-input
                  v-model="sourceForm.password"
                  type="password"
                  show-password
                  autocomplete="new-password"
                  :placeholder="
                    editingSource ? '留空则不修改已保存密码' : '请输入连接密码'
                  " /></el-form-item
            ></el-col>
            <el-col v-if="editingSource" :span="24">
              <el-checkbox v-model="sourceForm.passwordChanged"
                >未输入新密码时，保存后清空已保存密码</el-checkbox
              >
            </el-col>
            <el-col :span="16"
              ><el-form-item label="JDBC URL（可选高级配置）" prop="jdbcUrl"
                ><el-input
                  v-model="sourceForm.jdbcUrl"
                  placeholder="可覆盖主机/端口自动拼接；不要填写密码参数" /></el-form-item
            ></el-col>
          </template>
          <el-col :span="8"
            ><el-form-item label="增量字段" prop="incrementalField"
              ><el-input
                v-model="sourceForm.incrementalField"
                placeholder="可选，如 update_time" /></el-form-item
          ></el-col>
          <el-col :span="24"
            ><el-form-item label="连接摘要"
              ><el-input
                v-model="sourceForm.endpoint"
                placeholder="保存后后端会生成脱敏摘要，也可先填写说明" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="目标 ODS 表" prop="targetOdsTable"
              ><el-select
                v-model="sourceForm.targetOdsTable"
                filterable
                remote
                clearable
                :loading="odsTableLoading"
                :remote-method="loadOdsTableOptions"
                placeholder="请选择或搜索 ODS 元数据表"
              >
                <el-option
                  v-for="table in odsTableOptions"
                  :key="table.tableCode"
                  :label="table.qualifiedName"
                  :value="table.qualifiedName"
                >
                  <div>{{ table.qualifiedName }}</div>
                  <small v-if="table.tableComment">{{
                    table.tableComment
                  }}</small>
                </el-option>
              </el-select></el-form-item
            ></el-col
          >
          <el-col :span="12"
            ><el-form-item label="时间表达式"
              ><el-input
                v-model="sourceForm.syncFrequency"
                placeholder="0 0 0 * * ?（每日 00:00）" /></el-form-item
          ></el-col>
          <el-col :span="8"
            ><el-form-item label="责任人" prop="ownerName"
              ><el-input v-model="sourceForm.ownerName" /></el-form-item
          ></el-col>
          <el-col :span="8"
            ><el-form-item label="结构版本" prop="schemaVersion"
              ><el-input v-model="sourceForm.schemaVersion" /></el-form-item
          ></el-col>
          <el-col :span="8"
            ><el-form-item label="是否启用"
              ><el-switch v-model="sourceForm.enabled" /></el-form-item
          ></el-col>
          <el-col :span="24"
            ><el-form-item label="入湖逻辑目录" prop="lakePath"
              ><el-input
                v-model="sourceForm.lakePath"
                placeholder="例如：denodo://jt_data/source_table" /></el-form-item
          ></el-col>
          <el-col :span="24"
            ><el-form-item label="备注"
              ><el-input
                v-model="sourceForm.remark"
                type="textarea"
                :rows="2" /></el-form-item
          ></el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>
  </PageContainer>
</template>

<style scoped>
:deep(.el-table) {
  --el-table-fixed-right-column: none;
}

:deep(.el-table-fixed-column--right.is-first-column) {
  box-shadow: none !important;
  border-left: 1px solid var(--bq-color-border-subtle);
}

:deep(.governance-source-operation-column .cell) {
  padding-right: 12px;
  padding-left: 12px;
}

.governance-source-actions {
  box-sizing: border-box;
  padding: 0;
}
</style>
