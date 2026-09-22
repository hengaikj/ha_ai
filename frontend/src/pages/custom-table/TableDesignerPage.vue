<script setup lang="ts">
import { CirclePlus } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { ApiBusinessError } from "@/api/http";
import {
  createCustTableTemplate,
  getCustTableTemplate,
  listCustTableProviders,
  publishCustTableTemplate,
  saveCustTableTemplateDraft,
} from "@/api/cust-table";
import { createIdempotencyKey } from "@/utils/idempotency";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BasePromptDialog from "@/components/base/BasePromptDialog.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import { useBasePromptDialog } from "@/composables/useBasePromptDialog";
import type {
  TableColumnSchema,
  TableProviderCatalogItem,
  TableProviderDescriptor,
  TableTemplateDetail,
  TableTemplateSchema,
  TableTemplateExtensions,
  TableTemplateValidationResult,
} from "@/types/custom-table";
import { EMPTY_TABLE_SCHEMA } from "@/types/custom-table";
import ProviderFieldPanel from "./components/ProviderFieldPanel.vue";
import DesignerCommandBar from "./components/DesignerCommandBar.vue";
import GridDesigner from "./components/GridDesigner.vue";
import SheetDesigner from "./components/SheetDesigner.vue";
import DesignExtensionPanel from "./components/DesignExtensionPanel.vue";
import TemplateValidationDrawer from "./components/TemplateValidationDrawer.vue";
import TemplateJsonDrawer from "./components/TemplateJsonDrawer.vue";
import { createBlankSheet } from "./utils/table-sheet";
import {
  decodeCustTableSchema,
  encodeCustTableSchema,
} from "./adapters/cust-table-schema-adapter";
import {
  designerCommands,
  useDesignerCommands,
  type DesignerCommand,
} from "./composables/useDesignerCommands";
import type { CellRange } from "./utils/table-sheet";
const route = useRoute();
const router = useRouter();
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } =
  useBaseConfirmDialog();
const { promptState, openPrompt, resolvePrompt, rejectPrompt } =
  useBasePromptDialog();
