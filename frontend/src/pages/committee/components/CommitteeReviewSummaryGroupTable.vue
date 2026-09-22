<script setup lang="ts">
import { computed } from "vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import DictTag from "@/components/base/DictTag.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type { CommitteeReviewSummary } from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import {
  committeeDepartmentGroupLabel,
  committeeStatusLabel,
  committeeTagType,
} from "../committee-ui";
import CommitteeDate from "./CommitteeDate.vue";

type ReviewSummaryGroup = CommitteeReviewSummary["groups"][number];
type ReviewSummaryDepartment = ReviewSummaryGroup["departments"][number];

const props = defineProps<{
  group: ReviewSummaryGroup;
  companyName?: string | null;
  versionColumnLabel?: string;
  showDecisionActions?: boolean;
  meetingConclusionDecision?: string;
  showReturnModifyDepartments?: boolean;
  selectedDepartmentIds?: string[];
  showSecondMeetingStatus?: boolean;
  showSecondConfirmActions?: boolean;
  secondConfirms?: Array<Record<string, unknown>>;
  secondConfirmStatusOptions?: SchemaOption[];
  reviewStatusOptions?: SchemaOption[];
  conclusionStatusOptions?: SchemaOption[];
}>();

const emit = defineEmits<{
  "view-details": [departmentGroup: string, row: ReviewSummaryDepartment];
  decision: [
    departmentGroup: string,
    row: ReviewSummaryDepartment,
    action: "approve" | "reject",
  ];
  "toggle-return-modify-department": [departmentId: string];
  "second-confirm": [
    confirm: Record<string, unknown>,
    action: "approve" | "reject",
  ];
}>();

const formalCount = computed(
  () =>
    props.group.departments.filter(
      (row) =>
        row.currentVersionNo !== null && row.currentVersionNo !== undefined,
    ).length,
);

function statusLabel(value?: string) {
  if (value === "NOT_STARTED") return "未提交";
  return committeeStatusLabel(value);
}

function versionLabel(value?: number) {
  return value !== null && value !== undefined ? `V${value}` : "--";
}

function submitTime(row: ReviewSummaryDepartment) {
  return row.currentRecord?.submitTime;
}

function approvalTime(row: ReviewSummaryDepartment) {
  const record = row.currentRecord as
    | (ReviewSummaryDepartment["currentRecord"] &
        Record<string, string | undefined>)
    | undefined;
  return (
    record?.approveTime ??
    record?.approvalTime ??
    record?.auditTime ??
    record?.reviewTime ??
    record?.headApproveTime
  );
}

function secondConfirmStatus(row: ReviewSummaryDepartment) {
  return row.secondConfirmStatus;
}

function conclusionStatus(row: ReviewSummaryDepartment) {
  return row.conclusionSignal ?? row.currentRecord?.content?.conclusionSignal;
}

function signalClass(value?: string | null) {
  return `is-${String(value ?? "EMPTY").toLowerCase()}`;
}

function hasSignal(value?: string | null) {
  return value === "GREEN" || value === "YELLOW" || value === "RED";
}

function secondConfirm(row: ReviewSummaryDepartment) {
  const recordId = String(row.currentRecord?.id ?? "");
  const record = row.currentRecord as
    | (ReviewSummaryDepartment["currentRecord"] & Record<string, unknown>)
    | undefined;
  const taskId = String(record?.taskId ?? "");
  return props.secondConfirms?.find(
    (item) =>
      String(item.departmentId ?? "") === String(row.departmentId) ||
      (recordId && String(item.reviewRecordId ?? "") === recordId) ||
      (recordId && String(item.recordId ?? "") === recordId) ||
      (taskId && String(item.reviewTaskId ?? "") === taskId),
  );
}

function canShowSecondConfirmActions(row: ReviewSummaryDepartment) {
  return (
    props.showSecondConfirmActions &&
    String(row.secondConfirmStatus ?? "") === "NOT_REVIEWED"
  );
}

function secondConfirmLabel(row: ReviewSummaryDepartment) {
  const status = String(secondConfirmStatus(row) ?? "");
  return status
    ? (props.secondConfirmStatusOptions?.find(
        (option) => String(option.value) === status,
      )?.label ?? statusLabel(status))
    : "--";
}

