import type { Pinia } from "pinia";
import type { Router } from "vue-router";
import { removeDynamicRoutes } from "@/router/dynamic-routes";
import { useAuthStore } from "@/stores/auth";
import { onSessionExpired } from "@/utils/session-expiration";

export function setupSessionExpirationHandling(
  pinia: Pinia,
  router: Router,
): () => void {
  return onSessionExpired(async () => {
    const authStore = useAuthStore(pinia);
    removeDynamicRoutes(router, authStore.expireSession());

    if (router.currentRoute.value.name === "login") {
      return;
    }

    const redirect = router.currentRoute.value.fullPath;
    await router.replace({
      name: "login",
      query: redirect && redirect !== "/login" ? { redirect } : undefined,
    });
  });
}
