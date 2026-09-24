import { request, ApiBusinessError } from "@/api/http";

export interface M02User { id: string | number; username?: string; displayName?: string; status?: string; roles?: M02Role[]; [key: string]: unknown }
export interface M02Role { id: string | number; code?: string; name?: string; status?: string; bindable?: boolean; [key: string]: unknown }
export interface M02Page<T> { records: T[]; total: number; page: number; pageSize: number }
export interface M02UserQuery { page?: number; pageSize?: number; username?: string; displayName?: string; status?: string; enterpriseId?: string | number }

const value = <T>(...xs: unknown[]) => xs.find((x): x is T => x !== undefined && x !== null) as T | undefined;
function page<T>(payload: unknown, q?: M02UserQuery): M02Page<T> {
  const raw = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const records = value<unknown[]>(raw.records, raw.items, raw.rows, Array.isArray(payload) ? payload : undefined) ?? [];
  return { records: records as T[], total: Number(value(raw.total, raw.totalCount, records.length) ?? 0), page: Number(value(raw.page, raw.pageNum, q?.page, 1) ?? 1), pageSize: Number(value(raw.pageSize, q?.pageSize, records.length || 10) ?? 10) };
}
function role(r: M02Role): M02Role {
  const x = r as any;
  return { ...r, id: value(r.id, x.roleId, x.code) ?? "", name: value(r.name, x.roleName, x.displayName), bindable: r.bindable !== false && r.status !== "DISABLED" && x.status !== "1" };
}
export async function fetchM02Users(query?: M02UserQuery) { return page<M02User>(await request<unknown>({ url: "/auth/users", method: "get", params: query }), query); }
export async function fetchM02Roles(): Promise<M02Role[]> { const data = await request<unknown>({ url: "/auth/roles", method: "get" }); const xs = Array.isArray(data) ? data : ((data as any)?.records ?? (data as any)?.items ?? (data as any)?.roles ?? []); return (xs as M02Role[]).map(role).filter((x) => x.bindable !== false); }
export function createM02User(data: Record<string, unknown>) { return request<M02User>({ url: "/auth/users", method: "post", data }); }
export function setM02UserStatus(userId: string | number, status: "ACTIVE" | "DISABLED") { return request<void>({ url: `/auth/users/${encodeURIComponent(String(userId))}/status`, method: "post", data: { status } }); }
export function replaceM02UserRoles(userId: string | number, roleCodes: string[]) { return request<void>({ url: `/auth/users/${encodeURIComponent(String(userId))}/roles`, method: "put", data: { roleCodes } }); }
export function normalizeM02Error(error: unknown) { if (error instanceof ApiBusinessError) return { code: error.code, message: error.message, requestId: error.traceId }; return { code: "FRONTEND-M02-AUTH-001", message: "用户角色请求失败，请稍后重试。" }; }
