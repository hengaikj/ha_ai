<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Back, Check, Grid, Loading, Search } from "@element-plus/icons-vue";
import type { ElTree } from "element-plus";
import {
  fetchBudgetGradeTree,
  fetchCostCategoryTree,
  fetchProjectDataGrantList,
  fetchProjectGrantList,
  fetchRevenuePermissionTree,
  fetchUserPermissionProjects,
  saveProjectDataGrant,
  saveProjectGrantState,
  saveRevenueSubjectPermissions,
  type PermissionId,
  type RevenuePermissionNode,
  type RevenueSubjectPermission,
  type UserDataPermissionProject,
  type UserDataPermissionTreeNode,
  type UserDataPermissionType,
} from "@/api/system/user-data-permission";
import { ApiBusinessError } from "@/api/http";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { useAuthStore } from "@/stores/auth";

type TreeRef = InstanceType<typeof ElTree>;

type PermissionTab = {
  label: string;
  value: UserDataPermissionType;
  permission: string;
  enabled: boolean;
};

type RevenueTreeNode = RevenuePermissionNode & {
  id: PermissionId;
  parentId?: PermissionId | null;
  subjectName: string;
  isVirtualRoot?: boolean;
  children?: RevenueTreeNode[];
  directPermissionConfigured?: boolean;
  directPermissionLevel?: string | null;
  directGrantScope?: string | null;
  directRemark?: string | null;
  effectivePermissionLevel?: string | null;
  permissionLevel?: string | null;
};

const WRITE_PERMISSION_LEVEL = "DATA_ENTRY";
const GRANT_SCOPE_SELF = "SELF";
const REVENUE_ROOT_ID = "__REVENUE_AUTH_ALL__";

