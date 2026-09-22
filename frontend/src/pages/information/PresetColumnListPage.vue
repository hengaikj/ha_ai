<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { CirclePlus } from "@element-plus/icons-vue";
import {
  deletePresetColumn,
  fetchPresetColumns,
  type PresetColumnRow,
} from "@/api/information-management";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseTreeSelect from "@/components/base/BaseTreeSelect.vue";
import { BaseToast } from "@/components/base/BaseToast";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { buildBaseConfirmContent } from "@/composables/useBaseConfirmDialog";
import { resolvePageTotal } from "@/utils/pagination";

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

type PresetColumnListRow = PresetColumnRow & {
  columnFieldCount: number;
};

type PresetColumnTreeOption = {
  id: string;
  label: string;
  children?: PresetColumnTreeOption[];
};

type PresetColumnFieldChild = {
  name?: string;
  check?: boolean;
};

type PresetColumnFieldGroup = {
  child?: PresetColumnFieldChild[];
};

const router = useRouter();
const queryTableRef = ref<QueryTableExpose | null>(null);
const query = reactive({
  moduleId: "" as string | null,
  groupName: "",
  createdAtRange: [] as string[],
});
const moduleOptions: PresetColumnTreeOption[] = [
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
const detailVisible = ref(false);
const activeDetail = ref<PresetColumnListRow | null>(null);
const confirmVisible = ref(false);
const confirmLoading = ref(false);
const pendingDeleteRows = ref<PresetColumnListRow[]>([]);
const selectedRows = ref<PresetColumnListRow[]>([]);
const deleteConfirmContent = computed(() => {
  if (pendingDeleteRows.value.length > 1) {
    return buildBaseConfirmContent({
      scene: "batchDelete",
      object: "预置列",
      count: pendingDeleteRows.value.length,
    });
  }
  const row = pendingDeleteRows.value[0];
  if (!row) {
    return buildBaseConfirmContent({});
  }
  return buildBaseConfirmContent({
    scene: "delete",
    object: "预置列",
    name: row.groupName ?? undefined,
  });
});

async function queryItems(pageSize: number, pageNo: number) {
  const [createdAtStart, createdAtEnd] = createdAtRange();
  const page = await fetchPresetColumns({
    pageNo,
    pageSize,
    moduleId: String(query.moduleId ?? "").trim() || undefined,
    groupName: query.groupName.trim() || undefined,
    beginTime: createdAtStart ? `${createdAtStart} 00:00:00` : undefined,
    endTime: createdAtEnd ? `${createdAtEnd} 23:59:59` : undefined,
  });
  const list = page.records.map((item) => ({
    ...item,
    columnFieldCount: getCheckedChildCount(item.columnField ?? ""),
  }));
  return {
    total: resolvePageTotal(page, pageNo, pageSize),
    list,
    pageNo: page.pageNo,
    pageSize: page.pageSize,
  };
}

function getCheckedChildCount(json: string) {
  if (!json) return 0;
  try {
    const parsed = JSON.parse(json) as PresetColumnFieldGroup[];
    const allChildren = parsed.flatMap((item) => item.child || []);
    return allChildren.filter((child) => child.check === true).length;
  } catch {
    return 0;
  }
}

function getCheckedChildNames(json: string) {
  if (!json) return "";
  try {
    const parsed = JSON.parse(json) as PresetColumnFieldGroup[];
    const allChildren = parsed.flatMap((item) => item.child || []);
    const names = allChildren
      .filter((child) => child.check === true)
      .map((child) => child.name)
      .filter((name): name is string => Boolean(name));
    return names.join("、");
  } catch {
    return "";
  }
}

function createdAtRange() {
  return Array.isArray(query.createdAtRange) ? query.createdAtRange : [];
}

function resetQuery() {
  query.moduleId = "";
  query.groupName = "";
  query.createdAtRange = [];
}

function searchItems() {
  queryTableRef.value?.search();
}

function openDetailDialog(row: PresetColumnListRow) {
  activeDetail.value = row;
  detailVisible.value = true;
}

function handleSelectionChange(selection: PresetColumnListRow[]) {
  selectedRows.value = selection;
}

function confirmDelete(row?: PresetColumnListRow) {
  const rows = row ? [row] : selectedRows.value;
  if (!rows.length) {
    BaseToast.warning("请先选择预置列");
    return;
  }
  pendingDeleteRows.value = rows;
  confirmVisible.value = true;
}

async function deleteItems() {
  const ids = pendingDeleteRows.value
    .map((row) => row.id)
    .filter((id): id is string | number => id !== undefined);
  if (!ids.length) {
    confirmVisible.value = false;
    return;
  }
  confirmLoading.value = true;
  try {
    await deletePresetColumn(ids);
    confirmVisible.value = false;
    BaseToast.success(deleteConfirmContent.value.successMessage);
    await queryTableRef.value?.reload();
  } finally {
    confirmLoading.value = false;
  }
}

function formatCellValue(value: unknown) {
  return value === undefined || value === null || value === ""
    ? "-"
    : String(value);
}
</script>

<template>
  <PageContainer
    title="预置列管理"
    description="维护 Excel、BOM 和收益模板中可复用的预置字段。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryItems"
      row-key="id"
      fit-table-height
      empty-title="暂无预置列"
      empty-description="当前条件下没有可展示的预置列。"
      @selection-change="handleSelectionChange"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="所属模块">
            <BaseTreeSelect
              v-model="query.moduleId"
              :data="moduleOptions"
              filterable
              placeholder="请选择内容"
            />
          </el-form-item>
          <el-form-item label="分组名称">
            <el-input
              v-model="query.groupName"
              clearable
              placeholder="请输入分组名称"
              @keyup.enter="searchItems"
            />
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="query.createdAtRange as string[]"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          permission="system:column:add"
          variant="primary"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="router.push('/information/preset-columns/form?mode=add')"
          >新增</PermissionButton
        >
        <PermissionButton
          permission="system:column:remove"
          variant="danger"
          type="danger"
          plain
          @click="confirmDelete()"
          >批量删除</PermissionButton
        >
      </template>

      <el-table-column type="selection" width="55" />
      <el-table-column type="index" label="序号" width="70" />
      <el-table-column
        prop="moduleName"
        label="所属模块"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="groupName"
        label="分组名称"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="列字段数量" width="120" >
        <template #default="{ row }">
          {{ row.columnFieldCount ?? 0 }}
        </template>
      </el-table-column>
      <el-table-column label="列字段" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          {{ getCheckedChildNames(row.columnField) || "-" }}
        </template>
      </el-table-column>
      <el-table-column
        prop="createBy"
        label="创建人"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column
        prop="createTime"
        label="创建时间"
        width="170"
        show-overflow-tooltip
      />
      <el-table-column
        prop="updateBy"
        label="更新人"
        min-width="120"
        show-overflow-tooltip
      />
      <el-table-column
        prop="updateTime"
        label="更新时间"
        width="170"
        show-overflow-tooltip
      />
      <el-table-column label="操作" width="180" fixed="right" align="center">
        <template #default="{ row }">
          <PermissionButton
            permission="system:column:query"
            link
            type="primary"
            @click="openDetailDialog(row)"
          >
            查看
          </PermissionButton>
          <PermissionButton
            permission="system:column:edit"
            link
            type="primary"
            @click="
              router.push(
                '/information/preset-columns/form?mode=edit&id=' + row.id,
              )
            "
            >编辑</PermissionButton
          >
          <PermissionButton
            permission="system:column:remove"
            link
            @click="confirmDelete(row)"
            >删除</PermissionButton
          >
        </template>
      </el-table-column>
    </QueryTable>

    <BaseFormDialog
      v-model="detailVisible"
      title="预置列管理详情"
      width="680px"
      confirm-text="关闭"
      cancel-text=""
      :show-close="true"
      close-on-confirm
    >
      <el-descriptions v-if="activeDetail" :column="2" border>
        <el-descriptions-item label="所属模块">{{
          formatCellValue(activeDetail.moduleName)
        }}</el-descriptions-item>
        <el-descriptions-item label="分组名称">{{
          formatCellValue(activeDetail.groupName)
        }}</el-descriptions-item>
        <el-descriptions-item label="列字段数量">{{
          formatCellValue(activeDetail.columnFieldCount)
        }}</el-descriptions-item>
        <el-descriptions-item label="列字段" :span="2">{{
          formatCellValue(getCheckedChildNames(activeDetail.columnField ?? ""))
        }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{
          formatCellValue(activeDetail.createBy)
        }}</el-descriptions-item>
        <el-descriptions-item label="更新人">{{
          formatCellValue(activeDetail.updateBy)
        }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{
          formatCellValue(activeDetail.createTime)
        }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{
          formatCellValue(activeDetail.updateTime)
        }}</el-descriptions-item>
      </el-descriptions>
    </BaseFormDialog>

    <BaseConfirm
      v-model="confirmVisible"
      :title="deleteConfirmContent.title"
      :message="deleteConfirmContent.message"
      :type="deleteConfirmContent.type"
      :confirm-text="deleteConfirmContent.confirmText"
      :loading="confirmLoading"
      @confirm="deleteItems"
    />
  </PageContainer>
</template>
