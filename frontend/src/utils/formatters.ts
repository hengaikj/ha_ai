export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  return numericValue.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(
  numerator: number | string | null | undefined,
  denominator?: number | string | null,
): string {
  const numericNumerator = Number(numerator ?? 0);
  const numericDenominator =
    denominator === undefined ? 1 : Number(denominator);

  if (
    !Number.isFinite(numericNumerator) ||
    !Number.isFinite(numericDenominator)
  ) {
    return "--";
  }

  if (numericDenominator === 0) {
    return "0.00%";
  }

  return `${((numericNumerator / numericDenominator) * 100).toFixed(2)}%`;
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
): string {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  const date = value instanceof Date ? value : parseDateTime(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatDate(
  value: string | number | Date | null | undefined,
): string {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
    if (match) {
      const [, year, month, day] = match;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      if (
        parsed.getFullYear() === Number(year) &&
        parsed.getMonth() === Number(month) - 1 &&
        parsed.getDate() === Number(day)
      ) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateTime(value: string | number): Date {
  if (typeof value !== "string") {
    return new Date(value);
  }
  const localDateTime = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/,
  );
  if (!localDateTime) {
    return new Date(value);
  }
  const [, year, month, day, hour, minute, second] = localDateTime;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

/**
 * 财务千分位格式化函数
 * 支持数值与包含数字的字符串，保持原本的小数位精度，整数部分按3位添加英文逗号
 * 若为0则显示为"0"，若为空/无效输入则返回 fallback（默认 "--"）
 */
export function formatFinancialNumber(
  value: number | string | null | undefined,
  fallback = "--",
): string {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  if (str === "" || str === "--" || str === "-") return fallback;

  // 移除已有千分位逗号
  const cleanStr = str.replace(/,/g, "");
  const num = Number(cleanStr);
  if (!Number.isFinite(num)) {
    return str;
  }

  const parts = cleanStr.split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1];

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return decimalPart !== undefined
    ? `${formattedInteger}.${decimalPart}`
    : formattedInteger;
}

/**
 * 财务金额标准千分位格式化函数（千分号标准计量方式）
 * 包含千分位分隔符并保留2位小数精度（例如 222 -> "222.00", 1234567.8 -> "1,234,567.80"）
 * 若为非纯数字字符串（如 "4.28 亿元"）则保持原样，若为空/无效输入则返回 fallback（默认 "--"）
 */
export function formatFinancialMoney(
  value: number | string | null | undefined,
  fallback = "--",
): string {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  if (str === "" || str === "--" || str === "-") return fallback;

  const cleanStr = str.replace(/,/g, "");
  const num = Number(cleanStr);
  if (!Number.isFinite(num)) {
    return str;
  }

  return formatMoney(num);
}

