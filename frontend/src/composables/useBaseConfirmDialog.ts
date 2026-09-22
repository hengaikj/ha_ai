import { reactive } from "vue";

export type BaseConfirmType = "default" | "warning" | "danger";

export type BaseConfirmScene =
  | "delete"
  | "batchDelete"
  | "clear"
  | "save"
  | "submit"
  | "reject"
  | "withdraw"
  | "void"
  | "enable"
  | "disable"
  | "lock"
  | "unlock"
  | "overwrite"
  | "generateVersion"
  | "publish"
  | "unsavedLeave"
  | "unsavedSubmit";

export type BaseConfirmOptions = {
  scene?: BaseConfirmScene;
  title?: string;
  message?: string;
  type?: BaseConfirmType;
  object?: string;
  name?: string | number;
  count?: number;
  source?: string;
  target?: string;
  nextStatus?: string;
  targetStatus?: string;
  confirmText?: string;
  cancelText?: string;
  successMessage?: string;
};

type PendingConfirm = {
  resolve: () => void;
  reject: () => void;
};

type BaseConfirmContent = {
  title: string;
  message: string;
  type: BaseConfirmType;
  confirmText: string;
  cancelText: string;
  successMessage: string;
};

const DEFAULT_OBJECT = "数据";

function withName(name?: string | number) {
  return name === undefined || name === null || name === "" ? "" : `“${name}”`;
}

function buildSceneContent(options: BaseConfirmOptions): BaseConfirmContent {
  const object = options.object ?? DEFAULT_OBJECT;
  const objectWithName = `${object}${withName(options.name)}`;
  const count = options.count ?? "{数量}";
  const source = options.source ?? "{来源}";
  const target = options.target ?? "{目标}";
  const nextStatus = options.nextStatus ?? "{下一状态}";
  const targetStatus = options.targetStatus ?? "{目标状态}";

  switch (options.scene) {
    case "delete":
      return {
        title: "删除确认",
        message: `确认删除${objectWithName}吗？删除后不可恢复。`,
        type: "danger",
        confirmText: "删除",
        cancelText: "取消",
        successMessage: `${object}已删除`,
      };
    case "batchDelete":
      return {
        title: "批量删除确认",
        message: `确认删除所选${count}项${object}吗？删除后不可恢复。`,
        type: "danger",
        confirmText: "删除",
        cancelText: "取消",
        successMessage: `已删除${count}项${object}`,
      };
    case "clear":
      return {
        title: "清空确认",
        message: `确认清空全部${object}吗？清空后不可恢复。`,
        type: "danger",
        confirmText: "清空",
        cancelText: "取消",
        successMessage: `${object}已清空`,
      };
    case "save":
      return {
        title: "保存提示",
        message: "普通保存不使用二次确认。",
        type: "default",
        confirmText: "保存",
        cancelText: "取消",
        successMessage: `${object}已保存`,
      };
    case "submit":
      return {
        title: "提交确认",
        message: `确认提交${object}吗？提交后将进入${nextStatus}。`,
        type: "warning",
        confirmText: "确认提交",
        cancelText: "取消",
        successMessage: `${object}已提交`,
      };
    case "reject":
      return {
        title: `驳回${object}`,
        message: `确认驳回${objectWithName}吗？`,
        type: "warning",
        confirmText: "确认驳回",
        cancelText: "取消",
        successMessage: `${object}已驳回`,
      };
    case "withdraw":
      return {
        title: "撤回确认",
        message: `确认撤回${objectWithName}吗？撤回后将返回${targetStatus}。`,
        type: "warning",
        confirmText: "确认撤回",
        cancelText: "取消",
        successMessage: `${object}已撤回`,
      };
    case "void":
      return {
        title: "作废确认",
        message: `确认作废${objectWithName}吗？作废后不可恢复。`,
        type: "danger",
        confirmText: "作废",
        cancelText: "取消",
        successMessage: `${object}已作废`,
      };
    case "enable":
      return {
        title: "启用确认",
        message: `确认启用${objectWithName}吗？`,
        type: "warning",
        confirmText: "启用",
        cancelText: "取消",
        successMessage: `${object}已启用`,
      };
    case "disable":
      return {
        title: "停用确认",
        message: `确认停用${objectWithName}吗？停用后将不可使用。`,
        type: "warning",
        confirmText: "停用",
        cancelText: "取消",
        successMessage: `${object}已停用`,
      };
    case "lock":
      return {
        title: "锁定确认",
        message: `确认锁定${objectWithName}吗？锁定后不可编辑、导入或删除。`,
        type: "warning",
        confirmText: "锁定",
        cancelText: "取消",
        successMessage: `${object}已锁定`,
      };
    case "unlock":
      return {
        title: "解锁确认",
        message: `确认解锁${objectWithName}吗？解锁后可继续编辑。`,
        type: "warning",
        confirmText: "解锁",
        cancelText: "取消",
        successMessage: `${object}已解锁`,
      };
    case "overwrite":
      return {
        title: "覆盖确认",
        message: `${source}将覆盖${target}的${object}数据，确认继续吗？`,
        type: "danger",
        confirmText: "确认覆盖",
        cancelText: "取消",
        successMessage: `${object}已覆盖更新`,
      };
    case "generateVersion":
      return {
        title: "生成新版本确认",
        message: `将基于当前${object}生成新版本，当前版本保留不变，确认继续吗？`,
        type: "warning",
        confirmText: "生成新版本",
        cancelText: "取消",
        successMessage: `已生成${object}新版本`,
      };
    case "publish":
      return {
        title: "发布确认",
        message: `确认发布${objectWithName}吗？发布后将进入${nextStatus}。`,
        type: "warning",
        confirmText: "确认发布",
        cancelText: "取消",
        successMessage: `${object}已发布`,
      };
    case "unsavedLeave":
      return {
        title: "未保存提示",
        message: `当前${object}尚未保存，是否先保存？`,
        type: "warning",
        confirmText: "保存",
        cancelText: "取消",
        successMessage: `${object}已保存`,
      };
    case "unsavedSubmit":
      return {
        title: "未保存提示",
        message: `当前${object}尚未保存，是否先保存并提交？`,
        type: "warning",
        confirmText: "保存并提交",
        cancelText: "取消",
        successMessage: `${object}已提交`,
      };
    default:
      return {
        title: "",
        message: "",
        type: "warning",
        confirmText: "确认",
        cancelText: "取消",
        successMessage: "",
      };
  }
}

