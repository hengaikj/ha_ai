import { reactive } from "vue";

export type BasePromptOptions = {
  title: string;
  label: string;
  initialValue?: string | number | null;
  placeholder?: string;
  inputType?: "text" | "textarea";
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  validator?: (value: string) => true | string | boolean;
};

type PendingPrompt = {
  resolve: (value: string) => void;
  reject: () => void;
};

export function useBasePromptDialog() {
  const promptState = reactive({
    visible: false,
    title: "",
    label: "",
    value: "",
    placeholder: "",
    inputType: "text" as "text" | "textarea",
    confirmText: "确定",
    cancelText: "取消",
    error: "",
    loading: false,
    required: true,
  });
  let pendingPrompt: PendingPrompt | null = null;
  let validator: BasePromptOptions["validator"] | null = null;

  function openPrompt(options: BasePromptOptions) {
    promptState.title = options.title;
    promptState.label = options.label;
    promptState.value =
      options.initialValue === undefined || options.initialValue === null
        ? ""
        : String(options.initialValue);
    promptState.placeholder = options.placeholder ?? "";
    promptState.inputType = options.inputType ?? "text";
    promptState.confirmText = options.confirmText ?? "确定";
    promptState.cancelText = options.cancelText ?? "取消";
    promptState.required = options.required ?? true;
    promptState.error = "";
    promptState.loading = false;
    promptState.visible = true;
    validator = options.validator ?? null;

    return new Promise<string>((resolve, reject) => {
      pendingPrompt = { resolve, reject };
    });
  }

  function resolvePrompt() {
    const value = promptState.value.trim();
    if (promptState.required && !value) {
      promptState.error = "请输入内容";
      return;
    }
    const validateResult = validator?.(value);
    if (typeof validateResult === "string") {
      promptState.error = validateResult;
      return;
    }
    if (validateResult === false) {
      promptState.error = "输入内容不符合要求";
      return;
    }
    pendingPrompt?.resolve(value);
    pendingPrompt = null;
    validator = null;
    promptState.visible = false;
  }

  function rejectPrompt() {
    pendingPrompt?.reject();
    pendingPrompt = null;
    validator = null;
    promptState.visible = false;
  }

  return {
    promptState,
    openPrompt,
    resolvePrompt,
    rejectPrompt,
  };
}
