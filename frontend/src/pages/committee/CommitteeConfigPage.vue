<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  fetchCommitteeDepartments,
  fetchCommitteeGateTemplates,
  saveCommitteeDepartments,
  saveCommitteeGateTemplate,
} from "@/api/committee";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { BaseToast } from "@/components/base/BaseToast";
import { useAuthStore } from "@/stores/auth";
import type {
  CommitteeConfigDepartment,
  CommitteeGateTemplate,
} from "@/types/committee";
const authStore = useAuthStore();
const canConfigDepartments = computed(() =>
  authStore.hasPermission("committee:config:dept"),
);
const canConfigGates = computed(() =>
  authStore.hasPermission("committee:config:gate"),
);
const tab = ref(canConfigDepartments.value ? "departments" : "gates");
const departments = ref<CommitteeConfigDepartment[]>([]);
const gates = ref<CommitteeGateTemplate[]>([]);
const saving = ref(false);
async function loadDepartments() {
  if (!canConfigDepartments.value) return;
  departments.value = await fetchCommitteeDepartments();
}
async function loadGates() {
  if (!canConfigGates.value) return;
  gates.value = await fetchCommitteeGateTemplates();
}
async function loadCurrentTab() {
  if (tab.value === "departments") {
    await loadDepartments();
    return;
  }
  await loadGates();
}
async function saveDepartments() {
  saving.value = true;
  try {
    await saveCommitteeDepartments(departments.value);
    BaseToast.success("参评部门配置已保存");
    await loadDepartments();
  } finally {
    saving.value = false;
  }
}
async function saveGate(row: CommitteeGateTemplate) {
  saving.value = true;
  try {
    await saveCommitteeGateTemplate(row.gateCode, row);
    BaseToast.success("阀点模板已保存");
    await loadGates();
  } finally {
    saving.value = false;
  }
}
watch(tab, () => {
  void loadCurrentTab();
});
onMounted(loadCurrentTab);
</script>

<template>
  <PageContainer title="产品委员会配置"
    ><el-tabs v-model="tab"
      ><el-tab-pane
        v-if="canConfigDepartments"
        label="参评部门"
        name="departments"
        ><div class="config-toolbar">
          <span>部门范围、分组、默认必审和意见可见范围均由配置动态决定。</span
          ><PermissionButton
            type="primary"
            :loading="saving"
            @click="saveDepartments"
            >保存部门配置</PermissionButton
          >
        </div>
        <el-table :data="departments" border
          ><el-table-column prop="departmentName" label="部门" min-width="160"
            ><template #default="{ row }">{{
              row.departmentName ?? row.departmentId
            }}</template></el-table-column
          ><el-table-column label="分组" min-width="180"
            ><template #default="{ row }"
              ><el-select v-model="row.departmentGroup"
                ><el-option
                  label="品牌公司职能部室"
                  value="SECOND_COMPANY" /><el-option
                  label="集团部室及管委会办公室"
                  value="GROUP" /><el-option
                  label="管理部门"
                  value="MANAGEMENT" /></el-select></template></el-table-column
          ><el-table-column label="适用阶段" width="140"
            ><template #default="{ row }"
              ><el-select v-model="row.applicableStage"
                ><el-option label="二级" value="SECOND" /><el-option
                  label="集团"
                  value="GROUP" /></el-select></template></el-table-column
          ><el-table-column label="默认必审" width="100"
            ><template #default="{ row }"
              ><el-switch
                v-model="row.requiredByDefault"
                active-value="1"
                inactive-value="0" /></template></el-table-column
          ><el-table-column label="意见可见部门 ID" min-width="220"
            ><template #default="{ row }"
              ><el-select
                v-model="row.visibleDeptIds"
                multiple
                filterable
                allow-create
                default-first-option /></template></el-table-column
          ><el-table-column label="排序" width="90"
            ><template #default="{ row }"
              ><el-input-number
                v-model="row.sortNo"
                :min="0"
                controls-position="right" /></template></el-table-column
          ><el-table-column label="启用" width="80"
            ><template #default="{ row }"
              ><el-switch
                v-model="row.enableFlag"
                active-value="1"
                inactive-value="0" /></template></el-table-column></el-table></el-tab-pane
      ><el-tab-pane v-if="canConfigGates" label="阀点模板" name="gates"
        ><el-table :data="gates" border
          ><el-table-column
            prop="gateCode"
            label="阀点编码"
            width="120"
          /><el-table-column label="阀点" min-width="150"
            ><template #default="{ row }"
        ><el-input v-model="row.gateName" clearable /></template></el-table-column
          ><el-table-column label="阀点目的" min-width="220"
            ><template #default="{ row }"
              ><el-input
                v-model="row.gatePurpose" /></template></el-table-column
          ><el-table-column label="核心工作" min-width="220"
            ><template #default="{ row }"
              ><el-input
                v-model="row.coreWorkContent" /></template></el-table-column
          ><el-table-column label="二级模板版本" width="150"
            ><template #default="{ row }"
              ><el-input
                v-model="
                  row.secondTemplateVersionId
                " /></template></el-table-column
          ><el-table-column label="集团模板版本" width="150"
            ><template #default="{ row }"
              ><el-input
                v-model="
                  row.groupTemplateVersionId
                " /></template></el-table-column
          ><el-table-column label="启用" width="80"
            ><template #default="{ row }"
              ><el-switch
                v-model="row.enableFlag"
                active-value="1"
                inactive-value="0" /></template></el-table-column
          ><el-table-column label="操作" width="90" fixed="right"
            ><template #default="{ row }"
              ><PermissionButton
                link
                :loading="saving"
                @click="saveGate(row)"
                >保存</PermissionButton
              ></template
            ></el-table-column
          ></el-table
        ></el-tab-pane
      ></el-tabs
    ></PageContainer
  >
</template>

<style scoped>
.config-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact, 14px);
}
</style>
