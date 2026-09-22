<template>
  <el-tooltip class="item" effect="dark" content="显隐列" placement="top">
    <el-dropdown trigger="click" :hide-on-click="false">
      <el-button size="mini" circle :icon="Menu" />
      <template #dropdown>
<el-dropdown-menu>
        <div
          style="
            width: 260px;
            max-height: calc(100vh - 300px);
            overflow-y: auto;
          "
        >
          <el-tree
            ref="tree"
            :data="props.columns"
            show-checkbox
            node-key="id"
            :default-checked-keys="defaultCheckedKeys"
            @check="checkboxChange"
          >
          </el-tree>
        </div>
      </el-dropdown-menu>
</template>
    </el-dropdown>
  </el-tooltip>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from "vue";
import { Menu } from "@element-plus/icons-vue";
import _ from "lodash";

interface ColumnItem {
  id: number;
  label: string;
  show: boolean;
  children?: ColumnItem[];
}

const props = defineProps<{
  columns: ColumnItem[];
}>();

const emit = defineEmits<{
  (e: "update:columns", value: ColumnItem[]): void;
}>();

const tree = ref<{ getCheckedKeys: () => number[] }>();

const copyColumns = ref<ColumnItem[]>([]);

onMounted(() => {
  nextTick(() => {
    copyColumns.value = _.cloneDeep(props.columns);
  });
});

const defaultCheckedKeys = computed(() => {
  const ids: number[] = [];
  function traverse(nodes: ColumnItem[]) {
    nodes.forEach((node) => {
      if (node.show) {
        ids.push(node.id);
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  }
  traverse(props.columns);
  return ids;
});

function setAttr_show(checkedKeys: number[], arr: ColumnItem[]) {
  arr.forEach((item) => {
    if (checkedKeys.includes(item.id)) {
      item.show = true;
    } else {
      item.show = false;
    }
    if (item.children && item.children.length > 0) {
      setAttr_show(checkedKeys, item.children);
    }
  });
}

function checkboxChange() {
  const checkedKeys = tree.value!.getCheckedKeys();
  setAttr_show(checkedKeys, copyColumns.value);
  emit("update:columns", copyColumns.value);
}
</script>

<style scoped></style>
