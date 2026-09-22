<script setup lang="ts">
import SecureField from "@/components/security/SecureField.vue";
import type { SchemaDescriptionItem } from "@/types/schema-components";

withDefaults(
  defineProps<{
    data: Record<string, unknown>;
    items: SchemaDescriptionItem[];
    column?: number;
    border?: boolean;
    emptyText?: string;
  }>(),
  {
    column: 2,
    border: true,
    emptyText: "--",
  },
);

const readFieldValue = (value: unknown) =>
  value as string | number | null | undefined;
</script>

<template>
  <el-descriptions
    :border="border"
    :column="column"
    class="schema-descriptions"
  >
    <el-descriptions-item
      v-for="item in items"
      :key="item.prop"
      :label="item.label"
      :span="item.span"
    >
      <slot :name="`item-${item.prop}`" :item="item" :value="data[item.prop]">
        <SecureField
          :value="readFieldValue(data[item.prop])"
          :permission="item.permission"
          :masked-value="item.maskedValue"
          :unreadable-text="item.unreadableText ?? emptyText"
        />
      </slot>
    </el-descriptions-item>
  </el-descriptions>
</template>

<style scoped>
.schema-descriptions {
  width: 100%;
}
</style>
