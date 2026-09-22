/* eslint-disable @typescript-eslint/no-explicit-any -- 历史代码大量使用 any，待后续逐步收敛类型 */
import { safeText } from "@/utils/revenue-helpers";
import { resolveFlowStageActionPermission } from "@/pages/revenue/permissions";
import type {
  AuditAccess,
  AuditAccessPolicy,
  AuditDomain,
  AuditRowScope,
  FlowStageCode,
  RevenueDimensionMode,
  RevenueInputScope,
  RevenueModuleCode,
  RevenueValueSource,
} from "@/types/revenue";

// ============================================================
// Constants
// ============================================================

export const AUDIT_DOMAIN = Object.freeze({
  SUBTABLE: "subtable" as AuditDomain,
  MAIN_TABLE: "main" as AuditDomain,
});

export const WORKFLOW_STAGE_FLOW: readonly FlowStageCode[] = Object.freeze([
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S8",
]);

export const REVENUE_MODULE_CODE = Object.freeze({
  SALES_VOLUME: "sales_volume" as RevenueModuleCode,
  PRODUCT_COMPETITIVENESS: "product_competitiveness" as RevenueModuleCode,
  PROMOTION_BUSINESS: "promotion_business" as RevenueModuleCode,
  SALES_EXPENSE: "sales_expense" as RevenueModuleCode,
  VARIABLE_MANUFACTURING_COST:
    "variable_manufacturing_cost" as RevenueModuleCode,
  FIXED_COST_STANDARD: "fixed_cost_standard" as RevenueModuleCode,
  MATERIAL_COST: "material_cost" as RevenueModuleCode,
  PERIOD_EXPENSE: "period_expense" as RevenueModuleCode,
  RND_EXPENSE: "rnd_expense" as RevenueModuleCode,
  MAIN_PNL: "main_pnl" as RevenueModuleCode,
  VALVE_SUMMARY: "valve_summary" as RevenueModuleCode,
});

export const REVENUE_MODULE_NAME_ALIASES: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  [REVENUE_MODULE_CODE.SALES_VOLUME]: ["销量表"],
  [REVENUE_MODULE_CODE.PRODUCT_COMPETITIVENESS]: [
    "产品竞争力分析",
    "产品竞争力分析（竞品1）",
  ],
  [REVENUE_MODULE_CODE.PROMOTION_BUSINESS]: ["促销商务政策", "促销及商务政策"],
  [REVENUE_MODULE_CODE.SALES_EXPENSE]: ["销售费用"],
  [REVENUE_MODULE_CODE.VARIABLE_MANUFACTURING_COST]: ["变动制造费用"],
  [REVENUE_MODULE_CODE.FIXED_COST_STANDARD]: ["固定费用标准"],
  [REVENUE_MODULE_CODE.MATERIAL_COST]: ["材料成本"],
  [REVENUE_MODULE_CODE.PERIOD_EXPENSE]: ["其他固定费用", "期间费用"],
  [REVENUE_MODULE_CODE.RND_EXPENSE]: ["研发投资", "研发费用"],
  [REVENUE_MODULE_CODE.MAIN_PNL]: ["主表", "单车收益", "项目利润"],
  [REVENUE_MODULE_CODE.VALVE_SUMMARY]: ["汇总表", "汇总表-阀点自动生成"],
});

export const REVENUE_CALCULATION_ORDER: readonly RevenueModuleCode[] =
  Object.freeze([
    REVENUE_MODULE_CODE.SALES_VOLUME,
    REVENUE_MODULE_CODE.PRODUCT_COMPETITIVENESS,
    REVENUE_MODULE_CODE.PROMOTION_BUSINESS,
    REVENUE_MODULE_CODE.MATERIAL_COST,
    REVENUE_MODULE_CODE.VARIABLE_MANUFACTURING_COST,
    REVENUE_MODULE_CODE.SALES_EXPENSE,
    REVENUE_MODULE_CODE.PERIOD_EXPENSE,
    REVENUE_MODULE_CODE.RND_EXPENSE,
    REVENUE_MODULE_CODE.MAIN_PNL,
    REVENUE_MODULE_CODE.VALVE_SUMMARY,
  ]);

