<script setup lang="ts">
import { CirclePlus } from "@element-plus/icons-vue";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  createCommitteeMeeting,
  fetchCommitteeProjectCompanyOptions,
  fetchCommitteeMeetings,
} from "@/api/committee";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import DictTag from "@/components/base/DictTag.vue";
import { fetchPlatformDictItems } from "@/api/platform-system";
import { BaseToast } from "@/components/base/BaseToast";
import CommitteeDate from "./components/CommitteeDate.vue";
import CommitteeFormGrid from "./components/CommitteeFormGrid.vue";
import type {
  CommitteeMeeting,
  CommitteeMeetingLevel,
} from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import {
  committeeLevelLabel,
  committeeRows,
  committeeTotal,
} from "./committee-ui";

const route = useRoute();
const router = useRouter();
const level = computed<CommitteeMeetingLevel>(() =>
  String(route.meta.committeeLevel ?? route.params.level).toUpperCase() ===
  "GROUP"
    ? "GROUP"
    : "SECOND",
);
const query = reactive({
  meetingType: "",
  meetingStatus: "",
  projectName: "",
  companyName: "",
});
const table = ref<{ reload: () => Promise<void> }>();
const visible = ref(false);
const saving = ref(false);
const meetingStatusDictOptions = ref<SchemaOption[]>([]);
const conclusionStatusOptions = ref<SchemaOption[]>([]);
const companyOptions = ref<string[]>([]);
const form = reactive({
  meetingType: "PRODUCT_COMMITTEE" as const,
  projectId: "",
  gateId: "",
  meetingTime: "",
  reviewDeadlineTime: "",
  meetingLocation: "",
  linkedSecondMeetingId: "",
  linkedSecondConclusionId: "",
  remark: "",
});
function resetQuery() {
  query.meetingType = "";
  query.meetingStatus = "";
  query.projectName = "";
  query.companyName = "";
}
async function load(pageSize: number, pageNo: number) {
  const result = await fetchCommitteeMeetings(level.value, {
    pageNum: pageNo,
    pageSize,
    meetingType:
      level.value === "SECOND" ? query.meetingType || undefined : undefined,
    meetingStatus: query.meetingStatus || undefined,
    projectName: query.projectName || undefined,
    companyName: query.companyName || undefined,
  });
  const rows = committeeRows(result);
  const total = committeeTotal(result);
  return { list: rows, total };
}
const title = computed(() =>
  level.value === "SECOND" ? "品牌公司会议列表" : "集团公司会议列表",
);
const emptyTitle = computed(() =>
  level.value === "SECOND" ? "暂无品牌公司会议" : "暂无集团会议",
);
/*
const meetingStatusOptions = [
  ["PREPARING", "待上会"],
  ["READY", "可上会"],
  ["CONCLUDED", "已结束"],
  ["CUTOFF_LOCKED", "已封存"],
  ["REVISING", "修订中"],
  ["LOCKED", "已锁定"]
];
*/
function mapDictOptions(
  items: Awaited<ReturnType<typeof fetchPlatformDictItems>>,
) {
  return items.map((item) => ({
    label: item.label,
    value: item.value,
    cssClass: item.cssClass,
    listClass: item.listClass,
    styleClass: item.styleClass,
    raw: item.raw,
  }));
}
async function loadMeetingStatusOptions() {
  try {
    const [meetingItems, conclusionItems, companies] = await Promise.all([
      fetchPlatformDictItems("committee_meeting_status"),
      fetchPlatformDictItems("committee_conclusion_decision"),
      fetchCommitteeProjectCompanyOptions(),
    ]);
    meetingStatusDictOptions.value = mapDictOptions(meetingItems);
    conclusionStatusOptions.value = mapDictOptions(conclusionItems);
    companyOptions.value = Array.from(
      new Set(
        companies
          .map((company) => String(company ?? "").trim())
          .filter(Boolean),
      ),
    );
  } catch {
    meetingStatusDictOptions.value = [];
    conclusionStatusOptions.value = [];
    companyOptions.value = [];
  }
}
onMounted(loadMeetingStatusOptions);
watch(level, (nextLevel, previousLevel) => {
  if (nextLevel === previousLevel) return;
  resetQuery();
  void table.value?.reload();
});
function meetingTypeLabel(row: CommitteeMeeting) {
  const record = row as CommitteeMeeting & Record<string, unknown>;
  const type = String(record.meetingType ?? "");
  if (level.value === "GROUP") return "集团产品委员会";
  if (type === "GATE_REVIEW" || type === "gate_review") return "品牌公司阀点评审会";
  return "品牌公司产品委员会";
}
function companyLabel(row: CommitteeMeeting) {
  return row.companyName || row.owningCompany || "--";
}
function conclusionValue(
  row: CommitteeMeeting,
  key?: "currentConclusionDecision" | "linkedSecondMeetingConclusion",
) {
  const record = row as CommitteeMeeting & Record<string, unknown>;
  if (key) return String(record[key] ?? "");
  return String(
    record.currentConclusionDecision ?? record.conclusionDecision ?? "",
  );
}
type ReviewProgress = {
  percentage: number;
  text: string;
};

