import { expect, test } from "@playwright/test";
import { type CatVisit, chooseCatSpot } from "../src/gallery/cat-state";
import { allowSoftwareWebGL } from "./gallery-capability";

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
  test.use({ video: "on" });
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
    await page.goto("/");
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
    const spotStops = [0, 1, 2, 3, 3, 4, 5, 6, 7, 7, 8, 8, 8];
    for (const id of [...stops, ...stops.slice(0, -1).reverse()]) {
      await page.evaluate(
        (stop) =>
          document
            .getElementById(stop)
            ?.scrollIntoView({ block: "center", behavior: "smooth" }),
        id,
      );
      const index = stops.indexOf(id);
      await expect
        .poll(
          async () => {
            const name = await page
              .locator("html")
              .getAttribute("data-cat-spot");
            return name ? spotStops[Number(name.slice(4))] : -1;
          },
          { timeout: 10_000 },
        )
        .toBe(index);
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
      await page.waitForTimeout(400);
    }
  });

  test("Cat toggles preserve geometry and its native control gives a quiet response", async ({
    page,
  }) => {
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
