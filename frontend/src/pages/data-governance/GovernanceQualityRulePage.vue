<script setup lang="ts">
import { reactive, ref } from "vue";
import {
  fetchGovernanceQualityRules,
  updateGovernanceQualityRule,
} from "@/api/data-governance";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import GovernanceStatusTag from "./components/GovernanceStatusTag.vue";
import {
  formatGovernanceCell,
  normalizeGovernanceError,
} from "./governance-page-utils";
import type {
  GovernanceQualityRule,
  GovernanceQualityRuleRequest,
} from "@/types/data-governance";

type QueryTableExpose = { reload: () => Promise<void> };

const queryTableRef = ref<QueryTableExpose | null>(null);
const saving = ref(false);
const dialog = ref(false);
const confirmVisible = ref(false);
const active = ref<GovernanceQualityRule | null>(null);
const actionError = ref<ReturnType<typeof normalizeGovernanceError> | null>(
  null,
);
const form = reactive<GovernanceQualityRuleRequest>({
  severity: "WARN",
  thresholdValue: 0,
  enabled: true,
});

async function queryRules(pageSize: number, pageNum: number) {
  const page = await fetchGovernanceQualityRules({ pageNo: pageNum, pageSize });
  return {
    list: page.records,
    total: page.total,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function edit(row: GovernanceQualityRule) {
  actionError.value = null;
  active.value = row;
  Object.assign(form, {
    severity: row.severity,
    thresholdValue: row.thresholdValue,
    enabled: row.enabled,
  });
  dialog.value = true;
}

function askSave() {
  if (form.severity === "ERROR") {
    confirmVisible.value = true;
    return;
  }
  void save();
}

async function save() {
  if (!active.value) return;
  saving.value = true;
  actionError.value = null;
  try {
    await updateGovernanceQualityRule(active.value.ruleCode, { ...form });
    BaseToast.success("质量规则已更新");
    dialog.value = false;
    confirmVisible.value = false;
    await queryTableRef.value?.reload();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "质量规则更新失败");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <PageContainer
    class="governance-page"
    title="质量规则"
    description="配置数据质量校验级别、失败阈值与启用状态。"
  >
    <TraceErrorAlert v-if="actionError && !dialog" v-bind="actionError" />
    <QueryTable
      ref="queryTableRef"
      :func="queryRules"
      :show-search="false"
      show-toolbar
      fit-table-height
      empty-title="暂无质量规则"
      empty-description="当前没有可配置的数据质量规则。"
    >
      <el-table-column
        prop="ruleName"
        label="规则名称"
        min-width="160"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="ruleCode"
        label="规则编码"
        min-width="170"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="targetTable"
        label="目标表"
        min-width="180"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="严重级别" width="100">
        <template #default="{ row }"
          ><GovernanceStatusTag :status="row.severity"
        /></template>
      </el-table-column>
      <el-table-column
        prop="thresholdValue"
        label="允许失败阈值"
        width="130"
        align="right"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="规则状态" width="90">
        <template #default="{ row }"
          ><GovernanceStatusTag :status="row.enabled"
        /></template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="170">
        <template #default="{ row }"
          ><BaseDateTime :value="row.updateTime" empty-text="-"
        /></template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <div class="bq-table-actions">
            <PermissionButton
              link
              permission="data:governance:quality:update"
              @click="edit(row)"
              >编辑</PermissionButton
            >
          </div>
        </template>
      </el-table-column>
    </QueryTable>
    <BaseFormDialog
      v-model="dialog"
      title="编辑质量规则"
      :loading="saving"
      @confirm="askSave"
    >
      <TraceErrorAlert v-if="actionError" v-bind="actionError" />
      <el-form label-position="top">
        <el-form-item label="规则编码"
          ><el-input :model-value="active?.ruleCode" disabled clearable
        /></el-form-item>
        <el-form-item label="规则名称"
          ><el-input :model-value="active?.ruleName" disabled clearable
        /></el-form-item>
        <el-form-item label="目标表"
          ><el-input :model-value="active?.targetTable" disabled clearable
        /></el-form-item>
        <el-form-item label="严重级别">
          <el-select v-model="form.severity" clearable>
            <el-option label="警告" value="WARN" />
            <el-option label="阻断" value="ERROR" />
          </el-select>
        </el-form-item>
        <el-form-item label="失败阈值">
          <el-input-number v-model="form.thresholdValue" :min="0" />
        </el-form-item>
        <el-form-item label="启用状态"
          ><el-switch v-model="form.enabled"
        /></el-form-item>
      </el-form>
    </BaseFormDialog>
    <BaseConfirm
      v-model="confirmVisible"
      title="阻断规则确认"
      message="ERROR 级规则超过阈值将阻止治理结果发布，确认保存当前配置？"
      type="warning"
      :loading="saving"
      @confirm="save"
    />
  </PageContainer>
</template>