const templateId = ref(String(route.params.templateId ?? ""));
const detail = ref<TableTemplateDetail>();
const providers = ref<TableProviderCatalogItem[]>([]);
function cloneSchema(value: TableTemplateSchema): TableTemplateSchema {
  return JSON.parse(JSON.stringify(value)) as TableTemplateSchema;
}
const schema = reactive<TableTemplateSchema>(cloneSchema(EMPTY_TABLE_SCHEMA));
const schemaCommands = useDesignerCommands(cloneSchema(EMPTY_TABLE_SCHEMA));
const activeSheetName = ref(schema.sheets[0]?.name ?? "");
const loading = ref(false);
const preview = ref(false);
const validationDrawerOpen = ref(false);
const jsonDrawerOpen = ref(false);
const validationResult = ref<TableTemplateValidationResult | null>(null);
const schemaJsonPreview = computed(() => JSON.stringify(schema, null, 2));
const publishRequestId = ref("");
const savedSchemaSnapshot = ref(JSON.stringify(schema));
const lastSavedStatus = ref("尚未保存");
const dirty = computed(
  () => JSON.stringify(schema) !== savedSchemaSnapshot.value,
);
const savingState = computed(() =>
  dirty.value ? "有未保存更改" : lastSavedStatus.value,
);
const isMobile = ref(false);
const inspectorCollapsed = ref(false);
const activeInspectorTab = ref<"properties" | "rules" | "permissions">(
  "properties",
);
let mobileMedia: ReturnType<typeof window.matchMedia> | undefined;
let narrowMedia: ReturnType<typeof window.matchMedia> | undefined;
const selectedKeys = computed(() => {
  const keys = schema.columns.map((item) => item.key);
  schema.sheets.forEach((sheet) =>
    sheet.cells.forEach((cell) => {
      if (cell.binding.type === "PROVIDER_FIELD" && cell.binding.key) {
        keys.push(cell.binding.key);
      }
    }),
  );
  return [...new Set(keys)];
});
const selectedProvider = computed(
  () =>
    providers.value.find(
      (item) => item.providerCode === schema.provider.providerCode,
    )?.descriptor,
);
const designerStats = computed(() => [
  { label: "字段", value: selectedKeys.value.length },
  { label: "Sheet", value: schema.sheets.length },
  {
    label: "单元格",
    value: schema.sheets.reduce(
      (total, sheet) => total + sheet.cells.length,
      0,
    ),
  },
  { label: "公式", value: schema.formulas.length },
]);
const activeProviderLabel = computed(() => {
  if (!selectedProvider.value) return "未选择 Provider";
  return `${selectedProvider.value.ownerModule} / ${selectedProvider.value.providerCode}`;
});
const schemaBytes = computed(() => new Blob([JSON.stringify(schema)]).size);
const schemaExtensions = computed<TableTemplateExtensions>({
  get: () =>
    schema.extensions ?? {
      designWorkbench: {
        version: "1.0",
        variables: [],
        regions: [],
        validationRules: [],
        conditionalStyles: [],
      },
    },
  set: (value) => {
    schema.extensions = value;
  },
});
function applySchema(next: TableTemplateSchema) {
  Object.assign(schema, cloneSchema({ ...next, sheets: next.sheets ?? [] }));
  schemaCommands.reset(schema);
  savedSchemaSnapshot.value = JSON.stringify(schema);
  activeSheetName.value = schema.sheets[0]?.name ?? "";
  lastSavedStatus.value = "已保存";
}
async function loadDetail() {
  if (!templateId.value) return;
  const custTableDetail = await getCustTableTemplate(templateId.value);
  const draftSchema = decodeCustTableSchema(
    JSON.parse(custTableDetail.schemaJson),
  );
  detail.value = {
    id: custTableDetail.id,
    templateCode: custTableDetail.templateCode,
    templateName: custTableDetail.templateName,
    status: custTableDetail.status,
    lockVersion: custTableDetail.lockVersion,
    draftSchema,
  } as TableTemplateDetail;
  applySchema(draftSchema);
}
onMounted(async () => {
  mobileMedia = window.matchMedia("(max-width: 760px)");
  narrowMedia = window.matchMedia("(max-width: 1360px)");
  syncResponsiveState();
  mobileMedia.addEventListener?.("change", syncResponsiveState);
  narrowMedia.addEventListener?.("change", syncResponsiveState);
  loading.value = true;
  try {
    const [providerItems] = await Promise.all([
      listCustTableProviders(),
      loadDetail(),
    ]);
    providers.value = providerItems;
  } finally {
    loading.value = false;
  }
});
onBeforeUnmount(() => {
  mobileMedia?.removeEventListener?.("change", syncResponsiveState);
  narrowMedia?.removeEventListener?.("change", syncResponsiveState);
});
function syncResponsiveState() {
  isMobile.value = mobileMedia?.matches ?? false;
  if (narrowMedia?.matches) inspectorCollapsed.value = true;
}
watch(
  () => schema.renderer,
  (renderer) => {
    if (renderer !== "SHEET" || schema.sheets.length > 0) return;
    schema.sheets.push(createBlankSheet());
    activeSheetName.value = schema.sheets[0]?.name ?? "";
  },
);
function selectProvider(provider: TableProviderDescriptor) {
  schema.provider = {
    ownerModule: provider.ownerModule,
    providerCode: provider.providerCode,
    dataShape: provider.dataShape,
  };
  schema.query.parameterKeys = provider.parameters
    .filter((item) => item.required)
    .map((item) => item.key);
  schema.query.defaultSortField = null;
  schema.columns = [];
}
function toggleField(key: string) {
  const provider = selectedProvider.value;
  const field = provider?.fields.find((item) => item.key === key);
  if (!field) return;
  const index = schema.columns.findIndex((item) => item.key === key);
  if (index >= 0) schema.columns.splice(index, 1);
  else
    schema.columns.push({
      key: field.key,
      label: field.label,
      valueType: field.valueType,
      required: false,
      editable: false,
      commandCode: null,
      children: [],
    } as TableColumnSchema);
}
function validateLocal() {
  const errors: string[] = [];
  if (!schema.title.trim()) errors.push("模板名称不能为空");
  if (!/^[A-Za-z0-9._-]+$/.test(schema.templateCode))
    errors.push("模板编码格式不正确");
  if (!selectedProvider.value) errors.push("必须选择有效 Provider");
  if (schema.renderer === "GRID" && !schema.columns.length)
    errors.push("Grid模板至少选择一个字段");
  if (schema.renderer === "SHEET" && !schema.sheets.length)
    errors.push("Sheet模板至少包含一个工作表");
  if (
    schema.query.defaultSortField &&
    !selectedProvider.value?.sortableFields.includes(
      schema.query.defaultSortField,
    )
  )
    errors.push("默认排序字段不在 Provider 白名单中");
  if (schemaBytes.value > 2 * 1024 * 1024) errors.push("Schema 超过 2 MB");
  return errors;
}
async function persist() {
  const errors = validateLocal();
  if (errors.length) {
    validationResult.value = {
      valid: false,
      errorCode: "LOCAL_SCHEMA_INVALID",
      fieldPath: "",
      message: errors[0],
      schemaHash: null,
    };
    validationDrawerOpen.value = true;
    BaseToast.error(errors[0]);
    return false;
  }
  loading.value = true;
  try {
    if (!templateId.value) {
      const requestId = createIdempotencyKey();
      const created = await createCustTableTemplate({
        requestId,
        templateCode: schema.templateCode,
        templateName: schema.title,
        schemaJson: JSON.stringify(encodeCustTableSchema(schema)),
      });
      templateId.value = created.id;
      detail.value = {
        ...(detail.value ?? {}),
        id: created.id,
        templateCode: created.templateCode,
        templateName: created.templateName,
        status: created.status,
        lockVersion: created.lockVersion,
        draftSchema: cloneSchema(schema),
      } as TableTemplateDetail;
      await router.replace(`/custom-table/designer/${created.id}`);
    } else {
      const saved = await saveCustTableTemplateDraft(templateId.value, {
        requestId: createIdempotencyKey(),
        schemaJson: JSON.stringify(encodeCustTableSchema(schema)),
        lockVersion: detail.value?.lockVersion ?? 0,
      });
      detail.value = {
        ...detail.value,
        id: saved.id,
        templateCode: saved.templateCode,
        templateName: saved.templateName,
        status: saved.status,
        lockVersion: saved.lockVersion,
        draftSchema: cloneSchema(schema),
      } as TableTemplateDetail;
    }
    savedSchemaSnapshot.value = JSON.stringify(schema);
    schemaCommands.sync(schema);
    schemaCommands.markSaved();
    lastSavedStatus.value = "刚刚保存";
    BaseToast.success("草稿已保存");
    return true;
  } catch (error) {
    await handleConflict(error);
    return false;
  } finally {
    loading.value = false;
  }
}
async function publish() {
  if (dirty.value && !(await persist())) return;
  const errors = validateLocal();
  if (errors.length) {
    BaseToast.error(errors[0]);
    return;
  }
  let remark: string;
  try {
    remark = await openPrompt({
      title: "发布模板",
      label: "版本说明",
      placeholder: "请输入本次版本的主要变更",
      inputType: "textarea",
      confirmText: "发布",
      validator: (value) => Boolean(value) || "请输入版本说明",
    });
  } catch {
    return;
  }
  publishRequestId.value ||= createIdempotencyKey();
  loading.value = true;
  try {
    await publishCustTableTemplate(templateId.value, {
      requestId: publishRequestId.value,
      remark,
    });
    publishRequestId.value = "";
    await loadDetail();
    BaseToast.success("模板版本已发布");
  } catch (error) {
    await handleConflict(error);
  } finally {
    loading.value = false;
  }
}
function updateSheet(
  sheetIndex: number,
  sheet: TableTemplateSchema["sheets"][number],
) {
  if (!schema.sheets[sheetIndex]) return;
  applyDesignerCommand({
    label: "更新工作表",
    execute(current) {
      const next = cloneSchema(current);
      next.sheets.splice(sheetIndex, 1, JSON.parse(JSON.stringify(sheet)));
      return next;
    },
  });
}
function applyDesignerCommand(command: DesignerCommand) {
  schemaCommands.sync(schema);
  const next = schemaCommands.execute(command);
  Object.assign(schema, cloneSchema(next));
}
function undoDesignerCommand() {
  const previous = schemaCommands.undo();
  if (previous) Object.assign(schema, cloneSchema(previous));
}
function redoDesignerCommand() {
  const next = schemaCommands.redo();
  if (next) Object.assign(schema, cloneSchema(next));
}
function setRequired(sheetIndex: number, range: CellRange) {
  applyDesignerCommand(designerCommands.setRequired(sheetIndex, range, true));
}
function openInspector(tab: "properties" | "rules" | "permissions") {
  activeInspectorTab.value = tab;
  inspectorCollapsed.value = false;
}
function addPermissionRule() {
  schema.permissions.push({
    permissionCode: "",
    targetKey: activeSheetName.value || "*",
    visible: true,
    editable: false,
  });
}
async function handleConflict(error: unknown) {
  if (
    error instanceof ApiBusinessError &&
    (/冲突|乐观锁|lock/i.test(error.message) ||
      ["409", "500"].includes(error.code))
  ) {
    await loadDetail();
    BaseToast.warning("模板已被其他用户修改，已重新载入最新草稿。");
    return;
  }
  throw error;
}
onBeforeRouteLeave(async (_to, _from, next) => {
  if (!dirty.value) {
    next();
    return;
  }
  try {
    await openConfirm({
      title: "未保存提示",
      message: "当前模板草稿尚未保存，确认放弃更改并离开设计工作台吗？",
      confirmText: "离开",
    });
    next();
  } catch {
    next(false);
  }
});
</script>
<template>
  <div v-loading="loading" class="designer">
    <DesignerCommandBar
      :title="schema.title"
      :status="savingState"
      :provider-label="activeProviderLabel"
      :renderer="schema.renderer"
      :readonly="isMobile"
      :inspector-collapsed="inspectorCollapsed"
      :show-inspector-toggle="!isMobile"
      @back="router.push('/custom-table/templates')"
      @preview="preview = true"
      @save="persist"
      @publish="publish"
      @toggle-inspector="inspectorCollapsed = !inspectorCollapsed"
      @update:renderer="schema.renderer = $event"
    />
    <section class="workbench-summary" data-test="designer-stats">
      <div class="summary-main">
        <strong>{{
          schema.renderer === "SHEET" ? "Sheet 设计" : "Grid 设计"
        }}</strong>
        <span
          >{{ schema.templateCode || "未设置模板编码" }} ·
          {{ activeProviderLabel }}</span
        >
      </div>
      <div class="summary-stats">
        <span
          v-for="stat in designerStats"
          :key="stat.label"
          class="summary-stat"
        >
          <strong>{{ stat.value }}</strong>
          <small>{{ stat.label }}</small>
        </span>
      </div>
    </section>
    <el-alert
      v-if="isMobile"
      title="移动端仅提供只读预览，请使用桌面端编辑模板。"
      type="info"
      show-icon
      :closable="false"
    />
    <div
      class="workspace"
      :class="{ 'inspector-collapsed': inspectorCollapsed }"
    >
      <aside class="provider-panel">
        <div class="panel-title">数据源字段</div>
        <ProviderFieldPanel
          :providers="providers"
          :selected-provider-code="schema.provider.providerCode"
          :selected-keys="selectedKeys"
          :readonly="isMobile"
          @select-provider="selectProvider"
          @toggle-field="toggleField"
        />
      </aside>
      <main class="canvas-panel">
        <GridDesigner
          v-if="schema.renderer === 'GRID'"
          :columns="schema.columns"
          :readonly="isMobile"
        /><SheetDesigner
          v-else
          :sheets="schema.sheets"
          :provider-fields="selectedProvider?.fields ?? []"
          :formulas="schema.formulas"
          :readonly="isMobile"
          :can-undo="schemaCommands.canUndo.value"
          :can-redo="schemaCommands.canRedo.value"
          :save-status="savingState"
          @update-sheet="updateSheet"
          @execute-command="applyDesignerCommand"
          @active-sheet-change="activeSheetName = $event"
          @undo="undoDesignerCommand"
          @redo="redoDesignerCommand"
          @set-required="setRequired"
          @open-inspector="openInspector"
        />
      </main>
      <aside v-show="!inspectorCollapsed" class="properties">
        <div class="inspector-tabs" data-test="inspector-tabs">
          <button
            data-inspector-tab="properties"
            type="button"
            :class="{ active: activeInspectorTab === 'properties' }"
            @click="activeInspectorTab = 'properties'"
          >
            属性
          </button>
          <button
            data-inspector-tab="rules"
            type="button"
            :class="{ active: activeInspectorTab === 'rules' }"
            @click="activeInspectorTab = 'rules'"
          >
            规则
          </button>
          <button
            data-inspector-tab="permissions"
            type="button"
            :class="{ active: activeInspectorTab === 'permissions' }"
            @click="activeInspectorTab = 'permissions'"
          >
            权限
          </button>
        </div>

        <section
          v-show="activeInspectorTab === 'properties'"
          class="inspector-pane"
        >
          <div class="panel-title">模板属性</div>
          <el-form label-position="top">
            <el-form-item label="模板名称">
              <el-input
                v-model="schema.title"
                :disabled="isMobile"
                maxlength="200"
              />
            </el-form-item>
            <el-form-item label="模板编码">
              <el-input
                v-model="schema.templateCode"
                :disabled="isMobile"
                placeholder="例如 budget.project.list"
              />
            </el-form-item>
            <el-form-item label="模板类型">
              <el-select
                v-model="schema.templateKind"
                :disabled="isMobile"
                clearable
              >
                <el-option label="查询表" value="QUERY" />
                <el-option label="会议表" value="MEETING" />
                <el-option label="报表" value="REPORT" />
                <el-option label="收益动态" value="REVENUE_DYNAMIC" />
              </el-select>
            </el-form-item>
            <el-form-item label="默认排序">
              <el-select
                v-model="schema.query.defaultSortField"
                clearable
                :disabled="isMobile || !selectedProvider"
              >
                <el-option
                  v-for="key in selectedProvider?.sortableFields"
                  :key="key"
                  :label="key"
                  :value="key"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="冻结行">
              <el-input-number
                v-model="schema.layout.frozenRows"
                :min="0"
                :max="20"
                :disabled="isMobile"
              />
            </el-form-item>
          </el-form>
        </section>

        <section v-show="activeInspectorTab === 'rules'" class="inspector-pane">
          <div class="formula-title">
            <span>公式定义</span>
            <el-button
              text
              type="primary"
              :icon="CirclePlus"
              :disabled="isMobile"
              @click="
                schema.formulas.push({
                  key: `formula_${schema.formulas.length + 1}`,
                  expression: '0',
                  scale: 2,
                  roundingMode: 'HALF_UP',
                })
              "
              >新增</el-button
            >
          </div>
          <el-empty
            v-if="!schema.formulas.length"
            description="暂无公式"
            :image-size="64"
          />
          <div
            v-for="(formula, index) in schema.formulas"
            :key="index"
            class="formula-row"
          >
            <el-input
              v-model="formula.key"
              placeholder="稳定键"
              :disabled="isMobile"
            />
            <el-input
              v-model="formula.expression"
              placeholder="受限表达式"
              :disabled="isMobile"
            />
            <el-button
              text
              type="danger"
              :disabled="isMobile"
              @click="schema.formulas.splice(index, 1)"
              >删除</el-button
            >
          </div>
          <div class="inspector-divider">校验与动态区域</div>
          <DesignExtensionPanel
            v-model="schemaExtensions"
            :active-sheet-name="activeSheetName"
          />
        </section>

        <section
          v-show="activeInspectorTab === 'permissions'"
          class="inspector-pane"
        >
          <div class="formula-title">
            <span>权限规则</span>
            <el-button
              text
              type="primary"
              :icon="CirclePlus"
              :disabled="isMobile"
              @click="addPermissionRule"
              >新增</el-button
            >
          </div>
          <el-empty
            v-if="!schema.permissions.length"
            description="暂无权限规则"
            :image-size="64"
          />
          <div
            v-for="(permission, index) in schema.permissions"
            :key="index"
            class="permission-rule"
          >
            <el-input
              v-model="permission.permissionCode"
              placeholder="权限码"
              :disabled="isMobile"
            />
            <el-input
              v-model="permission.targetKey"
              placeholder="Sheet或字段键"
              :disabled="isMobile"
            />
            <div class="permission-switches">
              <el-checkbox v-model="permission.visible" :disabled="isMobile"
                >可见</el-checkbox
              >
              <el-checkbox v-model="permission.editable" :disabled="isMobile"
                >可编辑</el-checkbox
              >
              <el-button
                text
                type="danger"
                :disabled="isMobile"
                @click="schema.permissions.splice(index, 1)"
                >删除</el-button
              >
            </div>
          </div>
        </section>

        <div class="side-actions">
          <el-button size="small" @click="validationDrawerOpen = true"
            >校验报告</el-button
          >
          <el-button size="small" @click="jsonDrawerOpen = true"
            >JSON预览</el-button
          >
        </div>
        <div class="schema-size">
          Schema {{ (schemaBytes / 1024).toFixed(1) }} KB / 2048 KB
        </div>
      </aside>
    </div>
    <el-dialog v-model="preview" title="模板预览" width="min(1100px, 92vw)"
      ><div class="preview">
        <GridDesigner
          v-if="schema.renderer === 'GRID'"
          :columns="schema.columns"
          readonly
        /><SheetDesigner
          v-else
          :sheets="schema.sheets"
          :provider-fields="selectedProvider?.fields ?? []"
          :formulas="schema.formulas"
          readonly
          @update-sheet="updateSheet"
        /></div
    ></el-dialog>
    <TemplateValidationDrawer
      v-model="validationDrawerOpen"
      :result="validationResult"
    />
    <TemplateJsonDrawer
      v-model="jsonDrawerOpen"
      :schema-json="schemaJsonPreview"
      :template-code="schema.templateCode"
    />
    <BaseConfirm
      v-model="confirmState.visible"
      v-bind="confirmState"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
    <BasePromptDialog
      v-model="promptState.visible"
      v-model:value="promptState.value"
      :title="promptState.title"
      :label="promptState.label"
      :placeholder="promptState.placeholder"
      :input-type="promptState.inputType"
      :confirm-text="promptState.confirmText"
      :cancel-text="promptState.cancelText"
      :error="promptState.error"
      :loading="promptState.loading"
      :required="promptState.required"
      @confirm="resolvePrompt"
      @cancel="rejectPrompt"
    />
  </div>
