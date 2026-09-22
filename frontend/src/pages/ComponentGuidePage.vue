<script setup lang="ts">
import { CirclePlus, Download, Upload } from "@element-plus/icons-vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import BaseAdvancedFilterDrawer from "@/components/base/BaseAdvancedFilterDrawer.vue";
import BaseAuditInfo from "@/components/base/BaseAuditInfo.vue";
import BaseBatchActionBar from "@/components/base/BaseBatchActionBar.vue";
import BaseCheckboxGroup from "@/components/base/BaseCheckboxGroup.vue";
import BaseColumnSettings from "@/components/base/BaseColumnSettings.vue";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseCopyableText from "@/components/base/BaseCopyableText.vue";
import ConfirmStatusSwitch from "@/components/base/ConfirmStatusSwitch.vue";
import BaseDateTime from "@/components/base/BaseDateTime.vue";
import BaseDataTable from "@/components/base/BaseDataTable.vue";
import BaseDetailDescriptions from "@/components/base/BaseDetailDescriptions.vue";
import BaseDictSelect from "@/components/base/BaseDictSelect.vue";
import BaseDrawer from "@/components/base/BaseDrawer.vue";
import BaseEditableTable from "@/components/base/BaseEditableTable.vue";
import BaseEmpty from "@/components/base/BaseEmpty.vue";
import BaseExportButton from "@/components/base/BaseExportButton.vue";
import BaseFilterTags from "@/components/base/BaseFilterTags.vue";
import BaseFormDialog from "@/components/base/BaseFormDialog.vue";
import BaseImportDialog from "@/components/base/BaseImportDialog.vue";
import BaseMoney from "@/components/base/BaseMoney.vue";
import BaseOverflowText from "@/components/base/BaseOverflowText.vue";
import BasePageTabs from "@/components/base/BasePageTabs.vue";
import BasePagination from "@/components/base/BasePagination.vue";
import BasePercent from "@/components/base/BasePercent.vue";
import BaseRadioGroup from "@/components/base/BaseRadioGroup.vue";
import BaseSearchForm from "@/components/base/BaseSearchForm.vue";
import BaseSelect from "@/components/base/BaseSelect.vue";
import BaseSectionTitle from "@/components/base/BaseSectionTitle.vue";
import BaseSplitPane from "@/components/base/BaseSplitPane.vue";
import BaseStatusSwitch from "@/components/base/BaseStatusSwitch.vue";
import BaseStatusTag from "@/components/base/BaseStatusTag.vue";
import BaseTimeline from "@/components/base/BaseTimeline.vue";
import BaseTreePanel from "@/components/base/BaseTreePanel.vue";
import BaseTreeSelect from "@/components/base/BaseTreeSelect.vue";
import BaseToolbar from "@/components/base/BaseToolbar.vue";
import BaseUpload from "@/components/base/BaseUpload.vue";
import DictTag from "@/components/base/DictTag.vue";
import SchemaDescriptions from "@/components/base/SchemaDescriptions.vue";
import SchemaForm from "@/components/base/SchemaForm.vue";
import SchemaFormDialog from "@/components/base/SchemaFormDialog.vue";
import SchemaSearchForm from "@/components/base/SchemaSearchForm.vue";
import TraceErrorAlert from "@/components/base/TraceErrorAlert.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import PermissionGuard from "@/components/security/PermissionGuard.vue";
import PermissionSchemaTable from "@/components/security/PermissionSchemaTable.vue";
import SecureField from "@/components/security/SecureField.vue";
import type {
  SchemaDescriptionItem,
  SchemaFormField,
  SchemaSearchField,
} from "@/types/schema-components";
import type { PermissionColumnSchema } from "@/types/table-permission";

type ComponentDoc = {
  name: string;
  scene: string;
  props: string;
  events: string;
  usage?: string;
};

const dialogVisible = ref(false);
const schemaDialogVisible = ref(false);
const drawerVisible = ref(false);
const confirmVisible = ref(false);
const importVisible = ref(false);
const advancedFilterVisible = ref(false);
const componentSearch = ref("");
const activeGroupKey = ref("");
let groupObserver: IntersectionObserver | undefined;
let contentScrollContainer: HTMLElement | null = null;
const enabled = ref(true);
const selectedDeptId = ref<number | null>(1);
const selectedStatus = ref<string | number | boolean | null>("ENABLED");
const selectedDict = ref<string | number | null>("ENABLED");
const selectedDataScope = ref<string | number | boolean>("SELF_DEPT");
const selectedFlags = ref<Array<string | number>>(["visible"]);
const activeTab = ref("user");
const visibleColumns = ref(["username", "displayName", "status"]);
const form = reactive({
  username: "admin",
  displayName: "系统管理员",
});
const schemaSearchModel = ref<Record<string, unknown>>({
  username: "admin",
  status: "ENABLED",
});
const schemaFormModel = ref<Record<string, unknown>>({
  username: "admin",
  displayName: "系统管理员",
  status: "ENABLED",
  dataScope: "SELF_DEPT",
  flags: ["visible"],
  enabled: true,
  remark: "用于演示 schema 表单。",
});

const demoRows = [
  {
    id: "1",
    username: "admin",
    displayName: "系统管理员",
    status: "ENABLED",
  },
  {
    id: "2",
    username: "cost-user",
    displayName: "成本专员",
    status: "DISABLED",
  },
];
async function queryDemoRows(pageSize: number, pageNum: number) {
  const start = (pageNum - 1) * pageSize;
  return {
    total: demoRows.length,
    list: demoRows.slice(start, start + pageSize),
  };
}
const permissionRows = [
  {
    id: "1",
    partName: "电池包总成",
    amount: "12500.50",
    supplier: "北汽供应商A",
  },
  {
    id: "2",
    partName: "电控模块",
    amount: "8600.00",
    supplier: "北汽供应商B",
  },
];
const permissionColumns: PermissionColumnSchema<
  (typeof permissionRows)[number]
