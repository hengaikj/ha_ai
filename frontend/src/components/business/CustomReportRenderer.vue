<script setup lang="ts">
import { computed } from "vue";
import type {
  BudgetReviewListColumn,
  BudgetReviewListPermissionRule,
  BudgetReviewReportSection,
  BudgetReviewRowRule,
  BudgetReviewTableRow,
} from "@/types/budget";
import CustomListTable from "./CustomListTable.vue";

type PrincipalContext = {
  userId?: string | number;
  roles?: string[];
};

type CompareProject = {
  id: string | number;
  title: string;
  hasPattens?: boolean;
};

const props = withDefaults(
  defineProps<{
    title?: string;
    sections?: BudgetReviewReportSection[];
    columns?: BudgetReviewListColumn[];
    rows: BudgetReviewTableRow[];
    rowKey?: string;
    rowRules?: BudgetReviewRowRule[];
    permissions?: BudgetReviewListPermissionRule[];
    compareProjects?: CompareProject[];
    principal?: PrincipalContext;
    readonly?: boolean;
    maxHeight?: string;
  }>(),
  {
    title: "",
    sections: () => [],
    columns: () => [],
    rowKey: "rowId",
    rowRules: () => [],
    permissions: () => [],
    compareProjects: () => [],
    principal: () => ({ roles: [] }),
    maxHeight: "calc(100vh - 360px)",
  },
);

const normalizedSections = computed(() => {
  const sections = props.sections.filter(
    (section) => section.visible !== false,
  );
  if (sections.length) {
    return sections;
  }
  if (!props.columns.length) {
    return [];
  }
  return [
    {
      key: "main",
      title: props.title || "列表",
      type: "table",
      columns: props.columns,
      rowKey: props.rowKey,
      rowRules: props.rowRules,
      permissions: props.permissions,
      readonly: props.readonly,
    },
  ] satisfies BudgetReviewReportSection[];
});

function resolveRows(section: BudgetReviewReportSection) {
  const rowsKey = section.rowsKey;
  if (!rowsKey) {
    return props.rows;
  }
  const nestedRows = props.rows.flatMap((row) => {
    const value = getValue(row, rowsKey);
    return Array.isArray(value) ? value : [];
  });
  return nestedRows.length
    ? (nestedRows as BudgetReviewTableRow[])
    : props.rows;
}

function resolveColumns(section: BudgetReviewReportSection) {
  const baseColumns = section.columns?.length ? section.columns : props.columns;
  if (section.type !== "compare" || !props.compareProjects.length) {
    return baseColumns;
  }
  const compareColumns = section.compareColumns?.length
    ? section.compareColumns
    : baseColumns;
  return [
    ...baseColumns,
    ...props.compareProjects.map((project, index) => {
      const projectColumns =
        project.hasPattens === false && section.compareColumnsNoPattern?.length
          ? section.compareColumnsNoPattern
          : compareColumns;
      return {
        key: `compare_${project.id}`,
        label: project.title,
        readonly: true,
        children: prefixColumns(projectColumns, `_loop${index}`),
      };
    }),
  ];
}

function prefixColumns(
  columns: BudgetReviewListColumn[],
  prefix: string,
): BudgetReviewListColumn[] {
  return columns.map((column) => {
    if (column.children?.length) {
      return {
        ...column,
        key: `${prefix}${column.key}`,
        readonly: true,
        children: prefixColumns(column.children, prefix),
      };
    }
    return {
      ...column,
      key: `${prefix}${column.key}`,
      readonly: true,
      editable: false,
      formula: undefined,
    };
  });
}

function getValue(row: BudgetReviewTableRow, key: string) {
  return key.split(".").reduce<unknown>((value, part) => {
    if (value && typeof value === "object") {
      return (value as Record<string, unknown>)[part];
    }
    return undefined;
  }, row);
}
</script>

<template>
  <div class="custom-report-renderer">
    <section
      v-for="section in normalizedSections"
      :key="section.key"
      class="custom-report-renderer__section"
      :class="`is-${section.type || 'table'}`"
    >
      <div class="custom-report-renderer__section-header">
        <h3>{{ section.title }}</h3>
      </div>
      <CustomListTable
        :columns="resolveColumns(section)"
        :rows="resolveRows(section)"
        :row-key="section.rowKey || rowKey"
        :row-rules="section.rowRules ?? rowRules"
        :permissions="[...permissions, ...(section.permissions ?? [])]"
        :principal="principal"
        :readonly="readonly || section.readonly"
        :max-height="maxHeight"
      />
    </section>
  </div>
</template>

<style scoped>
.custom-report-renderer {
  display: grid;
  gap: 12px;
}

.custom-report-renderer__section {
  min-width: 0;
}

.custom-report-renderer__section-header {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 8px 12px;
  color: var(--bq-color-text);
  background: var(--bq-color-fill-subtle);
  border: 1px solid var(--bq-color-border-subtle);
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
}

.custom-report-renderer__section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.custom-report-renderer__section :deep(.custom-list-table) {
  border-radius: 0 0 6px 6px;
}
</style>
