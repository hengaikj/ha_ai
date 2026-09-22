import * as XLSX from "xlsx";
import {
  isRndInvestmentAmountGroupYearLabel,
  matchRndInvestmentAmountColumnByHeader,
} from "./formula-engine";

export const REVENUE_TEMPLATE_SHEET_NAME = "填报模板";
export const REVENUE_TEMPLATE_MAPPING_SHEET_NAME = "科目映射";
/** 形态 A：独立「投资总额」列组在解析结果中的年份占位名 */
export const RND_INVESTMENT_AMOUNT_GROUP_YEAR = "投资总额";

const DEFAULT_HEADER_YEAR_ROW = 1;
const DEFAULT_HEADER_TRIM_ROW = 2;
const DEFAULT_DATA_START_ROW = 3;
const DEFAULT_DATA_START_COL = 3;
const ERROR_VALUE_REGEXP = /^#(DIV\/0!|REF!|VALUE!|N\/A|NAME\?|NULL!|NUM!)/i;

function resolveOptions(options = {}) {
  return {
    templateSheetName: options.templateSheetName || REVENUE_TEMPLATE_SHEET_NAME,
    mappingSheetName: options.mappingSheetName || REVENUE_TEMPLATE_MAPPING_SHEET_NAME,
    includeMappingSheet: Boolean(options.includeMappingSheet),
    headerYearRow: Number(options.headerYearRow || DEFAULT_HEADER_YEAR_ROW),
    headerTrimRow: Number(options.headerTrimRow || DEFAULT_HEADER_TRIM_ROW),
    dataStartRow: Number(options.dataStartRow || DEFAULT_DATA_START_ROW),
    dataStartCol: Number(options.dataStartCol || DEFAULT_DATA_START_COL),
    readOptions: options.readOptions || {},
    fileName: options.fileName || "",
  };
}

export function normalizeRevenueTemplateSubjectName(value) {
  return String(value || "")
    .replace(/\u00A0/g, "")
    .replace(/\r?\n/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeRevenueTemplateSubjectMatchText(value) {
  return normalizeRevenueTemplateSubjectName(value)
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function normalizeRevenueTemplateSubjectPathParts(parts) {
  return (Array.isArray(parts) ? parts : [])
    .map((item) => normalizeRevenueTemplateSubjectName(item))
    .filter(Boolean);
}

export function readRevenueTemplateFullPathParts(source = {}) {
  const candidates = [
    source.full_path,
    source.fullPath,
    source.fullNamePath,
    source.subject_full_path,
    source.subjectFullPath,
  ];
  for (let index = 0; index < candidates.length; index += 1) {
    const value = candidates[index];
    if (Array.isArray(value)) {
      const path = normalizeRevenueTemplateSubjectPathParts(value);
      if (path.length) return path;
    }
    const text = normalizeRevenueTemplateSubjectName(value);
    if (!text) continue;
    const path = normalizeRevenueTemplateSubjectPathParts(
      text.replace(/\\/g, "/").split(/[/>＞]/)
    );
    if (path.length) return path;
  }
  return [];
}

export function parseRevenueImportWorkbookFile(file, options = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target && event.target.result;
        resolve(parseRevenueImportWorkbook(result, {
          ...options,
          fileName: file && file.name ? file.name : options.fileName,
        }));
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("文件格式无法识别，请选择正确的模板文件")
        );
      }
    };
    reader.onerror = () => {
      reject(new Error("读取文件失败，请重试"));
    };
    reader.readAsArrayBuffer(file);
  });
}

export function parseRevenueImportWorkbook(source, options = {}) {
  const resolved = resolveOptions(options);
  const workbook = source && source.Sheets
    ? source
    : XLSX.read(source, {
        type: "array",
        cellFormula: true,
        cellNF: true,
        ...resolved.readOptions,
      });
  const templateSheet = workbook.Sheets[resolved.templateSheetName];
  if (!templateSheet) {
    throw new Error(`仅支持解析工作表“${resolved.templateSheetName}”`);
  }
  const parsed = {
    fileName: resolved.fileName,
    importedAt: new Date().toISOString(),
    sheetName: resolved.templateSheetName,
    tables: [parseRevenueTemplateSheet(templateSheet, resolved)],
  };
  if (resolved.includeMappingSheet) {
    const mappingSheet = workbook.Sheets[resolved.mappingSheetName];
    parsed.mappingSheetName = resolved.mappingSheetName;
    parsed.mappingRows = mappingSheet ? parseRevenueTemplateMappingSheet(mappingSheet) : [];
  }
  return parsed;
}

