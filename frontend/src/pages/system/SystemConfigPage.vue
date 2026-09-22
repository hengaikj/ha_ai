<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import { CirclePlus, Download, RefreshRight } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  createPlatformSystemConfig,
  deletePlatformSystemConfigs,
  exportPlatformSystemConfigs,
  fetchPlatformSystemConfigDetail,
  fetchPlatformSystemConfigsPage,
  refreshPlatformSystemConfigCache,
  updatePlatformSystemConfig,
} from "@/api/platform-system";
import { ApiBusinessError } from "@/api/http";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import DictTag from "@/components/base/DictTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { toDateTimeRangeParams } from "@/utils/date-range";
import { resolvePageTotal } from "@/utils/pagination";
import {
  configValueForEditor,
  configValueForSubmit,
  isSensitiveConfigKey,
} from "./system-config-sensitive";
import type {
  PlatformStatus,
  PlatformSystemConfigItem,
  PlatformSystemConfigQuery,
} from "@/types/platform-system";

interface ConfigQueryState {
  configName: string;
  configKey: string;
  systemBuiltin: boolean | "";
  status: PlatformStatus | "";
  createdAtRange: [string, string] | [] | null;
}

interface ConfigFormState {
  id?: number;
  configName: string;
  configKey: string;
  configValue: string;
  systemBuiltin: boolean;
  status: PlatformStatus;
  remark: string;
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

const emptyConfigForm = (): ConfigFormState => ({
  configName: "",
  configKey: "",
  configValue: "",
  systemBuiltin: false,
  status: "ENABLED",
  remark: "",
});

const systemBuiltinOptions = [
  { label: "是", value: true, type: "success" as const },
  { label: "否", value: false, type: "info" as const },
];

const query = reactive<ConfigQueryState>({
  configName: "",
  configKey: "",
  systemBuiltin: "",
  status: "",
  createdAtRange: [],
});
const form = reactive<ConfigFormState>(emptyConfigForm());
const formRef = ref<FormInstance>();
const selectedConfigs = ref<PlatformSystemConfigItem[]>([]);
const saving = ref(false);
const exporting = ref(false);
const formDialogVisible = ref(false);
const queryTableRef = ref<QueryTableExpose | null>(null);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const editing = computed(() => Boolean(form.id));
const formDialogTitle = computed(() =>
  editing.value ? "编辑参数" : "新增参数",
);
const sensitiveConfig = computed(() => isSensitiveConfigKey(form.configKey));
const formRules: FormRules<ConfigFormState> = {
  configValue: [
    {
      validator: (_rule, value: string, callback) => {
        const submitted = configValueForSubmit({
          editing: editing.value,
          configKey: form.configKey,
          configValue: value ?? "",
        });
        if (!submitted.trim()) {
          callback(new Error("参数键值不能为空"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
};

async function queryConfigs(pageSize: number, pageNo: number) {
  error.value = null;
  try {
    const response = await fetchPlatformSystemConfigsPage(
      buildConfigQueryParams(pageSize, pageNo),
    );
    return {
      total: resolvePageTotal(response, pageNo, pageSize),
      list: response.records,
      pageNo: response.pageNo,
      pageSize: response.pageSize,
    };
  } catch (unknownError) {
    const normalizedError = normalizeError(unknownError);
    error.value = normalizedError;
    throw new Error(normalizedError.message, { cause: unknownError });
  }
}

function buildConfigQueryParams(
  pageSize: number,
  pageNo: number,
): PlatformSystemConfigQuery {
  const dateRange = toDateTimeRangeParams(query.createdAtRange);
  return {
    pageNo,
    pageSize,
    configName: query.configName.trim() || undefined,
    configKey: query.configKey.trim() || undefined,
    systemBuiltin: query.systemBuiltin === "" ? undefined : query.systemBuiltin,
    status: query.status || undefined,
    ...dateRange,
  };
}

function searchConfigs() {
  queryTableRef.value?.search();
}

async function reloadConfigs() {
  await queryTableRef.value?.reload();
}

function resetQuery() {
  query.configName = "";
  query.configKey = "";
  query.systemBuiltin = "";
  query.status = "";
  query.createdAtRange = [];
}

function handleSelectionChange(selection: PlatformSystemConfigItem[]) {
  selectedConfigs.value = selection;
}

function openCreateDialog() {
  delete form.id;
  Object.assign(form, emptyConfigForm());
  formDialogVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function openEditDialog(config: PlatformSystemConfigItem) {
  error.value = null;
  const detail = await fetchPlatformSystemConfigDetail(config.id).catch(
    (unknownError) => {
      error.value = normalizeError(unknownError);
      return null;
    },
  );
  if (!detail) {
    return;
  }
  Object.assign(form, {
    id: detail.id,
    configName: detail.configName,
    configKey: detail.configKey,
    configValue: configValueForEditor(detail.configKey, detail.configValue),
    systemBuiltin: detail.systemBuiltin,
    status: detail.status,
    remark: detail.remark ?? "",
  });
  formDialogVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
}

async function saveConfig() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  error.value = null;
  const configValue = configValueForSubmit({
    editing: editing.value,
    configKey: form.configKey,
    configValue: form.configValue,
  });
  try {
    if (editing.value && form.id) {
      await updatePlatformSystemConfig(form.id, {
        configName: form.configName,
        configValue,
        systemBuiltin: form.systemBuiltin,
        status: form.status,
        remark: form.remark,
      });
      BaseToast.success("参数已编辑");
    } else {
      await createPlatformSystemConfig({
        configName: form.configName,
        configKey: form.configKey,
        configValue,
        systemBuiltin: form.systemBuiltin,
        status: form.status,
        remark: form.remark,
      });
      BaseToast.success("参数已新增");
    }
    formDialogVisible.value = false;
    await reloadConfigs();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    saving.value = false;
  }
}

async function deleteConfig(config: PlatformSystemConfigItem) {
  if (config.systemBuiltin) {
    BaseToast.warning("内置参数不能删除");
    return;
  }
  await confirmDelete(
    [config.id],
    `确认删除参数「${config.configName}」？删除后参数列表不再展示该记录。`,
  );
}

async function deleteSelectedConfigs() {
  if (!selectedConfigs.value.length) {
    BaseToast.warning("请先选择参数");
    return;
  }
  if (selectedConfigs.value.some((config) => config.systemBuiltin)) {
    BaseToast.warning("选中的参数包含内置参数，内置参数不能删除");
    return;
  }
  await confirmDelete(
    selectedConfigs.value.map((config) => config.id),
    `确认删除选中的 ${selectedConfigs.value.length} 个参数？删除后参数列表不再展示这些记录。`,
  );
}

async function confirmDelete(configIds: number[], message: string) {
  try {
    await openConfirm({
      title: "删除参数",
      message,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformSystemConfigs(configIds);
    BaseToast.success("参数已删除");
    await reloadConfigs();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

async function refreshCache() {
  error.value = null;
  try {
    await refreshPlatformSystemConfigCache();
    BaseToast.success("参数缓存已刷新");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

async function exportConfigs() {
  exporting.value = true;
  error.value = null;
  try {
    const blob = await exportPlatformSystemConfigs(
      buildConfigQueryParams(5000, 1),
    );
    downloadBlob(blob, "参数数据.xlsx");
    BaseToast.success("参数已导出");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    exporting.value = false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function normalizeError(unknownError: unknown) {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }

  return {
    code: "FRONTEND-SYSTEM-CONFIG-001",
    message: "参数设置数据加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    title="参数设置"
    description="维护平台系统参数键值和内置标记。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryConfigs"
      row-key="id"
      fit-table-height
      empty-title="暂无匹配参数"
      empty-description="当前筛选条件下没有可展示的参数数据。"
      @reset="resetQuery"
      @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="参数名称">
            <el-input
              v-model="query.configName"
              clearable
              maxlength="128"
              placeholder="请输入参数名称"
              data-test="config-search-name"
              @keyup.enter="searchConfigs"
            />
          </el-form-item>
          <el-form-item label="参数键名">
            <el-input
              v-model="query.configKey"
              clearable
              maxlength="128"
              placeholder="请输入参数键名"
              data-test="config-search-key"
              @keyup.enter="searchConfigs"
            />
          </el-form-item>
          <el-form-item label="系统内置">
            <el-select
              v-model="query.systemBuiltin"
              clearable
              placeholder="请选择"
              data-test="config-search-builtin"
            >
              <el-option
                v-for="item in systemBuiltinOptions"
                :key="String(item.value)"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdAtRange"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          permission="system:config:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          data-test="create-config-button"
          @click="openCreateDialog"
        >
          新增
        </PermissionButton>
          <!-- permission="system:config:refresh" -->
        <PermissionButton
          variant="secondary"
          plain
          type="success"
          :icon="RefreshRight"
          data-test="refresh-config-cache-button"
          @click="refreshCache"
        >
          刷新缓存
        </PermissionButton>
        <PermissionButton
          permission="system:config:export"
          variant="secondary"
          plain
          type="warning"
          :icon="Download"
          :loading="exporting"
          data-test="export-config-button"
          @click="exportConfigs"
        >
          导出
        </PermissionButton>
        <PermissionButton
            permission="system:config:remove"
            variant="danger"
            type="danger"
            plain
            @click="deleteSelectedConfigs"
        >
          删除
        </PermissionButton>
      </template>

      <el-table-column type="selection" width="55" />
      <el-table-column prop="id" label="参数主键" width="120" />
      <el-table-column prop="configName" label="参数名称" min-width="180" />
      <el-table-column prop="configKey" label="参数键名" min-width="220" />
      <el-table-column
        prop="configValue"
        label="参数键值"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="系统内置" width="110">
        <template #default="{ row }">
          <DictTag :value="row.systemBuiltin" :options="systemBuiltinOptions" />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          <BaseDateTime :value="row.createdAt || null" />
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.remark || "-" }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="system:config:edit"
            link
            :data-test="`edit-config-${row.id}`"
            @click="openEditDialog(row)"
          >
            编辑
          </PermissionButton>
          <PermissionButton
            v-if="!row.systemBuiltin"
            permission="system:config:remove"
            link
            :data-test="`delete-config-${row.id}`"
            @click="deleteConfig(row)"
          >
            删除
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="formDialogVisible"
      :title="formDialogTitle"
      width="680px"
      :loading="saving"
      confirm-text="确定"
      compact
      :confirm-button-props="{ 'data-test': 'config-save-button' }"
      @confirm="saveConfig"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-position="top"
      >
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="参数名称" required>
              <el-input
                v-model="form.configName"
                maxlength="128"
                data-test="config-name-input"
              />
            </el-form-item>
            <el-form-item label="参数键名" required>
              <el-input
                v-model="form.configKey"
                maxlength="128"
                :disabled="editing"
                data-test="config-key-input"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="系统内置">
              <el-radio-group v-model="form.systemBuiltin">
                <el-radio :value="true">是</el-radio>
                <el-radio :value="false">否</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="参数键值" prop="configValue">
              <el-input
                v-if="sensitiveConfig"
                v-model="form.configValue"
                type="password"
                show-password
                maxlength="1000"
                autocomplete="new-password"
                data-test="config-value-input"
              />
              <el-input
                v-else
                v-model="form.configValue"
                type="textarea"
                :rows="3"
                maxlength="1000"
                show-word-limit
                data-test="config-value-input"
              />
            </el-form-item>
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                maxlength="500"
                show-word-limit
                data-test="config-remark-input"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>
    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :loading="confirmState.loading"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>
