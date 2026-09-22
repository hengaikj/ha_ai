<script setup lang="ts">
import {
  cloneVNode,
  Comment,
  computed,
  defineComponent,
  Fragment,
  h,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  onUpdated,
  ref,
  useAttrs,
  useSlots,
  watchEffect,
  type Slot,
  type VNode,
} from "vue";
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
} from "element-plus";
import { getActivePinia } from "pinia";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useAuthStore } from "@/stores/auth";

type ColumnConfigItem = {
  key: string;
  label: string;
  disabled?: boolean;
};

type ElTableExpose = {
  clearSelection?: () => void;
  toggleRowSelection?: (row: unknown, selected?: boolean) => void;
  toggleRowExpansion?: (row: unknown, expanded?: boolean) => void;
  doLayout?: () => void;
};

type SortChangePayload = {
  column?: unknown;
  prop?: string;
  order?: "ascending" | "descending" | null;
};

type SlotScope = Record<string, unknown>;

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
    defineProps<{
      data: unknown[];
      loading?: boolean;
      error?: {
        code: string;
        message: string;
        traceId?: string;
      } | null;
      rowKey?: string;
      emptyTitle?: string;
      emptyDescription?: string;
      enableColumnSettings?: boolean;
    }>(),
    {
      loading: false,
      error: null,
      rowKey: "id",
      emptyTitle: "暂无数据",
      emptyDescription: "当前条件下没有可展示的数据。",
      enableColumnSettings: false,
    },
);

const emit = defineEmits<{
  "sort-change": [payload: SortChangePayload];
}>();

const attrs = useAttrs();
const slots = useSlots();
const activePinia = getActivePinia();
const authStore = activePinia ? useAuthStore(activePinia) : null;
const tableRef = ref<ElTableExpose>();
const rootRef = ref<HTMLElement | null>(null);
const visibleColumnKeys = ref<string[]>([]);
const columnConfigs = ref<ColumnConfigItem[]>([]);
const hasInitializedVisibleColumns = ref(false);
const knownColumnKeys = ref<string[]>([]);
const isHorizontalScrollable = ref(false);
const isHorizontalDragging = ref(false);
const horizontalDragThreshold = 5;
let horizontalScrollContainer: HTMLElement | null = null;
let horizontalResizeObserver: ResizeObserver | null = null;
let horizontalDragStartTarget: HTMLElement | null = null;
let horizontalDragStartX = 0;
let horizontalDragStartScrollLeft = 0;
let horizontalDragPending = false;
let suppressClickUntil = 0;
let lastHorizontalScrollLeft = Number.NaN;
let lastHorizontalViewportWidth = Number.NaN;
let horizontalMaxScrollLeft = 0;
const resolvedTableAttrs = computed(() => {
  const nextAttrs = { ...attrs };

  if (!hasAttr(nextAttrs, "tableLayout", "table-layout")) {
    nextAttrs.tableLayout = "auto";
  }
  if (!hasAttr(nextAttrs, "showOverflowTooltip", "show-overflow-tooltip")) {
    nextAttrs.showOverflowTooltip = true;
  }

  return nextAttrs;
});

const RenderVNode = defineComponent({
  name: "RenderVNode",
  props: {
    node: {
      type: Object as () => VNode,
      required: true,
    },
  },
  setup(renderProps) {
    return () => h(cloneVNode(renderProps.node));
  },
});

const ActionOverflowMenu = defineComponent({
  name: "ActionOverflowMenu",
  props: {
    nodes: {
      type: Array as () => VNode[],
      required: true,
    },
  },
  setup(renderProps) {
    return () =>
        h(
            ElDropdown,
            {
              trigger: "click",
              onClick: (event: MouseEvent) => event.stopPropagation(),
            },
            {
              default: () =>
                  h(
                      ElButton,
                      {
                        class: "bq-table-actions__more",
                        text: true,
                        type: "primary",
                      },
                      () => "...",
                  ),
              dropdown: () =>
                  h(
                      ElDropdownMenu,
                      null,
                      () =>
                          renderProps.nodes.map((node, index) =>
                              h(ElDropdownItem, { key: index }, () =>
                                  h(RenderVNode, { node: normalizeOverflowActionNode(node) }),
                              ),
                          ),
                  ),
            },
        );
  },
});

