<script setup lang="ts">
import { computed, ref, watch } from "vue";
import DictTag from "@/components/base/DictTag.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { BaseToast } from "@/components/base/BaseToast";
import {
  createCommitteeReviewNotice,
  fetchCommitteeReviewNotices,
} from "@/api/committee";
import type {
  CommitteeReviewNotice,
  CommitteeReviewRecord,
  CommitteeReviewTask,
} from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import { committeeTagType } from "../committee-ui";
import CommitteeDate from "./CommitteeDate.vue";

const props = withDefaults(
  defineProps<{
    task?: CommitteeReviewTask;
    recordId?: string;
    approving?: boolean;
    noticeEditable?: boolean;
    opinion?: string;
    saving?: boolean;
    reviewStatusOptions?: SchemaOption[];
    approvalResultOptions?: SchemaOption[];
  }>(),
  {
    task: undefined,
    recordId: undefined,
    approving: false,
    noticeEditable: true,
    opinion: "",
    saving: false,
  },
);

const emit = defineEmits<{
  "update:opinion": [value: string];
  approve: [];
  reject: [];
}>();

const loading = ref(false);
const notices = ref<CommitteeReviewNotice[]>([]);
const noticeContent = ref("");
const noticeSubmitting = ref(false);
const noticeExpanded = ref(false);
const readonlyNoticeLimit = 5;

function approvalTime(record?: CommitteeReviewRecord) {
  if (!record) return undefined;
  const source = record as unknown as Record<string, unknown>;
  for (const key of [
    "approveTime",
    "approvalTime",
    "auditTime",
    "reviewTime",
    "headApproveTime",
  ]) {
    const value = source[key];
    if (value !== null && value !== undefined && value !== "") {
      return value as string | number | Date;
    }
  }
  return undefined;
}

const approvalRecord = computed<CommitteeReviewRecord | undefined>(() => {
  const records = props.task?.records ?? [];
  const hasApproval = (record: CommitteeReviewRecord) =>
    Boolean(
      record.approverName ||
      record.approveTime ||
      record.auditOpinion ||
      record.approvalOpinion ||
      record.approvalAction ||
      record.rejectReason,
    );
  const currentRecordId = String(
    props.recordId ?? props.task?.currentRecordId ?? "",
  );
  const currentRecord = records.find(
    (record) => String(record.id) === currentRecordId,
  );
  if (currentRecord)
    return hasApproval(currentRecord) ? currentRecord : undefined;

  return [...records]
    .filter(hasApproval)
    .sort((left, right) => Number(right.versionNo) - Number(left.versionNo))[0];
});

const approvalContent = computed(() => {
  const record = approvalRecord.value;
  return (
    record?.rejectReason ||
    record?.auditOpinion ||
    record?.approvalOpinion ||
    "负责人已完成审批"
  );
});

const approvalStatus = computed(() => props.task?.taskStatus ?? "NOT_STARTED");
const approvalAction = computed(
  () => approvalRecord.value?.approvalAction ?? "",
);

const approvalDecisionClass = computed(
  () => `is-${committeeTagType(approvalStatus.value)}`,
);

const approvalReadonly = computed(() => !props.approving);
const noticeReadonly = computed(
  () => !props.approving && !props.noticeEditable,
);
const fullyReadonly = computed(
  () => approvalReadonly.value && noticeReadonly.value,
);

const orderedNotices = computed(() =>
  [...notices.value].sort((left, right) =>
    String(right.noticeTime ?? "").localeCompare(String(left.noticeTime ?? "")),
  ),
);

const visibleNotices = computed(() =>
  noticeExpanded.value
    ? orderedNotices.value
    : orderedNotices.value.slice(0, readonlyNoticeLimit),
);

const noticeCountText = computed(() =>
  notices.value.length ? `${notices.value.length} 条记录` : "",
);

async function loadNotices() {
  notices.value = [];
  noticeExpanded.value = false;
  if (!props.recordId) return;
  loading.value = true;
  try {
    notices.value = await fetchCommitteeReviewNotices(props.recordId);
  } finally {
    loading.value = false;
  }
}

