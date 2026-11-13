import { expect, type Page, test } from "@playwright/test";
import { type DrumPattern, encodePattern } from "../src/scripts/drum-pattern";

declare global {
  interface Window {
    drumContexts: AudioContext[];
    drumStarts: number[];
    drumScheduled: { step: number; when: number; now: number }[];
  }
}
async function prepare(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mr-view", "catalogue");
    localStorage.setItem("mr-sound", "off");
    localStorage.setItem("mr-lights", "day");
    window.drumContexts = [];
    window.drumStarts = [];
    window.drumScheduled = [];
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        window.drumContexts.push(this);
      }
    };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, when = 0) {
      window.drumStarts.push(when);
      return start.call(this, when);
    };
    document.addEventListener("mr:drum-scheduled", (event) => {
      const note = (event as CustomEvent).detail;
      window.drumScheduled.push({
        ...note,
        now: window.drumContexts[0]?.currentTime ?? 0,
      });
    });
  });
}
async function showMachine(page: Page) {
  const drawer = page.locator("#human-error details[data-reveal]").first();
  if (
    !(await drawer.evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await drawer.locator(":scope > summary").click();
  await page.locator("[data-drum-machine]").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-drum-play]")).toBeEnabled();
}
async function readPattern(page: Page) {
  return page.locator("[data-drum-machine]").evaluate((root) => {
    const rows = [0, 0, 0, 0];
    root
      .querySelectorAll<HTMLElement>('[data-drum-step][aria-pressed="true"]')
      .forEach((button) => {
        rows[Number(button.dataset.drumRow)] |=
          1 << Number(button.dataset.drumStep);
      });
    return {
      rows,
      tempo: Number(
        root.querySelector<HTMLInputElement>("[data-drum-tempo]")?.value,
      ),
      swing: Number(
        root.querySelector<HTMLInputElement>("[data-drum-swing]")?.value,
      ),
    };
  });
}

test("the complete drum grid can be programmed and played with the keyboard after explicit consent", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(!javaScriptEnabled, "Programming is the DOM enhancement.");
  await prepare(page);
  await page.goto("/archive-gallery/#human-error");
  await showMachine(page);
  await page.locator("[data-drum-clear]").focus();
  await page.keyboard.press("Space");
  const first = page.getByRole("button", { name: "kick, step 1", exact: true });
  await first.focus();
  for (let row = 0; row < 4; row++) {
    for (let step = 0; step < 16; step++) {
      await page.keyboard.press("Space");
      if (step < 15) await page.keyboard.press("ArrowRight");
    }
    if (row < 3) {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Home");
    }
  }
  expect((await readPattern(page)).rows).toEqual([65535, 65535, 65535, 65535]);
  await expect(
    page.getByRole("button", { name: "open hat, step 16", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "open hat, step 16", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-sound", "off");
  expect(await page.evaluate(() => window.drumContexts.length)).toBe(0);
  await expect(page.locator("[data-drum-play]")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.locator("[data-drum-play]").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-drum-yes]")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.drumScheduled.length))
    .toBeGreaterThan(0);
  await expect(page.locator("[data-drum-play]")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-drum-play]")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("shared URLs reproduce the full pattern in a fresh browser without autoplay", async ({
  page,
  browser,
  javaScriptEnabled,
}) => {
  test.skip(
    !javaScriptEnabled,
    "Fragments are decoded by the DOM enhancement.",
  );
  const pattern: DrumPattern = {
    rows: [32769, 4112, 43690, 128],
    tempo: 103,
    swing: 64,
  };
  await prepare(page);
  await page.goto(`/archive-gallery/#boom=${encodePattern(pattern)}`);
  await expect(page.locator("[data-drum-play]")).toBeVisible();
  expect(await readPattern(page)).toEqual(pattern);
  await expect(page.locator("[data-drum-play]")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await page.evaluate(() => window.drumContexts.length)).toBe(0);
  const context = await browser.newContext();
  const second = await context.newPage();
  await prepare(second);
  await second.goto(page.url());
  expect(await readPattern(second)).toEqual(pattern);
  expect(await second.evaluate(() => window.drumContexts.length)).toBe(0);
  await context.close();
});

test("drum code waits for near plus Play, asks inline once, and stops on Off, hidden and distance", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(!javaScriptEnabled, "Playback is optional Web Audio.");
  await prepare(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/drums\.[\w-]+\.js(?:\?|$)/.test(request.url()))
      requests.push(request.url());
  });
  await page.goto("/archive-gallery/");
  await page.waitForTimeout(200);
  expect(requests).toEqual([]);
  await showMachine(page);
  await page.waitForTimeout(200);
  expect(requests).toEqual([]);
  await page.locator("[data-drum-play]").click();
  await expect(page.locator("[data-drum-consent]")).toBeVisible();
  await expect(page.locator("[data-drum-consent]")).toHaveCount(1);
  expect(await page.evaluate(() => window.drumContexts.length)).toBe(0);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await page.locator("[data-drum-no]").click();
  await expect(page.locator("html")).toHaveAttribute("data-sound", "off");
  await page.locator("[data-drum-play]").click();
  await page.locator("[data-drum-yes]").click();
  await expect(page.locator("[data-drum-play]")).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 10_000 },
  );
  await expect
    .poll(() => page.evaluate(() => window.drumScheduled.length))
    .toBeGreaterThan(0);
  await page.evaluate(() =>
    document
      .getElementById("tools")
      ?.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await expect(page.locator("[data-drum-play]")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await showMachine(page);
  await page.locator("[data-drum-play]").click();
  await expect(page.locator("[data-drum-play]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("[data-drum-play]")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.locator("[data-drum-play]").click();
  await expect(page.locator("[data-drum-play]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Sound: On", exact: true }).click();
  await expect(page.locator("[data-drum-play]")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("actual oscillator deadlines stay within 2ms of the swung audio clock for 30 seconds", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "One real audio-clock timing capture is sufficient.",
  );
  test.setTimeout(50_000);
  await prepare(page);
  await page.goto("/archive-gallery/#human-error");
  await showMachine(page);
  await page.locator("[data-drum-clear]").click();
  for (let step = 1; step <= 16; step++)
    await page
      .getByRole("button", { name: `kick, step ${step}`, exact: true })
      .click();
  await page.getByRole("button", { name: "Sound: Off", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-audio", "ready", {
    timeout: 10_000,
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    window.drumStarts = [];
    window.drumScheduled = [];
  });
  await page.locator("[data-drum-play]").click();
  await expect
    .poll(() => page.evaluate(() => window.drumScheduled.length))
    .toBeGreaterThan(0);
  await page.waitForTimeout(30_100);
  await page.locator("[data-drum-play]").click();
  const log = await page.evaluate(() => ({
    starts: window.drumStarts,
    notes: window.drumScheduled,
  }));
  await info.attach("audio-clock-raw", {
    body: JSON.stringify(log, null, 2),
    contentType: "application/json",
  });
  expect(log.starts.length).toBeGreaterThan(150);
  expect(log.notes.length).toBe(log.starts.length);
  let maximum = 0;
  for (let index = 0; index < log.notes.length; index++) {
    expect(Math.abs(log.starts[index] - log.notes[index].when)).toBeLessThan(
      0.002,
    );
    if (!index) continue;
    const expected =
      (60 / 88 / 4) * (log.notes[index - 1].step % 2 === 0 ? 1.16 : 0.84);
    maximum = Math.max(
      maximum,
      Math.abs(log.starts[index] - log.starts[index - 1] - expected),
    );
    expect(log.notes[index].step).toBe((log.notes[index - 1].step + 1) % 16);
  }
  expect((log.starts.at(-1) ?? 0) - log.starts[0]).toBeGreaterThan(29.5);
  expect(maximum).toBeLessThan(0.002);
  console.info(
    `Audio clock: ${log.notes.length} notes over 30 seconds, maximum interval deviation ${(maximum * 1000).toFixed(6)}ms.`,
  );
  await info.attach("audio-clock-30s", {
    body: JSON.stringify(
      { tempo: 88, swing: 58, maximumDeviationMs: maximum * 1000, ...log },
      null,
      2,
    ),
    contentType: "application/json",
  });
});
