import b31TestDataSource from "@/fixtures/revenue/b31-test-data.json";

const B31_TEST_DATA_ROWS = Object.freeze(Array.isArray(b31TestDataSource && b31TestDataSource.rows) ? b31TestDataSource.rows : []);

const MODULE_ALIASES = Object.freeze({
  销量表: ["销量表"],
  产品竞争力分析: ["产品竞争力分析", "产品竞争力分析竞品1"],
  促销商务政策: ["促销商务政策", "促销及商务政策"],
  销售费用: ["销售费用", "变动销售费用"],
  变动制造费用: ["变动制造费用", "变动制造"],
  材料成本: ["材料成本", "材料成本链接成本系统"],
  其他固定费用: ["其他固定费用", "期间费用"],
  研发投资: ["研发投资", "研发费用"],
});

function normalizeB31Text(value) {
  return String(value == null ? "" : value)
    .replace(/[\u00a0\u3000\u200b]/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/待定|营销办|财务部|技术部|极致办|制造与质量部|链接成本系统|含税|单位/g, "")
    .replace(/[\s\n\r\t\-_/\\:：;；,，.。()（）【】[\]、]/g, "")
    .toLowerCase();
}

function normalizeB31CurrentSubjectKey(value) {
  return normalizeB31Text(value)
    .replace(/销量表(目标销量|实际销量)/g, "销量表销量")
    .replace(/^(目标销量|实际销量)$/g, "销量")
    .replace(/目标销量|实际销量/g, "销量")
    .replace(/销量表(目标单价指导价|实际单价指导价)/g, "销量表单价指导价")
    .replace(/目标单价指导价|实际单价指导价/g, "单价指导价")
    .replace(/销量表(目标销量首年mix|实际销量首年mix|目标首年mix|实际首年mix)/g, "销量表mix")
    .replace(/目标销量首年mix|实际销量首年mix|目标首年mix|实际首年mix/g, "mix")
    .replace(/设计成本含零部件摊销/g, "设计成本")
    .replace(/材料成本lisence/g, "材料成本设计成本其中lisence")
    .replace(/^lisence$/g, "其中lisence");
}