export const REVENUE_INPUT_SCOPE = Object.freeze({
  ALL: "all" as RevenueInputScope,
  FIRST_YEAR_ONLY: "first_year_only" as RevenueInputScope,
  YEAR_INDEPENDENT: "year_independent" as RevenueInputScope,
  READONLY: "readonly" as RevenueInputScope,
});

export const REVENUE_DIMENSION_MODE = Object.freeze({
  YEAR_TRIM: "year_trim" as RevenueDimensionMode,
  YEAR_ONLY: "year_only" as RevenueDimensionMode,
});

export const REVENUE_MODULE_DIMENSION_MODE: Readonly<Record<string, string>> =
  Object.freeze({});

export const REVENUE_SUBJECT_SAVE_POLICY = Object.freeze({
  SUBJECT_CELL: "subject_cell",
  DISPLAY_ONLY: "display_only",
});

export const REVENUE_VALUE_SOURCE = Object.freeze({
  INPUT: "input" as RevenueValueSource,
  FORMULA: "formula" as RevenueValueSource,
  LINKED: "linked" as RevenueValueSource,
  DERIVED: "derived" as RevenueValueSource,
  EXTERNAL: "external" as RevenueValueSource,
});

export const REVENUE_PARENT_SUBJECT_DISPLAY_META: Readonly<
  Record<
    string,
    Readonly<{
      displayMode: string;
      rollupFormula?: string;
      rollupScope?: string;
    }>
  >
> = Object.freeze({
  研发直接投资: Object.freeze({
    displayMode: "displayRollup",
    rollupFormula: "sum",
    rollupScope: "directChildren",
  }),
  "研发直接投资/车型投资": Object.freeze({
    displayMode: "displayRollup",
    rollupFormula: "sum",
  }),
  "研发直接投资/人工成本": Object.freeze({
    displayMode: "displayRollup",
    rollupFormula: "sum",
  }),
  研发间接费用: Object.freeze({
    displayMode: "displayRollup",
    rollupFormula: "sum",
  }),
  年款及中期改款: Object.freeze({
    displayMode: "displayRollup",
    rollupFormula: "sum",
  }),
});

export const AUDIT_ACCESS = Object.freeze({
  NONE: "none" as AuditAccess,
  VIEW: "view" as AuditAccess,
  AUDIT: "audit" as AuditAccess,
});

export const AUDIT_ROW_SCOPE = Object.freeze({
  NONE: "none" as AuditRowScope,
  ALL: "all" as AuditRowScope,
  RESPONSIBLE_SUBJECTS: "responsibleSubjects" as AuditRowScope,
});

// ============================================================
// Internal helpers
// ============================================================

const ALL_PERMISSION = "*:*:*";

const MAIN_TABLE_STAGE_LIST: readonly FlowStageCode[] = Object.freeze([
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
]);

const DEFAULT_AUDIT_ACCESS_POLICY: AuditAccessPolicy = Object.freeze({
  access: AUDIT_ACCESS.NONE,
  rowScope: AUDIT_ROW_SCOPE.NONE,
  canSubmit: false,
  canRecalculate: false,
  showScopeSwitch: false,
});

interface BuildPolicyExtras {
  canSubmit?: boolean;
  canRecalculate?: boolean;
  canWriteOpinion?: boolean;
  canApproveS5?: boolean;
  showScopeSwitch?: boolean;
}

function buildViewPolicy(domain: string): Partial<AuditAccessPolicy> {
  return {
    access: AUDIT_ACCESS.VIEW,
    rowScope:
      domain === AUDIT_DOMAIN.MAIN_TABLE
        ? AUDIT_ROW_SCOPE.ALL
        : AUDIT_ROW_SCOPE.RESPONSIBLE_SUBJECTS,
  };
}

function buildAuditPolicy(
  domain: string,
  extras: BuildPolicyExtras = {},
): Partial<AuditAccessPolicy> {
  return {
    access: AUDIT_ACCESS.AUDIT,
    rowScope:
      domain === AUDIT_DOMAIN.MAIN_TABLE
        ? AUDIT_ROW_SCOPE.ALL
        : AUDIT_ROW_SCOPE.RESPONSIBLE_SUBJECTS,
    ...extras,
  };
}

