import {
  DEFAULT_LIFECYCLE_WEIGHT_SOURCE_PATH,
  REVENUE_ROW_KIND,
  isForcedRatioAggregateRow,
  isMainProjectProfitAmountSumRow,
  isManualFeeRateRatioLabelRow,
} from "./matrix-utils";
import {
  REVENUE_INPUT_SCOPE,
  REVENUE_MODULE_NAME_ALIASES,
  REVENUE_SUBJECT_SAVE_POLICY,
  REVENUE_VALUE_SOURCE,
  resolveRevenueModuleCodeByPath,
} from "./domain-config";
import { resolveMaterialDesignCostInputScope } from "./material-design-cost";

export const REVENUE_TEMPLATE_META = Object.freeze(
  Object.keys(REVENUE_MODULE_NAME_ALIASES).map((moduleCode) =>
    Object.freeze({
      moduleCode,
      moduleName: REVENUE_MODULE_NAME_ALIASES[moduleCode][0],
      aliases: REVENUE_MODULE_NAME_ALIASES[moduleCode].slice(),
      defaultRowKind: REVENUE_ROW_KIND.INPUT,
      defaultInputScope: REVENUE_INPUT_SCOPE.ALL,
      savePolicy: REVENUE_SUBJECT_SAVE_POLICY.SUBJECT_CELL,
    })
  )
);

export const REVENUE_STAGE_MAIN_TABLE_RULES = Object.freeze({
  S1: {
    title: "业务经理填报后自动计算主表",
    source: "业务经理填报子表真实科目值",
    autoCalculateMainTable: true,
  },
  S2: {
    title: "集团部室审核意见值驱动主表",
    source: "集团部室审核子表意见值 + 未调整原值",
    autoCalculateMainTable: true,
  },
  S3: {
    title: "业务经理二次确认候选值驱动主表",
    source: "业务经理采纳值或修正值",
    autoCalculateMainTable: true,
  },
  S4: {
    title: "二级公司财务主表审核",
    source: "S3 业务经理二次确认后主表候选值",
    autoCalculateMainTable: false,
  },
  S5: {
    title: "二级公司最终提交",
    source: "二级公司候选值集合",
    autoCalculateMainTable: false,
  },
  S6: {
    title: "集团财务审核",
    source: "二级公司候选值 + 集团部室候选值",
    autoCalculateMainTable: false,
    parallelWithGroupDepartment: true,
  },
  S7: {
    title: "会前窗口期调值复算与冻结",
    source: "S6 集团财务审核后候选值集合",
    autoCalculateMainTable: true,
  },
  S8: {
    title: "集团上会评审与定值",
    source: "冻结候选值、上会新增值或最终选定值",
    autoCalculateMainTable: false,
  },
});

function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

