export type NotificationStatus =
  | "PENDING"
  | "RESOLVING_IDENTITY"
  | "READY"
  | "SENDING"
  | "SUCCESS"
  | "IDENTITY_UNRESOLVED"
  | "RETRY_WAIT"
  | "DEAD_LETTER"
  | "CANCELLED";

export interface NotificationMessage {
  id: number;
  sourceSystem: string;
  eventType: string;
  bizType: string;
  bizId: string;
  bizVersion: string;
  receiverUserId: number;
  templateCode: string;
  messageStatus: NotificationStatus;
  retryCount: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  occurredAt: string;
  createTime: string;
  sentTime?: string;
}

export interface NotificationIdentity {
  userId: number;
  provider: string;
  tenantKey: string;
  matchType: "EMAIL" | "MOBILE";
  identityStatus: "RESOLVED" | "UNRESOLVED" | "DISABLED";
  externalIdMasked?: string;
  failureCode?: string;
  failureMessage?: string;
  lastResolvedTime?: string;
  updateTime: string;
}

export interface NotificationTemplate {
  id: number;
  templateCode: string;
  channel: string;
  templateVersion: number;
  title: string;
  templateStatus: string;
  publishTime?: string;
}

export interface NotificationPage<T> {
  records: T[];
  total: number;
  pageNo: number;
  pageSize: number;
}