function normalizeRevenuePathText(value = ""): string {
  return safeText(value)
    .replace(/[\\]+/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function normalizeFormulaText(value = ""): string {
  return safeText(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/^\s*=/, "")
    .replace(/\s+/g, "");
}

interface FormulaBinding {
  paramCode?: string;
  parameterCode?: string;
  parameterKey?: string;
  param?: string;
  key?: string;
  code?: string;
  paramName?: string;
  parameterName?: string;
  parameterLabel?: string;
  label?: string;
  name?: string;
  subjectId?: string;
  sourceSubjectId?: string;
  templateSubjectId?: string;
  expenseSubjectId?: string;
  refSubjectId?: string;
  sourceId?: string;
  subjectCode?: string;
  subjectPath?: string;
  sourceSubjectPath?: string;
  fullNamePath?: string;
  path?: string;
  subjectName?: string;
  moduleCode?: string;
  moduleName?: string;
  subtable?: string;
}

export interface FormulaRow {
  templateItem?: Record<string, unknown>;
  subjectId?: string;
  templateSubjectId?: string;
  expenseSubjectId?: string;
  subjectCode?: string;
  id?: string;
  rowId?: string;
  templateEntryMode?: string;
  entryMode?: string;
  formulaParamBindings?: FormulaBinding[] | string;
  formulaExpression?: string;
  expression?: string;
  valueSource?: string;
  sourceType?: string;
  rowKind?: string;
  rowType?: string;
  inputType?: string;
  calculated?: boolean;
  mainReviewable?: boolean;
  reviewableInMain?: boolean;
  moduleCode?: string;
  moduleName?: string;
  subtable?: string;
  rootSubjectName?: string;
  fullNamePath?: string;
  subjectPath?: string;
  fullPath?: string;
  path?: string;
}

function parseFormulaParamBindings(
  value: FormulaBinding[] | string | null | undefined,
): FormulaBinding[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getFormulaParamCode(binding: FormulaBinding = {}, index = 0): string {
  return safeText(
    binding.paramCode ||
      binding.parameterCode ||
      binding.parameterKey ||
      binding.param ||
      binding.key ||
      binding.code ||
      binding.paramName ||
      binding.parameterName ||
      binding.parameterLabel ||
      binding.label ||
      binding.name,
    `P${index + 1}`,
  );
}

function normalizeDirectReferenceExpression(
  value = "",
  binding: FormulaBinding = {},
  index = 0,
): boolean {
  let text = normalizeFormulaText(value);
  while (text.startsWith("(") && text.endsWith(")") && text.length > 2) {
    text = text.slice(1, -1);
  }
  const tokenMatch = text.match(/^\$\{([^}]+)\}$/);
  const token = tokenMatch ? tokenMatch[1] : text;
  return token === normalizeFormulaText(getFormulaParamCode(binding, index));
}

function collectFormulaRowIdentityValues(row: FormulaRow = {}): string[] {
  const item =
    row && row.templateItem && typeof row.templateItem === "object"
      ? row.templateItem
      : {};
  return [
    row.subjectId,
    row.templateSubjectId,
    row.expenseSubjectId,
    row.subjectCode,
    item.subjectId as string,
    item.subjectCode as string,
  ]
    .map((v) => safeText(v))
    .filter(Boolean);
}

function collectFormulaBindingSubjectIds(
  binding: FormulaBinding = {},
): string[] {
  return [
    binding.subjectId,
    binding.sourceSubjectId,
    binding.templateSubjectId,
    binding.expenseSubjectId,
    binding.refSubjectId,
    binding.sourceId,
    binding.subjectCode,
  ]
    .map((v) => safeText(v))
    .filter(Boolean);
}

function collectFormulaBindingPathCandidates(
  binding: FormulaBinding = {},
): string[] {
  return [
    binding.subjectPath,
    binding.sourceSubjectPath,
    binding.fullNamePath,
    binding.path,
    binding.subjectName,
  ]
    .map((v) => safeText(v))
    .filter(Boolean);
}

interface SourceLike {
  moduleCode?: string;
  moduleName?: string;
  subtable?: string;
  rootSubjectName?: string;
  fullNamePath?: string;
  subjectPath?: string;
  fullPath?: string;
  path?: string;
}

function isMainTableLike(source: SourceLike = {}): boolean {
  if (!source || typeof source !== "object") return false;
  if (
    safeText(source.moduleCode).toLowerCase() === REVENUE_MODULE_CODE.MAIN_PNL
  )
    return true;
  const moduleName = safeText(
    source.moduleName || source.subtable || source.rootSubjectName,
  );
  if (
    (REVENUE_MODULE_NAME_ALIASES[REVENUE_MODULE_CODE.MAIN_PNL] || []).includes(
      moduleName,
    )
  )
    return true;
  const path = normalizeRevenuePathText(
    source.fullNamePath || source.subjectPath || source.fullPath || source.path,
  );
  return (
    path === "主表" ||
    path.startsWith("主表/") ||
    path.startsWith("单车收益/") ||
    path.startsWith("项目利润/")
  );
}

function findFormulaBindingSourceRow(
  binding: FormulaBinding = {},
  rows: FormulaRow[] = [],
): FormulaRow | null {
  const subjectIds = collectFormulaBindingSubjectIds(binding);
  if (subjectIds.length) {
    const hit = (Array.isArray(rows) ? rows : []).find((row) => {
      const rowKeys = collectFormulaRowIdentityValues(row);
      return subjectIds.some((id) => rowKeys.includes(id));
    });
    if (hit) return hit;
  }

  const pathCandidates = collectFormulaBindingPathCandidates(binding).map(
    normalizeRevenuePathText,
  );
  if (!pathCandidates.length) return null;
  return (
    (Array.isArray(rows) ? rows : []).find((row) => {
      const rowPath = normalizeRevenuePathText(
        row.fullNamePath || row.subjectPath || row.fullPath || row.path,
      );
      return !!rowPath && pathCandidates.includes(rowPath);
    }) || null
  );
}

interface DirectRefOptions {
  rows?: FormulaRow[];
}

function isDirectSubtableReferenceMainFormulaRow(
  row: FormulaRow = {},
  options: DirectRefOptions = {},
): boolean {
  if (!isMainTableLike(row)) return false;
  const entryMode = safeText(
    row.templateEntryMode ||
      row.entryMode ||
      (row.templateItem && (row.templateItem.entryMode as string)),
  ).toUpperCase();
  if (entryMode !== "CALCULATED") return false;
  const bindings = parseFormulaParamBindings(row.formulaParamBindings);
  if (bindings.length !== 1) return false;
  if (
    !normalizeDirectReferenceExpression(
      row.formulaExpression || row.expression,
      bindings[0],
      0,
    )
  )
    return false;

  const sourceRow = findFormulaBindingSourceRow(bindings[0], options.rows);
  if (sourceRow) return !isMainTableLike(sourceRow);

  const bindingPaths = collectFormulaBindingPathCandidates(bindings[0]);
  if (
    !bindingPaths.length &&
    !safeText(
      bindings[0].moduleCode || bindings[0].moduleName || bindings[0].subtable,
    )
  ) {
    return false;
  }
  return !isMainTableLike({
    moduleCode: bindings[0].moduleCode,
    moduleName: bindings[0].moduleName,
    subtable: bindings[0].subtable,
    fullNamePath: bindingPaths[0],
  });
}

// ============================================================
// Public API
// ============================================================

export function resolveRevenueModuleCodeByPath(path = ""): string {
  const normalizedPath = normalizeRevenuePathText(path);
  const moduleCode = Object.keys(REVENUE_MODULE_NAME_ALIASES).find(
    (candidateCode) =>
      (REVENUE_MODULE_NAME_ALIASES[candidateCode] || []).some((alias) => {
        const normalizedAlias = normalizeRevenuePathText(alias);
        return (
          normalizedPath === normalizedAlias ||
          normalizedPath.startsWith(`${normalizedAlias}/`)
        );
      }),
  );
  return moduleCode || "";
}

export function resolveRevenueDimensionMode(source: SourceLike = {}): string {
  const sourceObject = source && typeof source === "object" ? source : {};
  const moduleText = [
    sourceObject.moduleCode,
    (sourceObject as Record<string, unknown>).name,
    sourceObject.moduleName,
    sourceObject.rootSubjectName,
    sourceObject.subtable,
    sourceObject.fullNamePath,
    sourceObject.subjectPath,
    (sourceObject as Record<string, unknown>).subject,
    (sourceObject as Record<string, unknown>).subjectName,
    Array.isArray((sourceObject as Record<string, unknown>).rootPath)
      ? ((sourceObject as Record<string, unknown>).rootPath as string[]).join(
          "/",
        )
      : "",
  ]
    .filter(Boolean)
    .join("/");
  const moduleCode =
    sourceObject.moduleCode || resolveRevenueModuleCodeByPath(moduleText);
  return (
    REVENUE_MODULE_DIMENSION_MODE[moduleCode] ||
    REVENUE_DIMENSION_MODE.YEAR_TRIM
  );
}

export function isRevenueYearOnlyRow(source: any = {}): boolean {
  return (
    resolveRevenueDimensionMode(source) === REVENUE_DIMENSION_MODE.YEAR_ONLY
  );
}

export function resolveRevenueModuleTitleNotice(
  module: Record<string, unknown> = {},
): string {
  const source = module && typeof module === "object" ? module : {};
  const moduleText = [
    source.moduleCode,
    source.name,
    source.moduleName,
    source.rootSubjectName,
    source.subtable,
    Array.isArray(source.rootPath)
      ? (source.rootPath as string[]).join("/")
      : "",
  ]
    .filter(Boolean)
    .join("/");
  const moduleCode =
    (source.moduleCode as string) || resolveRevenueModuleCodeByPath(moduleText);
  if (moduleCode === REVENUE_MODULE_CODE.SALES_EXPENSE) {
    return "注意：按不含税口径填报";
  }
  return "";
}

export function normalizeStageCode(stageCode?: string | null): FlowStageCode {
  const raw = safeText(stageCode, "S1");
  const upper = raw.toUpperCase();
  if ((WORKFLOW_STAGE_FLOW as readonly string[]).includes(upper))
    return upper as FlowStageCode;
  return "S1";
}

export function formatStageCode(stageCode?: string | null): FlowStageCode {
  return normalizeStageCode(stageCode);
}

export function getNextStageCode(stageCode?: string | null): FlowStageCode {
  const normalized = normalizeStageCode(stageCode);
  const index = WORKFLOW_STAGE_FLOW.indexOf(normalized);
  if (index < 0) return "S2";
  return WORKFLOW_STAGE_FLOW[
    Math.min(index + 1, WORKFLOW_STAGE_FLOW.length - 1)
  ];
}

export function resolveAuditDomain(preferredDomain = ""): string {
  const preferred = safeText(preferredDomain, "").toLowerCase();
  if (
    preferred === AUDIT_DOMAIN.MAIN_TABLE ||
    preferred === AUDIT_DOMAIN.SUBTABLE
  ) {
    return preferred;
  }
  return AUDIT_DOMAIN.SUBTABLE;
}

function resolveStageDomain(
  stageCode?: string | null,
  preferredDomain = "",
): string {
  const preferred = safeText(preferredDomain, "").toLowerCase();
  if (
    preferred === AUDIT_DOMAIN.MAIN_TABLE ||
    preferred === AUDIT_DOMAIN.SUBTABLE
  ) {
    return preferred;
  }
  const normalizedStageCode = normalizeStageCode(stageCode);
  return MAIN_TABLE_STAGE_LIST.includes(normalizedStageCode)
    ? AUDIT_DOMAIN.MAIN_TABLE
    : resolveAuditDomain(preferredDomain);
}

function actionPermission(
  stageCode?: string | null,
  actionKey?: string,
): string {
  return resolveFlowStageActionPermission(stageCode, actionKey);
}

function matchesPermission(
  permissionKey: string,
  stageCode?: string | null,
  actionKey?: string,
): boolean {
  const normalized = safeText(permissionKey);
  if (!normalized) return false;
  if (normalized === ALL_PERMISSION) return true;
  return normalized === actionPermission(stageCode, actionKey);
}

interface AuditAccessParams {
  permissionKey?: string;
  stageCode?: string | null;
  domain?: string;
}

export function resolveRevenueAuditAccess(
  params: AuditAccessParams,
): AuditAccessPolicy {
  const { permissionKey, stageCode, domain } = params;
  const normalizedStageCode = normalizeStageCode(stageCode);
  const normalizedDomain = resolveStageDomain(normalizedStageCode, domain);
  const normalizedPermission = safeText(permissionKey);

  if (normalizedPermission === ALL_PERMISSION) {
    return {
      ...DEFAULT_AUDIT_ACCESS_POLICY,
      ...buildAuditPolicy(normalizedDomain, {
        canSubmit: true,
        canRecalculate: true,
        canWriteOpinion: true,
        canApproveS5: normalizedStageCode === "S5",
        showScopeSwitch: normalizedDomain === AUDIT_DOMAIN.MAIN_TABLE,
      }),
    } as AuditAccessPolicy;
  }

  if (matchesPermission(normalizedPermission, normalizedStageCode, "view")) {
    return {
      ...DEFAULT_AUDIT_ACCESS_POLICY,
      ...buildViewPolicy(normalizedDomain),
    } as AuditAccessPolicy;
  }

  if (
    normalizedDomain === AUDIT_DOMAIN.SUBTABLE &&
    (matchesPermission(normalizedPermission, normalizedStageCode, "fill") ||
      matchesPermission(normalizedPermission, normalizedStageCode, "confirm") ||
      matchesPermission(normalizedPermission, normalizedStageCode, "review"))
  ) {
    return {
      ...DEFAULT_AUDIT_ACCESS_POLICY,
      ...buildAuditPolicy(normalizedDomain, {
        canSubmit: matchesPermission(
          normalizedPermission,
          normalizedStageCode,
          "review",
        ),
      }),
    } as AuditAccessPolicy;
  }

  if (
    normalizedDomain === AUDIT_DOMAIN.MAIN_TABLE &&
    (matchesPermission(normalizedPermission, normalizedStageCode, "review") ||
      matchesPermission(
        normalizedPermission,
        normalizedStageCode,
        "select_main",
      ) ||
      matchesPermission(normalizedPermission, normalizedStageCode, "edit") ||
      matchesPermission(
        normalizedPermission,
        normalizedStageCode,
        "start_meeting",
      ))
  ) {
    return {
      ...DEFAULT_AUDIT_ACCESS_POLICY,
      ...buildAuditPolicy(normalizedDomain, {
        canSubmit: true,
        showScopeSwitch: (["S4", "S6"] as string[]).includes(
          normalizedStageCode,
        ),
      }),
    } as AuditAccessPolicy;
  }

  if (
    normalizedDomain === AUDIT_DOMAIN.MAIN_TABLE &&
    matchesPermission(normalizedPermission, normalizedStageCode, "approve")
  ) {
    return {
      ...DEFAULT_AUDIT_ACCESS_POLICY,
      ...buildViewPolicy(normalizedDomain),
      canSubmit: true,
      canWriteOpinion: true,
      canApproveS5: true,
    } as AuditAccessPolicy;
  }

  if (matchesPermission(normalizedPermission, normalizedStageCode, "submit")) {
    return {
      ...DEFAULT_AUDIT_ACCESS_POLICY,
      ...buildViewPolicy(normalizedDomain),
      canSubmit: true,
    } as AuditAccessPolicy;
  }

  return { ...DEFAULT_AUDIT_ACCESS_POLICY };
}

export function canViewAuditWorkbench(params: AuditAccessParams): boolean {
  const policy = resolveRevenueAuditAccess(params);
  return (
    policy.access === AUDIT_ACCESS.VIEW || policy.access === AUDIT_ACCESS.AUDIT
  );
}

export function canEditAuditDomain(permissionKey = "", domain = ""): boolean {
  const normalizedDomain = resolveAuditDomain(domain);
  return WORKFLOW_STAGE_FLOW.some((stageCode) => {
    const policy = resolveRevenueAuditAccess({
      permissionKey,
      stageCode,
      domain: normalizedDomain,
    });
    return policy.access === AUDIT_ACCESS.AUDIT;
  });
}

function getEditableStageList(
  permissionKey: string,
  domain: string,
): FlowStageCode[] {
  const normalizedDomain = resolveAuditDomain(domain);
  return WORKFLOW_STAGE_FLOW.filter((stageCode) => {
    const policy = resolveRevenueAuditAccess({
      permissionKey,
      stageCode,
      domain: normalizedDomain,
    });
    return policy.access === AUDIT_ACCESS.AUDIT;
  });
}

export function isEditableAuditStage(
  stageCode?: string | null,
  domain = "",
  permissionKey = "",
): boolean {
  const normalizedStageCode = normalizeStageCode(stageCode);
  const list = getEditableStageList(permissionKey, domain);
  return list.includes(normalizedStageCode);
}

export function canEditAuditWorkbench(params: AuditAccessParams): boolean {
  const policy = resolveRevenueAuditAccess(params);
  return policy.access === AUDIT_ACCESS.AUDIT;
}

export function getAuditDetailPathByPermission(domain: string): string {
  return resolveAuditDomain(domain) === AUDIT_DOMAIN.MAIN_TABLE
    ? "/revenue/main-table-audit-detail"
    : "/revenue/subtable-audit-detail";
}

interface ReviewableOptions {
  allowDirectMainReference?: boolean;
  includeCalculatedFlag?: boolean;
  rows?: FormulaRow[];
  expandLegacyDefault?: boolean;
}

function isCalculatedAuditValueRow(
  row: FormulaRow = {},
  options: ReviewableOptions = {},
): boolean {
  if (
    options.allowDirectMainReference === true &&
    isDirectSubtableReferenceMainFormulaRow(row, options)
  ) {
    return false;
  }
  const source = safeText(
    row && (row.valueSource || row.sourceType),
  ).toLowerCase();
  const rowKind = safeText(row && (row.rowKind || row.rowType)).toLowerCase();
  const inputType = safeText(row && row.inputType).toLowerCase();
  if (["formula", "rowsubtotal", "displayaggregate"].includes(rowKind))
    return true;
  if (["formula", "calculation", "computed"].includes(source)) return true;
  if (["calc", "formula"].includes(inputType)) return true;
  return (
    options.includeCalculatedFlag === true && row && row.calculated === true
  );
}

export function isReviewableAuditValueSource(
  domain: string,
  row: FormulaRow = {},
  options: ReviewableOptions = {},
): boolean {
  const normalizedDomain = resolveAuditDomain(domain);
  const source = safeText(
    row && (row.valueSource || row.sourceType),
  ).toLowerCase();
  const rowKind = safeText(row && (row.rowKind || row.rowType)).toLowerCase();
  if (normalizedDomain === AUDIT_DOMAIN.SUBTABLE) {
    if (isCalculatedAuditValueRow(row, { includeCalculatedFlag: true }))
      return false;
    return source === "input" || (!source && rowKind === "input");
  }
  if (normalizedDomain === AUDIT_DOMAIN.MAIN_TABLE) {
    if (isDirectSubtableReferenceMainFormulaRow(row, options)) return true;
    if (row && (row.mainReviewable === true || row.reviewableInMain === true)) {
      if (
        isCalculatedAuditValueRow(row, {
          ...options,
          includeCalculatedFlag: true,
        })
      )
        return false;
      return source === "input" || (!source && rowKind === "input");
    }
    if (
      isCalculatedAuditValueRow(row, {
        ...options,
        allowDirectMainReference: true,
      })
    )
      return false;
    return [
      "linked",
      "external",
      "fromsubtable",
      "subtable",
      "derivedfromsubtable",
    ].includes(source);
  }
  return false;
}