>[] = [
  { prop: "partName", label: "零件名称", minWidth: 140 },
  {
    prop: "amount",
    label: "成本金额",
    permission: "MASKED",
    maskedValue: "****",
    align: "right",
    minWidth: 120,
  },
  {
    prop: "supplier",
    label: "供应商",
    permission: "UNREADABLE",
    hiddenWhenDenied: true,
    minWidth: 140,
  },
];
const permissionActions = [
  {
    key: "view",
    label: "查看",
    permission: undefined,
    type: "primary" as const,
  },
  { key: "edit", label: "编辑", permission: "component:demo:edit" },
];
const detailItems = computed(() => [
  { label: "用户名", value: form.username },
  { label: "显示名称", value: form.displayName },
  {
    label: "业务状态",
    value: enabled.value ? "ENABLED" : "DISABLED",
    slot: "status",
  },
  { label: "备注", value: null },
]);
const columnOptions = [
  { key: "username", label: "用户名", disabled: true },
  { key: "displayName", label: "显示名称" },
  { key: "status", label: "业务状态" },
];
const treeOptions = [
  {
    id: 1,
    label: "北汽集团",
    children: [
      { id: 11, label: "成本中心" },
      { id: 12, label: "平台管理" },
    ],
  },
];
const statusOptions = [
  { label: "启用", value: "ENABLED" },
  { label: "停用", value: "DISABLED" },
];
const statusTagOptions = [
  { label: "启用", value: "ENABLED", type: "success" as const },
  { label: "停用", value: "DISABLED", type: "info" as const },
  { label: "待确认", value: "WARNING", type: "warning" as const },
];
const schemaSearchFields: SchemaSearchField[] = [
  { prop: "username", label: "用户名", component: "input" },
  {
    prop: "status",
    label: "业务状态",
    component: "select",
    options: statusOptions,
  },
  { prop: "createdDate", label: "创建时间", component: "date" },
];
const dataScopeOptions = [
  { label: "本部门", value: "SELF_DEPT" },
  { label: "全部数据", value: "ALL" },
];
const flagOptions = [
  { label: "显示", value: "visible" },
  { label: "缓存", value: "cacheable" },
  { label: "外链", value: "externalLink" },
];
const schemaFormFields: SchemaFormField[] = [
  {
    prop: "username",
    label: "用户名",
    component: "input",
    required: true,
  },
  {
    prop: "displayName",
    label: "显示名称",
    component: "input",
    required: true,
  },
  {
    prop: "status",
    label: "业务状态",
    component: "select",
    options: statusOptions,
  },
  {
    prop: "dataScope",
    label: "数据范围",
    component: "radio",
    options: dataScopeOptions,
  },
  {
    prop: "flags",
    label: "菜单属性",
    component: "checkbox",
    options: flagOptions,
    span: 2,
  },
  {
    prop: "enabled",
    label: "是否启用",
    component: "switch",
  },
  {
    prop: "remark",
    label: "备注",
    component: "textarea",
    span: 2,
    rows: 3,
    help: "适合新增、编辑弹窗中的标准字段声明。",
  },
];
const filterTags = [
  { key: "status", label: "业务状态", value: "启用" },
  { key: "dept", label: "部门", value: "成本中心" },
];
const timelineItems = [
  {
    timestamp: "2026-06-20 10:00:00",
    title: "创建任务",
    description: "系统管理员创建导入任务。",
    type: "success" as const,
  },
  {
    timestamp: "2026-06-20 10:05:00",
    title: "完成校验",
    description: "校验通过，可确认导入。",
    type: "primary" as const,
  },
];
const pageTabs = [
  { name: "user", label: "用户管理", closable: false },
  { name: "role", label: "角色管理", closable: true },
];
const schemaDescriptionItems: SchemaDescriptionItem[] = [
  { prop: "username", label: "用户名" },
  { prop: "displayName", label: "显示名称" },
  {
    prop: "phone",
    label: "手机号",
    permission: "MASKED",
    maskedValue: "138****0000",
  },
  { prop: "secret", label: "密级字段", permission: "UNREADABLE" },
];
const schemaDescriptionData = {
  username: "admin",
  displayName: "系统管理员",
  phone: "13800000000",
  secret: "内部字段",
};