const renderedDefaultNodes = computed(() => {
  const defaultSlot = slots.default as Slot | undefined;
  const slotNodes = defaultSlot?.() ?? [];

  const nextNodes = props.enableColumnSettings
      ? filterColumnNodes(flattenNodes(slotNodes), visibleColumnKeys.value)
      : slotNodes;

  return normalizeColumnNodes(nextNodes);
});

watchEffect(() => {
  if (!props.enableColumnSettings) {
    return;
  }

  const defaultSlot = slots.default as Slot | undefined;
  const slotNodes = defaultSlot?.() ?? [];
  const nextConfigs = collectColumnConfigs(slotNodes);

  columnConfigs.value = nextConfigs;

  const configKeys = nextConfigs.map((item) => item.key);

  if (!hasInitializedVisibleColumns.value) {
    visibleColumnKeys.value = configKeys;
    knownColumnKeys.value = configKeys;
    hasInitializedVisibleColumns.value = true;
    return;
  }

  const knownKeySet = new Set(knownColumnKeys.value);
  const visibleKeySet = new Set(visibleColumnKeys.value);
  const nextVisibleKeys = configKeys.filter(
    (key) => visibleKeySet.has(key) || !knownKeySet.has(key),
  );

  knownColumnKeys.value = configKeys;

  if (
    nextVisibleKeys.length === visibleColumnKeys.value.length &&
    nextVisibleKeys.every((key, index) => key === visibleColumnKeys.value[index])
  ) {
    return;
  }

  visibleColumnKeys.value = nextVisibleKeys;
});

function filterColumnNodes(nodes: VNode[], visibleKeys: string[]) {
  const visibleKeySet = new Set(visibleKeys);

  return nodes.flatMap((node) => {
    const columnMeta = getColumnMeta(node);

    if (!columnMeta) {
      return [node];
    }

    if (!columnMeta.configurable) {
      return [node];
    }

    if (visibleKeySet.has(columnMeta.key)) {
      return [node];
    }

    return [];
  });
}

function collectColumnConfigs(nodes: VNode[]) {
  return flattenNodes(nodes).flatMap((node) => {
    const columnMeta = getColumnMeta(node);

    if (!columnMeta || !columnMeta.configurable) {
      return [];
    }

    return [
      {
        key: columnMeta.key,
        label: columnMeta.label,
        disabled: columnMeta.disabled,
      },
    ];
  });
}

function flattenNodes(nodes: VNode[]): VNode[] {
  return nodes.flatMap((node) => {
    if (Array.isArray(node.children)) {
      return flattenNodes(node.children as VNode[]);
    }

    return [node];
  });
}

function normalizeColumnNodes(nodes: VNode[]): VNode[] {
  return nodes.map((node) => {
    if (!isTableColumnNode(node)) {
      if (!Array.isArray(node.children)) {
        return node;
      }
      const cloned = cloneVNode(node);
      cloned.children = normalizeColumnNodes(node.children as VNode[]);
      return cloned;
    }

    const columnVNodeKey = getColumnVNodeKey(node);
    const keyedNode =
      columnVNodeKey !== undefined && node.key == null
        ? cloneVNode(node, { key: columnVNodeKey })
        : node;
    const normalizedProps = normalizeColumnProps(
      (keyedNode.props ?? {}) as Record<string, unknown>,
    );
    const normalizedNode = normalizedProps
      ? cloneVNode(keyedNode, normalizedProps)
      : keyedNode;
    const columnSlots = nodeChildren(normalizedNode);
    const defaultSlot = columnSlots?.default;
    if (!isUtilityColumnNode(normalizedNode) && typeof defaultSlot === "function") {
      const cloned = cloneVNode(normalizedNode);
      cloned.children = {
        ...columnSlots,
        default: (slotScope: SlotScope) => {
          return normalizeSlotNodes((defaultSlot as Slot)(slotScope));
        },
      };
      return isOperationColumnNode(cloned)
        ? normalizeOperationColumnNode(cloned)
        : cloned;
    }

    return isOperationColumnNode(normalizedNode)
        ? normalizeOperationColumnNode(normalizedNode)
        : normalizedNode;
  });
}

