<template>
  <PageContainer
    title="公式管理"
    description="维护收益测算使用的计算公式，支持新增、复制、启停和删除。"
  >
    <QueryTable
      ref="queryTableRef"
      :func="queryFormulas"
      row-key="id"
      fit-table-height
      :table-props="{
        scrollbarAlwaysOn: true,
        border: false,
      }"
      empty-title="暂无公式"
      empty-description="当前条件下没有可展示的公式。"
      @reset="resetQuery"
    >
      <template #search>
        <el-form :model="query">
          <el-form-item label="公式名称">
            <el-input
              v-model.trim="query.formulaName"
              clearable
              placeholder="请输入公式名称"
              @keyup.enter="searchFormulas"
            />
          </el-form-item>
        </el-form>
      </template>

      <template #toolbar>
        <PermissionButton
          :permission="REVENUE_FORMULA_PERMISSIONS.create"
          type="primary"
          plain
          :icon="CirclePlus"
          @click="handleCreate"
        >
          新增
        </PermissionButton>
      </template>

      <el-table-column type="index" label="序号" width="70" header-align="center" />
      <el-table-column
        label="公式名称"
        prop="formulaName"
        min-width="240"
        header-align="center"
        show-overflow-tooltip
      />
      <el-table-column
        label="计算公式"
        prop="formulaText"
        min-width="420"
        header-align="center"
        show-overflow-tooltip
      />
      <el-table-column label="状态" width="120" align="center" header-align="center">
        <template #default="{ row }">
          {{ resolveFormulaStatusLabel(row) }}
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        width="200"
        fixed="right"
        align="left"
        header-align="center"
      >
        <template #default="{ row }">
          <div class="bq-table-actions formula-list-actions" @click.stop>
            <PermissionButton
              :permission="REVENUE_FORMULA_PERMISSIONS.create"
              link
              type="primary"
              @click="handleCopyCreate(row)"
            >
              复制新增
            </PermissionButton>
            <PermissionButton
              v-if="isActiveFormula(row)"
              :permission="REVENUE_FORMULA_PERMISSIONS.status"
              link
              type="primary"
              @click="handleToggleStatus(row)"
            >
              禁用
            </PermissionButton>
            <PermissionButton
              v-else
              :permission="REVENUE_FORMULA_PERMISSIONS.status"
              link
              type="primary"
              @click="handleToggleStatus(row)"
            >
              启用
            </PermissionButton>
            <PermissionButton
              :permission="REVENUE_FORMULA_PERMISSIONS.delete"
              link
              @click="handleDelete(row)"
            >
              删除
            </PermissionButton>
          </div>
        </template>
      </el-table-column>
    </QueryTable>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新增公式' : '编辑公式'"
      width="704px"
      :close-on-click-modal="false"
      append-to-body
      @closed="handleDialogClosed"
    >
      <el-form :model="formulaDialogForm" label-width="88px" size="small">
        <el-form-item label="公式名称" required>
          <el-input
            v-model.trim="formulaDialogForm.formulaName"
            maxlength="128"
            placeholder="请输入公式名称"
          />
        </el-form-item>

        <div class="formula-edit-section">
          <div class="formula-edit-section__head">
            <span class="formula-edit-section__title">基础运算编辑</span>
            <span class="formula-edit-section__desc">
              仅支持通过按钮插入参数、常量和运算符，保存前会校验括号与表达式结构
            </span>
          </div>

          <div class="formula-source-panels">
            <div class="formula-parameter-panel">
              <div class="formula-source-panel__head">
                <span class="formula-preview-title">参数配置</span>
                <el-button
                  type="primary"
                  size="mini"
                  plain
                  @click="addFormulaParameter"
                >
                  新增参数
                </el-button>
              </div>
              <div v-if="!formulaDialogForm.parameters.length" class="formula-source-panel__empty">
                请先新增参数，再将参数插入表达式
              </div>
              <div v-else class="formula-parameter-list">
                <div
                  v-for="parameter in formulaDialogForm.parameters"
                  :key="parameter.key"
                  class="formula-parameter-item"
                >
                  <span class="formula-parameter-token">{{ parameter.label }}</span>
                  <el-button
                    size="mini"
                    plain
                    class="formula-parameter-item__insert"
                    @click="appendParameter(parameter.key)"
                  >
                    插入
                  </el-button>
                </div>
              </div>
            </div>

            <div class="formula-constant-panel">
              <div class="formula-source-panel__head">
                <span class="formula-preview-title">常量</span>
              </div>
              <div class="formula-constant-grid">
                <el-button
                  v-for="constant in constantButtons"
                  :key="constant"
                  size="small"
                  plain
                  class="formula-constant-btn"
                  @click="appendConstant(constant)"
                >
                  {{ constant }}
                </el-button>
              </div>
            </div>
          </div>

          <div class="formula-edit-toolbar">
            <el-button
              v-for="operator in operatorButtons"
              :key="operator"
              size="small"
              plain
              class="formula-edit-toolbar__btn"
              @click="appendOperator(operator)"
            >
              {{ operator }}
            </el-button>
            <el-button
              size="small"
              plain
              class="formula-edit-toolbar__btn formula-edit-toolbar__btn--wide"
              @click="removeLastToken"
            >
              删除一格
            </el-button>
          </div>

          <div class="formula-preview-title">表达式预览</div>

          <div class="formula-token-editor">
            <div v-if="!formulaPreviewTokens.length" class="formula-token-editor__placeholder">
              当前公式为空
            </div>
            <div v-else class="formula-token-editor__text">
              <span
                v-for="(token, index) in formulaPreviewTokens"
                :key="`${token}_${index}`"
                :class="resolveFormulaTokenClass(token)"
              >
                {{ token }}
              </span>
            </div>
          </div>
        </div>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button :disabled="dialogSaving" @click="resetDialogFormula">重置</el-button>
          <el-button type="primary" :loading="dialogSaving" @click="handleDialogSave">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 确认弹窗 -->
    <BaseConfirm
      v-model="confirmState.visible"
      :title="confirmState.title"
      :message="confirmState.message"
      :type="confirmState.type"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      @confirm="resolveConfirm"
      @cancel="rejectConfirm"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { CirclePlus } from "@element-plus/icons-vue";
