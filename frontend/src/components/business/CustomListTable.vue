<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import type {
  BudgetReviewCellRule,
  BudgetReviewCellSpanRule,
  BudgetReviewListColumn,
  BudgetReviewListPermissionRule,
  BudgetReviewRuleCondition,
  BudgetReviewRowRule,
  BudgetReviewTableRow,
} from "@/types/budget";

type PrincipalContext = {
  userId?: string | number;
  roles?: string[];
};

const props = withDefaults(
  defineProps<{
    columns: BudgetReviewListColumn[];
    rows: BudgetReviewTableRow[];
    rowKey?: string;
    rowRules?: BudgetReviewRowRule[];
    permissions?: BudgetReviewListPermissionRule[];
    principal?: PrincipalContext;
    readonly?: boolean;
    maxHeight?: string;
  }>(),
  {
    rowKey: "rowId",
    rowRules: () => [],
    permissions: () => [],
    principal: () => ({ roles: [] }),
    maxHeight: "calc(100vh - 360px)",
  },
);

const emit = defineEmits<{
  "cell-change": [
    payload: {
      row: BudgetReviewTableRow;
      rowIndex: number;
      column: BudgetReviewListColumn;
      value: string | number | boolean;
    },
  ];
}>();

const visibleColumns = computed(() => normalizeColumns(props.columns));
const leafColumns = computed(() => flattenColumns(visibleColumns.value));
const leafColumnOffsets = computed(() =>
  buildLeafColumnOffsets(leafColumns.value),
);
const headerRows = computed(() => buildHeaderRows(visibleColumns.value));
const tableStyle = computed<CSSProperties>(() => ({
  maxHeight: props.maxHeight,
}));

function normalizeColumns(
  columns: BudgetReviewListColumn[],
): BudgetReviewListColumn[] {
  return columns
    .filter((column) => column.visible !== false)
    .map((column) => ({
      ...column,
      children: column.children?.length
        ? normalizeColumns(column.children)
        : undefined,
    }))
    .filter((column) => column.key || column.children?.length);
}

function flattenColumns(
  columns: BudgetReviewListColumn[],
): BudgetReviewListColumn[] {
  return columns.flatMap((column) =>
    column.children?.length ? flattenColumns(column.children) : [column],
  );
}

function buildHeaderRows(columns: BudgetReviewListColumn[]) {
  const depth = getColumnDepth(columns);
  const rows: Array<
    Array<{
      column: BudgetReviewListColumn;
      colspan: number;
      rowspan: number;
    }>
  > = Array.from({ length: depth }, () => []);

  function visit(column: BudgetReviewListColumn, level: number) {
    const children = column.children?.length ? column.children : [];
    rows[level].push({
      column,
      colspan: children.length ? countLeafColumns(children) : 1,
      rowspan: children.length ? 1 : depth - level,
    });
    children.forEach((child) => visit(child, level + 1));
  }

  columns.forEach((column) => visit(column, 0));
  return rows;
}

function getColumnDepth(columns: BudgetReviewListColumn[]): number {
  if (!columns.length) {
    return 1;
  }
  return Math.max(
    ...columns.map((column) =>
      column.children?.length ? 1 + getColumnDepth(column.children) : 1,
    ),
  );
}

function countLeafColumns(columns: BudgetReviewListColumn[]): number {
  return columns.reduce(
    (total, column) =>
      total + (column.children?.length ? countLeafColumns(column.children) : 1),
    0,
  );
}

function buildLeafColumnOffsets(columns: BudgetReviewListColumn[]) {
  let leftOffset = 0;
  const offsets = new Map<string, number>();
  columns.forEach((column) => {
    if (column.fixed === "left" || column.fixed === true) {
      offsets.set(column.key, column.fixedOffset ?? leftOffset);
      leftOffset += parseColumnWidth(column);
    }
  });
  return offsets;
}

