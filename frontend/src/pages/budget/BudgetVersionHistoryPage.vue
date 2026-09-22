<script setup lang="ts">
import { resolveServerTotal } from "@/utils/pagination";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back } from "@element-plus/icons-vue";
import { exportInitiation, getVersionList } from "@/api/budget";
import { ApiBusinessError } from "@/api/http";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";
import { replaceToReturn } from "@/utils/return-navigation";

type VersionRow = Record<string, unknown> & {
  id?: number | string;
  majorVersion?: number | string;
  status?: string;
  createBy?: string;
  createTime?: string;
  projectId?: number | string;
};

const route = useRoute();
const router = useRouter();
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);

const projectId = computed(() => String(route.query.projectId ?? ""));
const modelName = computed(() => String(route.query.modelName ?? ""));
const projectName = computed(() => String(route.query.projectName ?? "--"));
const latestExportTaskId = ref<string | number>();

async function queryVersions(pageSize: number, pageNo: number) {
  error.value = null;
  if (!projectId.value) {
    return { total: 0, list: [], pageNo: 1, pageSize };
  }
  try {
    const response = await getVersionList({
      projectId: projectId.value,
      pageNum: pageNo,
      pageSize,
    });
    const rows = (response.rows ?? []) as VersionRow[];
    return {
      total: resolveServerTotal(response.total),
      list: rows,
      pageNo,
      pageSize,
    };
  } catch (unknownError) {
    const normalizedError = normalizeError(unknownError);
    error.value = normalizedError;
    throw new Error(normalizedError.message, { cause: unknownError });
  }
}

function viewVersionDetail(row: VersionRow) {
  void router.push({
    path: "/budget/initiation/detail",
    query: {
      projectId: projectId.value,
      modelName: modelName.value,
      majorVersion: String(row.majorVersion ?? ""),
      isLatestVersion: 1,
      returnPath: route.fullPath,
    },
  });
}

async function exportVersion(row: VersionRow) {
  try {
    const task = await exportInitiation({
      projectId: projectId.value,
      majorVersion: row.majorVersion ?? "",
    });
    latestExportTaskId.value = task.taskId;
    BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
  } catch (unknownError) {
    handleActionError(unknownError, "导出失败");
  }
}

function goBack() {
  replaceToReturn(router, route, "/budget/wbs-touzi/lixiang");
}

function handleActionError(unknownError: unknown, fallbackMessage: string) {
  const normalizedError = normalizeError(unknownError, fallbackMessage);
  BaseToast.error(normalizedError.message);
  error.value = normalizedError;
}

function normalizeError(
  unknownError: unknown,
  fallbackMessage = "历史版本加载失败，请检查后端服务。",
) {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }
  return {
    code: "FRONTEND-BUDGET-VERSION-001",
    message: fallbackMessage,
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer title="立项评审历史版本">
    <template #titleExtra>
      <span class="bq-page-inline-meta">项目代码：{{ projectName }}</span>
    </template>
    <template #actions>
      <el-button class="bq-page-return-button" :icon="Back" @click="goBack">
        返回
      </el-button>
    </template>

    <TaskStatusPanel v-if="false" :task-id="latestExportTaskId" />
    <QueryTable
      :func="queryVersions"
      row-key="id"
      fit-table-height
      :error="error"
      empty-title="暂无历史版本"
      empty-description="当前项目没有可展示的预算版本。"
      :show-search="false"
    >
      <el-table-column type="index" label="序号" width="70" align="center" />
      <el-table-column prop="majorVersion" label="版本号" align="center" />
      <el-table-column prop="status" label="版本状态" align="center">
        <template #default="{ row }: { row: VersionRow }">
          <BaseStatusTag
            :label="row.status || '--'"
            :type="row.status === '当前生效' ? 'success' : 'info'"
          />
        </template>
      </el-table-column>
      <el-table-column prop="createBy" label="创建人" align="center" />
      <el-table-column prop="createTime" label="创建时间" align="center">
        <template #default="{ row }: { row: VersionRow }">
          <BaseDateTime :value="row.createTime || null" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }: { row: VersionRow }">
          <div class="bq-table-actions" @click.stop>
            <PermissionButton
              link
              type="primary"
              @click="viewVersionDetail(row)"
            >
              查看
            </PermissionButton>
            <PermissionButton
              link
              @click="exportVersion(row)"
            >
              导出
            </PermissionButton>
          </div>
        </template>
      </el-table-column>
    </QueryTable>
    <TaskStatusPanel v-if="false" :task-id="latestExportTaskId" />
  </PageContainer>
</template>

<style scoped></style>
