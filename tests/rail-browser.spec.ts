import { expect, test } from "@playwright/test";

test("gallery handover preserves layout and a native hash chosen while loading", async ({
  page,
}, info) => {
  test.skip(
    !["desktop-chromium", "mobile-chromium"].includes(info.project.name),
    "Actual WebGL handover is measured on desktop and touch Chromium.",
  );
  await page.addInitScript(() => {
    const shifts: number[] = [];
    Object.defineProperty(window, "railShifts", { value: shifts });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (
          !(entry as PerformanceEntry & { hadRecentInput: boolean })
            .hadRecentInput
        )
          shifts.push((entry as PerformanceEntry & { value: number }).value);
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.locator("[data-stop-menu] summary").click();
  await page.locator('[data-stop-menu] a[href="#waystone"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready", {
    timeout: 30_000,
  });
  await expect(page.locator("[data-current-stop]")).toHaveText(
    "5 of 8, waystone.nvim",
  );
  await page.waitForTimeout(700);
  const card = page.locator("#waystone .exhibit__label");
  const before = await card.boundingBox();
  expect(before).not.toBeNull();
  expect(before?.y).toBeGreaterThanOrEqual(0);
  const cls = await page.evaluate(() =>
    (window as unknown as { railShifts: number[] }).railShifts.reduce(
      (sum, value) => sum + value,
      0,
    ),
  );
  expect(cls).toBeLessThan(0.02);
  await page.getByRole("button", { name: "Lights: Day", exact: true }).click();
  await page.waitForTimeout(200);
  expect(await card.boundingBox()).toEqual(before);
  const after = await page.evaluate(() =>
    (window as unknown as { railShifts: number[] }).railShifts.reduce(
      (sum, value) => sum + value,
      0,
    ),
  );
  expect(after).toBe(cls);
  await page.keyboard.press("PageDown");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test("an initial Waystone fragment measures the gallery rather than the loading catalogue", async ({
  page,
}, info) => {
  test.skip(
    !["desktop-chromium", "mobile-chromium"].includes(info.project.name),
    "Real gallery fragment geometry is covered on desktop and touch Chromium.",
  );
  await page.goto("/#waystone");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready", {
    timeout: 30_000,
  });
  await expect
    .poll(() =>
      page.locator("#waystone").evaluate((section) => {
        const rect = section.getBoundingClientRect();
        return Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
      }),
    )
    .toBeLessThan(2);
  await expect(page.locator("[data-current-stop]")).toHaveText(
    "5 of 8, waystone.nvim",
  );
});
