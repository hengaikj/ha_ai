import { describe, expect, it } from "vitest";
import { createProjectModelsService } from "./project-models";

describe("项目模型权限 API 端口", () => {
  it("未确认响应结构时不发送查询或保存请求", async () => {
    const service = createProjectModelsService();
    await expect(service.list("project-demo")).rejects.toMatchObject({
      code: "CONTRACT_PENDING",
    });
    await expect(
      service.save("project-demo", ["model-a"]),
    ).rejects.toMatchObject({ code: "CONTRACT_PENDING" });
  });
});
