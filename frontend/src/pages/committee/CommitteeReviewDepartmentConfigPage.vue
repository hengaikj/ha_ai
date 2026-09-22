<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {Check, RefreshRight, Search} from "@element-plus/icons-vue";
import {
  fetchCommitteeDepartments,
  saveCommitteeDepartments,
} from "@/api/committee";
import {
  fetchCommitteeConfigPlatformDepts,
  fetchPlatformDictItemsByType,
} from "@/api/platform-system";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BasePageTabs from "@/components/base/BasePageTabs.vue";
import {BaseToast} from "@/components/base/BaseToast";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import {useBaseConfirmDialog} from "@/composables/useBaseConfirmDialog";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {CommitteeConfigDepartment} from "@/types/committee";
import type {PlatformDeptItem} from "@/types/platform-system";

type StageTab = CommitteeConfigDepartment["applicableStage"];
type StageTabItem = { name: StageTab; label: string };
const maxMeetingLevelValueLength = 32;
const sourceDeptTreeProps = {
  children: "children",
  label: "deptName",
};

const loading = ref(false);
const {confirmState, openConfirm, resolveConfirm, rejectConfirm} =
    useBaseConfirmDialog();
const saving = ref(false);
const activeStage = ref<StageTab>("SECOND");
const keyword = ref("");
const deptTree = ref<PlatformDeptItem[]>([]);
const configs = ref<CommitteeConfigDepartment[]>([]);
const meetingLevelTabs = ref<StageTabItem[]>([]);
const savedConfigSnapshot = ref("");
const visibleDialogVisible = ref(false);
const editingVisibleDepartmentId = ref("");
const editingVisibleDepartmentIds = ref<string[]>([]);
const visibleDialogUseStageTabs = ref(false);

const activeStageLabel = computed(
    () =>
        meetingLevelTabs.value.find((item) => item.name === activeStage.value)
            ?.label ?? activeStage.value,
);

const enabledDeptTree = computed(() =>
    filterEnabledDepartments(deptTree.value),
);
const flatDepartments = computed(() =>
    flattenDepartments(enabledDeptTree.value),
);
const departmentById = computed(
    () =>
        new Map(
            flatDepartments.value.map((department) => [
              String(department.id),
              department,
            ]),
        ),
);

const filteredDepartments = computed(() => {
  const input = keyword.value.trim();
  if (!input) return enabledDeptTree.value;
  return filterDepartmentsByKeyword(enabledDeptTree.value, input);
});

const activeConfigs = computed(() =>
    configs.value
        .filter((item) => item.applicableStage === activeStage.value)
        .sort(
            (left, right) => Number(left.sortNo ?? 0) - Number(right.sortNo ?? 0),
        ),
);

const selectedDepartmentIds = computed(
    () => new Set(activeConfigs.value.map((item) => String(item.departmentId))),
);

