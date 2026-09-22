<script setup lang="ts">
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import DictTag from "@/components/base/DictTag.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import { computed, onMounted, ref } from "vue";
import { Back, MagicStick, Refresh } from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchCommitteeMeeting,
  fetchCommitteeMeetingReviewRecords,
  generateGroupMaterialSuggestions,
  saveCommitteeOpinionSummary,
} from "@/api/committee";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  CommitteeMeeting,
  CommitteeReviewSummary,
  CommitteeAiSuggestions,
  CommitteeOpinionSummary,
  CommitteeOpinionSummarySnapshot,
} from "@/types/committee";
import CommitteeDate from "./components/CommitteeDate.vue";
import { committeeStatusLabel } from "./committee-ui";
import { fetchPlatformDictItems } from "@/api/platform-system";
import type { SchemaOption } from "@/types/schema-components";

type ReviewSummaryDepartment =
  CommitteeReviewSummary["groups"][number]["departments"][number];

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const meeting = ref<CommitteeMeeting>();
const reviewSummary = ref<CommitteeReviewSummary | null>(null);
const expandedDepartmentIds = ref<string[]>([]);
const generating = ref(false);
const generatedSuggestions = ref<CommitteeAiSuggestions>();
const generatedOpinionSummary = ref<CommitteeOpinionSummary>();
const opinionSummarizing = ref(false);
const opinionSnapshot = ref<CommitteeOpinionSummarySnapshot>();
const opinionSummary = computed(() => opinionSnapshot.value?.result);
const reviewStatusOptions = ref<SchemaOption[]>([]);
const approvalResultOptions = ref<SchemaOption[]>([]);
const conclusionStatusOptions = ref<SchemaOption[]>([]);
const aiSuggestionTransferKey = "committee-ai-suggestions";
// 顶部生成工作台概览暂时下线，保留实现便于后续恢复。
const aiWorkbenchVisible = false;

const groupDepartments = computed<ReviewSummaryDepartment[]>(() => {
  return (
    reviewSummary.value?.groups.find(
      (group) => group.departmentGroup === "GROUP",
    )?.departments ?? []
  );
});

const includedDepartments = computed(() =>
  groupDepartments.value.filter(
    (item) =>
      item.hasFormalVersion && item.currentRecord?.recordStatus === "APPROVED",
  ),
);

const suggestions = computed(() => [
  {
    title: "质量参考建议",
    value:
      generatedSuggestions.value?.qualitySuggestion ??
      meeting.value?.material?.aiQualitySuggestion,
  },
  {
    title: "成本参考建议",
    value:
      generatedSuggestions.value?.costSuggestion ??
      meeting.value?.material?.aiCostSuggestion,
  },
  {
    title: "收益参考建议",
    value:
      generatedSuggestions.value?.revenueSuggestion ??
      meeting.value?.material?.aiRevenueSuggestion,
  },
]);

const generated = computed(
  () => !!generatedOpinionSummary.value || suggestions.value.some((item) => item.value),
);
const generatedCount = computed(
  () => suggestions.value.filter((item) => item.value).length,
);
const secondConclusionLabel = computed(() => {
  const value = meeting.value?.linkedSecondMeetingConclusion;
  return value
    ? conclusionStatusOptions.value.find(
        (option) => String(option.value) === String(value),
      )?.label ?? committeeStatusLabel(value)
    : "带条件通过";
});
const secondConclusionText = computed(
  () =>
    meeting.value?.linkedSecondMeetingConclusion ||
    "二级阀点评审会同意项目带条件进入集团评审。",
);

const aiStatusLabel = computed(() =>
  generated.value ? "已生成参考建议" : "未生成",
);
const aiStatusType = computed(() => (generated.value ? "success" : "info"));
const displayedOpinionSummary = computed(
  () => generatedOpinionSummary.value ?? opinionSummary.value,
);
const opinionResultsVisible = computed(() => !!displayedOpinionSummary.value);
const opinionGatePoints = computed(() =>
  (displayedOpinionSummary.value?.projects ?? []).flatMap((project) =>
    project.gatePoints.map((gatePoint) => ({
      ...gatePoint,
      projectId: project.projectId ?? project.project_id,
      projectName: project.projectName,
    })),
  ),
);
const opinionSummaryEditable = computed(
  () =>
    !!meeting.value &&
    ["PREPARING", "READY", "REVISING"].includes(meeting.value.meetingStatus) &&
    meeting.value.materialStatus === "DRAFT",
);

