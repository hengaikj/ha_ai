<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back, Refresh, Search } from "@element-plus/icons-vue";
import { fetchCostBomVersionDiff } from "@/api/cost-center";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import { replaceToReturn } from "@/utils/return-navigation";

type ComparePartRow = {
  id: string;
  partNumber: string;
  partName: string;
  color: string;
  raw: Record<string, unknown>;
};

const diffColor = {
  changed: "var(--bq-color-warning)",
  deleted: "var(--bq-color-danger)",
  added: "var(--bq-color-success)",
};

const route = useRoute();
const router = useRouter();

const projectId = computed(() => Number(route.query.projectId));
const bomVersionId = computed(() =>
  Number(route.query.bomVersionId || route.query.versionId),
);
const baseBomVersion = computed(() =>
  String(route.query.baseBomVersion || route.query.baseVersion || ""),
);
const targetBomVersion = computed(() =>
  String(route.query.targetBomVersion || route.query.targetVersion || ""),
);
const vehicleModelId = computed(() => Number(route.query.vehicleModelId || 0));
const valveId = computed(() => Number(route.query.valveId || 0));
const pageTitle = computed(() => String(route.meta.title ?? "版本对比"));
// const isProjectCostVersionCompareRoute = computed(() =>
//   route.path.startsWith("/cost/research/project-cost/versions/compare"),
// );
// const isNewProjectCostVersionCompareRoute = computed(() =>
//   route.path.startsWith("/cost/research/new-project-cost/versions/compare"),
// );
const versionHistoryBasePath = computed(
  () =>
    route.path.replace(/\/versions\/compare$/, "").replace(/\/compare$/, "") ||
    String(route.meta.breadcrumbParentPath ?? "/cost/research/project-cost")
      .replace(/\/+$/, "")
      .replace(/\/versions$/, ""),
);
const compareTitle = computed(
  () =>
    `对比：成本BOM-V${baseBomVersion.value || "--"}版本 VS 成本BOM-V${
      targetBomVersion.value || "--"
    }版本`,
);
const historyPath = computed(() => ({
  path: `${versionHistoryBasePath.value}/versions`,
  query: {
    projectId: String(projectId.value || ""),
    bomVersionId: String(bomVersionId.value || ""),
    versionId: String(bomVersionId.value || ""),
    version: String(route.query.version || ""),
    vehicleModelId: vehicleModelId.value
      ? String(vehicleModelId.value)
      : undefined,
    valveId: valveId.value ? String(valveId.value) : undefined,
    activeMenu: route.query.activeMenu
      ? String(route.query.activeMenu)
      : undefined,
    returnPath: route.fullPath,
    vehicleModelName: route.query.vehicleModelName
      ? String(route.query.vehicleModelName)
      : undefined,
    valveName: route.query.valveName
      ? String(route.query.valveName)
      : undefined,
  },
}));

const loading = ref(false);
const selectedOldPartId = ref("");
const selectedNewPartId = ref("");
const comparePage = ref(1);
const comparePageSize = 50;
const oldBomParts = ref<ComparePartRow[]>([]);
const newBomParts = ref<ComparePartRow[]>([]);
const allOldBomParts = ref<ComparePartRow[]>([]);
const allNewBomParts = ref<ComparePartRow[]>([]);
const oldBomSize = ref(0);
const diffBomSize = ref(0);
const diffStats = reactive({
  changeCount: 0,
  deleteCount: 0,
  addCount: 0,
});
const searchForm = reactive({
  partNumber: "",
  partName: "",
});
const compareTotal = computed(() =>
  Math.max(oldBomParts.value.length, newBomParts.value.length),
);
const pagedOldBomParts = computed(() => pageRows(oldBomParts.value));
const pagedNewBomParts = computed(() => pageRows(newBomParts.value));
// const comparePermission = computed(() => {
//   if (isProjectCostVersionCompareRoute.value) {
//     return "cost:research:project-cost:version-compare-page:compare";
//   }
//   if (isNewProjectCostVersionCompareRoute.value) {
//     return "cost:research:new-project-cost:version-compare-page:compare";
//   }
//   if (route.path.startsWith("/cost/research/history/")) {
//     return "cost:research:history:version-compare-page:compare";
//   }
//   if (route.path.startsWith("/cost/research/new-history/")) {
//     return "cost:research:new-history:version-compare-page:compare";
//   }
//   return undefined;
// });
async function loadCompare() {
  loading.value = true;
  try {
    const response = await fetchCostBomVersionDiff({
      bomVersionId: bomVersionId.value,
      oldBomVersion: baseBomVersion.value,
      diffBomVersion: targetBomVersion.value,
      vehicleModelId: vehicleModelId.value || undefined,
      valveId: valveId.value || undefined,
    });
    applyDiffResponse(response);
  } catch (error) {
    applyDiffResponse({
      data: { diffParts: {}, diffStats: {}, oldBomSize: 0, diffBomSize: 0 },
    });
    BaseToast.warning(
      error instanceof Error && error.message
        ? error.message
        : "版本对比加载失败",
    );
  } finally {
    loading.value = false;
  }
}

