<script setup lang="ts">
/**
 * 新增/编辑模板弹窗：科目配置表、批量添加、数据来源和公式绑定。
 */
import { computed, reactive, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import {
  FullScreen,
  FolderAdd,
  Connection,
  Delete,
  ScaleToOriginal,
} from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import { useAuthStore } from "@/stores/auth";
import {
  createTemplate,
  getTemplateDetail,
  updateTemplate,
  type TemplateEntryMode,
} from "@/api/revenue/template";
import {
  expenseSubjectTree,
  listExpenseSubjectFormulas,
} from "@/api/system/expenses";
import BatchAddSubjectDialog from "./BatchAddSubjectDialog.vue";
import FormulaBindDialog from "./FormulaBindDialog.vue";
import {
  CALCULATED_SOURCE,
  DATA_SOURCE_OPTIONS,
  buildTemplateItemsPayload,
  clearFormulaFields,
  createTemplateRow,
  filterEnabledSubjectTree,
  findSubjectById,
  flattenSubjectTree,
  hasValue,
  isActiveFormula,
  isTemplateRowUnbound,
  mapTreeWithDisabled,
  normalizeDialogRow,
  normalizeFormulaOption,
  safeText,
  unwrapList,
  validateDialogForm,
  type FlatSubject,
  type FormulaOption,
  type FormulaParameterBinding,
  type SubjectTreeNode,
  type TemplateDialogRow,
} from "./template-editor-model";

const props = defineProps<{
  modelValue: boolean;
  mode: "create" | "edit";
  templateId?: string;
  copyFromId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [];
}>();

const authStore = useAuthStore();
const loading = ref(false);
const saving = ref(false);
const fullscreen = ref(false);
const onlyShowUnboundRows = ref(false);
const bulkDataSourceType = ref("");
const selectedUids = ref<string[]>([]);
const batchVisible = ref(false);
const formulaVisible = ref(false);
const formulaBindRow = ref<TemplateDialogRow | null>(null);
const subjectTree = ref<SubjectTreeNode[]>([]);
const subjectFlatList = ref<FlatSubject[]>([]);
const formulaOptions = ref<FormulaOption[]>([]);

const form = reactive({
  id: "",
  templateCode: "",
  templateName: "",
  status: "ACTIVE",
  rows: [] as TemplateDialogRow[],
});

const currentUserId = computed(() => String(authStore.currentUser?.id || "").trim());
const currentUserName = computed(() =>
  String(
    authStore.currentUser?.displayName || authStore.currentUser?.username || "",
  ).trim(),
);
const dialogTitle = computed(() => (props.mode === "edit" ? "编辑模板" : "新增模板"));
const occupiedSubjectIds = computed(() =>
  form.rows
    .map((row) => row.subjectId)
    .filter((id): id is string | number => hasValue(id)),
);
const selectedUidMap = computed(() => {
  const map: Record<string, boolean> = {};
  selectedUids.value.forEach((uid) => {
    map[uid] = true;
  });
  return map;
});
const selectedRows = computed(() =>
  form.rows.filter((row) => selectedUidMap.value[row.uid]),
);
const visibleRows = computed(() =>
  form.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !onlyShowUnboundRows.value || isTemplateRowUnbound(row)),
);
const stats = computed(() => {
  const calculated = form.rows.filter(
    (row) =>
      row.dataSourceType === CALCULATED_SOURCE || row.dataSourceType === "DERIVED",
  ).length;
  const unbound = form.rows.filter((row) => isTemplateRowUnbound(row)).length;
  return {
    total: form.rows.length,
    calculated,
    unbound,
  };
});
const allVisibleSelected = computed(
  () =>
    Boolean(visibleRows.value.length) &&
    visibleRows.value.every(({ row }) => selectedUidMap.value[row.uid]),
);
const visibleIndeterminate = computed(() => {
  const selectedCount = visibleRows.value.filter(
    ({ row }) => selectedUidMap.value[row.uid],
  ).length;
  return selectedCount > 0 && selectedCount < visibleRows.value.length;
});
const showFullscreenToggle = computed(
  () => fullscreen.value || form.rows.length > 12,
);
const canAddRow = computed(() => {
  const leaves = subjectFlatList.value.filter((item) => item.isLeaf);
  return leaves.length === 0 || occupiedSubjectIds.value.length < leaves.length;
});

