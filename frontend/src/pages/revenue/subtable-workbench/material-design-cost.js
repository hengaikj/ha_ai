import { REVENUE_INPUT_SCOPE, REVENUE_MODULE_CODE } from "./domain-config";

/**
 * 材料成本·设计成本：首年手填、后续年按年降本率递推。
 * 其中 Lisence：首年手填、后续年按「首年 × (1 − 当年年降本率)」强制覆盖（对齐生产）。
 * 仅命中对应叶子科目，不影响其它 MANUAL 科目。
 */
const MATERIAL_DESIGN_COST_INPUT_PATH = "材料成本/设计成本/设计成本";
const MATERIAL_DESIGN_COST_REDUCTION_RATE_PATH = "材料成本/设计成本/年降本率";
const MATERIAL_LISENCE_PATHS = Object.freeze([
  "材料成本/设计成本/其中 Lisence",
  "材料成本/设计成本/其中Lisence",
  "材料成本/设计成本/其中 License",
  "材料成本/设计成本/其中License",
  "设计成本/其中 Lisence",
  "设计成本/其中Lisence",
  "材料成本/lisence",
]);

function safeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

export function normalizeMaterialDesignCostPathText(value) {
  return safeText(value)
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "")
    .replace(/[/\\|｜>＞\-—_]/g, "")
    .toLowerCase();
}

function getMaterialDesignCostRowPath(row = {}) {
  const path =
    row.fullNamePath ||
    row.subjectPath ||
    row.fullPath ||
    row.path ||
    [row.rootSubjectName, row.subtable, row.subjectName || row.subject].filter(Boolean).join("/");
  if (Array.isArray(path)) return path.map((item) => safeText(item)).filter(Boolean).join("/");
  return safeText(path);
}

export function isMaterialCostModuleRow(row = {}) {
  if (!row || typeof row !== "object") return false;
  if (safeText(row.moduleCode) === REVENUE_MODULE_CODE.MATERIAL_COST) return true;
  const moduleNames = [row.moduleName, row.subtable, row.rootSubjectName, row.__moduleRootName]
    .map((item) => safeText(item));
  if (moduleNames.some((item) => item === "材料成本")) return true;
  const path = getMaterialDesignCostRowPath(row)
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
  return /^材料成本(\/|$)/.test(path);
}

/**
 * 设计成本金额叶子（可首年手填），排除 MIX / 小计 / 年降本率 / Lisence。
 */
export function isMaterialDesignCostInputRow(row = {}) {
  if (!isMaterialCostModuleRow(row)) return false;
  const path = normalizeMaterialDesignCostPathText(getMaterialDesignCostRowPath(row));
  return path === normalizeMaterialDesignCostPathText(MATERIAL_DESIGN_COST_INPUT_PATH);
}

/**
 * 设计成本组下的年降本率行。
 */
export function isMaterialDesignCostReductionRateRow(row = {}) {
  if (!isMaterialCostModuleRow(row)) return false;
  const path = normalizeMaterialDesignCostPathText(getMaterialDesignCostRowPath(row));
  return path === normalizeMaterialDesignCostPathText(MATERIAL_DESIGN_COST_REDUCTION_RATE_PATH);
}

/**
 * 材料成本/设计成本/其中 Lisence（含 License 拼写别名）。
 */
export function isMaterialLisenceRow(row = {}) {
  if (!isMaterialCostModuleRow(row)) return false;
  const path = normalizeMaterialDesignCostPathText(getMaterialDesignCostRowPath(row));
  if (MATERIAL_LISENCE_PATHS.some((item) => path === normalizeMaterialDesignCostPathText(item))) {
    return true;
  }
  return /其中lisence$|其中license$/.test(path);
}

/**
 * 在默认 inputScope 上覆写：设计成本 / 其中 Lisence 仅首年可填。
 * 仅在可写范围（非 readonly）时覆写，避免覆盖公式/外链科目的只读语义。
 */
export function resolveMaterialDesignCostInputScope(row = {}, fallbackScope = REVENUE_INPUT_SCOPE.ALL) {
  const fallback = fallbackScope || REVENUE_INPUT_SCOPE.ALL;
  if (fallback === REVENUE_INPUT_SCOPE.READONLY) return fallback;
  if (isMaterialDesignCostInputRow(row) || isMaterialLisenceRow(row)) {
    return REVENUE_INPUT_SCOPE.FIRST_YEAR_ONLY;
  }
  return fallback;
}

/**
 * 设计成本 / 其中 Lisence 后续年份虽然不可手填，但派生结果仍需保存、审核和追溯。
 */
export function isMaterialDesignCostPersistableColumn(row = {}, column = {}) {
  if (!isMaterialDesignCostInputRow(row) && !isMaterialLisenceRow(row)) return false;
  if (safeText(row.inputScope) !== REVENUE_INPUT_SCOPE.FIRST_YEAR_ONLY) return false;
  const yearIndex = Number(column && column.yearIndex);
  return Number.isInteger(yearIndex) && yearIndex >= 0;
}
