import type {
  CommitteeGateMaterial,
  CommitteeMaterialTemplateItem,
} from "@/types/committee";

export interface CommitteeMaterialOption {
  key: string;
  label: string;
  requirement: string;
  categoryKey: string;
}

export interface CommitteeMaterialCategory {
  key: string;
  label: string;
  description: string;
  materials: CommitteeMaterialOption[];
}

export const committeeMaterialCategories: CommitteeMaterialCategory[] = [
  {
    key: "project-init",
    label: "项目立项材料",
    description: "用于说明项目背景、目标和立项依据。",
    materials: [
      { key: "project-proposal", label: "项目建议书", requirement: "项目背景、目标及预期收益概述。", categoryKey: "project-init" },
      { key: "project-init-plan", label: "项目立项计划", requirement: "里程碑、节奏和主要资源安排。", categoryKey: "project-init" },
      { key: "business-requirement-input", label: "业务需求输入表", requirement: "需求来源、边界和职责分工。", categoryKey: "project-init" },
    ],
  },
  {
    key: "market-demand",
    label: "市场与需求材料",
    description: "用于判断市场、客户需求和竞品情况。",
    materials: [
      { key: "market-research-report", label: "市场调研报告", requirement: "目标市场容量、趋势与客户洞察。", categoryKey: "market-demand" },
      { key: "customer-demand-list", label: "客户需求清单", requirement: "客户侧关键诉求与配置要求。", categoryKey: "market-demand" },
      { key: "competitor-analysis", label: "竞品分析材料", requirement: "竞品方案、价格与差异化对比。", categoryKey: "market-demand" },
    ],
  },
  {
    key: "cost-estimation",
    label: "成本测算材料",
    description: "用于形成成本口径、收益判断和敏感项分析。",
    materials: [
      { key: "investment-income", label: "投资收益测算", requirement: "项目投资、收入预测、收益和回收周期测算。", categoryKey: "cost-estimation" },
      { key: "cost-target", label: "成本目标测算", requirement: "目标成本、成本构成和达成风险说明。", categoryKey: "cost-estimation" },
      { key: "bom-cost-analysis", label: "BOM 成本分析", requirement: "核心零部件、系统成本和变动原因。", categoryKey: "cost-estimation" },
      { key: "sensitivity-analysis", label: "敏感性分析表", requirement: "销量、售价、成本变动对收益的影响。", categoryKey: "cost-estimation" },
    ],
  },
  {
    key: "technical-plan",
    label: "技术方案材料",
    description: "用于说明技术路径、方案成熟度和实现边界。",
    materials: [
      { key: "product-definition", label: "产品定义书", requirement: "车型定位、配置边界和关键产品指标。", categoryKey: "technical-plan" },
      { key: "technical-plan-report", label: "技术方案说明", requirement: "关键技术路线、系统方案和技术风险说明。", categoryKey: "technical-plan" },
      { key: "architecture-boundary", label: "架构边界说明", requirement: "平台、系统和接口边界说明。", categoryKey: "technical-plan" },
    ],
  },
  {
    key: "manufacturing-resource",
    label: "制造与资源材料",
    description: "用于确认制造准备、资源保障和量产条件。",
    materials: [
      { key: "manufacturing-feasibility", label: "制造可行性分析", requirement: "制造资源、工艺能力、产能与节拍分析。", categoryKey: "manufacturing-resource" },
      { key: "resource-plan", label: "资源保障计划", requirement: "关键资源、产能和协同保障安排。", categoryKey: "manufacturing-resource" },
      { key: "supply-chain-plan", label: "供应链准备计划", requirement: "供应商、采购节奏和关键件保障。", categoryKey: "manufacturing-resource" },
    ],
  },
  {
    key: "risk-review",
    label: "风险与评审材料",
    description: "用于识别项目风险并支撑评审结论。",
    materials: [
      { key: "quality-risk", label: "质量风险清单", requirement: "质量风险、验证计划和问题闭环要求。", categoryKey: "risk-review" },
      { key: "compliance-risk", label: "合规风险说明", requirement: "法规、认证和合规边界说明。", categoryKey: "risk-review" },
      { key: "meeting-material", label: "上会汇报材料", requirement: "产品委员会汇报稿、提请决策事项和附件。", categoryKey: "risk-review" },
    ],
  },
];