function getColumnVNodeKey(node: VNode) {
  const columnProps = (node.props ?? {}) as Record<string, unknown>;
  const type = String(columnProps.type ?? "");
  const prop = String(columnProps.prop ?? columnProps.columnKey ?? "");
  const label = String(columnProps.label ?? "");

  if (type) {
    return `bq-column-type-${type}`;
  }
  if (prop) {
    return `bq-column-prop-${prop}`;
  }
  if (label) {
    return `bq-column-label-${label}`;
  }

  return undefined;
}

function normalizeSlotNodes(value: unknown): VNode[] {
  if (!Array.isArray(value)) {
    return value ? [value as VNode] : [];
  }

  return value.filter((node): node is VNode => Boolean(node));
}

function normalizeOperationColumnNode(node: VNode) {
  const children = node.children;

  if (!children || typeof children !== "object" || Array.isArray(children)) {
    return node;
  }

  const columnSlots = children as Record<string, unknown>;
  const defaultSlot = columnSlots.default;

  if (typeof defaultSlot !== "function") {
    return node;
  }

  const nextSlots = {
    ...columnSlots,
    default: (slotScope: SlotScope) =>
        renderOperationCellWithOverflow(defaultSlot as Slot, slotScope),
  };

  const cloned = cloneVNode(node);
  cloned.children = nextSlots;

  return cloned;
}

function renderOperationCellWithOverflow(defaultSlot: Slot, slotScope: SlotScope) {
  const slotNodes = defaultSlot(slotScope);
  const buttonNodes = collectPermissionButtonNodes(slotNodes).filter(
    isPermissionButtonAllowed,
  );
  const dropdownNodes = collectDropdownNodes(slotNodes);

  if (!canSafelyCollapseActionNodes(slotNodes)) {
    return slotNodes;
  }

  // Keep pages that already provide their own action layout unchanged.
  if (hasTableActionsContainer(slotNodes)) {
    return slotNodes;
  }

  if (dropdownNodes.length > 0) {
    return [
      h(
        "div",
        {
          class: "bq-table-actions",
          onClick: (event: MouseEvent) => event.stopPropagation(),
        },
        slotNodes.map((node) => h(RenderVNode, { node })),
      ),
    ];
  }

  if (buttonNodes.length <= 3) {
    return [
      h(
        "div",
        {
          class: "bq-table-actions",
          onClick: (event: MouseEvent) => event.stopPropagation(),
        },
        slotNodes.map((node) => h(RenderVNode, { node })),
      ),
    ];
  }

  const visibleButtonNodes = buttonNodes.slice(0, 2);
  const overflowButtonNodes = buttonNodes.slice(2);

  if (overflowButtonNodes.length === 0) {
    return slotNodes;
  }

  return [
    h(
        "div",
        {
          class: "bq-table-actions",
          onClick: (event: MouseEvent) => event.stopPropagation(),
        },
        [
          ...visibleButtonNodes.map((node) => h(RenderVNode, { node })),
          ...dropdownNodes.map((node) => h(RenderVNode, { node })),
          h(ActionOverflowMenu, { nodes: overflowButtonNodes }),
        ],
    ),
  ];
}

function collectPermissionButtonNodes(nodes: VNode[]): VNode[] {
  return nodes.flatMap((node) => {
    if (isPermissionButtonNode(node)) {
      return [node];
    }

    if (isTransparentActionContainerNode(node)) {
      return collectPermissionButtonNodes(getChildNodes(node));
    }

    return [];
  });
}

