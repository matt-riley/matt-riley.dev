import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.TEST_PORT ?? 4333);
// Full Chromium can use the local GPU; CI keeps the default headless shell.
const chromiumChannel = process.env.TEST_CHROMIUM_CHANNEL
  ? { channel: process.env.TEST_CHROMIUM_CHANNEL }
  : {};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], ...chromiumChannel },
    },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], ...chromiumChannel },
    },
    {
      name: "reduced-motion",
      use: {
        ...devices["Desktop Chrome"],
        ...chromiumChannel,
        reducedMotion: "reduce",
      },
    },
    {
      name: "no-javascript",
      // Axe needs JavaScript timers; this project verifies the unenhanced HTML and links.
      testIgnore: "**/a11y.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        ...chromiumChannel,
        javaScriptEnabled: false,
      },
    },
  ],
  webServer: {
    command: `GITHUB_DATA=fallback pnpm build && pnpm preview --host 127.0.0.1 --port ${port} --ignore-lock`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
