<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { onActivated, onDeactivated, ref } from "vue";
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    width?: string;
    top?: string;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    showFooter?: boolean;
    closeOnConfirm?: boolean;
    compact?: boolean;
    bodyMaxHeight?: string;
    confirmButtonProps?: Record<string, unknown>;
    cancelButtonProps?: Record<string, unknown>;
  }>(),
  {
    width: "520px",
    top: "100px",
    confirmText: "保存",
    cancelText: "取消",
    loading: false,
    showFooter: true,
    closeOnConfirm: false,
    compact: false,
    bodyMaxHeight: "",
    confirmButtonProps: () => ({}),
    cancelButtonProps: () => ({}),
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
  cancel: [];
}>();
const active = ref(true);

function updateVisible(value: boolean) {
  emit("update:modelValue", value);
}

function handleCancel() {
  emit("cancel");
  updateVisible(false);
}

function handleConfirm() {
  emit("confirm");
  if (props.closeOnConfirm) {
    updateVisible(false);
  }
}

onActivated(() => {
  active.value = true;
});
onDeactivated(() => {
  active.value = false;
  if (props.modelValue) updateVisible(false);
});
</script>

<template>
  <el-dialog
    :model-value="active && modelValue"
    :title="title"
    :width="width"
    :top="top"
    :class="[
      'base-form-dialog',
      {
        'base-form-dialog--compact': compact,
        'base-form-dialog--scrollable': bodyMaxHeight,
      },
    ]"
    :style="
      bodyMaxHeight
        ? { '--base-form-dialog-body-max-height': bodyMaxHeight }
        : undefined
    "
    v-bind="$attrs"
    destroy-on-close
    @update:model-value="updateVisible"
  >
    <template #header>
      <slot name="header">
        <div class="base-form-dialog__header-content">
          <div class="base-form-dialog__header-left">
            <span class="el-dialog__title">{{ title }}</span>
            <slot name="title-extra" />
          </div>
          <slot name="header-extra" />
        </div>
      </slot>
    </template>
    <slot />
    <template v-if="showFooter" #footer>
      <slot name="footer">
        <PermissionButton
          v-if="cancelText"
          v-bind="cancelButtonProps"
          :disabled="loading"
          @click="handleCancel"
        >
          {{ cancelText }}
        </PermissionButton>
        <PermissionButton
          v-if="confirmText"
          v-bind="confirmButtonProps"
          type="primary"
          :loading="loading"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </PermissionButton>
      </slot>
    </template>
  </el-dialog>
</template>

<style scoped>
:global(.base-form-dialog.el-dialog) {
  overflow: hidden;
  border: 1px solid var(--bq-color-border);
  border-radius: 8px;
  background: var(--bq-color-surface);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
}

:global(.base-form-dialog .el-dialog__header) {
  min-height: 54px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid var(--bq-color-divider);
}

.base-form-dialog__header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: calc(100% - 36px);
  gap: 16px;
}

.base-form-dialog__header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

:global(.base-form-dialog .el-dialog__title) {
  color: var(--bq-color-text);
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
}

:global(.base-form-dialog .el-dialog__headerbtn) {
  top: 0;
  right: 18px;
  width: 54px;
  height: 54px;
}

:global(.base-form-dialog .el-dialog__body) {
  padding: 22px 24px 24px;
}

:global(.base-form-dialog--scrollable .el-dialog__body) {
  max-height: var(--base-form-dialog-body-max-height);
  overflow-y: auto;
}

:global(.base-form-dialog .el-dialog__footer) {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 24px;
  border-top: 1px solid var(--bq-color-divider);
}

:global(.base-form-dialog .el-dialog__footer .el-button + .el-button) {
  margin-left: 0;
}

:global(.base-form-dialog--compact .el-dialog__header) {
  min-height: 42px;
  padding: 0 18px;
}

:global(.base-form-dialog--compact .el-dialog__headerbtn) {
  width: 42px;
  height: 42px;
}

:global(.base-form-dialog--compact .el-dialog__body) {
  padding: 14px 20px 12px;
}

:global(.base-form-dialog--compact .el-dialog__footer) {
  min-height: 42px;
  padding: 8px 20px;
}

:global(.base-form-dialog--compact .el-form-item) {
  margin-bottom: 10px;
}

:global(.base-form-dialog--compact .el-row .el-col) {
  display: block;
}

:global(.base-form-dialog--compact .el-form-item__label) {
  /* margin-bottom: 4px; */
  color: var(--bq-color-text);
  font-size: 12px;
  font-weight: 500;
  /* line-height: 18px; */
}

:global(
  .base-form-dialog--compact
    .el-form-item.is-required
    .el-form-item__label::before
) {
  color: var(--bq-color-danger);
}

:global(
  .base-form-dialog--compact
    .el-form-item.is-required
    .el-form-item__label::after
) {
  display: none;
}

:global(.base-form-dialog--compact .el-input__wrapper),
:global(.base-form-dialog--compact .el-select__wrapper),
:global(.base-form-dialog--compact .el-input-number .el-input__wrapper) {
  min-height: 32px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--bq-color-border) inset;
}

:global(.base-form-dialog--compact .el-input),
:global(.base-form-dialog--compact .el-select),
:global(.base-form-dialog--compact .el-date-editor.el-input),
:global(.base-form-dialog--compact .el-input-number) {
  width: 100%;
}

:global(.base-form-dialog--compact .el-radio-group) {
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 16px;
}

:global(.base-form-dialog--compact .el-radio) {
  margin-right: 0;
}
</style>
