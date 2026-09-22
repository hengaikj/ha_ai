import { ref } from "vue";

export const TAGS_VIEW_CONFIG_KEY = "VITE_ENABLE_TAGS_VIEW";
export const PAGE_FULLSCREEN_CONFIG_KEY = "VITE_ENABLE_PAGE_FULLSCREEN";
export const WATERMARK_CONFIG_KEY = "VITE_ENABLE_WATERMARK";

// Keep defaults so the layout remains usable before the backend settings load.
export const isTagsViewEnabled = ref(false);
export const isPageFullscreenEnabled = ref(true);
export const isWatermarkEnabled = ref(true);

export function configureFeatureFlags(values: {
  tagsViewEnabled?: string;
  pageFullscreenEnabled?: string;
  watermarkEnabled?: string;
}): void {
  if (values.tagsViewEnabled !== undefined) {
    isTagsViewEnabled.value = values.tagsViewEnabled === "true";
  }
  if (values.pageFullscreenEnabled !== undefined) {
    isPageFullscreenEnabled.value = values.pageFullscreenEnabled !== "false";
  }
  if (values.watermarkEnabled !== undefined) {
    isWatermarkEnabled.value = values.watermarkEnabled === "true";
  }
}

export function resetFeatureFlags(): void {
  isTagsViewEnabled.value = false;
  isPageFullscreenEnabled.value = true;
  isWatermarkEnabled.value = true;
}
