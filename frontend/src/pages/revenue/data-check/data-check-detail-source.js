import { applyMainReviewFormulaAggregatesToValues } from "@/pages/revenue/subtable-workbench/formula-engine";
import {
  REVENUE_ROW_KIND,
  resolveLifecycleFormula,
  resolveSubtotalAggregateFormula,
} from "@/pages/revenue/subtable-workbench/matrix-utils";
import { REVENUE_VALUE_SOURCE } from "@/pages/revenue/subtable-workbench/domain-config";
import { buildMainTableNormalizedSelectedYearIndexes } from "@/pages/revenue/components/main-table-review-model";

/** 科目名称到模板 ID 的映射（与 Vue2 保持一致） */
export const SUBJECT_ID_BY_NAME = Object.freeze({
  MIX: "mix",
  "市场指导价/合同价(含税)": "msrp",
  "市场指导价(含税)": "msrp",
  "合同价(含税)": "msrp",
  "促销政策(含税)": "promo",
  "TP价(含税)": "tp",
  "商务政策(含税)": "biz_policy",
  "经销商底价(含税)": "dealer",
  销售收入: "revenue",
  消费税金及附加: "tax",
  材料成本: "material",
  设计成本: "design_cost",
  BOM辅料: "bom",
  零部件摊销: "part_amo",
  变动制造费用: "var_mfg",
  变动销售费用: "var_sale",
  华为服务费: "huawei_service_fee",
  边际贡献: "margin",
  边际贡献率: "margin_rate",
  固定费用: "fixed_total",
  固定费用合计: "fixed_total",
  固定税金及附加: "fixed_tax",
  固定制造费用: "fixed_mfg",
  固定销售费用: "fixed_sale",
  管理费用: "management",
  研发费用: "rd_expense",
  财务费用: "finance_exp",
  选装收益: "option_income",
  营业利润: "op_profit",
  营业利润率: "op_rate",
  销量: "proj_vol",
  项目销量: "proj_vol",
  项目销售收入: "proj_rev",
  项目边际贡献: "proj_margin",
  项目营业利润: "proj_profit",
});

function normalizeText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback == null ? "" : fallback);
}

/**
 * 创建数据校核详情页的数据源处理模型。
 * @param {object} options
 * @returns {object} 数据源处理方法集合
 */
