import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.EDGE_PORT ?? 47849);
export default defineConfig({
  testDir: "./tests",
  testMatch: ["deployment-edge.ts", "release-edge.ts"],
  workers: 1,
  outputDir: "test-results/workers-edge",
  timeout: 60_000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `GITHUB_DATA=fallback pnpm build && WRANGLER_SEND_METRICS=false pnpm exec wrangler dev --local --ip 127.0.0.1 --port ${port} --inspector-port ${port + 1}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