function versionLabel(row: ReviewSummaryDepartment) {
  return row.currentVersionNo ? `V${row.currentVersionNo}` : "--";
}

function reviewerName(row: ReviewSummaryDepartment) {
  return row.currentRecord?.reviewerUserName || "--";
}

function reviewOpinionHtml(row: ReviewSummaryDepartment) {
  const content =
    row.currentRecord?.finalDepartmentOpinion ||
    row.currentRecord?.content?.contentText ||
    "--";
  if (content === "--") return content;
  if (typeof DOMParser === "undefined") {
    return content.replace(/<img\b[^>]*>/gi, "");
  }
  const parsedDocument = new DOMParser().parseFromString(content, "text/html");
  parsedDocument.body.querySelectorAll("img").forEach((image) => image.remove());
  return parsedDocument.body.innerHTML || "--";
}

function normalizeOpinionSummary(value: CommitteeOpinionSummary) {
  return {
    ...value,
    projects: (value.projects ?? []).map((project) => ({
      ...project,
      projectId: project.projectId ?? project.project_id ?? "",
      gatePoints: (project.gatePoints ?? project.gate_points ?? []).map((gatePoint) => ({
        ...gatePoint,
        gatePointId: gatePoint.gatePointId ?? gatePoint.gate_point_id ?? "",
        gatePointName: gatePoint.gatePointName ?? gatePoint.gate_point_name,
        departments: (gatePoint.departments ?? []).map((department) => ({
          ...department,
          departmentId: department.departmentId ?? department.department_id ?? "",
          opinion: department.opinion ?? [],
          opinionUrl: department.opinionUrl ?? department.opinion_url,
        })),
      })),
    })),
  } as CommitteeOpinionSummary;
}

function opinionItems(opinion: string | string[] | undefined) {
  if (Array.isArray(opinion)) return opinion.filter(Boolean);
  if (!opinion) return [];
  return opinion
    .split(/\\r?\\n|(?=\\d+[、.)])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function load() {
  loading.value = true;
  try {
    const meetingId = String(route.params.meetingId);
    meeting.value = await fetchCommitteeMeeting(
      "GROUP",
      meetingId,
    );
    opinionSnapshot.value = meeting.value.material?.opinionSummarySnapshot;
    const records = await fetchCommitteeMeetingReviewRecords(meetingId);
    const departments = records.map((record) => {
      const approved = String(record.recordStatus).toUpperCase() === "APPROVED";
      return {
        taskId: record.taskId ?? record.reviewTaskId,
        departmentId: record.departmentId,
        departmentName: record.departmentName,
        requiredFlag: record.requiredFlag ?? "1",
        taskStatus: record.taskStatus ?? record.recordStatus,
        conclusionSignal: record.conclusionSignal,
        secondConfirmStatus: record.secondConfirmStatus,
        currentVersionNo: record.reviewVersionNo ?? record.versionNo,
        hasFormalVersion: record.hasFormalVersion ?? approved,
        canViewDetail: record.canViewDetail ?? true,
        updateTime: record.updateTime ?? record.submitTime,
        currentRecord: record,
      };
    });
    reviewSummary.value = {
      gateId: meeting.value.gateId,
      requiredCount: departments.length,
      approvedCount: departments.filter((item) => item.hasFormalVersion).length,
      pendingCount: departments.filter((item) => !item.hasFormalVersion).length,
      rejectedCount: 0,
      groups: [{ departmentGroup: "GROUP", departments }],
    };
    expandedDepartmentIds.value = [];
  } finally {
    loading.value = false;
  }
}

function backToMeeting() {
  router.push(`/committee/meetings/group/${route.params.meetingId}`);
}

function goToMaterialEdit() {
  const meetingId = String(route.params.meetingId);
  const transfer = {
    qualitySuggestion: suggestions.value[0].value ?? "",
    costSuggestion: suggestions.value[1].value ?? "",
    revenueSuggestion: suggestions.value[2].value ?? "",
    opinionSummary: generatedOpinionSummary.value ?? null,
  };

  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        `${aiSuggestionTransferKey}:${meetingId}`,
        JSON.stringify(transfer),
      );
    } catch {
      // 会话存储不可用时，编辑页仍可展示服务端已有建议。
    }
  }

  router.push({
    path: `/committee/meetings/group/${meetingId}/material/edit`,
    query: { aiReference: "1" },
  });
}

