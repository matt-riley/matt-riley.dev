import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const chromePath =
  process.env.CHROME_PATH ||
  [
    chromium.executablePath(),
    ...(process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : []),
  ].find((path) => existsSync(path));

if (!chromePath || !existsSync(chromePath)) {
  console.error(
    "Chrome not found. Run pnpm exec playwright install chromium, or set CHROME_PATH.",
  );
  process.exitCode = 1;
} else {
  const cli = fileURLToPath(import.meta.resolve("@lhci/cli/src/cli.js"));
  const result = spawnSync(
    process.execPath,
    [cli, "autorun", ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: { ...process.env, CHROME_PATH: chromePath },
    },
  );
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