function progressValue(row: CommitteeMeeting, group: "second" | "group") {
  const record = row as CommitteeMeeting & Record<string, unknown>;
  const prefix = group === "second" ? "second" : "group";
  const value = record[`${prefix}ReviewProgress`];
  const source =
    value ??
    (record[`${prefix}ReviewCompletedCount`] !== undefined
      ? {
          completed: record[`${prefix}ReviewCompletedCount`],
          total: record[`${prefix}ReviewTotalCount`],
        }
      : undefined);

  if (source && typeof source === "object") {
    const progress = source as Record<string, unknown>;
    const completed = Number(
      progress.completed ?? progress.approved ?? progress.done ?? 0,
    );
    const total = Number(progress.total ?? progress.count ?? 0);
    if (Number.isFinite(completed) && Number.isFinite(total) && total > 0) {
      return { completed, total };
    }
  }

  const matched = String(source ?? "").match(
    /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/,
  );
  if (matched) {
    const completed = Number(matched[1]);
    const total = Number(matched[2]);
    if (total > 0) return { completed, total };
  }

  return undefined;
}
function reviewProgress(
  row: CommitteeMeeting,
  group: "second" | "group",
): ReviewProgress {
  const value = progressValue(row, group);
  if (!value) return { percentage: 0, text: "" };
  return {
    percentage: Math.min(
      100,
      Math.round((value.completed / value.total) * 100),
    ),
    text: `${value.completed}/${value.total}`,
  };
}
function goToProject(row: CommitteeMeeting) {
  if (row.projectId) router.push(`/committee/projects/${row.projectId}`);
}
async function submit() {
  saving.value = true;
  try {
    await createCommitteeMeeting(level.value, {
      ...form,
      linkedSecondMeetingId: form.linkedSecondMeetingId || undefined,
      linkedSecondConclusionId: form.linkedSecondConclusionId || undefined,
    });
    BaseToast.success("会议已创建");
    visible.value = false;
    await table.value?.reload();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <PageContainer
    class="bq-management-page committee-meeting-list-page"
    :title="title"
  >
    <QueryTable
      ref="table"
      :func="load"
      row-key="id"
      fit-table-height
      show-toolbar
      :table-props="{ border: false }"
      :empty-title="emptyTitle"
      :empty-description="`请先创建${level === 'SECOND' ? '品牌公司会议' : '集团会议'}，或调整筛选条件后重试。`"
      @reset="resetQuery"
      ><template #search
        ><el-form :model="query"
          ><el-form-item v-if="level === 'SECOND'" label="会议类型"
            ><el-select
              v-model="query.meetingType"
              clearable
              placeholder="请选择会议类型"
              ><el-option label="产品委员会" value="PRODUCT_COMMITTEE" />
              <el-option
                label="阀点评审会"
                value="GATE_REVIEW" /></el-select></el-form-item
          ><el-form-item  label="所属公司"
            ><el-select
              v-model="query.companyName"
              clearable
              placeholder="请选择所属公司"
              ><el-option
                v-for="company in companyOptions"
                :key="company"
                :label="company"
                :value="company" /></el-select></el-form-item
          ><el-form-item  label="会议状态"
            ><el-select
              v-model="query.meetingStatus"
              clearable
              placeholder="请选择会议状态"
              ><el-option
                v-for="{ value, label } in meetingStatusDictOptions"
                :key="value"
                :label="label"
                :value="value" /></el-select></el-form-item
          ><el-form-item label="项目代号"
            ><el-input
              v-model="query.projectName"
              clearable
              placeholder="请输入项目代号" /></el-form-item></el-form></template
      ><template #toolbar
        ><PermissionButton
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="
            router.push(`/committee/meetings/${level.toLowerCase()}/create`)
          "
          >创建{{
            level === "SECOND" ? "品牌公司会议" : "集团会议"
          }}</PermissionButton
        >
        <!--    <div>{{`committee:meeting:${level.toLowerCase()}:add`}}</div>--> </template
      >
      <el-table-column
          width="140"
          label="所属公司"
          prop="companyName"
      ><template #default="{ row }: { row: CommitteeMeeting }">{{
          companyLabel(row)
        }}</template></el-table-column
      ><el-table-column
        v-if="level === 'SECOND'"
        label="会议类型"
        min-width="160"
        ><template #default="{ row }">{{
          meetingTypeLabel(row)
        }}</template></el-table-column
      >

      <el-table-column prop="projectName" width="120" label="关联项目"
        ><template #default="{ row }: { row: CommitteeMeeting }"
          ><PermissionButton link type="primary" @click="goToProject(row)">{{
            row.projectName || "--"
          }}</PermissionButton></template
        ></el-table-column
      ><el-table-column
        prop="gateName"
        label="阀点"
        width="60"
      /><el-table-column prop="attemptNo" label="会次"  align="center"
        ><template #default="{ row }"
          >第 {{ row.attemptNo }} 次</template
        ></el-table-column
      ><el-table-column label="会议状态" width="120"  align="center"
        ><template #default="{ row }: { row: CommitteeMeeting }"
          ><DictTag
            :value="row.meetingStatus"
            :options="meetingStatusDictOptions" /></template></el-table-column
      ><el-table-column
          width="160"
        v-if="level === 'GROUP'"
        label="关联品牌会议"
        prop="linkedSecondMeetingName"
        /><el-table-column
          width="160"
        v-if="level === 'GROUP'"
        label="品牌公司会议结论"
        align="center"
        ><template #default="{ row }"
          ><DictTag
            :value="conclusionValue(row, 'linkedSecondMeetingConclusion')"
            :options="conclusionStatusOptions" /></template></el-table-column
      ><el-table-column width="160" label="会议时间"
        ><template #default="{ row }"
          ><CommitteeDate :value="row.meetingTime" with-time /></template></el-table-column
      ><el-table-column width="160" label="评审截止"
        ><template #default="{ row }"
          ><CommitteeDate :value="row.reviewDeadlineTime" /></template
      ></el-table-column>
      <el-table-column label="评审准备进度" align="center"
        ><el-table-column
          label="品牌公司职能部室"

          align="center"
          ><template #default="{ row }"
            ><div class="meeting-progress">
              <el-progress
                :percentage="reviewProgress(row, 'second').percentage"
                :show-text="false"
                :stroke-width="13"
                class="meeting-progress__bar"
              /><span>{{ reviewProgress(row, "second").text }}</span>
            </div></template
          ></el-table-column
        ><el-table-column
          label="集团部室及管委会办公室"

          align="center"
          ><template #default="{ row }"
            ><div class="meeting-progress">
              <el-progress
                :percentage="reviewProgress(row, 'group').percentage"
                :show-text="false"
                :stroke-width="13"
                class="meeting-progress__bar"
              /><span>{{ reviewProgress(row, "group").text }}</span>
            </div></template
          ></el-table-column
        ></el-table-column
      >
      <el-table-column label="会议结论"  align="center"
        ><template #default="{ row }"
          ><DictTag
            :value="conclusionValue(row)"
            :options="conclusionStatusOptions" /></template></el-table-column
      ><el-table-column label="创建人"  width="120" show-overflow-tooltip
        ><template #default="{ row }: { row: CommitteeMeeting }">
          {{ row.createBy || "--" }}
        </template></el-table-column
      ><el-table-column width="160" label="创建时间"
        ><template #default="{ row }: { row: CommitteeMeeting }"
          ><CommitteeDate :value="row.createTime" with-seconds /></template
      ></el-table-column
      ><el-table-column label="操作" width="120" fixed="right" align="center"
        ><template #default="{ row }: { row: CommitteeMeeting }"
          ><PermissionButton
            link
            @click="
              router.push(
                `/committee/meetings/${level.toLowerCase()}/${row.id}`,
              )
            "
            >查看</PermissionButton
          >
          <!--      <div>{{`committee:meeting:${level.toLowerCase()}:view`}}</div>-->
        </template></el-table-column
      ></QueryTable
    ><BaseFormDialog
      v-model="visible"
      :title="`创建${committeeLevelLabel(level)}会议`"
      width="680px"
      :loading="saving"
      @confirm="submit"
      ><el-form label-position="top"
        ><CommitteeFormGrid :columns="2">
          <el-form-item label="项目 ID" required
            ><el-input v-model="form.projectId" /></el-form-item
          ><el-form-item label="阀点 ID" required
            ><el-input v-model="form.gateId" /></el-form-item
          ><el-form-item label="会议时间" required
            ><el-date-picker
              v-model="form.meetingTime"
              type="datetime"
              format="YYYY-MM-DD HH:mm"
              time-format="HH:mm"
              value-format="YYYY-MM-DD HH:mm:ss" /></el-form-item
          ><el-form-item label="评审截止时间" required
            ><el-date-picker
              v-model="form.reviewDeadlineTime"
              type="date"
              value-format="YYYY-MM-DD" /></el-form-item
          ><el-form-item label="会议地点"
            ><el-input v-model="form.meetingLocation" /></el-form-item
          ><template v-if="level === 'GROUP'"
            ><el-form-item label="关联品牌会议 ID"
              ><el-input v-model="form.linkedSecondMeetingId" /></el-form-item
            ><el-form-item label="关联二级结论 ID"
              ><el-input
                v-model="form.linkedSecondConclusionId"
                clearable /></el-form-item
          ></template>
        </CommitteeFormGrid>
        <el-form-item label="备注"
          ><el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="500" /></el-form-item></el-form></BaseFormDialog
  ></PageContainer>
</template>

<style scoped>
.committee-meeting-list-page :deep(.el-table) {
  --el-table-header-bg-color: #f0f1f2;
}

:global(
  .bq-management-page.committee-meeting-list-page .el-table th.el-table__cell
) {
  background-color: #f0f1f2;
}

:global(
  .bq-management-page.committee-meeting-list-page .el-table .el-table__cell
) {
  border-right: none !important;
}

.meeting-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 170px;
}

.meeting-progress__bar {
  width: 110px;
}

.meeting-progress__bar :deep(.el-progress-bar__outer) {
  background-color: #e9edf5;
}
</style>
