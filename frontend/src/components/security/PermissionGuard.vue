<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";

const props = withDefaults(
  defineProps<{
    permission?: string | string[];
    mode?: "hide" | "placeholder";
    reason?: string;
  }>(),
  {
    permission: undefined,
    mode: "hide",
    reason: "无权限查看当前内容",
  },
);

const authStore = useAuthStore();
const allowed = computed(() => authStore.hasPermission(props.permission));
</script>

<template>
  <slot v-if="allowed" />
  <slot v-else-if="mode === 'placeholder'" name="fallback">
    <el-alert type="warning" :closable="false" show-icon>
      <template #title>{{ reason }}</template>
    </el-alert>
  </slot>
</template>
