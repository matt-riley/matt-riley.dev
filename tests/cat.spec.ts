import { expect, test } from "@playwright/test";
import { type CatVisit, chooseCatSpot } from "../src/gallery/cat-state";
import { allowSoftwareWebGL } from "./gallery-capability";

test.use({
  video: "on",
  viewport: { width: 960, height: 600 },
  deviceScaleFactor: 1,
});

test("cat choices persist their seeded sequence and avoid the previous spot", async ({
  browserName,
}, info) => {
  test.skip(
    browserName !== "chromium" || info.project.name !== "desktop-chromium",
    "Shared seeded policy.",
  );
  const visit: CatVisit = { random: 1987, last: {} };
  chooseCatSpot(visit, 3, ["cat_3", "cat_4"]);
  const restored = JSON.parse(JSON.stringify(visit)) as CatVisit;
  for (let step = 0; step < 20; step++) {
    const previous = visit.last[3];
    const next = chooseCatSpot(visit, 3, ["cat_3", "cat_4"]);
    expect(next).not.toBe(previous);
    expect(chooseCatSpot(restored, 3, ["cat_3", "cat_4"])).toBe(next);
  }
  expect(chooseCatSpot(visit, 7, ["cat_9"])).toBe("cat_9");
  expect(chooseCatSpot(visit, 8, ["cat_11"])).toBe("cat_11");
});

test.describe("the real gallery figurine", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(
      info.project.name !== "desktop-chromium",
      "Recorded real-renderer gallery tour.",
    );
    await allowSoftwareWebGL(page);
    await page.addInitScript(() => {
      localStorage.setItem("mr-view", "gallery");
      localStorage.setItem("mr-cat", "on");
    });
    await page.goto("/archive-gallery/");
    await expect(page.locator("html")).toHaveAttribute(
      "data-gallery",
      "ready",
      { timeout: 15_000 },
    );
  });

  test("a tour encounters the figurine at every stop and preserves both scripted poses", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const stops = [
      "entrance",
      "tools",
      "flagz",
      "waffle-agent",
      "agent-skills",
      "waystone",
      "acquisitions",
      "human-error",
      "gift-shop",
    ];
    for (const id of [...stops, ...stops.slice(0, -1).reverse()]) {
      await page.evaluate(
        (stop) =>
          document
            .getElementById(stop)
            // This tour verifies rendered placement and poses. Browser smooth
            // scrolling plus rail damping needlessly benchmarks SwiftShader;
            // rail interpolation and slow-frame retreat have separate checks.
            ?.scrollIntoView({ block: "center", behavior: "instant" }),
        id,
      );
      const index = stops.indexOf(id);
      await expect(page.locator("[data-current-stop]")).toContainText(
        `${index} of 8`,
        { timeout: 10_000 },
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-cat-spot",
        /^cat_\d+$/,
      );
      if (index === 7) {
        await expect(page.locator("html")).toHaveAttribute(
          "data-cat-spot",
          "cat_9",
        );
        await expect(page.locator("html")).toHaveAttribute(
          "data-cat-pose",
          "sit",
        );
      }
      if (index === 8) {
        await expect(page.locator("html")).toHaveAttribute(
          "data-cat-spot",
          "cat_11",
        );
        await expect(page.locator("html")).toHaveAttribute(
          "data-cat-pose",
          "sleep",
        );
      }
      await page.waitForTimeout(1200);
      const screenshot = test
        .info()
        .outputPath(`${id}-${index}-${Date.now()}.png`);
      await page.screenshot({ path: screenshot });
      await test.info().attach(`${index}-${id}`, {
        path: screenshot,
        contentType: "image/png",
      });
      await expect(page.locator("html")).toHaveAttribute(
        "data-gallery",
        "ready",
      );
    }
  });

  test("Cat toggles preserve geometry and its native control gives a quiet response", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const canvas = page.locator(".gallery-canvas");
    const before = await canvas.screenshot();
    await page.getByRole("button", { name: "Cat: On", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-cat", "off");
    await page.waitForTimeout(400);
    expect(await canvas.screenshot()).not.toEqual(before);
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-cat", "on");
    await page.waitForTimeout(400);
    await page.locator("[data-cat-touch]").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-cat-result]")).toHaveText(
      "Please do not touch the Head of Security.",
    );
    await expect(page.locator(".gallery-touch-hint")).toContainText(
      "Please do not touch",
    );
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-cat-result]")).toHaveText(
      "He is working.",
    );
  });
});
