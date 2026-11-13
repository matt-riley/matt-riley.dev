import { defineConfig } from "@playwright/test";

const port = Number(process.env.VISUAL_PORT ?? 48105);
export default defineConfig({
  testDir: "./tests",
  testMatch: "catalogue-visual.ts",
  projects: [{ name: "catalogue-chromium", use: { browserName: "chromium" } }],
  workers: 1,
  retries: 0,
  timeout: 30_000,
  updateSnapshots: "none",
  snapshotPathTemplate: "{testDir}/catalogue-snapshots/{platform}/{arg}{ext}",
  outputDir: "visual-test-results",
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { outputFolder: "playwright-visual-report", open: "never" }],
      ]
    : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: "en-GB",
    timezoneId: "Europe/London",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `GITHUB_DATA=fallback pnpm build && pnpm preview --host 127.0.0.1 --port ${port} --ignore-lock`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
