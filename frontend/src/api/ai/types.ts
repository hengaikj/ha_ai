// 字段来源：enterprise-management.yaml 的 Summary 与创建请求。
export interface ProjectSummary {
  projectId: string;
  projectCode: string;
  projectName: string;
  entitlementMode: "BALANCE" | "SUBSCRIPTION";
  status: string;
}
export type ProjectInput = Pick<
  ProjectSummary,
  "projectCode" | "projectName" | "entitlementMode"
>;
export interface ApiKeySummary {
  apiKeyId: string;
  keyName: string;
  keyPrefix: string;
  status: "ENABLED" | "DISABLED" | "REVOKED";
  createdAt: string;
  expiresAt: string | null;
}
export type ApiKeyInput = Pick<ApiKeySummary, "keyName" | "expiresAt">;
export interface ApiKeyCreated extends ApiKeySummary {
  secret: string;
}
export interface UsageSummary {
  requestId: string;
  projectId: string;
  model: string;
  executionResult: string;
  deliveryResult: string;
  billingResult: string;
  createdAt: string;
}
export type KeyAction = "enable" | "disable" | "revoke";
/** TEMPORARY：在正式 enterprise/project auth context 决策前，绑定当前项目。 */
export interface ProjectContextAdapter {
  projectId(): string;
}
export function createTemporaryProjectContextAdapter(
  readProjectId: () => string,
): ProjectContextAdapter {
  return { projectId: readProjectId };
}
// 这是页面端口，不是 API 响应 Schema。响应解码必须由正式 Contract 提供。
export interface ManagementService {
  projects(): Promise<ProjectSummary[]>;
  createProject(input: ProjectInput): Promise<void>;
  keys(projectId: string): Promise<ApiKeySummary[]>;
  createKey(projectId: string, input: ApiKeyInput): Promise<string>;
  changeKey(
    context: ProjectContextAdapter,
    keyId: string,
    action: KeyAction,
  ): Promise<void>;
  usage(): Promise<UsageSummary[]>;
}
export class ManagementError extends Error {
  readonly status: number;
  readonly code: string;
  readonly traceId?: string;
  constructor(status: number, code: string, message: string, traceId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}
export function allowedKeyActions(
  status: ApiKeySummary["status"],
): KeyAction[] {
  if (status === "ENABLED") return ["disable", "revoke"];
  if (status === "DISABLED") return ["enable", "revoke"];
  return [];
}