const activeSelectedCount = computed(() => activeConfigs.value.length);
const activeRequiredCount = computed(
    () =>
        activeConfigs.value.filter((item) => item.requiredByDefault === "1")
            .length,
);
const hasMeetingLevelTabs = computed(() => meetingLevelTabs.value.length > 0);
const hasUnsavedChanges = computed(
    () => snapshotConfigs(configs.value) !== savedConfigSnapshot.value,
);
const visibleDialogStage = ref<StageTab>("");
const visibleDialogSupportsStageTabs = computed(
    () => visibleDialogUseStageTabs.value,
);
const editingVisibleDepartment = computed(() =>
    configs.value.find(
        (item) => String(item.departmentId) === editingVisibleDepartmentId.value,
    ),
);
const visibleScopeOptions = computed(() =>
    activeConfigs.value.map((item) => ({
      id: String(item.departmentId),
      name: item.departmentName || String(item.departmentId),
    })),
);
const visibleScopeStageTabs = computed(() =>
    visibleDialogSupportsStageTabs.value ? meetingLevelTabs.value : [],
);
const visibleScopeDepartmentsByStage = computed(() =>
    visibleDialogSupportsStageTabs.value
        ? visibleScopeStageTabs.value.map((tab) => ({
          ...tab,
          selectedCount: configs.value.filter(
              (item) =>
                  item.applicableStage === tab.name &&
                  editingVisibleDepartmentId.value !== String(item.departmentId) &&
                  editingVisibleDepartmentIds.value.includes(
                      String(item.departmentId),
                  ),
          ).length,
          departments: configs.value
              .filter((item) => item.applicableStage === tab.name)
              .slice()
              .sort(
                  (left, right) =>
                      Number(left.sortNo ?? 0) - Number(right.sortNo ?? 0),
              )
              .map((item) => ({
                id: String(item.departmentId),
                name: item.departmentName || String(item.departmentId),
              })),
        }))
        : [],
);
async function loadConfig() {
  loading.value = true;
  try {
    const [departments, departmentConfigs] = await Promise.all([
      fetchCommitteeConfigPlatformDepts(),
      fetchCommitteeDepartments(),
    ]);
    const allowedStages = new Set(
        meetingLevelTabs.value.map((item) => item.name),
    );
    deptTree.value = departments;
    configs.value = departmentConfigs
        .map(normalizeConfigDepartment)
        .filter(
            (item) =>
                !allowedStages.size || allowedStages.has(item.applicableStage),
        );
    savedConfigSnapshot.value = snapshotConfigs(configs.value);
  } finally {
    loading.value = false;
  }
}

async function loadMeetingLevelTabs() {
  const dictItems = await fetchPlatformDictItemsByType("committee_meeting_level");
  const tabs = dictItems
      .filter((item) => item.status === "ENABLED")
      .map<StageTabItem | null>((item) => {
        const value = String(item.dictItemCode ?? "").trim();
        const label = String(item.dictItemLabel ?? "").trim();
        if (!value || value.length > maxMeetingLevelValueLength) {
          return null;
        }
        return {
          name: value,
          label: label || value,
        };
      })
      .filter((item): item is StageTabItem => Boolean(item));
  meetingLevelTabs.value = uniqueStageTabs(tabs);
  if (!meetingLevelTabs.value.some((item) => item.name === activeStage.value)) {
    activeStage.value = meetingLevelTabs.value[0]?.name ?? "";
  }
}

async function handleStageChange(nextStage: string) {
  const normalizedNextStage = normalizeApplicableStage(nextStage);
  if (
      !normalizedNextStage ||
      normalizedNextStage === activeStage.value ||
      !hasMeetingLevelTabs.value
  ) {
    return;
  }
  if (hasUnsavedChanges.value) {
    try {
      await openConfirm({
        title: "未保存提示",
        message: "当前参评部门配置尚未保存，确认放弃更改并切换会议层级吗？",
        confirmText: "确认切换",
      });
    } catch {
      return;
    }
  }
  activeStage.value = normalizedNextStage;
}

function addDepartmentToStage(departmentId: string | number) {
  if (!hasMeetingLevelTabs.value || !activeStage.value) return;
  const resolvedId = String(departmentId);
  if (selectedDepartmentIds.value.has(resolvedId)) return;
  const department = departmentById.value.get(resolvedId);
  if (!department) return;
  configs.value = [
    ...configs.value,
    buildConfigFromDepartment(department, activeStage.value),
  ];
}

function removeDepartmentFromStage(departmentId: string | number) {
  const resolvedId = String(departmentId);
  configs.value = configs.value.filter(
      (item) =>
          item.applicableStage !== activeStage.value ||
          String(item.departmentId) !== resolvedId,
  );
}

function toggleDepartmentSelected(
    departmentId: string | number,
    selected: boolean,
) {
  if (selected) {
    addDepartmentToStage(departmentId);
    return;
  }
  removeDepartmentFromStage(departmentId);
}

function updateConfig(
    departmentId: string | number,
    patch: Partial<CommitteeConfigDepartment>,
) {
  const resolvedId = String(departmentId);
  configs.value = configs.value.map((item) =>
      item.applicableStage === activeStage.value &&
      String(item.departmentId) === resolvedId
          ? {...item, ...patch}
          : item,
  );
}

