import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { allowSoftwareWebGL } from "./gallery-capability";
import {
  installMotionClock,
  settleLocatorMotion,
  settlePageMotion,
} from "./motion-settle";
import { siteRoutes } from "./routes";

for (const route of siteRoutes()) {
  for (const lights of ["day", "after-hours"] as const) {
    test(`${route} has no accessibility violations in ${lights}`, async ({
      page,
    }) => {
      await installMotionClock(page);
      await page.goto(route);
      await page.evaluate((value) => {
        document.documentElement.dataset.lights = value;
      }, lights);
      // Entrance typography fades in; audit its final text colour, as in the
      // disclosure matrix below, without disabling the actual animation.
      await settlePageMotion(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}

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

for (const view of ["catalogue", "gallery"] as const) {
  for (const lights of ["day", "after-hours"] as const) {
    test(`${view} ${lights}: every stop and its open disclosures pass axe`, async ({
      page,
    }, info) => {
      test.skip(
        info.project.name !== "desktop-chromium",
        "Full interactive state audit; the route matrix covers other browsers.",
      );
      test.setTimeout(120_000);
      if (view === "gallery") await allowSoftwareWebGL(page);
      await installMotionClock(page);
      await page.addInitScript(
        ({ view, lights }) => {
          localStorage.setItem("mr-view", view);
          localStorage.setItem("mr-lights", lights);
        },
        { view, lights },
      );
      await page.goto("/archive-gallery/");
      if (view === "gallery")
        await expect(page.locator("html")).toHaveAttribute(
          "data-gallery",
          "ready",
          { timeout: 30_000 },
        );
      for (const id of stops) {
        const section = page.locator(`#${id}`);
        await section.evaluate((element) =>
          element.scrollIntoView({ block: "center", behavior: "instant" }),
        );
        for (const open of [false, true]) {
          await section.locator("details").evaluateAll((details, open) => {
            for (const element of details)
              (element as HTMLDetailsElement).open = open;
          }, open);
          // Audit resting text colours after authored disclosure fades finish.
          await settleLocatorMotion(page, `#${id}`);
          if (view === "gallery")
            await expect(page.locator("html")).toHaveAttribute(
              "data-gallery",
              "ready",
            );
          const results = await new AxeBuilder({ page })
            .include(`#${id}`)
            .analyze();
          expect(
            results.violations,
            `${view}/${lights}/${id}/${open ? "open" : "closed"}`,
          ).toEqual([]);
        }
      }
    });
  }
}
