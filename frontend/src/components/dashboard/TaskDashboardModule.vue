<script setup lang="ts">
import DashboardModule from "@/components/dashboard/DashboardModule.vue";
import type { DashboardOverview } from "@/types/dashboard";

defineProps<{
  title: string;
  loading?: boolean;
  overview?: DashboardOverview | null;
  error?: { code: string; message: string; traceId?: string } | null;
}>();

defineEmits<{ retry: [] }>();
</script>

<template>
  <DashboardModule
    :title="title"
    :loading="loading"
    :overview="overview"
    :error="error"
    @retry="$emit('retry')"
  />
</template>
