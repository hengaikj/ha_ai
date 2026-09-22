<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  onUpdated,
  ref,
  useAttrs,
  watch,
} from "vue";
import BaseColumnSettings from "@/components/base/BaseColumnSettings.vue";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import BasePagination from "@/components/base/BasePagination.vue";
import BaseSearchForm from "@/components/base/BaseSearchForm.vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseToolbar from "@/components/base/BaseToolbar.vue";
import { ApiBusinessError } from "@/api/http";

type ErrorInfo = {
  code: string;
  message: string;
  traceId?: string;
};

type PaginationValue = number | string;

type QueryTableResult<T = unknown> = {
  total: PaginationValue;
  list: T[];
  pageNo?: PaginationValue;
  pageSize?: PaginationValue;
};

type QueryTableSortDirection = "ASC" | "DESC";

type QueryTableSort = {
  sortField?: string;
  sortDirection?: QueryTableSortDirection;
};

type QueryTableSetDataOptions = {
  pageNo?: PaginationValue;
  pageSize?: PaginationValue;
};

type ScrollPosition = {
  element: HTMLElement;
  top: number;
  left: number;
};

type QueryTableFunc<T = unknown> = (
  pageSize: number,
  pageNum: number,
  sort: QueryTableSort,
) => Promise<QueryTableResult<T>>;

type SortChangePayload = {
  prop?: string;
  order?: "ascending" | "descending" | null;
};

type BaseDataTableExpose = {
  clearSelection: () => void;
  toggleRowSelection?: (row: unknown, selected?: boolean) => void;
  toggleRowExpansion?: (row: unknown, expanded?: boolean) => void;
  setVisibleColumns?: (keys: string[]) => void;
  getColumnSettings?: () => {
    columns: Array<{
      key: string;
      label: string;
      disabled?: boolean;
    }>;
    visibleColumns: string[];
  };
};

type BasePaginationExpose = {
  getElement: () => HTMLElement | undefined;
};

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    func?: QueryTableFunc;
    data?: unknown[];
    error?: ErrorInfo | null;
    rowKey?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    showSearch?: boolean;
    showToolbar?: boolean;
    showPagination?: boolean;
    paginationOnly?: boolean;
    enableColumnSettings?: boolean;
    fixedPagination?: boolean;
    searchFormProps?: Record<string, unknown>;
    toolbarProps?: Record<string, unknown>;
    tableProps?: Record<string, unknown>;
    defaultSort?: QueryTableSort;
    fitTableHeight?: boolean;
    fitTableToContainer?: boolean;
    fitTableMinHeight?: number;
    pagination?: {
      pageNo?: PaginationValue;
      pageSize?: PaginationValue;
      total?: PaginationValue;
    };
    paginationProps?: Record<string, unknown>;
    columnSettingsProps?: Record<string, unknown>;
  }>(),
  {
    func: undefined,
    data: undefined,
    error: null,
    rowKey: "id",
    emptyTitle: "暂无数据",
    emptyDescription: "当前条件下没有可展示的数据。",
    showSearch: true,
    showToolbar: false,
    showPagination: true,
    paginationOnly: false,
    enableColumnSettings: true,
    fixedPagination: true,
    searchFormProps: () => ({}),
    toolbarProps: () => ({}),
    tableProps: () => ({}),
    defaultSort: () => ({}),
    fitTableHeight: false,
    fitTableToContainer: false,
    fitTableMinHeight: 260,
    pagination: undefined,
    paginationProps: () => ({}),
    columnSettingsProps: () => ({}),
  },
);

const emit = defineEmits<{
  search: [];
  reset: [];
  refresh: [];
  error: [error: unknown];
  "page-change": [pageNum: number];
  "size-change": [pageSize: number];
  "sort-change": [sort: QueryTableSort];
  loaded: [rows: unknown[]];
}>();

const attrs = useAttrs();
const slots = defineSlots<{
  search?: () => unknown;
  filters?: () => unknown;
  searchActions?: () => unknown;
  toolbar?: () => unknown;
  toolbarExtra?: () => unknown;
  beforeTable?: () => unknown;
  content?: (props: {
    list: unknown[];
    loading: boolean;
    error: ErrorInfo | null;
    height?: number;
  }) => unknown;
  empty?: () => unknown;
  default?: () => unknown;
}>();