const docs: Record<string, ComponentDoc[]> = {
  页面与布局: [
    {
      name: "PageContainer",
      scene: "页面标题、描述和右侧操作区的统一容器。",
      props: "title、description",
      events: "无",
    },
    {
      name: "BaseSectionTitle",
      scene: "页面模块、详情区块和弹框内小节的统一标题。",
      props: "title、description、size、headingTag、title-extra 插槽、actions 插槽",
      events: "无",
      usage:
        '默认使用 16px 页面标题尺寸；弹框或抽屉内使用 size="small"，右侧操作通过 actions 插槽传入。',
    },
    {
      name: "SidebarMenuItem",
      scene: "后台左侧菜单递归渲染，通常只由 AppLayout 使用。",
      props: "item",
      events: "通过 el-menu router 触发路由跳转",
    },
  ],
  查询与表格: [
    {
      name: "BaseSearchForm",
      scene:
        "列表页查询条件区域，内置搜索/重置按钮，支持 3 列布局、标题与控件固定间距和展开/收起。",
      props: "searchText、resetText、loading、defaultExpanded",
      events: "search、reset",
    },
    {
      name: "SchemaSearchForm",
      scene: "schema 驱动查询表单，适合标准列表页快速声明查询项。",
      props: "modelValue、fields、loading",
      events: "update:modelValue、search、reset",
    },
    {
      name: "BaseToolbar",
      scene: "列表页工具栏，承载左侧主操作和右侧刷新/扩展操作。",
      props: "showRefresh、refreshText",
      events: "refresh",
    },
    {
      name: "BaseDataTable",
      scene: "纯表格、错误态、空态组合，可通过插槽定义列，并支持内置配置列。",
      props:
        "data、loading、error、rowKey、emptyTitle、emptyDescription、enableColumnSettings",
      events: "透传 el-table 事件",
    },
    {
      name: "BasePagination",
      scene: "统一分页布局和页大小选项，支持固定在屏幕下方。",
      props: "pageNo、pageSize、total、pageSizes、fixed",
      events: "page-change、size-change",
    },
    {
      name: "BaseBatchActionBar",
      scene: "表格选中数据后的批量操作提示和操作区。",
      props: "selectedCount、clearText",
      events: "clear",
    },
    {
      name: "BaseColumnSettings",
      scene:
        "表格列显示/隐藏设置，可直接绑定 BaseDataTable 实例，也兼容手动传入列配置。",
      props: "modelValue、columns、buttonText、target",
      events: "update:modelValue、change",
    },
    {
      name: "QueryTable",
      scene:
        "列表页查询、工具栏、表格、列设置和分页组合；推荐通过 func(pageSize, pageNum) 拉取数据并由组件内部分页。",
      props:
        "func：必传异步函数，组件加载数据时调用，入参为 pageSize、pageNum，返回 { total, list }。\nrowKey：表格行唯一标识，透传给 BaseDataTable / el-table，默认 id。\nemptyTitle：空状态标题，传给 BaseDataTable。\nemptyDescription：空状态描述，传给 BaseDataTable。\nshowSearch：是否显示搜索区；即使存在 search 插槽，也可设为 false 强制隐藏。\nshowToolbar：是否显示工具栏；有 toolbar / toolbarExtra 插槽时也会显示。\nshowPagination：是否显示分页器，默认 true。\nenableColumnSettings：是否启用列设置能力，默认 true。\nfixedPagination：是否将分页器固定在页面底部，默认 true。\nfitTableHeight：是否按可视区自动计算表格高度；固定分页时表格高度扣到分页条上沿，不再额外计算分页占位高度。\nfitTableMinHeight：fitTableHeight 开启后的最小表格高度，默认 260。\nsearchFormProps：透传给 BaseSearchForm 的属性，例如 searchText、resetText。\ntoolbarProps：透传给 BaseToolbar 的属性，例如 showRefresh、refreshText。\ntableProps：透传给 BaseDataTable / el-table 的属性，例如 height、stripe、border；显式传入 height/maxHeight 时优先使用业务传值。\npaginationProps：透传给 BasePagination 的属性，例如 pageSizes、layout、fixed。\ncolumnSettingsProps：透传给默认 BaseColumnSettings 的属性，例如 buttonText、columns、modelValue。",
      events:
        "search：点击搜索按钮时触发，随后组件会重置到第 1 页并重新加载。\nreset：点击重置按钮时触发，随后组件会重置到第 1 页并重新加载。\nrefresh：点击工具栏刷新时触发，随后组件会按当前分页重新加载。\nerror：func 执行失败时触发，参数为原始错误对象。\npage-change：页码变化时触发，参数为新的 pageNum。\nsize-change：页大小变化时触发，参数为新的 pageSize。",
    },
  ],
  树形与分栏: [
    {
      name: "BaseTreeSelect",
      scene: "部门、菜单、权限范围等树形选择。",
      props: "modelValue、data、multiple、checkStrictly、nodeKey、props",
      events: "update:modelValue、change",
    },
    {
      name: "BaseTreePanel",
      scene: "左侧部门树、菜单树、分类树筛选面板。",
      props: "title、data、nodeKey、props、currentKey、emptyText",
      events: "node-click、refresh",
    },
    {
      name: "BaseSplitPane",
      scene: "左树右表、左分类右详情等主从布局。",
      props: "sideWidth",
      events: "无",
    },
  ],
  表单与弹窗: [
    {
      name: "BaseSelect",
      scene: "普通枚举下拉选择。",
      props: "modelValue、options、placeholder、clearable、disabled",
      events: "update:modelValue、change",
    },
    {
      name: "BaseDictSelect",
      scene: "字典项下拉选择；当前接收 options，后续可对接字典接口。",
      props: "modelValue、dictType、options、placeholder、clearable",
      events: "update:modelValue、change",
    },
    {
      name: "BaseRadioGroup",
      scene: "状态、数据范围、菜单类型等枚举单选。",
      props: "modelValue、options、button、disabled",
      events: "update:modelValue、change",
    },
    {
      name: "BaseCheckboxGroup",
      scene: "菜单属性、权限点等多选。",
      props: "modelValue、options、border、disabled",
      events: "update:modelValue、change",
    },
    {
      name: "SchemaForm",
      scene: "schema 驱动表单，适合新增、编辑弹窗中的标准字段快速声明。",
      props: "modelValue、fields、columns、labelWidth、disabled",
      events: "update:modelValue、change",
    },
    {
      name: "SchemaFormDialog",
      scene: "schema 表单和弹窗的组合，用于标准新增/编辑场景。",
      props: "modelValue、formModel、fields、title、loading、columns",
      events: "update:modelValue、update:formModel、change、confirm、cancel",
    },
    {
      name: "BaseFormDialog",
      scene: "新增、编辑等中等复杂度表单弹窗。",
      props: "modelValue、title、width、loading、closeOnConfirm、bodyMaxHeight",
      events: "update:modelValue、confirm、cancel",
      usage:
        '长表单弹框使用 body-max-height 控制内容区滚动，例如 body-max-height="62vh"；标题区和底部操作区保持固定可见，业务页面不重复写 max-height / overflow-y。',
    },
    {
      name: "BaseDrawer",
      scene: "详情、授权、配置类侧边抽屉。",
      props: "modelValue、title、size、loading、showFooter",
      events: "update:modelValue、confirm、cancel",
    },
    {
      name: "BaseConfirm",
      scene: "删除、停用、生效等高风险操作二次确认，默认呈现弹框警示条。",
      props: "modelValue、title、message、type、width、loading",
      events: "update:modelValue、confirm、cancel",
    },
    {
      name: "BaseAdvancedFilterDrawer",
      scene: "复杂查询条件较多时的高级筛选抽屉。",
      props: "modelValue、title、loading",
      events: "update:modelValue、apply、reset",
    },
  ],
  数据展示: [
    {
      name: "BaseFilterTags",
      scene: "展示当前查询条件，支持移除单个条件和清空。",
      props: "filters、clearText",
      events: "remove、clear",
    },
    {
      name: "DictTag",
      scene: "字典、枚举和状态值标签展示，支持匹配失败兜底。",
      props: "value、options、fallback",
      events: "无",
    },
    {
      name: "BaseCopyableText",
      scene: "编码、traceId、用户 ID、文件 ID 等可复制文本。",
      props: "value、emptyText、copiedMessage",
      events: "无",
    },
    {
      name: "BaseOverflowText",
      scene: "长文本省略并通过 tooltip 查看完整内容。",
      props: "value、emptyText、width",
      events: "无",
    },
    {
      name: "BaseMoney",
      scene: "金额字段展示，右对齐并处理空值和负数。",
      props: "value",
      events: "无",
    },
    {
      name: "BasePercent",
      scene: "比例和完成率展示。",
      props: "numerator、denominator",
      events: "无",
    },
    {
      name: "BaseDateTime",
      scene: "日期时间字段展示。",
      props: "value",
      events: "无",
    },
    {
      name: "BaseDetailDescriptions",
      scene: "详情页字段展示，支持插槽覆盖单项内容。",
      props: "items、column、border、emptyText",
      events: "无",
    },
    {
      name: "SchemaDescriptions",
      scene: "schema 驱动详情描述，支持字段权限、脱敏和自定义插槽。",
      props: "data、items、column、border、emptyText",
      events: "无",
    },
    {
      name: "BaseEmpty",
      scene: "空列表、空详情、无查询结果。",
      props: "title、description",
      events: "无",
    },
    {
      name: "TraceErrorAlert",
      scene: "展示后端错误码、错误消息和 traceId。",
      props: "code、message、traceId",
      events: "无",
    },
    {
      name: "BaseToast",
      scene: "成功、复制完成、验证码错误等短时反馈消息。",
      props: "message、type、duration",
      events: "show、success、warning、error、info",
    },
  ],
  文件与任务: [
    {
      name: "BaseUpload",
      scene: "文件选择外壳；真实上传前必须接入后端文件安全校验。",
      props: "accept、limit、maxSizeMb、disabled、buttonText、tip",
      events: "selected、size-exceeded",
    },
    {
      name: "BaseImportDialog",
      scene: "导入任务弹窗，负责选择文件、下载模板、发起导入事件。",
      props: "modelValue、title、accept、loading、templateText",
      events: "update:modelValue、import、download-template",
    },
    {
      name: "BaseExportButton",
      scene: "导出入口按钮，页面负责权限、接口和任务结果。",
      props: "loading、disabled、text",
      events: "export",
    },
    {
      name: "BaseTimeline",
      scene: "任务步骤、操作日志、审批流程展示。",
      props: "items",
      events: "无",
    },
    {
      name: "BaseAuditInfo",
      scene: "创建人、创建时间、更新人、更新时间展示。",
      props: "createdBy、createdAt、updatedBy、updatedAt",
      events: "无",
    },
  ],
  复杂容器: [
    {
      name: "BasePageTabs",
      scene: "页签式子页面或后续多页签导航。",
      props: "modelValue、tabs",
      events: "update:modelValue、change、close",
    },
    {
      name: "BaseEditableTable",
      scene: "轻量可编辑表格外壳；复杂业务校验由页面控制。",
      props: "data、rowKey",
      events: "add-row、remove-row",
    },
  ],
  状态与权限: [
    {
      name: "BaseStatusTag",
      scene: "平台通用状态标签。",
      props: "status",
      events: "无",
    },
    {
      name: "BaseStatusSwitch",
      scene: "启用/停用类状态切换。",
      props: "modelValue、activeText、inactiveText、loading、disabled",
      events: "update:modelValue、change",
    },
    {
      name: "ConfirmStatusSwitch",
      scene: "启用/停用状态切换前确认，支持异步保存、失败回滚和刷新事件。",
      props:
        "modelValue、confirm、confirmMessage、beforeChange、successMessage",
      events: "update:modelValue、change、reload",
    },
    {
      name: "PermissionButton",
      scene: "带权限判断的按钮，无权限时禁用并提示原因。",
      props: "permission、disabledReason、type",
      events: "透传 el-button 事件",
    },
    {
      name: "PermissionGuard",
      scene: "按权限隐藏内容或显示占位提示。",
      props: "permission、mode、reason",
      events: "无",
    },
    {
      name: "PermissionCell",
      scene: "表格单元格级字段权限展示，支持明文、脱敏、不可见和编辑插槽。",
      props: "value、permission、editable、maskedValue、unreadableText",
      events: "无",
    },
    {
      name: "PermissionTableColumn",
      scene: "表格列级和单元格级权限封装，支持无权限隐藏列或脱敏展示。",
      props: "prop、label、permission、hiddenWhenDenied、maskedValue",
      events: "透传 el-table-column 插槽",
    },
    {
      name: "PermissionActionColumn",
      scene: "表格行操作列权限封装，根据权限过滤或禁用操作按钮。",
      props: "actions、label、width、disabledReason",
      events: "action",
    },
    {
      name: "PermissionSchemaTable",
      scene: "schema 驱动的权限表格组合，统一描述列权限、字段脱敏和行操作。",
      props: "data、columns、actions、loading、rowKey、actionWidth",
      events: "action",
    },
    {
      name: "SecureField",
      scene: "敏感字段明文、脱敏、不可见状态展示。",
      props: "value、permission、maskedValue、unreadableText、tooltip",
      events: "无",
    },
  ],
};

