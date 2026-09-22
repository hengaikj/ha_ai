<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import {
  CirclePlus,
  Expand,
  Fold,
  QuestionFilled,
} from "@element-plus/icons-vue";
import {
  createPlatformMenu,
  deletePlatformMenu,
  fetchPlatformMenus,
  updatePlatformMenu,
} from "@/api/platform-system";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseIconSelect from "@/components/base/BaseIconSelect.vue";
import BaseTreeSelect from "@/components/base/BaseTreeSelect.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import { ApiBusinessError } from "@/api/http";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import type {
  PlatformId,
  PlatformMenuItem,
  PlatformMenuType,
  PlatformStatus,
} from "@/types/platform-system";
import SystemMenuVirtualTable, {
  type MenuDisplayItem,
} from "./SystemMenuVirtualTable.vue";

interface MenuQueryState {
  menuName: string;
  status: PlatformStatus | "";
}

interface MenuFormState {
  id?: PlatformId;
  parentId: string | null;
  menuCode: string;
  menuName: string;
  menuType: PlatformMenuType;
  routePath: string;
  componentPath: string;
  routeName: string;
  routeQuery: string;
  permissionCode: string;
  icon: string;
  sortNo: number | string | undefined;
  visible: boolean;
  cacheable: boolean;
  externalLink: boolean;
  status: PlatformStatus;
}

