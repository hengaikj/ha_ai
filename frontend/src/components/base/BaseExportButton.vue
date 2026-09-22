<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { Download } from "@element-plus/icons-vue";
withDefaults(
  defineProps<{
    loading?: boolean;
    disabled?: boolean;
    text?: string;
  }>(),
  {
    loading: false,
    disabled: false,
    text: "导出",
  },
);

const emit = defineEmits<{
  export: [];
}>();
</script>

<template>
  <PermissionButton
    :loading="loading"
    :disabled="disabled"
    :icon="Download"
    @click="emit('export')"
  >
    {{ text }}
  </PermissionButton>
</template>