const groupMeta: Record<string, { key: string; description: string }> = {
  页面与布局: {
    key: "layout",
    description: "统一后台页面骨架、标题区、左侧菜单和基础布局边界。",
  },
  查询与表格: {
    key: "query-table",
    description: "覆盖列表页最常用的查询、工具栏、批量操作、表格和分页组合。",
  },
  树形与分栏: {
    key: "tree-pane",
    description: "承载部门树、菜单树、分类树和主从页面结构。",
  },
  表单与弹窗: {
    key: "form-dialog",
    description: "沉淀枚举输入、抽屉、确认框和中等复杂度表单弹窗。",
  },
  数据展示: {
    key: "display",
    description: "统一金额、比例、时间、空态、错误态、长文本和详情字段展示。",
  },
  文件与任务: {
    key: "file-task",
    description: "封装导入导出入口、上传外壳、任务步骤和审计信息展示。",
  },
  复杂容器: {
    key: "container",
    description: "支持页签、可编辑表格等更复杂的页面局部容器。",
  },
  状态与权限: {
    key: "status-permission",
    description: "统一状态表达、权限按钮、权限占位和敏感字段展示。",
  },
};

const componentGroups = computed(() =>
  Object.entries(docs).map(([title, items]) => ({
    title,
    items,
    count: items.length,
    key: groupMeta[title]?.key ?? title,
    description: groupMeta[title]?.description ?? "",
  })),
);
const componentCount = computed(() =>
  componentGroups.value.reduce((total, group) => total + group.count, 0),
);
const filteredComponentGroups = computed(() => {
  const keyword = componentSearch.value.trim().toLowerCase();
  if (!keyword) {
    return componentGroups.value;
  }

  return componentGroups.value
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        [group.title, item.name, item.scene, item.props, item.events]
          .join(" ")
          .toLowerCase()
          .includes(keyword),
      ),
    }))
    .filter((group) => group.items.length > 0);
});

function scrollToGroup(groupKey: string) {
  const target = document.getElementById(`component-group-${groupKey}`);
  if (!target) return;

  activeGroupKey.value = groupKey;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function observeGuideGroups() {
  groupObserver?.disconnect();
  groupObserver = undefined;
  contentScrollContainer = document.querySelector<HTMLElement>(
    ".app-layout__content",
  );

  const sections = filteredComponentGroups.value
    .map((group) => document.getElementById(`component-group-${group.key}`))
    .filter((section): section is HTMLElement => Boolean(section));
  if (!sections.length) return;

  groupObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const firstVisible = visibleEntries[0]?.target as HTMLElement | undefined;
      const groupKey = firstVisible?.id.replace("component-group-", "");
      if (groupKey) activeGroupKey.value = groupKey;
    },
    {
      root: contentScrollContainer,
      rootMargin: "-120px 0px -55% 0px",
      threshold: 0,
    },
  );
  sections.forEach((section) => groupObserver?.observe(section));
}

onMounted(() => {
  void nextTick(() => {
    activeGroupKey.value = filteredComponentGroups.value[0]?.key ?? "";
    observeGuideGroups();
  });
});

watch(filteredComponentGroups, () => {
  if (
    !filteredComponentGroups.value.some(
      (group) => group.key === activeGroupKey.value,
    )
  ) {
    activeGroupKey.value = filteredComponentGroups.value[0]?.key ?? "";
  }
  void nextTick(observeGuideGroups);
});

