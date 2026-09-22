<script setup lang="ts">
import { computed, onDeactivated, ref } from "vue";
import BaseMoney from "@/components/base/BaseMoney.vue";
import BasePercent from "@/components/base/BasePercent.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import DictTag from "@/components/base/DictTag.vue";
import type {
  CommitteeGateMaterial,
  CommitteeProjectDetail,
  CommitteeReviewRecord,
  CommitteeReviewTask,
} from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import { committeeStatusLabel, committeeTagType } from "../committee-ui";
import CommitteeSection from "./CommitteeSection.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";

const props = defineProps<{
  task?: CommitteeReviewTask;
  projectDetail?: CommitteeProjectDetail | null;
  secondConfirmStatusOptions?: SchemaOption[];
  reviewStatusOptions?: SchemaOption[];
  approvalResultOptions?: SchemaOption[];
}>();

const expanded = ref(false);
const materialDialogVisible = ref(false);

onDeactivated(() => {
  materialDialogVisible.value = false;
});
const project = computed(() => props.projectDetail?.project ?? null);
const currentGate = computed(() => props.projectDetail?.currentGate ?? null);
const materials = computed(() => props.projectDetail?.materials ?? []);
const materialDialogTitle = computed(
  () => `${currentGate.value?.gateName ?? props.task?.gateName ?? "当前阀点"} 材料清单`,
);
const currentRecord = computed(() => {
  const records = props.task?.records ?? [];
  return (
    records.find(
      (record) => String(record.id) === String(props.task?.currentRecordId),
    ) ??
    records.find(
      (record) => record.versionNo === props.task?.currentVersionNo,
    ) ??
    [...records].sort((a, b) => Number(b.versionNo) - Number(a.versionNo))[0]
  );
});
const approvalAction = computed(() => {
  const record = currentRecord.value as
    | (CommitteeReviewRecord & Record<string, unknown>)
    | undefined;
  return typeof record?.approvalAction === "string"
    ? record.approvalAction
    : undefined;
});
const secondConfirmStatus = computed(() => {
  const record = props.task as
    | (CommitteeReviewTask & Record<string, unknown>)
    | undefined;
  return (
    record?.secondCompanyConfirmStatus ??
    record?.secondaryCompanyConfirmStatus ??
    record?.secondConfirmStatus
  );
});
const secondConfirmOption = computed(() =>
  props.secondConfirmStatusOptions?.find(
    (option) => String(option.value) === String(secondConfirmStatus.value ?? ""),
  ),
);
const secondConfirmLabel = computed(
  () =>
    secondConfirmOption.value?.label ??
    committeeStatusLabel(
      secondConfirmStatus.value
        ? String(secondConfirmStatus.value)
        : undefined,
    ),
);
const secondConfirmTagType = computed(() => {
  const styleClass =
    secondConfirmOption.value?.styleClass || secondConfirmOption.value?.listClass;
  if (["success", "warning", "danger", "info", "primary"].includes(styleClass ?? "")) {
    return styleClass as "success" | "warning" | "danger" | "info" | "primary";
  }
  return secondConfirmOption.value?.type || committeeTagType(
    secondConfirmStatus.value ? String(secondConfirmStatus.value) : undefined,
  );
});

function displayValue(value?: string | number | null) {
  return value === null || value === undefined || value === "" ? "--" : value;
}

function displayDate(value?: string | null) {
  if (!value) return "--";
  const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return matched?.[1] ?? value;
}

function materialSummary(rows: CommitteeGateMaterial[]) {
  return rows.length ? `共 ${rows.length} 项材料` : "--";
}

const approvalResultValueForDisplay = computed(
  () => approvalAction.value ?? "",
);
</script>

