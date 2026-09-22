<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { Refresh } from "@element-plus/icons-vue";
import { onDeactivated } from "vue";
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    loading?: boolean;
  }>(),
  {
    title: "高级筛选",
    loading: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  apply: [];
  reset: [];
}>();

onDeactivated(() => {
  if (props.modelValue) emit("update:modelValue", false);
});
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    size="420px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <slot />
    <template #footer>
      <PermissionButton :icon="Refresh" :disabled="loading" @click="emit('reset')">重置</PermissionButton>
      <PermissionButton type="primary" :loading="loading" @click="emit('apply')">
        应用筛选
      </PermissionButton>
    </template>
  </el-drawer>
</template>
