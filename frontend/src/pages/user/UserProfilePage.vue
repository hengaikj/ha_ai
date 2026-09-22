<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  Calendar,
  Iphone,
  Message,
  OfficeBuilding,
  User,
  UserFilled,
} from "@element-plus/icons-vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import {
  fetchUserProfile,
  updateUserProfile,
  updateUserProfilePassword,
} from "@/api/system/user";
import { useAuthStore } from "@/stores/auth";
import type { SysUserProfile, SysUserProfilePayload } from "@/types/system";
import router from "@/router";
import { useRoute } from "vue-router";
import { validatePasswordComplexity } from "@/utils/password";

type ProfileForm = Required<
  Pick<SysUserProfilePayload, "nickName" | "phonenumber" | "email" | "sex">
> & {
  userId?: number;
  userName: string;
};

type PasswordForm = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const authStore = useAuthStore();
const route = useRoute();
const activeTab = ref("profile");
const loading = ref(false);
const savingProfile = ref(false);
const savingPassword = ref(false);
const profile = ref<SysUserProfile | null>(null);
const profileFormRef = ref<FormInstance>();
const passwordFormRef = ref<FormInstance>();

const profileForm = reactive<ProfileForm>({
  userId: undefined,
  userName: "",
  nickName: "",
  phonenumber: "",
  email: "",
  sex: "0",
});