function getRowIdentity(row: BudgetReviewTableRow, rowIndex: number) {
  const value = getValue(row, props.rowKey);
  return value === undefined || value === null || value === ""
    ? `row-${rowIndex}`
    : String(value);
}

function getValue(row: BudgetReviewTableRow, key?: string) {
  if (!key) {
    return undefined;
  }
  const normalizedKey = normalizeFieldKey(key);
  if (normalizedKey.includes(".")) {
    return normalizedKey.split(".").reduce<unknown>((value, part) => {
      if (value && typeof value === "object") {
        return (value as Record<string, unknown>)[part];
      }
      return undefined;
    }, row);
  }
  return row[normalizedKey];
}

function setValue(
  row: BudgetReviewTableRow,
  key: string,
  value: string | number | boolean,
) {
  const normalizedKey = normalizeFieldKey(key);
  const parts = normalizedKey.split(".");
  let target: Record<string, unknown> = row;
  parts.slice(0, -1).forEach((part) => {
    if (!target[part] || typeof target[part] !== "object") {
      target[part] = {};
    }
    target = target[part] as Record<string, unknown>;
  });
  target[parts[parts.length - 1]] = value;
}

function normalizeFieldKey(key: string) {
  return key
    .replace(/^rows\[\]\./, "")
    .replace(/^rows\[\d+\]\./, "")
    .replace(/^row\./, "");
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString("zh-CN") : "--";
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  return String(value);
}

function getDisplayValue(
  row: BudgetReviewTableRow,
  column: BudgetReviewListColumn,
) {
  if (column.formula) {
    return evaluateFormula(column.formula, row);
  }
  return getValue(row, column.key);
}

function updateValue(
  row: BudgetReviewTableRow,
  rowIndex: number,
  column: BudgetReviewListColumn,
  value: string | number | boolean,
) {
  if (!isCellEditable(row, rowIndex, column)) {
    return;
  }
  setValue(row, column.key, value);
  emit("cell-change", { row, rowIndex, column, value });
}

function isCellEditable(
  row: BudgetReviewTableRow,
  rowIndex: number,
  column: BudgetReviewListColumn,
) {
  if (props.readonly || column.readonly || column.formula) {
    return false;
  }
  if (isDeniedByRules(row, rowIndex, column, "EDIT")) {
    return false;
  }
  if (column.editable !== undefined) {
    return column.editable;
  }
  const cellRule = findMatchedCellRules(row, rowIndex, column).find(
    (rule) => rule.editable !== undefined || rule.readonly !== undefined,
  );
  if (cellRule?.readonly) {
    return false;
  }
  if (cellRule?.editable !== undefined) {
    return cellRule.editable;
  }
  const rowRule = findMatchedRowRule(row, rowIndex);
  if (rowRule?.editableColumns?.length) {
    return rowRule.editableColumns.includes(column.key);
  }
  if (rowRule?.readonly) {
    return false;
  }
  if (rowRule?.editable !== undefined) {
    return rowRule.editable;
  }
  return Boolean(column.key);
}

function findMatchedRowRule(row: BudgetReviewTableRow, rowIndex: number) {
  return props.rowRules.find((rule) => matchesRule(row, rule.match, rowIndex));
}

function findMatchedRowRules(row: BudgetReviewTableRow, rowIndex: number) {
  return props.rowRules.filter((rule) =>
    matchesRule(row, rule.match, rowIndex),
  );
}

function findMatchedCellRules(
  row: BudgetReviewTableRow,
  rowIndex: number,
  column: BudgetReviewListColumn,
) {
  return findMatchedRowRules(row, rowIndex)
    .flatMap((rule) => rule.cellRules ?? [])
    .filter((rule) => matchesCellRule(row, rowIndex, column, rule));
}

function matchesRule(
  row: BudgetReviewTableRow,
  match: Record<string, BudgetReviewRuleCondition> | undefined,
  rowIndex: number,
) {
  if (!match || Object.keys(match).length === 0) {
    return false;
  }
  return Object.entries(match).every(([key, condition]) =>
    matchesCondition(getMatchValue(row, rowIndex, key), condition),
  );
}