export function buildBaseConfirmContent(
  options: BaseConfirmOptions,
): BaseConfirmContent {
  const sceneContent = buildSceneContent(options);

  return {
    title: options.title ?? sceneContent.title,
    message: options.message ?? sceneContent.message,
    type: options.type ?? sceneContent.type,
    confirmText: options.confirmText ?? sceneContent.confirmText,
    cancelText: options.cancelText ?? sceneContent.cancelText,
    successMessage: options.successMessage ?? sceneContent.successMessage,
  };
}

export function useBaseConfirmDialog() {
  const confirmState = reactive({
    visible: false,
    title: "",
    message: "",
    type: "warning" as BaseConfirmType,
    confirmText: "确认",
    cancelText: "取消",
    successMessage: "",
    loading: false,
  });
  let pendingConfirm: PendingConfirm | null = null;

  function openConfirm(options: BaseConfirmOptions) {
    const content = buildBaseConfirmContent(options);
    confirmState.title = content.title;
    confirmState.message = content.message;
    confirmState.type = content.type;
    confirmState.confirmText = content.confirmText;
    confirmState.cancelText = content.cancelText;
    confirmState.successMessage = content.successMessage;
    confirmState.visible = true;

    return new Promise<void>((resolve, reject) => {
      pendingConfirm = { resolve, reject };
    });
  }

  function resolveConfirm() {
    pendingConfirm?.resolve();
    pendingConfirm = null;
    confirmState.visible = false;
  }

  function rejectConfirm() {
    pendingConfirm?.reject();
    pendingConfirm = null;
    confirmState.visible = false;
  }

  return {
    confirmState,
    openConfirm,
    resolveConfirm,
    rejectConfirm,
  };
}
