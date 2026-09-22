<script setup lang="ts">
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import DictTag from "@/components/base/DictTag.vue";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchCommitteeDepartments,
  fetchCommitteeProjectCompanyOptions,
  fetchCommitteeProjects,
  fetchCommitteeReviewTasks,
} from "@/api/committee";
import { fetchBusinessValveOptions } from "@/api/project";
import { fetchPlatformDictItems } from "@/api/platform-system";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import CommitteeDate from "./components/CommitteeDate.vue";
import type {
  CommitteeConfigDepartment,
  CommitteeProject,
  CommitteeReviewTask,
} from "@/types/committee";
import type { BusinessValveItem } from "@/types/project";
import type { SchemaOption } from "@/types/schema-components";
import {
  committeeRows,
  committeeDepartmentGroupLabel,
  committeeStatusLabel,
  committeeTagType,
  committeeTotal,
} from "./committee-ui";

const router = useRouter();
const route = useRoute();
const tracking = computed(() => route.name === "committeeReviewTracking");
function queryString(key: string) {
  const value = route.query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
const query = reactive({
  projectId: queryString("projectId"),
  valveId: queryString("valveId"),
  taskStatus: queryString("taskStatus"),
  departmentGroup: queryString("departmentGroup"),
  departmentId: queryString("departmentId"),
  approvalResult:
    queryString("approvalResult") || queryString("actionRequirement"),
  companyName: queryString("companyName"),
});
const valveOptions = ref<BusinessValveItem[]>([]);
const valveOptionsLoading = ref(false);
const projectOptions = ref<CommitteeProject[]>([]);
const projectOptionsLoading = ref(false);
const departmentOptions = ref<CommitteeConfigDepartment[]>([]);
const departmentOptionsLoading = ref(false);
const companyOptions = ref<string[]>([]);
const REVIEW_STATUS_DICT_TYPE = "committee_review_status";
const APPROVAL_RESULT_STATUS_DICT_TYPE = "committee_approval_result_status";
const fallbackReviewStatusOptions: SchemaOption[] = [
  { value: "NOT_STARTED", label: committeeStatusLabel("NOT_STARTED") },
  { value: "DRAFT", label: committeeStatusLabel("DRAFT") },
  { value: "PENDING_APPROVAL", label: committeeStatusLabel("PENDING_APPROVAL") },
  { value: "APPROVED", label: committeeStatusLabel("APPROVED") },
  { value: "WAITING_MEETING", label: committeeStatusLabel("WAITING_MEETING") },
  { value: "REJECTED", label: committeeStatusLabel("REJECTED") },
  { value: "ARCHIVED", label: committeeStatusLabel("ARCHIVED") },
];
const fallbackApprovalResultOptions: SchemaOption[] = [
  { value: "WAITING_APPROVAL", label: "待审批" },
  { value: "APPROVE", label: "同意" },
  { value: "REJECT", label: "驳回" },
  { value: "TO_FILL", label: "暂无结果" },
];
const reviewStatusOptions = ref<SchemaOption[]>(fallbackReviewStatusOptions);
const approvalResultOptions = ref<SchemaOption[]>(
  fallbackApprovalResultOptions,
);
const secondConfirmStatusOptions = ref<SchemaOption[]>([]);
const departmentGroupOptions = [
  {
    value: "SECOND_COMPANY",
    label: committeeDepartmentGroupLabel("SECOND_COMPANY"),
  },
  { value: "GROUP", label: committeeDepartmentGroupLabel("GROUP") },
];
function resetQuery() {
  query.projectId = "";
  query.valveId = "";
  query.taskStatus = "";
  query.departmentGroup = "";
  query.departmentId = "";
  query.approvalResult = "";
  query.companyName = "";
}
async function loadProjectOptions(keyword = "") {
  projectOptionsLoading.value = true;
  try {
    const normalizedKeyword = keyword.trim();
    const result = await fetchCommitteeProjects({
      pageNum: 1,
      pageSize: 50,
      ...(normalizedKeyword ? { projectName: normalizedKeyword } : {}),
    });
    projectOptions.value = result.rows;
  } finally {
    projectOptionsLoading.value = false;
  }
}
function valveOptionLabel(valve: BusinessValveItem) {
  return valve.valveName || valve.valveCode || String(valve.valveId);
}
function departmentOptionLabel(department: CommitteeConfigDepartment) {
  return department.departmentName || String(department.departmentId);
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
async function loadDepartmentOptions() {
  departmentOptionsLoading.value = true;
  try {
    const departments = await fetchCommitteeDepartments();
    departmentOptions.value = departments;
  } finally {
    departmentOptionsLoading.value = false;
  }
}
async function loadCompanyOptions() {
  try {
    companyOptions.value = await fetchCommitteeProjectCompanyOptions();
  } catch {
    companyOptions.value = [];
  }
}
async function load(pageSize: number, pageNo: number) {
  const result = await fetchCommitteeReviewTasks({
    pageNum: pageNo,
    pageSize,
    projectId: query.projectId || undefined,
    valveId: query.valveId || undefined,
    taskStatus: query.taskStatus || undefined,
    departmentGroup: query.departmentGroup || undefined,
    departmentId: query.departmentId || undefined,
    approvalResult: query.approvalResult || undefined,
    companyName: query.companyName || undefined,
  });
  return { list: committeeRows(result), total: committeeTotal(result) };
}
function isReviewArchived(row: CommitteeReviewTask) {
  return String(row.taskStatus ?? "").trim().toUpperCase() === "ARCHIVED";
}
function isReviewPendingApproval(row: CommitteeReviewTask) {
  return (
    String(row.taskStatus ?? "").trim().toUpperCase() === "PENDING_APPROVAL"
  );
}
function isReviewViewOnly(row: CommitteeReviewTask) {
  return isReviewArchived(row);
}
function canEditReview(row: CommitteeReviewTask) {
  return !isReviewArchived(row) && !isReviewPendingApproval(row);
}
function open(row: CommitteeReviewTask, mode = "view") {
  if (mode === "edit" && !canEditReview(row)) return;
  const taskId = String(row.id ?? "").trim();
  if (!taskId) return;
  router.push({ path: `/committee/reviews/${taskId}`, query: { mode } });
}
function rowText(row: CommitteeReviewTask, key: string) {
  const record = row as CommitteeReviewTask & Record<string, unknown>;
  return String(record[key] ?? "--");
}
function companyText(row: CommitteeReviewTask) {
  return rowText(row, "owningCompany") !== "--"
    ? rowText(row, "owningCompany")
    : rowText(row, "companyName");
}
function approvalResultValue(row: CommitteeReviewTask) {
  const currentRecord = row.records?.find(
    (record) => String(record.id) === String(row.currentRecordId),
  ) ?? row.records?.[0];
  return currentRecord?.approvalAction?.trim() || undefined;
}
function secondaryConfirmText(row: CommitteeReviewTask) {
  const record = row as CommitteeReviewTask & Record<string, unknown>;
  const value =
    record.secondCompanyConfirmStatus ??
    record.secondaryCompanyConfirmStatus ??
    record.secondConfirmStatus;
  if (!value) return "--";
  return (
    secondConfirmStatusOptions.value.find(
      (option) => String(option.value) === String(value),
    )?.label ?? committeeStatusLabel(String(value))
  );
}
function secondaryConfirmTagType(row: CommitteeReviewTask) {
  const record = row as CommitteeReviewTask & Record<string, unknown>;
  const value =
    record.secondCompanyConfirmStatus ??
    record.secondaryCompanyConfirmStatus ??
    record.secondConfirmStatus;
  const option = secondConfirmStatusOptions.value.find(
    (item) => String(item.value) === String(value ?? ""),
  );
  const styleClass = option?.styleClass || option?.listClass;
  if (["success", "warning", "danger", "info", "primary"].includes(styleClass ?? "")) {
    return styleClass as "success" | "warning" | "danger" | "info" | "primary";
  }
  return option?.type || committeeTagType(value ? String(value) : undefined);
}
function reviewDeadlineValue(
  row: CommitteeReviewTask,
): string | number | Date | null | undefined {
  const record = row as CommitteeReviewTask & Record<string, unknown>;
  const value =
    record.reviewDeadlineTime ??
    record.reviewDeadline ??
    record.deadlineTime ??
    undefined;
  return typeof value === "string" ||
    typeof value === "number" ||
    value instanceof Date
    ? value
    : null;
}

async function loadDictOptions(
  dictTypeCode: string,
  fallbackOptions: SchemaOption[],
) {
  try {
    const items = await fetchPlatformDictItems(dictTypeCode);
    return items.length ? items : fallbackOptions;
  } catch {
    return fallbackOptions;
  }
}

onMounted(() => {
  void loadProjectOptions();
  void loadValveOptions();
  void loadDepartmentOptions();
  void loadCompanyOptions();
  void loadDictOptions(REVIEW_STATUS_DICT_TYPE, fallbackReviewStatusOptions).then(
    (items) => {
      reviewStatusOptions.value = items;
    },
  );
  void loadDictOptions(
    APPROVAL_RESULT_STATUS_DICT_TYPE,
    fallbackApprovalResultOptions,
  ).then((items) => {
    approvalResultOptions.value = items;
  });
  void fetchPlatformDictItems("committee_second_confirm_status").then(
    (items) => {
      secondConfirmStatusOptions.value = items;
    },
    () => {
      secondConfirmStatusOptions.value = [];
    },
  );
});
</script>

<template>
  <PageContainer
    class="bq-management-page"
    :title="tracking ? '部门评审跟踪' : '阀点评审列表'"
  >
    <QueryTable
      :func="load"
      row-key="id"
      fit-table-height
      show-toolbar
      empty-title="暂无评审任务"
      empty-description="当前筛选条件下没有可展示的阀点评审任务。"
      @reset="resetQuery"
      :table-props="{ scrollbarAlwaysOn: true }"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="所属公司">
            <el-select
              v-model="query.companyName"
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
            <el-select
              v-model="query.projectId"
              clearable
              filterable
              remote
              :loading="projectOptionsLoading"
              :remote-method="loadProjectOptions"
              placeholder="请输入项目代号"
              @visible-change="
                (visible: boolean) => visible && loadProjectOptions()
              "
            >
              <el-option
                v-for="project in projectOptions"
                :key="String(project.projectId)"
                :label="project.projectName || String(project.projectId)"
                :value="String(project.projectId)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="阀点">
            <el-select
              v-model="query.valveId"
              clearable
              filterable
              :loading="valveOptionsLoading"
              placeholder="请选择阀点"
            >
              <el-option
                v-for="valve in valveOptions"
                :key="String(valve.valveId)"
                :label="valveOptionLabel(valve)"
                :value="String(valve.valveId)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="评审部门分类">
            <el-select
              v-model="query.departmentGroup"
              clearable
              placeholder="请选择评审部门分类"
            >
              <el-option
                v-for="item in departmentGroupOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="评审部门">
            <el-select
              v-model="query.departmentId"
              clearable
              filterable
              :loading="departmentOptionsLoading"
              placeholder="请选择评审部门"
            >
              <el-option
                v-for="department in departmentOptions"
                :key="String(department.departmentId)"
                :label="departmentOptionLabel(department)"
                :value="String(department.departmentId)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="评审状态">
            <el-select
              v-model="query.taskStatus"
              clearable
              placeholder="请选择评审状态"
            >
              <el-option
                v-for="item in reviewStatusOptions"
                :key="String(item.value)"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="审批结果">
            <el-select
              v-model="query.approvalResult"
              clearable
              placeholder="请选择审批结果"
            >
              <el-option
                v-for="item in approvalResultOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <template #toolbar>
        <PermissionButton
          v-if="tracking"
          @click="router.push('/committee/reviews')"
        >
          返回评审列表
        </PermissionButton>
      </template>
      <el-table-column label="所属公司" align="center">
        <template #default="{ row }">
          {{ companyText(row) }}
        </template>
      </el-table-column>
      <el-table-column
        label="项目代号"
        align="center"
        show-overflow-tooltip
      >
        <template #default="{ row }">{{
          rowText(row, "projectName")
        }}</template>
      </el-table-column>

      <el-table-column label="阀点" align="center">
        <template #default="{ row }">{{ rowText(row, "gateName") }}</template>
      </el-table-column>
      <el-table-column
        prop="departmentName"
        label="评审部门"
        align="center"
      />
      <el-table-column label="评审状态" width="120" align="center">
        <template #default="{ row }">
          <span class="committee-review-status-cell">
            <DictTag
              :value="row.taskStatus"
              :options="reviewStatusOptions"
            />
          </span>
        </template>
      </el-table-column>
      <el-table-column label="审批结果" align="center">
        <template #default="{ row }">
          <DictTag
            v-if="approvalResultValue(row)"
            :value="approvalResultValue(row)"
            :options="approvalResultOptions"
          />
          <span v-else>--</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="currentVersionNo"
        label="当前版本"
        align="center"
      >
        <template #default="{ row }">
          {{ row.currentVersionNo ? `V${row.currentVersionNo}` : "--" }}
        </template>
      </el-table-column>
      <el-table-column label="品牌公司确认" width="120" align="center">
        <template #default="{ row }">
          <BaseStatusTag
            v-if="secondaryConfirmText(row) !== '--'"
            :label="secondaryConfirmText(row)"
            :type="secondaryConfirmTagType(row)"
          />
          <span v-else>--</span>
        </template>
      </el-table-column>
      <el-table-column label="评审截止" width="160" prop="reviewDeadlineTime">
        <template #default="{ row }">
          <CommitteeDate :value="reviewDeadlineValue(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right" align="center">
        <template #default="{ row }: { row: CommitteeReviewTask }">
          <PermissionButton
            link

            @click="open(row, 'view')"
            >查看
<!--            permission="committee:project:gate-review-query"-->
          </PermissionButton
          >

          <PermissionButton
              v-if="!isReviewViewOnly(row) && canEditReview(row)"
              link
              permission="committee:project:gate-review-edit"
              @click="open(row, 'edit')"
          >编辑</PermissionButton
          >

          <PermissionButton
              v-if="!isReviewViewOnly(row) && row.taskStatus === 'APPROVED'"
              link
              permission="committee:project:gate-review-reply"
              @click="open(row, 'reply')"
          >回复</PermissionButton
          >
          <!--审批-->
          <PermissionButton
              v-if="!isReviewViewOnly(row) && row.taskStatus === 'PENDING_APPROVAL'"
              link
              permission="committee:project:gate-review-approve"
              @click="open(row, 'approve')"
          >审批
          </PermissionButton
          >
<!--建议-->
          <PermissionButton
              v-if="!isReviewViewOnly(row)"
              link
              permission="committee:review:list-suggest"
              @click="open(row, 'suggest')"
          >建议
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>
  </PageContainer>
</template>

<style scoped>
.is-muted {
  color: var(--bq-color-text-muted);
}

.committee-review-status-cell {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  overflow: visible;
  white-space: nowrap;
}
</style>
