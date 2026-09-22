import { defineConfig, devices } from "@playwright/test";
import { batchNo, evidenceDir } from "./tests/e2e/committee/env";

export default defineConfig({
  testDir: "./tests/e2e/committee",
  testMatch:
    /committee-(full-flow|page-matrix|resilience-matrix|api-safety|multi-scenario|state-matrix|a11y)[.]spec[.]ts/,
  timeout: 30 * 60_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: `${evidenceDir}/artifacts`,
  reporter: [
    ["list"],
    ["html", { outputFolder: `${evidenceDir}/report`, open: "never" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173",
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  metadata: { batchNo },
});