const rootRef = ref<HTMLElement | null>(null);
const tableWrapRef = ref<HTMLElement | null>(null);
const tableRef = ref<BaseDataTableExpose | null>(null);
const paginationRef = ref<BasePaginationExpose | null>(null);
const list = ref<unknown[]>(props.data ?? []);
const total = ref(
  normalizeTotal(props.pagination?.total ?? props.data?.length ?? 0),
);
const pageNum = ref(normalizePageNo(props.pagination?.pageNo, 1));
const pageSize = ref(normalizePageSize(props.pagination?.pageSize, 10));
const sortState = ref<QueryTableSort>(normalizeSort(props.defaultSort));
const innerLoading = ref(false);
const innerError = ref<ErrorInfo | null>(props.error ?? null);
const fitTableHeightValue = ref<number | undefined>();
let requestId = 0;
let resizeObserver: ResizeObserver | null = null;
let fitTableHeightSyncFrame: number | null = null;
let lastToastErrorKey = "";

const searchVisible = ref(props.showSearch);
const hasSearch = computed(() => Boolean(slots.search ?? slots.filters));
const shouldRenderSearch = computed(
  () => !props.paginationOnly && searchVisible.value && hasSearch.value,
);
const shouldRenderToolbar = computed(
  () =>
    !props.paginationOnly &&
    (props.showToolbar ||
      Boolean(slots.toolbar) ||
      Boolean(slots.toolbarExtra) ||
      !props.func),
);
const resolvedSearchFormProps = computed(() => ({
  ...props.searchFormProps,
}));
const resolvedToolbarProps = computed(() => ({
  ...props.toolbarProps,
  showSearchToggle:
    typeof props.toolbarProps.showSearchToggle === "boolean"
      ? props.toolbarProps.showSearchToggle
      : hasSearch.value,
  searchVisible: searchVisible.value,
}));
watch(
  () => props.showSearch,
  (value) => {
    searchVisible.value = value;
  },
);
const resolvedTableProps = computed(() => {
  const nextProps = {
    ...attrs,
    ...props.tableProps,
  };

  if (
    sortState.value.sortField &&
    sortState.value.sortDirection &&
    !hasAttr(nextProps, "defaultSort", "default-sort")
  ) {
    nextProps.defaultSort = {
      prop: sortState.value.sortField,
      order:
        sortState.value.sortDirection === "ASC" ? "ascending" : "descending",
    };
  }

  if (
    props.fitTableHeight &&
    fitTableHeightValue.value &&
    !hasExplicitTableHeight(nextProps)
  ) {
    return {
      ...nextProps,
      height: fitTableHeightValue.value,
    };
  }

  return nextProps;
});
const resolvedPaginationProps = computed(() => ({
  ...props.paginationProps,
}));
const isFixedPagination = computed(() =>
  Boolean(
    typeof resolvedPaginationProps.value.fixed === "boolean"
      ? resolvedPaginationProps.value.fixed
      : props.fixedPagination,
  ),
);
const shouldRenderFixedPaginationSpacer = computed(
  () =>
    props.showPagination && isFixedPagination.value && !props.fitTableHeight,
);

async function loadData(options: { preserveScroll?: boolean } = {}) {
  const scrollPositions = options.preserveScroll
    ? captureScrollPositions()
    : [];

  if (!props.func) {
    list.value = props.data ?? [];
    total.value = normalizeTotal(
      props.pagination?.total ?? props.data?.length ?? 0,
    );
    innerError.value = props.error ?? null;
    if (innerError.value) {
      showLoadErrorToast(innerError.value);
    } else {
      lastToastErrorKey = "";
    }
    await restoreScrollPositions(scrollPositions);
    return;
  }

  const currentRequestId = ++requestId;
  innerLoading.value = true;
  innerError.value = null;

  try {
    await loadCurrentPage(currentRequestId, true);
  } catch (error) {
    if (currentRequestId !== requestId) {
      return;
    }

    list.value = [];
    total.value = 0;
    innerError.value =
      props.error ??
      (error instanceof ApiBusinessError
        ? {
            code: error.code,
            message: error.message,
            traceId: error.traceId,
          }
        : {
            code: "QUERY_TABLE_LOAD_FAILED",
            message: error instanceof Error ? error.message : "数据加载失败",
          });
    if (!(error instanceof ApiBusinessError)) {
      showLoadErrorToast(innerError.value);
    }
    emit("error", error);
  } finally {
    if (currentRequestId === requestId) {
      innerLoading.value = false;
    }
    scheduleFitTableHeightSync();
    await restoreScrollPositions(scrollPositions);
  }
}