import { BaseToast } from "@/components/base/BaseToast";
import BaseConfirm from "@/components/base/BaseConfirm.vue";
import QueryTable from "@/components/business/QueryTable.vue";
import PageContainer from "@/components/layout/PageContainer.vue";
import PermissionButton from "@/components/security/PermissionButton.vue";
import { useBaseConfirmDialog } from "@/composables/useBaseConfirmDialog";
import {
  createExpenseFormula,
  deleteExpenseFormula,
  disableExpenseFormula,
  enableExpenseFormula,
  listExpenseSubjectFormulas,
  updateExpenseFormula,
} from "@/api/system/expenses";
import {
  REVENUE_FORMULA_PERMISSIONS,
  hasRevenuePermission,
} from "@/pages/revenue/permissions";
import {
  PARAMETER_TEXT,
  appendConstantToTokens,
  buildFormulaRawExpression as buildRawExpressionFromTokens,
  buildParameterRaw,
  createParameterKey,
  hasIncompleteConstant,
  isCompleteConstantToken,
  isConstantToken,
  isParameterToken,
  tokenizeFormulaRawExpression,
} from "./formula-expression";
import { safeText } from "@/utils/revenue-helpers";
import { useAuthStore } from "@/stores/auth";

interface FormulaParameter {
  key: string;
  label: string;
}

interface FormulaDialogForm {
  id: string;
  formulaCode: string;
  formulaName: string;
  status: string;
  remark: string;
  parameters: FormulaParameter[];
  tokens: string[];
}

interface FormulaRow {
  id: string;
  formulaCode: string;
  formulaName: string;
  formulaExpression: string;
  formulaPayload: string;
  expressionType: string;
  status: string;
  remark: string;
  creatorId: string;
  creatorName: string;
  creatorPermission: string;
  formulaText: string;
  [key: string]: unknown;
}

interface QueryState {
  formulaName: string;
}

type QueryTableExpose = {
  reload: () => Promise<void>;
  search: () => void;
};

interface FormulaAST {
  type: string;
  key?: string;
  value?: string;
  operator?: string;
  left?: FormulaAST;
  right?: FormulaAST;
}

interface ListResponse {
  rows?: Array<Record<string, unknown>>;
  data?: Array<Record<string, unknown>>;
  total?: number;
}