watch(
  () => props.modelValue,
  async (visible) => {
    if (visible) {
      await bootstrapDialog();
    }
  },
);

function resetForm() {
  form.id = "";
  form.templateCode = "";
  form.templateName = "";
  form.status = "ACTIVE";
  form.rows = [];
  fullscreen.value = false;
  onlyShowUnboundRows.value = false;
  bulkDataSourceType.value = "";
  selectedUids.value = [];
  formulaBindRow.value = null;
}

async function bootstrapDialog() {
  resetForm();
  loading.value = true;
  try {
    await Promise.all([loadSubjectTree(), loadFormulaOptions()]);
    if (props.mode === "edit" && props.templateId) {
      await loadTemplate(props.templateId, false);
    } else if (props.copyFromId) {
      await loadTemplate(props.copyFromId, true);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "模板数据加载失败";
    BaseToast.error(message);
  } finally {
    loading.value = false;
  }
}

async function loadSubjectTree() {
  const payload = await expenseSubjectTree({ enabled: true });
  subjectTree.value = filterEnabledSubjectTree(unwrapList(payload));
  subjectFlatList.value = flattenSubjectTree(subjectTree.value);
}

async function loadFormulaOptions() {
  const merged: Record<string, unknown>[] = [];
  let pageNum = 1;
  let total: number;
  do {
    const response = (await listExpenseSubjectFormulas({
      pageNum,
      pageSize: 200,
    })) as { rows?: unknown[]; data?: unknown[]; total?: number };
    const rows = unwrapList(response) as Record<string, unknown>[];
    total = Number(response?.total) || rows.length;
    merged.push(...rows);
    if (!rows.length || merged.length >= total) break;
    pageNum += 1;
  } while (pageNum < 1000);
  formulaOptions.value = merged
    .filter((row) => isActiveFormula(row))
    .map((row) => normalizeFormulaOption(row))
    .filter((item) => hasValue(item.value));
}

async function loadTemplate(id: string, asCopy: boolean) {
  const detail = await getTemplateDetail(id);
  const items = Array.isArray(detail.items) ? detail.items : [];
  form.id = asCopy ? "" : safeText(detail.id);
  form.templateCode = asCopy ? "" : safeText(detail.templateCode);
  form.templateName = asCopy
    ? `${safeText(detail.templateName)} 副本`.trim()
    : safeText(detail.templateName);
  form.status = asCopy ? "ACTIVE" : safeText(detail.status, "ACTIVE");
  form.rows = items.map((item) => {
    const row = normalizeDialogRow(item, formulaOptions.value);
    if (asCopy) row.id = "";
    return row;
  });
  if (form.rows.length > 20) fullscreen.value = true;
}

function subjectTreeForRow(currentUid: string) {
  return mapTreeWithDisabled(subjectTree.value, (node, isLeaf) => {
    if (!isLeaf) return true;
    return form.rows.some(
      (row) =>
        row.uid !== currentUid &&
        hasValue(row.subjectId) &&
        String(row.subjectId) === String(node.id),
    );
  });
}

function handleSubjectChange(row: TemplateDialogRow) {
  const subject = findSubjectById(subjectFlatList.value, row.subjectId);
  row.subjectCode = subject ? subject.subjectCode : "";
  row.subjectName = subject ? subject.subjectName : "";
}

function handleDataSourceChange(row: TemplateDialogRow) {
  if (row.dataSourceType !== CALCULATED_SOURCE) {
    clearFormulaFields(row);
  }
}

function toggleRowSelection(row: TemplateDialogRow, checked: boolean | string | number) {
  if (checked) {
    if (!selectedUidMap.value[row.uid]) {
      selectedUids.value = selectedUids.value.concat(row.uid);
    }
  } else {
    selectedUids.value = selectedUids.value.filter((uid) => uid !== row.uid);
  }
}

function toggleVisibleRows(checked: boolean | string | number) {
  const visibleUids = visibleRows.value.map(({ row }) => row.uid);
  const visibleMap = visibleUids.reduce<Record<string, boolean>>((map, uid) => {
    map[uid] = true;
    return map;
  }, {});
  if (checked) {
    const appended = visibleUids.filter((uid) => !selectedUidMap.value[uid]);
    selectedUids.value = selectedUids.value.concat(appended);
  } else {
    selectedUids.value = selectedUids.value.filter((uid) => !visibleMap[uid]);
  }
}

async function handleBulkDataSourceChange(value: string) {
  if (!value) return;
  if (!selectedRows.value.length) {
    BaseToast.warning("请先勾选需要设置的科目行");
    bulkDataSourceType.value = "";
    return;
  }
  const option = DATA_SOURCE_OPTIONS.find((item) => item.value === value);
  const label = option ? option.label : value;
  try {
    await ElMessageBox.confirm(
      `确认将已选的 ${selectedRows.value.length} 行统一设置为“${label}”吗？`,
      "提示",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      },
    );
    selectedRows.value.forEach((row) => {
      row.dataSourceType = value as TemplateEntryMode;
      handleDataSourceChange(row);
    });
    BaseToast.success("批量设置成功");
  } catch {
    // 用户取消
  } finally {
    bulkDataSourceType.value = "";
  }
}

