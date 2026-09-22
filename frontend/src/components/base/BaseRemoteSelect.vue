<script setup lang="ts" generic="T extends Record<string, unknown>">
import {
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  ref,
  shallowRef,
  useId,
  watch,
} from "vue";

export type RemoteSelectPage<T> = {
  records: T[];
  total?: number;
};

const props = withDefaults(
  defineProps<{
    modelValue: string | number | Array<string | number> | null | undefined;
    request: (params: { pageNo: number; pageSize: number; keyword: string }) => Promise<RemoteSelectPage<T>>;
    initialOptions?: T[];
    valueKey: keyof T | string;
    labelKey: keyof T | string;
    pageSize?: number;
    multiple?: boolean;
    placeholder?: string;
    clearable?: boolean;
    filterable?: boolean;
    disabled?: boolean;
    loading?: boolean;
    optionMapper?: (item: T) => { value: string | number; label: string; disabled?: boolean };
  }>(),
  {
    initialOptions: () => [],
    pageSize: 10,
    multiple: false,
    placeholder: "请选择",
    clearable: true,
    filterable: true,
    disabled: false,
    loading: false,
    optionMapper: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | number | Array<string | number> | null];
  change: [value: string | number | Array<string | number> | null];
}>();

const selectId = `base-remote-select-${useId()}`;
const selectRef = ref();
const options = shallowRef<T[]>([]);
const requestLoading = ref(false);
const keyword = ref("");
const pageNo = ref(0);
const total = ref<number | undefined>();
const dropdownVisible = ref(false);
let scrollElement: HTMLElement | null = null;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let requestVersion = 0;
let queuedReset = false;

function getField(item: T, key: keyof T | string) {
  return item[key as keyof T];
}

function optionValue(item: T) {
  return props.optionMapper?.(item).value ?? (getField(item, props.valueKey) as string | number);
}

function optionLabel(item: T) {
  return props.optionMapper?.(item).label ?? String(getField(item, props.labelKey) ?? "");
}

function optionDisabled(item: T) {
  return props.optionMapper?.(item).disabled;
}

function mergeOptions(records: T[]) {
  const merged = [...options.value, ...records];
  const seen = new Set<string>();
  const next = merged.filter((item) => {
    const key = String(optionValue(item));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  options.value.splice(0, options.value.length, ...next);
}

function replaceOptions(records: T[]) {
  options.value.splice(0, options.value.length, ...records);
}

const hasMore = () => total.value === undefined || options.value.length < total.value;

async function load(reset = false) {
  if (requestLoading.value) {
    if (reset) queuedReset = true;
    return;
  }
  if (!reset && !hasMore()) return;
  if (reset) {
    pageNo.value = 0;
    total.value = undefined;
    replaceOptions(keyword.value ? [] : props.initialOptions);
  }
  requestLoading.value = true;
  const nextPage = pageNo.value + 1;
  const currentVersion = requestVersion;
  try {
    const result = await props.request({
      pageNo: nextPage,
      pageSize: props.pageSize,
      keyword: keyword.value,
    });
    if (currentVersion === requestVersion) {
      pageNo.value = nextPage;
      total.value = result.total;
      mergeOptions(result.records);
    }
  } finally {
    if (currentVersion === requestVersion) {
      requestLoading.value = false;
      if (queuedReset) {
        queuedReset = false;
        void load(true);
      }
    }
  }
}

function onSearch(value: string) {
  // Selecting an option clears the internal query. Ignore that cleanup event
  // after the dropdown has started closing, otherwise the popper can reopen.
  if (!dropdownVisible.value) return;
  keyword.value = value.trim();
  requestVersion += 1;
  requestLoading.value = false;
  queuedReset = false;
  pageNo.value = 0;
  total.value = 0;
  replaceOptions([]);
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void load(true), 250);
}

function onVisibleChange(visible: boolean) {
  dropdownVisible.value = visible;
  if (!visible) {
    detachScroll();
    return;
  }
  if (options.value.length === 0) {
    void load(true);
  } else if (pageNo.value === 0) {
    // initialOptions represents the first page already fetched by the parent.
    pageNo.value = 1;
  }
  void nextTick(attachScroll);
}

function onScroll() {
  if (!scrollElement || scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < 24) {
    void load();
  }
}

function attachScroll() {
  scrollElement = document.querySelector<HTMLElement>(`.${selectId} .el-select-dropdown__wrap`);
  scrollElement?.addEventListener("scroll", onScroll);
}

function detachScroll() {
  scrollElement?.removeEventListener("scroll", onScroll);
  scrollElement = null;
}

function closeDropdown() {
  dropdownVisible.value = false;
  queuedReset = false;
  selectRef.value?.blur?.();
  detachScroll();
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = undefined;
  }
  requestVersion += 1;
  requestLoading.value = false;
}

watch(() => props.initialOptions, (value) => {
  if (pageNo.value === 0) replaceOptions(value ?? []);
}, { deep: true, immediate: true });

onDeactivated(closeDropdown);
onBeforeUnmount(closeDropdown);

function updateValue(value: string | number | Array<string | number> | null) {
  dropdownVisible.value = false;
  emit("update:modelValue", value);
  emit("change", value);
}
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
    :loading="props.loading || (requestLoading && options.length === 0)"
    :placeholder="placeholder"
    :popper-class="selectId"
    class="base-remote-select"
    @update:model-value="updateValue"
    @visible-change="onVisibleChange"
  >
    <el-option
      v-for="item in options"
      :key="String(optionValue(item))"
      :label="optionLabel(item)"
      :value="optionValue(item)"
      :disabled="optionDisabled(item)"
    />
    <template #empty>
      <span v-if="requestLoading">加载中...</span>
      <span v-else>暂无数据</span>
    </template>
  </el-select>
</template>

<style scoped>
.base-remote-select {
  width: 100%;
}
</style>