onBeforeUnmount(() => {
  groupObserver?.disconnect();
  groupObserver = undefined;
});
const visibleComponentCount = computed(() =>
  filteredComponentGroups.value.reduce(
    (total, group) => total + group.items.length,
    0,
  ),
);

const getComponentSource = (name: string) => {
  if (name === "QueryTable") {
    return "@/components/business/QueryTable.vue";
  }
  if (name === "PageContainer") {
    return "@/components/layout/PageContainer.vue";
  }
  if (name === "SidebarMenuItem") {
    return "@/components/layout/SidebarMenuItem.vue";
  }
  if (name === "BaseToast") {
    return "@/components/base/BaseToast.ts";
  }
  if (
    [
      "PermissionActionColumn",
      "PermissionButton",
      "PermissionCell",
      "PermissionGuard",
      "PermissionSchemaTable",
      "PermissionTableColumn",
      "SecureField",
    ].includes(name)
  ) {
    return `@/components/security/${name}.vue`;
  }
  if (
    [
      "ConfirmStatusSwitch",
      "DictTag",
      "SchemaDescriptions",
      "SchemaForm",
      "SchemaFormDialog",
      "SchemaSearchForm",
    ].includes(name)
  ) {
    return `@/components/base/${name}.vue`;
  }
  return `@/components/base/${name}.vue`;
};
</script>

