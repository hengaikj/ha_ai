<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  createGovernanceScript,
  createGovernanceScriptDraft,
  fetchGovernanceScriptDetail,
  fetchGovernanceScripts,
  publishGovernanceScript,
  rejectGovernanceScript,
  submitGovernanceScriptReview,
  updateGovernanceScriptDraft,
} from "@/api/data-governance";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BasePromptDialog from "@/components/base/BasePromptDialog.vue";
import { useBasePromptDialog } from "@/composables/useBasePromptDialog";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import GovernanceStatusTag from "./components/GovernanceStatusTag.vue";
import {
  formatGovernanceCell,
  formatGovernanceValue,
  normalizeGovernanceError,
} from "./governance-page-utils";
import type {
  GovernanceScript,
  GovernanceScriptCreateRequest,
  GovernanceScriptDetail,
  GovernanceScriptVersion,
} from "@/types/data-governance";

type QueryTableExpose = { reload: () => Promise<void> };

const queryTableRef = ref<QueryTableExpose | null>(null);
const { promptState, openPrompt, resolvePrompt, rejectPrompt } =
  useBasePromptDialog();
const drawerVisible = ref(false);
const createDialogVisible = ref(false);
const createFormRef = ref<FormInstance>();
const loadingDetail = ref(false);
const saving = ref(false);
const detail = ref<GovernanceScriptDetail | null>(null);
const activeVersion = ref<GovernanceScriptVersion | null>(null);
const editingVersion = ref<number | null>(null);
const actionError = ref<ReturnType<typeof normalizeGovernanceError> | null>(
  null,
);
const form = reactive({ sqlContent: "", changeSummary: "" });
const createForm = reactive<GovernanceScriptCreateRequest>({
  scriptCode: "",
  scriptName: "",
  engineType: "MYSQL",
});
const createRules: FormRules<GovernanceScriptCreateRequest> = {
  scriptCode: [
    { required: true, message: "请输入脚本编码", trigger: "blur" },
    {
      pattern: /^[A-Z][A-Z0-9_]{1,63}$/,
      message: "请输入大写字母、数字或下划线组成的编码",
      trigger: "blur",
    },
  ],
  scriptName: [{ required: true, message: "请输入脚本名称", trigger: "blur" }],
};

function formatVersion(value: unknown): string {
  const displayValue = formatGovernanceValue(value);
  return displayValue === "-" ? displayValue : "V" + displayValue;
}