</template>
<style scoped>
.designer {
  height: calc(100vh - var(--bq-header-height) - var(--bq-tags-height) - 24px);
  min-height: min(
    620px,
    calc(100vh - var(--bq-header-height) - var(--bq-tags-height) - 24px)
  );
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
}
.workbench-summary {
  flex: 0 0 auto;
  height: 72px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
}
.summary-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-main strong {
  font-size: 16px;
}
.summary-main span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.summary-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(64px, 1fr));
  gap: 10px;
}
.summary-stat {
  min-width: 64px;
  padding-left: 12px;
  border-left: 1px solid var(--el-border-color-lighter);
}
.summary-stat strong,
.summary-stat small {
  display: block;
}
.summary-stat strong {
  font-size: 18px;
  line-height: 1.2;
}
.summary-stat small {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.workspace {
  position: relative;
  display: grid;
  grid-template-columns: 260px minmax(520px, 1fr) 320px;
  flex: 1 1 auto;
  min-height: 0;
}
.workspace.inspector-collapsed {
  grid-template-columns: 260px minmax(520px, 1fr);
}
.canvas-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #f5f7fa;
}
.provider-panel {
  min-height: 0;
  padding: 14px 0 14px 14px;
  overflow: hidden;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}
.provider-panel .panel-title {
  padding-right: 14px;
}
.properties {
  min-height: 0;
  padding: 14px;
  overflow: auto;
  border-left: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}
