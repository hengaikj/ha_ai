<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Back } from "@element-plus/icons-vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchCommitteeSnapshot,
  fetchCommitteeSnapshotList,
} from "@/api/committee";
import PageContainer from "@/components/layout/PageContainer.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import CommitteeDate from "./components/CommitteeDate.vue";
import { committeeRows, committeeTotal } from "./committee-ui";
const route = useRoute();
const router = useRouter();
const detail = computed(() => Boolean(route.params.snapshotId));
const value = ref<Record<string, unknown>>({});
const detailError = ref<{ code: string; message: string; traceId?: string }>();
const query = reactive({ meetingId: "", meetingLevel: "" });
function resetQuery() {
  query.meetingId = "";
  query.meetingLevel = "";
}
async function load(pageSize = 10, pageNo = 1) {
  if (detail.value) {
    detailError.value = undefined;
    try {
      value.value = await fetchCommitteeSnapshot(
        String(route.params.snapshotId),
      );
    } catch (reason) {
      value.value = {};
      const source = reason as {
        code?: string;
        message?: string;
        traceId?: string;
      };
      detailError.value = {
        code: source.code ?? "COMMITTEE_SNAPSHOT_DETAIL_ERROR",
        message: source.message ?? "委员会快照详情加载失败",
        traceId: source.traceId,
      };
    }
    return { list: [], total: 0 };
  }
  const result = await fetchCommitteeSnapshotList({
    meetingId: query.meetingId || undefined,
    meetingLevel: query.meetingLevel || undefined,
    pageSize,
    pageNo,
  });
  return { list: committeeRows(result), total: committeeTotal(result) };
}
onMounted(() => {
  if (detail.value) void load();
});
</script>
<template>
  <PageContainer
    class="bq-management-page"
    :title="detail ? '上会快照详情' : '快照与历史'"
    description="快照为截止时生成的只读上会留痕，不覆盖历史版本。"
    ><template #actions
      ><PermissionButton
        v-if="detail"
        class="bq-page-return-button"
        :icon="Back"
        @click="
          router.replace(
            String(
              route.query.returnPath || route.meta.breadcrumbParentPath || '/',
            ),
          )
        "
        >返回</PermissionButton
      ></template
    >
    <TraceErrorAlert v-if="detailError" v-bind="detailError" />
    <el-descriptions v-if="detail" :column="2" border
      ><el-descriptions-item
        v-for="(v, k) in value"
        :key="k"
        :label="String(k)"
        >{{ v ?? "--" }}</el-descriptions-item
      ></el-descriptions
    >
    <QueryTable
      v-else
      fit-table-height
      row-key="id"
      :func="load"
      empty-description="当前筛选条件下暂无快照"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="会议 ID">
            <el-input v-model="query.meetingId" clearable />
          </el-form-item>
          <el-form-item label="会议层级">
            <el-select v-model="query.meetingLevel" clearable>
              <el-option label="品牌公司" value="SECOND" />
              <el-option label="集团" value="GROUP" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <el-table-column
        prop="meetingId"
        label="会议 ID"
        min-width="120"
      /><el-table-column
        prop="meetingLevel"
        label="会议层级"
        width="110"
      /><el-table-column
        prop="snapshotRound"
        label="轮次"
        width="90"
      /><el-table-column
        prop="templateVersionId"
        label="模板版本"
        min-width="130"
      /><el-table-column
        prop="providerCode"
        label="生成方"
        width="120"
      /><el-table-column prop="generatedTime" label="生成时间" width="180"
        ><template #default="{ row }"
          ><CommitteeDate
            :value="row.generatedTime"
            with-seconds /></template></el-table-column
      ><el-table-column label="操作" width="90" fixed="right" align="center"
        ><template #default="{ row }"
          ><PermissionButton
            link
            @click="router.push(`/committee/snapshots/${row.id}`)"
            >查看</PermissionButton
          ></template
        ></el-table-column
      ></QueryTable
    ></PageContainer
  >
</template>