function openVisibleDialog(row: CommitteeConfigDepartment) {
  const supportsStageTabs = isGroupStage(row.applicableStage);
  editingVisibleDepartmentId.value = String(row.departmentId);
  editingVisibleDepartmentIds.value = normalizeVisibleDeptIds(
      row.visibleDeptIds,
      row.departmentId,
  );
  visibleDialogUseStageTabs.value = supportsStageTabs;
  visibleDialogStage.value = supportsStageTabs
      ? normalizeApplicableStage(row.applicableStage)
      : "";
  visibleDialogVisible.value = true;
}

function handleVisibleDialogStageChange(nextStage: string) {
  const resolvedStage = normalizeApplicableStage(nextStage);
  if (!resolvedStage) return;
  visibleDialogStage.value = resolvedStage;
}

function saveVisibleDepartments() {
  const departmentId = editingVisibleDepartmentId.value;
  if (!departmentId) return;
  updateConfig(departmentId, {
    visibleDeptIds: normalizeVisibleDeptIds(
        editingVisibleDepartmentIds.value,
        departmentId,
    ),
  });
  visibleDialogVisible.value = false;
  BaseToast.info("意见可见范围已更新，请保存配置");
}

async function resetDepartmentScopeConfig() {
  await loadConfig();
  BaseToast.info("已恢复为当前保存配置");
}

async function saveDepartmentScopeConfig() {
  if (!hasMeetingLevelTabs.value || !activeStage.value) return;
  saving.value = true;
  try {
    const allowedStages = new Set(
        meetingLevelTabs.value.map((item) => item.name),
    );
    await saveCommitteeDepartments(
        configs.value
            .map(normalizeConfigDepartment)
            .filter((item) => allowedStages.has(item.applicableStage)),
    );
    BaseToast.success("参评部门配置已保存");
    await loadConfig();
  } finally {
    saving.value = false;
  }
}

function buildConfigFromDepartment(
    department: PlatformDeptItem,
    stage: StageTab,
): CommitteeConfigDepartment {
  const applicableStage = normalizeApplicableStage(stage);
  const departmentId = String(department.id);
  return {
    departmentId,
    departmentName: department.deptName,
    applicableStage,
    requiredByDefault: "1",
    visibleDeptIds: [departmentId],
    sortNo: Number(department.sortNo ?? activeConfigs.value.length + 1),
    enableFlag: "1",
  };
}

function normalizeConfigDepartment(
    item: CommitteeConfigDepartment,
): CommitteeConfigDepartment {
  const applicableStage = normalizeApplicableStage(item.applicableStage);
  return {
    departmentId: String(item.departmentId),
    departmentName:
        item.departmentName ||
        departmentById.value.get(String(item.departmentId))?.deptName,
    applicableStage,
    requiredByDefault: item.requiredByDefault === "0" ? "0" : "1",
    visibleDeptIds: normalizeVisibleDeptIds(
        item.visibleDeptIds,
        item.departmentId,
    ),
    sortNo: Number(item.sortNo ?? 0),
    enableFlag: item.enableFlag === "0" ? "0" : "1",
  };
}

