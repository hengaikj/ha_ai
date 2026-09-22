<template>
  <PageContainer
    title="我的待办"
    description="按任务视图展示即将到来、待处理、已处理任务，点击卡片可跳转对应工作台。"
  >
    <div class="my-todos-toolbar">
      <el-button :loading="loading" @click="loadBoard">刷新</el-button>
    </div>

    <el-alert
      v-if="errorMessage"
      type="error"
      :title="errorMessage"
      show-icon
      :closable="false"
      class="my-todos-error"
    />

    <div v-loading="loading" class="my-todos-board">
      <section
        v-for="column in columns"
        :key="column.key"
        class="todo-column"
        :data-group="column.key"
      >
        <header class="todo-column__head">
          <span class="todo-column__index">{{ column.index }}</span>
          <h2 class="todo-column__title">{{ column.title }}</h2>
          <span class="todo-column__count">{{ column.total }}</span>
        </header>

        <div class="todo-column__body">
          <article
            v-for="card in column.items"
            :key="`${card.flowId}-${card.actionKey}-${card.group}`"
            class="todo-card"
          >
            <div class="todo-card__top">
              <div class="todo-card__title">{{ card.title || "-" }}</div>
              <span v-if="card.valvePoint" class="todo-card__valve">{{ card.valvePoint }}</span>
            </div>
            <div class="todo-card__meta">
              {{ card.entryLabel || "-" }} · {{ card.stageLabel || "-" }}
            </div>
            <p class="todo-card__hint">{{ card.hint || "-" }}</p>
            <div class="todo-card__foot">
              <span class="todo-card__tag" :data-group="card.group">
                {{ column.tag }}
              </span>
              <el-button
                size="small"
                :type="column.key === 'pending' ? 'primary' : 'default'"
                @click="openCard(card)"
              >
                {{ column.buttonText }}
              </el-button>
            </div>
          </article>

          <div v-if="!column.items.length" class="todo-column__empty">
            暂无任务
          </div>
        </div>
      </section>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { listMyTodos } from "@/api/system/expenses";
import PageContainer from "@/components/layout/PageContainer.vue";
import { BaseToast } from "@/components/base/BaseToast";

type TodoGroupKey = "upcoming" | "pending" | "processed";

interface TodoCard {
  flowId?: number | string;
  projectId?: number | string;
  projectNo?: string;
  projectName?: string;
  valvePoint?: string;
  node?: string;
  nodeStatus?: string;
  group?: TodoGroupKey | string;
  actionKey?: string;
  permissionKey?: string;
  title?: string;
  entryLabel?: string;
  stageLabel?: string;
  hint?: string;
  jumpPath?: string;
  jumpQuery?: Record<string, string>;
  operatedAt?: string;
}

interface TodoGroup {
  total?: number;
  items?: TodoCard[];
}

interface TodoBoard {
  upcoming?: TodoGroup;
  pending?: TodoGroup;
  processed?: TodoGroup;
}

const router = useRouter();
const loading = ref(false);
const errorMessage = ref("");
const board = ref<TodoBoard>({});

function unwrapBoard(payload: unknown): TodoBoard {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  return {
    upcoming: (data.upcoming as TodoGroup) || { total: 0, items: [] },
    pending: (data.pending as TodoGroup) || { total: 0, items: [] },
    processed: (data.processed as TodoGroup) || { total: 0, items: [] },
  };
}

function normalizeGroup(group?: TodoGroup): { total: number; items: TodoCard[] } {
  const items = Array.isArray(group?.items) ? group!.items! : [];
  const total = Number(group?.total);
  return {
    total: Number.isFinite(total) ? total : items.length,
    items,
  };
}

const columns = computed(() => {
  const upcoming = normalizeGroup(board.value.upcoming);
  const pending = normalizeGroup(board.value.pending);
  const processed = normalizeGroup(board.value.processed);
  return [
    {
      key: "upcoming" as const,
      index: "01",
      title: "即将到来（等待上一节点）",
      tag: "即将到来",
      buttonText: "去查看",
      total: upcoming.total,
      items: upcoming.items,
    },
    {
      key: "pending" as const,
      index: "02",
      title: "待处理",
      tag: "待处理",
      buttonText: "去处理",
      total: pending.total,
      items: pending.items,
    },
    {
      key: "processed" as const,
      index: "03",
      title: "已处理",
      tag: "已处理",
      buttonText: "去查看",
      total: processed.total,
      items: processed.items,
    },
  ];
});