const drawerTitle = computed(() =>
  detail.value ? `${detail.value.script.scriptName} · 版本管理` : "SQL脚本版本",
);
async function queryScripts(pageSize: number, pageNo: number) {
  const page = await fetchGovernanceScripts({ pageNo, pageSize });
  return {
    list: page.records,
    total: page.total,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

async function saveScript() {
  if (!(await createFormRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  actionError.value = null;
  try {
    const script = await createGovernanceScript({ ...createForm });
    BaseToast.success("治理脚本已新增，请创建草稿并提交发布");
    createDialogVisible.value = false;
    await queryTableRef.value?.reload();
    await openDetail(script);
    newDraft();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "治理脚本新增失败");
  } finally {
    saving.value = false;
  }
}

async function openDetail(row: GovernanceScript) {
  drawerVisible.value = true;
  loadingDetail.value = true;
  actionError.value = null;
  try {
    detail.value = await fetchGovernanceScriptDetail(row.scriptCode);
    selectVersion(detail.value.versions[0]);
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "脚本详情加载失败");
  } finally {
    loadingDetail.value = false;
  }
}

function selectVersion(version?: GovernanceScriptVersion) {
  if (!version) return;
  activeVersion.value = version;
  editingVersion.value = null;
  form.sqlContent = version.sqlContent;
  form.changeSummary = version.changeSummary ?? "";
}

function newDraft() {
  const published = detail.value?.versions.find(
    (item) => item.status === "PUBLISHED",
  );
  activeVersion.value = null;
  editingVersion.value = 0;
  form.sqlContent = published?.sqlContent ?? "";
  form.changeSummary = "";
}

function editDraft(version: GovernanceScriptVersion) {
  selectVersion(version);
  editingVersion.value = version.versionNo;
}

async function reloadDetail() {
  if (!detail.value) return;
  detail.value = await fetchGovernanceScriptDetail(
    detail.value.script.scriptCode,
  );
  selectVersion(detail.value.versions[0]);
  await queryTableRef.value?.reload();
}

async function saveDraft() {
  if (!detail.value || !form.sqlContent.trim()) return;
  saving.value = true;
  actionError.value = null;
  try {
    const payload = {
      sqlContent: form.sqlContent,
      changeSummary: form.changeSummary || undefined,
    };
    if (editingVersion.value && editingVersion.value > 0) {
      await updateGovernanceScriptDraft(
        detail.value.script.scriptCode,
        editingVersion.value,
        payload,
      );
    } else {
      await createGovernanceScriptDraft(
        detail.value.script.scriptCode,
        payload,
      );
    }
    BaseToast.success("草稿已保存");
    await reloadDetail();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "草稿保存失败");
  } finally {
    saving.value = false;
  }
}

async function submitReview(version: GovernanceScriptVersion) {
  if (!detail.value) return;
  saving.value = true;
  try {
    await submitGovernanceScriptReview(
      detail.value.script.scriptCode,
      version.versionNo,
    );
    BaseToast.success("已提交审批");
    await reloadDetail();
  } catch (error) {
    actionError.value = normalizeGovernanceError(error, "提交审批失败");
  } finally {
    saving.value = false;
  }
}

async function review(version: GovernanceScriptVersion, publish: boolean) {
  if (!detail.value) return;
  let opinion: string;
  try {
    opinion = await openPrompt({
      title: publish ? "发布版本" : "驳回版本",
      label: publish ? "发布意见" : "驳回原因",
      inputType: "textarea",
      confirmText: publish ? "发布" : "确认驳回",
      required: !publish,
      validator: (value) => publish || Boolean(value) || "请输入驳回原因",
    });
    saving.value = true;
    if (publish) {
      await publishGovernanceScript(
        detail.value.script.scriptCode,
        version.versionNo,
        opinion,
      );
      BaseToast.success(`版本 V${version.versionNo} 已发布`);
    } else {
      await rejectGovernanceScript(
        detail.value.script.scriptCode,
        version.versionNo,
        opinion,
      );
      BaseToast.success(`版本 V${version.versionNo} 已驳回`);
    }
    await reloadDetail();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    actionError.value = normalizeGovernanceError(error, "审批操作失败");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <PageContainer class="governance-page" title="SQL脚本">
    <TraceErrorAlert
      v-if="actionError && !drawerVisible"
      v-bind="actionError"
    />
    <QueryTable
      ref="queryTableRef"
      :func="queryScripts"
      :show-search="false"
      show-toolbar
      fit-table-height
      empty-title="暂无SQL脚本"
      empty-description="当前没有已登记的治理脚本。"
    >
      <el-table-column
        prop="scriptName"
        label="脚本名称"
        min-width="180"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="scriptCode"
        label="脚本编码"
        min-width="230"
        :formatter="formatGovernanceCell"
      />
      <el-table-column
        prop="engineType"
        label="执行引擎"
        width="110"
        :formatter="formatGovernanceCell"
      />
      <el-table-column label="当前版本" width="110">
        <template #default="{ row }">
          {{ formatVersion(row.currentVersion) }}
        </template>
      </el-table-column>
      <el-table-column label="作业状态" width="100">
        <template #default="{ row }">
          <GovernanceStatusTag :status="row.enabled" />
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="170">
        <template #default="{ row }"
          ><BaseDateTime :value="row.updateTime" empty-text="-"
        /></template>
      </el-table-column>
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <PermissionButton
            link
            permission="data:governance:script:view"
            @click="openDetail(row)"
            >版本管理</PermissionButton
          >
        </template>
      </el-table-column>
    </QueryTable>

    <el-drawer v-model="drawerVisible" :title="drawerTitle" size="82%">
      <div v-loading="loadingDetail" class="script-workspace">
        <TraceErrorAlert v-if="actionError" v-bind="actionError" />
        <div class="script-toolbar">
          <PermissionButton
            permission="data:governance:script:add"
            type="primary"
            @click="newDraft"
            >新建草稿</PermissionButton
          >
          <span class="script-current">
            当前发布版本 {{ formatVersion(detail?.script.currentVersion) }}
          </span>
        </div>

        <el-table
          :data="detail?.versions ?? []"
          height="260"
          highlight-current-row
          @current-change="selectVersion"
        >
          <el-table-column label="版本" width="80">
            <template #default="{ row }">{{
              formatVersion(row.versionNo)
            }}</template>
          </el-table-column>
          <el-table-column label="版本状态" width="100">
            <template #default="{ row }"
              ><GovernanceStatusTag :status="row.status"
            /></template>
          </el-table-column>
          <el-table-column
            prop="changeSummary"
            label="变更说明"
            min-width="180"
            :formatter="formatGovernanceCell"
          />
          <el-table-column
            prop="createdBy"
            label="创建人"
            width="120"
            :formatter="formatGovernanceCell"
          />
          <el-table-column
            prop="reviewedBy"
            label="审批人"
            width="120"
            :formatter="formatGovernanceCell"
          />
          <el-table-column label="更新时间" width="170">
            <template #default="{ row }"
              ><BaseDateTime :value="row.updateTime" empty-text="-"
            /></template>
          </el-table-column>
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <div class="bq-table-actions">
                <PermissionButton
                  v-if="row.status === 'DRAFT' || row.status === 'REJECTED'"
                  link
                  permission="data:governance:script:edit"
                  @click.stop="editDraft(row)"
                  >编辑</PermissionButton
                >
                <PermissionButton
                  v-if="row.status === 'DRAFT' || row.status === 'REJECTED'"
                  link
                  permission="data:governance:script:edit"
                  @click.stop="submitReview(row)"
                  >提交审批</PermissionButton
                >
                <PermissionButton
                  v-if="row.status === 'REVIEWING'"
                  link
                  permission="data:governance:script:review"
                  @click.stop="review(row, true)"
                  >发布</PermissionButton
                >
                <PermissionButton
                  v-if="row.status === 'REVIEWING'"
                  link
                  type="danger"
                  permission="data:governance:script:review"
                  @click.stop="review(row, false)"
                  >驳回</PermissionButton
                >
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="script-editor-header">
          <strong>{{
            editingVersion === 0
              ? "新草稿"
              : activeVersion
                ? formatVersion(activeVersion.versionNo)
                : "SQL"
          }}</strong>
          <GovernanceStatusTag
            v-if="activeVersion"
            :status="activeVersion.status"
          />
        </div>
        <el-input
          v-model="form.changeSummary"
          :disabled="editingVersion === null"
          maxlength="500"
          placeholder="变更说明"
        />
        <el-input
          v-model="form.sqlContent"
          class="sql-editor"
          type="textarea"
          :rows="18"
          resize="vertical"
          spellcheck="false"
          :readonly="editingVersion === null"
        />
        <div v-if="editingVersion !== null" class="script-editor-actions">
          <PermissionButton
            permission="data:governance:script:edit"
            type="primary"
            :loading="saving"
            @click="saveDraft"
            >保存草稿</PermissionButton
          >
          <el-button @click="editingVersion = null">取消</el-button>
        </div>
      </div>
    </el-drawer>
    <BaseFormDialog
      v-model="createDialogVisible"
      title="新增治理脚本"
      :loading="saving"
      @confirm="saveScript"
    >
      <TraceErrorAlert v-if="actionError" v-bind="actionError" />
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-position="top"
      >
        <el-form-item label="脚本编码" prop="scriptCode">
          <el-input v-model="createForm.scriptCode" maxlength="64" />
        </el-form-item>
        <el-form-item label="脚本名称" prop="scriptName">
          <el-input v-model="createForm.scriptName" maxlength="128" />
        </el-form-item>
        <el-form-item label="执行引擎">
          <el-input model-value="MYSQL" disabled />
        </el-form-item>
      </el-form>
    </BaseFormDialog>
    <BasePromptDialog
      v-model="promptState.visible"
      v-model:value="promptState.value"
      :title="promptState.title"
      :label="promptState.label"
      :placeholder="promptState.placeholder"
      :input-type="promptState.inputType"
      :confirm-text="promptState.confirmText"
      :cancel-text="promptState.cancelText"
      :error="promptState.error"
      :loading="promptState.loading"
      :required="promptState.required"
      @confirm="resolvePrompt"
      @cancel="rejectPrompt"
    />
  </PageContainer>
</template>

<style scoped>
.script-workspace {
  min-height: 70vh;
}
.script-toolbar,
.script-editor-header,
.script-editor-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.script-toolbar {
  justify-content: space-between;
  margin-bottom: 12px;
}
.script-current {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.script-editor-header {
  margin: 18px 0 10px;
}
.sql-editor {
  margin-top: 10px;
}
.sql-editor :deep(textarea) {
  font-family: "JetBrains Mono", "Cascadia Code", monospace;
  font-size: 13px;
  line-height: 1.6;
  tab-size: 2;
}
.script-editor-actions {
  justify-content: flex-end;
  margin-top: 12px;
}
@media (max-width: 768px) {
  .script-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
