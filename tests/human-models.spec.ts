import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("the four Human Error and gift-shop GLBs load with their authored contracts", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "Asset contract validation runs once per build",
  );
  const result = spawnSync(
    process.execPath,
    ["blender/validate-human-models.mjs"],
    {
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
});
