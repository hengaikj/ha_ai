import type {
  CostAnalysisAiAnalysisQuery,
  CostAnalysisAiAnalysisResult,
  CostAnalysisAiDirection,
  CostAnalysisAiEvidence,
  CostAnalysisAiFinding,
  CostAnalysisCategoryLevel,
  CostAnalysisDifferenceDetailResult,
  CostAnalysisDifferenceDetailRow,
  CostAnalysisDifferenceDrillLevel,
} from "@/types/cost-analysis";
import {
  getCostAnalysisDimensionMaxLevel,
  normalizeCostAnalysisDimensionType,
} from "@/api/cost-analysis/dimensions";

type DetailLoader = (
  snapshotId: string,
  query: CostAnalysisAiAnalysisQuery,
) => Promise<CostAnalysisDifferenceDetailResult>;

interface CollectedDetail {
  query: CostAnalysisAiAnalysisQuery;
  result: CostAnalysisDifferenceDetailResult;
}

interface EvidenceRow {
  row: CostAnalysisDifferenceDetailRow;
  result: CostAnalysisDifferenceDetailResult;
}

interface FormationAssessment {
  finding: CostAnalysisAiFinding | null;
  headline: string;
}

interface BusinessAttributionAssessment {
  finding: CostAnalysisAiFinding | null;
  headline: string;
}

interface BusinessSignalDefinition {
  key: "TECHNICAL" | "PATTERN" | "SUPPLY" | "COST_BASIS" | "OWNERSHIP";
  label: string;
  repeatedLabel: string;
  fieldCodes: readonly string[];
  priority: number;
}

const MAX_FINDINGS = 4;
const COVERAGE_TARGET = 0.8;
const DOMINANT_SHARE = 0.5;
const OFFSET_SHARE = 0.1;
const UNRESOLVED_SHARE = 0.05;
const BUSINESS_SIGNAL_MIN_SHARE = 0.3;

const drillDepth: Record<CostAnalysisDifferenceDrillLevel, number> = {
  CATEGORY_1: 0,
  CATEGORY_2: 1,
  CATEGORY_3: 2,
  PART: 3,
};

const businessSignalDefinitions: readonly BusinessSignalDefinition[] = [
  {
    key: "TECHNICAL",
    label: "技术变更件集中",
    repeatedLabel: "技术变更反复出现",
    fieldCodes: [
      "ecrNumber",
      "iaNumber",
      "partVersion",
      "partTechDesc",
      "moduleIdentifier",
    ],
    priority: 1,
  },
  {
    key: "PATTERN",
    label: "版型用量调整",
    repeatedLabel: "版型用量反复调整",
    fieldCodes: ["unitQuantity"],
    priority: 2,
  },
  {
    key: "SUPPLY",
    label: "供货条件变化",
    repeatedLabel: "供货变化反复出现",
    fieldCodes: ["supplier"],
    priority: 3,
  },
  {
    key: "COST_BASIS",
    label: "成本口径变化",
    repeatedLabel: "成本口径反复变化",
    fieldCodes: ["currentCostSource", "amortizationAmount"],
    priority: 4,
  },
  {
    key: "OWNERSHIP",
    label: "责任归属变化",
    repeatedLabel: "责任归属反复变化",
    fieldCodes: ["costEngineer", "partAttribute"],
    priority: 5,
  },
] as const;

function tolerance(
  context: CostAnalysisDifferenceDetailResult["context"],
): number {
  return context.metric === "MIX" ? 0.0001 : 0.01;
}

function formatMetricValue(
  value: number,
  context: CostAnalysisDifferenceDetailResult["context"],
): string {
  return context.metric === "MIX"
    ? `${(Math.abs(value) * 100).toFixed(2)}%`
    : `${Math.abs(value).toFixed(2)} 元`;
}

