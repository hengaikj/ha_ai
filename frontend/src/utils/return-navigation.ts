import type { RouteLocationNormalizedLoaded, Router } from "vue-router";

export function resolveReturnPath(
  route: Pick<RouteLocationNormalizedLoaded, "query">,
  fallback: string,
): string {
  const returnPath = route.query.returnPath;
  if (typeof returnPath === "string" && returnPath.startsWith("/")) {
    return returnPath;
  }
  return fallback;
}

export function replaceToReturn(
  router: Router,
  route: Pick<RouteLocationNormalizedLoaded, "query">,
  fallback: string,
): void {
  void router.replace(resolveReturnPath(route, fallback));
}
