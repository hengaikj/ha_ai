import { request } from "@/api/http";
import type {
  CacheMonitorSnapshot,
  CacheNameItem,
  CacheValueDetail,
  OnlineUser,
  OnlineUserPage,
  OnlineUserQuery,
  ServerMonitorSnapshot,
} from "@/types/monitor";

interface LegacyTableResponse<T> {
  rows?: T[];
  records?: T[];
  total?: number;
}

export async function fetchOnlineUsers(
  params: OnlineUserQuery,
): Promise<OnlineUserPage> {
  const response = await request<LegacyTableResponse<OnlineUser>>({
    url: "/monitor/online/list",
    method: "get",
    params,
  });
  return {
    records: response.rows ?? response.records ?? [],
    total: Number(response.total ?? response.rows?.length ?? 0),
  };
}

export function forceLogoutOnlineUser(tokenId: string): Promise<void> {
  return request<void>({
    url: `/monitor/online/${encodeURIComponent(tokenId)}`,
    method: "delete",
  });
}

export function fetchServerMonitor(): Promise<ServerMonitorSnapshot> {
  return request<ServerMonitorSnapshot>({
    url: "/monitor/server",
    method: "get",
  });
}

export function fetchCacheMonitor(): Promise<CacheMonitorSnapshot> {
  return request<CacheMonitorSnapshot>({
    url: "/monitor/cache",
    method: "get",
  });
}

export function fetchCacheNames(): Promise<CacheNameItem[]> {
  return request<CacheNameItem[]>({
    url: "/monitor/cache/getNames",
    method: "get",
  });
}

export function fetchCacheKeys(cacheName: string): Promise<string[]> {
  return request<string[]>({
    url: `/monitor/cache/getKeys/${encodeURIComponent(cacheName)}`,
    method: "get",
  });
}

export function fetchCacheValue(
  cacheName: string,
  cacheKey: string,
): Promise<CacheValueDetail> {
  return request<CacheValueDetail>({
    url: `/monitor/cache/getValue/${encodeURIComponent(cacheName)}/${encodeURIComponent(cacheKey)}`,
    method: "get",
  });
}

export function clearCacheName(cacheName: string): Promise<void> {
  return request<void>({
    url: `/monitor/cache/clearCacheName/${encodeURIComponent(cacheName)}`,
    method: "delete",
  });
}

export function clearCacheKey(cacheKey: string): Promise<void> {
  return request<void>({
    url: `/monitor/cache/clearCacheKey/${encodeURIComponent(cacheKey)}`,
    method: "delete",
  });
}

export function clearAllCaches(): Promise<void> {
  return request<void>({
    url: "/monitor/cache/clearCacheAll",
    method: "delete",
  });
}