const FORMULA_REF_REGEXP = /\$\{([^}]*)\}/g;
const FETCH_ALL_PAGE_SIZE = 200;
const ACTIVE_STATUS = "ACTIVE";
const INACTIVE_STATUS = "INACTIVE";

const authStore = useAuthStore();

// ---- 工具函数 ----
function createEmptyDialogForm(): FormulaDialogForm {
  return {
    id: "",
    formulaCode: "",
    formulaName: "",
    status: ACTIVE_STATUS,
    remark: "",
    parameters: [],
    tokens: [],
  };
}

function createFormulaCode(): string {
  return `FORMULA_${Date.now()}`;
}

function precedenceOf(operator: string): number {
  if (operator === "+" || operator === "-") return 1;
  if (operator === "*" || operator === "/") return 2;
  return 0;
}

function createParameterDefinition(key: string): FormulaParameter {
  return {
    key,
    label: key,
  };
}

// ========== 确认弹窗 ==========
const {
  confirmState,
  openConfirm,
  resolveConfirm,
  rejectConfirm,
} = useBaseConfirmDialog();

// ---- 响应式数据 ----
const queryTableRef = ref<QueryTableExpose | null>(null);
const formulaRows = ref<FormulaRow[]>([]);
const formulaCacheKey = ref("");
const dialogVisible = ref(false);
const dialogMode = ref("create");
const dialogSaving = ref(false);
const formulaDialogForm = reactive<FormulaDialogForm>(createEmptyDialogForm());
const operatorButtons: string[] = ["+", "-", "*", "/", "(", ")"];
const constantButtons: string[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "."];
const query = reactive<QueryState>({
  formulaName: "",
});

// ---- computed ----
const currentUserId = computed(() => safeText(authStore.currentUser?.id));
const currentUserName = computed(() =>
  safeText(authStore.currentUser?.displayName || authStore.currentUser?.username)
);
const currentPermissions = computed(() =>
  Array.isArray(authStore.permissions) ? authStore.permissions : []
);
const canCreateFormula = computed(() =>
  hasRevenuePermission(currentPermissions.value, REVENUE_FORMULA_PERMISSIONS.create)
);
const canUpdateFormula = computed(() =>
  hasRevenuePermission(currentPermissions.value, REVENUE_FORMULA_PERMISSIONS.update)
);
const canToggleFormulaStatus = computed(() =>
  hasRevenuePermission(currentPermissions.value, REVENUE_FORMULA_PERMISSIONS.status)
);
const canDeleteFormula = computed(() =>
  hasRevenuePermission(currentPermissions.value, REVENUE_FORMULA_PERMISSIONS.delete)
);

const normalizedFormulaPreviewRaw = computed(() => {
  if (!formulaDialogForm.tokens.length) return "";
  return normalizeFormulaRawExpression(
    buildFormulaRawExpression(formulaDialogForm.tokens)
  );
});

const formulaPreviewTokens = computed(() => {
  if (!normalizedFormulaPreviewRaw.value) return formulaDialogForm.tokens;
  return convertFormulaExpressionToTokens(normalizedFormulaPreviewRaw.value);
});

// ---- 方法 ----
function normalizeFormulaExpression(formulaExpression: string): string {
  return safeText(formulaExpression).replace(FORMULA_REF_REGEXP, "$1");
}

function isParameterTokenLocal(token: string): boolean {
  return isParameterToken(token);
}

function isCompleteConstantTokenLocal(token: string): boolean {
  return isCompleteConstantToken(token);
}

function resolveFormulaTokenClass(token: string): string {
  if (isParameterTokenLocal(token)) return "formula-parameter-token";
  if (isConstantToken(token)) return "formula-constant-token";
  return "formula-operator-token";
}

function normalizeStatusValue(status: unknown): string {
  const text = safeText(status).toUpperCase();
  return text === INACTIVE_STATUS ? INACTIVE_STATUS : ACTIVE_STATUS;
}

function isActiveFormula(row: FormulaRow | null): boolean {
  return normalizeStatusValue((row && row.status)) === ACTIVE_STATUS;
}

function resolveFormulaStatusLabel(row: FormulaRow | null): string {
  return isActiveFormula(row) ? "正常" : "禁用";
}

