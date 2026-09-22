<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { onBeforeUnmount, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { CirclePlus } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import {
  queryTemplatePage,
  toggleTemplateStatus,
} from "@/api/revenue/template";
import { REVENUE_TEMPLATE_PERMISSIONS } from "@/utils/revenue-permissions";
import type { RevenueTemplateItem } from "@/types/revenue";
import TemplateEditorDialog from "./TemplateEditorDialog.vue";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

const router = useRouter();
const queryTableRef = ref<QueryTableExpose | null>(null);
const keywordTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const dialogVisible = ref(false);
const editorMode = ref<"create" | "edit">("create");
const editingId = ref("");
const copyFromId = ref("");

/** 对齐 Vue2：仅按模板名称筛选 */
const query = reactive({
  keyword: "",
});

onBeforeUnmount(() => {
  if (keywordTimer.value) {
    clearTimeout(keywordTimer.value);
    keywordTimer.value = null;
  }
});

/** 对齐 Vue2：状态展示为「正常 / 禁用」 */
function isActiveTemplate(row: RevenueTemplateItem): boolean {
  const status = row?.status || row?.templateStatus || "";
  return status === "ACTIVE";
}

function resolveStatusText(row: RevenueTemplateItem): string {
  return isActiveTemplate(row) ? "正常" : "禁用";
}

function tableRowClassName({ row }: { row: RevenueTemplateItem }) {
  if (!isActiveTemplate(row)) return "template-list-row--inactive";
  return "";
}

function resolveVersionText(row: RevenueTemplateItem): string {
  const version = row?.version ?? (row as any)?.versionNo ?? 1;
  const text = String(version ?? "").trim();
  if (!text || text === "-") return "V1";
  return text.toUpperCase().startsWith("V") ? text : `V${text}`;
}

function resolveSubjectCount(row: RevenueTemplateItem): number | string {
  const count = row?.subjectCount ?? (row as any)?.rowCount;
  return count == null || count === "" ? "-" : count;
}

function resetQuery() {
  query.keyword = "";
}

function searchTemplates() {
  queryTableRef.value?.search();
}

function onKeywordInput() {
  if (keywordTimer.value) {
    clearTimeout(keywordTimer.value);
  }
  keywordTimer.value = setTimeout(() => {
    searchTemplates();
  }, 400);
}

async function queryTemplates(pageSize: number, pageNum: number) {
  const res = await queryTemplatePage({
    pageNum,
    pageSize,
    keyword: query.keyword || undefined,
  });
  return {
    total: Number(res?.total) || 0,
    list: Array.isArray(res?.rows) ? res.rows : [],
    pageNo: pageNum,
    pageSize,
  };
}

async function reloadTemplates() {
  await queryTableRef.value?.reload();
}

/** 对齐 Vue2：操作列启停 */
async function handleToggleStatus(row: RevenueTemplateItem) {
  const nextActive = !isActiveTemplate(row);
  (row as any)._toggleLoading = true;
  try {
    await toggleTemplateStatus({
      id: row.id,
      status: nextActive ? "ACTIVE" : "INACTIVE",
    });
    BaseToast.success(nextActive ? "启用成功" : "禁用成功");
    await reloadTemplates();
  } catch (err: any) {
    console.error("切换状态失败", err);
    BaseToast.error(err?.message || "操作失败，请稍后重试");
  } finally {
    (row as any)._toggleLoading = false;
  }
}

function openDetail(row: RevenueTemplateItem) {
  router.push({ name: "RevenueTemplateDetail", query: { id: row.id } });
}

function openCreateDialog() {
  editorMode.value = "create";
  editingId.value = "";
  copyFromId.value = "";
  dialogVisible.value = true;
}

function openEditDialog(row: RevenueTemplateItem) {
  editorMode.value = "edit";
  editingId.value = row.id;
  copyFromId.value = "";
  dialogVisible.value = true;
}

function handleCopyTemplate(row: RevenueTemplateItem) {
  editorMode.value = "create";
  editingId.value = "";
  copyFromId.value = row.id;
  dialogVisible.value = true;
}
</script>

<template>
  <PageContainer
    title="收益模板管理"
    description="管理收益分析模板，支持新增、编辑、启停等操作"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryTemplates"
      row-key="id"
      fit-table-height
      :table-props="{
        rowClassName: tableRowClassName,
        scrollbarAlwaysOn: true,
        border: false,
      }"
      empty-title="暂无模板"
      empty-description="当前筛选条件下没有可展示的模板数据。"
      @reset="resetQuery"
    >
      <!-- 对齐 Vue2：仅模板名称筛选，去掉状态/科目类别 -->
      <template #search>
        <el-form :model="query">
          <el-form-item label="模板名称">
            <el-input
              v-model="query.keyword"
              clearable
              placeholder="请输入模板名称"
              @input="onKeywordInput"
              @clear="searchTemplates"
              @keyup.enter="searchTemplates"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          :permission="REVENUE_TEMPLATE_PERMISSIONS.create"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="openCreateDialog"
        >
          新增
        </PermissionButton>
      </template>

      <!-- 对齐 Vue2：序号、模板名称、版本、状态、科目数量、操作 -->
      <el-table-column type="index" label="序号" width="70" header-align="center" />
      <el-table-column
        prop="templateName"
        label="模板名称"
        min-width="240"
        header-align="center"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <button
            type="button"
            class="template-list-name-link"
            @click="openDetail(row)"
          >
            {{ row.templateName }}
          </button>
        </template>
      </el-table-column>
      <el-table-column label="版本" width="90" align="center" header-align="center">
        <template #default="{ row }">
          {{ resolveVersionText(row) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center" header-align="center">
        <template #default="{ row }">
          {{ resolveStatusText(row) }}
        </template>
      </el-table-column>
      <el-table-column
        label="科目数量"
        width="120"
        align="center"
        header-align="center"
      >
        <template #default="{ row }">
          {{ resolveSubjectCount(row) }}
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        width="220"
        fixed="right"
        align="left"
        header-align="center"
      >
        <template #default="{ row }">
          <div class="bq-table-actions template-list-actions" @click.stop>
            <PermissionButton
              :permission="REVENUE_TEMPLATE_PERMISSIONS.update"
              link
              type="primary"
              @click="openEditDialog(row)"
            >
              编辑
            </PermissionButton>
            <PermissionButton
              :permission="REVENUE_TEMPLATE_PERMISSIONS.create"
              link
              type="primary"
              @click="handleCopyTemplate(row)"
            >
              复制新增
            </PermissionButton>
            <PermissionButton
              :permission="REVENUE_TEMPLATE_PERMISSIONS.status"
              link
              type="primary"
              :loading="row._toggleLoading ?? false"
              @click="handleToggleStatus(row)"
            >
              {{ isActiveTemplate(row) ? "禁用" : "启用" }}
            </PermissionButton>
          </div>
        </template>
      </el-table-column>
    </QueryTable>

    <TemplateEditorDialog
      v-model="dialogVisible"
      :mode="editorMode"
      :template-id="editingId || undefined"
      :copy-from-id="copyFromId || undefined"
      @saved="reloadTemplates"
    />
  </PageContainer>
</template>

<style scoped>
.template-list-name-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--bq-color-primary, #2f6fe8);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}

.template-list-name-link:hover {
  text-decoration: underline;
}

.template-list-actions {
  justify-content: flex-start;
  width: auto;
}

:deep(.template-list-row--inactive) {
  opacity: 0.72;
}
</style>