function applyDiffResponse(response: Record<string, unknown>) {
  const data = asRecord(response.data ?? response);
  const diffParts = asRecord(data.diffParts);
  const oldChanged = readPartRows(diffParts.oldChangeParts, diffColor.changed);
  const changed = readPartRows(diffParts.changeParts, diffColor.changed);
  const deleted = readPartRows(diffParts.deleteParts, diffColor.deleted);
  const added = readPartRows(diffParts.addParts, diffColor.added);

  allOldBomParts.value = [...oldChanged, ...deleted];
  allNewBomParts.value = [...changed, ...added];
  oldBomParts.value = [...allOldBomParts.value];
  newBomParts.value = [...allNewBomParts.value];

  oldBomSize.value = readNumber(data.oldBomSize, allOldBomParts.value.length);
  diffBomSize.value = readNumber(data.diffBomSize, allNewBomParts.value.length);
  const stats = asRecord(data.diffStats);
  diffStats.changeCount = readNumber(stats.changeCount, changed.length);
  diffStats.deleteCount = readNumber(stats.deleteCount, deleted.length);
  diffStats.addCount = readNumber(stats.addCount, added.length);
  selectedOldPartId.value = "";
  selectedNewPartId.value = "";
  comparePage.value = 1;
}

function readPartRows(source: unknown, color: string): ComparePartRow[] {
  if (!Array.isArray(source)) {
    return [];
  }
  return source.map((item, index) => {
    const row = asRecord(item);
    const partNumber = readText(row, ["partNumber", "partNo", "number"]);
    const partName = readText(row, ["partName", "name"]);
    return {
      id: readText(row, ["id", "partId"], `${partNumber}-${partName}-${index}`),
      partNumber,
      partName,
      color,
      raw: row,
    };
  });
}

function applySearch() {
  oldBomParts.value = filterParts(allOldBomParts.value);
  newBomParts.value = filterParts(allNewBomParts.value);
  comparePage.value = 1;
}

function resetSearch() {
  searchForm.partNumber = "";
  searchForm.partName = "";
  oldBomParts.value = [...allOldBomParts.value];
  newBomParts.value = [...allNewBomParts.value];
  comparePage.value = 1;
}

function pageRows(parts: ComparePartRow[]) {
  const start = (comparePage.value - 1) * comparePageSize;
  return parts.slice(start, start + comparePageSize);
}

function filterParts(parts: ComparePartRow[]) {
  const partNumber = searchForm.partNumber.trim().toLowerCase();
  const partName = searchForm.partName.trim().toLowerCase();
  return parts.filter((item) => {
    const matchedNumber = partNumber
      ? item.partNumber.toLowerCase().includes(partNumber)
      : true;
    const matchedName = partName
      ? item.partName.toLowerCase().includes(partName)
      : true;
    return matchedNumber && matchedName;
  });
}