export const committeeMaterialOptions = committeeMaterialCategories.flatMap(
  (category) => category.materials,
);

export const defaultCommitteeMaterialKeys = committeeMaterialOptions
  .slice(0, 6)
  .map((item) => item.key);

function defaultTemplateItems(): CommitteeMaterialTemplateItem[] {
  return committeeMaterialOptions.map((item, index) => ({
    key: item.key,
    label: item.label,
    requirement: item.requirement,
    categoryKey: item.categoryKey,
    sortNo: index + 1,
  }));
}

function keysToTemplateItems(keys: string[]): CommitteeMaterialTemplateItem[] {
  const optionMap = new Map(committeeMaterialOptions.map((item) => [item.key, item]));
  return keys
    .map<CommitteeMaterialTemplateItem | null>((key, index) => {
      const option = optionMap.get(key);
      if (!option) return null;
      return {
        key: option.key,
        label: option.label,
        requirement: option.requirement,
        categoryKey: option.categoryKey,
        sortNo: index + 1,
      };
    })
    .filter((item): item is CommitteeMaterialTemplateItem => item !== null);
}

export function parseMaterialTemplateItems(
  templateJson?: string | null,
): CommitteeMaterialTemplateItem[] {
  if (!templateJson) return defaultTemplateItems();
  try {
    const parsed = JSON.parse(templateJson) as {
      materialKeys?: unknown;
      materials?: unknown;
    };
    if (Array.isArray(parsed.materials)) {
      const items = parsed.materials
        .map<CommitteeMaterialTemplateItem | null>((item, index) => {
          const record = item as Partial<CommitteeMaterialTemplateItem>;
          const key = String(record.key ?? "").trim();
          const label = String(record.label ?? record.fileName ?? "").trim();
          const categoryKey = String(record.categoryKey ?? "").trim();
          if (!key || !label || !categoryKey) return null;
          return {
            key,
            label,
            requirement: record.requirement ?? "",
            categoryKey,
            attachmentId: record.attachmentId ?? null,
            fileName: record.fileName ?? null,
            fileSize: record.fileSize ?? null,
            fileType: record.fileType ?? null,
            sortNo: record.sortNo ?? index + 1,
          };
        })
        .filter((item): item is CommitteeMaterialTemplateItem => item !== null);
      if (items.length) return items;
    }
    if (Array.isArray(parsed.materialKeys)) {
      const keys = parsed.materialKeys.map(String);
      return keys.length ? keysToTemplateItems(keys) : defaultTemplateItems();
    }
  } catch {
    return defaultTemplateItems();
  }
  return defaultTemplateItems();
}

export function parseMaterialTemplateKeys(templateJson?: string | null) {
  return parseMaterialTemplateItems(templateJson)
    .map((item) => item.key)
    .filter((key): key is string => Boolean(key));
}

export function stringifyMaterialTemplateItems(
  materials: CommitteeMaterialTemplateItem[],
) {
  const orderedMaterials = materials.map((item, index) => ({
    ...item,
    sortNo: index + 1,
  }));
  return JSON.stringify({
    materialKeys: orderedMaterials.map((item) => item.key).filter(Boolean),
    materials: orderedMaterials,
  });
}

export function stringifyMaterialTemplateKeys(materialKeys: string[]) {
  return stringifyMaterialTemplateItems(keysToTemplateItems(materialKeys));
}

export function buildGateMaterials(
  materialKeysOrItems: string[] | CommitteeMaterialTemplateItem[],
): CommitteeGateMaterial[] {
  const items =
    typeof materialKeysOrItems[0] === "string"
      ? keysToTemplateItems(materialKeysOrItems as string[])
      : (materialKeysOrItems as CommitteeMaterialTemplateItem[]);
  const materials: CommitteeGateMaterial[] = [];
  items.forEach((item, index) => {
    const category = committeeMaterialCategories.find(
      (candidate) => candidate.key === item.categoryKey,
    );
    const name = item.materialName ?? item.label ?? item.fileName ?? "未命名材料";
    materials.push({
      id: `pending-${item.key ?? item.id ?? index}-${index}`,
      gateId: "pending",
      materialName: name,
      materialRequirement: item.materialRequirement ?? item.requirement ?? item.fileName ?? "",
      materialType: category?.label ?? "",
      sourceTemplateId: item.attachmentId ?? null,
      sortNo: index + 1,
    });
  });
  return materials;
}
