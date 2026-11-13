import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const mode of ["day", "after-hours"])
  test(`the open drum machine has no axe violations in ${mode}`, async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(
      !javaScriptEnabled,
      "The no-JavaScript printed catalogue is covered by content checks.",
    );
    await page.addInitScript((mode) => {
      localStorage.setItem("mr-view", "catalogue");
      localStorage.setItem("mr-sound", "off");
      localStorage.setItem("mr-lights", mode);
    }, mode);
    await page.goto("/archive-gallery/#human-error");
    await page
      .locator("#human-error details[data-reveal] > summary")
      .first()
      .click();
    await expect(page.locator("[data-drum-play]")).toBeEnabled();
    const result = await new AxeBuilder({ page })
      .include("[data-drum-machine]")
      .analyze();
    expect(result.violations).toEqual([]);
  });
