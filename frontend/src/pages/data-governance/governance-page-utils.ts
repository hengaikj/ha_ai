import { ApiBusinessError } from "@/api/http";
import { formatDate, formatDateTime } from "@/utils/formatters";

export const GOVERNANCE_EMPTY_VALUE = "-";

export function isGovernanceEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

export function formatGovernanceValue(value: unknown): string {
  return isGovernanceEmptyValue(value) ? GOVERNANCE_EMPTY_VALUE : String(value);
}

export function formatGovernanceCell(
  _row: unknown,
  _column: unknown,
  cellValue: unknown,
): string {
  return formatGovernanceValue(cellValue);
}

const GOVERNANCE_TRIGGER_TYPE_LABELS: Record<string, string> = {
  MANUAL: "手动触发",
  SYNC: "同步完成自动触发",
  QUARTZ: "定时触发",
  RETRY: "失败重试",
};

export function formatGovernanceTriggerType(value: unknown): string {
  if (isGovernanceEmptyValue(value)) {
    return GOVERNANCE_EMPTY_VALUE;
  }
  const normalized = String(value);
  return GOVERNANCE_TRIGGER_TYPE_LABELS[normalized] ?? normalized;
}

export function formatGovernanceAdsCell(
  column: { name: string; dataType?: string },
  value: unknown,
): string {
  if (isGovernanceEmptyValue(value)) {
    return GOVERNANCE_EMPTY_VALUE;
  }
  if (!isGovernanceTemporalColumn(column)) {
    return formatGovernanceValue(value);
  }

  const rawValue = String(value).trim();
  const formatted =
    isGovernanceDateOnlyColumn(column) || /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
      ? formatDate(rawValue)
      : formatDateTime(rawValue);
  return formatted === "--" ? formatGovernanceValue(value) : formatted;
}

function isGovernanceTemporalColumn(column: {
  name: string;
  dataType?: string;
}): boolean {
  if (/\b(date|datetime|timestamp|time)\b/i.test(column.dataType ?? "")) {
    return true;
  }

  const normalizedName = column.name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase();
  return /(^|_)(date|datetime|timestamp|time|at)(_|$)/.test(normalizedName);
}

function isGovernanceDateOnlyColumn(column: {
  name: string;
  dataType?: string;
}): boolean {
  return /^date(?:\s|\(|$)/i.test(column.dataType?.trim() ?? "");
}

export interface GovernancePageError {
  code: string;
  message: string;
  traceId?: string;
}

export function normalizeGovernanceError(
  error: unknown,
  fallbackMessage: string,
): GovernancePageError {
  if (error instanceof ApiBusinessError) {
    return {
      code: error.code,
      message: error.message,
      traceId: error.traceId,
    };
  }

  return {
    code: "FRONTEND-DATA-GOVERNANCE-001",
    message: fallbackMessage,
    traceId: "unknown",
  };
}
