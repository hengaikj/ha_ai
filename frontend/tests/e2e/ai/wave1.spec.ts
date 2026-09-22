import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function enter(page: Page, path: string) {
  await page.addInitScript(() =>
    localStorage.setItem("bq_access_token", "mock-access-token"),
  );
  // 只模拟既有工程配置读取，管理页数据来自显式 AI Mock 端口。
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: { code: 200, data: null } }),
  );
  await page.goto(path);
  await expect(page.locator(".app-layout")).toBeVisible();
  await expect(page.locator(".el-loading-mask")).toHaveCount(0);
}
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
]) {
  test(`${viewport.width}×${viewport.height} 页面与状态证据`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const dir = `../docs/frontend/evidence/m01-wave1/screenshots/${viewport.width}x${viewport.height}`;
    await mkdir(dir, { recursive: true });
    const shot = async (name: string) => {
      await page.screenshot({ path: `${dir}/${name}.png` });
    };
    await enter(page, "/ai/projects");
    await expect(page.getByText("智能问答示例", { exact: true })).toBeVisible();
    await shot("projects-normal");
    await page.getByRole("button", { name: "创建项目", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot("project-create");
    await page.getByLabel("项目编码", { exact: true }).fill("DEMO");
    await page.getByLabel("项目名称", { exact: true }).fill("重复编码测试");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(
      page.getByText("项目编码已存在", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("项目名称", { exact: true })).toHaveValue(
      "重复编码测试",
    );
    await page.getByLabel("项目编码", { exact: true }).fill("NEW");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("重复编码测试", { exact: true })).toBeVisible();
    await enter(page, "/ai/projects?mockState=empty");
    await expect(page.getByText("暂无项目", { exact: true })).toBeVisible();
    await shot("projects-empty");
    await enter(page, "/ai/projects/project-demo/api-keys");
    await expect(page.getByText("开发环境", { exact: true })).toBeVisible();
    await shot("api-keys-normal");
    const revoked = page.locator("tr").filter({ hasText: "已撤销示例" });
    await expect(
      revoked.getByRole("button", { name: "启用", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "创建 API Key", exact: true })
      .click();
    await shot("apikey-create");
    await page.getByLabel("Key 名称", { exact: true }).fill("截图测试凭据");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByLabel("一次性 Secret")).toHaveValue(
      "MOCK_ONLY_NOT_A_REAL_SECRET",
    );
    await shot("secret-once");
    await page.getByRole("button", { name: "我已保存，关闭" }).click();
    await expect(page.getByLabel("一次性 Secret")).toHaveCount(0);
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await expect(page.getByLabel("一次性 Secret")).toHaveCount(0);
    await enter(page, "/ai/projects/project-ops/api-keys");
    await expect(page.getByText("暂无 API Key", { exact: true })).toBeVisible();
    await shot("api-keys-empty");
    await enter(page, "/ai/usage");
    await expect(
      page.getByText("mock-request-001", { exact: true }),
    ).toBeVisible();
    await shot("usage-normal");
    await enter(page, "/ai/projects?mockState=403");
    await expect(page.getByText("无权限访问").first()).toBeVisible();
    await shot("error-403");
    await enter(page, "/ai/projects?mockState=500");
    await expect(
      page.getByText("mock-request-500", { exact: false }),
    ).toBeVisible();
    await shot("error-500");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("404返回、只读、401复用登录流程", async ({ page }) => {
  await enter(page, "/ai/projects?mockState=404");
  await page.getByRole("button", { name: "返回项目", exact: true }).click();
  await expect(page).toHaveURL(/\/ai\/projects$/);
  await enter(page, "/ai/projects?mockReadonly=true");
  await expect(
    page.getByRole("button", { name: "创建项目", exact: true }),
  ).toBeDisabled();
  await page.goto("/ai/projects?mockState=401");
  await expect(page).toHaveURL(/login/);
  expect(
    await page.evaluate(() => localStorage.getItem("bq_access_token")),
  ).toBeNull();
});
