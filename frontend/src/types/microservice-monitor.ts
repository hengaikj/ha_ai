export type MicroserviceStatus = "UP" | "DOWN" | "UNKNOWN";

export interface MicroserviceHealthSnapshot {
  serviceName: string;
  displayName: string;
  status: MicroserviceStatus;
  httpStatus?: number | null;
  responseTimeMs?: number | null;
  message?: string;
  checkedAt?: string | null;
}
