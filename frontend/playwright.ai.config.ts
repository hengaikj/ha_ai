import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e/ai",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    browserName: "firefox",
    launchOptions: { executablePath: "/usr/bin/firefox" },
  },
});
