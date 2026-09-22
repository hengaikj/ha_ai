export interface ProjectSummary { projectId: string; projectCode: string; projectName: string; entitlementMode: "BALANCE" | "SUBSCRIPTION"; status: string }
export type ProjectInput = Pick<ProjectSummary, "projectCode" | "projectName" | "entitlementMode">
export function createMockProjectService(state: () => string) {
  const rows: ProjectSummary[] = [
    { projectId: "project-demo", projectCode: "DEMO", projectName: "智能问答示例", entitlementMode: "BALANCE", status: "TEST_STATUS" },
    { projectId: "project-ops", projectCode: "OPS", projectName: "运营助手", entitlementMode: "SUBSCRIPTION", status: "TEST_STATUS" },
  ];
  return {
    async list() { await new Promise(resolve => setTimeout(resolve, state() === "loading" ? 800 : 60)); if (state() === "empty") return []; if (state() === "403") throw { code: "MOCK_FORBIDDEN", message: "无权限访问", traceId: "mock-request-403" }; if (state() === "500") throw { code: "MOCK_500", message: "服务暂时不可用", traceId: "mock-request-500" }; return structuredClone(rows); },
    async create(input: ProjectInput) { await new Promise(resolve => setTimeout(resolve, 60)); if (rows.some(row => row.projectCode === input.projectCode)) throw { code: "MOCK_DUPLICATE", message: "项目编码已存在", traceId: "mock-request-409" }; rows.push({ ...input, projectId: `project-${rows.length + 1}`, status: "TEST_STATUS" }); },
  };
}
