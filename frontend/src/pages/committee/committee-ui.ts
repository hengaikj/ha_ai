import type { CommitteeMeetingLevel } from "@/types/committee";

export const committeeStatusLabels: Record<string, string> = {
  IN_PROGRESS: "进行中",
  PASSED: "已通过",
  ARCHIVED: "已归档",
  NOT_STARTED: "未开始",
  DRAFT: "草稿",
  PENDING_APPROVAL: "待负责人审批",
  APPROVED: "已同意",
  WAITING_MEETING: "待上会",
  REJECTED: "已驳回",
  PREPARING: "待上会",
  READY: "可上会",
  CUTOFF_LOCKED: "已封存",
  CONCLUDED: "已形成结论",
  REVISING: "修订中",
  CANCELLED: "已取消",
  VOIDED: "已作废",
  PENDING: "待整改",
  SUBMITTED: "待验收",
  ACCEPTED: "已验收",
  EFFECTIVE: "已生效",
  PENDING_CONFIRMATION: "待异人确认",
  SUPERSEDED: "已替代",
  PASS: "通过",
  CONDITIONAL_PASS: "带条件通过",
  FAIL: "不通过",
  DEFERRED: "暂缓",
  LOCKED: "已锁定",
};

export function committeeStatusLabel(value?: string): string {
  return value ? (committeeStatusLabels[value] ?? value) : "--";
}

const committeeReviewStageLabels: Record<string, string> = {
  INITIAL: "初始评审",
  initial_review: "初始评审",
  SECOND_POST: "二级会后重新评审",
  second_post_meeting_review: "二级会后重新评审",
  GROUP_PRE: "集团会前评审",
  group_pre_meeting_review: "集团会前评审",
  RETURNED: "不通过后重新评审",
  returned_after_fail: "不通过后重新评审",
};

export function committeeReviewStageLabel(value?: string | null): string {
  return value ? (committeeReviewStageLabels[value] ?? value) : "--";
}

export function committeeTagType(value?: string) {
  if (
    [
      "PASSED",
      "APPROVED",
      "ACCEPTED",
      "EFFECTIVE",
      "PASS",
      "CONCLUDED",
    ].includes(value ?? "")
  )
    return "success";
  if (value === "WAITING_MEETING") return "info";
  if (["REJECTED", "FAIL", "VOIDED"].includes(value ?? "")) return "danger";
  if (
    [
      "PENDING_APPROVAL",
      "PENDING_CONFIRMATION",
      "CONDITIONAL_PASS",
      "REVISING",
    ].includes(value ?? "")
  )
    return "warning";
  return "info";
}

export function committeeLevelLabel(level: CommitteeMeetingLevel): string {
  return level === "SECOND" ? "品牌公司产品委员会" : "集团产品委员会";
}

export function committeeDepartmentGroupLabel(
  value?: string | null,
  companyName?: string | null,
): string {
  if (value === "SECOND_COMPANY" || value === "SECOND") {
    return String(companyName ?? "").trim() || "品牌公司职能部室";
  }
  if (value === "GROUP") {
    return "集团部室及管委会办公室";
  }
  return value || "--";
}

export function committeeDepartmentGroupByStage(value?: string | null): string {
  const stage = String(value ?? "").trim();
  return stage === "GROUP" ? "GROUP" : "SECOND_COMPANY";
}

export function committeeRows<T>(value: T[] | { rows: T[] }): T[] {
  return Array.isArray(value) ? value : (value.rows ?? []);
}

export function committeeTotal<T>(
  value: T[] | { rows: T[]; total: number | string },
): number | string {
  return Array.isArray(value) ? value.length : value.total;
}

export type CommitteeDecisionItem = {
  id: string;
  value: string;
};

export function parseCommitteeDecisionConclusion(
  value?: string | null,
): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const obj = parsed as { conclusion?: unknown; decisionConclusion?: unknown };
      if (typeof obj.conclusion === "string") return obj.conclusion.trim();
      if (typeof obj.decisionConclusion === "string") {
        return obj.decisionConclusion.trim();
      }
    }
  } catch {
    return "";
  }
  return "";
}

