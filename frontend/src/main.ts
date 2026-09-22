import { createApp } from "vue";
import ElementPlus, { ElMessageBox } from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import "element-plus/dist/index.css";
import "./styles/global.css";
import App from "./App.vue";
import { createPinia } from "pinia";
import { router } from "@/router";
import { setupSessionExpirationHandling } from "@/router/session-expiration";
import contentGuard from "@/plugins/contentGuard";

import { initVersionChecker } from "@/utils/version-check";

const pinia = createPinia();
setupSessionExpirationHandling(pinia, router);

const app = createApp(App)
  .use(pinia)
  .use(router)
  .use(contentGuard, {
    enabled: false,
  })
  .use(ElementPlus, { locale: zhCn });

// 对齐 Vue2 this.$confirm：命令式 MessageBox 必须绑到应用上下文，否则确认按钮可能关窗但不 resolve
(ElMessageBox as { _context?: typeof app._context })._context = app._context;
app.mount("#app");

// 启动系统版本更新检测
initVersionChecker();

