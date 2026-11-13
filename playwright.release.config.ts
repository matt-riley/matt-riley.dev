import { defineConfig } from "@playwright/test";

const port = Number(process.env.RELEASE_PORT ?? 48106);
export default defineConfig({
  testDir: "./tests",
  testMatch: "release-browser.ts",
  projects: [{ name: "release-firefox", use: { browserName: "firefox" } }],
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: "release-test-results",
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { outputFolder: "playwright-release-report", open: "never" }],
      ]
    : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 900 },
    locale: "en-GB",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `GITHUB_DATA=fallback pnpm build && pnpm preview --host 127.0.0.1 --port ${port} --ignore-lock`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
