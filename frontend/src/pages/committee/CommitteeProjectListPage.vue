<script setup lang="ts">
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { CirclePlus } from "@element-plus/icons-vue";
import { onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchCommitteeProjectCompanyOptions,
  fetchCommitteeProjects,
} from "@/api/committee";
import { fetchBusinessValveOptions } from "@/api/project";
import { fetchPlatformDictItems } from "@/api/platform-system";
import CommitteeDate from "./components/CommitteeDate.vue";
import BaseMoney from "@/components/base/BaseMoney.vue";
import BasePercent from "@/components/base/BasePercent.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import type { CommitteeProject } from "@/types/committee";
import type { BusinessValveItem } from "@/types/project";
import type { SchemaOption } from "@/types/schema-components";

const fallbackProjectGateStatusOptions: SchemaOption[] = [
  { label: "未关联", value: "UNASSOCIATED" },
  { label: "已过阀", value: "PASSED" },
  { label: "进行中", value: "IN_PROGRESS" },
];

const router = useRouter();
const route = useRoute();
function queryString(key: string) {
  const value = route.query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
const query = reactive({
  projectName: queryString("projectName"),
  brand: queryString("brand"),
  projectCategory: queryString("projectCategory"),
  productionBase: queryString("productionBase"),
  currentGateName: queryString("currentGateName"),
  committeeStatus: queryString("committeeStatus"),
  companyName: queryString("companyName"),
});
const valveOptions = ref<BusinessValveItem[]>([]);
const valveOptionsLoading = ref(false);
const projectGateStatusOptions = ref<SchemaOption[]>([]);
const projectCategoryOptions = ["在研", "在产"];
const companyOptions = ref<string[]>([]);

function resetQuery() {
  query.projectName = "";
  query.brand = "";
  query.projectCategory = "";
  query.productionBase = "";
  query.currentGateName = "";
  query.committeeStatus = "";
  query.companyName = "";
}

function valveOptionLabel(valve: BusinessValveItem) {
  return valve.valveName || valve.valveCode || String(valve.valveId);
}

function getProjectGateStatus(project: CommitteeProject) {
  if (!project.gateStatus
  ) {
    return "UNASSOCIATED";
  }
  if (project.gateStatus === "PASSED") {
    return "PASSED";
  }
  return "IN_PROGRESS";
}

function projectGateStatusLabel(project: CommitteeProject) {
  const status = getProjectGateStatus(project);
  return (
    projectGateStatusOptions.value.find(
      (option) => option.value === status,
    )?.label ??
    fallbackProjectGateStatusOptions.find(
      (option) => option.value === status,
    )?.label ??
    "--"
  );
}

type ProjectGateStatusTagType =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "primary";

function projectGateStatusType(
  project: CommitteeProject,
): ProjectGateStatusTagType {
  const status = getProjectGateStatus(project);
  const option = projectGateStatusOptions.value.find(
    (item) => item.value === status,
  );
  const styleClass = option?.styleClass || option?.listClass;
  if (
    styleClass === "success" ||
    styleClass === "warning" ||
    styleClass === "danger" ||
    styleClass === "info" ||
    styleClass === "primary"
  ) {
    return styleClass;
  }
  return option?.type || "info";
}

async function loadValveOptions() {
  valveOptionsLoading.value = true;
  try {
    const page = await fetchBusinessValveOptions();
    valveOptions.value = page.records;
  } finally {
    valveOptionsLoading.value = false;
  }
}

async function loadProjectGateStatusOptions() {
  try {
    projectGateStatusOptions.value = await fetchPlatformDictItems(
      "committee_gate_status",
    );
  } catch {
    projectGateStatusOptions.value = fallbackProjectGateStatusOptions;
  }
}

async function loadCompanyOptions() {
  try {
    companyOptions.value = await fetchCommitteeProjectCompanyOptions();
  } catch {
    companyOptions.value = [];
  }
}

onMounted(() => {
  void loadValveOptions();
  void loadProjectGateStatusOptions();
  void loadCompanyOptions();
});

async function load(pageSize: number, pageNo: number) {
  const result = await fetchCommitteeProjects({
    pageNum: pageNo,
    pageSize,
    ...query,
  });
  return { list: result.rows, total: result.total };
}

function displayValue(value: unknown): string {
  return value === undefined || value === null || value === ""
    ? "--"
    : String(value);
}

function creatorValue(project: CommitteeProject): string {
  return displayValue(project.createName ?? project.createBy ?? project.creator);
}

function numberValue(value: unknown): number | string | null | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return typeof value === "number" || typeof value === "string"
    ? value
    : undefined;
}