async function submitNotice() {
  const content = noticeContent.value.trim();
  if (!props.recordId) {
    BaseToast.warning("当前暂无可提交建议的评审版本");
    return;
  }
  if (!content) {
    BaseToast.warning("请填写知会建议");
    return;
  }

  noticeSubmitting.value = true;
  try {
    const notice = await createCommitteeReviewNotice(props.recordId, content);
    notices.value = [notice, ...notices.value];
    noticeContent.value = "";
    BaseToast.success("知会建议已提交");
  } catch (reason) {
    const source = reason as { message?: string };
    BaseToast.error(source.message || "知会建议提交失败");
  } finally {
    noticeSubmitting.value = false;
  }
}

watch(() => props.recordId, loadNotices, { immediate: true });
</script>

<template>
  <section
    v-loading="loading"
    class="review-advice bq-detail-panel"
    :class="{
      'review-advice--readonly': fullyReadonly,
      'review-advice--mixed': approvalReadonly && !fullyReadonly,
    }"
  >
    <BaseSectionTitle
      class="review-advice__header"
      title="审批与建议"
      heading-tag="h2"
    />

      <article
      v-if="approvalReadonly"
      class="review-advice__section review-advice__section--approval"
    >
      <BaseSectionTitle title="负责人审批" size="small" heading-tag="h3" />

      <div v-if="approvalRecord" class="review-advice__approval-summary">
        <div class="review-advice__decision-grid">
          <div class="review-advice__decision-cell">
            <span class="review-advice__decision-label">审批结果</span>
            <strong
              class="review-advice__decision-value"
              :class="approvalDecisionClass"
            >
              <DictTag
                :value="approvalAction"
                :options="approvalResultOptions ?? []"
              />
            </strong>
          </div>
          <div
            class="review-advice__decision-cell review-advice__decision-cell--opinion"
          >
            <span class="review-advice__decision-label">审批意见</span>
            <p>{{ approvalContent }}</p>
          </div>
        </div>
        <div class="review-advice__approval-evidence">
          <div>
            <span>审批人</span>
            <strong>
              {{ approvalRecord.approverName || task?.headUserName || "--" }}
            </strong>
          </div>
          <div>
            <span>审批时间</span>
            <CommitteeDate :value="approvalTime(approvalRecord)" with-seconds />
          </div>
        </div>
      </div>
      <div v-else class="review-advice__compact-empty">暂无负责人审批结果</div>
    </article>

    <article v-else class="review-advice__block">
      <BaseSectionTitle title="负责人审批" size="small" heading-tag="h3">
        <template #actions>
          <DictTag :value="approvalStatus" :options="reviewStatusOptions ?? []" />
        </template>
      </BaseSectionTitle>

      <div v-if="approvalRecord" class="review-advice__card">
        <div class="review-advice__card-head">
          <div class="review-advice__person">
            <span class="committee-text-strong">{{
              approvalRecord.approverName || task?.headUserName || "--"
            }}</span>
          </div>
          <div class="review-advice__time-list">
            <span>
              审批时间：
              <CommitteeDate :value="approvalTime(approvalRecord)" with-seconds />
            </span>
          </div>
        </div>
        <p class="review-advice__content">
          {{ approvalContent }}
        </p>
      </div>
      <el-input
        :model-value="opinion"
        type="textarea"
        :rows="4"
        maxlength="1000"
        show-word-limit
        resize="none"
        placeholder="请输入审批意见"
        @update:model-value="emit('update:opinion', String($event ?? ''))"
      />
      <div class="review-advice__actions">
        <PermissionButton
          type="danger"
          :loading="saving"
          @click="emit('reject')"
        >
          驳回
        </PermissionButton>
        <PermissionButton
          type="primary"
          :loading="saving"
          @click="emit('approve')"
        >
          同意
        </PermissionButton>
      </div>
    </article>

    <template v-if="noticeReadonly">
      <article class="review-advice__section review-advice__section--notices">
        <BaseSectionTitle title="知会人建议" size="small" heading-tag="h3">
