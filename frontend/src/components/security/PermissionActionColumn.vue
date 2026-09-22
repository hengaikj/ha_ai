<script setup lang="ts">
import PermissionButton from "@/components/security/PermissionButton.vue";
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import type { PermissionRowAction } from "@/types/table-permission";

const props = withDefaults(
  defineProps<{
    actions: PermissionRowAction[];
    label?: string;
    width?: string | number;
    disabledReason?: string;
  }>(),
  {
    label: "操作",
    width: 180,
    disabledReason: "无权限执行当前操作",
  },
);

const emit = defineEmits<{
  action: [key: string, row: unknown];
}>();

const authStore = useAuthStore();
const visibleActions = computed(() =>
  props.actions.filter((action) => authStore.hasPermission(action.permission)),
);

const handleAction = (key: string, row: unknown) => {
  emit("action", key, row);
};
</script>

<template>
  <el-table-column :label="label" fixed="right" align="center" :width="width">
    <template #default="{ row }">
      <template v-if="visibleActions.length > 0">
        <el-tooltip
          v-for="action in visibleActions"
          :key="action.key"
          :content="action.disabledReason ?? disabledReason"
          :disabled="!action.disabled"
          placement="top"
        >
          <span>
            <PermissionButton
              link
              :disabled="action.disabled"
              :type="
                action.label === '删除' || action.type === 'default'
                  ? undefined
                  : action.type
              "
              @click="handleAction(action.key, row)"
            >
              {{ action.label }}
            </PermissionButton>
          </span>
        </el-tooltip>
      </template>
      <span v-else class="permission-action-column__empty">无可用操作</span>
    </template>
  </el-table-column>
</template>

<style scoped>
.permission-action-column__empty {
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 20px;
}
</style>
