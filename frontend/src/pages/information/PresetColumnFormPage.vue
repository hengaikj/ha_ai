<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowDown, Back, Select } from "@element-plus/icons-vue";
import type { FormInstance, FormRules } from "element-plus";
import {
  createPresetColumn,
  fetchPresetColumnDetail,
  updatePresetColumn,
} from "@/api/information-management";
import { fetchPlatformDictItems } from "@/api/platform-system";
import { BaseToast } from "@/components/base/BaseToast";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import type { BackendId } from "@/api/information-management";
import type { PlatformDictItemDetail } from "@/types/platform-system";

type PresetColumnFieldItem = {
  name: string;
  key: string;
  check: boolean;
  dictType?: string;
  child: PresetColumnFieldChild[];
};

type PresetColumnFieldChild = {
  name: string;
  key: string;
  check: boolean;
};

type ModuleTreeNode = {
  id: string;
  label: string;
  children?: ModuleTreeNode[];
};

type ModuleColumnGroupConfig = {
  name: string;
  key: string;
  dictType: string;
};

type ModuleColumnConfig = {
  moduleId: string;
  groups: ModuleColumnGroupConfig[];
};

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const form = reactive({
  groupName: "",
});
const formRules: FormRules<typeof form> = {
  groupName: [
    { required: true, message: "请输入分组名称", trigger: "blur" },
    { whitespace: true, message: "分组名称不能为空", trigger: "blur" },
  ],
};

const mode = computed<"add" | "edit">(() =>
  route.query.mode === "edit" ? "edit" : "add",
);
const itemId = computed<BackendId | null>(() =>
  route.query.id ? String(route.query.id) : null,
);
const copyFromId = computed<BackendId | null>(() =>
  route.query.copyFrom ? String(route.query.copyFrom) : null,
);
const isEdit = computed(() => mode.value === "edit" && Boolean(itemId.value));
const title = computed(() =>
  isEdit.value ? "编辑预置列管理" : "新增预置列管理",
);
const permission = computed(() =>
  isEdit.value ? "system:column:edit" : "system:column:add",
);

const moduleTree: ModuleTreeNode[] = [
  {
    id: "1",
    label: "预算管理",
    children: [
      {
        id: "1-1",
        label: "WBS立项",
        children: [
          {
            id: "lxyspg",
            label: "预算评估",
          },
        ],
      },
      {
        id: "1-2",
        label: "WBS过阀",
        children: [
          {
            id: "gfyspg",
            label: "预算评估",
          },
        ],
      },
    ],
  },
];

const moduleColumnConfigs: ModuleColumnConfig[] = [
  {
    moduleId: "lxyspg",
    groups: [
      {
        name: "极致成本预算前置数据",
        key: "qzsjColumns",
        dictType: "lxyspg_qzsj",
      },
      {
        name: "极致成本预算前置评审",
        key: "qzpsColumns",
        dictType: "lxyspg_qzps",
      },
      { name: "评审记录", key: "psjlColumns", dictType: "lxyspg_psjl" },
    ],
  },
  {
    moduleId: "gfyspg",
    groups: [
      {
        name: "极致成本预算前置数据",
        key: "qzsjColumns",
        dictType: "gfyspg_qzsj",
      },
      {
        name: "极致成本阀点预算前置评审",
        key: "qzpsColumns",
        dictType: "gfyspg_qzps",
      },
    ],
  },
];

const leftTreeRef = ref();
const selectedModuleId = ref("");
const selectedModuleName = ref("");
const moduleTitle = ref("");
const checkData = ref<PresetColumnFieldItem[]>([]);

watch(
  () => checkData.value,
  (nextValue) => {
    nextValue.forEach((item) => {
      item.check = item.child.every((child) => child.check);
    });
  },
  { deep: true },
);

function findNodePath(nodes: ModuleTreeNode[], targetId: string): string[] {
  for (const node of nodes) {
    if (node.id === targetId) {
      return [node.label];
    }
    if (node.children?.length) {
      const childPath = findNodePath(node.children, targetId);
      if (childPath.length > 0) {
        return [node.label, ...childPath];
      }
    }
  }
  return [];
}