async function loadCurrentPage(
  currentRequestId: number,
  allowPageFallback: boolean,
) {
  if (!props.func) {
    return;
  }

  const result = await props.func(pageSize.value, pageNum.value, {
    ...sortState.value,
  });

  if (currentRequestId !== requestId) {
    return;
  }

  syncPageStateFromResult(result);
  const nextTotal = normalizeTotal(result.total);
  const lastPageNo = resolveLastPageNo(nextTotal, pageSize.value);
  if (pageNum.value > lastPageNo) {
    pageNum.value = lastPageNo;
    emit("page-change", lastPageNo);
    if (allowPageFallback && nextTotal > 0) {
      await loadCurrentPage(currentRequestId, false);
      return;
    }
  }

  list.value = result.list;
  total.value = nextTotal;
  innerError.value = null;
  lastToastErrorKey = "";
  await nextTick();
  emit("loaded", result.list);
}

function syncPageStateFromResult(result: QueryTableResult) {
  pageSize.value = normalizePageSize(result.pageSize, pageSize.value);
  pageNum.value = normalizePageNo(result.pageNo, pageNum.value);
}

function normalizeTotal(nextTotal: unknown) {
  const parsedTotal = parsePaginationNumber(nextTotal);
  return Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : 0;
}

function normalizePageNo(nextPageNo: unknown, fallbackPageNo: number) {
  const parsedPageNo = parsePaginationNumber(nextPageNo);
  return Number.isInteger(parsedPageNo) && parsedPageNo > 0
    ? parsedPageNo
    : fallbackPageNo;
}

function normalizePageSize(nextPageSize: unknown, fallbackPageSize: number) {
  const parsedPageSize = parsePaginationNumber(nextPageSize);
  return Number.isInteger(parsedPageSize) && parsedPageSize > 0
    ? parsedPageSize
    : fallbackPageSize;
}

function parsePaginationNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    return Number(value);
  }
  return Number.NaN;
}

function resolveLastPageNo(nextTotal: number, nextPageSize: number) {
  return Math.max(1, Math.ceil(nextTotal / nextPageSize));
}

function normalizeSort(sort?: QueryTableSort): QueryTableSort {
  return {
    sortField: sort?.sortField || undefined,
    sortDirection: normalizeSortDirection(sort?.sortDirection),
  };
}

function normalizeSortDirection(
  direction?: string,
): QueryTableSortDirection | undefined {
  return direction === "ASC" || direction === "DESC" ? direction : undefined;
}

function handleSearch() {
  pageNum.value = 1;
  emit("search");
  void loadData();
}

function handleReset() {
  pageNum.value = 1;
  emit("reset");
  void loadData();
}

function handleRefresh() {
  emit("refresh");
  void loadData({ preserveScroll: true });
}

function handlePageChange(nextPageNum: number) {
  pageNum.value = nextPageNum;
  emit("page-change", nextPageNum);
  void loadData();
}

function handleSizeChange(nextPageSize: number) {
  pageSize.value = nextPageSize;
  pageNum.value = 1;
  emit("size-change", nextPageSize);
  void loadData();
}

function handleSortChange(payload: SortChangePayload) {
  sortState.value = {
    sortField: payload.order ? payload.prop || undefined : undefined,
    sortDirection:
      payload.order === "ascending"
        ? "ASC"
        : payload.order === "descending"
          ? "DESC"
          : undefined,
  };
  pageNum.value = 1;
  emit("sort-change", { ...sortState.value });
  void loadData();
}

onMounted(() => {
  void loadData();
  setupFitTableHeightSync();
  scheduleFitTableHeightSync();
});

onUpdated(() => {
  scheduleFitTableHeightSync();
});

onActivated(() => {
  setupFitTableHeightSync();
  scheduleFitTableHeightSync();
});

onDeactivated(teardownFitTableHeightSync);
onBeforeUnmount(teardownFitTableHeightSync);

function teardownFitTableHeightSync() {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (fitTableHeightSyncFrame !== null && globalThis.cancelAnimationFrame) {
    globalThis.cancelAnimationFrame(fitTableHeightSyncFrame);
    fitTableHeightSyncFrame = null;
  }
  globalThis.removeEventListener("resize", scheduleFitTableHeightSync);
}

watch(
  () => [props.data, props.error, props.pagination] as const,
  () => {
    if (!props.func) {
      void loadData();
    }
    scheduleFitTableHeightSync();
  },
  { deep: true },
);

watch(
  () => [
    props.fitTableHeight,
    props.showPagination,
    props.fixedPagination,
    props.fitTableMinHeight,
    props.tableProps,
    list.value.length,
    total.value,
  ],
  () => {
    scheduleFitTableHeightSync();
  },
  { deep: true },
);

function setupFitTableHeightSync() {
  teardownFitTableHeightSync();
  globalThis.addEventListener("resize", scheduleFitTableHeightSync);

  if (!props.fitTableHeight || !globalThis.ResizeObserver || !rootRef.value) {
    return;
  }

  resizeObserver = new globalThis.ResizeObserver(() => {
    scheduleFitTableHeightSync();
  });
  resizeObserver.observe(rootRef.value);
}