<template>
  <PageContainer
    title="组件使用说明"
    description="企业级管理后台组件体系的使用场景、关键参数、事件约定和基础示例。"
  >
    <div class="component-guide">
      <section class="component-guide__overview">
        <div class="component-guide__overview-main">
          <p class="component-guide__eyebrow">BQ Design System</p>
          <h2>BQ UI Components</h2>
          <p>
            面向北汽企业级管理后台的前端组件说明页，集中展示组件分组、
            可运行示例、关键 Props 和事件契约。
          </p>
        </div>
        <div class="component-guide__overview-side">
          <div class="component-guide__stats" aria-label="组件总览">
            <div class="component-guide__stat">
              <strong>{{ componentCount }}</strong>
              <span>组件总览</span>
            </div>
            <div class="component-guide__stat">
              <strong>{{ componentGroups.length }}</strong>
              <span>能力分组</span>
            </div>
            <div class="component-guide__stat">
              <strong>0</strong>
              <span>新增接口</span>
            </div>
          </div>
          <label class="component-guide__search">
            <span>组件检索</span>
            <el-input
              v-model="componentSearch"
              clearable
              placeholder="输入组件名、场景或 Props"
            />
          </label>
        </div>
      </section>

      <section class="component-guide__principles" aria-label="设计准则">
        <div>
          <strong>设计准则</strong>
          <span>以 Element Plus 为底座，收敛业务后台高频模式。</span>
        </div>
        <div>
          <strong>视觉标准</strong>
          <span>延续北汽红、黑、白、灰体系，保持克制和高可读密度。</span>
        </div>
        <div>
          <strong>工程边界</strong>
          <span>组件页只做前端封装说明，不改变真实接口与权限契约。</span>
        </div>
      </section>

      <section class="component-guide__quickstart" aria-label="快速接入">
        <div>
          <strong>快速接入</strong>
          <code
            >import BaseDataTable from
            "@/components/base/BaseDataTable.vue";</code
          >
        </div>
        <div>
          <strong>使用约定</strong>
          <span
            >页面优先组合 BaseSearchForm、BaseToolbar、BaseDataTable 和
            BasePagination。</span
          >
        </div>
        <div>
          <strong>当前筛选</strong>
          <span
            >{{ visibleComponentCount }} / {{ componentCount }} Components</span
          >
        </div>
      </section>

      <div class="component-guide__body">
        <aside class="component-guide__catalog" aria-label="组件目录">
          <div class="component-guide__catalog-title">组件目录</div>
          <button
            v-for="group in filteredComponentGroups"
            :key="group.key"
            type="button"
            class="component-guide__catalog-link"
            :class="{ 'is-active': activeGroupKey === group.key }"
            :aria-current="activeGroupKey === group.key ? 'location' : undefined"
            @click="scrollToGroup(group.key)"
          >
            <span>{{ group.title }}</span>
            <em>{{ group.items.length }}</em>
          </button>
        </aside>

        <main class="component-guide__content">
          <section
            v-for="group in filteredComponentGroups"
            :id="`component-group-${group.key}`"
            :key="group.key"
            class="component-guide__section"
          >
            <header class="component-guide__section-header">
              <div>
                <p>{{ group.key }}</p>
                <h2>{{ group.title }}</h2>
                <span>{{ group.description }}</span>
              </div>
              <strong>{{ group.items.length }} Components</strong>
            </header>

            <div class="component-guide__component-index" aria-label="组件索引">
              <strong>组件索引</strong>
              <div>
                <a
                  v-for="item in group.items"
                  :key="item.name"
                  :href="`#component-${item.name}`"
                >
                  {{ item.name }}
                </a>
              </div>
            </div>

            <div class="component-guide__block">
              <div class="component-guide__block-header">
                <h3>示例预览</h3>
                <span>Live Demo</span>
              </div>
              <div class="component-guide__demo">
                <template v-if="group.key === 'layout'">
                  <PageContainer
                    title="页面标题"
                    description="页面描述和右侧操作区示例。"
                  >
                    <template #actions>
                      <PermissionButton>刷新</PermissionButton>
                      <PermissionButton type="primary" :icon="CirclePlus">
                        新增
                      </PermissionButton>
                    </template>
                    <div class="component-guide__placeholder">
                      页面主体内容区域
                    </div>
                  </PageContainer>
                  <div class="component-guide__grid">
                    <div class="component-guide__sample">
                      <h4>默认尺寸：页面模块</h4>
                      <BaseSectionTitle title="时间进度看板" />
                    </div>
                    <div class="component-guide__sample">
                      <h4>小尺寸：弹框内小节</h4>
                      <BaseSectionTitle
                        title="评审内容"
                        size="small"
                        heading-tag="h3"
                      />
                    </div>
                  </div>
                </template>

                <template v-else-if="group.key === 'query-table'">
                  <SchemaSearchForm
                    v-model="schemaSearchModel"
                    :fields="schemaSearchFields"
                  />
                  <BaseSearchForm>
                    <el-form inline>
                      <el-form-item label="用户名">
                        <el-input
                          model-value="admin"
                          placeholder="请输入用户名"
                        />
                      </el-form-item>
                      <el-form-item label="启用状态">
                        <el-select
                          model-value="ENABLED"
                          placeholder="请选择启用状态"
                        >
                          <el-option label="启用" value="ENABLED" />
                          <el-option label="停用" value="DISABLED" />
                        </el-select>
                      </el-form-item>
                    </el-form>
                  </BaseSearchForm>
                  <BaseToolbar>
                    <PermissionButton type="primary">新增用户</PermissionButton>
                    <PermissionButton :icon="Download">批量导出</PermissionButton>
                    <template #extra>
                      <BaseColumnSettings
                        v-model="visibleColumns"
                        :columns="columnOptions"
                      />
                    </template>
                  </BaseToolbar>
                  <BaseBatchActionBar :selected-count="2">
                    <PermissionButton type="danger">批量停用</PermissionButton>
                  </BaseBatchActionBar>
                  <BaseDataTable :data="demoRows">
                    <el-table-column
                      v-if="visibleColumns.includes('username')"
                      prop="username"
                      label="用户名"
                      min-width="120"
                    />
                    <el-table-column
                      v-if="visibleColumns.includes('displayName')"
                      prop="displayName"
                      label="显示名称"
                      min-width="140"
                    />
                    <el-table-column
                      v-if="visibleColumns.includes('status')"
                      label="业务状态"
                      width="100"
                    >
                      <template #default="{ row }">
                        <BaseStatusTag :status="row.status" />
                      </template>
                    </el-table-column>
                  </BaseDataTable>
                  <BasePagination :page-no="1" :page-size="10" :total="2" />
                  <p class="component-guide__sample-note">
                    示例：分页固定在屏幕下方，时时能看到：
                    <code>&lt;BasePagination fixed /&gt;</code>
                    ，内容末尾配合
                    <code>bq-fixed-pagination-spacer</code>
                    防遮挡。
                  </p>
                  <QueryTable :func="queryDemoRows" empty-title="暂无用户">
                    <template #search>
                      <el-form inline>
                        <el-form-item label="用户名">
                          <el-input
                            model-value="admin"
                            placeholder="请输入用户名"
                          />
                        </el-form-item>
                      </el-form>
                    </template>
                    <template #toolbar>
                      <PermissionButton type="primary">新增用户</PermissionButton>
                    </template>
                    <el-table-column
                      prop="username"
                      label="用户名"
                      min-width="120"
                    />
                    <el-table-column
                      prop="displayName"
                      label="显示名称"
                      min-width="140"
                    />
                    <el-table-column label="业务状态" width="100">
                      <template #default="{ row }">
                        <BaseStatusTag :status="row.status" />
                      </template>
                    </el-table-column>
                  </QueryTable>
                </template>

                <template v-else-if="group.key === 'tree-pane'">
                  <BaseSplitPane>
                    <template #side>
                      <BaseTreePanel
                        title="部门树"
                        :data="treeOptions"
                        :current-key="selectedDeptId ?? undefined"
                      >
                        <template #filters>
                          <el-input placeholder="搜索部门" clearable />
                        </template>
                      </BaseTreePanel>
                    </template>
                    <div class="component-guide__sample">
                      <h4>树形选择</h4>
                      <BaseTreeSelect
                        v-model="selectedDeptId"
                        :data="treeOptions"
                      />
                      <p>当前选择：{{ selectedDeptId ?? "--" }}</p>
                    </div>
                  </BaseSplitPane>
                </template>

                <template v-else-if="group.key === 'form-dialog'">
                  <div class="component-guide__grid">
                    <div class="component-guide__sample">
                      <h4>枚举选择</h4>
                      <BaseSelect
                        v-model="selectedStatus"
                        :options="statusOptions"
                      />
                      <BaseDictSelect
                        v-model="selectedDict"
                        dict-type="platform_status"
                        :options="statusOptions"
                      />
                      <BaseRadioGroup
                        v-model="selectedDataScope"
                        :options="dataScopeOptions"
                        button
                      />
                      <BaseCheckboxGroup
                        v-model="selectedFlags"
                        :options="flagOptions"
                      />
                    </div>
                    <div
                      class="component-guide__sample component-guide__sample--wide"
                    >
                      <h4>Schema 表单</h4>
                      <SchemaForm
                        v-model="schemaFormModel"
                        :fields="schemaFormFields"
                        :columns="2"
                      />
                    </div>
                  </div>
                  <div class="component-guide__actions">
                    <PermissionButton type="primary" @click="dialogVisible = true">
                      打开表单弹窗
                    </PermissionButton>
                    <PermissionButton
                      type="primary"
                      plain
                      @click="schemaDialogVisible = true"
                    >
                      打开 Schema 弹窗
                    </PermissionButton>
                    <PermissionButton @click="drawerVisible = true">
                      打开详情抽屉
                    </PermissionButton>
                    <PermissionButton type="danger" @click="confirmVisible = true">
                      打开删除确认框
                    </PermissionButton>
                    <PermissionButton @click="advancedFilterVisible = true">
                      打开高级筛选
                    </PermissionButton>
                  </div>
                </template>

                <template v-else-if="group.key === 'display'">
                  <BaseFilterTags :filters="filterTags" />
                  <div class="component-guide__grid">
                    <div class="component-guide__sample">
                      <h4>金额 / 比例 / 时间</h4>
                      <p>金额：<BaseMoney :value="-12500.5" /></p>
                      <p>
                        比例：<BasePercent :numerator="35" :denominator="80" />
                      </p>
                      <p>时间：<BaseDateTime value="2026-06-20T10:30:00" /></p>
                      <p>
                        字典：
                        <DictTag value="ENABLED" :options="statusTagOptions" />
                      </p>
                      <p>复制：<BaseCopyableText value="trace-demo-001" /></p>
                      <p>
                        长文本：
                        <BaseOverflowText
                          value="这是一段需要省略展示的企业后台长文本内容"
                        />
                      </p>
                    </div>
                    <div class="component-guide__sample">
                      <h4>空态</h4>
                      <BaseEmpty
                        title="暂无查询结果"
                        description="请调整筛选条件后重试。"
                      />
                    </div>
                    <div
                      class="component-guide__sample component-guide__sample--wide"
                    >
                      <h4>错误提示</h4>
                      <TraceErrorAlert
                        code="COMMON-SYSTEM-001"
                        message="系统异常，请稍后重试。"
                        trace-id="trace-demo-001"
                      />
                    </div>
                    <div
                      class="component-guide__sample component-guide__sample--wide"
                    >
                      <h4>Schema 详情</h4>
                      <SchemaDescriptions
                        :data="schemaDescriptionData"
                        :items="schemaDescriptionItems"
                      />
                    </div>
                  </div>
                </template>

                <template v-else-if="group.key === 'file-task'">
                  <div class="component-guide__grid">
                    <div class="component-guide__sample">
                      <h4>上传 / 导入 / 导出</h4>
                      <BaseUpload accept=".xlsx,.csv" />
                      <div class="component-guide__inline">
                        <PermissionButton
                          :icon="Upload"
                          @click="importVisible = true"
                        >
                          打开导入弹窗
                        </PermissionButton>
                        <BaseExportButton />
                      </div>
                    </div>
                    <div class="component-guide__sample">
                      <h4>任务时间线 / 审计信息</h4>
                      <BaseTimeline :items="timelineItems" />
                      <BaseAuditInfo
                        created-by="admin"
                        created-at="2026-06-20T10:00:00"
                        updated-by="admin"
                        updated-at="2026-06-20T10:05:00"
                      />
                    </div>
                  </div>
                </template>

                <template v-else-if="group.key === 'container'">
                  <BasePageTabs v-model="activeTab" :tabs="pageTabs" />
                  <BaseEditableTable :data="demoRows">
                    <el-table-column
                      prop="username"
                      label="用户名"
                      min-width="120"
                    />
                    <el-table-column
                      prop="displayName"
                      label="显示名称"
                      min-width="140"
                    />
                  </BaseEditableTable>
                </template>

                <template v-else-if="group.key === 'status-permission'">
                  <div class="component-guide__grid">
                    <div class="component-guide__sample">
                      <h4>状态</h4>
                      <div class="component-guide__inline">
                        <BaseStatusTag status="ENABLED" />
                        <BaseStatusTag status="DISABLED" />
                        <BaseStatusTag status="WARNING" />
                      </div>
                      <div class="component-guide__inline">
                        <BaseStatusSwitch v-model="enabled" />
                        <ConfirmStatusSwitch
                          v-model="enabled"
                          :confirm="false"
                          success-message=""
                        />
                      </div>
                    </div>
                    <div class="component-guide__sample">
                      <h4>权限按钮</h4>
                      <div class="component-guide__inline">
                        <PermissionButton type="primary">
                          无需权限
                        </PermissionButton>
                        <PermissionButton
                          permission="component:demo:missing"
                          disabled-reason="示例权限未授予"
                        >
                          受控按钮
                        </PermissionButton>
                      </div>
                    </div>
                    <div
                      class="component-guide__sample component-guide__sample--wide"
                    >
                      <h4>权限容器 / 敏感字段</h4>
                      <PermissionGuard
                        mode="placeholder"
                        permission="component:demo:missing"
                      >
                        <span>有权限内容</span>
                      </PermissionGuard>
                      <div class="component-guide__inline">
                        <SecureField value="供应商A" permission="READABLE" />
                        <SecureField
                          value="13800000000"
                          permission="MASKED"
                          masked-value="138****0000"
                        />
                        <SecureField value="机密字段" permission="UNREADABLE" />
                      </div>
                    </div>
                    <div
                      class="component-guide__sample component-guide__sample--wide"
                    >
                      <h4>自定义表格 / 单元格权限</h4>
                      <PermissionSchemaTable
                        :actions="permissionActions"
                        :columns="permissionColumns"
                        :data="permissionRows"
                      />
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <div class="component-guide__block">
              <div class="component-guide__block-header">
                <h3>API 摘要</h3>
                <span>Props / Events</span>
              </div>
              <div class="component-guide__doc-list">
                <article
                  v-for="item in group.items"
                  :id="`component-${item.name}`"
                  :key="item.name"
                  class="component-guide__doc-item"
                >
                  <div class="component-guide__doc-title">
                    <h4>{{ item.name }}</h4>
                    <span>Stable</span>
                  </div>
                  <table class="component-guide__api-table">
                    <tbody>
                      <tr>
                        <th>场景</th>
                        <td>{{ item.scene }}</td>
                      </tr>
                      <tr>
                        <th>Props</th>
                        <td>{{ item.props }}</td>
                      </tr>
                      <tr>
                        <th>Events</th>
                        <td>{{ item.events }}</td>
                      </tr>
                      <tr v-if="item.usage">
                        <th>使用说明</th>
                        <td>{{ item.usage }}</td>
                      </tr>
                      <tr>
                        <th>Source</th>
                        <td>
                          <code>{{ getComponentSource(item.name) }}</code>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </article>
              </div>
            </div>
          </section>

          <BaseEmpty
            v-if="filteredComponentGroups.length === 0"
            title="未找到匹配组件"
            description="请调整组件名、场景或 Props 关键词后重试。"
          />
        </main>
      </div>

      <BaseFormDialog
        v-model="dialogVisible"
        title="编辑用户"
        body-max-height="62vh"
      >
        <el-form label-position="top">
          <el-form-item label="用户名">
            <el-input v-model="form.username" clearable />
          </el-form-item>
          <el-form-item label="显示名称">
            <el-input v-model="form.displayName" clearable />
          </el-form-item>
        </el-form>
      </BaseFormDialog>
      <BaseDrawer v-model="drawerVisible" title="用户详情">
        <BaseDetailDescriptions :items="detailItems">
          <template #status>
            <BaseStatusTag :status="enabled ? 'ENABLED' : 'DISABLED'" />
          </template>
        </BaseDetailDescriptions>
      </BaseDrawer>
      <SchemaFormDialog
        v-model="schemaDialogVisible"
        v-model:form-model="schemaFormModel"
        title="Schema 编辑用户"
        :fields="schemaFormFields"
      />
      <BaseConfirm
        v-model="confirmVisible"
        title="删除"
        message="确定要删除 xxxxxx 项目吗"
        type="danger"
        width="500px"
      />
      <BaseAdvancedFilterDrawer v-model="advancedFilterVisible">
        <el-form label-position="top">
          <el-form-item label="业务状态">
            <BaseSelect v-model="selectedStatus" :options="statusOptions" clearable />
          </el-form-item>
        </el-form>
      </BaseAdvancedFilterDrawer>
      <BaseImportDialog v-model="importVisible" />
    </div>
  </PageContainer>
