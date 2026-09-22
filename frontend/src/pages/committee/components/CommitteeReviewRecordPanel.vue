<script setup lang="ts">
import { computed, ref } from "vue";
import DictTag from "@/components/base/DictTag.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type { CommitteeId } from "@/types/committee";
import type { CommitteeReviewRecord } from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import CommitteeDate from "./CommitteeDate.vue";
import CommitteeReviewDetailDrawer from "./CommitteeReviewDetailDrawer.vue";

const props = withDefaults(
  defineProps<{
    reviewRecordId?: CommitteeId;
    records?: CommitteeReviewRecord[];
    reviewStatusOptions?: SchemaOption[];
    approvalResultOptions?: SchemaOption[];
    conclusionStatusOptions?: SchemaOption[];
  }>(),
  {
    records: () => [],
  },
);

const selectedRecord = ref<CommitteeReviewRecord>();
const detailVisible = ref(false);

const sortedRecords = computed(() =>
  [...props.records].sort((a, b) => Number(b.versionNo) - Number(a.versionNo)),
);

function recordValue(
  record: CommitteeReviewRecord,
  keys: string[],
): string | number | Date | null | undefined {
  const source = record as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && value !== "") {
      return value as string | number | Date;
    }
  }
  return undefined;
}

function approvalResultForRecord(record: CommitteeReviewRecord) {
  const value = recordValue(record, ["approvalAction"]);
  return value == null ? undefined : String(value);
}

function approvalTime(record: CommitteeReviewRecord) {
  return recordValue(record, [
    "approveTime",
    "approvalTime",
    "auditTime",
    "reviewTime",
    "headApproveTime",
    "updateTime",
  ]);
}

function meetingText(record: CommitteeReviewRecord) {
  const meetingTitles = record.meetingDetails
    ?.map((meeting) => meeting.meetingTitle)
    .filter(Boolean);

  if (meetingTitles?.length) {
    return meetingTitles.join("、");
  }

  return record.meetingName ? String(record.meetingName) : "--";
}

function openDetail(record: CommitteeReviewRecord) {
  selectedRecord.value = record;
  detailVisible.value = true;
}
</script>

<template>
  <section class="review-record-panel bq-detail-panel">
    <BaseSectionTitle
      class="review-record-panel__header"
      title="本部室评审记录"
      heading-tag="h2"
    />

    <el-table
      :data="sortedRecords"
      border
      empty-text="暂无正式版本"
      class="review-record-panel__table"
      :table-layout="'fixed'"
    >
      <el-table-column label="版本" width="80" align="center">
        <template #default="{ row }">
          <span class="committee-text-strong review-record-panel__version">
            V{{ row.versionNo }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" min-width="150">
        <template #default="{ row }">
          <CommitteeDate :value="row.submitTime" with-seconds />
        </template>
      </el-table-column>
      <el-table-column label="审批时间" min-width="150">
        <template #default="{ row }">
          <CommitteeDate :value="approvalTime(row)" with-seconds />
        </template>
      </el-table-column>
      <el-table-column label="审批结果" width="120" align="center">
        <template #default="{ row }">
          <DictTag
            :value="approvalResultForRecord(row)"
            :options="approvalResultOptions ?? []"
          />
        </template>
      </el-table-column>
      <el-table-column label="关联会议" min-width="180">
        <template #default="{ row }">
          <span class="review-record-panel__meeting">
            {{ meetingText(row) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column fixed="right" label="操作" width="70" align="center">
        <template #default="{ row }">
          <PermissionButton
            link
            @click="openDetail(row)"
          >
            查看
          </PermissionButton>
        </template>
      </el-table-column>
    </el-table>

    <CommitteeReviewDetailDrawer
      v-model="detailVisible"
      title="版本详情"
      :review-record-id="selectedRecord?.id"
      :record="selectedRecord"
      :review-status-options="reviewStatusOptions"
      :approval-result-options="approvalResultOptions"
      :conclusion-status-options="conclusionStatusOptions"
    />
  </section>
</template>

<style scoped>
.review-record-panel {
  display: grid;
  gap: 18px;
}

.review-record-panel__header h2,
.review-record-panel__content h3,
.review-record-panel__content p {
  margin: 0;
}

.review-record-panel__header h2 {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-section-title, 16px);
  font-weight: 700;
  line-height: 24px;
}

.review-record-panel__table {
  width: 100%;
  overflow: hidden;
  border-radius: var(--bq-radius-control, 4px);
}

.review-record-panel__table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.review-record-panel__table :deep(.el-table__header-wrapper th.el-table__cell) {
  height: 44px;
  padding: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-weight: 700;
  background: var(--bq-color-table-header, #f0f1f2);
}

.review-record-panel__table :deep(.el-table__cell) {
  border-color: var(--bq-color-border-subtle, var(--el-border-color-lighter));
}

.review-record-panel__table :deep(.el-table__body-wrapper td.el-table__cell) {
  height: 55px;
  padding: 0;
}

.review-record-panel__table :deep(.el-table__cell .cell) {
  padding: 0 12px !important;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-body, 13px);
  line-height: 22px;
}

.review-record-panel__table :deep(.el-button.is-link) {
  height: 22px;
  padding: 0;
  font-size: var(--bq-font-body, 13px);
  line-height: 22px;
}

.review-record-panel__version {
  font-weight: 500;
}

.review-record-panel__meeting {
  color: var(--bq-color-text, var(--el-text-color-primary));
}

</style>