function buildFormulaRawExpression(tokens: string[] = []): string {
  return buildRawExpressionFromTokens(tokens);
}

function tokenizeFormulaRawExpressionLocal(rawExpression: string, options: { enumerateLegacyParameters?: boolean } = {}): string[] {
  return tokenizeFormulaRawExpression(rawExpression, options);
}

function parseFormulaExpression(rawExpression: string): FormulaAST | null {
  const tokens = tokenizeFormulaRawExpressionLocal(rawExpression);
  if (!tokens.length) return null;
  let index = 0;

  const parsePrimary = (): FormulaAST | null => {
    const token = tokens[index];
    if (isParameterTokenLocal(token)) {
      index += 1;
      return { type: "parameter", key: token };
    }
    if (isCompleteConstantTokenLocal(token)) {
      index += 1;
      return { type: "constant", value: token };
    }
    if (token === "(") {
      index += 1;
      const node = parseAdditive();
      if (!node || tokens[index] !== ")") return null;
      index += 1;
      return node;
    }
    return null;
  };

  const parseMultiplicative = (): FormulaAST | null => {
    let left = parsePrimary();
    if (!left) return null;
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index];
      index += 1;
      const right = parsePrimary();
      if (!right) return null;
      left = {
        type: "binary",
        operator,
        left,
        right,
      };
    }
    return left;
  };

  const parseAdditive = (): FormulaAST | null => {
    let left = parseMultiplicative();
    if (!left) return null;
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index];
      index += 1;
      const right = parseMultiplicative();
      if (!right) return null;
      left = {
        type: "binary",
        operator,
        left,
        right,
      };
    }
    return left;
  };

  const ast = parseAdditive();
  if (!ast || index !== tokens.length) return null;
  return ast;
}

function shouldWrapChild(parentOperator: string, childNode: FormulaAST | null, isRightChild: boolean): boolean {
  if (!childNode || childNode.type !== "binary") return false;
  const parentPrecedence = precedenceOf(parentOperator);
  const childPrecedence = precedenceOf(childNode.operator!);
  if (childPrecedence < parentPrecedence) return true;
  if (!isRightChild) return false;
  if (parentOperator === "-" || parentOperator === "/") {
    return childPrecedence <= parentPrecedence;
  }
  return false;
}

function renderFormulaAst(node: FormulaAST | null): string {
  if (!node) return "";
  if (node.type === "parameter") return buildParameterRaw(node.key!);
  if (node.type === "constant") return node.value!;
  const leftText = renderFormulaAst(node.left!);
  const rightText = renderFormulaAst(node.right!);
  const normalizedLeft = shouldWrapChild(node.operator!, node.left!, false)
    ? `(${leftText})`
    : leftText;
  const normalizedRight = shouldWrapChild(node.operator!, node.right!, true)
    ? `(${rightText})`
    : rightText;
  return `${normalizedLeft}${node.operator}${normalizedRight}`;
}

function normalizeFormulaRawExpression(rawExpression: string): string {
  const ast = parseFormulaExpression(rawExpression);
  if (!ast) return "";
  return renderFormulaAst(ast);
}

function convertFormulaExpressionToTokens(formulaExpression: string): string[] {
  return tokenizeFormulaRawExpressionLocal(formulaExpression, {
    enumerateLegacyParameters: true,
  });
}

function buildParameterList(tokens: string[] = []): FormulaParameter[] {
  const keys = tokens.filter((token) => isParameterTokenLocal(token));
  return keys
    .filter((key, index) => key !== PARAMETER_TEXT && keys.indexOf(key) === index)
    .map((key) => createParameterDefinition(key));
}

function resolveNextParameterKey(): string {
  const maxIndex = formulaDialogForm.parameters.reduce((max, parameter) => {
    const hit = safeText(parameter && parameter.key).match(/^参数(\d+)$/);
    return hit ? Math.max(max, Number(hit[1])) : max;
  }, 0);
  return createParameterKey(maxIndex + 1);
}

function hasConfiguredParameter(key: string): boolean {
  return formulaDialogForm.parameters.some((parameter) => parameter.key === key);
}

