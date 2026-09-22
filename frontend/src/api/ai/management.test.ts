import { describe, expect, it } from "vitest";
import { createMockManagementData, createMockManagementService } from "./mock";
import { createHttpManagementService } from "./http";
import { allowedKeyActions } from "./types";

describe("M01 管理页面端口", () => {
  it("不同页面端口共享新建项目和密钥，但测试场景相互独立", async () => {
    const data = createMockManagementData();
    const projects = createMockManagementService(() => "normal", data);
    await projects.createProject({
      projectCode: "NEW",
      projectName: "新项目",
      entitlementMode: "BALANCE",
    });
    const project = (await projects.projects()).find(
      (row) => row.projectCode === "NEW",
    )!;
    const keys = createMockManagementService(() => "normal", data);
    await keys.createKey(project.projectId, {
      keyName: "新凭据",
      expiresAt: null,
    });
    expect(await projects.keys(project.projectId)).toHaveLength(1);
    await expect(
      createMockManagementService().keys(project.projectId),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("项目 Key 隔离，列表不保存创建 Secret", async () => {
    const service = createMockManagementService();
    const secret = await service.createKey("project-ops", {
      keyName: "测试",
      expiresAt: null,
    });
    const own = await service.keys("project-ops");
    const other = await service.keys("project-demo");
    expect(own).toHaveLength(1);
    expect(other).toHaveLength(3);
    expect(JSON.stringify(own)).not.toContain(secret);
    expect(Object.keys(own[0]!).sort()).toEqual([
      "apiKeyId",
      "expiresAt",
      "keyName",
      "keyPrefix",
      "status",
    ]);
  });
  it("REVOKED 不允许任何状态操作", async () => {
    const service = createMockManagementService();
    expect(allowedKeyActions("REVOKED")).toEqual([]);
    await expect(
      service.changeKey("key-revoked", "enable"),
    ).rejects.toMatchObject({ status: 409 });
    await service.changeKey("key-demo", "disable");
    expect((await service.keys("project-demo"))[0]?.status).toBe("DISABLED");
  });
  it("项目重复编码返回409而非创建重复记录", async () => {
    const service = createMockManagementService();
    await expect(
      service.createProject({
        projectCode: "DEMO",
        projectName: "重复",
        entitlementMode: "BALANCE",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await service.projects()).toHaveLength(2);
  });
  it("缺少响应解码 Contract 时不发送写请求", async () => {
    const service = createHttpManagementService();
    await expect(
      service.createKey("project-demo", { keyName: "测试", expiresAt: null }),
    ).rejects.toMatchObject({ code: "CONTRACT_PENDING" });
    await expect(service.projects()).rejects.toMatchObject({
      code: "CONTRACT_PENDING",
    });
  });
});