<template>
  <CommitteeSection
    class="review-task-info-panel"
    title="阀点评审信息"
    variant="focus"
  >
    <template #actions>
      <PermissionButton  link type="primary" @click="expanded = !expanded">
        {{ expanded ? "收起" : "查看详情" }}
      </PermissionButton>
    </template>

    <el-descriptions :column="3" border class="review-task-info-panel__summary">
      <el-descriptions-item label="项目代号">
        {{ displayValue(project?.projectName ?? task?.projectName) }}
      </el-descriptions-item>
      <el-descriptions-item label="当前阀点">
        {{ displayValue(task?.gateName ?? currentGate?.gateName) }}
      </el-descriptions-item>
      <el-descriptions-item label="评审部门">
        {{ displayValue(task?.departmentName) }}
      </el-descriptions-item>
      <el-descriptions-item label="评审状态">
        <DictTag
          :value="task?.taskStatus"
          :options="reviewStatusOptions ?? []"
        />
      </el-descriptions-item>
      <el-descriptions-item label="审批结果">
        <DictTag
          :value="approvalResultValueForDisplay"
          :options="approvalResultOptions ?? []"
        />
      </el-descriptions-item>
      <el-descriptions-item label="品牌公司会后确认">
        <BaseStatusTag
            :label="secondConfirmLabel"
            :type="secondConfirmTagType"
        />
      </el-descriptions-item>
<!--      <el-descriptions-item label="评审阶段">-->
<!--        {{ committeeReviewStageLabel(task?.reviewStage) }}-->
<!--      </el-descriptions-item>-->
<!--      <el-descriptions-item label="评审人">-->
<!--        {{ displayValue(task?.reviewerUserName) }}-->
<!--      </el-descriptions-item>-->
<!--      <el-descriptions-item label="负责人">-->
<!--        {{ displayValue(task?.headUserName) }}-->
<!--      </el-descriptions-item>-->
    </el-descriptions>

    <el-collapse-transition>
      <div v-show="expanded" class="review-task-info-panel__expanded">
        <article class="review-task-info-panel__sub-panel">
          <BaseSectionTitle
            class="review-task-info-panel__sub-header"
            title="项目详情"
            size="small"
            heading-tag="h3"
          />
          <el-descriptions :column="3" border>
            <el-descriptions-item label="品牌">
              {{ displayValue(project?.brandName) }}
            </el-descriptions-item>
            <el-descriptions-item label="项目分类">
              {{ displayValue(project?.projectCategory) }}
            </el-descriptions-item>
            <el-descriptions-item label="工厂名称">
              {{ displayValue(project?.productionBase) }}
            </el-descriptions-item>
            <el-descriptions-item label="项目总投资">
              <BaseMoney :value="project?.totalInvestment" />
              <span class="review-task-info-panel__unit">元</span>
            </el-descriptions-item>
            <el-descriptions-item label="车型投资">
              <BaseMoney :value="project?.vehicleModelInvestment" />
              <span class="review-task-info-panel__unit">元</span>
            </el-descriptions-item>
            <el-descriptions-item label="预算执行率">
              <BasePercent
                :numerator="project?.executionRate"
                :denominator="100"
              />
            </el-descriptions-item>
            <el-descriptions-item label="项目背景" :span="3">
              {{ displayValue(project?.projectBackground) }}
            </el-descriptions-item>
          </el-descriptions>
        </article>

        <article class="review-task-info-panel__sub-panel">
          <BaseSectionTitle
            class="review-task-info-panel__sub-header"
            title="阀点详情"
            size="small"
            heading-tag="h3"
          />
          <el-descriptions :column="3" border>
            <el-descriptions-item label="当前阀点">
              {{ displayValue(currentGate?.gateName ?? task?.gateName) }}
            </el-descriptions-item>
            <el-descriptions-item label="计划完成时间">
              {{ displayDate(currentGate?.plannedFinishDate) }}
            </el-descriptions-item>
            <el-descriptions-item label="材料清单">
              <span>{{ materialSummary(materials) }}</span>
              <PermissionButton
                link
                type="primary"
                data-testid="review-task-materials-trigger"
                @click="materialDialogVisible = true"
              >
                查看
              </PermissionButton>
            </el-descriptions-item>
            <el-descriptions-item label="阀点目的" :span="3">
              {{ displayValue(currentGate?.gatePurpose) }}
            </el-descriptions-item>
            <el-descriptions-item label="核心工作内容" :span="3">
              {{ displayValue(currentGate?.coreWorkContent) }}
            </el-descriptions-item>
          </el-descriptions>
        </article>
      </div>
    </el-collapse-transition>

    <el-dialog
      v-model="materialDialogVisible"
      :title="materialDialogTitle"
      width="720px"
      append-to-body
    >
      <div class="review-task-info-panel__materials-dialog">
        <div class="review-task-info-panel__materials-summary">
          共 {{ materials.length }} 项材料
        </div>
        <div
          v-if="materials.length"
          class="review-task-info-panel__materials-grid"
          aria-label="材料清单"
        >
          <article
            v-for="(material, index) in materials"
            :key="material.id"
            class="review-task-info-panel__material-card"
          >
            <span class="review-task-info-panel__material-index">
              {{ String(index + 1).padStart(2, "0") }}
            </span>
            <div class="review-task-info-panel__material-main">
              <strong>{{ displayValue(material.materialName) }}</strong>
              <span>{{ displayValue(material.materialRequirement) }}</span>
            </div>
          </article>
        </div>
        <el-empty v-else description="当前阀点未配置材料项" :image-size="60" />
      </div>
    </el-dialog>
  </CommitteeSection>