function removeRow(index: number) {
  const [removed] = form.rows.splice(index, 1);
  if (removed) {
    selectedUids.value = selectedUids.value.filter((uid) => uid !== removed.uid);
  }
}

function handleBatchConfirm(payload: {
  subjects: FlatSubject[];
  dataSourceType: TemplateEntryMode;
}) {
  payload.subjects.forEach((subject) => {
    form.rows.push(
      createTemplateRow({
        subjectId: subject.id,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        dataSourceType: payload.dataSourceType,
      }),
    );
  });
  BaseToast.success(`已添加 ${payload.subjects.length} 个科目`);
  if (form.rows.length > 20) fullscreen.value = true;
}

function openFormulaBind(row: TemplateDialogRow) {
  if (row.dataSourceType !== CALCULATED_SOURCE) return;
  const subject = findSubjectById(subjectFlatList.value, row.subjectId);
  if (!hasValue(row.subjectId) || !subject?.isLeaf) {
    BaseToast.warning("请先选择叶子科目");
    return;
  }
  formulaBindRow.value = row;
  formulaVisible.value = true;
}

function handleFormulaConfirm(payload: {
  formula: FormulaOption;
  bindings: FormulaParameterBinding[];
}) {
  const row = formulaBindRow.value;
  if (!row) return;
  row.formulaId = payload.formula.value;
  row.formulaCode = payload.formula.formulaCode;
  row.formulaName = payload.formula.label;
  row.formulaExpression = payload.formula.expression;
  row.formulaParameterBindings = payload.bindings;
}

function handleClosed() {
  resetForm();
}

function handleCancel() {
  emit("update:modelValue", false);
}