const passwordForm = reactive<PasswordForm>({
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const profileRules: FormRules<ProfileForm> = {
  nickName: [
    { required: true, message: "请输入用户昵称", trigger: "blur" },
    { whitespace: true, message: "用户昵称不能为空", trigger: "blur" },
  ],
  phonenumber: [
    { required: true, message: "请输入手机号码", trigger: "blur" },
    {
      pattern: /^1[3-9]\d{9}$/,
      message: "请输入正确的手机号码",
      trigger: "blur",
    },
  ],
  email: [
    { required: true, message: "请输入邮箱", trigger: "blur" },
    { type: "email", message: "请输入正确的邮箱", trigger: "blur" },
  ],
};

const passwordRules: FormRules<PasswordForm> = {
  oldPassword: [
    { required: true, message: "请输入旧密码", trigger: "blur" },
    { whitespace: true, message: "旧密码不能为空", trigger: "blur" },
  ],
  newPassword: [
    {
      validator: (_rule, value, callback) => {
        const passwordError = validatePasswordComplexity(String(value ?? ""));
        if (passwordError) {
          callback(new Error(passwordError));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
    {
      validator: (_rule, value, callback) => {
        if (value && value === passwordForm.oldPassword) {
          callback(new Error("新密码不能与旧密码相同"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
  confirmPassword: [
    { required: true, message: "请确认新密码", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error("两次输入的新密码不一致"));
          return;
        }
        callback();
      },
      trigger: "blur",
    },
  ],
};

const displayName = computed(
  () =>
    profile.value?.nickName ||
    authStore.currentUser?.displayName ||
    profile.value?.userName ||
    authStore.currentUser?.username ||
    "当前用户",
);

const username = computed(
  () => profile.value?.userName || authStore.currentUser?.username || "--",
);

const phone = computed(
  () => profile.value?.phonenumber || authStore.currentUser?.phone || "--",
);

const email = computed(
  () => profile.value?.email || authStore.currentUser?.email || "--",
);

const deptName = computed(
  () =>
    profile.value?.dept?.deptName ||
    authStore.currentUser?.deptName ||
    "未配置部门",
);

const roleGroup = computed(() => {
  const roleNames =
    profile.value?.roles
      ?.map((item) => item.roleName?.trim())
      .filter((name): name is string => Boolean(name)) ?? [];

  return (
    roleNames.join("、") ||
    profile.value?.roleGroup ||
    authStore.currentUser?.roles.join("、") ||
    "--"
  );
});

const createTime = computed(
  () => profile.value?.createTime || authStore.currentUser?.createTime || null,
);

function patchProfileForm(nextProfile: SysUserProfile) {
  profileForm.userId = nextProfile.userId;
  profileForm.userName =
    nextProfile.userName || authStore.currentUser?.username || "";
  profileForm.nickName =
    nextProfile.nickName || authStore.currentUser?.displayName || "";
  profileForm.phonenumber =
    nextProfile.phonenumber || authStore.currentUser?.phone || "";
  profileForm.email = nextProfile.email || authStore.currentUser?.email || "";
  profileForm.sex = nextProfile.sex || authStore.currentUser?.sex || "0";
}

function patchProfileFromCurrentUser() {
  profile.value = {
    userId: Number(authStore.currentUser?.id) || undefined,
    userName: authStore.currentUser?.username,
    nickName: authStore.currentUser?.displayName,
    email: authStore.currentUser?.email,
    phonenumber: authStore.currentUser?.phone,
    sex: authStore.currentUser?.sex,
    deptId: authStore.currentUser?.deptId,
    dept: {
      deptId: authStore.currentUser?.deptId,
      deptName: authStore.currentUser?.deptName,
    },
    createTime: authStore.currentUser?.createTime,
    roleGroup: authStore.currentUser?.roles.join("、"),
  };
  patchProfileForm(profile.value);
}

async function loadProfile() {
  loading.value = true;
  try {
    const result = await fetchUserProfile();
    profile.value = result;
    patchProfileForm(result);
  } catch {
    patchProfileFromCurrentUser();
  } finally {
    loading.value = false;
  }
}

async function saveProfile() {
  await profileFormRef.value?.validate();
  savingProfile.value = true;
  try {
    await updateUserProfile({
      userId: profileForm.userId,
      userName: profileForm.userName,
      nickName: profileForm.nickName.trim(),
      phonenumber: profileForm.phonenumber.trim(),
      email: profileForm.email.trim(),
      sex: profileForm.sex,
    });
    BaseToast.success("个人资料已保存");
    await authStore.loadAuthContext();
    await loadProfile();
  } finally {
    savingProfile.value = false;
  }
}

async function savePassword() {
  await passwordFormRef.value?.validate();
  savingPassword.value = true;
  try {
    await updateUserProfilePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    });
    BaseToast.success("密码已修改");
    passwordForm.oldPassword = "";
    passwordForm.newPassword = "";
    passwordForm.confirmPassword = "";
    passwordFormRef.value?.clearValidate();
  } finally {
    savingPassword.value = false;
  }
}

function resetProfileForm() {
  if (profile.value) {
    patchProfileForm(profile.value);
  }
  profileFormRef.value?.clearValidate();
  void router.replace(
    String(route.query.returnPath || route.meta.breadcrumbParentPath || "/"),
  );
}

function resetPasswordForm() {
  passwordForm.oldPassword = "";
  passwordForm.newPassword = "";
  passwordForm.confirmPassword = "";
  passwordFormRef.value?.clearValidate();
}

onMounted(loadProfile);
</script>

<template>
  <PageContainer class="user-profile-page" title="个人中心">
    <div v-loading="loading" class="user-profile-page__layout">
      <section class="user-profile-page__side">
        <h2 class="user-profile-page__section-title">个人信息</h2>
        <div class="user-profile-page__avatar" aria-hidden="true">
          <el-icon><UserFilled /></el-icon>
        </div>
        <div class="user-profile-page__identity">
          <strong>{{ displayName }}</strong>
          <span>{{ username }}</span>
        </div>
        <dl class="user-profile-page__facts">
          <div>
            <dt>
              <el-icon><User /></el-icon>用户名称
            </dt>
            <dd>{{ username }}</dd>
          </div>
          <div>
            <dt>
              <el-icon><Iphone /></el-icon>手机号码
            </dt>
            <dd>{{ phone }}</dd>
          </div>
          <div>
            <dt>
              <el-icon><Message /></el-icon>用户邮箱
            </dt>
            <dd>{{ email }}</dd>
          </div>
          <div>
            <dt>
              <el-icon><OfficeBuilding /></el-icon>所属部门
            </dt>
            <dd>{{ deptName }}</dd>
          </div>
          <div>
            <dt>
              <el-icon><User /></el-icon>所属角色
            </dt>
            <dd>
              <el-tooltip :content="roleGroup" placement="top">
                <span class="user-profile-page__role-value">{{
                  roleGroup
                }}</span>
              </el-tooltip>
            </dd>
          </div>
          <div>
            <dt>
              <el-icon><Calendar /></el-icon>创建时间
            </dt>
            <dd><BaseDateTime :value="createTime" /></dd>
          </div>
        </dl>
      </section>

      <section class="user-profile-page__main">
        <h2 class="user-profile-page__section-title">基本资料</h2>
        <el-tabs v-model="activeTab" class="user-profile-page__tabs">
          <el-tab-pane label="基本资料" name="profile">
            <el-form
              ref="profileFormRef"
              class="user-profile-page__form"
              label-width="96px"
              :model="profileForm"
              :rules="profileRules"
            >
              <el-form-item label="用户昵称" prop="nickName">
                <el-input
                  v-model="profileForm.nickName"
                  placeholder="请输入用户昵称"
                  clearable
                />
              </el-form-item>
              <el-form-item label="手机号码" prop="phonenumber">
                <el-input
                  v-model="profileForm.phonenumber"
                  placeholder="请输入手机号码"
                  clearable
                />
              </el-form-item>
              <el-form-item label="邮箱" prop="email">
                <el-input
                  v-model="profileForm.email"
                  placeholder="请输入邮箱"
                  clearable
                />
              </el-form-item>
              <el-form-item label="性别">
                <el-radio-group v-model="profileForm.sex">
                  <el-radio value="0">男</el-radio>
                  <el-radio value="1">女</el-radio>
                  <el-radio value="2">未知</el-radio>
                </el-radio-group>
              </el-form-item>
              <div class="user-profile-page__actions">
                <el-button
                  type="primary"
                  :loading="savingProfile"
                  @click="saveProfile"
                >
                  保存
                </el-button>
                <el-button :disabled="savingProfile" @click="resetProfileForm">
                  关闭
                </el-button>
              </div>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="修改密码" name="password">
            <el-form
              ref="passwordFormRef"
              class="user-profile-page__form"
              label-width="96px"
              :model="passwordForm"
              :rules="passwordRules"
            >
              <el-form-item label="旧密码" prop="oldPassword">
                <el-input
                  v-model="passwordForm.oldPassword"
                  type="password"
                  placeholder="请输入旧密码"
                  autocomplete="current-password"
                  show-password
                />
              </el-form-item>
              <el-form-item label="新密码" prop="newPassword">
                <el-input
                  v-model="passwordForm.newPassword"
                  type="password"
                  placeholder="请输入新密码"
                  autocomplete="new-password"
                  maxlength="16"
                  show-password
                />
              </el-form-item>
              <el-form-item label="确认密码" prop="confirmPassword">
                <el-input
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  placeholder="请确认新密码"
                  autocomplete="new-password"
                  maxlength="16"
                  show-password
                />
              </el-form-item>
              <div class="user-profile-page__actions">
                <el-button
                  type="primary"
                  :loading="savingPassword"
                  @click="savePassword"
                >
                  保存
                </el-button>
                <el-button
                  :disabled="savingPassword"
                  @click="resetPasswordForm"
                >
                  关闭
                </el-button>
              </div>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </section>
    </div>
  </PageContainer>
</template>

<style scoped>
.user-profile-page {
  height: calc(
    100vh - var(--bq-header-height) - var(--bq-tags-height) -
      var(--bq-space-page-y) - 10px
  );
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-profile-page :deep(.page-container__header) {
  flex: 0 0 auto;
}

.user-profile-page :deep(.page-container__body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.user-profile-page__layout {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 350px minmax(0, 1fr);
  gap: 24px;
  overflow: hidden;
}

.user-profile-page__side,
.user-profile-page__main {
  min-width: 0;
  min-height: 0;
  padding: 20px 24px 24px;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-card);
  background: var(--bq-color-surface);
  overflow: hidden;
}

.user-profile-page__main {
  display: flex;
  flex-direction: column;
}

.user-profile-page__section-title {
  margin: 0 -24px 20px;
  padding: 0 24px 16px;
  border-bottom: 1px solid var(--bq-color-border);
  color: var(--bq-color-text);
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
}

.user-profile-page__avatar {
  width: 132px;
  height: 132px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 4px auto 16px;
  border-radius: 50%;
  background: var(--bq-color-bg-soft);
  color: var(--bq-color-text-muted);
}

.user-profile-page__avatar .el-icon {
  font-size: 84px;
}

.user-profile-page__identity {
  display: grid;
  gap: 4px;
  margin-bottom: 18px;
  text-align: center;
}

.user-profile-page__identity strong {
  color: var(--bq-color-text);
  font-size: 17px;
  line-height: 24px;
}

.user-profile-page__identity span {
  color: var(--bq-color-text-secondary);
  font-size: 14px;
}

.user-profile-page__facts {
  display: grid;
  gap: 0;
  margin: 0;
  overflow: hidden;
}

.user-profile-page__facts div {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--bq-color-border-subtle);
}

.user-profile-page__facts dt,
.user-profile-page__facts dd {
  min-width: 0;
  margin: 0;
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
}

.user-profile-page__facts dt {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--bq-color-text-secondary);
}

.user-profile-page__facts dd {
  overflow-wrap: anywhere;
  text-align: right;
}

.user-profile-page__role-value {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-profile-page__tabs {
  --el-color-primary: var(--bq-color-primary);
  min-height: 0;
  flex: 1;
}

.user-profile-page__tabs :deep(.el-tabs__content),
.user-profile-page__tabs :deep(.el-tab-pane) {
  min-height: 0;
}

.user-profile-page__form {
  max-width: 860px;
  padding: 4px 0 0;
}

.user-profile-page__form :deep(.el-form-item) {
  margin-bottom: 28px;
}

.user-profile-page__actions {
  display: flex;
  gap: 12px;
  padding-left: 96px;
}

@media (max-width: 960px) {
  .user-profile-page__layout {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .user-profile-page__actions {
    padding-left: 0;
  }
}
</style>