.panel-title {
  margin-bottom: 14px;
  font-size: 15px;
  font-weight: 600;
}
.inspector-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 3px;
  margin-bottom: 14px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
.inspector-tabs button {
  height: 30px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}
.inspector-tabs button.active {
  background: var(--el-bg-color);
  color: var(--el-color-primary);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
}
.inspector-pane {
  min-height: 320px;
}
.properties :deep(.el-select) {
  width: 100%;
}
.side-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.schema-size {
  padding-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.formula-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 8px;
  font-size: 14px;
  font-weight: 600;
}
.formula-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.inspector-divider {
  padding: 14px 0 8px;
  margin-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 14px;
  font-weight: 600;
}
.permission-rule {
  display: grid;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.permission-switches {
  display: flex;
  align-items: center;
  gap: 8px;
}
.preview {
  height: 520px;
}
.file-input {
  display: none;
}
@media (max-width: 1360px) {
  .workspace,
  .workspace.inspector-collapsed {
    grid-template-columns: 220px minmax(480px, 1fr);
  }
  .properties {
    position: absolute;
    z-index: 10;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(320px, calc(100% - 220px));
    box-sizing: border-box;
    box-shadow: -4px 0 12px rgb(0 0 0 / 12%);
  }
  .summary-main span {
    display: none;
  }
}
@media (max-width: 760px) {
  .designer {
    height: auto;
    min-height: 600px;
  }
  .workbench-summary {
    height: auto;
    align-items: flex-start;
    flex-direction: column;
  }
  .summary-stats {
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .workspace {
    grid-template-columns: 1fr;
    flex: 0 0 auto;
    height: auto;
  }
  .provider-panel,
  .properties {
    display: none !important;
  }
  .canvas-panel {
    height: 520px;
  }
}
</style>
