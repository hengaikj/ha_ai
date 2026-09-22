import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/ai",
  testMatch: "wave1-review.spec.ts",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  outputDir: "outputs/playwright/wave1/results",
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "outputs/playwright/wave1/report", open: "never" },
    ],
  ],
  use: {
    baseURL: "http://127.0.0.1:4183",
    browserName: "chromium",
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 4183 --strictPort",
    env: { VITE_ENABLE_MOCK: "true", VITE_ENABLE_AI_MOCK: "true" },
    url: "http://127.0.0.1:4183",
    reuseExistingServer: false,
  },
});