function scheduleFitTableHeightSync() {
  if (!props.fitTableHeight) {
    fitTableHeightValue.value = undefined;
    return;
  }

  // 侧边栏动画和 ResizeObserver 可能在同一帧内多次触发，合并为一次测量。
  if (fitTableHeightSyncFrame !== null) return;
  const run = () => {
    fitTableHeightSyncFrame = null;
    syncFitTableHeight();
  };
  void nextTick(() => {
    if (globalThis.requestAnimationFrame) {
      fitTableHeightSyncFrame = globalThis.requestAnimationFrame(run);
    } else {
      run();
    }
  });
}

function syncFitTableHeight() {
  const tableWrapElement = tableWrapRef.value;
  if (!tableWrapElement || !globalThis.window) {
    return;
  }

  const tableTop = tableWrapElement.getBoundingClientRect().top;
  const viewportHeight =
    globalThis.window.innerHeight ||
    globalThis.document?.documentElement.clientHeight ||
    0;
  if (!viewportHeight || tableTop <= 0) {
    return;
  }

  const paginationElement =
    paginationRef.value?.getElement() ??
    (rootRef.value?.querySelector(".base-pagination") as HTMLElement | null);
  const paginationRect = paginationElement?.getBoundingClientRect();
  const sectionGap = readPixelCssVariable("--bq-space-section", 12);
  const pageBottomGap = readPixelCssVariable("--bq-space-page-y", 10);
  const tableScrollbarReserve = 0;
  const fallbackFixedPaginationHeight = 52;
  const hasFixedPagination = props.showPagination && isFixedPagination.value;
  const paginationHeight =
    props.showPagination && paginationRect
      ? paginationRect.height
      : hasFixedPagination
        ? fallbackFixedPaginationHeight
        : 0;
  let bottomBoundary: number;
  if (hasFixedPagination) {
    bottomBoundary = paginationRect?.top ?? viewportHeight - paginationHeight;
  } else {
    const containerBottom = props.fitTableToContainer
      ? (rootRef.value?.getBoundingClientRect().bottom ?? viewportHeight)
      : viewportHeight;
    bottomBoundary = containerBottom - paginationHeight - pageBottomGap;
  }
  const tableBottomGap = hasFixedPagination ? 0 : sectionGap;
  const nextHeight = Math.floor(
    bottomBoundary - tableTop - tableBottomGap - tableScrollbarReserve,
  );

  const resolvedHeight = Math.max(props.fitTableMinHeight, nextHeight);
  if (fitTableHeightValue.value !== resolvedHeight) {
    fitTableHeightValue.value = resolvedHeight;
  }
}

