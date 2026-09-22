import { defineStore } from "pinia";
import { markRaw } from "vue";
import { createMockManagementData } from "@/api/ai/mock";

// 仅驻留当前应用内存；路由切换共享项目和密钥，刷新页面重新初始化。
export const useAiDemoStore = defineStore("ai-demo", () => {
  const data = markRaw(createMockManagementData());
  return { data };
});
