import { h } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

export type BaseToastType = "success" | "warning" | "error" | "info";

export interface BaseToastOptions {
  message: string;
  type?: BaseToastType;
  duration?: number;
  response?: unknown;
}

const DEFAULT_DURATION = 3000;
const ERROR_DEDUPE_MS = 1200;
let lastErrorMessage = "";
let lastErrorAt = 0;

function showToast(options: BaseToastOptions) {
  return ElMessage({
    message: options.message,
    type: options.type ?? "info",
    duration: options.duration ?? DEFAULT_DURATION,
    showClose: true,
  });
}

function formatResponse(response: unknown): string {
  if (typeof response === "string") return response;
  try {
    return JSON.stringify(response, null, 2) ?? String(response);
  } catch {
    return String(response);
  }
}

function showErrorToast(message: string, duration?: number, response?: unknown) {
  if (response === undefined) {
    return showToast({ message, type: "error", duration });
  }

  const toast = ElMessage({
    type: "error",
    duration: duration ?? DEFAULT_DURATION,
    showClose: true,
    message: h(
      "button",
      {
        type: "button",
        class: "bq-error-toast__content",
        title: "点击查看返回内容",
        onClick: (event: MouseEvent) => {
          event.stopPropagation();
          toast.close();
          void ElMessageBox.alert(formatResponse(response), "接口返回内容", {
            confirmButtonText: "关闭",
            customClass: "bq-error-response-dialog",
          });
        },
      },
      message,
    ),
  });
  return toast;
}

export const BaseToast = {
  show: showToast,
  success(message: string, duration?: number) {
    return showToast({ message, type: "success", duration });
  },
  warning(message: string, duration?: number) {
    return showToast({ message, type: "warning", duration });
  },
  error(message: string, duration?: number, response?: unknown) {
    const now = Date.now();
    if (message === lastErrorMessage && now - lastErrorAt < ERROR_DEDUPE_MS) {
      return undefined;
    }
    lastErrorMessage = message;
    lastErrorAt = now;
    return showErrorToast(message, duration, response);
  },
  info(message: string, duration?: number) {
    return showToast({ message, type: "info", duration });
  },
};