function normalizePathText(value) {
  return safeText(value)
    .replace(/\\/g, "/")
    .replace(/\s+/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function getRowPath(row = {}) {
  const path = row.fullNamePath || row.subjectPath || row.path || row.subjectName || row.subject;
  if (Array.isArray(path)) return path.map((item) => safeText(item)).filter(Boolean).join("/");
  return safeText(path);
}

function normalizeBackendEntryMode(value) {
  const mode = safeText(value).toUpperCase();
  return ["MANUAL", "CALCULATED", "DATA_QUERY", "DERIVED"].includes(mode) ? mode : "";
}

function getBackendTemplateItem(row = {}) {
  return row && row.templateItem && typeof row.templateItem === "object"
    ? row.templateItem
    : null;
}

function getBackendTemplateEntryMode(row = {}) {
  const item = getBackendTemplateItem(row);
  return normalizeBackendEntryMode(
    (item && item.entryMode) ||
      row.templateEntryMode ||
      row.entryMode
  );
}

function rowKindFromBackendEntryMode(entryMode) {
  if (entryMode === "CALCULATED") return REVENUE_ROW_KIND.FORMULA;
  if (entryMode === "DERIVED") return REVENUE_ROW_KIND.FORMULA;
  if (entryMode === "DATA_QUERY") return REVENUE_ROW_KIND.LINKED;
  return REVENUE_ROW_KIND.INPUT;
}

function valueSourceFromBackendEntryMode(entryMode) {
  if (entryMode === "CALCULATED") return REVENUE_VALUE_SOURCE.FORMULA;
  if (entryMode === "DERIVED") return REVENUE_VALUE_SOURCE.DERIVED;
  if (entryMode === "DATA_QUERY") return REVENUE_VALUE_SOURCE.LINKED;
  return REVENUE_VALUE_SOURCE.INPUT;
}

function resolveBackendTemplateMeta(row = {}) {
  const entryMode = getBackendTemplateEntryMode(row);
  if (!entryMode) return null;
  const item = getBackendTemplateItem(row);
  const rowKind = rowKindFromBackendEntryMode(entryMode);
  const formulaCode = entryMode === "CALCULATED"
    ? safeText((item && item.formulaCode) || row.formulaCode || row.formulaKey)
    : "";
  const formulaExpression = entryMode === "CALCULATED"
    ? safeText((item && item.formulaExpression) || row.formulaExpression || row.expression)
    : "";
  const defaultInputScope = entryMode === "MANUAL" ? REVENUE_INPUT_SCOPE.ALL : REVENUE_INPUT_SCOPE.READONLY;
  return {
    entryMode,
    rowKind,
    // 设计成本：MANUAL 但仅首年可填，其它 MANUAL 仍为 all
    inputScope: resolveMaterialDesignCostInputScope(row, defaultInputScope),
    formulaKey: formulaCode,
    formulaCode,
    formulaId: entryMode === "CALCULATED" ? ((item && item.formulaId) || row.formulaId) : undefined,
    formulaText: entryMode === "CALCULATED"
      ? safeText((item && item.formulaName) || row.formulaText)
      : "",
    formulaExpression,
    formulaParamBindings: entryMode === "CALCULATED"
      ? (
          Array.isArray(item && item.formulaParamBindings)
            ? item.formulaParamBindings
            : Array.isArray(row.formulaParamBindings)
              ? row.formulaParamBindings
              : []
        )
      : [],
    valueSource: valueSourceFromBackendEntryMode(entryMode),
    readonly: entryMode !== "MANUAL" || row.readonly === true || row.editable === false,
    calculated: entryMode !== "MANUAL",
  };
}

export function getRevenueTemplateModule(moduleCode = "") {
  return REVENUE_TEMPLATE_META.find((item) => item.moduleCode === moduleCode) || null;
}

export function resolveRevenueRowKind(row = {}) {
  const backendMeta = resolveBackendTemplateMeta(row);
  if (backendMeta) return backendMeta.rowKind;
  const explicit = String(row.rowKind || row.rowType || "").trim();
  if (explicit) return explicit;
  if (row.calculated) return REVENUE_ROW_KIND.FORMULA;
  if (row.readonly) return REVENUE_ROW_KIND.LINKED;
  return REVENUE_ROW_KIND.INPUT;
}

export function resolveRevenueSavePolicy(row = {}) {
  const rowKind = resolveRevenueRowKind(row);
  if (rowKind === REVENUE_ROW_KIND.DISPLAY_AGGREGATE) {
    return REVENUE_SUBJECT_SAVE_POLICY.DISPLAY_ONLY;
  }
  if (row.savable === false) {
    return REVENUE_SUBJECT_SAVE_POLICY.DISPLAY_ONLY;
  }
  return REVENUE_SUBJECT_SAVE_POLICY.SUBJECT_CELL;
}

export function resolveRevenueInputScope(row = {}) {
  const backendMeta = resolveBackendTemplateMeta(row);
  if (backendMeta) return backendMeta.inputScope;
  const explicit = safeText(row.inputScope);
  if (explicit) {
    return resolveMaterialDesignCostInputScope(row, explicit);
  }
  const rowKind = resolveRevenueRowKind(row);
  if (rowKind !== REVENUE_ROW_KIND.INPUT) return REVENUE_INPUT_SCOPE.READONLY;
  return resolveMaterialDesignCostInputScope(row, REVENUE_INPUT_SCOPE.ALL);
}

export function resolveRevenueAggregateFormula(row = {}) {
  // 仅主表/项目利润 销售收入、边际贡献、营业利润：总额行固定求和
  if (isMainProjectProfitAmountSumRow(row)) return "sum";
  // 手工费率：数值加权（标签在展示层单独显示「比率」）
  if (isManualFeeRateRatioLabelRow(row)) return "weighted_by_mix";
  // 指定比率类科目固定按比率聚合（显示「比率」）
  if (isForcedRatioAggregateRow(row)) return "ratio";
  const explicit = safeText(row.aggregateFormula || row.formulaAggregate);
  if (explicit) return explicit;
  return "weighted_by_mix";
}

export function resolveRevenueLifecycleFormula(row = {}, formulaMeta = null) {
  if (isMainProjectProfitAmountSumRow(row)) return "sum_year";
  if (isManualFeeRateRatioLabelRow(row)) return "volume_weighted";
  if (isForcedRatioAggregateRow(row)) return "ratio";
  const explicit = safeText(
    (formulaMeta && formulaMeta.lifecycleFormula) ||
      row.lifecycleFormula ||
      row.lifecycleAggregateFormula
  );
  if (explicit) return explicit;
  const aggregate = safeText(
    (formulaMeta && formulaMeta.aggregateFormula) ||
      row.aggregateFormula ||
      row.formulaAggregate ||
      resolveRevenueAggregateFormula(row)
  ).toLowerCase();
  if (aggregate === "weighted" || aggregate === "weighted_by_mix") return "volume_weighted";
  if (aggregate === "ratio") return "ratio";
  if (aggregate === "avg" || aggregate === "average") return "avg";
  if (aggregate === "max") return "max";
  if (aggregate === "min") return "min";
  return "sum_year";
}

export function resolveRevenueWeightSourcePath(row = {}, formulaMeta = null) {
  const explicit = safeText((formulaMeta && formulaMeta.weightSourcePath) || row.weightSourcePath);
  if (explicit) return explicit;
  const lifecycleFormula = resolveRevenueLifecycleFormula(row, formulaMeta);
  if (lifecycleFormula === "volume_weighted" || lifecycleFormula === "mix") {
    return DEFAULT_LIFECYCLE_WEIGHT_SOURCE_PATH;
  }
  return "";
}

export function resolveRevenueValueSource(row = {}) {
  const backendMeta = resolveBackendTemplateMeta(row);
  if (backendMeta) return backendMeta.valueSource;
  const explicit = safeText(row.valueSource || row.sourceType);
  if (explicit) return explicit;
  const rowKind = resolveRevenueRowKind(row);
  if (rowKind === REVENUE_ROW_KIND.FORMULA || rowKind === REVENUE_ROW_KIND.ROW_SUBTOTAL) {
    return REVENUE_VALUE_SOURCE.FORMULA;
  }
  if (rowKind === REVENUE_ROW_KIND.LINKED) return REVENUE_VALUE_SOURCE.LINKED;
  if (rowKind === REVENUE_ROW_KIND.EXTERNAL) return REVENUE_VALUE_SOURCE.EXTERNAL;
  return REVENUE_VALUE_SOURCE.INPUT;
}

export function resolveRevenueTemplateRowMeta(row = {}) {
  let path = getRowPath(row);
  let moduleCode = row.moduleCode || resolveRevenueModuleCodeByPath(path);
  const subtable = safeText(row.subtable || row.moduleName);
  if (!moduleCode && subtable) {
    const moduleFromSubtable = resolveRevenueModuleCodeByPath(subtable);
    if (moduleFromSubtable) {
      moduleCode = moduleFromSubtable;
      path = normalizePathText(path).startsWith(normalizePathText(subtable))
        ? path
        : `${subtable}/${path}`;
    }
  }
  const module = getRevenueTemplateModule(moduleCode);
  const backendMeta = resolveBackendTemplateMeta(row);
  const rowKind = resolveRevenueRowKind({ ...row, moduleCode });
  const savePolicy = resolveRevenueSavePolicy({ ...row, rowKind });
  return {
    matched: Boolean(moduleCode),
    moduleCode,
    moduleName: module ? module.moduleName : safeText(row.subtable),
    subjectPath: path,
    subjectName: safeText(row.subjectName || row.subject),
    rowKind,
    inputScope: resolveRevenueInputScope({ ...row, moduleCode, rowKind }),
    formulaKey: backendMeta ? backendMeta.formulaKey : safeText(row.formulaKey || row.formulaCode),
    formulaCode: backendMeta ? backendMeta.formulaCode : safeText(row.formulaCode || row.formulaKey),
    formulaId: backendMeta ? backendMeta.formulaId : row.formulaId,
    formulaText: backendMeta ? backendMeta.formulaText : safeText(row.formulaText),
    formulaExpression: backendMeta
      ? backendMeta.formulaExpression
      : safeText(row.formulaExpression || row.expression),
    formulaParamBindings: backendMeta
      ? backendMeta.formulaParamBindings
      : Array.isArray(row.formulaParamBindings)
        ? row.formulaParamBindings
        : [],
    aggregateFormula: resolveRevenueAggregateFormula(row),
    lifecycleFormula: resolveRevenueLifecycleFormula(row, null),
    weightSourcePath: resolveRevenueWeightSourcePath(row, null),
    ratioNumeratorPath: safeText(row.ratioNumeratorPath),
    ratioDenominatorPath: safeText(row.ratioDenominatorPath),
    savePolicy,
    valueSource: resolveRevenueValueSource({ ...row, moduleCode, rowKind }),
    mainReviewable: Boolean(row.mainReviewable),
  };
}

export function applyRevenueTemplateMeta(row = {}) {
  const meta = resolveRevenueTemplateRowMeta(row);
  const backendMeta = resolveBackendTemplateMeta(row);
  return {
    ...row,
    moduleCode: meta.moduleCode || row.moduleCode || "",
    moduleName: meta.moduleName || row.moduleName || "",
    subjectPath: meta.subjectPath,
    rowKind: meta.rowKind,
    inputScope: meta.inputScope,
    formulaKey: meta.formulaKey || "",
    formulaCode: meta.formulaCode || "",
    formulaId: meta.formulaId,
    formulaText: meta.formulaText || "",
    formulaExpression: meta.formulaExpression || "",
    formulaParamBindings: meta.formulaParamBindings,
    aggregateFormula: meta.aggregateFormula || row.aggregateFormula,
    lifecycleFormula: meta.lifecycleFormula || row.lifecycleFormula || "",
    weightSourcePath: meta.weightSourcePath || row.weightSourcePath || "",
    ratioNumeratorPath: meta.ratioNumeratorPath || row.ratioNumeratorPath || "",
    ratioDenominatorPath: meta.ratioDenominatorPath || row.ratioDenominatorPath || "",
    savePolicy: meta.savePolicy,
    valueSource: meta.valueSource || row.valueSource || REVENUE_VALUE_SOURCE.INPUT,
    mainReviewable: meta.mainReviewable || row.mainReviewable === true,
    reviewableInMain: meta.mainReviewable || row.reviewableInMain === true,
    isRealSubject: row.isRealSubject === false ? false : true,
    savable: meta.savePolicy === REVENUE_SUBJECT_SAVE_POLICY.SUBJECT_CELL,
    calculated: backendMeta ? backendMeta.calculated : meta.rowKind !== REVENUE_ROW_KIND.INPUT,
    readonly: backendMeta ? backendMeta.readonly : meta.rowKind !== REVENUE_ROW_KIND.INPUT || row.readonly === true,
    templateMatched: meta.matched,
  };
}

export function validateRevenueTemplateRows(rows = []) {
  const matched = [];
  const unmatched = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const meta = resolveRevenueTemplateRowMeta(row);
    const item = {
      subjectId: safeText(row.subjectId || row.id),
      subjectName: meta.subjectName,
      subjectPath: meta.subjectPath,
      moduleCode: meta.moduleCode,
      rowKind: meta.rowKind,
      savePolicy: meta.savePolicy,
    };
    if (meta.matched) matched.push(item);
    else unmatched.push(item);
  });
  return { matched, unmatched };
}