export function parseRevenueTemplateSheet(worksheet, options = {}) {
  const resolved = resolveOptions(options);
  const columns = parseRevenueTemplateColumns(worksheet, resolved);
  if (!columns.length) {
    throw new Error("未识别到可导入的年份/版型列");
  }
  const metaColumns = parseRevenueTemplateMetaColumns(worksheet, resolved);
  const rowState = createRevenueTemplateRowState(metaColumns);
  const rows = [];
  const maxRow = getRevenueWorksheetMaxRow(worksheet);
  for (let rowIndex = resolved.dataStartRow; rowIndex <= maxRow; rowIndex += 1) {
    const rowMeta = readRevenueTemplateRowMeta(
      worksheet,
      rowIndex,
      metaColumns,
      rowState,
      resolved
    );
    if (!rowMeta.hasSubject) continue;
    rows.push({
      rowIndex,
      full_path: rowMeta.fullPath || "",
      fullPath: rowMeta.fullPath || "",
      rawGroup: rowMeta.rawGroup || "",
      group: rowMeta.group || "",
      item: rowMeta.item || "",
      values: columns.reduce((acc, columnGroup) => {
        const variantValues = {};
        columnGroup.variants.forEach((variant) => {
          variantValues[variant.key] = getRevenueTemplateCellMeta(
            worksheet,
            `${variant.key}${rowIndex}`
          );
        });
        acc[columnGroup.year] = variantValues;
        return acc;
      }, {}),
    });
  }
  return {
    scope: resolved.templateSheetName,
    rowRange: `${resolved.dataStartRow}-${maxRow}`,
    columns,
    rows,
  };
}

function buildRndInvestmentAmountVariant(key, amountColumn, yearForPath) {
  return {
    key,
    name: amountColumn.trimName || amountColumn.label,
    headerPath: [yearForPath, amountColumn.trimName || amountColumn.label],
    isSubtotal: false,
    rndInvestmentAmount: true,
    rndAmountKind: amountColumn.rndAmountKind,
    cellKey: amountColumn.cellKey || amountColumn.key,
  };
}

function ensureRndInvestmentAmountColumnGroup(groups, currentGroup, yearLabel) {
  if (currentGroup && currentGroup.rndInvestmentAmountGroup) {
    return currentGroup;
  }
  const groupYear =
    yearLabel && isRndInvestmentAmountGroupYearLabel(yearLabel)
      ? yearLabel
      : RND_INVESTMENT_AMOUNT_GROUP_YEAR;
  const nextGroup = {
    year: groupYear,
    variants: [],
    rndInvestmentAmountGroup: true,
  };
  groups.push(nextGroup);
  return nextGroup;
}

export function parseRevenueTemplateColumns(worksheet, options = {}) {
  const resolved = resolveOptions(options);
  const maxCol = getRevenueWorksheetMaxCol(worksheet);
  const groups = [];
  let currentGroup = null;
  let currentYear = "";
  const firstDataCol = getRevenueTemplateFirstDataColIndex(worksheet, resolved);
  for (let colIndex = firstDataCol; colIndex <= maxCol; colIndex += 1) {
    const key = XLSX.utils.encode_col(colIndex - 1);
    const yearLabel = getRevenueTemplateCellText(
      worksheet,
      `${key}${resolved.headerYearRow}`
    );
    const trimName = getRevenueTemplateCellText(
      worksheet,
      `${key}${resolved.headerTrimRow}`
    );
    // 形态 A：年份行直接写含税/不含税全名且版型行为空；或版型行为总额列名
    // 形态 B：年份行为具体年份，版型行为总额列名
    const amountFromTrim = matchRndInvestmentAmountColumnByHeader(trimName);
    const amountFromYear = !trimName
      ? matchRndInvestmentAmountColumnByHeader(yearLabel)
      : null;
    const amountColumn = amountFromTrim || amountFromYear;
    if (amountColumn) {
      const yearLooksLikeRealYear =
        Boolean(yearLabel) &&
        !amountFromYear &&
        !isRndInvestmentAmountGroupYearLabel(yearLabel);
      // 形态 B 续列：年份行留空，沿用当前真实年份组
      const continueUnderRealYearGroup =
        !yearLabel &&
        Boolean(currentGroup) &&
        !currentGroup.rndInvestmentAmountGroup;

      if (yearLooksLikeRealYear || continueUnderRealYearGroup) {
        if (yearLooksLikeRealYear) {
          currentYear = yearLabel;
          currentGroup = {
            year: currentYear,
            variants: [],
          };
          groups.push(currentGroup);
        }
        if (!currentGroup) continue;
      } else {
        currentGroup = ensureRndInvestmentAmountColumnGroup(
          groups,
          currentGroup,
          yearLabel
        );
        currentYear = currentGroup.year;
      }
      currentGroup.variants.push(
        buildRndInvestmentAmountVariant(key, amountColumn, currentGroup.year)
      );
      continue;
    }

    if (yearLabel) {
      currentYear = yearLabel;
      currentGroup = {
        year: currentYear,
        variants: [],
      };
      groups.push(currentGroup);
    }
    if (!currentGroup || !trimName) continue;
    // 普通版型列不得挂到形态 A「投资总额」独立组，避免误吸收后续版型列
    if (currentGroup.rndInvestmentAmountGroup) continue;
    currentGroup.variants.push({
      key,
      name: trimName,
      headerPath: [currentYear, trimName],
      isSubtotal: false,
    });
  }
  return groups.filter((item) => item.variants.length);
}

