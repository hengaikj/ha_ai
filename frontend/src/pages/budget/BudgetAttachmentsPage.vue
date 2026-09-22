<script setup lang="ts">
import { resolveServerTotal } from "@/utils/pagination";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { reactive, ref } from "vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import { fetchBudgetWorkbenchAttachments } from "@/api/budget";
import {
  deletePlatformFile,
  downloadPlatformFile,
  previewPlatformFile,
} from "@/api/platform-file";
import type {
  BudgetWorkbenchAttachmentItem,
  BudgetWorkbenchPageType,
} from "@/types/budget";
import type { PlatformFilePreviewResponse } from "@/types/platform-file";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";

type AttachmentRow = {
  id: string;
  pageType: BudgetWorkbenchPageType;
  stageName: string;
  projectName: string;
  valvePoint: string;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: string;
  fileId: string;
  businessModule: string;
  businessId: string;
};

type QueryTableExpose = {
  search: () => void;
  reload: () => Promise<void>;
};

const queryTableRef = ref<QueryTableExpose | null>(null);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const previewVisible = ref(false);
const previewLoading = ref(false);
const activePreview = ref<PlatformFilePreviewResponse | null>(null);
const activePreviewOwner = ref<{
  businessModule: string;
  businessId: string;
} | null>(null);
const query = reactive({
  keyword: "",
  createdAtRange: [] as string[] | null,
});

async function queryRows(pageSize: number, pageNo: number) {
  const page = await fetchBudgetWorkbenchAttachments({
    keyword: query.keyword.trim() || undefined,
    createdAtStart: query.createdAtRange?.[0],
    createdAtEnd: query.createdAtRange?.[1],
    pageNo,
    pageSize,
  });
  const rows = page.records.map(toAttachmentRow);
  return {
    total: resolveServerTotal(page.total),
    list: rows,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function toAttachmentRow(
  attachment: BudgetWorkbenchAttachmentItem,
): AttachmentRow {
  const pageType =
    attachment.stageCode === "PASS_VALVE" ? "gate-review" : "initiation";
  return {
    id: `${attachment.itemId}-${attachment.fileId}`,
    pageType,
    stageName:
      attachment.stageName ||
      (pageType === "gate-review" ? "过阀评审" : "立项评审"),
    projectName: attachment.projectName,
    valvePoint: attachment.valvePoint || "--",
    fileName: attachment.originalName || attachment.normalizedName,
    fileSize: attachment.fileSize,
    status: attachment.status,
    createdAt: attachment.createdAt,
    fileId: String(attachment.fileId),
    businessModule: attachment.businessModule,
    businessId: String(attachment.businessId),
  };
}

function searchRows() {
  queryTableRef.value?.search();
}

function resetQuery() {
  query.keyword = "";
  query.createdAtRange = [];
}

async function previewAttachment(row: AttachmentRow) {
  previewVisible.value = true;
  previewLoading.value = true;
  try {
    activePreview.value = await previewPlatformFile(
      row.fileId,
      row.businessModule,
      row.businessId,
    );
    activePreviewOwner.value = {
      businessModule: row.businessModule,
      businessId: row.businessId,
    };
  } catch {
    previewVisible.value = false;
  } finally {
    previewLoading.value = false;
  }
}

async function downloadAttachment(row: AttachmentRow) {
  const blob = await downloadPlatformFile(
    row.fileId,
    row.businessModule,
    row.businessId,
  );
  downloadBlob(blob, row.fileName || `${row.fileId}.xlsx`);
}

async function deleteAttachment(row: AttachmentRow) {
  try {
    await openConfirm({ scene: "delete", object: "附件", name: row.fileName });
  } catch {
    return;
  }
  await deletePlatformFile(row.fileId, row.businessModule, row.businessId);
  BaseToast.success("附件已删除。");
  await queryTableRef.value?.reload();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function directPreviewUrl(preview: PlatformFilePreviewResponse | null) {
  if (!preview || !activePreviewOwner.value) {
    return "";
  }
  const params = new globalThis.URLSearchParams({
    businessModule: activePreviewOwner.value.businessModule,
    businessId: activePreviewOwner.value.businessId,
  });
  return `/api/file/v1/files/${preview.fileId}/download?${params.toString()}`;
}

function formatFileSize(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} KB`;
  }
  return `${value} B`;
}
</script>

<template>
  <PageContainer
    title="预算附件"
    description="集中查看立项评审、过阀评审关联的附件。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryRows"
      row-key="id"
      fit-table-height
      empty-title="暂无预算附件"
      empty-description="当前预算项没有可展示的附件。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="关键字">
            <el-input
              v-model="query.keyword"
              clearable
              placeholder="请输入项目、阀点或附件名称"
              @keyup.enter="searchRows"
            />
          </el-form-item>
          <el-form-item label="上传时间">
            <el-date-picker
              v-model="query.createdAtRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
            />
          </el-form-item>
        </el-form>
      </template>
      <el-table-column prop="stageName" label="阶段" width="120" />
      <el-table-column prop="projectName" label="项目代号" min-width="190" />
      <el-table-column prop="valvePoint" label="阀点" width="110" />
      <el-table-column prop="fileName" label="附件名称" min-width="220" />
      <el-table-column label="文件大小" width="120" align="right">
        <template #default="{ row }: { row: AttachmentRow }">
          {{ formatFileSize(row.fileSize) }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="附件状态" width="120" />
      <el-table-column label="上传时间" width="180">
        <template #default="{ row }: { row: AttachmentRow }">
          <BaseDateTime :value="row.createdAt" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right" align="center">
        <template #default="{ row }: { row: AttachmentRow }">
          <PermissionButton
            permission="system:attachment:list"
            link
            type="primary"
            @click="previewAttachment(row)"
            >预览</PermissionButton
          >
          <PermissionButton
            permission="system:attachment:download"
            link
            type="primary"
            @click="downloadAttachment(row)"
            >下载</PermissionButton
          >
          <PermissionButton
            permission="system:attachment:remove"
            link
            @click="deleteAttachment(row)"
            >删除</PermissionButton
          >
        </template>
      </el-table-column>
    </QueryTable>
    <BaseFormDialog
      v-model="previewVisible"
      title="附件预览"
      width="860px"
      confirm-text="关闭"
      cancel-text="取消"
      close-on-confirm
      :loading="previewLoading"
      body-max-height="620px"
    >
      <div v-if="activePreview">
        <pre v-if="activePreview.previewType === 'TEXT'">{{
          activePreview.text
        }}</pre>
        <el-tabs v-else-if="activePreview.previewType === 'TABLE'">
          <el-tab-pane
            v-for="sheet in activePreview.sheets || []"
            :key="sheet.name"
            :label="sheet.name"
          >
            <el-table :data="sheet.rows" border size="small">
              <el-table-column
                v-for="(_, index) in sheet.rows[0] || []"
                :key="index"
                :label="`列${index + 1}`"
              >
                <template #default="{ row }">{{ row[index] || "" }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
        <iframe
          v-else-if="activePreview.directStream"
          class="budget-attachments__preview-frame"
          :src="directPreviewUrl(activePreview)"
        />
        <el-empty v-else description="当前文件类型不支持预览" />
      </div>
    </BaseFormDialog>
    <BaseConfirm
      v-model="confirmState.visible"
      v-bind="confirmState"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.budget-attachments__preview-frame {
  width: 100%;
  min-height: 520px;
  border: 1px solid var(--bq-border-color-light);
  border-radius: 4px;
}
</style>