function findModuleConfig(moduleId: string) {
  return moduleColumnConfigs.find((config) => config.moduleId === moduleId);
}

async function loadColumnGroupsFromDict(
  moduleId: string,
): Promise<PresetColumnFieldItem[]> {
  const config = findModuleConfig(moduleId);
  if (!config) {
    return [];
  }

  const result: PresetColumnFieldItem[] = [];
  for (const group of config.groups) {
    try {
      const dictItems: PlatformDictItemDetail[] = await fetchPlatformDictItems(
        group.dictType,
      );
      result.push({
        name: group.name,
        key: group.key,
        dictType: group.dictType,
        check: true,
        child: dictItems.map((item) => ({
          name: item.dictItemLabel,
          key: item.dictItemCode,
          check: true,
        })),
      });
    } catch (error) {
      console.error(`获取字典 ${group.dictType} 失败:`, error);
    }
  }
  return result;
}

async function handleTreeClick(data: ModuleTreeNode) {
  const pathNames = findNodePath(moduleTree, data.id);
  selectedModuleId.value = data.id;
  selectedModuleName.value = pathNames.join("-");
  moduleTitle.value = data.label;
  checkData.value = findModuleConfig(data.id)
    ? await loadColumnGroupsFromDict(data.id)
    : [];
}

function handleGroupCheckChange(value: unknown, group: PresetColumnFieldItem) {
  const checked = Boolean(value);
  group.child.forEach((item) => {
    item.check = checked;
  });
}

