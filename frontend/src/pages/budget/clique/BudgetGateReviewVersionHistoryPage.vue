<script setup lang="ts">
import { resolveServerTotal } from "@/utils/pagination";
import { sortByCreateTimeThenVersionDesc } from "@/utils/history-version-sort";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { replaceToReturn } from "@/utils/return-navigation";
import { Back } from "@element-plus/icons-vue";
import { exportInitiationGF, getVersionListGF } from "@/api/budget";
import { ApiBusinessError } from "@/api/http";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import TaskStatusPanel from "@/components/task-center/TaskStatusPanel.vue";

type VersionRow = Record<string, unknown> & {
  id?: number | string;
  projectId?: number | string;
  valveId?: number | string;
  majorVersion?: number | string;
  status?: string;
  createBy?: string;
  createTime?: string;
};

const route = useRoute();
const router = useRouter();
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const latestExportTaskId = ref<string>();

const projectId = computed(() => String(route.query.projectId ?? ""));
const valveId = computed(() => String(route.query.valveId ?? ""));
const projectName = computed(() => String(route.query.projectName ?? "--"));
const valveName = computed(() =>
  decodeQueryText(String(route.query.valveName ?? "--")),
);
const isLock = computed(() => String(route.query.isLock ?? ""));
const budgetLock = computed(() => String(route.query.budgetLock ?? ""));

function decodeQueryText(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasRequestValue(value: unknown) {
  return value !== "" && value !== null && value !== undefined;
}

function compactParams<T extends Record<string, unknown>>(params: T) {
  return Object.entries(params).reduce<Record<string, unknown>>(
    (result, [key, value]) => {
      if (hasRequestValue(value)) {
        result[key] = value;
      }
      return result;
    },
    {},
  ) as Partial<T>;
}

async function queryVersions(pageSize: number, pageNo: number) {
  error.value = null;
  if (!projectId.value || !valveId.value) {
    return { total: 0, list: [], pageNo: 1, pageSize };
  }
  try {
    const response = await getVersionListGF({
      projectId: projectId.value,
      valveId: valveId.value,
      pageNum: pageNo,
      pageSize,
    });
    const rows = sortByCreateTimeThenVersionDesc(
      (response.rows ?? []) as VersionRow[],
      (row) => row.majorVersion,
    );
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
    name: "过阀评审查看",
    query: compactParams({
      projectId: projectId.value,
      valveId: valveId.value,
      projectName: projectName.value,
      valveName: encodeURIComponent(valveName.value),
      majorVersion: String(row.majorVersion ?? ""),
      isLock: isLock.value,
      budgetLock: budgetLock.value,
      isLatestVersion: 1,
      returnPath: route.fullPath,
    }),
  });
}

async function exportVersion(row: VersionRow) {
  try {
    const task = await exportInitiationGF([
      {
        projectId: row.projectId ?? projectId.value,
        majorVersion: row.majorVersion ?? "",
        valveId: valveId.value,
      },
    ]);
    latestExportTaskId.value = task.taskId;
    BaseToast.success(`导出任务已创建：${task.taskNo || task.taskId}`);
  } catch (unknownError) {
    handleActionError(unknownError, "导出失败");
  }
}

function goBack() {
  replaceToReturn(router, route, "/budget/wbs-touzi/clique");
}

function resolveStatusType(status?: unknown) {
  return String(status ?? "") === "当前生效" ? "success" : "info";
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
    code: "FRONTEND-BUDGET-GATE-VERSION-001",
    message: fallbackMessage,
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    title="过阀评审历史版本"
  >
    <template #titleExtra>
      <span class="bq-page-inline-meta">
        项目代号：{{ projectName }}（{{ valveName }}）
      </span>
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
      empty-description="当前项目阀点没有可展示的历史版本。"
      :show-search="false"
    >
      <el-table-column type="index" label="序号" width="70" align="center" />
      <el-table-column prop="majorVersion" label="版本号" align="center" />
      <el-table-column prop="status" label="版本状态" align="center">
        <template #default="{ row }: { row: VersionRow }">
          <BaseStatusTag
            :label="row.status || '--'"
            :type="resolveStatusType(row.status)"
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
  </PageContainer>
</template>