function matchesCellRule(
  row: BudgetReviewTableRow,
  rowIndex: number,
  column: BudgetReviewListColumn,
  rule: BudgetReviewCellRule,
) {
  const matchesColumn =
    (!rule.columnKey && !rule.columnKeys?.length) ||
    rule.columnKey === column.key ||
    rule.columnKeys?.includes(column.key);
  return matchesColumn && matchesRule(row, rule.match, rowIndex);
}

function getMatchValue(
  row: BudgetReviewTableRow,
  rowIndex: number,
  key: string,
) {
  if (key === "$rowIndex") {
    return rowIndex;
  }
  if (key === "$rowNumber") {
    return rowIndex + 1;
  }
  return getValue(row, key);
}

function matchesCondition(
  value: unknown,
  condition: BudgetReviewRuleCondition,
) {
  if (!isOperatorCondition(condition)) {
    return value === condition;
  }
  return Object.entries(condition).every(([operator, expected]) => {
    switch (operator) {
      case "$eq":
        return value === expected;
      case "$ne":
        return value !== expected;
      case "$in":
        return Array.isArray(expected) && expected.includes(value);
      case "$nin":
        return Array.isArray(expected) && !expected.includes(value);
      case "$gt":
        return toComparableNumber(value) > toComparableNumber(expected);
      case "$gte":
        return toComparableNumber(value) >= toComparableNumber(expected);
      case "$lt":
        return toComparableNumber(value) < toComparableNumber(expected);
      case "$lte":
        return toComparableNumber(value) <= toComparableNumber(expected);
      case "$contains":
        return String(value ?? "").includes(String(expected ?? ""));
      case "$exists":
        return expected
          ? value !== undefined && value !== null
          : value === undefined || value === null;
      default:
        return false;
    }
  });
}

function isOperatorCondition(
  condition: BudgetReviewRuleCondition,
): condition is Record<string, unknown> {
  return (
    Boolean(condition) &&
    typeof condition === "object" &&
    !Array.isArray(condition) &&
    Object.keys(condition as Record<string, unknown>).some((key) =>
      key.startsWith("$"),
    )
  );
}

function toComparableNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  const normalized = String(value ?? "")
    .replace(/,/g, "")
    .replace(/%$/, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : Number.NaN;
}

function isDeniedByRules(
  row: BudgetReviewTableRow,
  rowIndex: number,
  column: BudgetReviewListColumn,
  action: "VIEW" | "EDIT",
) {
  const rules = [...props.permissions, ...(column.permissions ?? [])];
  const rowIdentity = getRowIdentity(row, rowIndex);
  return rules.some((rule) => {
    if (rule.effect !== "DENY" || (rule.action && rule.action !== action)) {
      return false;
    }
    if (!matchesPrincipal(rule)) {
      return false;
    }
    if (rule.scope === "COLUMN") {
      return !rule.columnKey || rule.columnKey === column.key;
    }
    if (rule.scope === "ROW") {
      return !rule.rowKey || String(rule.rowKey) === rowIdentity;
    }
    return (
      (!rule.columnKey || rule.columnKey === column.key) &&
      (!rule.rowKey || String(rule.rowKey) === rowIdentity)
    );
  });
}

function matchesPrincipal(rule: BudgetReviewListPermissionRule) {
  if (
    !rule.principalType ||
    rule.principalId === undefined ||
    rule.principalId === null
  ) {
    return true;
  }
  const principalId = String(rule.principalId);
  if (rule.principalType === "USER") {
    return String(props.principal.userId ?? "") === principalId;
  }
  if (rule.principalType === "ROLE") {
    return props.principal.roles?.includes(principalId);
  }
  return true;
}

function getHeaderStyle(column: BudgetReviewListColumn): CSSProperties {
  return {
    minWidth: getColumnWidth(column),
    width: column.width ? `${column.width}px` : undefined,
    textAlign: column.align ?? "center",
    ...(column.children?.length ? {} : getFixedStyle(column)),
    ...getStyle(column.style),
  };
}

