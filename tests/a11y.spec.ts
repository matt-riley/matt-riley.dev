import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { siteRoutes } from "./routes";

for (const route of siteRoutes()) {
  for (const lights of ["day", "after-hours"] as const) {
    test(`${route} has no accessibility violations in ${lights}`, async ({
      page,
    }) => {
      await page.goto(route);
      await page.evaluate((value) => {
        document.documentElement.dataset.lights = value;
      }, lights);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
