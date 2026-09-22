import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import type { RouteLocationNormalized } from "vue-router";

export type TagView = {
  key: string;
  fullPath: string;
  routeName: string;
  title: string;
  affix: boolean;
};

const TAGS_VIEW_STORAGE_KEY = "bq.tags-view.visited-views";

function isHomeView(view: Pick<TagView, "fullPath" | "routeName">): boolean {
  try {
    const path = new URL(view.fullPath, "http://localhost").pathname.replace(
      /\/$/,
      "",
    );
    return path === "" || view.routeName === "dashboard";
  } catch {
    return view.routeName === "dashboard";
  }
}

function pinHomeView(views: TagView[]): TagView[] {
  const homeView = views.find(isHomeView);
  if (!homeView) return views;

  return [
    { ...homeView, affix: true },
    ...views.filter((view) => !isHomeView(view)),
  ];
}

function isCostHistoryListView(view: Pick<TagView, "fullPath">): boolean {
  try {
    const path = new URL(view.fullPath, "http://localhost").pathname.replace(
      /\/$/,
      "",
    );
    return (
      path === "/cost/research/history" ||
      path === "/cost/research/new-history" ||
      path === "/costmanagementnew/costbomshree" ||
      path === "/costmanagementnew/zy/costbom" ||
      path === "/costmanagementnew/zy/costbomshree"
    );
  } catch {
    return false;
  }
}

function isCostAnalysisView(view: Pick<TagView, "fullPath"> & { routeName?: string }): boolean {
  if (view.routeName === "costAnalysis") return true;
  try {
    const path = new URL(view.fullPath, "http://localhost").pathname.replace(
      /\/$/,
      "",
    );
    return path === "/cost/analysis" || path === "/costmanagementnew/analyze";
  } catch {
    return false;
  }
}

function deduplicateCostAnalysisViews(views: TagView[]): TagView[] {
  let hasAnalysis = false;
  const result: TagView[] = [];
  for (let i = views.length - 1; i >= 0; i--) {
    const v = views[i];
    if (isCostAnalysisView(v)) {
      if (!hasAnalysis) {
        hasAnalysis = true;
        result.unshift(v);
      }
    } else {
      result.unshift(v);
    }
  }
  return result;
}

function readPersistedViews(): TagView[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(TAGS_VIEW_STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return pinHomeView(
      deduplicateCostAnalysisViews(
        value.filter(
          (item): item is TagView =>
            !!item &&
            typeof item === "object" &&
            typeof item.key === "string" &&
            typeof item.fullPath === "string" &&
            typeof item.routeName === "string" &&
            typeof item.title === "string" &&
            typeof item.affix === "boolean",
        ),
      ),
    );
  } catch {
    return [];
  }
}

export const useTagsViewStore = defineStore("tags-view", () => {
  const visitedViews = ref<TagView[]>(pinHomeView(readPersistedViews()));
  const pendingMenuPath = ref("");

  watch(
    visitedViews,
    (views) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          TAGS_VIEW_STORAGE_KEY,
          JSON.stringify(views),
        );
      } catch {
        // Storage can be unavailable in private or restricted browser contexts.
      }
    },
    { deep: true },
  );

  function markMenuNavigation(path: string): void {
    pendingMenuPath.value = path;
  }

  function consumeMenuNavigation(path: string): boolean {
    if (pendingMenuPath.value !== path) return false;
    pendingMenuPath.value = "";
    return true;
  }

  function addView(route: RouteLocationNormalized): void {
    const title = String(route.meta.title ?? "");
    if (!route.name || !title) return;

    const key = route.fullPath;
    visitedViews.value = pinHomeView(visitedViews.value);
    if (isCostHistoryListView({ fullPath: route.fullPath })) {
      visitedViews.value = visitedViews.value.filter(
        (view) => view.key === key || !isCostHistoryListView(view),
      );
    }
    if (
      isCostAnalysisView({
        fullPath: route.fullPath,
        routeName: String(route.name),
      })
    ) {
      visitedViews.value = visitedViews.value.filter(
        (view) => view.key === key || !isCostAnalysisView(view),
      );
    }
    const existing = visitedViews.value.find((view) => view.key === key);
    if (existing) return;

    // 旧版和新版成本履历共用同一个菜单标题，不能同时出现在标签栏。
    // 保留当前实际打开的地址，避免从详情页返回后留下两个“成本履历”。
    const view = {
      key,
      fullPath: route.fullPath,
      routeName: String(route.name),
      title,
      affix: route.path === "/" || route.name === "dashboard",
    } satisfies TagView;

    if (isHomeView(view)) {
      visitedViews.value = pinHomeView([
        view,
        ...visitedViews.value.filter((item) => !isHomeView(item)),
      ]);
      return;
    }

    visitedViews.value.push(view);
  }

  function removeView(key: string): void {
    const view = visitedViews.value.find((item) => item.key === key);
    if (!view || view.affix) return;
    visitedViews.value = pinHomeView(
      visitedViews.value.filter((item) => item.key !== key),
    );
  }

  function removeViewsAfter(key: string): void {
    const targetIndex = visitedViews.value.findIndex(
      (item) => item.key === key,
    );
    if (targetIndex < 0) return;
    visitedViews.value = pinHomeView(
      visitedViews.value.filter(
        (item, index) => item.affix || index <= targetIndex,
      ),
    );
  }

  function removeOtherViews(key: string): void {
    visitedViews.value = pinHomeView(
      visitedViews.value.filter((item) => item.affix || item.key === key),
    );
  }

  function removeLeftViews(key: string): void {
    const targetIndex = visitedViews.value.findIndex(
      (item) => item.key === key,
    );
    if (targetIndex < 0) return;
    visitedViews.value = pinHomeView(
      visitedViews.value.filter(
        (item, index) => item.affix || index >= targetIndex,
      ),
    );
  }

  function removeAllViews(): void {
    visitedViews.value = pinHomeView(
      visitedViews.value.filter((item) => item.affix),
    );
  }

  function clearViews(): void {
    visitedViews.value = [];
  }

  const lastView = computed(() => visitedViews.value.at(-1));

  return {
    visitedViews,
    lastView,
    markMenuNavigation,
    consumeMenuNavigation,
    addView,
    removeView,
    removeViewsAfter,
    removeOtherViews,
    removeLeftViews,
    removeAllViews,
    clearViews,
  };
});
