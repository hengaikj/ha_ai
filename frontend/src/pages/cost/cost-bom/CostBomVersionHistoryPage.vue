<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back, Switch } from "@element-plus/icons-vue";
import type { UploadFile, UploadRawFile } from "element-plus";
import {
  fetchCostBomVersionHistories,
  overwriteCostBomVersionHistoryImport,
  useCostBomVersion,
} from "@/api/cost-center";
import { fetchPlatformDictItems } from "@/api/platform-system";
import { BaseToast } from "@/components/base/BaseToast";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import DictTag from "@/components/base/DictTag.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import UploadTips from "@/components/UploadTips.vue";
import type { CostBomVersionItem } from "@/types/cost-center";
import type { SchemaOption } from "@/types/schema-components";

type VersionQueryResult = {
  total: number;
  list: CostBomVersionItem[];
  pageNo: number;
  pageSize: number;
};

const route = useRoute();
const router = useRouter();

const projectId = computed(() => Number(route.query.projectId));
const versionId = computed(() =>
  Number(route.query.bomVersionId || route.query.versionId),
);
const vehicleModelId = computed(() => Number(route.query.vehicleModelId || 0));
const valveId = computed(() => Number(route.query.valveId || 0));
const activeMenuPath = computed(() => {
  if (
    route.path.startsWith("/cost/production/project-cost/") ||
    route.path.startsWith("/cost/production/new-production-cost/") ||
    route.path.startsWith("/new-production-cost/") ||
    route.path.startsWith("/costmanagementnew/zc/projectcostnew/") ||
    route.path.startsWith(
      "/costmanagementnew/zc/cost/production/project-cost/",
    )
  ) {
    return "/cost/production/project-cost";
  }
  if (typeof route.query.activeMenu === "string") {
    return route.query.activeMenu;
  }
  if (route.path.startsWith("/cost/production/project-cost/versions")) {
    return "/cost/production/project-cost";
  }
  if (
    route.path.startsWith("/cost/production/new-production-cost/versions") ||
    route.path.startsWith("/new-production-cost/versions") ||
    route.path.startsWith("/costmanagementnew/zc/projectcostnew/versions")
  ) {
    return "/cost/production/new-production-cost";
  }
  if (route.meta.activeMenu) {
    return String(route.meta.activeMenu);
  }
  const title = String(route.meta.title ?? "");
  if (title.includes("成本履历")) {
    return "/cost/research/new-history";
  }
  if (title.includes("成本履历")) {
    return "/cost/research/history";
  }
  if (title.includes("项目成本")) {
    return "/cost/research/project-cost";
  }
  return "";
});
// const permissionPrefix = computed(() => {
//   if (route.meta.permissionPrefix) {
//     return String(route.meta.permissionPrefix);
//   }
//   if (activeMenuPath.value === "/cost/research/history") {
//     return "cost:research:history";
//   }
//   if (activeMenuPath.value === "/cost/research/new-history") {
//     return "cost:research:new-history";
//   }
//   if (
//     route.path.startsWith("/cost/bom/") ||
//     String(route.meta.permission ?? "").startsWith("cost:bom:query")
//   ) {
//     return "cost:bom:query";
//   }
//   return "cost:research:project-cost";
// });
// const isProjectCostVersionRoute = computed(() =>
//   route.path.startsWith("/cost/research/project-cost/versions"),
// );
// const isNewProjectCostVersionRoute = computed(() =>
//   route.path.startsWith("/cost/research/new-project-cost/versions"),
// );
// const isCostResearchHistoryScope = computed(
//   () =>
//     activeMenuPath.value === "/cost/research/history" ||
//     activeMenuPath.value === "/cost/research/new-history",
// );
// const historyVersionPermission = (action: string) => [
//   `${permissionPrefix.value}:version-page:${action}`,
//   `${permissionPrefix.value}:version:${action === "use-version" ? "use" : action}`,
// ];
// const comparePermission = computed(() =>
//   isProjectCostVersionRoute.value
//     ? "cost:research:project-cost:version-page:compare"
//     : isNewProjectCostVersionRoute.value
//       ? "cost:research:new-project-cost:version-page:compare"
//       : isCostResearchHistoryScope.value
//         ? historyVersionPermission("compare")
//         : `${permissionPrefix.value}:compare`,
// );
// const useVersionPermission = computed(() =>
//   isProjectCostVersionRoute.value
//     ? "cost:research:project-cost:version-page:use-version"
//     : isNewProjectCostVersionRoute.value
//       ? "cost:research:new-project-cost:version-page:use-version"
//       : isCostResearchHistoryScope.value
//         ? historyVersionPermission("use-version")
//         : `${permissionPrefix.value}:use-version`,
// );
// const versionQueryPermission = computed(() =>
//   isProjectCostVersionRoute.value
//     ? "cost:research:project-cost:version-page:view"
//     : isNewProjectCostVersionRoute.value
//       ? "cost:research:new-project-cost:version-page:view"
//       : activeMenuPath.value === "/cost/research/history" ||
//           activeMenuPath.value === "/cost/research/new-history"
//         ? "system:version:list"
//       : isCostResearchHistoryScope.value
//         ? [
//             `${permissionPrefix.value}:version-page:view`,
//             `${permissionPrefix.value}:version:query`,
//             `${permissionPrefix.value}:list-page:history`,
//           ]
//         : permissionPrefix.value === "cost:bom:query"
//           ? `${permissionPrefix.value}:view`
//           : `${permissionPrefix.value}:list`,
// );
const versionBasePath = computed(
  () =>
    route.path.replace(/\/versions$/, "") ||
    String(route.meta.breadcrumbParentPath ?? "/cost/research/project-cost"),
);
const pageTitle = computed(() => {
  if (
    activeMenuPath.value === "/cost/production/new-production-cost" ||
    activeMenuPath.value === "/cost/production/project-cost" ||
    activeMenuPath.value === "/new-production-cost"
  ) {
    return "项目成本历史版本";
  }
  if (activeMenuPath.value === "/cost/research/history") {
    return "成本履历历史版本";
  }
  if (activeMenuPath.value === "/cost/research/new-history") {
    return "成本履历历史版本";
  }
  if (activeMenuPath.value === "/cost/research/new-project-cost") {
    return "项目成本历史版本";
  }
  if (activeMenuPath.value === "/cost/research/project-cost") {
    return "项目成本历史版本";
  }
  if (String(route.meta.title ?? "").includes("项目成本")) {
    return "项目成本历史版本";
  }
  return String(route.meta.title ?? "历史版本");
});
const returnPathProjectName = computed(() => {
  const returnPath = String(route.query.returnPath || "");
  if (!returnPath) return "";
  try {
    const decoded = decodeURIComponent(returnPath);
    const queryStart = decoded.indexOf("?");
    if (queryStart < 0) return "";
    return new URLSearchParams(decoded.slice(queryStart + 1)).get("projectName") || "";
  } catch {
    return "";
  }
});
const summaryProjectCode = computed(
  () =>
    String(
      route.query.projectName ||
        returnPathProjectName.value ||
        route.query.vehicleModelName ||
        "",
    ) || "--",
);
const summaryValveName = computed(
  () => String(route.query.valveName || "") || "--",
);