function isPermissionButtonAllowed(node: VNode) {
  if (!authStore) {
    return true;
  }

  const permission = (node.props as Record<string, unknown> | null)?.permission;
  if (
    permission === undefined ||
    typeof permission === "string" ||
    (Array.isArray(permission) &&
      permission.every((item) => typeof item === "string"))
  ) {
    return authStore.hasPermission(permission as string | string[] | undefined);
  }

  return true;
}

function collectDropdownNodes(nodes: VNode[]): VNode[] {
  return nodes.flatMap((node) => {
    if (isDropdownNode(node)) {
      return [node];
    }

    if (isTransparentActionContainerNode(node)) {
      return collectDropdownNodes(getChildNodes(node));
    }

    return [];
  });
}

function normalizeOverflowActionNode(node: VNode) {
  if (!isPermissionButtonNode(node)) {
    return node;
  }

  const nodeProps = (node.props ?? {}) as Record<string, unknown>;

  if (nodeProps.type !== "primary") {
    return node;
  }

  const cloned = cloneVNode(node);
  const clonedProps = { ...((cloned.props ?? {}) as Record<string, unknown>) };
  delete clonedProps.type;
  cloned.props = clonedProps;

  return cloned;
}

function canSafelyCollapseActionNodes(nodes: VNode[]): boolean {
  return nodes.every((node) => {
    if (isIgnorableNode(node) || isPermissionButtonNode(node) || isDropdownNode(node)) {
      return true;
    }

    if (isTransparentActionContainerNode(node)) {
      return canSafelyCollapseActionNodes(getChildNodes(node));
    }

    return false;
  });
}

function getChildNodes(node: VNode) {
  return Array.isArray(node.children) ? (node.children as VNode[]) : [];
}

function isTransparentActionContainerNode(node: VNode) {
  if (node.type === Fragment) {
    return true;
  }

  if (typeof node.type !== "string") {
    return false;
  }

  if (node.type !== "div" && node.type !== "span") {
    return false;
  }

  return Array.isArray(node.children);
}

function hasTableActionsContainer(nodes: VNode[]): boolean {
  return nodes.some((node) => {
    if (isTransparentActionContainerNode(node)) {
      if (hasTableActionsClass(node)) {
        return true;
      }

      return hasTableActionsContainer(getChildNodes(node));
    }

    return false;
  });
}

function hasTableActionsClass(node: VNode) {
  const className = (node.props as Record<string, unknown> | null)?.class;

  if (typeof className === "string") {
    return className.split(/\s+/).includes("bq-table-actions");
  }

  if (Array.isArray(className)) {
    return className.includes("bq-table-actions");
  }

  return false;
}

function isIgnorableNode(node: VNode) {
  if (node.type === Comment) {
    return true;
  }

  return typeof node.children === "string" && node.children.trim() === "";
}

function isPermissionButtonNode(node: VNode) {
  return node.type === PermissionButton || getNodeName(node) === "PermissionButton";
}

function isDropdownNode(node: VNode) {
  return node.type === ElDropdown || getNodeName(node) === "ElDropdown";
}

