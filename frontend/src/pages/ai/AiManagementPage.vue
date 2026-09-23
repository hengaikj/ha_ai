<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import BasePageHeader from "@/components/base/BasePageHeader.vue";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import ForbiddenPage from "@/pages/ForbiddenPage.vue";
import { useAuthStore } from "@/stores/auth";
import { useAiDemoStore } from "@/stores/ai-demo";
import {
  createMockManagementService,
  isAiMockEnabled,
  type MockState,
} from "@/api/ai/mock";
import { createHttpManagementService, managementDecoders } from "@/api/ai/http";
import {
  ManagementError,
  allowedKeyActions,
  type ProjectSummary,
  type ApiKeySummary,
  type UsageSummary,
  type ProjectInput,
  type ApiKeyInput,
  type KeyAction,
  createTemporaryProjectContextAdapter,
} from "@/api/ai/types";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const kind = computed(() =>
  route.name === "AiProjectApiKeys"
    ? "keys"
    : route.name === "AiUsage"
      ? "usage"
      : "projects",
);
const title = computed(
  () =>
    ({ projects: "项目/应用", keys: "API Key", usage: "调用记录" })[kind.value],
);
const projectId = computed(() => String(route.params.projectId || ""));
const projectContext = createTemporaryProjectContextAdapter(
  () => projectId.value,
);
const mock = isAiMockEnabled();
const mockStates: MockState[] = [
  "normal",
  "empty",
  "loading",
  "400",
  "401",
  "403",
  "404",
  "409",
  "500",
];
const mockState = () =>
  mockStates.includes(route.query.mockState as MockState)
    ? (route.query.mockState as MockState)
    : "normal";
const service = computed(() => mock
  ? createMockManagementService(mockState, useAiDemoStore().data)
  : createHttpManagementService(managementDecoders));
// 权限码未获正式映射；只在显式 Mock 模式开放交互演示，真实写操作保持禁用。
const canWrite = computed(() =>
  kind.value === "keys"
    ? !mock || route.query.mockReadonly !== "true"
    : mock && route.query.mockReadonly !== "true",
);
const projects = ref<ProjectSummary[]>([]);
const keys = ref<ApiKeySummary[]>([]);
const usage = ref<UsageSummary[]>([]);
const loading = ref(false);
const saving = ref(false);
const busyKey = ref("");
const error = ref<ManagementError | null>(null);
const formError = ref<ManagementError | null>(null);
const dialog = ref(false);
const secret = ref("");
const projectForm = ref<ProjectInput>({
  projectCode: "",
  projectName: "",
  entitlementMode: "BALANCE",
});
const keyForm = ref<ApiKeyInput>({ keyName: "", expiresAt: null });
const formReady = computed(() =>
  kind.value === "projects"
    ? Boolean(
        projectForm.value.projectCode.trim() &&
        projectForm.value.projectName.trim(),
      )
    : Boolean(keyForm.value.keyName.trim()),
);
let generation = 0;
function normalizedError(value: unknown) {
  return value instanceof ManagementError
    ? value
    : new ManagementError(0, "REQUEST_FAILED", "请求失败，请稍后重试。");
}
async function handleError(value: unknown, form = false) {
  const result = normalizedError(value);
  if (result.status === 401) {
    secret.value = "";
    auth.expireSession();
    await router.replace({
      name: "login",
      query: { redirect: route.fullPath },
    });
    return;
  }
  if (form) formError.value = result;
  else error.value = result;
}
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = null;
  projects.value = [];
  keys.value = [];
  usage.value = [];
  try {
    if (kind.value === "projects") {
      const rows = await service.value.projects();
      if (current === generation) projects.value = rows;
    } else if (kind.value === "keys") {
      const rows = await service.value.keys(projectId.value);
      if (current === generation) keys.value = rows;
    } else {
      const rows = await service.value.usage();
      if (current === generation) usage.value = rows;
    }
  } catch (e) {
    if (current === generation) await handleError(e);
  } finally {
    if (current === generation) loading.value = false;
  }
}
function openCreate() {
  if (!canWrite.value) return;
  projectForm.value = {
    projectCode: "",
    projectName: "",
    entitlementMode: "BALANCE",
  };
  keyForm.value = { keyName: "", expiresAt: null };
  formError.value = null;
  dialog.value = true;
}
async function save() {
  if (saving.value || !canWrite.value || !formReady.value) return;
  saving.value = true;
  formError.value = null;
  const current = generation;
  try {
    if (kind.value === "projects")
      await service.value.createProject({ ...projectForm.value });
    else {
      const value = await service.value.createKey(projectId.value, {
        ...keyForm.value,
      });
      // 离开页面后到达的响应不得重新显示 Secret。
      if (current !== generation) return;
      secret.value = value;
    }
    if (current !== generation) return;
    dialog.value = false;
    await load();
  } catch (e) {
    if (current === generation) await handleError(e, true);
  } finally {
    saving.value = false;
  }
}
async function changeKey(row: ApiKeySummary, action: KeyAction) {
  if (
    busyKey.value ||
    !canWrite.value ||
    !allowedKeyActions(row.status).includes(action)
  )
    return;
  busyKey.value = row.apiKeyId;
  try {
    await ElMessageBox.confirm(
      action === "revoke"
        ? "撤销后将无法恢复，请确认。"
        : `确认${action === "enable" ? "启用" : "禁用"}此 API Key？`,
      "确认操作",
      { confirmButtonText: "确认", cancelButtonText: "取消", type: "warning" },
    );
    await service.value.changeKey(projectContext, row.apiKeyId, action);
    await load();
  } catch (e) {
    if (e !== "cancel" && e !== "close") await handleError(e);
  } finally {
    busyKey.value = "";
  }
}
async function copySecret() {
  if (!secret.value) return;
  try {
    await navigator.clipboard.writeText(secret.value);
    ElMessage.success("已复制");
  } catch {
    ElMessage.error("复制失败，请手动复制");
  }
}
function openKeys(id: string) {
  void router.push({ name: "AiProjectApiKeys", params: { projectId: id } });
}
function openModels(id: string) {
  void router.push({ name: "AiProjectModels", params: { projectId: id } });
}
watch(
  () => route.fullPath,
  () => {
    secret.value = "";
    dialog.value = false;
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  ++generation;
  secret.value = "";
});
</script>

