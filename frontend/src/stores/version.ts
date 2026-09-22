import { defineStore } from "pinia";
import { ref } from "vue";

// 系统版本状态管理
export const useVersionStore = defineStore("version", () => {
  // 当前运行的前端版本号（构建时注入，未定义时兜底为空字符串）
  const currentVersion = ref<string>(
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "",
  );
  // 是否已弹出更新提示（避免重复提示）
  const hasNotified = ref<boolean>(false);

  // 设置当前版本号
  function setVersion(version: string) {
    currentVersion.value = version;
  }

  // 标记已提示过更新
  function markNotified() {
    hasNotified.value = true;
  }

  return {
    currentVersion,
    hasNotified,
    setVersion,
    markNotified,
  };
});