export function parseRevenueTemplateMetaColumns(worksheet, options = {}) {
  const resolved = resolveOptions(options);
  const maxMetaCol = Math.max(
    getRevenueTemplateFirstDataColIndex(worksheet, resolved) - 1,
    1
  );
  const result = {
    group: "",
    item: "",
    fullPath: "",
    hierarchy: [],
  };
  for (let colIndex = 1; colIndex <= maxMetaCol; colIndex += 1) {
    const key = XLSX.utils.encode_col(colIndex - 1);
    const header = normalizeRevenueTemplateSubjectMatchText(
      getRevenueTemplateCellText(worksheet, `${key}${resolved.headerYearRow}`)
    );
    if (!header) continue;
    if (["fullpath", "full_path", "完整路径", "科目路径", "科目全路径"].includes(header)) {
      result.fullPath = key;
    } else if (["分组", "目录", "模块", "父级", "父级科目"].includes(header)) {
      result.group = key;
    } else if (["科目", "科目名称", "名称"].includes(header)) {
      result.item = key;
    } else if (isRevenueTemplateSubjectLevelHeader(header)) {
      result.hierarchy.push({
        key,
        index: result.hierarchy.length,
      });
    }
  }
  if (!result.hierarchy.length) {
    result.group = result.group || "A";
    result.item = result.item || "B";
  }
  return result;
}

export function isRevenueTemplateSubjectLevelHeader(header) {
  return [
    "一级科目",
    "二级科目",
    "三级科目",
    "四级科目",
    "五级科目",
    "六级科目",
    "七级科目",
    "八级科目",
    "九级科目",
    "十级科目",
  ].includes(header);
}

export function createRevenueTemplateRowState(metaColumns = {}) {
  return {
    currentGroup: "",
    hierarchyValues: (metaColumns.hierarchy || []).map(() => ""),
  };
}

export function readRevenueTemplateRowMeta(
  worksheet,
  rowIndex,
  metaColumns = {},
  state = {},
  _options = {}
) {
  const hierarchy = metaColumns.hierarchy || [];
  const explicitFullPath = metaColumns.fullPath
    ? getRevenueTemplateCellText(worksheet, `${metaColumns.fullPath}${rowIndex}`)
    : "";
  const explicitPath = readRevenueTemplateFullPathParts({ fullPath: explicitFullPath });

  if (hierarchy.length) {
    const rawValues = [];
    hierarchy.forEach((column, index) => {
      const value = getRevenueTemplateCellText(worksheet, `${column.key}${rowIndex}`);
      rawValues[index] = value;
      if (!value) return;
      state.hierarchyValues[index] = value;
      for (let nextIndex = index + 1; nextIndex < state.hierarchyValues.length; nextIndex += 1) {
        state.hierarchyValues[nextIndex] = "";
      }
    });
    const inheritedPath = normalizeRevenueTemplateSubjectPathParts(
      state.hierarchyValues || []
    );
    const path = explicitPath.length ? explicitPath : inheritedPath;
    const item = path[path.length - 1] || "";
    return {
      hasSubject: Boolean(path.length || explicitFullPath),
      fullPath: path.length ? path.join("/") : explicitFullPath,
      rawGroup: rawValues[0] || "",
      group: path.length > 1 ? path[path.length - 2] : "",
      item,
    };
  }

  const groupName = metaColumns.group
    ? getRevenueTemplateCellText(worksheet, `${metaColumns.group}${rowIndex}`)
    : "";
  const itemName = metaColumns.item
    ? getRevenueTemplateCellText(worksheet, `${metaColumns.item}${rowIndex}`)
    : "";
  if (groupName) state.currentGroup = groupName;
  const path = explicitPath.length
    ? explicitPath
    : normalizeRevenueTemplateSubjectPathParts([state.currentGroup, itemName]);
  return {
    hasSubject: Boolean(state.currentGroup || itemName || explicitFullPath),
    fullPath: path.length ? path.join("/") : explicitFullPath,
    rawGroup: groupName || "",
    group: state.currentGroup || (path.length > 1 ? path[path.length - 2] : ""),
    item: itemName || path[path.length - 1] || "",
  };
}

