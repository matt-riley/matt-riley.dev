import { expect, test } from "@playwright/test";
import { encodePattern } from "../src/scripts/drum-pattern";
import { allowSoftwareWebGL } from "./gallery-capability";
import { environment, prepareRelease, releaseStops } from "./release-fixture";

test.afterEach(async ({ page, browser }, info) => {
  await environment(page, browser, info);
});

for (const view of ["catalogue", "gallery"])
  for (const lights of ["day", "after-hours"])
    test(`${view}/${lights}: nine-stop Firefox engine preflight`, async ({
      page,
    }, info) => {
      await prepareRelease(page, lights, view);
      if (view === "gallery") {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await allowSoftwareWebGL(page);
      }
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      if (view === "gallery") {
        await expect
          .poll(() => page.locator("html").getAttribute("data-gallery"), {
            timeout: 30_000,
          })
          .toMatch(/^(ready|unavailable)$/);
        const capability = await page
          .locator("html")
          .getAttribute("data-gallery");
        await info.attach("gallery-capability", {
          body: JSON.stringify({
            requested: view,
            actual: capability,
            softwareFixture: true,
          }),
          contentType: "application/json",
        });
        if (capability !== "ready")
          info.annotations.push({
            type: "coverage limitation",
            description:
              "This Firefox runner declined WebGL; catalogue fallback checked, actual Firefox gallery remains unverified.",
          });
      }
      const visits: {
        id: string;
        gallery: string | null;
        view: string | null;
      }[] = [];
      for (const [index, id] of releaseStops.entries()) {
        const section = page.locator(`#${id}`);
        await section.evaluate((element) =>
          element.scrollIntoView({ block: "center", behavior: "instant" }),
        );
        await expect(
          section.getByRole("heading", { level: index === 0 ? 1 : 2 }),
        ).toBeVisible();
        if (id === "flagz") {
          for (const name of ["lights", "cat", "sound"]) {
            const control = section.getByRole("switch", { name, exact: true });
            const before = await control.getAttribute("aria-checked");
            await control.click();
            await expect(control).toHaveAttribute(
              "aria-checked",
              before === "true" ? "false" : "true",
            );
            await control.click();
            await expect(control).toHaveAttribute("aria-checked", before ?? "");
          }
        } else {
          const touch = section.locator("[data-touch]").first();
          await touch.click();
          if (await touch.evaluate((element) => element.tagName === "SUMMARY"))
            await expect(touch.locator("..")).toHaveAttribute("open", "");
        }
        visits.push({
          id,
          gallery: await page.locator("html").getAttribute("data-gallery"),
          view: await page.locator("html").getAttribute("data-view"),
        });
        if (id === "human-error") {
          await section
            .getByRole("button", { name: /Touch the microphone/ })
            .click();
          await section
            .getByRole("button", { name: /Touch the empty plinth/ })
            .click();
          const pad = section.getByRole("button", {
            name: "kick, step 1",
            exact: true,
          });
          const before = await pad.getAttribute("aria-pressed");
          await pad.click();
          await expect(pad).toHaveAttribute(
            "aria-pressed",
            before === "true" ? "false" : "true",
          );
        }
      }
      await info.attach("stop-coverage", {
        body: JSON.stringify(visits, null, 2),
        contentType: "application/json",
      });
      if (
        view === "gallery" &&
        visits.some(
          (visit) => visit.gallery !== "ready" || visit.view !== "gallery",
        )
      )
        info.annotations.push({
          type: "coverage limitation",
          description:
            "One or more stops ran in catalogue fallback; this is not a completed Firefox gallery walkthrough.",
        });
      expect(errors).toEqual([]);
    });

test("wide, short, landscape and mid-visit resizing retain all catalogue placards", async ({
  page,
}) => {
  await prepareRelease(page);
  await page.goto("/");
  for (const [width, height] of [
    [2560, 900],
    [1440, 600],
    [844, 390],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page
      .locator("#human-error details[data-reveal]")
      .evaluate((drawer) => {
        (drawer as HTMLDetailsElement).open = true;
      });
    await page
      .locator("#human-error")
      .evaluate((section) =>
        section.scrollIntoView({ block: "center", behavior: "instant" }),
      );
    const bounds = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      placards: [
        ...document.querySelectorAll("section[data-exhibit] .placard"),
      ].map((element) => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width };
      }),
    }));
    expect(bounds.document).toBeLessThanOrEqual(width + 1);
    expect(bounds.placards).toHaveLength(9);
    for (const placard of bounds.placards) {
      expect(placard.left).toBeGreaterThanOrEqual(-1);
      expect(placard.right).toBeLessThanOrEqual(width + 1);
      expect(placard.width).toBeGreaterThan(200);
    }
  }
});

test("native history, stop fragments and shared beats restore without autoplay", async ({
  page,
}) => {
  await prepareRelease(page);
  await page.goto("/#tools");
  await page.goto("/privacy");
  await expect(page.locator("h1")).toContainText("Privacy");
  await page.goBack();
  await expect(page).toHaveURL(/\/#tools$/);
  await expect(page.locator("#tools-heading")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/privacy\/?$/);
  await page.goto("/");
  await page.locator("[data-stop-menu] > summary").click();
  await page.locator('[data-stop="human-error"]').click();
  await expect(page).toHaveURL(/#human-error$/);
  const pattern = {
    rows: [32769, 4112, 43690, 128] as [number, number, number, number],
    tempo: 103,
    swing: 64,
  };
  await page.goto(`/#boom=${encodePattern(pattern)}`);
  await expect(page.locator("[data-drum-play]")).toBeVisible();
  await expect(page.locator("[data-drum-play]")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator("html")).toHaveAttribute("data-sound", "off");
  await expect(page.locator("[data-drum-tempo]")).toHaveValue("103");
  await expect(page.locator("[data-drum-swing]")).toHaveValue("64");
});

test("offline reload is recorded separately from successful online recovery", async ({
  page,
  context,
}, info) => {
  await prepareRelease(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  let failure: string | undefined;
  try {
    await page.reload({ timeout: 10_000, waitUntil: "domcontentloaded" });
  } catch (error) {
    failure = String(error);
  }
  const readable =
    !failure && (await page.locator("#entrance-heading").isVisible());
  await info.attach("offline-reload", {
    body: JSON.stringify(
      {
        readable,
        navigationError: failure,
        scope:
          "Browser HTTP-cache behavior only; this site does not install an offline service worker.",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  if (!readable)
    info.annotations.push({
      type: "release limitation",
      description:
        "Offline reload unavailable; this diagnostic does not mark the offline experience passed.",
    });
  await context.setOffline(false);
  await page.goto("/");
  await expect(page.locator("#entrance-heading")).toBeVisible();
});