function validateDialogFormula(): string {
  const formulaName = safeText(formulaDialogForm.formulaName);
  if (!formulaName) {
    return "公式名称不能为空";
  }
  if (!formulaDialogForm.tokens.length) {
    return "计算公式不能为空";
  }
  const usedParameters = formulaDialogForm.tokens.filter((token) => isParameterTokenLocal(token));
  if (usedParameters.some((key) => !hasConfiguredParameter(key))) {
    return "计算公式引用了未配置的参数";
  }
  const firstToken = formulaDialogForm.tokens[0];
  if (["+", "-", "*", "/", ")"].includes(firstToken)) {
    return "公式开头只能是参数、常量或左括号";
  }
  const lastToken = formulaDialogForm.tokens[formulaDialogForm.tokens.length - 1];
  if (["+", "-", "*", "/", "("].includes(lastToken)) {
    return "公式结尾只能是参数、常量或右括号";
  }
  if (hasIncompleteConstant(formulaDialogForm.tokens)) {
    return "常量小数未输入完整，请补全小数点后的数字";
  }
  const normalizedRaw = normalizedFormulaPreviewRaw.value;
  if (!normalizedRaw) {
    return "公式结构不合法，请检查括号和运算符";
  }
  return "";
}

function buildFormulaPayload(): string {
  return JSON.stringify({
    parameters: formulaDialogForm.parameters.map((parameter) => ({ ...parameter })),
    tokens: formulaDialogForm.tokens.slice(),
  });
}

function buildCreatePayload(): Record<string, unknown> {
  return {
    formulaCode: safeText(formulaDialogForm.formulaCode) || createFormulaCode(),
    formulaName: safeText(formulaDialogForm.formulaName),
    formulaExpression: normalizedFormulaPreviewRaw.value,
    formulaPayload: buildFormulaPayload(),
    expressionType: "ARITHMETIC",
    status: normalizeStatusValue(formulaDialogForm.status),
    remark: safeText(formulaDialogForm.remark),
    creatorId: currentUserId.value,
    creatorName: currentUserName.value,
  };
}

function buildUpdatePayload(): Record<string, unknown> {
  return {
    formulaName: safeText(formulaDialogForm.formulaName),
    formulaExpression: normalizedFormulaPreviewRaw.value,
    formulaPayload: buildFormulaPayload(),
    expressionType: "ARITHMETIC",
    status: normalizeStatusValue(formulaDialogForm.status),
    remark: safeText(formulaDialogForm.remark),
    creatorId: currentUserId.value,
    creatorName: currentUserName.value,
  };
}

function parseListResponse(response: ListResponse | null): { rows: Array<Record<string, unknown>>; total: number } {
  const rows: Array<Record<string, unknown>> = Array.isArray(response && response.rows)
    ? (response!.rows || [])
    : Array.isArray(response && response.data)
      ? (response!.data || [])
      : [];
  const total = Number((response && response.total)) || rows.length;
  return { rows, total };
}

function normalizeFormulaRow(row: Record<string, unknown>): FormulaRow {
  const source = row && typeof row === "object" ? row : {};
  const formulaExpression = safeText(source.formulaExpression || source.formula_expression);
  return {
    ...source,
    id: source.id as string,
    formulaCode: safeText(source.formulaCode || source.formula_code),
    formulaName: safeText(source.formulaName || source.formula_name),
    formulaExpression,
    formulaPayload: (source.formulaPayload || source.formula_payload || "") as string,
    expressionType: safeText(source.expressionType || source.expression_type),
    status: normalizeStatusValue(source.status),
    remark: safeText(source.remark),
    creatorId: safeText(source.creatorId || source.creator_id),
    creatorName: safeText(source.creatorName || source.creator_name),
    creatorPermission: safeText(source.creatorPermission || source.permissionKey),
    formulaText: normalizeFormulaExpression(
      normalizeFormulaRawExpression(formulaExpression) || formulaExpression
    ),
  } as FormulaRow;
}

async function fetchAllFormulaRows(): Promise<FormulaRow[]> {
  const mergedRows: FormulaRow[] = [];
  let pageNum = 1;
  let total: number;
  do {
    const response = await listExpenseSubjectFormulas({
      pageNum,
      pageSize: FETCH_ALL_PAGE_SIZE,
      formulaName: safeText(query.formulaName),
    }) as ListResponse;
    const parsed = parseListResponse(response);
    total = parsed.total;
    mergedRows.push(...parsed.rows.map((item) => normalizeFormulaRow(item)));
    if (!parsed.rows.length || mergedRows.length >= total) break;
    pageNum += 1;
  } while (pageNum < 1000);
  return mergedRows;
}