function goToCreate() {
  router.push("/committee/projects/create");
}

function projectRouteId(project: CommitteeProject): string {
  return String(project.id ?? project.projectId);
}

function goToDetail(project: CommitteeProject) {
  router.push(`/committee/projects/${projectRouteId(project)}`);
}

function goToProjectEdit(project: CommitteeProject) {
  router.push({
    path: `/committee/projects/${projectRouteId(project)}/edit`,
    query: { returnPath: route.fullPath || "/committee/projects" },
  });
}
</script>

<template>
  <PageContainer
    class="bq-management-page"
    title="上会项目管理"
    description="查看产品上会项目管理主数据、当前阀点、计划时间和推进状态。"
  >
    <div class="committee-project-list">
      <QueryTable
        :func="load"
        row-key="projectId"
        fit-table-height
        show-toolbar
        empty-title="暂无上会项目管理"
        empty-description="可通过“关联项目”将基础中心项目加入委员会流程。"
        @reset="resetQuery"
        :table-props="{ scrollbarAlwaysOn: true }"
      >
      <template #search>
        <el-form :model="query">
          <el-form-item label="所属公司">
            <el-select
              v-model="query.companyName"
              data-testid="project-filter-company"
              clearable
              filterable
              placeholder="请选择所属公司"
            >
              <el-option
                v-for="company in companyOptions"
                :key="company"
                :label="company"
                :value="company"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="项目代号">
            <el-input
              v-model="query.projectName"
              data-testid="project-filter-keyword"
              clearable
              placeholder="请输入项目代号"
            />
          </el-form-item>
          <el-form-item label="品牌">
            <el-input
              v-model="query.brand"
              data-testid="project-filter-brand"
              clearable
              placeholder="请输入品牌"
            />
          </el-form-item>
          <el-form-item label="项目分类">
            <el-select
              v-model="query.projectCategory"
              data-testid="project-filter-project-category"
              clearable
              placeholder="请选择项目分类"
            >
              <el-option
                v-for="category in projectCategoryOptions"
                :key="category"
                :label="category"
                :value="category"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="工厂名称">
            <el-input
              v-model="query.productionBase"
              data-testid="project-filter-production-base"
              clearable
              placeholder="请输入工厂名称"
            />
          </el-form-item>
          <el-form-item label="当前阀点">
            <el-select
              v-model="query.currentGateName"
              data-testid="project-filter-current-gate"
              clearable
              filterable
              :loading="valveOptionsLoading"
              placeholder="请选择当前阀点"
            >
              <el-option
                v-for="valve in valveOptions"
                :key="String(valve.valveId)"
                :label="valveOptionLabel(valve)"
                :value="
                  valve.valveName || valve.valveCode || String(valve.valveId)
                "
              />
            </el-select>
          </el-form-item>
<!--          <el-form-item label="阀点状态">-->
<!--            <el-select-->
<!--              v-model="query.committeeStatus"-->
<!--              data-testid="project-filter-current-status"-->
<!--              clearable-->
<!--              placeholder="全部状态"-->
<!--            >-->
<!--              <el-option-->
<!--                v-for="option in projectGateStatusOptions"-->
<!--                :key="option.value"-->
<!--                :label="option.label"-->
<!--                :value="option.value"-->
<!--              />-->
<!--            </el-select>-->
<!--          </el-form-item>-->
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="goToCreate"
        >
          关联项目
        </PermissionButton>
