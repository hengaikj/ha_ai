<template>
  <PageContainer title="当前项目列表" class="rv-project-list-page">
    <!-- ========== 搜索/筛选 ========== -->
    <el-form :model="queryForm" class="rv-search-form" inline @submit.prevent>
      <el-form-item label="项目名称">
        <el-input
          v-model="queryForm.keyword"
          placeholder="请输入项目名称"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="项目阀点">
        <el-input
          v-model="queryForm.valvePoint"
          placeholder="请输入项目阀点"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="当前节点">
        <el-select
          v-model="queryForm.currentNode"
          placeholder="请选择节点"
          clearable
          style="width: 160px"
        >
          <el-option
            v-for="item in currentNodeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <template v-if="showAdvanced">
        <el-form-item v-if="canFilterStage" label="阶段">
          <el-select
            v-model="queryForm.stage"
            placeholder="全部阶段"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="s in stageOptions"
              :key="s.code"
              :label="s.label"
              :value="s.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="canFilterNodeStatus" label="状态">
          <el-select
            v-model="queryForm.nodeStatus"
            placeholder="全部状态"
            clearable
            style="width: 140px"
          >
            <el-option
              v-for="n in nodeStatusOptions"
              :key="n.value"
              :label="n.label"
              :value="n.value"
            />
          </el-select>
        </el-form-item>
      </template>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button link type="primary" @click="toggleAdvanced">
          {{ showAdvanced ? "收起" : "展开" }}
        </el-button>
      </el-form-item>
    </el-form>

    <!-- ========== 工具栏（对齐品牌公司会议 BaseToolbar：左侧主操作，刷新最右侧，上下分隔线） ========== -->
    <BaseToolbar @refresh="handleSearch">
      <el-button
        v-if="canShowCreateFlowButton"
        type="primary"
        :icon="Plus"
        @click="handleCreateFlow"
      >
        启动阀点
      </el-button>
    </BaseToolbar>

    <!-- ========== 表格区（对齐菜单管理：撑满右侧面板，滚动条在表格底部） ========== -->
    <div v-loading="loading" class="rv-table-section">
      <div ref="tableWrapRef" class="rv-table-wrap">
        <!--
          对齐菜单管理 / 品牌公司会议：
          - width 100% 适应右侧面板；height 撑满可视区，横/纵滚动条落在表格底部
          - 操作列 fixed="right" 横向滚动时悬浮在其他列之上
        -->
        <el-table
          :data="tableRows"
          :height="tableHeight"
          :row-class-name="tableRowClassName"
          :default-sort="{ prop: 'createdAt', order: 'descending' }"
          style="width: 100%"
          row-key="id"
        >
          <el-table-column label="项目名称" min-width="180" header-align="center" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="rv-cell-link" @click="openDetail(row)">{{ row.projectName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="项目编号" min-width="140" header-align="center" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="rv-cell-link" @click="openDetail(row)">{{ row.projectNo }}</span>
            </template>
          </el-table-column>
          <el-table-column label="项目阀点" min-width="100" align="center" header-align="center">
            <template #default="{ row }">
              {{ resolveValveDisplay(row) }}
            </template>
          </el-table-column>
          <el-table-column label="当前节点" min-width="110" align="center" header-align="center">
            <template #default="{ row }">
              <el-tag
                type="info"
                :class="['rv-stage-tag', getNodeTagClass(row)]"
                size="small"
                effect="light"
              >
                {{ row.stageCode || row.stage || row.node || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="节点状态" min-width="100" align="center" header-align="center">
            <template #default="{ row }">
              <span class="rv-cell-status" :class="getNodeStatusClass(row)">{{ getNodeStatusText(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="流程状态" min-width="100" align="center" header-align="center">
            <template #default="{ row }">
              <span style="color:red">{{ row.lockStatusName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="使用模版" min-width="200" header-align="center" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="rv-cell-status" :class="getNodeStatusClass(row)">{{ row.templateName }}</span>
            </template>
          </el-table-column>
          <!-- 操作列：右侧固定悬浮 + 内容左对齐（对齐菜单管理） -->
          <el-table-column
            label="操作"
            width="152"
            fixed="right"
            align="left"
            header-align="center"
            class-name="rv-ops-col"
            label-class-name="rv-ops-col"
          >
            <template #default="{ row }">
              <div class="bq-table-actions rv-action-col">
                <template v-if="canShowStageFlowActionColumn && isStageFlowEntry(row)">
                  <el-button
                    v-for="action in resolveProjectFlowRowActions(row)"
                    :key="'fa_' + row.id + '_' + action.key"
                    link type="primary" size="small"
                    @click="handleAction(row, action)"
                  >
                    {{ action.label }}
                  </el-button>
                </template>
                <template v-else-if="canShowFlowOperationColumn">
                  <el-button
                    v-for="action in isInlineListAction(row)"
                    :key="resolveInlineActionKey(row, action.key)"
                    link type="primary" size="small"
                    @click="handleInlineListAction(row, action)"
                  >
                    {{ resolveInlineActionLabel(action) }}
                  </el-button>
                </template>
                <!-- 对齐 Vue2：项目列表入口 + 管理员 + S2~S8 普通流程可回退 -->
                <el-button
                  v-if="canRollbackFlow(row)"
                  link
                  type="warning"
                  size="small"
                  @click.stop="handleRollbackFlow(row)"
                >
                  回退
                </el-button>
                <template v-if="isProjectFlowEntry || (isStageFlowEntry(row) && canVoidFlow(row) && isSystemAdmin)">
                  <el-popconfirm
                    v-if="canVoidFlow(row) && (hasProjectListVoidPermission || isSystemAdmin)"
                    :title="`确认作废项目「${resolveProjectDisplayName(row)}」吗？`"
                    confirm-button-text="确认"
                    cancel-button-text="取消"
                    @confirm="handleVoidFlow(row)"
                  >
                    <template #reference>
                      <el-button link type="danger" size="small">作废</el-button>
                    </template>
                  </el-popconfirm>
                </template>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <BasePagination
        :page-no="queryForm.pageNum"
        :page-size="queryForm.pageSize"
        :total="queryForm.total"
        :page-sizes="[10, 20, 50, 100]"
        @page-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </PageContainer>

  <div v-if="projectListAccessDenied" class="rv-forbidden">
    <el-empty description="你当前没有权限查看「收益管理 - 流程管理」页面，请联系管理员或切换账号。" />
  </div>
  <BaseConfirm
  v-model="confirmState.visible"
  :title="confirmState.title"
  :message="confirmState.message"
  :type="confirmState.type"
  :confirm-text="confirmState.confirmText"
  :cancel-text="confirmState.cancelText"
  :loading="confirmState.loading"
  @confirm="resolveConfirm"
  @cancel="rejectConfirm"
/>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import BaseToolbar from "@/components/base/BaseToolbar.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import BasePagination from "@/components/base/BasePagination.vue";
import {
  FLOW_STAGE_ORDER,
  STAGE_MAP,
  NODE_STATUS_MAP as NODE_STATUS_CONFIG,
  NODE_STATUS_LABEL_MAP,
  resolveNodeStatusText,
  resolveStageTagClass,
  resolveStageName,
} from "../constants";
import {
  isStageFlowEntry,
} from "../flow-identity";
import { resolveCurrentUserContext } from "../context";
import {
  resolveProjectFlowRowActions,
} from "../stage-actions";
import { resolveProjectListStageDetailMenuKey, resolveProjectListStageDetailTarget } from "./stage-detail-target";
import { AUDIT_DOMAIN } from "@/pages/revenue/subtable-workbench/domain-config";
import { queryRevenueProjectPage } from "@/api/revenue/flow";
import {
  rollbackRevenueProjectFlowCurrentNode,
  voidRevenueProjectFlow,
} from "@/pages/revenue/project-list/service";
import { hasPermi } from "@/utils/hasPermi";
import {
  REVENUE_PERMISSIONS,
  resolveFlowStageActionPermission,
  resolveFlowStageDefaultAction,
  hasFlowStageActionPermission,
} from "@/utils/revenue-permissions";
import { useAuthStore } from "@/stores/auth";


const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

// ========== 常量 ==========
const NODE_STATUS_OPTIONS = [
  { label: "全部", value: "" },
  {
    label: NODE_STATUS_LABEL_MAP[NODE_STATUS_CONFIG.IN_PROGRESS],
    value: NODE_STATUS_CONFIG.IN_PROGRESS,
  },
  {
    label: NODE_STATUS_LABEL_MAP[NODE_STATUS_CONFIG.FINISHED],
    value: NODE_STATUS_CONFIG.FINISHED,
  },
  {
    label: NODE_STATUS_LABEL_MAP[NODE_STATUS_CONFIG.VOIDED],
    value: NODE_STATUS_CONFIG.VOIDED,
  },
];

const props = defineProps({
  pageTitle: { type: String, default: "当前项目列表" },
  pageSubtitle: { type: String, default: "" },
  menuKey: { type: String, default: "project_list" },
  defaultStage: { type: String, default: "" },
  defaultNodeStatus: { type: String, default: "" },
});

// ========== 响应式状态 ==========
const tableRows = ref<any[]>([]);
const loading = ref(false);
const showAdvanced = ref(false);
const stageOptions = ref<{ code: string; label: string }[]>([]);
/** 表格容器：用于计算撑满可视区高度，使滚动条落在表格底部 */
const tableWrapRef = ref<HTMLElement | null>(null);
const tableHeight = ref<number | undefined>(undefined);
const TABLE_FIT_MIN_HEIGHT = 280;
let tableResizeObserver: ResizeObserver | null = null;
// 解构出所需的所有内容
const { confirmState, openConfirm, resolveConfirm, rejectConfirm } = useBaseConfirmDialog();
const queryForm = reactive({
  keyword: "",
  valvePoint: "",
  currentNode: "",
  stage: "",
  nodeStatus: "",
  pageNum: 1,
  pageSize: 20,
  total: 0,
});

const currentNodeOptions = computed(() =>
  stageOptions.value.map((s) => ({ label: s.label, value: s.code }))
);

/** 对齐菜单管理 QueryTable.fit-table-height：表格高度 = 视口底到表格顶，分页在表格外 */
function syncTableHeight() {
  const wrap = tableWrapRef.value;
  if (!wrap || typeof window === "undefined") return;
  const tableTop = wrap.getBoundingClientRect().top;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  if (!viewportHeight || tableTop <= 0) return;

  const section = wrap.parentElement;
  const paginationEl = section?.querySelector(".base-pagination") as HTMLElement | null;
  const paginationHeight = paginationEl?.getBoundingClientRect().height ?? 52;
  const sectionGap = 12;
  const pageBottomGap = 16;
  const nextHeight = Math.floor(
    viewportHeight - tableTop - paginationHeight - sectionGap - pageBottomGap,
  );
  tableHeight.value = Math.max(TABLE_FIT_MIN_HEIGHT, nextHeight);
}

function scheduleSyncTableHeight() {
  void nextTick(() => {
    syncTableHeight();
  });
}

// ========== 生命周期 ==========
onMounted(() => {
  // 对齐 Vue2：项目流程列表固定提供 S1-S8 节点筛选
  stageOptions.value = FLOW_STAGE_ORDER.map((code) => ({
    code,
    label: STAGE_MAP[code]?.label || code,
  }));
  const stageFromRoute = (route.query.stage as string) || "";
  const statusFromRoute = (route.query.nodeStatus as string) || "";
  if (stageFromRoute) queryForm.stage = stageFromRoute;
  if (statusFromRoute) queryForm.nodeStatus = statusFromRoute;
  if (props.defaultStage) queryForm.stage = props.defaultStage;
  if (props.defaultNodeStatus) queryForm.nodeStatus = props.defaultNodeStatus;
  registerDetailRoutes();
  loadPageData();
  scheduleSyncTableHeight();
  window.addEventListener("resize", scheduleSyncTableHeight);
  void nextTick(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observeTarget = tableWrapRef.value?.parentElement || tableWrapRef.value;
    if (!observeTarget) return;
    tableResizeObserver = new ResizeObserver(() => scheduleSyncTableHeight());
    tableResizeObserver.observe(observeTarget);
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", scheduleSyncTableHeight);
  tableResizeObserver?.disconnect();
  tableResizeObserver = null;
});

// ========== 权限 ==========
const _currentUserContext = computed(() => resolveCurrentUserContext(authStore));

const currentPermissions = computed(() => authStore.permissions || []);

// 对齐 Vue2：分别校验 project-list:show / add / void（不再误用 project:update/flow）
const hasProjectListShowPermission = computed(() =>
  hasPermi(REVENUE_PERMISSIONS.PROJECT_LIST_SHOW)
);

const hasProjectListAddPermission = computed(() =>
  hasPermi(REVENUE_PERMISSIONS.PROJECT_LIST_ADD)
);

const hasProjectListVoidPermission = computed(() =>
  hasPermi(REVENUE_PERMISSIONS.PROJECT_LIST_VOID)
);

const projectListAccessDenied = computed(() => {
  if (isDataCheckEntry.value) return false;
  return !hasProjectListShowPermission.value;
});

const canCreateFlow = computed(() => hasProjectListAddPermission.value || false);
const canShowCreateFlowButton = computed(
  () => isProjectFlowEntry.value && canCreateFlow.value,
);
const _canShowVoidOperationColumn = computed(() => hasProjectListVoidPermission.value || true);
const canShowFlowOperationColumn = computed(
  () => isProjectFlowEntry.value && (hasProjectListVoidPermission.value || isSystemAdmin.value),
);
const canShowStageFlowActionColumn = computed(
  () => !isProjectFlowEntry.value,
);
const canFilterStage = computed(() => true);
const canFilterNodeStatus = computed(() => true);
// 对齐 Vue2：系统管理员 = *:*:* / 超管角色
const isSystemAdmin = computed(
  () => authStore.isSuperAdmin || hasPermi(["*:*:*", "system:admin"]),
);
// 对齐 Vue2：项目列表入口（menuKey === project_list）才展示回退/作废操作列
const isProjectFlowEntry = computed(() => String(props.menuKey || "").trim() === "project_list");
const isDataCheckEntry = computed(() => String(props.menuKey || "").trim() === "data_check");
const currentUserId = computed(() => authStore.currentUser?.id || "");
const _currentUserName = computed(() => (authStore.currentUser as any)?.name || authStore.currentUser?.displayName || "");

// ========== 页面展示计算属性 ==========
const nodeStatusOptions = computed(() => NODE_STATUS_OPTIONS);

const _hasFlowIndexPermission = computed(() => hasPermi("revenue:flow:index") || true);
const _hasFlowActionPermission = computed(() =>
  hasPermi("revenue:flow:action") || hasProjectListAddPermission.value
);

// ========== 工具函数 ==========
function getNodeTagClass(row: any): string {
  return resolveStageTagClass(row) || "";
}

function getNodeStatusText(row: any): string {
  return resolveNodeStatusText(row) || "-";
}

function getNodeStatusClass(row: any): string {
  const raw = row?.nodeStatus || "";
  return raw ? `rv-status-${raw.toLowerCase().replace(/_/g, '-')}` : "";
}

function isFinishedNodeStatus(row: any): boolean {
  return row?.nodeStatus === NODE_STATUS_CONFIG.FINISHED;
}

function isVoidedNodeStatus(row: any): boolean {
  return row?.nodeStatus === NODE_STATUS_CONFIG.VOIDED;
}

function canVoidFlow(row: any): boolean {
  return row?.nodeStatus && !isVoidedNodeStatus(row) && "1"!==row.lockStatus;
}

function isDetailEntryBlocked(row: any): boolean {
  return isVoidedNodeStatus(row);
}

function resolveDetailEntryBlockedTip(row: any): string {
  return isDetailEntryBlocked(row) ? "该流程已作废，无法查看详情" : "";
}

function tableRowClassName({ row }: any) {
  if (isVoidedNodeStatus(row)) return "rv-row-voided";
  if (isFinishedNodeStatus(row)) return "rv-row-finished";
  return "";
}

function resolveValveDisplay(row: any): string {
  return row?.valvePoint || row?.valve || "-";
}

function resolveProjectDisplayName(row: any): string {
  return row?.projectName || row?.projectNo || "-";
}

function resolveInlineActionLabel(action: any): string {
  return action?.label || action?.key || "";
}

function isInlineListAction(row: any): any[] {
  const actions = resolveProjectFlowRowActions(row);
  if (!actions || !actions.length) return [];
  return actions.filter((a: any) => a.key !== "void").slice(0, 1);
}

/** 对齐 Vue2：规范化流程/主键为纯数字字符串 */
function normalizeIntegerId(value: unknown): string {
  const text = String(value == null ? "" : value).trim();
  return /^\d+$/.test(text) ? text : "";
}

/** 对齐 Vue2：解析行阶段码 */
function resolveStageCode(row: any): string {
  const raw = String(row?.stageCode || row?.stage || row?.node || "S1")
    .trim()
    .toUpperCase();
  return /^S[1-8]$/.test(raw) ? raw : "S1";
}

function displayStageText(value: unknown): string {
  const code = String(value || "").trim().toUpperCase();
  return resolveStageName(code) || code || "-";
}

/** 对齐 Vue2：仅 NORMAL 流程可回退（列表已按 NORMAL 过滤，缺省按 NORMAL） */
function isNormalFlowType(row: any): boolean {
  const flowType = String((row && row.flowType) || "NORMAL")
    .trim()
    .toUpperCase();
  return flowType === "NORMAL";
}

/** 对齐 Vue2：项目列表 + 管理员 + S2~S8 + NORMAL 可回退 */
function canRollbackFlow(row: any): boolean {
  const flowId = normalizeIntegerId(row && (row.flowId || row.id));
  const stageCode = resolveStageCode(row);
  return Boolean(
    isProjectFlowEntry.value &&
      isSystemAdmin.value &&
      flowId && "1"!==row.lockStatus &&
      isNormalFlowType(row) &&
      ["S2", "S3", "S4", "S5", "S6", "S7", "S8"].includes(stageCode),
  );
}

// ========== 操作方法 ==========
function confirmStageFlowSubmit(row: any, action: any): Promise<void> {
  return openConfirm({
    title: "操作确认",
    message: `确认对「${resolveProjectDisplayName(row)}」执行「${action.label}」操作吗？`,
    type: "warning",
  });
}

function handleReset() {
  queryForm.keyword = "";
  queryForm.valvePoint = "";
  queryForm.currentNode = "";
  queryForm.stage = "";
  queryForm.nodeStatus = "";
  queryForm.pageNum = 1;
  loadPageData();
}

function toggleAdvanced() {
  showAdvanced.value = !showAdvanced.value;
  scheduleSyncTableHeight();
}

function handleSearch() {
  queryForm.pageNum = 1;
  loadPageData();
}

function handlePageChange(page: number) {
  queryForm.pageNum = page;
  loadPageData();
}

function handleSizeChange(size: number) {
  queryForm.pageSize = size;
  queryForm.pageNum = 1;
  loadPageData();
}

function handleCreateFlow() {
  const valve = route.query.valve as string || "";
  const query: Record<string, string> = {};
  if (valve) query.valve = valve;
  router.push({ name: "RevenueProjectFlowCreate", query });
}

function resolveListNodeStatusParam(nodeStatus: string): string {
  if (nodeStatus === NODE_STATUS_CONFIG.IN_PROGRESS) return NODE_STATUS_CONFIG.IN_PROGRESS;
  if (nodeStatus === NODE_STATUS_CONFIG.FINISHED) return NODE_STATUS_CONFIG.FINISHED;
  if (nodeStatus === NODE_STATUS_CONFIG.VOIDED) return NODE_STATUS_CONFIG.VOIDED;
  return "";
}

async function loadPageData() {
  if (!hasProjectListShowPermission.value) {
    tableRows.value = [];
    return;
  }
  loading.value = true;
  try {
    const stageParam = queryForm.currentNode || queryForm.stage || undefined;
    const res: any = await queryRevenueProjectPage({
      pageNum: queryForm.pageNum,
      pageSize: queryForm.pageSize,
      projectName: queryForm.keyword || undefined,
      valvePoint: queryForm.valvePoint || undefined,
      node: stageParam,
      nodeStatus: resolveListNodeStatusParam(queryForm.nodeStatus) || undefined,
    });
    const list = res?.data?.records || res?.data?.rows || res?.data || res?.records || res?.rows || [];
    const total = res?.data?.total ?? res?.total ?? 0;
    const rows = Array.isArray(list) ? list : [];
    // 对齐 Vue2 normalizeFlowRow：列表行主键是流程 ID，详情跳转依赖 flowId
    tableRows.value = rows.map((item: any) => {
      const flowId = item?.flowId ?? item?.id;
      return {
        ...item,
        id: flowId,
        flowId,
        // 列表接口按 NORMAL 过滤；行上未带回时补齐，保证回退按钮可见性对齐 Vue2
        flowType: item?.flowType || "NORMAL",
      };
    });
    queryForm.total = total;
    scheduleSyncTableHeight();
  } catch (err: any) {
    console.error("加载项目列表失败", err);
    BaseToast.error(err?.message || "加载失败，请稍后重试");
    tableRows.value = [];
  } finally {
    loading.value = false;
    scheduleSyncTableHeight();
  }
}

async function handleVoidFlow(row: any) {
  const flowId = normalizeIntegerId(row && (row.flowId || row.id));
  const targetNode = resolveStageCode(row);
  const operatorId = String(currentUserId.value || "").trim();
  const operatorName = String(_currentUserName.value || operatorId).trim();

  if (!flowId) {
    BaseToast.warning("缺少流程 ID，无法作废当前流程");
    return;
  }
  if (!operatorId) {
    BaseToast.warning("缺少当前登录用户，无法作废当前流程");
    return;
  }

  loading.value = true;
  try {
    const response = await voidRevenueProjectFlow({
      flowId,
      targetNode,
      operatorId,
      operatorName,
    });
    if (!response || !response.ok) {
      BaseToast.warning((response && response.message) || "作废失败");
      return;
    }
    BaseToast.success(response.message || "操作成功，已作废该流程");
    await loadPageData();
  } catch (err: any) {
    console.error("作废流程失败", err);
    BaseToast.error(err?.message || "作废失败，请稍后重试");
  } finally {
    loading.value = false;
  }
}

/** 对齐 Vue2：回退当前节点到上一阶段 */
async function handleRollbackFlow(row: any) {
  if (!canRollbackFlow(row)) return;
  const flowId = normalizeIntegerId(row && (row.flowId || row.id));
  const projectName = resolveProjectDisplayName(row);
  const valveText = resolveValveDisplay(row);
  const stageText = displayStageText(resolveStageCode(row));
  try {
    await openConfirm({
      title: "回退确认",
      message: `确认回退项目“${projectName}”${
        valveText && valveText !== "-" ? `（阀点：${valveText}）` : ""
      }在“${stageText}”的当前节点吗？回退后流程将退回上一节点。`,
      type: "warning",
      confirmText: "确认回退",
    });
  } catch {
    return;
  }

  loading.value = true;
  try {
    const response = await rollbackRevenueProjectFlowCurrentNode({ flowId });
    if (!response || !response.ok) {
      BaseToast.warning((response && response.message) || "回退失败");
      return;
    }
    BaseToast.success(response.message || "回退成功");
    await loadPageData();
  } catch (err: any) {
    console.error("回退流程失败", err);
    BaseToast.error(err?.message || "回退失败，请稍后重试");
  } finally {
    loading.value = false;
  }
}

/** 对齐 Vue2：解析可跳转的阶段动作（无权限则返回空） */
function resolveFlowRouteActionKey(stageCode: string, actionKey = "") {
  const permissions = currentPermissions.value || [];
  const requestedAction = String(actionKey || "").trim().toLowerCase();
  if (
    requestedAction &&
    hasFlowStageActionPermission(permissions, stageCode, requestedAction)
  ) {
    return requestedAction;
  }
  return resolveFlowStageDefaultAction(stageCode, permissions);
}

/**
 * 对齐 Vue2 resolveDetailRoute：
 * 进入详情前必须具备当前阶段操作权限，并用 stageDetailTarget.path 跳转。
 * （此前 Vue3 用 flow-identity 无鉴跳转，导致仅有 S2 权限也能进 S3 详情）
 */
function buildDetailRoute(row: any, buttonKey = "") {
  const stage = resolveStageCode(row);
  const permissions = currentPermissions.value || [];

  const actionKey = resolveFlowRouteActionKey(stage, buttonKey);
  if (!actionKey) {
    BaseToast.warning(`缺少 ${stage} 操作权限`);
    return null;
  }
  const permissionKey = resolveFlowStageActionPermission(stage, actionKey);
  if (!permissionKey) {
    BaseToast.warning(`缺少 ${stage} 操作权限`);
    return null;
  }

  const ctx = resolveCurrentUserContext(authStore);
  if (!ctx) {
    BaseToast.error("未获取到当前登录用户，请重新登录后重试");
    return null;
  }

  const projectNo = String((row && row.projectNo) || "");
  const projectCode = String((row && row.projectCode) || projectNo);
  const projectId = normalizeIntegerId(row && (row.projectId || row.project_id));
  const flowId = String((row && (row.flowId || row.id || "")) || "").trim();
  const projectName = String(
    (row && (row.projectName || row.project || "")) || "",
  ).trim();
  const valve = String((row && row.valve) || "").trim();
  const valvePoint = String((row && (row.valvePoint || row.valve)) || "").trim();
  const nodeStatus = String((row && row.nodeStatus) || "").trim();
  const flowCreatedAt = String((row && row.createdAt) || "").trim();
  const flowUpdatedAt = String(
    (row && (row.updatedAt || row.meetingDate)) || "",
  ).trim();

  // 对齐 Vue2：数据校核入口跳转主表校核详情，不走阶段详情路由解析
  if (isDataCheckEntry.value) {
    return {
      path: "/revenue/data-check-detail",
      query: {
        projectNo,
        projectCode,
        projectId,
        flowId,
        projectName,
        nodeStatus,
        permissionKey,
        stage,
        valve,
        valvePoint,
        flowCreatedAt,
        flowUpdatedAt,
        user: String(ctx.userId || ""),
        userName: String(ctx.userName || ctx.userId || ""),
        // S3 本人草稿 ownerId 与后端登录名对齐（与数字 userId 分离）
        ...(ctx.loginName ? { ownerUser: String(ctx.loginName) } : {}),
        menuKey: String(props.menuKey || "data_check"),
        action: "check",
        subjectDomain: AUDIT_DOMAIN.MAIN_TABLE,
        subjectApiMode: "all",
      },
    };
  }

  const stageDetailTarget = resolveProjectListStageDetailTarget({
    stageCode: stage,
    actionKey,
    hasAction: ((key?: string) =>
      hasFlowStageActionPermission(permissions, stage, key || "")) as any,
    isSuperAdmin: authStore.isSuperAdmin,
  });
  if (!stageDetailTarget || !stageDetailTarget.path) {
    BaseToast.warning("缺少当前操作权限");
    return null;
  }

  const detailMenuKey = resolveProjectListStageDetailMenuKey({
    currentMenuKey: String(props.menuKey || "project_list"),
    stageCode: stage,
  });

  const routeStage = String(stageDetailTarget.stage || stage);
  const routeAction =
    stageDetailTarget.path === "/revenue/subtable-fill-detail"
      ? actionKey || String(stageDetailTarget.action || "")
      : String(stageDetailTarget.action || actionKey);

  const query: Record<string, string> = {
    projectNo,
    projectCode,
    projectId,
    flowId,
    projectName,
    nodeStatus,
    stage: routeStage,
    valve,
    valvePoint,
    flowCreatedAt,
    flowUpdatedAt,
    user: String(ctx.userId || ""),
    userName: String(ctx.userName || ctx.userId || ""),
    // S3 本人草稿 ownerId 与后端登录名对齐（与数字 userId 分离）
    ...(ctx.loginName ? { ownerUser: String(ctx.loginName) } : {}),
    menuKey: detailMenuKey,
    action: routeAction,
    permissionKey,
  };
  if (stageDetailTarget.subjectDomain) {
    query.subjectDomain = String(stageDetailTarget.subjectDomain);
  }
  if (stageDetailTarget.selectedSourceStage) {
    query.selectedSourceStage = String(stageDetailTarget.selectedSourceStage);
  }
  if (stageDetailTarget.readonlyStage) {
    query.readonlyStage = String(stageDetailTarget.readonlyStage);
    query.actualStage = stage;
  }
  if (stageDetailTarget.subjectApiMode) {
    query.subjectApiMode = String(stageDetailTarget.subjectApiMode);
  }
  if (stageDetailTarget.readonlyAuthorizedScope) {
    query.readonlyAuthorizedScope = String(
      stageDetailTarget.readonlyAuthorizedScope,
    );
  }
  if (!query.fromPath) {
    query.fromPath = route.fullPath;
  }
  if (authStore.isSuperAdmin) {
    query.isSuperAdmin = "1";
  }

  // 清理空 query，避免污染地址栏
  Object.keys(query).forEach((key) => {
    if (query[key] == null || String(query[key]).trim() === "") {
      delete query[key];
    }
  });

  return { path: String(stageDetailTarget.path), query };
}

function openDetail(row: any) {
  if (isDetailEntryBlocked(row)) {
    BaseToast.warning(resolveDetailEntryBlockedTip(row));
    return;
  }
  const route = buildDetailRoute(row);
  if (!route) return;
  rememberMeetingReviewEntry(route);
  router.push(route).catch((err: any) => {
    BaseToast.error("跳转失败：" + (err?.message || "未知错误"));
  });
}

function handleAction(row: any, action: any) {
  confirmStageFlowSubmit(row, action).then(() => {
    const detailRoute = buildDetailRoute(row, action?.key);
    if (!detailRoute) return;
    navigationTo(detailRoute);
  });
}

function handleInlineListAction(row: any, action: any) {
  const detailRoute = buildDetailRoute(row, action?.key);
  if (!detailRoute) return;
  navigationTo(detailRoute);
}

/** 统一导航：优先用 $tab 系统，否则用 router.push */
function navigationTo(location: { path: string; query: Record<string, string> }) {
  if ((window as any).$tab?.closeOpenPage) {
    (window as any).$tab.closeOpenPage(location);
    return;
  }
  router.push(location);
}

/**
 * 注册审计详情页路由（后端菜单通常不返回这些隐藏详情页，
 * 导致 router.push 静默失败，需在前端手动注册）
 */
function registerDetailRoutes() {
  const detailRouteComponents: Record<string, () => Promise<unknown>> = {
    "/revenue/subtable-fill-detail": () => import("../subtable-fill/detail.vue"),
    "/revenue/subtable-audit-detail": () => import("../subtable-audit/detail.vue"),
    "/revenue/main-table-audit-detail": () => import("../main-table-audit/detail.vue"),
    "/revenue/meeting-review-detail": () => import("../meeting-review/detail.vue"),
    "/revenue/s5-main-selection-detail": () => import("../s5-main-selection/detail.vue"),
    "/revenue/s5-decision-approval-detail": () => import("../s5-decision-approval/detail.vue"),
    "/revenue/project-flow-detail": () => import("../project-flow/detail.vue"),
    "/revenue/data-check-detail": () => import("../data-check/detail.vue"),
  };

  const existingPaths = new Set(router.getRoutes().map((r) => r.path));

  Object.entries(detailRouteComponents).forEach(([path, component]) => {
    if (existingPaths.has(path)) return;
    const name = `revenue-detail__${path.replace(/\//g, "-").replace(/^-/, "")}`;
    router.addRoute({ path, name, component, meta: { hidden: true } });
  });
}

// ========== 上会评审入口 token（对齐原项目：跳转前写入 sessionStorage） ==========
const MEETING_REVIEW_ENTRY_SESSION_PREFIX = "revenue:meeting-review-entry:";
const MEETING_REVIEW_ENTRY_TTL_MS = 30 * 60 * 1000;
const MEETING_REVIEW_ENTRY_MENU_KEYS = Object.freeze(["meeting_review", "flow_s8"]);

function safeRouteText(value: unknown, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function normalizeRouteStageCode(value: unknown) {
  const text = safeRouteText(value, "S8").toUpperCase();
  return /^S[1-8]$/.test(text) ? text : "S8";
}

function buildMeetingReviewEntryKey(query: Record<string, string> = {}) {
  return [
    safeRouteText(query.projectId),
    safeRouteText(query.flowId),
    safeRouteText(query.projectCode || query.projectNo),
    safeRouteText(query.valvePoint || query.valve),
    normalizeRouteStageCode(query.stage || "S8"),
  ].join("__");
}

function isMeetingReviewDetailMenuKey(menuKey = "") {
  return MEETING_REVIEW_ENTRY_MENU_KEYS.includes(String(menuKey || "").trim());
}

/** 进入上会评审详情前，写入有效期内的入口 token（仅记录，不跳转） */
function rememberMeetingReviewEntry(
  route: { path?: string; query?: Record<string, string> } = {}
) {
  if (!route || route.path !== "/revenue/meeting-review-detail") return;
  if (!isMeetingReviewDetailMenuKey(route.query?.menuKey)) return;
  if (typeof window === "undefined" || !window.sessionStorage) return;
  const key = buildMeetingReviewEntryKey(route.query || {});
  if (!key) return;
  window.sessionStorage.setItem(
    `${MEETING_REVIEW_ENTRY_SESSION_PREFIX}${key}`,
    String(Date.now() + MEETING_REVIEW_ENTRY_TTL_MS)
  );
}

function resolveInlineActionKey(row: any, actionKey: string): string {
  return `${row?.id || ""}_${actionKey}`;
}

void _currentUserContext.value;
void _canShowVoidOperationColumn.value;
void _currentUserName.value;
void _hasFlowActionPermission.value;
void _hasFlowIndexPermission.value;
</script>

<style lang="scss" scoped>
// ========== 搜索表单 ==========
.rv-search-form {
  margin-bottom: 0;

  :deep(.el-form-item) {
    margin-bottom: 8px;
  }

  :deep(.el-form-item__label) {
    color: var(--bq-color-text-secondary);
    font-weight: 500;
  }
}

// ========== 工具栏（由 BaseToolbar 提供布局与分隔线，此处不再重复样式） ==========

// ========== 表格区域（对齐菜单管理：撑满面板宽度 + 滚动条在表格底部 + 操作列右固定左对齐） ==========
.rv-table-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  width: 100%;

  :deep(.el-table) {
    --el-table-border-color: var(--bq-color-border-subtle);
    --el-table-header-bg-color: var(--bq-color-table-header);
    --el-table-row-hover-bg-color: color-mix(
      in srgb,
      var(--bq-color-primary),
      white 96%
    );
    /* 横向滚动时操作列左侧阴影 */
    --el-table-fixed-right-column: inset -10px 0 10px -10px rgba(0, 0, 0, 0.12);
    font-size: var(--bq-font-compact);
    width: 100%;
  }

  :deep(.el-table th.el-table__cell) {
    font-weight: 600;
    color: var(--bq-color-text);
    height: 40px;
  }

  :deep(.el-table td.el-table__cell) {
    height: 42px;
  }

  :deep(.el-table th .cell),
  :deep(.el-table td .cell) {
    line-height: 20px;
    padding-inline: 8px;
  }

  /* 去掉竖线，保留横线 */
  :deep(.el-table--border .el-table__cell),
  :deep(.el-table__cell) {
    border-right: none !important;
  }

  :deep(.el-table--border::before),
  :deep(.el-table--border::after),
  :deep(.el-table__border-left-patch) {
    display: none !important;
  }

  /* 固定右侧操作列：不透明背景，盖住横向滚动的其他列 */
  :deep(.el-table__fixed-right),
  :deep(.el-table__fixed-right-patch) {
    background: var(--bq-color-surface, #fff);
    z-index: 4;
  }

  :deep(.el-table__fixed-right .el-table__cell),
  :deep(.el-table-fixed-column--right) {
    background: var(--bq-color-surface, #fff) !important;
  }

  :deep(.el-table__header .el-table-fixed-column--right),
  :deep(.el-table__fixed-right th.el-table__cell) {
    background: var(--bq-color-table-header) !important;
  }

  :deep(.el-table__body tr:hover > td.el-table-fixed-column--right),
  :deep(.el-table__fixed-right .el-table__body tr:hover > td.el-table__cell) {
    background: color-mix(in srgb, var(--bq-color-primary), white 96%) !important;
  }

  /* 操作列内容左对齐（覆盖全局 .bq-table-actions 居中） */
  :deep(.rv-ops-col .cell) {
    text-align: left;
    justify-content: flex-start;
    padding-inline: 6px;
  }
}

.rv-table-wrap {
  min-width: 0;
  width: 100%;
  overflow: hidden;
}

// ========== 表格单元格样式 ==========
.rv-cell-link {
  cursor: pointer;
  color: var(--bq-color-primary);
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

.rv-cell-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--bq-radius-control);
  background: var(--bq-color-bg);
  color: var(--bq-color-text);
  font-size: 12px;
}

.rv-cell-status {
  font-size: 12px;
  font-weight: 600;
  color: var(--bq-color-text);
}

.rv-cell-muted {
  color: var(--bq-color-text-muted);
  font-size: 12px;
}

// ========== 行状态 ==========
:deep(.rv-row-voided) {
  opacity: 0.55;
}

:deep(.rv-row-finished) {
  color: var(--bq-color-text-secondary);
}

// ========== 操作列（收紧按钮间距，避免「作废」被裁切） ==========
.rv-action-col {
  flex-wrap: nowrap;
  justify-content: flex-start;
  width: auto;
  gap: 0;

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  :deep(.el-button.is-link),
  :deep(.el-button.is-text) {
    padding-right: 2px;
    padding-left: 2px;
  }
}

// ========== 权限提示 ==========
.rv-forbidden {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}
</style>
