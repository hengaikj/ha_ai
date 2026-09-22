<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BasePageHeader from "@/components/base/BasePageHeader.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import {
  createPlatformAiService,
  platformAiDecoders,
  type Channel,
  type LogicalModel,
  type Provider,
  type LogicalModelInput,
  type ProviderInput,
  type ChannelInput,
} from "@/api/ai/platform";
import PermissionButton from "@/components/security/PermissionButton.vue";

type Kind = "models" | "providers" | "channels";
const props = defineProps<{ title: string; kind: Kind }>();
const rows = ref<Array<LogicalModel | Provider | Channel>>([]);
const rowKey = computed(() =>
  props.kind === "models"
    ? "logicalModelId"
    : props.kind === "providers"
      ? "providerId"
      : "channelId",
);
const loading = ref(false);
const error = ref<{ code: string; message: string } | null>(null);
const service = createPlatformAiService(platformAiDecoders);
const dialog = ref(false);
const saving = ref(false);
const formError = ref<{ code: string; message: string } | null>(null);
const modelForm = ref<LogicalModelInput>({ modelCode: "", modelName: "" });
const providerForm = ref<ProviderInput>({
  providerCode: "",
  providerName: "",
  adapterCode: "",
});
const formReady = computed(() =>
  Boolean(modelForm.value.modelCode.trim() && modelForm.value.modelName.trim()),
);
const providerFormReady = computed(() =>
  Boolean(
    providerForm.value.providerCode.trim() &&
    providerForm.value.providerName.trim() &&
    providerForm.value.adapterCode.trim(),
  ),
);
const channelForm = ref<ChannelInput>({
  providerId: "",
  channelCode: "",
  channelName: "",
  endpoint: "",
  credentialRef: "",
});
const channelFormReady = computed(() =>
  Boolean(
    channelForm.value.providerId.trim() &&
    channelForm.value.channelCode.trim() &&
    channelForm.value.channelName.trim() &&
    channelForm.value.endpoint.trim() &&
    channelForm.value.credentialRef.trim(),
  ),
);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await service[props.kind]();
  } catch (value) {
    const result = value as { code?: string; message?: string };
    error.value = {
      code: result.code || "REQUEST_FAILED",
      message: result.message || "平台 AI 数据暂时无法加载。",
    };
  } finally {
    loading.value = false;
  }
}

