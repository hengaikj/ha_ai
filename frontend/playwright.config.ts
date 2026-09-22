import { defineConfig, devices } from "@playwright/test";
import { roleTestMatch } from "./tests/e2e/custom-table/env";

const evidenceDir =
  "outputs/playwright/custom-table/20260712-workbench-compatibility";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "outputs/playwright/custom-table/report" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth[.]setup[.]ts/,
      use: { trace: "off", screenshot: "off", video: "off" },
    },
    {
      name: "admin",
      testMatch: roleTestMatch("admin"),
      use: {
        ...devices["Desktop Chrome"],
        storageState: `${evidenceDir}/admin.json`,
      },
      dependencies: ["setup"],
    },
    {
      name: "designer",
      testMatch: roleTestMatch("designer"),
      use: {
        ...devices["Desktop Chrome"],
        storageState: `${evidenceDir}/designer.json`,
      },
      dependencies: ["setup"],
    },
    {
      name: "publisher",
      testMatch: roleTestMatch("publisher"),
      use: {
        ...devices["Desktop Chrome"],
        storageState: `${evidenceDir}/publisher.json`,
      },
      dependencies: ["setup"],
    },
    {
      name: "filler",
      testMatch: roleTestMatch("filler"),
      use: {
        ...devices["Desktop Chrome"],
        storageState: `${evidenceDir}/filler.json`,
      },
      dependencies: ["setup"],
    },
    {
      name: "readonly",
      testMatch: roleTestMatch("readonly"),
      use: {
        ...devices["Desktop Chrome"],
        storageState: `${evidenceDir}/readonly.json`,
      },
      dependencies: ["setup"],
    },
  ],
});