function normalizeVisibleDeptIds(
    value: CommitteeConfigDepartment["visibleDeptIds"] | string | undefined,
    ownDepartmentId: string | number,
) {
  const ids = Array.isArray(value)
      ? value
      : String(value ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
  return Array.from(new Set([String(ownDepartmentId), ...ids.map(String)]));
}

function snapshotConfigs(items: CommitteeConfigDepartment[]) {
  return JSON.stringify(
      items
          .map((item) => ({
            departmentId: String(item.departmentId),
            departmentName: item.departmentName ?? "",
            applicableStage: normalizeApplicableStage(item.applicableStage),
            requiredByDefault: item.requiredByDefault === "0" ? "0" : "1",
            visibleDeptIds: normalizeVisibleDeptIds(
                item.visibleDeptIds,
                item.departmentId,
            )
                .slice()
                .sort(),
            sortNo: Number(item.sortNo ?? 0),
            enableFlag: item.enableFlag === "0" ? "0" : "1",
          }))
          .sort((left, right) => {
            if (left.applicableStage !== right.applicableStage) {
              return left.applicableStage.localeCompare(right.applicableStage);
            }
            return left.departmentId.localeCompare(right.departmentId);
          }),
  );
}

function filterEnabledDepartments(
    items: PlatformDeptItem[],
): PlatformDeptItem[] {
  return items
      .filter((item) => item.status === "ENABLED")
      .map((item) => ({
        ...item,
        children: filterEnabledDepartments(item.children ?? []),
      }));
}

function filterDepartmentsByKeyword(
    items: PlatformDeptItem[],
    input: string,
): PlatformDeptItem[] {
  return items.reduce<PlatformDeptItem[]>((result, item) => {
    const children = filterDepartmentsByKeyword(item.children ?? [], input);
    if (item.deptName.includes(input) || children.length > 0) {
      result.push({...item, children});
    }
    return result;
  }, []);
}

function flattenDepartments(items: PlatformDeptItem[]): PlatformDeptItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenDepartments(item.children ?? []),
  ]);
}

function visibleSummary(row: CommitteeConfigDepartment) {
  const count = normalizeVisibleDeptIds(
      row.visibleDeptIds,
      row.departmentId,
  ).length;
  return count <= 1 ? "仅本部门" : `本部门 + ${count - 1} 个部门`;
}

function normalizeApplicableStage(value: unknown): StageTab {
  return String(value ?? "").trim();
}

function isGroupStage(value: unknown) {
  const stage = normalizeApplicableStage(value);
  return stage === "GROUP";
}

function uniqueStageTabs(tabs: StageTabItem[]) {
  const result: StageTabItem[] = [];
  const used = new Set<string>();
  for (const tab of tabs) {
    if (used.has(tab.name)) {
      continue;
    }
    used.add(tab.name);
    result.push(tab);
  }
  return result;
}

onMounted(async () => {
  await loadMeetingLevelTabs();
  await loadConfig();
});
</script>

