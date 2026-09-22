<script setup lang="ts" generic="T extends Record<string, any>">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  ref,
  shallowRef,
  watch,
} from "vue";
import { Loading } from "@element-plus/icons-vue";

export type InfiniteSelectPage<T> = {
  records: T[];
  total?: number;
};

export type ValueType = string | number;

const props = withDefaults(
  defineProps<{
    modelValue?: ValueType | ValueType[] | null;
    /** 分页查询接口函数，入参包含 pageNo(从1开始), pageSize, keyword */
    fetchApi: (params: { pageNo: number; pageSize: number; keyword: string }) => Promise<InfiniteSelectPage<T>>;
    /** 选项值的属性名或取值函数，默认 'value' */
    valueKey?: keyof T | string | ((item: T) => ValueType);
    /** 选项展示文本的属性名或取值函数，默认 'label' */
    labelKey?: keyof T | string | ((item: T) => string);
    /** 选项禁用状态属性名或判断函数，默认 'disabled' */
    disabledKey?: keyof T | string | ((item: T) => boolean);
    /** 每页条数，默认 20 */
    pageSize?: number;
    /** 下拉菜单最大高度，例如 '160px' 或 200，便于在选项条数较少时也能产生滚动条 */
    maxHeight?: string | number;
    /** 占位提示文字 */
    placeholder?: string;
    /** 是否可清空 */
    clearable?: boolean;
    /** 是否可搜索 */
    filterable?: boolean;
    /** 是否禁用 */
    disabled?: boolean;
    /** 是否多选 */
    multiple?: boolean;
    /** 多选时是否折叠 tag */
    collapseTags?: boolean;
    /** 多选折叠 tooltip */
    collapseTagsTooltip?: boolean;
    /** 搜索防抖延迟（毫秒），默认 300 */
    debounceMs?: number;
    /** 触底判断阈值（距离底部像素），默认 30 */
    threshold?: number;
    /** 自定义 label 格式化函数，例如 (item) => `${item.factoryName}/${item.factoryCode}` */
    labelFormatter?: (item: T) => string;
    /** 回显保底数据：单选传单个对象，多选可传对象数组 */
    initialOption?: T | T[] | null;
    /** 是否展示底部状态提示（加载中 / 已加载全部），默认 false */
    showFooter?: boolean;
    /** 自定义弹出框 class */
    popperClass?: string;
    /** 清空后是否自动弹出下拉菜单重新选择，默认 true */
    reopenOnClear?: boolean;
  }>(),
  {
    modelValue: undefined,
    valueKey: "value",
    labelKey: "label",
    disabledKey: "disabled",
    pageSize: 20,
    maxHeight: undefined,
    placeholder: "请选择",
    clearable: true,
    filterable: true,
    disabled: false,
    multiple: false,
    collapseTags: false,
    collapseTagsTooltip: false,
    debounceMs: 300,
    threshold: 30,
    labelFormatter: undefined,
    initialOption: null,
    showFooter: false,
    popperClass: "",
    reopenOnClear: true,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: ValueType | ValueType[] | null | undefined];
  change: [value: ValueType | ValueType[] | null | undefined, selectedRow?: T | T[] | null];
  clear: [];
}>();

const selectRef = ref();
const popperUid = `infinite-select-popper-${Math.random().toString(36).slice(2, 9)}`;
const options = shallowRef<T[]>([]);
const cachedSelectedItems = shallowRef<Map<string, T>>(new Map());
const keyword = ref("");
const pageNo = ref(1);
const total = ref<number | undefined>(undefined);
const loading = ref(false);
const loadingMore = ref(false);
const dropdownVisible = ref(false);
const hasLoadedInitialPage = ref(false);

let requestVersion = 0;
let echoVersion = 0;
let scrollElement: HTMLElement | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let attachScrollTimers: ReturnType<typeof setTimeout>[] = [];

function getRawValue(item: T): ValueType {
  if (typeof props.valueKey === "function") {
    return props.valueKey(item);
  }
  const key = props.valueKey as keyof T;
  return (item[key] ?? "") as ValueType;
}

