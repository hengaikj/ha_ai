<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { CirclePlus, Download, Unlock, Upload } from "@element-plus/icons-vue";
import type { FormInstance, FormRules, UploadFile } from "element-plus";
import {
  assignUserRoles,
  createPlatformUser,
  deletePlatformUsers,
  disablePlatformUser,
  enablePlatformUser,
  fetchPlatformDepts,
  fetchPlatformPostsPage,
  fetchPlatformRoles,
  fetchPlatformSystemConfigValue,
  fetchPlatformUserDetail,
  fetchPlatformUserSecurityDetail,
  fetchPlatformUsersPage,
  resetPlatformUserPassword,
  revokePlatformUserSessions,
  unlockPlatformUser,
  updatePlatformUser,
} from "@/api/platform-system";
import {
  downloadUserImportTemplate,
  exportUsers as exportSystemUsers,
  importUsers as importSystemUsers,
} from "@/api/system/user";
import { ApiBusinessError } from "@/api/http";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import BaseTreeSelect from "@/components/base/BaseTreeSelect.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import type {
  PlatformDeptItem,
  PlatformPostItem,
  PlatformRoleItem,
  PlatformStatus,
  PlatformUserItem,
  PlatformUserQuery,
  PlatformUserSecurityDetail,
} from "@/types/platform-system";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { toDateTimeRangeParams } from "@/utils/date-range";
import { resolvePageTotal } from "@/utils/pagination";
import { validatePasswordComplexity } from "@/utils/password";

const router = useRouter();
const INITIAL_PASSWORD_CONFIG_KEY = "init_pwd";

interface UserFormState {
  id?: number;
  username: string;
  displayName: string;
  deptExternalId: string;
  sex: string;
  postIds: string[];
  roleCodes: string[];
  remark: string;
  phone: string;
  status: PlatformStatus;
  initialPassword: string;
}