/**
 * 格式化图表 X 轴类目标签：
 * 超过固定字数换行，如果有括号也在括号前换行
 */
export function formatCommitteeChartXAxisLabel(
  value: string,
  maxCharsPerLine = 8,
): string {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  // 1. 如果包含括号，先在括号前拆分为前部与括号部分（支持中英文括号）
  const bracketIndex = raw.search(/[(（]/);
  const parts: string[] = [];

  if (bracketIndex > 0) {
    const beforeBracket = raw.slice(0, bracketIndex).trim();
    const fromBracket = raw.slice(bracketIndex).trim();
    if (beforeBracket) parts.push(beforeBracket);
    if (fromBracket) parts.push(fromBracket);
  } else {
    parts.push(raw);
  }

  // 2. 对每个部分如果超过固定字数则折行
  const lines: string[] = [];
  for (const part of parts) {
    // 若为括号日期或说明整体（如 "(12月 30日)"），且长度适中，保持单行完整展示
    if (/^[(（].*[)）]$/.test(part) && part.length <= 11) {
      lines.push(part);
      continue;
    }

    if (part.length <= maxCharsPerLine) {
      lines.push(part);
    } else {
      for (let i = 0; i < part.length; i += maxCharsPerLine) {
        lines.push(part.slice(i, i + maxCharsPerLine));
      }
    }
  }

  return lines.join("\n");
}

export function parseCommitteeDecisionItems(
  value?: string | null,
): CommitteeDecisionItem[] {
  const text = String(value ?? "").trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as unknown;
    let list: unknown[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as { items?: unknown; list?: unknown; rows?: unknown };
      if (Array.isArray(obj.items)) {
        list = obj.items;
      } else if (Array.isArray(obj.list)) {
        list = obj.list;
      } else if (Array.isArray(obj.rows)) {
        list = obj.rows;
      } else {
        return [{ id: "decision-item-1", value: text }];
      }
    } else {
      return [{ id: "decision-item-1", value: text }];
    }
    return list
      .map((item, index): CommitteeDecisionItem | undefined => {
        if (typeof item === "string") {
          return { id: `decision-item-${index + 1}`, value: item };
        }
        if (typeof item !== "object" || item === null) return undefined;
        const row = item as Record<string, unknown>;
        if (typeof row.value !== "string") return undefined;
        return {
          id:
            typeof row.id === "string" && row.id.trim()
              ? row.id
              : `decision-item-${index + 1}`,
          value: row.value,
        };
      })
      .filter(
        (item): item is CommitteeDecisionItem =>
          Boolean(item && item.value.trim()),
      );
  } catch {
    return [{ id: "decision-item-1", value: text }];
  }
}

/**
 * 规范化金额数值输入：支持正负数、小数，仅允许输入数字、首位负号和小数点，禁止输入中英文及特殊符号
 * @param value 输入内容
 * @param allowNegative 是否允许输入负数，默认 true
 * @returns 规范化后的数字和小数文本
 */
export function sanitizeAmountInput(
  value: string | number | null | undefined,
  allowNegative = true,
): string {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  // 检查是否为负数（去除前导非数字非负号字符后判断是否以负号开头）
  const trimmed = raw.replace(/^[^\d\-]+/, "");
  const isNegative =
    allowNegative && (raw.startsWith("-") || trimmed.startsWith("-"));

  // 移除非数字和小数点字符（彻底过滤中英文字符、特殊符号及空格等）
  let sanitized = raw.replace(/[^\d.]/g, "");

  // 处理多余小数点：只保留第一个小数点
  const dotIndex = sanitized.indexOf(".");
  if (dotIndex !== -1) {
    sanitized =
      sanitized.slice(0, dotIndex + 1) +
      sanitized.slice(dotIndex + 1).replace(/\./g, "");
  }

  // 若以小数点开头，自动补充前导 0（例如 ".5" -> "0.5"）
  if (sanitized.startsWith(".")) {
    sanitized = `0${sanitized}`;
  }

  // 移除多余的前导 0（例如 "05" -> "5", "00" -> "0"），但不影响 "0.xx" 与单一 "0"
  sanitized = sanitized.replace(/^0+(?=\d)/, "");

  if (isNegative) {
    // 若用户仅输入了 "-"，保留 "-" 方便用户继续输入后续数字
    if (!sanitized) {
      return "-";
    }
    return `-${sanitized}`;
  }

  return sanitized;
}