function getRawLabel(item: T): string {
  if (props.labelFormatter) {
    return props.labelFormatter(item);
  }
  if (typeof props.labelKey === "function") {
    return String(props.labelKey(item));
  }
  const key = props.labelKey as keyof T;
  return String(item[key] ?? "");
}

function getRawDisabled(item: T): boolean {
  if (typeof props.disabledKey === "function") {
    return Boolean(props.disabledKey(item));
  }
  const key = props.disabledKey as keyof T;
  return Boolean(item[key]);
}

const hasMore = computed(() => {
  if (total.value === undefined) return true;
  return options.value.length < total.value;
});

const combinedPopperClass = computed(() => {
  return [popperUid, "base-infinite-select-popper", props.popperClass].filter(Boolean).join(" ");
});

// 合并选项列表（带去重并优先保留新数据）
function mergeOptions(newRecords: T[]) {
  const map = new Map<string, T>();
  // 1. 先保留已选择或缓存的项，保证回显不丢失
  cachedSelectedItems.value.forEach((val, k) => {
    map.set(k, val);
  });
  // 2. 存入原有列表
  for (const item of options.value) {
    map.set(String(getRawValue(item)), item);
  }
  // 3. 追加新一页并覆盖旧条目
  for (const item of newRecords) {
    map.set(String(getRawValue(item)), item);
  }
  options.value = Array.from(map.values());
}

