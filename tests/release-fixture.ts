import {
  type Browser,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";

export const releaseStops = [
  "entrance",
  "tools",
  "flagz",
  "waffle-agent",
  "agent-skills",
  "waystone",
  "acquisitions",
  "human-error",
  "gift-shop",
] as const;

export async function prepareRelease(
  page: Page,
  lights = "day",
  view = "catalogue",
) {
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  await page.addInitScript(
    ({ mode, view }) => {
      localStorage.setItem("mr-view", view);
      localStorage.setItem("mr-lights", mode);
      localStorage.setItem("mr-sound", "off");
      localStorage.setItem("mr-cat", "on");
      sessionStorage.setItem("mr-entrance-seen", "true");
    },
    { mode: lights, view },
  );
}

export async function readySection(page: Page, id: string) {
  const section = page.locator(`#${id}`);
  await section.evaluate((element) => {
    element
      .querySelectorAll<HTMLDetailsElement>("details[data-reveal]")
      .forEach((drawer) => {
        drawer.open = true;
      });
    element.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      if (image.getClientRects().length) image.loading = "eager";
    });
    element.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      section
        .locator("img")
        .evaluateAll((images) =>
          (images as HTMLImageElement[])
            .filter((image) => image.getClientRects().length)
            .every((image) => image.complete && image.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await section.locator("img").evaluateAll(async (images) => {
    await Promise.all(
      (images as HTMLImageElement[])
        .filter((image) => image.getClientRects().length)
        .map((image) => image.decode()),
    );
  });
  return section;
}

export async function environment(
  page: Page,
  browser: Browser,
  info: TestInfo,
) {
  await info.attach("browser-environment", {
    body: JSON.stringify(
      {
        engine: browser.browserType().name(),
        version: browser.version(),
        runnerOS: process.platform,
        project: info.project.name,
        viewport: page.viewportSize(),
        userAgent: await page.evaluate(() => navigator.userAgent),
        scope:
          "Automated engine; not proof of a shipping native browser or physical phone.",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
}
