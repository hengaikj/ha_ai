<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import BasePageHeader from "@/components/base/BasePageHeader.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import {
  createMockProjectService,
  type ProjectInput,
  type ProjectSummary,
} from "@/api/ai/project-mock";
import { createHttpProjectService } from "@/api/ai/project-http";

const route = useRoute();
const router = useRouter();
const useMock = import.meta.env.VITE_ENABLE_AI_MOCK === "true";
const service = useMock
  ? createMockProjectService(() => String(route.query.mockState || "normal"))
  : createHttpProjectService();
const rows = ref<ProjectSummary[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialog = ref(false);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const formError = ref<typeof error.value>(null);
const form = ref<ProjectInput>({
  projectCode: "",
  projectName: "",
  entitlementMode: "BALANCE",
});
const canWrite = computed(
  () => !useMock || route.query.mockReadonly !== "true",
);
const ready = computed(() =>
  Boolean(form.value.projectCode.trim() && form.value.projectName.trim()),
);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await service.list();
  } catch (e) {
    error.value = normalizeError(e);
  } finally {
    loading.value = false;
  }
}
function normalizeError(e: unknown) {
  const value = e as {
    status?: number;
    code?: string;
    message?: string;
    traceId?: string;
  };
  return {
    code: value.code || "REQUEST_FAILED",
    message: value.message || "请求失败，请稍后重试。",
    traceId: value.traceId,
  };
}
function openCreate() {
  if (!canWrite.value) return;
  form.value = { projectCode: "", projectName: "", entitlementMode: "BALANCE" };
  formError.value = null;
  dialog.value = true;
}
async function save() {
  if (saving.value || !ready.value || !canWrite.value) return;
  saving.value = true;
  formError.value = null;
  try {
    await service.create({ ...form.value });
    dialog.value = false;
    await load();
  } catch (e) {
    formError.value = normalizeError(e);
  } finally {
    saving.value = false;
  }
}
watch(() => route.fullPath, load, { immediate: true });
</script>

<template>
  <section class="project-page bq-management-page">
    <BasePageHeader title="项目/应用">
      <div class="project-actions">
        <el-button :loading="loading" @click="load">刷新</el-button>
        <PermissionButton
          type="primary"
          :disabled="!canWrite || Boolean(error)"
          @click="openCreate"
          >创建项目</PermissionButton
        >
      </div>
    </BasePageHeader>
    <p class="project-help">管理企业项目及其权益模式。</p>
    <template v-if="error">
      <TraceErrorAlert
        :code="error.code"
        :message="error.message"
        :trace-id="error.traceId"
      />
      <el-button
        v-if="error.code === 'MOCK_NOT_FOUND'"
        @click="router.push('/ai/projects')"
        >返回项目</el-button
      >
    </template>
    <BaseDataTable
      v-else
      :data="rows"
      :loading="loading"
      row-key="projectId"
      empty-title="暂无项目"
      empty-description="创建项目后，项目会显示在这里。"
    >
      <el-table-column prop="projectCode" label="项目编码" min-width="160" />
      <el-table-column prop="projectName" label="项目名称" min-width="200" />
      <el-table-column prop="entitlementMode" label="权益模式" min-width="140"
        ><template #default="{ row }">{{
          row.entitlementMode === "BALANCE" ? "余额" : "订阅"
        }}</template></el-table-column
      >
      <el-table-column prop="status" label="状态" min-width="140" />
      <el-table-column label="操作" min-width="120">
        <template #default="{ row }">
          <PermissionButton link type="primary" @click="router.push({ name: 'AiProjectApiKeys', params: { projectId: row.projectId } })">
            API Key
          </PermissionButton>
        </template>
      </el-table-column>
    </BaseDataTable>
    <el-dialog
      v-model="dialog"
      title="创建项目"
      width="min(480px, calc(100vw - 32px))"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <TraceErrorAlert
        v-if="formError"
        :code="formError.code"
        :message="formError.message"
        :trace-id="formError.traceId"
      />
      <el-form label-position="top" :disabled="saving">
        <el-form-item label="项目编码" required
          ><el-input v-model="form.projectCode" aria-label="项目编码"
        /></el-form-item>
        <el-form-item label="项目名称" required
          ><el-input v-model="form.projectName" aria-label="项目名称"
        /></el-form-item>
        <el-form-item label="权益模式" required
          ><el-select v-model="form.entitlementMode" aria-label="权益模式"
            ><el-option label="余额" value="BALANCE" /><el-option
              label="订阅"
              value="SUBSCRIPTION" /></el-select
        ></el-form-item>
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="dialog = false">取消</el-button
        ><PermissionButton
          type="primary"
          :loading="saving"
          :disabled="!ready || !canWrite"
          @click="save"
          >保存</PermissionButton
        ></template
      >
    </el-dialog>
  </section>
</template>

<style scoped>
.project-page {
  padding: 0 24px 24px;
  min-width: 0;
  background: var(--bq-color-surface);
}
.project-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.project-actions .el-button + .el-button {
  margin-left: 0;
}
.project-help {
  margin: 20px 0;
  color: var(--bq-color-text-secondary);
  font-size: 13px;
}
@media (max-width: 768px) {
  .project-page :deep(.base-page-title) {
    height: auto;
    min-height: 60px;
    padding-top: 12px;
    padding-bottom: 12px;
    gap: 12px;
    flex-wrap: wrap;
  }
}
</style>
