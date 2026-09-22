<script setup lang="ts">
import DictTag from "@/components/base/DictTag.vue";
import { computed, onMounted, ref } from "vue";
import { Back } from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import { fetchCommitteeGateMeetings } from "@/api/committee";
import { fetchPlatformDictItems } from "@/api/platform-system";
import CommitteeDate from "./components/CommitteeDate.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type { CommitteeMeeting } from "@/types/committee";
import type { SchemaOption } from "@/types/schema-components";
import { committeeLevelLabel } from "./committee-ui";

const route = useRoute();
const router = useRouter();
const projectId = computed(() => String(route.params.projectId));
const gateId = computed(() => String(route.params.gateId));
const meetingStatusOptions = ref<SchemaOption[]>([]);
async function loadMeetingStatusOptions() {
  try {
    const items = await fetchPlatformDictItems("committee_meeting_status");
    meetingStatusOptions.value = items.map((item) => ({
      label: item.label,
      value: item.value,
      cssClass: item.cssClass,
      listClass: item.listClass,
      styleClass: item.styleClass,
      raw: item.raw,
    }));
  } catch {
    meetingStatusOptions.value = [];
  }
}
onMounted(loadMeetingStatusOptions);

async function load() {
  const history = await fetchCommitteeGateMeetings(
    projectId.value,
    gateId.value,
  );
  const list = [...history.second, ...history.group];
  return { list, total: list.length };
}

function goBack() {
  router.push({
    name: "committeeProjectDetail",
    params: { projectId: projectId.value },
  });
}
</script>

<template>
  <PageContainer
    class="bq-management-page"
    title="会议历史"
    description="按同一项目与阀点保留品牌公司、集团历次上会记录。"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        @click="goBack"
      >
        返回
      </PermissionButton>
    </template>

    <QueryTable
      :func="load"
      row-key="id"
      fit-table-height
      :show-pagination="false"
      :show-toolbar="false"
      empty-title="暂无会议历史"
      empty-description="该阀点暂无会议历史。"
    >
      <el-table-column label="层级" width="150">
        <template #default="{ row }: { row: CommitteeMeeting }">
          {{ committeeLevelLabel(row.meetingLevel) }}
        </template>
      </el-table-column>
      <el-table-column prop="meetingName" label="会议名称" min-width="220" />
      <el-table-column label="会次" width="90">
        <template #default="{ row }: { row: CommitteeMeeting }">
          第 {{ row.attemptNo }} 次
        </template>
      </el-table-column>
      <el-table-column label="会议时间" width="180">
        <template #default="{ row }: { row: CommitteeMeeting }">
          <CommitteeDate :value="row.meetingTime" with-time />
        </template>
      </el-table-column>
      <el-table-column label="会议状态" width="120" align="center">
        <template #default="{ row }: { row: CommitteeMeeting }">
          <DictTag :value="row.meetingStatus" :options="meetingStatusOptions" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right" align="center">
        <template #default="{ row }: { row: CommitteeMeeting }">
          <PermissionButton
            link
            @click="
              router.push(
                `/committee/meetings/${row.meetingLevel.toLowerCase()}/${row.id}`,
              )
            "
          >
            查看
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>
  </PageContainer>
</template>