function compareSelectedParts() {
  const oldPart = oldBomParts.value.find(
    (item) => item.id === selectedOldPartId.value,
  );
  const newPart = newBomParts.value.find(
    (item) => item.id === selectedNewPartId.value,
  );
  if (!oldPart || !newPart) {
    BaseToast.warning("请在左右两侧各选择一个变更零件后再对比");
    return;
  }
  if (oldPart.partNumber !== newPart.partNumber) {
    BaseToast.warning("请选择左右两侧相同零件号的行进行对比");
    return;
  }
  router.push({
    path: `${versionHistoryBasePath.value}/versions/compare/parts`,
    query: {
      projectId: String(projectId.value || ""),
      bomVersionId: String(bomVersionId.value || ""),
      versionId: String(bomVersionId.value || ""),
      version: String(route.query.version || ""),
      baseVersionId: String(route.query.baseVersionId || ""),
      targetVersionId: String(route.query.targetVersionId || ""),
      baseBomVersion: baseBomVersion.value || undefined,
      targetBomVersion: targetBomVersion.value || undefined,
      oldPartId: oldPart.id,
      newPartId: newPart.id,
      partNumber: oldPart.partNumber,
      partName: oldPart.partName,
      vehicleModelId: vehicleModelId.value
        ? String(vehicleModelId.value)
        : undefined,
      valveId: valveId.value ? String(valveId.value) : undefined,
      activeMenu: route.query.activeMenu
        ? String(route.query.activeMenu)
        : undefined,
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
function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readText(
  source: Record<string, unknown>,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return fallback;
}

function readNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function goBack() {
  if (typeof route.query.returnPath === "string" && route.query.returnPath) {
    replaceToReturn(router, route, historyPath.value.path);
    return;
  }
  router.replace(historyPath.value);
}

onMounted(loadCompare);
</script>

<template>
  <PageContainer :title="pageTitle">
    <template #titleExtra>
      <span class="bq-page-inline-meta">
        {{ compareTitle }}
      </span>
    </template>
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack"
      >
        返回
      </PermissionButton>
    </template>

    <div class="cost-bom-version-compare-page">
      <div class="cost-bom-version-compare-page__search">
        <el-form :model="searchForm" inline>
          <el-form-item label="零件号">
            <el-input
              v-model="searchForm.partNumber"
              clearable
              placeholder="请输入零件号"
              @keyup.enter="applySearch"
            />
          </el-form-item>
          <el-form-item label="零件名称">
            <el-input
              v-model="searchForm.partName"
              clearable
              placeholder="请输入零件名称"
              @keyup.enter="applySearch"
            />
          </el-form-item>
        </el-form>
        <div class="cost-bom-version-compare-page__search-actions">
          <PermissionButton type="primary" :icon="Search" @click="applySearch">
            搜索
          </PermissionButton>
          <PermissionButton :icon="Refresh" @click="resetSearch"
            >重置</PermissionButton
          >
        </div>
      </div>

      <div class="cost-bom-version-compare-page__actions">
        <PermissionButton
          variant="secondary"
          :disabled="!selectedOldPartId || !selectedNewPartId"
          @click="compareSelectedParts"
        >
          对比
        </PermissionButton>
      </div>

      <div class="cost-bom-version-compare-page__tables">
        <section class="cost-bom-version-compare-page__panel">
          <div class="cost-bom-version-compare-page__panel-title">
            成本BOM-V{{ baseBomVersion || "--" }}版本-{{ oldBomSize }}件
          </div>
          <el-table
            v-loading="loading"
            :data="pagedOldBomParts"
            border
            height="420"
          >
            <el-table-column label="" width="50" align="center">
              <template #default="{ row }">
                <el-radio
                  v-if="row.color === diffColor.changed"
                  v-model="selectedOldPartId"
                  :label="row.id"
                  class="cost-bom-version-compare-page__radio"
                >
                  &nbsp;
                </el-radio>
              </template>
            </el-table-column>
            <el-table-column
              type="index"
              label="序号"
              width="70"
              align="center"
            />
            <el-table-column prop="partNumber" label="零件号" align="center">
              <template #default="{ row }">
                <span :style="{ color: row.color }">{{ row.partNumber }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="partName" label="零件名称" align="center">
              <template #default="{ row }">
                <span :style="{ color: row.color }">{{ row.partName }}</span>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <section class="cost-bom-version-compare-page__panel">
          <div class="cost-bom-version-compare-page__panel-title">
            <span>
              成本BOM-V{{ targetBomVersion || "--" }}版本-{{ diffBomSize }}件
            </span>
            <span class="is-changed"
              >变更零件:{{ diffStats.changeCount }}项</span
            >
            <span class="is-deleted"
              >删除零件:{{ diffStats.deleteCount }}项</span
            >
            <span class="is-added">新增零件:{{ diffStats.addCount }}项</span>
          </div>
          <el-table
            v-loading="loading"
            :data="pagedNewBomParts"
            border
            height="420"
          >
            <el-table-column label="" width="50" align="center">
              <template #default="{ row }">
                <el-radio
                  v-if="row.color === diffColor.changed"
                  v-model="selectedNewPartId"
                  :label="row.id"
                  class="cost-bom-version-compare-page__radio"
                >
                  &nbsp;
                </el-radio>
              </template>
            </el-table-column>
            <el-table-column
              type="index"
              label="序号"
              width="70"
              align="center"
            />
            <el-table-column prop="partNumber" label="零件号" align="center">
              <template #default="{ row }">
                <span :style="{ color: row.color }">{{ row.partNumber }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="partName" label="零件名称" align="center">
              <template #default="{ row }">
                <span :style="{ color: row.color }">{{ row.partName }}</span>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>
      <el-pagination
        v-if="compareTotal > comparePageSize"
        v-model:current-page="comparePage"
        class="cost-bom-version-compare-page__pagination"
        background
        layout="total, prev, pager, next"
        :page-size="comparePageSize"
        :total="compareTotal"
      />
    </div>
  </PageContainer>
</template>

<style scoped>
.cost-bom-version-compare-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cost-bom-version-compare-page__search {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.cost-bom-version-compare-page__search :deep(.el-input) {
  width: 260px;
}

.cost-bom-version-compare-page__search-actions,
.cost-bom-version-compare-page__actions {
  display: flex;
  gap: 10px;
}

.cost-bom-version-compare-page__tables {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
}

.cost-bom-version-compare-page__panel {
  min-width: 0;
}

.cost-bom-version-compare-page__pagination {
  justify-content: flex-end;
}

.cost-bom-version-compare-page__panel-title {
  display: flex;
  gap: 16px;
  align-items: center;
  min-height: 32px;
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 600;
}

.cost-bom-version-compare-page__panel-title .is-changed {
  color: var(--bq-color-warning);
}

.cost-bom-version-compare-page__panel-title .is-deleted {
  color: var(--bq-color-danger);
}

.cost-bom-version-compare-page__panel-title .is-added {
  color: var(--bq-color-success);
}

.cost-bom-version-compare-page__radio :deep(.el-radio__label) {
  display: none;
}
</style>
