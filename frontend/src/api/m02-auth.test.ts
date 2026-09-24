import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock("@/api/http", () => ({ request: requestMock }));

import {
  bindM02UserRoles,
  changeM02UserStatus,
  createM02User,
  fetchM02EnterpriseOptions,
  fetchM02Roles,
  fetchM02Users,
} from "./m02-auth";

describe("M02 auth API adapter", () => {
  beforeEach(() => requestMock.mockReset().mockResolvedValue([]));

  it("uses the canonical user and role paths", async () => {
    await fetchM02Users();
    await fetchM02Roles();
    await fetchM02EnterpriseOptions();

    expect(requestMock.mock.calls.map(([config]) => [config.method, config.url])).toEqual([
      ["get", "/auth/users"],
      ["get", "/auth/roles"],
      ["get", "/auth/enterprises/options"],
    ]);
  });

  it("sends create, status and role binding payloads without reshaping them", async () => {
    await createM02User({ username: "alice", password: "long-enough-password", displayName: "Alice", enterpriseId: 7 });
    await changeM02UserStatus(12, { status: "DISABLED" });
    await bindM02UserRoles(12, { roleCodes: ["enterprise-admin"] });

    expect(requestMock.mock.calls.map(([config]) => [config.method, config.url, config.data])).toEqual([
      ["post", "/auth/users", { username: "alice", password: "long-enough-password", displayName: "Alice", enterpriseId: 7 }],
      ["post", "/auth/users/12/status", { status: "DISABLED" }],
      ["put", "/auth/users/12/roles", { roleCodes: ["enterprise-admin"] }],
    ]);
  });
});