const tableRef = ref<{ reload?: () => void | Promise<void> } | null>(null);
const selectedVersions = ref<CostBomVersionItem[]>([]);
const switchingVersion = ref(false);
const importDialogVisible = ref(false);
const importing = ref(false);
const importRow = ref<CostBomVersionItem | null>(null);
const importFileList = ref<UploadFile[]>([]);
const importSelectedFiles = ref<File[]>([]);
const bomGenTypeOptions = ref<SchemaOption[]>([]);
const versionQueryCacheMs = 500;
let pendingVersionQuery: {
  key: string;
  promise: Promise<VersionQueryResult>;
} | null = null;
let latestVersionQuery: {
  key: string;
  result: VersionQueryResult;
  expiresAt: number;
} | null = null;

onMounted(() => {
  void loadBomGenTypeOptions();
});

async function loadBomGenTypeOptions() {
  try {
    const items = await fetchPlatformDictItems("bom_gen_type");
    bomGenTypeOptions.value = items.map((item) => ({
      label: item.label,
      value: item.value,
      cssClass: item.cssClass,
      listClass: item.listClass,
      styleClass: item.listClass,
      raw: item.raw,
    }));
  } catch {
    bomGenTypeOptions.value = [];
  }
}

async function queryVersions(
  pageSize: number,
  pageNum: number,
): Promise<VersionQueryResult> {
  selectedVersions.value = [];
  const queryKey = `${versionId.value}-${pageNum}-${pageSize}`;
  const now = Date.now();
  if (
    latestVersionQuery?.key === queryKey &&
    latestVersionQuery.expiresAt > now
  ) {
    return latestVersionQuery.result;
  }
  if (pendingVersionQuery?.key === queryKey) {
    return pendingVersionQuery.promise;
  }

  const promise = fetchCostBomVersionHistories(versionId.value, {
    pageNum,
    pageSize,
  }).then((page) => ({
    total: page.total,
    list: page.versions,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  }));

  pendingVersionQuery = { key: queryKey, promise };
  try {
    const result = await promise;
    latestVersionQuery = {
      key: queryKey,
      result,
      expiresAt: Date.now() + versionQueryCacheMs,
    };
    return result;
  } finally {
    if (pendingVersionQuery?.key === queryKey) {
      pendingVersionQuery = null;
    }
  }
}

