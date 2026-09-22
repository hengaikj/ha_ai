<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { CirclePlus, CopyDocument, MoreFilled } from "@element-plus/icons-vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BasePromptDialog from "@/components/base/BasePromptDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TemplateVersionDrawer from "./components/TemplateVersionDrawer.vue";
import {
  changeCustTableTemplateStatus,
  cloneCustTableTemplate,
  createCustTableBinding,
  createCustTableWorkbook,
  deleteCustTableBinding,
  deleteCustTableTemplate,
  listCustTableBindings,
  listCustTableTemplates,
  restoreCustTableTemplateVersion,
} from "@/api/cust-table";
import { useAuthStore } from "@/stores/auth";
import { createIdempotencyKey } from "@/utils/idempotency";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { useBasePromptDialog } from "@/composables/useBasePromptDialog";
import type {
  CustTableBinding,
  CustTableTemplateDetail,
  CustTableTemplateStatus,
  CustTableTemplateVersion,
} from "@/types/cust-table";

const router = useRouter();
const authStore = useAuthStore();
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const { promptState, openPrompt, resolvePrompt, rejectPrompt } =
  useBasePromptDialog();
const table = ref<{ reload: () => Promise<void> }>();
const versionOpen = ref(false);
const bindingOpen = ref(false);
const bindingLoading = ref(false);
const restoring = ref(false);
const active = ref<CustTableTemplateDetail>();
const bindings = ref<CustTableBinding[]>([]);
const query = reactive<{
  keyword: string;
  status?: CustTableTemplateStatus;
}>({ keyword: "" });
const statusTypes = {
  DRAFT: "warning",
  PUBLISHED: "success",
  DISABLED: "info",
} as const;
const statusLabels = { DRAFT: "草稿", PUBLISHED: "已发布", DISABLED: "已停用" };
const canManageBindings = computed(() =>
  authStore.hasPermission("base:cust-table:binding:edit"),
);

async function load(pageSize: number, pageNo: number) {
  const result = await listCustTableTemplates({
    pageNo,
    pageSize,
    keyword: query.keyword.trim() || undefined,
    status: query.status,
  });
  return {
    list: result.records,
    total: result.total,
    pageNo: result.pageNo,
    pageSize: result.pageSize,
  };
}

function reset() {
  query.keyword = "";
  query.status = undefined;
  void table.value?.reload();
}

function design(row?: CustTableTemplateDetail) {
  void router.push(
    row ? `/custom-table/designer/${row.id}` : "/custom-table/designer",
  );
}

async function fill(row: CustTableTemplateDetail) {
  if (!row.currentVersionId) {
    BaseToast.warning("请先发布模板版本后再填报");
    return;
  }
  const workbook = await createCustTableWorkbook({
    requestId: createIdempotencyKey("workbook-create"),
    templateVersionId: row.currentVersionId,
    ownerType: row.scopeType,
    ownerId: row.scopeId,
  });
  await router.push(`/custom-table/runtime/${workbook.id}`);
}

function versions(row: CustTableTemplateDetail) {
  active.value = row;
  versionOpen.value = true;
}

async function clone(row: CustTableTemplateDetail) {
  try {
    const templateName = await openPrompt({
      title: "克隆模板",
      label: "新模板名称",
      initialValue: `${row.templateName} 副本`,
      validator: (value) => Boolean(value.trim()) || "名称不能为空",
    });
    const templateCode = await openPrompt({
      title: "克隆模板",
      label: "模板编码",
      initialValue: `${row.templateCode}_COPY`,
      validator: (value) =>
        /^[A-Za-z0-9._-]+$/.test(value) ||
        "仅支持字母、数字、点、下划线和短横线",
    });
    await cloneCustTableTemplate(row.id, {
      requestId: createIdempotencyKey("template-clone"),
      templateName: templateName.trim(),
      templateCode: templateCode.trim(),
      expectedLockVersion: row.lockVersion,
    });
    BaseToast.success("模板已克隆");
    await table.value?.reload();
  } catch {
    return;
  }
}