/**
 * 格式化金额输入显示（输入框 formatter）：为整数部分添加千分位逗号，保持小数与负数输入流体验
 */
export function formatAmountInput(
  value: string | number | null | undefined,
  allowNegative = true,
): string {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  // 检查是否为负数
  const trimmed = raw.replace(/^[^\d\-]+/, "");
  const isNegative =
    allowNegative && (raw.startsWith("-") || trimmed.startsWith("-"));

  // 移除非数字和小数点
  const clean = raw.replace(/[^\d.]/g, "");
  if (!clean) return isNegative ? "-" : "";

  // 处理多余小数点，只保留首个
  const dotIndex = clean.indexOf(".");
  let integerPart = dotIndex !== -1 ? clean.slice(0, dotIndex) : clean;
  const decimalPart =
    dotIndex !== -1 ? clean.slice(dotIndex + 1).replace(/\./g, "") : undefined;

  // 去除多余前导 0
  integerPart = integerPart.replace(/^0+(?=\d)/, "");
  const formattedInteger = (integerPart || "0").replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );

  let result = isNegative ? `-${formattedInteger}` : formattedInteger;
  if (decimalPart !== undefined) {
    result += `.${decimalPart}`;
  }
  return result;
}

/**
 * 解析金额输入（输入框 parser）：剥除非法字符及千分位逗号，保留纯数字、首位负号及小数点
 */
export function parseAmountInput(
  value: string | number | null | undefined,
  allowNegative = true,
): string {
  return sanitizeAmountInput(value, allowNegative);
}

/**
 * 失焦时规范化数值：自动补齐/保留两位小数（例如 "205570" -> "205570.00", "0" -> "0.00"）
 */
export function normalizeAmountOnBlur(
  value: string | number | null | undefined,
  allowNegative = true,
): string {
  if (value === null || value === undefined) return "";
  const sanitized = sanitizeAmountInput(value, allowNegative);
  if (!sanitized || sanitized === "-" || sanitized === "-0") {
    return "";
  }
  const num = Number(sanitized);
  if (!Number.isFinite(num) || (!allowNegative && num < 0)) {
    return "";
  }
  return num.toFixed(2);
}

/**
 * 针对仅允许非负数的金额输入处理函数（用于成本输入等不可为负数的场景）
 */
export const formatPositiveAmountInput = (
  value: string | number | null | undefined,
) => formatAmountInput(value, false);

export const parsePositiveAmountInput = (
  value: string | number | null | undefined,
) => parseAmountInput(value, false);

export const normalizePositiveAmountOnBlur = (
  value: string | number | null | undefined,
) => normalizeAmountOnBlur(value, false);

export const sanitizePositiveAmountInput = (
  value: string | number | null | undefined,
) => sanitizeAmountInput(value, false);

/**
 * 格式化金额用于展示（只读单元格等）：标准千分位展示并保留两位小数（例如 205570 -> "205,570.00"）
 */
