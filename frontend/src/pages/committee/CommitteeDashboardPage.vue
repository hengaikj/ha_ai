<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchCommitteeDashboard } from "@/api/committee";
import PageContainer from "@/components/layout/PageContainer.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import DictTag from "@/components/base/DictTag.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import CommitteeDate from "./components/CommitteeDate.vue";
import { formatDate } from "@/utils/formatters";
import type { CommitteeDashboard } from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import { fetchPlatformDictItems } from "@/api/platform-system";
import { committeeReviewStageLabel } from "./committee-ui";

const router = useRouter();
const loading = ref(false);
const dashboard = ref<CommitteeDashboard>();
const error = ref<{ code: string; message: string; traceId?: string }>();
const reviewStatusOptions = ref<SchemaOption[]>([]);

const metrics = [
  ["projectCount", "上会项目管理", "/committee/projects"],
  [
    "inProgressProjectCount",
    "进行中项目",
    "/committee/projects?committeeStatus=IN_PROGRESS",
  ],
  [
    "pendingHeadApprovalCount",
    "待审批评审",
    "/committee/reviews?taskStatus=PENDING_APPROVAL",
  ],
  ["secondMeetingPreparationCount", "二级待上会", "/committee/meetings/second"],
  ["groupMeetingPreparationCount", "集团待上会", "/committee/meetings/group"],
] as const;

async function load() {
  loading.value = true;
  error.value = undefined;
  try {
    dashboard.value = await fetchCommitteeDashboard();
  } catch (reason) {
    const source = reason as {
      code?: string;
      message?: string;
      traceId?: string;
    };
    error.value = {
      code: source.code ?? "COMMITTEE_DASHBOARD_ERROR",
      message: source.message ?? "产品委员会工作台加载失败",
      traceId: source.traceId,
    };
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
  void fetchPlatformDictItems("committee_review_status").then(
    (items) => (reviewStatusOptions.value = items),
    () => (reviewStatusOptions.value = []),
  );
});
</script>

<template>
  <PageContainer
    class="bq-management-page"
    title="产品委员会工作台"
    description="集中查看上会项目管理、待办评审、会议准备和最近流程动态。"
  >
    <TraceErrorAlert v-if="error" v-bind="error" />
    <div v-loading="loading" class="committee-dashboard">
      <section class="committee-metrics" aria-label="产品委员会关键指标">
        <button
          v-for="([field, label, path], index) in metrics"
          :key="field"
          class="committee-metric"
          type="button"
          @click="router.push(path)"
        >
          <span class="committee-metric__label">{{ label }}</span>
          <span class="committee-text-strong">{{
            dashboard?.[field] ?? "--"
          }}</span>
          <span class="committee-metric__index" aria-hidden="true"
            >0{{ index + 1 }}</span
          >
        </button>
      </section>

      <div class="committee-dashboard__grid">
        <section class="committee-section committee-section--primary">
          <BaseSectionTitle title="我的待办" heading-tag="h2">
            <template #actions>
              <PermissionButton
              text
              type="primary"
              permission="committee:review:query"
              @click="router.push('/committee/reviews')"
                >查看全部</PermissionButton
              >
            </template>
          </BaseSectionTitle>
          <el-table
            :data="dashboard?.todos ?? []"
            empty-text="当前没有待处理的评审任务"
          >
            <el-table-column
              prop="departmentName"
              label="评审部门"
              min-width="150"
            />
            <el-table-column label="评审阶段" min-width="120">
              <template #default="{ row }">
                {{ committeeReviewStageLabel(row.reviewStage) }}
              </template>
            </el-table-column>
            <el-table-column label="评审状态" width="130" align="center">
              <template #default="{ row }"
                ><DictTag
                  :value="row.taskStatus"
                  :options="reviewStatusOptions"
              /></template>
            </el-table-column>
            <el-table-column label="更新时间" min-width="170">
              <template #default="{ row }">
                <CommitteeDate :value="row.updateTime" with-seconds />
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              width="90"
              fixed="right"
              align="center"
            >
              <template #default="{ row }"
                ><PermissionButton
                  link
                  type="primary"
                  permission="committee:review:query"
                  @click="router.push(`/committee/reviews/${row.id}`)"
                  >处理</PermissionButton
                ></template
              >
            </el-table-column>
          </el-table>
        </section>

        <section class="committee-section committee-section--quiet">
          <BaseSectionTitle title="最近动态" heading-tag="h2">
            <template #actions>
              <PermissionButton :loading="loading" text @click="load">
                刷新
              </PermissionButton>
            </template>
          </BaseSectionTitle>
          <el-timeline v-if="dashboard?.recentActivities?.length">
            <el-timeline-item
              v-for="(item, index) in dashboard.recentActivities"
              :key="index"
              :timestamp="
                formatDate(
                  String(item.activityTime ?? item.time ?? item.createTime ?? ''),
                )
              "
            >
              {{
                item.title ??
                item.description ??
                item.action ??
                "流程状态已更新"
              }}
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无最近动态" :image-size="72" />
        </section>
      </div>
    </div>
  </PageContainer>
</template>

<style scoped>
.committee-dashboard,
.committee-dashboard__grid {
  display: grid;
  gap: 16px;
}
.committee-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  overflow: hidden;
  background: var(--bq-color-surface);
}
.committee-metric {
  position: relative;
  display: grid;
  gap: 8px;
  min-height: 112px;
  padding: 18px 20px;
  text-align: left;
  background: transparent;
  border: 0;
  border-right: 1px solid var(--bq-color-border-subtle);
  cursor: pointer;
}
.committee-metric:last-child {
  border-right: 0;
}
.committee-metric:hover {
  background: var(--bq-color-card-selected);
}
.committee-metric:focus-visible {
  outline: 2px solid var(--bq-color-primary);
  outline-offset: -2px;
}
.committee-metric .committee-text-strong {
  font-size: 28px;
  line-height: 1;
  color: var(--bq-color-text);
}
.committee-metric__label {
  font-size: var(--bq-font-compact);
  color: var(--bq-color-text-secondary);
}
.committee-metric__index {
  position: absolute;
  right: 16px;
  bottom: 12px;
  color: var(--bq-color-text-muted);
  font-size: 20px;
}
.committee-dashboard__grid {
  grid-template-columns: minmax(0, 3fr) minmax(280px, 1fr);
}
.committee-section {
  min-width: 0;
  padding: 16px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  box-shadow: var(--bq-shadow-card);
}
.committee-section--quiet {
  box-shadow: none;
}
.committee-section header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.committee-section h2 {
  margin: 0;
  font-size: 16px;
}
@media (max-width: 900px) {
  .committee-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .committee-metric {
    border-bottom: 1px solid var(--bq-color-border-subtle);
  }
  .committee-dashboard__grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .committee-metrics {
    grid-template-columns: 1fr;
  }
  .committee-metric {
    min-height: 88px;
    border-right: 0;
  }
}
</style>
