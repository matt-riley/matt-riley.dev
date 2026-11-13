import { expect, test } from "@playwright/test";
import { openingHoursAt } from "../src/exhibits/opening-hours";

test("the Yorkshire clock handles both sides of the daylight-saving changes", () => {
  test.skip(
    test.info().project.name !== "desktop-chromium",
    "Timezone formatter is independent of browser.",
  );
  for (const [instant, time] of [
    ["2026-03-29T00:30:00Z", "00:30"],
    ["2026-03-29T01:30:00Z", "02:30"],
    ["2026-10-25T00:30:00Z", "01:30"],
    ["2026-10-25T01:30:00Z", "01:30"],
  ])
    expect(openingHoursAt(new Date(instant)).time).toBe(time);
  expect(openingHoursAt(new Date("2026-11-12T23:00:00Z")).text).toBe(
    "The museum is closed. The cat let you in.",
  );
  expect(openingHoursAt(new Date("2026-07-12T13:12:00Z")).text).toBe(
    "Open. It is 14:12 in Yorkshire.",
  );
});

test("opening hours use London time in Los Angeles and Tokyo and remain static without JavaScript", async ({
  browser,
  javaScriptEnabled,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium" &&
      info.project.name !== "no-javascript",
    "Clock scenarios run once per script capability.",
  );
  for (const timezoneId of ["America/Los_Angeles", "Asia/Tokyo"]) {
    const context = await browser.newContext({ timezoneId, javaScriptEnabled });
    const page = await context.newPage();
    if (javaScriptEnabled)
      await page.clock.setFixedTime(new Date("2026-07-12T13:12:00Z"));
    await page.goto(
      new URL(
        "/archive-gallery/",
        info.config.projects[0].use.baseURL ?? "http://127.0.0.1:4333",
      ).href,
    );
    const hours = page.locator("[data-opening-hours]");
    await expect(hours).toHaveText(
      javaScriptEnabled
        ? "Open. It is 14:12 in Yorkshire."
        : "Open most hours. Yorkshire time.",
    );
    if (javaScriptEnabled) {
      await page.clock.setFixedTime(new Date("2026-11-12T23:00:00Z"));
      await page.evaluate(() =>
        document.dispatchEvent(new Event("visibilitychange")),
      );
      await expect(hours).toHaveText(
        "The museum is closed. The cat let you in.",
      );
    }
    await context.close();
  }
});

test("rope controls announce the same result for click, touch and keyboard", async ({
  page,
  javaScriptEnabled,
  isMobile,
}) => {
  test.skip(
    !javaScriptEnabled,
    "Static catalogue has no event-driven announcements.",
  );
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  await page.goto("/archive-gallery/");
  const rope = page.getByRole("button", { name: "Touch the rope" });
  if (isMobile) await rope.tap();
  else await rope.click();
  await expect(page.locator("#entrance [data-touch-result]")).toHaveText(
    "The rope was never hooked.",
  );
  await rope.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#entrance [data-touch-result]")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  await expect(page.locator("#entrance [data-touch-result]")).toHaveText(
    "The rope was never hooked.",
  );
});

test("the rope adapter damps to rest, repeats without drift and releases its frame listener", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "Adapter lifecycle is independent of browser and pointer type.",
  );
  const { readFileSync } = await import("node:fs");
  const ts = await import("typescript");
  const code = ts.transpileModule(
    readFileSync("src/exhibits/entrance-visual.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  await page.goto("/archive-gallery/");
  const result = await page.evaluate(async (moduleCode) => {
    const { mountEntrance } = await import(
      `data:text/javascript,${encodeURIComponent(moduleCode)}`
    );
    const part = {
      rotation: { z: 0.1 },
      userData: { axis: "z", range: [-0.18, 0.18] },
    };
    let frame = (_delta: number) => false;
    let wake = 0,
      releases = 0;
    const section = document.getElementById("entrance");
    const cleanup = mountEntrance({
      records: new Map([
        ["entrance", { parts: new Map([["touch_rope", part]]) }],
      ]),
      app: {
        requestRender: () => {
          wake++;
        },
        onFrame: (callback: typeof frame) => {
          frame = callback;
          return () => {
            releases++;
          };
        },
      },
      setDraggable: () => () => {
        releases++;
      },
      setTouchHandler: (_id: string, handler: EventListener) => {
        section?.addEventListener("mr:touch", handler);
        return () => {
          section?.removeEventListener("mr:touch", handler);
          releases++;
        };
      },
    });
    section?.querySelector<HTMLButtonElement>("button[data-touch]")?.click();
    frame(0.12);
    const moved = part.rotation.z !== 0.1;
    for (let index = 0; index < 65; index++) frame(0.05);
    const resting = part.rotation.z;
    const idle = frame(0.05);
    section?.querySelector<HTMLButtonElement>("button[data-touch]")?.click();
    frame(0.12);
    const repeated = part.rotation.z !== 0.1;
    cleanup();
    return {
      moved,
      repeated,
      resting,
      idle,
      final: part.rotation.z,
      wake,
      releases,
    };
  }, code);
  expect(result).toEqual({
    moved: true,
    repeated: true,
    resting: 0.1,
    idle: false,
    final: 0.1,
    wake: 2,
    releases: 3,
  });
});

test("the quiet entrance cue follows native navigation and then gets out of the way", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "One native anchor check covers the cue.",
  );
  await page.addInitScript(() => localStorage.setItem("mr-view", "catalogue"));
  await page.goto("/archive-gallery/");
  const cue = page.locator("[data-scroll-cue]");
  await expect(cue).toBeVisible();
  await cue.click();
  await expect(page).toHaveURL(/#tools$/);
  await expect(cue).toBeHidden();
});