<template>
  <PageContainer
      title="会议参评部门配置"
      description="从系统部门管理中选择参评部门，按会议层级字典维护默认参评范围、必审规则和意见可见范围。"
  >
    <section v-loading="loading" class="review-dept-config">
      <div class="review-dept-config__tabs-row">
        <div class="review-dept-config__tabs">
          <BasePageTabs
              :model-value="activeStage"
              :tabs="meetingLevelTabs"
              @update:model-value="handleStageChange"
          />
        </div>
        <div class="review-dept-config__tabs-actions">
          <PermissionButton
              :icon="RefreshRight"
              @click="resetDepartmentScopeConfig"
          >
            恢复已保存
          </PermissionButton>
          <PermissionButton
              type="primary"
              :icon="Check"
              :loading="saving"
              :disabled="!hasMeetingLevelTabs"
              @click="saveDepartmentScopeConfig"
          >
            保存配置
          </PermissionButton>
        </div>
      </div>

      <div class="review-dept-config__layout">
        <section class="review-dept-config__source">
          <BaseSectionTitle title="系统组织架构" heading-tag="h2" />
          <el-input
            v-model="keyword"
            :prefix-icon="Search"
            clearable
            maxlength="64"
            placeholder="搜索部门名称"
          />
          <el-tree
              :data="filteredDepartments"
              :props="sourceDeptTreeProps"
              node-key="id"
              default-expand-all
              :expand-on-click-node="false"
              class="review-dept-config__source-tree"
              empty-text="暂无可选部门"
          >
            <template #default="{ data }: { data: PlatformDeptItem }">
              <div class="review-dept-config__dept-node">
                <el-checkbox
                    :model-value="selectedDepartmentIds.has(String(data.id))"
                    :disabled="!hasMeetingLevelTabs"
                    @click.stop
                    @change="toggleDepartmentSelected(data.id, Boolean($event))"
                />
                <span class="review-dept-config__dept-name">
                  {{ data.deptName }}
                </span>
              </div>
            </template>
          </el-tree>
        </section>

        <section class="review-dept-config__selected">
          <BaseSectionTitle
            :title="`${activeStageLabel}配置`"
            heading-tag="h2"
          >
            <template #actions>
              <div class="review-dept-config__selected-count">
                <span>参评部门 {{ activeSelectedCount }} 个</span>
                <span>必审部门 {{ activeRequiredCount }} 个</span>
              </div>
            </template>
          </BaseSectionTitle>
          <el-table
              :data="activeConfigs"
              border
              row-key="departmentId"
              empty-text="请从左侧系统部门中选择参评部门"
          >
            <el-table-column
                prop="departmentName"
                label="部门"
                min-width="150"
            />
            <el-table-column label="默认必审" width="110" align="center">
              <template #default="{ row }: { row: CommitteeConfigDepartment }">
                <el-switch
                    v-model="row.requiredByDefault"
                    active-value="1"
                    inactive-value="0"
                />
              </template>
            </el-table-column>
            <el-table-column label="意见可见范围" min-width="180">
              <template #default="{ row }: { row: CommitteeConfigDepartment }">
                <div class="review-dept-config__visible-cell">
                  <span>{{ visibleSummary(row) }}</span>
                  <PermissionButton
                      link
                      type="primary"
                      @click="openVisibleDialog(row)"
                  >
                    配置
                  </PermissionButton>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="排序" width="110">
              <template #default="{ row }: { row: CommitteeConfigDepartment }">
                <el-input-number
                    v-model="row.sortNo"
                    :min="0"
                    controls-position="right"
                />
              </template>
            </el-table-column>
            <el-table-column label="启用" width="90" align="center">
              <template #default="{ row }: { row: CommitteeConfigDepartment }">
                <el-switch
                    v-model="row.enableFlag"
                    active-value="1"
                    inactive-value="0"
                />
              </template>
            </el-table-column>
            <el-table-column
                label="操作"
                width="90"
                fixed="right"
                align="center"
            >
              <template #default="{ row }: { row: CommitteeConfigDepartment }">
                <PermissionButton
                    text
                    type="danger"
                    @click="removeDepartmentFromStage(row.departmentId)"
                >
                  移除
                </PermissionButton>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>

      <BaseFormDialog
          v-model="visibleDialogVisible"
          :title="`配置${editingVisibleDepartment?.departmentName ?? ''}可见范围`"
          width="720px"
          confirm-text="保存范围"
          @confirm="saveVisibleDepartments"
      >
        <section class="review-dept-config__visible-dialog">
          <p v-if="visibleDialogSupportsStageTabs">
            按会议层级分 tab 选择可查看意见的部门，本部门会自动包含。
          </p>
          <p v-else>按当前会议层级选择可查看意见的部门，本部门会自动包含。</p>
          <template v-if="visibleDialogSupportsStageTabs">
            <BasePageTabs
                :model-value="visibleDialogStage"
                :tabs="visibleScopeStageTabs"
                @update:model-value="handleVisibleDialogStageChange"
            />
            <section
                v-for="group in visibleScopeDepartmentsByStage"
                v-show="group.name === visibleDialogStage"
                :key="group.name"
                class="review-dept-config__visible-stage"
            >
              <div class="review-dept-config__visible-stage-head">
                <span>{{ group.label }}</span>
                <span>已选 {{ group.selectedCount }} 个部门</span>
              </div>
              <el-checkbox-group v-model="editingVisibleDepartmentIds">
                <el-checkbox
                    v-for="department in group.departments"
                    :key="department.id"
                    :value="department.id"
                    :disabled="department.id === editingVisibleDepartmentId"
                    border
                >
                  {{ department.name }}
                </el-checkbox>
              </el-checkbox-group>
              <el-empty
                  v-if="!group.departments.length"
                  description="当前会议层级暂无可选部门"
              />
            </section>
          </template>
          <template v-else>
            <el-checkbox-group v-model="editingVisibleDepartmentIds">
              <el-checkbox
                  v-for="department in visibleScopeOptions"
                  :key="department.id"
                  :value="department.id"
                  :disabled="department.id === editingVisibleDepartmentId"
                  border
              >
                {{ department.name }}
              </el-checkbox>
            </el-checkbox-group>
            <el-empty
                v-if="!visibleScopeOptions.length"
                description="当前会议层级暂无可选部门"
            />
          </template>
        </section>
      </BaseFormDialog>
    </section>
    <BaseConfirm
        v-model="confirmState.visible"
        v-bind="confirmState"
        @confirm="resolveConfirm"
        @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.review-dept-config {
  display: grid;
  gap: var(--bq-space-section);
  min-width: 0;
}

