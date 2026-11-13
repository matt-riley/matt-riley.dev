import { expect, test } from "@playwright/test";
import { cursorCell } from "../src/gallery/waffle-cursor";

const lines = [
  "reading the repository",
  "making a small useful change",
  "running the tests",
  "done. no theatre.",
];

test("terminal lines advance in order and a touch while typing finishes only that line", async ({
  page,
  javaScriptEnabled,
  reducedMotion,
}) => {
  test.skip(
    !javaScriptEnabled,
    "The unenhanced placard is covered by catalogue smoke tests.",
  );
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  await page.goto("/archive-gallery/#waffle-agent");
  const button = page.locator("#waffle-agent button[data-touch]");
  const terminal = page.locator("[data-terminal]");
  const result = page.locator("#waffle-agent [data-touch-result]");
  for (const line of [...lines, lines[0]]) {
    await button.click();
    if (reducedMotion !== "reduce") {
      await expect(terminal).toHaveAttribute("data-typing", "true");
      await button.click();
    }
    await expect(result).toHaveText(line);
    await expect(terminal).toHaveAttribute("data-typing", "false");
    await expect(page.locator("[data-terminal-output]")).toHaveText(line);
  }
  if (reducedMotion === "reduce") {
    expect(
      await page
        .locator(".waffle-terminal__cursor")
        .evaluate((node) => getComputedStyle(node).animationName),
    ).toBe("none");
  }
});

test("every cursor pocket stays within the actual circular waffle footprint", async ({
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "desktop-chromium",
    "The grid contract is shared.",
  );
  const positions = Array.from({ length: 36 }, (_, index) => cursorCell(index));
  expect(new Set(positions.map(({ x, z }) => `${x}:${z}`)).size).toBe(36);
  for (const { x, z } of positions) {
    expect(Math.abs(x)).toBeLessThanOrEqual(0.120001);
    expect(Math.abs(z)).toBeLessThanOrEqual(0.120001);
    // Include the cursor block's half extent, not just its pivot.
    expect(Math.hypot(Math.abs(x) + 0.004, Math.abs(z) + 0.014)).toBeLessThan(
      0.185,
    );
  }
  expect(cursorCell(-1)).toEqual(cursorCell(0));
  expect(cursorCell(100)).toEqual(cursorCell(35));
});
