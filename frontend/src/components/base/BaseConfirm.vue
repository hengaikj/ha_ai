<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { WarningFilled } from "@element-plus/icons-vue";
import { onActivated, onDeactivated, ref } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    message: string;
    type?: "default" | "warning" | "danger";
    width?: string;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    confirmButtonProps?: Record<string, unknown>;
    cancelButtonProps?: Record<string, unknown>;
  }>(),
  {
    type: "default",
    width: "420px",
    confirmText: "确认",
    cancelText: "取消",
    loading: false,
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
  if (!value) {
    emit("cancel");
  }
  emit("update:modelValue", value);
}

function handleCancel() {
  updateVisible(false);
}

function handleConfirm() {
  emit("confirm");
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
    append-to-body
    class="base-confirm"
    v-bind="$attrs"
    @update:model-value="updateVisible"
  >
    <div class="base-confirm__content" :class="`is-${props.type}`">
      <el-icon class="base-confirm__icon">
        <WarningFilled />
      </el-icon>
      <p class="base-confirm__message">{{ message }}</p>
    </div>
    <template #footer>
      <PermissionButton
        v-bind="cancelButtonProps"
        :disabled="loading"
        @click="handleCancel"
      >
        {{ cancelText }}
      </PermissionButton>
      <PermissionButton
        v-bind="confirmButtonProps"
        :type="type === 'danger' ? 'danger' : 'primary'"
        :loading="loading"
        @click="handleConfirm"
      >
        {{ confirmText }}
      </PermissionButton>
    </template>
  </el-dialog>
</template>

<style scoped>
:global(.base-confirm.el-dialog) {
  overflow: hidden;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 8px;
  background: var(--bq-color-surface);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
}

:global(.base-confirm .el-dialog__header) {
  min-height: 38px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid var(--bq-color-divider);
}

:global(.base-confirm .el-dialog__title) {
  color: var(--bq-color-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

:global(.base-confirm .el-dialog__headerbtn) {
  top: 0;
  right: 14px;
  width: 38px;
  height: 38px;
}

:global(.base-confirm .el-dialog__body) {
  padding: 14px 20px 18px;
}

:global(.base-confirm .el-dialog__footer) {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 20px;
  border-top: 1px solid var(--bq-color-divider);
}

:global(.base-confirm .el-dialog__footer .el-button + .el-button) {
  margin-left: 0;
}

.base-confirm__content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 10px 12px;
  border-radius: 4px;
  background: var(--bq-color-info-soft);
}

.base-confirm__icon {
  color: var(--bq-color-info);
  font-size: 16px;
}

.base-confirm__content.is-danger {
  background: var(--bq-color-danger-soft);
}

.base-confirm__content.is-warning {
  background: var(--bq-color-warning-soft);
}

.base-confirm__content.is-warning .base-confirm__icon {
  color: var(--bq-color-warning);
}

.base-confirm__content.is-danger .base-confirm__icon {
  color: var(--bq-color-danger);
}

.base-confirm__message {
  margin: 0;
  color: var(--bq-color-text);
  font-size: 12px;
  line-height: 18px;
}
</style>