.review-dept-config__tabs-row {
  display: flex;
  align-items: stretch;
  min-width: 0;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.review-dept-config__tabs {
  flex: 1 1 auto;
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;
  padding: 0 4px;
}

.review-dept-config__tabs :deep(.base-page-tabs) {
  width: max-content;
  min-width: 100%;
}

.review-dept-config__tabs :deep(.el-tabs__header) {
  margin: 0;
  border-bottom: 0;
}

.review-dept-config__tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.review-dept-config__tabs :deep(.el-tabs--card > .el-tabs__header .el-tabs__nav) {
  border: 0;
}

.review-dept-config__tabs :deep(.el-tabs--card > .el-tabs__header .el-tabs__item) {
  height: 42px;
  padding: 0 18px;
  color: var(--bq-color-text-secondary);
  font-weight: 400;
  border-left: 0;
  border-bottom: 2px solid transparent;
  transition:
    color 0.16s ease,
    border-color 0.16s ease;
}

.review-dept-config__tabs :deep(.el-tabs--card > .el-tabs__header .el-tabs__item:hover) {
  color: var(--bq-color-text);
}

.review-dept-config__tabs :deep(.el-tabs--card > .el-tabs__header .el-tabs__item.is-active) {
  color: var(--bq-color-primary);
  font-weight: 500;
  background: transparent;
  border-bottom-color: var(--bq-color-primary);
}

.review-dept-config__tabs-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
  padding: 0 4px 8px 16px;
}

.review-dept-config__layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.7fr) minmax(0, 1.8fr);
  gap: var(--bq-space-section);
  min-width: 0;
}

.review-dept-config__source,
.review-dept-config__selected {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  box-shadow: var(--bq-shadow-card);
}

.review-dept-config__selected header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.review-dept-config__selected-count {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--bq-color-text-muted);
  font-size: var(--bq-font-body, 13px);
  line-height: 20px;
  white-space: nowrap;
}

.review-dept-config__source-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  min-height: 32px;
  line-height: 20px;
}


.review-dept-config__source h2,
.review-dept-config__selected h2 {
  margin: 0;
  color: var(--bq-color-text);
  font-size: var(--bq-font-section-title, 16px);
  font-weight: 600;
  line-height: 20px;
}

.review-dept-config__visible-dialog p {
  margin: 0;
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact, 14px);
  line-height: 20px;
}

.review-dept-config__source-tree {
  overflow: auto;
  height: 380px;
  padding: 6px 0;
  border-top: 1px solid var(--bq-color-border-subtle);
}

.review-dept-config__source-tree :deep(.el-tree-node__content) {
  height: 42px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.review-dept-config__source-tree :deep(.el-tree-node__content:hover) {
  background: var(--bq-color-bg-soft);
}

.review-dept-config__dept-node {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  min-width: 0;
  width: 100%;
}

.review-dept-config__dept-name {
  overflow: hidden;
  min-width: 0;
  color: var(--bq-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-dept-config__selected :deep(.el-select),
.review-dept-config__selected :deep(.el-input-number) {
  width: 100%;
}

.review-dept-config__visible-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.review-dept-config__visible-cell span {
  color: var(--bq-color-text-secondary);
  font-size: var(--bq-font-compact, 14px);
}

.review-dept-config__visible-dialog {
  display: grid;
  gap: 14px;
}

.review-dept-config__visible-dialog :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.review-dept-config__visible-dialog :deep(.el-checkbox.is-bordered) {
  margin: 0;
}

@media (max-width: 1180px) {
  .review-dept-config__layout {
    grid-template-columns: 1fr;
  }

  .review-dept-config__selected header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
