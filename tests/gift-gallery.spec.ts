import { expect, type Page, test } from "@playwright/test";
import { allowSoftwareWebGL } from "./gallery-capability";

// Discover actual pick regions through the real pointer/anchor path, without
// reproducing camera-fit maths or exposing a test-only production scene hook.
async function shelfPoints(page: Page) {
  return page.evaluate(() => {
    const blocked = (x: number, y: number) =>
      document
        .elementFromPoint(x, y)
        ?.closest(
          "a,button,summary,.exhibit__label,.site-header,.museum-footer",
        );
    const pointer = (type: string, x: number, y: number) =>
      document.dispatchEvent(
        new PointerEvent(type, {
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerdown" ? 1 : 0,
          cancelable: true,
        }),
      );
    const mask: Array<{ x: number; y: number }> = [];
    for (let y = 110; y < innerHeight - 20; y += 10)
      for (let x = 20; x < innerWidth - 20; x += 24) {
        if (blocked(x, y)) continue;
        pointer("pointermove", x, y);
        if (document.body.style.cursor === "pointer") mask.push({ x, y });
      }
    if (!mask.length) throw new Error("No visible gift-shelf pick region");
    let hit = "";
    const hits: Record<string, Array<{ x: number; y: number }>> = {};
    const capture = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("[data-gift-link]")
          : null;
      if (link) {
        event.preventDefault();
        hit = link.dataset.giftLink ?? "";
      }
    };
    document.addEventListener("click", capture, true);
    try {
      const left = Math.min(...mask.map((point) => point.x)) - 24;
      const right = Math.max(...mask.map((point) => point.x)) + 24;
      const top = Math.min(...mask.map((point) => point.y)) - 10;
      const bottom = Math.max(...mask.map((point) => point.y)) + 10;
      for (let y = top; y <= bottom; y += 3)
        for (let x = left; x <= right; x += 5) {
          if (blocked(x, y)) continue;
          hit = "";
          pointer("pointerdown", x, y);
          pointer("pointerup", x, y);
          if (hit) {
            hits[hit] ??= [];
            hits[hit].push({ x, y });
          }
        }
    } finally {
      document.removeEventListener("click", capture, true);
      pointer("pointercancel", 0, 0);
    }
    return Object.fromEntries(
      Object.entries(hits).map(([kind, points]) => [
        kind,
        {
          x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
          y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
        },
      ]),
    );
  });
}

test("all three physical shelf objects activate their real native anchors", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Real WebGL object picking is checked once",
  );
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await allowSoftwareWebGL(page);
  await page.addInitScript(() => localStorage.setItem("mr-view", "gallery"));
  await page.goto("/archive-gallery/#gift-shop");
  await expect(page.locator("html")).toHaveAttribute("data-gallery", "ready", {
    timeout: 30_000,
  });
  await expect(page.locator("html")).toHaveAttribute("data-exhibits", "ready");
  await page.mouse.move(720, 500);
  const points = await shelfPoints(page);
  expect(Object.keys(points).sort()).toEqual(["github", "tools", "work"]);
  for (const kind of ["work", "tools", "github"]) {
    await page.goto("/archive-gallery/#gift-shop");
    await expect(page.locator("html")).toHaveAttribute(
      "data-gallery",
      "ready",
      { timeout: 30_000 },
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-exhibits",
      "ready",
    );
    const href = await page
      .locator(`[data-gift-link="${kind}"]`)
      .getAttribute("href");
    if (!href) throw new Error(`Missing ${kind} destination`);
    await page.route(href, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<title>${kind} destination</title>`,
      }),
    );
    await page.mouse.click(points[kind].x, points[kind].y);
    await expect(page).toHaveURL(href);
  }
});
