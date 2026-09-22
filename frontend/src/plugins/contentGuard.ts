import type { App } from "vue";

const INSTALL_FLAG = "__BQ_CONTENT_GUARD_INSTALLED__";
const STYLE_ID = "bq-content-guard-style";
const BODY_CLASS = "content-guard-enabled";

type ContentGuardWindow = Window &
  typeof globalThis & {
    [INSTALL_FLAG]?: boolean;
  };

export interface ContentGuardOptions {
  enabled?: boolean | string;
  disableContextMenu?: boolean;
  disableCopy?: boolean;
  disableCut?: boolean;
  disableSelect?: boolean;
  disableShortcut?: boolean;
  allowInEditable?: boolean;
  allowSelector?: string[];
}

const defaultOptions: Required<ContentGuardOptions> = {
  enabled: true,
  disableContextMenu: true,
  disableCopy: true,
  disableCut: true,
  disableSelect: true,
  disableShortcut: true,
  allowInEditable: true,
  allowSelector: [
    "input",
    "textarea",
    "select",
    "[contenteditable='true']",
    ".ql-editor",
    ".allow-copy",
    ".el-input__inner",
    ".el-textarea__inner",
  ],
};

const blockedShortcutKeys = new Set(["a", "c", "x", "s", "p"]);
let contentGuardOptions: Required<ContentGuardOptions> = { ...defaultOptions };
let contentGuardEnabled = false;

const normalizeEnabled = (enabled: boolean | string) => {
  if (typeof enabled === "boolean") {
    return enabled;
  }

  return ["true", "1", "y", "yes", "on"].includes(
    enabled.trim().toLowerCase(),
  );
};

const getTargetElement = (target: EventTarget | null) => {
  return target instanceof Element ? target : null;
};

const isAllowedTarget = (event: Event, options: Required<ContentGuardOptions>) => {
  if (!options.allowInEditable) {
    return false;
  }

  const target = getTargetElement(event.target);
  return Boolean(target?.closest(options.allowSelector.join(",")));
};

const stopEvent = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};

export const setContentGuardEnabled = (enabled: boolean | string) => {
  contentGuardEnabled = normalizeEnabled(enabled);

  if (typeof document === "undefined") {
    return;
  }

  document.body.classList.toggle(BODY_CLASS, contentGuardEnabled);
};

const injectContentGuardStyle = () => {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
body.${BODY_CLASS} {
  user-select: none;
}

body.${BODY_CLASS} input,
body.${BODY_CLASS} textarea,
body.${BODY_CLASS} select,
body.${BODY_CLASS} [contenteditable='true'],
body.${BODY_CLASS} .ql-editor,
body.${BODY_CLASS} .allow-copy,
body.${BODY_CLASS} .el-input__inner,
body.${BODY_CLASS} .el-textarea__inner {
  user-select: text;
}
`;
  document.head.appendChild(style);
};

const installContentGuard = (rawOptions: ContentGuardOptions = {}) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const guardWindow = window as ContentGuardWindow;
  if (guardWindow[INSTALL_FLAG]) {
    return;
  }

  contentGuardOptions = {
    ...defaultOptions,
    ...rawOptions,
    enabled: rawOptions.enabled ?? defaultOptions.enabled,
    disableContextMenu: rawOptions.disableContextMenu ?? defaultOptions.disableContextMenu,
    disableCopy: rawOptions.disableCopy ?? defaultOptions.disableCopy,
    disableCut: rawOptions.disableCut ?? defaultOptions.disableCut,
    disableSelect: rawOptions.disableSelect ?? defaultOptions.disableSelect,
    disableShortcut: rawOptions.disableShortcut ?? defaultOptions.disableShortcut,
    allowInEditable: rawOptions.allowInEditable ?? defaultOptions.allowInEditable,
    allowSelector: rawOptions.allowSelector ?? defaultOptions.allowSelector,
  };

  guardWindow[INSTALL_FLAG] = true;
  injectContentGuardStyle();
  setContentGuardEnabled(contentGuardOptions.enabled);

  const guardedEventOptions = { capture: true };
  const guardEditableEvent = (event: Event) => {
    if (
      !contentGuardEnabled ||
      isAllowedTarget(event, contentGuardOptions)
    ) {
      return;
    }

    stopEvent(event);
  };

  if (contentGuardOptions.disableContextMenu) {
    document.addEventListener("contextmenu", guardEditableEvent, guardedEventOptions);
  }

  if (contentGuardOptions.disableCopy) {
    document.addEventListener("copy", guardEditableEvent, guardedEventOptions);
  }

  if (contentGuardOptions.disableCut) {
    document.addEventListener("cut", guardEditableEvent, guardedEventOptions);
  }

  if (contentGuardOptions.disableSelect) {
    document.addEventListener("selectstart", guardEditableEvent, guardedEventOptions);
  }

  if (contentGuardOptions.disableShortcut) {
    document.addEventListener(
      "keydown",
      (event) => {
        const keyboardEvent = event as KeyboardEvent;
        const isModifierPressed = keyboardEvent.ctrlKey || keyboardEvent.metaKey;
        const key = keyboardEvent.key?.toLowerCase?.() ?? "";

        if (
          !contentGuardEnabled ||
          !isModifierPressed ||
          !blockedShortcutKeys.has(key) ||
          isAllowedTarget(event, contentGuardOptions)
        ) {
          return;
        }

        stopEvent(event);
      },
      guardedEventOptions,
    );
  }
};

export default {
  install(_app: App, options?: ContentGuardOptions) {
    installContentGuard(options);
  },
};