</template>

<style scoped>
.component-guide {
  display: grid;
  gap: var(--bq-space-section);
}

.component-guide__overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: stretch;
  padding: 20px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-page);
  background:
    linear-gradient(
      90deg,
      var(--bq-color-primary-soft),
      var(--bq-color-surface)
    ),
    var(--bq-color-surface);
}

.component-guide__overview-main {
  display: grid;
  gap: 8px;
  align-content: center;
}

.component-guide__overview-side {
  display: grid;
  gap: 10px;
  min-width: 340px;
}

.component-guide__eyebrow {
  margin: 0;
  color: var(--bq-color-primary);
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
  text-transform: uppercase;
}

.component-guide__overview h2 {
  margin: 0;
  color: var(--bq-color-text);
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
}

.component-guide__overview p {
  max-width: 720px;
  margin: 0;
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 22px;
}

.component-guide__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(92px, 1fr));
  gap: 10px;
  min-width: 340px;
}

.component-guide__stat {
  display: grid;
  gap: 6px;
  align-content: center;
  min-height: 88px;
  padding: 14px;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  background: rgba(255, 255, 255, 0.86);
}

.component-guide__stat strong {
  color: var(--bq-color-text);
  font-size: 24px;
  line-height: 28px;
}

.component-guide__stat span {
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.component-guide__search {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  background: rgba(255, 255, 255, 0.86);
}

.component-guide__search span {
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}

.component-guide__principles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-border);
}

