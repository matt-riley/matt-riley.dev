import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    audioContexts: AudioContext[];
    audioStarts: number;
    audioLimiter?: WaveShaperNode;
  }
}
async function observeAudio(page: Page, saved: "on" | "off" = "off") {
  await page.addInitScript((value) => {
    localStorage.setItem("mr-view", "catalogue");
    localStorage.setItem("mr-sound", value);
    window.audioContexts = [];
    window.audioStarts = 0;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        window.audioContexts.push(this);
      }
    };
    const oscillator = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (
      this: OscillatorNode,
      ...args: Parameters<OscillatorNode["start"]>
    ) {
      window.audioStarts++;
      return Reflect.apply(oscillator, this, args);
    };
    const buffer = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      this: AudioBufferSourceNode,
      ...args: Parameters<AudioBufferSourceNode["start"]>
    ) {
      window.audioStarts++;
      return Reflect.apply(buffer, this, args);
    };
    const shape = BaseAudioContext.prototype.createWaveShaper;
    BaseAudioContext.prototype.createWaveShaper = function (
      this: BaseAudioContext,
    ) {
      const node = shape.call(this);
      window.audioLimiter = node;
      return node;
    };
  }, saved);
}

test("audio code waits for opt-in, toggles reuse one context, and Off prevents all voices", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(!javaScriptEnabled, "Sound is an optional browser enhancement.");
  await observeAudio(page);
  const requested: string[] = [];
  page.on("request", (request) => {
    if (/\/sound\.[\w-]+\.js(?:\?|$)/.test(request.url()))
      requested.push(request.url());
  });
  await page.goto("/archive-gallery/");
  await page.waitForTimeout(250);
  expect(requested).toEqual([]);
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(0);
  await page.getByRole("button", { name: "Sound: Off", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-audio", "ready", {
    timeout: 10_000,
  });
  expect(requested.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(1);
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-setting="sound"]',
    );
    for (let index = 0; index < 10; index++) {
      button?.click();
      button?.click();
    }
  });
  await expect(page.locator("html")).toHaveAttribute("data-audio", "ready", {
    timeout: 10_000,
  });
  await expect
    .poll(() => page.evaluate(() => window.audioContexts[0].state))
    .toBe("running");
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => window.audioContexts[0].state))
    .toBe("suspended");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("html")).toHaveAttribute("data-audio", "ready", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Sound: On", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.audioContexts[0].state))
    .toBe("suspended");
  const before = await page.evaluate(() => window.audioStarts);
  await page.evaluate(() => {
    for (const exhibit of [
      "cat",
      "tools",
      "flagz",
      "waffle-agent",
      "acquisitions",
      "waystone",
    ])
      document.dispatchEvent(
        new CustomEvent("mr:touch", { detail: { exhibit, model: exhibit } }),
      );
    document.dispatchEvent(
      new CustomEvent("mr:waffle-character", {
        detail: { index: 1, typing: true },
      }),
    );
    document.dispatchEvent(
      new CustomEvent("mr:setting", {
        detail: { key: "lights", value: "after-hours" },
      }),
    );
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.audioStarts)).toBe(before);
});

test("a saved On preference stays silent until a trusted gesture without autoplay errors", async ({
  page,
  javaScriptEnabled,
}) => {
  test.skip(
    !javaScriptEnabled,
    "Autoplay policy applies to the sound enhancement.",
  );
  await observeAudio(page, "on");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/archive-gallery/");
  await expect(
    page.getByRole("button", { name: "Sound: On", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-audio", "pending");
  await page.evaluate(() =>
    document.dispatchEvent(
      new CustomEvent("mr:touch", { detail: { exhibit: "cat", model: "cat" } }),
    ),
  );
  expect(
    await page.evaluate(() => ({
      contexts: window.audioContexts.length,
      starts: window.audioStarts,
    })),
  ).toEqual({ contexts: 0, starts: 0 });
  await page
    .getByRole("button", { name: "Touch the rope", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-audio", "ready", {
    timeout: 10_000,
  });
  expect(await page.evaluate(() => window.audioContexts.length)).toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.audioStarts))
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("the real output analyser stays below -6dBFS during rapid touches", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chromium",
    "The real Web Audio graph is measured once.",
  );
  await observeAudio(page);
  await page.goto("/archive-gallery/");
  await page.getByRole("button", { name: "Sound: Off", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-audio", "ready", {
    timeout: 10_000,
  });
  const peak = await page.evaluate(async () => {
    const context = window.audioContexts[0],
      limiter = window.audioLimiter;
    if (!limiter) throw new Error("No final sound limiter");
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    limiter.connect(analyser);
    const values = new Float32Array(analyser.fftSize);
    let peak = 0,
      frame = 0,
      index = 0;
    const sample = () => {
      analyser.getFloatTimeDomainData(values);
      for (const value of values) peak = Math.max(peak, Math.abs(value));
      frame = requestAnimationFrame(sample);
    };
    const exhibits = [
      "tools",
      "flagz",
      "acquisitions",
      "waffle-agent",
      "waystone",
      "cat",
    ];
    const timer = setInterval(() => {
      const exhibit = exhibits[index++ % exhibits.length];
      document.dispatchEvent(
        new CustomEvent("mr:touch", { detail: { exhibit, model: exhibit } }),
      );
    }, 8);
    sample();
    await new Promise((resolve) => setTimeout(resolve, 1800));
    clearInterval(timer);
    cancelAnimationFrame(frame);
    limiter.disconnect(analyser);
    analyser.disconnect();
    return peak;
  });
  expect(peak).toBeGreaterThan(0.001);
  expect(peak).toBeLessThan(10 ** (-6 / 20));
  info.annotations.push({
    type: "audio peak",
    description: `${peak.toFixed(5)} linear / ${(20 * Math.log10(peak)).toFixed(2)} dBFS`,
  });
});