export function createDataCheckSourceModel(options = {}) {
  const {
    project,
    dimensions,
    subjects,
    sourceVersions,
    candidateValues,
    sourceRecordMap,
    calcEditableFields,
    state,
    pageMessage,
    mergeProjectWithRoute,
    getStageLabel,
    getCurrentStage,
    getReviewYearOptions,
    getCalcBaseYearOptions,
    getDefaultYearIndexes,
    clone,
    safeText,
    roundNumber,
    STAGE_ORDER = [],
    SUBJECT_ID_BY_NAME: subjectIdByName = SUBJECT_ID_BY_NAME,
  } = options;

  function normalizeStageCode(value, fallback = "S1") {
    const text = String(value == null ? "" : value).trim().toUpperCase();
    return STAGE_ORDER.includes(text) ? text : fallback;
  }

  function setPageMessage(message) {
    if (pageMessage && typeof pageMessage === "object" && "value" in pageMessage) {
      pageMessage.value = message;
    }
    return message;
  }

  function safeNumber(value) {
    if (value == null || String(value).trim() === "") return null;
    const num = Number(String(value).replace(/,/g, "").replace(/[%％]$/, ""));
    return Number.isFinite(num) ? num : null;
  }

  function getStageVersionKey(stage) {
    return normalizeStageCode(stage, "S1").toLowerCase();
  }

  function buildVersionKeyFromSource(source = {}) {
    return normalizeText(source.key, getStageVersionKey(source.stage));
  }

  function getSourceDetail(source = {}) {
    return source && source.detail && typeof source.detail === "object"
      ? source.detail
      : {};
  }

  function getSourceDetailRows(source = {}) {
    const detail = getSourceDetail(source);
    return Array.isArray(detail.rows) ? detail.rows : [];
  }

  function normalizeSubjectMatchName(value) {
    return normalizeText(value)
      .toUpperCase()
      .replace(/（/g, "(")
      .replace(/）/g, ")")
      .replace(/其中[:：]/g, "")
      .replace(/[\s\u3000]/g, "")
      .replace(/[()]/g, "")
      .replace(/[/\\_\-—]/g, "");
  }

  function resolveSubjectIdByNameKey(nameKey) {
    const key = normalizeText(nameKey);
    if (!key) return "";
    if (subjectIdByName[key]) return subjectIdByName[key];
    const matchedKey = Object.keys(subjectIdByName).find(
      (item) => normalizeSubjectMatchName(item) === key
    );
    return matchedKey ? subjectIdByName[matchedKey] : "";
  }

  function inferTemplateId(row = {}, groupName = "") {
    const candidates = [
      row.templateId,
      row.formulaAlias,
      row.name,
      row.subjectName,
      row.subject,
      normalizeText(row.name || row.subjectName || row.subject)
        .replace(/（/g, "(")
        .replace(/）/g, ")"),
    ]
      .map((item) => normalizeSubjectMatchName(item))
      .filter(Boolean);
    for (let index = 0; index < candidates.length; index += 1) {
      const key = candidates[index];
      const id = resolveSubjectIdByNameKey(key);
      if (id) {
        if (id === "revenue" && normalizeSubjectMatchName(groupName).includes("项目")) {
          return "proj_rev";
        }
        if (id === "margin" && normalizeSubjectMatchName(groupName).includes("项目")) {
          return "proj_margin";
        }
        if (id === "op_profit" && normalizeSubjectMatchName(groupName).includes("项目")) {
          return "proj_profit";
        }
        return id;
      }
    }
    return normalizeText(row.subjectId || row.id || row.rowId);
  }

  function resolveSubjectPathParts(row = {}) {
    const rawPath =
      row.subjectTreePath ||
      row.fullNamePath ||
      row.subjectPath ||
      [row.rootSubjectName, row.subtable, row.subjectName || row.subject]
        .filter(Boolean)
        .join("/");
    if (Array.isArray(rawPath)) {
      return rawPath.map((item) => normalizeText(item)).filter(Boolean);
    }
    return normalizeText(rawPath)
      .split("/")
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  function resolveSourceGroupName(row = {}) {
    const path = resolveSubjectPathParts(row);
    if (path[0] === "主表" && path[1]) return path[1];
    const rootName = normalizeText(row.rootSubjectName || row.subtable || row.moduleName);
    if (rootName && rootName !== "主表") return rootName;
    return path[0] && path[0] !== "主表" ? path[0] : "主表";
  }

  function resolveSourceItemName(row = {}, groupName = "") {
    const path = resolveSubjectPathParts(row);
    const leaf = path[path.length - 1];
    return normalizeText(
      row.subjectName || row.subject || (leaf && leaf !== groupName ? leaf : ""),
      "未命名科目"
    );
  }

  function normalizeDataCheckItemFromRow(row = {}, groupName = "") {
    const subjectId = normalizeText(row.subjectId || row.id || row.rowId);
    if (!subjectId) return null;
    const name = resolveSourceItemName(row, groupName);
    const templateId = inferTemplateId({ ...row, name }, groupName);
    return {
      ...row,
      id: templateId || subjectId,
      templateId,
      subjectId,
      subjectCode: normalizeText(row.subjectCode || row.code),
      formulaKey: normalizeText(row.formulaKey),
      name,
      unit: normalizeText(row.unit),
      subjectPath: resolveSubjectPathParts(row),
      bold: ["fixed_total", "margin", "op_profit", "proj_profit"].includes(templateId),
    };
  }

  function normalizeYearMatchKey(value) {
    const text = normalizeText(value);
    if (text.includes("全生命周期") || text.includes("合计")) return "lifecycle";
    return text.replace(/年/g, "").replace(/\s+/g, "");
  }

  function getYearSortValue(value) {
    const text = normalizeText(value);
    const hit = text.match(/(\d{4})/);
    if (hit && hit[1]) return Number(hit[1]);
    if (normalizeYearMatchKey(text) === "lifecycle") return Number.MAX_SAFE_INTEGER;
    return Number.MAX_SAFE_INTEGER - 1;
  }

  function sortYearLabels(labels = []) {
    return (Array.isArray(labels) ? labels : []).slice().sort((a, b) => {
      const aScore = getYearSortValue(a);
      const bScore = getYearSortValue(b);
      if (aScore !== bScore) return aScore - bScore;
      return normalizeText(a).localeCompare(normalizeText(b), "zh-Hans-CN");
    });
  }

  function isSubtotalTrimLabel(value) {
    const text = normalizeText(value);
    return text === "小计" || text === "合计";
  }

  function normalizeDetailTrimOptions(detail = {}) {
    const detailDimensions =
      detail && detail.dimensions && typeof detail.dimensions === "object"
        ? detail.dimensions
        : {};
    const trimOptions = Array.isArray(detail.trimOptions) ? detail.trimOptions : [];
    const fallbackTrims = Array.isArray(detailDimensions.trims) ? detailDimensions.trims : [];
    const source = trimOptions.length ? trimOptions : fallbackTrims;
    const result = source
      .map((item, index) => {
        const raw = item && typeof item === "object" ? item : {};
        const trimName =
          item && typeof item === "object"
            ? normalizeText(raw.trimName || raw.name || raw.label || raw.trimId || raw.id)
            : normalizeText(item);
        if (!trimName) return null;
        return {
          trimId:
            item && typeof item === "object"
              ? normalizeText(raw.trimId || raw.id || raw.code || trimName)
              : trimName,
          trimName,
          trimIndex: Number.isInteger(raw.trimIndex) ? Number(raw.trimIndex) : index,
        };
      })
      .filter(Boolean);
    return result.length
      ? result
      : [{ trimId: "默认版型", trimName: "默认版型", trimIndex: 0 }];
  }

  function getDefaultTrimIndex() {
    const trims = Array.isArray(dimensions.trims) ? dimensions.trims : [];
    if (!trims.length) return 0;
    // 对齐 Vue2：优先取「小计/合计」列，现场计算器打开时用该列作为基准值
    const subtotalIndex = trims.findIndex((item) => isSubtotalTrimLabel(item));
    return subtotalIndex >= 0 ? subtotalIndex : trims.length - 1;
  }

  /**
   * 将源数据版型名映射到全局 trim 下标；小计列与未知版型返回 null（不写源数据）。
   */
  function resolveGlobalTrimIndex(trimLabel) {
    const label = normalizeText(trimLabel);
    if (!label || isSubtotalTrimLabel(label)) return null;
    const trims = Array.isArray(dimensions.trims) ? dimensions.trims : [];
    const index = trims.findIndex((item) => normalizeText(item) === label);
    return index >= 0 ? index : null;
  }

  /**
   * 汇总各数据源版型，按 trimIndex 排序，保证后加版型（如版型C）不会挤占小计列位置。
   */
  function collectOrderedTrimLabels(sources = []) {
    const trimOrderMap = {};
    (Array.isArray(sources) ? sources : []).forEach((source) => {
      normalizeDetailTrimOptions(getSourceDetail(source)).forEach((trim, index) => {
        const trimLabel = normalizeText(trim.trimName || trim.trimId);
        if (!trimLabel || isSubtotalTrimLabel(trimLabel)) return;
        const order = Number.isInteger(trim.trimIndex) ? Number(trim.trimIndex) : index;
        if (
          trimOrderMap[trimLabel] == null ||
          order < trimOrderMap[trimLabel]
        ) {
          trimOrderMap[trimLabel] = order;
        }
      });
    });
    return Object.keys(trimOrderMap).sort((left, right) => {
      const orderDiff = trimOrderMap[left] - trimOrderMap[right];
      if (orderDiff !== 0) return orderDiff;
      return left.localeCompare(right, "zh-Hans-CN");
    });
  }

  function getGlobalYearIndexByLabel(label) {
    const years = Array.isArray(dimensions.years) ? dimensions.years : [];
    const yearKey = normalizeYearMatchKey(label);
    const index = years.findIndex((item) => normalizeYearMatchKey(item) === yearKey);
    return index >= 0 ? index : 0;
  }

  function readDetailRowCellValue(row = {}, detail = {}, yearIndex = 0, trimIndex = 0) {
    const cells = row.cells && typeof row.cells === "object" ? row.cells : {};
    const cellMap =
      (row.cellMap && typeof row.cellMap === "object" ? row.cellMap : null) ||
      (row.cellsByDimension && typeof row.cellsByDimension === "object"
        ? row.cellsByDimension
        : null) ||
      (row.dimensionCells && typeof row.dimensionCells === "object" ? row.dimensionCells : null) ||
      {};
    const cellKey = `y${yearIndex}_t${trimIndex}`;
    if (Object.prototype.hasOwnProperty.call(cells, cellKey)) {
      const cellValue = cells[cellKey];
      if (cellValue != null && String(cellValue).trim() !== "") {
        return cellValue;
      }
    }
    const detailDimensions =
      detail.dimensions && typeof detail.dimensions === "object" ? detail.dimensions : {};
    const years = Array.isArray(detailDimensions.years) ? detailDimensions.years : [];
    const trimOptions = normalizeDetailTrimOptions(detail);
    const yearLabel = normalizeText(years[yearIndex]);
    const trim = trimOptions[trimIndex] || {};
    const trimId = normalizeText(trim.trimId);
    const trimName = normalizeText(trim.trimName);
    const dimensionKeys = [`${yearLabel}__${trimId}`, `${yearLabel}__${trimName}`].filter(
      (key, index, list) => key !== `${yearLabel}__` && list.indexOf(key) === index
    );
    if (trimOptions.length <= 1 || (!trimId && !trimName)) {
      dimensionKeys.push(`${yearLabel}__`);
    }
    for (let index = 0; index < dimensionKeys.length; index += 1) {
      const key = dimensionKeys[index];
      if (Object.prototype.hasOwnProperty.call(cellMap, key)) {
        return cellMap[key];
      }
    }
    return null;
  }

  function resolveSourceYearIndex(detail = {}, globalYearIndex = 0) {
    const detailDimensions =
      detail.dimensions && typeof detail.dimensions === "object" ? detail.dimensions : {};
    const years = Array.isArray(detailDimensions.years) ? detailDimensions.years : [];
    const globalYears = Array.isArray(dimensions.years) ? dimensions.years : [];
    const globalLabel = normalizeText(globalYears[globalYearIndex]);
    const globalKey = normalizeYearMatchKey(globalLabel);
    if (!globalKey) return Number(globalYearIndex) || 0;
    const hit = years.findIndex((item) => normalizeYearMatchKey(item) === globalKey);
    return hit >= 0 ? hit : Number(globalYearIndex) || 0;
  }

  function resolveSourceTrimIndex(detail = {}, globalTrimIndex = 0) {
    const trimOptions = normalizeDetailTrimOptions(detail);
    const globalTrims = Array.isArray(dimensions.trims) ? dimensions.trims : [];
    const globalLabel = normalizeText(globalTrims[globalTrimIndex]);
    if (!globalLabel) return null;
    const hit = trimOptions.findIndex(
      (item) =>
        normalizeText(item.trimName) === globalLabel ||
        normalizeText(item.trimId) === globalLabel
    );
    return hit >= 0 ? hit : null;
  }

  function readVersionValueFromSourceDetail(itemOrId, versionKey, trimIndex, yearIndex) {
    const source = sourceRecordMap.value[normalizeText(versionKey)];
    if (!source) return null;
    const detail = getSourceDetail(source);
    const rows = getSourceDetailRows(source);
    const expectedKeys = resolveSubjectValueKeys(itemOrId);
    let matchedRow = null;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const groupName = resolveSourceGroupName(row);
      const item = normalizeDataCheckItemFromRow(row, groupName);
      if (!item) continue;
      const rowKeys = resolveSubjectValueKeys(item);
      if (rowKeys.some((key) => expectedKeys.includes(key))) {
        matchedRow = row;
        break;
      }
    }
    if (!matchedRow) return null;
    const sourceYearIndex = resolveSourceYearIndex(detail, yearIndex);
    const sourceTrimIndex = resolveSourceTrimIndex(detail, trimIndex);
    if (!Number.isInteger(sourceTrimIndex)) return null;
    const raw = readDetailRowCellValue(matchedRow, detail, sourceYearIndex, sourceTrimIndex);
    return normalizeNumberValue(raw);
  }

  function normalizeNumberValue(value) {
    if (value == null || String(value).trim() === "") return null;
    const num = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(num) ? num : null;
  }

  function resolveSubjectValueKeys(itemOrId) {
    if (itemOrId && typeof itemOrId === "object") {
      const pathText = Array.isArray(itemOrId.subjectPath)
        ? itemOrId.subjectPath.join("/")
        : itemOrId.subjectPath;
      const nameKey = normalizeSubjectMatchName(itemOrId.name || itemOrId.subjectName);
      return [
        itemOrId.subjectId,
        itemOrId.id,
        itemOrId.templateId,
        itemOrId.subjectCode,
        pathText && normalizeSubjectMatchName(pathText),
        nameKey && nameKey !== "未命名科目" ? nameKey : "",
      ]
        .map((item) => normalizeText(item))
        .filter((item, index, list) => item && list.indexOf(item) === index);
    }
    return [normalizeText(itemOrId)].filter(Boolean);
  }

  function buildSubjectAlignLookup(subjectList = []) {
    const byName = {};
    const byGroupName = {};
    const byPath = {};
    const byTemplateId = {};
    (Array.isArray(subjectList) ? subjectList : []).forEach((group) => {
      (group && group.items ? group.items : []).forEach((item) => {
        const nameKey = normalizeSubjectMatchName(item && (item.name || item.subjectName));
        const pathKey = normalizeSubjectMatchName(
          Array.isArray(item && item.subjectPath) ? item.subjectPath.join("/") : item && item.subjectPath
        );
        const groupNameKey = normalizeSubjectMatchName(`${group && group.group}/${item && (item.name || item.subjectName)}`);
        const templateId = normalizeText(item && item.templateId);
        const target = {
          subjectId: normalizeText(item && item.subjectId),
          id: normalizeText(item && item.id),
          templateId,
          subjectCode: normalizeText(item && item.subjectCode),
        };
        if (nameKey && nameKey !== "未命名科目" && !byName[nameKey]) byName[nameKey] = target;
        if (groupNameKey) byGroupName[groupNameKey] = target;
        if (pathKey) byPath[pathKey] = target;
        if (templateId && !byTemplateId[templateId]) byTemplateId[templateId] = target;
      });
    });
    return { byName, byGroupName, byPath, byTemplateId };
  }

  function findAlignedSubject(lookup, row = {}, groupName = "") {
    const item = normalizeDataCheckItemFromRow(row, groupName);
    if (!item) return null;
    const nameKey = normalizeSubjectMatchName(item.name);
    const pathKey = normalizeSubjectMatchName(
      Array.isArray(item.subjectPath) ? item.subjectPath.join("/") : item.subjectPath
    );
    const groupNameKey = normalizeSubjectMatchName(`${groupName}/${item.name}`);
    const templateId = normalizeText(item.templateId);
    return lookup.byGroupName[groupNameKey]
      || lookup.byPath[pathKey]
      || lookup.byTemplateId[templateId]
      || lookup.byName[nameKey]
      || null;
  }

  function alignCompareSourceSubjects(source = {}, subjectList = subjects.value) {
    const detail = getSourceDetail(source);
    const rows = getSourceDetailRows(source);
    if (!rows.length) return source;
    const lookup = buildSubjectAlignLookup(subjectList);
    return {
      ...source,
      detail: {
        ...detail,
        rows: rows.map((row) => {
          const groupName = resolveSourceGroupName(row);
          const match = findAlignedSubject(lookup, row, groupName);
          if (!match || !match.subjectId) return row;
          return {
            ...row,
            subjectId: match.subjectId,
            id: match.id || match.templateId || match.subjectId,
            templateId: match.templateId || row.templateId,
            subjectCode: match.subjectCode || row.subjectCode,
          };
        }),
      },
    };
  }

  function ensureCandidateTarget(values, keys = []) {
    const uniqueKeys = keys
      .map((item) => normalizeText(item))
      .filter((item, index, list) => item && list.indexOf(item) === index);
    if (!uniqueKeys.length) return null;
    const existing = uniqueKeys.map((key) => values[key]).find(Boolean);
    const target = existing || { trims: {}, years: {}, yearTrims: {} };
    uniqueKeys.forEach((key) => {
      values[key] = target;
    });
    return target;
  }

  function appendVersionDetailRowValue(values, versionKey, row = {}, detail = {}, groupName = "") {
    const item = normalizeDataCheckItemFromRow(row, groupName);
    if (!item) return;
    const target = ensureCandidateTarget(values, resolveSubjectValueKeys(item));
    if (!target) return;
    if (!target.trims[versionKey]) target.trims[versionKey] = [];
    if (!target.years[versionKey]) target.years[versionKey] = {};
    if (!target.yearTrims[versionKey]) target.yearTrims[versionKey] = {};

    const detailDimensions =
      detail.dimensions && typeof detail.dimensions === "object" ? detail.dimensions : {};
    const years = Array.isArray(detailDimensions.years) ? detailDimensions.years : [];
    const trimOptions = normalizeDetailTrimOptions(detail);
    years.forEach((yearLabel, sourceYearIndex) => {
      const globalYearIndex = getGlobalYearIndexByLabel(yearLabel);
      // 全生命周期由各业务年聚合重算，避免后加版型时沿用旧小计槽位数据
      if (normalizeYearMatchKey(yearLabel) === "lifecycle") return;
      trimOptions.forEach((trim, sourceTrimIndex) => {
        const trimLabel = normalizeText(trim.trimName || trim.trimId);
        // 小计/加权列由聚合引擎重算，不直接使用源数据中的累计值
        if (isSubtotalTrimLabel(trimLabel)) return;
        const raw = readDetailRowCellValue(row, detail, sourceYearIndex, sourceTrimIndex);
        if (raw == null || String(raw).trim() === "") return;
        const value = normalizeNumberValue(raw);
        if (value == null) return;
        const globalTrimIndex = resolveGlobalTrimIndex(trim.trimName || trim.trimId);
        if (globalTrimIndex == null) return;
        if (!target.yearTrims[versionKey][globalYearIndex]) {
          target.yearTrims[versionKey][globalYearIndex] = [];
        }
        target.yearTrims[versionKey][globalYearIndex][globalTrimIndex] = value;
        if (globalYearIndex === 0) {
          target.trims[versionKey][globalTrimIndex] = value;
        }
        if (target[versionKey] == null) {
          target[versionKey] = value;
        }
      });
    });
  }

  function getLifecycleYearIndex() {
    const years = Array.isArray(dimensions.years) ? dimensions.years : [];
    return years.findIndex((item) => normalizeYearMatchKey(item) === "lifecycle");
  }

  function getSourceYearIndexes() {
    const years = Array.isArray(dimensions.years) ? dimensions.years : [];
    return years
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => normalizeYearMatchKey(item) !== "lifecycle")
      .map(({ index }) => index);
  }

  function getReviewFormulaMeta(item, group) {
    const itemName = normalizeText(item && (item.name || item.subjectName));
    const groupName = normalizeText(group && group.group);
    const targetPath = normalizeText(
      Array.isArray(item && item.subjectPath)
        ? item.subjectPath.join("/")
        : item && item.subjectPath,
      ["主表", groupName, itemName].filter(Boolean).join("/")
    );
    const entryMode = normalizeText(item && (item.entryMode || item.templateEntryMode)).toUpperCase();
    const rowKind =
      normalizeText(item && (item.rowKind || item.rowType)) ||
      (entryMode === "CALCULATED"
        ? REVENUE_ROW_KIND.FORMULA
        : entryMode === "DATA_QUERY"
          ? REVENUE_ROW_KIND.LINKED
          : entryMode === "MANUAL"
            ? REVENUE_ROW_KIND.INPUT
            : "");
    const valueSource =
      normalizeText(item && (item.valueSource || item.sourceType)) ||
      (entryMode === "CALCULATED"
        ? REVENUE_VALUE_SOURCE.FORMULA
        : entryMode === "DATA_QUERY"
          ? REVENUE_VALUE_SOURCE.LINKED
          : entryMode === "MANUAL"
            ? REVENUE_VALUE_SOURCE.INPUT
            : "");
    const formulaKey = normalizeText(item && (item.formulaCode || item.formulaKey));
    const formulaExpression = normalizeText(
      item && (item.formulaExpression || item.expression)
    );
    // 有公式表达式时也要保留元数据，避免现场测算丢公式
    if (
      !entryMode &&
      !rowKind &&
      !valueSource &&
      !formulaKey &&
      !formulaExpression &&
      !item?.formulaId
    ) {
      return null;
    }
    return {
      code: formulaKey,
      formulaKey,
      formulaCode: formulaKey,
      formulaId: item && item.formulaId,
      formulaName: normalizeText(item && item.formulaName),
      formulaExpression,
      targetPath,
      rowKind,
      valueSource,
      entryMode,
      templateEntryMode: entryMode,
      aggregateFormula: normalizeText(item && item.aggregateFormula),
      // 保留数组或 JSON 字符串，供公式引擎 parseFormulaParamBindings 解析
      formulaParamBindings:
        item && item.formulaParamBindings != null ? item.formulaParamBindings : [],
    };
  }

  function findReviewSubjectByTemplateId(templateId, subjectList = subjects.value) {
    const expected = safeText(templateId);
    if (!expected) return null;
    for (
      let groupIndex = 0;
      groupIndex < (Array.isArray(subjectList) ? subjectList : []).length;
      groupIndex += 1
    ) {
      const group = subjectList[groupIndex];
      const items = Array.isArray(group && group.items) ? group.items : [];
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        const keys = resolveSubjectValueKeys(item);
        if (keys.includes(expected)) return { group, item };
      }
    }
    return null;
  }

  function resolveCalcSubjectPath(item, group) {
    const itemName = normalizeText(item && item.name).replace(/^[\s\u3000]+/, "");
    const groupName = normalizeText(group && (group.group || group.name));
    const matchedPath = Array.isArray(item && item.subjectPath)
      ? item.subjectPath.join("/")
      : normalizeText(item && item.subjectPath);
    return matchedPath
      ? normalizeSubjectMatchName(matchedPath).startsWith(normalizeSubjectMatchName("主表"))
        ? matchedPath
        : ["主表", matchedPath].filter(Boolean).join("/")
      : ["主表", groupName, itemName].filter(Boolean).join("/");
  }

  function getReviewSubjectPathCandidates(item, group) {
    const groupName = safeText(group && (group.group || group.name));
    const itemName = safeText(item && item.name);
    const formulaMeta = getReviewFormulaMeta(item, group);
    const subjectPath = Array.isArray(item && item.subjectPath)
      ? item.subjectPath.join("/")
      : safeText(item && item.subjectPath);
    return [
      subjectPath,
      formulaMeta && formulaMeta.targetPath,
      resolveCalcSubjectPath(item, group),
      ["主表", groupName, itemName].filter(Boolean).join("/"),
    ].filter(Boolean);
  }

  function findReviewSubjectByPath(path, subjectList = subjects.value) {
    const expected = normalizeSubjectMatchName(path);
    if (!expected) return null;
    let fallback = null;
    for (
      let groupIndex = 0;
      groupIndex < (Array.isArray(subjectList) ? subjectList : []).length;
      groupIndex += 1
    ) {
      const group = subjectList[groupIndex];
      const items = Array.isArray(group && group.items) ? group.items : [];
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        const candidates = getReviewSubjectPathCandidates(item, group)
          .map((candidate) => normalizeSubjectMatchName(candidate))
          .filter(Boolean);
        if (candidates.includes(expected)) return { group, item };
        if (
          !fallback &&
          candidates.some(
            (candidate) => candidate.endsWith(expected) || expected.endsWith(candidate)
          )
        ) {
          fallback = { group, item };
        }
      }
    }
    return fallback;
  }

  /**
   * 构造与 S1 矩阵行同构的轻量对象，供 matrix-utils 聚合规则复用。
   */
  function buildReviewAggregateRow(item, group) {
    const meta = getReviewFormulaMeta(item, group) || {};
    return {
      ...item,
      ...meta,
      subjectName: normalizeText(item && (item.name || item.subjectName)),
      unit: normalizeText(item && item.unit),
      moduleName: "主表",
      rootSubjectName: "主表",
    };
  }

  /**
   * 年小计 / 全生命周期公式：与 S1 填报、S8 上会共用 matrix-utils 选择逻辑。
   */
  function getReviewAggregateFormula(item, group, scope = "year") {
    const row = buildReviewAggregateRow(item, group);
    if (String(scope || "year").toLowerCase() === "lifecycle") {
      return String(resolveLifecycleFormula(row) || "sum_year").toLowerCase();
    }
    return String(resolveSubtotalAggregateFormula(row) || "weighted_by_mix").toLowerCase();
  }

  function toAggregateNumber(value) {
    if (value == null || String(value).trim() === "") return null;
    const num = safeNumber(value);
    return num == null ? null : num;
  }

  function applyReviewAggregatesToCandidateValues(values = {}, subjectList = []) {
    const aggregated = applyMainReviewFormulaAggregatesToValues(values, subjectList, {
      yearIndexes: getSourceYearIndexes(),
      lifecycleIndex: getLifecycleYearIndex(),
      subtotalTrimIndex: getDefaultTrimIndex(),
      trimCount: (dimensions.trims || []).length,
      safeText: (value, fallback) => safeText(value, fallback),
      toAggregateNumber: (value) => toAggregateNumber(value),
      roundNumber: (value, digits) => roundNumber(value, digits),
      resolveSubjectValueKeys: (itemOrId) => resolveSubjectValueKeys(itemOrId),
      findReviewSubjectByTemplateId: (templateId, sourceSubjects) =>
        findReviewSubjectByTemplateId(templateId, sourceSubjects),
      findReviewSubjectByPath: (path, sourceSubjects) =>
        findReviewSubjectByPath(path, sourceSubjects),
      getReviewFormulaMeta: (item, group) => getReviewFormulaMeta(item, group),
      getReviewAggregateFormula: (item, group) => getReviewAggregateFormula(item, group),
    });
    return sanitizeLifecycleTrimValues(aggregated);
  }

  /**
   * 清除全生命周期中「业务年无数据」版型的残留值（后加版型常见旧小计槽位污染）。
   */
  function sanitizeLifecycleTrimValues(values = {}) {
    const lifecycleIndex = getLifecycleYearIndex();
    if (lifecycleIndex < 0) return values;
    const subtotalTrimIndex = getDefaultTrimIndex();
    const businessYearIndexes = getSourceYearIndexes();
    Object.keys(values || {}).forEach((subjectId) => {
      const target = values[subjectId];
      if (!target || typeof target !== "object" || !target.yearTrims) return;
      Object.keys(target.yearTrims).forEach((versionKey) => {
        const yearTrims = target.yearTrims[versionKey];
        const lifecycleRow = yearTrims[lifecycleIndex];
        if (!Array.isArray(lifecycleRow)) return;
        for (let trimIndex = 0; trimIndex < subtotalTrimIndex; trimIndex += 1) {
          const hasBusinessValue = businessYearIndexes.some((yearIndex) => {
            const row = yearTrims[yearIndex];
            if (!Array.isArray(row)) return false;
            const val = row[trimIndex];
            return val != null && String(val).trim() !== "";
          });
          if (!hasBusinessValue) {
            lifecycleRow[trimIndex] = null;
          }
        }
      });
    });
    return values;
  }

  function syncReviewDimensionsFromSourceDetails(sources = []) {
    const sourceYears = [];
    const yearSeen = {};
    (Array.isArray(sources) ? sources : []).forEach((source) => {
      const detail = getSourceDetail(source);
      const detailDimensions =
        detail.dimensions && typeof detail.dimensions === "object" ? detail.dimensions : {};
      (Array.isArray(detailDimensions.years) ? detailDimensions.years : []).forEach((year) => {
        const yearLabel = normalizeText(year);
        const yearKey = normalizeYearMatchKey(yearLabel);
        if (!yearLabel || !yearKey || yearSeen[yearKey]) return;
        yearSeen[yearKey] = true;
        if (yearKey === "lifecycle") {
          sourceYears.push("全生命周期");
        } else {
          sourceYears.push(yearLabel);
        }
      });
    });
    const trimLabels = collectOrderedTrimLabels(sources);
    const years = sortYearLabels(sourceYears);
    if (!years.some((item) => normalizeYearMatchKey(item) === "lifecycle")) {
      years.push("全生命周期");
    }
    const trims = trimLabels.length ? trimLabels.concat("小计") : ["默认版型", "小计"];
    Object.assign(dimensions, {
      years,
      trims,
      yearFactors: years.map(() => 1),
    });
  }

  function buildSubjectsFromSourceDetails(sources = []) {
    const source = (Array.isArray(sources) ? sources : []).find(
      (item) => getSourceDetailRows(item).length
    );
    const rows = getSourceDetailRows(source || {});
    const groups = [];
    const groupMap = {};
    rows.forEach((row) => {
      const groupName = resolveSourceGroupName(row);
      const item = normalizeDataCheckItemFromRow(row, groupName);
      if (!item) return;
      if (!groupMap[groupName]) {
        groupMap[groupName] = {
          group: groupName,
          unit: normalizeText(row.rootUnit || row.groupUnit),
          items: [],
        };
        groups.push(groupMap[groupName]);
      }
      groupMap[groupName].items.push(item);
    });
    return groups.filter((group) => group.items.length);
  }

  function buildSourceVersionsFromSources(sources = []) {
    const currentStage = getCurrentStage();
    return (Array.isArray(sources) ? sources : [])
      .map((source) => {
        const stage = normalizeStageCode(source && source.stage, "");
        const key = buildVersionKeyFromSource(source);
        if (!stage || !key) return null;
        return {
          key,
          stage,
          label: normalizeText(source.label, getStageLabel(stage)),
          dot: normalizeText(source.dot, stage === currentStage ? "current" : "stage"),
          group: normalizeText(source.group, "stage"),
          sourceType: normalizeText(source.sourceType),
          recordStatus: normalizeText(source.recordStatus),
          recordCount: Number(source.recordCount || 0),
        };
      })
      .filter(Boolean);
  }

  function buildCandidateValuesFromSourceDetails(sources = [], subjectList = subjects.value) {
    syncReviewDimensionsFromSourceDetails(sources);
    const values = {};
    (Array.isArray(sources) ? sources : []).forEach((source) => {
      const versionKey = buildVersionKeyFromSource(source);
      const detail = getSourceDetail(source);
      getSourceDetailRows(source).forEach((row) => {
        appendVersionDetailRowValue(
          values,
          versionKey,
          row,
          detail,
          resolveSourceGroupName(row)
        );
      });
    });
    return applyReviewAggregatesToCandidateValues(values, subjectList);
  }

  function replaceCompareSources(sources = []) {
    const sourceList = Array.isArray(sources) ? sources : [];
    sourceRecordMap.value = sourceList.reduce((map, item) => {
      const key = buildVersionKeyFromSource(item);
      if (key) map[key] = item;
      return map;
    }, {});
    sourceVersions.value = buildSourceVersionsFromSources(sourceList);
    const nextSubjects = buildSubjectsFromSourceDetails(sourceList);
    subjects.value = nextSubjects;
    calcEditableFields.value = buildCalcEditableFields(nextSubjects);
    candidateValues.value = buildCandidateValuesFromSourceDetails(sourceList, nextSubjects);
  }

  function getCompareSourceList() {
    const map = sourceRecordMap.value || {};
    const ordered = [];
    const seen = {};
    (sourceVersions.value || []).forEach((item) => {
      const key = normalizeText(item && item.key);
      if (!key || !map[key]) return;
      ordered.push(map[key]);
      seen[key] = true;
    });
    Object.keys(map).forEach((key) => {
      if (!seen[key] && map[key]) ordered.push(map[key]);
    });
    return ordered;
  }

  function getDefaultBaselineVersionKey() {
    const stageVersions = (sourceVersions.value || []).filter((item) => item && item.group === "stage");
    const source = stageVersions.length
      ? stageVersions[stageVersions.length - 1]
      : sourceVersions.value[sourceVersions.value.length - 1] || null;
    return source ? source.key : "";
  }

  function normalizeState(nextState = {}) {
    const calcVersions = Array.isArray(nextState.calcVersions) ? nextState.calcVersions : [];
    let calcVersionSeed = Number(nextState.calcVersionSeed) || 0;
    const normalizedCalcVersions = calcVersions
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const key = normalizeText(item.key, `calc_v${index + 1}`);
        const hit = key.match(/^calc_v(\d+)$/);
        if (hit && hit[1]) calcVersionSeed = Math.max(calcVersionSeed, Number(hit[1]) || 0);
        return {
          key,
          label: normalizeText(item.label, `测算值v${index + 1}`),
          dot: "calc",
          group: "calc",
          values: item.values && typeof item.values === "object" ? clone(item.values) : {},
          calcMode: item.calcMode === "mix" ? "mix" : "single",
          mixScenario:
            item.mixScenario && typeof item.mixScenario === "object"
              ? clone(item.mixScenario)
              : null,
        };
      })
      .filter((item) => item && item.key);
    const sourceVersionKeys = sourceVersions.value.map((item) => item.key);
    const calcVersionKeys = normalizedCalcVersions.map((item) => item.key);
    const versionKeys = sourceVersionKeys.concat(calcVersionKeys);
    const baseline = versionKeys.includes(nextState.baselineVersion)
      ? nextState.baselineVersion
      : versionKeys[versionKeys.length - 1] || "";
    const seen = {};
    const compareVersions = (Array.isArray(nextState.compareVersions) ? nextState.compareVersions : [])
      .filter((key) => key && key !== baseline && versionKeys.includes(key))
      .filter((key) => {
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      })
      .sort((a, b) => versionKeys.indexOf(a) - versionKeys.indexOf(b));
    const activeYearsUserSelected = Boolean(nextState.activeYearsUserSelected);
    const activeYears = buildMainTableNormalizedSelectedYearIndexes(
      nextState.activeYears,
      getReviewYearOptions(),
      { expandLegacyDefault: !activeYearsUserSelected }
    );
    const calcBaseVersion = versionKeys.includes(nextState.calcBaseVersion)
      ? nextState.calcBaseVersion
      : baseline;
    const calcBaseYears = getCalcBaseYearOptions().map((item) => Number(item.value));
    const calcBaseYear = Number(nextState.calcBaseYear);
    const activeCalcVersionKey = normalizeText(nextState.activeCalcVersionKey);
    const hasActiveCalc = normalizedCalcVersions.some((item) => item.key === activeCalcVersionKey);
    return {
      baselineVersion: baseline,
      compareVersions,
      viewMode: nextState.viewMode === "detail" ? "detail" : "compare",
      activeYear: activeYears[0] || 0,
      activeYears,
      activeYearsUserSelected,
      activeTrims:
        Array.isArray(nextState.activeTrims) && nextState.activeTrims.length
          ? nextState.activeTrims
          : [getDefaultTrimIndex()],
      autoDiff: nextState.autoDiff !== false,
      deltaMode: Boolean(nextState.deltaMode),
      calcVersions: normalizedCalcVersions,
      calcVersionSeed,
      activeCalcVersionKey: hasActiveCalc ? activeCalcVersionKey : "",
      calcBaseVersion,
      calcBaseYear: calcBaseYears.includes(calcBaseYear)
        ? calcBaseYear
        : calcBaseYears[0] != null
          ? calcBaseYears[0]
          : 0,
      calcDraftValues:
        nextState.calcDraftValues && typeof nextState.calcDraftValues === "object"
          ? clone(nextState.calcDraftValues)
          : {},
      calcMode: nextState.calcMode === "mix" ? "mix" : "single",
      calcMixInputMode: nextState.calcMixInputMode === "volume" ? "volume" : "mix",
      calcMixLockTotalVolume: nextState.calcMixLockTotalVolume !== false,
    };
  }

  function resetCompareData() {
    Object.assign(dimensions, { years: [], trims: [], yearFactors: [] });
    subjects.value = [];
    sourceVersions.value = [];
    candidateValues.value = {};
    sourceRecordMap.value = {};
    calcEditableFields.value = [];
    Object.assign(
      state,
      normalizeState({
        baselineVersion: "",
        compareVersions: [],
      })
    );
  }

  function resetStateFromVersions() {
    const versions = sourceVersions.value || [];
    const baseline = getDefaultBaselineVersionKey();
    Object.assign(
      state,
      normalizeState({
        ...state,
        baselineVersion: baseline,
        compareVersions: versions.map((item) => item.key).filter((key) => key && key !== baseline),
        activeYears: getDefaultYearIndexes().slice(),
        activeYearsUserSelected: false,
        activeYear: getDefaultYearIndexes()[0] || 0,
        activeTrims: [getDefaultTrimIndex()],
      })
    );
  }

  function applyDataCheckPayload(payload = {}) {
    const source = payload && typeof payload === "object" ? payload : {};
    Object.assign(project, mergeProjectWithRoute(source.project || {}));
    if (!source.hasMainPermission) {
      setPageMessage("当前用户没有可用主表科目权限，无法进行数据校核。");
      resetCompareData();
      return;
    }
    if (source.subjectTreeEmpty) {
      setPageMessage("当前项目暂无可用主表科目。");
      resetCompareData();
      return;
    }
    const sources = Array.isArray(source.sources) ? source.sources : [];
    replaceCompareSources(sources);
    resetStateFromVersions();
    if (!sourceVersions.value.length) {
      setPageMessage("当前项目在校核范围内暂无可用主表数据。");
    }
  }

  function upsertCompareSource(source = {}) {
    const key = buildVersionKeyFromSource(source);
    if (!key) return "";
    const previousBaseline = state.baselineVersion;
    const previousCompare = Array.isArray(state.compareVersions)
      ? state.compareVersions.slice()
      : [];
    const sources = getCompareSourceList()
      .filter((item) => buildVersionKeyFromSource(item) !== key)
      .concat(source);
    replaceCompareSources(sources);
    const nextCompare = previousCompare
      .filter((item) => item && item !== key)
      .concat(key)
      .filter((item) => item !== (previousBaseline || key));
    Object.assign(
      state,
      normalizeState({
        ...state,
        baselineVersion: previousBaseline || key,
        compareVersions: nextCompare,
      })
    );
    return key;
  }

  function isCalcVersionKey(key) {
    return normalizeText(key).startsWith("calc_");
  }

  function findCalcVersionByKey(key) {
    const expected = normalizeText(key);
    return (state.calcVersions || []).find((item) => item && item.key === expected) || null;
  }

  function getRawVersionValue(itemOrId, versionKey, trimIndex, yearIndex) {
    const keys = resolveSubjectValueKeys(itemOrId);
    if (isCalcVersionKey(versionKey)) {
      const calcVersion = findCalcVersionByKey(versionKey);
      const values =
        calcVersion && calcVersion.values && typeof calcVersion.values === "object"
          ? calcVersion.values
          : {};
      for (let index = 0; index < keys.length; index += 1) {
        const value = values[keys[index]];
        if (value != null) return safeNumber(value);
      }
      return null;
    }
    let target = null;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (candidateValues.value && candidateValues.value[key]) {
        target = candidateValues.value[key];
        break;
      }
    }
    if (!target) {
      const direct = readVersionValueFromSourceDetail(itemOrId, versionKey, trimIndex, yearIndex);
      return direct == null ? null : direct;
    }
    const hasYearIndex =
      yearIndex !== null &&
      typeof yearIndex !== "undefined" &&
      String(yearIndex).trim() !== "" &&
      Number.isInteger(Number(yearIndex));
    const hasTrimIndex =
      trimIndex !== null &&
      typeof trimIndex !== "undefined" &&
      String(trimIndex).trim() !== "" &&
      Number.isInteger(Number(trimIndex));
    const normalizedYearIndex = hasYearIndex ? Number(yearIndex) : null;
    const normalizedTrimIndex = hasTrimIndex ? Number(trimIndex) : null;
    const defaultTrimIndex = getDefaultTrimIndex();
    const versionYearTrimValues = target.yearTrims && target.yearTrims[versionKey];
    const versionYearValues = target.years && target.years[versionKey];
    const versionTrimValues = target.trims && target.trims[versionKey];

    if (hasYearIndex) {
      const yearValues =
        versionYearTrimValues && versionYearTrimValues[normalizedYearIndex];
      if (Array.isArray(yearValues)) {
        if (hasTrimIndex) {
          const cell = yearValues[normalizedTrimIndex];
          // 空字符串不能当有效值返回，否则现场计算器拿不到年小计基准值
          if (cell != null && String(cell).trim() !== "") {
            return safeNumber(cell);
          }
          // 非小计列无填报时保持空，禁止回退到 years 小计值（对齐 S8）
          if (normalizedTrimIndex !== defaultTrimIndex) return null;
        } else {
          const defaultValue = yearValues[defaultTrimIndex];
          if (defaultValue != null && String(defaultValue).trim() !== "") {
            return safeNumber(defaultValue);
          }
        }
      }
      if (
        versionYearTrimValues &&
        hasTrimIndex &&
        normalizedTrimIndex !== defaultTrimIndex
      ) {
        return null;
      }
      if (
        versionYearValues &&
        versionYearValues[normalizedYearIndex] != null &&
        (!hasTrimIndex || normalizedTrimIndex === defaultTrimIndex)
      ) {
        return safeNumber(versionYearValues[normalizedYearIndex]);
      }
      if (hasTrimIndex && versionTrimValues && normalizedYearIndex === 0) {
        const trimValue = versionTrimValues[normalizedTrimIndex];
        return trimValue != null ? safeNumber(trimValue) : null;
      }
      if (hasTrimIndex) return null;
    }
    if (hasTrimIndex && versionTrimValues) {
      const trimValue = versionTrimValues[normalizedTrimIndex];
      if (trimValue != null) return safeNumber(trimValue);
    }
    if (
      target[versionKey] != null &&
      (!hasTrimIndex || normalizedTrimIndex === defaultTrimIndex)
    ) {
      return safeNumber(target[versionKey]);
    }
    const direct = readVersionValueFromSourceDetail(
      itemOrId,
      versionKey,
      hasTrimIndex ? normalizedTrimIndex : defaultTrimIndex,
      hasYearIndex ? normalizedYearIndex : 0
    );
    if (direct != null) return direct;
    return null;
  }

  function getVersionValue(itemOrId, versionKey, trimIndex, yearIndex) {
    return getRawVersionValue(itemOrId, versionKey, trimIndex, yearIndex);
  }

  function resolveCalcSubjectMeta(item, group) {
    const formulaMeta = getReviewFormulaMeta(item, group) || {};
    return {
      ...formulaMeta,
      rowKind: normalizeText(item && (item.rowKind || item.rowType), formulaMeta.rowKind),
      valueSource: normalizeText(
        item && (item.valueSource || item.sourceType),
        formulaMeta.valueSource
      ),
    };
  }

  function isCalcInputSubject(item, group) {
    if (!item || typeof item !== "object") return false;
    const rowKind = normalizeText(item.rowKind || item.rowType).toLowerCase();
    if (rowKind) {
      return [REVENUE_ROW_KIND.INPUT, REVENUE_ROW_KIND.LINKED, REVENUE_ROW_KIND.EXTERNAL]
        .map((value) => String(value).toLowerCase())
        .includes(rowKind);
    }
    const valueSource = normalizeText(item.valueSource || item.sourceType).toLowerCase();
    if (valueSource) {
      return [
        REVENUE_VALUE_SOURCE.INPUT,
        REVENUE_VALUE_SOURCE.LINKED,
        REVENUE_VALUE_SOURCE.EXTERNAL,
        "fromsubtable",
        "subtable",
        "derivedfromsubtable",
      ].includes(valueSource);
    }
    const inputType = normalizeText(item.inputType).toLowerCase();
    if (inputType) {
      return !["calc", "formula", "computed", "calculation", "readonly"].includes(inputType);
    }
    const formulaMeta = getReviewFormulaMeta(item, group);
    if (!formulaMeta) return true;
    return ![REVENUE_ROW_KIND.FORMULA, REVENUE_ROW_KIND.ROW_SUBTOTAL, REVENUE_ROW_KIND.DISPLAY_AGGREGATE]
      .map((value) => String(value).toLowerCase())
      .includes(normalizeText(formulaMeta.rowKind).toLowerCase());
  }

  function orderCalcEditableFields(fields = []) {
    const next = Array.isArray(fields) ? fields.slice() : [];
    const designIndex = next.findIndex((field) => field && field.id === "design_cost");
    const volumeIndex = next.findIndex((field) => {
      if (!field) return false;
      return field.id === "proj_vol" || normalizeText(field.label) === "销量";
    });
    if (designIndex < 0 || volumeIndex < 0 || volumeIndex < designIndex) return next;
    const [volumeField] = next.splice(volumeIndex, 1);
    const nextDesignIndex = next.findIndex((field) => field && field.id === "design_cost");
    next.splice(Math.max(nextDesignIndex, 0), 0, volumeField);
    return next;
  }

  function buildCalcEditableFields(subjectList = []) {
    const fields = [];
    const seen = {};
    (Array.isArray(subjectList) ? subjectList : []).forEach((group) => {
      (group.items || []).forEach((item) => {
        if (!isCalcInputSubject(item, group)) return;
        const id = normalizeText(item && (item.templateId || item.id));
        if (!id || seen[id]) return;
        seen[id] = true;
        fields.push({
          id,
          label: normalizeText(item && item.name, id).replace(/^[\s\u3000]+/, ""),
          unit: normalizeText(item && item.unit, group && group.unit),
          rowKind: normalizeText(item && item.rowKind),
          valueSource: normalizeText(item && item.valueSource),
        });
      });
    });
    return orderCalcEditableFields(fields);
  }

  return {
    applyDataCheckPayload,
    resetCompareData,
    replaceCompareSources,
    upsertCompareSource,
    getCompareSourceList,
    buildSourceVersionsFromSources,
    buildSubjectsFromSourceDetails,
    buildCandidateValuesFromSourceDetails,
    syncReviewDimensionsFromSourceDetails,
    normalizeState,
    resetStateFromVersions,
    getDefaultBaselineVersionKey,
    getDefaultTrimIndex,
    resolveSubjectValueKeys,
    getRawVersionValue,
    getVersionValue,
    buildCalcEditableFields,
    getReviewFormulaMeta,
    resolveCalcSubjectPath,
    resolveCalcSubjectMeta,
    isCalcInputSubject,
    orderCalcEditableFields,
    normalizeSubjectMatchName,
    inferTemplateId,
    alignCompareSourceSubjects,
  };
}
