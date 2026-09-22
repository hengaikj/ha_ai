<script setup lang="ts" generic="TRow extends Record<string, unknown>">
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import PermissionActionColumn from "@/components/security/PermissionActionColumn.vue";
import PermissionCell from "@/components/security/PermissionCell.vue";
import PermissionTableColumn from "@/components/security/PermissionTableColumn.vue";
import type {
  PermissionColumnSchema,
  PermissionRowAction,
} from "@/types/table-permission";

defineOptions({
  inheritAttrs: false,
});

withDefaults(
  defineProps<{
    data: TRow[];
    columns: PermissionColumnSchema<TRow>[];
    actions?: PermissionRowAction[];
    loading?: boolean;
    rowKey?: string;
    actionWidth?: string | number;
    emptyTitle?: string;
    emptyDescription?: string;
  }>(),
  {
    actions: () => [],
    loading: false,
    rowKey: "id",
    actionWidth: 180,
    emptyTitle: "暂无数据",
    emptyDescription: "当前条件下没有可展示的数据。",
  },
);

const emit = defineEmits<{
  action: [key: string, row: unknown];
}>();
</script>

<template>
  <BaseDataTable
    v-bind="$attrs"
    :data="data"
    :empty-description="emptyDescription"
    :empty-title="emptyTitle"
    :loading="loading"
    :row-key="rowKey"
  >
    <PermissionTableColumn
      v-for="column in columns"
      :key="column.prop"
      :align="column.align"
      :hidden-when-denied="column.hiddenWhenDenied"
      :label="column.label"
      :masked-value="column.maskedValue"
      :min-width="column.minWidth"
      :permission="column.permission"
      :prop="column.prop"
      :unreadable-text="column.unreadableText"
      :width="column.width"
    >
      <template #default="{ row, value }">
        <slot :name="`cell-${column.prop}`" :row="row" :value="value">
          <PermissionCell
            :value="column.formatter ? column.formatter(value, row) : value"
            :permission="column.permission"
            :masked-value="column.maskedValue"
            :unreadable-text="column.unreadableText"
          />
        </slot>
      </template>
    </PermissionTableColumn>

    <PermissionActionColumn
      v-if="actions.length > 0"
      :actions="actions"
      :width="actionWidth"
      @action="(key, row) => emit('action', key, row)"
    />
  </BaseDataTable>
</template>