async function handleSave() {
  const message = validateDialogForm(form.templateName, form.rows, subjectFlatList.value);
  if (message) {
    BaseToast.warning(message);
    return;
  }
  if (!currentUserId.value || !currentUserName.value) {
    BaseToast.error("未获取到当前用户信息，请重新登录后再试");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      templateName: form.templateName.trim(),
      templateCode: form.templateCode,
      status: form.status || "ACTIVE",
      creatorId: currentUserId.value,
      creatorName: currentUserName.value,
      items: buildTemplateItemsPayload(form.rows),
    };
    if (props.mode === "edit" && form.id) {
      await updateTemplate({ id: form.id, ...payload });
      BaseToast.success("模板已更新");
    } else {
      await createTemplate(payload);
      BaseToast.success("模板已创建");
    }
    emit("update:modelValue", false);
    emit("saved");
  } catch (error: unknown) {
    const text = error instanceof Error ? error.message : "保存失败，请稍后重试";
    BaseToast.error(text);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="980px"
    :fullscreen="fullscreen"
    :close-on-click-modal="false"
    append-to-body
    class="revenue-template-dialog"
    :class="{ 'revenue-template-dialog--fullscreen': fullscreen }"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="handleClosed"
  >
    <div v-loading="loading" class="template-dialog-layout">
      <el-form label-width="88px" size="small">
        <el-form-item label="模板名称" required>
          <el-input
            v-model.trim="form.templateName"
            maxlength="128"
            placeholder="请输入模板名称"
          />
        </el-form-item>
      </el-form>

      <div class="template-edit-section">
        <div class="template-edit-section__head">
          <span class="template-edit-section__title">模板科目配置</span>
          <div class="template-edit-section__tools">
            <div class="template-edit-section__ops">
              <el-button
                v-if="showFullscreenToggle"
                plain
                size="small"
                :icon="fullscreen ? ScaleToOriginal : FullScreen"
                @click="fullscreen = !fullscreen"
              >
                {{ fullscreen ? "普通视图" : "全屏编辑" }}
              </el-button>
              <div
                class="template-tool-select"
                :class="{ 'is-disabled': !selectedRows.length }"
              >
                <el-select
                  v-model="bulkDataSourceType"
                  size="small"
                  clearable
                  :disabled="!selectedRows.length"
                  placeholder="批量设置已选"
                  @change="handleBulkDataSourceChange"
                >
                  <el-option
                    v-for="option in DATA_SOURCE_OPTIONS"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
              </div>
              <span class="template-selected-count">已选 {{ selectedRows.length }}</span>
              <el-button
                plain
                size="small"
                :class="{ 'is-active': onlyShowUnboundRows }"
                @click="onlyShowUnboundRows = !onlyShowUnboundRows"
              >
                仅看待绑定
              </el-button>
            </div>
            <div class="template-edit-section__adds">
              <el-button
                type="primary"
                plain
                size="small"
                :icon="FolderAdd"
                :disabled="!canAddRow"
                @click="batchVisible = true"
              >
                批量添加科目
              </el-button>
            </div>
          </div>
        </div>

        <div class="template-row-table">
          <div class="template-row-table__head">
            <span class="template-row-select-cell">
              <el-checkbox
                :model-value="allVisibleSelected"
                :indeterminate="visibleIndeterminate"
                :disabled="!visibleRows.length"
                @change="toggleVisibleRows"
              />
            </span>
            <span>科目</span>
            <span>数据来源</span>
            <span>绑定公式</span>
            <span>操作</span>
          </div>
          <div v-if="!form.rows.length" class="template-row-table__empty">
            请通过批量添加科目配置模板
          </div>
          <div v-else-if="!visibleRows.length" class="template-row-table__empty">
            没有符合条件的科目
          </div>
          <div
            v-for="{ row, index } in visibleRows"
            :key="row.uid"
            class="template-row-table__row"
          >
            <span class="template-row-select-cell">
              <el-checkbox
                :model-value="Boolean(selectedUidMap[row.uid])"
                @change="(checked: boolean | string | number) => toggleRowSelection(row, checked)"
              />
            </span>
            <div class="template-subject-cell">
              <!-- 对齐 Vue2：科目名后跟全路径（小字灰色），与数据来源下拉同高 -->
              <el-tree-select
                v-model="row.subjectId"
                class="template-subject-select"
                :data="subjectTreeForRow(row.uid)"
                :props="{ label: 'label', value: 'id', children: 'children', disabled: 'disabled' }"
                node-key="id"
                check-strictly
                clearable
                filterable
                placeholder="请选择科目"
                no-data-text="暂无数据"
                style="width: 100%"
                @change="handleSubjectChange(row)"
              >
                <template #label="{ label, value }">
                  <div class="template-subject-value">
                    <span class="template-subject-value__name">{{ label }}</span>
                    <span
                      v-if="findSubjectById(subjectFlatList, value)?.pathLabel"
                      class="template-subject-value__path"
                      :title="findSubjectById(subjectFlatList, value)?.pathLabel"
                    >
                      {{ findSubjectById(subjectFlatList, value)?.pathLabel }}
                    </span>
                  </div>
                </template>
              </el-tree-select>
            </div>
            <el-select
              v-model="row.dataSourceType"
              class="template-source-select"
              placeholder="请选择数据来源"
              @change="handleDataSourceChange(row)"
            >
              <el-option
                v-for="option in DATA_SOURCE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <div class="template-formula-cell">
              <el-button
                size="small"
                plain
                :icon="Connection"
                :disabled="row.dataSourceType !== CALCULATED_SOURCE"
                @click="openFormulaBind(row)"
              >
                {{ row.formulaName ? "重新绑定" : "绑定公式" }}
              </el-button>
              <span v-if="row.formulaName" class="template-formula-cell__name">
                {{ row.formulaName }}
              </span>
              <span v-else class="template-formula-cell__empty">
                {{ row.dataSourceType === CALCULATED_SOURCE ? "未绑定" : "无需绑定" }}
              </span>
            </div>
            <div class="template-row-actions">
              <el-button
                size="small"
                type="danger"
                link
                :icon="Delete"
                @click="removeRow(index)"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="template-dialog-footer">
        <span class="template-dialog-summary">
          共 {{ stats.total }} 个科目
          <span>已选 {{ selectedRows.length }} 个</span>
          <span>计算类 {{ stats.calculated }} 个</span>
          <span>待绑定 {{ stats.unbound }} 个</span>
        </span>
        <span class="template-dialog-footer-actions">
          <el-button @click="handleCancel">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        </span>
      </div>
    </template>
  </el-dialog>

  <BatchAddSubjectDialog
    v-model="batchVisible"
    :subject-tree="subjectTree"
    :subject-flat-list="subjectFlatList"
    :occupied-subject-ids="occupiedSubjectIds"
    @confirm="handleBatchConfirm"
  />
  <FormulaBindDialog
    v-model="formulaVisible"
    :rows="form.rows"
    :current-row="formulaBindRow"
    :formula-options="formulaOptions"
    :subject-flat-list="subjectFlatList"
    @confirm="handleFormulaConfirm"
  />
</template>

<style scoped>
.template-edit-section {
  padding-top: 6px;
}

.template-edit-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.template-edit-section__title {
  color: #303133;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.template-edit-section__tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.template-edit-section__ops,
.template-edit-section__adds {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.template-edit-section__adds {
  padding-left: 10px;
  border-left: 1px solid #ebeef5;
}

.template-tool-select {
  width: 174px;
}

.template-tool-select.is-disabled {
  opacity: 0.65;
}

.template-selected-count {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid #e4e7ed;
  background: #fafafa;
  color: #606266;
  font-size: 12px;
}

.template-row-table {
  border: 1px solid #e4e7ed;
  background: #fff;
  max-height: 460px;
  overflow: auto;
}

.template-row-table__head,
.template-row-table__row {
  display: grid;
  grid-template-columns: 34px minmax(220px, 1.16fr) 160px minmax(210px, 0.9fr) 82px;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
}

.template-row-select-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-row-table__head {
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid #e4e7ed;
  background: #f5f7fa;
  color: #606266;
  font-weight: 600;
}

.template-row-table__row + .template-row-table__row {
  border-top: 1px solid #ebeef5;
}

.template-row-table__empty {
  padding: 26px 12px;
  color: #909399;
  text-align: center;
}

.template-subject-cell {
  min-width: 0;
}

/* 对齐 Vue2：科目下拉与数据来源下拉同高 40px */
.template-subject-select,
.template-source-select {
  width: 100%;
}

.template-subject-cell :deep(.el-select__wrapper),
.template-source-select :deep(.el-select__wrapper) {
  min-height: 40px;
  height: 40px;
}

.template-subject-cell :deep(.el-select__selection),
.template-source-select :deep(.el-select__selection) {
  height: 100%;
}

.template-subject-cell :deep(.el-select__selected-item) {
  display: flex;
  align-items: center;
  max-width: 100%;
  overflow: hidden;
}

.template-subject-value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.template-subject-value__name,
.template-subject-value__path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-subject-value__name {
  flex: 0 0 auto;
  max-width: 48%;
  color: #303133;
  font-size: 14px;
  line-height: 20px;
}

/* 全路径跟在科目名后面：字号更小、灰色 */
.template-subject-value__path {
  flex: 1 1 auto;
  min-width: 0;
  color: #909399;
  font-size: 12px;
  line-height: 18px;
}

.template-formula-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 40px;
}

.template-formula-cell__name {
  overflow: hidden;
  color: #409eff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-formula-cell__empty {
  color: #c0c4cc;
}

.template-row-actions {
  text-align: right;
}

.template-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.template-dialog-summary {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  color: #606266;
  font-size: 13px;
}

.template-dialog-footer-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.is-active {
  border-color: #409eff;
  background: #e8f3ff;
  color: #1682e6;
}

:deep(.revenue-template-dialog--fullscreen .template-row-table) {
  max-height: none;
  flex: 1 1 auto;
}
</style>