async function generate() {
  if (!meeting.value || generating.value) return;
  generating.value = true;
  try {
    const result = await generateGroupMaterialSuggestions(
      meeting.value.id,
      meeting.value.materialLockVersion ?? 0,
    );
    if (result && typeof result === "object" && "projects" in result) {
      generatedOpinionSummary.value = normalizeOpinionSummary(
        result as CommitteeOpinionSummary,
      );
    } else {
      // 兼容旧环境仍返回质量/成本/收益建议的接口响应。
      generatedSuggestions.value = result as unknown as CommitteeAiSuggestions;
    }
    BaseToast.success("AI 参考建议已生成，请人工核验后到材料编辑页采纳");
  } catch {
    BaseToast.error("AI 参考建议生成失败，请稍后重试");
  } finally {
    generating.value = false;
  }
}

async function summarizeOpinions() {
  if (!meeting.value || !opinionSummaryEditable.value || opinionSummarizing.value) return;
  opinionSummarizing.value = true;
  try {
    const saved = await saveCommitteeOpinionSummary(
      meeting.value.id,
      meeting.value.materialLockVersion ?? 0,
    );
    opinionSnapshot.value = saved.snapshot;
    meeting.value.materialLockVersion = saved.materialLockVersion;
    if (meeting.value.material) {
      meeting.value.material.opinionSummarySnapshot = saved.snapshot;
    }
    BaseToast.success("阀点部门意见已整理并保存到会议材料");
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "409" || code.includes("CONCURRENT_MODIFICATION")) {
      await load();
      BaseToast.error("材料已变化，已重新加载最新内容");
    } else {
      BaseToast.error("阀点部门意见整理保存失败，请稍后重试");
    }
  } finally {
    opinionSummarizing.value = false;
  }
}