.component-guide__principles div {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px 16px;
  background: var(--bq-color-surface);
}

.component-guide__principles strong {
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
}

.component-guide__principles span {
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 20px;
}

.component-guide__quickstart {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 180px;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-border);
}

.component-guide__quickstart div {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 12px 14px;
  background: var(--bq-color-bg-muted);
}

.component-guide__quickstart strong {
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
}

.component-guide__quickstart span,
.component-guide__quickstart code {
  overflow: hidden;
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.component-guide__quickstart code {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
}

.component-guide__body {
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr);
  gap: var(--bq-space-section);
  align-items: start;
}

.component-guide__catalog {
  position: sticky;
  top: calc(var(--bq-header-height) + var(--bq-tags-height) + 18px);
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-surface);
}

.component-guide__catalog-title {
  padding: 0 8px 8px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
}

.component-guide__catalog-link {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 34px;
  padding: 0 8px;
  border-radius: var(--bq-radius-control);
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  font-family: inherit;
  line-height: 20px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  appearance: none;
  border: 0;
}

.component-guide__catalog-link:hover,
.component-guide__catalog-link:focus,
.component-guide__catalog-link.is-active {
  background: var(--bq-color-bg-muted);
  color: var(--bq-color-primary);
}

.component-guide__catalog-link.is-active {
  box-shadow: inset 3px 0 0 var(--bq-color-primary);
  font-weight: 600;
}

.component-guide__catalog-link.is-active em {
  color: var(--bq-color-primary);
}

.component-guide__catalog-link em {
  min-width: 22px;
  color: var(--bq-color-text-secondary);
  font-style: normal;
  text-align: right;
}

.component-guide__content {
  display: grid;
  gap: var(--bq-space-section);
  min-width: 0;
}

.component-guide__section {
  display: grid;
  gap: var(--bq-space-section);
  min-width: 0;
  scroll-margin-top: calc(
    var(--bq-header-height) + var(--bq-tags-height) + 18px
  );
  padding: 16px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-surface);
}

.component-guide__section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--bq-color-border-subtle);
}

.component-guide__section-header div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.component-guide__section-header p {
  margin: 0;
  color: var(--bq-color-primary);
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
  text-transform: uppercase;
}

.component-guide__section-header h2 {
  margin: 0;
  color: var(--bq-color-text);
  font-size: 18px;
  line-height: 26px;
  font-weight: 600;
}

.component-guide__section-header span {
  color: var(--bq-color-text-secondary);
  font-size: 14px;
  line-height: 20px;
}

.component-guide__section-header > strong {
  flex: 0 0 auto;
  padding: 5px 8px;
  border: 1px solid var(--bq-color-primary-soft);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-primary-soft);
  color: var(--bq-color-primary);
  font-size: 12px;
  line-height: 18px;
}

.component-guide__component-index {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--bq-color-border-subtle);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-bg-muted);
}

.component-guide__component-index strong {
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
}

.component-guide__component-index div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.component-guide__component-index a {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-bg-muted);
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
  text-decoration: none;
}

.component-guide__component-index a:hover,
.component-guide__component-index a:focus {
  border-color: var(--bq-color-primary);
  color: var(--bq-color-primary);
}

.component-guide__block {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.component-guide__block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.component-guide__block-header h3 {
  margin: 0;
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}

.component-guide__block-header span {
  color: var(--bq-color-text-secondary);
  font-size: 12px;
  line-height: 18px;
}

.component-guide__demo {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-bg-muted);
}

.component-guide__placeholder {
  padding: 18px;
  background: var(--bq-color-bg-muted);
  border: 1px dashed var(--bq-color-border);
  border-radius: var(--bq-radius-control);
  color: var(--bq-color-text-secondary);
}

.component-guide__actions,
.component-guide__inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.component-guide__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--bq-space-section);
  align-items: start;
}

.component-guide__sample {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-surface);
}

.component-guide__sample--wide {
  grid-column: 1 / -1;
}

.component-guide__sample h4 {
  margin: 0;
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}

.component-guide__sample p {
  margin: 8px 0;
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 22px;
}

.component-guide__sample-note {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 2px;
  background: var(--bq-color-danger);
  color: var(--bq-color-on-primary) !important;
  font-size: 12px !important;
  line-height: 18px !important;
}

.component-guide__sample-note code {
  color: inherit;
}

.component-guide__doc-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.component-guide__doc-item {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--bq-color-border);
  border-radius: var(--bq-radius-page);
  background: var(--bq-color-surface);
}

.component-guide__doc-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.component-guide__doc-title h4 {
  margin: 0;
  color: var(--bq-color-text);
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
}

.component-guide__doc-title span {
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, var(--bq-color-success), white 72%);
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-success-soft);
  color: var(--bq-color-success);
  font-size: 12px;
  line-height: 16px;
}

.component-guide__api-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  border-top: 1px solid var(--bq-color-border-subtle);
}

.component-guide__api-table th,
.component-guide__api-table td {
  padding: 8px 0;
  border-bottom: 1px solid var(--bq-color-border-subtle);
  vertical-align: top;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
}

.component-guide__api-table th {
  width: 68px;
  color: var(--bq-color-text);
  font-weight: 600;
}

.component-guide__api-table td {
  min-width: 0;
  color: var(--bq-color-text-secondary);
  white-space: pre-line;
  word-break: break-word;
}

.component-guide__api-table code {
  color: var(--bq-color-text);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 12px;
}

@media (max-width: 960px) {
  .component-guide__overview,
  .component-guide__body,
  .component-guide__principles,
  .component-guide__quickstart {
    grid-template-columns: 1fr;
  }

  .component-guide__overview-side,
  .component-guide__stats {
    min-width: 0;
  }

  .component-guide__catalog {
    position: static;
  }

  .component-guide__grid,
  .component-guide__doc-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .component-guide__overview,
  .component-guide__section {
    padding: 14px;
  }

  .component-guide__stats {
    grid-template-columns: 1fr;
  }

  .component-guide__quickstart span,
  .component-guide__quickstart code {
    white-space: normal;
  }

  .component-guide__section-header {
    display: grid;
  }
}
</style>
