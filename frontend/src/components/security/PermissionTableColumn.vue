<script setup lang="ts" generic="TRow extends Record<string, unknown>">
import { computed } from "vue";
import PermissionCell from "@/components/security/PermissionCell.vue";
import type { FieldPermission } from "@/utils/permission";

const props = withDefaults(
  defineProps<{
    prop: string;
    label: string;
    permission?: FieldPermission;
    hiddenWhenDenied?: boolean;
    maskedValue?: string;
    unreadableText?: string;
    minWidth?: string | number;
    width?: string | number;
    align?: "left" | "center" | "right";
  }>(),
  {
    permission: "READABLE",
    hiddenWhenDenied: false,
    maskedValue: "***",
    unreadableText: "--",
    minWidth: 120,
    width: undefined,
    align: "left",
  },
);

const visible = computed(
  () => !(props.hiddenWhenDenied && props.permission === "UNREADABLE"),
);
const readRowValue = (row: TRow) =>
  row[props.prop] as string | number | null | undefined;
</script>

<template>
  <el-table-column
    v-if="visible"
    :align="align"
    :label="label"
    :min-width="minWidth"
    :prop="prop"
    :width="width"
  >
    <template #default="{ row }">
      <slot :row="row" :value="readRowValue(row)">
        <PermissionCell
          :value="readRowValue(row)"
          :permission="permission"
          :masked-value="maskedValue"
          :unreadable-text="unreadableText"
        />
      </slot>
    </template>
  </el-table-column>
</template>
