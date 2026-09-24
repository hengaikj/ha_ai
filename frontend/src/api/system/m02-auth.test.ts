import { describe, expect, it, vi } from "vitest";
vi.mock("@/api/http", () => ({ request: vi.fn(), ApiBusinessError: class ApiBusinessError extends Error { code = "E"; traceId = "req-1"; } }));
import { request } from "@/api/http";
import { fetchM02Roles, fetchM02Users, replaceM02UserRoles } from "./m02-auth";

describe("M02 auth adapter", () => {
  it("normalizes paged users and query", async () => {
    vi.mocked(request).mockResolvedValueOnce({ items: [{ id: "u1" }], totalCount: 2, pageNum: 2, pageSize: 1 });
    await expect(fetchM02Users({ page: 2, pageSize: 1, username: "a" })).resolves.toEqual({ records: [{ id: "u1" }], total: 2, page: 2, pageSize: 1 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: "/auth/users", params: { page: 2, pageSize: 1, username: "a" } }));
  });
  it("filters disabled roles and supports empty unbind", async () => {
    vi.mocked(request).mockResolvedValueOnce([{ roleId: "r1", roleName: "可用", status: "ACTIVE" }, { roleId: "r2", roleName: "停用", status: "DISABLED" }]);
    await expect(fetchM02Roles()).resolves.toEqual([{ roleId: "r1", roleName: "可用", status: "ACTIVE", id: "r1", name: "可用", bindable: true }]);
    vi.mocked(request).mockResolvedValueOnce(undefined);
    await replaceM02UserRoles("u1", []);
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ url: "/auth/users/u1/roles", data: { roleCodes: [] } }));
  });
});
