<script setup lang="ts">
import { computed, h } from "vue";
import { ArrowDown, ArrowRight } from "@element-plus/icons-vue";
import { ElButton, TableV2FixedDir, type Column } from "element-plus";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import {
  flattenVisibleGradeRows,
  type GradeRow,
  type VisibleGradeRow,
} from "./budget-grade-tree";

type ErrorInfo = {
  code: string;
  message: string;
  traceId?: string;
};

const props = defineProps<{
  rows: GradeRow[];
  expandedIds: Set<number>;
  loading?: boolean;
  error?: ErrorInfo | null;
  height?: number;
}>();

const emit = defineEmits<{
  "toggle-expand": [row: GradeRow];
  create: [row: GradeRow];
  edit: [row: GradeRow];
  "toggle-status": [row: GradeRow];
}>();

const visibleRows = computed(() =>
  flattenVisibleGradeRows(props.rows, props.expandedIds),
);
const tableHeight = computed(() => Math.max(props.height ?? 420, 260));

const columns: Column<unknown>[] = [
  {
    key: "name",
    dataKey: "name",
    title: "等级名称",
    width:360,
    flexGrow: 1,
    align: "left",
    cellRenderer: ({ rowData }) => renderNameCell(rowData as VisibleGradeRow),
  },
  {
    key: "code",
    dataKey: "code",
    title: "等级编号",
    width: 400,
    align: "left",
    cellRenderer: ({ rowData }) =>
      renderText((rowData as VisibleGradeRow).row.code),
  },
  {
    key: "status",
    dataKey: "status",
    title: "等级状态",
    width: 180,
    align: "center",
    cellRenderer: ({ rowData }) =>
      renderStatusCell((rowData as VisibleGradeRow).row),
  },
  {
    key: "createdAt",
    dataKey: "createdAt",
    title: "创建时间",
    width: 300,
    align: "center",
    cellRenderer: ({ rowData }) =>
      renderText((rowData as VisibleGradeRow).row.createdAt),
  },
  {
    key: "operations",
    dataKey: "operations",
    title: "操作",
    width: 160,
    fixed: TableV2FixedDir.RIGHT,
    align: "center",
    cellRenderer: ({ rowData }) =>
      renderOperationCell((rowData as VisibleGradeRow).row),
  },
];

function renderNameCell(item: VisibleGradeRow) {
  const { row, depth } = item;
  const children = [];
  if (row.hasChildren) {
    children.push(
      h(ElButton, {
        class: "budget-grade-virtual-table__expand",
        text: true,
        icon: props.expandedIds.has(row.id) ? ArrowDown : ArrowRight,
        "aria-label": props.expandedIds.has(row.id) ? "折叠" : "全部展示",
        onClick: () => emit("toggle-expand", row),
      }),
    );
  } else {
    children.push(
      h("span", {
        class: "budget-grade-virtual-table__expand-placeholder",
        "aria-hidden": "true",
      }),
    );
  }
  children.push(
    h(
      "span",
      { class: "budget-grade-virtual-table__text", title: row.name },
      row.name,
    ),
  );

  return h(
    "div",
    {
      class: "budget-grade-virtual-table__name",
      style: { paddingLeft: `${depth * 16}px` },
    },
    children,
  );
}

function renderText(value: string) {
  const text = value || "-";
  return h(
    "span",
    { class: "budget-grade-virtual-table__text", title: text },
    text,
  );
}

function renderStatusCell(row: GradeRow) {
  return h(BaseStatusTag, {
    type: row.status === "ENABLED" ? "success" : "danger",
    label: row.status === "ENABLED" ? "生效" : "作废",
  });
}

function renderOperationCell(row: GradeRow) {
  return h("div", { class: "budget-grade-virtual-table__operations" }, [
    h(
      PermissionButton,
      {
        permission: "system:grade:add",
        link: true,
        type: "primary",
        onClick: () => emit("create", row),
      },
      () => "新增",
    ),
    h(
      PermissionButton,
      {
        permission: "system:grade:edit",
        link: true,
        type: "primary",
        onClick: () => emit("edit", row),
      },
      () => "编辑",
    ),
    h(
      PermissionButton,
      {
        permission:
          row.status === "ENABLED"
            ? "system:grade:remove"
            : "system:grade:edit",
        link: true,
        type: "primary",
        onClick: () => emit("toggle-status", row),
      },
      () => (row.status === "ENABLED" ? "作废" : "启用"),
    ),
  ]);
}
</script>

<template>
  <div
    v-loading="loading"
    class="budget-grade-virtual-table"
    :style="{ height: `${tableHeight}px` }"
  >
    <TraceErrorAlert
      v-if="error"
      :code="error.code"
      :message="error.message"
      :trace-id="error.traceId"
    />
    <BaseEmpty
      v-else-if="!visibleRows.length && !loading"
      title="暂无预算等级"
      description="当前条件下没有可展示的预算等级。"
    />
    <el-auto-resizer v-else>
      <template #default="{ height: autoHeight, width }">
        <el-table-v2
          :columns="columns"
          :data="visibleRows"
          :width="width"
          :height="autoHeight"
          :row-height="66"
          :header-height="52"
          row-key="id"
        />
      </template>
    </el-auto-resizer>
  </div>
</template>

<style scoped>
.budget-grade-virtual-table {
  min-width: 0;
  overflow: hidden;
  color: var(--bq-color-text);
  border-radius: var(--bq-radius-page);
}

.budget-grade-virtual-table :deep(.el-table-v2__header-row),
.budget-grade-virtual-table :deep(.el-table-v2__header-cell) {
  background: var(--bq-color-table-header);
  color: var(--bq-color-text);
  font-weight: 700;
}

.budget-grade-virtual-table :deep(.el-table-v2__header-row) {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.budget-grade-virtual-table :deep(.el-table-v2__row) {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.budget-grade-virtual-table :deep(.el-table-v2__row:hover) {
  background: color-mix(in srgb, var(--bq-color-primary), white 96%);
}

.budget-grade-virtual-table :deep(.budget-grade-virtual-table__name),
.budget-grade-virtual-table :deep(.budget-grade-virtual-table__operations) {
  display: flex;
  align-items: center;
  min-width: 0;
}

.budget-grade-virtual-table :deep(.budget-grade-virtual-table__operations) {
  justify-content: center;
  gap: 4px;
}

.budget-grade-virtual-table :deep(.budget-grade-virtual-table__expand) {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  padding: 0;
}

.budget-grade-virtual-table
  :deep(.budget-grade-virtual-table__expand-placeholder) {
  flex: 0 0 24px;
  width: 24px;
}

.budget-grade-virtual-table :deep(.budget-grade-virtual-table__text) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