function normalizeColumnProps(
  props: Record<string, unknown>,
) {
  const label = String(props.label ?? "");
  const type = String(props.type ?? "");
  const prop = String(props.prop ?? "");
  const normalizedProps: Record<string, unknown> = {};
  const align = props.align ?? "center";

  if (!hasAttr(props, "align")) {
    normalizedProps.align = align;
  }

  if (!hasAttr(props, "headerAlign", "header-align")) {
    normalizedProps.headerAlign = align;
  }

  if (isUtilityColumn(type, label)) {
    return hasNormalizedProps(normalizedProps) ? normalizedProps : null;
  }

  if (prop) {
    const currentFormatter = props.formatter;
    normalizedProps.formatter = (row: unknown, column: unknown, value: unknown, index: number) => {
      if (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "")
      ) {
        return "--";
      }

      return typeof currentFormatter === "function"
        ? currentFormatter(row, column, value, index)
        : value;
    };
  }

  /*
  // 根据表头和当前数据内容推算列的最小宽度，暂时停用。
  const width = toNumber(props.width);
  if (width !== undefined) {
    return hasNormalizedProps(normalizedProps) ? normalizedProps : null;
  }

  const minWidthKey = props["min-width"] !== undefined ? "min-width" : "minWidth";
  const currentMinWidth = toNumber(props[minWidthKey]);
  const compactMinWidth = inferCompactMinWidth(label, prop, rows);

  if (currentMinWidth === undefined || currentMinWidth < compactMinWidth) {
    normalizedProps[minWidthKey] = compactMinWidth;
  }
  */

  return hasNormalizedProps(normalizedProps) ? normalizedProps : null;
}

function nodeChildren(node: VNode) {
  return node.children && typeof node.children === "object" && !Array.isArray(node.children)
    ? (node.children as Record<string, unknown>)
    : null;
}

function isUtilityColumnNode(node: VNode) {
  const columnProps = (node.props ?? {}) as Record<string, unknown>;
  return isUtilityColumn(String(columnProps.type ?? ""), String(columnProps.label ?? ""));
}

function isUtilityColumn(type: string, label: string) {
  return (
    type === "selection" ||
    type === "expand" ||
    type === "index" ||
    label === "操作" ||
    label.includes("图片")
  );
}

function isOperationColumnNode(node: VNode) {
  if (!isTableColumnNode(node)) {
    return false;
  }

  const columnProps = (node.props ?? {}) as Record<string, unknown>;
  return columnProps.label === "操作";
}

/*
function inferCompactMinWidth(label: string, prop: string, rows: unknown[]) {
  const key = `${label} ${prop}`.toLowerCase();
  const labelWidth = Math.ceil(textVisualLength(label) * 11 + 36);
  const contentWidth = inferContentMinWidth(prop, rows);
  const minWidth = Math.max(88, labelWidth, contentWidth);

  if (/(时间|日期|time|date|created|updated|sop)/i.test(key)) {
    return clamp(minWidth, 132, 220);
  }
  if (/(备注|说明|描述|地址|路径|名称|name|title|remark|description)/i.test(key)) {
    return clamp(minWidth, 128, 260);
  }
  if (/(编号|编码|代码|单号|code|no|number|id)/i.test(key)) {
    return clamp(minWidth, 108, 220);
  }
  if (/(金额|价格|售价|数量|销量|比例|率|cost|price|amount|count|rate|plan)/i.test(key)) {
    return clamp(minWidth, 104, 180);
  }
  return clamp(minWidth, 96, 220);
}

function inferContentMinWidth(prop: string, rows: unknown[]) {
  if (!prop) {
    return 0;
  }

  const maxContentLength = rows.reduce<number>((maxLength, row) => {
    if (!isRecord(row)) {
      return maxLength;
    }
    const value = row[prop];
    if (value === undefined || value === null || value === "") {
      return maxLength;
    }
    return Math.max(maxLength, textVisualLength(String(value)));
  }, 0);

  return Math.ceil(maxContentLength * 8 + 36);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function textVisualLength(text: string) {
  return Array.from(text).reduce((total, char) => {
    return total + (char.charCodeAt(0) > 255 ? 1.6 : 1);
  }, 0);
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
*/

function hasNormalizedProps(props: Record<string, unknown>) {
  return Object.keys(props).length > 0;
}

function getColumnMeta(node: VNode) {
  if (!isTableColumnNode(node)) {
    return null;
  }

  const props = (node.props ?? {}) as Record<string, unknown>;
  const type = typeof props.type === "string" ? props.type : "";
  const configurable = type !== "selection" && type !== "expand" && type !== "index";

  const prop =
      typeof props.prop === "string"
          ? props.prop
          : typeof props.columnKey === "string"
              ? props.columnKey
              : "";

  const label = typeof props.label === "string" ? props.label : prop;
  const key = prop || label;

  if (!key) {
    return null;
  }

  return {
    key,
    label,
    configurable,
    disabled: false,
  };
}