async function changeStatus(
  row: CustTableTemplateDetail,
  status: "PUBLISHED" | "DISABLED",
) {
  const action = status === "DISABLED" ? "停用" : "启用";
  try {
    await openConfirm({
      scene: status === "DISABLED" ? "disable" : "enable",
      object: "模板",
      name: row.templateName,
      message: `确认${action}模板“${row.templateName}”吗？`,
    });
    await changeCustTableTemplateStatus(row.id, {
      requestId: createIdempotencyKey("template-status"),
      status,
      expectedLockVersion: row.lockVersion,
    });
    BaseToast.success(`模板已${action}`);
    await table.value?.reload();
  } catch {
    return;
  }
}

async function remove(row: CustTableTemplateDetail) {
  try {
    await openConfirm({
      scene: "delete",
      object: "草稿模板",
      name: row.templateName,
    });
    await deleteCustTableTemplate(row.id, {
      requestId: createIdempotencyKey("template-delete"),
      expectedLockVersion: row.lockVersion,
    });
    BaseToast.success("模板已删除");
    await table.value?.reload();
  } catch {
    return;
  }
}

async function restore(version: CustTableTemplateVersion) {
  if (!active.value) return;
  try {
    await openConfirm({
      title: "恢复历史版本确认",
      message: `确认将 V${version.versionNo} 恢复为当前草稿吗？`,
      confirmText: "恢复",
    });
  } catch {
    return;
  }
  restoring.value = true;
  try {
    const restored = await restoreCustTableTemplateVersion(
      active.value.id,
      version.id,
      {
        requestId: createIdempotencyKey("template-restore"),
        expectedLockVersion: active.value.lockVersion,
      },
    );
    active.value = restored;
    BaseToast.success("历史版本已恢复为草稿");
    versionOpen.value = false;
    await table.value?.reload();
  } finally {
    restoring.value = false;
  }
}

async function openBindings(row: CustTableTemplateDetail) {
  active.value = row;
  bindingOpen.value = true;
  await loadBindings();
}

async function loadBindings() {
  if (!active.value) return;
  bindingLoading.value = true;
  try {
    const result = await listCustTableBindings({
      pageNo: 1,
      pageSize: 100,
      templateId: active.value.id,
    });
    bindings.value = result.records;
  } finally {
    bindingLoading.value = false;
  }
}

async function bind() {
  if (!active.value?.currentVersionId) return;
  try {
    const bindingCode = await openPrompt({
      title: "新增业务绑定",
      label: "业务场景编码",
      placeholder: "例如 budget.project.execution",
      validator: (value) =>
        /^[A-Za-z0-9._-]+$/.test(value) || "业务场景编码格式不正确",
    });
    await createCustTableBinding({
      requestId: createIdempotencyKey("binding-create"),
      bindingCode: bindingCode.trim(),
      templateVersionId: active.value.currentVersionId,
      ownerType: active.value.scopeType,
      ownerId: active.value.scopeId,
    });
    BaseToast.success("业务场景绑定成功");
    await loadBindings();
  } catch {
    return;
  }
}

async function unbind(binding: CustTableBinding) {
  try {
    await openConfirm({
      title: "解除绑定确认",
      message: `确认解除业务场景“${binding.bindingCode}”的绑定吗？`,
      confirmText: "解除绑定",
    });
    await deleteCustTableBinding(binding.id, binding.lockVersion);
    BaseToast.success("业务场景绑定已解除");
    await loadBindings();
  } catch {
    return;
  }
}
</script>