<!--          <template #actions>-->
<!--            <span class="review-advice__count">-->
<!--              {{ notices.length ? `${notices.length} 条` : "暂无记录" }}-->
<!--            </span>-->
<!--          </template>-->
        </BaseSectionTitle>

        <div
          v-if="visibleNotices.length"
          class="review-advice__notice-list review-advice__notice-list--readonly"
        >
          <article
            v-for="notice in visibleNotices"
            :key="notice.id"
            class="review-advice__notice-item"
          >
            <p class="review-advice__content">
              {{ notice.noticeContent || "--" }}
            </p>
            <div class="review-advice__notice-meta">
              <span class="review-advice__notice-person">
                {{ notice.noticeUserName || "--" }}
              </span>
              <span class="review-advice__notice-separator" aria-hidden="true">
                ·
              </span>
              <span class="review-advice__notice-time">
                <CommitteeDate :value="notice.noticeTime" with-seconds />
              </span>
            </div>
          </article>
        </div>
        <div v-else class="review-advice__compact-empty">暂无知会人建议</div>
        <button
          v-if="orderedNotices.length > readonlyNoticeLimit"
          type="button"
          class="review-advice__notice-toggle"
          @click="noticeExpanded = !noticeExpanded"
        >
          {{ noticeExpanded ? "收起" : `查看全部 ${orderedNotices.length} 条` }}
        </button>
      </article>
    </template>

    <template v-else>
      <article class="review-advice__block">
        <BaseSectionTitle title="知会人建议" size="small" heading-tag="h3">
          <template #actions>
            <span>{{ noticeCountText }}</span>
          </template>
        </BaseSectionTitle>

        <div v-if="notices.length" class="review-advice__notice-list">
          <article
            v-for="notice in notices"
            :key="notice.id"
            class="review-advice__card"
          >
            <div class="review-advice__card-head">
              <div class="review-advice__person">
                <span class="committee-text-strong">{{
                  notice.noticeUserName
                }}</span>
              </div>
              <CommitteeDate :value="notice.noticeTime" with-seconds />
            </div>
            <p class="review-advice__content">{{ notice.noticeContent }}</p>
          </article>
        </div>
        <div v-if="noticeEditable" class="review-advice__notice-form">
          <el-input
            v-model="noticeContent"
            type="textarea"
            :rows="4"
            maxlength="1000"
            show-word-limit
            resize="none"
            placeholder="填写知会建议"
          />
          <div class="review-advice__actions">
            <PermissionButton
              type="primary"
              :loading="noticeSubmitting"
              @click="submitNotice"
            >
              提交建议
            </PermissionButton>
          </div>
        </div>
      </article>
    </template>
  </section>
</template>

<style scoped>
.review-advice {
  display: grid;
  gap: 16px;
}

.review-advice--readonly {
  gap: 0;
}

.review-advice--mixed {
  gap: 0;
}

.review-advice__header h2,
.review-advice__block-header h3,
.review-advice__section-header h3,
.review-advice__content {
  margin: 0;
}

.review-advice__header h2 {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: var(--bq-font-section-title, 16px);
  font-weight: 700;
  line-height: 24px;
}

.review-advice__block {
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #fbfcfd;
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-card, 4px);
}

.review-advice__section {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 16px 0;
}

.review-advice__section + .review-advice__section {
  border-top: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-light));
}

.review-advice__section:last-child {
  padding-bottom: 0;
}

.review-advice__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.review-advice__block-header,
.review-advice__card-head,
.review-advice__time-list,
.review-advice__title-line {
  display: flex;
  min-width: 0;
}

.review-advice__block-header {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.review-advice__block-header h3 {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
}

.review-advice__section-header h3 {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
}

.review-advice__title-line {
  align-items: center;
  gap: 8px;
}

.review-advice__title-line span,
.review-advice__person span,
.review-advice__time-list,
.review-advice__card-head > :deep(.committee-date) {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  line-height: 20px;
}

.review-advice__title-line .review-advice__count {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-weight: 400;
}

.review-advice__section-header .review-advice__count {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
}

.review-advice__card {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  background: var(--bq-color-surface, #fff);
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color-light));
  border-radius: var(--bq-radius-control, 4px);
}

.review-advice__approval-summary {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding-top: 2px;
}

.review-advice__decision-grid,
.review-advice__approval-evidence,
.review-advice__notice-columns,
.review-advice__notice-item {
  display: grid;
  min-width: 0;
}