function isTableColumnNode(node: VNode) {
  const nodeType = node.type as { name?: string; __name?: string } | string;

  if (typeof nodeType === "string") {
    return nodeType === "el-table-column";
  }

  return nodeType?.name === "ElTableColumn" || nodeType?.__name === "ElTableColumn";
}

function getNodeName(node: VNode) {
  const nodeType = node.type as { name?: string; __name?: string } | string;

  if (typeof nodeType === "string") {
    return nodeType;
  }

  return nodeType?.name || nodeType?.__name || "";
}

function hasAttr(attrs: Record<string, unknown>, ...keys: string[]) {
  return keys.some((key) => attrs[key] !== undefined);
}

function setVisibleColumns(keys: string[]) {
  visibleColumnKeys.value = keys;
}

function getColumnSettings() {
  return {
    columns: columnConfigs.value,
    visibleColumns: visibleColumnKeys.value,
  };
}

const columnSettings = computed(() => ({
  columns: columnConfigs.value,
  visibleColumns: visibleColumnKeys.value,
}));

function findHorizontalScrollContainer() {
  if (!rootRef.value) {
    return null;
  }

  return (
    rootRef.value.querySelector<HTMLElement>(
      ".el-table__body-wrapper .el-scrollbar__wrap",
    ) ?? rootRef.value.querySelector<HTMLElement>(".el-table__body-wrapper")
  );
}

function syncHorizontalScrollLeft() {
  const root = rootRef.value;
  if (!root) {
    return;
  }

  const rawScrollLeft = Math.max(
    0,
    horizontalScrollContainer?.scrollLeft ?? 0,
  );
  if (rawScrollLeft > horizontalMaxScrollLeft) {
    horizontalMaxScrollLeft = Math.max(
      0,
      (horizontalScrollContainer?.scrollWidth ?? 0) -
        (horizontalScrollContainer?.clientWidth ?? 0),
    );
  }
  const scrollLeft = Math.min(
    horizontalMaxScrollLeft,
    rawScrollLeft,
  );

  if (scrollLeft === lastHorizontalScrollLeft) {
    return;
  }

  root.style.setProperty("--bq-table-scroll-left", `${scrollLeft}px`);
  lastHorizontalScrollLeft = scrollLeft;
}

function syncHorizontalViewportWidth() {
  const root = rootRef.value;
  if (!root) {
    return;
  }

  const viewportWidth = Math.max(
    0,
    horizontalScrollContainer?.clientWidth ?? 0,
  );
  horizontalMaxScrollLeft = Math.max(
    0,
    (horizontalScrollContainer?.scrollWidth ?? 0) - viewportWidth,
  );
  if (viewportWidth === lastHorizontalViewportWidth) {
    return;
  }

  if (viewportWidth > 0) {
    root.style.setProperty("--bq-table-viewport-width", `${viewportWidth}px`);
  } else {
    root.style.removeProperty("--bq-table-viewport-width");
  }
  lastHorizontalViewportWidth = viewportWidth;
}

function syncHorizontalScrollMetrics() {
  syncHorizontalViewportWidth();
  syncHorizontalScrollLeft();
}

function handleHorizontalScroll() {
  syncHorizontalScrollLeft();
}

