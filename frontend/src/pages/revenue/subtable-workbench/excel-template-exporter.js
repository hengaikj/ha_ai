/**
 * S1 子表「下载填报模板」生成器，与 excel-template-parser.js 对称。
 * - 工作表名固定为「填报模板」
 * - 第 1 行：科目全路径 | 科目 | 年份/列组名（同一年多版型时只在该年首列写年份，并横向合并）
 * - 第 2 行：空 | 空 | 各版型名（解析器靠这一行识别数据列，不合并）
 * - 第 3 行起：叶子科目行；数值格预填页面已有展示值，空格仍留空供填写
 */
import * as XLSX from "xlsx";
import {
  REVENUE_TEMPLATE_SHEET_NAME,
  RND_INVESTMENT_AMOUNT_GROUP_YEAR,
} from "./excel-template-parser";

/** 与 parser.parseRevenueTemplateMetaColumns 识别的表头文案保持一致 */
const FULL_PATH_HEADER = "科目全路径";
const SUBJECT_HEADER = "科目";
/** 研发投资总额列第 2 行文案，须能被 matchRndInvestmentAmountColumnByHeader 命中 */
const RND_AMOUNT_TRIM_NAMES = Object.freeze([
  "投资总额-含税（万元）",
  "投资总额-不含税（万元）",
]);

function safeText(value) {
  return String(value == null ? "" : value).trim();
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

/** 本地格式化为 yyyyMMddHHmmss，不依赖 ruoyi parseTime */
function formatTemplateTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join("");
}

/** 去掉 Windows/macOS 不允许的文件名字符，并保证以 .xlsx 结尾 */
export function sanitizeRevenueTemplateFileName(fileName = "") {
  const text = safeText(fileName).replace(/[\\/:*?"<>|]/g, "_");
  const base = text.replace(/\.xlsx$/i, "") || "填报模板";
  return `${base}.xlsx`;
}

/** 下载文件名：{项目名称}-{模块名}-填报模板{yyyyMMddHHmmss}.xlsx */
export function buildRevenueImportTemplateFileName(options = {}) {
  const projectName = safeText(options.projectName) || "收益测算项目";
  const moduleName = safeText(options.moduleName) || "填报模板";
  const timestamp = formatTemplateTimestamp(options.now || new Date());
  return sanitizeRevenueTemplateFileName(
    `${projectName}-${moduleName}-填报模板${timestamp}.xlsx`
  );
}

function resolveTrimName(trim) {
  if (!trim || typeof trim !== "object") return safeText(trim);
  return safeText(trim.trimName || trim.name || trim.label || trim.trimId);
}

/**
 * 生成年份/版型列描述：第 1 行写年份，第 2 行写版型。
 */
function buildYearTrimColumns(years = [], trims = [], yearOnly = false) {
  const yearLabels = (Array.isArray(years) ? years : []).map((item) => safeText(item)).filter(Boolean);
  if (!yearLabels.length) {
    throw new Error("当前页面没有可导出的年份列");
  }
  if (yearOnly) {
    return yearLabels.map((year) => ({
      year,
      trimName: year,
    }));
  }
  const trimNames = (Array.isArray(trims) ? trims : []).map(resolveTrimName).filter(Boolean);
  if (!trimNames.length) {
    throw new Error("当前模块没有可导出的版型列");
  }
  const columns = [];
  yearLabels.forEach((year) => {
    trimNames.forEach((trimName) => {
      columns.push({ year, trimName });
    });
  });
  return columns;
}

/** 科目全路径、科目两列之后才是数据列；SheetJS 行列均为 0-based */
const HEADER_YEAR_ROW_INDEX = 0;
const FIRST_DATA_COL_INDEX = 2;

/**
 * 第 1 行把连续相同年份（含「投资总额」列组）横向合并；跨度不足 2 列不合并。
 */
function buildHeaderYearMerges(dataColumns = []) {
  const columns = Array.isArray(dataColumns) ? dataColumns : [];
  const merges = [];
  let runStart = 0;
  while (runStart < columns.length) {
    const year = safeText(columns[runStart] && columns[runStart].year);
    let runEnd = runStart;
    while (
      runEnd + 1 < columns.length &&
      safeText(columns[runEnd + 1] && columns[runEnd + 1].year) === year
    ) {
      runEnd += 1;
    }
    if (year && runEnd > runStart) {
      merges.push({
        s: { r: HEADER_YEAR_ROW_INDEX, c: FIRST_DATA_COL_INDEX + runStart },
        e: { r: HEADER_YEAR_ROW_INDEX, c: FIRST_DATA_COL_INDEX + runEnd },
      });
    }
    runStart = runEnd + 1;
  }
  return merges;
}

/**
 * 研发投资「投资总额」独立列组：第 1 行写「投资总额」，第 2 行写含税/不含税全名。
 * 对应 parser 形态 A（rndInvestmentAmountGroup），不走年份×版型匹配。
 */
function buildRndAmountColumns() {
  return RND_AMOUNT_TRIM_NAMES.map((trimName) => ({
    year: RND_INVESTMENT_AMOUNT_GROUP_YEAR,
    trimName,
    rndInvestmentAmount: true,
  }));
}

/**
 * 导出数据列顺序：投资总额列（可选）+ 年份×版型。mixin 预填 values 需与此对齐。
 */
export function buildRevenueImportTemplateDataColumns(options = {}) {
  return []
    .concat(options.includeRndAmountColumns ? buildRndAmountColumns() : [])
    .concat(
      buildYearTrimColumns(options.years, options.trims, Boolean(options.yearOnly))
    );
}

/** 纯数字写成 Excel 数值；带 % 的保留展示文本；空则留空 */
function normalizeExportCellValue(value) {
  if (value == null) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "";
  }
  const text = String(value).trim();
  if (!text) return "";
  if (/[%％]/u.test(text)) return text;
  const numericText = text.replace(/,/g, "");
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/u.test(numericText)) return text;
  const num = Number(numericText);
  return Number.isFinite(num) ? num : text;
}