const tabs: PermissionTab[] = [
  {
    label: "预算数据授权",
    value: "0",
    permission: "system:auth:budget",
    enabled: true,
  },
  {
    label: "设计成本部授权",
    value: "1",
    permission: "system:auth:design",
    enabled: true,
  },
  {
    label: "成本数据授权",
    value: "2",
    permission: "system:auth:cost",
    enabled: true,
  },
  {
    label: "收益数据授权",
    value: "3",
    permission: "system:auth:income",
    enabled: true,
  },
  {
    label: "产品委员会授权",
    value: "4",
    permission: "system:auth:committee",
    enabled: true,
  },
];

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const detailTreeRef = ref<TreeRef>();
const projects = ref<UserDataPermissionProject[]>([]);
const authorizedProjectMap = reactive<Record<string, boolean>>({});
const projectLoadingMap = reactive<Record<string, boolean>>({});
const detailCheckedHistory = reactive<Record<string, PermissionId[]>>({});
const detailTreeData = ref<UserDataPermissionTreeNode[]>([]);
const revenueTreeData = ref<RevenueTreeNode[]>([]);
const detailCheckedKeys = ref<PermissionId[]>([]);
const selectedProjectId = ref<PermissionId | null>(null);
const activeTab = ref<UserDataPermissionType>("0");
const companyFilter = ref<string[]>([]);
const projectKeyword = ref("");
const detailKeyword = ref("");
const loadingProjects = ref(false);
const loadingDetail = ref(false);
const saving = ref(false);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const userId = computed(() =>
  decodeRouteText(route.params.userId, route.query.userId),
);
const username = computed(() =>
  decodeRouteText(
    route.params.username ?? route.params.userName,
    route.query.username ?? route.query.userName,
  ),
);
const displayName = computed(() =>
  decodeRouteText(
    route.params.displayName ?? route.params.nickName,
    route.query.displayName ?? route.query.nickName,
  ),
);
const visibleTabs = computed(() =>
  tabs.filter((tab) => tab.enabled && authStore.hasPermission(tab.permission)),
);
const selectedProject = computed(() =>
  projects.value.find(
    (project) => String(project.id) === selectedProjectKey.value,
  ),
);
const selectedProjectKey = computed(() =>
  selectedProjectId.value === null ? "" : String(selectedProjectId.value),
);
const selectedProjectAuthorized = computed(() =>
  selectedProjectKey.value
    ? Boolean(authorizedProjectMap[selectedProjectKey.value])
    : false,
);
const companyOptions = computed(() => {
  const names = projects.value
    .map(resolveProjectCompany)
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(names));
});
const filteredProjects = computed(() => {
  const keyword = projectKeyword.value.trim().toLowerCase();
  return projects.value.filter((project) => {
    const company = resolveProjectCompany(project);
    const matchCompany =
      companyFilter.value.length === 0 ||
      (company ? companyFilter.value.includes(company) : false);
    const text = [
      resolveProjectName(project),
      project.projectCode,
      project.projectNo,
      project.wbsNumber,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchCompany && (!keyword || text.includes(keyword));
  });
});
const isRevenueTab = computed(() => activeTab.value === "3");
const isProjectOnlyTab = computed(
  () => activeTab.value === "2" || activeTab.value === "4",
);
const detailPanelTitle = computed(() => {
  if (activeTab.value === "2") return "项目级成本授权";
  if (activeTab.value === "3") return "收益科目授权";
  if (activeTab.value === "4") return "产品上会项目管理授权";
  return activeTab.value === "1" ? "成本分类授权" : "预算等级授权";
});
const saveDisabled = computed(() => {
  if (!selectedProjectKey.value || !selectedProjectAuthorized.value)
    return true;
  if (loadingDetail.value || saving.value) return true;
  if (isProjectOnlyTab.value) return true;
  return !hasPendingChanges();
});

watch(
  visibleTabs,
  (items) => {
    if (!items.some((item) => item.value === activeTab.value)) {
      activeTab.value = items[0]?.value ?? "0";
    }
  },
  { immediate: true },
);

watch(detailKeyword, (keyword) => {
  detailTreeRef.value?.filter(keyword);
});

watch(activeTab, async () => {
  await handleTabChanged();
});

void initializePage();

async function initializePage() {
  await loadProjects();
  if (visibleTabs.value.length > 0) {
    await loadProjectGrantState();
  }
}

function decodeRouteText(
  paramValue: string | string[] | undefined,
  queryValue: unknown,
) {
  const raw = Array.isArray(paramValue)
    ? paramValue[0]
    : paramValue || (typeof queryValue === "string" ? queryValue : "");
  try {
    return decodeURIComponent(String(raw || ""));
  } catch {
    return String(raw || "");
  }
}

async function loadProjects() {
  loadingProjects.value = true;
  error.value = null;
  try {
    projects.value = toArray(await fetchUserPermissionProjects());
    if (companyOptions.value.length > 0) {
      companyFilter.value = [...companyOptions.value];
    }
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    loadingProjects.value = false;
  }
}

async function handleTabChanged() {
  if (!userId.value) return;
  if (hasPendingChanges()) {
    try {
      await openConfirm({
        title: "切换授权类型",
        message: "当前项目的数据权限明细尚未保存，确认切换授权类型？",
        type: "warning",
        confirmText: "确认切换",
        cancelText: "取消",
      });
    } catch (unknownError) {
      if (unknownError === "cancel" || unknownError === "close") return;
    }
  }
  selectedProjectId.value = null;
  detailTreeData.value = [];
  revenueTreeData.value = [];
  detailCheckedKeys.value = [];
  clearRecord(detailCheckedHistory);
  await loadProjectGrantState();
}

async function loadProjectGrantState() {
  error.value = null;
  try {
    const ids = toArray(await fetchProjectGrantList(userId.value, activeTab.value));
    clearRecord(authorizedProjectMap);
    projects.value.forEach((project) => {
      authorizedProjectMap[String(project.id)] = false;
    });
    ids.forEach((id) => {
      authorizedProjectMap[String(id)] = true;
    });
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

async function selectProject(project: UserDataPermissionProject) {
  if (selectedProjectKey.value === String(project.id)) return;
  if (hasPendingChanges()) {
    try {
      await openConfirm({
        title: "切换项目",
        message: `项目「${resolveProjectName(selectedProject.value)}」的数据权限明细尚未保存，确认切换项目？`,
        type: "warning",
        confirmText: "确认切换",
        cancelText: "取消",
      });
    } catch (unknownError) {
      if (unknownError === "cancel" || unknownError === "close") return;
    }
  }
  selectedProjectId.value = project.id;
  detailCheckedKeys.value = [];
  detailTreeData.value = [];
  revenueTreeData.value = [];
  await loadDetailForProject(project.id);
}

async function toggleProjectGrant(project: UserDataPermissionProject) {
  const key = String(project.id);
  const nextAuthorized = !authorizedProjectMap[key];
  if (
    !nextAuthorized &&
    selectedProjectKey.value === key &&
    hasPendingChanges()
  ) {
    try {
      await openConfirm({
        title: "取消项目授权",
        message: `项目「${resolveProjectName(project)}」的数据权限明细尚未保存，确认取消项目授权？`,
        type: "warning",
        confirmText: "确认取消",
        cancelText: "返回编辑",
      });
    } catch (unknownError) {
      if (unknownError === "cancel" || unknownError === "close") return;
    }
  }
  projectLoadingMap[key] = true;
  error.value = null;
  try {
    await saveProjectGrantState({
      projectId: project.id,
      userId: userId.value,
      type: activeTab.value,
      status: nextAuthorized ? 1 : 0,
    });
    authorizedProjectMap[key] = nextAuthorized;
    if (nextAuthorized) {
      selectedProjectId.value = project.id;
      detailCheckedKeys.value = [];
      detailTreeData.value = [];
      revenueTreeData.value = [];
      await loadDetailForProject(project.id);
    }
    if (!nextAuthorized && selectedProjectKey.value === key) {
      detailCheckedKeys.value = [];
      setTreeCheckedKeys([]);
      detailCheckedHistory[key] = [];
    }
    BaseToast.success(nextAuthorized ? "项目已授权" : "项目授权已取消");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    projectLoadingMap[key] = false;
  }
}

async function loadDetailForProject(projectId: PermissionId) {
  if (isProjectOnlyTab.value) {
    detailCheckedHistory[String(projectId)] = [];
    return;
  }
  if (!authorizedProjectMap[String(projectId)]) {
    detailCheckedHistory[String(projectId)] = [];
    return;
  }
  loadingDetail.value = true;
  error.value = null;
  try {
    if (activeTab.value === "3") {
      await loadRevenueTree(projectId);
    } else {
      await loadNormalPermissionTree(projectId);
    }
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    loadingDetail.value = false;
  }
}

async function loadNormalPermissionTree(projectId: PermissionId) {
  if (activeTab.value === "0") {
    const tree = await fetchBudgetGradeTree({
      projectId,
      userId: userId.value,
      type: activeTab.value,
    });
    detailTreeData.value = withAllRoot(toArray(tree));
  } else {
    const tree = await fetchCostCategoryTree();
    detailTreeData.value = withAllRoot(toArray(tree));
  }
  const checked = await fetchProjectDataGrantList({
    projectId,
    userId: userId.value,
    type: activeTab.value,
  });
  const normalizedChecked = toArray(checked);
  detailCheckedKeys.value = [...normalizedChecked];
  detailCheckedHistory[String(projectId)] = [...normalizedChecked];
  await nextTick();
  setTreeCheckedKeys(normalizedChecked);
}

async function loadRevenueTree(projectId: PermissionId) {
  const response = await fetchRevenuePermissionTree({
    userId: userId.value,
    projectId,
  });
  const tree = buildRevenueTree(normalizeRevenueTree(response, null));
  revenueTreeData.value = tree;
  const checked = extractRevenueCheckedKeys(tree);
  detailCheckedKeys.value = checked;
  detailCheckedHistory[String(projectId)] = [...checked];
  await nextTick();
  setTreeCheckedKeys(checked);
}

function handleTreeCheck(
  _node: UserDataPermissionTreeNode | RevenueTreeNode,
  state: { checkedKeys?: PermissionId[] },
) {
  detailCheckedKeys.value = (state.checkedKeys ?? []).filter(
    (key) => String(key) !== "0" && String(key) !== REVENUE_ROOT_ID,
  );
}

async function saveDetailPermission() {
  if (!selectedProjectId.value || saveDisabled.value) return;
  saving.value = true;
  error.value = null;
  try {
    if (activeTab.value === "3") {
      await saveRevenuePermission();
    } else {
      await saveProjectDataGrant({
        projectId: selectedProjectId.value,
        userId: userId.value,
        dataType: activeTab.value,
        gradeId: detailCheckedKeys.value.filter((id) => Number(id) > 0),
      });
    }
    detailCheckedHistory[selectedProjectKey.value] = [
      ...detailCheckedKeys.value,
    ];
    BaseToast.success("数据权限已保存");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    saving.value = false;
  }
}

async function saveRevenuePermission() {
  const currentUser = authStore.currentUser;
  if (!currentUser) {
    BaseToast.warning("当前登录用户信息不完整，请重新登录后再试");
    return;
  }
  await saveRevenueSubjectPermissions({
    userId: userId.value,
    projectId: selectedProjectId.value!,
    grantedById: currentUser.id,
    grantedByName: currentUser.displayName || currentUser.username,
    grantedByPermission: currentUser.permissions[0] ?? "system:auth:income",
    permissions: buildRevenueSubmitPermissions(revenueTreeData.value),
  });
}

function hasPendingChanges() {
  if (!selectedProjectKey.value || isProjectOnlyTab.value) return false;
  const current = normalizeKeyList(detailCheckedKeys.value);
  const history = normalizeKeyList(
    detailCheckedHistory[selectedProjectKey.value],
  );
  return JSON.stringify(current) !== JSON.stringify(history);
}

function normalizeKeyList(keys?: PermissionId[]) {
  return [...(keys ?? [])].map(String).sort();
}

function setTreeCheckedKeys(keys: PermissionId[]) {
  detailTreeRef.value?.setCheckedKeys(keys, false);
}

function filterTreeNode(
  keyword: string,
  data: UserDataPermissionTreeNode | RevenueTreeNode,
) {
  const text = String(
    "subjectName" in data ? data.subjectName : data.name || "",
  ).toLowerCase();
  return !keyword || text.includes(keyword.trim().toLowerCase());
}

function resolveProjectName(project?: UserDataPermissionProject) {
  if (!project) return "--";
  return (
    project.vehicleModel?.modelName ||
    project.projectName ||
    project.wbsNumber ||
    project.projectCode ||
    project.projectNo ||
    String(project.id)
  );
}

function resolveProjectCompany(project: UserDataPermissionProject) {
  return project.vehicleModel?.company || project.company || "";
}

function toggleAllCompanies() {
  companyFilter.value =
    companyFilter.value.length === companyOptions.value.length
      ? []
      : [...companyOptions.value];
}

function toggleCompany(company: string) {
  companyFilter.value = companyFilter.value.includes(company)
    ? companyFilter.value.filter((item) => item !== company)
    : [...companyFilter.value, company];
}

function withAllRoot(nodes: UserDataPermissionTreeNode[]) {
  return [{ id: "0", name: "全部", parentCode: "-99", children: nodes }];
}

function toArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeRevenueTree(
  nodes: RevenuePermissionNode[],
  parentId: PermissionId | null,
): RevenueTreeNode[] {
  return nodes.map((node) => {
    const id = node.id ?? node.subjectId;
    const children = normalizeRevenueTree(toArray(node.children), id);
    return {
      ...node,
      id,
      parentId: node.parentId ?? parentId,
      subjectName: node.subjectName || node.name || "",
      directPermissionConfigured: Boolean(node.directPermissionConfigured),
      directPermissionLevel: normalizePermissionValue(
        node.directPermissionLevel || node.permissionLevel,
      ),
      directGrantScope: normalizeGrantScope(
        node.directGrantScope ||
          node.grantScope ||
          node.permissionScope ||
          node.scope,
      ),
      directRemark: node.directRemark ?? null,
      effectivePermissionLevel: normalizePermissionValue(
        node.effectivePermissionLevel || node.permissionLevel,
      ),
      permissionLevel: normalizePermissionValue(node.permissionLevel),
      children,
    };
  });
}

function buildRevenueTree(children: RevenueTreeNode[]): RevenueTreeNode[] {
  return [
    {
      id: REVENUE_ROOT_ID,
      parentId: null,
      subjectName: "全部",
      isVirtualRoot: true,
      children,
    },
  ];
}

function normalizePermissionValue(level?: string | null) {
  const value = String(level || "")
    .trim()
    .toUpperCase();
  return value && value !== "NONE" ? value : null;
}

function normalizeGrantScope(scope?: string | null) {
  const value = String(scope || "")
    .trim()
    .toUpperCase();
  return value || null;
}

function hasRevenuePermission(node: RevenueTreeNode) {
  return Boolean(
    node.effectivePermissionLevel ||
    node.permissionLevel ||
    (node.directPermissionConfigured && node.directPermissionLevel),
  );
}

function extractRevenueCheckedKeys(nodes: RevenueTreeNode[]) {
  const keys = new Set<PermissionId>();
  const addSubtree = (node: RevenueTreeNode) => {
    if (!node.isVirtualRoot) keys.add(node.id);
    node.children?.forEach(addSubtree);
  };
  const walk = (items: RevenueTreeNode[]) => {
    items.forEach((node) => {
      if (hasRevenuePermission(node)) {
        if (node.directGrantScope === "SUBTREE") {
          addSubtree(node);
        } else if (!node.isVirtualRoot) {
          keys.add(node.id);
        }
      }
      walk(node.children ?? []);
    });
  };
  walk(nodes);
  return Array.from(keys);
}

function buildRevenueSubmitPermissions(
  nodes: RevenueTreeNode[],
): RevenueSubjectPermission[] {
  const checked = new Set(detailCheckedKeys.value.map(String));
  const permissions: RevenueSubjectPermission[] = [];
  const walk = (items: RevenueTreeNode[]) => {
    items.forEach((node) => {
      if (!node.isVirtualRoot && checked.has(String(node.id))) {
        permissions.push({
          subjectId: node.id,
          permissionLevel: WRITE_PERMISSION_LEVEL,
          grantScope: GRANT_SCOPE_SELF,
          ...(node.directRemark ? { remark: node.directRemark } : {}),
        });
      }
      walk(node.children ?? []);
    });
  };
  walk(nodes);
  return permissions;
}

function clearRecord(record: Record<string, unknown>) {
  Object.keys(record).forEach((key) => {
    delete record[key];
  });
}

function goBack() {
  router.push("/system/user");
}

function normalizeError(unknownError: unknown) {
  if (unknownError instanceof ApiBusinessError) {
    return {
      code: unknownError.code,
      message: unknownError.message,
      traceId: unknownError.traceId,
    };
  }
  return {
    code: "FRONTEND-SYSTEM-USER-PERMISSION",
    message: "用户数据权限加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    class="system-user-data-permission-page"
    title="用户数据权限"
    description="按用户、项目和业务类型配置数据访问范围。"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        :icon="Back"
        @click="goBack"
      >
        返回
      </PermissionButton>
      <PermissionButton
        permission="system:project:save"
        type="primary"
        :loading="saving"
        :disabled="saveDisabled"
        data-test="user-data-permission-save"
        @click="saveDetailPermission"
      >
        保存
      </PermissionButton>
    </template>

    <TraceErrorAlert
      v-if="error"
      :code="error.code"
      :message="error.message"
      :trace-id="error.traceId"
    />

    <section class="system-user-data-permission-page__header">
      <div class="system-user-data-permission-page__user">
        <span>用户昵称：{{ displayName || "--" }}</span>
        <span>登录账号：{{ username || "--" }}</span>
      </div>
    </section>

    <section class="system-user-data-permission-page__workspace">
      <aside class="system-user-data-permission-page__company">
        <button
          type="button"
          class="system-user-data-permission-page__company-item"
          :class="{
            'is-active': companyFilter.length === companyOptions.length,
          }"
          @click="toggleAllCompanies"
        >
          <el-icon><Grid /></el-icon>
          <span>全部</span>
        </button>
        <button
          v-for="company in companyOptions"
          :key="company"
          type="button"
          class="system-user-data-permission-page__company-item"
          :class="{ 'is-active': companyFilter.includes(company) }"
          @click="toggleCompany(company)"
        >
          <el-icon v-if="companyFilter.includes(company)"><Check /></el-icon>
          <span v-else class="system-user-data-permission-page__check-space" />
          <span>{{ company }}</span>
        </button>
      </aside>

      <aside class="system-user-data-permission-page__projects">
        <el-tabs v-model="activeTab">
          <el-tab-pane
            v-for="tab in visibleTabs"
            :key="tab.value"
            :label="tab.label"
            :name="tab.value"
          />
        </el-tabs>
        <el-input
          v-model="projectKeyword"
          clearable
          :prefix-icon="Search"
          placeholder="请输入项目代号"
        />
        <div
          v-loading="loadingProjects"
          class="system-user-data-permission-page__project-list"
        >
          <button
            v-for="project in filteredProjects"
            :key="String(project.id)"
            type="button"
            class="system-user-data-permission-page__project"
            :class="{
              'is-active': selectedProjectKey === String(project.id),
            }"
            @click="selectProject(project)"
          >
            <el-checkbox
              :model-value="selectedProjectKey === String(project.id)"
            />
            <span class="system-user-data-permission-page__project-name">
              {{ resolveProjectName(project) }}
            </span>
            <span class="system-user-data-permission-page__project-action">
              <el-icon v-if="projectLoadingMap[String(project.id)]">
                <Loading />
              </el-icon>
              <span
                v-else
                :class="{
                  'is-revoke': authorizedProjectMap[String(project.id)],
                }"
                @click.stop="toggleProjectGrant(project)"
              >
                {{
                  authorizedProjectMap[String(project.id)] ? "取消授权" : "授权"
                }}
              </span>
            </span>
          </button>
          <el-empty
            v-if="!loadingProjects && filteredProjects.length === 0"
            description="暂无项目"
          />
        </div>
      </aside>

      <main class="system-user-data-permission-page__detail">
        <div class="system-user-data-permission-page__detail-title">
          <strong>{{ detailPanelTitle }}</strong>
          <span>{{ resolveProjectName(selectedProject) }}</span>
        </div>

        <div
          v-if="!selectedProjectKey"
          class="system-user-data-permission-page__empty"
        >
          <el-empty description="请先选择项目" />
        </div>
        <div
          v-else-if="!selectedProjectAuthorized"
          class="system-user-data-permission-page__empty"
        >
          <el-empty description="请先授权项目，再配置明细权限" />
        </div>
        <div
          v-else-if="isProjectOnlyTab"
          class="system-user-data-permission-page__empty"
        >
          <el-empty
            :description="
              activeTab === '4'
                ? '产品委员会授权按项目级生效，无需配置明细树'
                : '成本数据授权按项目级授权生效，无需配置明细树'
            "
          />
        </div>
        <template v-else>
          <el-input
            v-model="detailKeyword"
            clearable
            :prefix-icon="Search"
            placeholder="输入关键字过滤"
          />
          <div
            v-loading="loadingDetail"
            class="system-user-data-permission-page__tree"
          >
            <el-tree
              ref="detailTreeRef"
              :data="isRevenueTab ? revenueTreeData : detailTreeData"
              show-checkbox
              node-key="id"
              :props="{
                children: 'children',
                label: isRevenueTab ? 'subjectName' : 'name',
              }"
              :expand-on-click-node="false"
              :filter-node-method="filterTreeNode"
              :default-expanded-keys="isRevenueTab ? [REVENUE_ROOT_ID] : ['0']"
              @check="handleTreeCheck"
            />
          </div>
        </template>
      </main>
    </section>

    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<style scoped>
.system-user-data-permission-page {
  min-width: 0;
}

.system-user-data-permission-page__header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.system-user-data-permission-page__user {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.system-user-data-permission-page__workspace {
  height: calc(100vh - 194px);
  min-height: 480px;
  display: grid;
  grid-template-columns: 220px 430px minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
}

.system-user-data-permission-page__company,
.system-user-data-permission-page__projects,
.system-user-data-permission-page__detail {
  min-height: 0;
  border: 1px solid var(--bq-color-border);
  background: var(--bq-color-surface);
}

.system-user-data-permission-page__company {
  overflow: auto;
  padding: 12px;
}

.system-user-data-permission-page__company-item {
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--bq-color-text-secondary);
  cursor: pointer;
  text-align: left;
}

.system-user-data-permission-page__company-item.is-active {
  color: var(--bq-color-primary);
  font-weight: 600;
}

.system-user-data-permission-page__check-space {
  width: 1em;
}

.system-user-data-permission-page__projects {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 14px 14px;
  overflow: hidden;
}

.system-user-data-permission-page__project-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.system-user-data-permission-page__project {
  width: 100%;
  min-width: 0;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--bq-color-text-secondary);
  cursor: pointer;
  text-align: left;
}

.system-user-data-permission-page__project.is-active {
  color: var(--bq-color-primary);
  background: var(--bq-color-card-selected);
  font-weight: 600;
}

.system-user-data-permission-page__project-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-user-data-permission-page__project-action {
  width: 72px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.system-user-data-permission-page__project-action span {
  width: 64px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--bq-color-primary);
  background: var(--bq-color-primary-soft);
  font-size: 12px;
  font-weight: 400;
}

.system-user-data-permission-page__project-action span.is-revoke {
  color: var(--bq-color-warning);
  background: var(--bq-color-warning-soft);
}

.system-user-data-permission-page__detail {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

.system-user-data-permission-page__detail-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--bq-color-text);
}

.system-user-data-permission-page__detail-title span {
  min-width: 0;
  color: var(--bq-color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-user-data-permission-page__tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.system-user-data-permission-page__empty {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1200px) {
  .system-user-data-permission-page__workspace {
    grid-template-columns: 180px 360px minmax(0, 1fr);
  }
}
</style>