function syncHorizontalScrollState() {
  const nextScrollContainer = findHorizontalScrollContainer();

  if (nextScrollContainer !== horizontalScrollContainer) {
    horizontalResizeObserver?.disconnect();
    horizontalScrollContainer?.removeEventListener(
      "scroll",
      handleHorizontalScroll,
    );
    horizontalScrollContainer = nextScrollContainer;
    lastHorizontalScrollLeft = Number.NaN;
    lastHorizontalViewportWidth = Number.NaN;
    horizontalMaxScrollLeft = 0;

    if (horizontalScrollContainer) {
      horizontalScrollContainer.addEventListener(
        "scroll",
        handleHorizontalScroll,
        { passive: true },
      );
      if (globalThis.ResizeObserver) {
        horizontalResizeObserver = new globalThis.ResizeObserver(
          syncHorizontalScrollState,
        );
        horizontalResizeObserver.observe(horizontalScrollContainer);
      }
    }
  }

  syncHorizontalScrollMetrics();

  isHorizontalScrollable.value = Boolean(
    horizontalScrollContainer &&
    horizontalScrollContainer.scrollWidth >
      horizontalScrollContainer.clientWidth + 1,
  );

  if (!isHorizontalScrollable.value) {
    stopHorizontalDrag(false);
  }
}

function scheduleHorizontalScrollStateSync() {
  void nextTick(syncHorizontalScrollState);
}

function isHorizontalDragStartAllowed(event: MouseEvent) {
  if (
    event.button !== 0 ||
    !isHorizontalScrollable.value ||
    !horizontalScrollContainer ||
    !(event.target instanceof HTMLElement)
  ) {
    return false;
  }

  const cell = event.target.closest<HTMLElement>("td.el-table__cell");

  return Boolean(
    cell &&
    event.target === cell &&
    rootRef.value?.contains(cell) &&
    !cell.matches(
      ".el-table-fixed-column--left, .el-table-fixed-column--right",
    ),
  );
}

function handleHorizontalDragStart(event: MouseEvent) {
  syncHorizontalScrollState();
  if (!isHorizontalDragStartAllowed(event) || !horizontalScrollContainer) {
    return;
  }

  horizontalDragPending = true;
  horizontalDragStartTarget = event.target as HTMLElement;
  horizontalDragStartX = event.clientX;
  horizontalDragStartScrollLeft = horizontalScrollContainer.scrollLeft;
  globalThis.addEventListener("mousemove", handleHorizontalDragMove, {
    passive: false,
  });
  globalThis.addEventListener("mouseup", handleHorizontalDragEnd);
}

function handleHorizontalDragMove(event: MouseEvent) {
  if (!horizontalDragPending || !horizontalScrollContainer) {
    return;
  }

  const distance = event.clientX - horizontalDragStartX;
  if (
    !isHorizontalDragging.value &&
    Math.abs(distance) < horizontalDragThreshold
  ) {
    return;
  }

  isHorizontalDragging.value = true;
  event.preventDefault();
  horizontalScrollContainer.scrollLeft =
    horizontalDragStartScrollLeft - distance;
  syncHorizontalScrollLeft();
}

function handleHorizontalDragEnd() {
  stopHorizontalDrag(isHorizontalDragging.value);
}

function stopHorizontalDrag(shouldSuppressClick: boolean) {
  if (shouldSuppressClick) {
    suppressClickUntil = Date.now() + 250;
  } else {
    suppressClickUntil = 0;
    horizontalDragStartTarget = null;
  }

  horizontalDragPending = false;
  isHorizontalDragging.value = false;
  globalThis.removeEventListener("mousemove", handleHorizontalDragMove);
  globalThis.removeEventListener("mouseup", handleHorizontalDragEnd);
}