function secondConfirmTagType(row: ReviewSummaryDepartment) {
  const status = String(secondConfirmStatus(row) ?? "");
  const option = props.secondConfirmStatusOptions?.find(
    (item) => String(item.value) === status,
  );
  const styleClass = option?.styleClass || option?.listClass;
  if (
    ["success", "warning", "danger", "info", "primary"].includes(
      styleClass ?? "",
    )
  ) {
    return styleClass as "success" | "warning" | "danger" | "info" | "primary";
  }
  return option?.type || committeeTagType(status || undefined);
}

function viewDetails(row: ReviewSummaryDepartment) {
  emit("view-details", props.group.departmentGroup, row);
}

function isDepartmentSelected(row: ReviewSummaryDepartment) {
  return (
    props.selectedDepartmentIds?.includes(String(row.departmentId)) ?? false
  );
}

function rowClassName({ row }: { row: ReviewSummaryDepartment }) {
  return isDepartmentSelected(row) ? "is-return-modify-selected" : "";
}

const canShowDecisionActions = computed(
  () =>
    props.showDecisionActions &&
    ["PASS", "CONDITIONAL_PASS", "通过", "带条件通过"].includes(
      props.meetingConclusionDecision ?? "",
    ),
);

function decide(row: ReviewSummaryDepartment, action: "approve" | "reject") {
  emit("decision", props.group.departmentGroup, row, action);
}

function decideSecondConfirm(
  row: ReviewSummaryDepartment,
  action: "approve" | "reject",
) {
  const confirm = secondConfirm(row);
  emit(
    "second-confirm",
    confirm ?? {
      departmentId: row.departmentId,
      reviewRecordId: row.currentRecord?.id,
    },
    action,
  );
}
</script>

