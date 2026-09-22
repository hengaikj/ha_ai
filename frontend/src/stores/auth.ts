import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  fetchCurrentMenus,
  fetchCurrentUser,
  login,
  logout,
  mapCurrentUser,
} from "@/api/auth";
import { ApiBusinessError } from "@/api/http";
import { fetchPlatformSystemConfigValue } from "@/api/platform-system";
import {
  PAGE_FULLSCREEN_CONFIG_KEY,
  WATERMARK_CONFIG_KEY,
  TAGS_VIEW_CONFIG_KEY,
  configureFeatureFlags,
  resetFeatureFlags,
} from "@/config/features";
import { setContentGuardEnabled } from "@/plugins/contentGuard";
import { useTagsViewStore } from "@/stores/tags-view";
import type { CurrentUser, LoginRequest, MenuNode } from "@/types/auth";
import { canAccessPermission, hasSuperAdminRole } from "@/utils/permission";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/utils/token";

const CONTENT_GUARD_CONFIG_KEY = "sys.content.guard.enabled";
const CONTENT_GUARD_FALLBACK = import.meta.env.VITE_CONTENT_GUARD ?? false;

export const useAuthStore = defineStore("auth", () => {
  const tagsViewStore = useTagsViewStore();
  const token = ref<string | null>(getAccessToken());
  const currentUser = ref<CurrentUser | null>(null);
  const menus = ref<MenuNode[]>([]);
  const dynamicRoutesLoaded = ref(false);
  const dynamicRouteNames = ref<string[]>([]);
  const loading = ref(false);

  const isAuthenticated = computed(() => Boolean(token.value));
  const permissions = computed(() => currentUser.value?.permissions ?? []);
  const isSuperAdmin = computed(() =>
    hasSuperAdminRole(currentUser.value?.roles ?? []),
  );

  async function signIn(payload: LoginRequest): Promise<void> {
    loading.value = true;
    tagsViewStore.clearViews();
    token.value = null;
    currentUser.value = null;
    menus.value = [];
    dynamicRoutesLoaded.value = false;
    dynamicRouteNames.value = [];
    clearAccessToken();
    setContentGuardEnabled(false);
    resetFeatureFlags();
    try {
      const normalizedPayload: LoginRequest = {
        ...payload,
        username: payload.username.trim(),
      };
      const loginResult = await login(normalizedPayload);
      token.value = loginResult.accessToken;
      setAccessToken(loginResult.accessToken);
      if (loginResult.user) {
        currentUser.value = mapCurrentUser(loginResult.user);
      }
      await loadAuthContext();
    } finally {
      loading.value = false;
    }
  }

  async function signOut(): Promise<void> {
    try {
      if (token.value) {
        await logout();
      }
    } finally {
      expireSession();
    }
  }

  function expireSession(): string[] {
    const routeNames = [...dynamicRouteNames.value];
    tagsViewStore.clearViews();
    token.value = null;
    currentUser.value = null;
    menus.value = [];
    dynamicRoutesLoaded.value = false;
    dynamicRouteNames.value = [];
    clearAccessToken();
    setContentGuardEnabled(false);
    return routeNames;
  }

  async function syncContentGuardSetting(): Promise<void> {
    try {
      const enabled = await fetchPlatformSystemConfigValue(
        CONTENT_GUARD_CONFIG_KEY,
      );
      setContentGuardEnabled(enabled ?? CONTENT_GUARD_FALLBACK);
    } catch {
      setContentGuardEnabled(CONTENT_GUARD_FALLBACK);
    }
  }

  async function syncFeatureFlags(): Promise<void> {
    try {
      const [tagsViewEnabled, pageFullscreenEnabled, watermarkEnabled] =
        await Promise.all([
          fetchPlatformSystemConfigValue(TAGS_VIEW_CONFIG_KEY),
          fetchPlatformSystemConfigValue(PAGE_FULLSCREEN_CONFIG_KEY),
          fetchPlatformSystemConfigValue(WATERMARK_CONFIG_KEY),
        ]);
      configureFeatureFlags({
        tagsViewEnabled,
        pageFullscreenEnabled,
        watermarkEnabled,
      });
    } catch {
      resetFeatureFlags();
    }
  }

  async function loadAuthContext(): Promise<void> {
    if (!token.value) {
      return;
    }

    try {
      // 先确认 token 仍然有效，避免失效会话同时请求多个受保护接口。
      const userResult = await fetchCurrentUser();
      const menuResult = await fetchCurrentMenus();
      currentUser.value = userResult;
      menus.value = menuResult;
      await syncContentGuardSetting();
      await syncFeatureFlags();
    } catch (unknownError) {
      if (
        unknownError instanceof ApiBusinessError &&
        ["401", "110001", "110004", "110005"].includes(unknownError.code)
      ) {
        expireSession();
      }
      throw unknownError;
    }
  }

  function hasPermission(permissionCode?: string | string[]): boolean {
    return canAccessPermission(
      permissions.value,
      permissionCode,
      currentUser.value?.roles ?? [],
    );
  }

  function markDynamicRoutesLoaded(routeNames: string[]): void {
    dynamicRouteNames.value = routeNames;
    dynamicRoutesLoaded.value = true;
  }

  function clearDynamicRoutes(): string[] {
    const routeNames = [...dynamicRouteNames.value];
    dynamicRouteNames.value = [];
    dynamicRoutesLoaded.value = false;
    return routeNames;
  }

  return {
    token,
    currentUser,
    menus,
    dynamicRoutesLoaded,
    dynamicRouteNames,
    loading,
    isAuthenticated,
    isSuperAdmin,
    permissions,
    signIn,
    signOut,
    expireSession,
    loadAuthContext,
    hasPermission,
    markDynamicRoutesLoaded,
    clearDynamicRoutes,
  };
});