function readPixelCssVariable(name: string, fallback: number) {
  if (!globalThis.window || !rootRef.value) {
    return fallback;
  }

  const rawValue = globalThis.window
    .getComputedStyle(rootRef.value)
    .getPropertyValue(name)
    .trim();
  const parsedValue = Number.parseFloat(rawValue);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function hasExplicitTableHeight(tableProps: Record<string, unknown>) {
  return (
    tableProps.height !== undefined ||
    tableProps.maxHeight !== undefined ||
    tableProps["max-height"] !== undefined
  );
}

function hasAttr(attrs: Record<string, unknown>, ...keys: string[]) {
  return keys.some((key) => attrs[key] !== undefined);
}

function showLoadErrorToast(errorInfo: ErrorInfo) {
  const toastKey = `${errorInfo.code}-${errorInfo.message}-${errorInfo.traceId ?? ""}`;
  if (toastKey === lastToastErrorKey) {
    return;
  }

  lastToastErrorKey = toastKey;
  BaseToast.error(formatLoadErrorMessage(errorInfo), 5000);
}

function formatLoadErrorMessage(errorInfo: ErrorInfo) {
  if (
    errorInfo.code === "QUERY_TABLE_LOAD_FAILED" ||
    !errorInfo.code ||
    errorInfo.traceId === "unknown"
  ) {
    return errorInfo.message;
  }

  const traceText = errorInfo.traceId ? `，追踪号：${errorInfo.traceId}` : "";
  return `${errorInfo.message}（错误码：${errorInfo.code}${traceText}）`;
}

defineExpose({
  reload: () => loadData({ preserveScroll: true }),
  search: handleSearch,
  reset: handleReset,
  refresh: handleRefresh,
  getSort() {
    return { ...sortState.value };
  },
  setData(
    nextList: unknown[],
    nextTotal?: number,
    nextPagination?: QueryTableSetDataOptions,
  ) {
    list.value = nextList;
    if (nextTotal !== undefined) {
      total.value = normalizeTotal(nextTotal);
    }
    if (nextPagination?.pageSize !== undefined) {
      pageSize.value = normalizePageSize(
        nextPagination.pageSize,
        pageSize.value,
      );
    }
    if (nextPagination?.pageNo !== undefined) {
      pageNum.value = normalizePageNo(nextPagination.pageNo, pageNum.value);
    }
  },
  getData() {
    return list.value;
  },
  clearSelection() {
    tableRef.value?.clearSelection?.();
  },
  toggleRowSelection(row: unknown, selected?: boolean) {
    tableRef.value?.toggleRowSelection?.(row, selected);
  },
  getTableRef() {
    return tableRef.value;
  },
});

function captureScrollPositions(): ScrollPosition[] {
  if (!tableWrapRef.value) return [];

  return Array.from(tableWrapRef.value.querySelectorAll<HTMLElement>("*"))
    .filter((element) => {
      const style = globalThis.window?.getComputedStyle(element);
      const canScrollVertically =
        element.scrollHeight > element.clientHeight &&
        (style?.overflowY === "auto" || style?.overflowY === "scroll");
      const canScrollHorizontally =
        element.scrollWidth > element.clientWidth &&
        (style?.overflowX === "auto" || style?.overflowX === "scroll");
      return canScrollVertically || canScrollHorizontally;
    })
    .map((element) => ({
      element,
      top: element.scrollTop,
      left: element.scrollLeft,
    }));
}

async function restoreScrollPositions(positions: ScrollPosition[]) {
  if (!positions.length) return;
  await nextTick();
  positions.forEach(({ element, top, left }) => {
    if (!element.isConnected) return;
    element.scrollTop = Math.min(
      top,
      Math.max(0, element.scrollHeight - element.clientHeight),
    );
    element.scrollLeft = Math.min(
      left,
      Math.max(0, element.scrollWidth - element.clientWidth),
    );
  });
}
</script>

<template>
  <section
    ref="rootRef"
    class="query-table"
    :class="{ 'is-pagination-only': paginationOnly }"
  >
    <BaseSearchForm
      v-if="shouldRenderSearch"
      v-bind="resolvedSearchFormProps"
      :loading="innerLoading"
      @search="handleSearch"
      @reset="handleReset"
    >
      <slot name="search">
        <slot name="filters" />
      </slot>
      <template v-if="$slots.searchActions" #actions>
        <slot name="searchActions" />
      </template>
    </BaseSearchForm>

    <BaseToolbar
      v-if="shouldRenderToolbar"
      v-bind="resolvedToolbarProps"
      @refresh="handleRefresh"
      @toggle-search="searchVisible = !searchVisible"
    >
      <slot name="toolbar" />
      <template #extra>
        <slot name="toolbarExtra">
          <BaseColumnSettings
            v-if="enableColumnSettings"
            v-bind="columnSettingsProps"
            :target="tableRef"
          />
        </slot>
      </template>
    </BaseToolbar>

    <slot v-if="!paginationOnly" name="beforeTable" />

    <div v-if="!paginationOnly" ref="tableWrapRef" class="query-table__table">
      <slot
        v-if="$slots.content"
        name="content"
        :list="list"
        :loading="innerLoading"
        :error="innerError"
        :height="fitTableHeightValue"
      />
      <BaseDataTable
        v-else
        ref="tableRef"
        v-bind="resolvedTableProps"
        :data="list"
        :error="innerError"
        :loading="innerLoading"
        :row-key="rowKey"
        :empty-title="emptyTitle"
        :empty-description="emptyDescription"
        :enable-column-settings="enableColumnSettings"
        @sort-change="handleSortChange"
      >
        <slot />
        <template v-if="$slots.empty" #empty>
          <slot name="empty" />
        </template>
      </BaseDataTable>
    </div>

    <BasePagination
      v-if="showPagination"
      ref="paginationRef"
      v-bind="resolvedPaginationProps"
      :page-no="pageNum"
      :page-size="pageSize"
      :total="total"
      :fixed="isFixedPagination"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
    />
    <div
      v-if="shouldRenderFixedPaginationSpacer"
      class="bq-fixed-pagination-spacer"
      aria-hidden="true"
    />
  </section>
</template>

<style scoped>
.query-table {
  display: grid;
  align-content: start;
  gap: var(--bq-space-section);
  min-width: 0;
}

.query-table__table {
  min-width: 0;
}

.query-table.is-pagination-only {
  display: block;
}
</style>
