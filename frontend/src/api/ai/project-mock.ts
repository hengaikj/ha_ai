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
export interface ProjectService {
  list(): Promise<ProjectSummary[]>;
  create(input: ProjectInput): Promise<void>;
}
export class ProjectServiceError extends Error {
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
export function createMockProjectService(state: () => string) {
  const rows: ProjectSummary[] = [
    {
      projectId: "project-demo",
      projectCode: "DEMO",
      projectName: "智能问答示例",
      entitlementMode: "BALANCE",
      status: "TEST_STATUS",
    },
    {
      projectId: "project-ops",
      projectCode: "OPS",
      projectName: "运营助手",
      entitlementMode: "SUBSCRIPTION",
      status: "TEST_STATUS",
    },
  ];
  return {
    async list() {
      await new Promise((resolve) =>
        setTimeout(resolve, state() === "loading" ? 800 : 60),
      );
      if (state() === "empty") return [];
      if (state() === "403")
        throw new ProjectServiceError(
          403,
          "MOCK_FORBIDDEN",
          "无权限访问",
          "mock-request-403",
        );
      if (state() === "500")
        throw new ProjectServiceError(
          500,
          "MOCK_500",
          "服务暂时不可用",
          "mock-request-500",
        );
      return structuredClone(rows);
    },
    async create(input: ProjectInput) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      if (rows.some((row) => row.projectCode === input.projectCode))
        throw new ProjectServiceError(
          409,
          "MOCK_DUPLICATE",
          "项目编码已存在",
          "mock-request-409",
        );
      rows.push({
        ...input,
        projectId: `project-${rows.length + 1}`,
        status: "TEST_STATUS",
      });
    },
  };
}