function handleHorizontalDragClick(event: MouseEvent) {
  if (Date.now() > suppressClickUntil) {
    suppressClickUntil = 0;
    horizontalDragStartTarget = null;
    return;
  }

  if (
    !horizontalDragStartTarget ||
    !(event.target instanceof HTMLElement) ||
    !horizontalDragStartTarget.contains(event.target)
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  suppressClickUntil = 0;
  horizontalDragStartTarget = null;
}

function setupHorizontalScrollSync() {
  teardownHorizontalScrollSync();
  globalThis.addEventListener("resize", scheduleHorizontalScrollStateSync);
  scheduleHorizontalScrollStateSync();
}

function teardownHorizontalScrollSync() {
  horizontalResizeObserver?.disconnect();
  horizontalResizeObserver = null;
  horizontalScrollContainer?.removeEventListener(
    "scroll",
    handleHorizontalScroll,
  );
  horizontalScrollContainer = null;
  globalThis.removeEventListener("resize", scheduleHorizontalScrollStateSync);
  stopHorizontalDrag(false);
}

onMounted(setupHorizontalScrollSync);
onActivated(setupHorizontalScrollSync);
onDeactivated(teardownHorizontalScrollSync);

onUpdated(scheduleHorizontalScrollStateSync);

onBeforeUnmount(teardownHorizontalScrollSync);

defineExpose({
  clearSelection() {
    tableRef.value?.clearSelection?.();
  },
  toggleRowSelection(row: unknown, selected?: boolean) {
    tableRef.value?.toggleRowSelection?.(row, selected);
  },
  toggleRowExpansion(row: unknown, expanded?: boolean) {
    tableRef.value?.toggleRowExpansion?.(row, expanded);
  },
  doLayout() {
    tableRef.value?.doLayout?.();
  },
  setVisibleColumns,
  getColumnSettings,
  columnSettings,
});
</script>

<template>
  <section
    ref="rootRef"
    class="base-data-table"
    :class="{
      'is-horizontal-scrollable': isHorizontalScrollable,
      'is-horizontal-dragging': isHorizontalDragging,
    }"
    @mousedown="handleHorizontalDragStart"
    @click.capture="handleHorizontalDragClick"
  >
    <TraceErrorAlert
        v-if="error"
        :code="error.code"
        :message="error.message"
        :trace-id="error.traceId"
    />

    <el-table
        ref="tableRef"
        v-loading="loading"
        v-bind="resolvedTableAttrs"
        :data="data"
        :row-key="rowKey"
        @sort-change="emit('sort-change', $event)"
    >
      <RenderVNode
          v-for="(node, index) in renderedDefaultNodes"
          :key="index"
          :node="node"
      />
      <template #empty>
        <slot name="empty">
          <BaseEmpty :title="emptyTitle" :description="emptyDescription" />
        </slot>
      </template>
    </el-table>
  </section>
</template>

<style scoped>
.base-data-table {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.base-data-table :deep(.el-table) {
  overflow: hidden;
  color: var(--bq-color-text);
  border-radius: var(--bq-radius-page);
}

.base-data-table :deep(.el-table__cell) {
  padding: 10px 0;
}

.base-data-table :deep(.el-table .cell) {
  padding: 0 8px;
  line-height: 20px;
  white-space: nowrap;
}

.base-data-table :deep(th.el-table__cell) {
  background: var(--bq-color-table-header);
  color: var(--bq-color-text);
  font-weight: 700;
}

.base-data-table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: color-mix(in srgb, var(--bq-color-primary), white 96%);
}

.base-data-table :deep(.bq-table-actions__more) {
  box-sizing: border-box;
  width: 48px;
}

.base-data-table.is-horizontal-scrollable
  :deep(
    .el-table__body
      td.el-table__cell:not(.el-table-fixed-column--left):not(
        .el-table-fixed-column--right
      )
  ) {
  cursor: grab;
}

.base-data-table.is-horizontal-scrollable
  :deep(.el-table__body td.el-table__cell .cell) {
  cursor: auto;
}

.base-data-table.is-horizontal-dragging :deep(.el-table__body-wrapper),
.base-data-table.is-horizontal-dragging
  :deep(.el-table__body td.el-table__cell) {
  cursor: grabbing;
  user-select: none;
}

.base-data-table
:deep(
    .el-table__body tr:hover > td.el-table__cell.el-table-fixed-column--left
  ),
.base-data-table
:deep(
    .el-table__body tr:hover > td.el-table__cell.el-table-fixed-column--right
  ) {
  background: color-mix(in srgb, var(--bq-color-primary), white 96%);
}
</style>
