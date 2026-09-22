import {
  ManagementError,
  allowedKeyActions,
  type ManagementService,
  type ProjectSummary,
  type ApiKeySummary,
  type UsageSummary,
  type ProjectContextAdapter,
} from "./types";

export const isAiMockEnabled = () =>
  import.meta.env.VITE_ENABLE_AI_MOCK === "true";
export type MockState =
  | "normal"
  | "empty"
  | "loading"
  | "400"
  | "401"
  | "403"
  | "404"
  | "409"
  | "500";
export function createMockManagementData() {
  // Summary 测试样本；字符串示例不定义业务枚举或颜色语义。
  const projects: ProjectSummary[] = [
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
  const keys = new Map<string, ApiKeySummary[]>([
    [
      "project-demo",
      [
        {
          apiKeyId: "key-demo",
          keyName: "开发环境",
          keyPrefix: "mock-demo-",
          status: "ENABLED",
          expiresAt: null,
        },
        {
          apiKeyId: "key-disabled",
          keyName: "测试环境",
          keyPrefix: "mock-test-",
          status: "DISABLED",
          expiresAt: "2027-01-01T00:00:00Z",
        },
        {
          apiKeyId: "key-revoked",
          keyName: "已撤销示例",
          keyPrefix: "mock-old-",
          status: "REVOKED",
          expiresAt: null,
        },
      ],
    ],
    ["project-ops", []],
  ]);
  const usage: UsageSummary[] = [
    {
      requestId: "mock-request-001",
      projectId: "project-demo",
      model: "mock-model",
      executionResult: "TEST_EXECUTION",
      deliveryResult: "TEST_DELIVERY",
      billingResult: "TEST_BILLING",
      createdAt: "2026-09-22T01:42:18Z",
    },
  ];
  return { projects, keys, usage, sequence: 0 };
}

export function createMockManagementService(
  state: () => MockState = () => "normal",
  data = createMockManagementData(),
): ManagementService {
  const { projects, keys, usage } = data;
  async function before(write = false) {
    await new Promise((resolve) =>
      setTimeout(resolve, state() === "loading" ? 1500 : 100),
    );
    const status = Number(state());
    if (status >= 400 && (status !== 409 || write)) {
      throw new ManagementError(
        status,
        `MOCK_${status}`,
        (
          {
            400: "请求参数不合法",
            401: "认证已失效",
            403: "无权限访问",
            404: "资源不存在",
            409: "资源状态冲突，请检查输入后重试",
            500: "服务暂时不可用",
          } as Record<number, string>
        )[status]!,
        `mock-request-${status}`,
      );
    }
  }
  function projectKeys(id: string) {
    if (!keys.has(id))
      throw new ManagementError(
        404,
        "MOCK_NOT_FOUND",
        "项目不存在",
        "mock-request-404",
      );
    return keys.get(id)!;
  }
  return {
    async projects() {
      await before();
      return state() === "empty" ? [] : structuredClone(projects);
    },
    async createProject(input) {
      await before(true);
      if (projects.some((p) => p.projectCode === input.projectCode))
        throw new ManagementError(
          409,
          "MOCK_DUPLICATE",
          "项目编码已存在",
          "mock-request-409",
        );
      const id = `mock-project-${++data.sequence}`;
      projects.push({ ...input, projectId: id, status: "TEST_STATUS" });
      keys.set(id, []);
    },
    async keys(id) {
      await before();
      const rows = projectKeys(id);
      return state() === "empty" ? [] : structuredClone(rows);
    },
    async createKey(id, input) {
      await before(true);
      const rows = projectKeys(id);
      rows.push({
        ...input,
        apiKeyId: `mock-key-${++data.sequence}`,
        keyPrefix: "mock-only-",
        status: "ENABLED",
      });
      // 仅页面端口的虚构演示值；不构造未定义的 API Secret 响应字段。
      return "MOCK_ONLY_NOT_A_REAL_SECRET";
    },
    async changeKey(context: ProjectContextAdapter, id, action) {
      await before(true);
      const key = projectKeys(context.projectId()).find(
        (k) => k.apiKeyId === id,
      );
      if (!key)
        throw new ManagementError(404, "MOCK_NOT_FOUND", "API Key 不存在");
      if (!allowedKeyActions(key.status).includes(action))
        throw new ManagementError(409, "MOCK_CONFLICT", "当前状态不支持该操作");
      key.status =
        action === "enable"
          ? "ENABLED"
          : action === "disable"
            ? "DISABLED"
            : "REVOKED";
    },
    async usage() {
      await before();
      return state() === "empty" ? [] : structuredClone(usage);
    },
  };
}