</template>

<style scoped>
.review-task-info-panel :deep(.el-descriptions__table) {
  table-layout: fixed;
}

.review-task-info-panel :deep(.el-descriptions__label) {
  width: 150px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  background: #f8f9fb;
}

.review-task-info-panel :deep(.el-descriptions__content) {
  min-width: 0;
  color: var(--bq-color-text, var(--el-text-color-primary));
  background: var(--bq-color-surface, var(--el-bg-color));
}

.review-task-info-panel :deep(.el-descriptions__label),
.review-task-info-panel :deep(.el-descriptions__content) {
  padding: 11px 14px;
  font-size: var(--bq-font-body, 13px);
  line-height: 22px;
}

.review-task-info-panel :deep(.el-descriptions__label) {
  font-weight: 500;
}

.review-task-info-panel :deep(.el-button.is-link) {
  font-size: var(--bq-font-body, 13px);
  line-height: 22px;
}

.review-task-info-panel__materials-dialog {
  min-height: 120px;
}

.review-task-info-panel__materials-summary {
  margin-bottom: 16px;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: 14px;
}

.review-task-info-panel__materials-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 2px;
}

.review-task-info-panel__material-card {
  display: flex;
  min-height: 64px;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--bq-color-border-subtle, var(--el-border-color));
  background: var(--bq-color-surface, var(--el-bg-color));
}

.review-task-info-panel__material-index {
  flex: 0 0 auto;
  color: var(--el-color-primary);
  font-size: 13px;
  font-weight: 700;
  line-height: 22px;
}

.review-task-info-panel__material-main {
  display: grid;
  min-width: 0;
  gap: 4px;
  color: var(--bq-color-text-secondary, var(--el-text-color-secondary));
  font-size: 13px;
  line-height: 20px;
}

.review-task-info-panel__material-main strong {
  overflow: hidden;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 680px) {
  .review-task-info-panel__materials-grid {
    grid-template-columns: 1fr;
  }
}

.review-task-info-panel__summary {
  margin-top: 2px;
}

.review-task-info-panel__expanded {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.review-task-info-panel__sub-panel {
  display: grid;
  gap: 10px;
  border-radius: var(--bq-radius-card, 4px);
  background: var(--bq-color-surface, var(--el-bg-color));
}

.review-task-info-panel__sub-header {
  display: flex;
  align-items: center;
  min-height: 22px;
}

.review-task-info-panel__sub-header h3 {
  position: relative;
  margin: 0;
  padding-left: 10px;
  color: var(--bq-color-text, var(--el-text-color-primary));
  font-size: 16px;
  font-weight: 700;
  line-height: 22px;
}

.review-task-info-panel__unit {
  margin-left: 4px;
}

@media (max-width: 900px) {
  .review-task-info-panel :deep(.el-descriptions__label) {
    width: 112px;
  }
}
</style>
