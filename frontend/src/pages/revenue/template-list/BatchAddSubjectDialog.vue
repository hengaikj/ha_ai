<script setup lang="ts">
/**
 * 批量添加科目：选择默认数据来源，勾选父节点或全选后只添加启用叶子科目。
 */
import { computed, reactive, watch } from "vue";
import { BaseToast } from "@/components/base/BaseToast";
import {
  DATA_SOURCE_OPTIONS,
  MANUAL_SOURCE,
  collectAvailableRootIds,
  collectSelectedLeafSubjects,
  hasAvailableLeaf,
  mapTreeWithDisabled,
  type FlatSubject,
  type SubjectTreeNode,
} from "./template-editor-model";
import type { TemplateEntryMode } from "@/api/revenue/template";

const props = defineProps<{
  modelValue: boolean;
  subjectTree: SubjectTreeNode[];
  subjectFlatList: FlatSubject[];
  occupiedSubjectIds: Array<string | number>;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [
    payload: {
      subjects: FlatSubject[];
      dataSourceType: TemplateEntryMode;
    },
  ];
}>();

const form = reactive({
  subjectIds: [] as Array<string | number>,
  dataSourceType: MANUAL_SOURCE as TemplateEntryMode,
});

const occupiedMap = computed(() => {
  const map: Record<string, boolean> = {};
  props.occupiedSubjectIds.forEach((id) => {
    map[String(id)] = true;
  });
  return map;
});

const availableLeafIds = computed(() =>
  props.subjectFlatList
    .filter((item) => item.isLeaf && !occupiedMap.value[String(item.id)])
    .map((item) => item.id),
);

const availableLeafMap = computed(() => {
  const map: Record<string, boolean> = {};
  availableLeafIds.value.forEach((id) => {
    map[String(id)] = true;
  });
  return map;
});

const availableRootIds = computed(() =>
  collectAvailableRootIds(props.subjectTree, availableLeafMap.value),
);

const treeData = computed(() =>
  mapTreeWithDisabled(props.subjectTree, (node, isLeaf) => {
    if (!isLeaf) return !hasAvailableLeaf(node, availableLeafMap.value);
    return Boolean(occupiedMap.value[String(node.id)]);
  }).map(appendOccupiedLabel),
);

function appendOccupiedLabel(node: SubjectTreeNode): SubjectTreeNode {
  const children = Array.isArray(node.children)
    ? node.children.map((child) => appendOccupiedLabel(child))
    : undefined;
  const isLeaf = !children || !children.length;
  const occupied = isLeaf && occupiedMap.value[String(node.id)];
  return {
    ...node,
    label: occupied ? `${node.subjectName}（已添加）` : node.subjectName,
    children,
  };
}

const allSelected = computed(() => {
  if (!availableLeafIds.value.length) return false;
  const selectedLeaves = collectSelectedLeafSubjects(
    props.subjectTree,
    props.subjectFlatList,
    form.subjectIds,
  ).filter((item) => availableLeafMap.value[String(item.id)]);
  return selectedLeaves.length === availableLeafIds.value.length;
});

const indeterminate = computed(() => {
  if (allSelected.value) return false;
  const selectedLeaves = collectSelectedLeafSubjects(
    props.subjectTree,
    props.subjectFlatList,
    form.subjectIds,
  ).filter((item) => availableLeafMap.value[String(item.id)]);
  return selectedLeaves.length > 0;
});

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      form.subjectIds = [];
      form.dataSourceType = MANUAL_SOURCE;
    }
  },
);

function toggleAll(checked: boolean | string | number) {
  if (!availableLeafIds.value.length) return;
  form.subjectIds = checked ? [...availableRootIds.value] : [];
}

function handleClosed() {
  form.subjectIds = [];
  form.dataSourceType = MANUAL_SOURCE;
}

function handleCancel() {
  emit("update:modelValue", false);
}

function handleConfirm() {
  const leafSubjects = collectSelectedLeafSubjects(
    props.subjectTree,
    props.subjectFlatList,
    form.subjectIds,
  ).filter((item) => !occupiedMap.value[String(item.id)]);
  if (!leafSubjects.length) {
    BaseToast.warning("请选择至少一个叶子科目");
    return;
  }
  emit("confirm", {
    subjects: leafSubjects,
    dataSourceType: form.dataSourceType,
  });
  emit("update:modelValue", false);
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="批量添加科目"
    width="620px"
    :close-on-click-modal="false"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @closed="handleClosed"
  >
    <el-form label-width="108px" size="small">
      <el-form-item label="默认数据来源">
        <el-select v-model="form.dataSourceType" class="batch-source-select">
          <el-option
            v-for="option in DATA_SOURCE_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="选择科目">
        <div class="batch-select-all-row">
          <el-checkbox
            :model-value="allSelected"
            :indeterminate="indeterminate"
            :disabled="!availableLeafIds.length"
            @change="toggleAll"
          >
            全选
          </el-checkbox>
          <span class="batch-subject-count">可选 {{ availableLeafIds.length }} 个</span>
        </div>
        <el-tree-select
          v-model="form.subjectIds"
          :data="treeData"
          :props="{ label: 'label', value: 'id', children: 'children', disabled: 'disabled' }"
          node-key="id"
          multiple
          check-strictly
          show-checkbox
          clearable
          filterable
          default-expand-all
          placeholder="可选择父节点，保存时仅添加其下叶子科目"
          no-data-text="暂无数据"
          style="width: 100%"
        />
        <div class="batch-subject-tip">
          父节点只作为批量选择入口，模板明细仅保存启用的叶子科目；已添加的叶子科目会自动跳过。
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleConfirm">添加</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.batch-source-select {
  width: 220px;
}

.batch-select-all-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 6px 10px;
  border: 1px solid #ebeef5;
  background: #fafafa;
}

.batch-subject-count {
  color: #909399;
  font-size: 12px;
}

.batch-subject-tip {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
  line-height: 18px;
}
</style>