<template>
  <section class="ai-management bq-management-page">
    <BasePageHeader :title="title">
      <div class="ai-actions">
        <el-button v-if="kind === 'keys'" @click="router.push('/ai/projects')"
          >返回项目</el-button
        >
        <el-button :loading="loading" @click="load">刷新</el-button>
        <PermissionButton
          v-if="kind !== 'usage'"
          type="primary"
          :disabled="!canWrite || loading || Boolean(error)"
          @click="openCreate"
        >
          {{ kind === "projects" ? "创建项目" : "创建 API Key" }}
        </PermissionButton>
      </div>
    </BasePageHeader>
    <p class="ai-description" v-if="kind === 'projects'">
      管理项目/应用及其权益模式，进入项目管理 API Key。
    </p>
    <p class="ai-description" v-else-if="kind === 'keys'">
      项目：{{ projectId }}。完整 Secret 仅在创建成功时展示一次。
    </p>
    <p class="ai-description" v-else>查看请求的执行、交付与计费结果。</p>
    <template v-if="error">
      <ForbiddenPage v-if="error.status === 403" />
      <BaseEmpty
        v-else-if="error.status === 404"
        title="资源不存在"
        description="该资源不存在或已无法访问。"
      />
      <TraceErrorAlert
        :code="error.code"
        :message="error.message"
        :trace-id="error.traceId"
      />
      <el-button
        class="ai-return"
        v-if="error.status === 404"
        @click="router.push('/ai/projects')"
        >返回项目</el-button
      >
    </template>
    <BaseDataTable
      v-else-if="kind === 'projects'"
      :data="projects"
      :loading="loading"
      row-key="projectId"
      empty-title="暂无项目"
      empty-description="创建项目后，可在项目中管理 API Key。"
    >
      <el-table-column prop="projectCode" label="项目编码" min-width="150" />
      <el-table-column prop="projectName" label="项目名称" min-width="180" />
      <el-table-column prop="entitlementMode" label="权益模式" min-width="140"
        ><template #default="{ row }">{{
          row.entitlementMode === "BALANCE" ? "余额" : "订阅"
        }}</template></el-table-column
      >
      <el-table-column prop="status" label="状态" min-width="140" />
      <el-table-column label="操作" min-width="220"
        ><template #default="{ row }"
          ><PermissionButton
            link
            type="primary"
            @click="openKeys(row.projectId)"
            >API Key</PermissionButton
          ><PermissionButton
            link
            type="primary"
            @click="openModels(row.projectId)"
            >模型权限</PermissionButton
          ></template
        ></el-table-column
      >
    </BaseDataTable>
    <BaseDataTable
      v-else-if="kind === 'keys'"
      :data="keys"
      :loading="loading"
      row-key="apiKeyId"
      empty-title="暂无 API Key"
      empty-description="创建 API Key 后，仅可再次查看前缀。"
    >
      <el-table-column prop="keyPrefix" label="Key 前缀" min-width="160" />
      <el-table-column prop="status" label="状态" min-width="120" />
      <el-table-column prop="createdAt" label="创建时间" min-width="210" />
      <el-table-column prop="expiresAt" label="过期时间" min-width="210"
        ><template #default="{ row }">{{
          row.expiresAt || "未设置"
        }}</template></el-table-column
      >
      <el-table-column label="操作" min-width="180"
        ><template #default="{ row }">
          <PermissionButton
            v-for="action in allowedKeyActions(row.status)"
            :key="action"
            link
            :type="action === 'revoke' ? 'danger' : 'primary'"
            :disabled="!canWrite || Boolean(busyKey)"
            :loading="busyKey === row.apiKeyId"
            @click="changeKey(row, action)"
            >{{
              { enable: "启用", disable: "禁用", revoke: "撤销" }[action]
            }}</PermissionButton
          >
        </template></el-table-column
      >
    </BaseDataTable>
    <BaseDataTable
      v-else
      :data="usage"
      :loading="loading"
      row-key="requestId"
      empty-title="暂无调用记录"
      empty-description="当前没有可展示的请求记录。"
    >
      <el-table-column prop="requestId" label="请求 ID" min-width="190" />
      <el-table-column prop="projectId" label="项目 ID" min-width="160" />
      <el-table-column prop="model" label="模型" min-width="150" />
      <el-table-column
        prop="executionResult"
        label="执行结果"
        min-width="180"
      />
      <el-table-column prop="deliveryResult" label="交付结果" min-width="180" />
      <el-table-column prop="billingResult" label="计费结果" min-width="180" />
      <el-table-column prop="createdAt" label="创建时间" min-width="210" />
    </BaseDataTable>
    <el-dialog
      v-model="dialog"
      :title="kind === 'projects' ? '创建项目' : '创建 API Key'"
      width="min(480px, calc(100vw - 32px))"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      destroy-on-close
    >
      <TraceErrorAlert
        v-if="formError"
        :code="formError.code"
        :message="formError.message"
        :trace-id="formError.traceId"
      />
      <el-form label-position="top" :disabled="saving" @submit.prevent="save">
        <template v-if="kind === 'projects'">
          <el-form-item label="项目编码" required
            ><el-input v-model="projectForm.projectCode" aria-label="项目编码"
          /></el-form-item>
          <el-form-item label="项目名称" required
            ><el-input v-model="projectForm.projectName" aria-label="项目名称"
          /></el-form-item>
          <el-form-item label="权益模式" required
            ><el-select
              v-model="projectForm.entitlementMode"
              aria-label="权益模式"
              ><el-option label="余额" value="BALANCE" /><el-option
                label="订阅"
                value="SUBSCRIPTION" /></el-select
          ></el-form-item>
        </template>
        <template v-else>
          <el-form-item label="Key 名称" required
            ><el-input v-model="keyForm.keyName" aria-label="Key 名称"
          /></el-form-item>
          <el-form-item label="过期时间（可选）"
            ><el-date-picker
              v-model="keyForm.expiresAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ssZ"
              placeholder="选择过期时间"
          /></el-form-item>
        </template>
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="dialog = false">取消</el-button
        ><PermissionButton
          type="primary"
          :loading="saving"
          :disabled="!formReady || !canWrite"
          @click="save"
          >保存</PermissionButton
        ></template
      >
    </el-dialog>
    <el-dialog
      :model-value="Boolean(secret)"
      title="一次性API Key"
      width="min(560px, calc(100vw - 32px))"
      :close-on-click-modal="false"
      destroy-on-close
      @update:model-value="secret = ''"
    >
      <el-alert
        title="请立即复制并妥善保存。关闭后将无法再次查看完整密钥。"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-input
        class="ai-secret"
        :model-value="secret"
        readonly
        aria-label="一次性 Secret"
        autocomplete="off"
      />
      <template #footer
        ><el-button @click="copySecret">复制 Secret</el-button
        ><el-button type="primary" @click="secret = ''"
          >我已保存，关闭</el-button
        ></template
      >
    </el-dialog>
  </section>
</template>
<style scoped>
.ai-management {
  padding: 0 24px 24px;
  min-width: 0;
  background: var(--bq-color-surface);
}
.ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ai-actions .el-button + .el-button {
  margin-left: 0;
}
.ai-description {
  margin: 20px 0;
  color: var(--bq-color-text-secondary);
  font-size: 13px;
}
.ai-secret,
.ai-return {
  margin-top: 16px;
}
.el-form {
  margin-top: 16px;
}
@media (max-width: 768px) {
  .ai-management :deep(.base-page-title) {
    height: auto;
    min-height: 60px;
    padding-top: 12px;
    padding-bottom: 12px;
    gap: 12px;
    flex-wrap: wrap;
  }
}
</style>
