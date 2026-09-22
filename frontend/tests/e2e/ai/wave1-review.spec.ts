import { expect, test } from "@playwright/test";

// 截图只使用明显虚构的 Mock 值，不连接真实凭据服务。
const demoSecret = "MOCK_ONLY_NOT_A_REAL_SECRET";
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
]) {
  test(`${viewport.width}x${viewport.height}：五个页面与密钥一次性展示`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() =>
      localStorage.setItem("bq_access_token", "mock-access-token"),
    );
    // 只拦截 HTTP API，不拦截 Vite 的 /src/api/ 模块。
    await page.route(
      (url) => url.pathname.startsWith("/api/"),
      (route) => route.fulfill({ json: { code: 200, data: null } }),
    );
    const shot = async (name: string) => {
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
      await testInfo.attach(name, {
        path: testInfo.outputPath(`${name}.png`),
        contentType: "image/png",
      });
    };
    await page.goto("/ai/projects");
    await expect(page.getByText("智能问答示例", { exact: true })).toBeVisible();
    await shot("项目列表");
    await page
      .getByRole("button", { name: "创建项目", exact: true })
      .click({ force: true });
    await page.getByLabel("项目编码", { exact: true }).fill("REVIEW");
    await page.getByLabel("项目名称", { exact: true }).fill("评审项目");
    await shot("创建项目");
    await page
      .getByRole("button", { name: "保存", exact: true })
      .click({ force: true });
    await expect(page.getByText("评审项目", { exact: true })).toBeVisible();
    await page
      .locator("tr")
      .filter({ hasText: "智能问答示例" })
      .getByRole("button", { name: "API Key", exact: true })
      .click();
    await expect(page.getByText("开发环境", { exact: true })).toBeVisible();
    const table = page.locator(".el-table");
    await expect(table).not.toContainText(demoSecret);
    await expect(table.locator("th")).not.toContainText(["secret"]);
    await expect(
      page
        .locator("tr")
        .filter({ hasText: "已撤销示例" })
        .getByRole("button", { name: "启用", exact: true }),
    ).toHaveCount(0);
    await shot("密钥列表");
    await page
      .getByRole("button", { name: "创建 API Key", exact: true })
      .click();
    await page.getByLabel("Key 名称", { exact: true }).fill("评审凭据");
    await shot("创建密钥");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByLabel("一次性 Secret")).toHaveValue(demoSecret);
    await expect(table).not.toContainText(demoSecret);
    await shot("一次性密钥_虚构示例");
    const storage = await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    );
    expect(storage.includes(demoSecret)).toBe(false);
    await page
      .getByRole("button", { name: "我已保存，关闭", exact: true })
      .click();
    await expect(page.getByLabel("一次性 Secret")).toHaveCount(0);
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await expect(page.getByText("评审凭据", { exact: true })).toBeVisible();
    await expect(page.getByText("mock-only-", { exact: true })).toBeVisible();
    await expect(page.getByLabel("一次性 Secret")).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("开发环境", { exact: true })).toBeVisible();
    await expect(page.getByLabel("一次性 Secret")).toHaveCount(0);
    await page.goto("/ai/usage");
    await expect(
      page.getByText("mock-request-001", { exact: true }),
    ).toBeVisible();
    await shot("调用记录");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