function handleSelectionChange(rows: CostBomVersionItem[]) {
  selectedVersions.value = rows;
}

function resolveVersionParam(row: CostBomVersionItem) {
  return String(row.bomVersion || row.version || row.versionNo || "");
}

function openImport(row: CostBomVersionItem) {
  importRow.value = row;
  importFileList.value = [];
  importSelectedFiles.value = [];
  importDialogVisible.value = true;
}

function handleImportFileChange(
  _file: UploadFile,
  fileList: UploadFile[],
) {
  importFileList.value = fileList;
  importSelectedFiles.value = fileList
    .map((item) => item.raw)
    .filter((file): file is UploadRawFile => Boolean(file));
}

async function confirmImport() {
  const targetVersion = importRow.value
    ? resolveVersionParam(importRow.value)
    : "";
  if (!targetVersion) {
    BaseToast.error("缺少目标历史版本。");
    return;
  }
  if (!importSelectedFiles.value.length) {
    BaseToast.warning("请先选择文件。");
    return;
  }

  importing.value = true;
  try {
    for (const file of importSelectedFiles.value) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bomVersionId", String(versionId.value));
      formData.append("targetVersion", targetVersion);
      await overwriteCostBomVersionHistoryImport(formData);
    }
    BaseToast.success("导入成功。");
    importDialogVisible.value = false;
    importFileList.value = [];
    importSelectedFiles.value = [];
    await tableRef.value?.reload?.();
  } finally {
    importing.value = false;
  }
}

function viewVersion(row: CostBomVersionItem) {
  const targetDetailPath = activeMenuPath.value
    ? `${activeMenuPath.value}/detail`
    : `${versionBasePath.value}/detail`;
  router.push({
    path: targetDetailPath,
    query: {
      projectId: String(projectId.value || ""),
      bomVersionId: String(versionId.value || ""),
      versionId: String(row.versionId),
      version: resolveVersionParam(row),
      returnTo: "history",
      historyBomVersionId: String(versionId.value || ""),
      historyVersion: String(route.query.version ?? ""),
      vehicleModelId: String(row.vehicleModelId || vehicleModelId.value || ""),
      valveId: String(row.valveId || valveId.value || ""),
      activeMenu: activeMenuPath.value || undefined,
      returnPath: route.fullPath,
      projectName: route.query.projectName
        ? String(route.query.projectName)
        : undefined,
      projectCode: route.query.projectCode
        ? String(route.query.projectCode)
        : undefined,
      vehicleModelName: route.query.vehicleModelName
        ? String(route.query.vehicleModelName)
        : undefined,
      valveName: route.query.valveName
        ? String(route.query.valveName)
        : undefined,
    },
  });
}

function goCompare() {
  if (selectedVersions.value.length !== 2) {
    BaseToast.warning("请选择两个版本进行对比。");
    return;
  }
  const [base, target] = selectedVersions.value;
  router.push({
    path: `${versionBasePath.value}/versions/compare`,
    query: {
      projectId: String(projectId.value || ""),
      bomVersionId: String(versionId.value || ""),
      versionId: String(versionId.value || ""),
      version: String(route.query.version ?? ""),
      baseVersionId: String(base.versionId),
      targetVersionId: String(target.versionId),
      baseBomVersion: resolveVersionParam(base),
      targetBomVersion: resolveVersionParam(target),
      vehicleModelId: String(
        base.vehicleModelId ||
          target.vehicleModelId ||
          vehicleModelId.value ||
          "",
      ),
      valveId: String(base.valveId || target.valveId || valveId.value || ""),
      activeMenu: activeMenuPath.value || undefined,
      returnPath: route.fullPath,
      vehicleModelName: route.query.vehicleModelName
        ? String(route.query.vehicleModelName)
        : undefined,
      valveName: route.query.valveName
        ? String(route.query.valveName)
        : undefined,
    },
  });
}

async function switchVersion() {
  if (selectedVersions.value.length !== 1) {
    BaseToast.warning("请选择一个版本进行切换。");
    return;
  }
  const selected = selectedVersions.value[0];
  // if (!projectId.value || !selected.versionId) {
  //   BaseToast.warning("当前历史版本缺少项目或版本信息。");
  //   return;
  // }

  switchingVersion.value = true;
  try {
    const result = await useCostBomVersion(
      projectId.value,
      selected.versionId,
      {
        projectId: selected.valveId || valveId.value,
        targetVersionNo: selected.bomVersion || selected.versionNo,
        vehicleModelId: selected.vehicleModelId || vehicleModelId.value,
        valveId: selected.valveId || valveId.value,
      },
    );
    BaseToast.success(`切换成功：V${result.versionNo}`);
    await tableRef.value?.reload?.();
  } finally {
    switchingVersion.value = false;
  }
}

