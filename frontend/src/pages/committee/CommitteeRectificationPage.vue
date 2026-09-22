<script setup lang="ts">
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import { reactive, ref } from "vue";
import {
  actOnCommitteeRectification,
  fetchCommitteeRectifications,
} from "@/api/committee";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import CommitteeDate from "./components/CommitteeDate.vue";
import type { CommitteeRectification } from "@/types/committee";
import {
  committeeRows,
  committeeStatusLabel,
  committeeTagType,
  committeeTotal,
} from "./committee-ui";

const query = reactive({
  projectName: "",
  responsibleUserName: "",
  status: "",
  mine: false,
});
const table = ref<{ reload: () => Promise<void> }>();
const visible = ref(false);
const saving = ref(false);
const current = ref<CommitteeRectification>();
const action = ref<"submit" | "accept" | "reject">("submit");
const form = reactive({
  completionText: "",
  evidenceAttachmentIds: "",
  opinion: "",
});
function firstText(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return "--";
}
function rectificationDepartmentName(row: CommitteeRectification) {
  return firstText(row.responsibleDepartmentName, row.responsibleDeptName);
}
function rectificationUserName(row: CommitteeRectification) {
  return firstText(row.responsibleUserName, row.responsibleUserId);
}
async function load(pageSize: number, pageNo: number) {
  const result = await fetchCommitteeRectifications({
    pageNum: pageNo,
    pageSize,
    projectName: query.projectName || undefined,
    responsibleUserName: query.responsibleUserName || undefined,
    status: query.status || undefined,
    mine: query.mine || undefined,
  });
  return { list: committeeRows(result), total: committeeTotal(result) };
}
function resetQuery() {
  query.projectName = "";
  query.responsibleUserName = "";
  query.status = "";
  query.mine = false;
}
function isOverdue(row: CommitteeRectification) {
  if (row.rectificationStatus === "ACCEPTED" || !row.expectedFinishDate) {
    return false;
  }
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return row.expectedFinishDate.slice(0, 10) < today;
}
function open(row: CommitteeRectification, next: typeof action.value) {
  current.value = row;
  action.value = next;
  form.completionText = String(row.completionText ?? "");
  form.evidenceAttachmentIds = "";
  form.opinion = "";
  visible.value = true;
}
async function submit() {
  if (!current.value) return;
  saving.value = true;
  try {
    const data =
      action.value === "submit"
        ? {
            expectedLockVersion: current.value.lockVersion,
            completionText: form.completionText,
            evidenceAttachmentIds: form.evidenceAttachmentIds
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          }
        : {
            expectedLockVersion: current.value.lockVersion,
            opinion: form.opinion,
          };
    await actOnCommitteeRectification(current.value.id, action.value, data);
    BaseToast.success("整改状态已更新");
    visible.value = false;
    await table.value?.reload();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <PageContainer class="bq-management-page" title="整改跟踪">
    <QueryTable
      ref="table"
      :func="load"
      row-key="id"
      fit-table-height
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="项目代号">
            <el-input
              v-model="query.projectName"
              clearable
              placeholder="请输入项目代号"
            />
          </el-form-item>
          <el-form-item label="责任人">
            <el-input
              v-model="query.responsibleUserName"
              clearable
              placeholder="请输入责任人"
            />
          </el-form-item>
          <el-form-item label="整改状态">
            <el-select v-model="query.status" clearable placeholder="全部状态">
              <el-option
                v-for="value in [
                  'PENDING',
                  'SUBMITTED',
                  'ACCEPTED',
                  'REJECTED',
                ]"
                :key="value"
                :value="value"
                :label="committeeStatusLabel(value)"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="只看我的">
            <el-switch v-model="query.mine" />
          </el-form-item>
        </el-form>
      </template>
      <el-table-column
        prop="projectName"
        label="项目代号"
        min-width="140"
      /><el-table-column
        prop="requirementText"
        label="整改要求"
        min-width="260"
        show-overflow-tooltip
      /><el-table-column
        prop="responsibleDeptName"
        label="责任部门"
        min-width="130"
        show-overflow-tooltip
        ><template #default="{ row }: { row: CommitteeRectification }">{{
          rectificationDepartmentName(row)
        }}</template></el-table-column
      ><el-table-column
        label="责任人"
        width="110"
        show-overflow-tooltip
        ><template #default="{ row }: { row: CommitteeRectification }">{{
          rectificationUserName(row)
        }}</template></el-table-column
      ><el-table-column label="计划完成时间" min-width="190"
        ><template #default="{ row }"
          ><div class="rectification-deadline">
            <CommitteeDate :value="row.expectedFinishDate" />
            <span
              v-if="isOverdue(row)"
              class="rectification-deadline__overdue"
              aria-label="已逾期"
              >已逾期</span
            >
          </div></template
        ></el-table-column
      ><el-table-column label="整改状态" width="110" align="center"
        ><template #default="{ row }"
          ><BaseStatusTag
            :label="committeeStatusLabel(row.rectificationStatus)"
            :type="
              committeeTagType(row.rectificationStatus)
            " /></template></el-table-column
      ><el-table-column label="操作" width="190" fixed="right" align="center"
        ><template #default="{ row }: { row: CommitteeRectification }"
          ><div class="bq-table-actions">
            <PermissionButton
              v-if="['PENDING', 'REJECTED'].includes(row.rectificationStatus)"
              link
              permission="committee:rectification:submit"
              @click="open(row, 'submit')"
              >提交</PermissionButton
            ><PermissionButton
              v-if="row.rectificationStatus === 'SUBMITTED'"
              link
              permission="committee:rectification:accept"
              @click="open(row, 'accept')"
              >验收</PermissionButton
            ><PermissionButton
              v-if="row.rectificationStatus === 'SUBMITTED'"
              link
              type="danger"
              permission="committee:rectification:reject"
              @click="open(row, 'reject')"
              >驳回</PermissionButton
            >
          </div></template
        ></el-table-column
      ></QueryTable
    >
    <BaseFormDialog
      v-model="visible"
      :title="
        action === 'submit'
          ? '提交整改'
          : action === 'accept'
            ? '验收整改'
            : '驳回整改'
      "
      width="560px"
      :loading="saving"
      @confirm="submit"
      ><el-form label-position="top"
        ><template v-if="action === 'submit'"
          ><el-form-item label="完成说明" required
            ><el-input
              v-model="form.completionText"
              type="textarea"
              :rows="5"
              maxlength="4000" /></el-form-item
          ><el-form-item label="证据附件 ID" required
            ><el-input
              v-model="form.evidenceAttachmentIds"
              placeholder="多个附件 ID 使用逗号分隔" /></el-form-item></template
        ><el-form-item v-else label="验收意见" required
          ><el-input
            v-model="form.opinion"
            type="textarea"
            :rows="4"
            maxlength="1000" /></el-form-item></el-form></BaseFormDialog
  ></PageContainer>
</template>

<style scoped>
.rectification-deadline {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.rectification-deadline__overdue {
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 18px;
}
</style>