async function ensureFormulaRowsLoaded(force = false) {
  const cacheKey = safeText(query.formulaName);
  if (!force && formulaCacheKey.value === cacheKey && formulaRows.value.length) {
    return;
  }
  formulaRows.value = await fetchAllFormulaRows();
  formulaCacheKey.value = cacheKey;
}

async function queryFormulas(pageSize: number, pageNum: number) {
  await ensureFormulaRowsLoaded();
  const start = (pageNum - 1) * pageSize;
  const end = start + pageSize;
  return {
    total: formulaRows.value.length,
    list: formulaRows.value.slice(start, end),
    pageNo: pageNum,
    pageSize,
  };
}

async function reloadFormulas() {
  formulaCacheKey.value = "";
  await queryTableRef.value?.reload();
}

function resetQuery() {
  query.formulaName = "";
}

function searchFormulas() {
  formulaCacheKey.value = "";
  queryTableRef.value?.search();
}

function handleCreate(): void {
  if (!canCreateFormula.value) return;
  dialogMode.value = "create";
  Object.assign(formulaDialogForm, createEmptyDialogForm());
  dialogVisible.value = true;
}

function handleCopyCreate(row: FormulaRow): void {
  if (!canCreateFormula.value) return;
  dialogMode.value = "create";
  const tokens = convertFormulaExpressionToTokens(row.formulaExpression);
  const sourceName = safeText(row.formulaName || row.formula_name);
  Object.assign(formulaDialogForm, {
    id: "",
    formulaCode: "",
    formulaName: sourceName ? `${sourceName} 副本` : "",
    status: ACTIVE_STATUS,
    remark: row.remark || "",
    parameters: buildParameterList(tokens),
    tokens,
  });
  dialogVisible.value = true;
}

function handleDialogClosed(): void {
  Object.assign(formulaDialogForm, createEmptyDialogForm());
  dialogSaving.value = false;
}

function appendOperator(operator: string): void {
  if (!operator) return;
  formulaDialogForm.tokens.push(operator);
}

function addFormulaParameter(): void {
  const key = resolveNextParameterKey();
  formulaDialogForm.parameters.push(createParameterDefinition(key));
}

function appendParameter(key: string): void {
  if (!hasConfiguredParameter(key)) return;
  formulaDialogForm.tokens.push(key);
}

function appendConstant(constant: string): void {
  const result = appendConstantToTokens(formulaDialogForm.tokens, constant);
  if (!result.ok) {
    if (result.message) BaseToast.warning(result.message);
    return;
  }
  formulaDialogForm.tokens = result.tokens;
}

function removeLastToken(): void {
  formulaDialogForm.tokens.pop();
}

function resetDialogFormula(): void {
  const formulaName = dialogMode.value === "edit"
    ? safeText(formulaDialogForm.formulaName)
    : "";
  const preserved = {
    id: formulaDialogForm.id,
    formulaCode: formulaDialogForm.formulaCode,
    formulaName,
    status: normalizeStatusValue(formulaDialogForm.status),
    remark: formulaDialogForm.remark,
    parameters: [] as FormulaParameter[],
    tokens: [] as string[],
  };
  Object.assign(formulaDialogForm, preserved);
}

async function handleDialogSave(): Promise<void> {
  const validationMessage = validateDialogFormula();
  if (validationMessage) {
    BaseToast.error(validationMessage);
    return;
  }
  if (dialogMode.value === "edit" && !canUpdateFormula.value) {
    BaseToast.error("无公式编辑权限");
    return;
  }
  if (dialogMode.value !== "edit" && !canCreateFormula.value) {
    BaseToast.error("无公式新增权限");
    return;
  }
  if (!currentUserId.value || !currentUserName.value) {
    BaseToast.error("未获取到登录人信息，请重新登录后再试");
    return;
  }
  dialogSaving.value = true;
  try {
    if (dialogMode.value === "edit" && formulaDialogForm.id) {
      await updateExpenseFormula(formulaDialogForm.id, buildUpdatePayload());
    } else {
      await createExpenseFormula(buildCreatePayload());
    }
    BaseToast.success("保存成功");
    dialogVisible.value = false;
    await reloadFormulas();
  } finally {
    dialogSaving.value = false;
  }
}