function getCellStyle(
  row: BudgetReviewTableRow,
  rowIndex: number,
  column: BudgetReviewListColumn,
): CSSProperties {
  const rowRules = findMatchedRowRules(row, rowIndex);
  const cellRules = findMatchedCellRules(row, rowIndex, column);
  return {
    minWidth: getColumnWidth(column),
    width: column.width ? `${column.width}px` : undefined,
    textAlign: column.align,
    ...getFixedStyle(column),
    ...rowRules.reduce<CSSProperties>(
      (style, rule) => ({ ...style, ...getStyle(rule.style) }),
      {},
    ),
    ...getStyle(column.style),
    ...cellRules.reduce<CSSProperties>(
      (style, rule) => ({ ...style, ...getStyle(rule.style) }),
      {},
    ),
  };
}

function getColumnWidth(column: BudgetReviewListColumn) {
  return `${parseColumnWidth(column)}px`;
}

function parseColumnWidth(column: BudgetReviewListColumn) {
  return column.width ?? column.minWidth ?? 120;
}

function getFixedStyle(column: BudgetReviewListColumn): CSSProperties {
  if (column.fixed === "left" || column.fixed === true) {
    return {
      position: "sticky",
      left: `${leafColumnOffsets.value.get(column.key) ?? column.fixedOffset ?? 0}px`,
      zIndex: 4,
    };
  }
  if (column.fixed === "right") {
    return {
      position: "sticky",
      right: `${column.fixedOffset ?? 0}px`,
      zIndex: 4,
    };
  }
  return {};
}

function getStyle(style?: Record<string, unknown>): CSSProperties {
  return {
    fontWeight: toBoolean(style?.bold) ? 600 : undefined,
    fontStyle: toBoolean(style?.italic) ? "italic" : undefined,
    textAlign: normalizeTextAlign(style?.textAlign ?? style?.align),
    color: firstColor(style?.textColor, style?.fontColor, style?.color),
    backgroundColor: firstColor(
      style?.backgroundColor,
      style?.fillColor,
      style?.bgColor,
    ),
  };
}

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function normalizeTextAlign(value: unknown): CSSProperties["textAlign"] {
  if (value === "left" || value === "center" || value === "right") {
    return value;
  }
  return undefined;
}

function firstColor(...values: unknown[]) {
  for (const value of values) {
    const color = normalizeColor(value);
    if (color) {
      return color;
    }
  }
  return undefined;
}

function normalizeColor(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === "object") {
    const color = value as { argb?: unknown; rgb?: unknown };
    return normalizeColor(color.argb ?? color.rgb);
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const color = value.trim();
  if (!color) {
    return undefined;
  }
  if (color.startsWith("#")) {
    return color;
  }
  if (/^[0-9A-Fa-f]{6}$/.test(color)) {
    return `#${color}`;
  }
  if (/^[0-9A-Fa-f]{8}$/.test(color)) {
    return `#${color.slice(-6)}`;
  }
  if (/^(rgb|rgba|hsl|hsla)\(/i.test(color)) {
    return color;
  }
  return undefined;
}

function getCellSpan(
  row: BudgetReviewTableRow,
  rowIndex: number,
  column: BudgetReviewListColumn,
) {
  const span = findMatchedRowRules(row, rowIndex)
    .flatMap((rule) => normalizeCellSpans(rule))
    .find((item) => item.columnKey === column.key);
  if (!span) {
    return { rowspan: 1, colspan: 1, hidden: false };
  }
  return {
    rowspan: span.hidden ? 0 : (span.rowspan ?? 1),
    colspan: span.hidden ? 0 : (span.colspan ?? 1),
    hidden: Boolean(span.hidden),
  };
}

function normalizeCellSpans(
  rule: BudgetReviewRowRule,
): BudgetReviewCellSpanRule[] {
  return [...(rule.cellSpan ? [rule.cellSpan] : []), ...(rule.cellSpans ?? [])];
}

function getInputType(column: BudgetReviewListColumn) {
  if (column.type === "number" || column.type === "percent") {
    return "number";
  }
  return "text";
}

function evaluateFormula(formula: string, row: BudgetReviewTableRow) {
  const expression = formula.trim();
  const simpleSum = expression.match(/^SUM\(([^)]+)\)$/i);
  if (simpleSum) {
    return simpleSum[1]
      .split(",")
      .map((key) => Number(getValue(row, key.trim())) || 0)
      .reduce((total, value) => total + value, 0);
  }
  const arithmetic = expression.match(/^([\w.]+)\s*([+\-*/])\s*([\w.]+)$/);
  if (!arithmetic) {
    return formatValue(getValue(row, expression));
  }
  const left = Number(getValue(row, arithmetic[1])) || 0;
  const right = Number(getValue(row, arithmetic[3])) || 0;
  switch (arithmetic[2]) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0 ? "--" : left / right;
    default:
      return "--";
  }
}
</script>