.review-advice__decision-grid {
  grid-template-columns: 191px minmax(0, 1fr);
  overflow: hidden;
  background: var(--bq-color-bg-soft, #fbfcfd);
  border-radius: var(--bq-radius-control, 4px);
}

.review-advice__decision-cell {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 14px 16px;
}

.review-advice__decision-cell--opinion {
  border-left: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-light));
}

.review-advice__decision-label {
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  line-height: 20px;
}

.review-advice__decision-value {
  color: var(--bq-color-info, #64748b);
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
}

.review-advice__decision-value.is-success {
  color: color-mix(in srgb, var(--bq-color-success, #7ace87) 76%, #245c35);
}

.review-advice__decision-value.is-danger {
  color: var(--bq-color-danger, #e55353);
}

.review-advice__decision-value.is-warning {
  color: color-mix(in srgb, var(--bq-color-warning, #ffb156) 78%, #8a4f08);
}

.review-advice__decision-cell--opinion p {
  margin: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 15px;
  line-height: 26px;
  white-space: pre-wrap;
}

.review-advice__approval-evidence {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  padding: 0 16px;
}

.review-advice__approval-evidence > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.review-advice__approval-evidence > div:last-child {
  justify-content: flex-end;
}

.review-advice__approval-evidence span {
  flex: 0 0 auto;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  line-height: 20px;
}

.review-advice__approval-evidence strong,
.review-advice__approval-evidence :deep(.committee-date) {
  overflow: hidden;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 13px;
  font-weight: 600;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-advice__compact-empty {
  min-height: 44px;
  padding: 11px 14px;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 13px;
  line-height: 22px;
  background: var(--bq-color-bg-soft, #fbfcfd);
  border-radius: var(--bq-radius-control, 4px);
}

.review-advice__card-head {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.review-advice__person {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.review-advice__person .committee-text-strong {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  font-weight: 700;
  line-height: 22px;
}

.review-advice__time-list {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.review-advice__content {
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  line-height: 24px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.review-advice__notice-list {
  display: grid;
  gap: 10px;
}

.review-advice__notice-list--readonly {
  gap: 0;
}

.review-advice__notice-item {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px 0;
  border-bottom: 1px solid
    var(--bq-color-border-subtle, var(--el-border-color-light));
}

.review-advice__notice-item:first-child {
  padding-top: 4px;
}

.review-advice__notice-item:last-child {
  padding-bottom: 4px;
  border-bottom: 0;
}

.review-advice__notice-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  color: var(--bq-color-text-muted, var(--el-text-color-secondary));
  font-size: 12px;
  line-height: 20px;
}

.review-advice__notice-person {
  overflow: hidden;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-advice__notice-item .review-advice__content {
  min-width: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  line-height: 24px;
}

.review-advice__notice-separator {
  color: var(--bq-color-border, var(--el-border-color));
}

.review-advice__notice-time {
  flex: 0 0 auto;
}

.review-advice__notice-toggle {
  justify-self: start;
  margin: 6px 0 0;
  padding: 2px 0;
  color: var(--bq-color-primary, var(--el-color-primary));
  font: inherit;
  font-size: 13px;
  line-height: 22px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.review-advice__notice-toggle:hover {
  color: var(--bq-color-primary-hover, var(--el-color-primary-light-3));
}

.review-advice__notice-toggle:focus-visible {
  outline: 2px solid var(--bq-color-primary, var(--el-color-primary));
  outline-offset: 2px;
}

.review-advice__notice-form {
  display: grid;
  gap: 10px;
  padding-top: 2px;
}

.review-advice__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 760px) {
  .review-advice__block-header,
  .review-advice__card-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .review-advice__decision-grid {
    grid-template-columns: 1fr;
  }

  .review-advice__decision-cell--opinion {
    border-top: 1px solid
      var(--bq-color-border-subtle, var(--el-border-color-light));
    border-left: 0;
  }

  .review-advice__approval-evidence {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 0;
  }

  .review-advice__approval-evidence > div:last-child {
    justify-content: flex-start;
  }

  .review-advice__notice-item {
    padding: 12px 0;
  }

  .review-advice__notice-meta {
    flex-wrap: wrap;
  }

  .review-advice__time-list {
    justify-content: flex-start;
  }

  .review-advice__actions {
    justify-content: flex-start;
  }
}
</style>