function splitB31Path(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split("/")
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function readB31RowPathParts(row) {
  if (!row || typeof row !== "object") return [];
  if (Array.isArray(row.subjectPath) && row.subjectPath.length) {
    return splitB31Path(row.subjectPath);
  }
  return [row.subtable, row.rootSubjectName, row.subject || row.subjectName]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function getB31ModuleAliases(moduleName) {
  const key = normalizeB31CurrentSubjectKey(moduleName);
  const aliasKeys = Object.keys(MODULE_ALIASES);
  for (let index = 0; index < aliasKeys.length; index += 1) {
    const moduleKey = aliasKeys[index];
    const aliases = MODULE_ALIASES[moduleKey] || [];
    if (normalizeB31CurrentSubjectKey(moduleKey) === key) return aliases;
    if (aliases.some((alias) => normalizeB31CurrentSubjectKey(alias) === key)) return aliases;
  }
  return [moduleName];
}

function isB31SameModule(sourceModule, rowModule, rowFullPathKey) {
  const sourceAliases = getB31ModuleAliases(sourceModule).map(normalizeB31CurrentSubjectKey);
  const rowAliases = getB31ModuleAliases(rowModule).map(normalizeB31CurrentSubjectKey);
  return sourceAliases.some(
    (sourceKey) =>
      rowAliases.some((rowKey) => sourceKey && rowKey && (sourceKey === rowKey || rowKey.includes(sourceKey) || sourceKey.includes(rowKey))) ||
      (sourceKey && rowFullPathKey.includes(sourceKey))
  );
}

function getB31RowScore(source, row) {
  const rowParts = readB31RowPathParts(row);
  const sourcePathParts = splitB31Path(source && source.subjectPath);
  const rowModule = String((row && (row.subtable || row.rootSubjectName)) || rowParts[0] || "");
  const sourceModule = String((source && source.module) || sourcePathParts[0] || "");
  const sourcePathKey = normalizeB31CurrentSubjectKey(sourcePathParts.join("/"));
  const sourceTailKey = normalizeB31CurrentSubjectKey(sourcePathParts.slice(1).join("/"));
  const rowFullPathKey = normalizeB31CurrentSubjectKey(rowParts.join("/"));
  const rowTailKey = normalizeB31CurrentSubjectKey(rowParts.slice(1).join("/"));
  const rowLeafKey = normalizeB31CurrentSubjectKey(row && (row.subject || row.subjectName || row.fullNamePath));
  const sourceLeafKey = normalizeB31CurrentSubjectKey(sourcePathParts[sourcePathParts.length - 1]);

  if (!sourcePathKey || !rowFullPathKey) return 0;
  if (!isB31SameModule(sourceModule, rowModule, rowFullPathKey)) return 0;

  let score = 20;
  if (rowFullPathKey === sourcePathKey || rowTailKey === sourceTailKey) score += 120;
  if (rowFullPathKey.endsWith(sourceTailKey) || sourcePathKey.endsWith(rowTailKey)) score += 80;
  if (rowFullPathKey.includes(sourceTailKey) || sourceTailKey.includes(rowTailKey)) score += 55;
  if (rowLeafKey && sourceLeafKey && rowLeafKey === sourceLeafKey) score += 35;
  if (rowLeafKey && sourceLeafKey && (rowLeafKey.includes(sourceLeafKey) || sourceLeafKey.includes(rowLeafKey))) score += 18;
  return score;
}

const B31_ROW_CACHE = new WeakMap();

function findB31SourceRow(row) {
  if (!row || typeof row !== "object") return null;
  if (B31_ROW_CACHE.has(row)) return B31_ROW_CACHE.get(row);
  let best = null;
  let bestScore = 0;
  B31_TEST_DATA_ROWS.forEach((source) => {
    const score = getB31RowScore(source, row);
    if (score > bestScore) {
      best = source;
      bestScore = score;
    }
  });
  const result = bestScore >= 60 ? best : null;
  B31_ROW_CACHE.set(row, result);
  return result;
}

function getB31CellYearIndex(cell) {
  return Number(Array.isArray(cell) ? cell[0] : cell && cell.yearIndex);
}

function getB31CellTrimIndex(cell) {
  return Number(Array.isArray(cell) ? cell[1] : cell && cell.trimIndex);
}

function getB31CellTrimName(cell) {
  return String((Array.isArray(cell) ? cell[2] : cell && cell.trimName) || "");
}

function getB31CellValue(cell) {
  return String((Array.isArray(cell) ? cell[3] : cell && cell.value) || "");
}

function pickB31CellByTrim(cells, column) {
  const trimKey = normalizeB31CurrentSubjectKey(column && (column.trimName || column.label || column.trimId));
  const trimIndex = Number(column && column.trimIndex);
  const yearCells = Array.isArray(cells) ? cells : [];
  if (!yearCells.length) return null;

  const withoutTrim = yearCells.find((cell) => getB31CellTrimIndex(cell) < 0);
  if (withoutTrim) return withoutTrim;

  const exactTrim = yearCells.find((cell) => {
    const cellTrimKey = normalizeB31CurrentSubjectKey(getB31CellTrimName(cell));
    return trimKey && cellTrimKey && (trimKey === cellTrimKey || trimKey.includes(cellTrimKey) || cellTrimKey.includes(trimKey));
  });
  if (exactTrim) return exactTrim;

  if (Number.isInteger(trimIndex)) {
    const byIndex = yearCells.find((cell) => getB31CellTrimIndex(cell) === trimIndex);
    if (byIndex) return byIndex;
  }
  return yearCells[0] || null;
}

function resolveB31TestCellValue(row, column) {
  const source = findB31SourceRow(row);
  const cells = source && Array.isArray(source.cells) ? source.cells : [];
  if (!source || !cells.length) return "";

  const yearIndex = Number(column && column.yearIndex);
  const sameYearCell = pickB31CellByTrim(
    cells.filter((cell) => getB31CellYearIndex(cell) === yearIndex),
    column
  );
  if (sameYearCell) return getB31CellValue(sameYearCell);

  const firstYearCell = pickB31CellByTrim(
    cells.filter((cell) => getB31CellYearIndex(cell) === 0),
    column
  );
  return firstYearCell ? getB31CellValue(firstYearCell) : "";
}

function getB31TestDataSummary() {
  const sourceSummary = (b31TestDataSource && b31TestDataSource.summary) || {};
  return {
    rowCount: Number(sourceSummary.rowCount) || B31_TEST_DATA_ROWS.length,
    cellCount:
      Number(sourceSummary.cellCount) ||
      B31_TEST_DATA_ROWS.reduce((total, row) => total + (Array.isArray(row.cells) ? row.cells.length : 0), 0),
    excelCellCount: Number(sourceSummary.excelCellCount) || 0,
    generatedCellCount: Number(sourceSummary.generatedCellCount) || 0,
  };
}

const b31TestData = Object.freeze({
  resolveB31TestCellValue,
  getB31TestDataSummary,
});

export { resolveB31TestCellValue, getB31TestDataSummary };
export default b31TestData;
