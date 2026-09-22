import { httpClient } from "@/api/http";
import { createIdempotencyKey } from "@/utils/idempotency";
import type {
  NotificationIdentity,
  NotificationMessage,
  NotificationPage,
  NotificationTemplate,
} from "@/types/notification";

type TableEnvelope<T> = {
  code?: number | string;
  rows?: T[];
  total?: number | string;
  data?: T[] | { rows?: T[]; total?: number | string };
};

type NotificationResponse<T> =
  | { data: TableEnvelope<T> }
  | TableEnvelope<T>;

function page<T>(body: TableEnvelope<T>, pageNo: number, pageSize: number): NotificationPage<T> {
  const nestedPage =
    body.data && !Array.isArray(body.data) ? body.data : undefined;
  const records =
    body.rows ?? (Array.isArray(body.data) ? body.data : nestedPage?.rows) ?? [];
  const total = Number(body.total ?? nestedPage?.total ?? records.length);
  return {
    records,
    total: Number.isFinite(total) && total >= 0 ? total : 0,
    pageNo,
    pageSize,
  };
}

function responseBody<T>(response: NotificationResponse<T>): TableEnvelope<T> {
  let current = response as TableEnvelope<T>;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current.data || Array.isArray(current.data)) {
      return current;
    }
    if ("rows" in current.data || "total" in current.data) {
      return current.data;
    }
    current = current.data as TableEnvelope<T>;
  }
  return current;
}

export async function fetchNotificationMessages(query: {
  pageNo: number;
  pageSize: number;
  status?: string;
  sourceSystem?: string;
  eventType?: string;
  receiverUserId?: number;
}): Promise<NotificationPage<NotificationMessage>> {
  const { pageNo, pageSize, ...filters } = query;
  const response = await httpClient.request<NotificationResponse<NotificationMessage>>({
    url: "/notification/messages",
    method: "get",
    params: { pageNum: pageNo, pageSize, ...filters },
  });
  return page(responseBody(response), pageNo, pageSize);
}

export async function fetchNotificationIdentities(query: {
  pageNo: number;
  pageSize: number;
  status?: string;
  userId?: number;
}): Promise<NotificationPage<NotificationIdentity>> {
  const { pageNo, pageSize, ...filters } = query;
  const response = await httpClient.request<NotificationResponse<NotificationIdentity>>({
    url: "/notification/identities",
    method: "get",
    params: { pageNum: pageNo, pageSize, ...filters },
  });
  return page(responseBody(response), pageNo, pageSize);
}

export async function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  const response = await httpClient.request<{ code: number; data?: NotificationTemplate[] }>({
    url: "/notification/templates",
    method: "get",
  });
  return response.data.data ?? [];
}

export async function retryNotificationMessage(id: number): Promise<void> {
  await httpClient.request({
    url: `/notification/messages/${id}/retry`,
    method: "post",
    headers: { "Idempotency-Key": createIdempotencyKey("notification-retry") },
  });
}

export async function resolveNotificationIdentity(userId: number): Promise<void> {
  await httpClient.request({
    url: `/notification/identities/${userId}/resolve`,
    method: "post",
    headers: {
      "Idempotency-Key": createIdempotencyKey("notification-identity-resolve"),
    },
  });
}
