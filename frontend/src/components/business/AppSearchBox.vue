<script setup lang="ts">
import { ref, watch } from "vue";
import { Search } from "@element-plus/icons-vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
  }>(),
  {
    placeholder: "请输入关键词",
  },
);

const emit = defineEmits<{
  "update:modelValue": [val: string];
  search: [];
}>();

const keyword = ref(props.modelValue);

watch(
  () => props.modelValue,
  (val) => {
    keyword.value = val;
  },
);

function onInput(val: string) {
  keyword.value = val;
  emit("update:modelValue", val);
}

function onSearch() {
  emit("search");
}

function onKeyup(e: KeyboardEvent) {
  if (e.key === "Enter") {
    onSearch();
  }
}
</script>

<template>
  <div class="app-search-box">
    <el-input
      v-model="keyword"
      :placeholder="placeholder"
      class="search-input"
      @input="onInput"
      @keyup="onKeyup"
    />
    <el-button type="primary" :icon="Search" @click="onSearch">搜索</el-button>
  </div>
</template>

<style scoped>
.app-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  width: 240px;
}
</style>