async function loadBoard() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const payload = await listMyTodos();
    board.value = unwrapBoard(payload);
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "加载我的待办失败";
    board.value = {};
  } finally {
    loading.value = false;
  }
}

const MEETING_REVIEW_ENTRY_SESSION_PREFIX = "revenue:meeting-review-entry:";
const MEETING_REVIEW_ENTRY_TTL_MS = 30 * 60 * 1000;
const MEETING_REVIEW_ENTRY_MENU_KEYS = Object.freeze(["meeting_review", "flow_s8"]);

function normalizeRouteStageCode(value: unknown) {
  const text = String(value == null ? "" : value).trim().toUpperCase();
  return /^S[1-8]$/.test(text) ? text : "S8";
}

function buildMeetingReviewEntryKey(query: Record<string, string> = {}) {
  return [
    String(query.projectId || "").trim(),
    String(query.flowId || "").trim(),
    String(query.projectCode || query.projectNo || "").trim(),
    String(query.valvePoint || query.valve || "").trim(),
    normalizeRouteStageCode(query.stage || "S8"),
  ].join("__");
}

/** 对齐项目列表：进入 S8 上会评审前写入入口 token，避免被重定向到只读主表页 */
function rememberMeetingReviewEntry(path: string, query: Record<string, string>) {
  if (path !== "/revenue/meeting-review-detail") return;
  const menuKey = String(query.menuKey || "").trim() || "flow_s8";
  if (!MEETING_REVIEW_ENTRY_MENU_KEYS.includes(menuKey)) {
    query.menuKey = "flow_s8";
  }
  if (typeof window === "undefined" || !window.sessionStorage) return;
  const key = buildMeetingReviewEntryKey(query);
  if (!key) return;
  window.sessionStorage.setItem(
    `${MEETING_REVIEW_ENTRY_SESSION_PREFIX}${key}`,
    String(Date.now() + MEETING_REVIEW_ENTRY_TTL_MS),
  );
}

function openCard(card: TodoCard) {
  const path = String(card.jumpPath || "").trim();
  if (!path) {
    BaseToast.warning("缺少跳转地址");
    return;
  }
  const query: Record<string, string> = {};
  const source = card.jumpQuery && typeof card.jumpQuery === "object" ? card.jumpQuery : {};
  Object.keys(source).forEach((key) => {
    const value = source[key];
    if (value != null && String(value).trim() !== "") {
      query[key] = String(value);
    }
  });
  if (!query.fromPath) {
    query.fromPath = "/revenue/my-todos";
  }
  rememberMeetingReviewEntry(path, query);
  router.push({ path, query }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "未知错误";
    BaseToast.error("跳转失败：" + message);
  });
}

onMounted(() => {
  loadBoard();
});
</script>

<style scoped>
.my-todos-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.my-todos-error {
  margin-bottom: 12px;
}

.my-todos-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  min-height: 360px;
}

.todo-column {
  background: #f5f7fa;
  border-radius: 12px;
  padding: 12px;
  min-height: 320px;
}

.todo-column[data-group="upcoming"] {
  background: #f3f4f6;
}

.todo-column[data-group="pending"] {
  background: #f8f4ec;
}

.todo-column[data-group="processed"] {
  background: #eef7f1;
}

.todo-column__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.todo-column__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  font-size: 12px;
  font-weight: 600;
}

.todo-column[data-group="processed"] .todo-column__index {
  background: #d8f0e0;
  color: #1f7a45;
}

.todo-column__title {
  margin: 0;
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.todo-column__count {
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  color: #606266;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

.todo-column__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: calc(100vh - 260px);
  overflow: auto;
}

.todo-card {
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.todo-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.todo-card__title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.todo-card__valve {
  font-size: 12px;
  color: #909399;
  background: #f2f3f5;
  border-radius: 999px;
  padding: 2px 8px;
}

.todo-card__meta {
  margin-top: 6px;
  font-size: 12px;
  color: #606266;
}

.todo-card__hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.todo-card__foot {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.todo-card__tag {
  font-size: 12px;
  border-radius: 999px;
  padding: 2px 8px;
}

.todo-card__tag[data-group="upcoming"] {
  background: #eef0f3;
  color: #606266;
}

.todo-card__tag[data-group="pending"] {
  background: #f8e9d8;
  color: #a15c12;
}

.todo-card__tag[data-group="processed"] {
  background: #ddf3e5;
  color: #1f7a45;
}

.todo-column__empty {
  padding: 24px 8px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

@media (max-width: 1100px) {
  .my-todos-board {
    grid-template-columns: 1fr;
  }

  .todo-column__body {
    max-height: none;
  }
}
</style>
