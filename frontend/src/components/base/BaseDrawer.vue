<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { onActivated, onDeactivated, ref } from "vue";
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    size?: string;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    showFooter?: boolean;
    closeOnConfirm?: boolean;
    appendToBody?: boolean;
  }>(),
  {
    size: "420px",
    confirmText: "保存",
    cancelText: "取消",
    loading: false,
    showFooter: true,
    closeOnConfirm: false,
    appendToBody: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
  cancel: [];
  opened: [];
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

function handleOpened() {
  emit("opened");
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
  <el-drawer
    :model-value="active && modelValue"
    :title="title"
    :size="size"
    :append-to-body="appendToBody"
    destroy-on-close
    class="base-drawer"
    @update:model-value="updateVisible"
    @opened="handleOpened"
  >
    <template #header="{ titleId, titleClass }">
      <div class="base-drawer__header-main">
        <span :id="titleId" role="heading" aria-level="2" :class="titleClass">
          {{ title }}
        </span>
        <div v-if="$slots['header-extra']" class="base-drawer__header-extra">
          <slot name="header-extra" />
        </div>
      </div>
    </template>
    <div class="base-drawer__body">
      <slot />
    </div>
    <template v-if="showFooter" #footer>
      <slot name="footer">
        <PermissionButton :disabled="loading" @click="handleCancel">
          {{ cancelText }}
        </PermissionButton>
        <PermissionButton
          type="primary"
          :loading="loading"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </PermissionButton>
      </slot>
    </template>
  </el-drawer>
</template>

<style scoped>
:global(.base-drawer .el-drawer__title) {
  font-weight: 700;
}

.base-drawer__header-main {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--bq-space-sm, 8px);
  min-width: 0;
}

.base-drawer__header-main :global(.el-drawer__title) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-drawer__header-extra {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--bq-space-sm, 8px);
  margin-left: auto;
}

.base-drawer__body {
  min-width: 0;
}
</style>
