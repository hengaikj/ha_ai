<script setup lang="ts">
import { h } from "vue";
import * as ElementPlusIcons from "@element-plus/icons-vue";
import { ArrowDown, ArrowRight } from "@element-plus/icons-vue";
import {
  ElButton,
  ElIcon,
  ElSwitch,
  TableV2FixedDir,
  type Column,
} from "element-plus";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type {
  PlatformMenuItem,
  PlatformMenuType,
  PlatformStatus,
} from "@/types/platform-system";

export type MenuDisplayItem = PlatformMenuItem & {
  level: number;
  expanded: boolean;
  hasChildren: boolean;
};

type ErrorInfo = {
  code: string;
  message: string;
  traceId?: string;
};

defineProps<{
  rows: MenuDisplayItem[];
  loading?: boolean;
  error?: ErrorInfo | null;
  height?: number;
}>();

const emit = defineEmits<{
  "toggle-expand": [row: MenuDisplayItem];
  create: [row: PlatformMenuItem];
  edit: [row: PlatformMenuItem];
  "create-child": [row: PlatformMenuItem];
  remove: [row: PlatformMenuItem];
  "toggle-status": [row: PlatformMenuItem];
}>();

const columns: Column<unknown>[] = [
  {
    key: "menuName",
    dataKey: "menuName",
    title: "菜单名称",
    width: 360,
    flexGrow: 1,
    align: "left",
    cellRenderer: ({ rowData }) => renderNameCell(rowData as MenuDisplayItem),
  },
  {
    key: "menuType",
    dataKey: "menuType",
    title: "类型",
    width: 100,
    align: "center",
    cellRenderer: ({ rowData }) => renderTypeCell(rowData as MenuDisplayItem),
  },
  {
    key: "icon",
    dataKey: "icon",
    title: "图标",
    width: 100,
    align: "center",
    cellRenderer: ({ rowData }) =>
      renderIcon((rowData as MenuDisplayItem).icon),
  },
  {
    key: "sortNo",
    dataKey: "sortNo",
    title: "排序",
    width: 90,
    align: "center",
    cellRenderer: ({ rowData }) =>
      renderText((rowData as MenuDisplayItem).sortNo),
  },
  {
    key: "permissionCode",
    dataKey: "permissionCode",
    title: "权限标识",
    width: 180,
    align: "center",
    cellRenderer: ({ rowData }) =>
      renderText((rowData as MenuDisplayItem).permissionCode),
  },
  {
    key: "componentPath",
    dataKey: "componentPath",
    title: "组件路径",
    width: 220,
    align: "center",
    cellRenderer: ({ rowData }) =>
      renderText((rowData as MenuDisplayItem).componentPath),
  },
  {
    key: "status",
    dataKey: "status",
    title: "菜单状态",
    width: 120,
    align: "center",
    cellRenderer: ({ rowData }) => renderStatusCell(rowData as MenuDisplayItem),
  },
  {
    key: "createdAt",
    dataKey: "createdAt",
    title: "创建时间",
    width: 180,
    align: "center",
    cellRenderer: ({ rowData }) => renderDateCell(rowData as MenuDisplayItem),
  },
  {
    key: "operations",
    dataKey: "operations",
    title: "操作",
    width: 160,
    fixed: TableV2FixedDir.RIGHT,
    align: "center",
    cellRenderer: ({ rowData }) =>
      renderOperationCell(rowData as MenuDisplayItem),
  },
];

function renderNameCell(row: MenuDisplayItem) {
  const children = [
    row.hasChildren
      ? h(ElButton, {
          class: "system-menu-virtual-table__expand",
          text: true,
          icon: row.expanded ? ArrowDown : ArrowRight,
          "aria-label": row.expanded ? "折叠菜单" : "展开菜单",
          onClick: () => emit("toggle-expand", row),
        })
      : h("span", {
          class: "system-menu-virtual-table__expand-placeholder",
          "aria-hidden": "true",
        }),
    h(
      "span",
      {
        class: "system-menu-virtual-table__text",
        title: row.menuName,
      },
      row.menuName,
    ),
  ];

  return h(
    "div",
    {
      class: "system-menu-virtual-table__name",
      style: { paddingLeft: `${row.level * 20}px` },
    },
    children,
  );
}

function renderTypeCell(row: MenuDisplayItem) {
  return h(BaseStatusTag, {
    type: menuTypeTagType(row.menuType),
    label: menuTypeLabel(row.menuType),
  });
}

function renderStatusCell(row: MenuDisplayItem) {
  return h(ElSwitch, {
    modelValue: getMenuStatus(row) === "ENABLED",
    onChange: () => emit("toggle-status", row),
  });
}

