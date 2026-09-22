import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

const legacyDashboardFiles = [
  "/src/pages/legacy-dashboard/PurchaseDashboardPage.vue",
];

function legacyDashboardViewportPlugin() {
  return {
    postcssPlugin: "legacy-dashboard-px-to-vw",
    Once(root: { walkDecls: (callback: (decl: { value: string }) => void) => void }, { result }: { result: { opts: { from?: string } } }) {
      const sourceFile = (result.opts.from || "")
        .split(/[?#]/, 1)[0]
        .replace(/\\/g, "/");
      if (!legacyDashboardFiles.some((file) => sourceFile.includes(file))) {
        return;
      }

      root.walkDecls((decl) => {
        decl.value = decl.value.replace(/(-?\d*\.?\d+)px\b/g, (match, rawValue) => {
          const value = Number(rawValue);
          if (!Number.isFinite(value) || Math.abs(value) <= 1) {
            return match;
          }

          const viewportValue = (value / 1920) * 100;
          return `${Number(viewportValue.toFixed(5))}vw`;
        });
      });
    },
  };
}

// 本次构建的版本标识（时间戳）
const buildVersion = Date.now().toString();

// 打包时在根目录生成 version.json 的轻量插件
function versionPlugin() {
  return {
    name: "vite-plugin-version",
    generateBundle(this: { emitFile: (data: { type: "asset"; fileName: string; source: string }) => void }) {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: buildVersion }, null, 2),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget =
    env.VITE_API_PROXY_TARGET || "http://127.0.0.1:18080";

  return {
    define: {
      // 编译期注入构建版本号，代码中直接可用
      __APP_VERSION__: JSON.stringify(buildVersion),
    },
    plugins: [vue(), versionPlugin()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      proxy: {
        // 收益管理服务独立代理（需放在 /api 之前，优先匹配）
        "/prod-revenue-api": {
          // 本地联调：指向本机 revenue-management（7083）
          target: "http://127.0.0.1:7083",
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              const auth = req.headers?.authorization;
              if (auth) {
                proxyReq.setHeader("Authorization", auth);
              }
            });
          },
        },
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
        },
        "/v3": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    css: {
      postcss: {
        plugins: [legacyDashboardViewportPlugin()],
      },
      preprocessorOptions: {
        // sass 1.101 默认使用 modern API（legacy API 已移除），无需显式声明 api
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