<template>
  <article class="summary-group">
    <header class="summary-group__header">
      <h3>
        {{ committeeDepartmentGroupLabel(group.departmentGroup, companyName) }}
      </h3>
      <span>
        已形成正式版 {{ formalCount }} / {{ group.departments.length }} 个部室
      </span>
    </header>

    <el-table
      :data="group.departments"
      border
      class="summary-group__table"
      :table-layout="'fixed'"
      :row-class-name="rowClassName"
    >
      <el-table-column
        v-if="showReturnModifyDepartments"
        label="返回修改"
        width="80"
        align="center"
      >
        <template #default="{ row }">
          <el-checkbox
            :model-value="isDepartmentSelected(row)"
            @change="
              emit('toggle-return-modify-department', String(row.departmentId))
            "
          />
        </template>
      </el-table-column>
      <el-table-column label="部室" min-width="180">
        <template #default="{ row }">
          <span class="committee-text-strong summary-group__department">
            {{ row.departmentName }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="评审状态" width="140" align="center">
        <template #default="{ row }">
          <DictTag
            :value="row.taskStatus"
            :options="reviewStatusOptions ?? []"
          />
        </template>
      </el-table-column>
      <el-table-column label="结论建议" width="140" align="center">
        <template #default="{ row }">
          <span
            class="summary-group__signal"
            :class="signalClass(conclusionStatus(row))"
          >
            <i
              v-if="hasSignal(conclusionStatus(row))"
              class="summary-group__signal-dot"
              :class="signalClass(conclusionStatus(row))"
              role="img"
              :aria-label="`${conclusionStatus(row)} 结论建议`"
            />
            <span v-else>--</span>
          </span>
        </template>
      </el-table-column>

      <el-table-column label="最新更新时间" min-width="320">
        <template #default="{ row }">
          <div class="summary-group__time-cell">
            <span class="summary-group__time-item">
              <span>提交</span>
              <span class="committee-text-strong"
                ><CommitteeDate :value="submitTime(row)" with-seconds
              /></span>
            </span>
            <span class="summary-group__time-item">
              <span>审批</span>
              <span class="committee-text-strong"
                ><CommitteeDate :value="approvalTime(row)" with-seconds
              /></span>
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="versionColumnLabel ?? '评审版本'" width="100" align="center">
        <template #default="{ row }">
          <span class="summary-group__version">
            {{ versionLabel(row.currentVersionNo) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column
        v-if="showSecondMeetingStatus"
        label="品牌公司确认"
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <BaseStatusTag
            v-if="secondConfirmStatus(row)"
            :label="secondConfirmLabel(row)"
            :type="secondConfirmTagType(row)"
          />
          <span v-else>--</span>
        </template>
      </el-table-column>
      <el-table-column
        :label="showDecisionActions ? '操作' : '操作'"
        :width="showSecondConfirmActions ? 190 : canShowDecisionActions ? 150 : 70"
        align="center"
        fixed="right"
      >
        <template #default="{ row }">
          <div class="summary-group__actions bq-table-actions">
            <PermissionButton link @click="viewDetails(row)">
              查看
            </PermissionButton>
            <template
              v-if="
                canShowDecisionActions &&
                row.taskStatus === 'PENDING_APPROVAL' &&
                row.currentRecord?.recordStatus === 'PENDING_APPROVAL'
              "
            >
              <PermissionButton
                link
                @click="decide(row, 'approve')"
              >
                同意
              </PermissionButton>
              <PermissionButton
                link
                type="danger"
                permission="committee:review:reject"
                @click="decide(row, 'reject')"
              >
                驳回
              </PermissionButton>
            </template>
            <template v-if="canShowSecondConfirmActions(row)">
              <PermissionButton
                link
                @click="decideSecondConfirm(row, 'approve')"
              >
                同意
              </PermissionButton>
              <PermissionButton
                link
                type="danger"
                @click="decideSecondConfirm(row, 'reject')"
              >
                驳回
              </PermissionButton>
            </template>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </article>
</template>

<style scoped>
.summary-group {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.summary-group + .summary-group {
  padding-top: 4px;
}

.summary-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.summary-group__header h3 {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  font-weight: 700;
  line-height: 24px;
}

.summary-group__header span {
  flex: 0 0 auto;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: var(--bq-font-body, 13px);
  line-height: 22px;
}

.summary-group__table {
  width: 100%;
  overflow: hidden;
  border-radius: var(--bq-radius-control, 4px);
}

.summary-group__table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.summary-group__table :deep(.el-table__header-wrapper th.el-table__cell) {
  height: 44px;
  padding: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-weight: 700;
  background: var(--bq-color-table-header, #f0f1f2);
}

.summary-group__table :deep(.el-table__cell) {
  border-color: var(--bq-color-border-subtle, var(--el-border-color-lighter));
}

.summary-group__table :deep(.is-return-modify-selected td.el-table__cell) {
  background: var(--el-color-primary-light-9);
}

.summary-group__table :deep(.el-table__body-wrapper td.el-table__cell) {
  height: 55px;
  padding: 0;
}

.summary-group__table :deep(.el-table__cell .cell) {
  padding: 0 12px !important;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 13px);
  line-height: 22px;
}

.summary-group__table :deep(.el-button.is-link) {
  height: 22px;
  padding: 0;
  font-size: var(--bq-font-body, 13px);
  line-height: 22px;
}

.summary-group__actions {
  gap: 6px;
  min-width: 0;
}

.summary-group__actions :deep(.el-button.is-link) {
  min-height: 22px;
  padding: 0 4px;
  margin: 0;
}

.summary-group__department {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-weight: 700;
}

.summary-group__signal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
}

.summary-group__signal-dot {
  display: inline-flex;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--bq-color-text-muted, var(--el-color-info));
}

.summary-group__signal-dot.is-green {
  background: var(--bq-color-success, var(--el-color-success));
}

.summary-group__signal-dot.is-yellow {
  background: var(--bq-color-warning, var(--el-color-warning));
}

.summary-group__signal-dot.is-red {
  background: var(--bq-color-danger, var(--el-color-danger));
}

.summary-group__time-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
  min-width: 0;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
}

.summary-group__time-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.summary-group__time-item span {
  flex: 0 0 auto;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
}

.summary-group__time-item .committee-text-strong,
.summary-group__version {
  min-width: 0;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-weight: 500;
}

.summary-group__time-item .committee-text-strong {
  overflow-wrap: anywhere;
  word-break: break-word;
}

@media (max-width: 760px) {
  .summary-group__header,
  .summary-group__time-cell {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-group__header span {
    flex: 1 1 auto;
  }

  .summary-group__time-cell {
    gap: 6px;
    white-space: normal;
  }
}
</style>
