import { ElButton, ElNotification } from "element-plus";
import { h } from "vue";
import { useVersionStore } from "@/stores/version";

// 轮询定时器引用
let timer: ReturnType<typeof setInterval> | null = null;

// 获取线上最新版本号
async function fetchRemoteVersion(): Promise<string | null> {
  try {
    // 携带时间戳参数并禁用缓存，防止命中浏览器或 CDN 缓存
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data?.version ? String(data.version) : null;
  } catch {
    // 网络波动或服务异常时静默处理
    return null;
  }
}

// 弹出更新提示通知
function notifyUpdate() {
  ElNotification({
    title: "系统更新提醒",
    message: h("div", null, [
      h(
        "p",
        { style: "margin: 0 0 8px 0;" },
        "检测到系统有新版本发布，建议刷新以使用最新功能。",
      ),
      h(
        ElButton,
        {
          type: "primary",
          size: "small",
          onClick: () => {
            window.location.reload();
          },
        },
        () => "立即刷新",
      ),
    ]),
    type: "info",
    duration: 0,
    position: "top-right",
  });
}

// 页面可见性改变时的回调函数
function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    checkVersionUpdate();
  }
}

// 停止所有检测逻辑并解绑事件监听
export function stopVersionChecker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  document.removeEventListener("visibilitychange", handleVisibilityChange);
}

// 执行版本对比检测
export async function checkVersionUpdate() {
  // 开发环境下不进行版本检测（测试环境下允许执行）
  if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
    return;
  }

  const versionStore = useVersionStore();

  // 如果已经提示过，彻底清理并直接返回
  if (versionStore.hasNotified) {
    stopVersionChecker();
    return;
  }

  const remoteVersion = await fetchRemoteVersion();
  // 若获取失败或本地尚未注入版本号，则不进行比对
  if (!remoteVersion || !versionStore.currentVersion) {
    return;
  }

  // 若版本不一致，提示用户并停止轮询与事件监听
  if (remoteVersion !== versionStore.currentVersion) {
    versionStore.markNotified();
    stopVersionChecker();
    notifyUpdate();
  }
}

// 监听 Vite 动态导入懒加载资源失败事件（重新打包部署后旧模块 404）
export function setupPreloadErrorHandler() {
  window.addEventListener("vite:preloadError", (event) => {
    // 阻止浏览器默认抛错
    event.preventDefault();

    // 防循环刷新：若 10 秒内已触发过自动重载，则不再自动刷新
    const lastReloadTime = Number(
      sessionStorage.getItem("vite_preload_reload_time") || "0",
    );
    const now = Date.now();
    if (now - lastReloadTime < 10000) {
      return;
    }

    sessionStorage.setItem("vite_preload_reload_time", String(now));
    window.location.reload();
  });
}

// 初始化版本检测机制
export function initVersionChecker() {
  // 开发环境直接跳过（测试环境下允许执行）
  if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
    return;
  }

  // 1. 注册 Vite 懒加载模块 404 自动刷新机制
  setupPreloadErrorHandler();

  // 2. 每隔 1 分钟检测一次
  timer = setInterval(checkVersionUpdate, 60 * 1000);

  // 3. 用户从其他标签页切回当前系统时立即检测一次
  document.addEventListener("visibilitychange", handleVisibilityChange);
}



