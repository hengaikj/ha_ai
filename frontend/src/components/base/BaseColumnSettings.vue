<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Grid } from "@element-plus/icons-vue";

type ColumnOption = {
  key: string;
  label: string;
  disabled?: boolean;
  children?: ColumnOption[];
};

type ColumnSettingsSource = {
  columns?: ColumnOption[];
  visibleColumns?: string[];
};

type ColumnSettingsTarget = {
  setVisibleColumns?: (keys: string[]) => void;
  getColumnSettings?: () => ColumnSettingsSource;
  columnSettings?: ColumnSettingsSource;
};

type MaybeRefColumnSettingsTarget =
  | ColumnSettingsTarget
  | {
      value?: ColumnSettingsTarget | null;
    };

type ColumnSettingsTargetRef = {
  value?: ColumnSettingsTarget | null;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string[];
    columns?: ColumnOption[];
    buttonText?: string;
    target?: MaybeRefColumnSettingsTarget | null;
  }>(),
  {
    modelValue: () => [],
    columns: () => [],
    buttonText: "列设置",
    target: null,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
  change: [value: string[]];
}>();

const resolvedColumns = computed(() => {
  if (props.columns.length > 0) {
    return props.columns;
  }

  return resolveTargetSettings().columns ?? [];
});

const hasTreeColumns = computed(() =>
  resolvedColumns.value.some((column) => column.children?.length),
);
const leafColumnKeySet = computed(() => {
  const keys = new Set<string>();
  const collectLeafKeys = (columns: ColumnOption[]) => {
    columns.forEach((column) => {
      if (column.children?.length) {
        collectLeafKeys(column.children);
        return;
      }
      keys.add(column.key);
    });
  };

  collectLeafKeys(resolvedColumns.value);
  return keys;
});
const treeRef = ref<{
  setCheckedKeys?: (keys: string[]) => void;
  getCheckedKeys?: (leafOnly?: boolean) => string[];
  getHalfCheckedKeys?: () => string[];
}>();

const checkedColumns = computed({
  get: () => {
    if (props.columns.length > 0 || props.modelValue.length > 0) {
      return props.modelValue;
    }

    return resolveTargetSettings().visibleColumns ?? [];
  },
  set: (value: string[]) => {
    emit("update:modelValue", value);
    emit("change", value);
    resolveTarget()?.setVisibleColumns?.(value);
  },
});

watch(
  () => [checkedColumns.value, resolvedColumns.value] as const,
  () => {
    if (!hasTreeColumns.value) {
      return;
    }
    treeRef.value?.setCheckedKeys?.(
      checkedColumns.value.filter((key) => leafColumnKeySet.value.has(key)),
    );
  },
  { immediate: true, flush: "post" },
);

function resolveTargetSettings() {
  const target = resolveTarget();
  return target?.getColumnSettings?.() ?? target?.columnSettings ?? {};
}

function resolveTarget(): ColumnSettingsTarget | null {
  if (!props.target) {
    return null;
  }

  if (isColumnSettingsTargetRef(props.target)) {
    return props.target.value ?? null;
  }

  return props.target;
}

function isColumnSettingsTargetRef(
  target: MaybeRefColumnSettingsTarget,
): target is ColumnSettingsTargetRef {
  return "value" in target;
}

function handleTreeCheck() {
  const checkedKeys = treeRef.value?.getCheckedKeys?.(false) ?? [];
  const halfCheckedKeys = treeRef.value?.getHalfCheckedKeys?.() ?? [];
  checkedColumns.value = Array.from(
    new Set([...checkedKeys, ...halfCheckedKeys]),
  );
}
</script>

<template>
  <el-popover trigger="click" placement="bottom-end" width="300">
    <template #reference>
      <el-button
        class="column-settings-icon-button"
        circle
        :icon="Grid"
        :aria-label="buttonText"
        :title="buttonText"
      />
    </template>
    <el-tree
      v-if="hasTreeColumns"
      ref="treeRef"
      class="base-column-settings-tree"
      :data="resolvedColumns"
      show-checkbox
      default-expand-all
      node-key="key"
      :props="{ label: 'label', children: 'children', disabled: 'disabled' }"
      :default-checked-keys="checkedColumns"
      @check="handleTreeCheck"
    />
    <el-checkbox-group
      v-if="!hasTreeColumns"
      v-model="checkedColumns"
      class="base-column-settings"
    >
      <el-checkbox
        v-for="column in resolvedColumns"
        :key="column.key"
        :value="column.key"
        :label="column.label"
        :disabled="column.disabled"
      >
        {{ column.label }}
      </el-checkbox>
    </el-checkbox-group>
  </el-popover>
</template>

<style scoped>
.column-settings-icon-button {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  flex: 0 0 28px;
  --el-button-text-color: #909399;
  --el-button-border-color: #dcdfe6;
  --el-button-hover-text-color: #409eff;
  --el-button-hover-border-color: #b3d8ff;
  --el-button-hover-bg-color: #ecf5ff;
}

.base-column-settings {
  display: grid;
  gap: 8px;
  max-height: min(360px, calc(100vh - 160px));
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 4px;
}

.base-column-settings :deep(.el-checkbox) {
  height: 24px;
}

.base-column-settings-tree {
  max-height: min(360px, calc(100vh - 160px));
  overflow-x: hidden;
  overflow-y: auto;
}

.base-column-settings-tree :deep(.el-tree-node__content) {
  height: 28px;
}
</style>