async function handleToggleStatus(row: FormulaRow): Promise<void> {
  if (!canToggleFormulaStatus.value || !row || !row.id) return;
  const active = isActiveFormula(row);
  const actionText = active ? "禁用" : "启用";
  try {
    await openConfirm({
      title: "提示",
      message: `确认${actionText}该公式吗？`,
      type: "warning",
    });
    if (active) {
      await disableExpenseFormula(row.id);
    } else {
      await enableExpenseFormula(row.id);
    }
    BaseToast.success(`${actionText}成功`);
    await reloadFormulas();
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      throw error;
    }
  }
}

async function handleDelete(row: FormulaRow): Promise<void> {
  if (!canDeleteFormula.value || !row || !row.id) return;
  try {
    await openConfirm({
      title: "提示",
      message: `确认删除公式"${row.formulaName}"吗？如果已被模板引用，后端会拒绝删除，请改为禁用。`,
      type: "warning",
    });
    await deleteExpenseFormula(row.id);
    BaseToast.success("删除成功");
    await reloadFormulas();
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      throw error;
    }
  }
}

</script>

<style scoped>
.formula-list-actions {
  justify-content: flex-start;
  width: auto;
}

.formula-edit-section {
  padding: 8px 0 0;
}

.formula-edit-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: #606266;
}

.formula-edit-section__title {
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.formula-edit-section__desc {
  font-size: 13px;
  color: #909399;
}

.formula-edit-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.formula-source-panels {
  display: grid;
  grid-template-columns: minmax(250px, 350px) 188px;
  gap: 12px;
  margin-bottom: 12px;
}

.formula-parameter-panel,
.formula-constant-panel {
  min-height: 150px;
  padding: 11px;
  border: 1px solid #e4e7ed;
  background: linear-gradient(180deg, #fbfdff 0%, #f7f9fc 100%);
}

.formula-constant-panel {
  border-color: #dfe8f5;
  background: linear-gradient(180deg, #f7fbff 0%, #eef5ff 100%);
}

.formula-source-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.formula-source-panel__head .formula-preview-title {
  margin-bottom: 0;
}

.formula-source-panel__empty {
  display: flex;
  align-items: center;
  min-height: 82px;
  padding: 0 10px;
  border: 1px dashed #dcdfe6;
  background: #fff;
  color: #909399;
  line-height: 32px;
}

.formula-parameter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.formula-parameter-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  min-height: 36px;
  padding: 4px 9px;
  border: 1px solid #e4e7ed;
  background: #fff;
}

.formula-parameter-item__insert {
  min-width: 58px;
}

.formula-constant-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.formula-constant-btn {
  width: 100%;
  min-height: 34px;
  margin: 0;
  border-color: #cdddf2;
  background: #fff;
  color: #409eff;
  font-size: 16px;
  font-weight: 600;
}

.formula-constant-grid .el-button + .el-button {
  margin-left: 0;
}

.formula-edit-toolbar__btn {
  min-width: 48px;
}

.formula-edit-toolbar__btn--wide {
  min-width: 92px;
}

.formula-preview-title {
  margin-bottom: 8px;
  color: #606266;
  font-size: 14px;
  font-weight: 600;
}

.formula-token-editor {
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #303133;
  line-height: 1.8;
}

.formula-token-editor__placeholder {
  color: #c0c4cc;
}

.formula-token-editor__text {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  word-break: break-all;
}

.formula-parameter-token {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 9px;
  border: 1px solid #c6e2ff;
  background: #ecf5ff;
  color: #409eff;
}

.formula-constant-token {
  display: inline-flex;
  align-items: center;
  min-width: 26px;
  min-height: 26px;
  justify-content: center;
  border: 1px solid #d9ecff;
  background: #f4f9ff;
  color: #337ecc;
  font-weight: 600;
}

.formula-operator-token {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
}

@media (max-width: 900px) {
  .formula-source-panels {
    grid-template-columns: 1fr;
  }

  .formula-parameter-panel,
  .formula-constant-panel {
    min-height: 0;
  }
}
</style>