async function loadData(reset = false) {
  if (loading.value || loadingMore.value) return;
  if (!reset && !hasMore.value) return;

  if (reset) {
    pageNo.value = 1;
    total.value = undefined;
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  const currentVersion = ++requestVersion;
  const currentPage = reset ? 1 : pageNo.value + 1;

  try {
    const res = await props.fetchApi({
      pageNo: currentPage,
      pageSize: props.pageSize,
      keyword: keyword.value,
    });

    // 竞态控制：丢弃过期响应
    if (currentVersion !== requestVersion) {
      return;
    }

    pageNo.value = currentPage;
    total.value = res.total ?? 0;

    if (reset) {
      const map = new Map<string, T>();
      cachedSelectedItems.value.forEach((val, k) => {
        map.set(k, val);
      });
      for (const item of res.records ?? []) {
        map.set(String(getRawValue(item)), item);
      }
      options.value = Array.from(map.values());
    } else {
      mergeOptions(res.records ?? []);
    }
  } catch (error) {
    console.error("[BaseInfiniteSelect] 加载数据失败:", error);
  } finally {
    if (currentVersion === requestVersion) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

function onSearch(query: string) {
  if (!dropdownVisible.value) return;
  keyword.value = query.trim();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    void loadData(true);
  }, props.debounceMs);
}

function getScrollWrap(): HTMLElement | null {
  const popper = document.querySelector(`.${popperUid}`);
  if (popper) {
    const wrap = popper.querySelector<HTMLElement>(".el-scrollbar__wrap");
    if (wrap) return wrap;
  }
  return document.querySelector<HTMLElement>(`.${popperUid} .el-scrollbar__wrap`);
}

function checkAndTriggerLoadMore(targetElement?: HTMLElement | null) {
  if (loading.value || loadingMore.value || !hasMore.value) return;
  const el = targetElement || getScrollWrap();
  if (!el) return;

  const { scrollTop, scrollHeight, clientHeight } = el;
  // 内容不足以滚动时不触发
  if (scrollHeight <= clientHeight) return;

  if (scrollHeight - scrollTop - clientHeight <= props.threshold) {
    void loadData(false);
  }
}

function onPopupScroll() {
  checkAndTriggerLoadMore();
}

function onEndReached(direction?: string) {
  if (direction === "bottom" || !direction) {
    if (!loading.value && !loadingMore.value && hasMore.value) {
      void loadData(false);
    }
  }
}

function onNativeScroll(event: Event) {
  checkAndTriggerLoadMore(event.target as HTMLElement);
}

function attachScroll() {
  const wrap = getScrollWrap();
  if (wrap && wrap !== scrollElement) {
    if (scrollElement) {
      scrollElement.removeEventListener("scroll", onNativeScroll);
    }
    scrollElement = wrap;
    scrollElement.addEventListener("scroll", onNativeScroll, { passive: true });
    // 如果设置了 maxHeight，动态应用到滚动容器
    if (props.maxHeight) {
      const heightVal = typeof props.maxHeight === "number" ? `${props.maxHeight}px` : props.maxHeight;
      scrollElement.style.maxHeight = heightVal;
    }
  }
}

function detachScroll() {
  if (scrollElement) {
    scrollElement.removeEventListener("scroll", onNativeScroll);
    scrollElement = null;
  }
}

function clearAttachScrollTimers() {
  attachScrollTimers.forEach(clearTimeout);
  attachScrollTimers = [];
}

function closeDropdown() {
  dropdownVisible.value = false;
  keyword.value = "";
  selectRef.value?.blur?.();
  detachScroll();
  clearAttachScrollTimers();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  requestVersion += 1;
  echoVersion += 1;
  loading.value = false;
  loadingMore.value = false;
}

function openDropdown() {
  nextTick(() => {
    selectRef.value?.focus?.();
    if (!dropdownVisible.value) {
      if (typeof selectRef.value?.toggleMenu === "function") {
        selectRef.value.toggleMenu();
      } else {
        const trigger =
          selectRef.value?.$el?.querySelector(".el-select__wrapper") ||
          selectRef.value?.$el?.querySelector(".select-trigger") ||
          selectRef.value?.$el;
        trigger?.click?.();
      }
    }
  });
}

function onVisibleChange(visible: boolean) {
  dropdownVisible.value = visible;
  if (visible) {
    if (!hasLoadedInitialPage.value || options.value.length === 0) {
      hasLoadedInitialPage.value = true;
      void loadData(true);
    }
    void nextTick(() => {
      attachScroll();
      clearAttachScrollTimers();
      attachScrollTimers = [
        setTimeout(attachScroll, 100),
        setTimeout(attachScroll, 250),
      ];
    });
  } else {
    detachScroll();
    if (keyword.value) {
      keyword.value = "";
      void loadData(true);
    }
  }
}

/**
 * 自动回显搜索补全机制：
 * 当当前 modelValue 在本地 options 中不存在时，
 * 自动以该值作为关键词调用搜索接口，获取完整的实体并填入选项池，
 * 从而准确回显格式化为“名称/代码”，彻底解决未分页到当前项时丢 Label 的问题。
 */
async function resolveEchoOption(val: ValueType | ValueType[] | null | undefined) {
  if (val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) {
    return;
  }
  const values = Array.isArray(val) ? val : [val];
  const missingKeys = values.map(String).filter((v) => {
    return (
      !options.value.some((opt) => String(getRawValue(opt)) === v) &&
      !cachedSelectedItems.value.has(v)
    );
  });

  if (missingKeys.length === 0) return;

  const currentEchoVer = ++echoVersion;

  for (const missingKey of missingKeys) {
    try {
      const res = await props.fetchApi({
        pageNo: 1,
        pageSize: 5,
        keyword: missingKey,
      });
      if (currentEchoVer !== echoVersion) return;
      const records = res.records || [];
      const target = records.find((item) => String(getRawValue(item)) === missingKey) || records[0];
      if (target) {
        const key = String(getRawValue(target));
        cachedSelectedItems.value.set(key, target);
        const next = [...options.value];
        const existingIndex = next.findIndex((opt) => String(getRawValue(opt)) === key);
        if (existingIndex >= 0) {
          next[existingIndex] = target;
        } else {
          next.unshift(target);
        }
        options.value = next;
      }
    } catch {
      // 忽略单条回显检索异常
    }
  }
}

watch(
  () => props.modelValue,
  (val) => {
    void resolveEchoOption(val);
  },
  { immediate: true },
);

function syncInitialOption(val: T | T[] | null | undefined) {
  if (!val) return;
  const list = Array.isArray(val) ? val : [val];
  let changed = false;
  const nextOptions = [...options.value];

  list.forEach((item) => {
    if (item) {
      const key = String(getRawValue(item));
      cachedSelectedItems.value.set(key, item);
      const index = nextOptions.findIndex((opt) => String(getRawValue(opt)) === key);
      if (index >= 0) {
        nextOptions[index] = item;
        changed = true;
      } else {
        nextOptions.unshift(item);
        changed = true;
      }
    }
  });

  if (changed) {
    options.value = nextOptions;
  }
}

watch(() => props.initialOption, syncInitialOption, { immediate: true, deep: true });

function handleChange(val: ValueType | ValueType[] | null | undefined) {
  emit("update:modelValue", val);

  if (props.multiple) {
    const vals = Array.isArray(val) ? val : [];
    const selectedRows: T[] = [];
    vals.forEach((v) => {
      const key = String(v);
      const row =
        options.value.find((item) => String(getRawValue(item)) === key) ||
        cachedSelectedItems.value.get(key);
      if (row) {
        selectedRows.push(row);
        cachedSelectedItems.value.set(key, row);
      }
    });
    emit("change", val, selectedRows);
  } else {
    const key = val !== null && val !== undefined ? String(val) : "";
    const selectedRow = key
      ? options.value.find((item) => String(getRawValue(item)) === key) ||
        cachedSelectedItems.value.get(key) ||
        null
      : null;
    if (selectedRow && key) {
      cachedSelectedItems.value.set(key, selectedRow);
    }
    emit("change", val, selectedRow);
  }
}

function handleClear() {
  keyword.value = "";
  hasLoadedInitialPage.value = true;
  void loadData(true);
  if (props.reopenOnClear) {
    openDropdown();
  }
  emit("clear");
}

defineExpose({
  selectRef,
  openDropdown,
  loadData,
});

onDeactivated(closeDropdown);
onBeforeUnmount(closeDropdown);
</script>

<template>
  <el-select
    ref="selectRef"
    :model-value="modelValue"
    :multiple="multiple"
    :filterable="filterable"
    :remote="filterable"
    :remote-method="onSearch"
    :clearable="clearable"
    :disabled="disabled"
    :loading="loading && options.length === 0"
    :placeholder="placeholder"
    :collapse-tags="collapseTags"
    :collapse-tags-tooltip="collapseTagsTooltip"
    :popper-class="combinedPopperClass"
    class="base-infinite-select"
    @update:model-value="handleChange"
    @visible-change="onVisibleChange"
    @popup-scroll="onPopupScroll"
    @end-reached="onEndReached"
    @clear="handleClear"
  >
    <template v-if="$slots.prefix" #prefix>
      <slot name="prefix" />
    </template>

    <el-option
      v-for="(item, index) in options"
      :key="String(getRawValue(item))"
      :label="getRawLabel(item)"
      :value="getRawValue(item)"
      :disabled="getRawDisabled(item)"
    >
      <slot name="option" :item="item" :index="index">
        {{ getRawLabel(item) }}
      </slot>
    </el-option>

    <template v-if="showFooter && options.length > 0 && (loadingMore || !hasMore)" #footer>
      <div class="infinite-select-footer">
        <span v-if="loadingMore" class="status-text is-loading">
          <el-icon class="is-loading-icon"><Loading /></el-icon>
          正在加载更多...
        </span>
        <span v-else-if="!hasMore" class="status-text is-nomore">
          已加载全部 {{ total !== undefined ? `(${total}条)` : '' }}
        </span>
      </div>
    </template>

    <template #empty>
      <div class="infinite-select-empty">
        <span v-if="loading">正在查询中...</span>
        <span v-else>暂无匹配数据</span>
      </div>
    </template>
  </el-select>
</template>

<style scoped>
.base-infinite-select {
  width: 100%;
}

.infinite-select-footer {
  padding: 6px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
}

.status-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.is-loading-icon {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.infinite-select-empty {
  padding: 16px 0;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary, #909399);
}
</style>