export function formatAmountDisplay(
  value: string | number | null | undefined,
  fallback = "0.00",
): string {
  if (value === null || value === undefined) return fallback;
  const sanitized = sanitizeAmountInput(value);
  if (!sanitized || sanitized === "-" || sanitized === "-0") {
    return fallback;
  }
  const num = Number(sanitized);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface ChartYAxisScale {
  min: number;
  max: number;
  interval: number;
}

/**
 * 获取规范的优美步长（Nice Interval）
 * 步长倍数基于人类心算舒适的十进制标准序列：1, 2, 2.5, 5, 10
 */
function getNiceInterval(span: number, targetSplits = 4): number {
  if (span <= 0) return 1;
  const rough = span / Math.max(1, targetSplits);
  const exponent = Math.floor(Math.log10(rough));
  const power = Math.pow(10, exponent);
  const fraction = rough / power;

  let multiplier = 10;
  if (fraction <= 1.1) {
    multiplier = 1;
  } else if (fraction <= 2.2) {
    multiplier = 2;
  } else if (fraction <= 3.0) {
    multiplier = 2.5;
  } else if (fraction <= 6.0) {
    multiplier = 5;
  }

  return multiplier * power;
}

/**
 * 智能自适应计算图表 Y 轴刻度范围与步长
 * - 0 刻度线必须准确对齐网格线（min 和 max 都是 interval 的整数倍）
 * - 正向与负向按实际数据量级分别计算占用段数，杜绝强制 1:1 对称造成的巨大空白浪费
 * - 纯正数或纯负数场景完全兼容原有使用体验
 */
export function calculateChartYAxisScale(
  values: (number | string | null | undefined)[],
): ChartYAxisScale {
  const validValues = (values || [])
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((v) => typeof v === "number" && Number.isFinite(v));

  const maxValue = Math.max(...validValues, 0);
  const minValue = Math.min(...validValues, 0);

  if (maxValue <= 0 && minValue >= 0) {
    return { min: 0, max: 100, interval: 25 };
  }

  // 1. 纯正数场景
  if (minValue >= 0) {
    const targetMax = maxValue * 1.12;
    let interval = getNiceInterval(targetMax, 4);
    let posSegments = Math.max(1, Math.ceil(targetMax / interval));
    while (posSegments > 6) {
      interval *= 2;
      posSegments = Math.max(1, Math.ceil(targetMax / interval));
    }
    return {
      min: 0,
      max: Number((posSegments * interval).toFixed(2)),
      interval: Number(interval.toFixed(2)),
    };
  }

  // 2. 纯负数场景
  if (maxValue <= 0) {
    const targetAbs = Math.abs(minValue) * 1.12;
    let interval = getNiceInterval(targetAbs, 4);
    let negSegments = Math.max(1, Math.ceil(targetAbs / interval));
    while (negSegments > 6) {
      interval *= 2;
      negSegments = Math.max(1, Math.ceil(targetAbs / interval));
    }
    return {
      min: -Number((negSegments * interval).toFixed(2)),
      max: 0,
      interval: Number(interval.toFixed(2)),
    };
  }

  // 3. 正负数混合场景（自适应正负比例，避免空白浪费）
  const targetPos = maxValue * 1.12;
  const targetNeg = Math.abs(minValue) * 1.12;
  const totalSpan = targetPos + targetNeg;

  let interval = getNiceInterval(totalSpan, 5);
  let posSegments = Math.max(1, Math.ceil(targetPos / interval));
  let negSegments = Math.max(1, Math.ceil(targetNeg / interval));

  // 总刻度段数控制在 7 段以内，避免刻度线过于密集
  while (posSegments + negSegments > 7) {
    interval *= 2;
    posSegments = Math.max(1, Math.ceil(targetPos / interval));
    negSegments = Math.max(1, Math.ceil(targetNeg / interval));
  }

  const calculatedMin = -Number((negSegments * interval).toFixed(2));
  return {
    min: calculatedMin === 0 ? 0 : calculatedMin,
    max: Number((posSegments * interval).toFixed(2)),
    interval: Number(interval.toFixed(2)),
  };
}

/**
 * 格式化进度条阀点日期：只展示月日（例如 2026-09-16 -> 09-16）
 */
export function formatTimelinePointDate(date?: string): string {
  if (!date) return "";
  const str = String(date).trim();
  const match = str.match(/^\d{4}([-/.])(\d{1,2}\1\d{1,2})$/);
  if (match) {
    return match[2];
  }
  const parts = str.split(/[-/.]/);
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[1]}-${parts[2]}`;
  }
  return str;
}