function goBack() {
  // 直接回左侧对应列表，避免详情页沿用 returnPath 后再次跳回历史页形成循环。
  router.replace(activeMenuPath.value || versionBasePath.value);
}
</script>

<template>
  <PageContainer :title="pageTitle">
    <template #titleExtra>
      <span class="bq-page-inline-meta">
        项目代号：{{ summaryProjectCode }} / 阀点：{{ summaryValveName }}
      </span>
    </template>
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack"
        >返回
      </PermissionButton>
    </template>

    <div class="cost-bom-version-history-page">
      <div class="cost-bom-version-history-page__toolbar">
        <PermissionButton
          variant="secondary"
          :disabled="selectedVersions.length !== 2"
          @click="goCompare"
        >
          <span class="cost-bom-version-history-page__compare-label">
            <span
              class="cost-bom-version-history-page__compare-icon"
              aria-hidden="true"
            />
            对比
          </span>
        </PermissionButton>
        <PermissionButton
          permission="costmanage:costbom:use"
          variant="secondary"
          :icon="Switch"
          :loading="switchingVersion"
          :disabled="selectedVersions.length !== 1"
          @click="switchVersion"
        >
          切换版本
        </PermissionButton>
      </div>

      <QueryTable
        ref="tableRef"
        :func="queryVersions"
        row-key="rowKey"
        :show-search="false"
        :show-toolbar="false"
        :enable-column-settings="false"
        fit-table-height
        :fit-table-min-height="360"
        empty-title="暂无历史版本"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="48"  />
        <el-table-column type="index" label="序号"  />
        <el-table-column label="BOM版本" width="110">
          <template #default="{ row }"
            >V{{ row.bomVersion || row.versionNo }}</template
          >
        </el-table-column>
        <el-table-column label="类型" prop="recordType" >
          <template #default="{ row }">
            <DictTag
              :value="row.recordType"
              :options="bomGenTypeOptions"
              :fallback="row.recordType || '-'"
            />
          </template>
        </el-table-column>

        <el-table-column prop="status" label="版本状态" align="center">
          <template #default="{ row }">
            <BaseStatusTag
              :label="row.status"
              :type="row.status === '当前生效' ? 'success' : 'info'"
            />
          </template>
        </el-table-column>
        <!--创建人-->
        <el-table-column prop="createBy" label="创建人"  />
        <el-table-column prop="createTime" label="创建时间"  />
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <PermissionButton
              link
              @click="viewVersion(row)"
            >
              查看
            </PermissionButton>
            <PermissionButton
              permission="costmanage:costbom:coverimport"
              link
              :disabled="importing"
              @click="openImport(row)"
            >
              导入
            </PermissionButton>
          </template>
        </el-table-column>
      </QueryTable>

      <el-dialog
        v-model="importDialogVisible"
        title="导入"
        width="660px"
        :close-on-click-modal="false"
      >
        <div v-loading="importing">
          <el-upload
            class="history-import-upload"
            drag
            action="#"
            multiple
            :auto-upload="false"
            :file-list="importFileList"
            :on-change="handleImportFileChange"
            :on-remove="handleImportFileChange"
            accept=".xlsx,.xls"
          >
            <UploadTips text="仅支持: xlsx、xls格式" />
          </el-upload>
          <div class="boottm-title">
            温馨提示：<br />
            1. 请将文件置于第一个sheet，文件不支持多行表头<br />
            2. 请不要上传带宏的文件，将导致错误
          </div>
        </div>
        <template #footer>
          <el-button @click="importDialogVisible = false">取消</el-button>
          <el-button type="primary" :disabled="importing" @click="confirmImport">
            确定
          </el-button>
        </template>
      </el-dialog>
    </div>
  </PageContainer>
</template>

<style scoped>
.cost-bom-version-history-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cost-bom-version-history-page__toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.history-import-upload {
  width: 100%;
}

.boottm-title {
  margin-top: 28px;
  color: var(--bq-color-text-secondary);
  line-height: 24px;
}

.cost-bom-version-history-page__compare-label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.cost-bom-version-history-page__compare-icon {
  width: 20px;
  height: 20px;
  background-color: currentcolor;
  -webkit-mask: url("@/assets/icons/pk.svg") center / contain no-repeat;
  mask: url("@/assets/icons/pk.svg") center / contain no-repeat;
}
</style>