function formatShare(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function direction(value: number | null): CostAnalysisAiDirection {
  if (value === null || value === 0) return "NEUTRAL";
  return value > 0 ? "INCREASE" : "DECREASE";
}

function buildChildQuery(
  query: CostAnalysisAiAnalysisQuery,
  row: CostAnalysisDifferenceDetailRow,
): CostAnalysisAiAnalysisQuery {
  const categoryLevel = (query.categoryLevel + 1) as CostAnalysisCategoryLevel;
  const terminalLevel = getCostAnalysisDimensionMaxLevel(
    normalizeCostAnalysisDimensionType(query.dimensionType),
  );
  return {
    ...query,
    categoryLevel,
    categoryId: row.objectId,
    ...(categoryLevel === terminalLevel ? { limit: 10 as const } : {}),
  };
}

async function collectDetails(
  snapshotId: string,
  query: CostAnalysisAiAnalysisQuery,
  loadDetail: DetailLoader,
): Promise<CollectedDetail[]> {
  const result = await loadDetail(snapshotId, query);
  const current = [{ query, result }];
  if (result.drillLevel === "PART") return current;

  const children = result.rows.filter(
    (row) => row.objectType === "CATEGORY" && row.hasChildren,
  );
  const descendants = await Promise.all(
    children.map((row) =>
      collectDetails(snapshotId, buildChildQuery(query, row), loadDetail),
    ),
  );
  return [...current, ...descendants.flat()];
}

function evidence(
  item: EvidenceRow,
  fieldCodes: string[] = [],
): CostAnalysisAiEvidence {
  return {
    objectType: item.row.objectType,
    objectId: item.row.objectId,
    objectCode: item.row.objectCode,
    objectName: item.row.objectName,
    categoryPath: [
      ...item.result.context.categoryPath.map(
        (category) => category.categoryName,
      ),
      item.row.objectName,
    ],
    fieldCodes,
  };
}

function sortByAbsoluteDifference(items: EvidenceRow[]): EvidenceRow[] {
  return [...items].sort(
    (left, right) =>
      Math.abs(right.row.difference ?? 0) -
        Math.abs(left.row.difference ?? 0) ||
      left.row.objectCode.localeCompare(right.row.objectCode),
  );
}

function absoluteTotal(items: EvidenceRow[]): number {
  return items.reduce((sum, { row }) => sum + Math.abs(row.difference ?? 0), 0);
}

function netTotal(items: EvidenceRow[]): number {
  return items.reduce((sum, { row }) => sum + (row.difference ?? 0), 0);
}

function selectCoveringRows(
  items: EvidenceRow[],
  target = COVERAGE_TARGET,
  limit = Number.POSITIVE_INFINITY,
): EvidenceRow[] {
  const sorted = sortByAbsoluteDifference(
    items.filter(({ row }) => row.difference !== null && row.difference !== 0),
  );
  const total = absoluteTotal(sorted);
  if (total === 0) return [];

  const selected: EvidenceRow[] = [];
  let cumulative = 0;
  for (const item of sorted) {
    if (selected.length >= limit) break;
    selected.push(item);
    cumulative += Math.abs(item.row.difference ?? 0);
    if (cumulative / total >= target) break;
  }
  return selected;
}

function sameDirectionRows(
  rows: EvidenceRow[],
  difference: number,
): EvidenceRow[] {
  return rows.filter(({ row }) => {
    const value = row.difference ?? 0;
    return value !== 0 && Math.sign(value) === Math.sign(difference);
  });
}

function objectLabel(rows: EvidenceRow[]): string {
  return rows[0]?.row.objectType === "PART" ? "零件" : "分类";
}

function names(items: EvidenceRow[], limit = 3): string {
  return items
    .slice(0, limit)
    .map(({ row }) => row.objectName)
    .join("、");
}

function concentratedLabel(
  context: CostAnalysisDifferenceDetailResult["context"],
  difference: number,
): string {
  if (context.traceType === "COST_VARIANCE") {
    return difference > 0 ? "少数项超目标" : "少数项低于目标";
  }
  if (context.metric === "CURRENT_COST") {
    return difference > 0 ? "少数项拉高" : "少数项拉低";
  }
  return difference > 0 ? "少数项上升" : "少数项下降";
}

function concentratedHeadline(
  context: CostAnalysisDifferenceDetailResult["context"],
  difference: number,
  itemNames: string,
  itemLabel: string,
): string {
  if (context.traceType === "COST_VARIANCE") {
    return difference > 0
      ? `超差集中在少数${itemLabel}，优先核查${itemNames}`
      : `低于目标的空间集中在少数${itemLabel}，主要是${itemNames}`;
  }
  if (context.metric === "CURRENT_COST") {
    return difference > 0
      ? `成本增加由少数${itemLabel}拉动，优先核查${itemNames}`
      : `成本下降主要来自少数${itemLabel}，主要是${itemNames}`;
  }
  return difference > 0
    ? `指标上升由少数${itemLabel}拉动，主要是${itemNames}`
    : `指标下降主要来自少数${itemLabel}，主要是${itemNames}`;
}

function accumulatedHeadline(
  context: CostAnalysisDifferenceDetailResult["context"],
  difference: number,
  itemLabel: string,
): string {
  if (context.traceType === "COST_VARIANCE") {
    return difference > 0
      ? `这不是单个${itemLabel}拉高，而是多处超目标累积`
      : `低于目标不是单个${itemLabel}形成，而是多处共同积累`;
  }
  if (context.metric === "CURRENT_COST") {
    return difference > 0
      ? `成本增加不是单个${itemLabel}造成，而是多处小额上涨累积`
      : `成本下降不是单个${itemLabel}形成，而是多处小额下降累积`;
  }
  return difference > 0
    ? `指标上升由多个${itemLabel}共同累积`
    : `指标下降由多个${itemLabel}共同累积`;
}

function accumulatedTitle(
  context: CostAnalysisDifferenceDetailResult["context"],
  difference: number,
): string {
  if (context.traceType === "COST_VARIANCE") {
    return difference > 0 ? "多处小额超目标共同累积" : "多处低于目标共同积累";
  }
  if (context.metric === "CURRENT_COST") {
    return difference > 0 ? "多处小额上涨共同累积" : "多处小额下降共同累积";
  }
  return difference > 0 ? "多处小额上升共同累积" : "多处小额下降共同累积";
}

function buildFormationAssessment(
  root: CostAnalysisDifferenceDetailResult,
  deepestRows: EvidenceRow[],
): FormationAssessment {
  const rootDifference = root.summary.difference ?? 0;
  if (Math.abs(rootDifference) <= tolerance(root.context)) {
    return { finding: null, headline: "" };
  }

  const leafDirectional = sortByAbsoluteDifference(
    sameDirectionRows(deepestRows, rootDifference),
  );
  const leafTotal = absoluteTotal(leafDirectional);
  if (leafDirectional.length === 0 || leafTotal === 0) {
    return { finding: null, headline: "" };
  }

  const topShare = Math.abs(leafDirectional[0].row.difference ?? 0) / leafTotal;
  const selected =
    topShare >= DOMINANT_SHARE
      ? [leafDirectional[0]]
      : selectCoveringRows(leafDirectional);
  const selectedShare = absoluteTotal(selected) / leafTotal;
  const label = objectLabel(leafDirectional);
  const selectedNames = names(selected);

  const rootRows = root.rows.map((row) => ({ row, result: root }));
  const rootDirectional = sameDirectionRows(rootRows, rootDifference);
  const rootCovering = selectCoveringRows(rootDirectional);
  const rootLooksSpread =
    root.drillLevel !==
      (deepestRows[0]?.result.drillLevel ?? root.drillLevel) &&
    rootCovering.length > 3 &&
    selected.length <= 3;

  if (rootLooksSpread) {
    return {
      headline: `上层看起来分散，向下看实际集中在${selectedNames}`,
      finding: {
        id: "formation-hidden-concentration",
        kind: "CONCENTRATION",
        label: "下钻后集中",
        title: `${selectedNames}是实际重点`,
        description: `上层需要 ${rootCovering.length} 个分类才能覆盖主要变化，继续下钻后，${selected.length} 个${label}已覆盖同向变化 ${formatShare(
          selectedShare,
        )}。`,
        direction: direction(rootDifference),
        metricValue: netTotal(selected),
        contributionRate: selectedShare,
        evidence: selected.map((item) => evidence(item)),
      },
    };
  }

  if (selected.length <= 3) {
    return {
      headline: concentratedHeadline(
        root.context,
        rootDifference,
        selectedNames,
        label,
      ),
      finding: {
        id: "formation-concentrated",
        kind: "CONCENTRATION",
        label: concentratedLabel(root.context, rootDifference),
        title: selectedNames,
        description: `继续下钻后，${selected.length} 个${label}覆盖同向变化 ${formatShare(
          selectedShare,
        )}，无需平均排查全部明细。`,
        direction: direction(rootDifference),
        metricValue: netTotal(selected),
        contributionRate: selectedShare,
        evidence: selected.map((item) => evidence(item)),
      },
    };
  }

  const topThree = leafDirectional.slice(0, 3);
  const topThreeShare = absoluteTotal(topThree) / leafTotal;
  return {
    headline: accumulatedHeadline(root.context, rootDifference, label),
    finding: {
      id: "formation-accumulated",
      kind: "DISTRIBUTION",
      label: "多点累积",
      title: accumulatedTitle(root.context, rootDifference),
      description: `没有单一主导项，前三项只覆盖同向变化 ${formatShare(
        topThreeShare,
      )}，需要 ${selected.length} 个重点${label}才能覆盖主要变化。`,
      direction: direction(rootDifference),
      metricValue: root.summary.difference,
      contributionRate: topThreeShare,
      evidence: topThree.map((item) => evidence(item)),
    },
  };
}

function buildOffsetFinding(
  rows: EvidenceRow[],
  root: CostAnalysisDifferenceDetailResult,
): CostAnalysisAiFinding | null {
  const rootDifference = root.summary.difference ?? 0;
  const positive = rows.filter(({ row }) => (row.difference ?? 0) > 0);
  const negative = rows.filter(({ row }) => (row.difference ?? 0) < 0);
  const positiveTotal = absoluteTotal(positive);
  const negativeTotal = absoluteTotal(negative);

  if (
    Math.abs(rootDifference) <= tolerance(root.context) &&
    positiveTotal > tolerance(root.context) &&
    negativeTotal > tolerance(root.context)
  ) {
    return {
      id: "offset",
      kind: "OFFSET",
      label: "净额掩盖",
      title: "表格净额看不出内部变动",
      description: `增加 ${formatMetricValue(
        positiveTotal,
        root.context,
      )}、降低 ${formatMetricValue(
        negativeTotal,
        root.context,
      )}，两边相互抵消后净额接近不变。`,
      direction: "NEUTRAL",
      metricValue: 0,
      contributionRate: null,
      evidence: sortByAbsoluteDifference([...positive, ...negative])
        .slice(0, 4)
        .map((item) => evidence(item)),
    };
  }

  const sameTotal = rootDifference > 0 ? positiveTotal : negativeTotal;
  const opposite = rootDifference > 0 ? negative : positive;
  const oppositeTotal = rootDifference > 0 ? negativeTotal : positiveTotal;
  if (sameTotal === 0 || oppositeTotal / sameTotal < OFFSET_SHARE) {
    return null;
  }

  const isVariance = root.context.traceType === "COST_VARIANCE";
  const label =
    rootDifference > 0
      ? isVariance
        ? "低于目标在抵消"
        : "下降项在抵消"
      : isVariance
        ? "超目标在回拉"
        : "上涨项在回拉";
  const title =
    rootDifference > 0
      ? isVariance
        ? "净超差小于实际超目标压力"
        : "净增幅小于实际上涨规模"
      : isVariance
        ? "低于目标的净空间被部分回拉"
        : "净降幅被部分上涨抵消";
  return {
    id: "offset",
    kind: "OFFSET",
    label,
    title,
    description: `同向变化累计 ${formatMetricValue(
      sameTotal,
      root.context,
    )}，反向项目抵消 ${formatMetricValue(
      oppositeTotal,
      root.context,
    )}，表格净额未体现全部变动规模。`,
    direction: rootDifference > 0 ? "DECREASE" : "INCREASE",
    metricValue: rootDifference > 0 ? -oppositeTotal : oppositeTotal,
    contributionRate: oppositeTotal / sameTotal,
    evidence: sortByAbsoluteDifference(opposite)
      .slice(0, 3)
      .map((item) => evidence(item)),
  };
}

function buildStructureFinding(
  partRows: EvidenceRow[],
  root: CostAnalysisDifferenceDetailResult,
): CostAnalysisAiFinding | null {
  if (root.context.traceType === "COST_VARIANCE" || partRows.length === 0) {
    return null;
  }
  const rootDifference = root.summary.difference ?? 0;
  if (Math.abs(rootDifference) <= tolerance(root.context)) return null;

  const directional = sameDirectionRows(partRows, rootDifference);
  const directionalTotal = absoluteTotal(directional);
  if (directionalTotal === 0) return null;

  const groups = (["ADDED", "REMOVED", "CHANGED"] as const)
    .map((status) => {
      const rows = directional.filter(({ row }) => row.status === status);
      return {
        status,
        rows,
        total: absoluteTotal(rows),
      };
    })
    .filter((group) => group.total > 0)
    .sort((left, right) => right.total - left.total);
  if (groups.length === 0) return null;

  const labels = {
    ADDED: "新增装配",
    REMOVED: "取消装配",
    CHANGED: "已有件调整",
  } as const;
  const strongest = groups[0];
  const strongestShare = strongest.total / directionalTotal;

  if (
    strongestShare < 0.6 &&
    groups[1] &&
    (strongest.total + groups[1].total) / directionalTotal >= COVERAGE_TARGET
  ) {
    const firstLabel = labels[strongest.status];
    const secondLabel = labels[groups[1].status];
    const selectedRows = sortByAbsoluteDifference([
      ...strongest.rows,
      ...groups[1].rows,
    ]).slice(0, 3);
    return {
      id: "structure-two-lines",
      kind: "STRUCTURE_CHANGE",
      label: "两条主线",
      title: `${firstLabel}和${secondLabel}共同形成主要成本变化`,
      description: `${firstLabel}占同向变化 ${formatShare(
        strongestShare,
      )}，${secondLabel}占 ${formatShare(
        groups[1].total / directionalTotal,
      )}，不能只排查其中一类。`,
      direction: direction(rootDifference),
      metricValue: strongest.total + groups[1].total,
      contributionRate: (strongest.total + groups[1].total) / directionalTotal,
      evidence: selectedRows.map((item) => evidence(item)),
    };
  }

  const label = labels[strongest.status];
  return {
    id: `structure-${strongest.status.toLowerCase()}`,
    kind: "STRUCTURE_CHANGE",
    label:
      strongest.status === "ADDED"
        ? "新增装配"
        : strongest.status === "REMOVED"
          ? "取消装配"
          : "已有件调整",
    title: `${label}是成本变化的主要来源`,
    description: `${label}覆盖同向变化 ${formatShare(
      strongestShare,
    )}，优先核查该类零件。`,
    direction: direction(rootDifference),
    metricValue: strongest.total,
    contributionRate: strongestShare,
    evidence: sortByAbsoluteDifference(strongest.rows)
      .slice(0, 3)
      .map((item) => evidence(item)),
  };
}

function buildTargetDeviationFinding(
  partRows: EvidenceRow[],
  root: CostAnalysisDifferenceDetailResult,
): CostAnalysisAiFinding | null {
  if (root.context.traceType !== "COST_VARIANCE") return null;

  const aboveTarget = partRows
    .filter(
      ({ row }) =>
        (row.difference ?? 0) > 0 &&
        row.baselineValue !== null &&
        row.baselineValue > 0,
    )
    .map((item) => ({
      item,
      rate: (item.row.difference ?? 0) / (item.row.baselineValue ?? 1),
    }));
  if (aboveTarget.length === 0) return null;

  const amountTop = [...aboveTarget].sort(
    (left, right) =>
      (right.item.row.difference ?? 0) - (left.item.row.difference ?? 0) ||
      left.item.row.objectCode.localeCompare(right.item.row.objectCode),
  )[0];
  const rateTop = [...aboveTarget].sort(
    (left, right) =>
      right.rate - left.rate ||
      left.item.row.objectCode.localeCompare(right.item.row.objectCode),
  )[0];

  if (amountTop.item.row.objectId === rateTop.item.row.objectId) {
    return {
      id: "target-deviation-same",
      kind: "TARGET_DEVIATION",
      label: "金额比例双高",
      title: `${amountTop.item.row.objectName}需优先核查`,
      description: `它既是超差金额最大的零件，也是相对目标偏离最高的零件，偏离目标 ${formatShare(
        amountTop.rate,
      )}。`,
      direction: "INCREASE",
      metricValue: amountTop.item.row.difference,
      contributionRate: amountTop.rate,
      evidence: [evidence(amountTop.item, ["costContribution"])],
    };
  }

  return {
    id: "target-deviation-split",
    kind: "TARGET_DEVIATION",
    label: "两类重点",
    title: "大额超差与高比例偏离不是同一零件",
    description: `${amountTop.item.row.objectName}的超差金额最高；${rateTop.item.row.objectName}相对目标偏离最高，为 ${formatShare(
      rateTop.rate,
    )}，两类对象都需要关注。`,
    direction: "INCREASE",
    metricValue: amountTop.item.row.difference,
    contributionRate: rateTop.rate,
    evidence: [
      evidence(amountTop.item, ["costContribution"]),
      evidence(rateTop.item, ["costContribution"]),
    ],
  };
}

function businessMovement(rootDifference: number): string {
  return rootDifference > 0 ? "上涨" : "下降";
}

function businessSignalTitle(
  definition: BusinessSignalDefinition,
  count: number,
): string {
  const prefix = `${count} 个重点零件`;
  if (definition.key === "TECHNICAL") {
    return `${prefix}同步发生技术状态变化`;
  }
  if (definition.key === "PATTERN") {
    return `${prefix}同步调整单车用量`;
  }
  if (definition.key === "SUPPLY") {
    return `${prefix}同步发生供货条件变化`;
  }
  if (definition.key === "COST_BASIS") {
    return `${prefix}同步发生成本口径变化`;
  }
  return `${prefix}同步发生责任归属变化`;
}

function businessSignalHeadline(
  definition: BusinessSignalDefinition,
  rootDifference: number,
  concentrated: boolean,
): string {
  if (!concentrated) {
    if (definition.key === "TECHNICAL") {
      return "重点核查零件中反复出现技术状态变化";
    }
    if (definition.key === "PATTERN") {
      return "重点核查零件中反复出现单车用量调整";
    }
    if (definition.key === "SUPPLY") {
      return "重点核查零件中反复出现供货条件变化";
    }
    if (definition.key === "COST_BASIS") {
      return "重点核查零件中反复出现成本口径变化";
    }
    return "重点核查零件中反复出现责任归属变化";
  }

  const movement = businessMovement(rootDifference);
  if (definition.key === "TECHNICAL") {
    return `已有件${movement}集中在技术状态变化的零件`;
  }
  if (definition.key === "PATTERN") {
    return `已有件${movement}集中在单车用量调整的零件`;
  }
  if (definition.key === "SUPPLY") {
    return `已有件${movement}集中在供货条件变化的零件`;
  }
  if (definition.key === "COST_BASIS") {
    return `已有件${movement}集中在成本口径变化的零件`;
  }
  return `已有件${movement}伴随责任归属变化`;
}

function businessSignalDescription(
  definition: BusinessSignalDefinition,
  rootDifference: number,
  share: number,
  fieldNames: string[],
): string {
  const movement = businessMovement(rootDifference);
  const base = `这些零件的成本差额占已有件${movement} ${formatShare(share)}`;
  if (definition.key === "TECHNICAL") {
    return `${base}，涉及${fieldNames.join("、")}，优先核查对应变更记录。`;
  }
  if (definition.key === "PATTERN") {
    return `${base}，优先核对当前版型装配数量。`;
  }
  if (definition.key === "SUPPLY") {
    return `${base}，优先核对供应商和供货记录。`;
  }
  if (definition.key === "COST_BASIS") {
    return `${base}，优先核对成本来源和摊销口径。`;
  }
  return `${base}，优先确认负责人员和零件归属是否同步更新。`;
}

function buildBusinessAttributionAssessment(
  deepestRows: EvidenceRow[],
  root: CostAnalysisDifferenceDetailResult,
): BusinessAttributionAssessment {
  const rootDifference = root.summary.difference ?? 0;
  if (
    rootDifference === 0 ||
    root.context.traceType === "COST_VARIANCE" ||
    root.context.metric !== "CURRENT_COST"
  ) {
    return { finding: null, headline: "" };
  }
  const changedRows = sameDirectionRows(deepestRows, rootDifference).filter(
    ({ row }) => row.objectType === "PART" && row.status === "CHANGED",
  );
  const changedTotal = absoluteTotal(changedRows);
  if (changedTotal === 0) return { finding: null, headline: "" };

  const keyRows = selectCoveringRows(changedRows, COVERAGE_TARGET, 10);
  const keyRowsTotal = absoluteTotal(keyRows);
  const allMatches = businessSignalDefinitions.map((definition) => {
    const rows = keyRows.flatMap((item) => {
      const fields = item.row.changedFields.filter(
        (field) =>
          definition.fieldCodes.includes(field.fieldCode) &&
          field.baselineValue !== field.comparisonValue,
      );
      return fields.length > 0 ? [{ item, fields }] : [];
    });
    const total = absoluteTotal(rows.map(({ item }) => item));
    return {
      definition,
      rows,
      total,
      share: total / changedTotal,
      focusShare: keyRowsTotal === 0 ? 0 : total / keyRowsTotal,
    };
  });
  const matches = allMatches
    .filter(
      (match) =>
        match.share >= BUSINESS_SIGNAL_MIN_SHARE ||
        (match.rows.length >= 2 && match.focusShare >= DOMINANT_SHARE),
    )
    .sort(
      (left, right) =>
        right.share - left.share ||
        right.rows.length - left.rows.length ||
        left.definition.priority - right.definition.priority,
    );
  const strongest = matches[0];
  if (!strongest) {
    const hasCoreBusinessChange = allMatches.some(
      (match) => match.definition.key !== "OWNERSHIP" && match.rows.length > 0,
    );
    if (hasCoreBusinessChange) {
      return { finding: null, headline: "" };
    }

    const unresolved = root.summary.unreconciledDifference;
    if (
      unresolved !== null &&
      Math.abs(unresolved) <= tolerance(root.context)
    ) {
      const selected = sortByAbsoluteDifference(changedRows).slice(0, 3);
      return {
        headline: "已有件变化缺少同步业务记录",
        finding: {
          id: "business-record-missing",
          kind: "BUSINESS_ATTRIBUTION",
          label: "缺少变更记录",
          title: "成本变化未找到同步业务记录",
          description:
            "重点已有件成本发生变化，但未找到同步的技术、版型、供货或成本口径记录，优先补查变更单和成本来源。",
          direction: direction(rootDifference),
          metricValue: netTotal(changedRows),
          contributionRate: null,
          evidence: selected.map((item) => evidence(item)),
        },
      };
    }
    return { finding: null, headline: "" };
  }

  const fieldNames = [
    ...new Set(
      strongest.rows.flatMap(({ fields }) =>
        fields.map((field) => field.fieldName),
      ),
    ),
  ];
  const concentrated = strongest.share >= BUSINESS_SIGNAL_MIN_SHARE;
  return {
    headline: businessSignalHeadline(
      strongest.definition,
      rootDifference,
      concentrated,
    ),
    finding: {
      id: `business-${strongest.definition.key.toLowerCase()}`,
      kind: "BUSINESS_ATTRIBUTION",
      label: concentrated
        ? strongest.definition.label
        : strongest.definition.repeatedLabel,
      title: businessSignalTitle(strongest.definition, strongest.rows.length),
      description: businessSignalDescription(
        strongest.definition,
        rootDifference,
        strongest.share,
        fieldNames,
      ),
      direction: direction(rootDifference),
      metricValue: netTotal(strongest.rows.map(({ item }) => item)),
      contributionRate: strongest.share,
      evidence: strongest.rows.slice(0, 3).map(({ item, fields }) =>
        evidence(
          item,
          fields.map((field) => field.fieldCode),
        ),
      ),
    },
  };
}

function buildUnresolvedFinding(
  root: CostAnalysisDifferenceDetailResult,
  incompletePartFacts = false,
): CostAnalysisAiFinding | null {
  if (incompletePartFacts) {
    return {
      id: "unresolved-incomplete-parts",
      kind: "UNRESOLVED",
      label: "明细未覆盖",
      title: "零件明细未覆盖全部变化",
      description:
        "当前零件明细不足以判断抵消关系、结构变化和业务关联，需要补充全量零件统计。",
      direction: "NEUTRAL",
      metricValue: null,
      contributionRate: null,
      evidence: [],
    };
  }

  const unresolved = root.summary.unreconciledDifference;
  const difference = root.summary.difference;
  if (unresolved === null || difference === null) return null;
  const unresolvedAbsolute = Math.abs(unresolved);
  const base = Math.max(Math.abs(difference), tolerance(root.context));
  if (
    unresolvedAbsolute <= tolerance(root.context) ||
    unresolvedAbsolute / base < UNRESOLVED_SHARE
  ) {
    return null;
  }
  return {
    id: "unresolved",
    kind: "UNRESOLVED",
    label: "明细未覆盖",
    title: `还有 ${formatMetricValue(unresolved, root.context)} 未解释`,
    description: "当前下级明细不足以完整说明表格净差异，需要补充聚合结果。",
    direction: "NEUTRAL",
    metricValue: unresolved,
    contributionRate: unresolvedAbsolute / base,
    evidence: [],
  };
}

function isDetailFactComplete(
  result: CostAnalysisDifferenceDetailResult,
): boolean {
  const currentTolerance = tolerance(result.context);
  const unreconciled = result.summary.unreconciledDifference;
  if (unreconciled === null || Math.abs(unreconciled) > currentTolerance) {
    return false;
  }
  if (result.drillLevel !== "PART") return true;

  const { allChildDifference, returnedDifference, otherDifference } =
    result.summary;
  return (
    allChildDifference !== null &&
    returnedDifference !== null &&
    otherDifference !== null &&
    Math.abs(otherDifference) <= currentTolerance &&
    Math.abs(returnedDifference - allChildDifference) <= currentTolerance
  );
}

function appendOffsetHeadline(
  headline: string,
  root: CostAnalysisDifferenceDetailResult,
  offset: CostAnalysisAiFinding | null,
): string {
  const rootDifference = root.summary.difference ?? 0;
  if (
    Math.abs(rootDifference) <= tolerance(root.context) &&
    offset?.label === "净额掩盖"
  ) {
    return "表面净额接近不变，但内部增减变动明显。";
  }

  const base =
    headline ||
    (root.context.traceType === "COST_VARIANCE"
      ? "当前超差未形成单一主导项"
      : "当前变化未形成单一主导项");
  if (!offset) return `${base}。`;

  if (rootDifference > 0) {
    return root.context.traceType === "COST_VARIANCE"
      ? `${base}，部分低于目标项正在抵消实际压力。`
      : `${base}，部分下降项正在抵消实际增幅。`;
  }
  return root.context.traceType === "COST_VARIANCE"
    ? `${base}，仍有部分超目标项在回拉。`
    : `${base}，仍有部分上涨项在回拉。`;
}

function structureHeadline(
  structure: CostAnalysisAiFinding | null,
  rootDifference: number,
): string {
  if (!structure) return "";
  const movement = rootDifference > 0 ? "成本上涨" : "成本下降";
  if (structure.id === "structure-added") {
    return `${movement}主要来自新增装配`;
  }
  if (structure.id === "structure-removed") {
    return `${movement}主要来自取消装配`;
  }
  if (structure.id === "structure-changed") {
    return `${movement}主要来自已有件调整`;
  }
  return structure.title;
}

function buildHeadline(
  root: CostAnalysisDifferenceDetailResult,
  formation: FormationAssessment,
  structure: CostAnalysisAiFinding | null,
  businessAttribution: BusinessAttributionAssessment,
  offset: CostAnalysisAiFinding | null,
): string {
  const rootDifference = root.summary.difference ?? 0;
  const formationHeadline =
    structureHeadline(structure, rootDifference) || formation.headline;
  const headline = businessAttribution.headline
    ? `${formationHeadline || "当前变化未形成单一主导项"}；${businessAttribution.headline}`
    : formationHeadline;
  return appendOffsetHeadline(headline, root, offset);
}

export async function buildMockCostAnalysisAiAnalysis(
  snapshotId: string,
  query: CostAnalysisAiAnalysisQuery,
  loadDetail: DetailLoader,
): Promise<CostAnalysisAiAnalysisResult> {
  const details = await collectDetails(snapshotId, query, loadDetail);
  const root = details[0].result;
  const deepestDrillLevel = details.reduce(
    (deepest, detail) =>
      drillDepth[detail.result.drillLevel] > drillDepth[deepest]
        ? detail.result.drillLevel
        : deepest,
    root.drillLevel,
  );
  const rows: EvidenceRow[] = details.flatMap(({ result }) =>
    result.rows.map((row) => ({ row, result })),
  );
  const categoryRows = rows.filter(({ row }) => row.objectType === "CATEGORY");
  const partRows = rows.filter(({ row }) => row.objectType === "PART");
  const deepestRows =
    deepestDrillLevel === "PART"
      ? partRows
      : rows.filter(({ result }) => result.drillLevel === deepestDrillLevel);
  const reconciliationWarningCount = details.filter(({ result }) => {
    const unreconciled = result.summary.unreconciledDifference;
    return (
      unreconciled !== null &&
      Math.abs(unreconciled) > tolerance(result.context)
    );
  }).length;
  const incompletePartDetailCount = details.filter(
    ({ result }) =>
      result.drillLevel === "PART" && !isDetailFactComplete(result),
  ).length;
  const rootDifference = root.summary.difference;
  const deepestNet = netTotal(deepestRows);
  const deepestNetReconciled =
    rootDifference !== null &&
    Math.abs(deepestNet - rootDifference) <= tolerance(root.context);
  const factsReconciled =
    reconciliationWarningCount === 0 &&
    incompletePartDetailCount === 0 &&
    deepestNetReconciled;
  const partFactsUsable = deepestDrillLevel !== "PART" || factsReconciled;

  const formation = partFactsUsable
    ? buildFormationAssessment(root, deepestRows)
    : { finding: null, headline: "" };
  const offset = partFactsUsable ? buildOffsetFinding(deepestRows, root) : null;
  const structure = partFactsUsable
    ? buildStructureFinding(partRows, root)
    : null;
  const targetDeviation = partFactsUsable
    ? buildTargetDeviationFinding(partRows, root)
    : null;
  const businessAttribution = partFactsUsable
    ? buildBusinessAttributionAssessment(deepestRows, root)
    : { finding: null, headline: "" };
  const unresolved = buildUnresolvedFinding(root, !partFactsUsable);

  const limitations = [
    "业务变化字段只作为核查线索，不作为未经公式验证的金额归因。",
  ];
  if (deepestDrillLevel !== "PART") {
    limitations.push("当前指标按现有下钻规则只分析到分类层。");
  }

  return {
    snapshotId,
    context: root.context,
    rootDrillLevel: root.drillLevel,
    deepestDrillLevel,
    headline: partFactsUsable
      ? buildHeadline(root, formation, structure, businessAttribution, offset)
      : "当前明细不足以完整说明差异，需补充全量零件统计。",
    findings: (partFactsUsable
      ? root.context.traceType === "POINT_COMPARISON"
        ? [
            structure,
            businessAttribution.finding,
            formation.finding,
            offset,
            unresolved,
          ]
        : [formation.finding, targetDeviation, offset, unresolved]
      : [unresolved]
    )
      .filter((finding): finding is CostAnalysisAiFinding => Boolean(finding))
      .slice(0, MAX_FINDINGS),
    scope: {
      analyzedCategoryCount: new Set(
        categoryRows.map(({ row }) => row.objectId),
      ).size,
      analyzedPartCount: new Set(partRows.map(({ row }) => row.objectId)).size,
      analyzedFieldChangeCount: deepestRows.reduce(
        (count, { row }) => count + row.changedFields.length,
        0,
      ),
    },
    dataQuality: {
      explanationRate: root.summary.explanationRate,
      unreconciledDifference: root.summary.unreconciledDifference,
      reconciliationWarningCount,
      factsReconciled,
      incompletePartDetailCount,
    },
    limitations,
    generatedAt: new Date().toISOString(),
  };
}