function generatedAtLabel(value?: string) {
  if (!value) return "--";
  const generatedAt = new Date(value);
  if (Number.isNaN(generatedAt.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(
    generatedAt.getDate(),
  )} ${pad(generatedAt.getHours())}:${pad(generatedAt.getMinutes())}:${pad(
    generatedAt.getSeconds(),
  )}`;
}

onMounted(() => {
  void load();
  void fetchPlatformDictItems("committee_review_status").then(
    (items) => (reviewStatusOptions.value = items),
    () => (reviewStatusOptions.value = []),
  );
  void fetchPlatformDictItems("committee_approval_result_status").then(
    (items) => (approvalResultOptions.value = items),
    () => (approvalResultOptions.value = []),
  );
  void fetchPlatformDictItems("committee_conclusion_decision").then(
    (items) => (conclusionStatusOptions.value = items),
    () => (conclusionStatusOptions.value = []),
  );
});
</script>

<template>
  <PageContainer
    title="集团会议材料 AI 辅助"
    description="本页只负责查看输入源并生成 AI 参考建议，正式材料整理统一在上会材料编辑页完成。"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        @click="backToMeeting"
      >
        返回集团会议详情
      </PermissionButton>
      <PermissionButton :icon="Refresh" @click="load">刷新</PermissionButton>
    </template>

    <div v-loading="loading" class="ai-page">
      <section v-show="aiWorkbenchVisible" class="ai-workbench">
        <BaseSectionTitle
          class="ai-section-header"
          title="生成工作台"
          description="只保留生成动作真正需要的背景结论、输入覆盖和输出状态。"
          heading-tag="h2"
        >
          <template #actions>
            <BaseStatusTag :label="aiStatusLabel" :type="aiStatusType" />
          </template>
        </BaseSectionTitle>

        <div class="ai-workbench__grid">
          <article class="ai-workbench__card">
            <span>品牌会议结论背景</span>
            <strong>{{ secondConclusionLabel }}</strong>
            <p>{{ secondConclusionText }}</p>
          </article>
          <article class="ai-workbench__card">
            <span>输入覆盖</span>
            <strong>
              {{ includedDepartments.length }} / {{ groupDepartments.length }}
            </strong>
            <p>集团部室正式评审已纳入数量</p>
          </article>
          <article class="ai-workbench__card">
            <span>输出结构</span>
            <strong>质量 / 成本 / 收益</strong>
            <p>固定对应上会材料三类板块</p>
          </article>
          <article class="ai-workbench__card">
            <span>已生成建议数</span>
            <strong>{{ generatedCount }}</strong>
            <p>生成后可直接在会议编辑页查看</p>
          </article>
        </div>
      </section>

      <div class="ai-layout">
        <section class="ai-inputs">
          <BaseSectionTitle
            class="ai-section-header"
            :title="`${groupDepartments.length} 个部室输入源建议`"
            description="仅保留最终部室正式评审意见与知会建议，作为 AI 结构化提炼的核心依据。"
            heading-tag="h2"
          />

          <el-collapse
            v-if="groupDepartments.length"
            v-model="expandedDepartmentIds"
          >
            <el-collapse-item
              v-for="row in groupDepartments"
              :key="row.departmentId"
              :name="String(row.departmentId)"
            >
              <template #title>
                <div class="department-title">
                  <div class="department-title__main">
                    <strong>{{ row.departmentName }}</strong>
                    <span v-if="row.hasFormalVersion">
                      {{ reviewerName(row) }} ·
                      <CommitteeDate :value="row.updateTime" with-seconds />
                    </span>
                    <span v-else>暂无正式评审版本</span>
                  </div>
                  <div class="department-title__meta">
                    <DictTag
                      :value="row.taskStatus"
                      :options="reviewStatusOptions"
                    />
                  </div>
                </div>
              </template>

              <template v-if="row.hasFormalVersion && row.currentRecord">
                <dl class="input-facts">
                  <div>
                    <dt>评审版本</dt>
                    <dd>{{ versionLabel(row) }}</dd>
                  </div>
                  <div>
                    <dt>审批结果</dt>
                    <dd>
                      <DictTag
                        :value="row.currentRecord.approvalAction"
                        :options="approvalResultOptions"
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>提交时间</dt>
                    <dd>
                      <CommitteeDate
                        :value="row.currentRecord.submitTime"
                        with-seconds
                      />
                    </dd>
                  </div>
                </dl>

                <div class="input-content">
                  <section>
                    <div class="input-content__head">
                      <strong>评审意见</strong>
                      <BaseStatusTag label="核心输入" type="info" />
                    </div>
                    <div
                      class="input-content__body"
                      v-html="reviewOpinionHtml(row)"
                    />
                  </section>
                </div>
              </template>
              <p v-else class="empty-line">
                当前部室暂无可纳入 AI 的正式评审版本。
              </p>
            </el-collapse-item>
          </el-collapse>
          <el-empty v-else description="暂无部室输入源" />
        </section>

        <section class="ai-results">
          <BaseSectionTitle
            class="ai-section-header"
            title="AI 参考建议生成区"
            heading-tag="h2"
          >
            <template #actions>
              <BaseStatusTag :label="aiStatusLabel" :type="aiStatusType" />
            </template>
          </BaseSectionTitle>

          <div class="ai-results__actions">
            <PermissionButton
              type="primary"
              :loading="generating"
              :disabled="!includedDepartments.length"
              @click="generate"
            >
              {{ generated ? "重新生成" : "生成 AI 提炼结果" }}
            </PermissionButton>
          </div>

          <section class="ai-preview">
            <BaseSectionTitle
              class="ai-preview__header"
              title="AI 提炼结果预览"
              description="生成后会在上会材料编辑页集中只读展示，由人工判断应引用到哪个问题板块。"
              size="small"
              heading-tag="h3"
            />
            <el-alert
              title="AI 内容仅供参考，请在上会材料编辑页整理正式内容。"
              type="warning"
              :closable="false"
              show-icon
            />
            <div v-if="displayedOpinionSummary" class="opinion-preview-content">
              <div v-if="opinionGatePoints.length" class="opinion-gates">
                <section v-for="gatePoint in opinionGatePoints" :key="`${gatePoint.projectId}-${gatePoint.gatePointId}`" class="opinion-gate">
                  <div class="opinion-departments">
                    <article v-for="department in gatePoint.departments" :key="department.departmentId" class="opinion-department">
                      <header>
                        <strong>{{ department.department }}</strong>
                      </header>
                      <ul v-if="opinionItems(department.opinion).length" class="opinion-list">
                        <li v-for="item in opinionItems(department.opinion)" :key="item">{{ item }}</li>
                      </ul>
                      <a v-if="department.opinionUrl" class="opinion-file-link" :href="department.opinionUrl" target="_blank" rel="noopener noreferrer">查看 {{ department.department }} 意见文件</a>
                      <p v-else-if="!opinionItems(department.opinion).length" class="empty-line">评审建议均为正向，无负向建议</p>
                      <p v-if="department.opinionSummary" class="opinion-department__summary">{{ department.opinionSummary }}</p>
                    </article>
                  </div>
                </section>
              </div>
              <PermissionButton v-if="false" type="primary" :icon="MagicStick" :loading="opinionSummarizing" :disabled="!includedDepartments.length" @click="summarizeOpinions">
                {{ displayedOpinionSummary ? "重新整理并保存" : "整理并保存" }}
              </PermissionButton>
            </div>
            <p v-else class="empty-line">
              尚未生成 AI 提炼结果。
            </p>
          </section>

          <div v-if="generated" class="material-edit-action">
            <PermissionButton type="primary" @click="goToMaterialEdit">
              去编辑上会材料
            </PermissionButton>
          </div>
        </section>
      </div>

      <section v-if="false" v-show="opinionResultsVisible" class="opinion-results">
        <BaseSectionTitle
          class="ai-section-header"
          title="阀点部门意见整理"
          description="对集团部室已审批正式意见进行正负向判别、分条润色和总结。"
          heading-tag="h2"
        >
          <template #actions>
            <PermissionButton
            v-if="opinionSummaryEditable"

            type="primary"
            :icon="MagicStick"
            :loading="opinionSummarizing"
            :disabled="!includedDepartments.length"
            @click="summarizeOpinions"
          >
            {{ displayedOpinionSummary ? "重新整理并保存" : "整理并保存" }}
            </PermissionButton>
          </template>
        </BaseSectionTitle>

        <el-alert
          title="整理结果已作为会议材料快照保存，仍需人工核验，不会修改原始评审记录或自动成为会议结论。"
          type="warning"
          :closable="false"
          show-icon
        />

        <template v-if="displayedOpinionSummary">
          <div v-if="opinionSnapshot" class="opinion-metadata">
            <span>生成时间：{{ generatedAtLabel(opinionSnapshot?.generatedAt) }}</span>
            <span>执行人：{{ opinionSnapshot?.generatedByName || "--" }}</span>
            <span>模型：{{ displayedOpinionSummary?.modelName || "--" }}</span>
            <span>来源评审：{{ opinionSnapshot?.sourceReviews?.length ?? 0 }} 项</span>
          </div>
          <div class="opinion-stats">
            <div>
              <span>处理部门</span>
              <strong>{{ displayedOpinionSummary?.departmentCount ?? 0 }}</strong>
            </div>
            <div>
              <span>正向</span>
              <strong>{{ displayedOpinionSummary?.positiveCount ?? 0 }}</strong>
            </div>
            <div>
              <span>负向</span>
              <strong>{{ displayedOpinionSummary?.negativeCount ?? 0 }}</strong>
            </div>
            <div>
              <span>处理耗时</span>
              <strong>{{ displayedOpinionSummary?.processingMs ?? 0 }} ms</strong>
            </div>
          </div>

          <p v-if="displayedOpinionSummary?.warning" class="opinion-message is-warning">
            整体警告：{{ displayedOpinionSummary?.warning }}
          </p>

          <div v-if="opinionGatePoints.length" class="opinion-gates">
            <section
              v-for="gatePoint in opinionGatePoints"
              :key="`${gatePoint.projectId}-${gatePoint.gatePointId}`"
              class="opinion-gate"
            >
              <header>
                <h3>{{ gatePoint.gatePointName || gatePoint.gatePointId }}</h3>
                <span>{{ gatePoint.projectName || gatePoint.projectId }}</span>
              </header>

              <div class="opinion-departments">
                <article
                  v-for="department in gatePoint.departments"
                  :key="department.departmentId"
                  class="opinion-department"
                >
                  <header>
                    <strong>{{ department.department }}</strong>
                    <BaseStatusTag
                      :label="department.polarity || '未判定'"
                      :type="department.polarity === '正向' ? 'success' : 'warning'"
                    />
                  </header>
                  <p v-if="department.error" class="opinion-message is-error">
                    处理错误：{{ department.error }}
                  </p>
                  <p v-if="department.warning" class="opinion-message is-warning">
                    处理警告：{{ department.warning }}
                  </p>
                  <ul v-if="opinionItems(department.opinion).length" class="opinion-list">
                    <li v-for="item in opinionItems(department.opinion)" :key="item">{{ item }}</li>
                  </ul>
                  <a
                    v-if="department.opinionUrl"
                    class="opinion-file-link"
                    :href="department.opinionUrl ?? undefined"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看 {{ department.department }} 意见文件
                  </a>
                  <p v-else class="empty-line">
                    评审建议均为正向，无负向建议
                  </p>
                  <div
                    v-if="department.opinionSummary"
                    class="opinion-department__summary"
                  >
                    <span>意见总结</span>
                    <p>{{ department.opinionSummary }}</p>
                  </div>
                </article>
              </div>
            </section>
          </div>
          <el-empty v-else description="本次未返回可展示的部门整理结果" />
        </template>
        <el-empty v-else description="尚未整理阀点部门意见" />
      </section>

    </div>
  </PageContainer>
</template>

<style scoped>
.ai-page {
  display: grid;
  gap: 18px;
}

.ai-workbench,
.ai-inputs,
.ai-results,
.opinion-results {
  padding: 20px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 6px;
}

.ai-section-header,
.department-title,
.department-title__main,
.department-title__meta,
.input-content__head,
.ai-inputs__meta,
.ai-results__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-section-header {
  justify-content: space-between;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.ai-section-header h2,
.ai-section-header p,
.ai-workbench__card p,
.ai-preview__header p,
h3,
h4,
p {
  margin: 0;
}

.ai-section-header h2 {
  font-size: var(--bq-font-section-title, 16px);
}

.ai-section-header p,
.ai-workbench__card span,
.ai-workbench__card p,
.ai-preview__header p,
.department-title__main span,
.department-title__meta span,
dt {
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper, 12px);
}

.ai-workbench__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  padding-top: 20px;
}

.ai-workbench__card {
  display: grid;
  gap: 8px;
  min-width: 0;
  min-height: 96px;
  padding: 14px 16px;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 6px;
}

.ai-workbench__card strong {
  color: var(--bq-color-text);
  font-size: 18px;
  line-height: 26px;
}

.ai-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
  gap: 18px;
  align-items: start;
}

.ai-inputs,
.ai-results {
  display: grid;
  gap: 16px;
  align-content: start;
}

.ai-results .ai-section-header {
  align-items: flex-start;
}

.ai-inputs :deep(.el-collapse) {
  border-top: 0;
  border-bottom: 0;
}

.ai-inputs :deep(.el-collapse-item) {
  margin-bottom: 12px;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 6px;
  overflow: hidden;
}

.ai-inputs :deep(.el-collapse-item__header) {
  min-height: 72px;
  padding: 0 16px;
  line-height: normal;
  border-bottom: 0;
}

.ai-inputs :deep(.el-collapse-item__wrap) {
  border-bottom: 0;
}

.ai-inputs :deep(.el-collapse-item__content) {
  display: grid;
  gap: 14px;
  padding: 0 16px 16px;
}

.department-title {
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  padding-right: 12px;
}

.department-title__main,
.department-title__meta {
  flex-wrap: wrap;
  min-width: 0;
}

.department-title__main {
  flex: 1;
}

.department-title__main strong {
  color: var(--bq-color-text);
  font-size: 15px;
  line-height: 22px;
}

.department-title__meta span {
  padding: 0 8px;
  border-radius: 999px;
  background: var(--bq-color-info-soft);
  line-height: 24px;
}

.input-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.input-facts div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px;
  background: var(--bq-color-bg-page);
  border-radius: 6px;
}

dd {
  margin: 0;
  color: var(--bq-color-text);
  font-size: var(--bq-font-body, 14px);
}

.input-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.input-content section,
.ai-results article {
  display: grid;
  gap: 10px;
  padding: 14px;
  background: var(--bq-color-bg-page);
  border-radius: 6px;
}

.input-content__body,
.ai-results article p {
  line-height: 1.7;
}

.input-content__body :deep(p) {
  margin: 0 0 8px;
}

.input-content__body :deep(p:last-child) {
  margin-bottom: 0;
}

.input-content__body :deep(ul),
.input-content__body :deep(ol) {
  margin: 0 0 8px;
  padding-left: 24px;
}

.input-content__body :deep(ul:last-child),
.input-content__body :deep(ol:last-child) {
  margin-bottom: 0;
}

.empty-line {
  color: var(--bq-color-text-secondary);
}

.ai-results__actions {
  justify-content: stretch;
}

.ai-results__actions :deep(.el-button),
.ai-results__actions :deep(button) {
  width: 100%;
}

.ai-preview {
  display: grid;
  gap: 14px;
  padding-top: 18px;
  border-top: 1px solid var(--bq-color-border-subtle);
}

.ai-preview__header {
  display: grid;
  gap: 6px;
}

.ai-preview__header h3 {
  font-size: 18px;
  line-height: 26px;
}

.ai-suggestion-list {
  display: grid;
  gap: 12px;
}

.ai-results article {
  border: 1px solid var(--bq-color-border-subtle);
}

.ai-results article h4 {
  font-size: var(--bq-font-body, 14px);
}

.opinion-results {
  display: grid;
  gap: 16px;
}

.material-edit-action :deep(.el-button),
.material-edit-action :deep(button) {
  width: 100%;
}

.opinion-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.opinion-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper, 12px);
}

.opinion-stats > div {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 12px 14px;
  background: var(--bq-color-bg-page);
  border-radius: 6px;
}

.opinion-stats span,
.opinion-gate > header span,
.opinion-department__summary span {
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-helper, 12px);
}

.opinion-gates,
.opinion-gate,
.opinion-departments,
.opinion-department {
  display: grid;
  gap: 12px;
}

.opinion-gate + .opinion-gate {
  padding-top: 16px;
  border-top: 1px solid var(--bq-color-border-subtle);
}

.opinion-gate > header,
.opinion-department > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.opinion-departments {
  grid-template-columns: minmax(0, 1fr);
}

.opinion-department {
  align-content: start;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 6px;
}

.opinion-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
}

.opinion-file-link {
  width: fit-content;
  color: var(--el-color-primary);
  font-size: var(--bq-font-helper, 12px);
  text-decoration: none;
}

.opinion-file-link:hover {
  text-decoration: underline;
}

.opinion-message,
.opinion-department__summary {
  padding: 10px 12px;
  border-radius: 4px;
}

.opinion-message.is-error {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.opinion-message.is-warning {
  color: var(--el-color-warning-dark-2);
  background: var(--el-color-warning-light-9);
}

.opinion-department__summary {
  display: grid;
  gap: 6px;
  background: var(--bq-color-bg-page);
}

@media (max-width: 1100px) {
  .ai-workbench__grid,
  .ai-layout {
    grid-template-columns: 1fr;
  }

  .input-content {
    grid-template-columns: 1fr;
  }

  .opinion-departments {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .ai-section-header,
  .opinion-gate > header,
  .opinion-department > header {
    align-items: flex-start;
    flex-direction: column;
  }

  .opinion-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

}
</style>
