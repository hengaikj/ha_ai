import { describe, expect, it } from "vitest";
import { createMockProjectService } from "./project-mock";

describe("IS-M01-02 Project transport", () => {
  it("Mock列表只返回正式Project字段", async () => {
    const rows = await createMockProjectService(() => "normal").list();
    expect(rows).toHaveLength(2);
    expect(Object.keys(rows[0]!).sort()).toEqual([
      "entitlementMode",
      "projectCode",
      "projectId",
      "projectName",
      "status",
    ]);
  });

  it("Mock保留空态、403、500和409状态", async () => {
    await expect(
      createMockProjectService(() => "empty").list(),
    ).resolves.toEqual([]);
    await expect(
      createMockProjectService(() => "403").list(),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      createMockProjectService(() => "500").list(),
    ).rejects.toMatchObject({ status: 500 });
    const service = createMockProjectService(() => "normal");
    await expect(
      service.create({
        projectCode: "DEMO",
        projectName: "重复",
        entitlementMode: "BALANCE",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
