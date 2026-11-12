import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    boardShifts: number[];
  }
}

test("the acquisitions board is readable once per row without browser GitHub requests", async ({
  page,
  javaScriptEnabled,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      /(^|\.)(github\.com|githubusercontent\.com)$/.test(
        new URL(request.url()).hostname,
      )
    )
      requests.push(request.url());
  });
  await page.goto("/");
  const board = page.locator("#acquisitions [data-split-flap]");
  await expect(board).toBeVisible();
  const rows = board.locator(".flap-row");
  await expect(rows).toHaveCount(5);
  await expect(
    board.getByRole("heading", { name: "Materials", exact: true }),
  ).toBeVisible();
  await expect(
    board.getByRole("heading", { name: "Catalogue raisonné" }),
  ).toBeVisible();
  for (const row of await rows.all()) {
    const text = (await row.locator(".flap-copy").textContent()) ?? "";
    await expect(row).toHaveAccessibleName(text);
    await expect(row).toHaveAttribute("href", /^https:\/\/github\.com\//);
  }
  if (javaScriptEnabled) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
  }
  expect(requests).toEqual([]);
});

test("the lazy flap enhancement has no layout shift and touching advances the board", async ({
  page,
  javaScriptEnabled,
  reducedMotion,
}) => {
  test.skip(!javaScriptEnabled, "The static board is covered separately.");
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "catalogue");
    const state = window;
    state.boardShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (
          !(entry as PerformanceEntry & { hadRecentInput: boolean })
            .hadRecentInput
        ) {
          state.boardShifts.push(
            (entry as PerformanceEntry & { value: number }).value,
          );
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    window.boardShifts = [];
  });
  const section = page.locator("#acquisitions");
  await section.scrollIntoViewIfNeeded();
  const board = section.locator("[data-split-flap]");
  await expect(board).toHaveAttribute("data-flap-ready", "true");
  await page.waitForTimeout(600);
  if (page.context().browser()?.browserType().name() === "chromium") {
    expect(await page.evaluate(() => window.boardShifts)).toEqual([]);
  }
  const first = board.locator(".flap-copy").first();
  const before = (await first.textContent()) ?? "";
  await section.locator("[data-touch]").click();
  await expect(first).not.toHaveText(before);
  if (reducedMotion === "reduce")
    await expect(board.locator(".flap-cell")).toHaveCount(0);
  else {
    await expect(board.locator(".flap-cells").first()).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    const copy = (await first.textContent()) ?? "";
    await expect(board.locator(".flap-row").first()).toHaveAccessibleName(copy);
  }
});