<template>
  <PageContainer
    title="模板中心"
    description="管理自定义表格草稿、发布版本、业务绑定和填报入口。"
  >
    <template #actions>
      <PermissionButton
        permission="base:cust-table:template:edit"
        type="primary"
        :icon="CirclePlus"
        @click="design()"
      >
        新建模板
      </PermissionButton>
    </template>

    <QueryTable
      ref="table"
      :func="load"
      row-key="id"
      show-toolbar
      @search="table?.reload()"
      @reset="reset"
    >
      <template #search>
        <el-form :model="query" inline>
          <el-form-item label="关键词">
            <el-input
              v-model="query.keyword"
              clearable
              placeholder="模板名称或编码"
            />
          </el-form-item>
          <el-form-item label="模板状态">
            <el-select v-model="query.status" clearable style="width: 120px">
              <el-option
                v-for="(label, key) in statusLabels"
                :key="key"
                :label="label"
                :value="key"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </template>

      <el-table-column
        prop="templateName"
        label="模板名称"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="templateCode"
        label="模板编码"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column prop="rendererType" label="渲染器" width="90" />
      <el-table-column label="作用域" width="140">
        <template #default="{ row }">
          {{ row.scopeType
          }}<span v-if="row.scopeType !== 'GLOBAL'"> / {{ row.scopeId }}</span>
        </template>
      </el-table-column>
      <el-table-column label="模板状态" width="100">
        <template #default="{ row }">
          <BaseStatusTag
            :label="statusLabels[row.status as CustTableTemplateStatus]"
            :type="statusTypes[row.status as CustTableTemplateStatus]"
          />
        </template>
      </el-table-column>
      <el-table-column label="版本" width="80">
        <template #default="{ row }">
          {{ row.currentVersionNo ? `v${row.currentVersionNo}` : "-" }}
        </template>
      </el-table-column>
      <el-table-column prop="updateTime" label="更新时间" width="170" />
      <el-table-column label="操作" fixed="right" width="300">
        <template #default="{ row }">
          <PermissionButton
            permission="base:cust-table:template:edit"
            link
            type="primary"
            @click="design(row)"
          >
            设计
          </PermissionButton>
          <PermissionButton
            permission="base:cust-table:workbook:edit"
            link
            type="primary"
            :disabled="!row.currentVersionId || row.status === 'DISABLED'"
            @click="fill(row)"
          >
            填报
          </PermissionButton>
          <PermissionButton
            permission="base:cust-table:template:query"
            link
            @click="versions(row)"
          >
            版本
          </PermissionButton>
          <el-dropdown trigger="click">
            <el-button link type="primary" :icon="MoreFilled">更多</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :icon="CopyDocument" @click="clone(row)">
                  克隆
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="canManageBindings"
                  @click="openBindings(row)"
                >
                  绑定管理
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="row.status === 'DRAFT' && !row.currentVersionId"
                  data-test="delete-template"
                  divided
                  @click="remove(row)"
                >
                  删除
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="row.status !== 'DISABLED'"
                  divided
                  @click="changeStatus(row, 'DISABLED')"
                >
                  停用
                </el-dropdown-item>
                <el-dropdown-item
                  v-else
                  divided
                  @click="changeStatus(row, 'PUBLISHED')"
                >
                  启用
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </QueryTable>

    <TemplateVersionDrawer
      v-model="versionOpen"
      :template="active"
      :restoring="restoring"
      @restore="restore"
    />

    <el-drawer v-model="bindingOpen" title="业务场景绑定" size="720px">
      <div class="binding-actions">
        <PermissionButton
          permission="base:cust-table:binding:edit"
          type="primary"
          :disabled="!active?.currentVersionId || active?.status === 'DISABLED'"
          @click="bind"
        >
          新增绑定
        </PermissionButton>
      </div>
      <el-table v-loading="bindingLoading" :data="bindings" row-key="id" border>
        <el-table-column prop="bindingCode" label="业务编码" min-width="190" />
        <el-table-column label="作用域" min-width="150">
          <template #default="{ row }">
            {{ row.ownerType }} / {{ row.ownerId }}
          </template>
        </el-table-column>
        <el-table-column prop="templateVersionId" label="版本ID" width="100" />
        <el-table-column prop="status" label="状态" width="90" />
        <el-table-column label="操作" fixed="right" width="80">
          <template #default="{ row }">
            <PermissionButton
              permission="base:cust-table:binding:edit"
              link
              type="danger"
              @click="unbind(row)"
            >
              解绑
            </PermissionButton>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <BaseConfirm
      v-model="confirmState.visible"
      v-bind="confirmState"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
    <BasePromptDialog
      v-model="promptState.visible"
      v-model:value="promptState.value"
      :title="promptState.title"
      :label="promptState.label"
      :placeholder="promptState.placeholder"
      :input-type="promptState.inputType"
      :confirm-text="promptState.confirmText"
      @confirm="resolvePrompt"
      @cancel="rejectPrompt"
    />
  </PageContainer>
</template>

<style scoped>
.binding-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
</style>
