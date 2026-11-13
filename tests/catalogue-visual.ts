import { expect, test } from "@playwright/test";
import {
  environment,
  prepareRelease,
  readySection,
  releaseStops,
} from "./release-fixture";

for (const width of [390, 1440])
  for (const lights of ["day", "after-hours"])
    for (const id of releaseStops)
      test(`${id} at ${width}px in ${lights}`, async ({
        page,
        browser,
      }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await prepareRelease(page, lights);
        await page.goto("/");
        await expect(page.locator("html")).toHaveAttribute(
          "data-view",
          "catalogue",
        );
        await expect(page.locator("[data-gallery-layer]")).toHaveCount(0);
        const section = await readySection(page, id);
        const actual = info.outputPath(`${id}-${width}-${lights}-actual.png`);
        await section.screenshot({
          path: actual,
          animations: "disabled",
          caret: "hide",
        });
        await info.attach(`${id}-${width}-${lights}-actual`, {
          path: actual,
          contentType: "image/png",
        });
        await expect(section).toHaveScreenshot(`${id}-${width}-${lights}.png`, {
          animations: "disabled",
          caret: "hide",
          maxDiffPixels: 20,
        });
        await environment(page, browser, info);
      });