function readExportCellValue(row, index) {
  if (!row || !Array.isArray(row.values)) return "";
  return normalizeExportCellValue(row.values[index]);
}

/**
 * 生成「填报模板」二维表：第 1 行年份/列组，第 2 行版型，第 3 行起科目全路径。
 */
export function buildRevenueImportTemplateAoA(options = {}) {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  if (!rows.length) {
    throw new Error("当前导入模块下没有可导入科目");
  }
  // 投资总额列放在年×版型前面，保证 firstDataCol 仍能扫到「第 1、2 行都有值」的数据列
  const dataColumns = buildRevenueImportTemplateDataColumns(options);
  const headerYear = [FULL_PATH_HEADER, SUBJECT_HEADER];
  const headerTrim = ["", ""];
  dataColumns.forEach((column, index) => {
    const previous = dataColumns[index - 1];
    const yearChanged = !previous || previous.year !== column.year;
    headerYear.push(yearChanged ? column.year : "");
    headerTrim.push(column.trimName);
  });
  const dataRows = rows.map((row) => {
    const fullPath = safeText(row && (row.fullPath || row.full_path));
    const subjectName = safeText(
      row && (row.subjectName || row.item || row.subject)
    ) || fullPath.split("/").filter(Boolean).pop() || "";
    return [fullPath, subjectName].concat(
      dataColumns.map((_, index) => readExportCellValue(row, index))
    );
  });
  return {
    sheetName: options.templateSheetName || REVENUE_TEMPLATE_SHEET_NAME,
    aoa: [headerYear, headerTrim].concat(dataRows),
    dataColumns,
  };
}

/** 把 二维数组 转成 SheetJS workbook：加列宽，冻结前两列/前两行方便填写时对照科目和表头 */
export function buildRevenueImportTemplateWorkbook(options = {}) {
  const built = buildRevenueImportTemplateAoA(options);
  const worksheet = XLSX.utils.aoa_to_sheet(built.aoa);
  worksheet["!cols"] = [
    { wch: 52 },
    { wch: 16 },
  ].concat((built.dataColumns || []).map(() => ({ wch: 16 })));
  worksheet["!freeze"] = { xSplit: 2, ySplit: 2 };
  const headerYearMerges = buildHeaderYearMerges(built.dataColumns);
  if (headerYearMerges.length) {
    worksheet["!merges"] = headerYearMerges;
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, built.sheetName);
  return workbook;
}

/** 浏览器端触发 xlsx 下载；返回最终文件名供页面提示 */
export function downloadRevenueImportTemplateFile(options = {}) {
  const workbook = buildRevenueImportTemplateWorkbook(options);
  const fileName = sanitizeRevenueTemplateFileName(
    options.fileName || "填报模板.xlsx"
  );
  XLSX.writeFile(workbook, fileName);
  return fileName;
}