function renderDateCell(row: MenuDisplayItem) {
  return h(BaseDateTime, { value: row.createdAt || null });
}

function renderIcon(value?: string) {
  const icon = value
    ? (ElementPlusIcons as Record<string, unknown>)[value]
    : undefined;
  if (!icon) return renderText(value);
  return h("span", { class: "system-menu-virtual-table__icon", title: value }, [
    h(ElIcon, null, [h(icon as never)]),
  ]);
}

function renderOperationCell(row: MenuDisplayItem) {
  return h("div", { class: "system-menu-virtual-table__operations" }, [
    h(
      PermissionButton,
      {
        permission: "system:menu:edit",
        link: true,
        "data-test": `edit-menu-${row.id}`,
        onClick: () => emit("edit", row),
      },
      () => "编辑",
    ),
    h(
      PermissionButton,
      {
        permission: "system:menu:add",
        link: true,
        "data-test": `create-child-menu-${row.id}`,
        onClick: () => emit("create-child", row),
      },
      () => "新增",
    ),
    h(
      PermissionButton,
      {
        permission: "system:menu:remove",
        link: true,
        "data-test": `delete-menu-${row.id}`,
        onClick: () => emit("remove", row),
      },
      () => "删除",
    ),
  ]);
}

function renderText(value: unknown) {
  const text =
    value === undefined || value === null || value === ""
      ? "--"
      : String(value);
  return h(
    "span",
    { class: "system-menu-virtual-table__text", title: text },
    text,
  );
}

function getMenuStatus(menu: PlatformMenuItem): PlatformStatus {
  return menu.status ?? "ENABLED";
}

function menuTypeLabel(type?: PlatformMenuType) {
  const labels: Record<PlatformMenuType, string> = {
    DIRECTORY: "目录",
    PAGE: "菜单",
    BUTTON: "按钮",
  };
  return type ? labels[type] : "--";
}

function menuTypeTagType(type?: PlatformMenuType) {
  const types: Record<PlatformMenuType, "primary" | "success" | "warning"> = {
    DIRECTORY: "primary",
    PAGE: "success",
    BUTTON: "warning",
  };
  return type ? types[type] : "info";
}
</script>

<template>
  <div
    v-loading="loading"
    class="system-menu-virtual-table"
    :style="{ height: `${Math.max(height ?? 420, 260)}px` }"
  >
    <TraceErrorAlert
      v-if="error"
      :code="error.code"
      :message="error.message"
      :trace-id="error.traceId"
    />
    <BaseEmpty
      v-else-if="!rows.length && !loading"
      title="暂无匹配菜单"
      description="当前筛选条件下没有可展示的菜单数据。"
    />
    <el-auto-resizer v-else>
      <template #default="{ height: autoHeight, width }">
        <el-table-v2
          :columns="columns"
          :data="rows"
          :width="width"
          :height="autoHeight"
          :row-height="66"
          :header-height="52"
          row-key="id"
          fixed
        />
      </template>
    </el-auto-resizer>
  </div>
</template>

<style scoped>
.system-menu-virtual-table {
  min-width: 0;
  overflow: hidden;
  color: var(--bq-color-text);
  border-radius: var(--bq-radius-page);
}

.system-menu-virtual-table :deep(.el-table-v2__header-row),
.system-menu-virtual-table :deep(.el-table-v2__header-cell) {
  background: var(--bq-color-table-header);
  color: var(--bq-color-text);
  font-weight: 700;
}

.system-menu-virtual-table :deep(.el-table-v2__header-row) {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.system-menu-virtual-table :deep(.el-table-v2__row) {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.system-menu-virtual-table :deep(.el-table-v2__row:hover) {
  background: color-mix(in srgb, var(--bq-color-primary), white 96%);
}

.system-menu-virtual-table :deep(.system-menu-virtual-table__name),
.system-menu-virtual-table :deep(.system-menu-virtual-table__operations) {
  display: flex;
  align-items: center;
  min-width: 0;
}

.system-menu-virtual-table :deep(.system-menu-virtual-table__operations) {
  justify-content: center;
  gap: 4px;
}

.system-menu-virtual-table :deep(.system-menu-virtual-table__expand) {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  padding: 0;
}

.system-menu-virtual-table
  :deep(.system-menu-virtual-table__expand-placeholder) {
  flex: 0 0 24px;
  width: 24px;
}

.system-menu-virtual-table :deep(.system-menu-virtual-table__text) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-menu-virtual-table :deep(.system-menu-virtual-table__icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--bq-color-text-secondary);
  font-size: 18px;
}
</style>