<template>
  <div class="custom-list-table" :style="tableStyle">
    <table class="custom-list-table__table">
      <thead>
        <tr
          v-for="(headerRow, headerRowIndex) in headerRows"
          :key="headerRowIndex"
        >
          <th
            v-for="header in headerRow"
            :key="`${headerRowIndex}-${header.column.key || header.column.label}`"
            :colspan="header.colspan"
            :rowspan="header.rowspan"
            :style="getHeaderStyle(header.column)"
            :class="{ 'is-required': header.column.required }"
          >
            {{ header.column.label || header.column.key || "--" }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, rowIndex) in rows"
          :key="getRowIdentity(row, rowIndex)"
        >
          <template
            v-for="column in leafColumns"
            :key="`${getRowIdentity(row, rowIndex)}-${column.key}`"
          >
            <td
              v-if="!getCellSpan(row, rowIndex, column).hidden"
              :rowspan="getCellSpan(row, rowIndex, column).rowspan"
              :colspan="getCellSpan(row, rowIndex, column).colspan"
              :style="getCellStyle(row, rowIndex, column)"
              :class="{ 'is-required': column.required }"
            >
              <el-input
                v-if="isCellEditable(row, rowIndex, column)"
                :model-value="String(getDisplayValue(row, column) ?? '')"
                :type="getInputType(column)"
                :autosize="
                  column.type === 'textarea'
                    ? { minRows: 1, maxRows: 4 }
                    : undefined
                "
                maxlength="500"
                @update:model-value="updateValue(row, rowIndex, column, $event)"
              />
              <span v-else>{{
                formatValue(getDisplayValue(row, column))
              }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.custom-list-table {
  max-width: 100%;
  overflow: auto;
  background: var(--bq-color-surface);
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: 6px;
}

.custom-list-table__table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
}

.custom-list-table__table th,
.custom-list-table__table td {
  max-width: 320px;
  padding: 8px 10px;
  border-right: 1px solid var(--bq-color-border-subtle);
  border-bottom: 1px solid var(--bq-color-border-subtle);
  vertical-align: middle;
  word-break: break-word;
}

.custom-list-table__table th {
  position: sticky;
  top: 0;
  z-index: 2;
  color: var(--bq-color-text);
  font-weight: 600;
  background: var(--bq-color-fill-subtle);
}

.custom-list-table__table td {
  background: var(--bq-color-surface);
}

.custom-list-table__table .is-required::before {
  margin-right: 2px;
  color: var(--bq-color-danger);
  content: "*";
}

.custom-list-table :deep(.el-input) {
  color: inherit;
  font: inherit;
  text-align: inherit;
}

.custom-list-table :deep(.el-input__inner) {
  color: inherit;
  font: inherit;
  text-align: inherit;
}

.custom-list-table :deep(.el-input__wrapper) {
  color: inherit;
  background: transparent;
  box-shadow: none;
}
</style>