<!--        permission="committee:project:add"-->
      </template>
        <el-table-column label="所属公司"  show-overflow-tooltip>
          <template #default="{ row }: { row: CommitteeProject }">
            {{ row.owningCompany ||'--' }}
          </template>
        </el-table-column>
      <el-table-column label="项目代号"  prop="projectName" show-overflow-tooltip/>

      <el-table-column label="品牌"  show-overflow-tooltip>
        <template #default="{ row }: { row: CommitteeProject }">
          {{ displayValue(row.brandName) }}
        </template>
      </el-table-column>
      <el-table-column label="项目分类"  show-overflow-tooltip>
        <template #default="{ row }: { row: CommitteeProject }">
          {{ displayValue(row.projectCategory) }}
        </template>
      </el-table-column>
      <el-table-column label="工厂名称"  show-overflow-tooltip width="120">
        <template #default="{ row }: { row: CommitteeProject }">
          {{ displayValue(row.factoryName) }}
        </template>
      </el-table-column>
      <el-table-column label="项目总投资"  align="right" width="120">
        <template #default="{ row }: { row: CommitteeProject }">
          <BaseMoney :value="numberValue(row.totalInvestment)" />
        </template>
      </el-table-column>
      <el-table-column label="车型投资"  min-width="120" align="right">
        <template #default="{ row }: { row: CommitteeProject }">
          <BaseMoney :value="numberValue(row.vehicleModelInvestment)" />
        </template>
      </el-table-column>
      <el-table-column label="预算执行率"  align="right">
        <template #default="{ row }: { row: CommitteeProject }">
          <BasePercent
            :numerator="numberValue(row.executionRate)"
            :denominator="100"
          />
        </template>
      </el-table-column>
      <el-table-column label="当前阀点" >
        <template #default="{ row }: { row: CommitteeProject }">
          {{ displayValue(row.currentGateName) }}
        </template>
      </el-table-column>
      <el-table-column label="阀点计划时间" width="160"  align="center">
        <template #default="{ row }: { row: CommitteeProject }">
          <CommitteeDate :value="row.plannedFinishDate" />
        </template>
      </el-table-column>
      <el-table-column label="阀点状态"  align="center">
        <template #default="{ row }: { row: CommitteeProject }">
          <BaseStatusTag
            :label="projectGateStatusLabel(row)"
            :type="projectGateStatusType(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建人"  width="120" show-overflow-tooltip>
        <template #default="{ row }: { row: CommitteeProject }">
          {{ creatorValue(row) }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="160"  prop="createTime" align="center">
        <template #default="{ row }: { row: CommitteeProject }">
          <CommitteeDate :value="row.createTime" with-seconds />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right" align="center">
        <template #default="{ row }: { row: CommitteeProject }">
          <div class="bq-table-actions committee-project-list__actions">
            <PermissionButton
              link

              @click="goToDetail(row)"
            >
              查看
<!--              permission="committee:project:view"-->
            </PermissionButton>
            <PermissionGuard>
              <PermissionButton
                link

                @click="goToProjectEdit(row)"
              >
                编辑
<!--                permission="committee:project:edit"-->
              </PermissionButton>
            </PermissionGuard>
          </div>
        </template>
      </el-table-column>
      </QueryTable>
    </div>
  </PageContainer>
</template>

<style scoped>
.committee-project-list {
  display: contents;
}

.committee-project-list__actions {
  flex-wrap: nowrap;
  gap: 8px;
  white-space: nowrap;
}

.committee-project-list__actions :deep(.el-button) {
  margin-left: 0;
  padding-inline: 0;
}


@media (max-width: 900px) {
  .committee-project-list :deep(.base-search-form) {
    display: grid;
    gap: 12px;
  }

  .committee-project-list :deep(.base-search-form__content) {
    padding-right: 0;
  }

  .committee-project-list :deep(.base-search-form__content .el-form) {
    grid-template-columns: 1fr;
  }

  .committee-project-list :deep(.base-search-form__content .el-form-item__label) {
    white-space: nowrap;
  }

  .committee-project-list :deep(.base-search-form__actions) {
    justify-content: flex-end;
  }

  .committee-project-list :deep(.base-search-form__toggle) {
    position: static;
  }
}
</style>