interface MenuParentOption {
  id: string;
  menuName: string;
  children?: MenuParentOption[];
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

const emptyMenuForm = (): MenuFormState => ({
  parentId: "0",
  menuCode: "",
  menuName: "",
  menuType: "PAGE",
  routePath: "",
  componentPath: "",
  routeName: "",
  routeQuery: "",
  permissionCode: "",
  icon: "",
  sortNo: 0,
  visible: true,
  cacheable: false,
  externalLink: false,
  status: "ENABLED",
});

const menus = ref<PlatformMenuItem[]>([]);
const parentMenus = ref<PlatformMenuItem[]>([]);
const saving = ref(false);
const drawerVisible = ref(false);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const expandAll = ref(false);
const expandedMenuIds = ref<Set<string>>(new Set());
const query = reactive<MenuQueryState>({
  menuName: "",
  status: "",
});
const form = reactive<MenuFormState>(emptyMenuForm());
const queryTableRef = ref<QueryTableExpose | null>(null);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const editing = computed(() => Boolean(form.id));
const drawerTitle = computed(() => (editing.value ? "编辑菜单" : "新增菜单"));
const isPageType = computed(() => form.menuType === "PAGE");
const isButtonType = computed(() => form.menuType === "BUTTON");
const parentMenuOptions = computed<MenuParentOption[]>(() => [
  {
    id: "0",
    menuName: "主类目",
    children: toParentMenuOptions(
      filterUnavailableParentMenus(parentMenus.value, form.id),
    ),
  },
]);

const visibleMenuRows = computed<MenuDisplayItem[]>(() =>
  flattenVisibleMenus(menus.value, expandedMenuIds.value),
);

async function queryMenus() {
  error.value = null;
  try {
    menus.value = await fetchPlatformMenus(buildMenuQueryParams());
    return {
      total: flattenMenus(menus.value).length,
      list: menus.value,
    };
  } catch (unknownError) {
    const normalizedError = normalizeError(unknownError);
    error.value = normalizedError;
    throw new Error(normalizedError.message, { cause: unknownError });
  }
}

async function reloadMenus() {
  await queryTableRef.value?.reload();
}

async function openCreateDrawer() {
  if (!(await refreshParentMenus())) {
    return;
  }
  delete form.id;
  Object.assign(form, emptyMenuForm());
  drawerVisible.value = true;
}

async function openCreateChildDrawer(menu: PlatformMenuItem) {
  if (!(await refreshParentMenus())) {
    return;
  }
  delete form.id;
  Object.assign(form, {
    ...emptyMenuForm(),
    parentId: toTreeSelectId(menu.id, "0"),
  });
  drawerVisible.value = true;
}

async function openEditDrawer(menu: PlatformMenuItem) {
  if (!(await refreshParentMenus())) {
    return;
  }
  error.value = null;
  Object.assign(form, {
    id: menu.id,
    parentId: toTreeSelectId(menu.parentId, "0"),
    menuCode: menu.menuCode,
    menuName: menu.menuName,
    menuType: menu.menuType ?? "PAGE",
    routePath: menu.routePath ?? "",
    componentPath: menu.componentPath ?? "",
    routeName: menu.routeName ?? "",
    routeQuery: menu.routeQuery ?? "",
    permissionCode: menu.permissionCode ?? "",
    icon: menu.icon ?? "",
    sortNo: menu.sortNo,
    visible: menu.visible ?? true,
    cacheable: menu.cacheable ?? false,
    externalLink: menu.externalLink ?? false,
    status: menu.status ?? "ENABLED",
  });
  drawerVisible.value = true;
}

async function saveMenu() {
  saving.value = true;
  error.value = null;
  try {
    const payload = buildMenuSavePayload();
    if (editing.value && form.id) {
      await updatePlatformMenu(form.id, {
        parentId: payload.parentId,
        menuName: payload.menuName,
        menuType: payload.menuType,
        routePath: payload.routePath,
        componentPath: payload.componentPath,
        routeName: payload.routeName,
        routeQuery: payload.routeQuery,
        permissionCode: payload.permissionCode,
        icon: payload.icon,
        sortNo: payload.sortNo,
        visible: payload.visible,
        cacheable: payload.cacheable,
        externalLink: payload.externalLink,
        status: payload.status,
      });
    } else {
      const menuCode = form.menuCode.trim() || inferMenuCodeFromForm();
      const existingMenu = await findExistingMenuByCode(menuCode);
      if (existingMenu) {
        BaseToast.warning(
          `菜单编码“${menuCode}”已存在：${existingMenu.menuName}`,
        );
        return;
      }
      await createPlatformMenu({
        ...payload,
        menuCode,
      });
    }
    drawerVisible.value = false;
    BaseToast.success(editing.value ? "操作成功" : "操作成功");
    await reloadMenus();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    saving.value = false;
  }
}

function buildMenuSavePayload() {
  const menuType = form.menuType;
  const routePath = form.routePath.trim();
  const pageOnlyValue = menuType === "PAGE";
  const buttonOnlyValue = menuType === "BUTTON";

  return {
    parentId: toId(form.parentId, 0),
    menuName: form.menuName.trim(),
    menuType,
    routePath: buttonOnlyValue ? "" : routePath,
    componentPath: pageOnlyValue ? form.componentPath.trim() : "",
    routeName: pageOnlyValue ? form.routeName.trim() : "",
    routeQuery: pageOnlyValue ? form.routeQuery.trim() : "",
    permissionCode:
      buttonOnlyValue || pageOnlyValue ? form.permissionCode.trim() : "",
    icon: buttonOnlyValue ? "" : form.icon.trim(),
    sortNo: toOptionalNumber(form.sortNo),
    visible: buttonOnlyValue ? false : form.visible,
    cacheable: pageOnlyValue ? form.cacheable : false,
    externalLink: buttonOnlyValue ? false : form.externalLink,
    status: form.status,
  };
}

async function toggleMenuStatus(menu: PlatformMenuItem) {
  error.value = null;
  try {
    const nextStatus =
      getMenuStatus(menu) === "ENABLED" ? "DISABLED" : "ENABLED";
    await updatePlatformMenu(menu.id, {
      parentId: menu.parentId ?? "0",
      menuName: menu.menuName,
      menuType: menu.menuType ?? "PAGE",
      routePath: menu.routePath,
      componentPath: menu.componentPath,
      routeName: menu.routeName,
      routeQuery: menu.routeQuery,
      permissionCode: menu.permissionCode,
      icon: menu.icon,
      sortNo: menu.sortNo,
      visible: menu.visible,
      cacheable: menu.cacheable,
      externalLink: menu.externalLink,
      status: nextStatus,
    });
    if (getMenuStatus(menu) === "ENABLED") {
      BaseToast.success("菜单已停用");
    } else {
      BaseToast.success("菜单已启用");
    }
    await reloadMenus();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

async function deleteMenu(menu: PlatformMenuItem) {
  try {
    await openConfirm({
      title: "删除菜单",
      message: `确认删除菜单「${menu.menuName}」？删除后菜单列表不再展示该记录；存在子菜单时后端会拒绝删除。`,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformMenu(menu.id);
    BaseToast.success("菜单已删除");
    await reloadMenus();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

function getMenuStatus(menu: PlatformMenuItem): PlatformStatus {
  return menu.status ?? "ENABLED";
}

function searchMenus() {
  queryTableRef.value?.search();
}

function resetMenuQuery() {
  query.menuName = "";
  query.status = "";
}

async function refreshParentMenus() {
  error.value = null;
  try {
    parentMenus.value = await fetchPlatformMenus();
    return true;
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
    return false;
  }
}

function buildMenuQueryParams() {
  const menuName = query.menuName.trim() || undefined;
  return {
    keyword: menuName,
    menuName,
    status: query.status || undefined,
  };
}

async function findExistingMenuByCode(menuCode: string) {
  const items = await fetchPlatformMenus();
  return flattenMenus(items).find((item) => item.menuCode === menuCode);
}

function flattenMenus(items: PlatformMenuItem[]): PlatformMenuItem[] {
  const flattened: PlatformMenuItem[] = [];
  const pending = [...items].reverse();
  while (pending.length > 0) {
    const item = pending.pop()!;
    flattened.push(item);
    pending.push(...(item.children ?? []).reverse());
  }
  return flattened;
}

function flattenVisibleMenus(
  items: PlatformMenuItem[],
  expandedIds: Set<string>,
): MenuDisplayItem[] {
  const visible: MenuDisplayItem[] = [];
  const pending = items.map((item) => ({ item, level: 0 })).reverse();
  while (pending.length > 0) {
    const current = pending.pop()!;
    const item = current.item;
    const id = String(item.id);
    const children = item.children ?? [];
    const expanded = expandedIds.has(id);
    const row: MenuDisplayItem = {
      ...item,
      children: undefined,
      level: current.level,
      expanded,
      hasChildren: children.length > 0,
    };
    visible.push(row);
    if (expanded) {
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pending.push({ item: children[index]!, level: current.level + 1 });
      }
    }
  }
  return visible;
}

function toggleMenuExpanded(menu: MenuDisplayItem) {
  const nextExpandedIds = new Set(expandedMenuIds.value);
  const id = String(menu.id);
  if (nextExpandedIds.has(id)) {
    nextExpandedIds.delete(id);
  } else {
    nextExpandedIds.add(id);
  }
  expandedMenuIds.value = nextExpandedIds;
  expandAll.value = false;
}

function filterUnavailableParentMenus(
  items: PlatformMenuItem[],
  unavailableId?: PlatformId,
): PlatformMenuItem[] {
  return items.reduce<PlatformMenuItem[]>((result, item) => {
    if (item.id === unavailableId) {
      return result;
    }

    result.push({
      ...item,
      children: filterUnavailableParentMenus(
        item.children ?? [],
        unavailableId,
      ),
    });
    return result;
  }, []);
}

function toParentMenuOptions(items: PlatformMenuItem[]): MenuParentOption[] {
  return items.map((item) => ({
    id: String(item.id),
    menuName: item.menuName,
    children: toParentMenuOptions(item.children ?? []),
  }));
}

function toggleExpandAll() {
  expandAll.value = !expandAll.value;
  expandedMenuIds.value = expandAll.value
    ? new Set(flattenMenus(menus.value).map((item) => String(item.id)))
    : new Set();
}

function toId(
  value: PlatformId | null | undefined,
  fallback: PlatformId,
): PlatformId {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (value === "0") {
    return 0;
  }
  return value;
}

function toTreeSelectId(
  value: PlatformId | null | undefined,
  fallback: string,
): string {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

function toOptionalNumber(
  value: number | string | undefined,
): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  return Number(value);
}

function inferMenuCodeFromForm() {
  const source =
    form.menuType === "BUTTON"
      ? form.permissionCode
      : form.routePath || form.permissionCode || form.menuName;
  const code = source
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[/\s]+/g, ":");
  return code || `menu:${Date.now()}`;
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
    code: "FRONTEND-SYSTEM-004",
    message: "系统管理菜单列表加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    title="菜单管理"
    description="对接平台菜单查询、新增、编辑和启停接口；菜单只用于前端展示。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryMenus"
      row-key="id"
      fit-table-height
      :show-pagination="false"
      empty-title="暂无匹配菜单"
      empty-description="当前筛选条件下没有可展示的菜单数据。"
      @reset="resetMenuQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="菜单名称">
            <el-input
              v-model="query.menuName"
              clearable
              maxlength="128"
              placeholder="请输入菜单名称"
              data-test="menu-name-query"
              @keyup.enter="searchMenus"
            />
          </el-form-item>
          <el-form-item label="菜单状态">
            <el-select
              v-model="query.status"
              clearable
              placeholder="请选择菜单状态"
              data-test="menu-status-query"
            >
              <el-option label="启用" value="ENABLED" />
              <el-option label="停用" value="DISABLED" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <template #toolbar>
        <PermissionButton
          permission="system:menu:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          data-test="create-menu-button"
          @click="openCreateDrawer"
        >
          新增
        </PermissionButton>
        <PermissionButton
          :icon="expandAll ? Fold : Expand"
          @click="toggleExpandAll"
        >
          {{ expandAll ? "全部折叠" : "全部展示" }}
        </PermissionButton>
      </template>
      <template #content="{ loading, error: tableError, height }">
        <SystemMenuVirtualTable
          :rows="visibleMenuRows"
          :loading="loading"
          :error="tableError"
          :height="height"
          @toggle-expand="toggleMenuExpanded"
          @create="openCreateDrawer"
          @edit="openEditDrawer"
          @create-child="openCreateChildDrawer"
          @remove="deleteMenu"
          @toggle-status="toggleMenuStatus"
        />
      </template>
    </QueryTable>

    <BaseFormDialog
      v-model="drawerVisible"
      :title="drawerTitle"
      width="860px"
      :loading="saving"
      body-max-height="62vh"
      confirm-text="确定"
      compact
      :confirm-button-props="{ 'data-test': 'menu-save-button' }"
      @confirm="saveMenu"
    >
      <el-form :model="form" label-position="top">
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="上级菜单" required>
              <BaseTreeSelect
                v-model="form.parentId"
                :data="parentMenuOptions"
                placeholder="请选择上级菜单"
                :props="{
                  label: 'menuName',
                  value: 'id',
                  children: 'children',
                }"
                data-test="menu-parent-input"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="菜单类型" required>
              <el-radio-group
                v-model="form.menuType"
                data-test="menu-type-select"
              >
                <el-radio value="DIRECTORY">目录</el-radio>
                <el-radio value="PAGE">菜单</el-radio>
                <el-radio value="BUTTON">按钮</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col v-if="!isButtonType" :xs="24" :sm="12">
            <el-form-item label="图标">
              <BaseIconSelect
                v-model="form.icon"
                placeholder="点击选择图标"
                data-test="menu-icon-input"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="显示排序" required>
              <el-input-number
                v-model="form.sortNo"
                :min="0"
                :step="1"
                :precision="0"
                controls-position="right"
                data-test="menu-sort-input"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="菜单名称" required>
              <el-input
                v-model="form.menuName"
                data-test="menu-name-input"
                maxlength="128"
                placeholder="请输入菜单名称"
              />
            </el-form-item>
          </el-col>
          <el-col v-if="isPageType" :xs="24" :sm="12">
            <el-form-item>
              <template #label>
                <span class="system-menu-form__label">
                  <el-tooltip
                    content="路由名称用于 keep-alive、页签和组件缓存识别，建议使用 PascalCase。"
                    placement="top"
                  >
                    <el-icon class="system-menu-form__tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                  <span>路由名称</span>
                </span>
              </template>
              <el-input
                v-model="form.routeName"
                data-test="menu-route-name-input"
                placeholder="请输入路由名称"
              />
            </el-form-item>
          </el-col>
          <el-col v-if="isButtonType" :xs="24" :sm="12">
            <el-form-item label="权限字符">
              <el-input
                v-model="form.permissionCode"
                data-test="menu-permission-code-input"
                placeholder="请输入权限标识"
              />
            </el-form-item>
          </el-col>
          <el-col v-if="!isButtonType" :xs="24" :sm="12">
            <el-form-item>
              <template #label>
                <span class="system-menu-form__label">
                  <el-tooltip
                    content="选择是时路由地址需填写完整外部链接，并建议以 http(s):// 开头。"
                    placement="top"
                  >
                    <el-icon class="system-menu-form__tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                  <span>是否外链</span>
                </span>
              </template>
              <el-radio-group v-model="form.externalLink">
                <el-radio :value="true">是</el-radio>
                <el-radio :value="false">否</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col v-if="!isButtonType" :xs="24" :sm="12">
            <el-form-item required>
              <template #label>
                <span class="system-menu-form__label">
                  <el-tooltip
                    content="目录或菜单对应的前端路由地址，建议以 / 开头，例如 /system/menu。"
                    placement="top"
                  >
                    <el-icon class="system-menu-form__tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                  <span>路由地址</span>
                </span>
              </template>
              <el-input
                v-model="form.routePath"
                data-test="menu-route-path-input"
                placeholder="请输入路由地址"
              />
            </el-form-item>
          </el-col>
          <el-col v-if="isPageType" :xs="24" :sm="12">
            <el-form-item>
              <template #label>
                <span class="system-menu-form__label">
                  <el-tooltip
                    content="前端页面组件路径，例如 system/SystemMenuPage。"
                    placement="top"
                  >
                    <el-icon class="system-menu-form__tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                  <span>组件路径</span>
                </span>
              </template>
              <el-input
                v-model="form.componentPath"
                data-test="menu-component-path-input"
                placeholder="请输入组件路径"
              />
            </el-form-item>
          </el-col>
          <el-col v-if="isPageType" :xs="24" :sm="12">
            <el-form-item label="权限字符">
              <el-input
                v-model="form.permissionCode"
                data-test="menu-permission-code-input"
                placeholder="请输入权限标识"
              />
            </el-form-item>
          </el-col>
          <el-col v-if="isPageType" :xs="24" :sm="12">
            <el-form-item>
              <template #label>
                <span class="system-menu-form__label">
                  <el-tooltip
                    content="路由参数用于补充打开页面时携带的 query 或 params，当前前端仅做记录。"
                    placement="top"
                  >
                    <el-icon class="system-menu-form__tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                  <span>路由参数</span>
                </span>
              </template>
              <el-input
                v-model="form.routeQuery"
                data-test="menu-route-query-input"
                placeholder="请输入路由参数"
              />
            </el-form-item>
          </el-col>
          <el-col v-if="isPageType" :xs="24" :sm="12">
            <el-form-item>
              <template #label>
                <span class="system-menu-form__label">
                  <el-tooltip
                    content="缓存开启后页面可参与 keep-alive 缓存。"
                    placement="top"
                  >
                    <el-icon class="system-menu-form__tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                  <span>是否缓存</span>
                </span>
              </template>
              <el-radio-group v-model="form.cacheable">
                <el-radio :value="true">缓存</el-radio>
                <el-radio :value="false">不缓存</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col v-if="!isButtonType" :xs="24" :sm="12">
            <el-form-item>
              <template #label>
                <span class="system-menu-form__label">
                  <el-tooltip
                    content="控制菜单是否在左侧导航、面包屑等入口中展示，不影响接口权限。"
                    placement="top"
                  >
                    <el-icon class="system-menu-form__tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                  <span>显示状态</span>
                </span>
              </template>
              <el-radio-group v-model="form.visible">
                <el-radio :value="true">显示</el-radio>
                <el-radio :value="false">隐藏</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item>
              <template #label>
                <span class="system-menu-form__label">
                  <el-tooltip
                    content="停用后该菜单或按钮不再作为有效入口或权限点使用。"
                    placement="top"
                  >
                    <el-icon class="system-menu-form__tip-icon">
                      <QuestionFilled />
                    </el-icon>
                  </el-tooltip>
                  <span>菜单状态</span>
                </span>
              </template>
              <el-radio-group v-model="form.status">
                <el-radio value="ENABLED">正常</el-radio>
                <el-radio value="DISABLED">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <!--          <el-col v-if="isPageType" :xs="24" :sm="12">-->
          <!--            <el-form-item label="菜单编码">-->
          <!--              <el-input-->
          <!--                v-model="form.menuCode"-->
          <!--                data-test="menu-code-input"-->
          <!--                :disabled="editing"-->
          <!--                maxlength="128"-->
          <!--              />-->
          <!--            </el-form-item>-->
          <!--          </el-col>-->
        </el-row>
      </el-form>
    </BaseFormDialog>

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
.system-page__governance {
  display: grid;
  gap: 14px;
}

.system-page__governance section {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.system-page__governance h3 {
  flex-basis: 100%;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.system-menu-form__label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.system-menu-form__tip-icon {
  color: var(--el-text-color-secondary);
  cursor: help;
  font-size: 15px;
}

.system-menu-form__tip-icon:hover {
  color: var(--el-color-primary);
}
</style>
