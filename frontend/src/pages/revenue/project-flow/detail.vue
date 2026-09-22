<template>
  <section class="revenue-project-flow rev-impact-theme rv-card rv-list-card">
    <div class="rv-list-head">
      <div class="rv-head-title">
        <div class="rv-list-title">流程管理</div>
      </div>

      <div class="rv-stage-scroll">
        <div class="rv-stage-track">
          <div
            v-for="stage in stageOptions"
            :key="stage.code"
            class="rv-stage-item"
          >
            <button
              type="button"
              class="rv-stage-button"
              :class="{
                'is-current': stage.code === routeStage.code,
                'is-complete': isStageComplete(stage.code),
              }"
              :aria-label="`${stage.code} ${stage.label}`"
              @click="selectStage(stage.code)"
            >
              <span class="rv-stage-dot">{{ stage.code }}</span>
              <span class="rv-stage-label">{{ stage.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="rv-list-toolbar">
        <el-button size="small" @click="goBack">返回项目列表</el-button>
      </div>
    </div>

    <div class="rv-flow-body">
      <section class="rv-panel rv-info-panel">
        <div class="rv-info-line">
          <div
            v-for="item in flowInfoItems"
            :key="item.label"
            class="rv-info-item"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </section>
    </div>

    <section class="rv-floating-console">
      <div class="rv-console-label">节点权限预览</div>
      <div class="rv-chip-group">
        <button
          v-for="action in activeStage.actions"
          :key="`console_action_${activeStage.code}_${action.key}`"
          type="button"
          class="rv-console-chip"
          :class="{ 'is-active': activeActionKey === action.key }"
          @click="selectAction(action.key)"
        >
          {{ action.label }}
        </button>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { resolveFlowStageActionPermission } from "@/pages/revenue/permissions";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const STAGE_OPTIONS = Object.freeze([
  {
    code: "S1",
    label: "业务经理填报",
    actions: Object.freeze([
      { key: "fill", label: "填报" },
      { key: "submit", label: "节点提交" },
      { key: "view", label: "查看" },
    ]),
    summary: "业务经理填报全部科目，填完后由前端自动计算得到主表。",
  },
  {
    code: "S2",
    label: "集团部室审核",
    actions: Object.freeze([
      { key: "review", label: "审核" },
      { key: "submit", label: "节点提交" },
      { key: "view", label: "查看" },
    ]),
    summary: "集团部室按科目评审并给出意见值，子表计算后汇总得到主表。",
  },
  {
    code: "S3",
    label: "业务经理二次确认",
    actions: Object.freeze([
      { key: "confirm", label: "复核" },
      { key: "submit", label: "节点提交" },
      { key: "view", label: "查看" },
    ]),
    summary: "业务经理采纳评审值或给出修正值，并重新形成计算结果。",
  },
  {
    code: "S4",
    label: "二级公司财务审核",
    actions: Object.freeze([
      { key: "review", label: "审核并提交" },
      { key: "view", label: "查看" },
    ]),
    summary: "二级公司财务围绕主表科目审核，并给出财务建议值。",
  },
  {
    code: "S5",
    label: "二级公司最终提交",
    actions: Object.freeze([
      { key: "select_main", label: "确认主表" },
      { key: "approve", label: "决策确认" },
      { key: "view", label: "查看" },
    ]),
    summary: "管理经理选择二级公司最终值，并提交集团进入集团侧评审。",
  },
  {
    code: "S6",
    label: "集团财务审核",
    actions: Object.freeze([
      { key: "review", label: "审核并提交" },
      { key: "view", label: "查看" },
    ]),
    summary: "集团财务审核主表并给出意见值，可与集团部室意见并行沉淀候选值。",
  },
  {
    code: "S7",
    label: "会前窗口期",
    actions: Object.freeze([
      { key: "start_meeting", label: "开始上会" },
      { key: "edit", label: "维护上会信息" },
      { key: "view", label: "查看" },
    ]),
    summary: "技术与产品管理部发布上会通知，开放会前多轮调值复算窗口并截止冻结。",
  },
  {
    code: "S8",
    label: "集团上会评审",
    actions: Object.freeze([
      { key: "review", label: "上会评审" },
      { key: "view", label: "查看" },
    ]),
    summary: "集团产品委员会完成上会评审，通过或不通过，并形成上会值版本。",
  },
]);

function safeText(value: any, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function mapStageCode(stageCode: any) {
  const code = safeText(stageCode, "S1").toUpperCase();
  return STAGE_OPTIONS.some((item) => item.code === code) ? code : "S1";
}

function getStageMeta(stageCode: string) {
  return STAGE_OPTIONS.find((item) => item.code === stageCode) || STAGE_OPTIONS[0];
}

function normalizeActionKey(value: any, stageMeta: any) {
  const action = safeText(value).replace(/-/g, "_");
  const actions = Array.isArray(stageMeta && stageMeta.actions) ? stageMeta.actions : [];
  if (actions.some((item: any) => item.key === action)) return action;
  return actions.length ? actions[0].key : "view";
}

function buildPermissionLabel(stageCode: string, actionKey: string) {
  return resolveFlowStageActionPermission(stageCode, actionKey) || "-";
}

// --- reactive state ---
const routeStageCode = ref(mapStageCode(route.query.stage));
const routeStageMeta = getStageMeta(routeStageCode.value);
const activeStageCode = ref(routeStageCode.value);
const activeActionKey = ref(normalizeActionKey(route.query.action, routeStageMeta));
const currentValve = ref(safeText(route.query.valve));

// --- computed ---
const stageOptions = computed(() => STAGE_OPTIONS);

const projectNo = computed(() =>
  safeText(route.query.projectNo, safeText(route.query.projectCode, "--"))
);

const projectName = computed(() =>
  safeText(route.query.projectName, `${projectNo.value} 收益项目`)
);

const projectText = computed(() => {
  if (!projectNo.value || projectNo.value === "--") {
    return projectName.value;
  }
  if (projectName.value === projectNo.value) {
    return projectName.value;
  }
  return `${projectName.value}（${projectNo.value}）`;
});

const valveText = computed(() => safeText(currentValve.value, "-"));

const routeStage = computed(() => getStageMeta(routeStageCode.value));

const routeStageIndex = computed(() =>
  stageOptions.value.findIndex((item) => item.code === routeStage.value.code)
);

const activeStage = computed(() => getStageMeta(activeStageCode.value));

const currentUserId = computed(() => safeText(authStore.currentUser?.id, "-"));

const currentPermissionText = computed(() => {
  const permissions = authStore.permissions;
  const list = Array.isArray(permissions)
    ? permissions.map((item: any) => safeText(item)).filter(Boolean)
    : [safeText(permissions)].filter(Boolean);
  return list.length ? list.join("、") : "-";
});

const activePermissionKey = computed(() =>
  buildPermissionLabel(activeStage.value.code, activeActionKey.value)
);

const flowInfoItems = computed(() => [
  { label: "当前项目", value: projectText.value },
  { label: "当前阀点", value: valveText.value },
  { label: "用户ID", value: currentUserId.value },
  { label: "用户权限", value: currentPermissionText.value },
  { label: "预览节点", value: `${activeStage.value.code} ${activeStage.value.label}` },
  { label: "预览权限", value: activePermissionKey.value },
]);

// --- methods ---
function syncRouteState() {
  const code = mapStageCode(route.query.stage);
  const meta = getStageMeta(code);
  routeStageCode.value = code;
  activeStageCode.value = code;
  activeActionKey.value = normalizeActionKey(route.query.action, meta);
  currentValve.value = safeText(route.query.valve);
}

function isStageComplete(stageCode: string) {
  const index = stageOptions.value.findIndex((item) => item.code === stageCode);
  return index > -1 && index < routeStageIndex.value;
}

function selectStage(stageCode: string) {
  activeStageCode.value = mapStageCode(stageCode);
  activeActionKey.value = normalizeActionKey("", activeStage.value);
}

function selectAction(actionKey: string) {
  activeActionKey.value = normalizeActionKey(actionKey, activeStage.value);
}

function goBack() {
  router.back();
}

// --- watch ---
watch(
  () => route.fullPath,
  () => {
    syncRouteState();
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
@use "../styles/revenue-visual-spec-g.scss" as *;

.revenue-project-flow {
  border: 1px solid var(--rv-line);
  border-radius: 10px;
  background: var(--rv-surface);
  box-shadow: var(--rv-shadow-xs);
  overflow: hidden;

  &.rev-impact-theme {
    min-height: auto;
    padding-bottom: 96px;
  }

  &.rv-list-card {
    overflow: visible;
  }

  .rv-list-head {
    flex-wrap: wrap;
    padding: 14px 16px;
    gap: 12px;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 30;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
  }

  .rv-list-title {
    font-size: 15px;
    line-height: 1.4;
    letter-spacing: 0.2px;
  }

  .rv-head-title {
    flex: 0 0 auto;
  }

  .rv-list-toolbar {
    margin-left: auto;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .rv-list-toolbar > * {
    margin-left: 0;
  }

  :deep(.rv-list-toolbar .el-button) {
    margin-left: 0;
  }

  .rv-flow-body {
    padding: 16px;
    background: var(--rv-bg);
  }

  .rv-panel {
    border: 1px solid var(--rv-line);
    border-radius: 10px;
    background: var(--rv-surface);
    box-shadow: var(--rv-shadow-xs);
  }

  .rv-info-panel {
    padding: 10px 14px;
  }

  .rv-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .rv-panel-title {
    color: var(--rv-text);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.5;
  }

  .rv-stage-scroll {
    flex: 1 1 auto;
    min-width: 420px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 3px 2px;
  }

  .rv-stage-track {
    position: relative;
    display: flex;
    justify-content: space-between;
    min-width: 620px;
    padding: 0 8px;
  }

  .rv-stage-track::before {
    content: none;
  }

  .rv-stage-item:not(:last-child)::after {
    content: "";
    position: absolute;
    top: 13px;
    left: calc(50% + 13px);
    width: calc(100% - 26px);
    height: 2px;
    background: var(--rv-line-strong);
    z-index: 0;
  }

  .rv-stage-item {
    position: relative;
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .rv-stage-button,
  .rv-console-chip {
    appearance: none;
    cursor: pointer;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, transform 0.18s ease;
  }

  .rv-stage-button {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0;
    border: 0;
    background: transparent;
  }

  .rv-stage-button:hover .rv-stage-dot,
  .rv-console-chip:hover {
    border-color: var(--rv-focus);
  }

  .rv-stage-dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 2px solid var(--rv-line-strong);
    background: var(--rv-surface);
    color: var(--rv-text-3);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }

  .rv-stage-button.is-complete .rv-stage-dot {
    border-color: var(--rv-success);
    background: var(--rv-success-soft);
    color: var(--rv-success);
  }

  .rv-stage-button.is-current .rv-stage-dot {
    border-color: var(--rv-focus);
    background: var(--rv-focus);
    color: #fff;
  }

  .rv-stage-label {
    max-width: 96px;
    min-height: 32px;
    color: var(--rv-text-3);
    font-size: 11px;
    line-height: 1.35;
    text-align: center;
  }

  .rv-info-line {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
  }

  .rv-info-item {
    min-width: 0;
  }

  .rv-info-item span {
    display: block;
    color: var(--rv-text-4);
    font-size: 12px;
    line-height: 1.5;
  }

  .rv-info-item strong {
    display: block;
    margin-top: 6px;
    color: var(--rv-text);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.5;
    word-break: break-word;
  }

  .rv-console-label {
    color: var(--rv-text-2);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.6;
  }

  .rv-chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  .rv-console-chip {
    border: 1px solid var(--rv-line-strong);
    border-radius: 999px;
    padding: 8px 12px;
    background: var(--rv-surface);
    color: var(--rv-text-3);
    font-size: 12px;
    line-height: 1;
  }

  .rv-console-chip.is-active {
    border-color: var(--rv-focus);
    background: var(--rv-focus-bg);
    color: var(--rv-focus-strong);
    font-weight: 700;
  }

  .rv-floating-console {
    position: fixed;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    width: min(1180px, calc(100vw - 48px));
    border: 1px solid rgba(0, 122, 255, 0.16);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.14);
    backdrop-filter: blur(14px);
    padding: 12px 14px;
    z-index: 20;
  }
}

@media (max-width: 1200px) {
  .revenue-project-flow {
    .rv-info-line {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}

@media (max-width: 768px) {
  .revenue-project-flow {
    .rv-list-head,
    .rv-flow-body {
      padding: 12px;
    }

    .rv-panel-head {
      width: 100%;
      justify-content: flex-start;
    }

    .rv-list-toolbar {
      width: auto;
    }

    .rv-stage-scroll {
      flex-basis: 100%;
      min-width: 0;
      order: 3;
    }

    .rv-stage-track {
      min-width: 640px;
    }

    .rv-info-line {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .rv-floating-console {
      width: calc(100vw - 24px);
      bottom: 12px;
      padding: 12px;
    }
  }
}
</style>