interface UserQueryState {
  deptExternalId: string;
  username: string;
  displayName: string;
  phone: string;
  status: PlatformStatus | "";
  createdAt: [string, string] | [] | null;
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type DeptTreeExpose = {
  filter: (keyword: string) => void;
  setCurrentKey?: (key?: string | number) => void;
};

const emptyUserForm = (): UserFormState => ({
  username: "",
  displayName: "",
  deptExternalId: "",
  sex: "",
  postIds: [],
  roleCodes: [],
  remark: "",
  phone: "",
  status: "ENABLED",
  initialPassword: "",
});

const genderOptions = [
  { label: "男", value: "0" },
  { label: "女", value: "1" },
];

const query = reactive<UserQueryState>({
  deptExternalId: "",
  username: "",
  displayName: "",
  phone: "",
  status: "",
  createdAt: [],
});

const users = ref<PlatformUserItem[]>([]);
const selectedUsers = ref<PlatformUserItem[]>([]);
const saving = ref(false);
const exporting = ref(false);
const importing = ref(false);
const importDialogVisible = ref(false);
const userImportUpdateSupport = ref(false);
const formOptionsLoading = ref(false);
const securityLoading = ref(false);
const securitySaving = ref(false);
const securityDrawerVisible = ref(false);
const resetPasswordDialogVisible = ref(false);
const confirmDialogVisible = ref(false);
const error = ref<{ code: string; message: string; traceId?: string } | null>(
  null,
);
const currentSecurityUser = ref<PlatformUserItem | null>(null);
const securityDetail = ref<PlatformUserSecurityDetail | null>(null);
const resetPasswordForm = reactive({ password: "" });
const resetPasswordFormRef = ref<FormInstance>();
const confirmAction = ref<"unlock" | "revoke" | null>(null);
const confirmReason = ref("");
const formDialogVisible = ref(false);
const formRef = ref<FormInstance>();
const form = reactive<UserFormState>(emptyUserForm());
const queryTableRef = ref<QueryTableExpose | null>(null);
const deptTreeRef = ref<DeptTreeExpose | null>(null);
const deptOptions = ref<Array<{ label: string; value: string }>>([]);
const deptTree = ref<PlatformDeptItem[]>([]);
const deptTreeKeyword = ref("");
const postOptions = ref<Array<{ label: string; value: string }>>([]);
const roleOptions = ref<Array<{ label: string; value: string }>>([]);
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();

const editing = computed(() => Boolean(form.id));
const formDialogTitle = computed(() =>
  editing.value ? "编辑用户" : "新增用户",
);
const formDeptExternalId = computed<string | number | null>({
  get: () => form.deptExternalId || null,
  set: (value) => {
    form.deptExternalId = value == null ? "" : String(value);
  },
});
const formRules = computed<FormRules<UserFormState>>(() => ({
  displayName: [
    { required: true, message: "请输入用户昵称", trigger: "blur" },
    { whitespace: true, message: "用户昵称不能为空", trigger: "blur" },
  ],
  username: editing.value
    ? []
    : [
        { required: true, message: "请输入用户名称", trigger: "blur" },
        { whitespace: true, message: "用户名称不能为空", trigger: "blur" },
        {
          validator: (
            _rule: unknown,
            value: unknown,
            callback: (error?: Error) => void,
          ) => {
            const username = String(value ?? "").trim();
            if (
              username.length > 50 ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)
            ) {
              callback(new Error("请输入正确的邮箱地址，长度50以内"));
              return;
            }
            callback();
          },
          trigger: "blur",
        },
      ],
  initialPassword: editing.value
    ? []
    : [
        { required: true, message: "请输入用户密码", trigger: "blur" },
        {
          validator: (
            _rule: unknown,
            value: unknown,
            callback: (error?: Error) => void,
          ) => {
            const passwordError = validateInitialPassword(String(value ?? ""));
            if (passwordError) {
              callback(new Error(passwordError));
              return;
            }
            callback();
          },
          trigger: "blur",
        },
      ],
  phone: [
    {
      validator: (
        _rule: unknown,
        value: unknown,
        callback: (error?: Error) => void,
      ) => {
        const phone = String(value ?? "").trim();
        if (phone && !/^\d{11}$/.test(phone)) {
          callback(new Error("手机号必须为 11 位数字"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
}));
const resetPasswordRules: FormRules<{ password: string }> = {
  password: [
    {
      validator: (
        _rule: unknown,
        value: unknown,
        callback: (error?: Error) => void,
      ) => {
        const passwordError = validatePasswordComplexity(String(value ?? ""));
        if (passwordError) {
          callback(new Error(passwordError));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
};
const confirmDialogTitle = computed(() =>
  confirmAction.value === "unlock" ? "解锁用户" : "强制下线",
);

watch(deptTreeKeyword, (keyword) => {
  deptTreeRef.value?.filter(keyword);
});

function handleUserPhoneInput(value: string) {
  form.phone = value.replace(/\D/g, "").slice(0, 11);
}

async function queryUsers(pageSize: number, pageNo: number) {
  error.value = null;
  try {
    await ensureDeptOptionsLoaded();
    const response = await fetchPlatformUsersPage(
      buildUserQueryParams(pageSize, pageNo),
    );
    users.value = response.records;
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

async function reloadUsers() {
  await queryTableRef.value?.reload();
}

function searchUsers() {
  queryTableRef.value?.search();
}

function handleReset() {
  query.deptExternalId = "";
  deptTreeRef.value?.setCurrentKey?.();
  query.username = "";
  query.displayName = "";
  query.phone = "";
  query.status = "";
  query.createdAt = [];
}

function handleSelectionChange(selection: PlatformUserItem[]) {
  selectedUsers.value = selection;
}

async function openCreateDialog() {
  delete form.id;
  Object.assign(form, emptyUserForm(), {
    deptExternalId: query.deptExternalId,
  });
  formDialogVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
  const [initialPassword] = await Promise.all([
    loadInitialPassword(),
    loadUserFormOptions(),
  ]);
  form.initialPassword = initialPassword;
}

async function loadInitialPassword(): Promise<string> {
  try {
    const password = await fetchPlatformSystemConfigValue(
      INITIAL_PASSWORD_CONFIG_KEY,
    );
    if (!password) {
      BaseToast.warning(`请先配置参数 ${INITIAL_PASSWORD_CONFIG_KEY}`);
      return "";
    }
    return password;
  } catch {
    BaseToast.error(`读取参数 ${INITIAL_PASSWORD_CONFIG_KEY} 失败`);
    return "";
  }
}

async function openEditDialog(user: PlatformUserItem) {
  error.value = null;
  const detail = await fetchPlatformUserDetail(user.id).catch(
    (unknownError) => {
      error.value = normalizeError(unknownError);
      return null;
    },
  );
  if (!detail) {
    return;
  }
  Object.assign(form, {
    id: detail.id,
    username: detail.username,
    displayName: detail.displayName ?? "",
    deptExternalId: detail.deptExternalId ?? "",
    sex: detail.sex,
    postIds: [...detail.postIds],
    roleCodes: [...detail.roleCodes],
    remark: "",
    phone: detail.phone ?? "",
    status: detail.status,
    initialPassword: "",
  });
  formDialogVisible.value = true;
  nextTick(() => formRef.value?.clearValidate());
  await loadUserFormOptions();
}

async function loadUserFormOptions() {
  formOptionsLoading.value = true;
  error.value = null;
  try {
    const [postPage, roleList] = await Promise.all([
      fetchPlatformPostsPage({ pageNo: 1, pageSize: 200, status: "ENABLED" }),
      fetchPlatformRoles(),
    ]);

    await ensureDeptOptionsLoaded();
    postOptions.value = postPage.records.map(toPostOption);
    roleOptions.value = roleList
      .filter((role) => role.status === "ENABLED")
      .map(toRoleOption);
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    formOptionsLoading.value = false;
  }
}

async function ensureDeptOptionsLoaded() {
  if (deptOptions.value.length > 0) {
    return;
  }
  const deptList = await fetchPlatformDepts({ status: "ENABLED" });
  deptTree.value = deptList;
  deptOptions.value = flattenDeptOptions(deptList);
  await nextTick();
  deptTreeRef.value?.filter(deptTreeKeyword.value);
}

function handleDeptNodeClick(dept: PlatformDeptItem) {
  query.deptExternalId = dept.deptCode;
  searchUsers();
}

function filterDeptNode(keyword: string, data: PlatformDeptItem) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }
  return (
    data.deptName.toLowerCase().includes(normalizedKeyword) ||
    data.deptCode.toLowerCase().includes(normalizedKeyword)
  );
}

function flattenDeptOptions(
  depts: PlatformDeptItem[],
): Array<{ label: string; value: string }> {
  return depts.flatMap((dept) => [
    toDeptOption(dept),
    ...flattenDeptOptions(dept.children ?? []),
  ]);
}

function toDeptOption(dept: PlatformDeptItem) {
  return {
    label: dept.deptName,
    value: dept.deptCode,
  };
}

function resolveDeptName(deptExternalId?: string) {
  if (!deptExternalId) {
    return "--";
  }
  return (
    deptOptions.value.find((option) => option.value === deptExternalId)
      ?.label ?? deptExternalId
  );
}

function toPostOption(post: PlatformPostItem) {
  return {
    label: post.postName,
    value: String(post.id),
  };
}

function toRoleOption(role: PlatformRoleItem) {
  return {
    label: role.roleName,
    value: String(role.id),
  };
}

async function saveUser() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    const roleCodes = form.roleCodes
      .map((roleCode) => roleCode.trim())
      .filter(Boolean);
    const postIds = form.postIds.map((postId) => postId.trim()).filter(Boolean);
    const displayName = form.displayName.trim();
    const phone = form.phone.trim();
    const deptExternalId = form.deptExternalId.trim();
    const sex = form.sex.trim();
    if (editing.value && form.id) {
      await updatePlatformUser(form.id, {
        displayName,
        phone,
        deptExternalId,
        status: form.status,
        postIds,
        sex,
      });
      await assignUserRoles(form.id, roleCodes);
      BaseToast.success("用户已编辑");
    } else {
      await createPlatformUser({
        username: form.username.trim(),
        displayName,
        phone,
        deptExternalId,
        status: form.status,
        roleCodes,
        postIds,
        initialPassword: form.initialPassword,
        sex,
      });
      BaseToast.success("用户已新增");
    }
    formDialogVisible.value = false;
    await reloadUsers();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    saving.value = false;
  }
}

function validateInitialPassword(password: string): string {
  if (!password) {
    return "请填写用户密码";
  }
  return validatePasswordComplexity(password);
}

function buildUserQueryParams(
  pageSize: number,
  pageNo: number,
): PlatformUserQuery {
  const dateRange = toDateTimeRangeParams(query.createdAt);
  const keyword = [query.username, query.displayName, query.phone]
    .map((item) => item.trim())
    .find(Boolean);
  return {
    pageNo,
    pageSize,
    keyword,
    username: query.username.trim() || undefined,
    displayName: query.displayName.trim() || undefined,
    phone: query.phone.trim() || undefined,
    deptExternalId: query.deptExternalId || undefined,
    status: query.status || undefined,
    ...dateRange,
  };
}

async function exportUsers() {
  exporting.value = true;
  error.value = null;
  try {
    const blob = await exportSystemUsers(buildUserQueryParams(5000, 1));
    downloadBlob(blob, "用户数据.xlsx");
    BaseToast.success("用户已导出");
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    exporting.value = false;
  }
}

function openImportDialog() {
  userImportUpdateSupport.value = false;
  importDialogVisible.value = true;
}

async function downloadUserTemplate() {
  const blob = await downloadUserImportTemplate();
  downloadBlob(blob, "用户导入模板.xlsx");
}

async function submitImportUsers(uploadFile: UploadFile) {
  const file = uploadFile.raw;
  if (!file) {
    BaseToast.warning("请选择导入文件");
    return;
  }
  importing.value = true;
  error.value = null;
  try {
    const result = await importSystemUsers(file, userImportUpdateSupport.value);
    importDialogVisible.value = false;
    await reloadUsers();
    if (result.failure > 0) {
      BaseToast.warning(
        `用户导入完成：成功 ${result.success} 条，失败 ${result.failure} 条`,
      );
    } else {
      BaseToast.success(`用户导入完成：成功 ${result.success} 条`);
    }
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    importing.value = false;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function toggleUserStatus(user: PlatformUserItem) {
  error.value = null;
  try {
    if (user.status === "ENABLED") {
      await disablePlatformUser(user.id);
      BaseToast.success("用户已停用");
    } else {
      await enablePlatformUser(user.id);
      BaseToast.success("用户已启用");
    }
    await reloadUsers();
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  }
}

async function openSecurityDrawer(user: PlatformUserItem) {
  currentSecurityUser.value = user;
  securityDrawerVisible.value = true;
  securityLoading.value = true;
  error.value = null;
  try {
    securityDetail.value = await fetchPlatformUserSecurityDetail(user.id);
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    securityLoading.value = false;
  }
}

async function openResetPasswordDialog(user: PlatformUserItem) {
  currentSecurityUser.value = user;
  resetPasswordForm.password = "";
  resetPasswordDialogVisible.value = true;
  nextTick(() => resetPasswordFormRef.value?.clearValidate());
  resetPasswordForm.password = await loadInitialPassword();
}

function openUserAuthRole(user: PlatformUserItem) {
  void router.push({
    name: "systemUserAuthRole",
    params: { userId: String(user.id) },
  });
}

function openUserDataPermission(user: PlatformUserItem) {
  void router.push({
    name: "systemUserDataPermission",
    params: {
      userId: String(user.id),
      userName: user.username || "",
      nickName: user.displayName || user.username || "",
      username: user.username || "-",
      displayName: user.displayName || user.username || "-",
    },
    query: {
      userId: String(user.id),
      username: user.username || "",
      displayName: user.displayName || user.username || "",
    },
  });
}

function openConfirmDialog(
  user: PlatformUserItem,
  action: "unlock" | "revoke",
) {
  currentSecurityUser.value = user;
  confirmAction.value = action;
  confirmReason.value = "";
  confirmDialogVisible.value = true;
}

async function deleteUser(user: PlatformUserItem) {
  await confirmDeleteUsers(
    [user.id],
    `确认删除用户「${user.displayName || user.username}」？删除后用户列表不再展示该记录，并会清理该用户角色关系和登录凭据。`,
  );
}

async function deleteSelectedUsers() {
  if (!selectedUsers.value.length) {
    BaseToast.warning("请先选择用户");
    return;
  }
  await confirmDeleteUsers(
    selectedUsers.value.map((user) => user.id),
    `确认删除选中的 ${selectedUsers.value.length} 个用户？删除后用户列表不再展示这些记录，并会清理这些用户的角色关系和登录凭据。`,
  );
}

async function confirmDeleteUsers(userIds: number[], message: string) {
  try {
    await openConfirm({
      title: "删除用户",
      message,
      type: "danger",
      confirmText: "删除",
      cancelText: "取消",
    });
    await deletePlatformUsers(userIds);
    selectedUsers.value = [];
    BaseToast.success("用户已删除");
    await reloadUsers();
  } catch (unknownError) {
    if (unknownError === "cancel" || unknownError === "close") {
      return;
    }
    error.value = normalizeError(unknownError);
  }
}

async function submitResetPassword() {
  if (!currentSecurityUser.value) {
    return;
  }
  const valid = await resetPasswordFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  securitySaving.value = true;
  error.value = null;
  try {
    await resetPlatformUserPassword(
      currentSecurityUser.value.id,
      resetPasswordForm.password,
    );
    resetPasswordDialogVisible.value = false;
    BaseToast.success("密码已重置");
    if (securityDrawerVisible.value) {
      await openSecurityDrawer(currentSecurityUser.value);
    }
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    securitySaving.value = false;
  }
}

async function submitConfirmAction() {
  const reason = confirmReason.value.trim();
  if (!currentSecurityUser.value || !confirmAction.value || !reason) {
    BaseToast.warning("请输入确认原因");
    return;
  }
  securitySaving.value = true;
  error.value = null;
  try {
    if (confirmAction.value === "unlock") {
      await unlockPlatformUser(currentSecurityUser.value.id, {
        confirmReason: reason,
      });
      BaseToast.success("用户已解锁");
    } else {
      await revokePlatformUserSessions(currentSecurityUser.value.id, {
        confirmReason: reason,
      });
      BaseToast.success("已强制下线");
    }
    confirmDialogVisible.value = false;
    await reloadUsers();
    if (securityDrawerVisible.value) {
      await openSecurityDrawer(currentSecurityUser.value);
    }
  } catch (unknownError) {
    error.value = normalizeError(unknownError);
  } finally {
    securitySaving.value = false;
  }
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
    code: "FRONTEND-SYSTEM-001",
    message: "系统管理用户列表加载失败，请检查后端服务。",
    traceId: "unknown",
  };
}
</script>

<template>
  <PageContainer
    class="system-user-page"
    title="用户管理"
    description="管理系统用户、状态、角色和安全操作。"
  >
    <div class="system-user-page__content">
      <aside class="system-user-page__dept-panel">
        <div class="system-user-page__dept-search">
          <el-input
            v-model="deptTreeKeyword"
            clearable
            placeholder="请输入部门名称"
          />
        </div>
        <el-tree
          ref="deptTreeRef"
          class="system-user-page__dept-tree"
          :data="deptTree"
          :props="{ label: 'deptName', children: 'children' }"
          node-key="deptCode"
          :current-node-key="query.deptExternalId"
          :filter-node-method="filterDeptNode"
          highlight-current
          default-expand-all
          empty-text="暂无部门"
          @node-click="handleDeptNodeClick"
        />
      </aside>

      <QueryTable
        ref="queryTableRef"
        class="system-user-page__table"
        :func="queryUsers"
        row-key="id"
        fit-table-height
        :table-props="{ scrollbarAlwaysOn: true }"
        empty-title="暂无匹配用户"
        empty-description="当前筛选条件下没有可展示的用户数据。"
        @reset="handleReset"
        @selection-change="handleSelectionChange"
      >
        <template #search>
          <el-form class="system-user-page__search-form" :model="query">
            <el-form-item label="用户名称">
              <el-input
                v-model="query.username"
                clearable
                maxlength="128"
                placeholder="请输入用户名称"
                data-test="user-search-username"
                @keyup.enter="searchUsers"
              />
            </el-form-item>
            <el-form-item label="用户昵称">
              <el-input
                v-model="query.displayName"
                clearable
                maxlength="128"
                placeholder="请输入用户昵称"
                data-test="user-search-display-name"
                @keyup.enter="searchUsers"
              />
            </el-form-item>
            <el-form-item label="手机号码">
              <el-input
                v-model="query.phone"
                clearable
                maxlength="32"
                placeholder="请输入手机号码"
                data-test="user-search-phone"
                @keyup.enter="searchUsers"
              />
            </el-form-item>
            <el-form-item label="用户状态">
              <el-select
                v-model="query.status"
                clearable
                placeholder="用户状态"
                data-test="user-search-status"
              >
                <el-option label="启用" value="ENABLED" />
                <el-option label="停用" value="DISABLED" />
              </el-select>
            </el-form-item>
            <el-form-item label="创建时间">
              <el-date-picker
                v-model="query.createdAt"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
          </el-form>
        </template>
        <template #toolbar>
          <PermissionButton
            permission="system:user:add"
            variant="primary"
            type="primary"
            plain
            :icon="CirclePlus"
            data-test="create-user-button"
            @click="openCreateDialog"
          >
            新增
          </PermissionButton>
          <PermissionButton
            permission="system:user:export"
            variant="secondary"
            :icon="Download"
            plain
            type="warning"
            :loading="exporting"
            data-test="export-user-button"
            @click="exportUsers"
          >
            导出
          </PermissionButton>
          <PermissionButton
            permission="system:user:import"
            variant="secondary"
            :icon="Upload"
            plain
            type="success"
            :loading="importing"
            data-test="import-user-button"
            @click="openImportDialog"
          >
            导入
          </PermissionButton>
          <PermissionButton
              permission="system:user:remove"
              variant="danger"
              type="danger"
              plain
              data-test="delete-selected-users-button"
              @click="deleteSelectedUsers"
          >
            批量删除
          </PermissionButton>
        </template>
        <el-table-column type="selection" width="55" />
        <el-table-column label="序号" type="index" width="60" />
        <el-table-column prop="username" label="用户名称" min-width="160" />
        <el-table-column prop="displayName" label="用户昵称" min-width="140" />
        <el-table-column prop="phone" label="手机号码" min-width="160">
          <template #default="{ row }">
            {{ row.phone || "--" }}
          </template>
        </el-table-column>
        <el-table-column prop="deptExternalId" label="部门" min-width="140">
          <template #default="{ row }">
            {{ resolveDeptName(row.deptExternalId) }}
          </template>
        </el-table-column>
        <el-table-column label="用户状态" width="110">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 'ENABLED'"
              @change="toggleUserStatus(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="在线状态" width="100" align="center">
          <template #default="{ row }">
            <BaseStatusTag
              :label="row.online ? '在线' : '离线'"
              :type="row.online ? 'success' : 'info'"
            />
          </template>
        </el-table-column>
        <el-table-column label="锁定状态" width="100" align="center">
          <template #default="{ row }">
            <BaseStatusTag
              :label="row.locked ? '已锁定' : '正常'"
              :type="row.locked ? 'danger' : 'success'"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="180">
          <template #default="{ row }">
            <BaseDateTime :value="row.createdAt || null" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
              <PermissionButton
                permission="system:user:edit"
                link
                :data-test="`edit-user-${row.id}`"
                @click="openEditDialog(row)"
              >
                编辑
              </PermissionButton>
<!--              <PermissionButton-->
<!--                permission="system:user:security-detail"-->
<!--                link-->
<!--                :data-test="`user-security-${row.id}`"-->
<!--                @click="openSecurityDrawer(row)"-->
<!--              >-->
<!--                安全-->
<!--              </PermissionButton>-->
              <PermissionButton
                permission="system:user:resetPwd"
                link
                :data-test="`user-reset-password-${row.id}`"
                @click="openResetPasswordDialog(row)"
              >
                重置密码
              </PermissionButton>
              <PermissionButton
                permission="system:user:role:oper"
                link
                :data-test="`assign-user-role-${row.id}`"
                @click="openUserAuthRole(row)"
              >
                分配角色
              </PermissionButton>
              <PermissionButton
                permission="system:project:permission"
                link
                :data-test="`user-data-permission-${row.id}`"
                @click="openUserDataPermission(row)"
              >
                数据权限
              </PermissionButton>
              <PermissionButton
                permission="system:user:remove"
                link
                :data-test="`delete-user-${row.id}`"
                @click="deleteUser(row)"
              >
                删除
              </PermissionButton>
          </template>
        </el-table-column>
      </QueryTable>
    </div>

    <BaseFormDialog
      v-model="formDialogVisible"
      :title="formDialogTitle"
      width="720px"
      :loading="saving"
      compact
      confirm-text="确定"
      :confirm-button-props="{ 'data-test': 'user-save-button' }"
      @confirm="saveUser"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        class="system-user-page__form"
        label-position="top"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="用户昵称" prop="displayName">
              <el-input
                v-model="form.displayName"
                maxlength="128"
                placeholder="请输入用户昵称"
                data-test="user-display-name-input"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="归属部门">
              <BaseTreeSelect
                v-model="formDeptExternalId"
                :data="deptTree"
                placeholder="请选择归属部门"
                filterable
                default-expand-all
                node-key="deptCode"
                :props="{
                  label: 'deptName',
                  value: 'deptCode',
                  children: 'children',
                }"
                data-test="user-dept-input"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用户名称" prop="username">
              <el-input
                v-model="form.username"
                :disabled="editing"
                maxlength="50"
                placeholder="请输入邮箱"
                data-test="user-username-input"
              />
            </el-form-item>
          </el-col>
          <el-col v-if="!editing" :span="12">
            <el-form-item label="用户密码" prop="initialPassword">
              <el-input
                v-model="form.initialPassword"
                show-password
                maxlength="16"
                placeholder="请输入用户密码"
                data-test="user-password-input"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号码" prop="phone">
              <el-input
                v-model="form.phone"
                maxlength="11"
                placeholder="请输入手机号码"
                data-test="user-phone-input"
                @input="handleUserPhoneInput"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用户性别">
              <el-select
                v-model="form.sex"
                clearable
                placeholder="请选择性别"
                data-test="user-gender-input"
              >
                <el-option
                  v-for="option in genderOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="岗位">
              <el-select
                v-model="form.postIds"
                multiple
                collapse-tags
                collapse-tags-tooltip
                clearable
                filterable
                :loading="formOptionsLoading"
                placeholder="请选择岗位，可多选"
                data-test="user-post-input"
              >
                <el-option
                  v-for="option in postOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色">
              <el-select
                v-model="form.roleCodes"
                multiple
                collapse-tags
                collapse-tags-tooltip
                clearable
                filterable
                :loading="formOptionsLoading"
                placeholder="请选择角色，可多选"
                data-test="user-roles-input"
              >
                <el-option
                  v-for="option in roleOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="用户状态">
              <el-radio-group v-model="form.status">
                <el-radio value="ENABLED">正常</el-radio>
                <el-radio value="DISABLED">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                maxlength="500"
                placeholder="请输入备注"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </BaseFormDialog>

    <BaseImportDialog
      v-model="importDialogVisible"
      title="导入用户"
      module-name="用户"
      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      :loading="importing"
      template-text="下载导入模板"
      template-title="用户导入模板"
      template-description="请按模板列填写：用户名称(登录账号，格式为邮箱)、用户昵称(昵称/姓名) 、部门编号、账号状态等。"
      upload-text="拖拽 XLSX 文件到此处，或"
      upload-action-text="点击选择"
      upload-tip="只能上传 XLSX 格式文件，且不超过 20MB。"
      confirm-text="导入"
      @download-template="downloadUserTemplate"
      @import="submitImportUsers"
    >
      <div class="user-import-dialog__update-support">
        <el-checkbox v-model="userImportUpdateSupport">
          是否更新已经存在的用户数据
        </el-checkbox>
      </div>
    </BaseImportDialog>

    <BaseDrawer
      v-model="securityDrawerVisible"
      title="用户安全详情"
      size="520px"
    >
      <el-skeleton v-if="securityLoading" :rows="8" animated />
      <el-descriptions v-else-if="securityDetail" :column="1" border>
        <el-descriptions-item label="用户名称">{{
          securityDetail.username
        }}</el-descriptions-item>
        <el-descriptions-item label="用户状态">{{
          securityDetail.userStatus
        }}</el-descriptions-item>
        <el-descriptions-item label="凭据状态">{{
          securityDetail.credentialStatus
        }}</el-descriptions-item>
        <el-descriptions-item label="连续失败次数">{{
          securityDetail.failedAttempts
        }}</el-descriptions-item>
        <el-descriptions-item label="锁定到期时间">{{
          securityDetail.lockedUntil || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="密码更新时间">{{
          securityDetail.passwordUpdatedAt || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="密码版本">{{
          securityDetail.passwordVersion
        }}</el-descriptions-item>
        <el-descriptions-item label="Token版本">{{
          securityDetail.tokenVersion
        }}</el-descriptions-item>
        <el-descriptions-item label="最近登录成功">{{
          securityDetail.lastLoginSuccessAt || "--"
        }}</el-descriptions-item>
        <el-descriptions-item label="最近登录失败">{{
          securityDetail.lastLoginFailedAt || "--"
        }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <PermissionButton @click="securityDrawerVisible = false">关闭</PermissionButton>
        <PermissionButton
          v-if="currentSecurityUser"
          permission="system:user:unlock"
          type="warning"
          :icon="Unlock"
          data-test="user-security-unlock-button"
          @click="openConfirmDialog(currentSecurityUser, 'unlock')"
        >
          解锁
        </PermissionButton>
        <PermissionButton
          v-if="currentSecurityUser"
          permission="system:user:revoke-session"
          type="warning"
          data-test="user-security-revoke-button"
          @click="openConfirmDialog(currentSecurityUser, 'revoke')"
        >
          强制下线
        </PermissionButton>
      </template>
    </BaseDrawer>

    <BaseFormDialog
      v-model="resetPasswordDialogVisible"
      title="重置密码"
      width="420px"
      :loading="securitySaving"
      compact
      :confirm-button-props="{ 'data-test': 'user-reset-password-submit' }"
      @confirm="submitResetPassword"
    >
      <el-form
        ref="resetPasswordFormRef"
        :model="resetPasswordForm"
        :rules="resetPasswordRules"
        label-position="top"
      >
        <el-form-item label="新密码" prop="password">
          <el-input
            v-model="resetPasswordForm.password"
            show-password
            maxlength="16"
            data-test="user-reset-password-input"
          />
        </el-form-item>
      </el-form>
    </BaseFormDialog>

    <BaseFormDialog
      v-model="confirmDialogVisible"
      :title="confirmDialogTitle"
      :loading="securitySaving"
      confirm-text="确认"
      cancel-text="取消"
      compact
      :confirm-button-props="{ 'data-test': 'user-confirm-action-submit' }"
      @confirm="submitConfirmAction"
    >
      <el-form label-position="top">
        <el-form-item label="确认原因" required>
          <el-input
            v-model="confirmReason"
            type="textarea"
            maxlength="500"
            placeholder="请输入确认原因"
            data-test="user-confirm-reason-input"
          />
        </el-form-item>
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
.system-user-page {
  min-width: 0;
}

.system-user-page__content {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - 314px);
  min-height: 360px;
  min-width: 0;
}

.system-user-page__dept-panel {
  min-width: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--bq-color-divider);
  padding-right: 14px;
}

.system-user-page__dept-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-bottom: 10px;
}

.system-user-page__dept-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 6px;
  scrollbar-color: color-mix(
      in srgb,
      var(--el-text-color-secondary) 38%,
      transparent
    )
    transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.system-user-page__dept-tree::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.system-user-page__dept-tree::-webkit-scrollbar-track {
  background: transparent;
}

.system-user-page__dept-tree::-webkit-scrollbar-thumb {
  min-height: 36px;
  border: 2px solid transparent;
  border-radius: 4px;
  background: color-mix(
    in srgb,
    var(--el-text-color-secondary) 38%,
    transparent
  );
  background-clip: padding-box;
}

.system-user-page__dept-tree::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--el-text-color-primary) 52%, transparent);
  background-clip: padding-box;
}

.system-user-page__dept-tree::-webkit-scrollbar-corner {
  background: transparent;
}

.system-user-page__table {
  min-width: 0;
}

.system-user-page :deep(.system-user-page__search-form) {
  grid-template-columns: repeat(2, minmax(220px, 1fr));
}

.system-user-page__form {
  min-width: 0;
}

.user-import-dialog__update-support {
  margin-top: -4px;
}

@media (max-width: 1200px) {
  .system-user-page__content {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .system-user-page :deep(.system-user-page__search-form) {
    grid-template-columns: minmax(220px, 1fr);
  }
}

@media (max-width: 900px) {
  .system-user-page__content {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }

  .system-user-page__dept-panel {
    height: min(220px, 28vh);
    border-right: 0;
    border-bottom: 1px solid var(--bq-color-divider);
    padding-right: 0;
    padding-bottom: 12px;
  }
}

@media (max-width: 600px) {
  .system-user-page :deep(.base-search-form) {
    flex-direction: column;
    gap: 12px;
  }

  .system-user-page :deep(.base-search-form__content) {
    padding-right: 0;
  }

  .system-user-page :deep(.base-search-form__actions) {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .system-user-page :deep(.base-search-form__toggle) {
    position: static;
  }
}

@media (max-width: 768px) {
  .system-user-page__content {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    height: auto;
    min-height: 0;
  }

  .system-user-page__dept-panel {
    max-height: 220px;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--bq-color-divider);
    padding-right: 0;
    padding-bottom: 12px;
  }

  .system-user-page__dept-tree {
    max-height: 150px;
  }
}
</style>
