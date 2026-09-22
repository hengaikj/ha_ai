<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { CircleCheck, Lock, User } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import { fetchCaptchaImage } from "@/api/auth";
import { ApiBusinessError } from "@/api/http";
import { useAuthStore } from "@/stores/auth";
import loginBackground from "@/assets/images/img.png";
import baicLogo from "@/assets/logo/logo-white.png";
import projectTitle from "@/assets/logo/WA.png";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const form = reactive({
  username: "",
  password: "",
  code: "",
  uuid: "",
});
const rememberPassword = ref(false);
const captchaEnabled = ref(true);
const captchaImage = ref("");
const captchaLoading = ref(false);
const CAPTCHA_ERROR_CODE = "120001";
const REMEMBERED_LOGIN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
let captchaRequestSequence = 0;

function getLoginCookie(name: string): string | undefined {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}

function setLoginCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${REMEMBERED_LOGIN_COOKIE_MAX_AGE}; path=/`;
}

function removeLoginCookie(name: string) {
  document.cookie = `${name}=; max-age=0; path=/`;
}

function loadRememberedLogin() {
  const username = getLoginCookie("username");
  const password = getLoginCookie("password");
  const rememberMe = getLoginCookie("rememberMe");
  if (username !== undefined) {
    form.username = username;
  }
  if (password !== undefined) {
    form.password = password;
  }
  rememberPassword.value = rememberMe === "true";
}

function removeRememberedLogin() {
  removeLoginCookie("username");
  removeLoginCookie("password");
  removeLoginCookie("rememberMe");
}

function persistRememberedLogin() {
  if (!rememberPassword.value) {
    removeRememberedLogin();
    return;
  }

  setLoginCookie("username", form.username);
  setLoginCookie("password", form.password);
  setLoginCookie("rememberMe", "true");
}

function isCaptchaErrorCode(code: string | number | undefined): boolean {
  return String(code ?? "").trim() === CAPTCHA_ERROR_CODE;
}

function toCaptchaImageSource(image?: string): string {
  if (!image) {
    return "";
  }
  if (image.startsWith("data:image/")) {
    return image;
  }
  const mimeType = image.startsWith("/9j/")
    ? "image/jpeg"
    : image.startsWith("R0lGOD")
      ? "image/gif"
      : image.startsWith("UklGR")
        ? "image/webp"
        : "image/png";
  return `data:${mimeType};base64,${image}`;
}

function resolveLoginRedirect(redirect: unknown): string {
  if (typeof redirect !== "string") {
    return "/";
  }

  const normalizedRedirect = redirect.trim();
  if (
    !normalizedRedirect.startsWith("/") ||
    normalizedRedirect.startsWith("//") ||
    normalizedRedirect === "/403" ||
    normalizedRedirect.startsWith("/403?") ||
    normalizedRedirect.startsWith("/403/")
  ) {
    return "/";
  }

  return normalizedRedirect;
}

async function handleSubmit() {
  if (authStore.loading) {
    return;
  }

  try {
    persistRememberedLogin();
    await authStore.signIn(form);
    await router.push(resolveLoginRedirect(route.query.redirect));
  } catch (unknownError) {
    if (unknownError instanceof ApiBusinessError) {
      if (isCaptchaErrorCode(unknownError.code)) {
        BaseToast.error(unknownError.message || "验证码错误或已过期");
        await refreshCaptcha();
        return;
      }

      BaseToast.error(unknownError.message || "登录失败，请检查账号信息");
      await refreshCaptcha();
      return;
    }

    BaseToast.error("登录请求失败，请检查网络或后端服务。");
    await refreshCaptcha();
  }
}

async function refreshCaptcha() {
  const requestSequence = ++captchaRequestSequence;
  captchaLoading.value = true;
  try {
    const captcha = await fetchCaptchaImage();
    if (requestSequence !== captchaRequestSequence) {
      return;
    }
    captchaEnabled.value = captcha.captchaEnabled;
    form.uuid = captcha.uuid ?? "";
    form.code = "";
    captchaImage.value = toCaptchaImageSource(captcha.img);
  } catch {
    if (requestSequence !== captchaRequestSequence) {
      return;
    }
    captchaEnabled.value = true;
    form.uuid = "";
    form.code = "";
    captchaImage.value = "";
  } finally {
    if (requestSequence === captchaRequestSequence) {
      captchaLoading.value = false;
    }
  }
}

onMounted(() => {
  loadRememberedLogin();
  void refreshCaptcha();
});
</script>

<template>
  <main
    class="login-page"
    :style="{ backgroundImage: `url(${loginBackground})` }"
  >
    <header class="login-page__brand" aria-label="北汽集团">
      <img class="login-page__brand-logo" :src="baicLogo" alt="北汽集团" />
      <img
        class="login-page__brand-title"
        :src="projectTitle"
        alt="收益与成本管理系统"
      />
    </header>

    <section class="login-page__panel" aria-label="登录">
      <h1>登录</h1>

      <el-form
        class="login-page__form"
        :model="form"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item required>
          <el-input
            v-model="form.username"
            data-test="login-username"
            placeholder="账号"
            autocomplete="username"
            size="large"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item required>
          <el-input
            v-model="form.password"
            data-test="login-password"
            type="password"
            placeholder="密码"
            autocomplete="current-password"
            show-password
            size="large"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item v-if="captchaEnabled">
          <div class="login-page__captcha">
            <el-input
              v-model="form.code"
              data-test="login-captcha-code"
              maxlength="6"
              placeholder="验证码"
              autocomplete="off"
              size="large"
            >
              <template #prefix>
                <el-icon><CircleCheck /></el-icon>
              </template>
            </el-input>
            <button
              class="login-page__captcha-image"
              type="button"
              :disabled="captchaLoading"
              aria-label="刷新验证码"
              @click="refreshCaptcha"
            >
              <img
                v-if="captchaImage"
                data-test="login-captcha-image"
                :src="captchaImage"
                alt="验证码"
              />
              <span v-else>刷新</span>
            </button>
          </div>
        </el-form-item>
        <el-checkbox
          v-model="rememberPassword"
          data-test="login-remember"
          class="login-page__remember"
        >
          记住密码
        </el-checkbox>
        <PermissionButton
          type="primary"
          native-type="submit"
          :loading="authStore.loading"
          class="login-page__submit"
        >
          登录
        </PermissionButton>
      </el-form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  position: relative;
  display: flex;
  min-width: 100vw;
  min-height: 100vh;
  overflow: hidden;
  background-color: #2f302f;
  background-position: center;
  background-size: cover;
}

.login-page::before {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.28) 0%,
    rgba(0, 0, 0, 0.08) 42%,
    rgba(0, 0, 0, 0.02) 100%
  );
  pointer-events: none;
}

.login-page__brand {
  position: absolute;
  top: clamp(32px, 3.2vw, 60px);
  left: clamp(36px, 4vw, 76px);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: clamp(30px, 3vw, 54px);
}

.login-page__brand-logo {
  width: clamp(118px, 7.3vw, 140px);
  height: auto;
  object-fit: contain;
}

.login-page__brand-title {
  width: clamp(252px, 17.5vw, 336px);
  height: auto;
  object-fit: contain;
}

.login-page__panel {
  position: fixed;
  top: 50%;
  right: clamp(88px, 9.7vw, 186px);
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 380px;
  height: auto;
  min-height: 0;
  padding: 30px 14px 30px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.86);
  border-radius: 24px;
  box-shadow: 0 22px 58px rgba(38, 43, 50, 0.2);
  transform: translateY(-40%);
  backdrop-filter: blur(12px);
}

.login-page__panel h1 {
  width: 100%;
  margin: 0 0 26px;
  color: #050505;
  font-size: 36px;
  line-height: 1.1;
  font-weight: 800;
  text-align: center;
}

.login-page__form {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 16px;
}

.login-page__form :deep(.el-form-item) {
  margin-bottom: 0;
}

.login-page__form :deep(.el-input__wrapper) {
  min-height: 40px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.76);
  border-radius: 25px;
  box-shadow: 0 0 0 1px #d7d7d7 inset;
}

.login-page__form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #2f7dff inset;
}

.login-page__form :deep(.el-input__inner) {
  color: #333333;
  font-size: 14px;
}

.login-page__form :deep(.el-input__inner::placeholder) {
  color: #777777;
}

.login-page__form :deep(.el-input__prefix) {
  margin-right: 4px;
  color: #88c9e9;
  font-size: 17px;
}

.login-page__captcha-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 86px;
  gap: 8px;
}

.login-page__captcha-field {
  min-width: 0;
}

.login-page__captcha-image {
  position: relative;
  min-width: 0;
  height: 40px;
  overflow: hidden;
  border: 1px solid #d7d7d7;
  border-radius: 25px;
  background:
    repeating-linear-gradient(
      -12deg,
      rgba(205, 80, 108, 0.16) 0 2px,
      transparent 2px 12px
    ),
    rgba(255, 255, 255, 0.58);
  cursor: pointer;
}

.login-page__captcha-image::before,
.login-page__captcha-image::after {
  position: absolute;
  inset: auto 14px 26px;
  height: 1px;
  content: "";
  background: rgba(197, 76, 106, 0.45);
  transform: rotate(-10deg);
}

.login-page__captcha-image::after {
  inset: 30px 18px auto;
  background: rgba(97, 142, 115, 0.38);
  transform: rotate(9deg);
}

.login-page__captcha-image span {
  position: relative;
  z-index: 1;
  display: inline-block;
  color: rgba(178, 78, 105, 0.6);
  font-family: "Times New Roman", serif;
  font-size: 20px;
  font-style: italic;
  font-weight: 700;
  letter-spacing: 0;
  transform: rotate(-6deg);
}

.login-page__remember {
  align-self: flex-start;
  margin: -4px 0 0 10px;
  height: 18px;
}

.login-page__remember :deep(.el-checkbox__label) {
  color: #666666;
  font-size: 12px;
}

.login-page__captcha {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 10px;
  width: 100%;
}

.login-page__captcha-image {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 112px;
  height: 40px;
  padding: 0;
  overflow: hidden;
  color: var(--bq-color-primary);
  background: #f5f8fc;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-control);
  cursor: pointer;
}

.login-page__captcha-image:disabled {
  cursor: wait;
  opacity: 0.72;
}

.login-page__captcha-image img {
  display: block;
  width: 112px;
  height: 40px;
}

.login-page__submit {
  width: 100%;
  min-height: 40px;
  margin-top: 0;
  border: 0;
  border-radius: 25px;
  background: #007aff;
  font-size: 15px;
  font-weight: 400;
  color: white;
}

.login-page__submit:hover,
.login-page__submit:focus {
  background: #1f73ff;
}

@media (max-width: 1200px) {
  .login-page {
    display: grid;
    place-items: center;
    padding: 128px 24px 40px;
    background-position: 43% center;
  }

  .login-page__panel {
    position: relative;
    top: auto;
    right: auto;
    height: auto;
    width: min(380px, 100%);
    padding: 34px 26px 38px;
    transform: none;
  }
}

@media (max-width: 640px) {
  .login-page {
    padding: 112px 16px 28px;
    background-position: 35% center;
  }

  .login-page__brand {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .login-page__brand-logo {
    width: 112px;
  }

  .login-page__brand-title {
    width: min(268px, calc(100vw - 48px));
  }

  .login-page__panel {
    width: min(100%, 420px);
    min-height: auto;
    padding: 34px 24px;
    border-radius: 22px;
  }

  .login-page__panel h1 {
    width: 100%;
    margin-bottom: 24px;
    font-size: 34px;
  }

  .login-page__form {
    width: 100%;
    gap: 16px;
  }

  .login-page__form :deep(.el-input__wrapper),
  .login-page__captcha-image,
  .login-page__submit {
    min-height: 40px;
    height: 40px;
    border-radius: 20px;
  }

  .login-page__captcha-row {
    grid-template-columns: minmax(0, 1fr) 86px;
    gap: 8px;
  }

  .login-page__captcha-image span {
    font-size: 24px;
  }

  .login-page__submit {
    font-size: 20px;
  }
}
</style>
