<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue";
import { useRouter } from "vue-router";
import { CirclePlus, Download } from "@element-plus/icons-vue";
import {
  createPlatformRole,
  deletePlatformRole,
  disablePlatformRole,
  enablePlatformRole,
  exportPlatformRoles,
  fetchPlatformDepts,
  fetchPlatformRoleDetail,
  fetchPlatformRoleMenuTree,
  fetchPlatformRoleAuthorization,
  fetchPlatformRolePermissionDiff,
  fetchPlatformRolePermissionImpact,
  fetchPlatformRolesPage,
  grantRoleDataScope,
  grantRoleMenus,
  updatePlatformRole,
} from "@/api/platform-system";
import { ApiBusinessError } from "@/api/http";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import { BaseToast } from "@/components/base/BaseToast";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import {
  buildRoleGrantTree as buildGrantTree,
  collapseRoleGrantTree as collapseGrantTree,
  flattenRoleGrantTree as flattenGrantTree,
  observeRoleGrantTriggerLayout,
  resolveEffectiveRoleGrantKeys as resolveEffectiveGrantKeys,
  resolveRoleGrantPopperHeight,
  resolveRoleGrantPopperTop,
  scheduleRoleGrantPopperLayoutUpdate,
  toRoleMenuGrantKey as toMenuGrantKey,
  toRolePermissionGrantKey as toPermissionGrantKey,
  type RoleGrantTreeNode as GrantTreeNode,
} from "@/pages/system/role-grant-tree";
import { toDateTimeRangeParams } from "@/utils/date-range";
import { resolvePageTotal } from "@/utils/pagination";
import type {
  PlatformDataScope,
  PlatformDeptItem,
  PlatformMenuItem,
  PlatformPermissionItem,
  PlatformRoleAuthorizationDetail,
  PlatformRoleItem,
  PlatformRoleMenuTreeNode,
  PlatformRolePermissionDiffResponse,
  PlatformRolePermissionImpactResponse,
  PlatformRoleQuery,
  PlatformStatus,
} from "@/types/platform-system";

interface RoleFormState {
  id?: number;
  roleCode: string;
  roleName: string;
  dataScope: PlatformDataScope;
  status: PlatformStatus;
  sortNo: number | string | undefined;
  menuCheckStrictly: boolean;
}

