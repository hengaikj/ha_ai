<script setup lang="ts">
import { computed, useAttrs } from "vue";
import type { Component } from "vue";
import {
  CircleCheck,
  CircleClose,
  Clock,
  Coin,
  CopyDocument,
  Delete,
  Download,
  EditPen,
  Files,
  Key,
  Lock,
  Operation,
  Plus,
  Promotion,
  RefreshRight,
  SwitchButton,
  Tickets,
  Unlock,
  Upload,
  View,
} from "@element-plus/icons-vue";
import { useAuthStore } from "@/stores/auth";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    permission?: string | string[];
    disabledReason?: string;
    type?: "primary" | "success" | "warning" | "danger" | "info" | "default";
    variant?: "default" | "primary" | "secondary" | "danger";
  }>(),
  {
    permission: undefined,
    type: "default",
    variant: "default",
    disabledReason: "无权限执行当前操作",
  },
);

const authStore = useAuthStore();
const attrs = useAttrs();
const allowed = computed(() => authStore.hasPermission(props.permission));

const actionIconRules: Array<[RegExp, Component]> = [
  [/(^|:)(add|create|new)($|:)/, Plus],
  [/(^|:)(edit|update)($|:)/, EditPen],
  [/(^|:)(remove|delete)($|:)/, Delete],
  [/(^|:)(view|detail|list)($|:)/, View],
  [/(^|:)(history|version)($|:)/, Clock],
  [/(^|:)(lock)($|:)/, Lock],
  [/(^|:)(unlock)($|:)/, Unlock],
  [/(^|:)(enable|disable|toggle|status)($|:)/, SwitchButton],
  [/(^|:)(import|upload)($|:)/, Upload],
  [/(^|:)(export|download|template)($|:)/, Download],
  [/(^|:)(copy|duplicate)($|:)/, CopyDocument],
  [/(^|:)(grant|permission|resetpwd|reset-password)($|:)/, Key],
  [/(^|:)(security|security-detail)($|:)/, Lock],
  [/(^|:)(calculate|calc)($|:)/, Operation],
  [/(^|:)(refresh|sync)($|:)/, RefreshRight],
  [/(^|:)(gate-action|pass-status|submit)($|:)/, Promotion],
  [/(^|:)(compare)($|:)/, Coin],
  [/(^|:)(report)($|:)/, Tickets],
  [/(^|:)(attachment|attachments|file)($|:)/, Files],
  [/(^|:)(revoke|offline)($|:)/, CircleClose],
  [/(^|:)(confirm|save)($|:)/, CircleCheck],
];

function resolveActionIcon(
  permission?: string | string[],
): Component | undefined {
  const source = Array.isArray(permission) ? permission.join(":") : permission;
  if (!source) {
    return undefined;
  }
  const normalized = source.toLowerCase();
  return actionIconRules.find(([pattern]) => pattern.test(normalized))?.[1];
}

const buttonAttrs = computed(() => {
  const { text, link, ...restAttrs } = attrs;
  const normalizedAttrs: Record<string, unknown> = { ...restAttrs };
  const isLinkButton = link === "" || link === true;
  const isTextButton = text === "" || text === true;
  const icon = resolveActionIcon(props.permission);

  if (props.variant !== "default" && !isLinkButton && !isTextButton) {
    delete normalizedAttrs.plain;
  }

  if (
    !("icon" in normalizedAttrs) &&
    !isLinkButton &&
    !isTextButton &&
    icon
  ) {
    normalizedAttrs.icon = icon;
  }

  if (isLinkButton) {
    return { ...normalizedAttrs, link: true };
  }

  if (isTextButton) {
    return { ...normalizedAttrs, text: true };
  }

  return normalizedAttrs;
});
</script>

<template>
  <el-button
    v-if="allowed"
    v-bind="buttonAttrs"
    :class="{
      'bq-permission-button--primary': variant === 'primary',
      'bq-permission-button--secondary': variant === 'secondary',
      'bq-permission-button--danger': variant === 'danger',
    }"
    :type="variant === 'primary' ? 'primary' : variant !== 'default' ? undefined : type === 'default' ? undefined : type"
  >
    <slot />
  </el-button>
</template>

<style scoped>
.bq-permission-button--secondary {
  --el-button-text-color: var(--bq-color-primary);
  --el-button-bg-color: var(--bq-color-surface);
  --el-button-border-color: var(--bq-color-border);
  --el-button-hover-text-color: var(--bq-color-primary);
  --el-button-hover-bg-color: var(--bq-color-primary-soft);
  --el-button-hover-border-color: var(--bq-color-primary-hover);
  --el-button-active-text-color: var(--bq-color-primary-active);
  --el-button-active-bg-color: var(--bq-color-surface);
  --el-button-active-border-color: var(--bq-color-primary-active);
}

.bq-permission-button--danger {
  --el-button-text-color: var(--bq-color-text-secondary);
  --el-button-bg-color: var(--bq-color-surface);
  --el-button-border-color: var(--bq-color-border);
  --el-button-hover-text-color: var(--bq-color-danger);
  --el-button-hover-bg-color: var(--bq-color-surface);
  --el-button-hover-border-color: var(--bq-color-danger);
  --el-button-active-text-color: var(--bq-color-danger-active);
  --el-button-active-bg-color: var(--bq-color-surface);
  --el-button-active-border-color: var(--bq-color-danger-active);
}
</style>
