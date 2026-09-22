import { safeText } from "@/utils/revenue-helpers";

// ============================================================
// Constants
// ============================================================

/** 参数占位符文本 */
export const PARAMETER_TEXT = "参数";

/** 参数键正则：参数1、参数2... */
export const PARAMETER_KEY_REGEXP = /^参数\d+$/;

/** 可参与拼接的常量草稿（含未写完的小数，如 1.） */
export const CONSTANT_TOKEN_REGEXP = /^(?:\d+\.\d*|\d+)$/;

/** 保存时必须完整的常量 */
export const COMPLETE_CONSTANT_TOKEN_REGEXP = /^(?:\d+\.\d+|\d+)$/;

/** 运算符字符集 */
export const OPERATOR_CHARS = "+-*/()";

// ============================================================
// Token 判断
// ============================================================

export function isParameterToken(token: unknown): boolean {
  const text = safeText(token);
  return text === PARAMETER_TEXT || PARAMETER_KEY_REGEXP.test(text);
}

export function isConstantToken(token: unknown): boolean {
  return CONSTANT_TOKEN_REGEXP.test(safeText(token));
}

export function isCompleteConstantToken(token: unknown): boolean {
  return COMPLETE_CONSTANT_TOKEN_REGEXP.test(safeText(token));
}

export function isOperatorToken(token: unknown): boolean {
  const text = safeText(token);
  return text.length === 1 && OPERATOR_CHARS.includes(text);
}

// ============================================================
// 参数键构建
// ============================================================

export function createParameterKey(index: number): string {
  return `${PARAMETER_TEXT}${index}`;
}

export function buildParameterRaw(key: string): string {
  return `\${${key}}`;
}

// ============================================================
// 表达式解析与拼接
// ============================================================

export interface TokenizeOptions {
  /** 是否将旧版通用"参数"枚举为参数1/参数2... */
  enumerateLegacyParameters?: boolean;
}

/**
 * 将公式原始表达式拆分为 token 列表
 * 支持格式：${参数1} + ${参数2} * 1.13
 */
export function tokenizeFormulaRawExpression(rawExpression: unknown, options: TokenizeOptions = {}): string[] {
  const source = safeText(rawExpression).replace(/\s+/g, "");
  if (!source) return [];
  const tokens: string[] = [];
  let cursor = 0;
  let legacyParameterIndex = 0;

  while (cursor < source.length) {
    if (source.startsWith("${", cursor)) {
      const end = source.indexOf("}", cursor + 2);
      if (end < 0) return [];
      const parameterKey = safeText(source.slice(cursor + 2, end));
      if (!isParameterToken(parameterKey)) return [];
      if (options.enumerateLegacyParameters && parameterKey === PARAMETER_TEXT) {
        legacyParameterIndex += 1;
        tokens.push(createParameterKey(legacyParameterIndex));
      } else {
        tokens.push(parameterKey);
      }
      cursor = end + 1;
      continue;
    }

    const ch = source[cursor];
    if (OPERATOR_CHARS.includes(ch)) {
      tokens.push(ch);
      cursor += 1;
      continue;
    }

    // 数字常量：整数或多位小数（小数点后至少一位）
    if (/\d/.test(ch)) {
      let end = cursor + 1;
      while (end < source.length && /\d/.test(source[end])) end += 1;
      if (source[end] === ".") {
        end += 1;
        if (end >= source.length || !/\d/.test(source[end])) return [];
        while (end < source.length && /\d/.test(source[end])) end += 1;
      }
      tokens.push(source.slice(cursor, end));
      cursor = end;
      continue;
    }

    return [];
  }

  return tokens;
}

/** 追加常量的返回结果 */
export interface AppendConstantResult {
  ok: boolean;
  tokens: string[];
  message?: string;
}

/**
 * 向 token 列表追加数字或小数点
 * 连续数字会合并为同一个常量 token
 */
export function appendConstantToTokens(tokens: string[] = [], input: unknown): AppendConstantResult {
  const next = tokens.slice();
  const value = safeText(input);
  const last = next[next.length - 1];
  const lastText = safeText(last);

  if (value === ".") {
    if (isConstantToken(lastText) && !lastText.includes(".")) {
      next[next.length - 1] = `${lastText}.`;
      return { ok: true, tokens: next };
    }
    if (!lastText || isOperatorToken(lastText) || isParameterToken(lastText)) {
      if (lastText === ")") return { ok: false, tokens, message: "右括号后不能直接输入小数点" };
      next.push("0.");
      return { ok: true, tokens: next };
    }
    return { ok: false, tokens, message: "当前位置不能输入小数点" };
  }

  if (!/^\d$/.test(value)) {
    return { ok: false, tokens, message: "仅支持数字常量" };
  }

  if (isConstantToken(lastText)) {
    next[next.length - 1] = `${lastText}${value}`;
    return { ok: true, tokens: next };
  }

  next.push(value);
  return { ok: true, tokens: next };
}

/**
 * 将 token 列表还原为公式原始表达式字符串
 */
export function buildFormulaRawExpression(tokens: string[] = []): string {
  return tokens
    .map((token) => {
      if (isParameterToken(token)) return buildParameterRaw(token);
      return token;
    })
    .join("");
}

/**
 * 检查 token 列表中是否存在不完整的常量（如 "1."）
 */
export function hasIncompleteConstant(tokens: string[] = []): boolean {
  return tokens.some((token) => isConstantToken(token) && !isCompleteConstantToken(token));
}