interface RoleQueryState {
  roleCode: string;
  roleName: string;
  status: PlatformStatus | "";
  createdAtRange: [string, string] | [] | null;
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type RoleMenuTreeExpose = {
  getCheckedKeys: (leafOnly?: boolean) => Array<string | number>;
  getHalfCheckedKeys: () => Array<string | number>;
  getNode: (key: string | number) => { expanded: boolean } | undefined;
  setChecked: (key: string | number, checked: boolean, deep?: boolean) => void;
  setCheckedKeys: (keys: Array<string | number>) => void;
  setCheckedNodes: (nodes: PlatformRoleMenuTreeNode[]) => void;
};

type RoleGrantTreeSelectExpose = {
  $el?: HTMLElement;
  getNode: (key: string | number) => { expanded: boolean } | null | undefined;
};

const DEFAULT_MENU_PARENT_CHILD_LINKED = true;

const emptyRoleForm = (): RoleFormState => ({
  roleCode: "",
  roleName: "",
  dataScope: "SELF_DEPT",
  status: "ENABLED",
  sortNo: 0,
  menuCheckStrictly: DEFAULT_MENU_PARENT_CHILD_LINKED,
});

const query = reactive<RoleQueryState>({
  roleCode: "",
  roleName: "",
  status: "",
  createdAtRange: [],
});

const roles = ref<PlatformRoleItem[]>([]);
const saving = ref(false);
const exporting = ref(false);
const grantSaving = ref(false);
const grantLoading = ref(false);
const formDialogVisible = ref(false);
const formDialogMode = ref<"create" | "edit">("create");
const permissionDrawerVisible = ref(false);
const dataScopeDrawerVisible = ref(false);
const permissionPreviewDrawerVisible = ref(false);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const depts = ref<PlatformDeptItem[]>([]);
const menus = ref<PlatformMenuItem[]>([]);
const permissions = ref<PlatformPermissionItem[]>([]);
const authorization = ref<PlatformRoleAuthorizationDetail | null>(null);
const currentGrantRole = ref<PlatformRoleItem | null>(null);
const selectedDeptIds = ref<number[]>([]);
const formDeptIds = ref<number[]>([]);
const formMenuOptions = ref<PlatformRoleMenuTreeNode[]>([]);
const formMenuTreeRef = ref<RoleMenuTreeExpose | null>(null);
const grantTreeSelectRef = ref<RoleGrantTreeSelectExpose | null>(null);
const formMenuExpand = ref(false);
const formMenuNodeAll = ref(false);
const selectedGrantKeys = ref<string[]>([]);
const grantTreeDropdownVisible = ref(false);
const grantTreePopperHeight = ref(480);
let grantTreeResizeSequence = 0;
let grantTreeTriggerObserver: Pick<
  ResizeObserver,
  "observe" | "disconnect"
> | null = null;
const selectedDataScope = ref<PlatformDataScope>("SELF_DEPT");
const permissionDiff = ref<PlatformRolePermissionDiffResponse | null>(null);
const permissionImpact = ref<PlatformRolePermissionImpactResponse | null>(null);
const form = reactive<RoleFormState>(emptyRoleForm());
const queryTableRef = ref<QueryTableExpose | null>(null);
const router = useRouter();
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const editing = computed(() => formDialogMode.value === "edit");
const formDialogTitle = computed(() =>
  editing.value ? "编辑角色" : "新增角色",
);
const permissionDrawerTitle = computed(() =>
  currentGrantRole.value
    ? `菜单与按钮授权：${currentGrantRole.value.roleName}`
    : "权限授权",
);
const dataScopeDrawerTitle = computed(() =>
  currentGrantRole.value
    ? `数据范围授权：${currentGrantRole.value.roleName}`
    : "数据范围授权",
);
const permissionPreviewTitle = computed(() =>
  currentGrantRole.value
    ? `权限变更预览：${currentGrantRole.value.roleName}`
    : "权限变更预览",
);

const selectedRoles = ref<PlatformRoleItem[]>([]);

const grantTreeData = computed(() =>
  buildGrantTree(menus.value, permissions.value),
);
const grantTreePopperStyle = computed(() => ({
  height: `${grantTreePopperHeight.value}px`,
  maxHeight: `${grantTreePopperHeight.value}px`,
}));
const effectiveSelectedGrantKeys = computed(() =>
  resolveEffectiveGrantKeys(selectedGrantKeys.value, grantTreeData.value),
);
const selectedMenuCodes = computed(() => {
  const keys = new Set(effectiveSelectedGrantKeys.value);
  return flattenGrantTree(grantTreeData.value)
    .filter((node) => node.menuCode && keys.has(node.value))
    .map((node) => node.menuCode!);
});
const selectedPermissionCodes = computed(() =>
  resolveSelectedPermissionCodes(),
);
const selectedDeptTags = computed(() => {
  const selectedKeys = new Set(selectedDeptIds.value.map(String));

  function isSubtreeSelected(item: PlatformDeptItem): boolean {
    const children = item.children ?? [];
    return (
      selectedKeys.has(String(item.id)) ||
      (children.length > 0 && children.every(isSubtreeSelected))
    );
  }

  function collect(items: PlatformDeptItem[]): PlatformDeptItem[] {
    return items.flatMap((item) => {
      const children = item.children ?? [];
      const childTags = collect(children);
      if (!isSubtreeSelected(item)) {
        return childTags;
      }
      return [item, ...childTags];
    });
  }

  return collect(depts.value);
});

async function queryRoles(pageSize: number, pageNo: number) {
  error.value = null;
  try {
    const response = await fetchPlatformRolesPage(
      buildRoleQueryParams(pageSize, pageNo),
    );
    roles.value = response.records;
    return {
      total: resolvePageTotal(response, pageNo, pageSize),
      list: response.records,
      pageNo: response.pageNo,
      pageSize: response.pageSize,
    };
  } catch (unknownError) {
    const normalizedError = normalizeError(unknownError);
    error.value = normalizedError;
    throw new Error(normalizedError.message, { cause: unknownError });
  }
}

async function reloadRoles() {
  await queryTableRef.value?.reload();
}

function searchRoles() {
  queryTableRef.value?.search();
}

function handleReset() {
  query.roleCode = "";
  query.roleName = "";
  query.status = "";
  query.createdAtRange = [];
}

function handleSelectionChange(selection: PlatformRoleItem[]) {
  selectedRoles.value = selection;
}

async function openCreateDialog() {
  formDialogMode.value = "create";
  delete form.id;
  Object.assign(form, emptyRoleForm());
  formDeptIds.value = [];
  resetRoleFormMenuState();
  formDialogVisible.value = true;
  await Promise.all([ensureDeptOptionsLoaded(), loadRoleFormMenuTree()]);
}

async function openEditDialog(role: PlatformRoleItem) {
  error.value = null;
  const detail = await fetchPlatformRoleDetail(role.id).catch(
    (unknownError) => {
      error.value = normalizeError(unknownError);
      return null;
    },
  );
  if (!detail) {
    return;
  }
  formDialogMode.value = "edit";
  Object.assign(form, {
    id: detail.id,
    roleCode: detail.roleCode,
    roleName: detail.roleName,
    dataScope: detail.dataScope,
    status: detail.status,
    sortNo: detail.sortNo ?? 0,
    menuCheckStrictly: DEFAULT_MENU_PARENT_CHILD_LINKED,
  });
  formDeptIds.value = [];
  resetRoleFormMenuState();
  formDialogVisible.value = true;
  await Promise.all([
    loadRoleDeptScope(detail),
    loadRoleFormMenuTree(detail.id),
  ]);
}

function resetRoleFormMenuState() {
  formMenuExpand.value = false;
  formMenuNodeAll.value = false;
  formMenuOptions.value = [];
  formMenuTreeRef.value?.setCheckedKeys([]);
}

async function loadRoleFormMenuTree(roleId?: number) {
  try {
    const response = await fetchPlatformRoleMenuTree(roleId);
    formMenuOptions.value = response.menus ?? [];
    await nextTick();
    formMenuTreeRef.value?.setCheckedKeys([]);
    response.checkedKeys?.forEach((key) => {
      formMenuTreeRef.value?.setChecked(key, true, false);
    });
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

function toggleRoleFormMenuExpand(value: boolean | string | number) {
  const expanded = Boolean(value);
  const visit = (items: PlatformRoleMenuTreeNode[]) => {
    items.forEach((item) => {
      const node = formMenuTreeRef.value?.getNode(item.id);
      if (node) node.expanded = expanded;
      visit(item.children ?? []);
    });
  };
  visit(formMenuOptions.value);
}

function toggleRoleFormMenuAll(value: boolean | string | number) {
  const checked = Boolean(value);
  formMenuTreeRef.value?.setCheckedNodes(checked ? formMenuOptions.value : []);
}

function getRoleFormMenuIds(): number[] {
  const checkedKeys = formMenuTreeRef.value?.getCheckedKeys(false) ?? [];
  const halfCheckedKeys = formMenuTreeRef.value?.getHalfCheckedKeys() ?? [];
  return Array.from(
    new Set([...checkedKeys, ...halfCheckedKeys].map(Number)),
  ).filter(Number.isFinite);
}

async function saveRole() {
  saving.value = true;
  error.value = null;
  try {
    let savedRole: PlatformRoleItem;
    const menuIds = getRoleFormMenuIds();
    if (editing.value && form.id) {
      savedRole = await updatePlatformRole(form.id, {
        roleName: form.roleName,
        dataScope: form.dataScope,
        status: form.status,
        sortNo: toOptionalNumber(form.sortNo),
        menuIds,
        menuCheckStrictly: form.menuCheckStrictly,
      });
      await saveRoleFormDataScope(savedRole.id);
      BaseToast.success("角色已编辑");
    } else {
      savedRole = await createPlatformRole({
        roleCode: form.roleCode.trim(),
        roleName: form.roleName.trim(),
        dataScope: form.dataScope,
        status: form.status,
        sortNo: toOptionalNumber(form.sortNo),
        menuIds,
        menuCheckStrictly: form.menuCheckStrictly,
      });
      if (form.dataScope === "CUSTOM_DEPT") {
        await saveRoleFormDataScope(savedRole.id);
      }
      BaseToast.success("角色已新增");
    }
    formDialogVisible.value = false;
    await reloadRoles();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    saving.value = false;
  }
}

async function ensureDeptOptionsLoaded() {
  if (depts.value.length > 0) {
    return;
  }
  try {
    depts.value = await fetchPlatformDepts();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

async function loadRoleDeptScope(role: PlatformRoleItem) {
  try {
    const [deptList, roleAuthorization] = await Promise.all([
      fetchPlatformDepts(),
      fetchPlatformRoleAuthorization(role.id),
    ]);
    depts.value = deptList;
    formDeptIds.value = expandDeptIdsWithChildren(
      roleAuthorization.customDeptIds,
      deptList,
    );
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

async function saveRoleFormDataScope(roleId: number) {
  await grantRoleDataScope(roleId, {
    dataScope: form.dataScope,
    deptIds:
      form.dataScope === "CUSTOM_DEPT"
        ? expandDeptIdsWithChildren(formDeptIds.value, depts.value)
        : [],
  });
}

function expandDeptIdsWithChildren(
  deptIds: Array<number | string>,
  deptTree: PlatformDeptItem[],
) {
  const selectedKeys = new Set(deptIds.map((id) => String(id)));
  const expandedIds = new Set<number>();

  function collect(items: PlatformDeptItem[]) {
    items.forEach((item) => {
      if (selectedKeys.has(String(item.id))) {
        collectDeptSubtreeIds(item, expandedIds);
      } else if (item.children?.length) {
        collect(item.children);
      }
    });
  }

  collect(deptTree);

  deptIds.forEach((id) => {
    const numericId = Number(id);
    if (Number.isFinite(numericId)) {
      expandedIds.add(numericId);
    }
  });

  return Array.from(expandedIds);
}

function collectDeptSubtreeIds(item: PlatformDeptItem, collector: Set<number>) {
  const numericId = Number(item.id);
  if (Number.isFinite(numericId)) {
    collector.add(numericId);
  }
  item.children?.forEach((child) => collectDeptSubtreeIds(child, collector));
}

function removeSelectedDeptTag(dept: PlatformDeptItem) {
  const removedIds = new Set<number>();
  collectDeptSubtreeIds(dept, removedIds);
  selectedDeptIds.value = selectedDeptIds.value.filter(
    (id) => !removedIds.has(Number(id)),
  );
}

function buildRoleQueryParams(
  pageSize: number,
  pageNo: number,
): PlatformRoleQuery {
  const dateRange = toDateTimeRangeParams(query.createdAtRange);
  // const keyword = [query.roleCode, query.roleName]
  //   .map((item) => item.trim())
  //   .find(Boolean);
  return {
    pageNo,
    pageSize,
    // keyword,
    roleCode: query.roleCode.trim() || undefined,
    roleName: query.roleName.trim() || undefined,
    status: query.status || undefined,
    ...dateRange,
  };
}

function toOptionalNumber(
  value: number | string | undefined,
): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  return Number(value);
}

async function toggleRoleStatus(role: PlatformRoleItem) {
  error.value = null;
  try {
    if (role.status === "ENABLED") {
      await disablePlatformRole(role.id);
      BaseToast.success("角色已停用");
    } else {
      await enablePlatformRole(role.id);
      BaseToast.success("角色已启用");
    }
    await reloadRoles();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

async function exportRoles() {
  exporting.value = true;
  error.value = null;
  try {
    const blob = await exportPlatformRoles(buildRoleQueryParams(5000, 1));
    downloadBlob(blob, "角色数据.xlsx");
    BaseToast.success("角色导出已开始下载");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    exporting.value = false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function openRoleAuthUserPage(role: PlatformRoleItem) {
  void router.push({
    name: "systemRoleAuthUser",
    params: { roleId: String(role.id) },
    query: { roleName: role.roleName },
  });
}

async function deleteRole(role: PlatformRoleItem) {
  try {
    await openConfirm({
      title: "删除角色",
      message: `确认删除角色「${role.roleName}」？删除后角色列表不再展示该记录，并会清理用户、菜单、权限和数据范围关联关系。`,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformRole(role.id);
    BaseToast.success("角色已删除");
    await reloadRoles();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

async function handleGrantTreeVisibleChange(visible: boolean) {
  grantTreeDropdownVisible.value = visible;
  if (!visible) {
    stopGrantTreeTriggerObserver();
    return;
  }
  await nextTick();
  startGrantTreeTriggerObserver();
  updateGrantTreePopperHeight();
  collapseGrantTree(grantTreeData.value, grantTreeSelectRef.value);
}

function startGrantTreeTriggerObserver() {
  stopGrantTreeTriggerObserver();
  const trigger = grantTreeSelectRef.value?.$el;
  if (!trigger || typeof ResizeObserver === "undefined") return;
  grantTreeTriggerObserver = observeRoleGrantTriggerLayout(trigger, () => {
    if (grantTreeDropdownVisible.value) updateGrantTreePopperHeight();
  });
}

function stopGrantTreeTriggerObserver() {
  grantTreeTriggerObserver?.disconnect();
  grantTreeTriggerObserver = null;
}

function updateGrantTreePopperHeight() {
  const triggerBottom =
    grantTreeSelectRef.value?.$el?.getBoundingClientRect().bottom ?? 168;
  const popperTop = resolveRoleGrantPopperTop(triggerBottom);
  grantTreePopperHeight.value = resolveRoleGrantPopperHeight(
    window.innerHeight,
    popperTop,
  );
}

function handleGrantTreeViewportResize() {
  if (!grantTreeDropdownVisible.value) return;
  const resizeSequence = ++grantTreeResizeSequence;
  scheduleRoleGrantPopperLayoutUpdate(() => {
    if (resizeSequence !== grantTreeResizeSequence) return;
    updateGrantTreePopperHeight();
  });
}

onMounted(() =>
  window.addEventListener("resize", handleGrantTreeViewportResize),
);
onBeforeUnmount(() => {
  window.removeEventListener("resize", handleGrantTreeViewportResize);
  grantTreeResizeSequence += 1;
  stopGrantTreeTriggerObserver();
});

async function openDataScopeDrawer(role: PlatformRoleItem) {
  currentGrantRole.value = role;
  dataScopeDrawerVisible.value = true;
  grantLoading.value = true;
  error.value = null;
  try {
    const [deptList, roleAuthorization] = await Promise.all([
      fetchPlatformDepts({ status: "ENABLED" }),
      fetchPlatformRoleAuthorization(role.id),
    ]);
    depts.value = deptList;
    authorization.value = roleAuthorization;
    selectedDataScope.value = roleAuthorization.dataScope;
    selectedDeptIds.value =
      roleAuthorization.dataScope === "CUSTOM_DEPT"
        ? expandDeptIdsWithChildren(roleAuthorization.customDeptIds, deptList)
        : [];
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    grantLoading.value = false;
  }
}

function handleDataScopeChange(scope: PlatformDataScope) {
  if (scope !== "CUSTOM_DEPT") {
    selectedDeptIds.value = [];
  }
}

async function saveRolePermissions() {
  if (!currentGrantRole.value) return;
  grantSaving.value = true;
  error.value = null;
  try {
    await grantRoleMenus(currentGrantRole.value.id, selectedMenuCodes.value);
    authorization.value = await fetchPlatformRoleAuthorization(
      currentGrantRole.value.id,
    );
    selectedGrantKeys.value = resolveEffectiveGrantKeys(
      buildSelectedGrantKeys(authorization.value),
      grantTreeData.value,
    );
    permissionDrawerVisible.value = false;
    BaseToast.success("权限已保存");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    grantSaving.value = false;
  }
}

async function previewRolePermissionImpact() {
  if (!currentGrantRole.value) return;
  grantLoading.value = true;
  error.value = null;
  try {
    const [diff, impact] = await Promise.all([
      fetchPlatformRolePermissionDiff(
        currentGrantRole.value.id,
        selectedPermissionCodes.value,
      ),
      fetchPlatformRolePermissionImpact(
        currentGrantRole.value.id,
        selectedPermissionCodes.value,
      ),
    ]);
    permissionDiff.value = diff;
    permissionImpact.value = impact;
    permissionPreviewDrawerVisible.value = true;
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    grantLoading.value = false;
  }
}

async function saveRoleDataScope() {
  if (!currentGrantRole.value) return;
  grantSaving.value = true;
  error.value = null;
  try {
    await grantRoleDataScope(currentGrantRole.value.id, {
      dataScope: selectedDataScope.value,
      deptIds:
        selectedDataScope.value === "CUSTOM_DEPT"
          ? selectedDeptTags.value
              .map((dept) => Number(dept.id))
              .filter(Number.isFinite)
          : [],
    });
    authorization.value = await fetchPlatformRoleAuthorization(
      currentGrantRole.value.id,
    );
    selectedDataScope.value = authorization.value.dataScope;
    selectedDeptIds.value = expandDeptIdsWithChildren(
      authorization.value.customDeptIds,
      depts.value,
    );
    dataScopeDrawerVisible.value = false;
    BaseToast.success("数据范围已保存");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    grantSaving.value = false;
  }
}

function buildSelectedGrantKeys(
  roleAuthorization: PlatformRoleAuthorizationDetail,
) {
  return [
    ...roleAuthorization.menuCodes.map(toMenuGrantKey),
    ...roleAuthorization.permissionCodes.map(toPermissionGrantKey),
  ];
}

function handleGrantTreeCheck(
  node: GrantTreeNode,
  checkedState: { checkedKeys?: Array<string | number> },
) {
  if (!node.children?.length) {
    return;
  }

  const nextKeys = new Set(
    (checkedState.checkedKeys ?? selectedGrantKeys.value).map(String),
  );
  const descendantKeys = flattenGrantTree(node.children).map(
    (child) => child.value,
  );

  if (nextKeys.has(node.value)) {
    descendantKeys.forEach((key) => nextKeys.add(key));
  } else {
    descendantKeys.forEach((key) => nextKeys.delete(key));
  }

  selectedGrantKeys.value = Array.from(nextKeys);
}

function resolveSelectedPermissionCodes() {
  const keys = new Set(effectiveSelectedGrantKeys.value);
  return Array.from(
    new Set(
      flattenGrantTree(grantTreeData.value)
        .filter(
          (node) =>
            node.permissionCode &&
            (keys.has(node.value) ||
              (node.menuCode && keys.has(toMenuGrantKey(node.menuCode)))),
        )
        .map((node) => node.permissionCode!),
    ),
  );
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
    code: "FRONTEND-SYSTEM-002",
    message: "系统管理角色列表加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    class="system-role-page"
    title="角色管理"
    description="管理系统角色、权限点、菜单和数据范围。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryRoles"
      row-key="id"
      fit-table-height
      empty-title="暂无匹配角色"
      empty-description="当前筛选条件下没有可展示的角色数据。"
      @reset="handleReset"
      @selection-change="handleSelectionChange"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="角色名称">
            <el-input
              v-model="query.roleName"
              clearable
              maxlength="128"
              placeholder="请输入角色名称"
              data-test="role-search-role-name"
              @keyup.enter="searchRoles"
            />
          </el-form-item>
          <el-form-item label="权限字符">
            <el-input
              v-model="query.roleCode"
              clearable
              maxlength="128"
              placeholder="请输入权限字符"
              data-test="role-search-role-code"
              @keyup.enter="searchRoles"
            />
          </el-form-item>
          <el-form-item label="角色状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="角色状态"
              data-test="role-search-status"
            >
              <el-option label="启用" value="ENABLED" />
              <el-option label="停用" value="DISABLED" />
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdAtRange"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #toolbar>
        <PermissionButton
          permission="system:role:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          data-test="create-role-button"
          @click="openCreateDialog"
        >
          新增
        </PermissionButton>
        <PermissionButton
          permission="system:role:export"
          variant="secondary"
          :icon="Download"
          :loading="exporting"
          plain
          type="warning"
          @click="exportRoles"
        >
          导出
        </PermissionButton>
      </template>
      <el-table-column type="selection"  />
      <el-table-column label="序号" type="index"  />
      <el-table-column prop="roleName" label="角色名称" />
      <el-table-column prop="roleCode" label="权限字符"  />
      <el-table-column prop="sortNo" label="显示顺序"  />
      <el-table-column label="角色状态" >
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 'ENABLED'"
            @change="toggleRoleStatus(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" >
        <template #default="{ row }">
          <BaseDateTime :value="row.createdAt || null" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="system:role:edit"
            link
            :data-test="`edit-role-${row.id}`"
            @click="openEditDialog(row)"
          >
            编辑
          </PermissionButton>
          <PermissionButton
            permission="system:role:assign-user"
            link
            :data-test="`assign-role-users-${row.id}`"
            @click="openRoleAuthUserPage(row)"
          >
            分配用户
          </PermissionButton>
          <PermissionButton
            permission="system:role:grant-data-scope"
            link
            :data-test="`grant-role-data-scope-${row.id}`"
            @click="openDataScopeDrawer(row)"
          >
            数据权限
          </PermissionButton>
          <PermissionButton
            permission="system:role:remove"
            link
            :data-test="`delete-role-${row.id}`"
            @click="deleteRole(row)"
          >
            删除
          </PermissionButton>
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="formDialogVisible"
      :title="formDialogTitle"
      width="860px"
      :loading="saving"
      confirm-text="确定"
      compact
      :confirm-button-props="{ 'data-test': 'role-save-button' }"
      @confirm="saveRole"
    >
      <el-form
        :model="form"
        class="system-role-page__form"
        label-position="top"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="角色名称" required>
              <el-input
                v-model="form.roleName"
                maxlength="128"
                placeholder="请输入角色名称"
                data-test="role-name-input"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="权限字符" required>
              <el-input
                v-model="form.roleCode"
                :disabled="editing"
                maxlength="128"
                placeholder="请输入权限字符"
                data-test="role-code-input"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="显示顺序">
              <el-input
                v-model="form.sortNo"
                placeholder="请输入显示顺序"
                data-test="role-sort-input"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色状态" required>
              <el-radio-group
                v-model="form.status"
                data-test="role-status-input"
              >
                <el-radio value="ENABLED">启用</el-radio>
                <el-radio value="DISABLED">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="菜单权限">
              <div class="system-role-page__menu-permission">
                <div class="system-role-page__menu-controls">
                  <el-checkbox
                    v-model="formMenuExpand"
                    @change="toggleRoleFormMenuExpand"
                  >
                    展开/折叠
                  </el-checkbox>
                  <el-checkbox
                    v-model="formMenuNodeAll"
                    @change="toggleRoleFormMenuAll"
                  >
                    全选/全不选
                  </el-checkbox>
                  <el-checkbox v-model="form.menuCheckStrictly">
                    父子联动
                  </el-checkbox>
                </div>
                <el-tree
                  ref="formMenuTreeRef"
                  class="system-role-page__menu-tree"
                  :data="formMenuOptions"
                  show-checkbox
                  node-key="id"
                  check-on-click-node
                  :check-strictly="!form.menuCheckStrictly"
                  :props="{ label: 'label', children: 'children' }"
                  empty-text="加载中，请稍候"
                  data-test="role-form-menu-tree"
                />
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseDrawer
      v-model="permissionDrawerVisible"
      :title="permissionDrawerTitle"
      size="min(520px, 100vw)"
    >
      <TraceErrorAlert
        v-if="error"
        :code="error.code"
        :message="error.message"
        :trace-id="error.traceId"
      />
      <el-skeleton v-if="grantLoading" :rows="6" animated />
      <div v-else class="system-role-page__drawer-body">
        <div v-if="authorization" class="system-role-page__summary">
          <span>角色编码：{{ authorization.roleCode }}</span>
          <span>已授权菜单：{{ authorization.menuCodes.length }} 项</span>
          <span>已授权按钮：{{ authorization.permissionCodes.length }} 项</span>
        </div>
        <el-tree-select
          ref="grantTreeSelectRef"
          v-model="selectedGrantKeys"
          :data="grantTreeData"
          multiple
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="2"
          fit-input-width
          show-checkbox
          check-on-click-node
          node-key="value"
          value-key="value"
          placement="bottom-start"
          :fallback-placements="[]"
          popper-class="system-role-page__grant-popper"
          :popper-style="grantTreePopperStyle"
          class="system-role-page__full"
          data-test="role-grant-codes"
          :props="{ label: 'label', value: 'value', children: 'children' }"
          @check="handleGrantTreeCheck"
          @visible-change="handleGrantTreeVisibleChange"
        />
      </div>
      <template #footer>
        <PermissionButton @click="permissionDrawerVisible = false"
          >取消</PermissionButton
        >
        <PermissionButton
          permission="system:role:grant-permission"
          :loading="grantLoading"
          data-test="role-permission-preview-button"
          @click="previewRolePermissionImpact"
        >
          预览影响
        </PermissionButton>
        <PermissionButton
          permission="system:role:grant-permission"
          type="primary"
          :loading="grantSaving"
          data-test="role-permission-save-button"
          @click="saveRolePermissions"
        >
          保存授权
        </PermissionButton>
      </template>
    </BaseDrawer>

    <BaseDrawer
      v-model="permissionPreviewDrawerVisible"
      :title="permissionPreviewTitle"
      size="560px"
    >
      <div class="system-role-page__drawer-body">
        <el-alert
          v-if="permissionImpact?.containsHighRiskPermission"
          title="本次授权包含高风险权限，请完成二次复核后再保存。"
          type="warning"
          show-icon
          :closable="false"
        />
        <el-descriptions v-if="permissionImpact" :column="1" border>
          <el-descriptions-item label="角色编码">
            {{ permissionImpact.roleCode }}
          </el-descriptions-item>
          <el-descriptions-item label="影响用户数">
            {{ permissionImpact.affectedUserCount }}
          </el-descriptions-item>
          <el-descriptions-item label="新增权限数">
            {{ permissionImpact.addedPermissionCodes.length }}
          </el-descriptions-item>
          <el-descriptions-item label="移除权限数">
            {{ permissionImpact.removedPermissionCodes.length }}
          </el-descriptions-item>
        </el-descriptions>
        <section v-if="permissionDiff">
          <h3>新增权限</h3>
          <el-space wrap>
            <el-tag
              v-for="code in permissionDiff.addedPermissionCodes"
              :key="code"
              type="success"
              effect="plain"
            >
              {{ code }}
            </el-tag>
            <span v-if="permissionDiff.addedPermissionCodes.length === 0"
              >--</span
            >
          </el-space>
        </section>
        <section v-if="permissionDiff">
          <h3>移除权限</h3>
          <el-space wrap>
            <el-tag
              v-for="code in permissionDiff.removedPermissionCodes"
              :key="code"
              type="info"
              effect="plain"
            >
              {{ code }}
            </el-tag>
            <span v-if="permissionDiff.removedPermissionCodes.length === 0"
              >--</span
            >
          </el-space>
        </section>
      </div>
      <template #footer>
        <PermissionButton @click="permissionPreviewDrawerVisible = false"
          >关闭</PermissionButton
        >
        <PermissionButton
          permission="system:role:grant-permission"
          type="primary"
          :loading="grantSaving"
          @click="saveRolePermissions"
        >
          确认保存
        </PermissionButton>
      </template>
    </BaseDrawer>

    <BaseDrawer
      v-model="dataScopeDrawerVisible"
      :title="dataScopeDrawerTitle"
      size="520px"
    >
      <TraceErrorAlert
        v-if="error"
        :code="error.code"
        :message="error.message"
        :trace-id="error.traceId"
      />
      <el-skeleton v-if="grantLoading" :rows="6" animated />
      <div v-else class="system-role-page__drawer-body">
        <el-form label-position="top">
          <el-form-item label="数据范围">
            <el-select
              v-model="selectedDataScope"
              class="system-role-page__full"
              data-test="role-grant-data-scope-select"
              @change="handleDataScopeChange"
            >
              <el-option label="全部数据" value="ALL" />
              <el-option label="本部门" value="SELF_DEPT" />
              <el-option label="自定义部门" value="CUSTOM_DEPT" />
              <el-option label="本部门及下级" value="DEPT_AND_CHILD" />
              <el-option label="本人" value="SELF" />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="selectedDataScope === 'CUSTOM_DEPT'"
            label="自定义部门"
          >
            <el-tree-select
              v-model="selectedDeptIds"
              :data="depts"
              multiple
              show-checkbox
              node-key="id"
              value-key="id"
              class="system-role-page__full"
              data-test="role-grant-dept-ids"
              :props="{ label: 'deptName', value: 'id', children: 'children' }"
            >
              <template #tag>
                <div
                  v-for="dept in selectedDeptTags"
                  :key="dept.id"
                  class="el-select__selected-item"
                >
                  <el-tag
                    closable
                    type="info"
                    disable-transitions
                    @close="removeSelectedDeptTag(dept)"
                  >
                    <span class="el-select__tags-text">{{ dept.deptName }}</span>
                  </el-tag>
                </div>
              </template>
            </el-tree-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <PermissionButton @click="dataScopeDrawerVisible = false"
          >取消</PermissionButton
        >
        <PermissionButton
          permission="system:role:grant-data-scope"
          type="primary"
          :loading="grantSaving"
          data-test="role-data-scope-save-button"
          @click="saveRoleDataScope"
        >
          保存数据范围
        </PermissionButton>
      </template>
    </BaseDrawer>

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
.system-role-page {
  min-width: 0;
}

.system-role-page__form {
  min-width: 0;
}

.system-role-page__menu-permission {
  width: 100%;
  min-width: 0;
}

.system-role-page__menu-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-bottom: 10px;
}

.system-role-page__menu-controls :deep(.el-checkbox) {
  margin-right: 0;
}

.system-role-page__menu-tree {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-height: 360px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.system-role-page__menu-tree > :deep(.el-tree-node) {
  min-width: 0;
}

@media (max-width: 760px) {
  .system-role-page__menu-tree {
    grid-template-columns: minmax(0, 1fr);
  }
}

.system-role-page__drawer-body {
  display: grid;
  gap: 14px;
}

.system-role-page__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
}

.system-role-page__list {
  display: grid;
  gap: 10px;
}

.system-role-page__list :deep(.el-checkbox) {
  width: 100%;
  height: auto;
  margin-right: 0;
  padding: 10px 12px;
}

.system-role-page__list :deep(.el-checkbox__label) {
  display: grid;
  gap: 4px;
  line-height: 1.4;
}

.system-role-page__list small {
  color: var(--bq-color-text-secondary);
}

.system-role-page__drawer-body h3 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.system-role-page__full {
  width: 100%;
}

:global(.el-select__popper.system-role-page__grant-popper) {
  max-width: calc(100vw - 16px);
}

:global(
  .el-select__popper.system-role-page__grant-popper
    .el-select-dropdown.system-role-page__grant-popper
) {
  display: flex;
  width: 100%;
  min-width: 0 !important;
  max-width: 100%;
  height: 100%;
  max-height: none;
  flex-direction: column;
}

:global(
  .el-select__popper.system-role-page__grant-popper
    .el-select-dropdown.system-role-page__grant-popper
    .el-scrollbar
) {
  min-height: 0;
  flex: 1;
}

:global(
  .el-select__popper.system-role-page__grant-popper .el-select-dropdown__wrap
) {
  height: 100%;
  max-height: none;
}
</style>