async function loadItem() {
  const sourceId = isEdit.value ? itemId.value : copyFromId.value;
  if (!sourceId) {
    resetForm();
    return;
  }

  loading.value = true;
  try {
    const item = await fetchPresetColumnDetail(sourceId);
    form.groupName = isEdit.value ? (item.groupName ?? "") : "";
    selectedModuleId.value = item.moduleId ?? "";
    selectedModuleName.value = item.moduleName ?? "";
    moduleTitle.value = item.moduleName?.split("-")?.pop() ?? "";
    if (item.columnField) {
      checkData.value = JSON.parse(item.columnField);
    }
    if (selectedModuleId.value) {
      await nextTick();
      leftTreeRef.value?.setCurrentKey(selectedModuleId.value);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "加载失败";
    BaseToast.error(message);
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  form.groupName = "";
  selectedModuleId.value = "";
  selectedModuleName.value = "";
  moduleTitle.value = "";
  checkData.value = [];
}

async function saveForm() {
  if (!selectedModuleId.value) {
    BaseToast.warning("请选择左侧所属模块");
    return;
  }
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  if (saving.value) {
    return;
  }
  saving.value = true;
  try {
    const payload = {
      id: isEdit.value && itemId.value ? itemId.value : undefined,
      moduleId: selectedModuleId.value,
      moduleName: selectedModuleName.value,
      groupName: form.groupName.trim(),
      columnField: JSON.stringify(checkData.value),
    };
    if (isEdit.value && itemId.value) {
      await updatePresetColumn(payload);
      BaseToast.success("预置列已编辑");
    } else {
      await createPresetColumn(payload);
      BaseToast.success("预置列已新增");
    }
    goBack();
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    BaseToast.error(message);
  } finally {
    saving.value = false;
  }
}

function goBack() {
  void router.push("/information/preset-columns");
}

onMounted(() => {
  void loadItem();
});
</script>

<template>
  <PageContainer
    :title="title"
    description="维护 Excel、BOM 和收益模板中可复用的预置字段。"
  >
    <template #actions>
      <PermissionButton
        class="bq-page-return-button"
        variant="secondary"
        :icon="Back"
        @click="goBack"
        >返回列表</PermissionButton
      >
      <PermissionButton
        :permission="permission"
        variant="primary"
        :icon="Select"
        type="primary"
        :loading="saving"
        @click="saveForm"
      >
        保存
      </PermissionButton>
    </template>

    <div v-loading="loading" class="preset-column-form">
      <el-row :gutter="0" class="preset-column-form__row">
        <el-col :span="4" class="preset-column-form__left">
          <div class="preset-column-form__left-inner">
            <div class="preset-column-form__left-title">全部</div>
            <el-tree
              ref="leftTreeRef"
              :data="moduleTree"
              node-key="id"
              :props="{ children: 'children', label: 'label' }"
              highlight-current
              default-expand-all
              :expand-on-click-node="false"
              @node-click="handleTreeClick"
            />
          </div>
        </el-col>

        <el-col :span="20" class="preset-column-form__right">
          <div class="preset-column-form__right-inner">
            <el-form
              ref="formRef"
              :model="form"
              :rules="formRules"
              label-position="top"
              class="preset-column-form__form"
            >
              <el-form-item label="分组名称" prop="groupName">
                <el-input
                  v-model="form.groupName"
                  placeholder="请输入分组名称"
                  maxlength="50"
                  class="preset-column-form__group-input"
                />
              </el-form-item>

              <div class="preset-column-form__tag-wrap">
                <div class="preset-column-form__tag-head">
                  {{ moduleTitle || "请先选择左侧模块" }}
                  <div class="preset-column-form__tag-head-i">列展示</div>
                </div>

                <div class="preset-column-form__tag-box">
                  <template
                    v-for="(fieldGroup, fieldIndex) in checkData"
                    :key="fieldIndex"
                  >
                    <div class="preset-column-form__tag-box-t">
                      <el-checkbox
                        :model-value="fieldGroup.check"
                        @change="handleGroupCheckChange($event, fieldGroup)"
                      >
                        {{ fieldGroup.name }}
                      </el-checkbox>
                      <el-icon class="preset-column-form__tag-box-ti">
                        <ArrowDown />
                      </el-icon>
                    </div>

                    <div class="preset-column-form__tag-child">
                      <el-checkbox
                        v-for="(child, childIndex) in fieldGroup.child"
                        :key="childIndex"
                        v-model="child.check"
                      >
                        {{ child.name }}
                      </el-checkbox>
                    </div>
                  </template>

                  <el-empty
                    v-if="checkData.length === 0"
                    description="请选择左侧模块"
                    :image-size="80"
                  />
                </div>
              </div>
            </el-form>
          </div>
        </el-col>
      </el-row>
    </div>
  </PageContainer>
</template>

<style scoped>
.preset-column-form__row {
  height: calc(100vh - 180px);
}

.preset-column-form__left {
  height: 100%;
  overflow: hidden;
  border-right: 1px solid var(--bq-color-border);
}

.preset-column-form__left-inner {
  height: 100%;
  padding: 16px 16px 16px 0;
  overflow-y: auto;
}

.preset-column-form__left-title {
  padding: 8px;
  font-size: 14px;
  font-weight: 600;
}

.preset-column-form__right {
  height: 100%;
  overflow: hidden;
}

.preset-column-form__right-inner {
  height: 100%;
  padding: 24px;
  overflow-y: auto;
}

.preset-column-form__form {
  max-width: 100%;
}

.preset-column-form__group-input {
  width: min(420px, 100%);
}

.preset-column-form__tag-wrap {
  margin-top: 24px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-md);
}

.preset-column-form__tag-head {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--bq-color-border);
  font-size: 15px;
  font-weight: 600;
}

.preset-column-form__tag-head-i {
  padding-left: 12px;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  font-weight: normal;
}

.preset-column-form__tag-box {
  padding: 20px 16px;
}

.preset-column-form__tag-box-t {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.preset-column-form__tag-box-ti {
  margin-left: 8px;
  color: var(--bq-color-text-secondary);
  font-size: 16px;
}

.preset-column-form__tag-child {
  padding: 0 0 16px 24px;
}

.preset-column-form__tag-child :deep(.el-checkbox) {
  margin: 0 20px 16px 0;
}
</style>
