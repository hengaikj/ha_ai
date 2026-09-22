const TOKEN_KEY = "bq_access_token";
const REVENUE_TOKEN_KEY = "bq_revenue_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** 收益模块专用 token（从 7081 获取，与 7083 收入服务共享 JWT 密钥） */
export function getRevenueToken(): string | null {
  return localStorage.getItem(REVENUE_TOKEN_KEY);
}

export function setRevenueToken(token: string): void {
  localStorage.setItem(REVENUE_TOKEN_KEY, token);
}

export function clearRevenueToken(): void {
  localStorage.removeItem(REVENUE_TOKEN_KEY);
}
