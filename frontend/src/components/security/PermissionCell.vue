<script setup lang="ts">
import { computed } from "vue";
import SecureField from "@/components/security/SecureField.vue";
import type { FieldPermission } from "@/utils/permission";

const props = withDefaults(
  defineProps<{
    value: string | number | null | undefined;
    permission?: FieldPermission;
    editable?: boolean;
    maskedValue?: string;
    unreadableText?: string;
    emptyText?: string;
    disabledReason?: string;
  }>(),
  {
    permission: "READABLE",
    editable: false,
    maskedValue: "***",
    unreadableText: "--",
    emptyText: "--",
    disabledReason: "无字段编辑权限",
  },
);

const readableValue = computed(() => {
  if (props.value === null || props.value === undefined || props.value === "") {
    return props.emptyText;
  }
  return props.value;
});
const canEdit = computed(
  () => props.editable && props.permission === "READABLE",
);
</script>

<template>
  <span class="permission-cell" :class="{ 'is-editable': canEdit }">
    <slot v-if="canEdit" name="editor" :value="readableValue" />
    <el-tooltip
      v-else-if="editable && permission !== 'READABLE'"
      :content="disabledReason"
      placement="top"
    >
      <span>
        <SecureField
          :value="readableValue"
          :permission="permission"
          :masked-value="maskedValue"
          :unreadable-text="unreadableText"
        />
      </span>
    </el-tooltip>
    <SecureField
      v-else
      :value="readableValue"
      :permission="permission"
      :masked-value="maskedValue"
      :unreadable-text="unreadableText"
    />
  </span>
</template>

<style scoped>
.permission-cell {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
}

.permission-cell.is-editable {
  width: 100%;
}
</style>