onMounted(load);
function openCreate() {
  modelForm.value = { modelCode: "", modelName: "" };
  providerForm.value = { providerCode: "", providerName: "", adapterCode: "" };
  channelForm.value = {
    providerId: "",
    channelCode: "",
    channelName: "",
    endpoint: "",
    credentialRef: "",
  };
  formError.value = null;
  dialog.value = true;
}
async function createModel() {
  if (!formReady.value || saving.value) return;
  saving.value = true;
  formError.value = null;
  try {
    await service.createModel({ ...modelForm.value });
    dialog.value = false;
    await load();
  } catch (value) {
    const result = value as { code?: string; message?: string };
    formError.value = {
      code: result.code || "REQUEST_FAILED",
      message: result.message || "创建模型失败。",
    };
  } finally {
    saving.value = false;
  }
}
async function createProvider() {
  if (!providerFormReady.value || saving.value) return;
  saving.value = true;
  formError.value = null;
  try {
    await service.createProvider({ ...providerForm.value });
    dialog.value = false;
    await load();
  } catch (value) {
    const result = value as { code?: string; message?: string };
    formError.value = {
      code: result.code || "REQUEST_FAILED",
      message: result.message || "创建 Provider 失败。",
    };
  } finally {
    saving.value = false;
  }
}
async function createChannel() {
  if (!channelFormReady.value || saving.value) return;
  saving.value = true;
  formError.value = null;
  try {
    await service.createChannel({ ...channelForm.value });
    dialog.value = false;
    await load();
  } catch (value) {
    const result = value as { code?: string; message?: string };
    formError.value = {
      code: result.code || "REQUEST_FAILED",
      message: result.message || "创建渠道失败。",
    };
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="platform-ai-list bq-management-page">
    <BasePageHeader :title="props.title">
      <el-button :loading="loading" @click="load">刷新</el-button>
      <PermissionButton
        v-if="
          props.kind === 'models' ||
          props.kind === 'providers' ||
          props.kind === 'channels'
        "
        type="primary"
        :disabled="loading"
        @click="openCreate"
        >{{
          props.kind === "models"
            ? "创建模型"
            : props.kind === "providers"
              ? "创建 Provider"
              : "创建渠道"
        }}</PermissionButton
      >
    </BasePageHeader>
    <TraceErrorAlert v-if="error" :code="error.code" :message="error.message" />
    <BaseEmpty
      v-else-if="!loading && rows.length === 0"
      title="暂无数据"
      description="当前平台接口没有返回可展示的数据。"
    />
    <BaseDataTable v-else :data="rows" :loading="loading" :row-key="rowKey">
      <template v-if="props.kind === 'models'">
        <el-table-column prop="modelCode" label="模型编码" min-width="180" />
        <el-table-column prop="modelName" label="模型名称" min-width="180" />
        <el-table-column prop="status" label="状态" min-width="120" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="210" />
      </template>
      <template v-else-if="props.kind === 'providers'">
        <el-table-column
          prop="providerCode"
          label="Provider 编码"
          min-width="180"
        />
        <el-table-column
          prop="providerName"
          label="Provider 名称"
          min-width="180"
        />
        <el-table-column prop="adapterCode" label="适配器" min-width="160" />
        <el-table-column prop="status" label="状态" min-width="120" />
      </template>
      <template v-else>
        <el-table-column prop="channelCode" label="渠道编码" min-width="160" />
        <el-table-column prop="channelName" label="渠道名称" min-width="180" />
        <el-table-column prop="endpoint" label="Endpoint" min-width="260" />
        <el-table-column prop="priority" label="优先级" min-width="100" />
        <el-table-column prop="weight" label="权重" min-width="100" />
        <el-table-column prop="status" label="状态" min-width="120" />
      </template>
    </BaseDataTable>
    <el-dialog
      v-model="dialog"
      :title="
        props.kind === 'models'
          ? '创建逻辑模型'
          : props.kind === 'providers'
            ? '创建 Provider'
            : '创建渠道'
      "
      width="min(480px, calc(100vw - 32px))"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <TraceErrorAlert
        v-if="formError"
        :code="formError.code"
        :message="formError.message"
      />
      <el-form label-position="top" :disabled="saving">
        <template v-if="props.kind === 'models'">
          <el-form-item label="模型编码" required
            ><el-input v-model="modelForm.modelCode"
          /></el-form-item>
          <el-form-item label="模型名称" required
            ><el-input v-model="modelForm.modelName"
          /></el-form-item>
        </template>
        <template v-else-if="props.kind === 'providers'">
          <el-form-item label="Provider 编码" required
            ><el-input v-model="providerForm.providerCode"
          /></el-form-item>
          <el-form-item label="Provider 名称" required
            ><el-input v-model="providerForm.providerName"
          /></el-form-item>
          <el-form-item label="适配器编码" required
            ><el-input v-model="providerForm.adapterCode"
          /></el-form-item>
        </template>
        <template v-else>
          <el-form-item label="Provider ID" required
            ><el-input v-model="channelForm.providerId"
          /></el-form-item>
          <el-form-item label="渠道编码" required
            ><el-input v-model="channelForm.channelCode"
          /></el-form-item>
          <el-form-item label="渠道名称" required
            ><el-input v-model="channelForm.channelName"
          /></el-form-item>
          <el-form-item label="Endpoint" required
            ><el-input v-model="channelForm.endpoint"
          /></el-form-item>
          <el-form-item label="凭证引用" required
            ><el-input v-model="channelForm.credentialRef"
          /></el-form-item>
        </template>
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="dialog = false">取消</el-button
        ><PermissionButton
          type="primary"
          :loading="saving"
          :disabled="
            props.kind === 'models'
              ? !formReady
              : props.kind === 'providers'
                ? !providerFormReady
                : !channelFormReady
          "
          @click="
            props.kind === 'models'
              ? createModel()
              : props.kind === 'providers'
                ? createProvider()
                : createChannel()
          "
          >保存</PermissionButton
        ></template
      >
    </el-dialog>
  </section>
</template>

<style scoped>
.platform-ai-list {
  min-height: 100%;
  padding: 0 24px 24px;
  background: var(--bq-color-surface);
}
</style>