export function parseRevenueTemplateMappingSheet(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const headerRowIndex = findRevenueTemplateMappingHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    throw new Error("未识别到“科目映射”表头，请检查模板格式");
  }
  const headerRow = rows[headerRowIndex] || [];
  return rows
    .slice(headerRowIndex + 1)
    .map((row) => {
      const item = {};
      headerRow.forEach((header, index) => {
        item[String(header || "").trim()] = row[index];
      });
      return item;
    })
    .filter((item) =>
      Object.keys(item).some((key) => normalizeRevenueTemplateSubjectName(item[key]))
    );
}

export function findRevenueTemplateMappingHeaderRowIndex(rows) {
  for (let index = 0; index < (rows || []).length; index += 1) {
    const row = rows[index] || [];
    const normalized = row.map((cell) =>
      normalizeRevenueTemplateSubjectName(cell).toLowerCase()
    );
    const hasRowIndex = normalized.some((value) =>
      ["模板行号", "templaterowindex", "rowindex", "模板行"].includes(value)
    );
    const hasSubjectField = normalized.some((value) =>
      ["subjectid", "科目id", "科目编号", "subjectcode", "subjectname"].includes(value)
    );
    if (hasRowIndex && hasSubjectField) return index;
  }
  return -1;
}

export function getRevenueTemplateFirstDataColIndex(worksheet, options = {}) {
  const resolved = resolveOptions(options);
  const maxCol = getRevenueWorksheetMaxCol(worksheet);
  for (let colIndex = 1; colIndex <= maxCol; colIndex += 1) {
    const key = XLSX.utils.encode_col(colIndex - 1);
    const yearLabel = getRevenueTemplateCellText(
      worksheet,
      `${key}${resolved.headerYearRow}`
    );
    const trimName = getRevenueTemplateCellText(
      worksheet,
      `${key}${resolved.headerTrimRow}`
    );
    if (yearLabel && trimName) return colIndex;
  }
  return resolved.dataStartCol;
}

export function getRevenueWorksheetMaxRow(worksheet) {
  const range = XLSX.utils.decode_range((worksheet && worksheet["!ref"]) || "A1:A1");
  return range.e.r + 1;
}

export function getRevenueWorksheetMaxCol(worksheet) {
  const range = XLSX.utils.decode_range((worksheet && worksheet["!ref"]) || "A1:A1");
  return range.e.c + 1;
}

export function getRevenueTemplateCellText(worksheet, address) {
  const cell = worksheet && worksheet[address];
  if (!cell) return "";
  if (cell.w != null && cell.w !== "") {
    return String(cell.w).replace(/\r?\n/g, " ").trim();
  }
  if (cell.v == null) return "";
  return String(cell.v).replace(/\r?\n/g, " ").trim();
}

export function getRevenueTemplateCellMeta(worksheet, address) {
  const cell = worksheet && worksheet[address];
  const displayText = getRevenueTemplateCellText(worksheet, address);
  const rawValue =
    cell && cell.v != null
      ? String(cell.v).replace(/\r?\n/g, " ").trim()
      : displayText;
  const formula = cell && cell.f ? String(cell.f) : "";
  const numericValue =
    cell && typeof cell.v === "number" && Number.isFinite(cell.v)
      ? Number(cell.v)
      : null;
  return {
    address,
    displayText,
    rawValue,
    formula,
    formulaResultAvailable: Boolean(formula && (displayText || rawValue || numericValue != null)),
    numberFormat: cell && cell.z ? String(cell.z) : "",
    numericValue,
    isBlank: !formula && !displayText && !rawValue,
    isError:
      Boolean(cell && cell.t === "e") ||
      ERROR_VALUE_REGEXP.test(displayText) ||
      ERROR_VALUE_REGEXP.test(rawValue),
  };
}
